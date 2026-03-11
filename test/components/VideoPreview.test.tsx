import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPreview } from '../../src/components/VideoPreview';
import { useEditorStore } from '../../src/store/editorStore';
import type { Shot } from '../../src/types';

const originalGetSelectedShot = useEditorStore.getState().getSelectedShot;
const originalGetSelectedVideo = useEditorStore.getState().getSelectedVideo;

const createShot = (videos: Array<{ id: string; url: string }>): Shot => ({
  id: 'shot-1',
  description: '雨夜追逐',
  duration: 6,
  assetRefs: [],
  order: 0,
  videos: videos.map((v, index) => ({
    id: v.id,
    shotId: 'shot-1',
    url: v.url,
    prompt: `p-${index}`,
    createdAt: index + 1
  }))
});

describe('VideoPreview Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      shots: [],
      selectedShotId: null,
      selectedVideoId: null,
      getSelectedShot: originalGetSelectedShot,
      getSelectedVideo: originalGetSelectedVideo
    } as any);

    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function play() {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {
      this.dispatchEvent(new Event('pause'));
    });
  });

  it('renders empty state when no shot is selected', () => {
    useEditorStore.setState({
      getSelectedShot: vi.fn(() => undefined),
      getSelectedVideo: vi.fn(() => undefined),
      selectedVideoId: null
    } as any);

    render(<VideoPreview />);
    expect(screen.getByText('选择一个分镜进行预览')).toBeInTheDocument();
  });

  it('renders no-video state when selected shot has no selected video', () => {
    const shot = createShot([]);
    useEditorStore.setState({
      getSelectedShot: vi.fn(() => shot),
      getSelectedVideo: vi.fn(() => undefined),
      selectedVideoId: null
    } as any);

    render(<VideoPreview />);
    expect(screen.getByText('该分镜暂无视频')).toBeInTheDocument();
    expect(screen.getByText('雨夜追逐')).toBeInTheDocument();
  });

  it('supports time update/seek and A-B compare toggling', async () => {
    const shot = createShot([
      { id: 'v1', url: 'https://a.mp4' },
      { id: 'v2', url: 'https://b.mp4' }
    ]);
    useEditorStore.setState({
      getSelectedShot: vi.fn(() => shot),
      getSelectedVideo: vi.fn(() => shot.videos[0]),
      selectedVideoId: 'v1'
    } as any);

    const { container } = render(<VideoPreview />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const range = screen.getByRole('slider') as HTMLInputElement;

    Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
    fireEvent.loadedMetadata(video);
    expect(screen.getByText('1:40')).toBeInTheDocument();

    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 12 });
    fireEvent.timeUpdate(video);
    expect(screen.getByText('0:12')).toBeInTheDocument();

    fireEvent.change(range, { target: { value: '50' } });
    expect(video.currentTime).toBe(50);

    await userEvent.click(screen.getByRole('button', { name: /A\/B 对比/i }));
    expect(screen.getByText('版本 A（当前）')).toBeInTheDocument();
    expect(screen.getByText('版本 B（2）')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /退出对比/i }));
    expect(screen.queryByText('版本 A（当前）')).not.toBeInTheDocument();
  });

  it('renders latest video when only shot is selected', () => {
    const shot = createShot([
      { id: 'v1', url: 'https://a.mp4' },
      { id: 'v2', url: 'https://b.mp4' }
    ]);

    useEditorStore.setState({
      shots: [shot],
      selectedShotId: 'shot-1',
      selectedVideoId: null,
      getSelectedShot: originalGetSelectedShot,
      getSelectedVideo: originalGetSelectedVideo
    } as any);

    const { container } = render(<VideoPreview />);
    expect(screen.queryByText('该分镜暂无视频')).not.toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2 版本/)).toBeInTheDocument();

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('https://b.mp4');
  });

  it('does not use video from another shot when selectedVideoId is stale', () => {
    const shotA = createShot([]);
    const shotB = {
      ...createShot([{ id: 'vb-1', url: 'https://b.mp4' }]),
      id: 'shot-2',
      order: 1,
      videos: [{ id: 'vb-1', shotId: 'shot-2', url: 'https://b.mp4', prompt: 'p', createdAt: 1 }]
    };

    useEditorStore.setState({
      shots: [shotA, shotB],
      selectedShotId: 'shot-1',
      selectedVideoId: 'vb-1',
      getSelectedShot: originalGetSelectedShot,
      getSelectedVideo: originalGetSelectedVideo
    } as any);

    render(<VideoPreview />);
    expect(screen.getByText('该分镜暂无视频')).toBeInTheDocument();
  });
});
