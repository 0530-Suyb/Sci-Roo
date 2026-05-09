import * as fs from "fs/promises"
import * as path from "path"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type {
	ResearchProject,
	ResearchPipelineState,
	Hypothesis,
	ExperimentEntry,
	AnalysisResult,
	PipelineStage,
	PipelineNote,
} from "@roo-code/types"

const PIPELINE_DIR = ".roo/research"
const PIPELINE_FILE = "project.json"
const MAX_NOTES = 100

export class ResearchPipelineManager {
	private providerRef: WeakRef<ClineProvider>
	private project: ResearchProject | undefined
	private projects: ResearchProject[] = []
	private initialized = false

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	get cwd(): string | undefined {
		return this.providerRef.deref()?.cwd
	}

	async initialize(): Promise<void> {
		if (this.initialized) return
		const cwd = this.cwd
		if (cwd) {
			await fs.mkdir(path.join(cwd, PIPELINE_DIR), { recursive: true })
			await this.loadProject()
		}
		this.initialized = true
	}

	private async loadProject(): Promise<void> {
		const cwd = this.cwd
		if (!cwd) return

		const projectPath = path.join(cwd, PIPELINE_DIR, PIPELINE_FILE)
		try {
			const raw = await fs.readFile(projectPath, "utf-8")
			const data = JSON.parse(raw)
			if (data.projects) {
				this.projects = data.projects
				if (data.current) {
					this.project = data.current
				}
			} else {
				this.project = data as ResearchProject
				this.projects = [data as ResearchProject]
			}
		} catch {
			// No project file yet — start fresh
		}
	}

	private async saveProject(): Promise<void> {
		const cwd = this.cwd
		if (!cwd) return

		const projectPath = path.join(cwd, PIPELINE_DIR, PIPELINE_FILE)
		const data = {
			current: this.project,
			projects: this.projects,
		}
		await fs.writeFile(projectPath, JSON.stringify(data, null, 2), "utf-8")
	}

	async createProject(name: string, description: string): Promise<ResearchProject> {
		const now = new Date().toISOString()
		const project: ResearchProject = {
			id: `proj_${Date.now()}`,
			name,
			description,
			hypotheses: [],
			experiments: [],
			analyses: [],
			stage: "planning",
			notes: [],
			createdAt: now,
			updatedAt: now,
		}

		this.project = project
		this.projects.unshift(project)
		await this.saveProject()
		return project
	}

	async setStage(stage: PipelineStage): Promise<void> {
		if (!this.project) return
		this.project.stage = stage
		this.project.updatedAt = new Date().toISOString()
		await this.saveProject()
	}

	async addHypothesis(statement: string, rationale: string, derivedFrom: string[] = []): Promise<Hypothesis> {
		if (!this.project) {
			throw new Error("No active research project")
		}

		const hypothesis: Hypothesis = {
			id: `hyp_${Date.now()}`,
			statement,
			rationale,
			derivedFrom,
			predictions: [],
			status: "proposed",
			createdAt: new Date().toISOString(),
		}

		this.project.hypotheses.push(hypothesis)
		this.project.updatedAt = new Date().toISOString()
		await this.saveProject()
		return hypothesis
	}

	async addExperiment(name: string, design: string): Promise<ExperimentEntry> {
		if (!this.project) {
			throw new Error("No active research project")
		}

		const experiment: ExperimentEntry = {
			id: `exp_${Date.now()}`,
			name,
			design,
			factors: [],
			sampleSize: 0,
			procedure: "",
			dataFiles: [],
			status: "planned",
			createdAt: new Date().toISOString(),
		}

		this.project.experiments.push(experiment)
		this.project.updatedAt = new Date().toISOString()
		await this.saveProject()
		return experiment
	}

	async addAnalysis(
		experimentId: string,
		testType: string,
		script: string,
		outputSummary: string,
	): Promise<AnalysisResult> {
		if (!this.project) {
			throw new Error("No active research project")
		}

		const analysis: AnalysisResult = {
			id: `ana_${Date.now()}`,
			experimentId,
			testType,
			script,
			outputSummary,
			timestamp: new Date().toISOString(),
		}

		this.project.analyses.push(analysis)
		this.project.updatedAt = new Date().toISOString()
		await this.saveProject()
		return analysis
	}

	async addNote(text: string): Promise<PipelineNote> {
		if (!this.project) {
			throw new Error("No active research project")
		}

		const note: PipelineNote = {
			id: `note_${Date.now()}`,
			text,
			stage: this.project.stage,
			timestamp: new Date().toISOString(),
		}

		this.project.notes.unshift(note)
		if (this.project.notes.length > MAX_NOTES) {
			this.project.notes = this.project.notes.slice(0, MAX_NOTES)
		}
		this.project.updatedAt = new Date().toISOString()
		await this.saveProject()
		return note
	}

	async getState(): Promise<ResearchPipelineState> {
		return {
			project: this.project,
			projects: this.projects,
		}
	}

	async deleteProject(projectId: string): Promise<void> {
		this.projects = this.projects.filter((p) => p.id !== projectId)
		if (this.project?.id === projectId) {
			this.project = this.projects[0]
		}
		await this.saveProject()
	}

	getProject(): ResearchProject | undefined {
		return this.project
	}

	async dispose(): Promise<void> {
		this.project = undefined
		this.projects = []
		this.initialized = false
	}
}
