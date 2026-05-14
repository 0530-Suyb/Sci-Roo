import { XMLParser } from "fast-xml-parser"

import type { SearchLiteratureParams } from "@roo-code/types"

import { formatResponse } from "../prompts/responses"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

type SearchSource = "pubmed" | "arxiv"

type LiteratureCandidate = {
	source: SearchSource
	source_rank: number
	title: string
	authors: string[]
	year: number | null
	venue: string
	doi: string
	pmid: string
	arxiv_id: string
	url: string
	abstract: string
	keywords: string[]
	metadata_warnings: string[]
}

type LiteratureRun = {
	source: SearchSource
	query: string
	requested_max_results: number
	returned_count: number
	status: "success" | "partial" | "error" | "no_results"
	error: string | null
}

type SourceSearchResult = {
	run: LiteratureRun
	candidates: LiteratureCandidate[]
}

const SEARCH_TOOL_USER_AGENT = "Sci-Roo/0.1 (sci-roo@example.com)"
const NCBI_TOOL = "Sci-Roo"
const NCBI_EMAIL = "sci-roo@example.com"
const FETCH_RETRY_ATTEMPTS = 3
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	trimValues: true,
	parseTagValue: false,
})

export class SearchLiteratureTool extends BaseTool<"search_literature"> {
	readonly name = "search_literature" as const

	async execute(params: SearchLiteratureParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const isReadPaperRetrievalTask = task.metadata.task?.startsWith("ReadPaper Retrieval Task:")
			const approved =
				isReadPaperRetrievalTask ||
				(await askApproval("search_literature", `Search for "${params.query}" in academic databases`))
			if (!approved) {
				pushToolResult("User denied literature search request.")
				return
			}

			const result = await searchLiterature(params)
			if (isReadPaperRetrievalTask) {
				await applyReadPaperSearchResult(task, result)
			}
			pushToolResult(formatResponse.toolResult(JSON.stringify(result, null, 2)))
		} catch (error) {
			await handleError("search_literature", error)
		}
	}
}

async function applyReadPaperSearchResult(task: Task, result: unknown): Promise<void> {
	const retrievalNo = extractReadPaperRetrievalNo(task.metadata.task)
	if (!retrievalNo) return

	const provider = task.providerRef.deref()
	const manager = provider?.getRetrievalManager()
	if (!manager) return

	try {
		await manager.applySearchToolResult(retrievalNo, result, {
			taskId: task.taskId,
			source: "search_literature_tool",
		})
	} catch (error) {
		provider?.log(`ReadPaper retrieval direct search result apply failed: retrieval=${retrievalNo}, error=${error}`)
	}
}

function extractReadPaperRetrievalNo(taskText: string | undefined): string | undefined {
	return taskText?.match(/^ReadPaper Retrieval Task:\s*(retrieval_\d+)/)?.[1]
}

async function searchLiterature(params: SearchLiteratureParams) {
	const sources = normalizeSources(params.sources)
	const maxResults = normalizeMaxResults(params.maxResults)
	const perSourceMax = Math.max(1, Math.ceil(maxResults / sources.length))
	const sourceResults = await Promise.all(sources.map((source) => searchSource(source, params, perSourceMax)))
	const candidates = sourceResults.flatMap((result) => result.candidates).slice(0, maxResults)
	const runs = sourceResults.map((result) => result.run)
	const bySource = {
		pubmed: candidates.filter((candidate) => candidate.source === "pubmed").length,
		arxiv: candidates.filter((candidate) => candidate.source === "arxiv").length,
	}
	const errors = runs
		.filter((run) => run.status === "error" || run.status === "no_results")
		.map((run) => `${run.source}_${run.status}${run.error ? `: ${run.error}` : ""}`)

	return {
		status: errors.length === 0 ? "success" : candidates.length > 0 ? "partial" : "no_results",
		query: params.query,
		sources,
		maxResults,
		yearFrom: params.yearFrom ?? null,
		yearTo: params.yearTo ?? null,
		search_provenance: {
			summary: `Searched ${sources.join(", ")} for "${params.query}".`,
			runs,
		},
		result_summary: {
			total_found: candidates.length,
			total_saved: candidates.length,
			by_source: bySource,
			duplicates_removed: 0,
			errors,
		},
		candidates,
	}
}

