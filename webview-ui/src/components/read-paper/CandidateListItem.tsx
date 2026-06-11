import { BookPlus, ChevronDown, CircleSlash, Download, ExternalLink, FileText, MoreHorizontal } from "lucide-react"
import { RETRIEVAL_SOURCE_OPTIONS } from "@roo-code/types"

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	StandardTooltip,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { buildCandidateUrl, isCandidateImported } from "./readPaperWorkflow"
import type { CandidateDecisionState, RetrievalCandidate, Source } from "./types"

export type CandidateListItemProps = {
	candidate: RetrievalCandidate
	isAbstractOpen: boolean
	archiveMenuCandidateNo: string | null
	onToggleAbstract: (candidateNo: string) => void
	onOpenCandidateUrl: (candidate: RetrievalCandidate) => void
	onSetCandidateState: (candidateNo: string, state: CandidateDecisionState) => void
	onImportCandidate: (candidateNo: string, downloadPdfToReference?: boolean) => void
	onAnalyzeCandidatePdf?: (pdfPath: string) => void
	onArchiveMenuCandidateNoChange: (candidateNo: string | null) => void
	onCloseArchiveMenuOnBlur: () => void
}

const LEGACY_ARXIV_ID_PATTERN = String.raw`[a-z-]+(?:\.[A-Z]{2})?/\d{7}(?:v\d+)?`
const MODERN_ARXIV_ID_PATTERN = String.raw`\d{4}\.\d{4,5}(?:v\d+)?`
const ARXIV_ID_PATTERN = String.raw`(?:${LEGACY_ARXIV_ID_PATTERN}|${MODERN_ARXIV_ID_PATTERN})`
const STRICT_ARXIV_ID_PATTERN = new RegExp(String.raw`^${ARXIV_ID_PATTERN}$`, "i")
const EXPLICIT_ARXIV_ID_PATTERN = new RegExp(
	String.raw`(?:arxiv(?:\.org/(?:abs|pdf)/|/(?:abs|pdf)/|:|\.)\s*)(${ARXIV_ID_PATTERN})(?:\.pdf)?`,
	"i",
)

const hasArxivIdentifier = (value: string | undefined, allowBareId = false) => {
	const trimmed = value?.trim()
	if (!trimmed) return false
	if (EXPLICIT_ARXIV_ID_PATTERN.test(trimmed)) return true
	return allowBareId && STRICT_ARXIV_ID_PATTERN.test(trimmed.replace(/\.pdf$/i, ""))
}

const hasArxivInfo = (candidate: RetrievalCandidate) =>
	hasArxivIdentifier(candidate.arxiv_id, true) ||
	hasArxivIdentifier(candidate.source_id, candidate.source === "arxiv") ||
	hasArxivIdentifier(candidate.url) ||
	hasArxivIdentifier(candidate.doi)

const formatSourceLabel = (source: Source) =>
	RETRIEVAL_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source

