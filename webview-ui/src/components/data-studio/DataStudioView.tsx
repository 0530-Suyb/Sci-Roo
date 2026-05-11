import React, { useState, useCallback, useRef, useEffect } from "react"
import { ArrowLeft, Play, Beaker, FileText, Clock, Loader2, Terminal, AlertCircle } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"

interface CodeRunResult {
	stdout: string
	stderr: string
	exitCode: number
	files: string[]
}

interface SessionEntry {
	id: string
	timestamp: number
	code: string
	language: "r" | "python"
	result: CodeRunResult
}

interface DataStudioStateData {
	lastRun?: SessionEntry
	history: SessionEntry[]
	files: string[]
	rAvailable: boolean
	pythonAvailable: boolean
	error?: string
	running?: boolean
}

type DataStudioViewProps = {
	onDone: () => void
}

const DataStudioView: React.FC<DataStudioViewProps> = ({ onDone }) => {
	const { dataStudioState } = useExtensionState()
	const state = (dataStudioState || {}) as DataStudioStateData

	const [code, setCode] = useState("")
	const [language, setLanguage] = useState<"r" | "python">("python")
	const [outputTab, setOutputTab] = useState<"stdout" | "stderr" | "files">("stdout")
	const [running, setRunning] = useState(false)
	const codeEditorRef = useRef<HTMLTextAreaElement>(null)

	const lastRun = state.lastRun
	const history = state.history || []
	const files = state.files || []
	const rAvailable = state.rAvailable
	const pythonAvailable = state.pythonAvailable
	const error = state.error

	useEffect(() => {
		if (state.running !== undefined) {
			setRunning(state.running)
		}
	}, [state.running])

	const handleRun = useCallback(() => {
		if (!code.trim()) return
		setRunning(true)
		vscode.postMessage({
			type: "dataStudioRun",
			text: code,
			query: language,
		})
	}, [code, language])

	const handleLoadHistory = useCallback((entry: SessionEntry) => {
		setCode(entry.code)
		setLanguage(entry.language)
	}, [])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault()
				handleRun()
			}
		},
		[handleRun],
	)

	const handleRequestList = useCallback(() => {
		vscode.postMessage({ type: "dataStudioList" })
	}, [])

	useEffect(() => {
		handleRequestList()
	}, [handleRequestList])

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={onDone}>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<Beaker className="w-5 h-5" />
					<h3 className="text-lg font-semibold">Data Studio</h3>
				</div>
				<div className="flex items-center gap-2 ml-auto">
					<span
						className={`text-xs px-2 py-0.5 rounded-full ${pythonAvailable ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
						Python {pythonAvailable ? "Available" : "N/A"}
					</span>
					<span
						className={`text-xs px-2 py-0.5 rounded-full ${rAvailable ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
						R {rAvailable ? "Available" : "N/A"}
					</span>
					<Button variant="primary" size="sm" onClick={handleRun} disabled={running || !code.trim()}>
						{running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
						<span className="ml-1">{running ? "Running..." : "Run"}</span>
					</Button>
				</div>
			</TabHeader>

			<TabContent>
				<div className="flex flex-col h-full">
					{/* Language selector */}
					<div className="flex items-center gap-2 px-4 pt-4">
						<label className="text-xs font-medium text-muted-foreground">Language:</label>
						<select
							value={language}
							onChange={(e) => setLanguage(e.target.value as "r" | "python")}
							className="text-xs border rounded px-2 py-1 bg-background"
							disabled={running}>
							<option value="python">Python</option>
							<option value="r">R</option>
						</select>
						<span className="text-xs text-muted-foreground ml-auto">Ctrl+Enter to run</span>
					</div>

					{/* Code editor */}
					<div className="px-4 pt-2 flex-1 min-h-0">
						<textarea
							ref={codeEditorRef}
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={`# Enter ${language === "r" ? "R" : "Python"} code here...\n# Examples:\n# Python: import pandas as pd; df = pd.read_csv("data.csv"); print(df.describe())\n# R: library(ggplot2); summary(mtcars)`}
							disabled={running}
							className="w-full h-full resize-none font-mono text-sm p-4 rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
							spellCheck={false}
						/>
					</div>

					{/* Output area */}
					<div className="border-t mx-4 mt-2">
						<div className="flex items-center gap-1 py-1">
							<button
								onClick={() => setOutputTab("stdout")}
								className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
									outputTab === "stdout"
										? "bg-background border border-b-0"
										: "text-muted-foreground hover:text-foreground"
								}`}>
								<Terminal className="w-3 h-3 inline mr-1" />
								Output
							</button>
							<button
								onClick={() => setOutputTab("stderr")}
								className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
									outputTab === "stderr"
										? "bg-background border border-b-0"
										: "text-muted-foreground hover:text-foreground"
								}`}>
								<AlertCircle className="w-3 h-3 inline mr-1" />
								Errors
							</button>
							<button
								onClick={() => setOutputTab("files")}
								className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
									outputTab === "files"
										? "bg-background border border-b-0"
										: "text-muted-foreground hover:text-foreground"
								}`}>
								<FileText className="w-3 h-3 inline mr-1" />
								Files ({files.length})
							</button>
						</div>
						<div className="border rounded-b rounded-tr min-h-[120px] max-h-[250px] overflow-auto bg-muted/20 p-3 font-mono text-xs">
							{outputTab === "stdout" && (
								<>
									{error && (
										<div className="text-red-500 mb-2 p-2 rounded bg-red-50 dark:bg-red-950">
											{error}
										</div>
									)}
									{lastRun ? (
										<pre className="whitespace-pre-wrap break-all">
											<code>{lastRun.result.stdout || "(no output)"}</code>
										</pre>
									) : (
										<div className="text-muted-foreground italic">Run code to see output.</div>
									)}
								</>
							)}
							{outputTab === "stderr" && (
								<>
									{lastRun ? (
										<pre className="whitespace-pre-wrap break-all text-red-600 dark:text-red-400">
											<code>{lastRun.result.stderr || "(no errors)"}</code>
										</pre>
									) : (
										<div className="text-muted-foreground italic">No errors yet.</div>
									)}
								</>
							)}
							{outputTab === "files" && (
								<>
									{files.length > 0 ? (
										<div className="space-y-1">
											{files.map((f, i) => (
												<div key={i} className="flex items-center gap-2 text-xs">
													<FileText className="w-3 h-3 text-muted-foreground" />
													<span className="truncate">{f}</span>
												</div>
											))}
										</div>
									) : (
										<div className="text-muted-foreground italic">
											No generated files. Files (images, CSVs, etc.) saved to .roo/data-studio/
											will appear here.
										</div>
									)}
								</>
							)}
						</div>
					</div>

					{/* History */}
					{history.length > 0 && (
						<div className="px-4 py-3 border-t mt-2">
							<div className="flex items-center gap-2 mb-2">
								<Clock className="w-3 h-3 text-muted-foreground" />
								<span className="text-xs font-medium text-muted-foreground">Run History</span>
							</div>
							<div className="max-h-[150px] overflow-auto space-y-1">
								{history.slice(0, 10).map((entry) => (
									<button
										key={entry.id}
										onClick={() => handleLoadHistory(entry)}
										className="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors flex items-center gap-2">
										<span
											className={`px-1 rounded text-[10px] font-medium uppercase ${entry.language === "python" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"}`}>
											{entry.language}
										</span>
										<span className="text-muted-foreground truncate flex-1">
											{entry.code.slice(0, 80).replace(/\n/g, " ")}
										</span>
										<span className="text-muted-foreground shrink-0">
											{new Date(entry.timestamp).toLocaleTimeString()}
										</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</TabContent>
		</Tab>
	)
}

export default React.memo(DataStudioView)
