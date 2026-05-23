import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type {
	PaperProject,
	PaperProjectStage,
	DirectoryTemplate,
	DirectoryNode,
	PaperWritingState,
	SectionConfig,
	SectionType,
} from "@roo-code/types"
import { PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME } from "@roo-code/types"
import { getDirectoryTemplate, getVenueTemplate } from "./paperConfig"
import { VenueTemplateManager } from "./VenueTemplateManager"

/**
 * Manages paper project lifecycle — creation, detection, loading,
 * directory skeleton generation, template copying, and venue switching.
 */
export class PaperProjectManager {
	private providerRef: WeakRef<ClineProvider>
	private currentProject: PaperProject | undefined
	private venueTemplateManager: VenueTemplateManager
	private extensionPath: string

	private static readonly REVISION_LOG_TEMPLATE = `# Revision Log

## Submission Context

- Target venue:
- Round: initial submission / rebuttal / revision / camera-ready
- Decision status:
- Snapshot before revision:

## Revision Priorities

- [ ] Re-check abstract and introduction framing after all edits
- [ ] Verify every new claim has citation or experiment support
- [ ] Update figures / tables / appendix if the response changes the story

## Reviewer Comments

### R1-C1
- Status: open
- Priority: major
- Section: introduction
- Source: Reviewer 1
- Comment: Clarify the paper's main contribution and scope.
- Action: Tighten the motivation paragraph and rewrite the contribution bullets.
- Response: Pending.

### R2-C1
- Status: open
- Priority: minor
- Section: methods
- Source: Reviewer 2
- Comment: Add implementation details needed for reproducibility.
- Action: Expand training, hyperparameter, and environment details.
- Response: Pending.
`

	constructor(provider: ClineProvider, extensionPath: string) {
		this.providerRef = new WeakRef(provider)
		this.extensionPath = extensionPath
		this.venueTemplateManager = new VenueTemplateManager(extensionPath)
	}

	private get provider(): ClineProvider | undefined {
		return this.providerRef.deref()
	}

	private get cwd(): string | undefined {
		return this.provider?.cwd
	}

	getProjectRoot(): string | undefined {
		return this.currentProject?.rootPath ?? this.cwd
	}

	getPrimaryManuscriptRelativePath(project: PaperProject | undefined = this.currentProject): string | undefined {
		if (!project) {
			return undefined
		}
		return project.primaryManuscriptPath || path.join("latex", "main.tex")
	}

	getPrimaryManuscriptAbsolutePath(project: PaperProject | undefined = this.currentProject): string | undefined {
		if (!project) {
			return undefined
		}
		return path.join(project.rootPath, this.getPrimaryManuscriptRelativePath(project)!)
	}

	// ─── Accessors ──────────────────────────────────────────────────────

	getCurrentProject(): PaperProject | undefined {
		return this.currentProject
	}

	getVenueManager(): VenueTemplateManager {
		return this.venueTemplateManager
	}

	// ─── Auto-Detect ────────────────────────────────────────────────────

	/**
	 * Scan the workspace for .roo/project.json and load if found.
	 */
	async autoDetect(): Promise<PaperProject | undefined> {
		const cwd = this.cwd
		if (!cwd) return undefined

		const candidates = [path.join(cwd, PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME)]

		for (const projectPath of candidates) {
			try {
				const raw = await fs.readFile(projectPath, "utf-8")
				this.currentProject = await this.normalizeProject(JSON.parse(raw) as PaperProject)
				return this.currentProject
			} catch {
				// Try next candidate.
			}
		}

		return undefined
	}

	// ─── Project CRUD ───────────────────────────────────────────────────

