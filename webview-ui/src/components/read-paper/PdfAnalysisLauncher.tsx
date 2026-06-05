import { AlertTriangle, FileText, MessageSquareText } from "lucide-react"

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@/components/ui"
import type { ReadPaperAnalysisMode } from "./readPaperAnalysisPrompt"

const ANALYSIS_MODE_OPTIONS: Array<{ value: ReadPaperAnalysisMode; label: string }> = [
	{ value: "quick", label: "Quick" },
	{ value: "standard", label: "Standard" },
	{ value: "extended", label: "Extended" },
	{ value: "presentation", label: "Presentation" },
	{ value: "presentation_with_figures", label: "Presentation with figures" },
]

export type PdfAnalysisLauncherProps = {
	open: boolean
	pdfPaths: string[]
	outputDir: string
	mode: ReadPaperAnalysisMode
	prompt: string
	onOpenChange: (open: boolean) => void
	onOutputDirChange: (value: string) => void
	onModeChange: (value: ReadPaperAnalysisMode) => void
	onPromptChange: (value: string) => void
	onOpenChat: () => void
}

function compactPath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/")
	const parts = normalized.split("/")
	if (parts.length <= 4) return filePath
	return `…/${parts.slice(-4).join("/")}`
}

export function PdfAnalysisLauncher({
	open,
	pdfPaths,
	outputDir,
	mode,
	prompt,
	onOpenChange,
	onOutputDirChange,
	onModeChange,
	onPromptChange,
	onOpenChat,
}: PdfAnalysisLauncherProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
				<DialogHeader className="border-b border-vscode-panel-border px-4 py-3">
					<div className="flex min-w-0 items-center gap-2">
						<FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
						<DialogTitle className="text-base">Analyze PDFs</DialogTitle>
					</div>
					<DialogDescription className="text-xs">
						Prepare a paper-analyst prompt, then review and send it in Chat.
					</DialogDescription>
				</DialogHeader>

				<div className="grid min-h-0 gap-0 md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
					<section className="min-h-0 border-b border-vscode-panel-border p-4 md:border-b-0 md:border-r">
						<div className="flex items-center justify-between gap-2">
							<h4 className="text-sm font-semibold">PDFs</h4>
							<span className="rounded bg-vscode-badge-background px-2 py-0.5 text-xs tabular-nums text-vscode-badge-foreground">
								{pdfPaths.length}
							</span>
						</div>

						<div className="mt-3 max-h-40 space-y-1 overflow-auto md:max-h-56" role="list">
							{pdfPaths.map((pdfPath) => (
								<div
									key={pdfPath}
									role="listitem"
									title={pdfPath}
									className="rounded border border-vscode-panel-border px-2 py-1.5 text-xs">
									<div className="break-all text-vscode-editor-foreground">
										{compactPath(pdfPath)}
									</div>
								</div>
							))}
						</div>

						{pdfPaths.length > 20 && (
							<div className="mt-3 flex gap-2 rounded-md border border-vscode-inputValidation-warningBorder bg-vscode-inputValidation-warningBackground p-2 text-xs text-vscode-editor-foreground">
								<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
								<span>Large batch. The inserted prompt may be long.</span>
							</div>
						)}

						<div className="mt-4 space-y-3">
							<div>
								<label id="readpaper-analysis-mode-label" className="block text-xs font-medium">
									Mode
								</label>
								<Select
									value={mode}
									onValueChange={(value) => onModeChange(value as ReadPaperAnalysisMode)}>
									<SelectTrigger
										aria-labelledby="readpaper-analysis-mode-label"
										className="mt-1 h-8 w-full rounded-md">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ANALYSIS_MODE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<label htmlFor="readpaper-analysis-output-dir" className="block text-xs font-medium">
									Output directory
								</label>
								<Input
									id="readpaper-analysis-output-dir"
									name="readpaper-analysis-output-dir"
									value={outputDir}
									onChange={(event) => onOutputDirChange(event.target.value)}
									className="mt-1 h-8 text-xs"
									autoComplete="off"
									aria-label="Output directory"
								/>
							</div>
						</div>
					</section>

					<section className="flex min-h-0 flex-col p-4">
						<label htmlFor="readpaper-analysis-prompt" className="text-sm font-semibold">
							Prompt
						</label>
						<Textarea
							id="readpaper-analysis-prompt"
							name="readpaper-analysis-prompt"
							value={prompt}
							onChange={(event) => onPromptChange(event.target.value)}
							className="mt-2 min-h-[280px] flex-1 resize-none text-xs leading-relaxed"
							autoComplete="off"
							aria-label="Paper analysis prompt"
						/>
					</section>
				</div>

				<DialogFooter className="border-t border-vscode-panel-border px-4 py-3">
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="primary"
						size="sm"
						className="gap-1.5"
						onClick={onOpenChat}
						disabled={!prompt.trim()}>
						<MessageSquareText className="h-4 w-4" aria-hidden="true" />
						<span>Open analysis chat</span>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
