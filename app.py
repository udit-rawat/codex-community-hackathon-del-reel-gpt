from __future__ import annotations

import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from dotenv import load_dotenv

from pipeline.project_context import read_project_context, write_project_context
from pipeline.project_store import (
    duplicate_project,
    ensure_project,
    get_current_project_id,
    list_projects,
    load_current_project,
    load_project,
    set_current_project,
    update_beats,
)
from pipeline.theme_config import THEMES, normalize_theme_name, read_theme_selection
from pipeline.theme_config import read_custom_theme, write_custom_theme
from pipeline.model_config import MODELS, apply_to_env, read_model_config, write_model_config

ROOT = os.path.dirname(__file__)
WEB_DIR = os.path.join(ROOT, "web")
OUTPUT_DIR = os.path.join(ROOT, "output")
PROJECTS_DIR = os.path.join(ROOT, "projects")
PROJECT_CONTEXT_PATH = os.path.join(OUTPUT_DIR, "project_context.json")
APP_BOOT_TS = time.time()

load_dotenv()

# Warn early if API key is missing so the error surfaces at boot, not mid-run.
if not os.environ.get("OPENAI_API_KEY", "").strip():
    print("[ui] WARNING: OPENAI_API_KEY is not set. Pipeline runs will fail.", flush=True)

# Apply persisted model config so subprocesses inherit the right model env vars.
apply_to_env(read_model_config())

RUN_LOCK = threading.Lock()
RUN_JOB = {
    "session_id": None,
    "active": False,
    "kind": "",
    "stages": [],
    "current_stage": None,
    "failed_stage": None,
    "completed": False,
    "success": False,
    "log": "",
    "started_at": None,
    "ended_at": None,
    "stage_progress": {},
}
RUN_HISTORY_LIMIT = 12
RUN_SESSIONS: list[dict] = []
RUN_SEQUENCE = 0


def _read_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _is_fresh_file(path: str) -> bool:
    if not os.path.exists(path):
        return False
    return os.path.getmtime(path) >= APP_BOOT_TS


def _file_url(path: str) -> str | None:
    if not os.path.exists(path):
        return None
    stamp = int(os.path.getmtime(path))
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    return f"/{rel}?v={stamp}"


def _load_state() -> dict:
    topic_path = os.path.join(OUTPUT_DIR, "topic.json")
    spoken_script_path = os.path.join(OUTPUT_DIR, "spoken_narration.json")
    raw_script_path = os.path.join(OUTPUT_DIR, "script.json")
    word_timings_path = os.path.join(OUTPUT_DIR, "word_timings.json")
    video_path = os.path.join(OUTPUT_DIR, "video.mp4")
    pipeline_log_path = os.path.join(OUTPUT_DIR, "pipeline.log")

    # Always restore the last active project on page load / server restart.
    # Only topic/script/video outputs require fresh-file checks (they're ephemeral).
    context = read_project_context()
    context_project_id = str(context.get("project_id", "")).strip()
    project = load_project(context_project_id) if context_project_id else None
    if project is None:
        project = load_current_project()
    if project is None:
        fallback_project_id = get_current_project_id()
        if fallback_project_id:
            project = load_project(fallback_project_id)

    topic = _read_json(topic_path, {}) if _is_fresh_file(topic_path) else {}
    script = _read_json(spoken_script_path, {}) if _is_fresh_file(spoken_script_path) else {}
    raw_script = _read_json(raw_script_path, {}) if _is_fresh_file(raw_script_path) else {}
    word_timings = _read_json(word_timings_path, []) if _is_fresh_file(word_timings_path) else []
    return {
        "projectId": project.project_id if project else None,
        "project": project.model_dump() if project else None,
        "projects": list_projects(),
        "topic": topic,
        "script": script,
        "rawScript": raw_script,
        "theme": read_theme_selection(),
        "customTheme": read_custom_theme(),
        "themes": THEMES,
        "videoUrl": _file_url(video_path) if _is_fresh_file(video_path) else None,
        "pipelineLogUrl": _file_url(pipeline_log_path) if _is_fresh_file(pipeline_log_path) else None,
        "hasWordTimings": bool(word_timings),
        "modelConfig": read_model_config(),
        "models": MODELS,
        "costConfig": {
            "textModel": os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-nano").strip() or "gpt-4.1-nano",
            "ttsModel": os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts").strip() or "gpt-4o-mini-tts",
            "videoModel": os.environ.get("OPENAI_VIDEO_MODEL", "sora-2-pro").strip() or "sora-2-pro",
            "videoSize": os.environ.get("OPENAI_VIDEO_SIZE", "1024x1792").strip() or "1024x1792",
        },
    }


