import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callLLMByBackend,
  generateTextImageByBackend,
  searchBaiduByBackend
} from '../../src/services/backendProxy';

const mockFetch = vi.fn();

describe('backendProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('callLLMByBackend returns trimmed content on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ content: '  hello world  ' })
    });

    const content = await callLLMByBackend({
      provider: 'bytedance',
      apiKey: 'k',
      apiUrl: 'https://example.com',
      model: 'm',
      prompt: 'p'
    });

    expect(content).toBe('hello world');
    expect(mockFetch).toHaveBeenCalledWith('/api/llm/chat', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('callLLMByBackend throws detail message when backend fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ details: 'invalid prompt' })
    });

    await expect(callLLMByBackend({
      provider: 'bytedance',
      apiKey: 'k',
      apiUrl: 'https://example.com',
      model: 'm',
      prompt: 'p'
    })).rejects.toThrow('invalid prompt');
  });

  it('callLLMByBackend falls back to status code when response body is not json', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('bad json'))
    });

    await expect(callLLMByBackend({
      provider: 'bytedance',
      apiKey: 'k',
      apiUrl: 'https://example.com',
      model: 'm',
      prompt: 'p'
    })).rejects.toThrow('LLM 代理请求失败: HTTP 500');
  });

  it('searchBaiduByBackend returns item fields and fallback defaults', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        item: {
          title: '百科词条',
          snippet: '摘要',
          source: 'Baidu'
        }
      })
    });

    const item = await searchBaiduByBackend('测试词');

    expect(item).toEqual({
      title: '百科词条',
      snippet: '摘要',
      url: '#',
      source: 'Baidu'
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/search/baidu?query=%E6%B5%8B%E8%AF%95%E8%AF%8D',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('searchBaiduByBackend throws detail error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: 'blocked' })
    });

    await expect(searchBaiduByBackend('测试词')).rejects.toThrow('blocked');
  });

  it('generateTextImageByBackend returns backend payload object', async () => {
    const payload = { url: 'https://video.mp4', data: { video_url: 'x' } };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(payload)
    });

    const result = await generateTextImageByBackend({
      provider: 'bytedance',
      apiKey: 'k',
      apiUrl: 'https://example.com',
      model: 'seededit',
      prompt: 'p'
    });

    expect(result).toEqual(payload);
  });

  it('generateTextImageByBackend returns empty object for non-object payload', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue('not-object')
    });

    const result = await generateTextImageByBackend({
      provider: 'bytedance',
      apiKey: 'k',
      apiUrl: 'https://example.com',
      model: 'seededit',
      prompt: 'p'
    });

    expect(result).toEqual({});
  });

  it('generateTextImageByBackend throws status fallback when no detail exists', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(generateTextImageByBackend({
      provider: 'bytedance',
      apiKey: 'k',
      apiUrl: 'https://example.com',
      model: 'seededit',
      prompt: 'p'
    })).rejects.toThrow('文生图/视频代理请求失败: HTTP 502');
  });
});
