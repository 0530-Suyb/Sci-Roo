---
name: ml-paper-writing
description: Write publication-ready ML/AI papers for NeurIPS, ICML, ICLR, ACL, AAAI, COLM. Use when drafting papers from research repos, structuring arguments, verifying citations, or preparing camera-ready submissions.
modeSlugs: [sci-paper-writing]
---

# ML Paper Writing for Top AI Conferences

Expert-level guidance for writing publication-ready papers targeting **NeurIPS, ICML, ICLR, ACL, AAAI, COLM**. This skill combines writing philosophy from top researchers (Nanda, Farquhar, Karpathy, Lipton, Steinhardt) with practical tools: LaTeX templates, citation verification, and conference checklists.

## Core Philosophy: Collaborative Writing

Paper writing is collaborative, but you should be proactive in delivering drafts:

1. **Understand the project** by exploring the repo, results, and existing documentation
2. **Deliver a complete first draft** when confident about the contribution
3. **Search literature** using web search and APIs to find relevant citations
4. **Refine through feedback cycles** when the scientist provides input
5. **Ask for clarification** only when genuinely uncertain about key decisions

**Key Principle**: Be proactive. If the repo and results are clear, deliver a full draft. Don't block waiting for feedback on every section. Produce something concrete they can react to, then iterate.

### Balancing Proactivity and Collaboration

| Confidence Level                            | Action                                           |
| ------------------------------------------- | ------------------------------------------------ |
| **High** (clear repo, obvious contribution) | Write full draft, deliver, iterate on feedback   |
| **Medium** (some ambiguity)                 | Write draft with flagged uncertainties, continue |
| **Low** (major unknowns)                    | Ask 1-2 targeted questions, then draft           |

**Only block for input when:** target venue is unclear, multiple contradictory framings seem equally valid, or results seem incomplete. **Don't block for:** word choice, section ordering, which results to show, citation completeness.

## The Narrative Principle

**Your paper is not a collection of experiments — it's a story with one clear contribution supported by evidence.**

| Pillar          | Description                                     | Example                                                 |
| --------------- | ----------------------------------------------- | ------------------------------------------------------- |
| **The What**    | 1-3 specific novel claims within cohesive theme | "We prove that X achieves Y under condition Z"          |
| **The Why**     | Rigorous empirical evidence supporting claims   | Strong baselines, experiments distinguishing hypotheses |
| **The So What** | Why readers should care                         | Connection to recognized community problems             |

**If you cannot state your contribution in one sentence, you don't yet have a paper.**

## Complete Paper Workflow

```
Paper Writing Progress:
- [ ] Step 1: Define the one-sentence contribution (with scientist)
- [ ] Step 2: Draft Figure 1 → get feedback → revise
- [ ] Step 3: Draft abstract → get feedback → revise
- [ ] Step 4: Draft introduction → get feedback → revise
- [ ] Step 5: Draft methods → get feedback → revise
- [ ] Step 6: Draft experiments → get feedback → revise
- [ ] Step 7: Draft related work → get feedback → revise
- [ ] Step 8: Draft limitations → get feedback → revise
- [ ] Step 9: Complete paper checklist (required for NeurIPS/ICML/ICLR)
- [ ] Step 10: Final review cycle and submission
```

### Step 1: Define the One-Sentence Contribution

This step requires explicit confirmation from the scientist. Before writing: what is the single thing your paper contributes? What was not obvious or present before your work?

### Step 2: Draft Figure 1

Figure 1 deserves special attention — many readers skip directly to it.

- Convey core idea, approach, or most compelling result
- Use vector graphics (PDF/EPS)
- Write captions that stand alone without main text
- Ensure readability in black-and-white (8% of men have color vision deficiency)

### Step 3: Write Abstract (5-Sentence Formula)

1. What you achieved: "We introduce...", "We prove...", "We demonstrate..."
2. Why this is hard and important
3. How you do it (with specialist keywords for discoverability)
4. What evidence you have
5. Your most remarkable number/result

**Delete** generic openings like "Large language models have achieved remarkable success..."

### Step 4: Write Introduction (1-1.5 pages max)

Must include 2-4 bullet contribution list (max 1-2 lines each). Methods should start by page 2-3 maximum.

### Step 5: Methods Section

Enable reimplementation: conceptual outline or pseudocode, all hyperparameters listed, architectural details sufficient for reproduction. Present final design decisions; ablations go in experiments.

### Step 6: Experiments Section

For each experiment, state: what claim it supports, how it connects to the main contribution, experimental setting. Requirements: error bars with methodology, hyperparameter search ranges, compute infrastructure (GPU type, total hours).

### Step 7: Related Work

**Organize methodologically, not paper-by-paper.** Good: "One line of work uses assumption X [refs] whereas we use assumption Y because..." Bad: "Snap et al. introduced X while Crackle et al. introduced Y." Cite generously — reviewers likely authored relevant papers.

### Step 8: Limitations Section (REQUIRED)

All major ML conferences require this. Honesty helps: reviewers are instructed not to penalize honest limitation acknowledgment. Pre-empt criticisms by identifying weaknesses first. Explain why limitations don't undermine core claims.

## ⚠️ CRITICAL: Never Hallucinate Citations

**AI-generated citations have a ~40% error rate.** This is the most important rule in academic writing with AI assistance.

