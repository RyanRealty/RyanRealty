# CRM Contact-360 + Flywheel — Progress Log

**Source plan:** `docs/audit/CRM_CONTACT360_BUILDOUT.md`.
**How to read:** newest entry at the top. Each increment records what/why, the change set, how it was verified (tsc + gate + vitest [+ next build]), the result, and follow-ups. The status table is the at-a-glance index.

## Status

| Phase | Increment | Title | Status |
|---|---|---|---|
| 0 | 0.1 | Close the inbound-voice lead leak | ✅ done (03e2efae) |
| 0 | 0.2 | Native-capture fallback on FUB failure | ✅ done (80ecbcaf) — ensureNativeLead wired into seller/FSBO/lead-landing failure branches; Meta webhook + others = follow-up |
| 0 | 0.3 | Convert sustained hot-anonymous to a durable record | ✅ rule + capture done (5be94c91); wire into the 5-min visitor-hot-lead cron = follow-up |
| 0 | 0.4 | Resolve native-create stubs | ✅ done (d6b3b4a3) — one shared buildNativePersonRow; 3 dead stubs deleted |
| 0 | 0.5 | Alarm the CRM_MIRROR_ENABLED kill switch | ✅ done (09161a2c) |
| 0 | 0.6 | First-touch UTM fallback from visitor_sessions | ✅ reader done (6c54c7e1); wiring into lead-create = follow-up |
| 0 | 0.7 | ci:lead-coverage reconciliation gate (DB nightly) | 🚩 flagged (creds) |
| 1 | 1.1 | Bridge columns (crm_person_id) + backfill | ✅ APPLIED to prod (Matt's go 2026-06-22) — crm_person_id on all 4 tables + indexes + backfill (1 vim row bridged; saved_searches/profiles 0-row so 0). Snapshot refreshed. Unblocks Phase 7 |
| 1 | 1.2 | resolvePersonIdentity() resolver | ✅ done v1 (c5cf2058) — authUserId from visitor_identity_map; email→auth.users needs Phase 1.1 RPC |
| 1 | 1.3 | Refactor getters to crm_person_id / the bundle | ⬜ todo |
| 2 | 2.1 | Unified ContactActivityFeed | ✅ DONE — reader (4cabc1f8) + panel wired as the overview "Recent activity" glance (4d05333b) |
| 2 | 2.2 | Ownership panel — fix the home-photo proximity bug | ✅ done (fab16276) — address-match gate; near miss shows no photo, never the wrong house |
| 2 | 2.3 | Real owner_type (absentee/out-of-state) | ⬜ todo |
| 2 | 2.4 | Property attributes for never-listed homes | 🚩 flagged (BatchData) |
| 2 | 2.5 | Geocode coverage cron | 🚩 flagged (Google cost) |
| 2 | 2.6 | Behavior/intent summary panel | ✅ DONE — reader (2980e50a) + "On the website" panel in the watching tab (4d05333b) |
| 2 | 2.7 | Identity strip + source_url + CMA-history panel | ✅ reader done (df6d1604); panel UI = Wave 4+ |
| 3 | 3.1 | Listing-alerts UNION + humanizer + deep links | ✅ DONE — reader (0bc6ffaa) + humanized panel in the watching tab (4d05333b) |
| 3 | 3.2 | Newsletter detail (status/frequency/engagement) | ✅ reader done (387322e5) — frequency from segment (no cadence column) |
| 3 | 3.3 | One-click membership toggles + consent events | ✅ DONE — reader+actions (a0e0d7f6) + toggle UI live on the lead page (3f6e4272), consent-safe, next build verified |
| 4 | 4.1 | Relationships schema + type vocab | ✅ vocab + reciprocalType (beaaf0f5); UNIQUE/no-self-link constraint = flagged migration (with 1.1) |
| 4 | 4.2 | link/unlink/setType actions (reciprocal) | ✅ done (beaaf0f5) |
| 4 | 4.3 | Relationships panel + RelationshipPicker | ✅ DONE — reader + add/remove panel in the overview (4d05333b); contact-search picker (vs numeric id) = polish follow-up |
| 4 | 4.4 | Backfill 29 legacy rows + dedup guard | ✅ dedup guard APPLIED (2026-06-22) — no-self-link CHECK + partial-unique on real pairs (verified 0 conflicts); resolving the 29 null-related legacy names to person ids = data follow-up |
| 5 | 5.1 | crm_people→Meta uploader, in-app + consent-gated + ledger | ✅ SHIPPED (69be3036) — syncCrmAudience: consent-gated (excludes any crm_suppressions), SHA-256 hashed, DRY-RUN default (live needs dryRun:false AND META_AUDIENCE_PUSH_ENABLED). First live push = Matt reviews the dry-run then says go |
| 5 | 5.2 | Audience cron + <1k-match monitor + token-model fix | 🔶 building (Wave 8) — token authority RESOLVED (System User never-expires) |
| 5 | 5.3 | Lead-webhook identity stitch + external_id=rr_vid | ⬜ todo |
| 5 | 5.4 | CAPI match-quality parity (fbc/fbp/IP/UA) + dedup everywhere | ⬜ todo |
| 5 | 5.5 | fbc persistence + auto offline conversions (ROAS loop) | 🚩 flagged (value model + Meta) |
| 5 | 5.6 | meta_capi_log + retry + EMQ reconciliation + Graph v25 pin | 🔶 rebuilding — meta-audience-sync cron (dry-run) + ledger migration (flagged) |
| 6 | 6.1 | Bulk-select island | ⬜ todo |
| 6 | 6.2 | Bulk fan-out actions + crm_bulk_jobs audit | ⬜ todo |
| 6 | 6.3 | Bulk compliance rails (preview/EBR/scope/enqueue) | ⬜ todo |
| 6 | 6.4 | Wire bulk sends | 🚩 flagged (TCPA — Matt's go) |
| 7 | 7.1 | Unified saved-search table (+ single filters_hash) | 🚩 guest-save-without-account needs a saved_searches.user_id-nullable + email migration (pending Matt) |
| 7 | 7.2 | Unified saved-home table + fix remove no-op bug | ✅ remove bug FIXED (2759b5d4) — deleted both saved_listings + likes |
| 7 | 7.3 | Claim-on-sign-in (attach guest saves to account) | ✅ done (2759b5d4) — guest searches claimed on verified sign-in, idempotent |
| 7 | 7.4 | Consumer controls: cadence + pause/resume + edit-criteria | ✅ done (2759b5d4) — /account/saved-searches pause/resume/cadence/rename/delete; WANTS Matt visual review |
| 7 | 7.5 | Kill the dead /account/notifications frequency setting | ✅ done (2759b5d4) — now writes the real per-row cadence |
| 7 | 7.6 | Broker visibility: real saved searches + homes (stop regex-infer) | ✅ done (by Wave 4 panels) |
| 8 | 8.1 | GPC + consent gate on tracking/CAPI (LDU on opt-out) | 🔶 rebuilding on the canonical base (Wave 8 had 4-way module conflicts; 5.1 kept, GPC/removal/cron re-dispatched clean) |
| 8 | 8.2 | Consent surface on landing pages (Pixel can't pre-fire) | ⬜ todo |
| 8 | 8.3 | Privacy policy: disclose rr_vid/rr_fbc/Pixel/CAPI/offline + CCPA/OCPA right | ⬜ todo |
| 8 | 8.4 | Consent ledger + audience opt-out removal (deleteUsers) | 🔶 rebuilding (opt-out enqueues removal off the suppression chokepoint, fail-closed) |
| 8 | 8.5 | Harden rr_vid anchor + dual-host PKCE alignment | ⬜ todo |
| 9 | 9.1 | Resend DNS done (Matt) + remove sandbox fallback code-side | ✅ code done (f372f427); DNS confirm |
| 9 | 9.2 | Bounce/complaint → crm_suppressions (+ Svix HMAC fix) | ✅ done (4b55bf6a) |
| 9 | 9.3 | RFC 8058 one-click List-Unsubscribe on bulk sends | ✅ chokepoint done (6eb90686) — token + /api/email/unsubscribe + headers; wiring into the 24 senders = ratchet backlog |
| 9 | 9.E | Email inbox-placement & anti-spam (STANDING + ci:email-quality gate + prepareDeliverableEmail) | ✅ done (analyzer 94308ebd · preflight 6eb90686 · gate 8ce9af80) |
| 9 | 9.4 | /api/twilio/status delivery receipts + 30007 detect + A2P governor | ✅ receipts + carrier-filter done (cfddec7d); A2P send-rate governor = follow-up |
| 9 | 9.5 | /admin/crm/health observability dashboard | ✅ done (372d2745) — live vital-sign tiles, next build verified |
| 9 | 9.6 | crm-health-check cron + alarms + relay heartbeat | ✅ done (9665f469) — every 30m, deduped broker alerts, evaluateHealthRules (19 tests) |
| 9 | 9.7 | crm-fub-reconcile + 14-day zero-diff cutover gate | 🚩 flagged (FUB creds, nightly) |
| 9 | 9.8 | Hardening (orphan cron, EMAIL_TRACKING_SECRET, bounce seed) | ✅ gate done (d7830476) — ci:crm-secrets (boot-visible secrets + orphan-cron audit); secret VALUES + orphan crm-smart-followups = Matt/ops follow-up |
| 10 | 10.1 | Broker RBAC (server-side assigned_broker scope everywhere) | ✅ ENFORCED — Option A (Matt's call: he sees all, Rebecca/Paul scoped). lib/crm/scope.ts scopeBroker + requirePersonInScope; GAP-0 leak closed, every mutation guarded, lists scoped, assignBroker owner-only. next build OK. (c00f4d03). FOLLOW-UP: scope/deny report_viewer if ever created |
| 10 | 10.2 | Service-role boundary audit (RLS tables via DAL only) | ⬜ todo |
| 10 | 10.3 | Dual-host OAuth/PKCE fix verified | ⬜ todo |
| 10 | 10.4 | Broker daily/weekly digests repointed FUB → crm_people + scheduled | ✅ repoint done (8df4253b) — getBrokerDigest reads crm_*; SCHEDULING (add both to vercel.json crons) + FUB-only smartlists/appointments = follow-up |

Legend: ⬜ todo · 🔶 in progress · ✅ done · 🚩 flagged (needs creds / a decision / Matt's go).

## Log

_(append newest-first)_

### 2026-06-22 · Phase 7 shipped (saved-search management) + Meta verified + Meta build dispatched
**Phase 7 (`2759b5d4`)** — consumers manage their own saved searches + homes. All session-user-scoped (reviewed every action):
- 7.4 /account/saved-searches controls (pause/resume/cadence/rename/delete) — CONSUMER UI, wants Matt's visual review.
- 7.3 claim-on-sign-in (guest_search_alerts -> saved_searches on first verified sign-in, idempotent, wired into app/auth/callback).
- 7.2 saved-home REMOVE bug fixed (root cause: only deleted saved_listings, not likes; the page renders the union).
- 7.5 dead /account/notifications frequency control now writes the real per-row cadence. 7.6 already done by Wave 4.
- 7.1 (guest save WITHOUT an account) still needs a saved_searches.user_id-nullable migration — flagged.
1233 tests, next build 18.4s, 3 routes compile.

**Meta verified (Matt asked "is it set up?")** — YES. META_USER_ACCESS_TOKEN is a SYSTEM_USER token, never-expiring, with ads_management / ads_read / business_management / leads_retrieval / pages_manage_ads. Ad account act_1178780510184911 reachable (MANAGE), Custom Audiences readable (3 exist). META_CAPI_ACCESS_TOKEN present for offline conversions. **(c) is unblocked, no token work needed.** ROAS model (Matt: "I don't care, keep going"): default to commission-value-per-closed-deal.

**Phase 5 + 8 dispatched (Wave 8, consent-first):** crm_people->Meta Custom Audience uploader, GPC/consent gate, opt-out->audience-removal, sync cron + ledger. HARD GUARDRAILS baked in: gates on crm_suppressions, SHA-256 hashed PII, **DRY-RUN by default — nothing pushes to Meta until META_AUDIENCE_PUSH_ENABLED + Matt sees the dry-run + says go.** The first live PII push is Matt's explicit call.

### 2026-06-22 · Matt unblocked (a) + (b): migrations APPLIED + RBAC ENFORCED
- **(a) Migrations applied to prod** (Matt: "apply migrations") — Phase 1.1 crm_person_id bridge columns + backfill, Phase 4.4 crm_relationships no-self-link + partial-unique. Snapshot refreshed. **Phase 7 (saved-search unification) is now unblocked.**
- **(b) RBAC enforced, Option A** (Matt: "I see all") — `c00f4d03`. lib/crm/scope.ts is the policy source of truth; GAP-0 contact-detail leak closed, every personId mutation guarded (crm.ts + membership + relationships), all-broker list reads scoped, assignCrmBroker owner-only, restricted brokers can't widen via ?broker=. Reviewed every scope check before commit; next build 17.6s, 1192 tests.
- **(c) Meta + (d) GPC** still need Matt's input (see the session response) — both are business/credential decisions, not buildable autonomously.

### 2026-06-22 · Wave 6 + BUILDABLE SET COMPLETE — the loop has reached its no-blocker goal
Wave 6 (3 increments, all verified + committed):
- **10.4** broker digests repointed FUB -> crm_* (`8df4253b`) — getBrokerDigest reads the self-owned CRM; daily fully repointed, weekly partial (smartlists/appointments are FUB-only). Follow-up: add both routes to vercel.json crons (still unscheduled).
- **9.8** `ci:crm-secrets` gate (`d7830476`) — EMAIL_TRACKING_SECRET / CRON_SECRET / CMA_PREVIEW_SECRET listed in lib/env.ts (optional, boot-visible) + orphan-cron audit (flags the dead /api/cron/crm-smart-followups). Follow-up: set the secret VALUES in Vercel so token signing stops falling back to the service-role key.
- **10.1** RBAC audit (`8969c0f6`, docs/audit/CRM_RBAC_AUDIT.md) — **found GAP-0: any broker can read any other broker's full contact-360 via /admin/console/leads/<id>** (getCrmPersonFull has no assigned_broker check); write-side mutations also trust a raw personId. Enforcement is security-sensitive + has a policy fork (Matt=superuser-sees-all vs just-a-broker) — NOT blind-shipped.

**Loop status: the entire buildable, no-blocker Contact-360 plan is shipped (27 increments this session).** Everything that remains is BLOCKED on a Matt decision and the loop is intentionally stopping rather than churn:
- **Phase 1.1 + 4.4 migrations** — written + pre-verified safe; need "apply the migrations" (classifier blocks autonomous prod-DB). Unblocks **Phase 7** (consumer saved-search management) + the relationships uniqueness guard.
- **Phase 5** (Meta audiences from leads) — needs the Meta token authority + closed-deal value model.
- **Phase 8** (GPC/consent posture) — a business/compliance decision.
- **Phase 10.1 RBAC enforcement** — act on the audit; needs the Option A/B policy call (and ships detail+lists together).
- Smaller follow-ups: schedule the 2 digest crons + crm-smart-followups; set the email-signing secret values in Vercel; wire 0.3/0.6 readers into their crons.

Inherited red (not CRM scope): `ci:hydration-safety` 4 #418 violations in app/lp/*LPForm.tsx + components/ListingTile.tsx — owned by the concurrent p1.x track.

### 2026-06-22 · Wave 5 — observability + lead-tracking completeness (4 increments)
All 4 agents succeeded; integrated + verified (tsc + 66 new tests + next build for the health page + boundary held at 213) + committed:
- **9.5** `/admin/crm/health` board (`372d2745`) — live vital-sign tiles (mirror, A2P, webhook freshness, suppressions, lead volume) with pure level helpers; linked in admin nav.
- **9.6** crm-health-check cron (`9665f469`) — every 30m, `evaluateHealthRules` (19 tests) → deduped non-person broker alerts. The health-alert's raw reads/writes were moved into a new `lib/data/crm/healthAlertQueue` DAL module so the dal-boundary baseline held at 213 (the agent had raised it to 215).
- **0.3** hot-anonymous capture (`5be94c91`) — `isSustainedHotAnonymous` (18 tests) + `captureHotAnonymous` (behavior-only, A2P-safe). Wire into the 5-min visitor-hot-lead cron = follow-up.
- **0.4** native-create cleanup (`d6b3b4a3`) — one shared `buildNativePersonRow` for both create helpers; deleted 3 dead `@stub Wave 1.8` files (zero importers).

Fixed a design-token ratchet regression on the way: `app/api/email/unsubscribe/route.ts` (a standalone HTML one-click-unsubscribe Response, can't use React/design-system components) added to `.design-token-lint-ignore` — same exception class as the existing admin HTML/chart surfaces (gate now 326 vs 328, improved). Session total: 24 increments. The full ci:gates chain is green except the inherited p1.x `ci:hydration-safety` 4-violation red (their gate, their files).

### 2026-06-22 · Wave 4 — the Contact-360 VIEW is assembled (`4d05333b`)
All 4 panel agents succeeded; integrated + wired into the lead detail page, verified (tsc + 18 new tests + admin-responsive + brand-voice + dead-ui + next build 18.6s, route compiles), committed. The lead page now lays out, design-system + mobile-first:
- **Overview:** identity → Memberships (one-click toggles) → Relationships (link/unlink typed reciprocal) → Recent-activity glance (unified feed) → next-best-action.
- **Watching tab:** "On the website" behavior/intent panel → watching homes → humanized listing-alerts → saved searches.
- **Activity tab:** the existing rich ConversationThread + site/system feed (kept; the unified feed reader also powers the overview glance).
- **Comms tab:** the existing email/SMS composers.

file-size-budget re-baselined (page 781→812 for the 4 panels). The whole Contact-360 read + action + consent + VIEW layer is now built and live. **Session total: 20 increments.** Remaining buildable: 9.5/9.6 observability (/admin/crm/health + health cron), 9.8 hardening, 10.x RBAC/digests, 2.7 identity-strip panel polish. Blocked-on-Matt: Phase 1.1 + 4.4 migrations (say "apply the migrations"), Phase 5 Meta audiences (creds/decisions), Phase 7 saved-search unification (needs 1.1).

### 2026-06-22 · Wave 3 (5 increments) + Wave 4 marquee UI — the one-click toggles ship
Wave 3's 5 agents all succeeded; integrated + verified (tsc + 79 new tests + consent/lead/dal gates + crm-fail-closed all green) + committed:
- **3.3** membership toggles reader + consent-safe actions (`a0e0d7f6`) — getContactMemberships + setSequenceEnrollment/setNewsletterSubscription/setListingAlertsPaused; canSubscribe REFUSES re-subscribing a hard-stopped channel (14 tests). suppressions.ts now EXPORTS TAG_CHANNEL (read-only) so the consent reader shares the one authoritative mapping — chokepoint logic unchanged.
- **3.2** newsletter detail reader (`387322e5`), **2.6** behavior/intent reader (`2980e50a`), **4.1+4.2** relationships vocab + reciprocal link/unlink/setType actions (`beaaf0f5`), **0.2** FUB-failure native fallback wired into the seller/FSBO/lead-landing submit actions (`80ecbcaf`).

**Then the marquee UI (3.3 UI, `3f6e4272`):** MembershipToggles island (design-system <Switch>, optimistic + reverts on failure surfacing the consent reason) wired into the lead detail page as a Memberships card — Matt's "one click assign/unassign by toggling." **next build passes (18.4s)**, route /admin/console/leads/[id] compiles, 1068 tests green. file-size-budget re-baselined for genuine feature growth (lead page +12, seller-home-value +26 from the FUB fallback, syncWrites +1 inherited).

Plus two inline readers earlier this cycle: **2.7** identity-strip + CMA history (`df6d1604`), **2.1** unified activity feed (`4cabc1f8`).

**Wave 4 in flight:** the remaining view panels (activity feed, behavior/intent, relationships + reader, humanized listing-alerts) as design-system components to wire into the page. Session total so far: 18 increments shipped.

### 2026-06-22 · Wave 2 (parallel-agent build) — 4 increments shipped + Phase 1.1 migration written (flagged)
All 4 agents succeeded (disk healthy after the Wave 1 cleanup). Each verified in its worktree (tsc + vitest), integrated + re-verified (tsc + full ci:gates) + committed by the orchestrator.
- **0.5** mirror kill-switch alarm (`09161a2c`) — a disabled CRM_MIRROR_ENABLED now logs one structured warn/process + a pure `mirrorHealthStatus()` the future /admin/crm/health board reads. 5 tests.
- **0.6** first-touch UTM reader (`6c54c7e1`) — `getFirstTouchAttribution()` recovers original utm/landing from the earliest visitor_sessions row; pure `pickFirstTouch()`. 10 tests. Wiring into lead-create = follow-up.
- **2.2** home-photo proximity fix (`fab16276`) — the "Home they own" panel resolved the photo by nearest-listing lat/lng with NO address compare (could show a neighbor's house). Now `addressMatches()` gates every candidate; a photo surfaces only on a confirmed street match, a near miss keeps the sale-history row but withholds the photo. 27 tests. Behavior change: photo appears less often (only when confirmed) — intended.
- **3.1** unified listing-alerts reader (`0bc6ffaa`) — `getContactListingAlerts()` unions signed-in saved_searches + guest_search_alerts into one humanized, deep-linked list (resolver-driven). 22 tests. Note: signed-in saved searches reachable only when the contact is stitched to an auth user (the resolver's documented email->auth.users gap).

**Phase 1.1 bridge columns — FLAGGED (needs Matt's go).** Wrote `supabase/migrations/20260622190000_crm_person_id_bridge_columns.sql`: additive `crm_person_id bigint` (FK -> crm_people(id) ON DELETE SET NULL) on visitor_identity_map / visitor_sessions / saved_searches / profiles + indexes + a backfill (the migration runs as postgres, so its backfill resolves user_id -> auth.users.email -> crm_contact_points — the clean place to do the auth.users join the app can't). Pre-checked safe: saved_searches + profiles are 0 rows, visitor_identity_map 1, visitor_sessions 210 — the ideal zero-risk moment. **The auto-mode classifier blocked applying it autonomously (prod infra).** The file is committed-ready; applying needs Matt's explicit OK (or a Supabase-MCP permission rule). This unblocks Phase 1.3 (getter refactor) + Phase 7 (saved-search unification).

**Still-inherited red (not CRM scope):** `ci:hydration-safety` 4 NEW #418 violations remain in app/lp/*LPForm.tsx + components/ListingTile.tsx — owned by the concurrent **p1.x** track that actively ratchets that gate (`8547a714` "gate 86->83", touched 6-8h ago). Left to that track; touching a gate another agent is mid-ratchet on would conflict on its baseline.

### 2026-06-22 · Wave 1 (parallel-agent build) — 6 increments shipped + 2 pre-existing reds fixed
End-to-end orchestration per Matt's directive: an end-to-end goal (complete the buildable CRM surface), split into file-disjoint increments, built by parallel worktree-isolated agents, then integrated + verified (tsc + vitest + the full ci:gates chain) + committed by the orchestrator. **Disk hit 100%** mid-run (2 of 5 agents died at worktree-create with "No space left on device" — NOT code failures); freed ~13 GB by non-destructively removing 6 **clean** stale prior-session worktrees (`git worktree remove`, no `--force`, so no other session's uncommitted work could be lost), then integrated the 3 that finished and built the 2 disk-killed ones (the interdependent email slice) inline.

Shipped:
- **0.1** inbound-voice lead leak (`03e2efae`) — shared `findOrCreatePersonByPhone` (lib/data/crm), both voice + SMS webhooks route through it; unknown caller now creates exactly one tracked lead before the dial; new-lead alert only on a real create. 8 tests.
- **1.2** `resolvePersonIdentity()` keystone resolver (`c5cf2058`) — FUB-independent identity bundle from crm_people + crm_contact_points + visitor_identity_map (now READ) + visitor_sessions. 12 tests. FLAG: email→auth.users has no clean service-role path; authUserId resolves from `visitor_identity_map.user_id` for now (Phase 1.1 needs a SECURITY DEFINER RPC or the bridge column).
- **9.4** Twilio delivery receipts (`cfddec7d`) — `POST /api/twilio/status` (was a 404), forward-only delivery state into the sms_out timeline row, 30007/30008 carrier-filter detect, pure classifier. 16 tests. Follow-up: A2P send-rate governor.
- **9.3 + 9.E.7** email preflight (`6eb90686`) — `prepareDeliverableEmail()` single chokepoint (multipart + CAN-SPAM footer + RFC 8058 List-Unsubscribe headers + deliverability scoring) + HMAC unsubscribe token + `POST /api/email/unsubscribe` (GET is prefetch-safe, only POST suppresses, via the suppression chokepoint). 18 tests. FLAG: set `BROKERAGE_POSTAL_ADDRESS` to the registered street/PO box (CAN-SPAM); fallback carries a valid ZIP+OR so the analyzer passes.
- **9.E.4** `ci:email-quality` gate (`8ce9af80`) — ratchet: no NEW automated-email sender may bypass the preflight; 24 current senders grandfathered in `scripts/email-quality-baseline.json` (= the migration backlog, may only shrink). Wired into ci:gates; meta-gate clean (103 gates, 0 orphans).

Pre-existing reds fixed (inherited, not mine): **`ci:crm-lead-integrity`** (`58412f70`) was scanning `*.test.ts` fixtures as production lead paths (false-positive on `lib/followupboss.test.ts`) — now skips test/spec files.

Inherited red NOT touched (out of CRM scope): **`ci:hydration-safety`** shows 4 NEW #418 violations in `app/lp/buyer-listing-alerts/BuyerLPForm.tsx`, `app/lp/fsbo/FsboLPForm.tsx`, `components/ListingTile.tsx` — introduced by the concurrent **p1.x** date-format/hydration remediation track (last touch `8547a714`), whose own CI is red on them. Left for that track to finish; editing concurrently would clobber their in-flight work. None of the 6 CRM commits touch those files.

### 2026-06-22 · 9.1 code-side: no resend.dev sandbox in production — `f372f427`
`resolveFrom()` — explicit from → `RESEND_FROM` → in prod FAIL LOUD (never the sandbox; it lands in spam + fails DKIM) → sandbox only in dev. 4-case test. Assumes `RESEND_FROM` is set in Vercel (Matt confirms Resend set up). Next: 9.3 List-Unsubscribe + 9.E spam-quality linter/preflight.

### 2026-06-22 · 9.2 Resend webhook fixed (Svix HMAC + bounce→suppression) — `4b55bf6a`
First execution increment. The webhook verified signatures with a naive string-compare (rejected every real Svix event → no bounce ever recorded). Fixed: proper Svix HMAC (`lib/crm/resend-webhook.ts`, 13-case test incl. an independent signer + replay window + bounce/complaint/soft classification), and on hard bounce/complaint → `addSuppression({channel:'email'})` across all sibling rows sharing the email (`lib/data/crm/getPersonIdsByEmail.ts`). tsc clean, 843 tests, DAL boundary stable. Follow-up: confirm a real Resend test event in the dashboard post-deploy. Also added the **9.E email inbox-placement & anti-spam standing requirement** to the runbook (Matt directive).
