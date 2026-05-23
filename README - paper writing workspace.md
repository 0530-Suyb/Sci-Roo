# Paper Writing Workspace 使用手册

## 这是什么

`Paper Writing Workspace` 是 Sci-Roo 的论文写作工作区，负责围绕当前项目的 manuscript、references、revision 和写作辅助动作组织工作流。

它不是正文编辑器，也不替代 `LaTeX Workshop` 或 `git`。推荐分工是：

- VS Code 编辑器：直接写 `latex/main.tex` 等正文文件
- `LaTeX Workshop`：编译和 PDF 预览
- `git`：版本管理
- Sci-Roo `Paper Writing Workspace`：写作状态、引用检查、revision 记录和局部 AI 辅助

## 最新设计调整

这一轮设计开发后，`Paper Writing Workspace` 的定位做了几项收敛：

- 不再作为项目创建和切换的主入口
- 项目初始化统一前移到 `Research Pipeline` 的 `Project Workspace` 卡片
- 如果当前 VS Code 根目录还没有初始化项目，`Paper Writing Workspace` 会提示先回到 `Research Pipeline`
- 工作区只围绕当前 VS Code 打开的根目录工作，不再支持绑定外部目录或切换任意目录
- 研究前期的“问题澄清与文章规划起步”职责，转移给 `Research Pipeline` 中的 `Agent Chat` 卡片和 `sci-problem-framing` mode

## 当前工作前提

`Paper Writing Workspace` 现在默认依赖一个已经初始化好的 Sci-Roo 项目根目录。

判断条件：

- 当前 VS Code 根目录下存在 `.roo/project.json`

如果未初始化：

- `Paper Writing Workspace` 会提示你先去 `Research Pipeline`
- `Read Paper`、`Data Studio`、`Paper Writing` 三个流程工作区都不会被视为就绪

## 项目目录结构

初始化项目后，Sci-Roo 会准备如下目录：

- `task/`
    - `paper-plan.md`
- `problem/`
    - `research-questions.md`
- `review/`
    - `revision-log.md`
- `reference/`
- `script/`
- `img/`
- `experiment/`
- `latex/`
- `template/`
- `.roo/`

其中最重要的是：

- 正文入口：`latex/main.tex`
- 参考文献：`latex/references.bib`
- 研究问题文件：`problem/research-questions.md`
- 文章规划文件：`task/paper-plan.md`

## 与 Research Pipeline 的关系

新的推荐路径是：

1. 先在 `Research Pipeline > Project Workspace` 中初始化当前根目录
2. 在 `Research Pipeline > Agent Chat` 中先澄清研究问题
3. 由 `sci-problem-framing` mode 先整理 `problem/research-questions.md`
4. 再逐步形成 `task/paper-plan.md`
5. 然后进入 `Paper Writing Workspace` 开始围绕 manuscript 写作

也就是说：

- `Paper Writing Workspace` 负责“写作执行”
- `Research Pipeline` 负责“项目初始化与前期规划”

## 你应该在哪里写正文

正文仍然应该直接写在 VS Code 编辑器里，而不是写在 Sci-Roo 面板中。

推荐方式：

1. 在工作区里点击 `Open manuscript`
2. 打开 `latex/main.tex`
3. 直接在编辑器中写作
4. 使用 `LaTeX Workshop` 构建和预览 PDF

## 工作区中的主要区域

### 1. Writing focus

这里会集中展示当前写作状态，例如：

- manuscript 是否存在
- 当前字数
- PDF 是否已生成
- 当前模板
- 是否缺失引用

同时提供常用动作，例如：

- `Continue writing`
- `Build`
- `View PDF`
- `Open references.bib`
- `Open Source Control`

### 2. Selection assistant

围绕编辑器当前选中的文本工作，可用于局部润色和重写。

当前支持：

- `Rewrite`
- `Rephrase`
- `Concise`
- `Academic`
- `To Chinese`
- `To English`

没有选区时，这些动作会禁用。

### 3. 右侧辅助区域

通常包括：

- `References`
- `Outline`
- `Checks`

它们分别用于：

- 引用管理
- manuscript 结构导航
- 关键风险与待办检查

## References

`References` tab 负责围绕正文引用做辅助。

常见动作：

- `Scan citations`
- `Generate .bib`
- `Scan PDFs`
- `Import BibTeX`

它帮助你确认：

- 当前正文用了哪些 cite keys
- 哪些 key 缺失
- `reference/` 中有哪些 PDF 还未整理
- `latex/references.bib` 是否需要更新

## Outline

`Outline` tab 会从 `main.tex` 解析：

- `\section{}`
- `\subsection{}`
- `\subsubsection{}`

你可以：

- 查看当前论文结构
- 看当前光标所在 heading
- 点击 heading 跳转到对应位置

## Checks

`Checks` tab 会集中提示当前写作工作区的关键风险，例如：

- manuscript 过短
- 引用缺失
- PDF 尚未构建
- `review/revision-log.md` 缺失
- `task/paper-plan.md` 或 `problem/research-questions.md` 不完整

## 推荐工作流

### 从零开始写一篇论文

1. 在 `Research Pipeline` 中初始化当前 VS Code 根目录
2. 使用 `Agent Chat` 先梳理研究问题
3. 确认 `problem/research-questions.md`
4. 再整理 `task/paper-plan.md`
5. 打开 `latex/main.tex` 正式写作
6. 用 `References` 检查引用，用 `Checks` 做风险检查

### 修改或返修论文

1. 进入已初始化项目
2. 在 `review/revision-log.md` 记录 reviewer comments 和处理状态
3. 在编辑器中直接修改 `main.tex`
4. 必要时使用 `Selection assistant` 对局部段落做重写或学术化润色
5. 重新扫描引用并构建 PDF

## 设计原则

当前版本的 `Paper Writing Workspace` 遵循这些原则：

- manuscript-first，而不是 section 文件优先
- editor-first，而不是面板内长文本编辑优先
- 与 `LaTeX Workshop`、`git` 协同，而不是重复造轮子
- 与 `Research Pipeline` 分工明确：前者负责规划，后者负责写作执行
