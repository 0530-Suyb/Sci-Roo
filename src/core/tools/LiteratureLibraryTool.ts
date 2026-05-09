import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { LiteratureLibraryParams, LiteratureEntry } from "@roo-code/types"

export class LiteratureLibraryTool extends BaseTool<"literature_library"> {
	readonly name = "literature_library" as const

	async execute(params: LiteratureLibraryParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const provider = task.providerRef.deref()
			if (!provider) {
				pushToolResult("Error: provider not available.")
				return
			}

			const manager = provider.getLiteratureManager()
			if (!manager) {
				pushToolResult("Error: Literature Manager not initialized.")
				return
			}

			switch (params.action) {
				case "add": {
					if (!params.entry?.title) {
						pushToolResult("Error: 'entry' with at least 'title' is required for 'add' action.")
						return
					}

					const approved = await askApproval(
						"literature_library",
						`Add paper to library: "${params.entry.title}"`,
					)
					if (!approved) {
						pushToolResult("User denied adding paper to library.")
						return
					}

					const entry = await manager.addEntry({
						title: params.entry.title,
						authors: (params.entry.authors || []).map((a) => ({
							firstName: a.firstName || "",
							lastName: a.lastName || "",
						})),
						year: params.entry.year,
						journal: params.entry.journal,
						doi: params.entry.doi,
						abstract: params.entry.abstract,
						keywords: params.entry.keywords || [],
						source: params.entry.doi ? "doi-lookup" : "manual",
						tags: params.entry.tags || [],
						isRead: false,
					})

					pushToolResult(
						formatResponse.toolResult(
							`Paper added to library:\n` +
								`ID: ${entry.id}\n` +
								`Title: ${entry.title}\n` +
								`Authors: ${entry.authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ")}\n` +
								`${entry.doi ? `DOI: ${entry.doi}\n` : ""}` +
								`${entry.year ? `Year: ${entry.year}` : ""}`,
						),
					)
					break
				}

				case "remove": {
					if (!params.entryId) {
						pushToolResult("Error: 'entryId' is required for 'remove' action.")
						return
					}

					const entryToDelete = manager.getEntry(params.entryId)
					if (!entryToDelete) {
						pushToolResult(`Error: No entry found with ID "${params.entryId}".`)
						return
					}

					const approved = await askApproval(
						"literature_library",
						`Remove paper from library: "${entryToDelete.title}"`,
					)
					if (!approved) {
						pushToolResult("User denied removing paper from library.")
						return
					}

					const deleted = await manager.deleteEntry(params.entryId)
					pushToolResult(
						formatResponse.toolResult(
							deleted
								? `Removed from library: "${entryToDelete.title}"`
								: `Failed to remove entry "${params.entryId}".`,
						),
					)
					break
				}

				case "list": {
					let entries = manager.getAllEntries()
					if (params.tags && params.tags.length > 0) {
						entries = manager.filterByTags(params.tags)
					}
					pushToolResult(formatResponse.toolResult(this.formatEntryList(entries)))
					break
				}

				case "search": {
					if (!params.query) {
						pushToolResult("Error: 'query' is required for 'search' action.")
						return
					}
					const results = manager.searchLocal(params.query)
					pushToolResult(
						formatResponse.toolResult(
							`Search results for "${params.query}" (${results.length} found):\n\n` +
								this.formatEntryList(results),
						),
					)
					break
				}

				case "export": {
					if (!params.format) {
						pushToolResult("Error: 'format' is required for 'export' action (bibtex or json).")
						return
					}

					let entries = manager.getAllEntries()
					if (params.tags && params.tags.length > 0) {
						entries = manager.filterByTags(params.tags)
					}

					if (params.format === "bibtex") {
						const bibtex = manager.exportBibtex(entries.map((e) => e.id))
						pushToolResult(
							formatResponse.toolResult(
								`Exported ${entries.length} entries in BibTeX format:\n\n\`\`\`bibtex\n${bibtex}\n\`\`\``,
							),
						)
					} else {
						pushToolResult(
							formatResponse.toolResult(
								`Exported ${entries.length} entries in JSON format:\n\n\`\`\`json\n${JSON.stringify(entries, null, 2)}\n\`\`\``,
							),
						)
					}
					break
				}

				case "stats": {
					const stats = manager.getStats()
					pushToolResult(
						formatResponse.toolResult(
							`Literature Library Statistics:\n` +
								`Total entries: ${stats.totalEntries}\n` +
								`Unread: ${stats.unreadCount}\n` +
								`Unique tags: ${stats.tagCount}\n` +
								`Sources: ${JSON.stringify(stats.sourceBreakdown)}\n` +
								`Year distribution: ${JSON.stringify(stats.yearBreakdown)}`,
						),
					)
					break
				}

				default:
					pushToolResult(
						`Error: Unknown action "${params.action}". Valid actions: add, remove, list, search, export, stats.`,
					)
			}
		} catch (error) {
			await handleError("literature_library", error)
		}
	}

	private formatEntryList(entries: LiteratureEntry[]): string {
		if (entries.length === 0) return "No entries found."

		return entries
			.map(
				(e, i) =>
					`${i + 1}. **${e.title}**\n` +
					`   ID: ${e.id}\n` +
					`   Authors: ${e.authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ") || "N/A"}\n` +
					`   ${e.year ? `Year: ${e.year}` : "Year: N/A"} | ${e.journal || "N/A"}\n` +
					`   ${e.doi ? `DOI: ${e.doi}` : ""}\n` +
					`   Tags: ${e.tags.length > 0 ? e.tags.join(", ") : "(none)"} | ${e.isRead ? "Read" : "Unread"}`,
			)
			.join("\n\n")
	}
}

export const literatureLibraryTool = new LiteratureLibraryTool()
