import React, { useState, useCallback, useMemo } from "react"
import { ArrowLeft, Search, Plus, Trash2, Download, BookOpen, Tag, ExternalLink } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { Button, Input } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import type { LiteratureEntry } from "@roo-code/types"

type LiteratureViewProps = {
	onDone: () => void
}

const LiteratureView: React.FC<LiteratureViewProps> = ({ onDone }) => {
	const { t } = useAppTranslation()
	const { literatureLibrary } = useExtensionState()

	const [searchQuery, setSearchQuery] = useState("")
	const [selectedTags, setSelectedTags] = useState<string[]>([])
	const [view, setView] = useState<"library" | "search">("library")

	const displayedEntries = useMemo(() => {
		const searchResults = literatureLibrary?.searchResults
		if (view === "search" && searchResults) return searchResults
		return literatureLibrary?.entries || []
	}, [view, literatureLibrary])

	const handleSearch = useCallback(() => {
		if (!searchQuery.trim()) return
		vscode.postMessage({
			type: "literatureSearch",
			query: searchQuery,
			tags: selectedTags,
		})
		setView("search")
	}, [searchQuery, selectedTags])

	const handleDelete = useCallback((id: string) => {
		vscode.postMessage({
			type: "literatureRemove",
			entryId: id,
		})
	}, [])

	const handleExport = useCallback(
		(format: "bibtex" | "json") => {
			vscode.postMessage({
				type: "literatureExport",
				format,
				tags: selectedTags.length > 0 ? selectedTags : undefined,
			})
		},
		[selectedTags],
	)

	const handleRequestLibrary = useCallback(() => {
		vscode.postMessage({ type: "literatureList", tags: selectedTags.length > 0 ? selectedTags : undefined })
	}, [selectedTags])

	const handleToggleTag = useCallback((tag: string) => {
		setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
	}, [])

	// Request library on mount
	// eslint-disable-next-line react-hooks/exhaustive-deps
	React.useEffect(() => {
		handleRequestLibrary()
	}, [])

	return (
		<Tab>
			<TabHeader>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={onDone}>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<BookOpen className="w-5 h-5" />
					<h3 className="text-lg font-semibold">{t("literature:title")}</h3>
				</div>
				<div className="flex items-center gap-2 ml-auto">
					<Button variant="outline" size="sm" onClick={() => handleExport("bibtex")}>
						<Download className="w-3 h-3 mr-1" />
						BibTeX
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleExport("json")}>
						<Download className="w-3 h-3 mr-1" />
						JSON
					</Button>
				</div>
			</TabHeader>

			<TabContent>
				{/* Search bar */}
				<div className="flex gap-2 mb-4 px-4 pt-4">
					<Input
						placeholder="Search literature..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="flex-1"
					/>
					<Button variant="primary" size="sm" onClick={handleSearch}>
						<Search className="w-4 h-4" />
					</Button>
				</div>

				{/* Tags filter */}
				{(literatureLibrary?.tags || []).length > 0 && (
					<div className="flex flex-wrap gap-1 px-4 mb-4">
						{(literatureLibrary?.tags || []).map(({ tag, count }: { tag: string; count: number }) => (
							<button
								key={tag}
								onClick={() => handleToggleTag(tag)}
								className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
									selectedTags.includes(tag)
										? "bg-primary text-primary-foreground"
										: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
								}`}>
								<Tag className="w-3 h-3" />
								{tag} ({count})
							</button>
						))}
					</div>
				)}

				{/* Stats bar */}
				{literatureLibrary?.stats && (
					<div className="px-4 mb-4 flex gap-4 text-sm text-muted-foreground">
						<span>
							<BookOpen className="w-3 h-3 inline mr-1" />
							{literatureLibrary?.stats?.totalEntries} papers
						</span>
						{literatureLibrary?.stats?.unreadCount > 0 && (
							<span className="text-amber-500">{literatureLibrary?.stats?.unreadCount} unread</span>
						)}
						<span>{literatureLibrary?.stats?.tagCount} tags</span>
					</div>
				)}

				{/* Results */}
				<div className="flex-1 overflow-auto px-4 pb-4 space-y-3">
					{view === "search" && (
						<div className="text-sm text-muted-foreground mb-2">
							Search results for &ldquo;{literatureLibrary?.searchQuery}&rdquo;
						</div>
					)}

					{displayedEntries.length === 0 && (
						<div className="text-center text-muted-foreground py-12">
							<BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
							<p>{view === "search" ? "No results found." : "Your literature library is empty."}</p>
							<p className="text-sm mt-1">Use the Sci-Roo agent to search and add papers.</p>
						</div>
					)}

					{displayedEntries.map((entry: LiteratureEntry) => (
						<div key={entry.id} className="p-4 rounded-lg border bg-card">
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1 min-w-0">
									<h4 className="font-medium text-sm leading-snug">{entry.title}</h4>
									<p className="text-xs text-muted-foreground mt-1">
										{entry.authors
											.slice(0, 3)
											.map((a: { lastName: string; firstName?: string }) =>
												`${a.lastName} ${a.firstName?.[0] || ""}`.trim(),
											)
											.join(", ")}
										{entry.authors.length > 3 && ` et al.`}
									</p>
									<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
										{entry.year && <span>{entry.year}</span>}
										{entry.journal && <span>{entry.journal}</span>}
										{entry.doi && (
											<a
												href={`https://doi.org/${entry.doi}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary hover:underline inline-flex items-center gap-0.5">
												<ExternalLink className="w-3 h-3" />
												DOI
											</a>
										)}
									</div>
									{entry.abstract && (
										<p className="text-xs mt-2 line-clamp-3 text-muted-foreground/80">
											{entry.abstract}
										</p>
									)}
									<div className="flex flex-wrap gap-1 mt-2">
										{(entry.tags || []).map((tag: string) => (
											<span
												key={tag}
												className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-secondary-foreground">
												{tag}
											</span>
										))}
										{!entry.isRead && (
											<span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-900 dark:text-amber-200">
												Unread
											</span>
										)}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="shrink-0"
									onClick={() => handleDelete(entry.id)}
									title="Remove from library">
									<Trash2 className="w-3 h-3 text-destructive" />
								</Button>
							</div>
						</div>
					))}
				</div>
			</TabContent>
		</Tab>
	)
}
export default React.memo(LiteratureView)
