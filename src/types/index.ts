// 资产类型
export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  description?: string; // 角色/资产外貌描述，注入视频生成 Prompt
  createdAt: number;
}

// 视频类型
export interface Video {
  id: string;
  shotId: string;
  url: string;
  prompt: string;
  createdAt: number;
  thumbnail?: string;
}

// 分镜预设标签
export const SHOT_TAGS = ['动作', '对话', '特写', '全景', '过场', '转场', '情感', '战斗'] as const;
export type ShotTag = typeof SHOT_TAGS[number];

// 分镜类型
export interface Shot {
  id: string;
  description: string;
  duration: number;
  assetRefs: string[];
  videos: Video[];
  order: number;
  tags?: ShotTag[]; // 分镜分类标签
}

// 生成状态
export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

// 编辑器状态
export interface EditorState {
  shots: Shot[];
  assets: Record<string, Asset>;
  selectedShotId: string | null;
  selectedVideoId: string | null;
  generationStatus: Record<string, GenerationStatus>;
}

// API 提供商
export type ApiProvider = 'bytedance' | 'seedance' | 'custom';

// API 配置
export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  apiUrl: string;
}

// LLM 提供商
export type LLMProvider = 'bytedance' | 'aliyun' | 'baidu' | 'zhipu' | 'openai' | 'custom';

// LLM 配置
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
}

// 剧本生成的分镜数据
export interface ScriptShotData {
  description: string;
  duration: number;
  assetRefs: string[];
}

// 剧本生成结果
export interface ScriptGenerationResult {
  shots: ScriptShotData[];
  summary?: string;
}

// 互联网检索结果
export interface WebSearchItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

// 网文灵感生成结果
export interface WebNovelInspirationResult {
  keywords: string[];
  enhancedQueries: string[];
  searchResults: WebSearchItem[];
  outline: string;
  plotExcerpt: string;
  expandedContent: string;
  complianceNotice: string;
}

// 多平台发布
export type PublishPlatform = 'xiaohongshu' | 'douyin' | 'bilibili' | 'wechat' | 'x';

export interface PublishContent {
  platform: PublishPlatform;
  title: string;
  content: string;
  tags: string[];
  status: 'draft' | 'generating' | 'compliant' | 'violation' | 'published';
  complianceReport?: string;
}

export interface ComplianceResult {
  passed: boolean;
  reason?: string;
  suggestions?: string[];
}
