import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoEdit } from '../../src/components/AutoEdit';
import { useEditorStore } from '../../src/store/editorStore';

describe('AutoEdit Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      shots: []
    } as any);
  });

  it('shows disabled start button when there are no shots', () => {
    render(<AutoEdit />);

    expect(screen.getByText('一键剪辑')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /开始一键剪辑/i })).toBeDisabled();
  });

  it('builds clip sequence, supports clip switching, and closes editor', async () => {
    useEditorStore.setState({
      shots: [
        {
          id: 's1',
          description: '第一镜头',
          duration: 5,
          assetRefs: [],
          order: 0,
          videos: [{ id: 'v1', shotId: 's1', url: 'https://a.mp4', prompt: 'p1', createdAt: 1 }]
        },
        {
          id: 's2',
          description: '第二镜头',
          duration: 8,
          assetRefs: [],
          order: 1,
          videos: [{ id: 'v2', shotId: 's2', url: 'https://b.mp4', prompt: 'p2', createdAt: 2 }]
        }
      ]
    } as any);

    const { container } = render(<AutoEdit />);
    await userEvent.click(screen.getByRole('button', { name: /开始一键剪辑/i }));

    expect(screen.getByText('片段 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('总时长: 13s')).toBeInTheDocument();
    expect(screen.getByText(/#1 第一镜头/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /第二镜头/i }));
    expect(screen.getByText('片段 2 / 2')).toBeInTheDocument();

    const video = container.querySelector('video') as HTMLVideoElement;
    fireEvent.ended(video);
    expect(screen.getByText('片段 1 / 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.getByRole('button', { name: /开始一键剪辑/i })).toBeInTheDocument();
  }, 10000);
});
