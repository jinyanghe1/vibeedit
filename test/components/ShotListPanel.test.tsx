import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShotListPanel } from '../../src/components/ShotListPanel';
import { useEditorStore } from '../../src/store/editorStore';

vi.mock('../../src/components/ShotCard', () => ({
  ShotCard: ({ shot, onSelect, onEdit }: any) => (
    <div data-testid={`shot-card-${shot.id}`}>
      <span>{shot.description}</span>
      <button onClick={onSelect}>select-{shot.id}</button>
      <button onClick={onEdit}>edit-{shot.id}</button>
    </div>
  )
}));

vi.mock('../../src/components/ShotEditor', () => ({
  ShotEditor: ({ onClose }: any) => (
    <div>
      <span>ShotEditorMock</span>
      <button onClick={onClose}>close-editor</button>
    </div>
  )
}));

vi.mock('../../src/components/AssetManager', () => ({
  AssetManager: () => <div>AssetManagerMock</div>
}));

vi.mock('../../src/components/Settings', () => ({
  Settings: () => <div>SettingsMock</div>
}));

vi.mock('../../src/components/ScriptToShots', () => ({
  ScriptToShots: () => <div>ScriptToShotsMock</div>
}));

vi.mock('../../src/components/WebNovelInspiration', () => ({
  WebNovelInspiration: () => <div>WebNovelInspirationMock</div>
}));

vi.mock('../../src/components/ShotTimeline', () => ({
  ShotTimeline: () => <div>ShotTimelineMock</div>
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => [])
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  },
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn()
}));

const setupBaseState = (overrides?: Record<string, unknown>) => {
  useEditorStore.setState({
    shots: [],
    assets: {},
    selectedShotId: null,
    selectShot: vi.fn(),
    reorderShots: vi.fn(),
    generateAllShots: vi.fn().mockResolvedValue(undefined),
    importProject: vi.fn(),
    ...overrides
  } as any);
};

describe('ShotListPanel Component', () => {
  beforeEach(() => {
    setupBaseState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('supports tab switching from empty state', async () => {
    render(<ShotListPanel />);

    expect(screen.getByText('还没有分镜')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('剧本生成')[0]);
    expect(screen.getByText('ScriptToShotsMock')).toBeInTheDocument();

    await userEvent.click(screen.getByText('网文灵感'));
    expect(screen.getByText('WebNovelInspirationMock')).toBeInTheDocument();
  });

  it('opens and closes shot editor by add button', async () => {
    setupBaseState({
      shots: [
        {
          id: 's1',
          description: '分镜1',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 0
        }
      ]
    });

    render(<ShotListPanel />);
    const addButtons = screen.getAllByRole('button', { name: /添加分镜/i });
    await userEvent.click(addButtons[addButtons.length - 1]);
    expect(screen.getByText('ShotEditorMock')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close-editor/i }));
    expect(screen.queryByText('ShotEditorMock')).not.toBeInTheDocument();
  });

  it('filters shots by tags and supports clear', async () => {
    setupBaseState({
      shots: [
        {
          id: 's1',
          description: '动作镜头',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 0,
          tags: ['动作']
        },
        {
          id: 's2',
          description: '对话镜头',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 1,
          tags: ['对话']
        }
      ]
    });

    render(<ShotListPanel />);
    await userEvent.click(screen.getByRole('button', { name: /筛选/i }));
    await userEvent.click(screen.getByRole('button', { name: '动作' }));

    expect(screen.getByText('显示 1/2 个分镜')).toBeInTheDocument();
    expect(screen.getByText('动作镜头')).toBeInTheDocument();
    expect(screen.queryByText('对话镜头')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(screen.getByText('动作镜头')).toBeInTheDocument();
    expect(screen.getByText('对话镜头')).toBeInTheDocument();
  });

  it('triggers batch generation and reports progress', async () => {
    let resolveTask: (() => void) | null = null;
    const generateAllShots = vi.fn((onProgress?: (current: number, total: number) => void) => {
      onProgress?.(1, 2);
      return new Promise<void>((resolve) => {
        resolveTask = () => {
          onProgress?.(2, 2);
          resolve();
        };
      });
    });

    setupBaseState({
      shots: [
        {
          id: 's1',
          description: '待生成1',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 0
        },
        {
          id: 's2',
          description: '待生成2',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 1
        }
      ],
      generateAllShots
    });

    render(<ShotListPanel />);
    await userEvent.click(screen.getByRole('button', { name: /全部生成\(2\)/i }));

    expect(generateAllShots).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1/2')).toBeInTheDocument();

    await act(async () => {
      resolveTask?.();
    });
    await waitFor(() => {
      expect(screen.queryByText('1/2')).not.toBeInTheDocument();
    });
  });

  it('exports project json and imports valid json file', async () => {
    const importProject = vi.fn();
    setupBaseState({
      shots: [
        {
          id: 's1',
          description: '导出镜头',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 0
        }
      ],
      importProject
    });

    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    const originalURL = globalThis.URL;
    vi.stubGlobal('URL', {
      ...originalURL,
      createObjectURL,
      revokeObjectURL
    } as any);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    class FileReaderMock {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(_file: File) {
        this.onload?.({
          target: {
            result: JSON.stringify({ shots: [], assets: {} })
          }
        } as unknown as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', FileReaderMock as any);

    const { container } = render(<ShotListPanel />);

    await userEvent.click(screen.getByTitle('导出项目 JSON'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'project.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(importProject).toHaveBeenCalledWith([], {});

    vi.stubGlobal('URL', originalURL);
  });

  it('shows alert when imported file content is invalid', async () => {
    setupBaseState();

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    class BadFileReaderMock {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(_file: File) {
        this.onload?.({
          target: {
            result: 'not-json'
          }
        } as unknown as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', BadFileReaderMock as any);

    const { container } = render(<ShotListPanel />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bad'], 'bad.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalledWith('文件解析失败，请检查格式');
  });
});
