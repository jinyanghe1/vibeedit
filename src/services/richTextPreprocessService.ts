import type { RichTextPreprocessResult } from '../types';
import { extractJsonFromResponse, safeJsonParse } from '../utils/llmParser';
import { callLLMByBackend } from './backendProxy';

export interface RichTextPreprocessCallOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface RichTextPreprocessOptions {
  enableMultiRound?: boolean;
  targetShots?: number;
  preserveFormatting?: boolean;
}

interface RichTextLLMConfig {
  provider: 'bytedance' | 'aliyun' | 'baidu' | 'zhipu' | 'openai' | 'custom';
  apiKey: string;
  apiUrl: string;
  model: string;
}

type RichTextLLMCaller = (prompt: string, options?: RichTextPreprocessCallOptions) => Promise<string>;

interface Round1Skeleton {
  genre?: string;
  audience?: string;
  coreFacts?: Array<{ id?: string; fact?: string }>;
  structurePlan?: Array<{ section?: string; goal?: string; facts?: string[] }>;
  mustKeep?: string[];
}

interface Round2Rewrite {
  rewrittenText?: string;
  summary?: string;
  coverageChecklist?: Array<{ factId?: string; kept?: boolean; evidence?: string }>;
}

interface Round3Calibration {
  finalText?: string;
  summary?: string;
  adjustments?: string[];
}

const CLEANUP_SPACES = /\s{3,}/g;
const INFORMATION_SPLIT = /[\n。！？!?；;：:]/;

function normalizeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const hasHtmlRoot = /<\s*(html|body|head)\b/i.test(trimmed);
  if (!hasHtmlRoot) {
    return trimmed.replace(CLEANUP_SPACES, '\n\n');
  }

  return trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function countInformationUnits(text: string): number {
  return text
    .split(INFORMATION_SPLIT)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8).length;
}

function parseJson<T>(response: string): T | null {
  const jsonStr = extractJsonFromResponse(response);
  if (!jsonStr) return null;
  return safeJsonParse<T>(jsonStr);
}

export async function preprocessRichTextWithMultiRound(
  markdown: string,
  callLLM: RichTextLLMCaller,
  onProgress?: (msg: string) => void
): Promise<RichTextPreprocessResult> {
  const normalizedInput = normalizeInput(markdown);
  if (!normalizedInput) {
    return {
      preprocessedText: '',
      summary: '输入为空，已跳过预处理。',
      metadata: {
        originalLength: 0,
        processedLength: 0,
        lengthRatio: 1,
        detectedGenre: 'empty',
        rounds: 0,
        infoChecklistCount: 0
      }
    };
  }

  onProgress?.('预处理 1/3：抽取信息骨架...');
  const round1Prompt = `你是“新闻编辑 + 分镜编导”双角色助手。请识别文体并提取信息骨架，不要改写正文。

原文：
${normalizedInput}

要求：
1) 给出文体 genre（news / analysis / report / educational / mixed / other）。
2) 提取核心信息点 coreFacts（不少于 8 条，按 F1/F2... 编号）。
3) 给出结构重排建议 structurePlan（按段落或场景组织，每段对应要保留的信息点）。
4) 给出必须保留表述 mustKeep（专有名词、关键数字、政策名、机构名等）。

只返回 JSON：
{
  "genre": "mixed",
  "audience": "短视频观众",
  "coreFacts": [{"id":"F1","fact":"..."}],
  "structurePlan": [{"section":"开场背景","goal":"建立问题语境","facts":["F1","F2"]}],
  "mustKeep": ["..."]
}`;

  const round1Raw = await callLLM(round1Prompt, {
    temperature: 0.2,
    maxTokens: 2800,
    systemPrompt: '你是严谨的事实编辑，擅长信息抽取与结构化。'
  });
  const round1 = parseJson<Round1Skeleton>(round1Raw);

  const facts = (round1?.coreFacts || [])
    .map((item, index) => ({
      id: item.id || `F${index + 1}`,
      fact: (item.fact || '').trim()
    }))
    .filter((item) => item.fact.length > 0);

  onProgress?.('预处理 2/3：重写为可分镜稿件...');
  const round2Prompt = `你将把“知识型文本”改写为“可分镜拆解稿”，必须尽量保持信息密度和篇幅。

原文：
${normalizedInput}

信息骨架(JSON)：
${JSON.stringify(round1 || {}, null, 2)}

改写约束：
1) 事实不删减，不新增未经原文支持的信息。
2) 篇幅接近原文，字符数控制在原文的 0.85x ~ 1.15x。
3) 保留原文关键名词、数字、机构和政策名。
4) 语体改为“可拍摄叙述”，每段都应具备可视化动作/场景线索。
5) 不写镜头编号，不输出 JSON 片段到正文，不写“作为AI”。

只返回 JSON：
{
  "rewrittenText": "改写后的完整稿件",
  "summary": "改写策略简述",
  "coverageChecklist": [{"factId":"F1","kept":true,"evidence":"在第2段体现"}]
}`;

  const round2Raw = await callLLM(round2Prompt, {
    temperature: 0.45,
    maxTokens: 3200,
    systemPrompt: '你是资深采编，擅长将知识型文本改写为可视化叙事稿。'
  });
  const round2 = parseJson<Round2Rewrite>(round2Raw);
  const rewrittenText = (round2?.rewrittenText || '').trim() || normalizedInput;

  const targetMin = Math.max(80, Math.floor(normalizedInput.length * 0.9));
  const targetMax = Math.max(targetMin + 20, Math.ceil(normalizedInput.length * 1.1));

  onProgress?.('预处理 3/3：长度与密度校准...');
  const round3Prompt = `请对以下改写稿进行“长度 + 信息密度”校准，确保和原文接近。

原文长度：${normalizedInput.length}
原文信息单元估算：${countInformationUnits(normalizedInput)}
目标长度区间：${targetMin} - ${targetMax}

原文：
${normalizedInput}

改写稿：
${rewrittenText}

请执行：
1) 若改写稿长度偏离目标区间，做最小改动校准。
2) 检查核心信息是否齐全，缺失则补回。
3) 输出最终可分镜稿件。

只返回 JSON：
{
  "finalText": "校准后的最终稿件",
  "summary": "校准说明",
  "adjustments": ["长度微调", "补回F4信息"]
}`;

  const round3Raw = await callLLM(round3Prompt, {
    temperature: 0.3,
    maxTokens: 3200,
    systemPrompt: '你是严格的内容质控编辑，负责信息完整性和长度一致性校准。'
  });
  const round3 = parseJson<Round3Calibration>(round3Raw);
  const finalText = (round3?.finalText || '').trim() || rewrittenText;

  const processedLength = finalText.length;
  const lengthRatio = normalizedInput.length > 0 ? processedLength / normalizedInput.length : 1;
  const checklistCount = round2?.coverageChecklist?.length || facts.length;
  const detectedGenre = round1?.genre || 'mixed';

  const summarySegments = [
    round2?.summary?.trim(),
    round3?.summary?.trim(),
    lengthRatio < 0.85 || lengthRatio > 1.15
      ? `长度偏差较大（比例 ${lengthRatio.toFixed(2)}），建议人工复核。`
      : `长度比例 ${lengthRatio.toFixed(2)}，信息密度保持在可接受范围。`
  ].filter(Boolean);

  return {
    preprocessedText: finalText,
    summary: summarySegments.join(' '),
    metadata: {
      originalLength: normalizedInput.length,
      processedLength,
      lengthRatio: Number(lengthRatio.toFixed(3)),
      detectedGenre,
      rounds: 3,
      infoChecklistCount: checklistCount
    }
  };
}

