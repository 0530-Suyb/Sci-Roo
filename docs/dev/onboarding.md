# Developer Onboarding

这篇文档面向第一次接手 Sci-Roo 的开发者。目标不是讲完所有细节，而是帮你在 10 分钟内回答 4 个问题：

1. 这个项目是什么
2. 我该怎么跑起来
3. 代码大致分布在哪
4. 如果我要改某一块功能，应该先看哪里

## 1. 项目是什么

Sci-Roo 是一个以 Roo Code 为基础演化出来的 VS Code 扩展，面向研究者提供一组研究专用工作区和 agent modes，覆盖：

- 文献综述
- 假设与实验设计
- 数据分析
- 可视化
- 论文写作
- 同行评审

它的核心理念见 [AGENTS.md](../../AGENTS.md)，包括：

- 严谨优先于方便
- 可复现优先
- 重视 effect size 和不确定性
- 强调科研伦理与引用准确性

## 2. 先怎么跑起来

### 环境

- Node.js `20.19.2`
- `pnpm@10`
- VS Code

### 安装

```bash
pnpm install
```

### 常用检查

```bash
pnpm build
pnpm check-types
pnpm lint
pnpm test
```

### 调试扩展

最常见方式是直接在 VS Code 里按 `F5`，打开 extension development host。

如果你需要打包并安装本地 VSIX：

```bash
pnpm install:vsix
```

## 3. 仓库结构怎么理解

### `src/`

VS Code 扩展后端主代码。适合在这里找：

- 命令注册
- provider / service / integration
- 模式系统与扩展逻辑

### `webview-ui/`

Webview 前端，使用 React 18、Tailwind、Radix UI。适合在这里找：

- 各工作区页面
- 设置页面
- 前端状态和组件层组织

### `packages/`

共享包。适合在这里找：

- 类型定义
- 通用核心逻辑
- telemetry
- evals

### `apps/`

独立应用，例如 CLI、Web 和测试相关应用。

### `docs/`

补充文档，不是唯一入口。分为：

- `docs/dev/`: 面向开发者
- `docs/`: 文档地图、专题方案、设计记录

## 4. 先看哪些文档

推荐阅读顺序：

1. [根 README](../../README.md)
2. [文档地图](../README.md)
3. 按你要改的功能，继续看对应工作区文档

如果你要改的内容偏产品行为，请看：

- [Research Pipeline Workspace](<../../README - research pipeline workspace.md>)
- [Read Paper Workspace](<../../README - read paper workspace.md>)
- [Paper Writing Workspace](<../../README - paper writing workspace.md>)

如果你要追踪某个大功能的推进记录，再看：

- [feature-notes/paper-writing-workspace/problem.md](../feature-notes/paper-writing-workspace/problem.md)
- [feature-notes/paper-writing-workspace/finished.md](../feature-notes/paper-writing-workspace/finished.md)
- [feature-notes/read-paper-workspace/0518.md](../feature-notes/read-paper-workspace/0518.md)
- [feature-notes/read-paper-workspace/0519.md](../feature-notes/read-paper-workspace/0519.md)
- [feature-notes/read-paper-workspace/readpaper-retrieval-plan.md](../feature-notes/read-paper-workspace/readpaper-retrieval-plan.md)
- [feature-notes/read-paper-workspace/readpaper-redesign-proposal.md](../feature-notes/read-paper-workspace/readpaper-redesign-proposal.md)
- [feature-notes/read-paper-workspace/tool-invocation-flows.md](../feature-notes/read-paper-workspace/tool-invocation-flows.md)
- 以及 `docs/` 下的历史记录与专题方案

## 5. 不同文档各自负责什么

- `README.md`: 开发者主入口
- `docs/README.md`: 文档导航和分层说明
- workspace README: 解释各工作区职责、边界和推荐流程
- `docs/feature-notes/.../problem.md`: 某个大功能的遗留问题与下一轮方向
- `docs/feature-notes/.../finished.md`: 某个大功能已完成的任务记录
- `AGENTS.md`: 给 AI agent 的仓库规则

## 6. 第一次改代码时最容易踩的坑

### SettingsView 的状态绑定

如果你在改 `SettingsView`，输入组件必须绑定本地 `cachedState`，不要直接绑定 live `useExtensionState()`。否则很容易产生状态竞争。

### 文档里有“当前事实”和“历史记录”两类内容

看到 `docs/feature-notes/...` 这类文件时，不要默认它们就是当前实现的 source of truth。当前行为应优先以代码和主入口文档为准。

## 7. 建议的源码进入方式

如果你想从产品视角切入，建议这样找代码：

1. 先看对应 workspace README，弄清楚产品职责
2. 在 `webview-ui/` 里找该工作区页面和组件
3. 在 `src/` 里找对应命令、状态同步、服务层或 provider
4. 需要共享类型时，再去 `packages/` 追

## 8. 这份文档不覆盖什么

这篇 onboarding 不打算替代：

- 详细架构设计文档
- 每个 workspace 的完整产品手册
- Roo Code 社区贡献流程

它只负责帮你顺利开始。
