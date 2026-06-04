import { FileText, RefreshCw } from "lucide-react"
import type { LiteratureEntry } from "@roo-code/types"

import { Button, StandardTooltip } from "@/components/ui"

type LibraryStats = {
	totalEntries?: number
	unreadCount?: number
	tagCount?: number
}

export type LibraryDraftPanelProps = {
	libraryEntries: LiteratureEntry[]
	libraryStats?: LibraryStats
	onRefresh: () => void
	onAnalyzePdfs: () => void
	canAnalyzePdfs: boolean
}

const formatLibraryAuthor = (author: { firstName?: string; lastName?: string }) =>
	[author.lastName, author.firstName ? `${author.firstName[0]}.` : ""].filter(Boolean).join(" ")

export function LibraryDraftPanel({
	libraryEntries,
	libraryStats,
	onRefresh,
	onAnalyzePdfs,
	canAnalyzePdfs,
}: LibraryDraftPanelProps) {
	return (
		<section className="space-y-3">
			<div className="rounded-md border border-vscode-panel-border p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Literature Library</p>
						<h4 className="truncate text-sm font-semibold">Imported papers and local library view</h4>
						<p className="mt-1 text-xs text-muted-foreground">
							This module is a draft shell for paper management and filtering.
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap justify-end gap-2">
						<StandardTooltip
							content={
								canAnalyzePdfs
									? "Select local PDFs for paper analysis"
									: "Open a workspace folder to analyze PDFs"
							}>
							<span className="inline-flex">
								<Button
									variant="outline"
									size="sm"
									className="h-8 gap-1 px-2"
									disabled={!canAnalyzePdfs}
									aria-label="Analyze PDFs"
									onClick={onAnalyzePdfs}>
									<FileText className="h-4 w-4" aria-hidden="true" />
									<span>Analyze PDFs</span>
								</Button>
							</span>
						</StandardTooltip>
						<StandardTooltip content="Refresh local literature library">
							<Button
								variant="outline"
								size="icon"
								aria-label="Refresh literature library"
								onClick={onRefresh}>
								<RefreshCw className="h-4 w-4" aria-hidden="true" />
							</Button>
						</StandardTooltip>
					</div>
				</div>
				<div className="mt-4 grid gap-2 sm:grid-cols-3">
					<div className="rounded-md border border-vscode-panel-border p-3">
						<div className="text-lg font-semibold">
							{libraryStats?.totalEntries ?? libraryEntries.length}
						</div>
						<div className="text-xs text-muted-foreground">papers</div>
					</div>
					<div className="rounded-md border border-vscode-panel-border p-3">
						<div className="text-lg font-semibold">{libraryStats?.unreadCount ?? 0}</div>
						<div className="text-xs text-muted-foreground">unread</div>
					</div>
					<div className="rounded-md border border-vscode-panel-border p-3">
						<div className="text-lg font-semibold">{libraryStats?.tagCount ?? 0}</div>
						<div className="text-xs text-muted-foreground">tags</div>
					</div>
				</div>
			</div>

			<div className="rounded-md border border-vscode-panel-border">
				<div className="border-b border-vscode-panel-border px-4 py-3 text-sm font-semibold">
					Recent entries
				</div>
				<div className="divide-y divide-vscode-panel-border">
					{libraryEntries.slice(0, 5).map((entry) => (
						<div key={entry.id} className="px-4 py-3 text-sm">
							<div className="break-words font-medium text-vscode-editor-foreground">{entry.title}</div>
							<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
								{entry.authors?.length > 0 && (
									<span className="min-w-0 truncate">
										{entry.authors.slice(0, 3).map(formatLibraryAuthor).join(", ")}
										{entry.authors.length > 3 ? " et al." : ""}
									</span>
								)}
								{entry.year && <span>{entry.year}</span>}
								{entry.journal && <span className="min-w-0 truncate">{entry.journal}</span>}
								{entry.source && <span>{entry.source}</span>}
							</div>
						</div>
					))}
					{libraryEntries.length === 0 && (
						<div className="px-4 py-8 text-center text-sm text-muted-foreground">
							No imported papers yet. Use retrieval import actions to populate the library.
						</div>
					)}
				</div>
			</div>
		</section>
	)
}
