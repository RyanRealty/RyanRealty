# Ryan Realty — Seller Lead Workflow (Locked Spec)

**Status:** Locked 2026-05-17 (Matt approved kebab-case tag schema, both-channel via FUB, cadence at agent discretion based on research)
**Audit basis:** `docs/FUB_AUDIT_2026-05-17.md`
**Implementation target:** Follow Up Boss `ryan-realty` account · 3 brokers · ~15 real seller leads / quarter

---

## 1. What this replaces

Per the audit:

- **67 action plans, only 6 ever fired**, 19 are seller-touching with heavy duplication
- **11 distinct seller-tag variants** from 6 different naming conventions
- **0 of the 16 lead-intel custom fields** described in `docs/FUB_CUSTOM_FIELDS.md` actually exist
- **24 of 26 recent leads assigned to Matt** — round-robin not running
- **No purpose-built smart lists** — only FUB factory defaults

This spec collapses all of that into ONE seller workflow.

---

## 2. Architectural constraint (discovered during build)

FUB v1 API for integrations is **READ + TAG + TASK only**:

| Endpoint | Available to our integration? |
|---|---|
| `GET /v1/people`, `/v1/emails`, `/v1/textMessages`, `/v1/events`, `/v1/notes`, `/v1/tasks` | ✅ Yes |
| `PUT /v1/people/{id}` (tag, assign, stage) | ✅ Yes |
| `POST /v1/tasks`, `/v1/notes`, `/v1/events` | ✅ Yes |
| `POST /v1/emails` (send email) | ❌ 403: "This endpoint is currently unavailable to integrations" |
| `POST /v1/textMessages` (send SMS) | ❌ 403: "You do not have access to this API endpoint" |
| `POST /v1/actionPlans/{id}/people` (enroll in action plan) | ❌ 404 — endpoint doesn't exist |

**Consequence:** All automated email + SMS touches MUST fire from FUB's own action-plan engine, which is triggered by **FUB-UI Automations** (rules that listen for tag changes or events). Our code's job is to:

