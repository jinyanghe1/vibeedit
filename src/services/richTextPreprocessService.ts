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

interface WriterRoundOutput {
  rewrittenText?: string;
  summary?: string;
  coverageChecklist?: Array<{ factId?: string; kept?: boolean; evidence?: string }>;
  shotAnchors?: string[];
}

interface AuditorRoundOutput {
  verdict?: string;
  decisionReason?: string;
  revisionAdvice?: string;
  lengthRatio?: number;
  coverage?: number;
  shotAnchorCount?: number;
}

interface PreprocessFact {
  id: string;
  fact: string;
}

interface CandidateRound {
  round: number;
  text: string;
  coverageChecklist: Array<{ factId: string; kept: boolean; evidence?: string }>;
  shotAnchors: string[];
  metrics: {
    lengthRatio: number;
    coverage: number;
    shotAnchorCount: number;
  };
  writerSummary: string;
  auditorVerdict: string;
  auditorAdvice: string;
  auditorReason: string;
  passed: boolean;
}

const CLEANUP_SPACES = /\s{3,}/g;
const INFORMATION_SPLIT = /[\n。！？!?；;：:]/;
const MAX_SELF_PLAY_ROUNDS = 3;
const LENGTH_RATIO_MIN = 0.9;
const LENGTH_RATIO_MAX = 1.1;
const COVERAGE_MIN = 0.95;
const SHOT_ANCHOR_MIN = 3;

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

function buildFacts(round1: Round1Skeleton | null, normalizedInput: string): PreprocessFact[] {
  const llmFacts = (round1?.coreFacts || [])
    .map((item, index) => ({
      id: item.id || `F${index + 1}`,
      fact: (item.fact || '').trim()
    }))
    .filter((item) => item.fact.length > 0);

  if (llmFacts.length > 0) return llmFacts;

  const fallbackFacts = normalizedInput
    .split(INFORMATION_SPLIT)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 10)
    .map((fact, index) => ({ id: `F${index + 1}`, fact }));

  return fallbackFacts;
}

function inferFactKept(fact: string, text: string): boolean {
  const normalizedFact = fact.trim();
  if (!normalizedFact || !text.trim()) return false;
  if (text.includes(normalizedFact)) return true;

  const tokens = normalizedFact
    .split(/[，,。；;：:\s（）()、]/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) {
    return false;
  }
  return tokens.some((token) => text.includes(token));
}

function normalizeCoverageChecklist(
  checklist: WriterRoundOutput['coverageChecklist'],
  facts: PreprocessFact[],
  text: string
): Array<{ factId: string; kept: boolean; evidence?: string }> {
  if (facts.length === 0 && (!checklist || checklist.length === 0)) {
    return [];
  }

  const checklistById = new Map<string, { kept: boolean; evidence?: string }>();
  (checklist || []).forEach((item) => {
    const factId = (item.factId || '').trim();
    if (!factId) return;
    checklistById.set(factId, {
      kept: !!item.kept,
      evidence: item.evidence
    });
  });

  if (facts.length === 0) {
    return Array.from(checklistById.entries()).map(([factId, item]) => ({
      factId,
      kept: item.kept,
      evidence: item.evidence
    }));
  }

  return facts.map((fact) => {
    const matched = checklistById.get(fact.id);
    if (matched) {
      return {
        factId: fact.id,
        kept: matched.kept,
        evidence: matched.evidence || (matched.kept ? `命中 ${fact.fact.slice(0, 24)}` : undefined)
      };
    }
    const kept = inferFactKept(fact.fact, text);
    return {
      factId: fact.id,
      kept,
      evidence: kept ? `文本包含关键信息：${fact.fact.slice(0, 24)}` : `缺失关键信息：${fact.fact.slice(0, 24)}`
    };
  });
}

function inferShotAnchors(text: string): string[] {
  const paragraphs = text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 10);

  if (paragraphs.length >= 3) {
    return paragraphs.slice(0, 8).map((item, index) => `锚点${index + 1}: ${item.slice(0, 40)}`);
  }

  const sentences = text
    .split(/[。！？!?；;]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 10);

  return sentences.slice(0, 8).map((item, index) => `锚点${index + 1}: ${item.slice(0, 40)}`);
}

