import type { ReactNode } from "react"
import { Check, ListFilter } from "lucide-react"

import { Button, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"
import { CandidateListItem } from "./CandidateListItem"
import type {
	CandidateDecisionState,
	CandidateFilter,
	CandidateReviewCounts,
	Retrieval,
	RetrievalCandidate,
} from "./types"

export type CandidateReviewWorkbenchProps = {
	selectedRetrieval?: Retrieval
	candidateFilter: CandidateFilter
	candidateCounts: CandidateReviewCounts
	visibleCandidates: RetrievalCandidate[]
	expandedCandidateAbstracts: Record<string, boolean>
	archiveMenuCandidateNo: string | null
	summaryPanel?: ReactNode
	onCandidateFilterChange: (filter: CandidateFilter) => void
	onToggleCandidateAbstract: (candidateNo: string) => void
	onOpenCandidateUrl: (candidate: RetrievalCandidate) => void
	onSetCandidateState: (candidateNo: string, state: CandidateDecisionState) => void
	onImportCandidate: (candidateNo: string, downloadPdfToReference?: boolean) => void
	onAnalyzeCandidatePdf?: (pdfPath: string) => void
	onArchiveMenuCandidateNoChange: (candidateNo: string | null) => void
	onCloseArchiveMenuOnBlur: () => void
}

const FILTERS: Array<{ value: CandidateFilter; label: string; countKey: keyof CandidateReviewCounts }> = [
	{ value: "All", label: "All", countKey: "all" },
	{ value: "Pending", label: "Pending", countKey: "pending" },
	{ value: "Imported", label: "Imported", countKey: "imported" },
	{ value: "Analyzed", label: "Analyzed", countKey: "analyzed" },
	{ value: "Excluded", label: "Excluded", countKey: "excluded" },
]

const EMPTY_TITLES: Record<CandidateFilter, string> = {
	All: "No retrieval candidates yet",
	Pending: "No pending candidates",
	Imported: "No imported candidates",
	Analyzed: "No analyzed papers",
	Excluded: "No excluded candidates",
}

const EMPTY_DESCRIPTIONS: Record<CandidateFilter, string> = {
	All: "Run a retrieval to populate the review list.",
	Pending: "All candidates in this retrieval have already been excluded or imported.",
	Imported: "No candidates from this retrieval have been imported into the library.",
	Analyzed: "No imported local PDFs have a matching Markdown analysis in reference/analysis yet.",
	Excluded: "No candidates have been excluded in this retrieval.",
}

const getFallbackFilter = (candidateCounts: CandidateReviewCounts): CandidateFilter =>
	candidateCounts.pending > 0 ? "Pending" : candidateCounts.imported > 0 ? "Imported" : "All"

export function CandidateReviewWorkbench({
	candidateFilter,
	candidateCounts,
	visibleCandidates,
	expandedCandidateAbstracts,
	archiveMenuCandidateNo,
	summaryPanel,
	onCandidateFilterChange,
	onToggleCandidateAbstract,
	onOpenCandidateUrl,
	onSetCandidateState,
	onImportCandidate,
	onAnalyzeCandidatePdf,
	onArchiveMenuCandidateNoChange,
	onCloseArchiveMenuOnBlur,
}: CandidateReviewWorkbenchProps) {
	const fallbackFilter = getFallbackFilter(candidateCounts)
	const showFallbackAction = candidateCounts.all > 0 && candidateFilter !== fallbackFilter
	const reviewSummary = [
		`${candidateCounts.pending} pending`,
		`${candidateCounts.imported} imported`,
		`${candidateCounts.analyzed} analyzed`,
		`${candidateCounts.excluded} excluded`,
	].join(" · ")

	return (
		<section className="min-w-0 rounded-md border border-vscode-panel-border bg-vscode-editor-background">
			<div className="flex min-w-0 flex-col gap-2 border-b border-vscode-panel-border px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div className="min-w-0">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<h4 className="text-sm font-semibold">Candidate review</h4>
						<span className="text-xs tabular-nums text-muted-foreground">{candidateCounts.all} papers</span>
					</div>
					<div className="mt-0.5 truncate text-xs text-muted-foreground">{reviewSummary}</div>
				</div>
				<div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5">
					<div
						className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border border-vscode-panel-border bg-vscode-editorWidget-background p-1"
						aria-label="Candidate review filters">
						<ListFilter className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						{FILTERS.map((filter) => {
							const isActive = candidateFilter === filter.value
							const count = candidateCounts[filter.countKey]

							return (
								<StandardTooltip
									key={filter.value}
									content={`Show ${filter.label.toLowerCase()} papers`}>
									<Button
										variant={isActive ? "primary" : "ghost"}
										size="sm"
										aria-label={`Show ${filter.label} candidates, ${count}`}
										aria-pressed={isActive}
										className={cn(
											"h-7 gap-1.5 px-2 text-xs",
											!isActive && "text-vscode-foreground hover:bg-vscode-list-hoverBackground",
										)}
										onClick={() => onCandidateFilterChange(filter.value)}>
										{isActive && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
										<span>{filter.label}</span>
										<span className={cn("tabular-nums", !isActive && "text-muted-foreground")}>
											{count}
										</span>
									</Button>
								</StandardTooltip>
							)
						})}
					</div>
				</div>
			</div>

			{summaryPanel}

			<div className="divide-y divide-vscode-panel-border">
				{visibleCandidates.map((candidate) => (
					<CandidateListItem
						key={candidate.candidate_no}
						candidate={candidate}
						isAbstractOpen={Boolean(expandedCandidateAbstracts[candidate.candidate_no])}
						archiveMenuCandidateNo={archiveMenuCandidateNo}
						onToggleAbstract={onToggleCandidateAbstract}
						onOpenCandidateUrl={onOpenCandidateUrl}
						onSetCandidateState={onSetCandidateState}
						onImportCandidate={onImportCandidate}
						onAnalyzeCandidatePdf={onAnalyzeCandidatePdf}
						onArchiveMenuCandidateNoChange={onArchiveMenuCandidateNoChange}
						onCloseArchiveMenuOnBlur={onCloseArchiveMenuOnBlur}
					/>
				))}

				{visibleCandidates.length === 0 && (
					<div
						role="status"
						className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
						<div>
							<div className="font-medium text-vscode-editor-foreground">
								{EMPTY_TITLES[candidateFilter]}
							</div>
							<p className="mt-1 max-w-md text-xs">{EMPTY_DESCRIPTIONS[candidateFilter]}</p>
						</div>
						{showFallbackAction && (
							<Button variant="outline" size="sm" onClick={() => onCandidateFilterChange(fallbackFilter)}>
								Show {fallbackFilter} candidates
							</Button>
						)}
					</div>
				)}
			</div>
		</section>
	)
}