export function CandidateListItem({
	candidate,
	isAbstractOpen,
	archiveMenuCandidateNo,
	onToggleAbstract,
	onOpenCandidateUrl,
	onSetCandidateState,
	onImportCandidate,
	onAnalyzeCandidatePdf,
	onArchiveMenuCandidateNoChange,
	onCloseArchiveMenuOnBlur,
}: CandidateListItemProps) {
	const candidateUrl = buildCandidateUrl(candidate)
	const candidateSupportsArxivDownload = hasArxivInfo(candidate)
	const candidateIsImported = isCandidateImported(candidate)
	const candidateIsExcluded = candidate.state === "已排除"
	const candidateReferencePdfPath = candidate.reference_status?.pdfPath
	const candidateHasReferencePdf = Boolean(candidate.reference_status?.hasPdf)
	const candidateAnalysisPath = candidate.reference_status?.analysisPath
	const candidateHasAnalysis = Boolean(candidate.reference_status?.hasAnalysis)
	const candidateNeedsReferenceDownload =
		candidateSupportsArxivDownload && candidateIsImported && !candidateHasReferencePdf
	const candidatePdfAlreadyDownloaded =
		candidateSupportsArxivDownload && candidateIsImported && candidateHasReferencePdf
	const candidateCanBeImported = !candidateIsImported && !candidateIsExcluded
	const candidateHasPdfMenuAction =
		candidatePdfAlreadyDownloaded ||
		(candidateSupportsArxivDownload && (candidateCanBeImported || candidateNeedsReferenceDownload))
	const isArchiveMenuOpen = archiveMenuCandidateNo === candidate.candidate_no
	const candidateStatusLabel = candidateIsImported ? "Imported" : candidateIsExcluded ? "Excluded" : "Pending"

	return (
		<article className="group bg-vscode-editor-background px-4 py-3 hover:bg-vscode-list-hoverBackground">
			<div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
				<div className="min-w-0 flex-1">
					<h5 className="min-w-0 break-words text-sm font-semibold leading-snug text-vscode-editor-foreground">
						{candidate.title}
					</h5>

					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{candidate.authors?.length > 0 && (
							<span className="min-w-0 truncate">
								{candidate.authors.slice(0, 3).join(", ")}
								{candidate.authors.length > 3 ? " et al." : ""}
							</span>
						)}
						{candidate.year && <span>{candidate.year}</span>}
						{candidate.venue && <span className="min-w-0 truncate">{candidate.venue}</span>}
						<span>{formatSourceLabel(candidate.source)}</span>
						{candidate.source_id && <span className="break-all">{candidate.source_id}</span>}
						<span>{candidate.candidate_no}</span>
						<span>{candidateStatusLabel}</span>
						{candidateHasReferencePdf && <span>PDF</span>}
						{candidateHasAnalysis && (
							<span title={candidateAnalysisPath} className="text-vscode-testing-iconPassed">
								Analyzed
							</span>
						)}
					</div>

					{candidate.relevance_reason && (
						<p className="mt-2 break-words text-xs text-muted-foreground">{candidate.relevance_reason}</p>
					)}

					{((candidate.discovery_sources ?? []).length > 0 ||
						(candidate.match_evidence ?? []).length > 0) && (
						<div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
							{(candidate.discovery_sources ?? []).map((source) => (
								<span
									key={`discovery-${candidate.candidate_no}-${source}`}
									className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
									Discovery {source}
								</span>
							))}
							{(candidate.match_evidence ?? []).slice(0, 4).map((evidence) => (
								<span
									key={`evidence-${candidate.candidate_no}-${evidence}`}
									className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
									{evidence}
								</span>
							))}
						</div>
					)}

					{(candidate.metadata_warnings ?? []).length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
							{(candidate.metadata_warnings ?? []).map((warning) => (
								<span
									key={warning}
									className="rounded bg-vscode-badge-background px-2 py-0.5 text-vscode-badge-foreground">
									{warning}
								</span>
							))}
						</div>
					)}

					{candidate.abstract && isAbstractOpen && (
						<div className="mt-3 rounded-md border border-vscode-panel-border bg-vscode-editorWidget-background p-3">
							<p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-vscode-editor-foreground">
								{candidate.abstract}
							</p>
							<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
								{candidate.doi && <span className="break-all">DOI {candidate.doi}</span>}
								{candidate.source_id && (
									<span className="break-all">Source ID {candidate.source_id}</span>
								)}
								{candidate.pmid && <span>PMID {candidate.pmid}</span>}
								{candidate.arxiv_id && <span>arXiv {candidate.arxiv_id}</span>}
								{candidate.url && <span className="min-w-0 truncate">{candidate.url}</span>}
							</div>
						</div>
					)}
				</div>

				<div className="flex shrink-0 flex-row items-start justify-between gap-2 md:min-w-44 md:flex-col md:items-end">
					<div className="flex flex-wrap justify-start gap-1 text-[11px] tabular-nums text-muted-foreground md:justify-end">
						{typeof candidate.existence_confidence === "number" && (
							<span className="rounded border border-vscode-panel-border px-2 py-0.5">
								Existence {Math.round(candidate.existence_confidence * 100)}%
							</span>
						)}
						{typeof candidate.relevance_confidence === "number" && (
							<span className="rounded border border-vscode-panel-border px-2 py-0.5">
								Relevance {Math.round(candidate.relevance_confidence * 100)}%
							</span>
						)}
					</div>

					<div
						className={cn(
							"flex shrink-0 flex-wrap justify-start gap-1 transition-opacity md:justify-end",
							"md:opacity-65 md:group-hover:opacity-100 md:focus-within:opacity-100",
						)}>
						{candidate.abstract && (
							<StandardTooltip content={isAbstractOpen ? "Hide abstract" : "Show abstract"}>
								<Button
									variant="ghost"
									size="icon"
									aria-label={isAbstractOpen ? "Hide abstract" : "Show abstract"}
									aria-expanded={isAbstractOpen}
									onClick={() => onToggleAbstract(candidate.candidate_no)}>
									<ChevronDown
										className={cn("h-4 w-4 transition-transform", isAbstractOpen && "rotate-180")}
										aria-hidden="true"
									/>
								</Button>
							</StandardTooltip>
						)}
						<StandardTooltip content="Open candidate in browser">
							<Button
								variant="outline"
								size="icon"
								aria-label="Open candidate in browser"
								disabled={!candidateUrl}
								onClick={() => onOpenCandidateUrl(candidate)}>
								<ExternalLink className="h-4 w-4" aria-hidden="true" />
							</Button>
						</StandardTooltip>
						{candidateCanBeImported && (
							<StandardTooltip content="Import candidate to library">
								<Button
									variant="outline"
									size="sm"
									aria-label="Import candidate"
									className="h-8 gap-1 px-2"
									onClick={() => onImportCandidate(candidate.candidate_no)}>
									<BookPlus className="h-4 w-4" aria-hidden="true" />
									<span>Import</span>
								</Button>
							</StandardTooltip>
						)}
						{candidateReferencePdfPath && (
							<StandardTooltip content="Analyze local PDF">
								<Button
									variant="outline"
									size="sm"
									aria-label="Analyze local PDF"
									className="h-8 gap-1 px-2"
									onClick={() => onAnalyzeCandidatePdf?.(candidateReferencePdfPath)}>
									<FileText className="h-4 w-4" aria-hidden="true" />
									<span>Analyze</span>
								</Button>
							</StandardTooltip>
						)}
						{!candidateIsImported && !candidateIsExcluded && (
							<StandardTooltip content="Exclude candidate">
								<Button
									variant="outline"
									size="icon"
									aria-label="Exclude candidate"
									onClick={() => onSetCandidateState(candidate.candidate_no, "已排除")}>
									<CircleSlash className="h-4 w-4" aria-hidden="true" />
								</Button>
							</StandardTooltip>
						)}
						{candidateHasPdfMenuAction && (
							<DropdownMenu
								open={isArchiveMenuOpen}
								onOpenChange={(open) => {
									if (open) {
										onArchiveMenuCandidateNoChange(candidate.candidate_no)
										return
									}
									onCloseArchiveMenuOnBlur()
								}}>
								<StandardTooltip content="More candidate actions">
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="icon" aria-label="More candidate actions">
											<MoreHorizontal className="h-4 w-4" aria-hidden="true" />
										</Button>
									</DropdownMenuTrigger>
								</StandardTooltip>
								<DropdownMenuContent align="end" className="min-w-56">
									{candidatePdfAlreadyDownloaded ? (
										<DropdownMenuItem disabled>
											<Download className="h-4 w-4 shrink-0" aria-hidden="true" />
											<span>PDF already in reference/</span>
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem
											onSelect={() => onImportCandidate(candidate.candidate_no, true)}>
											<Download className="h-4 w-4 shrink-0" aria-hidden="true" />
											<span>
												{candidateNeedsReferenceDownload
													? "Download PDF to reference/"
													: "Import and download PDF"}
											</span>
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</div>
		</article>
	)
}
