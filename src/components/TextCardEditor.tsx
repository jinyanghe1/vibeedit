import { AlignCenter, AlignLeft, AlignRight, Palette, Sparkles, Type } from 'lucide-react';
import { useState } from 'react';
import type { TextCard, TextCardAnimation } from '../types';
import { TEXT_CARD_PRESETS } from '../types';

interface TextCardEditorProps {
  value?: TextCard;
  onChange: (card: TextCard) => void;
  onCancel?: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const ANIMATION_OPTIONS: { value: TextCardAnimation; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'fade-in', label: '淡入' },
  { value: 'slide-up', label: '上滑' },
  { value: 'typewriter', label: '打字机' },
];

export function TextCardEditor({ value, onChange, onCancel }: TextCardEditorProps) {
  const [card, setCard] = useState<TextCard>(
    value || {
      id: generateId(),
      ...TEXT_CARD_PRESETS.title,
    }
  );

  const update = <K extends keyof TextCard>(key: K, val: TextCard[K]) => {
    setCard(prev => ({ ...prev, [key]: val }));
  };

  const applyPreset = (presetKey: string) => {
    const preset = TEXT_CARD_PRESETS[presetKey];
    if (preset) {
      setCard(prev => ({ ...prev, ...preset }));
    }
  };

  const handleSave = () => {
    onChange(card);
  };

  return (
    <div className="space-y-3">
      {/* 预设模板 */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">快速模板</label>
        <div className="flex gap-1.5">
          <button onClick={() => applyPreset('title')} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
            章节标题
          </button>
          <button onClick={() => applyPreset('subtitle')} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
            字幕条
          </button>
          <button onClick={() => applyPreset('endCard')} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
            结束卡
          </button>
        </div>
      </div>

      {/* 文字内容 */}
      <div>
        <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
          <Type size={12} /> 文字内容
        </label>
        <textarea
          value={card.content}
          onChange={(e) => update('content', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="输入文字内容..."
        />
      </div>

      {/* 字号与字体 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">字号</label>
          <input
            type="number" min={12} max={72} value={card.fontSize}
            onChange={(e) => update('fontSize', Number(e.target.value))}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">动画</label>
          <select
            value={card.animation}
            onChange={(e) => update('animation', e.target.value as TextCardAnimation)}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {ANIMATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 颜色 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
            <Palette size={12} /> 文字色
          </label>
          <input
            type="color" value={card.color}
            onChange={(e) => update('color', e.target.value)}
            className="w-full h-8 bg-gray-900 border border-gray-600 rounded cursor-pointer"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">背景色</label>
          <input
            type="color" value={card.backgroundColor.startsWith('rgba') ? '#000000' : card.backgroundColor}
            onChange={(e) => update('backgroundColor', e.target.value)}
            className="w-full h-8 bg-gray-900 border border-gray-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* 对齐 + 透明度 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">对齐</label>
          <div className="flex gap-1">
            {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => (
              <button
                key={align}
                onClick={() => update('textAlign', align)}
                className={`flex-1 flex items-center justify-center py-1 rounded border transition-colors ${
                  card.textAlign === align ? 'bg-blue-600/30 text-blue-300 border-blue-500/50' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">展示时长 (秒)</label>
          <input
            type="number" min={1} max={30} value={card.duration}
            onChange={(e) => update('duration', Number(e.target.value))}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 实时预览 */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">预览</label>
        <div className="bg-black rounded-lg p-2 flex items-center justify-center min-h-[80px]">
          <TextCardRenderer card={card} />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          <Sparkles size={14} />
          {value ? '保存修改' : '创建文字卡片'}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
            取消
          </button>
        )}
      </div>
    </div>
  );
}

// 文字卡片渲染器
export function TextCardRenderer({ card, className }: { card: TextCard; className?: string }) {
  const animationClass = {
    'none': '',
    'fade-in': 'animate-fade-in',
    'slide-up': 'animate-slide-up',
    'typewriter': '',
  }[card.animation];

  return (
    <div
      className={`${animationClass} ${className || ''}`}
      style={{
        fontSize: `${card.fontSize}px`,
        fontFamily: card.fontFamily,
        color: card.color,
        backgroundColor: card.backgroundColor,
        textAlign: card.textAlign,
        padding: `${card.padding}px`,
        borderRadius: `${card.borderRadius}px`,
        opacity: card.opacity,
        maxWidth: '100%',
        wordBreak: 'break-word',
      }}
    >
      {card.content}
    </div>
  );
}
