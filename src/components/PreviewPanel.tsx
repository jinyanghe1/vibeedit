import { useState } from 'react';
import { VideoPreview } from './VideoPreview';
import { AutoEdit } from './AutoEdit';
import { PublishPanel } from './PublishPanel';
import { Play, Film, Share2 } from 'lucide-react';

type PreviewMode = 'single' | 'auto-edit' | 'publish';

export function PreviewPanel() {
  const [mode, setMode] = useState<PreviewMode>('single');

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* 模式切换标签 */}
      <div className="flex items-center border-b border-gray-800">
        <button
          onClick={() => setMode('single')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            mode === 'single'
              ? 'text-blue-400 border-blue-500 bg-blue-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <Play size={16} />
          单分镜预览
        </button>
        <button
          onClick={() => setMode('auto-edit')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            mode === 'auto-edit'
              ? 'text-purple-400 border-purple-500 bg-purple-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <Film size={16} />
          一键剪辑
        </button>
        <button
          onClick={() => setMode('publish')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            mode === 'publish'
              ? 'text-green-400 border-green-500 bg-green-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <Share2 size={16} />
          多平台发布
        </button>
      </div>

      {/* 预览内容 */}
      <div className="flex-1 overflow-hidden">
        {mode === 'single' ? (
          <VideoPreview />
        ) : mode === 'auto-edit' ? (
          <AutoEdit />
        ) : (
          <PublishPanel />
        )}
      </div>
    </div>
  );
}
