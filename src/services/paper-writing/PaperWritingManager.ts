import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type {
	Manuscript,
	ManuscriptSection,
	ManuscriptSectionType,
	ManuscriptState,
	FigureReference,
	TableReference,
	CitationStyle,
	ReviewComment,
	RevisionPlan,
} from "@roo-code/types"

const MANUSCRIPT_DIR = ".roo/manuscripts"
const MANUSCRIPT_FILE = "manuscript.json"
const MAX_HISTORY = 25

export class PaperWritingManager {
	private providerRef: WeakRef<ClineProvider>
	private current: Manuscript | undefined
	private history: Manuscript[] = []
	private initialized = false

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	get cwd(): string | undefined {
		return this.providerRef.deref()?.cwd
	}

	async initialize(): Promise<void> {
		if (this.initialized) return
		const cwd = this.cwd
		if (cwd) {
			await fs.mkdir(path.join(cwd, MANUSCRIPT_DIR), { recursive: true })
			await this.loadManuscript()
		}
		this.initialized = true
	}

	private async loadManuscript(): Promise<void> {
		const cwd = this.cwd
		if (!cwd) return

		const filePath = path.join(cwd, MANUSCRIPT_DIR, MANUSCRIPT_FILE)
		try {
			const raw = await fs.readFile(filePath, "utf-8")
			const data = JSON.parse(raw)
			if (data.current) {
				this.current = data.current
			}
			if (data.history) {
				this.history = data.history
			}
		} catch {
			// No manuscript yet
		}
	}

	private async saveManuscript(): Promise<void> {
		const cwd = this.cwd
		if (!cwd) return

		const filePath = path.join(cwd, MANUSCRIPT_DIR, MANUSCRIPT_FILE)
		const data = {
			current: this.current,
			history: this.history,
		}
		await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
	}

	async createManuscript(
		title: string,
		authors: Manuscript["authors"],
		citationStyle: CitationStyle = "apa",
	): Promise<Manuscript> {
		const now = new Date().toISOString()
		const manuscript: Manuscript = {
			id: `ms_${Date.now()}`,
			title,
			authors,
			abstract: "",
			sections: [],
			figures: [],
			tables: [],
			citations: [],
			citationStyle,
			keywords: [],
			status: "draft",
			createdAt: now,
			updatedAt: now,
		}

		this.current = manuscript
		this.history.unshift(manuscript)
		await this.saveManuscript()
		return manuscript
	}

	async updateSection(
		sectionType: ManuscriptSectionType,
		title: string,
		content: string,
	): Promise<ManuscriptSection> {
		if (!this.current) {
			throw new Error("No active manuscript")
		}

		const existing = this.current.sections.find((s) => s.type === sectionType)
		const now = new Date().toISOString()

		if (existing) {
			existing.title = title
			existing.content = content
			existing.wordCount = content.split(/\s+/).filter(Boolean).length
			existing.status = "revised"
			existing.lastEdited = now
			this.current.updatedAt = now
			await this.saveManuscript()
			return existing
		}

		const section: ManuscriptSection = {
			id: `sec_${Date.now()}`,
			type: sectionType,
			title,
			content,
			wordCount: content.split(/\s+/).filter(Boolean).length,
			status: "draft",
			lastEdited: now,
		}

		this.current.sections.push(section)
		this.current.updatedAt = now
		await this.saveManuscript()
		return section
	}

	async addFigure(caption: string, filePath: string, sectionId: string): Promise<FigureReference> {
		if (!this.current) {
			throw new Error("No active manuscript")
		}

		const figure: FigureReference = {
			id: `fig_${Date.now()}`,
			caption,
			filePath,
			sectionId,
		}

		this.current.figures.push(figure)
		this.current.updatedAt = new Date().toISOString()
		await this.saveManuscript()
		return figure
	}

	async addTable(caption: string, dataFile: string, sectionId: string): Promise<TableReference> {
		if (!this.current) {
			throw new Error("No active manuscript")
		}

		const table: TableReference = {
			id: `tbl_${Date.now()}`,
			caption,
			dataFile,
			sectionId,
		}

		this.current.tables.push(table)
		this.current.updatedAt = new Date().toISOString()
		await this.saveManuscript()
		return table
	}

