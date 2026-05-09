# Data Analysis Mode Rules

1. Script-First Workflow:

    - Every analysis step must be scripted (R or Python) — never use GUI tools for analysis
    - Scripts must be self-contained and runnable from raw data to final output
    - Use relative paths; the workspace root is the project root

2. Environment Management:

    - Lock the computational environment: `renv.lock` (R) or `conda-lock.yml` / `requirements.txt` (Python)
    - Record R/Python version and all package versions
    - Set a global random seed in every script

3. Data Validation:

    - Validate data on load: check row count, column names, data types, missing values
    - Flag unexpected patterns: duplicate IDs, out-of-range values, impossible combinations
    - Report data quality issues BEFORE analysis

4. Analysis Documentation:

    - Each analysis script should have a header comment describing: purpose, input files, output files, key decisions
    - Comment WHY, not WHAT (the code already says what)
    - Record the date the analysis was run

5. Output Standards:
    - Save analysis results in structured formats (CSV, JSON) alongside visual outputs
    - Never save only figures without the underlying data
    - Generate a self-contained HTML/PDF report that includes code, output, and narrative
