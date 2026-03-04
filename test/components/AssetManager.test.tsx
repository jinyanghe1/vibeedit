import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetManager } from '../../src/components/AssetManager';
import { useEditorStore } from '../../src/store/editorStore';

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
window.URL.createObjectURL = mockCreateObjectURL;

describe('AssetManager Component', () => {
  beforeEach(() => {
    // Reset Zustand store
    useEditorStore.setState({
      assets: {},
    });
    class MockFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.onload?.({ target: { result: 'data:image/png;base64,mock' } } as unknown as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);
    vi.clearAllMocks();
  });

  it('renders the trigger button initially', () => {
    render(<AssetManager />);
    expect(screen.getByText('导入资产')).toBeInTheDocument();
  });

  it('opens the modal when clicking the trigger button', async () => {
    render(<AssetManager />);
    const button = screen.getByText('导入资产');
    await userEvent.click(button);
    
    expect(screen.getByText('资产管理')).toBeInTheDocument();
    expect(screen.getByText('添加新资产')).toBeInTheDocument();
  });

  it('allows adding and removing an asset', async () => {
    render(<AssetManager />);
    
    // Open modal
    await userEvent.click(screen.getByText('导入资产'));
    
    // Check initial state
    expect(screen.getByText('暂无资产')).toBeInTheDocument();
    
    // Fill in the asset name
    const nameInput = screen.getByPlaceholderText('例如: 小红');
    await userEvent.type(nameInput, 'test_asset');
    
    // Mock file input
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Fire change event directly on input to trigger file selection
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Wait for the add button to become enabled
    const addButton = screen.getByText('添加资产');
    await waitFor(() => expect(addButton).not.toBeDisabled());
    
    // Click add
    await userEvent.click(addButton);
    
    // Verify asset is added to the store and UI
    const state = useEditorStore.getState();
    expect(state.assets['test_asset']).toBeDefined();
    
    // The modal should now show the asset
    expect(screen.getByText('@test_asset')).toBeInTheDocument();
    expect(screen.queryByText('暂无资产')).not.toBeInTheDocument();
    
    // Now remove the asset
    const assetCard = screen.getByText('@test_asset').parentElement;
    const assetRemoveButton = assetCard?.querySelector('button');
    expect(assetRemoveButton).toBeTruthy();
    await userEvent.click(assetRemoveButton as HTMLButtonElement);
    
    // Verify removal
    expect(useEditorStore.getState().assets['test_asset']).toBeUndefined();
    expect(screen.getByText('暂无资产')).toBeInTheDocument();
  });
});
