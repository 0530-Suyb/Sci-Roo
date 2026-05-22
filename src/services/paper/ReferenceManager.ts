import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { ReferenceEntry, Author } from "@roo-code/types"

/**
 * Manages the reference/ directory — entry storage, citation scanning,
 * BibTeX generation, batch import, and uncatalogued PDF detection.
 */
export class ReferenceManager {
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

	private getReferenceDir(): string {
		const cwd = this.cwd
		if (!cwd) throw new Error("No workspace directory")
		return path.join(cwd, "reference")
	}

	private mdPath(citeKey: string): string {
		return path.join(this.getReferenceDir(), `${citeKey}.md`)
	}

	private pdfPath(citeKey: string): string {
		return path.join(this.getReferenceDir(), `${citeKey}.pdf`)
	}

	// ─── citeKey Generation ────────────────────────────────────────────

	generateCiteKey(entry: Pick<ReferenceEntry, "authors" | "year" | "title">): string {
		const firstAuthor = entry.authors[0]?.lastName?.toLowerCase().replace(/\s+/g, "") ?? "unknown"
		const year = entry.year ?? new Date().getFullYear()
		const firstTitleWord =
			entry.title
				.toLowerCase()
				.replace(/[^a-z0-9\s]/g, "")
				.split(/\s+/)
				.filter((w) => w.length > 2 && !["the", "and", "for", "with", "from", "using"].includes(w))[0] ??
			"paper"
		return `${firstAuthor}${year}${firstTitleWord}`
	}

	async resolveCiteKey(baseKey: string): Promise<string> {
		let key = baseKey
		let suffix = 2
		const refDir = this.getReferenceDir()
		while (true) {
			try {
				await fs.access(path.join(refDir, `${key}.md`))
				key = `${baseKey}${suffix}`
				suffix++
			} catch {
				return key
			}
		}
	}

	// ─── CRUD ──────────────────────────────────────────────────────────

	async addEntry(entry: Omit<ReferenceEntry, "hasPdf" | "verified" | "tags" | "dateAdded">): Promise<ReferenceEntry> {
		const refDir = this.getReferenceDir()
		await fs.mkdir(refDir, { recursive: true })

		const pdfExists = await this.checkFileExists(this.pdfPath(entry.citeKey))

		const full: ReferenceEntry = {
			...entry,
			hasPdf: pdfExists,
			verified: !!entry.doi,
			tags: [],
			dateAdded: new Date().toISOString(),
		}

		const mdContent = this.serializeEntry(full)
		await fs.writeFile(this.mdPath(entry.citeKey), mdContent, "utf-8")

		return full
	}

	async removeEntry(citeKey: string): Promise<void> {
		// Only remove .md, leave .pdf in place (user may want to keep it)
		try {
			await fs.unlink(this.mdPath(citeKey))
		} catch {
			throw new Error(`Reference '${citeKey}' not found`)
		}
	}

	async getEntry(citeKey: string): Promise<ReferenceEntry | undefined> {
		try {
			const content = await fs.readFile(this.mdPath(citeKey), "utf-8")
			return this.deserializeEntry(content)
		} catch {
			return undefined
		}
	}

	async listEntries(): Promise<ReferenceEntry[]> {
		const refDir = this.getReferenceDir()
		const entries: ReferenceEntry[] = []
		try {
			const files = await fs.readdir(refDir)
			for (const file of files) {
				if (file.endsWith(".md")) {
					try {
						const content = await fs.readFile(path.join(refDir, file), "utf-8")
						entries.push(this.deserializeEntry(content))
					} catch {
						// Skip corrupt files
					}
				}
			}
		} catch {
			// Directory doesn't exist yet
		}
		return entries.sort((a, b) => b.year - a.year)
	}

	// ─── PDF Detection ──────────────────────────────────────────────────

	async scanUncataloguedPdfs(): Promise<string[]> {
		const refDir = this.getReferenceDir()
		const uncatalogued: string[] = []
		try {
			const files = await fs.readdir(refDir)
			for (const file of files) {
				if (file.endsWith(".pdf")) {
					const citeKey = file.replace(/\.pdf$/, "")
					const mdExists = await this.checkFileExists(path.join(refDir, `${citeKey}.md`))
					if (!mdExists) {
						uncatalogued.push(citeKey)
					}
				}
			}
		} catch {
			// Directory doesn't exist yet
		}
		return uncatalogued
	}

	// ─── Citation Scanning ─────────────────────────────────────────────

	async scanTexCitations(): Promise<{ cited: string[]; missing: string[] }> {
		const cwd = this.cwd
		if (!cwd) return { cited: [], missing: [] }

		const sectionsDir = path.join(cwd, "latex", "sections")
		const allKeys = new Set<string>()

		try {
			const files = await fs.readdir(sectionsDir)
			for (const file of files) {
				if (!file.endsWith(".tex")) continue
				const content = await fs.readFile(path.join(sectionsDir, file), "utf-8")
				const keys = this.extractCiteKeys(content)
				for (const key of keys) {
					allKeys.add(key)
				}
			}
		} catch {
			return { cited: [], missing: [] }
		}

		const cited = Array.from(allKeys)
		const missing: string[] = []
		for (const key of cited) {
			const entry = await this.getEntry(key)
			if (!entry) {
				missing.push(key)
			}
		}

		return { cited, missing }
	}

	private extractCiteKeys(content: string): string[] {
		const keys = new Set<string>()
		// Match \cite{key1,key2} and \citep{...} and \citet{...}
		const citeRegex =
			/\\(?:cite|citet|citep|citealt|citealp|citeauthor|citeyear|citeyearpar)[*]?\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g
		let match
		while ((match = citeRegex.exec(content)) !== null) {
			const keyList = match[1]
			for (const k of keyList.split(",")) {
				const trimmed = k.trim()
				if (trimmed) keys.add(trimmed)
			}
		}
		return Array.from(keys)
	}

	// ─── BibTeX Generation ─────────────────────────────────────────────

	async generateBib(): Promise<string> {
		const { cited } = await this.scanTexCitations()
		const bibEntries: string[] = []

		for (const key of cited) {
			const entry = await this.getEntry(key)
			if (entry?.bibtex) {
				bibEntries.push(entry.bibtex)
			} else if (entry) {
				// Synthesize minimal BibTeX from metadata
				bibEntries.push(this.synthesizeBibtex(entry))
			}
			// Missing entries are silently skipped
		}

		const bibContent = bibEntries.join("\n\n") + (bibEntries.length > 0 ? "\n" : "")
		const cwd = this.cwd!
		const bibPath = path.join(cwd, "latex", "references.bib")
		await fs.mkdir(path.dirname(bibPath), { recursive: true })
		await fs.writeFile(bibPath, bibContent, "utf-8")

		return bibContent
	}

	private synthesizeBibtex(entry: ReferenceEntry): string {
		const authorStr = entry.authors.map((a) => `${a.lastName}, ${a.firstName}`).join(" and ")
		const type = entry.venue?.toLowerCase().includes("arxiv") || entry.arxivId ? "article" : "inproceedings"
		const venueField = type === "article" ? "journal" : "booktitle"
		return [
			`@${type}{${entry.citeKey},`,
			`  title = {${entry.title}},`,
			`  author = {${authorStr}},`,
			`  year = {${entry.year}},`,
			`  ${venueField} = {${entry.venue}},`,
			entry.doi ? `  doi = {${entry.doi}},` : "",
			"}",
			"",
		]
			.filter(Boolean)
			.join("\n")
	}

	// ─── Batch Import ──────────────────────────────────────────────────

	async batchImportBib(bibtexContent: string): Promise<{ imported: string[]; skipped: string[] }> {
		const imported: string[] = []
		const skipped: string[] = []
		const entries = this.parseBibtexEntries(bibtexContent)

		for (const raw of entries) {
			try {
				const parsed = this.parseSingleBibtex(raw)
				if (!parsed.citeKey || !parsed.title) {
					skipped.push(raw)
					continue
				}

				const key = await this.resolveCiteKey(parsed.citeKey)
				const authors = this.parseAuthorString(parsed.author ?? "")

				await this.addEntry({
					citeKey: key,
					title: parsed.title,
					authors,
					year: parsed.year ?? new Date().getFullYear(),
					venue: parsed.journal ?? parsed.booktitle ?? "",
					doi: parsed.doi,
					abstract: parsed.abstract,
					keywords: [],
					bibtex: raw.trim(),
				})
				imported.push(key)
			} catch {
				skipped.push(raw)
			}
		}

		return { imported, skipped }
	}

	// ─── Serialization ──────────────────────────────────────────────────

	private serializeEntry(entry: ReferenceEntry): string {
		const lines = [
			`---`,
			`citeKey: "${entry.citeKey}"`,
			`title: "${entry.title}"`,
			`authors:`,
			...entry.authors.map((a) => `  - firstName: "${a.firstName}"\n    lastName: "${a.lastName}"`),
			`year: ${entry.year}`,
			`venue: "${entry.venue}"`,
			`doi: "${entry.doi ?? ""}"`,
			`arxivId: "${entry.arxivId ?? ""}"`,
			`abstract: "${(entry.abstract ?? "").replace(/"/g, '\\"')}"`,
			`keywords: [${(entry.keywords ?? []).map((k) => `"${k}"`).join(", ")}]`,
			`hasPdf: ${entry.hasPdf}`,
			`verified: ${entry.verified}`,
			`verifiedAt: "${entry.verifiedAt ?? ""}"`,
			`tags: [${(entry.tags ?? []).map((t) => `"${t}"`).join(", ")}]`,
			`dateAdded: "${entry.dateAdded}"`,
			`---`,
			``,
			entry.bibtex ? `\`\`\`bibtex\n${entry.bibtex}\n\`\`\`` : "",
		]
		return lines.join("\n")
	}

	private deserializeEntry(content: string): ReferenceEntry {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)---/)
		if (!frontmatterMatch) throw new Error("Invalid reference entry: missing frontmatter")

		const fm = frontmatterMatch[1]
		const data: Record<string, any> = {}

		// Simple YAML parser (sufficient for our controlled format)
		let currentKey = ""
		const authors: Author[] = []
		for (const line of fm.split("\n")) {
			const authorMatch = line.match(/^\s*- firstName: "(.+)"\s+lastName: "(.+)"/)
			if (authorMatch) {
				authors.push({ firstName: authorMatch[1], lastName: authorMatch[2] })
				continue
			}
			const kvMatch = line.match(/^(\w+):\s*(.+)/)
			if (kvMatch) {
				currentKey = kvMatch[1]
				let val = kvMatch[2].trim()
				// Remove surrounding quotes
				if (val.startsWith('"') && val.endsWith('"')) {
					val = val.slice(1, -1)
				}
				data[currentKey] = val
			}
		}

		// Parse arrays from string representations
		const parseStringArray = (raw: string): string[] => {
			if (!raw || raw === "[]") return []
			return raw
				.replace(/^\[|\]$/g, "")
				.split(",")
				.map((s) => s.trim().replace(/^"|"$/g, ""))
				.filter(Boolean)
		}

		// Extract bibtex from code block
		const bibtexMatch = content.match(/```bibtex\n([\s\S]*?)```/)
		const bibtex = bibtexMatch ? bibtexMatch[1].trim() : undefined

		return {
			citeKey: data.citeKey ?? "",
			title: data.title ?? "",
			authors,
			year: parseInt(data.year) || 0,
			venue: data.venue ?? "",
			doi: data.doi || undefined,
			arxivId: data.arxivId || undefined,
			abstract: data.abstract?.replace(/\\"/g, '"') || undefined,
			keywords: parseStringArray(data.keywords),
			bibtex,
			hasPdf: data.hasPdf === "true",
			verified: data.verified === "true",
			verifiedAt: data.verifiedAt || undefined,
			tags: parseStringArray(data.tags),
			dateAdded: data.dateAdded ?? new Date().toISOString(),
		}
	}

	// ─── BibTeX Parsing ──────────────────────────────────────────────────

	private parseBibtexEntries(content: string): string[] {
		// Split by @ that starts a new entry
		const entries = content.split(/\n(?=@)/)
		return entries.filter((e) => e.trim())
	}

	private parseSingleBibtex(entryStr: string): {
		citeKey?: string
		title?: string
		author?: string
		year?: number
		journal?: string
		booktitle?: string
		doi?: string
		abstract?: string
	} {
		const typeMatch = entryStr.match(/@\w+\{([^,]+),/)
		const citeKey = typeMatch ? typeMatch[1].trim() : undefined

		const extractField = (field: string): string | undefined => {
			const regex = new RegExp(`${field}\\s*=\\s*[{"]([^}"]+)[}"]`, "i")
			const match = entryStr.match(regex)
			return match ? match[1].trim() : undefined
		}

		const yearStr = extractField("year")
		return {
			citeKey,
			title: extractField("title"),
			author: extractField("author"),
			year: yearStr ? parseInt(yearStr) : undefined,
			journal: extractField("journal"),
			booktitle: extractField("booktitle"),
			doi: extractField("doi"),
			abstract: extractField("abstract"),
		}
	}

	private parseAuthorString(authorStr: string): Author[] {
		if (!authorStr) return []
		return authorStr.split(" and ").map((name) => {
			const parts = name.split(",").map((s) => s.trim())
			if (parts.length >= 2) {
				return { firstName: parts[1], lastName: parts[0] }
			}
			// Space-separated: "First Last"
			const spaceParts = name.trim().split(/\s+/)
			if (spaceParts.length >= 2) {
				return {
					firstName: spaceParts.slice(0, -1).join(" "),
					lastName: spaceParts[spaceParts.length - 1],
				}
			}
			return { firstName: name.trim(), lastName: "" }
		})
	}

	// ─── Utilities ─────────────────────────────────────────────────────

	private async checkFileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}
}
