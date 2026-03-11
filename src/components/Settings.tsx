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
  Video,
  Palette
} from 'lucide-react';

const API_PROVIDERS: { value: ApiProvider; label: string; icon: string }[] = [
  { value: 'bytedance', label: 'ByteDance (字节跳动)', icon: '🟦' },
  { value: 'seedance', label: 'Seedance', icon: '🎬' },
  { value: 'custom', label: '自定义 API', icon: '⚙️' },
];

export function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'style'>('api');
  const [provider, setProvider] = useState<ApiProvider>('bytedance');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  // Style config state
  const [styleEnabled, setStyleEnabled] = useState(false);
  const [styleDescription, setStyleDescription] = useState('');
  const [colorPalette, setColorPalette] = useState('');
  const [lighting, setLighting] = useState('');
  const [mood, setMood] = useState('');

  const { apiConfig, updateApiConfig, hasVideoApiKey, getStyleConfig, updateStyleConfig } = useEditorStore();

  useEffect(() => {
    if (isOpen) {
      setProvider(apiConfig.provider || 'bytedance');
      setApiKey(apiConfig.apiKey || '');
      setApiUrl(apiConfig.apiUrl || '');
      setSaveStatus('idle');
      const sc = getStyleConfig();
      setStyleEnabled(sc.enabled);
      setStyleDescription(sc.styleDescription);
      setColorPalette(sc.colorPalette);
      setLighting(sc.lighting);
      setMood(sc.mood);
    }
  }, [isOpen, apiConfig, getStyleConfig]);

  const handleSave = () => {
    updateApiConfig({ provider, apiKey: apiKey.trim(), apiUrl: apiUrl.trim() });
    updateStyleConfig({ enabled: styleEnabled, styleDescription, colorPalette, lighting, mood });
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
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[85vh] overflow-auto">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SettingsIcon className="text-blue-500" size={24} />
                <h2 className="text-xl font-semibold text-white">设置</h2>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-5">
              <button
                onClick={() => setActiveTab('api')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'api' ? 'text-blue-400 border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-300'}`}
              >
                <Key size={14} />API 配置
              </button>
              <button
                onClick={() => setActiveTab('style')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'style' ? 'text-purple-400 border-purple-500' : 'text-gray-400 border-transparent hover:text-gray-300'}`}
              >
                <Palette size={14} />画面风格</button>
            </div>

            {activeTab === 'api' && (
              <>
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
                  saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saveStatus === 'success' ? (<><CheckCircle size={18} />已保存</>) : (<><Save size={18} />保存设置</>)}
              </button>

              {/* 安全提示 */}
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <p>注意：API Key 仅存储在你的浏览器本地 (localStorage)，不会上传到任何服务器。请勿在公共电脑上保存敏感密钥。</p>
              </div>
            </div>
            </>
            )}

            {activeTab === 'style' && (
              <div className="space-y-4">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-sm text-purple-300">启用后，风格描述将自动注入到每个分镜的视频生成 Prompt 中，保证全片视觉一致性。</p>
                </div>

                {/* 启用开关 */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300 flex items-center gap-2">
                    <Palette size={16} className="text-purple-400" />
                    启用全局画面风格
                  </label>
                  <button
                    onClick={() => setStyleEnabled(!styleEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${styleEnabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${styleEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className={`space-y-3 ${!styleEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">风格描述 <span className="text-gray-600">（如：赛博朋克，霓虹灯光，雨夜街道）</span></label>
                    <input
                      value={styleDescription}
                      onChange={e => setStyleDescription(e.target.value)}
                      placeholder="赛博朋克风格，霓虹灯光，雨夜…"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">色调</label>
                    <input
                      value={colorPalette}
                      onChange={e => setColorPalette(e.target.value)}
                      placeholder="冷色调，蓝紫色为主…"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">光影</label>
                    <input
                      value={lighting}
                      onChange={e => setLighting(e.target.value)}
                      placeholder="侧光，高对比度…"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">氛围</label>
                    <input
                      value={mood}
                      onChange={e => setMood(e.target.value)}
                      placeholder="神秘，紧张…"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
                    saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {saveStatus === 'success' ? (<><CheckCircle size={18} />已保存</>) : (<><Save size={18} />保存风格</>)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
