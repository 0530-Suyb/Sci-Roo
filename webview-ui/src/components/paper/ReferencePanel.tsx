import React, { useMemo, useRef, useState } from "react"
import {
	AlertTriangle,
	BookOpen,
	ChevronDown,
	ChevronRight,
	FileOutput,
	FileWarning,
	Library,
	Search,
	Upload,
} from "lucide-react"
import type { CitationPlaceholderEntry, VerificationEntry, VerificationStore } from "@roo-code/types"

import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

type ReferencePanelProps = {
	referenceEntries: any[]
	uncatalogued: any[]
	cited: string[] | null
	missing: string[] | null
	citationPlaceholderCount?: number
	citationPlaceholders?: CitationPlaceholderEntry[]
	bibGenerated: boolean
	bibPreview: string | null
	selectedSection?: string | null
	sectionContent?: string
	sectionInsight?: any
	embedded?: boolean
	verificationState?: VerificationStore
	sectionCiteMap?: Record<string, string[]>
	citeLineMap?: Record<string, number[]>
	currentSection?: string | null
	onFixFlaggedCitations?: (entries: VerificationEntry[]) => void
	onVerifyCitation?: (citeKey: string) => void
	onVerifyAllCitations?: () => void
	onDismissCitationIssue?: (citeKey: string) => void
	onJumpToCitation?: (citeKey: string, line?: number) => void
	onJumpToPlaceholder?: (placeholder: CitationPlaceholderEntry) => void
	onFixCitationPlaceholders?: (placeholders: CitationPlaceholderEntry[]) => void
}

