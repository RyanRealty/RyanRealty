---
name: under-contract-announcement
description: >
  Canonical producer for the single 1080×1350 static "Under Contract" post Ryan Realty drops on
  Instagram and Facebook the day a listing flips to Pending in the MLS. Data-only, calm reporting
  voice — never celebration. The point is social proof for sellers vetting agents: a clean fact
  card ("Under contract in 4 days. $22K over asking.") that reads like a track record, not a
  victory lap. No "Just sold!", no "We did it!", no exclamation marks, no emoji, no fireworks.
  Outputs one PNG plus a paired caption.md and citations.json. Use this whenever Matt says
  "build the pending post", "under contract post for <address>", "pending announcement", or
  "social post for <MLS#> going pending". For Just Sold (after closing) use ig-single-post S2.
  For Just Listed at Active use list-kit / ig-single-post S1.
when_to_use: |
  Trigger when Matt says any of:
  - "under contract post for <address>"
  - "under contract post for <MLS#>"
  - "pending announcement for <address>"
  - "social post for <MLS#> going pending"
  - "build the pending post"
  - "we went pending on <address> — make the post"
  - "draft the under contract for <slug>"
action_types:
  - content:under_contract_announcement
---

# Under Contract Announcement — Pending Listing Post

**Scope.** Build one 1080×1350 single-image post (PNG) for Instagram and Facebook feeds plus a
paired caption when a listing transitions from Active to Pending in the MLS. The post is a
social-proof card: address, days on market at pending, list price, optional expected close date,
listing agent's headshot, navy-on-cream brand chrome. Voice is calm reporting, not celebration.
Companion to `ig-single-post` (S1 Just Listed, S2 Just Sold) and `list-kit` (the Active
orchestrator). This producer fires once per listing per pending transition.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B — Content Producer.

**Exemplar output path:** `out/under-contract/<slug>/`.

---

## 1. Scope

### In scope

- Render ONE 1080×1350 sRGB PNG to `out/under-contract/<slug>/post.png`.
- Write ONE `caption.md` (H&H format, see §5) sized for IG/FB feed.
- Write ONE `citations.json` tracing every number on the canvas to its Supabase source.
- Resolve the listing agent's headshot from the Supabase `listings` row and render it in the
  per-listing slot per shared `ig-single-post` §4 footer spec.
- Compute `dom_at_pending` from list date and pending date if not supplied; verify against
  Supabase before rendering.
- Run the QA gate in §7 before surfacing.

### Out of scope

- Just Sold posts (closed listings) — use `social_media_skills/ig-single-post/SKILL.md` template
  S2. Different status, different copy, different stat panel (sold price + sale-to-list).
- Just Listed posts (new Active listings) — use `social_media_skills/ig-single-post/SKILL.md`
  template S1 or the full `social_media_skills/list-kit/SKILL.md` orchestrator.
- Carousels (multi-slide swipe posts) — use `social_media_skills/instagram-carousel/SKILL.md`.
- Email blasts, blog posts, video reels, GBP posts — those are separate producers.
- Publishing. This producer surfaces a draft; commit + push + publish happen only after Matt
  says "ship it" per `CLAUDE.md` §0.5 (Draft-First, Commit-Last).

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `content:under_contract_announcement` | `mls_id`, `list_price`, `pending_timestamp`, `dom_at_pending` | One call → one PNG + caption + citations |

### Optional payload fields

| field | purpose |
|---|---|
| `expected_close_date_iso` | If supplied, renders the subline below the stat row. If absent, the subline is suppressed entirely (no placeholder, no em-dash). |

### Trigger sources

The brain enqueues this action_type when the nightly listing audit
(`automation_skills/listing_trigger/SKILL.md`) detects an `Active → Pending` status transition.
Manual invocation via `marketing_brain_skills/produce/SKILL.md` is supported — Matt names the
MLS#; the produce skill writes the action row.

---

## 3. Brief payload schema

```typescript
interface UnderContractAnnouncementPayload {
  mls_id: string                        // required — e.g. "220189422"
  list_price: number                    // required — pulled from Supabase listings."ListPrice"
  pending_timestamp: string             // required — ISO timestamp from listings.pending_timestamp
  dom_at_pending: number                // required — integer days; (pending - list)/24h, floored
  expected_close_date_iso?: string      // optional ISO date — renders subline if present
}
```

