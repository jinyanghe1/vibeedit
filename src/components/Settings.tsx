import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { ApiProvider } from '../types';
import { 
  Settings as SettingsIcon, 
  X, 
  Eye, 
  EyeOff, 
  Key, 
  Globe, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Video
} from 'lucide-react';

const API_PROVIDERS: { value: ApiProvider; label: string; icon: string }[] = [
  { value: 'bytedance', label: 'ByteDance (字节跳动)', icon: '🟦' },
  { value: 'seedance', label: 'Seedance', icon: '🎬' },
  { value: 'custom', label: '自定义 API', icon: '⚙️' },
];

export function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState<ApiProvider>('bytedance');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  const { apiConfig, updateApiConfig, hasVideoApiKey } = useEditorStore();

  // 打开设置时加载当前配置
  useEffect(() => {
    if (isOpen) {
      setProvider(apiConfig.provider || 'bytedance');
      setApiKey(apiConfig.apiKey || '');
      setApiUrl(apiConfig.apiUrl || '');
      setSaveStatus('idle');
    }
  }, [isOpen, apiConfig]);

  const handleSave = () => {
    updateApiConfig({
      provider,
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim()
    });
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowApiKey(false);
  };

  return (
    <>
      {/* 设置按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          hasVideoApiKey() 
            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
        title="API 设置"
      >
        <SettingsIcon size={18} />
        {hasVideoApiKey() && <CheckCircle size={14} />}
      </button>

      {/* 设置弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <SettingsIcon className="text-blue-500" size={24} />
                <h2 className="text-xl font-semibold text-white">API 设置</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 说明 */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-300">
                配置视频生成 API。默认使用 ByteDance（字节跳动）API。
                如果没有配置，将使用模拟数据。
              </p>
            </div>

            <div className="space-y-5">
              {/* 提供商选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                  <Video size={16} className="text-purple-500" />
                  选择 API 提供商
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {API_PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                        provider === p.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key 输入 */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <Key size={16} className="text-yellow-500" />
                  API Key
                  {hasVideoApiKey() && (
                    <span className="text-xs text-green-400 ml-2">● 已配置</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`输入 ${API_PROVIDERS.find(p => p.value === provider)?.label} API Key`}
                    className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff size={16} className="text-gray-400" />
                    ) : (
                      <Eye size={16} className="text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {provider === 'bytedance' 
                    ? 'ByteDance API Key 可从字节跳动方舟平台获取'
                    : 'API Key 将安全地存储在浏览器本地'}
                </p>
              </div>

              {/* API URL 输入 */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <Globe size={16} className="text-blue-500" />
                  API 地址（可选）
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder={provider === 'bytedance' 
                    ? 'https://ark.cn-beijing.volces.com/api/v3/contents/generations'
                    : 'https://api.example.com/v1'
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {provider === 'bytedance'
                    ? '默认使用 ByteDance 方舟平台 API'
                    : '默认使用官方 API 地址'}
                </p>
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
                  saveStatus === 'success'
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saveStatus === 'success' ? (
                  <>
                    <CheckCircle size={18} />
                    已保存
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存设置
                  </>
                )}
              </button>

              {/* 安全提示 */}
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <p>
                  注意：API Key 仅存储在你的浏览器本地 (localStorage)，不会上传到任何服务器。
                  请勿在公共电脑上保存敏感密钥。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
