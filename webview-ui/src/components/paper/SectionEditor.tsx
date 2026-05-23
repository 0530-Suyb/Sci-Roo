import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	Save,
	Camera,
	FileText,
	Loader2,
	Check,
	X,
	Sparkles,
	ChevronDown,
	ChevronRight,
	TriangleAlert,
} from "lucide-react"
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { AiToolbar } from "./AiToolbar"
import { SectionGuidePanel } from "./SectionGuidePanel"
import { SectionReadinessPanel } from "./SectionReadinessPanel"

type SectionEditorProps = {
	project: any
	selectedSection: string | null
	sectionContent: string
	onContentChange: (content: string) => void
	onSave: (sectionType: string, content: string) => void
	snapshots: any[]
	paperWritingState: any
	missingCitations: string[] | null
	sectionInsights: any
	onFocusSection?: (sectionType: string) => void
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
	missingCitations,
	sectionInsights,
	onFocusSection: _onFocusSection,
}) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [justSaved, setJustSaved] = useState(false)
	const [aiLoading, setAiLoading] = useState(false)
	const [editingWordLimit, setEditingWordLimit] = useState(false)
	const [customMaxWords, setCustomMaxWords] = useState<number | null>(null)
	const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle")
	const [supportOpen, setSupportOpen] = useState(false)

	// Pending AI result from state
	const [pendingResult, setPendingResult] = useState<any>(null)
	const lastSavedContentRef = useRef("")
	const pendingHydrationRef = useRef(true)

	// Sync pending result from props
	useEffect(() => {
		if (paperWritingState?.pendingResult) {
			setPendingResult(paperWritingState.pendingResult)
		}
	}, [paperWritingState?.pendingResult])

	const targetWordRange = paperWritingState?.targetWordRange ?? null
	const currentSectionStatus = paperWritingState?.sectionStatusValue ?? "outline"
	const targetWordRangeMax = targetWordRange?.[1] ?? null
	const isSectionContentEmpty = !sectionContent.trim()

	// Local word count from content (real-time)
	const localWordCount = useMemo(() => countWordsInLatex(sectionContent), [sectionContent])

	// Use custom max or template max
	const effectiveMax = customMaxWords ?? targetWordRangeMax ?? 0
	const overLimit = effectiveMax > 0 ? localWordCount > effectiveMax : false

	useEffect(() => {
		setCustomMaxWords(targetWordRangeMax)
	}, [selectedSection, targetWordRangeMax])

	useEffect(() => {
		pendingHydrationRef.current = true
		setSaveState("idle")
	}, [selectedSection])

	useEffect(() => {
		if (!selectedSection) {
			return
		}
		setSupportOpen(currentSectionStatus === "outline" || isSectionContentEmpty)
	}, [currentSectionStatus, isSectionContentEmpty, selectedSection])

	useEffect(() => {
		if (paperWritingState?.sectionType !== selectedSection || paperWritingState?.sectionContent === undefined) {
			return
		}
		lastSavedContentRef.current = paperWritingState.sectionContent
		pendingHydrationRef.current = false
		if (!paperWritingState?.saved) {
			setSaveState("idle")
		}
	}, [paperWritingState?.saved, paperWritingState?.sectionContent, paperWritingState?.sectionType, selectedSection])

	// Clear AI loading when pending result arrives
	useEffect(() => {
		if (pendingResult && aiLoading) {
			setAiLoading(false)
		}
	}, [pendingResult, aiLoading])

	// Auto-save flash
	useEffect(() => {
		if (paperWritingState?.saved) {
			lastSavedContentRef.current = sectionContent
			setJustSaved(true)
			setSaveState("saved")
			const timer = setTimeout(() => setJustSaved(false), 2000)
			return () => clearTimeout(timer)
		}
	}, [paperWritingState?.saved, sectionContent])

	useEffect(() => {
		if (!selectedSection || pendingHydrationRef.current) {
			return
		}
		if (sectionContent === lastSavedContentRef.current) {
			if (saveState !== "saving") {
				setSaveState("idle")
			}
			return
		}

		setSaveState((current) => (current === "saving" ? current : "dirty"))
		const timer = window.setTimeout(() => {
			setSaveState("saving")
			onSave(selectedSection, sectionContent)
			vscode.postMessage({
				type: "paperSectionStatus",
				action: "sectionStatus",
			})
		}, 1600)

		return () => window.clearTimeout(timer)
	}, [onSave, saveState, sectionContent, selectedSection])

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

	const handleInsertScaffold = useCallback(
		(scaffold: string) => {
			const shouldReplace = !sectionContent.trim()
				? true
				: window.confirm(
						"Replace the current section with a writing scaffold? Click Cancel to append it instead.",
					)
			const nextContent = shouldReplace ? scaffold : `${sectionContent.trimEnd()}\n\n${scaffold}`
			onContentChange(nextContent)
		},
		[onContentChange, sectionContent],
	)

	const handleInsertQuickStarter = useCallback(() => {
		const sectionLabel = selectedSection ? selectedSection.replace(/-/g, " ") : "section"
		handleInsertScaffold(`% ${sectionLabel}\n% Add the key claim, evidence, and transition for this section.\n`)
	}, [handleInsertScaffold, selectedSection])

	const handleOpenProjectFile = useCallback(
		(relativePath: string) => {
			const normalizedPath = project?.rootPath
				? `${String(project.rootPath).replace(/[\\/]$/, "")}/${relativePath}`.replace(/\//g, "\\")
				: relativePath
			vscode.postMessage({
				type: "openFile",
				text: normalizedPath,
			})
		},
		[project?.rootPath],
	)

	const handleSaveWordLimit = useCallback(() => {
		if (!selectedSection || !targetWordRange || !customMaxWords || customMaxWords <= 0) {
			setEditingWordLimit(false)
			return
		}

		vscode.postMessage({
			type: "paperSectionSave",
			action: "sectionConfigSave",
			sectionType: selectedSection,
			targetWordRange: [targetWordRange[0], customMaxWords],
		})
		setEditingWordLimit(false)
	}, [customMaxWords, selectedSection, targetWordRange])

	const handleStatusChange = useCallback(
		(status: "outline" | "draft" | "revised" | "final") => {
			if (!selectedSection) return
			vscode.postMessage({
				type: "paperSectionSave",
				action: "sectionConfigSave",
				sectionType: selectedSection,
				sectionStatusValue: status,
			})
		},
		[selectedSection],
	)

	const currentInsight = selectedSection ? sectionInsights?.[selectedSection] : null
	const quickDiagnosis = useMemo(() => {
		if (!selectedSection) {
			return null
		}
		if (currentInsight?.readiness === "blocked") {
			return {
				tone: "warn",
				text: `${currentInsight.label ?? selectedSection} is still blank. Start with a scaffold or rough argument first.`,
			}
		}
		if ((currentInsight?.missingCitationCount ?? 0) > 0) {
			return {
				tone: "warn",
				text: `${currentInsight.missingCitationCount} cite key${currentInsight.missingCitationCount > 1 ? "s are" : " is"} missing in this section.`,
			}
		}
		if (currentInsight?.issues?.includes?.("over-limit")) {
			return {
				tone: "tip",
				text: `This section is over the target word budget. Trim repetition before final polishing.`,
			}
		}
		if (currentInsight?.nextStep) {
			return {
				tone: "good",
				text: currentInsight.nextStep,
			}
		}
		return null
	}, [currentInsight, selectedSection])

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
									setCustomMaxWords(Number.isFinite(val) && val > 0 ? val : null)
								}}
								onBlur={handleSaveWordLimit}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSaveWordLimit()
									if (e.key === "Escape") setEditingWordLimit(false)
								}}
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
					<div className="ml-1 flex items-center gap-1">
						{(["outline", "draft", "revised", "final"] as const).map((status) => (
							<button
								key={status}
								type="button"
								onClick={() => handleStatusChange(status)}
								className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
									currentSectionStatus === status
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:bg-muted"
								}`}>
								{status}
							</button>
						))}
					</div>
					{justSaved && (
						<span className="text-xs text-green-600 flex items-center gap-1">
							<Check className="w-3 h-3" />
							Saved
						</span>
					)}
					{!justSaved && saveState === "dirty" && (
						<span className="text-xs text-amber-600 flex items-center gap-1">Unsaved changes</span>
					)}
					{saveState === "saving" && (
						<span className="text-xs text-blue-600 flex items-center gap-1">
							<Loader2 className="w-3 h-3 animate-spin" />
							Autosaving
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

			{quickDiagnosis && (
				<div className="px-3 pt-3 shrink-0">
					<div
						className={`rounded-xl border px-3 py-2 text-sm ${
							quickDiagnosis.tone === "warn"
								? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
								: quickDiagnosis.tone === "tip"
									? "border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-200"
									: "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
						}`}>
						<div className="flex items-start gap-2">
							<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
							<p>{quickDiagnosis.text}</p>
						</div>
					</div>
				</div>
			)}

			<div className="px-3 pt-3 shrink-0">
				<Collapsible open={supportOpen} onOpenChange={setSupportOpen}>
					<div className="rounded-xl border bg-background/85">
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/40">
								<span>Writing support</span>
								<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
									<span>Guide and diagnostics</span>
									{supportOpen ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
								</div>
							</button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="space-y-3 border-t px-3 py-3">
								<SectionReadinessPanel
									selectedSection={selectedSection}
									projectStage={project?.stage}
									sectionStatus={currentSectionStatus}
									sectionContent={sectionContent}
									wordCount={localWordCount}
									targetWordRange={targetWordRange}
									missingCitations={missingCitations}
									onInsertScaffold={handleInsertQuickStarter}
									onOpenFile={handleOpenProjectFile}
								/>
								<SectionGuidePanel
									project={project}
									selectedSection={selectedSection}
									wordCount={localWordCount}
									targetWordRange={targetWordRange}
									onInsertScaffold={handleInsertScaffold}
									onOpenFile={handleOpenProjectFile}
								/>
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>
			</div>

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