The action row carries this payload plus the standard `data_evidence` envelope from
`automation_skills/listing_trigger/SKILL.md` (`audit_source: 'listing_trigger'`,
`status_transition: 'Active→Pending'`, `detected_at: <iso>`). Missing any required field →
surface to caller, do not render. Never invent a date or guess DOM from a vague description.

---

## 4. The recipe

**Step 1 — Read the action row**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately:

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<action_id>' AND status='pending';
```

**Step 2 — Load mandatory references** (see §13 for the full list).

**Step 3 — Pull and verify source data**

Every figure on the canvas comes from a live query in this session. Never inherit payload
numbers without re-verifying.

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "ListPrice", "StandardStatus",
       "PhotoURL", "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
       "ListAgentFullName", "ListAgentEmail", "ListDate", pending_timestamp
FROM listings WHERE "MlsId" = '<mls_id>' LIMIT 1;
```

Re-confirm:

- `StandardStatus = 'Pending'` (if Active, the row is stale — surface).
- `pending_timestamp` non-null, matches payload within 1-day tolerance for TZ drift.
- `ListPrice` matches payload exactly.
- Re-compute `dom_at_pending = floor((pending_timestamp - ListDate) / 86400)`. If it differs
  from the payload value, live wins; surface the discrepancy.

`dom_at_pending == 0` renders as `1 day` — never "0 days," never "same day."

**Step 4 — Resolve listing agent and assets**

Map `ListAgentEmail` (preferred) or `ListAgentFullName` to one of three broker slugs:
`matt-ryan` / `paul-stevenson` / `rebecca-peterson`. Headshot path:
`design_system/ryan-realty/assets/team/<slug>.png` (transparent). Non-Ryan-Realty agent →
surface; this producer is Ryan Realty listings only.

Pull the MLS hero photo from `"PhotoURL"` (or Spark API `/listings/<MlsId>/media` fallback).
Source-trace to `provenance.json`. Never substitute stock or AI.

**Step 5 — Compose the 1080×1350 canvas**

Build per §6. Use the same compositor pattern as `lib/render-ig-single-post.mjs` — same fonts,
brand assets pipeline, sRGB color space. If a compositor doesn't exist, extend the
ig-single-post renderer with a `template === 'UC'` path; do not fork.

```bash
node lib/render-under-contract.mjs \
  --payload out/under-contract/<slug>/payload.json \
  --out out/under-contract/<slug>/post.png
```

Slug format: `<mls_id>-<street-name-slugified>` (e.g. `220189422-nw-riverview-drive`).

**Step 6 — Write the caption** per §5.

**Step 7 — Run the QA gate** per §7. Write results to `design_scorecard.json`. Any `fail` =
non-ship.

**Step 8 — Write citations.json** — one entry per figure shown on the canvas:

```json
{
  "figures": [
    { "figure": "4 days", "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "computed from ListDate, pending_timestamp",
      "value": 4, "fetched_at": "2026-05-14T14:32:00Z" },
    { "figure": "$895,000", "source": "Supabase listings",
      "filter": "MlsId='220189422'", "column": "ListPrice",
      "value": 895000, "fetched_at": "2026-05-14T14:32:00Z" }
  ]
}
```

**Step 9 — UPDATE the action row to ready**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response=jsonb_build_object(
      'draft_path', 'out/under-contract/<slug>/post.png',
      'caption_path', 'out/under-contract/<slug>/caption.md',
      'citations_path', 'out/under-contract/<slug>/citations.json',
      'scorecard', '<scorecard json>'::jsonb
    )
WHERE id='<action_id>';
```

**Step 10 — Surface draft to Matt**

Use the format in §6. Stop. Do not commit. Do not push. Wait for "ship it" / "approved" / "go."

---

## 5. Caption template (H&H format)

```
Under contract in <city>.

<Fact line 1: e.g. "Four days on market." or "One day on market.">
<Optional fact line 2: list price or "Expected to close <Month> <day>.">

Thanks to our buyers, the seller, and the agent across the table for a clean deal.

》 <Address> · $<List Price>K · <BR>BR / <BA>BA · <sqft> sqft

#RyanRealtyBend
#BendOregon
#BendRealEstate
#UnderContract
#CentralOregonRealEstate
```

Worked example:

```
Under contract in Bend.

Four days on market. Listed at $895,000.
Expected to close June 12.

Thanks to our buyers, the seller, and the agent across the table for a clean deal.

》 1234 NW Riverview Drive · $895K · 4BR / 3BA · 2,840 sqft

