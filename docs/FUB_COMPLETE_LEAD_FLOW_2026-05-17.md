# Ryan Realty — Complete Lead Flow (End-to-End)

**Status:** Locked + live 2026-05-17.
**Scope:** Every path a lead can enter the Ryan Realty system through, from first ad click to final FUB record, with every component, file, and table named explicitly.

This is the master operating reference. If something doesn't show up here, it isn't part of the canonical flow.

---

## 0. Overview at a glance

Five inbound lead paths. One canonical tag schema. One FUB pipeline per audience. Every lead is auto-detected for compliance hard-stops and routed via the agent-attribution cookie (defaulting to Matt). Brand voice §4.7 governs every external word.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  AD / SEARCH / REFERRAL  ─►  LANDING PAGE  ─►  FUB  ─►  WORKFLOW        │
│                                                                         │
│  5 inbound paths:                                                       │
│    1. /lp/seller-home-value       (FB or Google ad → seller LP form)    │
│    2. /lp/buyer-listing-alerts    (FB or Google ad → buyer LP form)     │
│    3. /lp/expired-listing         (direct mail / GBP → expired LP form) │
│    4. /contact                    (general inquiry form on the site)   │
│    5. expired-listing-cron        (auto-detected from MLS, hourly)     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Inbound paths in detail

### 1.1 Seller LP — `/lp/seller-home-value`

**Form:** `app/lp/seller-home-value/SellerLPForm.tsx`
**Server action:** `app/lp/seller-home-value/actions.ts` · `submitSellerLPForm()`
**Triggered by:** FB / Google ads, organic search, "What's My Home Worth" CTAs

**Flow per submission:**

1. **Parse + classify** address, name, email, phone, timeline.
   `classifyTimeline()` returns `{ tier: 'hot' | 'warm' | 'nurture', tierTag: 'seller:hot' | ... }`.

2. **Resolve FUB person.**
   Priority: explicit email match (`findPersonByEmail`) > cookie-identified person id (`fub_cid`) > new email-only record. If neither email nor cookie present, reject.

