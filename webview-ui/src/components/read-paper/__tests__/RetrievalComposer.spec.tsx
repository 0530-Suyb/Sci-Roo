import { fireEvent, render, screen } from "@/utils/test-utils"
import { DEFAULT_RETRIEVAL_SOURCES, type ReadPaperWorkspaceConfig } from "@roo-code/types"
import { TooltipProvider } from "@/components/ui/tooltip"

import { RetrievalComposer, type RetrievalComposerProps } from "../RetrievalComposer"
import type { FormState } from "../types"

const form: FormState = {
	title: "",
	Q: "Find papers about retrieval augmented research agents",
	query: "",
	search_keywords: "",
	retrieval_strategy: "scholarly_only",
	search_sources: DEFAULT_RETRIEVAL_SOURCES,
	max_results: 20,
	year_from: "",
	year_to: "",
}

const workspaceConfig: ReadPaperWorkspaceConfig = {
	schema_version: "1.0",
	planner_profile_id: "",
	planner_profile_name: "",
	execution_mode: "lightweight_job",
	default_retrieval_strategy: "scholarly_only",
	default_sources: DEFAULT_RETRIEVAL_SOURCES,
	default_max_results: 20,
	default_year_from: undefined,
	default_year_to: undefined,
	default_import_target: "literature_library",
}

const defaultProps: RetrievalComposerProps = {
	form,
	workspaceConfig,
	selectedRetrieval: undefined,
	workspaceProfileName: "Default",
	hasRetrievalInput: true,
	canRun: true,
	isRunning: false,
	queryComposerOpen: false,
	advancedQueryOpen: false,
	runStatusLabel: "Draft",
	onQueryComposerOpenChange: vi.fn(),
	onAdvancedQueryOpenChange: vi.fn(),
	onUpdateForm: vi.fn(),
	onToggleSource: vi.fn(),
	onSetStrategy: vi.fn(),
	onSave: vi.fn(),
	onRun: vi.fn(),
	onImportRetrieval: vi.fn(),
	onArchiveRetrieval: vi.fn(),
	onRequestDeleteRetrieval: vi.fn(),
}

const renderComposer = (props: Partial<RetrievalComposerProps> = {}) =>
	render(
		<TooltipProvider>
			<RetrievalComposer {...defaultProps} {...props} />
		</TooltipProvider>,
	)

describe("RetrievalComposer", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the compact query summary by default", () => {
		renderComposer()

		expect(screen.getByRole("button", { name: "Toggle query composer" })).toBeInTheDocument()
		expect(screen.getByText("Find papers about retrieval augmented research agents")).toBeInTheDocument()
		expect(
			screen.queryByPlaceholderText("Describe the literature request in plain language"),
		).not.toBeInTheDocument()
	})

	it("calls onRun when Run is clicked", () => {
		const onRun = vi.fn()
		renderComposer({ onRun })

		fireEvent.click(screen.getByRole("button", { name: "Run" }))

		expect(onRun).toHaveBeenCalledTimes(1)
	})

	it("calls onSave from the expanded retrieval actions", async () => {
		const onSave = vi.fn()
		renderComposer({ queryComposerOpen: true, onSave })

		fireEvent.click(screen.getByRole("button", { name: "Save draft" }))

		expect(onSave).toHaveBeenCalledTimes(1)
	})

	it("keeps advanced settings collapsed by default and expands through the trigger", () => {
		const onQueryComposerOpenChange = vi.fn()
		const onAdvancedQueryOpenChange = vi.fn()
		const { rerender } = renderComposer({
			queryComposerOpen: true,
			onQueryComposerOpenChange,
			onAdvancedQueryOpenChange,
		})

		expect(screen.getByPlaceholderText("Describe the literature request in plain language")).toBeInTheDocument()

		expect(screen.queryByPlaceholderText("Auto-generated title")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Toggle advanced query settings" }))

		expect(onAdvancedQueryOpenChange).toHaveBeenCalledWith(true)

		rerender(
			<TooltipProvider>
				<RetrievalComposer
					{...defaultProps}
					queryComposerOpen={true}
					advancedQueryOpen={true}
					onQueryComposerOpenChange={onQueryComposerOpenChange}
					onAdvancedQueryOpenChange={onAdvancedQueryOpenChange}
				/>
			</TooltipProvider>,
		)

		expect(screen.getByPlaceholderText("Auto-generated title")).toBeInTheDocument()
	})
})
