import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	FileText,
	FolderOpen,
	GitBranch,
	Library,
	Loader2,
	PanelRightClose,
	PanelRightOpen,
	Play,
	RefreshCcw,
	ScrollText,
	Sparkles,
	Eye,
} from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { ReferencePanel } from "./ReferencePanel"

type PaperWritingViewProps = {
	onDone: () => void
	onOpenResearchPipeline: () => void
}

type SideTab = "references" | "outline" | "checks"
const STAGE_OPTIONS = [
	{ id: "planning", label: "Planning" },
	{ id: "literature-review", label: "Literature" },
	{ id: "writing", label: "Writing" },
	{ id: "revising", label: "Revising" },
	{ id: "final", label: "Final" },
	{ id: "submitted", label: "Submitted" },
] as const

const TEXT_ACTIONS = [
	{ label: "Rewrite", command: "paperRewriteSelection" },
	{ label: "Rephrase", command: "paperRephraseSelection" },
	{ label: "Concise", command: "paperMakeConciseSelection" },
	{ label: "Academic", command: "paperMakeAcademicSelection" },
	{ label: "Expand", command: "paperExpandAcademicParagraph" },
	{ label: "Add cite placeholder", command: "paperAddCitationPlaceholder" },
	{ label: "To Chinese", command: "paperTranslateSelectionChinese" },
	{ label: "To English", command: "paperTranslateSelectionEnglish" },
]

type OutlineItem = {
	id: string
	level: 1 | 2 | 3
	title: string
	line: number
}

