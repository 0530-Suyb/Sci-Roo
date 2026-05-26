# Paper Writing Workspace

## 这是什么

`Paper Writing Workspace` 是 Sci-Roo 中面向论文写作执行阶段的工作区。

当前定位非常明确：

- 正文写作在 VS Code 编辑器中完成
- `LaTeX Workshop` 负责 build 与 PDF 预览
- `git` 负责版本管理
- Sci-Roo 负责写作辅助、引用检查、revision 支持和局部文本增强

它不是新的正文编辑器，也不打算替代 `LaTeX Workshop` 或 `git`。

## 当前设计原则

- manuscript-first，而不是 section-first
- editor-first，而不是在 webview 中承载长文本编辑
- 辅助增强优先，而不是功能堆叠
- 和 `LaTeX Workshop`、`git` 协同，而不是重复造轮子

## 使用前提

`Paper Writing Workspace` 默认依赖一个已经初始化好的 Sci-Roo 项目，通常意味着当前根目录下已经有：

- `.roo/project.json`

如果项目还没初始化，应该先回到 [Research Pipeline Workspace](<README - research pipeline workspace.md>)。

## 正文应该在哪里写

推荐路径是：

1. 在工作区点击 `Open main.tex` 或 `Continue writing`
2. 打开 `latex/main.tex`
3. 直接在 VS Code 编辑器中写作
4. 使用 `LaTeX Workshop` 进行 build 和 PDF 预览

## 工作区结构

### Header

提供最小但清晰的项目上下文与高频动作，例如：

- 项目名
- 当前 stage
- 关键状态 pill
- `Continue writing`
- `Build PDF`
- `View PDF`

### Writing Focus

这是首页主卡片，用来回答：

- 当前稿件处于什么状态
- 下一步更适合继续写、补引用，还是先 build

常见信息包括：

- 当前字数
- manuscript 状态
- 当前 heading
- 缺失 cites 数量
- citation placeholder 数量

### Selection Assistant

这是当前最重要的辅助层之一，只围绕“当前编辑器选中的文本”工作。

当前支持：

- `Rewrite`
- `Rephrase`
- `Concise`
- `Academic`
- `Expand`
- `Add cite placeholder`
- `To Chinese`
- `To English`

### Side Panel

当前主要保留 3 个 tab：

- `References`
- `Outline`
- `Checks`

它们分别负责：

- `References`
    - 引用风险处理，如 placeholders、missing cite keys、`.bib`
- `Outline`
    - manuscript 导航
- `Checks`
    - 当前写作风险与资产完整度检查

## citation placeholder 流程

当前已经支持从写作到引用修复的闭环：

1. 在正文里使用 `Add cite placeholder`
2. Sci-Roo 插入 `[CITATION NEEDED]`
3. 工作区统计 placeholder 数量
4. `References` 把它们作为待处理风险展示
5. 再通过 `Import BibTeX`、`Scan PDFs`、`Scan citations` 等动作继续处理

这里要区分两类问题：

- placeholder
    - 还没决定引用哪篇
- missing cite key
    - 已经写了 cite key，但当前库里没有对应条目

## 推荐使用流程

### 从零开始写论文

1. 在 `Research Pipeline` 初始化项目
2. 澄清研究问题并完成 `paper-plan`
3. 进入 `Paper Writing Workspace`
4. 打开 `latex/main.tex`
5. 在编辑器中写正文
6. 需要局部增强时使用 `Selection Assistant`
7. 用 `References` 处理引用问题
8. 用 `Checks` 处理风险项
9. 用 `LaTeX Workshop` build 并检查 PDF

### 做 revision

1. 打开项目
2. 回到主文稿继续修改
3. 用 `Selection Assistant` 做局部重写或学术化润色
4. 检查缺失引用和 placeholders
5. 重新 build PDF
6. 用 `git` 管理本轮改动

## 推荐阅读路径

第一次接触工程时，建议先看：

1. [README.md](README.md)
2. [docs/dev/onboarding.md](docs/dev/onboarding.md)
3. [README - research pipeline workspace.md](<README - research pipeline workspace.md>)
4. 本文

如果你想追溯这个大功能的推进记录，再看：

- [docs/feature-notes/paper-writing-workspace/problem.md](docs/feature-notes/paper-writing-workspace/problem.md)
- [docs/feature-notes/paper-writing-workspace/finished.md](docs/feature-notes/paper-writing-workspace/finished.md)

## 状态说明

本文是当前工作区职责说明。它优先回答“现在这个工作区怎么工作”，不是专门记录历史设计过程的文档。
