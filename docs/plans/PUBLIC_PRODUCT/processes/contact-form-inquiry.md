# Process: contact-form-inquiry — Contact-form inquiry

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a submit fires the whole pipeline; capture side effects are
  swept by registered crons — see §3)
- Verdict: **PROPOSAL (not a lock — P3 decides): KEEP** — this is the site's only
  general-purpose "reach a broker in writing" chokepoint and the completion leg of the
  listing-detail tour/question CTAs; killing it orphans every "Talk to a broker" handoff on
  /sell, /buy, /our-homes and the listing tour buttons. Sub-proposal inside the KEEP: the
  `intent=tour` variant is the highest-intent buyer moment on the site and currently rides a
  generic form at nurture tier (§10 D5) — P5 should decide whether tour requests stay folded
  here or become a step attached to the listing node, with this process as the fallback.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

A visitor with a question, a tour request, or a broker-shaped problem reaches Ryan Realty in
writing and leaves knowing exactly what happens next (a reply within one business day, faster
by phone). Serving that fully advances the contact-made client step: the ask requires an
email plus the question's context, which creates the identified `crm_people` lead — tagged,
broker-assigned, sequence-enrolled, and stitched to the visitor's prior anonymous browsing.

## 2. Inception (what starts it)

**Trigger:** a visitor with a question or tour intent opens `/contact`. No preconditions —
all entry is anonymous. Optional carried state: `rr_session_id` in localStorage (read at
submit, `app/contact/ContactForm.tsx:45-46`) and URL params `?inquiry=`, `?listingKey=`,
`?intent=tour|question` (`app/contact/page.tsx:50,79-82`).

**Entry channels + routes (evidence):**

1. **Direct / organic** — `/contact` is sitemapped (`app/sitemap.ts:123`) with its own
   metadata + canonical (`app/contact/page.tsx:52-67`) and ContactPage + BreadcrumbList +
   FAQPage JSON-LD (`page.tsx:98-121`).
2. **Internal navigation** — the About menu (`lib/site-nav.ts:166`) and every footer variant
   (`lib/site-nav.ts:251,324,382`).
3. **INTERNAL listing-detail CTAs carrying `?listingKey=&intent=`** — the hottest entries:
   `PriceCtaStrip` Schedule-a-tour / Ask-about-this-home
   (`components/site/listing-detail/PriceCtaStrip.tsx:131-134`, rendered at
   `app/listing/[listingKey]/page.tsx:347`); the mobile contact bar
   (`components/site/listing-detail/ListingMobileContactBar.client.tsx:40`); the KbFooter
   Let's-talk band when a listing page passes `listingKey`
   (`components/site/kb/KbFooter.client.tsx:66-69`; passed at
   `app/listing/[listingKey]/page.tsx:575`).
4. **Intent handoffs from other processes** — `?inquiry=Selling` from `/sell`
   (`app/sell/page.tsx:266`), `/sell/valuation` (`app/sell/valuation/page.tsx:191`),
   `/our-homes` (`app/our-homes/page.tsx:162`), the sell components
   (`components/site/sell/SellMarketingPlan.tsx:41`,
   `components/site/sell/SellerSituations.client.tsx:44`) and the lead-landing config
   (`lib/lead-landing-content.ts:129`); `?inquiry=Buying` from `/buy`
   (`app/buy/page.tsx:96,353`); `?inquiry=Join%20the%20team` from `/join`
   (`app/join/page.tsx:264,415`); `?inquiryType=Buying&message=…` from community pages
   (`app/communities/[slug]/page.tsx:884,919`) — the last two are broken handoffs (§10
   D3/D4).
5. **Paid arrivals** — no dedicated ad route lands here, but campaign attribution survives
   the hop: the server action parses UTMs off the referer URL
   (`app/contact/actions.ts:80-91`) and forwards them as the capture's campaign
   (`actions.ts:104-111`).

**NOT this process:** `tel:` / `mailto:` taps on this page (`app/contact/page.tsx:218-236`)
belong to `broker-direct-call-text`; `/about`, `/team`, `/reviews` are trust surfaces feeding
this process, not processes themselves.

## 3. Actors

