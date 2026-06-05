import * as crypto from "crypto"
import * as fs from "fs/promises"
import * as path from "path"

import type {
	ReferenceEntry,
	VerificationEntry,
	VerificationMatch,
	VerificationReason,
	VerificationStatus,
	VerificationStore,
} from "@roo-code/types"

const EMPTY_STORE: VerificationStore = {
	version: 1,
	lastFullScan: null,
	manuscriptPath: null,
	manuscriptHash: null,
	entries: {},
}

type SearchMatch = Omit<VerificationMatch, "similarityScore"> & {
	similarityScore: number
}

export class CitationVerifier {
	constructor(
		private projectRoot: string,
		private fetchImpl: typeof fetch = fetch,
	) {}

	get storePath(): string {
		return path.join(this.projectRoot, ".roo", "reference-verification.json")
	}

	async verifyCitation(
		citeKey: string,
		options: {
			texFilePath: string
			referenceEntries: ReferenceEntry[]
			existingStore?: VerificationStore
		},
	): Promise<VerificationEntry> {
		const localEntry = options.referenceEntries.find((entry) => entry.citeKey === citeKey)
		const previous = options.existingStore?.entries?.[citeKey]

		if (!localEntry) {
			return {
				citeKey,
				status: "missing",
				reason: previous?.dismissedByUser ? "manual-dismissed" : "missing-local-entry",
				confidence: 0,
				verifiedAt: new Date().toISOString(),
				method: "skipped",
				sourceSnapshot: {},
				matches: [],
				stale: false,
				dismissedByUser: previous?.dismissedByUser,
				dismissedReason: previous?.dismissedReason,
			}
		}

		const snapshot = {
			localTitle: localEntry.title,
			localAuthors: localEntry.authors.map((author) => `${author.firstName} ${author.lastName}`.trim()),
			localYear: localEntry.year,
			localDoi: normalizeDoi(localEntry.doi),
		}

		if (!snapshot.localTitle && !snapshot.localDoi) {
			return {
				citeKey,
				status: "unverified",
				reason: previous?.dismissedByUser ? "manual-dismissed" : "insufficient-metadata",
				confidence: 0,
				verifiedAt: new Date().toISOString(),
				method: "skipped",
				sourceSnapshot: snapshot,
				matches: [],
				stale: false,
				dismissedByUser: previous?.dismissedByUser,
				dismissedReason: previous?.dismissedReason,
			}
		}

		let result: VerificationEntry
		if (snapshot.localDoi) {
			result = await this.verifyByDoi(citeKey, snapshot.localTitle ?? "", snapshot, snapshot.localDoi)
		} else if (snapshot.localTitle) {
			result = await this.verifyByFuzzySearch(citeKey, snapshot)
		} else {
			result = {
				citeKey,
				status: "unverified",
				reason: "local-metadata-only",
				confidence: 0.25,
				verifiedAt: new Date().toISOString(),
				method: "local-only",
				sourceSnapshot: snapshot,
				matches: [],
				stale: false,
			}
		}

		if (previous?.dismissedByUser) {
			result.dismissedByUser = true
			result.dismissedReason = previous.dismissedReason
			result.reason = "manual-dismissed"
		}

		return result
	}

	async verifyAllCitations(options: {
		texFilePath: string
		referenceEntries: ReferenceEntry[]
	}): Promise<VerificationStore> {
		const store = await this.loadStore()
		const texContent = await fs.readFile(options.texFilePath, "utf-8")
		const citedKeys = extractCiteKeys(texContent)
		const entries: Record<string, VerificationEntry> = {}

		for (const citeKey of citedKeys) {
			entries[citeKey] = await this.verifyCitation(citeKey, {
				texFilePath: options.texFilePath,
				referenceEntries: options.referenceEntries,
				existingStore: store,
			})
		}

		for (const [citeKey, existing] of Object.entries(store.entries)) {
			if (!entries[citeKey] && existing.dismissedByUser) {
				entries[citeKey] = { ...existing, stale: true }
			}
		}

		const nextStore: VerificationStore = {
			version: 1,
			lastFullScan: new Date().toISOString(),
			manuscriptPath: options.texFilePath,
			manuscriptHash: hashContent(texContent),
			entries,
		}
		await this.saveStore(nextStore)
		return nextStore
	}

