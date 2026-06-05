import * as fs from "fs/promises"
import * as path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import * as vscode from "vscode"

import type { PaperProject } from "@roo-code/types"

import type { ClineProvider } from "../../core/webview/ClineProvider"

const execAsync = promisify(exec)

export type PaperWorkspaceState = {
	manuscript: {
		relativePath: string | null | undefined
		absolutePath: string | null | undefined
		pdfAbsolutePath: string | null
		pdfRelativePath: string | null
		exists: boolean
		wordCount: number
		lastEdited: string | null
		missingCitationCount: number
		citationPlaceholderCount: number
		citationCount: number
		hasBibliographyFile: boolean
		hasPdf: boolean
		status: "missing" | "empty" | "drafting" | "ready-for-review"
		outline: Array<{
			id: string
			level: 1 | 2 | 3
			title: string
			line: number
		}>
		currentHeading: string | null
	}
	assets: {
		paperPlanReady: boolean
		researchQuestionsReady: boolean
		revisionLog: {
			exists: boolean
			openItems: number
			checklistOpen: number
		}
	}
	editorContext: {
		filePath: string | null
		languageId: string | null
		inProject: boolean
		onPrimaryManuscript: boolean
		hasSelection: boolean
		selectionWordCount: number
	}
	git: {
		available: boolean
		branch: string | null
		hasChanges: boolean
		changedFiles: number
		stagedFiles: number
		unstagedFiles: number
		untrackedFiles: number
		ahead: number
		behind: number
	}
	checks: Array<{
		id: string
		label: string
		severity: "info" | "warning" | "ready"
	}>
	recommendedAction: string
}

export async function buildPaperWorkspaceState(
	provider: ClineProvider,
	project: PaperProject | undefined,
	options: {
		missingCitationKeys?: string[]
		citedKeys?: string[]
	} = {},
): Promise<PaperWorkspaceState | null> {
	if (!project) {
		return null
	}

	const paperProjectManager = provider.getPaperProjectManager()
	const manuscriptPath = paperProjectManager?.getPrimaryManuscriptAbsolutePath(project)
	const relativePath = paperProjectManager?.getPrimaryManuscriptRelativePath(project)
	const bibliographyPath = path.join(project.rootPath, "latex", "references.bib")
	const paperPlanPath = path.join(project.rootPath, "task", "paper-plan.md")
	const researchQuestionsPath = path.join(project.rootPath, "problem", "research-questions.md")
	const revisionLogPath = path.join(project.rootPath, "review", "revision-log.md")

	const editor = vscode.window.activeTextEditor
	const editorFilePath = editor?.document.uri.fsPath ?? null
	const selectionText = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection).trim() : ""
	const editorInProject = !!editorFilePath && editorFilePath.startsWith(project.rootPath)
	const editorOnPrimaryManuscript =
		!!editorFilePath && !!manuscriptPath && path.normalize(editorFilePath) === path.normalize(manuscriptPath)
	const editorLine = editor ? editor.selection.active.line + 1 : null

	let wordCount = 0
	let lastEdited: string | null = null
	let exists = false
	let manuscriptContent = ""
	if (manuscriptPath) {
		try {
			const [content, stat] = await Promise.all([fs.readFile(manuscriptPath, "utf-8"), fs.stat(manuscriptPath)])
			manuscriptContent = content
			wordCount = countLatexWords(content)
			lastEdited = stat.mtime.toISOString()
			exists = true
		} catch {
			// Manuscript file may not exist yet.
		}
	}
	const outline = parseLatexOutline(manuscriptContent)
	const currentHeading = editorOnPrimaryManuscript && editorLine ? getCurrentHeading(outline, editorLine) : null

	const preferredPdfPath = await paperProjectManager?.getPreferredPdfAbsolutePath(project)
	const pdfRelativePath = preferredPdfPath ? path.relative(project.rootPath, preferredPdfPath) : null

	const [hasBibliographyFile, hasPdf, gitStatus, paperPlanReady, researchQuestionsReady, revisionLog] =
		await Promise.all([
			fileExists(bibliographyPath),
			preferredPdfPath ? fileExists(preferredPdfPath) : Promise.resolve(false),
			getGitWorkspaceStatus(project.rootPath),
			hasMeaningfulMarkdownContent(paperPlanPath, "Paper Plan"),
			hasMeaningfulMarkdownContent(researchQuestionsPath, "Research Questions"),
			readRevisionLogStatus(revisionLogPath),
		])

	const missingCitationCount = options.missingCitationKeys?.length ?? 0
	const citationPlaceholderCount = countCitationPlaceholders(manuscriptContent)
	const citationCount = options.citedKeys?.length ?? 0
	const manuscriptStatus = !exists
		? "missing"
		: wordCount === 0
			? "empty"
			: missingCitationCount > 0 || citationPlaceholderCount > 0
				? "drafting"
				: "ready-for-review"

	return {
		manuscript: {
			relativePath,
			absolutePath: manuscriptPath,
			pdfAbsolutePath: preferredPdfPath ?? null,
			pdfRelativePath,
			exists,
			wordCount,
			lastEdited,
			missingCitationCount,
			citationPlaceholderCount,
			citationCount,
			hasBibliographyFile,
			hasPdf,
			status: manuscriptStatus,
			outline,
			currentHeading,
		},
		assets: {
			paperPlanReady,
			researchQuestionsReady,
			revisionLog,
		},
		editorContext: {
			filePath: editorFilePath,
			languageId: editor?.document.languageId ?? null,
			inProject: editorInProject,
			onPrimaryManuscript: editorOnPrimaryManuscript,
			hasSelection: selectionText.length > 0,
			selectionWordCount: selectionText ? selectionText.split(/\s+/).length : 0,
		},
		git: gitStatus,
		checks: buildChecks({
			manuscriptExists: exists,
			wordCount,
			missingCitationCount,
			citationPlaceholderCount,
			hasBibliographyFile,
			hasPdf,
			gitStatus,
			paperPlanReady,
			researchQuestionsReady,
			revisionLog,
		}),
		recommendedAction: buildRecommendedAction({
			editorOnPrimaryManuscript,
			hasSelection: selectionText.length > 0,
			manuscriptExists: exists,
			wordCount,
			missingCitationCount,
			citationPlaceholderCount,
			hasPdf,
			gitHasChanges: gitStatus.hasChanges,
			currentHeading,
		}),
	}
}