async function searchSource(
	source: SearchSource,
	params: SearchLiteratureParams,
	maxResults: number,
): Promise<SourceSearchResult> {
	try {
		return source === "pubmed" ? await searchPubMed(params, maxResults) : await searchArxiv(params, maxResults)
	} catch (error) {
		return {
			run: {
				source,
				query: params.query,
				requested_max_results: maxResults,
				returned_count: 0,
				status: "error",
				error: error instanceof Error ? error.message : String(error),
			},
			candidates: [],
		}
	}
}

async function searchPubMed(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi")
	searchUrl.searchParams.set("db", "pubmed")
	searchUrl.searchParams.set("term", query)
	searchUrl.searchParams.set("retmax", String(maxResults))
	searchUrl.searchParams.set("retmode", "json")
	searchUrl.searchParams.set("sort", "relevance")
	searchUrl.searchParams.set("tool", NCBI_TOOL)
	searchUrl.searchParams.set("email", NCBI_EMAIL)
	if (params.yearFrom || params.yearTo) {
		searchUrl.searchParams.set("datetype", "pdat")
		if (params.yearFrom) searchUrl.searchParams.set("mindate", String(params.yearFrom))
		if (params.yearTo) searchUrl.searchParams.set("maxdate", String(params.yearTo))
	}

	const searchResponse = await fetchJson(searchUrl)
	const ids = Array.isArray(searchResponse?.esearchresult?.idlist)
		? (searchResponse.esearchresult.idlist as string[])
		: []

	if (ids.length === 0) {
		return emptySourceResult("pubmed", query, maxResults, "no_results", null)
	}

	const fetchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi")
	fetchUrl.searchParams.set("db", "pubmed")
	fetchUrl.searchParams.set("id", ids.join(","))
	fetchUrl.searchParams.set("retmode", "xml")
	fetchUrl.searchParams.set("tool", NCBI_TOOL)
	fetchUrl.searchParams.set("email", NCBI_EMAIL)

	const xml = await fetchText(fetchUrl)
	const parsed = xmlParser.parse(xml)
	const articles = asArray(parsed?.PubmedArticleSet?.PubmedArticle)
	const candidates = articles.map((article, index) => pubMedArticleToCandidate(article, index + 1))

	return {
		run: {
			source: "pubmed",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No PubMed records returned by efetch.",
		},
		candidates,
	}
}

async function searchArxiv(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = buildArxivQuery(params)
	const url = new URL("https://export.arxiv.org/api/query")
	url.searchParams.set("search_query", query)
	url.searchParams.set("start", "0")
	url.searchParams.set("max_results", String(maxResults))
	url.searchParams.set("sortBy", "relevance")
	url.searchParams.set("sortOrder", "descending")

	const xml = await fetchText(url)
	const parsed = xmlParser.parse(xml)
	const entries = asArray(parsed?.feed?.entry)
	const candidates = entries.map((entry, index) => arxivEntryToCandidate(entry, index + 1))

	return {
		run: {
			source: "arxiv",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No arXiv records returned.",
		},
		candidates,
	}
}

function pubMedArticleToCandidate(article: any, sourceRank: number): LiteratureCandidate {
	const citation = article?.MedlineCitation ?? {}
	const articleData = citation?.Article ?? {}
	const pubmedData = article?.PubmedData ?? {}
	const pmid = normalizeText(citation?.PMID)
	const articleIds = asArray(pubmedData?.ArticleIdList?.ArticleId)
	const doi = findArticleId(articleIds, "doi")
	const journal = articleData?.Journal ?? {}
	const pubDate = journal?.JournalIssue?.PubDate ?? {}
	const year = extractYear(pubDate?.Year, pubDate?.MedlineDate, articleData?.ArticleDate)
	const authors = asArray(articleData?.AuthorList?.Author).map(formatPubMedAuthor).filter(Boolean)
	const keywords = asArray(citation?.KeywordList)
		.flatMap((list) => asArray(list?.Keyword))
		.map(normalizeText)
		.filter(Boolean)

	return {
		source: "pubmed",
		source_rank: sourceRank,
		title: normalizeText(articleData?.ArticleTitle) || "(untitled PubMed record)",
		authors,
		year,
		venue: normalizeText(journal?.Title || journal?.ISOAbbreviation),
		doi,
		pmid,
		arxiv_id: "",
		url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
		abstract: extractPubMedAbstract(articleData?.Abstract?.AbstractText),
		keywords,
		metadata_warnings: buildWarnings({
			title: articleData?.ArticleTitle,
			authors,
			year,
			identifier: pmid || doi,
		}),
	}
}

