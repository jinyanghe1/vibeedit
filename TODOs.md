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

### ✅ Task 11: P0 功能增强（已完成）

#### 11.1 数据持久化
- [x] 集成 `zustand/middleware/persist`
- [x] shots、assets、selectedShotId、selectedVideoId、generationStatus 自动保存到 localStorage
- [x] 页面刷新后数据不丢失

#### 11.2 拖拽排序
- [x] 集成 `@dnd-kit/core` 和 `@dnd-kit/sortable`
- [x] 分镜列表支持鼠标拖拽排序
- [x] 支持键盘辅助排序
- [x] 拖拽手柄显示在分镜卡片左侧

#### 11.3 Undo/Redo
- [x] 集成 `zundo` temporal middleware
- [x] 支持最多 50 步历史记录
- [x] 快捷键支持：
  - `Ctrl/Cmd + Z` - 撤销
  - `Ctrl/Cmd + Y` - 重做
  - `Ctrl/Cmd + Shift + Z` - 重做
- [x] 导出 `useUndo` hook 供组件使用

### ✅ Task 12: P1 功能增强（已完成）

#### 12.1 批量视频生成
- [x] 添加"全部生成"按钮，一键生成所有未生成的分镜
- [x] 显示批量生成进度条
- [x] 支持中断和继续

#### 12.2 项目 JSON 导出/导入
- [x] 导出功能：将 shots 和 assets 导出为 JSON 文件
- [x] 导入功能：从 JSON 文件导入项目数据
- [x] 文件名包含日期：`storyboard-YYYY-MM-DD.json`

#### 12.3 多平台发布 Tab
- [x] 在 PreviewPanel 添加"多平台发布"Tab
- [x] 支持 5 个平台：Bilibili、抖音、小红书、微博、YouTube
- [x] AI 生成平台适配的标题、描述、标签
- [x] 一键复制功能
- [x] 字数限制提示
- [x] 合规提示

### ✅ Task 13: P2 功能增强（已完成）

#### 13.1 角色一致性管理
- [x] Asset 支持 description 字段存储角色外貌描述
- [x] AssetManager 支持编辑角色描述
- [x] ShotCard 显示角色描述标记（✦）
- [x] 视频生成时注入角色描述到 Prompt

#### 13.2 分镜标签分类
- [x] 8 种标签类型：动作、对话、特写、全景、过场、转场、情感、战斗
- [x] ShotEditor 支持选择/取消标签
- [x] ShotCard 显示标签色块
- [x] 时间轴按标签颜色显示

#### 13.3 分镜时间轴
- [x] ShotListPanel 底部显示时间轴
- [x] 按分镜时长比例显示色块
- [x] 显示总时长
- [x] 点击时间轴跳转选择分镜

#### 13.4 视频版本 A/B 对比
- [x] VideoPreview 支持 A/B 对比模式
- [x] 并排显示两个视频版本
- [x] 版本切换按钮
- [x] 支持多版本的场景对比

### 🚧 Task 14: 路线 A - 角色一致性引擎 2.0（规划中）

> 目标：在已完成的“角色描述注入”基础上，升级为“可评分、可诊断、可修复”的一致性系统，直接降低返工率。

#### 14.1 用户行为 -> 产品功能描述

| 用户行为 | 产品功能 | 用户可见结果 |
|---|---|---|
| 导入角色图并填写角色描述 | 角色卡中心（属性结构化 + 版本管理） | 每个角色有统一画像，可复用到所有分镜 |
| 在分镜中输入 `@角色名` | Prompt 自动注入（外观、服装、语气、禁忌） | 分镜生成时默认带一致性约束 |
| 点击“一致性检查” | 单分镜检查 + 全项目检查 | 返回评分、问题列表、风险等级 |
| 点击“一键修复” | 生成修复补丁（Patch）并可预览应用 | 自动修正文案/提示词，减少手改 |
| 对比修复前后版本 | 版本差异查看（文本 + 参数） | 可确认是否采纳修复结果 |

