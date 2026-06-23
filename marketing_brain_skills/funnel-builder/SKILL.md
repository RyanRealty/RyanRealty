---
name: funnel-builder
description: >
  Produces a single coherent Facebook ad -> landing page -> CRM follow-up funnel
  for Ryan Realty, grounded in REAL market data (Supabase DAL), the locked brand
  voice, the live design system, and the FUB seller workflow. Use when Matt says
  "build a funnel for X", "make me a Facebook ad + landing page + follow-up", "I
  want a seller campaign for <neighborhood>", or any request that spans ad + page
  + CRM as one unit. This is a RECIPE the live agent loads and runs in-session.
  It is NOT a REGISTRY producer (producer-freeze G45 compliant) and adds no cron.
output_type: funnel
target_platforms: ["fb_feed", "ig_feed", "lp", "fub"]
required_inputs: ["goal", "geography", "avatar", "offer"]
optional_inputs: ["trigger_event", "objection", "broker_slug", "budget"]
---

# Funnel Builder — Facebook ad -> Landing page -> CRM, as one message-matched unit

The whole point of this skill: **stop producing generic crap.** Generic happens when
(1) the brief is vague so the model returns the average of every real-estate ad,
(2) there is no critique loop so you ship first drafts, and (3) the ad, page, and
follow-up are written in isolation so the promise doesn't carry through. This recipe
forces specific inputs, runs a generate -> score -> kill -> expand loop, grounds every
claim in real Supabase data, and produces the ad + LP + CRM as ONE coherent funnel.

**One idea, carried end to end.** The ad's promise IS the landing page H1 IS the first
CRM touch. If those three drift, the funnel leaks and conversion dies. Hold message-match
above everything.

---

## §0 — The non-negotiables (these outrank style, speed, and cleverness)

1. **Data accuracy (CLAUDE.md §0).** Every number shown or spoken traces to a live
   Supabase pull made THIS session. No recalled stats, no "about," no rounding that
   changes the story. One verification trace per figure before any draft surfaces.
2. **Draft-first (CLAUDE.md §0.5).** Nothing commits, publishes, or writes to a place a
   publishing automation can pick up until Matt sees the draft and says "go." The funnel
   renders to a draft surface + contact sheet. Wait for explicit approval.
3. **Brand voice (CLAUDE.md §0.6).** Every word of public copy passes the hard-fail scan
   before Matt sees it. Banned words/punctuation/moves are a rewrite-on-sight, not a flag.

---

## §1 — Required references (load BEFORE producing anything)

| What | Path | Why |
|---|---|---|
| Brand voice (canonical) | `marketing_brain_skills/brand-voice/VOICE.md` | Five Laws + competitor/receipt tests |
| Voice hard-fails (full) | `marketing_brain_skills/brand-voice/voice_guidelines.md` | The ban lists for long-form copy |
| Voice gate (run it) | `scripts/check-brand-voice.mjs` + `scripts/brand-voice-vocabulary.cjs` | Mechanical banned-word scan |
| Design system | `design_system/ryan-realty/SKILL.md` + `MANIFEST.md` | Navy #102742 / cream #faf8f4, Amboqia + Geist, asset paths |
| FB ad spec | `social_media_skills/facebook-lead-gen-ad/SKILL.md` | Lead-form template, creative spec, FUB webhook |
| FB pipeline (live wiring) | `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` | Meta -> site -> CAPI -> FUB, env vars |
| Competitor design recon | `marketing_brain_skills/competitor-design-recon/SKILL.md` | Adapt a proven layout, don't invent one |
| FUB seller workflow (LOCKED) | `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` | Tag schema, 10-touch cadence, API constraint |
| Lead-flow detail | `docs/MARKETING_LEAD_FLOW.md` | Per-path lead creation + dedup |

Producer freeze (G45): this is a recipe the live agent loads. Do **not** add a row to
`marketing_brain_skills/producers/REGISTRY.md` and do **not** wire a cron. Compose the
existing producers and DAL functions in-session.

---

## §2 — The brief (interrogate it; the funnel is only as good as this)

90% of quality lives here. Before producing, the brief must carry all of:

- **Goal** — the one action (e.g. free home valuation for likely-to-sell owners).
- **Geography** — city + neighborhood/subdivision + radius (e.g. SE Bend, Larkspur).
- **Avatar** — specific person, not "homeowners" (e.g. 55-65, bought before 2015,
  equity-rich, weighing a downsize but scared the house will sit).
- **Trigger event** — what just happened that makes NOW the time.
- **Offer** — what they get, and why it's worth their email/phone.
- **Proof** — the real numbers/facts we stand behind (pulled in §3, not invented).
- **#1 objection** — the fear that stops them ("I'll list and it'll sit").
- **What makes us different, provably** — the concrete fact, never the adjective.
- **Broker** — default Matt; honor `?agent=<slug>` attribution if specified.

**If any of {avatar, trigger, offer, objection} is missing, STOP and ask Matt — max 5
questions, the specific gaps only. Do not invent them. Do not proceed on guesses.**
Everything else (proof, geography stats) the skill pulls itself in §3.