function arxivEntryToCandidate(entry: any, sourceRank: number): LiteratureCandidate {
	const idUrl = normalizeText(entry?.id)
	const arxivId = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "")
	const authors = asArray(entry?.author)
		.map((author) => normalizeText(author?.name || author))
		.filter(Boolean)
	const categories = asArray(entry?.category)
		.map((category) => normalizeText(category?.["@_term"]))
		.filter(Boolean)
	const year = extractYear(entry?.published, entry?.updated)

	return {
		source: "arxiv",
		source_rank: sourceRank,
		title: normalizeText(entry?.title) || "(untitled arXiv record)",
		authors,
		year,
		venue: normalizeText(entry?.["arxiv:journal_ref"]) || "arXiv",
		doi: normalizeText(entry?.["arxiv:doi"]),
		pmid: "",
		arxiv_id: arxivId,
		url: idUrl,
		abstract: normalizeText(entry?.summary),
		keywords: categories,
		metadata_warnings: buildWarnings({
			title: entry?.title,
			authors,
			year,
			identifier: arxivId,
		}),
	}
}

async function fetchJson(url: URL): Promise<any> {
	const response = await fetchWithRetry(url)
	return response.json()
}

async function fetchText(url: URL): Promise<string> {
	const response = await fetchWithRetry(url)
	return response.text()
}

async function fetchWithRetry(url: URL): Promise<Response> {
	let lastError: unknown

	for (let attempt = 0; attempt < FETCH_RETRY_ATTEMPTS; attempt++) {
		let response: Response
		try {
			response = await fetch(url, { headers: { "User-Agent": SEARCH_TOOL_USER_AGENT } })
		} catch (error) {
			lastError = error
			if (attempt === FETCH_RETRY_ATTEMPTS - 1) {
				break
			}
			await sleep(getRetryDelayMs(undefined, attempt))
			continue
		}

		if (response.ok) {
			return response
		}

		const body = await safeResponseText(response)
		if (!isRetryableStatus(response.status) || attempt === FETCH_RETRY_ATTEMPTS - 1) {
			throw new Error(formatHttpError(url, response.status, body))
		}

		await sleep(getRetryDelayMs(response, attempt))
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500
}

async function safeResponseText(response: Response): Promise<string> {
	try {
		return await response.text()
	} catch {
		return ""
	}
}

function formatHttpError(url: URL, status: number, body: string): string {
	const detail = body.replace(/\s+/g, " ").trim().slice(0, 200)
	return `${url.hostname} returned HTTP ${status}${detail ? `: ${detail}` : ""}`
}

function getRetryDelayMs(response: Response | undefined, attempt: number): number {
	const retryAfter = response?.headers.get("retry-after")
	const retryAfterMs = parseRetryAfterMs(retryAfter)
	if (retryAfterMs !== undefined) return retryAfterMs

	const baseDelay = response?.url.includes("export.arxiv.org") ? 5_000 : 1_000
	return baseDelay * Math.pow(2, attempt)
}

function parseRetryAfterMs(value: string | null | undefined): number | undefined {
	if (!value) return undefined

	const seconds = Number(value)
	if (Number.isFinite(seconds)) {
		return Math.max(0, seconds * 1000)
	}

	const dateMs = Date.parse(value)
	if (Number.isFinite(dateMs)) {
		return Math.max(0, dateMs - Date.now())
	}

	return undefined
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeSources(sources: SearchLiteratureParams["sources"]): SearchSource[] {
	const requested = sources?.length ? sources : ["pubmed", "arxiv"]
	const supported = requested.filter((source): source is SearchSource => source === "pubmed" || source === "arxiv")
	return supported.length > 0 ? [...new Set(supported)] : ["pubmed", "arxiv"]
}

function normalizeMaxResults(value: number | undefined): number {
	if (!value || !Number.isFinite(value)) return 20
	return Math.max(1, Math.min(100, Math.floor(value)))
}

function buildArxivQuery(params: SearchLiteratureParams): string {
	const terms = extractSearchTerms(params.query)
	const query = terms.length > 0 ? terms.map((term) => `all:"${escapeArxivTerm(term)}"`).join(" OR ") : "all:*"
	if (!params.yearFrom && !params.yearTo) return query

	const startYear = params.yearFrom ?? 1900
	const endYear = params.yearTo ?? new Date().getFullYear()
	const dateRange = `submittedDate:[${startYear}01010000 TO ${endYear}12312359]`
	return `(${query}) AND ${dateRange}`
}

function extractSearchTerms(query: string): string[] {
	const quoted = [...query.matchAll(/"([^"]+)"/g)].map((match) => match[1])
	const values =
		quoted.length > 0
			? quoted
			: query
					.replace(/\[[^\]]+\]/g, " ")
					.replace(/[()]/g, " ")
					.split(/\b(?:AND|OR|NOT)\b/i)

	return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]
}

