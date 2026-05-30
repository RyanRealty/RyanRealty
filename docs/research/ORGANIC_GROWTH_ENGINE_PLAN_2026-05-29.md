# Organic-growth content engine — synthesis + build plan (2026-05-29)

Matt's directive: *don't just audit — become expert in each tool, learn what's going viral today, encode that mastery into easy-to-load skills, and rewire the brain so it organically grows every social channel with excellent content based on what's working now. We're barely scratching the surface of tools that can do so much.*

This synthesizes 5 parallel research streams. Source docs:
- `docs/research/TOOL_MASTERY_ai_video_2026.md` (Replicate video stack)
- `docs/research/TOOL_MASTERY_audio_2026.md` (ElevenLabs full suite)
- `docs/research/TOOL_MASTERY_image_static_2026.md` (Flux/Ideogram/Grok + carousels/thumbnails)
- `docs/research/VIRAL_PATTERNS_2026.md` (what wins per platform now)
- `docs/research/BRAIN_LOGIC_MAP_2026-05-29.md` (the loop, with file:line)

## The one finding that reframes everything

**The brain's measure→learn loop is already wired in code and starved of data.**
`lib/marketing-brain/performance-bias.ts` (2026-05-17) reads `content_performance`, computes a
per-(format,platform) `bias_score`, multiplies `rank_score` in `synthesizeOpportunities()`, can
suppress formats 25% below baseline and boost 25% above, and `pickAuditWinningFormat()` can
override static defaults. **But** `snapshot-channels` only has GA4 + X ingestors live. Meta/IG,
TikTok, YouTube, LinkedIn, FUB, GSC, GBP are "pending" → `marketing_channel_daily` and
`content_performance` are empty for them → `diagnose-performance` returns `insufficient_data` →
the bias multiplier is a no-op. **So "grow all channels based on what's working today" is mostly a
DATA-WIRING problem, not a logic problem.** Highest leverage in the whole project.

## Strategy (what the engine should make)

The frame shift from the viral research: **Ryan Realty is a media operation that happens to sell
real estate, not a real-estate operation that happens to post.** Every piece answers one specific
question a real buyer/seller is asking now. Self-test: "would someone save or share this?" — if no,
rework before producing.

Three highest-leverage format bets (these become the brain's default organic rotation):
1. **Hyperlocal YouTube neighborhood series** (8-10 min, search-durable for years) → cut to a 45s Short. Highest ROI/hour.
2. **Monthly market-data drop** — ONE verified Supabase stat with a contrast hook, 45-60s, Victoria VO. Saves/shares are the top-weighted 2026 signal.
3. **"What $X buys in Bend"** — 3 tiers, 3 real properties, honest trade-offs. Fastest viewer→DM converter.

Stop the generic listing tour (walk-through + features + music = algorithmically invisible/dead).

Hook/hold rules (2026): motion by 0.4s, on-screen text by 1.0s, first word is content, hook carries a number/place/contradiction/visual-surprise; TikTok completion gate ~70%, 5s qualified-view; saves + DM-shares weighted 3-5× likes.

## Tool mastery (the part we were barely using)

**Video (Replicate):** one camera move per clip (the #1 prompting rule — models warp on concurrent moves). Default model per content type:
- Listing hero $750K+ → Kling v2.1 Master ($0.80/5s)
- Mid-market batch / cinemagraph (water, curtains, foliage) → Hailuo 02 ($0.27-0.48/6s)
- Hook needing ambient audio → Veo 3 Fast ($1.25/8s, native audio — skips the post-audio pass)
- Neighborhood/lifestyle b-roll volume + t2v → Wan 2.5 i2v (cheapest; 16fps native → transcode to 30fps for Remotion)
- Atmospheric luxury → Ray 2 720p. Draft-before-hero → Seedance Fast.
i2v from a real listing photo when fidelity matters; t2v for generic b-roll. Chain: cheap draft → pick → Kling hero → upscale.

**Audio (ElevenLabs — 3 untapped wins):** SFX API (`/v1/sound-generation`) for transition whooshes + stat-reveal hits; Music API (`POST /v1/music`, already paid, commercial-clear — kills Suno/Udio copyright risk, prompt a BPM and beat-sync cuts); Pronunciation Dictionary (solves phoneme-vs-delivery-tag conflict). Single biggest VO lever: add `next_text` chaining to `_voice_lib.synth_vo()` (one-line fix — stops the "AI voice ends every line" drop). Listing-reel mix: hook SFX at t=0 (-10dBFS), music 90BPM ducked -20→-8 under VO, Victoria -11dBFS, ambient -28dBFS, final -16 LUFS.

**Image (Replicate/Grok):** Flux.2 Pro for photoreal architectural/lifestyle (natural-language prompts + real camera specs, no keyword lists/negatives); Ideogram v3 for text-in-image; Grok Imagine for fast A/B thumbnail grids. Carousel is the save-engine (3.1× engagement, 2× saves vs Reels; re-served to non-swipers) — adopt the 8-10 slide market-data carousel (one stat/slide, cover feels incomplete without swiping). Thumbnail = curiosity gap (thumb shows the number "↑42%", title explains; 3-4 words max, local specificity "Tumalo" > "Central Oregon"). NEVER fabricate a real listing's look (§0).

## Build plan (ranked by leverage)

1. **Wire the missing channel ingestors** (Meta/IG, TikTok, YouTube, LinkedIn, FUB, GSC, GBP) into `snapshot-channels` → fills `marketing_channel_daily` + `content_performance` → activates the already-built performance-bias loop, cadence-gap detector, diagnose layer, measurement loop for ALL organic channels. THE unlock for "grow all channels by what's working today." (Token status per CLAUDE.md: Meta token never-expires + full scopes LIVE; YT/LinkedIn/X tokens exist; TikTok/Pinterest/Threads need first OAuth.)
2. **Build `video_production_skills/tool-mastery/SKILL.md`** — synthesize the 3 tool-mastery research docs into ONE loadable skill: per-tool prompt templates, decision matrix (shot→model→cost), audio mix recipe, image/carousel/thumbnail rules, chaining pipelines. Wire into `producers/TEMPLATE.md` Tier 3 + `content_engine/SKILL.md` mandatory refs + REGISTRY Section G so it AUTO-loads at produce-time (today nothing picks the right model — left to stub-prone producers).
3. **Build `video_production_skills/viral-playbook/SKILL.md`** — what IS working per platform in 2026 (formats, hooks, hold rules, cadence, AI-native formats + the slop line). Complements ANTI_SLOP (what not to do) + VIRAL_GUARDRAILS (quality floor) with what-to-do. Wire into TEMPLATE.md Tier 2 + content_engine refs + REGISTRY.
4. **Rewire brief generation** — `generate-briefs` defaults to the 3 winning format bets, covers all channels, and lets the (now data-fed) performance-bias pick winners. Trend signals (platform-trends/competitor-recon) feed the brief generator.
5. **Smoke-test the full upgraded workflow** on ONE piece (~$1-2 Replicate) end-to-end, show Matt before any default/bulk (smoke-test-before-bulk-spend rule).

## Guardrails
§0 data accuracy outranks all (every figure live-traced; never fabricate a listing's look/numbers).
§0.5 draft-first: rendered samples shown before commit; skill/brain/infra authoring commits freely
(skill-authoring-autonomy). Smoke-test paid APIs before batch. Brand voice on all copy/VO.
Brand-first not broker-first. Channel-instability protocol: verify each file op; MCP for DB.
