import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import * as vscode from "vscode"

import type {
	RetrievalAgentOutput,
	RetrievalCandidate,
	ReadPaperSearchPlan,
	ReadPaperWorkspaceConfig,
	ProviderSettings,
	RetrievalList,
	RetrievalListItem,
	RetrievalSource,
	RetrievalTask,
} from "@roo-code/types"
import {
	DEFAULT_RETRIEVAL_SOURCES,
	MAX_RETRIEVAL_CANDIDATES,
	READPAPER_CONFIG_FILENAME,
	RETRIEVAL_SOURCES,
	RETRIEVAL_LIST_FILENAME,
	RETRIEVAL_SCHEMA_VERSION,
	createDefaultReadPaperWorkspaceConfig,
	createEmptyRetrievalSourceCounts,
	readPaperWorkspaceConfigSchema,
	readPaperSearchPlanSchema,
	retrievalAgentOutputSchema,
	retrievalCandidateSchema,
	retrievalListSchema,
	retrievalTaskSchema,
} from "@roo-code/types"

import type { ClineProvider } from "../../core/webview/ClineProvider"
import { searchLiterature, SEARCH_LITERATURE_SOURCE_REGISTRY_VERSION } from "../../core/tools/SearchLiteratureTool"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { getWorkspacePath } from "../../utils/path"

const RETRIEVALS_DIR = path.join(".roo", "literature", "retrievals")
const ACTIVITY_LOG_PATH = path.join(".roo", "activity_log.jsonl")
const DEFAULT_SOURCES: RetrievalSource[] = DEFAULT_RETRIEVAL_SOURCES

type CreateRetrievalInput = Partial<
	Pick<
		RetrievalTask,
		| "title"
		| "Q"
		| "query"
		| "search_keywords"
		| "retrieval_strategy"
		| "search_sources"
		| "max_results"
		| "year_from"
		| "year_to"
	>
>

type UpdateRetrievalInput = Partial<Omit<CreateRetrievalInput, "search_sources">> & {
	search_sources?: RetrievalSource[]
}

type UpdateCandidateInput = Partial<Pick<RetrievalCandidate, "state" | "notes" | "decision_reason">>

export class RetrievalManager {
	private providerRef: WeakRef<ClineProvider>
	private retrievalList: RetrievalList = { schema_version: RETRIEVAL_SCHEMA_VERSION, retrievals: [] }
	private initialized = false
	private retrievalsDir = ""
	private retrievalListPath = ""
	private activityLogPath = ""
	private workspaceRoot = ""
	private workspaceConfigPath = ""
	private workspaceConfig: ReadPaperWorkspaceConfig = createDefaultReadPaperWorkspaceConfig()
	private workspaceConfigLoaded = false
	private cwdOverride = ""

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	get cwd(): string | undefined {
		return this.resolveCwd()
	}

	setWorkspaceCwd(cwd?: string): void {
		const normalized = normalizeCwd(cwd)
		if (normalized && normalized !== this.cwdOverride) {
			this.cwdOverride = normalized
			if (this.workspaceRoot && this.workspaceRoot !== normalized) {
				this.initialized = false
			}
		}
	}

	async initialize(cwdOverride?: string): Promise<void> {
		this.setWorkspaceCwd(cwdOverride)

		const cwd = this.cwd
		if (!cwd) {
			this.providerRef.deref()?.log("ReadPaper retrieval storage has no workspace cwd yet")
			return
		}
		if (this.initialized && this.workspaceRoot === cwd) return

		this.retrievalsDir = path.join(cwd, RETRIEVALS_DIR)
		this.retrievalListPath = path.join(this.retrievalsDir, RETRIEVAL_LIST_FILENAME)
		this.activityLogPath = path.join(cwd, ACTIVITY_LOG_PATH)
		this.workspaceConfigPath = path.join(cwd, ".roo", "config", READPAPER_CONFIG_FILENAME)
		this.workspaceRoot = cwd

		await fs.mkdir(this.retrievalsDir, { recursive: true })
		await fs.mkdir(path.dirname(this.activityLogPath), { recursive: true })
		await this.loadList()
		await this.loadWorkspaceConfig()
		this.initialized = true
	}

	async dispose(): Promise<void> {
		this.initialized = false
		this.workspaceRoot = ""
		this.workspaceConfigPath = ""
		this.workspaceConfig = createDefaultReadPaperWorkspaceConfig()
		this.workspaceConfigLoaded = false
	}

	async getState(selectedRetrievalNo?: string): Promise<{
		retrievals: RetrievalListItem[]
		selectedRetrieval?: RetrievalTask
		config: ReadPaperWorkspaceConfig
	}> {
		await this.ensureInitialized()

		let selected = selectedRetrievalNo || this.retrievalList.retrievals[0]?.retrieval_no || undefined
		let selectedRetrieval = selected ? await this.getRetrieval(selected).catch(() => undefined) : undefined
		if (!selectedRetrieval && selectedRetrievalNo) {
			selected = this.retrievalList.retrievals.find(
				(item) => item.retrieval_no !== selectedRetrievalNo,
			)?.retrieval_no
			selectedRetrieval = selected ? await this.getRetrieval(selected).catch(() => undefined) : undefined
		}

		return {
			retrievals: this.retrievalList.retrievals,
			selectedRetrieval,
			config: this.workspaceConfig,
		}
	}

	async getWorkspaceConfig(): Promise<ReadPaperWorkspaceConfig> {
		await this.ensureInitialized()
		if (!this.workspaceConfigLoaded) {
			await this.loadWorkspaceConfig()
		}
		return this.workspaceConfig
	}

	async updateWorkspaceConfig(updates: Partial<ReadPaperWorkspaceConfig>): Promise<ReadPaperWorkspaceConfig> {
		await this.ensureInitialized()
		if (!this.workspaceConfigLoaded) {
			await this.loadWorkspaceConfig()
		}

		const nextConfig = createDefaultReadPaperWorkspaceConfig()
		const merged = readPaperWorkspaceConfigSchema.parse({
			...nextConfig,
			...this.workspaceConfig,
			...pickDefined(updates),
			schema_version: this.workspaceConfig.schema_version,
		})

		await this.saveWorkspaceConfig(merged)
		this.workspaceConfig = merged
		this.workspaceConfigLoaded = true
		await this.postState()
		return merged
	}

	async resetWorkspaceConfig(): Promise<ReadPaperWorkspaceConfig> {
		await this.ensureInitialized()
		if (!this.workspaceConfigLoaded) {
			await this.loadWorkspaceConfig()
		}
		const nextConfig = createDefaultReadPaperWorkspaceConfig()
		await this.saveWorkspaceConfig(nextConfig)
		this.workspaceConfig = nextConfig
		this.workspaceConfigLoaded = true
		await this.postState()
		return nextConfig
	}

	async getRetrieval(retrievalNo: string): Promise<RetrievalTask> {
		await this.ensureInitialized()

		const filePath = this.getRetrievalPath(retrievalNo)
		const raw = await fs.readFile(filePath, "utf-8")
		return retrievalTaskSchema.parse(JSON.parse(raw))
	}

