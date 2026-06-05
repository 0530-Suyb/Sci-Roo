import nock from "nock"
import { afterEach, describe, expect, it } from "vitest"

import { searchLiterature } from "../SearchLiteratureTool"

describe("searchLiterature arXiv fallback", () => {
	afterEach(() => {
		nock.cleanAll()
	})

	it("falls back to OpenAlex when the arXiv API is rate-limited", async () => {
		nock("https://export.arxiv.org").get("/api/query").query(true).reply(429, "Rate exceeded.")

		nock("https://api.openalex.org")
			.get("/works")
			.query(true)
			.reply(200, {
				results: [
					{
						id: "https://openalex.org/W123",
						display_name: "Transformer Test Paper",
						publication_year: 2024,
						authorships: [{ author: { display_name: "Ada Lovelace" } }],
						primary_location: {
							landing_page_url: "https://arxiv.org/abs/2401.12345",
							source: { display_name: "arXiv" },
						},
						best_oa_location: {
							landing_page_url: "https://arxiv.org/abs/2401.12345",
						},
					},
				],
			})

		const result = await searchLiterature({
			query: "transformer",
			sources: ["arxiv"],
			maxResults: 5,
		})

		expect(result.candidates).toHaveLength(1)
		expect(result.candidates[0].source).toBe("arxiv")
		expect(result.candidates[0].arxiv_id).toBe("2401.12345")
		expect(result.search_provenance.runs[0].status).toBe("partial")
		expect(result.search_provenance.runs[0].error).toContain("OpenAlex fallback")
	})
})
