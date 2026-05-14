import { z } from "zod"

export const RETRIEVAL_SCHEMA_VERSION = "1.0"
export const MAX_RETRIEVAL_CANDIDATES = 200
export const RETRIEVAL_LIST_FILENAME = "retrieval_list.json"

export const retrievalSourceSchema = z.enum(["pubmed", "arxiv"])
export type RetrievalSource = z.infer<typeof retrievalSourceSchema>

export const retrievalStateSchema = z.enum(["未确认", "已确认", "已归档"])
export type RetrievalState = z.infer<typeof retrievalStateSchema>

export const retrievalCandidateStateSchema = z.enum(["候选", "已确认", "已排除", "冲突", "错误"])
export type RetrievalCandidateState = z.infer<typeof retrievalCandidateStateSchema>

export const retrievalCandidateSchema = z.object({
	candidate_no: z.string(),
	state: retrievalCandidateStateSchema.default("候选"),
	source: retrievalSourceSchema,
	source_rank: z.number().int().positive().nullable().optional(),
	title: z.string().min(1),
	authors: z.array(z.string()).default([]),
	year: z.number().int().min(1500).max(3000).nullable().optional(),
	venue: z.string().default(""),
	doi: z.string().default(""),
	pmid: z.string().default(""),
	arxiv_id: z.string().default(""),
	url: z.string().default(""),
	abstract: z.string().default(""),
	keywords: z.array(z.string()).default([]),
	relevance_score: z.number().min(0).max(1).nullable().optional(),
	relevance_reason: z.string().default(""),
	notes: z.string().default(""),
	decision_reason: z.string().default(""),
	metadata_warnings: z.array(z.string()).default([]),
})
export type RetrievalCandidate = z.infer<typeof retrievalCandidateSchema>

export const retrievalSearchRunSchema = z.object({
	source: retrievalSourceSchema,
	query: z.string().default(""),
	requested_max_results: z.number().int().nonnegative().default(0),
	returned_count: z.number().int().nonnegative().default(0),
	status: z.enum(["success", "partial", "error", "no_results"]).default("success"),
	error: z.string().nullable().default(null),
})
export type RetrievalSearchRun = z.infer<typeof retrievalSearchRunSchema>

export const retrievalSearchProvenanceSchema = z.object({
	summary: z.string().default(""),
	runs: z.array(retrievalSearchRunSchema).default([]),
})
export type RetrievalSearchProvenance = z.infer<typeof retrievalSearchProvenanceSchema>

export const retrievalResultSummarySchema = z.object({
	total_found: z.number().int().nonnegative().default(0),
	total_saved: z.number().int().nonnegative().default(0),
	by_source: z
		.object({
			pubmed: z.number().int().nonnegative().default(0),
			arxiv: z.number().int().nonnegative().default(0),
		})
		.default({ pubmed: 0, arxiv: 0 }),
	duplicates_removed: z.number().int().nonnegative().default(0),
	errors: z.array(z.string()).default([]),
})
export type RetrievalResultSummary = z.infer<typeof retrievalResultSummarySchema>

export const retrievalRunStatusSchema = z.enum(["idle", "running", "completed", "error", "aborted"])
export type RetrievalRunStatus = z.infer<typeof retrievalRunStatusSchema>

export const retrievalAgentTaskStatusSchema = z.enum([
	"created",
	"running",
	"completion_received",
	"completed",
	"error",
	"aborted",
])
export type RetrievalAgentTaskStatus = z.infer<typeof retrievalAgentTaskStatusSchema>

export const retrievalAgentTaskSchema = z.object({
	task_id: z.string().default(""),
	status: retrievalAgentTaskStatusSchema.default("created"),
	prompt_hash: z.string().default(""),
	prompt_summary: z.string().default(""),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
})
export type RetrievalAgentTask = z.infer<typeof retrievalAgentTaskSchema>

export const retrievalTaskSchema = z.object({
	schema_version: z.literal(RETRIEVAL_SCHEMA_VERSION).default(RETRIEVAL_SCHEMA_VERSION),
	retrieval_no: z.string(),
	title: z.string().default("Untitled retrieval"),
	Q: z.string().default(""),
	date: z.string().default(""),
	state: retrievalStateSchema.default("未确认"),
	query: z.string().default(""),
	search_keywords: z.array(z.string()).default([]),
	search_sources: z.array(retrievalSourceSchema).default(["pubmed", "arxiv"]),
	max_results: z.number().int().positive().max(MAX_RETRIEVAL_CANDIDATES).default(20),
	year_from: z.number().int().min(1500).max(3000).nullable().optional(),
	year_to: z.number().int().min(1500).max(3000).nullable().optional(),
	inclusion_criteria: z.array(z.string()).default([]),
	exclusion_criteria: z.array(z.string()).default([]),
	search_provenance: retrievalSearchProvenanceSchema.default({ summary: "", runs: [] }),
	result_summary: retrievalResultSummarySchema.default({
		total_found: 0,
		total_saved: 0,
		by_source: { pubmed: 0, arxiv: 0 },
		duplicates_removed: 0,
		errors: [],
	}),
	candidates: z.array(retrievalCandidateSchema).default([]),
	run_status: retrievalRunStatusSchema.default("idle"),
	agent_task: retrievalAgentTaskSchema.optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	task_id: z.string().optional(),
	last_agent_run_at: z.string().optional(),
	last_completed_at: z.string().optional(),
	last_error_at: z.string().optional(),
})
export type RetrievalTask = z.infer<typeof retrievalTaskSchema>

export const retrievalListItemSchema = z.object({
	retrieval_no: z.string(),
	title: z.string(),
	Q: z.string().default(""),
	state: retrievalStateSchema,
	created_at: z.string(),
	updated_at: z.string(),
	query: z.string().default(""),
	sources: z.array(retrievalSourceSchema).default([]),
	paper_count: z.number().int().nonnegative().default(0),
})
export type RetrievalListItem = z.infer<typeof retrievalListItemSchema>

export const retrievalListSchema = z.object({
	schema_version: z.literal(RETRIEVAL_SCHEMA_VERSION).default(RETRIEVAL_SCHEMA_VERSION),
	retrievals: z.array(retrievalListItemSchema).default([]),
})
export type RetrievalList = z.infer<typeof retrievalListSchema>

export const retrievalAgentCandidateSchema = retrievalCandidateSchema.omit({ candidate_no: true, state: true }).extend({
	candidate_no: z.string().optional(),
	state: retrievalCandidateStateSchema.optional(),
})

export const retrievalAgentOutputSchema = z.object({
	retrieval_no: z.string().optional(),
	query: z.string().default(""),
	search_keywords: z.array(z.string()).default([]),
	search_provenance: retrievalSearchProvenanceSchema,
	result_summary: retrievalResultSummarySchema.partial().optional(),
	candidates: z.array(retrievalAgentCandidateSchema).default([]),
})
export type RetrievalAgentOutput = z.infer<typeof retrievalAgentOutputSchema>
