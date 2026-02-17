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
import uuid

from nanobot.session.manager import SessionManager, Session
from nanobot.agent.loop import AgentLoop
from nanobot.utils.helpers import safe_filename

# Built-in skills directory (read-only, cannot be modified or deleted)
BUILTIN_SKILLS_DIR = Path(__file__).parent.parent / "skills"

# In-memory storage for HTML preview content
_preview_store: dict[str, str] = {}


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
        elif path == "/api/skills":
            self._handle_list_skills()
        elif path == "/api/skills/get":
            self._handle_get_skill(qs)
        elif path.startswith("/api/preview/"):
            self._handle_serve_preview(path)
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
        elif path == "/api/log":
            self._handle_frontend_log()
        elif path == "/api/skills/create":
            self._handle_create_skill()
        elif path == "/api/skills/update":
            self._handle_update_skill()
        elif path == "/api/skills/delete":
            self._handle_delete_skill()
        elif path == "/api/preview":
            self._handle_store_preview()
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

    def _handle_frontend_log(self) -> None:
        """POST /api/log — receive log entries from the frontend."""
        body = self._parse_json_body()
        if not body:
            self._send_json({"ok": True})
            return

        entries = body.get("entries", [])
        for entry in entries:
            level = entry.get("level", "info").lower()
            tag = entry.get("tag", "frontend")
            message = entry.get("message", "")
            log_msg = f"[frontend:{tag}] {message}"

            if level == "debug":
                logger.debug(log_msg)
            elif level == "warn":
                logger.warning(log_msg)
            elif level == "error":
                logger.error(log_msg)
            else:
                logger.info(log_msg)

        self._send_json({"ok": True})

    # ------------------------------------------------------------------
    # Skills API handlers
    # ------------------------------------------------------------------

    def _handle_list_skills(self) -> None:
        """GET /api/skills — list all skills."""
        skills = []

        if BUILTIN_SKILLS_DIR.exists():
            for skill_dir in sorted(BUILTIN_SKILLS_DIR.iterdir()):
                if skill_dir.is_dir():
                    skill_file = skill_dir / "SKILL.md"
                    if skill_file.exists():
                        meta = self._parse_skill_frontmatter(skill_file)
                        skills.append({
                            "name": skill_dir.name,
                            "description": meta.get("description", ""),
                            "source": "local",
                            "readonly": False,
                        })

        logger.info(f"[web] List skills: {len(skills)} total")
        self._send_json({"skills": skills})

    def _handle_get_skill(self, qs: dict) -> None:
        """GET /api/skills/get?name=weather — get skill content."""
        name_list = qs.get("name", [])
        if not name_list or not name_list[0]:
            self._send_error(400, "name is required")
            return

        name = name_list[0]
        skill_file = BUILTIN_SKILLS_DIR / name / "SKILL.md"
        if not skill_file.exists():
            self._send_error(404, f"Skill '{name}' not found")
            return

        content = skill_file.read_text(encoding="utf-8")
        logger.info(f"[web] Get skill: name={name}")
        self._send_json({
            "name": name,
            "content": content,
            "source": "local",
            "readonly": False,
        })

    def _handle_create_skill(self) -> None:
        """POST /api/skills/create — create a new skill."""
        body = self._parse_json_body()
        if not body:
            self._send_error(400, "Invalid JSON body")
            return

        name = body.get("name", "").strip()
        content = body.get("content", "").strip()

        if not name or not content:
            self._send_error(400, "name and content are required")
            return

        if not re.match(r"^[a-z0-9][a-z0-9-]*$", name):
            self._send_error(400, "Skill name must be lowercase letters, digits, and hyphens only")
            return

        skill_dir = BUILTIN_SKILLS_DIR / name
        if skill_dir.exists() and (skill_dir / "SKILL.md").exists():
            self._send_error(409, f"Skill '{name}' already exists")
            return

        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")

        logger.info(f"[web] Created skill: {name}")
        self._send_json({"ok": True, "name": name})

    def _handle_update_skill(self) -> None:
        """POST /api/skills/update — update a skill's content."""
        body = self._parse_json_body()
        if not body:
            self._send_error(400, "Invalid JSON body")
            return

        name = body.get("name", "").strip()
        content = body.get("content", "").strip()

        if not name or not content:
            self._send_error(400, "name and content are required")
            return

        skill_file = BUILTIN_SKILLS_DIR / name / "SKILL.md"
        if not skill_file.exists():
            self._send_error(404, f"Skill '{name}' not found")
            return

        skill_file.write_text(content, encoding="utf-8")
        logger.info(f"[web] Updated skill: {name}")
        self._send_json({"ok": True, "name": name})

    def _handle_delete_skill(self) -> None:
        """POST /api/skills/delete — delete a skill."""
        body = self._parse_json_body()
        if not body:
            self._send_error(400, "Invalid JSON body")
            return

        name = body.get("name", "").strip()
        if not name:
            self._send_error(400, "name is required")
            return

        skill_dir = BUILTIN_SKILLS_DIR / name
        if not skill_dir.exists():
            self._send_error(404, f"Skill '{name}' not found")
            return

        import shutil
        shutil.rmtree(skill_dir)
        logger.info(f"[web] Deleted skill: {name}")
        self._send_json({"ok": True})

    def _parse_skill_frontmatter(self, path: Path) -> dict:
        """Parse YAML frontmatter from a SKILL.md file."""
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            return {}

        if not text.startswith("---"):
            return {}

        import re as _re
        match = _re.match(r"^---\n(.*?)\n---", text, _re.DOTALL)
        if not match:
            return {}

        metadata = {}
        for line in match.group(1).split("\n"):
            if ":" in line:
                key, value = line.split(":", 1)
                metadata[key.strip()] = value.strip().strip("\"'")
        return metadata

    def _handle_store_preview(self) -> None:
        """Store HTML content for preview and return an ID."""
        body = self._parse_json_body()
        if not body or "html" not in body:
            self._send_error(400, "Missing 'html' field")
            return

        preview_id = uuid.uuid4().hex[:12]
        _preview_store[preview_id] = body["html"]
        self._send_json({"id": preview_id})

    def _handle_serve_preview(self, path: str) -> None:
        """Serve stored HTML content as a full page."""
        # path is like /api/preview/<id>
        preview_id = path.split("/")[-1]
        html = _preview_store.get(preview_id)
        if not html:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Preview not found")
            return

        encoded = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(encoded)


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
