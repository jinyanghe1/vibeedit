import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { LLMProvider, ScriptGenerationResult } from '../types';
import { LLMService } from '../services/llmService';
import { 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Sparkles,
  Clock,
  User,
  X,
  Save
} from 'lucide-react';

const LLM_PROVIDERS: { value: LLMProvider; label: string; icon: string }[] = [
  { value: 'bytedance', label: 'ByteDance (字节跳动)', icon: '🟦' },
  { value: 'aliyun', label: '阿里云通义千问', icon: '🔷' },
  { value: 'baidu', label: '百度文心一言', icon: '🔴' },
  { value: 'zhipu', label: '智谱 AI (GLM)', icon: '🟢' },
  { value: 'openai', label: 'OpenAI', icon: '🅾️' },
  { value: 'custom', label: '自定义 API', icon: '⚙️' },
];

export function ScriptToShots() {
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ScriptGenerationResult | null>(null);
  const [error, setError] = useState('');
  const [showLLMSettings, setShowLLMSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // LLM 配置
  const { llmConfig, updateLLMConfig, hasLLMConfig, addShots } = useEditorStore();

  const handleGenerate = async () => {
    if (!script.trim()) {
      setError('请输入剧本内容');
      return;
    }

    setIsGenerating(true);
    setError('');
    setProgress('准备生成...');
    setResult(null);

    try {
      const { generateShotsFromScript } = useEditorStore.getState();
      const generationResult = await generateShotsFromScript(script, (msg) => {
        setProgress(msg);
      });
      
      setResult(generationResult);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleImport = () => {
    if (!result || result.shots.length === 0) return;

    // 导入分镜
    addShots(result.shots.map(shot => ({
      description: shot.description,
      duration: shot.duration,
      assetRefs: shot.assetRefs
    })));

    // 重置状态
    setScript('');
    setResult(null);
    setShowPreview(false);
    
    // 提示成功
    alert(`成功导入 ${result.shots.length} 个分镜！`);
  };

  // 示例剧本
  const loadExample = () => {
    setScript(`清晨，小红走在安静的街道上。她穿着一件红色的外套，心情很好。
突然，她看到一只橘色的猫咪从巷子里跑出来，停在她的面前。
小红蹲下来，温柔地抚摸猫咪的头。猫咪舒服地眯起了眼睛。
这时，一位老奶奶从远处走来，笑着对小红说那是她家的猫。
小红站起身，和老奶奶聊了几句，然后挥手告别，继续向前走去。`);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* LLM 设置面板 */}
      {showLLMSettings && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-5 w-full max-w-md m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings size={20} />
                LLM 配置
              </h3>
              <button
                onClick={() => setShowLLMSettings(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 提供商选择 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">选择模型提供商</label>
                <div className="grid grid-cols-2 gap-2">
                  {LLM_PROVIDERS.map((provider) => (
                    <button
                      key={provider.value}
                      onClick={() => updateLLMConfig({ provider: provider.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        llmConfig.provider === provider.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span>{provider.icon}</span>
                      <span className="truncate">{provider.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={llmConfig.apiKey}
                  onChange={(e) => updateLLMConfig({ apiKey: e.target.value })}
                  placeholder={`输入${LLM_PROVIDERS.find(p => p.value === llmConfig.provider)?.label} API Key`}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              {/* 自定义 API URL */}
              {llmConfig.provider === 'custom' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API URL</label>
                  <input
                    type="text"
                    value={llmConfig.apiUrl}
                    onChange={(e) => updateLLMConfig({ apiUrl: e.target.value })}
                    placeholder="https://api.example.com/v1/chat"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              )}

              {/* 模型名称 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  模型名称（可选）
                </label>
                <input
                  type="text"
                  value={llmConfig.model}
                  onChange={(e) => updateLLMConfig({ model: e.target.value })}
                  placeholder={llmConfig.provider === 'bytedance' 
                    ? 'doubao-seed-1-6-251015'
                    : LLMService.getDefaultModel(llmConfig.provider)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  留空使用默认模型
                </p>
              </div>

              {/* 状态提示 */}
              <div className={`p-3 rounded-lg text-sm ${
                hasLLMConfig() 
                  ? 'bg-green-600/20 text-green-400' 
                  : 'bg-yellow-600/20 text-yellow-400'
              }`}>
                {hasLLMConfig() 
                  ? '✓ API Key 已配置，将使用真实 LLM 生成' 
                  : '⚠ 未配置 API Key，将使用模拟生成'}
              </div>

              <button
                onClick={() => setShowLLMSettings(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="flex-1 flex flex-col p-4 overflow-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="text-purple-500" size={24} />
            <h2 className="text-lg font-semibold text-white">从剧本生成</h2>
          </div>
          <button
            onClick={() => setShowLLMSettings(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              hasLLMConfig()
                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Settings size={16} />
            LLM 设置
          </button>
        </div>

        {/* 剧本输入 */}
        <div className="flex-1 mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">输入剧本内容（支持1000字以上）</label>
            <button
              onClick={loadExample}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              加载示例
            </button>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="在这里输入你的剧本...&#10;&#10;例如：&#10;清晨，小红走在安静的街道上。她穿着一件红色的外套，心情很好。&#10;突然，她看到一只橘色的猫咪从巷子里跑出来..."
            className="w-full h-full min-h-[200px] px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* 字数统计 */}
        <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
          <span>{script.length} 字符</span>
          <span>建议 500-2000 字</span>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !script.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {progress || '生成中...'}
            </>
          ) : (
            <>
              <Sparkles size={20} />
              智能生成分镜
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-500 mt-3">
          使用 AI 自动分析剧本，提取场景和角色，生成多条分镜
        </p>
      </div>

      {/* 生成结果预览 */}
      {showPreview && result && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl p-5 w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
            {/* 预览头部 */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={20} />
                  生成完成
                </h3>
                <p className="text-sm text-gray-400 mt-1">{result.summary}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* 分镜列表 */}
            <div className="flex-1 overflow-auto mb-4">
              <div className="space-y-3">
                {result.shots.map((shot, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-700/50 rounded-lg border border-gray-600"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-600/30 text-purple-300 rounded-full text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white mb-2">{shot.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {shot.duration} 秒
                          </span>
                          {shot.assetRefs.length > 0 && (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {shot.assetRefs.map(ref => `@${ref}`).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Save size={18} />
                导入全部分镜
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
