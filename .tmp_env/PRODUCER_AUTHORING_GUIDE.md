# Producer SKILL.md Authoring Guide — Ryan Realty Marketing Brain

This file is the shared brief for subagents authoring new producer SKILL.md files. Read it once, then write the file you've been assigned.

## Role

Ryan Realty is a small Bend, Oregon real-estate brokerage. A marketing brain dispatches actions to producers via `marketing_brain_actions` rows in Supabase. Each producer is a self-contained skill that takes one action row and executes its specific deliverable. You are authoring ONE producer SKILL.md file.

## Reference exemplars (READ BEFORE WRITING)

Open these files first — they define the depth, tone, and structure your output must match:

1. `/Users/matthewryan/RyanRealty/marketing_brain_skills/producers/TEMPLATE.md` — the canonical 10-section structure.
2. `/Users/matthewryan/RyanRealty/social_media_skills/list-kit/SKILL.md` — orchestrator exemplar.
3. `/Users/matthewryan/RyanRealty/social_media_skills/ig-single-post/SKILL.md` — content-producer exemplar.
4. `/Users/matthewryan/RyanRealty/social_media_skills/instagram-carousel/SKILL.md` — visual-renderer exemplar with payload-discrimination.

Don't copy verbatim — extract the shape, then write a sibling skill for the producer you've been assigned.

## Anthropic SKILL.md frontmatter (REQUIRED)

```yaml
---
name: <slug>           # exact directory name, no path
description: >
  One paragraph: what the skill does + when to trigger. Be "pushy" — Claude undertriggers
  skills. End with: "Use this whenever Matt says X / Y / Z." This is the primary triggering
  signal so include rich trigger context.
when_to_use: |
  Trigger when Matt says any of:
  - "<exact phrase>"
  - "<exact phrase>"
action_types:
  - <content|site|ops|comms>:<slug>
---
```

## 10-section structure (REQUIRED)

Match `TEMPLATE.md` order exactly:

1. **Scope** — in scope + out of scope (1 paragraph each).
2. **Action types handled** — table with `action_type | required payload fields | notes` rows.
3. **Brief payload schema** — TypeScript `interface ProducerNamePayload { ... }`.
4. **The recipe** — numbered procedure (Step 1 → Step N). Each step concrete. Reference sub-skills by path. Include the SQL transitions (`status='in_production'` on pickup, `status='ready'` after draft).
5. **Tools used** — table with `tool | purpose | env var / path` rows.
6. **Output format** — file structure tree + the exact "Draft surface format" block to present to Matt.
7. **Approval gate** — name the gate type (matt-review-draft / matt-review-PR / matt-explicit / none).
8. **Status flow** — ASCII diagram + the SQL transitions block from TEMPLATE.md §8.
9. **Failure modes** — table with `failure | symptoms | recovery` rows. Cover at least 5 plausible failures.
10. **Related skills and references** — list mandatory refs + format sub-skills + capabilities used + registry pointer.

Total length: 300–500 lines. Match the rigor of ig-single-post/SKILL.md (its 450-ish lines is the depth bar).

## Mandatory references (LIST in §1 or §10 — do not skip)

Every producer SKILL.md must reference these — they are the load-bearing rules:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content" — #RyanRealtyBend HARD RULE (for any producer that emits captions)
- `design_system/ryan-realty/SKILL.md` — brand register, type tiers, asset cheat sheet
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice attributes, banned vocab union
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's writing fingerprint
- `automation_skills/content_engine/SKILL.md` — content router (for `content:*` producers)
- `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer (for any platform-targeted producer)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate
- `marketing_brain_skills/producers/TEMPLATE.md` — producer template
- `marketing_brain_skills/producers/REGISTRY.md` — registry pointer (note the section A-F the producer belongs to)

For video producers, also reference:
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §3 — listing video rules
- `video_production_skills/VIRAL_GUARDRAILS.md` — scorecard + format minimums
- `video_production_skills/elevenlabs_voice/SKILL.md` — Victoria voice settings
- `video_production_skills/quality_gate/SKILL.md` — QA gate procedure

For site producers, also reference:
- `CLAUDE.md` "Design System Rules — MANDATORY" — shadcn/ui rules

## Banned vocab union (ENFORCE in every on-canvas, on-page, on-asset, caption, VO, headline, subject line, body)

Real-estate clichés: stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey, immaculate, captivating, exquisite, premier, luxury, boutique, concierge, white-glove, passionate, dedicated.

AI filler: delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster.

Vague qualifiers: approximately, roughly, about, around, fairly, somewhat, may, could, potentially.

Punctuation in body: em-dashes (—), semicolons, dramatic colons. (Em-dash is allowed as a "no data" placeholder only.)

Banned phrases: "your real estate journey", "we are passionate about", "we pride ourselves on", "premier brokerage", "top 1%", "white glove service", "boutique brokerage", "don't worry", "act fast", "won't last long", "won't last".

## #RyanRealtyBend rule (HARD RULE — for any producer that emits captions)

If your producer emits captions for IG / TikTok / Threads / X / Pinterest / Facebook / LinkedIn / YouTube descriptions, the caption MUST lead its trailing hashtag block with `#RyanRealtyBend`. Locked 2026-05-14 per CLAUDE.md "Voice + content."

Hashtag-stripping surfaces are EXEMPT — do NOT inject hashtags into Gmail bodies, SMS, blog post body copy on ryan-realty.com, broker email signatures, or FUB lead-nurture emails.

## H&H caption format (default for IG / FB feed captions)