- **Visitor segments:** buyers arriving from a listing (tour/question), sellers handed off
  from sell surfaces, general/relocation inquirers, and job applicants via `/join` — the
  process's own taxonomy is the inquiry select: Buying, Selling, Both, General Inquiry,
  Relocation (`app/contact/ContactForm.tsx:19-25`). Audience is inferred server-side —
  seller keywords else buyer (`app/contact/actions.ts:25-29`). Device reality from GA4:
  **not pulled this session — gap** (§11).
- **Automated actors:** the `after()` enrichment block (tagging, assignment, enrollment,
  stitching — `actions.ts:148-188`); sweep + delivery crons registered in `vercel.json` —
  `crm-auto-enroll` (line 25), `crm-scheduled-sends` (line 53), `crm-sequence-engine`
  (line 57); the broker-alert queue inside enrollment
  (`lib/crm/enroll.ts:309-390`); the referral queue for out-of-area property inquiries
  (`lib/referral-geo.ts:105-124`).
- **Accountable for completion:** the assigned broker — resolved by the lead-routing engine,
  seeded `all_to_one` with default `matt`, fail-safe to matt
  (`lib/canonical-lead-tagger.ts:79-95`; strategy resolution
  `lib/crm/lead-routing.ts:63,85,116-178`). The rendered one-business-day reply promise
  (`app/contact/page.tsx:142,244-247`) is the broker's to keep — no system enforces it
  (§10 D6).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Lead identity | `public.crm_people` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2112`; written by `sendEvent` → `ensureNativeLead` (`lib/followupboss.ts:101-131`; DAL export `docs/DAL_INDEX.md:707-709`) with a direct-`ensureNativeLead` fallback (`app/contact/actions.ts:117-138`) |
| Tags, assignment, origin note | `crm_people` via `enrichNativeLead` | `lib/canonical-lead-tagger.ts:245-263` |
| Sequence membership | `public.crm_sequence_enrollments` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2286`; inserted by `autoEnrollPerson` (`lib/crm/enroll.ts:154-161`) |
| SMS-consent state | `public.crm_suppressions` (channel `sms`, reason `no-sms-consent`) | `docs/DATABASE_SCHEMA_SNAPSHOT.md:2370`; fail-closed write (`lib/crm/enroll.ts:297-305`; consent field `app/contact/actions.ts:39`) |
| Broker-assignment ledger | `public.marketing_assignments` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:3496`; upsert via `recordMarketingAssignment` (`lib/canonical-lead-tagger.ts:103-125`) |
| Anonymous→known browsing history | `visitor_sessions` / `visitor_events` / `visitor_identity_map` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:4958,4914`; stitched by `backfillSessionToFub` (`lib/visitor-backfill.ts:141`; called `app/contact/actions.ts:176-183`) |
| Conversion mirrors | Meta CAPI + GA4 Measurement Protocol | external mirrors, NOT SoR (`app/contact/actions.ts:194-235`; `lib/lead-tracking.ts:75-119`) |

**Explicitly NOT a SoR:** Follow Up Boss (decommissioned 2026-06-24; `sendEvent` is legacy
naming over the in-house path — `lib/followupboss.ts:102-107`, CLAUDE.md §9); the broker
notification email (a transient alert to `ADMIN_EMAIL`, `lib/resend.ts:101-124`); GA4/Meta
(mirrors of, never sources for, the `crm_people` truth).

## 5. End-to-end path (inception → completion)

Happy path = generic `/contact` submit. Listing-intent branch noted inline; variants in §9.

1. **Land** · visitor · opens `/contact` (any §2 channel) · input: URL + params · output:
   rendered page · system: per-request dynamic render — `getSession()` +
   `getPersonIdFromCookie()` pin dynamic mode (`app/contact/page.tsx:70-78`) · failure: none
   observed; no ISR cache to go stale · device: both.
2. **Derive context** · page · `?inquiry` (or `Buying` when a `listingKey` is present) sets
   the select default; `?intent` narrows to `tour|question`; a `listingKey` pulls the
   listing tile via `getListingTiles` with a `.catch(() => [])` fallback and renders the
   which-home card + intent-specific header (`page.tsx:79-87,164-196`) · failure: a dead
   tile fetch silently drops the card (the form still carries the key) · device: both.
3. **Fill** · visitor · email required; name, phone, message optional; inquiry select; tour
   variant adds a preferred-time select (`ContactForm.tsx:95-177`; options `:27-33`) ·
   failure: browser-level `required` on email only · device: both.