#RyanRealtyBend #BendOregon #BendRealEstate #UnderContract #CentralOregonRealEstate
```

### Caption voice rules (hard)

- **No exclamation marks.** Anywhere — eyebrow, body, address line. The post is a fact card.
- **No celebration language.** "Just sold!" / "We did it!" / "Off the market!" / "Another one
  in the books" / "Honored" / "Blessed" / "Humbled" / "Thrilled" — all non-compliant.
- **No emoji.** Anywhere. Banned per CLAUDE.md "Voice + content."
- **No manufactured scarcity.** "Act fast," "won't last," "before it's gone" — banned.
- **No em-dashes (—) or semicolons in body.** Em-dash is missing-data placeholder only.
- **`#RyanRealtyBend` leads the hashtag block.** HARD RULE (CLAUDE.md "Voice + content").
- **Currency rounded to nearest thousand.** `$895,000` in body; `$895K` in the 》 line.
- **Days = integer + "days"** (`4 days`). Single-day deal renders `One day on market.` —
  brevity carries it; no padding.

---

## 6. Visual spec — 1080 × 1350 canvas

Canvas 1080 × 1350 px, sRGB PNG. Background cream `#faf8f4` (`--rr-cream`). Safe zone: 54 px
left/right, 40 px top. Color compliance: navy + cream only (no gold, no off-brand hex). The
MLS hero photo's natural colors are allowed inside its crop.

**Persistent layers** — inherited verbatim from `social_media_skills/ig-single-post/SKILL.md`
§4. Footer band (`y = 1170 → 1350`, 180 px, navy 0.94 opacity, `logo-white.png` 64 px tall
40 px from left, `541.213.6706 · ryan-realty.com` right-aligned in Geist 400 16 px). Broker
headshot (`assets/team/<slug>.png` transparent, 120 px circular at `y = 1010, x = 54`, with
Geist 500 14 px name + role to the right).

| Element | Spec |
|---|---|
| **Eyebrow** | Azo Sans Medium 14 px, navy, UPPERCASE, letter-spacing `0.16em`, at `y = 80, x = 54`. Copy: `UNDER CONTRACT · <CITY>` (e.g. `UNDER CONTRACT · BEND, OREGON`). City from `listings."City"`, rendered UPPERCASE. |
| **Hero photo** | `y = 130 → 730` (600 px tall × 972 px wide), 14 px corner radius (`--radius-xl`), `object-fit: cover` with 1.10 zoom on subject. MLS-sourced; trace to `provenance.json`. No scrim, no overlay text on the photo. |
| **Headline (address)** | Amboqia Boriango 56 px, navy, line-height 1.05, at `y = 770, x = 54`. Copy: `<StreetNumber> <StreetName>` (e.g. `1234 NW Riverview Drive`). One line; if address > 26 chars, drop to 48 px and allow two lines. |
| **Stats line** | Geist 500 28 px, navy, tabular-nums, at `y = 870, x = 54`. Copy: `<N> days  ·  $<price>` with middle-dot (6 px padding each side). Days = integer + " days". Price = `$895,000` (rounded to nearest $1,000, comma-grouped). |
| **Expected close subline (optional)** | Geist 400 16 px, navy 0.55 opacity, at `y = 920, x = 54`. Copy: `Expected to close <Month> <day>` (no year unless cross-year). Renders ONLY if `expected_close_date_iso` is supplied; if absent, suppressed entirely (no placeholder, no em-dash, no "TBD"). |

---

## 7. Output structure

```
out/under-contract/<slug>/
├── payload.json              ← the action row's payload field
├── post.png                  ← the rendered 1080×1350 PNG
├── caption.md                ← the H&H caption per §5
├── citations.json            ← one entry per figure (CLAUDE.md §0 trace)
├── provenance.json           ← MLS hero photo source + license
├── fonts_used.json           ← exact font files embedded
└── design_scorecard.json     ← QA gate results
```

### Draft surface format (present to Matt exactly like this)

```
Draft ready: under-contract-announcement — <address>

  IMAGE
    Path: out/under-contract/<slug>/post.png
    Dimensions: 1080 × 1350 ✓
    Template: UC (under-contract)

  CAPTION
    Path: out/under-contract/<slug>/caption.md
    Lead hashtag: #RyanRealtyBend ✓
    Banned-word grep: clean ✓

  VERIFICATION TRACE
    - <dom_at_pending> days — Supabase listings, MlsId='<mls_id>', computed from ListDate +
      pending_timestamp, fetched <iso>
    - $<list_price> — Supabase listings, MlsId='<mls_id>', column ListPrice, fetched <iso>
    - <expected close date if present> — Supabase listings, MlsId='<mls_id>',
      column expected_close_date, fetched <iso>

  CITATIONS
    out/under-contract/<slug>/citations.json

Reply "ship it" / "approved" / "go" to commit + push.
```

