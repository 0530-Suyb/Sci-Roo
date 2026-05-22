// Venue template and directory template configuration for Sci-Roo Paper Writing

import type { DirectoryTemplate, VenueTemplate, SectionConfig, SectionType } from "@roo-code/types"

// ─── Shared Section Configs ──────────────────────────────────────────

const ML_SECTIONS: SectionConfig[] = [
	{
		type: "abstract",
		label: "Abstract",
		recommendedOrder: 0,
		required: true,
		targetWordRange: [150, 300],
		aiWritePrompt:
			"Write a structured abstract (background, problem, approach, key results, implications). Keep it concise — most ML conferences limit abstracts to 150–300 words.",
	},
	{
		type: "introduction",
		label: "Introduction",
		recommendedOrder: 1,
		required: true,
		targetWordRange: [600, 1200],
		aiWritePrompt:
			"Write an introduction following the funnel structure: broad context → specific problem → gap in existing work → your approach → contributions (numbered list 3–5). Include a clear thesis statement.",
	},
	{
		type: "related-work",
		label: "Related Work",
		recommendedOrder: 2,
		required: true,
		targetWordRange: [500, 1000],
		aiWritePrompt:
			"Group related work by methodology or approach (not individual papers). For each group: what they do, what limitation remains, how your work differs. Use a comparison table if comparing 4+ systems.",
	},
	{
		type: "methods",
		label: "Methods",
		recommendedOrder: 3,
		required: true,
		targetWordRange: [800, 2000],
		aiWritePrompt:
			"Describe your method clearly enough for reproducibility. Include: problem formulation, model architecture, training procedure, and key algorithmic details. Use equations and algorithms as needed. Discuss design alternatives and justify choices.",
	},
	{
		type: "results",
		label: "Results",
		recommendedOrder: 4,
		required: true,
		targetWordRange: [800, 2000],
		aiWritePrompt:
			"Present experimental results. Include: setup (datasets, baselines, metrics), main results (tables/figures), ablation studies (isolating each design component's contribution), and analysis. State every conclusion three times: hypothesis, result statement, figure caption.",
	},
	{
		type: "discussion",
		label: "Discussion",
		recommendedOrder: 5,
		required: false,
		targetWordRange: [400, 800],
		aiWritePrompt:
			"Discuss limitations, broader implications, and future work. Be honest about what your method cannot do.",
	},
	{
		type: "conclusion",
		label: "Conclusion",
		recommendedOrder: 6,
		required: true,
		targetWordRange: [200, 500],
		aiWritePrompt:
			"Summarize in three sentences: (1) the problem addressed, (2) the solution approach, (3) the key result and impact.",
	},
	{
		type: "appendix",
		label: "Appendix",
		recommendedOrder: 7,
		required: false,
	},
]

const SYSTEMS_SECTIONS: SectionConfig[] = [
	{
		type: "abstract",
		label: "Abstract",
		recommendedOrder: 0,
		required: true,
		targetWordRange: [150, 250],
		aiWritePrompt:
			"Write a 5-sentence abstract: (1) problem context, (2) gap in existing approaches, (3) key insight or thesis, (4) approach and key results summary, (5) broader impact or availability.",
	},
	{
		type: "introduction",
		label: "Introduction",
		recommendedOrder: 1,
		required: true,
		targetWordRange: [800, 1500],
		aiWritePrompt:
			"Write a systems paper introduction: (p1) Problem + domain context with concrete numbers, (p2) Gap analysis G1–Gn with evidence, (p3) Key insight: 'X is better for Y in environment Z', (p4) Numbered contributions (3–5), each testable and mapped to a section.",
	},
	{
		type: "related-work",
		label: "Related Work",
		recommendedOrder: 2,
		required: true,
		targetWordRange: [500, 1000],
		aiWritePrompt:
			"Group related work by methodology, not individual papers. For each group: what they do, what limitation remains, how your work differs. Include a comparison table for 4+ systems.",
	},
	{
		type: "methods",
		label: "Design & Implementation",
		recommendedOrder: 3,
		required: true,
		targetWordRange: [1500, 3000],
		aiWritePrompt:
			"Design section: (1) Architecture overview with diagram, (2) Module-by-module design — for each: what it does, design choice made, alternatives considered, why this choice wins. Implementation: prototype details (language, framework, LOC), key engineering decisions.",
	},
	{
		type: "results",
		label: "Evaluation",
		recommendedOrder: 4,
		required: true,
		targetWordRange: [1500, 3000],
		aiWritePrompt:
			"Systems evaluation: (1) Setup (hardware, baselines, workloads, metrics), (2) End-to-end comparison for application Y on environment Z, (3) Microbenchmarks isolating each design decision, (4) Scalability. State every conclusion three times.",
	},
	{
		type: "discussion",
		label: "Discussion",
		recommendedOrder: 5,
		required: false,
		targetWordRange: [400, 800],
		aiWritePrompt: "Discuss limitations, lessons learned, and future work.",
	},
	{
		type: "conclusion",
		label: "Conclusion",
		recommendedOrder: 6,
		required: true,
		targetWordRange: [200, 400],
		aiWritePrompt: "Three sentences: hypothesis, solution, key result.",
	},
	{
		type: "appendix",
		label: "Appendix",
		recommendedOrder: 7,
		required: false,
	},
]

