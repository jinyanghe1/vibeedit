import type { ToneConfig, VideoGenre } from '../types';
import { TONE_LABELS, TONE_PRESETS } from '../types';

interface ToneSelectorProps {
  value: ToneConfig;
  onChange: (config: ToneConfig) => void;
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  const handlePreset = (genre: VideoGenre) => {
    onChange(TONE_PRESETS[genre].config);
  };

  const handleDimensionChange = <K extends keyof ToneConfig>(key: K, val: ToneConfig[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-3">
      {/* 预设模板 */}
      <div>
        <label className="text-xs text-gray-400 mb-1.5 block">视频类型预设（一键填充）</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(TONE_PRESETS) as [VideoGenre, { label: string; config: ToneConfig }][]).map(([genre, preset]) => {
            const isMatch = JSON.stringify(preset.config) === JSON.stringify(value);
            return (
              <button
                key={genre}
                onClick={() => handlePreset(genre)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  isMatch
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 五维度选择器 */}
      <div className="grid gap-2.5">
        {(Object.keys(TONE_LABELS) as (keyof typeof TONE_LABELS)[]).map(dimKey => {
          const dim = TONE_LABELS[dimKey];
          const currentValue = value[dimKey];
          const options = dim.options as Record<string, string>;

          return (
            <div key={dimKey}>
              <label className="text-xs text-gray-400 mb-1 block">{dim.label}</label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(options).map(([optKey, optLabel]) => (
                  <button
                    key={optKey}
                    onClick={() => handleDimensionChange(dimKey, optKey as ToneConfig[typeof dimKey])}
                    className={`px-2 py-0.5 text-xs rounded border transition-all ${
                      currentValue === optKey
                        ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                        : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-400'
                    }`}
                  >
                    {optLabel}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
