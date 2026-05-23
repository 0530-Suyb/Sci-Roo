import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type {
	SectionType,
	SectionConfig,
	PaperWritingState,
	SnapshotMeta,
	SectionWorkflowStatus,
} from "@roo-code/types"
import { getVenueTemplate } from "./paperConfig"

/**
 * Manages latex/ — section file I/O, AI writing prompt assembly,
 * word count tracking, paper snapshots, and Markdown export.
 */
export class PaperSectionManager {
	private providerRef: WeakRef<ClineProvider>

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	private get provider(): ClineProvider | undefined {
		return this.providerRef.deref()
	}

	private get cwd(): string | undefined {
		return this.provider?.getPaperProjectManager()?.getProjectRoot() ?? this.provider?.cwd
	}

	// ─── Path Helpers ──────────────────────────────────────────────────

	private getSectionsDir(): string {
		const cwd = this.cwd
		if (!cwd) throw new Error("No workspace directory")
		return path.join(cwd, "latex", "sections")
	}

	private sectionPath(sectionType: SectionType): string {
		return path.join(this.getSectionsDir(), `${sectionType}.tex`)
	}

	private getSnapshotsDir(): string {
		const cwd = this.cwd!
		return path.join(cwd, "latex", "snapshots")
	}

	// ─── Section File I/O ──────────────────────────────────────────────

	async loadSection(sectionType: SectionType): Promise<{ content: string; wordCount: number }> {
		const filePath = this.sectionPath(sectionType)
		try {
			const content = await fs.readFile(filePath, "utf-8")
			return { content, wordCount: this.countWords(content) }
		} catch {
			return { content: "", wordCount: 0 }
		}
	}

	async saveSection(sectionType: SectionType, content: string): Promise<void> {
		const dir = this.getSectionsDir()
		await fs.mkdir(dir, { recursive: true })
		await fs.writeFile(this.sectionPath(sectionType), content, "utf-8")
	}

	// ─── Section CRUD ─────────────────────────────────────────────────────

	async addSection(sectionType: SectionType, label: string): Promise<void> {
		const dir = this.getSectionsDir()
		await fs.mkdir(dir, { recursive: true })
		const filePath = this.sectionPath(sectionType)
		const placeholder = `% ${label}
% Custom section added by user.
`
		await fs.writeFile(filePath, placeholder, "utf-8")
	}

	async deleteSection(sectionType: SectionType): Promise<void> {
		const filePath = this.sectionPath(sectionType)
		try {
			await fs.unlink(filePath)
		} catch {
			// File doesn't exist, skip
		}
	}

	async renameSection(sectionType: SectionType, newLabel: string): Promise<void> {
		const filePath = this.sectionPath(sectionType)
		try {
			let content = await fs.readFile(filePath, "utf-8")
			content = content.replace(/^% .+$/m, `% ${newLabel}`)
			await fs.writeFile(filePath, content, "utf-8")
		} catch {
			// File doesn't exist yet, skip
		}
	}

	async loadAllSections(templateId: string): Promise<Map<SectionType, { content: string; wordCount: number }>> {
		const configs = this.getEffectiveSectionConfigs(templateId)
		const result = new Map<SectionType, { content: string; wordCount: number }>()
		for (const cfg of configs) {
			result.set(cfg.type, await this.loadSection(cfg.type))
		}
		return result
	}

	// ─── Word Count ────────────────────────────────────────────────────

