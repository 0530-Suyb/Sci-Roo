# Research Pipeline Workspace

## 这是什么

`Research Pipeline Workspace` 是 Sci-Roo 当前的总入口。它不是替代具体执行工作区，而是负责把研究流程的起点和下一步入口组织清楚。

它主要负责：

- 在当前 VS Code 根目录中初始化 Sci-Roo 项目
- 承接前期研究问题澄清与规划
- 统一进入 `Read Paper`、`Data Studio`、`Paper Writing`
- 展示当前项目所处的流程阶段

## 什么时候看这篇文档

当你想理解以下问题时，先看这里：

- 为什么 `Research Pipeline` 会成为默认首页
- 项目初始化发生了什么
- `Agent Chat` 在整个产品链路中扮演什么角色
- 其他 workspace 为什么不直接作为总入口

## 当前产品定位

`Research Pipeline Workspace` 处理的是“项目建立与前期规划”，而不是具体的文献筛选、数据分析或正文写作。

推荐理解为：

- `Research Pipeline`
    - 总入口、项目初始化、前期规划
- `Read Paper Workspace`
    - 文献检索与筛选
- `Data Studio`
    - 实验、分析、结果产出
- `Paper Writing Workspace`
    - manuscript 写作与 revision

## 页面结构

### Project Workspace

这是最关键的入口卡片，用于判断当前 VS Code 根目录是否已经初始化为 Sci-Roo 项目。

如果还没初始化，用户会在这里创建项目。

如果已经初始化，这里会展示项目基础信息，并开放后续工作区入口。

### Agent Chat

当前主要用于配合 `sci-problem-framing` 处理研究问题澄清和前期规划。

推荐流程通常是：

1. 切到 `sci-problem-framing`
2. 基于当前项目上下文整理研究问题
3. 产出 `problem/research-questions.md`
4. 推进 `task/paper-plan.md`

### Workspace Entrypoints

其余入口负责把用户引导到后续执行型工作区：

- `Read Paper`
- `Data Studio`
- `Paper Writing`

## 项目初始化时会发生什么

当前初始化流程通常会在 VS Code 根目录下建立一套标准研究结构，例如：

- `.roo/project.json`
- `problem/research-questions.md`
- `task/paper-plan.md`
- `latex/main.tex`

这意味着 Sci-Roo 当前默认围绕“当前打开的 VS Code 根目录”工作，而不是围绕任意外部目录切换。

## 推荐阅读路径

如果你第一次接触这个工程，建议阅读顺序是：

1. [README.md](README.md)
2. [docs/dev/onboarding.md](docs/dev/onboarding.md)
3. 本文
4. 再根据需要进入：
    - [README - read paper workspace.md](<README - read paper workspace.md>)
    - [README - paper writing workspace.md](<README - paper writing workspace.md>)

## 边界

这篇文档描述的是当前工作区职责和推荐使用路径，不负责记录所有设计演化细节。

如果你想追溯某个大功能是怎么一步步推进的，再去看：

- [docs/feature-notes/paper-writing-workspace/problem.md](docs/feature-notes/paper-writing-workspace/problem.md)
- [docs/feature-notes/paper-writing-workspace/finished.md](docs/feature-notes/paper-writing-workspace/finished.md)