	async loadStore(): Promise<VerificationStore> {
		try {
			const raw = await fs.readFile(this.storePath, "utf-8")
			const parsed = JSON.parse(raw) as VerificationStore
			return {
				...EMPTY_STORE,
				...parsed,
				entries: Object.fromEntries(
					Object.entries(parsed.entries ?? {}).map(([citeKey, entry]) => [
						citeKey,
						normalizeVerificationEntry(entry),
					]),
				),
			}
		} catch {
			return { ...EMPTY_STORE }
		}
	}

	async loadStoreForManuscript(texFilePath: string): Promise<VerificationStore> {
		const store = await this.loadStore()
		try {
			const texContent = await fs.readFile(texFilePath, "utf-8")
			const manuscriptHash = hashContent(texContent)
			if (store.manuscriptPath === texFilePath && store.manuscriptHash === manuscriptHash) {
				return store
			}

			const staleStore: VerificationStore = {
				...store,
				manuscriptPath: texFilePath,
				manuscriptHash,
				entries: Object.fromEntries(
					Object.entries(store.entries).map(([citeKey, entry]) => [
						citeKey,
						{
							...entry,
							stale: true,
						},
					]),
				),
			}
			await this.saveStore(staleStore)
			return staleStore
		} catch {
			return store
		}
	}

	async dismissIssue(citeKey: string, reason = "Dismissed by user"): Promise<VerificationStore> {
		const store = await this.loadStore()
		const current = store.entries[citeKey]
		if (!current) {
			return store
		}
		store.entries[citeKey] = {
			...current,
			dismissedByUser: true,
			dismissedReason: reason,
			reason: "manual-dismissed",
		}
		await this.saveStore(store)
		return store
	}

	async upsertEntry(
		entry: VerificationEntry,
		options: { manuscriptPath?: string; manuscriptHash?: string } = {},
	): Promise<VerificationStore> {
		const store = await this.loadStore()
		const nextStore: VerificationStore = {
			...store,
			lastFullScan: new Date().toISOString(),
			manuscriptPath: options.manuscriptPath ?? store.manuscriptPath,
			manuscriptHash: options.manuscriptHash ?? store.manuscriptHash,
			entries: {
				...store.entries,
				[entry.citeKey]: entry,
			},
		}
		await this.saveStore(nextStore)
		return nextStore
	}

	async getSectionCiteMap(texFilePath: string): Promise<Record<string, string[]>> {
		const content = await fs.readFile(texFilePath, "utf-8")
		const lines = content.split(/\r?\n/)
		const sectionMap: Record<string, Set<string>> = {}
		let currentSection = "Preamble"

		for (const line of lines) {
			if (/\\(?:appendix|appendices)\b/.test(line)) {
				currentSection = "Appendix"
			}
			if (/\\bibliography\s*\{|\\begin\{thebibliography\}/.test(line)) {
				currentSection = "References"
			}
			const sectionMatch = line.match(/\\(section|subsection|subsubsection)\*?\{([^}]+)\}/)
			if (sectionMatch) {
				currentSection = sectionMatch[2].trim()
			}
			for (const citeKey of extractCiteKeys(line)) {
				sectionMap[citeKey] ??= new Set<string>()
				sectionMap[citeKey].add(currentSection)
			}
		}

		return Object.fromEntries(Object.entries(sectionMap).map(([key, sections]) => [key, Array.from(sections)]))
	}

	async getCiteLineLocations(texFilePath: string, citeKey: string): Promise<number[]> {
		const content = await fs.readFile(texFilePath, "utf-8")
		const lines = content.split(/\r?\n/)
		const locations: number[] = []
		for (let index = 0; index < lines.length; index++) {
			if (extractCiteKeys(lines[index]).includes(citeKey)) {
				locations.push(index + 1)
			}
		}
		return locations
	}

