---
name: citation-management
description: Manage academic citations: import from databases, deduplicate, format for target journals, export BibTeX/RIS/CSL-JSON, and integrate with reference managers (Zotero, Mendeley). Use when handling reference lists, formatting bibliographies, or organizing a literature library.
modeSlugs: [sci-lit-review, sci-paper-writing]
---

# Citation Management Skill

## When to Use

- Formatting a reference list for a specific journal style
- Converting citations between formats (BibTeX ↔ RIS ↔ CSL-JSON)
- Deduplicating a set of references
- Verifying references against DOIs
- Generating a `.bib` file for a manuscript
- Inserting citations into a LaTeX or Word document

## When NOT to Use

- Searching for new literature (use the literature-search skill)
- Reading or analyzing paper content
- Managing PDF files

## Supported Formats

| Format    | Extension | Typical Use                 |
| --------- | --------- | --------------------------- |
| BibTeX    | `.bib`    | LaTeX documents             |
| BibLaTeX  | `.bib`    | Modern LaTeX                |
| RIS       | `.ris`    | Zotero, Mendeley, EndNote   |
| CSL-JSON  | `.json`   | Pandoc, citation processors |
| APA       | text      | In-text formatting          |
| Vancouver | text      | Numbered references         |

## Workflow

### Step 1: Gather Citations

Citations can come from:

- Literature search results (see literature-search skill)
- The user's existing `.bib` or `.ris` file
- DOI lookup: resolve a DOI to get full metadata via Crossref API
- Zotero/Mendeley export (via MCP if available)

### Step 2: Validate and Enrich

For each citation:

- Verify the DOI resolves to a real paper (Crossref API)
- Check for missing fields: author, title, journal, year, volume, pages, DOI
- Fill in missing fields by DOI lookup when possible
- Flag citations that cannot be verified

### Step 3: Deduplicate

Check for duplicates by:

1. DOI match (exact match)
2. Title similarity (fuzzy match, >90% similarity after normalization)
3. Author + year + journal overlap

When duplicates are found:

- Keep the most complete entry
- Merge non-conflicting fields from both entries
- Report what was merged

### Step 4: Format for Target

Determine the target format:

- **Journal submission**: use the journal's specific CSL style
- **LaTeX manuscript**: export as BibTeX/BibLaTeX with the correct citation style package
- **Grant proposal**: usually NIH or NSF style
- **Thesis**: university-specific format

Use CSL (Citation Style Language) for most formatting needs. Common CSL styles:

- `apa.csl` — APA 7th edition
- `vancouver.csl` — numbered references
- `nature.csl` — Nature journals
- `cell.csl` — Cell Press journals
- `plos.csl` — PLOS journals

### Step 5: Validate Final Output

Before finishing:

- Verify that every in-text citation has a reference list entry, and vice versa
- Check for consistent formatting (all DOIs present? all years? no missing pages?)
- If using BibTeX: ensure special characters are properly escaped
- If the user has a Zotero library: offer to export to their library

## Output Format

1. Formatted reference list (in the target style)
2. BibTeX file (`.bib`) as the canonical format
3. Citation validation report: total count, verified count, flagged count
4. Optional: RIS export for import into reference managers

## Tips

- Always include DOIs — they are the best unique identifier
- For LaTeX users: recommend `biblatex` over `natbib` for better Unicode and formatting support
- When in doubt about a reference, verify against Crossref — never guess fields
