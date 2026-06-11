import type {
	CandidateFilter,
	CandidateReviewCounts,
	ReadPaperWorkflowState,
	Retrieval,
	RetrievalCandidate,
} from "./types"

export function isCandidateImported(candidate: RetrievalCandidate): boolean {
	return Boolean(candidate.reference_status?.libraryImported || candidate.state === "已导入")
}

export function isCandidateAnalyzed(candidate: RetrievalCandidate): boolean {
	return Boolean(candidate.reference_status?.hasAnalysis)
}

export function isCandidatePending(candidate: RetrievalCandidate): boolean {
	return !isCandidateImported(candidate) && candidate.state !== "已排除"
}

function isCandidateResolvedForWorkflow(candidate: RetrievalCandidate): boolean {
	return candidate.state === "已排除" || isCandidateImported(candidate)
}

export function buildCandidateReviewCounts(candidates: RetrievalCandidate[]): CandidateReviewCounts {
	return candidates.reduce<CandidateReviewCounts>(
		(counts, candidate) => ({
			all: counts.all + 1,
			pending: counts.pending + (isCandidatePending(candidate) ? 1 : 0),
			excluded: counts.excluded + (candidate.state === "已排除" ? 1 : 0),
			imported: counts.imported + (isCandidateImported(candidate) ? 1 : 0),
			analyzed: counts.analyzed + (isCandidateAnalyzed(candidate) ? 1 : 0),
		}),
		{ all: 0, pending: 0, excluded: 0, imported: 0, analyzed: 0 },
	)
}

export function getDefaultCandidateFilter(candidates: RetrievalCandidate[]): CandidateFilter {
	return buildCandidateReviewCounts(candidates).pending > 0 ? "Pending" : "All"
}

export function filterCandidates(candidates: RetrievalCandidate[], filter: CandidateFilter): RetrievalCandidate[] {
	if (filter === "All") return candidates
	if (filter === "Pending") return candidates.filter(isCandidatePending)
	if (filter === "Imported") return candidates.filter(isCandidateImported)
	if (filter === "Analyzed") return candidates.filter(isCandidateAnalyzed)
	return candidates.filter((candidate) => candidate.state === "已排除")
}

export function deriveReadPaperWorkflowState(input: {
	retrieval: Retrieval | undefined
	hasRetrievalInput: boolean
	isRunStarting: boolean
}): ReadPaperWorkflowState {
	const { retrieval, hasRetrievalInput, isRunStarting } = input
	if (retrieval?.state === "已归档") return "Archived"
	if (isRunStarting || retrieval?.run_status === "running") return "Running"
	if (!retrieval) return hasRetrievalInput ? "Ready" : "Draft"

	const counts = buildCandidateReviewCounts(retrieval.candidates ?? [])
	if (counts.all > 0 && retrieval.candidates.every(isCandidateResolvedForWorkflow)) return "Reviewed"
	if (counts.all > 0) return "Results Ready"
	return hasRetrievalInput ? "Ready" : "Draft"
}

const normalizeExternalUrl = (value: string | undefined): string => {
	const trimmed = value?.trim()
	if (!trimmed) return ""
	if (/^https?:\/\//i.test(trimmed)) return trimmed
	return ""
}

export function buildCandidateUrl(candidate: RetrievalCandidate): string {
	const directUrl = normalizeExternalUrl(candidate.url)
	if (directUrl) return directUrl
	if (candidate.doi?.trim()) return `https://doi.org/${encodeURIComponent(candidate.doi.trim())}`
	if (candidate.pmid?.trim()) return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(candidate.pmid.trim())}/`
	if (candidate.arxiv_id?.trim()) return `https://arxiv.org/abs/${encodeURIComponent(candidate.arxiv_id.trim())}`
	return ""
}
