import { Map, RefreshCw } from "lucide-react"
import type { LiteratureEntry } from "@roo-code/types"

import { Button, StandardTooltip } from "@/components/ui"
import type { Retrieval } from "./types"

type LibraryStats = {
	totalEntries?: number
}

export type MapDraftPanelProps = {
	selectedRetrieval?: Retrieval
	libraryEntries: LiteratureEntry[]
	libraryStats?: LibraryStats
	onRefresh: () => void
}

export function MapDraftPanel({ selectedRetrieval, libraryEntries, libraryStats, onRefresh }: MapDraftPanelProps) {
	return (
		<section className="space-y-3">
			<div className="rounded-md border border-vscode-panel-border p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Literature Map</p>
						<h4 className="truncate text-sm font-semibold">Graph and topic map draft</h4>
						<p className="mt-1 text-xs text-muted-foreground">
							This module reserves space for graph views, clusters, and saved map snapshots.
						</p>
					</div>
					<StandardTooltip content="Refresh map draft">
						<Button variant="outline" size="icon" aria-label="Refresh map draft" onClick={onRefresh}>
							<RefreshCw className="h-4 w-4" aria-hidden="true" />
						</Button>
					</StandardTooltip>
				</div>
				<div className="mt-4 grid gap-2 sm:grid-cols-3">
					<div className="rounded-md border border-vscode-panel-border p-3">
						<div className="text-lg font-semibold">{selectedRetrieval?.candidates?.length ?? 0}</div>
						<div className="text-xs text-muted-foreground">retrieval papers</div>
					</div>
					<div className="rounded-md border border-vscode-panel-border p-3">
						<div className="text-lg font-semibold">
							{libraryStats?.totalEntries ?? libraryEntries.length}
						</div>
						<div className="text-xs text-muted-foreground">library papers</div>
					</div>
					<div className="rounded-md border border-vscode-panel-border p-3">
						<div className="text-lg font-semibold">draft</div>
						<div className="text-xs text-muted-foreground">graph model</div>
					</div>
				</div>
			</div>

			<div className="rounded-md border border-vscode-panel-border p-4">
				<div className="flex items-center gap-2 text-sm font-semibold">
					<Map className="h-4 w-4" aria-hidden="true" />
					<span>Planned views</span>
				</div>
				<div className="mt-3 space-y-2 text-sm text-muted-foreground">
					<div className="rounded-md border border-vscode-panel-border px-3 py-2">
						Topic clusters from retrieval output
					</div>
					<div className="rounded-md border border-vscode-panel-border px-3 py-2">
						Source and venue relation graph
					</div>
					<div className="rounded-md border border-vscode-panel-border px-3 py-2">
						Saved map snapshots and annotations
					</div>
				</div>
			</div>
		</section>
	)
}
