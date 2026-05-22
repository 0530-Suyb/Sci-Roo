import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Save, Camera, FileText, Loader2, Check, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { AiToolbar } from "./AiToolbar"

type SectionEditorProps = {
	project: any
	selectedSection: string | null
	sectionContent: string
	onContentChange: (content: string) => void
	onSave: (sectionType: string, content: string) => void
	snapshots: any[]
	paperWritingState: any
}

function countWordsInLatex(text: string): number {
	const stripped = text
		.replace(/\\\w+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
		.replace(/\\begin\{[^}]*\}/g, " ")
		.replace(/\\end\{[^}]*\}/g, " ")
		.replace(/%[^\n]*/g, " ")
		.replace(/\s+/g, " ")
		.trim()
	return stripped ? stripped.split(/\s+/).length : 0
}

function safeReplace(text: string, search: string, replacement: string): string {
	const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	return text.replace(new RegExp(escapedSearch, "g"), replacement.replace(/\$/g, "$$$$"))
}

export const SectionEditor: React.FC<SectionEditorProps> = ({
	project,
	selectedSection,
	sectionContent,
	onContentChange,
	onSave,
	snapshots,
	paperWritingState,
}) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [justSaved, setJustSaved] = useState(false)
	const [aiLoading, setAiLoading] = useState(false)
	const [editingWordLimit, setEditingWordLimit] = useState(false)
	const [customMaxWords, setCustomMaxWords] = useState<number | null>(null)

	// Pending AI result from state
	const [pendingResult, setPendingResult] = useState<any>(null)

	// Sync pending result from props
	useEffect(() => {
		if (paperWritingState?.pendingResult) {
			setPendingResult(paperWritingState.pendingResult)
		}
	}, [paperWritingState?.pendingResult])

	const targetWordRange = paperWritingState?.targetWordRange ?? null

	// Local word count from content (real-time)
	const localWordCount = useMemo(() => countWordsInLatex(sectionContent), [sectionContent])

	// Use custom max or template max
	const effectiveMax = customMaxWords ?? targetWordRange?.[1] ?? 0
	const overLimit = effectiveMax > 0 ? localWordCount > effectiveMax : false

	// Clear AI loading when pending result arrives
	useEffect(() => {
		if (pendingResult && aiLoading) {
			setAiLoading(false)
		}
	}, [pendingResult, aiLoading])

	// Auto-save flash
	useEffect(() => {
		if (paperWritingState?.saved) {
			setJustSaved(true)
			const timer = setTimeout(() => setJustSaved(false), 2000)
			return () => clearTimeout(timer)
		}
	}, [paperWritingState?.saved])

	const getSelectedText = useCallback(() => {
		const textarea = textareaRef.current
		if (!textarea) return ""
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		return start !== end ? textarea.value.substring(start, end) : textarea.value
	}, [])

	const handleSave = useCallback(() => {
		if (!selectedSection) return
		onSave(selectedSection, sectionContent)
		// Refresh global word status after save
		vscode.postMessage({
			type: "paperSectionStatus",
			action: "sectionStatus",
		})
	}, [selectedSection, sectionContent, onSave])

	const handleSnapshot = useCallback(() => {
		vscode.postMessage({
			type: "paperSnapshotCreate",
			action: "snapshotCreate",
			query: `Snapshot at ${new Date().toLocaleString()}`,
		})
	}, [])

	const handleApplyResult = useCallback(() => {
		if (!pendingResult || !selectedSection) return
		const newContent = safeReplace(sectionContent, pendingResult.originalText, pendingResult.resultText)
		onContentChange(newContent)
		onSave(selectedSection, newContent)
		setPendingResult(null)
	}, [pendingResult, sectionContent, selectedSection, onContentChange, onSave])

	const handleDiscardResult = useCallback(() => {
		setPendingResult(null)
	}, [])

	// Keyboard shortcut for save (Ctrl+S)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault()
				handleSave()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleSave])

	if (!selectedSection) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center text-muted-foreground">
					<FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
					<p>Select a section from the sidebar to start editing.</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex-1 flex flex-col min-w-0">
			{/* Section header */}
			<div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium capitalize">{selectedSection.replace(/-/g, " ")}</span>
					{targetWordRange &&
						(editingWordLimit ? (
							<input
								type="number"
								className="w-16 text-xs border rounded px-1"
								value={effectiveMax}
								onChange={(e) => {
									const val = Number(e.target.value)
									if (val > 0) setCustomMaxWords(val)
								}}
								onBlur={() => setEditingWordLimit(false)}
								onKeyDown={(e) => e.key === "Enter" && setEditingWordLimit(false)}
								autoFocus
							/>
						) : (
							<span
								className={`text-xs cursor-pointer hover:underline ${overLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}
								onClick={() => setEditingWordLimit(true)}
								title={`Click to edit max word count (current limit: ${effectiveMax})`}>
								{localWordCount}/{effectiveMax} words
								{overLimit && " (over limit)"}
							</span>
						))}
					{!targetWordRange && <span className="text-xs text-muted-foreground">{localWordCount} words</span>}
					{justSaved && (
						<span className="text-xs text-green-600 flex items-center gap-1">
							<Check className="w-3 h-3" />
							Saved
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					{/* Snapshot button */}
					<Button
						variant="ghost"
						size="sm"
						className="text-xs h-7 px-2"
						onClick={handleSnapshot}
						title="Create snapshot of all latex/ files">
						<Camera className="w-3 h-3 mr-1" />
						Snapshot
					</Button>
					{snapshots.length > 0 && (
						<span className="text-[10px] text-muted-foreground">{snapshots.length}</span>
					)}
					{/* Save button */}
					<Button variant="primary" size="sm" onClick={handleSave}>
						<Save className="w-3 h-3 mr-1" />
						Save
					</Button>
				</div>
			</div>

			{/* AI Toolbar */}
			<AiToolbar
				sectionType={selectedSection}
				selectedText={getSelectedText()}
				onAiLoadingChange={setAiLoading}
				hasPendingResult={!!pendingResult}
			/>

			{/* AI loading indicator */}
			{aiLoading && (
				<div className="px-3 py-1 bg-blue-50 dark:bg-blue-950/20 border-b flex items-center gap-2 text-xs text-blue-600">
					<Loader2 className="w-3 h-3 animate-spin" />
					AI is processing...
				</div>
			)}

			{/* AI Result preview */}
			{pendingResult && (
				<div className="mx-3 mt-2 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 overflow-hidden shrink-0">
					<div className="flex items-center justify-between px-3 py-1.5 border-b border-blue-200 dark:border-blue-800 bg-blue-100/50 dark:bg-blue-950/40">
						<span className="text-xs font-medium flex items-center gap-1.5">
							<Sparkles className="w-3 h-3 text-blue-600" />
							{pendingResult.operation
								? pendingResult.operation.charAt(0).toUpperCase() + pendingResult.operation.slice(1)
								: "AI"}{" "}
							result
						</span>
						<div className="flex items-center gap-1">
							<Button variant="primary" size="sm" className="h-6 text-xs" onClick={handleApplyResult}>
								<Check className="w-3 h-3 mr-1" />
								Apply
							</Button>
							<Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleDiscardResult}>
								<X className="w-3 h-3 mr-1" />
								Discard
							</Button>
						</div>
					</div>
					<div className="p-2 space-y-2 max-h-[180px] overflow-auto">
						<div>
							<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
								Original
							</span>
							<pre className="mt-0.5 text-xs whitespace-pre-wrap p-1.5 rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 font-mono leading-relaxed">
								{pendingResult.originalText}
							</pre>
						</div>
						<div>
							<span className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
								Result
							</span>
							<pre className="mt-0.5 text-xs whitespace-pre-wrap p-1.5 rounded bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 font-mono leading-relaxed">
								{pendingResult.resultText}
							</pre>
						</div>
					</div>
				</div>
			)}

			{/* Editor */}
			<div className="p-3 flex-1 min-h-0">
				<textarea
					ref={textareaRef}
					value={sectionContent}
					onChange={(e) => onContentChange(e.target.value)}
					placeholder={`Write your ${selectedSection.replace(/-/g, " ")} content here in LaTeX format...\n\nSelect text and use the AI toolbar above to refine your writing.`}
					className="w-full h-full resize-none text-sm p-3 rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono leading-relaxed"
					spellCheck={false}
				/>
			</div>
		</div>
	)
}

export default React.memo(SectionEditor)
