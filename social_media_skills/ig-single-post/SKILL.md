---
name: ig-single-post
description: >
  Canonical renderer for Ryan Realty single-image Instagram + Facebook feed posts at 1080×1350.
  Handles the S1–S10 template catalog: S1 Just Listed, S2 Just Sold, S3 Open House, S4 Coming
  Soon, S5 Price Improvement, S6 Featured Listing of the Week, S7 Agent Intro, S8 Brag Stat,
  S9 Press Feature, S10 Market Data Card. Payload-discriminated by `template` field. Enforces
  brand typography (Amboqia display, Geist body, Azo Sans Medium accent), data accuracy, voice
  rules, and the #RyanRealtyBend hashtag rule. Use whenever Matt asks for "a single IG post",
  "just listed post", "sold post", "coming soon post", "open house post", "price reduction
  post", "brag stat post", "press post", "market card", or "agent intro post". For multi-slide
  carousels use instagram-carousel. For static print/digital flyers use flyer-design.
when_to_use: |
  Triggered by phrases:
  - "make a just-listed post for <address>"
  - "build a sold post"
  - "create an open house post"
  - "coming soon teaser image"
  - "price improvement post for <MLS#>"
  - "featured listing of the week"
  - "agent intro post for <broker>"
  - "brag stat post — <stat>"
  - "press feature post"
  - "market data card for <city>"
  - any reference to S1, S2, ..., S10 by template number
action_types:
  - content:ig_single_post
---

# Instagram Single Post — S1–S10 Template Renderer

**Scope.** Render one 1080×1350 single-image Instagram feed post per call, selecting from
ten locked templates via the `template` payload field. Companion to `instagram-carousel`
(multi-slide) and `flyer-design` (print/digital flyers). Owns the visual realization of every
S-template. Does NOT generate caption text — captions are emitted by the caller (typically
`list-kit` or the brain via `produce`).

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B — Content Producer.

---

## 1. Required references

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy | Every number traces. Outranks all. |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Render to `out/`, surface, wait for approval. |
| `CLAUDE.md` "Voice + content" — #RyanRealtyBend HARD RULE | Captions emitted by caller must include `#RyanRealtyBend` first in hashtag block. |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy/cream, Amboqia/Geist/Azo Sans Medium type tiers. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes. |
| `social_media_skills/instagram-carousel/SKILL.md` | Footer band spec, broker headshot rule, photo discipline — single-post inherits these conventions. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 platform rule layer. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate. |
| `automation_skills/content_engine/SKILL.md` | Content routing bus. |

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:ig_single_post` | `template` + template-specific fields (see §3) | One call → one rendered PNG |

### Template catalog summary

| Template | Use | Required payload fields |
|---|---|---|
| **S1** | Just Listed | `mls_id`, `address`, `price`, `beds`, `baths`, `sqft` or `acres`, `list_agent`, `hero_photo` |
| **S2** | Just Sold | `mls_id`, `address`, `sold_price`, `dom_days`, `sale_to_list_pct`, `list_agent`, `hero_photo` |
| **S3** | Open House | `mls_id`, `address`, `price`, `open_date_iso`, `open_start_local`, `open_end_local`, `list_agent`, `hero_photo` |
| **S4** | Coming Soon | `mls_id`, `address`, `price`, `expected_active_date_iso`, `list_agent`, `hero_photo` (exterior only) |
| **S5** | Price Improvement | `mls_id`, `address`, `prior_price`, `new_price`, `list_agent`, `hero_photo` |
| **S6** | Featured Listing of the Week | `mls_id`, `address`, `price`, `editorial_subhead`, `list_agent`, `hero_photo` |
| **S7** | Agent Intro | `broker_slug` (matt-ryan / paul-stevenson / rebecca-peterson), `years_in_business`, `closings_last_12mo`, `signature_neighborhoods` |
| **S8** | Brag Stat | `stat_label`, `stat_value`, `stat_period`, `stat_source` (named primary source) |
| **S9** | Press Feature | `publication_name`, `article_title`, `article_url`, `quote_from_article`, `published_date_iso` |
| **S10** | Market Data Card | `city` or `neighborhood`, `metric`, `value`, `delta_yoy_pct`, `source`, `period` |

---

## 3. Payload schema

```typescript
type IgSinglePostTemplate =
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5'
  | 'S6' | 'S7' | 'S8' | 'S9' | 'S10'

