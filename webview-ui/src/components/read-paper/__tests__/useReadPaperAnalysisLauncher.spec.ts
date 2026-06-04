import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
	READPAPER_ANALYSIS_AUTO_APPROVAL_CONFIGURATION,
	resolveReadPaperAnalysisWorkspacePath,
	useReadPaperAnalysisLauncher,
} from "../useReadPaperAnalysisLauncher"

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("useReadPaperAnalysisLauncher", () => {
	it("resolves the analysis workspace from selected reference PDFs when cwd points elsewhere", () => {
		expect(
			resolveReadPaperAnalysisWorkspacePath(
				"C:\\Users\\Lenovo\\BaiduSyncdisk\\ZTC26-VibeResearch\\Github\\Sci-Roo",
				["D:\\BaiduSyncdisk\\ZTC26-VibeResearch\\Github\\Sci-Roo\\reference\\yang2026effective.pdf"],
			),
		).toBe("D:/BaiduSyncdisk/ZTC26-VibeResearch/Github/Sci-Roo")
	})

	it("opens ReadPaper PDF analysis as an auto-run non-interactive task", () => {
		const onOpenAnalysisChat = vi.fn()
		const { result } = renderHook(() =>
			useReadPaperAnalysisLauncher({
				cwd: "D:\\BaiduSyncdisk\\ZTC26-VibeResearch\\Github\\Sci-Roo",
				onOpenAnalysisChat,
			}),
		)

		act(() => {
			result.current.setPrompt("Analyze the selected PDFs")
		})

		act(() => {
			result.current.openChat()
		})

		expect(onOpenAnalysisChat).toHaveBeenCalledTimes(1)
		expect(onOpenAnalysisChat).toHaveBeenCalledWith({
			mode: "sci-lit-review",
			prompt: "Analyze the selected PDFs",
			workspacePath: "D:\\BaiduSyncdisk\\ZTC26-VibeResearch\\Github\\Sci-Roo",
			autoRun: true,
			nonInteractive: true,
			autoApprovalConfiguration: READPAPER_ANALYSIS_AUTO_APPROVAL_CONFIGURATION,
		})
		expect(READPAPER_ANALYSIS_AUTO_APPROVAL_CONFIGURATION).toMatchObject({
			autoApprovalEnabled: true,
			alwaysAllowReadOnly: true,
			alwaysAllowWrite: true,
			alwaysAllowExecute: true,
			allowedCommands: ["*"],
			deniedCommands: [],
			alwaysAllowFollowupQuestions: true,
		})
		expect(READPAPER_ANALYSIS_AUTO_APPROVAL_CONFIGURATION.followupAutoApproveTimeoutMs).toBeGreaterThan(0)
	})
})
