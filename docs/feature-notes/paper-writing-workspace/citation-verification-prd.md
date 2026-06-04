# AI 生成稿件引用可靠性保障 + Reference 板块重设计

> **文档类型**：LLM Implementation Spec  
> **版本**：v2.1  
> **日期**：2026-05-27  
> **面向读者**：前端/后端开发工程师、代码生成型大模型  
> **目标**：让大模型能低歧义地按规格实现功能，而不是自行补全关键行为

---

## 一、文档目的

这不是一份偏愿景表达的 PRD，而是一份**面向实现的规格说明**。  
本文件应满足以下目标：

1. 明确要改哪些文件、增加哪些数据结构、补哪些交互
2. 明确每一步的输入来源，避免大模型自行猜测
3. 明确状态定义、状态流转、错误处理和非目标
4. 让实现者可以按阶段逐步交付，并据此编写测试

如果文档中的自然语言描述与“明确规则表”冲突，**以规则表和示例为准**。

---

## 二、背景与问题

### 2.1 当前状态

**问题一：Agent 初稿生成时无法感知 reference library。**

[`buildFirstDraftPrompt`](webview-ui/src/components/paper/PaperWritingView.tsx:111) 和 [`buildRevisionDraftPrompt`](webview-ui/src/components/paper/PaperWritingView.tsx:149) 当前仅引导 Agent 检查：

- `problem/research-questions.md`
- `task/paper-plan.md`
- 目标 manuscript 文件
- `template/`
- `.roo/rules-sci-paper-writing/`

**未提及 `reference/` 目录**，导致 Agent 生成引用时主要依赖模型记忆，容易出现：

- 发明 citeKey
- 使用项目中不存在的论文
- 错误复用相近论文

**问题二：ReferencePanel 当前按数据类型堆叠，而不是按用户任务组织。**

当前 [`ReferencePanel`](webview-ui/src/components/paper/ReferencePanel.tsx) 大致结构为：

- 文字摘要
- 操作按钮
- 统计数据
- Citation Placeholders
- Missing Cite Keys
- Uncatalogued PDFs
- Draft-linked References

这种组织方式对代码实现容易，但对用户来说需要二次翻译成“下一步该做什么”。

**问题三：引用可靠性不可见。**

`ReferenceEntry.verified` 字段已存在（定义于 [`packages/types/src/research.ts`](packages/types/src/research.ts:235)），但当前在 [`ReferenceManager.ts`](src/services/paper/ReferenceManager.ts:652) 中仅通过 `!!doi` 粗略赋值。  
结果是：

- library 中已有条目会被默认视为可信
- AI 编造引用无法被显式标出
- 元数据冲突无法被诊断

当前系统已覆盖：

- citation placeholders
- missing cite keys
- uncatalogued PDFs

尚未覆盖：

- unverified citations
- metadata mismatch
- likely fabricated citations

### 2.2 已有可复用基础设施

| 源               | 现有能力                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Semantic Scholar | [`SearchLiteratureTool.ts:searchSemanticScholar`](src/core/tools/SearchLiteratureTool.ts:268) |
| CrossRef         | [`SearchLiteratureTool.ts:searchCrossref`](src/core/tools/SearchLiteratureTool.ts:295)        |
| OpenAlex         | [`SearchLiteratureTool.ts:searchOpenAlex`](src/core/tools/SearchLiteratureTool.ts:322)        |
| arXiv            | [`SearchLiteratureTool.ts:searchArxiv`](src/core/tools/SearchLiteratureTool.ts:61)            |
| PubMed           | [`SearchLiteratureTool.ts:searchPubMed`](src/core/tools/SearchLiteratureTool.ts:60)           |

关键差距：

- 现有实现偏关键词搜索
- 缺少 `GET /works/{doi}` 这种 DOI 精确反查能力
- 缺少将“稿件中的 citeKey”和“引用元数据”关联起来的验证管道

### 2.3 重要背景：两套文献存储系统

当前项目中存在两套文献存储系统，职责隔离：