const PaperWritingView: React.FC<PaperWritingViewProps> = ({ onDone, onOpenResearchPipeline }) => {
	const { paperProjectState, paperReferenceState, paperSnapshotState } = useExtensionState()

	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [sidePanelOpen, setSidePanelOpen] = useState(true)
	const [sideTab, setSideTab] = useState<SideTab>("references")

	const project = paperProjectState?.project ?? null
	const workspaceState = paperProjectState?.workspaceState ?? null
	const referenceEntries = paperReferenceState?.entries ?? paperProjectState?.referenceEntries ?? []
	const uncatalogued = paperReferenceState?.uncatalogued ?? paperProjectState?.uncatalogued ?? []
	const cited = paperReferenceState?.cited ?? null
	const missing = paperReferenceState?.missing ?? null
	const bibGenerated = paperReferenceState?.bibGenerated ?? false
	const bibPreview = paperReferenceState?.bibPreview ?? null
	const _snapshots = paperSnapshotState?.snapshots ?? []

	useEffect(() => {
		vscode.postMessage({ type: "paperProjectLoad" })
		const timer = setTimeout(() => setLoading(false), 1500)
		return () => clearTimeout(timer)
	}, [])

	useEffect(() => {
		if (paperProjectState) {
			setLoading(false)
		}
	}, [paperProjectState])

	const manuscript = workspaceState?.manuscript ?? null
	const editorContext = workspaceState?.editorContext ?? null
	const gitStatus = workspaceState?.git ?? null
	const assets = workspaceState?.assets ?? null
	const checks = useMemo(() => workspaceState?.checks ?? [], [workspaceState?.checks])
	const outline: OutlineItem[] = manuscript?.outline ?? []
	const recommendedAction =
		workspaceState?.recommendedAction ?? "Open the main manuscript and continue drafting in the editor."
	const canRunSelectionActions = !!editorContext?.hasSelection
	const warningChecks = useMemo(() => checks.filter((check: any) => check.severity === "warning"), [checks])
	const infoChecks = useMemo(() => checks.filter((check: any) => check.severity === "info"), [checks])
	const readyChecks = useMemo(() => checks.filter((check: any) => check.severity === "ready"), [checks])
	const quickWorkspaceSummary = useMemo(() => {
		if (gitStatus?.available && gitStatus.hasChanges) {
			return `${gitStatus.changedFiles} changed file${gitStatus.changedFiles > 1 ? "s" : ""} in working tree`
		}
		if (manuscript?.hasPdf) {
			return "Latest PDF is available"
		}
		return "Build the manuscript once this pass feels stable"
	}, [gitStatus?.available, gitStatus?.changedFiles, gitStatus?.hasChanges, manuscript?.hasPdf])

	const handleRefreshProject = useCallback(() => {
		setRefreshing(true)
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectRefresh",
		})
		setTimeout(() => setRefreshing(false), 2500)
	}, [])

	const handleStageChange = useCallback((stage: string) => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectStageUpdate",
			text: stage,
		})
	}, [])

	const handleCreateSnapshot = useCallback(() => {
		vscode.postMessage({
			type: "paperSnapshotCreate",
			action: "snapshotCreate",
			query: `Manual snapshot at ${new Date().toLocaleString()}`,
		})
	}, [])

	const handleScanCitations = useCallback(() => {
		vscode.postMessage({
			type: "paperReferenceScanTex",
			action: "referenceScanTex",
		})
	}, [])

	const handleGenerateBib = useCallback(() => {
		vscode.postMessage({
			type: "paperReferenceGenerateBib",
			action: "referenceGenerateBib",
		})
	}, [])

	const handleSeedRevisionLog = useCallback(() => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "revisionLogSeed",
		})
	}, [])

	const handleWorkspaceCommand = useCallback(
		(
			command:
				| "paperOpenManuscript"
				| "paperBuildManuscript"
				| "paperViewPdf"
				| "paperOpenSourceControl"
				| "paperRewriteSelection"
				| "paperRephraseSelection"
				| "paperMakeConciseSelection"
				| "paperMakeAcademicSelection"
				| "paperExpandAcademicParagraph"
				| "paperAddCitationPlaceholder"
				| "paperTranslateSelectionChinese"
				| "paperTranslateSelectionEnglish",
		) => {
			vscode.postMessage({
				type: "paperWorkspaceCommand",
				action: "workspaceCommand",
				query: command,
			})
		},
		[],
	)

	const openProjectFile = useCallback(
		(relativePath: string | null | undefined, options?: { create?: boolean; content?: string; line?: number }) => {
			if (!project || !relativePath) {
				return
			}
			const normalizedPath = `${String(project.rootPath).replace(/[\\/]$/, "")}/${relativePath}`.replace(
				/\//g,
				"\\",
			)
			vscode.postMessage({
				type: "openFile",
				text: normalizedPath,
				values: options,
			})
		},
		[project],
	)

	const focusSummary = useMemo(() => {
		if (!manuscript?.exists) {
			return "Open the manuscript and start drafting in the editor."
		}
		if (editorContext?.onPrimaryManuscript && manuscript?.currentHeading) {
			return `You are working inside ${manuscript.currentHeading}.`
		}
		if (editorContext?.onPrimaryManuscript) {
			return "You are in the main manuscript."
		}
		return "Open main.tex to continue the paper in context."
	}, [editorContext?.onPrimaryManuscript, manuscript?.currentHeading, manuscript?.exists])

	if (loading && !paperProjectState) {
		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-2 border-b px-4 py-3">
					<Button variant="ghost" size="icon" onClick={onDone}>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<FileText className="h-5 w-5" />
					<h3 className="text-lg font-semibold">Paper Writing</h3>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span className="text-sm">Loading project...</span>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
				<Button variant="ghost" size="icon" onClick={onDone}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<FileText className="h-5 w-5" />
				<h3 className="text-lg font-semibold">Paper Writing</h3>
				{project && (
					<>
						<span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
							{project.templateId}
						</span>
						<span className="text-xs text-muted-foreground">{project.name}</span>
					</>
				)}
				<div className="ml-auto flex items-center gap-2">
					{project && (
						<Button variant="outline" size="sm" onClick={handleRefreshProject}>
							<RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
							{refreshing ? "Refreshing..." : "Refresh"}
						</Button>
					)}
				</div>
			</div>

			{!project ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<div className="max-w-lg rounded-2xl border bg-card p-6 text-center">
						<FileText className="mx-auto h-10 w-10 text-primary opacity-80" />
						<h4 className="mt-4 text-base font-semibold">No paper project is active</h4>
						<p className="mt-2 text-sm text-muted-foreground">
							Create or open your research project from the Research Pipeline panel, then come back here
							to write, build, and review the manuscript.
						</p>
						<div className="mt-5 flex justify-center">
							<Button variant="primary" size="sm" onClick={onOpenResearchPipeline}>
								Open Research Pipeline
							</Button>
						</div>
					</div>
				</div>
			) : (
				<div className="flex min-h-0 flex-1">
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="border-b bg-background/95 px-4 py-3">
							<div className="flex flex-wrap items-start gap-3">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<h4 className="truncate text-sm font-semibold">{project.name}</h4>
										<span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
											{project.templateId}
										</span>
									</div>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<StatusPill label={`${manuscript?.wordCount ?? 0} words`} />
										<StatusPill
											label={`${missing?.length ?? 0} missing cites`}
											tone={(missing?.length ?? 0) > 0 ? "warning" : "neutral"}
										/>
										{(manuscript?.citationPlaceholderCount ?? 0) > 0 && (
											<StatusPill
												label={`${manuscript?.citationPlaceholderCount ?? 0} placeholders`}
												tone="warning"
											/>
										)}
										{gitStatus?.available && <StatusPill label={gitStatus.branch ?? "detached"} />}
										{gitStatus?.available && gitStatus.hasChanges && (
											<StatusPill label={`${gitStatus.changedFiles} changed`} tone="warning" />
										)}
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<label className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-[11px] text-muted-foreground">
										<span>Stage</span>
										<select
											value={project.stage}
											onChange={(event) => handleStageChange(event.target.value)}
											className="bg-transparent text-foreground outline-none">
											{STAGE_OPTIONS.map((stage) => (
												<option key={stage.id} value={stage.id}>
													{stage.label}
												</option>
											))}
										</select>
									</label>
									<Button
										variant="primary"
										size="sm"
										onClick={() => openProjectFile(project.primaryManuscriptPath)}>
										Continue writing
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleWorkspaceCommand("paperBuildManuscript")}>
										<Play className="mr-1.5 h-3.5 w-3.5" />
										Build PDF
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleWorkspaceCommand("paperViewPdf")}>
										<Eye className="mr-1.5 h-3.5 w-3.5" />
										View PDF
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setSidePanelOpen((open) => !open)}
										title={sidePanelOpen ? "Hide side panel" : "Show side panel"}>
										{sidePanelOpen ? (
											<PanelRightClose className="h-4 w-4" />
										) : (
											<PanelRightOpen className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
							<div className="mt-3 rounded-xl border bg-muted/25 px-3 py-2">
								<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
									Today
								</div>
								<div className="mt-1 text-sm text-foreground">{recommendedAction}</div>
							</div>
						</div>

						<div className="grid flex-1 gap-4 overflow-auto px-4 py-4 lg:grid-cols-[1.3fr_1fr]">
							<div className="space-y-4">
								<section className="rounded-2xl border bg-card p-4">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="flex items-center gap-2">
												<ScrollText className="h-4 w-4 text-primary" />
												<h5 className="text-sm font-semibold">Writing focus</h5>
											</div>
											<p className="mt-1 text-sm text-muted-foreground">{focusSummary}</p>
										</div>
										<span className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
											{project.primaryManuscriptPath}
										</span>
									</div>
									<div className="mt-4 rounded-2xl border bg-background/70 p-4">
										<div className="flex flex-wrap items-center gap-2">
											<StatusPill label={`${manuscript?.wordCount ?? 0} words`} />
											<StatusPill label={formatManuscriptStatus(manuscript?.status)} />
											{(missing?.length ?? 0) > 0 && (
												<StatusPill
													label={`${missing?.length ?? 0} missing cites`}
													tone="warning"
												/>
											)}
											{(manuscript?.citationPlaceholderCount ?? 0) > 0 && (
												<StatusPill
													label={`${manuscript?.citationPlaceholderCount ?? 0} placeholders`}
													tone="warning"
												/>
											)}
											{manuscript?.hasPdf && <StatusPill label="PDF ready" tone="ready" />}
											{manuscript?.currentHeading && (
												<StatusPill label={manuscript.currentHeading} />
											)}
										</div>
										<div className="mt-3 rounded-xl border bg-muted/30 px-3 py-2">
											<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
												What to do now
											</div>
											<p className="mt-1 text-sm text-foreground">{recommendedAction}</p>
										</div>
										<p className="mt-2 text-xs text-muted-foreground">
											Last edited:{" "}
											{manuscript?.lastEdited
												? new Date(manuscript.lastEdited).toLocaleString()
												: "Not yet"}
										</p>
									</div>
									<div className="mt-4 flex flex-wrap gap-2">
										<Button
											variant="primary"
											size="sm"
											onClick={() => openProjectFile(project.primaryManuscriptPath)}>
											Open main.tex
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleWorkspaceCommand("paperBuildManuscript")}>
											Build with LaTeX Workshop
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleWorkspaceCommand("paperViewPdf")}>
											Open PDF preview
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												openProjectFile("latex/references.bib", { create: true, content: "" })
											}>
											Open references.bib
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleWorkspaceCommand("paperOpenSourceControl")}>
											Open Source Control
										</Button>
										<Button variant="ghost" size="sm" onClick={handleScanCitations}>
											Scan citations
										</Button>
										<Button variant="ghost" size="sm" onClick={handleGenerateBib}>
											Generate bib
										</Button>
										<Button variant="ghost" size="sm" onClick={handleCreateSnapshot}>
											Snapshot
										</Button>
									</div>
								</section>

								<section className="rounded-2xl border bg-card p-4">
									<div className="flex items-center gap-2">
										<Sparkles className="h-4 w-4 text-primary" />
										<h5 className="text-sm font-semibold">Selection assistant</h5>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										Sci-Roo only touches the passage you have selected in the editor. Use these
										buttons or the VS Code right-click menu while drafting in `main.tex`.
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										{TEXT_ACTIONS.map((action) => (
											<Button
												key={action.command}
												variant="outline"
												size="sm"
												disabled={!canRunSelectionActions}
												onClick={() =>
													handleWorkspaceCommand(
														action.command as
															| "paperRewriteSelection"
															| "paperRephraseSelection"
															| "paperMakeConciseSelection"
															| "paperMakeAcademicSelection"
															| "paperExpandAcademicParagraph"
															| "paperAddCitationPlaceholder"
															| "paperTranslateSelectionChinese"
															| "paperTranslateSelectionEnglish",
													)
												}>
												{action.label}
											</Button>
										))}
									</div>
									{!canRunSelectionActions && (
										<p className="mt-2 text-xs text-muted-foreground">
											Select a passage in the editor first, then use these actions or the
											right-click menu.
										</p>
									)}
									<div className="mt-4 rounded-xl border bg-muted/30 p-3 text-sm">
										<div className="flex items-center gap-2 text-foreground">
											<CheckCircle2 className="h-4 w-4 text-emerald-500" />
											<span className="font-medium">Editor status</span>
										</div>
										<div className="mt-2 flex flex-wrap gap-2 text-muted-foreground">
											<StatusPill
												label={
													editorContext?.hasSelection
														? `${editorContext.selectionWordCount} words selected`
														: "No selection"
												}
												tone={editorContext?.hasSelection ? "ready" : "neutral"}
											/>
											<StatusPill
												label={
													editorContext?.onPrimaryManuscript
														? "In main manuscript"
														: editorContext?.inProject
															? "Inside project"
															: "Out of context"
												}
												tone={editorContext?.onPrimaryManuscript ? "ready" : "neutral"}
											/>
											{editorContext?.filePath && (
												<StatusPill label={truncatePath(editorContext.filePath)} />
											)}
										</div>
									</div>
								</section>

								<section className="rounded-2xl border bg-card p-4">
									<div className="flex items-center gap-2">
										<GitBranch className="h-4 w-4 text-primary" />
										<h5 className="text-sm font-semibold">Checkpoint</h5>
									</div>
									{gitStatus?.available ? (
										<div className="mt-3 grid gap-3 sm:grid-cols-2">
											<WorkflowCard
												icon={<GitBranch className="h-4 w-4 text-primary" />}
												title={gitStatus.branch ? `On ${gitStatus.branch}` : "Git ready"}
												body={
													gitStatus.hasChanges
														? `${gitStatus.changedFiles} file(s) changed. Review Source Control when this writing pass feels stable.`
														: "Working tree is clean. Good time to start the next drafting or revision pass."
												}
											/>
											<WorkflowCard
												icon={<FileText className="h-4 w-4 text-primary" />}
												title="Build status"
												body={
													manuscript?.hasPdf
														? `${quickWorkspaceSummary}. ${cited?.length ?? 0} cite key(s) detected.`
														: quickWorkspaceSummary
												}
											/>
										</div>
									) : (
										<div className="mt-3 grid gap-3 sm:grid-cols-2">
											<WorkflowCard
												icon={<FileText className="h-4 w-4 text-primary" />}
												title="LaTeX Workshop first"
												body="Write, compile, and preview in the native editor flow. Sci-Roo stays out of the way and helps only when you ask."
											/>
											<WorkflowCard
												icon={<GitBranch className="h-4 w-4 text-primary" />}
												title="Git-friendly checkpoints"
												body="Initialize git in this project to make revision checkpoints and source-control review part of the writing flow."
											/>
										</div>
									)}
								</section>
							</div>

							{sidePanelOpen && (
								<div className="flex min-h-0 flex-col rounded-2xl border bg-card">
									<div className="border-b px-2 py-2">
										<div className="flex gap-1">
											{[
												{ id: "references", label: "References", icon: Library },
												{ id: "outline", label: "Outline", icon: ScrollText },
												{ id: "checks", label: "Checks", icon: AlertTriangle },
											].map((tab) => {
												const Icon = tab.icon
												const active = sideTab === tab.id
												return (
													<button
														key={tab.id}
														type="button"
														onClick={() => setSideTab(tab.id as SideTab)}
														className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
															active
																? "bg-foreground text-background"
																: "text-muted-foreground hover:bg-muted"
														}`}>
														<Icon className="h-3.5 w-3.5" />
														<span>{tab.label}</span>
													</button>
												)
											})}
										</div>
									</div>
									<div className="min-h-0 flex-1 overflow-auto">
										{sideTab === "references" && (
											<ReferencePanel
												referenceEntries={referenceEntries}
												uncatalogued={uncatalogued}
												cited={cited}
												missing={missing}
												citationPlaceholderCount={manuscript?.citationPlaceholderCount ?? 0}
												bibGenerated={bibGenerated}
												bibPreview={bibPreview}
												selectedSection={null}
												sectionContent=""
												sectionInsight={null}
												embedded
											/>
										)}
										{sideTab === "outline" && (
											<div className="space-y-3 p-4 text-sm">
												<div className="rounded-xl border bg-muted/20 p-3">
													<h6 className="font-medium">Manuscript outline</h6>
													{outline.length > 0 ? (
														<div className="mt-2 space-y-1">
															{outline.map((item: OutlineItem) => (
																<button
																	key={item.id}
																	type="button"
																	onClick={() =>
																		openProjectFile(project.primaryManuscriptPath, {
																			line: item.line,
																		})
																	}
																	className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-background/70 ${
																		manuscript?.currentHeading === item.title
																			? "bg-background/80 text-foreground"
																			: "text-muted-foreground"
																	}`}>
																	<span
																		className={`truncate ${item.level === 2 ? "pl-3" : item.level === 3 ? "pl-6" : ""}`}>
																		{item.title}
																	</span>
																	<span className="ml-3 text-[10px]">
																		L{item.line}
																	</span>
																</button>
															))}
														</div>
													) : (
														<p className="mt-2 text-muted-foreground">
															No section headings found in `main.tex` yet.
														</p>
													)}
												</div>
												<div className="rounded-xl border bg-muted/20 p-3">
													<h6 className="font-medium">Quick files</h6>
													<div className="mt-2 space-y-2">
														<AssetButton
															label="Open paper plan"
															onClick={() => openProjectFile("task/paper-plan.md")}
														/>
														<AssetButton
															label="Open research questions"
															onClick={() =>
																openProjectFile("problem/research-questions.md")
															}
														/>
														{!assets?.revisionLog?.exists && (
															<AssetButton
																label="Create revision log template"
																onClick={handleSeedRevisionLog}
															/>
														)}
														<AssetButton
															label="Open revision log"
															onClick={() => openProjectFile("review/revision-log.md")}
														/>
														<AssetButton
															label="Open references.bib"
															onClick={() =>
																openProjectFile("latex/references.bib", {
																	create: true,
																	content: "",
																})
															}
														/>
													</div>
												</div>
											</div>
										)}
										{sideTab === "checks" && (
											<div className="space-y-4 p-4 text-sm">
												<div className="rounded-xl border bg-muted/20 p-3">
													<h6 className="font-medium">Needs attention</h6>
													<div className="mt-2 space-y-2">
														{warningChecks.map((check: any) => (
															<div
																key={check.id}
																className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
																{check.label}
															</div>
														))}
														{warningChecks.length === 0 && (
															<div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
																No urgent blockers right now.
															</div>
														)}
													</div>
												</div>
												<div className="rounded-xl border bg-muted/20 p-3">
													<h6 className="font-medium">Keep an eye on</h6>
													<div className="mt-2 space-y-2">
														{infoChecks.map((check: any) => (
															<div
																key={check.id}
																className="rounded-lg border bg-background/70 px-3 py-2 text-foreground">
																{check.label}
															</div>
														))}
														{infoChecks.length === 0 && readyChecks.length > 0 && (
															<div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
																{readyChecks[0].label}
															</div>
														)}
													</div>
												</div>
												<div className="rounded-xl border bg-muted/20 p-3">
													<h6 className="font-medium">Research assets</h6>
													<div className="mt-2 space-y-2 text-muted-foreground">
														<div className="flex items-center justify-between rounded-lg border bg-background/70 px-3 py-2">
															<span>Paper plan</span>
															<span>{assets?.paperPlanReady ? "Ready" : "Empty"}</span>
														</div>
														<div className="flex items-center justify-between rounded-lg border bg-background/70 px-3 py-2">
															<span>Research questions</span>
															<span>
																{assets?.researchQuestionsReady ? "Ready" : "Empty"}
															</span>
														</div>
														<div className="flex items-center justify-between rounded-lg border bg-background/70 px-3 py-2">
															<span>Revision log</span>
															<span>
																{assets?.revisionLog?.exists
																	? `${assets.revisionLog.openItems + assets.revisionLog.checklistOpen} open`
																	: "Missing"}
															</span>
														</div>
													</div>
													{!assets?.revisionLog?.exists && (
														<div className="mt-3">
															<Button
																variant="outline"
																size="sm"
																onClick={handleSeedRevisionLog}>
																Create revision log
															</Button>
														</div>
													)}
												</div>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{project && (
				<div className="flex items-center gap-4 border-t px-4 py-1.5 text-xs text-muted-foreground shrink-0">
					<span className="max-w-[36%] truncate" title={project.rootPath}>
						Project: {project.rootPath}
					</span>
					<span>Manuscript: {project.primaryManuscriptPath}</span>
					<span>Citations: {cited?.length ?? 0}</span>
				</div>
			)}
		</div>
	)
}

