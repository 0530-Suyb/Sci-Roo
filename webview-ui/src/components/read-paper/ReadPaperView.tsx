import React, { useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowLeft, BookOpenText, Check, CircleSlash, FileSearch, Play, RefreshCw, Save } from "lucide-react"

import { Button, Checkbox, Input, Textarea } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { Tab, TabContent, TabHeader } from "../common/Tab"

type ReadPaperViewProps = {
	onDone: () => void
}

type Source = "pubmed" | "arxiv"

type RetrievalCandidate = {
	candidate_no: string
	state: string
	source: Source
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
	metadata_warnings?: string[]
}

type Retrieval = {
	retrieval_no: string
	title: string
	Q: string
	state: string
	query: string
	search_keywords: string[]
	search_sources: Source[]
	max_results: number
	year_from?: number | null
	year_to?: number | null
	inclusion_criteria: string[]
	exclusion_criteria: string[]
	search_provenance?: { summary?: string }
	result_summary?: {
		total_found: number
		total_saved: number
		duplicates_removed: number
		errors: string[]
		by_source: { pubmed: number; arxiv: number }
	}
	candidates: RetrievalCandidate[]
	run_status?: "idle" | "running" | "completed" | "error" | "aborted"
	agent_task?: {
		task_id: string
		status: "created" | "running" | "completion_received" | "completed" | "error" | "aborted"
		prompt_hash: string
		prompt_summary: string
		created_at?: string
		updated_at?: string
	}
	task_id?: string
	last_agent_run_at?: string
	last_completed_at?: string
	last_error_at?: string
}

type FormState = {
	title: string
	Q: string
	query: string
	search_keywords: string
	search_sources: Source[]
	max_results: number
	year_from: string
	year_to: string
	inclusion_criteria: string
	exclusion_criteria: string
}

const emptyForm: FormState = {
	title: "",
	Q: "",
	query: "",
	search_keywords: "",
	search_sources: ["pubmed", "arxiv"],
	max_results: 20,
	year_from: "",
	year_to: "",
	inclusion_criteria: "",
	exclusion_criteria: "",
}

const toLines = (value: string) =>
	value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

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

const fromRetrieval = (retrieval: Retrieval | undefined): FormState => {
	if (!retrieval) return emptyForm
	return {
		title: retrieval.title || "",
		Q: retrieval.Q || "",
		query: retrieval.query || "",
		search_keywords: retrieval.search_keywords?.join(", ") || "",
		search_sources: retrieval.search_sources?.length ? retrieval.search_sources : ["pubmed", "arxiv"],
		max_results: retrieval.max_results || 20,
		year_from: retrieval.year_from ? String(retrieval.year_from) : "",
		year_to: retrieval.year_to ? String(retrieval.year_to) : "",
		inclusion_criteria: retrieval.inclusion_criteria?.join("\n") || "",
		exclusion_criteria: retrieval.exclusion_criteria?.join("\n") || "",
	}
}

const toPayload = (form: FormState) => ({
	title: form.title,
	Q: form.Q,
	query: normalizeOptionalQuery(form.query),
	search_keywords: toCsv(form.search_keywords),
	search_sources: form.search_sources,
	max_results: form.max_results,
	year_from: toOptionalNumber(form.year_from),
	year_to: toOptionalNumber(form.year_to),
	inclusion_criteria: toLines(form.inclusion_criteria),
	exclusion_criteria: toLines(form.exclusion_criteria),
})

