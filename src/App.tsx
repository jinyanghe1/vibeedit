import { useEffect } from 'react';
import { ShotListPanel } from './components/ShotListPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { useUndo } from './store/editorStore';

function App() {
  const { undo, redo, canUndo, canRedo } = useUndo();

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      }
      // Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-950">
      {/* 左侧: 分镜工作区 (40%) */}
      <div className="w-[40%] h-full">
        <ShotListPanel />
      </div>

      {/* 右侧: 剪辑预览区 (60%) */}
      <div className="w-[60%] h-full">
        <PreviewPanel />
      </div>
    </div>
  );
}

export default App;
