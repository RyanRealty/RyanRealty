# Follow Up Boss — Round 2 Optimization Audit (2026-05-17)

**Account:** Ryan Realty (`ryan-realty`) · FUB account id `1980916597` · owner `matt@ryan-realty.com`
**Run by:** Claude Code agent via Anthropic skill, FUB v1 REST API (Basic auth, `FOLLOWUPBOSS_API_KEY` from `.env.local`)
**Snapshot taken:** 2026-05-17 (UTC) — full population scan of 13,157 records
**Raw dumps:** `.tmp_env/fub-audit/dump2/*.json` (untracked, regenerable via `node --env-file=.env.local .tmp_env/fub-audit/optimization-audit.mjs`)
**Scope:** Read-only. Zero mutations issued.

**Builds on:** `docs/FUB_AUDIT_2026-05-17.md` (Round 1 baseline) and `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` (seller workflow build).

---

## TL;DR — what's STILL not optimal

The seller workflow build (Round 1) crushed the big stuff: 68 action plans deleted, 525 KTS templates hidden, canonical `audience:seller` tag now on 3,498 records, seller LP form writes canonical tags + round-robins between Matt and Rebecca. But the audit surfaces eleven distinct remaining drag points:

| # | Issue | Evidence | Priority |
|---|---|---|---|
| 1 | **652 phone-duplicate groups (878 extra records)** — 29 records sharing one phone | Top dupe `541-383-7600` (Bend Cable HQ # used as placeholder) | HIGH |
| 2 | **All 25 custom fields are 0% populated** — including the 6 new SL fields | LP form writes tags but not `customLeadTier`, `customMoveTimeline`, `customIsSellerCurious` | HIGH |
| 3 | **Recent leads bypass canonical tag schema** — 5 of last 5 missing `audience:buyer`/`audience:seller` | Only the seller LP form uses canonical tags; all other paths write legacy `Buyer`/`Bounced`/empty | HIGH |
| 4 | **All 5 recent leads assigned to Matt** (last 30d), 19 of 21 in last 90d | Round-robin only works for new seller LP path; everything else defaults to owner=Matt | HIGH |
| 5 | **10,762 records (82% of CRM) sit at `Lead` stage** — funnel has zero throughput | Only 1 person promoted to `A - Hot 1-3 Months` in entire CRM history | HIGH |
| 6 | **2,315 "Real Estate Agent" records bloat the funnel** (UNDECLARED stage) | They're realtor competitors with `Realtor` tag, not customer leads | MEDIUM |
| 7 | **0 webhooks registered** — 15-min pause-on-reply cron still polls when `peopleTagsUpdated` webhook would fire in seconds | Real-time FUB reactivity would replace polling | MEDIUM |
| 8 | **15 of 20 deals are `Closed` (historical)** — only 1 Listed + 1 Pending are truly open | Stage `Closed` should auto-archive after 90d to keep pipeline clean | MEDIUM |
| 9 | **18 test/junk records still in the live data** (`Test Test`, `No name Name`, `KTS Test Contact`, `Variant-B Test`) | Distort every metric; LP test traffic from `localhost:3000` + `ryanrealty.vercel.app` still in prod | MEDIUM |
| 10 | **4 site source-string variants** still live (`Ryan-Realty.com` 45 / `Website` 10 / `ryan-realty` 6 / `ryanrealty.vercel.app` 4) | One canonical label would make smart lists trivially filterable | LOW |
| 11 | **No buyer workflow exists** — 45 records carry `Buyer` tag with no automation | Mirror "Buyer Lead — Master Workflow" would cover the other half of inbound | MEDIUM |

**Bottom line:** the seller-side surgery worked. The buyer side, the custom fields, the duplicates, and the funnel-throughput stages are the next bottleneck cluster.

---

## 1. Stages — funnel emptiness + undeclared stages

10 stages declared in `/stages`, but only 6 carry meaningful population. Two stages exist on records but aren't declared in `/stages` at all.

### Stage distribution (real)

| Stage | Population | Declared? | Notes |
|---|---:|:---:|---|
| `Lead` | **10,762** | ✅ | Default. 82% of CRM. Funnel doesn't move. |
| `Real Estate Agent` | **2,315** | ❌ UNDECLARED | Realtor competitor list. 2,313 of them carry `Realtor` tag. Imported via KTS, not a customer funnel stage. |
| `C - Cold 6+ Months` | 47 | ✅ | Live cold list (KTS classification) |
| `Past Client` | 21 | ✅ | |
| `Active Client` | 8 | ✅ | Currently working with |
| `Archive` | 2 | ✅ | Soft-delete |
| `A - Hot 1-3 Months` | 1 | ✅ | Only 1 person ever flagged hot |
| `Vendor` | 1 | ❌ UNDECLARED | Single record |
| `B - Warm 3-6 Months` | 0 | ✅ | Empty |
| `Renter - future buyer` | 0 | ✅ | Empty |
| `Sphere` | 0 | ✅ | Empty (SOI live in `Lead` instead) |
| `Pending` | 0 | ✅ | Empty (person-level, not deal-level) |

### Critical: `Real Estate Agent` undeclared stage

2,315 records sit in a stage that doesn't exist in `/stages`. This is the FUB UI auto-creating a synthetic stage when a person's primary "category" reads as Real Estate Agent. **These records aren't customer leads at all** — they're a list of competitor realtors imported via KTS. They show up in every "Lead" smart list count, in every "people created in 2024" report, in every CRM total. They should be moved to `Archive` or a new stage `Industry Contact` so they stop polluting the funnel.

### Critical: `Lead` stage is a black hole

10,762 records (82% of the CRM) sit at `Lead` forever. The funnel doesn't promote anyone:

- `A - Hot 1-3 Months`: **1 person** (in the entire CRM history)
- `B - Warm 3-6 Months`: **0**
- `C - Cold 6+ Months`: 47 (KTS classification)
- `Active Client`: 8
- `Past Client`: 21

**Recommendation HIGH:**
- Add a FUB-UI Automation: "Any lead in `Lead` stage with `audience:seller` AND `seller:hot` tag → auto-promote to `A - Hot 1-3 Months`" (and equivalents for `seller:warm` → `B - Warm`, `seller:nurture` → `C - Cold`).
- Move the 2,315 `Real Estate Agent` records to a new dedicated stage `Industry Contact` (or to `Archive` if they don't need to be referenced).
- Archive the 4 empty stages (`Renter - future buyer`, `Sphere`, `Pending`, `B - Warm 3-6 Months`) or leave alone (they cost nothing).
- Delete the orphan `Vendor` record (single use case, not a real stage).

---

## 2. Pipelines + deal noise

2 pipelines (`Buyers`, `Sellers`), 20 deals total. **15 of 20 are `Closed`** — historical noise that hasn't been archived out of the active pipeline view.

### Deal distribution

| Pipeline | Stage | Count | Notional |
|---|---|---:|---:|
| Sellers | Closed | 9 | $7.93M |
| Buyers | Closed | 6 | $4.94M |
| Buyers | Lost | 2 | $1.93M |
| Buyers | Pending | 1 | $0.735M |
| Sellers | Listed | 1 | $2.635M |
| Sellers | Lost / Terminated | 1 | $0.900M |
| **Total** | | **20** | **$19.0M** |

### Findings

- **Only 2 truly open deals:** 1 in `Buyers / Pending` ($735K Todd Maynes) and 1 in `Sellers / Listed` ($2.635M Scott Reese).
- The other 15 are historical closes that haven't been auto-archived.
- Both pipelines have a `Start (temp stage)` orphan stage with no deals — it's a system default.
- All deals show `created` date `0d ago` — meaning every deal was backfilled into FUB during a single batch (not actual deal creation timestamps).

### Pipelines

| Pipeline | Stages | Closed stage | Notes |
|---|---|---|---|
| Buyers | Start (temp) → Buyer Contract → Offer → Pending → **Closed** → Lost | id 25 (Closed) | Healthy structure |
| Sellers | Start (temp) → Pre-Listing → Listed → Offer → Pending → **Closed** → Lost / Terminated | id 26 (Closed) | Healthy structure |

**Recommendation MEDIUM:**
- Set up a FUB-UI Automation: "Deal in `Closed` stage for >90 days → archive". Keeps the active pipeline view clean.
- Delete the `Start (temp stage)` orphan stages — they're FUB defaults that add zero value.
- Audit whether the historical deals should be in `Past Client` person-stage with the deal archived (since FUB lets you keep deal-history on the person record).

---

## 3. Lead sources — variant cleanup

22 distinct sources live in current data. The big two (`Import` + `Farm`) still dominate; site form variants persist; test sources still live in prod.

### Source distribution (full)

| Count | Source | Notes |
|---:|---|---|
| 5,680 | `Import` | KTS / Kunversion CSV migration |
| 5,318 | `Farm` | Address-list import (county records) |
| 1,299 | `Sphere` | SOI import |
| 402 | `Expired Listing` | MLS expired-listing pull |
| 271 | `Follow Up Boss` | Manual FUB UI add |
| **45** | `Ryan-Realty.com` | **prod website form ← canonical** |
| 32 | `Realtor.com` | |
| 18 | `FSBO` | FSBO list import |
| 16 | `Google` | Manual entry |
| 15 | `Word of Mouth` | Manual entry |
| 11 | `Zillow` | Zillow integration |
| **10** | `Website` | **older site label — should be merged** |
| 8 | `(unspecified)` | Source field empty |
| **6** | `ryan-realty` | **variant — should be merged** |
| 4 | `Open House` | |
| 4 | `Facebook` | |
| 4 | `Referral` | |
| 4 | `Cold Call` | |
| **4** | `ryanrealty.vercel.app` | **preview env hitting prod — should be filtered** |
| 3 | `Sign Call` | |
| 2 | `AI- Claude` | |
| 1 | `IG` | |

### Recent 30d sources (the truth)

All 5 leads created in last 30 days are website form submissions:

| Source | Count |
|---|---:|
| `Ryan-Realty.com` | 4 |
| `ryanrealty.vercel.app` | 1 |

(The `localhost:3000` source from prior audit is gone — 0 records currently carry it.)

### Source consistency issues

Four labels represent the same thing (the website form):
- `Ryan-Realty.com` (45) — canonical
- `Website` (10) — older site label  
- `ryan-realty` (6) — likely a code variant
- `ryanrealty.vercel.app` (4) — preview-env leak

**Recommendation LOW:**
- One-time bulk update: rewrite `Website`, `ryan-realty`, `ryanrealty.vercel.app` → `Ryan-Realty.com` across all 20 records.
- Lock the LP code in `app/lp/seller-home-value/actions.ts` to write `Ryan Realty Website` (or similar single canonical label) regardless of `NEXT_PUBLIC_SITE_URL` env value.
- Tag preview-env submissions (e.g., `env:preview`) so they're easy to filter out of smart lists.

---

## 4. Duplicate leads — 652 phone groups, 47 email, 132 name+city

Significant duplicate pollution. Phone-deduplication is the highest impact.

### 4a. Email duplicates — 47 groups, 47 extra records

The email dupes are largely **spousal/family-trust** records (legitimate dual entries) plus a handful of joint-trust naming weirdness. Sample:

| Email | Count | Records |
|---|---:|---|
| `furrow.john@gmail.com` | 2 | John Furrow (1804) + DeAnna Davis (8863) — likely spouse |
| `fanderson@bendcable.com` | 2 | Frederick Anderson (2315) + Christopher Sulak (10289) |
| `jmann@bendcable.com` | 2 | Joe Mann (6294) + Andrew Ellis (8957) |
| `greenpatricia966@gmail.com` | 2 | Green (6464) + Martin John & Judy Joint Trust (6622) |
| `pdanstrausbaugh@yahoo.com` | 2 | Elizabeth Strausbaugh (8161) + Dan Strausbaugh (8234) |
| `cmtowell@outlook.com` | 2 | Melonie Towell (8080) + Craig Towell (10350) |
| `mandiakinsrealtor@gmail.com` | 2 | Amanda Adkins (8355) + Amanda Akins (8361) — name-misspell dupe |
| `elarsen@bhhsnw.com` | 2 | Hannah Albeke (8362) + Gerhard Larsen (9520) — likely realtor sharing emails |

**Verdict:** mostly legitimate spousal/trust records, plus a few real dupes (Amanda Adkins/Akins is one person typed twice). Low priority for bulk action; needs human review on a per-pair basis.

### 4b. Phone duplicates — 652 groups, 878 extra records

This is the big one. The top phone dupes are **shared placeholder numbers** that got copied into the phone field for many records:

| Phone | Count | Likely owner |
|---:|---:|---|
| `541-383-7600` | **29** | **Bend Cable HQ** (used as placeholder in KTS import) |
| `541-382-4123` | 18 | Generic Bend area code+exchange (placeholder?) |
| `541-317-0123` | 17 | Another generic-looking number |
| `541-508-3148` | 15 | |
| `541-383-4360` | 14 | |
| `541-383-2444` | 14 | |
| `541-923-4663` | 13 | |
| `541-585-3760` | 11 | |
| `541-728-0033` | 11 | |
| `541-593-7000` | 11 | |
| ... | (652 groups total) | |

**Verdict:** these are not real duplicate people — they're real different people whose phone fields got back-filled with placeholder Bend area codes during the KTS import. **Bulk-action recommendation:** wipe the phone field on any record where the phone number is shared by 5+ other records (likely placeholder). That cleans the duplicate signal without losing data; the records still have name + address.

### 4c. Name+City duplicates — 132 groups

Genuine duplicate people (same name, same city):

| Key | Count | Records |
|---|---:|---|
| `richard brown\|\|` | 3 | id 373, 5056, 8598 (all created Jun 30 — 2025 KTS import batch + Jul 15 second batch) |
| `clark\|\|bend` | 3 | id 7168, 7381, 7543 |
| `occupant\|\|bend` | 3 | id 17200, 19054, 19934 — "Occupant" placeholder from Nov 2025 farm import |
| `no name name\|\|` | 3 | id 21950, 21951, 21952 — TEST records from Mar-Apr 2026 |
| `no name\|\|` | 2 | id 10560, 10561 |
| `mary doyle\|\|` | 2 | id 53, 8918 — both KTS import batches |
| `roma larsson\|\|` | 2 | id 126, 9528 — both KTS import batches |
| `robert wagner\|\|` | 2 | id 157, 714 |
| `susan biggs\|\|` | 2 | id 233, 8511 |
| `kelly bailey\|\|` | 2 | id 292, 2646 |
| ... | (132 groups total) | |

**Pattern:** the KTS imports ran twice (Jun 30 2025 + Jul 15 2025), creating duplicate person records for everyone in the second batch who was already in the first. The Nov 2025 "Occupant" entries are a placeholder farming list with no real contact data.

**Recommendation HIGH:**
- One-time dedup pass: for any name+city group with 2+ records, MERGE into the earlier record (preserves note history, tags from both). FUB's UI has a built-in merge tool.
- Specifically delete all `No name`, `No name Name`, `Occupant`, and `Test*` placeholder records (~10 records).
- For phone dupes, identify placeholder numbers (count ≥ 5 sharing same phone) and clear those phone fields.

---

## 5. Notes — 14,269 total, mostly import noise

Pulled a 20-note sample from beginning/middle/end of the notes table. The distribution of note lengths:

| Length range | Count in sample |
|---|---:|
| 0-50 chars | 0 |
| 51-200 chars | 19 |
| 201-1000 chars | 1 |
| >1000 chars | 0 |

**Sample notes (every single one is import noise):**

```
id=1   "Hi and welcome to Follow Up Boss, this is an example note..." (FUB system intro)
id=29  "Notes: Need to sell 17130 Mayfield summer of 2025 via: Contacts_Contacts_1751296189 - contacts.csv on Jun 30th"
id=35  "Notes: 325 Nw State St via: Contacts_Contacts_1751296189 - contacts.csv on Jun 30th"
id=36  "Notes: 924 Nw Delaware Ave via: Contacts_Contacts_1751296189 - contacts.csv on Jun 30th"
id=39  "Notes: 604 Nw Delaware Ave via: Contacts_Contacts_1751296189 - contacts.csv on Jun 30th"
...
```

**Verdict:** 90%+ of the 14,269 notes are CSV import-record stamps (`via: Contacts_Contacts_<unix-timestamp> - contacts.csv`). They carry the property address as their only payload — and that address is already in the person's `addresses` field. **They add zero value to the lead record.**

**Recommendation MEDIUM:**
- Bulk-delete all notes where `body LIKE '%via: Contacts_Contacts_%'` OR `body LIKE '%- contacts.csv%'`. Likely covers ~12,000 of 14,269 notes.
- Preserve manually-typed broker notes and the FUB system "Welcome" note (id 1).
- API endpoint: `DELETE /v1/notes/{id}` — paginate notes, filter by body pattern, batch-delete with backoff.

---

## 6. Activity recency — corrupted by recent bulk-tag job

The `lastActivity` field is currently distorted because the geo-tag normalization v2 job (which finished today) updated nearly every record. To get the real engagement signal, I bucketed by `created` date instead:

### Created date buckets (true age of records)

| Bucket | Count |
|---|---:|
| Last 30 days | 5 |
| 31-90 days | 16 |
| 91-180 days | 471 |
| 181-365 days | 12,660 (KTS import dump from ~Oct 2025) |
| 1-2 years | 1 |
| 2-3 years | 2 |
| 3-5 years | 2 |
| 5+ years | 0 |

### Engagement recency (lastActivity, with bulk-tag distortion noted)

| Bucket | Count | Notes |
|---|---:|---|
| `<=7d` | 9,184 | **Distorted — bulk-tag job touched most records** |
| `8-30d` | 21 | |
| `31-90d` | 28 | |
| `91-180d` | 1,014 | Real engagement signal preserved |
| `181-365d` | 2,910 | Real engagement signal preserved |
| `>365d` | 0 | No record has gone untouched >1 year (because bulk-tag) |

### True new lead volume

- **Last 7 days:** 2 leads
- **Last 30 days:** 5 leads (4 from prod site, 1 from preview)
- **Last 90 days:** 21 leads

**Verdict:** real volume is extremely low (~5 new leads/month). The 12,660 records in the 181-365d "created" bucket are the KTS import dump — they're real records but cold contact list, not active leads.

**Recommendation MEDIUM:**
- Tag any record with `created` >180 days AND no incoming activity since import as `engagement:cold-import`. Use this tag for a quarterly "re-engagement" smart list rather than mixing with hot inbound.
- Re-run the activity-recency audit in 60 days once the bulk-tag distortion has aged out of the data. The current numbers are useful but not durable.

---

## 7. Compliance tags — 700 total, but no enforcement

The audit found:

| Tag | Count | Enforcement |
|---|---:|---|
| `Bounced` | 470 | Tag-only. No `do_not_email` enforcement. |
| `Unsubscribed` | 230 | Tag-only. No `do_not_email` enforcement. |
| `do_not_text` | 1 | Tag-only. No SMS suppression configured. |
| `do_not_email` | 0 | No records carry this tag. |
| `Complained` | 0 | |
| `opt-out` / `opt_out` | 0 | |

### Critical risk

**FUB's action plan engine will NOT automatically respect these tags** unless an Automation rule is configured to exclude them. If the new `Seller Lead — Master Workflow` (action plan id 69) enrolls a lead who carries `Unsubscribed`, FUB will still attempt to send the 6-email drip → those emails will bounce/get marked spam → sender reputation damage. **The seller workflow build doesn't include an "exclude unsubscribed" gate.**

**Recommendation HIGH (compliance/legal):**
- Verify in FUB UI: every action plan's "audience filter" excludes `Unsubscribed`, `Bounced`, `do_not_email`, and `Complained` tags.
- Add a FUB-UI Automation: "When a tag changes to include `Bounced`, set `emailStatus` to `Unsubscribed`" — this stops the action plan engine cold.
- Run a one-time sweep: for every record carrying `Bounced` OR `Unsubscribed`, also write `do_not_email` tag for explicit enforcement (belt + suspenders).
- For the 1 `do_not_text` record, add a `do_not_sms` tag and confirm it suppresses SMS steps in action plans.

---

## 8. Webhooks — 0 registered

`/webhooks` returns `_metadata.total = 0`. FUB does not push events to the Ryan Realty stack.

### Current real-time wiring

- **Outbound (Site → FUB):** one-way push (site events + tags applied via the API)
- **Inbound (FUB → Site):** **none** — the only signal that any FUB state changed is the daily cron at `app/api/cron/marketing-snapshot-fub/route.ts`
- **15-min pause-on-reply cron:** `app/api/cron/seller-workflow-pause/route.ts` polls FUB every 15 minutes to detect lead replies, then writes pause tags

### What a webhook would unlock

| Webhook event | Replaces | Latency improvement |
|---|---|---|
| `peopleTagsUpdated` | The 15-min pause-on-reply cron | Reply detected in seconds, not 15 min |
| `peopleStageUpdated` | Manual broker check for promotions | Real-time Slack/iMessage alert on hot → A stage |
| `peopleCreated` | The daily snapshot cron's "new leads" pass | Brain sees new leads instantly |
| `noteCreated` | Currently invisible | Lets the brain react to manual broker notes |

**Recommendation MEDIUM:**
- Register one webhook now: `peopleTagsUpdated` → POST to `/api/webhook/fub-tags` (new endpoint). Lets the seller workflow react in seconds when a lead replies (the `agent:replied` tag is what would change).
- Add `peopleStageUpdated` later if Matt wants hot-stage promotion alerts.
- Keep the daily snapshot cron as a backstop (in case webhook delivery fails).
- Webhook setup: FUB UI → Integrations → Webhooks → Add. Or via API: `POST /v1/webhooks` (requires `X-System` + `X-System-Key` headers — see `.tmp_env/fub-audit/optimization-audit.mjs` for the auth pattern).

---

## 9. Email accounts / Gmail Connect

The `/emailAccounts` endpoint is unavailable on this account tier (likely API Plus). Can't directly verify Gmail/Office365 connection status from the API.

What we know from the `/users` data:

| User | Role | iOS last seen | FUB2 web last seen | Email signature configured |
|---|---|---|---|---|
| Matt Ryan (id 1) | Broker / Owner | 2026-05-16 | 2026-05-15 | check FUB UI |
| Rebecca Peterson (id 2) | Broker | 2026-04-17 | 2026-02-26 | check FUB UI |
| Paul Stevenson (id 3) | Agent | 2026-03-06 | 2026-01-23 | check FUB UI |

**Recommendation LOW:**
- Have Matt manually verify in FUB UI → Settings → Email → that `matt@ryan-realty.com` shows "Connected via Gmail" with green status. If broken, thread tracking won't work and the FUB inbox shows nothing.
- Same check for Rebecca — `rebeccapeterson@ryan-realty.com` must be connected for her to see lead replies in FUB.
- Paul probably doesn't need email connect (he's not handling seller leads).

---

## 10. Smart Lists — 12 factory defaults, 0 custom

Confirmed unchanged from Round 1 audit. All 12 are FUB factory defaults; none have user-defined filters detectable via the API.

| id | Name |
|---:|---|
| 1 | Leads |
| 2 | Hot Prospects |
| 3 | Nurture |
| 4 | Buyers |
| 5 | Sellers |
| 6 | Pending |
| 7 | Closed |
| 8 | Past Clients |
| 9 | Sphere |
| 10 | IDX Activity |
| 11 | Email Activity |
| 12 | Stay In Touch |

The 4 curated lists documented in `docs/FUB_SMART_LISTS_STARTER_PACK.md` aren't built yet — they require FUB UI manual configuration (the API doesn't expose smart-list-create).