4. **Client submit** · form · appends `rr_session_id` when present, appends `listingKey`,
   folds tour time into the message body ("Tour request. Preferred time: …",
   `ContactForm.tsx:40-56`) · output: FormData → server action `submitContactForm`
   (`:57`) · failure: none client-side; button shows `Sending…` (`:188`).
5. **Validate** · server · trims fields, reads fail-closed `smsConsent === 'yes'`
   (`app/contact/actions.ts:31-39`) · failure: missing email returns
   `{ error: 'Email is required' }` (`:41`).
6. **Resolve the listing + classify geo** · server · `listingKey` → `getListingsByKeys`
   builds the human label ("street, city (MLS #)") and classifies the property's city:
   local → no extra tags; out-of-area/out-of-state → `geo:*` + `referral:candidate`;
   unresolvable tile → `geo:unclassified` fail-closed (`actions.ts:45-73`;
   `lib/referral-geo.ts:64-73,105-124`) · failure: lookup errors degrade the label to
   `listing <key>` and keep the fail-closed `unknown` tags (`actions.ts:56,67-71`).
7. **Parse attribution** · server · UTMs off the referer URL (`actions.ts:80-91`) · output:
   campaign block for the capture (`:104-111`) · failure: malformed referer → no UTMs, never
   throws.
8. **Capture** · server · `sendEvent({ type: 'General Inquiry', … })` →
   `ensureNativeLead` creates/reuses the `crm_people` row (match by email) and returns the
   native person id (`actions.ts:93-112`; `lib/followupboss.ts:101-131`) · failure: → step 9.
9. **Fallback capture** · server · on capture error, a direct `ensureNativeLead` with tags
   `['source:contact-form','fub-fallback']` still writes the lead; only a double failure
   returns an error to the visitor (`actions.ts:117-138`) — a blip never loses the lead.
10. **Broker notification** · server · `sendContactNotification` emails `ADMIN_EMAIL` with
    name/email/phone/inquiry/message, reply-to the visitor (`actions.ts:140`;
    `lib/resend.ts:103-124`) · failure: `.catch(() => {})` — non-blocking, silent (§10 D7).
11. **Enrich (post-response)** · system · `after()` keeps the function alive (a bare IIFE
    used to freeze and drop leads unassigned — comment `actions.ts:145-147`):
    `canonicallyTagLead` applies `audience:*` + `<audience>:nurture` + `source:contact-form`
    + `broker:*` + geo extras, writes the origin note, records the assignment ledger row
    (`actions.ts:148-168`; `lib/canonical-lead-tagger.ts:217-276`) · failure: caught +
    logged; **not repairable by any cron** (§10 D2).
12. **Enroll + alert** · system · `autoEnrollByFubId` writes the SMS-consent suppression
    (fail-closed), runs `autoEnrollPerson` (epoch, outreach-source, referral-geo, hard-stop
    gates; rules table with const fallback), inserts the enrollment + timeline row, and
    queues the broker's new-lead text with the first-touch preview
    (`actions.ts:170-173`; `lib/crm/enroll.ts:268-392,40-170`) · failure: each leg caught;
    the `crm-auto-enroll` cron (vercel.json:25) sweeps missed *enrollments* only.
13. **Stitch** · system · a UUID-v4 `rr_session_id` links the anonymous
    `visitor_sessions`/`visitor_events` history to the person, `identifiedVia:
    'form_submit'` (`actions.ts:176-183`; `lib/visitor-backfill.ts:141`) · failure:
    non-blocking, idempotent.
14. **Mirror conversions** · server (inline, pre-response) · Meta CAPI `Lead` with shared
    `eventId` + tiered value (listing 300 / seller 500 / general 200) via `/api/meta-capi`
    (route exists: `app/api/meta-capi/route.ts`), then GA4 MP `generate_lead` server-side
    (`actions.ts:194-235`; `lib/lead-tracking.ts:75-119`) · failure: both caught + logged.
15. **Confirm** · client · success card ("Message received." / "Tour request received." +
    the one-business-day line, `ContactForm.tsx:71-83`); browser `fbq('track','Lead')` with
    the matching `eventID` for CAPI dedup + gtag `generate_lead`
    (`ContactForm.tsx:60-68`) · completion state reached (§7).

