# Phase 2 Handoff

Project: hybrid reel engine on top of Phase 1.
Repo state: Phase 2 foundation + visible beat UI + Sora beat generation + first final-render integration are in. Main remaining work is hardening UX and cleaning project isolation.

## What Phase 2 now does

- project-backed state exists:
  - `pipeline/project_schema.py`
  - `pipeline/project_store.py`
- UI has beat-level controls:
  - `web/index.html`
  - `web/app.js`
  - `web/styles.css`
- backend UI server/API:
  - `app.py`
- CLI pipeline entry:
  - `run.py`
- Sora generation stage exists:
  - `pipeline/sora_generator.py`
- animator now copies ready beat assets into Remotion public and passes beat configs:
  - `pipeline/animator.py`
- Remotion now uses ready Sora beat assets for `animation` / `hybrid` beats:
  - `remotion/src/types.ts`
  - `remotion/src/SceneRouter.tsx`
  - `remotion/src/VideoComposition.tsx`
- project context persistence added so stage reruns should follow last active project:
  - `pipeline/project_context.py`

## Current Phase 2 data model

Projects live under:

```text
projects/<project_id>/project.json
```

Each beat supports:

- `mode`: `infographic | animation | hybrid`
- `overlay_enabled`
- `cutout_enabled`
- `assets.prompt`
- `assets.sora_job_id`
- `assets.video_asset`
- `assets.thumbnail_asset`
- `assets.spritesheet_asset`
- `assets.mask_asset`
- `assets.cutout_asset`
- `assets.last_error`

Current context file:

```text
output/project_context.json
```

Current project pointer still also exists:

```text
projects/current_project.json
```

## Known working path

1. `Generate Script`
2. set one beat to `animation`
3. enter prompt
4. `Save Beat Config`
5. `Generate This Beat`
6. beat reaches `ready`
7. `Render Video`
8. final render should reuse existing ready Sora asset, no new Sora charge on render itself

Sora asset generation definitely worked. Example existing asset:

- `projects/vertex-ai-20260418-083831/assets/beat_2/video.mp4`

Copied into Remotion public for render:

- `remotion/public/project_assets/vertex-ai-20260418-083831/beat_2/video.mp4`

Last successful final render output:

- `output/video.mp4`

## Latest user pain points

1. UI needed hard refresh to see changes.
   - partially addressed by background job polling and progress UI in `app.py` and `web/app.js`
2. stale project context caused render/generation confusion.
   - partially addressed with `pipeline/project_context.py` and updates in `run.py` / `app.py`
3. user saw render that looked wrong / stale.
   - likely due mixed old project state, old prompts on infographic beats, or UI polling/state race
   - backend render path itself did succeed when run directly with escalated local render

## Very important current caveat

Project isolation still not product-grade.
There are still signs of stale beat prompt/state contamination in project files.

Example observed:

- project topic became `Sora overlay test one`
- but `beat_2` still used older prompt/video from earlier Vertex project lineage inside same project id
- `beat_3` / `beat_4` once held stale prompts while mode was infographic

So next account should assume:

- Phase 2 architecture works
- project hygiene still needs explicit cleanup controls

## Most recent good project state

Current loaded project:

```text
vertex-ai-20260418-083831
```

Current beats from latest check:

- `beat_1`: infographic, no asset
- `beat_2`: animation, `ready`, has video/thumbnail/spritesheet
- `beat_3`: infographic, no asset
- `beat_4`: infographic, no asset

Latest `output/remotion_props.json` included:

- `beatConfigs.beat_2.mode = animation`
- `beatConfigs.beat_2.videoSrc = project_assets/vertex-ai-20260418-083831/beat_2/video.mp4`

## What was verified

- `python3 -m py_compile app.py run.py pipeline/*.py`
- `node --check web/app.js`
- `cd remotion && npx tsc --noEmit`
- direct animator render succeeded reusing existing Sora file:

```bash
python3 run.py --stage animator --project-id vertex-ai-20260418-083831
```

That render did not create new Sora jobs.

## What changed last

Latest patch set added:

- async background job model in UI server
- `/api/run-status`
- stage progress bar in UI
- project-context persistence
- render path should follow `output/project_context.json`

Main files of that patch:

- `app.py`
- `run.py`
- `pipeline/project_context.py`
- `web/app.js`
- `web/index.html`
- `web/styles.css`

## Recommended first task on new account

Do this first, not more Sora innovation yet:

- add explicit `New Project` button
- add explicit `Duplicate Project` button
- add `Load Project` selector/history
- clear beat prompts automatically when switching beat mode back to `infographic`
- make `Generate Script` always create fresh project when title changes
- display current project id prominently
- show active run stage in UI from polling payload
- prevent concurrent runs in UI with disabled buttons

This is the real blocker to sane Phase 2 usage.

## After that

Then do:

- better hybrid overlay layout for `animation` beats
- `hybrid` beat visual polish
- cutout/mask pipeline
- per-beat preview thumbnail/video inline
- regenerate single beat only
- transitions between infographic and motion beats

## Useful commands

Start UI:

```bash
python3 app.py
```

Generate only one Sora beat:

```bash
python3 run.py --stage sora_generator --project-id <project_id> --beat-id beat_2
```

Render final video using existing ready asset only:

```bash
python3 run.py --stage animator --project-id <project_id>
```

Full pipeline:

```bash
python3 run.py --title "..." --summary "..."
```

Type/script checks:

```bash
python3 -m py_compile app.py run.py pipeline/*.py
node --check web/app.js
cd remotion && npx tsc --noEmit
```

## Env expected

At minimum:

```env
OPENAI_API_KEY=...
OPENAI_TEXT_MODEL=gpt-5
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral
OPENAI_VIDEO_MODEL=sora-2
OPENAI_VIDEO_SIZE=720x1280
OPENAI_VIDEO_POLL_SECONDS=10
```

## Bottom line

Phase 2 status:

- foundation: done
- beat UI: done
- Sora asset generation: done
- final render consuming ready Sora asset: done
- project isolation / no-refresh UX: partially fixed, still fragile
- next engineering priority: project lifecycle + UI hardening, not more model features yet

If you want to paste this into next account as one instruction:

```text
Continue Phase 2 on this repo. Current state: project-backed hybrid reel system exists; beat UI, Sora beat generation, and first final-render integration are already implemented. Main remaining work is fixing project isolation and UI lifecycle. Start by auditing app.py, run.py, pipeline/project_context.py, pipeline/project_store.py, web/app.js, and remotion/src/VideoComposition.tsx. Add explicit new-project/loading controls, eliminate stale project reuse, keep UI progress polling stable, and verify Render Video always uses the correct current project plus any ready Sora beat assets.
```
