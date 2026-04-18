# adamax brief prompt v4 — content strategy + custom animation

Paste this entire file into Claude. It will output a shell command you can run directly.

This version targets **25–35 second Reels** with a heavily animated hook.
AdaMax posts 30s videos that let a builder run something new tonight.
Every video must attract **indie developers, ML engineers, and builders** — not general tech curious.

---

## ACCOUNT DIRECTION — read this first

AdaMax is a daily feed for builders who want the sharpest 30s breakdown of what just shipped in AI.
Every video should attract someone who:
- Writes code or ships products
- Wants to understand AI/ML at a deeper level than Twitter threads
- Would save this to try tonight or send to a teammate

**The two content sins to avoid:**
1. Too generalist — "Google releases new AI" — everyone posts this, nobody converts
2. Too niche — "Sequential hidden decoding in 8B transformers" — nobody watches

**The sweet spot:** A concrete technical achievement explained so clearly that a builder immediately understands why it matters to their work. AlphaEvolve breaking a 56-year math record is the benchmark. That story has stakes, a number, and a clear implication for anyone who builds with algorithms.

---

## CONTENT FORMAT — pick ONE

**Default to Format D unless the story is genuinely Format C tier.** If there is no `git clone`, `pip install`, or runnable link, you need to justify why this is not Format D. Formats A and B are sub-types of D — they still need a runnable artifact. 4 repo drops for every 1 "record broken" post.

### Format A — The Cheat Code
*Most builders don't know you can do X. Here is how.*
- Hook pattern: "The tool you are paying for just became free."
- Best for: open-source alternatives, free replacements, developer shortcuts
- Save rate: very high

### Format B — The Hidden Cost Reveal
*You are paying $X/month for Y. This does the same thing for $0.*
- Hook pattern: Lead with the exact dollar amount the viewer is losing
- Best for: any paid tool that now has a free/open-source equivalent
- Share rate: very high

### Format C — The Concrete Achievement
*Something that was impossible last month just happened. Here is the number that proves it.*
- Hook pattern: falsifiable claim + specific number + implication for builders
- Best for: capability leaps, records broken, architectural breakthroughs
- Follow rate: very high — this is the AlphaEvolve format

### Format D — The Repo Drop
*Someone just built X using [Famous Model]. You can run it today.*
- Hook pattern: famous model name + what it does + "free" or "on your laptop"
- Best for: new GitHub repos trending on X or GitHub in the last 48 hours
- Script structure: hook (what it does + model) → install command → what you can build → pull it today
- Save rate: very high — "how to use it" content is the #1 save trigger on Instagram
- Example: "Someone just built a local coding agent on Llama 4. No API key. No subscription."

---

## TARGET AUDIENCE

**Indie developers, ML engineers, and technical builders.**
Every hook must speak to someone who writes code or ships products.
Ask before writing: does this save them time, money, or give them a competitive edge?

**Skip if:**
- It is just a benchmark number with no practical implication
- The tool requires enterprise access or a waitlist
- Five other AI accounts already posted it with the same angle
- The topic is a model version comparison with no architectural story
- The repo has no README or install is more than 5 steps
- The announcement is just weights with no inference code

**The one-sentence test:** Can you answer "what command does the viewer run after this video?" in one sentence? If no, the topic fails the brief.

---

## VIDEO LENGTH — 25–35 seconds. Hard limit.

| Segment | Duration | Word budget |
|---|---|---|
| `hook` | 5–7s | ≤ 10 words |
| `concept_1` | 7–9s | ≤ 14 words |
| `concept_2` | 9–12s | ≤ 18 words |
| `takeaway_cta` | 5–7s | ≤ 8 words |

**Total: 50–60 words across all four segments. Hard cap.**

At Aoede TTS pace (~1.4 words/sec), 55 words = ~39s. With natural pauses = ~33s clean.
Keep total under 60 words. If you are over, cut concept_1 first.

**Why shorter:** MolmoWeb (31s) had better retention ratio than every 60s+ video.
IG algo measures average watch time as a % of total length — shorter = easier to hit 100%.
A viewer who watches 30s of a 30s video is worth 10x a viewer who watches 30s of a 60s video.

---

## SCRIPT RULES — non-negotiable

1. **Fragments allowed in hook.** One fragment per hook is encouraged — it creates a pattern interrupt. "$49 per month. Gone." beats any full sentence opener. Fragments are banned everywhere else.
2. **Continuous rhythm elsewhere.** concept_1, concept_2, takeaway must be full sentences with connecting words: "which means", "and that", "because", "so now".
3. **One number per segment minimum.** Concrete numbers are the only thing that stops scrolling.
4. **Hook with brand gravity.** For Format C and D, open with the famous brand, model name, or repo name — that is what stops the scroll. "Google's AlphaEvolve", "Meta's Llama 4", "Someone built X on Llama 4" are all valid openers. For Format A and B, open with the pain point or dollar amount instead.
5. **No generic openers.** "Today we look at...", "In this video...", "AI is changing..." are banned regardless of format.

---

## HOOK FORMULA — choose one

