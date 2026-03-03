import type { LLMConfig, LLMProvider, ScriptGenerationResult, ScriptShotData, ComplianceResult } from '../types';
import { callLLMByBackend } from './backendProxy';

// 默认模型配置
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  bytedance: 'doubao-seed-1-6-251015',  // ByteDance Doubao
  aliyun: 'qwen-turbo',
  baidu: 'ernie-bot-turbo',
  zhipu: 'glm-4-flash',
  openai: 'gpt-3.5-turbo',
  custom: ''
};

// 默认 API 地址
const DEFAULT_API_URLS: Record<LLMProvider, string> = {
  bytedance: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  aliyun: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  baidu: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  custom: ''
};

export class LLMService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      model: config.model || DEFAULT_MODELS[config.provider],
      apiUrl: config.apiUrl || DEFAULT_API_URLS[config.provider]
    };
  }

  static getDefaultModel(provider: LLMProvider): string {
    return DEFAULT_MODELS[provider];
  }

  static getDefaultApiUrl(provider: LLMProvider): string {
    return DEFAULT_API_URLS[provider];
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

  async generatePublishContent(
    script: string, 
    shots: ScriptShotData[], 
    platform: string
  ): Promise<{ platform: string; title: string; content: string; tags: string[] }> {
    const shotsDesc = shots.map(s => s.description).join('\n');
    const prompt = `请为以下视频内容生成适合 ${platform} 平台的发布文案：

剧本内容：
${script}

分镜概览：
${shotsDesc}

请返回 JSON 格式，包含：
1. title: 吸引人的标题（符合 ${platform} 风格）
2. content: 详细的视频介绍/正文
3. tags: 3-5个相关标签

示例格式：
{
  "title": "震撼！...",
  "content": "本视频讲述...",
  "tags": ["剧情", "悬疑"]
}`;

    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/(```json\s*([\s\S]*?)```)/) || 
                       response.match(/({[\s\S]*})/) ||
                       response.match(/(```[\s\S]*?```)/); // catch-all for code blocks without language
      
      let jsonStr = '';
      if (jsonMatch) {
         // If group 2 exists (from json block), use it. Otherwise use group 1 (full match or other block)
         // Actually the regex logic above is a bit mixed. Let's simplify extraction logic similar to existing code but robust.
         // Re-using the logic from parseShotsFromResponse is better.
         
         const match = response.match(/```json\s*([\s\S]*?)```/);
         if (match) {
             jsonStr = match[1];
         } else {
             const simpleMatch = response.match(/{[\s\S]*}/);
             if (simpleMatch) {
                 jsonStr = simpleMatch[0];
             } else {
                 jsonStr = response;
             }
         }
      } else {
          jsonStr = response;
      }
      
      // Clean up jsonStr
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
      
      const data = JSON.parse(jsonStr);
      
      return {
        platform,
        title: data.title || '无标题',
        content: data.content || data.description || '无内容',
        tags: Array.isArray(data.tags) ? data.tags : []
      };
    } catch (e) {
      console.warn('JSON解析失败，尝试正则提取', e);
      // Fallback regex extraction
      const titleMatch = response.match(/标题[:：]\s*(.+)/);
      const contentMatch = response.match(/(?:内容|正文|描述)[:：]\s*(.+)/);
      const tagsMatch = response.match(/标签[:：]\s*(.+)/);
      
      return {
        platform,
        title: titleMatch ? titleMatch[1].trim() : '自动生成标题',
        content: contentMatch ? contentMatch[1].trim() : response.substring(0, 100),
        tags: tagsMatch ? tagsMatch[1].split(/[,，、\s]+/).filter(t => t.trim()) : []
      };
    }
  }

  async checkCompliance(
    title: string, 
    content: string, 
    tags: string[]
  ): Promise<ComplianceResult> {
    const prompt = `请审核以下视频发布内容是否符合通用的内容安全规范（无暴力、色情、政治敏感、虚假宣传等）：

标题：${title}
内容：${content}
标签：${tags.join(', ')}

如果不符合，请说明原因并提供修改建议。
返回 JSON：
{
  "passed": true/false,
  "reason": "违规原因（如果违规）",
  "suggestions": ["修改建议1", "修改建议2"]
}`;

    const response = await this.callLLM(prompt);

    try {
      let jsonStr = '';
      const match = response.match(/```json\s*([\s\S]*?)```/);
      if (match) {
          jsonStr = match[1];
      } else {
          const simpleMatch = response.match(/{[\s\S]*}/);
          if (simpleMatch) {
              jsonStr = simpleMatch[0];
          } else {
              jsonStr = response;
          }
      }
      
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();

      const data = JSON.parse(jsonStr);
      
      return {
        passed: !!data.passed,
        reason: data.reason || undefined,
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : []
      };
    } catch (e) {
      console.warn('JSON解析失败，进行关键词检测', e);
      // Fallback: simple keyword check
      const isCompliant = !/不合规|违规|敏感|禁止|色情|暴力/.test(response);
      return {
        passed: isCompliant,
        reason: isCompliant ? undefined : '内容可能包含违规信息，请人工复核',
        suggestions: isCompliant ? [] : ['请检查是否包含敏感词汇', '请确保内容真实健康']
      };
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    const { provider, apiKey, apiUrl, model } = this.config;

    if (!apiKey) {
      throw new Error('API Key 未配置');
    }
    return callLLMByBackend({
      provider,
      apiKey,
      apiUrl,
      model: model || DEFAULT_MODELS[provider],
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: provider === 'openai'
        ? 'You are a professional storyboard artist.'
        : '你是一个专业的分镜师，擅长将剧本切分成视频分镜。请严格按照要求的 JSON 格式输出。'
    });
  }

  private parseShotsFromResponse(response: string): ScriptGenerationResult {
    try {
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

  async generateFromScript(script: string, onProgress?: (msg: string) => void): Promise<ScriptGenerationResult> {
    onProgress?.('正在分析剧本...');
    const analysis = await this.analyzeScript(script);
    
    onProgress?.('正在生成分镜...');
    const result = await this.generateShots(analysis, script);
    
    onProgress?.(`生成完成！共 ${result.shots.length} 个分镜`);
    return result;
  }
}

export async function mockGenerateFromScript(script: string): Promise<ScriptGenerationResult> {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const sentences = script.split(/[。！？.!?]/).filter(s => s.trim().length > 5);
  const shots = sentences.slice(0, Math.min(sentences.length, 8)).map((sentence) => {
    const nameMatches = sentence.match(/[@](\w{2,4})|[\s\n，。]([\u4e00-\u9fa5]{2,4})(?=[\s\n，。])/g) || [];
    const assetRefs = nameMatches
      .map(n => n.replace(/[@\s\n，。]/g, ''))
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .slice(0, 3);
    
    return {
      description: sentence.trim() + '，镜头平稳推进。',
      duration: 5 + Math.floor(Math.random() * 6),
      assetRefs
    };
  });

  return {
    shots: shots.length > 0 ? shots : [
      { description: '场景开场，展示主要环境', duration: 5, assetRefs: [] },
      { description: '主角登场，表情自然', duration: 5, assetRefs: [] },
      { description: '剧情发展，动作流畅', duration: 5, assetRefs: [] }
    ],
    summary: `从剧本生成了 ${shots.length} 个分镜（模拟模式）`
  };
}