interface IgSinglePostPayload {
  template: IgSinglePostTemplate
  // Template-specific fields — see §2 catalog summary
  [key: string]: unknown
}
```

The producer validates payload completeness against the template catalog before rendering.
Missing required field → surface to caller, do not render.

---

## 4. Canvas and persistent elements

**Canvas.** 1080 × 1350 px, sRGB, PNG output.

**Footer band** (every template, no exceptions):
- `y = 1170 → y = 1350` (180 px tall).
- Background: `rgba(16,39,66,0.94)` (near-opaque navy).
- Logo: `design_system/ryan-realty/assets/brand/logo-white.png`, 64 px tall, vertically centered,
  `40 px` from left edge.
- Right side of footer: `541.213.6706 · ryan-realty.com` (Geist 400, 16 px, `#faf8f4`,
  tabular-nums on phone, right-aligned, `40 px` from right edge, vertically centered).

**Safe zone.** All other content within `54 px` inset on left/right and `40 px` from top.
Content area is `y = 0 → y = 1170` (1170 px tall, 972 px wide content with 54 px insets).

**Broker headshot** (templates S1–S6 only — per-listing content):
- Source: `design_system/ryan-realty/assets/team/<resolved>.png`.
- Resolved via `list_agent` payload field → matt-ryan / paul-stevenson / rebecca-peterson.
- Size: 120 px wide circular crop (`border-radius: 50%`), placed bottom-left of content area
  immediately above the footer band, `y = 1010, left = 54px`.
- Agent name (Geist 500, 14 px, `#102742`, two lines): `<Full Name>` / `Principal Broker` (or
  role).

For S7 (Agent Intro), the headshot is the hero — full-frame, see §5.7.
For S8, S9, S10 (brand-led), no headshot. Use the Jax mascot from `assets/brand/blue-dog.png`
in the same corner instead (120 px wide, original aspect, no circle crop).

---

## 5. Per-template recipes

### 5.1 S1 — Just Listed

**Eyebrow** (Azo Sans Medium, 14 px, navy `#102742`, UPPERCASE, letter-spacing 0.16em, top of
content area at `y = 80, x = 54`):
`JUST LISTED · BEND, OREGON` (city pulled from payload).

**Hero photo block**:
- `y = 130 → y = 730` (600 px tall, 972 px wide, 14 px corner radius).
- `object-fit: cover` with 1.10 zoom on subject.

**Headline** (Amboqia Boriango, 56 px, navy, line-height 1.05, `y = 770`):
The street address line. E.g. `1234 NW Riverview Drive`.

**Price** (Amboqia Boriango, 72 px, navy, tabular-nums, `y = 850`):
`$895,000` (rounded to nearest $1,000).

**Specs row** (Geist 500, 22 px, navy, tabular-nums, `y = 940`):
`<N> bd  ·  <N> ba  ·  <N> sqft` (or `<N.NN> acres` if lot-dominant; middle-dot separators with
6 px padding either side).

**Broker headshot block** (per §4 spec).

### 5.2 S2 — Just Sold

**Eyebrow**: `JUST SOLD · <CITY>` (same style as S1).

**Hero photo**: same dimensions as S1, 14 px corner radius.

**Headline** (Amboqia, 56 px, navy): the address.

**Sold price** (Amboqia, 72 px, navy, tabular-nums): `$<sold_price>` rounded.

**Deal data row** (Geist 500, 20 px, navy, tabular-nums, `y = 940`):
`<dom_days> days  ·  <sale_to_list_pct>% of list`. If `sale_to_list_pct >= 100`, format as
`+<pct - 100>% over asking`. If `< 100`, format as `<pct>% of list`.

**Broker headshot block** (per §4).

### 5.3 S3 — Open House

**Eyebrow**: `OPEN HOUSE · <DAY OF WEEK>` (e.g. `OPEN HOUSE · SATURDAY`).

**Hero photo**: 600 px tall.

**Headline** (Amboqia, 56 px, navy): the address.

**Time block** (Geist 500, 32 px, navy, tabular-nums, `y = 800`):
`<open_start_local> – <open_end_local>` (e.g. `11:00 AM – 1:00 PM`).

**Date sub-line** (Geist 400, 20 px, navy 0.85 opacity, `y = 850`):
`<full date>` (e.g. `Saturday, May 17, 2026`).

**Price + specs row** (Geist 500, 20 px, navy, tabular-nums, `y = 900`):
`$<price>  ·  <N> bd  ·  <N> ba  ·  <N> sqft`.

