---
name: sold-deal-summary
description: >
  When a Ryan Realty listing closes, produce two deliverables in a single call: (1) a 1080×1350
  IG/FB "Just Sold" static post via the S2 template (delegated to ig-single-post) and (2) a
  native LinkedIn text post (no image) that reframes the same deal as market insight for a
  professional / relocation / tech-buyer audience. One Supabase pull → two surfaces, two voices,
  identical numbers. Enforces data accuracy (sold price, DOM, sale-to-list pct all trace to the
  verified listing row), brand voice (no "honored to" / "humbled to" / "journey"), the
  #RyanRealtyBend hashtag rule for IG, and the LinkedIn no-hashtag exception. Use whenever Matt
  asks for a sold post, a closing announcement, or a deal wrap-up across IG + LinkedIn.
when_to_use: |
  Trigger when Matt says any of:
  - "sold deal summary for <address>"
  - "build the sold post for <MLS#>"
  - "closing announcement for <address or MLS#>"
  - "sold post + linkedin"
  - "wrap up the deal at <address>"
  - "we closed on <address>.  make the posts"
  - "just sold for <MLS#>"
  - "/sold-deal-summary <address or MLS#>"
action_types:
  - content:sold_deal_summary
output_type: text
target_platforms: ["email", "agentfire_blog"]
asset_destination: Supabase asset-library bucket + out/proof/<date>/<slug>/
auto_inputs: ["brand voice rules", "market data from Supabase"]
required_inputs: ["topic OR mls_id"]
optional_inputs: ["tone_override", "length_override"]
estimated_runtime_min: 8
cost_usd_estimate: $0.10-$0.50 per piece (Anthropic tokens for drafting + voice check)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.html
example_outputs: []
    label: "past approved drafts"
    surface: "email"
---

# Sold Deal Summary.  IG Just Sold Post + LinkedIn Market-Insight Post

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Given one closed Ryan Realty listing, emit two deliverables from one verified data
pull: an Instagram/Facebook 1080×1350 "Just Sold" static image (S2 template, rendered via
`ig-single-post`) and a LinkedIn native text post (no image required) that frames the same
close as a market-insight read. Numbers are identical across both surfaces; voice and angle
differ by platform. Companion captions for the IG post (H&H format) are emitted alongside the
PNG.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B.  Content Producer (per
`marketing_brain_skills/producers/REGISTRY.md`).

**Exemplar output:** `out/sold-deal/<slug>/`

---

## 1. Required references.  load before producing

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy mandate | Every number (sold price, DOM, sale-to-list pct) traces. Outranks all. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render to `out/`, surface both deliverables, wait for explicit approval. |
| `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE | IG caption MUST lead its trailing hashtag block with `#RyanRealtyBend`. LinkedIn body is EXEMPT (LinkedIn doesn't honor hashtags well). |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy/cream, type tiers. The IG post inherits S2 conventions. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Voice attributes, banned vocab union. Applies to BOTH the IG caption AND the LinkedIn body. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint.  terse, useful, no flourish. |
| `social_media_skills/ig-single-post/SKILL.md` | The S2 Just Sold template renderer. This producer delegates the IG image to it. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 platform rule layer.  LinkedIn native text vs link-post rules; no-hashtag convention. |
| `automation_skills/content_engine/SKILL.md` | Content routing bus. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate.  applies to text as well as visual. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer skeleton. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B row pointer. |

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:sold_deal_summary` | `mls_id`, `sold_price`, `close_date`, `dom_total`, `sale_to_list_pct` | One call → IG PNG + IG caption + LinkedIn body |

Captions and the LinkedIn body are first-class deliverables.  not afterthoughts on the visual.

**Trigger contexts:** brain-generated when a Supabase scan detects `StandardStatus: Pending →
Closed` in the last 24h; manual via `produce/SKILL.md` when Matt names a closed address;
post-close fan-out from `list-kit/SKILL.md` when a kit listing closes.

---

## 3. Brief payload schema

```typescript
interface SoldDealSummaryPayload {
  // Required.  every field traces to the Supabase listings row at close.
  mls_id: string              // e.g. "220189422"
  sold_price: number          // ClosePrice.  actual integer dollars from Supabase
  close_date: string          // CloseDate, ISO yyyy-mm-dd
  dom_total: number           // Cumulative days from list to close (integer)
  sale_to_list_pct: number    // (ClosePrice / ListPrice) × 100, one-decimal precision