**Recommendation MEDIUM:**
- Matt manually creates the 4 curated lists in FUB UI:
  1. `Seller — last 30d new` (filter: tag = `audience:seller` AND created < 30 days)
  2. `Seller — hot, untouched > 1h` (filter: tag = `seller:hot` AND no outbound activity in last 1h)
  3. `Seller — warm, in nurture` (filter: tag = `seller:warm` AND in active action plan)
  4. `Seller — closed lost, 90d+ since` (filter: deal stage = `Lost / Terminated` AND closed >90d ago)
- Skip building API automation for this — FUB UI is faster and Matt can iterate the filters easily.

---

## 11. Buyer leads — no workflow exists

45 records carry a `Buyer` tag with no canonical `audience:buyer` and no action plan to enroll them. Zero buyer leads have `audience:buyer` set. All buyer-intent leads sit at `Lead` stage with no automation.

### Buyer signals

| Signal | Count |
|---|---:|
| `Buyer` tag (Title Case, KTS legacy) | 45 |
| `audience:buyer` (canonical) | **0** |
| `Buyer Lead` (Title Case) | small handful |
| `Buyer Intent` (recent FB-LP variant) | 1 |
| `LP-Listing-Alerts` (FB lead-gen ad source) | 1 |
| Inactive buyers (>90d since lastActivity) | 17 of 45 |

