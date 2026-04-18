from __future__ import annotations

import copy
import json
import os
import re
from datetime import datetime, timezone

from pipeline.project_schema import (
    AssetStatus,
    BeatAssets,
    BeatMode,
    BeatRecord,
    ProjectOutputs,
    ProjectRecord,
    TopicInfo,
)
from pipeline.theme_config import DEFAULT_THEME, normalize_theme_name

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUTPUT_DIR = os.path.join(ROOT, "output")
PROJECTS_DIR = os.path.join(ROOT, "projects")
CURRENT_PROJECT_PATH = os.path.join(PROJECTS_DIR, "current_project.json")

TOPIC_PATH = os.path.join(OUTPUT_DIR, "topic.json")
RAW_SCRIPT_PATH = os.path.join(OUTPUT_DIR, "script.json")
SPOKEN_SCRIPT_PATH = os.path.join(OUTPUT_DIR, "spoken_narration.json")
NARRATION_AUDIO_PATH = os.path.join(OUTPUT_DIR, "narration.wav")
NARRATION_TIMING_PATH = os.path.join(OUTPUT_DIR, "narration_timing.json")
WORD_TIMINGS_PATH = os.path.join(OUTPUT_DIR, "word_timings.json")
PARAMS_PATH = os.path.join(OUTPUT_DIR, "params.json")
SCENE_PLAN_PATH = os.path.join(OUTPUT_DIR, "scene_plan.json")
REMOTION_PROPS_PATH = os.path.join(OUTPUT_DIR, "remotion_props.json")
VIDEO_PATH = os.path.join(OUTPUT_DIR, "video.mp4")
THEME_PATH = os.path.join(OUTPUT_DIR, "theme.json")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _read_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _slugify(text: str) -> str:
    words = re.findall(r"[a-z0-9]+", str(text).lower())
    slug = "-".join(words[:6]).strip("-")
    return slug or "project"


