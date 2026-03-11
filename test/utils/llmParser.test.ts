import { describe, expect, it } from 'vitest';
import {
  extractJsonFromResponse,
  fallbackParseShots,
  parseShotsFromLLMResponse,
  safeJsonParse
} from '../../src/utils/llmParser';

describe('llmParser utils', () => {
  it('extractJsonFromResponse supports json code block, generic block, object and raw text', () => {
    expect(extractJsonFromResponse('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonFromResponse('```\n{"b":2}\n```')).toBe('{"b":2}');
    expect(extractJsonFromResponse('prefix {"c":3} suffix')).toBe('{"c":3}');
    expect(extractJsonFromResponse('plain text')).toBe('plain text');
  });

  it('safeJsonParse returns object on success and null on invalid json', () => {
    expect(safeJsonParse<{ x: number }>('{\"x\":1}')).toEqual({ x: 1 });
    expect(safeJsonParse<{ x: number }>('{x:1}')).toBeNull();
  });

  it('parseShotsFromLLMResponse parses and normalizes shot fields', () => {
    const result = parseShotsFromLLMResponse(
      '```json\n{"shots":[{"description":"A","duration":60,"assetRefs":["hero"]},{"duration":0}],"summary":"ok"}\n```'
    );

    expect(result).toEqual({
      shots: [
        { description: 'A', duration: 30, assetRefs: ['hero'] },
        { description: '分镜 2', duration: 5, assetRefs: [] }
      ],
      summary: 'ok'
    });
  });

  it('parseShotsFromLLMResponse returns null when payload has no shots array', () => {
    expect(parseShotsFromLLMResponse('{\"summary\":\"x\"}')).toBeNull();
    expect(parseShotsFromLLMResponse('not-json')).toBeNull();
  });

  it('fallbackParseShots parses numbered sections', () => {
    const result = fallbackParseShots('分镜1: 开场街景\n主角出现\n分镜2: 冲突升级');

    expect(result.shots).toHaveLength(2);
    expect(result.shots[0].description).toContain('开场街景');
    expect(result.shots[0].description).toContain('主角出现');
    expect(result.summary).toContain('解析到 2 个分镜');
  });

  it('fallbackParseShots creates default shot when structured lines are absent', () => {
    const result = fallbackParseShots('只有一段普通描述，没有编号格式');

    expect(result.shots).toHaveLength(1);
    expect(result.shots[0].description).toContain('剧本场景：');
  });
});