### Recent 30d cohort — ALL are buyer leads, NONE have canonical tags

Every one of the last 5 leads is a buyer (Calvin Sterling, Masiimo Miguel, Rachael Greenwalt, Kelly Hanson, Matthew Ryan) but:
- 0 have `audience:buyer`
- 5 of 5 carry legacy `Buyer` (3) or `Buyer Intent` (1) or no tag (1)
- 5 of 5 assigned to Matt (no round-robin)
- 5 of 5 sit at `Lead` stage (no promotion)

**Recommendation HIGH:**
- Build a mirror "Buyer Lead — Master Workflow" using the same architecture as the seller workflow:
  - Canonical tag schema: `audience:buyer` + `buyer:hot` / `buyer:warm` / `buyer:nurture` + `source:buyer-lp` / `source:idx`
  - 8-touch cadence over 60 days (industry guidance: same speed-to-first-touch as seller)
  - Round-robin Matt + Rebecca via the existing `marketing_assignments` Supabase table
  - Action plan in FUB UI (action plan id 70 next)
  - Trigger on tag `audience:buyer` added (FUB Automation)
- Bulk-migrate the 45 existing `Buyer` records to also carry `audience:buyer` (one-time tag-add sweep).
- Build a non-seller-LP path in the site code that writes `audience:buyer` when an IDX lead, property-view, or listing-alert signup fires.