| 系统         | 读文献功能（ReadPaper）                                                | 论文写作功能（Paper Writing）                                   |
| ------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| 管理类       | [`LiteratureManager`](src/services/literature/LiteratureManager.ts:26) | [`ReferenceManager`](src/services/paper/ReferenceManager.ts:63) |
| 数据模型     | [`LiteratureEntry`](packages/types/src/literature.ts:26)               | [`ReferenceEntry`](packages/types/src/research.ts:235)          |
| 存储位置     | `.roo/literature/library.json`                                         | `reference/{citeKey}.md`                                        |
| LaTeX 可引用 | 否                                                                     | 是                                                              |
| 主要用途     | 检索、阅读、笔记                                                       | 生成 `references.bib`、稿件编译                                 |

桥接调用链：

```text
ReadPaper View
  -> handleReadPaperImportCandidate
  -> RetrievalManager.importCandidateToLibrary(...)
     -> literatureManager.upsertReadPaperCandidate()
     -> referenceManager.importReadPaperCandidate() // 仅在 downloadPdfToReference=true 时
```

本功能新增第三套存储：

- `.roo/reference-verification.json`

该文件由 `CitationVerifier` 独占管理，**不回写**：

- `reference/{citeKey}.md`
- `.roo/literature/library.json`

---

## 三、本期目标与非目标

### 3.1 本期目标

1. 让 Agent 在生成稿件前感知项目已有 reference library
2. 在生成后自动验证稿件中的 citations，并输出结构化诊断结果
3. 将 ReferencePanel 改造成“按问题优先级组织”的诊断看板
4. 提供“人工判断 + Agent 辅助修复”的闭环，而不是静默自动修稿

### 3.2 非目标

以下内容**不在本期实现范围内**，大模型不得自行扩展：

1. 不做撤稿检测、Expression of Concern 检测、期刊质量评估
2. 不修改 `reference/{citeKey}.md` 文件结构
3. 不修改 `.roo/literature/library.json` 的 schema
4. 不改写现有 `references.bib` 生成逻辑
5. 不自动删除正文段落
6. 不在后台无提示地替用户修改稿件
7. 不新增重量级第三方依赖；字符串相似度使用轻量内联实现即可

---

## 四、实现原则

### 4.1 对大模型实现的硬约束

1. **输入来源必须明确。** 不能凭空假设 `claimedTitle` 等字段已经存在
2. **状态必须可重复推导。** 同一输入多次执行得到相同状态
3. **失败原因必须保留。** 不能把所有异常都归到 `likely_fabricated`
4. **人工裁决优先于自动判断。** 用户手动忽略后，UI 不应重复高亮同一问题
5. **增量更新优先。** 稿件未变化时，不应无意义全量重跑

### 4.2 本期判定范围

本期的“引用可靠性”仅表示：

- citeKey 是否存在
- 是否能从本地库或外部元数据源找到合理匹配
- 已声明 DOI 是否和标题/作者/年份大致一致

本期**不等价于**：

- 论文是否真实有效到学术发表标准
- 论文是否已撤稿
- 论文是否适合支撑该语义主张

---

## 五、整体方案

```text
阶段 A：写前约束
  Prompt 注入 reference library 摘要
  + 要求新引用给出 [CITATION NEEDED] 占位

阶段 B：写后验证
  扫描稿件 citeKey
  -> 解析本地引用元数据
  -> DOI 直查 / 模糊搜索
  -> 产出 verification store

阶段 C：ReferencePanel 重构
  展示健康总览、优先问题、当前章节引用、库浏览

阶段 D：人工裁决 / Agent 修复
  对 flagged 条目发起重新验证、手动忽略、Agent 辅助修复
```

---

## 六、关键输入来源定义

这一节是给实现者和大模型看的，优先级高于前文自然语言描述。

### 6.1 CitationVerifier 的输入来源

对于稿件中的每个 `citeKey`，验证所需字段按以下顺序获取：

1. **优先从 `referenceEntries` 读取**
    - 来源：`ReferenceManager` 当前已加载到 Paper Writing 视图的 `ReferenceEntry[]`
    - 可用字段：`citeKey`、`title`、`authors`、`year`、`doi`、`bibtex` 等
