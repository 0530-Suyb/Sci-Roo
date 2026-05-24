import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Ellipsis,
	Eye,
	FileText,
	FolderOpen,
	Library,
	Loader2,
	Play,
	ScrollText,
} from "lucide-react"

import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { ReferencePanel } from "./ReferencePanel"

type PaperWritingViewProps = {
	onDone: () => void
	onOpenResearchPipeline: () => void
}

type SideTab = "references" | "outline" | "checks"

type OutlineItem = {
	id: string
	level: 1 | 2 | 3
	title: string
	line: number
}

type NextStepAction = {
	label: string
	onClick: () => void
	disabled?: boolean
}

type DraftMetric = {
	label: string
	value: string
	tone?: MetricTone
}

const STAGE_OPTIONS = [
	{ id: "planning", label: "Planning" },
	{ id: "literature-review", label: "Literature" },
	{ id: "writing", label: "Writing" },
	{ id: "revising", label: "Revising" },
	{ id: "final", label: "Final" },
	{ id: "submitted", label: "Submitted" },
] as const

const SELECTION_ACTION_GROUPS = [
	{
		label: "Improve",
		actions: [
			{ label: "Rewrite", command: "paperRewriteSelection" },
			{ label: "Rephrase", command: "paperRephraseSelection" },
			{ label: "Academic", command: "paperMakeAcademicSelection" },
		],
	},
	{
		label: "Tighten",
		actions: [
			{ label: "Concise", command: "paperMakeConciseSelection" },
			{ label: "Expand", command: "paperExpandAcademicParagraph" },
			{ label: "Add cite placeholder", command: "paperAddCitationPlaceholder" },
		],
	},
	{
		label: "Translate",
		actions: [
			{ label: "To Chinese", command: "paperTranslateSelectionChinese" },
			{ label: "To English", command: "paperTranslateSelectionEnglish" },
		],
	},
] as const

