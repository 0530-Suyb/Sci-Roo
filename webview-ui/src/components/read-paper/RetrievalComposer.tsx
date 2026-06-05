import { useId } from "react"
import { Archive, ChevronDown, Library, Play, RefreshCw, Save, Trash2 } from "lucide-react"
import { DEFAULT_RETRIEVAL_SOURCES, RETRIEVAL_SOURCE_OPTIONS, type ReadPaperWorkspaceConfig } from "@roo-code/types"

import {
	Button,
	Checkbox,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Input,
	StandardTooltip,
	Textarea,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import type { FormState, Retrieval, Source, Strategy } from "./types"

export type RetrievalComposerProps = {
	form: FormState
	workspaceConfig: ReadPaperWorkspaceConfig
	selectedRetrieval?: Retrieval
	workspaceProfileName: string
	hasRetrievalInput: boolean
	canRun: boolean
	isRunning: boolean
	queryComposerOpen: boolean
	advancedQueryOpen: boolean
	runStatusLabel: string
	onQueryComposerOpenChange: (open: boolean) => void
	onAdvancedQueryOpenChange: (open: boolean) => void
	onUpdateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void
	onToggleSource: (source: Source, checked: boolean) => void
	onSetStrategy: (strategy: Strategy) => void
	onSave: () => void
	onRun: () => void
	onImportRetrieval: () => void
	onArchiveRetrieval: () => void
	onRequestDeleteRetrieval: () => void
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

export function RetrievalComposer({
	form,
	workspaceConfig,
	selectedRetrieval,
	workspaceProfileName,
	hasRetrievalInput,
	canRun,
	isRunning,
	queryComposerOpen,
	advancedQueryOpen,
	runStatusLabel,
	onQueryComposerOpenChange,
	onAdvancedQueryOpenChange,
	onUpdateForm,
	onToggleSource,
	onSetStrategy,
	onSave,
	onRun,
	onImportRetrieval,
	onArchiveRetrieval,
	onRequestDeleteRetrieval,
}: RetrievalComposerProps) {
	const formId = useId()
	const requestId = `${formId}-request`
	const titleId = `${formId}-title`
	const strategyLabelId = `${formId}-strategy-label`
	const queryId = `${formId}-query`
	const keywordsId = `${formId}-keywords`
	const maxResultsId = `${formId}-max-results`
	const yearFromId = `${formId}-year-from`
	const yearToId = `${formId}-year-to`
	const activeSources = selectedRetrieval?.search_sources?.length
		? selectedRetrieval.search_sources
		: workspaceConfig.default_sources
	const requestSummary = form.Q.trim() || selectedRetrieval?.Q?.trim() || "No request written yet"
	const settingsSummary = `${
		form.retrieval_strategy === "scholarly_plus_web_discovery" ? "APIs + discovery" : "Scholarly APIs"
	} · ${form.max_results} results · ${form.year_from || "any"}-${form.year_to || "now"} · ${
		form.search_sources.length
	} sources`

	return (
		<Collapsible open={queryComposerOpen} onOpenChange={onQueryComposerOpenChange}>
			<div className="rounded-md border border-vscode-panel-border bg-vscode-editor-background">
				<div className="flex min-w-0 flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-vscode-focusBorder"
							aria-label="Toggle query composer">
							<ChevronDown
								className={cn(
									"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
									queryComposerOpen ? "rotate-180" : "",
								)}
								aria-hidden="true"
							/>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
									<span className="font-semibold text-vscode-editor-foreground">Query</span>
									<span className="text-muted-foreground">{runStatusLabel}</span>
									<span className="text-muted-foreground">{settingsSummary}</span>
								</div>
								<div className="mt-0.5 truncate text-sm text-vscode-editor-foreground">
									{requestSummary}
								</div>
							</div>
						</button>
					</CollapsibleTrigger>

					<div className="flex shrink-0 items-center gap-1.5">
						<Button variant="primary" size="sm" disabled={!canRun || isRunning} onClick={onRun}>
							{isRunning ? (
								<RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
							) : (
								<Play className="h-4 w-4" aria-hidden="true" />
							)}
							<span>{isRunning ? "Running…" : "Run"}</span>
						</Button>
					</div>
				</div>

				<CollapsibleContent className="space-y-3 border-t border-vscode-panel-border p-3">
					<div className="space-y-1">
						<label htmlFor={requestId} className="text-xs font-medium text-muted-foreground">
							Natural-language request
						</label>
						<Textarea
							id={requestId}
							value={form.Q}
							onChange={(event) => onUpdateForm("Q", event.target.value)}
							placeholder="Describe the literature request in plain language"
							className="min-h-24 resize-y"
						/>
					</div>

					<Collapsible open={advancedQueryOpen} onOpenChange={onAdvancedQueryOpenChange}>
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
											{settingsSummary}
										</span>
									</span>
									<ChevronDown
										className={cn(
											"h-4 w-4 shrink-0 transition-transform",
											advancedQueryOpen ? "rotate-180" : "",
										)}
										aria-hidden="true"
									/>
								</button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-3 border-t border-vscode-panel-border p-3">
								<div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
									<div className="space-y-1">
										<label htmlFor={titleId} className="text-xs font-medium text-muted-foreground">
											Title
										</label>
										<Input
											id={titleId}
											value={form.title}
											onChange={(event) => onUpdateForm("title", event.target.value)}
											placeholder="Auto-generated title"
											className="text-xs"
										/>
									</div>
									<div className="space-y-1">
										<div id={strategyLabelId} className="text-xs font-medium text-muted-foreground">
											Strategy
										</div>
										<div
											role="group"
											aria-labelledby={strategyLabelId}
											className="grid min-w-0 grid-cols-2 gap-1">
											<StandardTooltip content="Use structured scholarly APIs as the only metadata source">
												<Button
													variant={
														form.retrieval_strategy === "scholarly_only"
															? "primary"
															: "outline"
													}
													size="sm"
													className="h-8 whitespace-nowrap text-xs"
													onClick={() => onSetStrategy("scholarly_only")}>
													Scholarly APIs
												</Button>
											</StandardTooltip>
											<StandardTooltip content="Use web discovery only as a recall layer, then verify with scholarly APIs">
												<Button
													variant={
														form.retrieval_strategy === "scholarly_plus_web_discovery"
															? "primary"
															: "outline"
													}
													size="sm"
													className="h-8 whitespace-nowrap text-xs"
													onClick={() => onSetStrategy("scholarly_plus_web_discovery")}>
													APIs + discovery
												</Button>
											</StandardTooltip>
										</div>
									</div>
								</div>

								<div className="space-y-1">
									<label htmlFor={queryId} className="text-xs font-medium text-muted-foreground">
										Executable academic database query
									</label>
									<Textarea
										id={queryId}
										value={form.query}
										onChange={(event) => onUpdateForm("query", event.target.value)}
										placeholder="Auto-generated from the request; edit only when needed"
										className="min-h-20 resize-y whitespace-pre-wrap break-words"
									/>
								</div>

								<div className="space-y-1">
									<label htmlFor={keywordsId} className="text-xs font-medium text-muted-foreground">
										Keywords
									</label>
									<Input
										id={keywordsId}
										value={form.search_keywords}
										onChange={(event) => onUpdateForm("search_keywords", event.target.value)}
										placeholder="Auto-generated keywords, comma separated"
									/>
								</div>

								<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
									<div className="space-y-1">
										<label
											htmlFor={maxResultsId}
											className="text-xs font-medium text-muted-foreground">
											Max results
										</label>
										<Input
											id={maxResultsId}
											type="number"
											min={1}
											max={200}
											value={form.max_results}
											onChange={(event) =>
												onUpdateForm("max_results", Number(event.target.value) || 20)
											}
											placeholder="Max"
										/>
									</div>
									<div className="space-y-1">
										<label
											htmlFor={yearFromId}
											className="text-xs font-medium text-muted-foreground">
											Year from
										</label>
										<Input
											id={yearFromId}
											value={form.year_from}
											onChange={(event) => onUpdateForm("year_from", event.target.value)}
											placeholder="From"
										/>
									</div>
									<div className="space-y-1">
										<label htmlFor={yearToId} className="text-xs font-medium text-muted-foreground">
											Year to
										</label>
										<Input
											id={yearToId}
											value={form.year_to}
											onChange={(event) => onUpdateForm("year_to", event.target.value)}
											placeholder="To"
										/>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-4 text-sm">
									{RETRIEVAL_SOURCE_OPTIONS.map((sourceOption) => (
										<StandardTooltip key={sourceOption.value} content={sourceOption.description}>
											<label className="flex items-center gap-2">
												<Checkbox
													checked={form.search_sources.includes(sourceOption.value)}
													onCheckedChange={(checked) =>
														onToggleSource(sourceOption.value, Boolean(checked))
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
						<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
										{selectedRetrieval?.retrieval_strategy === "scholarly_plus_web_discovery"
											? "APIs + discovery"
											: "Scholarly APIs"}
									</span>
									<span>
										Profile{" "}
										{selectedRetrieval?.planner_profile_name || workspaceProfileName || "Default"}
									</span>
									<StandardTooltip content={formatSourceList(activeSources)}>
										<span className="max-w-full truncate">
											{formatSourceSummary(activeSources)}
										</span>
									</StandardTooltip>
								</div>
							</div>
							<div className="flex shrink-0 flex-wrap items-center gap-1.5">
								<StandardTooltip content="Save the current query fields to this retrieval">
									<Button variant="outline" size="sm" disabled={!hasRetrievalInput} onClick={onSave}>
										<Save className="h-3.5 w-3.5" aria-hidden="true" />
										<span>Save draft</span>
									</Button>
								</StandardTooltip>
								<StandardTooltip content="Import all importable candidates from this retrieval">
									<Button
										variant="outline"
										size="sm"
										disabled={!selectedRetrieval}
										onClick={onImportRetrieval}>
										<Library className="h-3.5 w-3.5" aria-hidden="true" />
										<span>Import retrieval</span>
									</Button>
								</StandardTooltip>
								<StandardTooltip content="Archive this retrieval session">
									<Button
										variant="outline"
										size="sm"
										disabled={!selectedRetrieval}
										onClick={onArchiveRetrieval}>
										<Archive className="h-3.5 w-3.5" aria-hidden="true" />
										<span>Archive</span>
									</Button>
								</StandardTooltip>
								<StandardTooltip content="Delete this retrieval session">
									<Button
										variant="outline"
										size="sm"
										disabled={!selectedRetrieval}
										className="text-vscode-errorForeground hover:text-vscode-errorForeground"
										onClick={onRequestDeleteRetrieval}>
										<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
										<span>Delete</span>
									</Button>
								</StandardTooltip>
							</div>
						</div>
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	)
}