function calcCoverageRatio(coverageChecklist: Array<{ kept: boolean }>): number {
  if (coverageChecklist.length === 0) return 1;
  const keptCount = coverageChecklist.filter((item) => item.kept).length;
  return keptCount / coverageChecklist.length;
}

function normalizeCoverageScore(rawValue: number | undefined, fallback: number): number {
  if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) return fallback;
  if (rawValue > 1) return Math.max(0, Math.min(1, rawValue / 100));
  return Math.max(0, Math.min(1, rawValue));
}

function normalizeLengthRatio(rawValue: number | undefined, fallback: number): number {
  if (typeof rawValue !== 'number' || Number.isNaN(rawValue) || rawValue <= 0) return fallback;
  return rawValue;
}

function normalizeAnchorCount(rawValue: number | undefined, fallback: number): number {
  if (typeof rawValue !== 'number' || Number.isNaN(rawValue) || rawValue < 0) return fallback;
  return Math.floor(rawValue);
}

function scoreCandidate(candidate: CandidateRound): number {
  const coverageScore = candidate.metrics.coverage;
  const anchorScore = Math.min(1, candidate.metrics.shotAnchorCount / SHOT_ANCHOR_MIN);
  const lengthPenalty = Math.min(1, Math.abs(candidate.metrics.lengthRatio - 1));
  const lengthScore = 1 - lengthPenalty;
  return coverageScore * 0.5 + anchorScore * 0.3 + lengthScore * 0.2;
}