const PaperWritingView: React.FC<PaperWritingViewProps> = ({ onDone, onOpenResearchPipeline }) => {
	const { paperProjectState, paperReferenceState, paperSnapshotState } = useExtensionState()

	const [loading, setLoading] = useState(true)
	const [sideTab, setSideTab] = useState<SideTab>("references")
	const [supportTabPinned, setSupportTabPinned] = useState(false)
	const [highlightSelectionAssistant, setHighlightSelectionAssistant] = useState(false)
	const selectionAssistantRef = useRef<HTMLDivElement | null>(null)

	const project = paperProjectState?.project ?? null
	const workspaceState = paperProjectState?.workspaceState ?? null
	const manuscript = workspaceState?.manuscript ?? null
	const editorContext = workspaceState?.editorContext ?? null
	const gitStatus = workspaceState?.git ?? null
	const assets = workspaceState?.assets ?? null
	const checks = useMemo(() => workspaceState?.checks ?? [], [workspaceState?.checks])
	const outline: OutlineItem[] = manuscript?.outline ?? []
	const referenceEntries = paperReferenceState?.entries ?? paperProjectState?.referenceEntries ?? []
	const uncatalogued = paperReferenceState?.uncatalogued ?? paperProjectState?.uncatalogued ?? []
	const cited = paperReferenceState?.cited ?? null
	const missing = paperReferenceState?.missing ?? null
	const bibGenerated = paperReferenceState?.bibGenerated ?? false
	const bibPreview = paperReferenceState?.bibPreview ?? null
	const snapshots = paperSnapshotState?.snapshots ?? []
	const recommendedAction =
		workspaceState?.recommendedAction ?? "Open the main manuscript and continue drafting in the editor."
	const primaryManuscriptPath = project?.primaryManuscriptPath ?? "latex/main.tex"
	const selectionAssistantEnabled = !!editorContext?.onPrimaryManuscript && !!editorContext?.hasSelection
	const missingCitationCount = missing?.length ?? 0
	const citationPlaceholderCount = manuscript?.citationPlaceholderCount ?? 0
	const hasCitationRisk = missingCitationCount > 0 || citationPlaceholderCount > 0

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

	useEffect(() => {
		if (!highlightSelectionAssistant) {
			return
		}
		const timer = window.setTimeout(() => setHighlightSelectionAssistant(false), 2200)
		return () => window.clearTimeout(timer)
	}, [highlightSelectionAssistant])

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

	const handleStageChange = useCallback((stage: string) => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectStageUpdate",
			text: stage,
		})
	}, [])

	const handleRefreshProject = useCallback(() => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectRefresh",
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

	const openSupportTab = useCallback((tab: SideTab, options?: { pin?: boolean }) => {
		if (options?.pin ?? true) {
			setSupportTabPinned(true)
		}
		setSideTab(tab)
	}, [])

	const focusSelectionAssistant = useCallback(() => {
		setHighlightSelectionAssistant(true)
		selectionAssistantRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
	}, [])

	const headerSummary = useMemo(() => {
		if (!manuscript?.exists) {
			return "Main manuscript is not ready yet."
		}
		if (editorContext?.onPrimaryManuscript && editorContext?.hasSelection) {
			return "A passage is selected in the manuscript."
		}
		if (hasCitationRisk) {
			return "The current draft still has citation gaps."
		}
		if (!manuscript?.hasPdf) {
			return "Build a fresh PDF to inspect layout and references."
		}
		return "The draft is ready for the next writing or revision pass."
	}, [
		editorContext?.hasSelection,
		editorContext?.onPrimaryManuscript,
		manuscript?.exists,
		manuscript?.hasPdf,
		hasCitationRisk,
	])

	const currentDraftStatus = useMemo<DraftMetric[]>(
		() => [
			{ label: "Words", value: `${manuscript?.wordCount ?? 0}` },
			{
				label: "Status",
				value: formatManuscriptStatus(manuscript?.status),
				tone: manuscript?.status === "missing" ? "warning" : "ready",
			},
			{ label: "Heading", value: manuscript?.currentHeading ?? "No active heading" },
			{
				label: "Last edited",
				value: manuscript?.lastEdited ? new Date(manuscript.lastEdited).toLocaleString() : "Not yet",
			},
			{
				label: "Missing cites",
				value: `${missingCitationCount}`,
				tone: missingCitationCount > 0 ? "warning" : "ready",
			},
			{
				label: "Placeholders",
				value: `${citationPlaceholderCount}`,
				tone: citationPlaceholderCount > 0 ? "warning" : "ready",
			},
		],
		[
			citationPlaceholderCount,
			manuscript?.currentHeading,
			manuscript?.lastEdited,
			manuscript?.status,
			manuscript?.wordCount,
			missingCitationCount,
		],
	)

	const nextStep = useMemo(() => {
		const openMain: NextStepAction = {
			label: "Open main.tex",
			onClick: () => openProjectFile(primaryManuscriptPath),
		}
		const openOrCreateMain: NextStepAction = {
			label: "Open main.tex",
			onClick: () => openProjectFile(primaryManuscriptPath, { create: true, content: "" }),
		}
		const openPipeline: NextStepAction = { label: "Open Research Pipeline", onClick: onOpenResearchPipeline }
		const buildPdf: NextStepAction = {
			label: "Build PDF",
			onClick: () => handleWorkspaceCommand("paperBuildManuscript"),
		}
		const viewPdf: NextStepAction = {
			label: "View PDF",
			onClick: () => handleWorkspaceCommand("paperViewPdf"),
			disabled: !manuscript?.hasPdf,
		}
		const openReferences: NextStepAction = {
			label: "Open references",
			onClick: () => openSupportTab("references"),
		}
		const createSnapshot: NextStepAction = { label: "Create snapshot", onClick: handleCreateSnapshot }

		if (!manuscript?.exists) {
			return {
				title: "Set up the draft entry",
				description:
					"The main manuscript is not ready yet. Open or regenerate the draft entry before continuing.",
				primary: openOrCreateMain,
				secondary: openPipeline,
			}
		}

		if (!editorContext?.onPrimaryManuscript) {
			return {
				title: "Return to the manuscript",
				description:
					"Open the main manuscript so writing actions, heading context, and draft status all stay aligned.",
				primary: openMain,
				secondary: viewPdf,
			}
		}

		if (editorContext?.hasSelection) {
			return {
				title: "Refine the selected passage",
				description:
					"A passage is selected in the manuscript. Tighten the wording now, or keep drafting if the phrasing already feels stable.",
				primary: { label: "Use Selection Assistant", onClick: focusSelectionAssistant },
				secondary: openMain,
			}
		}

		if (hasCitationRisk) {
			return {
				title: "Resolve citation gaps",
				description:
					"The draft still has citation gaps. Resolve them before the next polish or submission pass.",
				primary: { label: "Scan citations", onClick: handleScanCitations },
				secondary: openReferences,
			}
		}

		if (!manuscript?.hasPdf) {
			return {
				title: "Build the current draft",
				description: "Build the manuscript to inspect layout, references, and section flow in PDF form.",
				primary: buildPdf,
				secondary: viewPdf,
			}
		}

		if (["revising", "final", "submitted"].includes(project?.stage ?? "") && !assets?.revisionLog?.exists) {
			return {
				title: "Prepare revision tracking",
				description:
					"This project is in a revision-oriented stage, but the revision log is missing. Create it before large changes.",
				primary: { label: "Create revision log", onClick: handleSeedRevisionLog },
				secondary: createSnapshot,
			}
		}

		if (gitStatus?.available && gitStatus.hasChanges && snapshots.length === 0) {
			return {
				title: "Protect the current draft",
				description:
					"You have active draft changes. Save a snapshot before the next structural pass or reviewer-facing revision.",
				primary: createSnapshot,
				secondary: {
					label: "Open Source Control",
					onClick: () => handleWorkspaceCommand("paperOpenSourceControl"),
				},
			}
		}

		return {
			title: "Continue the stable writing pass",
			description: recommendedAction,
			primary: openMain,
			secondary: buildPdf,
		}
	}, [
		assets?.revisionLog?.exists,
		editorContext?.hasSelection,
		editorContext?.onPrimaryManuscript,
		focusSelectionAssistant,
		gitStatus?.available,
		gitStatus?.hasChanges,
		handleCreateSnapshot,
		handleScanCitations,
		handleSeedRevisionLog,
		handleWorkspaceCommand,
		manuscript?.exists,
		manuscript?.hasPdf,
		hasCitationRisk,
		onOpenResearchPipeline,
		openSupportTab,
		openProjectFile,
		project?.stage,
		primaryManuscriptPath,
		recommendedAction,
		snapshots.length,
	])

	const selectionContext = useMemo(() => {
		if (!editorContext?.onPrimaryManuscript) {
			return "Open the main manuscript to use writing actions in context."
		}
		if (!selectionAssistantEnabled) {
			return "Select a passage in main.tex to enable writing actions."
		}
		return `${editorContext.selectionWordCount ?? 0} words selected in ${truncatePath(editorContext.filePath ?? "main.tex")}`
	}, [
		editorContext?.filePath,
		editorContext?.onPrimaryManuscript,
		editorContext?.selectionWordCount,
		selectionAssistantEnabled,
	])

	const safetyItems = useMemo<Array<{ label: string; value: string; tone: MetricTone }>>(
		() => [
			{
				label: "Git",
				value: gitStatus?.available
					? gitStatus.hasChanges
						? `${gitStatus.changedFiles} changed`
						: "Clean"
					: "Unavailable",
				tone: gitStatus?.available ? (gitStatus.hasChanges ? "warning" : "ready") : "neutral",
			},
			{
				label: "PDF",
				value: manuscript?.hasPdf ? "Ready" : "Not built",
				tone: manuscript?.hasPdf ? "ready" : "warning",
			},
			{
				label: "Snapshot",
				value: snapshots.length > 0 ? `${snapshots.length} saved` : "Missing",
				tone: snapshots.length > 0 ? "ready" : "warning",
			},
		],
		[gitStatus?.available, gitStatus?.changedFiles, gitStatus?.hasChanges, manuscript?.hasPdf, snapshots.length],
	)

	const blockingChecks = useMemo(() => checks.filter((check: any) => check.severity === "warning"), [checks])
	const reviewChecks = useMemo(() => checks.filter((check: any) => check.severity === "info"), [checks])
	const preferredSupportTab = useMemo<SideTab>(() => {
		if (hasCitationRisk) {
			return "references"
		}
		if (
			blockingChecks.length > 0 ||
			!assets?.paperPlanReady ||
			!assets?.researchQuestionsReady ||
			!assets?.revisionLog?.exists
		) {
			return "checks"
		}
		return "outline"
	}, [
		assets?.paperPlanReady,
		assets?.researchQuestionsReady,
		assets?.revisionLog?.exists,
		blockingChecks.length,
		hasCitationRisk,
	])

	const supportPanelSuggestion = useMemo(() => {
		if (preferredSupportTab === "references") {
			return {
				label: "References",
				description: "Citation gaps are currently the biggest blocker for this writing pass.",
			}
		}
		if (preferredSupportTab === "checks") {
			return {
				label: "Checks",
				description: "Supporting files or review safeguards need attention before the next pass.",
			}
		}
		return {
			label: "Outline",
			description: "The draft is stable enough to navigate sections and supporting files from the outline.",
		}
	}, [preferredSupportTab])

	const currentSupportTabDescription = useMemo(() => {
		if (sideTab === "references") {
			return "Resolve citation gaps and inspect the references most relevant to the current draft."
		}
		if (sideTab === "checks") {
			return "Review blockers, follow-up items, and supporting writing assets."
		}
		return "Jump across manuscript sections and open the planning files that support this draft."
	}, [sideTab])

	const supportTabBadges = useMemo(
		() => ({
			references: hasCitationRisk ? missingCitationCount + citationPlaceholderCount : 0,
			outline: 0,
			checks:
				blockingChecks.length +
				(assets?.paperPlanReady ? 0 : 1) +
				(assets?.researchQuestionsReady ? 0 : 1) +
				(assets?.revisionLog?.exists ? 0 : 1),
		}),
		[
			assets?.paperPlanReady,
			assets?.researchQuestionsReady,
			assets?.revisionLog?.exists,
			blockingChecks.length,
			citationPlaceholderCount,
			hasCitationRisk,
			missingCitationCount,
		],
	)

	useEffect(() => {
		if (!supportTabPinned) {
			setSideTab(preferredSupportTab)
		}
	}, [preferredSupportTab, supportTabPinned])

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
		<div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,rgba(228,239,255,0.12),transparent_26%),linear-gradient(180deg,transparent,rgba(255,255,255,0.015))]">
			<div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
				<Button variant="ghost" size="icon" onClick={onDone}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<FileText className="h-5 w-5" />
				<div className="min-w-0">
					<h3 className="truncate text-lg font-semibold">Paper Writing</h3>
					{project && (
						<p className="truncate text-xs text-muted-foreground">
							{project.name} · {headerSummary}
						</p>
					)}
				</div>
				{project && (
					<div className="ml-auto flex flex-wrap items-center gap-2">
						<span className="rounded-full border bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
							{project.templateId}
						</span>
						<label className="flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground">
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
							onClick={() =>
								openProjectFile(primaryManuscriptPath, { create: !manuscript?.exists, content: "" })
							}>
							Open main.tex
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
							disabled={!manuscript?.hasPdf}
							onClick={() => handleWorkspaceCommand("paperViewPdf")}>
							<Eye className="mr-1.5 h-3.5 w-3.5" />
							View PDF
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" title="More actions">
									<Ellipsis className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() =>
										openProjectFile("latex/references.bib", { create: true, content: "" })
									}>
									Open references.bib
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleWorkspaceCommand("paperOpenSourceControl")}>
									Open Source Control
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleCreateSnapshot}>Create snapshot</DropdownMenuItem>
								<DropdownMenuItem onClick={handleGenerateBib}>Generate bibliography</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleRefreshProject}>Refresh</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
			</div>

			{!project ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<div className="max-w-lg rounded-[28px] border bg-card p-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
						<FileText className="mx-auto h-10 w-10 text-primary opacity-80" />
						<h4 className="mt-4 text-base font-semibold">No paper project is active</h4>
						<p className="mt-2 text-sm text-muted-foreground">
							Create or open your research project from the Research Pipeline panel, then come back here
							to continue manuscript writing.
						</p>
						<div className="mt-5 flex justify-center">
							<Button variant="primary" size="sm" onClick={onOpenResearchPipeline}>
								Open Research Pipeline
							</Button>
						</div>
					</div>
				</div>
			) : (
				<div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 xl:grid-cols-[1.35fr_0.95fr]">
					<div className="min-h-0 overflow-auto pr-1">
						<div className="space-y-4">
							<FocusCard
								title="Current Draft"
								subtitle="The manuscript health snapshot for this writing pass.">
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
									{currentDraftStatus.map((item) => (
										<MetricTile
											key={item.label}
											label={item.label}
											value={item.value}
											tone={item.tone}
										/>
									))}
								</div>
							</FocusCard>

							<FocusCard title="Next Step" subtitle={nextStep.title}>
								<div className="rounded-2xl border bg-background/80 px-4 py-3">
									<p className="text-sm text-foreground">{nextStep.description}</p>
									<div className="mt-4 flex flex-wrap gap-2">
										<Button
											variant="primary"
											size="sm"
											onClick={nextStep.primary.onClick}
											disabled={nextStep.primary.disabled}>
											{nextStep.primary.label}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={nextStep.secondary.onClick}
											disabled={nextStep.secondary.disabled}>
											{nextStep.secondary.label}
										</Button>
									</div>
									{nextStep.secondary.disabled && (
										<p className="mt-3 text-xs text-muted-foreground">
											This follow-up action will unlock once the current draft has been built.
										</p>
									)}
								</div>
							</FocusCard>

							<FocusCard
								title="Selection Assistant"
								subtitle="Use targeted writing actions on the passage currently selected in the editor."
								highlight={highlightSelectionAssistant}
								ref={selectionAssistantRef}>
								<div className="rounded-2xl border bg-background/75 px-4 py-3">
									<div className="flex flex-wrap items-center gap-2">
										<StatusPill
											label={
												editorContext?.onPrimaryManuscript
													? "In main manuscript"
													: "Out of manuscript context"
											}
											tone={editorContext?.onPrimaryManuscript ? "ready" : "neutral"}
										/>
										<StatusPill
											label={
												!editorContext?.onPrimaryManuscript
													? "Open main.tex first"
													: editorContext?.hasSelection
														? "Selection ready"
														: "Select text to unlock actions"
											}
											tone={selectionAssistantEnabled ? "ready" : "warning"}
										/>
										{editorContext?.filePath && (
											<StatusPill label={truncatePath(editorContext.filePath)} />
										)}
									</div>
									<p className="mt-3 text-sm text-muted-foreground">{selectionContext}</p>
									{!selectionAssistantEnabled && (
										<div className="mt-3 flex flex-wrap gap-2">
											{!editorContext?.onPrimaryManuscript ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														openProjectFile(primaryManuscriptPath, {
															create: !manuscript?.exists,
															content: "",
														})
													}>
													Open main.tex
												</Button>
											) : (
												<Button
													variant="outline"
													size="sm"
													onClick={() => openSupportTab("outline")}>
													Open outline
												</Button>
											)}
										</div>
									)}
								</div>
								<div className="mt-4 space-y-3">
									{SELECTION_ACTION_GROUPS.map((group) => (
										<div key={group.label}>
											<div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
												{group.label}
											</div>
											<div className="flex flex-wrap gap-2">
												{group.actions.map((action) => (
													<Button
														key={action.command}
														variant="outline"
														size="sm"
														disabled={!selectionAssistantEnabled}
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
										</div>
									))}
								</div>
							</FocusCard>

							<FocusCard
								title="Draft Safety"
								subtitle="Keep the current writing pass recoverable and reviewable.">
								<div className="grid gap-3 sm:grid-cols-3">
									{safetyItems.map((item) => (
										<MetricTile
											key={item.label}
											label={item.label}
											value={item.value}
											tone={item.tone}
										/>
									))}
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleWorkspaceCommand("paperOpenSourceControl")}>
										Open Source Control
									</Button>
									<Button variant="outline" size="sm" onClick={handleCreateSnapshot}>
										Create snapshot
									</Button>
								</div>
							</FocusCard>
						</div>
					</div>

					<div className="flex min-h-0 flex-col rounded-[28px] border bg-card shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
						<div className="border-b px-2 py-2">
							<div className="flex gap-1">
								{[
									{ id: "references", label: "References", icon: Library },
									{ id: "outline", label: "Outline", icon: ScrollText },
									{ id: "checks", label: "Checks", icon: AlertTriangle },
								].map((tab) => {
									const Icon = tab.icon
									const active = sideTab === tab.id
									const badgeCount = supportTabBadges[tab.id as SideTab]
									return (
										<button
											key={tab.id}
											type="button"
											onClick={() => openSupportTab(tab.id as SideTab)}
											className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] transition-colors ${
												active
													? "bg-foreground text-background"
													: "text-muted-foreground hover:bg-muted"
											}`}>
											<Icon className="h-3.5 w-3.5" />
											<span>{tab.label}</span>
											{badgeCount > 0 && (
												<span
													className={`rounded-full px-1.5 py-0.5 text-[10px] ${
														active
															? "bg-background/15 text-background"
															: "bg-background text-foreground"
													}`}>
													{badgeCount}
												</span>
											)}
										</button>
									)
								})}
							</div>
						</div>

						<div className="border-b px-3 py-2 text-xs text-muted-foreground">
							{currentSupportTabDescription}
						</div>

						{supportTabPinned && sideTab !== preferredSupportTab && (
							<div className="border-b bg-muted/20 px-3 py-2">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="min-w-0">
										<div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
											Suggested focus: {supportPanelSuggestion.label}
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{supportPanelSuggestion.description}
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setSupportTabPinned(false)
											setSideTab(preferredSupportTab)
										}}>
										Go there
									</Button>
								</div>
							</div>
						)}

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
								<div className="space-y-4 p-4">
									<SupportSection
										title="Manuscript outline"
										description="Jump to the active section structure in main.tex.">
										{outline.length > 0 ? (
											<div className="space-y-1">
												{outline.map((item) => (
													<button
														key={item.id}
														type="button"
														onClick={() =>
															openProjectFile(project.primaryManuscriptPath, {
																line: item.line,
															})
														}
														className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-background/70 ${
															manuscript?.currentHeading === item.title
																? "bg-background/85 text-foreground"
																: "text-muted-foreground"
														}`}>
														<span
															className={`truncate text-sm ${
																item.level === 2
																	? "pl-3"
																	: item.level === 3
																		? "pl-6"
																		: ""
															}`}>
															{item.title}
														</span>
														<span className="ml-3 text-[10px]">L{item.line}</span>
													</button>
												))}
											</div>
										) : (
											<p className="text-sm text-muted-foreground">
												No section headings have been detected in `main.tex` yet.
											</p>
										)}
									</SupportSection>

									<SupportSection
										title="Quick files"
										description="Open the planning and revision files that most often support manuscript work.">
										<div className="space-y-2">
											<AssetButton
												label="Open paper plan"
												meta={assets?.paperPlanReady ? "Ready" : "Empty"}
												onClick={() => openProjectFile("task/paper-plan.md")}
											/>
											<AssetButton
												label="Open research questions"
												meta={assets?.researchQuestionsReady ? "Ready" : "Empty"}
												onClick={() => openProjectFile("problem/research-questions.md")}
											/>
											{!assets?.revisionLog?.exists ? (
												<AssetButton
													label="Create revision log"
													meta="Missing"
													onClick={handleSeedRevisionLog}
												/>
											) : (
												<AssetButton
													label="Open revision log"
													meta={`${assets.revisionLog.openItems + assets.revisionLog.checklistOpen} open`}
													onClick={() => openProjectFile("review/revision-log.md")}
												/>
											)}
										</div>
									</SupportSection>
								</div>
							)}

							{sideTab === "checks" && (
								<div className="space-y-4 p-4">
									<SupportSection
										title="Blocking"
										description="Issues that are actively weakening the current writing pass.">
										<div className="space-y-2">
											{blockingChecks.length > 0 ? (
												blockingChecks.map((check: any) => (
													<CheckNotice key={check.id} label={check.label} tone="warning" />
												))
											) : (
												<CheckNotice
													label="No blocking issues are flagged right now."
													tone="ready"
												/>
											)}
										</div>
										{hasCitationRisk && (
											<div className="mt-3 flex flex-wrap gap-2">
												<Button variant="outline" size="sm" onClick={handleScanCitations}>
													Scan citations
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => openSupportTab("references")}>
													Open references
												</Button>
											</div>
										)}
									</SupportSection>

									<SupportSection
										title="Needs Review"
										description="Useful follow-up items that are not hard blockers yet.">
										<div className="space-y-2">
											{reviewChecks.length > 0 ? (
												reviewChecks.map((check: any) => (
													<CheckNotice key={check.id} label={check.label} tone="neutral" />
												))
											) : (
												<CheckNotice
													label="The current draft looks reasonably stable for this pass."
													tone="ready"
												/>
											)}
										</div>
									</SupportSection>

									<SupportSection
										title="Assets Status"
										description="Check whether the supporting planning and revision files are ready.">
										<div className="space-y-2">
											<AssetStatusRow label="Paper plan" ready={!!assets?.paperPlanReady} />
											<AssetStatusRow
												label="Research questions"
												ready={!!assets?.researchQuestionsReady}
											/>
											<AssetStatusRow
												label="Revision log"
												ready={!!assets?.revisionLog?.exists}
												trailing={
													assets?.revisionLog?.exists
														? `${assets.revisionLog.openItems + assets.revisionLog.checklistOpen} open`
														: "Missing"
												}
											/>
										</div>
										<div className="mt-3 grid gap-2 sm:grid-cols-2">
											<AssetButton
												label="Open paper plan"
												meta={assets?.paperPlanReady ? "Ready" : "Empty"}
												onClick={() => openProjectFile("task/paper-plan.md")}
											/>
											<AssetButton
												label="Open research questions"
												meta={assets?.researchQuestionsReady ? "Ready" : "Empty"}
												onClick={() => openProjectFile("problem/research-questions.md")}
											/>
										</div>
										<div className="mt-2">
											{assets?.revisionLog?.exists ? (
												<AssetButton
													label="Open revision log"
													meta={`${assets.revisionLog.openItems + assets.revisionLog.checklistOpen} open`}
													onClick={() => openProjectFile("review/revision-log.md")}
												/>
											) : (
												<AssetButton
													label="Create revision log"
													meta="Missing"
													onClick={handleSeedRevisionLog}
												/>
											)}
										</div>
									</SupportSection>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

const FocusCard = React.forwardRef<
	HTMLDivElement,
	{ title: string; subtitle: string; children: React.ReactNode; highlight?: boolean }
>(({ title, subtitle, children, highlight = false }, ref) => (
	<section
		ref={ref}
		className={`rounded-[28px] border bg-card p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] transition-colors ${
			highlight ? "border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_18px_40px_rgba(0,0,0,0.08)]" : ""
		}`}>
		<div className="mb-4">
			<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
			<h5 className="mt-2 text-lg font-semibold">{subtitle}</h5>
		</div>
		{children}
	</section>
))
FocusCard.displayName = "FocusCard"

const SupportSection = ({
	title,
	description,
	children,
}: {
	title: string
	description: string
	children: React.ReactNode
}) => (
	<div className="rounded-2xl border bg-muted/15 p-3">
		<div className="mb-3">
			<div className="text-sm font-medium">{title}</div>
			<p className="mt-1 text-xs text-muted-foreground">{description}</p>
		</div>
		{children}
	</div>
)

const MetricTile = ({ label, value, tone = "neutral" }: { label: string; value: string; tone?: MetricTone }) => (
	<div
		className={`rounded-2xl border px-3 py-3 ${
			tone === "warning"
				? "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20"
				: tone === "ready"
					? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
					: "bg-background/80"
		}`}>
		<div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
		<div className="mt-2 text-sm font-medium text-foreground">{value}</div>
	</div>
)

type MetricTone = "neutral" | "warning" | "ready"

const AssetButton = ({ label, meta, onClick }: { label: string; meta?: string; onClick: () => void }) => (
	<button
		type="button"
		onClick={onClick}
		className="flex w-full items-center justify-between rounded-xl border bg-background/75 px-3 py-2 text-left text-sm transition-colors hover:bg-background">
		<div className="min-w-0">
			<div>{label}</div>
			{meta && <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>}
		</div>
		<FolderOpen className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
	</button>
)

const AssetStatusRow = ({ label, ready, trailing }: { label: string; ready: boolean; trailing?: string }) => (
	<div className="flex items-center justify-between rounded-xl border bg-background/75 px-3 py-2 text-sm">
		<div className="flex items-center gap-2">
			{ready ? (
				<CheckCircle2 className="h-4 w-4 text-emerald-600" />
			) : (
				<AlertTriangle className="h-4 w-4 text-amber-600" />
			)}
			<span>{label}</span>
		</div>
		<span className="text-xs text-muted-foreground">{trailing ?? (ready ? "Ready" : "Empty")}</span>
	</div>
)

const CheckNotice = ({ label, tone }: { label: string; tone: "warning" | "ready" | "neutral" }) => (
	<div
		className={`rounded-xl border px-3 py-2 text-sm ${
			tone === "warning"
				? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"
				: tone === "ready"
					? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
					: "bg-background/75 text-foreground"
		}`}>
		{label}
	</div>
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

function formatManuscriptStatus(status: string | undefined): string {
	switch (status) {
		case "aligned":
			return "Aligned"
		case "active":
			return "Active"
		case "missing":
			return "Missing"
		default:
			return "Drafting"
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