**Broker headshot block** (per §4).

### 5.4 S4 — Coming Soon

**Eyebrow**: `COMING SOON · <CITY>` (Azo Sans Medium, same style).

**Hero photo**: 600 px tall. **Exterior only** — never an interior shot. If `hero_photo` looks
interior, surface to caller.

**Headline** (Amboqia, 56 px, navy): the address (street + city).

**Date line** (Geist 500, 24 px, navy, `y = 820`):
`Hitting the market <date>`. E.g. `Hitting the market May 24`. Format: `<Month> <day>` — no
year if same year.

**Price line** (Geist 500, 22 px, navy 0.85 opacity, `y = 870`):
`Listed at $<price>` (rounded). If price isn't finalized, render `Price TBD` — never invent.

**Broker headshot block** (per §4).

### 5.5 S5 — Price Improvement

**Eyebrow**: `PRICE IMPROVEMENT · <CITY>`.

**Hero photo**: 600 px tall.

**Headline** (Amboqia, 56 px, navy): the address.

**Old price** (Geist 500, 32 px, navy 0.50 opacity, strikethrough, `y = 800`, tabular-nums):
`$<prior_price>`.

**New price** (Amboqia, 64 px, navy, tabular-nums, `y = 850`):
`$<new_price>`.

**Delta line** (Geist 500, 18 px, navy 0.65 opacity, `y = 930`):
`$<prior_price - new_price> reduction` or `<pct>% reduction`.

**Broker headshot block** (per §4).

### 5.6 S6 — Featured Listing of the Week

**Eyebrow** (Azo Sans Medium, 14 px, navy, letter-spacing 0.18em, top center):
`FEATURED LISTING OF THE WEEK`.

**Hero photo**: 700 px tall (taller than other templates — this is the editorial moment).

**Editorial headline** (Amboqia Boriango, 48 px, navy, line-height 1.10, max 2 lines, `y = 850`):
The editorial subhead. E.g. `A barn on twelve acres in Tumalo.` Pulled from `editorial_subhead`
payload. Not the address.

**Address + price line** (Geist 400, 16 px, navy 0.65 opacity, tabular-nums, `y = 980`):
`<Address>  ·  $<price>`. This is small intentionally — the editorial line carries the post.

**Broker headshot block** (per §4).

### 5.7 S7 — Agent Intro

**Eyebrow**: `THE TEAM AT RYAN REALTY`.

**Hero**: the broker's PNG (transparent) from `design_system/ryan-realty/assets/team/<slug>.png`.
Rendered at full content width, vertically centered. Subject is the broker; cream background
shows through transparent PNG edges. No corner radius.

**Name** (Amboqia, 56 px, navy, line-height 1.05, below the portrait, `y = 880`):
The broker's full name.

**Role line** (Geist 500, 20 px, navy 0.85 opacity, `y = 940`):
The broker's title. Owner / Principal Broker (Matt) · Broker (Paul, Rebecca).

**Stats line** (Geist 400, 16 px, navy 0.65 opacity, tabular-nums, `y = 980`):
`<years_in_business> years selling in Bend  ·  <closings_last_12mo> closings in the last 12 months`.

**Signature neighborhoods** (Geist 400, 14 px, navy 0.55 opacity, `y = 1010`):
`Signature: <neighborhoods joined with ·>` (max 4 neighborhoods).

No separate headshot block — the portrait IS the post.

### 5.8 S8 — Brag Stat

**Eyebrow**: `RYAN REALTY · <STAT_PERIOD>` (e.g. `RYAN REALTY · LAST 12 MONTHS`).

**No hero photo.** Cream `#faf8f4` background.

**Stat label** (Geist 500, 22 px, navy 0.85 opacity, UPPERCASE, letter-spacing 0.08em,
`y = 380`):
The stat label. E.g. `MEDIAN DAYS ON MARKET`.

**Stat value** (Amboqia Boriango, 156 px, navy, tabular-nums, `y = 440`):
The number with units. E.g. `38 days`, `$895K`, `97% of list`.

**Source line** (Geist 400, 14 px, navy 0.55 opacity, `y = 720`):
`Source: <stat_source> · <stat_period>`.

**Jax mascot** in the corner per §4 spec.

### 5.9 S9 — Press Feature

**Eyebrow**: `AS SEEN IN · <PUBLICATION>` (UPPERCASE, Azo Sans Medium 14 px, letter-spacing
0.16em).