def _truncate_log(lines: list[str]) -> str:
    return "\n".join(lines)[-16000:]


def _next_task(job: dict) -> str:
    kind = str(job.get("kind") or "")
    active = bool(job.get("active"))
    completed = bool(job.get("completed"))
    success = bool(job.get("success"))
    failed_stage = job.get("failed_stage")
    current_stage = job.get("current_stage")
    stages = list(job.get("stages") or [])

    if active:
        if current_stage and current_stage in stages:
            index = stages.index(current_stage)
            if index + 1 < len(stages):
                return f"Finish {current_stage}, then run {stages[index + 1]}."
            return f"Finish {current_stage} to complete this run."
        return "Pipeline running. Wait for current stage to complete."

    if completed and not success:
        if failed_stage:
            return f"Inspect logs for {failed_stage}, fix, then rerun."
        return "Inspect logs, fix failure, then rerun."

    if completed and success:
        if kind == "generate-script":
            return "Review narration, choose motion scenes, then generate motion assets."
        if kind == "generate-beat-assets":
            return "Render video using ready motion scenes."
        if kind == "render":
            return "Review output/video.mp4, then iterate narration or scenes."
        return "Run the next pipeline task."

    return "Start a pipeline run."


def _stage_states(job: dict) -> list[dict]:
    stages = job.get("stages") or []
    current_stage = job.get("current_stage")
    failed_stage = job.get("failed_stage")
    completed = bool(job.get("completed"))
    success = bool(job.get("success"))
    stage_progress = job.get("stage_progress") or {}

    states: list[dict] = []
    if not stages:
        return states

    current_index = stages.index(current_stage) if current_stage in stages else -1
    failed_index = stages.index(failed_stage) if failed_stage in stages else -1

    for index, stage in enumerate(stages):
        status = "pending"
        if completed and success:
            status = "complete"
        elif failed_index >= 0:
            if index < failed_index:
                status = "complete"
            elif index == failed_index:
                status = "failed"
        elif current_index >= 0:
            if index < current_index:
                status = "complete"
            elif index == current_index:
                status = "active"
        elif job.get("active") and index == 0:
            status = "active"
        if status == "complete":
            progress = 100
        elif status == "active":
            progress = max(0, min(99, int(float(stage_progress.get(stage, 0) or 0))))
        elif status == "failed":
            progress = max(0, min(99, int(float(stage_progress.get(stage, 0) or 0))))
        else:
            progress = 0
        states.append({"name": stage, "status": status, "progress": progress})

    return states


def _job_payload() -> dict:
    with RUN_LOCK:
        job = dict(RUN_JOB)

    return _build_job_payload(job)


def _build_job_payload(job: dict) -> dict:
    stage_states = _stage_states(job)
    if not stage_states:
        progress = 0
    elif job.get("completed") and job.get("success"):
        progress = 100
    else:
        progress = round(sum(int(stage.get("progress") or 0) for stage in stage_states) / len(stage_states))
        if any(stage["status"] == "active" for stage in stage_states):
            progress = min(99, progress)

    return {
        "sessionId": job.get("session_id"),
        "active": bool(job.get("active")),
        "kind": job.get("kind") or "",
        "currentStage": job.get("current_stage"),
        "failedStage": job.get("failed_stage"),
        "completed": bool(job.get("completed")),
        "success": bool(job.get("success")),
        "log": job.get("log") or "",
        "progress": progress,
        "stageStates": stage_states,
        "nextTask": _next_task(job),
        "startedAt": job.get("started_at"),
        "endedAt": job.get("ended_at"),
    }


