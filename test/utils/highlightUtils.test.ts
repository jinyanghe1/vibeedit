import { describe, expect, it } from 'vitest';
import {
  checkEvidenceMatch,
  extractEvidenceKeywordsFromCoverage,
  generateHighlightSegments,
  getEvidenceLocationLabel,
  summarizeCoverage
} from '../../src/utils/highlightUtils';

describe('highlightUtils', () => {
  it('summarizeCoverage returns kept/missing stats', () => {
    const summary = summarizeCoverage([
      { factId: 'F1', kept: true, evidence: '保留背景信息' },
      { factId: 'F2', kept: false, evidence: '缺失实施条件' },
      { factId: 'F3', kept: true, evidence: '补回关键数字' }
    ]);

    expect(summary.total).toBe(3);
    expect(summary.keptCount).toBe(2);
    expect(summary.missingCount).toBe(1);
    expect(summary.keptRatio).toBeCloseTo(2 / 3, 5);
  });

  it('extractEvidenceKeywordsFromCoverage normalizes evidence words', () => {
    const keywords = extractEvidenceKeywordsFromCoverage([
      { factId: 'F1', kept: true, evidence: '第2段保留背景信息' },
      { factId: 'F2', kept: false, evidence: '缺失实施条件' }
    ]);

    expect(keywords).toContain('背景信息');
    expect(keywords).toContain('实施条件');
  });

  it('checkEvidenceMatch returns location and matched keywords', () => {
    const both = checkEvidenceMatch(
      '缺失实施条件',
      '原文包含实施条件',
      '预处理稿也包含实施条件'
    );
    expect(both.location).toBe('both');
    expect(both.found).toBe(true);

    const none = checkEvidenceMatch('缺失预算上限', '原文仅有背景', '预处理稿仅有背景');
    expect(none.location).toBe('none');
    expect(none.found).toBe(false);
  });

  it('generateHighlightSegments splits highlighted parts', () => {
    const segments = generateHighlightSegments('第一段包含实施条件，第二段补回关键数字。', ['实施条件', '关键数字']);
    expect(segments.some((segment) => segment.isHighlight && segment.text === '实施条件')).toBe(true);
    expect(segments.some((segment) => segment.isHighlight && segment.text === '关键数字')).toBe(true);
  });

  it('getEvidenceLocationLabel maps location to Chinese label', () => {
    expect(getEvidenceLocationLabel('original')).toBe('仅原文命中');
    expect(getEvidenceLocationLabel('processed')).toBe('仅预处理稿命中');
    expect(getEvidenceLocationLabel('both')).toBe('双端命中');
    expect(getEvidenceLocationLabel('none')).toBe('未命中');
  });
});