	async createRetrieval(input: CreateRetrievalInput): Promise<RetrievalTask> {
		await this.ensureInitialized()
		const config = await this.getWorkspaceConfig()

		const now = new Date().toISOString()
		const retrievalNo = this.nextRetrievalNo()
		const searchSources = normalizeSources(input.search_sources ?? config.default_sources)
		const maxResults = normalizeMaxResults(input.max_results ?? config.default_max_results)
		const yearFrom = normalizeYear(input.year_from ?? config.default_year_from)
		const yearTo = normalizeYear(input.year_to ?? config.default_year_to)
		const retrieval = retrievalTaskSchema.parse({
			schema_version: RETRIEVAL_SCHEMA_VERSION,
			retrieval_no: retrievalNo,
			title: input.title?.trim() || this.deriveTitle(input),
			Q: input.Q?.trim() || "",
			date: now.slice(0, 10),
			state: "未确认",
			execution_mode: config.execution_mode,
			retrieval_strategy: input.retrieval_strategy ?? config.default_retrieval_strategy,
			planner_profile_id: config.planner_profile_id,
			planner_profile_name: config.planner_profile_name,
			query: input.query?.trim() || "",
			search_keywords: normalizeStringArray(input.search_keywords),
			search_sources: searchSources,
			max_results: maxResults,
			year_from: yearFrom,
			year_to: yearTo,
			search_provenance: { summary: "", runs: [] },
			result_summary: emptyResultSummary(),
			candidates: [],
			run_status: "idle",
			actual_total_results: 0,
			shortfall: 0,
			source_registry_version: SEARCH_LITERATURE_SOURCE_REGISTRY_VERSION,
			created_at: now,
			updated_at: now,
		})
		const searchPlan = await buildRetrievalSearchPlan(retrieval, this.providerRef.deref())
		const prepared = retrievalTaskSchema.parse({
			...retrieval,
			query: searchPlan.query,
			search_keywords: searchPlan.search_keywords,
			year_from: searchPlan.year_from,
			year_to: searchPlan.year_to,
			search_provenance: searchPlan.notes.length
				? {
						...retrieval.search_provenance,
						summary: `Prepared search plan: ${searchPlan.notes}`,
					}
				: retrieval.search_provenance,
		})

		await this.saveRetrieval(prepared)
		await this.upsertListItem(prepared)
		await this.appendActivity("create_retrieval", retrievalNo, { title: retrieval.title })
		return prepared
	}

