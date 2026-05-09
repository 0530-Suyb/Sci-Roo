import React, { useState, useCallback, useEffect } from "react"
import { ArrowLeft, FileText, Plus, Download, Save, BookOpen, BarChart3, Table2 } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { Button, Input } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type PaperWritingViewProps = {
	onDone: () => void
}

const SECTION_TYPES = [
	{ type: "abstract", label: "Abstract" },
	{ type: "introduction", label: "Introduction" },
	{ type: "methods", label: "Methods" },
	{ type: "results", label: "Results" },
	{ type: "discussion", label: "Discussion" },
	{ type: "conclusion", label: "Conclusion" },
	{ type: "references", label: "References" },
]

const PaperWritingView: React.FC<PaperWritingViewProps> = ({ onDone }) => {
	const { t } = useAppTranslation()
	const { paperWritingState } = useExtensionState()
	const state = paperWritingState || {}

	const manuscript = state.current
	const history = state.history || []

	const [showCreate, setShowCreate] = useState(false)
	const [newTitle, setNewTitle] = useState("")
	const [selectedSection, setSelectedSection] = useState<string | null>(null)
	const [sectionTitle, setSectionTitle] = useState("")
	const [sectionContent, setSectionContent] = useState("")

	const handleRequestList = useCallback(() => {
		vscode.postMessage({ type: "paperWritingList" })
	}, [])

	useEffect(() => {
		handleRequestList()
	}, [])

	const handleCreateManuscript = useCallback(() => {
		if (!newTitle.trim()) return
		vscode.postMessage({
			type: "paperWritingAction",
			action: "createManuscript",
			query: newTitle,
		})
		setShowCreate(false)
		setNewTitle("")
	}, [newTitle])

	const handleSelectSection = useCallback((section: any) => {
		setSelectedSection(section.type)
		setSectionTitle(section.title || section.type)
		setSectionContent(section.content || "")
	}, [])

	const handleSaveSection = useCallback(() => {
		if (!selectedSection || !sectionContent.trim()) return
		vscode.postMessage({
			type: "paperWritingAction",
			action: "updateSection",
			text: sectionContent,
			sectionType: selectedSection,
			sectionTitle: sectionTitle || selectedSection,
		} as any)
	}, [selectedSection, sectionTitle, sectionContent])

	const handleExport = useCallback((format: "markdown" | "latex") => {
		vscode.postMessage({
			type: "paperWritingAction",
			action: "exportManuscript",
			query: format,
		})
	}, [])

	const handleNewSection = useCallback(
		(sectionType: string) => {
			const existing = manuscript?.sections?.find((s: any) => s.type === sectionType)
			if (existing) {
				handleSelectSection(existing)
			} else {
				setSelectedSection(sectionType)
				setSectionTitle(sectionType.charAt(0).toUpperCase() + sectionType.slice(1))
				setSectionContent("")
			}
		},
		[manuscript],
	)

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={onDone}>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<FileText className="w-5 h-5" />
					<h3 className="text-lg font-semibold">Paper Writing</h3>
				</div>
				<div className="flex items-center gap-2 ml-auto">
					{manuscript && (
						<>
							<Button variant="outline" size="sm" onClick={() => handleExport("markdown")}>
								<Download className="w-3 h-3 mr-1" />
								Markdown
							</Button>
							<Button variant="outline" size="sm" onClick={() => handleExport("latex")}>
								<Download className="w-3 h-3 mr-1" />
								LaTeX
							</Button>
						</>
					)}
					<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
						<Plus className="w-4 h-4" />
						<span className="ml-1">New</span>
					</Button>
				</div>
			</TabHeader>

			<TabContent>
				<div className="flex h-full">
					{/* Sidebar - section list */}
					<div className="w-52 border-r shrink-0 overflow-auto p-2">
						{manuscript ? (
							<>
								<div className="px-2 py-1 mb-2">
									<h4 className="font-semibold text-sm leading-snug">{manuscript.title}</h4>
									<span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground mt-1 inline-block">
										{manuscript.status}
									</span>
								</div>
								{SECTION_TYPES.map(({ type, label }) => {
									const section = manuscript.sections?.find((s: any) => s.type === type)
									return (
										<button
											key={type}
											onClick={() =>
												section ? handleSelectSection(section) : handleNewSection(type)
											}
											className={`w-full text-left px-2 py-1.5 rounded text-xs mb-0.5 transition-colors ${
												selectedSection === type
													? "bg-primary/10 text-primary font-medium"
													: "hover:bg-muted/50 text-muted-foreground"
											}`}>
											<div className="flex items-center justify-between">
												<span>{label}</span>
												{section && (
													<span className="text-[10px] text-muted-foreground">
														{section.wordCount}w
													</span>
												)}
											</div>
											{section && (
												<div className="w-full bg-muted rounded h-1 mt-1">
													<div
														className={`h-1 rounded ${section.status === "final" ? "bg-green-500" : section.status === "revised" ? "bg-amber-500" : "bg-blue-500"}`}
														style={{
															width:
																section.status === "final"
																	? "100%"
																	: section.status === "revised"
																		? "60%"
																		: "30%",
														}}
													/>
												</div>
											)}
										</button>
									)
								})}
								<div className="border-t mt-2 pt-2 px-2">
									<span className="text-[10px] text-muted-foreground">
										<BookOpen className="w-3 h-3 inline mr-1" />
										{manuscript.citations?.length || 0} references
									</span>
								</div>
								<div className="px-2 mt-1">
									<span className="text-[10px] text-muted-foreground">
										<BarChart3 className="w-3 h-3 inline mr-1" />
										{manuscript.figures?.length || 0} figures
									</span>
								</div>
								<div className="px-2 mt-1">
									<span className="text-[10px] text-muted-foreground">
										<Table2 className="w-3 h-3 inline mr-1" />
										{manuscript.tables?.length || 0} tables
									</span>
								</div>
							</>
						) : (
							<div className="p-2 text-xs text-muted-foreground text-center py-8">
								<FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
								No manuscript yet.
							</div>
						)}
					</div>

					{/* Editor area */}
					<div className="flex-1 flex flex-col min-w-0">
						{/* Create manuscript dialog */}
						{showCreate && (
							<div className="px-4 py-3 border-b">
								<div className="space-y-2">
									<Input
										placeholder="Manuscript title..."
										value={newTitle}
										onChange={(e) => setNewTitle(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleCreateManuscript()}
									/>
									<div className="flex gap-2">
										<Button variant="primary" size="sm" onClick={handleCreateManuscript}>
											Create
										</Button>
										<Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
											Cancel
										</Button>
									</div>
								</div>
							</div>
						)}

						{selectedSection ? (
							<>
								{/* Section editor header */}
								<div className="px-4 py-2 border-b flex items-center justify-between">
									<Input
										value={sectionTitle}
										onChange={(e) => setSectionTitle(e.target.value)}
										className="text-sm font-medium border-0 p-0 shadow-none bg-transparent"
										placeholder="Section title..."
									/>
									<Button variant="primary" size="sm" onClick={handleSaveSection}>
										<Save className="w-3 h-3 mr-1" />
										Save
									</Button>
								</div>

								{/* Section content editor */}
								<div className="p-4 flex-1 min-h-0">
									<textarea
										value={sectionContent}
										onChange={(e) => setSectionContent(e.target.value)}
										placeholder="Write your section content here..."
										className="w-full h-full resize-none text-sm p-4 rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 font-sans leading-relaxed"
									/>
								</div>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center p-8">
								<div className="text-center text-muted-foreground">
									<FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
									{manuscript ? (
										<>
											<p>Select a section from the sidebar to start editing.</p>
											<p className="text-sm mt-1">Or create a new section below.</p>
										</>
									) : (
										<>
											<p>Create a manuscript to get started.</p>
											<p className="text-sm mt-1">
												Write your paper with IMRaD structure and export to LaTeX or Markdown.
											</p>
										</>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</TabContent>
		</Tab>
	)
}

export default React.memo(PaperWritingView)
