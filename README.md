# 脚本 -> AI 分镜编辑器

一个基于 React + TypeScript 的轻量级分镜编辑器，用于从文本分镜快速生成视频版本，并在右侧进行单分镜预览或一键剪辑预览。

## 功能概览
- 分镜管理：新增、编辑、删除、选择分镜。
- 资产管理：导入图片资产，在描述中通过 `@资产名` 或 `{资产名}` 引用。
- 视频生成：支持 Mock 模式与真实 Seedance API 模式。
- 版本管理：同一分镜可生成多个视频版本并切换预览。
- 预览能力：单分镜播放器（播放、暂停、进度、静音、全屏）。
- 一键剪辑：按分镜顺序串联每个分镜的最新视频进行连续播放。
- 设置中心：配置 API Key 与 API URL（保存在本地浏览器）。

## 技术栈
- React 19 + TypeScript
- Vite
- Zustand（状态管理）
- Tailwind CSS
- lucide-react（图标）

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发环境
```bash
npm run dev
```
该命令会同时启动：
- 前端开发服务器（Vite）
- 本地后端代理（`server/proxy-server.mjs`）

### 3. 构建生产版本
```bash
npm run build
```

### 4. 本地预览构建结果
```bash
npm run preview
```

如需分别启动：
```bash
npm run dev:api   # 仅启动后端代理（默认 3001）
npm run dev:web   # 仅启动前端（Vite）
```

### 5. 代码检查
```bash
npm run lint
```

## 典型使用流程
1. 点击“导入资产”，添加人物或场景图片。
2. 点击“添加分镜”，输入描述和时长。
3. 在描述中使用 `@资产名` 或 `{资产名}` 引用已导入资产。
4. 点击“创作分镜shot”（或“模拟生成”）生成视频。
5. 在右侧“单分镜预览”查看版本；或在“一键剪辑”中串联播放。

## API 配置说明
- 点击左上区域的设置按钮进入 API 设置。
- 配置项：
  - `Seedance API Key`
  - `API 地址`（默认 `https://api.seedance.io/v1`）
- 存储位置：浏览器 `localStorage`
- 存储键名：`storyboard-editor-config`

示例：
```json
{
  "seedanceApiKey": "your-api-key",
  "seedanceApiUrl": "https://api.seedance.io/v1"
}
```

切换逻辑：
- 配置了 API Key：调用真实 Seedance API。
- 未配置 API Key：使用 Mock 生成流程。

## 后端代理说明
为避免浏览器跨域（CORS）和密钥直连外部 API，所有外部请求已统一走本地后端代理。

当前代理端点：
- `POST /api/llm/chat`：统一转发 LLM 请求（ByteDance/阿里云/百度/智谱/OpenAI/自定义）。
- `GET /api/search/baidu`：统一转发百度百科检索请求。
- `POST /api/text-image/generate`：统一转发文生图/视频请求。
- `GET /api/health`：健康检查。

前端只访问同源 `/api/*`，不再直接请求外部模型或搜索服务。

## 数据与状态说明
- `shots`、`assets`、选择状态、生成状态由 Zustand 管理。
- 当前仅 API 配置持久化到 `localStorage`。
- 分镜与资产数据默认在内存中保存，刷新页面会丢失。

## 目录结构（核心）
```text
src/
  components/
    ShotListPanel.tsx   # 左侧分镜工作区
    ShotCard.tsx        # 分镜卡片与生成入口
    ShotEditor.tsx      # 分镜新增/编辑表单
    AssetManager.tsx    # 资产导入与管理
    Settings.tsx        # API 配置面板
    PreviewPanel.tsx    # 右侧预览模式切换
    VideoPreview.tsx    # 单分镜视频预览
    AutoEdit.tsx        # 一键剪辑预览
  store/
    editorStore.ts      # 全局状态与生成逻辑
  types/
    index.ts            # 类型定义
```

## 已知限制
- 分镜拖拽排序 UI 尚未接入（Store 已提供排序接口）。
- 资产引用高亮对中文名称的支持仍需统一优化。
- 真实 Seedance API 适配为通用示例，需按实际接口字段校准。
- 自动化测试尚未建立。

## 开发计划
详细任务见 [TODOs.md](./TODOs.md)。
