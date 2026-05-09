import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "@roo-code/types"

export async function handleResearchPipelineRun(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getResearchPipelineManager()
		if (!manager) return

		const action = message.action as string | undefined
		const text = message.text as string | undefined

		switch (action) {
			case "createProject": {
				const name = (message.query as string) || "Untitled Project"
				const description = (message.text as string) || ""
				await manager.createProject(name, description)
				break
			}
			case "setStage": {
				await manager.setStage(message.query as any)
				break
			}
			case "addHypothesis": {
				if (text) {
					await manager.addHypothesis(text, (message.query as string) || "")
				}
				break
			}
			case "addExperiment": {
				if (text) {
					await manager.addExperiment(text, (message.query as string) || "")
				}
				break
			}
			case "addNote": {
				if (text) {
					await manager.addNote(text)
				}
				break
			}
			case "deleteProject": {
				const projectId = message.query as string
				if (projectId) {
					await manager.deleteProject(projectId)
				}
				break
			}
		}

		const state = await manager.getState()
		await provider.postMessageToWebview({
			type: "researchPipelineState",
			researchPipelineState: state,
		})
	} catch (error) {
		provider.log(`Research Pipeline error: ${error}`)
		await provider.postMessageToWebview({
			type: "researchPipelineState",
			researchPipelineState: { error: error instanceof Error ? error.message : String(error) },
		})
	}
}

export async function handleResearchPipelineList(provider: ClineProvider): Promise<void> {
	try {
		const manager = provider.getResearchPipelineManager()
		if (!manager) return

		const state = await manager.getState()
		await provider.postMessageToWebview({
			type: "researchPipelineState",
			researchPipelineState: state,
		})
	} catch (error) {
		provider.log(`Research Pipeline list error: ${error}`)
	}
}
