import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ByteDanceLLMService,
  generateVideoWithByteDance,
  hasByteDanceConfig
} from '../../src/services/bytedanceService';
import { callLLMByBackend, generateTextImageByBackend } from '../../src/services/backendProxy';
import type { ApiConfig } from '../../src/types';

vi.mock('../../src/services/backendProxy', () => ({
  callLLMByBackend: vi.fn(),
  generateTextImageByBackend: vi.fn()
}));

const baseApiConfig: ApiConfig = {
  provider: 'bytedance',
  apiKey: 'video-key',
  apiUrl: ''
};

describe('bytedanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateVideoWithByteDance throws when api key is missing', async () => {
    await expect(generateVideoWithByteDance(
      'desc',
      [],
      {},
      { ...baseApiConfig, apiKey: '' }
    )).rejects.toThrow('ByteDance API Key 未配置');
  });

  it('generateVideoWithByteDance injects assets and style into prompt', async () => {
    vi.mocked(generateTextImageByBackend).mockResolvedValue({
      data: { video_url: 'https://cdn.example.com/v.mp4' }
    });

    const result = await generateVideoWithByteDance(
      '夜景追逐',
      ['hero'],
      {
        hero: {
          id: 'a1',
          name: 'hero',
          type: 'image',
          url: 'https://img.example.com/hero.png',
          createdAt: 1
        }
      },
      baseApiConfig,
      {
        enabled: true,
        styleDescription: '赛博朋克',
        colorPalette: '蓝紫',
        lighting: '高对比',
        mood: '紧张'
      }
    );

    expect(result.url).toBe('https://cdn.example.com/v.mp4');
    expect(result.prompt).toContain('参考图像: https://img.example.com/hero.png');
    expect(result.prompt).toContain('画面风格要求: 赛博朋克');
    expect(vi.mocked(generateTextImageByBackend)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'seededit',
        referenceImages: ['https://img.example.com/hero.png']
      })
    );
  });

  it('generateVideoWithByteDance resolves url using multiple fallbacks', async () => {
    vi.mocked(generateTextImageByBackend).mockResolvedValue({
      data: { data: { video_url: 'https://deep.example.com/deep.mp4' } }
    });

    const result = await generateVideoWithByteDance('desc', [], {}, baseApiConfig);
    expect(result.url).toBe('https://deep.example.com/deep.mp4');
  });

  it('ByteDanceLLMService generateFromScript parses structured json and reports progress', async () => {
    const progress = vi.fn();
    vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('分析完成')
      .mockResolvedValueOnce(
        '```json\n{"shots":[{"description":"@小红出场","duration":6,"assetRefs":["小红"]}],"summary":"结构化"}\n```'
      );

    const service = new ByteDanceLLMService({
      provider: 'bytedance',
      apiKey: 'llm-key',
      apiUrl: '',
      model: ''
    });

    const result = await service.generateFromScript('剧本内容', progress);

    expect(progress).toHaveBeenNthCalledWith(1, '正在分析剧本...');
    expect(progress).toHaveBeenNthCalledWith(2, '正在生成分镜...');
    expect(progress).toHaveBeenLastCalledWith('生成完成！共 1 个分镜');
    expect(result.summary).toBe('结构化');
    expect(result.shots[0].description).toBe('@小红出场');

    expect(vi.mocked(callLLMByBackend)).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'bytedance',
      apiKey: 'llm-key',
      apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: 'doubao-seed-1-6-251015'
    }));
  });

  it('ByteDanceLLMService falls back to text parser when llm output is not json', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('分析完成')
      .mockResolvedValueOnce('分镜1: 开场\n分镜2: 冲突');

    const service = new ByteDanceLLMService({
      provider: 'bytedance',
      apiKey: 'llm-key',
      apiUrl: 'https://example.com',
      model: 'm'
    });

    const result = await service.generateFromScript('剧本');
    expect(result.shots).toHaveLength(2);
    expect(result.summary).toContain('解析到 2 个分镜');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('hasByteDanceConfig checks apiKey presence', () => {
    expect(hasByteDanceConfig({ provider: 'bytedance', apiKey: 'x', apiUrl: '' })).toBe(true);
    expect(hasByteDanceConfig({ provider: 'bytedance', apiKey: '', apiUrl: '' })).toBe(false);
  });
});
