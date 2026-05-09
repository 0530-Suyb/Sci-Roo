"""
PubMed MCP Server for Sci-Roo

Provides tools for searching PubMed via the NCBI Entrez API.
Requires: pip install mcp httpx xmltodict
"""

import asyncio
import os
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
DEFAULT_MAX_RESULTS = 20

server = Server("pubmed-mcp")


def get_api_key() -> str | None:
    return os.environ.get("NCBI_API_KEY")


async def search_pubmed(query: str, max_results: int = DEFAULT_MAX_RESULTS) -> list[dict[str, Any]]:
    """Search PubMed and return paper metadata."""
    api_key = get_api_key()
    params: dict[str, Any] = {
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
        "sort": "relevance",
    }
    if api_key:
        params["api_key"] = api_key

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: Search for IDs
        search_resp = await client.get(f"{PUBMED_BASE}/esearch.fcgi", params=params)
        search_resp.raise_for_status()
        search_data = search_resp.json()

        id_list = search_data.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return []

        # Step 2: Fetch details
        fetch_params: dict[str, Any] = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "retmode": "xml",
        }
        if api_key:
            fetch_params["api_key"] = api_key

        fetch_resp = await client.get(f"{PUBMED_BASE}/efetch.fcgi", params=fetch_params)
        fetch_resp.raise_for_status()

        import xml.etree.ElementTree as ET

        root = ET.fromstring(fetch_resp.text)
        results: list[dict[str, Any]] = []

        for article in root.findall(".//PubmedArticle"):
            medline = article.find(".//MedlineCitation")
            article_elem = medline.find(".//Article") if medline is not None else None

            title_elem = article_elem.find(".//ArticleTitle") if article_elem is not None else None
            title = title_elem.text or "" if title_elem is not None else ""

            # Authors
            authors: list[str] = []
            if article_elem is not None:
                for author in article_elem.findall(".//Author"):
                    last = author.findtext("LastName", "")
                    first = author.findtext("ForeName", "")
                    if last:
                        authors.append(f"{last}, {first}")

            # Journal
            journal_elem = article_elem.find(".//Journal/Title") if article_elem is not None else None
            journal = journal_elem.text if journal_elem is not None else ""

            # Year
            year = ""
            pub_date = article_elem.find(".//Journal/JournalIssue/PubDate") if article_elem is not None else None
            if pub_date is not None:
                year_elem = pub_date.find("Year")
                if year_elem is not None:
                    year = year_elem.text or ""

            # DOI
            doi = ""
            for eid in article_elem.findall(".//ELocationID") if article_elem is not None else []:
                if eid.get("EIdType") == "doi":
                    doi = eid.text or ""

            # Abstract
            abstract_parts: list[str] = []
            if article_elem is not None:
                for abs_text in article_elem.findall(".//Abstract/AbstractText"):
                    label = abs_text.get("Label", "")
                    text = abs_text.text or ""
                    abstract_parts.append(f"{label}: {text}" if label else text)
            abstract = " ".join(abstract_parts)

            # PMID
            pmid_elem = medline.find(".//PMID") if medline is not None else None
            pmid = pmid_elem.text or "" if pmid_elem is not None else ""

            results.append({
                "title": title,
                "authors": ", ".join(authors[:10]),
                "year": year,
                "journal": journal,
                "doi": doi,
                "pmid": pmid,
                "abstract": abstract[:500] + "..." if len(abstract) > 500 else abstract,
                "source": "pubmed",
            })

        return results


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="pubmed_search",
            description="Search PubMed for biomedical and life sciences papers. Returns title, authors, journal, year, DOI, PMID, and abstract for each result.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query using PubMed syntax. Use MeSH terms, field tags ([Title/Abstract], [MeSH]), and Boolean operators (AND, OR, NOT).",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 20, max: 100).",
                        "default": 20,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="pubmed_fetch",
            description="Fetch full details for a specific paper by PubMed ID (PMID).",
            inputSchema={
                "type": "object",
                "properties": {
                    "pmid": {
                        "type": "string",
                        "description": "PubMed ID (PMID) of the paper to fetch.",
                    },
                },
                "required": ["pmid"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    if name == "pubmed_search":
        query = arguments.get("query", "")
        max_results = min(int(arguments.get("max_results", DEFAULT_MAX_RESULTS)), 100)
        if not query:
            return [TextContent(type="text", text="Error: 'query' parameter is required.")]

        try:
            results = await search_pubmed(query, max_results)
            if not results:
                return [TextContent(type="text", text=f"No results found for query: {query}")]

            output = f"PubMed search results for '{query}' ({len(results)} found):\n\n"
            for i, paper in enumerate(results):
                output += f"{i+1}. **{paper['title']}**\n"
                output += f"   Authors: {paper['authors']}\n"
                output += f"   {paper.get('journal', '')} ({paper.get('year', 'n.d.')})\n"
                output += f"   PMID: {paper.get('pmid', 'N/A')} | DOI: {paper.get('doi', 'N/A')}\n"
                output += f"   Abstract: {paper.get('abstract', 'N/A')}\n\n"

            return [TextContent(type="text", text=output)]
        except Exception as e:
            return [TextContent(type="text", text=f"PubMed search error: {str(e)}")]

    elif name == "pubmed_fetch":
        pmid = arguments.get("pmid", "")
        if not pmid:
            return [TextContent(type="text", text="Error: 'pmid' parameter is required.")]

        try:
            api_key = get_api_key()
            params: dict[str, Any] = {"db": "pubmed", "id": pmid, "retmode": "xml"}
            if api_key:
                params["api_key"] = api_key

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(f"{PUBMED_BASE}/efetch.fcgi", params=params)
                resp.raise_for_status()

            # Basic parsing - return raw details
            return [TextContent(type="text", text=f"PubMed details for PMID {pmid}:\n\n{resp.text[:4000]}")]
        except Exception as e:
            return [TextContent(type="text", text=f"PubMed fetch error: {str(e)}")]

    return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