	async createProject(params: {
		name: string
		description?: string
		directoryTemplate: string
		venueTemplateId: string
		customStructure?: DirectoryNode[]
	}): Promise<PaperProject> {
		const cwd = this.cwd
		if (!cwd) throw new Error("No workspace directory")

		// Detect if workspace is non-empty → create in subdirectory
		const projectFilePath = path.join(cwd, PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME)
		if (await this.exists(projectFilePath)) {
			throw new Error("This VS Code root is already initialized as a Sci-Roo project")
		}

		const rootPath = cwd

		// Get template configs
		const dirTemplate = getDirectoryTemplate(params.directoryTemplate)
		const venueTemplate = getVenueTemplate(params.venueTemplateId)

		if (!dirTemplate) {
			throw new Error(`Directory template '${params.directoryTemplate}' not found`)
		}
		if (!venueTemplate) {
			throw new Error(`Venue template '${params.venueTemplateId}' not found`)
		}

		// Create directory skeleton (use custom structure if provided)
		const effectiveTemplate: DirectoryTemplate = params.customStructure
			? { ...dirTemplate, structure: params.customStructure }
			: dirTemplate
		await this.createDirectorySkeleton(rootPath, effectiveTemplate)

		// Copy venue template files to template/
		const templateDir = path.join(rootPath, "template")
		await this.venueTemplateManager.copyTemplateToProject(params.venueTemplateId, templateDir)

		// Write template README
		await this.writeTemplateReadme(templateDir, venueTemplate.name, params.venueTemplateId)

		// Create latex/ structure
		await this.initLatexStructure(rootPath, params.venueTemplateId)
		// Copy skills to .roo/skills/
		const copiedSkills = await this.venueTemplateManager.copySkillsToProject(params.venueTemplateId, rootPath)
		if (copiedSkills.length > 0) {
			this.provider?.log(`Copied skills: ${copiedSkills.join(", ")}`)
		}

		// Copy rules to .roo/rules-sci-paper-writing/
		const copiedRules = await this.venueTemplateManager.copyRulesToProject(params.directoryTemplate, rootPath)
		if (copiedRules.length > 0) {
			this.provider?.log(`Copied rules: ${copiedRules.join(", ")}`)
		}

		// Create .roo/project.json
		const now = new Date().toISOString()
		const project: PaperProject = {
			id: `proj_${Date.now()}`,
			name: params.name,
			description: params.description || "",
			rootPath,
			primaryManuscriptPath: path.join("latex", "main.tex"),
			templateId: params.venueTemplateId,
			templateSource: "builtin",
			directoryTemplate: params.directoryTemplate,
			stage: "planning",
			createdAt: now,
			updatedAt: now,
		}

		await this.saveProject(rootPath, project)
		await this.seedResearchPlanningFiles(project)
		this.currentProject = project

		this.provider?.log(`Paper project '${params.name}' created with template '${params.venueTemplateId}'`)

		return project
	}

	async openProject(rootPath: string): Promise<PaperProject> {
		const projectPath = path.join(rootPath, PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME)
		try {
			const raw = await fs.readFile(projectPath, "utf-8")
			this.currentProject = await this.normalizeProject(JSON.parse(raw) as PaperProject)
			return this.currentProject
		} catch {
			throw new Error(`No project found at ${rootPath}`)
		}
	}

	async updateStage(stage: PaperProjectStage): Promise<void> {
		if (!this.currentProject) throw new Error("No active project")
		this.currentProject.stage = stage
		this.currentProject.updatedAt = new Date().toISOString()
		await this.saveCurrentProject()
	}

	async updateSectionConfig(
		sectionType: SectionType,
		config: Partial<{
			label: string
			targetWordRange: [number, number]
			status: "outline" | "draft" | "revised" | "final"
		}>,
	): Promise<PaperProject> {
		if (!this.currentProject) {
			throw new Error("No active project")
		}

		const currentConfigs = this.currentProject.customSectionConfigs ?? {}
		const nextConfig = {
			...(currentConfigs[sectionType] ?? {}),
			...config,
		}

		this.currentProject.customSectionConfigs = {
			...currentConfigs,
			[sectionType]: nextConfig,
		}
		this.currentProject.updatedAt = new Date().toISOString()
		await this.saveCurrentProject()
		return this.currentProject
	}

	async saveCurrentProject(): Promise<void> {
		if (!this.currentProject) {
			throw new Error("No active project")
		}
		await this.saveProject(this.currentProject.rootPath, this.currentProject)
	}

	async ensureRevisionLogTemplate(): Promise<string> {
		if (!this.currentProject) {
			throw new Error("No active project")
		}

		const revisionLogPath = path.join(this.currentProject.rootPath, "review", "revision-log.md")
		let currentContent = ""

		try {
			currentContent = await fs.readFile(revisionLogPath, "utf-8")
		} catch {
			await fs.mkdir(path.dirname(revisionLogPath), { recursive: true })
		}

		const normalized = currentContent.trim()
		if (!normalized || normalized === "# Revision Log") {
			await fs.writeFile(revisionLogPath, PaperProjectManager.REVISION_LOG_TEMPLATE, "utf-8")
		}

		return revisionLogPath
	}

	// ─── Directory Skeleton ──────────────────────────────────────────────

