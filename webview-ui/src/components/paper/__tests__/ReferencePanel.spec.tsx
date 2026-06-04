import React from "react"
import type { VerificationEntry, VerificationStore } from "@roo-code/types"
import { fireEvent, render, screen, within } from "../../../utils/test-utils"

import { ReferencePanel } from "../ReferencePanel"

describe("ReferencePanel", () => {
	const baseReferenceEntries = [
		referenceEntry("smith2024", "Transformer Models in Scientific Writing"),
		referenceEntry("wang2023", "Climate Change Analysis"),
		referenceEntry("lee2021", "Graph Neural Networks for Molecules"),
	]

	it("hides quick actions when all tracked citations are healthy", () => {
		render(
			<ReferencePanel
				referenceEntries={baseReferenceEntries}
				uncatalogued={[]}
				cited={["smith2024"]}
				missing={[]}
				citationPlaceholderCount={0}
				bibGenerated={false}
				bibPreview={null}
				verificationState={verificationStore({
					smith2024: verificationEntry("smith2024", "verified", "doi-match"),
				})}
			/>,
		)

		expect(screen.getByText("All tracked citations are verified or accounted for.")).toBeInTheDocument()
		expect(screen.queryByText("Verify unverified citations")).not.toBeInTheDocument()
		expect(screen.queryByText("Fix flagged issues with Agent")).not.toBeInTheDocument()
	})

	it("shows mixed citation issues and hides dismissed entries from the attention list", () => {
		const onJumpToPlaceholder = vi.fn()
		const onFixCitationPlaceholders = vi.fn()
		render(
			<ReferencePanel
				referenceEntries={baseReferenceEntries}
				uncatalogued={[]}
				cited={["smith2024", "wang2023", "lee2021", "ghost2025"]}
				missing={["ghost2025"]}
				citationPlaceholderCount={1}
				citationPlaceholders={[
					{ text: "[CITATION NEEDED: baseline comparison]", detail: "baseline comparison", line: 42 },
				]}
				bibGenerated={false}
				bibPreview={null}
				onJumpToPlaceholder={onJumpToPlaceholder}
				onFixCitationPlaceholders={onFixCitationPlaceholders}
				verificationState={verificationStore({
					smith2024: verificationEntry("smith2024", "verified", "doi-match"),
					wang2023: verificationEntry("wang2023", "flagged", "doi-title-mismatch"),
					lee2021: verificationEntry("lee2021", "unverified", "local-metadata-only"),
					hidden2020: {
						...verificationEntry("hidden2020", "flagged", "source-not-found"),
						dismissedByUser: true,
					},
				})}
			/>,
		)

		expect(screen.getByText("Verify unverified citations")).toBeInTheDocument()
		expect(screen.getByText("Fix flagged issues with Agent")).toBeInTheDocument()
		expect(screen.getByText("Flagged citations")).toBeInTheDocument()
		expect(screen.getByText("Missing cite keys")).toBeInTheDocument()
		expect(screen.getByText("Unverified citations")).toBeInTheDocument()
		expect(screen.getByText("Citation placeholders")).toBeInTheDocument()
		expect(screen.getByText("Line 42: baseline comparison")).toBeInTheDocument()
		expect(screen.getAllByText("Fix with Agent").length).toBeGreaterThan(1)
		fireEvent.click(screen.getByText("Jump to placeholder"))
		expect(onJumpToPlaceholder).toHaveBeenCalledWith({
			text: "[CITATION NEEDED: baseline comparison]",
			detail: "baseline comparison",
			line: 42,
		})
		expect(screen.queryByText("hidden2020")).not.toBeInTheDocument()
	})

	it("reveals library tools after expanding the library section", () => {
		render(
			<ReferencePanel
				referenceEntries={baseReferenceEntries}
				uncatalogued={["paper.pdf"]}
				cited={["smith2024"]}
				missing={[]}
				citationPlaceholderCount={0}
				bibGenerated={false}
				bibPreview={null}
				embedded={true}
				verificationState={verificationStore({
					smith2024: verificationEntry("smith2024", "verified", "doi-match"),
				})}
			/>,
		)

		expect(screen.queryByPlaceholderText("Search citeKey or title")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: /library/i }))

		expect(screen.getByPlaceholderText("Search citeKey or title")).toBeInTheDocument()
		expect(screen.getByText("Generate .bib")).toBeInTheDocument()
		expect(screen.getByText("Import BibTeX")).toBeInTheDocument()
		expect(screen.getByText("Scan PDFs")).toBeInTheDocument()
	})

	it("lets dashboard tiles navigate to their issue section", () => {
		render(
			<ReferencePanel
				referenceEntries={baseReferenceEntries}
				uncatalogued={[]}
				cited={["smith2024", "wang2023"]}
				missing={["ghost2025"]}
				citationPlaceholderCount={0}
				bibGenerated={false}
				bibPreview={null}
				verificationState={verificationStore({
					smith2024: verificationEntry("smith2024", "verified", "doi-match"),
					wang2023: verificationEntry("wang2023", "unverified", "local-metadata-only"),
				})}
			/>,
		)

		const needsAttention = screen.getByText("Needs Attention").parentElement
		expect(needsAttention).toBeTruthy()
		const unverifiedCard = within(needsAttention as HTMLElement)
			.getByText("Unverified")
			.closest("button")
		expect(unverifiedCard).toBeTruthy()

		fireEvent.click(unverifiedCard as HTMLElement)

		expect(screen.getByText("Unverified citations")).toBeInTheDocument()
		expect(screen.getByText("wang2023")).toBeInTheDocument()
	})
})

function referenceEntry(citeKey: string, title: string) {
	return {
		citeKey,
		title,
		authors: [{ firstName: "Jane", lastName: "Doe" }],
		year: 2024,
		venue: "arXiv",
		doi: "10.1000/test",
		abstract: "",
		keywords: [],
		hasPdf: false,
		verified: false,
		tags: [],
		dateAdded: new Date().toISOString(),
	}
}

function verificationEntry(
	citeKey: string,
	status: VerificationEntry["status"],
	reason: VerificationEntry["reason"],
): VerificationEntry {
	const method: VerificationEntry["method"] = status === "verified" ? "doi-direct" : "local-only"
	return {
		citeKey,
		status,
		reason,
		confidence: status === "verified" ? 1 : 0.5,
		verifiedAt: new Date().toISOString(),
		method,
		sourceSnapshot: {},
		matches: [],
		stale: false,
	}
}

function verificationStore(entries: Record<string, VerificationEntry>): VerificationStore {
	return {
		version: 1,
		lastFullScan: null,
		manuscriptPath: null,
		manuscriptHash: null,
		entries,
	}
}