	private async saveStore(store: VerificationStore): Promise<void> {
		await fs.mkdir(path.dirname(this.storePath), { recursive: true })
		await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), "utf-8")
	}

	private async verifyByDoi(
		citeKey: string,
		localTitle: string,
		snapshot: VerificationEntry["sourceSnapshot"],
		doi: string,
	): Promise<VerificationEntry> {
		try {
			const response = await this.fetchWithRetry(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
				headers: { Accept: "application/json" },
			})
			if (response.status === 404) {
				return this.makeEntry(citeKey, "flagged", "source-not-found", 0, "doi-direct", snapshot, [])
			}
			if (!response.ok) {
				return this.makeEntry(citeKey, "unverified", "network-error", 0, "skipped", snapshot, [])
			}
			const data = (await response.json()) as any
			const title = String(data?.message?.title?.[0] ?? "").trim()
			const authors = Array.isArray(data?.message?.author)
				? data.message.author.map((author: any) =>
						`${String(author.given ?? "").trim()} ${String(author.family ?? "").trim()}`.trim(),
					)
				: []
			const year = Number(data?.message?.issued?.["date-parts"]?.[0]?.[0] ?? null)
			const similarityScore = similarity(localTitle, title)
			const match: VerificationMatch = {
				source: "crossref",
				doi,
				title,
				authors,
				year: Number.isFinite(year) ? year : null,
				similarityScore,
			}

			if (similarityScore >= 0.85) {
				return this.makeEntry(citeKey, "verified", "doi-match", 1, "doi-direct", snapshot, [match])
			}
			if (similarityScore >= 0.6) {
				return this.makeEntry(
					citeKey,
					"flagged",
					"doi-title-mismatch",
					roundConfidence(similarityScore),
					"doi-direct",
					snapshot,
					[match],
				)
			}
			return this.makeEntry(
				citeKey,
				"flagged",
				"doi-title-mismatch",
				roundConfidence(similarityScore),
				"doi-direct",
				snapshot,
				[match],
			)
		} catch {
			return this.makeEntry(citeKey, "unverified", "network-error", 0, "skipped", snapshot, [])
		}
	}

	private async verifyByFuzzySearch(
		citeKey: string,
		snapshot: VerificationEntry["sourceSnapshot"],
	): Promise<VerificationEntry> {
		const query = encodeURIComponent(snapshot.localTitle ?? "")
		try {
			const [crossrefMatch, openAlexMatch] = await Promise.all([
				this.fetchCrossrefSearch(query, snapshot.localTitle ?? ""),
				this.fetchOpenAlexSearch(query, snapshot.localTitle ?? ""),
			])
			const matches = [crossrefMatch, openAlexMatch]
				.filter((match): match is SearchMatch => !!match)
				.sort((a, b) => b.similarityScore - a.similarityScore)

			const best = matches[0]
			if (!best) {
				return this.makeEntry(citeKey, "flagged", "source-not-found", 0, "title-author-fuzzy", snapshot, [])
			}

			if (best.similarityScore >= 0.85) {
				return this.makeEntry(
					citeKey,
					"verified",
					"fuzzy-match",
					roundConfidence(best.similarityScore),
					"title-author-fuzzy",
					snapshot,
					matches,
				)
			}
			if (best.similarityScore >= 0.6) {
				return this.makeEntry(
					citeKey,
					"flagged",
					"fuzzy-low-confidence",
					roundConfidence(best.similarityScore),
					"title-author-fuzzy",
					snapshot,
					matches,
				)
			}

			return this.makeEntry(
				citeKey,
				"flagged",
				"source-not-found",
				roundConfidence(best.similarityScore),
				"title-author-fuzzy",
				snapshot,
				matches,
			)
		} catch {
			return this.makeEntry(citeKey, "unverified", "network-error", 0, "skipped", snapshot, [])
		}
	}

	private async fetchCrossrefSearch(query: string, localTitle: string): Promise<SearchMatch | null> {
		const response = await this.fetchWithRetry(`https://api.crossref.org/works?rows=1&query.title=${query}`, {
			headers: { Accept: "application/json" },
		})
		if (!response.ok) {
			return null
		}
		const data = (await response.json()) as any
		const item = data?.message?.items?.[0]
		if (!item) {
			return null
		}
		const title = String(item?.title?.[0] ?? "").trim()
		return {
			source: "crossref",
			doi: typeof item?.DOI === "string" ? item.DOI : null,
			title,
			authors: Array.isArray(item?.author)
				? item.author.map((author: any) =>
						`${String(author.given ?? "").trim()} ${String(author.family ?? "").trim()}`.trim(),
					)
				: [],
			year: Number(item?.issued?.["date-parts"]?.[0]?.[0] ?? null) || null,
			similarityScore: similarity(localTitle, title),
		}
	}

	private async fetchOpenAlexSearch(query: string, localTitle: string): Promise<SearchMatch | null> {
		const response = await this.fetchWithRetry(`https://api.openalex.org/works?search=${query}&per-page=1`)
		if (!response.ok) {
			return null
		}
		const data = (await response.json()) as any
		const item = data?.results?.[0]
		if (!item) {
			return null
		}
		const title = String(item?.display_name ?? "").trim()
		return {
			source: "openalex",
			doi: typeof item?.doi === "string" ? item.doi.replace(/^https?:\/\/doi\.org\//i, "") : null,
			title,
			authors: Array.isArray(item?.authorships)
				? item.authorships
						.map((authorship: any) => String(authorship?.author?.display_name ?? "").trim())
						.filter(Boolean)
				: [],
			year: Number(item?.publication_year ?? null) || null,
			similarityScore: similarity(localTitle, title),
		}
	}

	private makeEntry(
		citeKey: string,
		status: VerificationStatus,
		reason: VerificationReason,
		confidence: number,
		method: VerificationEntry["method"],
		sourceSnapshot: VerificationEntry["sourceSnapshot"],
		matches: VerificationMatch[],
	): VerificationEntry {
		return {
			citeKey,
			status,
			reason,
			confidence,
			verifiedAt: new Date().toISOString(),
			method,
			sourceSnapshot,
			matches,
			stale: false,
		}
	}

	private async fetchWithRetry(input: string, init?: RequestInit): Promise<Response> {
		const maxAttempts = 3
		let lastError: unknown

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const response = await this.fetchImpl(input, init)
				if (response.status !== 429 || attempt === maxAttempts) {
					return response
				}
			} catch (error) {
				lastError = error
				if (attempt === maxAttempts) {
					throw error
				}
			}

			await wait(250 * attempt)
		}

		throw lastError instanceof Error ? lastError : new Error("Request failed")
	}
}

