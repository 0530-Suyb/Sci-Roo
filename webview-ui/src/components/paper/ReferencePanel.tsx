import React, { useCallback, useMemo, useState } from "react"
import {
	BookOpen,
	Search,
	FileOutput,
	Upload,
	AlertTriangle,
	CheckCircle2,
	FileWarning,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	ClipboardPaste,
	Sparkles,
	Library,
	Link2,
} from "lucide-react"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type ReferencePanelProps = {
	referenceEntries: any[]
	uncatalogued: any[]
	cited: string[] | null
	missing: string[] | null
	citationPlaceholderCount?: number
	bibGenerated: boolean
	bibPreview: string | null
	selectedSection?: string | null
	sectionContent?: string
	sectionInsight?: any
	embedded?: boolean
}

function MiniBadge({ label, tone = "muted" }: { label: string; tone?: "muted" | "success" | "warning" | "danger" }) {
	const className =
		tone === "success"
			? "bg-emerald-100 text-emerald-700"
			: tone === "warning"
				? "bg-amber-100 text-amber-700"
				: tone === "danger"
					? "bg-red-100 text-red-700"
					: "bg-muted text-muted-foreground"

	return <span className={`rounded-full px-2 py-1 text-[10px] ${className}`}>{label}</span>
}

function extractCitationKeys(content: string): string[] {
	const keys = new Set<string>()
	const citePattern = /\\cite[tpa]?\{([^}]+)\}/g
	let match: RegExpExecArray | null = citePattern.exec(content)
	while (match) {
		for (const rawKey of match[1].split(",")) {
			const key = rawKey.trim()
			if (key) {
				keys.add(key)
			}
		}
		match = citePattern.exec(content)
	}
	return Array.from(keys)
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
	referenceEntries,
	uncatalogued,
	cited,
	missing,
	citationPlaceholderCount = 0,
	bibGenerated,
	bibPreview,
	selectedSection,
	sectionContent = "",
	sectionInsight,
	embedded = false,
}) => {
	const [expanded, setExpanded] = useState(true)
	const [scanning, setScanning] = useState(false)
	const [generating, setGenerating] = useState(false)
	const [showImportBox, setShowImportBox] = useState(false)
	const [bibImportText, setBibImportText] = useState("")

	const handleScanTex = useCallback(() => {
		setScanning(true)
		vscode.postMessage({
			type: "paperReferenceScanTex",
			action: "referenceScanTex",
		})
		setTimeout(() => setScanning(false), 2000)
	}, [])

	const handleGenerateBib = useCallback(() => {
		setGenerating(true)
		vscode.postMessage({
			type: "paperReferenceGenerateBib",
			action: "referenceGenerateBib",
		})
		setTimeout(() => setGenerating(false), 2000)
	}, [])

	const handleScanPdf = useCallback(() => {
		vscode.postMessage({
			type: "paperReferenceScanPdf",
			action: "referenceScanPdf",
		})
	}, [])

	const handleBatchImport = useCallback(() => {
		if (!bibImportText.trim()) return
		vscode.postMessage({
			type: "paperReferenceBatchImport",
			action: "referenceBatchImport",
			text: bibImportText,
		})
		setBibImportText("")
		setShowImportBox(false)
	}, [bibImportText])

	const citationCount = cited?.length ?? 0
	const missingCount = missing?.length ?? 0
	const entryCount = referenceEntries?.length ?? 0
	const uncataloguedCount = uncatalogued?.length ?? 0
	const sectionCitationKeys = useMemo(() => extractCitationKeys(sectionContent), [sectionContent])
	const sectionCitationSet = useMemo(() => new Set(sectionCitationKeys), [sectionCitationKeys])
	const sectionMissingKeys = useMemo(
		() => sectionCitationKeys.filter((key) => missing?.includes(key)),
		[missing, sectionCitationKeys],
	)
	const prioritizedEntries = useMemo(() => {
		const entries = [...referenceEntries]
		return entries.sort((a, b) => {
			const aScore = (sectionCitationSet.has(a.citeKey) ? 4 : 0) + ((cited?.includes(a.citeKey) ? 1 : 0) ? 1 : 0)
			const bScore = (sectionCitationSet.has(b.citeKey) ? 4 : 0) + ((cited?.includes(b.citeKey) ? 1 : 0) ? 1 : 0)
			return bScore - aScore
		})
	}, [cited, referenceEntries, sectionCitationSet])
	const primarySummary = useMemo(() => {
		if (citationPlaceholderCount > 0) {
			return `${citationPlaceholderCount} citation placeholder${citationPlaceholderCount > 1 ? "s still need sources" : " still needs a source"}.`
		}
		if (missingCount > 0) {
			return `${missingCount} cited key${missingCount > 1 ? "s are" : " is"} unresolved.`
		}
		if (citationCount > 0) {
			return "All cited keys are present in the library."
		}
		if (entryCount > 0) {
			return "Library is ready. Scan citations when you want to check the current draft."
		}
		return "Add BibTeX or PDFs when you are ready to build the reference library."
	}, [citationCount, citationPlaceholderCount, entryCount, missingCount])
	const visibleEntries = embedded ? prioritizedEntries.slice(0, 24) : prioritizedEntries.slice(0, 50)
	const topMissingKeys = useMemo(
		() => (missing ?? []).slice(0, embedded ? 6 : (missing?.length ?? 0)),
		[embedded, missing],
	)
	const topUncatalogued = useMemo(
		() => (uncatalogued ?? []).slice(0, embedded ? 4 : (uncatalogued?.length ?? 0)),
		[embedded, uncatalogued],
	)

	if (embedded) {
		return (
			<div className="flex h-full flex-col overflow-auto bg-[linear-gradient(180deg,rgba(234,179,8,0.04),transparent_18%,transparent)]">
				<div className="border-b px-4 py-3">
					<div className="flex items-center gap-2">
						<BookOpen className="h-4 w-4" />
						<div>
							<div className="text-sm font-medium">References</div>
							<div className="text-[11px] text-muted-foreground">{primarySummary}</div>
						</div>
					</div>
					<div className="mt-3 flex flex-wrap gap-1.5">
						<MiniBadge label={`${citationCount} cited`} />
						<MiniBadge label={`${entryCount} in library`} tone={entryCount > 0 ? "success" : "muted"} />
						{citationPlaceholderCount > 0 && (
							<MiniBadge label={`${citationPlaceholderCount} placeholders`} tone="warning" />
						)}
						{missingCount > 0 && <MiniBadge label={`${missingCount} missing`} tone="danger" />}
						{uncataloguedCount > 0 && (
							<MiniBadge label={`${uncataloguedCount} PDFs to catalog`} tone="warning" />
						)}
						{bibGenerated && <MiniBadge label=".bib ready" tone="success" />}
					</div>
				</div>

				<div className="border-b px-4 py-3">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant="outline"
							size="sm"
							className="justify-start text-xs"
							onClick={handleScanTex}
							disabled={scanning}>
							<Search className="mr-1.5 h-3 w-3" />
							{scanning ? "Scanning..." : "Scan citations"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="justify-start text-xs"
							onClick={handleGenerateBib}
							disabled={generating}>
							<FileOutput className="mr-1.5 h-3 w-3" />
							{generating ? "Generating..." : "Generate .bib"}
						</Button>
						<Button variant="outline" size="sm" className="justify-start text-xs" onClick={handleScanPdf}>
							<FileWarning className="mr-1.5 h-3 w-3" />
							Scan PDFs
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="justify-start text-xs"
							onClick={() => setShowImportBox((show) => !show)}>
							<Upload className="mr-1.5 h-3 w-3" />
							{showImportBox ? "Hide import" : "Import BibTeX"}
						</Button>
					</div>
					{showImportBox && (
						<div className="mt-3 rounded-xl border bg-background p-2.5">
							<div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium">
								<ClipboardPaste className="h-3 w-3 text-muted-foreground" />
								Paste BibTeX entries
							</div>
							<textarea
								className="min-h-24 w-full resize-y rounded-md border bg-muted/20 px-2 py-1.5 text-[11px] font-mono"
								placeholder="@inproceedings{...}"
								value={bibImportText}
								onChange={(e) => setBibImportText(e.target.value)}
							/>
							<div className="mt-2 flex gap-2">
								<Button
									variant="primary"
									size="sm"
									className="flex-1 text-xs"
									disabled={!bibImportText.trim()}
									onClick={handleBatchImport}>
									Import entries
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="text-xs"
									onClick={() => setBibImportText("")}>
									Clear
								</Button>
							</div>
						</div>
					)}
				</div>

				<div className="space-y-3 px-4 py-3">
					{citationPlaceholderCount > 0 && (
						<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
							<div className="flex items-center gap-1 text-xs font-medium text-amber-700">
								<AlertTriangle className="h-3.5 w-3.5" />
								Citation placeholders
							</div>
							<p className="mt-1 text-[11px] text-amber-700/90">
								The manuscript still contains {citationPlaceholderCount} `[CITATION NEEDED]` placeholder
								{citationPlaceholderCount > 1 ? "s" : ""}. Resolve them before submission.
							</p>
							<div className="mt-2 rounded-lg border border-amber-200/70 bg-background/70 px-2.5 py-2 text-[11px] text-amber-800">
								Suggested path: import BibTeX for known papers, scan uncatalogued PDFs if you already
								dropped files into `reference/`, then re-scan citations before generating the final
								`.bib`.
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									className="text-xs"
									onClick={() => setShowImportBox(true)}>
									Import BibTeX
								</Button>
								<Button variant="outline" size="sm" className="text-xs" onClick={handleScanPdf}>
									Scan PDFs
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="text-xs"
									onClick={handleScanTex}
									disabled={scanning}>
									{scanning ? "Scanning..." : "Re-scan citations"}
								</Button>
							</div>
						</div>
					)}

					{missingCount > 0 && (
						<div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
							<div className="flex items-center gap-1 text-xs font-medium text-red-700">
								<AlertTriangle className="h-3.5 w-3.5" />
								Missing cite keys
							</div>
							<p className="mt-1 text-[11px] text-red-700/90">
								These keys are cited in the manuscript but are not in your reference library yet.
							</p>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{topMissingKeys.map((citeKey) => (
									<span
										key={citeKey}
										className="rounded-full bg-background px-2 py-1 font-mono text-[10px] text-red-700">
										{citeKey}
									</span>
								))}
								{missingCount > topMissingKeys.length && (
									<span className="rounded-full bg-background px-2 py-1 text-[10px] text-red-700">
										+{missingCount - topMissingKeys.length} more
									</span>
								)}
							</div>
						</div>
					)}

					{uncataloguedCount > 0 && (
						<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
							<div className="flex items-center gap-1 text-xs font-medium text-amber-700">
								<FileWarning className="h-3.5 w-3.5" />
								Uncatalogued PDFs
							</div>
							<p className="mt-1 text-[11px] text-amber-700/90">
								These PDFs exist in `reference/` but do not have matching metadata entries yet.
							</p>
							<div className="mt-2 space-y-1">
								{topUncatalogued.map((item: any, i: number) => (
									<div key={i} className="truncate font-mono text-[10px] text-amber-700">
										{item.fileName || item.path || item}
									</div>
								))}
								{uncataloguedCount > topUncatalogued.length && (
									<div className="text-[10px] text-amber-700">
										+{uncataloguedCount - topUncatalogued.length} more files
									</div>
								)}
							</div>
						</div>
					)}

					<div className="rounded-xl border bg-muted/20 p-3">
						<div className="mb-2 flex items-center gap-1 text-xs font-medium">
							<Library className="h-3.5 w-3.5 text-sky-600" />
							Library highlights
						</div>
						{visibleEntries.length > 0 ? (
							<div className="space-y-2">
								{visibleEntries.slice(0, 8).map((entry: any) => {
									const isCited = cited ? cited.includes(entry.citeKey) : false
									return (
										<div
											key={entry.citeKey}
											className="rounded-lg border bg-background/80 px-2.5 py-2">
											<div className="flex items-center justify-between gap-2">
												<div className="min-w-0">
													<div className="truncate text-xs font-medium">{entry.citeKey}</div>
													{entry.title && (
														<div className="mt-0.5 truncate text-[10px] text-muted-foreground">
															{entry.title}
														</div>
													)}
												</div>
												<div className="flex shrink-0 gap-1">
													{isCited && <MiniBadge label="Used" tone="success" />}
													{entry.hasPdf && <MiniBadge label="PDF" />}
												</div>
											</div>
										</div>
									)
								})}
								{referenceEntries.length > 8 && (
									<div className="text-[11px] text-muted-foreground">
										Showing the first 8 library entries in this side panel.
									</div>
								)}
							</div>
						) : (
							<p className="text-[11px] text-muted-foreground">
								No references in the library yet. Import BibTeX or scan PDFs to get started.
							</p>
						)}
					</div>

					{bibPreview && (
						<div className="rounded-xl border bg-muted/20 p-3">
							<div className="mb-1.5 flex items-center justify-between">
								<p className="text-xs font-medium text-emerald-700">Latest .bib preview</p>
								<ExternalLink className="h-3 w-3 text-muted-foreground" />
							</div>
							<pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-background/80 p-2 text-[10px] font-mono">
								{bibPreview}
							</pre>
						</div>
					)}
				</div>
			</div>
		)
	}

	return (
		<div
			className={`overflow-auto flex flex-col bg-[linear-gradient(180deg,rgba(234,179,8,0.05),transparent_22%,transparent)] ${
				embedded ? "h-full" : "w-72 border-l shrink-0"
			}`}>
			{/* Header */}
			<div className="px-3 py-2 border-b flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<BookOpen className="w-4 h-4" />
					<span className="text-sm font-medium">References</span>
				</div>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground transition-colors"
					onClick={() => setExpanded(!expanded)}>
					{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
				</button>
			</div>

			{expanded && (
				<>
					{/* Actions */}
					<div className="p-2 space-y-1.5 border-b">
						<div className="rounded-xl border bg-muted/40 p-2 text-[11px] text-muted-foreground">
							<div className="mb-1 flex items-center gap-1 font-medium text-foreground">
								<Sparkles className="h-3 w-3 text-amber-600" />
								Reference focus
							</div>
							<div>{primarySummary}</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="w-full text-xs justify-start"
							onClick={handleScanTex}
							disabled={scanning}>
							<Search className="w-3 h-3 mr-1.5" />
							{scanning ? "Scanning..." : "Scan .tex files"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="w-full text-xs justify-start"
							onClick={handleGenerateBib}
							disabled={generating}>
							<FileOutput className="w-3 h-3 mr-1.5" />
							{generating ? "Generating..." : "Generate .bib"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="w-full text-xs justify-start"
							onClick={handleScanPdf}>
							<FileWarning className="w-3 h-3 mr-1.5" />
							Scan uncatalogued PDFs
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="w-full text-xs justify-start"
							onClick={() => setShowImportBox((show) => !show)}>
							<Upload className="w-3 h-3 mr-1.5" />
							{showImportBox ? "Hide BibTeX import" : "Paste BibTeX to import"}
						</Button>
						{showImportBox && (
							<div className="rounded-xl border bg-background p-2">
								<div className="mb-1 flex items-center gap-1 text-[11px] font-medium">
									<ClipboardPaste className="h-3 w-3 text-muted-foreground" />
									Paste BibTeX entries
								</div>
								<textarea
									className="min-h-24 w-full resize-y rounded-md border bg-muted/20 px-2 py-1.5 text-[11px] font-mono"
									placeholder="@inproceedings{...}"
									value={bibImportText}
									onChange={(e) => setBibImportText(e.target.value)}
								/>
								<div className="mt-2 flex gap-2">
									<Button
										variant="primary"
										size="sm"
										className="flex-1 text-xs"
										disabled={!bibImportText.trim()}
										onClick={handleBatchImport}>
										Import entries
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="text-xs"
										onClick={() => setBibImportText("")}>
										Clear
									</Button>
								</div>
							</div>
						)}
					</div>

					{/* Stats */}
					<div className="px-3 py-2 border-b space-y-1 text-xs">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Citations:</span>
							<span className="font-mono">{citationCount}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">In library:</span>
							<span className="font-mono">{entryCount}</span>
						</div>
						{uncataloguedCount > 0 && (
							<div className="flex items-center justify-between text-amber-600">
								<span className="flex items-center gap-1">
									<AlertTriangle className="w-3 h-3" />
									Uncatalogued:
								</span>
								<span className="font-mono">{uncataloguedCount}</span>
							</div>
						)}
						{missingCount > 0 && (
							<div className="flex items-center justify-between text-red-500">
								<span className="flex items-center gap-1">
									<AlertTriangle className="w-3 h-3" />
									Missing:
								</span>
								<span className="font-mono">{missingCount}</span>
							</div>
						)}
						{bibGenerated && (
							<div className="flex items-center gap-1 text-green-600">
								<CheckCircle2 className="w-3 h-3" />
								<span>.bib generated</span>
							</div>
						)}
						{missingCount === 0 && citationCount > 0 && (
							<div className="flex items-center gap-1 text-emerald-600">
								<CheckCircle2 className="w-3 h-3" />
								<span>All cited keys are present in the library</span>
							</div>
						)}
					</div>

					{selectedSection && (
						<div className="border-b p-2">
							<div className="rounded-xl border bg-background/80 p-2.5">
								<div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-foreground">
									<Library className="h-3 w-3 text-sky-600" />
									Current section focus
								</div>
								<div className="text-[11px] text-muted-foreground">
									<span className="font-medium text-foreground">
										{selectedSection.replace(/-/g, " ")}
									</span>
									{sectionInsight?.readiness && <> · {sectionInsight.readiness}</>}
								</div>
								<div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
									<span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
										{sectionCitationKeys.length} cites in this section
									</span>
									{sectionMissingKeys.length > 0 && (
										<span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
											{sectionMissingKeys.length} missing here
										</span>
									)}
								</div>
								{sectionMissingKeys.length > 0 ? (
									<div className="mt-2 space-y-1">
										<div className="text-[10px] font-medium uppercase tracking-wide text-amber-700">
											Missing in this section
										</div>
										<div className="space-y-1">
											{sectionMissingKeys.map((citeKey) => (
												<div
													key={citeKey}
													className="flex items-center gap-1 text-[10px] text-amber-700">
													<Link2 className="h-2.5 w-2.5 shrink-0" />
													<span className="font-mono truncate">{citeKey}</span>
												</div>
											))}
										</div>
									</div>
								) : sectionCitationKeys.length > 0 ? (
									<p className="mt-2 text-[10px] text-emerald-700">
										All cite keys used in this section are present in the library.
									</p>
								) : (
									<p className="mt-2 text-[10px] text-muted-foreground">
										No explicit cite keys detected in the current section yet.
									</p>
								)}
							</div>
						</div>
					)}

					{/* Reference entry list */}
					<div className="flex-1 overflow-auto p-1.5 space-y-0.5">
						{!embedded && (
							<div className="px-2 pb-2 text-[11px] text-muted-foreground">
								Library entries are shown here so you can quickly spot which cited papers are already
								catalogued and which still need cleanup.
							</div>
						)}
						{referenceEntries.length === 0 && (
							<div className="text-xs text-muted-foreground text-center py-4">
								No references in library.
							</div>
						)}
						{visibleEntries.map((entry: any) => {
							const isCited = cited ? cited.includes(entry.citeKey) : false
							const isMissing = missing ? missing.includes(entry.citeKey) : false
							const isInCurrentSection = sectionCitationSet.has(entry.citeKey)
							return (
								<div
									key={entry.citeKey}
									className={`px-2 py-1 rounded text-xs ${
										isMissing
											? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
											: isInCurrentSection
												? "bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800"
												: "hover:bg-muted/50"
									}`}>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1 min-w-0">
											{isCited ? (
												<CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
											) : isMissing ? (
												<AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
											) : (
												<BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
											)}
											<span className="truncate font-medium">{entry.citeKey}</span>
										</div>
										{isInCurrentSection && (
											<span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
												Current section
											</span>
										)}
									</div>
									{entry.title && (
										<p className="text-[10px] text-muted-foreground truncate mt-0.5 ml-4">
											{entry.title}
										</p>
									)}
									<div className="ml-4 mt-1 flex items-center gap-2">
										{entry.hasPdf && (
											<span className="text-[10px] text-blue-500">PDF available</span>
										)}
										{entry.venue && (
											<span className="text-[10px] text-muted-foreground truncate">
												{entry.venue}
											</span>
										)}
									</div>
								</div>
							)
						})}
						{embedded && prioritizedEntries.length > visibleEntries.length && (
							<div className="px-2 pt-2 text-[11px] text-muted-foreground">
								Showing the first {visibleEntries.length} entries in this side panel.
							</div>
						)}
					</div>

					{/* Missing citations */}
					{missing && missing.length > 0 && (
						<div className="border-t p-2">
							<p className="text-xs font-medium text-red-500 mb-1">
								Missing from library ({missing.length}):
							</p>
							<p className="mb-2 text-[10px] text-muted-foreground">
								These keys are cited in the manuscript but do not exist in `reference/`. Import them
								before finalizing the bibliography.
							</p>
							<div className="space-y-0.5 max-h-24 overflow-auto">
								{missing.map((citeKey: string) => (
									<div key={citeKey} className="text-[10px] text-red-500 flex items-center gap-1">
										<FileWarning className="w-2.5 h-2.5 shrink-0" />
										<span className="font-mono truncate">{citeKey}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Uncatalogued PDFs */}
					{uncatalogued && uncatalogued.length > 0 && (
						<div className="border-t p-2">
							<p className="text-xs font-medium text-amber-500 mb-1">
								Uncatalogued PDFs ({uncatalogued.length}):
							</p>
							<p className="mb-2 text-[10px] text-muted-foreground">
								These PDFs exist in `reference/` but have no matching metadata entry yet.
							</p>
							<div className="space-y-0.5 max-h-24 overflow-auto">
								{uncatalogued.map((item: any, i: number) => (
									<div key={i} className="text-[10px] text-amber-500 flex items-center gap-1">
										<FileWarning className="w-2.5 h-2.5 shrink-0" />
										<span className="font-mono truncate">{item.fileName || item.path || item}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Bib preview */}
					{bibPreview && (
						<div className="border-t p-2">
							<div className="mb-1 flex items-center justify-between">
								<p className="text-xs font-medium text-green-600">.bib preview</p>
								<ExternalLink className="h-3 w-3 text-muted-foreground" />
							</div>
							<pre className="text-[10px] whitespace-pre-wrap p-1.5 rounded bg-muted/30 font-mono max-h-32 overflow-auto">
								{bibPreview}
							</pre>
						</div>
					)}
				</>
			)}
		</div>
	)
}

export default React.memo(ReferencePanel)