const ReadPaperView: React.FC<ReadPaperViewProps> = ({ onDone }) => {
	const { readPaperRetrievalState, cwd } = useExtensionState()
	const retrievals = readPaperRetrievalState?.retrievals ?? []
	const selectedRetrieval = readPaperRetrievalState?.selectedRetrieval as Retrieval | undefined
	const backendError = readPaperRetrievalState?.last_error as string | undefined
	const selectedRetrievalRef = useRef<Retrieval | undefined>(selectedRetrieval)
	const [form, setForm] = useState<FormState>(emptyForm)
	const [localRunPending, setLocalRunPending] = useState(false)

	selectedRetrievalRef.current = selectedRetrieval

	useEffect(() => {
		vscode.postMessage({ type: "readPaperListRetrievals", values: { cwd } })
	}, [cwd])

	useEffect(() => {
		setForm(fromRetrieval(selectedRetrievalRef.current))
		setLocalRunPending(false)
	}, [selectedRetrieval?.retrieval_no])

	useEffect(() => {
		if (backendError || selectedRetrieval?.run_status !== "running" || selectedRetrieval?.agent_task?.task_id) {
			setLocalRunPending(false)
		}
	}, [backendError, selectedRetrieval?.run_status, selectedRetrieval?.agent_task?.task_id])

	const hasRetrievalInput = Boolean(form.Q.trim() || form.query.trim())
	const canRun = Boolean(hasRetrievalInput && form.search_sources.length > 0)
	const summary = selectedRetrieval?.result_summary
	const agentTask = selectedRetrieval?.agent_task

	const selectedErrors = useMemo(() => summary?.errors ?? [], [summary?.errors])
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

	const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
		setForm((current) => ({ ...current, [key]: value }))
	}

	const toggleSource = (source: Source, checked: boolean) => {
		setForm((current) => {
			const next = checked
				? [...new Set([...current.search_sources, source])]
				: current.search_sources.filter((item) => item !== source)
			return { ...current, search_sources: next }
		})
	}

	const createRetrieval = () => {
		vscode.postMessage({ type: "readPaperCreateRetrieval", values: { ...toPayload(form), cwd } })
	}

	const saveRetrieval = () => {
		if (!selectedRetrieval) {
			createRetrieval()
			return
		}
		vscode.postMessage({
			type: "readPaperUpdateRetrieval",
			values: { retrieval_no: selectedRetrieval.retrieval_no, updates: toPayload(form), cwd },
		})
	}

	const runRetrieval = () => {
		setLocalRunPending(true)
		vscode.postMessage({
			type: "readPaperRunRetrieval",
			values: { retrieval_no: selectedRetrieval?.retrieval_no, updates: toPayload(form), cwd },
		})
	}

	const selectRetrieval = (retrievalNo: string) => {
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

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<Button variant="ghost" size="icon" onClick={onDone} aria-label="Back to chat">
							<ArrowLeft className="w-4 h-4" />
						</Button>
						<BookOpenText className="w-5 h-5 shrink-0" />
						<h3 className="truncate text-lg font-semibold">ReadPaper</h3>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							aria-label="Refresh retrievals"
							onClick={() => selectRetrieval(selectedRetrieval?.retrieval_no || "")}>
							<RefreshCw className="w-4 h-4" />
						</Button>
						<Button variant="primary" size="sm" disabled={!canRun || isRunning} onClick={runRetrieval}>
							{isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
							<span>{isRunning ? "Running" : "Run"}</span>
						</Button>
					</div>
				</div>
			</TabHeader>

			<TabContent className="p-0">
				<div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)]">
					<aside className="min-h-0 overflow-auto border-r border-vscode-panel-border p-3">
						<Button variant="primary" size="sm" className="mb-3 w-full" onClick={createRetrieval}>
							<FileSearch className="w-4 h-4" />
							<span>New Retrieval</span>
						</Button>
						<div className="space-y-2">
							{retrievals.map((item: any) => (
								<button
									key={item.retrieval_no}
									type="button"
									onClick={() => selectRetrieval(item.retrieval_no)}
									className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
										item.retrieval_no === selectedRetrieval?.retrieval_no
											? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"
											: "border-vscode-panel-border hover:bg-vscode-list-hoverBackground"
									}`}>
									<div className="truncate font-medium">{item.title}</div>
									<div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
										<span>{item.retrieval_no}</span>
										<span>{item.paper_count ?? 0}</span>
									</div>
								</button>
							))}
						</div>
					</aside>

					<main className="min-h-0 overflow-auto p-4">
						<div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
							<section className="space-y-3">
								{backendError && (
									<div className="rounded-md border border-vscode-inputValidation-errorBorder bg-vscode-inputValidation-errorBackground p-3 text-xs text-vscode-errorForeground">
										{backendError}
									</div>
								)}

								<div className="flex items-center justify-between gap-2">
									<div className="min-w-0">
										<h4 className="truncate text-sm font-semibold">
											{selectedRetrieval?.retrieval_no || "Draft retrieval"}
										</h4>
										<p className="text-xs text-muted-foreground">
											{selectedRetrieval?.state || "未创建"} · {runStatusLabel}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="icon"
											aria-label="Save retrieval"
											disabled={!hasRetrievalInput}
											onClick={saveRetrieval}>
											<Save className="w-4 h-4" />
										</Button>
										<Button
											variant="outline"
											size="icon"
											aria-label="Confirm retrieval"
											disabled={!selectedRetrieval}
											onClick={() =>
												selectedRetrieval &&
												vscode.postMessage({
													type: "readPaperConfirmRetrieval",
													values: { retrieval_no: selectedRetrieval.retrieval_no, cwd },
												})
											}>
											<Check className="w-4 h-4" />
										</Button>
										<Button
											variant="outline"
											size="icon"
											aria-label="Archive retrieval"
											disabled={!selectedRetrieval}
											onClick={() =>
												selectedRetrieval &&
												vscode.postMessage({
													type: "readPaperArchiveRetrieval",
													values: { retrieval_no: selectedRetrieval.retrieval_no, cwd },
												})
											}>
											<Archive className="w-4 h-4" />
										</Button>
									</div>
								</div>

								<Input
									value={form.title}
									onChange={(event) => updateForm("title", event.target.value)}
									placeholder="Title"
								/>
								<Textarea
									value={form.Q}
									onChange={(event) => updateForm("Q", event.target.value)}
									placeholder="Natural-language retrieval request"
									className="min-h-24 resize-y"
								/>
								<Textarea
									value={form.query}
									onChange={(event) => updateForm("query", event.target.value)}
									placeholder="Executable PubMed/arXiv query"
									className="min-h-20 resize-y"
								/>
								<Input
									value={form.search_keywords}
									onChange={(event) => updateForm("search_keywords", event.target.value)}
									placeholder="Keywords, comma separated"
								/>

								<div className="grid grid-cols-3 gap-2">
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

								<div className="flex items-center gap-4 text-sm">
									<label className="flex items-center gap-2">
										<Checkbox
											checked={form.search_sources.includes("pubmed")}
											onCheckedChange={(checked) => toggleSource("pubmed", Boolean(checked))}
										/>
										<span>PubMed</span>
									</label>
									<label className="flex items-center gap-2">
										<Checkbox
											checked={form.search_sources.includes("arxiv")}
											onCheckedChange={(checked) => toggleSource("arxiv", Boolean(checked))}
										/>
										<span>arXiv</span>
									</label>
								</div>

								<Textarea
									value={form.inclusion_criteria}
									onChange={(event) => updateForm("inclusion_criteria", event.target.value)}
									placeholder="Inclusion criteria, one per line"
									className="min-h-20 resize-y"
								/>
								<Textarea
									value={form.exclusion_criteria}
									onChange={(event) => updateForm("exclusion_criteria", event.target.value)}
									placeholder="Exclusion criteria, one per line"
									className="min-h-20 resize-y"
								/>

								{summary && (
									<div className="rounded-md border border-vscode-panel-border p-3 text-sm">
										<div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
											<span
												className={`rounded px-2 py-1 ${
													isRunning
														? "bg-vscode-progressBar-background text-vscode-editor-foreground"
														: selectedRetrieval?.run_status === "error" ||
															  selectedRetrieval?.run_status === "aborted"
															? "bg-vscode-inputValidation-errorBackground text-vscode-errorForeground"
															: "bg-vscode-badge-background text-vscode-badge-foreground"
												}`}>
												{runStatusLabel}
											</span>
											{(agentTask?.task_id || selectedRetrieval?.task_id) && (
												<span className="truncate text-muted-foreground">
													Task {agentTask?.task_id || selectedRetrieval?.task_id}
												</span>
											)}
											{agentTask?.status && (
												<span className="text-muted-foreground">Agent {agentTask.status}</span>
											)}
											{agentTask?.prompt_hash && (
												<span className="font-mono text-muted-foreground">
													Prompt {agentTask.prompt_hash.slice(0, 12)}
												</span>
											)}
											{selectedRetrieval?.last_agent_run_at && (
												<span className="text-muted-foreground">
													Started{" "}
													{new Date(selectedRetrieval.last_agent_run_at).toLocaleTimeString()}
												</span>
											)}
										</div>
										{agentTask?.prompt_summary && (
											<p className="mb-3 text-xs text-muted-foreground">
												{agentTask.prompt_summary}
											</p>
										)}
										<div className="grid grid-cols-3 gap-2 text-center">
											<div>
												<div className="font-semibold">{summary.total_found}</div>
												<div className="text-xs text-muted-foreground">Found</div>
											</div>
											<div>
												<div className="font-semibold">{summary.total_saved}</div>
												<div className="text-xs text-muted-foreground">Saved</div>
											</div>
											<div>
												<div className="font-semibold">{summary.duplicates_removed}</div>
												<div className="text-xs text-muted-foreground">Duplicates</div>
											</div>
										</div>
										{selectedRetrieval?.search_provenance?.summary && (
											<p className="mt-3 text-xs text-muted-foreground">
												{selectedRetrieval.search_provenance.summary}
											</p>
										)}
										{selectedErrors.length > 0 && (
											<div className="mt-3 space-y-1 text-xs text-vscode-errorForeground">
												{selectedErrors.map((error) => (
													<div key={error}>{error}</div>
												))}
											</div>
										)}
									</div>
								)}
							</section>

							<section className="min-h-0 space-y-3">
								<div className="flex items-center justify-between">
									<h4 className="text-sm font-semibold">Candidates</h4>
									<span className="text-xs text-muted-foreground">
										{selectedRetrieval?.candidates?.length ?? 0} papers
									</span>
								</div>

								<div className="space-y-3">
									{selectedRetrieval?.candidates?.map((candidate) => (
										<article
											key={candidate.candidate_no}
											className="rounded-md border border-vscode-panel-border p-3">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
														<span>{candidate.candidate_no}</span>
														<span>{candidate.source}</span>
														<span>{candidate.state}</span>
														{candidate.year && <span>{candidate.year}</span>}
													</div>
													<h5 className="mt-1 text-sm font-semibold leading-snug">
														{candidate.title}
													</h5>
													<p className="mt-1 text-xs text-muted-foreground">
														{candidate.authors?.slice(0, 6).join(", ")}
														{candidate.authors?.length > 6 ? " et al." : ""}
													</p>
												</div>
												<div className="flex shrink-0 gap-1">
													<Button
														variant="outline"
														size="icon"
														aria-label="Confirm candidate"
														onClick={() =>
															setCandidateState(candidate.candidate_no, "已确认")
														}>
														<Check className="w-4 h-4" />
													</Button>
													<Button
														variant="outline"
														size="icon"
														aria-label="Exclude candidate"
														onClick={() =>
															setCandidateState(candidate.candidate_no, "已排除")
														}>
														<CircleSlash className="w-4 h-4" />
													</Button>
												</div>
											</div>

											<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												{candidate.venue && <span>{candidate.venue}</span>}
												{candidate.doi && <span>DOI {candidate.doi}</span>}
												{candidate.pmid && <span>PMID {candidate.pmid}</span>}
												{candidate.arxiv_id && <span>arXiv {candidate.arxiv_id}</span>}
											</div>

											{candidate.relevance_reason && (
												<p className="mt-2 text-sm">{candidate.relevance_reason}</p>
											)}
											{candidate.abstract && (
												<p className="mt-2 line-clamp-4 text-xs text-muted-foreground">
													{candidate.abstract}
												</p>
											)}
										</article>
									))}

									{(!selectedRetrieval || selectedRetrieval.candidates.length === 0) && (
										<div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-vscode-panel-border p-6 text-center text-sm text-muted-foreground">
											No retrieval candidates yet
										</div>
									)}
								</div>
							</section>
						</div>
					</main>
				</div>
			</TabContent>
		</Tab>
	)
}

export default React.memo(ReadPaperView)
