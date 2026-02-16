#!/usr/bin/env python3
"""
Tavily Search Tool for nanobot
Based on the provided examples, this tool provides comprehensive Tavily search functionality.
"""

import os
import sys
import json
from typing import Optional, Dict, Any

try:
    from tavily import TavilyClient
except ImportError:
    print("Error: tavily-python not installed. Run: pip install tavily-python", file=sys.stderr)
    sys.exit(1)

def get_api_key() -> str:
    """Get Tavily API key from environment variable or default."""
    api_key = os.getenv('TAVILY_API_KEY')
    if not api_key:
        # Use the example key from the provided code for testing
        api_key = "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"
    return api_key

def basic_tavily_search(query: str, search_depth: str = "basic", max_results: int = 5) -> Dict[str, Any]:
    """
    Basic Tavily search with essential parameters.
    """
    tavily = TavilyClient(api_key=get_api_key())
    
    response = tavily.search(
        query=query,
        search_depth=search_depth,
        max_results=max_results,
        include_answer=True,
        include_raw_content=False,
        include_images=False,
    )
    
    return response

def advanced_tavily_search(
    query: str,
    search_depth: str = "advanced",
    max_results: int = 8,
    recency_filter: Optional[str] = None,
    language: str = "zh",
    format: str = "json"
) -> Dict[str, Any]:
    """
    Advanced Tavily search with custom parameters.
    """
    tavily = TavilyClient(api_key=get_api_key())
    
    response = tavily.search(
        query=query,
        search_depth=search_depth,
        max_results=max_results,
        include_answer=True,
        include_media=False,
        include_links=True,
        recency_filter=recency_filter,
        format=format,
        language=language,
    )
    
    return response

def main():
    """Command line interface for Tavily search."""
    if len(sys.argv) < 2:
        print("Usage: python tavily_search.py <query> [search_type] [max_results]")
        print("  search_type: basic (default) or advanced")
        print("  max_results: number of results (default: 5 for basic, 8 for advanced)")
        sys.exit(1)
    
    query = sys.argv[1]
    search_type = sys.argv[2] if len(sys.argv) > 2 else "basic"
    max_results = int(sys.argv[3]) if len(sys.argv) > 3 else (5 if search_type == "basic" else 8)
    
    try:
        if search_type == "advanced":
            result = advanced_tavily_search(query, max_results=max_results)
        else:
            result = basic_tavily_search(query, max_results=max_results)
        
        # Output as JSON for easy parsing by other tools
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            "success": False,
            "message": f"Tavily search failed: {str(e)}",
            "data": None
        }
        print(json.dumps(error_result, indent=2, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()