  // Optional.  derived or supplied
  linkedin_angle?: string     // 1-line market-insight framing. If absent, recipe derives one.
  list_agent?: string         // ListAgentFullName.  for IG broker headshot resolution
  hero_photo?: string         // URL or path to closing photo (MLS or in-house)
  address?: string            // Composed from "StreetNumber" + "StreetName" if absent
  city?: string               // Bend / Redmond / Sisters / Tumalo / etc.
}

interface SoldDealSummaryActionRow {
  id: string                  // uuid from marketing_brain_actions
  action_type: 'content:sold_deal_summary'
  target: string              // 'mls:<mls_id>'
  assigned_producer: string   // 'social_media_skills/sold-deal-summary'
  payload: SoldDealSummaryPayload
  data_evidence: { audit_source?: string; opportunity_area?: string; signal_evidence?: string }
  generation_reason: string
  status: 'pending'
}
```

The producer **re-verifies** every payload number against a live Supabase query before
rendering. Payload values are inputs, not gospel.

---

## 4. The recipe

**Step 1.  Read the action row.** Query `marketing_brain_actions` by `id`. Confirm
`status='pending'`. Transition immediately:

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';
```

If status is anything other than `pending` at pickup, abort.  the row is already being worked.

**Step 2.  Load mandatory references** per §1. Voice rules and the IG #RyanRealtyBend +
LinkedIn no-hashtag rules are enforced at the QA gate, not after the fact.

**Step 3.  Pull and verify source data.** Query Supabase live. Do not trust payload numbers.

```sql
SELECT
  "MlsId", "StreetNumber", "StreetName", "City", "PostalCode",
  "ListPrice", "ClosePrice", "CloseDate", "CumulativeDaysOnMarket",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "ListAgentFullName", "ListAgentEmail", "SubdivisionName",
  "PhotoURL", "StandardStatus", "PublicRemarks"
FROM listings
WHERE "MlsId" = '<mls_id>';
```

Verification checks:
1. `"StandardStatus" = 'Closed'`. Else abort.
2. `"CloseDate" <= today`. Future close date = abort.
3. `"ClosePrice"` is a positive integer. Zero/null = abort.
4. Recompute `sale_to_list_pct = "ClosePrice" / "ListPrice" * 100`, one-decimal precision. If
   the recomputed value differs from `payload.sale_to_list_pct` by >0.1, use the live recompute
   and note the override in `citations.json`.
5. Recompute `dom_total` from `"CumulativeDaysOnMarket"`. If null, query `listing_history` for
   first ACTIVE → CLOSED day-difference.

**Sale-to-list framing:**
- `>= 100`: format as `+<pct - 100>% over asking` (e.g. `+2.3% over asking`).
- `< 100`: format as `<pct>% of list` (e.g. `97.4% of list`).
- Exactly `100.0`: format as `Sold at list`.

**Step 4.  Resolve the listing agent.** Map `"ListAgentEmail"` → `matt-ryan` /
`paul-stevenson` / `rebecca-peterson`. The broker headshot is required for the IG post (S2
template, per `ig-single-post/SKILL.md` §4). Buyer-side close where Ryan Realty repped the
buyer = surface to Matt; this producer expects a listing-side close.

**Step 5.  Build the IG/FB Just Sold image (S2 template).** Delegate to
`social_media_skills/ig-single-post/SKILL.md` with `template: 'S2'`:

```json
{
  "template": "S2",
  "mls_id": "<mls_id>",
  "address": "<StreetNumber> <StreetName>",
  "city": "<City>",
  "sold_price": <ClosePrice>,
  "dom_days": <dom_total>,
  "sale_to_list_pct": <sale_to_list_pct>,
  "list_agent": "<resolved-broker-slug>",
  "hero_photo": "<path or URL>"
}
```

