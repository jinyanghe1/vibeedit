import { ShotListPanel } from './components/ShotListPanel';
import { PreviewPanel } from './components/PreviewPanel';

function App() {
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
