# Ryan Realty — Buyer Lead Workflow (Locked Spec)

**Status:** Locked 2026-05-17.
**Mirrors:** `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` — same architecture, different cadence + content.
**Implementation:** Phase C of the round-2 optimization.

---

## 1. Why buyers need their own workflow

Sellers value certainty + an authoritative CMA in their inbox the next business day. Buyers are different: they need **fast listing matches** because the inventory moves quickly. A buyer who waits 24h for a follow-up often loses to another agent who responded in 15 min.

So the buyer workflow cadence is **front-loaded** compared to the seller one:

| Touch | Seller | Buyer |
|---|---|---|
| First contact | T+0 confirmation email | T+0 confirmation email |
| First SMS | T+1 min | T+1 min |
| First deliverable | CMA, T+5-60 min | First matched listings, T+30 min |
| First broker check-in | T+24 h | **T+2 h** (buyers shop fast) |
| First SMS check-in | T+3 d (hot only) | T+24 h (hot/warm) |
| First content drop | T+7 d (market update) | T+3 d (saved-search alerts ramp up) |
| Soft check-in | T+30 d | T+14 d |
| Long-nurture handoff | T+60 d | T+60 d |

Same plumbing — different timing.

---

## 2. Operating principle

Same as the seller workflow: **the broker is the primary toucher. The action plan is the safety net.** The moment the broker emails, calls, or texts the lead, all auto touches pause.

For buyers, the broker's job is to:
1. Acknowledge the lead within 5 min (hot) / 4 h (warm) / 24 h (nurture).
2. Pull matching listings from MLS + send 5-10 first-week alerts.
3. Schedule a showing tour or buyer consult call within 7 days.

The action plan covers the days/weeks where the broker is heads-down — it sends "did you see this listing?" + market updates + soft check-ins.

---

## 3. Canonical tag schema

Mirrors seller schema, namespaced for buyer:

```
audience:buyer              ← every buyer-intent lead
buyer:hot                   ← ready to buy in 0-3 months
buyer:warm                  ← 3-12 months
buyer:nurture               ← 12+ months / exploring
buyer:long-nurture          ← promoted after 60d of no engagement
buyer:in-conversation       ← broker engaged; pauses auto touches
buyer:do-not-contact        ← unsubscribed / asked to stop

source:buyer-lp             ← from /lp/buyer-listing-alerts
source:fb-ads-buyer         ← from FB lead-gen ad form
source:google-ads-buyer     ← from Google ads landing
source:idx-registration     ← from IDX-vendor signup
source:referral             ← manual entry from referral
source:open-house           ← manual entry from open house

broker:matt | broker:rebecca | broker:paul
```

Compliance gates:
- `do_not_email`, `compliance:hard-stop` already applied to 694 records in round 2 — same gate keeps buyer workflow from emailing them.

---

## 4. Cadence — 10 touches over 60 days

