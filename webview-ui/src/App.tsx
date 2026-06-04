import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ExtensionMessage, type RooCodeSettings, TelemetryEventName } from "@roo-code/types"

import TranslationProvider from "./i18n/TranslationContext"
import { MarketplaceViewStateManager } from "./components/marketplace/MarketplaceViewStateManager"

import { vscode } from "./utils/vscode"
import { telemetryClient } from "./utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "./utils/sourceMapInitializer"
import { ExtensionStateContextProvider, useExtensionState } from "@/context/ExtensionStateContext"
import ChatView, { ChatViewRef } from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeViewProvider"
import { MarketplaceView } from "./components/marketplace/MarketplaceView"
import { CheckpointRestoreDialog } from "./components/chat/CheckpointRestoreDialog"
import { DeleteMessageDialog, EditMessageDialog } from "./components/chat/MessageModificationConfirmationDialog"
import ErrorBoundary from "./components/ErrorBoundary"
import { CloudView } from "./components/cloud/CloudView"
import LiteratureView from "./components/literature/LiteratureView"
import ReadPaperView from "./components/read-paper/ReadPaperView"
import DataStudioView from "./components/data-studio/DataStudioView"
import ResearchPipelineView from "./components/research/ResearchPipelineView"
import PaperWritingView from "./components/paper/PaperWritingView"
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./components/ui/standard-tooltip"

type Tab =
	| "settings"
	| "history"
	| "chat"
	| "marketplace"
	| "cloud"
	| "literature"
	| "readPaper"
	| "dataStudio"
	| "researchPipeline"
	| "paperWriting"

type ProjectChatBindingKey = "problemFramingTaskId" | "paperDraftTaskId"

type AgentChatOpenOptions = {
	mode: string
	prompt: string
	workspacePath?: string
	autoRun?: boolean
	nonInteractive?: boolean
	autoApprovalConfiguration?: RooCodeSettings
}

interface PendingProjectChatBinding {
	bindingKey: ProjectChatBindingKey
	projectRoot: string
}

interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
	hasCheckpoint: boolean
}

interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	hasCheckpoint: boolean
	images?: string[]
}

// Memoize dialog components to prevent unnecessary re-renders
const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedCheckpointRestoreDialog = React.memo(CheckpointRestoreDialog)
const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, Tab>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	historyButtonClicked: "history",
	marketplaceButtonClicked: "marketplace",
	cloudButtonClicked: "cloud",
	literatureButtonClicked: "literature",
	readPaperButtonClicked: "readPaper",
	dataStudioButtonClicked: "dataStudio",
	researchPipelineButtonClicked: "researchPipeline",
	paperWritingButtonClicked: "paperWriting",
}

const App = () => {
	const {
		didHydrateState,
		showWelcome,
		shouldShowAnnouncement,
		telemetrySetting,
		telemetryKey,
		machineId,
		cloudUserInfo,
		cloudIsAuthenticated,
		cloudApiUrl,
		cloudOrganizations,
		renderContext,
		mdmCompliant,
		currentTaskId,
	} = useExtensionState()

	// Create a persistent state manager
	const marketplaceStateManager = useMemo(() => new MarketplaceViewStateManager(), [])

	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [tab, setTab] = useState<Tab>("researchPipeline")

	const [deleteMessageDialogState, setDeleteMessageDialogState] = useState<DeleteMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		hasCheckpoint: false,
	})

	const [editMessageDialogState, setEditMessageDialogState] = useState<EditMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		text: "",
		hasCheckpoint: false,
		images: [],
	})

	const settingsRef = useRef<SettingsViewRef>(null)
	const chatViewRef = useRef<ChatViewRef>(null)

	const switchTab = useCallback(
		(newTab: Tab) => {
			// Only check MDM compliance if mdmCompliant is explicitly false (meaning there's an MDM policy and user is non-compliant)
			// If mdmCompliant is undefined or true, allow tab switching
			if (mdmCompliant === false && newTab !== "cloud") {
				// Notify the user that authentication is required by their organization
				vscode.postMessage({ type: "showMdmAuthRequiredNotification" })
				return
			}

			setCurrentSection(undefined)
			setCurrentMarketplaceTab(undefined)

			if (settingsRef.current?.checkUnsaveChanges) {
				settingsRef.current.checkUnsaveChanges(() => setTab(newTab))
			} else {
				setTab(newTab)
			}
		},
		[mdmCompliant],
	)

	const [currentSection, setCurrentSection] = useState<string | undefined>(undefined)
	const [currentMarketplaceTab, setCurrentMarketplaceTab] = useState<string | undefined>(undefined)
	const [pendingProjectChatBinding, setPendingProjectChatBinding] = useState<PendingProjectChatBinding | null>(null)
	const previousCurrentTaskIdRef = useRef<string | undefined>(undefined)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "action" && message.action) {
				// Handle switchTab action with tab parameter
				if (message.action === "switchTab" && message.tab) {
					const targetTab = message.tab as Tab
					switchTab(targetTab)
					// Extract targetSection from values if provided
					const targetSection = message.values?.section as string | undefined
					setCurrentSection(targetSection)
					setCurrentMarketplaceTab(undefined)
				} else {
					// Handle other actions using the mapping
					const newTab = tabsByMessageAction[message.action]
					const section = message.values?.section as string | undefined
					const marketplaceTab = message.values?.marketplaceTab as string | undefined

					if (newTab) {
						switchTab(newTab)
						setCurrentSection(section)
						setCurrentMarketplaceTab(marketplaceTab)
					}
				}
			}

			if (message.type === "showDeleteMessageDialog" && message.messageTs) {
				setDeleteMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					hasCheckpoint: message.hasCheckpoint || false,
				})
			}

			if (message.type === "showEditMessageDialog" && message.messageTs && message.text) {
				setEditMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					text: message.text,
					hasCheckpoint: message.hasCheckpoint || false,
					images: message.images || [],
				})
			}

			if (message.type === "acceptInput") {
				chatViewRef.current?.acceptInput()
			}
		},
		[switchTab],
	)

	useEvent("message", onMessage)

	useEffect(() => {
		if (shouldShowAnnouncement && tab === "chat") {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement, tab])

	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
		}
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])

	useEffect(() => {
		const previousTaskId = previousCurrentTaskIdRef.current
		previousCurrentTaskIdRef.current = currentTaskId

		if (!pendingProjectChatBinding || !currentTaskId || currentTaskId === previousTaskId) {
			return
		}

		vscode.postMessage({
			type: "paperProjectCreate",
			action: "chatBindingUpdate",
			query: pendingProjectChatBinding.bindingKey,
			text: currentTaskId,
			values: { rootPath: pendingProjectChatBinding.projectRoot },
		} as any)
		setPendingProjectChatBinding(null)
	}, [currentTaskId, pendingProjectChatBinding])

	const openProjectBoundChat = useCallback(
		({
			bindingKey,
			projectRoot,
			mode,
			prompt,
			existingTaskId,
			forceNewTask,
		}: {
			bindingKey: ProjectChatBindingKey
			projectRoot: string
			mode: string
			prompt: string
			existingTaskId?: string
			forceNewTask?: boolean
		}) => {
			if (existingTaskId && !forceNewTask) {
				setPendingProjectChatBinding(null)
				switchTab("chat")
				vscode.postMessage({ type: "showTaskWithId", text: existingTaskId } as any)
				return
			}

			setPendingProjectChatBinding({ bindingKey, projectRoot })
			vscode.postMessage({ type: "clearTask" } as any)
			vscode.postMessage({ type: "mode", text: mode } as any)
			switchTab("chat")
			window.setTimeout(() => {
				vscode.postMessage({ type: "insertTextIntoTextarea", text: prompt } as any)
			}, 50)
		},
		[switchTab],
	)

	const openAgentChat = useCallback(
		({ mode, prompt, workspacePath, autoRun, nonInteractive, autoApprovalConfiguration }: AgentChatOpenOptions) => {
			setPendingProjectChatBinding(null)

			if (autoRun) {
				vscode.postMessage({
					type: "newTask",
					text: prompt,
					taskWorkspacePath: workspacePath,
					nonInteractive,
					taskConfiguration: { mode },
					taskAutoApprovalConfiguration: autoApprovalConfiguration,
				} as any)
				switchTab("chat")
				return
			}

			vscode.postMessage({ type: "clearTask" } as any)
			vscode.postMessage({ type: "mode", text: mode } as any)
			switchTab("chat")
			window.setTimeout(() => {
				vscode.postMessage({ type: "insertTextIntoTextarea", text: prompt } as any)
			}, 50)
		},
		[switchTab],
	)

	// Initialize source map support for better error reporting
	useEffect(() => {
		// Initialize source maps for better error reporting in production
		initializeSourceMaps()

		// Expose source map debugging utilities in production
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}

		// Log initialization for debugging
		console.debug("App initialized with source map support")
	}, [])

	// Focus the WebView when non-interactive content is clicked (only in editor/tab mode)
	useAddNonInteractiveClickListener(
		useCallback(() => {
			// Only send focus request if we're in editor (tab) mode, not sidebar
			if (renderContext === "editor") {
				vscode.postMessage({ type: "focusPanelRequest" })
			}
		}, [renderContext]),
	)
	// Track marketplace tab views
	useEffect(() => {
		if (tab === "marketplace") {
			telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
		}
	}, [tab])

	if (!didHydrateState) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-6">
				<div className="w-full max-w-xl rounded-3xl border border-vscode-panel-border bg-card/95 p-8 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
					<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sci-Roo</p>
					<h2 className="mt-3 text-2xl font-semibold">Loading workspace...</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Preparing the research pipeline, project context, and writing workspace.
					</p>
					<div className="mt-6 space-y-3">
						<div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
						<div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
						<div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
					</div>
				</div>
			</div>
		)
	}

	// Do not conditionally load ChatView, it's expensive and there's state we
	// don't want to lose (user input, disableInput, askResponse promise, etc.)
	return showWelcome ? (
		<WelcomeView />
	) : (
		<>
			{tab === "history" && <HistoryView onDone={() => switchTab("chat")} />}
			{tab === "settings" && (
				<SettingsView ref={settingsRef} onDone={() => setTab("chat")} targetSection={currentSection} />
			)}
			{tab === "marketplace" && (
				<MarketplaceView
					stateManager={marketplaceStateManager}
					onDone={() => switchTab("chat")}
					targetTab={currentMarketplaceTab as "mcp" | "mode" | undefined}
				/>
			)}
			{tab === "cloud" && (
				<CloudView
					userInfo={cloudUserInfo}
					isAuthenticated={cloudIsAuthenticated}
					cloudApiUrl={cloudApiUrl}
					organizations={cloudOrganizations}
				/>
			)}
			{tab === "literature" && <LiteratureView onDone={() => switchTab("researchPipeline")} />}
			{tab === "readPaper" && (
				<ReadPaperView onDone={() => switchTab("researchPipeline")} onOpenAnalysisChat={openAgentChat} />
			)}
			{tab === "dataStudio" && <DataStudioView onDone={() => switchTab("researchPipeline")} />}
			{tab === "researchPipeline" && <ResearchPipelineView onOpenBoundChat={openProjectBoundChat} />}
			{tab === "paperWriting" && (
				<PaperWritingView
					onDone={() => switchTab("researchPipeline")}
					onOpenResearchPipeline={() => switchTab("researchPipeline")}
					onOpenBoundChat={openProjectBoundChat}
				/>
			)}
			<ChatView
				ref={chatViewRef}
				isHidden={tab !== "chat"}
				showAnnouncement={showAnnouncement}
				hideAnnouncement={() => setShowAnnouncement(false)}
			/>
			{deleteMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={deleteMessageDialogState.isOpen}
					type="delete"
					hasCheckpoint={deleteMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
							restoreCheckpoint,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedDeleteMessageDialog
					open={deleteMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
			{editMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={editMessageDialogState.isOpen}
					type="edit"
					hasCheckpoint={editMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							restoreCheckpoint,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedEditMessageDialog
					open={editMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							images: editMessageDialogState.images,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
		</>
	)
}

const queryClient = new QueryClient()

const AppRuntimeProviders = () => {
	const { language } = useExtensionState()

	return (
		<TranslationProvider language={language}>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
					<App />
				</TooltipProvider>
			</QueryClientProvider>
		</TranslationProvider>
	)
}

const AppWithProviders = () => (
	<ErrorBoundary>
		<ExtensionStateContextProvider>
			<AppRuntimeProviders />
		</ExtensionStateContextProvider>
	</ErrorBoundary>
)

export default AppWithProviders