const WorkflowCard = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
	<div className="rounded-xl border bg-background/70 p-3">
		<div className="flex items-center gap-2">
			{icon}
			<h6 className="text-sm font-medium">{title}</h6>
		</div>
		<p className="mt-2 text-sm text-muted-foreground">{body}</p>
	</div>
)

const AssetButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
	<button
		type="button"
		onClick={onClick}
		className="flex w-full items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-left transition-colors hover:bg-muted">
		<span>{label}</span>
		<FolderOpen className="h-4 w-4 text-muted-foreground" />
	</button>
)

const StatusPill = ({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "warning" | "ready" }) => (
	<span
		className={`rounded-full border px-2.5 py-1 text-[11px] ${
			tone === "warning"
				? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"
				: tone === "ready"
					? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
					: "border-border bg-background text-muted-foreground"
		}`}>
		{label}
	</span>
)

function formatManuscriptStatus(status?: string | null): string {
	switch (status) {
		case "missing":
			return "Missing"
		case "empty":
			return "Empty"
		case "drafting":
			return "Drafting"
		case "ready-for-review":
			return "Review-ready"
		default:
			return "Unknown"
	}
}

function truncatePath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/")
	const parts = normalized.split("/")
	if (parts.length <= 3) {
		return normalized
	}
	return `.../${parts.slice(-3).join("/")}`
}

export default React.memo(PaperWritingView)
