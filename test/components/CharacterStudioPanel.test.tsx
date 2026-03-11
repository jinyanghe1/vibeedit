import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterStudioPanel } from '../../src/components/CharacterStudioPanel';
import { useEditorStore } from '../../src/store/editorStore';
import { extractCharacterProfileFromAsset } from '../../src/services/characterConsistencyService';
import type { CharacterProfile } from '../../src/types';

vi.mock('../../src/services/characterConsistencyService', () => ({
  extractCharacterProfileFromAsset: vi.fn()
}));

const createProfile = (overrides: Partial<CharacterProfile> = {}): CharacterProfile => ({
  id: 'char-1',
  assetName: '小红',
  displayName: '小红',
  appearance: { hair: '黑发' },
  outfit: { default: '红衣' },
  forbiddenTraits: ['短发'],
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('CharacterStudioPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useEditorStore.setState({
      assets: {},
      shots: [],
      characterProfiles: {},
      shotCharacterLinks: [],
      llmConfig: {
        provider: 'bytedance',
        apiKey: 'k',
        apiUrl: 'u',
        model: 'm'
      }
    });
  });

  it('generates profile from candidate asset and stores result', async () => {
    useEditorStore.setState({
      assets: {
        小红: {
          id: 'asset-1',
          name: '小红',
          type: 'image',
          url: 'https://img/red.png',
          description: '长发红衣',
          createdAt: 1
        }
      }
    });

    const generated = createProfile();
    vi.mocked(extractCharacterProfileFromAsset).mockResolvedValue(generated);

    render(<CharacterStudioPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '生成档案' }));

    await waitFor(() => {
      expect(extractCharacterProfileFromAsset).toHaveBeenCalledTimes(1);
    });
    expect(useEditorStore.getState().characterProfiles['小红']).toEqual(generated);
  });

  it('shows alert and blocks generation when llm config is missing', async () => {
    useEditorStore.setState({
      assets: {
        小蓝: {
          id: 'asset-2',
          name: '小蓝',
          type: 'image',
          url: 'https://img/blue.png',
          description: '蓝衣角色',
          createdAt: 1
        }
      },
      llmConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: 'u',
        model: 'm'
      }
    });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<CharacterStudioPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '生成档案' }));

    expect(alertSpy).toHaveBeenCalledWith('请先在设置中配置 LLM API Key');
    expect(extractCharacterProfileFromAsset).not.toHaveBeenCalled();
  });

  it('supports editing an existing profile and saving updates', async () => {
    useEditorStore.setState({
      assets: {
        小红: {
          id: 'asset-1',
          name: '小红',
          type: 'image',
          url: 'https://img/red.png',
          createdAt: 1
        }
      },
      characterProfiles: {
        小红: createProfile()
      }
    });

    render(<CharacterStudioPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByTitle('编辑'));

    const displayNameInput = screen.getByDisplayValue('小红');
    await userEvent.clear(displayNameInput);
    await userEvent.type(displayNameInput, '小红-新设定');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    const profile = useEditorStore.getState().characterProfiles['小红'];
    expect(profile.displayName).toBe('小红-新设定');
    expect(profile.updatedAt).toBeGreaterThan(1);
  });

  it('deletes profile by id and cleans linked shot relations', async () => {
    const profile = createProfile({ id: 'char-delete' });
    useEditorStore.setState({
      assets: {
        小红: {
          id: 'asset-1',
          name: '小红',
          type: 'image',
          url: 'https://img/red.png',
          createdAt: 1
        }
      },
      characterProfiles: {
        小红: profile
      },
      shotCharacterLinks: [
        {
          id: 'link-1',
          shotId: 'shot-1',
          characterId: 'char-delete',
          bindSource: 'manual',
          createdAt: 1
        }
      ]
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CharacterStudioPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByTitle('删除'));

    expect(useEditorStore.getState().characterProfiles['小红']).toBeUndefined();
    expect(useEditorStore.getState().shotCharacterLinks).toHaveLength(0);
  });
});
