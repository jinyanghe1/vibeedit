import type { ApiConfig, LLMConfig, ScriptGenerationResult } from '../types';
import type { Asset } from '../types';
import { callLLMByBackend, generateTextImageByBackend } from './backendProxy';

// ByteDance 默认配置
const BYTEDANCE_DEFAULTS = {
  // 视频生成 API (SeedEdit/Video Generation)
  videoApiUrl: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations',
  // 文本生成 API (Doubao/DeepSeek)
  textApiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  // 默认模型
  videoModel: 'seededit',  // 或其他视频生成模型
  textModel: 'doubao-seed-1-6-251015',  // Doubao 模型
};

/**
 * ByteDance 视频生成服务
 */
export async function generateVideoWithByteDance(
  description: string,
  assetRefs: string[],
  assets: Record<string, Asset>,
  config: ApiConfig
): Promise<{ url: string; prompt: string }> {
  const apiKey = config.apiKey;
  const apiUrl = config.apiUrl || BYTEDANCE_DEFAULTS.videoApiUrl;

  if (!apiKey) {
    throw new Error('ByteDance API Key 未配置');
  }

  // 构建完整 prompt
  let fullPrompt = description;
  const assetImages: string[] = [];
  
  assetRefs.forEach(ref => {
    if (assets[ref]) {
      assetImages.push(assets[ref].url);
    }
  });
  
  if (assetImages.length > 0) {
    fullPrompt = `${description}\n\n参考图像: ${assetImages.join(', ')}`;
  }

  // 调用 ByteDance 视频生成 API
  const proxyResponse = await generateTextImageByBackend({
    provider: config.provider,
    apiKey,
    apiUrl,
    model: BYTEDANCE_DEFAULTS.videoModel,
    prompt: fullPrompt,
    duration: 5,
    resolution: '720p',
    referenceImages: assetImages
  });
  const nestedData = proxyResponse.data && typeof proxyResponse.data === 'object'
    ? proxyResponse.data as Record<string, unknown>
    : {};
  const urlFromProxy = String(proxyResponse.url || '');
  
  // 解析响应
  // 注意：实际字段名需要根据 ByteDance API 文档调整
  return {
    url: urlFromProxy ||
      String(nestedData.video_url || nestedData.url || (nestedData.data as Record<string, unknown> | undefined)?.video_url || ''),
    prompt: fullPrompt
  };
}

/**
 * ByteDance LLM 服务（剧本生成）
 */
export class ByteDanceLLMService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || BYTEDANCE_DEFAULTS.textApiUrl,
      model: config.model || BYTEDANCE_DEFAULTS.textModel,
    };
  }

  /**
   * 从剧本生成分镜
   */
  async generateFromScript(
    script: string, 
    onProgress?: (msg: string) => void
  ): Promise<ScriptGenerationResult> {
    // 第一轮：分析剧本
    onProgress?.('正在分析剧本...');
    const analysis = await this.analyzeScript(script);
    
    // 第二轮：生成分镜
    onProgress?.('正在生成分镜...');
    const result = await this.generateShots(analysis, script);
    
    onProgress?.(`生成完成！共 ${result.shots.length} 个分镜`);
    return result;
  }

  private async analyzeScript(script: string): Promise<string> {
    const prompt = `请仔细阅读以下剧本内容，理解剧情、场景和角色：

${script}

请简要总结：
1. 这个故事的主要情节是什么？
2. 有哪些主要角色？
3. 故事分为哪几个关键场景？

请用简短的语言回答。`;

    return this.callLLM(prompt);
  }

  private async generateShots(analysis: string, script: string): Promise<ScriptGenerationResult> {
    const prompt = `基于以下剧本分析，请将剧本切分成多个分镜。

剧本分析：
${analysis}

完整剧本：
${script}

请将剧本切分成 3-10 个分镜，每个分镜包含：
1. description: 分镜描述（简洁明了，适合视频生成）
2. duration: 预估时长（秒），3-15秒之间
3. assetRefs: 引用的角色/资产名称列表（使用@名称格式）

要求：
- 描述应该具体，包含场景、动作、镜头语言
- 如果剧本中有角色名，请用 @角色名 格式引用
- 输出必须是有效的 JSON 格式

请按以下 JSON 格式返回：
{
  "shots": [
    {
      "description": "@小红走在街上，看到一只猫跑过来",
      "duration": 5,
      "assetRefs": ["小红"]
    }
  ],
  "summary": "剧本概要"
}`;

    const response = await this.callLLM(prompt);
    return this.parseShotsFromResponse(response);
  }

  private async callLLM(prompt: string): Promise<string> {
    const { apiKey, apiUrl, model } = this.config;

    if (!apiKey) {
      throw new Error('ByteDance API Key 未配置');
    }

    return callLLMByBackend({
      provider: 'bytedance',
      apiKey,
      apiUrl,
      model: model || BYTEDANCE_DEFAULTS.textModel,
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: '你是一个专业的分镜师，擅长将剧本切分成视频分镜。请严格按照要求的 JSON 格式输出。'
    });
  }

  private parseShotsFromResponse(response: string): ScriptGenerationResult {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) ||
                       response.match(/```\s*([\s\S]*?)```/) ||
                       response.match(/{[\s\S]*}/);
      
      let jsonStr = '';
      if (jsonMatch) {
        jsonStr = jsonMatch[1] || jsonMatch[0];
      } else {
        jsonStr = response;
      }

      jsonStr = jsonStr.trim();
      const data = JSON.parse(jsonStr);
      
      if (!data.shots || !Array.isArray(data.shots)) {
        throw new Error('返回数据格式错误：缺少 shots 数组');
      }

      const validShots = data.shots.map((shot: any, index: number) => ({
        description: String(shot.description || `分镜 ${index + 1}`),
        duration: Math.min(Math.max(Number(shot.duration) || 5, 1), 30),
        assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs : []
      }));

      return {
        shots: validShots,
        summary: data.summary || `成功生成 ${validShots.length} 个分镜`
      };
    } catch (error) {
      console.error('解析分镜数据失败:', error);
      return this.fallbackParse(response);
    }
  }

  private fallbackParse(response: string): ScriptGenerationResult {
    const shots: any[] = [];
    const lines = response.split('\n');
    let currentShot: any = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]/i.test(trimmed)) {
        if (currentShot) {
          shots.push(currentShot);
        }
        currentShot = {
          description: trimmed.replace(/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]\s*/i, ''),
          duration: 5,
          assetRefs: []
        };
      } else if (currentShot && trimmed) {
        if (!currentShot.description.includes(trimmed)) {
          currentShot.description += ' ' + trimmed;
        }
      }
    }
    
    if (currentShot) {
      shots.push(currentShot);
    }

    if (shots.length === 0) {
      shots.push({
        description: '剧本场景：' + response.substring(0, 100) + '...',
        duration: 5,
        assetRefs: []
      });
    }

    return {
      shots,
      summary: `解析到 ${shots.length} 个分镜（备用解析）`
    };
  }
}

/**
 * 检查是否配置了 ByteDance API
 */
export function hasByteDanceConfig(config: ApiConfig | LLMConfig): boolean {
  return !!config.apiKey && config.apiKey.length > 0;
}