#### 14.2 API 接口描述（建议经 `server/proxy-server.mjs` 暴露）

##### 14.2.1 `POST /api/characters/profile/extract`
- 用途：从资产描述/历史分镜中抽取结构化角色卡。
- Request:
```json
{
  "projectId": "proj_001",
  "assetName": "小红",
  "assetDescription": "长发，红色汉服，冷静语气",
  "sampleShots": ["@小红 站在雨夜街道", "@小红 回眸特写"]
}
```
- Response:
```json
{
  "characterId": "char_001",
  "profile": {
    "displayName": "小红",
    "appearance": {"hair": "long_black", "outfit": "red_hanfu"},
    "voiceStyle": "calm",
    "forbiddenTraits": ["短发", "现代休闲装"]
  },
  "version": 1
}
```

##### 14.2.2 `POST /api/consistency/check-shot`
- 用途：对单个分镜做一致性评分与问题定位。
- Request:
```json
{
  "projectId": "proj_001",
  "shotId": "shot_023",
  "shotDescription": "@小红 穿黑色西装走进会议室",
  "boundCharacters": ["char_001"]
}
```
- Response:
```json
{
  "shotId": "shot_023",
  "score": {"total": 62, "identity": 90, "outfit": 35, "style": 60},
  "riskLevel": "high",
  "issues": [
    {"type": "outfit_conflict", "message": "服装与角色卡冲突：红色汉服 -> 黑色西装"}
  ],
  "repairHints": ["保持红色汉服设定", "如需换装，请先创建角色新版本"]
}
```

##### 14.2.3 `POST /api/consistency/check-project`
- 用途：对项目全部分镜批量检测。
- Request:
```json
{
  "projectId": "proj_001",
  "shotIds": ["shot_001", "shot_002", "shot_003"]
}
```
- Response:
```json
{
  "projectId": "proj_001",
  "projectScore": 81,
  "highRiskShots": ["shot_023", "shot_031"],
  "reportId": "cr_20260304_001"
}
```

##### 14.2.4 `POST /api/consistency/repair`
- 用途：根据问题项生成可应用补丁。
- Request:
```json
{
  "projectId": "proj_001",
  "shotId": "shot_023",
  "issues": ["outfit_conflict", "style_drift"],
  "mode": "safe"
}
```
- Response:
```json
{
  "patchId": "patch_001",
  "before": "@小红 穿黑色西装走进会议室",
  "after": "@小红 穿红色汉服走进古风庭院，镜头保持柔和电影感",
  "confidence": 0.86
}
```

#### 14.3 数据格式（数据库）描述

> 可先落地 SQLite（单机）或 PostgreSQL（多人协作），字段保持一致。

##### 14.3.1 表：`character_profiles`
- `id` (TEXT, PK)
- `project_id` (TEXT, INDEX)
- `asset_name` (TEXT)
- `display_name` (TEXT)
- `appearance_json` (JSON)
- `voice_style` (TEXT)
- `forbidden_traits_json` (JSON)
- `version` (INTEGER)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

##### 14.3.2 表：`shot_character_links`
- `id` (TEXT, PK)
- `project_id` (TEXT, INDEX)
- `shot_id` (TEXT, INDEX)
- `character_id` (TEXT, INDEX)
- `bind_source` (TEXT, enum: manual/auto_parse)
- `created_at` (DATETIME)

##### 14.3.3 表：`consistency_reports`
- `id` (TEXT, PK)
- `project_id` (TEXT, INDEX)
- `shot_id` (TEXT, INDEX, nullable for project summary)
- `score_total` (INTEGER)
- `score_identity` (INTEGER)
- `score_outfit` (INTEGER)
- `score_style` (INTEGER)
- `risk_level` (TEXT)
- `issues_json` (JSON)
- `created_at` (DATETIME)