2. **若 `referenceEntries` 中无该 citeKey**
    - 视为 `missing cite key`
    - 不尝试从正文语义中反推 title/authors/year
    - 若稿件中存在 `[CITATION NEEDED: ...]`，按 placeholder 单独统计，不进入 verifier
3. **若本地条目存在但字段不完整**
    - `doi` 存在：走 DOI 直查
    - `doi` 不存在但 `title` 存在：走 title/author/year 模糊搜索
    - `title` 也不存在：标记 `skipped`

### 6.2 “library 中已存在” 的精确定义

`library-match` 的定义是：

```typescript
referenceEntries.some((entry) => entry.citeKey === citeKey)
```

注意：

- 这只表示“本地存在同 citeKey 条目”
- **不等于最终 verified**
- 本期不再使用“只要在库里就直接完全信任”的旧规则

### 6.3 Prompt 注入 reference 的选择规则

不能简单“截前 30 条”。  
应按以下优先级选择要注入 prompt 的 reference 摘要：

1. 当前稿件已引用的 citeKey
2. 当前章节相关的 citeKey
3. 最近导入或最近使用的 citeKey
4. 剩余位置再按稳定顺序补足

硬上限：

- 最多注入 30 条 reference 摘要
- 每条仅保留：`citeKey`、`title`、`authors`、`year`、`doi?`、`verificationHint`

如果当前实现无法可靠得到“章节相关性”，允许 Phase 1 退化为：

- 已引用 > 最近使用 > 其余按字母序

---

## 七、数据模型

### 7.1 Verification Store

```typescript
interface VerificationStore {
	version: 1
	lastFullScan: string | null
	manuscriptPath: string | null
	manuscriptHash: string | null
	entries: Record<string, VerificationEntry>
}

interface VerificationEntry {
	citeKey: string
	status: "verified" | "unverified" | "ambiguous" | "likely_fabricated" | "missing" | "skipped"
	reason:
		| "local-metadata-only"
		| "doi-match"
		| "doi-title-mismatch"
		| "fuzzy-match"
		| "fuzzy-low-confidence"
		| "source-not-found"
		| "missing-local-entry"
		| "insufficient-metadata"
		| "network-error"
		| "manual-dismissed"
	confidence: number
	verifiedAt: string | null
	method: "doi-direct" | "title-author-fuzzy" | "local-only" | "skipped"
	sourceSnapshot: {
		localTitle?: string
		localAuthors?: string[]
		localYear?: number
		localDoi?: string
	}
	matches: VerificationMatch[]
	stale: boolean
	dismissedByUser?: boolean
	dismissedReason?: string
}

interface VerificationMatch {
	source: "crossref" | "semantic-scholar" | "openalex"
	doi: string | null
	title: string
	authors: string[]
	year: number | null
	similarityScore: number
}
```

### 7.2 为什么要增加 `reason / stale / dismissedByUser`

这是为了避免大模型实现成“只有一个 status，UI 只能猜原因”的弱设计。

- `reason`：UI 和 Agent prompt 都需要解释性文案
- `stale`：本地元数据或稿件变化后，旧验证结果不能继续当真
- `dismissedByUser`：支持人工裁决，避免反复报警

---

## 八、状态机定义

### 8.1 状态进入规则

| 状态                | 进入条件                                           | 是否显示为问题 |
| ------------------- | -------------------------------------------------- | -------------- |
| `verified`          | DOI 直查高匹配，或模糊搜索高匹配                   | 否             |
| `unverified`        | 本地有条目，但仅有本地元数据，未完成外部验证       | 是             |
| `ambiguous`         | 找到候选，但相似度处于灰区                         | 是             |
| `likely_fabricated` | 存在 citeKey，但外部查无合理候选或强冲突           | 是             |
| `missing`           | 稿件使用了 citeKey，但本地 referenceEntries 中没有 | 是             |
| `skipped`           | 元数据不足或网络错误，无法判断                     | 视原因决定     |

### 8.2 详细判定规则

1. `citeKey` 不在 `referenceEntries` 中

    - `status = "missing"`
    - `reason = "missing-local-entry"`

