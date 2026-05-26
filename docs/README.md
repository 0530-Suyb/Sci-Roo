# Docs Map

`docs/` 目录不是产品唯一入口，也不是所有文档都适合第一次接触仓库的人直接阅读。

更好的理解方式是：先从根 [README.md](../README.md) 进入，再按读者角色进入不同层级的文档。

## 阅读顺序

如果你是第一次接触这个工程，推荐顺序：

1. [../README.md](../README.md)
2. [dev/onboarding.md](dev/onboarding.md)
3. 你要改动的工作区文档
4. 需要追踪设计时，再进入 `docs/` 里的 feature notes 和历史记录

## 文档分层

### 1. Developer Entry

- [../README.md](../README.md)
    - 项目简介、开发快速开始、主阅读路径
- [dev/onboarding.md](dev/onboarding.md)
    - 第一次接手仓库时先看

### 2. Product Docs

- [../README - research pipeline workspace.md](<../README - research pipeline workspace.md>)
    - `Research Pipeline Workspace` 的职责、边界和推荐流程
- [../README - read paper workspace.md](<../README - read paper workspace.md>)
    - `Read Paper Workspace` 的职责、边界和推荐流程
- [../README - paper writing workspace.md](<../README - paper writing workspace.md>)
    - `Paper Writing Workspace` 的职责、边界和推荐流程

### 3. Feature Notes

- [feature-notes/paper-writing-workspace/problem.md](feature-notes/paper-writing-workspace/problem.md)
    - `Paper Writing Workspace` 这类大功能的遗留问题、待补项和下一轮方向
- [feature-notes/paper-writing-workspace/finished.md](feature-notes/paper-writing-workspace/finished.md)
    - `Paper Writing Workspace` 这类大功能已经完成的任务和阶段性收口
- [feature-notes/read-paper-workspace/0518.md](feature-notes/read-paper-workspace/0518.md)
    - `Read Paper Workspace` 的早期阶段记录
- [feature-notes/read-paper-workspace/0519.md](feature-notes/read-paper-workspace/0519.md)
    - `Read Paper Workspace` 的阶段记录
- [feature-notes/read-paper-workspace/readpaper-retrieval-plan.md](feature-notes/read-paper-workspace/readpaper-retrieval-plan.md)
    - `Read Paper Workspace` 的检索方案与检索资产设计
- [feature-notes/read-paper-workspace/readpaper-redesign-proposal.md](feature-notes/read-paper-workspace/readpaper-redesign-proposal.md)
    - `Read Paper Workspace` 的重构提案与长期演进方向
- [feature-notes/read-paper-workspace/tool-invocation-flows.md](feature-notes/read-paper-workspace/tool-invocation-flows.md)
    - `Read Paper Workspace` 相关的工具调用与 job 流程说明

这类文档更像功能开发台账或方案材料，而不是产品主说明书。

### 4. Historical Notes

如果你要看阶段性的历史记录，优先看 `docs/feature-notes/read-paper-workspace/` 下的 `0518.md` 和 `0519.md`。

## 读者角色

为了避免入口混乱，可以这样理解不同文档的目标读者：

- 开发者第一次上手：看 `README.md` 和 `docs/dev/onboarding.md`
- 想理解产品行为：看 3 个 workspace README
- 想了解某个大功能做到哪一步：看 `docs/feature-notes/` 下对应目录里的材料
- AI agent：看 [AGENTS.md](../AGENTS.md)

## 一个简单判断原则

如果你只是想回答“现在这个产品怎么工作”，优先看：

- 根 `README.md`
- workspace README
- 代码

如果你想回答“为什么当时这样设计”，再看：

- `docs/feature-notes/read-paper-workspace/0518.md`
- `docs/feature-notes/read-paper-workspace/0519.md`
- `docs/feature-notes/read-paper-workspace/readpaper-retrieval-plan.md`
- `docs/feature-notes/read-paper-workspace/readpaper-redesign-proposal.md`