## 6. Decision points

- **Intent + default inquiry derivation:** `intent` only ever `tour|question`
  (`app/contact/page.tsx:82`); `listingKey` without `?inquiry` defaults the select to
  Buying (`page.tsx:81`).
- **Email present?** The only hard validation; missing → error, nothing written
  (`app/contact/actions.ts:41`).
- **Property geo branch (referral tier W12):** local → standard path; out-of-area /
  out-of-state → referral tags that the enroll gate keeps out of the drip (handoff to
  `refer-out-of-area`); unresolvable → `geo:unclassified` fail-closed, broker reviews by
  hand (`actions.ts:47-72`; gate `lib/referral-geo.ts:143-152`, applied
  `lib/crm/enroll.ts:71-72`). General inquiries with no listing are never classified.
- **Capture failed?** Native fallback; only a double failure surfaces an error
  (`actions.ts:117-138`).
- **Compliance hard-stop:** hard-stop tags skip ALL enrichment/enrollment
  (`lib/canonical-lead-tagger.ts:152-169,229-232`); enrollment independently re-checks
  `crm_suppressions` fail-closed (`lib/crm/enroll.ts:75-83`).
- **SMS consent (A2P/TCPA):** fail-closed — only an actively checked box
  (`name="smsConsent"` value `yes`, `components/site/SmsConsentDisclosure.tsx:19,34,62`;
  read `actions.ts:39`) lifts the sms-channel suppression (`lib/crm/enroll.ts:290-305`).
- **Audience inference:** seller keywords in the inquiry → `seller`, else `buyer`
  (`actions.ts:25-29`) — drives which master sequence the tags match
  (`lib/crm/enroll.ts:27-32`).
- **Enrollment gates:** post-epoch contacts only, outreach-list sources never, one master
  sequence per person ever (`lib/crm/enroll.ts:49-61,137-148`).
- **Session stitch guard:** `sessionId` must be UUID v4 (`actions.ts:16,176`).
- **§0/voice gates:** the page renders no market numbers (hero data nulled,
  `page.tsx:138`); brand-voice + design-token gates run at commit (CLAUDE.md §6).

## 7. Completion

**Done-when (observable):** a `crm_people` row exists (created or reused) carrying
`audience:<buyer|seller>` + `<audience>:nurture` + `source:contact-form` + `broker:*`
(`lib/canonical-lead-tagger.ts:237-243`), the broker notification email sent
(`lib/resend.ts:118-123`), a `crm_sequence_enrollments` row exists for standard-path leads
(`lib/crm/enroll.ts:154-161`) OR the referral/fail-closed tags explain its absence, the
sms-consent suppression state matches the checkbox, and the visitor sees the confirmation
card (`app/contact/ContactForm.tsx:71-83`).

**Artifacts at completion:** CRM person (tags, assignment, origin note, assignment-ledger
row), sequence enrollment + timeline row, broker new-lead text (queued), notification email,
stitched session history, Lead conversion in Meta CAPI + GA4 (shared event id browser-side).

**Terminal states:** success card (tour vs message copy, `ContactForm.tsx:71-83`); inline
error with the form intact for retry (`ContactForm.tsx:179`). **Boundaries:** the broker's
actual reply happens in the CRM (admin plane, not this process); out-of-area property
inquiries complete INTO `refer-out-of-area` (referral queue, no drip); `tel:` taps complete
in `broker-direct-call-text`.

## 8. Time & performance

- **Time-to-answer budget:** the page's own answer (how to reach a broker, how fast they
  reply) is in the hero lead line at zero scrolls (`app/contact/page.tsx:142`), with the
  phone answer one tap away (`page.tsx:218-224`). For listing-intent arrivals the
  which-home card confirms context above the form (`page.tsx:164-196`).
- **Server budget:** the route renders per-request (session + identity-cookie reads pin
  dynamic mode, `page.tsx:70-78`); the only data pull is the optional single-tile
  `getListingTiles` with a swallow-to-empty fallback (`page.tsx:85-87`).
- **Submit latency:** capture, notification email, Meta CAPI fetch, and the GA4 MP call all
  run inline before the visitor sees success (`actions.ts:93-237`); only enrichment is
  post-response via `after()` (`actions.ts:148`). "Slow" is the visitor watching the
  `Sending…` button (`ContactForm.tsx:188`) while two external network calls round-trip —
  the same defect class the valuation action already fixed by moving side effects behind
  `after()` (§11 gap).
