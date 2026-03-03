import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShotEditor } from '../../src/components/ShotEditor';
import { useEditorStore } from '../../src/store/editorStore';

describe('ShotEditor Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      shots: [
        {
          id: 'existing-shot',
          description: 'A dog jumping',
          duration: 3,
          assetRefs: [],
          order: 0,
          videos: []
        }
      ],
      assets: {
        existingAsset: {
          id: '1',
          name: 'existingAsset',
          type: 'image',
          url: 'http://example.com/asset.jpg',
          createdAt: Date.now()
        }
      },
      addShot: vi.fn(),
      updateShot: vi.fn(),
      getShotById: (id: string) => {
        return useEditorStore.getState().shots.find(s => s.id === id);
      }
    });
  });

  it('renders in add mode by default', () => {
    render(<ShotEditor onClose={mockOnClose} />);
    expect(screen.getByRole('heading', { name: '添加分镜' })).toBeInTheDocument();
    
    // Add button should be disabled initially (empty description)
    const addButton = screen.getByRole('button', { name: /添加分镜/i });
    expect(addButton).toBeDisabled();
  });

  it('renders in edit mode if editShotId is provided', () => {
    render(<ShotEditor editShotId="existing-shot" onClose={mockOnClose} />);
    expect(screen.getByText('编辑分镜')).toBeInTheDocument();
    
    // Check if initial values are loaded
    const textarea = screen.getByPlaceholderText(/描述分镜内容/i);
    expect(textarea).toHaveValue('A dog jumping');
    
    const durationInput = screen.getByRole('spinbutton');
    expect(durationInput).toHaveValue(3);
  });

  it('highlights assets in preview', async () => {
    render(<ShotEditor onClose={mockOnClose} />);
    const textarea = screen.getByPlaceholderText(/描述分镜内容/i);
    
    await userEvent.type(textarea, 'Using @existingAsset and @missingAsset');
    
    // Check preview
    expect(screen.getByText('预览:')).toBeInTheDocument();
    
    // existingAsset should have different class/title than missingAsset
    const existing = screen.getByText('@existingAsset');
    expect(existing).toHaveAttribute('title', '资产已导入');
    
    const missing = screen.getByText('@missingAsset');
    expect(missing).toHaveAttribute('title', '资产未导入');
  });

  it('calls addShot on submit in add mode', async () => {
    render(<ShotEditor onClose={mockOnClose} />);
    const textarea = screen.getByPlaceholderText(/描述分镜内容/i);
    await userEvent.type(textarea, 'New shot description');
    
    const durationInput = screen.getByRole('spinbutton');
    await userEvent.clear(durationInput);
    await userEvent.type(durationInput, '8');
    
    const addButton = screen.getByRole('button', { name: /添加分镜/i });
    expect(addButton).not.toBeDisabled();
    
    await userEvent.click(addButton);
    
    const state = useEditorStore.getState();
    expect(state.addShot).toHaveBeenCalledWith('New shot description', 8);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls updateShot on submit in edit mode', async () => {
    render(<ShotEditor editShotId="existing-shot" onClose={mockOnClose} />);
    const textarea = screen.getByPlaceholderText(/描述分镜内容/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Updated description');
    
    const saveButton = screen.getByRole('button', { name: /保存修改/i });
    await userEvent.click(saveButton);
    
    const state = useEditorStore.getState();
    expect(state.updateShot).toHaveBeenCalledWith('existing-shot', {
      description: 'Updated description',
      duration: 3
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel is clicked', async () => {
    render(<ShotEditor onClose={mockOnClose} />);
    const cancelButton = screen.getByRole('button', { name: /取消/i });
    await userEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