##### 14.3.4 表：`consistency_patches`
- `id` (TEXT, PK)
- `project_id` (TEXT, INDEX)
- `shot_id` (TEXT, INDEX)
- `report_id` (TEXT)
- `before_text` (TEXT)
- `after_text` (TEXT)
- `confidence` (REAL)
- `status` (TEXT, enum: generated/applied/rejected)
- `created_at` (DATETIME)
- `applied_at` (DATETIME, nullable)

#### 14.4 实现框架和核心函数描述

##### 14.4.1 前端（React + Zustand）
- 新组件建议：
  - `src/components/CharacterStudioPanel.tsx`（角色卡管理）
  - `src/components/ConsistencyInspector.tsx`（评分与问题面板）
  - `src/components/ConsistencyPatchPreview.tsx`（补丁预览/应用）
- Store 扩展建议（`src/store/editorStore.ts`）：
```ts
upsertCharacterProfile(profile: CharacterProfile): void
checkShotConsistency(shotId: string): Promise<ConsistencyReport>
checkProjectConsistency(): Promise<ProjectConsistencySummary>
applyConsistencyPatch(patchId: string): Promise<void>
```

##### 14.4.2 服务层（Backend Proxy + LLM）
- 新服务建议：
  - `src/services/characterConsistencyService.ts`
  - `server/services/consistency-engine.mjs`
- 核心函数建议：
```ts
extractCharacterProfile(input): Promise<CharacterProfile>
scoreShotConsistency(shot, profiles): Promise<ConsistencyReport>
generateRepairPatch(report): Promise<ConsistencyPatch>
```

#### 14.5 数据链路（数据传递）描述

1. 用户在 `AssetManager` 维护角色描述。  
2. 前端触发 `profile/extract`，返回结构化角色卡并写入 `character_profiles`。  
3. 用户编辑分镜时，通过 `shot_character_links` 绑定角色。  
4. 生成前触发 `check-shot`，返回评分和问题。  
5. 前端展示问题并允许“一键修复”。  
6. 触发 `consistency/repair` 生成补丁，用户确认后应用。  
7. 应用后重跑 `check-shot`，刷新评分并写入 `consistency_reports`。  
8. 发布前跑 `check-project`，输出全项目一致性报告。  

#### 14.6 细粒度开发拆解（更新于 2026-03-11）

##### 阶段一：基础架构（A1-A2）✅ 已完成
- [x] A1：定义类型与常量
  - 在 `src/types/index.ts` 添加 `CharacterProfile`, `ConsistencyReport`, `ConsistencyPatch` 类型
  - 定义 `ConsistencyIssueType` 枚举（outfit_conflict, style_drift, identity_mismatch, missing_reference）
  - 定义 `RiskLevel` 枚举（low, medium, high, critical）
- [x] A2：Store 状态扩展
  - 在 `editorStore.ts` 添加 `characterProfiles: Record<string, CharacterProfile>`
  - 添加 `consistencyReports: Record<string, ConsistencyReport>`
  - 添加 `consistencyPatches: Record<string, ConsistencyPatch>`
  - 添加 `shotCharacterLinks: ShotCharacterLink[]`
  - 集成到 persist 和 temporal 中间件持久化
  - 实现 12 个相关 Actions（upsertCharacterProfile, linkCharacterToShot, applyConsistencyPatch 等）

##### 阶段二：服务层实现（A3-A5）✅ 已完成
- [x] A3：创建 `src/services/characterConsistencyService.ts`
  - ✅ `extractCharacterProfileFromAsset(asset, llmConfig)` - 调用 LLM 解析资产描述
  - ✅ `checkShotConsistency(shot, profile, llmConfig)` - 检查单分镜
  - ✅ `checkProjectConsistency(shots, profiles, getLinkedCharacters, llmConfig, onProgress)` - 批量检查
  - ✅ `generateRepairPatch(shot, profile, report, mode, llmConfig)` - 生成修复建议
- [x] A4：Prompt 模板库实现
  - ✅ `PROMPT_TEMPLATES.extractProfile` - 角色特征提取 Prompt
  - ✅ `PROMPT_TEMPLATES.checkConsistency` - 一致性检查 Prompt  
  - ✅ `PROMPT_TEMPLATES.generateRepair` - 修复补丁生成 Prompt
