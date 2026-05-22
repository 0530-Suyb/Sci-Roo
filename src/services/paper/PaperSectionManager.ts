import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { SectionType, SectionConfig, PaperWritingState, SnapshotMeta } from "@roo-code/types"
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
		return this.provider?.cwd
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
		const configs = getVenueTemplate(templateId)?.sectionConfigs ?? []
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
		const configs = getVenueTemplate(templateId)?.sectionConfigs ?? []
		let totalWords = 0
		let targetWords = 0
		const sectionStatus = {} as Record<SectionType, "outline" | "draft" | "revised" | "final">

		for (const cfg of configs) {
			const { content, wordCount } = await this.loadSection(cfg.type)
			totalWords += wordCount
			if (cfg.targetWordRange) {
				targetWords += cfg.targetWordRange[1]
			}
			sectionStatus[cfg.type] = content.trim() ? "draft" : "outline"
		}

		return {
			currentSection: undefined,
			sectionStatus,
			totalWords,
			targetWords,
			citationCount: 0,
			figureCount: 0,
			tableCount: 0,
			lastEdited: new Date().toISOString(),
		}
	}

	/**
	 * Get word count status for all sections with limit comparison.
	 */
	async getSectionWordStatus(templateId: string): Promise<
		Array<{
			type: SectionType
			label: string
			wordCount: number
			min?: number
			max?: number
			overLimit: boolean
			underLimit: boolean
		}>
	> {
		const configs = getVenueTemplate(templateId)?.sectionConfigs ?? []
		const result = []
		for (const cfg of configs) {
			const { wordCount } = await this.loadSection(cfg.type)
			const range = cfg.targetWordRange
			result.push({
				type: cfg.type,
				label: cfg.label,
				wordCount,
				min: range?.[0],
				max: range?.[1],
				overLimit: range ? wordCount > range[1] : false,
				underLimit: range ? wordCount < range[0] : false,
			})
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
		const sectionCfg = venue?.sectionConfigs.find((s) => s.type === sectionType)
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
		if (venue) {
			const writtenSummaries = await this.buildWrittenSectionsSummary(venue.sectionConfigs, sectionType)
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
		const configs = getVenueTemplate(templateId)?.sectionConfigs ?? []
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
}