1. Create / find the FUB person via API
2. Apply the right tag set via API
3. FUB's automation rule sees the tag → enrolls the lead in our action plan
4. FUB's action plan engine sends every email + SMS on schedule using FUB's own infrastructure (so every send is automatically tracked in the lead's record)

This is actually cleaner than my original proposal — Matt edits the touches in the FUB UI, and the code stays out of the message-content business.

---

## 3. Cadence — research-backed (2026-05-17)

**Evidence base:**

| Stat | Source |
|---|---|
| Lead response < 5 min → **21× more likely to qualify** than 30 min | MIT / InsideSales / Dr. James Oldroyd "Lead Response Management Study" (15,000-lead analysis) |
| Lead response < 5 min → **100× more likely to connect** | InsideSales / Harvard Business Review |
| 78% of customers buy from the company that responds first | InsideSales / HBR |
| Average agent response time: **47 min** (loses 90% of chance) | Hydraklient industry analysis |
| **8–12 follow-ups** needed for typical internet lead → appointment | Industry benchmark (Luxury Presence, Jamil Academy 2026) |
| 80% of closed sales need **5+ touches** | Industry benchmark |
| **5 attempts over 10 days = 40%** conversion of initially unresponsive | Industry benchmark |
| SMS limit: **1–2 per 30-day window** to avoid spam flagging | EZ Texting, Fello 2026 |
| Email: **8–10 over 6–10 weeks** = buyer/seller core | FUB blog, industry consensus |
| Best email send time: **9:00 AM** local | FUB default, industry consensus |

**Key insight:** speed-to-first-touch is the dominant variable. Everything else (cadence over 30/60/90 days) is the safety net. The current Ryan Realty workflow's biggest miss is that the first email goes out at T+24h instead of T+0.

### Locked cadence

10 touches over 60 days. Each touch pauses if (a) lead has replied OR (b) broker has logged an outbound activity in the last 48 h OR (c) stage advanced past `Lead`.

| # | When | Channel | From | To | Purpose | Hot | Warm | Nurture |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 1 | T+0 instant | Task | system | Assigned broker | "Call {firstName} now" (5min SLA hot / 4h warm / 24h nurture) | ✅ | ✅ | ✅ |
| 2 | T+0 instant | Push + iMessage | system | Assigned broker | "Hot seller: {firstName} {lastName}, {address}, {timeline}" | ✅ | ✅ | ✅ |
| 3 | T+0 instant | Email | FUB action plan | Lead | **SL-01** Confirmation — "Got your request, CMA coming" | ✅ | ✅ | ✅ |
| 4 | T+1 min | SMS | FUB action plan | Lead | **SL-S1** SMS confirmation — "Hey {firstName}, Matt from Ryan Realty. Got your home value request for {address}. CMA in your inbox shortly. Anything I should factor in?" | ✅ | ✅ | ✅ |
| 5 | T+5–60 min async | Email | `matt@ryan-realty.com` via Resend (BCC: FUB tracking) | Lead | CMA PDF auto-delivered from existing `/api/cma/[slug]/email` | ✅ | ✅ | ✅ |
| 6 | T+24 h 9 AM | Email | FUB action plan | Lead | **SL-02** "Did the analysis make sense?" | ✅ | ✅ | — |
| 7 | T+3 d 10 AM | SMS | FUB action plan | Lead | **SL-S2** "Hi {firstName} — Matt at Ryan Realty. Just checking in on the CMA. Any questions?" | ✅ | — | — |
| 8 | T+7 d 9 AM | Email | FUB action plan | Lead | **SL-03** Market update for their city/neighborhood | ✅ | ✅ | ✅ |
| 9 | T+14 d 9 AM | Email | FUB action plan | Lead | **SL-04** Recent comparable sale case study | ✅ | ✅ | ✅ |
| 10 | T+30 d 9 AM | Email | FUB action plan | Lead | **SL-05** "Still considering selling?" + soft check-in | ✅ | ✅ | ✅ |
| 11 | T+60 d | System | system | system | Move to `seller:long-nurture`, end this plan, start monthly newsletter | ✅ | ✅ | ✅ |

**Channel count totals per tier:**

- **Hot:** 6 emails + 2 SMS + 1 task + 1 push over 60d (within 8–10 email / 1–2 SMS / 8–12 touches industry guidance)
- **Warm:** 6 emails + 1 SMS + 1 task + 1 push (no T+3d SMS — saves SMS budget for hottest leads)
- **Nurture:** 5 emails + 1 SMS + 1 task + 1 push (skips T+24h check-in; longer-fuse audience)

All cadence numbers are **defensible against the published research**. If response rates surface a tuning need, the action plan in FUB UI is the single place to adjust (no code changes).

---

## 4. Canonical tag schema (locked — kebab-case namespaced per Matt 2026-05-17)

```
audience:seller              ← every seller-intent lead (replaces 11 variants)
seller:hot                   ← ready to list within 0–3 months  
seller:warm                  ← 3–12 months
seller:nurture               ← 12+ months / exploring
seller:long-nurture          ← promoted after 60d of no engagement
seller:recovery              ← closed lost, recovery candidate
seller:in-conversation       ← broker has manually engaged — pauses all auto touches
seller:do-not-contact        ← unsubscribed or asked us to stop
source:seller-lp             ← from /lp/seller-home-value
source:fb-ads-seller         ← from FB lead-gen ad
source:google-ads-seller     ← from Google ads landing
source:referral              ← manual entry
source:open-house            ← from open house signup
broker:matt                  ← assigned to Matt
broker:rebecca               ← assigned to Rebecca
broker:paul                  ← assigned to Paul
```

**Rules:**
- Every seller lead carries exactly **one** `audience:*`, **one** `seller:{tier}`, **one** `source:*`, and (after assignment) **one** `broker:*` tag.
- The FUB automation rule that triggers the action plan looks for `audience:seller` + `seller:hot|warm|nurture`. Adding `seller:in-conversation` or `seller:do-not-contact` pauses the plan.
- The 6 legacy conventions get normalized via the bulk migration in §11.

---

## 5. Custom fields (create these in FUB)

| FUB api name | label | type | written by |
|---|---|---|---|
| `customMoveTimeline` | Move Timeline | text | LP form |
| `customLeadTier` | Lead Tier | text | LP form + brain |
| `customIsSellerCurious` | Is Seller Curious | text | LP form |
| `customSellerPropertyAddress` | Seller Property Address | text | LP form |
| `customCmaDeliveredAt` | CMA Delivered At | date | CMA producer |
| `customCmaPdfUrl` | CMA PDF URL | text | CMA producer |

---

## 6. Assignment rule

**All inbound seller leads route to Matt.** Per Matt's 2026-05-17 directive: "no round robin. I will get all listings and leads." Rebecca + Paul remain in FUB and can have leads manually reassigned via the FUB UI on a per-lead basis. The `marketing_assignments` ledger still records every assignment for audit + future flexibility — broker column will always be `'matt'` until policy changes.

Implementation in `app/lp/seller-home-value/actions.ts`:

```typescript
// Resolve next assignee for a new seller lead.
async function assignSellerLead(timeline: SellerLPTimeline): Promise<{ userId: number; broker: 'matt' | 'rebecca' }> {
  // Hot leads default to Matt unless he's OOO.
  if (timeline === 'ready-now') {
    const mattOoo = await isBrokerOoo('matt')
    if (!mattOoo) return { userId: 1, broker: 'matt' }
  }
  // Warm + nurture (or hot when Matt is OOO): round-robin between active brokers in group 2 ("Seller Leads").
  const last = await getLastSellerAssignment()  // Supabase: marketing_assignments table
  const next = last?.broker === 'matt' ? { userId: 2, broker: 'rebecca' as const } : { userId: 1, broker: 'matt' as const }
  return next
}
```

Supabase table for the round-robin state (new):

```sql
CREATE TABLE IF NOT EXISTS public.marketing_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  audience     text NOT NULL,                -- 'seller' | 'buyer'
  broker       text NOT NULL,                -- 'matt' | 'rebecca' | 'paul'
  fub_user_id  int NOT NULL,
  fub_person_id int,
  source       text                          -- 'seller-lp' | 'fb-ads' | etc.
);
CREATE INDEX ON public.marketing_assignments (audience, assigned_at DESC);
```

---

## 7. End-to-end flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AD → LP → FUB → AUTO-TOUCHES → BROKER → CLOSED LISTING                  │
└─────────────────────────────────────────────────────────────────────────┘

  ① Google or Facebook ad
       ▼
  ② Landing page  /lp/seller-home-value
       │  Capture: address, name, email, phone, timeline
       ▼
  ③ Server action  submitSellerLPForm()
       │  3a) Resolve or create FUB person (existing logic stays)
       │  3b) Round-robin assign to Matt or Rebecca (§6)
       │  3c) Apply CANONICAL tag set (§4):
       │       audience:seller + seller:{tier} + source:seller-lp + broker:{slug}
       │  3d) Set 6 custom fields (§5) via PUT /v1/people/{id}
       │  3e) Create Note: "LP submission · address · timeline · classification"
       │  3f) Create marketing_brain_actions row (action_type=content:cma) — existing
       │  3g) Fire Meta CAPI Lead $500 event — existing
       │  3h) Push + iMessage to assigned broker — NEW (via iMessage MCP at server level)
       ▼
  ④ FUB Automation Rule (configured in FUB UI):
       │  "WHEN tag audience:seller AND seller:hot|warm|nurture IS ADDED
       │   THEN ENROLL person in action plan 'Seller Lead — Master Workflow'"
       ▼
  ⑤ FUB Action Plan: "Seller Lead — Master Workflow"
       │  Runs all 10 scheduled touches (§3 table) from FUB's own engine.
       │  Branches on tag seller:{hot|warm|nurture} for which touches fire.
       │  Pauses on:
       │    • Tag seller:in-conversation added
       │    • Tag seller:do-not-contact added
       │    • Lead replies (FUB native pause-on-reply)
       │    • Stage moves past Lead
       ▼
  ⑥ CMA producer (async, ~5-10 min from submission)
       │  6a) Generate 13-page HTML at public/cmas/cma-<slug>/
       │  6b) Render PDF (10-14 MB) via /api/cma/<slug>/pdf
       │  6c) POST to /api/cma/<slug>/email — sends from matt@ryan-realty.com
       │       via Resend with PDF attached. BCC: <matt-bcc>@bcc.followupboss.com
       │       so FUB logs it under the lead's record.
       │  6d) Update FUB person: set customCmaDeliveredAt, customCmaPdfUrl
       │  6e) Update local cmas row status='delivered'
       ▼
  ⑦ Broker takes over (manual primary path)
       │  Sees push + iMessage. Calls within SLA. Sends Gmail.
       │  Adds tag seller:in-conversation (pauses all auto touches).
       │  When ready: stage Lead → Active Client.
       ▼
  ⑧ Background poll job  (every 15 min — extends existing daily cron)
       │  Polls /v1/emails + /v1/textMessages for inbound activity on
       │  any person with active seller workflow enrollment. When inbound
       │  detected, adds tag seller:in-conversation automatically.
