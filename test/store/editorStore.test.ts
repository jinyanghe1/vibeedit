import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
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
      }
    });

    getTemporal().clear?.();
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
  });
});
