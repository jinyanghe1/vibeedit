import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { PRESET_KEYWORDS } from '../services/webNovelInspirationService';
import type { WebNovelInspirationResult } from '../types';
import {
  Lightbulb,
  Loader2,
  Sparkles,
  AlertCircle,
  BookOpen,
  Search,
  Zap,
  RotateCcw
} from 'lucide-react';

export function WebNovelInspiration() {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customDirection, setCustomDirection] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<WebNovelInspirationResult | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'outline' | 'plot' | 'full'>('outline');

  const { generateWebNovelInspiration, hasLLMConfig } = useEditorStore();

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword)
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const handleGenerate = async () => {
    if (selectedKeywords.length === 0 && !customDirection.trim()) {
      setError('请至少选择一个关键词或输入题材方向');
      return;
    }

    setIsGenerating(true);
    setError('');
    setProgress('准备生成...');
    setResult(null);

    try {
      const keywords = selectedKeywords.length > 0 ? selectedKeywords : [customDirection.trim()];
      const generationResult = await generateWebNovelInspiration(
        keywords,
        customDirection.trim() || undefined,
        (msg) => setProgress(msg)
      );
      setResult(generationResult);
      setActiveTab('outline');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleReset = () => {
    setSelectedKeywords([]);
    setCustomDirection('');
    setResult(null);
    setError('');
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="text-amber-400" size={24} />
            <h2 className="text-lg font-semibold text-white">网文灵感</h2>
          </div>
          {result && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={14} />
              重新生成
            </button>
          )}
        </div>

        {/* 合规提示 - 始终可见 */}
        <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-amber-400 mt-0.5 flex-shrink-0" size={16} />
            <p className="text-xs text-amber-300">
              本功能仅用于创作启发，生成内容不可直接发布或用于洗稿。
              请确保最终作品为您原创，遵守相关法律法规。
            </p>
          </div>
        </div>

        {!result ? (
          <>
            {/* 关键词选择 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <Zap size={16} className="text-yellow-500" />
                选择关键词（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_KEYWORDS.map((keyword) => (
                  <button
                    key={keyword}
                    onClick={() => toggleKeyword(keyword)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedKeywords.includes(keyword)
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>

            {/* 题材方向 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <BookOpen size={16} className="text-blue-500" />
                题材方向（可选）
              </label>
              <input
                type="text"
                value={customDirection}
                onChange={(e) => setCustomDirection(e.target.value)}
                placeholder="例如：现代都市、古代宫廷、未来科幻..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {progress || '生成中...'}
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  {hasLLMConfig() ? '生成网文灵感' : '模拟生成'}
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500 mt-3">
              AI 将自动检索、提炼灵感并生成梗概 + 情节片段 + 约1000字扩写
            </p>
          </>
        ) : (
          <>
            {/* 结果展示 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('outline')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'outline'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                故事梗概
              </button>
              <button
                onClick={() => setActiveTab('plot')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'plot'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                情节片段
              </button>
              <button
                onClick={() => setActiveTab('full')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'full'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                扩写正文
              </button>
            </div>

            {/* 内容展示 */}
            <div className="flex-1 overflow-auto">
              {activeTab === 'outline' && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-amber-400 mb-2">故事梗概</h3>
                  <p className="text-white leading-relaxed">{result.outline}</p>
                </div>
              )}

              {activeTab === 'plot' && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-amber-400 mb-2">关键情节片段</h3>
                  <div className="text-white leading-relaxed whitespace-pre-line">{result.plotExcerpt}</div>
                </div>
              )}

              {activeTab === 'full' && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-amber-400 mb-2">扩写正文（约1000字）</h3>
                  <div className="text-white leading-relaxed whitespace-pre-line">{result.expandedContent}</div>
                </div>
              )}
            </div>

            {/* 检索词展示 */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <Search size={12} />
                增强检索词
              </div>
              <div className="flex flex-wrap gap-1">
                {result.enhancedQueries.map((q, i) => (
                  <span key={i} className="text-xs text-gray-500">{q}</span>
                ))}
              </div>
            </div>

            {/* 合规提示 - 结果页底部 */}
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={14} />
                <p className="text-xs text-red-300 whitespace-pre-line">{result.complianceNotice}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
