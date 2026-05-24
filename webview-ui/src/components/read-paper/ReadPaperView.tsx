import React, { useEffect, useMemo, useState } from "react"
import {
	Archive,
	ArrowLeft,
	BookOpenText,
	BookPlus,
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	CircleSlash,
	ExternalLink,
	FileSearch,
	Library,
	Map,
	MoreHorizontal,
	Play,
	Plus,
	RefreshCw,
	Save,
	Settings2,
	Trash2,
} from "lucide-react"
import {
	DEFAULT_RETRIEVAL_SOURCES,
	RETRIEVAL_SOURCE_OPTIONS,
	type ProviderSettingsEntry,
	type ReadPaperWorkspaceConfig,
	type RetrievalSource,
	type RetrievalStrategy,
} from "@roo-code/types"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Checkbox,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	SearchableSelect,
	StandardTooltip,
	Textarea,
} from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"
import { Tab, TabContent, TabHeader } from "../common/Tab"

type ReadPaperViewProps = {
	onDone: () => void
}

type Source = RetrievalSource
type Strategy = RetrievalStrategy
type ImportTarget = "literature_library"
type ReadPaperModule = "retrieval" | "library" | "map" | "settings"

type RetrievalCandidate = {
	candidate_no: string
	state: string
	source: Source
	source_id?: string
	title: string
	authors: string[]
	year?: number | null
	venue?: string
	doi?: string
	pmid?: string
	arxiv_id?: string
	url?: string
	abstract?: string
	relevance_score?: number | null
	relevance_reason?: string
	existence_confidence?: number | null
	relevance_confidence?: number | null
	verified_sources?: string[]
	discovery_sources?: string[]
	match_evidence?: string[]
	metadata_warnings?: string[]
}

type Retrieval = {
	retrieval_no: string
	title: string
	Q: string
	state: string
	execution_mode?: "lightweight_job"
	retrieval_strategy?: Strategy
	planner_profile_id?: string
	planner_profile_name?: string
	query: string
	search_keywords: string[]
	search_sources: Source[]
	max_results: number
	year_from?: number | null
	year_to?: number | null
	search_provenance?: {
		summary?: string
		runs?: Array<{
			source: Source
			query: string
			requested_max_results: number
			returned_count: number
			status: "success" | "partial" | "error" | "no_results"
			error?: string | null
		}>
	}
	result_summary?: {
		total_found: number
		total_saved: number
		duplicates_removed: number
		errors: string[]
		by_source: Partial<Record<Source, number>>
	}
	candidates: RetrievalCandidate[]
	run_status?: "idle" | "running" | "completed" | "error" | "aborted"
	actual_total_results?: number
	shortfall?: number
	source_registry_version?: string
	last_run_at?: string
	last_completed_at?: string
	last_error_at?: string
}

type FormState = {
	title: string
	Q: string
	query: string
	search_keywords: string
	retrieval_strategy: Strategy
	search_sources: Source[]
	max_results: number
	year_from: string
	year_to: string
}

type WorkspaceFormState = {
	planner_profile_id: string
	planner_profile_name: string
	default_sources: Source[]
	default_retrieval_strategy: Strategy
	default_max_results: string
	default_year_from: string
	default_year_to: string
	default_import_target: ImportTarget
}

const emptyForm: FormState = {
	title: "",
	Q: "",
	query: "",
	search_keywords: "",
	retrieval_strategy: "scholarly_only",
	search_sources: DEFAULT_RETRIEVAL_SOURCES,
	max_results: 20,
	year_from: "",
	year_to: "",
}

const toCsv = (value: string) =>
	value
		.split(",")
		.map((line) => line.trim())
		.filter(Boolean)

const normalizeOptionalQuery = (value: string) => {
	const normalized = value.trim().toLowerCase()
	if (["不知道", "不清楚", "未知", "unknown", "not sure", "n/a", "na", "none"].includes(normalized)) {
		return ""
	}
	return value
}

const normalizeExternalUrl = (value: string | undefined) => {
	const trimmed = value?.trim()
	if (!trimmed) return ""
	if (/^https?:\/\//i.test(trimmed)) return trimmed
	return ""
}

const buildCandidateUrl = (candidate: RetrievalCandidate) => {
	const directUrl = normalizeExternalUrl(candidate.url)
	if (directUrl) return directUrl
	if (candidate.doi?.trim()) return `https://doi.org/${encodeURIComponent(candidate.doi.trim())}`
	if (candidate.pmid?.trim()) return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(candidate.pmid.trim())}/`
	if (candidate.arxiv_id?.trim()) return `https://arxiv.org/abs/${encodeURIComponent(candidate.arxiv_id.trim())}`
	return ""
}

