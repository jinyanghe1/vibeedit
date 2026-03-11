/**
 * 高亮词处理工具
 * 用于预处理 evidence 归一化与高亮词选择逻辑
 */

import type { RichTextPreprocessResult } from '../types';

export interface CoverageChecklistItem {
  factId: string;
  kept: boolean;
  evidence?: string;
}

const EVIDENCE_STOPWORDS = new Set([
  '第1段',
  '第2段',
  '第3段',
  '第4段',
  '第5段',
  '保留',
  '缺失',
  '补回',
  '补充',
  '信息',
  '说明',
  '体现',
  '内容'
]);

export function normalizeKeyword(value: string): string {
  return value
    .trim()
    .replace(/^第\d+段/, '')
    .replace(/^(保留|缺失|补回|补充|体现|提及|说明)/, '')
    .replace(/(保留|缺失|补回|补充|体现|提及|说明)$/g, '')
    .trim();
}

export function summarizeCoverage(items: CoverageChecklistItem[]): {
  total: number;
  keptCount: number;
  missingCount: number;
  keptRatio: number;
} {
  const total = items.length;
  const keptCount = items.filter((item) => item.kept).length;
  const missingCount = total - keptCount;
  return {
    total,
    keptCount,
    missingCount,
    keptRatio: total > 0 ? keptCount / total : 1
  };
}

/**
 * 从 evidence 文本中提取关键词
 * 策略：提取名词短语、引号内容、关键动词等
 */
