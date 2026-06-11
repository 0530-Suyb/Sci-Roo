import React from "react"
import {
	ArrowLeft,
	BookOpenText,
	ChevronRight,
	FileSearch,
	Library,
	Map,
	Plus,
	RefreshCw,
	Settings2,
} from "lucide-react"

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
	StandardTooltip,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { CandidateReviewWorkbench } from "./CandidateReviewWorkbench"
import { LibraryDraftPanel } from "./LibraryDraftPanel"
import { MapDraftPanel } from "./MapDraftPanel"
import { PdfAnalysisLauncher } from "./PdfAnalysisLauncher"
import { RetrievalComposer } from "./RetrievalComposer"
import { RetrievalSessionDirectory } from "./RetrievalSessionDirectory"
import { RetrievalSummaryPanel } from "./RetrievalSummaryPanel"
import { WorkspaceDefaultsPanel } from "./WorkspaceDefaultsPanel"
import { useReadPaperAnalysisLauncher, type ReadPaperAnalysisChatOpener } from "./useReadPaperAnalysisLauncher"
import type { useReadPaperController } from "./useReadPaperController"
import type { ReadPaperModule } from "./types"

type ReadPaperWorkspaceShellProps = {
	onDone: () => void
	controller: ReturnType<typeof useReadPaperController>
	onOpenAnalysisChat?: ReadPaperAnalysisChatOpener
}

const MODULE_LABELS = {
	retrieval: "Retrieval",
	library: "Literature Library",
	map: "Literature Map",
	settings: "Settings",
} as const

