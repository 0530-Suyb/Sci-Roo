# Sci-Roo 工程介绍

Science Roo (Sci-Roo) — 一站式 AI 辅助科研平台，基于 Roo Code 增强，覆盖文献调研 → 假设设计 → 数据分析 → 可视化 → 论文写作 → 同行评审的完整科研工作流。

## 架构总览

```
Sci-Roo/
├── src/                          ← ★ 插件本体 (VS Code Extension)
├── webview-ui/                   ← ★ React 前端 UI
├── packages/                     ← 共享库 (types, core, cloud, telemetry...)
├── apps/                         ← 独立应用 (web版、CLI、评测工具)
├── mcp-servers/                  ← MCP 服务器 (PubMed, arXiv...)
├── .roo/                         ← 科研模式/规则/技能配置
├── scripts/                      ← 构建/安装脚本
├── schemas/                      ← JSON Schema
├── turbo.json                    ← Turborepo 构建流水线
├── pnpm-workspace.yaml           ← pnpm 工作区定义
└── tsconfig.json                 ← 根 TypeScript 配置
```

---

## 核心包

| 文件夹                        | 包名                          | 作用                                                   |
| ----------------------------- | ----------------------------- | ------------------------------------------------------ |
| `src/`                        | `sci-roo`                     | 插件后端：Agent 引擎、工具、LLM Provider、webview 通信 |
| `webview-ui/`                 | `@roo-code/vscode-webview`    | 插件前端：React + Tailwind UI 面板                     |
| `packages/types/`             | `@roo-code/types`             | 共享类型定义，所有包都依赖它                           |
| `packages/core/`              | `@roo-code/core`              | 共享核心逻辑                                           |
| `packages/telemetry/`         | `@roo-code/telemetry`         | 遥测/埋点                                              |
| `packages/cloud/`             | `@roo-code/cloud`             | 云服务集成                                             |
| `packages/ipc/`               | `@roo-code/ipc`               | 进程间通信                                             |
| `packages/build/`             | `@roo-code/build`             | 构建配置                                               |
| `packages/config-eslint/`     | `@roo-code/config-eslint`     | ESLint 共享配置                                        |
| `packages/config-typescript/` | `@roo-code/config-typescript` | TypeScript 共享配置                                    |
| `packages/evals/`             | `@roo-code/evals`             | 评测框架                                               |
| `packages/vscode-shim/`       | `@roo-code/vscode-shim`       | VS Code API 垫片                                       |

---

## 应用

| 文件夹                 | 包名                       | 作用               |
| ---------------------- | -------------------------- | ------------------ |
| `apps/cli/`            | `@roo-code/cli`            | 命令行工具         |
| `apps/web-roo-code/`   | `@roo-code/web-roo-code`   | Web 版（Next.js）  |
| `apps/web-evals/`      | `@roo-code/web-evals`      | 内部评测 Web 应用  |
| `apps/vscode-e2e/`     | `@roo-code/vscode-e2e`     | VS Code 端到端测试 |
| `apps/vscode-nightly/` | `@roo-code/vscode-nightly` | 每夜构建版         |

---

## 插件内部结构

### `src/` 后端

