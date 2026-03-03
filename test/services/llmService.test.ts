import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMService } from '../../src/services/llmService';

const createByteDanceService = () =>
  new LLMService({
    provider: 'bytedance',
    apiKey: 'test-api-key',
    apiUrl: 'https://example.com/chat',
    model: 'test-model'
  });

describe('LLMService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('API Key 缺失时应直接抛错', async () => {
    const service = new LLMService({
      provider: 'bytedance',
      apiKey: '',
      apiUrl: 'https://example.com/chat',
      model: 'test-model'
    });

    await expect(service.generateFromScript('测试剧本')).rejects.toThrow('API Key 未配置');
  });

  it('能解析 JSON 结果并输出结构化分镜', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '这是第一轮分析结果' } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '```json\n{"shots":[{"description":"@小红出场","duration":6,"assetRefs":["小红"]}],"summary":"结构化输出"}\n```'
              }
            }
          ]
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    const service = createByteDanceService();
    const progressSpy = vi.fn();
    const result = await service.generateFromScript('测试剧本', progressSpy);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe('结构化输出');
    expect(result.shots).toHaveLength(1);
    expect(result.shots[0]).toEqual({
      description: '@小红出场',
      duration: 6,
      assetRefs: ['小红']
    });
    expect(progressSpy).toHaveBeenNthCalledWith(1, '正在分析剧本...');
    expect(progressSpy).toHaveBeenNthCalledWith(2, '正在生成分镜...');
  });

  it('当模型返回非 JSON 时会进入备用解析', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '分析阶段输出' } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '分镜1: 城市夜景开场\n分镜2: 主角进入仓库\n分镜3: 冲突爆发'
              }
            }
          ]
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    const service = createByteDanceService();
    const result = await service.generateFromScript('测试剧本');

    expect(result.shots).toHaveLength(3);
    expect(result.shots[0].description).toContain('城市夜景开场');
    expect(result.shots[1].description).toContain('主角进入仓库');
    expect(result.summary).toContain('解析到 3 个分镜');
    expect(errorSpy).toHaveBeenCalled();
  });
});
