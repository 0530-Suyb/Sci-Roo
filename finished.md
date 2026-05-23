# Sci-Roo Workspace 重构与规划能力接入完成总结

## 本轮调整的总体方向

这一轮开发把 Sci-Roo 的论文工作流重新梳理成更清晰的两层：

- `Research Pipeline` 负责项目初始化、研究问题澄清、流程入口和跨阶段状态总览
- `Paper Writing Workspace` 负责 manuscript 写作执行、引用管理、revision 记录和局部写作辅助

同时，项目上下文被收敛为一个简单规则：

- Sci-Roo 只围绕当前 VS Code 打开的根目录工作

## 已完成的主要设计与开发调整

### 1. Project Workspace 逻辑简化

- 不再支持绑定外部目录
- 不再支持任意切换项目目录
- 不再区分“插件工作区目录”和“VS Code 根目录”
- 当前 VS Code 根目录就是唯一允许初始化和工作的 Sci-Roo 项目根目录

### 2. 项目创建入口迁移到 Research Pipeline

- 项目创建/初始化入口从 `Paper Writing Workspace` 移到 `Research Pipeline`
- `Project Workspace` 卡片永远显示
- 如果当前根目录未初始化，只显示这张卡片和创建表单
- 如果已初始化，才显示后续流程卡片

### 3. Research Pipeline 成为默认首页

- 插件初始进入面板由原来的 `New Task` 改为 `Research Pipeline`
- `Read Paper`、`Data Studio`、`Paper Writing` 左上角返回统一回到 `Research Pipeline`
- 原 `New Task` 面板重命名为 `Agent Chat`

### 4. Research Pipeline 首页改成流程卡片式工作台

当前 `Research Pipeline` 已整理为：

- `Project Workspace`
- `Agent Chat`
- `Read Paper`
- `Data Studio`
- `Paper Writing`

其中：

- `Project Workspace` 负责当前根目录是否已初始化
- 其他卡片负责显示对应阶段的简要状态并跳转到专门工作区

### 5. Agent Chat 卡片接入研究前期规划流程

- 新增独立 `Agent Chat` 卡片
- 卡片文案明确改为“先澄清研究问题，再整理文章规划”
- 点击卡片后自动进入 `Agent Chat`
- 默认切换到新 mode：`sci-problem-framing`
- 自动发送一条带项目上下文的启动消息

自动消息包含：

- 项目名
- 项目 description
- 当前模板 / venue
- 当前工作区路径
- 目标输出文件：
    - `problem/research-questions.md`
    - `task/paper-plan.md`

### 6. 新增专用 mode 与 skill

新增了一个专门面向前期研究规划的 mode：

- `sci-problem-framing`

它的目标是：

1. 从项目 description 出发
2. 先澄清研究背景和研究问题
3. 先形成 `problem/research-questions.md`
4. 再整理 `task/paper-plan.md`

同时新增配套能力资产：

- `.roo/skills/research-problem-framing/SKILL.md`
- `.roo/rules-sci-problem-framing/problem-framing-standards.md`

### 7. 项目 description 接入研究规划文件

项目创建时填写的 `description` 现在不仅会保存到项目元数据中，还会：

- 显示在 `Project Workspace` 卡片状态中
- 写入 `problem/research-questions.md` 开头的 `Project Background`
- 初始化 `task/paper-plan.md`，并明确提示应在研究问题明确后再继续规划

### 8. Paper Writing Workspace 职责收敛

`Paper Writing Workspace` 不再承担项目创建主入口，而是回到更明确的 manuscript-first 定位：

- 正文仍在 VS Code 编辑器中写
- `LaTeX Workshop` 负责编译和 PDF 预览
- `git` 负责版本管理
- Sci-Roo 提供：
    - 写作状态摘要
    - 引用检查
    - revision log 支持
    - 选中文本局部改写

### 9. 移除无效或重复链路

- 去掉了无实际用途的 `paperProjectOpen` 消息链
- 去掉了 `Research Pipeline` 中无效的 `Refresh` 按钮
- 收紧了旧的项目切换/绑定语义，避免和当前根目录逻辑冲突

### 10. 修复过程中处理的稳定性问题

这轮改造里顺手修了两类典型问题：

- `ExtensionStateContext` 因不同导入路径重复实例化导致的 provider 错误
- `Agent Chat` 自动起聊过程中，`ChatTextArea` 遇到 `undefined` 输入时的 `trim()` 崩溃

## 当前推荐使用路径

现在更推荐的完整路径是：

1. 打开一个 VS Code 根目录
2. 进入 `Research Pipeline`
3. 在 `Project Workspace` 中初始化当前根目录
4. 点击 `Agent Chat`
5. 用 `sci-problem-framing` 先梳理研究问题
6. 确认 `problem/research-questions.md`
7. 再逐步形成 `task/paper-plan.md`
8. 分别进入：
    - `Read Paper`
    - `Data Studio`
    - `Paper Writing`

## 当前状态总结

到这一阶段，Sci-Roo 的论文工作流已经从“多个分散入口”收敛为一条更清晰的主线：

- 首页从 `Research Pipeline` 开始
- 先初始化项目
- 再澄清研究问题
- 再形成文章规划
- 最后进入读文献、做实验和写论文的执行工作区

这使得产品结构比之前更符合真实研究流程，也减少了目录绑定、入口重复和阶段职责混乱的问题。
