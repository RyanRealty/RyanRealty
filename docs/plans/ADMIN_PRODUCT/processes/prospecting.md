# Process: prospecting — Outbound prospecting (expired + FSBO)

## 0. Meta
- Status: deepened
- Cadence: weekly broker motion (Matt Q2 verbatim: "seeing what listings expired and sending them audits, seeing any new fsbos and sending them cmas"); detection continuous
- Verdict: KEEP (proposed; P3 decides) — Matt's named weekly core job; biggest pre-solved IA cut (5 routes already redirect into one)
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Every qualifying expired/canceled/withdrawn listing and new FSBO in the service area becomes a compliant, one-click outreach opportunity with the audit/CMA document already built.

## 2. Inception (what starts it)
- Trigger type: system condition (detection) → broker action (outreach)
- Expired detection: inside `runDeltaSync({mode:'execute'})` only — `lib/sync/deltaSync.ts:607-614` → `processNewExpiredListings({maxPerRun:10, lookbackHours:2})`; cron `sync-delta` every 15 min (`vercel.json:17-19`). Qualification (`syncWrites.ts:639-664`): `StandardStatus IN ('Expired','Canceled','Withdrawn')`, service-area cities, `PropertyType='A'`, `ListPrice > 500_000` (`lib/prospecting/capture-scope.ts:31-40`, locked 2026-07-24, `ci:capture-scope` enforced). Dedup vs `expired_listings.listing_key` (`expired-listing-processor.ts:195-215`).
- FSBO detection: `detect-fsbo-listings` cron daily (`lib/fsbo-processor.ts:66-90`).
- Skip-trace INLINE at detection for both kinds: `lookupOwnerForExpiredListing` (`expired-owner-lookup.ts:638-641`) — county ArcGIS free → BatchData (`owner-resolution.mjs:87-184`) → Tracerfy → Apify fallback (`expired-owner-lookup.ts:296-591`).
- Broker inception: opens `/admin/prospecting` weekly; detection alert email fires unconditionally even with no contact (`expired-listing-processor.ts:428-452`).

## 3. Actors
- Human: broker — the FIRST TOUCH IS ALWAYS MANUAL (auto-enroll deliberately PAUSED, Matt 2026-07-11 — `expired-listing-processor.ts:376-386`; `fsbo-processor.ts:20-24`). Accountable for send decisions.
- Automated: detection, skip-trace, auto-doc build (`docType:'expired-audit'` — `:391-425`), compliance computation.

## 4. Systems of record
- `expired_listings` / `fsbo_listings` — prospect state (composite, no single status column for expired: `owner_lookup_status` pending|resolved, `compliance_hard_stop`+`compliance_flags`, `outreach_sms_status`/`outreach_email_status` null|sending|sent — migrations `20260718120400`, `20260722010100`).
- `crm_people` — owner as person (tags + `custom` demographics — `:311-331,335-363`); `cmas` — the audit doc (`cma_id` link via `linkProspectCma` — `send-claim.ts:151-163`); `crm_timeline` — sends.
- NOT SoR: MLS status snapshot at detection (relist status re-verified LIVE at send).

## 5. End-to-end path (inception → completion)
1. **Detect** · system · qualify + dedup + upsert prospect row · `expired-listing-processor.ts:454-495` / `fsbo-processor.ts:281-322` · failure: outside scope → never captured (by design) · n/a
2. **Skip-trace** · system · owner name/phone/email/mailing/taxlot onto row; compliance tags (`litigator OR dnc.tcpa OR deceased` → hard-stop tags — `owner-resolution.mjs:201-203`) · failure: `owner_lookup_status:'pending'` → no-phone bucket · n/a
3. **CRM person + task** · system · `enrichNativeLead` + 60-min Call task (`:335-374`); auto-CMA queued (`:391-425`) · n/a
4. **Alert Matt** · system · detection email always (`:428-452`) · n/a
5. **Broker opens worklist** · human · `/admin/prospecting` — buckets `sent | needs-audit | no-phone | sendable | excluded` (`list.ts:133-141`); row carries doc state, compliance, engagement, `sendable` (`get.ts:171-180`) · **weekly, desktop today**
6. **Build/approve doc if needed** · human · `buildProspectDoc` → `buildCma` (`prospecting.ts:599-638`); `approveProspectDoc` → `approveCmaAction` (`:642-656`) — public `/cma/<slug>` 404s drafts · n/a
7. **Prepare send** · human · `prepareProspectSend` preview (merged SMS from `crm_templates` seed `expired-first-touch-sell-v1`, link is `/cma/<slug>` NOT the LP — migration `20260718120300:11-18`) (`:679-779`) · n/a
8. **Send intro** · human · `sendProspectingIntro` (SMS `:86-347`) / `sendProspectingEmailIntro` (email `:374-595`) — guard chain in order: doc ready → offMarket/hardStop → LIVE `verifyNotRelisted` (fail-closed `batch.ts:399-425`) → phone/E.164 → quiet hours 8am–9pm PT (SMS only) → suppression person+value-keyed → merge-token refusal → **claim RPC** (`prospect_send_claim`, at-most-once, never released once sent) → TOCTOU suppression re-check → Twilio/`sendCmaToLead` → finalize + timeline + enrich · failure: any gate refuses with reason · either device
9. **Owner engages** · owner · doc views tracked; LP `/lp/expired-listing` is a separate INBOUND funnel that writes back to CRM (`lp/expired-listing/actions.ts:89-366` — tags, CMA queue, 5-min hot task, CAPI/GA4) · n/a
10. **Optional drip** · human · `enrollProspectInDripAction` one-click manual (`:797-831`, fail-closed) · n/a