- [ ] A5：代理路由注册（`server/proxy-server.mjs`）- 可选，前端可直接调用服务

##### 阶段三：UI 组件（A6-A9）进行中
- [x] A6：`src/components/CharacterStudioPanel.tsx`
  - ✅ 角色卡列表展示
  - ✅ 角色详情编辑（外貌、服装、语气、禁忌）
  - ✅ 从 Asset 自动生成角色档案
  - ✅ 编辑表单（ProfileEditor 子组件）
- [x] A7：`src/components/ConsistencyInspector.tsx`
  - ✅ 分镜评分显示（总分 + 子维度分）
  - ✅ 问题列表（类型、描述、严重程度）
  - ✅ 风险色阶标识（绿/黄/橙/红）
  - ✅ 一键修复按钮
- [ ] A8：`src/components/ConsistencyPatchPreview.tsx`
  - 前后对比视图（diff 高亮）
  - 置信度显示
  - 应用/拒绝操作
- [ ] A9：集成到现有组件（待完成）
  - `ShotCard` 添加一致性状态图标
  - `AssetManager` 添加"生成角色卡"按钮
  - `ShotListPanel` 添加"批量检查"按钮

##### 阶段四：测试与优化（A10）
- [ ] A10：回归测试
  - 测试场景：角色服装冲突检测与修复
  - 测试场景：风格漂移检测
  - 测试场景：修复后分数提升验证

---

#### 14.7 API 详细规范

##### 请求/响应详细定义

**POST /api/characters/profile/extract**
```typescript
// Request
interface ExtractProfileRequest {
  assetName: string;
  assetDescription?: string;
  assetImageUrl?: string;  // 可选：视觉分析
}

// Response
interface CharacterProfile {
  id: string;
  assetName: string;  // 关联的 asset name
  displayName: string;
  appearance: {
    hair?: string;      // "黑色长发"
    face?: string;      // "瓜子脸，大眼睛"
    build?: string;     // "高挑纤细"
    age?: string;       // "20岁左右"
  };
  outfit: {
    default: string;    // "红色汉服，白色内衬"
    alternatives?: string[];  // 允许变体
  };
  voiceStyle?: string;  // "冷静沉稳"
  personality?: string; // "内敛，果断"
  forbiddenTraits: string[];  // ["短发", "现代服装"]
  version: number;
  createdAt: number;
  updatedAt: number;
}
```

**POST /api/consistency/check-shot**
```typescript
// Request
interface CheckShotRequest {
  shotId: string;
  shotDescription: string;
  characterIds: string[];  // 绑定的角色ID列表
}

// Response
interface ConsistencyReport {
  id: string;
  shotId: string;
  characterId: string;
  score: {
    total: number;       // 0-100
    identity: number;    // 身份一致性（是否是该角色）
    outfit: number;      // 服装一致性
    style: number;       // 风格一致性（语气、场景匹配）
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: ConsistencyIssue[];
  generatedAt: number;
}

interface ConsistencyIssue {
  type: 'outfit_conflict' | 'style_drift' | 'identity_mismatch' | 'missing_reference';
  severity: 'warning' | 'error' | 'critical';
  message: string;       // "服装与角色卡冲突：红色汉服 -> 黑色西装"
  suggestedFix?: string; // "建议改为红色汉服"
  autoFixable: boolean;  // 是否可以自动修复
}
```

**POST /api/consistency/repair**
```typescript
// Request
interface GenerateRepairRequest {
  reportId: string;
  mode: 'safe' | 'aggressive';  // safe: 最小改动, aggressive: 全面优化
}

// Response
interface ConsistencyPatch {
  id: string;
  reportId: string;
  shotId: string;
  before: string;        // 原始描述
  after: string;         // 修复后描述
  changes: string[];     // 变更点列表
  confidence: number;    // 0-1
  explanation: string;   // 修复说明
  createdAt: number;
  status: 'pending' | 'applied' | 'rejected';
}
```