const GENERAL_SECTIONS: SectionConfig[] = [
	{
		type: "abstract",
		label: "Abstract",
		recommendedOrder: 0,
		required: true,
		targetWordRange: [100, 300],
	},
	{
		type: "introduction",
		label: "Introduction",
		recommendedOrder: 1,
		required: true,
	},
	{ type: "related-work", label: "Related Work", recommendedOrder: 2, required: false },
	{ type: "methods", label: "Methods", recommendedOrder: 3, required: true },
	{ type: "results", label: "Results", recommendedOrder: 4, required: true },
	{ type: "discussion", label: "Discussion", recommendedOrder: 5, required: false },
	{ type: "conclusion", label: "Conclusion", recommendedOrder: 6, required: true },
	{ type: "appendix", label: "Appendix", recommendedOrder: 7, required: false },
]

// ─── Venue Templates ──────────────────────────────────────────────────

export const VENUE_TEMPLATES: VenueTemplate[] = [
	// ── ML Conferences ──
	{
		id: "neurips2025",
		name: "NeurIPS 2025",
		type: "ml",
		pageLimit: 9,
		extraPages: 0,
		citationStyle: "natbib",
		sectionConfigs: ML_SECTIONS,
		hasChecklist: true,
		hasBroaderImpact: true,
		hasLimitations: false,
		skillNames: ["ml-paper-writing", "academic-plotting"],
	},
	{
		id: "icml2026",
		name: "ICML 2026",
		type: "ml",
		pageLimit: 8,
		extraPages: 0,
		citationStyle: "icml",
		sectionConfigs: ML_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: true,
		hasLimitations: false,
		skillNames: ["ml-paper-writing", "academic-plotting"],
	},
	{
		id: "iclr2026",
		name: "ICLR 2026",
		type: "ml",
		pageLimit: 9,
		extraPages: 0,
		citationStyle: "natbib",
		sectionConfigs: ML_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["ml-paper-writing", "academic-plotting"],
	},
	{
		id: "acl",
		name: "ACL",
		type: "ml",
		pageLimit: 8,
		extraPages: 0,
		citationStyle: "acl",
		sectionConfigs: ML_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: true,
		skillNames: ["ml-paper-writing", "academic-plotting"],
	},
	{
		id: "aaai2026",
		name: "AAAI 2026",
		type: "ml",
		pageLimit: 7,
		extraPages: 0,
		citationStyle: "aaai",
		sectionConfigs: ML_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["ml-paper-writing", "academic-plotting"],
	},
	{
		id: "colm2025",
		name: "COLM 2025",
		type: "ml",
		pageLimit: 9,
		extraPages: 0,
		citationStyle: "natbib",
		sectionConfigs: ML_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: true,
		hasLimitations: false,
		skillNames: ["ml-paper-writing", "academic-plotting"],
	},
	// ── Systems Conferences ──
	{
		id: "osdi2026",
		name: "OSDI 2026",
		type: "systems",
		pageLimit: 12,
		extraPages: 2,
		citationStyle: "usenix",
		sectionConfigs: SYSTEMS_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["systems-paper-writing", "academic-plotting"],
	},
	{
		id: "sosp2026",
		name: "SOSP 2026",
		type: "systems",
		pageLimit: 12,
		extraPages: 0,
		citationStyle: "acm",
		sectionConfigs: SYSTEMS_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["systems-paper-writing", "academic-plotting"],
	},
	{
		id: "asplos2027",
		name: "ASPLOS 2027",
		type: "systems",
		pageLimit: 11,
		extraPages: 2,
		citationStyle: "acm",
		sectionConfigs: SYSTEMS_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["systems-paper-writing", "academic-plotting"],
	},
	{
		id: "nsdi2027",
		name: "NSDI 2027",
		type: "systems",
		pageLimit: 12,
		extraPages: 2,
		citationStyle: "usenix",
		sectionConfigs: SYSTEMS_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["systems-paper-writing", "academic-plotting"],
	},
	// ── General ──
	{
		id: "generic",
		name: "Generic LaTeX",
		type: "general",
		pageLimit: 0,
		extraPages: 0,
		citationStyle: "natbib",
		sectionConfigs: GENERAL_SECTIONS,
		hasChecklist: false,
		hasBroaderImpact: false,
		hasLimitations: false,
		skillNames: ["academic-plotting"],
	},
]

