import { useState } from "react"
import { fireEvent, render, screen } from "@/utils/test-utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import userEvent from "@testing-library/user-event"

import { CandidateReviewWorkbench, type CandidateReviewWorkbenchProps } from "../CandidateReviewWorkbench"
import { buildCandidateReviewCounts, filterCandidates } from "../readPaperWorkflow"
import type { CandidateFilter, Retrieval, RetrievalCandidate } from "../types"

const candidate = (overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate => ({
	candidate_no: "C-001",
	state: "候选",
	source: "openalex",
	source_id: "W123",
	title: "Retrieval augmented research agents",
	authors: ["Ada Lovelace", "Grace Hopper"],
	year: 2025,
	venue: "Journal of Research Tools",
	url: "https://example.org/paper",
	abstract: "A study of retrieval workflows for research agents.",
	relevance_reason: "Matches the requested research workflow.",
	existence_confidence: 0.92,
	relevance_confidence: 0.87,
	...overrides,
})

const retrieval = (candidates: RetrievalCandidate[]): Retrieval => ({
	retrieval_no: "RET-001",
	title: "Research agents",
	Q: "Find papers about research agents",
	state: "结果待确认",
	query: "",
	search_keywords: [],
	search_sources: ["openalex"],
	max_results: 20,
	candidates,
})

const candidates = [
	candidate({ candidate_no: "C-001", title: "Pending paper", state: "候选" }),
	candidate({ candidate_no: "C-002", title: "Legacy confirmed paper", state: "已确认" }),
	candidate({ candidate_no: "C-003", title: "Excluded paper", state: "已排除" }),
	candidate({
		candidate_no: "C-004",
		title: "Imported paper",
		state: "已导入",
		reference_status: { libraryImported: true, hasAnalysis: true },
	}),
]

const defaultProps: CandidateReviewWorkbenchProps = {
	selectedRetrieval: retrieval(candidates),
	candidateFilter: "Pending",
	candidateCounts: buildCandidateReviewCounts(candidates),
	visibleCandidates: filterCandidates(candidates, "Pending"),
	expandedCandidateAbstracts: {},
	archiveMenuCandidateNo: null,
	onCandidateFilterChange: vi.fn(),
	onToggleCandidateAbstract: vi.fn(),
	onOpenCandidateUrl: vi.fn(),
	onSetCandidateState: vi.fn(),
	onImportCandidate: vi.fn(),
	onArchiveMenuCandidateNoChange: vi.fn(),
	onCloseArchiveMenuOnBlur: vi.fn(),
}

const renderWorkbench = (props: Partial<CandidateReviewWorkbenchProps> = {}) =>
	render(
		<TooltipProvider>
			<CandidateReviewWorkbench {...defaultProps} {...props} />
		</TooltipProvider>,
	)

function ControlledWorkbench() {
	const [filter, setFilter] = useState<CandidateFilter>("Pending")

	return (
		<TooltipProvider>
			<CandidateReviewWorkbench
				{...defaultProps}
				candidateFilter={filter}
				visibleCandidates={filterCandidates(candidates, filter)}
				onCandidateFilterChange={setFilter}
			/>
		</TooltipProvider>
	)
}

describe("CandidateReviewWorkbench", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("marks Pending as selected when pending candidates exist", () => {
		renderWorkbench()

		expect(screen.getByRole("button", { name: "Show Pending candidates, 2" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(screen.getByRole("button", { name: "Show Imported candidates, 1" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Show Analyzed candidates, 1" })).toBeInTheDocument()
		expect(screen.getByText("Pending paper")).toBeInTheDocument()
		expect(screen.getByText("Legacy confirmed paper")).toBeInTheDocument()
	})

	it("shows only excluded candidates after selecting Excluded", async () => {
		const user = userEvent.setup()
		render(<ControlledWorkbench />)

		await user.click(screen.getByRole("button", { name: "Show Excluded candidates, 1" }))

		expect(screen.getByText("Excluded paper")).toBeInTheDocument()
		expect(screen.queryByText("Pending paper")).not.toBeInTheDocument()
		expect(screen.queryByText("Legacy confirmed paper")).not.toBeInTheDocument()
	})

	it("shows analyzed candidates without opening a dropdown", async () => {
		const user = userEvent.setup()
		render(<ControlledWorkbench />)

		await user.click(screen.getByRole("button", { name: "Show Analyzed candidates, 1" }))

		expect(screen.getByText("Imported paper")).toBeInTheDocument()
		expect(screen.getAllByText("Analyzed").length).toBeGreaterThan(0)
		expect(screen.queryByText("Pending paper")).not.toBeInTheDocument()
	})

	it("renders a filter-specific empty state", () => {
		const onCandidateFilterChange = vi.fn()
		const pendingOnly = [candidate({ title: "Only pending", state: "候选" })]
		renderWorkbench({
			selectedRetrieval: retrieval(pendingOnly),
			candidateFilter: "Imported",
			candidateCounts: buildCandidateReviewCounts(pendingOnly),
			visibleCandidates: [],
			onCandidateFilterChange,
		})

		expect(screen.getByText("No imported candidates")).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Show Pending candidates" }))

		expect(onCandidateFilterChange).toHaveBeenCalledWith("Pending")
	})

	it("calls visible row action handlers with the candidate id", () => {
		const onToggleCandidateAbstract = vi.fn()
		const onOpenCandidateUrl = vi.fn()
		const onSetCandidateState = vi.fn()
		const onImportCandidate = vi.fn()
		const singleCandidate = candidate()

		renderWorkbench({
			selectedRetrieval: retrieval([singleCandidate]),
			candidateCounts: buildCandidateReviewCounts([singleCandidate]),
			visibleCandidates: [singleCandidate],
			onToggleCandidateAbstract,
			onOpenCandidateUrl,
			onSetCandidateState,
			onImportCandidate,
		})

		fireEvent.click(screen.getByRole("button", { name: "Show abstract" }))
		fireEvent.click(screen.getByRole("button", { name: "Open candidate in browser" }))
		fireEvent.click(screen.getByRole("button", { name: "Import candidate" }))
		fireEvent.click(screen.getByRole("button", { name: "Exclude candidate" }))

		expect(onToggleCandidateAbstract).toHaveBeenCalledWith("C-001")
		expect(onOpenCandidateUrl).toHaveBeenCalledWith(singleCandidate)
		expect(onImportCandidate).toHaveBeenCalledWith("C-001")
		expect(onSetCandidateState).toHaveBeenCalledWith("C-001", "已排除")
	})

	it("keeps PDF actions in the candidate menu", () => {
		const onImportCandidate = vi.fn()
		const singleCandidate = candidate({
			source: "arxiv",
			source_id: "2401.00001",
			arxiv_id: "2401.00001",
		})

		renderWorkbench({
			selectedRetrieval: retrieval([singleCandidate]),
			candidateCounts: buildCandidateReviewCounts([singleCandidate]),
			visibleCandidates: [singleCandidate],
			onImportCandidate,
			archiveMenuCandidateNo: singleCandidate.candidate_no,
		})

		fireEvent.click(screen.getByText("Import and download PDF"))

		expect(onImportCandidate).toHaveBeenCalledWith("C-001", true)
	})

	it("shows Analyze only when a candidate has a local PDF path", () => {
		const onAnalyzeCandidatePdf = vi.fn()
		const withLocalPdf = candidate({
			candidate_no: "C-005",
			title: "Imported paper with local PDF",
			state: "已导入",
			reference_status: {
				libraryImported: true,
				hasPdf: true,
				pdfPath: "D:\\papers\\imported.pdf",
			},
		})

		renderWorkbench({
			selectedRetrieval: retrieval([withLocalPdf]),
			candidateFilter: "Imported",
			candidateCounts: buildCandidateReviewCounts([withLocalPdf]),
			visibleCandidates: [withLocalPdf],
			onAnalyzeCandidatePdf,
		})

		fireEvent.click(screen.getByRole("button", { name: "Analyze local PDF" }))

		expect(onAnalyzeCandidatePdf).toHaveBeenCalledWith("D:\\papers\\imported.pdf")
	})

	it("does not show Analyze when a candidate has no local PDF path", () => {
		const withoutLocalPdf = candidate({
			candidate_no: "C-006",
			title: "Imported paper without local PDF",
			state: "已导入",
			reference_status: {
				libraryImported: true,
				hasPdf: false,
			},
		})

		renderWorkbench({
			selectedRetrieval: retrieval([withoutLocalPdf]),
			candidateFilter: "Imported",
			candidateCounts: buildCandidateReviewCounts([withoutLocalPdf]),
			visibleCandidates: [withoutLocalPdf],
		})

		expect(screen.queryByRole("button", { name: "Analyze local PDF" })).not.toBeInTheDocument()
	})
})
