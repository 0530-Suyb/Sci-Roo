import React, { useMemo } from "react"
import { Badge, Button } from "@/components/ui"
import { BookMarked, CheckCircle2, Clock3, FileOutput, NotebookPen, ScanSearch } from "lucide-react"

type WorkspaceOverviewProps = {
	project: any
	writingState: any
	wordStatus: any
	sectionInsights: any
	focusSuggestions?: {
		recentSection?: { key: string; label: string; lastEditedAt: string | null } | null
		blockedSection?: { key: string; label: string } | null
		citationSection?: { key: string; label: string; missingCitationCount: number } | null
	}
	referenceEntries: any[]
	cited: string[] | null
	missing: string[] | null
	snapshots: any[]
	onStageChange: (stage: string) => void
	onSnapshot: () => void
	onScanCitations: () => void
	onGenerateBib: () => void
	onFocusSection?: (sectionType: string) => void
	embedded?: boolean
}

const STAGES = [
	{ id: "planning", label: "Planning" },
	{ id: "literature-review", label: "Literature" },
	{ id: "writing", label: "Writing" },
	{ id: "revising", label: "Revising" },
	{ id: "final", label: "Final" },
	{ id: "submitted", label: "Submitted" },
]

export const WorkspaceOverview: React.FC<WorkspaceOverviewProps> = ({
	project,
	writingState,
	wordStatus,
	sectionInsights,
	focusSuggestions,
	referenceEntries,
	cited,
	missing,
	snapshots,
	onStageChange,
	onSnapshot,
	onScanCitations,
	onGenerateBib,
	onFocusSection,
	embedded = false,
}) => {
	const stats = useMemo(() => {
		const sections = Object.values((writingState?.sectionStatus ?? {}) as Record<string, string>)
		const drafted = sections.filter((status) => status !== "outline").length
		const finalized = sections.filter((status) => status === "final").length
		const total = sections.length
		const blocked = Object.values((sectionInsights ?? {}) as Record<string, any>).filter(
			(section: any) => section?.readiness === "blocked",
		).length
		const needsWork = Object.values((sectionInsights ?? {}) as Record<string, any>).filter(
			(section: any) => section?.readiness === "needs-work",
		).length
		const overSized = Object.values((wordStatus ?? {}) as Record<string, any>).filter(
			(section: any) => section?.overLimit,
		).length

		return { drafted, finalized, total, blocked, needsWork, overSized }
	}, [sectionInsights, wordStatus, writingState?.sectionStatus])

	const nextAction = useMemo(() => {
		if (focusSuggestions?.blockedSection) {
			return `Draft ${focusSuggestions.blockedSection.label.toLowerCase()} next to remove the main writing blocker.`
		}
		if (focusSuggestions?.citationSection) {
			return `Resolve citation gaps in ${focusSuggestions.citationSection.label} before the next polish pass.`
		}
		if (focusSuggestions?.recentSection) {
			return `Resume ${focusSuggestions.recentSection.label} and continue the current writing thread.`
		}
		if ((missing?.length ?? 0) > 0) {
			return "Scan and resolve missing cite keys before generating the final bibliography."
		}
		if ((snapshots?.length ?? 0) === 0) {
			return "Create a snapshot before making structural changes."
		}
		return "The project looks stable. Keep drafting and use this panel for quick health checks."
	}, [focusSuggestions, missing?.length, snapshots?.length])

	const hotspotSections = useMemo(() => {
		return Object.entries((sectionInsights ?? {}) as Record<string, any>)
			.map(([key, insight]) => ({
				key,
				label: String(insight?.label ?? key),
				readiness: String(insight?.readiness ?? "ready"),
				nextStep: String(insight?.nextStep ?? ""),
			}))
			.filter((section) => section.readiness !== "ready")
			.slice(0, 3)
	}, [sectionInsights])

	return (
		<div className={`${embedded ? "h-full p-3" : "p-4"}`}>
			<div className="space-y-3">
				<div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
					<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						Project focus
					</div>
					<p className="mt-2 text-sm text-muted-foreground">{nextAction}</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{focusSuggestions?.recentSection && onFocusSection && (
							<Button
								variant="outline"
								size="sm"
								className="text-xs"
								onClick={() => onFocusSection(focusSuggestions.recentSection!.key)}>
								Resume {focusSuggestions.recentSection.label}
							</Button>
						)}
						{focusSuggestions?.blockedSection && onFocusSection && (
							<Button
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={() => onFocusSection(focusSuggestions.blockedSection!.key)}>
								Open blocker
							</Button>
						)}
					</div>
				</div>

				<div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
					<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Stage</div>
					<div className="mt-3 flex flex-wrap gap-2">
						{STAGES.map((stage) => {
							const active = project?.stage === stage.id
							return (
								<button
									key={stage.id}
									type="button"
									onClick={() => onStageChange(stage.id)}
									className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
										active
											? "border-emerald-500 bg-emerald-500 text-white"
											: "border-border hover:bg-muted"
									}`}>
									{stage.label}
								</button>
							)
						})}
					</div>
				</div>

				<div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
					<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Health</div>
					<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
						<div className="rounded-xl bg-muted/40 p-2.5">
							<div className="text-[11px] text-muted-foreground">Words</div>
							<div className="mt-1 font-semibold">
								{writingState?.totalWords ?? 0}/{writingState?.targetWords ?? 0}
							</div>
						</div>
						<div className="rounded-xl bg-muted/40 p-2.5">
							<div className="text-[11px] text-muted-foreground">Sections</div>
							<div className="mt-1 font-semibold">
								{stats.drafted}/{stats.total || 0} drafted
							</div>
						</div>
						<div className="rounded-xl bg-muted/40 p-2.5">
							<div className="text-[11px] text-muted-foreground">Library</div>
							<div className="mt-1 font-semibold">{referenceEntries.length}</div>
						</div>
						<div className="rounded-xl bg-muted/40 p-2.5">
							<div className="text-[11px] text-muted-foreground">Citations</div>
							<div className="mt-1 font-semibold">{cited?.length ?? 0}</div>
						</div>
					</div>
					<div className="mt-3 flex flex-wrap gap-2 text-xs">
						<Badge variant="secondary" className="gap-1 rounded-full">
							<CheckCircle2 className="h-3 w-3" />
							Final {stats.finalized}
						</Badge>
						<Badge variant="secondary" className="gap-1 rounded-full">
							<Clock3 className="h-3 w-3" />
							Blocked {stats.blocked}
						</Badge>
						<Badge variant="secondary" className="gap-1 rounded-full">
							<BookMarked className="h-3 w-3" />
							Needs work {stats.needsWork}
						</Badge>
						<Badge variant="secondary" className="gap-1 rounded-full">
							<BookMarked className="h-3 w-3" />
							Over limit {stats.overSized}
						</Badge>
					</div>
				</div>

				{hotspotSections.length > 0 && (
					<div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
						<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							Sections to watch
						</div>
						<div className="mt-3 space-y-2">
							{hotspotSections.map((section) => (
								<div key={section.key} className="rounded-xl border bg-muted/25 p-2.5">
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<div className="text-xs font-medium">{section.label}</div>
											<div className="mt-0.5 text-[11px] text-muted-foreground">
												{section.nextStep}
											</div>
										</div>
										{onFocusSection && (
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-[11px]"
												onClick={() => onFocusSection(section.key)}>
												Open
											</Button>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				<div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
					<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						Quick actions
					</div>
					<div className="mt-3 grid gap-2">
						<Button variant="outline" size="sm" className="justify-start" onClick={onSnapshot}>
							<NotebookPen className="mr-1.5 h-3.5 w-3.5" />
							Create snapshot
						</Button>
						<Button variant="outline" size="sm" className="justify-start" onClick={onScanCitations}>
							<ScanSearch className="mr-1.5 h-3.5 w-3.5" />
							Scan citations
						</Button>
						<Button variant="outline" size="sm" className="justify-start" onClick={onGenerateBib}>
							<FileOutput className="mr-1.5 h-3.5 w-3.5" />
							Generate bibliography
						</Button>
					</div>
					<div className="mt-3 text-[11px] text-muted-foreground">
						{missing?.length ?? 0} missing cite keys, {snapshots.length} snapshots saved.
					</div>
				</div>
			</div>
		</div>
	)
}

export default React.memo(WorkspaceOverview)
