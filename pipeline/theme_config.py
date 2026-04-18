import json
import os

_ROOT = os.path.join(os.path.dirname(__file__), "..")
THEME_PATH = os.path.join(_ROOT, "output", "theme.json")
CUSTOM_THEME_PATH = os.path.join(_ROOT, "output", "custom_theme.json")

DEFAULT_THEME = "deep_winter"

THEMES: dict[str, dict[str, str]] = {
    "deep_winter": {
        "label": "Deep Winter",
        "description": "Cool blue data-room palette.",
        "bg": "#080809",
        "accent": "#2563EB",
    },
    "oxide_sunset": {
        "label": "Oxide Sunset",
        "description": "Warm editorial contrast with amber accents.",
        "bg": "#140F0D",
        "accent": "#F97316",
    },
    "graphite_lime": {
        "label": "Graphite Lime",
        "description": "Dark industrial palette with sharp lime telemetry.",
        "bg": "#0A0D0A",
        "accent": "#84CC16",
    },
}


def normalize_theme_name(name: str | None) -> str:
    key = (name or "").strip().lower().replace("-", "_").replace(" ", "_")
    return key if key in THEMES else DEFAULT_THEME


def write_theme_selection(name: str | None) -> str:
    theme_name = normalize_theme_name(name)
    os.makedirs(os.path.dirname(THEME_PATH), exist_ok=True)
    with open(THEME_PATH, "w") as f:
        json.dump({"theme": theme_name}, f, indent=2)
    return theme_name


def read_theme_selection() -> str:
    if not os.path.exists(THEME_PATH):
        return DEFAULT_THEME
    try:
        with open(THEME_PATH) as f:
            data = json.load(f)
    except Exception:
        return DEFAULT_THEME
    return normalize_theme_name(data.get("theme"))


def _normalize_color(value: object) -> str:
    text = str(value or "").strip()
    return text[:64]


def write_custom_theme(theme: dict | None) -> dict:
    payload = {
        "bg": _normalize_color((theme or {}).get("bg", "")),
        "accent": _normalize_color((theme or {}).get("accent", "")),
        "text": _normalize_color((theme or {}).get("text", "")),
    }
    os.makedirs(os.path.dirname(CUSTOM_THEME_PATH), exist_ok=True)
    with open(CUSTOM_THEME_PATH, "w") as f:
        json.dump(payload, f, indent=2)
    return payload


def read_custom_theme() -> dict:
    if not os.path.exists(CUSTOM_THEME_PATH):
        return {"bg": "", "accent": "", "text": ""}
    try:
        with open(CUSTOM_THEME_PATH) as f:
            data = json.load(f)
    except Exception:
        return {"bg": "", "accent": "", "text": ""}
    if not isinstance(data, dict):
        return {"bg": "", "accent": "", "text": ""}
    return {
        "bg": _normalize_color(data.get("bg", "")),
        "accent": _normalize_color(data.get("accent", "")),
        "text": _normalize_color(data.get("text", "")),
    }
