import React, { useMemo } from "react"
import { AlertTriangle, CheckCircle2, FileWarning, MessagesSquare, ScrollText } from "lucide-react"
import { Button } from "@/components/ui"
import { RevisionTrackerPanel } from "./RevisionTrackerPanel"

type RevisionWorkbenchProps = {
	project: any
	missing: string[] | null
	snapshots: any[]
	sectionInsights: any
	onOpenFile: (filePath: string) => void
	onCreateSnapshot: () => void
	onFocusSection?: (sectionType: string) => void
	embedded?: boolean
}

export const RevisionWorkbench: React.FC<RevisionWorkbenchProps> = ({
	project,
	missing,
	snapshots,
	sectionInsights,
	onOpenFile,
	onCreateSnapshot,
	onFocusSection,
	embedded = false,
}) => {
	const checklist = useMemo(() => {
		const items = [
			{
				label: "Reviewer concerns have a written response plan",
				done: false,
				action: () => onOpenFile("review/revision-log.md"),
				actionLabel: "Open revision log",
			},
			{
				label: "Current draft is backed up before structural changes",
				done: snapshots.length > 0,
				action: onCreateSnapshot,
				actionLabel: snapshots.length > 0 ? "Snapshot ready" : "Create snapshot",
			},
			{
				label: "All cited keys resolve to reference entries",
				done: (missing?.length ?? 0) === 0,
				action: () => onOpenFile("reference"),
				actionLabel: "Open references",
			},
		]
		return items
	}, [missing?.length, onCreateSnapshot, onOpenFile, snapshots.length])

	if (!project || !["revising", "final", "submitted"].includes(project.stage)) {
		return null
	}

	return (
		<div
			className={`${embedded ? "m-0 rounded-none border-0 bg-transparent p-3" : "mx-3 mt-3 rounded-2xl border p-3"} bg-[linear-gradient(180deg,rgba(251,191,36,0.06),rgba(244,63,94,0.03),transparent)]`}>
			<div className="mb-3 flex items-center gap-2">
				<MessagesSquare className="h-4 w-4 text-amber-600" />
				<h4 className="text-sm font-semibold">Revision Workbench</h4>
			</div>
			<div className={`grid gap-3 ${embedded ? "" : "xl:grid-cols-[1.2fr_0.8fr]"}`}>
				<RevisionTrackerPanel
					project={project}
					sectionInsights={sectionInsights}
					onOpenFile={onOpenFile}
					onFocusSection={onFocusSection}
				/>
				<div className="space-y-3">
					<div className="rounded-xl border bg-background/90 p-3">
						<div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Revision mindset
						</div>
						<p className="text-sm text-muted-foreground">
							In revision mode, make every changed paragraph traceable to a criticism, an evidence gap, or
							a formatting risk. Avoid broad rewrites without preserving a snapshot first.
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							<Button variant="outline" size="sm" onClick={() => onOpenFile("review/revision-log.md")}>
								<ScrollText className="mr-1.5 h-3.5 w-3.5" />
								Revision log
							</Button>
							<Button variant="outline" size="sm" onClick={() => onOpenFile("review")}>
								<FileWarning className="mr-1.5 h-3.5 w-3.5" />
								Review folder
							</Button>
						</div>
					</div>
					<div className="rounded-xl border bg-background/90 p-3">
						<div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Pre-submit checks
						</div>
						<div className="space-y-2">
							{checklist.map((item) => (
								<div key={item.label} className="rounded-lg border bg-muted/30 p-2.5">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-start gap-2">
											{item.done ? (
												<CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
											) : (
												<AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
											)}
											<span className="text-sm text-muted-foreground">{item.label}</span>
										</div>
										<Button variant="ghost" size="sm" className="text-xs" onClick={item.action}>
											{item.actionLabel}
										</Button>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default React.memo(RevisionWorkbench)
