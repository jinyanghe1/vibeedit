import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { 
  Share2, 
  Copy, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Video,
  FileText,
  Hash,
  Eye
} from 'lucide-react';

// 支持的平台
const PLATFORMS = [
  { id: 'bilibili', name: 'Bilibili', maxLength: 2000, supportsTags: true },
  { id: 'douyin', name: '抖音', maxLength: 500, supportsTags: true },
  { id: 'xiaohongshu', name: '小红书', maxLength: 1000, supportsTags: true },
  { id: 'weibo', name: '微博', maxLength: 5000, supportsTags: true },
  { id: 'youtube', name: 'YouTube', maxLength: 5000, supportsTags: true },
] as const;

type PlatformId = typeof PLATFORMS[number]['id'];

interface PublishContent {
  title: string;
  description: string;
  tags: string[];
  platform: PlatformId;
}

export function PublishPanel() {
  const { shots, getLLMConfig, hasLLMConfig } = useEditorStore();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('bilibili');
  const [generatedContent, setGeneratedContent] = useState<PublishContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 生成发布文案
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const platform = PLATFORMS.find(p => p.id === selectedPlatform);
      if (!platform) throw new Error('未知平台');

      // 收集视频信息
      const videoCount = shots.filter(s => s.videos.length > 0).length;
      const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
      const shotDescriptions = shots.map((s, i) => `分镜${i + 1}: ${s.description}`).join('\n');

      // 调用 LLM 生成文案
      const content = await generatePublishContent(
        platform.name,
        platform.maxLength,
        videoCount,
        totalDuration,
        shotDescriptions,
        hasLLMConfig() ? getLLMConfig() : null
      );

      setGeneratedContent({
        ...content,
        platform: selectedPlatform
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 复制到剪贴板
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const platform = PLATFORMS.find(p => p.id === selectedPlatform);
  const hasVideos = shots.some(s => s.videos.length > 0);

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Share2 className="text-green-500" size={20} />
          <h2 className="text-lg font-semibold text-white">多平台发布</h2>
        </div>
        <div className="text-xs text-gray-500">
          {shots.length} 个分镜 · {shots.filter(s => s.videos.length > 0).length} 个已生成视频
        </div>
      </div>

      {/* 平台选择 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">选择发布平台</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedPlatform === p.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 平台信息 */}
      {platform && (
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>最大字数: {platform.maxLength}</span>
            <span>支持标签: {platform.supportsTags ? '是' : '否'}</span>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || shots.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors mb-4"
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <FileText size={18} />
            生成发布文案
          </>
        )}
      </button>

      {/* 警告提示 */}
      {!hasVideos && shots.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4 text-xs text-yellow-400">
          <AlertCircle size={14} />
          <span>还有分镜未生成视频，建议先生成视频后再发布</span>
        </div>
      )}

      {!hasLLMConfig() && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4 text-xs text-blue-400">
          <Eye size={14} />
          <span>未配置 LLM，将使用模拟数据生成文案</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4 text-xs text-red-400">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* 生成的内容 */}
      {generatedContent && (
        <div className="space-y-4">
          {/* 标题 */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400 flex items-center gap-1">
                <Video size={14} />
                标题
              </label>
              <button
                onClick={() => handleCopy(generatedContent.title, 'title')}
                className="text-xs text-gray-500 hover:text-green-400 flex items-center gap-1 transition-colors"
              >
                {copiedField === 'title' ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copiedField === 'title' ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-white text-sm">{generatedContent.title}</p>
          </div>

          {/* 描述 */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400 flex items-center gap-1">
                <FileText size={14} />
                描述
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${
                  generatedContent.description.length > (platform?.maxLength || 2000) * 0.9
                    ? 'text-red-400'
                    : 'text-gray-500'
                }`}>
                  {generatedContent.description.length}/{platform?.maxLength || 2000}
                </span>
                <button
                  onClick={() => handleCopy(generatedContent.description, 'description')}
                  className="text-xs text-gray-500 hover:text-green-400 flex items-center gap-1 transition-colors"
                >
                  {copiedField === 'description' ? <CheckCircle size={12} /> : <Copy size={12} />}
                  {copiedField === 'description' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={generatedContent.description}
              className="w-full h-32 bg-gray-900 rounded p-3 text-sm text-white resize-none focus:outline-none"
            />
          </div>

          {/* 标签 */}
          {generatedContent.tags.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400 flex items-center gap-1">
                  <Hash size={14} />
                  推荐标签
                </label>
                <button
                  onClick={() => handleCopy(generatedContent.tags.join(' '), 'tags')}
                  className="text-xs text-gray-500 hover:text-green-400 flex items-center gap-1 transition-colors"
                >
                  {copiedField === 'tags' ? <CheckCircle size={12} /> : <Copy size={12} />}
                  {copiedField === 'tags' ? '已复制' : '复制'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {generatedContent.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 合规提示 */}
          <div className="flex items-start gap-2 p-3 bg-gray-800/50 rounded-lg text-xs text-gray-500">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <p>发布前请确保内容符合平台规范：</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>无暴力、色情、政治敏感内容</li>
                <li>不侵犯他人版权</li>
                <li>符合平台社区准则</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 生成发布文案
async function generatePublishContent(
  platformName: string,
  maxLength: number,
  videoCount: number,
  totalDuration: number,
  shotDescriptions: string,
  llmConfig: { apiKey: string; apiUrl: string; model: string } | null
): Promise<{ title: string; description: string; tags: string[] }> {
  
  // 如果有 LLM 配置，尝试调用 API
  if (llmConfig?.apiKey) {
    try {
      const response = await fetch(llmConfig.apiUrl || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: llmConfig.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的视频内容运营专家，擅长为${platformName}平台创作吸引人的发布文案。`
            },
            {
              role: 'user',
              content: `请为以下视频生成${platformName}平台的发布文案：

视频信息：
- 分镜数量: ${videoCount}
- 总时长: ${Math.round(totalDuration)}秒
- 分镜描述:\n${shotDescriptions}

要求：
1. 标题吸引人，20字以内
2. 描述在${maxLength}字以内，包含视频亮点
3. 提供5-8个相关标签
4. 语气符合${platformName}平台风格
5. 添加适当的emoji

请以JSON格式返回：{"title": "标题", "description": "描述", "tags": ["标签1", "标签2"]}`
            }
          ],
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            return {
              title: parsed.title || '精彩视频分享',
              description: parsed.description || content.slice(0, maxLength),
              tags: parsed.tags || []
            };
          } catch {
            // 如果不是 JSON，使用原始内容
            return {
              title: '精彩视频分享',
              description: content.slice(0, maxLength),
              tags: ['视频创作', '原创内容']
            };
          }
        }
      }
    } catch (err) {
      console.warn('LLM API 调用失败，使用模拟数据:', err);
    }
  }

  // 模拟数据
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const templates = [
    {
      title: `✨ 精心制作的${videoCount}个分镜，带你进入视觉盛宴`,
      description: `🎬 耗时${Math.round(totalDuration)}秒的精彩呈现

每个分镜都经过精心设计，希望能给你带来不一样的视觉体验。

🎥 制作不易，喜欢的话记得点赞关注～
💬 欢迎在评论区分享你的想法

#创作 #视频 #原创内容`,
      tags: ['视频创作', '原创内容', '视觉盛宴', '分镜设计', '创意视频']
    },
    {
      title: `🎬 ${videoCount}个镜头，记录美好瞬间`,
      description: `用${videoCount}个分镜讲述一个故事
总时长${Math.round(totalDuration)}秒，每一帧都是用心制作

感谢观看！你的支持是我创作的动力 💪

喜欢的话记得：
❤️ 点赞
⭐ 收藏
🔄 分享`,
      tags: ['短视频', '原创内容', '创作分享', '视频制作', '故事讲述']
    }
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // 根据平台调整
  let description = template.description;
  if (platformName === '抖音') {
    description = description.slice(0, 200) + '\n\n#抖音创作 #短视频';
  } else if (platformName === '小红书') {
    description = '📸 ' + description.slice(0, 400) + '\n\n#小红书创作 #生活记录';
  }

  return {
    title: template.title.slice(0, 30),
    description: description.slice(0, maxLength),
    tags: template.tags
  };
}
