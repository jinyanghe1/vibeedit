/**
 * 一致性检查器组件
 * Task 14: 角色一致性引擎 2.0
 * 
 * 功能：
 * - 展示单分镜的一致性评分
 * - 显示问题列表和风险等级
 * - 触发一键修复
 */

import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { checkShotConsistency, generateRepairPatch } from '../services/characterConsistencyService';
import type { CharacterProfile, ConsistencyReport, ConsistencyIssue } from '../types';
import { RISK_LEVEL_RANGES, getRiskLevelByScore } from '../types';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Wand2,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';

interface ConsistencyInspectorProps {
  shotId: string;
  onClose: () => void;
}

export function ConsistencyInspector({ shotId, onClose }: ConsistencyInspectorProps) {
  const { 
    getShotById, 
    getLinkedCharacters,
    getConsistencyReport,
    saveConsistencyReport,
    saveConsistencyPatch,
    getLLMConfig,
    hasLLMConfig
  } = useEditorStore();

  const shot = getShotById(shotId);
  const linkedCharacters = shot ? getLinkedCharacters(shot.id) : [];
  
  const [isChecking, setIsChecking] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterProfile | null>(null);
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [isGeneratingPatch, setIsGeneratingPatch] = useState(false);

  const llmConfig = getLLMConfig();
  const hasLLM = hasLLMConfig();

  // 运行一致性检查
  const handleCheck = async (character: CharacterProfile) => {
    if (!shot || !hasLLM) return;
    
    setIsChecking(true);
    setSelectedCharacter(character);
    
    try {
      const newReport = await checkShotConsistency(shot, character, llmConfig);
      saveConsistencyReport(newReport);
      setReport(newReport);
    } catch (error) {
      console.error('检查失败:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // 查看已有报告
  const handleViewReport = (character: CharacterProfile) => {
    const existingReport = getConsistencyReport(shotId, character.id);
    setSelectedCharacter(character);
    setReport(existingReport || null);
  };

  // 生成修复补丁
  const handleGeneratePatch = async () => {
    if (!shot || !selectedCharacter || !report) return;
    
    setIsGeneratingPatch(true);
    try {
      const patch = await generateRepairPatch(
        shot, 
        selectedCharacter, 
        report, 
        'safe',
        llmConfig
      );
      saveConsistencyPatch(patch);
      // 可以在这里添加跳转或提示
      alert(`修复补丁已生成，置信度: ${Math.round(patch.confidence * 100)}%`);
    } catch (error) {
      console.error('生成补丁失败:', error);
      alert('生成补丁失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsGeneratingPatch(false);
    }
  };

  // 切换问题展开
  const toggleIssue = (index: number) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedIssues(newExpanded);
  };

  if (!shot) {
    return (
      <div className="p-4 text-center text-gray-500">
        分镜不存在
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-700/50">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-400" size={18} />
          <span className="text-sm font-medium text-white">一致性检查</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <XCircle size={18} />
        </button>
      </div>

      {/* 内容 */}
      <div className="p-3 space-y-3">
        {/* 无 LLM 配置提示 */}
        {!hasLLM && (
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
            请在设置中配置 LLM API Key 以使用一致性检查功能
          </div>
        )}

        {/* 无关联角色提示 */}
        {linkedCharacters.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            <User size={32} className="mx-auto mb-2 opacity-30" />
            <p>此分镜未关联任何角色</p>
            <p className="text-xs mt-1">在描述中使用 @角色名 引用资产</p>
          </div>
        )}

        {/* 角色列表 */}
        {linkedCharacters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">选择角色进行检查：</p>
            <div className="flex flex-wrap gap-2">
              {linkedCharacters.map(character => {
                const existingReport = getConsistencyReport(shotId, character.id);
                const isSelected = selectedCharacter?.id === character.id;
                
                return (
                  <button
                    key={character.id}
                    onClick={() => existingReport ? handleViewReport(character) : handleCheck(character)}
                    disabled={isChecking && isSelected}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
                      isSelected 
                        ? 'bg-blue-600 text-white' 
                        : existingReport
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30'
                    }`}
                  >
                    {isChecking && isSelected ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : existingReport ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Shield size={12} />
                    )}
                    {character.displayName}
                    {existingReport && (
                      <ScoreBadge score={existingReport.score.total} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 检查结果展示 */}
        {report && selectedCharacter && (
          <div className="space-y-3 pt-2 border-t border-gray-700">
            {/* 总评分 */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ 
                    backgroundColor: `${RISK_LEVEL_RANGES[report.riskLevel].color}20`,
                    color: RISK_LEVEL_RANGES[report.riskLevel].color,
                    border: `2px solid ${RISK_LEVEL_RANGES[report.riskLevel].color}`
                  }}
                >
                  {report.score.total}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {RISK_LEVEL_RANGES[report.riskLevel].label}
                </p>
              </div>
              
              {/* 子维度分 */}
              <div className="flex-1 space-y-1.5">
                <ScoreBar label="身份一致" score={report.score.identity} />
                <ScoreBar label="服装一致" score={report.score.outfit} />
                <ScoreBar label="风格一致" score={report.score.style} />
              </div>
            </div>

            {/* 问题列表 */}
            {report.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  发现问题 ({report.issues.length})
                </p>
                <div className="space-y-1">
                  {report.issues.map((issue, index) => (
                    <IssueItem
                      key={index}
                      issue={issue}
                      isExpanded={expandedIssues.has(index)}
                      onToggle={() => toggleIssue(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 修复按钮 */}
            {report.issues.some(i => i.autoFixable) && (
              <button
                onClick={handleGeneratePatch}
                disabled={isGeneratingPatch}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded text-sm transition-colors"
              >
                {isGeneratingPatch ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    生成修复方案...
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    一键修复 ({report.issues.filter(i => i.autoFixable).length})
                  </>
                )}
              </button>
            )}

            {/* 重新检查 */}
            <button
              onClick={() => handleCheck(selectedCharacter)}
              disabled={isChecking}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded text-sm transition-colors"
            >
              <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
              重新检查
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 分数徽章
function ScoreBadge({ score }: { score: number }) {
  const level = getRiskLevelByScore(score);
  return (
    <span 
      className="px-1 rounded text-[10px]"
      style={{ 
        backgroundColor: `${RISK_LEVEL_RANGES[level].color}30`,
        color: RISK_LEVEL_RANGES[level].color
      }}
    >
      {score}
    </span>
  );
}

// 分数条
function ScoreBar({ label, score }: { label: string; score: number }) {
  const level = getRiskLevelByScore(score);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-14">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all"
          style={{ 
            width: `${score}%`,
            backgroundColor: RISK_LEVEL_RANGES[level].color
          }}
        />
      </div>
      <span 
        className="text-xs w-6 text-right"
        style={{ color: RISK_LEVEL_RANGES[level].color }}
      >
        {score}
      </span>
    </div>
  );
}

// 问题项
interface IssueItemProps {
  issue: ConsistencyIssue;
  isExpanded: boolean;
  onToggle: () => void;
}

function IssueItem({ issue, isExpanded, onToggle }: IssueItemProps) {
  const severityColors = {
    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
    error: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: AlertTriangle },
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle }
  };
  
  const colors = severityColors[issue.severity];
  const Icon = colors.icon;

  return (
    <div 
      className={`rounded border ${colors.bg} ${colors.border} overflow-hidden`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 text-left"
      >
        <Icon size={14} className={colors.text} />
        <span className={`text-xs flex-1 ${colors.text}`}>{issue.message}</span>
        {isExpanded ? (
          <ChevronUp size={14} className="text-gray-500" />
        ) : (
          <ChevronDown size={14} className="text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-2 pb-2 pt-0 border-t border-gray-700/50">
          {issue.suggestedFix && (
            <p className="text-xs text-gray-400 mt-1">
              建议：{issue.suggestedFix}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {issue.severity === 'warning' ? '警告' : issue.severity === 'error' ? '错误' : '严重'}
            </span>
            {issue.autoFixable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                可自动修复
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