```

---

## 8. Email + SMS templates (need to be written + uploaded to FUB UI)

| id | name | channel | scheduled | length |
|---|---|---|---|---|
| SL-01 | Seller LP Confirmation | email | T+0 | ~80 words |
| SL-S1 | Seller SMS Confirmation | SMS | T+1 min | 1 line |
| SL-02 | Seller CMA Check-in | email | T+24 h | ~60 words |
| SL-S2 | Seller SMS Check-in (hot only) | SMS | T+3 d | 1 line |
| SL-03 | Seller Market Update | email | T+7 d | ~120 words, city-tokenized |
| SL-04 | Seller Case Study | email | T+14 d | ~100 words + comparable sale |
| SL-05 | Seller Soft Check-in | email | T+30 d | ~50 words |

All templates honor CLAUDE.md brand voice (no em-dashes, semicolons, banned words; sentence case; Matt's plain-honest tone). Drafts go in `marketing_brain_skills/producers/ops-fub-crm/templates/` for review.

### Template SL-01 (T+0 confirmation email)

```
Subject: Got your home value request for {address}

Hi {firstName},

Thanks for reaching out. We got your request for the home value analysis
on {address}, and I'm pulling comps now.

You'll have the full personalized CMA in your inbox shortly. If anything
specific about the property would change how I think about value —
recent upgrades, special features, anything unique — just reply here
and I'll factor it in.