2. 本地有条目，但没有 `doi` 且没有 `title`

    - `status = "skipped"`
    - `reason = "insufficient-metadata"`

3. 本地有 `doi`

    - 调用 `CrossRef GET /works/{doi}`
    - 若成功返回并且标题相似度 `>= 0.85`
        - `status = "verified"`
        - `reason = "doi-match"`
    - 若成功返回且相似度 `>= 0.6 && < 0.85`
        - `status = "ambiguous"`
        - `reason = "doi-title-mismatch"`
    - 若成功返回且相似度 `< 0.6`
        - `status = "likely_fabricated"`
        - `reason = "doi-title-mismatch"`
    - 若返回 404 或明确 not found
        - `status = "likely_fabricated"`
        - `reason = "source-not-found"`
    - 若 429 / timeout / network failure
        - `status = "skipped"`
        - `reason = "network-error"`

4. 本地无 `doi`，但有 `title`

    - 用 `title + authors + year` 做多源模糊搜索
    - 取最佳候选
    - 相似度 `>= 0.85`
        - `status = "verified"`
        - `reason = "fuzzy-match"`
    - 相似度 `>= 0.6 && < 0.85`
        - `status = "ambiguous"`
        - `reason = "fuzzy-low-confidence"`
    - 无有效候选
        - `status = "likely_fabricated"`
        - `reason = "source-not-found"`

5. 用户手动忽略
    - 不改变 `status`
    - 设置 `dismissedByUser = true`
    - 设置 `reason = "manual-dismissed"`
    - UI 默认不在 Needs Attention 首屏高亮，但可在详情中查看

### 8.3 Dashboard 统计口径

```typescript
const healthMetrics = {
	ready: count(status === "verified"),
	unverified: count(status === "unverified"),
	suspect: count(status === "likely_fabricated" || status === "ambiguous"),
	missing: count(status === "missing"),
	placeholder: citationPlaceholderCount ?? 0,
	skipped: count(status === "skipped" && !dismissedByUser),
}
```

注意：

- `skipped` 不计入 `suspect`
- `dismissedByUser === true` 的条目不应继续作为首屏重点问题

---

## 九、阶段 A：写前约束

### 9.1 修改位置

- [`PaperWritingView.tsx`](webview-ui/src/components/paper/PaperWritingView.tsx:111)
- [`PaperWritingView.tsx`](webview-ui/src/components/paper/PaperWritingView.tsx:149)

即：

- `buildFirstDraftPrompt`
- `buildRevisionDraftPrompt`

### 9.2 输入参数

```typescript
interface BuildDraftPromptInput {
	// existing fields...
	availableReferences: Array<{
		citeKey: string
		title: string
		authors: string
		year: number
		doi?: string
		verificationHint: "verified" | "unverified" | "missing-doi"
	}>
}
```

### 9.3 调用规则

在 [`handleDraftWithAgent`](webview-ui/src/components/paper/PaperWritingView.tsx:317) 中构造 `availableReferences`：

1. 先拿当前稿件已引用条目
2. 再补最近使用或最近导入条目
3. 最多 30 条

### 9.4 Prompt 增量要求

需要在原有 prompt 中显式增加：

```text
## Available Reference Library
These references already exist in the project library.
Use their exact cite keys when citing. Do not invent a new cite key
for a paper that is already listed here.

If you need a source that is not in the library:
- Prefer inserting a [CITATION NEEDED: topic | doi:10.xxxx/xxxx] placeholder
- If DOI is unknown, use [CITATION NEEDED: brief topic description]
- Do not fabricate bibliographic metadata
```

并在引导 Agent 检查文件的说明中加入：

```text
...and reference/*.md files to understand what literature is already catalogued.
```

### 9.5 大模型禁止行为

在 prompt 中明确要求：

1. 不发明 citeKey
2. 不凭空补 DOI
3. 不为不存在于 library 的论文伪造完整 BibTeX
4. 遇到不确定来源时使用 `[CITATION NEEDED: ...]`

---

## 十、阶段 B：写后验证管道

### 10.1 新建文件

```text
src/services/paper/CitationVerifier.ts
```

