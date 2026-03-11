/**
 * 角色一致性引擎服务
 * Task 14: 角色一致性引擎 2.0
 * 
 * 提供角色档案提取、一致性检查、修复补丁生成等功能
 */

import type {
  Asset,
  CharacterProfile,
  ConsistencyReport,
  ConsistencyIssue,
  ConsistencyPatch,
  ConsistencyIssueType,
  ProjectConsistencySummary,
  Shot,
  LLMConfig
} from '../types';
import { getRiskLevelByScore } from '../types';
import { callLLMByBackend } from './backendProxy';

// LLM Prompt 模板
const PROMPT_TEMPLATES = {
  /**
   * 从资产描述中提取结构化角色档案
   */
  extractProfile: (assetName: string, description: string): string => `
请从以下角色描述中提取结构化信息，用于AI视频生成时的角色一致性控制。

角色名：${assetName}
描述：${description}

请提取以下字段（返回JSON格式）：
{
  "displayName": "角色显示名称",
  "appearance": {
    "hair": "头发描述，如'黑色长发'",
    "face": "面部特征，如'瓜子脸，大眼睛'",
    "build": "身材描述，如'高挑纤细'",
    "age": "年龄描述，如'20岁左右'",
    "features": "其他特征，如'眼角有泪痣'"
  },
  "outfit": {
    "default": "默认服装，如'红色汉服，白色内衬'",
    "alternatives": ["允许变体1", "允许变体2"]
  },
  "voiceStyle": "语气风格，如'冷静沉稳'",
  "personality": "性格特点，如'内敛，果断'",
  "forbiddenTraits": ["与描述冲突的元素，如'短发'", "'现代服装'"]
}

注意：
1. 如果描述中未提及某字段，可以留空或省略
2. forbiddenTraits 应包含与描述明显冲突的特征
3. 只返回JSON，不要其他说明文字`,

  /**
   * 检查分镜与角色档案的一致性
   */
  checkConsistency: (shotDescription: string, profile: CharacterProfile): string => `
请评估以下分镜描述与角色设定的一致性。

角色设定：
- 名称：${profile.displayName}
- 外貌：${JSON.stringify(profile.appearance)}
- 服装：${profile.outfit.default}
- 允许变体：${profile.outfit.alternatives?.join(', ') || '无'}
- 语气/性格：${profile.voiceStyle || ''} ${profile.personality || ''}
- 禁忌特征：${profile.forbiddenTraits.join(', ') || '无'}

分镜描述：${shotDescription}

请从以下维度评分（0-100分）并返回JSON：
{
  "scores": {
    "identity": "身份一致性：是否正确引用了该角色（0-100）",
    "outfit": "服装一致性：服装是否与设定一致（0-100）",
    "style": "风格一致性：场景/语气是否与角色风格匹配（0-100）"
  },
  "issues": [
    {
      "type": "问题类型：outfit_conflict/style_drift/identity_mismatch/missing_reference",
      "severity": "严重程度：warning/error/critical",
      "message": "问题描述",
      "suggestedFix": "建议修复方案",
      "autoFixable": true/false
    }
  ],
  "explanation": "评分说明和建议"
}

评分标准：
- 90-100：完全一致
- 70-89：基本符合，有小偏差
- 50-69：有明显不一致
- 0-49：严重冲突

只返回JSON，不要其他说明文字。`,

  /**
   * 生成修复补丁
   */
  generateRepair: (shotDescription: string, profile: CharacterProfile, issues: ConsistencyIssue[], mode: 'safe' | 'aggressive'): string => `
请修复以下分镜描述中的角色一致性问题。

角色设定：
- 名称：${profile.displayName}
- 外貌：${JSON.stringify(profile.appearance)}
- 服装：${profile.outfit.default}
- 允许变体：${profile.outfit.alternatives?.join(', ') || '无'}
- 禁忌特征：${profile.forbiddenTraits.join(', ') || '无'}

原始分镜描述：${shotDescription}

检测到的问题：
${issues.map(i => `- ${i.message} (${i.severity})`).join('\n')}

修复模式：${mode}
- safe: 最小改动，仅修复冲突点，保留其他内容
- aggressive: 全面优化，确保风格统一，可能增加细节

请返回JSON格式：
{
  "after": "修复后的分镜描述",
  "changes": ["变更点1", "变更点2"],
  "confidence": 0.85,
  "explanation": "修复说明"
}

要求：
1. 保持分镜描述的基本结构和镜头语言
2. 确保角色特征与设定一致
3. confidence 表示你对修复质量的信心（0-1）
4. 只返回JSON，不要其他说明文字`
};

