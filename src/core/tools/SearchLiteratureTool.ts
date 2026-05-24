import { XMLParser } from "fast-xml-parser"

import {
	DEFAULT_RETRIEVAL_SOURCES,
	RETRIEVAL_SOURCES,
	createEmptyRetrievalSourceCounts,
	type RetrievalSource,
	type SearchLiteratureParams,
} from "@roo-code/types"

import { formatResponse } from "../prompts/responses"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

type SearchSource = RetrievalSource

type LiteratureCandidate = {
	source: SearchSource
	source_id: string
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
	relevance_score?: number
	relevance_reason?: string
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
const OPENALEX_EMAIL = "sci-roo@example.com"
const FETCH_RETRY_ATTEMPTS = 3
export const SEARCH_LITERATURE_SOURCE_REGISTRY_VERSION = "1.2"
const SEARCH_SOURCE_REGISTRY: Record<
	SearchSource,
	(params: SearchLiteratureParams, maxResults: number) => Promise<SourceSearchResult>
> = {
	pubmed: searchPubMed,
	arxiv: searchArxiv,
	"semantic-scholar": searchSemanticScholar,
	crossref: searchCrossref,
	openalex: searchOpenAlex,
	dblp: searchDblp,
	"ieee-xplore": searchIeeeXplore,
	"acm-dl": searchAcmDigitalLibrary,
}
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	trimValues: true,
	parseTagValue: false,
})

export class SearchLiteratureTool extends BaseTool<"search_literature"> {
	readonly name = "search_literature" as const

	async execute(params: SearchLiteratureParams, _task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const approved = await askApproval(
				"search_literature",
				`Search for "${params.query}" in academic databases`,
			)
			if (!approved) {
				pushToolResult("User denied literature search request.")
				return
			}

			const result = await searchLiterature(params)
			pushToolResult(formatResponse.toolResult(JSON.stringify(result, null, 2)))
		} catch (error) {
			await handleError("search_literature", error)
		}
	}
}

