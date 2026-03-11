import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextToShots } from '../../src/components/RichTextToShots';
import { useEditorStore } from '../../src/store/editorStore';

vi.mock('../../src/components/RichTextEditor', () => ({
  createInitialValue: () => [{ type: 'paragraph', children: [{ text: '' }] }],
  RichTextEditor: ({ onChange, placeholder }: { onChange: (value: unknown) => void; placeholder?: string }) => (
    <textarea
      aria-label="richtext-input"
      placeholder={placeholder}
      onChange={(e) => onChange([{ type: 'paragraph', children: [{ text: e.target.value }] }])}
    />
  )
}));

describe('RichTextToShots Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useEditorStore.setState({
      llmConfig: {
        provider: 'bytedance',
        apiKey: 'k',
        apiUrl: 'u',
        model: 'm'
      },
      hasLLMConfig: vi.fn(() => true),
      preprocessRichTextForStoryboard: vi.fn().mockResolvedValue({
        preprocessedText: '预处理后稿件',
        summary: '长度比例 1.00，信息密度保持在可接受范围。',
        detectedFacts: [
          { id: 'F1', fact: '背景信息' },
          { id: 'F2', fact: '实施条件' }
        ],
        coverageChecklist: [
          { factId: 'F1', kept: true, evidence: '第1段保留背景信息' },
          { factId: 'F2', kept: false, evidence: '缺失实施条件' }
        ],
        adjustments: ['补回 F2 信息'],
        metadata: {
          originalLength: 100,
          processedLength: 100,
          lengthRatio: 1,
          detectedGenre: 'analysis',
          rounds: 3,
          infoChecklistCount: 10
        },
        qualityReport: {
          rounds: [
            {
              round: 1,
              writerSummary: '先构建问题背景与政策主线',
              auditorVerdict: 'revise',
              auditorAdvice: '补齐实施条件并增加结尾行动锚点',
              lengthRatio: 0.96,
              coverage: 0.82,
              shotAnchorCount: 2,
              passed: false
            },
            {
              round: 2,
              writerSummary: '补齐实施条件并强化分段锚点',
              auditorVerdict: 'pass',
              auditorAdvice: '达到阈值',
              lengthRatio: 1,
              coverage: 1,
              shotAnchorCount: 3,
              passed: true
            }
          ],
          finalDecision: 'converged',
          finalReason: '长度、覆盖率和锚点均达标。',
          converged: true,
          bestRound: 2,
          thresholds: {
            lengthRatioMin: 0.9,
            lengthRatioMax: 1.1,
            minCoverage: 0.95,
            minShotAnchors: 3
          }
        }
      }),
      generateShotsFromRichText: vi.fn().mockResolvedValue({
        shots: [
          { description: '@小红进入会场并介绍政策背景', duration: 6, assetRefs: ['小红'] }
        ],
        summary: '共 1 个分镜（测试）'
      }),
      addShots: vi.fn()
    } as any);
  });

  it('auto preprocesses before generation and passes preprocessed text', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '这是原始知识稿件内容');
    await userEvent.click(screen.getByRole('checkbox', { name: /启用覆盖率门禁/i }));

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledWith(
      '预处理后稿件',
      expect.any(Object),
      expect.any(Function)
    );
    expect(screen.getByText(/生成完成/i)).toBeInTheDocument();
  });

  it('supports manual preprocess and shows preprocess summary', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');

    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/文体: analysis/i)).toBeInTheDocument();
    expect(screen.getAllByText(/信息密度保持在可接受范围/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/预处理质检报告/)).toBeInTheDocument();
    expect(screen.getByText(/已收敛/)).toBeInTheDocument();
    expect(screen.getByText(/长度比 1.00 · 覆盖率 100% · 锚点 3/)).toBeInTheDocument();
    expect(screen.getByText('预处理后稿件')).toBeInTheDocument();
    expect(screen.getByText(/原文（预处理输入）/i)).toBeInTheDocument();
    expect(screen.getByText(/信息覆盖率明细/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'F1' })).toBeInTheDocument();
    expect(screen.getByText(/补回 F2 信息/)).toBeInTheDocument();
    expect(screen.getByText(/第1段保留背景信息/)).toBeInTheDocument();
    expect(screen.getByText(/覆盖率汇总/)).toBeInTheDocument();
    expect(screen.getByText(/1\/2 已覆盖/)).toBeInTheDocument();
    expect(screen.getByText(/证据定位词/i)).toBeInTheDocument();
    expect(screen.getByText(/定位命中：原文/i)).toBeInTheDocument();
    expect(screen.getByText(/预处理版本快照/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /预处理v1/ })).toBeInTheDocument();
    expect(screen.getAllByText(/未命中|仅原文命中|仅预处理稿命中|双端命中/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('checkbox', { name: /只看缺失项/i }));

    expect(screen.queryByText(/第1段保留背景信息/)).not.toBeInTheDocument();
    expect(screen.getByText(/缺失实施条件/)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/缺失实施条件/).closest('button') as HTMLButtonElement);

    expect(screen.getByText(/当前事实点：/)).toBeInTheDocument();
    expect(screen.getAllByText('实施条件').length).toBeGreaterThan(0);
    expect(screen.getByText(/缺失实施条件/)).toBeInTheDocument();
    expect(screen.getByText(/聚焦覆盖项：F2/)).toBeInTheDocument();
  });

  it('repairs missing facts and uses repaired draft for generation', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');

    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /一键补齐缺失项/i }));

    expect(screen.getByText(/已补齐 1 条缺失事实/)).toBeInTheDocument();
    expect(screen.getByText(/已补齐：F2/)).toBeInTheDocument();
    expect(screen.getByText(/回退补齐/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    const generatedText = vi.mocked(useEditorStore.getState().generateShotsFromRichText).mock.calls[0][0];
    expect(generatedText).toContain('【补充信息】');
    expect(generatedText).toContain('1. 实施条件');
  });

  it('supports snapshot rollback to previous preprocessed version', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');

    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /一键补齐缺失项/i }));
    expect(screen.getByRole('button', { name: /补齐v1/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /回滚到上一版本/i }));

    expect(screen.getByText(/已回滚到 预处理v1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /启用覆盖率门禁/i }));

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    const generatedText = vi.mocked(useEditorStore.getState().generateShotsFromRichText).mock.calls[0][0];
    expect(generatedText).toBe('预处理后稿件');
  });

  it('shows coverage gate warning when below threshold and clears after repair', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');

    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    // 覆盖率 50% < 70% 阈值 → 门禁触发
    expect(screen.getByRole('alert', { name: /覆盖率门禁警告/i })).toBeInTheDocument();
    expect(screen.getByText(/覆盖率门禁：当前覆盖率 50%/)).toBeInTheDocument();
    expect(screen.getByText(/缺失 1 条事实点/)).toBeInTheDocument();

    // 点击门禁区补齐按钮 → 门禁消失
    await userEvent.click(screen.getByRole('button', { name: /补齐 1 项缺失/i }));

    expect(screen.queryByRole('alert', { name: /覆盖率门禁警告/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/覆盖率门禁：当前覆盖率/)).not.toBeInTheDocument();
  });

  it('blocks generation when gate triggered and supports one-time bypass', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');
    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));
    expect(useEditorStore.getState().generateShotsFromRichText).not.toHaveBeenCalled();
    expect(screen.getByText(/覆盖率门禁已触发/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /继续生成（临时忽略门禁）/i }));
    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));
    expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/覆盖率门禁已触发/)).toBeInTheDocument();
  });

  it('blocks importing shots when gate triggered and supports one-time import bypass', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');
    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /继续生成（临时忽略门禁）/i }));
    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('alert', { name: /导入门禁警告/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^导入全部分镜$/ }));

    expect(useEditorStore.getState().addShots).not.toHaveBeenCalled();
    expect(screen.getByText(/导入门禁已触发/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /导入全部分镜（临时忽略门禁）/i }));
    await userEvent.click(screen.getByRole('button', { name: /^导入全部分镜$/ }));

    expect(useEditorStore.getState().addShots).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/生成完成/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /继续生成（临时忽略门禁）/i }));
    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(2);
    });

    await userEvent.click(screen.getByRole('button', { name: /^导入全部分镜$/ }));

    expect(useEditorStore.getState().addShots).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/导入门禁已触发/)).toBeInTheDocument();
  });

  it('shows missing facts list in import gate warning and allows repair before import', async () => {
    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');
    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    // 绕过生成门禁后生成分镜
    await userEvent.click(screen.getByRole('button', { name: /继续生成（临时忽略门禁）/i }));
    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    // F5: 导入门禁警告应展示缺失事实清单
    const gateAlert = screen.getByRole('alert', { name: /导入门禁警告/i });
    expect(within(gateAlert).getByText('F2')).toBeInTheDocument();
    expect(within(gateAlert).getByText('实施条件')).toBeInTheDocument();
    expect(within(gateAlert).getByRole('button', { name: /先补齐再导入/i })).toBeInTheDocument();

    // 点击"先补齐再导入" → 门禁解除 → 可直接导入
    await userEvent.click(within(gateAlert).getByRole('button', { name: /先补齐再导入/i }));

    expect(screen.queryByRole('alert', { name: /导入门禁警告/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^导入全部分镜$/ }));
    expect(useEditorStore.getState().addShots).toHaveBeenCalledTimes(1);
  });

  it('allows direct import when all required facts are referenced by shots', async () => {
    useEditorStore.setState({
      preprocessRichTextForStoryboard: vi.fn().mockResolvedValue({
        preprocessedText: '预处理后稿件',
        summary: '收敛完成',
        detectedFacts: [
          { id: 'F1', fact: '背景信息' },
          { id: 'F2', fact: '实施条件' }
        ],
        coverageChecklist: [
          { factId: 'F1', kept: true, evidence: '保留背景信息' },
          { factId: 'F2', kept: true, evidence: '保留实施条件' }
        ],
        metadata: {
          originalLength: 100,
          processedLength: 100,
          lengthRatio: 1,
          detectedGenre: 'analysis',
          rounds: 2,
          infoChecklistCount: 2
        }
      }),
      generateShotsFromRichText: vi.fn().mockResolvedValue({
        shots: [
          { description: '镜头一：背景与问题铺垫', duration: 6, assetRefs: ['小红'], factRefs: ['F1', 'F2'] }
        ],
        summary: '共 1 个分镜（契约通过）'
      })
    } as any);

    render(<RichTextToShots />);

    const textarea = screen.getByLabelText('richtext-input');
    await userEvent.type(textarea, '原稿件');
    await userEvent.click(screen.getByRole('button', { name: /预处理稿件/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().preprocessRichTextForStoryboard).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromRichText).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/事实-分镜契约/)).toBeInTheDocument();
    expect(screen.getByText(/覆盖 2\/2/)).toBeInTheDocument();
    expect(screen.getByText(/所有必需事实均已被分镜引用/)).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /导入门禁警告/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^导入全部分镜$/ }));
    expect(useEditorStore.getState().addShots).toHaveBeenCalledTimes(1);
  });
});
