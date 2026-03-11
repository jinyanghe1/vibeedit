import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShotTimeline } from '../../src/components/ShotTimeline';
import { useEditorStore } from '../../src/store/editorStore';

describe('ShotTimeline Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      shots: [],
      selectedShotId: null,
      selectShot: vi.fn()
    } as any);
  });

  it('returns null when there are no shots', () => {
    const { container } = render(<ShotTimeline />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows total duration and allows selecting a shot from timeline blocks', async () => {
    const selectShot = vi.fn();
    useEditorStore.setState({
      shots: [
        {
          id: 's1',
          description: '第一镜头',
          duration: 5,
          assetRefs: [],
          videos: [],
          order: 0,
          tags: ['动作']
        },
        {
          id: 's2',
          description: '第二镜头',
          duration: 10,
          assetRefs: [],
          videos: [],
          order: 1
        }
      ],
      selectedShotId: 's1',
      selectShot
    } as any);

    render(<ShotTimeline />);
    expect(screen.getByText('共 15s')).toBeInTheDocument();

    const shotButtons = screen.getAllByRole('button');
    await userEvent.click(shotButtons[1]);

    expect(selectShot).toHaveBeenCalledWith('s2');
  });
});