	async updateRetrieval(retrievalNo: string, input: UpdateRetrievalInput): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const updatedDraft = retrievalTaskSchema.parse({
			...retrieval,
			...pickDefined({
				title: input.title?.trim(),
				Q: input.Q?.trim(),
				query: input.query?.trim(),
				search_keywords: input.search_keywords ? normalizeStringArray(input.search_keywords) : undefined,
				retrieval_strategy: input.retrieval_strategy,
				search_sources: input.search_sources ? normalizeSources(input.search_sources) : undefined,
				max_results: input.max_results ? normalizeMaxResults(input.max_results) : undefined,
				year_from: input.year_from === undefined ? undefined : normalizeYear(input.year_from),
				year_to: input.year_to === undefined ? undefined : normalizeYear(input.year_to),
			}),
			updated_at: new Date().toISOString(),
		})
		const searchPlan = await buildRetrievalSearchPlan(updatedDraft, this.providerRef.deref())
		const updated = retrievalTaskSchema.parse({
			...updatedDraft,
			query: searchPlan.query,
			search_keywords: searchPlan.search_keywords,
			year_from: searchPlan.year_from,
			year_to: searchPlan.year_to,
			search_provenance: searchPlan.notes.length
				? {
						...updatedDraft.search_provenance,
						summary: `Prepared search plan: ${searchPlan.notes}`,
					}
				: updatedDraft.search_provenance,
		})

		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity("update_retrieval", retrievalNo)
		return updated
	}

	private async runRetrievalJob(retrievalNo: string): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const errors = this.validateRunnable(retrieval)
		if (errors.length > 0) {
			const updated = await this.addErrors(retrievalNo, errors)
			await this.appendActivity("run_retrieval_job_invalid", retrievalNo, { errors })
			return updated
		}

		const now = new Date().toISOString()
		const searchPlan = await buildRetrievalSearchPlan(retrieval, this.providerRef.deref())
		const planErrors = this.validateSearchPlanForExecution(searchPlan)
		if (planErrors.length > 0) {
			const updated = await this.addErrors(retrievalNo, planErrors)
			await this.appendActivity("run_retrieval_job_invalid", retrievalNo, {
				errors: planErrors,
				query: searchPlan.query,
				searchKeywords: searchPlan.search_keywords,
				notes: searchPlan.notes,
			})
			return updated
		}

		const prepared = retrievalTaskSchema.parse({
			...retrieval,
			query: searchPlan.query,
			search_keywords: searchPlan.search_keywords,
			year_from: searchPlan.year_from,
			year_to: searchPlan.year_to,
			search_provenance: searchPlan.notes.length
				? {
						...retrieval.search_provenance,
						summary: `Prepared search plan: ${searchPlan.notes}`,
					}
				: retrieval.search_provenance,
			result_summary: {
				...retrieval.result_summary,
				errors: retrieval.result_summary.errors.filter((error) => error !== "retrieval_run_started"),
			},
			updated_at: now,
			last_run_at: now,
			run_status: "running",
		})
		await this.saveRetrieval(prepared)
		await this.upsertListItem(prepared)
		await this.postState(retrievalNo)

		let searchResult: Awaited<ReturnType<typeof searchLiterature>>
		try {
			searchResult = await searchLiterature({
				query: prepared.query.trim(),
				sources: prepared.search_sources,
				maxResults: prepared.max_results,
				yearFrom: prepared.year_from ?? undefined,
				yearTo: prepared.year_to ?? undefined,
			})
		} catch (error) {
			const updated = await this.addErrors(retrievalNo, [
				`search_literature_job_failed: ${error instanceof Error ? error.message : String(error)}`,
			])
			await this.appendActivity("run_retrieval_job_failed", retrievalNo, { error: String(error) })
			return updated
		}

		const updated = await this.applySearchToolResult(retrievalNo, searchResult, {
			source: "lightweight_job",
		})
		await this.appendActivity("run_retrieval_job", retrievalNo, {
			allowedSources: prepared.search_sources,
			query: prepared.query,
			searchKeywords: prepared.search_keywords,
			maxResults: prepared.max_results,
			actualResults: updated.actual_total_results,
			shortfall: updated.shortfall,
			sourceRegistryVersion: searchResult.source_registry_version,
		})
		return updated
	}

	async runRetrieval(retrievalNo: string): Promise<RetrievalTask> {
		return this.runRetrievalJob(retrievalNo)
	}

	async applySearchToolResult(
		retrievalNo: string,
		searchToolResult: unknown,
		options?: { source?: string },
	): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		let parsed: RetrievalAgentOutput
		const sourceRegistryVersion =
			isRecord(searchToolResult) && stringValue(searchToolResult.source_registry_version)
				? stringValue(searchToolResult.source_registry_version)
				: SEARCH_LITERATURE_SOURCE_REGISTRY_VERSION

		try {
			parsed = this.searchToolResultToAgentOutput(retrieval, searchToolResult)
		} catch (error) {
			const updated = await this.addErrors(retrievalNo, [
				`invalid_search_tool_output: ${error instanceof Error ? error.message : String(error)}`,
			])
			await this.appendActivity("search_tool_output_invalid", retrievalNo, {
				error: String(error),
				source: options?.source,
			})
			return updated
		}

		const normalized = this.normalizeAgentOutput(retrieval, parsed)
		const searchProvenance = this.applyDiscoveryLayerProvenance(retrieval, parsed.search_provenance)
		const resultSummaryErrors = this.applyDiscoveryLayerErrors(retrieval, normalized.resultSummary.errors)
		const now = new Date().toISOString()
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			query: parsed.query || retrieval.query,
			search_keywords: parsed.search_keywords,
			search_provenance: searchProvenance,
			result_summary: {
				...normalized.resultSummary,
				errors: resultSummaryErrors,
			},
			candidates: normalized.candidates,
			run_status: "completed",
			actual_total_results: normalized.candidates.length,
			shortfall: Math.max(0, retrieval.max_results - normalized.candidates.length),
			source_registry_version: sourceRegistryVersion,
			last_completed_at: now,
			updated_at: now,
		})

		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity("search_tool_output_applied", retrievalNo, {
			saved: updated.candidates.length,
			duplicatesRemoved: normalized.duplicatesRemoved,
			source: options?.source,
		})
		await this.postState(retrievalNo)
		return updated
	}

	private applyDiscoveryLayerProvenance(
		retrieval: RetrievalTask,
		searchProvenance: RetrievalTask["search_provenance"],
	): RetrievalTask["search_provenance"] {
		if (retrieval.retrieval_strategy !== "scholarly_plus_web_discovery") {
			return searchProvenance
		}

		return {
			...searchProvenance,
			summary: [
				searchProvenance.summary,
				"Web discovery recall layer requested, but no web search provider is configured; scholarly APIs remain the source of verified metadata.",
			]
				.filter(Boolean)
				.join(" "),
		}
	}

	private applyDiscoveryLayerErrors(retrieval: RetrievalTask, errors: string[]): string[] {
		if (retrieval.retrieval_strategy !== "scholarly_plus_web_discovery") {
			return errors
		}
		return [...new Set([...errors, "web_discovery_unavailable"])]
	}

	async updateCandidate(
		retrievalNo: string,
		candidateNo: string,
		input: UpdateCandidateInput,
	): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const index = retrieval.candidates.findIndex((candidate) => candidate.candidate_no === candidateNo)
		if (index === -1) throw new Error(`Candidate not found: ${candidateNo}`)

		const nextCandidates = [...retrieval.candidates]
		nextCandidates[index] = {
			...nextCandidates[index],
			...pickDefined({
				state: input.state,
				notes: input.notes,
				decision_reason: input.decision_reason,
			}),
		}

		const updated = retrievalTaskSchema.parse({
			...retrieval,
			candidates: nextCandidates,
			updated_at: new Date().toISOString(),
		})

		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity(input.state === "已排除" ? "exclude_candidate" : "confirm_candidate", retrievalNo, {
			candidateNo,
			state: input.state,
		})
		return updated
	}

	async deleteRetrieval(retrievalNo: string): Promise<string | undefined> {
		await this.ensureInitialized()

		const before = [...this.retrievalList.retrievals]
		const index = before.findIndex((item) => item.retrieval_no === retrievalNo)
		const nextSelectedRetrievalNo =
			(index >= 0 && before[index + 1]?.retrieval_no) ||
			before[index - 1]?.retrieval_no ||
			before[0]?.retrieval_no

		try {
			await fs.unlink(this.getRetrievalPath(retrievalNo))
		} catch (error) {
			if (!isFileMissingError(error)) {
				throw error
			}
		}

		this.retrievalList.retrievals = this.retrievalList.retrievals.filter(
			(item) => item.retrieval_no !== retrievalNo,
		)
		await this.saveList()
		await this.appendActivity("delete_retrieval", retrievalNo, {
			nextSelectedRetrievalNo,
		})
		await this.postState(nextSelectedRetrievalNo)
		return nextSelectedRetrievalNo
	}

	async deleteRetrievalWithImportedEntries(
		retrievalNo: string,
	): Promise<{ nextSelectedRetrievalNo?: string; deletedLibraryEntries: number }> {
		await this.ensureInitialized()

		const provider = this.providerRef.deref()
		if (!provider) throw new Error("ReadPaper provider is not available")

		const retrieval = await this.getRetrieval(retrievalNo)
		const literatureManager = provider.getLiteratureManager()
		let deletedLibraryEntries = 0

		if (literatureManager) {
			if (!literatureManager.isInitialized) {
				await literatureManager.initialize()
			}
			const deletion = await literatureManager.deleteEntriesMatchingReadPaperCandidates(retrieval.candidates, {
				retrievalNo,
			})
			deletedLibraryEntries = deletion.deleted
		}

		const nextSelectedRetrievalNo = await this.deleteRetrieval(retrievalNo)
		await this.appendActivity("delete_retrieval_with_imported_entries", retrievalNo, {
			deletedLibraryEntries,
			nextSelectedRetrievalNo,
		})
		await this.postLiteratureState()
		return { nextSelectedRetrievalNo, deletedLibraryEntries }
	}

	async importCandidateToLibrary(
		retrievalNo: string,
		candidateNo: string,
	): Promise<{ imported: number; updated: number; skipped: number }> {
		return this.importRetrievalCandidatesToLibrary(retrievalNo, [candidateNo])
	}

	async importRetrievalToLibrary(
		retrievalNo: string,
	): Promise<{ imported: number; updated: number; skipped: number }> {
		return this.importRetrievalCandidatesToLibrary(retrievalNo)
	}

	private async importRetrievalCandidatesToLibrary(
		retrievalNo: string,
		candidateNos?: string[],
	): Promise<{ imported: number; updated: number; skipped: number }> {
		await this.ensureInitialized()

		const provider = this.providerRef.deref()
		if (!provider) throw new Error("ReadPaper provider is not available")

		const literatureManager = provider.getLiteratureManager()
		if (!literatureManager) throw new Error("Literature manager is not available")
		if (!literatureManager.isInitialized) {
			await literatureManager.initialize()
		}

		const retrieval = await this.getRetrieval(retrievalNo)
		const selectedCandidates =
			candidateNos && candidateNos.length > 0
				? retrieval.candidates.filter((candidate) => candidateNos.includes(candidate.candidate_no))
				: retrieval.candidates

		if (candidateNos && candidateNos.length > 0 && selectedCandidates.length === 0) {
			throw new Error(`Candidate not found in ${retrievalNo}`)
		}

		let imported = 0
		let updated = 0
		for (const candidate of selectedCandidates) {
			const result = await literatureManager.upsertReadPaperCandidate(candidate, { retrievalNo })
			if (result.created) {
				imported++
			} else {
				updated++
			}
		}

		const skipped = candidateNos ? Math.max(0, candidateNos.length - selectedCandidates.length) : 0
		await this.appendActivity(candidateNos?.length === 1 ? "import_candidate" : "import_retrieval", retrievalNo, {
			candidateNos: selectedCandidates.map((candidate) => candidate.candidate_no),
			imported,
			updated,
			skipped,
		})
		await this.postLiteratureState()
		await this.postState(retrievalNo)
		return { imported, updated, skipped }
	}

	async confirmRetrieval(retrievalNo: string): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			state: "已确认",
			updated_at: new Date().toISOString(),
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity("confirm_retrieval", retrievalNo)
		return updated
	}

	async archiveRetrieval(retrievalNo: string): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			state: "已归档",
			updated_at: new Date().toISOString(),
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity("archive_retrieval", retrievalNo)
		return updated
	}

	private normalizeAgentOutput(
		retrieval: RetrievalTask,
		output: RetrievalAgentOutput,
	): {
		candidates: RetrievalCandidate[]
		resultSummary: RetrievalTask["result_summary"]
		duplicatesRemoved: number
	} {
		const errors = new Set(output.result_summary?.errors ?? [])
		const seen = new Set<string>()
		const candidates: RetrievalCandidate[] = []
		let duplicatesRemoved = 0

		for (const candidate of output.candidates) {
			const duplicateKey = this.getDuplicateKey(candidate)
			if (duplicateKey && seen.has(duplicateKey)) {
				duplicatesRemoved++
				continue
			}
			if (duplicateKey) {
				seen.add(duplicateKey)
			}

			candidates.push(
				retrievalCandidateSchemaWithId({
					...candidate,
					candidate_no: this.formatCandidateNo(candidates.length + 1),
					state: candidate.state ?? "候选",
					...buildCandidateEvidence(candidate, retrieval),
				}),
			)
		}

		const totalFound = output.result_summary?.total_found ?? output.candidates.length
		let savedCandidates = candidates
		if (savedCandidates.length > MAX_RETRIEVAL_CANDIDATES) {
			savedCandidates = savedCandidates.slice(0, MAX_RETRIEVAL_CANDIDATES)
			errors.add("candidate_limit_exceeded")
		}
		if (output.candidates.length === 0) {
			const hasNoResultError = [...errors].some((error) => error.includes("no_results_found"))
			if (!hasNoResultError) {
				errors.add("no_results_found")
			}
		}

		const bySource = buildSourceCounts(savedCandidates)

		return {
			candidates: savedCandidates,
			duplicatesRemoved,
			resultSummary: {
				total_found: totalFound,
				total_saved: savedCandidates.length,
				by_source: bySource,
				duplicates_removed: (output.result_summary?.duplicates_removed ?? 0) + duplicatesRemoved,
				errors: [...errors],
			},
		}
	}

	private searchToolResultToAgentOutput(retrieval: RetrievalTask, searchToolResult: unknown): RetrievalAgentOutput {
		const raw =
			typeof searchToolResult === "string" ? JSON.parse(this.extractJson(searchToolResult)) : searchToolResult
		if (!isRecord(raw)) {
			throw new Error("search_literature result must be a JSON object")
		}

		const candidates = Array.isArray(raw.candidates) ? raw.candidates : []
		const query = stringValue(raw.query) || retrieval.query
		const searchProvenance = isRecord(raw.search_provenance)
			? raw.search_provenance
			: {
					summary: query ? `Search tool returned results for "${query}".` : "Search tool returned results.",
					runs: [],
				}
		const resultSummary = isRecord(raw.result_summary)
			? raw.result_summary
			: {
					total_found: candidates.length,
					total_saved: candidates.length,
					by_source: buildSourceCounts(candidates.filter(isRecord)),
					duplicates_removed: 0,
					errors: [],
				}

		return retrievalAgentOutputSchema.parse({
			query,
			search_keywords: retrieval.search_keywords,
			search_provenance: searchProvenance,
			result_summary: resultSummary,
			candidates,
		})
	}

	private getDuplicateKey(candidate: {
		doi?: string
		pmid?: string
		arxiv_id?: string
		title?: string
	}): string | undefined {
		const doi = normalizeId(candidate.doi)
		if (doi) return `doi:${doi}`

		const pmid = normalizeId(candidate.pmid)
		if (pmid) return `pmid:${pmid}`

		const arxivId = normalizeId(candidate.arxiv_id)
		if (arxivId) return `arxiv:${arxivId}`

		const title = normalizeTitle(candidate.title)
		if (title) return `title:${title}`

		return undefined
	}

	private async addErrors(retrievalNo: string, errors: string[]): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const mergedErrors = [...new Set([...retrieval.result_summary.errors, ...errors])]
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			result_summary: {
				...retrieval.result_summary,
				errors: mergedErrors,
			},
			run_status: "error",
			last_error_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.postState(retrievalNo)
		return updated
	}

	private validateRunnable(retrieval: RetrievalTask): string[] {
		const errors: string[] = []
		if (!retrieval.query.trim() && !retrieval.Q.trim() && retrieval.search_keywords.length === 0) {
			errors.push("query_or_Q_required")
		}
		if (retrieval.search_sources.length === 0) {
			errors.push("source_required")
		}
		return errors
	}

	private validateSearchPlanForExecution(plan: RetrievalSearchPlan): string[] {
		const errors: string[] = []
		if (!plan.query.trim()) {
			errors.push("readpaper_search_plan_query_required")
		}
		if (containsCjk(plan.query)) {
			errors.push("readpaper_search_plan_query_must_be_english")
		}
		if (plan.search_keywords.some(containsCjk)) {
			errors.push("readpaper_search_plan_keywords_must_be_english")
		}
		return errors
	}

	private extractJson(text: string): string {
		const trimmed = text.trim()
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			return trimmed
		}

		const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
		if (fenced?.[1]) {
			return fenced[1].trim()
		}

		const first = trimmed.indexOf("{")
		const last = trimmed.lastIndexOf("}")
		if (first !== -1 && last !== -1 && last > first) {
			return trimmed.slice(first, last + 1)
		}

		throw new Error("No JSON object found in completion result")
	}

	private async loadList(): Promise<void> {
		try {
			const raw = await fs.readFile(this.retrievalListPath, "utf-8")
			this.retrievalList = retrievalListSchema.parse(JSON.parse(raw))
			this.retrievalList.retrievals.sort((a, b) => b.retrieval_no.localeCompare(a.retrieval_no))
		} catch {
			this.retrievalList = { schema_version: RETRIEVAL_SCHEMA_VERSION, retrievals: [] }
			await this.saveList()
		}
	}

	private async loadWorkspaceConfig(): Promise<void> {
		try {
			const raw = await fs.readFile(this.workspaceConfigPath, "utf-8")
			this.workspaceConfig = readPaperWorkspaceConfigSchema.parse(JSON.parse(raw))
		} catch (error) {
			if (!isFileMissingError(error) && !(error instanceof SyntaxError)) {
				throw error
			}
			this.workspaceConfig = createDefaultReadPaperWorkspaceConfig()
			await this.saveWorkspaceConfig(this.workspaceConfig)
		}

		this.workspaceConfigLoaded = true
	}

	private async saveList(): Promise<void> {
		await safeWriteJson(this.retrievalListPath, this.retrievalList, { prettyPrint: true })
	}

	private async saveWorkspaceConfig(config: ReadPaperWorkspaceConfig): Promise<void> {
		await safeWriteJson(this.workspaceConfigPath, config, { prettyPrint: true })
	}

	private async saveRetrieval(retrieval: RetrievalTask): Promise<void> {
		await safeWriteJson(this.getRetrievalPath(retrieval.retrieval_no), retrieval, { prettyPrint: true })
	}

	private async upsertListItem(retrieval: RetrievalTask): Promise<void> {
		const item = this.toListItem(retrieval)
		const index = this.retrievalList.retrievals.findIndex((existing) => existing.retrieval_no === item.retrieval_no)
		if (index === -1) {
			this.retrievalList.retrievals.unshift(item)
		} else {
			this.retrievalList.retrievals[index] = item
		}
		this.retrievalList.retrievals.sort((a, b) => b.retrieval_no.localeCompare(a.retrieval_no))
		await this.saveList()
	}

	private toListItem(retrieval: RetrievalTask): RetrievalListItem {
		return {
			retrieval_no: retrieval.retrieval_no,
			title: retrieval.title,
			Q: retrieval.Q,
			state: retrieval.state,
			created_at: retrieval.created_at || retrieval.updated_at || new Date().toISOString(),
			updated_at: retrieval.updated_at || new Date().toISOString(),
			query: retrieval.query,
			sources: retrieval.search_sources,
			paper_count: retrieval.candidates.length,
		}
	}

	private async postState(selectedRetrievalNo?: string): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) return

		const state = await this.getState(selectedRetrievalNo)
		await provider.postMessageToWebview({
			type: "readPaperRetrievalState",
			readPaperRetrievalState: state,
		})
	}

	private async postLiteratureState(): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) return

		const manager = provider.getLiteratureManager()
		if (!manager) return

		await provider.postMessageToWebview({
			type: "literatureState",
			literatureState: {
				entries: manager.getAllEntries(),
				tags: manager.getAllTags(),
				stats: manager.getStats(),
				searchResults: null,
				searchQuery: null,
			},
		})
	}

	private async appendActivity(event: string, retrievalNo: string, details?: Record<string, unknown>): Promise<void> {
		if (!this.activityLogPath) return

		const entry = {
			ts: new Date().toISOString(),
			event,
			retrieval_no: retrievalNo,
			...(details ? { details } : {}),
		}
		await fs.appendFile(this.activityLogPath, `${JSON.stringify(entry)}\n`, "utf-8")
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}
		if (!this.initialized) {
			const cwdCandidates = {
				override: this.cwdOverride || null,
				provider: this.providerRef.deref()?.cwd || null,
				workspace: getWorkspacePath() || null,
				firstWorkspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null,
				activeEditorRoot: inferWorkspaceFromOpenEditors() || null,
				extensionRoot: inferWorkspaceFromExtensionPath(this.providerRef.deref()?.context.extensionPath) || null,
			}
			throw new Error(`ReadPaper retrieval storage is not initialized; cwd=${JSON.stringify(cwdCandidates)}`)
		}
	}

	private resolveCwd(): string | undefined {
		return (
			normalizeCwd(this.cwdOverride) ||
			normalizeCwd(this.providerRef.deref()?.cwd) ||
			normalizeCwd(getWorkspacePath()) ||
			normalizeCwd(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath) ||
			normalizeCwd(inferWorkspaceFromOpenEditors()) ||
			normalizeCwd(inferWorkspaceFromExtensionPath(this.providerRef.deref()?.context.extensionPath))
		)
	}

	private getRetrievalPath(retrievalNo: string): string {
		return path.join(this.retrievalsDir, `${retrievalNo}.json`)
	}

	private nextRetrievalNo(): string {
		const max = this.retrievalList.retrievals.reduce((current, item) => {
			const match = item.retrieval_no.match(/^retrieval_(\d+)$/)
			return match ? Math.max(current, Number(match[1])) : current
		}, 0)
		return `retrieval_${String(max + 1).padStart(4, "0")}`
	}

	private formatCandidateNo(index: number): string {
		return `candidate_${String(index).padStart(4, "0")}`
	}

	private deriveTitle(input: CreateRetrievalInput): string {
		return input.Q?.trim() || input.query?.trim() || `ReadPaper retrieval ${new Date().toISOString().slice(0, 10)}`
	}
}

