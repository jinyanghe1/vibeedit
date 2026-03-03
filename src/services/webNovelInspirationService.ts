import type { LLMConfig, LLMProvider, WebNovelInspirationResult, WebSearchItem } from '../types';
import { callLLMByBackend, searchBaiduByBackend } from './backendProxy';

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  bytedance: 'doubao-seed-1-6-251015',  // 更新为文档推荐的模型
  aliyun: 'qwen-turbo',
  baidu: 'ernie-bot-turbo',
  zhipu: 'glm-4-flash',
  openai: 'gpt-3.5-turbo',
  custom: ''
};

const DEFAULT_API_URLS: Record<LLMProvider, string> = {
  bytedance: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',  // 更新为北京节点
  aliyun: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  baidu: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  custom: ''
};

export const COMPLIANCE_NOTICE = `
⚠️ 重要声明：本内容仅用于创作启发，不可直接发布或用于洗稿。
使用须知：
1. 请确保最终内容为您原创，不得直接复制或近似改写现有作品
2. 禁止使用本工具生成违反法律法规、公序良俗的内容
3. 如用于商业发布，请自行承担内容合规责任
请遵守相关法律法规，尊重知识产权。
`.trim();

export const PRESET_KEYWORDS = [
  '重生', '穿越', '修仙', '玄幻', '都市', '言情',
  '悬疑', '科幻', '历史', '武侠', '奇幻', '职场',
  '甜宠', '虐恋', '复仇', '逆袭', '系统', '金手指',
  '豪门', '校园', '医疗', '军事', '游戏', '体育'
];

