# Process: track-outbound-engagement — Outbound-message engagement tracking (email opens/clicks, SMS short-links, identity backfill)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (event-driven — every render/click of every outbound email and
  text, forever; the process has no cron of its own. The SEND rails that mint its
  instrumentation do: `crm-sequence-engine` `13,28,43,58 * * * *` (`vercel.json:57-58`),
  `newsletter-send` `*/2 * * * *` (`vercel.json:149-150`), `saved-search-alerts`
  `0 * * * *` (`vercel.json:213-214`))
- Verdict (**PROPOSAL, not a lock — P3 decides**): **KEEP, and absorb
  `sms-shortlink-click` into this process** — that sibling PDS already proposes
  MERGE→track-outbound-engagement on its own evidence
  (`processes/sms-shortlink-click.md` §0), and the code agrees: `lib/data/crm/shortLinks.ts:11`
  names itself "the SMS analog of the email click tracker." The job is ONE job — "an
  engagement on a message we sent becomes a person-level signal, and the recipient lands
  where the message promised" — with per-channel mint mechanics (signed HMAC token for
  email, DB short-code for SMS). The identity-backfill leg (`/api/track/e/identify`,
  `rr_pid`) STAYS here rather than merging into `capture-and-attribute`: its inception is
  an outbound-message click (possession of the emailed link is the credential,
  `app/actions/identity-bridge.ts:63-66`), not an inbound site arrival;
  `capture-and-attribute` consumes the stitched identity, it does not produce it.
  Non-negotiable rider: the `/api/track/e/*` and `/r/*` URL namespaces and every
  already-signed token/minted code are immutable external contracts (they live in sent
  mail and texts on clients' devices forever; email tokens outside the newsletter family
  never expire — `lib/email-tracking.ts:98-99`) — merge the process definition, never
  rename or retire the routes.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A person who receives a Ryan Realty email or text gets a message that keeps its promises:
images render without a broken pixel, and every link opens exactly the page the message
said it would — instantly, with no visible tracking hop, and never an error page even on a
forged, expired, or mangled token. The machine outcome is the measurement half of every
outbound-comms loop: serving that open/click requires resolving OUR signed token (or
stored short-code), and the same resolution writes deduped person-level engagement rows
(`email_open`/`email_click`/`sms_click` → `crm_timeline` + `email_events` + the newsletter
ledger) and stitches the recipient's browser to their `crm_people` row (`rr_pid` cookie +
anonymous-session backfill) — advancing the client-step "a contact we messaged becomes a
measurable, recognized, broker-attributed web visitor whose interest is visible to their
broker."

## 2. Inception (what starts it)

Entry channel: **owned/direct only** — the tracked URLs exist solely inside messages Ryan
Realty sent (never organic, paid, social, or internal-link). Three inceptions:

- **(A) Open** — a mail client renders the 1x1 pixel appended to the email body →
  `GET /api/track/e/open?t=<token>` (`app/api/track/e/open/route.ts:31-93`; pixel appended
  at `lib/email-tracking.ts:150-151`).
- **(B) Click** — the recipient clicks a link that was rewritten at compose time to
  `GET /api/track/e/click?t=<token>` with the destination signed INSIDE the token
  (`app/api/track/e/click/route.ts:17-73`; rewrite at `lib/email-tracking.ts:143-148`).
  When the destination is a site page, the URL it 302s to carries `?agent=` +
  `?_pid=`/`?_fuid=` (stamped before wrapping — `lib/crm/attributed-links.ts:76-81`),
  which fires the identity-backfill sub-inception on landing:
  `components/PersonIdentityBridge.tsx:31-53` on normal pages (mounted site-wide via
  `components/site/providers/IdentityBridges.tsx:22-23`), or the injected
  `public/rr-doc-tracker.js:34-66` → `GET /api/track/e/identify`
  (`app/api/track/e/identify/route.ts:29-45`) on raw-HTML client documents
  (`app/cma/[slug]/route.ts:152,180`, `app/bpo/[slug]/route.ts:77`,
  `lib/cma/register-gate.ts:95`).
- **(C) SMS tap** — `GET /r/<code>` (`app/r/[code]/route.ts:18-33`) — absorbed sibling;
  full inception detail in `processes/sms-shortlink-click.md` §2.

Precondition — the message was instrumented at compose time. Every outbound-HTML send path
routes through `attributeOutbound` (`lib/crm/attributed-links.ts:60-93`: attribution
FIRST, then `instrumentEmailHtml`) or calls `instrumentEmailHtml` directly. The mint
surfaces, all opened this run:

1. Newsletter queue send — `lib/newsletter/send-queue.ts:475-483` (emailKey
   `newsletter:<id>`, 180-day token TTL).
2. Broker 1:1 newsletter send — `app/actions/contact-newsletter.ts:192-200` (emailKey
   `newsletter:<id>:p<personId>`).
