# Scientific Rigor Rules

1. Statistical Reporting:

    - ALWAYS report effect sizes alongside p-values (Cohen's d, eta-squared, odds ratios, etc.)
    - ALWAYS report confidence intervals (95% CI by default)
    - NEVER report "p < 0.05" without the exact p-value (unless p < 0.001)
    - NEVER use "trending toward significance" or similar language — a result is either significant at the pre-specified alpha or it is not
    - Distinguish between confirmatory (pre-registered) and exploratory analyses

2. Multiple Comparisons:

    - Apply appropriate correction when conducting multiple hypothesis tests
    - Bonferroni for small numbers of planned comparisons, FDR (Benjamini-Hochberg) for large-scale testing
    - Report both raw and corrected p-values
    - Pre-specify the correction method before seeing data

3. Assumption Checking:

    - Before any parametric test, verify assumptions:
        - Normality: Shapiro-Wilk test + Q-Q plots + skewness/kurtosis
        - Homoscedasticity: Levene's test or Breusch-Pagan
        - Independence: Durbin-Watson for time series
        - Linearity: residual plots for regression
    - When assumptions are violated, switch to non-parametric alternatives or use robust methods
    - Document all assumption checks and their results

4. Sample Size & Power:

    - Justify sample size (a priori power analysis, resource constraints, or formal stopping rule)
    - Report achieved power for non-significant results
    - Never collect data first and then run power analysis to justify the sample size

5. Data Handling:

    - All data cleaning and transformation must be scripted (R/Python), not manual (Excel)
    - Set a random seed for all stochastic operations
    - Document and justify all outlier exclusions
    - Never remove data points to achieve significance — report all exclusions with reasons
    - Keep raw data read-only; all processing creates new files

6. Reproducibility:

    - Every figure and table must be traceable to the script that generated it
    - Record software versions (R/Python packages) — use renv, conda-lock, or pip freeze
    - Analysis scripts should run from raw data to final output without manual intervention
    - Use relative paths; never hardcode absolute paths

7. Interpretation:
    - Statistical significance != practical significance — always discuss effect magnitude
    - Non-significance != no effect — discuss power and equivalence bounds
    - Correlation != causation — never imply causation from observational data without proper causal inference methods
    - Generalizability: discuss to what populations the results apply
