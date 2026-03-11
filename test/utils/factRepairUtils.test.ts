import { describe, expect, it } from 'vitest';
import { buildFactRepairedDraft, collectMissingFacts } from '../../src/utils/factRepairUtils';
import type { RichTextPreprocessResult } from '../../src/types';

const baseResult: RichTextPreprocessResult = {
  preprocessedText: '第一段保留背景信息。',
  summary: 'ok',
  detectedFacts: [
    { id: 'F1', fact: '背景信息' },
    { id: 'F2', fact: '实施条件' },
    { id: 'F3', fact: '关键数字' }
  ],
  coverageChecklist: [
    { factId: 'F1', kept: true, evidence: '第1段保留背景信息' },
    { factId: 'F2', kept: false, evidence: '缺失实施条件' },
    { factId: 'F3', kept: false, evidence: '缺失关键数字' }
  ],
  metadata: {
    originalLength: 10,
    processedLength: 10,
    lengthRatio: 1,
    detectedGenre: 'analysis',
    rounds: 3,
    infoChecklistCount: 3
  }
};

describe('factRepairUtils', () => {
  it('collectMissingFacts extracts uncovered facts', () => {
    const missing = collectMissingFacts(baseResult);

    expect(missing).toHaveLength(2);
    expect(missing[0].id).toBe('F2');
    expect(missing[0].fact).toBe('实施条件');
    expect(missing[1].id).toBe('F3');
    expect(missing[1].fact).toBe('关键数字');
  });

  it('buildFactRepairedDraft appends only non-existing facts', () => {
    const missing = collectMissingFacts(baseResult);
    const repaired = buildFactRepairedDraft(baseResult.preprocessedText, missing);

    expect(repaired.appendedFacts).toHaveLength(2);
    expect(repaired.repairedText).toContain('【补充信息】');
    expect(repaired.repairedText).toContain('1. 实施条件');
    expect(repaired.repairedText).toContain('2. 关键数字');

    const noAppend = buildFactRepairedDraft(
      '第一段保留背景信息。实施条件已经出现。关键数字已经出现。',
      missing
    );
    expect(noAppend.appendedFacts).toHaveLength(0);
    expect(noAppend.repairedText).toContain('关键数字已经出现');
  });
});
