import * as syncFs from "fs"
import * as fs from "fs/promises"
import * as path from "path"
import type { VenueTemplate, SectionConfig, SectionType } from "@roo-code/types"
import { VENUE_TEMPLATES, getVenueTemplate, getDirectoryTemplate } from "./paperConfig"

/**
 * Manages built-in venue templates (LaTeX conference templates).
 * Provides venue metadata, section configs, and template file copying.
 */
export class VenueTemplateManager {
	private templatesDir: string
	private skillsDir: string
	private rulesDir: string

	constructor(extensionPath: string) {
		this.templatesDir = this.resolveResourceDir(extensionPath, "templates")
		this.skillsDir = this.resolveResourceDir(extensionPath, "skills")
		this.rulesDir = this.resolveResourceDir(extensionPath, "rules")
	}

	private resolveResourceDir(extensionPath: string, resourceName: "templates" | "skills" | "rules"): string {
		const candidates = [
			path.join(extensionPath, "services", "paper", resourceName),
			path.join(extensionPath, "dist", "services", "paper", resourceName),
		]

		for (const candidate of candidates) {
			try {
				syncFs.accessSync(candidate)
				return candidate
			} catch {
				// Try the next candidate.
			}
		}

		return candidates[0]
	}

	// ─── Venue Metadata ──────────────────────────────────────────────

	listTemplates(): VenueTemplate[] {
		return VENUE_TEMPLATES
	}

	getTemplate(id: string): VenueTemplate | undefined {
		return getVenueTemplate(id)
	}

	getSectionConfigs(templateId: string): SectionConfig[] {
		const venue = getVenueTemplate(templateId)
		return venue?.sectionConfigs ?? []
	}

	getSectionConfig(templateId: string, sectionType: SectionType): SectionConfig | undefined {
		const venue = getVenueTemplate(templateId)
		return venue?.sectionConfigs.find((s) => s.type === sectionType)
	}

	isSectionRequired(templateId: string, sectionType: SectionType): boolean {
		const config = this.getSectionConfig(templateId, sectionType)
		return config?.required ?? false
	}

	// ─── Template File Operations ────────────────────────────────────

	getTemplateDir(templateId: string): string {
		const venue = getVenueTemplate(templateId)
		return path.join(this.templatesDir, venue?.templateDirName ?? templateId)
	}

	async templateExists(templateId: string): Promise<boolean> {
		const dir = this.getTemplateDir(templateId)
		try {
			const stat = await fs.stat(dir)
			return stat.isDirectory()
		} catch {
			return false
		}
	}

	/**
	 * Copy a built-in template's files to the target project template/ directory.
	 */
	async copyTemplateToProject(templateId: string, targetDir: string): Promise<void> {
		const srcDir = this.getTemplateDir(templateId)
		const exists = await this.templateExists(templateId)
		if (!exists) {
			throw new Error(`Template '${templateId}' not found at ${srcDir}`)
		}

		await fs.mkdir(targetDir, { recursive: true })
		await this.copyDir(srcDir, targetDir)
	}

	private async copyDir(src: string, dest: string): Promise<void> {
		const entries = await fs.readdir(src, { withFileTypes: true })
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name)
			const destPath = path.join(dest, entry.name)
			if (entry.isDirectory()) {
				await fs.mkdir(destPath, { recursive: true })
				await this.copyDir(srcPath, destPath)
			} else {
				await fs.copyFile(srcPath, destPath)
			}
		}
	}

	/**
	 * Copy built-in skill files to the target project's .roo/skills/ directory.
	 * Only copies skills listed in the venue template's skillNames array.
	 */
	async copySkillsToProject(templateId: string, projectRoot: string): Promise<string[]> {
		const venue = getVenueTemplate(templateId)
		const skillNames = venue?.skillNames ?? []
		const copied: string[] = []

		for (const skillName of skillNames) {
			const srcDir = path.join(this.skillsDir, skillName)
			try {
				await fs.access(srcDir)
			} catch {
				continue
			}

			const destDir = path.join(projectRoot, ".roo", "skills", skillName)
			await fs.mkdir(destDir, { recursive: true })
			await this.copyDir(srcDir, destDir)
			copied.push(skillName)
		}

		return copied
	}

	/**
	 * Copy a single built-in skill to the target project's .roo/skills/ directory.
	 * Returns true when the skill exists in extension resources and has been copied.
	 */
	async copySkillToProject(skillName: string, projectRoot: string): Promise<boolean> {
		const srcDir = path.join(this.skillsDir, skillName)
		try {
			await fs.access(srcDir)
		} catch {
			return false
		}

		const destDir = path.join(projectRoot, ".roo", "skills", skillName)
		await fs.mkdir(destDir, { recursive: true })
		await this.copyDir(srcDir, destDir)
		return true
	}

	/**
	 * Copy built-in rule files to the target project's .roo/rules-sci-paper-writing/ directory.
	 * Only copies rules listed in the directory template's ruleFiles array.
	 */
	async copyRulesToProject(directoryTemplateId: string, projectRoot: string): Promise<string[]> {
		const dirTemplate = getDirectoryTemplate(directoryTemplateId)
		const ruleFiles = dirTemplate?.ruleFiles ?? []
		const copied: string[] = []

		const destDir = path.join(projectRoot, ".roo", "rules-sci-paper-writing")
		await fs.mkdir(destDir, { recursive: true })

		for (const ruleFile of ruleFiles) {
			const srcPath = path.join(this.rulesDir, ruleFile)
			try {
				await fs.access(srcPath)
			} catch {
				continue
			}

			const destPath = path.join(destDir, ruleFile)
			await fs.copyFile(srcPath, destPath)
			copied.push(ruleFile)
		}

		return copied
	}

	/**
	 * Validate that a user-provided template/ directory has at minimum a main.tex file.
	 */
	async validateCustomTemplate(templateDir: string): Promise<{ valid: boolean; error?: string }> {
		try {
			const mainTexPath = path.join(templateDir, "main.tex")
			await fs.access(mainTexPath)
			return { valid: true }
		} catch {
			return { valid: false, error: "Custom template must contain a main.tex file" }
		}
	}
}