---

## §3 — Pull the receipts (REAL data, this session — no recalled numbers)

Use the DAL. Never raw-aggregate `listings` for stats; never run schema-discovery SQL
(read `docs/DATABASE_SCHEMA_SNAPSHOT.md`). Pull, print the raw result, write the trace.

**Market stats (the headline receipts):**
```ts
import { getMarketStats } from '@/lib/data/market/getMarketStats'      // medianSalePrice, medianDaysOnMarket, soldCount, saleToListRatio, yoyChangePct
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'      // activeCount, monthsOfSupply, medianDaysToPending, newThisWeek
import { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail' // marketHealthLabel, cashPurchasePct, medianConcessionsAmount
// e.g. getMarketStats({ geoType: 'city', geoSlug: 'bend', periodType: 'rolling_90d' })
```
Drive a quick `node`/`tsx` script or read the cached values; print every figure used.

**Recent closed comps (the "sold down your street" proof).** No DAL function covers this
yet — pull via Supabase MCP, SFR only, mixed-case columns quoted:
```sql
SELECT "Address", "ClosePrice", "CloseDate", days_to_pending, sale_to_list_ratio,
       close_price_per_sqft, "BedroomsTotal", "BathroomsTotal"
FROM public.listings
WHERE "StandardStatus" = 'Closed'
  AND "PropertyType" = 'A'
  AND "CloseDate" >= now() - interval '90 days'
  AND boundary_neighborhood = '<bend-neighborhood-slug>'   -- or join listing_boundary_xref_mv for resort communities
ORDER BY "CloseDate" DESC
LIMIT 8;
```

**Verification trace (one line per figure, mandatory):**
`38 days median DOM — Supabase getMarketStats(city/bend, rolling_90d), medianDaysOnMarket = 38 over 142 closed rows, fetched 2026-06-19T...`

**Months of supply** = active / (closed_last_6mo / 6). Verdict pill (<=4 seller / 4-6
balanced / >=6 buyer) must match the number. If a stat can't be verified, cut it.

---

## §4 — Three angles -> score -> kill (this is the critique loop you were missing)

Do NOT jump to the funnel. First, on the verified data + brief:

1. Generate **3 genuinely different strategic angles** — not three wordings of one idea.
   Real-estate angle bank: leaving-money-on-the-table, the data-flex (your DOM/STL beats
   the market), already-have-a-buyer, the anti-Zillow estimate, just-sold-down-your-street,
   the timing-window (rates/season), the quiet-off-market option.
2. **Score each 1-10** on: scroll-stopping hook, specificity, emotional truth,
   differentiation. Show the scores.
3. **Pick the winner. Say why the other two die.** Build the funnel on the winner ONLY.

The winning angle becomes the single idea that the ad, LP, and CRM all carry.

---

## §5 — Build the funnel on the winning angle

### A) The Facebook ad (spec: `social_media_skills/facebook-lead-gen-ad/SKILL.md`)
- **Primary text — 3 variants:** a punchy <50-word, a story-led ~120-word, a
  contrarian/pattern-interrupt. First line stops the thumb with zero brand context
  (a number, place name, or tension — never "Looking to sell your home?").
- **5 headlines** (<40 chars).
- **Creative direction:** the exact image OR a 15-30s video, shot-by-shot, on-screen
  text, first frame as a strong thumbnail. Concrete enough to hand off with no questions.
  Adapt a documented pattern from competitor-design-recon; render in the design system
  (navy/cream, Amboqia headline, Geist body). No gold (retired). No logo in the opener.
- **Lead form / destination:** native FB lead form per the spec, OR drive to the LP in §B
  (decide per goal; native form = lower friction, LP = more qualification + pixel/retarget).
- **Targeting + budget:** who, geo radius, daily start spend, and the ONE metric to judge.
- **Message-match anchor:** write the single promise sentence here; B and C must echo it.

### B) The landing page (reuse the scaffold — do NOT hand-roll)
- **Canonical seller funnel:** `app/lp/seller-home-value/` — `page.tsx`, `SellerLPForm.tsx`,
  `actions.ts` (the `submitSellerLPForm` server action already does FUB create + tag +
  assign + custom fields + CMA queue + CAPI/GA4). Fork the page or add a `?variant=` /
  campaign param; reuse `SellerLPForm` rather than rebuilding the submit path.
- **Components:** `@/components/ui/*` (shadcn) + `components/site/primitives` (display
  headings carry Amboqia) + `components/landing/*` (ScrollReveal, ReviewCard,
  ExpiredMarketStatStrip, LandingPageTracker). Never raw HTML controls.
- **Copy, top to bottom, message-matched:**
  - **H1 = the ad's exact promise.** Subhead names the offer.
  - Hero with the canonical Old Mill hero or a real neighborhood photo (MANIFEST paths).
  - **Receipts strip** — the verified §3 stats, live, tabular numerals.
  - The offer + the single form (one CTA, repeated; no nav, no distractions).
  - Objection-handling section that answers the brief's #1 fear with a fact.
  - Real testimonials via `lib/testimonials.ts` / ReviewCard — never "[insert testimonial]".
