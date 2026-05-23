import * as vscode from "vscode"
import type { CommandId } from "@roo-code/types"

import { getCommand } from "../utils/commands"
import { singleCompletionHandler } from "../utils/single-completion-handler"
import { ClineProvider } from "../core/webview/ClineProvider"

type PaperEditorActionId =
	| "paperRewriteSelection"
	| "paperRephraseSelection"
	| "paperMakeConciseSelection"
	| "paperMakeAcademicSelection"
	| "paperExpandAcademicParagraph"
	| "paperAddCitationPlaceholder"
	| "paperTranslateSelectionChinese"
	| "paperTranslateSelectionEnglish"

type RegisterPaperEditorActionsOptions = {
	context: vscode.ExtensionContext
	provider: ClineProvider
}

type PaperEditorActionConfig = {
	id: PaperEditorActionId
	label: string
	buildPrompt: (text: string) => string
}

const PAPER_EDITOR_ACTIONS: PaperEditorActionConfig[] = [
	{
		id: "paperRewriteSelection",
		label: "Rewrite Selection",
		buildPrompt: (text) =>
			`Rewrite the following academic text to improve clarity, flow, and argumentative force while preserving the original meaning, citations, and LaTeX syntax. Return only the revised text.\n\n${text}`,
	},
	{
		id: "paperRephraseSelection",
		label: "Rephrase Selection",
		buildPrompt: (text) =>
			`Rephrase the following academic text using different wording and sentence structure while preserving the exact meaning, citations, and LaTeX syntax. Return only the rephrased text.\n\n${text}`,
	},
	{
		id: "paperMakeConciseSelection",
		label: "Make Selection Concise",
		buildPrompt: (text) =>
			`Revise the following academic text to be more concise and less repetitive while preserving meaning, citations, and LaTeX syntax. Return only the revised text.\n\n${text}`,
	},
	{
		id: "paperMakeAcademicSelection",
		label: "Make Selection More Academic",
		buildPrompt: (text) =>
			`Revise the following text so it reads more like polished academic writing: precise, formal, and rigorous, while preserving meaning, citations, and LaTeX syntax. Return only the revised text.\n\n${text}`,
	},
	{
		id: "paperExpandAcademicParagraph",
		label: "Expand Into Academic Paragraph",
		buildPrompt: (text) =>
			`Expand the following research note or short passage into one polished academic paragraph. Preserve the core claim, do not invent facts or citations, keep any existing LaTeX syntax intact, and use [CITATION NEEDED] if evidential support should be added. Return only the expanded paragraph.\n\n${text}`,
	},
	{
		id: "paperAddCitationPlaceholder",
		label: "Add Citation Placeholder",
		buildPrompt: (text) =>
			`Revise the following academic text by inserting appropriate citation placeholders where evidential support or prior work should likely be cited. Use the exact placeholder [CITATION NEEDED] and preserve all existing LaTeX syntax and citations. Return only the revised text.\n\n${text}`,
	},
	{
		id: "paperTranslateSelectionChinese",
		label: "Translate Selection to Chinese",
		buildPrompt: (text) =>
			`Translate the following academic text into Chinese. Preserve citations, figure/table references, equations, and LaTeX syntax. Return only the translated text.\n\n${text}`,
	},
	{
		id: "paperTranslateSelectionEnglish",
		label: "Translate Selection to English",
		buildPrompt: (text) =>
			`Translate the following academic text into English. Preserve citations, figure/table references, equations, and LaTeX syntax. Return only the translated text.\n\n${text}`,
	},
]

export const registerPaperEditorActions = ({ context, provider }: RegisterPaperEditorActionsOptions) => {
	for (const action of PAPER_EDITOR_ACTIONS) {
		context.subscriptions.push(
			vscode.commands.registerCommand(getCommand(action.id as CommandId), async () => {
				await runPaperEditorAction(provider, action)
			}),
		)
	}
}

async function runPaperEditorAction(provider: ClineProvider, action: PaperEditorActionConfig) {
	const editor = vscode.window.activeTextEditor
	if (!editor) {
		vscode.window.showWarningMessage("No active editor found.")
		return
	}

	const selection = editor.selection
	if (selection.isEmpty) {
		vscode.window.showWarningMessage("Select a passage in the editor before using Sci-Roo writing actions.")
		return
	}

	const selectedText = editor.document.getText(selection).trim()
	if (!selectedText) {
		vscode.window.showWarningMessage("The selected text is empty.")
		return
	}

	if (!isSupportedPaperEditor(editor.document)) {
		vscode.window.showWarningMessage(
			"Sci-Roo paper writing actions are intended for LaTeX or Markdown manuscript files.",
		)
		return
	}

	const prompt = action.buildPrompt(selectedText)
	const { apiConfiguration } = await provider.getState()

	let revisedText = ""
	try {
		revisedText = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Sci-Roo: ${action.label}`,
				cancellable: false,
			},
			async () => singleCompletionHandler(apiConfiguration, prompt),
		)
	} catch (error) {
		vscode.window.showErrorMessage(
			`Sci-Roo failed to process the selected text: ${error instanceof Error ? error.message : String(error)}`,
		)
		return
	}

	if (!revisedText?.trim()) {
		vscode.window.showWarningMessage("Sci-Roo returned an empty result for the selected text.")
		return
	}

	const choice = await vscode.window.showInformationMessage(
		"Sci-Roo generated a revised version of the selected text.",
		{ modal: true, detail: "Choose how you want to use the generated text." },
		"Replace Selection",
		"Insert Below",
		"Open Preview",
		"Copy",
	)

	switch (choice) {
		case "Replace Selection":
			await replaceSelection(editor, selection, revisedText)
			return
		case "Insert Below":
			await insertBelow(editor, selection, revisedText)
			return
		case "Open Preview":
			await openPreview(editor.document.languageId, revisedText)
			return
		case "Copy":
			await vscode.env.clipboard.writeText(revisedText)
			vscode.window.showInformationMessage("Sci-Roo copied the generated text to the clipboard.")
			return
		default:
			return
	}
}

async function replaceSelection(editor: vscode.TextEditor, selection: vscode.Selection, revisedText: string) {
	await editor.edit((editBuilder) => {
		editBuilder.replace(selection, revisedText)
	})
}

async function insertBelow(editor: vscode.TextEditor, selection: vscode.Selection, revisedText: string) {
	const line = editor.document.lineAt(selection.end.line)
	const insertPosition = new vscode.Position(selection.end.line, line.range.end.character)
	const insertion = `\n\n${revisedText}`
	await editor.edit((editBuilder) => {
		editBuilder.insert(insertPosition, insertion)
	})
}

async function openPreview(languageId: string, revisedText: string) {
	const document = await vscode.workspace.openTextDocument({
		content: revisedText,
		language: languageId || "plaintext",
	})
	await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false })
}

function isSupportedPaperEditor(document: vscode.TextDocument): boolean {
	if (["latex", "markdown"].includes(document.languageId)) {
		return true
	}
	const lowerPath = document.uri.fsPath.toLowerCase()
	return lowerPath.endsWith(".tex") || lowerPath.endsWith(".md")
}
