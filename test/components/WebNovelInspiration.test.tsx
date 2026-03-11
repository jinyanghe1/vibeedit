import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebNovelInspiration } from '../../src/components/WebNovelInspiration';
import { useEditorStore } from '../../src/store/editorStore';

describe('WebNovelInspiration Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      generateWebNovelInspiration: vi.fn().mockResolvedValue({
        keywords: ['重生'],
        enhancedQueries: ['重生逆袭'],
        searchResults: [{ title: 't1', snippet: 's1', url: '#', source: 'Mock' }],
        outline: '这是梗概',
        plotExcerpt: '这是情节片段',
        expandedContent: '这是扩写正文',
        complianceNotice: '仅用于创作启发'
      }),
      hasLLMConfig: vi.fn(() => true)
    } as any);
  });

  it('shows validation error when generating without keyword or direction', async () => {
    render(<WebNovelInspiration />);
    await userEvent.click(screen.getByRole('button', { name: /生成网文灵感/i }));

    expect(screen.getByText('请至少选择一个关键词或输入题材方向')).toBeInTheDocument();
  });

  it('supports generate flow, tab switching and reset', async () => {
    const generateMock = useEditorStore.getState().generateWebNovelInspiration as ReturnType<typeof vi.fn>;
    generateMock.mockImplementation(async (_keywords: string[], _direction: string | undefined, onProgress?: (msg: string) => void) => {
      onProgress?.('正在生成检索词...');
      return {
        keywords: ['重生'],
        enhancedQueries: ['重生逆袭'],
        searchResults: [{ title: 't1', snippet: 's1', url: '#', source: 'Mock' }],
        outline: '这是梗概',
        plotExcerpt: '这是情节片段',
        expandedContent: '这是扩写正文',
        complianceNotice: '仅用于创作启发'
      };
    });

    render(<WebNovelInspiration />);

    await userEvent.click(screen.getByRole('button', { name: '重生' }));
    await userEvent.click(screen.getByRole('button', { name: /生成网文灵感/i }));

    await waitFor(() => {
      expect(generateMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: '故事梗概' })).toBeInTheDocument();
    expect(screen.getByText('这是梗概')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '情节片段' }));
    expect(screen.getByText('这是情节片段')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '扩写正文' }));
    expect(screen.getByText('这是扩写正文')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /重新生成/i }));
    expect(screen.getByRole('button', { name: /生成网文灵感/i })).toBeInTheDocument();
  });

  it('shows error when generation fails', async () => {
    const generateMock = useEditorStore.getState().generateWebNovelInspiration as ReturnType<typeof vi.fn>;
    generateMock.mockRejectedValue(new Error('服务异常'));

    render(<WebNovelInspiration />);
    await userEvent.click(screen.getByRole('button', { name: '重生' }));
    await userEvent.click(screen.getByRole('button', { name: /生成网文灵感/i }));

    await waitFor(() => {
      expect(screen.getByText('服务异常')).toBeInTheDocument();
    });
  });
});