export function extractCiteKeys(content: string): string[] {
	const keys = new Set<string>()
	const citeRegex =
		/\\(?:cite|citet|citep|citealt|citealp|citeauthor|citeyear|citeyearpar)[*]?\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g
	let match: RegExpExecArray | null
	while ((match = citeRegex.exec(content)) !== null) {
		for (const rawKey of match[1].split(",")) {
			const key = rawKey.trim()
			if (key) {
				keys.add(key)
			}
		}
	}
	return Array.from(keys)
}

function normalizeDoi(doi: string | undefined): string | undefined {
	const cleaned = doi
		?.trim()
		.replace(/^https?:\/\/doi\.org\//i, "")
		.replace(/^doi:\s*/i, "")
	return cleaned && isValidDoi(cleaned) ? cleaned : undefined
}

function normalizeVerificationEntry(
	entry: Omit<VerificationEntry, "status"> & {
		status: VerificationEntry["status"] | "ambiguous" | "likely_fabricated" | "skipped"
	},
): VerificationEntry {
	const status =
		entry.status === "ambiguous" || entry.status === "likely_fabricated"
			? "flagged"
			: entry.status === "skipped"
				? "unverified"
				: entry.status
	return {
		...entry,
		status,
	}
}

function isValidDoi(value: string): boolean {
	return /^10\.\d{4,9}\/\S+$/i.test(value)
}

function hashContent(content: string): string {
	return crypto.createHash("sha1").update(content).digest("hex")
}

function normalizeTitle(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
}

function similarity(left: string, right: string): number {
	const a = normalizeTitle(left)
	const b = normalizeTitle(right)
	if (!a || !b) {
		return 0
	}
	if (a === b) {
		return 1
	}
	const distance = levenshtein(a, b)
	return Math.max(0, 1 - distance / Math.max(a.length, b.length, 1))
}

function levenshtein(left: string, right: string): number {
	const rows = left.length + 1
	const cols = right.length + 1
	const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

	for (let row = 0; row < rows; row++) matrix[row][0] = row
	for (let col = 0; col < cols; col++) matrix[0][col] = col

	for (let row = 1; row < rows; row++) {
		for (let col = 1; col < cols; col++) {
			const cost = left[row - 1] === right[col - 1] ? 0 : 1
			matrix[row][col] = Math.min(
				matrix[row - 1][col] + 1,
				matrix[row][col - 1] + 1,
				matrix[row - 1][col - 1] + cost,
			)
		}
	}
	return matrix[rows - 1][cols - 1]
}

function roundConfidence(value: number): number {
	return Math.round(value * 100) / 100
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
