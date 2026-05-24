import { z } from "zod"

import {
	DEFAULT_RETRIEVAL_STRATEGY,
	DEFAULT_RETRIEVAL_SOURCES,
	readPaperExecutionModeSchema,
	retrievalListItemSchema,
	retrievalSourceSchema,
	retrievalStrategySchema,
	retrievalTaskSchema,
} from "./retrieval.js"

export const READPAPER_CONFIG_SCHEMA_VERSION = "1.0"
export const READPAPER_CONFIG_FILENAME = "readpaper.json"
export { readPaperExecutionModeSchema, type ReadPaperExecutionMode } from "./retrieval.js"

export const readPaperWorkspaceConfigSchema = z.object({
	schema_version: z.literal(READPAPER_CONFIG_SCHEMA_VERSION).default(READPAPER_CONFIG_SCHEMA_VERSION),
	planner_profile_id: z.string().default(""),
	planner_profile_name: z.string().default(""),
	execution_mode: readPaperExecutionModeSchema.default("lightweight_job"),
	default_retrieval_strategy: retrievalStrategySchema.default(DEFAULT_RETRIEVAL_STRATEGY),
	default_sources: z.array(retrievalSourceSchema).default(DEFAULT_RETRIEVAL_SOURCES),
	default_max_results: z.number().int().positive().max(200).default(20),
	default_year_from: z.number().int().min(1500).max(3000).nullable().optional(),
	default_year_to: z.number().int().min(1500).max(3000).nullable().optional(),
	default_import_target: z.enum(["literature_library"]).default("literature_library"),
})
export type ReadPaperWorkspaceConfig = z.infer<typeof readPaperWorkspaceConfigSchema>

export const readPaperSearchPlanSchema = z.object({
	query: z.string().default(""),
	search_keywords: z.array(z.string()).default([]),
	search_sources: z.array(retrievalSourceSchema).default(DEFAULT_RETRIEVAL_SOURCES),
	max_results: z.number().int().positive().max(200).default(20),
	year_from: z.number().int().min(1500).max(3000).nullable().optional(),
	year_to: z.number().int().min(1500).max(3000).nullable().optional(),
	notes: z.string().default(""),
})
export type ReadPaperSearchPlan = z.infer<typeof readPaperSearchPlanSchema>

export const readPaperRetrievalStateSchema = z.object({
	retrievals: z.array(retrievalListItemSchema).default([]),
	selectedRetrieval: retrievalTaskSchema.optional(),
	config: readPaperWorkspaceConfigSchema.optional(),
	last_error: z.string().optional(),
	last_error_at: z.string().optional(),
})
export type ReadPaperRetrievalState = z.infer<typeof readPaperRetrievalStateSchema>

export function createDefaultReadPaperWorkspaceConfig(): ReadPaperWorkspaceConfig {
	return readPaperWorkspaceConfigSchema.parse({})
}

export function createDefaultReadPaperSearchPlan(): ReadPaperSearchPlan {
	return readPaperSearchPlanSchema.parse({})
}

export function createDefaultReadPaperRetrievalState(): ReadPaperRetrievalState {
	return readPaperRetrievalStateSchema.parse({})
}
