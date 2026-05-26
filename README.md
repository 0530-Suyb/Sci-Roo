# Sci-Roo

Sci-Roo 是一个面向科研工作流的 VS Code 扩展。它基于 Roo Code 扩展出一组研究专用模式与工作区，把研究问题澄清、文献检索、数据分析、可视化、论文写作和同行评审串成一条更清晰的科研流程。

## What This Repo Contains

这个仓库是一个 `pnpm` monorepo，核心目录如下：

- `src/`: VS Code 扩展后端
- `webview-ui/`: React webview 前端
- `packages/`: 共享类型、核心库、遥测、evals
- `apps/`: CLI、Web、E2E 等独立应用
- `docs/`: 产品文档、开发者文档、设计记录

## Quick Start For Developers

### 1. 环境要求

- Node.js `20.19.2`
- `pnpm@10`
- VS Code

### 2. 安装依赖

```bash
pnpm install
```

### 3. 常用检查命令

```bash
pnpm build
pnpm check-types
pnpm lint
pnpm test
```

### 4. 本地调试扩展

在 VS Code 中打开仓库后，直接按 `F5` 启动 extension development host。

如果你更偏向命令行安装 VSIX，也可以使用：

```bash
pnpm install:vsix
```

## Read This First

如果你是第一次接触这个工程，推荐按这个顺序阅读：

1. [开发者上手指南](docs/dev/onboarding.md)
2. [文档地图](docs/README.md)
3. 你要改动的工作区说明
    - [Research Pipeline Workspace](<README - research pipeline workspace.md>)
    - [Read Paper Workspace](<README - read paper workspace.md>)
    - [Paper Writing Workspace](<README - paper writing workspace.md>)

## Product Model

当前产品主流程围绕 4 个入口组织：

- `Research Pipeline`
    - 项目初始化与前期研究规划
- `Agent Chat`
    - 配合 `sci-problem-framing` 等模式澄清研究问题
- `Read Paper Workspace`
    - 文献检索、候选筛选、入库准备
- `Paper Writing Workspace`
    - manuscript 写作辅助、引用检查、revision 支持

Sci-Roo 额外提供 7 个研究模式：

| Slug                  | Mode                | Purpose                      |
| --------------------- | ------------------- | ---------------------------- |
| `sci-lit-review`      | Literature Review   | 搜索、评估、综合文献         |
| `sci-hyp-design`      | Hypothesis & Design | 假设设计、实验设计、功效分析 |
| `sci-problem-framing` | Problem Framing     | 先澄清研究问题，再规划论文   |
| `sci-data-analysis`   | Data Analysis       | 强调严谨与可复现的数据分析   |
| `sci-visualization`   | Visualization       | 生成论文级图表               |
| `sci-paper-writing`   | Paper Writing       | manuscript 写作与投稿准备    |
| `sci-peer-review`     | Peer Review         | 评审与修回支持               |

## Docs Map

- [docs/dev/onboarding.md](docs/dev/onboarding.md): 第一次接手本仓库时先看
- [docs/README.md](docs/README.md): 文档分层与阅读路径
- [AGENTS.md](AGENTS.md): 给 AI agent 的仓库规则，不是开发者主入口
- [CONTRIBUTING.md](CONTRIBUTING.md): 通用贡献流程

## Notes

- 当前仓库继承了 Roo Code 的 monorepo 基础设施，因此部分脚本、贡献流程与目录会保留 Roo Code 的约定。
- 如果你在修改 `SettingsView`，输入必须绑定本地 `cachedState`，不要直接绑定 live `useExtensionState()`。这是仓库里的重要开发约束。
