/**
 * Research Pipeline & Manuscript types for Sci-Roo Phase 4.
 */

// ─── Research Pipeline ────────────────────────────────────────────

export type PipelineStage =
	| "planning"
	| "literature-review"
	| "hypothesis-design"
	| "data-collection"
	| "data-analysis"
	| "visualization"
	| "writing"
	| "peer-review"
	| "published"

export interface Hypothesis {
	id: string
	statement: string
	rationale: string
	derivedFrom: string[] // literature entry IDs
	predictions: string[]
	status: "proposed" | "testing" | "supported" | "rejected"
	createdAt: string
}

export interface ExperimentEntry {
	id: string
	name: string
	design: string // between-subjects, within-subjects, mixed
	factors: string[]
	sampleSize: number
	powerAnalysis?: {
		effectSize: number
		power: number
		alpha: number
		testType: string
	}
	procedure: string
	dataFiles: string[]
	analysisScript?: string
	status: "planned" | "running" | "completed" | "aborted"
	createdAt: string
}

export interface AnalysisResult {
	id: string
	experimentId?: string
	hypothesisId?: string
	testType: string
	script: string
	outputSummary: string
	timestamp: string
}

export interface PipelineNote {
	id: string
	text: string
	stage: PipelineStage
	timestamp: string
}

export interface ResearchProject {
	id: string
	name: string
	description: string
	hypotheses: Hypothesis[]
	experiments: ExperimentEntry[]
	analyses: AnalysisResult[]
	stage: PipelineStage
	notes: PipelineNote[]
	createdAt: string
	updatedAt: string
}

export interface ResearchPipelineState {
	project?: ResearchProject
	projects: ResearchProject[]
}

export const RESEARCH_PROJECT_DIR = ".roo/research"
export const RESEARCH_PROJECT_FILENAME = "project.json"

// ─── Manuscript / Paper Writing ────────────────────────────────────

export type ManuscriptSectionType =
	| "title"
	| "abstract"
	| "introduction"
	| "methods"
	| "results"
	| "discussion"
	| "conclusion"
	| "references"
	| "figures"
	| "tables"
	| "supplementary"
	| "cover-letter"
	| "highlights"

export interface ManuscriptSection {
	id: string
	type: ManuscriptSectionType
	title: string
	content: string
	wordCount: number
	status: "draft" | "revised" | "final"
	lastEdited: string
}

export type CitationStyle = "apa" | "vancouver" | "harvard" | "nature" | "science" | "ieee" | "chicago" | "custom"

export interface JournalTemplate {
	id: string
	name: string
	publisher: string
	citationStyle: CitationStyle
	wordLimit?: number
	sections: ManuscriptSectionType[]
	hasSupplementary: boolean
	requiresHighlights: boolean
	requiresCoverLetter: boolean
}

export interface FigureReference {
	id: string
	caption: string
	filePath: string
	sectionId: string
}

export interface TableReference {
	id: string
	caption: string
	dataFile: string
	sectionId: string
}

export interface Manuscript {
	id: string
	title: string
	authors: Array<{
		firstName: string
		lastName: string
		affiliation?: string
		orcid?: string
		isCorresponding: boolean
	}>
	abstract: string
	sections: ManuscriptSection[]
	figures: FigureReference[]
	tables: TableReference[]
	citations: string[] // literature entry IDs
	journalTemplate?: JournalTemplate
	citationStyle: CitationStyle
	keywords: string[]
	status: "draft" | "in-progress" | "complete" | "submitted" | "published"
	createdAt: string
	updatedAt: string
}

export interface ManuscriptState {
	current?: Manuscript
	history: Manuscript[]
}

export const MANUSCRIPT_DIR = ".roo/manuscripts"
export const MANUSCRIPT_FILENAME = "manuscript.json"

// ─── Review ────────────────────────────────────────────────────────

export interface ReviewComment {
	id: string
	sectionId?: string
	text: string
	type: "major" | "minor" | "typo" | "suggestion" | "question"
	resolved: boolean
	response?: string
}

export interface RevisionPlan {
	id: string
	manuscriptId: string
	comments: ReviewComment[]
	summary: string
	createdAt: string
	status: "pending" | "in-progress" | "completed"
}

// ─── Paper Writing v2 (科研工程 + 引用管理 + 模板) ──────────────────────

export type PaperProjectStage = "planning" | "literature-review" | "writing" | "revising" | "final" | "submitted"

export interface PaperProject {
	id: string
	name: string
	description?: string
	rootPath: string
	templateId: string
	templateSource: "builtin" | "custom"
	directoryTemplate: string
	stage: PaperProjectStage
	customSectionConfigs?: Record<SectionType, { label: string; targetWordRange?: [number, number] }>
	createdAt: string
	updatedAt: string
}

export interface DirectoryTemplate {
	id: string
	name: string
	description: string
	structure: DirectoryNode[]
	ruleFiles?: string[] // rule filenames to copy to project's .roo/rules-sci-paper-writing/
}

export interface DirectoryNode {
	name: string
	type: "directory" | "file"
	children?: DirectoryNode[]
	template?: string
}

import { Author } from "./literature.js"

export interface ReferenceEntry {
	citeKey: string
	title: string
	authors: Author[]
	year: number
	venue: string
	doi?: string
	arxivId?: string
	abstract?: string
	keywords: string[]
	bibtex?: string
	hasPdf: boolean
	verified: boolean
	verifiedAt?: string
	tags: string[]
	dateAdded: string
}

export type SectionType =
	| "abstract"
	| "introduction"
	| "related-work"
	| "methods"
	| "results"
	| "discussion"
	| "conclusion"
	| "broader-impact"
	| "limitations"
	| "appendix"

export interface SectionConfig {
	type: SectionType
	label: string
	recommendedOrder: number
	required: boolean
	targetWordRange?: [number, number]
	aiWritePrompt?: string
}

export interface VenueTemplate {
	id: string
	name: string
	type: "ml" | "systems" | "general"
	pageLimit: number
	extraPages: number
	citationStyle: string
	sectionConfigs: SectionConfig[]
	hasChecklist: boolean
	hasBroaderImpact: boolean
	hasLimitations: boolean
	skillNames?: string[] // skill names to copy to project's .roo/skills/
}

export interface PaperWritingState {
	currentSection?: SectionType
	sectionStatus: Record<SectionType, "outline" | "draft" | "revised" | "final">
	totalWords: number
	targetWords: number
	citationCount: number
	figureCount: number
	tableCount: number
	lastEdited: string
}

export interface SnapshotMeta {
	id: string
	createdAt: string
	label?: string
	fileCount: number
}

export const PAPER_PROJECT_DIR = ".roo"
export const PAPER_PROJECT_FILENAME = "project.json"
