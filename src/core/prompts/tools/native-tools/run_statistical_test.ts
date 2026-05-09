import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "run_statistical_test",
		description:
			"Execute R or Python statistical analysis code and return results. Use this to run hypothesis tests (t-test, ANOVA, chi-square, etc.), fit regression models, perform power analysis, or compute descriptive statistics. The code runs in a temp file and returns stdout/stderr output with structured statistical results.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description:
						"R or Python code to execute. Should print results to stdout. Use functions like t.test(), lm(), glm() in R, or scipy.stats, statsmodels in Python. The code should be self-contained.",
				},
				language: {
					type: "string",
					enum: ["r", "python"],
					description:
						"Programming language to use. Choose based on what statistical libraries the user's project uses.",
				},
				explanation: {
					type: "string",
					description:
						"Optional explanation of what statistical test is being performed and why, for the user's understanding.",
				},
			},
			required: ["code", "language"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