function buildNonConvergedDecision(best: CandidateRound): {
  finalDecision: 'usable' | 'unusable';
  finalReason: string;
} {
  const lengthAcceptable = best.metrics.lengthRatio >= 0.8 && best.metrics.lengthRatio <= 1.2;
  const coverageAcceptable = best.metrics.coverage >= 0.85;
  const anchorsAcceptable = best.metrics.shotAnchorCount >= 2;

  if (lengthAcceptable && coverageAcceptable && anchorsAcceptable) {
    return {
      finalDecision: 'usable',
      finalReason: '未收敛到严格阈值，但已达到可用基线（覆盖率/长度/分镜锚点均可接受）。'
    };
  }

  return {
    finalDecision: 'unusable',
    finalReason: '未收敛且低于可用基线，建议人工编辑后再生成分镜。'
  };
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

  onProgress?.('预处理 1/4：抽取信息骨架...');
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
  const facts = buildFacts(round1, normalizedInput);
  const detectedGenre = round1?.genre || 'mixed';

  const candidates: CandidateRound[] = [];
  let previousText = normalizedInput;
  let previousAdvice = '';
  let convergedCandidate: CandidateRound | null = null;

  for (let round = 1; round <= MAX_SELF_PLAY_ROUNDS; round += 1) {
    onProgress?.(`预处理 2/4：Writer 生成候选稿（第 ${round}/${MAX_SELF_PLAY_ROUNDS} 轮）...`);
    const writerPrompt = `你是 Writer。请将“知识型文本”改写为“可分镜拆解稿”，并严格遵守约束。

原文：
${normalizedInput}

信息骨架(JSON)：
${JSON.stringify(round1 || {}, null, 2)}

上一轮候选稿（如有）：
${round === 1 ? '无' : previousText}

Auditor 修订意见（如有）：
${previousAdvice || '无'}

改写约束：
1) 事实不删减，不新增未经原文支持的信息。
2) 篇幅接近原文，字符数控制在原文的 0.90x ~ 1.10x。
3) 保留原文关键名词、数字、机构和政策名。
4) 语体改为“可拍摄叙述”，每段都应具备可视化动作/场景线索。
5) 不写镜头编号，不输出 JSON 片段到正文，不写“作为AI”。
6) 给出至少 3 个分镜锚点（shotAnchors），便于后续切分。

只返回 JSON：
{
  "rewrittenText": "候选稿件",
  "summary": "改写策略简述",
  "coverageChecklist": [{"factId":"F1","kept":true,"evidence":"在第2段体现"}],
  "shotAnchors": ["开场问题定义","中段证据铺陈","结尾行动建议"]
}`;

    const writerRaw = await callLLM(writerPrompt, {
      temperature: 0.45,
      maxTokens: 3200,
      systemPrompt: '你是资深采编 Writer，目标是输出高保真且可分镜的可视化稿件。'
    });
    const writer = parseJson<WriterRoundOutput>(writerRaw);
    const candidateText = (writer?.rewrittenText || '').trim() || previousText || normalizedInput;
    const coverageChecklist = normalizeCoverageChecklist(writer?.coverageChecklist, facts, candidateText);
    const inferredAnchors = inferShotAnchors(candidateText);
    const writerAnchors = (writer?.shotAnchors || [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const shotAnchors = writerAnchors.length > 0 ? writerAnchors : inferredAnchors;

    const lengthRatioRaw = normalizedInput.length > 0 ? candidateText.length / normalizedInput.length : 1;
    const coverageRaw = calcCoverageRatio(coverageChecklist);
    const shotAnchorCountRaw = shotAnchors.length;

    onProgress?.(`预处理 3/4：Auditor 质检（第 ${round}/${MAX_SELF_PLAY_ROUNDS} 轮）...`);
    const auditorPrompt = `你是 Auditor。请对 Writer 候选稿做质检并给出修订意见。

原文长度：${normalizedInput.length}
目标阈值：
- lengthRatio ∈ [${LENGTH_RATIO_MIN}, ${LENGTH_RATIO_MAX}]
- coverage >= ${Math.round(COVERAGE_MIN * 100)}%
- shotAnchors >= ${SHOT_ANCHOR_MIN}

原文：
${normalizedInput}

核心事实：
${JSON.stringify(facts, null, 2)}

候选稿：
${candidateText}

Writer 自报覆盖清单：
${JSON.stringify(coverageChecklist, null, 2)}

Writer 锚点：
${JSON.stringify(shotAnchors, null, 2)}

只返回 JSON：
{
  "verdict": "pass 或 revise",
  "decisionReason": "判断依据",
  "revisionAdvice": "下一轮修订建议",
  "lengthRatio": 1.02,
  "coverage": 0.97,
  "shotAnchorCount": 3
}`;
    const auditorRaw = await callLLM(auditorPrompt, {
      temperature: 0.2,
      maxTokens: 1800,
      systemPrompt: '你是严苛但务实的内容质检 Auditor，只做可验证打分。'
    });
    const auditor = parseJson<AuditorRoundOutput>(auditorRaw);

    const lengthRatio = normalizeLengthRatio(auditor?.lengthRatio, lengthRatioRaw);
    const coverage = normalizeCoverageScore(auditor?.coverage, coverageRaw);
    const shotAnchorCount = normalizeAnchorCount(auditor?.shotAnchorCount, shotAnchorCountRaw);
    const passed =
      lengthRatio >= LENGTH_RATIO_MIN &&
      lengthRatio <= LENGTH_RATIO_MAX &&
      coverage >= COVERAGE_MIN &&
      shotAnchorCount >= SHOT_ANCHOR_MIN;

    const writerSummary = (writer?.summary || '').trim() || 'Writer 未提供摘要。';
    const auditorVerdict = (auditor?.verdict || '').trim() || (passed ? 'pass' : 'revise');
    const auditorAdvice = (auditor?.revisionAdvice || '').trim() || (passed
      ? '达到阈值，无需继续修订。'
      : '请补齐缺失事实并增强可拍摄锚点。');
    const auditorReason = (auditor?.decisionReason || '').trim() || (
      passed
        ? '长度、覆盖率和锚点数均满足阈值。'
        : '至少一个核心指标未满足阈值。'
    );

    const candidate: CandidateRound = {
      round,
      text: candidateText,
      coverageChecklist,
      shotAnchors,
      metrics: {
        lengthRatio: Number(lengthRatio.toFixed(3)),
        coverage: Number(coverage.toFixed(3)),
        shotAnchorCount
      },
      writerSummary,
      auditorVerdict,
      auditorAdvice,
      auditorReason,
      passed
    };

    candidates.push(candidate);
    previousText = candidateText;
    previousAdvice = auditorAdvice;

    if (passed) {
      convergedCandidate = candidate;
      onProgress?.(`预处理 4/4：已在第 ${round} 轮收敛。`);
      break;
    }
  }

  const selectedCandidate = convergedCandidate || [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  if (!selectedCandidate) {
    return {
      preprocessedText: normalizedInput,
      summary: '预处理失败，已回退原文。',
      detectedFacts: facts,
      coverageChecklist: [],
      adjustments: ['未获得有效候选稿，建议重试。'],
      metadata: {
        originalLength: normalizedInput.length,
        processedLength: normalizedInput.length,
        lengthRatio: 1,
        detectedGenre,
        rounds: 0,
        infoChecklistCount: 0
      },
      qualityReport: {
        rounds: [],
        finalDecision: 'unusable',
        finalReason: '未生成有效候选稿。',
        converged: false,
        bestRound: 0,
        thresholds: {
          lengthRatioMin: LENGTH_RATIO_MIN,
          lengthRatioMax: LENGTH_RATIO_MAX,
          minCoverage: COVERAGE_MIN,
          minShotAnchors: SHOT_ANCHOR_MIN
        }
      }
    };
  }

  const executedRounds = candidates.length;
  const infoChecklistCount = selectedCandidate.coverageChecklist.length || facts.length;
  const decision = convergedCandidate
    ? {
        finalDecision: 'converged' as const,
        finalReason: selectedCandidate.auditorReason
      }
    : buildNonConvergedDecision(selectedCandidate);
  const lengthRatio = selectedCandidate.metrics.lengthRatio;
  const summarySegments = [
    `自博弈迭代 ${executedRounds}/${MAX_SELF_PLAY_ROUNDS} 轮，结论：${decision.finalDecision}。`,
    decision.finalReason,
    `长度比例 ${lengthRatio.toFixed(2)}，覆盖率 ${Math.round(selectedCandidate.metrics.coverage * 100)}%，分镜锚点 ${selectedCandidate.metrics.shotAnchorCount} 个。`
  ];

  return {
    preprocessedText: selectedCandidate.text,
    summary: summarySegments.join(' '),
    coverageChecklist: selectedCandidate.coverageChecklist,
    detectedFacts: facts,
    adjustments: candidates
      .filter((item) => !item.passed)
      .map((item) => `第${item.round}轮修订建议：${item.auditorAdvice}`),
    metadata: {
      originalLength: normalizedInput.length,
      processedLength: selectedCandidate.text.length,
      lengthRatio,
      detectedGenre,
      rounds: executedRounds,
      infoChecklistCount
    },
    qualityReport: {
      rounds: candidates.map((item) => ({
        round: item.round,
        writerSummary: item.writerSummary,
        auditorVerdict: item.auditorVerdict,
        auditorAdvice: item.auditorAdvice,
        lengthRatio: item.metrics.lengthRatio,
        coverage: item.metrics.coverage,
        shotAnchorCount: item.metrics.shotAnchorCount,
        passed: item.passed
      })),
      finalDecision: decision.finalDecision,
      finalReason: decision.finalReason,
      converged: !!convergedCandidate,
      bestRound: selectedCandidate.round,
      thresholds: {
        lengthRatioMin: LENGTH_RATIO_MIN,
        lengthRatioMax: LENGTH_RATIO_MAX,
        minCoverage: COVERAGE_MIN,
        minShotAnchors: SHOT_ANCHOR_MIN
      }
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
      coverageChecklist: [],
      detectedFacts: [],
      adjustments: ['未启用多轮 LLM 预处理，已使用快速清理模式'],
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
