import { describe, expect, it } from "vitest"

import { countCitationPlaceholders } from "../paperWorkspaceState"

describe("countCitationPlaceholders", () => {
	it("counts both bare and descriptive citation-needed placeholders", () => {
		const text = [
			"Known gap [CITATION NEEDED].",
			"Another gap [CITATION NEEDED: transformer evaluation benchmark].",
			"DOI variant [CITATION NEEDED: retrieval baseline | doi:10.1000/xyz].",
		].join("\n")

		expect(countCitationPlaceholders(text)).toBe(3)
	})
})
