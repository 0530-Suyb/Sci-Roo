import React, { useCallback, useEffect, useState } from "react"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { ProjectCreateForm } from "./ProjectCreateForm"
import { SectionList } from "./SectionList"
import { SectionEditor } from "./SectionEditor"
import { ReferencePanel } from "./ReferencePanel"

type PaperWritingViewProps = {
	onDone: () => void
}

const PaperWritingView: React.FC<PaperWritingViewProps> = ({ onDone }) => {
	const { paperProjectState, paperWritingState, paperReferenceState, paperSnapshotState } = useExtensionState()

	const [loading, setLoading] = useState(true)

	const project = paperProjectState?.project ?? null
	const writingState = paperProjectState?.writingState ?? paperWritingState?.writingState ?? null
	const wordStatus = paperWritingState?.wordStatus ?? null
	const referenceEntries = paperReferenceState?.entries ?? paperProjectState?.referenceEntries ?? []
	const uncatalogued = paperReferenceState?.uncatalogued ?? paperProjectState?.uncatalogued ?? []
	const cited = paperReferenceState?.cited ?? null
	const missing = paperReferenceState?.missing ?? null
	const bibGenerated = paperReferenceState?.bibGenerated ?? false
	const bibPreview = paperReferenceState?.bibPreview ?? null
	const snapshots = paperSnapshotState?.snapshots ?? []
	const venueSwitchPreview = paperProjectState?.venueSwitchPreview ?? null

	// Current section being edited
	const [selectedSection, setSelectedSection] = useState<string | null>(null)
	const [sectionContent, setSectionContent] = useState("")
	const [showCreate, setShowCreate] = useState(false)
	const [pendingCreate, setPendingCreate] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	// Load project on mount
	useEffect(() => {
		vscode.postMessage({ type: "paperProjectLoad" })
		const timer = setTimeout(() => setLoading(false), 1500)
		return () => clearTimeout(timer)
	}, [])

	// When paperProjectState arrives, stop loading
	useEffect(() => {
		if (paperProjectState) {
			setLoading(false)
		}
	}, [paperProjectState])

	// When section content arrives from backend, update editor
	useEffect(() => {
		if (paperWritingState?.sectionContent !== undefined) {
			setSectionContent(paperWritingState.sectionContent)
		}
		if (paperWritingState?.sectionType) {
			setSelectedSection(paperWritingState.sectionType)
		}
	}, [paperWritingState])

	// When project arrives after pending create, close the form
	useEffect(() => {
		if (pendingCreate && project) {
			setShowCreate(false)
			setPendingCreate(false)
		}
	}, [pendingCreate, project])

	const handleSelectSection = useCallback((sectionType: string) => {
		setSelectedSection(sectionType)
		vscode.postMessage({
			type: "paperSectionLoad",
			action: "sectionLoad",
			sectionType,
		})
	}, [])

	const handleSaveSection = useCallback((sectionType: string, content: string) => {
		vscode.postMessage({
			type: "paperSectionSave",
			action: "sectionSave",
			text: content,
			sectionType,
		})
	}, [])

	const handleRefreshProject = useCallback(() => {
		setRefreshing(true)
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectRefresh",
		})
		setTimeout(() => setRefreshing(false), 3000)
	}, [])

	// ── Section CRUD (Phase 6) ──

	const handleAddSection = useCallback((sectionType: string, label: string) => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "sectionAdd",
			sectionType,
			sectionLabel: label,
		})
	}, [])

	const handleDeleteSection = useCallback((sectionType: string) => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "sectionDelete",
			sectionType,
		})
	}, [])

	const handleRenameSection = useCallback((sectionType: string, newLabel: string) => {
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "sectionRename",
			sectionType,
			sectionLabel: newLabel,
		})
	}, [])

	if (loading && !paperProjectState) {
		return (
			<div className="flex flex-col h-full">
				<div className="flex items-center gap-2 px-4 py-3 border-b">
					<Button variant="ghost" size="icon" onClick={onDone}>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<FileText className="w-5 h-5" />
					<h3 className="text-lg font-semibold">Paper Writing</h3>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="w-4 h-4 animate-spin" />
						<span className="text-sm">Loading project...</span>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
				<Button variant="ghost" size="icon" onClick={onDone}>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<FileText className="w-5 h-5" />
				<h3 className="text-lg font-semibold">Paper Writing</h3>
				{project && (
					<>
						<span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-secondary">
							{project.templateId}
						</span>
						<span className="text-xs text-muted-foreground">Stage: {project.stage}</span>
					</>
				)}
				<div className="flex items-center gap-2 ml-auto">
					{project && (
						<Button variant="outline" size="sm" onClick={handleRefreshProject}>
							Refresh
						</Button>
					)}
					{!project && (
						<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
							New Project
						</Button>
					)}
				</div>
			</div>

			{/* Body */}
			{!project || showCreate || pendingCreate ? (
				<div className="flex-1 overflow-auto">
					<ProjectCreateForm
						onCreated={() => {
							setShowCreate(false)
						}}
						onCancel={project ? () => setShowCreate(false) : undefined}
					/>
				</div>
			) : (
				<div className="flex-1 flex min-h-0">
					{/* Left: Section List */}
					<SectionList
						project={project}
						writingState={writingState}
						wordStatus={wordStatus}
						selectedSection={selectedSection}
						onSelectSection={handleSelectSection}
					/>

					{/* Center: Section Editor */}
					<SectionEditor
						project={project}
						selectedSection={selectedSection}
						sectionContent={sectionContent}
						onContentChange={setSectionContent}
						onSave={handleSaveSection}
						snapshots={snapshots}
						paperWritingState={paperWritingState}
					/>

					{/* Right: Reference Panel */}
					<ReferencePanel
						referenceEntries={referenceEntries}
						uncatalogued={uncatalogued}
						cited={cited}
						missing={missing}
						bibGenerated={bibGenerated}
						bibPreview={bibPreview}
					/>
				</div>
			)}

			{/* Footer */}
			{project && (
				<div className="px-4 py-1.5 border-t text-xs text-muted-foreground flex items-center gap-4 shrink-0">
					<span>Stage: {project.stage}</span>
					{writingState && (
						<>
							<span>
								Words: {writingState.totalWords}/{writingState.targetWords}
							</span>
							<span>Citations: {writingState.citationCount}</span>
						</>
					)}
				</div>
			)}
		</div>
	)
}

export default React.memo(PaperWritingView)
