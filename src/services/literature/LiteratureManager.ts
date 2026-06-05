import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import type { ClineProvider } from "../../core/webview/ClineProvider"
import {
	Author,
	LiteratureEntry,
	LiteratureLibrary,
	LiteratureSearchQuery,
	LiteratureSearchResult,
	LiteratureSource,
	LiteratureNote,
	DeduplicationReport,
	RetrievalCandidate,
	LITERATURE_LIBRARY_VERSION,
	LITERATURE_LIBRARY_FILENAME,
} from "@roo-code/types"

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type DuplicateComparableEntry = Pick<LiteratureEntry, "doi" | "pmid" | "arxivId" | "title">
type ReadPaperIdentity = {
	candidateTag?: string
	sourceTag?: string
}

export class LiteratureManager {
	private library: LiteratureLibrary = { entries: [], version: LITERATURE_LIBRARY_VERSION, lastModified: "" }
	private providerRef: WeakRef<ClineProvider>
	private disposables: vscode.Disposable[] = []
	private isDisposed = false
	private libraryPath: string = ""

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	get cwd(): string | undefined {
		return this.providerRef.deref()?.cwd
	}

	get isInitialized(): boolean {
		return this.libraryPath !== ""
	}

	async initialize(): Promise<void> {
		if (this.isDisposed) return

		const cwd = this.cwd
		if (!cwd) return

		const literatureDir = path.join(cwd, ".roo", "literature")
		await fs.mkdir(literatureDir, { recursive: true })
		this.libraryPath = path.join(literatureDir, LITERATURE_LIBRARY_FILENAME)

		await this.loadLibrary()
	}

	async dispose(): Promise<void> {
		this.isDisposed = true
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}

	// ---- Persistence ----

	private async loadLibrary(): Promise<void> {
		try {
			const content = await fs.readFile(this.libraryPath, "utf-8")
			this.library = JSON.parse(content)
		} catch {
			this.library = {
				entries: [],
				version: LITERATURE_LIBRARY_VERSION,
				lastModified: new Date().toISOString(),
			}
			await this.saveLibrary()
		}
	}

	private async saveLibrary(): Promise<void> {
		if (!this.libraryPath) return
		this.library.lastModified = new Date().toISOString()
		this.library.version = LITERATURE_LIBRARY_VERSION
		await fs.writeFile(this.libraryPath, JSON.stringify(this.library, null, "\t"), "utf-8")
	}

	// ---- CRUD ----

	getAllEntries(): LiteratureEntry[] {
		return this.library.entries
	}

	getEntry(id: string): LiteratureEntry | undefined {
		return this.library.entries.find((e) => e.id === id)
	}

	async addEntry(
		entry: Omit<LiteratureEntry, "id" | "dateAdded" | "dateModified" | "notes"> & { notes?: LiteratureNote[] },
	): Promise<LiteratureEntry> {
		const now = new Date().toISOString()
		const newEntry: LiteratureEntry = {
			...entry,
			id: generateId(),
			notes: entry.notes || [],
			dateAdded: now,
			dateModified: now,
		}
		this.library.entries.push(newEntry)
		await this.saveLibrary()
		return newEntry
	}

	async upsertReadPaperCandidate(
		candidate: RetrievalCandidate,
		options?: { retrievalNo?: string },
	): Promise<{ entry: LiteratureEntry; created: boolean }> {
		const mapped = this.mapReadPaperCandidate(candidate, options)
		const index = this.library.entries.findIndex((entry) => this.findDuplicateReason(entry, mapped) !== null)
		const now = new Date().toISOString()

		if (index === -1) {
			const newEntry: LiteratureEntry = {
				...mapped,
				id: generateId(),
				notes: [],
				dateAdded: now,
				dateModified: now,
			}
			this.library.entries.push(newEntry)
			await this.saveLibrary()
			return { entry: newEntry, created: true }
		}

		const existing = this.library.entries[index]
		const updated: LiteratureEntry = {
			...existing,
			...mapped,
			id: existing.id,
			title: mapped.title || existing.title,
			source: mapped.source,
			year: mapped.year ?? existing.year,
			authors: mapped.authors.length > 0 ? mapped.authors : existing.authors,
			keywords: uniqueStrings([...existing.keywords, ...mapped.keywords]),
			notes: existing.notes,
			tags: uniqueStrings([...existing.tags, ...mapped.tags]),
			abstract: mapped.abstract || existing.abstract,
			journal: mapped.journal || existing.journal,
			volume: mapped.volume || existing.volume,
			issue: mapped.issue || existing.issue,
			pages: mapped.pages || existing.pages,
			doi: mapped.doi || existing.doi,
			arxivId: mapped.arxivId || existing.arxivId,
			pmid: mapped.pmid || existing.pmid,
			url: mapped.url || existing.url,
			citationBibtex: mapped.citationBibtex || existing.citationBibtex,
			citationApa: mapped.citationApa || existing.citationApa,
			citationVancouver: mapped.citationVancouver || existing.citationVancouver,
			relevanceScore: mapped.relevanceScore ?? existing.relevanceScore,
			isRead: existing.isRead,
			fullTextPath: existing.fullTextPath,
			dateAdded: existing.dateAdded,
			dateModified: now,
		}

		this.library.entries[index] = updated
		await this.saveLibrary()
		return { entry: updated, created: false }
	}

