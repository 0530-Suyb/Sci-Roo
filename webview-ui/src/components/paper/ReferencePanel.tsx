import React, { useCallback, useState } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type ReferencePanelProps = {
	referenceEntries: any[]
	uncatalogued: any[]
	cited: string[] | null
	missing: string[] | null
	bibGenerated: boolean
	bibPreview: string | null
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
	referenceEntries,
	uncatalogued,
	cited,
	missing,
	bibGenerated,
	bibPreview,
}) => {
	const [expanded, setExpanded] = useState(true)
	const [scanning, setScanning] = useState(false)
	const [generating, setGenerating] = useState(false)

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
		// TODO: Open file picker for .bib file — for now use a text prompt
		const bibContent = prompt("Paste BibTeX content to import:")
		if (bibContent) {
			vscode.postMessage({
				type: "paperReferenceBatchImport",
				action: "referenceBatchImport",
				text: bibContent,
			})
		}
	}, [])

	const citationCount = cited?.length ?? 0
	const missingCount = missing?.length ?? 0
	const entryCount = referenceEntries?.length ?? 0
	const uncataloguedCount = uncatalogued?.length ?? 0

	return (
		<div className="w-56 border-l shrink-0 overflow-auto flex flex-col">
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
							onClick={handleBatchImport}>
							<Upload className="w-3 h-3 mr-1.5" />
							Import .bib file
						</Button>
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
					</div>

					{/* Reference entry list */}
					<div className="flex-1 overflow-auto p-1.5 space-y-0.5">
						{referenceEntries.length === 0 && (
							<div className="text-xs text-muted-foreground text-center py-4">
								No references in library.
							</div>
						)}
						{referenceEntries.slice(0, 50).map((entry: any) => {
							const isCited = cited ? cited.includes(entry.citeKey) : false
							const isMissing = missing ? missing.includes(entry.citeKey) : false
							return (
								<div
									key={entry.citeKey}
									className={`px-2 py-1 rounded text-xs ${
										isMissing
											? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
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
									</div>
									{entry.title && (
										<p className="text-[10px] text-muted-foreground truncate mt-0.5 ml-4">
											{entry.title}
										</p>
									)}
									{entry.hasPdf && (
										<span className="text-[10px] text-blue-500 ml-4">PDF available</span>
									)}
								</div>
							)
						})}
					</div>

					{/* Missing citations */}
					{missing && missing.length > 0 && (
						<div className="border-t p-2">
							<p className="text-xs font-medium text-red-500 mb-1">
								Missing from library ({missing.length}):
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
							<p className="text-xs font-medium text-green-600 mb-1">.bib preview:</p>
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