export function countLatexWords(text: string): number {
	const stripped = text
		.replace(/\\\w+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
		.replace(/\\begin\{[^}]*\}/g, " ")
		.replace(/\\end\{[^}]*\}/g, " ")
		.replace(/%[^\n]*/g, " ")
		.replace(/\s+/g, " ")
		.trim()
	return stripped ? stripped.split(/\s+/).length : 0
}

export function countCitationPlaceholders(text: string): number {
	return (text.match(/\[CITATION NEEDED(?::[^\]]+)?\]/g) ?? []).length
}

async function fileExists(targetPath: string): Promise<boolean> {
	try {
		await fs.access(targetPath)
		return true
	} catch {
		return false
	}
}

async function hasMeaningfulMarkdownContent(filePath: string, defaultHeading: string): Promise<boolean> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const normalized = content.replace(/\r/g, "").trim()
		if (!normalized) {
			return false
		}
		if (normalized === `# ${defaultHeading}`) {
			return false
		}
		return normalized.split("\n").length > 1 || normalized.length > defaultHeading.length + 4
	} catch {
		return false
	}
}

async function readRevisionLogStatus(filePath: string): Promise<PaperWorkspaceState["assets"]["revisionLog"]> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const openItems = (content.match(/Status:\s*open/gi) ?? []).length
		const checklistOpen = (content.match(/^- \[ \]/gm) ?? []).length
		return {
			exists: true,
			openItems,
			checklistOpen,
		}
	} catch {
		return {
			exists: false,
			openItems: 0,
			checklistOpen: 0,
		}
	}
}

