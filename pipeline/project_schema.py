from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class BeatMode(str, Enum):
    INFOGRAPHIC = "infographic"
    ANIMATION = "animation"
    HYBRID = "hybrid"


class AssetStatus(str, Enum):
    NOT_REQUESTED = "not_requested"
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


class AssetRef(BaseModel):
    path: str
    kind: str


class BeatAssets(BaseModel):
    status: AssetStatus = AssetStatus.NOT_REQUESTED
    sora_job_id: str | None = None
    prompt: str = ""
    reference_image: AssetRef | None = None
    video_asset: AssetRef | None = None
    thumbnail_asset: AssetRef | None = None
    spritesheet_asset: AssetRef | None = None
    mask_asset: AssetRef | None = None
    cutout_asset: AssetRef | None = None
    last_error: str | None = None


class TopicInfo(BaseModel):
    title: str = ""
    summary: str = ""
    source: str = "user_input"
    why_picked: str = ""


class BeatRecord(BaseModel):
    id: str
    index: int = Field(ge=1)
    title: str
    mode: BeatMode = BeatMode.INFOGRAPHIC
    narration_segment: str
    duration_seconds: float | None = None
    theme: str
    overlay_enabled: bool = True
    cutout_enabled: bool = False
    scene_template: str | None = None
    infographic_scene: dict | None = None
    render_scene_override: dict | None = None
    timing: dict | None = None
    assets: BeatAssets = Field(default_factory=BeatAssets)


class ProjectOutputs(BaseModel):
    topic_path: str | None = None
    raw_script_path: str | None = None
    spoken_script_path: str | None = None
    narration_audio_path: str | None = None
    narration_timing_path: str | None = None
    word_timings_path: str | None = None
    params_path: str | None = None
    scene_plan_path: str | None = None
    remotion_props_path: str | None = None
    video_path: str | None = None


class ProjectRecord(BaseModel):
    schema_version: str = "phase2.project.v1"
    project_id: str
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)
    topic: TopicInfo = Field(default_factory=TopicInfo)
    theme_name: str
    raw_script: dict = Field(default_factory=dict)
    spoken_script: dict = Field(default_factory=dict)
    beats: list[BeatRecord] = Field(default_factory=list)
    outputs: ProjectOutputs = Field(default_factory=ProjectOutputs)
