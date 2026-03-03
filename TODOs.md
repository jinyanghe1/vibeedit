# 脚本->AI分镜编辑器 - 开发任务清单

## 项目概述

轻量级脚本分镜编辑器，支持分镜描述管理、AI视频生成(ByteDance)、资产管理和剪辑预览。

## 技术栈

- React 18 + TypeScript
- Tailwind CSS + Lucide Icons
- Zustand 状态管理
- ByteDance API (默认)
- 其他 LLM API (阿里云/百度/智谱/OpenAI)

## 任务分解

### ✅ Task 1: 项目初始化

- [x] 使用 Vite 创建 React + TS 项目
- [x] 配置 Tailwind CSS
- [x] 安装依赖 (zustand, lucide-react)
- [x] 设置基础目录结构

### ✅ Task 2: 核心数据模型

- [x] 定义 TypeScript 类型
- [x] 创建 Zustand Store

### ✅ Task 3: 左侧工作区 - 分镜管理

- [x] 分镜列表组件
- [x] 分镜编辑表单
- [x] 添加/删除分镜
- [x] 分镜卡片操作

### ✅ Task 4: 资产管理

- [x] 资产导入面板
- [x] 分镜描述中的资产引用高亮

### ✅ Task 5: ByteDance 视频生成

- [x] ByteDance 视频生成服务
- [x] 生成状态管理
- [x] 视频版本管理

### ✅ Task 6: 右侧剪辑预览区

- [x] 预览播放器
- [x] 分镜选择逻辑
- [x] 一键剪辑功能

### ✅ Task 7: UI/UX优化

- [x] 响应式布局
- [x] 视觉美化
- [x] 交互反馈

### ✅ Task 8: API Key 配置 (ByteDance 默认)

- [x] 设置面板支持 ByteDance/Seedance/自定义
- [x] 本地存储
- [x] ByteDance 作为默认提供商

### ✅ Task 9: 从剧本生成功能

- [x] 选项卡切换
- [x] 剧本输入
- [x] LLM 配置面板 (ByteDance 默认)
- [x] 多轮对话生成
- [x] 结果预览与导入

### ✅ Task 10: 网文灵感模块

#### 10.1 目标与范围

- [x] 新增“网文灵感”入口（独立 Tab）
- [x] 用户可选择关键词（预设 + 自定义）
- [x] 基于关键词执行“AI增强检索词构建”
- [x] 使用增强检索词进行互联网公开信息检索（仅用于灵感提炼）
- [x] 生成网文梗概（启发用，不可复写现有作品）
- [x] 自动截取一个关键情节片段
- [x] 基于梗概+片段扩写至约1000字，并显式加入“反转 + 爽点”
- [x] 结果返回前端展示，并附带合规提示

#### 10.2 用户流程（目标交互）

1. 用户进入“网文灵感”模块。
2. 用户选择关键词（可多选）并填写题材方向（可选）。
3. 系统先调用 AI 生成增强检索词（3-5条）。
4. 系统使用增强检索词进行互联网检索并汇总公开摘要。
5. 系统生成：
   - 网文梗概（150-220字）
   - 情节片段（220-320字）
6. 系统扩写正文至约1000字（900-1100字），包含反转与爽点设计。
7. 前端返回完整结果，并固定显示合规提示：
   - “仅用于创作启发，不可洗稿或近似改写，请确保最终内容原创。”

#### 10.3 合规与版权约束（强制）

- [x] 明确禁止：对已存在网文进行结构复刻、句式改写、桥段拼接式洗稿。
- [x] 提示语必须在结果页可见，且不能默认折叠。
- [x] 生成逻辑要求“抽象提炼灵感”，不引用具体原文句子。
- [x] 输出中避免出现“可直接发布”的误导表述，强调“需人工二次原创”。
- [x] 为高风险内容预留合规兜底提示（涉黄暴、违法、仇恨等）。

#### 10.4 技术实施拆分

- [x] 子任务 A：数据模型设计
  - 新增 `WebSearchItem`、`WebNovelInspirationResult` 类型定义。
- [x] 子任务 B：服务链路设计
  - `src/services/webNovelInspirationService.ts`: 含 `WebNovelInspirationService` 类和模拟生成函数。
  - 检索失败时降级至模拟数据。
- [x] 子任务 C：Store Action 设计
  - `generateWebNovelInspiration` action，支持进度回调与错误状态。
- [x] 子任务 D：前端交互设计
  - `WebNovelInspiration.tsx`: 关键词选择器、生成按钮、进度状态、结果卡片、合规提示区。