- **Core Web Vitals for `/contact`: not measured this session — gap** (§11). Structural
  risk: the kb shell loads Lenis smooth-scroll + GSAP footer animation on a one-form page
  (`page.tsx:41-46`; `KbFooter.client.tsx:40-45`).

## 9. Variants

All variants share one route, one form component, one server action; none splits the path
enough to be its own process.

1. **Generic inquiry** — direct/nav entry, no params; select defaults General Inquiry
   (`ContactForm.tsx:136`).
2. **Listing tour** (`?listingKey=&intent=tour`) — tour-time select appears
   (`ContactForm.tsx:149-167`), time folds into the message (`:52-56`), header reads
   "Schedule a tour" (`page.tsx:165`), success copy promises a call/text to confirm a time
   (`ContactForm.tsx:77-80`).
3. **Listing question** (`intent=question`) — same as 2 minus the time select; header "Ask
   about this home" (`page.tsx:165`).
4. **Seller handoff** (`?inquiry=Selling`) — from `/sell`, `/sell/valuation`, `/our-homes`,
   sell components (§2.4); audience infers `seller` (`actions.ts:27`) → seller master
   sequence.
5. **Buyer handoff** (`?inquiry=Buying`) — from `/buy` (§2.4).
6. **Out-of-area property inquiry** — statewide MLS listing outside Central Oregon; same
   form, completion diverges into the referral queue with no drip (§6).
7. **Broken handoffs (defects, not designs):** `/join`'s `?inquiry=Join%20the%20team`
   names a value absent from the option list (§10 D4); community pages pass
   `?inquiryType=`+`&message=` params the page never reads (§10 D3).

## 10. Current implementation map

**Routes:** `/contact` only (metadata + JSON-LD `app/contact/page.tsx:52-67,98-121`).

**Registers (of the 5 design languages):** kb shell (KbNav-less here but KbHero, KbFooter,
SmoothScrollProvider, kb.css — `page.tsx:41-46`) PLUS shadcn `@/components/ui/*` controls
inside the form (`ContactForm.tsx:6-17`) — two registers on one surface.

**Actions/API/crons:** `submitContactForm` (`app/contact/actions.ts:31`); `/api/meta-capi`
(`app/api/meta-capi/route.ts`); crons `crm-auto-enroll` / `crm-scheduled-sends` /
`crm-sequence-engine` (`vercel.json:25,53,57`).

**Known defects (each verified this session):**

- **D1 — the agent-attribution cookie is ignored.** `app/contact/actions.ts` never imports
  `readAttributedAgentServer` (full file read this session); the seller path does
  (`app/lp/seller-home-value/actions.ts:18`). A visitor who browsed Rebecca's page and then
  used `/contact` is assigned by the routing engine (seeded all_to_one → matt,
  `lib/canonical-lead-tagger.ts:91-95`) — the `rr_agent_attribution` contract breaks on
  this path.
- **D2 — a lost enrichment is unrepairable.** Audience/broker tags exist ONLY in the
  `after()` block (`actions.ts:148-168`); the capture itself tags just
  `source:<domain>` because type `General Inquiry` maps audience to null
  (`lib/followupboss.ts:117-126`). The `crm-auto-enroll` sweep cron can only enroll people
  whose tags already match a rule (`lib/crm/enroll.ts:27-32,124-125`) — so if `after()`
  dies, the lead exists but is never tagged, routed, or enrolled, and no cron fixes it.
- **D3 — community handoffs drop their context.** `app/communities/[slug]/page.tsx:884,919`
  link with `?inquiryType=Buying&message=…`, but the page reads only
  `inquiry`/`listingKey`/`intent` (`page.tsx:50`) and the form has no message prefill
  (`ContactForm.tsx:35`) — the carried inquiry AND the prewritten message are discarded.
- **D4 — `/join` preselects a nonexistent option.** `app/join/page.tsx:264,415` pass
  `inquiry=Join%20the%20team`; `INQUIRY_OPTIONS` has no such value
  (`ContactForm.tsx:19-25`). What the Select renders/submits with an unlisted defaultValue
  is untested in a browser this session — either way the applicant's stated intent cannot
  round-trip cleanly.
