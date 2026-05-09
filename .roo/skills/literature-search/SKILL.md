---
name: literature-search
description: Systematic literature search across academic databases (PubMed, arXiv, Semantic Scholar, Google Scholar). Use when the user needs to find papers, survey a research topic, or gather evidence on a specific question.
modeSlugs: [sci-lit-review]
---

# Literature Search Skill

## When to Use

- Searching for papers on a research topic
- Conducting a systematic or scoping literature review
- Finding the most cited or most recent work on a question
- Gathering background for a grant proposal or manuscript introduction
- Checking whether a specific finding has been replicated

## When NOT to Use

- When looking for a specific paper you already have the title/DOI for (just use the read tool with MCP)
- For general web searches not related to academic literature
- For reading or analyzing papers you've already found

## Workflow

### Step 1: Clarify the Research Question

Before searching, establish:

- What is the specific research question? (PICO framework for clinical: Population, Intervention, Comparison, Outcome)
- What study types are relevant? (RCT, observational, qualitative, reviews, meta-analyses)
- What is the time frame? (last 5 years? all-time?)
- What languages? (English only? all languages?)

### Step 2: Build the Search Strategy

Construct search strings using Boolean operators:

```
(term1 OR synonym1 OR synonym2) AND (term2 OR synonym3) AND (term3)
```

Use field tags when available:

- PubMed: `[Title/Abstract]`, `[MeSH]`, `[All Fields]`
- For clinical queries, use PubMed Clinical Queries filters

### Step 3: Execute Search

Search across multiple databases (via available MCP tools):

1. **PubMed** — biomedical and life sciences
2. **arXiv** — physics, math, CS, quantitative biology, statistics
3. **Semantic Scholar** — broad coverage with citation graph
4. **Google Scholar** — broadest coverage, less structured

### Step 4: Screen and Organize

- Deduplicate results (by DOI or title fuzzy match)
- First pass: screen titles and abstracts against inclusion criteria
- Second pass: full-text review of remaining papers
- Track reasons for exclusion at full-text stage
- Organize included papers by theme or finding

### Step 5: Extract Data

For each included paper, extract:

- Bibliographic info (full citation with DOI)
- Research question / objective
- Study design and sample size
- Key findings (with effect sizes if quantitative)
- Limitations noted by authors
- Relevance to the current research question

### Step 6: Synthesize and Report

- Summarize the state of the literature thematically
- Identify areas of consensus and disagreement
- Highlight specific research gaps
- If systematic review: generate a PRISMA flow diagram
- Export results in structured format (BibTeX + summary table)

## Output Format

Always provide:

1. **Search record**: databases searched, search strings used, date of search, filters applied
2. **Flow diagram** (if systematic review): PRISMA-style, showing numbers at each stage
3. **Summary table**: paper, design, N, key findings, relevance
4. **BibTeX file** (`.bib`): all included papers with DOIs
5. **Narrative synthesis**: thematic summary of findings and gaps

## Important

- Never fabricate references — if a paper cannot be verified via DOI lookup, flag it
- Distinguish between peer-reviewed and preprint sources
- The search should be reproducible — another researcher following your search record should get the same results
