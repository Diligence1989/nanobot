#!/bin/bash
# Install Tavily Python SDK
pip install tavily-python

# Make the main script executable
chmod +x /root/.nanobot/workspace/skills/tavily-search/tavily_search.py

echo "Tavily search tool installed successfully!"
echo "To use:"
echo "1. Set your API key: export TAVILY_API_KEY='your-api-key'"
echo "2. Run: python3 /root/.nanobot/workspace/skills/tavily-search/tavily_search.py 'your query'"