3. Market-report send — `lib/crm/market-report-send.ts:159-165`.
4. Saved-search alert send — `lib/alerts/send.ts:407-421` (emailKey
   `listing-alert:<rowId>:<runDate>`).
5. CMA lead delivery — `lib/cma/send.ts:332-338` (emailKey `cma:<slug>`) and the legacy
   rail `lib/cma-deliver.ts:316-323`.
6. CRM composer 1:1 email — `app/actions/crm.ts:576` passes
   `track: { personId, emailKey, label }` into the Gmail transport, which instruments at
   `lib/crm/gmail.ts:443-445` (emailKey `tpl:<key>:<pid>:<ts>` or `manual:<pid>:<ts>`,
   `app/actions/crm.ts:560-561`).
7. Sequence-engine drip email — `app/api/cron/crm-sequence-engine/route.ts:300` (emailKey
   `seq:<name>:<step>`).
8. Bulk email cohort — `lib/crm/bulk-handlers/email-cohort.ts:206`.
9. SMS mint surfaces — six, per the sibling PDS §2 (`lib/data/crm/shortLinks.ts:82-129`).

Tokens are HMAC-SHA256 signed (`lib/email-tracking.ts:65-82`); production refuses to sign
or verify with the dev fallback secret (`assertTrackingSecret`,
`lib/email-tracking.ts:39-46`). No auth, no cookie, no session required at inception —
possession of the message IS the credential (`app/actions/identity-bridge.ts:63-66`).

Not an inception here: Resend webhook events (`app/api/webhooks/resend/route.ts`) — a
parallel OBSERVER rail for Resend-transported mail that writes the same stores (§5 step 8,
§10 defect 1); its inception is a provider callback, not a recipient action.

## 3. Actors

- **Visitor segment:** an existing CRM person (lead, client, prospecting/expired/FSBO
  owner) or newsletter subscriber, reading mail or texts on their own device. No GA4 query
  was run this session and no device split is claimed (§0); structurally, SMS taps are
  ~100% mobile (the tap happens on the phone that received the text — sibling §3) while
  email opens/clicks happen wherever the recipient reads mail.
- **Automated actors, human-impersonating:** mail-provider image proxies and Apple Mail
  Privacy Protection prefetch the pixel with generic browser UAs — the open route has NO
  bot/prefetch filter (`app/api/track/e/open/route.ts:31-93` reads the UA only to log it,
  `:51`), so a proxy prefetch records as an open (§10 defect 2). Security scanners that
  follow links can record clicks the same way. Contrast: the SMS route filters preview
  bots (`app/r/[code]/route.ts:23`; `lib/data/crm/shortLinks.ts:43-47`).
- **Automated actors, filtered:** CLI/library automation is 403'd upstream by the
  middleware bot screen — `BAD_BOT_RE` includes `curl/` (`middleware.ts:174-177`), and the
  matcher covers every extension-less path including `/api/track/e/*` and `/r/*`
  (`middleware.ts:586-589`). Link unfurlers pass via `GOOD_BOT_RE`
  (`middleware.ts:154-155`).
- **Parallel machine actor:** the Resend webhook (`app/api/webhooks/resend/route.ts:42-64`
  Svix-verified, fail-closed without its secret) writing delivered/open/click/bounce/
  complaint/unsubscribe events for Resend-sent mail.
- **Accountable for completion:** nobody, by design — each request completes autonomously.
  Brokers and admin surfaces are downstream consumers of the signal (§5 step 9), never
  completers.

## 4. Systems of record

| Artifact | SoR |
|---|---|
| What the broker sees as engagement on a person | `crm_timeline` rows: `email_open` (dedupe `track:open:{pid}:{emailKey}`, `app/api/track/e/open/route.ts:41-56`), `email_click` (dedupe `track:click:{pid}:{emailKey}:{url}` — URL-grain, `app/api/track/e/click/route.ts:26-38`), `sms_click` (`lib/data/crm/shortLinks.ts:161-173`) |
| The unified reporting spine (send log, engagement rates, per-broker/per-type splits) | `email_events` (`docs/DATABASE_SCHEMA_SNAPSHOT.md:2514-2531`), written ONLY through `recordEmailEvent` (`lib/crm/email-events.ts:219-272`), idempotent on `dedupe_key` (`:142-156`) |
| Per-issue newsletter stats | `newsletter_recipient_events` (`docs/DATABASE_SCHEMA_SNAPSHOT.md:3631-3645`), appended via `recordNewsletterEngagement` (`lib/newsletter/track-ledger.ts:36-59`) when the emailKey parses as `newsletter:<id>` (`:23-28`) |
| SMS code → target mapping | `crm_short_links` (`docs/DATABASE_SCHEMA_SNAPSHOT.md:2342`; sibling §4) |
| Browser ↔ person identity | `rr_pid` cookie (90-day, httpOnly — `app/actions/identity-bridge.ts:31-32,83-90`) + `visitor_sessions`/`visitor_identity_map` backfill (`identified_via` `email_click_pid`/`email_click_fuid`, `:115-125`; `docs/DATABASE_SCHEMA_SNAPSHOT.md:4941`) |
| The click's destination truth | the signed token itself for email (URL inside the HMAC payload, `lib/email-tracking.ts:71,146`) and `crm_short_links.target_url` for SMS — in both channels the request can never supply the target (anti-open-redirect by construction) |

