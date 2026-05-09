# arXiv MCP Server for Sci-Roo

Searches arXiv via their public API (no API key required).

## Install

```bash
pip install mcp httpx
```

## Configure

Add to your MCP settings:

```json
{
	"mcpServers": {
		"arxiv": {
			"command": "python",
			"args": ["path/to/mcp-servers/arxiv/server.py"]
		}
	}
}
```

No API key needed. arXiv has a rate limit of ~1 request per 3 seconds — add a delay between rapid queries.

## Tools

- `arxiv_search` — Search arXiv preprints with field-specific queries
    - Field prefixes: `ti:` (title), `au:` (author), `abs:` (abstract), `cat:` (category, e.g., `cat:stat.ML`)
    - Supports year filtering and sort by relevance/date
- `arxiv_fetch` — Fetch paper details by arXiv ID
