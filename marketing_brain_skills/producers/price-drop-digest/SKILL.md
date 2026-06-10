---
name: price-drop-digest
description: >
  Produces a weekly social artifact from the Price Drop Radar — city-scoped or region-wide
  IG caption, static card, and optional Reel hook — sourcing live verified data from the
  getPriceDropDigest DAL function. Never invents numbers.
action_types:
  - content:price_drop_digest
---

# Price Drop Digest Producer

> All development routes through THE LOOP v1.0.0 — see [docs/DEVELOPMENT_PROCESS.md](../../../docs/DEVELOPMENT_PROCESS.md). Every producer inherits its preflight contract, verification bar, and approval model.

**Scope:** Produces a weekly "price drops" social artifact for Ryan Realty's IG feed (and
optionally FB + LinkedIn) using the live Price Drop Radar data pipeline. Pulls aggregate
stats via `getPriceDropDigest()` from `lib/data/listings/getPriceDrops.ts`, writes a
brand-voice caption, and hands off a static card brief (dimensions, text, data) for the
`ig-single-post` or `instagram-carousel` producer to render. Does NOT produce the rendered
image or Reel itself — it authors the data layer and caption text only.

**Status:** Canonical
**Locked:** 2026-06-09
**Exemplar output:** `out/price-drop-digest/<city>/<date>/digest.json` + `caption.txt`

---

## 1. Scope

### In scope
- One `digest.json` per city or region carrying: count, totalReduced, biggestDrop (address + amount), medianDropPct, fetchedAt, cityLabel
- One `caption.txt` per city or region: brand-voice IG caption (120–180 words, no em-dash, no banned words, no exclamation in body)
- Optional: static card brief (for `ig-single-post` to render)
- Respects day filter: default 14 days; override via payload `days` field

### Out of scope
- Rendering the static image card or Reel video — delegate to `ig-single-post` (`content:ig_single_post` → S10 Market Data Card variant) or `market_pulse_short`
- Sending or scheduling the post — delegate to `ops-email-send` or the `publisher` capability
- Per-listing detail (individual listing cards) — that is the `listing-tour-video` or `listing_reveal` producer's scope

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:price_drop_digest` | `city` (optional, omit for region-wide) | Produces caption + digest.json for one city or all of Central Oregon |

### Payload schema

```typescript
interface PriceDropDigestPayload {
  city?: string           // SITE_CITY_SLUGS slug (e.g. 'bend', 'redmond'). Omit = region-wide.
  days?: number           // recency window in days (default 14)
  surface?: 'ig' | 'fb' | 'linkedin'  // target channel; default 'ig'
}
```

---

## 3. Required references (Tier 1 + Tier 2)

This producer MUST load in order before executing:

1. `CLAUDE.md` §0 — Data Accuracy mandate (non-negotiable)
2. `CLAUDE.md` §0.5 — Draft-First, Commit-Last
3. `design_system/ryan-realty/SKILL.md` — brand visual system
4. `marketing_brain_skills/brand-voice/SKILL.md` + `voice_guidelines.md` — voice enforcement
5. `automation_skills/content_engine/SKILL.md` — routing bus
6. `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer
7. `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate
8. `video_production_skills/VIRAL_GUARDRAILS.md` — scorecard + format minimums

---

## 4. The recipe

### Step 0 — Preflight

Read the DAL file before writing any data:
```
lib/data/listings/getPriceDrops.ts
```
Verify `getPriceDropDigest` is exported and understand its return shape before pulling.

### Step 1 — Pull live data

Call `getPriceDropDigest(cityOrRegion, days)` via the server-side DAL:

- `cityOrRegion`: the payload `city` slug, or `'central-oregon'` for region-wide
- `days`: payload `days` or default `14`

The function returns:
```typescript
{
  count: number              // active SFR listings with a price drop in the window
  totalReduced: number       // aggregate dollar amount reduced (in $1K rounded)
  biggestDrop: PriceDrop | null  // listing with the largest dollar reduction
  medianDropPct: number      // median reduction percentage across all drops
  fetchedAt: string          // ISO timestamp from the query
}
```

**If count === 0:** do not fabricate a caption. Write `digest.json` with count = 0 and a note
explaining the empty state. Surface to Matt; do not dispatch a social post from zero data.

### Step 2 — Build digest.json

Write to `out/price-drop-digest/<city-or-region>/<YYYY-MM-DD>/digest.json`:

```json
{
  "producer": "price-drop-digest",
  "generatedAt": "<ISO>",
  "fetchedAt": "<from DAL>",
  "city": "<city slug or 'central-oregon'>",
  "cityLabel": "<display name, e.g. 'Bend' or 'Central Oregon'>",
  "days": 14,
  "count": 12,
  "totalReduced": 2847000,
  "medianDropPct": 2.4,
  "biggestDrop": {
    "mlsNumber": "...",
    "address": "...",
    "lastDropAmount": 75000,
    "lastDropPct": 6.2,
    "listPrice": 1125000
  }
}
```

### Step 3 — Write caption.txt

Caption rules (all enforced, no exceptions):
- **Never reuse a stale number.** Every figure in the caption traces to the `digest.json` from Step 2.
- **Format numbers per brand voice:** currency rounded to nearest $1K (`$2,847,000` → `$2.8M`), percents to one decimal with signed arrow (`↓ 2.4%`), count as integer.
- **No em-dash, no semicolon, no exclamation in body.**
- **No banned words:** stunning, nestled, boasts, charming, dream home, luxury, etc.
- **Lead with the number, not the product.** Start with the market fact, not "Ryan Realty reports..."
- **Target 120–180 words for IG.** LinkedIn may run longer (up to 300 words).
- **One CTA, end of caption only:** direct to `/price-drops` or `/price-drops/<city>`.
- **Hashtag line (IG only):** 5–8 tags, last line. Example: `#BendRealEstate #PriceReductions #CentralOregon #HomeBuyers #BendOregon`

