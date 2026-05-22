import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FolderOpen, Plus, ChevronDown, FileText, Folder, BookOpen, Edit2, X, AlertTriangle } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type ProjectCreateFormProps = {
	onCreated: () => void
	onCancel?: () => void
}

type DirTemplateInfo = {
	id: string
	name: string
	description: string
	structure: { name: string; type: "directory" | "file"; children?: { name: string; type: "file" | "directory" }[] }[]
}

type VenueTemplateInfo = {
	id: string
	name: string
	type: "ml" | "systems" | "general"
	pageLimit: number
	extraPages: number
	hasChecklist: boolean
	hasBroaderImpact: boolean
	hasLimitations: boolean
}

type DirNode = {
	name: string
	type: "directory" | "file"
	children?: DirNode[]
}

const DIR_TEMPLATES: DirTemplateInfo[] = [
	{
		id: "ml-paper",
		name: "Machine Learning",
		description: "For machine learning and AI conference papers (NeurIPS, ICML, ICLR, etc.)",
		structure: [
			{ name: "task/", type: "directory", children: [{ name: "paper-plan.md", type: "file" }] },
			{ name: "problem/", type: "directory", children: [{ name: "research-questions.md", type: "file" }] },
			{ name: "review/", type: "directory", children: [{ name: "revision-log.md", type: "file" }] },
			{ name: "reference/", type: "directory" },
			{ name: "script/", type: "directory" },
			{ name: "img/", type: "directory" },
			{ name: "experiment/", type: "directory" },
			{ name: "latex/", type: "directory" },
			{ name: "template/", type: "directory" },
		],
	},
	{
		id: "systems-paper",
		name: "Systems",
		description: "For systems research papers (OSDI, SOSP, ASPLOS, NSDI, etc.)",
		structure: [
			{ name: "task/", type: "directory", children: [{ name: "paper-plan.md", type: "file" }] },
			{ name: "problem/", type: "directory", children: [{ name: "research-questions.md", type: "file" }] },
			{ name: "review/", type: "directory", children: [{ name: "revision-log.md", type: "file" }] },
			{ name: "reference/", type: "directory" },
			{ name: "script/", type: "directory" },
			{ name: "img/", type: "directory" },
			{ name: "experiment/", type: "directory" },
			{ name: "latex/", type: "directory" },
			{ name: "template/", type: "directory" },
		],
	},
	{
		id: "general-science",
		name: "General Science",
		description: "Flexible structure for general scientific writing across disciplines",
		structure: [
			{ name: "task/", type: "directory", children: [{ name: "paper-plan.md", type: "file" }] },
			{ name: "problem/", type: "directory", children: [{ name: "research-questions.md", type: "file" }] },
			{ name: "review/", type: "directory", children: [{ name: "revision-log.md", type: "file" }] },
			{ name: "reference/", type: "directory" },
			{ name: "script/", type: "directory" },
			{ name: "img/", type: "directory" },
			{ name: "experiment/", type: "directory" },
			{ name: "latex/", type: "directory" },
			{ name: "template/", type: "directory" },
		],
	},
]

