import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { ReferenceEntry, Author, RetrievalCandidate } from "@roo-code/types"

const LEGACY_ARXIV_ID_PATTERN = String.raw`[a-z-]+(?:\.[A-Z]{2})?/\d{7}(?:v\d+)?`
const MODERN_ARXIV_ID_PATTERN = String.raw`\d{4}\.\d{4,5}(?:v\d+)?`
const ARXIV_ID_PATTERN = String.raw`(?:${LEGACY_ARXIV_ID_PATTERN}|${MODERN_ARXIV_ID_PATTERN})`
const STRICT_ARXIV_ID_PATTERN = new RegExp(String.raw`^${ARXIV_ID_PATTERN}$`, "i")
const EXPLICIT_ARXIV_ID_PATTERN = new RegExp(
	String.raw`(?:arxiv(?:\.org/(?:abs|pdf)/|/(?:abs|pdf)/|:|\.)\s*)(${ARXIV_ID_PATTERN})(?:\.pdf)?`,
	"i",
)
const PDF_MAGIC = "%PDF"
const PDF_DOWNLOAD_USER_AGENT = "Sci-Roo/0.0.1 (ReadPaper reference PDF downloader)"

export type ReferencePdfDownloadStatus = "downloaded" | "existing" | "skipped"

export type ReferencePdfImportResult = {
	entry: ReferenceEntry
	created: boolean
	pdf: {
		status: ReferencePdfDownloadStatus
		path?: string
		url?: string
	}
}

export type ReadPaperCandidateReferenceStatus = {
	hasEntry: boolean
	hasPdf: boolean
	citeKey?: string
	pdfPath?: string
}

export function extractArxivIdFromCandidate(candidate: Partial<RetrievalCandidate>): string | undefined {
	const values = [
		{ value: candidate.arxiv_id, allowBareId: true },
		{ value: candidate.source_id, allowBareId: candidate.source === "arxiv" },
		{ value: candidate.url },
		{ value: candidate.doi },
	]

	for (const { value, allowBareId } of values) {
		const normalized = normalizeArxivId(value, { allowBareId })
		if (normalized) return normalized
	}

	return undefined
}

export function buildArxivPdfUrl(arxivId: string): string {
	const normalized = normalizeArxivId(arxivId, { allowBareId: true })
	if (!normalized) throw new Error(`Invalid arXiv id: ${arxivId}`)
	const encoded = normalized.split("/").map(encodeURIComponent).join("/")
	return `https://arxiv.org/pdf/${encoded}`
}

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
		return this.provider?.getPaperProjectManager()?.getProjectRoot() ?? this.provider?.cwd
	}

	// ─── Path Helpers ──────────────────────────────────────────────────

	private getReferenceDir(cwdOverride?: string): string {
		const cwd = cwdOverride || this.cwd
		if (!cwd) throw new Error("No workspace directory")
		return path.join(cwd, "reference")
	}

	private mdPath(citeKey: string, cwdOverride?: string): string {
		return path.join(this.getReferenceDir(cwdOverride), `${citeKey}.md`)
	}

	private pdfPath(citeKey: string, cwdOverride?: string): string {
		return path.join(this.getReferenceDir(cwdOverride), `${citeKey}.pdf`)
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

	async resolveCiteKey(baseKey: string, cwdOverride?: string): Promise<string> {
		let key = baseKey
		let suffix = 2
		const refDir = this.getReferenceDir(cwdOverride)
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

		await this.writeEntry(full)

		return full
	}

	async importReadPaperCandidate(
		candidate: RetrievalCandidate,
		options: {
			cwd?: string
			downloadPdf?: boolean
			fetchImpl?: typeof fetch
		} = {},
	): Promise<ReferencePdfImportResult> {
		const cwd = options.cwd
		const arxivId = extractArxivIdFromCandidate(candidate)
		const entryDraft = this.candidateToReferenceEntry(candidate, arxivId)
		const existing = await this.findDuplicateEntry(entryDraft, cwd)
		let entry = existing ? this.mergeReferenceEntry(existing, entryDraft) : entryDraft
		let created = false

		if (!existing) {
			entry = {
				...entry,
				citeKey: await this.resolveCiteKey(entry.citeKey, cwd),
			}
			created = true
		}

		const refDir = this.getReferenceDir(cwd)
		await fs.mkdir(refDir, { recursive: true })
		entry = { ...entry, hasPdf: await this.checkFileExists(this.pdfPath(entry.citeKey, cwd)) }

		if (!options.downloadPdf) {
			await this.writeEntry(entry, cwd)
			return { entry, created, pdf: { status: "skipped" } }
		}

		if (!arxivId) {
			throw new Error("Cannot download reference PDF: candidate has no arXiv id")
		}

		const pdfResult = await this.downloadArxivPdf(arxivId, entry.citeKey, {
			cwd,
			fetchImpl: options.fetchImpl,
		})
		if (pdfResult.status === "downloaded" || pdfResult.status === "existing") {
			entry = { ...entry, hasPdf: true }
		}
		await this.writeEntry(entry, cwd)

		return { entry, created, pdf: pdfResult }
	}

	async getReadPaperCandidateReferenceStatus(
		candidate: RetrievalCandidate,
		options: { cwd?: string } = {},
	): Promise<ReadPaperCandidateReferenceStatus> {
		const arxivId = extractArxivIdFromCandidate(candidate)
		const entryDraft = this.candidateToReferenceEntry(candidate, arxivId)
		const existing = await this.findDuplicateEntry(entryDraft, options.cwd)
		if (!existing) {
			return { hasEntry: false, hasPdf: false }
		}

		const pdfPath = this.pdfPath(existing.citeKey, options.cwd)
		const hasPdf = await this.checkFileExists(pdfPath)
		return {
			hasEntry: true,
			hasPdf,
			citeKey: existing.citeKey,
			pdfPath: hasPdf ? pdfPath : undefined,
		}
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

	async listEntries(cwdOverride?: string): Promise<ReferenceEntry[]> {
		const refDir = this.getReferenceDir(cwdOverride)
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
		const allKeys = new Set<string>()
		const texFiles = await this.getTexFilesToScan(cwd)

		for (const filePath of texFiles) {
			try {
				const content = await fs.readFile(filePath, "utf-8")
				const keys = this.extractCiteKeys(content)
				for (const key of keys) {
					allKeys.add(key)
				}
			} catch {
				// Skip unreadable files and keep scanning the rest.
			}
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

	private async getTexFilesToScan(projectRoot: string): Promise<string[]> {
		const paperProject = this.provider?.getPaperProjectManager?.()
		const primaryManuscriptPath = paperProject?.getPrimaryManuscriptAbsolutePath()
		if (primaryManuscriptPath && (await this.checkFileExists(primaryManuscriptPath))) {
			return [primaryManuscriptPath]
		}

		const latexDir = path.join(projectRoot, "latex")
		const latexFiles = await this.collectTexFiles(latexDir)
		if (latexFiles.length > 0) {
			return latexFiles
		}

		const legacySectionsDir = path.join(projectRoot, "latex", "sections")
		return this.collectTexFiles(legacySectionsDir)
	}

	private async collectTexFiles(dirPath: string): Promise<string[]> {
		const files: string[] = []

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)
				if (entry.isDirectory()) {
					if (entry.name === "snapshots") {
						continue
					}
					files.push(...(await this.collectTexFiles(fullPath)))
					continue
				}
				if (entry.isFile() && entry.name.endsWith(".tex")) {
					files.push(fullPath)
				}
			}
		} catch {
			return []
		}

		return files
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

	private parseReadPaperAuthor(author: string): Author {
		const normalized = author.trim()
		if (!normalized) {
			return { firstName: "", lastName: "" }
		}

		if (normalized.includes(",")) {
			const [lastName, ...rest] = normalized.split(",")
			return {
				firstName: rest.join(",").trim(),
				lastName: lastName.trim(),
			}
		}

		const parts = normalized.split(/\s+/)
		if (parts.length === 1) {
			return { firstName: "", lastName: parts[0] }
		}

		return {
			firstName: parts.slice(0, -1).join(" "),
			lastName: parts[parts.length - 1],
		}
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

	private candidateToReferenceEntry(candidate: RetrievalCandidate, arxivId?: string): ReferenceEntry {
		const authors = candidate.authors.map((author) => this.parseReadPaperAuthor(author))
		const year = candidate.year ?? new Date().getFullYear()
		const draft = {
			title: candidate.title || "(untitled reference)",
			authors,
			year,
		}
		const citeKey = this.generateCiteKey(draft)

		return {
			citeKey,
			title: draft.title,
			authors,
			year,
			venue: candidate.venue || (arxivId ? "arXiv" : ""),
			doi: candidate.doi || undefined,
			arxivId,
			abstract: candidate.abstract || undefined,
			keywords: [...new Set(candidate.keywords.filter((keyword) => Boolean(keyword)))],
			bibtex: undefined,
			hasPdf: false,
			verified: Boolean(candidate.doi || arxivId),
			verifiedAt: candidate.doi || arxivId ? new Date().toISOString() : undefined,
			tags: ["readpaper", arxivId ? "arxiv" : ""].filter(Boolean),
			dateAdded: new Date().toISOString(),
		}
	}

	private async findDuplicateEntry(entry: ReferenceEntry, cwdOverride?: string): Promise<ReferenceEntry | undefined> {
		const entries = await this.listEntries(cwdOverride)
		const normalizedTitle = normalizeTitle(entry.title)

		return entries.find((existing) => {
			if (entry.doi && existing.doi && normalizeIdentifier(entry.doi) === normalizeIdentifier(existing.doi)) {
				return true
			}
			if (
				entry.arxivId &&
				existing.arxivId &&
				normalizeIdentifier(entry.arxivId) === normalizeIdentifier(existing.arxivId)
			) {
				return true
			}
			return normalizedTitle.length > 0 && normalizedTitle === normalizeTitle(existing.title)
		})
	}

	private mergeReferenceEntry(existing: ReferenceEntry, incoming: ReferenceEntry): ReferenceEntry {
		return {
			...existing,
			title: incoming.title || existing.title,
			authors: incoming.authors.length > 0 ? incoming.authors : existing.authors,
			year: incoming.year || existing.year,
			venue: incoming.venue || existing.venue,
			doi: incoming.doi || existing.doi,
			arxivId: incoming.arxivId || existing.arxivId,
			abstract: incoming.abstract || existing.abstract,
			keywords: uniqueStrings([...(existing.keywords ?? []), ...(incoming.keywords ?? [])]),
			bibtex: existing.bibtex || incoming.bibtex,
			tags: uniqueStrings([...(existing.tags ?? []), ...(incoming.tags ?? [])]),
			verified: existing.verified || incoming.verified,
			verifiedAt: existing.verifiedAt || incoming.verifiedAt,
		}
	}

	private async downloadArxivPdf(
		arxivId: string,
		citeKey: string,
		options: { cwd?: string; fetchImpl?: typeof fetch } = {},
	): Promise<ReferencePdfImportResult["pdf"]> {
		const pdfPath = this.pdfPath(citeKey, options.cwd)
		if (await this.checkFileExists(pdfPath)) {
			return { status: "existing", path: pdfPath, url: buildArxivPdfUrl(arxivId) }
		}

		const url = buildArxivPdfUrl(arxivId)
		const fetchImpl = options.fetchImpl ?? globalThis.fetch
		if (typeof fetchImpl !== "function") {
			throw new Error("Cannot download reference PDF: fetch is not available")
		}

		const response = await fetchImpl(url, { headers: { "User-Agent": PDF_DOWNLOAD_USER_AGENT } })
		if (!response.ok) {
			throw new Error(`arXiv PDF download failed: HTTP ${response.status} ${response.statusText}`)
		}

		const bytes = Buffer.from(await response.arrayBuffer())
		if (!isPdfBuffer(bytes)) {
			const contentType = response.headers.get("content-type") || "unknown"
			throw new Error(`arXiv PDF download failed: response is not a PDF (${contentType})`)
		}

		const tempPath = `${pdfPath}.${Date.now()}.tmp`
		try {
			await fs.writeFile(tempPath, bytes)
			await fs.rename(tempPath, pdfPath)
		} catch (error) {
			await fs.unlink(tempPath).catch(() => undefined)
			throw error
		}

		return { status: "downloaded", path: pdfPath, url }
	}

	private async writeEntry(entry: ReferenceEntry, cwdOverride?: string): Promise<void> {
		const mdContent = this.serializeEntry(entry)
		await fs.writeFile(this.mdPath(entry.citeKey, cwdOverride), mdContent, "utf-8")
	}
}

function normalizeArxivId(value?: string | null, options: { allowBareId?: boolean } = {}): string | undefined {
	const trimmed = value?.trim()
	if (!trimmed) return undefined
	const explicit = trimmed.match(EXPLICIT_ARXIV_ID_PATTERN)
	if (explicit?.[1]) return stripPdfSuffix(explicit[1])
	if (!options.allowBareId) return undefined
	const withoutPdf = stripPdfSuffix(trimmed)
	return STRICT_ARXIV_ID_PATTERN.test(withoutPdf) ? withoutPdf : undefined
}

function stripPdfSuffix(value: string): string {
	return value.trim().replace(/\.pdf$/i, "")
}

function normalizeIdentifier(value?: string): string {
	return value?.trim().toLowerCase() ?? ""
}

function normalizeTitle(value?: string): string {
	return (value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function isPdfBuffer(buffer: Buffer): boolean {
	return buffer.subarray(0, PDF_MAGIC.length).toString("utf-8") === PDF_MAGIC
}
