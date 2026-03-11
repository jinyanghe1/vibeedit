// Slate.js 类型声明
import type { BaseEditor } from 'slate';
import type { HistoryEditor } from 'slate-history';
import type { ReactEditor } from 'slate-react';

// 自定义 Slate 元素
export type CustomElement =
  | { type: 'paragraph'; children: CustomText[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: CustomText[] }
  | { type: 'blockquote'; children: (CustomElement | CustomText)[] };

// 自定义 Slate 文本节点（marks）
export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;      // 颜色标注，如 '#ff0000'
  highlight?: string;  // 高亮背景色
};

// 扩展 Slate 模块类型
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// ========== 调性/风格维度 ==========

export type ToneRhythm = 'fast' | 'moderate' | 'slow' | 'dynamic';
export type ToneColor = 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted' | 'monochrome';
export type ToneCameraStyle = 'handheld' | 'steady' | 'aerial' | 'macro' | 'tracking' | 'static';
export type ToneNarrative = 'first-person' | 'third-person' | 'voiceover' | 'interview' | 'dialogue' | 'silent';
export type ToneVisualStyle = 'realistic' | 'cinematic' | 'animated' | 'mixed-media' | 'minimalist' | 'retro' | 'cyberpunk';

export interface ToneConfig {
  rhythm: ToneRhythm;
  colorTone: ToneColor;
  cameraStyle: ToneCameraStyle;
  narrativeStyle: ToneNarrative;
  visualStyle: ToneVisualStyle;
}

export type VideoGenre = 'news' | 'educational' | 'vlog' | 'ad' | 'drama' | 'documentary' | 'mv';

// 视频类型预设映射
export const TONE_PRESETS: Record<VideoGenre, { label: string; config: ToneConfig }> = {
  news:        { label: '新闻稿',     config: { rhythm: 'moderate', colorTone: 'neutral',  cameraStyle: 'static',   narrativeStyle: 'voiceover',  visualStyle: 'realistic' } },
  educational: { label: '科普短视频', config: { rhythm: 'moderate', colorTone: 'cool',     cameraStyle: 'steady',   narrativeStyle: 'voiceover',  visualStyle: 'minimalist' } },
  vlog:        { label: 'Vlog',       config: { rhythm: 'moderate', colorTone: 'warm',     cameraStyle: 'handheld', narrativeStyle: 'first-person', visualStyle: 'realistic' } },
  ad:          { label: '广告',       config: { rhythm: 'fast',     colorTone: 'vibrant',  cameraStyle: 'tracking', narrativeStyle: 'voiceover',  visualStyle: 'cinematic' } },
  drama:       { label: '短剧',       config: { rhythm: 'dynamic',  colorTone: 'warm',     cameraStyle: 'steady',   narrativeStyle: 'dialogue',   visualStyle: 'cinematic' } },
  documentary: { label: '纪录片',     config: { rhythm: 'slow',     colorTone: 'muted',    cameraStyle: 'aerial',   narrativeStyle: 'voiceover',  visualStyle: 'cinematic' } },
  mv:          { label: 'MV',         config: { rhythm: 'fast',     colorTone: 'vibrant',  cameraStyle: 'tracking', narrativeStyle: 'silent',     visualStyle: 'cinematic' } },
};

// 维度中文标签
export const TONE_LABELS = {
  rhythm:      { label: '节奏', options: { fast: '快节奏', moderate: '中等', slow: '慢节奏', dynamic: '变速/动态' } },
  colorTone:   { label: '色调', options: { warm: '暖色调', cool: '冷色调', neutral: '中性', vibrant: '鲜艳', muted: '低饱和', monochrome: '黑白' } },
  cameraStyle: { label: '镜头', options: { handheld: '手持纪实', steady: '稳定电影', aerial: '航拍', macro: '微距', tracking: '跟拍', static: '固定机位' } },
  narrativeStyle: { label: '叙事', options: { 'first-person': '第一人称', 'third-person': '第三人称', voiceover: '旁白', interview: '采访', dialogue: '对话', silent: '纯画面' } },
  visualStyle: { label: '视觉', options: { realistic: '写实', cinematic: '电影级', animated: '动画', 'mixed-media': '混合媒介', minimalist: '极简', retro: '复古', cyberpunk: '赛博朋克' } },
} as const;

