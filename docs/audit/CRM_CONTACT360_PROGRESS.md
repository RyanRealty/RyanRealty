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
| 5 | 5.1 | crm_people → Meta Custom Audience uploader + cron | 🚩 flagged (Meta creds) |
| 5 | 5.2 | FB Lead-Ad webhook graph-aware (rr_vid/fbclid stitch) | ⬜ todo |
| 5 | 5.3 | external_id=rr_vid on pixel + CAPI | ⬜ todo |
| 5 | 5.4 | Auto-fire offline conversions on a CRM milestone | 🚩 flagged (Meta + decision) |
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

Legend: ⬜ todo · 🔶 in progress · ✅ done · 🚩 flagged (needs creds / a decision / Matt's go).

## Log

_(append newest-first)_
