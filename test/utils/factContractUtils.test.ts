import { describe, it, expect } from 'vitest';
import {
  checkImportContract,
  computeFactCoverage,
  getContractRiskSummary,
  shouldTriggerContractGate,
  computeContractScore
} from '../../src/utils/factContractUtils';
import type { RichTextPreprocessResult, ScriptGenerationResult } from '../../src/types';

describe('factContractUtils', () => {
  const mockPreprocessResult: RichTextPreprocessResult = {
    preprocessedText: '测试文本',
    summary: '测试摘要',
    detectedFacts: [
      { id: 'F1', fact: '事实1：政策背景' },
      { id: 'F2', fact: '事实2：实施条件' },
      { id: 'F3', fact: '事实3：预期效果' },
      { id: 'F4', fact: '事实4：执行时间' }
    ],
    metadata: {
      originalLength: 100,
      processedLength: 100,
      lengthRatio: 1,
      detectedGenre: 'test',
      rounds: 1,
      infoChecklistCount: 4
    }
  };

  const mockGenerationResult: ScriptGenerationResult = {
    shots: [
      { description: '分镜1', duration: 5, assetRefs: [], factRefs: ['F1', 'F2'] },
      { description: '分镜2', duration: 5, assetRefs: [], factRefs: ['F3'] }
    ],
    summary: '测试生成'
  };

  describe('computeFactCoverage', () => {
    it('calculates coverage correctly', () => {
      const coverage = computeFactCoverage(mockPreprocessResult, mockGenerationResult);
      expect(coverage).toHaveLength(4);
      expect(coverage[0].covered).toBe(true);
      expect(coverage[0].coveredShots).toContain(0);
      expect(coverage[3].covered).toBe(false);
    });

    it('handles empty facts', () => {
      const result = computeFactCoverage(
        { ...mockPreprocessResult, detectedFacts: [] },
        mockGenerationResult
      );
      expect(result).toHaveLength(0);
    });

    it('handles shots without factRefs', () => {
      const result = computeFactCoverage(
        mockPreprocessResult,
        { shots: [{ description: 'test', duration: 5, assetRefs: [] }], summary: '' }
      );
      expect(result.every(f => !f.covered)).toBe(true);
    });
  });

  describe('checkImportContract', () => {
    it('returns satisfied when coverage >= 95%', () => {
      const check = checkImportContract(mockPreprocessResult, {
        shots: [
          { description: 's1', duration: 5, assetRefs: [], factRefs: ['F1', 'F2', 'F3', 'F4'] }
        ],
        summary: ''
      });
      expect(check.satisfied).toBe(true);
      expect(check.coverageRatio).toBe(1);
    });

    it('returns not satisfied when coverage < 95%', () => {
      const check = checkImportContract(mockPreprocessResult, mockGenerationResult);
      expect(check.satisfied).toBe(false);
      expect(check.coverageRatio).toBe(0.75);
      expect(check.uncoveredFacts).toBe(1);
    });

    it('returns uncovered fact list', () => {
      const check = checkImportContract(mockPreprocessResult, mockGenerationResult);
      expect(check.uncoveredFactList).toHaveLength(1);
      expect(check.uncoveredFactList[0].factId).toBe('F4');
    });

    it('determines risk level correctly', () => {
      const highRisk = checkImportContract(mockPreprocessResult, {
        shots: [{ description: 's1', duration: 5, assetRefs: [], factRefs: ['F1'] }],
        summary: ''
      });
      expect(highRisk.riskLevel).toBe('high');

      const noRisk = checkImportContract(mockPreprocessResult, {
        shots: [{ description: 's1', duration: 5, assetRefs: [], factRefs: ['F1', 'F2', 'F3', 'F4'] }],
        summary: ''
      });
      expect(noRisk.riskLevel).toBe('none');
    });
  });

  describe('getContractRiskSummary', () => {
    it('returns satisfied message', () => {
      const check = checkImportContract(mockPreprocessResult, {
        shots: [{ description: 's1', duration: 5, assetRefs: [], factRefs: ['F1', 'F2', 'F3', 'F4'] }],
        summary: ''
      });
      expect(getContractRiskSummary(check)).toContain('满足');
    });

    it('returns uncovered count for multiple', () => {
      const check = checkImportContract(mockPreprocessResult, mockGenerationResult);
      expect(getContractRiskSummary(check)).toContain('1 项事实未覆盖');
    });
  });

  describe('shouldTriggerContractGate', () => {
    it('returns false when no preprocess result', () => {
      expect(shouldTriggerContractGate(null, mockGenerationResult)).toBe(false);
    });

    it('returns false when no generation result', () => {
      expect(shouldTriggerContractGate(mockPreprocessResult, null)).toBe(false);
    });

    it('returns false when no detected facts', () => {
      expect(shouldTriggerContractGate(
        { ...mockPreprocessResult, detectedFacts: [] },
        mockGenerationResult
      )).toBe(false);
    });

    it('returns true when contract not satisfied', () => {
      expect(shouldTriggerContractGate(mockPreprocessResult, mockGenerationResult)).toBe(true);
    });

    it('returns false when contract satisfied', () => {
      expect(shouldTriggerContractGate(mockPreprocessResult, {
        shots: [{ description: 's1', duration: 5, assetRefs: [], factRefs: ['F1', 'F2', 'F3', 'F4'] }],
        summary: ''
      })).toBe(false);
    });
  });

  describe('computeContractScore', () => {
    it('returns 100 for full coverage', () => {
      const check = checkImportContract(mockPreprocessResult, {
        shots: [{ description: 's1', duration: 5, assetRefs: [], factRefs: ['F1', 'F2', 'F3', 'F4'] }],
        summary: ''
      });
      expect(computeContractScore(check)).toBe(100);
    });

    it('returns lower score for partial coverage', () => {
      const check = checkImportContract(mockPreprocessResult, mockGenerationResult);
      expect(computeContractScore(check)).toBeLessThan(100);
    });

    it('returns 100 when no facts', () => {
      const check = checkImportContract(
        { ...mockPreprocessResult, detectedFacts: [] },
        mockGenerationResult
      );
      expect(computeContractScore(check)).toBe(100);
    });
  });
});
