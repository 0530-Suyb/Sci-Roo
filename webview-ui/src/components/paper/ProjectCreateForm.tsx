import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, BookOpen, ChevronDown, Info, Sparkles } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type ProjectCreateFormProps = {
	onSubmitted?: () => void
	onCancel?: () => void
	compactRootOnly?: boolean
}

type DirNode = {
	name: string
	type: "directory" | "file"
	children?: DirNode[]
}

type DirTemplateInfo = {
	id: string
	name: string
	description: string
	structure: DirNode[]
}

type VenueTemplateInfo = {
	id: string
	name: string
	type: "ml" | "systems" | "general" | "ieee"
	pageLimit: number
	extraPages: number
	hasChecklist: boolean
	hasBroaderImpact: boolean
	hasLimitations: boolean
}

const DIR_TEMPLATES: DirTemplateInfo[] = [
	{
		id: "ml-paper",
		name: "Machine Learning",
		description: "For ML, NLP, LLM, and AI conference workflows.",
		structure: [
			{ name: "task", type: "directory", children: [{ name: "paper-plan.md", type: "file" }] },
			{ name: "problem", type: "directory", children: [{ name: "research-questions.md", type: "file" }] },
			{ name: "review", type: "directory", children: [{ name: "revision-log.md", type: "file" }] },
			{ name: "reference", type: "directory" },
			{ name: "script", type: "directory" },
			{ name: "img", type: "directory" },
			{ name: "experiment", type: "directory" },
			{ name: "latex", type: "directory" },
			{ name: "template", type: "directory" },
		],
	},
	{
		id: "systems-paper",
		name: "Systems",
		description: "For systems, architecture, performance, and infrastructure papers.",
		structure: [
			{ name: "task", type: "directory", children: [{ name: "paper-plan.md", type: "file" }] },
			{ name: "problem", type: "directory", children: [{ name: "research-questions.md", type: "file" }] },
			{ name: "review", type: "directory", children: [{ name: "revision-log.md", type: "file" }] },
			{ name: "reference", type: "directory" },
			{ name: "script", type: "directory" },
			{ name: "img", type: "directory" },
			{ name: "experiment", type: "directory" },
			{ name: "latex", type: "directory" },
			{ name: "template", type: "directory" },
		],
	},
	{
		id: "general-science",
		name: "General Science",
		description: "A flexible structure for cross-disciplinary scientific writing.",
		structure: [
			{ name: "task", type: "directory", children: [{ name: "paper-plan.md", type: "file" }] },
			{ name: "problem", type: "directory", children: [{ name: "research-questions.md", type: "file" }] },
			{ name: "review", type: "directory", children: [{ name: "revision-log.md", type: "file" }] },
			{ name: "reference", type: "directory" },
			{ name: "script", type: "directory" },
			{ name: "img", type: "directory" },
			{ name: "experiment", type: "directory" },
			{ name: "latex", type: "directory" },
			{ name: "template", type: "directory" },
		],
	},
]