	async addCitations(citationIds: string[]): Promise<void> {
		if (!this.current) {
			throw new Error("No active manuscript")
		}

		const existing = new Set(this.current.citations)
		for (const id of citationIds) {
			if (!existing.has(id)) {
				this.current.citations.push(id)
				existing.add(id)
			}
		}

		this.current.updatedAt = new Date().toISOString()
		await this.saveManuscript()
	}

	async setManuscriptStatus(status: Manuscript["status"]): Promise<void> {
		if (!this.current) return
		this.current.status = status
		this.current.updatedAt = new Date().toISOString()
		await this.saveManuscript()
	}

	async exportManuscript(format: "latex" | "markdown" | "docx"): Promise<string> {
		if (!this.current) {
			throw new Error("No active manuscript")
		}

		// Export manuscript to the manuscript directory
		const cwd = this.cwd
		if (!cwd) {
			throw new Error("No workspace directory")
		}

		const ext = format === "latex" ? "tex" : format === "markdown" ? "md" : "docx"
		const exportPath = path.join(cwd, MANUSCRIPT_DIR, `manuscript.${ext}`)

		let content: string
		if (format === "markdown") {
			content = this.toMarkdown()
		} else if (format === "latex") {
			content = this.toLatex()
		} else {
			content = JSON.stringify(this.current, null, 2)
		}

		await fs.writeFile(exportPath, content, "utf-8")
		return exportPath
	}

	private toMarkdown(): string {
		const ms = this.current
		if (!ms) return ""

		const lines: string[] = []
		lines.push(`# ${ms.title}`)
		lines.push("")
		lines.push(
			`**Authors**: ${ms.authors.map((a) => `${a.firstName} ${a.lastName}${a.affiliation ? ` (${a.affiliation})` : ""}`).join(", ")}`,
		)
		lines.push("")
		lines.push(`**Keywords**: ${ms.keywords.join(", ")}`)
		lines.push("")

		for (const section of ms.sections) {
			const label = section.type.charAt(0).toUpperCase() + section.type.slice(1).replace(/-/g, " ")
			lines.push(`## ${label}`)
			lines.push("")
			lines.push(section.content)
			lines.push("")
		}

		if (ms.citations.length > 0) {
			lines.push("## References")
			lines.push("")
			for (const ref of ms.citations) {
				lines.push(`- [${ref}]`)
			}
		}

		return lines.join("\n")
	}

	private toLatex(): string {
		const ms = this.current
		if (!ms) return ""

		const lines: string[] = []
		lines.push("\\documentclass{article}")
		lines.push("\\usepackage[utf8]{inputenc}")
		lines.push("\\usepackage{natbib}")
		lines.push("\\usepackage{graphicx}")
		lines.push("")
		lines.push("\\title{" + ms.title.replace(/[%&$#_{}~^\\]/g, "\\$&") + "}")
		lines.push("\\author{" + ms.authors.map((a) => `${a.firstName} ${a.lastName}`).join(" \\and ") + "}")
		lines.push("")
		lines.push("\\begin{document}")
		lines.push("\\maketitle")
		lines.push("")

		if (ms.sections.find((s) => s.type === "abstract")) {
			const abstract = ms.sections.find((s) => s.type === "abstract")!
			lines.push("\\begin{abstract}")
			lines.push(abstract.content)
			lines.push("\\end{abstract}")
			lines.push("")
		}

		const sectionOrder: ManuscriptSectionType[] = ["introduction", "methods", "results", "discussion", "conclusion"]

		for (const type of sectionOrder) {
			const section = ms.sections.find((s) => s.type === type)
			if (section) {
				const cmd = type === "introduction" ? "section" : "section"
				lines.push(`\\${cmd}{${section.title}}`)
				lines.push(section.content)
				lines.push("")
			}
		}

		lines.push("\\bibliographystyle{plainnat}")
		lines.push("\\bibliography{references}")
		lines.push("")
		lines.push("\\end{document}")

		return lines.join("\n")
	}

	async getState(): Promise<ManuscriptState> {
		return {
			current: this.current,
			history: this.history,
		}
	}

	async dispose(): Promise<void> {
		this.current = undefined
		this.history = []
		this.initialized = false
	}
}
