# Paper Writing Workspace 重构设计稿

## 1. 重构目标

本轮先不继续扩展写论文工作区的功能数量，而是优先把已有能力整理成一个真正清晰、轻量、易学、易用的写作工作台。

这次重构的核心目标有三条：

1. 用户进入页面后，能立刻理解当前稿件状态
2. 用户进入页面后，能立刻理解下一步该做什么
3. 页面围绕 manuscript 写作推进，而不是围绕功能堆叠

一句话定义：

`Paper Writing Workspace = 围绕当前 manuscript 推进写作与修订的驾驶舱`

## 2. 当前页面问题

### 2.1 信息重复

当前页面在多个区域重复展示：

- manuscript 状态
- recommended action
- git 状态
- 引用风险
- 构建状态

重复区域主要包括：

- 顶部 header
- `Today`
- `Writing focus`
- `Checkpoint`

结果是：

- 页面不够利落
- 视觉焦点被打散
- 用户不容易判断“哪个区域最重要”

### 2.2 主动作和次动作没有分层

当前首页同时出现很多动作：

- `Continue writing`
- `Open main.tex`
- `Build PDF`
- `View PDF`
- `Open references.bib`
- `Open Source Control`
- `Scan citations`
- `Generate bib`
- `Snapshot`

这些动作的频率、紧迫性、主线关系并不相同，但当前视觉权重过于接近。

### 2.3 主区职责过重

现在左侧主区同时承担了：

- 写作推进
- manuscript 总览
- 构建控制
- git checkpoint
- 引用维护入口
- research asset 状态提示

这使得页面不像“写作工作台”，更像“功能总览页”。

### 2.4 右侧辅助区边界不够清晰

`References / Outline / Checks` 其实已经是合理的辅助分区，但由于左侧也塞入很多相似信息，导致：

- 主区和右侧辅助区有职责重叠
- 右侧不够像“辅助”，左侧也不够像“主线”

## 3. 产品定位调整

重构后的 `Paper Writing Workspace` 应该只服务一个主要问题：

`今天这篇稿子我应该继续怎么写下去？`

它不应该试图在首页同时回答：

- 我有哪些写作功能
- 我有哪些研究资产
- 我的引用库整体状态如何
- 我的 revision 系统是否完整

这些都重要，但不都应该占据首页第一层。

## 4. 目标信息架构

重构后的首页采用三段式结构：

- `Writing Header`
- `Writing Focus Column`
- `Support Panel`

### 4.1 Writing Header

#### 作用

提供最小但完整的工作上下文，以及 3 个最高频动作。

#### 显示内容

- 项目名
- template / venue
- stage
- 一句简短状态摘要

#### 只保留 3 个主动作

- `Open main.tex`
- `Build PDF`
- `View PDF`

#### 低频动作统一进入 `More`

- `Open references.bib`
- `Open Source Control`
- `Create snapshot`
- `Refresh`

#### Header 不再承载的内容

- 大量状态 pill
- changed files 数量
- research asset 准备度
- citation placeholder 细节

这些内容全部下沉。

### 4.2 Writing Focus Column

左侧主区只保留 4 张卡片。

#### Card A: Current Draft

这是首页第一张卡，用于回答“稿子现在是什么状态”。

显示：

- 当前字数
- manuscript 状态
- 当前 heading
- 最近编辑时间
- missing cites 数量
- citation placeholders 数量

不放大堆按钮。

#### Card B: Next Step

这是首页行动中心，用于回答“现在该做什么”。

显示：

- `recommendedAction`
- 1 个主按钮
- 1 个次按钮

按钮必须动态生成，并且只保留两个。

规则示例：

- 如果 manuscript 没打开：

    - 主按钮：`Open main.tex`
    - 次按钮：`Open paper plan`

- 如果缺失引用明显：

    - 主按钮：`Scan citations`
    - 次按钮：`Open references`

- 如果稿件已完成一轮修改但还没构建：
    - 主按钮：`Build PDF`
    - 次按钮：`Create snapshot`

#### Card C: Selection Assistant

保留，但重新分组，降低工具箱噪声。

分组方式：

- `Improve`

    - Rewrite
    - Rephrase
    - Academic

- `Tighten`

    - Concise
    - Expand
    - Add cite placeholder

