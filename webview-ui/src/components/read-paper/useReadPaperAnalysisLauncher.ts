import { useCallback, useEffect, useMemo, useState } from "react"
import { useEvent } from "react-use"
import type { ExtensionMessage, RooCodeSettings } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import {
	DEFAULT_READPAPER_ANALYSIS_MODE,
	DEFAULT_READPAPER_ANALYSIS_OUTPUT_DIR,
	buildReadPaperAnalysisPrompt,
	normalizePdfAnalysisPaths,
	type ReadPaperAnalysisMode,
} from "./readPaperAnalysisPrompt"

export const READPAPER_ANALYSIS_AUTO_APPROVAL_CONFIGURATION: RooCodeSettings = {
	autoApprovalEnabled: true,
	alwaysAllowReadOnly: true,
	alwaysAllowReadOnlyOutsideWorkspace: false,
	alwaysAllowWrite: true,
	alwaysAllowWriteOutsideWorkspace: false,
	alwaysAllowWriteProtected: false,
	alwaysAllowExecute: true,
	allowedCommands: ["*"],
	deniedCommands: [],
	alwaysAllowMcp: true,
	alwaysAllowModeSwitch: true,
	alwaysAllowSubtasks: true,
	alwaysAllowFollowupQuestions: true,
	followupAutoApproveTimeoutMs: 1,
	allowedMaxRequests: null,
	allowedMaxCost: null,
}

export type ReadPaperAnalysisChatOpenOptions = {
	mode: string
	prompt: string
	workspacePath?: string
	autoRun?: boolean
	nonInteractive?: boolean
	autoApprovalConfiguration?: RooCodeSettings
}

export type ReadPaperAnalysisChatOpener = (options: ReadPaperAnalysisChatOpenOptions) => void

function normalizeComparablePath(value: string): string {
	return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
}

function isPathInsideWorkspace(filePath: string, workspacePath: string): boolean {
	const normalizedFile = normalizeComparablePath(filePath)
	const normalizedWorkspace = normalizeComparablePath(workspacePath)
	return normalizedFile === normalizedWorkspace || normalizedFile.startsWith(`${normalizedWorkspace}/`)
}

function inferWorkspacePathFromReferencePdf(pdfPaths: string[]): string | undefined {
	for (const pdfPath of pdfPaths) {
		const normalized = pdfPath.replace(/\\/g, "/")
		const referenceIndex = normalized.toLowerCase().lastIndexOf("/reference/")
		if (referenceIndex > 0) {
			return normalized.slice(0, referenceIndex)
		}
	}

	return undefined
}

export function resolveReadPaperAnalysisWorkspacePath(cwd: string | undefined, pdfPaths: string[]): string | undefined {
	const trimmedCwd = cwd?.trim()
	const inferredWorkspacePath = inferWorkspacePathFromReferencePdf(pdfPaths)
	if (!trimmedCwd) {
		return inferredWorkspacePath
	}

	if (inferredWorkspacePath && !pdfPaths.every((pdfPath) => isPathInsideWorkspace(pdfPath, trimmedCwd))) {
		return inferredWorkspacePath
	}

	return trimmedCwd
}

export function useReadPaperAnalysisLauncher({
	cwd,
	onOpenAnalysisChat,
}: {
	cwd?: string
	onOpenAnalysisChat?: ReadPaperAnalysisChatOpener
}) {
	const [pdfPaths, setPdfPaths] = useState<string[]>([])
	const [outputDir, setOutputDir] = useState(DEFAULT_READPAPER_ANALYSIS_OUTPUT_DIR)
	const [mode, setMode] = useState<ReadPaperAnalysisMode>(DEFAULT_READPAPER_ANALYSIS_MODE)
	const [prompt, setPrompt] = useState("")
	const isOpen = pdfPaths.length > 0

	const computedPrompt = useMemo(
		() => buildReadPaperAnalysisPrompt({ pdfPaths, outputDir, mode }),
		[pdfPaths, outputDir, mode],
	)

	useEffect(() => {
		if (isOpen) {
			setPrompt(computedPrompt)
		}
	}, [computedPrompt, isOpen])

	useEvent(
		"message",
		useCallback((event: MessageEvent) => {
			const message: ExtensionMessage = event.data
			if (message.type !== "readPaperAnalysisPdfsSelected") return

			const nextPdfPaths = normalizePdfAnalysisPaths(message.values?.pdfPaths ?? [])
			setPdfPaths(nextPdfPaths)
		}, []),
	)

	const selectPdfs = useCallback(
		(initialPaths?: string[]) => {
			vscode.postMessage({
				type: "readPaperSelectAnalysisPdfs",
				values: {
					cwd,
					initialPaths,
				},
			} as any)
		},
		[cwd],
	)

	const close = useCallback(() => {
		setPdfPaths([])
	}, [])

	const openChat = useCallback(() => {
		if (!prompt.trim()) return

		onOpenAnalysisChat?.({
			mode: "sci-lit-review",
			prompt,
			workspacePath: resolveReadPaperAnalysisWorkspacePath(cwd, pdfPaths),
			autoRun: true,
			nonInteractive: true,
			autoApprovalConfiguration: READPAPER_ANALYSIS_AUTO_APPROVAL_CONFIGURATION,
		})
		close()
	}, [close, cwd, onOpenAnalysisChat, pdfPaths, prompt])

	return {
		isOpen,
		pdfPaths,
		outputDir,
		mode,
		prompt,
		setOutputDir,
		setMode,
		setPrompt,
		selectPdfs,
		close,
		openChat,
	}
}