**Rule: the first 3 words must contain a number, brand name, or command.**
GOOD: "400B params. One H100." / "`git clone unsloth`" / "$20 per month. Gone." / "Meta just dropped."
If the hook does not have a number, brand, or runnable noun in the first 3 words, rewrite it.

**Visual rule: Frame 0 must have text.** If the first frame is a logo or blank screen, the hook fails. Text must render before 0.3 seconds. Brief animations that start with words, not intros.

**Hero value rule: beat_1 `hero_value` must be the product/repo name — never a metric.** The metric goes in `hero_label`. Voice says the name first, screen shows the name first. Viewer must know WHAT in the first frame before they know HOW MUCH.

**Formula A — The cost punch:**
`[what they pay now] → [what just changed] → [the number that makes it real]`
> "You are paying twenty dollars a month for browser automation that breaks every week, and AllenAI just open-sourced something that runs on your laptop for free."

**Formula B — The record broken:**
`[what everyone assumed was fixed] → [the number that broke it] → [what it means for builders]`
> "A fifty-six year old math record just fell, and the thing that broke it was an AI rewriting its own algorithms at runtime."

**Formula C — The access unlock:**
`[who had this before] → [who has it now] → [the specific number that makes it real]`
> "Running a private ChatGPT on your phone used to need a server. Bonsai 8B does it in one gigabyte."

---

## BANNED WORDS

`incredibly` `massive` `huge` `enormous` `groundbreaking` `revolutionary`
`mind-blowing` `game changer` `this changes everything` `next level`
`basically` `essentially` `kind of` `at its core` `simply put`
`in conclusion` `as we can see` `today we look at` `let us dive in`
`leverage` `supercharged` `powerful` `exciting` `impressive`

---

## TONE — rotate between 2 modes

**2 out of 3 videos — Calm + measured (default):**
Like a senior engineer explaining something over coffee. They already know it is a big deal, so they do not need to perform excitement. The facts carry the weight. Aoede performs best here.

Pass: `--tone "Calm and measured. Speak like a senior engineer who already knows this is significant — no hype needed. Pause after numbers. Continuous sentences, no fragments."`

**1 out of 3 videos — Deadpan + dry:**
Understate the drama. Let the contrast do the work. Make the listener feel smart for catching it.
GOOD: "Meta spent 2 billion dollars. A teenager on GitHub did it for free."
GOOD: "OpenAI's Sora lasted six months. The unit economics are not complicated."

Pass: `--tone "Deadpan and dry. Speak like a skeptical senior engineer who has seen every hype cycle. Let the numbers land in silence. No enthusiasm. The contrast IS the joke."`

Do NOT use the same tone two videos in a row. Track it manually or alternate by day.

**Pacing:** Aoede must sound like she is telling you a secret before the meeting starts. If a sentence takes more than 4 seconds to say, split it. Deadpan mode should feel like 0.9x speed — not monotone. Calm ≠ slow.

---

## CTA — rotate between 4 options, never repeat back-to-back

**Option 1 — Repo CTA:** `"[RepoName]. Pull it. Run it."` — use for Format D. ≤8 words.
**Option 2 — Share trigger:** `"Send this to the guy still paying twenty a month."` — use for Format B. ≤8 words.
**Option 3 — Hard cut (no CTA):** End on the sharpest number or fact. No instruction. Silence forces a rewatch. Use for Format C. Full sentence allowed.
**Option 4 — Save trigger:** `"Save this. You will need the command later."` — use when concept_2 has an install command. ≤8 words. Highest save-rate CTA on tech IG right now.

`takeaway_cta` in narration must be ≤8 words for Options 1, 2, and 4. Only Option 3 gets a full sentence.
Repeating the same option two videos in a row trains your audience to swipe early. IG measures last-3s completion — vary it.

---

## CAPTION — 1 sentence + runnable artifact or constraint. No hashtags.

Caption = one declarative sentence with the dramatic claim + a runnable artifact or hard constraint.
Questions get comments. "Command in first comment" gets saves + profile visits + follows. You need saves.
GOOD: "Maverick runs 400B MoE on one H100. Command in first comment."
GOOD: "Unsloth needs 6GB VRAM to fine-tune Llama. Laptop only."
BAD: "Meta's Llama 4 is here. What would you build?" — question, no save trigger.
BAD: anything with hashtags.

**Zero hashtags in caption. Zero.**

---

## SUMMARY vs NARRATION

- `--summary` → used ONLY for visual layout generation. Write factual, concrete, with real numbers.
- `--narration` → your exact spoken words. Pipeline will NOT rewrite them. Keep it tight.

---

## OUTPUT FORMAT

```bash
python3 run.py --gemini --custom --compositor \
  --title "YOUR TITLE" \
  --summary "factual one-sentence summary with concrete numbers for visual layout" \
  --tone "Calm and measured. Speak like a senior engineer who already knows this is significant — no hype needed. Pause after numbers. Continuous sentences, no fragments." \
  --narration '{"hook":"≤10 words, fragment OK","concept_1":"≤14 words, full sentence","concept_2":"≤18 words, full sentence","takeaway_cta":"≤10 words"}'
```

