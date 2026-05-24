import React, { useState, useCallback, useEffect, useMemo } from "react"
import {
	ArrowLeft,
	Beaker,
	BookOpenText,
	ChevronRight,
	FileSearch,
	FlaskConical,
	FolderOpen,
	MessagesSquare,
} from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { ProjectCreateForm } from "../paper/ProjectCreateForm"

type ResearchPipelineViewProps = {
	onDone?: () => void
	onOpenBoundChat?: (options: {
		bindingKey: "problemFramingTaskId" | "paperDraftTaskId"
		projectRoot: string
		mode: string
		prompt: string
		existingTaskId?: string
	}) => void
}

const ResearchPipelineView: React.FC<ResearchPipelineViewProps> = ({ onDone, onOpenBoundChat }) => {
	const { paperProjectState, readPaperRetrievalState, dataStudioState, cwd } = useExtensionState()
	const workspaceProject = paperProjectState?.project ?? null
	const workspaceState = paperProjectState?.workspaceState ?? null
	const retrievals = readPaperRetrievalState?.retrievals ?? []
	const selectedRetrieval = readPaperRetrievalState?.selectedRetrieval
	const studioState = (dataStudioState || {}) as {
		lastRun?: { timestamp: number }
		history?: unknown[]
		files?: string[]
		running?: boolean
	}

	const [workspaceExpanded, setWorkspaceExpanded] = useState(false)
	const [pendingProjectSetup, setPendingProjectSetup] = useState(false)

	const requestWorkspaceState = useCallback(() => {
		vscode.postMessage({ type: "paperProjectLoad" })
	}, [])

	const requestReadPaperState = useCallback(() => {
		vscode.postMessage({ type: "readPaperListRetrievals", values: { cwd } })
	}, [cwd])

	const requestDataStudioState = useCallback(() => {
		vscode.postMessage({ type: "dataStudioList" })
	}, [])

	useEffect(() => {
		requestWorkspaceState()
		requestReadPaperState()
		requestDataStudioState()
	}, [requestWorkspaceState, requestReadPaperState, requestDataStudioState])

	useEffect(() => {
		if (pendingProjectSetup && workspaceProject) {
			setWorkspaceExpanded(false)
			setPendingProjectSetup(false)
		}
	}, [pendingProjectSetup, workspaceProject])

	const switchPanel = useCallback((tab: "chat" | "readPaper" | "dataStudio" | "paperWriting") => {
		vscode.postMessage({ type: "switchTab", tab } as any)
	}, [])

	const openAgentChat = useCallback(() => {
		if (!workspaceProject) {
			return
		}

		const projectDescription = workspaceProject.description?.trim() || "No project description was provided yet."
		const prompt = [
			`Project name: ${workspaceProject.name}`,
			`Project description: ${projectDescription}`,
			`Target template or venue: ${workspaceProject.templateId}`,
			`Workspace root: ${workspaceProject.rootPath || cwd || "Unknown workspace root"}`,
			"Goal: start with the project description, clarify the research problem first, and only then organize the initial paper plan.",
			"Use a Socratic dialogue style: ask a small number of focused questions, explain why each question matters, and refine the framing after each answer.",
			"Do not jump straight to a paper outline before the problem is clear.",
			"Please treat `problem/research-questions.md` as the primary file for the first phase and `task/paper-plan.md` as the follow-up file after the problem is clarified.",
			"Help me turn this description into a concrete research problem, scope boundaries, and candidate research questions before planning the manuscript.",
		].join("\n")

		onOpenBoundChat?.({
			bindingKey: "problemFramingTaskId",
			projectRoot: workspaceProject.rootPath,
			mode: "sci-problem-framing",
			prompt,
			existingTaskId: workspaceProject.chatBindings?.problemFramingTaskId,
		})
	}, [cwd, onOpenBoundChat, workspaceProject])

	const workspaceStatus = workspaceProject ? "Created" : "Not Created"
	const workspaceSummary = useMemo(() => {
		if (!workspaceProject) {
			return "This VS Code root has not been initialized as a Sci-Roo project yet."
		}
		const manuscript = workspaceState?.manuscript
		const description = workspaceProject.description?.trim()
		const manuscriptStatus = manuscript?.exists ? `${manuscript.wordCount ?? 0} words` : "manuscript not ready"
		return description
			? `${workspaceProject.name} | ${workspaceProject.templateId} | ${description}`
			: `${workspaceProject.name} | ${workspaceProject.templateId} | ${manuscriptStatus}`
	}, [workspaceProject, workspaceState?.manuscript])

	const readPaperSummary = useMemo(() => {
		if (selectedRetrieval?.title) {
			const saved = selectedRetrieval?.result_summary?.total_saved ?? 0
			return `${selectedRetrieval.title} | ${saved} saved | ${selectedRetrieval.run_status ?? "draft"}`
		}
		if (retrievals.length > 0) {
			return `${retrievals.length} retrieval plan${retrievals.length > 1 ? "s" : ""} ready`
		}
		return "No retrieval plan yet."
	}, [retrievals.length, selectedRetrieval])

	const dataStudioSummary = useMemo(() => {
		if (studioState.running) {
			return "Analysis is currently running."
		}
		if (studioState.lastRun?.timestamp) {
			return `Last run ${formatRelativeTime(studioState.lastRun.timestamp)} | ${studioState.files?.length ?? 0} files`
		}
		return "No analysis run yet."
	}, [studioState.files?.length, studioState.lastRun?.timestamp, studioState.running])

	const paperWritingSummary = useMemo(() => {
		const manuscript = workspaceState?.manuscript
		if (!manuscript?.exists) {
			return "Manuscript not ready yet."
		}
		return `${manuscript.wordCount ?? 0} words | ${manuscript.hasPdf ? "PDF ready" : "drafting"}`
	}, [workspaceState?.manuscript])

	const agentChatSummary = useMemo(() => {
		if (!workspaceProject) {
			return "Initialize the project workspace first."
		}
		return "Start from the project description, clarify the research problem first, then organize the initial paper plan. The outcome should be consolidated into problem/research-questions.md and task/paper-plan.md."
	}, [workspaceProject])

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center gap-2">
					{onDone && (
						<Button variant="ghost" size="icon" onClick={onDone}>
							<ArrowLeft className="h-4 w-4" />
						</Button>
					)}
					<FlaskConical className="h-5 w-5" />
					<h3 className="text-lg font-semibold">Research Pipeline</h3>
				</div>
			</TabHeader>

			<TabContent className="bg-[radial-gradient(circle_at_top_left,rgba(210,235,255,0.12),transparent_28%),linear-gradient(180deg,transparent,rgba(255,255,255,0.02))]">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<section className="rounded-[28px] border border-vscode-panel-border bg-card/95 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
							<div className="max-w-2xl">
								<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
									Workflow Board
								</p>
								<h4 className="mt-2 font-serif text-3xl leading-tight">
									Start with the current VS Code root, then unlock the research workspaces.
								</h4>
								<p className="mt-3 text-sm text-muted-foreground">
									Sci-Roo only works inside the folder currently opened in VS Code. Initialize this
									root first, then the agent chat, literature, analysis, and writing cards will appear
									with their own status.
								</p>
							</div>
							<div className="rounded-2xl border border-dashed border-vscode-panel-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
								Current VS Code root:
								<span className="ml-2 font-medium text-foreground">{cwd ?? "No folder opened"}</span>
							</div>
						</div>
					</section>

					<WorkflowCard
						title="1. Project Workspace"
						subtitle="Initialize the current VS Code root as a Sci-Roo project"
						summary={workspaceSummary}
						icon={<FolderOpen className="h-5 w-5" />}
						accent="from-[#c7ecff]/25 via-[#f7f4e8]/60 to-[#f6d9c7]/20"
						actionLabel={
							workspaceExpanded
								? "Collapse"
								: workspaceProject
									? "View Status"
									: "Create Project Workspace"
						}
						onAction={() => setWorkspaceExpanded((open) => !open)}
						meta={cwd ? truncatePath(cwd) : "Open a folder in VS Code first"}
						status={workspaceStatus}
						expanded={workspaceExpanded}>
						<div className="border-t bg-muted/20 px-5 py-4">
							<div className="flex flex-wrap gap-3">
								<InlineInfo label="VS Code root" value={cwd ?? "No folder opened"} />
								<InlineInfo label="Project status" value={workspaceStatus} />
								{workspaceProject && (
									<InlineInfo label="Template" value={workspaceProject.templateId} />
								)}
							</div>
							{!cwd && (
								<p className="mt-4 text-sm text-muted-foreground">
									Open a folder in VS Code first. Sci-Roo only allows project setup inside the current
									root.
								</p>
							)}
							{cwd && !workspaceProject && (
								<p className="mt-4 text-sm text-muted-foreground">
									This root is not initialized yet. Create the Sci-Roo workspace here to enable the
									rest of the research flow.
								</p>
							)}
							{workspaceProject && (
								<div className="mt-4 space-y-3 text-sm text-muted-foreground">
									<p>
										This VS Code root is already initialized. The cards below now use this root as
										their shared working context.
									</p>
									{workspaceProject.description?.trim() && (
										<div className="rounded-2xl border bg-background/70 p-3">
											<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
												Project Background
											</p>
											<p className="mt-2 text-sm text-foreground">
												{workspaceProject.description.trim()}
											</p>
										</div>
									)}
								</div>
							)}
						</div>
						{cwd && !workspaceProject && (
							<div className="border-t">
								<ProjectCreateForm
									compactRootOnly
									onSubmitted={() => setPendingProjectSetup(true)}
									onCancel={() => {
										setWorkspaceExpanded(false)
										setPendingProjectSetup(false)
									}}
								/>
							</div>
						)}
					</WorkflowCard>

					{workspaceProject && (
						<div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
							<WorkflowCard
								title="2. Agent Chat"
								subtitle="Clarify the research problem, then organize the paper plan"
								summary={agentChatSummary}
								icon={<MessagesSquare className="h-5 w-5" />}
								accent="from-[#f7e5c9]/24 via-[#fff7ea]/60 to-[#e8f0ff]/18"
								actionLabel="Open Agent Chat"
								onAction={openAgentChat}
								meta="problem/ -> task/"
								status="Ready"
							/>
							<WorkflowCard
								title="3. Read Paper"
								subtitle="Literature retrieval and screening"
								summary={readPaperSummary}
								icon={<FileSearch className="h-5 w-5" />}
								accent="from-[#d5f1ff]/20 via-[#eefbff]/60 to-[#e8ecff]/18"
								actionLabel="Open Read Paper"
								onAction={() => switchPanel("readPaper")}
								meta={`${retrievals.length} retrieval plan${retrievals.length === 1 ? "" : "s"}`}
								status={selectedRetrieval?.run_status ? String(selectedRetrieval.run_status) : "Idle"}
							/>
							<WorkflowCard
								title="4. Data Studio"
								subtitle="Experiments, scripts, and outputs"
								summary={dataStudioSummary}
								icon={<Beaker className="h-5 w-5" />}
								accent="from-[#dff5dc]/24 via-[#f7fbf4]/65 to-[#d2f1f2]/20"
								actionLabel="Open Data Studio"
								onAction={() => switchPanel("dataStudio")}
								meta={`${studioState.history?.length ?? 0} saved run${(studioState.history?.length ?? 0) === 1 ? "" : "s"}`}
								status={studioState.running ? "Running" : "Ready"}
							/>
							<WorkflowCard
								title="5. Paper Writing"
								subtitle="Draft, build, and revise the manuscript"
								summary={paperWritingSummary}
								icon={<BookOpenText className="h-5 w-5" />}
								accent="from-[#fbe0cf]/24 via-[#fff7f0]/60 to-[#f1e8d9]/18"
								actionLabel="Open Paper Writing"
								onAction={() => switchPanel("paperWriting")}
								meta={workspaceProject.templateId}
								status={workspaceState?.manuscript?.hasPdf ? "PDF Ready" : "Drafting"}
							/>
						</div>
					)}
				</div>
			</TabContent>
		</Tab>
	)
}

