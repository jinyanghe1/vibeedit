import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPanel } from '../../src/components/PreviewPanel';

vi.mock('../../src/components/VideoPreview', () => ({
  VideoPreview: () => <div>VideoPreviewMock</div>
}));

vi.mock('../../src/components/AutoEdit', () => ({
  AutoEdit: () => <div>AutoEditMock</div>
}));

vi.mock('../../src/components/PublishPanel', () => ({
  PublishPanel: () => <div>PublishPanelMock</div>
}));

describe('PreviewPanel Component', () => {
  it('defaults to single preview and can switch to auto-edit/publish tabs', async () => {
    render(<PreviewPanel />);

    expect(screen.getByText('VideoPreviewMock')).toBeInTheDocument();

    await userEvent.click(screen.getByText('一键剪辑'));
    expect(screen.getByText('AutoEditMock')).toBeInTheDocument();

    await userEvent.click(screen.getByText('多平台发布'));
    expect(screen.getByText('PublishPanelMock')).toBeInTheDocument();
  });
});
