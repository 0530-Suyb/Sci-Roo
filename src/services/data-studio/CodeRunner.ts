import { execa } from "execa"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

export interface CodeRunResult {
	stdout: string
	stderr: string
	exitCode: number
	files: string[]
}

export interface CodeRunnerOptions {
	timeout?: number
	cwd?: string
	env?: Record<string, string>
	saveGeneratedFiles?: boolean
	outputDir?: string
}

const DEFAULT_TIMEOUT = 120_000

/**
 * Executes R or Python scripts via execa subprocess.
 * Shared by DataStudioManager and the LLM tools.
 */
export class CodeRunner {
	/**
	 * Find the best available R or Python executable.
	 */
	static findExecutable(language: "r" | "python"): string {
		if (language === "r") {
			return process.platform === "win32" ? "Rscript.exe" : "Rscript"
		}
		// Python: try python3 first on Unix, python on Windows
		if (process.platform === "win32") {
			return "python"
		}
		return "python3"
	}

	/**
	 * Run a script and capture output.
	 */
	async runScript(language: "r" | "python", code: string, options: CodeRunnerOptions = {}): Promise<CodeRunResult> {
		const ext = language === "r" ? "R" : "py"
		const tmpDir = options.cwd || (await fs.mkdtemp(path.join(os.tmpdir(), "sciroo-run-")))
		const scriptPath = path.join(tmpDir, `script.${ext}`)

		await fs.mkdir(tmpDir, { recursive: true })
		await fs.writeFile(scriptPath, code, "utf-8")

		try {
			const cmd = CodeRunner.findExecutable(language)
			const args: string[] = language === "r" ? ["--no-save", scriptPath] : [scriptPath]
			const timeout = options.timeout ?? DEFAULT_TIMEOUT

			const env = { ...process.env, ...options.env }

			const subprocess = execa(cmd, args, {
				cwd: tmpDir,
				timeout,
				reject: false,
				all: true,
				env,
			})

			const { stdout, stderr, exitCode } = await subprocess

			// Scan for generated files
			let files: string[] = []
			if (options.saveGeneratedFiles) {
				try {
					const entries = await fs.readdir(tmpDir, { withFileTypes: true })
					files = entries
						.filter((e) => e.isFile() && e.name !== `script.${ext}`)
						.map((e) => path.join(tmpDir, e.name))
				} catch {
					// ignore
				}
			}

			return {
				stdout: (typeof stdout === "string" ? stdout : "") || "",
				stderr: (typeof stderr === "string" ? stderr : "") || "",
				exitCode: exitCode ?? 1,
				files,
			}
		} finally {
			if (!options.cwd) {
				// Clean up temp dir if we created it
				await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
			}
		}
	}

	/**
	 * Check if the specified language interpreter is available.
	 */
	async checkAvailability(language: "r" | "python"): Promise<boolean> {
		try {
			const cmd = CodeRunner.findExecutable(language)
			const args = language === "r" ? ["--version"] : ["--version"]
			const result = await execa(cmd, args, { timeout: 10_000, reject: false })
			return result.exitCode === 0
		} catch {
			return false
		}
	}
}
