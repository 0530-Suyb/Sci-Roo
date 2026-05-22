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

		const projectPath = path.join(cwd, PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME)
		try {
			const raw = await fs.readFile(projectPath, "utf-8")
			this.currentProject = JSON.parse(raw) as PaperProject
			return this.currentProject
		} catch {
			return undefined
		}
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
		let rootPath = cwd
		const isEmpty = await this.isDirectoryEmpty(cwd)
		if (!isEmpty) {
			rootPath = path.join(cwd, "research-project")
			await fs.mkdir(rootPath, { recursive: true })
		}

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
		await this.initLatexStructure(rootPath, venueTemplate.sectionConfigs)
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
			templateId: params.venueTemplateId,
			templateSource: "builtin",
			directoryTemplate: params.directoryTemplate,
			stage: "planning",
			createdAt: now,
			updatedAt: now,
		}

		await this.saveProject(rootPath, project)
		this.currentProject = project

		// Log creation info
		if (rootPath !== cwd) {
			this.provider?.log(`Project created in subdirectory: ${rootPath} (workspace was not empty)`)
		}
		this.provider?.log(`Paper project '${params.name}' created with template '${params.venueTemplateId}'`)

		return project
	}

	async openProject(rootPath: string): Promise<PaperProject> {
		const projectPath = path.join(rootPath, PAPER_PROJECT_DIR, PAPER_PROJECT_FILENAME)
		try {
			const raw = await fs.readFile(projectPath, "utf-8")
			this.currentProject = JSON.parse(raw) as PaperProject
			return this.currentProject
		} catch {
			throw new Error(`No project found at ${rootPath}`)
		}
	}

	async updateStage(stage: PaperProjectStage): Promise<void> {
		if (!this.currentProject) throw new Error("No active project")
		this.currentProject.stage = stage
		this.currentProject.updatedAt = new Date().toISOString()
		await this.saveProject(this.currentProject.rootPath, this.currentProject)
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

	private async initLatexStructure(rootPath: string, sectionConfigs: SectionConfig[]): Promise<void> {
		const latexDir = path.join(rootPath, "latex")
		const sectionsDir = path.join(latexDir, "sections")
		await fs.mkdir(sectionsDir, { recursive: true })

		// Create empty .tex files for each section
		for (const cfg of sectionConfigs) {
			if (cfg.type === "appendix") continue
			const filePath = path.join(sectionsDir, `${cfg.type}.tex`)
			const placeholder = this.getSectionPlaceholder(cfg)
			await fs.writeFile(filePath, placeholder, "utf-8")
		}
	}

	private getSectionPlaceholder(cfg: SectionConfig): string {
		const label = cfg.label
		const hint = cfg.required ? " (required)" : " (optional)"
		return `% ${label}${hint}\n% This section is part of the conference template.\n% Use AI Write or edit directly.\n`
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

		const { added, removed } = await this.previewVenueSwitch(newTemplateId)

		// Remove old sections
		const sectionsDir = path.join(this.currentProject.rootPath, "latex", "sections")
		for (const cfg of removed) {
			try {
				await fs.unlink(path.join(sectionsDir, `${cfg.type}.tex`))
			} catch {
				// File doesn't exist, skip
			}
		}

		// Add new section files
		for (const cfg of added) {
			await fs.writeFile(path.join(sectionsDir, `${cfg.type}.tex`), this.getSectionPlaceholder(cfg), "utf-8")
		}

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