function escapeArxivTerm(term: string): string {
	return term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function emptySourceResult(
	source: SearchSource,
	query: string,
	maxResults: number,
	status: LiteratureRun["status"],
	error: string | null,
): SourceSearchResult {
	return {
		run: {
			source,
			query,
			requested_max_results: maxResults,
			returned_count: 0,
			status,
			error,
		},
		candidates: [],
	}
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value === undefined || value === null) return []
	return Array.isArray(value) ? value : [value]
}

function normalizeText(value: unknown): string {
	const text = textOf(value)
	return text.replace(/\s+/g, " ").trim()
}

function textOf(value: unknown): string {
	if (value === undefined || value === null) return ""
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
	if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(" ")
	if (typeof value === "object") {
		const record = value as Record<string, unknown>
		if (record["#text"] !== undefined) return textOf(record["#text"])
		return Object.entries(record)
			.filter(([key]) => !key.startsWith("@_"))
			.map(([, child]) => textOf(child))
			.filter(Boolean)
			.join(" ")
	}
	return ""
}

function findArticleId(articleIds: any[], idType: string): string {
	const match = articleIds.find((articleId) => String(articleId?.["@_IdType"] || "").toLowerCase() === idType)
	return normalizeText(match)
}

function extractPubMedAbstract(value: unknown): string {
	return asArray(value)
		.map((part) => {
			const label = typeof part === "object" && part ? normalizeText((part as any)["@_Label"]) : ""
			const text = normalizeText(part)
			return label && text ? `${label}: ${text}` : text
		})
		.filter(Boolean)
		.join("\n")
}

function formatPubMedAuthor(author: any): string {
	const collective = normalizeText(author?.CollectiveName)
	if (collective) return collective

	const parts = [normalizeText(author?.ForeName), normalizeText(author?.LastName)].filter(Boolean)
	return parts.length > 0 ? parts.join(" ") : normalizeText(author?.Initials)
}

function extractYear(...values: unknown[]): number | null {
	for (const value of values) {
		const match = normalizeText(value).match(/\b(18|19|20|21)\d{2}\b/)
		if (match) return Number(match[0])
	}
	return null
}

function buildWarnings({
	title,
	authors,
	year,
	identifier,
}: {
	title: unknown
	authors: string[]
	year: number | null
	identifier: string
}): string[] {
	const warnings: string[] = []
	if (!normalizeText(title)) warnings.push("missing_title")
	if (authors.length === 0) warnings.push("missing_authors")
	if (!year) warnings.push("missing_year")
	if (!identifier) warnings.push("missing_identifier")
	return warnings
}

export const searchLiteratureTool = new SearchLiteratureTool()
