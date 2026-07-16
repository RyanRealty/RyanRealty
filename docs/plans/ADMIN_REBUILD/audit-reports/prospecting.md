# Prospecting Surfaces Audit — Expireds, FSBOs, Expired Outreach

Auditor domain: `app/admin/(protected)/expireds`, `expired-listings` (+ `[key]`), `expired-outreach`, `fsbos`; `components/admin/expired/**`, `components/admin/fsbo/**`; `lib/data/expired/**`, `lib/data/fsbo/**`; detection crons (`detect-expired-listings`, `detect-fsbo-listings`, `sync-delta` hook, `crm-auto-enroll`); processors (`lib/expired-listing-processor.ts`, `lib/fsbo-processor.ts`, `lib/expired-owner-lookup.ts`, `lib/owner-resolution.mjs`, `lib/fsbo-detector.ts`); send actions (`app/actions/expired-outreach.ts`, `expired-dashboard.ts`, `fsbo-dashboard.ts`, `send-doc.ts`); tables `expired_listings` (~144 rows), `fsbo_listings`, `cmas` (~155 rows).

Every claim below was verified by reading the implementation. Line numbers refer to the working tree at commit `d3dd457a`.

---

## 1. Route map and overlap (the four routes)

| Route | What it actually is | Status |
|---|---|---|
| `/admin/expireds` | Consolidated Expireds Dashboard: one table with skip-trace state, audit build, compose-and-send (email/SMS via shared `SendDocDialog`), engagement trail. `app/admin/(protected)/expireds/page.tsx` | Live, in nav (`app/components/admin/admin-nav.ts:81`) |
| `/admin/expired-listings` | Index retired 2026-07-15 — pure `redirect('/admin/expireds')` (`expired-listings/page.tsx:12-14`) | Redirect stub |
| `/admin/expired-listings/[key]` | Per-listing review detail: price history (BPO cycles), full MLS listing card, owner + skip-trace contact, jump links to CMA/CRM. Linked from every property name on `/admin/expireds` (`expireds/page.tsx:77`) and the outreach queue "Listing" button (`expired-outreach/page.tsx:145`) | Live, but **superuser-only** (see Defect 1) |
| `/admin/expired-outreach` | The one-tap intro-SMS queue: Ready-to-send / Needs-audit / Sent / Excluded sections, guarded single-template send | Live, in nav (`admin-nav.ts:82`) |
| `/admin/fsbos` | FSBO Dashboard — a structural clone of `/admin/expireds` for `fsbo_listings` rows | Live, in nav (`admin-nav.ts:83`) |

**The overlap:** `/admin/expireds` and `/admin/expired-outreach` are two different frontends onto the SAME `expired_listings` rows with two DIFFERENT send pipelines to the same owner:

- `/admin/expired-outreach` → `sendExpiredIntroAction` (`app/actions/expired-outreach.ts:45`) — one fixed template (`expired-first-touch-sell-v1`), enforced one-intro-per-owner-ever (`:66-68`), auto-appends `?_pid=` + UTM to the CMA link (`:119`).
- `/admin/expireds` → `SendDocDialog` → `sendDocSmsAction` (`app/actions/send-doc.ts:240`) — free-typed or any active template, **no already-sent guard** (deliberate: "repeat composed sends keep the original stamp", `:287-288`), and the CMA link is NOT auto-inserted into the SMS — the dialog tells the broker to paste it by hand (`SendDocDialog.client.tsx:224-226`).

So the exact same job ("text this expired owner their report") exists twice with divergent guard sets, divergent templates, and divergent link handling. Neither page tells the broker the other path exists beyond a header button.

The FSBO analog only has the dialog path (`/admin/fsbos` → `SendDocDialog`); its purpose-built one-tap SMS action `sendFsboIntroSmsAction` exists in code but is wired to nothing (Defect 12).

---

## 2. End-to-end trace: detection → table → dashboard → approve → send → CRM person → follow-up