- `Translate`
    - To Chinese
    - To English

状态区只回答两件事：

- 当前是否有选区
- 当前是否在 main manuscript 里

无选区时，清晰提示：

`Select a passage in main.tex to enable writing actions.`

#### Card D: Draft Safety

这是当前 `Checkpoint` 区块的简化替代。

只显示：

- git clean / changed
- PDF ready / not built
- snapshot available / missing

只保留两个动作：

- `Open Source Control`
- `Create snapshot`

不再使用视觉重量较大的双 `WorkflowCard` 结构。

### 4.3 Support Panel

右侧继续保留 3 个 tab，但职责进一步明确。

#### References

角色：

`当前稿件的引用风险处理台`

首页优先展示：

- citation placeholders
- missing cite keys
- uncatalogued PDFs
- 当前稿件最相关条目

弱化：

- 过于“图书馆总览式”的信息

#### Outline

角色：

`manuscript 导航面板`

保留：

- 章节结构
- 当前 heading 高亮
- 点击跳转

只保留少量 quick files：

- `Open paper plan`
- `Open research questions`
- `Open revision log`

#### Checks

角色：

`当前写作风险与资产完整度面板`

分成三段：

- `Blocking`
- `Needs Review`
- `Assets Status`

比现在的：

- `Needs attention`
- `Keep an eye on`
- `Research assets`

更直接。

## 5. 首页不再承载的内容

以下内容可以保留能力，但不应该继续作为首页第一层重点：

- `WorkspaceOverview`
- `RevisionWorkbench`
- `SectionGuidePanel`
- `SectionReadinessPanel`
- 大量 research assets 总览
- 大量 bibliography 维护动作

处理方式：

- 短期：从首页移除或不渲染
- 中期：考虑下沉到二级区域、折叠面板或后续专题页

## 6. 组件处理策略

### 保留并继续使用

- `ReferencePanel`
    - 作为右侧 `References` 主体
- `PaperWritingView`
    - 作为首页容器，重构其结构

### 保留但重写布局方式

- `PaperWritingView`
    - 重新组织 Header / Main / Side

### 暂时从首页移除

- `WorkspaceOverview`
- `RevisionWorkbench`
- `SectionGuidePanel`
- `SectionReadinessPanel`

原因不是它们没价值，而是当前首页需要先收敛成“写作推进界面”。

### 后续可考虑重新接回的方式

- 放入折叠区
- 放入单独 `Revision` 二级页
- 放入 `Checks` 的深入视图

## 7. 交互规则

### 7.1 主按钮规则

首页永远只允许最多 3 个主按钮出现在 Header：

- `Open main.tex`
- `Build PDF`
- `View PDF`

如果某个动作当前不可用：

- 可以禁用
- 但位置不应频繁跳动

### 7.2 Next Step 规则

`Next Step` 必须是动态策略卡，而不是静态说明卡。

输出格式固定：

- 1 条当前建议
- 1 个主行动
- 1 个次行动

### 7.3 Selection Assistant 规则

如果不满足以下条件，就不应让用户误以为能直接使用：

- 当前在项目内
- 最好在主稿内
- 有选区

因此需要比现在更明确的状态反馈。

### 7.4 Support Panel 规则

右侧面板是辅助区，因此：

- 默认保留打开
- 但不能压过主区视觉重量
- tab 切换文案要更“任务化”，少一些抽象表达

## 8. `Next Step` 决策规则

为了避免 `Next Step` 重新退化成“静态说明卡”，这里明确它的生成优先级。

页面每次渲染时都应按下面顺序判断，并命中第一条即可：

### Rule 1: 没有 manuscript 文件

条件：

- `!manuscript?.exists`

输出：

- 文案：`The main manuscript is not ready yet. Open or regenerate the draft entry before continuing.`
- 主按钮：`Open main.tex`
- 次按钮：`Open Research Pipeline`

### Rule 2: 当前不在主稿上下文

条件：

- `manuscript?.exists`
- `!editorContext?.onPrimaryManuscript`

输出：

- 文案：`Return to the main manuscript so editing actions and outline context match the current draft.`
- 主按钮：`Open main.tex`
- 次按钮：`View PDF`

### Rule 3: 当前已有选区，适合局部改写