async function getGitWorkspaceStatus(rootPath: string): Promise<PaperWorkspaceState["git"]> {
	try {
		const { stdout } = await execAsync("git status --short --branch", { cwd: rootPath })
		const lines = stdout.split(/\r?\n/).filter(Boolean)
		const branchLine = lines[0] ?? ""
		const fileLines = lines.slice(1)

		let branch: string | null = null
		let ahead = 0
		let behind = 0

		const branchMatch = branchLine.match(/^##\s+([^\s.]+)(?:\.\.\.[^\s]+)?(?:\s+\[(.+)\])?/)
		if (branchMatch) {
			branch = branchMatch[1]
			const statusSuffix = branchMatch[2] ?? ""
			const aheadMatch = statusSuffix.match(/ahead\s+(\d+)/)
			const behindMatch = statusSuffix.match(/behind\s+(\d+)/)
			ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0
			behind = behindMatch ? parseInt(behindMatch[1], 10) : 0
		}

		let stagedFiles = 0
		let unstagedFiles = 0
		let untrackedFiles = 0

		for (const line of fileLines) {
			if (line.startsWith("??")) {
				untrackedFiles += 1
				continue
			}
			const staged = line[0] && line[0] !== " "
			const unstaged = line[1] && line[1] !== " "
			if (staged) {
				stagedFiles += 1
			}
			if (unstaged) {
				unstagedFiles += 1
			}
		}

		return {
			available: true,
			branch,
			hasChanges: fileLines.length > 0,
			changedFiles: fileLines.length,
			stagedFiles,
			unstagedFiles,
			untrackedFiles,
			ahead,
			behind,
		}
	} catch {
		return {
			available: false,
			branch: null,
			hasChanges: false,
			changedFiles: 0,
			stagedFiles: 0,
			unstagedFiles: 0,
			untrackedFiles: 0,
			ahead: 0,
			behind: 0,
		}
	}
}

function buildRecommendedAction(input: {
	editorOnPrimaryManuscript: boolean
	hasSelection: boolean
	manuscriptExists: boolean
	wordCount: number
	missingCitationCount: number
	citationPlaceholderCount: number
	hasPdf: boolean
	gitHasChanges: boolean
	currentHeading: string | null
}): string {
	if (!input.manuscriptExists) {
		return "Open the main manuscript to start drafting in the editor."
	}
	if (!input.editorOnPrimaryManuscript) {
		return "Jump back into main.tex so Sci-Roo can assist the exact passage you are writing."
	}
	if (input.hasSelection) {
		return "Use the editor right-click menu to polish or translate the selected passage."
	}
	if (input.wordCount < 120) {
		return "Keep drafting in the main manuscript before worrying about tooling or submission checks."
	}
	if (input.citationPlaceholderCount > 0) {
		return `Choose sources for ${input.citationPlaceholderCount} citation placeholder${input.citationPlaceholderCount > 1 ? "s" : ""} before the next revision or submission pass.`
	}
	if (input.currentHeading && input.missingCitationCount === 0 && !input.hasPdf) {
		return `Continue drafting in ${input.currentHeading}, then run a LaTeX Workshop build to inspect the latest PDF.`
	}
	if (input.missingCitationCount > 0) {
		return "Resolve missing citation keys before the next revision or build pass."
	}
	if (!input.hasPdf) {
		return "Run a LaTeX Workshop build to generate the current PDF and inspect the latest draft."
	}
	if (input.gitHasChanges) {
		return "Review your working tree in Source Control and snapshot or commit when this writing checkpoint feels stable."
	}
	return "The manuscript looks healthy. Keep drafting or prepare the next revision pass."
}

function buildChecks(input: {
	manuscriptExists: boolean
	wordCount: number
	missingCitationCount: number
	citationPlaceholderCount: number
	hasBibliographyFile: boolean
	hasPdf: boolean
	gitStatus: PaperWorkspaceState["git"]
	paperPlanReady: boolean
	researchQuestionsReady: boolean
	revisionLog: PaperWorkspaceState["assets"]["revisionLog"]
}): PaperWorkspaceState["checks"] {
	const checks: PaperWorkspaceState["checks"] = []

	if (!input.manuscriptExists) {
		checks.push({ id: "manuscript-missing", label: "Main manuscript file is missing.", severity: "warning" })
	} else if (input.wordCount < 120) {
		checks.push({ id: "manuscript-short", label: "Main manuscript is still very short.", severity: "info" })
	}

	if (input.missingCitationCount > 0) {
		checks.push({
			id: "missing-citations",
			label: `${input.missingCitationCount} cite key${input.missingCitationCount > 1 ? "s point to missing library entries" : " points to a missing library entry"}.`,
			severity: "warning",
		})
	}

	if (input.citationPlaceholderCount > 0) {
		checks.push({
			id: "citation-placeholders",
			label: `${input.citationPlaceholderCount} [CITATION NEEDED] placeholder${input.citationPlaceholderCount > 1 ? "s still need source decisions" : " still needs a source decision"}.`,
			severity: "warning",
		})
	}

	if (!input.hasBibliographyFile) {
		checks.push({ id: "missing-bib", label: "references.bib is missing.", severity: "warning" })
	}

	if (!input.hasPdf) {
		checks.push({ id: "missing-pdf", label: "No compiled PDF yet. Run a LaTeX build.", severity: "info" })
	}

	if (!input.paperPlanReady) {
		checks.push({ id: "paper-plan", label: "Paper plan is still empty.", severity: "info" })
	}

	if (!input.researchQuestionsReady) {
		checks.push({
			id: "research-questions",
			label: "Research questions file still needs content.",
			severity: "info",
		})
	}

	if (!input.revisionLog.exists) {
		checks.push({ id: "revision-log", label: "Revision log is missing.", severity: "info" })
	} else if (input.revisionLog.openItems > 0 || input.revisionLog.checklistOpen > 0) {
		checks.push({
			id: "revision-open",
			label: `${input.revisionLog.openItems + input.revisionLog.checklistOpen} revision item${input.revisionLog.openItems + input.revisionLog.checklistOpen > 1 ? "s remain open" : " remains open"}.`,
			severity: "info",
		})
	}

	if (input.gitStatus.available && input.gitStatus.hasChanges) {
		checks.push({
			id: "git-dirty",
			label: `${input.gitStatus.changedFiles} file${input.gitStatus.changedFiles > 1 ? "s" : ""} changed in the working tree.`,
			severity: "info",
		})
	}

	if (checks.length === 0) {
		checks.push({ id: "healthy", label: "Workspace checks look healthy.", severity: "ready" })
	}

	return checks
}

function parseLatexOutline(content: string): PaperWorkspaceState["manuscript"]["outline"] {
	if (!content.trim()) {
		return []
	}

	const outline: PaperWorkspaceState["manuscript"]["outline"] = []
	const lines = content.split(/\r?\n/)
	const headingPatterns: Array<{ level: 1 | 2 | 3; pattern: RegExp }> = [
		{ level: 1, pattern: /\\section\*?\{([^}]+)\}/ },
		{ level: 2, pattern: /\\subsection\*?\{([^}]+)\}/ },
		{ level: 3, pattern: /\\subsubsection\*?\{([^}]+)\}/ },
	]

	lines.forEach((rawLine, index) => {
		const line = stripLatexComment(rawLine).trim()
		if (!line) {
			return
		}

		for (const heading of headingPatterns) {
			const match = line.match(heading.pattern)
			if (match?.[1]) {
				const title = match[1].trim()
				outline.push({
					id: `${heading.level}-${index + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
					level: heading.level,
					title,
					line: index + 1,
				})
				return
			}
		}
	})

	return outline
}

function getCurrentHeading(outline: PaperWorkspaceState["manuscript"]["outline"], lineNumber: number): string | null {
	if (!outline.length) {
		return null
	}

	let activeHeading: string | null = null
	for (const item of outline) {
		if (item.line <= lineNumber) {
			activeHeading = item.title
			continue
		}
		break
	}
	return activeHeading
}

function stripLatexComment(line: string): string {
	let result = ""
	for (let i = 0; i < line.length; i++) {
		const char = line[i]
		if (char === "%" && line[i - 1] !== "\\") {
			break
		}
		result += char
	}
	return result
}