	private async createDirectorySkeleton(rootPath: string, dirTemplate: DirectoryTemplate): Promise<void> {
		for (const node of dirTemplate.structure) {
			const nodePath = path.join(rootPath, node.name)
			if (node.type === "directory") {
				await fs.mkdir(nodePath, { recursive: true })
				if (node.children) {
					for (const child of node.children) {
						if (child.type === "file") {
							const childPath = path.join(nodePath, child.name)
							await fs.writeFile(childPath, child.template ?? "", "utf-8")
						} else if (child.type === "directory") {
							await fs.mkdir(path.join(nodePath, child.name), { recursive: true })
						}
					}
				}
			}
		}
		// Ensure .roo/ directory exists
		await fs.mkdir(path.join(rootPath, PAPER_PROJECT_DIR), { recursive: true })
	}

	private async initLatexStructure(rootPath: string, templateId: string): Promise<void> {
		const latexDir = path.join(rootPath, "latex")
		await fs.mkdir(path.join(latexDir, "snapshots"), { recursive: true })

		const manuscriptPath = path.join(latexDir, "main.tex")
		const referencesPath = path.join(latexDir, "references.bib")
		const templateMainPath = path.join(rootPath, "template", "main.tex")

		if (!(await this.exists(manuscriptPath))) {
			if (await this.exists(templateMainPath)) {
				await fs.copyFile(templateMainPath, manuscriptPath)
			} else {
				await fs.writeFile(manuscriptPath, this.getFallbackMainTex(templateId), "utf-8")
			}
		}

		if (!(await this.exists(referencesPath))) {
			await fs.writeFile(
				referencesPath,
				"% Add verified BibTeX entries here or use Sci-Roo to generate this file.\n",
				"utf-8",
			)
		}
	}

	private async writeTemplateReadme(templateDir: string, venueName: string, templateId: string): Promise<void> {
		const venue = getVenueTemplate(templateId)
		const readme = [
			`# ${venueName} Template`,
			"",
			`- **Source**: ${venue?.type === "systems" ? "Systems" : venue?.type === "ml" ? "ML" : "General"}`,
			`- **Page Limit**: ${venue?.pageLimit ? `${venue.pageLimit} pages` : "Unlimited"}`,
			venue?.extraPages ? `- **Extra Pages (Camera-ready)**: +${venue.extraPages}` : "",
			`- **Citation Style**: ${venue?.citationStyle ?? "natbib"}`,
			venue?.hasChecklist ? "- **Checklist**: Required" : "",
			venue?.hasBroaderImpact ? "- **Broader Impact Statement**: Required" : "",
			venue?.hasLimitations ? "- **Limitations Section**: Required" : "",
			"",
			"This template was copied when the project was created. Do not modify these files directly — work in `latex/` instead.",
		]
			.filter(Boolean)
			.join("\n")

		await fs.writeFile(path.join(templateDir, "README.md"), readme, "utf-8")
	}

	private async seedResearchPlanningFiles(project: PaperProject): Promise<void> {
		const description = project.description?.trim() ?? ""
		const problemPath = path.join(project.rootPath, "problem", "research-questions.md")
		const taskPath = path.join(project.rootPath, "task", "paper-plan.md")

		const problemContent = [
			"# Research Questions",
			"",
			"## Project Background",
			"",
			description || "Add the project description here before clarifying the research problem.",
			"",
			"## Problem Framing Notes",
			"",
			"- Research context:",
			"- Concrete pain point:",
			"- Who is affected:",
			"- What is missing in current understanding or practice:",
			"- Constraints and assumptions:",
			"",
			"## Candidate Research Questions",
			"",
			"- RQ1:",
			"- RQ2:",
			"",
		].join("\n")

		const taskContent = [
			"# Paper Plan",
			"",
			"Start this file after the research problem is clarified in `problem/research-questions.md`.",
			"",
			"## Planning Status",
			"",
			"- Current status: waiting for research problem framing",
			"- Source context: `problem/research-questions.md`",
			"",
			"## Early Notes",
			"",
			"- Tentative title direction:",
			"- Expected claims:",
			"- Evidence still needed:",
			"",
		].join("\n")

		await fs.mkdir(path.dirname(problemPath), { recursive: true })
		await fs.mkdir(path.dirname(taskPath), { recursive: true })
		await fs.writeFile(problemPath, problemContent, "utf-8")
		await fs.writeFile(taskPath, taskContent, "utf-8")
	}

	// ─── Venue Template Switching ────────────────────────────────────────

