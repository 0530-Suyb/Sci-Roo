import * as vscode from "vscode"

import { CodeActionName, CodeActionId, CommandId } from "@roo-code/types"
import { Package } from "../shared/package"

import { getCodeActionCommand, getCommand } from "../utils/commands"
import { EditorUtils } from "../integrations/editor/EditorUtils"

export const TITLES: Record<CodeActionName, string> = {
	EXPLAIN: "Explain with Roo Code",
	FIX: "Fix with Roo Code",
	IMPROVE: "Improve with Roo Code",
	ADD_TO_CONTEXT: "Add to Roo Code",
	NEW_TASK: "New Roo Code Task",
} as const

const PAPER_WRITING_TITLE = "Writing..."

export class CodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix,
		vscode.CodeActionKind.RefactorRewrite,
	]

	private createAction(
		title: string,
		kind: vscode.CodeActionKind,
		command: CodeActionId,
		args: any[],
	): vscode.CodeAction {
		const action = new vscode.CodeAction(title, kind)
		action.command = { command: getCodeActionCommand(command), title, arguments: args }
		return action
	}

	private createCommandAction(
		title: string,
		kind: vscode.CodeActionKind,
		command: CommandId,
		args: any[] = [],
	): vscode.CodeAction {
		const action = new vscode.CodeAction(title, kind)
		action.command = { command: getCommand(command), title, arguments: args }
		return action
	}

	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
	): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		try {
			if (!vscode.workspace.getConfiguration(Package.name).get<boolean>("enableCodeActions", true)) {
				return []
			}

			const effectiveRange = EditorUtils.getEffectiveRange(document, range)

			if (!effectiveRange) {
				return []
			}

			const filePath = EditorUtils.getFilePath(document)
			const actions: vscode.CodeAction[] = []

			actions.push(
				this.createAction(TITLES.ADD_TO_CONTEXT, vscode.CodeActionKind.QuickFix, "addToContext", [
					filePath,
					effectiveRange.text,
					effectiveRange.range.start.line + 1,
					effectiveRange.range.end.line + 1,
				]),
			)

			if (this.isSupportedPaperDocument(document) && effectiveRange.text.trim().length > 0) {
				actions.push(
					this.createCommandAction(
						PAPER_WRITING_TITLE,
						vscode.CodeActionKind.RefactorRewrite,
						"paperWritingQuickActions",
					),
				)
			}

			if (context.diagnostics.length > 0) {
				const relevantDiagnostics = context.diagnostics.filter((d) =>
					EditorUtils.hasIntersectingRange(effectiveRange.range, d.range),
				)

				if (relevantDiagnostics.length > 0) {
					actions.push(
						this.createAction(TITLES.FIX, vscode.CodeActionKind.QuickFix, "fixCode", [
							filePath,
							effectiveRange.text,
							effectiveRange.range.start.line + 1,
							effectiveRange.range.end.line + 1,
							relevantDiagnostics.map(EditorUtils.createDiagnosticData),
						]),
					)
				}
			} else {
				actions.push(
					this.createAction(TITLES.EXPLAIN, vscode.CodeActionKind.QuickFix, "explainCode", [
						filePath,
						effectiveRange.text,
						effectiveRange.range.start.line + 1,
						effectiveRange.range.end.line + 1,
					]),
				)

				actions.push(
					this.createAction(TITLES.IMPROVE, vscode.CodeActionKind.QuickFix, "improveCode", [
						filePath,
						effectiveRange.text,
						effectiveRange.range.start.line + 1,
						effectiveRange.range.end.line + 1,
					]),
				)
			}

			return actions
		} catch (error) {
			console.error("Error providing code actions:", error)
			return []
		}
	}

	private isSupportedPaperDocument(document: vscode.TextDocument): boolean {
		if (["latex", "markdown"].includes(document.languageId)) {
			return true
		}
		const lowerPath = document.uri.fsPath.toLowerCase()
		return lowerPath.endsWith(".tex") || lowerPath.endsWith(".md")
	}
}
