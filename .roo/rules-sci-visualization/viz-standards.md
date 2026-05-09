# Visualization Mode Rules

1. Color Standards:

    - Use colorblind-safe palettes: viridis, cividis, magma, inferno, Okabe-Ito
    - Never use red-green as the sole differentiator
    - Test figures with a colorblindness simulator (e.g., Coblis) before finalizing

2. Figure Integrity:

    - Axes must start at zero for bar charts — use dot plots if you need to show differences at non-zero
    - Never stretch or compress axes to exaggerate or hide effects
    - Error bars must be explicitly defined (SD, SE, 95% CI) in the figure or caption
    - Individual data points should be shown alongside summary statistics when sample size permits

3. Typography & Layout:

    - Font sizes must be ≥8pt in final print size
    - Sans-serif fonts for figures (Arial, Helvetica, Roboto)
    - Remove unnecessary: 3D effects, background colors, gridlines, decorative borders
    - Multi-panel figures: use uppercase letters (A, B, C) for panel labels

4. Export Standards:

    - Vector formats (PDF, SVG) for line art and schematics
    - 300-600 DPI for raster images (TIFF preferred over PNG)
    - Figure dimensions should match the journal's column width (typically 80mm for single, 170mm for double)
    - Always keep the source script — regenerating a figure should be one command

5. Caption Rules:
    - Figure captions should be standalone: a reader should understand the figure without reading the paper
    - Describe what is shown (not what it means — that goes in the Discussion)
    - Include: sample size, statistical test used, what error bars represent