Caption structure:
```
[Hook — the market fact in 1–2 sentences]
[Context — why this matters to a buyer right now]
[Biggest drop callout — "The sharpest reduction: [address], down [amount]"]
[CTA — "See every active price drop at ryan-realty.com/price-drops"]

[Hashtags — IG only]
```

### Step 4 — Optional static card brief

If the action row includes `surface: 'ig'` and the `ig-single-post` producer is available,
write a card brief JSON alongside the caption:

```json
{
  "template": "S10",
  "variant": "market-data-card",
  "headline": "12 Price Drops",
  "subline": "in Bend — last 14 days",
  "stat1": { "label": "Total reduced", "value": "$2.8M" },
  "stat2": { "label": "Median cut", "value": "↓ 2.4%" },
  "stat3": { "label": "Biggest drop", "value": "$75K" },
  "ctaLabel": "View all drops",
  "ctaHref": "ryan-realty.com/price-drops/bend",
  "background": "navy",
  "textColor": "cream"
}
```

### Step 5 — Voice self-check

Before surfacing to Matt, run the brand-voice grep on `caption.txt`:

1. Grep for em-dash, en-dash, semicolon — must be zero hits
2. Grep for each banned word in `voice_guidelines.md` §6.2 — must be zero hits
3. Verify every figure in the caption appears verbatim in `digest.json` (data trace)
4. Confirm the CTA link is `/price-drops` or `/price-drops/<city>` (real route)

If any grep hits: fix before surfacing.

### Step 6 — Surface to Matt

Present as:

> **Draft ready:** `out/price-drop-digest/<city>/<date>/caption.txt`
> **Data source:** `getPriceDropDigest('bend', 14)` — fetchedAt `<ISO>`, count `12`, medianDropPct `2.4%`
> **Scorecard:** N/A (static copy — no video scorecard)
> **Verification trace:** `count=12` — `lib/data/listings/getPriceDrops.ts:getPriceDropDigest`, city=bend, days=14, fetchedAt=`<ISO>`
> **Ready to hand off to `ig-single-post` and commit on your sign-off.**

---

## 5. Tools used

| tool | purpose |
|---|---|
| `lib/data/listings/getPriceDrops.ts` → `getPriceDropDigest()` | Live data pull — city or region aggregate |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Voice enforcement |
| `social_media_skills/platform-best-practices/SKILL.md` | Channel-specific caption length + hashtag guidance |

No paid APIs required. No MLS re-queries — the DAL handles all data access.

---

## 6. Output format

| artifact | path | format |
|---|---|---|
| Data digest | `out/price-drop-digest/<city>/<date>/digest.json` | JSON |
| IG caption | `out/price-drop-digest/<city>/<date>/caption.txt` | Plain text |
| Card brief (optional) | `out/price-drop-digest/<city>/<date>/card-brief.json` | JSON for `ig-single-post` |

All outputs land in `out/` (gitignored). Nothing commits until Matt approves.

---

## 7. Approval gate

**matt-review-draft.** Matt reads the caption, verifies it matches his voice and the data, and
says "ship it" / "approved" / "go." Silence is not approval. A passing data trace is not approval.

After approval: hand the card brief to `ig-single-post` for render, then commit + push the
`caption.txt` and `digest.json` to the repo as a record of what was published and when.

---

## 8. Status flow

```
pending
  → in_production  (producer picks up row, pulls live data)
  → ready          (digest.json + caption.txt written, voice check passed)
  → approved       (Matt says "ship it")
  → executed       (ig-single-post renders card, publisher schedules post)
  → measured       (performance_loop writes engagement metrics after 48h)
```

---

## 9. Failure modes

| failure | cause | recovery |
|---|---|---|
| `count === 0` | No active SFR price drops in the recency window for the city | Write empty digest.json, surface to Matt with count=0, do not post. Try region-wide or extend `days` to 21. |
| DAL throws | Supabase connection issue or schema drift | Log the error, transition row to `killed`, alert Matt via `comms:matt_alert`. |
| Voice self-check fails | Caption contains banned word or em-dash | Fix the caption before surfacing. Never show Matt a failing draft. |
| Missing DAL column | `days_since_last_price_change` or `last_price_change_amount` NULL for many rows | Check schema snapshot at `docs/DATABASE_SCHEMA_SNAPSHOT.md`; check if MLS enrichment pipeline is running. Surface to Matt as a data-quality issue. |

---

## 10. Related skills

- `lib/data/listings/getPriceDrops.ts` — the DAL this producer wraps
- `app/price-drops/page.tsx` + `app/price-drops/[city]/page.tsx` — the web surface this digest promotes
- `social_media_skills/ig-single-post/SKILL.md` — renders the static card (template S10)
- `video_production_skills/market_pulse_short/SKILL.md` — if the digest should become a short-form video
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement
- `social_media_skills/platform-best-practices/SKILL.md` — channel rules
