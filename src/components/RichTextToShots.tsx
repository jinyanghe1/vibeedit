import { CheckCircle, ChevronDown, ChevronUp, Import, Loader2, Wand2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Descendant } from 'slate';
import { useEditorStore } from '../store/editorStore';
import type { RichTextPreprocessResult, ScriptGenerationResult, ToneConfig } from '../types';
import { buildFactRepairedDraft, collectMissingFacts } from '../utils/factRepairUtils';
import {
  checkEvidenceMatch,
  extractEvidenceKeywordsFromCoverage,
  extractKeywordsFromEvidence,
  generateHighlightSegments,
  getEvidenceLocationLabel,
  normalizeKeyword,
  summarizeCoverage
} from '../utils/highlightUtils';
import { serializeToMarkdown, serializeToPlainText } from '../utils/slateSerializer';
import { RichTextEditor, createInitialValue } from './RichTextEditor';
import { ToneSelector } from './ToneSelector';

interface DraftSnapshot {
  id: string;
  label: string;
  source: 'preprocess' | 'repair';
  text: string;
  createdAt: number;
  appendedFactIds?: string[];
}

/** F3: 生成前质量门禁阈值（覆盖率低于此值时触发警告） */
const COVERAGE_GATE_THRESHOLD = 0.7;

function HighlightedText({ text, keywords }: { text: string; keywords?: string[] }) {
  const segments = generateHighlightSegments(text, keywords || []);
  return (
    <>
      {segments.map((segment, index) =>
        segment.isHighlight ? (
          <mark 
            key={`${segment.text}-${index}`} 
            className="bg-yellow-500/30 text-yellow-100 rounded px-0.5 transition-all duration-500"
            data-keyword={segment.matchedKeyword?.toLowerCase()}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        )
      )}
    </>
  );
}

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
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ScriptGenerationResult | null>(null);
  const [preprocessResult, setPreprocessResult] = useState<RichTextPreprocessResult | null>(null);
  const [preprocessSourceMarkdown, setPreprocessSourceMarkdown] = useState('');
  const [usePreprocessedDraft, setUsePreprocessedDraft] = useState(true);
  const [showToneSelector, setShowToneSelector] = useState(true);
  const [selectedFactId, setSelectedFactId] = useState<string>('all');
  const [onlyMissingCoverage, setOnlyMissingCoverage] = useState(false);
  const [activeCoverageFactId, setActiveCoverageFactId] = useState<string | null>(null);
  const [repairedDraftText, setRepairedDraftText] = useState<string | null>(null);
  const [repairedFactIds, setRepairedFactIds] = useState<string[]>([]);
  const [enableCoverageGate, setEnableCoverageGate] = useState(true);
  const [allowCoverageGateBypassOnce, setAllowCoverageGateBypassOnce] = useState(false);
  const [allowImportGateBypassOnce, setAllowImportGateBypassOnce] = useState(false);
  const [draftSnapshots, setDraftSnapshots] = useState<DraftSnapshot[]>([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);

  const sourceContainerRef = useRef<HTMLDivElement>(null);
  const draftContainerRef = useRef<HTMLDivElement>(null);
  const snapshotSeqRef = useRef(0);

  const { generateShotsFromRichText, preprocessRichTextForStoryboard, addShots, hasLLMConfig } = useEditorStore();

  const plainText = serializeToPlainText(editorValue);
  const currentMarkdown = serializeToMarkdown(editorValue);
  const hasFreshPreprocess = !!preprocessResult && preprocessSourceMarkdown === currentMarkdown;
  const hasContent = plainText.trim().length > 0;
  const selectedFact = selectedFactId === 'all'
    ? undefined
    : preprocessResult?.detectedFacts?.find((fact) => fact.id === selectedFactId);
  const factFilteredCoverage = useMemo(
    () =>
      (preprocessResult?.coverageChecklist || []).filter((item) =>
        selectedFactId === 'all' ? true : item.factId === selectedFactId
      ),
    [preprocessResult?.coverageChecklist, selectedFactId]
  );
  const missingFacts = useMemo(
    () => (preprocessResult ? collectMissingFacts(preprocessResult) : []),
    [preprocessResult]
  );
  const activeSnapshot = useMemo(
    () => draftSnapshots.find((snapshot) => snapshot.id === activeSnapshotId) || null,
    [draftSnapshots, activeSnapshotId]
  );
  const activeSnapshotIndex = useMemo(
    () => draftSnapshots.findIndex((snapshot) => snapshot.id === activeSnapshotId),
    [draftSnapshots, activeSnapshotId]
  );
  const canRollbackSnapshot = activeSnapshotIndex > 0;
  const isRepairSnapshotActive = activeSnapshot?.source === 'repair';
  const displayPreprocessedText = activeSnapshot?.text || repairedDraftText || preprocessResult?.preprocessedText || '';
  const visibleCoverage = useMemo(
    () => (onlyMissingCoverage ? factFilteredCoverage.filter((item) => !item.kept) : factFilteredCoverage),
    [factFilteredCoverage, onlyMissingCoverage]
  );
  const activeCoverageItem = useMemo(
    () => visibleCoverage.find((item) => item.factId === activeCoverageFactId),
    [activeCoverageFactId, visibleCoverage]
  );
  const evidenceKeywords = useMemo(
    () => extractEvidenceKeywordsFromCoverage(activeCoverageItem ? [activeCoverageItem] : visibleCoverage, 6),
    [activeCoverageItem, visibleCoverage]
  );
  const highlightKeywords = useMemo(() => {
    const mergedKeywords = [selectedFact?.fact || '', activeCoverageItem?.evidence || '', ...evidenceKeywords];
    return Array.from(
      new Set(mergedKeywords.map(normalizeKeyword).filter((item) => item.length >= 2))
    );
  }, [selectedFact?.fact, activeCoverageItem?.evidence, evidenceKeywords]);
  const coverageSummary = useMemo(() => summarizeCoverage(factFilteredCoverage), [factFilteredCoverage]);
  /** F3/F4: 覆盖率风险条件（用于生成门禁与导入门禁） */
  const coverageGateRiskPresent = enableCoverageGate &&
    usePreprocessedDraft &&
    hasFreshPreprocess &&
    coverageSummary.total > 0 &&
    coverageSummary.missingCount > 0 &&
    coverageSummary.keptRatio < COVERAGE_GATE_THRESHOLD &&
    !(isRepairSnapshotActive || repairedDraftText);
  /** F3: 生成门禁 */
  const coverageGateTriggered = coverageGateRiskPresent && !allowCoverageGateBypassOnce;
  /** F4: 导入门禁 */
  const importGateTriggered = !!result && coverageGateRiskPresent && !allowImportGateBypassOnce;
  const visibleCoverageWithMatch = useMemo(
    () =>
      visibleCoverage.map((item) => ({
        ...item,
        evidenceMatch: checkEvidenceMatch(
          item.evidence || '',
          preprocessSourceMarkdown,
          displayPreprocessedText
        )
      })),
    [visibleCoverage, preprocessSourceMarkdown, displayPreprocessedText]
  );
  const sourceEvidenceHits = useMemo(
    () =>
      visibleCoverageWithMatch.filter(
        (item) => item.evidenceMatch.location === 'original' || item.evidenceMatch.location === 'both'
      ).length,
    [visibleCoverageWithMatch]
  );
  const draftEvidenceHits = useMemo(
    () =>
      visibleCoverageWithMatch.filter(
        (item) => item.evidenceMatch.location === 'processed' || item.evidenceMatch.location === 'both'
      ).length,
    [visibleCoverageWithMatch]
  );

  const scrollToFirstHit = (container: HTMLDivElement | null, keywords: string[]) => {
    if (!container || keywords.length === 0) return;
    
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const marks = container.querySelectorAll('mark');
    
    for (const mark of Array.from(marks)) {
      const markKeyword = mark.getAttribute('data-keyword');
      if (markKeyword && normalizedKeywords.includes(markKeyword)) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 添加临时高亮增强效果
        mark.classList.remove('bg-yellow-500/30');
        mark.classList.add('bg-yellow-400', 'ring-4', 'ring-yellow-400/50', 'scale-110');
        
        setTimeout(() => {
          mark.classList.remove('bg-yellow-400', 'ring-4', 'ring-yellow-400/50', 'scale-110');
          mark.classList.add('bg-yellow-500/30');
        }, 1500);
        
        break;
      }
    }
  };

  const handleCoverageItemClick = (item: any) => {
    setActiveCoverageFactId(item.factId);
    setSelectedFactId(item.factId);
    
    // 延迟执行滚动，确保状态更新后的高亮渲染已完成
    setTimeout(() => {
      const itemKeywords = extractKeywordsFromEvidence(item.evidence || '');
      if (itemKeywords.length > 0) {
        scrollToFirstHit(sourceContainerRef.current, itemKeywords);
        scrollToFirstHit(draftContainerRef.current, itemKeywords);
      }
    }, 100);
  };

  const appendDraftSnapshot = (
    source: DraftSnapshot['source'],
    text: string,
    appendedFactIds: string[] = [],
    options: { reset?: boolean } = {}
  ) => {
    const base = options.reset ? [] : draftSnapshots;
    const sourceCount = base.filter((snapshot) => snapshot.source === source).length + 1;
    const id = `snap-${Date.now()}-${snapshotSeqRef.current++}`;
    const label = source === 'preprocess' ? `预处理v${sourceCount}` : `补齐v${sourceCount}`;
    const next = [
      ...base,
      {
        id,
        label,
        source,
        text,
        createdAt: Date.now(),
        appendedFactIds
      }
    ].slice(-8);

    setDraftSnapshots(next);
    setActiveSnapshotId(id);
  };

  const activateSnapshot = (snapshot: DraftSnapshot, progressMessage?: string) => {
    setActiveSnapshotId(snapshot.id);
    if (snapshot.source === 'repair') {
      setRepairedDraftText(snapshot.text);
      setRepairedFactIds(snapshot.appendedFactIds || []);
    } else {
      setRepairedDraftText(null);
      setRepairedFactIds([]);
    }
    if (progressMessage) {
      setProgress(progressMessage);
    }
  };

  const handleRollbackSnapshot = () => {
    if (!canRollbackSnapshot) {
      setProgress('没有可回滚的上一版本。');
      return;
    }

    const previousSnapshot = draftSnapshots[activeSnapshotIndex - 1];
    activateSnapshot(previousSnapshot, `已回滚到 ${previousSnapshot.label}。`);
  };

  const runPreprocess = async (markdown: string): Promise<RichTextPreprocessResult> => {
    setIsPreprocessing(true);
    try {
      const shouldResetSnapshots = preprocessSourceMarkdown !== markdown;
      const preprocessed = await preprocessRichTextForStoryboard(markdown, (msg) => {
        setProgress(msg);
      });
      setPreprocessResult(preprocessed);
      setSelectedFactId('all');
      setOnlyMissingCoverage(false);
      setActiveCoverageFactId(null);
      setRepairedDraftText(null);
      setRepairedFactIds([]);
      setAllowCoverageGateBypassOnce(false);
      setAllowImportGateBypassOnce(false);
      setPreprocessSourceMarkdown(markdown);
      appendDraftSnapshot('preprocess', preprocessed.preprocessedText, [], { reset: shouldResetSnapshots });
      return preprocessed;
    } finally {
      setIsPreprocessing(false);
    }
  };

  const handlePreprocess = async () => {
    if (!hasContent) return;
    setProgress('');
    try {
      const preprocessed = await runPreprocess(currentMarkdown);
      setProgress(`预处理完成：${preprocessed.summary}`);
    } catch (err) {
      console.error('富文本预处理失败:', err);
      setProgress('预处理失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleGenerate = async () => {
    if (!hasContent) return;

    setIsGenerating(true);
    setProgress('');
    setResult(null);
    setAllowImportGateBypassOnce(false);

    try {
      let markdownForGeneration = currentMarkdown;

      if (usePreprocessedDraft) {
        if (hasFreshPreprocess && preprocessResult) {
          if (coverageGateTriggered) {
            setProgress(
              `覆盖率门禁已触发：当前覆盖率 ${Math.round(coverageSummary.keptRatio * 100)}%，低于阈值 ${Math.round(
                COVERAGE_GATE_THRESHOLD * 100
              )}%。请先补齐或点击“继续生成（临时忽略门禁）”。`
            );
            return;
          }
          if (allowCoverageGateBypassOnce) {
            setAllowCoverageGateBypassOnce(false);
          }
          markdownForGeneration = displayPreprocessedText;
        } else {
          try {
            const preprocessed = await runPreprocess(currentMarkdown);
            const generatedCoverage = summarizeCoverage(preprocessed.coverageChecklist || []);
            const shouldBlockAfterPreprocess =
              enableCoverageGate &&
              generatedCoverage.total > 0 &&
              generatedCoverage.missingCount > 0 &&
              generatedCoverage.keptRatio < COVERAGE_GATE_THRESHOLD &&
              !allowCoverageGateBypassOnce;
            if (shouldBlockAfterPreprocess) {
              setProgress(
                `覆盖率门禁已触发：当前覆盖率 ${Math.round(generatedCoverage.keptRatio * 100)}%，低于阈值 ${Math.round(
                  COVERAGE_GATE_THRESHOLD * 100
                )}%。请先补齐或点击“继续生成（临时忽略门禁）”。`
              );
              return;
            }
            if (allowCoverageGateBypassOnce) {
              setAllowCoverageGateBypassOnce(false);
            }
            markdownForGeneration = preprocessed.preprocessedText;
          } catch (preprocessErr) {
            console.warn('预处理失败，回退原文生成', preprocessErr);
            setProgress('预处理失败，已回退原文继续生成...');
          }
        }
      }

      const res = await generateShotsFromRichText(markdownForGeneration, toneConfig, (msg) => {
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

  const handleRepairMissingFacts = () => {
    if (!preprocessResult) return;
    const { repairedText, appendedFacts } = buildFactRepairedDraft(displayPreprocessedText, missingFacts);

    if (appendedFacts.length === 0) {
      setProgress('当前预处理稿已覆盖缺失事实，无需补齐。');
      return;
    }

    setRepairedDraftText(repairedText);
    const appendedFactIds = appendedFacts.map((item) => item.id);
    setRepairedFactIds(appendedFactIds);
    appendDraftSnapshot('repair', repairedText, appendedFactIds);
    setProgress(`已补齐 ${appendedFacts.length} 条缺失事实，生成将优先使用补齐稿。`);
  };

  const handleResetRepair = () => {
    const latestPreprocessSnapshot = [...draftSnapshots].reverse().find((snapshot) => snapshot.source === 'preprocess');
    if (latestPreprocessSnapshot) {
      activateSnapshot(latestPreprocessSnapshot, '已回退到原预处理稿。');
      return;
    }

    setRepairedDraftText(null);
    setRepairedFactIds([]);
    setProgress('已回退到原预处理稿。');
  };

  const handleBypassCoverageGateOnce = () => {
    setAllowCoverageGateBypassOnce(true);
    setProgress('已临时放行一次门禁校验，请再次点击“智能生成分镜”。');
  };

  const handleBypassImportGateOnce = () => {
    setAllowImportGateBypassOnce(true);
    setProgress('已临时放行一次导入门禁，请再次点击“导入全部分镜”。');
  };

  const handleImportAll = () => {
    if (!result) return;
    if (importGateTriggered) {
      setProgress(
        `导入门禁已触发：当前覆盖率 ${Math.round(coverageSummary.keptRatio * 100)}%，低于阈值 ${Math.round(
          COVERAGE_GATE_THRESHOLD * 100
        )}%。请先补齐或点击“导入全部分镜（临时忽略门禁）”。`
      );
      return;
    }
    if (allowImportGateBypassOnce) {
      setAllowImportGateBypassOnce(false);
    }
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

      {/* 预处理配置 */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={usePreprocessedDraft}
              onChange={(e) => setUsePreprocessedDraft(e.target.checked)}
              className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
            />
            生成前启用 LLM 预处理（知识稿 → 可分镜稿）
          </label>
          <button
            onClick={handlePreprocess}
            disabled={!hasContent || isGenerating || isPreprocessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {isPreprocessing ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                预处理中...
              </>
            ) : (
              <>
                <Wand2 size={12} />
                预处理稿件
              </>
            )}
          </button>
        </div>

        {usePreprocessedDraft && preprocessResult && !hasFreshPreprocess && (
          <p className="text-xs text-yellow-400">
            输入已变更，当前预处理结果已过期。点击“预处理稿件”或直接生成会自动重新预处理。
          </p>
        )}

        {usePreprocessedDraft && (
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableCoverageGate}
              onChange={(e) => {
                setEnableCoverageGate(e.target.checked);
                setAllowCoverageGateBypassOnce(false);
                setAllowImportGateBypassOnce(false);
              }}
              className="rounded border-gray-700 bg-gray-900 text-amber-500 focus:ring-amber-500"
            />
            启用覆盖率门禁（低于 {Math.round(COVERAGE_GATE_THRESHOLD * 100)}% 阻断生成）
          </label>
        )}

        {preprocessResult && (
          <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-2.5 space-y-2">
            <div className="text-xs text-gray-400">
              文体: {preprocessResult.metadata.detectedGenre} | 长度: {preprocessResult.metadata.originalLength} → {preprocessResult.metadata.processedLength}（比例 {preprocessResult.metadata.lengthRatio.toFixed(2)}）
            </div>
            <p className="text-xs text-gray-300">{preprocessResult.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-[11px] text-gray-500">原文（预处理输入）</div>
                <div 
                  ref={sourceContainerRef}
                  className="w-full h-28 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-gray-400 overflow-auto whitespace-pre-wrap scroll-smooth"
                >
                  <HighlightedText text={preprocessSourceMarkdown} keywords={highlightKeywords} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-gray-500">
                  预处理稿件（用于分镜生成）
                  {isRepairSnapshotActive || repairedDraftText ? ' · 已补齐缺失项' : ''}
                </div>
                <div 
                  ref={draftContainerRef}
                  className="w-full h-28 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-gray-300 overflow-auto whitespace-pre-wrap scroll-smooth"
                >
                  <HighlightedText text={displayPreprocessedText} keywords={highlightKeywords} />
                </div>
              </div>
            </div>

            {draftSnapshots.length > 0 && (
              <div className="bg-gray-950/80 border border-gray-800 rounded p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-500">预处理版本快照</div>
                  <button
                    type="button"
                    onClick={handleRollbackSnapshot}
                    disabled={!canRollbackSnapshot}
                    className="text-[11px] px-2 py-0.5 rounded border border-gray-700 bg-gray-900 text-gray-300 disabled:text-gray-600 disabled:border-gray-800 disabled:cursor-not-allowed hover:bg-gray-800"
                  >
                    回滚到上一版本
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draftSnapshots.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      type="button"
                      onClick={() => activateSnapshot(snapshot, `已切换到 ${snapshot.label}。`)}
                      className={`text-[11px] px-2 py-0.5 rounded border ${activeSnapshotId === snapshot.id ? 'border-blue-400 bg-blue-500/20 text-blue-300' : 'border-gray-700 bg-gray-900 text-gray-400'}`}
                    >
                      {snapshot.label}
                    </button>
                  ))}
                </div>
                {activeSnapshot && (
                  <div className="text-[11px] text-gray-500">
                    当前版本：{activeSnapshot.label} · {activeSnapshot.source === 'repair' ? '补齐稿' : '预处理稿'}
                  </div>
                )}
              </div>
            )}

            {(preprocessResult.coverageChecklist?.length || preprocessResult.detectedFacts?.length || preprocessResult.adjustments?.length) ? (
              <div className="bg-gray-950/80 border border-gray-800 rounded p-2 space-y-2">
                <div className="text-[11px] text-gray-500">信息覆盖率明细</div>

                {preprocessResult.detectedFacts && preprocessResult.detectedFacts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">按事实点筛选</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFactId('all');
                          setActiveCoverageFactId(null);
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded border ${selectedFactId === 'all' ? 'border-blue-400 bg-blue-500/20 text-blue-300' : 'border-gray-700 bg-gray-900 text-gray-400'}`}
                      >
                        全部
                      </button>
                      {preprocessResult.detectedFacts.map((fact) => (
                        <button
                          key={fact.id}
                          type="button"
                          onClick={() => {
                            setSelectedFactId(fact.id);
                            setActiveCoverageFactId(null);
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded border ${selectedFactId === fact.id ? 'border-blue-400 bg-blue-500/20 text-blue-300' : 'border-gray-700 bg-gray-900 text-gray-400'}`}
                        >
                          {fact.id}
                        </button>
                      ))}
                    </div>
                    {selectedFact && (
                      <div className="text-xs text-gray-400">
                        当前事实点：<span className="text-gray-200">{selectedFact.fact}</span>
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyMissingCoverage}
                    onChange={(e) => {
                      setOnlyMissingCoverage(e.target.checked);
                      setActiveCoverageFactId(null);
                    }}
                    className="rounded border-gray-700 bg-gray-900 text-red-500 focus:ring-red-500"
                  />
                  只看缺失项
                </label>

                {coverageSummary.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>覆盖率汇总</span>
                      <span>{coverageSummary.keptCount}/{coverageSummary.total} 已覆盖</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                        style={{ width: `${Math.max(0, Math.min(100, coverageSummary.keptRatio * 100))}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-gray-500">
                      缺失 {coverageSummary.missingCount} 项
                    </div>
                    {activeCoverageItem && (
                      <div className="text-[11px] text-blue-300">
                        聚焦覆盖项：{activeCoverageItem.factId}
                      </div>
                    )}
                  </div>
                )}

                {missingFacts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRepairMissingFacts}
                      className="text-[11px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                    >
                      一键补齐缺失项（{missingFacts.length}）
                    </button>
                    {(isRepairSnapshotActive || repairedDraftText) && (
                      <button
                        type="button"
                        onClick={handleResetRepair}
                        className="text-[11px] px-2.5 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                      >
                        回退补齐
                      </button>
                    )}
                    {repairedFactIds.length > 0 && (
                      <span className="text-[11px] text-amber-300">
                        已补齐：{repairedFactIds.join('、')}
                      </span>
                    )}
                  </div>
                )}

                {evidenceKeywords.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">证据定位词</div>
                    <div className="flex flex-wrap gap-1.5">
                      {evidenceKeywords.map((keyword) => (
                        <span key={keyword} className="text-[11px] bg-yellow-500/10 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/20">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      定位命中：原文 {sourceEvidenceHits}/{visibleCoverageWithMatch.length || 1} · 预处理稿 {draftEvidenceHits}/{visibleCoverageWithMatch.length || 1}
                    </div>
                  </div>
                )}

                {visibleCoverageWithMatch.length > 0 && (
                  <ul className="space-y-1">
                    {visibleCoverageWithMatch.map((item) => (
                      <li key={item.factId}>
                        <button
                          type="button"
                          onClick={() => handleCoverageItemClick(item)}
                          className={`w-full text-left text-xs text-gray-300 flex items-start gap-2 rounded px-1.5 py-1 transition-colors ${activeCoverageFactId === item.factId ? 'bg-blue-500/10 border border-blue-500/20' : 'border border-transparent hover:bg-gray-900/70'}`}
                        >
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.kept ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.kept ? '保留' : '缺失'}
                        </span>
                        <span className="text-gray-400 min-w-[42px]">{item.factId}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-gray-300">{item.evidence || '未提供证据说明'}</div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              item.evidenceMatch.location === 'both'
                                ? 'bg-green-500/20 text-green-300'
                                : item.evidenceMatch.location === 'original'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : item.evidenceMatch.location === 'processed'
                                    ? 'bg-cyan-500/20 text-cyan-300'
                                    : 'bg-gray-800 text-gray-500'
                            }`}>
                              {getEvidenceLocationLabel(item.evidenceMatch.location)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900 text-gray-400">
                              关键词 {item.evidenceMatch.matchedKeywords.length} 个
                            </span>
                            {activeCoverageFactId === item.factId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                当前聚焦
                              </span>
                            )}
                          </div>
                        </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {visibleCoverage.length === 0 && (
                  <div className="text-xs text-gray-500">
                    {onlyMissingCoverage
                      ? '当前筛选条件下无缺失项。'
                      : selectedFactId !== 'all'
                        ? '当前事实点暂无覆盖明细。'
                        : '暂无覆盖明细。'}
                  </div>
                )}

                {preprocessResult.adjustments && preprocessResult.adjustments.length > 0 && (
                  <div>
                    <div className="text-[11px] text-gray-500 mb-1">校准动作</div>
                    <div className="flex flex-wrap gap-1.5">
                      {preprocessResult.adjustments.map((adj, idx) => (
                        <span key={`${adj}-${idx}`} className="text-[11px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded">
                          {adj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

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

      {/* F3: 覆盖率门禁警告横幅 */}
      {coverageGateTriggered && (
        <div
          role="alert"
          aria-label="覆盖率门禁警告"
          className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 space-y-1.5"
        >
          <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
            <span>⚠️</span>
            <span>
              覆盖率门禁：当前覆盖率 {Math.round(coverageSummary.keptRatio * 100)}%，低于阈值 {Math.round(COVERAGE_GATE_THRESHOLD * 100)}%
            </span>
          </div>
          <div className="text-[11px] text-amber-400/80">
            缺失 {coverageSummary.missingCount} 条事实点，建议先补齐再生成，否则可能导致信息遗漏。
          </div>
          <div className="flex flex-wrap gap-2">
            {missingFacts.length > 0 && (
              <button
                type="button"
                onClick={handleRepairMissingFacts}
                className="text-[11px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
              >
                补齐 {missingFacts.length} 项缺失——解除门禁
              </button>
            )}
            <button
              type="button"
              onClick={handleBypassCoverageGateOnce}
              className="text-[11px] px-2.5 py-1 rounded bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 transition-colors"
            >
              继续生成（临时忽略门禁）
            </button>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={!hasContent || isGenerating || isPreprocessing}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium"
      >
        {isGenerating || isPreprocessing ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {isPreprocessing ? '预处理中...' : '生成中...'}
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

          {importGateTriggered && (
            <div
              role="alert"
              aria-label="导入门禁警告"
              className="mx-4 mt-3 mb-1 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 space-y-1.5"
            >
              <div className="text-xs text-amber-300 font-medium">
                导入门禁：当前覆盖率 {Math.round(coverageSummary.keptRatio * 100)}%，低于阈值 {Math.round(COVERAGE_GATE_THRESHOLD * 100)}%
              </div>
              <div className="text-[11px] text-amber-400/80">
                为避免低覆盖率分镜直接入库，已阻断导入。建议先补齐事实后重新生成。
              </div>
              <button
                type="button"
                onClick={handleBypassImportGateOnce}
                className="text-[11px] px-2.5 py-1 rounded bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                导入全部分镜（临时忽略门禁）
              </button>
            </div>
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