const VENUE_TEMPLATES: VenueTemplateInfo[] = [
	// ML
	{
		id: "neurips2025",
		name: "NeurIPS 2025",
		type: "ml",
		pageLimit: 9,
		extraPages: 0,
		hasChecklist: true,
		hasBroaderImpact: true,
		hasLimitations: false,
	},
	{
		id: "icml2026",
		name: "ICML 2026",
		type: "ml",
		pageLimit: 8,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: true,
		hasLimitations: false,
	},
	{
		id: "iclr2026",
		name: "ICLR 2026",
		type: "ml",
		pageLimit: 9,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "acl",
		name: "ACL",
		type: "ml",
		pageLimit: 8,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: true,
	},
	{
		id: "aaai2026",
		name: "AAAI 2026",
		type: "ml",
		pageLimit: 7,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "colm2025",
		name: "COLM 2025",
		type: "ml",
		pageLimit: 9,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: true,
		hasLimitations: false,
	},
	// Systems
	{
		id: "osdi2026",
		name: "OSDI 2026",
		type: "systems",
		pageLimit: 12,
		extraPages: 2,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "sosp2026",
		name: "SOSP 2026",
		type: "systems",
		pageLimit: 12,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "asplos2027",
		name: "ASPLOS 2027",
		type: "systems",
		pageLimit: 11,
		extraPages: 2,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "nsdi2027",
		name: "NSDI 2027",
		type: "systems",
		pageLimit: 12,
		extraPages: 2,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	// General
	{
		id: "generic",
		name: "Generic LaTeX",
		type: "general",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
]

function getVenueTypeForDir(dirId: string): "ml" | "systems" | null {
	switch (dirId) {
		case "ml-paper":
			return "ml"
		case "systems-paper":
			return "systems"
		default:
			return null
	}
}

export const ProjectCreateForm: React.FC<ProjectCreateFormProps> = ({ onCreated, onCancel }) => {
	const [projectName, setProjectName] = useState("")
	const [description, setDescription] = useState("")
	const [nameError, setNameError] = useState("")
	const [selectedDir, setSelectedDir] = useState(DIR_TEMPLATES[0])
	const [selectedVenue, setSelectedVenue] = useState(VENUE_TEMPLATES[0])
	const [dirDropdownOpen, setDirDropdownOpen] = useState(false)
	const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)
	const [creating, setCreating] = useState(false)

	// Safety timeout: reset creating if backend doesn't respond within 10s
	const creatingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => {
		if (creating) {
			creatingTimeoutRef.current = setTimeout(() => setCreating(false), 10000)
		}
		return () => {
			if (creatingTimeoutRef.current) clearTimeout(creatingTimeoutRef.current)
		}
	}, [creating])

	// Editable directory structure (Phase 5)
	const [editableStructure, setEditableStructure] = useState<DirNode[]>([])

	// Initialize editable structure when selectedDir changes
	useEffect(() => {
		setEditableStructure(structuredClone(selectedDir.structure) as DirNode[])
	}, [selectedDir.id])

	// Filtered venues based on selected directory template
	const availableVenues = useMemo(() => {
		const venueType = getVenueTypeForDir(selectedDir.id)
		if (!venueType) return VENUE_TEMPLATES
		return VENUE_TEMPLATES.filter((v) => v.type === venueType)
	}, [selectedDir.id])

	// Auto-select first matching venue when directory changes
	useEffect(() => {
		if (availableVenues.length > 0 && !availableVenues.find((v) => v.id === selectedVenue.id)) {
			setSelectedVenue(availableVenues[0])
		}
	}, [availableVenues, selectedVenue.id])

	// Group available venues by type (only meaningful when showing all)
	const groupedVenues = useMemo(() => {
		const groups: Record<string, VenueTemplateInfo[]> = {}
		for (const v of availableVenues) {
			const key = v.type
			if (!groups[key]) groups[key] = []
			groups[key].push(v)
		}
		return groups
	}, [availableVenues])

	const handleCreate = useCallback(() => {
		if (!projectName.trim()) {
			setNameError("Project name is required")
			return
		}
		setNameError("")
		setCreating(true)
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectCreate",
			text: projectName.trim(),
			description: description.trim(),
			directoryTemplate: selectedDir.id,
			venueTemplateId: selectedVenue.id,
			customStructure: editableStructure,
		})
		onCreated()
	}, [projectName, description, selectedDir, selectedVenue, editableStructure, onCreated])

	const handleOpenExisting = useCallback(() => {
		vscode.postMessage({
			type: "paperProjectOpen",
			action: "projectOpen",
			text: "",
		})
	}, [])

	// ── Directory structure editing (Phase 5) ──

	const handleAddFolder = useCallback((parentIndex?: number) => {
		const name = prompt("Folder name:")
		if (!name || !name.trim()) return
		const sanitized = name.trim().replace(/[/\\]/g, "")
		const newNode: DirNode = { name: sanitized + "/", type: "directory" }
		setEditableStructure((prev) => {
			const next = [...prev]
			if (parentIndex !== undefined && next[parentIndex]?.type === "directory") {
				const parent = { ...next[parentIndex] }
				parent.children = [...(parent.children || []), newNode]
				next[parentIndex] = parent
			} else {
				next.push(newNode)
			}
			return next
		})
	}, [])

	const handleDeleteFolder = useCallback((index: number, childIndex?: number) => {
		setEditableStructure((prev) => {
			const next = [...prev]
			if (childIndex !== undefined && next[index]?.type === "directory") {
				const parent = { ...next[index] }
				parent.children = (parent.children || []).filter((_, i) => i !== childIndex)
				next[index] = parent
			} else {
				const node = prev[index]
				if (!confirm(`Delete "${node.name}"?`)) return prev
				return prev.filter((_, i) => i !== index)
			}
			return next
		})
	}, [])

	const handleRenameFolder = useCallback((index: number, childIndex?: number) => {
		setEditableStructure((prev) => {
			const next = [...prev]
			const target =
				childIndex !== undefined && next[index]?.children ? next[index].children[childIndex] : next[index]
			if (!target) return prev
			const currentName = target.name.replace(/\/$/, "")
			const name = prompt("New name:", currentName)
			if (!name || !name.trim()) return prev
			const sanitized = name.trim().replace(/[/\\]/g, "")
			const newName = target.type === "directory" ? sanitized + "/" : sanitized
			if (childIndex !== undefined && next[index].children) {
				const parent = { ...next[index] }
				const children = [...(parent.children || [])]
				children[childIndex] = { ...children[childIndex], name: newName }
				parent.children = children
				next[index] = parent
			} else {
				next[index] = { ...next[index], name: newName }
			}
			return next
		})
	}, [])

	const venueTypeLabel = (type: string) => {
		switch (type) {
			case "ml":
				return "ML Conferences"
			case "systems":
				return "Systems Conferences"
			default:
				return "General"
		}
	}

	const showVenueGroups = Object.keys(groupedVenues).length > 1

	return (
		<div className="max-w-lg mx-auto p-6 space-y-5">
			<div className="text-center mb-4">
				<BookOpen className="w-10 h-10 mx-auto mb-2 text-primary opacity-80" />
				<h2 className="text-lg font-semibold">Create Research Project</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Set up a structured research project with a target venue template and directory skeleton.
				</p>
			</div>

			{/* Project Name */}
			<div className="space-y-1.5">
				<label className="text-sm font-medium">Project Name</label>
				<Input
					placeholder="e.g. Transformer Study"
					value={projectName}
					onChange={(e) => {
						setProjectName(e.target.value)
						if (nameError) setNameError("")
					}}
					onKeyDown={(e) => e.key === "Enter" && handleCreate()}
				/>
				{nameError && (
					<p className="text-xs text-red-500 flex items-center gap-1">
						<AlertTriangle className="w-3 h-3" />
						{nameError}
					</p>
				)}
			</div>

			{/* Project Description */}
			<div className="space-y-1.5">
				<label className="text-sm font-medium">Description</label>
				<textarea
					className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none h-20"
					placeholder="Brief description of your research project..."
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</div>

			{/* Research Domain (formerly Directory Template) */}
			<div className="space-y-1.5">
				<label className="text-sm font-medium">Research Domain</label>
				<div className="relative">
					<button
						type="button"
						className="w-full flex items-center justify-between px-3 py-2 border rounded-md bg-background text-sm hover:bg-muted/50 transition-colors"
						onClick={() => {
							setDirDropdownOpen(!dirDropdownOpen)
							setVenueDropdownOpen(false)
						}}>
						<span className="flex items-center gap-2">
							<Folder className="w-4 h-4 text-muted-foreground" />
							{selectedDir.name}
						</span>
						<ChevronDown className="w-4 h-4 text-muted-foreground" />
					</button>
					{dirDropdownOpen && (
						<div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-20">
							{DIR_TEMPLATES.map((t) => (
								<button
									key={t.id}
									type="button"
									className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedDir.id === t.id ? "bg-primary/10 text-primary font-medium" : ""}`}
									onClick={() => {
										setSelectedDir(t)
										setDirDropdownOpen(false)
									}}>
									<div className="flex items-center justify-between">
										<span>{t.name}</span>
										<span className="text-xs text-muted-foreground">{t.id}</span>
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Editable Directory Structure Preview (Phase 5) */}
				<div className="mt-2 p-3 rounded-md bg-muted/30 border text-xs space-y-0.5">
					<div className="flex items-center justify-between mb-1">
						<p className="text-muted-foreground font-medium">Directory structure:</p>
						<button
							type="button"
							className="text-[10px] text-primary hover:underline"
							onClick={() => handleAddFolder()}>
							+ Add folder
						</button>
					</div>
					{editableStructure.map((node, i) => (
						<div key={`${node.name}-${i}`}>
							<div className="flex items-center gap-1.5 pl-2 group hover:bg-muted/50 rounded py-0.5 -ml-1">
								{node.type === "directory" ? (
									<Folder className="w-3 h-3 text-amber-500 shrink-0" />
								) : (
									<FileText className="w-3 h-3 text-blue-500 shrink-0" />
								)}
								<span className="font-mono flex-1 truncate">{node.name}</span>
								<div className="hidden group-hover:flex items-center gap-0.5">
									<button
										type="button"
										className="text-muted-foreground hover:text-foreground p-0.5"
										onClick={(e) => {
											e.stopPropagation()
											handleRenameFolder(i)
										}}
										title="Rename">
										<Edit2 className="w-2.5 h-2.5" />
									</button>
									{node.type === "directory" && (
										<button
											type="button"
											className="text-muted-foreground hover:text-foreground p-0.5"
											onClick={(e) => {
												e.stopPropagation()
												handleAddFolder(i)
											}}
											title="Add subfolder">
											<Plus className="w-2.5 h-2.5" />
										</button>
									)}
									<button
										type="button"
										className="text-muted-foreground hover:text-red-500 p-0.5"
										onClick={(e) => {
											e.stopPropagation()
											handleDeleteFolder(i)
										}}
										title="Delete">
										<X className="w-2.5 h-2.5" />
									</button>
								</div>
							</div>
							{/* Nested children */}
							{node.children?.map((child, ci) => (
								<div
									key={`${child.name}-${ci}`}
									className="flex items-center gap-1.5 pl-6 group hover:bg-muted/50 rounded py-0.5 -ml-1">
									{child.type === "directory" ? (
										<Folder className="w-3 h-3 text-amber-500 shrink-0" />
									) : (
										<FileText className="w-3 h-3 text-blue-500 shrink-0" />
									)}
									<span className="font-mono flex-1 truncate">{child.name}</span>
									<div className="hidden group-hover:flex items-center gap-0.5">
										<button
											type="button"
											className="text-muted-foreground hover:text-foreground p-0.5"
											onClick={(e) => {
												e.stopPropagation()
												handleRenameFolder(i, ci)
											}}
											title="Rename">
											<Edit2 className="w-2.5 h-2.5" />
										</button>
										<button
											type="button"
											className="text-muted-foreground hover:text-red-500 p-0.5"
											onClick={(e) => {
												e.stopPropagation()
												handleDeleteFolder(i, ci)
											}}
											title="Delete">
											<X className="w-2.5 h-2.5" />
										</button>
									</div>
								</div>
							))}
						</div>
					))}
					<div className="flex items-center gap-1.5 pl-2 text-muted-foreground">
						<Folder className="w-3 h-3 text-amber-500" />
						<span className="font-mono">.roo/</span>
					</div>
				</div>
			</div>

			{/* Target Venue (formerly Venue Template) */}
			<div className="space-y-1.5">
				<label className="text-sm font-medium">Target Venue</label>
				<div className="relative">
					<button
						type="button"
						className="w-full flex items-center justify-between px-3 py-2 border rounded-md bg-background text-sm hover:bg-muted/50 transition-colors"
						onClick={() => {
							setVenueDropdownOpen(!venueDropdownOpen)
							setDirDropdownOpen(false)
						}}>
						<span className="flex items-center gap-2">
							<FileText className="w-4 h-4 text-muted-foreground" />
							{selectedVenue.name}
							{selectedVenue.pageLimit > 0 && (
								<span className="text-xs text-muted-foreground">
									({selectedVenue.pageLimit}p
									{selectedVenue.extraPages > 0 ? ` + ${selectedVenue.extraPages}p extra` : ""})
								</span>
							)}
						</span>
						<ChevronDown className="w-4 h-4 text-muted-foreground" />
					</button>
					{venueDropdownOpen && (
						<div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-20 max-h-80 overflow-auto">
							{showVenueGroups
								? // Show grouped by type when no domain filter
									Object.entries(groupedVenues).map(([type, venues], gi) => (
										<React.Fragment key={type}>
											{gi > 0 && <div className="border-t" />}
											<div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
												{venueTypeLabel(type)}
											</div>
											{venues.map((v) => (
												<button
													key={v.id}
													type="button"
													className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedVenue.id === v.id ? "bg-primary/10 text-primary font-medium" : ""}`}
													onClick={() => {
														setSelectedVenue(v)
														setVenueDropdownOpen(false)
													}}>
													<div className="flex items-center justify-between">
														<span>{v.name}</span>
														<span className="text-xs text-muted-foreground">
															{v.pageLimit > 0
																? `${v.pageLimit}p${v.extraPages > 0 ? `+${v.extraPages}` : ""}`
																: "unlimited"}
														</span>
													</div>
													<div className="flex items-center gap-2 mt-0.5">
														{v.hasChecklist && (
															<span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
																checklist
															</span>
														)}
														{v.hasBroaderImpact && (
															<span className="text-[10px] px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
																broader impact
															</span>
														)}
														{v.hasLimitations && (
															<span className="text-[10px] px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
																limitations
															</span>
														)}
													</div>
												</button>
											))}
										</React.Fragment>
									))
								: // Flat list when filtered by domain
									availableVenues.map((v) => (
										<button
											key={v.id}
											type="button"
											className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedVenue.id === v.id ? "bg-primary/10 text-primary font-medium" : ""}`}
											onClick={() => {
												setSelectedVenue(v)
												setVenueDropdownOpen(false)
											}}>
											<div className="flex items-center justify-between">
												<span>{v.name}</span>
												<span className="text-xs text-muted-foreground">
													{v.pageLimit > 0
														? `${v.pageLimit}p${v.extraPages > 0 ? `+${v.extraPages}` : ""}`
														: "unlimited"}
												</span>
											</div>
											<div className="flex items-center gap-2 mt-0.5">
												{v.hasChecklist && (
													<span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
														checklist
													</span>
												)}
												{v.hasBroaderImpact && (
													<span className="text-[10px] px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
														broader impact
													</span>
												)}
												{v.hasLimitations && (
													<span className="text-[10px] px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
														limitations
													</span>
												)}
											</div>
										</button>
									))}
						</div>
					)}
				</div>
			</div>

			{/* Action Buttons */}
			<div className="flex gap-3 pt-2">
				<Button
					variant="primary"
					className="flex-1"
					disabled={!projectName.trim() || creating}
					onClick={handleCreate}>
					<Plus className="w-4 h-4 mr-1.5" />
					{creating ? "Creating..." : "Create Project"}
				</Button>
				<Button variant="outline" className="flex-1" onClick={handleOpenExisting}>
					<FolderOpen className="w-4 h-4 mr-1.5" />
					Open Existing
				</Button>
				{onCancel && (
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				)}
			</div>
		</div>
	)
}

export default React.memo(ProjectCreateForm)
