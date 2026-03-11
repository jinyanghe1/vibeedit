import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { Shot, ShotTag } from '../types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Wand2, 
  Play, 
  ChevronDown, 
  Clock, 
  Film, 
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  GripVertical,
  Copy
} from 'lucide-react';

const TAG_COLORS: Record<ShotTag, string> = {
  '动作': 'bg-red-500/20 text-red-400',
  '对话': 'bg-blue-500/20 text-blue-400',
  '特写': 'bg-purple-500/20 text-purple-400',
  '全景': 'bg-green-500/20 text-green-400',
  '过场': 'bg-gray-500/20 text-gray-400',
  '转场': 'bg-yellow-500/20 text-yellow-400',
  '情感': 'bg-pink-500/20 text-pink-400',
  '战斗': 'bg-orange-500/20 text-orange-400',
};

interface ShotCardProps {
  shot: Shot;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

export function ShotCard({ shot, isSelected, onSelect, onEdit }: ShotCardProps) {
  const [showVideos, setShowVideos] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const { 
    generateVideo, 
    deleteShot, 
    selectVideo, 
    selectedVideoId,
    generationStatus,
    assets,
    hasVideoApiKey,
    duplicateShot
  } = useEditorStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const status = generationStatus[shot.id] || 'idle';
  const hasVideos = shot.videos.length > 0;

  const handleGenerate = async () => {
    await generateVideo(shot.id);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这个分镜吗？')) {
      deleteShot(shot.id);
    }
  };

  const handleVideoSelect = (videoId: string) => {
    selectVideo(videoId);
    onSelect();
    setShowVideos(false);
  };

  const renderHighlightedDescription = () => {
    const parts = shot.description.split(/(@[^\s{}]+|\{[^\s{}]+\})/g);
    return parts.map((part, idx) => {
      const isAssetRef = part.startsWith('@') || (part.startsWith('{') && part.endsWith('}'));
      const assetName = isAssetRef 
        ? part.startsWith('@') ? part.slice(1) : part.slice(1, -1)
        : '';
      const hasAsset = assets[assetName];
      if (isAssetRef) {
        return (
          <span key={idx} className={`px-1 rounded ${hasAsset ? 'bg-blue-500/30 text-blue-300' : 'bg-yellow-500/30 text-yellow-300'}`}>
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // 点击操作控件时不改变预览选中，避免误触
    if (target.closest('button, input, select, textarea, a')) return;
    onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      className={`relative p-4 rounded-lg border transition-all ${
        isSelected ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* 头部: 拖拽手柄、序号和菜单 */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="p-1 hover:bg-gray-700 rounded cursor-grab active:cursor-grabbing" title="拖拽排序">
            <GripVertical size={16} className="text-gray-500" />
          </button>
          <span className="text-xs font-mono text-gray-500">#{shot.order + 1}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={12} />
            {shot.duration}s
          </span>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-gray-700 rounded transition-colors">
            <MoreVertical size={16} className="text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[120px]">
              <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                <Edit2 size={14} />编辑
              </button>
              <button onClick={() => { duplicateShot(shot.id); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                <Copy size={14} />复制
              </button>
              <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors">
                <Trash2 size={14} />删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 描述内容 */}
      <div
        className="text-sm text-gray-200 mb-2 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {renderHighlightedDescription()}
      </div>

      {/* 标签 */}
      {shot.tags && shot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {shot.tags.map(tag => (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded ${TAG_COLORS[tag]}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 资产引用提示 */}
      {shot.assetRefs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {shot.assetRefs.map((ref) => {
            const asset = assets[ref];
            return (
              <span
                key={ref}
                className={`text-xs px-2 py-0.5 rounded ${asset ? 'bg-blue-500/20 text-blue-300' : 'bg-yellow-500/20 text-yellow-300'}`}
                title={asset?.description || undefined}
              >
                @{ref}{asset?.description ? ' ✦' : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* 底部: 操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={status === 'generating'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            status === 'generating' ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : status === 'success' ? 'bg-green-600/80 hover:bg-green-600 text-white'
            : hasVideoApiKey() ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          title={hasVideoApiKey() ? '使用 ByteDance API 生成' : '使用模拟数据生成'}
        >
          {status === 'generating' ? (<><Loader2 size={14} className="animate-spin" />生成中...</>)
          : status === 'success' ? (<><CheckCircle size={14} />已生成</>)
          : status === 'error' ? (<><AlertCircle size={14} />重试</>)
          : (<><Wand2 size={14} />{hasVideoApiKey() ? '创作分镜shot' : '模拟生成'}</>)}
        </button>

        {hasVideos && (
          <div className="relative">
            <button onClick={() => setShowVideos(!showVideos)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
              <Film size={14} />
              <span className="text-xs">{shot.videos.length}</span>
              <ChevronDown size={14} className={`transition-transform ${showVideos ? 'rotate-180' : ''}`} />
            </button>
            {showVideos && (
              <div className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[180px]">
                <div className="p-2 text-xs text-gray-500 border-b border-gray-700">选择版本预览</div>
                {shot.videos.map((video, idx) => (
                  <button key={video.id} onClick={() => handleVideoSelect(video.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${selectedVideoId === video.id ? 'bg-blue-900/50 text-blue-300' : 'text-gray-300'}`}>
                    <Play size={12} />
                    <span>版本 {idx + 1}</span>
                    <span className="text-xs text-gray-500 ml-auto">{new Date(video.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(showMenu || showVideos) && (
        <div className="fixed inset-0 z-0" onClick={() => { setShowMenu(false); setShowVideos(false); }} />
      )}
    </div>
  );
}