```
[Location-anchored opening — neighborhood or street name, one specific anchor]

[Materials / architecture / construction-detail middle — 1–3 specific facts]

[Lifestyle close — one specific local detail: trail, brewery, school, view, drive time]

》 [Address]  ·  [Price]  ·  [BR/BA]  ·  [acres or sqft]

#RyanRealtyBend
#BendOregon
#BendRealEstate
#[Neighborhood]Bend
#CentralOregonRealEstate
```

For panorama variants (carousel Pattern D), opening reads `SWIPE → | <hook>` to invite the swipe.

## Brand constraints (v2 — locked 2026-05-12)

- Primary palette: navy `#102742` + cream `#faf8f4`. NO gold (`#D4AF37`, `#C8A864` are retired).
- Fonts: Amboqia Boriango (display/headlines), Geist (body/UI/data/numerals), Azo Sans Medium (arched-ribbon UPPERCASE sub-labels only — NOT for body copy).
- Wordmark: pre-rendered images at `design_system/ryan-realty/assets/brand/logo-blue.png` (heritage navy) or `logo-white.png` (reversed for dark surfaces). Never re-typeset.
- Broker headshots: `design_system/ryan-realty/assets/team/<slug>.png` (transparent default; `.jpg` fallback). Three brokers — `matt-ryan`, `paul-stevenson`, `rebecca-peterson`. Resolve from Supabase `ListAgentFullName` / `ListAgentEmail`.
- Jax mascot for brand-led (non-listing-specific) content: `design_system/ryan-realty/assets/brand/blue-dog.png` (navy on light) / `white-dog.png` (white on dark).

## Voice constraints

- "You/your" is the subject. "We/our team" for broker identity. Never "I" (except in personal contexts like a video VO from Matt directly).
- Sentence case for headings. Title case only for hero H1.
- Tabular numerals on every numeric surface (`font-variant-numeric: tabular-nums`).
- Currency rounded to the nearest thousand: `$895,000` not `$894,750`.
- Days = integer + "days": `38 days`.
- Unavailable data → em-dash `—` placeholder.
- Percents: one decimal, signed arrow: `↑ 2.1% YoY`.
- Phone: `541.213.6706` (dotted). FUB-tracked bio phone: `541.703.3095`.
- Web: `ryan-realty.com` (hyphenated, lowercase).
- Social handles: `@ryanrealtybend` everywhere (IG, TikTok, Threads, YouTube, X, Pinterest), `/ryanrealtybend` on Facebook + LinkedIn.

## Data accuracy (CLAUDE.md §0)

Every figure in every deliverable traces to: live Supabase (the brain's `dwvlophlbvvygjfxcrhm` project), Spark MLS API, or a named primary source (NAR, ORMLS, Case-Shiller, Census, etc.). No fabricating. No "approximately." No round-fill.

The producer MUST emit a `citations.json` next to every draft that includes any number, with one entry per figure: `source`, `filter`, `column`, `value`, `fetched_at`.

## Supabase schema quirk (CLAUDE.md "Supabase listings Schema")

The `listings` table uses mixed-case column names. Every reference to a mixed-case column must be wrapped in double quotes in SQL, or the query returns "column does not exist." Key columns:

`"MlsId"`, `"StreetNumber"`, `"StreetName"`, `"City"`, `"PostalCode"`, `"ListPrice"`, `"StandardStatus"`, `"PhotoURL"`, `"PublicRemarks"`, `"ListAgentFullName"`, `"ListAgentEmail"`, `"ListOfficeName"`, `"SubdivisionName"`, `"BedroomsTotal"`, `"BathroomsTotal"`, `"TotalLivingAreaSqFt"`, `"Latitude"`, `"Longitude"`, `"CumulativeDaysOnMarket"`.

Lowercase (no quotes needed): `year_built`, `pending_timestamp`, `price_per_sqft`.

## Approval gate by category

- `content:*` → **matt-review-draft** (Matt sees the rendered draft + caption + scorecard; replies "ship it" / "approved" / "go").
- `site:*` → **matt-review-PR** (a PR is opened on GitHub; Matt merges).
- `ops:*` → **matt-explicit** (Matt explicitly names the action verbatim before execute; never inferred).
- `comms:alert:*` → **none** (auto-deliver to iMessage/email; medium/low lands in dashboard).
- `comms:email:*` → **matt-explicit**.
- `analyze:*` → **none** (findings written to `marketing_decisions`; surfaced in next digest).

## Status flow (ASCII required in §8)

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ draft complete, QA passed
        ▼
      ready        ← executor_response populated with draft_path + scorecard
        │ Matt says "ship it" (content) / merges PR (site) / explicitly names action (ops)
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ publish step completes (commit + push / PR merge / API call)
        ▼
    executed       ← terminal success
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes metrics to content_performance

    killed         ← terminal failure; set if Matt cancels or QA fails after 2 auto-iterations
```

SQL transitions (include in §8):

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"...","scorecard":{}}'::jsonb
WHERE id='<id>';

UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

## Output — what you write

Write ONE SKILL.md file at the exact path I name. Use the `Write` tool. Create the parent directory implicitly via Write.

DO NOT commit. DO NOT push. DO NOT touch REGISTRY.md or content_engine/SKILL.md — the parent orchestrator will handle registry wiring.

If you create scripts/assets/references subdirs, that's fine, but the SKILL.md is the deliverable. Bias toward the SKILL.md alone unless a referenced script is genuinely load-bearing.

## Tone

Match the existing producer SKILL.md tone — declarative, terse where possible, specific about pixel coordinates / SQL queries / API endpoints / failure conditions. No fluff. Every section earns its place.

## If you're unsure about a spec detail

Make a reasonable best-call and document the choice in §9 (Failure modes) under "Open spec questions." Don't ask back — write the file.
