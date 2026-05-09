# PubMed MCP Server for Sci-Roo

Searches PubMed via the NCBI Entrez API.

## Install

```bash
pip install mcp httpx
```

## Configure

Add to your MCP settings:

```json
{
	"mcpServers": {
		"pubmed": {
			"command": "python",
			"args": ["path/to/mcp-servers/pubmed/server.py"],
			"env": {
				"NCBI_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

Get an NCBI API key at: https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/

The API key is optional but recommended (increases rate limit from 3/sec to 10/sec).

## Tools

- `pubmed_search` — Search PubMed with query string
- `pubmed_fetch` — Fetch paper details by PMID
