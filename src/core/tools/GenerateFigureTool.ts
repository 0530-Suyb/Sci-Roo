import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { GenerateFigureParams } from "@roo-code/types"
import { execa } from "execa"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

export class GenerateFigureTool extends BaseTool<"generate_figure"> {
	readonly name = "generate_figure" as const

	async execute(params: GenerateFigureParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const label = params.title || params.caption || `figure.${params.outputType}`
			const approved = await askApproval("generate_figure", `Generate ${params.language} figure: ${label}`)
			if (!approved) {
				pushToolResult("User denied figure generation request.")
				return
			}

			const filename = params.filename || `figure_${Date.now()}`
			const outputFile = `${filename}.${params.outputType}`

			const ext = params.language === "r" ? "R" : "py"
			const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sciroo-fig-"))
			const scriptPath = path.join(tmpDir, `script.${ext}`)
			const outputPath = path.join(tmpDir, outputFile)

			await fs.writeFile(scriptPath, params.code, "utf-8")

			try {
				const timeout = 180_000
				const cmd = params.language === "r" ? "Rscript" : process.platform === "win32" ? "python" : "python3"
				const args = params.language === "r" ? ["--no-save", scriptPath] : [scriptPath]

				const subprocess = execa(cmd, args, {
					cwd: tmpDir,
					timeout,
					reject: false,
					all: true,
					env: { ...process.env, FIGURE_OUTPUT: outputPath },
				})

				const { stdout, stderr, exitCode } = await subprocess

				let imageBase64 = ""
				let readError = ""

				try {
					const buffer = await fs.readFile(outputPath)
					imageBase64 = buffer.toString("base64")
				} catch {
					readError = `Figure file not found at ${outputPath}. The script may not have saved the figure correctly.`
				}

				const outputLines: string[] = []
				if (params.title) outputLines.push(`**Figure**: ${params.title}`)
				if (params.caption) outputLines.push(`**Caption**: ${params.caption}`)
				outputLines.push(`**Format**: ${params.outputType}`)
				outputLines.push(`**Language**: ${params.language}`)

				if (readError) {
					outputLines.push(`\n**Warning**: ${readError}`)
				}

				if (stdout) {
					outputLines.push(`\n**Output**:\n\`\`\`\n${stdout}\n\`\`\``)
				}

				if (stderr) {
					outputLines.push(`\n**Stderr**:\n\`\`\`\n${stderr}\n\`\`\``)
				}

				if (exitCode !== 0) {
					outputLines.push(`\n**Exit Code**: ${exitCode} (non-zero, figure may have errors)`)
				}

				const textResult = outputLines.join("\n")

				if (imageBase64) {
					const mediaType =
						params.outputType === "svg"
							? "image/svg+xml"
							: params.outputType === "pdf"
								? "application/pdf"
								: "image/png"
					const dataUrl = "data:" + mediaType + ";base64," + imageBase64
					pushToolResult(formatResponse.toolResult(textResult, [dataUrl]))
				} else {
					pushToolResult(formatResponse.toolResult(textResult))
				}
			} finally {
				await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
			}
		} catch (error) {
			await handleError("generate_figure", error)
		}
	}
}

export const generateFigureTool = new GenerateFigureTool()
