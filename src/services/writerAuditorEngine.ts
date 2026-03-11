/**
 * 自博弈预处理引擎 (Writer + Auditor)
 * F6: 多轮闭环质量优化
 */

import type {
  LLMConfig,
  PreprocessFinalDecision,
  PreprocessQualityReport,
  PreprocessQualityRound,
  RichTextPreprocessResult
} from '../types';
import { callLLMByBackend } from './backendProxy';

export interface WriterAuditorOptions {
  maxRounds?: number;
  lengthRatioMin?: number;
  lengthRatioMax?: number;
  minCoverage?: number;
  minShotAnchors?: number;
}

export interface RoundResult {
  preprocessedText: string;
  summary: string;
  coverageChecklist?: Array<{
    factId: string;
    kept: boolean;
    evidence?: string;
  }>;
  detectedFacts?: Array<{
    id: string;
    fact: string;
  }>;
}

const DEFAULT_OPTIONS: Required<WriterAuditorOptions> = {
  maxRounds: 3,
  lengthRatioMin: 0.90,
  lengthRatioMax: 1.10,
  minCoverage: 0.95,
  minShotAnchors: 3
};

/**
 * 计算分镜锚点数量（段落切分点）
 */
function countShotAnchors(text: string): number {
  // 统计 [SCENE_BREAK] 标记
  const sceneBreaks = (text.match(/\[SCENE_BREAK\]/g) || []).length;
  // 统计段落数（空行分隔）
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20).length;
  // 取两者最大值
  return Math.max(sceneBreaks, Math.floor(paragraphs / 2));
}

/**
 * 计算覆盖率
 */
function calculateCoverage(
  coverageChecklist?: Array<{ kept: boolean }>
): number {
  if (!coverageChecklist || coverageChecklist.length === 0) {
    return 1; // 无检查清单时默认为 100%
  }
  const keptCount = coverageChecklist.filter(item => item.kept).length;
  return keptCount / coverageChecklist.length;
}

/**
 * 计算长度比
 */
function calculateLengthRatio(originalLength: number, processedLength: number): number {
  if (originalLength === 0) return 1;
  return processedLength / originalLength;
}

/**
 * 判断是否达标
 */
function meetsThresholds(
  lengthRatio: number,
  coverage: number,
  shotAnchors: number,
  thresholds: Required<WriterAuditorOptions>
): boolean {
  return (
    lengthRatio >= thresholds.lengthRatioMin &&
    lengthRatio <= thresholds.lengthRatioMax &&
    coverage >= thresholds.minCoverage &&
    shotAnchors >= thresholds.minShotAnchors
  );
}

/**
 * 生成 Auditor Prompt
 */
function buildAuditorPrompt(
  originalText: string,
  candidateText: string,
  _round: number,
  _config: LLMConfig
): string {
  return `你是严格的预处理质量审计员(Auditor)。请评估以下候选预处理稿的质量。

【原始文本】（长度 ${originalText.length}）：
${originalText.slice(0, 500)}...

【候选预处理稿】（长度 ${candidateText.length}）：
${candidateText.slice(0, 800)}

请评估以下指标：
1. 长度比例：候选稿长度 / 原文长度 = ${(candidateText.length / Math.max(1, originalText.length)).toFixed(2)}
2. 信息覆盖率：核心事实是否完整保留
3. 分镜锚点：是否存在清晰的段落/场景切分点（[SCENE_BREAK] 或空行分隔）

要求：
- lengthRatio 应在 [0.90, 1.10] 范围内
- 覆盖率应 >= 95%
- 分镜锚点应 >= 3 个

请用 JSON 格式返回：
{
  "verdict": "passed|needs_improvement",
  "advice": "具体改进建议（如'增加段落切分标记'、'补回F3信息'等）",
  "coverage": 0.95,
  "shotAnchorCount": 4
}`;
}

/**
 * 生成 Writer Revision Prompt
 */
