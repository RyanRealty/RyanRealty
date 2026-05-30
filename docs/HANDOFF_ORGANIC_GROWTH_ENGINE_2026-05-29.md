# Handoff — organic-growth content engine build (2026-05-29)

**Status: skill + enforcement layer COMPLETE. Resume at "Step D — the organic-growth DATA wiring."**
Paused for a fresh session because the remaining work touches live API credentials + runs paid
generation, and this session's tool-output channel was intermittently fabricating `Read`/`Bash`
output (never `Edit`/`Write`/`git`/MCP — those stayed reliable). Resume clean; trust git + a fresh
terminal for verification, not in-session Read.

## Matt's directives (this session) — all structural ones DONE
1. Become expert in each AI tool, learn what's viral now, encode into easy-to-LOAD skills, rewire the
   brain to organically grow EVERY channel with what's-working-today content. ← skills DONE; brain
   data-wiring is Step D below.
2. Remove the interior-AI-video ban. ✅ DONE (`d95ffa2`).
3. Enforce as GATES, not prose that does nothing. ✅ DONE — G36 live (`0d6bfd3`).

## DONE + COMMITTED + PUSHED (verify with `git log` in a clean session)
- `d6e26df` de-fabricated cloud executor (producer slop root cause); 17 fabricated rows killed.
- `390d28b` local render worker `scripts/render-worker.mjs`.
- `4034651` G35 producer-skill gate + 8 producers green.
- `7b3c9f2` SIX research docs in `docs/research/` (~185KB genuine 2026 expertise):
  TOOL_MASTERY_ai_video_2026, TOOL_MASTERY_audio_2026, TOOL_MASTERY_image_static_2026,
  VIRAL_PATTERNS_2026, BRAIN_LOGIC_MAP_2026-05-29, ORGANIC_GROWTH_ENGINE_PLAN_2026-05-29.
- `2a437d5` TWO loadable skills: `video_production_skills/tool-mastery/SKILL.md` (how to use every AI
  tool correctly) + `video_production_skills/viral-playbook/SKILL.md` (what's working now).
- `d95ffa2` retired the interior-AI ban in `ai_platforms/SKILL.md` (i2v of real listing photos now
  allowed, exteriors AND interiors; slop guardrails intact) + added the G36 gate script.
- `0d6bfd3` ACTIVATED G36: wired both skills into content_engine + TEMPLATE (Tier 2 viral-playbook,
  Tier 3 tool-mastery) + REGISTRY Section G + validate-producer skip-list; added `ci:tool-discipline`
  to `ci:gates`; wrote the baseline; documented G36 in MECHANICAL_GATES.md.

### Verified green at handoff (all via git/CI, not Read)
- G35 producer-skills: 96 scanned · 76 pass · 20 skipped · 0 fail.
- G36 tool-discipline: Layer 1 OK (both chokepoints reference both skills) · Layer 2 26 grandfathered,
  0 new. exit 0.
- 430 vitest pass. package.json valid + `ci:gates` includes `ci:tool-discipline`. sync behind:0 ahead:0.

## What G36 guarantees (so the fresh session understands the contract)
- LAYER 1 (hard): the build FAILS if `automation_skills/content_engine/SKILL.md` OR
  `marketing_brain_skills/producers/TEMPLATE.md` stops referencing tool-mastery OR viral-playbook, or
  if either skill file disappears. The skills can't rot back into "prose nobody loads."
- LAYER 2 (ratcheted): no NEW inline ElevenLabs/Replicate-video API calls. 26 current inline callers
  (the `listing_video_v4/scripts/synth_*.py` drift) grandfathered in
  `scripts/.tool-discipline-baseline.json`; the set may only shrink. Migrating one + running
  `npm run ci:tool-discipline:baseline` tightens it.

## ⚠️ RESUME HERE — Step D: the organic-growth DATA wiring (the actual goal)
Read `docs/research/ORGANIC_GROWTH_ENGINE_PLAN_2026-05-29.md` first. THE KEY FINDING: the brain's
measure→learn loop is ALREADY BUILT (`lib/marketing-brain/performance-bias.ts`, 2026-05-17 — reads
content_performance, computes per-(format,platform) bias, multiplies opportunity rank) and STARVED OF
DATA — only GA4 + X channel ingestors are live. So "grow all channels by what's working today" is a
DATA-WIRING problem, not a logic problem. In leverage order:

1. **Wire the 7 missing channel ingestors** into `snapshot-channels` (Meta/IG, TikTok, YouTube,
   LinkedIn, FUB, GSC, GBP) → fills `marketing_channel_daily` + `content_performance` → activates the
   already-built performance-bias loop, cadence-gap detector, diagnose layer, measurement loop for
   ALL organic channels. **#1 unlock.** Tokens (CLAUDE.md): Meta never-expires+full-scope LIVE;
   YT/LinkedIn/X tokens exist; TikTok/Pinterest/Threads need first OAuth. SMOKE-TEST each ingestor on
   a few rows before relying on it (memory: smoke_test_before_bulk_spend). Start with the LIVE-token
   channels (Meta/IG) to prove the pattern, then the rest.
2. **Build `lib/replicate-video.ts`** shared helper (per tool-mastery §1) — makes the mastery skill
   executable AND satisfies G36 Layer 2 for video. Add `next_text` chaining to `_voice_lib.synth_vo`
   (one-line VO-quality fix — stops "AI voice ends every line"). Add SFX + Music helpers.
3. **Rewire `generate-briefs`** to default to the 3 winning format bets + cover all channels + let the
   now-data-fed performance-bias pick winners; feed trend signals (platform-trends/competitor-recon)
   into the brief generator.
4. **SMOKE-TEST** the full upgraded workflow on ONE piece (~$1-2 Replicate) end-to-end — pick the
   highest-leverage format (market-data drop, or a listing hero via i2v) — render to `out/`, build a
   contact sheet, SHOW MATT before any default/bulk (smoke-test-before-bulk-spend + draft-first §0.5).

### Also still open from the earlier producer pass (lower priority than Step D)
The Tier-1 copy-wrapper stubs (cma/listing-tour/market_data/flyer/ig-single/neighborhood_tour/
clip_compilation) still `shutil.copy` the Tumalo exemplar on the legacy orchestrator/CLI path. The
deployed cloud path no longer fabricates (de-fabricated + visual producers deferred to the render
worker), so this is no longer a publish risk — but the stubs should still be rewired to their real
generators (all verified to exist). Full list in `docs/PRODUCER_TOOL_UTILIZATION_AUDIT_2026-05-28.md`
Tier 1. Each rewire needs a render-verify + draft-first review.

## The 3 format bets (default organic rotation — from VIRAL_PATTERNS_2026)
1. Hyperlocal YouTube neighborhood series (8-10 min, search-durable) → 45s Short. Highest ROI/hr.
2. Monthly market-data drop: ONE verified Supabase stat + contrast hook, 45-60s, Victoria VO.
3. "What $X buys in Bend": 3 tiers, 3 real properties, honest trade-offs. Fastest viewer→DM.
STOP generic listing tours (algorithmically dead). "Media operation that happens to sell real estate."
Self-test every piece: "would someone save/share this?"

## Guardrails
§0 data accuracy outranks all (live-trace every figure; never fabricate a listing's look/numbers).
§0.5 draft-first for RENDERED deliverables; skills/brain/infra commit freely (skill-authoring-autonomy).
Smoke-test paid APIs before batch. Brand-first not broker-first. Brand voice on all copy/VO.
No background subagents on API-heavy pipelines. Scope FUB ops to Matt only.
