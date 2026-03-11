import type {
  ApiConfig,
  Asset,
  LLMConfig,
  RichTextPreprocessResult,
  ScriptGenerationResult,
  StyleConfig,
  ToneConfig
} from '../types';
import { fallbackParseShots, parseShotsFromLLMResponse } from '../utils/llmParser';
import { toneConfigToPromptSegment } from '../utils/slateSerializer';
import { callLLMByBackend, generateTextImageByBackend } from './backendProxy';
import { preprocessRichTextWithMultiRound, type RichTextPreprocessCallOptions } from './richTextPreprocessService';

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
  config: ApiConfig,
  styleConfig?: StyleConfig
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
  
  // 注入全局风格配置
  if (styleConfig?.enabled && styleConfig.styleDescription) {
    fullPrompt += `\n\n画面风格要求: ${styleConfig.styleDescription}`;
    if (styleConfig.colorPalette) fullPrompt += `\n色调: ${styleConfig.colorPalette}`;
    if (styleConfig.lighting) fullPrompt += `\n光影: ${styleConfig.lighting}`;
    if (styleConfig.mood) fullPrompt += `\n氛围: ${styleConfig.mood}`;
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
  
  // 安全获取嵌套数据
  const nestedData = (proxyResponse.data as Record<string, unknown> | undefined) ?? {};
  const deeperData = (nestedData.data as Record<string, unknown> | undefined) ?? {};
  
  // 按优先级获取视频 URL
  const videoUrl = String(
    proxyResponse.url || 
    nestedData.video_url || 
    nestedData.url || 
    deeperData.video_url || 
    ''
  );
  
  return {
    url: videoUrl,
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

  async generateFromRichText(
    markdown: string,
    toneConfig: ToneConfig,
    onProgress?: (msg: string) => void
  ): Promise<ScriptGenerationResult> {
    const toneSegment = toneConfigToPromptSegment(toneConfig);

    onProgress?.('正在分析富文本内容...');
    const analysisPrompt = `请仔细阅读以下富文本内容，理解其结构、重点和情节：

格式说明：
- **加粗文字** 代表用户标注的重点画面要素
- *斜体文字* 代表旁白或内心独白
- 标题层级表示场景分割
- [颜色:xxx]标记表示情绪/氛围提示
- [高亮:xxx]标记表示关键段落

内容：
${markdown}

请简要总结：
1. 这个内容的主要信息是什么？
2. 有哪些关键角色/元素？
3. 用户标注的重点内容有哪些？
4. 内容可分为哪几个关键场景？

请用简短的语言回答。`;

    const analysis = await this.callLLM(analysisPrompt);

    onProgress?.('正在根据调性生成分镜...');
    const generatePrompt = `基于以下富文本分析，请将内容切分成多个分镜。

内容分析：
${analysis}

原始富文本：
${markdown}

${toneSegment}

请将内容切分成 3-10 个分镜，每个分镜包含：
1. description: 分镜描述（简洁明了，适合视频生成，必须体现上述调性风格特征）
2. duration: 预估时长（秒），3-15秒之间
3. assetRefs: 引用的角色/资产名称列表（使用@名称格式）

要求：
- 描述应具体，包含场景、动作、镜头语言
- 特别注意用户加粗标注的重点内容，确保在分镜中突出展现
- 如有角色名，请用 @角色名 格式引用
- 输出必须是有效的 JSON 格式

请按以下 JSON 格式返回：
{
  "shots": [
    {
      "description": "分镜描述...",
      "duration": 5,
      "assetRefs": []
    }
  ],
  "summary": "内容概要"
}`;

    const response = await this.callLLM(generatePrompt);
    const result = this.parseShotsFromResponse(response);

    onProgress?.(`生成完成！共 ${result.shots.length} 个分镜`);
    return result;
  }

  async preprocessRichTextForStoryboard(
    markdown: string,
    onProgress?: (msg: string) => void
  ): Promise<RichTextPreprocessResult> {
    return preprocessRichTextWithMultiRound(
      markdown,
      (prompt, options) => this.callLLM(prompt, options),
      onProgress
    );
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

  private async callLLM(prompt: string, options?: RichTextPreprocessCallOptions): Promise<string> {
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
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2000,
      systemPrompt: options?.systemPrompt || '你是一个专业的分镜师，擅长将剧本切分成视频分镜。请严格按照要求的 JSON 格式输出。'
    });
  }

  private parseShotsFromResponse(response: string): ScriptGenerationResult {
    const result = parseShotsFromLLMResponse(response);
    
    if (result) {
      return result;
    }
    
    console.error('解析分镜数据失败，使用备用解析');
    return fallbackParseShots(response);
  }

}

/**
 * 检查是否配置了 ByteDance API
 */
export function hasByteDanceConfig(config: ApiConfig | LLMConfig): boolean {
  return !!config.apiKey && config.apiKey.length > 0;
}