**No hero photo.** Cream background.

**Pull quote** (Amboqia, 44 px, navy, line-height 1.20, `y = 320`, max 4 lines):
`"<quote_from_article>"` — opening + closing typographic quote marks.

**Attribution** (Geist 400, 18 px, navy 0.65 opacity, `y = 720`):
`<article_title>  ·  <publication_name>  ·  <published_date>`.

**Jax mascot** in the corner per §4 spec.

### 5.10 S10 — Market Data Card

**Eyebrow**: `<CITY OR NEIGHBORHOOD> · <PERIOD>` (e.g. `BEND · MAY 2026`).

**No hero photo.** Cream background.

**Metric label** (Geist 500, 22 px, navy 0.85 opacity, UPPERCASE, letter-spacing 0.08em,
`y = 380`):
E.g. `MEDIAN SALE PRICE`.

**Primary value** (Amboqia, 140 px, navy, tabular-nums, `y = 440`):
The number with units. E.g. `$895K`, `38 days`, `4.2 months`.

**YoY delta** (Geist 500, 26 px, navy, tabular-nums, `y = 700`):
With Unicode arrow and signed pct: `↑ 4.2% year over year` or `↓ 2.1% year over year`.

**Source line** (Geist 400, 14 px, navy 0.55 opacity, `y = 770`):
`Source: <source> · <period>`.

**Jax mascot** in the corner per §4 spec.

---

## 6. Render procedure

```bash
# Producer invokes the compositor script:
node lib/render-ig-single-post.mjs \
  --template <S1..S10> \
  --payload out/ig-single-post/<slug>/payload.json \
  --out out/ig-single-post/<slug>/post.png
```

Compositor lives at `lib/render-ig-single-post.mjs` (build if absent — uses the same canvas /
fonts / brand assets pipeline as `lib/render-just-listed-flyer.mjs` per `flyer-design/SKILL.md`).

Pre-render asset audit:
- Fonts on disk: `Amboqia_Boriango.otf`, `AzoSans-Medium.ttf`, Geist (next/font/geist).
- Logo on disk: `design_system/ryan-realty/assets/brand/logo-white.png`.
- Broker headshot on disk (if S1–S6): `design_system/ryan-realty/assets/team/<slug>.png`.
- Jax mascot on disk (if S8/S9/S10): `design_system/ryan-realty/assets/brand/blue-dog.png`.
- Hero photo on disk (if S1–S6) or pull from Supabase / Spark.

If any asset missing: stop, surface to caller, do not fall back to system fonts or substitute
images.

---

## 7. Output structure

```
out/ig-single-post/<slug>/
├── payload.json              ← the action row's payload field
├── post.png                  ← the rendered 1080×1350 PNG
├── citations.json            ← one entry per figure shown
├── provenance.json           ← photo source + license
├── fonts_used.json           ← exact font files embedded
└── design_scorecard.json     ← QA gate results
```

### citations.json shape (per CLAUDE.md §0)

```json
{
  "figures": [
    {
      "figure": "$895,000",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ListPrice",
      "value": 895000,
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ]
}
```

S8 / S9 / S10 stats may trace to Supabase tables (`market_pulse_live`, `market_stats_cache`),
named primary sources (NAR, ORMLS, Case-Shiller), or an external press URL (S9).

---

## 8. QA gate

Run before surfacing the draft. Write results to `design_scorecard.json`. Any `fail` = non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Canvas dimensions | Exactly 1080 × 1350 px |
| 2 | Footer band | Present, navy 0.94 opacity, logo + contact line correct |
| 3 | Template adherence | All required elements present per §5 spec for the template |
| 4 | Font integrity | Amboqia, Geist, Azo Sans Medium all loaded from disk; no fallback in render |
| 5 | Tabular numerals | Every price / count / day / pct has `font-variant-numeric: tabular-nums` |
| 6 | Data verified | Every figure traces to `citations.json` with source, filter, fetched_at |
| 7 | Photo integrity | If template uses a hero, photo is from MLS / approved source, traced in `provenance.json`, no watermarks, no AI fake |
| 8 | Safe zone | No critical content within 54 px of left/right or 40 px of top |
| 9 | Color compliance | Navy `#102742` + cream `#faf8f4` only. No gold. No off-brand hex |
| 10 | Banned words clean | Grep all on-image text against `voice_guidelines.md` §6 union — zero hits |
| 11 | Broker resolution | S1–S6: `list_agent` resolved to one of three brokers. Headshot present |
| 12 | Pattern C font discipline | If the post is editorial (S6), body uses Geist 500 — not Azo Sans Medium |
| 13 | File size | < 3 MB PNG |