PNG lands at `out/sold-deal/<slug>/ig-post.png`. `ig-single-post` writes its own
`citations.json`, `provenance.json`, `fonts_used.json`, `design_scorecard.json` next to the
PNG; copy those into the sold-deal draft folder.

**Step 6.  Write the IG H&H caption** at `out/sold-deal/<slug>/caption-ig.md`:

```
[Location-anchored close.  name the neighborhood or street, one specific anchor]

[Deal-detail middle.  sold price, DOM, sale-to-list outcome; 1-3 sentences, no clichés]

[Lifestyle close.  one specific local detail relevant to the buyer's win]

》 <Address>  ·  Sold at $<rounded sold_price>  ·  <dom_total> days  ·  <sale-to-list framed>

#RyanRealtyBend
#BendOregon
#JustSold
#BendRealEstate
#[NeighborhoodOrCity]Bend
#CentralOregonRealEstate
```

Voice constraints (enforced at QA gate):
- No "honored to," "humbled to," "what a journey," "blessed," "grateful to be part of."
- No "stunning," "dream home," "gorgeous," "must-see," "turnkey," "meticulously maintained."
- No exclamation marks. No emoji. No em-dashes (except as data placeholder). No semicolons.
- "You/your" for the audience. "We/our team" for the brokerage. Never "I."
- Currency rounded to nearest $1,000: `$895,000` not `$894,750`.
- Days = `<int> days`. Pct = one decimal with `+` or `%-of-list` per Step 3.
- `#RyanRealtyBend` is the FIRST hashtag in the trailing block. Locked 2026-05-14.

**Step 7.  Write the LinkedIn native text post** at `out/sold-deal/<slug>/linkedin-post.md`.
**No image required.** Per `platform-best-practices/SKILL.md`, LinkedIn rewards native text
(no external link) and paragraph structure over link-shares.

Length target: 150-300 words. Aim for ~200.

Structure:

1. **Opening hook (1-2 sentences).** A market insight, not a self-congratulation. What does
   this close tell a reader about the Deschutes / Bend / Sisters / Tumalo / Redmond market?
   Example openings:
   - "What this Tumalo close tells us about how lenders see Deschutes County rural in 2026."
   - "Bend's NW-side just gave us a fresh data point on the $1M to $1.2M tier."
   - "A 38-day close at 97.4% of list says more about Bend's spring inventory than the
     headline numbers do."

   Derive from `linkedin_angle` if supplied; otherwise compose from: location/neighborhood
   character, price tier, DOM relative to neighborhood norm, sale-to-list outcome, contextual
   signal (rural lender constraints, HOA dynamics, school zone shift). The opening must
   connect to the data, not float free of it.

2. **Middle (3-5 sentences).** The deal as proof point. State the verified facts: sold price
   rounded to nearest $1,000; DOM `<int> days`; sale-to-list framed per Step 3; the market
   context the opening claimed. Treat the LinkedIn reader as an intelligent peer (relocation
   buyer, remote tech professional, investor, another broker). Specific numbers do the work.

3. **Close (1-2 sentences).** A clean offer. Options:
   - "If you're tracking the Bend market and want our buyer/seller guides as we update them,
     DM us."
   - "We publish a weekly Bend market read by neighborhood. Reply 'guide' for the next one."
   - "If Bend or Central Oregon is on your radar, reach out."

   Phone in close (FUB-tracked, per CLAUDE.md): `541.703.3095`. Web: `ryan-realty.com`. No
   hashtags anywhere in the body.

LinkedIn-specific voice rules:
- Direct. Specific. Useful. Professional but not stiff.
- NO "honored to" / "humbled to" / "what a journey" / "blessed" / "grateful."
- NO "Don't miss out!" / "Act now!" / "Won't last long" / urgency framing.
- NO exclamation marks. NO emoji. NO hashtags.
- One topic per paragraph; line breaks between paragraphs.
- Banned vocab union applies per `voice_guidelines.md`.