### 2a. Expired detection
- **Canonical trigger:** `/api/cron/sync-delta` (vercel.json `3,18,33,48 * * * *`, `maxDuration=300`) calls `processNewExpiredListings(supabase, { maxPerRun: 10, lookbackHours: 2 })` at the end of every MLS delta run, soft-fail (`app/api/cron/sync-delta/route.ts:533-548`).
- **Manual trigger:** `/api/cron/detect-expired-listings` — NOT on a Vercel schedule (removed 2026-05-22 per header comment `route.ts:5-10`); callable with `CRON_SECRET` for backfills. Shares the same lib. Not duplicative — correct shared-lib pattern.
- **Pipeline** (`lib/expired-listing-processor.ts:227-499`): select newly Expired/Canceled/Withdrawn SFR in the 6 service cities > $500K within lookback (`selectNewExpiredListings` via lib/data), dedupe on `expired_listings.listing_key` (`:213-216`) → owner lookup chain → `ensureNativeLead` (only when a real phone/email was found — "no placeholder leads", `:264-294`) → `enrichNativeLead` with tags incl. `intent:expired-listing`, `owner-lookup:resolved`, compliance tags, demographics custom fields (`:333-360`) → 60-min Call task (`:364-371`) → **auto-enroll deliberately PAUSED** (Matt directive 2026-07-11, `:373-383` — `void autoEnrollPerson` retained as the documented restore path) → auto-CMA queued via `createCmaRequest` with `notifyLead:false` (`:388-412`) → Resend alert email to Matt (`:415-439`) → `upsertExpiredListingRow` audit row (`:442-481`).
- **Idempotency gap:** dedupe keys are read BEFORE processing and the audit row is upserted at the END of each listing's block. A crash after the alert/CRM writes but before the upsert re-processes the listing next run (duplicate skip-trace spend, duplicate task, duplicate alert). No lease (unlike `crm-auto-enroll` which takes `crm_try_cron_lease`). Low probability, real.

### 2b. Owner lookup + compliance flags
`lib/expired-owner-lookup.ts:471-578` runs, in order:
1. Deschutes County assessor + BatchData skip-trace (`lib/owner-resolution.mjs resolveOwnerContact`). BatchData yields `litigator`, `dnc.tcpa`, `deceased`; `hardStop = litigator || dncTcpa || deceased` (`owner-resolution.mjs:129-175`). Compliance tags: `compliance:hard-stop` + `contact:do-not-call` + `contact:do-not-text` when hardStop; `contact:do-not-call` when any phone is DNC (`:201-203`). Notes string includes `"HARD STOP flags present (litigator/TCPA/deceased)."` when hardStop (`expired-owner-lookup.ts:460`).
2. Tracerfy skip-trace fallback (`tracerfySkipTrace`, `:219-326`), then Apify skip-trace fallback with a separate DNC scrub (`:363-446`). **This path returns NO `complianceTags`** (result at `:546-555` omits the field), and its notes flags are `LITIGATOR FLAG` / `DECEASED` / `BEST PHONE ON DNC` strings only.
3. FUB address-match legacy fallback (dead FUB creds in production, still attempted).

### 2c. Dashboard reads
- `/admin/expireds` → `listExpiredDashboardRows` (`lib/data/expired/dashboard.ts:53-208`): 1 read of all `expired_listings` + chunked `cmas` by address slug + chunked `email_events` by `cma:<slug>` + chunked `crm_timeline` (`sms_click`,`email_out`) by person + a paged scan of up to 5,000 newest `visitor_events` client-document page views. All service-role, `force-dynamic`, zero caching.
- `/admin/fsbos` → `listFsboDashboardRows` (`lib/data/fsbo/dashboard.ts:45-186`): a 95% copy-paste of the above against `fsbo_listings`, including its own independent 5,000-row `visitor_events` scan.
- `/admin/expired-outreach` → `listExpiredOutreachQueue` (`lib/data/expired/outreach.ts:40-108`): all `expired_listings` + a live re-list check against `listings` (Active/Pending/Coming Soon matched by street number + name prefix + city + newer status timestamp, `:59-77`) + **the entire `cmas` table unbounded** (`:80`).
- `/admin/expired-listings/[key]` → `getExpiredListingDetail` (`outreach.ts:194-327`): the expired row + CMA slug check + per-address re-list check + full MLS listing row + full price-cycle history via `getBpoListingCyclesByAddress`.

### 2d. Approve + send
- **Email (both dashboards):** `SendDocDialog` → `prepareDocSendAction` (pre-merged templates + default report email) → `sendDocEmailAction` (`send-doc.ts:197-238`): hard-stop → relisted → gone → email-present → unresolved-merge-token refusal → needs_review acknowledgment gate → auto-finalize draft → `sendCmaToLead` (Gmail DWD tracked rail; suppression checked fail-closed inside — `lib/cma/send.ts:300-302`).
- **SMS (dialog):** `sendDocSmsAction` (`send-doc.ts:240-305`): hard-stop → relisted → gone → phone → quiet hours (`inSmsQuietHours`, 8am–9pm Pacific, `lib/crm/quiet-hours.ts`) → merge-token refusal → `ensureNativeLead` → `isSuppressed(personId,'sms')` fail-closed → short-link instrumentation (fail-open to untracked body, `:272-273`) → Twilio messaging service (A2P status pre-checked, `lib/crm/twilio.ts:316-329`) → `crm_timeline` `sms_out` insert → first-send stamp.
- **SMS (queue):** `sendExpiredIntroAction` (`expired-outreach.ts:45-155`): same guards PLUS built-doc requirement (`:54-56`) and already-sent (`:66-68`); template read live from `crm_templates`; `_pid` + UTM appended (`:119`); enriches the person with `customClassification: 'EXPIRED'` (`:90-96`).

