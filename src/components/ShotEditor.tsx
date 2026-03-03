import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Plus, Clock, FileText } from 'lucide-react';

interface ShotEditorProps {
  editShotId?: string | null;
  onClose?: () => void;
}

export function ShotEditor({ editShotId, onClose }: ShotEditorProps) {
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(5);
  
  const { addShot, updateShot, getShotById, assets } = useEditorStore();

  // 如果是编辑模式，加载现有数据
  useEffect(() => {
    if (editShotId) {
      const shot = getShotById(editShotId);
      if (shot) {
        setDescription(shot.description);
        setDuration(shot.duration);
      }
    }
  }, [editShotId, getShotById]);

  const handleSubmit = () => {
    if (!description.trim()) return;

    if (editShotId) {
      updateShot(editShotId, { description, duration });
    } else {
      addShot(description, duration);
    }

    // 重置表单
    setDescription('');
    setDuration(5);
    onClose?.();
  };

  // 高亮显示资产引用
  const renderHighlightedDescription = () => {
    if (!description) return null;
    
    const parts = description.split(/(@\w+|\{\w+\})/g);
    return parts.map((part, idx) => {
      const isAssetRef = part.startsWith('@') || (part.startsWith('{') && part.endsWith('}'));
      const assetName = isAssetRef 
        ? part.startsWith('@') ? part.slice(1) : part.slice(1, -1)
        : '';
      const hasAsset = assets[assetName];
      
      if (isAssetRef) {
        return (
          <span
            key={idx}
            className={`px-1 rounded ${
              hasAsset 
                ? 'bg-blue-500/30 text-blue-300' 
                : 'bg-yellow-500/30 text-yellow-300'
            }`}
            title={hasAsset ? '资产已导入' : '资产未导入'}
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-4">
        {editShotId ? '编辑分镜' : '添加分镜'}
      </h3>
      
      <div className="space-y-4">
        {/* 描述输入 */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <FileText size={16} />
            分镜描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述分镜内容，使用 @资产名 引用资产...&#10;例如: 小红走在街上，看到一只猫"
            rows={3}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          
          {/* 实时预览 */}
          {description && (
            <div className="mt-2 p-2 bg-gray-900/50 rounded text-sm text-gray-300">
              <span className="text-gray-500 text-xs">预览: </span>
              {renderHighlightedDescription()}
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-1">
            提示: 使用 @资产名 引用已导入的资产图片
          </p>
        </div>

        {/* 时长输入 */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Clock size={16} />
            时长 (秒)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={30}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <input
              type="number"
              min={1}
              max={60}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-gray-900 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:border-blue-500"
            />
            <span className="text-gray-500 text-sm">秒</span>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!description.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            {editShotId ? '保存修改' : '添加分镜'}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