### 10.2 核心接口

```typescript
export class CitationVerifier {
	constructor(private projectRoot: string) {}

	async verifyCitation(
		citeKey: string,
		options: {
			texFilePath: string
			referenceEntries: ReferenceEntry[]
		},
	): Promise<VerificationEntry>

	async verifyAllCitations(options: {
		texFilePath: string
		referenceEntries: ReferenceEntry[]
	}): Promise<VerificationStore>

	async loadStore(): Promise<VerificationStore>
	private async saveStore(store: VerificationStore): Promise<void>
}
```

### 10.3 `verifyCitation()` 规范

实现时必须遵循：

1. 不从正文自然语言抽取 title/authors/year
2. 只使用本地 `ReferenceEntry` 作为 claimed metadata 来源
3. 不在 verifier 中修改 reference library
4. 返回的 `VerificationEntry` 必须包含 `status + reason + confidence + matches`

### 10.4 `verifyAllCitations()` 流程

```text
读取 texFile
  -> 提取所有 citeKey
  -> 去重
  -> 对每个 citeKey 调用 verifyCitation()
  -> 生成 manuscriptHash
  -> 写入 VerificationStore
```

### 10.5 Stale 规则

以下任一条件满足时，旧结果应视为 `stale = true`：

1. `manuscriptHash` 变化
2. 本地 `ReferenceEntry` 的 `title/authors/year/doi` 任一字段变化
3. citeKey 被删除或新增

允许实现简化为：

- 全量重跑后全部刷新 `stale = false`
- 未重跑前只要稿件变更就整体标记 stale

### 10.6 自动触发时机

在 `paperDraftTaskId` 对应任务完成后：

1. 静默调用 `verifyAllCitations()`
2. 写入 `.roo/reference-verification.json`
3. 通过 `postMessageToWebview` 同步到前端

### 10.7 手动触发时机

在 [`paperWritingMessageHandler.ts`](src/core/webview/paperWritingMessageHandler.ts:47) 的 `handlePaperWritingAction` 中新增：

- `"citationVerify"`
- `"dismissCitationIssue"`（如果本期顺手实现人工忽略）

---

## 十一、阶段 C：ReferencePanel 重构

### 11.1 设计目标

从“数据分类列表”改为“任务驱动诊断面板”。

优先级顺序固定为：

1. `likely_fabricated`
2. `missing`
3. `ambiguous`
4. `unverified`
5. `placeholder`
6. `skipped`

### 11.2 面板结构

1. Health Dashboard
2. Quick Actions
3. Needs Attention
4. Cited in Current Section
5. Library

### 11.3 Quick Actions 规则

| 按钮                            | 显示条件                   | 动作                  |
| ------------------------------- | -------------------------- | --------------------- |
| `Verify unverified citations`   | `unverified + skipped > 0` | 触发 `citationVerify` |
| `Fix flagged issues with Agent` | `suspect + missing > 0`    | 进入阶段 D            |

### 11.4 Needs Attention 规则

每个问题卡片必须显示：

- 问题类型
- 条目数量
- 条目列表
- 原因摘要
- 对应动作按钮

对于单条 citation，优先展示：

- `citeKey`
- `status`
- `reason`
- `confidence`
- 候选来源标题（若有）

### 11.5 人工裁决入口

对于 `ambiguous` 和 `likely_fabricated` 条目，UI 需要支持至少以下操作：

1. `Verify again`
2. `Fix with Agent`
3. `Dismiss`

如果本期不实现持久化 dismiss 按钮，也必须在文档中标注为二期；本 spec 推荐本期一并实现轻量版。

### 11.6 Library 区块

默认折叠。展开后显示：

- 搜索框
- 条目列表
- 验证状态
- 章节归属
- 单条验证入口
- `Generate .bib`
- `Import BibTeX`

### 11.7 Props 变更

