import { describe, expect, it } from "vitest"

import {
	DEFAULT_READPAPER_ANALYSIS_MODE,
	DEFAULT_READPAPER_ANALYSIS_OUTPUT_DIR,
	buildReadPaperAnalysisPrompt,
	normalizePdfAnalysisPaths,
} from "../readPaperAnalysisPrompt"

describe("readPaperAnalysisPrompt", () => {
	it("builds a Chinese paper-analyst prompt for batch PDF analysis", () => {
		const prompt = buildReadPaperAnalysisPrompt({
			pdfPaths: ["D:\\papers\\a.pdf", "D:\\papers\\b.pdf"],
		})

		expect(prompt).toContain("项目本地 skill `.roo/skills/paper-analyst`")
		expect(prompt).toContain("D:\\papers\\a.pdf")
		expect(prompt).toContain("D:\\papers\\b.pdf")
		expect(prompt).toContain(`输出目录：\n${DEFAULT_READPAPER_ANALYSIS_OUTPUT_DIR}`)
		expect(prompt).toContain(`分析模式：\n${DEFAULT_READPAPER_ANALYSIS_MODE}`)
		expect(prompt).toContain("[原文声明]")
		expect(prompt).toContain("[模型归纳]")
		expect(prompt).toContain("`<输出目录>/<pdf-name>.md`")
		expect(prompt).toContain("`<输出目录>/index.md`")
	})

	it("deduplicates PDF paths and drops non-PDF values", () => {
		expect(normalizePdfAnalysisPaths(["D:\\papers\\a.pdf", "D:\\papers\\a.pdf", "D:\\notes\\a.txt", ""])).toEqual([
			"D:\\papers\\a.pdf",
		])
	})
})
