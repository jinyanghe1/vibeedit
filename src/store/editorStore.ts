import { temporal } from 'zundo';
import { create, useStore, type StoreApi } from 'zustand';
import { persist } from 'zustand/middleware';
import { ByteDanceLLMService, generateVideoWithByteDance } from '../services/bytedanceService';
import { LLMService } from '../services/llmService';
import { WebNovelInspirationService, mockGenerateWebNovelInspiration } from '../services/webNovelInspirationService';
import type {
    ApiConfig,
    Asset,
    AssetType,
    CharacterProfile,
    ConsistencyPatch,
    ConsistencyReport,
    GenerationStatus,
    LLMConfig,
    ScriptGenerationResult,
    Shot,
    ShotAssetInsertion,
    ShotCharacterLink,
    ShotTag,
    StyleConfig,
    TextCard,
    ToneConfig,
    Video,
    WebNovelInspirationResult
} from '../types';

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
  styleConfig: StyleConfig;
  toneConfig: ToneConfig;
  // Task 14: 角色一致性引擎状态
  characterProfiles: Record<string, CharacterProfile>;
  consistencyReports: Record<string, ConsistencyReport>;
  consistencyPatches: Record<string, ConsistencyPatch>;
  shotCharacterLinks: ShotCharacterLink[];
}

interface EditorStore {
  shots: Shot[];
  assets: Record<string, Asset>;
  selectedShotId: string | null;
  selectedVideoId: string | null;
  generationStatus: Record<string, GenerationStatus>;
  apiConfig: ApiConfig;
  llmConfig: LLMConfig;
  styleConfig: StyleConfig;
  toneConfig: ToneConfig;
  // Task 14: 角色一致性引擎状态
  characterProfiles: Record<string, CharacterProfile>;
  consistencyReports: Record<string, ConsistencyReport>;
  consistencyPatches: Record<string, ConsistencyPatch>;
  shotCharacterLinks: ShotCharacterLink[];
  