| 目录                              | 作用                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/tools/`                 | Agent 工具（ApplyDiff、EditFile、ReadFile、ExecuteCommand、SearchLiterature、GenerateFigure、GenerateManuscript、FormatCitations...） |
| `src/core/prompts/`               | 系统提示词构建，包含各模式的自定义指令生成                                                                                            |
| `src/core/webview/`               | 前后端通信（ClineProvider 主控制器、messageHandler 消息分发）                                                                         |
| `src/core/task/`                  | 任务执行引擎（Task.ts、工具调用循环）                                                                                                 |
| `src/core/config/`                | 配置管理（ContextProxy、ProviderSettingsManager、CustomModesManager）                                                                 |
| `src/core/assistant-message/`     | 助手消息渲染（工具调用描述、用户确认 UI）                                                                                             |
| `src/core/checkpoints/`           | 任务检查点/回滚                                                                                                                       |
| `src/services/literature/`        | 文献管理器（LiteratureManager）                                                                                                       |
| `src/services/research-pipeline/` | 研究流水线管理器（ResearchPipelineManager）                                                                                           |
| `src/services/paper-writing/`     | 论文写作管理器（PaperWritingManager）                                                                                                 |
| `src/services/data-studio/`       | 数据工作室管理器（DataStudioManager）                                                                                                 |
| `src/services/mcp/`               | MCP 协议 Hub（McpHub、McpServerManager）                                                                                              |
| `src/services/skills/`            | 技能管理器（SkillsManager、skillInvocation）                                                                                          |
| `src/services/code-index/`        | 代码索引（Qdrant 向量搜索）                                                                                                           |
| `src/services/search/`            | 文件搜索（ripgrep）                                                                                                                   |
| `src/activate/`                   | 扩展激活入口（extension.ts → activate/index.ts → registerCommands.ts）                                                                |
| `src/api/providers/`              | 30+ LLM API 适配器（Anthropic、OpenAI、Gemini、DeepSeek...）                                                                          |
| `src/shared/`                     | 共享工具（ExtensionState、WebviewMessage、ProfileValidator、modes、tools）                                                            |
| `src/utils/`                      | 工具函数（Git、FS、日志、token 计数）                                                                                                 |
| `src/i18n/`                       | 后端国际化（18 种语言）                                                                                                               |
| `src/integrations/`               | 编辑器/终端/主题集成                                                                                                                  |

### `webview-ui/` 前端

| 目录                          | 作用                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `src/components/chat/`        | 聊天界面（ChatView、ChatTextArea、TaskHeader、Markdown 渲染...） |
| `src/components/settings/`    | 设置面板（SettingsView、API 配置、模型选择器...）                |
| `src/components/literature/`  | 文献库面板（LiteratureView）                                     |
| `src/components/data-studio/` | 数据工作室面板（DataStudioView）                                 |
| `src/components/research/`    | 研究流水线面板（ResearchPipelineView）                           |
| `src/components/paper/`       | 论文写作面板（PaperWritingView）                                 |
| `src/components/marketplace/` | 市场面板                                                         |
| `src/components/cloud/`       | 云服务面板                                                       |
| `src/components/history/`     | 任务历史面板                                                     |
| `src/components/welcome/`     | 欢迎页面                                                         |
| `src/components/ui/`          | 基础 UI 组件（Button、Input、Dialog、Select...）                 |
| `src/components/common/`      | 通用组件（CodeBlock、DiffView、MarkdownBlock、MermaidBlock...）  |
| `src/context/`                | React 状态管理（ExtensionStateContext）                          |
| `src/i18n/locales/`           | 18 种语言翻译文件                                                |
| `src/hooks/`                  | 自定义 React Hooks                                               |

---

## 依赖关系

```
packages/types/          ← 所有包都引用它
     ↓
packages/core/  packages/telemetry/  packages/cloud/  packages/ipc/  ...
     ↓