#### 14.8 实现逻辑详细设计

##### A. 角色特征提取逻辑
1. **输入**：Asset 的 name + description + 可选图片
2. **LLM Prompt 模板**：
   ```
   请从以下角色描述中提取结构化信息：
   
   角色名：{name}
   描述：{description}
   
   请提取以下字段（JSON格式）：
   - appearance: 外貌特征（头发、面部、身材、年龄）
   - outfit: 服装描述（主服装、允许变体）
   - voiceStyle: 语气风格
   - personality: 性格特点
   - forbiddenTraits: 禁忌特征（与描述冲突的元素）
   ```
3. **输出**：结构化的 CharacterProfile
4. **存储**：写入 `characterProfiles`，key 为 asset name

##### B. 一致性检查逻辑
1. **输入**：Shot 描述 + 绑定的 CharacterProfile 列表
2. **解析**：提取 @角色名 引用，确认绑定的 profile 是否完整
3. **LLM 评估**：
   ```
   请评估以下分镜描述与角色设定的一致性：
   
   角色设定：{profile}
   分镜描述：{shotDescription}
   
   请从以下维度评分（0-100）：
   - identity: 是否正确引用了角色
   - outfit: 服装是否与设定一致
   - style: 场景/语气是否与角色风格匹配
   
   如发现不一致，列出具体问题。
   ```
4. **评分聚合**：取各维度加权平均
5. **风险定级**：
   - 90-100: low（绿色）
   - 70-89: medium（黄色）
   - 50-69: high（橙色）
   - 0-49: critical（红色）

##### C. 修复补丁生成逻辑
1. **输入**：ConsistencyReport（含问题列表）
2. **过滤**：仅处理 autoFixable = true 的问题
3. **LLM 生成**：
   ```
   请修复以下分镜描述中的角色一致性问题：
   
   原始描述：{shotDescription}
   角色设定：{profile}
   问题列表：{issues}
   
   修复模式：{mode}
   - safe: 最小改动，仅修复冲突点
   - aggressive: 全面优化，确保风格统一
   
   请输出修复后的描述，并解释变更点。
   ```
4. **Diff 计算**：标记 before/after 的差异
5. **置信度评估**：LLM 自评 + 规则校验

#### 14.9 预期难点与解决方案

| 难点 | 描述 | 解决方案 |
|------|------|----------|
| **H1: LLM 解析不稳定** | 角色特征提取可能不准确或格式不一致 | 1. 严格的 JSON Schema 校验<br>2. 失败后重试机制<br>3. 用户可手动修正提取结果 |
| **H2: 服装变体判断** | 角色换装是剧情需要还是错误难以区分 | 1. 在 profile 中明确定义 alternatives<br>2. 引入"场景上下文"判断<br>3. high risk 时才提示 |
| **H3: 多角色冲突** | 一个分镜引用多个角色时的优先级 | 1. 分别检查每个角色<br>2. 独立评分，不互相覆盖<br>3. UI 展示时按角色分组 |
| **H4: 修复过度** | 自动修复可能改变原意 | 1. safe/aggressive 双模式<br>2. 必须用户确认<br>3. 支持一键回滚 |
| **H5: 性能问题** | 全项目检查可能触发大量 LLM 调用 | 1. 本地缓存检查结果（10分钟）<br>2. 增量检查（仅检查修改过的分镜）<br>3. 批量 API 合并请求 |

#### 14.10 验收要求（Definition of Done）

**功能验收**
- [ ] 从 Asset 描述成功提取结构化角色卡（准确率 > 80%）
- [ ] 单分镜检查响应时间 < 3 秒
- [ ] 评分系统能正确识别服装冲突、风格漂移、身份错误
- [ ] 修复补丁应用后，重新检查分数提升 > 20%
- [ ] 支持一键回滚已应用的补丁