Explicitly NOT a SoR: Resend's own dashboard analytics (an input via webhook, never read
back); GA4 (receives only a `person_identified` Measurement Protocol event,
`app/actions/identity-bridge.ts:95-103` — engagement rows never come from GA4); the token
(stateless — nothing is stored at sign time for email, so an un-opened email leaves zero
rows anywhere); `crm_timeline` as a rates source (rates come from `email_events` only —
`lib/data/crm/getEmailReporting.ts:12-16`).

## 5. End-to-end path (inception → completion)

Steps 1–2 are the compose-time substrate; 3–7 are the process proper; 8–9 are the parallel
rail and consumption.

1. **Instrument** · server/cron · `attributeOutbound` stamps `?agent=` + `?_pid=`/`?_fuid=`
   on site links FIRST (`lib/crm/attributed-links.ts:76-81` — order matters, `:20-24`),
   then `instrumentEmailHtml` wraps every http(s) link in a signed click token and appends
   the pixel (`lib/email-tracking.ts:139-152`); unsubscribe/preference/agency-disclosure
   links are NEVER wrapped (`isComplianceLink`, `:129-131,145`); no personId → attribution
   only, no tracking (`attributed-links.ts:83-84`) · email HTML + person/broker/emailKey ·
   instrumented HTML · failure: `assertTrackingSecret` throws on a misconfigured prod
   deploy (`email-tracking.ts:39-46`) — the SEND fails loudly, nothing silently untracked ·
   server.
2. **Send** · server/cron · Gmail DWD transport (`lib/crm/gmail.ts:443-445`), Resend
   (`lib/crm/market-report-send.ts:167-174`, `lib/newsletter/send-queue.ts`), or Twilio for
   SMS (sibling §5 steps 1–3) · instrumented body · message on the recipient's device ·
   send failures belong to the sending processes · server.
3. **Open — INCEPTION A** · recipient's mail client (or its privacy proxy) · loads the
   pixel · `GET /api/track/e/open?t=` · verify token (`app/api/track/e/open/route.ts:33`);
   valid → upsert `crm_timeline` `email_open` deduped per person+emailKey (`:41-56`) →
   `recordEmailEvent` open into `email_events`, send_type inferred from the emailKey
   prefix (`:65-72`; `lib/crm/email-events.ts:165-194`) → newsletter ledger when the key
   is `newsletter:<id>` (`:78-87`) · token · three rows (deduped) · failure: EVERYTHING is
   non-blocking — bad/forged token, DB error, ledger error all still return the gif so a
   mail client never shows a broken image (`:29,89-92`) · any device.
4. **Click — INCEPTION B** · recipient · clicks a wrapped link ·
   `GET /api/track/e/click?t=` · verify token; target = signed-in URL if `^https?://`,
   else site root (`app/api/track/e/click/route.ts:18-19`) → upsert `crm_timeline`
   `email_click` (URL-grain dedupe: same link collapses, different link records, `:23-38`)
   → `email_events` click (`:47-55`) → newsletter ledger (`:61-67`) → **302** (`:72`) ·
   token · redirect + three rows · failure: write errors never block the redirect
   (`:68-71`); but a missing prod secret THROWS outside the try (`:18` +
   `lib/email-tracking.ts:40-45`) → the recipient gets a 500, not their page (§10
   defect 3) · any device.
5. **Land + stitch identity** · visitor's browser + server action · the destination URL
   carries `?_pid=`/`?_fuid=` → `PersonIdentityBridge` calls
   `identifyPersonFromEmailClick(Native)` with the client's `rr_session_id`
   (`components/PersonIdentityBridge.tsx:36-42`) — id validated against `crm_people`
   BEFORE cookying (`app/actions/identity-bridge.ts:71-74`; legacy `_fuid` resolved via
   `fub_legacy_id`, `:48-55`) → sets `rr_pid` (90d, `:83-90`), fires GA4
   `person_identified` (`:95-103`), backfills the anonymous session with one delayed
   retry for the race with session creation (`:115-125`) → strips the params from the URL
   and dispatches `person-identified` (`PersonIdentityBridge.tsx:43-52`) · URL params +
   session id · identified session + cookie · failure: invalid/unknown id → no-op
   `{ok:false}`, page unaffected · any device.
