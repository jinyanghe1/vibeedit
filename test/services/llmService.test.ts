import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callLLMByBackend } from '../../src/services/backendProxy';
import { LLMService } from '../../src/services/llmService';

vi.mock('../../src/services/backendProxy', () => ({
  callLLMByBackend: vi.fn()
}));

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
    vi.clearAllMocks();
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
    const backendMock = vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('这是第一轮分析结果')
      .mockResolvedValueOnce(
        '```json\n{"shots":[{"description":"@小红出场","duration":6,"assetRefs":["小红"]}],"summary":"结构化输出"}\n```'
      );

    const service = createByteDanceService();
    const progressSpy = vi.fn();
    const result = await service.generateFromScript('测试剧本', progressSpy);

    expect(backendMock).toHaveBeenCalledTimes(2);
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
    vi.mocked(callLLMByBackend)
      .mockResolvedValueOnce('分析阶段输出')
      .mockResolvedValueOnce('分镜1: 城市夜景开场\n分镜2: 主角进入仓库\n分镜3: 冲突爆发');

    const service = createByteDanceService();
    const result = await service.generateFromScript('测试剧本');

    expect(result.shots).toHaveLength(3);
    expect(result.shots[0].description).toContain('城市夜景开场');
    expect(result.shots[1].description).toContain('主角进入仓库');
    expect(result.summary).toContain('解析到 3 个分镜');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns default model and api url by provider', () => {
    expect(LLMService.getDefaultModel('bytedance')).toBeTruthy();
    expect(LLMService.getDefaultApiUrl('openai')).toContain('openai.com');
  });

  it('generatePublishContent parses json response', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '```json\n{"title":"标题A","content":"内容A","tags":["剧情","悬疑"]}\n```'
    );

    const service = createByteDanceService();
    const result = await service.generatePublishContent(
      '剧本',
      [{ description: '镜头', duration: 5, assetRefs: [] }],
      'bilibili'
    );

    expect(result).toEqual({
      platform: 'bilibili',
      title: '标题A',
      content: '内容A',
      tags: ['剧情', '悬疑']
    });
  });

  it('generatePublishContent falls back to regex extraction when json parse fails', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValue(
      '标题：爆款标题\n内容：这是一段正文\n标签：热血,剧情,反转'
    );

    const service = createByteDanceService();
    const result = await service.generatePublishContent(
      '剧本',
      [{ description: '镜头', duration: 5, assetRefs: [] }],
      'douyin'
    );

    expect(result.title).toBe('爆款标题');
    expect(result.content).toBe('这是一段正文');
    expect(result.tags).toEqual(['热血', '剧情', '反转']);
  });

  it('checkCompliance parses json and supports keyword fallback', async () => {
    vi.mocked(callLLMByBackend).mockResolvedValueOnce(
      '{"passed":false,"reason":"包含敏感内容","suggestions":["删改敏感词"]}'
    );

    const service = createByteDanceService();
    const structured = await service.checkCompliance('t', 'c', ['x']);
    expect(structured.passed).toBe(false);
    expect(structured.reason).toContain('敏感');

    vi.mocked(callLLMByBackend).mockResolvedValueOnce('该内容不合规，包含违规信息');
    const fallback = await service.checkCompliance('t', 'c', ['x']);
    expect(fallback.passed).toBe(false);
    expect(fallback.reason).toContain('请人工复核');
  });
});