```typescript
type ReferencePanelProps = {
	referenceEntries: any[]
	uncatalogued: any[]
	cited: string[] | null
	missing: string[] | null
	citationPlaceholderCount?: number
	bibGenerated: boolean
	bibPreview: string | null
	selectedSection?: string | null
	sectionContent?: string
	sectionInsight?: any
	embedded?: boolean
	verificationState?: VerificationStore
	sectionCiteMap?: Record<string, string[]>
	currentSection?: string
	onFixFlaggedCitations?: (entries: VerificationEntry[]) => void
	onVerifyCitation?: (citeKey: string) => void
	onVerifyAllCitations?: () => void
	onDismissCitationIssue?: (citeKey: string) => void
}
```

---

## 十二、阶段 D：人工修复闭环

### 12.1 入口

- Health Dashboard 的批量修复按钮
- Needs Attention 中每条问题的 `Fix with Agent`

### 12.2 Agent 修复 prompt 规范

应注入结构化信息，而不是仅传自然语言摘要：

```text
The following citations in the draft need attention.

- citeKey: smith2020unknown
  status: likely_fabricated
  reason: source-not-found
  localTitle: "Unknown paper title"
  confidence: 0.05
  action: remove the unsupported claim or replace it with a real source from the library

- citeKey: wang2023analysis
  status: ambiguous
  reason: doi-title-mismatch
  localTitle: "Climate Change Analysis"
  matchedTitle: "Climate Data Analysis"
  confidence: 0.52
  action: confirm whether this is the intended source; if not, revise the citation

Do not modify passages that are not related to the listed citation issues.
Do not fabricate new bibliographic metadata.
```

### 12.3 安全约束

1. 不自动执行无提示修稿
2. Agent 执行前要求用户确认
3. 不允许因 citation 异常直接批量删除正文

---

## 十三、端到端示例

### 13.1 示例 A：本地有 DOI，外部高匹配

输入：

```json
{
	"citeKey": "smith2024transformer",
	"local": {
		"title": "Transformer Models in Scientific Writing",
		"authors": ["Smith", "Jones"],
		"year": 2024,
		"doi": "10.1000/xyz123"
	},
	"crossref": {
		"title": "Transformer Models in Scientific Writing"
	}
}
```

输出：

```json
{
	"citeKey": "smith2024transformer",
	"status": "verified",
	"reason": "doi-match",
	"confidence": 1,
	"method": "doi-direct",
	"stale": false
}
```

### 13.2 示例 B：本地有 DOI，但标题冲突

输入：

```json
{
	"citeKey": "wang2023analysis",
	"local": {
		"title": "Climate Change Analysis",
		"doi": "10.2000/abc999"
	},
	"crossref": {
		"title": "Climate Data Analysis"
	},
	"similarity": 0.52
}
```

输出：

```json
{
	"citeKey": "wang2023analysis",
	"status": "likely_fabricated",
	"reason": "doi-title-mismatch",
	"confidence": 0.52,
	"method": "doi-direct",
	"stale": false
}
```

说明：

- 本示例用来固定“明显冲突”的实现口径
- 如果后续产品希望 0.52 归为 `ambiguous`，需同步修改阈值定义，不允许实现时自由发挥

### 13.3 示例 C：稿件用了 citeKey，但本地库没有

输入：

```json
{
	"citeKey": "jones2025madeup",
	"referenceEntries": []
}
```

输出：

```json
{
	"citeKey": "jones2025madeup",
	"status": "missing",
	"reason": "missing-local-entry",
	"confidence": 0,
	"method": "skipped",
	"stale": false
}
```

### 13.4 示例 D：本地只有 title，无 DOI，模糊搜索命中

输入：

```json
{
	"citeKey": "lee2021graph",
	"local": {
		"title": "Graph Neural Networks for Molecules",
		"authors": ["Lee"],
		"year": 2021
	},
	"bestMatch": {
		"source": "semantic-scholar",
		"title": "Graph Neural Networks for Molecules",
		"similarityScore": 0.93
	}
}
```

输出：

```json
{
	"citeKey": "lee2021graph",
	"status": "verified",
	"reason": "fuzzy-match",
	"confidence": 0.93,
	"method": "title-author-fuzzy",
	"stale": false
}
```

---

## 十四、测试要求

### 14.1 单元测试

`CitationVerifier` 至少覆盖：

