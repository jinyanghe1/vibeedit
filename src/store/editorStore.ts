import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { 
  Shot, 
  Asset, 
  Video, 
  GenerationStatus, 
  ApiConfig, 
  LLMConfig, 
  ScriptGenerationResult,
  WebNovelInspirationResult
} from '../types';
import { ByteDanceLLMService, generateVideoWithByteDance } from '../services/bytedanceService';
import { LLMService } from '../services/llmService';
import { WebNovelInspirationService, mockGenerateWebNovelInspiration } from '../services/webNovelInspirationService';

// 从 localStorage 读取 API 配置
const loadApiConfig = (): ApiConfig => {
  try {
    const saved = localStorage.getItem('storyboard-editor-config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return {
    provider: 'bytedance',
    apiKey: '',
    apiUrl: ''
  };
};

// 保存 API 配置到 localStorage
const saveApiConfig = (config: ApiConfig) => {
  try {
    localStorage.setItem('storyboard-editor-config', JSON.stringify(config));
  } catch {
    // ignore
  }
};

// 从 localStorage 读取 LLM 配置
const loadLLMConfig = (): LLMConfig => {
  try {
    const saved = localStorage.getItem('storyboard-editor-llm-config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return {
    provider: 'bytedance',
    apiKey: '',
    apiUrl: '',
    model: ''
  };
};

// 保存 LLM 配置到 localStorage
const saveLLMConfig = (config: LLMConfig) => {
  try {
    localStorage.setItem('storyboard-editor-llm-config', JSON.stringify(config));
  } catch {
    // ignore
  }
};

// Store 状态类型（用于 persist 和 temporal）
interface StoreState {
  shots: Shot[];
  assets: Record<string, Asset>;
  selectedShotId: string | null;
  selectedVideoId: string | null;
  generationStatus: Record<string, GenerationStatus>;
}

interface EditorStore {
  shots: Shot[];
  assets: Record<string, Asset>;
  selectedShotId: string | null;
  selectedVideoId: string | null;
  generationStatus: Record<string, GenerationStatus>;
  apiConfig: ApiConfig;
  llmConfig: LLMConfig;
  
  addShot: (description: string, duration: number) => void;
  addShots: (shots: Array<{ description: string; duration: number; assetRefs?: string[] }>) => void;
  updateShot: (id: string, updates: Partial<Shot>) => void;
  deleteShot: (id: string) => void;
  reorderShots: (shotIds: string[]) => void;
  addAsset: (name: string, url: string, type?: 'image' | 'video') => void;
  removeAsset: (name: string) => void;
  generateVideo: (shotId: string) => Promise<void>;
  selectShot: (shotId: string | null) => void;
  selectVideo: (videoId: string | null) => void;
  updateApiConfig: (config: Partial<ApiConfig>) => void;
  getApiConfig: () => ApiConfig;
  hasVideoApiKey: () => boolean;
  updateLLMConfig: (config: Partial<LLMConfig>) => void;
  getLLMConfig: () => LLMConfig;
  hasLLMConfig: () => boolean;
  generateShotsFromScript: (script: string, onProgress?: (msg: string) => void) => Promise<ScriptGenerationResult>;
  generateWebNovelInspiration: (keywords: string[], direction?: string, onProgress?: (msg: string) => void) => Promise<WebNovelInspirationResult>;
  getShotById: (id: string) => Shot | undefined;
  getSelectedShot: () => Shot | undefined;
  getSelectedVideo: () => Video | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const parseAssetRefs = (description: string): string[] => {
  const refs: string[] = [];
  const regex = /[@{]([^\s{}]+)/g;
  let match;
  while ((match = regex.exec(description)) !== null) {
    refs.push(match[1]);
  }
  return [...new Set(refs)];
};

const mockVideoGenerate = async (
  description: string,
  assetRefs: string[],
  assets: Record<string, Asset>
): Promise<{ url: string; prompt: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  
  let prompt = description;
  const usedAssets: string[] = [];
  
  assetRefs.forEach(ref => {
    if (assets[ref]) {
      usedAssets.push(`${ref}(参考图)`);
    }
  });
  
  if (usedAssets.length > 0) {
    prompt = `${description} | 使用资产: ${usedAssets.join(', ')}`;
  }
  
  return {
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    prompt
  };
};

const mockGenerateFromScript = async (script: string): Promise<ScriptGenerationResult> => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const sentences = script.split(/[。！？.!?]/).filter(s => s.trim().length > 5);
  const shots = sentences.slice(0, Math.min(sentences.length, 8)).map((sentence) => {
    const nameMatches = sentence.match(/[@](\w{2,4})|[\s\n，。]([\u4e00-\u9fa5]{2,4})(?=[\s\n，。])/g) || [];
    const assetRefs = nameMatches
      .map(n => n.replace(/[@\s\n，。]/g, ''))
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .slice(0, 3);
    
    return {
      description: sentence.trim() + '，镜头平稳推进。',
      duration: 5 + Math.floor(Math.random() * 6),
      assetRefs
    };
  });

  return {
    shots: shots.length > 0 ? shots : [
      { description: '场景开场，展示主要环境', duration: 5, assetRefs: [] },
      { description: '主角登场，表情自然', duration: 5, assetRefs: [] },
      { description: '剧情发展，动作流畅', duration: 5, assetRefs: [] }
    ],
    summary: `从剧本生成了 ${shots.length} 个分镜（模拟模式）`
  };
};

// 创建 Store
export const useEditorStore = create<EditorStore>()(
  temporal(
    persist(
      (set, get) => ({
  shots: [],
  assets: {},
  selectedShotId: null,
  selectedVideoId: null,
  generationStatus: {},
  apiConfig: loadApiConfig(),
  llmConfig: loadLLMConfig(),

  addShot: (description: string, duration: number) => {
    const { shots } = get();
    const assetRefs = parseAssetRefs(description);
    
    const newShot: Shot = {
      id: generateId(),
      description,
      duration,
      assetRefs,
      videos: [],
      order: shots.length
    };
    
    set({ shots: [...shots, newShot] });
  },

  addShots: (shotsData: Array<{ description: string; duration: number; assetRefs?: string[] }>) => {
    const { shots } = get();
    const newShots: Shot[] = shotsData.map((data, index) => {
      const assetRefs = data.assetRefs || parseAssetRefs(data.description);
      return {
        id: generateId(),
        description: data.description,
        duration: data.duration,
        assetRefs,
        videos: [],
        order: shots.length + index
      };
    });
    
    set({ shots: [...shots, ...newShots] });
  },

  updateShot: (id: string, updates: Partial<Shot>) => {
    const { shots } = get();
    set({
      shots: shots.map(shot => {
        if (shot.id === id) {
          const updated = { ...shot, ...updates };
          if (updates.description) {
            updated.assetRefs = parseAssetRefs(updated.description);
          }
          return updated;
        }
        return shot;
      })
    });
  },

  deleteShot: (id: string) => {
    const { shots, selectedShotId } = get();
    const filtered = shots.filter(s => s.id !== id);
    const reordered = filtered.map((shot, idx) => ({ ...shot, order: idx }));
    
    set({ 
      shots: reordered,
      selectedShotId: selectedShotId === id ? null : selectedShotId
    });
  },

  reorderShots: (shotIds: string[]) => {
    const { shots } = get();
    const shotMap = new Map(shots.map(s => [s.id, s]));
    const reordered = shotIds
      .map(id => shotMap.get(id))
      .filter((s): s is Shot => !!s)
      .map((shot, idx) => ({ ...shot, order: idx }));
    set({ shots: reordered });
  },

  addAsset: (name: string, url: string, type: 'image' | 'video' = 'image') => {
    const { assets } = get();
    const newAsset: Asset = {
      id: generateId(),
      name,
      type,
      url,
      createdAt: Date.now()
    };
    set({ assets: { ...assets, [name]: newAsset } });
  },

  removeAsset: (name: string) => {
    const { assets } = get();
    const { [name]: _, ...rest } = assets;
    set({ assets: rest });
  },

  generateVideo: async (shotId: string) => {
    const { shots, assets, apiConfig, hasVideoApiKey } = get();
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;

    set(state => ({
      generationStatus: { ...state.generationStatus, [shotId]: 'generating' }
    }));

    try {
      let result: { url: string; prompt: string };
      
      if (hasVideoApiKey() && apiConfig.provider === 'bytedance') {
        result = await generateVideoWithByteDance(
          shot.description,
          shot.assetRefs,
          assets,
          apiConfig
        );
      } else {
        result = await mockVideoGenerate(
          shot.description,
          shot.assetRefs,
          assets
        );
      }

      const newVideo: Video = {
        id: generateId(),
        shotId,
        url: result.url,
        prompt: result.prompt,
        createdAt: Date.now()
      };

      set(state => ({
        shots: state.shots.map(s => {
          if (s.id === shotId) {
            return { ...s, videos: [...s.videos, newVideo] };
          }
          return s;
        }),
        generationStatus: { ...state.generationStatus, [shotId]: 'success' }
      }));

      setTimeout(() => {
        set(state => ({
          generationStatus: { ...state.generationStatus, [shotId]: 'idle' }
        }));
      }, 3000);

    } catch (error) {
      console.error('生成视频失败:', error);
      set(state => ({
        generationStatus: { ...state.generationStatus, [shotId]: 'error' }
      }));
    }
  },

  selectShot: (shotId: string | null) => {
    set({ selectedShotId: shotId, selectedVideoId: null });
  },

  selectVideo: (videoId: string | null) => {
    set({ selectedVideoId: videoId });
  },

  updateApiConfig: (config: Partial<ApiConfig>) => {
    const { apiConfig } = get();
    const newConfig = { ...apiConfig, ...config };
    set({ apiConfig: newConfig });
    saveApiConfig(newConfig);
  },

  getApiConfig: () => {
    return get().apiConfig;
  },

  hasVideoApiKey: () => {
    const { apiConfig } = get();
    return !!apiConfig.apiKey && apiConfig.apiKey.length > 0;
  },

  updateLLMConfig: (config: Partial<LLMConfig>) => {
    const { llmConfig } = get();
    const newConfig = { ...llmConfig, ...config };
    set({ llmConfig: newConfig });
    saveLLMConfig(newConfig);
  },

  getLLMConfig: () => {
    return get().llmConfig;
  },

  hasLLMConfig: () => {
    const { llmConfig } = get();
    return !!llmConfig.apiKey && llmConfig.apiKey.length > 0;
  },

  generateShotsFromScript: async (script: string, onProgress?: (msg: string) => void): Promise<ScriptGenerationResult> => {
    const { llmConfig, hasLLMConfig } = get();
    
    if (hasLLMConfig() && llmConfig.provider === 'bytedance') {
      const service = new ByteDanceLLMService(llmConfig);
      return service.generateFromScript(script, onProgress);
    } else if (hasLLMConfig()) {
      const service = new LLMService(llmConfig);
      return service.generateFromScript(script, onProgress);
    } else {
      onProgress?.('使用模拟模式...');
      return mockGenerateFromScript(script);
    }
  },

  generateWebNovelInspiration: async (keywords: string[], direction?: string, onProgress?: (msg: string) => void): Promise<WebNovelInspirationResult> => {
    const { llmConfig, hasLLMConfig } = get();
    
    console.log('generateWebNovelInspiration called, hasLLMConfig:', hasLLMConfig());
    console.log('llmConfig:', { provider: llmConfig.provider, hasApiKey: !!llmConfig.apiKey, apiUrl: llmConfig.apiUrl });
    
    if (hasLLMConfig()) {
      console.log('Using real WebNovelInspirationService with API calls');
      const service = new WebNovelInspirationService(llmConfig);
      return service.generate(keywords, direction, onProgress);
    } else {
      console.log('Using mock mode - no API key configured');
      onProgress?.('使用模拟模式（未配置API Key）...');
      return mockGenerateWebNovelInspiration(keywords, direction, onProgress);
    }
  },

  getShotById: (id: string) => {
    return get().shots.find(s => s.id === id);
  },

  getSelectedShot: () => {
    const { shots, selectedShotId } = get();
    return shots.find(s => s.id === selectedShotId);
  },

  getSelectedVideo: () => {
    const { shots, selectedVideoId } = get();
    for (const shot of shots) {
      const video = shot.videos.find(v => v.id === selectedVideoId);
      if (video) return video;
    }
    return undefined;
  }
}),
      {
        name: 'storyboard-editor-data',
        partialize: (state): StoreState => ({
          shots: state.shots,
          assets: state.assets,
          selectedShotId: state.selectedShotId,
          selectedVideoId: state.selectedVideoId,
          generationStatus: state.generationStatus
        })
      }
    ),
    {
      limit: 50, // 最多保存 50 步历史
      partialize: (state): StoreState => ({
        shots: state.shots,
        assets: state.assets,
        selectedShotId: state.selectedShotId,
        selectedVideoId: state.selectedVideoId,
        generationStatus: state.generationStatus
      })
    }
  )
);

// Temporal state type
type TemporalState = {
  undo: () => void;
  redo: () => void;
  pastStates: StoreState[];
  futureStates: StoreState[];
};

// Undo/Redo hook — uses zundo temporal store
export const useUndo = () => {
  const store = useEditorStore();
  const temporalStore = (store as unknown as { temporal: TemporalState }).temporal;
  return {
    undo: temporalStore.undo,
    redo: temporalStore.redo,
    canUndo: temporalStore.pastStates.length > 0,
    canRedo: temporalStore.futureStates.length > 0
  };
};
