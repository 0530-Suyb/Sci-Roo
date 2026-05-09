import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { SearchLiteratureParams } from "@roo-code/types"

export class SearchLiteratureTool extends BaseTool<"search_literature"> {
	readonly name = "search_literature" as const

	async execute(params: SearchLiteratureParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const approved = await askApproval(
				"search_literature",
				`Search for "${params.query}" in academic databases`,
			)
			if (!approved) {
				pushToolResult("User denied literature search request.")
				return
			}

			const provider = task.providerRef.deref()
			if (!provider) {
				pushToolResult("Error: provider not available.")
				return
			}

			const sources = params.sources?.join(", ") || "all available sources"
			const maxResults = params.maxResults || 20
			const yearFilter =
				params.yearFrom || params.yearTo ? ` (${params.yearFrom || "any"}-${params.yearTo || "any"})` : ""

			// Search is performed via MCP tools (PubMed, arXiv, etc.)
			// The agent should use available MCP servers for the actual search.
			// This tool provides a structured interface for the search action.
			pushToolResult(
				formatResponse.toolResult(
					`Literature search initiated:\n` +
						`Query: "${params.query}"\n` +
						`Sources: ${sources}\n` +
						`Max results: ${maxResults}${yearFilter}\n\n` +
						`To perform the actual search, use the available MCP tools (PubMed MCP, arXiv MCP, etc.) ` +
						`with the query above. After retrieving results, use the literature_library tool ` +
						`with action "add" to save relevant papers to the local library.\n\n` +
						`Search tip: For PubMed, use MeSH terms. For arXiv, use field prefixes like ti: (title), au: (author), abs: (abstract).`,
				),
			)
		} catch (error) {
			await handleError("search_literature", error)
		}
	}
}

export const searchLiteratureTool = new SearchLiteratureTool()
