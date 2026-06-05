import { ChevronDown } from "lucide-react"
import { RETRIEVAL_SOURCE_OPTIONS } from "@roo-code/types"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui"
import { cn } from "@/lib/utils"
import type { CandidateReviewCounts, Retrieval, Source } from "./types"

type SourceRun = NonNullable<NonNullable<Retrieval["search_provenance"]>["runs"]>[number]

type RetrievalSummaryPanelProps = {
	selectedRetrieval?: Retrieval
	summaryDetailsOpen: boolean
	selectedNotes: string[]
	sourceNotes: SourceRun[]
	searchProvenanceRuns: SourceRun[]
	candidateCounts: CandidateReviewCounts
	onSummaryDetailsOpenChange: (open: boolean) => void
}

const formatSourceLabel = (source: Source) =>
	RETRIEVAL_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source

const formatSourceNote = (run: SourceRun) => {
	if (run.status === "no_results") {
		return `${formatSourceLabel(run.source)}: no results for the current query`
	}
	if (run.error) {
		if (/IEEE_XPLORE_API_KEY|IEEE_API_KEY/i.test(run.error)) {
			return `${formatSourceLabel(run.source)}: API key missing, skipped`
		}
		if (/HTTP 429/.test(run.error)) {
			return `${formatSourceLabel(run.source)}: rate limited, skipped`
		}
		return `${formatSourceLabel(run.source)}: ${run.error}`
	}
	return `${formatSourceLabel(run.source)}: returned ${run.returned_count} records`
}

export function RetrievalSummaryPanel({
	selectedRetrieval,
	summaryDetailsOpen,
	selectedNotes,
	sourceNotes,
	searchProvenanceRuns,
	candidateCounts,
	onSummaryDetailsOpenChange,
}: RetrievalSummaryPanelProps) {
	const summary = selectedRetrieval?.result_summary
	const warningCount = selectedNotes.length + sourceNotes.length
	const shortfall = selectedRetrieval?.shortfall ?? 0
	const statusItems = summary
		? [
				`${summary.total_saved} saved`,
				summary.total_found !== summary.total_saved ? `${summary.total_found} found` : "",
				warningCount > 0 ? `${warningCount} warnings` : "",
				shortfall > 0 ? `${shortfall} shortfall` : "",
				summary.duplicates_removed > 0 ? `${summary.duplicates_removed} duplicates removed` : "",
				candidateCounts.imported > 0 ? `${candidateCounts.imported} imported` : "",
			].filter(Boolean)
		: []

	return (
		<div className="border-t border-vscode-panel-border bg-vscode-editor-background">
			{summary ? (
				<Collapsible open={summaryDetailsOpen} onOpenChange={onSummaryDetailsOpenChange}>
					<div className="px-3 py-2">
						<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
							<span className="font-semibold text-vscode-editor-foreground">Run summary</span>
							<span className="min-w-0 text-muted-foreground">{statusItems.join(" · ")}</span>
							<CollapsibleTrigger asChild>
								<button
									type="button"
									className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-vscode-list-hoverBackground focus-visible:outline focus-visible:outline-vscode-focusBorder"
									aria-label="Toggle execution details">
									<span>Details</span>
									<ChevronDown
										className={cn(
											"h-3.5 w-3.5 shrink-0 transition-transform",
											summaryDetailsOpen ? "rotate-180" : "",
										)}
										aria-hidden="true"
									/>
								</button>
							</CollapsibleTrigger>
						</div>
					</div>
					<CollapsibleContent className="space-y-2 border-t border-vscode-panel-border p-2">
						<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
							{selectedRetrieval?.source_registry_version && (
								<div className="rounded border border-vscode-panel-border p-2">
									Source registry {selectedRetrieval.source_registry_version}
								</div>
							)}
							{selectedRetrieval?.search_provenance?.summary && (
								<div className="rounded border border-vscode-panel-border p-2 sm:col-span-2">
									{selectedRetrieval.search_provenance.summary}
								</div>
							)}
						</div>

						{(selectedNotes.length > 0 || sourceNotes.length > 0) && (
							<div className="space-y-2 rounded border border-vscode-panel-border bg-vscode-editorWidget-background p-2 text-xs text-muted-foreground">
								{selectedNotes.length > 0 && (
									<div className="space-y-1">
										<div className="font-medium text-vscode-editor-foreground">Search notes</div>
										{selectedNotes.map((note) => (
											<div key={note}>{note}</div>
										))}
									</div>
								)}
								{sourceNotes.length > 0 && (
									<div className="space-y-1">
										<div className="font-medium text-vscode-editor-foreground">Source status</div>
										{sourceNotes.map((run) => (
											<div key={`${run.source}-${run.query}-${run.status}`}>
												{formatSourceNote(run)}
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{searchProvenanceRuns.length > 0 && (
							<div className="space-y-2 rounded border border-vscode-panel-border p-2 text-xs text-muted-foreground">
								<div className="font-medium text-vscode-editor-foreground">Source runs</div>
								<div className="space-y-1">
									{searchProvenanceRuns.map((run) => (
										<div
											key={`${run.source}-${run.query}-${run.status}`}
											className="rounded border border-vscode-panel-border px-3 py-2">
											{formatSourceNote(run)}
										</div>
									))}
								</div>
							</div>
						)}
					</CollapsibleContent>
				</Collapsible>
			) : (
				<div className="px-3 py-2 text-xs text-muted-foreground">
					Run a retrieval to populate summary metrics and provenance details.
				</div>
			)}
		</div>
	)
}
