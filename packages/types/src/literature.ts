export interface Author {
	firstName: string
	lastName: string
	orcid?: string
	affiliation?: string
}

export type LiteratureSource =
	| "pubmed"
	| "arxiv"
	| "semantic-scholar"
	| "crossref"
	| "openalex"
	| "dblp"
	| "ieee-xplore"
	| "acm-dl"
	| "manual"
	| "doi-lookup"

export interface LiteratureNote {
	id: string
	text: string
	createdAt: string
}

export interface LiteratureEntry {
	id: string
	title: string
	authors: Author[]
	year?: number
	journal?: string
	volume?: string
	issue?: string
	pages?: string
	doi?: string
	arxivId?: string
	pmid?: string
	abstract?: string
	keywords: string[]
	source: LiteratureSource
	url?: string
	citationBibtex?: string
	citationApa?: string
	citationVancouver?: string
	notes: LiteratureNote[]
	tags: string[]
	dateAdded: string
	dateModified: string
	relevanceScore?: number
	isRead: boolean
	fullTextPath?: string
}

export interface LiteratureLibrary {
	entries: LiteratureEntry[]
	version: string
	lastModified: string
}

export interface LiteratureSearchQuery {
	query: string
	sources?: LiteratureSource[]
	maxResults?: number
	yearFrom?: number
	yearTo?: number
	sortBy?: "relevance" | "date" | "citations"
}

export interface LiteratureSearchResult {
	query: string
	sources: string[]
	totalResults: number
	results: LiteratureEntry[]
	searchDate: string
}

export interface DeduplicationReport {
	totalBefore: number
	totalAfter: number
	duplicatesRemoved: number
	duplicateGroups: Array<{
		kept: string // entry id
		removed: string[] // entry ids
		reason: "doi" | "title-fuzzy" | "arxiv-id" | "pmid"
	}>
}

export const LITERATURE_LIBRARY_VERSION = "1.0"
export const LITERATURE_LIBRARY_FILENAME = "library.json"