| # | When | Channel | From | To | Purpose | Hot | Warm | Nurture |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 1 | T+0 instant | Task | system | Assigned broker | "Call {firstName} now" (5 min hot / 4 h warm / 24 h nurture SLA) | ✅ | ✅ | ✅ |
| 2 | T+0 instant | Push + iMessage | system | Assigned broker | "Hot buyer: {firstName} {lastName}, looking in {areas}, budget {price_range}" | ✅ | ✅ | ✅ |
| 3 | T+0 instant | Email | FUB action plan | Lead | **BL-01** Confirmation — "Got your search, alerts starting" | ✅ | ✅ | ✅ |
| 4 | T+1 min | SMS | FUB action plan | Lead | **BL-S1** SMS confirmation — short, "we'll have matches in your inbox in 30 min" | ✅ | ✅ | ✅ |
| 5 | T+30 min async | Email | matt@ryan-realty.com via FUB | Lead | First 5-10 matched listings (broker manually curates OR scripted IDX search send) | ✅ | ✅ | ✅ |
| 6 | T+2 h | Task | system | Assigned broker | "Call {firstName} for buyer consult — book showings" | ✅ | ✅ | — |
| 7 | T+24 h 9 AM | Email | FUB action plan | Lead | **BL-02** "Anything caught your eye?" — soft listing-feedback ask | ✅ | ✅ | — |
| 8 | T+3 d 10 AM | SMS | FUB action plan | Lead | **BL-S2** Hot only: "Quick check — found anything you want to see in person?" | ✅ | — | — |
| 9 | T+7 d 9 AM | Email | FUB action plan | Lead | **BL-03** Market intel for their search areas (months of supply, recent solds, what's moving fast) | ✅ | ✅ | ✅ |
| 10 | T+14 d 9 AM | Email | FUB action plan | Lead | **BL-04** Featured listing or just-listed in their criteria | ✅ | ✅ | ✅ |
| 11 | T+30 d 9 AM | Email | FUB action plan | Lead | **BL-05** Soft check-in — "still looking? need anything different?" | ✅ | ✅ | ✅ |
| 12 | T+60 d | System | system | system | Move to `buyer:long-nurture` + end this plan; lead joins monthly newsletter | ✅ | ✅ | ✅ |

**Channel counts per tier:**
- **Hot:** 5 emails + 2 SMS + 2 tasks + 1 push over 60d (within 8-10 email / 1-2 SMS / 8-12 touches industry guidance)
- **Warm:** 5 emails + 1 SMS + 1 task + 1 push
- **Nurture:** 4 emails + 1 SMS + 1 task + 1 push (skips the 2h+24h follow-ups — longer fuse audience)

**Pause logic:** same as seller workflow — pauses on inbound message, broker outbound activity, stage advance, or `buyer:in-conversation` / `buyer:do-not-contact` tag.

---

## 5. Assignment rule

**All inbound buyer leads route to Matt.** Per Matt's 2026-05-17 directive: "no round robin. I will get all listings and leads." Rebecca + Paul remain in FUB; manual reassignment in FUB UI only. The `marketing_assignments` ledger records every assignment (broker = `'matt'`) for audit + future flexibility.

---

## 6. Custom fields (new — buyer-specific)

| FUB api name | label | type | who writes |
|---|---|---|---|
| `customBuyerBudgetMin` | Buyer Budget Min | number | LP form |
| `customBuyerBudgetMax` | Buyer Budget Max | number | LP form |
| `customBuyerSearchAreas` | Buyer Search Areas | text | LP form (csv of neighborhood slugs) |
| `customBuyerBedrooms` | Buyer Beds Min | number | LP form |
| `customBuyerMoveTimeline` | Buyer Move Timeline | text | LP form |
| `customBuyerLeadTier` | Buyer Lead Tier | text | LP form + canonical tagger |

(`customLeadTier` already exists from seller side — let me reuse it instead of creating a duplicate. **Decision:** reuse `customLeadTier`. Skip `customBuyerLeadTier`.)

So: 5 new custom fields.

---

## 7. Email + SMS templates (need to be created)

| id | name | channel | scheduled | length |
|---|---|---|---|---|
| BL-01 | Buyer LP Confirmation | email | T+0 | ~80 words |
| BL-S1 | Buyer SMS Confirmation | SMS | T+1 min | 1 line |
| BL-02 | Buyer 24h Check-in | email | T+24 h | ~60 words |
| BL-S2 | Buyer SMS Check-in (hot only) | SMS | T+3 d | 1 line |
| BL-03 | Buyer Market Intel | email | T+7 d | ~120 words, search-area-specific |
| BL-04 | Buyer Featured Listing | email | T+14 d | ~100 words + listing link |
| BL-05 | Buyer Soft Check-in | email | T+30 d | ~50 words |

All templates honor CLAUDE.md brand voice. Drafts go in `marketing_brain_skills/producers/ops-fub-crm/templates/`.

---

## 8. Buyer LP form

**Path:** `/lp/buyer-listing-alerts`
**Server action:** `app/lp/buyer-listing-alerts/actions.ts`

Form fields:
- Name + email + phone (required)
- Budget range (slider or two numeric inputs)
- Search areas (multi-select from Bend neighborhoods + Sunriver + Sisters + Redmond)
- Bedrooms min (dropdown 1-5+)
- Move timeline (`ready-now` / `next-3-6` / `next-6-12` / `exploring`)
- Optional: "Tell us about your dream home" textarea

On submit:
1. Resolve/create FUB person
2. Apply canonical tags (audience:buyer + buyer:tier + source:buyer-lp + broker:slug)
3. Write 6 custom fields (budget min/max, search areas, beds, timeline, tier)
4. Round-robin assign (hot to Matt; rest alternating)
5. Create FUB Seller Inquiry event with type "Buyer Inquiry"
6. Fire Meta CAPI Lead event ($300 value)
7. Trigger first-listing-batch email (separate producer)

---

## 9. Pause-on-reply (extends existing cron)

Update `app/api/cron/seller-workflow-pause/route.ts` → rename to `app/api/cron/workflow-pause/route.ts` to handle BOTH seller AND buyer leads in one cron run.

For every person tagged `audience:seller` OR `audience:buyer`, with active tier tag, check for inbound messages in last 20 min. If found, add the corresponding `:in-conversation` tag.

---

## 10. Implementation phases (Phase C breakdown)

**C.1 (5 min) — Create 5 buyer custom fields via API**
- POST /v1/customFields × 5 (we know this works)

**C.2 (5 min) — Create 5 email/SMS templates via API**
- POST /v1/templates × 5 (we know this works, used for SL templates)

**C.3 (10 min) — Create Buyer Master Workflow action plan via API**
- POST /v1/actionPlans (we know this works — created action plan 69 the same way)
- 9 steps mirroring the seller plan structure

**C.4 (30 min) — Build buyer LP form**
- `app/lp/buyer-listing-alerts/page.tsx` (UI)
- `app/lp/buyer-listing-alerts/actions.ts` (server action)
- Reuses `canonicallyTagLead()`, `setPersonCustomFields()`, `geocodeAndTagLead()`

**C.5 (5 min) — Extend pause-on-reply cron**
- Add `audience:buyer` to the enrolled-sellers query in `app/api/cron/seller-workflow-pause/route.ts`

**C.6 (5 min) — One FUB UI Automation Rule for Matt**
- When tag `audience:buyer` added → enroll in action plan id 70

**Total wall time: ~60 min** (most done via API).

---

## 11. What Matt sees in FUB after this ships

When a buyer LP submission lands:
1. New FUB person with `audience:buyer`, `buyer:{tier}`, `source:buyer-lp`, `broker:matt|rebecca` tags
2. Custom fields populated: budget range, search areas, beds, timeline, tier
3. Auto-assigned via round-robin
4. Push + iMessage alert: "Hot buyer: Jane Doe, $400-600K, NWX + Old Bend, 3+ bd, ready now"
5. 5-min call task created
6. Confirmation email (BL-01) + 1-min SMS (BL-S1) fire automatically
7. Listing-match email fires at T+30 min (broker curates OR scripted IDX search)
8. Broker calls + sends Gmail → all auto touches pause forever

Filterable smart lists immediately:
- `audience:buyer + buyer:hot` → Hot buyers needing call now
- `audience:buyer + customBuyerSearchAreas LIKE %northwest-crossing%` → NWX-area buyers
- `audience:buyer + customBuyerBudgetMin >= 1000000` → $1M+ buyers
- `audience:buyer + tenure:warm + 7-14 days enrolled` → Warm buyers ready for showings push

---

## 12. Implementation notes

- The buyer workflow does NOT generate a CMA. That's seller-only. Buyer first-deliverable is a matched-listings email which is a separate producer (future enhancement — for now Matt curates manually within the 30-min window).
- Architectural constraint same as seller: FUB blocks POST /v1/emails + /v1/textMessages for integrations, so all auto messages fire from FUB's action-plan engine. Our code's job is tag + custom-field + task + assignment.
- The pause-on-reply cron runs every 15 min; would be reduced to near-real-time if `peopleTagsUpdated` webhook gets registered (deferred decision).

---

*End of locked spec. Building.*
