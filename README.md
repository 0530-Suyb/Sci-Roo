# Sci-Roo

Sci-Roo 是一个面向科研工作流的 VS Code AI 扩展，覆盖从研究问题澄清、文献阅读、实验分析到论文写作和同行评审的完整链路。

## 最新工作区更新

最近一轮围绕科研工作流做了几项重要调整：

- `Research Pipeline` 已改为默认首页，不再由原来的 `New Task` 作为初始进入面板
- 原 `New Task` 现在面向用户统一命名为 `Agent Chat`
- 项目初始化入口统一收敛到 `Research Pipeline > Project Workspace`
- Sci-Roo 现在只允许在当前 VS Code 打开的根目录内初始化和工作
- `Research Pipeline` 会在项目创建后显示独立的 `Agent Chat`、`Read Paper`、`Data Studio`、`Paper Writing` 状态卡片
- `Agent Chat` 卡片默认进入 `sci-problem-framing` mode，并自动基于项目 description 发起“先研究问题、后文章规划”的引导对话
- 项目创建时填写的 `description` 会写入 `problem/research-questions.md` 开头，并作为后续研究问题澄清的背景

补充文档：

- [README - research pipeline workspace.md](<README - research pipeline workspace.md>)
- [README - paper writing workspace.md](<README - paper writing workspace.md>)
- [finished.md](finished.md)

## 产品定位

Sci-Roo 的核心目标是把科研工作流拆成清晰协作的几个阶段：

1. 明确研究问题
2. 阅读和组织相关文献
3. 设计实验与分析方案
4. 执行分析和生成结果
5. 撰写与修订论文

当前更推荐的使用路径是：

1. 打开一个 VS Code 根目录
2. 进入 `Research Pipeline`
3. 在 `Project Workspace` 中初始化当前根目录
4. 点击 `Agent Chat`，先澄清研究问题
5. 逐步形成：
    - `problem/research-questions.md`
    - `task/paper-plan.md`
6. 再进入：
    - `Read Paper`
    - `Data Studio`
    - `Paper Writing`

## 内置科研模式

当前内置 7 个科研模式：

| slug                  | 模式名                   | 作用                           |
| --------------------- | ------------------------ | ------------------------------ |
| `sci-lit-review`      | Literature Review        | 搜索、评估和整理文献           |
| `sci-hyp-design`      | Hypothesis & Design      | 假设设计与实验规划             |
| `sci-problem-framing` | Research Problem Framing | 先澄清研究问题，再整理文章规划 |
| `sci-data-analysis`   | Data Analysis            | 数据分析、统计检验与复现脚本   |
| `sci-visualization`   | Visualization            | 生成论文级图表                 |
| `sci-paper-writing`   | Paper Writing            | manuscript 写作与修订          |
| `sci-peer-review`     | Peer Review              | 同行评审与回复意见             |

其中新增的 `sci-problem-framing` 专门用于：

- 从项目 description 出发
- 通过偏苏格拉底式提问先澄清研究问题
- 先写 `problem/research-questions.md`
- 再形成 `task/paper-plan.md`

## 当前工作区结构

### Research Pipeline

`Research Pipeline` 是默认首页，负责：

- 初始化当前 VS Code 根目录
- 展示研究流程卡片
- 启动问题澄清型 `Agent Chat`
- 作为 `Read Paper`、`Data Studio`、`Paper Writing` 的统一入口

### Agent Chat

`Agent Chat` 是原 `New Task` 的新名称。

从 `Research Pipeline` 进入时，它会：

- 默认切到 `sci-problem-framing`
- 自动带上项目上下文发起对话
- 先帮助用户梳理研究问题，再进入文章规划

### Paper Writing Workspace

`Paper Writing Workspace` 现在主要负责：

- manuscript 写作状态
- 引用与 `.bib` 检查
- revision log
- 选中文本的局部 AI 改写

它不再是项目创建主入口。

## 代码结构

这是一个 pnpm monorepo，主要目录包括：

- `src/`
    - VS Code 扩展后端
- `webview-ui/`
    - React webview 前端
- `packages/`
    - 共享类型、核心逻辑、telemetry 等
- `apps/`
    - CLI、Web、E2E 等独立应用
- `.roo/`
    - 规则、skills、科研模式相关资产

与本轮工作最相关的目录：

- `src/services/research-pipeline/`
- `src/services/paper/`
- `src/core/webview/`
- `webview-ui/src/components/research/`
- `webview-ui/src/components/paper/`
- `webview-ui/src/components/chat/`

## 本轮新增或重要调整的能力

- `Project Workspace` 卡片只围绕当前 VS Code 根目录工作
- 项目创建时会初始化：
    - `.roo/project.json`
    - `problem/research-questions.md`
    - `task/paper-plan.md`
- 项目 description 会展示在 `Project Workspace` 卡片中
- `Agent Chat` 卡片点击后自动进入 `sci-problem-framing` 并起一轮引导式对话
- 移除了无效的 `paperProjectOpen` 消息链
- 修复了 `ExtensionStateContext` 重复实例化问题
- 修复了 `Agent Chat` 自动起聊时 `ChatTextArea` 的 `trim()` 崩溃问题

## 构建与验证

常用命令：

```bash
pnpm build
pnpm exec tsc -p webview-ui/tsconfig.json --noEmit
pnpm exec tsc -p src/tsconfig.json --noEmit
```

开发扩展：

```bash
code --extensionDevelopmentPath="./src" .
```

## 相关文档

- [README - research pipeline workspace.md](<README - research pipeline workspace.md>)
- [README - paper writing workspace.md](<README - paper writing workspace.md>)
- [finished.md](finished.md)
- [AGENTS.md](AGENTS.md)
