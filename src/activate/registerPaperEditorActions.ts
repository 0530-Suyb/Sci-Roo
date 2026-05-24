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

type PendingPaperSuggestion = {
	actionLabel: string
	languageId: string
	originalText: string
	range: vscode.Range
	revisedText: string
	uri: vscode.Uri
}

const ACCEPT_SUGGESTION_COMMAND = "sciRoo.paper.acceptInlineSuggestion"
const REJECT_SUGGESTION_COMMAND = "sciRoo.paper.rejectInlineSuggestion"
const PREVIEW_SUGGESTION_COMMAND = "sciRoo.paper.previewInlineSuggestion"
const COPY_SUGGESTION_COMMAND = "sciRoo.paper.copyInlineSuggestion"
const SHOW_SUGGESTION_INFO_COMMAND = "sciRoo.paper.showInlineSuggestionInfo"

class PaperInlineSuggestionController implements vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<void>()
	private readonly highlightDecorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: new vscode.ThemeColor("editor.selectionHighlightBackground"),
		border: "1px solid",
		borderColor: new vscode.ThemeColor("editorInfo.border"),
		borderRadius: "4px",
	})
	private pendingSuggestion: PendingPaperSuggestion | null = null
	private applyingSuggestion = false
	private readonly disposables: vscode.Disposable[] = []

	constructor() {
		this.disposables.push(
			vscode.languages.registerCodeLensProvider([{ language: "latex" }, { language: "markdown" }], {
				onDidChangeCodeLenses: this.changeEmitter.event,
				provideCodeLenses: (document) => this.provideCodeLenses(document),
			}),
		)

		this.disposables.push(
			vscode.commands.registerCommand(ACCEPT_SUGGESTION_COMMAND, async () => this.acceptSuggestion()),
			vscode.commands.registerCommand(REJECT_SUGGESTION_COMMAND, async () => this.rejectSuggestion()),
			vscode.commands.registerCommand(PREVIEW_SUGGESTION_COMMAND, async () => this.previewSuggestion()),
			vscode.commands.registerCommand(COPY_SUGGESTION_COMMAND, async () => this.copySuggestion()),
			vscode.commands.registerCommand(SHOW_SUGGESTION_INFO_COMMAND, async () => this.showSuggestionInfo()),
			vscode.workspace.onDidChangeTextDocument((event) => this.handleDocumentChange(event)),
			vscode.window.onDidChangeVisibleTextEditors(() => this.refreshDecorations()),
			vscode.window.onDidChangeActiveTextEditor(() => this.refreshDecorations()),
		)
	}

	dispose() {
		this.clearSuggestion(false)
		this.changeEmitter.dispose()
		this.highlightDecorationType.dispose()
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
	}

	showSuggestion(editor: vscode.TextEditor, actionLabel: string, originalText: string, revisedText: string) {
		this.pendingSuggestion = {
			actionLabel,
			languageId: editor.document.languageId,
			originalText,
			range: new vscode.Range(editor.selection.start, editor.selection.end),
			revisedText,
			uri: editor.document.uri,
		}
		this.refresh()
		void vscode.window.showInformationMessage(
			`Sci-Roo prepared an inline ${actionLabel.toLowerCase()} suggestion. Use Accept or Reject above the selection.`,
		)
	}

	private provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (!this.pendingSuggestion || document.uri.toString() !== this.pendingSuggestion.uri.toString()) {
			return []
		}

		const actionRange = new vscode.Range(this.pendingSuggestion.range.start, this.pendingSuggestion.range.start)
		const previewLine = Math.min(this.pendingSuggestion.range.end.line + 1, Math.max(document.lineCount - 1, 0))
		const previewRange = new vscode.Range(previewLine, 0, previewLine, 0)
		const preview = this.pendingSuggestion.revisedText.replace(/\s+/g, " ").trim()
		const truncatedPreview = preview.length > 120 ? `${preview.slice(0, 117)}...` : preview

		return [
			new vscode.CodeLens(actionRange, {
				command: ACCEPT_SUGGESTION_COMMAND,
				title: "$(check) Accept",
			}),
			new vscode.CodeLens(actionRange, {
				command: REJECT_SUGGESTION_COMMAND,
				title: "$(close) Reject",
			}),
			new vscode.CodeLens(actionRange, {
				command: PREVIEW_SUGGESTION_COMMAND,
				title: "$(open-preview) Preview",
			}),
			new vscode.CodeLens(actionRange, {
				command: COPY_SUGGESTION_COMMAND,
				title: "$(copy) Copy",
			}),
			new vscode.CodeLens(previewRange, {
				command: SHOW_SUGGESTION_INFO_COMMAND,
				title: `$(sparkle) Suggested: ${truncatedPreview}`,
				tooltip: `Sci-Roo suggestion (${this.pendingSuggestion.actionLabel})\n\n${this.pendingSuggestion.revisedText}`,
			}),
		]
	}

	private async acceptSuggestion() {
		const editor = await this.resolveEditor()
		if (!editor || !this.pendingSuggestion) {
			return
		}

		const suggestion = this.pendingSuggestion
		this.applyingSuggestion = true
		try {
			await editor.edit((editBuilder) => {
				editBuilder.replace(suggestion.range, suggestion.revisedText)
			})
			const end = suggestion.range.start.translate(0, suggestion.revisedText.length)
			editor.selection = new vscode.Selection(suggestion.range.start, end)
		} finally {
			this.applyingSuggestion = false
			this.clearSuggestion()
		}
	}

	private async rejectSuggestion() {
		this.clearSuggestion()
		await vscode.window.showInformationMessage("Sci-Roo discarded the inline suggestion.")
	}

	private async previewSuggestion() {
		if (!this.pendingSuggestion) {
			return
		}
		await openPreview(this.pendingSuggestion.languageId, this.pendingSuggestion.revisedText)
	}

	private async copySuggestion() {
		if (!this.pendingSuggestion) {
			return
		}
		await vscode.env.clipboard.writeText(this.pendingSuggestion.revisedText)
		await vscode.window.showInformationMessage("Sci-Roo copied the inline suggestion to the clipboard.")
	}

	private async showSuggestionInfo() {
		if (!this.pendingSuggestion) {
			return
		}
		await vscode.window
			.showInformationMessage(
				`Sci-Roo suggestion (${this.pendingSuggestion.actionLabel})`,
				{ modal: true, detail: this.pendingSuggestion.revisedText },
				"Preview",
				"Copy",
			)
			.then(async (choice) => {
				if (choice === "Preview") {
					await this.previewSuggestion()
				}
				if (choice === "Copy") {
					await this.copySuggestion()
				}
			})
	}

	private async resolveEditor(): Promise<vscode.TextEditor | undefined> {
		if (!this.pendingSuggestion) {
			return undefined
		}
		const openEditor = vscode.window.visibleTextEditors.find(
			(editor) => editor.document.uri.toString() === this.pendingSuggestion?.uri.toString(),
		)
		if (openEditor) {
			return openEditor
		}
		const document = await vscode.workspace.openTextDocument(this.pendingSuggestion.uri)
		return vscode.window.showTextDocument(document, { preview: false, preserveFocus: false })
	}

	private handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
		if (!this.pendingSuggestion || this.applyingSuggestion) {
			return
		}
		if (event.document.uri.toString() !== this.pendingSuggestion.uri.toString()) {
			return
		}
		this.clearSuggestion()
	}

	private clearSuggestion(emit: boolean = true) {
		this.pendingSuggestion = null
		this.refreshDecorations()
		if (emit) {
			this.changeEmitter.fire()
		}
	}

	private refresh() {
		this.refreshDecorations()
		this.changeEmitter.fire()
	}

	private refreshDecorations() {
		for (const editor of vscode.window.visibleTextEditors) {
			if (!this.pendingSuggestion || editor.document.uri.toString() !== this.pendingSuggestion.uri.toString()) {
				editor.setDecorations(this.highlightDecorationType, [])
				continue
			}
			editor.setDecorations(this.highlightDecorationType, [this.pendingSuggestion.range])
		}
	}
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
	const suggestionController = new PaperInlineSuggestionController()
	context.subscriptions.push(suggestionController)

	for (const action of PAPER_EDITOR_ACTIONS) {
		context.subscriptions.push(
			vscode.commands.registerCommand(getCommand(action.id as CommandId), async () => {
				await runPaperEditorAction(provider, suggestionController, action)
			}),
		)
	}
}

async function runPaperEditorAction(
	provider: ClineProvider,
	suggestionController: PaperInlineSuggestionController,
	action: PaperEditorActionConfig,
) {
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

	suggestionController.showSuggestion(editor, action.label, selectedText, revisedText)
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

function escapeMarkdownForCodeBlock(text: string): string {
	return text.replace(/```/g, "\\`\\`\\`")
}
