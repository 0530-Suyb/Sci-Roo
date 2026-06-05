import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "literature_library",
		description:
			"Manage the local literature library. Use this to add papers to your collection, search your saved papers, export citations in BibTeX format, remove entries, or view library statistics. The library is stored in .roo/literature/library.json. For listing all entries, call with only {\"action\":\"list\"}. Only include 'query' for the 'search' action, and only include 'tags' when you actually want tag filtering.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["add", "remove", "list", "search", "export", "stats"],
					description:
						"add: add a paper to the library. remove: delete a paper by entryId. list: list all papers (optionally filtered by tags). search: full-text search across title, authors, abstract, keywords. export: export papers as BibTeX or JSON. stats: get library statistics. When listing everything, use only action=list and omit empty query/tags fields.",
				},
				entryId: {
					type: "string",
					description: "The ID of the entry to remove. Required for 'remove' action.",
				},
				query: {
					type: "string",
					description:
						"Search query for 'search' action. Matches against title, authors, abstract, keywords, and tags.",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Filter by tags for 'list' or 'export' actions.",
				},
				format: {
					type: "string",
					enum: ["bibtex", "json"],
					description: "Export format. Required for 'export' action.",
				},
				entry: {
					type: "object",
					properties: {
						title: { type: "string", description: "Paper title." },
						authors: {
							type: "array",
							items: {
								type: "object",
								properties: {
									firstName: { type: "string" },
									lastName: { type: "string" },
								},
								required: ["lastName"],
							},
							description: "List of authors.",
						},
						year: { type: "number", description: "Publication year." },
						journal: { type: "string", description: "Journal or conference name." },
						doi: { type: "string", description: "DOI of the paper." },
						abstract: { type: "string", description: "Paper abstract." },
						keywords: { type: "array", items: { type: "string" }, description: "Keywords." },
						tags: {
							type: "array",
							items: { type: "string" },
							description: "User-defined tags for organization.",
						},
					},
					required: ["title"],
					description: "Paper metadata. Required for 'add' action.",
				},
			},
			required: ["action"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
