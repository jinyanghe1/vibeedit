import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMPLIANCE_NOTICE,
  WebNovelInspirationService
} from '../../src/services/webNovelInspirationService';
import { callLLMByBackend, searchBaiduByBackend } from '../../src/services/backendProxy';

vi.mock('../../src/services/backendProxy', () => ({
  callLLMByBackend: vi.fn(),
  searchBaiduByBackend: vi.fn()
}));

describe('WebNovelInspirationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('runs full generation pipeline and deduplicates search results', async () => {
    const progress = vi.fn();
    vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('1. 重生逆袭爽文\n2. 系统升级流')
      .mockResolvedValueOnce('主角意外重生，逆袭翻盘，走向巅峰。')
      .mockResolvedValueOnce('【反转1】剧情片段【爽点1】')
      .mockResolvedValueOnce('正文内容'.repeat(120));

    vi.mocked(searchBaiduByBackend)
      .mockResolvedValueOnce({
        title: '重生逆袭爽文',
        snippet: 'A',
        url: 'https://a',
        source: 'Baidu'
      })
      .mockResolvedValueOnce({
        title: '重生逆袭爽文',
        snippet: 'A-dup',
        url: 'https://dup',
        source: 'Baidu'
      });

    const service = new WebNovelInspirationService({
      provider: 'bytedance',
      apiKey: 'key',
      apiUrl: '',
      model: ''
    });

    const result = await service.generate(['重生'], '都市', progress);

    expect(progress).toHaveBeenNthCalledWith(1, '正在生成检索词...');
    expect(progress).toHaveBeenNthCalledWith(2, '正在检索参考资料...');
    expect(progress).toHaveBeenNthCalledWith(3, '正在创作故事梗概...');
    expect(progress).toHaveBeenNthCalledWith(4, '正在生成情节片段...');
    expect(progress).toHaveBeenNthCalledWith(5, '正在扩写正文（约1000字）...');
    expect(result.keywords).toEqual(['重生']);
    expect(result.enhancedQueries).toEqual(['重生逆袭爽文', '系统升级流']);
    expect(result.searchResults).toHaveLength(1);
    expect(result.complianceNotice).toBe(COMPLIANCE_NOTICE);
  });

  it('falls back to reference placeholders when all internet search requests fail', async () => {
    vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('检索词A\n检索词B\n检索词C')
      .mockResolvedValueOnce('梗概')
      .mockResolvedValueOnce('片段')
      .mockResolvedValueOnce('正文'.repeat(300));
    vi.mocked(searchBaiduByBackend).mockRejectedValue(new Error('network'));

    const service = new WebNovelInspirationService({
      provider: 'bytedance',
      apiKey: 'key',
      apiUrl: '',
      model: ''
    });

    const result = await service.generate(['修仙']);
    expect(result.searchResults).toHaveLength(3);
    expect(result.searchResults[0].source).toBe('Reference');
  });

  it('degrades to mock mode when llm call fails', async () => {
    vi.useFakeTimers();
    const progress = vi.fn();
    vi.mocked(callLLMByBackend).mockRejectedValue(new Error('llm down'));

    const service = new WebNovelInspirationService({
      provider: 'openai',
      apiKey: 'key',
      apiUrl: '',
      model: ''
    });

    const task = service.generate(['系统'], undefined, progress);
    await vi.advanceTimersByTimeAsync(3600);
    const result = await task;

    expect(progress).toHaveBeenCalledWith('API调用失败，使用模拟模式...');
    expect(result.outline).toContain('系统');
    expect(result.complianceNotice).toBe(COMPLIANCE_NOTICE);
    expect(result.searchResults[0].source).toBe('Mock');
  });
});