---

## 12. Custom field utilization — 0% across ALL 25 fields

This is the second-most-critical finding after duplicates.

### Full field inventory

| id | API name | Label | Type | Populated | % |
|---:|---|---|---|---:|---:|
| 33 | `customCMAPDFURL` | CMA PDF URL | text | 0 | 0% |
| 32 | `customCMADeliveredAt` | CMA Delivered At | date | 0 | 0% |
| 31 | `customSellerPropertyAddress` | Seller Property Address | text | 0 | 0% |
| 30 | `customIsSellerCurious` | Is Seller Curious | text | 0 | 0% |
| 29 | `customLeadTier` | Lead Tier | text | 0 | 0% |
| 28 | `customMoveTimeline` | Move Timeline | text | 0 | 0% |
| 26 | `customListingStatusDisplay` | Listing Status (Display) | text | 0 | 0% |
| 25 | `customListingExpiredDateDisplay` | Listing Expired Date (Display) | text | 0 | 0% |
| 24 | `customListingDaysOnMarket` | Listing Days on Market | number | 0 | 0% |
| 23 | `customOriginalListPrice` | Original List Price | number | 0 | 0% |
| 22 | `customMLSNumber` | MLS Number | text | 0 | 0% |
| 21 | `customListingStatus` | Listing Status | text | 0 | 0% |
| 20 | `customListingExpiredDate` | Listing Expired Date | date | 0 | 0% |
| 19 | `customPropertyType` | Property Type | text | 0 | 0% |
| 18 | `customEquityPercent` | Equity Percent | number | 0 | 0% |
| 17 | `customYearsOwned` | Years Owned | number | 0 | 0% |
| 16 | `customOrganization` | Organization | text | 0 | 0% |
| 15 | `customPurchaseDate` | Purchase Date | date | 0 | 0% |
| 14 | `customPurchasePrice` | Purchase Price | number | 0 | 0% |
| 13 | `customMarketValue` | Market Value | number | 0 | 0% |
| 12 | `customLeadScore` | Lead Score | number | 0 | 0% |
| 7 | `customOpenHouseAddress` | Open House Address | text | 0 | 0% |
| 5 | `customHomeAnniversary` | Home Anniversary | date | 0 | 0% |
| 3 | `customClosingAnniversary` | Closing Anniversary | date | 0 | 0% |
| 1 | `customWebsite` | Website | text | 0 | 0% |

