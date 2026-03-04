import { useState, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ImagePlus, X, Upload, User } from 'lucide-react';

export function AssetManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { assets, addAsset, removeAsset } = useEditorStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleAddAsset = () => {
    if (name.trim() && previewUrl) {
      addAsset(name.trim(), previewUrl);
      setName('');
      setPreviewUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAsset = (assetName: string) => {
    removeAsset(assetName);
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        <ImagePlus size={18} />
        <span>导入资产</span>
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">资产管理</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 添加新资产 */}
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">添加新资产</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">资产名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如: 小红"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    在分镜描述中使用 @{name} 或 {'{name}'} 引用此资产
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">图片</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {previewUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-600"
                      />
                      <button
                        onClick={() => {
                          setPreviewUrl('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-gray-500 hover:bg-gray-700/50 transition-colors"
                    >
                      <Upload size={24} className="text-gray-500 mb-2" />
                      <span className="text-xs text-gray-500">点击上传</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleAddAsset}
                  disabled={!name.trim() || !previewUrl}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  添加资产
                </button>
              </div>
            </div>

            {/* 资产列表 */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                已导入资产 ({Object.keys(assets).length})
              </h3>
              
              {Object.keys(assets).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User size={48} className="mx-auto mb-2 opacity-50" />
                  <p>暂无资产</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {Object.values(assets).map((asset) => (
                    <div
                      key={asset.id}
                      className="relative group bg-gray-700/30 rounded-lg p-3"
                    >
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full aspect-square object-cover rounded-lg mb-2"
                      />
                      <p className="text-sm text-white truncate">@{asset.name}</p>
                      <button
                        onClick={() => handleRemoveAsset(asset.name)}
                        className="absolute top-1 right-1 p-1 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