	findReadPaperCandidateEntry(
		candidate: RetrievalCandidate,
		options?: { retrievalNo?: string },
	): LiteratureEntry | undefined {
		const mapped = this.mapReadPaperCandidate(candidate, options)
		const identity = this.getReadPaperIdentityTags(candidate, options)
		return this.library.entries.find((entry) => {
			if (this.matchesReadPaperIdentity(entry, identity)) return true
			return this.findDuplicateReason(entry, mapped) !== null
		})
	}

	async addEntries(
		entries: Array<
			Omit<LiteratureEntry, "id" | "dateAdded" | "dateModified" | "notes"> & { notes?: LiteratureNote[] }
		>,
	): Promise<LiteratureEntry[]> {
		const added: LiteratureEntry[] = []
		const now = new Date().toISOString()

		for (const entry of entries) {
			// Skip if DOI already exists
			if (entry.doi && this.library.entries.some((e) => e.doi === entry.doi)) {
				continue
			}
			const newEntry: LiteratureEntry = {
				...entry,
				id: generateId(),
				notes: entry.notes || [],
				dateAdded: now,
				dateModified: now,
			}
			this.library.entries.push(newEntry)
			added.push(newEntry)
		}

		await this.saveLibrary()
		return added
	}

	async updateEntry(
		id: string,
		updates: Partial<Omit<LiteratureEntry, "id" | "dateAdded">>,
	): Promise<LiteratureEntry | undefined> {
		const index = this.library.entries.findIndex((e) => e.id === id)
		if (index === -1) return undefined

		this.library.entries[index] = {
			...this.library.entries[index],
			...updates,
			dateModified: new Date().toISOString(),
		}
		await this.saveLibrary()
		return this.library.entries[index]
	}

	async deleteEntry(id: string): Promise<boolean> {
		const index = this.library.entries.findIndex((e) => e.id === id)
		if (index === -1) return false
		this.library.entries.splice(index, 1)
		await this.saveLibrary()
		return true
	}

	async deleteEntriesMatchingReadPaperCandidates(
		candidates: RetrievalCandidate[],
		options?: { retrievalNo?: string },
	): Promise<{ deleted: number; entryIds: string[] }> {
		const matchedEntryIds = new Set<string>()

		for (const candidate of candidates) {
			const mapped = this.mapReadPaperCandidate(candidate, options)
			const identity = this.getReadPaperIdentityTags(candidate, options)
			for (const entry of this.library.entries) {
				if (this.matchesReadPaperIdentity(entry, identity)) {
					matchedEntryIds.add(entry.id)
					continue
				}
				if (this.findDuplicateReason(entry, mapped) !== null) {
					matchedEntryIds.add(entry.id)
				}
			}
		}

		if (matchedEntryIds.size === 0) {
			return { deleted: 0, entryIds: [] }
		}

		this.library.entries = this.library.entries.filter((entry) => !matchedEntryIds.has(entry.id))
		await this.saveLibrary()
		return { deleted: matchedEntryIds.size, entryIds: [...matchedEntryIds] }
	}

	// ---- Notes ----

	async addNote(entryId: string, text: string): Promise<LiteratureEntry | undefined> {
		const entry = this.library.entries.find((e) => e.id === entryId)
		if (!entry) return undefined
		entry.notes.push({ id: generateId(), text, createdAt: new Date().toISOString() })
		entry.dateModified = new Date().toISOString()
		await this.saveLibrary()
		return entry
	}

	// ---- Search & Filter ----

	searchLocal(query: string): LiteratureEntry[] {
		const q = query.toLowerCase()
		return this.library.entries.filter(
			(e) =>
				e.title.toLowerCase().includes(q) ||
				e.authors.some((a) => `${a.lastName} ${a.firstName}`.toLowerCase().includes(q)) ||
				e.abstract?.toLowerCase().includes(q) ||
				e.keywords.some((k) => k.toLowerCase().includes(q)) ||
				e.tags.some((t) => t.toLowerCase().includes(q)),
		)
	}

	filterByTags(tags: string[]): LiteratureEntry[] {
		return this.library.entries.filter((e) => tags.every((t) => e.tags.includes(t)))
	}

	filterBySource(source: LiteratureSource): LiteratureEntry[] {
		return this.library.entries.filter((e) => e.source === source)
	}