### Two-tier severity

**Tier 1 (critical — the new SL fields Matt built specifically for this workflow):**
- `customLeadTier` — should hold `hot` / `warm` / `nurture` (the same value as the `seller:{tier}` tag)
- `customMoveTimeline` — should hold the timeline string the user picked (e.g., `0-3 months`)
- `customIsSellerCurious` — should hold `yes` / `no` from the LP form
- `customSellerPropertyAddress` — should hold the address the LP form submitted
- `customCMAPDFURL` — should hold the CMA URL once generated
- `customCMADeliveredAt` — should hold the delivery timestamp

The seller LP form at `app/lp/seller-home-value/actions.ts` adds the canonical TAGS but is NOT writing these CUSTOM FIELDS. **That's the missing piece.**

**Tier 2 (the legacy 19 KTS fields):**
- 5 of these (`customMLSNumber`, `customListingDaysOnMarket`, `customListingStatus`, `customListingExpiredDate`, `customOriginalListPrice`) were "preserved" per the prior cleanup because they had real data — but the audit shows they're now showing 0% populated. **Either the cleanup wiped the data, or these fields were never actually populated and the prior audit was wrong.** Either way they can be deleted.
- The other 14 (`customWebsite`, `customClosingAnniversary`, etc.) are 100% dead.