// ========== 素材插入相关 ==========

export type AssetInsertionMode = 'before' | 'after' | 'overlay';

export interface OverlayConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'custom';
  x?: number;       // 自定义位置 (百分比 0-100)
  y?: number;
  width: number;     // 百分比 0-100
  height: number;
  opacity: number;   // 0-1
  startTime: number; // 相对于分镜开始的偏移 (秒)
  endTime: number;
  zIndex: number;
}

export type TextCardAnimation = 'fade-in' | 'slide-up' | 'typewriter' | 'none';

export interface TextCard {
  id: string;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  padding: number;
  borderRadius: number;
  opacity: number;
  animation: TextCardAnimation;
  duration: number; // 展示时长 (秒)
}

// 预设文字卡片模板
export const TEXT_CARD_PRESETS: Record<string, Omit<TextCard, 'id'>> = {
  title: {
    content: '标题文字',
    fontSize: 36, fontFamily: 'sans-serif', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)',
    textAlign: 'center', padding: 24, borderRadius: 8, opacity: 1, animation: 'fade-in', duration: 3,
  },
  subtitle: {
    content: '字幕条文字',
    fontSize: 18, fontFamily: 'sans-serif', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)',
    textAlign: 'center', padding: 12, borderRadius: 4, opacity: 0.9, animation: 'slide-up', duration: 5,
  },
  endCard: {
    content: '谢谢观看',
    fontSize: 28, fontFamily: 'sans-serif', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.8)',
    textAlign: 'center', padding: 32, borderRadius: 12, opacity: 1, animation: 'fade-in', duration: 4,
  },
};

export interface ShotAssetInsertion {
  id: string;
  assetId: string;           // 引用 Asset.id
  assetName: string;         // 冗余方便显示
  mode: AssetInsertionMode;
  overlay?: OverlayConfig;   // overlay 模式专属
  displayDuration?: number;  // before/after 素材独占展示时长 (秒)
  textCard?: TextCard;       // 文字卡片模式
}

// ========== 资产类型 (扩展) ==========

export type AssetType = 'image' | 'video' | 'text-card';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  description?: string;
  createdAt: number;
  textCardData?: TextCard; // text-card 类型时的数据
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
  tags?: ShotTag[];
  assetInsertions?: ShotAssetInsertion[]; // 附加素材配置
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
  factRefs?: string[];
}

// 剧本生成结果
export interface ScriptGenerationResult {
  shots: ScriptShotData[];
  summary?: string;
}

export type PreprocessFinalDecision = 'converged' | 'usable' | 'unusable';

export interface PreprocessQualityRound {
  round: number;
  writerSummary: string;
  auditorVerdict: string;
  auditorAdvice: string;
  lengthRatio: number;
  coverage: number;
  shotAnchorCount: number;
  passed: boolean;
}

export interface PreprocessQualityReport {
  rounds: PreprocessQualityRound[];
  finalDecision: PreprocessFinalDecision;
  finalReason: string;
  converged: boolean;
  bestRound: number;
  thresholds: {
    lengthRatioMin: number;
    lengthRatioMax: number;
    minCoverage: number;
    minShotAnchors: number;
  };
}