	countWords(text: string): number {
		// Strip LaTeX commands and environments
		const stripped = text
			.replace(/\\\w+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ") // Commands
			.replace(/\\begin\{[^}]*\}/g, " ") // \begin{...}
			.replace(/\\end\{[^}]*\}/g, " ") // \end{...}
			.replace(/%[^\n]*/g, " ") // Comments
			.replace(/\s+/g, " ")
			.trim()
		return stripped ? stripped.split(/\s+/).length : 0
	}

	async getWritingState(templateId: string): Promise<PaperWritingState> {
		const configs = this.getEffectiveSectionConfigs(templateId)
		let totalWords = 0
		let targetWords = 0
		let citationCount = 0
		let figureCount = 0
		let tableCount = 0
		let latestEditedAt: string | undefined
		const sectionStatus = {} as Record<SectionType, SectionWorkflowStatus>

		for (const cfg of configs) {
			const { content, wordCount } = await this.loadSection(cfg.type)
			const editedAt = await this.getSectionLastEditedAt(cfg.type)
			totalWords += wordCount
			if (cfg.targetWordRange) {
				targetWords += cfg.targetWordRange[1]
			}
			citationCount += this.extractCitationKeys(content).length
			figureCount += this.countMatches(content, /\\ref\{fig:[^}]+\}/g)
			tableCount += this.countMatches(content, /\\ref\{tab:[^}]+\}/g)
			sectionStatus[cfg.type] = this.getSectionWorkflowStatus(cfg.type, content)
			if (editedAt && (!latestEditedAt || editedAt > latestEditedAt)) {
				latestEditedAt = editedAt
			}
		}

		return {
			currentSection: undefined,
			sectionStatus,
			totalWords,
			targetWords,
			citationCount,
			figureCount,
			tableCount,
			lastEdited: latestEditedAt ?? new Date().toISOString(),
		}
	}

	async getSectionInsights(
		templateId: string,
		missingCitationKeys: string[] = [],
	): Promise<
		Record<
			string,
			{
				type: SectionType
				label: string
				status: SectionWorkflowStatus
				readiness: "blocked" | "needs-work" | "ready"
				issues: string[]
				nextStep: string
				citationCount: number
				missingCitationCount: number
				hasFigureRef: boolean
				hasTableRef: boolean
				lastEditedAt?: string
			}
		>
	> {
		const configs = this.getEffectiveSectionConfigs(templateId)
		const missingSet = new Set(missingCitationKeys)
		const result: Record<string, any> = {}

		for (const cfg of configs) {
			const { content, wordCount } = await this.loadSection(cfg.type)
			const editedAt = await this.getSectionLastEditedAt(cfg.type)
			const status = this.getSectionWorkflowStatus(cfg.type, content)
			const citationKeys = this.extractCitationKeys(content)
			const missingInSection = citationKeys.filter((key) => missingSet.has(key))
			const hasFigureRef = /\\ref\{fig:[^}]+\}/.test(content)
			const hasTableRef = /\\ref\{tab:[^}]+\}/.test(content)
			const issues: string[] = []
			let readiness: "blocked" | "needs-work" | "ready" = "ready"
			let nextStep =
				"Polish the wording, cross-check adjacent sections, and keep this section moving with the paper."

			if (!content.trim()) {
				readiness = "blocked"
				issues.push("blank")
				nextStep = "Start with a scaffold or rough argument so this section is no longer empty."
			}

			if (cfg.targetWordRange && wordCount > cfg.targetWordRange[1]) {
				readiness = "needs-work"
				issues.push("over-limit")
				nextStep = "Trim this section before the manuscript loses page budget."
			}

			if (cfg.targetWordRange && wordCount > 0 && wordCount < cfg.targetWordRange[0]) {
				readiness = readiness === "blocked" ? readiness : "needs-work"
				issues.push("under-target")
				nextStep = "Add the missing rationale, evidence, or interpretation before polishing prose."
			}

			if (missingInSection.length > 0) {
				readiness = readiness === "blocked" ? readiness : "needs-work"
				issues.push("missing-citations")
				nextStep = `Resolve missing cite keys in ${cfg.label} before the next revision pass.`
			}

			if (
				["abstract", "introduction", "related-work", "methods", "results", "discussion"].includes(cfg.type) &&
				wordCount > 120 &&
				citationKeys.length === 0
			) {
				readiness = readiness === "blocked" ? readiness : "needs-work"
				issues.push("no-citations")
				nextStep = "Add citation support so the claims in this section are grounded."
			}

			if (cfg.type === "results" && wordCount > 150 && !hasFigureRef && !hasTableRef) {
				readiness = readiness === "blocked" ? readiness : "needs-work"
				issues.push("no-evidence-links")
				nextStep = "Anchor result claims to a figure or table so reviewers can verify the evidence quickly."
			}

			result[cfg.type] = {
				type: cfg.type,
				label: cfg.label,
				status,
				readiness,
				issues,
				nextStep,
				citationCount: citationKeys.length,
				missingCitationCount: missingInSection.length,
				hasFigureRef,
				hasTableRef,
				lastEditedAt: editedAt,
			}
		}

		return result
	}

	/**
	 * Get word count status for all sections with limit comparison.
	 */
	async getSectionWordStatus(templateId: string): Promise<
		Record<
			string,
			{
				type: SectionType
				label: string
				wordCount: number
				min?: number
				max?: number
				overLimit: boolean
				underLimit: boolean
			}
		>
	> {
		const configs = this.getEffectiveSectionConfigs(templateId)
		const result: Record<string, any> = {}
		for (const cfg of configs) {
			const { wordCount } = await this.loadSection(cfg.type)
			const range = cfg.targetWordRange
			result[cfg.type] = {
				type: cfg.type,
				label: cfg.label,
				wordCount,
				min: range?.[0],
				max: range?.[1],
				overLimit: range ? wordCount > range[1] : false,
				underLimit: range ? wordCount < range[0] : false,
			}
		}
		return result
	}

	// ─── AI Writing Prompt Assembly ────────────────────────────────────

	/**
	 * Assemble the full prompt for AI section generation.
	 * The prompt is sent to the webview for display, and the user
	 * triggers the actual agent task from there.
	 */
	async buildAiWritePrompt(
		sectionType: SectionType,
		templateId: string,
	): Promise<{
		prompt: string
		sectionLabel: string
		targetWords?: string
	}> {
		const venue = getVenueTemplate(templateId)
		const sectionCfg = this.getEffectiveSectionConfigs(templateId).find((s) => s.type === sectionType)
		const sectionLabel = sectionCfg?.label ?? sectionType
		const range = sectionCfg?.targetWordRange
		const targetStr = range ? `${range[0]}-${range[1]}` : undefined

		const parts: string[] = []

		// [1] Mode custom instructions come from the provider's mode config
		const modeInstructions = (this.provider as any)?.getCurrentModeInstructions?.() ?? ""
		if (modeInstructions) {
			parts.push(`## Writing Style Guidelines\n${modeInstructions}`)
		}

		// [2] Section-specific AI prompt
		if (sectionCfg?.aiWritePrompt) {
			parts.push(`## Section Requirements: ${sectionLabel}\n${sectionCfg.aiWritePrompt}`)
		}

		// [3] Context from already-written sections
		const effectiveConfigs = this.getEffectiveSectionConfigs(templateId)
		if (effectiveConfigs.length > 0) {
			const writtenSummaries = await this.buildWrittenSectionsSummary(effectiveConfigs, sectionType)
			if (writtenSummaries) {
				parts.push(`## Context from Completed Sections\n${writtenSummaries}`)
			}
		}

		// [4] User instruction
		const wordHint = targetStr ? ` Target ${targetStr} words.` : ""
		parts.push(
			`## Task\nWrite the **${sectionLabel}** section for this paper.${wordHint} Use LaTeX formatting. Reference citations with \\cite{...} syntax.`,
		)

		return {
			prompt: parts.join("\n\n"),
			sectionLabel,
			targetWords: targetStr,
		}
	}

	private async buildWrittenSectionsSummary(configs: SectionConfig[], currentType: SectionType): Promise<string> {
		const summaries: string[] = []
		for (const cfg of configs) {
			if (cfg.type === "appendix" || cfg.type === currentType) continue
			if (cfg.recommendedOrder >= (configs.find((c) => c.type === currentType)?.recommendedOrder ?? 99)) continue
			const { content } = await this.loadSection(cfg.type)
			if (content.trim()) {
				const preview = content.length > 300 ? content.substring(0, 300) + "..." : content
				summaries.push(`### ${cfg.label}\n${preview}`)
			}
		}
		return summaries.join("\n\n")
	}

	// ─── Snapshots ──────────────────────────────────────────────────────

	async createSnapshot(label?: string): Promise<SnapshotMeta> {
		const cwd = this.cwd!
		const latexDir = path.join(cwd, "latex")
		const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace("000Z", "00") // e.g. 20260518T14302200
		const snapshotId = timestamp.substring(0, 15) // e.g. 20260518T143022
		const snapshotDir = path.join(this.getSnapshotsDir(), snapshotId)

		await fs.mkdir(snapshotDir, { recursive: true })

		// Copy all LaTeX files (excluding snapshots dir and paper.pdf)
		let fileCount = 0
		await this.copyForSnapshot(latexDir, snapshotDir, () => fileCount++)

		// Save metadata
		const meta: SnapshotMeta = { id: snapshotId, createdAt: new Date().toISOString(), label, fileCount }
		await fs.writeFile(path.join(snapshotDir, "snapshot.json"), JSON.stringify(meta, null, 2), "utf-8")

		return meta
	}

	private async copyForSnapshot(src: string, dest: string, onFile: () => void): Promise<void> {
		const entries = await fs.readdir(src, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.name === "snapshots" || entry.name === "paper.pdf") continue
			const srcPath = path.join(src, entry.name)
			const destPath = path.join(dest, entry.name)
			if (entry.isDirectory()) {
				await fs.mkdir(destPath, { recursive: true })
				await this.copyForSnapshot(srcPath, destPath, onFile)
			} else {
				await fs.copyFile(srcPath, destPath)
				onFile()
			}
		}
	}

	async listSnapshots(): Promise<SnapshotMeta[]> {
		const snapshotsDir = this.getSnapshotsDir()
		const snapshots: SnapshotMeta[] = []
		try {
			const entries = await fs.readdir(snapshotsDir, { withFileTypes: true })
			for (const entry of entries) {
				if (!entry.isDirectory()) continue
				try {
					const metaPath = path.join(snapshotsDir, entry.name, "snapshot.json")
					const raw = await fs.readFile(metaPath, "utf-8")
					snapshots.push(JSON.parse(raw))
				} catch {
					// Fallback: construct minimal meta
					snapshots.push({ id: entry.name, createdAt: "", fileCount: 0 })
				}
			}
		} catch {
			// No snapshots yet
		}
		return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	}

	async restoreSnapshot(snapshotId: string): Promise<void> {
		const cwd = this.cwd!
		const snapshotDir = path.join(this.getSnapshotsDir(), snapshotId)
		const latexDir = path.join(cwd, "latex")

		// Verify snapshot exists
		try {
			await fs.access(snapshotDir)
		} catch {
			throw new Error(`Snapshot '${snapshotId}' not found`)
		}

		// Create a backup of current state before restoring
		await this.createSnapshot("auto-before-restore")

		// Clear current sections and main.tex (keep references.bib and snapshots)
		const sectionsDir = path.join(latexDir, "sections")
		try {
			const existing = await fs.readdir(sectionsDir)
			for (const f of existing) {
				if (f.endsWith(".tex")) {
					await fs.unlink(path.join(sectionsDir, f))
				}
			}
		} catch {
			// No sections dir yet
		}

		// Restore from snapshot
		await this.restoreDir(snapshotDir, latexDir)
	}

	private async restoreDir(src: string, dest: string): Promise<void> {
		const entries = await fs.readdir(src, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.name === "snapshot.json") continue
			const srcPath = path.join(src, entry.name)
			const destPath = path.join(dest, entry.name)
			if (entry.isDirectory()) {
				await fs.mkdir(destPath, { recursive: true })
				await this.restoreDir(srcPath, destPath)
			} else {
				await fs.mkdir(path.dirname(destPath), { recursive: true })
				await fs.copyFile(srcPath, destPath)
			}
		}
	}

	// ─── Markdown Export ────────────────────────────────────────────────

	async exportToMarkdown(templateId: string): Promise<string> {
		const configs = this.getEffectiveSectionConfigs(templateId)
		const lines: string[] = []

		for (const cfg of configs) {
			if (cfg.type === "appendix") continue
			const { content } = await this.loadSection(cfg.type)
			if (content.trim()) {
				lines.push(`## ${cfg.label}`)
				lines.push("")
				lines.push(content)
				lines.push("")
			}
		}

		return lines.join("\n")
	}

	getSectionConfig(templateId: string, sectionType: SectionType): SectionConfig | undefined {
		return this.getEffectiveSectionConfigs(templateId).find((cfg) => cfg.type === sectionType)
	}

	private getEffectiveSectionConfigs(templateId: string): SectionConfig[] {
		const baseConfigs = getVenueTemplate(templateId)?.sectionConfigs ?? []
		const customConfigs = this.provider?.getPaperProjectManager()?.getCurrentProject()?.customSectionConfigs ?? {}

		return baseConfigs.map((cfg) => ({
			...cfg,
			label: customConfigs[cfg.type]?.label ?? cfg.label,
			targetWordRange: customConfigs[cfg.type]?.targetWordRange ?? cfg.targetWordRange,
		}))
	}

	private getSectionWorkflowStatus(sectionType: SectionType, content: string): SectionWorkflowStatus {
		const customConfigs = this.provider?.getPaperProjectManager()?.getCurrentProject()?.customSectionConfigs ?? {}
		const persistedStatus = customConfigs[sectionType]?.status
		if (persistedStatus) {
			return persistedStatus
		}
		return content.trim() ? "draft" : "outline"
	}

	private extractCitationKeys(content: string): string[] {
		const keys = new Set<string>()
		const pattern = /\\cite[tpa]?\{([^}]+)\}/g
		let match: RegExpExecArray | null = pattern.exec(content)
		while (match) {
			for (const rawKey of match[1].split(",")) {
				const key = rawKey.trim()
				if (key) {
					keys.add(key)
				}
			}
			match = pattern.exec(content)
		}
		return Array.from(keys)
	}

	private countMatches(content: string, pattern: RegExp): number {
		return content.match(pattern)?.length ?? 0
	}

	private async getSectionLastEditedAt(sectionType: SectionType): Promise<string | undefined> {
		try {
			const stat = await fs.stat(this.sectionPath(sectionType))
			return stat.mtime.toISOString()
		} catch {
			return undefined
		}
	}
}