**UI 验收**
- [ ] 角色卡面板展示清晰，支持编辑
- [ ] 检查报告以可视化方式展示（雷达图或条形图）
- [ ] 风险等级使用色阶区分（绿/黄/橙/红）
- [ ] 补丁预览界面显示 diff 高亮

**质量验收**
- [ ] 代码覆盖率 > 60%
- [ ] 无 TypeScript 编译错误
- [ ] 通过手动测试场景（服装冲突修复流程）
- [ ] 文档完整（API 文档、使用说明）

#### 14.11 版本基线更新

**当前版本**: v0.9.0（任务完成后将更新为 v1.0.0）

**本次更新范围**:
- 新增角色一致性引擎 2.0
- 新增 4 个 API 端点
- 新增 3 个 UI 组件
- 新增 1 个服务模块
- 扩展 Store 状态（向后兼容）

**依赖变更**:
- 无需新增 npm 依赖（复用现有 LLM 调用机制）

### 🚧 Task 15: 路线 B - 爆款命中实验室（规划中）

> 目标：将“内容生成”升级为“增长实验”，降低发布靠运气的风险。

#### 15.1 用户行为 -> 产品功能描述

| 用户行为 | 产品功能 | 用户可见结果 |
|---|---|---|
| 选择平台 + 目标受众 + 创作目标 | 增长实验会话创建 | 自动生成该平台适配策略 |
| 点击“生成开场钩子” | 一次生成 3-5 个 Hook 版本 | 多版本可直接 A/B 比较 |
| 点击“命中评分” | 对每个 Hook 做留存/传播/冲突评分 | 快速选出最优版本 |
| 点击“一键改写到最佳版” | 自动改写首屏文案与前 3 镜头节奏 | 降低人工试错成本 |
| 点击“生成发布包” | 生成标题、正文、标签、封面文案 | 可直接发布或二次编辑 |

#### 15.2 API 接口描述

##### 15.2.1 `POST /api/growth/hooks/generate`
- 用途：按平台生成多版本开场钩子。
- Request:
```json
{
  "projectId": "proj_001",
  "platform": "douyin",
  "targetAudience": "18-24 动作片偏好",
  "goal": "提高前3秒留存",
  "shotSummary": ["分镜1...", "分镜2..."],
  "count": 3
}
```
- Response:
```json
{
  "experimentId": "exp_001",
  "variants": [
    {"variantId": "v1", "hookText": "开场爆点文案A", "hookType": "conflict"},
    {"variantId": "v2", "hookText": "开场爆点文案B", "hookType": "curiosity"},
    {"variantId": "v3", "hookText": "开场爆点文案C", "hookType": "emotion"}
  ]
}
```

##### 15.2.2 `POST /api/growth/hooks/score`
- 用途：对候选 Hook 打分并解释。
- Request:
```json
{
  "experimentId": "exp_001",
  "variants": ["v1", "v2", "v3"],
  "platform": "douyin"
}
```
- Response:
```json
{
  "scores": [
    {
      "variantId": "v2",
      "totalScore": 87,
      "retention3s": 92,
      "sharePotential": 84,
      "policyRisk": 11,
      "reason": "冲突建立更快，适合短视频起手"
    }
  ],
  "winnerVariantId": "v2"
}
```

##### 15.2.3 `POST /api/growth/hooks/rewrite`
- 用途：将中选 Hook 回写为分镜改稿建议。
- Request:
```json
{
  "projectId": "proj_001",
  "winnerVariantId": "v2",
  "rewriteScope": "first_3_shots"
}
```
- Response:
```json
{
  "patchId": "gpatch_001",
  "rewrittenShots": [
    {"shotId": "shot_001", "before": "原文案", "after": "改写后文案"}
  ]
}
```