function retrievalCandidateSchemaWithId(candidate: unknown): RetrievalCandidate {
	return retrievalCandidateSchema.parse(candidate)
}

function buildCandidateEvidence(
	candidate: Partial<RetrievalCandidate>,
	retrieval: RetrievalTask,
): Partial<RetrievalCandidate> {
	const verifiedSources = uniqueStrings([
		...normalizeStringArray(candidate.verified_sources),
		...(candidate.source ? [candidate.source] : []),
		...(candidate.doi ? ["doi"] : []),
		...(candidate.pmid ? ["pubmed"] : []),
		...(candidate.arxiv_id ? ["arxiv"] : []),
	])
	const discoverySources = uniqueStrings([
		...normalizeStringArray(candidate.discovery_sources),
		...(retrieval.retrieval_strategy === "scholarly_plus_web_discovery" ? ["web_discovery_requested"] : []),
	])
	const matchEvidence = uniqueStrings([
		...normalizeStringArray(candidate.match_evidence),
		...(candidate.doi ? [`DOI ${candidate.doi}`] : []),
		...(candidate.pmid ? [`PMID ${candidate.pmid}`] : []),
		...(candidate.arxiv_id ? [`arXiv ${candidate.arxiv_id}`] : []),
		...(candidate.source && candidate.source_id ? [`${candidate.source} id ${candidate.source_id}`] : []),
		...(candidate.venue ? [`venue ${candidate.venue}`] : []),
		...(candidate.year ? [`year ${candidate.year}`] : []),
	])

	return {
		verified_sources: verifiedSources,
		discovery_sources: discoverySources,
		match_evidence: matchEvidence,
		existence_confidence:
			candidate.existence_confidence ?? estimateExistenceConfidence(candidate, verifiedSources, matchEvidence),
		relevance_confidence:
			candidate.relevance_confidence ?? candidate.relevance_score ?? estimateRelevanceConfidence(candidate),
	}
}

