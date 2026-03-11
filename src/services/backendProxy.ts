import type { LLMProvider, WebSearchItem } from '../types';

interface LLMChatRequest {
  provider: LLMProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface TextImageRequest {
  provider: string;
  apiKey: string;
  apiUrl: string;
  model: string;
  prompt: string;
  duration?: number;
  resolution?: string;
  referenceImages?: string[];
}

function getErrorDetails(data: unknown): string {
  if (!data || typeof data !== 'object' || data === null) {
    return '';
  }
  const record = data as Record<string, unknown>;
  const detail = record.details ?? record.error;
  return typeof detail === 'string' ? detail.trim() : '';
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function callLLMByBackend(request: LLMChatRequest): Promise<string> {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    const detail = getErrorDetails(data);
    throw new Error(detail || `LLM 代理请求失败: HTTP ${response.status}`);
  }

  const content = data && typeof data === 'object'
    ? (data as Record<string, unknown>).content
    : '';
  return String(content || '').trim();
}

export async function searchBaiduByBackend(query: string): Promise<WebSearchItem> {
  const response = await fetch('/api/search/baidu?query=' + encodeURIComponent(query), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    const detail = getErrorDetails(data);
    throw new Error(detail || `检索代理请求失败: HTTP ${response.status}`);
  }

  const item = data && typeof data === 'object'
    ? (data as Record<string, unknown>).item
    : null;
  const safeItem = item && typeof item === 'object' ? item as Record<string, unknown> : {};

  return {
    title: String(safeItem.title || `${query} 参考资料`),
    snippet: String(safeItem.snippet || `关于“${query}”的参考资料。`),
    url: String(safeItem.url || '#'),
    source: String(safeItem.source || 'BaiduBaike')
  };
}

export async function generateTextImageByBackend(request: TextImageRequest): Promise<Record<string, unknown>> {
  const response = await fetch('/api/text-image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    const detail = getErrorDetails(data);
    throw new Error(detail || `文生图/视频代理请求失败: HTTP ${response.status}`);
  }

  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return {};
}

