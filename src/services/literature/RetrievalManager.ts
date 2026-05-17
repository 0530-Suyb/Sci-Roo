import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import crypto from "crypto"
import * as vscode from "vscode"

import { RooCodeEventName } from "@roo-code/types"
import type {
	ClineMessage,
	RetrievalAgentOutput,
	RetrievalCandidate,
	RetrievalList,
	RetrievalListItem,
	RetrievalSource,
	RetrievalTask,
} from "@roo-code/types"
import {
	MAX_RETRIEVAL_CANDIDATES,
	RETRIEVAL_LIST_FILENAME,
	RETRIEVAL_SCHEMA_VERSION,
	retrievalAgentOutputSchema,
	retrievalCandidateSchema,
	retrievalListSchema,
	retrievalTaskSchema,
} from "@roo-code/types"

import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { Task } from "../../core/task/Task"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { getWorkspacePath } from "../../utils/path"
import { buildRetrievalAgentPrompt } from "./retrievalAgentPrompt"

const RETRIEVALS_DIR = path.join(".roo", "literature", "retrievals")
const ACTIVITY_LOG_PATH = path.join(".roo", "activity_log.jsonl")
const DEFAULT_SOURCES: RetrievalSource[] = ["pubmed", "arxiv"]

type CreateRetrievalInput = Partial<
	Pick<
		RetrievalTask,
		| "title"
		| "Q"
		| "query"
		| "search_keywords"
		| "search_sources"
		| "max_results"
		| "year_from"
		| "year_to"
		| "inclusion_criteria"
		| "exclusion_criteria"
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
	private cwdOverride = ""
	private pendingTasks = new Map<string, string>()
	private appliedCompletionTimestamps = new Map<string, number>()
	private appliedTaskIds = new Set<string>()

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
		this.workspaceRoot = cwd

		await fs.mkdir(this.retrievalsDir, { recursive: true })
		await fs.mkdir(path.dirname(this.activityLogPath), { recursive: true })
		await this.loadList()
		this.initialized = true
	}

	async dispose(): Promise<void> {
		this.pendingTasks.clear()
		this.appliedCompletionTimestamps.clear()
		this.appliedTaskIds.clear()
		this.initialized = false
		this.workspaceRoot = ""
	}

	async getState(selectedRetrievalNo?: string): Promise<{
		retrievals: RetrievalListItem[]
		selectedRetrieval?: RetrievalTask
	}> {
		await this.ensureInitialized()

		const selected = selectedRetrievalNo || this.retrievalList.retrievals[0]?.retrieval_no || undefined

		return {
			retrievals: this.retrievalList.retrievals,
			selectedRetrieval: selected ? await this.getRetrieval(selected).catch(() => undefined) : undefined,
		}
	}

	async getRetrieval(retrievalNo: string): Promise<RetrievalTask> {
		await this.ensureInitialized()

		const filePath = this.getRetrievalPath(retrievalNo)
		const raw = await fs.readFile(filePath, "utf-8")
		return retrievalTaskSchema.parse(JSON.parse(raw))
	}

	async createRetrieval(input: CreateRetrievalInput): Promise<RetrievalTask> {
		await this.ensureInitialized()

		const now = new Date().toISOString()
		const retrievalNo = this.nextRetrievalNo()
		const retrieval = retrievalTaskSchema.parse({
			schema_version: RETRIEVAL_SCHEMA_VERSION,
			retrieval_no: retrievalNo,
			title: input.title?.trim() || this.deriveTitle(input),
			Q: input.Q?.trim() || "",
			date: now.slice(0, 10),
			state: "未确认",
			query: input.query?.trim() || "",
			search_keywords: normalizeStringArray(input.search_keywords),
			search_sources: normalizeSources(input.search_sources),
			max_results: normalizeMaxResults(input.max_results),
			year_from: normalizeYear(input.year_from),
			year_to: normalizeYear(input.year_to),
			inclusion_criteria: normalizeStringArray(input.inclusion_criteria),
			exclusion_criteria: normalizeStringArray(input.exclusion_criteria),
			search_provenance: { summary: "", runs: [] },
			result_summary: emptyResultSummary(),
			candidates: [],
			run_status: "idle",
			created_at: now,
			updated_at: now,
		})

		await this.saveRetrieval(retrieval)
		await this.upsertListItem(retrieval)
		await this.appendActivity("create_retrieval", retrievalNo, { title: retrieval.title })
		return retrieval
	}

	async updateRetrieval(retrievalNo: string, input: UpdateRetrievalInput): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			...pickDefined({
				title: input.title?.trim(),
				Q: input.Q?.trim(),
				query: input.query?.trim(),
				search_keywords: input.search_keywords ? normalizeStringArray(input.search_keywords) : undefined,
				search_sources: input.search_sources ? normalizeSources(input.search_sources) : undefined,
				max_results: input.max_results ? normalizeMaxResults(input.max_results) : undefined,
				year_from: input.year_from === undefined ? undefined : normalizeYear(input.year_from),
				year_to: input.year_to === undefined ? undefined : normalizeYear(input.year_to),
				inclusion_criteria: input.inclusion_criteria
					? normalizeStringArray(input.inclusion_criteria)
					: undefined,
				exclusion_criteria: input.exclusion_criteria
					? normalizeStringArray(input.exclusion_criteria)
					: undefined,
			}),
			updated_at: new Date().toISOString(),
		})

		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity("update_retrieval", retrievalNo)
		return updated
	}

	async runRetrieval(retrievalNo: string): Promise<RetrievalTask> {
		const provider = this.providerRef.deref()
		if (!provider) throw new Error("ReadPaper provider is not available")

		const retrieval = await this.getRetrieval(retrievalNo)
		const errors = this.validateRunnable(retrieval)
		if (errors.length > 0) {
			const updated = await this.addErrors(retrievalNo, errors)
			await this.appendActivity("agent_output_invalid", retrievalNo, { errors })
			return updated
		}

		const now = new Date().toISOString()
		const prepared = retrievalTaskSchema.parse({
			...retrieval,
			result_summary: {
				...retrieval.result_summary,
				errors: retrieval.result_summary.errors.filter((error) => error !== "retrieval_run_started"),
			},
			updated_at: now,
			last_agent_run_at: now,
			run_status: "running",
		})
		await this.saveRetrieval(prepared)
		await this.upsertListItem(prepared)
		await this.postState(retrievalNo)

		const prompt = buildRetrievalAgentPrompt(prepared)
		const promptHash = hashPrompt(prompt)
		const promptSummary = this.getPromptSummary(prepared)
		const task = (await provider.createTask(prompt, undefined, undefined, {
			workspacePath: this.workspaceRoot,
			enableCheckpoints: false,
			disabledTools: [
				"access_mcp_resource",
				"apply_diff",
				"apply_patch",
				"ask_followup_question",
				"codebase_search",
				"edit",
				"edit_file",
				"execute_command",
				"format_citations",
				"generate_figure",
				"generate_image",
				"generate_manuscript",
				"list_files",
				"literature_library",
				"new_task",
				"read_command_output",
				"read_file",
				"run_slash_command",
				"run_statistical_test",
				"search_and_replace",
				"search_files",
				"search_replace",
				"skill",
				"switch_mode",
				"update_todo_list",
				"use_mcp_tool",
				"write_to_file",
			],
			todoListEnabled: false,
			nonInteractive: true,
			maxAutoRetries: 1,
			startTask: false,
		})) as Task
		this.pendingTasks.set(task.taskId, retrievalNo)
		await this.markTaskId(retrievalNo, task.taskId, promptHash, promptSummary)
		provider.log(
			`ReadPaper retrieval agent task started: retrieval=${retrievalNo}, task=${task.taskId}, prompt=${promptHash.slice(
				0,
				12,
			)}`,
		)

		const onMessage = async ({ message }: { action: "created" | "updated"; message: ClineMessage }) => {
			await this.handleCompletionMessage(task, message).catch((error) => {
				provider.log(`ReadPaper retrieval completion message error: ${error}`)
			})
		}
		const describeAsk = () => {
			const ask = task.taskAsk
			if (!ask?.ask) return ""
			const text = ask.text ? ` text=${truncateForLog(ask.text, 160)}` : ""
			return ` ask=${ask.ask}${text}`
		}
		const logTaskState = (state: string) => {
			provider.log(
				`ReadPaper retrieval task ${state}: retrieval=${retrievalNo}, task=${task.taskId}${describeAsk()}`,
			)
		}
		const onInteractive = () => logTaskState("interactive")
		const onResumable = () => logTaskState("resumable")
		const onIdle = () => logTaskState("idle")
		const onActive = () => logTaskState("active")
		const onToolFailed = (_taskId: string, toolName: string, error: string) => {
			provider.log(
				`ReadPaper retrieval tool failed: retrieval=${retrievalNo}, task=${task.taskId}, tool=${toolName}, error=${truncateForLog(
					error,
					240,
				)}`,
			)
		}
		const detachTaskListeners = () => {
			task.off(RooCodeEventName.Message, onMessage)
			task.off(RooCodeEventName.TaskCompleted, onCompleted)
			task.off(RooCodeEventName.TaskAborted, onAborted)
			task.off(RooCodeEventName.TaskInteractive, onInteractive)
			task.off(RooCodeEventName.TaskResumable, onResumable)
			task.off(RooCodeEventName.TaskIdle, onIdle)
			task.off(RooCodeEventName.TaskActive, onActive)
			task.off(RooCodeEventName.TaskToolFailed, onToolFailed)
		}
		const onCompleted = async () => {
			detachTaskListeners()
			await this.handleTaskCompleted(task).catch((error) => {
				provider.log(`ReadPaper retrieval task completion error: ${error}`)
			})
		}
		const onAborted = async () => {
			detachTaskListeners()
			await this.handleTaskAborted(task).catch((error) => {
				provider.log(`ReadPaper retrieval task abort error: ${error}`)
			})
		}

		task.on(RooCodeEventName.Message, onMessage)
		task.on(RooCodeEventName.TaskCompleted, onCompleted)
		task.on(RooCodeEventName.TaskAborted, onAborted)
		task.on(RooCodeEventName.TaskInteractive, onInteractive)
		task.on(RooCodeEventName.TaskResumable, onResumable)
		task.on(RooCodeEventName.TaskIdle, onIdle)
		task.on(RooCodeEventName.TaskActive, onActive)
		task.on(RooCodeEventName.TaskToolFailed, onToolFailed)

		await this.appendActivity("run_retrieval", retrievalNo, {
			taskId: task.taskId,
			promptHash,
			allowedSources: prepared.search_sources,
			maxResults: prepared.max_results,
		})
		task.start()
		return this.getRetrieval(retrievalNo)
	}

	async applyAgentOutput(retrievalNo: string, completionText: string): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		let parsed: RetrievalAgentOutput

		try {
			const json = this.extractJson(completionText)
			parsed = retrievalAgentOutputSchema.parse(JSON.parse(json))
		} catch (error) {
			const updated = await this.addErrors(retrievalNo, [
				`invalid_agent_output: ${error instanceof Error ? error.message : String(error)}`,
			])
			await this.appendActivity("agent_output_invalid", retrievalNo, { error: String(error) })
			return updated
		}

		const normalized = this.normalizeAgentOutput(retrieval, parsed)
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			query: parsed.query || retrieval.query,
			search_keywords: parsed.search_keywords,
			search_provenance: parsed.search_provenance,
			result_summary: normalized.resultSummary,
			candidates: normalized.candidates,
			run_status: "completed",
			agent_task: retrieval.agent_task
				? { ...retrieval.agent_task, status: "completed", updated_at: new Date().toISOString() }
				: undefined,
			last_completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})

		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.appendActivity("agent_output_applied", retrievalNo, {
			saved: updated.candidates.length,
			duplicatesRemoved: normalized.duplicatesRemoved,
		})
		return updated
	}

	async applySearchToolResult(
		retrievalNo: string,
		searchToolResult: unknown,
		options?: { taskId?: string; source?: string },
	): Promise<RetrievalTask> {
		const retrieval = await this.getRetrieval(retrievalNo)
		let parsed: RetrievalAgentOutput

		try {
			parsed = this.searchToolResultToAgentOutput(retrieval, searchToolResult)
		} catch (error) {
			const updated = await this.addErrors(retrievalNo, [
				`invalid_search_tool_output: ${error instanceof Error ? error.message : String(error)}`,
			])
			await this.appendActivity("search_tool_output_invalid", retrievalNo, {
				error: String(error),
				taskId: options?.taskId,
				source: options?.source,
			})
			return updated
		}

		const normalized = this.normalizeAgentOutput(retrieval, parsed)
		const now = new Date().toISOString()
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			query: parsed.query || retrieval.query,
			search_keywords: parsed.search_keywords,
			search_provenance: parsed.search_provenance,
			result_summary: normalized.resultSummary,
			candidates: normalized.candidates,
			run_status: "completed",
			agent_task: retrieval.agent_task
				? { ...retrieval.agent_task, status: "completed", updated_at: now }
				: undefined,
			last_completed_at: now,
			updated_at: now,
		})

		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		if (options?.taskId) {
			this.markTaskApplied(options.taskId)
		}
		await this.appendActivity("search_tool_output_applied", retrievalNo, {
			saved: updated.candidates.length,
			duplicatesRemoved: normalized.duplicatesRemoved,
			taskId: options?.taskId,
			source: options?.source,
		})
		await this.postState(retrievalNo)
		return updated
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

	private async handleTaskCompleted(task: Task): Promise<void> {
		const retrievalNo = this.pendingTasks.get(task.taskId)
		if (!retrievalNo) return

		if (this.wasTaskApplied(task.taskId)) {
			this.pendingTasks.delete(task.taskId)
			this.clearTaskApplied(task.taskId)
			await this.postState(retrievalNo)
			return
		}

		this.pendingTasks.delete(task.taskId)
		if (await this.tryApplySearchToolResultFromHistory(task, retrievalNo, "task_completed_search_tool_preferred")) {
			await this.postState(retrievalNo)
			return
		}

		const completion = [...task.clineMessages]
			.reverse()
			.find((message) => message.type === "say" && message.say === "completion_result" && message.text)

		if (!completion?.text) {
			if (
				await this.tryApplySearchToolResultFromHistory(task, retrievalNo, "task_completed_without_completion")
			) {
				await this.postState(retrievalNo)
				return
			}

			await this.addErrors(retrievalNo, ["missing_completion_result"])
			await this.appendActivity("agent_output_invalid", retrievalNo, { error: "missing_completion_result" })
			await this.postState(retrievalNo)
			return
		}

		const updated = await this.applyAgentOutput(retrievalNo, completion.text)
		if (updated.run_status === "completed") {
			this.markTaskApplied(task.taskId)
		} else if (
			await this.tryApplySearchToolResultFromHistory(task, retrievalNo, "task_completed_invalid_completion")
		) {
			await this.postState(retrievalNo)
			return
		}
		await this.postState(retrievalNo)
	}

	private async handleTaskAborted(task: Task): Promise<void> {
		const retrievalNo = this.pendingTasks.get(task.taskId)
		if (!retrievalNo) return

		if (this.wasTaskApplied(task.taskId)) {
			this.pendingTasks.delete(task.taskId)
			this.clearTaskApplied(task.taskId)
			await this.postState(retrievalNo)
			return
		}

		this.pendingTasks.delete(task.taskId)
		this.clearTaskApplied(task.taskId)
		if (await this.tryApplySearchToolResultFromHistory(task, retrievalNo, "task_aborted_fallback")) {
			await this.postState(retrievalNo)
			return
		}

		const errors = ["retrieval_task_aborted", ...this.getTaskFailureErrors(task)]
		await this.addErrors(retrievalNo, errors)
		await this.setRunStatus(retrievalNo, "aborted")
		await this.setAgentTaskStatus(retrievalNo, "aborted")
		await this.appendActivity("agent_output_invalid", retrievalNo, { error: "retrieval_task_aborted", errors })
		await this.postState(retrievalNo)
	}

	private async handleCompletionMessage(task: Task, message: ClineMessage): Promise<void> {
		const retrievalNo = this.pendingTasks.get(task.taskId)
		if (!retrievalNo) return
		if (this.wasTaskApplied(task.taskId)) return
		if (
			message.type !== "say" ||
			message.say !== "completion_result" ||
			!message.text ||
			message.partial === true
		) {
			return
		}

		if (this.appliedCompletionTimestamps.get(task.taskId) === message.ts) {
			return
		}

		if (
			await this.tryApplySearchToolResultFromHistory(
				task,
				retrievalNo,
				"completion_message_search_tool_preferred",
			)
		) {
			await this.postState(retrievalNo)
			return
		}

		await this.setAgentTaskStatus(retrievalNo, "completion_received")
		const updated = await this.applyAgentOutput(retrievalNo, message.text)
		if (updated.run_status === "completed") {
			this.markTaskApplied(task.taskId, message.ts)
		}
		await this.postState(retrievalNo)
	}

	private async tryApplySearchToolResultFromHistory(
		task: Task,
		retrievalNo: string,
		source: string,
	): Promise<boolean> {
		const result = this.findLatestSearchToolResult(task)
		if (!result) return false

		const updated = await this.applySearchToolResult(retrievalNo, result, { taskId: task.taskId, source })
		return updated.run_status === "completed"
	}

	private findLatestSearchToolResult(task: Task): unknown | undefined {
		for (const message of [...task.apiConversationHistory].reverse()) {
			if (message.role !== "user") continue
			const blocks = Array.isArray(message.content) ? [...message.content].reverse() : []

			for (const block of blocks) {
				if (!isRecord(block) || block.type !== "tool_result") continue
				const parsed = this.parseToolResultContent(block.content)
				if (isSearchToolResult(parsed)) {
					return parsed
				}
			}
		}

		return undefined
	}

	private parseToolResultContent(content: unknown): unknown | undefined {
		if (typeof content === "string") {
			return this.parseJsonText(content)
		}
		if (Array.isArray(content)) {
			for (const block of content) {
				if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
					const parsed = this.parseJsonText(block.text)
					if (parsed !== undefined) return parsed
				}
			}
		}
		return undefined
	}

	private parseJsonText(text: string): unknown | undefined {
		try {
			return JSON.parse(this.extractJson(text))
		} catch {
			return undefined
		}
	}

	private getTaskFailureErrors(task: Task): string[] {
		const errors: string[] = []
		const lastAsk = [...task.clineMessages]
			.reverse()
			.find(
				(message) =>
					message.type === "ask" &&
					(message.ask === "api_req_failed" || message.ask === "mistake_limit_reached"),
			)
		const lastError = [...task.clineMessages]
			.reverse()
			.find((message) => message.type === "say" && message.say === "error" && message.text)

		if (lastAsk?.ask === "api_req_failed") {
			errors.push(`agent_api_req_failed: ${truncateForLog(lastAsk.text || "API request failed", 240)}`)
		} else if (lastAsk?.ask === "mistake_limit_reached") {
			errors.push(`agent_mistake_limit_reached: ${truncateForLog(lastAsk.text || "mistake limit reached", 240)}`)
		}

		if (lastError?.text) {
			errors.push(`agent_error: ${truncateForLog(lastError.text, 240)}`)
		}

		return [...new Set(errors)]
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

		const bySource = {
			pubmed: savedCandidates.filter((candidate) => candidate.source === "pubmed").length,
			arxiv: savedCandidates.filter((candidate) => candidate.source === "arxiv").length,
		}

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
					by_source: {
						pubmed: candidates.filter((candidate) => isRecord(candidate) && candidate.source === "pubmed")
							.length,
						arxiv: candidates.filter((candidate) => isRecord(candidate) && candidate.source === "arxiv")
							.length,
					},
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

	private markTaskApplied(taskId: string, timestamp = Date.now()): void {
		this.appliedTaskIds.add(taskId)
		this.appliedCompletionTimestamps.set(taskId, timestamp)
	}

	private wasTaskApplied(taskId: string): boolean {
		return this.appliedTaskIds.has(taskId) || this.appliedCompletionTimestamps.has(taskId)
	}

	private clearTaskApplied(taskId: string): void {
		this.appliedTaskIds.delete(taskId)
		this.appliedCompletionTimestamps.delete(taskId)
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
			agent_task: retrieval.agent_task
				? { ...retrieval.agent_task, status: "error", updated_at: new Date().toISOString() }
				: undefined,
			last_error_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.postState(retrievalNo)
		return updated
	}

	private async setRunStatus(retrievalNo: string, runStatus: RetrievalTask["run_status"]): Promise<RetrievalTask> {
		const now = new Date().toISOString()
		const retrieval = await this.getRetrieval(retrievalNo)
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			run_status: runStatus,
			updated_at: now,
			...(runStatus === "completed" ? { last_completed_at: now } : {}),
			...(runStatus === "error" || runStatus === "aborted" ? { last_error_at: now } : {}),
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		return updated
	}

	private async setAgentTaskStatus(
		retrievalNo: string,
		status: NonNullable<RetrievalTask["agent_task"]>["status"],
	): Promise<RetrievalTask> {
		const now = new Date().toISOString()
		const retrieval = await this.getRetrieval(retrievalNo)
		if (!retrieval.agent_task) return retrieval

		const updated = retrievalTaskSchema.parse({
			...retrieval,
			agent_task: {
				...retrieval.agent_task,
				status,
				updated_at: now,
			},
			updated_at: now,
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		return updated
	}

	private validateRunnable(retrieval: RetrievalTask): string[] {
		const errors: string[] = []
		if (!retrieval.query.trim() && !retrieval.Q.trim()) {
			errors.push("query_or_Q_required")
		}
		if (retrieval.search_sources.length === 0) {
			errors.push("source_required")
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

	private async saveList(): Promise<void> {
		await safeWriteJson(this.retrievalListPath, this.retrievalList, { prettyPrint: true })
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

	private async markTaskId(
		retrievalNo: string,
		taskId: string,
		promptHash: string,
		promptSummary: string,
	): Promise<void> {
		const now = new Date().toISOString()
		const retrieval = await this.getRetrieval(retrievalNo)
		const updated = retrievalTaskSchema.parse({
			...retrieval,
			task_id: taskId,
			agent_task: {
				task_id: taskId,
				status: "running",
				prompt_hash: promptHash,
				prompt_summary: promptSummary,
				created_at: now,
				updated_at: now,
			},
			updated_at: now,
		})
		await this.saveRetrieval(updated)
		await this.upsertListItem(updated)
		await this.postState(retrievalNo)
	}

	private getPromptSummary(retrieval: RetrievalTask): string {
		return [
			`ReadPaper Retrieval Task: ${retrieval.retrieval_no}`,
			`Allowed sources: ${retrieval.search_sources.join(", ")}`,
			`Max candidates: ${Math.min(retrieval.max_results, MAX_RETRIEVAL_CANDIDATES)}`,
			"Output: strict JSON only, validated with retrievalAgentOutputSchema",
			"Disallowed: Google Scholar, Semantic Scholar, Crossref, broad web search, PDF download, library import",
		].join(" | ")
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

function emptyResultSummary(): RetrievalTask["result_summary"] {
	return {
		total_found: 0,
		total_saved: 0,
		by_source: { pubmed: 0, arxiv: 0 },
		duplicates_removed: 0,
		errors: [],
	}
}

function normalizeSources(sources: RetrievalSource[] | undefined): RetrievalSource[] {
	const allowed = new Set<RetrievalSource>(["pubmed", "arxiv"])
	const values = (sources?.length ? sources : DEFAULT_SOURCES).filter((source): source is RetrievalSource =>
		allowed.has(source),
	)
	return values.length > 0 ? [...new Set(values)] : DEFAULT_SOURCES
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
	return values.map((value) => value.trim()).filter(Boolean)
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

function isSearchToolResult(value: unknown): boolean {
	if (!isRecord(value)) return false
	if (!Array.isArray(value.candidates)) return false
	return isRecord(value.search_provenance) || isRecord(value.result_summary) || stringValue(value.query).length > 0
}

function hashPrompt(prompt: string): string {
	return crypto.createHash("sha256").update(prompt, "utf8").digest("hex")
}

function truncateForLog(value: string, maxLength: number): string {
	const normalized = value.replace(/\s+/g, " ").trim()
	return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized
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
