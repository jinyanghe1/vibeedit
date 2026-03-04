import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishPanel } from '../../src/components/PublishPanel';
import { useEditorStore } from '../../src/store/editorStore';

describe('PublishPanel Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true
    });

    useEditorStore.setState({
      shots: [],
      llmConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: '',
        model: ''
      }
    });
  });

  it('disables generate button when there are no shots', () => {
    render(<PublishPanel />);
    expect(screen.getByText('生成发布文案')).toBeDisabled();
  });

  it('shows warning for missing videos and missing llm config', () => {
    useEditorStore.setState({
      shots: [
        {
          id: 'shot-1',
          description: '测试分镜',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 0
        }
      ]
    });

    render(<PublishPanel />);

    expect(screen.getByText('还有分镜未生成视频，建议先生成视频后再发布')).toBeInTheDocument();
    expect(screen.getByText('未配置 LLM，将使用模拟数据生成文案')).toBeInTheDocument();
  });

  it('generates publish content via llm api and supports copy', async () => {
    useEditorStore.setState({
      shots: [
        {
          id: 'shot-1',
          description: '主角登场',
          duration: 6,
          assetRefs: [],
          videos: [{ id: 'v1', shotId: 'shot-1', url: 'u', prompt: 'p', createdAt: Date.now() }],
          order: 0
        }
      ],
      llmConfig: {
        provider: 'openai',
        apiKey: 'test-key',
        apiUrl: 'https://example.com/v1/chat/completions',
        model: 'gpt-test'
      }
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: '发布标题',
                  description: '发布描述',
                  tags: ['标签A', '标签B']
                })
              }
            }
          ]
        })
      })
    );

    render(<PublishPanel />);
    await userEvent.click(screen.getByText('生成发布文案'));

    await waitFor(() => {
      expect(screen.getByText('发布标题')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('发布描述')).toBeInTheDocument();
    expect(screen.getByText('#标签A')).toBeInTheDocument();

    const copyButtons = screen.getAllByText('复制');
    await userEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('发布标题');
  });
});
