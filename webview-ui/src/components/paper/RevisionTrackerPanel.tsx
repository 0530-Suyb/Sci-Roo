import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
	AlertTriangle,
	CheckCircle2,
	Clock3,
	FilePlus2,
	Library,
	Loader2,
	MessageSquareQuote,
	ScrollText,
	Sparkles,
	TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type RevisionTrackerPanelProps = {
	project: any
	sectionInsights: any
	onOpenFile: (filePath: string) => void
	onFocusSection?: (sectionType: string) => void
}

type RevisionItem = {
	id: string
	title: string
	status: string
	priority: string
	section: string
	source: string
	comment: string
	action: string
	response: string
}

type LinkedSectionInsight = {
	key: string
	label: string
	readiness: "blocked" | "needs-work" | "ready"
	missingCitationCount: number
	nextStep: string
}

function buildProjectPath(rootPath: string | undefined, relativePath: string): string {
	if (!rootPath) {
		return relativePath
	}
	return `${String(rootPath).replace(/[\\/]$/, "")}/${relativePath}`.replace(/\//g, "\\")
}

function normalizeFieldKey(input: string): keyof Omit<RevisionItem, "id" | "title"> | null {
	const key = input.trim().toLowerCase().replace(/\s+/g, "-")
	switch (key) {
		case "status":
		case "priority":
		case "section":
		case "source":
		case "comment":
		case "action":
		case "response":
			return key
		default:
			return null
	}
}

function parseRevisionItems(content: string): RevisionItem[] {
	const headingPattern = /^###\s+(.+)$/gm
	const blocks: Array<{ title: string; body: string }> = []
	let match: RegExpExecArray | null = headingPattern.exec(content)

	while (match) {
		const title = match[1].trim()
		const bodyStart = headingPattern.lastIndex
		const nextMatch = headingPattern.exec(content)
		const bodyEnd = nextMatch ? nextMatch.index : content.length
		blocks.push({ title, body: content.slice(bodyStart, bodyEnd).trim() })
		if (!nextMatch) {
			break
		}
		match = nextMatch
	}

	return blocks
		.map((block, index) => {
			const fields: Omit<RevisionItem, "id" | "title"> = {
				status: "open",
				priority: "minor",
				section: "unspecified",
				source: "unspecified",
				comment: "",
				action: "",
				response: "",
			}

			for (const line of block.body.split(/\r?\n/)) {
				const fieldMatch = line.match(/^-+\s*([^:]+):\s*(.+)$/)
				if (!fieldMatch) {
					continue
				}
				const normalizedKey = normalizeFieldKey(fieldMatch[1])
				if (!normalizedKey) {
					continue
				}
				fields[normalizedKey] = fieldMatch[2].trim()
			}

			return {
				id: `${block.title}-${index}`,
				title: block.title,
				...fields,
			}
		})
		.filter((item) => item.comment || item.action || item.response)
}

function normalizeSectionKey(section: string): string {
	return section.trim().toLowerCase().replace(/\s+/g, "-")
}

function buildSectionAliases(label: string, key: string): string[] {
	const normalizedLabel = normalizeSectionKey(label)
	return Array.from(
		new Set([
			key,
			normalizedLabel,
			normalizedLabel.replace(/-&-/, "-"),
			normalizedLabel.replace(/-and-/, "-"),
			normalizedLabel.replace(/-impl$/, ""),
			normalizedLabel.replace(/^design-/, ""),
			normalizedLabel.replace(/^evaluation$/, "results"),
		]),
	)
}

function getLinkedSectionInsight(item: RevisionItem, sectionInsights: any): LinkedSectionInsight | null {
	if (!sectionInsights) {
		return null
	}

	const requestedKey = normalizeSectionKey(item.section)
	for (const [key, insight] of Object.entries(sectionInsights as Record<string, any>)) {
		const aliases = buildSectionAliases(String(insight?.label ?? key), key)
		if (aliases.includes(requestedKey)) {
			return {
				key,
				label: String(insight?.label ?? key),
				readiness: (insight?.readiness ?? "ready") as LinkedSectionInsight["readiness"],
				missingCitationCount: Number(insight?.missingCitationCount ?? 0),
				nextStep: String(insight?.nextStep ?? ""),
			}
		}
	}

	return null
}

export const RevisionTrackerPanel: React.FC<RevisionTrackerPanelProps> = ({
	project,
	sectionInsights,
	onOpenFile,
	onFocusSection,
}) => {
	const revisionLogPath = useMemo(
		() => buildProjectPath(project?.rootPath, "review/revision-log.md"),
		[project?.rootPath],
	)
	const [content, setContent] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [seeding, setSeeding] = useState(false)

	const requestRevisionLog = useCallback(() => {
		if (!revisionLogPath) {
			return
		}
		setLoading(true)
		setError(null)
		vscode.postMessage({
			type: "readFileContent",
			text: revisionLogPath,
		})
	}, [revisionLogPath])

	useEffect(() => {
		if (!project) {
			return
		}
		requestRevisionLog()
	}, [project, requestRevisionLog])

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message?.type !== "fileContent" || message.fileContent?.path !== revisionLogPath) {
				return
			}
			setLoading(false)
			setError(message.fileContent.error ?? null)
			setContent(message.fileContent.content ?? null)
			setSeeding(false)
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [revisionLogPath])

	const items = useMemo(() => parseRevisionItems(content ?? ""), [content])
	const openItems = useMemo(
		() => items.filter((item) => !["resolved", "done"].includes(item.status.toLowerCase())),
		[items],
	)
	const majorItems = useMemo(() => items.filter((item) => item.priority.toLowerCase() === "major"), [items])
	const linkedOpenItems = useMemo(
		() =>
			openItems
				.map((item) => ({ item, linkedSection: getLinkedSectionInsight(item, sectionInsights) }))
				.filter((entry) => entry.linkedSection),
		[openItems, sectionInsights],
	)
	const blockedLinkedItems = useMemo(
		() => linkedOpenItems.filter((entry) => entry.linkedSection?.readiness === "blocked").length,
		[linkedOpenItems],
	)
	const needsWorkLinkedItems = useMemo(
		() => linkedOpenItems.filter((entry) => entry.linkedSection?.readiness === "needs-work").length,
		[linkedOpenItems],
	)

	const handleSeedTemplate = useCallback(() => {
		setSeeding(true)
		vscode.postMessage({
			type: "paperProjectCreate",
			action: "revisionLogSeed",
		})
		window.setTimeout(() => {
			requestRevisionLog()
		}, 250)
	}, [requestRevisionLog])

	const handleFocusLinkedSection = useCallback(
		(sectionKey: string) => {
			onFocusSection?.(sectionKey)
		},
		[onFocusSection],
	)

	return (
		<div className="rounded-xl border bg-background/90 p-3">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<MessageSquareQuote className="h-4 w-4 text-sky-600" />
						<h4 className="text-sm font-semibold">Reviewer Action Board</h4>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						Track reviewer comments as concrete actions instead of scattered prose notes.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" className="text-xs" onClick={requestRevisionLog}>
						Refresh
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="text-xs"
						onClick={() => onOpenFile("review/revision-log.md")}>
						<ScrollText className="mr-1.5 h-3.5 w-3.5" />
						Open log
					</Button>
				</div>
			</div>

			<div className="mb-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
				<div className="rounded-lg border bg-muted/30 p-2.5">
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open items</div>
					<div className="mt-1 text-lg font-semibold">{openItems.length}</div>
				</div>
				<div className="rounded-lg border bg-muted/30 p-2.5">
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Major issues</div>
					<div className="mt-1 text-lg font-semibold">{majorItems.length}</div>
				</div>
				<div className="rounded-lg border bg-muted/30 p-2.5">
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Structured entries</div>
					<div className="mt-1 text-lg font-semibold">{items.length}</div>
				</div>
				<div className="rounded-lg border bg-muted/30 p-2.5">
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked blocked</div>
					<div className="mt-1 text-lg font-semibold">{blockedLinkedItems}</div>
				</div>
				<div className="rounded-lg border bg-muted/30 p-2.5">
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked needs work</div>
					<div className="mt-1 text-lg font-semibold">{needsWorkLinkedItems}</div>
				</div>
			</div>

			{loading ? (
				<div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading revision log...
				</div>
			) : error ? (
				<div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4" />
						<div className="flex-1">
							<div className="font-medium">Revision log is not ready yet</div>
							<div className="mt-1 text-xs text-amber-800/80">{error}</div>
						</div>
						<Button variant="outline" size="sm" className="text-xs" onClick={handleSeedTemplate}>
							<FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
							Create template
						</Button>
					</div>
				</div>
			) : items.length === 0 ? (
				<div className="rounded-lg border bg-muted/20 p-3">
					<div className="flex items-start justify-between gap-3">
						<div>
							<div className="text-sm font-medium">No structured revision items yet</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Seed a reviewer-response template so the workbench can track open issues, sections, and
								action plans.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="text-xs"
							onClick={handleSeedTemplate}
							disabled={seeding}>
							{seeding ? (
								<>
									<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
									Seeding...
								</>
							) : (
								<>
									<FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
									Seed template
								</>
							)}
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-2">
					{items.slice(0, 4).map((item) => {
						const isResolved = ["resolved", "done"].includes(item.status.toLowerCase())
						const linkedSection = getLinkedSectionInsight(item, sectionInsights)
						return (
							<div key={item.id} className="rounded-lg border bg-muted/20 p-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="flex items-center gap-2">
											{isResolved ? (
												<CheckCircle2 className="h-4 w-4 text-emerald-600" />
											) : (
												<Clock3 className="h-4 w-4 text-amber-600" />
											)}
											<span className="text-sm font-medium">{item.title}</span>
										</div>
										<div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
											<span className="rounded-full bg-background px-2 py-1">
												{item.priority}
											</span>
											<span className="rounded-full bg-background px-2 py-1">{item.section}</span>
											<span className="rounded-full bg-background px-2 py-1">{item.source}</span>
											{linkedSection && (
												<span
													className={`rounded-full px-2 py-1 ${
														linkedSection.readiness === "blocked"
															? "bg-slate-200 text-slate-700"
															: linkedSection.readiness === "needs-work"
																? "bg-amber-100 text-amber-700"
																: "bg-emerald-100 text-emerald-700"
													}`}>
													{linkedSection.label}: {linkedSection.readiness}
												</span>
											)}
										</div>
									</div>
									<span
										className={`rounded-full px-2 py-1 text-[11px] ${
											isResolved
												? "bg-emerald-100 text-emerald-700"
												: "bg-amber-100 text-amber-700"
										}`}>
										{item.status}
									</span>
								</div>
								<div className="mt-2 space-y-1 text-xs text-muted-foreground">
									{item.comment && (
										<p>
											<span className="font-medium text-foreground">Comment:</span> {item.comment}
										</p>
									)}
									{item.action && (
										<p>
											<span className="font-medium text-foreground">Action:</span> {item.action}
										</p>
									)}
									{item.response && (
										<p>
											<span className="font-medium text-foreground">Response:</span>{" "}
											{item.response}
										</p>
									)}
									{linkedSection && (
										<div className="mt-2 rounded-lg border bg-background/80 p-2.5">
											<div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
												<span className="font-medium text-foreground">
													Linked section signal
												</span>
												{linkedSection.readiness === "blocked" ? (
													<span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-slate-700">
														<TriangleAlert className="h-3 w-3" />
														Blocked
													</span>
												) : linkedSection.readiness === "needs-work" ? (
													<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
														<AlertTriangle className="h-3 w-3" />
														Needs work
													</span>
												) : (
													<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
														<CheckCircle2 className="h-3 w-3" />
														Ready
													</span>
												)}
												{linkedSection.missingCitationCount > 0 && (
													<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
														<Library className="h-3 w-3" />
														{linkedSection.missingCitationCount} missing cite
													</span>
												)}
											</div>
											<p className="text-[11px] text-muted-foreground">
												<span className="font-medium text-foreground">Next step:</span>{" "}
												{linkedSection.nextStep}
											</p>
											{onFocusSection && (
												<div className="mt-2">
													<Button
														variant="ghost"
														size="sm"
														className="h-7 px-2 text-[11px]"
														onClick={() => handleFocusLinkedSection(linkedSection.key)}>
														Open {linkedSection.label}
													</Button>
												</div>
											)}
										</div>
									)}
									{!linkedSection && item.section !== "unspecified" && (
										<div className="mt-2 rounded-lg border bg-background/80 p-2.5 text-[11px] text-muted-foreground">
											<div className="flex items-center gap-1 text-foreground">
												<Sparkles className="h-3 w-3 text-sky-600" />
												<span className="font-medium">Section not linked yet</span>
											</div>
											<p className="mt-1">
												This revision item names{" "}
												<span className="font-medium text-foreground">{item.section}</span>, but
												the workspace could not match it to a current manuscript section.
											</p>
										</div>
									)}
								</div>
							</div>
						)
					})}
					{items.length > 4 && (
						<div className="text-xs text-muted-foreground">
							Showing 4 of {items.length} structured revision items. Open the raw log to review the rest.
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default React.memo(RevisionTrackerPanel)