- **D5 — tour requests are processed as nurture.** No caller passes a tier, so
  `canonicallyTagLead` defaults `nurture` (`lib/canonical-lead-tagger.ts:234`), and the
  action creates no call task (no `crm_tasks` write anywhere in `actions.ts`, full read) —
  while the seller LP classifies hot and cuts a 5-minute call task. The highest-intent
  buyer moment on the site (a showing request) gets the same machine treatment as a general
  question, and the preferred time survives only as free text inside the message body
  (`ContactForm.tsx:52-56`) — unqueryable.
- **D6 — the reply promise has no machinery.** "A broker replies within one business day"
  renders three times (`page.tsx:55,142,244-247` + FAQ JSON-LD `:108-120`), and the
  tour success card adds "will call or text to confirm a time" (`ContactForm.tsx:79`);
  the only nudge is the queued new-lead text (`lib/crm/enroll.ts:383-388`). No SLA timer,
  no escalation, no measurement of whether the promise is kept.
- **D7 — silent notification failure + empty-name subject.** The notification send swallows
  its error entirely (`actions.ts:140`), and with the optional name blank the subject reads
  "Contact form: X from " (`lib/resend.ts:120`; name optional `ContactForm.tsx:96-98`).
- **D8 — GA4 double-fire risk.** The server fires `generate_lead` via Measurement Protocol
  (`actions.ts:229-235`) AND the client fires the same event through gtag on success
  (`ContactForm.tsx:67`). Meta dedups by `eventID`; GA4 MP has no equivalent dedup — when
  gtag is not blocked, one submit can count twice. Unmeasured this session; flagged from
  code, not analytics.
- **D9 — a parallel orphaned inquiry pipeline.** `app/actions/track-contact-agent.ts`
  (sources `showings-request`/`idx-registration`, same sendEvent + canonical tagging
  shape, `track-contact-agent.ts:1-40`) is called only from
  `components/listing/AgentCard.tsx` + `components/listing/ListingCtaSidebar.tsx`, which
  have ZERO importers (repo grep of `app`+`components` this session) — a dead duplicate of
  this process's listing-inquiry leg.

**Duplicate/parallel paths that should die:** D9's orphaned pipeline + components. The
`tel:`/`mailto:` exits are a boundary (another process), not duplicates.

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes. Every exploration graph needs exactly one low-friction "reach a
human in writing" node, and the listing tour/question job needs a completion leg. Names,
groupings, and the tour-detour shape below are NOT inherited — they derive from the job
(design amnesia; `/contact` has sitemap presence, so any P5 rename gets GSC evidence + a
301).

**Ideal shape:** one contact destination that answers "who, how fast, and how" above the
fold and takes the message in one step (email + question; everything else optional) — fed by
the trust surfaces (/about, /team, /reviews) and by intent handoffs that ARRIVE INTACT
(inquiry, message, listing, attribution all honored). Tour requests deserve continuity
(decisions.md directive 5): the ask should live with the listing node the visitor is already
on — structured time slot, hot-tier routing, a call task — with the contact node as the
generic fallback, whether P5 implements that as an attached step or a prefilled arrival
here. The attribution cookie is honored exactly as the seller paths honor it. Enrichment
that decides routing/enrollment either runs inline-durable or becomes cron-repairable —
never only-in-`after()` (D2). Mobile 390 is truth.

**Data gaps blocking correctness (✗ statements, not designs):**

- ✗ No GA4 device/traffic split for `/contact` pulled this session — §3's device claim is
  unstated, not evidenced.
- ✗ No submission-volume split by intent/inquiry (tour vs question vs general vs seller)
  queried this session — the P5 tour-detour decision needs it
  (`crm_people` `source:contact-form` counts by origin note would answer it).
- ✗ No measurement of the one-business-day promise (no reply-latency stat exists anywhere
  in the pipeline — D6).
- ✗ CWV for `/contact` unmeasured this session.

**Destination implication + dual objective stamp:**

- Destination: ONE contact destination (named at P5) fed by the trust surfaces; the listing
  tour/question job is a continuity requirement on the listing node with this destination as
  its completion or fallback. D9's parallel pipeline dies.
