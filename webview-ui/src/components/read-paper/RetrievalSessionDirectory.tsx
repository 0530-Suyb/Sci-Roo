import { ChevronLeft, FileSearch, Library, Plus, RefreshCw, Trash2 } from "lucide-react"
import { DEFAULT_RETRIEVAL_SOURCES, RETRIEVAL_SOURCE_OPTIONS, type RetrievalListItem } from "@roo-code/types"

import { Button, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"
import { deriveReadPaperWorkflowState } from "./readPaperWorkflow"
import type { ReadPaperWorkflowState, Retrieval, Source } from "./types"

type RetrievalSessionDirectoryProps = {
	retrievals: RetrievalListItem[]
	selectedRetrievalNo?: string
	selectedRetrieval?: Retrieval
	directoryCollapsed: boolean
	onCreate: () => void
	onSelect: (retrievalNo: string) => void
	onRequestDelete: (retrievalNo: string) => void
	onCollapse?: () => void
	onRefresh?: () => void
	onImport?: (retrievalNo: string) => void
}

const formatSourceLabel = (source: Source) =>
	RETRIEVAL_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source

const formatSourceSummary = (sources: Source[] | undefined) => {
	const activeSources = sources?.length ? sources : DEFAULT_RETRIEVAL_SOURCES
	const visibleSources = activeSources.slice(0, 3).map(formatSourceLabel).join(", ")
	const remainingCount = activeSources.length - 3
	return `${activeSources.length} sources: ${visibleSources}${remainingCount > 0 ? ` +${remainingCount}` : ""}`
}

const formatUpdatedAt = (value: string | undefined) => {
	if (!value) return "No update"
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) return value
	return parsed.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

const getWorkflowState = (
	item: RetrievalListItem,
	selectedRetrieval: Retrieval | undefined,
): ReadPaperWorkflowState => {
	if (item.retrieval_no === selectedRetrieval?.retrieval_no) {
		return deriveReadPaperWorkflowState({
			retrieval: selectedRetrieval,
			hasRetrievalInput: true,
			isRunStarting: false,
		})
	}
	if (item.state === "已归档") return "Archived"
	if (item.paper_count > 0) return "Results Ready"
	return item.Q || item.query || item.title ? "Ready" : "Draft"
}

export function RetrievalSessionDirectory({
	retrievals,
	selectedRetrievalNo,
	selectedRetrieval,
	directoryCollapsed,
	onCreate,
	onSelect,
	onRequestDelete,
	onCollapse,
	onRefresh,
	onImport,
}: RetrievalSessionDirectoryProps) {
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<FileSearch className="h-3.5 w-3.5 shrink-0" />
					<h4 className="truncate text-xs font-semibold">Retrieval sessions</h4>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<span className="text-xs text-muted-foreground">{retrievals.length}</span>
					{onCollapse && (
						<StandardTooltip content="Hide navigation and retrieval history">
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7 rounded-full"
								aria-label="Hide navigation and retrieval history"
								disabled={directoryCollapsed}
								onClick={onCollapse}>
								<ChevronLeft className="h-3.5 w-3.5" />
							</Button>
						</StandardTooltip>
					)}
					{onRefresh && (
						<StandardTooltip content="Refresh retrieval sessions">
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7 rounded-full"
								aria-label="Refresh retrieval sessions"
								onClick={onRefresh}>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
						</StandardTooltip>
					)}
					<StandardTooltip content="Create a new retrieval session">
						<Button
							variant="primary"
							size="icon"
							className="h-7 w-7 rounded-full"
							aria-label="Create a new retrieval session"
							onClick={onCreate}>
							<Plus className="h-4 w-4" />
						</Button>
					</StandardTooltip>
				</div>
			</div>
			<div className="space-y-2">
				{retrievals.map((item) => {
					const isSelected = item.retrieval_no === selectedRetrievalNo
					const workflowState = getWorkflowState(item, selectedRetrieval)

					return (
						<div
							key={item.retrieval_no}
							className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1.5">
							<button
								type="button"
								onClick={() => onSelect(item.retrieval_no)}
								className={cn(
									"min-w-0 flex-1 rounded-md border px-2 py-2 text-left text-xs",
									"focus-visible:outline focus-visible:outline-vscode-focusBorder",
									isSelected
										? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"
										: "border-vscode-panel-border hover:bg-vscode-list-hoverBackground",
								)}>
								<div className="truncate font-medium">{item.title}</div>
								<div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
									<span className="truncate">
										{item.paper_count ?? 0} papers · {workflowState}
									</span>
									<span className="shrink-0 truncate">{formatUpdatedAt(item.updated_at)}</span>
								</div>
								<div
									className={cn(
										"mt-1 truncate text-[11px] text-muted-foreground",
										isSelected ? "block" : "hidden group-hover:block",
									)}>
									{formatSourceSummary(item.sources as Source[] | undefined)}
								</div>
							</button>
							<div
								className={cn(
									"flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
									isSelected && "opacity-100",
								)}>
								{onImport && (
									<StandardTooltip content="Import retrieval to library">
										<Button
											variant="outline"
											size="icon"
											aria-label="Import retrieval"
											onClick={() => onImport(item.retrieval_no)}>
											<Library className="h-3.5 w-3.5" />
										</Button>
									</StandardTooltip>
								)}
								<StandardTooltip content="Delete retrieval record">
									<Button
										variant="outline"
										size="icon"
										aria-label="Delete retrieval record"
										onClick={() => onRequestDelete(item.retrieval_no)}>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</StandardTooltip>
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}
