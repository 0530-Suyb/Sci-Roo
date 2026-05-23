import React, { useMemo } from "react"
import { BookOpenText, ClipboardCheck, FileSearch, FolderOpen, Lightbulb, RefreshCcw, WandSparkles } from "lucide-react"
import { Button } from "@/components/ui"

type GuideSection = {
	objective: string
	include: string[]
	questions: string[]
	scaffold: string
}

type SectionGuidePanelProps = {
	project: any
	selectedSection: string
	wordCount: number
	targetWordRange?: [number, number] | null
	onInsertScaffold: (scaffold: string) => void
	onOpenFile: (filePath: string) => void
}

const SECTION_GUIDES: Record<string, GuideSection> = {
	abstract: {
		objective: "Let a busy reviewer understand the problem, method, evidence, and payoff in under a minute.",
		include: [
			"Problem context and the concrete gap",
			"Your proposed method or system in one crisp sentence",
			"Main result with numbers when possible",
			"Why the result matters for the field",
		],
		questions: [
			"Can a reviewer restate the contribution after reading only this paragraph?",
			"Did you include real evidence instead of vague claims?",
		],
		scaffold: `% Abstract\n% 1. Problem context\n% 2. Gap in prior work\n% 3. Proposed approach\n% 4. Main result with evidence\n% 5. Implication\n`,
	},
	introduction: {
		objective: "Build motivation, expose the gap, and make the paper's contributions feel inevitable.",
		include: [
			"Real-world or scientific context",
			"A clear gap in existing work",
			"Your central idea or hypothesis",
			"A concise contributions list",
		],
		questions: [
			"Would a reviewer know exactly what is new here?",
			"Are the contributions specific, testable, and later matched in the paper?",
		],
		scaffold: `% Introduction\n% P1: Broad context and why the problem matters\n% P2: What prior work gets wrong or leaves open\n% P3: Your key idea / hypothesis\n% P4: Contributions (3-5 bullets)\n\n\\paragraph{Contributions.}\n\\begin{itemize}\n    \\item Contribution 1.\n    \\item Contribution 2.\n    \\item Contribution 3.\n\\end{itemize}\n`,
	},
	"related-work": {
		objective: "Position your work against themes of prior work instead of producing a paper-by-paper catalog.",
		include: [
			"Methodological grouping of prior work",
			"The limitation of each cluster",
			"A precise explanation of how your work differs",
		],
		questions: [
			"Are papers grouped by idea instead of chronology?",
			"Does the final paragraph make your novelty unmistakable?",
		],
		scaffold: `% Related Work\n% Group prior work by approach, not paper-by-paper.\n\\paragraph{Theme A.} Summarize the line of work, then state its limitation.\n\n\\paragraph{Theme B.} Summarize the line of work, then state its limitation.\n\n\\paragraph{How we differ.} Explain the gap your work closes.\n`,
	},
	methods: {
		objective: "Make the design understandable and reproducible without burying the key idea.",
		include: [
			"Problem formulation or setting",
			"The overall architecture or pipeline",
			"Important implementation or algorithmic choices",
			"Design rationale and alternatives considered",
		],
		questions: [
			"Could another researcher reproduce the core method from this section?",
			"Did you explain why these design choices are better than obvious alternatives?",
		],
		scaffold: `% Methods / Design\n\\subsection{Problem Setting}\nDescribe the task, assumptions, and notation.\n\n\\subsection{Overview}\nSummarize the pipeline or architecture.\n\n\\subsection{Core Method}\nExplain the main mechanism and equations.\n\n\\subsection{Implementation Details}\nState training, optimization, or engineering details needed for reproducibility.\n`,
	},
	results: {
		objective: "Turn experiments into evidence that clearly supports or constrains your claims.",
		include: [
			"Experimental setup and metrics",
			"Main comparison against baselines",
			"Ablation or component analysis",
			"Interpretation of what the results do and do not prove",
		],
		questions: [
			"Does every major claim point to a specific table or figure?",
			"Are negative or mixed results explained honestly?",
		],
		scaffold: `% Results / Evaluation\n\\subsection{Setup}\nDescribe datasets, metrics, baselines, and environment.\n\n\\subsection{Main Results}\nPresent the primary comparison and key takeaways.\n\n\\subsection{Ablations / Analysis}\nIsolate the effect of major components.\n\n\\subsection{Discussion of Findings}\nExplain what the evidence supports and what remains uncertain.\n`,
	},
	discussion: {
		objective: "Interpret what the findings mean, acknowledge limitations, and frame future work responsibly.",
		include: [
			"What the results imply scientifically or practically",
			"Threats to validity and limitations",
			"How the work could be extended or tested further",
		],
		questions: [
			"Did you distinguish speculation from evidence-backed conclusions?",
			"Would an honest reviewer feel their main criticisms were anticipated here?",
		],
		scaffold: `% Discussion\n\\paragraph{Implications.} What do these findings change?\n\n\\paragraph{Limitations.} What are the key weaknesses or boundary conditions?\n\n\\paragraph{Future Work.} What should be tested next?\n`,
	},
	conclusion: {
		objective: "Leave the reader with a crisp memory of the problem, the solution, and the evidence.",
		include: ["The problem addressed", "The proposed approach", "The main empirical or conceptual takeaway"],
		questions: [
			"Is this conclusion tighter than the introduction, not just a copy?",
			"Does it avoid introducing entirely new claims?",
		],
		scaffold: `% Conclusion\nSummarize the problem, the approach, and the key result in a compact form.\n`,
	},
	"broader-impact": {
		objective: "Show that you have seriously considered downstream consequences, not just added boilerplate.",
		include: [
			"Potential positive impacts",
			"Reasonable misuse or harm scenarios",
			"Mitigations or scope boundaries",
		],
		questions: [
			"Is the analysis specific to this work rather than generic AI language?",
			"Did you address who may be harmed and under what conditions?",
		],
		scaffold: `% Broader Impact\nDiscuss likely benefits, risks, and mitigation strategies specific to this work.\n`,
	},
	limitations: {
		objective: "Pre-empt reviewer concerns by stating the real weaknesses clearly and proportionately.",
		include: ["Method limitations", "Data or evaluation constraints", "Conditions where the claims may not hold"],
		questions: [
			"Did you explain why the limitations do not invalidate the core claim?",
			"Would a skeptical reviewer say you hid an obvious weakness?",
		],
		scaffold: `% Limitations\nState the main weaknesses, boundary conditions, and what remains unsupported.\n`,
	},
	appendix: {
		objective:
			"Support the main paper with material that improves reproducibility and depth without diluting the narrative.",
		include: ["Extra derivations or proofs", "Implementation details", "Extended tables, figures, or prompts"],
		questions: [
			"Is the appendix useful but non-essential for understanding the core contribution?",
			"Did you avoid moving critical evidence out of the main paper?",
		],
		scaffold: `% Appendix\nAdd supplementary derivations, tables, prompts, or implementation details.\n`,
	},
}