条件：

- `editorContext?.onPrimaryManuscript`
- `editorContext?.hasSelection`

输出：

- 文案：`A passage is selected in the manuscript. Refine it now, or keep drafting if the wording is already stable.`
- 主按钮：`Use Selection Assistant`
- 次按钮：`Open main.tex`

说明：

- `Use Selection Assistant` 不是跳页动作，而是将焦点滚动到该卡片，或给予该卡片高亮提示

### Rule 4: 缺失引用或占位引用较多

条件：

- `(missing?.length ?? 0) > 0`
  或
- `(manuscript?.citationPlaceholderCount ?? 0) > 0`

输出：

- 文案：`The draft still has citation gaps. Resolve them before the next polish or submission pass.`
- 主按钮：`Scan citations`
- 次按钮：`Open references`

### Rule 5: PDF 未构建或已过时

条件：

- `manuscript?.exists`
- `!manuscript?.hasPdf`

输出：

- 文案：`Build the manuscript to inspect layout, references, and section flow in PDF form.`
- 主按钮：`Build PDF`
- 次按钮：`View PDF`

说明：

- 如果没有 PDF，则 `View PDF` 可以置灰但位置保留

### Rule 6: revision log 缺失，且项目处于 revising/final/submitted

条件：

- `["revising", "final", "submitted"].includes(project.stage)`
- `!assets?.revisionLog?.exists`

输出：

- 文案：`This project is in a revision-oriented stage, but the revision log is missing. Create it before large changes.`
- 主按钮：`Create revision log`
- 次按钮：`Create snapshot`

### Rule 7: git 工作区有改动但没有 snapshot

条件：

- `gitStatus?.available`
- `gitStatus?.hasChanges`
- `!assets?.revisionLog?.exists || true`

说明：

- 这里不强依赖 revision log 存在与否，重点是提醒结构性修改前保留 checkpoint

输出：

- 文案：`You have active draft changes. Save a snapshot before the next structural pass.`
- 主按钮：`Create snapshot`
- 次按钮：`Open Source Control`

### Rule 8: 默认稳定态

条件：

- 上述条件均未命中

输出：

- 文案：使用后端给出的 `recommendedAction`
- 主按钮：`Open main.tex`
- 次按钮：`Build PDF`

## 9. 状态字段映射表

为了保证开发时不再凭感觉组织页面，下面明确新首页各区域依赖哪些现有字段。

### Header

- 项目名：`project.name`
- template：`project.templateId`
- stage：`project.stage`

### Current Draft

- 字数：`manuscript.wordCount`
- manuscript 状态：`manuscript.status`
- 当前 heading：`manuscript.currentHeading`
- 最近编辑时间：`manuscript.lastEdited`
- missing cites：`missing.length`
- placeholders：`manuscript.citationPlaceholderCount`

### Next Step

- manuscript：`workspaceState.manuscript`
- editor context：`workspaceState.editorContext`
- assets：`workspaceState.assets`
- git：`workspaceState.git`
- recommended text fallback：`workspaceState.recommendedAction`

### Selection Assistant

- 是否在主稿中：`editorContext.onPrimaryManuscript`
- 是否在项目中：`editorContext.inProject`
- 是否有选区：`editorContext.hasSelection`
- 选区字数：`editorContext.selectionWordCount`
- 当前文件：`editorContext.filePath`

### Draft Safety

- git 状态：`gitStatus.available / gitStatus.hasChanges / gitStatus.changedFiles / gitStatus.branch`
- PDF 状态：`manuscript.hasPdf`
- snapshot 状态：
  当前后端还没有直接暴露“最近 snapshot 是否存在”的首页轻量字段
  现阶段可先用 `paperSnapshotState?.snapshots?.length`

### References

- entries：`paperReferenceState.entries`
- uncatalogued：`paperReferenceState.uncatalogued`
- cited：`paperReferenceState.cited`
- missing：`paperReferenceState.missing`
- `.bib` 是否已生成：`paperReferenceState.bibGenerated`
- `.bib` 预览：`paperReferenceState.bibPreview`

### Outline

- 章节结构：`manuscript.outline`
- 当前 heading：`manuscript.currentHeading`
- 主稿路径：`project.primaryManuscriptPath`