## 6. Decision points
- In capture scope? (cities, $500K+, PropertyType A) → else never exists.
- Contact resolvable? → sendable vs no-phone bucket (email may still pass — email channel gates independently: `channels.email.blocked`, not SMS hardStop — `:417,433-434`).
- Hard-stop (litigator/TCPA/deceased)? → blocked both send paths; persisted + live union, fail-closed (`compliance.ts:30-46`).
- Relisted with another agent? → refuse (live re-check at send; fail-closed on read error `:152-154`).
- Quiet hours? → SMS refused; email allowed.
- Already sent? → claim RPC returns `already_sent`/`replay` — durable, never re-claimable.

## 7. Completion
- Done-when: per-channel `outreach_*_status='sent'` (first touch = earliest of SMS/email — `types.ts:339-347`), or prospect excluded/blocked with visible reason.
- Artifacts: sent timeline rows; doc with tracked views; enriched person.
- Signals: `sent` bucket; engagement data on row.
- Terminal states: sent (per channel, durable) · excluded (hard-stop/off-market/relisted) · stale-never-actioned (no expiry — gap).

## 8. Time & SLA
- Detection: ≤15 min from MLS status change (expired); daily (FSBO). Skip-trace inline.
- Broker: weekly ritual; no per-prospect SLA (reasonable — cold outreach), but no aging/"went stale" signal either.
- Doc-cadence note: cadence comments say "every 10 min", vercel.json says 15 — stale docs (defect).

## 9. Variants
- Kind: expired (joins `listings` for photo/geo — `get.ts:202-231`) vs FSBO (native fields — `:233-259`; off-market exclusion computed but NO writer ever sets `'off_market'` — dead branch defect).
- Channel: SMS vs email (independent gates + claims). Doc: `expired-audit` vs `cma` (`types.ts:365-367`).

## 10. Current implementation map
- Routes: `/admin/prospecting` (+`[kind]/[id]`); 5 legacy routes redirect in (confirmed live).
- Actions: `app/actions/prospecting.ts` (7 actions); data layer `lib/data/prospecting/*`; detection libs.
- Known defects: (a) `fsbo_listings.status='off_market'` referenced but never written — exclusion dead in practice; (b) `detect-expired-listings` route is manual-only backfill (documented, unregistered — intended); (c) cadence-doc drift (10 vs 15 min); (d) no prospect aging/stale signal; (e) email columns feature-detected (42703 retry) pre-migration — soft-fail `not_deployed` (`get.ts:54-91`, `send-claim.ts:476-482`).
- Duplicate paths: none — consolidation already executed; `getContactProspectStory` links fixed 2026-07-28.

## 11. Target shape (process-level, not pixels)
- Should exist: YES — weekly core job, mobile tab candidate (today: 0 of 5 tabs).
- Ideal: one worklist where the weekly pass is: open → scan new sendables → send N intros (guards invisible unless they refuse) → done in minutes; FSBO off-market writer fixed or branch removed; aging visible.
- Data gaps: off-market writer; staleness stamp; per-week "what's new since last visit" cut.
- UI destination implication: ONE prospecting destination, phone-capable (Matt does this weekly — deserves a primary slot the current tab bar denies).

## 12. Acceptance checks
- [ ] Force a listing to Expired in scope → prospect row ≤15 min, skip-trace fields populated or `pending`, CRM person tagged, audit doc queued, Matt emailed.
- [ ] Litigator-flagged owner → hard-stop tags on person + row; both send actions refuse.
- [ ] Relist the property (Active) → send refuses on live re-check even though row predates it.
- [ ] Send SMS intro at 7am PT → quiet-hours refusal; same at 10am → sent, claim durable; immediate repeat → `already_sent`.
- [ ] Owner opens doc link → engagement on worklist row; owner submits LP form → CRM person enriched + hot task.
- [ ] FSBO goes off-market in source → document current behavior (no exclusion fires — dead branch) until fixed.