const STAGE_TIPS: Record<string, string> = {
	planning: "Use this section to sketch the argument before polishing prose.",
	"literature-review": "Keep claims grounded in papers already captured in your reference library.",
	writing: "Prioritize forward progress and explicit evidence over perfect wording.",
	revising: "Tighten claims, address reviewer concerns, and make every figure do argumentative work.",
	final: "Shift from drafting to consistency checks, formatting, and citation completeness.",
	submitted: "Document lessons learned and capture reviewer-facing revision plans.",
}

export const SectionGuidePanel: React.FC<SectionGuidePanelProps> = ({
	project,
	selectedSection,
	wordCount,
	targetWordRange,
	onInsertScaffold,
	onOpenFile,
}) => {
	const guide = useMemo(() => SECTION_GUIDES[selectedSection] ?? SECTION_GUIDES.introduction, [selectedSection])
	const stageTip = STAGE_TIPS[project?.stage ?? "writing"] ?? STAGE_TIPS.writing
	const files = useMemo(
		() => [
			{ label: "Paper plan", path: "task/paper-plan.md", icon: BookOpenText },
			{ label: "Research questions", path: "problem/research-questions.md", icon: FileSearch },
			{ label: "Revision log", path: "review/revision-log.md", icon: RefreshCcw },
		],
		[],
	)

	return (
		<div className="rounded-2xl border bg-[linear-gradient(180deg,rgba(59,130,246,0.05),rgba(16,185,129,0.03),transparent)] p-3 shadow-sm">
			<div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr_0.8fr]">
				<div className="rounded-xl border bg-background/90 p-3">
					<div className="mb-2 flex items-center gap-2">
						<Lightbulb className="h-4 w-4 text-amber-600" />
						<h4 className="text-sm font-semibold">Section Intent</h4>
					</div>
					<p className="text-sm text-muted-foreground">{guide.objective}</p>
					<div className="mt-3 flex flex-wrap gap-2 text-[11px]">
						<span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
							Current stage: {project?.stage ?? "writing"}
						</span>
						<span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
							Words: {wordCount}
							{targetWordRange ? ` / ${targetWordRange[1]}` : ""}
						</span>
					</div>
					<p className="mt-3 text-[12px] text-muted-foreground">{stageTip}</p>
				</div>

				<div className="rounded-xl border bg-background/90 p-3">
					<div className="mb-2 flex items-center gap-2">
						<ClipboardCheck className="h-4 w-4 text-emerald-600" />
						<h4 className="text-sm font-semibold">What To Include</h4>
					</div>
					<div className="space-y-2">
						{guide.include.map((item) => (
							<div key={item} className="text-[12px] text-muted-foreground">
								<span className="mr-2 text-foreground">•</span>
								{item}
							</div>
						))}
					</div>
					<div className="mt-3 border-t pt-3">
						<div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							Self-check
						</div>
						<div className="space-y-2">
							{guide.questions.map((question) => (
								<div key={question} className="text-[12px] text-muted-foreground">
									<span className="mr-2 text-foreground">?</span>
									{question}
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="rounded-xl border bg-background/90 p-3">
					<div className="mb-2 flex items-center gap-2">
						<WandSparkles className="h-4 w-4 text-sky-600" />
						<h4 className="text-sm font-semibold">Quick Actions</h4>
					</div>
					<div className="grid gap-2">
						<Button
							variant="outline"
							size="sm"
							className="justify-start"
							onClick={() => onInsertScaffold(guide.scaffold)}>
							<WandSparkles className="mr-1.5 h-3.5 w-3.5" />
							Insert outline scaffold
						</Button>
						{files.map((file) => {
							const Icon = file.icon
							return (
								<Button
									key={file.path}
									variant="ghost"
									size="sm"
									className="justify-start"
									onClick={() => onOpenFile(file.path)}>
									<Icon className="mr-1.5 h-3.5 w-3.5" />
									{file.label}
								</Button>
							)
						})}
						<Button
							variant="ghost"
							size="sm"
							className="justify-start"
							onClick={() => onOpenFile("reference")}>
							<FolderOpen className="mr-1.5 h-3.5 w-3.5" />
							Open reference folder
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default React.memo(SectionGuidePanel)
