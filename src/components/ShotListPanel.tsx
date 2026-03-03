import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ShotCard } from './ShotCard';
import { ShotEditor } from './ShotEditor';
import { AssetManager } from './AssetManager';
import { Settings } from './Settings';
import { ScriptToShots } from './ScriptToShots';
import { WebNovelInspiration } from './WebNovelInspiration';
import { Plus, Clapperboard, FileText, List, Lightbulb } from 'lucide-react';

type TabType = 'shots' | 'script' | 'inspiration';

export function ShotListPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('shots');
  const [isAdding, setIsAdding] = useState(false);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  
  const { shots, selectShot, selectedShotId } = useEditorStore();

  // 按order排序
  const sortedShots = [...shots].sort((a, b) => a.order - b.order);

  const handleSelectShot = (shotId: string) => {
    selectShot(shotId);
  };

  const handleEditShot = (shotId: string) => {
    setEditingShotId(shotId);
    setIsAdding(true);
  };

  const handleCloseEditor = () => {
    setIsAdding(false);
    setEditingShotId(null);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Clapperboard className="text-blue-500" size={24} />
          <h1 className="text-lg font-semibold text-white">分镜工作台</h1>
        </div>
        <div className="flex items-center gap-2">
          <Settings />
          <AssetManager />
        </div>
      </div>

      {/* 选项卡切换 */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('shots')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'shots'
              ? 'text-blue-400 border-blue-500 bg-blue-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <List size={14} />
          添加分镜
        </button>
        <button
          onClick={() => setActiveTab('script')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'script'
              ? 'text-purple-400 border-purple-500 bg-purple-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <FileText size={14} />
          剧本生成
        </button>
        <button
          onClick={() => setActiveTab('inspiration')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'inspiration'
              ? 'text-amber-400 border-amber-500 bg-amber-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <Lightbulb size={14} />
          网文灵感
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'script' ? (
        <ScriptToShots />
      ) : activeTab === 'inspiration' ? (
        <WebNovelInspiration />
      ) : (
        <>
          {/* 分镜列表 */}
          <div className="flex-1 overflow-auto p-4">
            {sortedShots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Clapperboard size={64} className="mb-4 opacity-30" />
                <p className="text-lg mb-2">还没有分镜</p>
                <p className="text-sm mb-4">点击下方的按钮添加第一个分镜</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('script')}
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                  >
                    <FileText size={14} />
                    剧本生成
                  </button>
                  <button
                    onClick={() => setActiveTab('inspiration')}
                    className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1"
                  >
                    <Lightbulb size={14} />
                    网文灵感
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedShots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    isSelected={selectedShotId === shot.id}
                    onSelect={() => handleSelectShot(shot.id)}
                    onEdit={() => handleEditShot(shot.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 底部: 添加分镜 */}
          <div className="p-4 border-t border-gray-800">
            {isAdding ? (
              <ShotEditor 
                editShotId={editingShotId} 
                onClose={handleCloseEditor} 
              />
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus size={20} />
                添加分镜
              </button>
            )}
          </div>

          {/* 资产使用提示 */}
          <div className="px-4 pb-4 text-xs text-gray-500">
            <p>💡 提示: 在描述中使用 @资产名 引用已导入的图片资产</p>
          </div>
        </>
      )}
    </div>
  );
}
