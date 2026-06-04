import { fireEvent, render, screen } from "@/utils/test-utils"
import { TooltipProvider } from "@/components/ui/tooltip"

import { LibraryDraftPanel } from "../LibraryDraftPanel"

describe("LibraryDraftPanel", () => {
	it("calls the PDF analysis entry point when a workspace is available", () => {
		const onAnalyzePdfs = vi.fn()

		render(
			<TooltipProvider>
				<LibraryDraftPanel
					libraryEntries={[]}
					libraryStats={{ totalEntries: 0, unreadCount: 0, tagCount: 0 }}
					canAnalyzePdfs
					onAnalyzePdfs={onAnalyzePdfs}
					onRefresh={vi.fn()}
				/>
			</TooltipProvider>,
		)

		fireEvent.click(screen.getByRole("button", { name: "Analyze PDFs" }))

		expect(onAnalyzePdfs).toHaveBeenCalledTimes(1)
	})

	it("disables PDF analysis when no workspace is open", () => {
		render(
			<TooltipProvider>
				<LibraryDraftPanel
					libraryEntries={[]}
					libraryStats={{ totalEntries: 0, unreadCount: 0, tagCount: 0 }}
					canAnalyzePdfs={false}
					onAnalyzePdfs={vi.fn()}
					onRefresh={vi.fn()}
				/>
			</TooltipProvider>,
		)

		expect(screen.getByRole("button", { name: "Analyze PDFs" })).toBeDisabled()
	})
})