6. **Land + stitch (raw-HTML documents)** · browser beacon · `/cma/[slug]` + `/bpo/[slug]`
   serve stored HTML where React bridges never run, so the injected
   `public/rr-doc-tracker.js` posts its page_view FIRST (creating the session row), then
   beacons `/api/track/e/identify?_pid=&sid=` (`rr-doc-tracker.js:10-12,60-66`;
   injection: `app/cma/[slug]/route.ts:152,180`, `app/bpo/[slug]/route.ts:77`,
   `lib/cma/register-gate.ts:95`) → same server actions as step 5
   (`app/api/track/e/identify/route.ts:36-40`) · params · 204 always, even on a bad id
   (`:41-44`) · any device.
7. **SMS tap — INCEPTION C** · CRM person · `/r/<code>`: middleware screen → sanitize →
   resolve from `crm_short_links` → record `sms_click` + counters (human UAs only) → 302
   to the DB-stored target; fail-open to the homepage on any unknown code or error ·
   full step detail: `processes/sms-shortlink-click.md` §5 steps 4–9
   (`app/r/[code]/route.ts:18-33`; `lib/data/crm/shortLinks.ts:140-189`) · mobile.
8. **Parallel observer rail** · Resend webhook · Svix-verified POST
   (`app/api/webhooks/resend/route.ts:42-64`) writes `crm_timeline` rows under the
   `resend:{emailId}:{type}:p{personId}` dedupe keyspace (`:87-98`, kind map `:13-20`)
   AND `email_events` rows anchored on messageId with `sendType: 'other'` (`:147-152`) ·
   provider callback · duplicate-keyed rows beside the pixel rail's (§10 defect 1) ·
   server.
9. **(Post-completion consumption)** · brokers/admin · activity feed renders "Email
   opened" / "Email link clicked" / "Text link clicked"
   (`lib/data/crm/getContactActivityFeed.ts:55,61-62`); the person view folds
   opens/clicks into the `email_out` row ("Opened N×") via `buildEmailEngagement`
   (`app/admin/(protected)/crm/[id]/person-view-model.ts:127-143`, engagement-only kinds
   filtered from the center timeline `:155`); brokerage-wide reporting at
   `/admin/reports/emails` + `/admin/email/campaigns`
   (`app/admin/(protected)/reports/emails/page.tsx:54-56,167-168`,
   `app/admin/(protected)/email/campaigns/page.tsx:100`) reads `email_events` through
   `getEmailReporting` (`lib/data/crm/getEmailReporting.ts:292-329`); prospecting-family
   dashboards count engagement (`lib/data/prospecting/engagement.ts:44-46,132-135`) ·
   desktop/admin.

## 6. Decision points

- **Valid vs invalid token:** open → gif regardless (`app/api/track/e/open/route.ts:29,92`);
  click → 302 to the site root when the token fails or carries a non-http(s) URL
  (`app/api/track/e/click/route.ts:19`). Fail-open toward the recipient in both cases.
- **Compliance links never wrapped** (`lib/email-tracking.ts:129-131,145`;
  `lib/data/crm/shortLinks.ts:29-31`): unsubscribe/preferences/opt-out/agency-disclosure
  stay bare — no engagement "click" logged for an opt-OUT, no tracking hop in front of a
  CAN-SPAM mechanism or a legally-required disclosure. Compliance gate, not optimization.
- **personId present vs absent at compose:** absent → broker attribution only, no
  tracking wrapper (`lib/crm/attributed-links.ts:39-43,83-84`) — engagement is never
  attributed to a guessed person.
- **TTL vs non-expiring tokens:** newsletter family signs `exp` + nonce (180d,
  `lib/newsletter/send-queue.ts:481`; enforcement `lib/email-tracking.ts:100-103`); every
  other family is non-expiring by explicit backward-compat choice (`:74-79,98-99`).
- **Newsletter branch:** emailKey parses as `newsletter:<id>` → additionally append to
  `newsletter_recipient_events`; anything else no-ops the ledger
  (`lib/newsletter/track-ledger.ts:23-28,43-47`).
- **`_pid` vs `_fuid`:** native id preferred when both present
  (`components/PersonIdentityBridge.tsx:40-42`); ids validated against `crm_people` /
  `fub_legacy_id` before any cookie is set (`app/actions/identity-bridge.ts:52-53,73`).
- **Middleware: good bot / bad bot / human** (`middleware.ts:154-177,214-220,586-589`):
  CLI automation 403s before the routes run; unfurlers and humans pass. Route-level UA
  filtering exists ONLY on the SMS leg (`app/r/[code]/route.ts:23`) — the email pixel
  deliberately(?) records proxy prefetches (§10 defect 2).
