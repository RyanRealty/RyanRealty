# CRM Contact-360 + Lead-Tracking + Audience Flywheel — Build Runbook

**Status:** plan-of-record for the self-owned CRM contact experience. Execute via `/loop`.
**Progress log:** `docs/audit/CRM_CONTACT360_PROGRESS.md` (append every increment).
**Grounded in:** four read-only investigation sweeps (CRM cutover, Contact-360, flywheel) — every step below cites the file it touches; nothing here is aspirational.

---

## North star

A broker opens one contact and sees, thoughtfully laid out: **photo · name · contact info · source · which workflows/newsletter/listing-alerts they're on (as one-click toggles) · an ownership summary with a (correct) photo of their home · and above all a single unified feed of every communication and website action.** Underneath: every lead is reliably captured and tracked, and our lead database powers Facebook audiences whose clicks stitch back — via cookie + Google sign-on — to that same contact and their on-site behavior.

## Standing loop rules (every increment)

1. **Read before editing.** Open the cited files first.
2. **Build the minimal slice**, additive and reversible.
3. **Verify:** `npx tsc --noEmit` (source-clean) + the relevant `ci:*` gate + affected `vitest` (+ a `next build` when the change touches the client/server graph, a `'use client'` component, or `instrumentation`). Add a negative-test fixture for any new gate logic.
4. **Commit** with an `Approved-by: matt` trailer + the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` line. `git pull --rebase origin main` then push. Update the progress log.
5. **FLAG, don't blind-push**, anything that: sends to a live lead (SMS/email at volume), touches A2P/TCPA, requires Meta/BatchData creds or a running app to verify, ports the number, or flips lead intake to native-first. Surface those for Matt's explicit go.
6. Trunk only (`main`), no branches. Mobile-first on every admin surface (`ci:admin-mobile-shell` + `ci:admin-responsive` — every table needs a `md:hidden` card fallback). Design-system components only (`@/components/ui/*`, navy/cream, Amboqia headings).
7. End each loop iteration with a status dashboard (phase, increments shipped, gates green, what's flagged).

## The keystone fact

The auth.users-uuid "identity fork" is **currently theoretical** — `profiles` and `saved_searches` are both **0 rows**, and only **1 of 18,189** `crm_people` is native. So today everything keys on `fub_legacy_id → fub_person_id`. The bridge work (Phase 1) is **forward-looking insurance for the FUB cutover**, not unblocking existing data. The *urgent* problems are: the home-photo bug, lead-capture leaks, the write-only identity graph, and faked ownership data. Sequence the phases accordingly.

---

## Phase 0 — Lead-tracking completeness (the foundation)

> Goal: every intake that yields an email OR phone (or a sustained high-intent anonymous session) produces exactly one tracked `crm_people` row with a non-null `source`, independent of FUB. Make leaks impossible to ship undetected.

- **0.1 Close the voice leak.** `app/api/twilio/voice/route.ts` + `voice-complete/route.ts` only log a timeline when `lookupPersonByPhone` matches; an unknown caller (highest-intent signal) creates **no lead**. Mirror the inbound-SMS pattern: on miss, INSERT `crm_people {source:'inbound-call', assigned:matt, phones}` + `crm_contact_points` + a `call` timeline row + a broker alert, before forwarding. *Gate:* `ci:crm-lead-integrity`; vitest on the create path. *Acceptance:* an unknown inbound call yields a `crm_people` row.
- **0.2 Native-capture fallback (the independence fix).** Every LP/contact/CTA action creates `crm_people` only *after* a successful FUB `sendEvent` → `mirrorSiteEvent` (`lib/followupboss.ts:907`, `lib/crm/mirror.ts`). If FUB is down, the lead exists nowhere. Add: when `sendEvent` returns `ok:false`, write the `crm_people` row directly (preserving source + canonical tags), let the delta cron reconcile to FUB later. *This is what makes the parallel CRM actually independent — it's a precondition for the FUB cutover.* *Gate:* new vitest simulating `sendEvent` failure → row still created. *Acceptance:* a forced FUB failure on the seller LP still tracks the lead.
- **0.3 Convert sustained hot-anonymous into a durable record.** `app/api/cron/visitor-hot-lead-escalation/route.ts` emails Matt ("no FUB record yet") and sets `hot_lead_fired_at` but creates nothing. When an anonymous session crosses the high threshold and carries any contactable signal, write a durable record (a `crm_people` `source:'anonymous-hot'` lead, or an `anonymous_lead` row) so it's reconcilable + remarketing-addressable. *Acceptance:* a hot anonymous session is queryable as a lead, not just an email.
- **0.4 Resolve the native-create stubs.** `lib/data/leads/createSellerLead.ts / createBuyerLead.ts / createExpiredLead.ts` throw `NotImplementedError`. Either implement them as the single FUB-first-with-native-fallback chokepoint (preferred — folds 0.2 in) or delete them so no caller can crash. *Gate:* `ci:dead-ui` / grep no `NotImplementedError`.
- **0.5 Alarm the kill switch.** `CRM_MIRROR_ENABLED=false` (`lib/crm/mirror.ts:25`) silently stops all mirror-path `crm_people` writes. Emit a loud health/startup warning when it's off. *Acceptance:* disabling the mirror surfaces a warning, not silence.
- **0.6 First-touch UTM fallback.** LP source attribution parses `utm_*` from the `referer` header — lost on intra-site navigation or a stripped referer. Fall back to the first-touch `visitor_sessions` row's stored UTMs (keyed by `rr_session_id` passed in the submission). *Acceptance:* a same-session intra-site submit still carries `channel:fb-ads`.
- **0.7 The lead-coverage gate (`ci:lead-coverage`, DB-backed, nightly — like `ci:data-access`, NOT in the static chain).** Reconcile, over a trailing window: every `processed_meta_leads(status='completed')` → a `crm_people` row; every `valuation_requests`/`guest_search_alerts.fub_person_id` → a `crm_people` via `crm_contact_points`; every `visitor_sessions.identified_at NOT NULL` → a `crm_people`; and **zero** `crm_people` with null `source`. Fail above a tolerance. *This is the durable guarantee that capture never silently leaks.* *Flag:* needs DB creds — run nightly + locally.

---

## Phase 1 — Identity keystone (resolver + bridge columns)

> Goal: one resolver so every enrichment panel works from a `crm_people.id` regardless of which id minted the data — the precondition for native leads under the FUB cutover. Forward-looking, additive, build-verifiable.

- **1.1 Bridge columns.** Add `crm_person_id bigint REFERENCES crm_people(id)` to `fub_person_geo`, `visitor_sessions`, `visitor_events`; backfill via `crm_people.fub_legacy_id = fub_person_id`. Add `crm_person_id` to `visitor_identity_map`. *Migration applied to hosted Supabase in the same delivery (per AGENTS production-parity).*
- **1.2 `resolvePersonIdentity()`** (`lib/data/crm/resolvePersonIdentity.ts`): given any of `{crmPersonId, email, phone, rr_vid, fubPersonId, authUserId}` → `{crmPersonId, fubLegacyId, emails[], phones[], authUserId|null, sessionIds[]}`. The fub-independent join key is **normalized email/phone** (lowercased email / last-10 phone). Reads `crm_contact_points` + `visitor_identity_map` (which is currently **write-only — make it read**) + `auth.users`-by-email. *Gate:* vitest with fork fixtures (native-only, fub-only, both).
- **1.3 Refactor the getters.** `getCrmPersonFull` (`app/actions/crm.ts:326-393`) + `getViewedListingsForLead` + the geo/CMA/visitor reads switch from `.eq('fub_person_id', fubLegacyId)` to `.eq('crm_person_id', person.id)` with a `fub_person_id` fallback, consuming the resolver bundle instead of a bare `fubId`. *Acceptance:* a native lead (no `fub_legacy_id`) renders geo + web activity instead of blanks. *Verify with `next build`.*

---

## Phase 2 — Contact-360 view + ownership + behavior

> Goal: the thoughtful single pane. Activity-first; ownership correct, not approximate.

- **2.1 Unified `<ContactActivityFeed>`** (`components/console/ContactActivityFeed.tsx`). Merge `crm_timeline` (13 kinds, native-keyed) + bridged `visitor_events` into ONE reverse-chron list server-side. Per row: channel icon token (outbound=navy, inbound=cream, system=outline), title, 2-line snippet, tabular timestamp + broker avatar. Threads (sms/email in+out) render as an inline chat sub-thread with open/click as an engagement footnote; calls/voicemails get play + duration + "Show transcript"; web events compact. Day-group with sticky headers; **collapse web-event storms** into one accordion; **hot-lead becomes a prominent row**. Channel filter tabs (All/Messages/Calls/Email/Website/Notes), expand-for-detail, cursor "Load older" (today caps at 100 silently). Dedupe double-sourced `web_event` rows; collapse per-hit `email_open` into the parent. One PT tz helper. *Gate:* `ci:admin-responsive` (md:hidden card fallback). *Verify `next build`.*
- **2.2 Ownership panel — FIX the photo bug (highest severity).** `getOwnedHomeMatches` (`lib/data/crm/getOwnedHome.ts:34`) matches a ~40m lat/lng box with **no address compare** → 38/40 sampled owners had multiple listings in-box → it can render a **neighbor's house**, and the "on the market now" alert can falsely imply the lead is selling. Parse `street_number`+`street_name` from `geo.formatted_address` and require equality; return a `confidence: 'exact'|'nearby'|'none'` and only show an MLS photo on `'exact'` (else satellite/Street-View from `lib/crm/owned-home-media.ts`, labeled). Gate the "on the market now" alert on exact match too. *Gate:* new vitest on the address matcher. *Acceptance:* a multi-listing-box owner never shows a wrong photo as "their home".
- **2.3 Real `owner_type`.** `lib/lead-geocode.ts:204` hard-sets `owner_type='occupied'` from `source_type='mailing'` (2,235/2,242 rows meaningless). Replace with derived occupancy: compare mailing vs property address (absentee when they differ, out-of-state when `state!=OR`) — lift the logic already in `lib/expired-owner-lookup.ts`. *Acceptance:* an absentee owner no longer renders "occupied".
- **2.4 Property attributes for never-listed homes.** Beds/baths/sqft/year/last-sold/est-value only exist if the address was ever in `listing_tile_mv`. When no MLS match, fetch parcel/AVM (Deschutes DIAL / BatchData — already integrated in the expired path) and persist new columns on `fub_person_geo`. *Flag:* BatchData creds + cost; cap per run.
- **2.5 Geocode coverage cron.** Only ~12% (2,242/18,189) have a geo row; no recurring geocode. Add `/api/cron/geocode-backfill` over `crm_people` with a mailing address and no `fub_person_geo` row, batched `geocodeAndTagLead` (~$0.005 each; full ~15.5k ≈ $80), capped per run. *Flag:* Google Geocoding cost.
- **2.6 Behavior/intent summary panel.** `engagement_score`, `peak_score`, `intent_tags`, `hot_lead_fired_at` recency, last N page/listing/search events, first-touch UTM — from the merged visitor data the resolver now loads. *Note:* behavior coverage is tiny today (210 sessions) because most traffic is still on WordPress; this lights up as traffic moves to the Next.js surface.
- **2.7 Identity strip + source.** Render the linked-keys strip (FUB · web-visitor · account · N emails as badges), promote `source` + `source_url` (fetched, never rendered) into the header, add a CMA-history panel (`cma_deliveries` is fetched but rendered nowhere).

---

## Phase 3 — Memberships + one-click toggles

> Goal: read AND change membership in one tap. Compliance stays decoupled — the send path re-checks consent on every send, fail-closed.

- **3.1 Listing-alerts UNION.** Merge `guest_search_alerts` (shown today) **and `saved_searches` (never shown)** via the resolver, dedupe by `filters_hash`, normalize `is_paused` vs `is_active` so the toggle isn't backwards. Reuse `getFiltersSummary` (`lib/search-filters.ts`) for the human label + `buildSearchUrlFromFilters` deep link. (Today the page hand-rolls `describeSearch`.)
- **3.2 Newsletter detail.** Show frequency/last-sent/open-rate; distinguish unsubscribed/bounced (warning badge) from never-subscribed (the `+` add) — today they look identical.
- **3.3 The toggles.** `Switch` per membership (optimistic): workflow ON `manualEnrollPerson` / OFF `stopEnrollment`; newsletter ON subscribe + write a consent event / OFF unsubscribe; listing-alert ON/OFF `is_active`/`is_paused`. New membership = a one-tap picker (workflow) or compact criteria form (alert) that becomes a switch. SMS steps render greyed "awaiting consent" so the broker sees the gate, not a silent no-op. *Acceptance:* toggling enrolls/unenrolls instantly; an unconsented contact toggled into an SMS workflow still can't be texted.

---

## Phase 4 — Relationships

> Goal: FUB-style "married / co-buyer / referrer" links, bidirectional, click-through.

- **4.1 Schema + vocab.** `crm_relationships` exists (29 rows, **all `related_person_id` NULL**, dirty `kind`). Add `UNIQUE(person_id, related_person_id, kind)` + `CHECK(person_id <> related_person_id)`. Type vocabulary in TS: `{key,label,inverseKey,symmetric}` — symmetric (spouse/partner/sibling) vs directional (parent↔child, agent↔client, referrer↔referred).
- **4.2 Actions.** `linkCrmRelationship/unlink/setType` in `lib/crm/relationships.ts` — write the **reciprocal row** for symmetric/inverse types so "married" shows on both records; add a `getCrmPersonFull` relationships field.
- **4.3 UI.** A Relationships card + `RelationshipPicker` (`components/admin/crm/RelationshipPicker.tsx`, a `Command` combobox over `listCrmPeople`). Render legacy NULL rows honestly ("unlinked / resolve").
- **4.4 Backfill + dedup guard.** Re-resolve the 29 legacy rows (FUB id / fuzzy surname+contact-point). When a candidate shares surname + email/phone/address, surface "possible duplicate — merge instead?" so the graph doesn't accrete duplicate people.

---

## Phase 5 — Audience flywheel (lead DB → FB ads → cookie/sign-on → behavior)

> Goal: close the loop on OUR data, consent-gated, observable, and ROAS-attributed. **Depends on Phase 8 (consent) for legal cover and Phase 1 (resolver).** *Flag: live audience writes + the closed-deal→value model need Meta creds + Matt's go; build behind `test_event_code` dry-runs first.*

**Audience engine (5.1–5.3):** Today the engine is **four manual `.mjs` scripts**, FUB-sourced, no cron, no DB-of-record, and — the load-bearing gap — **gated on FUB tags, NOT `crm_suppressions`** (5,158 opt-outs: 3,228 tcpa-hard-stop, 1,095 do-not-call, 694 do-not-email, 141 do-not-text it never excludes). Strong builder (`scripts/meta-rebuild-audiences-from-fub.mjs`) has the correct 4-key SHA-256 schema to port.

- **5.1 `crm_people`→Meta uploader, in-app + consent-gated.** `lib/meta/audience-uploader.ts` (TS, behind `getMetaPageToken`): the proven 4-key multi-key rows (EMAIL/PHONE/LN_FN_ZIP/LN_FN_CT_ST SHA-256, correct normalization), `findOrCreateAudience`, session-based `pushUsers` (≤5000/batch, persist `num_received`/`num_invalid`), and **`deleteUsers` for opt-out removal** (CCPA requires shrinking a live audience, not just stopping adds). `lib/data/crm/getAudienceMembers.ts` segments from `crm_people`⋈`crm_contact_points` and **excludes via the SAME `crm_suppressions` exclusion the send path uses** (factor the tag→channel map into one shared const so audience + send consent can't drift). A `meta_custom_audiences` ledger (audience_id, segment_key, role, rows_pushed, num_received/invalid, approx_count, permission_ack_at, last_synced_at).
- **5.2 Audience cron + size monitor + token fix.** `/api/cron/meta-audience-rebuild` (requireSecret, nodejs): incremental by `crm_people.updated_at` since last run + apply **suppression deltas (DELETE opted-out)**, monthly full; read back `approximate_count_lower_bound`/`operation_status` and auto-downgrade any direct-target <1,000 matches to LAL-seed-only. Pin Graph v25. **Fix the token model (FLAG):** the strong builder uses a hand-minted 60-day user token with no refresh (`token-heartbeat` only pings the Page token) — either move audience writes to the never-expiring System-User Page token (confirm `ads_management` on the ad account) or add an `fb_exchange_token` refresh leg + T-7d alarm.
- **5.3 Lead-webhook identity stitch + external_id.** `app/api/meta/lead-webhook` never reads `rr_vid`/`fbclid` or calls `stitchVisitorIdentity` — paid-form leads carry no attribution key. Stitch on lead-create by matched email/phone. Set **`external_id = rr_vid`** on both `fbq('init', ID, {external_id})` advanced matching AND every CAPI `user_data` (the single biggest match-quality + cross-event-identity win; absent everywhere today).

**CAPI/attribution (5.4–5.6):** dedup IS wired on the seller Lead path (shared `eventID`), PII SHA-256-hashed + G48-locked. Gaps are match-quality, reliability, and the offline loop.

- **5.4 Match-quality parity + dedup everywhere.** `lib/data/leads`/`lib/lead-capture.ts` `fireCapiLead` forwards **no `fbc`/`fbp`/client IP/UA** → every non-seller lead hits Meta with Vercel's egress IP. Bring all CAPI fires to seller-path parity (read `cookies()`/`headers()` in the server action). Add a CAPI mirror + shared `eventID` to `trackListingClick` (today undeduped, server-blind).
- **5.5 fbc persistence + auto offline conversions (close the ROAS loop).** Persist the assembled `_fbc` (`fb.1.<ts>.<fbclid>`, not raw `fbclid`) on `visitor_sessions` + new `crm_people.fbc/fbclid/fbc_captured_at` columns, propagated at identify via `stitchVisitorIdentity`. Then a cron/Vault stage hook (listing_signed→Lead / under_contract→StartTrial / closed→Purchase) resolves the stored `fbc` via the resolver and `uploadOfflineConversion` with a **deterministic idempotent `event_id`**, event_time within the 7-day window, LDU passthrough. *FLAG: the closed-deal→value (commission vs sale price) model steers ad spend — Matt's decision; `test_event_code` dry-run + sample to Matt before enabling real.*
- **5.6 CAPI reliability + observability.** Replace **200-on-failure-with-`console.warn`** (a revoked token drops 100% of conversions silently) with a `meta_capi_log` (event_name, event_id, ok, http_status, fbtrace_id, events_received, host, payload_hash); bounded retry/backoff on transient 5xx (offline path first — it's cron-safe); pin Graph v25 across CAPI+offline; an EMQ/delivery reconciliation cron alerting when daily success drops below threshold.

---

## Phase 6 — Bulk operations

> Goal: multi-select → enroll/email/tag/assign/stage across the list. *Bulk SENDS are TCPA-bearing — build the safe ops first, FLAG sends for Matt's go.*

- **6.1 Selection island.** Convert the read-only `app/admin/console/leads/page.tsx` to a thin client island (mirror `PhotoCurationBoard`): checkbox column + mobile-card checkbox, "N selected" bar, **"Select all M matching filter"** via a capped, id-only server query (never enumerate unbounded ids into the browser).
- **6.2 Fan-out + audit.** Bulk actions **loop the existing single-person primitives** (`manualEnrollPerson`, `sendCrmEmailAction`, `sendCrmSmsAction`, tag/assign/stage) so per-recipient `isSuppressed`/A2P/fail-closed come for free — never a new Twilio/Gmail loop. New `crm_bulk_jobs` table (actor, action, filter snapshot, per-recipient sent/suppressed/failed tallies).
- **6.3 Compliance rails.** Every bulk send: a **preview** ("34 will receive, 4 suppressed, SMS held until A2P / outside 8a-9p → queued"). A **marketing-consent / established-relationship gate on bulk email** (suppression alone won't stop a broker blasting the 18K pre-epoch book). **Broker-scope re-filter server-side** (never trust client-sent ids). **Enqueue large sends** to a `crm_bulk_jobs` cron-drain (a synchronous 500-row send hits quiet-hours/timeout/rate-limit). Irreversible sends get a typed-count hard confirm.
- **6.4 FLAG:** the actual bulk-send wiring goes behind Matt's explicit go.

---

## Phase 7 — Saved Searches & Saved Homes (the unified, person-anchored store)

> Goal: ONE store per concept that a CONSUMER fully self-manages AND a BROKER sees in full — a save belongs to a *person*, not to whichever identity they happened to use. **Sequence this RIGHT AFTER Phase 1 (resolver):** both saved-search tables are ~0 rows today (`saved_searches`≈0, `guest_search_alerts`≈0, `saved_listings`=2, `likes`=6), so the unification is nearly free NOW and gets harder with every save created under the split. Depends on `resolvePersonIdentity()` (1.2).

**The problem (mapped):** saves are filed under three identities — guest=email (`guest_search_alerts`, broker-visible, consumer can't manage), signed-in=auth uuid (`saved_searches`, consumer-managed, **broker-invisible**), and homes are triplicated (`saved_listings` + `likes` + `listing_collections`) with no anonymous path and a broker view that *regex-infers* "saved" from `visitor_events` instead of the real table.

- **7.1 Unified saved-search table.** Keep `saved_searches` as the base (richer: cache cols + public-share + owner-RLS); add nullable `email`, `crm_person_id`, keep `user_id`. **Email is the resolution anchor.** One canonical `filters_hash` everywhere (today `getSavedSearchHash` vs `stableHash` differ, so the "same" search never dedupes — fix to a single hasher). Migrate the handful of `guest_search_alerts` rows in; retire it as a separate concept (or a thin pre-auth write that upserts into the unified row). Reconcile `is_active` (guest) vs `is_paused` (saved) semantics so alerts don't double-fire or silently stop. *Migration applied to hosted Supabase same-delivery.*
- **7.2 Unified saved-home table.** Collapse `likes` into `saved_listings` (one heart/bookmark writes one table); add `email` + `crm_person_id` (+ keep `user_id`) so an **anonymous lead can heart a home and the broker sees it**; **fix the live bug** where `RemoveSavedButton` (`app/account/saved-homes/RemoveSavedButton.tsx`) is a silent no-op for liked-only homes (it only calls `unsaveListing`). *Acceptance:* every home on `/account/saved-homes` removes correctly.
- **7.3 Claim-on-sign-in.** On first login / account creation, `UPDATE saved_searches SET user_id=:uuid WHERE email=:authEmail AND user_id IS NULL` (and the same for saved-homes) so prior anonymous saves attach to the account **and stay broker-visible**. *Acceptance:* a guest who saves then signs in sees their searches in `/account`.
- **7.4 Consumer self-management — close the holes.** In `app/account/saved-searches/SavedSearchesList.tsx` add per-search: a **cadence** Select (instant/daily/weekly → writes `notification_frequency`, which the cron already honors), a **pause/resume** toggle (`is_paused`; today only the email unsubscribe sets it, with no resume), and an **edit-criteria** affordance (the `updateSavedSearch(filters)` action already exists; no UI exposes it). Have `createSavedSearch` set `notification_frequency` explicitly from the user's default instead of relying on the column default.
- **7.5 Kill the dead setting.** `/account/notifications` `savedSearchFrequency` writes a global `profiles.notification_preferences` value **no cron reads** — it lies to users. Either fan it out to every saved-search row on change, or demote it to a create-time default only; never leave a write-only control that implies it changed cadence.
- **7.6 Broker visibility — show the real saves.** On `app/admin/console/leads/[id]/page.tsx`, via the resolver, read the unified saved-search rows + the real `saved_listings`/`saved_communities`/`saved_cities`/`listing_collections` for the lead. **Stop inferring "saved" from `visitor_events` regex** — show the actual hearted homes + saved searches with `getFiltersSummary` human labels, deep links, last-sent, and the pause/resume + cadence toggles from Phase 3.1 (which now sit on the unified row). A broker "remove" and a consumer "remove" act on the same object.

*All of Phase 7 is build-now-safe (additive + a near-empty-table migration) and `next build`-verifiable. It is the foundation Phase 3.1 (listing-alerts UNION) sits on — once unified, "UNION two tables" becomes "read one table".*

---

## Phase 8 — Privacy & Consent (legal compliance — gates Phase 5)

> Goal: a defensible consent posture for the aggressive cookie + homeowner-PII-to-Meta model. **This is legal risk, not polish, and it gates the ads phase** — uploading hashed homeowner PII to Meta is a "sale/share" under CCPA/CPRA and **Oregon's OCPA (in force 2026-01-01)**, and today: there's **no GPC handling**, the consent banner is **hidden on landing pages while the Pixel fires**, ad-clicks **auto-grant** consent, and the privacy policy omits `rr_vid`/`rr_fbc`. Sequence this **with/just before Phase 5**.

- **8.1 GPC + consent gate on tracking.** Honor the `Sec-GPC` header / `navigator.globalPrivacyControl` as an opt-out that **overrides the auto-grant**, threaded into `app/api/visitors/track` and `/api/meta-capi` (LDU on when GPC/opt-out). *Acceptance:* a GPC request is not tracked and ships LDU to Meta.
- **8.2 Consent surface everywhere the Pixel fires.** The banner must render on **landing pages** too (today hidden there while the Pixel loads); no marketing tag fires before the consent decision (or fires LDU-limited until granted).
- **8.3 Disclose what's actually collected.** Update `/privacy` to name `rr_vid`, `rr_fbc`, the Meta Pixel + CAPI + **offline-conversion upload** of hashed PII, and the CCPA/OCPA "Do Not Sell/Share" right + how to exercise it.
- **8.4 Consent ledger + audience honoring.** A durable `crm_consent_events` record (action, channel, GPC state, source_url, ts) — the affirmative proof Phase 0.x/3.3 also need. A CCPA/OCPA opt-out must (a) exclude from new audience uploads AND (b) trigger `deleteUsers` from the live audience (5.1) — withdrawal removes membership, not just stops adds.
- **8.5 Harden the anchor.** `rr_vid` is non-httpOnly (needed client-side for external_id) — keep it opaque/rotating-safe and ensure no PII rides in it; the dual-host PKCE canonicalization (`ryan-realty.com` apex) stays so OAuth + cookie domains align.

## Phase 9 — Operational production layer (deliverability · observability · migration)

> Goal: keep the self-owned CRM **deliverable, observable, and safe to cut over**. This is the layer that separates "works in a demo" from "can replace FUB." Several items are the highest-leverage fixes in the whole plan.

**Deliverability:**
- **9.1 Email auth (HIGHEST leverage).** `mail.ryan-realty.com` is **unverified on Resend** → `lib/resend.ts` silently falls back to the `onboarding@resend.dev` **sandbox** in prod (rate-limited, lands in spam, failing DKIM banner). *FLAG (Matt — Cloudflare DNS):* add the Resend DKIM CNAME + SPF (`include:amazonses.com`) + return-path CNAME + a ramped DMARC (`p=none→quarantine→reject`, with `rua`); set `RESEND_FROM=noreply@mail.ryan-realty.com`. Then **remove the sandbox fallback in prod** (fail loud if unset).
- **9.2 Bounce/complaint → suppression (CAN-SPAM + reputation).** The Resend webhook today verifies the signature with a **naive string-compare** (rejects real Svix sigs / accepts spoofs) and only updates the newsletter table. Fix to proper **Svix HMAC**, and on hard `email.bounced`/`email.complained` resolve recipient→`crm_contact_points`→`addSuppression({channel:'email'})` + tag the person (across **all** sibling rows sharing the email). Soft bounces retry, don't suppress.
- **9.3 One-click unsubscribe.** Add RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` to `lib/resend` + `lib/crm/gmail` for **automated/bulk** sends (Gmail/Yahoo now require it) — never on a 1:1 broker reply.
- **9.4 SMS delivery receipts + governor.** Build `app/api/twilio/status` (the relay already wires the callback to a **404** today): validate the signature, upsert `MessageStatus`/`ErrorCode` onto the `sms_out` row by `MessageSid` (forward-only state), detect **30007/30008** carrier-filtering (today read as success) and auto-suppress on repeat. Add an **A2P throughput governor** (token-bucket honoring campaign MPS + daily cap) draining a queue instead of `BATCH=50` synchronous.

**Observability:**
- **9.5 `/admin/crm/health` board** (mirror `meta-health`, mobile-first): cards for send volume, delivery/open/**bounce (>2%)/complaint (>0.1%)**, opt-outs, **mailable audience size (suppression-net)**, A2P state, **relay heartbeat**, delta freshness, mirror-enabled, per-cron health — each green/yellow/red + action item.
- **9.6 `crm-health-check` cron + alarms** (email/iMessage to Matt) for: mirror disabled, delta stale >1h, relay heartbeat stale >5min, A2P not VERIFIED with queued sends, bounce/complaint spike, any CRM cron silent >2 intervals. Add a **relay heartbeat** (the mac-mini writes a row on each successful drain — reflecting a real SEND, not just the script running).

**Migration:**
- **9.7 FUB↔crm_people reconciliation + the zero-diff cutover gate.** Build `crm-fub-reconcile` (nightly): diff total count, per-source new-lead counts, and a field spot-check (stage/broker/email/phone/tags) over the window (with a settling lag) → `crm_reconciliation_runs {diff_count, mismatched_ids}`; compute the **14-consecutive-zero-diff** streak the blueprint requires. *This is the only thing standing between dual-run and a bad-data cutover.* *FLAG: FUB creds, nightly.*
- **9.8 Hardening.** Schedule-or-delete the orphaned `crm-smart-followups` cron; require a dedicated `EMAIL_TRACKING_SECRET` in prod (today silently falls back to the service-role key then `'insecure-dev-secret'`); seed known FUB bounces/unsubscribes into `crm_suppressions` at cutover so we don't re-mail the historical book.

## Phase 10 — Security, access control & broker reporting (cross-cutting)

> Goal: close the remaining production gaps so nothing's thin — authorization, the dual-host auth break, and the broker's daily reporting that today reads FUB.

- **10.1 Broker RBAC.** Every CRM read/mutation (single + bulk) re-applies the caller's `assigned_broker` scope **server-side** (never trust client ids); a superuser sees the whole book, a broker only theirs. Audit `app/actions/crm.ts` for any getter that returns cross-book data.
- **10.2 Service-role boundary.** Audience/suppression/admin reads of `auth.users`-RLS tables (`saved_searches`, `profiles`) go through the service client in `lib/data` only (G1), never the anon client; no PII or service-role key reaches a client bundle (the `server-only` markers from the audit already guard `lib/supabase/service.ts` + the DAL barrel).
- **10.3 Dual-host OAuth fix.** Keep the apex canonicalization so PKCE/cookies align; verify Google sign-in works on the canonical host and the `/api` cookie-absence on the alias doesn't break identify/stitch.
- **10.4 Broker reporting repoint.** The daily/weekly broker digests read the **FUB People API** and aren't even scheduled — repoint to `crm_people`/`crm_timeline` and schedule, so brokers keep their lead summaries through (and after) cutover.

---

## Sequencing & flags summary

- **Build now (safe, additive, verifiable here):** 0.1–0.6, 1.1–1.3, **7.1–7.6** (right after Phase 1 — tables near-empty NOW), 2.1–2.3, 2.6–2.7, 3.1–3.3, 4.1–4.4, 6.1–6.2, **8.1–8.5** (consent — code-side), **9.2–9.6, 9.8** (deliverability code + observability), **10.1–10.4** (security/RBAC + reporting), and the **code** sides of 5.1/5.3/5.4/5.6 behind a `test_event_code` dry-run.
- **Recommended order:** Phase 0 → 1 → **7** → 2 → 3 → 4 → **8 (consent, gates ads)** → **9 (ops: deliverability + observability + reconcile)** → 10 (security/reporting) → 6 → **5 (ads — last, behind consent + creds + Matt's go)**. Phase 8 precedes 5 because uploading homeowner PII to Meta without GPC/consent is a live legal exposure (CCPA + Oregon OCPA 2026-01-01). Phase 9.7 (reconcile) is the FUB-cutover gate.
- **Flag for Matt's go / needs creds, DNS, or a decision:** 0.7 + 9.7 (DB/FUB nightly) · 2.4–2.5 (BatchData/Google cost) · **9.1 (Cloudflare DNS for Resend — highest-leverage deliverability fix)** · 5.2 token authority + 5.5 closed-deal→value model + all live audience/offline writes (Meta creds, `test_event_code` dry-run + sample-to-Matt first) · 6.3–6.4 (bulk sends = TCPA) · anything that flips intake native-first at the FUB cutover.
- **TCPA/compliance invariants are never weakened** by any increment: the suppression chokepoint, A2P hard-gate, fail-closed, quiet hours, consent-on-every-send stay green (`ci:crm-sms-safety` / `ci:crm-fail-closed` / `ci:sms-consent`); audiences gate on the **same** `crm_suppressions` exclusion as sends (one shared const), and consent withdrawal **removes** audience membership.