3. **Read agent attribution cookie.**
   `readAttributedAgentServer()` reads `rr_agent_attribution` cookie set by `components/AgentAttributionBridge.tsx`. If a `?agent=<slug>` URL param landed earlier (e.g., Rebecca's ad URL), routes the lead to that broker. Otherwise defaults to Matt.

4. **Persist to Supabase.** Insert into `valuation_requests` (existing pipeline).

5. **FUB Seller Inquiry event.** `sendEvent({ type: 'Seller Inquiry', ... })` creates/updates the FUB person.

6. **Compliance hard-stop gate.**
   `isHardStopped(personId)` checks for `do_not_email`, `do_not_text`, `compliance:hard-stop`, `bounced`, `unsubscribed`, `complained`, plus realtor variants (`realtor`, `real estate`, `industry:realtor`) and test pollution (`test record - delete`). If hard-stopped, skip workflow enrollment but keep the lead record.

7. **Apply canonical tags + custom fields.**
   - Tags: `audience:seller`, `seller:{tier}`, `source:seller-lp`, `broker:{matt|rebecca|paul}`
   - Custom fields: `customMoveTimeline`, `customLeadTier`, `customIsSellerCurious`, `customSellerPropertyAddress`
   - `assignPersonToUser(fubPersonId, userId)` — sets `assignedUserId` on the FUB record

8. **Geocode + neighborhood tag.**
   `geocodeAndTagLead({ address, fubPersonId })` fires geocode → PostGIS `lookup_address_geo` RPC → upsert `fub_person_geo` → add `city:<slug>`, `neighborhood:<slug>`, `subdivision:<slug>`, `geo:{local|out-of-area|out-of-state}` tags.

9. **Round-robin ledger.** `recordSellerAssignment()` writes to `marketing_assignments` table.

10. **5-min realtime task.** Hot leads get `createRealtimeTask({ taskType: 'Call', dueInMinutes: 5 })`.

11. **CMA producer queue.** `createCmaRequest()` inserts a row in `cmas` (status='draft') + `marketing_brain_actions` (action_type='content:cma'). The canonical CMA producer at `marketing_brain_skills/producers/cma/SKILL.md` picks it up.

12. **Meta CAPI Lead $500.** Fires the conversion event for ad attribution.

**FUB Automation Rule (Matt's UI setup):**
- When tag `audience:seller` added → enroll in Action Plan `Seller Lead — Master Workflow` (id 69)

**Action Plan 69 — 9 steps:**

| Pos | Wait | Action | Detail |
|----:|---|---|---|
| 1 | T+0d | Create Task | "Call %first_name% — seller LP lead" |
| 2 | T+0d | Send Email | SL-01 Seller LP Confirmation (id 672) |
| 3 | T+1d | Send Email | SL-02 Seller CMA Check-in (id 673) |
| 4 | T+3d | Create Task | "Send personal SMS to %first_name% (HOT seller — skip warm/nurture)" |
| 5 | T+7d | Send Email | SL-03 Seller Market Update (id 674) |
| 6 | T+14d | Send Email | SL-04 Seller Case Study (id 675) |
| 7 | T+30d | Send Email | SL-05 Seller Soft Check-in (id 676) |
| 8 | T+60d | Remove Tags | seller:hot, seller:warm, seller:nurture |
| 9 | T+60d | Add Tag | seller:long-nurture |

Plus an `initialTextMessage` at T+1min: SL-S1 Seller SMS Confirmation.

---

### 1.2 Buyer LP — `/lp/buyer-listing-alerts`

**Form:** `app/lp/buyer-listing-alerts/BuyerLPForm.tsx`
**Server action:** `app/lp/buyer-listing-alerts/actions.ts` · `submitBuyerLPForm()`

Same pipeline as seller LP, but tagged `audience:buyer` + `buyer:{tier}` + `source:buyer-lp`, enrolls in Action Plan 70 (Buyer Lead — Master Workflow, 10 steps). Custom fields are buyer-side (`customBuyerBudgetMin`, `customBuyerBudgetMax`, `customBuyerSearchAreas`, `customBuyerBedsMin`, `customBuyerMoveTimeline`). $300 Meta CAPI Lead.

**Action Plan 70 — 10 steps:** see `docs/FUB_BUYER_WORKFLOW_2026-05-17.md` §4.

---

### 1.3 Expired Listing LP — `/lp/expired-listing`

**Form:** `app/lp/expired-listing/ExpiredLPForm.tsx`
**Server action:** `app/lp/expired-listing/actions.ts` · `submitExpiredLPForm()`

Same architecture as seller LP, but every lead is automatically tagged `seller:hot` (recent expired = high-intent). Custom fields skip the timeline picker since they're already at-market. Notes carry the contact path the user picked (audit / phone / walkthrough). Tags include `intent:expired-listing` so the action plan can branch behavior if needed.

The page itself is empathy-driven copy aligned to brand voice §4.7. See content spec at `docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md` task 2.

---

### 1.4 Contact form — `/contact`

**Server action:** `app/contact/actions.ts` · `submitContactForm()`

Lighter pipeline. After `sendEvent({ type: 'General Inquiry' })`, fires `canonicallyTagLead()` (lib/canonical-lead-tagger.ts) which:
- Reads agent attribution cookie
- Applies `audience:{buyer|seller}` (inferred from inquiry-type keywords) + tier:nurture + source:contact-form + broker:{slug}
- Round-robin ledger insert
- Compliance hard-stop check

---

### 1.5 Expired-listing auto-detection cron — `/api/cron/detect-expired-listings`

**Schedule:** every hour via vercel.json cron.

This is the **automated** path. No form fill required. The cron continuously watches Supabase's `listings` table for status transitions and creates FUB records on the broker's behalf.

**Pipeline per fire (max 30 listings/run):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Hour T:                                                                  │
│   ↓                                                                       │
│   Query Supabase.listings for new Expired/Canceled/Withdrawn in last 24h │
│     - StandardStatus IN ('Expired','Canceled','Withdrawn')               │
│     - status_change_timestamp > now() - 24h                              │
│     - City IN (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine,        │
│                Madras, Prineville)                                       │
│     - PropertyType = 'A' (SFR only)                                      │
│   ↓                                                                       │
│   Dedupe against public.expired_listings.listing_key                     │
│   ↓                                                                       │
│   For each new listing → lookupOwnerForExpiredListing()                  │
│     Strategy 1: FUB address match (FUB API streetAddress filter +        │
│                  Supabase fub_person_geo.formatted_address fallback)     │
│     Strategy 2: Apify-driven Deschutes County DIAL scrape                │
│                  (https://dial.deschutes.org public records lookup —      │
│                   gives owner name + mailing address)                    │
│     Strategy 3: Tracerfy skiptrace API ($0.05/hit, primary skip-trace)   │
│                  Returns up to 8 phones + 5 emails for the owner.        │
│                  Best phone preferred = mobile, non-litigator, deduped.  │
│     Strategy 4: Apify property-owner-skip-trace actor (backup if         │
│                  Tracerfy returns no contact). Same payload shape.       │
│   ↓                                                                       │
│   If we got a phone → run Tracerfy DNC lookup:                           │
│     - on-DNC → tag owner-lookup:dnc-flagged; broker note added;          │
│       cold-call blocked; SMS / direct mail / door-knock still allowed   │
│     - cleared → tag owner-lookup:dnc-clear                               │
│   ↓                                                                       │
│   Branch on result:                                                      │
│     a. FUB match → use existing person_id, tag + note + task             │
│     b. DIAL match (got owner name + mailing addr but no email/phone) →   │
│        create new FUB person with the real name + synthetic email        │
│        keyed on ListingKey for dedupe                                    │
│     c. Tracerfy/Apify enriched (owner name + phone + email) →            │
│        promote synthetic to real email; write phone to contact_phone     │
│     d. No match → placeholder FUB person tagged owner-lookup:pending     │
│   ↓                                                                       │
│   Apply canonical tags: audience:seller, seller:hot,                     │
│                          intent:expired-listing,                          │
│                          source:expired-listing-cron, broker:matt,        │
│                          owner-lookup:{pending|resolved}                  │
│   ↓                                                                       │
│   Write custom fields: customSellerPropertyAddress, customLeadTier=hot,  │
│                         customMoveTimeline=ready-now                     │
│   ↓                                                                       │
│   Add a detailed Note with:                                              │
│     - Property + MLS #                                                   │
│     - Last price + original price + drop %                               │
│     - Days on market                                                     │
│     - Beds/baths/sqft/subdivision                                        │
│     - Prior list agent + email                                           │
│     - Owner lookup result                                                │
│     - Landing page URL                                                   │
│   ↓                                                                       │
│   Create 60-min Call task assigned to lead's owner (Matt)                │
│   ↓                                                                       │
│   Send Resend email alert to MATT_ALERT_EMAIL with full listing context  │
│   ↓                                                                       │
│   Upsert into public.expired_listings (canonical table — PK listing_key) │
│     - All listing data                                                   │
│     - fub_person_id, fub_person_matched_by                               │
│     - alert_sent_at, alert_method                                        │
│     - owner_lookup_status, last_owner_lookup_at                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Files involved:**

- `app/api/cron/detect-expired-listings/route.ts` — the cron entry point
- `app/api/admin/expired-listing-lookup/route.ts` — manual re-fire endpoint (Matt's tool)
- `lib/expired-owner-lookup.ts` — four-strategy lookup chain + DNC scrub
- `lib/expired-alert.ts` — Resend-based email alert formatter
- `lib/followupboss.ts` — `sendEvent`, `addPersonTags`, `addPersonNote`, `createRealtimeTask`, `setPersonCustomFields`, `findPersonByEmail`
- `lib/resend.ts` — `sendEmail`
- `public.listings` (Supabase mirror of Spark MLS) — source of truth for status changes
- `public.expired_listings` — dedupe + audit + alert tracking
- `public.fub_person_geo` — fallback address-match lookup
- `vercel.json` — cron registration: `"0 * * * *"`

**Expected volume:** ~3–10 new expired listings per day in our service area. Cron is safe to run every hour because of the dedupe-by-listing_key constraint.

**Smoke test (2026-05-17 18:30):** 2 Prineville listings queued for next cron run.

---

### 1.6 Manual owner re-lookup — `/api/admin/expired-listing-lookup`

When Matt wants to re-fire owner enrichment on a specific listing (cron landed nothing, new provider credential added, stale data refresh, etc.).

**Endpoint:** `POST /api/admin/expired-listing-lookup`
**Auth:** `Bearer $CRON_SECRET`
**Body:** `{ "listing_key": "..." }` OR `{ "street_address": "...", "city": "..." }`

**Returns** the full `OwnerLookupResult` + supplemental skiptrace + DNC status + final consolidated contact `{ email, phone }`. If `listing_key` is included, also persists the enrichment back to the `expired_listings` row (`owner_name`, `contact_email`, `contact_phone`, `contact_source`, `enrichment_notes`, `owner_lookup_status`, `last_owner_lookup_at`).

**Use cases:**
- Cron returned `owner-lookup:pending` and Matt wants to retry with a refreshed Tracerfy quota
- A new expired hit FUB before we wired skiptrace; manually backfill
- Test specific addresses end-to-end without waiting for the next cron tick

**Example call:**

```bash
curl -X POST https://ryan-realty.com/api/admin/expired-listing-lookup \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "listing_key": "220189422" }'
```

---

## 1.7 Owner-lookup provider strategy (locked 2026-05-18)

The expired-listing pipeline depends on getting accurate owner contact info fast. Here's the decision tree and what each provider buys us.

### Tier 1 — Tracerfy (PRIMARY, API-first, $0.05/hit)

- **What it is:** REST API skiptrace. Bearer-token auth, JSON in/out.
- **Coverage:** Up to 8 phones + 5 emails per hit, with mobile/landline/voip classification and litigator flag.
- **Best phone selection:** Mobile > non-litigator > active.
- **DNC endpoint:** Same provider, `/dnc/lookup/` returns whether a phone is on the National DNC Registry.
- **Env:** `TRACERFY_API_KEY`, `TRACERFY_API_BASE=https://tracerfy.com/v1/api` (default).
- **Status:** Wired. Matt needs to sign up at https://tracerfy.com and drop the key into `.env.local` + Vercel.
- **Why primary:** API-first, predictable cost, fastest to integrate, real-time DNC scrub.

### Tier 2 — Apify property-owner-skip-trace (BACKUP, ~$0.10/hit)

- **What it is:** Apify actor that runs a headless scrape against public records / data aggregators.
- **Coverage:** Variable per address. No guaranteed phone+email.
- **Env:** `APIFY_TOKEN` (already wired for DIAL scrape).
- **When it runs:** Only if Tracerfy returns no contact (chained inside `enrichOwnerContact()`).
- **Why backup:** Slower (actor cold-start), higher cost per result, no native DNC scrub.

### Tier 3 — First American Ignite (web-only, MANUAL)

- **What it is:** Title-company-provided farming + skiptrace portal (https://firstam.com/agent/ignite). Bulk address-list-to-owner-name + email/phone lookups.
- **Coverage:** Strong on owner name + mailing address. Variable on phone/email (depends on tier).
- **Integration:** **No public API.** Web portal only. Logins, exports to CSV.
- **Status:** Matt has access. **Used manually** for batch farming pulls, not real-time per-listing.
- **Subsidized API path: Benutech ReboConnect via Scholarship Program** — Benutech powers Ignite Farming. Their Scholarship offers a subsidized API tier to affiliated brokers. **Contact: Eric Bryant at Benutech, 562.374.3226.** Multi-week sales cycle, so not blocking the immediate wire-up. Worth pursuing for the long-term cost reduction.

### Tier 4 — Deschutes County DIAL (already wired)

- **What it is:** Apify scrape of https://dial.deschutes.org public-records.
- **Coverage:** Owner name + mailing address only — no phone/email.
- **Role:** Authoritative on owner identity (county records). Drives the Tracerfy/Apify query (we use the owner name to disambiguate when multiple people live at the same address).

### The chain inside `lookupOwnerForExpiredListing()`

```
1. FUB address match              ─►  has email/phone?  ─► done
                                  │
                                  └►  partial → continue
2. DIAL scrape                    ─►  got owner name?   ─► continue
                                  │
                                  └►  nothing → continue
3. Tracerfy skiptrace             ─►  got phone/email?  ─► continue
                                  │
                                  └►  nothing → continue
4. Apify property-owner-skiptrace ─►  got phone/email?  ─► continue
                                  │
                                  └►  nothing → mark pending, alert Matt
5. DNC scrub (if phone)           ─►  on-DNC?           ─► tag dnc-flagged
                                  │
                                  └►  cleared → tag dnc-clear
```

Cost ceiling per new expired (worst case all 4 tiers run): ~$0.20 + Apify minutes. Realistic average: $0.05–0.07.

### DNC compliance (broker-license protection)

Cold-calling a number on the National DNC Registry without prior consent is a TCPA violation. Matt holds the principal broker license — exposure is real.

**Code-side enforcement:**
- Every phone returned by `enrichOwnerContact()` is automatically scrubbed against Tracerfy's `/dnc/lookup/` before being written to the FUB Note or `expired_listings.contact_phone` field.
- DNC-flagged phones are still stored (for SMS/door-knock/direct-mail outreach — all legal) but carry an inline warning in the enrichment_notes: `"Best phone is on DNC registry. DO NOT cold-call (TCPA risk). SMS / direct mail / door-knock allowed."`
- FUB Note also surfaces the warning at the top of the body.

**Outreach matrix:**

| Channel | DNC-flagged number | DNC-clear number |
|---|---|---|
| Cold call (voice) | ❌ never | ✅ allowed |
| SMS | ✅ allowed (TCPA-clean as long as no autodialer) | ✅ allowed |
| Direct mail | ✅ allowed | ✅ allowed |
| Door-knock | ✅ allowed | ✅ allowed |
| Email | ✅ allowed (different statute — CAN-SPAM) | ✅ allowed |

---

## 2. The agent-attribution layer (`?agent=<slug>`)

When Rebecca, Paul, or Matt run ads to their personal LP, the URL carries a query param that auto-routes the lead to them. Default routing (no param) goes to Matt.

**URL pattern:**

```
https://ryan-realty.com/lp/seller-home-value?agent=rebecca
https://ryan-realty.com/lp/buyer-listing-alerts?agent=paul
https://ryan-realty.com/?agent=matt-ryan  (any page)
```

**Valid slugs (case-insensitive):** `matt`, `matt-ryan`, `rebecca`, `rebecca-peterson`, `paul`, `paul-stevenson`.

**Code path:**

1. **Client capture.** `components/AgentAttributionBridge.tsx` (mounted in `app/layout.tsx`) reads `?agent=` from `useSearchParams()` and writes a 90-day cookie `rr_agent_attribution` containing `JSON.stringify({ slug, capturedAt })`.

2. **Server read.** `app/actions/agent-attribution-read.ts` · `readAttributedAgentServer()` parses the cookie via `lib/agent-attribution.ts` · `parseAgentAttributionCookie()`. Returns `{ broker: 'matt'|'rebecca'|'paul', userId: 1|2|3 }` or `null`.

3. **Override default routing.** Every LP server action calls `readAttributedAgentServer()` before assignment. If present, lead routes to that broker. Otherwise defaults to Matt per the 2026-05-17 directive ("no round-robin. I will get all listings and leads.").

**No FUB UI work required.** All wired in code.

---

## 3. The canonical tag schema (locked)

Every lead carries the following structured tags. Filterable in FUB UI smart lists, exportable to FB custom audiences, queryable in Supabase via tag-bridge.

| Namespace | Values | Set by |
|---|---|---|
| `audience:*` | `seller`, `buyer` | LP form (autodetect by inquiry type) |
| `seller:*` | `hot`, `warm`, `nurture`, `long-nurture`, `recovery`, `in-conversation`, `do-not-contact` | LP form (timeline) + cron (long-nurture promotion at T+60d) |
| `buyer:*` | same set | LP form |
| `source:*` | `seller-lp`, `buyer-lp`, `expired-lp`, `expired-listing-cron`, `fb-ads-seller`, `fb-ads-buyer`, `google-ads-*`, `contact-form`, `idx-registration`, `referral` | LP form / cron |
| `broker:*` | `matt`, `rebecca`, `paul` | Agent-attribution cookie or default-to-Matt |
| `intent:*` | `expired-listing` (more to come) | Cron / specific LP forms |
| `city:*` | `bend`, `redmond`, `sisters`, `sunriver`, `la-pine`, `madras`, `prineville` | Geocode pipeline |
| `neighborhood:*` | 28 Bend neighborhoods | Geocode + PostGIS spatial lookup |
| `subdivision:*` | 3,213 Central Oregon subdivisions | Geocode + PostGIS spatial lookup |
| `geo:*` | `local`, `out-of-area`, `out-of-state` | Mailing-state inference |
| `owner:*` | `occupied`, `absentee` | Address comparison (mailing vs property) |
| `equity:*` | `high` | Imported from county records |
| `tenure:*` | `recent`, `long-term` | Imported from county records |
| `industry:*` | `realtor` | Bulk migration of competitor realtor records |
| `compliance:*` | `hard-stop` | Bulk migration of bounced/unsubscribed/realtor records |
| `owner-lookup:*` | `pending`, `resolved`, `dnc-flagged`, `dnc-clear` | Expired-listing cron — owner info status + DNC scrub result |

Full spec: `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` §4.

---

## 4. The compliance hard-stop gate

Three classes of records that NEVER receive automated emails / SMS:

1. **Compliance opt-out:** `do_not_email`, `do_not_text`, `compliance:hard-stop`, `bounced`, `unsubscribed`, `complained`
2. **Industry contacts (realtors):** `realtor`, `real estate`, `real estate agent`, `real-estate-agent`, `industry:realtor`
3. **Test pollution:** `test record - delete`, `test-delete-me`

**4 enforcement layers:**

1. **Code:** `lib/canonical-lead-tagger.ts` `isHardStopped()` is called BEFORE any `audience:*` tag is applied. If hit, no tag → no FUB Automation Rule trigger → no enrollment.
2. **Bulk migration:** 2,336 realtor records + 694 compliance records carry both `compliance:hard-stop` + canonical category tag, all backfilled 2026-05-17.
3. **FUB UI Audience Filter:** action plans 69 + 70 exclude the full hard-stop tag set + stage `Real Estate Agent`. Matt configures this once.
4. **Smart-list filter pattern:** every smart list spec in `docs/FUB_SMART_LISTS_STARTER_PACK.md` carries the mandatory exclude block.

Final result: ~3,000 records are permanently blocked from automated touches. Cannot blast them by accident.

---

## 5. The post-enrollment flow inside FUB

Once a lead is canonically tagged and enrolled in either action plan 69 or 70:

```
T+0    FUB Automation Rule fires on tag add → enroll in action plan
       Action plan step 1: Create call task for Matt
       Action plan step 2: Send confirmation email (template 672 / 677)
       Action plan plan-level: T+1min SMS via initialTextMessage
T+1d   Send 24h check-in email (673 / 678)
T+3d   Create personal SMS task for hot leads
T+7d   Market intel email (674 / 679)
T+14d  Featured listing / case study email (675 / 680)
T+30d  Soft check-in email (676 / 681)
T+60d  Strip tier tags, add :long-nurture, plan ends
```

**Pause-on-reply:** every 15 minutes, `app/api/cron/seller-workflow-pause/route.ts` polls FUB for new inbound activity on all enrolled leads. If a lead replies to any email/SMS or Matt logs outbound activity, the cron adds `{audience}:in-conversation`. A second FUB Automation Rule on that tag stops the action plan.

**Compliance recheck:** any new tag carrying the hard-stop signal also stops the plan via the same FUB Automation pattern.

---

## 6. Supabase tables involved

| Table | Purpose |
|---|---|
| `public.listings` | Spark MLS mirror — every CRMLS listing. Source of truth for status transitions. |
| `public.expired_listings` | Per-listing dedupe + audit for the expired-listings cron. PK `listing_key`. |
| `public.fub_person_geo` | Per-lead spatial intel. Maps FUB person to city/neighborhood/subdivision. Used as fallback for address-match in the expired-listing owner lookup. |
| `public.marketing_assignments` | Round-robin ledger. Every LP form submission inserts a row recording which broker got which lead. (All Matt now per 2026-05-17 directive, but the ledger stays for audit + future flexibility.) |
| `public.valuation_requests` | Seller LP submissions persisted independently of FUB for the auto-CMA + weekly cron pipeline. |
| `public.boundaries` | PostGIS polygons for cities + 28 Bend neighborhoods + 3,213 subdivisions. Source for the geocode point-in-polygon lookup. |
| `public.cmas` + `public.cma_comps` | Per-CMA records. CMA producer at `marketing_brain_skills/producers/cma/SKILL.md` writes these. |
| `public.marketing_brain_actions` | Queue for all producer action rows including `content:cma`. |
| `public.lookup_address_geo()` RPC | Point-in-polygon lookup with smallest-polygon-wins ORDER BY ST_Area. Smart over overlapping polygons. |

---

## 7. FUB-side surfaces (what Matt sees)

| Surface | What's there |
|---|---|
| `app.followupboss.com/people` | All 13,143 leads. Filterable by tag, stage, source. |
| Action Plan 69 (Seller Lead — Master Workflow) | 9 steps + plan-level SMS |
| Action Plan 70 (Buyer Lead — Master Workflow) | 10 steps + plan-level SMS |
| Production templates | 14 visible (5 SL emails + 2 SL SMS + 5 BL emails + 2 BL SMS) at top of picker |
| Custom fields | 30 active (6 SL + 5 BL + 19 carryover with real data) |
| Smart lists | Built by Matt in UI from `docs/FUB_SMART_LISTS_STARTER_PACK.md` spec |
| Automation rules | 2 required (audience:seller→69, audience:buyer→70) + optional pause-on-tag rules |
| Audience filter on each action plan | Excludes hard-stop tag set + stage Real Estate Agent |

---

## 8. Real-time alerts to Matt

Three notification paths, choose by urgency:

1. **5-min Call task in FUB** (in-app push + push to iOS app) — hot LP leads, expired listings
2. **Resend email alert** — every expired listing detection (from `lib/expired-alert.ts`)
3. **Action plan task** at T+3d for hot SMS reach-out — broker-controlled

The action plan's "Send Email" steps fire from FUB's own engine — no broker action required for those. Tasks and emails-to-Matt are the broker-driven prompts.

---

## 9. Brand voice gate

Every external-facing word (email, SMS, page copy, alert body, etc.) is checked against:

- `marketing_brain_skills/brand-voice/voice_guidelines.md` (hard-coded em-dash + banned word + semicolon scan)
- `voice_guidelines.md` §4.7 "Authentic, not salesy" — 5 rules: never pander, never editorialize, honest + transparent, never overtly state value, authentic + not salesy

Implementation: `.tmp_env/fub-setup/23-rewrite-templates-brand-voice.mjs` has a `lintTemplate()` function that scans before any template write. Every of the 14 production templates passed this lint before going live.

---

## 10. Files + paths cheat sheet

### Code

```
lib/
  followupboss.ts                  — FUB API helpers (sendEvent, addPersonTags, etc.)
  canonical-lead-tagger.ts         — Universal post-process tagger + isHardStopped gate
  agent-attribution.ts             — Cookie parser for ?agent= attribution
  lead-geocode.ts                  — Geocode + spatial lookup helper
  expired-owner-lookup.ts          — 4-strategy owner-lookup chain + DNC scrub
                                     (FUB → DIAL → Tracerfy → Apify-skiptrace)
  expired-alert.ts                 — Resend email alert formatter
  resend.ts                        — Resend client + sendEmail()
  cma-request.ts                   — Queues content:cma brain action

app/
  layout.tsx                       — Mounts AgentAttributionBridge
  lp/seller-home-value/            — Seller LP page + form + action
  lp/buyer-listing-alerts/         — Buyer LP page + form + action
  lp/expired-listing/              — Expired-listing LP page + form + action
  contact/actions.ts               — Contact form action (canonical tagger)
  actions/agent-attribution-read.ts — Server-side cookie reader
  api/cron/detect-expired-listings/ — Hourly auto-detection cron
  api/cron/seller-workflow-pause/  — 15-min pause-on-reply cron (both audiences)
  api/admin/expired-listing-lookup/ — Manual re-fire owner enrichment (Bearer)
  api/meta/lead-webhook/           — FB lead-gen webhook (canonical schema)

components/
  AgentAttributionBridge.tsx       — Mounts in layout, captures ?agent= cookie
```

### Skills (marketing_brain_skills/producers)

```
cma/                          — CMA producer (consumes content:cma actions)
expired-listing-lp/           — Expired-listing LP voice + 5-cause audit framework
ops-fub-crm/                  — FUB CRM mutations (tags, sequence start/stop)
comms-matt-alert/             — Email + iMessage alerts to Matt
```

### Migrations (supabase/migrations)

```
20260517190000_marketing_assignments.sql        — round-robin ledger
20260517200000_fub_person_geo_and_lookup_rpc.sql — spatial intel + RPC
20260517220000_expired_listings_cron_columns.sql — expired_listings expansion
```

### Setup scripts (.tmp_env/fub-setup)

```
01-create-custom-fields.mjs        — Created the 6 SL fields
02-find-and-delete-tests.mjs       — Test record cleanup
03-bulk-tag-migration.mjs          — Legacy tag → canonical migration
04-build-master-workflow.mjs       — Built action plan 69 + 5 SL templates
05-delete-dead-plans.mjs           — Killed 63 dead KTS action plans
06-cleanup-templates.mjs           — Deleted orphan templates
07-cleanup-action-plans.mjs        — Deleted 5 KTS plans with live enrollments
08-cleanup-custom-fields.mjs       — Deleted 3 KTS anniversary fields
09-cleanup-orphan-tags.mjs         — Stripped 47 orphan tags
10-remove-legacy-seller-tags.mjs   — Bulk-removed legacy Seller variants
11-cleanup-stray-tags.mjs          — Final stray-tag pass
12-cleanup-templates-stale-refs.mjs — Templates linked to deleted plans
14-cleanup-residual-tags.mjs       — Last 2 Nurture Seller + 53 segment:my-leads
15-hide-kts-templates.mjs          — Hid 525 system-protected KTS templates
16b-normalize-geo-tags-v2.mjs      — Canonical city/neighborhood/owner tag migration
17b-geocode-leads-v2.mjs           — Owner-occupied lead geocode + PostGIS lookup
18-delete-test-records-round2.mjs  — 14 more test records gone
19-compliance-sweep.mjs            — 694 records → do_not_email + compliance:hard-stop
20-phone-placeholder-cleanup.mjs   — 197 phone-placeholder wipes
21-normalize-source-and-tag-buyers.mjs — Site source normalize + audience:buyer backfill
22-build-buyer-workflow.mjs        — Created buyer custom fields + templates + plan 70
23-rewrite-templates-brand-voice.mjs — Voice-rewrote all 14 templates
24-hide-all-non-sl-bl-templates.mjs — Hid 65 non-SL/BL templates
25-add-buyer-plan-steps.mjs        — 10 steps into plan 70 via PUT
26-tag-realtors-canonical.mjs      — 2,336 realtors → industry:realtor + hard-stop
```

### Docs

```
docs/FUB_AUDIT_2026-05-17.md                    — Initial CRM audit (558 lines)
docs/FUB_SELLER_WORKFLOW_2026-05-17.md          — Seller workflow locked spec
docs/FUB_BUYER_WORKFLOW_2026-05-17.md           — Buyer workflow locked spec
docs/FUB_UI_SETUP_RUNBOOK.md                    — Matt's one-time UI setup
docs/FUB_GEO_TAGGING_2026-05-17.md              — Spatial tagging architecture
docs/FUB_SMART_LISTS_STARTER_PACK.md            — Smart list specs
docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md       — Round 2 audit
docs/FUB_ROUND2_COMPLETE_2026-05-17.md          — Round 2 build
docs/FUB_CLEANUP_FINAL_2026-05-17.md            — Cleanup retrospective
docs/FUB_COMPLETION_FINAL_2026-05-17.md         — Workflow completion
docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md — Agent link + expired LP research
docs/FUB_COMPLETE_LEAD_FLOW_2026-05-17.md       — This doc
```

---

## 11. Coverage matrix

| Inbound path | Auto-tagged | Canonical schema | Geocoded | Compliance gate | Workflow enrolled |
|---|:-:|:-:|:-:|:-:|:-:|
| Seller LP | ✅ | ✅ | ✅ | ✅ | ✅ → plan 69 |
| Buyer LP | ✅ | ✅ | — | ✅ | ✅ → plan 70 |
| Expired LP | ✅ | ✅ | — | ✅ | ✅ → plan 69 |
| Contact form | ✅ | ✅ | — | ✅ | ✅ → plan 69 or 70 (by inferred audience) |
| FB lead-gen webhook | ✅ | ✅ | — | ✅ | ✅ → plan 69 or 70 |
| Expired-listing cron | ✅ | ✅ | — | ✅ | ✅ → plan 69 (forced seller:hot) |
| IDX registration | ⚠️ partial | ⚠️ via canonical tagger | — | — | — (todo: same wrap as contact form) |
| Calendly | ⚠️ | ⚠️ | — | — | — (todo) |
| Blog email capture | ⚠️ | ⚠️ | — | — | — (todo) |

The 3 paths marked `⚠️` are lower volume and can be wrapped with `canonicallyTagLead()` when next touched — single 2-line change per file.

---

## 12. The full data flow (one diagram)

```
                              ┌────────────────────┐
                              │  Ad / Search /     │
                              │  Direct Mail /     │
                              │  GBP / Referral    │
                              └─────────┬──────────┘
                                        ▼
                              ┌────────────────────┐
                              │  Landing Page      │ ──┐
                              │  ?agent=<slug>     │   │
                              └─────────┬──────────┘   │
                                        ▼               │
                              ┌────────────────────┐   │
                              │ AgentAttribution   │   │ (Page interactions)
                              │ Bridge captures    │   │
                              │ cookie             │   │
                              └─────────┬──────────┘   │
                                        ▼               │
                              ┌────────────────────┐   │
                              │ Form submit →      │   │
                              │ Server action      │   │
                              └─────────┬──────────┘   │
                                        ▼               │
              ┌─────────────────────────┴─────────┐    │
              ▼                                    ▼    │
       ┌──────────────┐                    ┌─────────────┐
       │ Read agent   │                    │ Geocode +   │
       │ attribution  │                    │ neighborhood│
       │ cookie       │                    │ tag         │
       └──────┬───────┘                    └─────────────┘
              ▼
       ┌──────────────┐
       │ sendEvent →  │                    ┌─────────────┐
       │ FUB person   │ ─────► createPerson│ FUB API     │
       │ created      │                    └─────────────┘
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ isHardStop?  │ ─── yes ─► skip workflow; log; lead stays in FUB
       └──────┬───────┘
              │ no
              ▼
       ┌──────────────┐
       │ Apply tags   │
       │ audience:*   │                    ┌─────────────┐
       │ seller/buyer │ ─────► PUT person/►│ FUB API     │
       │ :tier        │        merge tags  └─────────────┘
       │ source:*     │
       │ broker:*     │
       │ neighborhood:│
       │ city:*       │
       │ geo:*        │
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ assigned-    │
       │ UserId set   │ ─────► PUT person/{id}.assignedUserId
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ Custom       │
       │ fields write │ ─────► PUT person/{id}.customXxx
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ marketing_   │
       │ assignments  │ ─────► Supabase insert
       │ ledger       │
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ 5-min Task   │ ─────► FUB POST /tasks
       │ for Matt     │        (hot leads only)
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ CMA queue    │ ─────► Supabase content:cma action
       │ (seller LP)  │        → CMA producer fires
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ Meta CAPI    │ ─────► Lead event ($500 seller, $300 buyer)
       │ Lead event   │
       └──────┬───────┘
              ▼
       (response back to user)

       ┌──────────────────────────────────────────────┐
       │ MEANWHILE, in FUB:                           │
       │   Automation Rule: tag audience:seller → 69  │
       │   Action plan 69 starts:                     │
       │     T+0 task, email, T+1min SMS, etc.        │
       │   Pause-on-reply cron every 15 min ────► 1 │
       │   Hard-stop tag → plan stops                 │
       └──────────────────────────────────────────────┘
```

---

## 13. Operational dashboard queries

For Matt to spot-check the pipeline:

```sql
-- New leads in last 24h, by source
SELECT source, COUNT(*)
FROM (
  SELECT 'seller-lp' AS source, COUNT(*) FROM ... -- need FUB API query
) UNION ALL ...;

-- Expired listings detected today
SELECT detected_at, city, street_address, list_price, owner_lookup_status, fub_person_id
FROM expired_listings
WHERE detected_at > now() - interval '24 hours'
ORDER BY detected_at DESC;

-- Owner lookup pending queue
SELECT detected_at, full_address, list_price, days_on_market
FROM expired_listings
WHERE owner_lookup_status = 'pending'
ORDER BY detected_at DESC;

-- Geo-tag coverage
SELECT
  city_slug,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE neighborhood_slug IS NOT NULL) AS with_nbhd,
  COUNT(*) FILTER (WHERE subdivision_slug IS NOT NULL) AS with_sub
FROM fub_person_geo
GROUP BY city_slug
ORDER BY leads DESC;

-- Hot lead activity in last 7 days
-- (Use FUB UI Smart List: tag=seller:hot AND created<7d ago)
```

---

## 14. What's still UI-only (Matt's hands)

After all the API-driven work is done, **2 things** in the FUB UI Matt has to click through once (~5 min total):

1. **Settings → Automations → New Automation:**
   - When tag `audience:seller` added → enroll in plan 69
   - When tag `audience:buyer` added → enroll in plan 70

2. **Audience filter** on action plans 69 + 70 → exclude the hard-stop set + stage `Real Estate Agent`.

That's it.

---

*This document is the master. If you can't find something elsewhere in the docs, it's referenced here.*
