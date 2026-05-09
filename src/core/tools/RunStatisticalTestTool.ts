import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { RunStatisticalTestParams } from "@roo-code/types"
import { execa } from "execa"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

export class RunStatisticalTestTool extends BaseTool<"run_statistical_test"> {
	readonly name = "run_statistical_test" as const

	async execute(params: RunStatisticalTestParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const codePreview = params.code.substring(0, 80).replace(/\n/g, " ")
			const approved = await askApproval(
				"run_statistical_test",
				params.explanation
					? `Run ${params.language} statistical test: ${params.explanation}`
					: `Run ${params.language} statistical test: "${codePreview}..."`,
			)
			if (!approved) {
				pushToolResult("User denied statistical test request.")
				return
			}

			const result = await this.runCode(params.code, params.language)

			const output = [
				params.explanation ? `**Test**: ${params.explanation}\n` : "",
				`**Language**: ${params.language}`,
				`**Exit Code**: ${result.exitCode}`,
				"",
				result.stdout ? `**Output**:\n\`\`\`\n${result.stdout}\n\`\`\`` : "",
				result.stderr ? `**Stderr**:\n\`\`\`\n${result.stderr}\n\`\`\`` : "",
			]
				.filter(Boolean)
				.join("\n")

			pushToolResult(formatResponse.toolResult(output))
		} catch (error) {
			await handleError("run_statistical_test", error)
		}
	}

	private async runCode(
		code: string,
		language: "r" | "python",
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		const ext = language === "r" ? "R" : "py"
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sciroo-stat-"))
		const scriptPath = path.join(tmpDir, `script.${ext}`)

		await fs.writeFile(scriptPath, code, "utf-8")

		try {
			const timeout = 120_000
			const cmd = language === "r" ? "Rscript" : process.platform === "win32" ? "python" : "python3"

			const args = language === "r" ? ["--no-save", scriptPath] : [scriptPath]

			const subprocess = execa(cmd, args, {
				cwd: tmpDir,
				timeout,
				reject: false,
				all: true,
				env: { ...process.env },
			})

			const { stdout, stderr, exitCode } = await subprocess

			return {
				stdout: (typeof stdout === "string" ? stdout : "") || "",
				stderr: (typeof stderr === "string" ? stderr : "") || "",
				exitCode: exitCode ?? 1,
			}
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
		}
	}
}

export const runStatisticalTestTool = new RunStatisticalTestTool()
