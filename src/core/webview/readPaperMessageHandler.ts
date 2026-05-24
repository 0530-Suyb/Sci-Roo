import type { ClineProvider } from "./ClineProvider"
import { createDefaultReadPaperWorkspaceConfig, type WebviewMessage } from "@roo-code/types"

function formatReadPaperError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

async function postErrorState(provider: ClineProvider, error: unknown): Promise<void> {
	await provider.postMessageToWebview({
		type: "readPaperRetrievalState",
		readPaperRetrievalState: {
			retrievals: [],
			selectedRetrieval: undefined,
			last_error: formatReadPaperError(error),
			last_error_at: new Date().toISOString(),
		},
	})
}

function prepareManager(provider: ClineProvider, message?: WebviewMessage) {
	const manager = provider.getRetrievalManager()
	const cwd = message?.values?.cwd
	if (manager && typeof cwd === "string") {
		manager.setWorkspaceCwd(cwd)
	}
	return manager
}

async function postState(provider: ClineProvider, selectedRetrievalNo?: string): Promise<void> {
	const manager = provider.getRetrievalManager()
	if (!manager) {
		await provider.postMessageToWebview({
			type: "readPaperRetrievalState",
			readPaperRetrievalState: { retrievals: [], selectedRetrieval: undefined },
		})
		return
	}

	await provider.postMessageToWebview({
		type: "readPaperRetrievalState",
		readPaperRetrievalState: await manager.getState(selectedRetrievalNo),
	})
}

async function postWorkspaceConfig(provider: ClineProvider): Promise<void> {
	const manager = provider.getRetrievalManager()
	if (!manager) {
		await provider.postMessageToWebview({
			type: "readPaperWorkspaceConfig",
			readPaperWorkspaceConfig: createDefaultReadPaperWorkspaceConfig(),
		})
		return
	}

	await provider.postMessageToWebview({
		type: "readPaperWorkspaceConfig",
		readPaperWorkspaceConfig: await manager.getWorkspaceConfig(),
	})
}

export async function handleReadPaperListRetrievals(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		prepareManager(provider, message)
		await postState(provider, message.values?.retrieval_no as string | undefined)
	} catch (error) {
		provider.log(`ReadPaper list retrievals error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperCreateRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		if (!manager) return

		const retrieval = await manager.createRetrieval((message.values ?? {}) as any)
		await postState(provider, retrieval.retrieval_no)
	} catch (error) {
		provider.log(`ReadPaper create retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperGetWorkspaceConfig(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	try {
		prepareManager(provider, message)
		await postWorkspaceConfig(provider)
	} catch (error) {
		provider.log(`ReadPaper get workspace config error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperUpdateWorkspaceConfig(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		if (!manager) return

		await manager.updateWorkspaceConfig((message.values?.updates ?? message.values?.config ?? {}) as any)
		await postWorkspaceConfig(provider)
	} catch (error) {
		provider.log(`ReadPaper update workspace config error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperResetWorkspaceConfig(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		if (!manager) return

		await manager.resetWorkspaceConfig()
		await postWorkspaceConfig(provider)
	} catch (error) {
		provider.log(`ReadPaper reset workspace config error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperUpdateRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager || !retrievalNo) return

		const retrieval = await manager.updateRetrieval(retrievalNo, (message.values?.updates ?? {}) as any)
		await postState(provider, retrieval.retrieval_no)
	} catch (error) {
		provider.log(`ReadPaper update retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperRunRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		let retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager) return

		if (message.values?.updates) {
			if (retrievalNo) {
				await manager.updateRetrieval(retrievalNo, message.values.updates as any)
			} else {
				const created = await manager.createRetrieval(message.values.updates as any)
				retrievalNo = created.retrieval_no
			}
		}
		if (!retrievalNo) return

		const retrieval = await manager.runRetrieval(retrievalNo)
		await postState(provider, retrieval.retrieval_no)
	} catch (error) {
		provider.log(`ReadPaper run retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperUpdateCandidate(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		const candidateNo = message.values?.candidate_no as string | undefined
		if (!manager || !retrievalNo || !candidateNo) return

		const retrieval = await manager.updateCandidate(
			retrievalNo,
			candidateNo,
			(message.values?.updates ?? {}) as any,
		)
		await postState(provider, retrieval.retrieval_no)
	} catch (error) {
		provider.log(`ReadPaper update candidate error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperConfirmRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager || !retrievalNo) return

		const retrieval = await manager.confirmRetrieval(retrievalNo)
		await postState(provider, retrieval.retrieval_no)
	} catch (error) {
		provider.log(`ReadPaper confirm retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperArchiveRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager || !retrievalNo) return

		const retrieval = await manager.archiveRetrieval(retrievalNo)
		await postState(provider, retrieval.retrieval_no)
	} catch (error) {
		provider.log(`ReadPaper archive retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperDeleteRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager || !retrievalNo) return

		await manager.deleteRetrieval(retrievalNo)
	} catch (error) {
		provider.log(`ReadPaper delete retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperDeleteRetrievalWithImportedEntries(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager || !retrievalNo) return

		await manager.deleteRetrievalWithImportedEntries(retrievalNo)
	} catch (error) {
		provider.log(`ReadPaper delete retrieval with imported entries error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperImportCandidate(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		const candidateNo = message.values?.candidate_no as string | undefined
		if (!manager || !retrievalNo || !candidateNo) return

		await manager.importCandidateToLibrary(retrievalNo, candidateNo)
	} catch (error) {
		provider.log(`ReadPaper import candidate error: ${error}`)
		await postErrorState(provider, error)
	}
}

export async function handleReadPaperImportRetrieval(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const manager = prepareManager(provider, message)
		const retrievalNo = message.values?.retrieval_no as string | undefined
		if (!manager || !retrievalNo) return

		await manager.importRetrievalToLibrary(retrievalNo)
	} catch (error) {
		provider.log(`ReadPaper import retrieval error: ${error}`)
		await postErrorState(provider, error)
	}
}
