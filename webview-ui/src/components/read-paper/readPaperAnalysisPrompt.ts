export const DEFAULT_READPAPER_ANALYSIS_MODE = "standard"
export const DEFAULT_READPAPER_ANALYSIS_OUTPUT_DIR = "reference/analysis/"

export type ReadPaperAnalysisMode = "quick" | "standard" | "extended" | "presentation" | "presentation_with_figures"

export type ReadPaperAnalysisPromptInput = {
	pdfPaths: string[]
	outputDir?: string
	mode?: ReadPaperAnalysisMode
}

export function normalizePdfAnalysisPaths(paths: string[]): string[] {
	const seen = new Set<string>()
	const normalized: string[] = []

	for (const path of paths) {
		const trimmed = path.trim()
		const key = trimmed.toLowerCase()
		if (!trimmed || !key.endsWith(".pdf") || seen.has(key)) {
			continue
		}
		seen.add(key)
		normalized.push(trimmed)
	}

	return normalized
}

export function buildReadPaperAnalysisPrompt(input: ReadPaperAnalysisPromptInput): string {
	const pdfPaths = normalizePdfAnalysisPaths(input.pdfPaths)
	const outputDir = input.outputDir?.trim() || DEFAULT_READPAPER_ANALYSIS_OUTPUT_DIR
	const mode = input.mode || DEFAULT_READPAPER_ANALYSIS_MODE
	const pdfList = pdfPaths.length > 0 ? pdfPaths.map((path) => `- ${path}`).join("\n") : "- [未选择 PDF]"

	return [
		"请使用项目本地 skill `.roo/skills/paper-analyst` 分析以下 PDF，并为每篇论文生成 Markdown 文档。",
		"",
		"PDF 列表：",
		pdfList,
		"",
		"输出目录：",
		outputDir,
		"",
		"分析模式：",
		mode,
		"",
		"要求：",
		"1. 默认中文输出。",
		"2. 先判断 PDF 质量：良好 / 降级处理 / 严重降级。",
		"3. 先判断论文类型，不要默认是 AI/ML。",
		"4. 所有贡献、结论、方法判断必须标注 [原文声明] 或 [模型归纳]。",
		"5. 缺失信息写 [未明确给出]，不允许编造。",
		"6. 每篇论文生成一个 Markdown：`<输出目录>/<pdf-name>.md`。",
		"7. 批量结束后生成 `<输出目录>/index.md`，列出每篇论文的标题、路径、质量状态、核心结论。",
	].join("\n")
}