function estimateExistenceConfidence(
	candidate: Partial<RetrievalCandidate>,
	verifiedSources: string[],
	matchEvidence: string[],
): number {
	let score = 0.58
	if (candidate.doi) score += 0.24
	if (candidate.pmid || candidate.arxiv_id || candidate.source_id) score += 0.1
	if (candidate.title && candidate.authors?.length) score += 0.05
	if (candidate.year && candidate.venue) score += 0.04
	if (verifiedSources.length >= 2) score += 0.05
	if (matchEvidence.length >= 3) score += 0.03
	return clampConfidence(score)
}

function estimateRelevanceConfidence(candidate: Partial<RetrievalCandidate>): number {
	if (typeof candidate.relevance_score === "number") {
		return clampConfidence(candidate.relevance_score)
	}
	if (candidate.relevance_reason) return 0.68
	return 0.5
}

function clampConfidence(value: number): number {
	return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}

function emptyResultSummary(): RetrievalTask["result_summary"] {
	return {
		total_found: 0,
		total_saved: 0,
		by_source: createEmptyRetrievalSourceCounts(),
		duplicates_removed: 0,
		errors: [],
	}
}

function normalizeSources(sources: RetrievalSource[] | undefined): RetrievalSource[] {
	const allowed = new Set<RetrievalSource>(RETRIEVAL_SOURCES)
	const values = (sources?.length ? sources : DEFAULT_SOURCES).filter((source): source is RetrievalSource =>
		allowed.has(source),
	)
	return values.length > 0 ? [...new Set(values)] : DEFAULT_SOURCES
}

function buildSourceCounts(candidates: Array<{ source?: unknown }>): RetrievalTask["result_summary"]["by_source"] {
	const counts = createEmptyRetrievalSourceCounts()
	for (const candidate of candidates) {
		const source = candidate.source
		if (typeof source === "string" && RETRIEVAL_SOURCES.includes(source as RetrievalSource)) {
			counts[source as RetrievalSource] = (counts[source as RetrievalSource] || 0) + 1
		}
	}
	return counts
}

function normalizeMaxResults(value: number | undefined): number {
	if (!value || !Number.isFinite(value)) return 20
	return Math.max(1, Math.min(MAX_RETRIEVAL_CANDIDATES, Math.floor(value)))
}

function normalizeYear(value: number | null | undefined): number | null | undefined {
	if (value === null || value === undefined) return value
	if (!Number.isFinite(value)) return undefined
	return Math.floor(value)
}

function normalizeStringArray(values: string[] | undefined): string[] {
	if (!values) return []
	return uniqueStrings(values.map((value) => value.trim()).filter(Boolean))
}

type RetrievalSearchPlan = ReadPaperSearchPlan

const CHINESE_REQUEST_STOP_PHRASES = [
	"找一下",
	"查一下",
	"帮我",
	"请",
	"检索",
	"搜索",
	"查询",
	"梳理",
	"总结",
	"一下",
	"近两年内",
	"近两年",
	"近三年内",
	"近三年",
	"近五年内",
	"近五年",
	"最近两年",
	"最近三年",
	"最近五年",
	"近年来",
	"近年",
	"最新",
	"关于",
	"方面",
	"领域",
	"方向",
	"主要是",
	"重点是",
	"期刊发表的",
	"期刊发表",
	"期刊",
	"论文",
	"文献",
	"成果",
	"研究",
	"进展",
]

