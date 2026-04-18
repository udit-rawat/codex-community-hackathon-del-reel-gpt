from __future__ import annotations

import json
import os

_ROOT = os.path.join(os.path.dirname(__file__), "..")
MODEL_CONFIG_PATH = os.path.join(_ROOT, "output", "model_config.json")

MODELS = {
    "text": [
        {"value": "gpt-4.1-nano",  "label": "GPT-4.1 Nano  — fastest, cheapest"},
        {"value": "gpt-4.1-mini",  "label": "GPT-4.1 Mini  — balanced"},
        {"value": "gpt-4.1",       "label": "GPT-4.1       — most capable"},
        {"value": "gpt-4o-mini",   "label": "GPT-4o Mini   — legacy fast"},
        {"value": "gpt-4o",        "label": "GPT-4o        — legacy capable"},
    ],
    "tts": [
        {"value": "gpt-4o-mini-tts", "label": "GPT-4o Mini TTS — default"},
        {"value": "tts-1",           "label": "TTS-1           — fast"},
        {"value": "tts-1-hd",        "label": "TTS-1 HD        — higher quality"},
    ],
    "ttsVoice": [
        {"value": "marin",   "label": "Marin   — warm, clear"},
        {"value": "alloy",   "label": "Alloy   — neutral"},
        {"value": "echo",    "label": "Echo    — deep"},
        {"value": "fable",   "label": "Fable   — expressive"},
        {"value": "onyx",    "label": "Onyx    — authoritative"},
        {"value": "nova",    "label": "Nova    — friendly"},
        {"value": "shimmer", "label": "Shimmer — soft"},
    ],
    "video": [
        {"value": "sora-2",     "label": "Sora-2     — standard"},
        {"value": "sora-2-pro", "label": "Sora-2 Pro — highest quality"},
    ],
    "videoSize": [
        {"value": "1024x1792", "label": "1024×1792 — portrait HD (default)"},
        {"value": "720x1280",  "label": "720×1280  — portrait standard"},
        {"value": "1792x1024", "label": "1792×1024 — landscape HD"},
        {"value": "1280x720",  "label": "1280×720  — landscape standard"},
    ],
}

DEFAULTS = {
    "textModel":  "gpt-4.1-nano",
    "ttsModel":   "gpt-4o-mini-tts",
    "ttsVoice":   "marin",
    "videoModel": "sora-2-pro",
    "videoSize":  "1024x1792",
}


def read_model_config() -> dict:
    if not os.path.exists(MODEL_CONFIG_PATH):
        return dict(DEFAULTS)
    try:
        with open(MODEL_CONFIG_PATH) as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return dict(DEFAULTS)
        return {k: str(data.get(k, v)).strip() or v for k, v in DEFAULTS.items()}
    except Exception:
        return dict(DEFAULTS)


def write_model_config(config: dict) -> dict:
    payload = {k: str(config.get(k, v)).strip() or v for k, v in DEFAULTS.items()}
    os.makedirs(os.path.dirname(MODEL_CONFIG_PATH), exist_ok=True)
    with open(MODEL_CONFIG_PATH, "w") as f:
        json.dump(payload, f, indent=2)
    return payload


def apply_to_env(config: dict) -> None:
    """Inject model config into os.environ so pipeline subprocesses inherit it."""
    mapping = {
        "textModel":  "OPENAI_TEXT_MODEL",
        "ttsModel":   "OPENAI_TTS_MODEL",
        "ttsVoice":   "OPENAI_TTS_VOICE",
        "videoModel": "OPENAI_VIDEO_MODEL",
        "videoSize":  "OPENAI_VIDEO_SIZE",
    }
    for key, env_var in mapping.items():
        value = str(config.get(key, DEFAULTS[key])).strip()
        if value:
            os.environ[env_var] = value