	/**
	 * Preview what would change when switching venue templates.
	 * Returns diff of sections: added, removed, kept.
	 */
	async previewVenueSwitch(newTemplateId: string): Promise<{
		added: SectionConfig[]
		removed: SectionConfig[]
		kept: SectionConfig[]
	}> {
		if (!this.currentProject) throw new Error("No active project")

		const oldVenue = getVenueTemplate(this.currentProject.templateId)
		const newVenue = getVenueTemplate(newTemplateId)
		if (!newVenue) throw new Error(`Template '${newTemplateId}' not found`)

		const oldTypes = new Set(oldVenue?.sectionConfigs.map((s) => s.type) ?? [])
		const newTypes = new Set(newVenue.sectionConfigs.map((s) => s.type))

		const added = newVenue.sectionConfigs.filter((s) => !oldTypes.has(s.type))
		const removed = (oldVenue?.sectionConfigs ?? []).filter((s) => !newTypes.has(s.type))
		const kept = newVenue.sectionConfigs.filter((s) => oldTypes.has(s.type))

		return { added, removed, kept }
	}

	async switchVenue(newTemplateId: string): Promise<void> {
		if (!this.currentProject) throw new Error("No active project")

		await this.previewVenueSwitch(newTemplateId)

		// Copy new template files
		const templateDir = path.join(this.currentProject.rootPath, "template")

		// Clear old template files (except README.md which we'll overwrite)
		const oldFiles = await fs.readdir(templateDir)
		for (const f of oldFiles) {
			if (f === "README.md") continue
			const fp = path.join(templateDir, f)
			const stat = await fs.stat(fp)
			if (stat.isDirectory()) {
				await fs.rm(fp, { recursive: true, force: true })
			} else {
				await fs.unlink(fp)
			}
		}

		await this.venueTemplateManager.copyTemplateToProject(newTemplateId, templateDir)

		const newVenue = getVenueTemplate(newTemplateId)!
		await this.writeTemplateReadme(templateDir, newVenue.name, newTemplateId)
		await this.initLatexStructure(this.currentProject.rootPath, newTemplateId)

		// Update project
		this.currentProject.templateId = newTemplateId
		this.currentProject.updatedAt = new Date().toISOString()
		await this.saveProject(this.currentProject.rootPath, this.currentProject)
	}

	// ─── Persistence ───────────────────────────────────────────────────

	private async saveProject(rootPath: string, project: PaperProject): Promise<void> {
		const projectPath = path.join(rootPath, PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME)
		await fs.writeFile(projectPath, JSON.stringify(project, null, 2), "utf-8")
	}

	private async normalizeProject(project: PaperProject): Promise<PaperProject> {
		const normalized: PaperProject = {
			...project,
			primaryManuscriptPath: project.primaryManuscriptPath || path.join("latex", "main.tex"),
		}

		if (!project.primaryManuscriptPath) {
			await this.saveProject(normalized.rootPath, normalized)
		}

		return normalized
	}

	private async exists(targetPath: string): Promise<boolean> {
		try {
			await fs.access(targetPath)
			return true
		} catch {
			return false
		}
	}

	private getFallbackMainTex(templateId: string): string {
		const venue = getVenueTemplate(templateId)
		return [
			"\\documentclass[11pt]{article}",
			"",
			"\\usepackage[utf8]{inputenc}",
			"\\usepackage[T1]{fontenc}",
			"\\usepackage{amsmath,amssymb}",
			"\\usepackage{graphicx}",
			"\\usepackage{natbib}",
			"\\usepackage{hyperref}",
			"",
			`\\title{${venue?.name ?? "Paper"} Draft}`,
			"\\author{Author Name}",
			"\\date{}",
			"",
			"\\begin{document}",
			"\\maketitle",
			"",
			"\\begin{abstract}",
			"Write your abstract here.",
			"\\end{abstract}",
			"",
			"\\section{Introduction}",
			"Start drafting in the VS Code editor. Use LaTeX Workshop for compile/preview and Sci-Roo actions for revision.",
			"",
			"\\bibliographystyle{plainnat}",
			"\\bibliography{references}",
			"",
			"\\end{document}",
			"",
		].join("\n")
	}

	// ─── Utilities ──────────────────────────────────────────────────────

	private async isDirectoryEmpty(dirPath: string): Promise<boolean> {
		try {
			const entries = await fs.readdir(dirPath)
			// Ignore common hidden files/dirs that VS Code creates
			const meaningful = entries.filter(
				(e) =>
					e !== ".git" &&
					e !== ".gitignore" &&
					e !== ".vscode" &&
					e !== ".DS_Store" &&
					e !== "node_modules" &&
					e !== ".roo" &&
					!e.startsWith("."),
			)
			return meaningful.length === 0
		} catch {
			return true
		}
	}
}
