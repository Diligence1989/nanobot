---
name: wavily-search
description: Advanced AI-optimized search using Tavily API for high-quality, relevant results. Use when you need better search quality than standard web search, especially for complex queries, research, or when answer extraction is needed.
version: 1.0.0
author: diligence
---

# Tavily Search

## Description
Advanced AI-optimized search using Tavily API for high-quality, relevant results. Use when you need better search quality than standard web search, especially for complex queries, research, or when answer extraction is needed.

## Usage
```python
# Basic usage through exec tool
exec("python3 /root/.nanobot/workspace/skills/tavily-search/tavily_search.py 'search query'")

# Advanced usage with parameters
exec("python3 /root/.nanobot/workspace/skills/tavily-search/tavily_search.py 'search query' advanced 8")
```

## Setup
1. Install dependencies: `bash /root/.nanobot/workspace/skills/tavily-search/install.sh`
2. Set API key: `export TAVILY_API_KEY="your-key"`

## Parameters
- query (required): Search keywords or question
- search_type (optional): basic (default) or advanced
- max_results (optional): 1-10 results

## Output
JSON structure containing:
- answer: Direct answer from Tavily
- results: Array of search results with title, url, content
- query: Original search query

## When to Use
- Complex research queries requiring high-quality results
- When you need direct answers extracted from search results
- Real-time information retrieval for current events
- Academic or technical research requiring comprehensive coverage