export function extractKeywordsFromEvidence(evidence: string): string[] {
  if (!evidence?.trim()) return [];
  
  const keywords: string[] = [];
  
  // 1. 提取引号内容（通常是关键术语）
  const quotedMatches = evidence.match(/["']([^"']+)["']/g);
  if (quotedMatches) {
    quotedMatches.forEach((match) => {
      const content = match.replace(/["']/g, '').trim();
      if (content.length >= 2 && content.length <= 20) {
        keywords.push(content);
      }
    });
  }
  
  // 2. 提取书名号内容
  const bookMatches = evidence.match(/《([^》]+)》/g);
  if (bookMatches) {
    bookMatches.forEach((match) => {
      const content = match.replace(/[《》]/g, '').trim();
      if (content.length >= 2) {
        keywords.push(content);
      }
    });
  }
  
  // 3. 提取"XX性"、"XX化"、"XX度"等术语
  const termMatches = evidence.match(/[\u4e00-\u9fa5]{2,}(性|化|度|率|力|型|模式)/g);
  if (termMatches) {
    termMatches.forEach((term) => {
      if (term.length >= 3 && term.length <= 12) {
        keywords.push(term);
      }
    });
  }
  
  // 4. 提取数字+单位组合
  const numberMatches = evidence.match(/\d+[\d\.]*\s*[\u4e00-\u9fa5a-zA-Z]+/g);
  if (numberMatches) {
    numberMatches.forEach((match) => {
      if (match.length >= 2 && match.length <= 15) {
        keywords.push(match);
      }
    });
  }
  
  // 5. 提取"在第X段"、"在结尾"等位置指示词
  const positionMatches = evidence.match(/(第[一二三四五六七八九十\d]+[段章节]|开头|结尾|前言|结论)/g);
  if (positionMatches) {
    keywords.push(...positionMatches);
  }

  // 6. 兜底提取连续词块，避免纯自然语言 evidence 完全无关键词
  const genericMatches = evidence.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g);
  if (genericMatches) {
    keywords.push(...genericMatches);
  }
  
  // 去重并返回
  return [...new Set(keywords)]
    .map((item) => normalizeKeyword(item))
    .filter((item) => item.length >= 2 && !EVIDENCE_STOPWORDS.has(item));
}

export function extractEvidenceKeywordsFromCoverage(
  items: CoverageChecklistItem[],
  limit = 8
): string[] {
  const keywords = new Set<string>();
  for (const item of items) {
    if (!item.evidence) continue;
    for (const keyword of extractKeywordsFromEvidence(item.evidence)) {
      if (keyword.length < 2 || EVIDENCE_STOPWORDS.has(keyword)) continue;
      keywords.add(keyword);
      if (keywords.size >= limit) break;
    }
    if (keywords.size >= limit) break;
  }
  return Array.from(keywords);
}

/**
 * 从事实描述中提取核心名词
 */
export function extractCoreNouns(factText: string): string[] {
  if (!factText?.trim()) return [];
  
  const keywords: string[] = [];
  
  // 1. 提取引号内容
  const quotedMatches = factText.match(/["']([^"']+)["']/g);
  if (quotedMatches) {
    quotedMatches.forEach((match) => {
      const content = match.replace(/["']/g, '').trim();
      if (content.length >= 2 && content.length <= 20) {
        keywords.push(content);
      }
    });
  }
  
  // 2. 提取书名号内容
  const bookMatches = factText.match(/《([^》]+)》/g);
  if (bookMatches) {
    bookMatches.forEach((match) => {
      keywords.push(match);
    });
  }
  
  // 3. 提取连续2-8个汉字的名词短语（简单启发式）
  const nounMatches = factText.match(/[\u4e00-\u9fa5]{2,8}/g);
  if (nounMatches) {
    // 过滤掉常见虚词和过短词汇
    const stopWords = new Set(['这是', '那是', '一个', '一种', '这个', '那个', '其中', '因此', '所以', '但是', '然而']);
    nounMatches.forEach((term) => {
      if (!stopWords.has(term) && term.length >= 3) {
        keywords.push(term);
      }
    });
  }
  
  return [...new Set(keywords)].map((item) => normalizeKeyword(item)).filter(Boolean).slice(0, 5);
}

/**
 * 计算高亮词列表（融合事实词 + 证据词）
 * @param result 预处理结果
 * @param selectedFactId 选中的事实ID，'all' 表示全部
 * @returns 高亮词列表（按优先级排序）
 */
export function computeHighlightKeywords(
  result: RichTextPreprocessResult,
  selectedFactId: string = 'all',
  coverageItems?: CoverageChecklistItem[]
): string[] {
  const keywords: string[] = [];
  
  // 1. 收集目标事实列表
  let targetFacts = result.detectedFacts || [];
  let targetCoverage = coverageItems || result.coverageChecklist || [];
  
  if (selectedFactId !== 'all') {
    targetFacts = targetFacts.filter((f) => f.id === selectedFactId);
    targetCoverage = targetCoverage.filter((c) => c.factId === selectedFactId);
  }
  
  // 2. 从事实描述中提取核心名词（高优先级）
  targetFacts.forEach((fact) => {
    const coreNouns = extractCoreNouns(fact.fact);
    keywords.push(...coreNouns);
    // 事实本身作为关键词
    if (fact.fact.length <= 30) {
      keywords.push(normalizeKeyword(fact.fact));
    }
  });
  
  // 3. 从 evidence 中提取关键词（次优先级）
  targetCoverage.forEach((item) => {
    if (item.evidence) {
      const evidenceKeywords = extractKeywordsFromEvidence(item.evidence);
      keywords.push(...evidenceKeywords);
    }
  });
  
  // 4. 去重并排序（长的优先，更具体的词优先匹配）
  const uniqueKeywords = [...new Set(keywords)]
    .map((item) => normalizeKeyword(item))
    .filter((item) => item.length >= 2 && !EVIDENCE_STOPWORDS.has(item))
    .sort((a, b) => b.length - a.length);
  
  // 5. 限制数量，避免过多高亮影响阅读
  return uniqueKeywords.slice(0, 10);
}

/**
 * 为文本生成高亮片段
 * @param text 原文本
 * @param keywords 关键词列表
 * @returns 高亮片段数组（用于分段渲染）
 */
export interface HighlightSegment {
  text: string;
  isHighlight: boolean;
  matchedKeyword?: string;
}

export function generateHighlightSegments(
  text: string,
  keywords: string[]
): HighlightSegment[] {
  if (!text || keywords.length === 0) {
    return [{ text, isHighlight: false }];
  }
  
  // 构建正则表达式（按长度排序，优先匹配长词）
  const sortedKeywords = [...keywords]
    .map((item) => normalizeKeyword(item))
    .filter((item) => item.length >= 2)
    .sort((a, b) => b.length - a.length);
  const pattern = sortedKeywords.map((k) => escapeRegExp(k)).join('|');
  
  try {
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part) => {
      const matchedKeyword = sortedKeywords.find(
        (k) => k.toLowerCase() === part.toLowerCase()
      );
      return {
        text: part,
        isHighlight: !!matchedKeyword,
        matchedKeyword
      };
    });
  } catch {
    // 正则表达式失败时返回原文
    return [{ text, isHighlight: false }];
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 检查证据是否能在正文中找到对应内容（用于降级提示）
 * @param evidence 证据文本
 * @param originalText 原文
 * @param processedText 预处理后文本
 * @returns 匹配结果
 */
export function checkEvidenceMatch(
  evidence: string,
  originalText: string,
  processedText: string
): {
  found: boolean;
  location: 'original' | 'processed' | 'both' | 'none';
  matchedKeywords: string[];
} {
  const keywords = extractKeywordsFromEvidence(evidence);
  
  let foundInOriginal = false;
  let foundInProcessed = false;
  const matchedKeywords: string[] = [];
  
  keywords.forEach((keyword) => {
    const inOriginal = originalText.toLowerCase().includes(keyword.toLowerCase());
    const inProcessed = processedText.toLowerCase().includes(keyword.toLowerCase());
    
    if (inOriginal || inProcessed) {
      matchedKeywords.push(keyword);
    }
    if (inOriginal) foundInOriginal = true;
    if (inProcessed) foundInProcessed = true;
  });
  
  let location: 'original' | 'processed' | 'both' | 'none' = 'none';
  if (foundInOriginal && foundInProcessed) location = 'both';
  else if (foundInOriginal) location = 'original';
  else if (foundInProcessed) location = 'processed';
  
  return {
    found: matchedKeywords.length > 0,
    location,
    matchedKeywords
  };
}

export function getEvidenceLocationLabel(location: 'original' | 'processed' | 'both' | 'none'): string {
  if (location === 'both') return '双端命中';
  if (location === 'original') return '仅原文命中';
  if (location === 'processed') return '仅预处理稿命中';
  return '未命中';
}

/**
 * 证据命中位置信息
 */
export interface EvidenceHitPosition {
  line: number;
  column: number;
  context: string;
}

/**
 * 计算证据在文本中的命中位置
 * @param keyword 关键词
 * @param text 文本内容
 * @returns 命中位置列表
 */
export function findHitPositions(keyword: string, text: string): EvidenceHitPosition[] {
  if (!keyword?.trim() || !text) return [];
  
  const positions: EvidenceHitPosition[] = [];
  const normalizedKeyword = normalizeKeyword(keyword).toLowerCase();
  const lines = text.split('\n');
  
  lines.forEach((line, lineIndex) => {
    const normalizedLine = line.toLowerCase();
    let pos = 0;
    
    while ((pos = normalizedLine.indexOf(normalizedKeyword, pos)) !== -1) {
      // 提取上下文（前后20个字符）
      const start = Math.max(0, pos - 20);
      const end = Math.min(line.length, pos + keyword.length + 20);
      const context = line.slice(start, end);
      
      positions.push({
        line: lineIndex + 1,
        column: pos + 1,
        context: start > 0 ? `...${context}` : context
      });
      
      pos += keyword.length;
    }
  });
  
  return positions.slice(0, 3); // 最多返回3个位置
}

/**
 * 单条覆盖项的完整匹配信息
 */
export interface CoverageItemMatchInfo {
  factId: string;
  kept: boolean;
  evidence?: string;
  matchedKeywords: string[];
  hitPositions: {
    original: EvidenceHitPosition[];
    processed: EvidenceHitPosition[];
  };
  hitLocation: 'original' | 'processed' | 'both' | 'none';
}

/**
 * 计算单条覆盖项的详细匹配信息
 * @param item 覆盖项
 * @param originalText 原文
 * @param processedText 预处理后文本
 * @returns 完整匹配信息
 */
export function computeCoverageItemMatch(
  item: CoverageChecklistItem,
  originalText: string,
  processedText: string
): CoverageItemMatchInfo {
  // 提取关键词
  const keywords = item.evidence ? extractKeywordsFromEvidence(item.evidence) : [];
  
  // 计算命中位置
  const originalPositions: EvidenceHitPosition[] = [];
  const processedPositions: EvidenceHitPosition[] = [];
  const matchedKeywords: string[] = [];
  
  keywords.forEach((keyword) => {
    const origHits = findHitPositions(keyword, originalText);
    const procHits = findHitPositions(keyword, processedText);
    
    if (origHits.length > 0 || procHits.length > 0) {
      matchedKeywords.push(keyword);
      originalPositions.push(...origHits);
      processedPositions.push(...procHits);
    }
  });
  
  // 确定命中位置
  let hitLocation: 'original' | 'processed' | 'both' | 'none' = 'none';
  if (originalPositions.length > 0 && processedPositions.length > 0) hitLocation = 'both';
  else if (originalPositions.length > 0) hitLocation = 'original';
  else if (processedPositions.length > 0) hitLocation = 'processed';
  
  return {
    factId: item.factId,
    kept: item.kept,
    evidence: item.evidence,
    matchedKeywords: [...new Set(matchedKeywords)],
    hitPositions: {
      original: originalPositions.slice(0, 2),
      processed: processedPositions.slice(0, 2)
    },
    hitLocation
  };
}

/**
 * 覆盖率汇总统计
 */
export interface CoverageSummary {
  total: number;
  keptCount: number;
  missingCount: number;
  keptRatio: number;
  hitLocationBreakdown: {
    both: number;
    original: number;
    processed: number;
    none: number;
  };
}

/**
 * 计算覆盖率汇总统计
 * @param items 覆盖项列表
 * @param originalText 原文
 * @param processedText 预处理后文本
 * @returns 覆盖率汇总
 */
export function computeCoverageSummary(
  items: CoverageChecklistItem[],
  originalText: string,
  processedText: string
): CoverageSummary {
  const total = items.length;
  const keptCount = items.filter((item) => item.kept).length;
  const missingCount = total - keptCount;
  
  // 计算命中位置分布
  const hitLocationBreakdown = {
    both: 0,
    original: 0,
    processed: 0,
    none: 0
  };
  
  items.forEach((item) => {
    const matchInfo = computeCoverageItemMatch(item, originalText, processedText);
    hitLocationBreakdown[matchInfo.hitLocation]++;
  });
  
  return {
    total,
    keptCount,
    missingCount,
    keptRatio: total > 0 ? keptCount / total : 1,
    hitLocationBreakdown
  };
}

/**
 * 获取聚焦高亮关键词（针对单条覆盖项）
 * @param item 覆盖项
 * @returns 高亮关键词列表
 */
export function getFocusHighlightKeywords(item: CoverageChecklistItem): string[] {
  if (!item.evidence) return [];
  
  const keywords = extractKeywordsFromEvidence(item.evidence);
  
  // 添加 factId 作为关键词
  keywords.push(item.factId);
  
  return [...new Set(keywords)]
    .map((item) => normalizeKeyword(item))
    .filter((item) => item.length >= 2 && !EVIDENCE_STOPWORDS.has(item))
    .slice(0, 5);
}
