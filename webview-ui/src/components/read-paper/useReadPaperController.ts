import { useEffect, useMemo, useRef, useState } from "react"
import {
	DEFAULT_RETRIEVAL_SOURCES,
	RETRIEVAL_SOURCE_OPTIONS,
	type ProviderSettingsEntry,
	type ReadPaperWorkspaceConfig,
} from "@roo-code/types"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import {
	buildCandidateReviewCounts,
	buildCandidateUrl,
	deriveReadPaperWorkflowState,
	filterCandidates,
	getDefaultCandidateFilter,
} from "./readPaperWorkflow"
import type {
	CandidateDecisionState,
	CandidateFilter,
	DraftMode,
	FormState,
	ReadPaperModule,
	Retrieval,
	RetrievalCandidate,
	Source,
	Strategy,
	WorkspaceFormState,
} from "./types"

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

const toOptionalNumber = (value: string) => {
	if (!value.trim()) return undefined
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

const formatSourceLabel = (source: Source) =>
	RETRIEVAL_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source

const formatSourceList = (sources: Source[] | undefined) =>
	(sources?.length ? sources : DEFAULT_RETRIEVAL_SOURCES).map(formatSourceLabel).join(", ")

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

export function useReadPaperController() {
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
	const [queryComposerOpen, setQueryComposerOpen] = useState(false)
	const [advancedQueryOpen, setAdvancedQueryOpen] = useState(false)
	const [summaryDetailsOpen, setSummaryDetailsOpen] = useState(false)
	const [isRunStarting, setIsRunStarting] = useState(false)
	const [hasSyncedEmptyDraft, setHasSyncedEmptyDraft] = useState(false)
	const [draftMode, setDraftMode] = useState<DraftMode>("unsynced")
	const [pendingDeleteRetrievalNo, setPendingDeleteRetrievalNo] = useState<string | null>(null)
	const [expandedCandidateAbstracts, setExpandedCandidateAbstracts] = useState<Record<string, boolean>>({})
	const [archiveMenuCandidateNo, setArchiveMenuCandidateNo] = useState<string | null>(null)
	const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>("All")
	const candidateFilterRetrievalNoRef = useRef<string | undefined>(undefined)

	useEffect(() => {
		vscode.postMessage({ type: "readPaperListRetrievals", values: { cwd } })
		vscode.postMessage({ type: "readPaperGetWorkspaceConfig", values: { cwd } })
		vscode.postMessage({ type: "literatureList" })
	}, [cwd])

	useEffect(() => {
		if (selectedRetrieval) {
			setForm(fromRetrieval(selectedRetrieval))
			setIsRunStarting(false)
			setHasSyncedEmptyDraft(false)
			setDraftMode("bound_to_retrieval")
			return
		}

		if (!hasSyncedEmptyDraft) {
			setForm(buildRetrievalFormFromConfig(workspaceConfig))
			setHasSyncedEmptyDraft(true)
			setDraftMode("seeded_from_defaults")
		}
	}, [selectedRetrieval, workspaceConfig, hasSyncedEmptyDraft])

	useEffect(() => {
		setWorkspaceForm(buildWorkspaceForm(workspaceConfig))
	}, [workspaceConfig])

	useEffect(() => {
		if (backendError || selectedRetrieval?.run_status !== "running") {
			setIsRunStarting(false)
		}
	}, [backendError, selectedRetrieval?.run_status])

	useEffect(() => {
		if (activeModule === "library") {
			vscode.postMessage({ type: "literatureList" })
		}
	}, [activeModule])

	useEffect(() => {
		if (candidateFilterRetrievalNoRef.current === selectedRetrieval?.retrieval_no) return
		candidateFilterRetrievalNoRef.current = selectedRetrieval?.retrieval_no
		setCandidateFilter(getDefaultCandidateFilter(selectedRetrieval?.candidates ?? []))
	}, [selectedRetrieval?.candidates, selectedRetrieval?.retrieval_no])

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
	const isRunning = isRunStarting || selectedRetrieval?.run_status === "running"
	const runStatusLabel = selectedRetrieval?.run_status
		? {
				idle: "Idle",
				running: "Running",
				completed: "Completed",
				error: "Error",
				aborted: "Aborted",
			}[selectedRetrieval.run_status]
		: "Draft"
	const workflowState = deriveReadPaperWorkflowState({
		retrieval: selectedRetrieval,
		hasRetrievalInput,
		isRunStarting,
	})
	const candidateCounts = buildCandidateReviewCounts(selectedRetrieval?.candidates ?? [])
	const visibleCandidates = filterCandidates(selectedRetrieval?.candidates ?? [], candidateFilter)
	const activeModuleLabel =
		activeModule === "retrieval"
			? "Retrieval"
			: activeModule === "library"
				? "Literature Library"
				: activeModule === "map"
					? "Literature Map"
					: "Settings"
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
		setDraftMode("seeded_from_defaults")
		return nextForm
	}

	const postCreateRetrieval = (nextForm: FormState) => {
		setHasSyncedEmptyDraft(true)
		setDraftMode("seeded_from_defaults")
		setActiveModule("retrieval")
		vscode.postMessage({ type: "readPaperCreateRetrieval", values: { ...toPayload(nextForm), cwd } })
	}

	const refreshState = () => {
		vscode.postMessage({ type: "readPaperListRetrievals", values: { cwd } })
		vscode.postMessage({ type: "readPaperGetWorkspaceConfig", values: { cwd } })
	}

	const refreshCurrentModule = () => {
		if (activeModule === "library") {
			vscode.postMessage({ type: "literatureList" })
			return
		}
		refreshState()
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
		setIsRunStarting(true)
		if (!selectedRetrieval) {
			setHasSyncedEmptyDraft(true)
			setDraftMode("seeded_from_defaults")
		}
		vscode.postMessage({
			type: "readPaperRunRetrieval",
			values: { retrieval_no: selectedRetrieval?.retrieval_no, updates: toPayload(form), cwd },
		})
	}

	const selectRetrieval = (retrievalNo: string) => {
		setActiveModule("retrieval")
		setHasSyncedEmptyDraft(false)
		setDraftMode("unsynced")
		vscode.postMessage({ type: "readPaperListRetrievals", values: { retrieval_no: retrievalNo, cwd } })
	}

	const setCandidateState = (candidateNo: string, state: CandidateDecisionState) => {
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

	const importCandidate = (candidateNo: string, downloadPdfToReference = false) => {
		if (!selectedRetrieval || !candidateNo) return
		vscode.postMessage({
			type: "readPaperImportCandidate",
			values: {
				retrieval_no: selectedRetrieval.retrieval_no,
				candidate_no: candidateNo,
				cwd,
				download_pdf_to_reference: downloadPdfToReference,
			},
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

	const closeArchiveMenuOnBlur = () => {
		setArchiveMenuCandidateNo(null)
	}

	const openCandidateUrl = (candidate: RetrievalCandidate) => {
		const url = buildCandidateUrl(candidate)
		if (url) {
			vscode.postMessage({ type: "openExternal", url })
		}
	}

	return {
		state: {
			cwd,
			retrievals,
			selectedRetrieval,
			backendError,
			workspaceConfig,
			libraryEntries,
			libraryStats,
			form,
			workspaceForm,
			activeModule,
			activeModuleLabel,
			directoryCollapsed,
			queryComposerOpen,
			advancedQueryOpen,
			summaryDetailsOpen,
			isRunStarting,
			isRunning,
			draftMode,
			pendingDeleteRetrievalNo,
			expandedCandidateAbstracts,
			archiveMenuCandidateNo,
			candidateFilter,
			hasRetrievalInput,
			canRun,
			summary,
			searchProvenanceRuns,
			selectedNotes,
			sourceNotes,
			runStatusLabel,
			workflowState,
			candidateCounts,
			visibleCandidates,
			defaultsSummary,
			plannerProfileOptions,
		},
		actions: {
			setActiveModule,
			setDirectoryCollapsed,
			setQueryComposerOpen,
			setAdvancedQueryOpen,
			setSummaryDetailsOpen,
			setPendingDeleteRetrievalNo,
			setArchiveMenuCandidateNo,
			setCandidateFilter,
			updateForm,
			updateWorkspaceForm,
			applyWorkspaceProfileSelection,
			toggleSource,
			toggleWorkspaceSource,
			setStrategy,
			setWorkspaceStrategy,
			saveWorkspaceConfig,
			resetWorkspaceConfig,
			createNewRetrieval,
			saveRetrieval,
			runRetrieval,
			selectRetrieval,
			setCandidateState,
			deleteRetrieval,
			deleteRetrievalWithImportedEntries,
			importRetrieval,
			importCandidate,
			archiveSelectedRetrieval,
			toggleCandidateAbstract,
			closeArchiveMenuOnBlur,
			openCandidateUrl,
			refreshState,
			refreshCurrentModule,
		},
	}
}
