import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "generate_figure",
		description:
			"Generate a publication-quality figure using R (ggplot2) or Python (matplotlib/seaborn). The code should save the plot to the path specified in the FIGURE_OUTPUT environment variable. Returns the generated image as a base64-encoded PNG/SVG/PDF. Use this for data visualization, plotting results, creating multi-panel figures, or generating graphical abstracts.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description:
						"R or Python plotting code. Must save the figure to the path in the FIGURE_OUTPUT environment variable. Example R: ggsave(Sys.getenv('FIGURE_OUTPUT'), plot, width=8, height=6). Example Python: plt.savefig(os.environ['FIGURE_OUTPUT'], dpi=300, bbox_inches='tight').",
				},
				language: {
					type: "string",
					enum: ["r", "python"],
					description: "Programming language to use for plotting.",
				},
				outputType: {
					type: "string",
					enum: ["png", "svg", "pdf"],
					description: "Output format. PNG for raster, SVG for vector (editable), PDF for LaTeX integration.",
				},
				filename: {
					type: "string",
					description:
						"Optional filename for the output figure (without extension). Defaults to auto-generated name.",
				},
				width: {
					type: "number",
					description: "Figure width in inches (default: 8).",
				},
				height: {
					type: "number",
					description: "Figure height in inches (default: 6).",
				},
				title: {
					type: "string",
					description: "Optional title for the figure (used in metadata only, not added to the plot).",
				},
				caption: {
					type: "string",
					description: "Optional caption describing the figure for accessibility and documentation.",
				},
			},
			required: ["code", "language", "outputType"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
