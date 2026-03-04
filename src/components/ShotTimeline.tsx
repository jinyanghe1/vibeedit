import { useEditorStore } from '../store/editorStore';
import type { ShotTag } from '../types';

const TAG_COLORS: Partial<Record<ShotTag, string>> = {
  '动作': '#ef4444',
  '对话': '#3b82f6',
  '特写': '#a855f7',
  '全景': '#22c55e',
  '过场': '#6b7280',
  '转场': '#eab308',
  '情感': '#ec4899',
  '战斗': '#f97316',
};

export function ShotTimeline() {
  const { shots, selectedShotId, selectShot } = useEditorStore();

  if (shots.length === 0) return null;

  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="border-t border-gray-700 px-3 py-2 bg-gray-900/50">
      <div className="text-xs text-gray-500 mb-1.5 flex justify-between">
        <span>时间轴</span>
        <span>共 {totalDuration}s</span>
      </div>
      <div className="flex h-8 gap-px overflow-x-auto rounded overflow-hidden">
        {shots.map((shot) => {
          const widthPct = (shot.duration / totalDuration) * 100;
          const primaryTag = shot.tags?.[0];
          const tagColor = primaryTag ? TAG_COLORS[primaryTag] : undefined;
          const isSelected = shot.id === selectedShotId;

          return (
            <button
              key={shot.id}
              onClick={() => selectShot(shot.id)}
              title={`#${shot.order + 1} ${shot.description.slice(0, 40)}… (${shot.duration}s)`}
              style={{
                width: `${widthPct}%`,
                minWidth: 8,
                backgroundColor: isSelected
                  ? '#3b82f6'
                  : tagColor
                  ? tagColor + '66'
                  : '#374151',
                borderBottom: isSelected ? '2px solid #60a5fa' : tagColor ? `2px solid ${tagColor}` : '2px solid transparent',
              }}
              className={`flex-shrink-0 transition-all hover:brightness-125 ${isSelected ? 'brightness-125' : ''}`}
            >
              {widthPct > 6 && (
                <span className="block truncate text-[10px] text-white/70 px-1 leading-8">
                  #{shot.order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