**Step 8.  Write `citations.json`.** One entry per figure shown in either deliverable.

```json
{
  "figures": [
    {
      "figure": "$895,000",
      "label": "sold_price",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ClosePrice",
      "value": 895000,
      "fetched_at": "2026-05-14T14:32:00Z"
    },
    {
      "figure": "38 days",
      "label": "dom_total",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "CumulativeDaysOnMarket",
      "value": 38,
      "fetched_at": "2026-05-14T14:32:00Z"
    },
    {
      "figure": "97.4% of list",
      "label": "sale_to_list_pct",
      "source": "computed",
      "filter": "ClosePrice / ListPrice * 100 where MlsId='220189422'",
      "value": 97.4,
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ]
}
```

**Step 9.  Run the QA gate** (§8). Any `fail` blocks the draft from entering `ready`.

**Step 10.  Update the action row.**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{
      "draft_paths": [
        "out/sold-deal/<slug>/ig-post.png",
        "out/sold-deal/<slug>/caption-ig.md",
        "out/sold-deal/<slug>/linkedin-post.md"
      ],
      "scorecard": {}
    }'::jsonb
WHERE id='<action_id>';
```

**Step 11.  Surface both deliverables to Matt** (§6). Wait for explicit approval.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | Live data pull from `listings`; action row read + update | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `ig-single-post` skill | S2 template render (delegated) | `social_media_skills/ig-single-post/SKILL.md` |
| `lib/render-ig-single-post.mjs` | Compositor invoked by `ig-single-post` | repo-local node script |
| Voice grep | Banned-vocab check against `voice_guidelines.md` §6 union | `marketing_brain_skills/brand-voice/voice_guidelines.md` |
| Markdown writer | Write `caption-ig.md` + `linkedin-post.md` | `Write` tool |
| JSON writer | Write `citations.json` + `scorecard.json` | `Write` tool |

No external API beyond Supabase + the local renderer. No paid generation.

---

## 6. Output format

**Draft lands at:** `out/sold-deal/<slug>/` where `<slug> = <MLS#>-<street-slug>` (e.g.
`220189422-1234-nw-riverview`).

```
out/sold-deal/<slug>/
├── payload.json              ← the action row's payload (for trace)
├── ig-post.png               ← 1080×1350 S2 Just Sold render
├── caption-ig.md             ← H&H caption for the IG post (with #RyanRealtyBend)
├── linkedin-post.md          ← native LinkedIn text body (no hashtags, no image)
├── citations.json            ← every figure traced
├── provenance.json           ← photo source + license (copied from ig-single-post)
├── fonts_used.json           ← exact font files embedded (copied from ig-single-post)
└── scorecard.json            ← QA gate results for the bundle
```

**Surface format (present to Matt exactly like this):**

```
Sold deal summary ready.  <address> · MLS <mls_id>

  IG / FB POST (S2 Just Sold)
    Image:   out/sold-deal/<slug>/ig-post.png
    Caption: out/sold-deal/<slug>/caption-ig.md
    --- caption preview ---
    <paste caption-ig.md contents inline>

  LINKEDIN NATIVE POST (no image)
    Body:    out/sold-deal/<slug>/linkedin-post.md
    --- post preview ---
    <paste linkedin-post.md contents inline>

  VERIFICATION TRACE
    - $<sold_price>.  Supabase listings, MlsId='<mls_id>', column ClosePrice, fetched <iso>
    - <dom_total> days.  Supabase listings, MlsId='<mls_id>', column CumulativeDaysOnMarket, fetched <iso>
    - <sale_to_list_pct>%.  computed from ClosePrice / ListPrice, fetched <iso>

  CITATIONS
    out/sold-deal/<slug>/citations.json

Reply "ship it" / "approved" / "go" to commit + push both deliverables.
```