export class WebNovelInspirationService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      model: config.model || DEFAULT_MODELS[config.provider] || '',
      apiUrl: config.apiUrl || DEFAULT_API_URLS[config.provider] || ''
    };
  }

  private async callLLM(prompt: string, temperature = 0.8): Promise<string> {
    const { provider, apiKey, apiUrl, model } = this.config;

    if (!apiKey) {
      throw new Error('API Key 未配置');
    }

    return callLLMByBackend({
      provider,
      apiKey,
      apiUrl,
      model: model || DEFAULT_MODELS[provider] || 'gpt-3.5-turbo',
      prompt,
      temperature,
      maxTokens: 2000,
      systemPrompt: '你是一位资深网文编辑，擅长创作各类网络小说。'
    });
  }

  private async generateEnhancedQueries(keywords: string[], direction?: string): Promise<string[]> {
    const prompt = '基于以下网文关键词，生成3-5条用于互联网检索的增强查询词。\n\n关键词：' + keywords.join('、') + '\n' + (direction ? '题材方向：' + direction + '\n' : '') + '\n要求：\n1. 查询词应具体、可检索，包含热门元素\n2. 每条查询词10-20字\n3. 覆盖不同的检索角度（设定、情节、人设等）\n\n请直接返回查询词列表，每行一条，不要编号。';

    console.log('Calling LLM for enhanced queries...');
    const response = await this.callLLM(prompt, 0.7);
    const queries = response.split('\n')
      .map(q => q.trim().replace(/^\d+[.．]\s*/, ''))
      .filter(q => q.length > 0 && q.length < 50)
      .slice(0, 5);
    
    return queries.length > 0 ? queries : keywords.map(k => k + ' 小说 热门');
  }

  private async searchInternet(queries: string[]): Promise<WebSearchItem[]> {
    const results: WebSearchItem[] = [];
    const seenTitles = new Set<string>();

    for (const query of queries.slice(0, 3)) {
      try {
        const item = await searchBaiduByBackend(query);

        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          results.push(item);
        }
      } catch (e) {
        console.warn('Baidu 检索失败:', e);
      }
    }

    if (results.length === 0) {
      return queries.slice(0, 3).map(q => ({
        title: q + ' - 网文创作参考',
        snippet: '关于"' + q + '"的网文创作参考资料。建议结合当前流行元素进行创作。',
        url: '#',
        source: 'Reference'
      }));
    }

    return results.slice(0, 5);
  }

  private async generateOutline(keywords: string[], searchResults: WebSearchItem[], direction?: string): Promise<string> {
    const searchContext = searchResults.map(r => r.title + ': ' + r.snippet).join('\n');
    
    const prompt = '基于以下信息，创作一个网文故事梗概（150-220字）。\n\n关键词：' + keywords.join('、') + '\n' + (direction ? '题材方向：' + direction + '\n' : '') + '\n参考素材（仅用于灵感，严禁复制）：\n' + searchContext.substring(0, 800) + '\n\n要求：\n1. 包含主角人设、核心冲突、故事背景\n2. 突出爽点设计（如逆袭、金手指、情感张力）\n3. 语言简洁有吸引力，适合作为小说简介\n4. 严禁直接复制参考素材，需进行创意转化\n5. 必须是原创构思，不要与参考素材雷同\n\n请直接返回梗概内容。';

    console.log('Calling LLM for outline generation...');
    const response = await this.callLLM(prompt, 0.8);
    const outline = response.trim().substring(0, 300);
    console.log('Outline received from LLM:', outline.substring(0, 50) + '...');
    return outline;
  }

  private async generatePlotExcerpt(outline: string, keywords: string[], direction?: string): Promise<string> {
    const prompt = '基于以下故事梗概，创作一个关键情节片段（220-320字）。\n\n故事梗概：\n' + outline + '\n\n关键词：' + keywords.join('、') + '\n' + (direction ? '题材方向：' + direction + '\n' : '') + '\n要求：\n1. 选取故事中最具张力的场景（如转折、冲突、高潮前夜）\n2. 包含具体动作、对话、心理描写\n3. 体现至少一个反转设计\n4. 场景完整，有起承转合\n5. 必须显式标注【反转1】和【爽点1】的位置\n\n请直接返回情节片段。';

    console.log('Calling LLM for plot excerpt generation...');
    const response = await this.callLLM(prompt, 0.85);
    const excerpt = response.trim().substring(0, 450);
    console.log('Plot excerpt received from LLM:', excerpt.substring(0, 50) + '...');
    return excerpt;
  }

  private async expandToFullContent(outline: string, plotExcerpt: string, keywords: string[], direction?: string): Promise<string> {
    const prompt = '基于以下素材，扩写一篇约1000字（900-1100字）的网文正文。\n\n故事梗概：\n' + outline + '\n\n关键情节片段：\n' + plotExcerpt + '\n\n关键词：' + keywords.join('、') + '\n' + (direction ? '题材方向：' + direction + '\n' : '') + '\n扩写要求：\n1. 字数严格控制在900-1100字之间\n2. 必须包含至少2个反转节点（显式标记为【反转1】、【反转2】）\n3. 必须包含至少2处爽点表达（显式标记为【爽点1】、【爽点2】）\n4. 保持网文风格：节奏快、冲突强、代入感强\n5. 以第一幕或关键场景为主，不需要完整故事\n6. 语言生动，避免平铺直叙\n7. 主角要有明确的目标和动机\n8. 反派要有足够的威胁感\n\n请直接返回扩写后的正文内容。';

    console.log('Calling LLM for full content expansion...');
    const response = await this.callLLM(prompt, 0.9);
    const content = response.trim();
    console.log('Full content received from LLM, length:', content.length);
    
    if (content.length < 800) {
      return content + '\n\n（内容已生成，字数略少，建议补充细节以达到1000字要求）';
    }
    if (content.length > 1500) {
      return content.substring(0, 1200) + '\n\n（内容已截断，原字数过多）';
    }
    
    return content;
  }

  async generate(keywords: string[], direction?: string, onProgress?: (msg: string) => void): Promise<WebNovelInspirationResult> {
    console.log('WebNovelInspirationService.generate called with config:', { 
      provider: this.config.provider, 
      hasApiKey: !!this.config.apiKey,
      model: this.config.model 
    });
    
    try {
      onProgress?.('正在生成检索词...');
      console.log('Step 1: Generating enhanced queries...');
      const enhancedQueries = await this.generateEnhancedQueries(keywords, direction);
      console.log('Enhanced queries:', enhancedQueries);
      
      onProgress?.('正在检索参考资料...');
      console.log('Step 2: Searching internet...');
      const searchResults = await this.searchInternet(enhancedQueries);
      console.log('Search results count:', searchResults.length);
      
      onProgress?.('正在创作故事梗概...');
      console.log('Step 3: Generating outline via LLM...');
      const outline = await this.generateOutline(keywords, searchResults, direction);
      console.log('Outline generated:', outline.substring(0, 100) + '...');
      
      onProgress?.('正在生成情节片段...');
      console.log('Step 4: Generating plot excerpt via LLM...');
      const plotExcerpt = await this.generatePlotExcerpt(outline, keywords, direction);
      console.log('Plot excerpt generated:', plotExcerpt.substring(0, 100) + '...');
      
      onProgress?.('正在扩写正文（约1000字）...');
      console.log('Step 5: Expanding to full content via LLM...');
      const expandedContent = await this.expandToFullContent(outline, plotExcerpt, keywords, direction);
      console.log('Expanded content length:', expandedContent.length);
      console.log('Expanded content preview:', expandedContent.substring(0, 150) + '...');
      
      return {
        keywords,
        enhancedQueries,
        searchResults,
        outline,
        plotExcerpt,
        expandedContent,
        complianceNotice: COMPLIANCE_NOTICE
      };
    } catch (error) {
      console.error('网文灵感生成失败，降级到模拟模式:', error);
      onProgress?.('API调用失败，使用模拟模式...');
      return mockGenerateWebNovelInspiration(keywords, direction, onProgress);
    }
  }
}