  addShot: (description: string, duration: number, tags?: ShotTag[]) => void;
  addShots: (shots: Array<{ description: string; duration: number; assetRefs?: string[] }>) => void;
  updateShot: (id: string, updates: Partial<Shot>) => void;
  deleteShot: (id: string) => void;
  reorderShots: (shotIds: string[]) => void;
  addAsset: (name: string, url: string, type?: AssetType, description?: string, textCardData?: TextCard) => void;
  removeAsset: (name: string) => void;
  updateAsset: (name: string, updates: Partial<Asset>) => void;
  generateVideo: (shotId: string) => Promise<void>;
  selectShot: (shotId: string | null) => void;
  selectVideo: (videoId: string | null) => void;
  updateApiConfig: (config: Partial<ApiConfig>) => void;
  getApiConfig: () => ApiConfig;
  hasVideoApiKey: () => boolean;
  updateLLMConfig: (config: Partial<LLMConfig>) => void;
  getLLMConfig: () => LLMConfig;
  hasLLMConfig: () => boolean;
  updateStyleConfig: (config: Partial<StyleConfig>) => void;
  getStyleConfig: () => StyleConfig;
  updateToneConfig: (config: Partial<ToneConfig>) => void;
  getToneConfig: () => ToneConfig;
  addAssetInsertion: (shotId: string, insertion: ShotAssetInsertion) => void;
  removeAssetInsertion: (shotId: string, insertionId: string) => void;
  updateAssetInsertion: (shotId: string, insertionId: string, updates: Partial<ShotAssetInsertion>) => void;
  generateShotsFromScript: (script: string, onProgress?: (msg: string) => void) => Promise<ScriptGenerationResult>;
  generateShotsFromRichText: (markdown: string, toneConfig: ToneConfig, onProgress?: (msg: string) => void) => Promise<ScriptGenerationResult>;
  generateWebNovelInspiration: (keywords: string[], direction?: string, onProgress?: (msg: string) => void) => Promise<WebNovelInspirationResult>;
  getShotById: (id: string) => Shot | undefined;
  getSelectedShot: () => Shot | undefined;
  getSelectedVideo: () => Video | undefined;
  importProject: (shots: Shot[], assets: Record<string, Asset>) => void;
  generateAllShots: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  duplicateShot: (id: string) => void;
  // Task 14: 角色一致性引擎 Actions
  upsertCharacterProfile: (profile: CharacterProfile) => void;
  deleteCharacterProfile: (profileId: string) => void;
  linkCharacterToShot: (shotId: string, characterId: string) => void;
  unlinkCharacterFromShot: (shotId: string, characterId: string) => void;
  getCharacterProfile: (assetName: string) => CharacterProfile | undefined;
  getLinkedCharacters: (shotId: string) => CharacterProfile[];
  saveConsistencyReport: (report: ConsistencyReport) => void;
  getConsistencyReport: (shotId: string, characterId: string) => ConsistencyReport | undefined;
  saveConsistencyPatch: (patch: ConsistencyPatch) => void;
  applyConsistencyPatch: (patchId: string) => void;
  rejectConsistencyPatch: (patchId: string) => void;
  getPendingPatches: () => ConsistencyPatch[];
  clearAllConsistencyData: () => void;
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
  assets: Record<string, Asset>,
  styleConfig?: StyleConfig
): Promise<{ url: string; prompt: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  
  let prompt = description;
  const usedAssets: string[] = [];
  
  assetRefs.forEach(ref => {
    if (assets[ref]) {
      // Inject character description if available
      const charDesc = assets[ref].description;
      usedAssets.push(charDesc ? `${ref}(${charDesc})` : `${ref}(参考图)`);
    }
  });
  
  if (usedAssets.length > 0) {
    prompt = `${description} | 角色设定: ${usedAssets.join(', ')}`;
  }
  
  // Inject global style if enabled
  if (styleConfig?.enabled && styleConfig.styleDescription) {
    prompt += ` | 画面风格: ${styleConfig.styleDescription}`;
    if (styleConfig.colorPalette) prompt += `, 色调: ${styleConfig.colorPalette}`;
    if (styleConfig.lighting) prompt += `, 光影: ${styleConfig.lighting}`;
    if (styleConfig.mood) prompt += `, 氛围: ${styleConfig.mood}`;
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
  // Task 14: 角色一致性引擎初始状态
  characterProfiles: {},
  consistencyReports: {},
  consistencyPatches: {},
  shotCharacterLinks: [],

  addShot: (description: string, duration: number, tags?: ShotTag[]) => {
    const { shots } = get();
    const assetRefs = parseAssetRefs(description);
    
    const newShot: Shot = {
      id: generateId(),
      description,
      duration,
      assetRefs,
      videos: [],
      order: shots.length,
      tags
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

  addAsset: (name: string, url: string, type: AssetType = 'image', description?: string, textCardData?: TextCard) => {
    const { assets } = get();
    const newAsset: Asset = {
      id: generateId(),
      name,
      type,
      url,
      description,
      createdAt: Date.now(),
      textCardData
    };
    set({ assets: { ...assets, [name]: newAsset } });
  },

  removeAsset: (name: string) => {
    const { assets } = get();
    const { [name]: _, ...rest } = assets;
    set({ assets: rest });
  },

  updateAsset: (name: string, updates: Partial<Asset>) => {
    const { assets } = get();
    if (assets[name]) {
      set({ assets: { ...assets, [name]: { ...assets[name], ...updates } } });
    }
  },

  generateVideo: async (shotId: string) => {
    const { shots, assets, apiConfig, hasVideoApiKey, styleConfig } = get();
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
          apiConfig,
          styleConfig
        );
      } else {
        result = await mockVideoGenerate(
          shot.description,
          shot.assetRefs,
          assets,
          styleConfig
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
        generationStatus: { ...state.generationStatus, [shotId]: 'success' },
        selectedVideoId: newVideo.id  // 自动选中新生成的视频
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

  updateStyleConfig: (config: Partial<StyleConfig>) => {
    const { styleConfig } = get();
    set({ styleConfig: { ...styleConfig, ...config } });
  },

  getStyleConfig: () => {
    return get().styleConfig;
  },

  updateToneConfig: (config: Partial<ToneConfig>) => {
    const { toneConfig } = get();
    set({ toneConfig: { ...toneConfig, ...config } });
  },

  getToneConfig: () => {
    return get().toneConfig;
  },

  addAssetInsertion: (shotId: string, insertion: ShotAssetInsertion) => {
    const { shots } = get();
    set({
      shots: shots.map(s =>
        s.id === shotId
          ? { ...s, assetInsertions: [...(s.assetInsertions || []), insertion] }
          : s
      )
    });
  },

  removeAssetInsertion: (shotId: string, insertionId: string) => {
    const { shots } = get();
    set({
      shots: shots.map(s =>
        s.id === shotId
          ? { ...s, assetInsertions: (s.assetInsertions || []).filter(ai => ai.id !== insertionId) }
          : s
      )
    });
  },

  updateAssetInsertion: (shotId: string, insertionId: string, updates: Partial<ShotAssetInsertion>) => {
    const { shots } = get();
    set({
      shots: shots.map(s =>
        s.id === shotId
          ? {
              ...s,
              assetInsertions: (s.assetInsertions || []).map(ai =>
                ai.id === insertionId ? { ...ai, ...updates } : ai
              )
            }
          : s
      )
    });
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

  generateShotsFromRichText: async (markdown: string, _toneConfig: ToneConfig, onProgress?: (msg: string) => void): Promise<ScriptGenerationResult> => {
    // TODO: 富文本生成支持调性配置
    // 目前回退到普通剧本生成
    onProgress?.('使用富文本模式生成...');
    return get().generateShotsFromScript(markdown, onProgress);
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
    const { shots, selectedShotId, selectedVideoId } = get();
    if (!selectedShotId) return undefined;
    const selectedShot = shots.find(s => s.id === selectedShotId);
    if (!selectedShot) return undefined;

    // 优先当前分镜的显式选中版本，避免串到其他分镜的视频
    if (selectedVideoId) {
      const explicitVideo = selectedShot.videos.find(v => v.id === selectedVideoId);
      if (explicitVideo) return explicitVideo;
    }

    // 兜底：未显式选择版本时返回当前分镜最新视频，保证“点分镜即可预览”
    if (selectedShot.videos.length === 0) return undefined;
    return selectedShot.videos[selectedShot.videos.length - 1];
  },

  importProject: (shots: Shot[], assets: Record<string, Asset>) => {
    set({ shots, assets, selectedShotId: null, selectedVideoId: null, generationStatus: {} });
  },

  generateAllShots: async (onProgress?: (current: number, total: number) => void) => {
    const { shots, generationStatus } = get();
    const sortedShots = [...shots].sort((a, b) => a.order - b.order);
    const pending = sortedShots.filter(s => {
      const status = generationStatus[s.id] || 'idle';
      return status !== 'generating' && s.videos.length === 0;
    });
    const total = pending.length;
    for (let i = 0; i < pending.length; i++) {
      onProgress?.(i, total);
      await get().generateVideo(pending[i].id);
    }
    onProgress?.(total, total);
  },

  duplicateShot: (id: string) => {
    const { shots } = get();
    const orig = shots.find(s => s.id === id);
    if (!orig) return;
    const insertIdx = orig.order + 1;
    const newShot: Shot = {
      ...orig,
      id: generateId(),
      videos: [],
      order: insertIdx
    };
    const updated = shots.map(s =>
      s.order >= insertIdx ? { ...s, order: s.order + 1 } : s
    );
    set({ shots: [...updated, newShot].sort((a, b) => a.order - b.order) });
  },

  // ========== Task 14: 角色一致性引擎 Actions ==========

  upsertCharacterProfile: (profile: CharacterProfile) => {
    const { characterProfiles } = get();
    set({
      characterProfiles: {
        ...characterProfiles,
        [profile.assetName]: profile
      }
    });
  },

  deleteCharacterProfile: (profileId: string) => {
    const { characterProfiles, shotCharacterLinks } = get();
    // characterProfiles 以 assetName 为 key，删除时需按 profile.id 反查 key
    const entry = Object.entries(characterProfiles).find(([, profile]) => profile.id === profileId);
    if (!entry) return;
    const [profileKey] = entry;
    const { [profileKey]: _, ...rest } = characterProfiles;
    // 同时删除相关的 shot-character 链接
    const updatedLinks = shotCharacterLinks.filter(
      link => link.characterId !== profileId
    );
    set({
      characterProfiles: rest,
      shotCharacterLinks: updatedLinks
    });
  },

  linkCharacterToShot: (shotId: string, characterId: string) => {
    const { shotCharacterLinks } = get();
    // 检查是否已存在
    const exists = shotCharacterLinks.some(
      link => link.shotId === shotId && link.characterId === characterId
    );
    if (exists) return;
    
    const newLink: ShotCharacterLink = {
      id: generateId(),
      shotId,
      characterId,
      bindSource: 'manual',
      createdAt: Date.now()
    };
    set({ shotCharacterLinks: [...shotCharacterLinks, newLink] });
  },

  unlinkCharacterFromShot: (shotId: string, characterId: string) => {
    const { shotCharacterLinks } = get();
    set({
      shotCharacterLinks: shotCharacterLinks.filter(
        link => !(link.shotId === shotId && link.characterId === characterId)
      )
    });
  },

  getCharacterProfile: (assetName: string) => {
    return get().characterProfiles[assetName];
  },

  getLinkedCharacters: (shotId: string) => {
    const { characterProfiles, shotCharacterLinks } = get();
    const linkedIds = shotCharacterLinks
      .filter(link => link.shotId === shotId)
      .map(link => link.characterId);
    return linkedIds
      .map(id => Object.values(characterProfiles).find(p => p.id === id))
      .filter((p): p is CharacterProfile => !!p);
  },

  saveConsistencyReport: (report: ConsistencyReport) => {
    const { consistencyReports } = get();
    const key = `${report.shotId}_${report.characterId}`;
    set({
      consistencyReports: {
        ...consistencyReports,
        [key]: report
      }
    });
  },

  getConsistencyReport: (shotId: string, characterId: string) => {
    const key = `${shotId}_${characterId}`;
    return get().consistencyReports[key];
  },

  saveConsistencyPatch: (patch: ConsistencyPatch) => {
    const { consistencyPatches } = get();
    set({
      consistencyPatches: {
        ...consistencyPatches,
        [patch.id]: patch
      }
    });
  },

  applyConsistencyPatch: (patchId: string) => {
    const { consistencyPatches, shots } = get();
    const patch = consistencyPatches[patchId];
    if (!patch) return;

    // 更新 patch 状态
    const updatedPatch: ConsistencyPatch = {
      ...patch,
      status: 'applied',
      appliedAt: Date.now()
    };

    // 更新 shot 描述
    const updatedShots = shots.map(shot =>
      shot.id === patch.shotId
        ? { ...shot, description: patch.after, assetRefs: parseAssetRefs(patch.after) }
        : shot
    );

    set({
      consistencyPatches: {
        ...consistencyPatches,
        [patchId]: updatedPatch
      },
      shots: updatedShots
    });
  },

  rejectConsistencyPatch: (patchId: string) => {
    const { consistencyPatches } = get();
    const patch = consistencyPatches[patchId];
    if (!patch) return;

    set({
      consistencyPatches: {
        ...consistencyPatches,
        [patchId]: { ...patch, status: 'rejected' }
      }
    });
  },

  getPendingPatches: () => {
    return Object.values(get().consistencyPatches).filter(
      patch => patch.status === 'pending'
    );
  },

  clearAllConsistencyData: () => {
    set({
      characterProfiles: {},
      consistencyReports: {},
      consistencyPatches: {},
      shotCharacterLinks: []
    });
  }
}),
      {
        name: 'storyboard-editor-data',
        partialize: (state): StoreState => ({
          shots: state.shots,
          assets: state.assets,
          selectedShotId: state.selectedShotId,
          selectedVideoId: state.selectedVideoId,
          generationStatus: state.generationStatus,
          styleConfig: state.styleConfig,
          toneConfig: state.toneConfig,
          // Task 14: 角色一致性引擎状态持久化
          characterProfiles: state.characterProfiles,
          consistencyReports: state.consistencyReports,
          consistencyPatches: state.consistencyPatches,
          shotCharacterLinks: state.shotCharacterLinks
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
        generationStatus: state.generationStatus,
        styleConfig: state.styleConfig,
        toneConfig: state.toneConfig,
        // Task 14: 角色一致性引擎状态也支持 undo/redo
        characterProfiles: state.characterProfiles,
        consistencyReports: state.consistencyReports,
        consistencyPatches: state.consistencyPatches,
        shotCharacterLinks: state.shotCharacterLinks
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
  const temporalStore = (useEditorStore as unknown as { temporal: StoreApi<TemporalState> }).temporal;
  const undo = useStore(temporalStore, (state) => state.undo);
  const redo = useStore(temporalStore, (state) => state.redo);
  const canUndo = useStore(temporalStore, (state) => state.pastStates.length > 0);
  const canRedo = useStore(temporalStore, (state) => state.futureStates.length > 0);

  return {
    undo,
    redo,
    canUndo,
    canRedo
  };
};
