# Sci-Roo Paper Writing 全面改造计划（终版）

## Context

Sci-Roo 是一个基于 Roo Code 改造的 VS Code 扩展，目标是一站式 AI 科研平台。当前 Paper Writing 功能是一个简易的 IMRaD 编辑器，缺少会议模板、AI 写作指导、引用验证等核心能力。

本次改造参考 [AI-Research-SKILLs](https://github.com/Orchestra-Research/AI-Research-SKILLs) 仓库中 `20-ml-paper-writing/` 类别的写作哲学和 LaTeX 模板资源，将其知识嵌入 Sci-Roo 自身的 mode + rule + skill 系统。

核心认知转变：**Sci-Roo 不是藏在 `.roo/` 下偷偷存数据，而是帮助用户维护一个规范的、可见的科研工程目录。**

---

## 改造策略

**推倒重来**：废弃现有 PaperWritingView + PaperWritingManager + paperWritingMessageHandler。

**集成方式**：所有 AI-Research-SKILLs 知识直接嵌入 Sci-Roo 自身系统——

| 来源                        | →   | 目标                                                                                                                        |
| --------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------- |
| 写作哲学 + 章节写作指南     | →   | `sci-paper-writing` mode 的 `customInstructions`                                                                            |
| 写作工作流 + 引用验证规则   | →   | `src/services/paper/skills/ml-paper-writing/SKILL.md`（扩展内置资源，创建工程时复制到科研工程的 `.roo/skills/`）            |
| 系统会议写作指南            | →   | `src/services/paper/skills/systems-paper-writing/SKILL.md`                                                                  |
| 详细写作指南                | →   | `src/services/paper/rules/writing-standards.md`（扩展内置资源，创建工程时复制到科研工程的 `.roo/rules-sci-paper-writing/`） |
| LaTeX 模板 (.sty/.cls/.bst) | →   | 扩展内置，创建工程时复制到 `template/`                                                                                      |
| 学术图表生成                | →   | `src/services/paper/skills/academic-plotting/SKILL.md`（扩展内置资源，创建工程时复制到科研工程的 `.roo/skills/`）           |

---

## 优先实现

1. **会议模板系统** — 内置 NeurIPS/ICML/ICLR/ACL/AAAI/COLM 等顶会模板，创建项目时选定并复制到 `template/`
2. **AI 写作增强** — 将写作哲学嵌入 AI prompt，章节级 AI 生成带文献库上下文
3. **科研工程管理** — 标准化目录骨架，创建/切换/管理科研项目
4. **引用管理** — 扫描 `\cite{}` → 匹配 reference/ → 生成 `.bib`
5. **字数统计** — 每章节实时字数 + 会议限制检查
6. **论文快照** — 关键节点的版本保存
7. **批量导入** — `.bib` 文件解析 → 批量入库；识别 reference/ 下未入库 PDF

---

## 科研工程目录（核心设计）

```
my-research-project/              ← 用户在 VS Code 中打开的科研工程
├── task/                         ← 论文方向、框架结构、内容细节
│   └── paper-plan.md
├── problem/                      ← 研究问题（基于文献调研总结或直接提出）
│   └── research-questions.md
├── review/                       ← 修改意见（绘图制表、框架、润色、实验不足等）
│   ├── reviewer1-feedback.md
│   └── revision-log.md
├── reference/                    ← 文献库（.md 元数据 + .pdf 全文混合存放）
│   ├── vaswani2017attention.md   ← 结构化元数据（标题、作者、DOI、摘要等）
│   ├── vaswani2017attention.pdf  ← 下载的全文 PDF
│   ├── brown2020language.md      ← 入库但不一定被论文引用
│   └── brown2020language.pdf
├── script/                       ← 实验测试、数据绘图等脚本
│   ├── run_experiment.py
│   └── plot_results.R
├── img/                          ← 论文插图、实验图片
│   ├── fig1-architecture.png
│   └── fig2-results.pdf
├── experiment/                   ← 实验配置描述、结果、数据表格
│   ├── exp1-config.yaml
│   ├── exp1-results.csv
│   └── exp1-notes.md
├── latex/                        ← LaTeX 工程文件
│   ├── main.tex                  ← 从 template/ 复制并填充内容
│   ├── sections/
│   │   ├── abstract.tex
│   │   ├── introduction.tex
│   │   ├── methods.tex
│   │   ├── results.tex
│   │   ├── discussion.tex
│   │   ├── conclusion.tex
│   │   └── appendix.tex
│   ├── references.bib            ← 按论文中实际 \cite 的文献生成（非全量导出）
│   └── paper.pdf                 ← 编译产出
├── template/                     ← 当前使用的模板（创建工程时选定）
│   ├── main.tex                  ← 会议原始模板（不修改，作为参考）
│   ├── *.sty / *.cls / *.bst
│   └── README.md                 ← 模板说明（页面限制、格式要求等）
└── .roo/
    └── project.json              ← 插件运行时状态（阶段、引用状态、元数据）
```

### 关键设计规则

1. **模板时机**：创建科研工程时选定模板 → 模板文件复制到 `template/`。Sci-Roo 内置多种模板，也支持用户将自己的模板放入 `template/` 使用。

2. **文献入库**：Literature 面板搜到文献 → 用户点"入库" → 在 `reference/` 下生成 `{citekey}.md`（元数据）+ 可选下载 `{citekey}.pdf`。

3. **BibTeX 生成**：写论文时才生成。扫描 `latex/sections/` 下所有 `.tex` 文件 → 提取 `\cite{...}` → 去 `reference/` 匹配对应 `.md` → 生成 `latex/references.bib`。**只有被实际引用的文献才出现在 `.bib` 中。**

4. **用户自定义**：Sci-Roo 提供默认目录模板（ML 论文、系统论文等），用户也可自定义目录结构。

5. **工程创建位置**：若工作区已有文件 → 提示用户"该目录非空" → 创建在子目录 `./research-project/` 下。若为空目录 → 直接创建在根目录。

6. **单工程限制**：一个 VS Code 工作区只有一个科研工程。打开工作区时自动检测并加载 `.roo/project.json`。

7. **citeKey 生成规则**：入库时自动生成 `{firstAuthor}{year}{firstTitleWord}`（如 `vaswani2017attention`），冲突时追加数字后缀。用户可在入库时修改。

8. **未入库 PDF 识别**：用户将 PDF 直接复制到 `reference/` 时，插件扫描发现无对应 `.md` 的 PDF → 标记为"待入库"状态 → 提示用户补充元数据或移除。

9. **引用缺失处理**：扫描 `\cite{...}` 时，若 citeKey 在 `reference/` 中找不到 → 静默忽略（不报错不警告，就当用户还没入库）。

10. **模板切换**：切换会议模板是危险操作。切换时弹出警告："模板切换可能导致章节文件增删，建议先创建快照"。显示新增/删除/保留的章节清单 → 用户确认后执行迁移。

11. **review/ 目录**：纯文件目录，插件不管理其内部结构，只负责创建目录骨架时生成。

12. **实验/图片资源**：用户手动在 `.tex` 中写 `\includegraphics`、`\input` 等引用 `img/` 和 `experiment/` 下的文件。插件不提供插入辅助。

13. **不实现的功能（由 VS Code + LaTeX Workshop 等插件覆盖）**：
    - `\cite{}` 自动补全 → LaTeX Workshop 已提供
    - 图片/表格插入辅助 → LaTeX Workshop 已提供
    - LaTeX 编译 + PDF 预览 → LaTeX Workshop 已提供
    - 会议 Checklist 跟踪 → 用户在 `review/` 或 `latex/` 下自行管理
    - 参考文献完整性检查 → 用户自行核实
    - 导出打包（ZIP/Overleaf）→ 用户自行操作
    - 模板预览比较 → 创建工程时展示即可，无需并排比较

---

## 数据模型（`packages/types/src/research.ts`）

注意：现有 `research.ts` 中已有 pipeline 相关的 `ResearchProject`、`Manuscript` 等类型（供 research pipeline 功能使用），新增的 paper writing 类型使用不同命名以避免冲突。

```typescript
// ---- 科研工程（Paper Writing 专用，区别于 pipeline 的 ResearchProject） ----
interface PaperProject {
	id: string
	name: string
	rootPath: string // 工程根目录的绝对路径
	templateId: string // 使用的模板 ID，e.g. "neurips2025"
	templateSource: "builtin" | "custom"
	directoryTemplate: string // 目录骨架模板 ID，e.g. "ml-paper" | "systems-paper" | "general-science" | "custom"
	stage: PaperProjectStage
	createdAt: string
	updatedAt: string
}

type PaperProjectStage = "planning" | "literature-review" | "writing" | "revising" | "final" | "submitted"

// ---- 目录骨架模板 ----
interface DirectoryTemplate {
	id: string // e.g. "ml-paper", "systems-paper", "general-science"
	name: string // e.g. "ML Paper"
	description: string
	structure: DirectoryNode[] // 目录树定义
}

interface DirectoryNode {
	name: string // 目录/文件名
	type: "directory" | "file"
	children?: DirectoryNode[] // 子节点（仅 directory）
	template?: string // 文件模板内容（仅 file，可选）
}

// ---- 文献引用（reference/ 下的条目） ----
interface ReferenceEntry {
	citeKey: string // BibTeX key，也是文件名 e.g. "vaswani2017attention"
	title: string
	authors: Author[]
	year: number
	venue: string // 期刊/会议名
	doi?: string
	arxivId?: string
	abstract?: string
	keywords: string[]
	bibtex?: string // 完整 BibTeX 条目，入库时从 API 获取
	hasPdf: boolean // reference/ 下是否有对应 .pdf
	verified: boolean // DOI 是否通过 API 验证
	verifiedAt?: string
	tags: string[]
	dateAdded: string
}

// ---- 会议模板 ----
interface VenueTemplate {
	id: string // e.g. "neurips2025"
	name: string // e.g. "NeurIPS 2025"
	type: "ml" | "systems" | "general"
	pageLimit: number
	extraPages: number
	citationStyle: string
	sectionConfigs: SectionConfig[]
	hasChecklist: boolean
	hasBroaderImpact: boolean
	hasLimitations: boolean
}

interface SectionConfig {
	type: SectionType
	label: string
	recommendedOrder: number
	required: boolean
	targetWordRange?: [number, number]
	aiWritePrompt?: string // AI 生成该章节时的专用指导
}

type SectionType =
	| "abstract"
	| "introduction"
	| "related-work"
	| "methods"
	| "results"
	| "discussion"
	| "conclusion"
	| "broader-impact"
	| "limitations"
	| "appendix"

// ---- 论文写作状态（.roo/project.json 中的 writing 部分） ----
interface PaperWritingState {
	currentSection?: SectionType
	sectionStatus: Record<SectionType, "outline" | "draft" | "revised" | "final">
	totalWords: number
	targetWords: number
	citationCount: number
	figureCount: number
	tableCount: number
	lastEdited: string
}

// ---- 论文快照 ----
interface SnapshotMeta {
	id: string // timestamp-based, e.g. "20260518T143022"
	createdAt: string
	label?: string // 用户可选标签
	fileCount: number
}
```

---

## 后端架构

```
paperWritingMessageHandler          ← 消息路由
  ├── PaperProjectManager           ← 工程创建、目录骨架、模板复制、.roo/project.json
  ├── PaperSectionManager           ← latex/ 内容管理、AI写作、字数统计、快照
  ├── ReferenceManager              ← reference/ 读写、引用扫描、.bib 生成
  ├── VenueTemplateManager          ← 内置模板注册、SectionConfig 查询
  └── LiteratureManager (已有)       ← 文献搜索，入库时委托给 ReferenceManager
```

### 新建服务

**`PaperProjectManager.ts`**（合并 ResearchProjectManager 职责）

```
职责：
- 创建科研工程：空目录检测 + 子目录策略 + 目录骨架生成 + 模板复制 + 初始化 .roo/project.json
- 自动检测加载：打开工作区时自动扫描 .roo/project.json 并加载
- 列出所有科研工程（扫描 workspace 下的 .roo/project.json）
- 模板切换：警告 + 迁移 guide + 章节 diff 展示 → 用户确认后执行
- 验证/修复工程目录结构完整性
```

**`ReferenceManager.ts`**（管理 reference/ 目录）

```
职责：
- 入库文献：从 LiteratureManager 搜索结果 → 生成 {citekey}.md 到 reference/
- 自动生成 citeKey = {firstAuthor}{year}{firstTitleWord}，冲突加数字后缀，用户可修改
- 批量导入 .bib 文件：解析 BibTeX → 每篇生成 reference/{citekey}.md
- 未入库 PDF 扫描：检测 reference/ 下有 .pdf 但无对应 .md → 标记"待入库"列表
- 可选下载 PDF 全文
- 读取 reference/ 下所有 .md 文件，解析元数据
- 扫描 latex/sections/*.tex 中的 \cite{...}（找不到的 citeKey 静默忽略）
- 根据实际引用生成 latex/references.bib
- 列表/搜索/删除 reference/ 条目
```

**`PaperSectionManager.ts`**（管理 latex/ 目录，替代原 PaperProjectManager 命名）

```
职责：
- 管理 latex/sections/ 下 .tex 文件读写
- 章节内容保存（.tex 文件）
- AI 章节生成（组装 Agent prompt = mode指令 + 会议格式 + reference/ 文献摘要 + 已写章节）
- 实时字数统计（按章节 + 总计），与 SectionConfig.targetWordRange 比较告警
- 论文快照：将 latex/ 打包保存到 latex/snapshots/{timestamp}/
- Markdown 导出
```

**`VenueTemplateManager.ts`**

```
职责：
- 注册 11 种内置会议模板的 VenueTemplate 元数据（7种ML + 4种Systems）
- 提供模板文件路径映射（扩展内置资源路径）
- 根据 templateId 返回 SectionConfig[]
- 复制模板文件到目标工程的 template/ 目录
```

---

## AI 写作实现

| 操作            | 实现方式                  | 上下文                                                                 |
| --------------- | ------------------------- | ---------------------------------------------------------------------- |
| **AI 生成整章** | 完整 Agent 任务           | mode指令 + 会议 SectionConfig + reference/ 相关文献摘要 + 已写章节摘要 |
| **AI 文本修订** | `singleCompletionHandler` | 选中文本 + 操作类型对应 prompt                                         |

**AI 生成整章的 prompt 组装**：

```
[1] sci-paper-writing mode 的 customInstructions（写作哲学）
[2] 当前会议的 SectionConfig.aiWritePrompt（该章节具体要求）
[3] 已写章节的内容摘要（让 AI 保持上下文一致）
[4] reference/ 中已入库文献的标题+摘要（让 AI 正确引用）
[5] 用户指令："请为 {章节名} 撰写初稿，目标 {字数范围}字"
```

---

## 前端设计

### 初始状态（无科研工程时）

```
┌─────────────────────────────────────────────────────┐
│ ← Back │  Paper Writing                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│          📝 Welcome to Paper Writing                 │
│                                                     │
│     First, open or create a research project:       │
│                                                     │
│     ┌──────────────────────────────────────┐         │
│     │  Project Name: [_Transformer研究____] │         │
│     │                                      │         │
│     │  Directory Template: [ML Paper ▾]    │         │
│     │    → ML Paper (默认)                  │         │
│     │    → Systems Paper                   │         │
│     │    → General Science                 │         │
│     │    → Custom...                       │         │
│     │                                      │         │
│     │  Venue Template: [NeurIPS 2025 ▾]   │         │
│     │    → NeurIPS 2025 (9 pages)          │         │
│     │    → ICML 2026 (8 pages)             │         │
│     │    → ICLR 2026 (9 pages)             │         │
│     │    → ACL / AAAI / COLM / ...         │         │
│     │    → Generic LaTeX (无特定会议)       │         │
│     │    → Use my own template/            │         │
│     │                                      │         │
│     │        [Create Project]              │         │
│     │        [Open Existing Project]       │         │
│     └──────────────────────────────────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 编辑状态（有科研工程时）

```
┌────────────────────────────────────────────────────────────┐
│ ← Back │ NeurIPS 2025 │ [Sections ▾] [References ▾] [⚙] │
├──────────┬──────────────────────────────┬──────────────────┤
│ SECTIONS │    Editor                     │   REFERENCES     │
│          │  ┌────────────────────────┐   │   ┌──────────┐   │
│ ◆ Intro  │  │ [Write] [Polish]       │   │   │ Scan .tex│   │
│   350/500│  │ [Revise] [Snapshot]    │   │   │ Generate │   │
│   words  │  ├────────────────────────┤   │   │ .bib     │   │
│          │  │                        │   │   ├──────────┤   │
│ ◇ Methods│  │  LaTeX Editor          │   │   │ ✓ Ref 1  │   │
│ ◇ Results│  │                        │   │   │ ✓ Ref 2  │   │
│ ◇ Discuss│  │                        │   │   │ ⚠ PDF    │   │
│ ◇ Concl  │  │                        │   │   │ (待入库)  │   │
│ ◇ Appx   │  │                        │   │   │ ...      │   │
│          │  │                        │   │   │          │   │
│ ──────── │  └────────────────────────┘   │   │ 引用: 12  │   │
│ Progress │                               │   │ 已入库: 38│   │
│ 3500/8000│                               │   │ 待入库: 3 │   │
│ ████░░   │                               │   │          │   │
│ ▲ Intro  │                               │   │ [导入.bib]│   │
│   超标!   │                               │   │ [扫描PDF] │   │
├──────────┴──────────────────────────────┴──────────────────┤
│ Stage: Writing │ Last saved: 2 min ago │ 12 refs in .bib   │
└────────────────────────────────────────────────────────────┘
```

右侧 Reference 面板的关键操作：

- **Scan .tex** — 扫描 `latex/sections/` 下所有 `.tex`，提取 `\cite{...}` 列表
- **Generate .bib** — 根据 scan 结果，从 `reference/` 匹配对应 `.md` → 生成 `latex/references.bib`
- 显示引用列表：`✓ ref1`（已在 .bib 中） vs `⚠ ref3`（在 .tex 中引用了但 reference/ 中找不到）

### 组件拆分

| 组件                    | 职责                                                |
| ----------------------- | --------------------------------------------------- |
| `PaperWritingView.tsx`  | 主容器：有项目→编辑界面，无项目→创建界面            |
| `ProjectCreateForm.tsx` | 创建工程：名称 + 目录模板 + 会议模板选择            |
| `ProjectSelector.tsx`   | 打开已有工程：扫描 workspace 下的 .roo/project.json |
| `SectionList.tsx`       | 左侧章节列表 + 进度指示                             |
| `SectionEditor.tsx`     | 中间 LaTeX 编辑器 + AI 工具栏                       |
| `AiToolbar.tsx`         | AI 操作按钮（Write/Polish/Revise/Check Cites）      |
| `ReferencePanel.tsx`    | 右侧引用面板（扫描 .tex、生成 .bib、显示引用状态）  |

---

## 消息类型

所有消息使用 `paper` 前缀，避免与其他模块冲突。

```
// 科研工程
paperProjectCreate         — { name, directoryTemplate, venueTemplateId }
paperProjectOpen           — { rootPath }
paperProjectList           — 扫描所有工程
paperProjectLoad           — 自动检测 .roo/project.json 并返回状态

// 章节管理
paperSectionLoad           — { sectionType }      → 返回 .tex 内容 + words + 是否超标
paperSectionSave           — { sectionType, content }
paperSectionStatus         — 返回所有章节的 PaperWritingState（含字数统计+限制对比）

// AI 操作
paperAiWriteSection        — { sectionType }      → Agent 任务生成整章
paperAiReviseText          — { text, operation }  → singleCompletion 修订

// 引用管理
paperReferenceList         — 列出 reference/ 下所有条目（已入库 + 待入库 PDF）
paperReferenceScanTex      — 扫描 latex/sections/*.tex 提取 \cite{...}
paperReferenceGenerateBib  — 根据 scan 结果生成 latex/references.bib
paperReferenceAdd          — { entry }            → 写入 reference/{citekey}.md
paperReferenceRemove       — { citeKey }
paperReferenceBatchImport  — { bibtexContent }    → 解析 .bib 批量入库
paperReferenceScanPdf      — 扫描 reference/ 下有 .pdf 无 .md 的文件

// 论文快照
paperSnapshotCreate        — 保存 latex/ 到 latex/snapshots/{timestamp}/
paperSnapshotList          — 列出所有快照
paperSnapshotRestore       — { snapshotId }       → 恢复指定快照

// 模板操作
paperVenueSwitch           — { newTemplateId }    → 警告 + 迁移 guide → 切换

// 导出
paperMarkdownExport        — 生成 Markdown 版本
```

---

## LaTeX 模板来源

从 AI-Research-SKILLs 仓库复制模板文件到扩展内置资源。模板分为 ML 类（来自 `ml-paper-writing/`）和系统类（来自 `systems-paper-writing/`）：

```
src/services/paper/templates/
├── neurips2025/    (9页, checklist 必须)
├── icml2026/       (8页, Broader Impact 必须)
├── iclr2026/       (9页, LLM disclosure 推荐)
├── acl/            (8页, limitations 必须)
├── aaai2026/       (7页, 严格格式)
├── colm2025/       (9页)
├── osdi2026/       (12页, USENIX 格式)
├── sosp2026/       (12页, ACM SIGOPS)
├── asplos2027/     (11页, ACM SIGPLAN)
├── nsdi2027/       (12页, USENIX 格式)
└── generic/        (通用 article，当用户不指定会议时使用)
```

注意：`generic/` 模板不存在于 AI-Research-SKILLs 中，需要手动创建一个基于 `\documentclass{article}` 的简单模板作为 fallback。

---

## 实施步骤

### Phase 1: 类型定义 + 模板准备（不动旧代码）

1. 新增 `PaperProject`、`DirectoryTemplate`、`ReferenceEntry`、`VenueTemplate`、`SectionConfig`、`PaperWritingState`、`SnapshotMeta` 等类型到 `research.ts`（使用新命名避免与现有 pipeline 类型冲突）
2. 新增所有消息类型到 `vscode-extension-host.ts`（统一使用 `paper` 前缀）
3. 从 `AI-Research-SKILLs-temp/` 复制模板文件到 `src/services/paper/templates/`（10个会议模板 = 6个ML + 4个Systems）
4. 创建 `generic/` fallback 模板
5. 定义 10 种会议的 `VenueTemplate` 配置数据 + 3 种 `DirectoryTemplate`（ML/Systems/General），每种目录模板包含目录树预览信息

### Phase 2: 后端服务层

6. 实现 `VenueTemplateManager.ts` — 模板注册、查询、SectionConfig 获取、文件复制到工程
7. 实现 `ReferenceManager.ts` — reference/ 读写、citeKey 生成、批量导入 .bib、未入库 PDF 扫描、引用扫描、.bib 生成
8. 实现 `PaperSectionManager.ts` — latex/ 内容管理、AI写作 prompt 组装、章节字数统计+限制检查、论文快照（创建/列表/恢复）、Markdown 导出
9. 实现 `PaperProjectManager.ts` — 工程创建（空目录检测+子目录策略+目录骨架生成+模板复制+初始化 .roo/project.json）、自动检测加载、模板切换（警告+迁移+章节 diff）
10. 在 `ClineProvider.ts` 注册新服务（替换旧的 `PaperWritingManager`）

### Phase 3: 消息处理层

11. 重写 `paperWritingMessageHandler.ts` — 对接所有新消息类型
12. 更新 `webviewMessageHandler.ts` 路由（新增 `paper*` 消息 case）

### Phase 4: Mode + Skill + Rule 增强

**架构说明**：Skill 和 Rule 的源文件存储在扩展资源目录 `src/services/paper/skills/` 和 `src/services/paper/rules/` 中，作为扩展的内置资源打包。当用户创建科研工程时，`PaperProjectManager.createProject()` 根据模板类型（ML/Systems/General）将相应的 skill 和 rule 文件复制到科研工程的 `.roo/skills/` 和 `.roo/rules-sci-paper-writing/` 目录下。这样插件运行时，AI 助手就能从科研工程目录加载这些 skills 和 rules。

**Skill 命名**：`ml-paper-writing` 针对 ML 会议（NeurIPS/ICML/ICLR/ACL/AAAI/COLM），`systems-paper-writing` 针对系统会议（OSDI/SOSP/ASPLOS/NSDI），`academic-plotting` 通用。

13. ~~`sci-paper-writing` mode 的 `customInstructions`~~（已完成：嵌入 Narrative Principle、5-sentence abstract、Gopen & Swan、citation hallucination prevention）
14. 创建 `src/services/paper/skills/ml-paper-writing/SKILL.md` — ML 会议论文写作完整工作流
15. 创建 `src/services/paper/skills/systems-paper-writing/SKILL.md` — 系统会议论文写作
16. 创建 `src/services/paper/skills/academic-plotting/SKILL.md` — 学术图表生成
17. 更新 `src/services/paper/rules/writing-standards.md` — 详细写作规范（从现有 `.roo/rules-sci-paper-writing/writing-standards.md` 扩展）
18. 更新 `PaperProjectManager.createProject()` — 根据 venue template type 复制 skills 和 rules 到科研工程的 `.roo/` 目录
19. 更新 `VenueTemplate` 类型 — 添加 `skillNames: string[]` 字段指示该模板需要复制哪些 skills
20. 更新 `VenueTemplateManager` — 添加 `copySkillsToProject()` 和 `copyRulesToProject()` 方法

### Phase 5: 前端重写

21. 重写 `PaperWritingView.tsx`（创建界面 + 编辑界面，含字数统计条）
22. 创建 `ProjectCreateForm.tsx`（含目录模板预览树 + 会议模板选择）、`SectionList.tsx`（含字数+超标告警）、`SectionEditor.tsx`、`AiToolbar.tsx`（含快照按钮）、`ReferencePanel.tsx`（含扫描、导入、PDF 检测）
23. 更新 `ExtensionStateContext.tsx`、`App.tsx`

### Phase 6: 清理旧代码

24. 删除 `PaperWritingManager.ts`，清理旧消息路由
25. 清理 `AI-Research-SKILLs-temp` 临时目录

---

## 关键文件清单

### 新增

- `src/services/paper/PaperProjectManager.ts`
- `src/services/paper/PaperSectionManager.ts`
- `src/services/paper/ReferenceManager.ts`
- `src/services/paper/VenueTemplateManager.ts`
- `src/services/paper/paperConfig.ts`
- `src/services/paper/templates/[11个会议模板]`
- `src/services/paper/skills/ml-paper-writing/SKILL.md`（扩展内置，运行时刻复制到科研工程）
- `src/services/paper/skills/systems-paper-writing/SKILL.md`（扩展内置，运行时刻复制到科研工程）
- `src/services/paper/skills/academic-plotting/SKILL.md`（扩展内置，运行时刻复制到科研工程）
- `src/services/paper/rules/writing-standards.md`（扩展内置，运行时刻复制到科研工程）
- `webview-ui/src/components/paper/ProjectCreateForm.tsx`
- `webview-ui/src/components/paper/ProjectSelector.tsx`
- `webview-ui/src/components/paper/SectionList.tsx`
- `webview-ui/src/components/paper/SectionEditor.tsx`
- `webview-ui/src/components/paper/AiToolbar.tsx`
- `webview-ui/src/components/paper/ReferencePanel.tsx`

### 修改

- `packages/types/src/research.ts` — 新增 Paper\* 类型（保留现有 pipeline 类型不变）
- `packages/types/src/vscode-extension-host.ts` — 新增 paper\* 消息类型
- `packages/types/src/mode.ts` — 增强 sci-paper-writing mode customInstructions
- `src/services/paper/paperConfig.ts` — VenueTemplate 添加 skillNames；DirectoryTemplate 添加 ruleFiles
- `src/services/paper/PaperProjectManager.ts` — createProject() 增加复制 skills 和 rules 到目标工程
- `src/services/paper/VenueTemplateManager.ts` — 新增 copySkillsToProject() 和 copyRulesToProject() 方法
- `src/core/webview/ClineProvider.ts` — 注册新服务（替换旧 PaperWritingManager）
- `src/core/webview/webviewMessageHandler.ts` — 路由新 paper\* 消息
- `src/core/webview/paperWritingMessageHandler.ts` — 重写
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/App.tsx`
- `webview-ui/src/components/paper/PaperWritingView.tsx` — 重写

### 废弃（Phase 6）

- `src/services/paper-writing/PaperWritingManager.ts`

---

## 📋 实施状态归档（2026-05-18）

### ✅ Phase 1-3：全部完成

| #   | 阶段    | 任务                                                                                 | 状态 |
| --- | ------- | ------------------------------------------------------------------------------------ | ---- |
| 1   | Phase 1 | research.ts 类型定义（PaperProject, ReferenceEntry, VenueTemplate 等 7 个类型）      | ✅   |
| 2   | Phase 1 | vscode-extension-host.ts paper\* 消息类型（23 个 WebviewMessage）                    | ✅   |
| 3   | Phase 1 | paperConfig.ts — 11 个 VENUE_TEMPLATES + 3 个 DIRECTORY_TEMPLATES                    | ✅   |
| 4   | Phase 1 | templates/ 目录 — 11 个会议模板（6 ML + 4 Systems + 1 generic）                      | ✅   |
| 5   | Phase 2 | VenueTemplateManager.ts — 模板元数据 + 模板文件复制到工程                            | ✅   |
| 6   | Phase 2 | ReferenceManager.ts — reference/ CRUD + citeKey 生成 + BibTeX + 批量导入 + PDF 扫描  | ✅   |
| 7   | Phase 2 | PaperSectionManager.ts — 章节 I/O + 字数统计 + AI prompt 组装 + 快照 + Markdown 导出 | ✅   |
| 8   | Phase 2 | PaperProjectManager.ts — 工程创建/检测/打开/切换 + 目录骨架 + 模板复制               | ✅   |
| 9   | Phase 2 | ClineProvider.ts — 注册 4 个新服务（保留旧 PaperWritingManager 过渡）                | ✅   |
| 10  | Phase 3 | paperWritingMessageHandler.ts — 处理所有 paper\* action                              | ✅   |
| 11  | Phase 3 | webviewMessageHandler.ts — 路由 paper\* 消息                                         | ✅   |

### ✅ Phase 4 已完成部分

| #   | 任务                                                  | 文件                                                       | 状态                                                                                 |
| --- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | sci-paper-writing mode customInstructions 增强        | `packages/types/src/mode.ts`                               | ✅ 写入 Narrative Principle、5-Sentence Abstract、Gopen & Swan 原则、citation 防幻觉 |
| 2   | ml-paper-writing SKILL.md                             | `src/services/paper/skills/ml-paper-writing/SKILL.md`      | ✅ ML 会议写作完整工作流                                                             |
| 3   | systems-paper-writing SKILL.md                        | `src/services/paper/skills/systems-paper-writing/SKILL.md` | ✅ 系统会议写作                                                                      |
| 4   | academic-plotting SKILL.md                            | `src/services/paper/skills/academic-plotting/SKILL.md`     | ✅ 学术图表生成                                                                      |
| 5   | writing-standards.md 规则                             | `src/services/paper/rules/writing-standards.md`            | ✅ 详细写作规范                                                                      |
| 6   | VenueTemplate 类型添加 skillNames 字段                | `packages/types/src/research.ts`                           | ✅                                                                                   |
| 7   | DirectoryTemplate 类型添加 ruleFiles 字段             | `packages/types/src/research.ts`                           | ✅                                                                                   |
| 8   | paperConfig.ts 所有 venue 添加 skillNames             | `src/services/paper/paperConfig.ts`                        | ✅                                                                                   |
| 9   | paperConfig.ts 所有 directory template 添加 ruleFiles | `src/services/paper/paperConfig.ts`                        | ✅                                                                                   |
| 10  | VenueTemplateManager 添加 copySkillsToProject()       | `src/services/paper/VenueTemplateManager.ts`               | ✅                                                                                   |
| 11  | VenueTemplateManager 添加 copyRulesToProject()        | `src/services/paper/VenueTemplateManager.ts`               | ✅                                                                                   |
| 12  | PaperProjectManager.createProject() 复制 skills/rules | `src/services/paper/PaperProjectManager.ts`                | ✅                                                                                   |

### ✅ Phase 4：全部完成（含编译错误修复）

| #   | 错误位置                     | 错误类型                                                                  | 状态      |
| --- | ---------------------------- | ------------------------------------------------------------------------- | --------- |
| 1   | `research.ts:231`            | `Author` type not found — 添加 `import { Author } from "./literature.js"` | ✅ 已修复 |
| 2   | `ClineProvider.ts:278`       | 残留字符 `n` — Node.js 脚本移除                                           | ✅ 已修复 |
| 3   | `PaperSectionManager.ts:208` | `??` 运算符优先级 — 加括号 `(configs.find(...)?.recommendedOrder ?? 99)`  | ✅ 已修复 |
| 4   | `fix-mode.js`                | 临时脚本                                                                  | ✅ 已清理 |

### ✅ Phase 5-6：全部完成（2026-05-18）

| #   | 阶段    | 任务                                                   | 状态                                                                                                     |
| --- | ------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1   | Phase 5 | PaperWritingView.tsx 重写（创建界面 + 编辑界面）       | ✅ 已重写：无项目→ProjectCreateForm，有项目→三栏布局（SectionList + SectionEditor + ReferencePanel）     |
| 2   | Phase 5 | ProjectCreateForm.tsx（含目录模板预览 + 会议模板选择） | ✅ 已创建：项目名输入 + 目录骨架预览树 + 11 种会议模板下拉（按 ML/Systems/General 分组）                 |
| 3   | Phase 5 | SectionList.tsx（含字数 + 超标告警）                   | ✅ 已创建：章节列表 + 状态图标 + 字数/上限 + 超标红色告警 + 进度条                                       |
| 4   | Phase 5 | SectionEditor.tsx + AiToolbar.tsx（含快照按钮）        | ✅ 已创建：LaTeX 编辑器 + AI 工具栏（Write/Translate/Style/Rewrite/Rephrase 等）+ 快照按钮 + AI 结果预览 |
| 5   | Phase 5 | ReferencePanel.tsx（含扫描、导入、PDF 检测）           | ✅ 已创建：Scan .tex / Generate .bib / Scan PDFs / Import .bib 按钮 + 引用列表 + 缺失告警 + 未入库 PDF   |
| 6   | Phase 5 | ExtensionStateContext.tsx + App.tsx 更新               | ✅ ExtensionStateContext 新增 paperProjectState/paperReferenceState/paperSnapshotState                   |
| 7   | Phase 6 | 删除旧 PaperWritingManager.ts                          | ✅ 已删除：移除 ClineProvider 中的 import/property/初始化/getter，删除文件及 paper-writing 目录          |
| 8   | Phase 6 | 清理 AI-Research-SKILLs-temp 目录                      | ✅ 已完成（目录已不存在）                                                                                |

**Phase 5-6 附带的额外修复：**
| # | 位置 | 变更 |
|---|------|------|
| 1 | `vscode-extension-host.ts` | WebviewMessage 新增 `sectionType`、`directoryTemplate`、`venueTemplateId`、`operation`、`option`、`entry`、`newTemplateId`、`bibtexContent` 字段 |
| 2 | `packages/types` | 重新构建以更新类型声明 |
| 3 | `README.md` | 更新旧 paper-writing/ 路径引用为新的 paper/ 服务 |

## 功能验证

1. **创建 ML 工程**：新建 ML Paper 工程 → 选 NeurIPS 2025 → 验证目录骨架完整 → 验证 template/ 有 .sty → 验证 `.roo/skills/ml-paper-writing/SKILL.md` 已复制 → 验证 `.roo/skills/academic-plotting/SKILL.md` 已复制 → 验证 `.roo/rules-sci-paper-writing/writing-standards.md` 已复制
2. **创建 Systems 工程**：新建 Systems Paper 工程 → 选 OSDI 2026 → 验证 `.roo/skills/systems-paper-writing/SKILL.md` 已复制 → 验证 `ml-paper-writing` 未复制
3. **AI 写章节**：选中 Introduction → AI Write → 验证 prompt 包含 customInstructions + SectionConfig.aiWritePrompt + 已写章节上下文
4. **入库文献**：Literature 面板搜 "Attention is all you need" → 入库 → 验证 reference/vaswani2017attention.md 和 .pdf 存在
5. **生成 .bib**：在 .tex 中写入 `\cite{vaswani2017attention}` → Scan → Generate .bib → 验证 latex/references.bib 正确
6. **Skill 加载**：在科研工程中切换到 sci-paper-writing mode → 验证 AI 助手能发现并加载 ml-paper-writing skill