export async function searchLiterature(params: SearchLiteratureParams) {
	const query = params.query.trim()
	if (!query) {
		throw new Error("search_literature_query_required")
	}
	if (containsCjk(query)) {
		throw new Error("search_literature_query_must_be_english")
	}

	const normalizedParams = { ...params, query }
	const sources = normalizeSources(params.sources)
	const maxResults = normalizeMaxResults(params.maxResults)
	const perSourceMax = maxResults
	const sourceResults = await Promise.all(
		sources.map((source) => searchSource(source, normalizedParams, perSourceMax)),
	)
	const candidates = rankAndFilterCandidates(
		sourceResults.flatMap((result) => result.candidates),
		query,
	).slice(0, maxResults)
	const runs = sourceResults.map((result) => result.run)
	const bySource = buildSourceCounts(candidates)
	const errors = candidates.length === 0 ? ["no_results_found"] : []

	return {
		status:
			candidates.length > 0 ? (runs.some((run) => run.status === "error") ? "partial" : "success") : "no_results",
		query,
		sources,
		maxResults,
		yearFrom: params.yearFrom ?? null,
		yearTo: params.yearTo ?? null,
		source_registry_version: SEARCH_LITERATURE_SOURCE_REGISTRY_VERSION,
		search_provenance: {
			summary: `Searched ${sources.join(", ")} for "${query}".`,
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

function containsCjk(text: string): boolean {
	return /[\p{Script=Han}]/u.test(text)
}

async function searchSource(
	source: SearchSource,
	params: SearchLiteratureParams,
	maxResults: number,
): Promise<SourceSearchResult> {
	try {
		return await SEARCH_SOURCE_REGISTRY[source](
			{
				...params,
				query: buildSourceQuery(source, params.query),
			},
			maxResults,
		)
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

function buildSourceQuery(source: SearchSource, query: string): string {
	const trimmed = query.trim()
	const terms = extractSearchTerms(trimmed)
	if (terms.length === 0) return trimmed
	if (source === "pubmed" || source === "ieee-xplore" || source === "arxiv") {
		return trimmed
	}
	return terms[0]
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

async function searchSemanticScholar(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search")
	url.searchParams.set("query", query)
	url.searchParams.set("limit", String(maxResults))
	url.searchParams.set("fields", "title,authors,year,venue,abstract,url,externalIds")
	if (params.yearFrom || params.yearTo) {
		url.searchParams.set("year", `${params.yearFrom ?? ""}-${params.yearTo ?? ""}`)
	}

	const response = await fetchJson(url, getSemanticScholarHeaders())
	const papers: unknown[] = Array.isArray(response?.data) ? response.data : []
	const candidates = papers.map((paper, index) => semanticScholarPaperToCandidate(paper, index + 1))

	return {
		run: {
			source: "semantic-scholar",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No Semantic Scholar records returned.",
		},
		candidates,
	}
}

async function searchCrossref(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const url = new URL("https://api.crossref.org/works")
	url.searchParams.set("query", query)
	url.searchParams.set("rows", String(maxResults))
	url.searchParams.set("sort", "relevance")
	url.searchParams.set("mailto", NCBI_EMAIL)
	const filter = buildCrossrefFilter([], params.yearFrom, params.yearTo)
	if (filter) url.searchParams.set("filter", filter)

	const response = await fetchJson(url)
	const works: unknown[] = Array.isArray(response?.message?.items) ? response.message.items : []
	const candidates = works.map((work, index) => crossrefWorkToCandidate(work, index + 1))

	return {
		run: {
			source: "crossref",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No Crossref records returned.",
		},
		candidates,
	}
}

async function searchOpenAlex(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const url = new URL("https://api.openalex.org/works")
	url.searchParams.set("search", query)
	url.searchParams.set("per-page", String(maxResults))
	url.searchParams.set("mailto", OPENALEX_EMAIL)
	if (params.yearFrom || params.yearTo) {
		url.searchParams.set("filter", buildOpenAlexYearFilter(params.yearFrom, params.yearTo))
	}

	const response = await fetchJson(url)
	const works: unknown[] = Array.isArray(response?.results) ? response.results : []
	const candidates = works.map((work, index) => openAlexWorkToCandidate(work, index + 1))

	return {
		run: {
			source: "openalex",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No OpenAlex records returned.",
		},
		candidates,
	}
}

async function searchDblp(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const url = new URL("https://dblp.org/search/publ/api")
	url.searchParams.set("q", query)
	url.searchParams.set("format", "json")
	url.searchParams.set("h", String(maxResults))

	const response = await fetchJson(url)
	const hits = asArray(response?.result?.hits?.hit)
	const candidates = hits
		.map((hit, index) => dblpHitToCandidate(hit, index + 1))
		.filter((candidate) => isWithinYearRange(candidate.year, params.yearFrom, params.yearTo))

	return {
		run: {
			source: "dblp",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No DBLP records returned.",
		},
		candidates,
	}
}

async function searchIeeeXplore(params: SearchLiteratureParams, maxResults: number): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const apiKey = process.env.IEEE_XPLORE_API_KEY || process.env.IEEE_API_KEY
	if (!apiKey) {
		return emptySourceResult(
			"ieee-xplore",
			query,
			maxResults,
			"error",
			"IEEE Xplore search requires IEEE_XPLORE_API_KEY or IEEE_API_KEY.",
		)
	}

	const url = new URL("https://ieeexploreapi.ieee.org/api/v1/search/articles")
	url.searchParams.set("apikey", apiKey)
	url.searchParams.set("format", "json")
	url.searchParams.set("querytext", query)
	url.searchParams.set("max_records", String(maxResults))
	url.searchParams.set("start_record", "1")
	url.searchParams.set("sort_field", "relevance")
	url.searchParams.set("sort_order", "desc")
	if (params.yearFrom) url.searchParams.set("start_year", String(params.yearFrom))
	if (params.yearTo) url.searchParams.set("end_year", String(params.yearTo))

	const response = await fetchJson(url)
	const articles: unknown[] = Array.isArray(response?.articles) ? response.articles : []
	const candidates = articles.map((article, index) => ieeeArticleToCandidate(article, index + 1))

	return {
		run: {
			source: "ieee-xplore",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No IEEE Xplore records returned.",
		},
		candidates,
	}
}

async function searchAcmDigitalLibrary(
	params: SearchLiteratureParams,
	maxResults: number,
): Promise<SourceSearchResult> {
	const query = params.query.trim()
	const url = new URL("https://api.crossref.org/works")
	url.searchParams.set("query", query)
	url.searchParams.set("rows", String(maxResults))
	url.searchParams.set("sort", "relevance")
	url.searchParams.set("filter", buildCrossrefFilter(["prefix:10.1145"], params.yearFrom, params.yearTo))
	url.searchParams.set("mailto", NCBI_EMAIL)

	const response = await fetchJson(url)
	const works: unknown[] = Array.isArray(response?.message?.items) ? response.message.items : []
	const candidates = works.map((work, index) =>
		crossrefWorkToCandidate(work, index + 1, "acm-dl", "ACM Digital Library"),
	)

	return {
		run: {
			source: "acm-dl",
			query,
			requested_max_results: maxResults,
			returned_count: candidates.length,
			status: candidates.length > 0 ? "success" : "no_results",
			error: candidates.length > 0 ? null : "No ACM Digital Library records returned from Crossref metadata.",
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
		source_id: pmid,
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
		source_id: arxivId,
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

function semanticScholarPaperToCandidate(paper: any, sourceRank: number): LiteratureCandidate {
	const externalIds = paper?.externalIds ?? {}
	const authors = asArray(paper?.authors)
		.map((author) => normalizeText(author?.name || author))
		.filter(Boolean)
	const doi = stripDoiUrl(normalizeText(externalIds?.DOI))
	const pmid = normalizeText(externalIds?.PubMed)
	const arxivId = normalizeText(externalIds?.ArXiv)

	return {
		source: "semantic-scholar",
		source_id: normalizeText(paper?.paperId),
		source_rank: sourceRank,
		title: normalizeText(paper?.title) || "(untitled Semantic Scholar record)",
		authors,
		year: normalizeYearValue(paper?.year),
		venue: normalizeText(paper?.venue) || "Semantic Scholar",
		doi,
		pmid,
		arxiv_id: arxivId,
		url: normalizeText(paper?.url) || buildIdentifierUrl({ doi, pmid, arxivId }),
		abstract: normalizeText(paper?.abstract),
		keywords: [],
		metadata_warnings: buildWarnings({
			title: paper?.title,
			authors,
			year: normalizeYearValue(paper?.year),
			identifier: doi || pmid || arxivId || normalizeText(paper?.paperId),
		}),
	}
}

function crossrefWorkToCandidate(
	work: any,
	sourceRank: number,
	source: SearchSource = "crossref",
	fallbackVenue = "Crossref",
): LiteratureCandidate {
	const authors = asArray(work?.author).map(formatCrossrefAuthor).filter(Boolean)
	const doi = stripDoiUrl(normalizeText(work?.DOI))
	const year = extractYearFromDateParts(
		work?.published?.["date-parts"],
		work?.issued?.["date-parts"],
		work?.created?.["date-parts"],
	)
	const abstract = stripHtml(normalizeText(work?.abstract))
	const title = normalizeText(firstValue(work?.title))

	return {
		source,
		source_id: doi || normalizeText(work?.URL),
		source_rank: sourceRank,
		title: title || "(untitled Crossref record)",
		authors,
		year,
		venue: normalizeText(firstValue(work?.["container-title"]) || work?.publisher || work?.type) || fallbackVenue,
		doi,
		pmid: "",
		arxiv_id: "",
		url: normalizeText(work?.URL || work?.resource?.primary?.URL) || buildIdentifierUrl({ doi }),
		abstract,
		keywords: asArray(work?.subject).map(normalizeText).filter(Boolean),
		metadata_warnings: buildWarnings({
			title,
			authors,
			year,
			identifier: doi || normalizeText(work?.URL),
		}),
	}
}

function dblpHitToCandidate(hit: any, sourceRank: number): LiteratureCandidate {
	const info = hit?.info ?? {}
	const authors = asArray(info?.authors?.author)
		.map((author) => normalizeText(author?.text || author))
		.filter(Boolean)
	const year = normalizeYearValue(info?.year)
	const title = stripHtml(normalizeText(info?.title))
	const doi = stripDoiUrl(normalizeText(info?.doi))

	return {
		source: "dblp",
		source_id: normalizeText(info?.key || hit?.["@id"]),
		source_rank: sourceRank,
		title: title || "(untitled DBLP record)",
		authors,
		year,
		venue: normalizeText(info?.venue || info?.publisher || info?.type) || "DBLP",
		doi,
		pmid: "",
		arxiv_id: "",
		url: normalizeText(info?.ee) || normalizeText(info?.url),
		abstract: "",
		keywords: normalizeText(info?.type) ? [normalizeText(info?.type)] : [],
		metadata_warnings: buildWarnings({
			title,
			authors,
			year,
			identifier: doi || normalizeText(info?.key || info?.url),
		}),
	}
}

function ieeeArticleToCandidate(article: any, sourceRank: number): LiteratureCandidate {
	const authors = extractIeeeAuthors(article?.authors)
	const doi = stripDoiUrl(normalizeText(article?.doi))
	const year = normalizeYearValue(article?.publication_year) ?? normalizeYearValue(article?.publicationYear)
	const title = stripHtml(normalizeText(article?.title || article?.article_title))

	return {
		source: "ieee-xplore",
		source_id: normalizeText(article?.article_number || article?.arnumber),
		source_rank: sourceRank,
		title: title || "(untitled IEEE Xplore record)",
		authors,
		year,
		venue:
			normalizeText(article?.publication_title || article?.publicationTitle || article?.publisher) ||
			"IEEE Xplore",
		doi,
		pmid: "",
		arxiv_id: "",
		url:
			normalizeText(article?.html_url || article?.pdf_url || article?.abstract_url) ||
			buildIdentifierUrl({ doi }),
		abstract: stripHtml(normalizeText(article?.abstract)),
		keywords: extractIeeeKeywords(article),
		metadata_warnings: buildWarnings({
			title,
			authors,
			year,
			identifier: doi || normalizeText(article?.article_number || article?.arnumber),
		}),
	}
}

function openAlexWorkToCandidate(work: any, sourceRank: number): LiteratureCandidate {
	const authors = asArray(work?.authorships)
		.map((authorship) => normalizeText(authorship?.author?.display_name || authorship?.raw_author_name))
		.filter(Boolean)
	const doi = stripDoiUrl(normalizeText(work?.doi || work?.ids?.doi))
	const year = normalizeYearValue(work?.publication_year) ?? extractYear(work?.publication_date)
	const venue =
		normalizeText(work?.primary_location?.source?.display_name) ||
		normalizeText(work?.host_venue?.display_name) ||
		normalizeText(work?.type) ||
		"OpenAlex"
	const abstract = openAlexInvertedIndexToText(work?.abstract_inverted_index)
	const arxivId = findArxivId(
		normalizeText(work?.primary_location?.landing_page_url),
		normalizeText(work?.best_oa_location?.landing_page_url),
		normalizeText(work?.ids?.doi),
	)
	const url =
		normalizeText(work?.primary_location?.landing_page_url) ||
		normalizeText(work?.best_oa_location?.landing_page_url) ||
		normalizeText(work?.id) ||
		buildIdentifierUrl({ doi, arxivId })
	const keywords = [
		...asArray(work?.keywords).map((keyword) => normalizeText(keyword?.display_name)),
		...asArray(work?.topics).map((topic) => normalizeText(topic?.display_name)),
	].filter(Boolean)

	return {
		source: "openalex",
		source_id: normalizeText(work?.id || work?.ids?.openalex),
		source_rank: sourceRank,
		title: normalizeText(work?.display_name || work?.title) || "(untitled OpenAlex record)",
		authors,
		year,
		venue,
		doi,
		pmid: "",
		arxiv_id: arxivId,
		url,
		abstract,
		keywords: [...new Set(keywords)],
		metadata_warnings: buildWarnings({
			title: work?.display_name || work?.title,
			authors,
			year,
			identifier: doi || arxivId || normalizeText(work?.id),
		}),
	}
}

async function fetchJson(url: URL, headers?: Record<string, string>): Promise<any> {
	const response = await fetchWithRetry(url, headers)
	return response.json()
}

async function fetchText(url: URL, headers?: Record<string, string>): Promise<string> {
	const response = await fetchWithRetry(url, headers)
	return response.text()
}

async function fetchWithRetry(url: URL, headers?: Record<string, string>): Promise<Response> {
	let lastError: unknown

	for (let attempt = 0; attempt < FETCH_RETRY_ATTEMPTS; attempt++) {
		let response: Response
		try {
			response = await fetch(url, { headers: { "User-Agent": SEARCH_TOOL_USER_AGENT, ...headers } })
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

function getSemanticScholarHeaders(): Record<string, string> | undefined {
	const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || process.env.S2_API_KEY
	return apiKey ? { "x-api-key": apiKey } : undefined
}

function normalizeSources(sources: SearchLiteratureParams["sources"]): SearchSource[] {
	const allowed = new Set<SearchSource>(RETRIEVAL_SOURCES)
	const requested = sources?.length ? sources : DEFAULT_RETRIEVAL_SOURCES
	const supported = requested.filter((source): source is SearchSource => allowed.has(source))
	return supported.length > 0 ? [...new Set(supported)] : DEFAULT_RETRIEVAL_SOURCES
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

function buildOpenAlexYearFilter(yearFrom: number | undefined, yearTo: number | undefined): string {
	return [
		yearFrom ? `from_publication_date:${yearFrom}-01-01` : "",
		yearTo ? `to_publication_date:${yearTo}-12-31` : "",
	]
		.filter(Boolean)
		.join(",")
}

function buildCrossrefFilter(prefixes: string[], yearFrom: number | undefined, yearTo: number | undefined): string {
	return [...prefixes, yearFrom ? `from-pub-date:${yearFrom}` : "", yearTo ? `until-pub-date:${yearTo}` : ""]
		.filter(Boolean)
		.join(",")
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

function normalizeYearValue(value: unknown): number | null {
	const year = Number(value)
	if (!Number.isFinite(year)) return null
	const normalized = Math.floor(year)
	return normalized >= 1500 && normalized <= 3000 ? normalized : null
}

function firstValue(value: unknown): unknown {
	return Array.isArray(value) ? value[0] : value
}

function stripDoiUrl(value: string): string {
	return value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").trim()
}

function stripHtml(value: string): string {
	return value
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim()
}

function formatCrossrefAuthor(author: any): string {
	const name = [normalizeText(author?.given), normalizeText(author?.family)].filter(Boolean).join(" ")
	return name || normalizeText(author?.name)
}

function rankAndFilterCandidates(candidates: LiteratureCandidate[], query: string): LiteratureCandidate[] {
	const terms = extractQueryTermsForRelevance(query)
	if (terms.length === 0) return candidates

	const scored = candidates
		.map((candidate) => {
			const evaluation = scoreCandidateRelevance(candidate, terms)
			return {
				...candidate,
				relevance_score: evaluation.score,
				relevance_reason: evaluation.reason,
				__score: evaluation.score,
			}
		})
		.sort((left, right) => {
			if ((right.__score ?? 0) !== (left.__score ?? 0)) return (right.__score ?? 0) - (left.__score ?? 0)
			return (left.source_rank ?? Number.MAX_SAFE_INTEGER) - (right.source_rank ?? Number.MAX_SAFE_INTEGER)
		})

	const matchingCandidates = scored.filter((candidate) => (candidate.__score ?? 0) > 0.12)
	const orderedCandidates = matchingCandidates
	return orderedCandidates.map(({ __score, ...candidate }) => candidate)
}

function extractQueryTermsForRelevance(query: string): string[] {
	const trimmed = normalizeText(query)
	if (!trimmed) return []

	const quotedTerms = [
		...trimmed.matchAll(/"([^"]+)"/g),
		...trimmed.matchAll(/'([^']+)'/g),
		...trimmed.matchAll(/“([^”]+)”/g),
	]
		.map((match) => match[1])
		.filter(Boolean)

	const booleanSegments = trimmed
		.replace(/"([^"]+)"/g, " ")
		.replace(/'([^']+)'/g, " ")
		.replace(/“([^”]+)”/g, " ")
		.split(/\b(?:AND|OR|NOT)\b/gi)
		.map((segment) =>
			segment
				.replace(/[()\[\]{}]/g, " ")
				.replace(/[，。；;:,.!?]/g, " ")
				.trim(),
		)
		.filter((segment) => segment.length >= 2)

	const cjkTerms = [...trimmed.matchAll(/[\p{Script=Han}]{2,}/gu)].map((match) => match[0])
	const englishPhrases = [...trimmed.matchAll(/[A-Za-z][A-Za-z0-9+-]*(?:\s+[A-Za-z0-9+-]+){1,6}/g)].map((match) =>
		match[0].trim(),
	)

	return uniqueTerms(
		[...quotedTerms, ...cjkTerms, ...englishPhrases, ...booleanSegments].filter((term) => !isQueryStopTerm(term)),
	)
}

function scoreCandidateRelevance(candidate: LiteratureCandidate, terms: string[]): { score: number; reason: string } {
	const title = normalizeSearchText(candidate.title)
	const abstract = normalizeSearchText(candidate.abstract)
	const venue = normalizeSearchText(candidate.venue)
	const keywords = normalizeSearchText(candidate.keywords.join(" "))
	const haystack = `${title} ${keywords} ${abstract} ${venue}`.trim()

	let score = 0
	const matches: string[] = []

	for (const term of terms) {
		const normalizedTerm = normalizeSearchText(term)
		if (!normalizedTerm) continue

		const termTokens = normalizedTerm.split(/\s+/).filter((token) => token.length > 1)
		const termInTitle = includesTerm(title, normalizedTerm)
		const termInKeywords = includesTerm(keywords, normalizedTerm)
		const termInAbstract = includesTerm(abstract, normalizedTerm)
		const termInVenue = includesTerm(venue, normalizedTerm)

		if (termInTitle) {
			score += 0.45
			matches.push(`title:${normalizedTerm}`)
			continue
		}

		if (termInKeywords) {
			score += 0.28
			matches.push(`keywords:${normalizedTerm}`)
			continue
		}

		if (termInAbstract) {
			score += 0.18
			matches.push(`abstract:${normalizedTerm}`)
			continue
		}

		if (termInVenue) {
			score += 0.08
			matches.push(`venue:${normalizedTerm}`)
			continue
		}

		if (termTokens.length > 1 && termTokens.every((token) => includesTerm(haystack, token))) {
			score += 0.12
			matches.push(`tokens:${normalizedTerm}`)
		}
	}

	const sourceBoost = candidate.source_rank ? Math.max(0, 0.12 - (candidate.source_rank - 1) * 0.01) : 0
	const normalizedScore = Math.min(1, score + sourceBoost)
	const reason = matches.length > 0 ? `matched ${matches.slice(0, 3).join(", ")}` : ""
	return { score: normalizedScore, reason }
}

function includesTerm(haystack: string, term: string): boolean {
	if (!haystack || !term) return false
	return normalizeSearchText(haystack).includes(normalizeSearchText(term))
}

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKC")
		.replace(/[^\p{L}\p{N}\s]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
}

function uniqueTerms(values: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const value of values) {
		const normalized = normalizeSearchText(value)
		if (!normalized || seen.has(normalized)) continue
		seen.add(normalized)
		result.push(value.trim())
	}
	return result
}

function isQueryStopTerm(term: string): boolean {
	const normalized = normalizeSearchText(term)
	return [
		"and",
		"or",
		"not",
		"journal",
		"journals",
		"paper",
		"papers",
		"literature",
		"recent",
		"latest",
		"progress",
		"advances",
		"advance",
	].includes(normalized)
}

function extractYearFromDateParts(...values: unknown[]): number | null {
	for (const value of values) {
		const year = normalizeYearValue(asArray(asArray(value)[0])[0])
		if (year) return year
	}
	return null
}

function isWithinYearRange(year: number | null, yearFrom: number | undefined, yearTo: number | undefined): boolean {
	if (!year) return true
	if (yearFrom && year < yearFrom) return false
	if (yearTo && year > yearTo) return false
	return true
}

function extractIeeeAuthors(value: unknown): string[] {
	if (!value) return []
	if (Array.isArray(value)) {
		return value.map((author) => normalizeText(author?.full_name || author?.name || author)).filter(Boolean)
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>
		return asArray(record.authors)
			.map((author) => normalizeText((author as any)?.full_name || (author as any)?.name || author))
			.filter(Boolean)
	}
	return []
}

function extractIeeeKeywords(article: any): string[] {
	const keywords = [
		...asArray(article?.index_terms?.ieee_terms?.terms),
		...asArray(article?.index_terms?.author_terms?.terms),
		...asArray(article?.controlledterms),
	].map(normalizeText)
	return [...new Set(keywords.filter(Boolean))]
}

function openAlexInvertedIndexToText(value: unknown): string {
	if (!value || typeof value !== "object" || Array.isArray(value)) return ""
	const words: Array<{ word: string; index: number }> = []
	for (const [word, positions] of Object.entries(value as Record<string, unknown>)) {
		for (const position of asArray(positions)) {
			const index = Number(position)
			if (Number.isFinite(index)) {
				words.push({ word, index })
			}
		}
	}
	return words
		.sort((a, b) => a.index - b.index)
		.map((item) => item.word)
		.join(" ")
}

function findArxivId(...values: string[]): string {
	for (const value of values) {
		const match = value.match(/arxiv(?:\.|:|\/abs\/|\/pdf\/)(\d{4}\.\d{4,5}(?:v\d+)?)/i)
		if (match?.[1]) return match[1].replace(/\.pdf$/i, "")
	}
	return ""
}

function buildIdentifierUrl({ doi, pmid, arxivId }: { doi?: string; pmid?: string; arxivId?: string }): string {
	if (doi) return `https://doi.org/${doi}`
	if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
	if (arxivId) return `https://arxiv.org/abs/${arxivId}`
	return ""
}

function buildSourceCounts(candidates: LiteratureCandidate[]): Record<SearchSource, number> {
	const counts = createEmptyRetrievalSourceCounts()
	for (const candidate of candidates) {
		counts[candidate.source] = (counts[candidate.source] || 0) + 1
	}
	return counts
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