- **Secret misconfiguration (prod):** both sign and verify hard-fail
  (`lib/email-tracking.ts:39-46`) — fail-closed against forged engagement/open-redirect
  minting. The open route absorbs the throw (pixel still served); the click route does
  not (§10 defect 3).
- **Timeline dedupe grains:** open = person+emailKey (repeat opens collapse); click =
  person+emailKey+URL (distinct links record); sms = person+code. All
  `ignoreDuplicates` upserts — a repeat is a DB no-op, not an error
  (`app/api/track/e/open/route.ts:53-55`; `click/route.ts:35-37`;
  `lib/data/crm/shortLinks.ts:170-172`).
- **Voice canon / §0:** the process emits no public copy and renders no figures — a gif,
  a 204, and 302s have no body; timeline titles ("Email opened") are admin-facing,
  outside canon scope per CLAUDE.md §2. No compliance surface to gate.

## 7. Completion

Done-when (observable), per inception:

- **(A) Open:** the mail client received the gif (200, `image/gif`, no-store), AND —
  for a valid token — `crm_timeline` holds ONE `email_open` row keyed
  `track:open:{pid}:{emailKey}`, `email_events` holds ONE open row for that send, and
  (newsletter keys) `newsletter_recipient_events` holds the deduped open
  (`app/api/track/e/open/route.ts:41-92`).
- **(B) Click:** the browser received a 302 to the exact URL signed at compose time
  (attribution params intact), the three stores hold the click at their grains, and —
  when the target was a site page — the landing browser carries `rr_pid` with the
  visitor session marked `identified_via email_click_pid|email_click_fuid`
  (`app/api/track/e/click/route.ts:26-72`; `app/actions/identity-bridge.ts:83-125`).
- **(C) SMS tap:** per sibling §7 (302 to `target_url` + `sms_click` row + counter
  triplet).

Artifacts at completion: the deduped engagement rows; the `rr_pid` cookie + backfilled
session rows; "Opened N× / clicked" folded onto the send in the person view; the send's
row in the email reporting log advancing sent → delivered → open → click
(`lib/data/crm/getEmailReporting.ts:44-53`).

Terminal states: (a) recorded human engagement (the done-whens above); (b) proxy/scanner
phantom — recorded identically to a human (defect 2 — indistinguishable today);
(c) forged/expired token — gif or homepage-302 served, zero writes; (d) CLI automation —
403 at middleware, routes never run; (e) recipient never opens/clicks — zero rows anywhere,
the email's lifecycle rests at sent/delivered (the pixel is stateless, absence of a row IS
the "not opened" state); (f) preview prefetch on SMS — 302, zero writes (sibling §7b).

## 8. Time & performance

- **Time-to-answer budget:** for an open, zero — the pixel is invisible and the gif
  return is cosmetic. For a click, the visitor's "question" is the tap itself and the
  answer is the destination page: the route performs up to THREE sequential awaited
  store-writes (timeline upsert → email_events insert → newsletter ledger) BEFORE
  returning the 302 (`app/api/track/e/click/route.ts:26-72` — all awaited inside the
  handler), so the hottest contact in the funnel stares at a blank tab for the machine's
  bookkeeping. Same defect class as the SMS leg (sibling §8/§10 defect 1). No latency
  percentile has been measured for `/api/track/e/*` — named gap, no number claimed (§0).
- **Core Web Vitals:** n/a — no route in this process renders a page (gif / 302 / 204
  only; `runtime='nodejs'`, `dynamic='force-dynamic'`,
  `app/api/track/e/open/route.ts:7-8`). CWV accrues to the destination page's process.
- **What "slow" means and who sees it:** the gap between click and destination paint,
  felt by a person acting on mail their broker sent them — the exact moment interest
  peaks. The controllable share is record-before-redirect; the remainder belongs to the
  target page. A secondary "slow": the identity backfill's deliberate 2.5s retry when the
  session row loses the race (`app/actions/identity-bridge.ts:115-121`) — invisible to
  the visitor (post-navigation), correct trade.

## 9. Variants

- **One click path, nine email mint surfaces** (§2): the open/click behavior is
  byte-identical for all of them — same two routes, same token format, same stores.
  Differences are mint-side only: emailKey family (drives `send_type` classification,
  `lib/crm/email-events.ts:165-194`), token TTL (newsletter only), and transport (Gmail
  DWD vs Resend). No split — the process is the open/click, and it does not diverge.
- **Identity-backfill delivery variant:** React bridge on normal pages vs
  `rr-doc-tracker.js` beacon on raw-HTML documents (§5 steps 5–6) — same server actions,
  same trust model, different carrier. Not a separate process.
- **Legacy variant:** pre-cutover FUB emails still in inboxes carry `?_fuid=` and
  non-expiring tokens; the `_fuid` → `fub_legacy_id` resolution path exists solely for
  them (`app/actions/identity-bridge.ts:44-56`). Dies by attrition, never by removal
  (immutable-contract rider, §0).