const ReadPaperWorkspaceShell: React.FC<ReadPaperWorkspaceShellProps> = ({
	onDone,
	controller,
	onOpenAnalysisChat,
}) => {
	const { state, actions } = controller
	const {
		retrievals,
		selectedRetrieval,
		backendError,
		workspaceConfig,
		libraryEntries,
		libraryStats,
		form,
		workspaceForm,
		activeModule,
		directoryCollapsed,
		queryComposerOpen,
		advancedQueryOpen,
		summaryDetailsOpen,
		isRunning,
		pendingDeleteRetrievalNo,
		expandedCandidateAbstracts,
		archiveMenuCandidateNo,
		candidateFilter,
		hasRetrievalInput,
		canRun,
		candidateCounts,
		visibleCandidates,
		searchProvenanceRuns,
		selectedNotes,
		sourceNotes,
		runStatusLabel,
		defaultsSummary,
		plannerProfileOptions,
	} = state
	const {
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
		refreshCurrentModule,
	} = actions
	const activeModuleLabel = MODULE_LABELS[activeModule]
	const analysisLauncher = useReadPaperAnalysisLauncher({
		cwd: state.cwd,
		onOpenAnalysisChat,
	})

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
					aria-label={title}
					className={cn(
						"flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md border px-2 text-left text-sm transition-colors",
						"focus-visible:outline focus-visible:outline-vscode-focusBorder",
						isActive
							? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
							: "border-vscode-panel-border text-vscode-foreground hover:bg-vscode-list-hoverBackground",
					)}
					onClick={() => setActiveModule(module)}>
					<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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

	const renderRetrievalDirectory = () => (
		<>
			<RetrievalSessionDirectory
				retrievals={retrievals}
				selectedRetrievalNo={selectedRetrieval?.retrieval_no}
				selectedRetrieval={selectedRetrieval}
				directoryCollapsed={directoryCollapsed}
				onCreate={createNewRetrieval}
				onSelect={selectRetrieval}
				onRequestDelete={setPendingDeleteRetrievalNo}
				onCollapse={() => setDirectoryCollapsed(true)}
				onRefresh={refreshCurrentModule}
				onImport={importRetrieval}
			/>

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

	const renderModuleDirectory = () => renderRetrievalDirectory()

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

	const renderRetrievalWorkspace = () => (
		<section className="min-w-0 max-w-full overflow-hidden">
			{backendError && (
				<div className="mb-3 rounded-md border border-vscode-inputValidation-errorBorder bg-vscode-inputValidation-errorBackground p-3 text-xs text-vscode-errorForeground">
					{backendError}
				</div>
			)}

			<div className="flex min-w-0 flex-col gap-2">
				<RetrievalComposer
					form={form}
					workspaceConfig={workspaceConfig}
					selectedRetrieval={selectedRetrieval}
					workspaceProfileName={workspaceForm.planner_profile_name}
					hasRetrievalInput={hasRetrievalInput}
					canRun={canRun}
					isRunning={isRunning}
					queryComposerOpen={queryComposerOpen}
					advancedQueryOpen={advancedQueryOpen}
					runStatusLabel={runStatusLabel}
					onQueryComposerOpenChange={setQueryComposerOpen}
					onAdvancedQueryOpenChange={setAdvancedQueryOpen}
					onUpdateForm={updateForm}
					onToggleSource={toggleSource}
					onSetStrategy={setStrategy}
					onSave={saveRetrieval}
					onRun={runRetrieval}
					onImportRetrieval={() => selectedRetrieval && importRetrieval(selectedRetrieval.retrieval_no)}
					onArchiveRetrieval={archiveSelectedRetrieval}
					onRequestDeleteRetrieval={() =>
						selectedRetrieval && setPendingDeleteRetrievalNo(selectedRetrieval.retrieval_no)
					}
				/>

				<CandidateReviewWorkbench
					selectedRetrieval={selectedRetrieval}
					candidateFilter={candidateFilter}
					candidateCounts={candidateCounts}
					visibleCandidates={visibleCandidates}
					expandedCandidateAbstracts={expandedCandidateAbstracts}
					archiveMenuCandidateNo={archiveMenuCandidateNo}
					summaryPanel={
						<RetrievalSummaryPanel
							selectedRetrieval={selectedRetrieval}
							summaryDetailsOpen={summaryDetailsOpen}
							selectedNotes={selectedNotes}
							sourceNotes={sourceNotes}
							searchProvenanceRuns={searchProvenanceRuns}
							candidateCounts={candidateCounts}
							onSummaryDetailsOpenChange={setSummaryDetailsOpen}
						/>
					}
					onCandidateFilterChange={setCandidateFilter}
					onToggleCandidateAbstract={toggleCandidateAbstract}
					onOpenCandidateUrl={openCandidateUrl}
					onSetCandidateState={setCandidateState}
					onImportCandidate={importCandidate}
					onAnalyzeCandidatePdf={(pdfPath) => analysisLauncher.selectPdfs([pdfPath])}
					onArchiveMenuCandidateNoChange={setArchiveMenuCandidateNo}
					onCloseArchiveMenuOnBlur={closeArchiveMenuOnBlur}
				/>
			</div>
		</section>
	)

	const showDirectoryPane = activeModule === "retrieval"

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
						showDirectoryPane &&
							(directoryCollapsed
								? "grid-rows-[44px_minmax(0,1fr)] lg:grid-cols-[44px_minmax(0,1fr)] lg:grid-rows-1"
								: "lg:grid-cols-[clamp(220px,18vw,260px)_minmax(0,1fr)]"),
					)}>
					{showDirectoryPane && (
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
					)}

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
								<WorkspaceDefaultsPanel
									workspaceForm={workspaceForm}
									plannerProfileOptions={plannerProfileOptions}
									onApplyWorkspaceProfileSelection={applyWorkspaceProfileSelection}
									onUpdateWorkspaceForm={updateWorkspaceForm}
									onToggleWorkspaceSource={toggleWorkspaceSource}
									onSetWorkspaceStrategy={setWorkspaceStrategy}
									onSaveWorkspaceConfig={saveWorkspaceConfig}
									onResetWorkspaceConfig={resetWorkspaceConfig}
								/>
							</div>
						) : activeModule === "library" ? (
							<LibraryDraftPanel
								libraryEntries={libraryEntries}
								libraryStats={libraryStats}
								onRefresh={refreshCurrentModule}
								canAnalyzePdfs={Boolean(state.cwd)}
								onAnalyzePdfs={() => analysisLauncher.selectPdfs()}
							/>
						) : (
							<MapDraftPanel
								selectedRetrieval={selectedRetrieval}
								libraryEntries={libraryEntries}
								libraryStats={libraryStats}
								onRefresh={refreshCurrentModule}
							/>
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

			<PdfAnalysisLauncher
				open={analysisLauncher.isOpen}
				pdfPaths={analysisLauncher.pdfPaths}
				outputDir={analysisLauncher.outputDir}
				mode={analysisLauncher.mode}
				prompt={analysisLauncher.prompt}
				onOpenChange={(open) => !open && analysisLauncher.close()}
				onOutputDirChange={analysisLauncher.setOutputDir}
				onModeChange={analysisLauncher.setMode}
				onPromptChange={analysisLauncher.setPrompt}
				onOpenChat={analysisLauncher.openChat}
			/>
		</Tab>
	)
}

export default React.memo(ReadPaperWorkspaceShell)
