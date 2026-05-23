import React, { useMemo } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Library, Scissors, Sparkles } from "lucide-react"
import { Button } from "@/components/ui"

type SectionReadinessPanelProps = {
	selectedSection: string
	projectStage?: string
	sectionStatus: "outline" | "draft" | "revised" | "final"
	sectionContent: string
	wordCount: number
	targetWordRange?: [number, number] | null
	missingCitations: string[] | null
	onInsertScaffold: () => void
	onOpenFile: (filePath: string) => void
}

type Diagnostic = {
	id: string
	level: "good" | "warn" | "tip"
	label: string
	detail: string
}

function extractCitations(content: string): string[] {
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

function isCitationHeavySection(sectionType: string): boolean {
	return ["abstract", "introduction", "related-work", "methods", "results", "discussion"].includes(sectionType)
}

function buildPromotionHint(sectionStatus: string, projectStage?: string): string {
	if (sectionStatus === "outline") {
		return "Move this section into `draft` once the core argument is on the page, even if the prose is still rough."
	}
	if (sectionStatus === "draft") {
		return "Promote this section to `revised` after you tighten claims, resolve obvious citation gaps, and stabilize structure."
	}
	if (sectionStatus === "revised") {
		return projectStage === "final" || projectStage === "submitted"
			? "Mark this section `final` when formatting, wording, and citation support are all stable."
			: "Keep this section in `revised` until the surrounding sections stop shifting."
	}
	return "This section is marked `final`. Only reopen it if a reviewer request or cross-section inconsistency forces a change."
}

export const SectionReadinessPanel: React.FC<SectionReadinessPanelProps> = ({
	selectedSection,
	projectStage,
	sectionStatus,
	sectionContent,
	wordCount,
	targetWordRange,
	missingCitations,
	onInsertScaffold,
	onOpenFile,
}) => {
	const diagnostics = useMemo(() => {
		const items: Diagnostic[] = []
		const trimmed = sectionContent.trim()
		const citationKeys = extractCitations(sectionContent)
		const unresolvedKeys = citationKeys.filter((key) => missingCitations?.includes(key))
		const hasFigureRef = /\\ref\{fig:[^}]+\}|Figure\s+~?\\ref\{[^}]+\}/i.test(sectionContent)
		const hasTableRef = /\\ref\{tab:[^}]+\}|Table\s+~?\\ref\{[^}]+\}/i.test(sectionContent)

		if (!trimmed) {
			items.push({
				id: "blank",
				level: "warn",
				label: "Still blank",
				detail: "Start with a scaffold so the section has a narrative spine before you polish wording.",
			})
			return items
		}

		if (targetWordRange && wordCount < targetWordRange[0]) {
			items.push({
				id: "under",
				level: "warn",
				label: "Below target length",
				detail: `This section is ${targetWordRange[0] - wordCount} words under the suggested floor. Add missing rationale, evidence, or interpretation before tightening prose.`,
			})
		}

		if (targetWordRange && wordCount > targetWordRange[1]) {
			items.push({
				id: "over",
				level: "warn",
				label: "Over venue budget",
				detail: `This section exceeds the target by ${wordCount - targetWordRange[1]} words. Trim redundancy before the paper accumulates page pressure.`,
			})
		}

		if (isCitationHeavySection(selectedSection) && wordCount > 120 && citationKeys.length === 0) {
			items.push({
				id: "no-citations",
				level: "tip",
				label: "No citations yet",
				detail: "This section is carrying claims without explicit citation support. Scan your literature notes or add placeholder cite keys now.",
			})
		}

		if (unresolvedKeys.length > 0) {
			items.push({
				id: "missing-citations",
				level: "warn",
				label: "Unresolved cite keys",
				detail: `The section cites ${unresolvedKeys.join(", ")} but they are missing from the reference library. Resolve them before the next revision pass.`,
			})
		}

		if (selectedSection === "results" && !hasFigureRef && !hasTableRef && wordCount > 150) {
			items.push({
				id: "results-evidence",
				level: "tip",
				label: "No figure or table references detected",
				detail: "Results are easier to trust when every major claim points to a figure or table. Consider anchoring the narrative to concrete evidence.",
			})
		}

		if (items.length === 0) {
			items.push({
				id: "healthy",
				level: "good",
				label: "Section looks healthy",
				detail: "Word budget, structure, and citation support look reasonable for the next refinement pass.",
			})
		}

		return items
	}, [missingCitations, sectionContent, selectedSection, targetWordRange, wordCount])

	const primaryAction = useMemo(() => {
		if (!sectionContent.trim()) {
			return {
				label: "Insert scaffold",
				icon: FileText,
				action: onInsertScaffold,
			}
		}
		if (diagnostics.some((item) => item.id === "missing-citations" || item.id === "no-citations")) {
			return {
				label: "Open references",
				icon: Library,
				action: () => onOpenFile("reference"),
			}
		}
		if (diagnostics.some((item) => item.id === "over")) {
			return {
				label: "Trim this section",
				icon: Scissors,
				action: () => undefined,
			}
		}
		return {
			label: "Advance to next pass",
			icon: ArrowRight,
			action: () => undefined,
		}
	}, [diagnostics, onInsertScaffold, onOpenFile, sectionContent])
	const PrimaryActionIcon = primaryAction.icon

	return (
		<div className="rounded-2xl border bg-[linear-gradient(180deg,rgba(14,116,144,0.05),rgba(14,165,233,0.03),transparent)] p-3 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-sky-600" />
						<h4 className="text-sm font-semibold">Section Readiness</h4>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{buildPromotionHint(sectionStatus, projectStage)}
					</p>
				</div>
				<Button variant="outline" size="sm" className="text-xs" onClick={primaryAction.action}>
					<PrimaryActionIcon className="mr-1.5 h-3.5 w-3.5" />
					{primaryAction.label}
				</Button>
			</div>
			<div className="mt-3 grid gap-2">
				{diagnostics.map((item) => (
					<div key={item.id} className="rounded-lg border bg-background/90 p-2.5">
						<div className="flex items-start gap-2">
							{item.level === "good" ? (
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
							) : item.level === "warn" ? (
								<AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
							) : (
								<Sparkles className="mt-0.5 h-4 w-4 text-sky-600" />
							)}
							<div>
								<div className="text-sm font-medium">{item.label}</div>
								<p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export default React.memo(SectionReadinessPanel)
