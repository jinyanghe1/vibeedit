import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Play, Pause, SkipBack, SkipForward, Film, Scissors, Clock } from 'lucide-react';
import type { Shot, Video } from '../types';

interface ClipItem {
  shot: Shot;
  video: Video;
}

export function AutoEdit() {
  const [isEditing, setIsEditing] = useState(false);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { shots } = useEditorStore();

  // 生成剪辑序列
  const generateClips = () => {
    const sortedShots = [...shots].sort((a, b) => a.order - b.order);
    const clipItems: ClipItem[] = [];

    for (const shot of sortedShots) {
      // 选择最新的视频版本
      const latestVideo = shot.videos[shot.videos.length - 1];
      if (latestVideo) {
        clipItems.push({
          shot,
          video: latestVideo
        });
      }
    }

    setClips(clipItems);
    setCurrentClipIndex(0);
    setIsEditing(true);
  };

  // 播放控制
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // 切换到下一个片段
  const playNextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      // 播放结束
      setIsPlaying(false);
      setCurrentClipIndex(0);
    }
  };

  // 切换到上一个片段
  const playPrevClip = () => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(prev => prev - 1);
    }
  };

  // 视频结束事件
  const handleVideoEnded = () => {
    playNextClip();
  };

  // 当片段索引改变时，自动播放
  useEffect(() => {
    if (isEditing && videoRef.current) {
      videoRef.current.load();
      if (isPlaying) {
        videoRef.current.play();
      }
    }
  }, [currentClipIndex, isEditing]);

  // 计算总时长
  const totalDuration = clips.reduce((sum, clip) => sum + clip.shot.duration, 0);

  // 渲染剪辑预览
  if (isEditing) {
    const currentClip = clips[currentClipIndex];

    return (
      <div className="h-full flex flex-col bg-gray-950">
        {/* 头部信息 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Scissors className="text-purple-500" size={20} />
            <h3 className="text-sm font-medium text-white">一键剪辑</h3>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              片段 {currentClipIndex + 1} / {clips.length}
            </span>
            <span className="text-xs text-gray-500">
              总时长: {totalDuration}s
            </span>
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              关闭
            </button>
          </div>
        </div>

        {clips.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Film size={64} className="mb-4 opacity-30" />
            <p className="text-lg mb-2">没有可剪辑的视频</p>
            <p className="text-sm">请先生成分镜视频</p>
            <button
              onClick={() => setIsEditing(false)}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              返回
            </button>
          </div>
        ) : (
          <>
            {/* 视频播放区 */}
            <div className="flex-1 flex items-center justify-center bg-black relative">
              {currentClip ? (
                <>
                  <video
                    ref={videoRef}
                    src={currentClip.video.url}
                    className="max-w-full max-h-full"
                    onEnded={handleVideoEnded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    autoPlay={isPlaying}
                  />

                  {/* 片段信息叠加 */}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400">当前分镜</p>
                    <p className="text-sm text-white max-w-xs truncate">
                      #{currentClip.shot.order + 1} {currentClip.shot.description}
                    </p>
                  </div>

                  {/* 中央播放按钮 */}
                  {!isPlaying && (
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                    >
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Play size={40} className="text-white ml-1" />
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <div className="text-gray-500">无视频</div>
              )}
            </div>

            {/* 片段时间轴 */}
            <div className="bg-gray-900 border-t border-gray-800 p-4">
              {/* 进度指示器 */}
              <div className="mb-4">
                <div className="flex items-center gap-1 mb-2">
                  {clips.map((clip, idx) => (
                    <div
                      key={clip.shot.id}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentClipIndex
                          ? 'bg-purple-500 flex-1'
                          : idx < currentClipIndex
                          ? 'bg-purple-500/50 w-8'
                          : 'bg-gray-700 w-8'
                      }`}
                      title={clip.shot.description}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>开始</span>
                  <span>进度: {Math.round(((currentClipIndex) / clips.length) * 100)}%</span>
                  <span>结束</span>
                </div>
              </div>

              {/* 控制按钮 */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={playPrevClip}
                  disabled={currentClipIndex === 0}
                  className="p-2 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <SkipBack size={20} className="text-gray-300" />
                </button>

                <button
                  onClick={togglePlay}
                  className="p-4 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <Pause size={24} className="text-white" />
                  ) : (
                    <Play size={24} className="text-white ml-1" />
                  )}
                </button>

                <button
                  onClick={playNextClip}
                  disabled={currentClipIndex === clips.length - 1}
                  className="p-2 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <SkipForward size={20} className="text-gray-300" />
                </button>
              </div>

              {/* 片段列表 */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">剪辑序列</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {clips.map((clip, idx) => (
                    <button
                      key={clip.shot.id}
                      onClick={() => setCurrentClipIndex(idx)}
                      className={`flex-shrink-0 p-2 rounded-lg text-left transition-colors ${
                        idx === currentClipIndex
                          ? 'bg-purple-600/30 border border-purple-500/50'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">
                          {idx + 1}
                        </span>
                        <span className="text-xs text-gray-300 max-w-[120px] truncate">
                          {clip.shot.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <Clock size={10} />
                        {clip.shot.duration}s
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 初始状态: 一键剪辑按钮
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-950 text-gray-500">
      <Scissors size={64} className="mb-4 opacity-30" />
      <p className="text-lg mb-2">一键剪辑</p>
      <p className="text-sm mb-6 text-center max-w-xs">
        将所有分镜按顺序拼接，自动播放完整视频序列
      </p>
      
      {/* 统计信息 */}
      <div className="flex gap-6 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{shots.length}</p>
          <p className="text-xs text-gray-500">总分镜</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">
            {shots.filter(s => s.videos.length > 0).length}
          </p>
          <p className="text-xs text-gray-500">已生成视频</p>
        </div>
      </div>

      <button
        onClick={generateClips}
        disabled={shots.length === 0}
        className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
      >
        <Film size={20} />
        开始一键剪辑
      </button>

      {shots.length === 0 && (
        <p className="text-xs text-gray-600 mt-3">请先添加分镜</p>
      )}
    </div>
  );
}