function buildRevisionPrompt(
  originalText: string,
  currentDraft: string,
  auditorAdvice: string,
  _round: number
): string {
  return `你是资深编辑(Writer)。请根据审计意见修订预处理稿。

【原始文本】：
${originalText.slice(0, 500)}...

【当前候选稿】：
${currentDraft.slice(0, 600)}

【审计意见】：
${auditorAdvice}

请修订候选稿，确保：
1. 遵循审计建议改进问题
2. 保持信息密度和篇幅接近原文
3. 增加清晰的段落切分标记（如 [SCENE_BREAK]）
4. 确保核心事实完整

请直接返回修订后的完整稿件。`;
}

/**
 * Writer/Auditor 引擎
 */
export class WriterAuditorEngine {
  private config: LLMConfig;
  private options: Required<WriterAuditorOptions>;

  constructor(config: LLMConfig, options: WriterAuditorOptions = {}) {
    this.config = config;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 执行单轮审计
   */
  private async auditRound(
    originalText: string,
    candidateText: string,
    round: number,
    coverageChecklist?: Array<{ kept: boolean }>
  ): Promise<{
    verdict: 'passed' | 'needs_improvement';
    advice: string;
    coverage: number;
    shotAnchorCount: number;
  }> {
    const lengthRatio = calculateLengthRatio(originalText.length, candidateText.length);
    const coverage = calculateCoverage(coverageChecklist);
    const shotAnchorCount = countShotAnchors(candidateText);

    // 如果已达标，直接通过
    if (meetsThresholds(lengthRatio, coverage, shotAnchorCount, this.options)) {
      return {
        verdict: 'passed',
        advice: '质量达标，无需改进',
        coverage,
        shotAnchorCount
      };
    }

    // 调用 LLM 获取详细审计意见
    try {
      const prompt = buildAuditorPrompt(originalText, candidateText, round, this.config);
      const response = await callLLMByBackend({
        provider: this.config.provider,
        apiKey: this.config.apiKey,
        apiUrl: this.config.apiUrl,
        model: this.config.model || 'doubao-seed-1-6-251015',
        prompt,
        temperature: 0.3,
        maxTokens: 800
      });

      const responseText = typeof response === 'string' ? response : String(response);
      
      // 尝试解析 JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            verdict: parsed.verdict === 'passed' ? 'passed' : 'needs_improvement',
            advice: parsed.advice || '需改进',
            coverage: typeof parsed.coverage === 'number' ? parsed.coverage : coverage,
            shotAnchorCount: typeof parsed.shotAnchorCount === 'number' ? parsed.shotAnchorCount : shotAnchorCount
          };
        } catch {
          // JSON 解析失败，使用本地计算
        }
      }
    } catch (error) {
      console.warn('Auditor LLM 调用失败，使用本地评估:', error);
    }

    // 本地评估反馈
    const issues: string[] = [];
    if (lengthRatio < this.options.lengthRatioMin) issues.push('内容删减过多');
    if (lengthRatio > this.options.lengthRatioMax) issues.push('内容扩展过多');
    if (coverage < this.options.minCoverage) issues.push('事实覆盖不足');
    if (shotAnchorCount < this.options.minShotAnchors) issues.push('分镜锚点不足');

    return {
      verdict: 'needs_improvement',
      advice: issues.join('；') || '需优化',
      coverage,
      shotAnchorCount
    };
  }

  /**
   * 执行修订（Writer）
   */
  private async reviseDraft(
    originalText: string,
    currentDraft: string,
    auditorAdvice: string,
    round: number
  ): Promise<string> {
    try {
      const prompt = buildRevisionPrompt(originalText, currentDraft, auditorAdvice, round);
      const response = await callLLMByBackend({
        provider: this.config.provider,
        apiKey: this.config.apiKey,
        apiUrl: this.config.apiUrl,
        model: this.config.model || 'doubao-seed-1-6-251015',
        prompt,
        temperature: 0.4,
        maxTokens: 2000
      });

      const revisedText = typeof response === 'string' ? response : String(response);
      return revisedText.trim() || currentDraft;
    } catch (error) {
      console.warn('Writer 修订失败，保留原稿:', error);
      return currentDraft;
    }
  }

  /**
   * 执行多轮迭代
   */
  async iterate(
    originalText: string,
    initialResult: RichTextPreprocessResult,
    onProgress?: (round: number, status: string) => void
  ): Promise<{
    finalResult: RichTextPreprocessResult;
    qualityReport: PreprocessQualityReport;
  }> {
    const rounds: PreprocessQualityRound[] = [];
    let currentDraft = initialResult.preprocessedText;
    let bestDraft = currentDraft;
    let bestRound = 1;
    let bestScore = 0;

    const originalLength = originalText.length;

    for (let round = 1; round <= this.options.maxRounds; round++) {
      onProgress?.(round, `第 ${round} 轮审计中...`);

      // Auditor 评估
      const audit = await this.auditRound(
        originalText,
        currentDraft,
        round,
        initialResult.coverageChecklist
      );

      const lengthRatio = calculateLengthRatio(originalLength, currentDraft.length);
      const passed = audit.verdict === 'passed';

      // 记录本轮
      const roundRecord: PreprocessQualityRound = {
        round,
        writerSummary: round === 1 ? '初始预处理稿' : `第 ${round - 1} 轮修订稿`,
        auditorVerdict: passed ? '通过' : '需改进',
        auditorAdvice: audit.advice,
        lengthRatio,
        coverage: audit.coverage,
        shotAnchorCount: audit.shotAnchorCount,
        passed
      };
      rounds.push(roundRecord);

      // 计算综合得分（用于选择最佳轮次）
      const score = audit.coverage * 0.5 + Math.min(1, audit.shotAnchorCount / 3) * 0.3 +
        (1 - Math.abs(1 - lengthRatio)) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestDraft = currentDraft;
        bestRound = round;
      }

      // 检查是否达标（提前收敛）
      if (passed && meetsThresholds(lengthRatio, audit.coverage, audit.shotAnchorCount, this.options)) {
        break;
      }

      // 最后一轮不修订
      if (round < this.options.maxRounds) {
        onProgress?.(round, `第 ${round} 轮修订中...`);
        currentDraft = await this.reviseDraft(originalText, currentDraft, audit.advice, round);
      }
    }

    // 确定最终决策
    const finalRound = rounds[rounds.length - 1];
    let finalDecision: PreprocessFinalDecision;
    let finalReason: string;

    if (finalRound.passed && meetsThresholds(
      finalRound.lengthRatio,
      finalRound.coverage,
      finalRound.shotAnchorCount,
      this.options
    )) {
      finalDecision = 'converged';
      finalReason = `第 ${bestRound} 轮达标，已收敛`;
    } else if (finalRound.coverage >= 0.85 && finalRound.shotAnchorCount >= 2) {
      finalDecision = 'usable';
      finalReason = `未完全达标但可用（覆盖率 ${(finalRound.coverage * 100).toFixed(0)}%，锚点 ${finalRound.shotAnchorCount} 个）`;
    } else {
      finalDecision = 'unusable';
      finalReason = `质量不足（覆盖率 ${(finalRound.coverage * 100).toFixed(0)}%，锚点 ${finalRound.shotAnchorCount} 个），建议人工处理`;
    }

    const qualityReport: PreprocessQualityReport = {
      rounds,
      finalDecision,
      finalReason,
      converged: finalDecision === 'converged',
      bestRound,
      thresholds: {
        lengthRatioMin: this.options.lengthRatioMin,
        lengthRatioMax: this.options.lengthRatioMax,
        minCoverage: this.options.minCoverage,
        minShotAnchors: this.options.minShotAnchors
      }
    };

    // 构建最终结果
    const finalResult: RichTextPreprocessResult = {
      ...initialResult,
      preprocessedText: bestDraft,
      qualityReport
    };

    return { finalResult, qualityReport };
  }
}

export default WriterAuditorEngine;
