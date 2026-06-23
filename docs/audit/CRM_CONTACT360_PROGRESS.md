# CRM Contact-360 + Flywheel — Progress Log

**Source plan:** `docs/audit/CRM_CONTACT360_BUILDOUT.md`.
**How to read:** newest entry at the top. Each increment records what/why, the change set, how it was verified (tsc + gate + vitest [+ next build]), the result, and follow-ups. The status table is the at-a-glance index.

## Status

| Phase | Increment | Title | Status |
|---|---|---|---|
| 0 | 0.1 | Close the inbound-voice lead leak | ⬜ todo |
| 0 | 0.2 | Native-capture fallback on FUB failure | ⬜ todo |
| 0 | 0.3 | Convert sustained hot-anonymous to a durable record | ⬜ todo |
| 0 | 0.4 | Resolve native-create stubs | ⬜ todo |
| 0 | 0.5 | Alarm the CRM_MIRROR_ENABLED kill switch | ⬜ todo |
| 0 | 0.6 | First-touch UTM fallback from visitor_sessions | ⬜ todo |
| 0 | 0.7 | ci:lead-coverage reconciliation gate (DB nightly) | 🚩 flagged (creds) |
| 1 | 1.1 | Bridge columns (crm_person_id) + backfill | ⬜ todo |
| 1 | 1.2 | resolvePersonIdentity() resolver | ⬜ todo |
| 1 | 1.3 | Refactor getters to crm_person_id / the bundle | ⬜ todo |
| 2 | 2.1 | Unified ContactActivityFeed | ⬜ todo |
| 2 | 2.2 | Ownership panel — fix the home-photo proximity bug | ⬜ todo |
| 2 | 2.3 | Real owner_type (absentee/out-of-state) | ⬜ todo |
| 2 | 2.4 | Property attributes for never-listed homes | 🚩 flagged (BatchData) |
| 2 | 2.5 | Geocode coverage cron | 🚩 flagged (Google cost) |
| 2 | 2.6 | Behavior/intent summary panel | ⬜ todo |
| 2 | 2.7 | Identity strip + source_url + CMA-history panel | ⬜ todo |
| 3 | 3.1 | Listing-alerts UNION + humanizer + deep links | ⬜ todo |
| 3 | 3.2 | Newsletter detail (status/frequency/engagement) | ⬜ todo |
| 3 | 3.3 | One-click membership toggles + consent events | ⬜ todo |
| 4 | 4.1 | Relationships schema + type vocab | ⬜ todo |
| 4 | 4.2 | link/unlink/setType actions (reciprocal) | ⬜ todo |
| 4 | 4.3 | Relationships panel + RelationshipPicker | ⬜ todo |
| 4 | 4.4 | Backfill 29 legacy rows + dedup guard | ⬜ todo |
| 5 | 5.1 | crm_people→Meta uploader, in-app + consent-gated + ledger | 🚩 flagged (Meta creds + go) |
| 5 | 5.2 | Audience cron + <1k-match monitor + token-model fix | 🚩 flagged (token authority) |
| 5 | 5.3 | Lead-webhook identity stitch + external_id=rr_vid | ⬜ todo |
| 5 | 5.4 | CAPI match-quality parity (fbc/fbp/IP/UA) + dedup everywhere | ⬜ todo |
| 5 | 5.5 | fbc persistence + auto offline conversions (ROAS loop) | 🚩 flagged (value model + Meta) |
| 5 | 5.6 | meta_capi_log + retry + EMQ reconciliation + Graph v25 pin | ⬜ todo |
| 6 | 6.1 | Bulk-select island | ⬜ todo |
| 6 | 6.2 | Bulk fan-out actions + crm_bulk_jobs audit | ⬜ todo |
| 6 | 6.3 | Bulk compliance rails (preview/EBR/scope/enqueue) | ⬜ todo |
| 6 | 6.4 | Wire bulk sends | 🚩 flagged (TCPA — Matt's go) |
| 7 | 7.1 | Unified saved-search table (+ single filters_hash) | ⬜ todo (run after Phase 1) |
| 7 | 7.2 | Unified saved-home table + fix remove no-op bug | ⬜ todo |
| 7 | 7.3 | Claim-on-sign-in (attach guest saves to account) | ⬜ todo |
| 7 | 7.4 | Consumer controls: cadence + pause/resume + edit-criteria | ⬜ todo |
| 7 | 7.5 | Kill the dead /account/notifications frequency setting | ⬜ todo |
| 7 | 7.6 | Broker visibility: real saved searches + homes (stop regex-infer) | ⬜ todo |
| 8 | 8.1 | GPC + consent gate on tracking/CAPI (LDU on opt-out) | ⬜ todo |
| 8 | 8.2 | Consent surface on landing pages (Pixel can't pre-fire) | ⬜ todo |
| 8 | 8.3 | Privacy policy: disclose rr_vid/rr_fbc/Pixel/CAPI/offline + CCPA/OCPA right | ⬜ todo |
| 8 | 8.4 | Consent ledger + audience opt-out removal (deleteUsers) | ⬜ todo |
| 8 | 8.5 | Harden rr_vid anchor + dual-host PKCE alignment | ⬜ todo |
| 9 | 9.1 | Resend DNS done (Matt) → remove sandbox fallback code-side | 🔶 DNS done; code-side todo |
| 9 | 9.2 | Bounce/complaint → crm_suppressions (+ Svix HMAC fix) | ✅ done (4b55bf6a) |
| 9 | 9.3 | RFC 8058 one-click List-Unsubscribe on bulk sends | ⬜ todo |
| 9 | 9.E | Email inbox-placement & anti-spam (STANDING + ci:email-quality gate + prepareDeliverableEmail) | ⬜ todo |
| 9 | 9.4 | /api/twilio/status delivery receipts + 30007 detect + A2P governor | ⬜ todo |
| 9 | 9.5 | /admin/crm/health observability dashboard | ⬜ todo |
| 9 | 9.6 | crm-health-check cron + alarms + relay heartbeat | ⬜ todo |
| 9 | 9.7 | crm-fub-reconcile + 14-day zero-diff cutover gate | 🚩 flagged (FUB creds, nightly) |
| 9 | 9.8 | Hardening (orphan cron, EMAIL_TRACKING_SECRET, bounce seed) | ⬜ todo |
| 10 | 10.1 | Broker RBAC (server-side assigned_broker scope everywhere) | ⬜ todo |
| 10 | 10.2 | Service-role boundary audit (RLS tables via DAL only) | ⬜ todo |
| 10 | 10.3 | Dual-host OAuth/PKCE fix verified | ⬜ todo |
| 10 | 10.4 | Broker daily/weekly digests repointed FUB → crm_people + scheduled | ⬜ todo |

Legend: ⬜ todo · 🔶 in progress · ✅ done · 🚩 flagged (needs creds / a decision / Matt's go).

## Log

_(append newest-first)_

### 2026-06-22 · 9.2 Resend webhook fixed (Svix HMAC + bounce→suppression) — `4b55bf6a`
First execution increment. The webhook verified signatures with a naive string-compare (rejected every real Svix event → no bounce ever recorded). Fixed: proper Svix HMAC (`lib/crm/resend-webhook.ts`, 13-case test incl. an independent signer + replay window + bounce/complaint/soft classification), and on hard bounce/complaint → `addSuppression({channel:'email'})` across all sibling rows sharing the email (`lib/data/crm/getPersonIdsByEmail.ts`). tsc clean, 843 tests, DAL boundary stable. Follow-up: confirm a real Resend test event in the dashboard post-deploy. Also added the **9.E email inbox-placement & anti-spam standing requirement** to the runbook (Matt directive).
