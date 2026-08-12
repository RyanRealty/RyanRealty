# Process: capture-and-attribute — Lead capture + attribution (machine)

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (every lead-bearing event fires the spine inline; a 15-minute
  sweep cron guarantees the completion state for anything the hot path missed)
- Verdict: **PROPOSAL (not a lock — P3 decides): KEEP** — this is the machine spine every
  visitor process completes INTO: all 26 `sendEvent` call sites (24 site doors, the Meta
  webhook, one dead caller — §10 D9) plus the portal-email door
  converge on one find-or-create chokepoint with one completion state, and killing or
  splitting it orphans the completion leg of `get-home-value`, `contact-form-inquiry`,
  `save-and-return.*`, `arrive-from-ad`, and the sign-in path at once. It is not mergeable
  into any single visitor process because four of its doors (auth, Meta lead form, portal
  email, admin/CRM captures) are not visitor journeys at all. Sub-proposal inside the KEEP:
  the attribution half (UTM → source label + paid tags; `?agent=` cookie) is honored on only
  a minority of doors today (§10 D1/D2) — P3/P4 should ratify "attribution is part of the
  capture contract on EVERY door" as this process's bar, not an LP-only feature.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

A visitor who asks Ryan Realty for anything — a valuation, a listing alert, a question, a
tour, a saved search, a sign-in — has that request land with the right broker carrying its
full context (what they asked, from which page, which ad, which broker's link), gets no
channel they did not consent to, and hears back fast instead of falling into a void. Serving
that fully advances the lead-created-and-working client step: the request's contact key
becomes exactly ONE deduped `crm_people` row — source-labeled, channel-tagged,
broker-assigned, SMS-consent-correct, and enrollment-decided — which is the substrate every
downstream process (nurture sequences, alert delivery, CMA production, broker follow-up)
reads.

## 2. Inception (what starts it)

**Trigger:** a lead-bearing event from ANY entry channel — an event carrying at least an
email or phone (anonymous events are deliberately skipped, §6). Four doors:

1. **Site actions (organic / paid / direct / internal).** 24 of the repo's 26
   `sendEvent` call sites (grep re-run this session; the other two are the Meta webhook —
   door 3 — and the dead `lib/crm/lead-router.ts:80`, §10 D9): contact form
   (`app/contact/actions.ts:93`),
   home-valuation CTA (`app/actions/lead-capture.ts:87` — plus its 4 sibling captures at
   `:180,293,407,533`), the valuation form (`app/home-valuation/actions.ts:131` —
   `submitValuationRequest`; its ONLY live mount is `/sell/valuation` via
   `app/sell/valuation/page.tsx:17,122` → `ValuationForm`
   (`app/home-valuation/ValuationForm.tsx:4,21`); `app/home-valuation/` has no page.tsx
   and the legacy `/home-valuation` path 301s to `/sell/valuation`,
   `next.config.ts:217` — §9.8), paid LPs (`app/lp/seller-home-value/actions.ts:133,376`,
   `app/lp/fsbo/actions.ts:173`, `app/lp/expired-listing/actions.ts:145`,
   `app/lp/buyer-listing-alerts/actions.ts:206`, `app/lp/tetherow/heath/actions.ts:127`),
   saved searches (`app/actions/saved-searches.ts:182`), alert capture
   (`app/actions/search-alert-capture.ts:103`), open-house RSVP
   (`app/api/open-houses/rsvp/route.ts:88`), CMA download (`app/actions/cma-download.ts:119`),
   homepage/lead-landing/agent-page/CTA/PDF captures (`app/actions/home.ts:243`,
   `app/actions/lead-landing.ts:84`, `app/actions/agents.ts:289`,
   `app/actions/track-cta-click.ts:50`, `app/api/pdf/cma/route.ts:92`), an admin-plane
   capture (`app/actions/crm.ts:1370`), and one orphaned pipeline
   (`app/actions/track-contact-agent.ts:49` — §10 D8).
2. **Auth sign-in/sign-up.** `trackSignedInUser` fires on email sign-in/sign-up
   (`app/actions/auth.ts:116,152`) and on the OAuth/magic-link callback
   (`app/auth/callback/route.ts:136,169`), routing to `ensureNativeLead`
   (`lib/followupboss.ts:147-176`).
3. **Paid off-site (no site visit).** The Meta lead-form webhook captures Instant Form
   leads (`app/api/meta/lead-webhook/route.ts:440`, dedupe on `processed_meta_leads`
   PK `route.ts:512-519`).
4. **Portal emails (Zillow / Realtor.com → matt@).** The `crm-portal-lead-intake` cron
   scans the mailbox every 15 min (`vercel.json:49-50`, schedule `6,21,36,51 * * * *`;
   `app/api/cron/crm-portal-lead-intake/route.ts:28-40,61-138`).

**Attribution pre-steps (run before any capture, on every site route):**
`IdentityBridges` is mounted globally (`components/site/providers/IdentityBridges.tsx:19-27`
→ `RootProvider.tsx:34` → `app/layout.tsx:135`): `?agent=<slug>` →
`rr_agent_attribution` cookie, 90-day (`components/AgentAttributionBridge.tsx:6-17`;
slug variants normalized in `lib/agent-attribution.ts:27-40`); email-click identity
`?_pid` / `?_fuid` → `rr_pid` cookie (`components/PersonIdentityBridge.tsx:27-53`;
cookie constant `app/actions/identity-bridge.ts:31`, server read `:195`). UTMs are not
cookied — each server action re-parses them off the referer at submit time
(`app/lp/seller-home-value/actions.ts:290-308`; `app/contact/actions.ts:80-91`).

**Preconditions:** none — all doors accept anonymous-until-now visitors. **NOT this
process:** anonymous page-view tracking (`visitor_sessions`/`visitor_events`) — a no-key
event resolves to nothing by design (`lib/followupboss.ts:110-112`;
`lib/data/crm/ensureNativeLead.ts:109`); inbound phone/SMS capture
(`findOrCreatePersonByPhone`) belongs to `broker-direct-call-text`; what the sequences SEND
after enrollment belongs to the nurture/delivery plane (`crm-sequence-engine`
`vercel.json:57-58`, `crm-scheduled-sends` `:53-54`).

## 3. Actors

- **Visitor segments:** every segment the site serves — sellers (valuation/LP doors),
  buyers (alerts, saved searches, RSVPs, tours), signed-in browsers (auth door), and
  off-site ad respondents who never visit the site (Meta Instant Forms). Audience is
  inferred, not asked: from the event type at capture (`lib/followupboss.ts:117-123`) and
  from the caller's own classification at enrichment (`app/contact/actions.ts:153`;
  `app/api/meta/lead-webhook/route.ts:384-385`). Device reality from GA4: **not pulled
  this session — gap** (§11).
