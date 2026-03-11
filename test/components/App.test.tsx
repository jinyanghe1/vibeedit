import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import App from '../../src/App';

const undo = vi.fn();
const redo = vi.fn();
const useUndoMock = vi.fn(() => ({
  undo,
  redo,
  canUndo: true,
  canRedo: true
}));

vi.mock('../../src/components/ShotListPanel', () => ({
  ShotListPanel: () => <div>ShotListPanelMock</div>
}));

vi.mock('../../src/components/PreviewPanel', () => ({
  PreviewPanel: () => <div>PreviewPanelMock</div>
}));

vi.mock('../../src/store/editorStore', () => ({
  useUndo: () => useUndoMock()
}));

describe('App Component', () => {
  beforeEach(() => {
    undo.mockClear();
    redo.mockClear();
    useUndoMock.mockReset();
    useUndoMock.mockReturnValue({
      undo,
      redo,
      canUndo: true,
      canRedo: true
    });
  });

  it('triggers undo on Ctrl/Cmd + Z and redo on Ctrl/Cmd + Y or Shift+Z', () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });

    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it('does not trigger undo/redo when availability flags are false', () => {
    useUndoMock.mockReturnValueOnce({
      undo,
      redo,
      canUndo: false,
      canRedo: false
    });

    render(<App />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });

    expect(undo).toHaveBeenCalledTimes(0);
    expect(redo).toHaveBeenCalledTimes(0);
  });
});
