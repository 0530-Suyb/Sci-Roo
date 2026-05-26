# Paper Writing Workspace 问题清单

这份文档用于记录我在推进 `Paper Writing Workspace` 这个大功能时，当前仍然存在的问题、待补的细节和后续改进方向。

它不是产品总说明，也不是唯一事实来源。它更像当前阶段的遗留问题清单。

## 当前定位

这一轮工作的目标不是继续堆功能，而是优先把 `Paper Writing Workspace` 打磨成一个真正清晰、轻量、易学、易用的科研写作工作区。

一句话概括当前想要达成的状态：

`Paper Writing Workspace = 围绕当前 manuscript 推进写作与 revision 的辅助工作台`

## 仍然存在的问题

### 1. 信息密度仍然偏高

虽然页面已经比早期版本简洁很多，但还是容易出现多个区域同时解释状态的问题，比如：

- Header
- `Writing Focus`
- `Checkpoint`
- `Checks`

这会导致：

- 视觉层级不够明确
- 用户不容易立刻判断当前焦点
- 页面仍然略像 dashboard，而不是 writing cockpit

### 2. 动作优先级还可以继续收口

当前工作区里存在多种动作，但它们的重要性和紧迫度并不一致，例如：

- `Continue writing`
- `Build PDF`
- `View PDF`
- `Open references.bib`
- `Scan citations`
- `Generate bib`

后续还需要继续区分：

- 首屏最该突出的核心动作
- 次级动作
- 应该继续下沉的工具型动作

### 3. Selection Assistant 仍可继续贴近科研写作场景

当前已经有一组比较稳定的局部增强动作，但还有提升空间：

- 分组还可以更清晰
- 动作命名还可以更贴近论文写作习惯
- 可以继续补一些更明确面向 rebuttal / response 的动作
- 可以考虑补从 bullet 到学术段落的转换能力

### 4. References 的问题分类还需要继续讲清楚

当前已经开始区分几类引用问题，但解释和操作路径还可以更明确。

特别是下面两类，需要持续分开：

- placeholder
    - 还没决定引用哪篇
- missing cite key
    - 已经写了 cite key，但当前库里没有对应条目

### 5. 仍需持续清理旧思路残留

主流程已经明显转向 manuscript-first / editor-first，但从工程视角看，仍然可能残留一些旧时代兼容思路，例如：

- 围绕 section 的旧逻辑
- 偏 dashboard 的首页思路
- 试图把 Sci-Roo 做成正文编辑器的残留倾向

这些都需要继续识别和清理。

## 当前建议继续推进的方向

### 优先级 A

- 继续压缩首页信息密度
- 继续明确主动作 / 次动作分层
- 继续优化 `References` 的解释性文案

### 优先级 B

- 继续丰富更贴近论文场景的选区动作
- 让 placeholder 到引用补全的路径更自然

### 优先级 C

- 继续清理旧 section-era 兼容逻辑
- 让整体主流程更彻底地保持 manuscript-first

## 使用方式

如果我要继续推进这个大功能，这份文档主要用来回答：

- 还有哪些问题没收掉
- 哪些地方还不够清晰
- 下一轮更适合优先补什么

如果我要看这轮功能已经完成了什么，就看 [finished.md](finished.md)。
