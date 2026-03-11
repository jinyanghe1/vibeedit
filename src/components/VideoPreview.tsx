import { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize,
  SkipBack,
  SkipForward,
  Film,
  Split
} from 'lucide-react';

export function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVideoId, setCompareVideoId] = useState<string | null>(null);

  const { getSelectedShot, getSelectedVideo, selectedVideoId } = useEditorStore();

  const selectedShot = getSelectedShot();
  const selectedVideo = getSelectedVideo();
  const activeVideoId = selectedVideo?.id || selectedVideoId;
  const compareVideo = selectedShot?.videos.find(v => v.id === compareVideoId);

  // 当选择的视频改变时，重置播放器
  useEffect(() => {
    if (videoRef.current && selectedVideo) {
      videoRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [selectedVideo?.id]);

  // 播放/暂停控制
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

  // 时间更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // 加载元数据
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // 播放结束
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // 进度条拖动
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 音量控制
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // 格式化时间
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 全屏
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // 如果没有选中分镜或视频
  if (!selectedShot) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-950 text-gray-500">
        <Film size={64} className="mb-4 opacity-30" />
        <p className="text-lg mb-2">选择一个分镜进行预览</p>
        <p className="text-sm">从左侧列表中点击分镜卡片</p>
      </div>
    );
  }

  if (!selectedVideo) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-950 text-gray-500">
        <Film size={64} className="mb-4 opacity-30" />
        <p className="text-lg mb-2">该分镜暂无视频</p>
        <p className="text-sm">点击"创作分镜shot"按钮生成视频</p>
        <div className="mt-4 p-4 bg-gray-900/50 rounded-lg max-w-md">
          <p className="text-sm text-gray-400 mb-2">当前分镜描述:</p>
          <p className="text-gray-300">{selectedShot.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* 视频信息 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div>
          <h3 className="text-sm font-medium text-white">分镜 #{selectedShot.order + 1}</h3>
          <p className="text-xs text-gray-400 line-clamp-1">{selectedShot.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedShot.videos.length >= 2 && (
            <>
              <button
                onClick={() => {
                  if (!compareMode) {
                    setCompareMode(true);
                    setCompareVideoId(selectedShot.videos.find(v => v.id !== activeVideoId)?.id || null);
                  } else {
                    setCompareMode(false);
                    setCompareVideoId(null);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  compareMode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Split size={14} />
                {compareMode ? '退出对比' : 'A/B 对比'}
              </button>
              {compareMode && (
                <select
                  value={compareVideoId || ''}
                  onChange={e => setCompareVideoId(e.target.value || null)}
                  className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none"
                >
                  {selectedShot.videos.filter(v => v.id !== activeVideoId).map((v, idx) => (
                    <option key={v.id} value={v.id}>
                      版本 {selectedShot.videos.findIndex(x => x.id === v.id) + 1}
                      {idx === 0 ? ' (最新)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <span className="text-xs text-gray-500">
            {selectedShot.videos.findIndex(v => v.id === activeVideoId) + 1} / {selectedShot.videos.length} 版本
          </span>
        </div>
      </div>

      {/* 视频播放器 */}
      <div className={`flex-1 flex ${compareMode ? 'flex-row' : 'flex-col'} items-center justify-center bg-black relative`}>
        {compareMode && compareVideo ? (
          <>
            {/* A/B 对比模式 */}
            <div className="flex-1 h-full flex flex-col border-r border-gray-800">
              <div className="px-3 py-1 bg-gray-900 text-xs text-blue-400 text-center border-b border-gray-800">版本 A（当前）</div>
              <div className="flex-1 flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  src={selectedVideo.url}
                  className="max-w-full max-h-full"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                  onPlay={() => {
                    setIsPlaying(true);
                    videoBRef.current?.play();
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                    videoBRef.current?.pause();
                  }}
                  onSeeked={() => {
                    if (videoBRef.current && videoRef.current) {
                      videoBRef.current.currentTime = videoRef.current.currentTime;
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex-1 h-full flex flex-col">
              <div className="px-3 py-1 bg-gray-900 text-xs text-purple-400 text-center border-b border-gray-800">
                版本 B（{selectedShot.videos.findIndex(v => v.id === compareVideoId) + 1}）
              </div>
              <div className="flex-1 flex items-center justify-center relative">
                <video
                  ref={videoBRef}
                  src={compareVideo.url}
                  className="max-w-full max-h-full"
                  muted
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <video
              ref={videoRef}
              src={selectedVideo.url}
              className="max-w-full max-h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* 中央播放按钮 (暂停时显示) */}
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
        )}
      </div>

      {/* 控制栏 */}
      <div className="bg-gray-900 border-t border-gray-800 p-4">
        {/* 进度条 */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-gray-400 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }
              }}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <SkipBack size={18} className="text-gray-300" />
            </button>

            <button
              onClick={togglePlay}
              className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {isPlaying ? (
                <Pause size={20} className="text-white" />
              ) : (
                <Play size={20} className="text-white ml-0.5" />
              )}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                }
              }}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <SkipForward size={18} className="text-gray-300" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 音量 */}
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isMuted ? (
                <VolumeX size={18} className="text-gray-400" />
              ) : (
                <Volume2 size={18} className="text-gray-300" />
              )}
            </button>

            {/* 全屏 */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Maximize size={18} className="text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
