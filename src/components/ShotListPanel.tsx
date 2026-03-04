import { useState, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ShotCard } from './ShotCard';
import { ShotEditor } from './ShotEditor';
import { AssetManager } from './AssetManager';
import { Settings } from './Settings';
import { ScriptToShots } from './ScriptToShots';
import { WebNovelInspiration } from './WebNovelInspiration';
import { ShotTimeline } from './ShotTimeline';
import { Plus, Clapperboard, FileText, List, Lightbulb, Wand2, Download, Upload, Loader2 } from 'lucide-react';
import type { Shot, Asset } from '../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

type TabType = 'shots' | 'script' | 'inspiration';

export function ShotListPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('shots');
  const [isAdding, setIsAdding] = useState(false);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  
  const { shots, assets, selectShot, selectedShotId, reorderShots, generateAllShots, importProject } = useEditorStore();

  // 按order排序
  const sortedShots = [...shots].sort((a, b) => a.order - b.order);

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // 拖拽结束处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedShots.findIndex(s => s.id === active.id);
      const newIndex = sortedShots.findIndex(s => s.id === over.id);
      
      const newSortedShots = arrayMove(sortedShots, oldIndex, newIndex);
      reorderShots(newSortedShots.map(s => s.id));
    }
  };

  // 批量生成
  const handleGenerateAll = async () => {
    await generateAllShots((current, total) => {
      setBatchProgress({ current, total });
    });
    setBatchProgress(null);
  };

  // 导出项目
  const handleExport = () => {
    const data = { shots, assets };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入项目
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as { shots: Shot[]; assets: Record<string, Asset> };
        if (data.shots && data.assets) {
          importProject(data.shots, data.assets);
        } else {
          alert('无效的项目文件格式');
        }
      } catch {
        alert('文件解析失败，请检查格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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

  const unGeneratedCount = sortedShots.filter(s => s.videos.length === 0).length;

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Clapperboard className="text-blue-500" size={24} />
          <h1 className="text-lg font-semibold text-white">分镜工作台</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* 导出/导入 */}
          <button
            onClick={handleExport}
            title="导出项目 JSON"
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => importRef.current?.click()}
            title="导入项目 JSON"
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <Upload size={16} />
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedShots.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
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
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* 底部: 添加分镜 + 批量生成 */}
          <div className="p-4 border-t border-gray-800 space-y-2">
            {/* 批量生成进度条 */}
            {batchProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>批量生成中...</span>
                  <span>{batchProgress.current}/{batchProgress.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-purple-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            {isAdding ? (
              <ShotEditor 
                editShotId={editingShotId} 
                onClose={handleCloseEditor} 
              />
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus size={20} />
                  添加分镜
                </button>
                {unGeneratedCount > 0 && (
                  <button
                    onClick={handleGenerateAll}
                    disabled={!!batchProgress}
                    title={`批量生成 ${unGeneratedCount} 个未生成分镜`}
                    className="flex items-center gap-1.5 px-3 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                  >
                    {batchProgress ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    全部生成({unGeneratedCount})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 资产使用提示 */}
          <div className="px-4 pb-2 text-xs text-gray-500">
            <p>💡 提示: 在描述中使用 @资产名 引用已导入的图片资产</p>
          </div>

          {/* 分镜时间轴 */}
          <ShotTimeline />
        </>
      )}
    </div>
  );
}
