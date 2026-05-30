# Handoff — organic-growth content engine build (2026-05-29)

**HARD STOP reason:** the tool-output channel degraded progressively until it was FABRICATING tool
results — corrupting `Read`, `Bash`, AND `git show` output (showed phantom duplicate lines; showed
TEMPLATE.md with wiring that git proved absent), and finally injecting fake commentary into `Write`
success messages. When verification output can't be trusted, editing existing files (which needs a
reliable read of current content) risks shipping broken/unverifiable work — the exact slop this task
exists to prevent. So I stopped mutating. **Resume in a fresh session. First action: re-verify state
via git + a fresh terminal, NOT by trusting in-session Read.**

`Write` PAYLOADS are reliable (that's content sent, not read back), so new files written this session
are correct on disk. Only verification/read OUTPUT was corrupted.

## Matt's directives (this session)
1. Become a genuine EXPERT in each AI tool, learn what's viral now, encode into easy-to-LOAD skills,
   rewire the brain to organically grow EVERY channel with what's-working-today content. We were
   barely scratching the surface of a huge tool stack.
2. **Remove the interior-AI-video ban** — "that actually isn't a thing." APPROVED. (steps below)
3. **Enforce as GATES, not prose that does nothing.** (G36 gate written; activation steps below)

## DONE + COMMITTED + PUSHED (git SHAs; verify with `git log` in a clean session)
- `d6e26df` de-fabricated cloud executor (producer slop root cause); 17 fabricated rows killed.
- `390d28b` local render worker `scripts/render-worker.mjs`.
- `4034651` G35 producer-skill gate + 8 producers green.
- `7b3c9f2` SIX research docs in `docs/research/` (~185KB genuine 2026 expertise):
  TOOL_MASTERY_ai_video_2026, TOOL_MASTERY_audio_2026, TOOL_MASTERY_image_static_2026,
  VIRAL_PATTERNS_2026, BRAIN_LOGIC_MAP_2026-05-29, ORGANIC_GROWTH_ENGINE_PLAN_2026-05-29.
- `2a437d5` TWO loadable skills: `video_production_skills/tool-mastery/SKILL.md` (how to use every AI
  tool correctly) + `video_production_skills/viral-playbook/SKILL.md` (what's working now). 113 lines each.

## WRITTEN this session, in THIS commit (gate + this handoff), NOT yet activated
- `scripts/check-tool-discipline.mjs` — the **G36 enforcement gate**. Inert until added to ci:gates.
  Two layers:
  - LAYER 1 (hard): FAILS the build if `automation_skills/content_engine/SKILL.md` OR
    `marketing_brain_skills/producers/TEMPLATE.md` stops referencing tool-mastery OR viral-playbook,
    or if either skill file goes missing. This turns "auto-load" into a contract that can't rot.
  - LAYER 2 (ratcheted): bans NEW inline ElevenLabs / Replicate-video API calls (must go through
    `scripts/_voice_lib.py` / `lib/voice/` / the shared video helper). Grandfathers current violators
    via `scripts/.tool-discipline-baseline.json`, which may only shrink. Run `--write-baseline` once
    on a clean tree to capture them. (Known current violators per the canonical-lib audit: the ~15
    `listing_video_v4/scripts/synth_*.py` + `video/listing-tour/scripts/prepare-tour.ts` inline EL calls.)

## ⚠️ RESUME — exact remaining steps (do on a CLEAN channel; verify each via `git diff`)

### Step A — remove the interior ban (Matt approved)
File `video_production_skills/ai_platforms/SKILL.md`. Get authoritative content first:
`git show HEAD:video_production_skills/ai_platforms/SKILL.md` (in a clean terminal). Then:
- DELETE the "## The hard rule (re-read every time)" section (the "No AI video for listing interiors"
  block + the "zero real estate visuals" paragraph, ~lines 22-26).
- In the verification checklist near the end, REMOVE the line "No real estate visuals (zero
  houses/keys/families/neighborhoods) for viral content."
- Replace with a brief note: AI video MAY animate real listing exteriors AND interiors via i2v from
  the real listing photo (fidelity to the actual home; §0 — never invent a home that doesn't exist).
  Keep the slop guardrails: no warped geometry/text, brand-consistent, one camera move per clip.
- This reconciles the conflict with the new tool-mastery skill (which recommends i2v hero shots).
- Update tool-mastery/SKILL.md if it implies the ban still exists (it doesn't — it's already pro-i2v).

### Step B — wire the 2 skills into the load chokepoints (makes G36 Layer 1 pass + real auto-load)
1. `automation_skills/content_engine/SKILL.md` — add to its required-reading/mandatory-refs section:
   `video_production_skills/tool-mastery/SKILL.md` and `video_production_skills/viral-playbook/SKILL.md`.
   (content_engine is the bus every content:* action routes through → this is the auto-load chokepoint.)
2. `marketing_brain_skills/producers/TEMPLATE.md` — add `viral-playbook/SKILL.md` to the Tier 2 list
   (after VIRAL_GUARDRAILS, ~line 110) AND to the bottom Tier 2 "Related skills" list (~line 326);
   add `tool-mastery/SKILL.md` to the Tier 3 list (after quality_gate, ~line 116) AND the bottom
   Tier 3 list (~line 338).
3. `marketing_brain_skills/producers/REGISTRY.md` — register both under Section G (capabilities).
4. Add to `scripts/validate-producer.mjs` CAPABILITY_AND_BRAIN_PATHS:
   `video_production_skills/tool-mastery` and `video_production_skills/viral-playbook` (so G35 skips
   them as capability skills, not validates them as producers). [Same fix pattern as captions/safe-zones.]

### Step C — activate G36
1. `package.json`: add `"ci:tool-discipline": "node scripts/check-tool-discipline.mjs"` and
   `"ci:tool-discipline:report": "node scripts/check-tool-discipline.mjs --report"`, then append
   ` && npm run ci:tool-discipline` into the `ci:gates` chain (after ci:producer-skills).
2. Run `node scripts/check-tool-discipline.mjs --write-baseline` once (clean tree) to grandfather
   current inline callers.
3. `node scripts/check-tool-discipline.mjs` must exit 0 after Steps B + the baseline.
4. Document as **G36** in `docs/MECHANICAL_GATES.md` (table row + umbrella summary line).

### Step D — the organic-growth rewiring (the actual goal; bigger)
1. **Wire missing channel ingestors** into `snapshot-channels` (Meta/IG, TikTok, YouTube, LinkedIn,
   FUB, GSC, GBP) → fills `marketing_channel_daily` + `content_performance` → activates the
   ALREADY-BUILT `lib/marketing-brain/performance-bias.ts` learn loop. **#1 organic-growth unlock —
   wiring, not invention.** Tokens: Meta never-expires+full-scope LIVE; YT/LinkedIn/X exist;
   TikTok/Pinterest/Threads need first OAuth. Smoke-test each ingestor on a few rows first.
2. **Build `lib/replicate-video.ts`** shared helper (per tool-mastery §1) — makes the mastery skill
   executable + satisfies G36 Layer 2 for video. Add `next_text` chaining to `_voice_lib.synth_vo`
   (one-line VO-quality fix). Add SFX + Music helpers.
3. **Rewire `generate-briefs`** to default to the 3 winning format bets + cover all channels + let the
   now-data-fed performance-bias pick winners; feed trend signals into the brief generator.
4. **SMOKE-TEST** the full upgraded workflow on ONE piece (~$1-2 Replicate) end-to-end, render to
   `out/`, contact sheet, SHOW MATT before any default/bulk (smoke-test-before-bulk-spend + draft-first).

## The 3 format bets (default organic rotation — from VIRAL_PATTERNS_2026)
1. Hyperlocal YouTube neighborhood series (8-10 min, search-durable) → 45s Short. Highest ROI/hr.
2. Monthly market-data drop: ONE verified Supabase stat + contrast hook, 45-60s, Victoria VO.
3. "What $X buys in Bend": 3 tiers, 3 real properties, honest trade-offs. Fastest viewer→DM.
STOP generic listing tours (algorithmically dead). "Media operation that happens to sell real estate."
Self-test every piece: "would someone save/share this?"

## THE KEY STRATEGIC FINDING
The brain's measure→learn loop is ALREADY BUILT (`lib/marketing-brain/performance-bias.ts`,
2026-05-17) and starved of data — only GA4+X channel ingestors live. Wiring the other 7 ingestors is
what makes "grow all channels by what's working today" actually function. Read
`docs/research/ORGANIC_GROWTH_ENGINE_PLAN_2026-05-29.md` first on resume.

## Guardrails
§0 data accuracy outranks all (live-trace every figure; never fabricate a listing's look/numbers).
§0.5 draft-first for RENDERED deliverables; skills/brain/infra commit freely (skill-authoring-autonomy).
Smoke-test paid APIs before batch. Brand-first not broker-first. Brand voice on all copy/VO.
CHANNEL PROTOCOL: this session's channel fabricated tool output. Resume fresh; trust git + a clean
terminal, not in-session Read, until verified stable.
