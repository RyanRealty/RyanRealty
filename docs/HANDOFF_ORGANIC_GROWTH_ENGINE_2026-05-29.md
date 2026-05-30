# Handoff — organic-growth content engine build (2026-05-29)

**Why paused:** the tool-output channel began FABRICATING `Read` file contents (it showed
TEMPLATE.md line 111 with `viral-playbook` already wired — a hallucination of the edit I was about
to make; git confirmed it was NOT there). `Edit` needs a trustworthy `old_string`, so editing
existing files is now unsafe — a blind edit would duplicate refs or break them, i.e. produce the
exact slop this task removes. `Write` (new files) + `git` + MCP stayed reliable. Resume in a fresh
session; **first action: re-verify state via git, not Read** (see "verify on resume" below).

## Matt's directive (the goal)
Don't just audit — become a genuine EXPERT in each AI tool, learn what's going viral today, encode
that mastery into easy-to-LOAD skills, and rewire the brain so it organically grows EVERY social
channel with excellent content based on what's working now. We have a huge tool stack (full
Replicate video menu, ElevenLabs full audio, Flux/Ideogram/Grok image, Synthesia, every distribution
OAuth) and were barely scratching the surface.

## DONE + COMMITTED + PUSHED this session
- Producer slop root-cause fixed earlier: de-fabricated cloud executor (`d6e26df`), killed 17
  fabricated rows, local render worker `scripts/render-worker.mjs` (`390d28b`), G35 gate.
- `7b3c9f2` — SIX research docs (genuine deep 2026 expertise, ~98KB), all in `docs/research/`:
  - `TOOL_MASTERY_ai_video_2026.md` — every Replicate video model: prompting, costs, decision matrix, pipelines.
  - `TOOL_MASTERY_audio_2026.md` — ElevenLabs full suite (SFX, music, forced-align, next_text fix), mix recipe.
  - `TOOL_MASTERY_image_static_2026.md` — Flux.2/Ideogram/Grok, carousel + thumbnail science.
  - `VIRAL_PATTERNS_2026.md` — what wins per platform now, hooks, dead vs rising formats.
  - `BRAIN_LOGIC_MAP_2026-05-29.md` — full brain loop with file:line + rewiring points.
  - `ORGANIC_GROWTH_ENGINE_PLAN_2026-05-29.md` — the synthesis + ranked build plan. **Read this first on resume.**

## DONE on disk, COMMITTED in this session's final commit (verify via git show), NOT yet wired
- `video_production_skills/tool-mastery/SKILL.md` (118 lines) — the how-to-build-with-each-tool skill.
- `video_production_skills/viral-playbook/SKILL.md` (95 lines) — the what-to-make-now skill.
  Both written via Write + git-verified (line counts 118 / 95). Their own §"How to load this skill"
  sections state exactly where they must be referenced.

## THE KEY FINDING (reframes the whole goal)
The brain's measure→learn loop is **already built in code** (`lib/marketing-brain/performance-bias.ts`,
2026-05-17: reads `content_performance`, computes per-(format,platform) bias, multiplies opportunity
rank, can suppress/boost ±25%). It is **starved of data**: only GA4 + X channel ingestors are live in
`snapshot-channels`; Meta/IG, TikTok, YouTube, LinkedIn, FUB, GSC, GBP are "pending" (keys set, routes
not wired). So `content_performance` is empty for those → bias multiplier is a no-op → the engine
can't optimize for "what's working today." **Wiring the missing channel ingestors is the #1
organic-growth unlock — it's wiring, not invention.**

## REMAINING (ranked; resume here, with a stable channel)

1. **Wire the 2 new skills (3 edits — DO FIRST, it's small + unblocks everything):**
   - `marketing_brain_skills/producers/TEMPLATE.md`: add `viral-playbook/SKILL.md` to the **Tier 2**
     ref list (~line 110, after VIRAL_GUARDRAILS) AND to the Tier 2 list in the bottom
     "Related skills" section (~line 326). Add `tool-mastery/SKILL.md` to the **Tier 3** ref list
     (~line 117, after quality_gate) AND the bottom Tier 3 list (~line 338).
   - `automation_skills/content_engine/SKILL.md`: add both skills to its mandatory-references block.
   - `marketing_brain_skills/producers/REGISTRY.md`: register both under **Section G** (capabilities).
   - VERIFY each edit with `git diff` (NOT Read) before trusting it. `grep -c viral-playbook <file>`
     should go 0→correct count. Then run `node scripts/check-producer-skills.mjs` (both are
     capability skills with no output_type — they will be SKIPPED by the validator, which is correct;
     if the validator tries to validate them as producers, add their paths to
     CAPABILITY_AND_BRAIN_PATHS in `scripts/validate-producer.mjs`).
2. **Wire missing channel ingestors** into `snapshot-channels` (Meta/IG, TikTok, YouTube, LinkedIn,
   FUB, GSC, GBP) → fills `marketing_channel_daily` + `content_performance` → activates the
   already-built performance-bias loop. Token status (CLAUDE.md): Meta never-expires+full-scopes LIVE;
   YT/LinkedIn/X tokens exist; TikTok/Pinterest/Threads need first OAuth. Smoke-test each ingestor on
   a few rows before relying on it.
3. **Rewire `generate-briefs`** to default to the 3 winning format bets (hyperlocal YT neighborhood
   series→Shorts; monthly market-data drop; "what $X buys in Bend"), cover all channels, and let the
   now-data-fed performance-bias pick winners. Feed trend signals (platform-trends/competitor-recon)
   into the brief generator.
4. **Build `lib/replicate-video.ts`** shared helper (per tool-mastery §1) so producers call models
   correctly + consistently; add `next_text` chaining to `_voice_lib.synth_vo` (the one-line VO fix);
   add SFX + Music helpers. These make the mastery skill executable, not just documentation.
5. **SMOKE TEST the full upgraded workflow** on ONE piece (~$1-2 Replicate) end-to-end — pick the
   highest-leverage format (market-data drop or a listing hero with i2v) — render to `out/`, build a
   contact sheet, SHOW MATT before any default/bulk (smoke-test-before-bulk-spend + draft-first).

## The 3 format bets (the default organic rotation — from the research)
1. Hyperlocal YouTube neighborhood series (8-10 min, search-durable) → 45s Short. Highest ROI/hr.
2. Monthly market-data drop: ONE verified Supabase stat + contrast hook, 45-60s, Victoria VO.
3. "What $X buys in Bend": 3 tiers, 3 real properties, honest trade-offs. Fastest viewer→DM.
STOP: generic listing tours (algorithmically dead). Frame "Ryan Realty as a media operation that
happens to sell real estate." Self-test every piece: "would someone save/share this?"

## Guardrails
§0 data accuracy outranks all (live-trace every figure; never fabricate a listing's look/numbers).
§0.5 draft-first for RENDERED deliverables; skills/brain/infra commit freely (skill-authoring-autonomy).
Smoke-test paid APIs before batch. Brand-first not broker-first. Brand voice on all copy/VO.
CHANNEL PROTOCOL: verify via git/MCP/Write-confirmation, NOT Read, until the channel is stable.
