# ReelGPT Phase 1

Infographic-only reel generator with an OpenAI-only backend.

Current path:

`user input -> content generation -> script review/edit -> narration -> timing/alignment -> Remotion render -> output/video.mp4`

## Phase 1 Scope

- user provides topic title and optional summary/source text
- system generates structured infographic content
- user reviews or edits spoken script before TTS
- user picks a visual theme and sees a preview card in UI
- narration audio and timing are generated
- Remotion renders final vertical MP4

## Run

Install Python deps:

```bash
cd codex-community-hackathon-del-reel-gpt
python3 -m pip install -r requirements.txt
```

Install Remotion deps:

```bash
cd remotion
npm install
cd ..
```

Optional word-level alignment:

```bash
python3 -m pip install openai-whisper
```

## UI

Launch local review UI:

```bash
python3 app.py
```

Open `http://127.0.0.1:8000`.

UI flow:

- enter title + summary
- generate draft script
- edit narration blocks
- choose theme
- render video

## CLI

Full pipeline:

```bash
python3 run.py \
  --title "Your topic here" \
  --summary "Optional source text or factual summary" \
  --theme deep_winter
```

Generate draft content only:

```bash
python3 run.py \
  --stage content_generator \
  --title "Your topic here" \
  --summary "Optional source text or factual summary" \
  --theme deep_winter
```

Optional flags:

- `--provider openai`
- `--model gpt-4.1-mini`
- `--narration '{"hook":"...","concept_1":"...","concept_2":"...","takeaway_cta":"..."}'`
- `--tone "calm, direct, technical"`
- `--theme deep_winter|oxide_sunset|graphite_lime`
- `--stage content_generator|narrator|word_aligner|animator`

## Outputs

Generated under `output/`:

- `topic.json`
- `theme.json`
- `script.json`
- `spoken_narration.json`
- `narration.wav`
- `narration_timing.json`
- `word_timings.json`
- `params.json`
- `scene_plan.json`
- `remotion_props.json`
- `video.mp4`

## Notes

- active Remotion runtime now exposes only `VideoComposition`
- final render uses selected theme from `output/theme.json`
- if `openai-whisper` is missing, pipeline still renders but falls back to segment-level cue timing