const ENGLISH_REQUEST_STOP_WORDS = new Set([
	"find",
	"search",
	"retrieve",
	"and",
	"or",
	"not",
	"papers",
	"paper",
	"literature",
	"recent",
	"latest",
	"progress",
	"advance",
	"advances",
	"review",
	"journal",
	"journals",
	"published",
	"publication",
	"publications",
	"about",
	"on",
	"for",
	"within",
	"last",
	"years",
	"year",
])

async function buildRetrievalSearchPlan(
	retrieval: RetrievalTask,
	provider?: ClineProvider,
): Promise<RetrievalSearchPlan> {
	const deterministicPlan = buildDeterministicSearchPlan(retrieval)
	if (!shouldUseReadPaperPlanner(retrieval)) {
		return deterministicPlan
	}

	const apiConfiguration = await resolveReadPaperPlannerApiConfiguration(provider, retrieval)
	if (!apiConfiguration) {
		return buildDeterministicSearchPlan(retrieval, "planner profile unavailable; used English heuristic fallback")
	}

	try {
		const plannerPlan = await generateReadPaperSearchPlan(retrieval, apiConfiguration)
		if (plannerPlan) {
			return mergeReadPaperSearchPlans(deterministicPlan, plannerPlan)
		}
	} catch {
		// Fall back to deterministic English-only planning below.
	}

	return buildDeterministicSearchPlan(
		retrieval,
		"planner unavailable or returned non-English output; used English heuristic fallback",
	)
}

function buildDeterministicSearchPlan(retrieval: RetrievalTask, fallbackNote?: string): RetrievalSearchPlan {
	const explicitQuery = normalizeQueryText(retrieval.query)
	const request = normalizeQueryText(retrieval.Q)
	const sourceText = explicitQuery || request
	const primaryPhrase = extractPrimaryTopicPhrase(sourceText)
	const topicSynonyms = expandKnownTopicSynonyms(primaryPhrase)
	const inferredYearRange = inferYearRangeFromRetrievalText(retrieval)
	const year_from = inferredYearRange.year_from ?? retrieval.year_from
	const year_to = inferredYearRange.year_to ?? retrieval.year_to
	const extractedKeywords = [
		...normalizeSearchKeywordsForPlanner(retrieval.search_keywords),
		...topicSynonyms,
		...extractSearchKeywords(sourceText),
		...inferPublicationIntentKeywords(request),
	]
	const search_keywords = uniqueStrings(extractedKeywords.filter(isEnglishSearchTerm)).slice(0, 12)
	const generatedQuery = buildExecutableQuery(sourceText, search_keywords)
	const query = !explicitQuery || shouldRewriteQuery(explicitQuery, request) ? generatedQuery : explicitQuery
	const notes = [
		query && query !== explicitQuery ? `query="${query}"` : explicitQuery ? "using user-edited query" : "",
		search_keywords.length > 0 ? `keywords=${search_keywords.join(", ")}` : "",
		inferredYearRange.note ? inferredYearRange.note : "",
		containsCjk(request) || containsCjk(explicitQuery) ? "translated request into English" : "",
		fallbackNote ?? "",
	]
		.map((note) => note.trim())
		.filter(Boolean)
		.join("; ")

	return readPaperSearchPlanSchema.parse({
		query: query || search_keywords.join(" "),
		search_keywords,
		search_sources: normalizeSources(retrieval.search_sources),
		max_results: normalizeMaxResults(retrieval.max_results),
		year_from,
		year_to,
		notes,
	})
}

async function generateReadPaperSearchPlan(
	retrieval: RetrievalTask,
	apiConfiguration: ProviderSettings,
): Promise<RetrievalSearchPlan | undefined> {
	const prompt = buildReadPaperSearchPlanPrompt(retrieval)
	const completion = await singleCompletionHandler(apiConfiguration, prompt)
	const parsed = parsePlannerCompletion(completion)
	if (!parsed) {
		throw new Error("Planner did not return valid JSON")
	}

	const normalized = normalizePlannerSearchPlan(parsed, retrieval)
	if (containsCjk(normalized.query) || normalized.search_keywords.some(containsCjk)) {
		throw new Error("Planner returned non-English query or keywords")
	}

	return normalized
}

async function resolveReadPaperPlannerApiConfiguration(
	provider: ClineProvider | undefined,
	retrieval: RetrievalTask,
): Promise<ProviderSettings | undefined> {
	if (!provider) return undefined

	const profileId = retrieval.planner_profile_id.trim()
	if (profileId) {
		try {
			const { name: _name, ...profile } = await provider.providerSettingsManager.getProfile({ id: profileId })
			if (profile.apiProvider) return profile
		} catch {
			// Ignore invalid planner profiles and fall back to the active provider.
		}
	}

	const profileName = retrieval.planner_profile_name.trim()
	if (profileName) {
		try {
			const { name: _name, ...profile } = await provider.providerSettingsManager.getProfile({ name: profileName })
			if (profile.apiProvider) return profile
		} catch {
			// Ignore invalid planner profiles and fall back to the active provider.
		}
	}

	const current = provider.contextProxy.getProviderSettings()
	if (current.apiProvider) return current

	try {
		return (await provider.getState()).apiConfiguration
	} catch {
		return undefined
	}
}

function buildReadPaperSearchPlanPrompt(retrieval: RetrievalTask): string {
	return [
		"You are the ReadPaper search planner for academic database retrieval.",
		"Translate the user's request into English first, then produce a JSON search plan.",
		"Output JSON only. Do not include markdown, code fences, or commentary.",
		"",
		"Rules:",
		"- query must be an executable academic database query in English.",
		"- search_keywords must be concise English keywords or phrases.",
		"- Do not put Chinese text in query or search_keywords.",
		"- Keep the provided search_sources and max_results unchanged.",
		"- Use Boolean operators when they improve precision.",
		"- Preserve clear English queries if the user already provided one.",
		"- notes should be a short English sentence or two describing the translation and assumptions.",
		"",
		"Input:",
		JSON.stringify(
			{
				retrieval_no: retrieval.retrieval_no,
				title: retrieval.title,
				Q: retrieval.Q,
				query: retrieval.query,
				search_keywords: retrieval.search_keywords,
				search_sources: retrieval.search_sources,
				max_results: retrieval.max_results,
				year_from: retrieval.year_from,
				year_to: retrieval.year_to,
			},
			null,
			2,
		),
	].join("\n")
}

function parsePlannerCompletion(completion: string): Partial<RetrievalSearchPlan> | undefined {
	const trimmed = completion.trim()
	if (!trimmed) return undefined

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
	const candidate = fencedMatch?.[1]?.trim() ?? trimmed
	const firstBrace = candidate.indexOf("{")
	const lastBrace = candidate.lastIndexOf("}")
	const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate

	try {
		const parsed = JSON.parse(jsonText)
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined
		}
		return parsed as Partial<RetrievalSearchPlan>
	} catch {
		return undefined
	}
}

