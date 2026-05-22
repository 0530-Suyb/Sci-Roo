---
name: systems-paper-writing
description: Write publication-ready systems papers for OSDI, SOSP, ASPLOS, NSDI. Use when drafting papers, structuring arguments with systems-specific patterns, or preparing camera-ready submissions for top systems venues.
modeSlugs: [sci-paper-writing]
---

# Systems Paper Writing for Top Venues

Expert-level guidance for writing publication-ready papers targeting **OSDI, SOSP, ASPLOS, NSDI**. Systems papers have distinct structural requirements from ML papers: they emphasize problem motivation, design rationale, implementation details, and thorough evaluation.

## Core Philosophy

Systems papers answer: **"What problem does this system solve, and why can't existing systems solve it?"** The contribution is the system itself — its design, implementation, and the lessons learned from building and evaluating it.

### The Systems Paper Narrative

A strong systems paper tells a story with these elements:

1. **The Problem**: A real, important problem that practitioners face. Motivate with production observations, scaling challenges, or fundamental limitations in existing approaches.
2. **The Key Insight**: A single, crisp observation about why prior solutions fall short ("X is better than Y for Z because..."). This is your intellectual contribution.
3. **The Design**: How your insight translates into a concrete system architecture. Explain design decisions and tradeoffs.
4. **The Implementation**: Enough detail for reproducibility. Challenges overcome, surprising discoveries during building.
5. **The Evaluation**: End-to-end measurements on realistic workloads, not just microbenchmarks. Show that your system solves the problem you set out to solve.

## Paper Structure for Systems Conferences

### Introduction

- Start with the problem, not the solution
- Describe what happens with current systems (concrete scenario)
- State your key insight — the one idea that makes your approach work
- Preview evaluation results with concrete numbers
- 1-1.5 pages

### Motivation / Background

- Detailed problem analysis with real-world data or measurements
- Why existing systems fail (be specific and fair)
- What makes this problem hard

### Design

- Present your system architecture top-down
- Explain each design decision with its rationale
- Discuss alternatives you rejected and why
- Use clear diagrams showing system components and data flow

### Implementation

- Platform, language, lines of code
- Interesting implementation challenges and how you solved them
- Optimizations that were necessary for performance
- Be honest about what was harder than expected

### Evaluation

Systems papers live and die by their evaluation. Requirements:

- **End-to-end benchmarks** on realistic workloads (not just microbenchmarks)
- **Comparison against state-of-the-art** systems (not just baselines you wrote)
- **Sensitivity analysis**: how does performance vary with workload parameters?
- **Resource utilization**: CPU, memory, I/O, network — show where time is spent
- **Scalability**: how does the system behave as you increase load/data size?
- Answer: **"Does the system actually solve the problem it claims to solve?"**

### Related Work

Organize by problem domain and approach. For each category of related work:

- Describe the approach succinctly
- Explain the key difference from your work
- Be fair and cite generously

### Discussion / Lessons Learned

Systems papers often include lessons learned:

- What worked and what didn't
- Surprising findings during development or evaluation
- Limitations of the current system
- Directions for future work

## Writing Style for Systems Papers

- **Be precise about system behavior**: "The system processes 1.2M requests/second at p99 latency of 3ms" not "The system is fast"
- **Use concrete examples**: Show a specific scenario, trace through the system, explain what happens at each step
- **Explain design rationale**: "We chose X because Y, despite Z being a common alternative"
- **Define all terminology**: What is a "shard"? A "replica"? A "consistency boundary"?
- **Use consistent naming**: One name per component throughout the paper

## Conference Requirements

| Conference      | Page Limit | Key Requirements                             |
| --------------- | ---------- | -------------------------------------------- |
| **OSDI 2026**   | 12 pages   | USENIX format, artifact evaluation available |
| **SOSP 2026**   | 12 pages   | ACM SIGOPS format                            |
| **ASPLOS 2027** | 11 pages   | ACM SIGPLAN format                           |
| **NSDI 2027**   | 12 pages   | USENIX format, artifact evaluation available |

**Universal Requirements:** double-blind review, references excluded from page count, appendices allowed but reviewers not required to read.

## Evaluation Checklist for Systems Papers

Before submitting, verify:

- [ ] Does the introduction state the problem clearly with a concrete scenario?
- [ ] Is the key insight (the "why") clearly stated?
- [ ] Are all design decisions explained with rationale?
- [ ] Does the evaluation use realistic workloads and datasets?
- [ ] Are comparisons against the best available baselines?
- [ ] Is there a sensitivity analysis showing robustness?
- [ ] Are resource utilization breakdowns provided?
- [ ] Are limitations honestly discussed?

## Common Pitfalls

- **Solution without a problem**: Describing a system without motivating why anyone needs it
- **No key insight**: A collection of engineering decisions without a unifying idea
- **Microbenchmark-only evaluation**: Not showing that the system works end-to-end
- **No sensitivity analysis**: Showing only one workload point
- **Unfair comparisons**: Comparing against unoptimized baselines
- **No discussion of failed approaches**: Hiding design alternatives you explored and rejected

## ⚠️ Citation Rules

Same as ML papers: **never hallucinate citations**. Verify every reference via DOI or Semantic Scholar. Mark unverifiable citations as `[CITATION NEEDED]` and inform the scientist.
