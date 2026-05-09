import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "@roo-code/types"

export async function handlePaperWritingAction(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getPaperWritingManager()
		if (!manager) return

		const action = message.action as string | undefined
		const text = message.text as string | undefined

		switch (action) {
			case "createManuscript": {
				const title = (message.query as string) || "Untitled Manuscript"
				const authors = (message as any).authors || [
					{ firstName: "Author", lastName: "One", isCorresponding: true },
				]
				const citationStyle = (message as any).citationStyle || "apa"
				await manager.createManuscript(title, authors, citationStyle)
				break
			}
			case "updateSection": {
				const sectionType = (message as any).sectionType as any
				const sectionTitle = ((message as any).sectionTitle as string) || sectionType
				const sectionContent = text || ""
				if (sectionType) {
					await manager.updateSection(sectionType, sectionTitle, sectionContent)
				}
				break
			}
			case "addFigure": {
				const caption = (message.query as string) || ""
				const filePath = (message.text as string) || ""
				const sectionId = ((message as any).sectionId as string) || ""
				if (caption && filePath) {
					await manager.addFigure(caption, filePath, sectionId)
				}
				break
			}
			case "addTable": {
				const caption = (message.query as string) || ""
				const dataFile = (message.text as string) || ""
				const sectionId = ((message as any).sectionId as string) || ""
				if (caption && dataFile) {
					await manager.addTable(caption, dataFile, sectionId)
				}
				break
			}
			case "addCitations": {
				const citationIds = ((message as any).citationIds as string[]) || []
				if (citationIds.length > 0) {
					await manager.addCitations(citationIds)
				}
				break
			}
			case "setStatus": {
				const status = message.query as any
				if (status) {
					await manager.setManuscriptStatus(status)
				}
				break
			}
			case "exportManuscript": {
				const format = (message.query as any) || "markdown"
				const exportPath = await manager.exportManuscript(format)
				provider.log(`Manuscript exported to: ${exportPath}`)
				break
			}
		}

		const state = await manager.getState()
		await provider.postMessageToWebview({
			type: "paperWritingState",
			paperWritingState: state,
		})
	} catch (error) {
		provider.log(`Paper Writing error: ${error}`)
		await provider.postMessageToWebview({
			type: "paperWritingState",
			paperWritingState: { error: error instanceof Error ? error.message : String(error) },
		})
	}
}

export async function handlePaperWritingList(provider: ClineProvider): Promise<void> {
	try {
		const manager = provider.getPaperWritingManager()
		if (!manager) return

		const state = await manager.getState()
		await provider.postMessageToWebview({
			type: "paperWritingState",
			paperWritingState: state,
		})
	} catch (error) {
		provider.log(`Paper Writing list error: ${error}`)
	}
}