function normalizePlannerSearchPlan(plan: Partial<RetrievalSearchPlan>, retrieval: RetrievalTask): RetrievalSearchPlan {
	const inferredYearRange = inferYearRangeFromRetrievalText(retrieval)
	return readPaperSearchPlanSchema.parse({
		...plan,
		query: normalizeQueryText(plan.query ?? ""),
		search_keywords: normalizeSearchKeywordsForPlanner(plan.search_keywords),
		search_sources: normalizeSources(retrieval.search_sources),
		max_results: normalizeMaxResults(retrieval.max_results),
		year_from: inferredYearRange.year_from ?? normalizeYear(plan.year_from) ?? retrieval.year_from,
		year_to: inferredYearRange.year_to ?? normalizeYear(plan.year_to) ?? retrieval.year_to,
		notes: normalizeQueryText(plan.notes ?? ""),
	})
}

function mergeReadPaperSearchPlans(
	deterministicPlan: RetrievalSearchPlan,
	plannerPlan: RetrievalSearchPlan,
): RetrievalSearchPlan {
	const query = plannerPlan.query.trim() || deterministicPlan.query
	const search_keywords = uniqueStrings([
		...normalizeSearchKeywordsForPlanner(plannerPlan.search_keywords),
		...normalizeSearchKeywordsForPlanner(deterministicPlan.search_keywords),
	]).slice(0, 12)
	const year_from = plannerPlan.year_from ?? deterministicPlan.year_from
	const year_to = plannerPlan.year_to ?? deterministicPlan.year_to
	const notes = [plannerPlan.notes, deterministicPlan.notes].filter(Boolean).join("; ")

	return readPaperSearchPlanSchema.parse({
		...deterministicPlan,
		query,
		search_keywords,
		year_from,
		year_to,
		notes,
	})
}

function shouldUseReadPaperPlanner(retrieval: RetrievalTask): boolean {
	const values = [retrieval.Q, retrieval.query, ...retrieval.search_keywords]
	return values.some((value) => containsCjk(value) || isNaturalLanguageRequest(value))
}

function containsCjk(text: string | undefined): boolean {
	return !!text && /[\p{Script=Han}]/u.test(text)
}

function isEnglishSearchTerm(value: string): boolean {
	const trimmed = normalizeQueryText(value)
	return !!trimmed && !containsCjk(trimmed) && /[A-Za-z]/.test(trimmed)
}

function normalizeSearchKeywordsForPlanner(values: string[] | undefined): string[] {
	return uniqueStrings(
		normalizeStringArray(values)
			.flatMap((value) => expandKnownTopicSynonyms(value))
			.filter(isEnglishSearchTerm),
	)
}

function shouldRewriteQuery(explicitQuery: string, request: string): boolean {
	const normalized = normalizeQueryText(explicitQuery)
	if (!normalized) return true
	if (containsCjk(normalized)) return true
	if (isNaturalLanguageRequest(normalized)) return true
	if (!request.trim()) return false
	if (normalized === normalizeQueryText(request)) {
		return isNaturalLanguageRequest(normalized) || containsCjk(normalized)
	}
	return false
}