### 2e. CRM person creation
`ensureNativeLead` (`lib/data/crm/ensureNativeLead.ts`) — email-first, then phone last-10-digits dedupe against `crm_contact_points`; create only with a usable key; never touches suppressions. Created/reused person id is stamped back onto `expired_listings.outreach_crm_person_id` / `fsbo_listings.outreach_crm_person_id` (`outreach.ts:370-387`, `send-doc.ts:288-298`, `fsbo-dashboard.ts:189-192`).

### 2f. Follow-up
After the intro send: **nothing automated.** Plan 71/72 auto-enroll is paused (processor `:373-383`); the auto-enroll cron explicitly skips outreach-list sources (below); the only scheduled artifact is the 60-min Call task created at DETECTION time (usually days before the send). Engagement (opens/clicks/taps/doc views) accumulates passively on the dashboards; a link tap logs `sms_click` via `/r/[code]` (`app/r/[code]/route.ts`, bot-filtered) but fires no alert, no task, no anything. Follow-up is entirely broker memory.

---

## 3. Compliance gates — verified in code

### TCPA / litigator hard-stop
- **Tag-level (authoritative, works):** `TAG_CHANNEL` in `lib/crm/suppressions.ts:18-29` maps `compliance:hard-stop` → all channels, `contact:do-not-text` → sms, `contact:do-not-call` → call+sms (2026-06-16 incident fix). `isSuppressed` fail-closes on ANY read error (`:37-45`). Every SMS send path in this domain calls it (`expired-outreach.ts:86-89`, `send-doc.ts:269-270`, `fsbo-dashboard.ts:150-151`); the email rail checks person- or email-keyed suppression inside `sendCmaToLead` (`lib/cma/send.ts:300-302`).
- **UI/action-level (fragile):** the row-level `hard_stop` boolean that hides Send buttons and short-circuits actions is a **regex over free text**: `/HARD STOP|LITIGATOR/i.test(enrichment_notes)` — duplicated in 5 places (`lib/data/expired/dashboard.ts:190`, `lib/data/expired/outreach.ts:98,321`, `lib/data/fsbo/dashboard.ts:171`, `app/actions/fsbo-dashboard.ts:90,131`, `app/actions/send-doc.ts:96`). It only matches when the notes writer happened to embed those strings. See Defect 3 for the path where it doesn't.
- **Quiet hours:** one shared implementation (`lib/crm/quiet-hours.ts`, 8am–9pm America/Los_Angeles) used by all three SMS actions. Verified pure and correct.

### The auto-enroll gate (the "NULL fub_created_at" question)
The memory/claim that "NULL `fub_created_at` gates auto-enroll" is **stale — the gate moved and the old comment survives**:
- `autoEnrollPerson` epoch check is `fub_created_at ?? created_at` (`lib/crm/enroll.ts:48-49`) — NULL fub_created_at does NOT block a native lead.
- The sweep cron now explicitly INCLUDES native rows: `.or('fub_created_at.gte.X, and(fub_created_at.is.null, created_at.gte.X)')` (`app/api/cron/crm-auto-enroll/route.ts:65-74`), added precisely because the bare `fub_created_at.gte` filter used to exclude them.
- The gate that actually prevents Plan 71/72 texting sequences from firing on skip-traced expired/FSBO owners is the **source taxonomy**: `classifyLeadSource(source).outreachList` short-circuits both `autoEnrollPerson` (`enroll.ts:57-60`) and the cron loop (`crm-auto-enroll/route.ts:138-142`). Verified: `expired-listing-cron`, `expired-outreach-queue`, `fsbo-cron`, `fsbo-outreach` all normalize to hits on `/\bexpired\b/` or `/\bfsbo\b/` → channel `prospecting` → `outreachList: true` (`lib/data/crm/leadSourceTaxonomy.ts:87-88,124-135`). Inbound `expired-lp`/`fsbo-lp` FORM submissions match the `web` rule first (`:76-82`) and still enroll — correct.
- **Stale comment hazard:** `lib/fsbo-processor.ts:19-23` still documents the OLD gate ("the auto-enroll sweep only scans people with fub_created_at set... If fub_created_at is ever backfilled... revisit") — that description is no longer how the system works, and an engineer trusting it would misjudge the actual protection.

