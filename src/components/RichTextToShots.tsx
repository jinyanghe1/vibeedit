import { CheckCircle, ChevronDown, ChevronUp, Import, Loader2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { Descendant } from 'slate';
import { useEditorStore } from '../store/editorStore';
import type { ScriptGenerationResult, ToneConfig } from '../types';
import { serializeToMarkdown, serializeToPlainText } from '../utils/slateSerializer';
import { RichTextEditor, createInitialValue } from './RichTextEditor';
import { ToneSelector } from './ToneSelector';

export function RichTextToShots() {
  const [editorValue, setEditorValue] = useState<Descendant[]>(createInitialValue());
  const [toneConfig, setToneConfig] = useState<ToneConfig>({
    rhythm: 'moderate',
    colorTone: 'neutral',
    cameraStyle: 'steady',
    narrativeStyle: 'voiceover',
    visualStyle: 'realistic',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ScriptGenerationResult | null>(null);
  const [showToneSelector, setShowToneSelector] = useState(true);

  const { generateShotsFromRichText, addShots, hasLLMConfig } = useEditorStore();

  const plainText = serializeToPlainText(editorValue);
  const hasContent = plainText.trim().length > 0;

  const handleGenerate = async () => {
    if (!hasContent) return;
    setIsGenerating(true);
    setProgress('');
    setResult(null);

    try {
      const markdown = serializeToMarkdown(editorValue);
      const res = await generateShotsFromRichText(markdown, toneConfig, (msg) => {
        setProgress(msg);
      });
      setResult(res);
    } catch (err) {
      console.error('富文本生成分镜失败:', err);
      setProgress('生成失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportAll = () => {
    if (!result) return;
    addShots(result.shots);
    setResult(null);
    setProgress('✅ 已导入全部分镜');
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">富文本 → 分镜生成</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            输入富文本内容，选择调性风格，自动生成分镜
          </p>
        </div>
        {!hasLLMConfig() && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
            未配置 LLM API，将使用模拟模式
          </span>
        )}
      </div>

      {/* 富文本编辑器 */}
      <RichTextEditor
        value={editorValue}
        onChange={setEditorValue}
        placeholder="输入视频脚本内容...&#10;&#10;使用标题分割场景，加粗标记重点画面要素，&#10;颜色标注表示情绪/氛围提示"
      />

      {/* 调性选择器 */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowToneSelector(!showToneSelector)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800/50 transition-colors"
        >
          <span>🎬 调性风格配置</span>
          {showToneSelector ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showToneSelector && (
          <div className="px-4 pb-4">
            <ToneSelector value={toneConfig} onChange={setToneConfig} />
          </div>
        )}
      </div>

      {/* 字数统计 */}
      {hasContent && (
        <div className="text-xs text-gray-500">
          字数: {plainText.length} | 预计分镜: {Math.max(1, Math.min(10, Math.ceil(plainText.length / 80)))} 个
        </div>
      )}

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={!hasContent || isGenerating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium"
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Wand2 size={18} />
            智能生成分镜
          </>
        )}
      </button>

      {/* 进度信息 */}
      {progress && (
        <div className="text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          {progress}
        </div>
      )}

      {/* 生成结果预览 */}
      {result && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm text-white font-medium">
                生成完成 · {result.shots.length} 个分镜
              </span>
            </div>
            <button
              onClick={handleImportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              <Import size={14} />
              导入全部分镜
            </button>
          </div>

          {result.summary && (
            <p className="px-4 py-2 text-xs text-gray-400 border-b border-gray-800">
              {result.summary}
            </p>
          )}

          <div className="divide-y divide-gray-800 max-h-[300px] overflow-y-auto">
            {result.shots.map((shot, idx) => (
              <div key={idx} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                  <span className="text-xs text-gray-500">{shot.duration}s</span>
                  {shot.assetRefs.length > 0 && (
                    <span className="text-xs text-blue-400">
                      {shot.assetRefs.map(r => `@${r}`).join(' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300">{shot.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