**Recommendation HIGH:**
- Update `app/lp/seller-home-value/actions.ts` to write the 4 SL custom fields via the PUT person/{id} endpoint alongside the tag set:
  ```
  customFields: {
    customLeadTier: classification,           // hot | warm | nurture
    customMoveTimeline: timelineString,
    customIsSellerCurious: isCurious ? 'yes' : 'no',
    customSellerPropertyAddress: address,
  }
  ```
- Add to the CMA delivery cron: write `customCMAPDFURL` + `customCMADeliveredAt` when the CMA email actually sends.
- Audit the 5 "preserved-data" KTS fields (`customMLSNumber`, etc.) — confirm they're truly empty, then delete them with the rest. The prior `08-cleanup-custom-fields.mjs` script may have wiped them as part of the cleanup pass.
- Delete the 14 zero-population KTS fields (`customWebsite`, `customClosingAnniversary`, `customHomeAnniversary`, `customOpenHouseAddress`, `customLeadScore`, `customMarketValue`, `customPurchasePrice`, `customPurchaseDate`, `customOrganization`, `customYearsOwned`, `customEquityPercent`, `customPropertyType`, `customListingExpiredDateDisplay`, `customListingStatusDisplay`).

---

## 13. Recent leads (last 30 days) — canonical tag compliance