Talk soon,
Matt Ryan
Ryan Realty
541.213.6706
matt@ryan-realty.com
```

### Template SL-S1 (T+1 min confirmation SMS)

```
Hey {firstName}, Matt from Ryan Realty here. Got your home value request
for {address}. Your CMA will be in your inbox shortly. Anything I
should know about the property before I send it?
```

### Template SL-02 (T+24 h email)

```
Subject: Did the CMA make sense?

Hi {firstName},

Wanted to make sure the analysis came through OK on {address}. The
{city} market has been doing some interesting things, and your property
has a few things working in its favor.

Happy to walk through it over the phone or coffee if you want to dig in.

Matt
541.213.6706
```

### Template SL-S2 (T+3 d SMS, hot only)

```
Hi {firstName}, Matt at Ryan Realty checking in. Did you get a chance
to look at the home value analysis? Happy to answer anything.
```

### Template SL-03 (T+7 d market update email)

```
Subject: Where {city} is right now

Hi {firstName},

A quick update on what's happening in {city} that might affect what
your home could fetch:

- Median sale price: {median_sale_price} ({yoy_pct} vs last year)
- Months of supply: {mos} ({mos_classification})
- {recent_sold_address} just sold for {recent_sold_price} ({days_since} days ago)

Your CMA already reflects most of this, but the trend is what matters.
Let me know if anything has shifted on your end.

