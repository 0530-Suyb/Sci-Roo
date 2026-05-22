---
name: academic-plotting
description: Create publication-quality academic plots and figures for scientific papers. Use when the user needs figures for a manuscript, presentation, or poster targeting top conferences or journals.
modeSlugs: [sci-visualization, sci-data-analysis, sci-paper-writing]
---

# Academic Plotting Skill

## When to Use

- Creating publication-quality figures for a manuscript or preprint
- Generating presentation or poster graphics for academic venues
- Making multi-panel composite figures for journal submission
- Exporting figures in journal-required formats (PDF, EPS, TIFF)
- Ensuring figures meet conference requirements (colorblind-safe, proper DPI)

## When NOT to Use

- For quick, informal data exploration during analysis
- When the user has a specific design tool they prefer (e.g., BioRender)
- For diagrams like flowcharts or organizational charts

## Workflow

### Step 1: Understand the Figure's Purpose

Clarify: what is the one key message? What type of figure? Target venue specifications? Multi-panel?

### Step 2: Choose the Right Visualization

| Data / Message                         | Recommended Plot                            |
| -------------------------------------- | ------------------------------------------- |
| Compare groups (continuous)            | Box plot + individual points or violin plot |
| Show change over time                  | Line plot with error ribbons                |
| Relationship between 2 continuous vars | Scatter plot with regression line ± CI      |
| Distribution of a variable             | Histogram / density plot                    |
| Proportions / Composition              | Stacked bar chart (≤5 categories)           |
| Many variables, correlations           | Heatmap (correlation matrix)                |
| Rankings / comparisons                 | Dot plot / forest plot                      |
| Model architecture                     | Schematic diagram (vector)                  |
| Training curves                        | Line plot with smoothing                    |
| Ablation studies                       | Bar chart or dot plot with relative change  |

**Avoid**: pie charts, 3D charts, dual-axis charts (use small multiples instead).

### Step 3: Choose Colors

Use colorblind-safe palettes:

- **viridis** / **cividis** / **magma** — continuous data
- **Okabe-Ito** — categorical data: `#E69F00`, `#56B4E9`, `#009E73`, `#F0E442`, `#0072B2`, `#D55E00`, `#CC79A7`
- **Set2** / **Dark2** — categorical (pastel / dark)

Rules: no red-green pairs as sole differentiator, grayscale must work as fallback, consistent color mapping across all figures, 8% of men have color vision deficiency.

### Step 4: Build the Figure

#### R/ggplot2 (Preferred)

```r
library(ggplot2)
library(viridis)

ggplot(data, aes(x = group, y = value, fill = group)) +
  geom_violin(trim = TRUE, alpha = 0.3) +
  geom_boxplot(width = 0.1, alpha = 0.5, outlier.shape = NA) +
  geom_jitter(width = 0.1, alpha = 0.5, size = 1.5) +
  scale_fill_viridis(discrete = TRUE, option = "D") +
  labs(x = "Group", y = "Value (units)", title = NULL) +
  theme_classic(base_size = 10) +
  theme(legend.position = "none",
        axis.text = element_text(color = "black"),
        axis.ticks = element_line(color = "black"))
```

#### Python/matplotlib

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(3.5, 3))  # Single column width
ax.plot(x, y, color="#0072B2", linewidth=1.5)
ax.fill_between(x, y-ci, y+ci, alpha=0.2, color="#0072B2")
ax.set_xlabel("X Label")
ax.set_ylabel("Y Label (units)")
plt.tight_layout()
fig.savefig("figure.pdf", dpi=300, bbox_inches="tight")
```

### Step 5: Apply Styling Rules

- Remove background color, top/right spines
- Font: sans-serif (Arial/Helvetica), ≥8pt in final size
- Axis labels: variable name + units
- Legend: inside plot area if space permits, otherwise below
- Gridlines: light gray, only major gridlines if needed
- No title inside the figure — that belongs in the caption

### Step 6: Compose Multi-Panel Figures

- Use `patchwork` (R) or `gridspec` (Python matplotlib)
- Label panels: uppercase letters A, B, C, D in consistent position
- Consistent axis scales across comparable panels
- Shared legend when panels have the same grouping
- Align panels precisely

### Step 7: Export

| Target              | Format          | DPI     | Color Mode   |
| ------------------- | --------------- | ------- | ------------ |
| Most CS conferences | PDF (preferred) | —       | RGB          |
| Nature journals     | PDF (vector)    | —       | RGB          |
| Cell journals       | TIFF            | 300-600 | RGB          |
| Most journals       | PDF or TIFF     | 300     | RGB          |
| Presentations       | PNG             | 150     | RGB          |
| Posters             | PDF/SVG         | —       | CMYK (print) |

**Always keep the script — the figure must be reproducible.**

### Step 8: Write the Caption

Describe WHAT is shown, not what it MEANS:

- Panel labels and what each panel shows
- Sample size (n = X)
- What data points / bars / lines represent (mean ± SD, median [IQR], etc.)
- Statistical test and significance level
- Abbreviations used

**Example**: "Figure 1: Model performance on benchmark datasets. (A) Accuracy on ImageNet across training steps. Lines show mean ± SD over 5 seeds (n = 5). (B) Inference latency on A100 GPU. Bars show median with IQR (n = 100 runs). See Table S1 for numerical values."

## Conference-Specific Requirements

### CS Conferences (NeurIPS/ICML/ICLR/OSDI/etc.)

- Vector graphics (PDF) strongly preferred
- Colorblind-safe colors required
- Figures count toward page limit

### Systems Conferences

- Design figures for 2-column width
- PDF vector graphics preferred
- Grayscale-friendly (many readers print papers)

## Output

1. Figure file in the requested format (PDF preferred)
2. Source script (R/Python) with comments
3. Suggested figure caption
4. Note any colorblind-safety or grayscale concerns