export class RichTextPreprocessService {
  private readonly config: RichTextLLMConfig;

  constructor(config: RichTextLLMConfig) {
    this.config = config;
  }

  async preprocess(
    markdown: string,
    options: RichTextPreprocessOptions = {},
    onProgress?: (stage: string, message: string) => void
  ): Promise<RichTextPreprocessResult> {
    const { enableMultiRound = true } = options;

    if (!enableMultiRound) {
      return this.preprocessQuick(markdown, (message) => onProgress?.('quick', message));
    }

    return preprocessRichTextWithMultiRound(
      markdown,
      (prompt, callOptions) => this.callLLM(prompt, callOptions),
      (msg) => onProgress?.('multi-round', msg)
    );
  }

  async preprocessQuick(
    markdown: string,
    onProgress?: (msg: string) => void
  ): Promise<RichTextPreprocessResult> {
    onProgress?.('快速预处理：清理格式噪音...');
    const normalizedInput = normalizeInput(markdown);
    const preprocessedText = normalizedInput
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    onProgress?.('快速预处理完成');

    const originalLength = markdown.length;
    const processedLength = preprocessedText.length;
    const ratio = originalLength > 0 ? processedLength / originalLength : 1;

    return {
      preprocessedText: preprocessedText || markdown,
      summary: '快速预处理完成（结构清理 + 段落归一化）。',
      metadata: {
        originalLength,
        processedLength,
        lengthRatio: Number(ratio.toFixed(3)),
        detectedGenre: 'quick',
        rounds: 1,
        infoChecklistCount: countInformationUnits(preprocessedText || markdown)
      }
    };
  }

  private async callLLM(prompt: string, options?: RichTextPreprocessCallOptions): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('LLM API Key 未配置，无法执行多轮预处理');
    }

    return callLLMByBackend({
      provider: this.config.provider,
      apiKey: this.config.apiKey,
      apiUrl: this.config.apiUrl,
      model: this.config.model,
      prompt,
      temperature: options?.temperature ?? 0.4,
      maxTokens: options?.maxTokens ?? 2800,
      systemPrompt: options?.systemPrompt
    });
  }
}