const VENUE_TEMPLATES: VenueTemplateInfo[] = [
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
	{
		id: "ieee-icc",
		name: "IEEE ICC",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-globecom",
		name: "IEEE GLOBECOM",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-wcnc",
		name: "IEEE WCNC",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-pimrc",
		name: "IEEE PIMRC",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-iotj",
		name: "IEEE Internet of Things Journal (IoTJ)",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-tcom",
		name: "IEEE Transactions on Communications (TCOM)",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-twc",
		name: "IEEE Transactions on Wireless Communications (TWC)",
		type: "ieee",
		pageLimit: 0,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
	{
		id: "ieee-jsac",
		name: "IEEE JSAC",
		type: "ieee",
		pageLimit: 13,
		extraPages: 0,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
	},
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

const DIRECTORY_EXPLANATIONS: Record<string, string> = {
	task: "Paper plan, section sketch, and writing notes after the problem is clarified.",
	problem: "Research questions, hypotheses, and problem formulation.",
	review: "Reviewer feedback, revision history, and response notes.",
	reference: "Structured metadata and PDFs for cited or candidate papers.",
	script: "Analysis, preprocessing, and reproducible experiment scripts.",
	img: "Figures, diagrams, and rendered visual assets for the paper.",
	experiment: "Configs, result tables, logs, and experiment notes.",
	latex: "Your working LaTeX manuscript, references.bib, snapshots, and compile targets.",
	template: "Venue-provided class/style files copied at project creation.",
	".roo": "Sci-Roo project state, rules, and paper-writing skills.",
}

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

export const ProjectCreateForm: React.FC<ProjectCreateFormProps> = ({
	onSubmitted,
	onCancel,
	compactRootOnly = false,
}) => {
	const [projectName, setProjectName] = useState("")
	const [description, setDescription] = useState("")
	const [nameError, setNameError] = useState("")
	const [selectedDir, setSelectedDir] = useState(DIR_TEMPLATES[0])
	const [selectedVenue, setSelectedVenue] = useState(VENUE_TEMPLATES[0])
	const [dirDropdownOpen, setDirDropdownOpen] = useState(false)
	const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)
	const [submittingMode, setSubmittingMode] = useState<"create" | null>(null)
	const submitTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

	useEffect(() => {
		if (!submittingMode) {
			return
		}
		submitTimeoutRef.current = setTimeout(() => setSubmittingMode(null), 15000)
		return () => {
			if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current)
		}
	}, [submittingMode])

	const availableVenues = useMemo(() => {
		const venueType = getVenueTypeForDir(selectedDir.id)
		if (!venueType) {
			return [...VENUE_TEMPLATES.filter((venue) => venue.type === "general" || venue.type === "ieee")].sort(
				(a, b) => {
					if (a.id === "generic") return -1
					if (b.id === "generic") return 1
					return a.name.localeCompare(b.name)
				},
			)
		}
		return VENUE_TEMPLATES.filter((venue) => venue.type === venueType)
	}, [selectedDir.id])

	useEffect(() => {
		if (!availableVenues.find((venue) => venue.id === selectedVenue.id)) {
			setSelectedVenue(availableVenues[0])
		}
	}, [availableVenues, selectedVenue.id])

	const structurePreview = useMemo(
		() => [...selectedDir.structure, { name: ".roo", type: "directory" as const }],
		[selectedDir],
	)

	const handleCreate = useCallback(() => {
		if (!projectName.trim()) {
			setNameError("Project name is required")
			return
		}

		setNameError("")
		setSubmittingMode("create")
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "projectCreate",
			text: projectName.trim(),
			description: description.trim(),
			directoryTemplate: selectedDir.id,
			venueTemplateId: selectedVenue.id,
			customStructure: selectedDir.structure,
		})
		onSubmitted?.()
	}, [description, onSubmitted, projectName, selectedDir, selectedVenue])

	const disabled = submittingMode !== null
	const introTitle = compactRootOnly ? "Create a project in the current VS Code root" : "Set up a paper workspace"
	const introCopy = compactRootOnly
		? "Sci-Roo will initialize the folder currently opened in VS Code, create the research structure, and prepare the writing workspace in place."
		: "Choose a research workflow, match it to your target venue, and start with a clean writing structure that fits how researchers actually work."
	const prepCopy = compactRootOnly
		? "Sci-Roo will create the project skeleton directly in the current VS Code root, copy the venue template into `template/`, initialize `latex/main.tex`, and attach the matching writing rules and skills under `.roo/`."
		: "Sci-Roo will create a project skeleton, copy the venue template into `template/`, initialize `latex/main.tex`, and attach the matching writing rules and skills under `.roo/`."

	return (
		<div className="mx-auto max-w-4xl p-6">
			<div className="mb-6 text-center">
				<BookOpen className="mx-auto mb-3 h-11 w-11 text-primary opacity-80" />
				<h2 className="text-xl font-semibold">{introTitle}</h2>
				<p className="mt-2 text-sm text-muted-foreground">{introCopy}</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<div className="space-y-5">
					<div className="space-y-1.5">
						<label className="text-sm font-medium">Project name</label>
						<Input
							placeholder="e.g. Retrieval-Augmented Reasoning Study"
							value={projectName}
							onChange={(e) => {
								setProjectName(e.target.value)
								if (nameError) setNameError("")
							}}
							onKeyDown={(e) => e.key === "Enter" && handleCreate()}
						/>
						{nameError && (
							<p className="flex items-center gap-1 text-xs text-red-500">
								<AlertTriangle className="h-3 w-3" />
								{nameError}
							</p>
						)}
					</div>

					<div className="space-y-1.5">
						<label className="text-sm font-medium">Research summary</label>
						<textarea
							className="h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
							placeholder="Describe the project background, target problem space, and what you already know so Sci-Roo can frame the research questions."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div className="rounded-xl border bg-card p-4">
						<div className="mb-3 flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-primary" />
							<h3 className="text-sm font-semibold">Research workflow setup</h3>
						</div>

						<div className="space-y-4">
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Research domain</label>
								<div className="relative">
									<button
										type="button"
										className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
										onClick={() => {
											setDirDropdownOpen((open) => !open)
											setVenueDropdownOpen(false)
										}}>
										<div className="text-left">
											<div>{selectedDir.name}</div>
											<div className="text-xs text-muted-foreground">
												{selectedDir.description}
											</div>
										</div>
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									</button>
									{dirDropdownOpen && (
										<div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover shadow-md">
											{DIR_TEMPLATES.map((template) => (
												<button
													key={template.id}
													type="button"
													className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${selectedDir.id === template.id ? "bg-primary/10 text-primary" : ""}`}
													onClick={() => {
														setSelectedDir(template)
														setDirDropdownOpen(false)
													}}>
													<div className="font-medium">{template.name}</div>
													<div className="text-xs text-muted-foreground">
														{template.description}
													</div>
												</button>
											))}
										</div>
									)}
								</div>
							</div>

							<div className="space-y-1.5">
								<label className="text-sm font-medium">Target venue</label>
								<div className="relative">
									<button
										type="button"
										className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
										onClick={() => {
											setVenueDropdownOpen((open) => !open)
											setDirDropdownOpen(false)
										}}>
										<div className="text-left">
											<div>{selectedVenue.name}</div>
											<div className="text-xs text-muted-foreground">
												{selectedVenue.pageLimit > 0
													? `${selectedVenue.pageLimit} pages${selectedVenue.extraPages > 0 ? ` + ${selectedVenue.extraPages} extra` : ""}`
													: "No fixed page cap"}
											</div>
										</div>
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									</button>
									{venueDropdownOpen && (
										<div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-md border bg-popover shadow-md">
											{availableVenues.map((venue) => (
												<button
													key={venue.id}
													type="button"
													className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${selectedVenue.id === venue.id ? "bg-primary/10 text-primary" : ""}`}
													onClick={() => {
														setSelectedVenue(venue)
														setVenueDropdownOpen(false)
													}}>
													<div className="flex items-center justify-between gap-2">
														<span className="font-medium">{venue.name}</span>
														<span className="text-xs text-muted-foreground">
															{venue.pageLimit > 0 ? `${venue.pageLimit}p` : "open"}
														</span>
													</div>
													<div className="mt-1 flex flex-wrap gap-1">
														{venue.hasChecklist && (
															<span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
																checklist
															</span>
														)}
														{venue.hasBroaderImpact && (
															<span className="rounded bg-blue-100 px-1 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
																broader impact
															</span>
														)}
														{venue.hasLimitations && (
															<span className="rounded bg-red-100 px-1 text-[10px] text-red-700 dark:bg-red-900/30 dark:text-red-400">
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
						</div>
					</div>

					<div className="rounded-xl border bg-muted/20 p-4 text-sm">
						<div className="mb-2 flex items-center gap-2 font-medium">
							<Info className="h-4 w-4 text-primary" />
							What Sci-Roo will prepare
						</div>
						<p className="text-muted-foreground">{prepCopy}</p>
					</div>
				</div>

				<div className="space-y-4">
					<div className="rounded-xl border bg-card p-4">
						<div className="mb-3 flex items-center justify-between">
							<h3 className="text-sm font-semibold">Project directory preview</h3>
							<span className="text-xs text-muted-foreground">{selectedDir.name}</span>
						</div>
						<div className="space-y-2">
							{structurePreview.map((node) => (
								<div key={node.name} className="rounded-lg border bg-background/80 p-2.5">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-mono text-xs">{node.name}/</div>
											<div className="mt-1 text-xs text-muted-foreground">
												{DIRECTORY_EXPLANATIONS[node.name] ?? "Project workspace directory."}
											</div>
										</div>
										<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
											dir
										</span>
									</div>
									{node.children && node.children.length > 0 && (
										<div className="mt-2 border-t pt-2">
											{node.children.map((child) => (
												<div
													key={child.name}
													className="font-mono text-[11px] text-muted-foreground">
													{node.name}/{child.name}
												</div>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="flex gap-3">
						<Button
							variant="primary"
							className="flex-1"
							disabled={disabled || !projectName.trim()}
							onClick={handleCreate}>
							{submittingMode === "create" ? "Creating..." : "Create Project"}
						</Button>
					</div>

					{onCancel && (
						<div className="flex justify-end">
							<Button variant="ghost" disabled={disabled} onClick={onCancel}>
								Cancel
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default React.memo(ProjectCreateForm)
