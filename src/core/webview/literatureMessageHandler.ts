import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "@roo-code/types"

/**
 * Handle literature list request.
 */
export async function handleLiteratureList(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getLiteratureManager()
		if (!manager) {
			await provider.postMessageToWebview({
				type: "literatureState",
				literatureState: { entries: [], tags: [], stats: null, searchResults: null, searchQuery: null },
			})
			return
		}

		const tags = message.tags as string[] | undefined
		const entries = tags && tags.length > 0 ? manager.filterByTags(tags) : manager.getAllEntries()
		const allTags = manager.getAllTags()
		const stats = manager.getStats()

		await provider.postMessageToWebview({
			type: "literatureState",
			literatureState: {
				entries,
				tags: allTags,
				stats,
				searchResults: null,
				searchQuery: null,
			},
		})
	} catch (error) {
		provider.log(`Literature list error: ${error}`)
	}
}

/**
 * Handle literature search in local library.
 */
export async function handleLiteratureSearch(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getLiteratureManager()
		if (!manager) return

		const query = (message.query as string) || ""
		const results = manager.searchLocal(query)

		await provider.postMessageToWebview({
			type: "literatureState",
			literatureState: {
				entries: [],
				tags: manager.getAllTags(),
				stats: manager.getStats(),
				searchResults: results,
				searchQuery: query,
			},
		})
	} catch (error) {
		provider.log(`Literature search error: ${error}`)
	}
}

/**
 * Handle adding a paper to the library from a string (e.g., DOI or title).
 */
export async function handleLiteratureAdd(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getLiteratureManager()
		if (!manager) return

		const text = (message.text as string)?.trim()
		if (!text) return

		// Check if it looks like a DOI
		const doiMatch = text.match(/10\.\d{4,}\/[\w.\-/]+/)
		const doi = doiMatch ? doiMatch[0] : undefined

		await manager.addEntry({
			title: doi ? `[Resolving DOI: ${doi}...]` : text,
			authors: [],
			keywords: [],
			source: doi ? "doi-lookup" : "manual",
			doi,
			tags: [],
			isRead: false,
		})

		// Refresh the list
		await handleLiteratureList(provider, message)
	} catch (error) {
		provider.log(`Literature add error: ${error}`)
	}
}

/**
 * Handle removing a paper from the library.
 */
export async function handleLiteratureRemove(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getLiteratureManager()
		if (!manager) return

		const entryId = message.entryId as string
		if (!entryId) return

		await manager.deleteEntry(entryId)

		// Refresh the list
		await handleLiteratureList(provider, message)
	} catch (error) {
		provider.log(`Literature remove error: ${error}`)
	}
}

/**
 * Handle exporting the literature library.
 */
export async function handleLiteratureExport(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getLiteratureManager()
		if (!manager) return

		const format = (message.format as string) || "bibtex"
		const tags = message.tags as string[] | undefined

		let entries = manager.getAllEntries()
		if (tags && tags.length > 0) {
			entries = manager.filterByTags(tags)
		}

		let output: string
		if (format === "bibtex") {
			output = manager.exportBibtex(entries.map((e) => e.id))
		} else {
			output = JSON.stringify(entries, null, 2)
		}

		await provider.postMessageToWebview({
			type: "literatureExportResult",
			literatureExportResult: {
				format,
				content: output,
			},
		})
	} catch (error) {
		provider.log(`Literature export error: ${error}`)
	}
}
