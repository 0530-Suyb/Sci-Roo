---
name: figure-generation
description: Create publication-quality scientific figures using ggplot2 (R) or matplotlib (Python). Use when the user needs figures for a manuscript, presentation, poster, or grant application.
modeSlugs: [sci-visualization, sci-data-analysis, sci-paper-writing]
---

# Figure Generation Skill

## When to Use

- Creating figures for a manuscript or preprint
- Generating presentation or poster graphics
- Making multi-panel composite figures
- Exporting figures in journal-required formats
- Recreating or improving figures from analysis output

## When NOT to Use

- For quick, informal data exploration during analysis (use the data-analysis mode)
- When the user has a specific design tool they prefer (e.g., BioRender for schematics)
- For diagrams (flowcharts, mind maps) — use an appropriate diagramming tool

## Workflow

### Step 1: Understand the Figure's Purpose

Clarify with the user:

- What is the one key message this figure should communicate?
- What type of figure is needed? (data plot, schematic, flowchart, photograph panel)
- Target journal and its figure specifications
- Is this part of a multi-panel figure? How many panels?

### Step 2: Choose the Right Visualization

| Data / Message                         | Recommended Plot                                       |
| -------------------------------------- | ------------------------------------------------------ |
| Compare groups (continuous)            | Box plot + individual points (beeswarm) or violin plot |
| Show change over time                  | Line plot with error ribbons                           |
| Relationship between 2 continuous vars | Scatter plot with regression line ± CI                 |
| Distribution of a variable             | Histogram / density plot                               |
| Proportions / Composition              | Stacked bar chart (≤5 categories) or waffle chart      |
| Many variables, correlations           | Heatmap (correlation matrix)                           |
| Rankings / comparisons                 | Dot plot / forest plot                                 |
| Spatial data                           | Choropleth map / heatmap                               |

**Avoid**: pie charts, 3D charts, dual-axis charts (use small multiples instead)

### Step 3: Choose Colors

Use colorblind-safe palettes:

- **viridis** / **cividis** / **magma** — continuous data
- **Okabe-Ito** — categorical data (up to 7 categories)
- **Set2** / **Dark2** — categorical data (pastel / dark)

Rules:

- Red-green pairs are prohibited as the sole color differentiator
- Grayscale should work as a fallback (test by converting to grayscale)
- Maintain consistent color mapping across all figures in a paper

### Step 4: Build the Figure (R/ggplot2 preferred)

For R ggplot2:

```r
library(ggplot2)
library(viridis)

ggplot(data, aes(x = group, y = value, fill = group)) +
  geom_violin(trim = TRUE, alpha = 0.3) +
  geom_boxplot(width = 0.1, alpha = 0.5, outlier.shape = NA) +
  geom_jitter(width = 0.1, alpha = 0.5, size = 1.5) +
  scale_fill_viridis(discrete = TRUE, option = "D") +
  labs(
    x = "Group",
    y = "Value (units)",
    title = NULL  # Figures should not have titles
  ) +
  theme_classic(base_size = 10) +
  theme(
    legend.position = "none",
    axis.text = element_text(color = "black"),
    axis.ticks = element_line(color = "black")
  )
```

For Python matplotlib:

```python
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(3.5, 3))  # Single column width
# ... plotting code ...
ax.set_xlabel("Group")
ax.set_ylabel("Value (units)")
plt.tight_layout()
fig.savefig("figure.pdf", dpi=300, bbox_inches="tight")
```

### Step 5: Apply Styling Rules

- Remove: background color, top/right spines (or use `theme_classic()`)
- Font: sans-serif (Arial/Helvetica), ≥8pt in final size
- Axis labels: variable name + units
- Legend: inside plot area if space permits, otherwise below
- Gridlines: light gray, only major gridlines if needed

### Step 6: Compose Multi-Panel Figures

For multi-panel figures:

- Use `patchwork` (R) or `gridspec` (Python matplotlib)
- Label panels with uppercase letters: A, B, C, D
- Consistent axis scales across comparable panels
- Shared legend when panels have the same grouping
- Align panels precisely

### Step 7: Export

Export specifications by target:

| Target          | Format                  | DPI     | Color Mode   |
| --------------- | ----------------------- | ------- | ------------ |
| Nature journals | PDF (vector)            | —       | RGB          |
| Cell journals   | TIFF                    | 300-600 | RGB          |
| PLOS            | TIFF/EPS                | 300-600 | RGB          |
| Most journals   | PDF (preferred) or TIFF | 300     | RGB          |
| Presentations   | PNG                     | 150     | RGB          |
| Posters         | PDF/SVG                 | —       | CMYK (print) |

Always keep the script — the figure must be reproducible.

### Step 8: Write the Caption

The caption should describe WHAT is shown, not what it MEANS:

- Panel labels and what each panel shows
- Sample size
- What data points / bars / lines represent (mean ± SD, median [IQR], etc.)
- Statistical test and significance level
- Abbreviations used

## Output

1. Figure file in the requested format
2. Source script (R/Python) with comments
3. Suggested figure caption
