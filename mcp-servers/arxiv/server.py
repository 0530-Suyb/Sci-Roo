"""
arXiv MCP Server for Sci-Roo

Provides tools for searching arXiv via their public API.
Requires: pip install mcp httpx
"""

import asyncio
from typing import Any
from datetime import datetime

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

ARXIV_API_BASE = "http://export.arxiv.org/api/query"
DEFAULT_MAX_RESULTS = 20

server = Server("arxiv-mcp")


async def search_arxiv(
    query: str,
    max_results: int = DEFAULT_MAX_RESULTS,
    sort_by: str = "relevance",
    year_from: int | None = None,
    year_to: int | None = None,
) -> list[dict[str, Any]]:
    """Search arXiv and return paper metadata."""
    import xml.etree.ElementTree as ET

    params: dict[str, Any] = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "relevance" if sort_by == "relevance" else "lastUpdatedDate",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(ARXIV_API_BASE, params=params)
        resp.raise_for_status()

        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "arxiv": "http://arxiv.org/schemas/atom",
        }

        root = ET.fromstring(resp.text)
        results: list[dict[str, Any]] = []

        for entry in root.findall("atom:entry", ns):
            title = entry.findtext("atom:title", "").strip().replace("\n", " ")
            arxiv_id_full = entry.findtext("atom:id", "").strip()
            arxiv_id = arxiv_id_full.split("/abs/")[-1] if "/abs/" in arxiv_id_full else arxiv_id_full

            # Authors
            authors = [
                auth.findtext("atom:name", "").strip()
                for auth in entry.findall("atom:author", ns)
            ]

            # Abstract
            abstract = entry.findtext("atom:summary", "").strip().replace("\n", " ")

            # Published date
            published = entry.findtext("atom:published", "")
            year = ""
            if published:
                try:
                    year = str(datetime.fromisoformat(published.replace("Z", "+00:00")).year)
                except Exception:
                    year = published[:4] if len(published) >= 4 else ""

            # Categories
            categories = [
                cat.get("term", "")
                for cat in entry.findall("atom:category", ns)
            ]

            # Primary category
            primary_cat = ""
            for cat in entry.findall("arxiv:primary_category", ns):
                primary_cat = cat.get("term", "")

            # DOI (embedded in some arXiv entries)
            doi = ""
            for link in entry.findall("atom:link", ns):
                href = link.get("href", "")
                if "doi.org" in href:
                    doi = href.split("doi.org/")[-1]

            # Year filter
            entry_year_int = int(year) if year else 0
            if year_from and entry_year_int < year_from:
                continue
            if year_to and entry_year_int > year_to:
                continue

            results.append({
                "title": title,
                "authors": ", ".join(authors[:10]),
                "year": year,
                "journal": f"arXiv:{primary_cat}" if primary_cat else "arXiv",
                "arxivId": arxiv_id,
                "doi": doi,
                "categories": ", ".join(categories[:5]),
                "abstract": abstract[:800] + "..." if len(abstract) > 800 else abstract,
                "source": "arxiv",
                "url": f"https://arxiv.org/abs/{arxiv_id}",
            })

        return results


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="arxiv_search",
            description="Search arXiv for preprints in physics, math, computer science, quantitative biology, statistics, and related fields. Returns title, authors, categories, year, arXiv ID, DOI (if available), and abstract.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query. Use field prefixes: ti: (title), au: (author), abs: (abstract), cat: (category, e.g., cat:stat.ML), all: (all fields). Boolean operators: AND, OR, ANDNOT.",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 20, max: 100).",
                        "default": 20,
                    },
                    "sort_by": {
                        "type": "string",
                        "enum": ["relevance", "date"],
                        "description": "Sort by relevance or last updated date.",
                        "default": "relevance",
                    },
                    "year_from": {
                        "type": "integer",
                        "description": "Filter papers from this year onward.",
                    },
                    "year_to": {
                        "type": "integer",
                        "description": "Filter papers up to this year.",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="arxiv_fetch",
            description="Fetch details for a specific paper by arXiv ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "arxiv_id": {
                        "type": "string",
                        "description": "arXiv ID (e.g., '2301.12345' or '2301.12345v2').",
                    },
                },
                "required": ["arxiv_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    if name == "arxiv_search":
        query = arguments.get("query", "")
        max_results = min(int(arguments.get("max_results", DEFAULT_MAX_RESULTS)), 100)
        sort_by = arguments.get("sort_by", "relevance")
        year_from = arguments.get("year_from")
        year_to = arguments.get("year_to")

        if not query:
            return [TextContent(type="text", text="Error: 'query' parameter is required.")]

        try:
            results = await search_arxiv(query, max_results, str(sort_by), year_from, year_to)
            if not results:
                return [TextContent(type="text", text=f"No results found for query: {query}")]

            output = f"arXiv search results for '{query}' ({len(results)} found):\n\n"
            for i, paper in enumerate(results):
                output += f"{i+1}. **{paper['title']}**\n"
                output += f"   Authors: {paper['authors']}\n"
                output += f"   arXiv: {paper['arxivId']} | {paper.get('categories', '')} ({paper.get('year', 'n.d.')})\n"
                if paper.get("doi"):
                    output += f"   DOI: {paper['doi']}\n"
                output += f"   URL: {paper['url']}\n"
                output += f"   Abstract: {paper.get('abstract', 'N/A')}\n\n"

            return [TextContent(type="text", text=output)]
        except Exception as e:
            return [TextContent(type="text", text=f"arXiv search error: {str(e)}")]

    elif name == "arxiv_fetch":
        arxiv_id = arguments.get("arxiv_id", "")
        if not arxiv_id:
            return [TextContent(type="text", text="Error: 'arxiv_id' parameter is required.")]

        try:
            params = {
                "id_list": arxiv_id,
                "max_results": 1,
            }

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(ARXIV_API_BASE, params=params)
                resp.raise_for_status()

            return [TextContent(type="text", text=f"arXiv details for {arxiv_id}:\n\n{resp.text[:4000]}")]
        except Exception as e:
            return [TextContent(type="text", text=f"arXiv fetch error: {str(e)}")]

    return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