// 富文本预处理结果
export interface RichTextPreprocessResult {
  preprocessedText: string;
  summary: string;
  coverageChecklist?: Array<{
    factId: string;
    kept: boolean;
    evidence?: string;
  }>;
  detectedFacts?: Array<{
    id: string;
    fact: string;
  }>;
  adjustments?: string[];
  metadata: {
    originalLength: number;
    processedLength: number;
    lengthRatio: number;
    detectedGenre: string;
    rounds: number;
    infoChecklistCount: number;
  };
  qualityReport?: PreprocessQualityReport;
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

// 画面风格配置
export interface StyleConfig {
  enabled: boolean;
  styleDescription: string; // 如："赛博朋克风格，霓虹灯光，雨夜"
  colorPalette: string; // 如："冷色调，蓝紫色为主"
  lighting: string; // 如："侧光，高对比度"
  mood: string; // 如："神秘，紧张"
}

// ========== 角色一致性引擎 2.0（Task 14）==========

/** 一致性检查问题类型 */
export type ConsistencyIssueType = 
  | 'outfit_conflict'      // 服装冲突
  | 'style_drift'          // 风格漂移
  | 'identity_mismatch'    // 身份不匹配
  | 'missing_reference';   // 缺少角色引用

/** 风险等级 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 风险等级对应分数范围 */
export const RISK_LEVEL_RANGES: Record<RiskLevel, { min: number; max: number; color: string; label: string }> = {
  low:     { min: 90, max: 100, color: '#22c55e', label: '低风险' },
  medium:  { min: 70, max: 89,  color: '#eab308', label: '中风险' },
  high:    { min: 50, max: 69,  color: '#f97316', label: '高风险' },
  critical:{ min: 0,  max: 49,  color: '#ef4444', label: '严重' },
};

/** 根据分数确定风险等级 */
export function getRiskLevelByScore(score: number): RiskLevel {
  if (score >= 90) return 'low';
  if (score >= 70) return 'medium';
  if (score >= 50) return 'high';
  return 'critical';
}

/** 角色外貌特征 */
export interface CharacterAppearance {
  hair?: string;      // "黑色长发"
  face?: string;      // "瓜子脸，大眼睛"
  build?: string;     // "高挑纤细"
  age?: string;       // "20岁左右"
  features?: string;  // "眼角有泪痣"
}

/** 角色服装设定 */
export interface CharacterOutfit {
  default: string;          // "红色汉服，白色内衬"
  alternatives?: string[];  // 允许变体：["战斗服版本", "休闲装版本"]
}

/** 角色档案（结构化角色卡） */
export interface CharacterProfile {
  id: string;
  assetName: string;        // 关联的 Asset name（如"小红"）
  displayName: string;      // 显示名称
  appearance: CharacterAppearance;
  outfit: CharacterOutfit;
  voiceStyle?: string;      // "冷静沉稳"
  personality?: string;     // "内敛，果断"
  forbiddenTraits: string[];// ["短发", "现代服装", "戴眼镜"]
  version: number;          // 版本号，用于追踪变更
  createdAt: number;
  updatedAt: number;
}

/** 一致性问题详情 */
export interface ConsistencyIssue {
  type: ConsistencyIssueType;
  severity: 'warning' | 'error' | 'critical';
  message: string;          // "服装与角色卡冲突：红色汉服 -> 黑色西装"
  suggestedFix?: string;    // "建议改为红色汉服"
  autoFixable: boolean;     // 是否可以自动修复
}

/** 一致性检查报告 */
export interface ConsistencyReport {
  id: string;
  shotId: string;
  characterId: string;      // 检查的角色ID
  score: {
    total: number;          // 0-100 总分
    identity: number;       // 身份一致性
    outfit: number;         // 服装一致性
    style: number;          // 风格一致性
  };
  riskLevel: RiskLevel;
  issues: ConsistencyIssue[];
  generatedAt: number;
}

/** 一致性修复补丁 */
export interface ConsistencyPatch {
  id: string;
  reportId: string;         // 关联的报告ID
  shotId: string;
  characterId: string;
  before: string;           // 原始描述
  after: string;            // 修复后描述
  changes: string[];        // 变更点列表
  confidence: number;       // 0-1 置信度
  explanation: string;      // 修复说明
  status: 'pending' | 'applied' | 'rejected';
  createdAt: number;
  appliedAt?: number;
}

/** 项目一致性汇总 */
export interface ProjectConsistencySummary {
  projectScore: number;     // 平均分
  totalShots: number;
  checkedShots: number;
  highRiskShots: string[];  // 高风险分镜ID列表
  reports: ConsistencyReport[];
  generatedAt: number;
}

/** 分镜-角色关联 */
export interface ShotCharacterLink {
  id: string;
  shotId: string;
  characterId: string;
  bindSource: 'manual' | 'auto_parse';  // 手动绑定或自动解析
  createdAt: number;
}
