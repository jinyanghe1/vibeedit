import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkProjectConsistency,
  checkShotConsistency,
  extractCharacterProfileFromAsset,
  generateRepairPatch
} from '../../src/services/characterConsistencyService';
import { callLLMByBackend } from '../../src/services/backendProxy';
import type { CharacterProfile, Shot } from '../../src/types';

vi.mock('../../src/services/backendProxy', () => ({
  callLLMByBackend: vi.fn()
}));

const llmConfig = {
  provider: 'bytedance' as const,
  apiKey: 'k',
  apiUrl: 'u',
  model: 'm'
};

describe('characterConsistencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extractCharacterProfileFromAsset returns structured profile on valid llm response', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '```json\n{"displayName":"小红","appearance":{"hair":"黑色长发"},"outfit":{"default":"红色汉服","alternatives":["战斗服"]},"forbiddenTraits":["短发"]}\n```'
    );

    const profile = await extractCharacterProfileFromAsset(
      {
        id: 'asset-1',
        name: '小红',
        type: 'image',
        url: 'https://img',
        description: '红衣长发',
        createdAt: 1
      },
      llmConfig
    );

    expect(profile.assetName).toBe('小红');
    expect(profile.displayName).toBe('小红');
    expect(profile.appearance.hair).toBe('黑色长发');
    expect(profile.outfit.default).toBe('红色汉服');
    expect(profile.outfit.alternatives).toEqual(['战斗服']);
    expect(profile.forbiddenTraits).toEqual(['短发']);
  });

  it('extractCharacterProfileFromAsset falls back to basic profile on parse failure', async () => {
    vi.mocked(callLLMByBackend).mockRejectedValue(new Error('network'));

    const profile = await extractCharacterProfileFromAsset(
      {
        id: 'asset-2',
        name: '小蓝',
        type: 'image',
        url: 'https://img',
        description: '蓝衣',
        createdAt: 1
      },
      llmConfig
    );

    expect(profile.assetName).toBe('小蓝');
    expect(profile.displayName).toBe('小蓝');
    expect(profile.outfit.default).toBe('');
    expect(profile.forbiddenTraits).toEqual([]);
  });

  it('checkShotConsistency returns weighted scores and high risk', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '```json\n{"scores":{"identity":50,"outfit":60,"style":40},"issues":[{"type":"outfit_conflict","severity":"error","message":"服装冲突","autoFixable":true}]}\n```'
    );

    const shot: Shot = {
      id: 'shot-1',
      description: '小红穿黑色西装',
      duration: 5,
      assetRefs: [],
      videos: [],
      order: 0
    };
    const profile: CharacterProfile = {
      id: 'char-1',
      assetName: '小红',
      displayName: '小红',
      appearance: {},
      outfit: { default: '红色汉服' },
      forbiddenTraits: ['黑色西装'],
      version: 1,
      createdAt: 1,
      updatedAt: 1
    };

    const report = await checkShotConsistency(shot, profile, llmConfig);
    expect(report.score.total).toBe(52);
    expect(report.riskLevel).toBe('high');
    expect(report.issues[0].type).toBe('outfit_conflict');
    expect(report.issues[0].autoFixable).toBe(true);
  });

  it('checkShotConsistency falls back to unknown report on error', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue('not-json');

    const report = await checkShotConsistency(
      {
        id: 'shot-2',
        description: '内容',
        duration: 5,
        assetRefs: [],
        videos: [],
        order: 0
      },
      {
        id: 'char-2',
        assetName: 'A',
        displayName: 'A',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      llmConfig
    );

    expect(report.riskLevel).toBe('medium');
    expect(report.issues[0].type).toBe('missing_reference');
  });

  it('checkShotConsistency normalizes non-numeric and out-of-range scores', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '{"scores":{"identity":"95","outfit":"oops","style":120},"issues":[]}'
    );

    const normalized = await checkShotConsistency(
      {
        id: 'shot-2b',
        description: '内容',
        duration: 5,
        assetRefs: [],
        videos: [],
        order: 0
      },
      {
        id: 'char-2b',
        assetName: 'A',
        displayName: 'A',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      llmConfig
    );

    expect(normalized.score.identity).toBe(95);
    expect(normalized.score.outfit).toBe(0);
    expect(normalized.score.style).toBe(100);
    expect(normalized.score.total).toBe(58);
  });

  it('generateRepairPatch throws when there are no auto-fixable issues', async () => {
    await expect(generateRepairPatch(
      {
        id: 'shot-3',
        description: '内容',
        duration: 5,
        assetRefs: [],
        videos: [],
        order: 0
      },
      {
        id: 'char-3',
        assetName: 'B',
        displayName: 'B',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'r-1',
        shotId: 'shot-3',
        characterId: 'char-3',
        score: { total: 80, identity: 80, outfit: 80, style: 80 },
        riskLevel: 'medium',
        issues: [
          { type: 'style_drift', severity: 'warning', message: 'x', autoFixable: false }
        ],
        generatedAt: 1
      },
      'safe',
      llmConfig
    )).rejects.toThrow('没有可自动修复的问题');
  });

  it('generateRepairPatch returns patch for auto-fixable issues', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '{"after":"修复后文案","changes":["修复服装"],"confidence":0.88,"explanation":"已修复"}'
    );

    const patch = await generateRepairPatch(
      {
        id: 'shot-4',
        description: '原文案',
        duration: 5,
        assetRefs: [],
        videos: [],
        order: 0
      },
      {
        id: 'char-4',
        assetName: 'C',
        displayName: 'C',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'r-2',
        shotId: 'shot-4',
        characterId: 'char-4',
        score: { total: 55, identity: 55, outfit: 55, style: 55 },
        riskLevel: 'high',
        issues: [
          { type: 'outfit_conflict', severity: 'error', message: '冲突', autoFixable: true }
        ],
        generatedAt: 1
      },
      'aggressive',
      llmConfig
    );

    expect(patch.shotId).toBe('shot-4');
    expect(patch.before).toBe('原文案');
    expect(patch.after).toBe('修复后文案');
    expect(patch.status).toBe('pending');
    expect(patch.confidence).toBe(0.88);
  });

  it('generateRepairPatch clamps invalid confidence values', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '{"after":"修复后文案","changes":[],"confidence":"1.8","explanation":"已修复"}'
    );

    const result = await generateRepairPatch(
      {
        id: 'shot-5',
        description: '原文案',
        duration: 5,
        assetRefs: [],
        videos: [],
        order: 0
      },
      {
        id: 'char-5',
        assetName: 'D',
        displayName: 'D',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'r-5',
        shotId: 'shot-5',
        characterId: 'char-5',
        score: { total: 60, identity: 60, outfit: 60, style: 60 },
        riskLevel: 'high',
        issues: [
          { type: 'outfit_conflict', severity: 'error', message: '冲突', autoFixable: true }
        ],
        generatedAt: 1
      },
      'safe',
      llmConfig
    );

    expect(result.confidence).toBe(1);
  });

  it('checkProjectConsistency aggregates reports and emits progress', async () => {
    vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('{"scores":{"identity":95,"outfit":90,"style":90},"issues":[]}')
      .mockResolvedValueOnce('{"scores":{"identity":40,"outfit":40,"style":50},"issues":[{"type":"identity_mismatch","severity":"critical","message":"身份不一致","autoFixable":false}]}');

    const profiles: CharacterProfile[] = [
      {
        id: 'char-a',
        assetName: 'A',
        displayName: 'A',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'char-b',
        assetName: 'B',
        displayName: 'B',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      }
    ];

    const progress = vi.fn();
    const summary = await checkProjectConsistency(
      [
        { id: 's1', description: 'd1', duration: 5, assetRefs: [], videos: [], order: 0 },
        { id: 's2', description: 'd2', duration: 5, assetRefs: [], videos: [], order: 1 }
      ],
      profiles,
      (shotId) => shotId === 's1' ? [profiles[0]] : [profiles[1]],
      llmConfig,
      progress
    );

    expect(summary.totalShots).toBe(2);
    expect(summary.checkedShots).toBe(2);
    expect(summary.reports).toHaveLength(2);
    expect(summary.highRiskShots).toContain('s2');
    expect(progress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('returns perfect score when no shots provided', async () => {
    const summary = await checkProjectConsistency(
      [],
      [],
      () => [],
      llmConfig
    );

    expect(summary.totalShots).toBe(0);
    expect(summary.checkedShots).toBe(0);
    expect(summary.projectScore).toBe(100);
    expect(summary.highRiskShots).toHaveLength(0);
    expect(summary.reports).toHaveLength(0);
  });

  it('returns perfect score when no linked characters for any shot', async () => {
    const summary = await checkProjectConsistency(
      [
        { id: 's1', description: 'd1', duration: 5, assetRefs: [], videos: [], order: 0 }
      ],
      [],
      () => [], // no linked characters
      llmConfig
    );

    expect(summary.totalShots).toBe(1);
    expect(summary.checkedShots).toBe(0);
    expect(summary.projectScore).toBe(100);
  });

  it('extracts character profile with empty description', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue('{}');

    const profile = await extractCharacterProfileFromAsset(
      {
        id: 'asset-empty',
        name: '无名角色',
        type: 'image',
        url: 'https://img',
        description: '',
        createdAt: 1
      },
      llmConfig
    );

    expect(profile.assetName).toBe('无名角色');
    expect(profile.displayName).toBe('无名角色');
    expect(profile.forbiddenTraits).toEqual([]);
  });

  it('handles invalid json in llm response gracefully', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue('invalid json response');

    const report = await checkShotConsistency(
      {
        id: 'shot-invalid',
        description: '内容',
        duration: 5,
        assetRefs: [],
        videos: [],
        order: 0
      },
      {
        id: 'char-invalid',
        assetName: 'A',
        displayName: 'A',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      },
      llmConfig
    );

    expect(report.riskLevel).toBe('medium');
    expect(report.issues[0].type).toBe('missing_reference');
  });
});
