---
name: power-analysis
description: Conduct a priori power analysis and sample size calculation for research studies. Use when planning an experiment, writing a grant, or justifying sample size in a manuscript.
modeSlugs: [sci-hyp-design, sci-data-analysis]
---

# Power Analysis Skill

## When to Use

- Planning a new study and determining required sample size
- Writing a grant proposal that requires sample size justification
- Responding to reviewer comments about statistical power
- Evaluating whether a published study was adequately powered
- Determining the minimum detectable effect size given a fixed sample size

## When NOT to Use

- Post-hoc power analysis on completed studies (this is meaningless — use confidence intervals instead)
- When the study design is not yet finalized
- For purely descriptive studies without hypothesis testing

## Workflow

### Step 1: Identify the Primary Analysis

Power analysis should be based on the PRIMARY hypothesis test:

- What is the main statistical test? (t-test, ANOVA, regression, chi-square, etc.)
- Is it one-tailed or two-tailed?
- What is the planned alpha level? (typically 0.05, but adjust for multiple primary outcomes)

### Step 2: Estimate the Effect Size

The effect size should come from PRIOR LITERATURE, not guesses:

1. **From meta-analysis**: the pooled effect size is the best estimate
2. **From a pilot study**: use the lower bound of the CI, not the point estimate
3. **From similar studies**: find the most comparable published study
4. **Smallest effect of interest (SESOI)**: the smallest effect that would be theoretically or practically meaningful

Report effect sizes in appropriate metrics:

- **Cohen's d**: 0.2 = small, 0.5 = medium, 0.8 = large
- **Cohen's f**: 0.1 = small, 0.25 = medium, 0.4 = large
- **Eta-squared / partial eta-squared**
- **Odds ratio / Risk ratio**
- **Correlation coefficient r**: 0.1 = small, 0.3 = medium, 0.5 = large

### Step 3: Run the Power Analysis

Use R (`pwr` package) or Python (`statsmodels`):

**R examples:**

```r
library(pwr)

# Two-sample t-test
pwr.t.test(
  d = 0.5,           # Cohen's d
  power = 0.80,      # Desired power
  sig.level = 0.05,  # Alpha
  type = "two.sample",
  alternative = "two.sided"
)

# One-way ANOVA (3 groups)
pwr.anova.test(
  k = 3,             # Number of groups
  f = 0.25,          # Cohen's f
  power = 0.80,
  sig.level = 0.05
)

# Correlation
pwr.r.test(
  r = 0.3,
  power = 0.80,
  sig.level = 0.05
)

# Chi-square (df = (rows-1)*(cols-1))
pwr.chisq.test(
  w = 0.3,           # Cohen's w
  df = 2,
  power = 0.80,
  sig.level = 0.05
)
```

**Python examples:**

```python
from statsmodels.stats.power import TTestIndPower

analysis = TTestIndPower()
n = analysis.solve_power(
    effect_size=0.5,  # Cohen's d
    power=0.80,
    alpha=0.05,
    ratio=1.0,        # n2/n1
    alternative='two-sided'
)
```

### Step 4: Conduct Sensitivity Analysis

Always run sensitivity analyses:

- What if the true effect size is smaller than expected? (50%, 75% of planned)
- What sample size would be needed for different power levels? (80%, 90%, 95%)
- For the minimum detectable effect at 80% power with the planned N
- Produce a power curve plot showing power vs. N or power vs. effect size

### Step 5: Account for Practical Considerations

Adjust the calculated N for:

- **Attrition/dropout**: typically 10-20% increase
- **Missing data**: inflate by expected missingness rate
- **Multiple comparisons**: adjust alpha (Bonferroni: alpha / number of tests)
- **Clustering/design effects**: multiply N by design effect (1 + (m-1)\*ICC)

### Step 6: Report

Provide a complete power analysis statement for the manuscript:

> "An a priori power analysis was conducted using G\*Power/pwr [version] to determine the required sample size. Based on a [test name] with alpha = [value], power = [value], and an expected effect size of d = [value] derived from [citation], the required sample size is N = [value] per group. Accounting for [X]% expected attrition, we plan to recruit N = [value] participants total."

## Output Format

1. **Sample size**: required N per group and total N (with and without attrition adjustment)
2. **Sensitivity analysis**: power curve plot and table of N vs. effect size vs. power
3. **Methods section text**: ready-to-use power analysis statement
4. **Analysis script**: self-contained R/Python script
5. **Effect size justification**: citation(s) for the expected effect size
