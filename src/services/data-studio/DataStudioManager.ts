import * as fs from "fs/promises"
import * as path from "path"
import { CodeRunner, CodeRunResult } from "./CodeRunner"
import type { ClineProvider } from "../../core/webview/ClineProvider"

export interface SessionEntry {
	id: string
	timestamp: number
	code: string
	language: "r" | "python"
	result: CodeRunResult
}

export interface DataStudioState {
	lastRun?: SessionEntry
	history: SessionEntry[]
	files: string[]
	rAvailable: boolean
	pythonAvailable: boolean
}

const DATA_STUDIO_DIR = ".roo/data-studio"
const MAX_HISTORY = 50

/**
 * Manages the Data Studio session state.
 * Provides code execution, file browsing, and session history.
 */
export class DataStudioManager {
	private providerRef: WeakRef<ClineProvider>
	private history: SessionEntry[] = []
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
			await fs.mkdir(path.join(cwd, DATA_STUDIO_DIR), { recursive: true })
		}
		this.initialized = true
	}

	getSessionHistory(): SessionEntry[] {
		return this.history
	}

	getDataFiles(): string[] {
		const cwd = this.cwd
		if (!cwd) return []

		const dataDir = path.join(cwd, DATA_STUDIO_DIR)
		try {
			// Returns sync-available list; actual read is async
			return [dataDir]
		} catch {
			return []
		}
	}

	async runCode(
		code: string,
		language: "r" | "python",
	): Promise<{
		result: CodeRunResult
		state: DataStudioState
	}> {
		const cwd = this.cwd
		const outputDir = cwd ? path.join(cwd, DATA_STUDIO_DIR) : undefined

		if (outputDir) {
			await fs.mkdir(outputDir, { recursive: true })
		}

		const runner = new CodeRunner()
		const result = await runner.runScript(language, code, {
			cwd: outputDir,
			saveGeneratedFiles: true,
		})

		const entry: SessionEntry = {
			id: `run_${Date.now()}`,
			timestamp: Date.now(),
			code,
			language,
			result,
		}

		this.history.unshift(entry)
		if (this.history.length > MAX_HISTORY) {
			this.history = this.history.slice(0, MAX_HISTORY)
		}

		// Discover data files
		const rAvailable = await runner.checkAvailability("r")
		const pythonAvailable = await runner.checkAvailability("python")

		let files: string[] = []
		if (outputDir) {
			try {
				const entries = await fs.readdir(outputDir, { withFileTypes: true })
				files = entries
					.filter((e) => {
						if (!e.isFile()) return false
						const ext = path.extname(e.name).toLowerCase()
						return [
							".csv",
							".tsv",
							".json",
							".txt",
							".rds",
							".pkl",
							".rdata",
							".xlsx",
							".png",
							".svg",
							".pdf",
						].includes(ext)
					})
					.map((e) => path.join(outputDir!, e.name))
			} catch {
				// ignore
			}
		}

		const state: DataStudioState = {
			lastRun: entry,
			history: this.history,
			files,
			rAvailable,
			pythonAvailable,
		}

		return { result, state }
	}

	async getState(): Promise<DataStudioState> {
		const runner = new CodeRunner()
		const [rAvailable, pythonAvailable] = await Promise.all([
			runner.checkAvailability("r").catch(() => false),
			runner.checkAvailability("python").catch(() => false),
		])

		const cwd = this.cwd
		let files: string[] = []
		if (cwd) {
			const dataDir = path.join(cwd, DATA_STUDIO_DIR)
			try {
				const entries = await fs.readdir(dataDir, { withFileTypes: true })
				files = entries.filter((e) => e.isFile()).map((e) => path.join(dataDir, e.name))
			} catch {
				// directory may not exist yet
			}
		}

		return {
			history: this.history,
			files,
			rAvailable,
			pythonAvailable,
		}
	}

	async dispose(): Promise<void> {
		this.history = []
		this.initialized = false
	}
}
