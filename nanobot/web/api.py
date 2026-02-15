"""HTTP API server for the nanobot web frontend.

Provides REST endpoints for:
- Sending messages and getting responses
- Listing/creating/switching sessions per user
- Retrieving conversation history

All data is plaintext, no authentication or encryption.
"""

import asyncio
import json
import re
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, parse_qs
from datetime import datetime

from loguru import logger

from nanobot.session.manager import SessionManager, Session
from nanobot.agent.loop import AgentLoop
from nanobot.utils.helpers import safe_filename


def make_session_key(username: str, session_name: str) -> str:
    """Build a human-readable session key like 'web-alice-general'."""
    safe_user = re.sub(r"[^a-zA-Z0-9]", "-", username.lower()).strip("-")
    safe_name = re.sub(r"[^a-zA-Z0-9]", "-", session_name.lower()).strip("-")
    return f"web-{safe_user}-{safe_name}"


def parse_web_session_key(key: str) -> tuple[str, str] | None:
    """Parse a web session key back into (username, session_name).

    Returns None if the key doesn't match the web-<user>-<name> pattern.
    """
    if not key.startswith("web-"):
        return None
    rest = key[4:]
    parts = rest.split("-", 1)
    if len(parts) < 2:
        return None
    return parts[0], parts[1]


class WebAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the nanobot web API."""

    agent_loop: AgentLoop
    session_manager: SessionManager
    static_dir: str
    event_loop: asyncio.AbstractEventLoop

    def log_message(self, format: str, *args: Any) -> None:
        """Route HTTP logs through loguru."""
        logger.debug(f"HTTP {format % args}")

    def _set_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status: int, message: str) -> None:
        self._send_json({"error": message}, status)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length)

    def _parse_json_body(self) -> dict | None:
        try:
            raw = self._read_body()
            if not raw:
                return None
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    # ------------------------------------------------------------------
    # Routing
    # ------------------------------------------------------------------

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/sessions":
            self._handle_list_sessions(qs)
        elif path == "/api/history":
            self._handle_get_history(qs)
        elif path == "/api/health":
            self._send_json({"status": "ok"})
        else:
            self._serve_static(path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/chat":
            self._handle_chat()
        elif path == "/api/sessions/create":
            self._handle_create_session()
        elif path == "/api/sessions/delete":
            self._handle_delete_session()
        else:
            self._send_error(404, "Not found")

    # ------------------------------------------------------------------
    # API handlers
    # ------------------------------------------------------------------

    def _handle_list_sessions(self, qs: dict) -> None:
        """GET /api/sessions?username=alice — list sessions for a user."""
        username_list = qs.get("username", [])
        if not username_list or not username_list[0]:
            self._send_error(400, "username is required")
            return

        username = username_list[0].lower()
        prefix = f"web-{re.sub(r'[^a-zA-Z0-9]', '-', username).strip('-')}-"

        all_sessions = self.session_manager.list_sessions()
        user_sessions = []
        for s in all_sessions:
            key = s.get("key", "")
            if key.startswith(prefix):
                session_name = key[len(prefix):]
                user_sessions.append({
                    "key": key,
                    "name": session_name,
                    "created_at": s.get("created_at"),
                    "updated_at": s.get("updated_at"),
                })

        logger.info(f"[web] List sessions for user={username}, found={len(user_sessions)}")
        self._send_json({"sessions": user_sessions})

    def _handle_get_history(self, qs: dict) -> None:
        """GET /api/history?session_key=web-alice-general — get conversation history."""
        key_list = qs.get("session_key", [])
        if not key_list or not key_list[0]:
            self._send_error(400, "session_key is required")
            return

        session_key = key_list[0]
        session = self.session_manager.get_or_create(session_key)
        messages = []
        for m in session.messages:
            messages.append({
                "role": m.get("role", ""),
                "content": m.get("content", ""),
                "timestamp": m.get("timestamp", ""),
            })

        logger.info(f"[web] Get history for session={session_key}, messages={len(messages)}")
        self._send_json({"messages": messages})

    def _handle_chat(self) -> None:
        """POST /api/chat — send a message and get a response."""
        body = self._parse_json_body()
        if not body:
            self._send_error(400, "Invalid JSON body")
            return

        username = body.get("username", "").strip()
        session_name = body.get("session_name", "").strip()
        message = body.get("message", "").strip()

        if not username or not session_name or not message:
            self._send_error(400, "username, session_name, and message are required")
            return

        session_key = make_session_key(username, session_name)
        logger.info(f"[web] Chat request: user={username}, session={session_key}, msg={message[:80]}")

        try:
            future = asyncio.run_coroutine_threadsafe(
                self.agent_loop.process_direct(
                    content=message,
                    session_key=session_key,
                    channel="web",
                    chat_id=f"{username}:{session_name}",
                ),
                self.event_loop,
            )
            response = future.result(timeout=300)
        except Exception as e:
            logger.error(f"[web] Chat error: {e}")
            self._send_error(500, f"Agent error: {str(e)}")
            return

        logger.info(f"[web] Chat response: session={session_key}, len={len(response)}")
        self._send_json({"response": response, "session_key": session_key})

    def _handle_create_session(self) -> None:
        """POST /api/sessions/create — create a new session."""
        body = self._parse_json_body()
        if not body:
            self._send_error(400, "Invalid JSON body")
            return

        username = body.get("username", "").strip()
        session_name = body.get("session_name", "").strip()

        if not username or not session_name:
            self._send_error(400, "username and session_name are required")
            return

        session_key = make_session_key(username, session_name)
        session = self.session_manager.get_or_create(session_key)
        self.session_manager.save(session)

        logger.info(f"[web] Created session: {session_key}")
        self._send_json({"session_key": session_key, "name": session_name})

    def _handle_delete_session(self) -> None:
        """POST /api/sessions/delete — clear a session."""
        body = self._parse_json_body()
        if not body:
            self._send_error(400, "Invalid JSON body")
            return

        session_key = body.get("session_key", "").strip()
        if not session_key:
            self._send_error(400, "session_key is required")
            return

        session = self.session_manager.get_or_create(session_key)
        session.clear()
        self.session_manager.save(session)
        self.session_manager.invalidate(session_key)

        logger.info(f"[web] Deleted session: {session_key}")
        self._send_json({"ok": True})

    # ------------------------------------------------------------------
    # Static file serving
    # ------------------------------------------------------------------

    def _serve_static(self, path: str) -> None:
        """Serve static files from the frontend dist directory."""
        if path == "/" or path == "":
            path = "/index.html"

        file_path = os.path.join(self.static_dir, path.lstrip("/"))

        if not os.path.isfile(file_path):
            # SPA fallback
            file_path = os.path.join(self.static_dir, "index.html")

        if not os.path.isfile(file_path):
            self._send_error(404, "Not found")
            return

        content_types = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".map": "application/json",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
        }

        ext = os.path.splitext(file_path)[1]
        content_type = content_types.get(ext, "application/octet-stream")

        with open(file_path, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
