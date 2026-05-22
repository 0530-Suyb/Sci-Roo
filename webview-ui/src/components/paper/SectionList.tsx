import React, { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Circle, Edit3, FileText, Plus, X, Edit2 } from "lucide-react"

type SectionListProps = {
	project: any
	writingState: any
	wordStatus: any
	selectedSection: string | null
	onSelectSection: (sectionType: string) => void
	onAddSection?: (sectionType: string, label: string) => void
	onDeleteSection?: (sectionType: string) => void
	onRenameSection?: (sectionType: string, newLabel: string) => void
}

type SectionInfo = {
	type: string
	label: string
	recommendedOrder: number
	required: boolean
	targetWordRange?: [number, number]
}

// All possible section types for "Add Section" dropdown
const ALL_SECTION_TYPES: { type: string; label: string }[] = [
	{ type: "abstract", label: "Abstract" },
	{ type: "introduction", label: "Introduction" },
	{ type: "related-work", label: "Related Work" },
	{ type: "methods", label: "Methods" },
	{ type: "results", label: "Results" },
	{ type: "discussion", label: "Discussion" },
	{ type: "conclusion", label: "Conclusion" },
	{ type: "broader-impact", label: "Broader Impact" },
	{ type: "limitations", label: "Limitations" },
	{ type: "appendix", label: "Appendix" },
]

// Section configs keyed by venue template type (ml/systems/general)
const VENUE_TYPE_SECTIONS: Record<string, SectionInfo[]> = {
	ml: [
		{ type: "abstract", label: "Abstract", recommendedOrder: 0, required: true, targetWordRange: [150, 300] },
		{
			type: "introduction",
			label: "Introduction",
			recommendedOrder: 1,
			required: true,
			targetWordRange: [600, 1200],
		},
		{
			type: "related-work",
			label: "Related Work",
			recommendedOrder: 2,
			required: true,
			targetWordRange: [500, 1000],
		},
		{ type: "methods", label: "Methods", recommendedOrder: 3, required: true, targetWordRange: [800, 2000] },
		{ type: "results", label: "Results", recommendedOrder: 4, required: true, targetWordRange: [800, 2000] },
		{ type: "discussion", label: "Discussion", recommendedOrder: 5, required: false, targetWordRange: [400, 800] },
		{ type: "conclusion", label: "Conclusion", recommendedOrder: 6, required: true, targetWordRange: [200, 500] },
		{ type: "appendix", label: "Appendix", recommendedOrder: 7, required: false },
	],
	systems: [
		{ type: "abstract", label: "Abstract", recommendedOrder: 0, required: true, targetWordRange: [150, 250] },
		{
			type: "introduction",
			label: "Introduction",
			recommendedOrder: 1,
			required: true,
			targetWordRange: [800, 1500],
		},
		{
			type: "related-work",
			label: "Related Work",
			recommendedOrder: 2,
			required: true,
			targetWordRange: [500, 1000],
		},
		{ type: "methods", label: "Design & Impl", recommendedOrder: 3, required: true, targetWordRange: [1500, 3000] },
		{ type: "results", label: "Evaluation", recommendedOrder: 4, required: true, targetWordRange: [1500, 3000] },
		{ type: "discussion", label: "Discussion", recommendedOrder: 5, required: false, targetWordRange: [400, 800] },
		{ type: "conclusion", label: "Conclusion", recommendedOrder: 6, required: true, targetWordRange: [200, 400] },
		{ type: "appendix", label: "Appendix", recommendedOrder: 7, required: false },
	],
	general: [
		{ type: "abstract", label: "Abstract", recommendedOrder: 0, required: true, targetWordRange: [100, 300] },
		{ type: "introduction", label: "Introduction", recommendedOrder: 1, required: true },
		{ type: "related-work", label: "Related Work", recommendedOrder: 2, required: false },
		{ type: "methods", label: "Methods", recommendedOrder: 3, required: true },
		{ type: "results", label: "Results", recommendedOrder: 4, required: true },
		{ type: "discussion", label: "Discussion", recommendedOrder: 5, required: false },
		{ type: "conclusion", label: "Conclusion", recommendedOrder: 6, required: true },
		{ type: "appendix", label: "Appendix", recommendedOrder: 7, required: false },
	],
}

