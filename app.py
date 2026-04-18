from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from pipeline.theme_config import THEMES, normalize_theme_name, read_theme_selection

ROOT = os.path.dirname(__file__)
WEB_DIR = os.path.join(ROOT, "web")
OUTPUT_DIR = os.path.join(ROOT, "output")


def _read_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _file_url(path: str) -> str | None:
    if not os.path.exists(path):
        return None
    stamp = int(os.path.getmtime(path))
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    return f"/{rel}?v={stamp}"


def _load_state() -> dict:
    topic = _read_json(os.path.join(OUTPUT_DIR, "topic.json"), {})
    script = _read_json(os.path.join(OUTPUT_DIR, "spoken_narration.json"), {})
    raw_script = _read_json(os.path.join(OUTPUT_DIR, "script.json"), {})
    word_timings = _read_json(os.path.join(OUTPUT_DIR, "word_timings.json"), [])
    return {
        "topic": topic,
        "script": script,
        "rawScript": raw_script,
        "theme": read_theme_selection(),
        "themes": THEMES,
        "videoUrl": _file_url(os.path.join(OUTPUT_DIR, "video.mp4")),
        "pipelineLogUrl": _file_url(os.path.join(OUTPUT_DIR, "pipeline.log")),
        "hasWordTimings": bool(word_timings),
    }


def _run_pipeline(args: list[str]) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, "run.py", *args],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=1800,
    )
    return result.returncode, result.stdout[-16000:]


class AppHandler(BaseHTTPRequestHandler):
    server_version = "ReelGPTPhase1/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, path: str) -> None:
        if not os.path.exists(path) or not os.path.isfile(path):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return
        with open(path, "rb") as f:
            data = f.read()
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _parse_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            return self._send_file(os.path.join(WEB_DIR, "index.html"))
        if path in {"/app.js", "/styles.css"}:
            return self._send_file(os.path.join(WEB_DIR, path.lstrip("/")))
        if path == "/api/state":
            return self._send_json(HTTPStatus.OK, _load_state())
        if path.startswith("/output/"):
            target = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
            if os.path.commonpath([OUTPUT_DIR, target]) != OUTPUT_DIR:
                return self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return self._send_file(target)

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        body = self._parse_body()

        if parsed.path == "/api/generate-script":
            title = str(body.get("title", "")).strip()
            summary = str(body.get("summary", "")).strip()
            theme = normalize_theme_name(body.get("theme"))
            if not title:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "title required"})

            code, log = _run_pipeline([
                "--stage", "content_generator",
                "--title", title,
                "--summary", summary,
                "--theme", theme,
            ])
            state = _load_state()
            state["log"] = log
            if code != 0:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, state)
            return self._send_json(HTTPStatus.OK, state)

        if parsed.path == "/api/render":
            title = str(body.get("title", "")).strip()
            summary = str(body.get("summary", "")).strip()
            theme = normalize_theme_name(body.get("theme"))
            script = body.get("script") or {}
            if not title:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "title required"})

            narration = {
                "hook": str(script.get("hook", "")).strip(),
                "concept_1": str(script.get("concept_1", "")).strip(),
                "concept_2": str(script.get("concept_2", "")).strip(),
                "takeaway_cta": str(script.get("takeaway_cta", "")).strip(),
            }

            if not narration["hook"] or not narration["concept_1"] or not narration["takeaway_cta"]:
                return self._send_json(
                    HTTPStatus.BAD_REQUEST,
                    {"error": "hook, concept_1, and takeaway_cta required"},
                )

            code, log = _run_pipeline([
                "--title", title,
                "--summary", summary,
                "--theme", theme,
                "--narration", json.dumps(narration),
            ])
            state = _load_state()
            state["log"] = log
            if code != 0:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, state)
            return self._send_json(HTTPStatus.OK, state)

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")


def main() -> None:
    host = "127.0.0.1"
    port = int(os.environ.get("REELGPT_UI_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"[ui] ReelGPT Phase 1 UI on http://{host}:{port}")
    print("[ui] Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[ui] stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