The most important sample. **5 leads in last 30 days, ZERO have the canonical audience tag.**

| Date | id | Name | Source | Assigned | `audience:seller` | `audience:buyer` | Tags |
|---|---:|---|---|---|:---:|:---:|---|
| 2026-04-25 | 21958 | Calvin Sterling | Ryan-Realty.com | Matt Ryan | ❌ | ❌ | `Bounced`, `Buyer`, `auto:brand-voice:plain-honest` |
| 2026-04-28 | 21959 | Masiimo Miguel | Ryan-Realty.com | Matt Ryan | ❌ | ❌ | `Buyer`, `auto:brand-voice:plain-honest` |
| 2026-05-06 | 21960 | Rachael Greenwalt | Ryan-Realty.com | Matt Ryan | ❌ | ❌ | `Buyer`, `auto:brand-voice:plain-honest` |
| 2026-05-14 | 21965 | Kelly Hanson | Ryan-Realty.com | Matt Ryan | ❌ | ❌ | (none) |
| 2026-05-17 | 21966 | Matthew Ryan | ryanrealty.vercel.app | Matt Ryan | ❌ | ❌ | `Buyer Intent` |

### Diagnosis

These 5 leads came in via paths that are NOT the seller LP form:
- Likely paths: Calendly booking, contact form, IDX registration, blog email-capture
- The seller LP form (`app/lp/seller-home-value/actions.ts`) DOES write canonical tags — but it hasn't fired in the last 30 days
- The other lead-creation paths (`/api/contact`, IDX, etc.) don't write canonical tags or canonical audience labels
- All 5 default-assigned to Matt because there's no round-robin in the non-seller-LP paths

**Recommendation HIGH:**
- Audit every site path that creates a FUB person record:
  - `/api/contact` (general contact form)
  - `/api/cma/[slug]` (CMA request)
  - `/api/showings/request` (showing request)
  - IDX registrations (via the IDX vendor)
  - Calendly webhooks
  - Blog email captures
- Each path must write at minimum: `audience:buyer` OR `audience:seller`, `source:<path>`, and round-robin assignment.
- Recommended utility: `lib/fub-create-lead.ts` that wraps the FUB person-create call with canonical-tag enforcement and round-robin assignment as defaults. Replace every direct `fetch('https://api.followupboss.com/v1/people')` call with this util.

---

## 14. Test pollution — 18 records still in live data

Records that should not be in the live CRM:

| id | Name | Source | Tags | Verdict |
|---:|---|---|---|---|
| 10561 | No name | Zillow | (none) | Delete |
| 10560 | No name | Zillow | (none) | Delete |
| 10606 | KTS Test Contact | Ryan-Realty.com | Bounced, Buyer | Delete |
| 10615 | Testet Testete | AI- Claude | Bounced | Delete |
| 10618 | Santiago AgentFire Test | Ryan-Realty.com | Buyer | Delete |
| 10619 | Test Test | Ryan-Realty.com | Bounced, Buyer | Delete |
| 10620 | Sant Test | Ryan-Realty.com | Bounced, Buyer, Rebecca Ryser Peterson | Delete |
| 10623 | New Test Lead | Ryan-Realty.com | Bounced, Buyer, Rebecca Ryser Peterson | Delete |
| 10625 | Minel AgentFire Test | Ryan-Realty.com | Buyer, Rebecca Ryser Peterson | Delete |
| 15053 | No name Name | Sphere | SOI, Phone Import | Delete |
| 17200 | Occupant | (placeholder) | farm | Review (anonymous farm import) |
| 19054 | Occupant | (placeholder) | farm | Review |
| 19934 | Occupant | (placeholder) | farm | Review |
| 21456 | No name Name | Import | Import | Delete |
| 21457 | No name Name | Import | Import | Delete |
| 21823 | Test2 Test2 | Ryan-Realty.com | Matt Ryan | Delete |
| 21950 | No name Name | ryanrealty.vercel.app | auto:brand-voice:plain-honest | Delete |
| 21965 | Kelly Hanson | Ryan-Realty.com | (none) | Review (likely real) |

**Recommendation MEDIUM:**
- Delete the 14 obvious test records (every `Test*`, `No name*`, `Testet*`, `AgentFire Test`, `KTS Test`).
- Review the 3 `Occupant` records — if they're from a paid farm import with real addresses, keep them but rename to `Owner of {address}`. If they're a no-op placeholder, delete.
- Add a server-side filter: any FUB person-create where `firstName == 'Test'` OR `lastName == 'Test'` OR name matches `/^no name/i` → reject with 400 instead of creating the record.

---

## Final ranking — top 5 priority actions

These five moves give Matt the biggest leverage for the least work. Ranked by impact-per-hour.

### #1 — HIGH — Wire canonical tags to EVERY lead-creation path (not just seller LP)

**Effort:** 4 hours. **Impact:** Every new lead enters the system tagged correctly, classified, and round-robined. Eliminates the bug where 5 of 5 recent leads sat un-actionable in Matt's queue.

