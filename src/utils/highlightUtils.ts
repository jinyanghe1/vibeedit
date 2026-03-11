/**
 * 高亮词处理工具
 * 用于预处理 evidence 归一化与高亮词选择逻辑
 */

import type { RichTextPreprocessResult } from '../types';

/**
 * 从 evidence 文本中提取关键词
 * 策略：提取名词短语、引号内容、关键动词等
 */
export function extractKeywordsFromEvidence(evidence: string): string[] {
  if (!evidence?.trim()) return [];
  
  const keywords: string[] = [];
  
  // 1. 提取引号内容（通常是关键术语）
  const quotedMatches = evidence.match(/[""']([^""']+)[""']/g);
  if (quotedMatches) {
    quotedMatches.forEach(match => {
      const content = match.replace(/[""']/g, '').trim();
      if (content.length >= 2 && content.length <= 20) {
        keywords.push(content);
      }
    });
  }
  
  // 2. 提取书名号内容
  const bookMatches = evidence.match(/《([^》]+)》/g);
  if (bookMatches) {
    bookMatches.forEach(match => {
      const content = match.replace(/[《》]/g, '').trim();
      if (content.length >= 2) {
        keywords.push(content);
      }
    });
  }
  
  // 3. 提取"XX性"、"XX化"、"XX度"等术语
  const termMatches = evidence.match(/[\u4e00-\u9fa5]{2,}(性|化|度|率|力|型|模式)/g);
  if (termMatches) {
    termMatches.forEach(term => {
      if (term.length >= 3 && term.length <= 12) {
        keywords.push(term);
      }
    });
  }
  
  // 4. 提取数字+单位组合
  const numberMatches = evidence.match(/\d+[\d\.]*\s*[\u4e00-\u9fa5a-zA-Z]+/g);
  if (numberMatches) {
    numberMatches.forEach(match => {
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
  
  // 去重并返回
  return [...new Set(keywords)].filter(k => k.length >= 2);
}

/**
 * 从事实描述中提取核心名词
 */
export function extractCoreNouns(factText: string): string[] {
  if (!factText?.trim()) return [];
  
  const keywords: string[] = [];
  
  // 1. 提取引号内容
  const quotedMatches = factText.match(/[""']([^""']+)[""']/g);
  if (quotedMatches) {
    quotedMatches.forEach(match => {
      const content = match.replace(/[""']/g, '').trim();
      if (content.length >= 2 && content.length <= 20) {
        keywords.push(content);
      }
    });
  }
  
  // 2. 提取书名号内容
  const bookMatches = factText.match(/《([^》]+)》/g);
  if (bookMatches) {
    bookMatches.forEach(match => {
      keywords.push(match);
    });
  }
  
  // 3. 提取连续2-8个汉字的名词短语（简单启发式）
  const nounMatches = factText.match(/[\u4e00-\u9fa5]{2,8}/g);
  if (nounMatches) {
    // 过滤掉常见虚词和过短词汇
    const stopWords = new Set(['这是', '那是', '一个', '一种', '这个', '那个', '其中', '因此', '所以', '但是', '然而']);
    nounMatches.forEach(term => {
      if (!stopWords.has(term) && term.length >= 3) {
        keywords.push(term);
      }
    });
  }
  
  return [...new Set(keywords)].slice(0, 5); // 限制数量，取最前面的
}

/**
 * 计算高亮词列表（融合事实词 + 证据词）
 * @param result 预处理结果
 * @param selectedFactId 选中的事实ID，'all' 表示全部
 * @returns 高亮词列表（按优先级排序）
 */
export function computeHighlightKeywords(
  result: RichTextPreprocessResult,
  selectedFactId: string = 'all'
): string[] {
  const keywords: string[] = [];
  
  // 1. 收集目标事实列表
  let targetFacts = result.detectedFacts || [];
  let targetCoverage = result.coverageChecklist || [];
  
  if (selectedFactId !== 'all') {
    targetFacts = targetFacts.filter(f => f.id === selectedFactId);
    targetCoverage = targetCoverage.filter(c => c.factId === selectedFactId);
  }
  
  // 2. 从事实描述中提取核心名词（高优先级）
  targetFacts.forEach(fact => {
    const coreNouns = extractCoreNouns(fact.fact);
    keywords.push(...coreNouns);
    // 事实本身作为关键词
    if (fact.fact.length <= 30) {
      keywords.push(fact.fact);
    }
  });
  
  // 3. 从 evidence 中提取关键词（次优先级）
  targetCoverage.forEach(item => {
    if (item.evidence) {
      const evidenceKeywords = extractKeywordsFromEvidence(item.evidence);
      keywords.push(...evidenceKeywords);
    }
  });
  
  // 4. 去重并排序（长的优先，更具体的词优先匹配）
  const uniqueKeywords = [...new Set(keywords)]
    .filter(k => k.length >= 2)
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
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = sortedKeywords.map(k => escapeRegExp(k)).join('|');
  
  try {
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map(part => {
      const matchedKeyword = sortedKeywords.find(
        k => k.toLowerCase() === part.toLowerCase()
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
  
  keywords.forEach(keyword => {
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
