/**
 * LLM 响应解析工具函数
 * 用于解析 LLM 返回的 JSON 格式数据
 */

/**
 * 从 LLM 响应文本中提取 JSON 内容
 * @param response LLM 的原始响应文本
 * @returns 提取到的 JSON 字符串
 */
export function extractJsonFromResponse(response: string): string {
  // 尝试匹配 ```json ... ``` 代码块
  const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  
  // 尝试匹配 ``` ... ``` 通用代码块
  const genericBlockMatch = response.match(/```\s*([\s\S]*?)```/);
  if (genericBlockMatch) {
    return genericBlockMatch[1].trim();
  }
  
  // 尝试匹配 { ... } JSON 对象
  const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0].trim();
  }
  
  // 如果没有匹配到任何格式，返回原始文本
  return response.trim();
}

/**
 * 安全地解析 JSON 字符串
 * @param jsonString JSON 字符串
 * @returns 解析后的对象，失败返回 null
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}

/**
 * 从 LLM 响应中解析分镜数据
 * @param response LLM 响应文本
 * @returns 解析结果对象
 */
export function parseShotsFromLLMResponse(response: string): { 
  shots: Array<{ description: string; duration: number; assetRefs: string[]; factRefs?: string[] }>;
  summary?: string;
} | null {
  const jsonStr = extractJsonFromResponse(response);
  const data = safeJsonParse<{
    shots?: Array<{ description?: string; duration?: number; assetRefs?: string[]; factRefs?: string[] }>;
    summary?: string;
  }>(jsonStr);
  
  if (!data || !Array.isArray(data.shots)) {
    return null;
  }
  
  const validShots = data.shots.map((shot, index) => {
    const factRefs = Array.isArray(shot.factRefs)
      ? shot.factRefs
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
      : undefined;
    return {
      description: String(shot.description || `分镜 ${index + 1}`),
      duration: Math.min(Math.max(Number(shot.duration) || 5, 1), 30),
      assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs : [],
      ...(factRefs ? { factRefs } : {})
    };
  });
  
  return {
    shots: validShots,
    summary: data.summary || `成功生成 ${validShots.length} 个分镜`
  };
}

/**
 * 备用解析：从非 JSON 格式文本中提取分镜信息
 * @param response LLM 响应文本
 * @returns 解析结果
 */
export function fallbackParseShots(response: string): { 
  shots: Array<{ description: string; duration: number; assetRefs: string[]; factRefs?: string[] }>;
  summary: string;
} {
  const shots: Array<{ description: string; duration: number; assetRefs: string[]; factRefs?: string[] }> = [];
  const lines = response.split('\n');
  let currentShot: { description: string; duration: number; assetRefs: string[]; factRefs?: string[] } | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 匹配分镜标题格式：分镜 1: 或 1. 或 Shot 1:
    if (/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]/i.test(trimmed)) {
      if (currentShot) {
        shots.push(currentShot);
      }
      currentShot = {
        description: trimmed.replace(/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]\s*/i, ''),
        duration: 5,
        assetRefs: []
      };
    } else if (currentShot && trimmed) {
      if (!currentShot.description.includes(trimmed)) {
        currentShot.description += ' ' + trimmed;
      }
    }
  }
  
  if (currentShot) {
    shots.push(currentShot);
  }
  
  if (shots.length === 0) {
    shots.push({
      description: '剧本场景：' + response.substring(0, 100) + '...',
      duration: 5,
      assetRefs: []
    });
  }
  
  return {
    shots,
    summary: `解析到 ${shots.length} 个分镜（备用解析）`
  };
}