Then stop. Do not commit. Do not push either file. Wait for Matt's explicit approval.

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`. Matt sees the IG PNG, the IG caption, and the
LinkedIn body, and replies "ship it" / "approved" / "go" before any commit or publish.

Silence is never approval. A passing QA gate is never approval. A successful render is never
approval. Per `CLAUDE.md` §0.5.

---

## 8. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ both deliverables complete, QA passed
        ▼
      ready        ← executor_response populated with draft_paths + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ commit + push the PNG, captions, citations
        ▼
    executed       ← terminal success; IG + LinkedIn drafts ready for publisher to pick up
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes IG + LinkedIn metrics to content_performance

    killed         ← terminal failure; Matt cancels or QA fails after 2 auto-iterations
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
    executor_response='{"draft_paths":["..."],"scorecard":{}}'::jsonb
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 9. QA gate

Run before surfacing the draft. Write results to `scorecard.json`. Any `fail` = non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | StandardStatus is Closed | Live Supabase row shows `"StandardStatus" = 'Closed'` |
| 2 | CloseDate is past | `"CloseDate" <= today` |
| 3 | sold_price > 0 | `ClosePrice` is a positive integer |
| 4 | DOM is non-negative integer | `dom_total >= 0` |
| 5 | sale_to_list_pct sanity | `0 < sale_to_list_pct < 200` (outside = surface for review) |
| 6 | IG PNG dimensions | Exactly 1080 × 1350 |
| 7 | IG PNG inherits ig-single-post QA | `ig-single-post/SKILL.md` §8 fully passed |
| 8 | IG caption #RyanRealtyBend rule | First hashtag in trailing block = `#RyanRealtyBend` |
| 9 | IG caption length | Body ≤ 220 words including the bullet line |
| 10 | LinkedIn body has no hashtags | Grep returns zero `#` tokens in linkedin-post.md |
| 11 | LinkedIn body has no image embed | linkedin-post.md is text only |
| 12 | LinkedIn body word count | 150 ≤ words ≤ 300 |
| 13 | Banned vocab clean (IG) | Grep `caption-ig.md` against `voice_guidelines.md` §6 union.  zero hits |
| 14 | Banned vocab clean (LinkedIn) | Grep `linkedin-post.md` against `voice_guidelines.md` §6 union.  zero hits |
| 15 | No "honored to" / "humbled to" / "journey" | Zero hits in either deliverable |
| 16 | No exclamation marks | Zero hits in either deliverable |
| 17 | No emoji | Zero emoji in either deliverable |
| 18 | Numbers reconcile | Every number in IG caption + LinkedIn body matches a row in `citations.json` |
| 19 | Sale-to-list framing | Format matches Step 3 rules (over asking / of list / sold at list) |
| 20 | LinkedIn angle relevance | If `linkedin_angle` supplied, opening references location, price tier, DOM, or pct.  not generic |
| 21 | Phone correctness | LinkedIn = `541.703.3095` (FUB-tracked); `541.213.6706` only if explicitly Matt's direct |
| 22 | URL correctness | `ryan-realty.com` (hyphenated, lowercase) |

Cosmetic fails (16-22): auto-fix once and re-run. Beyond one attempt, surface to Matt.
Data-accuracy fails (1-6, 18): never auto-fix.  go straight to Matt for resolution.

---