- **Form fields:** the minimum that still qualifies (address + timeline + contact). Each
  field justified. Honor known-visitor prefill (`app/actions/fub-identity-bridge.ts`).

### C) The CRM follow-up (architecture: `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`)
**Hard constraint:** FUB blocks `POST /v1/emails` and `/v1/textMessages` for integrations.
Our code only **tags, assigns, sets custom fields, creates tasks, fires events** — the
actual emails/SMS fire from FUB's own action-plan engine, triggered by a FUB Automation
rule that listens for the `audience:seller` tag. Design the touches; wire the triggers.

- **Canonical tag set (every seller lead, exactly):** `audience:seller` + `seller:{tier}`
  (hot/warm/nurture) + `source:{fb-ads-seller | seller-lp}` + `broker:{matt|rebecca|paul}`.
  Add `channel:fb-ads` + `campaign:<sanitized>` when utm_source=facebook.
- **Assignment:** default Matt (userId 1); honor `readAttributedAgentServer()` cookie for
  `?agent=rebecca|paul`. Functions in `lib/followupboss.ts`: `findPersonByEmail`,
  `sendEvent`, `addPersonTags`, `setPersonCustomFields`, `assignPersonToUser`,
  `createRealtimeTask`. Hot lead -> 5-minute call task.
- **Compliance gate:** before tagging `audience:seller`, skip if `compliance:hard-stopped`.
- **Write the actual sequence copy** (these become FUB action-plan templates, in the
  client's voice, each echoing the ad's promise): instant confirmation email + SMS, the
  CMA delivery, the 24h "did it make sense", the 3d check-in, the 7d market update, the
  14d case study (use a real §3 comp), the 30d soft check, then 60d -> `seller:long-nurture`.
  Every touch earns the next; no "just checking in."
- **Live handoff trigger:** what behavior moves them from automation to a broker call
  (reply, link click on a specific email, stage advance) -> add `seller:in-conversation`
  (pauses auto touches).

---

## §6 — Self-audit before anything reaches Matt (do not skip)

Re-read the whole funnel against THE STANDARD and the bans. List every line you almost
shipped that failed and what you changed. If nothing failed, you weren't honest — look again.

- **Competitor test:** could a rival brokerage paste their name on this and have it still
  work? If yes, it's dead — rewrite until only Ryan Realty could have said it.
- **Receipt test:** every claim backed by a number/name/fact, not an adjective.
- **Message-match:** ad promise == LP H1 == first CRM touch. Verify literally.
- **Voice gate (mechanical):** run `node scripts/check-brand-voice.mjs` on the LP copy;
  grep all ad/CRM copy for the ban list (stunning, dream home, nestled, charming, must-see,
  hidden gem, boasts, luxurious, passionate, dedicated, premier, boutique, act fast,
  won't last; em-dashes, semicolons, body exclamation marks; category-naming;
  headcount/smallness positioning). Any hit = rewrite, not flag.
- **Data trace:** every number on the ad + LP maps to a §3 verification line.

---

## §7 — Surface the draft (draft-first + contact sheet)

Build an HTML contact sheet (per `feedback_contact_sheet_required`) the agent can open in
the browser: ad variants + creative mock, the LP rendered (or a preview link), the CRM
sequence copy laid out by touch, and the verification trace. Then surface in the standard
format and STOP:

> **Draft ready:** `<contact-sheet path / preview URL>`
> **Angle:** `<winning angle, one line, + why it beat the other two>`
> **Message-match anchor:** `<the single promise carried ad -> LP -> CRM>`
> **Verification trace:** `<one-line-per-figure summary>`
> **Ready to wire + publish on your sign-off.**

Wait for explicit approval ("go", "ship it", "approved"). A passing voice gate is not
approval. A finished build is not approval.

---

## §8 — On approval (only then)

- Write a `marketing_brain_actions` row for the audit trail (status flows pending ->
  ... -> measured) per `marketing_brain_skills/produce/SKILL.md`. action_type
  `content:fb_lead_gen_ad` (+ the LP/CRM as the funnel payload). This is the audit
  trail, not a new producer — no REGISTRY change.
- Ad: launch via the Meta path in `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`.
- LP: commit the page variant (design-token + mockup-parity gates must pass: `npm run ci:gates`).
- CRM: confirm the FUB Automation rule for `audience:seller` is live (action-plan templates
  loaded in FUB UI); our code only tags/assigns/sets-fields/creates-tasks.
- Measurement: the row's published state feeds the marketing-measurement loop (GA4
  traffic, FUB leads, content_performance).

---

## See also
- `social_media_skills/facebook-lead-gen-ad/SKILL.md` — the ad producer this composes
- `marketing_brain_skills/brand-voice/VOICE.md` — the voice this enforces
- `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` — the CRM architecture this wires
- `app/lp/seller-home-value/` — the LP scaffold this reuses
- `marketing_brain_skills/produce/SKILL.md` — the action-row protocol for the audit trail
