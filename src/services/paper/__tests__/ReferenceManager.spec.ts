import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { RetrievalCandidate } from "@roo-code/types"
import { buildArxivPdfUrl, extractArxivIdFromCandidate, ReferenceManager } from "../ReferenceManager"

describe("ReferenceManager ReadPaper arXiv import", () => {
	let tempDir: string
	let manager: ReferenceManager

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sci-roo-reference-"))
		manager = new ReferenceManager({
			cwd: tempDir,
			getPaperProjectManager: () => undefined,
		} as any)
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("extracts arXiv IDs from candidate metadata", () => {
		expect(extractArxivIdFromCandidate(candidate({ arxiv_id: "2401.01234v2" }))).toBe("2401.01234v2")
		expect(extractArxivIdFromCandidate(candidate({ arxiv_id: "", source_id: "2401.01234" }))).toBe("2401.01234")
		expect(extractArxivIdFromCandidate(candidate({ arxiv_id: "", source_id: "hep-th/9901001" }))).toBe(
			"hep-th/9901001",
		)
		expect(
			extractArxivIdFromCandidate(
				candidate({
					source: "semantic-scholar",
					arxiv_id: "",
					source_id: "",
					url: "https://arxiv.org/pdf/2401.05678.pdf",
				}),
			),
		).toBe("2401.05678")
		expect(
			extractArxivIdFromCandidate(
				candidate({
					source: "crossref",
					arxiv_id: "",
					source_id: "",
					url: "",
					doi: "10.1109/eit63098.2024.10762562",
				}),
			),
		).toBeUndefined()
		expect(
			extractArxivIdFromCandidate(
				candidate({
					source: "semantic-scholar",
					arxiv_id: "",
					source_id: "2401.01234",
					url: "",
					doi: "",
				}),
			),
		).toBeUndefined()
		expect(
			extractArxivIdFromCandidate(
				candidate({
					source: "crossref",
					arxiv_id: "",
					source_id: "",
					url: "",
					doi: "10.48550/arXiv.2401.01234",
				}),
			),
		).toBe("2401.01234")
	})

	it("builds arXiv PDF URLs", () => {
		expect(buildArxivPdfUrl("2401.01234v2")).toBe("https://arxiv.org/pdf/2401.01234v2")
		expect(buildArxivPdfUrl("hep-th/9901001")).toBe("https://arxiv.org/pdf/hep-th/9901001")
	})

	it("reuses an existing reference entry for duplicate candidates", async () => {
		const first = await manager.importReadPaperCandidate(candidate(), { cwd: tempDir })
		const second = await manager.importReadPaperCandidate(candidate({ title: "A slightly newer title" }), {
			cwd: tempDir,
		})
		const files = await fs.readdir(path.join(tempDir, "reference"))

		expect(first.created).toBe(true)
		expect(second.created).toBe(false)
		expect(second.entry.citeKey).toBe(first.entry.citeKey)
		expect(files.filter((file) => file.endsWith(".md"))).toHaveLength(1)
	})

	it("skips PDF download when the reference PDF already exists", async () => {
		const imported = await manager.importReadPaperCandidate(candidate(), { cwd: tempDir })
		const pdfPath = path.join(tempDir, "reference", `${imported.entry.citeKey}.pdf`)
		await fs.writeFile(pdfPath, Buffer.from("%PDF-1.7\nexisting"))
		const fetchImpl = vi.fn() as unknown as typeof fetch

		const result = await manager.importReadPaperCandidate(candidate(), {
			cwd: tempDir,
			downloadPdf: true,
			fetchImpl,
		})

		expect(result.pdf.status).toBe("existing")
		expect(fetchImpl).not.toHaveBeenCalled()
	})

	it("reports reference status for imported candidates without PDFs", async () => {
		const imported = await manager.importReadPaperCandidate(candidate(), { cwd: tempDir })
		const status = await manager.getReadPaperCandidateReferenceStatus(candidate(), { cwd: tempDir })

		expect(status.hasEntry).toBe(true)
		expect(status.hasPdf).toBe(false)
		expect(status.citeKey).toBe(imported.entry.citeKey)
	})

	it("downloads arXiv PDFs to reference", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response("%PDF-1.7\nmock pdf", {
					headers: { "content-type": "application/pdf" },
					status: 200,
				}),
		) as unknown as typeof fetch

		const result = await manager.importReadPaperCandidate(candidate(), {
			cwd: tempDir,
			downloadPdf: true,
			fetchImpl,
		})
		const pdfPath = path.join(tempDir, "reference", `${result.entry.citeKey}.pdf`)
		const pdfBytes = await fs.readFile(pdfPath)

		expect(result.pdf.status).toBe("downloaded")
		expect(result.entry.hasPdf).toBe(true)
		expect(pdfBytes.subarray(0, 4).toString("utf-8")).toBe("%PDF")
	})

	it("rejects non-PDF arXiv responses", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response("<html>not a pdf</html>", {
					headers: { "content-type": "text/html" },
					status: 200,
				}),
		) as unknown as typeof fetch

		await expect(
			manager.importReadPaperCandidate(candidate(), {
				cwd: tempDir,
				downloadPdf: true,
				fetchImpl,
			}),
		).rejects.toThrow(/not a PDF/)

		const files = await fs.readdir(path.join(tempDir, "reference"))
		expect(files.filter((file) => file.endsWith(".md"))).toHaveLength(0)
		expect(files.filter((file) => file.endsWith(".pdf"))).toHaveLength(0)
	})
})

function candidate(overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
	return {
		candidate_no: "candidate_0001",
		state: "候选",
		source: "arxiv",
		source_id: "2401.01234",
		source_rank: 1,
		title: "Characteristic Mode Theory for Research Agents",
		authors: ["Doe, Jane", "Smith, John"],
		year: 2024,
		venue: "arXiv",
		doi: "",
		pmid: "",
		arxiv_id: "2401.01234",
		url: "https://arxiv.org/abs/2401.01234",
		abstract: "A concise abstract.",
		keywords: ["retrieval", "agents"],
		relevance_score: 0.9,
		relevance_reason: "Matches the query.",
		existence_confidence: 1,
		relevance_confidence: 0.9,
		verified_sources: ["arxiv"],
		discovery_sources: ["arxiv"],
		match_evidence: ["arXiv 2401.01234"],
		notes: "",
		decision_reason: "",
		metadata_warnings: [],
		...overrides,
	}
}
