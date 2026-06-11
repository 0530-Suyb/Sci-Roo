import type { RetrievalSource, RetrievalStrategy } from "@roo-code/types"

export type Source = RetrievalSource
export type Strategy = RetrievalStrategy
export type ImportTarget = "literature_library"
export type ReadPaperModule = "retrieval" | "library" | "map" | "settings"

export type RetrievalCandidate = {
	candidate_no: string
	state: string
	source: Source
	source_id?: string
	title: string
	authors: string[]
	year?: number | null
	venue?: string
	doi?: string
	pmid?: string
	arxiv_id?: string
	url?: string
	abstract?: string
	relevance_score?: number | null
	relevance_reason?: string
	existence_confidence?: number | null
	relevance_confidence?: number | null
	verified_sources?: string[]
	discovery_sources?: string[]
	match_evidence?: string[]
	metadata_warnings?: string[]
	reference_status?: {
		libraryImported?: boolean
		hasReferenceEntry?: boolean
		hasPdf?: boolean
		hasAnalysis?: boolean
		libraryEntryId?: string
		citeKey?: string
		pdfPath?: string
		analysisPath?: string
	}
}

export type Retrieval = {
	retrieval_no: string
	title: string
	Q: string
	state: string
	execution_mode?: "lightweight_job"
	retrieval_strategy?: Strategy
	planner_profile_id?: string
	planner_profile_name?: string
	query: string
	search_keywords: string[]
	search_sources: Source[]
	max_results: number
	year_from?: number | null
	year_to?: number | null
	search_provenance?: {
		summary?: string
		runs?: Array<{
			source: Source
			query: string
			requested_max_results: number
			returned_count: number
			status: "success" | "partial" | "error" | "no_results"
			error?: string | null
		}>
	}
	result_summary?: {
		total_found: number
		total_saved: number
		duplicates_removed: number
		errors: string[]
		by_source: Partial<Record<Source, number>>
	}
	candidates: RetrievalCandidate[]
	run_status?: "idle" | "running" | "completed" | "error" | "aborted"
	actual_total_results?: number
	shortfall?: number
	source_registry_version?: string
	last_run_at?: string
	last_completed_at?: string
	last_error_at?: string
}

export type FormState = {
	title: string
	Q: string
	query: string
	search_keywords: string
	retrieval_strategy: Strategy
	search_sources: Source[]
	max_results: number
	year_from: string
	year_to: string
}

export type WorkspaceFormState = {
	planner_profile_id: string
	planner_profile_name: string
	default_sources: Source[]
	default_retrieval_strategy: Strategy
	default_max_results: string
	default_year_from: string
	default_year_to: string
	default_import_target: ImportTarget
}

export type ReadPaperWorkflowState = "Draft" | "Ready" | "Running" | "Results Ready" | "Reviewed" | "Archived"

export type CandidateFilter = "All" | "Pending" | "Imported" | "Analyzed" | "Excluded"

export type CandidateReviewCounts = {
	all: number
	pending: number
	excluded: number
	imported: number
	analyzed: number
}

export type DraftMode = "unsynced" | "seeded_from_defaults" | "bound_to_retrieval"
export type CandidateDecisionState = "已排除"
