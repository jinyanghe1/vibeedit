import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsistencyInspector } from '../../src/components/ConsistencyInspector';
import { useEditorStore } from '../../src/store/editorStore';
import {
  checkShotConsistency,
  generateRepairPatch
} from '../../src/services/characterConsistencyService';
import type {
  CharacterProfile,
  ConsistencyPatch,
  ConsistencyReport,
  Shot
} from '../../src/types';

vi.mock('../../src/services/characterConsistencyService', () => ({
  checkShotConsistency: vi.fn(),
  generateRepairPatch: vi.fn()
}));

const shot: Shot = {
  id: 'shot-1',
  description: '主角 @小红 冲进战场',
  duration: 5,
  assetRefs: ['小红'],
  videos: [],
  order: 0
};

const profile: CharacterProfile = {
  id: 'char-1',
  assetName: '小红',
  displayName: '小红',
  appearance: {},
  outfit: { default: '红色汉服' },
  forbiddenTraits: [],
  version: 1,
  createdAt: 1,
  updatedAt: 1
};

const report: ConsistencyReport = {
  id: 'report-1',
  shotId: 'shot-1',
  characterId: 'char-1',
  score: { total: 82, identity: 80, outfit: 85, style: 81 },
  riskLevel: 'medium',
  issues: [
    {
      type: 'outfit_conflict',
      severity: 'error',
      message: '服装不一致',
      suggestedFix: '改回红色汉服',
      autoFixable: true
    }
  ],
  generatedAt: 1
};

const patch: ConsistencyPatch = {
  id: 'patch-1',
  reportId: 'report-1',
  shotId: 'shot-1',
  characterId: 'char-1',
  before: '主角 @小红 冲进战场',
  after: '主角 @小红 身穿红色汉服冲进战场',
  changes: ['修复服装设定'],
  confidence: 0.9,
  explanation: '修复服装冲突',
  status: 'pending',
  createdAt: 1
};

describe('ConsistencyInspector', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useEditorStore.setState({
      shots: [shot],
      assets: {},
      characterProfiles: { 小红: profile },
      shotCharacterLinks: [
        {
          id: 'link-1',
          shotId: 'shot-1',
          characterId: 'char-1',
          bindSource: 'manual',
          createdAt: 1
        }
      ],
      consistencyReports: {},
      consistencyPatches: {},
      llmConfig: {
        provider: 'bytedance',
        apiKey: 'k',
        apiUrl: 'u',
        model: 'm'
      }
    });
  });

  it('runs consistency check and stores report when selecting a character', async () => {
    vi.mocked(checkShotConsistency).mockResolvedValue(report);

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));

    await waitFor(() => {
      expect(checkShotConsistency).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shot-1' }),
        expect.objectContaining({ id: 'char-1' }),
        expect.objectContaining({ apiKey: 'k' })
      );
    });
    expect(useEditorStore.getState().consistencyReports['shot-1_char-1']).toEqual(report);
    expect(screen.getByText('中风险')).toBeInTheDocument();
    expect(screen.getByText('发现问题 (1)')).toBeInTheDocument();
  });

  it('prefers existing report view and skips duplicated check call', async () => {
    useEditorStore.setState({
      consistencyReports: {
        'shot-1_char-1': report
      }
    });

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));

    expect(checkShotConsistency).not.toHaveBeenCalled();
    expect(screen.getByText('发现问题 (1)')).toBeInTheDocument();
  });

  it('generates repair patch from report and saves patch to store', async () => {
    useEditorStore.setState({
      consistencyReports: {
        'shot-1_char-1': report
      }
    });
    vi.mocked(generateRepairPatch).mockResolvedValue(patch);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));
    await userEvent.click(screen.getByRole('button', { name: /一键修复/i }));

    await waitFor(() => {
      expect(generateRepairPatch).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shot-1' }),
        expect.objectContaining({ id: 'char-1' }),
        expect.objectContaining({ id: 'report-1' }),
        'safe',
        expect.objectContaining({ apiKey: 'k' })
      );
    });
    expect(useEditorStore.getState().consistencyPatches['patch-1']).toEqual(patch);
    expect(alertSpy).toHaveBeenCalledWith('修复补丁已生成，置信度: 90%');
  });

  it('shows llm warning and blocks checking when llm config is missing', async () => {
    useEditorStore.setState({
      llmConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: 'u',
        model: 'm'
      }
    });

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    expect(screen.getByText('请在设置中配置 LLM API Key 以使用一致性检查功能')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /小红/i }));
    expect(checkShotConsistency).not.toHaveBeenCalled();
  });

  it('renders fallback when shot is not found', () => {
    render(<ConsistencyInspector shotId="not-exist" onClose={vi.fn()} />);
    expect(screen.getByText('分镜不存在')).toBeInTheDocument();
  });

  it('shows empty state when no linked characters', async () => {
    useEditorStore.setState({
      shotCharacterLinks: []
    });

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    expect(screen.getByText('此分镜未关联任何角色')).toBeInTheDocument();
    expect(screen.getByText('在描述中使用 @角色名 引用资产')).toBeInTheDocument();
  });

  it('expands issue details when clicking on issue item', async () => {
    useEditorStore.setState({
      consistencyReports: {
        'shot-1_char-1': report
      }
    });

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));
    
    // Click on issue to expand
    await userEvent.click(screen.getByText('服装不一致'));
    expect(screen.getByText('建议：改回红色汉服')).toBeInTheDocument();
    expect(screen.getByText('可自动修复')).toBeInTheDocument();
  });

  it('re-checks and updates report when clicking re-check button', async () => {
    useEditorStore.setState({
      consistencyReports: {
        'shot-1_char-1': report
      }
    });
    
    const updatedReport = { ...report, score: { total: 95, identity: 95, outfit: 95, style: 95 }, riskLevel: 'low' as const };
    vi.mocked(checkShotConsistency).mockResolvedValue(updatedReport);

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));
    await userEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(checkShotConsistency).toHaveBeenCalledTimes(1);
    });
    expect(useEditorStore.getState().consistencyReports['shot-1_char-1'].score.total).toBe(95);
  });

  it('disables fix button when no auto-fixable issues exist', async () => {
    const noFixReport = {
      ...report,
      issues: [{ ...report.issues[0], autoFixable: false }]
    };
    useEditorStore.setState({
      consistencyReports: {
        'shot-1_char-1': noFixReport
      }
    });

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));
    
    expect(screen.queryByRole('button', { name: /一键修复/i })).not.toBeInTheDocument();
  });

  it('shows loading state during consistency check', async () => {
    let resolveCheck!: (value: ConsistencyReport) => void;
    vi.mocked(checkShotConsistency).mockImplementation(
      () =>
        new Promise<ConsistencyReport>((resolve) => {
          resolveCheck = resolve;
        })
    );

    render(<ConsistencyInspector shotId="shot-1" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /小红/i }));

    expect(screen.getByRole('button', { name: /小红/i })).toBeDisabled();

    resolveCheck(report);
    await waitFor(() => {
      expect(screen.getByText('中风险')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /小红/i })).not.toBeDisabled();
  });
});
