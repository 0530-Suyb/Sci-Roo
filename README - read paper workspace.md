# Read Paper Workspace

## 这是什么

`Read Paper Workspace` 是 Sci-Roo 中专门面向文献检索、候选筛选和入库准备的工作区。

它的定位不是完整文献管理器，也不是 PDF 阅读器，而是把下面这条链路组织清楚：

`提出检索需求 -> 运行 retrieval -> 筛选 candidate -> 导入后续文献资产流`

## 核心职责

- 创建 retrieval
- 配置 query、sources、year range、max results
- 运行检索
- 浏览候选文献
- 标记 `confirmed` / `excluded`
- 将候选或整轮 retrieval 导入 literature library

## 不负责什么

为了避免误解，当前版本不负责：

- 完整 PDF 阅读与批注
- 成熟文献管理器的全部能力
- 自动替代人工做最终纳入判断
- 自动完成文献综述正文写作

## 和其他工作区的关系

推荐理解为：

- `Research Pipeline`
    - 先初始化项目，澄清研究问题
- `Read Paper Workspace`
    - 再围绕明确的问题做系统化检索与筛选
- `Paper Writing Workspace`
    - 最后处理正文写作、引用检查和 `.bib` 相关工作

也就是说，`Read Paper Workspace` 更像研究中期的检索与筛选台，而不是产品首页。

## 工作区结构

### Retrieval

当前最核心的模块，用于：

- 新建 retrieval
- 编辑检索需求
- 运行检索
- 查看候选结果
- 确认或排除候选文献

### Literature Library

承接从 retrieval 中被确认下来的文献资产，但当前还不是完整文献管理器。

### Literature Map

更偏后续扩展位，用于支持更结构化的文献组织与关系视图。当前更适合理解为预留能力，而不是成熟主流程。

### Settings

主要提供 retrieval 默认配置，例如：

- 默认 sources
- 默认 max results
- 默认 year range
- planner profile

## 如何理解 retrieval

一个 retrieval 可以理解为“一次可复现的文献检索任务资产”。

它通常包含：

- 标题
- 研究问题描述
- query
- search keywords
- sources
- year range
- max results
- 候选结果列表
- run 状态
- provenance 和 summary

它的价值在于不是一次性搜索框输入，而是可以保存、复用、回看和继续筛选的检索资产。

## 如何理解候选状态

- `candidate`
    - 检索结果，尚未做纳入判断
- `confirmed`
    - 认为值得保留，准备进入下一步文献资产流
- `excluded`
    - 明确判断不纳入当前问题范围
- `archived`
    - 更偏 retrieval 层状态，表示这一轮检索已归档

最重要的一点是：`confirmed` 不等于“这篇论文已经完全可用”，只表示它值得进入下一步处理。

## 推荐使用流程

### 从零开始做一轮检索

1. 进入 `Read Paper Workspace`
2. 新建一个 retrieval
3. 填写主题、问题描述或 query
4. 选择合适的 sources
5. 设置 year range 和 result limit
6. 运行 retrieval
7. 检查候选结果
8. 尽早把结果标为 `confirmed` 或 `excluded`
9. 将确认后的候选导入 literature library

### 围绕已有问题继续补文献

1. 打开已有 retrieval
2. 微调 query 或 sources
3. 再运行一轮
4. 继续筛选新增候选
5. 把高价值结果导入后续流程

## 推荐阅读路径

第一次接触这个工程时，建议先看：

1. [README.md](README.md)
2. [docs/dev/onboarding.md](docs/dev/onboarding.md)
3. [README - research pipeline workspace.md](<README - research pipeline workspace.md>)
4. 本文

如果你要继续追设计方案，再看：

- [docs/feature-notes/read-paper-workspace/0518.md](docs/feature-notes/read-paper-workspace/0518.md)
- [docs/feature-notes/read-paper-workspace/0519.md](docs/feature-notes/read-paper-workspace/0519.md)
- [docs/feature-notes/read-paper-workspace/readpaper-retrieval-plan.md](docs/feature-notes/read-paper-workspace/readpaper-retrieval-plan.md)
- [docs/feature-notes/read-paper-workspace/readpaper-redesign-proposal.md](docs/feature-notes/read-paper-workspace/readpaper-redesign-proposal.md)
- [docs/feature-notes/read-paper-workspace/tool-invocation-flows.md](docs/feature-notes/read-paper-workspace/tool-invocation-flows.md)

## 状态说明

本文是“当前产品职责说明”，不是历史设计记录。若某处和历史方案文档冲突，以代码和当前主入口文档为准。
