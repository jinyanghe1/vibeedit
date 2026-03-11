import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bytedanceService from '../../src/services/bytedanceService';
import { ByteDanceLLMService } from '../../src/services/bytedanceService';
import { LLMService } from '../../src/services/llmService';
import { RichTextPreprocessService } from '../../src/services/richTextPreprocessService';
import { WebNovelInspirationService } from '../../src/services/webNovelInspirationService';
import { useEditorStore, useUndo } from '../../src/store/editorStore';

type TemporalApi = {
  undo: () => void;
  redo: () => void;
  clear?: () => void;
  pastStates: unknown[];
  futureStates: unknown[];
};

const getTemporal = () =>
  (useEditorStore as unknown as { temporal: { getState: () => TemporalApi } }).temporal.getState();
const originalGenerateVideo = useEditorStore.getState().generateVideo;

describe('Editor Store', () => {
  beforeEach(() => {
    localStorage.clear();

    // Reset store state before each test
    useEditorStore.setState({
      shots: [],
      assets: {},
      selectedShotId: null,
      selectedVideoId: null,
      generationStatus: {},
      apiConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: 'https://api.example.com/v1'
      },
      llmConfig: {
        provider: 'bytedance',
        apiKey: '',
        apiUrl: 'https://api.example.com/v1',
        model: 'test-model'
      },
      styleConfig: {
        enabled: false,
        styleDescription: '',
        colorPalette: '',
        lighting: '',
        mood: ''
      },
      toneConfig: {
        rhythm: 'moderate',
        colorTone: 'neutral',
        cameraStyle: 'steady',
        narrativeStyle: 'voiceover',
        visualStyle: 'realistic'
      },
      generateVideo: originalGenerateVideo
    });

    getTemporal().clear?.();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Shots actions', () => {
    it('should add a new shot correctly', () => {
      const { addShot } = useEditorStore.getState();
      addShot('This is a test shot without assets', 5);
      
      const { shots } = useEditorStore.getState();
      expect(shots.length).toBe(1);
      expect(shots[0].description).toBe('This is a test shot without assets');
      expect(shots[0].duration).toBe(5);
      expect(shots[0].assetRefs).toEqual([]);
      expect(shots[0].order).toBe(0);
    });

    it('should parse asset references in description correctly', () => {
      const { addShot } = useEditorStore.getState();
      addShot('A cat wearing @hat jumping over {fence} and another @hat', 3);
      
      const { shots } = useEditorStore.getState();
      expect(shots.length).toBe(1);
      expect(shots[0].assetRefs).toEqual(['hat', 'fence']);
    });

    it('should update an existing shot', () => {
      const { addShot, updateShot } = useEditorStore.getState();
      addShot('Initial shot', 2);
      
      let { shots } = useEditorStore.getState();
      const shotId = shots[0].id;
      
      updateShot(shotId, { duration: 4, description: 'Updated shot with @tree' });
      
      shots = useEditorStore.getState().shots;
      expect(shots[0].duration).toBe(4);
      expect(shots[0].description).toBe('Updated shot with @tree');
      expect(shots[0].assetRefs).toEqual(['tree']);
    });

    it('should delete a shot and reorder remaining shots', () => {
      const { addShot, deleteShot } = useEditorStore.getState();
      addShot('Shot 1', 1);
      addShot('Shot 2', 2);
      addShot('Shot 3', 3);
      
      let { shots } = useEditorStore.getState();
      expect(shots.length).toBe(3);
      
      const shotIdToDelete = shots[1].id; // Delete Shot 2
      deleteShot(shotIdToDelete);
      
      shots = useEditorStore.getState().shots;
      expect(shots.length).toBe(2);
      expect(shots[0].description).toBe('Shot 1');
      expect(shots[0].order).toBe(0);
      expect(shots[1].description).toBe('Shot 3');
      expect(shots[1].order).toBe(1); // Should be reordered to 1
    });

    it('should reorder shots based on an array of ids', () => {
      const { addShot, reorderShots } = useEditorStore.getState();
      addShot('Shot 1', 1);
      addShot('Shot 2', 2);
      
      let { shots } = useEditorStore.getState();
      const id1 = shots[0].id;
      const id2 = shots[1].id;
      
      reorderShots([id2, id1]);
      
      shots = useEditorStore.getState().shots;
      expect(shots[0].id).toBe(id2);
      expect(shots[0].order).toBe(0);
      expect(shots[1].id).toBe(id1);
      expect(shots[1].order).toBe(1);
    });
  });

  describe('Assets actions', () => {
    it('should add an asset', () => {
      const { addAsset } = useEditorStore.getState();
      addAsset('cat_image', 'https://example.com/cat.jpg', 'image');
      
      const { assets } = useEditorStore.getState();
      expect(Object.keys(assets).length).toBe(1);
      expect(assets['cat_image']).toBeDefined();
      expect(assets['cat_image'].name).toBe('cat_image');
      expect(assets['cat_image'].type).toBe('image');
      expect(assets['cat_image'].url).toBe('https://example.com/cat.jpg');
    });

    it('should remove an asset', () => {
      const { addAsset, removeAsset } = useEditorStore.getState();
      addAsset('cat_image', 'https://example.com/cat.jpg', 'image');
      
      let { assets } = useEditorStore.getState();
      expect(Object.keys(assets).length).toBe(1);
      
      removeAsset('cat_image');
      
      assets = useEditorStore.getState().assets;
      expect(Object.keys(assets).length).toBe(0);
    });
  });

  describe('Selection actions', () => {
    it('should select a shot', () => {
      const { selectShot, getSelectedShot } = useEditorStore.getState();
      selectShot('fake-id');
      expect(useEditorStore.getState().selectedShotId).toBe('fake-id');
      // Selecting a shot unselects the video
      expect(useEditorStore.getState().selectedVideoId).toBeNull();
    });

    it('should select a video', () => {
      const { selectVideo } = useEditorStore.getState();
      selectVideo('vid-123');
      expect(useEditorStore.getState().selectedVideoId).toBe('vid-123');
    });

    it('should fallback to latest shot video when selectedVideoId is empty', () => {
      useEditorStore.setState({
        shots: [
          {
            id: 'shot-with-videos',
            description: 'test',
            duration: 5,
            assetRefs: [],
            videos: [
              { id: 'v1', shotId: 'shot-with-videos', url: 'u1', prompt: 'p1', createdAt: 1 },
              { id: 'v2', shotId: 'shot-with-videos', url: 'u2', prompt: 'p2', createdAt: 2 }
            ],
            order: 0
          }
        ],
        selectedShotId: 'shot-with-videos',
        selectedVideoId: null
      });

      const selectedVideo = useEditorStore.getState().getSelectedVideo();
      expect(selectedVideo?.id).toBe('v2');
      expect(selectedVideo?.url).toBe('u2');
    });

    it('should not resolve selectedVideoId from a different shot', () => {
      useEditorStore.setState({
        shots: [
          {
            id: 'shot-a',
            description: 'A',
            duration: 5,
            assetRefs: [],
            videos: [
              { id: 'va-1', shotId: 'shot-a', url: 'ua1', prompt: 'pa1', createdAt: 1 }
            ],
            order: 0
          },
          {
            id: 'shot-b',
            description: 'B',
            duration: 5,
            assetRefs: [],
            videos: [
              { id: 'vb-1', shotId: 'shot-b', url: 'ub1', prompt: 'pb1', createdAt: 1 }
            ],
            order: 1
          }
        ],
        selectedShotId: 'shot-a',
        selectedVideoId: 'vb-1'
      });

      const selectedVideo = useEditorStore.getState().getSelectedVideo();
      expect(selectedVideo?.id).toBe('va-1');
      expect(selectedVideo?.url).toBe('ua1');
    });
  });

  describe('API Config actions', () => {
    it('should update api config and save to localStorage', () => {
      const { updateApiConfig, getApiConfig, hasVideoApiKey } = useEditorStore.getState();
      
      expect(hasVideoApiKey()).toBe(false);
      
      updateApiConfig({ apiKey: 'new-api-key', provider: 'bytedance' });
      
      const config = getApiConfig();
      expect(config.apiKey).toBe('new-api-key');
      expect(hasVideoApiKey()).toBe(true);
      
      // Verify localStorage was updated
      const savedConfig = localStorage.getItem('storyboard-editor-config');
      expect(savedConfig).toContain('new-api-key');
    });
  });

  describe('P0 feature robustness', () => {
    it('should persist shots/assets/selection/status to localStorage', () => {
      const { addShot, addAsset, selectShot, selectVideo } = useEditorStore.getState();

      addAsset('hero', 'data:image/png;base64,hero', 'image');
      addShot('主角 @hero 出场', 6);

      const shotId = useEditorStore.getState().shots[0].id;
      useEditorStore.setState({
        generationStatus: { [shotId]: 'success' }
      });
      selectShot(shotId);
      selectVideo('video-1');

      const raw = localStorage.getItem('storyboard-editor-data');
      expect(raw).toBeTruthy();

      const parsed = JSON.parse(raw || '{}') as {
        state?: {
          shots?: unknown[];
          assets?: Record<string, unknown>;
          selectedShotId?: string | null;
          selectedVideoId?: string | null;
          generationStatus?: Record<string, string>;
        };
      };

      expect(parsed.state?.shots).toHaveLength(1);
      expect(parsed.state?.assets?.hero).toBeDefined();
      expect(parsed.state?.selectedShotId).toBe(shotId);
      expect(parsed.state?.selectedVideoId).toBe('video-1');
      expect(parsed.state?.generationStatus?.[shotId]).toBe('success');
    });

    it('should execute generateAllShots in order and skip non-pending shots', async () => {
      const generateVideoMock = vi.fn().mockResolvedValue(undefined);

      useEditorStore.setState({
        shots: [
          {
            id: 'shot-2',
            description: 'shot 2',
            duration: 5,
            assetRefs: [],
            videos: [{ id: 'v1', shotId: 'shot-2', url: 'u', prompt: 'p', createdAt: 1 }],
            order: 1
          },
          {
            id: 'shot-1',
            description: 'shot 1',
            duration: 5,
            assetRefs: [],
            videos: [],
            order: 0
          },
          {
            id: 'shot-3',
            description: 'shot 3',
            duration: 5,
            assetRefs: [],
            videos: [],
            order: 2
          }
        ],
        generationStatus: {
          'shot-3': 'generating'
        },
        generateVideo: generateVideoMock
      });

      const progressSpy = vi.fn();
      await useEditorStore.getState().generateAllShots(progressSpy);

      expect(generateVideoMock).toHaveBeenCalledTimes(1);
      expect(generateVideoMock).toHaveBeenCalledWith('shot-1');
      expect(progressSpy).toHaveBeenNthCalledWith(1, 0, 1);
      expect(progressSpy).toHaveBeenNthCalledWith(2, 1, 1);
    });

    it('should reset selection and status when importing project', () => {
      useEditorStore.setState({
        selectedShotId: 'old-shot',
        selectedVideoId: 'old-video',
        generationStatus: { 'old-shot': 'error' }
      });

      useEditorStore.getState().importProject(
        [
          {
            id: 'new-shot',
            description: 'imported',
            duration: 8,
            assetRefs: [],
            videos: [],
            order: 0
          }
        ],
        {
          role: {
            id: 'asset-1',
            name: 'role',
            type: 'image',
            url: 'data:image/png;base64,role',
            createdAt: 1
          }
        }
      );

      const state = useEditorStore.getState();
      expect(state.shots).toHaveLength(1);
      expect(state.assets.role).toBeDefined();
      expect(state.selectedShotId).toBeNull();
      expect(state.selectedVideoId).toBeNull();
      expect(state.generationStatus).toEqual({});
    });

    it('should support undo and redo with temporal history', () => {
      const { addShot } = useEditorStore.getState();
      addShot('Shot A', 5);
      addShot('Shot B', 6);

      const temporal = getTemporal();
      expect(temporal.pastStates.length).toBeGreaterThan(0);

      temporal.undo();
      expect(useEditorStore.getState().shots).toHaveLength(1);
      expect(useEditorStore.getState().shots[0].description).toBe('Shot A');

      temporal.redo();
      expect(useEditorStore.getState().shots).toHaveLength(2);
      expect(useEditorStore.getState().shots[1].description).toBe('Shot B');
    });

    it('useUndo hook should react to undo/redo availability', () => {
      const { result } = renderHook(() => useUndo());
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);

      act(() => {
        useEditorStore.getState().addShot('Shot A', 5);
      });
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);
    });

    it('should update asset metadata and manage asset insertions', () => {
      const { addAsset, updateAsset, addShot, addAssetInsertion, updateAssetInsertion, removeAssetInsertion } = useEditorStore.getState();
      addAsset('hero', 'https://hero.png', 'image');
      updateAsset('hero', { description: '主角红衣' });
      addShot('镜头 @hero', 5);

      const shotId = useEditorStore.getState().shots[0].id;
      addAssetInsertion(shotId, {
        id: 'ins-1',
        assetId: useEditorStore.getState().assets.hero.id,
        assetName: 'hero',
        mode: 'overlay',
        overlay: {
          position: 'center',
          width: 30,
          height: 30,
          opacity: 0.8,
          startTime: 0,
          endTime: 3,
          zIndex: 2
        }
      });

      updateAssetInsertion(shotId, 'ins-1', { displayDuration: 2 });
      expect(useEditorStore.getState().assets.hero.description).toBe('主角红衣');
      expect(useEditorStore.getState().shots[0].assetInsertions?.[0].displayDuration).toBe(2);

      removeAssetInsertion(shotId, 'ins-1');
      expect(useEditorStore.getState().shots[0].assetInsertions).toEqual([]);
    });

    it('should persist llm config and update style/tone settings', () => {
      const { updateLLMConfig, getLLMConfig, updateStyleConfig, getStyleConfig, updateToneConfig, getToneConfig } = useEditorStore.getState();

      updateLLMConfig({ apiKey: 'llm-key', provider: 'openai' });
      expect(getLLMConfig().provider).toBe('openai');
      expect(getLLMConfig().apiKey).toBe('llm-key');
      expect(localStorage.getItem('storyboard-editor-llm-config')).toContain('llm-key');

      updateStyleConfig({ enabled: true, styleDescription: '胶片风' });
      expect(getStyleConfig().enabled).toBe(true);
      expect(getStyleConfig().styleDescription).toBe('胶片风');

      updateToneConfig({ rhythm: 'fast', visualStyle: 'cinematic' });
      expect(getToneConfig().rhythm).toBe('fast');
      expect(getToneConfig().visualStyle).toBe('cinematic');
    });

    it('should duplicate shot right after original and clear duplicated videos', () => {
      useEditorStore.setState({
        shots: [
          {
            id: 's1',
            description: '原分镜',
            duration: 6,
            assetRefs: [],
            videos: [{ id: 'v1', shotId: 's1', url: 'u', prompt: 'p', createdAt: 1 }],
            order: 0
          },
          {
            id: 's2',
            description: '后续分镜',
            duration: 4,
            assetRefs: [],
            videos: [],
            order: 1
          }
        ]
      });

      useEditorStore.getState().duplicateShot('s1');
      const shots = useEditorStore.getState().shots;

      expect(shots).toHaveLength(3);
      expect(shots[1].description).toBe('原分镜');
      expect(shots[1].videos).toEqual([]);
      expect(shots[2].order).toBe(2);
    });

    it('should route generateShotsFromScript to ByteDance/LLM/mock branches', async () => {
      const bytedanceSpy = vi.spyOn(ByteDanceLLMService.prototype, 'generateFromScript')
        .mockResolvedValue({ shots: [], summary: 'bd' });
      const llmSpy = vi.spyOn(LLMService.prototype, 'generateFromScript')
        .mockResolvedValue({ shots: [], summary: 'llm' });

      useEditorStore.setState({
        llmConfig: { provider: 'bytedance', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });
      await expect(useEditorStore.getState().generateShotsFromScript('剧本')).resolves.toEqual({ shots: [], summary: 'bd' });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });
      await expect(useEditorStore.getState().generateShotsFromScript('剧本')).resolves.toEqual({ shots: [], summary: 'llm' });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: '', apiUrl: 'u', model: 'm' }
      });
      const mockResult = await useEditorStore.getState().generateShotsFromScript('只有一句话');
      expect(mockResult.summary).toContain('模拟模式');

      bytedanceSpy.mockRestore();
      llmSpy.mockRestore();
    });

    it('should route generateShotsFromRichText to ByteDance/LLM/mock branches', async () => {
      const bytedanceSpy = vi.spyOn(ByteDanceLLMService.prototype, 'generateFromRichText')
        .mockResolvedValue({ shots: [], summary: 'bd-rich' });
      const llmSpy = vi.spyOn(LLMService.prototype, 'generateFromRichText')
        .mockResolvedValue({ shots: [], summary: 'llm-rich' });
      const preprocessSpy = vi.spyOn(RichTextPreprocessService.prototype, 'preprocess')
        .mockResolvedValue({
          preprocessedText: 'preprocessed-rich-text',
          summary: 'preprocess-ok',
          metadata: {
            originalLength: 12,
            processedLength: 12,
            lengthRatio: 1,
            detectedGenre: 'analysis',
            rounds: 3,
            infoChecklistCount: 2
          }
        });

      const toneConfig = {
        rhythm: 'moderate' as const,
        colorTone: 'neutral' as const,
        cameraStyle: 'steady' as const,
        narrativeStyle: 'voiceover' as const,
        visualStyle: 'realistic' as const
      };

      useEditorStore.setState({
        llmConfig: { provider: 'bytedance', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });
      await expect(useEditorStore.getState().generateShotsFromRichText('富文本', toneConfig)).resolves.toEqual({ shots: [], summary: 'bd-rich' });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });
      await expect(useEditorStore.getState().generateShotsFromRichText('富文本', toneConfig)).resolves.toEqual({ shots: [], summary: 'llm-rich' });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: '', apiUrl: 'u', model: 'm' }
      });
      const mockResult = await useEditorStore.getState().generateShotsFromRichText('只有一句话', toneConfig);
      expect(mockResult.summary).toContain('模拟模式');

      bytedanceSpy.mockRestore();
      llmSpy.mockRestore();
      preprocessSpy.mockRestore();
    });

    it('should route preprocessRichTextForStoryboard to preprocess service and fallback branch', async () => {
      const preprocessSpy = vi.spyOn(RichTextPreprocessService.prototype, 'preprocess')
        .mockResolvedValue({
          preprocessedText: 'processed',
          summary: 'processed-summary',
          metadata: {
            originalLength: 10,
            processedLength: 10,
            lengthRatio: 1,
            detectedGenre: 'mixed',
            rounds: 3,
            infoChecklistCount: 8
          }
        });

      useEditorStore.setState({
        llmConfig: { provider: 'bytedance', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });
      await expect(useEditorStore.getState().preprocessRichTextForStoryboard('富文本')).resolves.toMatchObject({
        preprocessedText: 'processed',
        summary: 'processed-summary'
      });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });
      await expect(useEditorStore.getState().preprocessRichTextForStoryboard('富文本')).resolves.toMatchObject({
        preprocessedText: 'processed',
        summary: 'processed-summary'
      });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: '', apiUrl: 'u', model: 'm' }
      });
      const mockResult = await useEditorStore.getState().preprocessRichTextForStoryboard('A | B');
      expect(mockResult.summary).toContain('原始文本');
      expect(mockResult.preprocessedText).toContain('A');

      expect(preprocessSpy).toHaveBeenCalledTimes(2);
      preprocessSpy.mockRestore();
    });

    it('should route generateWebNovelInspiration to real service when llm config exists', async () => {
      const serviceSpy = vi.spyOn(WebNovelInspirationService.prototype, 'generate').mockResolvedValue({
        keywords: ['重生'],
        enhancedQueries: ['q1'],
        searchResults: [],
        outline: 'o',
        plotExcerpt: 'p',
        expandedContent: 'c',
        complianceNotice: 'n'
      });

      useEditorStore.setState({
        llmConfig: { provider: 'openai', apiKey: 'k', apiUrl: 'u', model: 'm' }
      });

      const result = await useEditorStore.getState().generateWebNovelInspiration(['重生']);
      expect(result.outline).toBe('o');
      expect(serviceSpy).toHaveBeenCalledTimes(1);
      serviceSpy.mockRestore();
    });

    it('should generate video via bytedance api and reset status to idle', async () => {
      vi.useFakeTimers();
      const videoSpy = vi.spyOn(bytedanceService, 'generateVideoWithByteDance').mockResolvedValue({
        url: 'https://video.mp4',
        prompt: 'prompt'
      });

      useEditorStore.setState({
        shots: [
          {
            id: 'shot-1',
            description: '视频分镜',
            duration: 5,
            assetRefs: [],
            videos: [],
            order: 0
          }
        ],
        apiConfig: { provider: 'bytedance', apiKey: 'video-key', apiUrl: '' }
      });

      await useEditorStore.getState().generateVideo('shot-1');
      expect(videoSpy).toHaveBeenCalledTimes(1);
      expect(useEditorStore.getState().generationStatus['shot-1']).toBe('success');

      await vi.advanceTimersByTimeAsync(3000);
      expect(useEditorStore.getState().generationStatus['shot-1']).toBe('idle');

      vi.useRealTimers();
      videoSpy.mockRestore();
    });

    it('should set error status when video generation fails', async () => {
      const videoSpy = vi.spyOn(bytedanceService, 'generateVideoWithByteDance').mockRejectedValue(new Error('boom'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      useEditorStore.setState({
        shots: [
          {
            id: 'shot-2',
            description: '视频分镜',
            duration: 5,
            assetRefs: [],
            videos: [],
            order: 0
          }
        ],
        apiConfig: { provider: 'bytedance', apiKey: 'video-key', apiUrl: '' }
      });

      await useEditorStore.getState().generateVideo('shot-2');
      expect(useEditorStore.getState().generationStatus['shot-2']).toBe('error');

      videoSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Task14 consistency actions', () => {
    it('should upsert/get/delete character profile and clean links', () => {
      const profile = {
        id: 'char-1',
        assetName: '小红',
        displayName: '小红',
        appearance: { hair: '长发' },
        outfit: { default: '红色汉服', alternatives: ['黑色战斗服'] },
        forbiddenTraits: ['短发'],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      };

      useEditorStore.getState().upsertCharacterProfile(profile);
      expect(useEditorStore.getState().getCharacterProfile('小红')?.id).toBe('char-1');

      useEditorStore.getState().linkCharacterToShot('shot-1', 'char-1');
      expect(useEditorStore.getState().shotCharacterLinks).toHaveLength(1);

      useEditorStore.getState().deleteCharacterProfile('char-1');
      expect(useEditorStore.getState().getCharacterProfile('小红')).toBeUndefined();
      expect(useEditorStore.getState().shotCharacterLinks).toHaveLength(0);
    });

    it('should link/unlink character and avoid duplicate links', () => {
      const profile = {
        id: 'char-2',
        assetName: '小蓝',
        displayName: '小蓝',
        appearance: {},
        outfit: { default: '' },
        forbiddenTraits: [],
        version: 1,
        createdAt: 1,
        updatedAt: 1
      };
      useEditorStore.getState().upsertCharacterProfile(profile);

      useEditorStore.getState().linkCharacterToShot('shot-1', 'char-2');
      useEditorStore.getState().linkCharacterToShot('shot-1', 'char-2');
      expect(useEditorStore.getState().shotCharacterLinks).toHaveLength(1);

      const linked = useEditorStore.getState().getLinkedCharacters('shot-1');
      expect(linked).toHaveLength(1);
      expect(linked[0].assetName).toBe('小蓝');

      useEditorStore.getState().unlinkCharacterFromShot('shot-1', 'char-2');
      expect(useEditorStore.getState().getLinkedCharacters('shot-1')).toHaveLength(0);
    });

    it('should save/get report and manage patch lifecycle', () => {
      useEditorStore.setState({
        shots: [
          {
            id: 'shot-10',
            description: '原描述',
            duration: 5,
            assetRefs: [],
            videos: [],
            order: 0
          }
        ]
      });

      useEditorStore.getState().saveConsistencyReport({
        id: 'report-1',
        shotId: 'shot-10',
        characterId: 'char-10',
        score: { total: 65, identity: 60, outfit: 70, style: 65 },
        riskLevel: 'high',
        issues: [],
        generatedAt: 1
      });
      expect(useEditorStore.getState().getConsistencyReport('shot-10', 'char-10')?.riskLevel).toBe('high');

      useEditorStore.getState().saveConsistencyPatch({
        id: 'patch-1',
        reportId: 'report-1',
        shotId: 'shot-10',
        characterId: 'char-10',
        before: '原描述',
        after: '修复后描述 @hero',
        changes: ['替换服装描述'],
        confidence: 0.9,
        explanation: '修复冲突',
        status: 'pending',
        createdAt: 1
      });

      expect(useEditorStore.getState().getPendingPatches()).toHaveLength(1);
      useEditorStore.getState().applyConsistencyPatch('patch-1');
      expect(useEditorStore.getState().shots[0].description).toBe('修复后描述 @hero');
      expect(useEditorStore.getState().shots[0].assetRefs).toEqual(['hero']);
      expect(useEditorStore.getState().consistencyPatches['patch-1'].status).toBe('applied');
      expect(useEditorStore.getState().consistencyPatches['patch-1'].appliedAt).toBeTypeOf('number');

      useEditorStore.getState().saveConsistencyPatch({
        id: 'patch-2',
        reportId: 'report-1',
        shotId: 'shot-10',
        characterId: 'char-10',
        before: '修复后描述',
        after: '另一个修复',
        changes: [],
        confidence: 0.7,
        explanation: '',
        status: 'pending',
        createdAt: 1
      });
      useEditorStore.getState().rejectConsistencyPatch('patch-2');
      expect(useEditorStore.getState().consistencyPatches['patch-2'].status).toBe('rejected');
    });

    it('should clear all consistency data', () => {
      useEditorStore.setState({
        characterProfiles: {
          a: {
            id: 'a',
            assetName: 'A',
            displayName: 'A',
            appearance: {},
            outfit: { default: '' },
            forbiddenTraits: [],
            version: 1,
            createdAt: 1,
            updatedAt: 1
          }
        },
        consistencyReports: {
          k: {
            id: 'r',
            shotId: 's',
            characterId: 'a',
            score: { total: 90, identity: 90, outfit: 90, style: 90 },
            riskLevel: 'low',
            issues: [],
            generatedAt: 1
          }
        },
        consistencyPatches: {
          p: {
            id: 'p',
            reportId: 'r',
            shotId: 's',
            characterId: 'a',
            before: 'x',
            after: 'y',
            changes: [],
            confidence: 1,
            explanation: '',
            status: 'pending',
            createdAt: 1
          }
        },
        shotCharacterLinks: [{ id: 'l', shotId: 's', characterId: 'a', bindSource: 'manual', createdAt: 1 }]
      });

      useEditorStore.getState().clearAllConsistencyData();
      const state = useEditorStore.getState();
      expect(state.characterProfiles).toEqual({});
      expect(state.consistencyReports).toEqual({});
      expect(state.consistencyPatches).toEqual({});
      expect(state.shotCharacterLinks).toEqual([]);
    });

    it('should support undo after applying patch', () => {
      useEditorStore.setState({
        shots: [
          {
            id: 'shot-patch',
            description: '原始描述',
            duration: 5,
            assetRefs: [],
            videos: [],
            order: 0
          }
        ]
      });

      useEditorStore.getState().saveConsistencyPatch({
        id: 'patch-undo',
        reportId: 'r',
        shotId: 'shot-patch',
        characterId: 'c',
        before: '原始描述',
        after: '修复后描述',
        changes: ['修改'],
        confidence: 0.9,
        explanation: '',
        status: 'pending',
        createdAt: 1
      });

      useEditorStore.getState().applyConsistencyPatch('patch-undo');
      expect(useEditorStore.getState().shots[0].description).toBe('修复后描述');

      // Undo should revert the patch application
      getTemporal().undo();
      expect(useEditorStore.getState().shots[0].description).toBe('原始描述');
    });

    it('should update assetRefs when applying patch with new references', () => {
      useEditorStore.setState({
        shots: [
          {
            id: 'shot-refs',
            description: '描述',
            duration: 5,
            assetRefs: ['hero'],
            videos: [],
            order: 0
          }
        ]
      });

      useEditorStore.getState().saveConsistencyPatch({
        id: 'patch-refs',
        reportId: 'r',
        shotId: 'shot-refs',
        characterId: 'c',
        before: '@hero 动作',
        after: '@hero 和 @villain 对战',
        changes: ['添加反派'],
        confidence: 0.9,
        explanation: '',
        status: 'pending',
        createdAt: 1
      });

      useEditorStore.getState().applyConsistencyPatch('patch-refs');
      expect(useEditorStore.getState().shots[0].assetRefs).toEqual(['hero', 'villain']);
    });
  });
});