- `visitor_objective`: "Reach a Ryan Realty broker with my question or tour request and know
  exactly when and how they will answer."
- `machine_objective`: "Contact made: an identified, routed, sequence-enrolled crm_people
  lead carrying the inquiry's full context (listing, intent, attribution)."
- `exits`: → `find-a-home` (the listing-tile card links back to the home,
  `app/contact/page.tsx:167-196`; listing/place doors in nav+footer); →
  `broker-direct-call-text` (tel:/mailto, `page.tsx:218-236`); → `plan-a-sale` /
  `get-home-value` (seller inquiries; the footer valuation CTA when no listingKey,
  `KbFooter.client.tsx:74-79`); → `contact-a-broker` trust surfaces (`/team` link,
  `page.tsx:262-264`); → `refer-out-of-area` (out-of-area property inquiries, machine-side).

## 12. Acceptance checks

Persist; never delete. (Live-site HTTP checks need a real browser UA — the WAF blocks curl's
default UA.)

1. **Route serves.** In a browser (or `curl -A "Mozilla/5.0 …"`):
   `https://ryan-realty.com/contact` → 200, canonical `/contact`, ContactPage +
   BreadcrumbList + FAQPage JSON-LD present in source.
2. **Generic-submit E2E.** On 390 viewport submit with only
   `e2e+contact-inquiry@ryan-realty.com` + inquiry General Inquiry. Then:
   `SELECT id, tags, assigned_broker FROM crm_people WHERE emails @> '[{"value":"e2e+contact-inquiry@ryan-realty.com"}]'::jsonb OR id IN (SELECT person_id FROM crm_contact_points WHERE kind='email' AND value='e2e+contact-inquiry@ryan-realty.com');`
   → one row whose tags include `audience:buyer`, `buyer:nurture`, `source:contact-form`,
   and a `broker:*`; `assigned_broker` set.
3. **Notification email.** The `ADMIN_EMAIL` inbox holds "Contact form: General Inquiry
   from …" with reply-to = the test address.
4. **Enrollment.** `SELECT status, enrolled_by FROM crm_sequence_enrollments WHERE person_id=<id from #2>;`
   → one row, `enrolled_by='auto-rule'` (or the `crm-auto-enroll` cron within 15 min).
5. **SMS fail-closed.** Submit WITHOUT checking consent:
   `SELECT channel, reason FROM crm_suppressions WHERE person_id=<id>;` → a row
   `sms`/`no-sms-consent`. Re-submit WITH consent checked → that row removed.
6. **Tour intent E2E.** Open `/contact?listingKey=<active key>&intent=tour` → the listing
   card renders address + price and the header reads "Schedule a tour"; submit with a time
   → the person's origin/timeline note or captured message begins
   `Tour request. Preferred time:` and the success card reads "Tour request received."
7. **Out-of-area referral.** Submit with a `listingKey` for a non-Central-Oregon Oregon
   city → tags include `geo:out-of-area` + `referral:candidate`, and NO
   `crm_sequence_enrollments` row exists for the person (enroll gate reason: referral
   candidate).
8. **Session stitch.** Browse two listings anonymously first, then submit;
   `SELECT identified_via, crm_person_id FROM visitor_sessions WHERE session_id='<rr_session_id>';`
   → `form_submit` + the person id from #2.
9. **Conversion mirrors.** Browser network tab on submit: `fbq` Lead fires with an
   `eventID` equal to the server response's `eventId`; `/api/meta-capi` returns 2xx. (GA4:
   one `generate_lead` per submit is the DECIDED behavior — today's client+server double
   fire is the D8 failing baseline.)
10. **Handoff integrity (encodes decided behavior; fails today).** Arriving via
    `/contact?inquiryType=Buying&message=Interested…` (community CTA) preselects Buying and
    prefills the message — today both params are dropped (D3). Arriving from `/join`
    round-trips the applicant's intent — today the value is not in the option list (D4).
11. **Attribution honored (encodes decided behavior; fails today).** With the
    `rr_agent_attribution` cookie set to `rebecca`, a `/contact` submit assigns Rebecca —
    today the cookie is never read on this path (D1).
12. **Crons registered.** `grep -n "crm-auto-enroll\|crm-sequence-engine\|crm-scheduled-sends" vercel.json`
    → all three present (baseline today: lines 25, 53, 57).
