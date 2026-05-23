import * as path from "path"
import * as vscode from "vscode"

import type { ClineProvider } from "../../core/webview/ClineProvider"
import { getCommand } from "../../utils/commands"
import type { CommandId } from "@roo-code/types"

export type PaperWorkspaceCommandId =
	| "paperOpenManuscript"
	| "paperBuildManuscript"
	| "paperViewPdf"
	| "paperOpenSourceControl"
	| "paperRewriteSelection"
	| "paperRephraseSelection"
	| "paperMakeConciseSelection"
	| "paperMakeAcademicSelection"
	| "paperExpandAcademicParagraph"
	| "paperAddCitationPlaceholder"
	| "paperTranslateSelectionChinese"
	| "paperTranslateSelectionEnglish"

export async function runPaperWorkspaceCommand(
	provider: ClineProvider,
	commandId: PaperWorkspaceCommandId,
): Promise<void> {
	const paperProjectManager = provider.getPaperProjectManager()
	const project = paperProjectManager?.getCurrentProject()

	if (!paperProjectManager || !project) {
		vscode.window.showInformationMessage("Open a Sci-Roo paper project first.")
		return
	}

	switch (commandId) {
		case "paperOpenManuscript": {
			const manuscriptPath = paperProjectManager.getPrimaryManuscriptAbsolutePath(project)
			if (!manuscriptPath) {
				vscode.window.showWarningMessage("Main manuscript path is not configured for this project.")
				return
			}
			const document = await vscode.workspace.openTextDocument(manuscriptPath)
			await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false })
			return
		}
		case "paperBuildManuscript": {
			await ensurePaperEditorOpen(provider)
			try {
				await vscode.commands.executeCommand("latex-workshop.build")
			} catch {
				vscode.window.showWarningMessage(
					"Could not start LaTeX Workshop build. Make sure the LaTeX Workshop extension is installed and enabled.",
				)
			}
			return
		}
		case "paperViewPdf": {
			await ensurePaperEditorOpen(provider)
			try {
				await vscode.commands.executeCommand("latex-workshop.view")
				return
			} catch {
				const pdfPath = path.join(project.rootPath, "latex", "paper.pdf")
				try {
					const document = await vscode.workspace.openTextDocument(pdfPath)
					await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false })
					return
				} catch {
					vscode.window.showWarningMessage(
						"Could not open the manuscript PDF. Build with LaTeX Workshop first, then try again.",
					)
				}
			}
			return
		}
		case "paperOpenSourceControl": {
			await vscode.commands.executeCommand("workbench.view.scm")
			return
		}
		case "paperRewriteSelection":
		case "paperRephraseSelection":
		case "paperMakeConciseSelection":
		case "paperMakeAcademicSelection":
		case "paperExpandAcademicParagraph":
		case "paperAddCitationPlaceholder":
		case "paperTranslateSelectionChinese":
		case "paperTranslateSelectionEnglish": {
			await ensurePaperEditorOpen(provider)
			await vscode.commands.executeCommand(getCommand(commandId as CommandId))
			return
		}
	}
}

async function ensurePaperEditorOpen(provider: ClineProvider): Promise<void> {
	const paperProjectManager = provider.getPaperProjectManager()
	const project = paperProjectManager?.getCurrentProject()
	if (!paperProjectManager || !project) {
		return
	}

	const manuscriptPath = paperProjectManager.getPrimaryManuscriptAbsolutePath(project)
	if (!manuscriptPath) {
		return
	}

	const activePath = vscode.window.activeTextEditor?.document.uri.fsPath
	if (activePath && path.normalize(activePath) === path.normalize(manuscriptPath)) {
		return
	}

	const document = await vscode.workspace.openTextDocument(manuscriptPath)
	await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false })
}
