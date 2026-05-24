import { RETRIEVAL_SOURCES } from "@roo-code/types"
import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "search_literature",
		description:
			"Search for academic papers across PubMed, arXiv, Semantic Scholar, Crossref, OpenAlex, DBLP, IEEE Xplore, and ACM Digital Library metadata. Use this tool to find scientific literature on a topic, discover recent papers, or gather references for a research project. Returns structured paper metadata including titles, authors, abstracts, and DOIs.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"The executable academic database query in English. Translate non-English natural-language requests into English first; do not pass Chinese text directly. Use Boolean operators (AND, OR, NOT) and field-specific terms for better results.",
				},
				sources: {
					type: "array",
					items: {
						type: "string",
						enum: RETRIEVAL_SOURCES,
					},
					description:
						"Which academic databases to search. Defaults to all available sources if not specified.",
				},
				maxResults: {
					type: "number",
					description: "Maximum number of results to return (default: 20, max: 100).",
				},
				yearFrom: {
					type: "number",
					description: "Filter papers published from this year onward (inclusive).",
				},
				yearTo: {
					type: "number",
					description: "Filter papers published up to this year (inclusive).",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
