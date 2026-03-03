import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

describe('Editor Store', () => {
  beforeEach(() => {
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
      }
    });
    localStorage.clear();
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
});
