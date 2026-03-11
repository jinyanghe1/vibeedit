import { useState, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ImagePlus, X, Upload, User, Edit2, Check, Film, Type } from 'lucide-react';
import type { AssetType, TextCard } from '../types';
import { TextCardEditor } from './TextCardEditor';

export function AssetManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('image');
  const [showTextCardEditor, setShowTextCardEditor] = useState(false);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { assets, addAsset, removeAsset, updateAsset } = useEditorStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
      // Auto-detect type from file
      if (file.type.startsWith('video/')) {
        setAssetType('video');
      } else {
        setAssetType('image');
      }
    }
  };

  const handleAddAsset = () => {
    if (name.trim() && previewUrl) {
      addAsset(name.trim(), previewUrl, assetType, description.trim() || undefined);
      setName('');
      setDescription('');
      setPreviewUrl('');
      setAssetType('image');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddTextCard = (card: TextCard) => {
    const cardName = name.trim() || `文字卡-${Date.now()}`;
    addAsset(cardName, '', 'text-card', undefined, card);
    setShowTextCardEditor(false);
    setName('');
  };

  const handleRemoveAsset = (assetName: string) => {
    removeAsset(assetName);
  };

  const handleSaveDesc = (assetName: string) => {
    updateAsset(assetName, { description: editDescValue.trim() || undefined });
    setEditingDesc(null);
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        <ImagePlus size={18} />
        <span>导入资产</span>
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">资产管理</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 添加新资产 */}
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">添加新资产</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">资产名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如: 小红"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    在分镜描述中使用 @{name || 'name'} 引用此资产
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">角色描述 <span className="text-gray-600">（可选，自动注入生成 Prompt）</span></label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="例如: 长发女孩，红色汉服，古典气质"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">文件</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {previewUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-600"
                      />
                      <button
                        onClick={() => {
                          setPreviewUrl('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-gray-500 hover:bg-gray-700/50 transition-colors"
                    >
                      <Upload size={24} className="text-gray-500 mb-2" />
                      <span className="text-xs text-gray-500">点击上传</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleAddAsset}
                  disabled={!name.trim() || !previewUrl}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  添加资产
                </button>

                <div className="border-t border-gray-600 pt-3">
                  <button
                    onClick={() => setShowTextCardEditor(!showTextCardEditor)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 rounded-lg transition-colors text-sm"
                  >
                    <Type size={16} />
                    创建文字卡片
                  </button>
                </div>

                {showTextCardEditor && (
                  <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-600">
                    <div className="mb-3">
                      <label className="block text-sm text-gray-400 mb-1">卡片名称</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="例如: 章节标题"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <TextCardEditor
                      onChange={handleAddTextCard}
                      onCancel={() => setShowTextCardEditor(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 资产列表 */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                已导入资产 ({Object.keys(assets).length})
              </h3>
              
              {Object.keys(assets).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User size={48} className="mx-auto mb-2 opacity-50" />
                  <p>暂无资产</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.values(assets).map((asset) => (
                    <div
                      key={asset.id}
                      className="flex gap-3 bg-gray-700/30 rounded-lg p-3 group"
                    >
                      {asset.type === 'text-card' ? (
                        <div className="w-16 h-16 flex items-center justify-center bg-gray-800 rounded-lg flex-shrink-0 text-purple-400">
                          <Type size={24} />
                        </div>
                      ) : asset.type === 'video' ? (
                        <div className="w-16 h-16 flex items-center justify-center bg-gray-800 rounded-lg flex-shrink-0 text-blue-400">
                          <Film size={24} />
                        </div>
                      ) : (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-white">@{asset.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            asset.type === 'text-card' ? 'bg-purple-500/20 text-purple-400' :
                            asset.type === 'video' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {asset.type === 'text-card' ? '文字' : asset.type === 'video' ? '视频' : '图片'}
                          </span>
                        </div>
                        {editingDesc === asset.name ? (
                          <div className="flex gap-1 mt-1">
                            <input
                              autoFocus
                              value={editDescValue}
                              onChange={e => setEditDescValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveDesc(asset.name); if (e.key === 'Escape') setEditingDesc(null); }}
                              placeholder="角色描述…"
                              className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-blue-500 rounded text-white focus:outline-none"
                            />
                            <button onClick={() => handleSaveDesc(asset.name)} className="p-1 text-green-400 hover:text-green-300"><Check size={14} /></button>
                            <button onClick={() => setEditingDesc(null)} className="p-1 text-gray-400 hover:text-gray-300"><X size={14} /></button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 mt-1 cursor-pointer"
                            onClick={() => { setEditingDesc(asset.name); setEditDescValue(asset.description || ''); }}
                          >
                            {asset.description ? (
                              <p className="text-xs text-blue-300 truncate">{asset.description}</p>
                            ) : (
                              <p className="text-xs text-gray-600 italic">+ 添加角色描述</p>
                            )}
                            <Edit2 size={11} className="text-gray-600 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveAsset(asset.name)}
                        aria-label={`删除资产 ${asset.name}`}
                        className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