### DNC nuance
`resolveOwnerContact` picks `bestPhone` only from non-DNC phones (`owner-resolution.mjs:204-206`) — good. The Tracerfy fallback path, however, falls back to a DNC phone when every phone is DNC (`expired-owner-lookup.ts:287-290` — `?? allPhonesRaw[0]`), stores it as `contact_phone`, and applies no tag (see Defect 3).

---

## 4. Per-page sections

### 4.1 `/admin/expireds` — Expireds Dashboard
**Purpose:** the consolidated worklist: every expired listing, skip-trace status, audit state, sends, engagement.
**Data path:** `page.tsx:32` → `listExpiredDashboardRows()` → 5 query groups (§2c). No pagination, no filters, no search, no sort controls — one flat table ordered by `expired_at desc`, all 144+ rows rendered.
**Mutations:** `ExpiredAuditActions.client.tsx` — `buildExpiredAuditAction` (builds `doc_type:'expired-audit'` CMA via `buildCma`, `expired-dashboard.ts:28-54`) and `SendDocDialog` (`send-doc.ts`).
**Defects here:**
- The join to the "audit" is by address slug (`slugifyAddress(street_address)`, `dashboard.ts:70`), not by a foreign key — see Defect 6 (slug collisions).
- `relisted` is hardcoded `false` for every row (`dashboard.ts:191`, comment: "per-row re-list checks are done at send time") — the dashboard happily shows Build/Send on a property that re-listed yesterday; the broker only learns at send-refusal time.
- `email_sent_at` falls back to ANY `email_out` timeline event for the person (`dashboard.ts:200`) — an unrelated CRM email shows as "email <date>" in the Contacted column.
- Build UX: click → `setMsg('Building audit (about a minute)...')` → single text label; no progress, no timeout messaging, result lost on navigation (`ExpiredAuditActions.client.tsx:27-32`). The build is a synchronous server action on a page segment with **no `maxDuration` export** (page exports only `dynamic`), while the equivalent queue worker gives itself `maxDuration = 300` (`app/api/cron/cma-build-worker/route.ts:18`) — a ~60s build against the platform default duration is a plausible production timeout.
- Doc-type trap: the auto-CMA the detection cron queues is built by `cma-build-worker` → `buildCma` with **no `docType`** (`lib/cma/worker.ts:68-85` — field absent) → `doc_type:'cma'` (`lib/cma/build.ts:283`). This dashboard requires `doc_type === 'expired-audit'` to offer Send (`page.tsx:72,96`, and the dead email action enforces it at `expired-dashboard.ts:74-76`), so every automated build lands as "plain CMA" and demands a full manual "Rebuild as audit". The automation produces an artifact the surface refuses to use.
**Verdict:** works, but the core automation loop (auto-CMA → send) is broken by the doc-type mismatch, and the table is desktop-only in practice.

### 4.2 `/admin/expired-listings` (index)
Redirect stub to `/admin/expireds` (`page.tsx:12-14`). Harmless — but it sits under a **superuser-only layout** (`layout.tsx:12-14`), so a `broker`-role admin who hits the old URL gets `/admin/access-denied` instead of the redirect. Should be dead-simple; is a role trap.

### 4.3 `/admin/expired-listings/[key]` — review detail
**Purpose:** pre-outreach review: price cycles, full MLS card, owner + compliance, links to CMA + CRM record.
**Data path:** `getExpiredListingDetail` (§2c) — 5 serial queries. Renders raw owner phone/email (page `:226-227`) and the hard-stop warning (`:231-235`).
**Defect (route-gate mismatch, Defect 1):** the segment layout requires `role === 'superuser'` (`layout.tsx:10-14`), but the links INTO it render for `canBrokers = superuser || broker` (`admin-nav.ts:36,81-83`; `expireds/page.tsx:77`; `expired-outreach/page.tsx:145`). A broker (Rebecca/Paul) clicking any property name in the Expireds table is bounced to access-denied. All sibling prospecting pages gate only on "any admin role except report_viewer" via their actions.
**UX:** the back button is hardwired "← Outreach queue" (`page.tsx:50-52`) even when arriving from `/admin/expireds` or `/admin/cmas`.
**Verdict:** genuinely useful surface, wrong gate, minor nav confusion.

