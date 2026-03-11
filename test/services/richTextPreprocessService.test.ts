import { describe, expect, it, vi } from 'vitest';
import { preprocessRichTextWithMultiRound } from '../../src/services/richTextPreprocessService';

describe('richTextPreprocessService self-play pipeline', () => {
  it('converges early when writer/auditor metrics pass thresholds', async () => {
    const llmMock = vi.fn()
      .mockResolvedValueOnce(
        '{"genre":"analysis","coreFacts":[{"id":"F1","fact":"提出问题"},{"id":"F2","fact":"给出对策"}]}'
      )
      .mockResolvedValueOnce(
        '{"rewrittenText":"第一段提出问题。\\n第二段给出对策。\\n第三段说明执行动作。","summary":"三段结构重写","coverageChecklist":[{"factId":"F1","kept":true},{"factId":"F2","kept":true}],"shotAnchors":["问题","对策","动作"]}'
      )
      .mockResolvedValueOnce(
        '{"verdict":"pass","decisionReason":"全部达标","revisionAdvice":"无需修订","lengthRatio":1.0,"coverage":1,"shotAnchorCount":3}'
      );

    const progressSpy = vi.fn();
    const result = await preprocessRichTextWithMultiRound(
      '原文：提出问题并给出对策，最后落到执行动作。',
      llmMock,
      progressSpy
    );

    expect(llmMock).toHaveBeenCalledTimes(3);
    expect(result.metadata.rounds).toBe(1);
    expect(result.qualityReport?.finalDecision).toBe('converged');
    expect(result.qualityReport?.converged).toBe(true);
    expect(result.qualityReport?.rounds).toHaveLength(1);
    expect(result.qualityReport?.rounds[0].passed).toBe(true);
    expect(progressSpy).toHaveBeenCalledWith('预处理 4/4：已在第 1 轮收敛。');
  });

  it('returns usable decision when not converged but above fallback baseline', async () => {
    const llmMock = vi.fn()
      .mockResolvedValueOnce(
        '{"genre":"report","coreFacts":[{"id":"F1","fact":"背景"},{"id":"F2","fact":"措施"},{"id":"F3","fact":"进度"}]}'
      )
      .mockResolvedValueOnce(
        '{"rewrittenText":"第一段讲背景。第二段讲措施。","summary":"初版压缩","coverageChecklist":[{"factId":"F1","kept":true},{"factId":"F2","kept":true},{"factId":"F3","kept":false}],"shotAnchors":["背景","措施"]}'
      )
      .mockResolvedValueOnce(
        '{"verdict":"revise","decisionReason":"覆盖率不足","revisionAdvice":"补回进度信息","lengthRatio":0.95,"coverage":0.67,"shotAnchorCount":2}'
      )
      .mockResolvedValueOnce(
        '{"rewrittenText":"第一段讲背景。\\n第二段讲措施。\\n第三段补充进度。","summary":"补充进度信息","coverageChecklist":[{"factId":"F1","kept":true},{"factId":"F2","kept":true},{"factId":"F3","kept":true}],"shotAnchors":["背景","措施"]}'
      )
      .mockResolvedValueOnce(
        '{"verdict":"revise","decisionReason":"锚点不足","revisionAdvice":"增加结尾动作锚点","lengthRatio":1.02,"coverage":0.9,"shotAnchorCount":2}'
      )
      .mockResolvedValueOnce(
        '{"rewrittenText":"第一段背景。\\n第二段措施。\\n第三段进度。","summary":"保持三段结构","coverageChecklist":[{"factId":"F1","kept":true},{"factId":"F2","kept":true},{"factId":"F3","kept":true}],"shotAnchors":["背景","措施"]}'
      )
      .mockResolvedValueOnce(
        '{"verdict":"revise","decisionReason":"仍缺一个锚点","revisionAdvice":"建议人工补镜头锚点","lengthRatio":1.01,"coverage":0.9,"shotAnchorCount":2}'
      );

    const result = await preprocessRichTextWithMultiRound(
      '原文包含背景、措施和进度，目标是形成可分镜稿。',
      llmMock
    );

    expect(llmMock).toHaveBeenCalledTimes(7);
    expect(result.metadata.rounds).toBe(3);
    expect(result.qualityReport?.finalDecision).toBe('usable');
    expect(result.qualityReport?.converged).toBe(false);
    expect(result.qualityReport?.rounds).toHaveLength(3);
    expect(result.qualityReport?.finalReason).toContain('可用基线');
  });
});