If S6 includes an `editorial_subhead` that contains banned vocab: stop, surface for revision.

---

## 9. Approval gate

`matt-review-draft` — Matt sees the rendered PNG + caption (from caller) and says "ship it" /
"approved" / "go" before any commit or publish.

Surface format:

```
Single post ready for review — <template> · <address-or-subject>

  IMAGE
    Path: out/ig-single-post/<slug>/post.png
    Template: <S1..S10>
    Dimensions: 1080 × 1350 ✓

  VERIFICATION TRACE
    <one line per figure>

  CITATIONS
    out/ig-single-post/<slug>/citations.json

Reply "ship it" to commit + push.
```

Then stop. Wait.

---

## 10. Status flow

Per `marketing_brain_skills/producers/TEMPLATE.md` §8:

```
pending → in_production → ready → approved → executed → measured
```

The producer transitions:
- `pending → in_production` on pickup, sets `executed_at = now()`.
- `in_production → ready` after the QA gate passes, populates `executor_response` with
  `{"draft_path": "out/ig-single-post/<slug>/post.png", "template": "<S?>", "scorecard": {...}}`.
- The orchestrator / produce skill handles `ready → approved → executed → measured`.

---

## 11. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Missing payload field | template selected but required field absent | Surface to caller with the specific missing field; do not render |
| Broker not resolved | `list_agent` doesn't map to matt-ryan / paul-stevenson / rebecca-peterson | Surface; offer fallback to Jax for brand-led variants, or ask Matt to disambiguate |
| Hero photo missing | S1–S6 needs hero, payload has no `hero_photo` path or URL | Surface; offer to fetch from Spark / Supabase or pause |
| AI-generated photo detected | `provenance.json` source flagged AI | Hard fail per ANTI_SLOP_MANIFESTO. Do not render |
| Banned vocab on canvas | grep hit in headline / eyebrow / source line | Stop. Re-write the copy. Re-validate |
| Font fallback at render | Amboqia / Geist / Azo Sans Medium not on disk | Stop. Report missing file. Do not ship with system fonts |
| S10 stat without source | `stat_source` missing or stat doesn't trace to a primary source | Stop. Pull source. No "approximately" |
| S9 article URL dead | Press URL returns 404 / paywall preview | Surface to Matt; ask whether to swap the quote or pause |

---

## 12. What not to do

1. **Never use AI-generated property photos.** Hard fail per ANTI_SLOP_MANIFESTO.
2. **Never substitute fonts.** If Amboqia or Geist or Azo Sans Medium isn't on disk, stop.
3. **Never invent numbers.** Every stat traces. S10 requires `stat_source` and S8 requires
   `stat_period` for a reason — without those, the post does not ship.
4. **Never mix templates.** One post = one template. Don't combine S1's headline with S6's
   editorial subhead.
5. **Never re-typeset the wordmark.** Always use the pre-rendered PNG.
6. **Never use exclamation marks** in eyebrow, headline, source line, or any on-image text.
7. **Never use em-dashes or semicolons** in on-image copy.
8. **Never use gold** (`#D4AF37`, `#C8A864`). Monochrome navy on cream only.
9. **Never claim a quality without evidence.** S8 brags must be sourced. "Top producing" /
   "#1 in Bend" / "Award-winning" — non-compliant without a cited basis in the same post.
10. **Never publish without the caller's caption passing #RyanRealtyBend validation.** The
    renderer doesn't write captions, but it refuses to enter `ready` state if the caller's
    caption is missing or malformed (when caption is supplied via payload).

---

## 13. See also

- `social_media_skills/instagram-carousel/SKILL.md` — multi-slide companion (Patterns A/B/C/D)
- `social_media_skills/flyer-design/SKILL.md` — static flyers (print + digital)
- `social_media_skills/list-kit/SKILL.md` — the at-Active orchestrator (S1 default trigger)
- `marketing_brain_skills/producers/TEMPLATE.md` — producer skeleton
- `marketing_brain_skills/producers/REGISTRY.md` — Section B row
- `automation_skills/content_engine/SKILL.md` — content routing bus
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — banned vocab union
- `design_system/ryan-realty/SKILL.md` — brand system
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate
