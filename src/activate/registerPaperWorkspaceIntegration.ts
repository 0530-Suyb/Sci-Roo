import * as vscode from "vscode"
import type { CommandId } from "@roo-code/types"

import { ClineProvider } from "../core/webview/ClineProvider"
import { buildPaperWorkspaceState } from "../services/paper/paperWorkspaceState"
import { runPaperWorkspaceCommand, type PaperWorkspaceCommandId } from "../services/paper/paperWorkspaceActions"
import { getCommand } from "../utils/commands"

type RegisterPaperWorkspaceIntegrationOptions = {
	context: vscode.ExtensionContext
	provider: ClineProvider
}

const WORKSPACE_COMMANDS: PaperWorkspaceCommandId[] = [
	"paperOpenManuscript",
	"paperBuildManuscript",
	"paperViewPdf",
	"paperOpenSourceControl",
]

export const registerPaperWorkspaceIntegration = ({ context, provider }: RegisterPaperWorkspaceIntegrationOptions) => {
	for (const commandId of WORKSPACE_COMMANDS) {
		context.subscriptions.push(
			vscode.commands.registerCommand(getCommand(commandId as CommandId), async () => {
				await runPaperWorkspaceCommand(provider, commandId)
			}),
		)
	}

	let refreshTimer: NodeJS.Timeout | undefined
	const scheduleEditorContextRefresh = () => {
		if (refreshTimer) {
			clearTimeout(refreshTimer)
		}
		refreshTimer = setTimeout(() => {
			void postPaperEditorContext(provider)
		}, 150)
	}

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(scheduleEditorContextRefresh),
		vscode.window.onDidChangeTextEditorSelection(scheduleEditorContextRefresh),
		vscode.workspace.onDidSaveTextDocument(scheduleEditorContextRefresh),
		{
			dispose: () => {
				if (refreshTimer) {
					clearTimeout(refreshTimer)
				}
			},
		},
	)
}

async function postPaperEditorContext(provider: ClineProvider): Promise<void> {
	const paperProjectManager = provider.getPaperProjectManager()
	const project = paperProjectManager?.getCurrentProject()
	if (!paperProjectManager || !project) {
		return
	}

	const referenceMgr = provider.getReferenceManager()
	const citationStatus = referenceMgr ? await referenceMgr.scanTexCitations() : { cited: [], missing: [] }
	const workspaceState = await buildPaperWorkspaceState(provider, project, {
		missingCitationKeys: citationStatus.missing,
		citedKeys: citationStatus.cited,
	})

	await provider.postMessageToWebview({
		type: "paperProjectState",
		paperProjectState: {
			workspaceState,
		},
	})
}
