/**
 * 事实-分镜契约工具
 * F7: Traceable Import Contract
 */

import type { RichTextPreprocessResult, ScriptGenerationResult } from '../types';

export interface FactCoverageInfo {
  factId: string;
  fact: string;
  covered: boolean;
  coveredShots: number[];
}

export interface ImportContractCheck {
  satisfied: boolean;
  totalFacts: number;
  coveredFacts: number;
  uncoveredFacts: number;
  coverageRatio: number;
  uncoveredFactList: Array<{ factId: string; fact: string }>;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

/**
 * 计算事实覆盖情况
 * @param preprocessResult 预处理结果（包含 detectedFacts）
 * @param generationResult 生成结果（包含 shots 及其 factRefs）
 * @returns 事实覆盖信息列表
 */
export function computeFactCoverage(
  preprocessResult: RichTextPreprocessResult,
  generationResult: ScriptGenerationResult
): FactCoverageInfo[] {
  const detectedFacts = preprocessResult.detectedFacts || [];
  const shots = generationResult.shots || [];

  return detectedFacts.map((fact) => {
    const coveredShots: number[] = [];

    shots.forEach((shot, index) => {
      const factRefs = shot.factRefs || [];
      if (factRefs.includes(fact.id)) {
        coveredShots.push(index);
      }
    });

    return {
      factId: fact.id,
      fact: fact.fact,
      covered: coveredShots.length > 0,
      coveredShots
    };
  });
}

/**
 * 检查导入契约是否满足
 * @param preprocessResult 预处理结果
 * @param generationResult 生成结果
 * @returns 契约检查结果
 */
export function checkImportContract(
  preprocessResult: RichTextPreprocessResult,
  generationResult: ScriptGenerationResult
): ImportContractCheck {
  const coverageInfo = computeFactCoverage(preprocessResult, generationResult);
  const totalFacts = coverageInfo.length;
  const coveredFacts = coverageInfo.filter((f) => f.covered).length;
  const uncoveredFacts = totalFacts - coveredFacts;
  const coverageRatio = totalFacts > 0 ? coveredFacts / totalFacts : 1;

  const uncoveredFactList = coverageInfo
    .filter((f) => !f.covered)
    .map((f) => ({ factId: f.factId, fact: f.fact }));

  // 风险等级判定
  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  if (totalFacts === 0) {
    riskLevel = 'none';
  } else if (coverageRatio >= 0.95) {
    riskLevel = 'none';
  } else if (coverageRatio >= 0.80) {
    riskLevel = 'low';
  } else if (coverageRatio >= 0.60) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  // 契约满足条件：覆盖率 >= 95% 或无非覆盖事实
  const satisfied = coverageRatio >= 0.95 || uncoveredFacts === 0;

  return {
    satisfied,
    totalFacts,
    coveredFacts,
    uncoveredFacts,
    coverageRatio,
    uncoveredFactList,
    riskLevel
  };
}

/**
 * 获取未覆盖的事实清单
 */
export function getUncoveredFacts(
  preprocessResult: RichTextPreprocessResult,
  generationResult: ScriptGenerationResult
): Array<{ factId: string; fact: string }> {
  const contractCheck = checkImportContract(preprocessResult, generationResult);
  return contractCheck.uncoveredFactList;
}

/**
 * 判断是否应触发契约门禁
 * @param preprocessResult 预处理结果
 * @param generationResult 生成结果
 * @returns 是否触发门禁
 */
export function shouldTriggerContractGate(
  preprocessResult: RichTextPreprocessResult | null,
  generationResult: ScriptGenerationResult | null
): boolean {
  // 无预处理结果或生成结果时，不触发门禁
  if (!preprocessResult || !generationResult) {
    return false;
  }

  // 无事实清单时，不触发门禁
  if (!preprocessResult.detectedFacts || preprocessResult.detectedFacts.length === 0) {
    return false;
  }

  const contractCheck = checkImportContract(preprocessResult, generationResult);
  return !contractCheck.satisfied;
}

/**
 * 生成契约风险摘要
 */
export function getContractRiskSummary(contractCheck: ImportContractCheck): string {
  if (contractCheck.satisfied) {
    return `事实契约满足（${contractCheck.coveredFacts}/${contractCheck.totalFacts} 已覆盖）`;
  }

  const uncoveredCount = contractCheck.uncoveredFacts;
  if (uncoveredCount === 1) {
    return `1 项事实未覆盖：${contractCheck.uncoveredFactList[0]?.fact.slice(0, 20)}...`;
  }
  return `${uncoveredCount} 项事实未覆盖，导入存在风险`;
}

/**
 * 生成分镜的事实引用标签
 * @param shotIndex 分镜索引
 * @param preprocessResult 预处理结果
 * @param generationResult 生成结果
 * @returns 该分镜引用的事实 ID 列表
 */
export function getShotFactRefs(
  shotIndex: number,
  generationResult: ScriptGenerationResult
): string[] {
  const shots = generationResult.shots || [];
  if (shotIndex < 0 || shotIndex >= shots.length) {
    return [];
  }
  return shots[shotIndex].factRefs || [];
}

/**
 * 获取分镜引用的事实详情
 */
export function getShotFactDetails(
  shotIndex: number,
  preprocessResult: RichTextPreprocessResult,
  generationResult: ScriptGenerationResult
): Array<{ factId: string; fact: string }> {
  const factRefs = getShotFactRefs(shotIndex, generationResult);
  const detectedFacts = preprocessResult.detectedFacts || [];

  return factRefs
    .map((refId) => {
      const fact = detectedFacts.find((f) => f.id === refId);
      return fact ? { factId: fact.id, fact: fact.fact } : null;
    })
    .filter((item): item is { factId: string; fact: string } => item !== null);
}

/**
 * 计算契约质量评分（0-100）
 */
export function computeContractScore(contractCheck: ImportContractCheck): number {
  if (contractCheck.totalFacts === 0) {
    return 100;
  }

  // 基础分：覆盖率 * 80
  const coverageScore = contractCheck.coverageRatio * 80;

  // 完整性奖励：全部覆盖 +20
  const completenessBonus = contractCheck.coveredFacts === contractCheck.totalFacts ? 20 : 0;

  return Math.round(coverageScore + completenessBonus);
}
