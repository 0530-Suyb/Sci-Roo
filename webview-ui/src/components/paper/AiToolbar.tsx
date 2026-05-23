import React, { useCallback, useEffect, useState, useRef } from "react"
import { Languages, Wand2, Replace, Shrink, Split, Sparkles, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type AiToolbarProps = {
	sectionType: string | null
	selectedText: string
	onAiLoadingChange?: (loading: boolean) => void
	hasPendingResult?: boolean
}

const TRANSLATE_OPTIONS = [
	{ value: "Chinese", label: "To Chinese" },
	{ value: "English", label: "To English" },
]

const STYLE_OPTIONS = [
	{ value: "scientific", label: "More Scientific" },
	{ value: "precise", label: "More Precise" },
	{ value: "concise", label: "More Concise" },
]

export const AiToolbar: React.FC<AiToolbarProps> = ({
	sectionType,
	selectedText,
	onAiLoadingChange,
	hasPendingResult,
}) => {
	const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
	const [loadingOp, setLoadingOp] = useState<string | null>(null)
	const toolbarRef = useRef<HTMLDivElement>(null)

	const handleAiOp = useCallback(
		(operation: string) => {
			if (!selectedText.trim()) return
			setLoadingOp(operation)
			setDropdownOpen(null)
			onAiLoadingChange?.(true)
			const [opName, opOption] = operation.split(":", 2)
			vscode.postMessage({
				type: "paperWritingAiOp",
				text: selectedText,
				query: opName,
				sectionType,
				operation: opName,
				option: opOption || undefined,
			} as any)
			// Loading will be cleared when result arrives via paperWritingState
		},
		[selectedText, sectionType, onAiLoadingChange],
	)

	// Clear loading when pending result arrives
	useEffect(() => {
		if (hasPendingResult && loadingOp) {
			setLoadingOp(null)
		}
	}, [hasPendingResult, loadingOp])

	const toggleDropdown = useCallback((name: string) => {
		setDropdownOpen((prev) => (prev === name ? null : name))
	}, [])

	const handleAiWriteSection = useCallback(() => {
		if (!sectionType) return
		setLoadingOp("aiWrite")
		onAiLoadingChange?.(true)
		vscode.postMessage({
			type: "paperAiWriteSection",
			action: "sectionAiWrite",
			sectionType,
		})
	}, [sectionType, onAiLoadingChange])

	return (
		<div ref={toolbarRef} className="flex items-center gap-0.5 flex-wrap px-2 py-1 bg-muted/20">
			{/* AI Write full section */}
			<Button
				variant="ghost"
				size="sm"
				className="text-xs h-7 px-2"
				disabled={loadingOp !== null || !sectionType}
				onClick={handleAiWriteSection}>
				{loadingOp === "aiWrite" ? (
					<Loader2 className="w-3 h-3 mr-1 animate-spin" />
				) : (
					<Sparkles className="w-3 h-3 mr-1" />
				)}
				Write
			</Button>

			{/* Separator */}
			<div className="w-px h-4 bg-border mx-0.5" />

			{/* Translate dropdown */}
			<div className="relative">
				<Button
					variant="ghost"
					size="sm"
					className="text-xs h-7 px-2 gap-0.5"
					onClick={() => toggleDropdown("translate")}>
					<Languages className="w-3 h-3 mr-1" />
					Translate
					<ChevronDown className="w-3 h-3 ml-0.5" />
				</Button>
				{dropdownOpen === "translate" && (
					<div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-10 min-w-[140px]">
						{TRANSLATE_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
								onClick={() => handleAiOp(`translate:${opt.value}`)}>
								{opt.label}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Style dropdown */}
			<div className="relative">
				<Button
					variant="ghost"
					size="sm"
					className="text-xs h-7 px-2 gap-0.5"
					onClick={() => toggleDropdown("style")}>
					<Wand2 className="w-3 h-3 mr-1" />
					Style
					<ChevronDown className="w-3 h-3 ml-0.5" />
				</Button>
				{dropdownOpen === "style" && (
					<div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-10 min-w-[160px]">
						{STYLE_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
								onClick={() => handleAiOp(`style:${opt.value}`)}>
								{opt.label}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Rewrite */}
			<Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleAiOp("rewrite")}>
				<Sparkles className="w-3 h-3 mr-1" />
				Rewrite
			</Button>

			{/* Rephrase */}
			<Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleAiOp("rephrase")}>
				<Replace className="w-3 h-3 mr-1" />
				Rephrase
			</Button>

			{/* Abbreviate */}
			<Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleAiOp("abbreviate")}>
				<Shrink className="w-3 h-3 mr-1" />
				Abbreviate
			</Button>

			{/* Split/Merge */}
			<Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleAiOp("splitMerge")}>
				<Split className="w-3 h-3 mr-1" />
				Split/Merge
			</Button>

			{/* Summarize */}
			<Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleAiOp("summarize")}>
				Summarize
			</Button>

			{/* Explain */}
			<Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleAiOp("explain")}>
				Explain
			</Button>
		</div>
	)
}

export default React.memo(AiToolbar)