1. 本地缺失 citeKey -> `missing`
2. DOI 高匹配 -> `verified`
3. DOI 中等匹配 -> `ambiguous`
4. DOI 低匹配 -> `likely_fabricated`
5. DOI 404 -> `likely_fabricated`
6. DOI 429 / 网络失败 -> `skipped`
7. 无 DOI 但 fuzzy 高匹配 -> `verified`
8. 无 DOI 且无 title -> `skipped`
9. 同一 citeKey 多次出现 -> 只验证一次
10. store 文件损坏 -> 自动重建

### 14.2 UI 测试

`ReferencePanel` 至少覆盖：

1. 全健康状态
2. 同时存在 `missing + ambiguous + placeholder`
3. `dismissedByUser = true` 条目不再出现在首屏重点问题
4. Quick Actions 按条件显示/隐藏
5. 点击 Dashboard 数字跳转到对应问题区块

### 14.3 集成测试

至少验证以下链路：

1. Agent 完成写稿 -> 自动触发验证 -> webview 收到状态
2. 点击 `Verify unverified citations` -> 手动重跑
3. 点击 `Fix with Agent` -> 生成结构化修复 prompt

---

## 十五、研发任务拆分

| 任务 | 内容                                                  | 类型      | 优先级 |
| ---- | ----------------------------------------------------- | --------- | ------ |
| T1   | Prompt 注入 `availableReferences`                     | 修改      | P0     |
| T2   | `handleDraftWithAgent` 按规则构造 reference 摘要      | 修改      | P0     |
| T3   | 新建 `CitationVerifier.ts`                            | 新建      | P0     |
| T4   | 支持 DOI 直查 + fuzzy 搜索 + store 持久化             | 新建      | P0     |
| T5   | `paperWritingMessageHandler.ts` 增加 `citationVerify` | 修改      | P0     |
| T6   | 写作任务完成后自动触发验证                            | 修改      | P0     |
| T7   | `ReferencePanel` 改造为诊断看板                       | 重写      | P1     |
| T8   | `ExtensionStateContext` 增加 verification state       | 修改      | P1     |
| T9   | 支持 `getSectionCiteMap` / `getCiteLineLocations`     | 新建/修改 | P1     |
| T10  | Agent 修复闭环                                        | 修改      | P2     |
| T11  | `dismiss citation issue` 人工裁决                     | 修改      | P2     |

建议分阶段：

| Phase   | 内容    | 交付结果                 |
| ------- | ------- | ------------------------ |
| Phase 1 | T1-T6   | 写前感知库、写后自动验证 |
| Phase 2 | T7-T9   | 引用诊断面板上线         |
| Phase 3 | T10-T11 | Agent 修复与人工裁决闭环 |

---

## 十六、边界条件

| 场景                               | 处理方式                                      |
| ---------------------------------- | --------------------------------------------- |
| 离线/无网络                        | 标记 `skipped + network-error`，不阻塞工作流  |
| CrossRef 429                       | 退避重试 3 次，仍失败则 `skipped`             |
| DOI 格式无效                       | 规范化后仍无效则按无 DOI 处理                 |
| 引用数 > 50                        | 去重后分批验证                                |
| 同一 citeKey 多次 `\cite{}`        | 只验证一次                                    |
| `reference-verification.json` 损坏 | 自动重建空 store                              |
| library 为空                       | Dashboard 允许显示 0，缺失问题正常展示        |
| 用户已 dismiss                     | 不在首屏 Needs Attention 高亮，但可在详情查看 |

---

## 十七、验收标准

本 spec 完成后，代码实现应满足：

1. Agent 在写稿 prompt 中可以看到项目已有 reference 摘要
2. 写稿结束后可自动得到结构化 verification store
3. `ReferencePanel` 能按优先级展示 citation 问题
4. 验证失败时能区分 `missing / ambiguous / likely_fabricated / skipped`
5. 用户可以重新验证，且不会因网络异常被误标成 fabricated
6. 整个实现不破坏现有 reference library 和 `.bib` 生成流程

如果大模型实现与本文档冲突，应优先修正文档不清晰处，再实现，不要靠猜。