const WorkflowCard = ({
	title,
	subtitle,
	summary,
	icon,
	accent,
	actionLabel,
	onAction,
	meta,
	status,
	expanded = false,
	children,
}: {
	title: string
	subtitle: string
	summary: string
	icon: React.ReactNode
	accent: string
	actionLabel: string
	onAction: () => void
	meta: string
	status: string
	expanded?: boolean
	children?: React.ReactNode
}) => (
	<div
		className={`group overflow-hidden rounded-[28px] border border-vscode-panel-border bg-card text-left shadow-[0_14px_36px_rgba(0,0,0,0.1)] transition-all ${
			expanded
				? "shadow-[0_20px_46px_rgba(0,0,0,0.14)]"
				: "hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(0,0,0,0.14)]"
		}`}>
		<button type="button" onClick={onAction} className="w-full text-left">
			<div className={`h-28 bg-gradient-to-br ${accent} px-5 py-4`}>
				<div className="flex items-start justify-between">
					<div className="rounded-2xl border border-black/5 bg-white/70 p-2 text-foreground shadow-sm dark:bg-black/10">
						{icon}
					</div>
					<div className="flex items-center gap-3">
						<span className="rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] text-foreground shadow-sm dark:bg-black/10">
							{status}
						</span>
						<ChevronRight
							className={`h-4 w-4 text-muted-foreground transition-transform ${
								expanded ? "rotate-90" : "group-hover:translate-x-1"
							}`}
						/>
					</div>
				</div>
			</div>
			<div className="px-5 py-5">
				<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
				<h5 className="mt-2 text-lg font-semibold">{subtitle}</h5>
				<p className="mt-3 min-h-[44px] text-sm text-muted-foreground">{summary}</p>
				<div className="mt-4 flex items-center justify-between gap-3">
					<span className="truncate text-[11px] text-muted-foreground">{meta}</span>
					<span className="rounded-full bg-foreground px-3 py-1 text-xs text-background">{actionLabel}</span>
				</div>
			</div>
		</button>
		{expanded && children}
	</div>
)

const InlineInfo = ({ label, value }: { label: string; value: string }) => (
	<div className="rounded-full border bg-background px-3 py-1.5 text-xs">
		<span className="text-muted-foreground">{label}: </span>
		<span className="text-foreground">{value}</span>
	</div>
)

function formatRelativeTime(timestamp: number): string {
	const delta = Date.now() - timestamp
	const minutes = Math.max(1, Math.round(delta / 60000))
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.round(hours / 24)
	return `${days}d ago`
}

function truncatePath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/")
	const parts = normalized.split("/")
	if (parts.length <= 4) {
		return normalized
	}
	return `.../${parts.slice(-4).join("/")}`
}

export default React.memo(ResearchPipelineView)
