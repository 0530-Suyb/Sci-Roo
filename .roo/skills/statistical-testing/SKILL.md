---
name: statistical-testing
description: Select, execute, and interpret statistical tests with rigor. Use when the user needs to compare groups, test associations, run regressions, or perform any statistical inference on research data.
modeSlugs: [sci-data-analysis]
---

# Statistical Testing Skill

## When to Use

- Choosing the right statistical test for a given research design
- Running hypothesis tests in R or Python
- Interpreting statistical output (not just whether p < 0.05)
- Checking test assumptions and deciding on alternatives
- Generating a complete statistical report for a manuscript

## When NOT to Use

- For exploratory data visualization without formal testing
- For data cleaning or preprocessing (do that first, then come here)
- When the user has already specified an analysis plan (follow their plan)

## Workflow

### Step 1: Understand the Data and Design

Before choosing a test, determine:

- **Outcome variable type**: continuous, binary, count, time-to-event, ordinal
- **Predictor variable type**: categorical (how many groups?), continuous
- **Study design**: independent groups, paired/repeated measures, clustered/nested
- **Number of groups/conditions**: 2, 3+, factorial?
- **Covariates**: any variables to control for?

### Step 2: Select the Appropriate Test

| Scenario                | Parametric                  | Non-parametric       |
| ----------------------- | --------------------------- | -------------------- |
| 2 independent groups    | Independent t-test          | Mann-Whitney U       |
| 2 paired groups         | Paired t-test               | Wilcoxon signed-rank |
| 3+ independent groups   | One-way ANOVA               | Kruskal-Wallis       |
| 3+ paired groups        | Repeated measures ANOVA     | Friedman             |
| 2 categorical vars      | Chi-square / Fisher's exact | —                    |
| Continuous ~ continuous | Pearson r                   | Spearman rho         |
| Prediction (continuous) | Linear regression           | Quantile regression  |
| Prediction (binary)     | Logistic regression         | —                    |
| Survival/time-to-event  | Cox proportional hazards    | —                    |

**For complex designs:**

- Factorial ANOVA for multiple categorical predictors
- ANCOVA to control for continuous covariates
- Mixed-effects models for repeated measures or nested data (preferred over RM-ANOVA)
- Generalized linear models for non-normal outcomes

### Step 3: Check Assumptions

For parametric tests, check and document:

1. **Normality**: Shapiro-Wilk test + Q-Q plot + histogram

    - If violated and N < 30: use non-parametric alternative
    - If violated and N ≥ 30: consider if skew is severe; Central Limit Theorem may help

2. **Homogeneity of variance**: Levene's test or Bartlett's test

    - If violated: Welch's t-test (instead of Student's), Welch's ANOVA, or use robust methods

3. **Independence**: Durbin-Watson for time series or clustered data

    - If violated: mixed-effects models, GEE, or clustered standard errors

4. **Linearity** (regression): residual vs. fitted plot, component + residual plots

5. **Multicollinearity** (multiple regression): VIF, tolerance

### Step 4: Run the Test

Always:

- Set a random seed before any stochastic procedure
- Use well-established R/Python packages (stats, lme4, scipy, statsmodels)
- Save the full model output object, not just the p-value
- Run the test on clean, validated data

### Step 5: Report Results

Report the following for every test:

1. **Test name** and justification
2. **Descriptive statistics**: means ± SD, medians [IQR], or proportions with CI
3. **Test statistic** with degrees of freedom
4. **Exact p-value** (not "p < 0.05" unless p < 0.001)
5. **Effect size**: Cohen's d, eta-squared, odds ratio, r, etc.
6. **95% Confidence interval** for the effect size
7. **Assumption check results** (supplementary)
8. **Plain-language interpretation**: what does this mean for the research question?

### Step 6: Apply Corrections

When running multiple tests:

- **Planned comparisons** (confirmatory): consider Bonferroni or Holm-Bonferroni
- **Exploratory** (many tests): Benjamini-Hochberg FDR correction
- Always report both raw and corrected p-values

## Output Format

For each analysis, produce:

1. Assumption check summary (supplement)
2. Test results table (manuscript-ready)
3. Effect size plot with confidence intervals
4. Analysis script (self-contained, runnable)
5. Plain-language interpretation for the Results section