```
IF you cannot programmatically fetch a citation:
    → Mark it as [CITATION NEEDED] or [PLACEHOLDER - VERIFY]
    → Tell the scientist explicitly
    → NEVER invent a plausible-sounding reference
```

### Citation Verification Workflow

```
Citation Verification (MANDATORY for every citation):
- [ ] Step 1: Search using APIs (Semantic Scholar, CrossRef, arXiv)
- [ ] Step 2: Verify paper exists in 2+ sources
- [ ] Step 3: Retrieve BibTeX via DOI (programmatically, not from memory)
- [ ] Step 4: Verify the claim you're citing actually appears in the paper
- [ ] Step 5: Add verified BibTeX to references.bib
- [ ] Step 6: If ANY step fails → mark as placeholder, inform scientist
```

| Situation                            | Action                                            |
| ------------------------------------ | ------------------------------------------------- |
| Found paper, got DOI, fetched BibTeX | Use the citation                                  |
| Paper exists but can't fetch BibTeX  | Mark placeholder, inform scientist                |
| Uncertain if paper exists            | Mark `[CITATION NEEDED]`, inform scientist        |
| "I think there's a paper about X"    | **NEVER cite** - search first or mark placeholder |

## Writing Style Guidelines

### Sentence-Level Clarity

| Principle              | Rule                                         |
| ---------------------- | -------------------------------------------- |
| Subject-verb proximity | Keep subject and verb close                  |
| Stress position        | Place emphasis at sentence ends              |
| Topic position         | Put context first, new info after            |
| Old before new         | Familiar → unfamiliar info                   |
| One unit, one function | Each paragraph makes one point               |
| Action in verb         | "We analyzed" not "We performed an analysis" |

### Word Choice

- **Be specific**: "accuracy" or "latency" not "performance"
- **Eliminate hedging**: Drop "may" and "can" unless genuinely uncertain
- **Delete intensifiers**: "provides tight approximation" not "provides very tight approximation"
- **Minimize pronouns**: "This result shows..." not "This shows..."
- **Consistent terminology**: One term per concept — pick one and stick with it
- **Delete filler words**: "actually," "a bit," "very," "really," "basically," "quite," "essentially"

## Conference Requirements Quick Reference

| Conference       | Page Limit     | Extra (Camera-Ready) | Key Requirement                   |
| ---------------- | -------------- | -------------------- | --------------------------------- |
| **NeurIPS 2025** | 9 pages        | +0                   | Mandatory checklist, lay summary  |
| **ICML 2026**    | 8 pages        | +1                   | Broader Impact Statement required |
| **ICLR 2026**    | 9 pages        | +1                   | LLM disclosure required           |
| **ACL**          | 8 pages (long) | varies               | Limitations section mandatory     |
| **AAAI 2026**    | 7 pages        | +1                   | Strict style file adherence       |
| **COLM 2025**    | 9 pages        | +1                   | Focus on language models          |

**Universal Requirements:** double-blind review, references don't count toward page limit, appendices unlimited but reviewers not required to read, LaTeX required.

## Conference Resubmission & Format Conversion

### Content Migration Rules

**Never copy LaTeX preambles between templates.** Instead: start fresh with target template, copy ONLY content sections, paste into target template structure.

### Page Limit Adjustments

**Cutting pages:** move detailed proofs to appendix, condense related work (cite surveys), combine experiments into unified tables, use smaller figures with subfigures. **Expanding:** add ablation studies, expand limitations, include additional baselines.

## LaTeX Template Usage

- Copy the ENTIRE template directory, not just `main.tex`
- Verify the unmodified template compiles before making changes
- **Never modify .sty or .cls files** — breaks conference formatting
- Compile frequently to catch errors early
- Only clean up template artifacts when the paper is nearly complete

## Tables and Figures

- Use `\booktabs` for tables. Bold best values. Include direction symbols (↑/↓).
- Vector graphics (PDF/EPS) for all plots. Colorblind-safe palettes (Okabe-Ito or viridis).
- Self-contained captions — reader should understand without main text.

## Reviewer Evaluation Criteria

| Criterion        | What Reviewers Look For                    |
| ---------------- | ------------------------------------------ |
| **Quality**      | Technical soundness, well-supported claims |
| **Clarity**      | Clear writing, reproducible by experts     |
| **Significance** | Community impact, advances understanding   |
| **Originality**  | New insights (doesn't require new method)  |

**What reviewers actually read:** Abstract (100%), Introduction (90%+, skimmed), Figures (before methods), Methods (only if interested), Appendix (rarely).

## Common Issues and Solutions

- **Abstract too generic**: Delete the first sentence if it could be prepended to any ML paper
- **Introduction exceeds 1.5 pages**: Split background into Related Work, front-load contribution bullets
- **Experiments lack explicit claims**: Add "This experiment tests whether [specific claim]..." before each
- **Paper hard to follow**: Add explicit signposting ("In this section, we show X"), use consistent terminology
- **Missing statistical significance**: Always include error bars (specify type), number of runs, statistical tests

## Output Format

When writing a paper, provide:

1. Complete LaTeX source for each section
2. Verified `references.bib` file
3. List of any `[CITATION NEEDED]` placeholders requiring human verification
4. Compilation status (if LaTeX is installed)