##### 15.2.4 `POST /api/growth/publish-pack/generate`
- 用途：基于中选方案生成跨平台发布包。
- Request:
```json
{
  "projectId": "proj_001",
  "platforms": ["douyin", "bilibili", "xiaohongshu"],
  "winnerVariantId": "v2"
}
```
- Response:
```json
{
  "packs": [
    {
      "platform": "douyin",
      "title": "标题",
      "description": "正文",
      "tags": ["标签1", "标签2"]
    }
  ]
}
```

#### 15.3 数据格式（数据库）描述

##### 15.3.1 表：`growth_experiments`
- `id` (TEXT, PK)
- `project_id` (TEXT, INDEX)
- `platform` (TEXT)
- `target_audience` (TEXT)
- `goal` (TEXT)
- `status` (TEXT, enum: draft/scored/finalized)
- `winner_variant_id` (TEXT, nullable)
- `created_at` (DATETIME)

##### 15.3.2 表：`hook_variants`
- `id` (TEXT, PK)
- `experiment_id` (TEXT, INDEX)
- `hook_text` (TEXT)
- `hook_type` (TEXT)
- `script_patch_json` (JSON)
- `created_at` (DATETIME)

##### 15.3.3 表：`hook_scores`
- `id` (TEXT, PK)
- `experiment_id` (TEXT, INDEX)
- `variant_id` (TEXT, INDEX)
- `total_score` (INTEGER)
- `retention_3s` (INTEGER)
- `share_potential` (INTEGER)
- `policy_risk` (INTEGER)
- `reason` (TEXT)
- `created_at` (DATETIME)

##### 15.3.4 表：`publish_packs`
- `id` (TEXT, PK)
- `project_id` (TEXT, INDEX)
- `experiment_id` (TEXT, INDEX)
- `platform` (TEXT)
- `title` (TEXT)
- `description` (TEXT)
- `tags_json` (JSON)
- `created_at` (DATETIME)

#### 15.4 实现框架和核心函数描述

##### 15.4.1 前端（React + Zustand）
- 新组件建议：
  - `src/components/HookLabPanel.tsx`
  - `src/components/HookVariantCompare.tsx`
  - `src/components/GrowthScoreBoard.tsx`
- Store 扩展建议：
```ts
createHookExperiment(input: GrowthExperimentInput): Promise<string>
generateHookVariants(experimentId: string): Promise<HookVariant[]>
scoreHookVariants(experimentId: string): Promise<HookScore[]>
applyWinningHook(experimentId: string, variantId: string): Promise<void>
generatePublishPack(experimentId: string, platforms: string[]): Promise<PublishPack[]>
```

##### 15.4.2 服务层（Backend Proxy + 策略引擎）
- 新服务建议：
  - `src/services/growthLabService.ts`
  - `server/services/hook-lab-engine.mjs`
- 核心函数建议：
```ts
generateHooksByPlatform(context): Promise<HookVariant[]>
scoreHook(variant, platform): Promise<HookScore>
rewriteShotsWithHook(variant, shots): Promise<ShotPatch[]>
buildPublishPack(winnerVariant, platform): Promise<PublishPack>
```

#### 15.5 数据链路（数据传递）描述

1. 用户在 Hook Lab 选择平台、受众和目标。  
2. 前端调用 `hooks/generate`，写入 `growth_experiments + hook_variants`。  
3. 用户触发评分，调用 `hooks/score`，写入 `hook_scores`。  
4. 用户选择优胜版本，调用 `hooks/rewrite` 生成分镜补丁。  
5. 用户确认后应用补丁并更新分镜。  
6. 用户触发 `publish-pack/generate`，写入 `publish_packs`。  
7. 发布前在 UI 中查看最终版本并一键复制。  

#### 15.6 细粒度开发拆解
- [ ] B1：定义 `GrowthExperiment / HookVariant / HookScore / PublishPack` 类型与存储结构。
- [ ] B2：完成 Hook 生成 + 评分 API 原型。
- [ ] B3：完成 Hook 对比 UI（版本卡片 + 分数雷达/条形图）。
- [ ] B4：完成“优胜版本改写分镜”补丁链路。
- [ ] B5：完成跨平台发布包生成与回归测试。

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
