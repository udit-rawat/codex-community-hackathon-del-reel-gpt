from __future__ import annotations

import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUTPUT_DIR = os.path.join(ROOT, "output")
PROJECT_CONTEXT_PATH = os.path.join(OUTPUT_DIR, "project_context.json")


def _read_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def read_project_context() -> dict:
    data = _read_json(PROJECT_CONTEXT_PATH, {})
    if not isinstance(data, dict):
        return {}
    return data


def write_project_context(
    project_id: str,
    *,
    title: str = "",
    summary: str = "",
    theme: str = "",
) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(PROJECT_CONTEXT_PATH, "w") as f:
        json.dump(
            {
                "project_id": project_id,
                "title": title,
                "summary": summary,
                "theme": theme,
            },
            f,
            indent=2,
        )