// ─── Directory Templates ──────────────────────────────────────────────

export const DIRECTORY_TEMPLATES: DirectoryTemplate[] = [
	{
		id: "ml-paper",
		name: "ML Paper",
		description: "Standard directory structure for machine learning research papers",
		structure: [
			{
				name: "task",
				type: "directory",
				children: [
					{
						name: "paper-plan.md",
						type: "file",
						template: "# Paper Plan\n\n## Research Direction\n\n## Framework\n\n## Content Outline\n",
					},
				],
			},
			{
				name: "problem",
				type: "directory",
				children: [
					{
						name: "research-questions.md",
						type: "file",
						template: "# Research Questions\n\n## Main Question\n\n## Sub-questions\n\n## Hypotheses\n",
					},
				],
			},
			{
				name: "review",
				type: "directory",
				children: [{ name: "revision-log.md", type: "file", template: "# Revision Log\n" }],
			},
			{ name: "reference", type: "directory" },
			{ name: "script", type: "directory" },
			{ name: "img", type: "directory" },
			{ name: "experiment", type: "directory" },
			{ name: "latex", type: "directory" },
			{ name: "template", type: "directory" },
		],
		ruleFiles: ["writing-standards.md"],
	},
	{
		id: "systems-paper",
		name: "Systems Paper",
		description: "Directory structure for systems research papers (OSDI, SOSP, etc.)",
		structure: [
			{
				name: "task",
				type: "directory",
				children: [
					{
						name: "paper-plan.md",
						type: "file",
						template:
							"# Paper Plan\n\n## Problem Statement\n\n## Key Insight (X is better for Y in Z)\n\n## Design Overview\n",
					},
				],
			},
			{
				name: "problem",
				type: "directory",
				children: [
					{
						name: "research-questions.md",
						type: "file",
						template: "# Research Questions\n\n## Production Observations\n\n## Gaps in Existing Systems\n",
					},
				],
			},
			{
				name: "review",
				type: "directory",
				children: [{ name: "revision-log.md", type: "file", template: "# Revision Log\n" }],
			},
			{ name: "reference", type: "directory" },
			{ name: "script", type: "directory" },
			{ name: "img", type: "directory" },
			{ name: "experiment", type: "directory" },
			{ name: "latex", type: "directory" },
			{ name: "template", type: "directory" },
		],
		ruleFiles: ["writing-standards.md"],
	},
	{
		id: "general-science",
		name: "General Science",
		description: "Flexible directory structure for general scientific writing",
		structure: [
			{
				name: "task",
				type: "directory",
				children: [{ name: "paper-plan.md", type: "file", template: "# Paper Plan\n" }],
			},
			{
				name: "problem",
				type: "directory",
				children: [{ name: "research-questions.md", type: "file", template: "# Research Questions\n" }],
			},
			{
				name: "review",
				type: "directory",
				children: [{ name: "revision-log.md", type: "file", template: "# Revision Log\n" }],
			},
			{ name: "reference", type: "directory" },
			{ name: "script", type: "directory" },
			{ name: "img", type: "directory" },
			{ name: "experiment", type: "directory" },
			{ name: "latex", type: "directory" },
			{ name: "template", type: "directory" },
		],
		ruleFiles: ["writing-standards.md"],
	},
]

// ─── Helpers ──────────────────────────────────────────────────────────

export function getVenueTemplate(id: string): VenueTemplate | undefined {
	return VENUE_TEMPLATES.find((v) => v.id === id)
}

export function getDirectoryTemplate(id: string): DirectoryTemplate | undefined {
	return DIRECTORY_TEMPLATES.find((d) => d.id === id)
}

export function getVenueTemplatesByType(type: "ml" | "systems" | "general"): VenueTemplate[] {
	return VENUE_TEMPLATES.filter((v) => v.type === type)
}
