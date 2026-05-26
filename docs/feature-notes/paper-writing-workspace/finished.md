# Paper Writing Workspace 完成项记录

这份文档用于记录我在推进 `Paper Writing Workspace` 这个大功能时，已经完成了哪些具体任务和阶段性收口。

它不是产品总说明，而是当前阶段的完成项台账。

## 当前这轮已经完成的事情

### 1. 明确了工作区的主定位

已经完成：

- 把 `Paper Writing Workspace` 的定位收口为论文写作执行阶段的工作区
- 明确正文应回到 VS Code 编辑器中完成
- 明确 `LaTeX Workshop` 负责 build 和 PDF 预览
- 明确 `git` 负责版本管理
- 明确 Sci-Roo 自己负责写作辅助、引用检查、revision 支持和局部文本增强

### 2. 完成 manuscript-first / editor-first 转向

已经完成：

- 不再把 webview 当作正文主编辑器
- 主文稿默认围绕 `latex/main.tex`
- 工作区逻辑更贴近真实论文写作方式

### 3. 首页结构已经明显收口

已经完成：

- 首页不再走“功能堆叠 dashboard”路线
- 当前主结构已经比较明确：
    - Header
    - `Writing Focus`
    - `Selection Assistant`
    - `Checkpoint`
    - Side Panel

### 4. Selection Assistant 已形成主工作流

已经完成：

- 支持围绕编辑器选区做局部增强
- 支持面板按钮与右键菜单两条一致路径
- 当前已接入动作包括：
    - `Rewrite`
    - `Rephrase`
    - `Concise`
    - `Academic`
    - `Expand`
    - `Add cite placeholder`
    - `To Chinese`
    - `To English`

### 5. 引用处理闭环已经打通一轮

已经完成：

- `References` 面板可以围绕主文稿工作
- 已支持：
    - `Scan citations`
    - `Generate .bib`
    - `Scan PDFs`
    - `Import BibTeX`
- 已开始区分：
    - citation placeholders
    - missing cite keys
    - uncatalogued PDFs

### 6. citation placeholder 已接入状态流

已经完成：

- `Add cite placeholder` 会插入 `[CITATION NEEDED]`
- 工作区会统计 placeholder 数量
- 首页、`Checks`、`References` 会把它当作引用风险展示

## 这份文档怎么用

如果我要回顾这轮大功能已经做完了什么，就看这份文档。

它主要回答：

- 这一轮已经收了哪些口
- 已经落地了哪些功能点
- 当前产品结构相比之前有哪些明确变化

如果我要继续推进下一轮，想看遗留问题和待办方向，就看 [problem.md](problem.md)。
