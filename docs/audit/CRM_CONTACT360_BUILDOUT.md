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

> Goal: close the loop on OUR data, not FUB's. *Flag: needs Meta creds; verify against the live Graph API carefully.*

- **5.1 `crm_people` → Meta Custom Audience uploader.** Today three **manual** scripts build audiences from **FUB** (`scripts/meta-rebuild-fub-audiences.mjs` et al.), with no cron; native-only leads can never enter an audience. Build a `crm_people`-sourced uploader (SHA-256 email/phone, segment by `owner_type`/`stage`/tags, **exclude `crm_suppressions`**), wire a weekly Vercel cron. *Flag:* Meta token + audience IDs.
- **5.2 Make the FB Lead-Ad webhook graph-aware.** `app/api/meta/lead-webhook` never reads `rr_vid`/`fbclid` or calls `stitchVisitorIdentity` — paid-form leads are invisible to the visitor graph and carry no `fbc`. On lead create, look up `visitor_sessions`/`rr_vid` by matched email/phone and stitch, so the lead inherits prior anonymous behavior + an attribution key.
- **5.3 `external_id = rr_vid`.** The pixel (`components/MetaPixel.tsx`) fires PageView with no `external_id`, contradicting the middleware comment. Set `rr_vid` as `external_id` on both `fbq` init and CAPI `user_data` so anonymous PageViews carry the durable cross-event id.
- **5.4 Auto-fire offline conversions.** `lib/meta-offline-conversions.ts` is admin-manual, so Meta optimizes for cheap form-fills, not closings. Add a CRM/Vault stage-change hook (listing_signed/under_contract/closed) → resolve the stored `fbc` via the resolver → `uploadOfflineConversion`. *Flag:* business call on the closed-deal→fbc join + Meta creds.

---

## Phase 6 — Bulk operations

> Goal: multi-select → enroll/email/tag/assign/stage across the list. *Bulk SENDS are TCPA-bearing — build the safe ops first, FLAG sends for Matt's go.*

- **6.1 Selection island.** Convert the read-only `app/admin/console/leads/page.tsx` to a thin client island (mirror `PhotoCurationBoard`): checkbox column + mobile-card checkbox, "N selected" bar, **"Select all M matching filter"** via a capped, id-only server query (never enumerate unbounded ids into the browser).
- **6.2 Fan-out + audit.** Bulk actions **loop the existing single-person primitives** (`manualEnrollPerson`, `sendCrmEmailAction`, `sendCrmSmsAction`, tag/assign/stage) so per-recipient `isSuppressed`/A2P/fail-closed come for free — never a new Twilio/Gmail loop. New `crm_bulk_jobs` table (actor, action, filter snapshot, per-recipient sent/suppressed/failed tallies).
- **6.3 Compliance rails.** Every bulk send: a **preview** ("34 will receive, 4 suppressed, SMS held until A2P / outside 8a-9p → queued"). A **marketing-consent / established-relationship gate on bulk email** (suppression alone won't stop a broker blasting the 18K pre-epoch book). **Broker-scope re-filter server-side** (never trust client-sent ids). **Enqueue large sends** to a `crm_bulk_jobs` cron-drain (a synchronous 500-row send hits quiet-hours/timeout/rate-limit). Irreversible sends get a typed-count hard confirm.
- **6.4 FLAG:** the actual bulk-send wiring goes behind Matt's explicit go.

---

## Sequencing & flags summary

- **Build now (safe, additive, verifiable here):** 0.1–0.6, 1.1–1.3, 2.1–2.3, 2.6–2.7, 3.1–3.3, 4.1–4.4, 6.1–6.2.
- **Flag for Matt's go / needs creds or a decision:** 0.7 (DB-nightly), 2.4–2.5 (BatchData/Google cost), 5.1–5.4 (Meta creds + privacy + business call), 6.3–6.4 (bulk sends = TCPA), and anything that flips intake to native-first at the FUB cutover.
- **TCPA/compliance invariants are never weakened** by any increment: the suppression chokepoint, A2P hard-gate, fail-closed, quiet hours, and consent-on-every-send stay green (`ci:crm-sms-safety` / `ci:crm-fail-closed` / `ci:sms-consent`).