export async function mockGenerateWebNovelInspiration(
  keywords: string[], direction?: string, onProgress?: (msg: string) => void
): Promise<WebNovelInspirationResult> {
  onProgress?.('正在生成检索词...'); await new Promise(r => setTimeout(r, 500));
  onProgress?.('正在检索参考资料...'); await new Promise(r => setTimeout(r, 800));
  onProgress?.('正在创作故事梗概...'); await new Promise(r => setTimeout(r, 600));
  onProgress?.('正在生成情节片段...'); await new Promise(r => setTimeout(r, 700));
  onProgress?.('正在扩写正文...'); await new Promise(r => setTimeout(r, 1000));

  return {
    keywords,
    enhancedQueries: [
      keywords.join('、') + ' 小说设定',
      (direction || '都市') + ' 网文热门梗',
      '主角逆袭套路',
      (keywords[0] || '重生') + ' 爽点设计'
    ],
    searchResults: [
      {
        title: keywords.join('、') + '创作指南',
        snippet: '关于' + keywords.join('、') + '题材的创作要点与热门元素分析。此内容为模拟数据。',
        url: '#',
        source: 'Mock'
      }
    ],
    outline: '【' + (direction || '都市') + '·' + keywords.join('、') + '】平凡的' + (direction || '都市') + '青年意外获得神秘系统，从此开启逆袭之路。面对重重阻碍与强大敌人，他凭借智慧与金手指，一步步走向巅峰，收获爱情与尊重。',
    plotExcerpt: '【反转1】系统觉醒的那一刻，林凡气息暴涨，从炼体境直接跨越到筑基境！众人目瞪口呆，尤其是刚才还嘲讽他的赵天，脸色瞬间惨白。\n\n【爽点1】林凡一步踏出，气势如虹，一掌便将赵天拍飞数十米！全场寂静，无人敢出声。\n\n【反转2】就在这时，宗门圣女苏清雅现身，然而她接下来的话却让所有人震惊——"林凡，我愿意嫁给你。"\n\n【爽点2】全场哗然！圣女下嫁废柴？这简直是天方夜谭！',
    expandedContent: '系统觉醒的那一刻，林凡感觉整个世界都变了。\n\n原本嘲笑他的同门弟子，此刻脸上写满了难以置信。赵天捂着胸口，嘴角溢血，眼中的轻蔑早已消失，取而代之的是恐惧与不甘。\n\n"这...这不可能！"赵天颤抖着声音，"你明明是个废物，怎么可能..."\n\n【反转1】\n\n林凡没有回答，只是平静地看着自己的双手。系统面板上，一行行数据清晰显示着他的蜕变。三年隐忍，今日一鸣惊人！\n\n"从今日起，我林凡，不再是你们可以随意践踏的蝼蚁。"他的声音不大，却清晰地传入每个人耳中。\n\n【爽点1】\n\n一掌之威，震慑全场！那些曾经欺辱过他的人，此刻无不瑟瑟发抖。\n\n人群中，苏清雅的美眸微微闪动。她看着那个曾经被她忽视的背影，心中泛起涟漪。\n\n【反转2】\n\n"叮！检测到特殊剧情触发，隐藏任务激活..."系统的提示音在脑海中响起。\n\n【爽点2】\n\n而此刻的林凡，还不知道他的命运即将发生怎样翻天覆地的变化。一场更大的风暴，正在悄然酝酿...\n\n（正文总计约1000字，包含2处反转节点和2处爽点标记）',
    complianceNotice: COMPLIANCE_NOTICE
  };
}
