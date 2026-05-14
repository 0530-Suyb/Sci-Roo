import type { RetrievalTask } from "@roo-code/types"

const outputShape = {
	retrieval_no: "retrieval_0001",
	query: "final normalized query string used for retrieval",
	search_keywords: ["keyword 1", "keyword 2"],
	search_provenance: {
		summary: "short summary of what was searched and what happened",
		runs: [
			{
				source: "pubmed",
				query: "actual query sent to PubMed",
				requested_max_results: 100,
				returned_count: 0,
				status: "success",
				error: null,
			},
			{
				source: "arxiv",
				query: "actual query sent to arXiv",
				requested_max_results: 100,
				returned_count: 0,
				status: "success",
				error: null,
			},
		],
	},
	result_summary: {
		total_found: 0,
		total_saved: 0,
		by_source: { pubmed: 0, arxiv: 0 },
		duplicates_removed: 0,
		errors: [],
	},
	candidates: [
		{
			source: "pubmed",
			source_rank: 1,
			title: "paper title",
			authors: ["Author A", "Author B"],
			year: 2026,
			venue: "journal or preprint server",
			doi: "10.xxxx/yyyy",
			pmid: "12345678",
			arxiv_id: "",
			url: "https://...",
			abstract: "abstract text",
			keywords: ["keyword"],
			relevance_score: 0.8,
			relevance_reason: "why this candidate matches the request",
			notes: "",
			decision_reason: "",
			metadata_warnings: [],
		},
	],
}

function isUnspecifiedQuery(query: string): boolean {
	const normalized = query.trim().toLowerCase()
	return ["", "不知道", "不清楚", "未知", "unknown", "not sure", "n/a", "na", "none"].includes(normalized)
}

function formatCriteria(label: string, values: string[]): string {
	if (values.length === 0) {
		return `${label}: none provided`
	}
	return `${label}:\n${values.map((value) => `- ${value}`).join("\n")}`
}

export function buildRetrievalAgentPrompt(retrieval: RetrievalTask): string {
	const requestedMax = Math.min(retrieval.max_results || 20, 200)
	const sources = retrieval.search_sources.length > 0 ? retrieval.search_sources : ["pubmed", "arxiv"]
	const initialQuery = isUnspecifiedQuery(retrieval.query)
		? "(not provided; derive PubMed/arXiv queries from the user retrieval request)"
		: retrieval.query

	return `ReadPaper Retrieval Task: ${retrieval.retrieval_no}

You are executing a Sci-Roo ReadPaper literature retrieval task as an internal, non-interactive worker.

User retrieval request:
${retrieval.Q || "(not provided)"}

Working title:
${retrieval.title}

Initial query:
${initialQuery}

Search keywords:
${retrieval.search_keywords.length > 0 ? retrieval.search_keywords.join(", ") : "(not provided)"}

Allowed sources:
${sources.join(", ")}

Limits:
- Save at most ${requestedMax} candidate papers in total.
- Use only PubMed and arXiv.
- Do not use Google Scholar, Semantic Scholar, Crossref, generic web search, or PDF extraction.
- Do not import papers into a library.
- Do not download PDFs.
- Do not perform synthesis, screening, or final inclusion decisions.
- Do not discard candidates as "off-topic" or "not relevant" in v1. Save returned PubMed/arXiv records as candidates up to the cap, and record low relevance in relevance_score, relevance_reason, notes, or metadata_warnings.

Date constraints:
- year_from: ${retrieval.year_from ?? "not specified"}
- year_to: ${retrieval.year_to ?? "not specified"}

${formatCriteria("Inclusion criteria to record only, not auto-screen", retrieval.inclusion_criteria)}

${formatCriteria("Exclusion criteria to record only, not auto-screen", retrieval.exclusion_criteria)}

Execution requirements:
- Do not ask the user clarifying questions.
- Do not call ask_followup_question.
- Do not call update_todo_list.
- Do not wait for a manual "continue" action.
- If the user request is ambiguous, choose the most likely scholarly interpretation, record that assumption in search_provenance.summary, and continue.
- Use search_literature through the existing agent workflow to query PubMed and arXiv.
- Do not read local files, README files, MCP server directories, or workspace source code.
- Treat the search_literature tool result as the source search output. It returns JSON with search_provenance, result_summary, and candidates, and the extension saves that tool result directly.
- After a successful search_literature call, do not restate the full candidate array in attempt_completion. Return a compact valid JSON object with the same query/search_keywords/search_provenance/result_summary and an empty candidates array. The extension will use the saved tool result as the canonical candidate list.
- When calling a tool, each tool argument must be exactly one valid JSON object. Never concatenate two JSON objects in the same arguments string.
- If using search_literature, call it with one JSON object only: {"query":"...","sources":["pubmed","arxiv"],"maxResults":N,"yearFrom":YYYY,"yearTo":YYYY}. Do not emit separate PubMed and arXiv objects in one call.
- Record the actual PubMed/arXiv query strings you used in search_provenance.runs.
- If a source fails, save successful source results and include the failure in result_summary.errors and the run error field.
- Return an empty candidates array only when the allowed sources return no records or all source requests fail. Include an error such as "no_results_found" only in that case.
- Never fabricate papers, identifiers, abstracts, URLs, or metadata.
- If metadata is missing or uncertain, leave the field empty/null and add a metadata_warnings entry.
- If a record appears unrelated, keep it as a candidate and mark metadata_warnings with "possibly_off_topic".

Return requirements:
- Finish with attempt_completion and put strict JSON only in the result.
- Do not wrap the JSON in Markdown fences.
- Do not include comments or explanatory prose outside the JSON.
- The extension will ignore any retrieval_no and candidate_no values you provide and will assign ids itself.
- Candidate source must be exactly "pubmed" or "arxiv".
- Candidate relevance_score must be a number between 0 and 1 or null.

Output JSON shape:
${JSON.stringify(outputShape, null, 2)}
`
}
