/**
 * 缺失事实一键补齐工具
 * F1: Fact Repair - 将发现的缺失事实自动补齐到预处理稿中
 */

import type { RichTextPreprocessResult } from '../types';

export interface MissingFact {
  factId: string;
  fact: string;
  evidence?: string;
}

export interface FactRepairState {
  originalPreprocessedText: string;
  repairedText: string;
  missingFacts: MissingFact[];
  appliedAt: number;
}

export interface MissingFactItem {
  id: string;
  fact: string;
  evidence?: string;
}

/**
 * 从预处理结果中提取缺失的事实
 * @param result 预处理结果
 * @returns 缺失事实列表
 */
export function extractMissingFacts(result: RichTextPreprocessResult): MissingFact[] {
  const missingFacts: MissingFact[] = [];
  
  if (!result.coverageChecklist || !result.detectedFacts) {
    return missingFacts;
  }
  
  // 遍历覆盖率清单，找出标记为缺失的项
  for (const item of result.coverageChecklist) {
    if (!item.kept) {
      // 查找对应的事实描述
      const fact = result.detectedFacts.find(f => f.id === item.factId);
      if (fact) {
        missingFacts.push({
          factId: item.factId,
          fact: fact.fact,
          evidence: item.evidence
        });
      }
    }
  }
  
  return missingFacts;
}

/**
 * 计算缺失事实统计
 */
export function summarizeMissingFacts(missingFacts: MissingFact[]): {
  count: number;
  totalLength: number;
} {
  return {
    count: missingFacts.length,
    totalLength: missingFacts.reduce((sum, f) => sum + f.fact.length, 0)
  };
}

/**
 * 生成补齐文案（确定性，无需 API）
 * @param missingFacts 缺失事实列表
 * @returns 补齐文案
 */
export function generateFactRepairPatch(missingFacts: MissingFact[]): string {
  if (missingFacts.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push(''); // 空行分隔
  lines.push('【补充信息】');
  lines.push('');
  
  missingFacts.forEach((mf, index) => {
    lines.push(`${index + 1}. ${mf.fact}`);
    if (mf.evidence) {
      lines.push(`   （依据：${mf.evidence}）`);
    }
  });
  
  lines.push('');
  return lines.join('\n');
}

/**
 * 应用事实补齐
 * @param preprocessedText 原预处理稿
 * @param missingFacts 缺失事实列表
 * @returns 补齐后的状态
 */
export function applyFactRepair(
  preprocessedText: string,
  missingFacts: MissingFact[]
): FactRepairState {
  const repairPatch = generateFactRepairPatch(missingFacts);
  const repairedText = preprocessedText + repairPatch;
  
  return {
    originalPreprocessedText: preprocessedText,
    repairedText,
    missingFacts: [...missingFacts],
    appliedAt: Date.now()
  };
}

/**
 * 回退事实补齐
 * @param repairState 补齐状态
 * @returns 原预处理稿
 */
export function revertFactRepair(repairState: FactRepairState): string {
  return repairState.originalPreprocessedText;
}

/**
 * 检查是否需要补齐
 * @param result 预处理结果
 * @returns 是否有缺失事实
 */
export function hasMissingFacts(result: RichTextPreprocessResult): boolean {
  return extractMissingFacts(result).length > 0;
}

/**
 * 获取缺失事实的摘要描述
 */
export function getMissingFactsSummary(missingFacts: MissingFact[]): string {
  const count = missingFacts.length;
  if (count === 0) {
    return '无缺失项';
  }
  if (count === 1) {
    return `1 项缺失：${missingFacts[0].fact.slice(0, 20)}...`;
  }
  return `${count} 项缺失：${missingFacts[0].fact.slice(0, 15)}... 等`;
}

/**
 * 创建部分补齐（选择特定事实进行补齐）
 * @param preprocessedText 原预处理稿
 * @param missingFacts 所有缺失事实
 * @param selectedFactIds 要补齐的事实ID列表
 */
export function applyPartialFactRepair(
  preprocessedText: string,
  missingFacts: MissingFact[],
  selectedFactIds: string[]
): FactRepairState {
  const selectedFacts = missingFacts.filter(mf => selectedFactIds.includes(mf.factId));
  return applyFactRepair(preprocessedText, selectedFacts);
}

/**
 * 补齐状态序列化（用于存储）
 */
export function serializeRepairState(state: FactRepairState): string {
  return JSON.stringify(state);
}

/**
 * 补齐状态反序列化
 */
export function deserializeRepairState(serialized: string): FactRepairState | null {
  try {
    const parsed = JSON.parse(serialized);
    // 基本验证
    if (
      typeof parsed.originalPreprocessedText === 'string' &&
      typeof parsed.repairedText === 'string' &&
      Array.isArray(parsed.missingFacts) &&
      typeof parsed.appliedAt === 'number'
    ) {
      return parsed as FactRepairState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 兼容层：供 UI 直接消费的缺失事实结构（id/fact/evidence）
 */
export function collectMissingFacts(result: RichTextPreprocessResult): MissingFactItem[] {
  return extractMissingFacts(result).map((item) => ({
    id: item.factId,
    fact: item.fact,
    evidence: item.evidence
  }));
}

/**
 * 兼容层：基于当前文本构建补齐稿，并返回本次真正追加的事实
 */
export function buildFactRepairedDraft(
  preprocessedText: string,
  missingFacts: MissingFactItem[]
): {
  repairedText: string;
  appendedFacts: MissingFactItem[];
} {
  const normalizedBase = (preprocessedText || '').toLowerCase();
  const appendableFacts = missingFacts.filter((item) => {
    const fact = item.fact.trim();
    return fact.length > 0 && !normalizedBase.includes(fact.toLowerCase());
  });

  if (appendableFacts.length === 0) {
    return {
      repairedText: preprocessedText || '',
      appendedFacts: []
    };
  }

  const repairState = applyFactRepair(
    preprocessedText || '',
    appendableFacts.map((item) => ({
      factId: item.id,
      fact: item.fact,
      evidence: item.evidence
    }))
  );

  return {
    repairedText: repairState.repairedText,
    appendedFacts: appendableFacts
  };
}