def create_project_id(title: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{_slugify(title)}-{stamp}"


def get_project_dir(project_id: str) -> str:
    return os.path.join(PROJECTS_DIR, project_id)


def get_project_path(project_id: str) -> str:
    return os.path.join(get_project_dir(project_id), "project.json")


def set_current_project(project_id: str) -> None:
    _write_json(CURRENT_PROJECT_PATH, {"project_id": project_id})


def get_current_project_id() -> str | None:
    data = _read_json(CURRENT_PROJECT_PATH, {})
    project_id = data.get("project_id")
    if isinstance(project_id, str) and project_id.strip():
        return project_id
    return None


def load_project(project_id: str) -> ProjectRecord | None:
    path = get_project_path(project_id)
    if not os.path.exists(path):
        return None
    return ProjectRecord.model_validate(_read_json(path, {}))


def load_current_project() -> ProjectRecord | None:
    project_id = get_current_project_id()
    if not project_id:
        return None
    return load_project(project_id)


def save_project(project: ProjectRecord) -> ProjectRecord:
    project.updated_at = _utc_now_iso()
    _write_json(get_project_path(project.project_id), project.model_dump())
    set_current_project(project.project_id)
    return project


def list_projects() -> list[dict]:
    if not os.path.exists(PROJECTS_DIR):
        return []

    projects: list[dict] = []
    for entry in os.listdir(PROJECTS_DIR):
        project_path = os.path.join(PROJECTS_DIR, entry, "project.json")
        if not os.path.exists(project_path):
            continue
        try:
            project = load_project(entry)
            if project is None:
                continue
            projects.append({
                "project_id": project.project_id,
                "title": project.topic.title,
                "summary": project.topic.summary,
                "theme_name": project.theme_name,
                "updated_at": project.updated_at,
                "created_at": project.created_at,
                "beat_count": len(project.beats),
            })
        except Exception:
            continue

    projects.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
    return projects


def duplicate_project(
    source_project_id: str,
    *,
    title: str = "",
    summary: str = "",
    theme: str | None = None,
) -> ProjectRecord:
    source = load_project(source_project_id)
    if source is None:
        raise RuntimeError(f"Project not found: {source_project_id}")

    base_title = title.strip() or source.topic.title or f"{source_project_id} copy"
    new_project_id = create_project_id(base_title)
    clone_payload = copy.deepcopy(source.model_dump())
    clone_payload["project_id"] = new_project_id
    clone_payload["created_at"] = _utc_now_iso()
    clone_payload["updated_at"] = clone_payload["created_at"]
    clone = ProjectRecord.model_validate(clone_payload)

    clone.topic.title = base_title
    clone.topic.summary = summary.strip() or source.topic.summary
    clone.theme_name = normalize_theme_name(theme or source.theme_name)
    return save_project(clone)


def ensure_project(
    title: str = "",
    summary: str = "",
    theme: str | None = None,
    requested_id: str | None = None,
) -> ProjectRecord:
    project = load_project(requested_id) if requested_id else None
    if project is None:
        project_id = requested_id or create_project_id(title or "project")
        project = ProjectRecord(
            project_id=project_id,
            topic=TopicInfo(title=title, summary=summary, source="user_input", why_picked="Provided directly by the user."),
            theme_name=normalize_theme_name(theme),
        )
    else:
        if title:
            project.topic.title = title
        if summary:
            project.topic.summary = summary
        if theme:
            project.theme_name = normalize_theme_name(theme)
    return save_project(project)


def _relative_if_exists(path: str) -> str | None:
    if os.path.exists(path):
        return os.path.relpath(path, ROOT)
    return None


def _segment_name(index: int, total_beats: int) -> str:
    if index == 1:
        return "hook"
    if index == total_beats:
        return "takeaway_cta"
    return f"concept_{index - 1}"


def _beat_title(index: int, total_beats: int) -> str:
    if index == 1:
        return "Hook"
    if index == total_beats:
        return "Takeaway"
    return f"Concept {index - 1}"


def _merge_beat(existing: BeatRecord | None, *, beat_id: str, index: int, total_beats: int, theme_name: str, scene_payload: dict | None, timing_entry: dict | None) -> BeatRecord:
    assets = existing.assets if existing else BeatAssets()
    if assets.video_asset:
        assets.status = AssetStatus.READY
    mode = existing.mode if existing else BeatMode.INFOGRAPHIC
    return BeatRecord(
        id=beat_id,
        index=index,
        title=existing.title if existing else _beat_title(index, total_beats),
        mode=mode,
        narration_segment=existing.narration_segment if existing else _segment_name(index, total_beats),
        duration_seconds=timing_entry.get("duration") if isinstance(timing_entry, dict) else None,
        theme=existing.theme if existing else theme_name,
        overlay_enabled=existing.overlay_enabled if existing else True,
        cutout_enabled=existing.cutout_enabled if existing else False,
        scene_template=(scene_payload or {}).get("layout"),
        infographic_scene=scene_payload or existing.infographic_scene if existing else scene_payload,
        timing=timing_entry if isinstance(timing_entry, dict) else existing.timing if existing else None,
        assets=assets,
    )


def sync_project_from_outputs(
    project_id: str | None = None,
    title: str | None = None,
    summary: str | None = None,
    theme: str | None = None,
) -> ProjectRecord | None:
    current = load_project(project_id) if project_id else load_current_project()
    topic = _read_json(TOPIC_PATH, {})
    effective_title = title or topic.get("title", "")
    effective_summary = summary or topic.get("summary", "")
    if current is None and not effective_title:
        return None
    effective_theme = normalize_theme_name(theme or _read_json(THEME_PATH, {}).get("theme") or (current.theme_name if current else DEFAULT_THEME))

    project = current or ensure_project(
        title=effective_title,
        summary=effective_summary,
        theme=effective_theme,
        requested_id=project_id,
    )

    if effective_title:
        project.topic.title = effective_title
    if effective_summary:
        project.topic.summary = effective_summary
    if topic:
        project.topic = TopicInfo.model_validate({**project.topic.model_dump(), **topic})
    project.theme_name = effective_theme

    raw_script = _read_json(RAW_SCRIPT_PATH, {})
    spoken_script = _read_json(SPOKEN_SCRIPT_PATH, {})
    params = _read_json(PARAMS_PATH, {})
    timing = _read_json(NARRATION_TIMING_PATH, {})

    project.raw_script = raw_script
    project.spoken_script = spoken_script
    existing_by_id = {beat.id: beat for beat in project.beats}

    beat_keys = sorted(
        [key for key in params.keys() if key.startswith("beat_")],
        key=lambda key: int(key.split("_")[1]),
    )
    total_beats = len(beat_keys) or 4
    beats: list[BeatRecord] = []
    for key in beat_keys:
        index = int(key.split("_")[1])
        segment = _segment_name(index, total_beats)
        scene_payload = params.get(key, {}).get("data") if isinstance(params.get(key), dict) else None
        beat = _merge_beat(
            existing_by_id.get(key),
            beat_id=key,
            index=index,
            total_beats=total_beats,
            theme_name=effective_theme,
            scene_payload=scene_payload,
            timing_entry=timing.get(segment),
        )
        beats.append(beat)

    if beats:
        project.beats = beats

    project.outputs = ProjectOutputs(
        topic_path=_relative_if_exists(TOPIC_PATH),
        raw_script_path=_relative_if_exists(RAW_SCRIPT_PATH),
        spoken_script_path=_relative_if_exists(SPOKEN_SCRIPT_PATH),
        narration_audio_path=_relative_if_exists(NARRATION_AUDIO_PATH),
        narration_timing_path=_relative_if_exists(NARRATION_TIMING_PATH),
        word_timings_path=_relative_if_exists(WORD_TIMINGS_PATH),
        params_path=_relative_if_exists(PARAMS_PATH),
        scene_plan_path=_relative_if_exists(SCENE_PLAN_PATH),
        remotion_props_path=_relative_if_exists(REMOTION_PROPS_PATH),
        video_path=_relative_if_exists(VIDEO_PATH),
    )

    return save_project(project)


def update_beats(
    project_id: str,
    beat_updates: list[dict],
) -> ProjectRecord:
    project = load_project(project_id)
    if project is None:
        raise RuntimeError(f"Project not found: {project_id}")

    by_id = {beat.id: beat for beat in project.beats}
    for update in beat_updates:
        beat_id = str(update.get("id", "")).strip()
        beat = by_id.get(beat_id)
        if beat is None:
            continue

        mode = update.get("mode")
        switched_to_infographic = False
        if isinstance(mode, str) and mode in {m.value for m in BeatMode}:
            prev_mode = beat.mode
            beat.mode = BeatMode(mode)
            switched_to_infographic = (
                beat.mode == BeatMode.INFOGRAPHIC and prev_mode != BeatMode.INFOGRAPHIC
            )
            if beat.mode == BeatMode.INFOGRAPHIC:
                beat.assets.prompt = ""
                beat.assets.status = AssetStatus.NOT_REQUESTED
                beat.assets.sora_job_id = None
                beat.assets.video_asset = None
                beat.assets.thumbnail_asset = None
                beat.assets.spritesheet_asset = None
                beat.assets.mask_asset = None
                beat.assets.cutout_asset = None
                beat.assets.last_error = None

        prompt = update.get("prompt")
        if isinstance(prompt, str) and not switched_to_infographic and beat.mode != BeatMode.INFOGRAPHIC:
            next_prompt = prompt.strip()
            prompt_changed = next_prompt != beat.assets.prompt
            beat.assets.prompt = next_prompt
            if prompt_changed:
                beat.assets.sora_job_id = None
                beat.assets.video_asset = None
                beat.assets.thumbnail_asset = None
                beat.assets.spritesheet_asset = None
                beat.assets.mask_asset = None
                beat.assets.cutout_asset = None
                beat.assets.last_error = None
                if beat.mode != BeatMode.INFOGRAPHIC and beat.assets.prompt:
                    beat.assets.status = AssetStatus.PENDING
                else:
                    beat.assets.status = AssetStatus.NOT_REQUESTED
            elif beat.mode != BeatMode.INFOGRAPHIC and beat.assets.prompt and beat.assets.status == AssetStatus.NOT_REQUESTED:
                beat.assets.status = AssetStatus.PENDING
            elif (beat.mode == BeatMode.INFOGRAPHIC or not beat.assets.prompt) and beat.assets.status == AssetStatus.PENDING:
                beat.assets.status = AssetStatus.NOT_REQUESTED

        overlay_enabled = update.get("overlay_enabled")
        if isinstance(overlay_enabled, bool):
            beat.overlay_enabled = overlay_enabled

        cutout_enabled = update.get("cutout_enabled")
        if isinstance(cutout_enabled, bool):
            beat.cutout_enabled = cutout_enabled

    project.beats = [by_id[beat.id] for beat in project.beats]
    return save_project(project)