function StatusBadge({ status }: { status: VerificationEntry["status"] | "placeholder" }) {
	const label =
		status === "verified"
			? "Ready"
			: status === "flagged"
				? "Flagged"
				: status === "missing"
					? "Missing"
					: status === "placeholder"
						? "Placeholder"
						: "Unverified"
	const className =
		status === "verified"
			? "bg-emerald-100 text-emerald-700"
			: status === "flagged" || status === "missing"
				? "bg-red-100 text-red-700"
				: status === "placeholder"
					? "bg-amber-100 text-amber-700"
					: "bg-muted text-muted-foreground"
	return <span className={`rounded-full px-2 py-1 text-[10px] ${className}`}>{label}</span>
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
	referenceEntries,
	uncatalogued,
	cited,
	missing,
	citationPlaceholderCount = 0,
	citationPlaceholders = [],
	bibGenerated,
	bibPreview,
	embedded = false,
	verificationState,
	sectionCiteMap,
	citeLineMap,
	currentSection,
	onFixFlaggedCitations,
	onVerifyCitation,
	onVerifyAllCitations,
	onDismissCitationIssue,
	onJumpToCitation,
	onJumpToPlaceholder,
	onFixCitationPlaceholders,
}) => {
	const [showImportBox, setShowImportBox] = useState(false)
	const [bibImportText, setBibImportText] = useState("")
	const [libraryExpanded, setLibraryExpanded] = useState(!embedded)
	const [libraryQuery, setLibraryQuery] = useState("")
	const issueSectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const verificationEntries = useMemo(
		() => Object.values(verificationState?.entries ?? {}).filter((entry) => !entry.dismissedByUser),
		[verificationState],
	)
	const dismissedEntries = useMemo(
		() => Object.values(verificationState?.entries ?? {}).filter((entry) => entry.dismissedByUser),
		[verificationState],
	)

	const citedKeys = cited ?? []
	const missingKeys = missing ?? []
	const staleEntries = verificationEntries
		.filter((entry) => entry.stale)
		.map(
			(entry) =>
				({
					...entry,
					status: "unverified",
				}) as VerificationEntry,
		)
	const activeVerificationEntries = verificationEntries.filter((entry) => !entry.stale)
	const verifiedCount = activeVerificationEntries.filter((entry) => entry.status === "verified").length
	const flaggedEntries = activeVerificationEntries.filter((entry) => entry.status === "flagged")
	const explicitMissingEntries = missingKeys
		.filter((citeKey) => !verificationState?.entries?.[citeKey]?.dismissedByUser)
		.map(
			(citeKey) =>
				({
					citeKey,
					status: "missing",
					reason: "missing-local-entry",
					confidence: 0,
				}) as VerificationEntry,
		)
	const trackedVerificationKeys = new Set(verificationEntries.map((entry) => entry.citeKey))
	const inferredUnverifiedEntries = citedKeys
		.filter((citeKey) => !trackedVerificationKeys.has(citeKey) && !missingKeys.includes(citeKey))
		.map(
			(citeKey) =>
				({
					citeKey,
					status: "unverified",
					reason: "local-metadata-only",
					confidence: 0,
				}) as VerificationEntry,
		)
	const unverifiedEntries = [
		...activeVerificationEntries.filter((entry) => entry.status === "unverified"),
		...staleEntries,
		...inferredUnverifiedEntries,
	]
	const currentSectionEntries = currentSection
		? referenceEntries.filter((entry) => sectionCiteMap?.[entry.citeKey]?.includes(currentSection))
		: []
	const filteredLibraryEntries = referenceEntries.filter((entry) => {
		if (!libraryQuery.trim()) return true
		const query = libraryQuery.trim().toLowerCase()
		return entry.citeKey.toLowerCase().includes(query) || entry.title.toLowerCase().includes(query)
	})

	const healthMetrics = {
		ready: verifiedCount,
		unverified: unverifiedEntries.length,
		flagged: flaggedEntries.length,
		missing: explicitMissingEntries.length,
		placeholder: citationPlaceholderCount,
	}
	const quickActionNeedsVerify = healthMetrics.unverified > 0
	const quickActionNeedsFix = healthMetrics.flagged + healthMetrics.missing > 0

	const scrollToIssueSection = (sectionKey: "ready" | "unverified" | "flagged" | "missing" | "placeholder") => {
		if (sectionKey === "ready") {
			setLibraryExpanded(true)
		}
		const target = issueSectionRefs.current[sectionKey]
		target?.scrollIntoView({ behavior: "smooth", block: "start" })
	}

	const handleGenerateBib = () => {
		vscode.postMessage({
			type: "paperReferenceGenerateBib",
			action: "referenceGenerateBib",
		})
	}

	const handleScanPdf = () => {
		vscode.postMessage({
			type: "paperReferenceScanPdf",
			action: "referenceScanPdf",
		})
	}

	const handleBatchImport = () => {
		if (!bibImportText.trim()) return
		vscode.postMessage({
			type: "paperReferenceBatchImport",
			action: "referenceBatchImport",
			text: bibImportText,
		})
		setBibImportText("")
		setShowImportBox(false)
	}

	return (
		<div className="flex h-full flex-col overflow-auto bg-[linear-gradient(180deg,rgba(234,179,8,0.04),transparent_18%,transparent)]">
			<div className="border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<BookOpen className="h-4 w-4" />
					<div>
						<div className="text-sm font-medium">Reference Health</div>
						<div className="text-[11px] text-muted-foreground">
							{flaggedEntries.length > 0
								? "Resolve flagged citations before the next polish pass."
								: explicitMissingEntries.length > 0
									? "Some cite keys are still missing from the library."
									: "Use verification to keep draft citations grounded in the project library. Verification statuses now map directly to these buckets."}
						</div>
					</div>
				</div>
				<div className="mt-3 grid grid-cols-5 gap-2">
					<HealthTile
						label="Ready"
						value={healthMetrics.ready}
						tone="success"
						onClick={() => scrollToIssueSection("ready")}
					/>
					<HealthTile
						label="Unverified"
						value={healthMetrics.unverified}
						tone="muted"
						onClick={() => scrollToIssueSection("unverified")}
					/>
					<HealthTile
						label="Flagged"
						value={healthMetrics.flagged}
						tone="danger"
						onClick={() => scrollToIssueSection("flagged")}
					/>
					<HealthTile
						label="Missing"
						value={healthMetrics.missing}
						tone="danger"
						onClick={() => scrollToIssueSection("missing")}
					/>
					<HealthTile
						label="Placeholder"
						value={healthMetrics.placeholder}
						tone="warning"
						onClick={() => scrollToIssueSection("placeholder")}
					/>
				</div>
				{(quickActionNeedsVerify || quickActionNeedsFix) && (
					<div className="mt-3 flex flex-wrap gap-2">
						{quickActionNeedsVerify && (
							<Button variant="primary" size="sm" onClick={() => onVerifyAllCitations?.()}>
								<Search className="mr-1.5 h-3 w-3" />
								Verify unverified citations
							</Button>
						)}
						{quickActionNeedsFix && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => onFixFlaggedCitations?.([...flaggedEntries, ...explicitMissingEntries])}>
								Fix flagged issues with Agent
							</Button>
						)}
					</div>
				)}
			</div>

			<div className="border-b px-4 py-3">
				<div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
					Needs Attention
				</div>
				<div className="mt-3 space-y-3">
					{flaggedEntries.length > 0 && (
						<div ref={(node) => (issueSectionRefs.current.flagged = node)}>
							<IssueGroup
								title="Flagged citations"
								description="These citations have conflicting or low-confidence metadata matches and need review."
								entries={flaggedEntries}
								onFixFlaggedCitations={onFixFlaggedCitations}
								onVerifyCitation={onVerifyCitation}
								onDismissCitationIssue={onDismissCitationIssue}
								onJumpToCitation={(citeKey) => onJumpToCitation?.(citeKey, citeLineMap?.[citeKey]?.[0])}
							/>
						</div>
					)}
					{explicitMissingEntries.length > 0 && (
						<div ref={(node) => (issueSectionRefs.current.missing = node)}>
							<IssueGroup
								title="Missing cite keys"
								description="The draft references cite keys that are not in the local reference library."
								entries={explicitMissingEntries}
								onFixFlaggedCitations={onFixFlaggedCitations}
								onVerifyCitation={onVerifyCitation}
								onDismissCitationIssue={onDismissCitationIssue}
								onJumpToCitation={(citeKey) => onJumpToCitation?.(citeKey, citeLineMap?.[citeKey]?.[0])}
							/>
						</div>
					)}
					{unverifiedEntries.length > 0 && (
						<div ref={(node) => (issueSectionRefs.current.unverified = node)}>
							<IssueGroup
								title="Unverified citations"
								description="These cited references exist locally but have not been verified yet."
								entries={unverifiedEntries}
								onFixFlaggedCitations={onFixFlaggedCitations}
								onVerifyCitation={onVerifyCitation}
								onDismissCitationIssue={onDismissCitationIssue}
								onJumpToCitation={(citeKey) => onJumpToCitation?.(citeKey, citeLineMap?.[citeKey]?.[0])}
							/>
						</div>
					)}
					{citationPlaceholderCount > 0 && (
						<div
							ref={(node) => (issueSectionRefs.current.placeholder = node)}
							className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
							<div className="flex items-center justify-between gap-2">
								<div>
									<div className="text-sm font-medium">Citation placeholders</div>
									<div className="text-xs text-muted-foreground">
										{citationPlaceholderCount} placeholder
										{citationPlaceholderCount > 1
											? "s still need sources."
											: " still needs a source."}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{citationPlaceholders.length > 0 && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => onFixCitationPlaceholders?.(citationPlaceholders)}>
											Fix with Agent
										</Button>
									)}
									<StatusBadge status="placeholder" />
								</div>
							</div>
							{citationPlaceholders.length > 0 && (
								<div className="mt-3 space-y-2">
									{citationPlaceholders.map((placeholder, index) => (
										<div
											key={`${placeholder.line}-${index}`}
											className="rounded-lg border border-amber-200 bg-background/70 p-2.5">
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<div className="text-sm font-medium">
														Line {placeholder.line}
														{placeholder.detail ? `: ${placeholder.detail}` : ""}
													</div>
													<div className="mt-1 break-words text-xs text-muted-foreground">
														{placeholder.text}
													</div>
												</div>
												<div className="flex flex-wrap gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => onJumpToPlaceholder?.(placeholder)}>
														Jump to placeholder
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => onFixCitationPlaceholders?.([placeholder])}>
														Fix with Agent
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}
					{flaggedEntries.length === 0 &&
						explicitMissingEntries.length === 0 &&
						unverifiedEntries.length === 0 &&
						citationPlaceholderCount === 0 && (
							<div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700">
								All tracked citations are verified or accounted for.
							</div>
						)}
					{dismissedEntries.length > 0 && (
						<details className="rounded-xl border bg-background/70 p-3">
							<summary className="cursor-pointer text-sm font-medium">
								Dismissed issues ({dismissedEntries.length})
							</summary>
							<div className="mt-3 space-y-2">
								{dismissedEntries.map((entry) => (
									<div key={entry.citeKey} className="rounded-lg border p-2.5">
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<div className="truncate text-sm font-medium">{entry.citeKey}</div>
													<StatusBadge status={entry.status} />
												</div>
												<div className="mt-1 text-xs text-muted-foreground">
													{entry.dismissedReason ?? entry.reason}
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => onVerifyCitation?.(entry.citeKey)}>
												Verify again
											</Button>
										</div>
									</div>
								))}
							</div>
						</details>
					)}
				</div>
			</div>

			<div className="border-b px-4 py-3">
				<div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
					<Library className="h-3.5 w-3.5" />
					Cited In Current Section
				</div>
				<div className="mt-3">
					{currentSection ? (
						<>
							<div className="text-sm font-medium">{currentSection}</div>
							<div className="mt-2 flex flex-wrap gap-2">
								{currentSectionEntries.length > 0 ? (
									currentSectionEntries.map((entry) => (
										<button
											key={entry.citeKey}
											type="button"
											onClick={() =>
												onJumpToCitation?.(entry.citeKey, citeLineMap?.[entry.citeKey]?.[0])
											}
											className="rounded-full border bg-background px-2.5 py-1 text-[11px] transition-colors hover:bg-muted">
											{entry.citeKey}
										</button>
									))
								) : (
									<div className="text-xs text-muted-foreground">
										No citations detected in this section yet.
									</div>
								)}
							</div>
						</>
					) : (
						<div className="text-xs text-muted-foreground">
							Place the cursor in the manuscript to see section-scoped citations.
						</div>
					)}
				</div>
			</div>

			<div ref={(node) => (issueSectionRefs.current.ready = node)} className="px-4 py-3">
				<button
					type="button"
					className="flex w-full items-center justify-between text-left"
					onClick={() => setLibraryExpanded((value) => !value)}>
					<div>
						<div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							Library
						</div>
						<div className="text-xs text-muted-foreground">
							{referenceEntries.length} entries, {uncatalogued.length} uncatalogued PDFs
						</div>
					</div>
					{libraryExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
				</button>

				{libraryExpanded && (
					<div className="mt-3 space-y-3">
						<div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
							<Search className="h-3.5 w-3.5 text-muted-foreground" />
							<input
								className="w-full bg-transparent text-sm outline-none"
								placeholder="Search citeKey or title"
								value={libraryQuery}
								onChange={(event) => setLibraryQuery(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							{filteredLibraryEntries.slice(0, embedded ? 24 : 80).map((entry) => {
								const rawVerificationEntry = verificationState?.entries?.[entry.citeKey]
								const verificationEntry = rawVerificationEntry?.stale
									? ({
											...rawVerificationEntry,
											status: "unverified",
										} as VerificationEntry)
									: (rawVerificationEntry ??
										(citedKeys.includes(entry.citeKey)
											? ({
													citeKey: entry.citeKey,
													status: "unverified",
													reason: "local-metadata-only",
													confidence: 0,
												} as VerificationEntry)
											: undefined))
								return (
									<div key={entry.citeKey} className="rounded-xl border bg-background/80 p-3">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<div className="truncate text-sm font-medium">{entry.citeKey}</div>
													{verificationEntry && (
														<StatusBadge status={verificationEntry.status} />
													)}
												</div>
												<div className="mt-1 truncate text-xs text-muted-foreground">
													{entry.title}
												</div>
												<div className="mt-1 text-[11px] text-muted-foreground">
													{sectionCiteMap?.[entry.citeKey]?.length
														? `Used in: ${sectionCiteMap[entry.citeKey].join(", ")}`
														: "Not cited in the current manuscript scan"}
												</div>
											</div>
											<div className="flex shrink-0 gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => onVerifyCitation?.(entry.citeKey)}>
													Verify
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														onJumpToCitation?.(
															entry.citeKey,
															citeLineMap?.[entry.citeKey]?.[0],
														)
													}>
													Jump
												</Button>
											</div>
										</div>
									</div>
								)
							})}
						</div>
						<div className="flex flex-wrap gap-2 border-t pt-1">
							<Button
								variant="outline"
								size="sm"
								onClick={handleGenerateBib}
								disabled={referenceEntries.length === 0}>
								<FileOutput className="mr-1.5 h-3 w-3" />
								Generate .bib
							</Button>
							<Button variant="outline" size="sm" onClick={handleScanPdf}>
								<FileWarning className="mr-1.5 h-3 w-3" />
								Scan PDFs
							</Button>
							<Button variant="ghost" size="sm" onClick={() => setShowImportBox((value) => !value)}>
								<Upload className="mr-1.5 h-3 w-3" />
								{showImportBox ? "Hide import" : "Import BibTeX"}
							</Button>
						</div>
						{showImportBox && (
							<div className="rounded-xl border bg-background p-2.5">
								<textarea
									className="min-h-24 w-full resize-y rounded-md border bg-muted/20 px-2 py-1.5 text-[11px] font-mono"
									placeholder="@inproceedings{...}"
									value={bibImportText}
									onChange={(e) => setBibImportText(e.target.value)}
								/>
								<div className="mt-2 flex gap-2">
									<Button variant="primary" size="sm" onClick={handleBatchImport}>
										Import
									</Button>
									<Button variant="outline" size="sm" onClick={() => setShowImportBox(false)}>
										Cancel
									</Button>
								</div>
							</div>
						)}
						{bibGenerated && (
							<div className="rounded-xl border bg-background/70 p-2 text-[11px] text-muted-foreground">
								<div className="font-medium text-foreground">`.bib` preview</div>
								<pre className="mt-1 whitespace-pre-wrap font-mono">{bibPreview}</pre>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

function IssueGroup({
	title,
	description,
	entries,
	onFixFlaggedCitations,
	onVerifyCitation,
	onDismissCitationIssue,
	onJumpToCitation,
}: {
	title: string
	description: string
	entries: VerificationEntry[]
	onFixFlaggedCitations?: (entries: VerificationEntry[]) => void
	onVerifyCitation?: (citeKey: string) => void
	onDismissCitationIssue?: (citeKey: string) => void
	onJumpToCitation?: (citeKey: string) => void
}) {
	return (
		<div className="rounded-xl border bg-background/80 p-3">
			<div className="flex items-start justify-between gap-2">
				<div>
					<div className="text-sm font-medium">{title}</div>
					<div className="text-xs text-muted-foreground">{description}</div>
				</div>
				<div className="rounded-full bg-muted px-2 py-1 text-[10px]">{entries.length}</div>
			</div>
			<div className="mt-3 space-y-2">
				{entries.map((entry) => (
					<div key={entry.citeKey} className="rounded-lg border p-2.5">
						<div className="flex items-center justify-between gap-2">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<div className="truncate text-sm font-medium">{entry.citeKey}</div>
									<StatusBadge status={entry.status} />
								</div>
								<div className="mt-1 text-xs text-muted-foreground">
									{entry.stale ? "stale result, " : ""}
									{entry.reason}
									{typeof entry.confidence === "number" ? ` (${entry.confidence})` : ""}
								</div>
								{entry.matches?.[0]?.title && (
									<div className="mt-1 text-[11px] text-muted-foreground">
										Top match: {entry.matches[0].title}
									</div>
								)}
							</div>
							<AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
						</div>
						<div className="mt-2 flex flex-wrap gap-2">
							<Button variant="outline" size="sm" onClick={() => onVerifyCitation?.(entry.citeKey)}>
								Verify again
							</Button>
							<Button variant="outline" size="sm" onClick={() => onJumpToCitation?.(entry.citeKey)}>
								Jump to cite
							</Button>
							{(entry.status === "flagged" || entry.status === "missing") && (
								<Button variant="outline" size="sm" onClick={() => onFixFlaggedCitations?.([entry])}>
									Fix with Agent
								</Button>
							)}
							<Button variant="ghost" size="sm" onClick={() => onDismissCitationIssue?.(entry.citeKey)}>
								Dismiss
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function HealthTile({
	label,
	value,
	tone,
	onClick,
}: {
	label: string
	value: number
	tone: "success" | "warning" | "danger" | "muted"
	onClick?: () => void
}) {
	const className =
		tone === "success"
			? "border-emerald-200 bg-emerald-50 text-emerald-700"
			: tone === "warning"
				? "border-amber-200 bg-amber-50 text-amber-700"
				: tone === "danger"
					? "border-red-200 bg-red-50 text-red-700"
					: "border-border bg-background text-foreground"
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-xl border px-2 py-2 text-center transition-colors hover:bg-muted/40 ${className}`}>
			<div className="text-base font-semibold">{value}</div>
			<div className="text-[10px] uppercase tracking-[0.14em]">{label}</div>
		</button>
	)
}

export default React.memo(ReferencePanel)