Then stop. Do not commit. Do not push. Wait.

---

## 8. QA gate

Run before surfacing the draft. Write results to `design_scorecard.json`. Any `fail` = non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Canvas | Exactly 1080 × 1350 px, sRGB, PNG, < 3 MB |
| 2 | Status check | Supabase live `StandardStatus = 'Pending'` confirmed at render time |
| 3 | Footer band | Navy 0.94 opacity, logo + phone + URL line correct per §6 |
| 4 | Eyebrow | `UNDER CONTRACT · <CITY>`, Azo Sans Medium 14 px, letter-spacing 0.16em |
| 5 | Hero photo | MLS-sourced, traced in `provenance.json`, no watermark, no AI fake |
| 6 | Headline | Address present, Amboqia 56 px (or 48 px two-line), navy |
| 7 | Stats line | `<N> days  ·  $<price>` present, Geist 500 28 px, tabular-nums |
| 8 | Expected close subline | Present iff payload has `expected_close_date_iso`; no placeholder when absent |
| 9 | Broker headshot | Resolved PNG at 120 px circular, name + role rendered |
| 10 | Color + font integrity | Navy + cream only (no gold, no off-brand hex); Amboqia/Geist/Azo Sans Medium loaded from disk; tabular-nums on all numbers |
| 11 | Data verified | Every figure traces to `citations.json` with source, filter, fetched_at |
| 12 | Caption — hashtags | `#RyanRealtyBend` is the FIRST hashtag in the trailing block |
| 13 | Caption — banned vocab + punctuation | grep clean against union list; zero em-dashes, semicolons, exclamation marks, emoji |
| 14 | Caption — celebration + scarcity | Zero "Just sold!", "We did it!", "Off the market!", "Honored," "Blessed," "Thrilled," "act fast," "won't last," "before it's gone" |
| 15 | Currency + day formatting | Price rounded to nearest $1,000 (stats line) / `$<N>K` (》 line); integer + " days"; `dom == 0` → `1 day` |
| 16 | Safe zone | All non-footer content within 54 px / 40 px insets |

Any single failure: do not enter `ready`. Iterate up to 2 auto-fixes; on the third failure,
surface with the specific check + literal triggering value.

---

## 9. Approval gate

`matt-review-draft` — Matt sees the rendered PNG + caption.md + verification trace and replies
"ship it" / "approved" / "go" before any commit, push, or publish step.

Silence is not approval. A passing QA scorecard is necessary, not sufficient. A successful
render is necessary, not sufficient. Matt's words trigger the next state.

---

## 10. Status flow

```
     pending
        │ producer reads row
        ▼
  in_production   ← executed_at = now()
        │ draft complete, QA gate passes
        ▼
      ready        ← executor_response populated with draft_path + caption_path + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ orchestrator commits + pushes + posts via publisher
        ▼
    executed       ← terminal success
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes IG/FB engagement to content_performance

    killed         ← terminal failure; set if Matt cancels or QA fails after 2 auto-iterations
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"...","caption_path":"...","scorecard":{}}'::jsonb
WHERE id='<id>';

-- On Matt approval (handled by orchestrator, not this producer):
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 11. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| `pending_timestamp` missing or null | Supabase row has `pending_timestamp = NULL` despite `StandardStatus='Pending'` | Stop. Surface to Matt with the MLS#. Possible upstream MLS sync issue. Set `status='killed'`. Do not invent a timestamp. |
| Status reverted to Active | Listing went Pending then back to Active before render | Stop. Surface. QA step 2 (status check) catches this. `status='killed'` with stale-data note. |
| MLS hero photo missing or 404 | `PhotoURL` null or returns 4xx | Try Spark MLS API `/listings/<MlsId>/media`. If still missing, surface — never substitute stock or AI. |
| DOM computation fails | `ListDate` null, negative result, or mismatch vs. payload | Print both values (payload vs. live). Surface the discrepancy. Live data wins; do not silently override. |
| Listing agent not in roster | `ListAgentEmail` doesn't map to one of the three brokers | Stop. Surface — this producer is for Ryan Realty listings only. |
| Banned vocab in caption | Grep hit against the union list | Re-write the offending sentence using corpus voice rules. Max 2 auto-iterations; then surface. |
| Hashtag rule violated | `#RyanRealtyBend` missing or not first | Auto-fix: re-emit with `#RyanRealtyBend` leading. Re-grep. Surface if auto-fix fails. |
| Font missing on disk | Amboqia / Geist / Azo Sans Medium not present | Stop. Report file path. Do NOT ship with system fonts. |
| Address exceeds two-line wrap | Even 48 px won't fit two lines | Drop to 40 px. If still overflowing, surface for manual abbreviation. |
| `expected_close_date_iso` is in the past | Payload date predates today | Suppress subline. Note in `executor_response.warnings` and proceed. |
| Render timeout or OOM | Compositor hangs > 90s | Kill process. Report last-frame attempt + error log. Suspect corrupt hero photo or font. |