### Checks

- checks 列表：`workspaceState.checks`
- paper plan：`assets.paperPlanReady`
- research questions：`assets.researchQuestionsReady`
- revision log：`assets.revisionLog`

## 10. 组件映射与实施策略

### 10.1 继续使用现有组件

- `ReferencePanel`
    - 用作右侧 `References`

### 10.2 由 `PaperWritingView` 内联实现的新首页卡片

建议直接在 `PaperWritingView` 内部先实现这些轻量卡片，而不是再额外抽很多新组件：

- `Current Draft`
- `Next Step`
- `Draft Safety`

原因：

- 这些卡片强依赖同一批 workspaceState
- 先在一个文件内重构更容易快速稳定信息架构
- 等结构稳定后再考虑是否抽组件

### 10.3 保留但不在首页挂载

- `WorkspaceOverview`
- `RevisionWorkbench`
- `SectionGuidePanel`
- `SectionReadinessPanel`

短期策略：

- 不删除
- 不接到首页主区
- 留待后续作为二级增强入口

## 11. 低保真线框

```text
+--------------------------------------------------------------+
| < Back | Paper Writing | template | stage | main.tex | PDF...|
+--------------------------------------------------------------+
| Current Draft                                | References    |
| - words                                      | tab content    |
| - status                                     |               |
| - heading                                    |---------------|
| - last edited                                | Outline       |
| - missing cites / placeholders               | tab content    |
|                                              |---------------|
| Next Step                                    | Checks        |
| - recommended action                         | tab content    |
| [Primary Action] [Secondary Action]          |               |
|                                              |               |
| Selection Assistant                          |               |
| - Improve / Tighten / Translate              |               |
| - editor context                             |               |
|                                              |               |
| Draft Safety                                 |               |
| - git / PDF / snapshot                       |               |
| [Open Source Control] [Create Snapshot]      |               |
+--------------------------------------------------------------+
```

## 12. 页面线框摘要

### Header

- 项目名
- template
- stage
- `Open main.tex`
- `Build PDF`
- `View PDF`
- `More`

### Main Column

- `Current Draft`
- `Next Step`
- `Selection Assistant`
- `Draft Safety`

### Side Column

- `References`
- `Outline`
- `Checks`

## 13. 开发实施顺序

### Phase 1: 页面骨架重构

重写 `PaperWritingView` 的整体层级：

- Header
- Main Column
- Side Panel

### Phase 2: 主动作压缩

将低频动作迁入 `More`：

- Refresh
- Snapshot
- Open references.bib
- Open Source Control

### Phase 3: 写作主区整理

实现：

- `Current Draft`
- `Next Step`
- `Selection Assistant`
- `Draft Safety`

### Phase 4: 右侧辅助区整理

调整：

- `References`
- `Outline`
- `Checks`

的内容顺序和命名。

### Phase 5: 旧组件清理

确认哪些旧组件：

- 不再首页使用
- 仍需保留但等待后续挂接

## 14. 实现约束

为了保证这次重构不再次滑回“功能大全页”，实现时必须遵守下面这些约束。

### 14.1 首页不新增新 tab

这次重构只允许重组现有首页结构，不新增新的一级 tab。

原因：

- 当前目标是收敛
- 不是继续扩张导航复杂度

### 14.2 首页不再引入 section 级重型编辑体验

首页不应重新引入：

- section editor 主场景
- section guide 常驻大面板
- section readiness 常驻大面板

这些内容即使保留能力，也只能作为后续二级增强入口存在。

### 14.3 首页只允许一个主推荐动作区

所有“接下来做什么”的建议只能集中在 `Next Step` 卡片里。

不允许：

- Header 再给一套推荐
- `Current Draft` 再给一套推荐
- `Checks` 再复制首页推荐逻辑

### 14.4 主区卡片数量上限

首页主区最多 4 张卡：

- `Current Draft`
- `Next Step`
- `Selection Assistant`
- `Draft Safety`

如果后续想加入更多内容，只能：

- 替换现有卡片
- 或下沉到右侧辅助区

### 14.5 按钮优先级必须稳定

高频动作必须始终稳定在同一位置：

- Header 主动作区

低频动作必须始终稳定在同一位置：

- `More` 菜单

不要因为状态变化频繁移动按钮位置，否则会削弱可预期性。

## 15. 关键用户场景

后续开发时，必须确保这几个核心场景都顺畅。

### 场景 A：刚进入写作阶段

用户状态：

- 项目已初始化
- manuscript 已存在
- 还没有打开主稿

页面应让用户第一眼知道：

- 当前稿件已经可写
- 应该先打开 `main.tex`

理想路径：

1. 进入页面
2. 看到 `Next Step`
3. 点击 `Open main.tex`

### 场景 B：正在写局部段落

用户状态：

- 已在 main manuscript 中
- 已选中一段文字

页面应让用户第一眼知道：

- 当前适合做局部改写
- 选区动作已经可用

理想路径：

1. 进入页面
2. 看到 `Selection Assistant` 已可用
3. 直接点 `Rewrite` / `Academic` 等

### 场景 C：写完一轮，需要检查成稿

用户状态：

- manuscript 已有修改
- 还没有 PDF 或 PDF 过旧

页面应让用户第一眼知道：

- 现在应该先 build 一次 PDF

理想路径：

1. 进入页面
2. `Next Step` 提示 `Build PDF`
3. 用户直接构建并预览

### 场景 D：引用风险较高

用户状态：

- missing cites > 0
- placeholders > 0

页面应让用户第一眼知道：

- 当前写作推进的主要风险不是 prose，而是 citation support

理想路径：

1. 进入页面
2. `Current Draft` 看到 citation 风险
3. `Next Step` 建议 `Scan citations`
4. 右侧 `References` 面板可以继续处理

### 场景 E：返修阶段

用户状态：

- stage = revising / final
- revision log 缺失或 snapshot 不足

页面应让用户第一眼知道：

- 现在最重要的是留痕和 revision 准备

理想路径：

1. 进入页面
2. `Next Step` 建议创建 revision log 或 snapshot
3. `Draft Safety` 明确显示当前留痕是否充分

## 16. 非目标

这次重构明确不做下面这些事：

### 16.1 不做全新 section 写作体系

不回到 section-first 工作流。

### 16.2 不做超重 revision 子系统首页化

`RevisionWorkbench` 这类内容可以保留，但不是这次首页重构重点。

### 16.3 不做新的引用管理架构

`ReferencePanel` 只做首页适配与信息排序调整，不在这轮重写 reference 体系。

### 16.4 不做新的 manuscript 编辑器

正文依然在 VS Code 编辑器中写，不在 webview 内重新实现长文本编辑器。

## 17. 开发前检查清单

真正动手改 UI 之前，建议确认下面几件事：

1. `PaperWritingView` 是否仍然承担过多业务逻辑
2. `workspaceState` 是否已经足够支撑 `Next Step` 决策
3. `paperSnapshotState` 是否足够轻量地支持 `Draft Safety`
4. `ReferencePanel` 嵌入态是否已经足够承担右侧辅助区角色
5. 旧组件暂时移除首页后，是否会影响其他入口或行为

## 18. 设计收敛结论

到这个阶段，这份设计已经明确了：

- 页面目标
- 信息架构
- 卡片职责
- 按钮分层
- 组件保留/下沉策略
- `Next Step` 决策规则
- 状态字段映射
- 关键用户场景
- 非目标范围

因此后续开发应直接进入实现阶段，而不再在首页结构层面反复摇摆。

## 19. 验收标准

重构完成后，应满足以下标准：

1. 用户进入页面后 5 秒内能理解稿件当前状态
2. 用户进入页面后 5 秒内能理解下一步该做什么
3. 首页最高频动作不超过 3 个主按钮
4. 低频维护动作不会和高频写作动作同权竞争
5. 右侧面板清楚承担辅助角色
6. 页面主线围绕 manuscript 推进，而不是功能堆叠
7. 首页不再重复展示 manuscript 状态、推荐动作、构建信息

## 20. 当前结论

这次 `Paper Writing Workspace` 优化的重点不是继续加模块，而是把已有能力重新排布成一条稳定主线：

`看清当前稿件 -> 明确下一步 -> 继续写作 -> 需要时再调辅助面板`

后续真正开发时，所有实现都应服务这条主线，而不是重新把首页做回“功能大全页”。
