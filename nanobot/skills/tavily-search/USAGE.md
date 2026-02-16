# Tavily Search Tool Usage

## Overview
Tavily Search is a specialized search engine designed for LLMs, providing high-quality, relevant results with built-in answer extraction.

## Installation
```bash
# Run the installation script
bash /root/.nanobot/workspace/skills/tavily-search/install.sh
```

## API Key Setup
1. Get your API key from [Tavily Dashboard](https://tavily.com/)
2. Set environment variable:
```bash
export TAVILY_API_KEY="your-api-key-here"
```

## Basic Usage
```bash
# Basic search (default)
python3 /root/.nanobot/workspace/skills/tavily-search/tavily_search.py "2026年人工智能最新趋势"

# Advanced search
python3 /root/.nanobot/workspace/skills/tavily-search/tavily_search.py "2026年AI新闻" advanced 8

# Custom max results
python3 /root/.nanobot/workspace/skills/tavily-search/tavily_search.py "最新大模型" basic 10
```

## Parameters
- **query**: Search query (required)
- **search_type**: `basic` (fast) or `advanced` (comprehensive) - default: basic
- **max_results**: Number of results to return (1-10) - default: 5 (basic) / 8 (advanced)

## Output Format
Returns JSON with:
- `answer`: Direct answer extracted by Tavily (if available)
- `results`: Array of search results with title, url, content
- `query`: Original search query

## Integration with nanobot
This tool can be called directly by nanobot's exec function or integrated into workflows that require real-time web search capabilities.