## 10. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| close_date in future | `"CloseDate"` > today | Abort. `status='killed'` with `executor_response.error='close_date_in_future'`. Surface to Matt.  likely a misfired audit. |
| sale_to_list_pct negative or missing | Recomputed value `<= 0` or null | Abort. Verify ListPrice and ClosePrice. Null ListPrice on a closed listing = surface to Matt (data integrity issue). |
| sale_to_list_pct > 130 | Recompute returns >130% | Pause. Likely a price-improvement not reflected in `"ListPrice"`. Surface to Matt with price history. |
| StandardStatus not Closed | Row shows `Active` / `Pending` / `Withdrawn` / `Expired` | Abort. Producer only acts on closes; the row may have been written from a misread audit signal. |
| Listing agent not in three brokers | `ListAgentEmail` doesn't resolve to matt-ryan / paul-stevenson / rebecca-peterson | Surface to Matt. Likely a buyer-side close where Ryan Realty represented the buyer (needs a different action_type). Do not render. |
| Hero photo missing | No `hero_photo` payload AND `"PhotoURL"` empty | Surface to Matt. Offer stock exterior or pause. No AI-fake property photos per `ANTI_SLOP_MANIFESTO`. |
| LinkedIn angle unrelated to listing context | Supplied `linkedin_angle` doesn't reference location / price tier / DOM / pct | Auto-derive a new angle from listing context (per Step 7). Note override in `scorecard.json`. |
| Banned vocab on either deliverable | Grep returns ≥1 hit in `caption-ig.md` or `linkedin-post.md` | Auto-rewrite the offending sentence once. If still fails, surface to Matt with the specific banned word cited. |
| Render failure | `ig-single-post` returns non-zero exit | Inherit the error from `ig-single-post`. Do not present a half-built bundle. |
| Caption exceeds IG body limit | Caption > 2200 chars (IG hard cap) | Auto-trim the lifestyle close. If still over, surface.  H&H structure should never run this long. |
| Co-listing with another brokerage | Edge case: deal where Ryan Realty co-listed | Out of scope. Surface to Matt; he handles disclosure manually. |
| FUB phone not configured | LinkedIn body should reference `541.703.3095` but value missing from env | Hard-code from CLAUDE.md "Voice + content".  `541.703.3095` is the documented FUB-tracked bio phone. |

**Open spec questions** (handled inline; documented here for the next iteration):
- Should a follow-up LinkedIn comment (1-2 weeks later) auto-generate from the same close to
  seed re-engagement? Currently out of scope. If the brain decides it's worth it, add a
  separate `content:sold_deal_followup` action_type and a sibling producer.
- Should the IG post auto-tag the buyer's brokerage? Currently no.  privacy default. Matt
  can manually tag after publish.

---

## 11. What not to do

1. Never invent numbers. Sold price, DOM, sale-to-list pct all trace to a live Supabase query
   in this session.
2. Never trust payload values without re-verifying. Payload is an input, not gospel.
3. Never use "honored to" / "humbled to" / "what a journey" / "blessed." This is the single
   most common voice failure on closing posts. Reject, rewrite.
4. Never inject hashtags into the LinkedIn body. Per `platform-best-practices/SKILL.md`.
5. Never omit `#RyanRealtyBend` from the IG caption. First hashtag in the trailing block.
   Locked 2026-05-14. Non-negotiable.
6. Never use exclamation marks, em-dashes (except as data placeholder), or semicolons in
   either deliverable.
7. Never use emoji in either deliverable.
8. Never publish a sold post without the listing agent's headshot (S2 requires it). If the
   agent can't be resolved, surface to Matt.  don't fall back to Jax.
9. Never AI-generate the closing photo. Per `ANTI_SLOP_MANIFESTO`.
10. Never commit either deliverable before Matt's explicit approval. Per `CLAUDE.md` §0.5.
11. Never reuse a sold-deal-summary from a prior close. Every close is a fresh data pull and a
    fresh angle.

---

## 12. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0.  Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE + LinkedIn no-hashtag exception
- `design_system/ryan-realty/SKILL.md`.  brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice enforcement
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint

**Format skill delegated to:**
- `social_media_skills/ig-single-post/SKILL.md`.  S2 Just Sold template renderer

**Capabilities used:**
- Banned-vocab grep against `marketing_brain_skills/brand-voice/voice_guidelines.md` §6 union

**Playbooks and pipeline docs:**
- `automation_skills/content_engine/SKILL.md`.  content routing bus
- `social_media_skills/platform-best-practices/SKILL.md`.  2026 platform rule layer (LinkedIn
  native-text + no-hashtag convention, IG hashtag-first convention)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned content gate
- `social_media_skills/list-kit/SKILL.md`.  orchestrator that may call this producer at the
  end of a listing's lifecycle

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section B, row `sold-deal-summary`,
  action_type `content:sold_deal_summary`, path
  `social_media_skills/sold-deal-summary/SKILL.md`

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