### Open spec questions (best-call documented)

- **Showings count.** `listings` doesn't carry `showings_count` by default. Default: skip
  showings; use DOM + price as the two facts. If Matt wants showings, pull from ShowingTime.
- **Co-listed listings.** Headshot defaults to the Ryan Realty broker (or primary
  `ListAgentEmail` if both are Ryan Realty). Outside co-list → surface.
- **Pending sub-statuses.** Any status containing `Pending` is treated as pending. "Pending —
  Taking Backups" gets the same template; surface only if Matt wants distinct copy.

---

## 12. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | `listings` row pull, `marketing_brain_actions` row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Spark MLS API | Hero photo media fallback when `PhotoURL` is null | `SPARK_API_BASE_URL`, `SPARK_API_KEY` |
| Local Node renderer | 1080×1350 PNG composite | `lib/render-under-contract.mjs` (extends `lib/render-ig-single-post.mjs`) |
| Brand asset bundle | Logo, fonts, broker headshots | `design_system/ryan-realty/assets/` |
| Banned-vocab linter | Caption + on-canvas text gate | `marketing_brain_skills/brand-voice/voice_guidelines.md` (the union list) |

---

## 13. Related skills and references

**Required reading (load before executing):**

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks everything).
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything).
- `CLAUDE.md` "Voice + content" — #RyanRealtyBend HARD RULE.
- `design_system/ryan-realty/SKILL.md` — brand visual system, navy/cream, type tiers.
- `design_system/ryan-realty/colors_and_type.css` — authoritative tokens.
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice attributes + banned vocab.
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's writing fingerprint.
- `social_media_skills/ig-single-post/SKILL.md` §4 — footer + broker headshot inherited verbatim.
- `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer.
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate.
- `automation_skills/content_engine/SKILL.md` — content routing bus (invocation path).

**Sibling and contractual:**

- `social_media_skills/list-kit/SKILL.md` — Active orchestrator (the at-Active sibling).
- `social_media_skills/instagram-carousel/SKILL.md` — multi-slide alternative if Matt wants more.
- `automation_skills/listing_trigger/SKILL.md` — nightly status-change scan that enqueues this
  action_type.

**Producer skeleton + registry:**

- `marketing_brain_skills/producers/TEMPLATE.md` — producer template.
- `marketing_brain_skills/producers/REGISTRY.md` — Section B, row `under-contract-announcement`.

---

## 14. What not to do

1. **Never use celebration language or exclamation marks.** "Just sold!" / "We did it!" /
   "Off the market!" — banned. The post is a fact card.
2. **Never add emoji.** Anywhere.
3. **Never invent a date, DOM, or price.** Every number traces to live Supabase.
4. **Never substitute the hero photo.** MLS-sourced only. No stock, no AI, no similar-property
   approximation.
5. **Never use gold (`#D4AF37`, `#C8A864`).** Both retired. Navy + cream only.
6. **Never publish without `#RyanRealtyBend` leading the hashtag block.** HARD RULE.
7. **Never commit or push before Matt approves.** Render to `out/`, surface, wait.
8. **Never skip the broker headshot.** The listing agent's face is the social-proof anchor.
9. **Never mix this template with S1 / S2 / S5.** If Matt asks for "Just Sold" or "Just Listed,"
   route to `ig-single-post` S2 or S1 instead.
10. **Never round in a way that changes the narrative.** `$894,750 → $895,000` is fine;
    `$894,750 → $900,000` is not.