	getUnread(): LiteratureEntry[] {
		return this.library.entries.filter((e) => !e.isRead)
	}

	getAllTags(): { tag: string; count: number }[] {
		const tagCounts = new Map<string, number>()
		for (const entry of this.library.entries) {
			for (const tag of entry.tags) {
				tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
			}
		}
		return Array.from(tagCounts.entries())
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count)
	}

	// ---- Deduplication ----

	async deduplicate(): Promise<DeduplicationReport> {
		const before = this.library.entries.length
		const toRemove = new Set<string>()
		const groups: DeduplicationReport["duplicateGroups"] = []

		for (let i = 0; i < this.library.entries.length; i++) {
			if (toRemove.has(this.library.entries[i].id)) continue
			for (let j = i + 1; j < this.library.entries.length; j++) {
				if (toRemove.has(this.library.entries[j].id)) continue
				const reason = this.findDuplicateReason(this.library.entries[i], this.library.entries[j])
				if (reason) {
					toRemove.add(this.library.entries[j].id)
					groups.push({ kept: this.library.entries[i].id, removed: [this.library.entries[j].id], reason })
				}
			}
		}

		this.library.entries = this.library.entries.filter((e) => !toRemove.has(e.id))

		const report: DeduplicationReport = {
			totalBefore: before,
			totalAfter: this.library.entries.length,
			duplicatesRemoved: toRemove.size,
			duplicateGroups: groups,
		}

		await this.saveLibrary()
		return report
	}

	private findDuplicateReason(
		a: DuplicateComparableEntry,
		b: DuplicateComparableEntry,
	): DeduplicationReport["duplicateGroups"][0]["reason"] | null {
		if (a.doi && b.doi && a.doi === b.doi) return "doi"
		if (a.pmid && b.pmid && a.pmid === b.pmid) return "pmid"
		if (a.arxivId && b.arxivId && a.arxivId === b.arxivId) return "arxiv-id"
		if (this.titleSimilarity(a.title, b.title) > 0.9) return "title-fuzzy"
		return null
	}

	private mapReadPaperCandidate(
		candidate: RetrievalCandidate,
		options?: { retrievalNo?: string },
	): Omit<LiteratureEntry, "id" | "dateAdded" | "dateModified"> {
		const identity = this.getReadPaperIdentityTags(candidate, options)
		const tags = [
			"readpaper",
			options?.retrievalNo ? `readpaper:${options.retrievalNo}` : "",
			identity.sourceTag ?? "",
			identity.candidateTag ?? "",
		].filter(Boolean)

		return {
			title: candidate.title || "",
			authors: candidate.authors.map((author) => this.parseReadPaperAuthor(author)),
			year: candidate.year ?? undefined,
			journal: candidate.venue || undefined,
			doi: candidate.doi || undefined,
			arxivId: candidate.arxiv_id || undefined,
			pmid: candidate.pmid || undefined,
			abstract: candidate.abstract || undefined,
			keywords: [...new Set(candidate.keywords.filter(Boolean))],
			source: candidate.source,
			url: candidate.url || undefined,
			relevanceScore: candidate.relevance_score ?? undefined,
			notes: [],
			tags,
			isRead: false,
		}
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
			return { firstName: "", lastName: normalized }
		}

		return {
			firstName: parts.slice(0, -1).join(" "),
			lastName: parts[parts.length - 1],
		}
	}

	private titleSimilarity(a: string, b: string): number {
		const normalize = (s: string) =>
			s
				.toLowerCase()
				.replace(/[^a-z0-9\s]/g, "")
				.replace(/\s+/g, " ")
				.trim()
		const na = normalize(a)
		const nb = normalize(b)
		if (na === nb) return 1.0
		const longer = na.length > nb.length ? na : nb
		const shorter = na.length > nb.length ? nb : na
		const words = shorter.split(" ")
		let matches = 0
		for (const w of words) {
			if (w.length > 2 && longer.includes(w)) matches++
		}
		return matches / words.length
	}

	private getReadPaperIdentityTags(
		candidate: Pick<RetrievalCandidate, "candidate_no" | "source" | "source_id">,
		options?: { retrievalNo?: string },
	): ReadPaperIdentity {
		return {
			candidateTag:
				options?.retrievalNo && candidate.candidate_no
					? `readpaper-candidate:${options.retrievalNo}:${candidate.candidate_no}`
					: undefined,
			sourceTag: candidate.source_id ? `source-id:${candidate.source}:${candidate.source_id}` : undefined,
		}
	}

	private matchesReadPaperIdentity(entry: LiteratureEntry, identity: ReadPaperIdentity): boolean {
		if (identity.candidateTag && entry.tags.includes(identity.candidateTag)) return true
		if (identity.sourceTag && entry.tags.includes(identity.sourceTag)) return true
		return false
	}

	// ---- Import / Export ----

	async importBibtex(bibtex: string): Promise<LiteratureEntry[]> {
		const entries = this.parseBibtex(bibtex)
		return this.addEntries(entries)
	}

	private parseBibtex(
		bibtex: string,
	): Array<Omit<LiteratureEntry, "id" | "dateAdded" | "dateModified" | "notes"> & { notes?: LiteratureNote[] }> {
		const results: Array<
			Omit<LiteratureEntry, "id" | "dateAdded" | "dateModified" | "notes"> & { notes?: LiteratureNote[] }
		> = []
		const entryRegex = /@(\w+)\{([^,]*),\s*([\s\S]*?)\}/g
		let match

		while ((match = entryRegex.exec(bibtex)) !== null) {
			const type = match[1]
			const fields = this.parseBibtexFields(match[3])
			results.push({
				title: fields.title || "",
				authors: this.parseBibtexAuthors(fields.author || ""),
				year: fields.year ? parseInt(fields.year) : undefined,
				journal: fields.journal || fields.booktitle,
				volume: fields.volume,
				pages: fields.pages,
				doi: fields.doi?.replace(/^https?:\/\/doi\.org\//, ""),
				abstract: fields.abstract,
				keywords: fields.keywords?.split(/,\s*/) || [],
				source: type === "article" ? "crossref" : "manual",
				url: fields.url,
				tags: [],
				isRead: false,
			})
		}

		return results
	}

	private parseBibtexFields(text: string): Record<string, string> {
		const fields: Record<string, string> = {}
		const fieldRegex = /(\w+)\s*=\s*[{"]((?:[^{}"]|{[^}]*}|[^"])*?)["}]\s*,?\n?/g
		let match

		while ((match = fieldRegex.exec(text)) !== null) {
			fields[match[1].toLowerCase()] = match[2].trim()
		}

		return fields
	}

	private parseBibtexAuthors(authorStr: string): Author[] {
		return authorStr.split(/\s+and\s+/).map((name) => {
			const parts = name.trim().split(/,\s*/)
			if (parts.length >= 2) {
				return { firstName: parts[1].trim(), lastName: parts[0].trim() }
			}
			const spaceParts = name.trim().split(/\s+/)
			if (spaceParts.length >= 2) {
				return { firstName: spaceParts.slice(0, -1).join(" "), lastName: spaceParts[spaceParts.length - 1] }
			}
			return { firstName: "", lastName: name.trim() }
		})
	}

	exportBibtex(entryIds?: string[]): string {
		const entries = entryIds
			? (entryIds.map((id) => this.library.entries.find((e) => e.id === id)).filter(Boolean) as LiteratureEntry[])
			: this.library.entries

		return entries
			.map((e) => {
				const citeKey = this.makeCiteKey(e)
				let bib = `@article{${citeKey},\n`
				bib += `  title = {${e.title}},\n`
				bib += `  author = {${e.authors.map((a) => `${a.lastName}, ${a.firstName}`).join(" and ")}},\n`
				if (e.year) bib += `  year = {${e.year}},\n`
				if (e.journal) bib += `  journal = {${e.journal}},\n`
				if (e.volume) bib += `  volume = {${e.volume}},\n`
				if (e.pages) bib += `  pages = {${e.pages}},\n`
				if (e.doi) bib += `  doi = {${e.doi}},\n`
				if (e.abstract) bib += `  abstract = {${e.abstract}},\n`
				bib += "}\n"
				return bib
			})
			.join("\n")
	}

	private makeCiteKey(entry: LiteratureEntry): string {
		const firstAuthor = entry.authors[0]?.lastName || "unknown"
		const year = entry.year || "n.d."
		const titleWords = entry.title
			.replace(/[^a-zA-Z\s]/g, "")
			.split(/\s+/)
			.filter((w) => w.length > 3)
			.slice(0, 2)
		return `${firstAuthor}${year}${titleWords.join("")}`
	}

	// ---- Statistics ----

	getStats() {
		return {
			totalEntries: this.library.entries.length,
			unreadCount: this.library.entries.filter((e) => !e.isRead).length,
			tagCount: this.getAllTags().length,
			sourceBreakdown: this.getSourceBreakdown(),
			yearBreakdown: this.getYearBreakdown(),
		}
	}

	private getSourceBreakdown(): Record<string, number> {
		const breakdown: Record<string, number> = {}
		for (const e of this.library.entries) {
			breakdown[e.source] = (breakdown[e.source] || 0) + 1
		}
		return breakdown
	}

	private getYearBreakdown(): Record<string, number> {
		const breakdown: Record<string, number> = {}
		for (const e of this.library.entries) {
			if (e.year) {
				breakdown[String(e.year)] = (breakdown[String(e.year)] || 0) + 1
			}
		}
		return breakdown
	}
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