**Shell rules:**
- Remove apostrophes (use "it is" not "it's") — shell breaks on single quotes inside single quotes
- Keep the entire command on ONE line
- `--compositor` pauses before animation so you approve the hook animation brief

---

## WORD COUNT CHECKER

Before outputting: count every word.
- hook ≤ 10
- concept_1 ≤ 14
- concept_2 ≤ 18
- takeaway_cta ≤ 8 (Options 1, 2, 4) — Option 3 hard cut can be ≤ 14 words since it is a full sentence
- **Total must be 50–60 words**

If over 60: delete concept_2 entirely and make concept_1 carry the number + implication in 14 words.
If under 50: add one concrete number or consequence to concept_2.

---

## PIPELINE PAUSE FLOW

The `--compositor` flag means the pipeline will:
1. Run all stages (TTS, timing, layout generation, brief_generator)
2. param_extractor auto-selects `template_variant` per beat (`"infographic"` or `"threejs"`) — no manual step needed
3. Pause and show the **exact narration going to TTS** — you confirm before audio is generated
3. After TTS + brief_generator: pause again and **print the full animation brief inline** — no cat command needed
4. **Copy the entire brief block and paste it into a Claude session** — Claude reads it and writes CustomVideo.tsx
5. Drop the file at the exact path printed at the bottom of the brief, press Enter, pipeline renders

---

## COMPOSITOR ROLE — read this before writing code

When you receive an animation brief, your role is **coder, not creative director**.

- The brief is the creative decision. Do not invent structure, change layouts, or add scenes.
- Implement the spec exactly as written. Every beat, every event, every frame offset.
- One question to ask before writing: "Is this in the brief?" If no, don't add it.

**What you get in the brief:**
- Beat specs: template name, duration in frames, narration text, text_frame (first visible text), animation events with exact frame offsets
- Beat start frames (cumulative) — use these for `<Sequence from={n}>`
- `template_variant` per beat: `"infographic"` (text-led, full layout) or `"threejs"` (caption-zone only — bg_loop composited in iMovie). Pass as `variant` prop to `SceneRouter`.
- Available animation primitives from `_shared.tsx`
- Hard rules that are already enforced — no need to re-derive them

**What you write:**
- ONE file: `CustomVideo.tsx`
- Self-contained — no external props, all data hardcoded from the brief
- Imports only from `remotion`, `react`, `./layouts/`, `./templates/threejs/` (if any beat uses `"threejs"` variant)
- Each beat wrapped in `<Sequence from={beatStartFrame} durationInFrames={duration}>`
- Drop it at the exact path printed at the bottom of the brief

**What you do NOT do:**
- No intro animations, logo reveals, or blank first frames — beat_1 text at frame 1, always
- No extra beats, extra layouts, or creative additions
- No external data fetching or runtime props

---

## TOPIC SELECTION GUIDE

| Signal | Format | Why it works |
|---|---|---|
| New GitHub repo built on Llama/GPT-4/Claude | D | save trigger — "run it today" content |
| AI tool trending on X in last 48 hours | D | recency + famous model = stop scroll |
| Paid tool → now free/open | B | instant save/share, builder pain point |
| Mathematical/speed record broken | C | falsifiable, stakes are clear |
| Tool that replaces another specific tool | A or B | name the tool it kills |
| Architectural breakthrough with a number | C | builders care about mechanisms |
| Capability unlock on consumer hardware | A | "runs on your laptop/phone" frame |

**Source priority:** GitHub trending + X posts beat Reddit posts. A repo that went viral on X today outranks a Reddit thread from 2 days ago on the same topic.

**The AlphaEvolve test:** Would a senior ML engineer forward this to a colleague? If yes, post it.
If it sounds like a press release, do not post it.

---

## EXAMPLE — Format C (Concrete Achievement)

**Topic:** AlphaEvolve — AI rewriting its own algorithms

```bash
python3 run.py --gemini --custom --compositor --title "Run Llama 4 400B Locally With Unsloth" --summary "Unsloth fine-tunes Llama 4 Maverick 400B MoE on a single H100 with 6GB VRAM using 4-bit quantization and LoRA adapters" --tone "Calm and measured. Speak like a senior engineer who already knows this is significant — no hype needed. Pause after numbers. Continuous sentences, no fragments." --narration '{"hook":"400B params. One H100. Zero API cost.","concept_1":"Unsloth uses 4-bit quantization and LoRA so Maverick runs in 6 gigabytes of VRAM on your laptop","concept_2":"That means you fine-tune the frontier model locally tonight which beats paying OpenAI 20 dollars a month","takeaway_cta":"Unsloth. Pull it. Run it."}'
```

**Word count check:**
- hook: "400B params. One H100. Zero API cost." = 7 words ✓ (fragment, number in first word)
- concept_1: 14 words ✓
- concept_2: 18 words ✓
- takeaway_cta: "Unsloth. Pull it. Run it." = 5 words ✓ (Option 1, ≤8)
- **Total: 44 words ✓ — valid, shows Claude how lean it should be**

If over 60: delete concept_2 entirely. Make concept_1 carry both the number and the implication in 14 words.
Always recount after writing. The word budget is a hard constraint.
