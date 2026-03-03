import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScriptToShots } from '../../src/components/ScriptToShots';
import { useEditorStore } from '../../src/store/editorStore';

describe('ScriptToShots Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useEditorStore.setState({
      llmConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: '',
        model: ''
      },
      updateLLMConfig: vi.fn((updates) => {
        useEditorStore.setState((state) => ({
          llmConfig: { ...state.llmConfig, ...updates }
        }));
      }),
      hasLLMConfig: vi.fn(() => false),
      addShots: vi.fn(),
      generateShotsFromScript: vi.fn().mockResolvedValue({
        shots: [
          {
            description: '@小红走进房间',
            duration: 6,
            assetRefs: ['小红']
          },
          {
            description: '镜头切到窗外雨夜',
            duration: 5,
            assetRefs: []
          }
        ],
        summary: '共 2 个分镜（测试）'
      })
    } as any);
  });

  it('初始状态下生成按钮禁用，点击加载示例后可输入内容', async () => {
    render(<ScriptToShots />);

    const generateButton = screen.getByRole('button', { name: /智能生成分镜/i });
    expect(generateButton).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /加载示例/i }));

    const textarea = screen.getByPlaceholderText(/在这里输入你的剧本/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('清晨，小红走在安静的街道上');
    expect(generateButton).not.toBeDisabled();
  });

  it('可完成生成预览并导入分镜', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ScriptToShots />);

    const textarea = screen.getByPlaceholderText(/在这里输入你的剧本/i);
    await userEvent.type(textarea, '测试剧本：主角在雨夜追踪线索。');

    await userEvent.click(screen.getByRole('button', { name: /智能生成分镜/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().generateShotsFromScript).toHaveBeenCalled();
    });

    expect(screen.getByText('生成完成')).toBeInTheDocument();
    expect(screen.getByText('共 2 个分镜（测试）')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /导入全部分镜/i }));

    expect(useEditorStore.getState().addShots).toHaveBeenCalledWith([
      {
        description: '@小红走进房间',
        duration: 6,
        assetRefs: ['小红']
      },
      {
        description: '镜头切到窗外雨夜',
        duration: 5,
        assetRefs: []
      }
    ]);

    expect(alertSpy).toHaveBeenCalledWith('成功导入 2 个分镜！');
    expect(screen.queryByText('生成完成')).not.toBeInTheDocument();

    alertSpy.mockRestore();
  });
});