- **SMS channel** (`/r/<code>`): absorbed sibling — same job, DB-code mint instead of
  signed token, route-level bot filter the email leg lacks, counters the email leg lacks
  (`processes/sms-shortlink-click.md` §5, §9).
- **The Resend webhook rail:** a variant OBSERVER of the same engagement (provider-side
  open/click detection for Resend-sent mail) writing the same stores under different
  dedupe keys — today a double-entry source (§10 defect 1), target-shape: one collapsed
  rail per real event (§11).

## 10. Current implementation map

- **Routes:** `app/api/track/e/open/route.ts`, `app/api/track/e/click/route.ts`,
  `app/api/track/e/identify/route.ts`, `app/r/[code]/route.ts`,
  `app/api/webhooks/resend/route.ts` (parallel rail). None renders UI — no design
  register applies; nothing to inherit, nothing to amnesia.
- **Libraries:** `lib/email-tracking.ts` (sign/verify/instrument),
  `lib/crm/attributed-links.ts` (the ONE compose-time chokepoint),
  `lib/crm/email-events.ts` (the ONE `email_events` write API),
  `lib/newsletter/track-ledger.ts`, `app/actions/identity-bridge.ts`,
  `public/rr-doc-tracker.js`, `lib/data/crm/shortLinks.ts` (SMS leg).
- **DAL:** writes go through `lib/data/crm/insertEmailEvent` /
  `getPersonIdsByEmail` / `getPersonPrimaryEmail` (`lib/crm/email-events.ts:7-10,256`) and
  `lib/data/newsletter/queue.recordLedgerEvent`; reads through
  `lib/data/crm/getEmailReporting.ts` and `lib/data/crm/getContactActivityFeed.ts`.
  Exception: both track routes and the webhook hold raw `createServiceClient().from('crm_timeline')`
  upserts in `app/api/**` (`open/route.ts:35-41`, `click/route.ts:22-26`,
  `webhooks/resend/route.ts:87`) — outside `lib/data/` (G1 seam, presumably
  baseline-exempt; recorded as evidence).
