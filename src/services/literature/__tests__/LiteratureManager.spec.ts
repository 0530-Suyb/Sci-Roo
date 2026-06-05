import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RetrievalCandidate } from "@roo-code/types"

vi.mock("vscode", () => ({}))

import { LiteratureManager } from "../LiteratureManager"

const candidate = (overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate =>
	({
		candidate_no: "candidate_0001",
		state: "候选",
		source: "openalex",
		source_id: "W1",
		title: "Test Paper",
		authors: ["Ada Lovelace"],
		year: 2025,
		venue: "Journal of Tests",
		doi: "",
		pmid: "",
		arxiv_id: "",
		url: "https://example.org/paper",
		abstract: "Abstract",
		keywords: ["test"],
		metadata_warnings: [],
		...overrides,
	}) as RetrievalCandidate

describe("LiteratureManager read paper matching", () => {
	let tempDir: string
	let manager: LiteratureManager

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sci-roo-literature-"))
		manager = new LiteratureManager({ cwd: tempDir } as any)
		await manager.initialize()
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("does not mark sibling candidates from the same retrieval as imported", async () => {
		const importedCandidate = candidate({
			candidate_no: "candidate_0001",
			source_id: "W-imported",
			title: "Imported Paper",
		})
		const siblingCandidate = candidate({
			candidate_no: "candidate_0002",
			source_id: "W-sibling",
			title: "Sibling Paper",
		})

		await manager.upsertReadPaperCandidate(importedCandidate, { retrievalNo: "RET-001" })

		expect(manager.findReadPaperCandidateEntry(importedCandidate, { retrievalNo: "RET-001" })).toBeTruthy()
		expect(manager.findReadPaperCandidateEntry(siblingCandidate, { retrievalNo: "RET-001" })).toBeUndefined()
	})

	it("deletes only the matching imported candidate entry", async () => {
		const firstCandidate = candidate({
			candidate_no: "candidate_0001",
			source_id: "W-first",
			title: "First Paper",
		})
		const secondCandidate = candidate({
			candidate_no: "candidate_0002",
			source_id: "W-second",
			title: "Second Paper",
		})

		await manager.upsertReadPaperCandidate(firstCandidate, { retrievalNo: "RET-001" })
		await manager.upsertReadPaperCandidate(secondCandidate, { retrievalNo: "RET-001" })

		const result = await manager.deleteEntriesMatchingReadPaperCandidates([firstCandidate], {
			retrievalNo: "RET-001",
		})

		expect(result.deleted).toBe(1)
		expect(manager.findReadPaperCandidateEntry(firstCandidate, { retrievalNo: "RET-001" })).toBeUndefined()
		expect(manager.findReadPaperCandidateEntry(secondCandidate, { retrievalNo: "RET-001" })).toBeTruthy()
	})
})