- [x] 子任务 E：异常与体验
  - 网络超时、API失败时降级至模拟模式，支持重新生成。

#### 10.5 验收标准（Definition of Done）

- [x] 输入关键词后可稳定生成“梗概 + 情节片段 + ~1000字扩写”。
- [x] 扩写内容包含至少2个反转节点和2处爽点表达。
- [x] 页面必须显示“仅作启发、不可洗稿”的合规提示。
- [x] 检索失败时仍返回可用的降级结果，不阻断流程。
- [x] 模拟模式与真实 LLM 模式均可跑通流程。

#### 10.6 风险与决策记录

- [ ] 风险1：前端直连互联网检索可能受 CORS/可用性限制。
  - 预案：设置多源检索或降级兜底策略。
- [ ] 风险2：模型输出可能出现“过度借鉴”。
  - 预案：强化提示词合规约束 + 输出端固定警示。
- [ ] 风险3：1000字扩写长度不稳定。
  - 预案：增加长度校验与二次补写机制。

## ByteDance API 配置

### 视频生成

- **默认 API**: ByteDance Ark 平台
- **默认 URL**: `https://ark.ap-southeast-1.bytepluses.com/api/v3/contents/generations`
- **默认模型**: `seededit`

### 文本生成 (剧本生成)

- **默认 API**: ByteDance Ark 平台
- **默认 URL**: `https://ark.ap-southeast-1.bytepluses.com/api/v3/chat/completions`
- **默认模型**: `doubao-1-5-pro-32k-250115`

### 支持的 LLM 提供商

1. **ByteDance (默认)** - 字节跳动方舟平台
2. 阿里云通义千问
3. 百度文心一言
4. 智谱 AI
5. OpenAI
6. 自定义 API

## 数据结构

```typescript
// API 配置
interface ApiConfig {
  provider: 'bytedance' | 'seedance' | 'custom';
  apiKey: string;
  apiUrl: string;
}

// LLM 配置
interface LLMConfig {
  provider: 'bytedance' | 'aliyun' | 'baidu' | 'zhipu' | 'openai' | 'custom';
  apiKey: string;
  apiUrl: string;
  model: string;
}
```

## 存储位置

### API Key 存储

- **视频生成**: `storyboard-editor-config`
- **LLM/剧本生成**: `storyboard-editor-llm-config`
- **存储方式**: localStorage (浏览器本地)

## 使用流程

1. **配置 ByteDance API Key** (可选)
   - 点击右上角设置按钮
   - 选择 ByteDance 提供商
   - 输入 API Key

2. **创建分镜**
   - 手动添加 或 从剧本生成
   - 使用 @资产名 引用角色图片

3. **生成视频**
   - 点击"创作分镜shot"
   - 自动使用 ByteDance API (已配置)
   - 或使用模拟数据 (未配置)

## 运行方式

```bash
cd /Users/hejinyang/vibeditor
npm run dev
```

访问 <http://localhost:5173>

## 获取 ByteDance API Key

1. 访问 [字节跳动方舟平台](https://www.volcengine.com/product/ark)
2. 注册/登录账号
3. 创建应用并获取 API Key
4. 在设置面板中配置

## 🧠 Feature Suggestions (Brainstorming)

### 1. 🎨 AI Mood Board Style Transfer
**Concept**: Instead of just text prompts, allow users to upload a "Mood Board" (a collage of 3-5 images).
**Functionality**:
- The AI analyzes the mood board for color palette, lighting (e.g., noir, golden hour), and composition style.
- Automatically injects these stylistic descriptors into every shot's generation prompt.
- Ensures visual consistency across the entire storyboard without manual prompt engineering.

### 2. 🔀 Interactive Story Branching
**Concept**: Support "Choose Your Own Adventure" style video creation.
**Functionality**:
- Allow the script to have "Decision Points" (Branching Nodes).
- The editor visualizes the story as a flow chart rather than a linear list.
- Generates separate video clips for each branch.
- Exports as an interactive HTML5 player or a playlist structure for platforms that support it (like Bilibili interactive videos).

### 3. 🎙️ Real-time "Director's Acting" Input
**Concept**: Use the creator's voice acting to drive the video timing and emotion.
**Functionality**:
- User records a rough voiceover for a shot while reading the script.
- AI analyzes the audio for:
  - **Duration**: Automatically sets the shot duration.
  - **Emotion**: Detects tone (angry, happy, whispering) and adds it to the character prompt.
  - **Pacing**: Identifies pauses to potentially split shots automatically.
