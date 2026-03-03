import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShotCard } from '../../src/components/ShotCard';
import { useEditorStore } from '../../src/store/editorStore';
import type { Shot, Video } from '../../src/types';

describe('ShotCard Component', () => {
  const mockShot: Shot = {
    id: 'shot-1',
    description: 'A beautiful sunset with @sun',
    duration: 5,
    assetRefs: ['sun'],
    order: 0,
    videos: []
  };

  const mockVideo: Video = {
    id: 'vid-1',
    shotId: 'shot-1',
    url: 'http://example.com/video.mp4',
    prompt: 'test prompt',
    createdAt: Date.now()
  };

  const defaultProps = {
    shot: mockShot,
    isSelected: false,
    onSelect: vi.fn(),
    onEdit: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      assets: {
        sun: {
          id: 'asset-1',
          name: 'sun',
          type: 'image',
          url: 'http://example.com/sun.jpg',
          createdAt: Date.now()
        }
      },
      generationStatus: {},
      selectedVideoId: null,
      generateVideo: vi.fn(),
      deleteShot: vi.fn(),
      selectVideo: vi.fn()
    });
    // Mock global confirm
    window.confirm = vi.fn(() => true);
  });

  it('renders shot information correctly', () => {
    render(<ShotCard {...defaultProps} />);
    
    // Check order and duration
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('5s')).toBeInTheDocument();
    
    // Check description highlighting
    expect(screen.getAllByText('@sun')[0]).toBeInTheDocument();
  });

  it('calls onSelect when description is clicked', async () => {
    render(<ShotCard {...defaultProps} />);
    
    // The description is split into parts, we click the part that is not an asset ref
    const descriptionText = screen.getByText('A beautiful sunset with');
    await userEvent.click(descriptionText);
    
    expect(defaultProps.onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows menu and can trigger edit', async () => {
    render(<ShotCard {...defaultProps} />);
    
    // Open menu
    // The menu button contains MoreVertical icon
    const menuButton = screen.getByRole('button', { name: '' }); 
    // Wait, let's find the button by its child SVG or class
    const buttons = screen.getAllByRole('button');
    // The first button in the component is the menu button (excluding generate button which is further down)
    await userEvent.click(buttons[0]);
    
    // Now menu should be visible
    const editButton = screen.getByText('编辑');
    expect(editButton).toBeInTheDocument();
    
    await userEvent.click(editButton);
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows menu and can trigger delete', async () => {
    render(<ShotCard {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]); // Open menu
    
    const deleteButton = screen.getByText('删除');
    await userEvent.click(deleteButton);
    
    expect(window.confirm).toHaveBeenCalledWith('确定要删除这个分镜吗？');
    const state = useEditorStore.getState();
    expect(state.deleteShot).toHaveBeenCalledWith('shot-1');
  });

  it('calls generateVideo when generate button is clicked', async () => {
    render(<ShotCard {...defaultProps} />);
    
    // "模拟生成" or "创作分镜shot" depending on API key status
    // Default is mock (模拟生成) since API key is empty in setup
    const generateButton = screen.getByText('模拟生成');
    await userEvent.click(generateButton);
    
    const state = useEditorStore.getState();
    expect(state.generateVideo).toHaveBeenCalledWith('shot-1');
  });

  it('renders video selector if videos exist', async () => {
    const shotWithVideos = { ...mockShot, videos: [mockVideo] };
    render(<ShotCard {...defaultProps} shot={shotWithVideos} />);
    
    // Find the video dropdown trigger button (it contains '1' as text for 1 video)
    const videoDropdownButton = screen.getByText('1').closest('button');
    expect(videoDropdownButton).toBeInTheDocument();
    
    await userEvent.click(videoDropdownButton!);
    
    // Dropdown should show '版本 1'
    const versionButton = screen.getByText('版本 1');
    expect(versionButton).toBeInTheDocument();
    
    await userEvent.click(versionButton);
    const state = useEditorStore.getState();
    expect(state.selectVideo).toHaveBeenCalledWith('vid-1');
    expect(defaultProps.onSelect).toHaveBeenCalledTimes(1);
  });
});