const toOptionalNumber = (value: string) => {
	if (!value.trim()) return undefined
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

const formatSourceLabel = (source: Source) =>
	RETRIEVAL_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source

const formatSourceList = (sources: Source[] | undefined) =>
	(sources?.length ? sources : DEFAULT_RETRIEVAL_SOURCES).map(formatSourceLabel).join(", ")

const formatSourceSummary = (sources: Source[] | undefined) => {
	const activeSources = sources?.length ? sources : DEFAULT_RETRIEVAL_SOURCES
	const visibleSources = activeSources.slice(0, 3).map(formatSourceLabel).join(", ")
	const remainingCount = activeSources.length - 3
	return `${activeSources.length} sources: ${visibleSources}${remainingCount > 0 ? ` +${remainingCount}` : ""}`
}

const formatSourceNote = (run: {
	source: Source
	query: string
	requested_max_results: number
	returned_count: number
	status: "success" | "partial" | "error" | "no_results"
	error?: string | null
}) => {
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

const formatLibraryAuthor = (author: { firstName?: string; lastName?: string }) =>
	[author.lastName, author.firstName ? `${author.firstName[0]}.` : ""].filter(Boolean).join(" ")

const defaultWorkspaceConfig: ReadPaperWorkspaceConfig = {
	schema_version: "1.0",
	planner_profile_id: "",
	planner_profile_name: "",
	execution_mode: "lightweight_job",
	default_retrieval_strategy: "scholarly_only",
	default_sources: DEFAULT_RETRIEVAL_SOURCES,
	default_max_results: 20,
	default_year_from: undefined,
	default_year_to: undefined,
	default_import_target: "literature_library",
}

const buildWorkspaceForm = (config?: ReadPaperWorkspaceConfig): WorkspaceFormState => {
	const resolved = config ?? defaultWorkspaceConfig
	return {
		planner_profile_id: resolved.planner_profile_id || "",
		planner_profile_name: resolved.planner_profile_name || "",
		default_sources: resolved.default_sources?.length ? resolved.default_sources : DEFAULT_RETRIEVAL_SOURCES,
		default_retrieval_strategy: resolved.default_retrieval_strategy || "scholarly_only",
		default_max_results: String(resolved.default_max_results || 20),
		default_year_from: resolved.default_year_from ? String(resolved.default_year_from) : "",
		default_year_to: resolved.default_year_to ? String(resolved.default_year_to) : "",
		default_import_target: resolved.default_import_target || "literature_library",
	}
}

const buildRetrievalFormFromConfig = (config?: ReadPaperWorkspaceConfig): FormState => {
	const resolved = config ?? defaultWorkspaceConfig
	return {
		title: "",
		Q: "",
		query: "",
		search_keywords: "",
		retrieval_strategy: resolved.default_retrieval_strategy || "scholarly_only",
		search_sources: resolved.default_sources?.length ? resolved.default_sources : DEFAULT_RETRIEVAL_SOURCES,
		max_results: resolved.default_max_results || 20,
		year_from: resolved.default_year_from ? String(resolved.default_year_from) : "",
		year_to: resolved.default_year_to ? String(resolved.default_year_to) : "",
	}
}

const fromRetrieval = (retrieval: Retrieval | undefined): FormState => {
	if (!retrieval) return emptyForm
	return {
		title: retrieval.title || "",
		Q: retrieval.Q || "",
		query: retrieval.query || "",
		search_keywords: retrieval.search_keywords?.join(", ") || "",
		retrieval_strategy: retrieval.retrieval_strategy || "scholarly_only",
		search_sources: retrieval.search_sources?.length ? retrieval.search_sources : DEFAULT_RETRIEVAL_SOURCES,
		max_results: retrieval.max_results || 20,
		year_from: retrieval.year_from ? String(retrieval.year_from) : "",
		year_to: retrieval.year_to ? String(retrieval.year_to) : "",
	}
}

const toPayload = (form: FormState) => ({
	title: form.title,
	Q: form.Q,
	query: normalizeOptionalQuery(form.query),
	search_keywords: toCsv(form.search_keywords),
	retrieval_strategy: form.retrieval_strategy,
	search_sources: form.search_sources,
	max_results: form.max_results,
	year_from: toOptionalNumber(form.year_from),
	year_to: toOptionalNumber(form.year_to),
})

const ReadPaperView: React.FC<ReadPaperViewProps> = ({ onDone }) => {
	const { readPaperRetrievalState, readPaperWorkspaceConfig, literatureLibrary, listApiConfigMeta, cwd } =
		useExtensionState()
	const apiConfigMeta = useMemo(() => listApiConfigMeta ?? [], [listApiConfigMeta])
	const retrievals = readPaperRetrievalState?.retrievals ?? []
	const selectedRetrieval = readPaperRetrievalState?.selectedRetrieval as Retrieval | undefined
	const backendError = readPaperRetrievalState?.last_error as string | undefined
	const workspaceConfig = readPaperWorkspaceConfig ?? readPaperRetrievalState?.config ?? defaultWorkspaceConfig
	const libraryEntries = literatureLibrary?.entries ?? []
	const libraryStats = literatureLibrary?.stats
	const [form, setForm] = useState<FormState>(emptyForm)
	const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState>(() => buildWorkspaceForm(workspaceConfig))
	const [activeModule, setActiveModule] = useState<ReadPaperModule>("retrieval")
	const [directoryCollapsed, setDirectoryCollapsed] = useState(true)
	const [advancedQueryOpen, setAdvancedQueryOpen] = useState(false)
	const [summaryDetailsOpen, setSummaryDetailsOpen] = useState(false)
	const [localRunPending, setLocalRunPending] = useState(false)
	const [hasSyncedEmptyDraft, setHasSyncedEmptyDraft] = useState(false)
	const [pendingDeleteRetrievalNo, setPendingDeleteRetrievalNo] = useState<string | null>(null)
	const [expandedCandidateAbstracts, setExpandedCandidateAbstracts] = useState<Record<string, boolean>>({})

	useEffect(() => {
		vscode.postMessage({ type: "readPaperListRetrievals", values: { cwd } })
		vscode.postMessage({ type: "readPaperGetWorkspaceConfig", values: { cwd } })
		vscode.postMessage({ type: "literatureList" })
	}, [cwd])

	useEffect(() => {
		if (selectedRetrieval) {
			setForm(fromRetrieval(selectedRetrieval))
			setLocalRunPending(false)
			setHasSyncedEmptyDraft(false)
			return
		}

		if (!hasSyncedEmptyDraft) {
			setForm(buildRetrievalFormFromConfig(workspaceConfig))
			setHasSyncedEmptyDraft(true)
		}
	}, [selectedRetrieval, workspaceConfig, hasSyncedEmptyDraft])

	useEffect(() => {
		setWorkspaceForm(buildWorkspaceForm(workspaceConfig))
	}, [workspaceConfig])

	useEffect(() => {
		if (backendError || selectedRetrieval?.run_status !== "running") {
			setLocalRunPending(false)
		}
	}, [backendError, selectedRetrieval?.run_status])

	useEffect(() => {
		if (activeModule === "library") {
			vscode.postMessage({ type: "literatureList" })
		}
	}, [activeModule])

	const hasRetrievalInput = Boolean(
		selectedRetrieval ||
			form.title.trim() ||
			form.Q.trim() ||
			form.query.trim() ||
			form.search_keywords.trim() ||
			form.year_from.trim() ||
			form.year_to.trim() ||
			form.max_results !== workspaceConfig.default_max_results ||
			form.search_sources.join(",") !== workspaceConfig.default_sources.join(","),
	)
	const canRun = Boolean(hasRetrievalInput && form.search_sources.length > 0)
	const summary = selectedRetrieval?.result_summary
	const searchProvenance = selectedRetrieval?.search_provenance
	const searchProvenanceRuns = useMemo(() => searchProvenance?.runs ?? [], [searchProvenance?.runs])

	const selectedNotes = useMemo(
		() => (summary?.errors ?? []).filter((note) => note !== "no_results_found"),
		[summary?.errors],
	)
	const sourceNotes = useMemo(
		() => searchProvenanceRuns.filter((run) => run.status !== "success"),
		[searchProvenanceRuns],
	)
	const isRunning = localRunPending || selectedRetrieval?.run_status === "running"
	const runStatusLabel = selectedRetrieval?.run_status
		? {
				idle: "Idle",
				running: "Running",
				completed: "Completed",
				error: "Error",
				aborted: "Aborted",
			}[selectedRetrieval.run_status]
		: "Draft"
	const defaultsSummary = useMemo(() => {
		const profile = workspaceForm.planner_profile_name || workspaceForm.planner_profile_id || "Default profile"
		const sources = formatSourceList(workspaceForm.default_sources)
		const strategy =
			workspaceForm.default_retrieval_strategy === "scholarly_plus_web_discovery"
				? "APIs + web discovery"
				: "Scholarly APIs"
		const yearRange =
			workspaceForm.default_year_from || workspaceForm.default_year_to
				? `${workspaceForm.default_year_from || "any"}-${workspaceForm.default_year_to || "now"}`
				: "any year"

		return `${profile} · ${strategy} · ${workspaceForm.default_max_results || 20} results · ${sources} · ${yearRange}`
	}, [
		workspaceForm.default_max_results,
		workspaceForm.default_retrieval_strategy,
		workspaceForm.default_sources,
		workspaceForm.default_year_from,
		workspaceForm.default_year_to,
		workspaceForm.planner_profile_id,
		workspaceForm.planner_profile_name,
	])

	const plannerProfileOptions = useMemo(() => {
		const options = apiConfigMeta.map((config: ProviderSettingsEntry) => ({
			value: config.id,
			label: [config.name, config.apiProvider ? `(${config.apiProvider})` : "", config.modelId || ""]
				.filter(Boolean)
				.join(" "),
		}))

		if (
			workspaceForm.planner_profile_id &&
			!options.some((option) => option.value === workspaceForm.planner_profile_id)
		) {
			options.unshift({
				value: workspaceForm.planner_profile_id,
				label: workspaceForm.planner_profile_name || workspaceForm.planner_profile_id,
			})
		}

		return options
	}, [apiConfigMeta, workspaceForm.planner_profile_id, workspaceForm.planner_profile_name])

	const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
		setForm((current) => ({ ...current, [key]: value }))
	}

	const updateWorkspaceForm = <K extends keyof WorkspaceFormState>(key: K, value: WorkspaceFormState[K]) => {
		setWorkspaceForm((current) => ({ ...current, [key]: value }))
	}

	const applyWorkspaceProfileSelection = (profileId: string) => {
		const selectedProfile = apiConfigMeta.find((entry) => entry.id === profileId)
		setWorkspaceForm((current) => ({
			...current,
			planner_profile_id: profileId,
			planner_profile_name: profileId ? (selectedProfile?.name ?? current.planner_profile_name) : "",
		}))
	}

	const toggleSource = (source: Source, checked: boolean) => {
		setForm((current) => {
			const next = checked
				? [...new Set([...current.search_sources, source])]
				: current.search_sources.filter((item) => item !== source)
			return { ...current, search_sources: next }
		})
	}

	const toggleWorkspaceSource = (source: Source, checked: boolean) => {
		setWorkspaceForm((current) => {
			const next = checked
				? [...new Set([...current.default_sources, source])]
				: current.default_sources.filter((item) => item !== source)
			return { ...current, default_sources: next.length > 0 ? next : DEFAULT_RETRIEVAL_SOURCES }
		})
	}

	const setStrategy = (strategy: Strategy) => {
		setForm((current) => ({ ...current, retrieval_strategy: strategy }))
	}

	const setWorkspaceStrategy = (strategy: Strategy) => {
		setWorkspaceForm((current) => ({ ...current, default_retrieval_strategy: strategy }))
	}

	const syncDraftToDefaults = () => {
		const nextForm = buildRetrievalFormFromConfig(workspaceConfig)
		setForm(nextForm)
		setHasSyncedEmptyDraft(true)
		return nextForm
	}

	const postCreateRetrieval = (nextForm: FormState) => {
		setHasSyncedEmptyDraft(true)
		setActiveModule("retrieval")
		vscode.postMessage({ type: "readPaperCreateRetrieval", values: { ...toPayload(nextForm), cwd } })
	}

	const refreshState = () => {
		vscode.postMessage({ type: "readPaperListRetrievals", values: { cwd } })
		vscode.postMessage({ type: "readPaperGetWorkspaceConfig", values: { cwd } })
	}

	const saveWorkspaceConfig = () => {
		const parsedDefaultYearFrom = toOptionalNumber(workspaceForm.default_year_from)
		const parsedDefaultYearTo = toOptionalNumber(workspaceForm.default_year_to)

		vscode.postMessage({
			type: "readPaperUpdateWorkspaceConfig",
			values: {
				cwd,
				updates: {
					planner_profile_id: workspaceForm.planner_profile_id.trim(),
					planner_profile_name: workspaceForm.planner_profile_name.trim(),
					execution_mode: "lightweight_job",
					default_retrieval_strategy: workspaceForm.default_retrieval_strategy,
					default_sources: workspaceForm.default_sources,
					default_max_results: Math.max(1, Number(workspaceForm.default_max_results) || 20),
					default_year_from: workspaceForm.default_year_from.trim() ? parsedDefaultYearFrom : null,
					default_year_to: workspaceForm.default_year_to.trim() ? parsedDefaultYearTo : null,
					default_import_target: workspaceForm.default_import_target,
				},
			},
		})
	}

	const resetWorkspaceConfig = () => {
		vscode.postMessage({ type: "readPaperResetWorkspaceConfig", values: { cwd } })
	}

	const createNewRetrieval = () => {
		setActiveModule("retrieval")
		const nextForm = syncDraftToDefaults()
		postCreateRetrieval(nextForm)
	}

	const saveRetrieval = () => {
		setActiveModule("retrieval")
		if (!selectedRetrieval) {
			postCreateRetrieval(form)
			return
		}
		vscode.postMessage({
			type: "readPaperUpdateRetrieval",
			values: { retrieval_no: selectedRetrieval.retrieval_no, updates: toPayload(form), cwd },
		})
	}

	const runRetrieval = () => {
		setActiveModule("retrieval")
		setLocalRunPending(true)
		if (!selectedRetrieval) {
			setHasSyncedEmptyDraft(true)
		}
		vscode.postMessage({
			type: "readPaperRunRetrieval",
			values: { retrieval_no: selectedRetrieval?.retrieval_no, updates: toPayload(form), cwd },
		})
	}

	const selectRetrieval = (retrievalNo: string) => {
		setActiveModule("retrieval")
		setHasSyncedEmptyDraft(false)
		vscode.postMessage({ type: "readPaperListRetrievals", values: { retrieval_no: retrievalNo, cwd } })
	}

	const setCandidateState = (candidateNo: string, state: "已确认" | "已排除") => {
		if (!selectedRetrieval) return
		vscode.postMessage({
			type: "readPaperUpdateCandidate",
			values: {
				retrieval_no: selectedRetrieval.retrieval_no,
				candidate_no: candidateNo,
				updates: { state },
				cwd,
			},
		})
	}

	const deleteRetrieval = (retrievalNo: string) => {
		if (!retrievalNo) return
		vscode.postMessage({ type: "readPaperDeleteRetrieval", values: { retrieval_no: retrievalNo, cwd } })
		setPendingDeleteRetrievalNo(null)
	}

	const deleteRetrievalWithImportedEntries = (retrievalNo: string) => {
		if (!retrievalNo) return
		vscode.postMessage({
			type: "readPaperDeleteRetrievalWithImportedEntries",
			values: { retrieval_no: retrievalNo, cwd },
		})
		setPendingDeleteRetrievalNo(null)
	}

	const importRetrieval = (retrievalNo: string) => {
		if (!retrievalNo) return
		vscode.postMessage({ type: "readPaperImportRetrieval", values: { retrieval_no: retrievalNo, cwd } })
	}

	const importCandidate = (candidateNo: string) => {
		if (!selectedRetrieval || !candidateNo) return
		vscode.postMessage({
			type: "readPaperImportCandidate",
			values: { retrieval_no: selectedRetrieval.retrieval_no, candidate_no: candidateNo, cwd },
		})
	}

	const archiveSelectedRetrieval = () => {
		if (!selectedRetrieval) return
		vscode.postMessage({
			type: "readPaperArchiveRetrieval",
			values: { retrieval_no: selectedRetrieval.retrieval_no, cwd },
		})
	}

	const toggleCandidateAbstract = (candidateNo: string) => {
		setExpandedCandidateAbstracts((current) => ({ ...current, [candidateNo]: !current[candidateNo] }))
	}

	const openCandidateUrl = (candidate: RetrievalCandidate) => {
		const url = buildCandidateUrl(candidate)
		if (url) {
			vscode.postMessage({ type: "openExternal", url })
		}
	}

	const activeModuleLabel =
		activeModule === "retrieval"
			? "Retrieval"
			: activeModule === "library"
				? "Literature Library"
				: activeModule === "map"
					? "Literature Map"
					: "Settings"

	const renderModuleNavButton = ({
		module,
		icon: Icon,
		title,
		description,
		count,
	}: {
		module: ReadPaperModule
		icon: React.ComponentType<{ className?: string }>
		title: string
		description: string
		count?: number
	}) => {
		const isActive = activeModule === module

		return (
			<StandardTooltip content={description}>
				<button
					type="button"
					title={title}
					aria-label={title}
					className={cn(
						"flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md border px-2 text-left text-sm transition-colors",
						"focus-visible:outline focus-visible:outline-vscode-focusBorder",
						isActive
							? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
							: "border-vscode-panel-border text-vscode-foreground hover:bg-vscode-list-hoverBackground",
					)}
					onClick={() => setActiveModule(module)}>
					<Icon className="h-4 w-4 shrink-0" />
					<span className="hidden max-w-24 truncate font-medium lg:inline">{title}</span>
					{typeof count === "number" && (
						<span
							className={cn(
								"min-w-5 rounded bg-vscode-badge-background px-1.5 text-center text-[11px] tabular-nums text-vscode-badge-foreground",
								isActive && "opacity-90",
							)}>
							{count}
						</span>
					)}
				</button>
			</StandardTooltip>
		)
	}

	const renderReadPaperModuleNav = () => (
		<nav className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden" aria-label="ReadPaper modules">
			{renderModuleNavButton({
				module: "retrieval",
				icon: FileSearch,
				title: "Retrieval",
				description: "Retrieval sessions and current run",
				count: retrievals.length,
			})}
			{renderModuleNavButton({
				module: "library",
				icon: Library,
				title: "Library",
				description: "Imported papers and tags",
				count: libraryStats?.totalEntries ?? libraryEntries.length,
			})}
			{renderModuleNavButton({
				module: "map",
				icon: Map,
				title: "Map",
				description: "Literature graph and topic drafts",
				count: selectedRetrieval?.candidates?.length ?? 0,
			})}
			{renderModuleNavButton({
				module: "settings",
				icon: Settings2,
				title: "Settings",
				description: "Workspace defaults and planner profile",
			})}
		</nav>
	)

	const renderDirectoryPlaceholder = ({
		icon: Icon,
		title,
		description,
		rows,
	}: {
		icon: React.ComponentType<{ className?: string }>
		title: string
		description: string
		rows: Array<{ label: string; value?: string | number }>
	}) => (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<Icon className="h-3.5 w-3.5 shrink-0" />
				<h4 className="truncate text-xs font-semibold">{title}</h4>
			</div>
			<p className="text-xs text-muted-foreground">{description}</p>
			<div className="space-y-2">
				{rows.map((row) => (
					<div
						key={row.label}
						className="flex items-center justify-between gap-2 rounded-md border border-vscode-panel-border px-2 py-2 text-xs">
						<span className="truncate">{row.label}</span>
						{row.value !== undefined && <span className="shrink-0 text-muted-foreground">{row.value}</span>}
					</div>
				))}
			</div>
		</section>
	)

	const renderRetrievalDirectory = () => (
		<>
			<section className="space-y-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<FileSearch className="h-3.5 w-3.5 shrink-0" />
						<h4 className="truncate text-xs font-semibold">Retrieval sessions</h4>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<span className="text-xs text-muted-foreground">{retrievals.length}</span>
						<StandardTooltip content="Hide navigation and retrieval history">
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7 rounded-full"
								aria-label="Hide navigation and retrieval history"
								onClick={() => setDirectoryCollapsed(true)}>
								<ChevronLeft className="h-3.5 w-3.5" />
							</Button>
						</StandardTooltip>
						<StandardTooltip content="Refresh retrieval sessions">
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7 rounded-full"
								aria-label="Refresh retrieval sessions"
								onClick={refreshCurrentModule}>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
						</StandardTooltip>
						<StandardTooltip content="Create a new retrieval session">
							<Button
								variant="primary"
								size="icon"
								className="h-7 w-7 rounded-full"
								aria-label="Create a new retrieval session"
								onClick={createNewRetrieval}>
								<Plus className="h-4 w-4" />
							</Button>
						</StandardTooltip>
					</div>
				</div>
				<div className="space-y-2">
					{retrievals.map((item: any) => (
						<div
							key={item.retrieval_no}
							className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1.5">
							<button
								type="button"
								onClick={() => selectRetrieval(item.retrieval_no)}
								className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-left text-xs ${
									item.retrieval_no === selectedRetrieval?.retrieval_no
										? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"
										: "border-vscode-panel-border hover:bg-vscode-list-hoverBackground"
								}`}>
								<div className="truncate font-medium">{item.title}</div>
								<div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
									<span className="truncate">
										{item.paper_count ?? 0} papers · {item.state}
									</span>
									<span className="shrink-0 truncate">{item.retrieval_no}</span>
								</div>
								<div
									className={cn(
										"mt-1 truncate text-[11px] text-muted-foreground",
										item.retrieval_no === selectedRetrieval?.retrieval_no
											? "block"
											: "hidden group-hover:block",
									)}>
									{formatSourceSummary(item.sources as Source[] | undefined)}
								</div>
							</button>
							<div
								className={cn(
									"flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100",
									item.retrieval_no === selectedRetrieval?.retrieval_no && "opacity-100",
								)}>
								<StandardTooltip content="Import retrieval to library">
									<Button
										variant="outline"
										size="icon"
										aria-label="Import retrieval"
										onClick={() => importRetrieval(item.retrieval_no)}>
										<Library className="h-3.5 w-3.5" />
									</Button>
								</StandardTooltip>
								<StandardTooltip content="Delete retrieval record">
									<Button
										variant="outline"
										size="icon"
										aria-label="Delete retrieval record"
										onClick={() => setPendingDeleteRetrievalNo(item.retrieval_no)}>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</StandardTooltip>
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="rounded-md border border-vscode-panel-border p-2">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<Settings2 className="h-3.5 w-3.5 shrink-0" />
							<h4 className="truncate text-xs font-semibold">Defaults</h4>
						</div>
						<div className="mt-1 truncate text-xs text-muted-foreground">{defaultsSummary}</div>
					</div>
					<StandardTooltip content="Open workspace settings">
						<Button
							variant="outline"
							size="icon"
							aria-label="Open workspace settings"
							onClick={() => setActiveModule("settings")}>
							<Settings2 className="h-3.5 w-3.5" />
						</Button>
					</StandardTooltip>
				</div>
			</section>
		</>
	)

	const renderModuleDirectory = () => {
		if (activeModule === "retrieval") {
			return renderRetrievalDirectory()
		}
		if (activeModule === "library") {
			return renderDirectoryPlaceholder({
				icon: Library,
				title: "Library directory",
				description: "文献库目录会承载 collection、tag 和 source filter。",
				rows: [
					{ label: "All papers", value: libraryStats?.totalEntries ?? libraryEntries.length },
					{ label: "Unread", value: libraryStats?.unreadCount ?? 0 },
					{ label: "Tags", value: libraryStats?.tagCount ?? 0 },
				],
			})
		}
		if (activeModule === "map") {
			return renderDirectoryPlaceholder({
				icon: Map,
				title: "Map directory",
				description: "文献地图目录会承载 topic cluster、relation graph 和 snapshot。",
				rows: [
					{ label: "Current retrieval", value: selectedRetrieval?.candidates?.length ?? 0 },
					{ label: "Library papers", value: libraryStats?.totalEntries ?? libraryEntries.length },
					{ label: "Graph model", value: "draft" },
				],
			})
		}
		return renderDirectoryPlaceholder({
			icon: Settings2,
			title: "Settings directory",
			description: "设置目录会承载 profile、model preset 和 database preset。",
			rows: [
				{ label: "Planner profile", value: workspaceForm.planner_profile_name || "Default" },
				{
					label: "Strategy",
					value:
						workspaceForm.default_retrieval_strategy === "scholarly_plus_web_discovery"
							? "APIs + discovery"
							: "APIs",
				},
				{ label: "Sources", value: workspaceForm.default_sources.length },
			],
		})
	}

	const refreshCurrentModule = () => {
		if (activeModule === "library") {
			vscode.postMessage({ type: "literatureList" })
			return
		}
		refreshState()
	}

	const renderDirectoryRail = () => (
		<div className="flex h-11 min-h-0 items-center gap-2 border-b border-vscode-panel-border px-2 py-1.5 lg:h-full lg:flex-col lg:border-b-0 lg:border-r">
			<StandardTooltip content="Show navigation and retrieval history" side="right">
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8 rounded-full"
					aria-label="Show navigation and retrieval history"
					onClick={() => setDirectoryCollapsed(false)}>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</StandardTooltip>
			<StandardTooltip
				content={activeModule === "retrieval" ? "Refresh retrieval sessions" : "Refresh current module"}
				side="right">
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8 rounded-full"
					aria-label={activeModule === "retrieval" ? "Refresh retrieval sessions" : "Refresh current module"}
					onClick={refreshCurrentModule}>
					<RefreshCw className="h-3.5 w-3.5" />
				</Button>
			</StandardTooltip>
			{activeModule === "retrieval" && (
				<>
					<StandardTooltip content="Create a new retrieval session" side="right">
						<Button
							variant="primary"
							size="icon"
							className="h-8 w-8 rounded-full"
							aria-label="Create a new retrieval session"
							onClick={createNewRetrieval}>
							<Plus className="h-4 w-4" />
						</Button>
					</StandardTooltip>
					<div className="rounded bg-vscode-badge-background px-1.5 py-0.5 text-[10px] tabular-nums text-vscode-badge-foreground lg:mt-1">
						{retrievals.length}
					</div>
				</>
			)}
		</div>
	)

	const renderWorkspaceEditor = () => (
		<section className="space-y-3">
			<div className="rounded-md border border-vscode-panel-border p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Workspace defaults</p>
						<h4 className="truncate text-sm font-semibold">Model, source and year defaults</h4>
						<p className="mt-1 text-xs text-muted-foreground">
							These values seed new retrieval sessions and draft runs.
						</p>
					</div>
					<div className="flex shrink-0 gap-2">
						<StandardTooltip content="Reset defaults">
							<Button
								variant="outline"
								size="icon"
								aria-label="Reset defaults"
								onClick={resetWorkspaceConfig}>
								<RefreshCw className="h-4 w-4" />
							</Button>
						</StandardTooltip>
						<StandardTooltip content="Save defaults">
							<Button
								variant="outline"
								size="icon"
								aria-label="Save defaults"
								onClick={saveWorkspaceConfig}>
								<Save className="h-4 w-4" />
							</Button>
						</StandardTooltip>
					</div>
				</div>

				<div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<div className="space-y-3">
						<SearchableSelect
							value={workspaceForm.planner_profile_id}
							onValueChange={applyWorkspaceProfileSelection}
							options={plannerProfileOptions}
							placeholder="Select planner profile"
							searchPlaceholder="Search profiles"
							emptyMessage="No matching profile"
							className="w-full"
						/>
						<div className="grid grid-cols-2 gap-2">
							<Input
								value={workspaceForm.planner_profile_name}
								onChange={(event) => updateWorkspaceForm("planner_profile_name", event.target.value)}
								placeholder="Profile name"
							/>
							<Input
								value={workspaceForm.planner_profile_id}
								onChange={(event) => updateWorkspaceForm("planner_profile_id", event.target.value)}
								placeholder="Profile id"
							/>
						</div>
						<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
							<span>Execution mode</span>
							<span className="rounded bg-vscode-badge-background px-2 py-1 text-vscode-badge-foreground">
								lightweight_job
							</span>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<StandardTooltip content="Use only structured scholarly APIs and verified metadata">
								<Button
									variant={
										workspaceForm.default_retrieval_strategy === "scholarly_only"
											? "primary"
											: "outline"
									}
									size="sm"
									onClick={() => setWorkspaceStrategy("scholarly_only")}>
									Scholarly APIs
								</Button>
							</StandardTooltip>
							<StandardTooltip content="Request web discovery as a recall layer, then verify with scholarly metadata APIs">
								<Button
									variant={
										workspaceForm.default_retrieval_strategy === "scholarly_plus_web_discovery"
											? "primary"
											: "outline"
									}
									size="sm"
									onClick={() => setWorkspaceStrategy("scholarly_plus_web_discovery")}>
									APIs + discovery
								</Button>
							</StandardTooltip>
						</div>
					</div>

					<div className="space-y-3">
						<div className="grid grid-cols-3 gap-2">
							<Input
								type="number"
								min={1}
								max={200}
								value={workspaceForm.default_max_results}
								onChange={(event) => updateWorkspaceForm("default_max_results", event.target.value)}
								placeholder="Default max"
							/>
							<Input
								value={workspaceForm.default_year_from}
								onChange={(event) => updateWorkspaceForm("default_year_from", event.target.value)}
								placeholder="Default from"
							/>
							<Input
								value={workspaceForm.default_year_to}
								onChange={(event) => updateWorkspaceForm("default_year_to", event.target.value)}
								placeholder="Default to"
							/>
						</div>
						<div className="flex flex-wrap items-center gap-4 text-sm">
							{RETRIEVAL_SOURCE_OPTIONS.map((sourceOption) => (
								<StandardTooltip key={sourceOption.value} content={sourceOption.description}>
									<label className="flex items-center gap-2">
										<Checkbox
											checked={workspaceForm.default_sources.includes(sourceOption.value)}
											onCheckedChange={(checked) =>
												toggleWorkspaceSource(sourceOption.value, Boolean(checked))
											}
										/>
										<span>{sourceOption.label}</span>
									</label>
								</StandardTooltip>
							))}
						</div>
						<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
							<span>Default import target</span>
							<span className="rounded bg-vscode-badge-background px-2 py-1 text-vscode-badge-foreground">
								{workspaceForm.default_import_target}
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	)

	const renderLibraryDraft = () => (
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
					<StandardTooltip content="Refresh local literature library">
						<Button
							variant="outline"
							size="icon"
							aria-label="Refresh literature library"
							onClick={refreshCurrentModule}>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</StandardTooltip>
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
					{libraryEntries.slice(0, 5).map((entry: any) => (
						<div key={entry.id} className="px-4 py-3 text-sm">
							<div className="font-medium text-vscode-editor-foreground">{entry.title}</div>
							<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
								{entry.authors?.length > 0 && (
									<span className="truncate">
										{entry.authors.slice(0, 3).map(formatLibraryAuthor).join(", ")}
										{entry.authors.length > 3 ? " et al." : ""}
									</span>
								)}
								{entry.year && <span>{entry.year}</span>}
								{entry.journal && <span className="truncate">{entry.journal}</span>}
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

	const renderMapDraft = () => (
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
						<Button
							variant="outline"
							size="icon"
							aria-label="Refresh map draft"
							onClick={refreshCurrentModule}>
							<RefreshCw className="h-4 w-4" />
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
					<Map className="h-4 w-4" />
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

	const renderRetrievalWorkspace = () => (
		<section className="min-w-0 max-w-full space-y-4 overflow-hidden">
			{backendError && (
				<div className="rounded-md border border-vscode-inputValidation-errorBorder bg-vscode-inputValidation-errorBackground p-3 text-xs text-vscode-errorForeground">
					{backendError}
				</div>
			)}

			<div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
				<section className="min-w-0 space-y-4">
					<div className="rounded-md border border-vscode-panel-border p-4">
						<div className="flex items-center justify-between gap-2">
							<div>
								<h4 className="text-sm font-semibold">Query & plan</h4>
								<p className="mt-1 text-xs text-muted-foreground">
									Describe what papers you want. Advanced settings are optional.
								</p>
							</div>
							<div className="flex shrink-0 gap-2">
								<StandardTooltip content="Save retrieval draft">
									<Button
										variant="outline"
										size="icon"
										aria-label="Save retrieval"
										disabled={!hasRetrievalInput}
										onClick={saveRetrieval}>
										<Save className="h-4 w-4" />
									</Button>
								</StandardTooltip>
								<Button
									variant="primary"
									size="sm"
									disabled={!canRun || isRunning}
									onClick={runRetrieval}>
									{isRunning ? (
										<RefreshCw className="h-4 w-4 animate-spin" />
									) : (
										<Play className="h-4 w-4" />
									)}
									<span>{isRunning ? "Running" : "Run"}</span>
								</Button>
							</div>
						</div>

						<div className="mt-4 space-y-3">
							<div className="space-y-1">
								<label className="text-xs font-medium text-muted-foreground">
									Natural-language request
								</label>
								<Textarea
									value={form.Q}
									onChange={(event) => updateForm("Q", event.target.value)}
									placeholder="Describe the literature request in plain language"
									className="min-h-28 resize-y"
								/>
							</div>

							<Collapsible open={advancedQueryOpen} onOpenChange={setAdvancedQueryOpen}>
								<div className="rounded-md border border-vscode-panel-border">
									<CollapsibleTrigger asChild>
										<button
											type="button"
											className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
											aria-label="Toggle advanced query settings">
											<span className="min-w-0">
												<span className="block font-medium text-vscode-editor-foreground">
													Advanced query settings
												</span>
												<span className="mt-0.5 block truncate text-muted-foreground">
													{form.retrieval_strategy === "scholarly_plus_web_discovery"
														? "APIs + discovery"
														: "Scholarly APIs"}{" "}
													· {form.max_results} results · {form.year_from || "any"}-
													{form.year_to || "now"} · {form.search_sources.length} sources
												</span>
											</span>
											<ChevronDown
												className={cn(
													"h-4 w-4 shrink-0 transition-transform",
													advancedQueryOpen ? "rotate-180" : "",
												)}
											/>
										</button>
									</CollapsibleTrigger>
									<CollapsibleContent className="space-y-3 border-t border-vscode-panel-border p-3">
										<div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
											<div className="space-y-1">
												<label className="text-xs font-medium text-muted-foreground">
													Title
												</label>
												<Input
													value={form.title}
													onChange={(event) => updateForm("title", event.target.value)}
													placeholder="Auto-generated title"
													className="text-xs"
												/>
											</div>
											<div className="space-y-1">
												<label className="text-xs font-medium text-muted-foreground">
													Strategy
												</label>
												<div className="grid min-w-0 grid-cols-2 gap-1">
													<StandardTooltip content="Use structured scholarly APIs as the only metadata source">
														<Button
															variant={
																form.retrieval_strategy === "scholarly_only"
																	? "primary"
																	: "outline"
															}
															size="sm"
															className="h-8 whitespace-nowrap text-xs"
															onClick={() => setStrategy("scholarly_only")}>
															Scholarly APIs
														</Button>
													</StandardTooltip>
													<StandardTooltip content="Use web discovery only as a recall layer, then verify with scholarly APIs">
														<Button
															variant={
																form.retrieval_strategy ===
																"scholarly_plus_web_discovery"
																	? "primary"
																	: "outline"
															}
															size="sm"
															className="h-8 whitespace-nowrap text-xs"
															onClick={() => setStrategy("scholarly_plus_web_discovery")}>
															APIs + discovery
														</Button>
													</StandardTooltip>
												</div>
											</div>
										</div>

										<div className="space-y-1">
											<label className="text-xs font-medium text-muted-foreground">
												Executable academic database query
											</label>
											<Textarea
												value={form.query}
												onChange={(event) => updateForm("query", event.target.value)}
												placeholder="Auto-generated from the request; edit only when needed"
												className="min-h-20 resize-y whitespace-pre-wrap break-words"
											/>
										</div>

										<div className="space-y-1">
											<label className="text-xs font-medium text-muted-foreground">
												Keywords
											</label>
											<Input
												value={form.search_keywords}
												onChange={(event) => updateForm("search_keywords", event.target.value)}
												placeholder="Auto-generated keywords, comma separated"
											/>
										</div>

										<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
											<Input
												type="number"
												min={1}
												max={200}
												value={form.max_results}
												onChange={(event) =>
													updateForm("max_results", Number(event.target.value) || 20)
												}
												placeholder="Max"
											/>
											<Input
												value={form.year_from}
												onChange={(event) => updateForm("year_from", event.target.value)}
												placeholder="From"
											/>
											<Input
												value={form.year_to}
												onChange={(event) => updateForm("year_to", event.target.value)}
												placeholder="To"
											/>
										</div>

										<div className="flex flex-wrap items-center gap-4 text-sm">
											{RETRIEVAL_SOURCE_OPTIONS.map((sourceOption) => (
												<StandardTooltip
													key={sourceOption.value}
													content={sourceOption.description}>
													<label className="flex items-center gap-2">
														<Checkbox
															checked={form.search_sources.includes(sourceOption.value)}
															onCheckedChange={(checked) =>
																toggleSource(sourceOption.value, Boolean(checked))
															}
														/>
														<span>{sourceOption.label}</span>
													</label>
												</StandardTooltip>
											))}
										</div>
									</CollapsibleContent>
								</div>
							</Collapsible>

							<div className="border-t border-vscode-panel-border pt-2">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="min-w-0 flex-1 text-xs">
										<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
											<span className="truncate font-medium text-vscode-editor-foreground">
												{selectedRetrieval?.title || "Draft retrieval"}
											</span>
											<span className="text-muted-foreground">
												{selectedRetrieval?.retrieval_no || "Draft"} ·{" "}
												{selectedRetrieval?.state || "未创建"} · {runStatusLabel} ·{" "}
												{selectedRetrieval?.candidates?.length ?? 0} papers
											</span>
										</div>
										<div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
											<span>{selectedRetrieval?.execution_mode ?? "lightweight_job"}</span>
											<span>
												{selectedRetrieval?.retrieval_strategy ===
												"scholarly_plus_web_discovery"
													? "APIs + discovery"
													: "Scholarly APIs"}
											</span>
											<span>
												Profile{" "}
												{selectedRetrieval?.planner_profile_name ||
													workspaceForm.planner_profile_name ||
													"Default"}
											</span>
											<StandardTooltip
												content={formatSourceList(
													selectedRetrieval?.search_sources?.length
														? selectedRetrieval.search_sources
														: workspaceConfig.default_sources,
												)}>
												<span className="max-w-full truncate">
													{formatSourceSummary(
														selectedRetrieval?.search_sources?.length
															? selectedRetrieval.search_sources
															: workspaceConfig.default_sources,
													)}
												</span>
											</StandardTooltip>
										</div>
									</div>
									<div className="flex shrink-0 flex-wrap gap-1">
										<StandardTooltip content="Confirm retrieval">
											<Button
												variant="outline"
												size="icon"
												className="h-8 w-8 rounded-full"
												aria-label="Confirm retrieval"
												disabled={!selectedRetrieval}
												onClick={() =>
													selectedRetrieval &&
													vscode.postMessage({
														type: "readPaperConfirmRetrieval",
														values: { retrieval_no: selectedRetrieval.retrieval_no, cwd },
													})
												}>
												<Check className="h-4 w-4" />
											</Button>
										</StandardTooltip>
										<StandardTooltip content="Import retrieval to library">
											<Button
												variant="outline"
												size="icon"
												className="h-8 w-8 rounded-full"
												aria-label="Import retrieval"
												disabled={!selectedRetrieval}
												onClick={() =>
													selectedRetrieval && importRetrieval(selectedRetrieval.retrieval_no)
												}>
												<Library className="h-4 w-4" />
											</Button>
										</StandardTooltip>
										<DropdownMenu>
											<StandardTooltip content="More retrieval actions">
												<DropdownMenuTrigger asChild>
													<Button
														variant="outline"
														size="icon"
														className="h-8 w-8 rounded-full"
														aria-label="More retrieval actions"
														disabled={!selectedRetrieval}>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
											</StandardTooltip>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onSelect={archiveSelectedRetrieval}>
													<Archive className="h-4 w-4" />
													<span>Archive retrieval</span>
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-vscode-errorForeground"
													onSelect={() =>
														selectedRetrieval &&
														setPendingDeleteRetrievalNo(selectedRetrieval.retrieval_no)
													}>
													<Trash2 className="h-4 w-4" />
													<span>Delete retrieval</span>
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-md border border-vscode-panel-border p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div>
								<h4 className="text-sm font-semibold">Execution summary</h4>
								<p className="mt-1 text-xs text-muted-foreground">
									Track returned counts, provenance, and the gap between target and actual results.
								</p>
							</div>
							<div className="text-xs text-muted-foreground">
								{selectedRetrieval?.last_run_at && (
									<span>Started {new Date(selectedRetrieval.last_run_at).toLocaleString()}</span>
								)}
							</div>
						</div>

						{summary ? (
							<div className="mt-4 space-y-3">
								<div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-vscode-panel-border px-3 py-2 text-sm">
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Found</span>
										<span className="font-semibold">{summary.total_found}</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Saved</span>
										<span className="font-semibold">{summary.total_saved}</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Actual</span>
										<span className="font-semibold">
											{selectedRetrieval?.actual_total_results ?? summary.total_found}
										</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Shortfall</span>
										<span className="font-semibold">{selectedRetrieval?.shortfall ?? 0}</span>
									</div>
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground">Duplicates</span>
										<span className="font-semibold">{summary.duplicates_removed}</span>
									</div>
								</div>

								<Collapsible open={summaryDetailsOpen} onOpenChange={setSummaryDetailsOpen}>
									<div className="rounded-md border border-vscode-panel-border">
										<CollapsibleTrigger asChild>
											<button
												type="button"
												className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
												aria-label="Toggle execution details">
												<span className="min-w-0">
													<span className="block font-medium text-vscode-editor-foreground">
														Execution details
													</span>
													<span className="mt-0.5 block truncate text-muted-foreground">
														Source registry, provenance, notes, and source runs
													</span>
												</span>
												<ChevronDown
													className={cn(
														"h-4 w-4 shrink-0 transition-transform",
														summaryDetailsOpen ? "rotate-180" : "",
													)}
												/>
											</button>
										</CollapsibleTrigger>
										<CollapsibleContent className="space-y-3 border-t border-vscode-panel-border p-3">
											<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
												{selectedRetrieval?.source_registry_version && (
													<div className="rounded-md border border-vscode-panel-border p-3">
														Source registry {selectedRetrieval.source_registry_version}
													</div>
												)}
												{selectedRetrieval?.search_provenance?.summary && (
													<div className="rounded-md border border-vscode-panel-border p-3 sm:col-span-2">
														{selectedRetrieval.search_provenance.summary}
													</div>
												)}
											</div>

											{(selectedNotes.length > 0 || sourceNotes.length > 0) && (
												<div className="space-y-2 rounded-md border border-vscode-panel-border bg-vscode-editorWidget-background p-3 text-xs text-muted-foreground">
													{selectedNotes.length > 0 && (
														<div className="space-y-1">
															<div className="font-medium text-vscode-editor-foreground">
																Search notes
															</div>
															{selectedNotes.map((note) => (
																<div key={note}>{note}</div>
															))}
														</div>
													)}
													{sourceNotes.length > 0 && (
														<div className="space-y-1">
															<div className="font-medium text-vscode-editor-foreground">
																Source status
															</div>
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
												<div className="space-y-2 rounded-md border border-vscode-panel-border p-3 text-xs text-muted-foreground">
													<div className="font-medium text-vscode-editor-foreground">
														Source runs
													</div>
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
									</div>
								</Collapsible>
							</div>
						) : (
							<div className="mt-4 rounded-md border border-dashed border-vscode-panel-border p-6 text-sm text-muted-foreground">
								Run a retrieval to populate summary metrics and provenance details.
							</div>
						)}
					</div>
				</section>

				<section className="min-w-0 space-y-3">
					<div className="flex items-center justify-between gap-2">
						<div>
							<h4 className="text-sm font-semibold">Candidates</h4>
							<p className="mt-1 text-xs text-muted-foreground">
								Title-first list with collapsed abstracts, external opening, and import actions.
							</p>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{selectedRetrieval?.candidates?.length ?? 0} papers</span>
							<StandardTooltip content="Import all candidates to library">
								<Button
									variant="outline"
									size="icon"
									aria-label="Import retrieval candidates"
									disabled={!selectedRetrieval || selectedRetrieval.candidates.length === 0}
									onClick={() =>
										selectedRetrieval && importRetrieval(selectedRetrieval.retrieval_no)
									}>
									<BookPlus className="h-4 w-4" />
								</Button>
							</StandardTooltip>
						</div>
					</div>

					<div className="divide-y divide-vscode-panel-border rounded-md border border-vscode-panel-border">
						{selectedRetrieval?.candidates?.map((candidate) => {
							const candidateUrl = buildCandidateUrl(candidate)
							const isAbstractOpen = Boolean(expandedCandidateAbstracts[candidate.candidate_no])

							return (
								<article
									key={candidate.candidate_no}
									className="bg-vscode-editor-background px-4 py-3 hover:bg-vscode-list-hoverBackground">
									<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-start justify-between gap-2">
												<h5 className="break-words text-sm font-semibold leading-snug text-vscode-editor-foreground">
													{candidate.title}
												</h5>
												<div className="flex shrink-0 flex-wrap gap-1 text-[11px] text-muted-foreground">
													{typeof candidate.existence_confidence === "number" && (
														<span className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
															Existence {Math.round(candidate.existence_confidence * 100)}
															%
														</span>
													)}
													{typeof candidate.relevance_confidence === "number" && (
														<span className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
															Relevance {Math.round(candidate.relevance_confidence * 100)}
															%
														</span>
													)}
												</div>
											</div>

											<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
												{candidate.authors?.length > 0 && (
													<span className="truncate">
														{candidate.authors.slice(0, 3).join(", ")}
														{candidate.authors.length > 3 ? " et al." : ""}
													</span>
												)}
												{candidate.year && <span>{candidate.year}</span>}
												{candidate.venue && <span className="truncate">{candidate.venue}</span>}
												<span>{formatSourceLabel(candidate.source)}</span>
												{candidate.source_id && <span>{candidate.source_id}</span>}
												<span>{candidate.candidate_no}</span>
												<span>{candidate.state}</span>
											</div>

											{candidate.relevance_reason && (
												<p className="mt-2 text-xs text-muted-foreground">
													{candidate.relevance_reason}
												</p>
											)}

											{((candidate.discovery_sources ?? []).length > 0 ||
												(candidate.match_evidence ?? []).length > 0) && (
												<div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
													{(candidate.discovery_sources ?? []).map((source) => (
														<span
															key={`discovery-${candidate.candidate_no}-${source}`}
															className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
															Discovery {source}
														</span>
													))}
													{(candidate.match_evidence ?? []).slice(0, 4).map((evidence) => (
														<span
															key={`evidence-${candidate.candidate_no}-${evidence}`}
															className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
															{evidence}
														</span>
													))}
												</div>
											)}

											{(candidate.metadata_warnings ?? []).length > 0 && (
												<div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
													{(candidate.metadata_warnings ?? []).map((warning) => (
														<span
															key={warning}
															className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
															{warning}
														</span>
													))}
												</div>
											)}

											{candidate.abstract && isAbstractOpen && (
												<div className="mt-3 rounded-md border border-vscode-panel-border bg-vscode-editorWidget-background p-3">
													<p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-vscode-editor-foreground">
														{candidate.abstract}
													</p>
													<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
														{candidate.doi && <span>DOI {candidate.doi}</span>}
														{candidate.source_id && (
															<span>Source ID {candidate.source_id}</span>
														)}
														{candidate.pmid && <span>PMID {candidate.pmid}</span>}
														{candidate.arxiv_id && <span>arXiv {candidate.arxiv_id}</span>}
														{candidate.url && (
															<span className="truncate">{candidate.url}</span>
														)}
													</div>
												</div>
											)}
										</div>

										<div className="flex shrink-0 flex-wrap justify-start gap-1 sm:justify-end">
											{candidate.abstract && (
												<StandardTooltip
													content={isAbstractOpen ? "Hide abstract" : "Show abstract"}>
													<Button
														variant="outline"
														size="sm"
														aria-label={isAbstractOpen ? "Hide abstract" : "Show abstract"}
														onClick={() => toggleCandidateAbstract(candidate.candidate_no)}>
														<span>{isAbstractOpen ? "Hide abstract" : "Abstract"}</span>
													</Button>
												</StandardTooltip>
											)}
											<StandardTooltip
												content={
													candidateUrl
														? "Open candidate in browser"
														: "No external URL available"
												}>
												<Button
													variant="outline"
													size="icon"
													aria-label="Open candidate in browser"
													disabled={!candidateUrl}
													onClick={() => openCandidateUrl(candidate)}>
													<ExternalLink className="h-4 w-4" />
												</Button>
											</StandardTooltip>
											<StandardTooltip content="Confirm candidate">
												<Button
													variant="outline"
													size="icon"
													aria-label="Confirm candidate"
													onClick={() => setCandidateState(candidate.candidate_no, "已确认")}>
													<Check className="h-4 w-4" />
												</Button>
											</StandardTooltip>
											<StandardTooltip content="Exclude candidate">
												<Button
													variant="outline"
													size="icon"
													aria-label="Exclude candidate"
													onClick={() => setCandidateState(candidate.candidate_no, "已排除")}>
													<CircleSlash className="h-4 w-4" />
												</Button>
											</StandardTooltip>
											<StandardTooltip content="Import candidate to library">
												<Button
													variant="outline"
													size="icon"
													aria-label="Import candidate"
													onClick={() => importCandidate(candidate.candidate_no)}>
													<BookPlus className="h-4 w-4" />
												</Button>
											</StandardTooltip>
										</div>
									</div>
								</article>
							)
						})}

						{(!selectedRetrieval || selectedRetrieval.candidates.length === 0) && (
							<div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
								No retrieval candidates yet
							</div>
						)}
					</div>
				</section>
			</div>
		</section>
	)

	return (
		<Tab>
			<TabHeader>
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex min-w-0 shrink-0 items-center gap-2">
						<Button variant="ghost" size="icon" onClick={onDone} aria-label="Back to chat">
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<BookOpenText className="h-5 w-5 shrink-0" />
						<h3 className="truncate text-base font-semibold">ReadPaper</h3>
						<span className="text-xs text-muted-foreground">/</span>
						<span className="truncate text-xs text-muted-foreground">{activeModuleLabel}</span>
					</div>

					<div className="ml-auto min-w-0">{renderReadPaperModuleNav()}</div>
				</div>
			</TabHeader>

			<TabContent className="min-w-0 overflow-hidden p-0">
				<div
					className={cn(
						"grid h-full min-h-0 min-w-0 grid-cols-1 overflow-hidden",
						directoryCollapsed
							? "grid-rows-[44px_minmax(0,1fr)] lg:grid-cols-[44px_minmax(0,1fr)] lg:grid-rows-1"
							: "lg:grid-cols-[clamp(220px,18vw,260px)_minmax(0,1fr)]",
					)}>
					<aside
						className={cn(
							"min-h-0 min-w-0 overflow-hidden",
							!directoryCollapsed && "border-r border-vscode-panel-border",
						)}>
						{directoryCollapsed ? (
							renderDirectoryRail()
						) : (
							<div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-2">
								<div className="space-y-3">{renderModuleDirectory()}</div>
							</div>
						)}
					</aside>

					<main className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-4">
						{activeModule === "retrieval" ? (
							renderRetrievalWorkspace()
						) : activeModule === "settings" ? (
							<div className="space-y-4">
								<div className="rounded-md border border-vscode-panel-border p-4">
									<p className="text-xs font-medium uppercase text-muted-foreground">Settings</p>
									<h4 className="mt-1 text-sm font-semibold">
										Workspace defaults and planner profile
									</h4>
									<p className="mt-1 text-xs text-muted-foreground">
										Adjust the defaults that seed new retrieval sessions. Existing sessions keep
										their own values.
									</p>
								</div>
								{renderWorkspaceEditor()}
							</div>
						) : activeModule === "library" ? (
							renderLibraryDraft()
						) : (
							renderMapDraft()
						)}
					</main>
				</div>
			</TabContent>

			<AlertDialog
				open={Boolean(pendingDeleteRetrievalNo)}
				onOpenChange={(open) => !open && setPendingDeleteRetrievalNo(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete retrieval</AlertDialogTitle>
						<AlertDialogDescription>
							Delete {pendingDeleteRetrievalNo}. You can remove only the retrieval record, or also remove
							matching papers already imported into the literature library.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => pendingDeleteRetrievalNo && deleteRetrieval(pendingDeleteRetrievalNo)}>
							Delete record
						</AlertDialogAction>
						<AlertDialogAction
							className="bg-vscode-inputValidation-errorBackground text-vscode-errorForeground hover:bg-vscode-inputValidation-errorBackground"
							onClick={() =>
								pendingDeleteRetrievalNo && deleteRetrievalWithImportedEntries(pendingDeleteRetrievalNo)
							}>
							Delete record and library entries
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Tab>
	)
}

export default React.memo(ReadPaperView)
