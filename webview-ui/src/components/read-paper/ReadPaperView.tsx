import React from "react"

import ReadPaperWorkspaceShell from "./ReadPaperWorkspaceShell"
import type { ReadPaperAnalysisChatOpener } from "./useReadPaperAnalysisLauncher"
import { useReadPaperController } from "./useReadPaperController"

type ReadPaperViewProps = {
	onDone: () => void
	onOpenAnalysisChat?: ReadPaperAnalysisChatOpener
}

const ReadPaperView: React.FC<ReadPaperViewProps> = ({ onDone, onOpenAnalysisChat }) => {
	const controller = useReadPaperController()

	return <ReadPaperWorkspaceShell onDone={onDone} controller={controller} onOpenAnalysisChat={onOpenAnalysisChat} />
}

export default React.memo(ReadPaperView)