// Map venue template IDs to type
const VENUE_TYPE_MAP: Record<string, string> = {
	neurips2025: "ml",
	icml2026: "ml",
	iclr2026: "ml",
	acl: "ml",
	aaai2026: "ml",
	colm2025: "ml",
	osdi2026: "systems",
	sosp2026: "systems",
	asplos2027: "systems",
	nsdi2027: "systems",
	generic: "general",
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
	outline: <Circle className="w-3 h-3 text-muted-foreground" />,
	draft: <Edit3 className="w-3 h-3 text-blue-500" />,
	revised: <CheckCircle2 className="w-3 h-3 text-amber-500" />,
	final: <CheckCircle2 className="w-3 h-3 text-green-500" />,
}

export const SectionList: React.FC<SectionListProps> = ({
	project,
	writingState,
	wordStatus,
	selectedSection,
	onSelectSection,
	onAddSection,
	onDeleteSection,
	onRenameSection,
}) => {
	const [addDropdownOpen, setAddDropdownOpen] = useState(false)
	const [renamingSection, setRenamingSection] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState("")

	const sections = useMemo(() => {
		const venueType = VENUE_TYPE_MAP[project?.templateId] || "general"
		return VENUE_TYPE_SECTIONS[venueType] || VENUE_TYPE_SECTIONS.general
	}, [project?.templateId])

	const customConfigs = project?.customSectionConfigs ?? ({} as Record<string, { label?: string }>)
	const sectionStatus = writingState?.sectionStatus ?? ({} as Record<string, string>)

	const totalWords = writingState?.totalWords ?? 0
	const targetWords = writingState?.targetWords ?? 8000
	const progressPct = targetWords > 0 ? Math.min(100, Math.round((totalWords / targetWords) * 100)) : 0

	const getWordCount = (sectionType: string): number | undefined => {
		if (wordStatus?.[sectionType] !== undefined) {
			return wordStatus[sectionType]
		}
		return undefined
	}

	const isOverLimit = (sectionType: string, words?: number): boolean => {
		if (words === undefined) return false
		const section = sections.find((s) => s.type === sectionType)
		if (!section?.targetWordRange) return false
		return words >= section.targetWordRange[1]
	}

	// Available types for "Add Section" (not already in use)
	const usedTypes = new Set(sections.map((s) => s.type))
	const availableTypes = ALL_SECTION_TYPES.filter((t) => !usedTypes.has(t.type))

	const handleStartRename = (section: SectionInfo, e: React.MouseEvent) => {
		e.stopPropagation()
		setRenamingSection(section.type)
		setRenameValue(section.label)
	}

	const handleFinishRename = (sectionType: string, e: React.KeyboardEvent | React.FocusEvent) => {
		if (renameValue.trim() && onRenameSection) {
			onRenameSection(sectionType, renameValue.trim())
		}
		setRenamingSection(null)
	}

	return (
		<div className="w-52 border-r shrink-0 overflow-auto flex flex-col">
			{/* Header */}
			<div className="px-3 py-2 border-b flex items-center justify-between">
				<div className="min-w-0">
					<h4 className="font-semibold text-sm truncate" title={project?.name}>
						{project?.name || "Sections"}
					</h4>
					{project?.templateId && (
						<span className="text-[10px] text-muted-foreground">{project.templateId}</span>
					)}
				</div>
				{onAddSection && availableTypes.length > 0 && (
					<div className="relative">
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground p-0.5"
							onClick={() => setAddDropdownOpen(!addDropdownOpen)}
							title="Add section">
							<Plus className="w-3.5 h-3.5" />
						</button>
						{addDropdownOpen && (
							<div className="absolute top-full right-0 mt-1 bg-popover border rounded-md shadow-md z-20 min-w-[140px]">
								{availableTypes.map((t) => (
									<button
										key={t.type}
										type="button"
										className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
										onClick={() => {
											onAddSection(t.type, t.label)
											setAddDropdownOpen(false)
										}}>
										{t.label}
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Section list */}
			<div className="flex-1 overflow-auto p-1.5 space-y-0.5">
				{sections.map((section) => {
					const words = getWordCount(section.type)
					const status = sectionStatus[section.type] || "outline"
					const over = isOverLimit(section.type, words)
					const isRenaming = renamingSection === section.type

					return (
						<button
							key={section.type}
							type="button"
							onClick={() => {
								if (!isRenaming) onSelectSection(section.type)
							}}
							className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors group ${
								selectedSection === section.type
									? "bg-primary/10 text-primary font-medium"
									: "hover:bg-muted/50 text-muted-foreground"
							}`}>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 min-w-0">
									{STATUS_ICONS[status]}
									{isRenaming ? (
										<input
											type="text"
											className="w-24 text-xs border rounded px-1 py-0.5"
											value={renameValue}
											onChange={(e) => setRenameValue(e.target.value)}
											onBlur={(e) => handleFinishRename(section.type, e)}
											onKeyDown={(e) => {
												e.stopPropagation()
												if (e.key === "Enter") handleFinishRename(section.type, e)
												if (e.key === "Escape") setRenamingSection(null)
											}}
											autoFocus
											onClick={(e) => e.stopPropagation()}
										/>
									) : (
										<span className="truncate">
											{customConfigs[section.type]?.label || section.label}
										</span>
									)}
									{!section.required && (
										<span className="text-[10px] text-muted-foreground/60">opt</span>
									)}
								</div>
								<div className="flex items-center gap-0.5 shrink-0">
									{words !== undefined && !isRenaming && (
										<span
											className={`text-[10px] ${
												over ? "text-red-500 font-medium" : "text-muted-foreground"
											}`}>
											{words}
											{section.targetWordRange && <>/{section.targetWordRange[1]}</>}
										</span>
									)}
									{/* Hover actions for rename/delete */}
									{onRenameSection && !isRenaming && (
										<button
											type="button"
											className="text-muted-foreground hover:text-foreground p-0.5 opacity-0 group-hover:opacity-100"
											onClick={(e) => handleStartRename(section, e)}
											title="Rename">
											<Edit2 className="w-2.5 h-2.5" />
										</button>
									)}
									{onDeleteSection && !section.required && !isRenaming && (
										<button
											type="button"
											className="text-muted-foreground hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100"
											onClick={(e) => {
												e.stopPropagation()
												if (confirm(`Delete section "${section.label}"?`)) {
													onDeleteSection(section.type)
												}
											}}
											title="Delete">
											<X className="w-2.5 h-2.5" />
										</button>
									)}
								</div>
							</div>
							{/* Over-limit warning */}
							{over && (
								<div className="flex items-center gap-1 mt-0.5 text-[10px] text-red-500">
									<AlertTriangle className="w-2.5 h-2.5" />
									<span>Over limit</span>
								</div>
							)}
							{/* Progress bar */}
							{section.targetWordRange && words !== undefined && (
								<div className="w-full bg-muted rounded h-0.5 mt-1">
									<div
										className={`h-0.5 rounded transition-all ${over ? "bg-red-500" : words > 0 ? "bg-blue-500" : "bg-muted-foreground/20"}`}
										style={{
											width: `${Math.min(100, (words / section.targetWordRange[1]) * 100)}%`,
										}}
									/>
								</div>
							)}
						</button>
					)
				})}
			</div>

			{/* Progress footer */}
			<div className="px-3 py-2 border-t">
				<div className="flex items-center justify-between text-xs mb-1">
					<span className="text-muted-foreground">Progress</span>
					<span className="font-mono">
						{totalWords}/{targetWords}
					</span>
				</div>
				<div className="w-full bg-muted rounded h-1.5">
					<div
						className={`h-1.5 rounded transition-all ${
							progressPct >= 100
								? "bg-green-500"
								: progressPct >= 60
									? "bg-blue-500"
									: progressPct >= 30
										? "bg-amber-500"
										: "bg-muted-foreground/30"
						}`}
						style={{ width: `${Math.max(2, progressPct)}%` }}
					/>
				</div>
				<div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
					<FileText className="w-2.5 h-2.5" />
					<span>{writingState?.citationCount ?? 0} citations</span>
				</div>
			</div>
		</div>
	)
}

export default React.memo(SectionList)