src/ (插件后端)            ← 引用所有 packages/*
     ↓  vscode.postMessage()
webview-ui/ (插件前端)      ← 引用 packages/types
```

---

## 前端路由与通信

### Tab 路由

`App.tsx` 中定义 `Tab` 类型：`"chat" | "settings" | "history" | "marketplace" | "cloud" | "literature" | "dataStudio" | "researchPipeline" | "paperWriting"`

通过 `tabsByMessageAction` 将后端消息映射到 Tab：

| 后端 action                     | 前端 Tab           | 工具栏位置 |
| ------------------------------- | ------------------ | ---------- |
| `plusButtonClicked`             | `chat`             | 主栏 1     |
| `researchPipelineButtonClicked` | `researchPipeline` | 主栏 2     |
| `literatureButtonClicked`       | `literature`       | 主栏 3     |
| `dataStudioButtonClicked`       | `dataStudio`       | 主栏 4     |
| `paperWritingButtonClicked`     | `paperWriting`     | 主栏 5     |
| `historyButtonClicked`          | `history`          | 溢出菜单   |
| `popoutButtonClicked`           | (新标签页)         | 溢出菜单   |
| `settingsButtonClicked`         | `settings`         | 溢出菜单   |
| `cloudButtonClicked`            | `cloud`            | 溢出菜单   |
| `marketplaceButtonClicked`      | `marketplace`      | 溢出菜单   |

### 数据流

```
用户点击按钮 → registerCommands.ts 触发命令
  → ClineProvider.postMessageToWebview() 发送消息到前端
    → App.tsx onMessage() 接收并切换 Tab
      → 渲染对应组件（ChatView / LiteratureView / ResearchPipelineView ...）

前端用户操作 → vscode.postMessage() 发送消息到后端
  → webviewMessageHandler.ts 分发处理
    → 调用对应服务（LiteratureManager / ResearchPipelineManager / PaperWritingManager ...）
```

### 关键文件

| 文件                                                 | 作用                                    |
| ---------------------------------------------------- | --------------------------------------- |
| `src/extension.ts`                                   | 扩展入口                                |
| `src/activate/index.ts`                              | 激活逻辑                                |
| `src/activate/registerCommands.ts`                   | VS Code 命令注册                        |
| `src/core/webview/ClineProvider.ts`                  | Webview 主控制器                        |
| `src/core/webview/webviewMessageHandler.ts`          | 前端消息分发器                          |
| `src/core/webview/literatureMessageHandler.ts`       | 文献相关消息处理                        |
| `src/core/webview/researchPipelineMessageHandler.ts` | 研究流水线消息处理                      |
| `src/core/webview/paperWritingMessageHandler.ts`     | 论文写作消息处理                        |
| `src/shared/tools.ts`                                | 工具注册表                              |
| `src/shared/modes.ts`                                | 内置模式注册（含 Sci-Roo 6 个科研模式） |
| `packages/types/src/mode.ts`                         | 内置模式定义（DEFAULT_MODES）           |
| `packages/types/src/research.ts`                     | 科研相关类型定义                        |
| `webview-ui/src/App.tsx`                             | 前端根组件 + 路由                       |
| `webview-ui/src/context/ExtensionStateContext.tsx`   | 全局状态                                |

---

## 配置系统

### 插件清单

| 文件                     | 作用                                                           |
| ------------------------ | -------------------------------------------------------------- |
| `src/package.json`       | 扩展清单（name、displayName、commands、menus、keybindings...） |
| `src/package.nls.json`   | 默认（英文）本地化字符串                                       |
| `src/package.nls.*.json` | 各语言本地化（zh-CN、ja、de...18 种）                          |

### 内置科研模式

`packages/types/src/mode.ts` 的 `DEFAULT_MODES` 中内置 6 个科研模式，安装插件即用：

| slug                | 模式名                 | 功能                 |
| ------------------- | ---------------------- | -------------------- |
| `sci-lit-review`    | 📚 Literature Review   | 文献搜索、评估、综述 |
| `sci-hyp-design`    | 🔬 Hypothesis & Design | 假设设计、实验方案   |
| `sci-data-analysis` | 📊 Data Analysis       | 数据分析、统计检验   |
| `sci-visualization` | 📈 Visualization       | 科学图表生成         |
| `sci-paper-writing` | ✍️ Paper Writing       | 手稿撰写、格式排版   |
| `sci-peer-review`   | 🔍 Peer Review         | 同行评审、意见回复   |

### Roo 规则/技能

| 路径                | 作用                                                           |
| ------------------- | -------------------------------------------------------------- |
| `.roo/rules/`       | 全局规则（科研伦理、科学严谨性、引用标准、可复现性、隐私保护） |
| `.roo/rules-sci-*/` | 各科研模式专用规则                                             |
| `.roo/skills/`      | 技能定义（文献检索、统计检验、图表生成、引用管理、功效分析）   |

---

## MCP 生态

| 服务器   | 文件                           | 说明                       |
| -------- | ------------------------------ | -------------------------- |
| PubMed   | `mcp-servers/pubmed/server.py` | NCBI Entrez API，文献搜索  |
| arXiv    | `mcp-servers/arxiv/server.py`  | arXiv 公共 API，预印本搜索 |
| Python/R | (MCP 配置)                     | 交互式数据分析内核         |
| Zotero   | (MCP 配置)                     | 引用管理同步               |

---

## LLM 提供商

`src/api/providers/` 下支持 30+ 提供商：

Anthropic、OpenAI、OpenAI Codex、OpenAI Compatible、OpenRouter、Gemini、Vertex AI、DeepSeek、Mistral、XAI、Bedrock、LM Studio、Ollama、Fireworks、VS Code LM...

每个 Provider 继承自 `BaseProvider`，提供统一的 `completePrompt()` / `streamResponse()` 接口。

---

## 构建命令

```bash
# 完整构建
pnpm build

# 只构建插件
pnpm --filter @roo-code/types --filter @roo-code/vscode-webview --filter sci-roo build

# 分步构建
pnpm --filter @roo-code/types build          # 类型定义
pnpm --filter @roo-code/vscode-webview build # 前端 UI
pnpm --filter sci-roo bundle                 # 插件后端

# 打包 VSIX
pnpm vsix

# VS Code 扩展开发主机启动
code --extensionDevelopmentPath="./src" .
```

---

## 技术栈

| 层       | 技术                                          |
| -------- | --------------------------------------------- |
| 构建     | pnpm workspaces + Turborepo + esbuild + Vite  |
| 后端     | TypeScript (ES2022)、Node.js 20.19.2          |
| 前端     | React 18 + Tailwind CSS + Radix UI + Vite     |
| 类型     | tsup + Zod                                    |
| AI SDK   | Vercel AI SDK、Anthropic SDK、OpenAI Node SDK |
| 向量搜索 | Qdrant                                        |
| 国际化   | i18next（18 种语言）                          |
| MCP      | @modelcontextprotocol/sdk                     |