- **Automated actors:** the `crm-auto-enroll` sweep (every 15 min, `vercel.json:25-26`
  schedule `4,19,34,49 * * * *`; `app/api/cron/crm-auto-enroll/route.ts:39-183`); the
  `crm-portal-lead-intake` cron (§2.4); the Meta webhook receiver; the `crm-alert-drain`
  cron delivering queued broker texts every minute (`vercel.json:21-22`); post-response
  `after()`/fire-and-forget enrichment blocks (`app/contact/actions.ts:148-188`;
  `lib/canonical-lead-tagger.ts:267-270`).
- **Accountable for completion:** the assigned broker — resolved attributed-cookie-first
  (`app/lp/seller-home-value/actions.ts:214-220`), else the lead-routing engine, seeded
  `all_to_one` with fail-safe `'matt'` (`lib/crm/lead-routing.ts:34,85,110-116`;
  `lib/canonical-lead-tagger.ts:79-95`). The system owner for the machinery itself is Matt
  (portal mailbox is `matt@ryan-realty.com`,
  `app/api/cron/crm-portal-lead-intake/route.ts:28`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Lead identity (one row per human) | `public.crm_people` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2112`; created/reused by `ensureNativeLead` (`lib/data/crm/ensureNativeLead.ts:158-278`; DAL export `docs/DAL_INDEX.md:707-709`) |
| Dedupe keys (normalized email / last-10 phone) | `public.crm_contact_points` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:1849`; email-first lookup `lib/data/crm/ensureNativeLead.ts:133-149,164-172` |
| Attribution + segmentation (source label, `audience:*`, `channel:*`, `campaign:*`, `ad-content:*`, `broker:*`) | `crm_people.source` + `crm_people.tags` | label `lib/crm/lead-source.ts:37-41`; paid tags `:53-64`; canonical set `lib/canonical-lead-tagger.ts:237-243`; written via `enrichNativeLead` (`lib/data/crm/ensureNativeLead.ts:370-432`) |
| Assignment ledger (audit of who got which lead) | `public.marketing_assignments` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:3496`; upsert per (person, audience, source) grain `lib/canonical-lead-tagger.ts:97-125` |
| SMS-consent state | `public.crm_suppressions` (channel `sms`, reason `no-sms-consent`) | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2370`; fail-closed write `lib/crm/enroll.ts:290-305` |
| Enrollment decision | `public.crm_sequence_enrollments` + `crm_timeline` 'Enrolled' row | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2286,2445`; insert `lib/crm/enroll.ts:154-169` |
| Origin story (why this lead exists) | `crm_timeline` note rows | `lib/data/crm/ensureNativeLead.ts:417-428`; portal notes idempotent on `dedupe_key` `app/api/cron/crm-portal-lead-intake/route.ts:151-158` |
| Portal-intake cursor + run ledger | `public.crm_imports` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2047`; cursor discipline `app/api/cron/crm-portal-lead-intake/route.ts:162-172` |
| Meta webhook dedupe | `public.processed_meta_leads` (PK on leadgen_id) | `docs/DATABASE_SCHEMA_SNAPSHOT.md:3880`; `app/api/meta/lead-webhook/route.ts:512-519` |
| Anonymous→known stitch | `visitor_sessions` / `visitor_identity_map` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:4958,4941`; stitched by `backfillSessionToFub` (called `app/contact/actions.ts:176-183`, `app/lp/seller-home-value/actions.ts:442-450`) |

**Explicitly NOT a SoR:** Follow Up Boss (decommissioned 2026-06-24; the whole module is a
native shim — `lib/followupboss.ts:1-34`); the `rr_*` cookies and localStorage session id
(client-side hints that feed the SoRs, not records); GA4 / Meta CAPI (conversion mirrors
owned by the door processes); `valuation_requests` (an artifact of `get-home-value`, written
beside — not by — this spine, `app/lp/seller-home-value/actions.ts:338-361`); the legacy
dual-write chokepoint `lib/crm/lead-router.ts` (zero callers — §10 D9).

## 5. End-to-end path (inception → completion)

Happy path = a site-door form submit (the seller LP as the fullest exemplar). Off-site
doors in §9. Device = whatever the door's page serves; machine steps are device-less.

1. **Stamp attribution context** · browser · on ANY page load with `?agent=` the bridge
   writes the 90-day `rr_agent_attribution` cookie
   (`components/AgentAttributionBridge.tsx:12-17`); `?_pid`/`?_fuid` identifies the visitor
   and stamps `rr_pid` (`components/PersonIdentityBridge.tsx:31-53`) · failure: none
   blocking — bridges are render-null client components in one Suspense boundary
   (`components/site/providers/IdentityBridges.tsx:19-27`).
2. **Submit** · visitor · a door's form posts to its server action with contact fields +
   `sessionId` (rr_session_id) + optional `smsConsent`
   (`app/lp/seller-home-value/actions.ts:40-71`) · failure: door-level validation (e.g.
   address required `:263-264`; email-or-known-identity required `:325-330`).
3. **Parse inbound attribution** · server · UTMs read off the referer URL; passthrough
   query built for the lead's sourceUrl (`app/lp/seller-home-value/actions.ts:290-308`;
   same shape `app/contact/actions.ts:80-91`) · failure: malformed referer → no UTMs,
   never throws.
4. **Resolve source label** · server · LP doors map `utm_source` → a clean channel label
   for `crm_people.source` (`Facebook`, `Google`, …) with the LP's own name as the
   organic/direct fallback (`lib/crm/lead-source.ts:37-41`; consumed at
   `app/lp/seller-home-value/actions.ts:379`, `app/lp/expired-listing/actions.ts:148`,
   `app/lp/fsbo/actions.ts:176`, `app/lp/buyer-listing-alerts/actions.ts:209`,
   `app/lp/tetherow/heath/actions.ts:128` — grep this session) · failure: **non-LP doors
   skip this step entirely** (§10 D1).
5. **Capture** · server · `sendEvent` infers audience from the event type, builds
   `audience:*`/`source:*` tags, allowlists any `brokerAttribution` slug, and calls
   `ensureNativeLead` (`lib/followupboss.ts:101-131`) · output: the native person id, or
   null for a no-key event · failure: caught; callers run a direct-`ensureNativeLead`
   fallback so a blip never loses the lead (`app/contact/actions.ts:118-138`;
   `app/lp/seller-home-value/actions.ts:417-433`;
   `app/api/meta/lead-webhook/route.ts:556-561`).
6. **Find-or-create (the dedupe decision)** · system · normalize email (lowercase) +
   phone (last-10); email-first lookup in `crm_contact_points`, then phone; when BOTH
   match different people, attempt a high-confidence auto-merge before anything else
   (`lib/data/crm/ensureNativeLead.ts:159-199`); reuse → tags UNIONED + source/broker
   refreshed (`:212-224,298-341`); create → person row + contact points from the shared
   canonical builder (`:230-277`); no usable key → skip, personId 0 (`:109,226-228`) ·
   failure: every leg logs and returns best-effort — the visitor's response never breaks.
7. **Assign the broker** · server · attributed cookie first (server read
   `app/actions/agent-attribution-read.ts:20-33`, parse
   `lib/agent-attribution.ts:78-88`), else the routing engine — seeded `all_to_one`,
   fail-safe `'matt'` (`lib/crm/lead-routing.ts:34,85,110-116`) · consumed at
   `app/lp/seller-home-value/actions.ts:214-220,336` and inside create
   (`lib/data/crm/ensureNativeLead.ts:238-241`) · failure: never throws; defaults to matt.
8. **Enrich** · server/`after()` · canonical tags (`audience:*` + `<audience>:<tier>` +
   `source:*` + `broker:*` + paid `channel:/campaign:/ad-content:` tags), custom fields,
   and the origin note — either inline (`app/lp/seller-home-value/actions.ts:466-576`,
   paid tags `:501-505`) or via `canonicallyTagLead`
   (`lib/canonical-lead-tagger.ts:217-276`; hard-stop gate `:229-232`) → one
   `enrichNativeLead` write + the `marketing_assignments` upsert · failure: caught +
   logged; tags lost here are repaired by nothing (the sweep only enrolls — §10 D3
   inherits contact-PDS D2).
9. **Consent + enroll + alert** · system · `autoEnrollByFubId` (accepts native ids,
   `lib/crm/enroll.ts:274-283`): (a) SMS consent fail-closed — suppression removed then
   re-added unless the form's checkbox was actively checked (`:290-305`); (b)
   `autoEnrollPerson` gates — post-epoch only (`:49-50`), outreach-list sources never
   (`:54-61`), referral geo-block (`:63-72`), hard-stop fail-closed (`:74-83`), rules
   table with const fallback (`:85-134`), one master sequence per person ever
   (`:136-148`); (c) enrollment insert `status='running'` + timeline row (`:154-169`);
   (d) instant broker text queued with first-touch preview, low-intent wording for bare
   sign-ins (`:308-390`) · failure: each leg caught; enrollment misses are swept (step 11).
10. **Stitch the anonymous history** · system · UUID-v4-validated `rr_session_id` links
    prior `visitor_sessions`/`visitor_events` to the person
    (`app/lp/seller-home-value/actions.ts:442-450`; `app/contact/actions.ts:176-183`) ·
    failure: non-blocking, idempotent.
11. **Sweep (the guarantee)** · cron · every 15 min, scan post-epoch people in a trailing
    7-day window (COALESCE(fub_created_at, created_at) — the fix that stopped native rows
    being invisible, `app/api/cron/crm-auto-enroll/route.ts:54-66`), overlap-leased
    (`:49-52`), batch-prefiltered (`:85-116`), then `autoEnrollPerson` + the one-per-person
    broker alert for anything the hot path missed (`:121-172`) · failure: lease released
    on error path (`:70-71`); a 300-row cap bounds each tick (`:68`).

Completion state (§7) is reached at step 9 for the hot path or step 11 at worst — no lead
sits outside the done-state longer than one sweep interval regardless of entry door.

## 6. Decision points

- **Lead-bearing or anonymous?** No email AND no phone → skip entirely; the identity
  stays in the visitor plane (`lib/data/crm/ensureNativeLead.ts:100-110`;
  `lib/followupboss.ts:110-112`).
- **Reuse or create?** Email match wins; else phone; else create-with-key
  (`lib/data/crm/ensureNativeLead.ts:86-111`). Email+phone conflict → high-confidence
  auto-merge attempt before deciding (`:174-199`).
- **Which broker?** Attributed cookie (`?agent=`) beats the routing engine; engine is
  `all_to_one`→matt until flipped in settings (`lib/crm/lead-routing.ts:59-116`;
  `app/lp/seller-home-value/actions.ts:214-220`). Meta door: broker parsed from the
  campaign/ad-set NAME (`lib/agent-attribution.ts:49-59`); portal door: hardcoded matt
  (`app/api/cron/crm-portal-lead-intake/route.ts:137`).
- **Which source label?** `utm_source` → clean label, else the door's fallback name
  (`lib/crm/lead-source.ts:37-41`). Only LP doors run it (§10 D1).
- **Compliance hard-stop (belt and suspenders):** the tagger skips ALL canonical tagging
  for hard-stop/realtor/test tags (`lib/canonical-lead-tagger.ts:152-169,229-232` — but
  fail-OPEN on a read error, `:196`); enrollment independently re-checks
  `crm_suppressions` fail-CLOSED (`lib/crm/enroll.ts:74-83`).
- **SMS consent (A2P/TCPA):** fail-closed — only an actively checked box lifts the
  sms-channel suppression; every consent-less caller suppresses by default
  (`lib/crm/enroll.ts:290-305`). Meta leads capture no SMS consent, so the one webhook
  auto-enroll site (buyer audience, non-realtor only) passes `smsConsent: false` and the
  sms step suppresses; other Meta leads are not auto-enrolled by the webhook at all
  (`app/api/meta/lead-webhook/route.ts:615-625` — enroll gated on
  `audience === 'buyer' && !possibleRealtor`).
- **Enrollment gates:** pre-epoch never; outreach-list sources never (the taxonomy line
  between inbound leads and lists WE built, `lib/crm/enroll.ts:54-61`,
  `app/api/cron/crm-auto-enroll/route.ts:121-135`); referral geo-block; one master
  sequence per person ever; sequence must be active (`lib/crm/enroll.ts:63-148`).
- **Rules table or const fallback?** UI-configurable `crm_automation_rules` first; a
  table outage falls back to the four-row const so enrollment never silently stops
  (`lib/crm/enroll.ts:85-134`).
- **Alert wording:** bare site sign-in (site-domain source, no phone, no inquiry tags) →
  explicit low-intent alert; enrolled lead → first-touch preview; else generic new-lead
  body (`lib/crm/enroll.ts:322-381`).
- **§0/§2 gates:** this process renders nothing public — no market numbers, no copy. The
  brand-voice and design-token gates bind its doors, not the spine.

## 7. Completion

**Done-when (observable):** a `crm_people` row exists (created or reused, email-first
deduped via `crm_contact_points`) carrying: a resolved source label
(`crm_people.source`) with paid-channel tags when UTMs existed; the canonical
`audience:*` + `<audience>:<tier>` + `source:*` + `broker:*` tag set with
`assigned_broker` honoring the `?agent=` cookie; an sms-channel suppression state
matching the consent checkbox (fail-closed); and an enrollment decision — EITHER a
`crm_sequence_enrollments` row `status='running'` + `crm_timeline` 'Enrolled' entry +
queued broker alert (`lib/crm/enroll.ts:154-169,308-390`) OR a recorded exclusion reason
(pre-epoch, outreach-list, referral geo-block, hard-stop, no-matching-rule —
`lib/crm/enroll.ts:47-148`).

**Artifacts at completion:** the person row + contact points; tags + custom fields +
origin note; `marketing_assignments` ledger row; suppression row (or its verified
absence); enrollment + timeline rows; queued broker alert; stitched visitor history.

**Terminal states:** enrolled-and-alerted (happy); excluded-with-reason (still complete —
the reason IS the artifact); skipped (no contact key — by design, not a failure). The
sweep re-examines the window every 15 min, so "missed" is a transient state with a
≤15-minute ceiling, not a terminal one. **Boundaries:** what the sequence SENDS is the
nurture/delivery plane (`crm-sequence-engine` + `crm-scheduled-sends`,
`vercel.json:53-58`); the broker's human reply is the admin plane; referral candidates
complete INTO `refer-out-of-area`.

## 8. Time & performance

- **Time-to-answer budget (machine framing):** capture + assignment are inline in the
  door's own request; the enrollment decision is inline on the hot path and ≤15 min via
  the sweep (`vercel.json:25-26`); the broker alert is queued instantly and drained
  every minute (`crm-alert-drain`, `vercel.json:21-22`); portal leads are ≤15 min from
  email arrival (`vercel.json:49-50`); Meta leads are webhook-real-time.
- **Visitor-facing latency cost:** several doors await the whole spine before responding —
  the seller LP awaits capture, enrichment, ledger write, AND `autoEnrollByFubId` before
  returning (`app/lp/seller-home-value/actions.ts:376-609`); the contact form moved
  enrichment behind `after()` (`app/contact/actions.ts:148`). "Slow" is the visitor
  watching a submit spinner while this machine works inline — the process's latency
  budget should be near-zero visitor-visible (§11).
- **Sweep cost envelope:** 300-candidate cap per tick, overlap lease (300 s self-expiry),
  batch pre-filters cutting ~6 serial queries per already-processed candidate
  (`app/api/cron/crm-auto-enroll/route.ts:44-116`); portal intake pages Gmail up to 10×50
  messages with hold-the-cursor-on-truncation discipline
  (`app/api/cron/crm-portal-lead-intake/route.ts:37,90-103,162-172`).
- **Core Web Vitals:** n/a — no route of its own. The only page-weight contribution is
  the three null-rendering bridges inside one Suspense boundary on every route
  (`components/site/providers/IdentityBridges.tsx:19-27`).

## 9. Variants

All variants converge at `sendEvent`/`ensureNativeLead` with the identical §7 completion —
confirmed ONE process, not four.

1. **Site form submit** (the §5 happy path) — full attribution: UTMs, agent cookie,
   session stitch, consent checkbox.
2. **Partial capture** — address entered but step 2 abandoned: anonymous
   `visitor_events` row always; a native `source:seller-lp-partial` tag only for
   cookie-identified visitors (`app/lp/seller-home-value/actions.ts:104-154`). No
   enrollment (no audience tag).
3. **Auth sign-in/sign-up** — name+email only, source `website-signup`
   (`lib/followupboss.ts:147-176`); the low-intent alert wording exists specifically for
   this variant (`lib/crm/enroll.ts:330-349`). Caller-passed page/provider context is
   dropped (§10 D5).
4. **Meta Instant Form (machine-only, no visit)** — dedupe on leadgen id, audience/tier
   from the form's own answers, broker from the campaign name, canonical tags via
   `buildLeadTags`; buyer-audience non-realtor leads auto-enroll email-first with
   `smsConsent: false` (fail-closed — instant forms capture no SMS consent); other
   Meta leads are captured but not webhook-auto-enrolled
   (`app/api/meta/lead-webhook/route.ts:382-498,512-519,615-625`).
5. **Portal email (machine-only, no visit)** — parsed from Gmail; `source:<portal>` +
   `intent:portal-lead`, broker matt, idempotent timeline note; unparsable → health
   alert, never silently lost (`app/api/cron/crm-portal-lead-intake/route.ts:114-158`).
6. **Cookie-identified repeat visitor** — `rr_pid` supplies the person id with no email
   on the event (`app/actions/lead-capture.ts:76-100`;
   `app/lp/seller-home-value/actions.ts:317-330`).
7. **Delta-sync / inbound-phone arrivals** — people created by other planes still flow
   through THIS process's sweep for their enrollment decision + alert
   (`app/api/cron/crm-auto-enroll/route.ts:1-9`) — the completion state is
   door-independent by construction.
8. **Valuation form (`/sell/valuation`)** — the non-LP seller-KPI door
   (`app/home-valuation/actions.ts:62-223`, read line-by-line this session): UTMs are
   parsed off the referer (`:116-129`) but passed ONLY through the dead `campaign` param
   (`:148-155` — the D1 class on a KPI path); no `readAttributedAgentServer` import, so
   the `?agent=` cookie is ignored (D2 class); the carrier-required consent checkbox IS
   rendered (`app/home-valuation/ValuationForm.tsx:115`, posts `smsConsent=yes`) but the
   action never reads the field — collected consent is dropped (§10 D11); canonical
   tagging is awaited inline (`audience:seller`, `source:cma-request`, tier `warm`,
   `:188-201`) with a direct-`ensureNativeLead` fallback (`:161-180`); the true source
   page is recovered from `?from=`/referer instead of the legacy constant (`:86-99`);
   auto-CMA, acknowledgment email, and CAPI/GA4 mirrors run post-response via `after()`
   (`:212-221`) and belong to `get-home-value`.

## 10. Current implementation map

**Routes:** none of its own — the spine lives in `lib/` + two API routes + two crons.
**Registers:** n/a — no UI. The bridges are invisible client components.

**Modules:** `lib/followupboss.ts` (capture shim) · `lib/data/crm/ensureNativeLead.ts`
(find-or-create + enrichment, DAL) · `lib/crm/lead-source.ts` (source labels + paid tags) ·
`lib/agent-attribution.ts` + `components/AgentAttributionBridge.tsx` +
`app/actions/agent-attribution-read.ts` (broker attribution) ·
`lib/canonical-lead-tagger.ts` (canonical tags + routing + ledger) · `lib/crm/enroll.ts`
(consent + enrollment + alert) · `lib/crm/lead-routing.ts` (strategy engine) · crons
`crm-auto-enroll` + `crm-portal-lead-intake` (`vercel.json:25-26,49-50`) ·
`app/api/meta/lead-webhook/route.ts`.

**Known defects (each verified this session):**

- **D1 — UTM attribution is LP-only; `sendEvent`'s `campaign` param is dead.**
  `sendEvent` never reads `params.campaign` (`lib/followupboss.ts:101-136` — full read),
  yet non-LP doors still parse UTMs and pass them ONLY through that dead param
  (`app/contact/actions.ts:104-111`; `app/api/meta/lead-webhook/route.ts:426-451`;
  `app/home-valuation/actions.ts:116-129,148-155` — the valuation door, a seller-KPI
  path).
  `resolveLeadSource`/`resolvePaidAttributionTags` run on exactly 5 LP actions (grep this
  session — §5.4). A Facebook ad click that converts on `/contact`, a saved search, an
  RSVP, or the homepage loses its channel/campaign attribution entirely; two
  reconciliation crons key on the intake-time tags and cannot repair what was never
  written (`app/api/cron/seller-lead-attribution/route.ts:14`,
  `app/api/cron/buyer-lead-attribution/route.ts:14`).
- **D2 — the `?agent=` cookie is honored by 6 doors out of ~21.**
  `readAttributedAgentServer` is imported ONLY by the 5 LP actions + `cma-download`
  (grep re-run this session). The contact form, the valuation form (`/sell/valuation`,
  `app/home-valuation/actions.ts` — no import), the home-valuation CTA captures,
  saved-searches, alert capture,
  RSVP, homepage, and sign-in doors route through the engine's all-to-matt default —
  Rebecca's ad traffic that converts anywhere but her LP is assigned to Matt. (Same class
  as contact-PDS D1, now measured across the whole spine.)
- **D3 — SMS-consent race on `canonicallyTagLead` doors.** The tagger fires
  `autoEnrollByFubId(personId)` with NO consent option, fire-and-forget
  (`lib/canonical-lead-tagger.ts:267-270`); the contact action separately awaits
  `autoEnrollByFubId(personId, { smsConsent })` (`app/contact/actions.ts:170-173`). Both
  run remove-then-conditionally-add on the same suppression
  (`lib/crm/enroll.ts:297-305`); whichever finishes LAST wins, so a consented visitor can
  end re-suppressed (or, worse ordering, a non-consented one briefly unsuppressed).
  Outcome is timing-dependent; not live-tested this session (§11 gap).
- **D4 — enrichment loss is unrepairable (inherited class).** Canonical tags exist only
  in caller-side post-capture blocks; the sweep only ENROLLS on tags that already exist
  (`lib/crm/enroll.ts:96-125`) — a died `after()` leaves a captured-but-untagged,
  unroutable lead no cron fixes. (Documented per-door in contact-PDS D2; the class is
  spine-wide.)
- **D5 — sign-in context is dropped.** `trackSignedInUser` retains but never forwards
  `sourceUrl`/`message`/`campaign` (`lib/followupboss.ts:143-156`) while all four callers
  still pass them (`app/actions/auth.ts:116-121,152-157`;
  `app/auth/callback/route.ts:136,169`) — every sign-in flattens to bare
  `website-signup`, erasing which page and which provider produced it.
- **D6 — portal leads may never enroll.** They carry only `source:<portal>` +
  `intent:portal-lead` (`app/api/cron/crm-portal-lead-intake/route.ts:137`) — no
  `audience:*` tag, and the fallback const has no rule for those tags
  (`lib/crm/enroll.ts:27-32`), so enrollment depends entirely on a `crm_automation_rules`
  row whose existence was **not queried this session** (§11 ✗). If absent, every
  Zillow/Realtor.com lead completes as "no rule matches tags" — decided silence, but
  probably not the intended treatment of paid-portal leads.
- **D7 — `crm_people.source` is last-touch.** The reuse path overwrites `source` (and
  `assigned_broker`) with the latest door (`lib/data/crm/ensureNativeLead.ts:330-332`);
  first-touch attribution survives only in origin notes and the per-(person, audience,
  source) `marketing_assignments` grain — "which channel CREATED this lead" is not a
  first-class read.
- **D8 — an orphaned duplicate pipeline.** `app/actions/track-contact-agent.ts:49` runs
  the same sendEvent shape from components with zero importers (verified in the
  contact-form PDS, same session date).
- **D9 — a dead chokepoint.** `lib/crm/lead-router.ts` (`captureLead`, the FUB/native
  dual-write switch) has ZERO callers (grep this session) — the cutover it existed for is
  finished (`lead-router.ts:5-33`).
- **D10 — inconsistent hard-stop posture.** `isHardStopped` fails OPEN on a read error
  (`lib/canonical-lead-tagger.ts:183-198`) while enrollment's equivalent check fails
  CLOSED (`lib/crm/enroll.ts:74-83`); the downstream send-time gates make this
  non-exploitable but the intake tagging can mislabel during an outage — the same class
  the 2026-07-09 fix note describes (`:171-182`).
- **D11 — the valuation door drops collected SMS consent.** `ValuationForm` renders the
  carrier-required consent checkbox, which posts `smsConsent=yes` when checked
  (`app/home-valuation/ValuationForm.tsx:115`; named-input contract in
  `components/site/SmsConsentDisclosure.tsx` docstring), but `submitValuationRequest`
  never reads the field (grep clean for `smsConsent` in
  `app/home-valuation/actions.ts`) and calls no consent-carrying enroll — its only
  enrollment writer is `canonicallyTagLead`'s consent-less fire-and-forget
  (`app/home-valuation/actions.ts:188-201` → `lib/canonical-lead-tagger.ts:267-270`), so
  the sms suppression stays even when the box was actively checked. Fail-closed (no TCPA
  exposure) but the visitor's actual consent is discarded — the opposite loss to D3's
  race. This door was omitted from this PDS entirely until the 2026-08-11 repair pass.
- **Naming debt (cosmetic, confirmed):** `autoEnrollByFubId` accepts native ids
  (`lib/crm/enroll.ts:274-283`), `SendEventParams`/`FubEventPerson` keep the FUB shape
  (`lib/followupboss.ts:49-94`), `fubPersonId` variables are native ids throughout.

**Duplicate/parallel paths that should die:** D8's orphaned pipeline; D9's dead
chokepoint; the dead `campaign` param once D1 is fixed at the callers.

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes — as the ONE capture contract behind every door. The current
convergence (all doors → `ensureNativeLead` → one completion state, sweep-guaranteed) is
the right shape; what's broken is that the ATTRIBUTION half of the contract is opt-in per
door instead of structural. Nothing about current module names, param shapes, or the
LP-vs-non-LP split is inherited (design amnesia — the code says what happens, not what
the contract should be).

**Ideal shape:** every door passes one identical capture envelope — contact keys, page,
UTMs, agent cookie, session id, consent — and the SPINE (not the caller) resolves source
label, paid tags, broker attribution, and consent exactly once. That makes D1/D2/D3
structurally impossible: attribution and consent stop being per-door diligence and become
the chokepoint's job, the same move that already worked for dedupe. Enrichment that
decides routing/enrollment must be durable or cron-repairable, never
only-in-a-post-response-block (D4). Consent has exactly one writer per event (D3).
First-touch source is preserved alongside last-touch (D7). Machine-only doors (Meta,
portal) declare their attribution statically instead of half-inheriting site semantics.
Visitor-visible submit latency approaches zero by pushing the spine behind the response
everywhere the contract allows.

**Data gaps blocking correctness (✗ statements, not designs):**

- ✗ No GA4 device/traffic split pulled this session for any capture door.
- ✗ No capture-volume or enrollment-coverage SQL run this session — the P4 chain needs:
  leads/week by door, % reaching enrolled-vs-excluded, exclusion-reason distribution,
  suppression counts (all answerable from `crm_people` / `crm_sequence_enrollments` /
  `crm_suppressions`).
- ✗ `crm_automation_rules` contents unqueried — D6 (portal enrollment) is undetermined
  until someone runs the two-shape check §0 requires.
- ✗ The D3 consent race is asserted from code structure; not reproduced live.
- ✗ Five minor doors (`track-cta-click`, `home.ts`, `agents.ts`, `crm.ts`,
  `lead-landing.ts`) were enumerated but not read line-by-line this session — their
  attribution/consent handling is unaudited. (The valuation form door,
  `app/home-valuation/actions.ts`, was omitted from this PDS's first pass entirely; it
  WAS read line-by-line in the 2026-08-11 repair pass and is documented at §2.1, §9.8,
  §10 D1/D2/D11 — it is no longer an unaudited door.)

**Destination implication + dual objective stamp:**

- Destination: **SYSTEM — no public destination of its own.** In `page-inventory.json` its
  routes are the machinery (`/api/meta/lead-webhook`, the two crons) marked SYSTEM. Its
  real IA output is a cross-cutting P5 requirement: every page whose process completes in
  a capture inherits this machine contract as the second half of its dual objective.
- `visitor_objective` (stamped on host pages, not owned here): "My request went to the
  right person with everything I already told them, and nothing I didn't agree to."
- `machine_objective`: "Every lead-bearing event lands as exactly one deduped, fully
  attributed, consent-correct, broker-routed `crm_people` row with an enrollment decision
  recorded — within one sweep interval, from any door."
- `exits` (machine-side): → nurture/delivery plane (`crm-sequence-engine` /
  `crm-scheduled-sends`); → `deliver-alerts` (alert-carrying captures); →
  `refer-out-of-area` (geo-blocked candidates); → broker workflow (queued alert + admin
  lead page); → `get-home-value` (CMA production on valuation doors).

## 12. Acceptance checks

Persist; never delete. (Live-site HTTP checks need a real browser UA — the WAF blocks
curl's default UA. SQL runs against live Supabase per §7 discipline.)

1. **Crons registered.** `grep -n "crm-auto-enroll\|crm-portal-lead-intake\|crm-alert-drain" vercel.json`
   → all three present (baseline today: paths at lines 25, 49, 21; schedules
   `4,19,34,49 * * * *` and `6,21,36,51 * * * *` and `* * * * *`).
2. **Full-attribution E2E (the exemplar door).** Visit
   `/lp/seller-home-value?agent=rebecca`, then submit from a page whose URL carries
   `?utm_source=facebook&utm_campaign=acc-test&utm_content=ad-1` with
   `e2e+capture-attr@ryan-realty.com`, timeline `ready-now`, consent checked. Then:
   `SELECT id, source, tags, assigned_broker FROM crm_people WHERE id = (SELECT person_id FROM crm_contact_points WHERE kind='email' AND value='e2e+capture-attr@ryan-realty.com' LIMIT 1);`
   → one row: `source='Facebook'`; tags include `audience:seller`, `seller:hot`,
   `source:seller-lp`, `broker:rebecca`, `channel:fb-ads`, `campaign:acc-test`,
   `ad-content:ad-1`; `assigned_broker='rebecca'`.
3. **Dedupe across doors.** Same email through a second door (e.g. `/contact`):
   `SELECT count(*) FROM crm_contact_points WHERE kind='email' AND value='e2e+capture-attr@ryan-realty.com';`
   → still resolves to ONE `person_id`; the person's tags now include both doors'
   `source:*` tags (union, no second person).
4. **Anonymous skip.** A capture invoked with neither email nor phone (e.g. the
   valuation-CTA tracker signed-out with no `rr_pid`) creates no `crm_people` row:
   person-count query before/after is unchanged.
5. **Consent fail-closed.** Submit WITHOUT the consent box:
   `SELECT channel, reason FROM crm_suppressions WHERE person_id=<id from #2>;` → a row
   `sms` / `no-sms-consent`. Re-submit WITH consent on an LP door → row removed. **Race
   guard (encodes decided behavior; may fail today — D3):** on a `/contact` submit WITH
   consent, after 60 s of settle time the suppression row is absent.
6. **Enrollment + timeline + alert.**
   `SELECT status, enrolled_by FROM crm_sequence_enrollments WHERE person_id=<id>;` → one
   row `running`/`auto-rule`;
   `SELECT title FROM crm_timeline WHERE person_id=<id> AND source='auto-enroll';` → the
   'Enrolled' row; `SELECT 1 FROM crm_timeline WHERE dedupe_key='alert:new-lead:<id>';`
   → the one-per-person alert marker.
7. **Sweep guarantee.** `curl -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/crm-auto-enroll`
   → `{ ok: true, scanned, enrolled, alerted, skipped }`. Coverage query:
   `SELECT count(*) FROM crm_people p WHERE COALESCE(p.fub_created_at, p.created_at) BETWEEN '2026-06-10' AND now() - interval '30 minutes' AND NOT EXISTS (SELECT 1 FROM crm_sequence_enrollments e WHERE e.person_id = p.id);`
   → every remaining row must classify as a decided exclusion (outreach-list source,
   referral tags, hard-stop, or no matching audience/intent tag) — run the exclusion
   breakdown before calling any residue a bug (§0 two-shape rule).
8. **Meta door idempotent.** Re-deliver a processed leadgen id →
   `processed_meta_leads` PK short-circuits (row count unchanged); person's sms
   suppression present (Meta leads always suppressed).
9. **Portal door.** `SELECT status, counts FROM crm_imports WHERE source='portal-lead-intake' ORDER BY id DESC LIMIT 1;`
   → recent `done` row; a test portal email produces one person + one
   `crm_timeline` row with `dedupe_key='portal:<gmailId>'`; reprocessing adds nothing.
   **Decided-behavior check (undetermined today — D6):** a portal lead reaches an
   enrollment DECISION with a named reason, not silent absence — first verify whether a
   `crm_automation_rules` row covers `intent:portal-lead`.
10. **Attribution on every door (encodes decided behavior; FAILS today — D1/D2).** With
    the `rr_agent_attribution` cookie set to `rebecca` and Facebook UTMs on the referer,
    a `/contact` submit yields `source='Facebook'`, a `channel:fb-ads` tag, and
    `assigned_broker='rebecca'` — today the contact door writes the site-domain source
    and routes to matt. Same check on a `/sell/valuation` submit WITH the consent box
    checked additionally requires the sms suppression absent — today the valuation door
    writes the site-domain source, routes to matt, and drops the checked consent
    (D1/D2/D11).
11. **Sign-in context (encodes decided behavior; fails today — D5).** A Google sign-in
    from `/listing/<key>` records which page and provider produced it on the person or
    timeline — today only bare `website-signup` lands.
12. **Bridge mounted everywhere.** `grep -n "IdentityBridges" components/site/providers/RootProvider.tsx app/layout.tsx`
    → mounted at RootProvider.tsx:34 inside layout.tsx:135 (baseline today); visiting any
    route with `?agent=paul` then submitting an LP form assigns Paul.
