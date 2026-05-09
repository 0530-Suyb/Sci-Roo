import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "@roo-code/types"

export async function handleDataStudioRun(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = provider.getDataStudioManager()
		if (!manager) return

		const code = message.text as string
		const language = (message.query as string) || "python"
		if (!code) return

		await provider.postMessageToWebview({
			type: "dataStudioState",
			dataStudioState: { running: true },
		})

		const { state } = await manager.runCode(code, language as "r" | "python")

		await provider.postMessageToWebview({
			type: "dataStudioState",
			dataStudioState: { ...state, running: false },
		})
	} catch (error) {
		provider.log(`Data Studio run error: ${error}`)
		await provider.postMessageToWebview({
			type: "dataStudioState",
			dataStudioState: {
				error: error instanceof Error ? error.message : String(error),
				running: false,
			},
		})
	}
}

export async function handleDataStudioList(provider: ClineProvider): Promise<void> {
	try {
		const manager = provider.getDataStudioManager()
		if (!manager) return

		const state = await manager.getState()
		await provider.postMessageToWebview({
			type: "dataStudioState",
			dataStudioState: state,
		})
	} catch (error) {
		provider.log(`Data Studio list error: ${error}`)
	}
}
