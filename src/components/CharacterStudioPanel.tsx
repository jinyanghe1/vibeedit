/**
 * 角色工作室面板
 * Task 14: 角色一致性引擎 2.0
 * 
 * 功能：
 * - 角色卡列表展示
 * - 角色详情编辑（外貌、服装、语气、禁忌）
 * - 从 Asset 自动生成角色档案
 */

import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { extractCharacterProfileFromAsset } from '../services/characterConsistencyService';
import type { Asset, CharacterProfile } from '../types';
import { 
  User, 
  Sparkles, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  UserCircle
} from 'lucide-react';

interface CharacterStudioPanelProps {
  onClose: () => void;
}

export function CharacterStudioPanel({ onClose }: CharacterStudioPanelProps) {
  const { 
    assets, 
    characterProfiles, 
    upsertCharacterProfile, 
    deleteCharacterProfile 
  } = useEditorStore();
  
  const [editingProfile, setEditingProfile] = useState<CharacterProfile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const llmConfig = useEditorStore.getState().getLLMConfig();
  const hasLLM = useEditorStore.getState().hasLLMConfig();

  // 获取有描述的图片资产作为角色候选
  const characterAssets = Object.values(assets).filter(
    a => a.type === 'image' && (a.description || characterProfiles[a.name])
  );

  // 自动生成角色档案
  const handleGenerateProfile = async (asset: Asset) => {
    if (!hasLLM) {
      alert('请先在设置中配置 LLM API Key');
      return;
    }
    
    setIsGenerating(true);
    setSelectedAsset(asset);
    
    try {
      const profile = await extractCharacterProfileFromAsset(asset, llmConfig);
      upsertCharacterProfile(profile);
    } catch (error) {
      console.error('生成角色档案失败:', error);
      alert('生成失败，请检查 LLM 配置');
    } finally {
      setIsGenerating(false);
      setSelectedAsset(null);
    }
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingProfile) {
      upsertCharacterProfile({
        ...editingProfile,
        updatedAt: Date.now()
      });
      setEditingProfile(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <UserCircle className="text-purple-400" size={24} />
            <h2 className="text-lg font-semibold text-white">角色工作室</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-4">
          {editingProfile ? (
            // 编辑模式
            <ProfileEditor 
              profile={editingProfile}
              onChange={setEditingProfile}
              onSave={handleSaveEdit}
              onCancel={() => setEditingProfile(null)}
            />
          ) : (
            // 列表模式
            <div className="space-y-4">
              {/* 候选资产区 */}
              {characterAssets.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Sparkles size={14} />
                    可生成角色档案的资产
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {characterAssets
                      .filter(a => !characterProfiles[a.name])
                      .map(asset => (
                        <div 
                          key={asset.id}
                          className="p-3 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-purple-500 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <img 
                              src={asset.url} 
                              alt={asset.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                            <span className="text-sm text-white font-medium">{asset.name}</span>
                          </div>
                          <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                            {asset.description || '无描述'}
                          </p>
                          <button
                            onClick={() => handleGenerateProfile(asset)}
                            disabled={isGenerating && selectedAsset?.id === asset.id}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded text-sm transition-colors"
                          >
                            {isGenerating && selectedAsset?.id === asset.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} />
                                生成档案
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 已创建的角色档案 */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  已创建的角色档案 ({Object.keys(characterProfiles).length})
                </h3>
                
                {Object.values(characterProfiles).length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <User size={48} className="mx-auto mb-3 opacity-30" />
                    <p>暂无角色档案</p>
                    <p className="text-sm mt-1">选择上方资产生成，或编辑资产添加描述</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(characterProfiles).map(profile => (
                      <CharacterCard
                        key={profile.id}
                        profile={profile}
                        asset={assets[profile.assetName]}
                        onEdit={() => setEditingProfile(profile)}
                        onDelete={() => {
                          if (confirm(`确定要删除角色 "${profile.displayName}" 的档案吗？`)) {
                            deleteCharacterProfile(profile.id);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 角色卡组件
interface CharacterCardProps {
  profile: CharacterProfile;
  asset?: Asset;
  onEdit: () => void;
  onDelete: () => void;
}

function CharacterCard({ profile, asset, onEdit, onDelete }: CharacterCardProps) {
  return (
    <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        {asset ? (
          <img 
            src={asset.url} 
            alt={profile.displayName}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-600 flex items-center justify-center">
            <User size={24} className="text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium truncate">{profile.displayName}</h4>
          <p className="text-xs text-gray-400">v{profile.version} · {new Date(profile.updatedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-600 rounded transition-colors"
            title="编辑"
          >
            <Edit2 size={14} className="text-gray-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-gray-600 rounded transition-colors"
            title="删除"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* 档案摘要 */}
      <div className="space-y-1.5 text-sm">
        {profile.appearance.hair && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-12">外貌:</span>
            <span className="text-gray-300 truncate">{profile.appearance.hair}</span>
          </div>
        )}
        {profile.outfit.default && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-12">服装:</span>
            <span className="text-gray-300 truncate">{profile.outfit.default}</span>
          </div>
        )}
        {profile.forbiddenTraits.length > 0 && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-12">禁忌:</span>
            <span className="text-red-400 text-xs">
              {profile.forbiddenTraits.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// 档案编辑器组件
interface ProfileEditorProps {
  profile: CharacterProfile;
  onChange: (profile: CharacterProfile) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ProfileEditor({ profile, onChange, onSave, onCancel }: ProfileEditorProps) {
  const updateField = <K extends keyof CharacterProfile>(
    field: K, 
    value: CharacterProfile[K]
  ) => {
    onChange({ ...profile, [field]: value });
  };

  const updateAppearance = (key: keyof CharacterProfile['appearance'], value: string) => {
    onChange({
      ...profile,
      appearance: { ...profile.appearance, [key]: value }
    });
  };

  const updateOutfit = (value: string) => {
    onChange({
      ...profile,
      outfit: { ...profile.outfit, default: value }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">编辑角色档案</h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors"
          >
            <Check size={14} />
            保存
          </button>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">显示名称</label>
          <input
            type="text"
            value={profile.displayName}
            onChange={(e) => updateField('displayName', e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* 外貌特征 */}
        <div className="p-3 bg-gray-700/30 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">外貌特征</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">头发</label>
              <input
                type="text"
                value={profile.appearance.hair || ''}
                onChange={(e) => updateAppearance('hair', e.target.value)}
                placeholder="如：黑色长发"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">面部</label>
              <input
                type="text"
                value={profile.appearance.face || ''}
                onChange={(e) => updateAppearance('face', e.target.value)}
                placeholder="如：瓜子脸"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">身材</label>
              <input
                type="text"
                value={profile.appearance.build || ''}
                onChange={(e) => updateAppearance('build', e.target.value)}
                placeholder="如：高挑纤细"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">年龄</label>
              <input
                type="text"
                value={profile.appearance.age || ''}
                onChange={(e) => updateAppearance('age', e.target.value)}
                placeholder="如：20岁左右"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* 服装设定 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">默认服装</label>
          <input
            type="text"
            value={profile.outfit.default}
            onChange={(e) => updateOutfit(e.target.value)}
            placeholder="如：红色汉服，白色内衬"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* 语气与性格 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">语气风格</label>
            <input
              type="text"
              value={profile.voiceStyle || ''}
              onChange={(e) => updateField('voiceStyle', e.target.value)}
              placeholder="如：冷静沉稳"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">性格特点</label>
            <input
              type="text"
              value={profile.personality || ''}
              onChange={(e) => updateField('personality', e.target.value)}
              placeholder="如：内敛，果断"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* 禁忌特征 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            禁忌特征（逗号分隔）
          </label>
          <input
            type="text"
            value={profile.forbiddenTraits.join(', ')}
            onChange={(e) => updateField('forbiddenTraits', 
              e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            )}
            placeholder="如：短发, 现代服装, 戴眼镜"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            这些特征会被一致性检查器标记为冲突
          </p>
        </div>
      </div>
    </div>
  );
}
