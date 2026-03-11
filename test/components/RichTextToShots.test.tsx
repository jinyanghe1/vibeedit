import { render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByDisplayValue('预处理后稿件')).toBeInTheDocument();
    expect(screen.getByText(/原文（预处理输入）/i)).toBeInTheDocument();
    expect(screen.getByText(/信息覆盖率明细/i)).toBeInTheDocument();
    expect(screen.getByText('F1')).toBeInTheDocument();
    expect(screen.getByText(/补回 F2 信息/)).toBeInTheDocument();
  });
});
