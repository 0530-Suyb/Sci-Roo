import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ReferenceEntry } from "@roo-code/types"

import { CitationVerifier, extractCiteKeys } from "../CitationVerifier"

describe("CitationVerifier", () => {
	let tempDir: string
	let texFilePath: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sci-roo-citation-"))
		await fs.mkdir(path.join(tempDir, ".roo"), { recursive: true })
		await fs.mkdir(path.join(tempDir, "latex"), { recursive: true })
		texFilePath = path.join(tempDir, "latex", "main.tex")
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("extracts unique cite keys from latex content", () => {
		expect(extractCiteKeys("Text \\cite{smith2024,doe2023} and \\citep{smith2024}")).toEqual([
			"smith2024",
			"doe2023",
		])
	})

	it("marks cite keys missing from the local library as missing", async () => {
		await fs.writeFile(texFilePath, "See \\cite{ghost2025}.", "utf-8")
		const verifier = new CitationVerifier(tempDir, vi.fn() as any)

		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [],
		})

		expect(result.entries.ghost2025.status).toBe("missing")
		expect(result.entries.ghost2025.reason).toBe("missing-local-entry")
	})

	it("verifies a DOI-backed citation when Crossref title matches", async () => {
		await fs.writeFile(texFilePath, "See \\cite{smith2024}.", "utf-8")
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						message: {
							title: ["Transformer Models in Scientific Writing"],
							author: [{ given: "Jane", family: "Smith" }],
							issued: { "date-parts": [[2024]] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({
					citeKey: "smith2024",
					doi: "10.1000/xyz",
					title: "Transformer Models in Scientific Writing",
				}),
			],
		})

		expect(result.entries.smith2024.status).toBe("verified")
		expect(result.entries.smith2024.reason).toBe("doi-match")
	})

	it("marks a DOI citation as flagged when Crossref title conflicts strongly", async () => {
		await fs.writeFile(texFilePath, "See \\cite{wang2023}.", "utf-8")
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						message: {
							title: ["Climate Data Analysis"],
							author: [{ given: "Ana", family: "Wang" }],
							issued: { "date-parts": [[2023]] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({ citeKey: "wang2023", doi: "10.2000/abc", title: "Completely Different Topic" }),
			],
		})

		expect(result.entries.wang2023.status).toBe("flagged")
		expect(result.entries.wang2023.reason).toBe("doi-title-mismatch")
	})

	it("marks a DOI citation as flagged when Crossref is only a medium-confidence title match", async () => {
		await fs.writeFile(texFilePath, "See \\cite{wang2023}.", "utf-8")
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						message: {
							title: ["Climate Data Analysis"],
							author: [{ given: "Ana", family: "Wang" }],
							issued: { "date-parts": [[2023]] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({ citeKey: "wang2023", doi: "10.2000/abc", title: "Climate Change Analysis" }),
			],
		})

		expect(result.entries.wang2023.status).toBe("flagged")
		expect(result.entries.wang2023.reason).toBe("doi-title-mismatch")
	})

	it("marks a DOI citation as flagged when Crossref returns 404", async () => {
		await fs.writeFile(texFilePath, "See \\cite{ghost2025}.", "utf-8")
		const fetchMock = vi.fn(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({ citeKey: "ghost2025", doi: "10.9999/missing", title: "Missing Paper" }),
			],
		})

		expect(result.entries.ghost2025.status).toBe("flagged")
		expect(result.entries.ghost2025.reason).toBe("source-not-found")
	})

	it("marks network failures as unverified instead of flagged", async () => {
		await fs.writeFile(texFilePath, "See \\cite{lee2021}.", "utf-8")
		const fetchMock = vi.fn(async () => {
			throw new Error("network down")
		}) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({
					citeKey: "lee2021",
					doi: "10.3000/err",
					title: "Graph Neural Networks for Molecules",
				}),
			],
		})

		expect(result.entries.lee2021.status).toBe("unverified")
		expect(result.entries.lee2021.reason).toBe("network-error")
	})

	it("retries 429 responses and eventually verifies when Crossref recovers", async () => {
		await fs.writeFile(texFilePath, "See \\cite{smith2024}.", "utf-8")
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
			.mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						message: {
							title: ["Transformer Models in Scientific Writing"],
							author: [{ given: "Jane", family: "Smith" }],
							issued: { "date-parts": [[2024]] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({
					citeKey: "smith2024",
					doi: "10.1000/xyz",
					title: "Transformer Models in Scientific Writing",
				}),
			],
		})

		expect(fetchMock).toHaveBeenCalledTimes(3)
		expect(result.entries.smith2024.status).toBe("verified")
	})

	it("falls back to fuzzy search when the local DOI is invalid", async () => {
		await fs.writeFile(texFilePath, "See \\cite{lee2021}.", "utf-8")
		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes("crossref")) {
				return new Response(
					JSON.stringify({
						message: {
							items: [{ title: ["Graph Neural Networks for Molecules"], DOI: "10.1234/ok" }],
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				)
			}
			return new Response(
				JSON.stringify({
					results: [
						{ display_name: "Graph Neural Networks for Molecules", doi: "https://doi.org/10.1234/ok" },
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)
		}) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({ citeKey: "lee2021", doi: "not-a-doi", title: "Graph Neural Networks for Molecules" }),
			],
		})

		expect(result.entries.lee2021.method).toBe("title-author-fuzzy")
		expect(result.entries.lee2021.status).toBe("verified")
	})

	it("reuses fuzzy matching when DOI is absent", async () => {
		await fs.writeFile(texFilePath, "See \\cite{lee2021}.", "utf-8")
		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes("crossref")) {
				return new Response(
					JSON.stringify({
						message: {
							items: [{ title: ["Graph Neural Networks for Molecules"], DOI: "10.1234/ok" }],
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				)
			}
			return new Response(
				JSON.stringify({
					results: [
						{ display_name: "Graph Neural Networks for Molecules", doi: "https://doi.org/10.1234/ok" },
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)
		}) as unknown as typeof fetch

		const verifier = new CitationVerifier(tempDir, fetchMock)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({ citeKey: "lee2021", doi: undefined, title: "Graph Neural Networks for Molecules" }),
			],
		})

		expect(result.entries.lee2021.status).toBe("verified")
		expect(result.entries.lee2021.reason).toBe("fuzzy-match")
	})

	it("marks verification as unverified when neither DOI nor title is available", async () => {
		await fs.writeFile(texFilePath, "See \\cite{empty2024}.", "utf-8")
		const verifier = new CitationVerifier(tempDir, vi.fn() as any)
		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [referenceEntry({ citeKey: "empty2024", doi: undefined, title: "" })],
		})

		expect(result.entries.empty2024.status).toBe("unverified")
		expect(result.entries.empty2024.reason).toBe("insufficient-metadata")
	})

	it("can dismiss an existing citation issue in the persisted store", async () => {
		await fs.writeFile(texFilePath, "See \\cite{ghost2025}.", "utf-8")
		const verifier = new CitationVerifier(tempDir, vi.fn() as any)

		await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [],
		})
		const updatedStore = await verifier.dismissIssue("ghost2025", "Checked manually")

		expect(updatedStore.entries.ghost2025.dismissedByUser).toBe(true)
		expect(updatedStore.entries.ghost2025.dismissedReason).toBe("Checked manually")
		expect(updatedStore.entries.ghost2025.reason).toBe("manual-dismissed")
	})

	it("marks persisted verification results as stale when the manuscript changes before re-run", async () => {
		await fs.writeFile(texFilePath, "See \\cite{smith2024}.", "utf-8")
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						message: {
							title: ["Transformer Models in Scientific Writing"],
							author: [{ given: "Jane", family: "Smith" }],
							issued: { "date-parts": [[2024]] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		) as unknown as typeof fetch
		const verifier = new CitationVerifier(tempDir, fetchMock)

		await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({
					citeKey: "smith2024",
					doi: "10.1000/xyz",
					title: "Transformer Models in Scientific Writing",
				}),
			],
		})
		await fs.writeFile(texFilePath, "Updated text and still \\cite{smith2024}.", "utf-8")

		const staleStore = await verifier.loadStoreForManuscript(texFilePath)

		expect(staleStore.entries.smith2024.stale).toBe(true)
		expect(staleStore.manuscriptHash).toBeTruthy()
	})

	it("verifies a repeated cite key only once in a full manuscript scan", async () => {
		await fs.writeFile(texFilePath, "See \\cite{smith2024}. Again \\citep{smith2024}.", "utf-8")
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						message: {
							title: ["Transformer Models in Scientific Writing"],
							author: [{ given: "Jane", family: "Smith" }],
							issued: { "date-parts": [[2024]] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		) as unknown as typeof fetch
		const verifier = new CitationVerifier(tempDir, fetchMock)

		const result = await verifier.verifyAllCitations({
			texFilePath,
			referenceEntries: [
				referenceEntry({
					citeKey: "smith2024",
					doi: "10.1000/xyz",
					title: "Transformer Models in Scientific Writing",
				}),
			],
		})

		expect(Object.keys(result.entries)).toEqual(["smith2024"])
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it("rebuilds an empty store when the persisted verification file is corrupted", async () => {
		const verifier = new CitationVerifier(tempDir, vi.fn() as any)
		await fs.writeFile(verifier.storePath, "{not-valid-json", "utf-8")

		const store = await verifier.loadStore()

		expect(store.entries).toEqual({})
		expect(store.lastFullScan).toBeNull()
	})

	it("builds section cite maps and line locations from the manuscript", async () => {
		await fs.writeFile(
			texFilePath,
			["\\section{Introduction}", "See \\cite{smith2024}.", "\\section{Methods}", "Also \\citep{lee2021}."].join(
				"\n",
			),
			"utf-8",
		)
		const verifier = new CitationVerifier(tempDir, vi.fn() as any)

		const sectionMap = await verifier.getSectionCiteMap(texFilePath)
		const smithLines = await verifier.getCiteLineLocations(texFilePath, "smith2024")

		expect(sectionMap.smith2024).toEqual(["Introduction"])
		expect(sectionMap.lee2021).toEqual(["Methods"])
		expect(smithLines).toEqual([2])
	})

	it("tracks citations that appear in document tail regions like references and appendix", async () => {
		await fs.writeFile(
			texFilePath,
			[
				"\\section{Results}",
				"Main text \\cite{smith2024}.",
				"\\bibliography{references}",
				"% Manual note after bibliography command \\cite{tail2024}.",
				"\\appendix",
				"Appendix discussion \\cite{appendix2024}.",
			].join("\n"),
			"utf-8",
		)
		const verifier = new CitationVerifier(tempDir, vi.fn() as any)

		const sectionMap = await verifier.getSectionCiteMap(texFilePath)

		expect(sectionMap.smith2024).toEqual(["Results"])
		expect(sectionMap.tail2024).toEqual(["References"])
		expect(sectionMap.appendix2024).toEqual(["Appendix"])
	})
})

function referenceEntry(overrides: Partial<ReferenceEntry>): ReferenceEntry {
	return {
		citeKey: "default2024",
		title: "Default Title",
		authors: [{ firstName: "Jane", lastName: "Doe" }],
		year: 2024,
		venue: "arXiv",
		doi: "10.1000/default",
		abstract: "",
		keywords: [],
		hasPdf: false,
		verified: false,
		tags: [],
		dateAdded: new Date().toISOString(),
		...overrides,
	}
}
