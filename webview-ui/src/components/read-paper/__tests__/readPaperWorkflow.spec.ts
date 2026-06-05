import { describe, expect, it } from "vitest"

import {
	buildCandidateReviewCounts,
	buildCandidateUrl,
	deriveReadPaperWorkflowState,
	filterCandidates,
	getDefaultCandidateFilter,
} from "../readPaperWorkflow"
import type { Retrieval, RetrievalCandidate } from "../types"

const bySource = {
	pubmed: 0,
	arxiv: 0,
	"semantic-scholar": 0,
	crossref: 0,
	openalex: 0,
	dblp: 0,
	"ieee-xplore": 0,
	"acm-dl": 0,
}

const candidate = (overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate => ({
	candidate_no: "candidate_0001",
	state: "候选",
	source: "arxiv",
	source_id: "2401.00001",
	title: "Test Paper",
	authors: ["A. Researcher"],
	year: 2024,
	venue: "arXiv",
	doi: "",
	pmid: "",
	arxiv_id: "2401.00001",
	url: "",
	abstract: "",
	...overrides,
})

const retrieval = (overrides: Partial<Retrieval> = {}): Retrieval => ({
	retrieval_no: "retrieval_0001",
	title: "Test Retrieval",
	Q: "Find papers about retrieval-augmented research agents",
	state: "未确认",
	execution_mode: "lightweight_job",
	retrieval_strategy: "scholarly_only",
	query: "retrieval augmented research agents",
	search_keywords: ["retrieval", "agents"],
	search_sources: ["arxiv"],
	max_results: 20,
	search_provenance: { summary: "", runs: [] },
	result_summary: {
		total_found: 0,
		total_saved: 0,
		by_source: bySource,
		duplicates_removed: 0,
		errors: [],
	},
	candidates: [],
	run_status: "idle",
	actual_total_results: 0,
	shortfall: 0,
	...overrides,
})

describe("readPaperWorkflow", () => {
	it("derives Draft when no retrieval exists and no input is runnable", () => {
		expect(
			deriveReadPaperWorkflowState({
				retrieval: undefined,
				hasRetrievalInput: false,
				isRunStarting: false,
			}),
		).toBe("Draft")
	})

	it("derives Running from local pending state before backend status returns", () => {
		expect(
			deriveReadPaperWorkflowState({
				retrieval: retrieval(),
				hasRetrievalInput: true,
				isRunStarting: true,
			}),
		).toBe("Running")
	})

	it("derives Results Ready when pending candidates exist", () => {
		expect(
			deriveReadPaperWorkflowState({
				retrieval: retrieval({ candidates: [candidate()] }),
				hasRetrievalInput: true,
				isRunStarting: false,
			}),
		).toBe("Results Ready")
	})

	it("derives Reviewed when all candidates are excluded or imported", () => {
		expect(
			deriveReadPaperWorkflowState({
				retrieval: retrieval({
					candidates: [
						candidate({ state: "已排除" }),
						candidate({
							candidate_no: "candidate_0002",
							state: "候选",
							reference_status: { libraryImported: true },
						}),
					],
				}),
				hasRetrievalInput: true,
				isRunStarting: false,
			}),
		).toBe("Reviewed")
	})

	it("keeps legacy confirmed candidates pending until they are imported or excluded", () => {
		expect(
			deriveReadPaperWorkflowState({
				retrieval: retrieval({ candidates: [candidate({ state: "已确认" })] }),
				hasRetrievalInput: true,
				isRunStarting: false,
			}),
		).toBe("Results Ready")
	})

	it("counts candidate review buckets", () => {
		expect(
			buildCandidateReviewCounts([
				candidate(),
				candidate({ candidate_no: "candidate_0002", state: "已确认" }),
				candidate({ candidate_no: "candidate_0003", state: "已排除" }),
				candidate({
					candidate_no: "candidate_0004",
					reference_status: { libraryImported: true },
				}),
			]),
		).toEqual({ all: 4, pending: 2, excluded: 1, imported: 1 })
	})

	it("defaults to Pending only when pending candidates exist", () => {
		expect(getDefaultCandidateFilter([candidate()])).toBe("Pending")
		expect(getDefaultCandidateFilter([candidate({ state: "已确认" })])).toBe("Pending")
		expect(getDefaultCandidateFilter([candidate({ state: "已排除" })])).toBe("All")
	})

	it("filters imported candidates independently from candidate decision state", () => {
		const imported = candidate({ reference_status: { libraryImported: true } })
		expect(filterCandidates([candidate(), imported], "Imported")).toEqual([imported])
	})

	it("treats legacy confirmed candidates as pending in review filters", () => {
		const legacyConfirmed = candidate({ candidate_no: "candidate_0002", state: "已确认" })
		expect(filterCandidates([candidate(), legacyConfirmed], "Pending")).toEqual([candidate(), legacyConfirmed])
	})

	it("prefers direct URL, then DOI, PubMed, and arXiv identifiers", () => {
		expect(buildCandidateUrl(candidate({ url: "https://example.org/paper" }))).toBe("https://example.org/paper")
		expect(buildCandidateUrl(candidate({ url: "", doi: "10.1000/test" }))).toBe("https://doi.org/10.1000%2Ftest")
		expect(buildCandidateUrl(candidate({ url: "", doi: "", pmid: "12345" }))).toBe(
			"https://pubmed.ncbi.nlm.nih.gov/12345/",
		)
		expect(buildCandidateUrl(candidate({ url: "", doi: "", pmid: "", arxiv_id: "2401.00001" }))).toBe(
			"https://arxiv.org/abs/2401.00001",
		)
	})
})