function buildExecutableQuery(text: string, keywords: string[]): string {
	const phrase = extractPrimaryTopicPhrase(text)
	if (phrase) {
		const expandedTerms = expandKnownTopicSynonyms(phrase).filter(isEnglishSearchTerm)
		if (expandedTerms.length > 1) {
			return expandedTerms.map(formatBooleanQueryTerm).join(" OR ")
		}
		if (isEnglishSearchTerm(phrase)) {
			return phrase
		}
	}

	const usefulKeywords = keywords.filter(
		(keyword) => isEnglishSearchTerm(keyword) && !isPublicationIntentKeyword(keyword),
	)
	if (usefulKeywords.length > 0) {
		return usefulKeywords.slice(0, 4).join(" ")
	}

	const englishTerms = cleanNaturalLanguageQuery(text)
		.split(/[^A-Za-z0-9+#.-]+/)
		.map((term) => term.trim())
		.filter((term) => term.length >= 3 && !ENGLISH_REQUEST_STOP_WORDS.has(term.toLowerCase()))
	return englishTerms.slice(0, 6).join(" ")
}

function extractPrimaryTopicPhrase(text: string): string {
	const normalized = normalizeQueryText(text)
	const patterns = [
		/[“"']([^“”"']{2,80})[”"']/,
		/关于(.+?)(?:的(?:进展|研究|成果|论文|文献|应用|综述)|方面|领域|方向|$)/,
		/(?:检索|搜索|查询|找一下|查一下)(.+?)(?:的(?:进展|研究|成果|论文|文献|应用|综述)|方面|领域|方向|$)/,
		/(?:about|on)\s+(.+?)(?:\s+(?:progress|advances?|papers?|literature|journal|journals|published)\b|$)/i,
	]

	for (const pattern of patterns) {
		const match = normalized.match(pattern)
		const candidate = cleanNaturalLanguageQuery(match?.[1] ?? "")
		if (isUsefulQueryPhrase(candidate)) return candidate
	}

	const cleaned = cleanNaturalLanguageQuery(normalized)
	return isUsefulQueryPhrase(cleaned) ? cleaned : ""
}

function cleanNaturalLanguageQuery(text: string): string {
	let cleaned = normalizeQueryText(text)
	for (const phrase of CHINESE_REQUEST_STOP_PHRASES) {
		cleaned = cleaned.replaceAll(phrase, " ")
	}
	cleaned = cleaned
		.replace(/\b(?:last|recent|past)\s+\d+\s+years?\b/gi, " ")
		.replace(/\b(?:from|since|between|after|before)\s+(?:18|19|20|21)\d{2}\b/gi, " ")
		.replace(/\b(?:18|19|20|21)\d{2}\s*[-~至到]\s*(?:18|19|20|21)\d{2}\b/g, " ")
		.replace(/\b(?:18|19|20|21)\d{2}\b/g, " ")
		.replace(/[，。；;：:、,.!?？！（）()[\]{}<>]/g, " ")
		.replace(/\s+/g, " ")
		.trim()

	const words = cleaned.split(/\s+/).filter((word) => {
		const normalized = word.toLowerCase()
		return !ENGLISH_REQUEST_STOP_WORDS.has(normalized)
	})
	return words.join(" ").trim()
}

function isNaturalLanguageRequest(text: string): boolean {
	const normalized = normalizeQueryText(text)
	if (!normalized) return false
	if (containsCjk(normalized)) return true
	if (/[，。；;！？?]/.test(normalized)) return true
	if (CHINESE_REQUEST_STOP_PHRASES.some((phrase) => normalized.includes(phrase))) return true
	if (
		/\b(?:find|search|retrieve|papers?|literature|journal|journals|review|recent|latest|last)\b/i.test(normalized)
	) {
		return true
	}
	return false
}

function extractSearchKeywords(text: string): string[] {
	const primaryPhrase = extractPrimaryTopicPhrase(text)
	const cleaned = cleanNaturalLanguageQuery(text)
	const quoted = [...text.matchAll(/[“"']([^“”"']{2,80})[”"']/g)].map((match) => match[1])
	const englishTerms = cleaned
		.split(/[^A-Za-z0-9+#.-]+/)
		.map((term) => term.trim())
		.filter(
			(term) =>
				term.length >= 3 && !ENGLISH_REQUEST_STOP_WORDS.has(term.toLowerCase()) && isEnglishSearchTerm(term),
		)
	const primaryKeywords = expandKnownTopicSynonyms(primaryPhrase).filter(isEnglishSearchTerm)
	return uniqueStrings([...primaryKeywords, ...quoted.filter(isEnglishSearchTerm), ...englishTerms])
}

function expandKnownTopicSynonyms(topic: string): string[] {
	if (!topic) return []
	const normalized = topic.toLowerCase()
	const synonyms = [topic]
	if (/特征模型理论|特征模型/.test(topic)) {
		synonyms.push("feature model theory", "feature modeling", "feature models")
	}
	if (/电子|electronic/.test(topic)) {
		synonyms.push("electronics", "electronic engineering")
	}
	if (/通信|communication|telecommunication/.test(topic)) {
		synonyms.push("communications", "telecommunications", "wireless communication")
	}
	if (/计算机|computer science|computing/.test(topic)) {
		synonyms.push("computer science", "computing")
	}
	if (/机器学习|machine learning/.test(topic)) {
		synonyms.push("machine learning")
	}
	if (/深度学习|deep learning/.test(topic)) {
		synonyms.push("deep learning")
	}
	if (/神经网络|neural network/.test(topic)) {
		synonyms.push("neural networks")
	}
	if (/图神经网络|graph neural network/.test(topic)) {
		synonyms.push("graph neural networks")
	}
	if (/自然语言处理|natural language processing/.test(topic)) {
		synonyms.push("natural language processing")
	}
	if (normalized.includes("feature model")) {
		synonyms.push("特征模型理论", "feature modeling", "feature models")
	}
	return uniqueStrings(synonyms)
}

function formatBooleanQueryTerm(term: string): string {
	const escaped = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
	return `"${escaped}"`
}

function inferPublicationIntentKeywords(text: string): string[] {
	if (!text.trim()) return []
	const keywords: string[] = []
	if (/期刊|journal/i.test(text)) {
		keywords.push("journal article")
	}
	if (/会议|conference/i.test(text)) {
		keywords.push("conference paper")
	}
	if (/综述|review/i.test(text)) {
		keywords.push("review")
	}
	return keywords
}

function isPublicationIntentKeyword(keyword: string): boolean {
	return ["journal article", "conference paper", "review"].includes(keyword.toLowerCase())
}

function inferYearRangeFromRetrievalText(retrieval: RetrievalTask): {
	year_from?: number
	year_to?: number
	note?: string
} {
	return inferYearRange([retrieval.Q, retrieval.query, ...retrieval.search_keywords].filter(Boolean).join(" "))
}

function inferYearRange(text: string): { year_from?: number; year_to?: number; note?: string } {
	const normalized = normalizeQueryText(text)
	const currentYear = new Date().getFullYear()
	const recentChinese = normalized.match(
		/近\s*([一二两三四五六七八九十\d]+)\s*年|最近\s*([一二两三四五六七八九十\d]+)\s*年/,
	)
	const recentEnglish = normalized.match(/\b(?:last|recent|past)\s+(\d{1,2})\s+years?\b/i)
	const recentYears =
		parseChineseNumber(recentChinese?.[1] || recentChinese?.[2] || "") ?? parseInteger(recentEnglish?.[1])
	if (recentYears && recentYears > 0) {
		const startYear = currentYear - recentYears
		return {
			year_from: startYear,
			year_to: currentYear,
			note: `inferred year range ${startYear}-${currentYear}`,
		}
	}

	const rangeMatch = normalized.match(/((?:18|19|20|21)\d{2})\s*(?:-|~|至|到|—)\s*((?:18|19|20|21)\d{2})/)
	if (rangeMatch?.[1] && rangeMatch?.[2]) {
		const first = Number(rangeMatch[1])
		const second = Number(rangeMatch[2])
		return {
			year_from: Math.min(first, second),
			year_to: Math.max(first, second),
			note: `inferred year range ${Math.min(first, second)}-${Math.max(first, second)}`,
		}
	}

	const sinceMatch = normalized.match(/(?:since|after|from|自|从)\s*((?:18|19|20|21)\d{2})/i)
	if (sinceMatch?.[1]) {
		return {
			year_from: Number(sinceMatch[1]),
			year_to: currentYear,
			note: `inferred year range ${sinceMatch[1]}-${currentYear}`,
		}
	}

	return {}
}

function parseChineseNumber(value: string): number | undefined {
	if (!value) return undefined
	const numeric = parseInteger(value)
	if (numeric) return numeric
	const map: Record<string, number> = {
		一: 1,
		二: 2,
		两: 2,
		三: 3,
		四: 4,
		五: 5,
		六: 6,
		七: 7,
		八: 8,
		九: 9,
		十: 10,
	}
	if (value === "十") return 10
	if (value.startsWith("十")) return 10 + (map[value.slice(1)] || 0)
	if (value.endsWith("十")) return (map[value.slice(0, -1)] || 0) * 10
	if (value.includes("十")) {
		const [tens, ones] = value.split("十")
		return (map[tens] || 1) * 10 + (map[ones] || 0)
	}
	return map[value]
}

function parseInteger(value: string | undefined): number | undefined {
	if (!value) return undefined
	const parsed = Number(value)
	return Number.isInteger(parsed) ? parsed : undefined
}

function normalizeQueryText(text: string): string {
	return text.replace(/\s+/g, " ").trim()
}

function isUsefulQueryPhrase(value: string): boolean {
	return value.length >= 2 && value.length <= 100
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const value of values) {
		const normalized = value.trim()
		const key = normalized.toLowerCase()
		if (!normalized || seen.has(key)) continue
		seen.add(key)
		result.push(normalized)
	}
	return result
}

function normalizeId(value: string | undefined): string {
	return (value || "").trim().toLowerCase()
}

function normalizeTitle(value: string | undefined): string {
	return (value || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, "")
		.replace(/\s+/g, " ")
		.trim()
}

function pickDefined<T extends Record<string, unknown>>(values: T): Partial<T> {
	return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : ""
}

function isFileMissingError(error: unknown): boolean {
	return isRecord(error) && typeof error.code === "string" && (error.code === "ENOENT" || error.code === "ENOTDIR")
}

function normalizeCwd(cwd?: string): string | undefined {
	const trimmed = cwd?.trim()
	return trimmed ? path.resolve(trimmed) : undefined
}

function inferWorkspaceFromOpenEditors(): string | undefined {
	const filePath =
		getFilePathFromEditor(vscode.window.activeTextEditor) ||
		vscode.window.visibleTextEditors.map(getFilePathFromEditor).find(Boolean) ||
		vscode.workspace.textDocuments
			.map((document) => (document.uri.scheme === "file" ? document.uri.fsPath : undefined))
			.find(Boolean)

	if (!filePath) return undefined

	const startDir = getStartDir(filePath)
	return findNearestProjectRoot(startDir) || startDir
}

function inferWorkspaceFromExtensionPath(extensionPath?: string): string | undefined {
	if (!extensionPath) return undefined

	const normalized = path.resolve(extensionPath)
	const parent = path.dirname(normalized)

	if (
		path.basename(normalized).toLowerCase() === "src" &&
		["pnpm-workspace.yaml", "package.json", "AGENTS.md"].some((marker) =>
			fsSync.existsSync(path.join(parent, marker)),
		)
	) {
		return parent
	}

	return undefined
}

function getFilePathFromEditor(editor: vscode.TextEditor | undefined): string | undefined {
	const uri = editor?.document.uri
	return uri?.scheme === "file" ? uri.fsPath : undefined
}

function getStartDir(filePath: string): string {
	try {
		const stat = fsSync.statSync(filePath)
		return stat.isDirectory() ? filePath : path.dirname(filePath)
	} catch {
		return path.dirname(filePath)
	}
}

function findNearestProjectRoot(startDir: string): string | undefined {
	let current = path.resolve(startDir)
	const root = path.parse(current).root
	const markers = [".git", "pnpm-workspace.yaml", "package.json", "AGENTS.md", ".roo"]

	while (true) {
		if (markers.some((marker) => fsSync.existsSync(path.join(current, marker)))) {
			return current
		}
		if (current === root) {
			return undefined
		}
		current = path.dirname(current)
	}
}
