"""
OpenAI text client for the active infographic pipeline.

Active API path:
  OPENAI_API_KEY -> OpenAI Responses API
"""
import json
import os

import requests

from pipeline import logger as _logger_mod

OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-nano")
DEFAULT_MAX_TOKENS = 4096


def _extract_output_text(data: dict) -> str:
    if data.get("output_text"):
        return data["output_text"]

    texts: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if text:
                texts.append(text)

    if texts:
        return "\n".join(texts).strip()

    raise RuntimeError(f"OpenAI response did not contain output text: {json.dumps(data)[:800]}")


def _call_openai(prompt: str, stage: str, max_tokens: int, json_mode: bool = False) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set.")

    model = os.environ.get("OPENAI_TEXT_MODEL", OPENAI_TEXT_MODEL)
    payload_prompt = prompt
    if json_mode:
        payload_prompt += "\n\nReturn ONLY valid JSON. No markdown fences."

    body = {
        "model": model,
        "input": payload_prompt,
        "max_output_tokens": max_tokens,
    }

    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=180,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"[{stage}] OpenAI HTTP {response.status_code}: {response.text[:800]}"
        )

    data = response.json()
    text = _extract_output_text(data)
    _logger_mod.get().debug(f"[{stage}] OpenAI success — model: {model}")
    return text


def get_mode() -> str:
    model = os.environ.get("OPENAI_TEXT_MODEL", OPENAI_TEXT_MODEL)
    if os.environ.get("OPENAI_API_KEY"):
        return f"openai ({model})"
    return f"openai ({model}) [missing OPENAI_API_KEY]"


def call(prompt: str, stage: str, max_tokens: int = DEFAULT_MAX_TOKENS, json_mode: bool = False) -> str:
    return _call_openai(prompt, stage, max_tokens=max_tokens, json_mode=json_mode)