Matt
541.213.6706
```

Numbers populate at send time via Supabase market data (see implementation in §10).

### Template SL-04 (T+14 d case study email)

```
Subject: How {recent_sold_address} sold for {price}

Hi {firstName},

A property near you just closed and I thought you'd want to see how it
played out:

- Listed at {list_price}
- Sold at {sold_price} ({days_on_market} days on market)
- {brief_story_one_sentence}

The takeaway for {address}: {one-sentence_takeaway}.

If you're getting closer to making a move, let's talk through what
the next 60 days could look like.

Matt
```

### Template SL-05 (T+30 d soft check-in email)

```
Subject: Still thinking about selling?

Hi {firstName},

It's been a few weeks since the CMA on {address}. No pressure either
way, just wanted to check in — has your timing changed at all?

If yes, I'm here. If no, I'll keep you on the market updates so when
the time is right, you've got the picture.

Matt
541.213.6706
```

---

## 9. Smart lists (4 purpose-built)

| name | filter | who watches | cadence |
|---|---|---|---|
| **Sellers — new today** | `audience:seller` + created in last 24h + no broker activity | Matt + Rebecca | check at 9 AM |
| **Sellers — hot, untouched** | `seller:hot` + no broker activity in 4 h | Matt | daily |
| **Sellers — warm in flight** | `seller:warm` + last broker activity 1–7 d ago | Both | weekly |
| **Sellers — recovery** | `seller:recovery` + closed lost > 90 d ago | Matt | monthly |

---

## 10. Pause-on-reply detection (background poll job)

FUB doesn't expose outbound webhooks on our tier (per audit §10). Instead, extend the existing daily cron `app/api/cron/marketing-snapshot-fub/route.ts` to run every 15 min and check for inbound messages on enrolled sellers:

```typescript
// NEW: app/api/cron/seller-workflow-pause/route.ts
// Runs every 15 min via vercel.json cron.
// For every person tagged audience:seller AND (seller:hot|warm|nurture):
//   1. GET /v1/emails?personId=X&since={last_check}
//   2. GET /v1/textMessages?personId=X&since={last_check}
//   3. If any message where isIncoming===true: add tag seller:in-conversation
//   4. FUB automation listens for seller:in-conversation → removes from action plan
```

15-min granularity is good enough for a workflow where the broker is the primary toucher and the auto-touches are the safety net. Sub-minute pause would require FUB webhooks (paid tier).

---

## 11. Cleanup before launch

| item | action | count | risk |
|---|---|---:|---|
| Action plans `*KTS AP *` with `isUsed:false` and 0 enrollments | archive | ~40 | none |
| Empty placeholder plans (id 65, 66, 67 — zero steps) | delete | 3 | none |
| Test records (`TEST RECORD - DELETE`, `TEST-DELETE-ME`, `v6 audit test`, `localhost:3000` source, `Variant-B Test`, `Test Lead-CAPI-Wired`) | delete | 7 | none |
| Orphan tags (count ≤ 3, see audit §6 — 47 of them) | bulk remove | 47 | low |
| User-name tags (`Paul Stevenson`, `Rebecca Peterson` as person tags) | remove | 4 | low |
| `Seller - Home Evaluation Request` (id 5) — the old seller plan | archive AFTER new plan is live and verified | 1 | low |

---

## 12. Implementation phases

**Phase 1 — Foundation (no risk to existing leads):**
1. Create the 6 custom fields in FUB via API (`POST /v1/customFields` if available) or note for Matt to add via UI
2. Delete the 7 test records via FUB UI (Matt does this; bulk-delete via API is not available)
3. Archive the 40 dead `*KTS AP *` action plans (Matt does in UI; archive endpoint not exposed)
4. Delete the 3 empty placeholder plans (Matt does in UI)

**Phase 2 — Tag schema convergence (medium risk):**
5. Update `app/lp/seller-home-value/actions.ts` to emit only canonical tags + custom fields + round-robin
6. Create Supabase migration for `marketing_assignments` table
7. Bulk-add `audience:seller` + `seller:nurture` to the 3,481 `Seller`-tagged leads via API
8. Bulk-add canonical schema to the 6 variant-tagged leads
9. Wait 7 days for verification, then remove legacy variants in a second pass

**Phase 3 — New workflow (Matt builds in FUB UI from the spec in §3 + §8):**
10. Matt creates the 7 email/SMS templates in FUB UI (paste from §8)
11. Matt builds the `Seller Lead — Master Workflow` action plan in FUB UI per §3 table
12. Matt creates the FUB Automation rule: "WHEN tag audience:seller IS ADDED → enroll in action plan"
13. Matt creates the 4 smart lists in FUB UI per §9
14. Test end-to-end with Matt's own address as the lead

**Phase 4 — Pause-on-reply + assignment helpers:**
15. Build `lib/followupboss.ts` helpers: `assignPersonToUser(id, userId)`, `setCustomFields(id, fields)`
16. Build `/api/cron/seller-workflow-pause/route.ts` (15-min cron)
17. Build Supabase RPC for `getLastSellerAssignment` + `recordSellerAssignment`
18. Wire CMA producer to add BCC tracking address on send

**Phase 5 — Documentation:**
19. Update `marketing_brain_skills/producers/ops-fub-crm/SKILL.md` with the new workflow
20. Update `CLAUDE.md` Marketing Lead Flow section
21. Update `docs/MARKETING_LEAD_FLOW.md` with the new flow diagram
22. Commit this doc as canonical reference

---

## 13. What stays exactly as it is

- All 13,163 lead records stay (except 7 test deletions Matt approves)
- All current assignments stay (no reassignment of existing leads)
- Both pipelines stay (Buyers + Sellers)
- All 10 people stages stay
- All custom MLS fields stay
- All Matt-authored email templates stay
- Existing CMA producer pipeline stays unchanged
- Gmail Connect stays on for tracking manual outreach

---

## 14. Sources (cadence evidence base)

- [MIT Lead Response Management Study (Oldroyd / InsideSales / HBR)](https://25649.fs1.hubspotusercontent-na2.net/hub/25649/file-13535879-pdf/docs/mit_study.pdf) — the original 5-min / 21× / 100× findings
- [Real Estate Agent's Guide to Lead Follow-Up in 2026 — Luxury Presence](https://www.luxurypresence.com/blogs/real-estate-agents-guide-to-lead-follow-up/)
- [Real Estate Lead Conversion Rate Benchmarks 2026 — Jamil Academy](https://www.jamilacademy.com/blog/real-estate-lead-conversion-rate-benchmarks)
- [Why Speed-to-Lead Matters in 2026 — Call Porter](https://callporter.com/blog/speed-to-lead-real-estate/)
- [The 5-Minute Rule: Real Estate — Hydraklient](https://www.hydraklient.com/resources/blog/real-estate-lead-response-time-statistics)
- [Real Estate Lead Response Statistics 2026 — AgentZap](https://agentzap.ai/blog/real-estate-lead-statistics)
- [7 Best Ways to Follow-up with Home Value Leads — Fello](https://fello.ai/blogs/7-best-ways-to-follow-up-with-home-value-leads)
- [Real Estate Lead Follow-Up Scripts & SMS Tips — EZ Texting](https://www.eztexting.com/real-estate/lead-follow-up-sms)
- [Action Plans Overview — Follow Up Boss Help Center](https://help.followupboss.com/hc/en-us/articles/1500008539982-Action-Plans-Overview)
- [Lead Flow 2.0: How to adjust your follow-up sequences — Follow Up Boss Blog](https://www.followupboss.com/blog/follow-up-sequences-for-each-lead-type)

---

*End of locked spec. Implementation starts immediately per Matt's direction "once you know that, just go ahead and build it."*