def _job_sessions_payload() -> list[dict]:
    with RUN_LOCK:
        sessions = [dict(session) for session in RUN_SESSIONS]
    sessions.reverse()
    return [_build_job_payload(session) for session in sessions]


def _payload() -> dict:
    state = _load_state()
    state["job"] = _job_payload()
    state["jobSessions"] = _job_sessions_payload()
    if state["job"]["log"]:
        state["log"] = state["job"]["log"]
    return state


def _run_pipeline_job(kind: str, args: list[str], stages: list[str]) -> None:
    lines: list[str] = []
    process = subprocess.Popen(
        [sys.executable, "run.py", *args],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    assert process.stdout is not None
    for raw_line in process.stdout:
        line = raw_line.rstrip("\n")
        lines.append(line)
        update = {"log": _truncate_log(lines)}
        if "Stage START:" in line:
            stage_name = line.split("Stage START:", 1)[1].strip()
            update["current_stage"] = stage_name
            with RUN_LOCK:
                progress_map = dict(RUN_JOB.get("stage_progress") or {})
            progress_map.setdefault(stage_name, 0)
            update["stage_progress"] = progress_map
        progress_match = re.search(r"Stage PROGRESS:\s*([A-Za-z0-9_-]+)\s+([0-9]+(?:\.[0-9]+)?)", line)
        if progress_match:
            stage_name = progress_match.group(1)
            progress_value = max(0, min(100, float(progress_match.group(2))))
            with RUN_LOCK:
                progress_map = dict(RUN_JOB.get("stage_progress") or {})
            progress_map[stage_name] = max(progress_value, float(progress_map.get(stage_name, 0) or 0))
            update["stage_progress"] = progress_map
        with RUN_LOCK:
            RUN_JOB.update(update)
            for session in RUN_SESSIONS:
                if session.get("session_id") == RUN_JOB.get("session_id"):
                    session.update(update)
                    break

    returncode = process.wait()
    with RUN_LOCK:
        RUN_JOB["active"] = False
        RUN_JOB["completed"] = True
        RUN_JOB["success"] = returncode == 0
        RUN_JOB["log"] = _truncate_log(lines)
        RUN_JOB["ended_at"] = int(time.time())
        if returncode == 0:
            RUN_JOB["stage_progress"] = {stage: 100 for stage in RUN_JOB.get("stages") or []}
        if returncode != 0:
            RUN_JOB["failed_stage"] = RUN_JOB.get("current_stage")
        RUN_JOB["current_stage"] = None if returncode == 0 else RUN_JOB.get("current_stage")
        for session in RUN_SESSIONS:
            if session.get("session_id") == RUN_JOB.get("session_id"):
                session.update(RUN_JOB)
                break


def _start_pipeline_job(kind: str, args: list[str], stages: list[str]) -> dict:
    global RUN_SEQUENCE

    with RUN_LOCK:
        if RUN_JOB.get("active"):
            raise RuntimeError("Another pipeline job is already running.")
        RUN_SEQUENCE += 1
        session_id = f"run-{int(time.time())}-{RUN_SEQUENCE}"
        RUN_JOB.update({
            "session_id": session_id,
            "active": True,
            "kind": kind,
            "stages": stages,
            "current_stage": stages[0] if stages else None,
            "failed_stage": None,
            "completed": False,
            "success": False,
            "log": "",
            "started_at": int(time.time()),
            "ended_at": None,
            "stage_progress": {stage: 0 for stage in stages},
        })
        RUN_SESSIONS.append(dict(RUN_JOB))
        if len(RUN_SESSIONS) > RUN_HISTORY_LIMIT:
            del RUN_SESSIONS[:-RUN_HISTORY_LIMIT]

    worker = threading.Thread(
        target=_run_pipeline_job,
        args=(kind, args, stages),
        daemon=True,
    )
    worker.start()
    return _payload()


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
    server_version = "ReelGPTStudio/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, path: str, *, download_name: str | None = None) -> None:
        if not os.path.exists(path) or not os.path.isfile(path):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return
        size = os.path.getsize(path)
        if size == 0:
            self.send_error(HTTPStatus.NOT_FOUND, "File is empty")
            return
        with open(path, "rb") as f:
            data = f.read()
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        if download_name:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()
        self.wfile.write(data)

    def _parse_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 10 * 1024 * 1024:
            raise ValueError("Request body exceeds 10MB limit")
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
            return self._send_json(HTTPStatus.OK, _payload())
        if path == "/api/run-status":
            return self._send_json(HTTPStatus.OK, _payload())
        if path == "/api/projects":
            return self._send_json(HTTPStatus.OK, {"projects": list_projects()})
        if path == "/api/video-ready":
            video_path = os.path.join(OUTPUT_DIR, "video.mp4")
            ready = os.path.exists(video_path) and os.path.getsize(video_path) > 0
            return self._send_json(HTTPStatus.OK, {"ready": ready})
        if path.startswith("/output/"):
            target = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
            if os.path.commonpath([OUTPUT_DIR, target]) != OUTPUT_DIR:
                return self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            download_name = "reel-output.mp4" if target.endswith(".mp4") else None
            return self._send_file(target, download_name=download_name)
        if path.startswith("/projects/"):
            target = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
            if os.path.commonpath([PROJECTS_DIR, target]) != PROJECTS_DIR:
                return self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return self._send_file(target)

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            body = self._parse_body()
        except ValueError as e:
            return self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": str(e)})
        except Exception as e:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": f"Invalid request body: {e}"})

        if parsed.path == "/api/generate-script":
            project_id = str(body.get("projectId", "")).strip()
            title = str(body.get("title", "")).strip()
            summary = str(body.get("summary", "")).strip()
            theme = normalize_theme_name(body.get("theme"))
            if not title:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "title required"})
            if project_id:
                existing = load_project(project_id)
                existing_title = (existing.topic.title if existing else "").strip() if existing else ""
                if existing is None or existing_title != title:
                    # Title change implies a fresh lifecycle project.
                    project_id = ""

            try:
                payload = _start_pipeline_job(
                    "generate-script",
                    [
                        "--stage", "content_generator",
                        "--title", title,
                        "--summary", summary,
                        "--theme", theme,
                        *(["--project-id", project_id] if project_id else []),
                    ],
                    ["content_generator"],
                )
            except RuntimeError as e:
                return self._send_json(HTTPStatus.CONFLICT, {"error": str(e), **_payload()})
            return self._send_json(HTTPStatus.ACCEPTED, payload)

        if parsed.path == "/api/new-project":
            title = str(body.get("title", "")).strip() or "project"
            summary = str(body.get("summary", "")).strip()
            theme = normalize_theme_name(body.get("theme"))
            try:
                project = ensure_project(
                    title=title,
                    summary=summary,
                    theme=theme,
                )
                write_project_context(
                    project.project_id,
                    title=project.topic.title,
                    summary=project.topic.summary,
                    theme=project.theme_name,
                )
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})
            return self._send_json(HTTPStatus.OK, _payload())

        if parsed.path == "/api/duplicate-project":
            source_project_id = str(body.get("sourceProjectId", "")).strip()
            if not source_project_id:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "sourceProjectId required"})
            title = str(body.get("title", "")).strip()
            summary = str(body.get("summary", "")).strip()
            theme = normalize_theme_name(body.get("theme"))
            try:
                project = duplicate_project(
                    source_project_id,
                    title=title,
                    summary=summary,
                    theme=theme,
                )
                write_project_context(
                    project.project_id,
                    title=project.topic.title,
                    summary=project.topic.summary,
                    theme=project.theme_name,
                )
            except RuntimeError as e:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(e)})
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})
            return self._send_json(HTTPStatus.OK, _payload())

        if parsed.path == "/api/load-project":
            project_id = str(body.get("projectId", "")).strip()
            if not project_id:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "projectId required"})
            project = load_project(project_id)
            if project is None:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": f"Project not found: {project_id}"})
            set_current_project(project.project_id)
            write_project_context(
                project.project_id,
                title=project.topic.title,
                summary=project.topic.summary,
                theme=project.theme_name,
            )
            return self._send_json(HTTPStatus.OK, _payload())

        if parsed.path == "/api/model-config":
            config = body.get("modelConfig")
            if not isinstance(config, dict):
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "modelConfig object required"})
            try:
                saved = write_model_config(config)
                apply_to_env(saved)
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})
            return self._send_json(HTTPStatus.OK, _payload())

        if parsed.path == "/api/custom-theme":
            custom_theme = body.get("customTheme")
            if not isinstance(custom_theme, dict):
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "customTheme object required"})
            try:
                write_custom_theme(custom_theme)
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})
            return self._send_json(HTTPStatus.OK, _payload())

        if parsed.path == "/api/render":
            project_id = str(body.get("projectId", "")).strip()
            title = str(body.get("title", "")).strip()
            summary = str(body.get("summary", "")).strip()
            theme = normalize_theme_name(body.get("theme"))
            custom_theme = body.get("customTheme")
            script = body.get("script") or {}
            beat_updates = body.get("beats") or []
            if not title:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "title required"})
            if custom_theme is not None and not isinstance(custom_theme, dict):
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "customTheme object required"})
            if beat_updates and not isinstance(beat_updates, list):
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "beats must be a list"})

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

            try:
                if isinstance(custom_theme, dict):
                    write_custom_theme(custom_theme)
                if project_id and beat_updates:
                    update_beats(project_id, beat_updates)
                payload = _start_pipeline_job(
                    "render",
                    [
                        "--title", title,
                        "--summary", summary,
                        "--theme", theme,
                        *(["--project-id", project_id] if project_id else []),
                        "--narration", json.dumps(narration),
                    ],
                    ["content_generator", "narrator", "word_aligner", "animator"],
                )
            except RuntimeError as e:
                return self._send_json(HTTPStatus.CONFLICT, {"error": str(e), **_payload()})
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e), **_payload()})
            return self._send_json(HTTPStatus.ACCEPTED, payload)

        if parsed.path == "/api/project-beats":
            project_id = str(body.get("projectId", "")).strip()
            beat_updates = body.get("beats")
            if not project_id:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "projectId required"})
            if not isinstance(beat_updates, list):
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "beats must be a list"})

            try:
                update_beats(project_id, beat_updates)
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})

            return self._send_json(HTTPStatus.OK, _payload())

        if parsed.path == "/api/generate-beat-assets":
            project_id = str(body.get("projectId", "")).strip()
            beat_updates = body.get("beats") or []
            beat_id = str(body.get("beatId", "")).strip()
            if not project_id:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "projectId required"})
            if beat_updates and not isinstance(beat_updates, list):
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "beats must be a list"})

            try:
                if beat_updates:
                    update_beats(project_id, beat_updates)
            except Exception as e:
                return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})

            try:
                payload = _start_pipeline_job(
                    "generate-beat-assets",
                    [
                        "--stage", "sora_generator",
                        "--project-id", project_id,
                        *(["--beat-id", beat_id] if beat_id else []),
                    ],
                    ["sora_generator"],
                )
            except RuntimeError as e:
                return self._send_json(HTTPStatus.CONFLICT, {"error": str(e), **_payload()})
            return self._send_json(HTTPStatus.ACCEPTED, payload)

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")


def main() -> None:
    host = "127.0.0.1"
    port = int(os.environ.get("REELGPT_UI_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"[ui] ReelGPT Studio on http://{host}:{port}")
    print("[ui] Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[ui] stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