/**
 * 从资产提取角色档案
 */
export async function extractCharacterProfileFromAsset(
  asset: Asset,
  llmConfig: LLMConfig
): Promise<CharacterProfile> {
  const prompt = PROMPT_TEMPLATES.extractProfile(asset.name, asset.description || '');
  
  try {
    const response = await callLLMByBackend({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      apiUrl: llmConfig.apiUrl,
      model: llmConfig.model,
      prompt,
      temperature: 0.3, // 低温度确保输出稳定
      maxTokens: 1500,
      systemPrompt: '你是一个角色设定解析专家，擅长从文本中提取结构化角色信息。'
    });

    // 解析 JSON 响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从 LLM 响应中解析角色档案');
    }

    const data = JSON.parse(jsonMatch[0]);
    
    const now = Date.now();
    return {
      id: generateId(),
      assetName: asset.name,
      displayName: data.displayName || asset.name,
      appearance: data.appearance || {},
      outfit: {
        default: data.outfit?.default || '',
        alternatives: data.outfit?.alternatives || []
      },
      voiceStyle: data.voiceStyle,
      personality: data.personality,
      forbiddenTraits: data.forbiddenTraits || [],
      version: 1,
      createdAt: now,
      updatedAt: now
    };
  } catch (error) {
    console.error('提取角色档案失败:', error);
    // 降级：返回基础档案
    return createBasicProfile(asset);
  }
}

/**
 * 检查单分镜的一致性
 */
