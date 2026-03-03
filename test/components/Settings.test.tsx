import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../../src/components/Settings';
import { useEditorStore } from '../../src/store/editorStore';

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      apiConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: ''
      },
      updateApiConfig: vi.fn(),
      hasVideoApiKey: vi.fn(() => false)
    });
  });

  it('renders closed initially and opens on click', async () => {
    render(<Settings />);
    
    // Initial state: modal not visible
    expect(screen.queryByText('API 设置', { selector: 'h2' })).not.toBeInTheDocument();
    
    // Open modal
    const button = screen.getByRole('button', { name: /API 设置/i });
    await userEvent.click(button);
    
    expect(screen.getByText('API 设置', { selector: 'h2' })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    render(<Settings />);
    await userEvent.click(screen.getByRole('button', { name: /API 设置/i }));
    
    const input = screen.getByPlaceholderText(/输入 ByteDance .* API Key/i);
    expect(input).toHaveAttribute('type', 'password');
    
    // There are a few buttons, we find the one containing Eye icon
    // It's the sibling to the input field
    const toggleButton = input.nextElementSibling as HTMLButtonElement;
    
    // Click to show password
    await userEvent.click(toggleButton);
    expect(input).toHaveAttribute('type', 'text');
    
    // Click to hide password
    await userEvent.click(toggleButton);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('changes provider and updates UI', async () => {
    render(<Settings />);
    await userEvent.click(screen.getByRole('button', { name: /API 设置/i }));
    
    // Switch to Custom API
    const customApiButton = screen.getByText(/自定义 API/i);
    await userEvent.click(customApiButton);
    
    // Hint and placeholder should update
    expect(screen.getByPlaceholderText(/输入 自定义 API/i)).toBeInTheDocument();
    expect(screen.getByText(/默认使用官方 API 地址/i)).toBeInTheDocument();
  });

  it('saves configuration and shows success status briefly', async () => {
    render(<Settings />);
    await userEvent.click(screen.getByRole('button', { name: /API 设置/i }));
    
    const keyInput = screen.getByPlaceholderText(/输入 ByteDance .* API Key/i);
    await userEvent.type(keyInput, 'new-secret-key');
    
    const saveButton = screen.getByRole('button', { name: /保存设置/i });
    await userEvent.click(saveButton);
    
    const state = useEditorStore.getState();
    expect(state.updateApiConfig).toHaveBeenCalledWith({
      provider: 'bytedance',
      apiKey: 'new-secret-key',
      apiUrl: ''
    });
    
    // Button text should change to '已保存'
    expect(screen.getByRole('button', { name: /已保存/i })).toBeInTheDocument();
    
    // Wait for the status to reset
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存设置/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
