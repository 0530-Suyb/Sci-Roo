import React, { useState, useCallback, useEffect } from "react"
import { ArrowLeft, FlaskConical, Plus, Lightbulb, Beaker, BarChart3, FileText, CheckCircle } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { Button, Input } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type ResearchPipelineViewProps = {
	onDone: () => void
}

const STAGE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
	planning: { label: "Planning", icon: <Lightbulb className="w-4 h-4" /> },
	"literature-review": { label: "Literature", icon: <FlaskConical className="w-4 h-4" /> },
	"hypothesis-design": { label: "Hypotheses", icon: <Lightbulb className="w-4 h-4" /> },
	"data-collection": { label: "Data Collection", icon: <Beaker className="w-4 h-4" /> },
	"data-analysis": { label: "Analysis", icon: <BarChart3 className="w-4 h-4" /> },
	visualization: { label: "Visualization", icon: <BarChart3 className="w-4 h-4" /> },
	writing: { label: "Writing", icon: <FileText className="w-4 h-4" /> },
	"peer-review": { label: "Review", icon: <CheckCircle className="w-4 h-4" /> },
	published: { label: "Published", icon: <CheckCircle className="w-4 h-4" /> },
}

const ALL_STAGES = Object.keys(STAGE_LABELS)

const ResearchPipelineView: React.FC<ResearchPipelineViewProps> = ({ onDone }) => {
	const { t: _t } = useAppTranslation()
	const { researchPipelineState } = useExtensionState()
	const state = researchPipelineState || {}

	const project = state.project

	const [showCreate, setShowCreate] = useState(false)
	const [newName, setNewName] = useState("")
	const [newDesc, setNewDesc] = useState("")
	const [newNote, setNewNote] = useState("")
	const [newHypothesis, setNewHypothesis] = useState("")

	const handleRequestList = useCallback(() => {
		vscode.postMessage({ type: "researchPipelineList" })
	}, [])

	useEffect(() => {
		handleRequestList()
	}, [handleRequestList])

	const handleCreateProject = useCallback(() => {
		if (!newName.trim()) return
		vscode.postMessage({
			type: "researchPipelineRun",
			action: "createProject",
			query: newName,
			text: newDesc,
		})
		setShowCreate(false)
		setNewName("")
		setNewDesc("")
	}, [newName, newDesc])

	const handleSetStage = useCallback((stage: string) => {
		vscode.postMessage({
			type: "researchPipelineRun",
			action: "setStage",
			query: stage,
		})
	}, [])

	const handleAddHypothesis = useCallback(() => {
		if (!newHypothesis.trim()) return
		vscode.postMessage({
			type: "researchPipelineRun",
			action: "addHypothesis",
			text: newHypothesis,
		})
		setNewHypothesis("")
	}, [newHypothesis])

	const handleAddNote = useCallback(() => {
		if (!newNote.trim()) return
		vscode.postMessage({
			type: "researchPipelineRun",
			action: "addNote",
			text: newNote,
		})
		setNewNote("")
	}, [newNote])

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={onDone}>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<FlaskConical className="w-5 h-5" />
					<h3 className="text-lg font-semibold">Research Pipeline</h3>
				</div>
				<div className="flex items-center gap-2 ml-auto">
					<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
						<Plus className="w-4 h-4" />
						<span className="ml-1">New Project</span>
					</Button>
				</div>
			</TabHeader>

			<TabContent>
				<div className="flex flex-col h-full">
					{/* Create project dialog */}
					{showCreate && (
						<div className="px-4 pt-4 pb-4 border-b">
							<div className="space-y-2">
								<Input
									placeholder="Project name..."
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
								/>
								<Input
									placeholder="Description (optional)..."
									value={newDesc}
									onChange={(e) => setNewDesc(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
								/>
								<div className="flex gap-2">
									<Button variant="primary" size="sm" onClick={handleCreateProject}>
										Create
									</Button>
									<Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
										Cancel
									</Button>
								</div>
							</div>
						</div>
					)}

					{!project && !showCreate && (
						<div className="flex-1 flex items-center justify-center p-8">
							<div className="text-center text-muted-foreground">
								<FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
								<p>No research project yet.</p>
								<p className="text-sm mt-1">Create a project to track your research workflow.</p>
							</div>
						</div>
					)}

					{project && (
						<div className="flex-1 overflow-auto">
							{/* Project info */}
							<div className="px-4 py-3 border-b">
								<h4 className="font-semibold">{project.name}</h4>
								{project.description && (
									<p className="text-sm text-muted-foreground mt-1">{project.description}</p>
								)}
								<p className="text-xs text-muted-foreground mt-1">
									Created: {new Date(project.createdAt).toLocaleDateString()}
								</p>
							</div>

							{/* Stage selector */}
							<div className="px-4 py-3 border-b">
								<p className="text-xs font-medium text-muted-foreground mb-2">Current Stage</p>
								<div className="flex flex-wrap gap-1">
									{ALL_STAGES.map((stage) => (
										<button
											key={stage}
											onClick={() => handleSetStage(stage)}
											className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
												project.stage === stage
													? "bg-primary text-primary-foreground"
													: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
											}`}>
											{STAGE_LABELS[stage]?.icon}
											{STAGE_LABELS[stage]?.label || stage}
										</button>
									))}
								</div>
							</div>

							{/* Hypotheses */}
							<div className="px-4 py-3 border-b">
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-medium text-muted-foreground">
										<Lightbulb className="w-3 h-3 inline mr-1" />
										Hypotheses ({project.hypotheses?.length || 0})
									</span>
								</div>
								{(project.hypotheses || []).map((h: any) => (
									<div
										key={h.id}
										className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50">
										<span
											className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
												h.status === "supported"
													? "bg-green-500"
													: h.status === "rejected"
														? "bg-red-500"
														: "bg-yellow-500"
											}`}
										/>
										<span className="text-sm">{h.statement}</span>
									</div>
								))}
								<div className="flex gap-2 mt-2">
									<Input
										placeholder="New hypothesis..."
										value={newHypothesis}
										onChange={(e) => setNewHypothesis(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleAddHypothesis()}
										className="text-xs"
									/>
									<Button variant="outline" size="sm" onClick={handleAddHypothesis}>
										<Plus className="w-3 h-3" />
									</Button>
								</div>
							</div>

							{/* Experiments */}
							<div className="px-4 py-3 border-b">
								<span className="text-xs font-medium text-muted-foreground mb-2 block">
									<Beaker className="w-3 h-3 inline mr-1" />
									Experiments ({project.experiments?.length || 0})
								</span>
								{(project.experiments || []).map((exp: any) => (
									<div key={exp.id} className="py-1 px-2 rounded hover:bg-muted/50">
										<span className="text-sm font-medium">{exp.name}</span>
										<span className="text-xs text-muted-foreground ml-2">{exp.design}</span>
										{exp.sampleSize > 0 && (
											<span className="text-xs text-muted-foreground ml-2">
												N={exp.sampleSize}
											</span>
										)}
									</div>
								))}
							</div>

							{/* Notes */}
							<div className="px-4 py-3">
								<span className="text-xs font-medium text-muted-foreground mb-2 block">
									Notes ({project.notes?.length || 0})
								</span>
								<div className="flex gap-2 mb-3">
									<Input
										placeholder="Add a note..."
										value={newNote}
										onChange={(e) => setNewNote(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
										className="text-xs"
									/>
									<Button variant="outline" size="sm" onClick={handleAddNote}>
										<Plus className="w-3 h-3" />
									</Button>
								</div>
								{(project.notes || []).slice(0, 20).map((note: any) => (
									<div
										key={note.id}
										className="py-1 px-2 rounded hover:bg-muted/50 text-xs text-muted-foreground">
										<span className="text-foreground">{note.text}</span>
										<span className="ml-2">{new Date(note.timestamp).toLocaleString()}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</TabContent>
		</Tab>
	)
}

export default React.memo(ResearchPipelineView)
