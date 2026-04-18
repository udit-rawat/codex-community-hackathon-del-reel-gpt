from __future__ import annotations

import mimetypes
import os
import time

import requests

from pipeline.logger import get as get_log
from pipeline.project_schema import AssetRef, AssetStatus, BeatMode
from pipeline.project_store import get_current_project_id, get_project_dir, load_project, save_project

API_BASE = "https://api.openai.com/v1/videos"
DEFAULT_MODEL = "sora-2-pro"
DEFAULT_SIZE = "1024x1792"
ALLOWED_SECONDS = (4, 8, 12)
POLL_INTERVAL_SECONDS = 10
MAX_WAIT_SECONDS = 1200
ROOT = os.path.join(os.path.dirname(__file__), "..")


def _api_key() -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set.")
    return api_key


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_api_key()}"}


def _video_model() -> str:
    return os.environ.get("OPENAI_VIDEO_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _video_size() -> str:
    size = os.environ.get("OPENAI_VIDEO_SIZE", DEFAULT_SIZE).strip() or DEFAULT_SIZE
    if size not in {"720x1280", "1280x720", "1024x1792", "1792x1024"}:
        raise RuntimeError(f"Unsupported OPENAI_VIDEO_SIZE: {size}")
    return size


def _poll_interval() -> int:
    raw = os.environ.get("OPENAI_VIDEO_POLL_SECONDS", str(POLL_INTERVAL_SECONDS)).strip()
    return max(3, int(raw or POLL_INTERVAL_SECONDS))


def _max_wait() -> int:
    raw = os.environ.get("OPENAI_VIDEO_MAX_WAIT_SECONDS", str(MAX_WAIT_SECONDS)).strip()
    return max(60, int(raw or MAX_WAIT_SECONDS))


def _select_seconds(duration_seconds: float | None) -> str:
    if not duration_seconds:
        return "4"
    duration = float(duration_seconds)
    for allowed in ALLOWED_SECONDS:
        if allowed >= duration:
            return str(allowed)
    return str(max(ALLOWED_SECONDS))


def _relative_path(path: str) -> str:
    return os.path.relpath(path, ROOT)


def _resolve_local_path(path: str | None) -> str | None:
    if not path:
        return None
    if os.path.isabs(path):
        return path
    return os.path.join(ROOT, path)


def _beat_asset_dir(project_id: str, beat_id: str) -> str:
    return os.path.join(get_project_dir(project_id), "assets", beat_id)


def _motion_enabled(beat) -> bool:
    return beat.mode in {BeatMode.ANIMATION, BeatMode.HYBRID}


def _beat_prompt(beat) -> str:
    prompt = beat.assets.prompt.strip()
    if not prompt:
        raise RuntimeError(f"{beat.id} missing animation prompt.")

    guidance: list[str] = [
        "Generate silent footage only. No music, voiceover, ambient sound, or sound effects."
    ]
    if beat.overlay_enabled:
        guidance.append("Leave clear negative space for infographic overlays and captions.")
    if beat.cutout_enabled:
        guidance.append("Keep the main subject visually separated from the background for later cutout compositing.")
    if isinstance(beat.timing, dict):
        text = str(beat.timing.get("text", "")).strip()
        if text:
            guidance.append(f"Narration context: {text}")

    if guidance:
        return f"{prompt}\n\n" + " ".join(guidance)
    return prompt


def _create_video(prompt: str, *, seconds: str, size: str, reference_path: str | None) -> dict:
    multipart: dict[str, tuple[str | None, object, str] | tuple[None, str]] = {
        "model": (None, _video_model()),
        "prompt": (None, prompt),
        "seconds": (None, seconds),
        "size": (None, size),
    }
    file_handle = None
    if reference_path and os.path.exists(reference_path):
        mime = mimetypes.guess_type(reference_path)[0] or "application/octet-stream"
        file_handle = open(reference_path, "rb")
        multipart["input_reference"] = (
            os.path.basename(reference_path),
            file_handle,
            mime,
        )

    try:
        response = requests.post(
            API_BASE,
            headers=_headers(),
            files=multipart,
            timeout=600,
        )
    finally:
        if file_handle:
            file_handle.close()

    if response.status_code >= 400:
        raise RuntimeError(f"Sora create failed HTTP {response.status_code}: {response.text[:800]}")
    return response.json()


def _get_video(video_id: str) -> dict:
    response = requests.get(
        f"{API_BASE}/{video_id}",
        headers=_headers(),
        timeout=180,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Sora status failed HTTP {response.status_code}: {response.text[:800]}")
    return response.json()


def _wait_for_video(video_id: str) -> dict:
    deadline = time.time() + _max_wait()
    interval = _poll_interval()
    while time.time() < deadline:
        payload = _get_video(video_id)
        status = payload.get("status")
        progress = payload.get("progress")
        get_log().info(f"[sora_generator] {video_id} status={status} progress={progress}")
        try:
            progress_value = float(progress)
            print(f"Stage PROGRESS: sora_generator {max(0, min(100, progress_value)):.0f}", flush=True)
        except (TypeError, ValueError):
            pass
        if status == "completed":
            print("Stage PROGRESS: sora_generator 100", flush=True)
            return payload
        if status in {"failed", "canceled"}:
            error = payload.get("error") or payload.get("last_error") or payload
            raise RuntimeError(f"Sora video failed: {error}")
        time.sleep(interval)
    raise RuntimeError(f"Sora video timed out after {_max_wait()} seconds: {video_id}")


def _download_variant(video_id: str, *, variant: str, destination: str) -> None:
    params = {"variant": variant} if variant != "video" else None
    response = requests.get(
        f"{API_BASE}/{video_id}/content",
        headers=_headers(),
        params=params,
        stream=True,
        timeout=600,
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Sora download failed for {variant} HTTP {response.status_code}: {response.text[:800]}"
        )
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    with open(destination, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 64):
            if chunk:
                f.write(chunk)


def _mark_pending(project, beat) -> None:
    beat.assets.status = AssetStatus.PENDING
    beat.assets.last_error = None
    save_project(project)


def _mark_failed(project, beat, error: Exception) -> None:
    beat.assets.status = AssetStatus.FAILED
    beat.assets.last_error = str(error)[:1000]
    save_project(project)


def _mark_ready(project, beat, *, video_path: str, thumbnail_path: str | None, spritesheet_path: str | None) -> None:
    beat.assets.status = AssetStatus.READY
    beat.assets.video_asset = AssetRef(path=_relative_path(video_path), kind="video/mp4")
    beat.assets.thumbnail_asset = (
        AssetRef(path=_relative_path(thumbnail_path), kind="image/webp")
        if thumbnail_path and os.path.exists(thumbnail_path)
        else None
    )
    beat.assets.spritesheet_asset = (
        AssetRef(path=_relative_path(spritesheet_path), kind="image/jpeg")
        if spritesheet_path and os.path.exists(spritesheet_path)
        else None
    )
    beat.assets.last_error = None
    save_project(project)


def _download_outputs(project, beat) -> None:
    if not beat.assets.sora_job_id:
        raise RuntimeError(f"{beat.id} missing sora_job_id for download.")

    asset_dir = _beat_asset_dir(project.project_id, beat.id)
    video_path = os.path.join(asset_dir, "video.mp4")
    thumbnail_path = os.path.join(asset_dir, "thumbnail.webp")
    spritesheet_path = os.path.join(asset_dir, "spritesheet.jpg")

    _download_variant(beat.assets.sora_job_id, variant="video", destination=video_path)
    try:
        _download_variant(beat.assets.sora_job_id, variant="thumbnail", destination=thumbnail_path)
    except Exception as download_error:
        get_log().warning(f"[sora_generator] thumbnail download skipped for {beat.id}: {download_error}")
        thumbnail_path = None
    try:
        _download_variant(beat.assets.sora_job_id, variant="spritesheet", destination=spritesheet_path)
    except Exception as download_error:
        get_log().warning(f"[sora_generator] spritesheet download skipped for {beat.id}: {download_error}")
        spritesheet_path = None

    _mark_ready(
        project,
        beat,
        video_path=video_path,
        thumbnail_path=thumbnail_path,
        spritesheet_path=spritesheet_path,
    )


def main() -> None:
    project_id = os.environ.get("REELGPT_PROJECT_ID", "").strip() or (get_current_project_id() or "")
    if not project_id:
        raise RuntimeError("No active project. Pass --project-id or generate a script first.")

    project = load_project(project_id)
    if project is None:
        raise RuntimeError(f"Project not found: {project_id}")

    target_beat_id = os.environ.get("REELGPT_TARGET_BEAT", "").strip()
    beats = [
        beat for beat in project.beats
        if _motion_enabled(beat)
        and (not target_beat_id or beat.id == target_beat_id)
    ]
    if not beats:
        print("[sora_generator] No animation/hybrid beats selected.")
        return

    failures: list[str] = []
    size = _video_size()

    for beat in beats:
        if beat.assets.video_asset and beat.assets.status == AssetStatus.READY:
            print(f"[sora_generator] {beat.id} already ready, skipping.")
            continue

        print(f"[sora_generator] Beat {beat.id} mode={beat.mode.value}", flush=True)
        print("Stage PROGRESS: sora_generator 5", flush=True)
        try:
            final_payload = None
            if beat.assets.sora_job_id and beat.assets.status == AssetStatus.PENDING:
                print(f"[sora_generator] Resuming existing job → {beat.assets.sora_job_id}")
                current_payload = _get_video(beat.assets.sora_job_id)
                current_status = current_payload.get("status")
                if current_status == "completed":
                    final_payload = current_payload
                elif current_status in {"queued", "in_progress"}:
                    final_payload = _wait_for_video(beat.assets.sora_job_id)
                else:
                    prompt = _beat_prompt(beat)
                    _mark_pending(project, beat)
                    reference_path = _resolve_local_path(
                        beat.assets.reference_image.path if beat.assets.reference_image else None
                    )
                    create_payload = _create_video(
                        prompt,
                        seconds=_select_seconds(beat.duration_seconds),
                        size=size,
                        reference_path=reference_path,
                    )
                    beat.assets.sora_job_id = str(create_payload.get("id", "")).strip() or None
                    save_project(project)
                    if not beat.assets.sora_job_id:
                        raise RuntimeError(f"Sora create response missing id: {create_payload}")
                    final_payload = _wait_for_video(beat.assets.sora_job_id)
            else:
                prompt = _beat_prompt(beat)
                _mark_pending(project, beat)

                reference_path = _resolve_local_path(
                    beat.assets.reference_image.path if beat.assets.reference_image else None
                )
                create_payload = _create_video(
                    prompt,
                    seconds=_select_seconds(beat.duration_seconds),
                    size=size,
                    reference_path=reference_path,
                )
                beat.assets.sora_job_id = str(create_payload.get("id", "")).strip() or None
                save_project(project)

                if not beat.assets.sora_job_id:
                    raise RuntimeError(f"Sora create response missing id: {create_payload}")

                final_payload = _wait_for_video(beat.assets.sora_job_id)

            if final_payload.get("status") != "completed":
                raise RuntimeError(f"Unexpected Sora terminal status: {final_payload}")

            _download_outputs(project, beat)
            print(f"[sora_generator] Ready → {beat.id}", flush=True)
        except Exception as error:
            _mark_failed(project, beat, error)
            failures.append(f"{beat.id}: {error}")
            print(f"[sora_generator] Failed → {beat.id}: {error}", flush=True)

    if failures:
        raise RuntimeError("Sora asset generation failed for: " + "; ".join(failures))

    print("[sora_generator] Motion assets complete.")