- **Consumers:** §5 step 9 list.
- **Known defects (evidence, this run):**
  1. **Cross-rail double-entry.** For Resend-sent mail, one real open/click can land
     TWICE in both stores: the pixel rail keys `crm_timeline` on
     `track:open:{pid}:{emailKey}` while the webhook keys
     `resend:{emailId}:{type}:p{pid}` (`open/route.ts:53` vs `webhooks/resend/route.ts:95`)
     — different keyspaces, both upserts succeed; and in `email_events` the pixel row
     anchors its dedupe on emailKey (no messageId) while the webhook row anchors on
     messageId with `sendType:'other'` (`email-events.ts:149-155`;
     `webhooks/resend/route.ts:148-152`), so `summarizeEngagement`'s distinct-by-(sendKey,
     event) guard sees two different sendKeys (`getEmailReporting.ts:158-166,292-305`) and
     counts the open twice, under two send types. The newsletter LEDGER alone collapses
     both rails (recipient-scoped dedupe, `lib/newsletter/track-ledger.ts:9-13`) — the fix
     pattern already exists in-repo. Mechanism confirmed in code; the live duplication
     rate is unmeasured (§12 check 8 measures it).
  2. **No prefetch filter on the open pixel.** Apple MPP / Gmail image proxies load
     pixels without a human open; the route records them all
     (`open/route.ts:31-93` — UA logged, never classified). The open signal's fidelity is
     unknown and unmeasured. The in-house pattern for filtering exists on the SMS leg
     (`shortLinks.ts:43-47`).
  3. **Click route 500s on a misconfigured prod secret.** `verifyEmailToken` (which
     throws via `assertTrackingSecret`) runs OUTSIDE the try in the click handler
     (`click/route.ts:18` vs the open route's inside-try `:32-33`) — the fail-closed
     posture is right, but its blast radius is the recipient (error page instead of
     destination) rather than only the telemetry.
  4. **Non-expiring tokens outside the newsletter family** (`email-tracking.ts:74-79`).
     A forwarded email attributes the forwardee's opens/clicks to the original recipient
     forever (acknowledged at `open/route.ts:38-40`); dedupe caps the damage at one row
     per grain but the identity-stitch leg (`?_pid=`) will cookie the WRONG browser to
     the person on a forwarded site link. Trust model documented ("possession of the link
     IS the identification", `identity-bridge.ts:65-66`) — recorded here as its sharpest
     edge.
  5. **Engagement fold keys on the LABEL.** `buildEmailEngagement` maps rows by
     subject-label (`person-view-model.ts:130-133`) — two different sends sharing a
     subject merge into one "Opened N×" figure on the person view.
  6. **1:1 newsletter sends never reach the ledger.** The broker 1:1 path signs
     `newsletter:<id>:p<personId>` (`contact-newsletter.ts:196`);
     `parseNewsletterEmailKey` returns `<id>:p<personId>` (`track-ledger.ts:23-28`),
     which cannot match a newsletter UUID, so `getRecipientForPerson` no-ops. Possibly
     intended (no queue-recipient row exists for a 1:1 resend) — but the no-op is an
     accident of parse failure, not an explicit branch. Intent unconfirmed.
  7. **SMS-leg defects** — carried in the sibling PDS §10 (record-before-redirect,
     non-atomic counters, tracked-body legibility in broker threads, dead `message_sid`,
     native-contact `_pid` gap on governed SMS).
  8. **Doc gap:** `email_events`, `newsletter_recipient_events`, and `crm_short_links`
     appear in `docs/DATABASE_SCHEMA_SNAPSHOT.md` (`:2514,:3631,:2342`) but are absent
     from `docs/DATABASE_FOR_AI_AGENTS.md` (grep this run: zero hits) — the curated table
     guide doesn't know the engagement spine exists.
- **Duplicate/parallel paths that should die:** none should die — but the two email
  observation rails (pixel/click vs webhook) must COLLAPSE into one deduped event per
  real-world engagement (defect 1). The two `crm_timeline` writers and two `email_events`
  keyspaces are the duplication; the routes themselves are immutable contracts (§0).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** It is the measurement half of every outbound-comms loop the
brokerage runs — without it, sends are fire-and-forget and the CRM's "engagement" panels,
sequence pause-on-engagement judgment, and per-broker reporting have no ground truth. It
is also the purest machine-only instance of founding directive #3 (decisions.md
2026-08-11: "one lead-generation machine that never acts like it") — the visitor never
sees the process at all, and the machine outcome exists ONLY as a side effect of serving
the open/click — and the enabling mechanism for directive #5 (continuity): the click
redirect + identity stitch is where CRM identity crosses into the web session, so
established context can follow the person.

**Ideal shape:** for the recipient, zero steps — the message just works. Keep exactly
that. Machine-side, four convergences (none changes the visitor-facing shape):

1. **One event, one row:** collapse the pixel/webhook double-entry — a shared dedupe
   grain per real engagement across both rails (the newsletter ledger's recipient-scoped
   key is the proven in-repo pattern), and webhook rows classified by the send's real
   type, not `'other'`.
2. **Respond, then record:** the 302 returns before the bookkeeping writes (both email
   click and SMS tap).
3. **Classify machine opens:** the open signal distinguishes proxy-prefetch from human
   (UA/behavioral classification at minimum), so "Opened" on a person means a person.
4. **One engagement taxonomy across channels:** email + SMS (+ any future channel) as one
   process with per-channel mint mechanics, one timeline kind family, one reporting
   spine.

**Immutable external contracts:** `/api/track/e/open|click|identify` and `/r/<code>` URLs,
every already-signed non-expiring token, and every minted short code live in sent messages
on clients' devices indefinitely — no P5 rename, no expiry sweep, no route retirement,
ever. This is the SEO-equity carve-out's harder sibling: nothing can rewrite a sent email.

**Destination implication:** **NOT a destination.** Invisible infrastructure — no page,
no nav presence, no design register; it appears in no IA tree P5 draws. Its dual
objective governs the routes' behavior and what they hand the destination page:

- `visitor_objective`: "The message you received keeps its promises — images load, links
  open the exact page you were told, instantly, even years later, even mangled; opting
  out is never watched or intercepted."
- `machine_objective`: "Convert every open and tap on outbound mail and texts into ONE
  deduped person-level engagement row on the reporting spine, and deliver the destination
  page a recognized, broker-attributed visitor (rr_pid set, session history stitched,
  attribution params intact through the redirect)."
- `exits`: the compose-time-signed/stored target URL — any node in the site graph (the
  promised page IS the exit); the site root on a bad token/code; the 1x1 gif (no
  navigation) for opens; a 204 for the identify beacon. A tracker has no chrome and no
  other doors.

**Data gaps blocking correctness:** none blocking — the chain (instrument → send →
open/click → record → stitch → consume) is complete and closed. Named measurement gaps
(§0 — no number claimed for any of them): no latency percentile for `/api/track/e/*` or
`/r/*`; proxy-open share of `email_open` unmeasured (defect 2); cross-rail duplication
rate unmeasured (defect 1; §12 check 8 is the measuring query); volume of still-live
`_fuid`-era mail unmeasured.

## 12. Acceptance checks

Persist; never delete. Production is `ryan-realty.com`; the middleware bot screen 403s
CLI UAs (`BAD_BOT_RE` includes `curl/`, `middleware.ts:174-177`), so checks use
`UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'`.

1. **CLI screen:** `curl -sI https://ryan-realty.com/api/track/e/open?t=x | head -1` →
   `403` (default curl UA; `x-bot-screen: bad-ua`). Proves terminal (d).
2. **Pixel fail-open:** `curl -sI -A "$UA" 'https://ryan-realty.com/api/track/e/open?t=garbage'`
   → `200`, `content-type: image/gif`, `cache-control: no-store...`. Zero rows written
   (invalid token short-circuits before any write — `open/route.ts:33-34`).
3. **Click fail-open:** `curl -sI -A "$UA" 'https://ryan-realty.com/api/track/e/click?t=garbage'`
   → `302`, `location: https://ryan-realty.com` (`click/route.ts:19,72`).
4. **Instrumentation unit tests:** `npx vitest run lib/email-tracking.test.ts lib/crm/attributed-links.test.ts lib/crm/email-events.test.ts`
   — green (wrap/skip/idempotency, attribute-then-instrument ordering, dedupe-key
   determinism).
5. **Compose E2E:** send a CRM composer email containing a `https://ryan-realty.com/...`
   link and an unsubscribe link to a TEST person. In the sent HTML verify: every content
   link is `https://ryan-realty.com/api/track/e/click?t=...`; the unsubscribe link is
   bare; exactly one `/api/track/e/open?t=` pixel before `</body>`; decoding the click
   token's payload (base64url before the `.`) shows `u` carrying the destination WITH
   `?agent=<slug>` (and `_pid=<personId>`).
6. **Open E2E:** load the pixel URL in a real browser. Then
   `SELECT count(*) FROM crm_timeline WHERE dedupe_key = 'track:open:' || :pid || ':' || :emailKey`
   → 1; `SELECT count(*) FROM email_events WHERE email_key = :emailKey AND event = 'open'`
   → 1. Reload the pixel → both counts still 1 (dedupe grain).
7. **Click E2E + identity stitch:** open the click URL in a fresh browser profile →
   lands on the exact signed destination; `rr_pid` cookie present; URL params `_pid`
   stripped after load. Then
   `SELECT count(*) FROM crm_timeline WHERE dedupe_key = 'track:click:' || :pid || ':' || :emailKey || ':' || :url`
   → 1, and
   `SELECT identified_via FROM visitor_sessions WHERE fub_person_id = :pid ORDER BY started_at DESC LIMIT 1`
   → `email_click_pid`.
8. **Cross-rail duplication measure (defect 1):**
   `SELECT t1.person_id, t1.title, count(*) FROM crm_timeline t1 WHERE t1.kind = 'email_open' GROUP BY 1,2 HAVING count(DISTINCT t1.source) > 1 LIMIT 20`
   — any row with both `email-tracking` and `resend` sources for one send is the
   double-entry. Companion on the spine:
   `SELECT recipient_email, subject, event, count(*) FROM email_events WHERE event IN ('open','click') GROUP BY 1,2,3 HAVING count(DISTINCT dedupe_key) > 1 LIMIT 20`.
   Target shape (§11.1) is proven when both return zero NEW rows post-fix.
9. **Doc-beacon identity:** open a delivered `/cma/<slug>?_pid=<pid>` link → network log
   shows `POST /api/visitors/track` then `GET /api/track/e/identify?...&sid=` returning
   204 (`rr-doc-tracker.js:60-66`); the session row stitches as in check 7.
10. **Newsletter ledger:** after a queue-sent newsletter open (emailKey
    `newsletter:<uuid>`),
    `SELECT count(*) FROM newsletter_recipient_events WHERE newsletter_id = :id AND event = 'open' AND email = :email`
    → 1, stable across pixel refires AND the Resend webhook's duplicate observation
    (recipient-scoped dedupe — `track-ledger.ts:9-13`).
11. **Anti-open-redirect:** take a valid click token, alter one character of its payload,
    request it with `$UA` → 302 to `https://ryan-realty.com` (HMAC fails,
    `email-tracking.ts:89-95`) — the destination cannot be tampered.
12. **Compliance exclusion:** in any production send's HTML,
    `grep -c 'api/track/e/click' <(grep -o 'href="[^"]*unsubscribe[^"]*"' body.html)` → 0
    (unsubscribe never wrapped, `email-tracking.ts:129-131,145`).
13. **Consumer surfaces:** the test person's activity feed shows "Email opened" / "Email
    link clicked" (`getContactActivityFeed.ts:61-62`); the person view's `email_out` row
    shows "Opened 1×" (`person-view-model.ts:127-143`); `/admin/reports/emails` send log
    shows the send with `latestEvent` ≥ open (`reports/emails/page.tsx:167-168`).
14. **SMS leg:** run `processes/sms-shortlink-click.md` §12 checks 1–11 (absorbed
    unchanged).

Cleanup after 5–10: delete the test person's `crm_timeline`, `email_events`, and
`newsletter_recipient_events` test rows.
