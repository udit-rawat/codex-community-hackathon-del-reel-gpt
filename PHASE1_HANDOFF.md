# Phase 1 Handoff

## Goal

Phase 1 target:

`user input -> topic payload -> content generation -> narration -> timing/alignment -> infographic scene params -> remotion render -> mp4`

Constraints:
- OpenAI-only backend
- infographic-only active runtime
- no scraper/ranker/notifier/analytics/quota
- animation/Sora path deferred

## What was done

### 1. Dead pipeline modules deleted

Deleted:
- `pipeline/scraper.py`
- `pipeline/ranker.py`
- `pipeline/scripter.py`
- `pipeline/verifier.py`
- `pipeline/scene_planner.py`
- `pipeline/brief_generator.py`
- `pipeline/notifier.py`
- `pipeline/quota.py`
- `pipeline/analytics.py`
- `pipeline/auditor.py`

### 2. Runner simplified

`run.py` now only runs:
- `content_generator`
- `narrator`
- `word_aligner`
- `animator`

Old branches removed from active flow:
- notifier
- checkpoint
- compositor pause
- analytics/quota
- scraper/ranker

### 3. OpenAI env setup added

Files:
- `.env`
- `.env.example`
- `.gitignore`

Current env keys expected:
- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL`
- `OPENAI_TTS_MODEL`
- `OPENAI_TTS_VOICE`

Note:
- `.env` exists locally and is gitignored
- do **not** paste secret key into any new file or chat again

### 4. OpenAI migration started

Patched:
- `pipeline/claude_client.py`
  - now OpenAI Responses API client
  - still supports `handoff`
- `pipeline/narrator.py`
  - now OpenAI `/v1/audio/speech`
- `requirements.txt`
  - vendor deps reduced
- `README.md`
  - now Phase 1/OpenAI-oriented

### 5. Remotion dependency conflict fixed

Patched:
- `remotion/package.json`

Changed:
- `@react-three/drei` from `^10.7.7`
- to `^9.120.9`

## What was verified

### OpenAI connectivity

These manual curl checks passed from terminal:

#### Responses API
Worked with:
- model: `gpt-4.1-mini`

#### TTS API
Worked with:
- model: `gpt-4o-mini-tts`
- voice: `coral`

### Local code checks

Passed:
- `python3 -m py_compile ...`
- `python3 run.py --help`

## Current blocker

Main blocker is `pipeline/content_generator.py`.

Auth and network are fine.
Failure is now payload-shape mismatch from OpenAI output.

Recent strategy changes already applied:
- removed strict OpenAI `json_schema` mode
- using plain text response + local validation
- added retry feedback with validation errors
- added normalization for near-valid outputs

Still failing because OpenAI often returns partial payloads missing required fields.

## Latest failing command

```bash
cd /Users/uditrawat/Desktop/experiment/codex-community-hackathon-del-reel-gpt

python3 run.py \
  --title "OpenAI text-to-speech" \
  --summary "OpenAI provides text and audio APIs. We need a short infographic reel about using a single platform key for both text generation and narration."
```

## Latest failure shape

`content_generator` still fails with missing required fields in `VideoPayload`, for example:
- missing `layout_mode`
- missing `ui_content.section_label`
- missing `ui_content.hero`
- missing `ui_content.context`
- missing `ui_content.chips`
- missing `narration.statement_lines`
- missing `cue_definitions`

Some fallback synthesis was already added, but not enough yet.

## Files most recently edited

- `run.py`
- `README.md`
- `.env.example`
- `.gitignore`
- `requirements.txt`
- `pipeline/claude_client.py`
- `pipeline/content_generator.py`
- `pipeline/narrator.py`
- `pipeline/animator.py`
- `remotion/package.json`

## Recommended next move

### Priority 1
Finish `pipeline/content_generator.py`.

Best likely path:
- stop expecting model to perfectly emit full `VideoPayload`
- ask model for a **smaller intermediate schema**
- locally expand that into full `VideoPayload`

Suggested intermediate shape:
- `layout_mode`
- minimal `ui_content_core`
- `narration.hook`
- `narration.context`
- `narration.insight`
- `narration.takeaway`

Then locally synthesize:
- `statement_lines`
- `hashtags`
- `cue_definitions`
- default chips/supporting metrics if absent

This is likely much more stable than asking model for full final payload.

### Priority 2
Once `content_generator` passes:
1. run full pipeline
2. inspect `narrator` output
3. inspect `word_aligner`
4. inspect Remotion render

### Priority 3
After backend works:
- strip active Remotion runtime to infographic-only
- archive animation/demo compositions
- add minimal UI:
  - input
  - script review/edit
  - theme select/preview
  - render/result

## Useful commands

### Install Python deps
```bash
cd /Users/uditrawat/Desktop/experiment/codex-community-hackathon-del-reel-gpt
python3 -m pip install -r requirements.txt
python3 -m pip install openai openai-whisper
```

### Install Remotion deps
```bash
cd /Users/uditrawat/Desktop/experiment/codex-community-hackathon-del-reel-gpt/remotion
rm -rf node_modules package-lock.json
npm install
```

Fallback if npm still complains:
```bash
npm install --legacy-peer-deps
```

### Test OpenAI text
```bash
cd /Users/uditrawat/Desktop/experiment/codex-community-hackathon-del-reel-gpt
source .env

curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$OPENAI_TEXT_MODEL"'",
    "input": "Return valid JSON only: {\"ok\": true, \"message\": \"hello\"}",
    "max_output_tokens": 300
  }'
```

### Test OpenAI TTS
```bash
curl https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$OPENAI_TTS_MODEL"'",
    "voice": "'"$OPENAI_TTS_VOICE"'",
    "input": "This is a narration smoke test.",
    "response_format": "wav"
  }' \
  --output /tmp/openai_tts_test.wav
```

### Retry pipeline
```bash
python3 run.py \
  --title "OpenAI text-to-speech" \
  --summary "OpenAI provides text and audio APIs. We need a short infographic reel about using a single platform key for both text generation and narration."
```

## Definition of done for Phase 1

Phase 1 is complete only when:
- OpenAI-only backend works
- infographic-only render path works
- user can input topic/text
- user can review/edit script
- user can pick theme and see preview
- full pipeline produces `output/video.mp4`
- docs/env match reality

