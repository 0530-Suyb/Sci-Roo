# Research Pipeline Workspace 使用手册

## 这是什么

`Research Pipeline` 是 Sci-Roo 现在的首页工作台，用来统一管理：

- 当前 VS Code 根目录是否已经初始化为 Sci-Roo 项目
- 研究前期的问题澄清与文章规划起步
- 读论文、做实验、写论文三个执行工作区的入口与状态

它不是一个新的聊天页，也不是简单的导航页，而是整个研究流程的总控面板。

## 当前设计原则

这一版 `Research Pipeline` 采用了一个非常收敛的规则：

- Sci-Roo 只允许在当前 VS Code 打开的根目录里工作

这意味着：

- 不支持绑定工作区外目录
- 不支持切换任意项目目录
- 不再区分“VS Code 工作区目录”和“插件自己的项目目录”

当前根目录就是唯一项目根目录。

## 默认进入页

现在插件默认首先进入 `Research Pipeline`，而不是原来的 `New Task`。

同时：

- `Read Paper`
- `Data Studio`
- `Paper Writing`

这些面板点击左上角返回时，也都会回到 `Research Pipeline`。

## 页面结构

### 1. Project Workspace

这张卡片永远显示，用来判断当前根目录是否已经初始化。

状态只有两种：

- `Not Created`
- `Created`

如果未创建：

- 展开卡片后可以直接在当前根目录创建项目
- 这时其他流程卡片不会显示

如果已创建：

- 卡片会显示项目名称、模板、description 摘要
- 其他流程卡片才会出现

### 2. Agent Chat

只有在 `Project Workspace` 已创建后才显示。

它的职责是：

- 从项目 description 出发
- 先澄清研究问题
- 再整理初始文章规划

点击后会：

1. 进入 `Agent Chat`
2. 默认切到 `sci-problem-framing` mode
3. 自动发送一条带完整项目上下文的启动消息

这条消息会明确要求：

- 先写 `problem/research-questions.md`
- 再整理 `task/paper-plan.md`

### 3. Read Paper

显示文献检索与筛选阶段的简要状态，例如：

- 当前 retrieval plan 数量
- 最近一次检索标题
- 当前 run status
- 已保存论文数

点击后进入 `Read Paper` 工作区。

### 4. Data Studio

显示实验与分析阶段的简要状态，例如：

- 是否正在运行
- 最近一次运行时间
- 已保存 run 数量
- 输出文件数

点击后进入 `Data Studio` 工作区。

### 5. Paper Writing

显示 manuscript 阶段的简要状态，例如：

- manuscript 是否存在
- 当前字数
- PDF 是否已生成
- 当前模板

点击后进入 `Paper Writing` 工作区。

## 项目创建时会发生什么

当你在 `Project Workspace` 中创建项目时，Sci-Roo 会：

- 在当前 VS Code 根目录创建 Sci-Roo 项目结构
- 写入 `.roo/project.json`
- 初始化 `latex/main.tex`
- 初始化 `problem/research-questions.md`
- 初始化 `task/paper-plan.md`

其中：

- 项目 `description` 会写入 `problem/research-questions.md` 开头
- `task/paper-plan.md` 会带一个“研究问题明确后再继续规划”的初始提示

## Agent Chat 的推荐用法

推荐把 `Agent Chat` 理解为研究前期规划助手，而不是普通自由聊天窗口。

点击卡片后，系统会自动给 agent 提供：

- 项目名
- 项目 description
- 当前模板 / venue
- 当前根目录路径
- 目标输出文件路径

然后由 `sci-problem-framing` mode 采用偏苏格拉底式提问的方式，帮助你逐步完成：

1. 研究背景澄清
2. 研究问题提炼
3. 边界与假设梳理
4. 初始文章规划

## 当前推荐工作流

1. 打开一个新的 VS Code 根目录
2. 进入 `Research Pipeline`
3. 在 `Project Workspace` 中初始化项目
4. 点击 `Agent Chat`
5. 先明确 `problem/research-questions.md`
6. 再整理 `task/paper-plan.md`
7. 然后按需要进入：
    - `Read Paper`
    - `Data Studio`
    - `Paper Writing`

## 与其他工作区的分工

- `Research Pipeline`：项目初始化、研究问题澄清、流程状态总览
- `Agent Chat`：前期问题讨论与规划起步
- `Read Paper`：读文献与筛选
- `Data Studio`：实验、脚本与分析输出
- `Paper Writing`：manuscript 写作执行

## 这轮重构带来的变化

和之前相比，`Research Pipeline` 现在不再只是一个轻量记录页，而是：

- 默认首页
- 当前项目初始化入口
- 研究前期规划入口
- 后续工作区的统一导航与状态面板

这让整个 Sci-Roo 的工作流从一开始就围绕“先项目、后问题、再规划、最后执行”的顺序组织起来。