export async function checkShotConsistency(
  shot: Shot,
  profile: CharacterProfile,
  llmConfig: LLMConfig
): Promise<ConsistencyReport> {
  const prompt = PROMPT_TEMPLATES.checkConsistency(shot.description, profile);
  
  try {
    const response = await callLLMByBackend({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      apiUrl: llmConfig.apiUrl,
      model: llmConfig.model,
      prompt,
      temperature: 0.2,
      maxTokens: 1500,
      systemPrompt: '你是一个视频分镜一致性检查专家，擅长识别角色设定与分镜描述的冲突。'
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析一致性检查结果');
    }

    const data = JSON.parse(jsonMatch[0]);
    const scores = data.scores || {};
    const identityScore = normalizeScore(scores.identity);
    const outfitScore = normalizeScore(scores.outfit);
    const styleScore = normalizeScore(scores.style);
    
    // 计算总分（加权平均）
    const totalScore = Math.round(
      identityScore * 0.4 + 
      outfitScore * 0.4 + 
      styleScore * 0.2
    );

    return {
      id: generateId(),
      shotId: shot.id,
      characterId: profile.id,
      score: {
        total: totalScore,
        identity: identityScore,
        outfit: outfitScore,
        style: styleScore
      },
      riskLevel: getRiskLevelByScore(totalScore),
      issues: (data.issues || []).map((issue: any) => ({
        type: issue.type as ConsistencyIssueType,
        severity: issue.severity as 'warning' | 'error' | 'critical',
        message: issue.message,
        suggestedFix: issue.suggestedFix,
        autoFixable: issue.autoFixable ?? false
      })),
      generatedAt: Date.now()
    };
  } catch (error) {
    console.error('一致性检查失败:', error);
    // 降级：返回未知评分
    return createUnknownReport(shot.id, profile.id);
  }
}

/**
 * 生成修复补丁
 */
export async function generateRepairPatch(
  shot: Shot,
  profile: CharacterProfile,
  report: ConsistencyReport,
  mode: 'safe' | 'aggressive',
  llmConfig: LLMConfig
): Promise<ConsistencyPatch> {
  const autoFixableIssues = report.issues.filter(i => i.autoFixable);
  
  if (autoFixableIssues.length === 0) {
    throw new Error('没有可自动修复的问题');
  }

  const prompt = PROMPT_TEMPLATES.generateRepair(
    shot.description, 
    profile, 
    autoFixableIssues,
    mode
  );
  
  try {
    const response = await callLLMByBackend({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      apiUrl: llmConfig.apiUrl,
      model: llmConfig.model,
      prompt,
      temperature: mode === 'aggressive' ? 0.7 : 0.3,
      maxTokens: 1500,
      systemPrompt: '你是一个分镜文案修复专家，擅长在保持原意的同时修正角色一致性问题。'
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析修复结果');
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      id: generateId(),
      reportId: report.id,
      shotId: shot.id,
      characterId: profile.id,
      before: shot.description,
      after: data.after || shot.description,
      changes: data.changes || [],
      confidence: normalizeConfidence(data.confidence),
      explanation: data.explanation || '',
      status: 'pending',
      createdAt: Date.now()
    };
  } catch (error) {
    console.error('生成修复补丁失败:', error);
    throw error;
  }
}

/**
 * 批量检查项目一致性
 */
export async function checkProjectConsistency(
  shots: Shot[],
  _allProfiles: CharacterProfile[], // 所有角色档案（预留用于全局检查）
  getLinkedCharacters: (shotId: string) => CharacterProfile[],
  llmConfig: LLMConfig,
  onProgress?: (current: number, total: number) => void
): Promise<ProjectConsistencySummary> {
  const reports: ConsistencyReport[] = [];
  const highRiskShots: string[] = [];
  
  let checkedCount = 0;
  const totalChecks = shots.reduce((sum, shot) => {
    return sum + getLinkedCharacters(shot.id).length;
  }, 0);

  for (const shot of shots) {
    const linkedProfiles = getLinkedCharacters(shot.id);
    
    for (const profile of linkedProfiles) {
      const report = await checkShotConsistency(shot, profile, llmConfig);
      reports.push(report);
      
      if (report.riskLevel === 'high' || report.riskLevel === 'critical') {
        if (!highRiskShots.includes(shot.id)) {
          highRiskShots.push(shot.id);
        }
      }
      
      checkedCount++;
      onProgress?.(checkedCount, totalChecks);
    }
  }

  // 计算项目平均分
  const projectScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.score.total, 0) / reports.length)
    : 100;

  return {
    projectScore,
    totalShots: shots.length,
    checkedShots: new Set(reports.map(r => r.shotId)).size,
    highRiskShots,
    reports,
    generatedAt: Date.now()
  };
}

// ========== 工具函数 ==========

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function normalizeScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric));
}

function createBasicProfile(asset: Asset): CharacterProfile {
  const now = Date.now();
  return {
    id: generateId(),
    assetName: asset.name,
    displayName: asset.name,
    appearance: {},
    outfit: { default: '' },
    forbiddenTraits: [],
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

function createUnknownReport(shotId: string, characterId: string): ConsistencyReport {
  return {
    id: generateId(),
    shotId,
    characterId,
    score: { total: 50, identity: 50, outfit: 50, style: 50 },
    riskLevel: 'medium',
    issues: [{
      type: 'missing_reference',
      severity: 'warning',
      message: '无法完成一致性检查，请检查 LLM 配置',
      autoFixable: false
    }],
    generatedAt: Date.now()
  };
}

export { PROMPT_TEMPLATES };