### 4.4 `/admin/expired-outreach` — SMS queue
**Purpose:** the one-tap guarded intro-SMS queue.
**Data path:** `listExpiredOutreachQueue` (§2c). Classification into Ready/Needs-audit/Sent/Excluded/No-phone happens **in the page component** (`page.tsx:64-70`), despite the DAL docstring claiming "classified server-side" (`outreach.ts:39`) — cosmetic drift, one implementation.
**Mutations:** `ExpiredOutreachSendButton` → native `confirm()` (`ExpiredOutreachRow.client.tsx:26-29`) → `sendExpiredIntroAction`. Toast on success/error, `router.refresh()`. This is the best-behaved mutation in the domain.
**Defects here:**
- **Template preview duplication:** the row preview is a hardcoded copy of the template string (`page.tsx:41-46`), while the send merges the live `crm_templates` row — the code comment admits the duplication. If Matt edits the template in the DB, the queue keeps previewing the old wording, and the `confirm()` shows a message that is not what sends (the real body also differs by the short-link + `_pid` + UTM rewrite).
- **Double-send race:** already-sent is checked by a read (`expired-outreach.ts:66-68`) and stamped after Twilio returns (`:147`); `markExpiredOutreachSent` is an unconditional UPDATE (`outreach.ts:376-384`), so two devices/tabs clicking within the merge+Twilio window (~seconds) both send. No conditional `WHERE outreach_sms_sent_at IS NULL` claim.
- **Whole-queue recompute per send:** `getExpiredOutreachRow` = `listExpiredOutreachQueue().find(...)` (`outreach.ts:111-114`) — every single send re-reads all expired rows, the on-market `listings` probe, and the entire `cmas` table.
- **Needs-audit dead-endish:** the "Build audit" button is a generic link to `/admin/expireds` (`page.tsx:179-181`) — the broker must re-find the same property in the other table, build, wait ~60s, come back, re-find again. Two pages, two find-the-row operations, for one job.
- The `cmas` read is unbounded (`outreach.ts:80`) — silent 1,000-row PostgREST truncation once `cmas` grows past 1,000 (155 today); truncation would misclassify built rows into "Needs audit".
- No `doc_type` filter on the CMA join — a plain/stale CMA at the same address slug (e.g. built for a past seller-LP lead) counts as "built" and its link is what the intro text carries.
**Verdict:** works today at current scale; the strongest guard chain in the domain; duplicated preview + cross-page ping-pong are the design failures.

### 4.5 `/admin/fsbos` — FSBO Dashboard
**Purpose:** mirror of `/admin/expireds` for scraped Zillow FSBOs.
**Data path:** `listFsboDashboardRows` (§2c), copy of the expired DAL.
**Mutations:** `FsboActions.client.tsx` → `buildFsboCmaAction` (plain CMA — correct for FSBO) + `SendDocDialog`.
**Defects here:**
- **The off-market guard is wired to a value nothing writes.** Three guards refuse when `status === 'gone'` (`fsbo-dashboard.ts:93,134`; `send-doc.ts:98` → `:208,251`) and the table shows an "off market" badge (`page.tsx:90`), but the ONLY status writers are the processor's `status:'active'` refresh + upsert (`fsbo-processor.ts:74-77,286`). Verified by grep: no code path ever sets `'gone'`. A FSBO that sold, delisted, or listed with a brokerage stays "active" and sendable forever.
- **No MLS re-list guard at all for FSBOs:** `loadTarget` hardcodes `relisted: false` for the fsbo kind (`send-doc.ts:97`). An FSBO owner who signs with another agent (property now Active in MLS) can still be solicited — the exact "never solicit another broker's listing" rule the expired path enforces twice.
- **Silent detection failure:** `scrapeZillowCity` catches every error internally and returns `[]` (`fsbo-detector.ts:426-441`), so `detectFsboListings`' `errors[]` is effectively always empty (`:456-476` — the try/catch there can't fire) and `stats.scrape_errors` reports clean. When Apify hits its $200 billing cap (a known recurring failure per ops memory) or the actor breaks, the cron returns `scraped: 0` happily and the dashboard shows the cheerful "No FSBOs detected yet" empty state (`page.tsx:55-62`). No alert, no error surface.
- **Budget math vs timeout:** 6 sequential cities × Apify `run-sync` with `timeout=180` each (`fsbo-detector.ts:419`) against route `maxDuration = 300` (`detect-fsbo-listings/route.ts:22`) — worst case 1,080s of scraping in a 300s window; late-list cities (Tumalo, La Pine) silently never run on a slow day, and the function death also skips all downstream processing of already-scraped cities.
- Stale docs: detector header says "hourly" cron (`fsbo-detector.ts:5-6,398`); vercel.json says daily `35 9 * * *`.
- Property link goes straight to Zillow (`page.tsx:84`); there is no internal FSBO detail page (no per-row review surface like expireds have) — owner phone/email raw values are visible nowhere in the FSBO UI (only presence flags, `page.tsx:96-101`), so the broker must open the CRM record or the DB to see the number they're approving a text to.
**Verdict:** partial — dashboard + compose-send work; detection reliability, off-market truth, and re-list compliance are unbuilt.