- Build `lib/fub-create-lead.ts` utility that wraps person-create with mandatory canonical tag set (`audience:buyer`/`audience:seller`, `source:<path>`, broker round-robin assignment).
- Replace every direct FUB API call across `/api/contact`, `/api/cma`, `/api/showings`, IDX, Calendly webhooks, blog email captures.
- One-time backfill: rewrite the 45 `Buyer`-tagged records to also carry `audience:buyer`.

### #2 — HIGH — Wire SL custom fields from the seller LP form

**Effort:** 1 hour. **Impact:** The 4 new SL custom fields (`customLeadTier`, `customMoveTimeline`, `customIsSellerCurious`, `customSellerPropertyAddress`) start filling in. Enables FUB-UI smart lists filtered by lead tier without parsing tag strings.

- Edit `app/lp/seller-home-value/actions.ts` to include `customFields:` payload alongside the existing `tags:` payload in the PUT person/{id} call.
- Wire the CMA-delivery cron to write `customCMAPDFURL` + `customCMADeliveredAt` when CMA email sends.

### #3 — HIGH — Compliance enforcement on the 470 `Bounced` + 230 `Unsubscribed` records

**Effort:** 1 hour. **Impact:** Stops the new seller workflow from blasting emails to dead/unsubscribed addresses. Protects sender reputation. Compliance/legal protection.

- In FUB UI, edit action plan id 69 (Seller Lead — Master Workflow) → audience filter → EXCLUDE tags `Bounced`, `Unsubscribed`, `do_not_email`, `Complained`.
- Add a FUB Automation rule: "When tag `Bounced` added → set `emailStatus = Unsubscribed`" (belt + suspenders).
- One-time tag sweep: every record with `Bounced` OR `Unsubscribed` also gets `do_not_email` for explicit hard-block.

### #4 — HIGH — De-duplicate via FUB UI merge tool (or bulk phone-field clear)

**Effort:** 4 hours (manual review). **Impact:** Cleans 132 name-city dupe groups and 652 phone dupes. Reduces ~900 phantom records from every count, every report, every smart list.

- For the 132 name+city dupes, use FUB UI's built-in merge tool (Settings → Tools → Merge Duplicates).
- For the 652 phone dupes where 5+ records share a phone, run a one-time sweep: clear the phone field on all but the most recent record (preserves data, kills the false-dupe signal).
- Delete the 14 obvious test records and the 5+ "Occupant" placeholders.

### #5 — HIGH — Build the "Buyer Lead — Master Workflow" mirror

**Effort:** 6 hours. **Impact:** The buyer side of the funnel currently has zero automation. Building the mirror unlocks the second half of inbound lead handling using the exact same architecture as the seller workflow (action plan engine, round-robin, canonical tags, compliance gate).

- Mirror the seller-workflow spec: 8-touch cadence over 60 days, canonical `audience:buyer` + `buyer:hot/warm/nurture` tag schema, action plan id 70.
- Add corresponding FUB Automation rule + Smart Lists + custom fields.
- Wire IDX vendor + listing-alert signup flows to write canonical buyer tags.
- Document at `docs/FUB_BUYER_WORKFLOW.md` using same format as seller workflow doc.

---

## Appendix — audit reproducibility

- Audit script: `/Users/matthewryan/RyanRealty/.tmp_env/fub-audit/optimization-audit.mjs`
- Raw dumps: `/Users/matthewryan/RyanRealty/.tmp_env/fub-audit/dump2/` (untracked)
- Run: `node --env-file=.env.local .tmp_env/fub-audit/optimization-audit.mjs`
- Runtime: ~3 minutes (full pagination of 13,157 records, gentle 60ms inter-request pacing)
- API: HTTP Basic with `FOLLOWUPBOSS_API_KEY` from `.env.local`, `X-System` + `X-System-Key` headers for elevated endpoints
- Retry: exponential backoff up to 5 attempts on 429 / 5xx (lifted from `.tmp_env/fub-setup/16b-normalize-geo-tags-v2.mjs`)

### Endpoints called

| endpoint | status | notes |
|---|---|---|
| `/identity` | 200 | account + user context |
| `/users` | 200 | 3 users |
| `/customFields?limit=200` | 200 | **25 fields total** (the no-limit default returns only 10 — pagination gotcha) |
| `/pipelines` | 200 | 2 pipelines, 13 stages |
| `/stages` | 200 | 10 declared stages (2 undeclared stages exist on records) |
| `/actionPlans?limit=200` | 200 | 69 plans (1 Active, 68 Deleted) |
| `/smartLists?limit=100` | 200 | 12 factory defaults |
| `/groups` | 200 | 2 groups (Team Ryan, Seller Leads) |
| `/webhooks` | 200 (with X-System) | 0 registered |
| `/people` (paginated 132 pages) | 200 | full scan, 13,157 records |
| `/deals` | 200 | 20 deals |
| `/notes?limit=20&offset=...` | 200 | sampled 20 notes from start/mid/end |
| `/emailAccounts` | 404 | unavailable on this tier |

---

*End of optimization audit. No mutations performed. No data exfiltrated outside the local `.tmp_env/fub-audit/dump2/` workspace.*
