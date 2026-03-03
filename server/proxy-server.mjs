import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || '127.0.0.1';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8'
};

const DEFAULT_BAIDU_BAIKE_APP_ID = '379020';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function sendJson(res, statusCode, payload) {
  setCors(res);
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function appendQuery(url, key, value) {
  const parsed = new URL(url);
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function getErrorText(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function extractLLMContent(provider, data) {
  if (!data || typeof data !== 'object') {
    return '';
  }
  if (provider === 'aliyun') {
    return data.output?.choices?.[0]?.message?.content || data.output?.text || '';
  }
  if (provider === 'baidu') {
    return data.result || '';
  }
  return (
    data.choices?.[0]?.message?.content ||
    data.result ||
    data.output?.text ||
    data.response ||
    ''
  );
}

async function proxyLLMChat(res, body) {
  const provider = String(body.provider || 'custom');
  const apiKey = String(body.apiKey || '');
  const apiUrl = String(body.apiUrl || '');
  const model = String(body.model || '');
  const prompt = String(body.prompt || '');
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
  const maxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : 2000;
  const systemPrompt = String(
    body.systemPrompt || '你是一位专业助手，请输出结构清晰、可执行的结果。'
  );

  if (!apiKey) {
    sendJson(res, 400, { error: 'apiKey 不能为空' });
    return;
  }
  if (!isHttpUrl(apiUrl)) {
    sendJson(res, 400, { error: 'apiUrl 非法或未配置' });
    return;
  }
  if (!prompt) {
    sendJson(res, 400, { error: 'prompt 不能为空' });
    return;
  }

  let upstreamUrl = apiUrl;
  const headers = { 'Content-Type': 'application/json' };
  let upstreamBody;

  if (provider === 'aliyun') {
    headers.Authorization = `Bearer ${apiKey}`;
    upstreamBody = {
      model: model || 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        result_format: 'message',
        max_tokens: maxTokens,
        temperature
      }
    };
  } else if (provider === 'baidu') {
    upstreamUrl = appendQuery(apiUrl, 'access_token', apiKey);
    upstreamBody = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature
    };
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
    if (provider === 'bytedance') {
      headers['x-api-key'] = apiKey;
    }
    upstreamBody = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature
    };
  }

  const upstreamResp = await fetch(upstreamUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(upstreamBody)
  });
  const rawText = await upstreamResp.text();

  if (!upstreamResp.ok) {
    sendJson(res, 502, {
      error: '上游 LLM 请求失败',
      status: upstreamResp.status,
      details: rawText
    });
    return;
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw: rawText };
  }

  sendJson(res, 200, {
    content: extractLLMContent(provider, data),
    raw: data
  });
}

function parseBaiduBaikeItem(data, query) {
  const card = data && typeof data.card === 'object' ? data.card : {};
  const title = String(
    data?.lemmaTitle ||
    data?.title ||
    card?.key ||
    card?.title ||
    `${query} 参考资料`
  ).trim();

  const rawSnippet = String(
    data?.abstract ||
    data?.desc ||
    data?.summary ||
    card?.abstract ||
    card?.desc ||
    ''
  );
  const snippet = rawSnippet.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    || `关于“${query}”的百度百科参考资料。`;

  const url = String(
    data?.url ||
    card?.url ||
    `https://baike.baidu.com/item/${encodeURIComponent(title)}`
  );

  return {
    title,
    snippet,
    url,
    source: 'BaiduBaike'
  };
}

async function proxyBaiduSearch(res, requestUrl) {
  const query = requestUrl.searchParams.get('query') || '';
  const appid = requestUrl.searchParams.get('appid') || DEFAULT_BAIDU_BAIKE_APP_ID;
  if (!query) {
    sendJson(res, 400, { error: 'query 不能为空' });
    return;
  }

  const upstreamUrl = new URL('https://baike.baidu.com/api/openapi/BaikeLemmaCardApi');
  upstreamUrl.searchParams.set('scope', '103');
  upstreamUrl.searchParams.set('format', 'json');
  upstreamUrl.searchParams.set('appid', appid);
  upstreamUrl.searchParams.set('bk_length', '240');
  upstreamUrl.searchParams.set('bk_key', query);

  const upstreamResp = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const rawText = await upstreamResp.text();

  if (!upstreamResp.ok) {
    sendJson(res, 502, {
      error: '上游检索请求失败',
      status: upstreamResp.status,
      details: rawText
    });
    return;
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    sendJson(res, 502, { error: '检索响应不是合法 JSON', details: rawText });
    return;
  }

  sendJson(res, 200, {
    item: parseBaiduBaikeItem(data, query),
    raw: data
  });
}

async function proxyTextImage(res, body) {
  const provider = String(body.provider || 'bytedance');
  const apiKey = String(body.apiKey || '');
  const apiUrl = String(body.apiUrl || '');
  const model = String(body.model || 'seededit');
  const prompt = String(body.prompt || '');
  const duration = typeof body.duration === 'number' ? body.duration : 5;
  const resolution = typeof body.resolution === 'string' ? body.resolution : '720p';
  const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : [];

  if (!apiKey) {
    sendJson(res, 400, { error: 'apiKey 不能为空' });
    return;
  }
  if (!isHttpUrl(apiUrl)) {
    sendJson(res, 400, { error: 'apiUrl 非法或未配置' });
    return;
  }
  if (!prompt) {
    sendJson(res, 400, { error: 'prompt 不能为空' });
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  };

  const payload = {
    model,
    prompt,
    duration,
    resolution,
    ...(referenceImages.length > 0 ? { reference_images: referenceImages } : {})
  };

  const upstreamResp = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const rawText = await upstreamResp.text();

  if (!upstreamResp.ok) {
    sendJson(res, 502, {
      error: `${provider} 文生图/视频请求失败`,
      status: upstreamResp.status,
      details: rawText
    });
    return;
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw: rawText };
  }

  sendJson(res, 200, {
    data,
    url: data?.video_url || data?.url || data?.data?.video_url || ''
  });
}

async function requestHandler(req, res) {
  try {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const { pathname } = requestUrl;

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, time: Date.now() });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/llm/chat') {
      const body = await readJsonBody(req);
      await proxyLLMChat(res, body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/search/baidu') {
      await proxyBaiduSearch(res, requestUrl);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/text-image/generate') {
      const body = await readJsonBody(req);
      await proxyTextImage(res, body);
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (error) {
    sendJson(res, 500, {
      error: '代理服务内部错误',
      details: getErrorText(error)
    });
  }
}

const server = http.createServer(requestHandler);
server.listen(PORT, HOST, () => {
  console.log(`[proxy] listening on http://${HOST}:${PORT}`);
});