### 4.6 Shared `SendDocDialog` (`components/admin/SendDocDialog.client.tsx`)
Well-structured: channel tabs, pre-merged templates, review-ack checkbox, canonical composers. Feedback via a small text line + auto-close (`:113-138`). Issues:
- SMS default body is EMPTY (`:74`) and the doc link is not auto-inserted — the dialog prints the URL with "paste it in if you want it in the text" (`:224-226`). The one thing this send exists to deliver (the report link) is optional and manual on this path, guaranteed and tracked on the queue path.
- Template dropdown lists EVERY active template of the channel (`prepareDocSendAction` pulls all `crm_templates` rows with no context filter, `send-doc.ts:149-154`) — expired templates offered on FSBO rows and vice versa, plus any unrelated CRM templates.
- No already-sent indication inside the dialog (button label upstream says "Send again", the dialog itself doesn't).

---

## 5. Defect register (evidence-first)

1. **[HIGH] Broker-role dead end on the review detail.** `/admin/expired-listings/layout.tsx:12-14` requires `superuser`; the links to `[key]` render for `broker` (`admin-nav.ts:36,81`; `expireds/page.tsx:77`; `expired-outreach/page.tsx:145`). Broker clicks property → access-denied.
2. **[HIGH] FSBO `gone` status has no writer; no FSBO re-list guard.** Guards at `fsbo-dashboard.ts:93,134`, `send-doc.ts:98/:208/:251` test a value never set (only `'active'` written, `fsbo-processor.ts:74-77,286`); `relisted:false` hardcoded (`send-doc.ts:97`). Off-market/agent-listed FSBOs remain sendable indefinitely — compliance-adjacent.
3. **[HIGH] Hard-stop is a free-text regex, and the Tracerfy path writes neither the string nor the tags.** UI/action hard stop = `/HARD STOP|LITIGATOR/i` on `enrichment_notes` (5 duplicate sites, §3). The `skiptrace-direct` strategy (`expired-owner-lookup.ts:536-561`) returns no `complianceTags`, and a deceased-only person's notes say `DECEASED` (not matched), a DNC-only phone's notes say `BEST PHONE ON DNC` (not matched) and the phone itself can be a DNC number via the `?? allPhonesRaw[0]` fallback (`:287-290`). Result: on that lookup path, deceased/DNC contacts carry no `compliance:hard-stop`/`contact:do-not-*` tags, pass `isSuppressed`, pass the regex, and are one click from an SMS. (BatchData/county path is correctly belt-and-braces.)
4. **[HIGH] Auto-CMA ↔ expired-audit doc-type mismatch breaks the automation loop.** Worker passes no `docType` (`lib/cma/worker.ts:68-85`) → `doc_type:'cma'` (`build.ts:283`); Expireds dashboard requires `'expired-audit'` to send (`expireds/page.tsx:72,96`); outreach queue accepts ANY cma at the slug (`outreach.ts:80-106`, no doc_type filter). Every cron-built expired CMA needs a manual full rebuild on one surface while being send-ready on the other — the two surfaces disagree about what "built" means.
5. **[HIGH] FSBO detection fails silent.** `scrapeZillowCity` swallows all failures to `[]` (`fsbo-detector.ts:426-441`); `errors[]` unreachable (`:461-476`); no alerting; dashboard empty state reads as success (`fsbos/page.tsx:55-62`). Plus 6×180s sequential scrapes vs `maxDuration=300` (`:419`, route `:22`).
6. **[MEDIUM] Address-slug joins can cross-link documents.** `slugifyAddress` strips street-type words and Bend-area zips but not city (`lib/cma/address-slug.ts:11-23`, 40-char cap); expired↔cmas and fsbo↔cmas joins are slug-only (`dashboard.ts:70`, `outreach.ts:84-85`); `getCmaExpiredLinks` is first-writer-wins (`outreach.ts:352-365`); `createCmaRequest` upserts client info onto whatever cmas row owns the slug (`cma-request.ts:183-200`). Same street number+name in two cities, or 40-char truncation twins, silently share one document and one client identity.
7. **[MEDIUM] Two SMS pipelines with contradictory guarantees.** Queue path enforces one-intro-ever (`expired-outreach.ts:66-68`); dialog path deliberately allows unlimited repeats with no already-sent check (`send-doc.ts:240-305`). "One text per owner, sent by you" (the queue page's own promise, `expired-outreach/page.tsx:77`) is only true if the broker never uses the other button.
8. **[MEDIUM] Double-send race on both SMS paths.** Read-check → Twilio → unconditional stamp (`expired-outreach.ts:66,136-147`; `outreach.ts:376-384`); no conditional-update claim; concurrent clicks from two tabs/devices both send.
9. **[MEDIUM] Synchronous ~60s CMA builds in server actions without `maxDuration`.** `buildExpiredAuditAction`/`buildFsboCmaAction` self-describe "about a minute" (`ExpiredAuditActions.client.tsx:30`, `FsboActions.client.tsx:30`); page segments export only `dynamic` — contrast queue worker's `maxDuration=300`. Plausible platform-default timeout → "Build failed" with work half-done.
10. **[MEDIUM] Engagement counts drift and are recomputed expensively.** Both dashboards independently scan up to 5,000 newest `visitor_events` per page load (`dashboard.ts:140-165`, fsbo `:120-147`), so doc-view counts silently exclude anything older than the newest 5,000 client-document views; `email_sent_at` fallback misattributes any `email_out` (`dashboard.ts:200`); `force-dynamic` + zero caching means ~10 serial service-role queries per dashboard load.
11. **[MEDIUM] Unbounded reads with future silent truncation.** `cmas` full-table read (`outreach.ts:80`), `expired_listings` full reads (`outreach.ts:45-51`, `dashboard.ts:57-62`, `getCmaExpiredLinks` `:343-347`) — PostgREST caps at 1,000; tables at 144/155 today; nothing pages them (the visitor_events reads were fixed with `fetchPagedRows`; these were not).
12. **[MEDIUM] Dead actions, one referencing a template that is never seeded.** Zero consumers (verified by grep) for `sendExpiredAuditEmailAction` (`expired-dashboard.ts:56-106`), `sendFsboCmaEmailAction` (`fsbo-dashboard.ts:82-120`), `sendFsboIntroSmsAction` (`fsbo-dashboard.ts:125-199`), `previewExpiredIntroAction` (`expired-outreach.ts:158-180`). Neither `expired-first-touch-sell-v1` nor `fsbo-first-touch-v1` exists in any migration/seed (only a column comment mentions the former, `supabase/migrations/20260712020000_expired_outreach_tracking.sql:10`) — hosted-DB-only rows; a fresh environment's queue send fails "template not found or inactive".
13. **[LOW] Template preview duplication + preview≠actual.** Hardcoded preview string (`expired-outreach/page.tsx:41-46`) vs live DB template at send; actual body further rewritten by short-linker + `_pid` + UTM (`expired-outreach.ts:119,132-133`).
14. **[LOW] Stale/incorrect comments that misdescribe live gates.** `fsbo-processor.ts:19-23` (NULL fub_created_at gate — superseded by source-taxonomy gate, §3); `fsbo-detector.ts:5,398` ("hourly" — it's daily); `stats.scanned` is post-dedupe count (`expired-listing-processor.ts:235-236`).
15. **[LOW] `relisted` hardcoded false on the Expireds dashboard rows** (`dashboard.ts:191`) — no early signal; broker discovers at send refusal.
16. **[LOW] Native `confirm()` for the queue send** (`ExpiredOutreachRow.client.tsx:26-29`) — inconsistent with the design system's Dialog everywhere else; OS-truncated preview on mobile.

## 6. Duplication map

- `lib/data/expired/dashboard.ts` (208 lines) vs `lib/data/fsbo/dashboard.ts` (186 lines): near-identical engagement aggregation, including the duplicate 5,000-row visitor_events scan.
- Hard-stop regex ×5 sites (Defect 3).
- Re-list check implemented twice with slightly different shapes (`outreach.ts:59-77` batch vs `:215-230` single).
- Guard chains triplicated: `sendExpiredIntroAction` / `sendDocSmsAction` / dead `sendFsboIntroSmsAction`.
- Build actions duplicated: `buildExpiredAuditAction` vs `buildFsboCmaAction` (differ by docType + revalidate path only).
- Send-email flow duplicated: live `sendDocEmailAction` vs dead `sendExpiredAuditEmailAction`/`sendFsboCmaEmailAction` (the dead ones carry an extra doc-type check the live one dropped).
- Intro-SMS template string duplicated: DB row vs `expired-outreach/page.tsx:44-46`.
- Two user-facing send surfaces for the same expired owner (routes `/admin/expireds` + `/admin/expired-outreach`).

## 7. Performance notes

- Both dashboards: `force-dynamic`, uncached, ~8–12 serial service-role queries each load, including a 5-page (5,000-row) `visitor_events` scan apiece. At 144/155 rows the pages are fine; the pattern is O(global events), not O(rows shown).
- `getExpiredOutreachRow` recomputes the entire queue (incl. full `cmas` read + `listings` probe) for every single send and every preview.
- `getExpiredListingDetail` (used by detail page AND every dialog-prepare AND every dialog send) is 5 serial queries including the BPO price-cycle scan — the compose dialog pays it twice (prepare + send).
- FSBO cron: sequential Apify sync calls risk eating the whole 300s budget (Defect 5).

## 8. Mobile story

No mobile forks anywhere in this domain — single implementations inside ConsoleShell. Consequences:
- `/admin/expireds` and `/admin/fsbos` are 7-column tables in `overflow-x-auto` cards (`expireds/page.tsx:57`, `fsbos/page.tsx:65`); on a phone the Actions column (the entire point) starts off-screen; row action buttons are `h-8` (32px, sub-44px touch target) while the outreach page uses `h-11` (44px) — inconsistent tap standards between sibling pages.
- `/admin/expired-outreach` stacks acceptably (`flex-col md:flex-row`, 5-stat grid `grid-cols-2 md:grid-cols-5`), but the send confirm is a native `confirm()` whose long preview text the OS truncates.
- `SendDocDialog` is `max-w-xl` with `max-h-[90dvh] overflow-y-auto` — usable but hosts a full EmailComposer inside a dialog on a phone.
- Parity verdict: features are identical across devices (no divergence), but the two table dashboards are effectively desktop-only ergonomics.

## 9. Dead / orphaned inventory

- `app/actions/expired-dashboard.ts` → `sendExpiredAuditEmailAction` (unwired).
- `app/actions/fsbo-dashboard.ts` → `sendFsboCmaEmailAction`, `sendFsboIntroSmsAction` (unwired; the latter references unseeded template `fsbo-first-touch-v1`).
- `app/actions/expired-outreach.ts` → `previewExpiredIntroAction` (unwired; the page hardcodes its own preview instead).
- `fsbo_listings.status='gone'` guard trio + "off market" badge — reachable UI/guards for an unreachable state.
- `/admin/expired-listings` index — redirect stub kept alive solely for old links, but its superuser layout breaks it for brokers anyway.
- `void autoEnrollPerson` import retention in `expired-listing-processor.ts:380` — intentional documented restore path, not dead by accident.
- FUB-era fields still load-bearing as fallbacks: `fub_person_id` read as person-id fallback throughout (`dashboard.ts:76,171`, `outreach.ts:320,359`) — works because native ids were written into that column post-cutover (`fsbo-processor.ts:276`), which is itself a naming trap.

## 10. Job-step counts (as-built)

- **Text an expired owner their audit (happy path, auto-CMA already built):** open Expireds → discover the auto-CMA is "plain CMA" → click "Rebuild as audit" → wait ~60s watching a text label → navigate to Expired outreach → re-find the row → Send intro text → native confirm. **2 pages, 2 row-finds, ~5 clicks + a 60s blocking wait** that exists only because of Defect 4.
- **Email the audit:** Expireds → Send audit → dialog loads (prepare round-trip) → optional template pick → Send. 3–4 clicks, good.
- **FSBO intro text with the report link:** FSBOs → Build CMA (~60s) → Send → SMS tab → type a message → manually copy-paste the doc URL from the helper text → Send. The link the whole flow exists to deliver is a manual paste.

## 11. What is actually solid

- The suppression chokepoint (`isSuppressed`/`isSuppressedByEmail`) is genuinely fail-closed and consulted on every live send path, SMS and email.
- Quiet hours are a single shared implementation, enforced on all three SMS actions.
- Merge-token fail-closed refusal on every composed send.
- The outreach-list taxonomy gate (auto-enroll) is correct and double-enforced (function + cron), with the inbound `-lp` carve-out working as intended.
- Expired re-list check runs live at send time on both expired send paths.
- Detection dedupe (`listing_key` / `fsbo_url`) prevents re-alerting across overlapping windows.
- Short-link click tracking with bot filtering, `_pid` session stitching, and no-open-redirect design.
