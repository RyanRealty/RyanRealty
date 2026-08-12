# Process: view-client-valuation-doc — Client opens a delivered CMA/BPO document (register-gated, tracked)

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a recipient clicks a link; no cron produces this process.
  The `crm-alert-drain` cron (`vercel.json:21-22`) would deliver first-open broker
  alerts, but nothing on the live path enqueues them — the alert feeder is orphaned,
  §10 D6)
- Verdict: **PROPOSAL — KEEP.** This is the consumption half of the valuation loop: the
  written-CMA process ends when the document is delivered and opened; THIS process is the
  door, the read, the consent capture, and the engagement telemetry — and it serves three
  document families (private CMA, client-safe BPO, published-CMA token delivery), two of
  which the written-CMA funnel never touches. One scope correction proposed for P3: the
  `/api/cma-document/[token]` path's INCEPTION is a listing-detail visitor registering on
  a public listing page (a `find-a-home` moment), not a broker send — P1's registry row
  conflated it; the delivery endpoint stays documented here, the registration moment
  belongs to the listing-detail process. This is a proposal for the P3 package, not a lock.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A client or lead reads the valuation their broker actually prepared for them — the
number and every comparable behind it — privately, on any device, from one emailed or
texted link. (b) The machine outcome is identity + consent + proof-of-read: serving the
document requires the recipient to sign in as the person it was built for, which stitches
their anonymous web history to their CRM record, captures the one-time SMS/email consent
ask, and stamps opens and clicks onto the person's timeline so the broker knows the
document landed — the client-step this advances is "delivered valuation confirmed read,
contactable relationship deepened," and it is produced by the very act of opening the door
that serves (a).

## 2. Inception (what starts it)

Trigger: a recipient clicks an unlisted document link that a broker send put in front of
them. Entry channel is always **direct/referral (email or SMS click)** — never organic
search: every serve path sets `X-Robots-Tag: noindex, nofollow` and `Cache-Control:
private, no-store` (`app/cma/[slug]/route.ts:35-39`, `app/bpo/[slug]/route.ts:80-88`,
`app/api/cma-document/[token]/route.ts:44-54`).

Concrete entry routes:

| Door | Link minted by | Evidence |
|---|---|---|
| `/cma/[slug]` | The CRM send rail (`READ THE FULL REPORT` button + text fallback) and the finalize-deliver email; the sequence engine's `%cma_link%` touches reuse the same URL stamped on the person | `lib/cma/send.ts:111,124-129,286,297,384`; `lib/cma-deliver.ts:256,274-275` |
| `/bpo/[slug]` | The BPO send rail (only door: an explicit broker-triggered send to the linked CRM contact) | `lib/bpo/send.ts:1-22,78,259` |
| `/api/cma-document/[token]` | `registerForCmaDocumentAction` after a visitor registers on a public listing page (`PublishedCmaDownload.client.tsx` on `app/listing/[listingKey]/page.tsx`) — inception belongs to listing-detail, delivery lands here | `app/actions/cma-download.ts:52,206`; `lib/data/cma/getPublishedCma.ts:487-531` |

Every outbound email link passes through `attributeOutbound`, which stamps
`?agent=<broker>` + `?_pid=<crm_people.id>` (or legacy `?_fuid=`) on the destination and
wraps it in the signed click tracker (`lib/crm/attributed-links.ts:1-33,62-80`;
`lib/cma/send.ts:332`; `lib/bpo/send.ts:376`). So the canonical email click actually hits
`/api/track/e/click` first — an `email_click` row lands on `crm_timeline` — then 302s to
the document URL carrying the identity params (`app/api/track/e/click/route.ts:15,26-29`).
SMS deliveries arrive via the sibling `sms-shortlink-click` process (short-link taps land
in `crm_timeline`; aggregated per-doc by `lib/data/cma/getCmaPerformance.ts:5-12`).

Preconditions: the document must be client-ready — CMA `status IN
('finalized','delivered')` (`app/cma/[slug]/route.ts:60-73`), BPO `status = 'final'`
(`app/bpo/[slug]/route.ts:36-49`), published-CMA `published_to_listing = true` re-checked
per request (`lib/data/cma/getPublishedCma.ts:544-585`). JavaScript is not required to
read the document (tracker and interactive layer are progressive; no-JS renders the full
static artifact — `public/rr-cma-doc.js:1-19`).

## 3. Actors

- **Visitor segment:** a KNOWN person, not an anonymous browser — the seller lead or
  client the CMA was built for (`cmas.client_email` / linked `crm_people` row,
  `lib/data/cma/documents.ts:129-171`), or the buyer/seller client a BPO is linked to (a
  BPO "can only ever go to its linked CRM contact," `lib/bpo/send.ts:13-17`), or a
  listing-page registrant with a bona-fide interest (ODS terms,
  `lib/data/cma/getPublishedCma.ts:70-81`). Device reality: mobile-first is the locked
  program truth; the document and gate shells are viewport-responsive self-contained HTML
  (`lib/cma/register-gate.ts:64-72`). A GA4/device split for these unlisted routes was
  not queried this pass — gap in §11, not asserted.
- **Automated actors:** the injected `rr-doc-tracker.js` (page_view, identity stitch,
  click telemetry — `public/rr-doc-tracker.js:1-16`); `rr-cma-doc.js` (screen-only
  interactive layer — `public/rr-cma-doc.js:1-19`); `/api/track/e/identify` (cookie +
  session backfill — `app/api/track/e/identify/route.ts:1-45`); the live email
  open-pixel/click trackers (`app/api/track/e/open/route.ts:31-92`;
  `app/api/track/e/click/route.ts:17-72` — timeline + `email_events` rows, no broker
  alert). NOT a live actor: the CMA-specific open/view route
  (`app/api/cma/[slug]/track/route.ts:6-24`) would queue a first-open broker alert,
  but no email embeds its URLs — orphaned, §10 D6.
- **Accountable for completion:** the sending broker — they trigger the send, read the
  open/click telemetry on the person's timeline (`crm_timeline`
  `email_open`/`email_click` rows; no push alert fires today, §10 D6), and own the
  follow-up (`lib/cma/send.ts:1-20`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The CMA document + lifecycle status | `public.cmas` (`html_content` print artifact + `render_args` for the immersive view — one data source, two presentations) | `lib/data/cma/documents.ts:42-64`; `app/cma/[slug]/route.ts:126-134` |
| The BPO document + status | `public.broker_price_opinions` | `lib/data/bpo/reads.ts:1-13` |
| Who may open a CMA (identity), claim, and the consent flag | `crm_people` — `emails`, `custom.cmaConsent`, `custom.cmaClaimedBy` | `lib/data/cma/documents.ts:146-161`; `app/api/cma/register/route.ts:61-92` |
| Consent audit (exact wording version, choices, viewer) | `crm_timeline` row, dedupe-keyed `cma-register:<slug>:<personId>` (first writer wins) | `app/api/cma/register/route.ts:94-104` |
| Read + on-document click telemetry | `visitor_sessions` + `visitor_events` (`page_category='client-document'`) | `public/rr-doc-tracker.js:40-56,89-103`; `app/api/visitors/track/route.ts:1-35`; `docs/DATABASE_SCHEMA_SNAPSHOT.md:4958` |
| Email opens/clicks | `crm_timeline` (`email_open` / `email_click`) + `email_events` keyed `cma:<slug>` | `app/api/track/e/open/route.ts:27,41-44`; `app/api/track/e/click/route.ts:15,26-29`; `lib/data/cma/getCmaPerformance.ts:7-12` |
| Published-CMA registrations + delivery tokens (hashed) + delivery counts | `public.cma_document_registrations` | `lib/data/cma/getPublishedCma.ts:514-531,573-580`; `docs/DATABASE_SCHEMA_SNAPSHOT.md:1558` |
| First-open broker notices | `crm_broker_alerts` queue + drain exist but receive NOTHING from this process — the only CMA-open feeder is an orphaned route no email links to (§10 D6) | `app/api/cma/[slug]/track/route.ts:47-52`; `vercel.json:21-22` |

Explicitly NOT a SoR: the served HTML response (regenerated per request, `no-store` —
`app/cma/[slug]/route.ts:41-43,154-162`); the `rr_pid` cookie (a pointer to the person,
never the record — `app/actions/identity-bridge.ts:31,83-95`); GA4 (`fireLeadGenerated`
mirror on the token path is best-effort — `app/actions/cma-download.ts:195-204`); the
stored `page_url` never carries identity params (privacy rule —
`public/rr-doc-tracker.js:36-38`).

## 5. End-to-end path (inception → completion)

Primary path: a CMA recipient opening from the delivery email (mobile).

1. **Email click** — recipient · taps `READ THE FULL REPORT` · input: instrumented link ·
   output: `email_click` on `crm_timeline`, 302 to `/cma/<slug>?agent=…&_pid=…` · touches
   `crm_timeline` · failure: expired/malformed token falls through to an error, the raw
   URL in the plain-text body still works (`lib/cma/send.ts:129,178`) · device: mobile
   mail client (`lib/crm/attributed-links.ts:62-80`; `app/api/track/e/click/route.ts:15,26-29`).
2. **Slug validation + row read** — machine · `/^[a-z0-9-]{3,80}$/` else 400; DAL read
   of `html_content, html_path, status, render_args, broker_slug` · missing slug → 404
   (`app/cma/[slug]/route.ts:49-57`; `lib/data/cma/documents.ts:42-64`).
3. **Publication gate** — machine · only `finalized`/`delivered` serve publicly; draft/
   building/archived are admin-only (review iframe) and 404 to everyone else, so a
   guessed slug never leaks an unreviewed number or client PII
   (`app/cma/[slug]/route.ts:60-73`).
4. **Access decision** — machine · loads identity (client email, linked person's emails,
   claim marker, consent flag — `lib/data/cma/documents.ts:129-171`) · pure decision:
   serve / register / consent / claim-and-consent / wrong-person
   (`lib/cma/register-gate.ts:30-53`; gate wiring `app/cma/[slug]/route.ts:79-117`).
5. **Register shell** (signed-out) — visitor · branded self-contained card: benefits
   list, "Continue with Google", prepared-for line, privacy/terms links · the shell
   itself carries `rr-doc-tracker.js`, so even the pre-auth knock records a
   `client-document` page_view (`lib/cma/register-gate.ts:94-98,101-119`;
   `app/cma/[slug]/route.ts:89-98`) · failure: no Google account → stuck (§10 D1).
6. **Google OAuth** — visitor+machine · `GET /api/cma/register?slug&start=1` →
   `getSignInUrl('google', /cma/<slug>)` → provider round-trip returns to the document
   (`app/api/cma/register/route.ts:25-32`).
7. **Consent shell** (signed-in, identity OK or claimable) — visitor · one-time ask: two
   OPTIONAL checkboxes (email updates; SMS with the carrier-verified `SMS_CONSENT_TEXT`
   verbatim) + "View my report" · consent is never a condition of viewing (TCPA)
   (`app/cma/[slug]/route.ts:99-110`; `lib/cma/register-gate.ts:122-150`;
   `lib/crm/sms-consent-text` import at `app/cma/[slug]/route.ts:33`).
8. **Registration POST** — machine · re-derives the access decision server-side; writes
   `custom.cmaConsent` `{sms, email, at, slug, viewer, consentVersion:'a2p-2026-06'}`;
   phone-only leads bind-on-first-register (claimer's email becomes the doc identity AND
   a contact point); audited timeline row carries the exact consent wording; 303 back to
   the document (`app/api/cma/register/route.ts:34-108`).
9. **Serve the immersive document** — machine · re-entry now decides `serve`; broker row
   resolved; `renderImmersiveCmaHtml(render_args, origin)` renders the scrollytelling
   view per-request from the SAME persisted args the print artifact was built from (every
   figure matches the PDF — the §0 guarantee); `rr-doc-tracker.js` injected before
   `</body>`; headers `noindex/no-store/SAMEORIGIN` (`app/cma/[slug]/route.ts:123-162`).
   Fallback: immersive render failure or missing `render_args` serves the stored print
   artifact with fonts repointed to the serving origin plus BOTH scripts (tracker +
   interactive layer) (`app/cma/[slug]/route.ts:163-194`).
10. **Read telemetry + identity stitch** — machine · tracker posts `page_view`
    (`pageCategory:'client-document'`, essential consent, same `rr_session_id`
    localStorage key as the site) → then calls `/api/track/e/identify?_pid&sid` → server
    validates the id against `crm_people`, sets the `rr_pid` cookie, backfills the
    anonymous session (`identified_via email_click_pid`) → tracker strips `_pid/_fuid`
    from the address bar (`public/rr-doc-tracker.js:40-74`;
    `app/api/track/e/identify/route.ts:29-45`; `app/actions/identity-bridge.ts:77-123`).
11. **On-document clicks** — visitor+machine · one delegated listener posts a `cta_click`
    per anchor tap; navigation never blocked; fails silent
    (`public/rr-doc-tracker.js:76-107`).
12. **Broker learns it landed (pull, not push)** — machine · the instrumented email's
    pixel and wrapped links land `email_open` / `email_click` rows on `crm_timeline` +
    `email_events` (the click row landed at step 1; the open row lands whenever the
    mail client loads the pixel — `app/api/track/e/open/route.ts:41-72`;
    `app/api/track/e/click/route.ts:26-55`), surfaced on the person's comms chain and
    the CMA performance report (`lib/data/cma/getCmaPerformance.ts:5-12`). NO push
    alert fires: the first-open broker-alert route exists but nothing embeds its URLs
    (§10 D6).
13. **Print/PDF form** — visitor · `?print=1` serves the stored print artifact
    (`app/cma/[slug]/route.ts:133-134`); the delivery email already attached the PDF
    (`lib/cma/send.ts:1-20`), so the client never needs an authenticated endpoint.

## 6. Decision points

- **Publication gate** — finalized/delivered (CMA), final (BPO), published flag (token
  path) or the document does not exist to the public; admin role (non-`report_viewer`)
  bypasses for the review iframe (`app/cma/[slug]/route.ts:60-73`;
  `app/bpo/[slug]/route.ts:36-49`; `lib/data/cma/getPublishedCma.ts:544-585`).
- **Who gets through the CMA door** — email match against client email ∪ person emails ∪
  claimer; no emails on file at all → first registrant claims (bind-on-first-register,
  audited); a non-matching signed-in email → 403 wrong-person with a "want your own?"
  exit (`lib/cma/register-gate.ts:30-53,153-163`).
- **Consent is asked, never required** — the POST succeeds with both boxes unchecked and
  the report opens either way (TCPA: express consent cannot be a condition of service)
  (`lib/cma/register-gate.ts:17-21`; `app/api/cma/register/route.ts:10-12,58-59`).
- **BPO client-safety fails closed** — the internal Offer strategy block is stripped for
  every non-admin serve; if the strip marker is missing/truncated the route serves a 404
  rather than the raw HTML (`app/bpo/[slug]/route.ts:52-68`).
- **Token path is opaque and revocable** — one failure shape for expired/revoked/
  unpublished/nonexistent (no token probing); the publish flag is re-checked on EVERY
  request so unpublishing kills all outstanding links; tokens stored only as SHA-256
  hashes; 30-day TTL (`app/api/cma-document/[token]/route.ts:28-35`;
  `lib/data/cma/getPublishedCma.ts:48,547-585`).
- **Privacy** — identity params never persist: stored `page_url` is the clean URL and the
  tracker rewrites the address bar; every serve is `noindex + private, no-store`; the
  token route adds `noarchive` + `Referrer-Policy: no-referrer`; registration IPs stored
  only as hashes (`public/rr-doc-tracker.js:36-38,65-70`;
  `app/api/cma-document/[token]/route.ts:44-54`; `app/actions/cma-download.ts:162-165`).
- **ODS/IDX compliance** — the gate is on WHO gets the document, never on WHAT is in it:
  ODS §7-5 D preserves full comps in a client valuation; the published-CMA registration
  satisfies §5-4 C/F (name, valid email, affirmative terms agreement, versioned terms)
  (`app/api/cma-document/[token]/route.ts:7-16`; `app/actions/cma-download.ts:13-24,92-99`;
  `lib/data/cma/getPublishedCma.ts:55-81`).
- **§0 data honesty** — the immersive view renders from the same persisted `render_args`
  as the print artifact so web and PDF never diverge; the interactive layer's count-up
  always ends on the verified number in markup (`app/cma/[slug]/route.ts:126-134`;
  `public/rr-cma-doc.js:3-19`).
- **Voice canon** — the gate shells and the document are public client-facing copy under
  the canon; the published-CMA reader sanitizes client prose
  (`lib/data/cma/getPublishedCma.ts:46`).
- No-public-Coming-Soon: n/a — no listing inventory renders on these surfaces; the
  documents are per-property valuations.

## 7. Completion

Done-when (observable): the client-ready document is RENDERED for the verified
recipient, and the machine has all three receipts — (1) a `visitor_events` `page_view`
with `page_category='client-document'` on the recipient's session, (2) the session
stitched to the CRM person (`rr_pid` cookie set, backfill row `identified_via
email_click_pid`), and (3) the consent decision recorded (`custom.cmaConsent` + the
audited timeline row). Broker awareness is pull-only: the open/click receipts sit on
the person's timeline and the performance report — no push alert fires on first
open/view today (the alert mechanism is orphaned, §10 D6), so "broker alerted" is NOT
a completion criterion this process currently produces.

Artifacts at completion: `crm_people.custom.cmaConsent` (+ `cmaClaimedBy` when claimed,
+ a `Registered` email contact point for phone-only leads); `crm_timeline` rows
(`email_click`/`email_open`, the `CMA page registered by …` audit);
`visitor_sessions`/`visitor_events` rows; for the token path a
`cma_document_registrations` row with `first_delivered_at` + incremented
`delivery_count` (`lib/data/cma/getPublishedCma.ts:573-580`); for a BPO send,
`last_sent_at` on the opinion (`lib/bpo/send.ts:416-417`).

Terminal states: **served + read** (success) · **register shell shown, never signed in**
(knock recorded, door never opened — visible as a `client-document` page_view with no
identify) · **wrong-person 403** (`lib/cma/register-gate.ts:153-163`) · **404** (draft/
building/archived/unpublished/expired token/failed BPO strip) · **legacy redirect** (old
file-based CMA 302s to its committed static asset — `app/cma/[slug]/route.ts:197-203`).

## 8. Time & performance

- **Time-to-answer budget:** the document IS the answer; the gate is deliberate friction
  and must stay at most two interactions (one Google sign-in round-trip + one optional
  consent form) between click and content — that is exactly what the code implements
  today (§5 steps 5–8), and any future step added to the door is a regression against
  this budget. Repeat visits with consent recorded serve the document in ZERO
  interactions (`lib/cma/register-gate.ts:52`).
- **Serve cost:** every serve is per-request (`revalidate = 0`, `private, no-store`) and
  the immersive path renders the full document server-side on each hit
  (`app/cma/[slug]/route.ts:41-43,147-153`). No render-latency measurement was taken
  this pass — no number stated; flagged as a §11 gap.
- **Core Web Vitals:** these are unlisted, noindexed routes — they will never appear in
  GSC/CrUX, so the only latency evidence available is our own telemetry, which records
  page_views but no performance timings (`public/rr-doc-tracker.js:40-56`). Not
  measured this pass; §11 gap.
- **Who sees "slow":** a known client the broker just personally emailed — the highest-
  stakes audience the site has. A slow or broken document here burns an existing
  relationship, not an anonymous session.
- **Alert latency:** none — no first-open alert is queued on the live path (§10 D6).
  The drain cron runs every minute (`vercel.json:21-22`) and WOULD deliver within
  ~1 minute of a queue write, but its CMA-open feeder is orphaned; broker awareness
  today is pull-only (timeline / performance report).

## 9. Variants

Sharing this process (attributes, not forks):

- **Immersive vs print presentation** — `?print=1` serves the stored print artifact; both
  render from one data source (`app/cma/[slug]/route.ts:126-134,168-194`).
- **Email click vs direct/SMS open** — the email click adds `email_click` + `_pid`
  stitching; a bare URL (texted, forwarded within the household) still gets the
  publication gate, register door, and page_view telemetry, just no pre-stitched
  identity; SMS taps arrive via the `sms-shortlink-click` sibling process
  (`lib/data/cma/getCmaPerformance.ts:7-12`).
- **Known-consented repeat visit** — straight to the document, zero shells
  (`lib/cma/register-gate.ts:52`).
- **Phone-only lead (claim path)** — first registrant claims; the claim writes the email
  onto the person so later visits email-match normally
  (`app/api/cma/register/route.ts:79-92`).
- **Admin preview** — the same URLs serve drafts and full variants to authenticated
  admins (review iframe, broker preview) with no gate shells
  (`app/cma/[slug]/route.ts:67-79`; `app/bpo/[slug]/route.ts:39-50`).
- **Legacy file-based CMA** — 302 to the committed static asset
  (`app/cma/[slug]/route.ts:197-203`).

Materially divergent doors under one process:

- **BPO** (`/bpo/[slug]`) — same serve mechanics (fonts, tracker + interactive layer,
  headers) but NO register/consent door: any holder of the link sees the client-safe
  document once final; the offer-strategy strip is the whole client-safety boundary
  (`app/bpo/[slug]/route.ts:33-88`). The asymmetry with the CMA door is a P3 question
  (§10 D2), not an accident to silently "fix" either way.
- **Published-CMA token** (`/api/cma-document/[token]`) — full document for a
  listing-page registrant; hashed token, 30-day TTL, per-request publish re-check;
  delivery stamped and counted (`app/api/cma-document/[token]/route.ts:24-55`;
  `lib/data/cma/getPublishedCma.ts:487-585`). Its registration/inception moment lives on
  the listing page (`app/actions/cma-download.ts:52-207`,
  `components/site/listing-detail/PublishedCmaDownload.client.tsx`) — proposed P3
  re-homing per §0 Meta.

## 10. Current implementation map

- **Routes:** `/cma/[slug]` + `/bpo/[slug]` (route handlers serving self-contained
  stored/rendered HTML), `/api/cma/register` (GET OAuth start, POST consent),
  `/api/cma-document/[token]`, `/api/cma/[slug]/track` (open pixel/view redirect —
  ORPHANED, zero producers of its URLs; D6),
  `/api/track/e/{open,click,identify}`, `/api/visitors/track`, `/api/cma/[slug]/pdf`
  (admin/cron-guarded render — `app/api/cma/[slug]/pdf/route.ts:1-27`).
- **Registers/design languages:** NONE of the five site registers — the documents and
  gate shells are self-contained inline-styled HTML carrying the brand directly (navy/
  cream constants in `lib/cma/register-gate.ts:57-58`; motion-ladder-compliant reveal in
  `public/rr-cma-doc.js:12-19`). Behavior fact only; §11 owns what these should become.
- **Client scripts (serve-time injected, never stored):** `rr-doc-tracker.js` (telemetry
  + identity) and `rr-cma-doc.js` (sticky contents bar, reveal motion, count-up; skipped
  under `prefers-reduced-motion`; self-guards on unrecognized documents)
  (`app/cma/[slug]/route.ts:172-183`; `public/rr-cma-doc.js:20-26`).
- **Known defects (all verified this pass):**
  - **D1 — Google-only door.** The register shell offers exactly one identity path,
    "Continue with Google" (`lib/cma/register-gate.ts:103,114`;
    `app/api/cma/register/route.ts:29-31`). A lead whose on-file email is not a Google
    account cannot email-match (their Google sign-in yields a different address →
    wrong-person 403), and the claim path only opens when NO email is on file
    (`lib/cma/register-gate.ts:42-51`). No magic-link or non-Google fallback exists on
    this door. The delivery email's attached PDF (`lib/cma/send.ts:1-20`) is the de facto
    fallback — the web experience is simply lost for those recipients.
  - **D2 — CMA/BPO gate asymmetry.** The CMA door requires identity + consent (Matt
    2026-08-05 directive in code comments); the BPO serves client-safe content to any
    link holder with zero identity check (`app/bpo/[slug]/route.ts:33-49`). Both carry
    per-property valuations of a client's position. Whether BPO inherits the register
    door is an open P3 question (§11).
  - **D3 — consent flag is person-global and last-writer-wins.** The gate reads
    `Boolean(custom.cmaConsent)` (`lib/data/cma/documents.ts:160`) — one consent event
    anywhere opens every CMA the person ever receives, and each registration POST
    overwrites the consent object (`app/api/cma/register/route.ts:69-77`) while the
    timeline audit row is first-writer-wins per (slug, person)
    (`:94-104`) — so the live flag and its audit can diverge after a re-registration.
  - **D4 — click telemetry drops the destination.** The tracker's `cta_click` posts the
    link TEXT as `pageTitle` (href only as fallback), so for every labeled anchor the
    click destination is not recorded despite the docblock promising "destination + link
    text" (`public/rr-doc-tracker.js:76-103`).
  - **D5 — stale infrastructure comment.** `app/api/cma/[slug]/track/route.ts:20-21`
    still describes the alert relay as "mac mini relay"; the Mac mini is retired
    (VM parity). Comment drift only — the queue + drain path is live
    (`vercel.json:21-22`).
  - **D6 — the first-open broker alert is orphaned instrumentation.** The route that
    queues it (`app/api/cma/[slug]/track/route.ts:47-52`) is the ONLY
    `queueBrokerAlert` caller for CMA opens, and a repo-wide grep finds ZERO
    producers of its `?e=open`/`?e=view` URLs — no email template embeds the pixel or
    wraps a link through it (the only matches are the route itself and build
    artifacts). Current delivery emails are instrumented via `attributeOutbound`
    (`lib/cma/send.ts:332`) and `instrumentEmailHtml` (`lib/cma-deliver.ts:314-323`),
    which embed `/api/track/e/open` + `/api/track/e/click` — and neither of those
    handlers queues a broker alert (`app/api/track/e/open/route.ts:31-92`;
    `app/api/track/e/click/route.ts:17-72`). Compounding: the orphaned route's
    `e=view` redirect targets the legacy static path `/cmas/<slug>/cma.html`
    (`app/api/cma/[slug]/track/route.ts:57`), a 404 for every DB-stored CMA — only
    `html_path` rows under `public/cmas/` resolve there (`app/cma/[slug]/route.ts:200`).
    So the machine objective's "alert the broker the document landed" is NOT met
    today; §11 carries the re-wiring target.
- **Duplicate/parallel paths that should die:** the legacy `public/cmas/` file-based
  serve (redirect-only, dies by attrition — `app/cma/[slug]/route.ts:197-203`); the
  legacy `?_fuid=` identity param retained beside `_pid` for pre-cutover links
  (`app/api/track/e/identify/route.ts:36-40`).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** The door is the product decision that lets a private
document double as a consent + identity instrument, and it already runs on one data
source with two presentations. The target shape is a policy unification plus door
widening, not a rebuild:

- **One door policy for all client valuation documents.** P3 decides: does the BPO
  inherit the CMA's register/consent door (identity-gated) or does the CMA relax to
  link-possession (BPO model)? The current split (D2) is an accident of build order,
  not a decision anyone recorded. The decision applies to any future client document
  type as well.
- **Widen the identity door.** Google-only sign-in (D1) locks out every non-Google
  recipient from the web experience. Target: an email magic-link fallback scoped to the
  document's known emails — the same possession-based trust model the `_pid` param
  already grants — so the door verifies "controls the email we sent this to," not "has
  a Google account."
- **Consent becomes per-document-family, append-only.** Replace the person-global
  boolean (D3) with consent records that append rather than overwrite, so the flag and
  its audit can never diverge.
- **Re-wire the first-open broker alert (D6).** One mechanism, not two: either the
  delivery emails embed the orphaned route's pixel/view URLs (and its `e=view`
  redirect repoints from the dead legacy `/cmas/<slug>/cma.html` path to
  `/cma/<slug>`), or the live `/api/track/e/{open,click}` handlers learn to queue
  `queueBrokerAlert` for `cma:*` email keys. Until one ships, the machine
  objective's "alert the broker" clause is a target, not a behavior.
- **The document is a graph node, not a dead end.** The read is the single
  highest-intent moment the site produces; the document's exits (below) must be real
  doors back into the exploration graph, and on-document click telemetry must record
  destinations (D4) so those exits are measurable.
- **Ideal step count:** first visit 2 interactions (sign-in + consent ask), repeat
  visits 0 — already true; hold it. Device: mobile-first (the link arrives on a phone).
- **Data gaps blocking correctness:** no serve-latency or render-cost measurement for
  the per-request immersive path; no device split for `client-document` page_views
  queried this pass; click destinations unrecorded (D4); no readout distinguishing
  "register shell shown, never entered" from "never clicked" in the funnel (the events
  exist; `/admin/reports/cma-performance` aggregates opens/views but not the
  shell-abandon step — `lib/data/cma/getCmaPerformance.ts:1-18`).

**Destination implication:** no public IA destination at all — these are unlisted,
noindexed nodes reached only by private link, and P5 must keep them OUT of nav,
sitemaps, and canonicals. Their IA obligation is one-directional: the document exits
INTO the public graph (market node, sell plan, broker), never the reverse. The URL
shapes (`/cma/<slug>`, `/bpo/<slug>`) are live in delivered emails, texted links, and
`crm_people.custom.cmaLink` stamps (`lib/cma-deliver.ts:274-275`), so any P5 re-shaping
requires permanent redirects — treated like SEO-equity URLs even though search never
sees them.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Read the valuation your broker prepared for you — the number
  and every comparable behind it, on your phone, private to you."
- `machine_objective`: "Verify the reader is the intended recipient, capture the
  one-time SMS/email consent decision, stitch the read and every click to the CRM
  person, and alert the broker the document landed." (The alert clause is TARGET,
  not current behavior — D6; today the landing is visible pull-only via
  timeline/report rows.)
- `exits`: text/call the signing broker (wrong-person shell already exits to the SMS
  line — `lib/cma/register-gate.ts:159`) → the subject property's city/neighborhood
  market node → the sell plan / listing consultation → the PDF (attached in the
  delivery email). Every exit is a tracked door back into the exploration graph.

## 12. Acceptance checks

Persist these; never delete. Use a disposable test CMA (build via `/admin/cmas` against
a test person, e.g. `e2e-docview-test+<date>@ryan-realty.com`) and clean up created
rows after.

1. **Draft privacy:** while the test CMA is `status='draft'`, logged-out
   `GET https://ryan-realty.com/cma/<slug>` → 404 JSON; logged in as admin → the
   document renders. `curl -sI` must show `X-Robots-Tag: noindex, nofollow` and
   `Cache-Control: private, no-store` on every 200.
2. **Register door:** finalize the CMA. Logged-out `GET /cma/<slug>` → 200 register
   shell (benefits + Continue with Google), NOT the document; the response HTML
   contains `/api/cma/register?slug=<slug>&start=1` and `rr-doc-tracker.js`.
3. **Wrong person:** sign in with a Google account whose email is NOT on the person →
   `GET /cma/<slug>` → 403 shell naming the signed-in email.
4. **Consent optionality (TCPA):** sign in as the lead's email → consent shell; submit
   the POST with NO boxes checked → 303 back → the document renders. Then:
   `SELECT custom->'cmaConsent' FROM crm_people WHERE id=<personId>` → `{"sms": false,
   "email": false, ...}` and
   `SELECT title, body FROM crm_timeline WHERE dedupe_key='cma-register:<slug>:<personId>'`
   → one row, body contains "SMS consent: declined".
5. **Claim binding (phone-only):** build a CMA against a person with phones only, no
   emails. First Google sign-in → claim-and-consent shell → after POST,
   `SELECT emails, custom->>'cmaClaimedBy' FROM crm_people WHERE id=<personId>` → the
   claimer's email appears in both; a SECOND, different Google account → 403.
6. **Identity stitch:** open `/cma/<slug>?_pid=<personId>` in a fresh browser profile
   (consented person). Network log shows POST `/api/visitors/track` then GET
   `/api/track/e/identify?_pid=…&sid=…` (204); the address bar no longer carries
   `_pid`; `SELECT page_url, page_category FROM visitor_events WHERE session_id='<sid>'
   ORDER BY created_at DESC LIMIT 3` → a `page_view` with
   `page_category='client-document'` and a clean `page_url` (no `_pid`); the session
   row shows the person id after backfill.
7. **Two presentations, one data source:** `GET /cma/<slug>` (immersive) and
   `GET /cma/<slug>?print=1` (print artifact) — grep both responses for the
   recommended-value figure; identical numbers. The immersive response contains
   `rr-doc-tracker.js`; the print-artifact response contains both `rr-doc-tracker.js`
   and `rr-cma-doc.js`.
8. **Open/view alert route (orphaned mechanism, D6 — this check exercises the code as
   it IS):** precondition: the CMA's broker has SMS opt-in or an active push device,
   otherwise `queueBrokerAlert` exits BEFORE its dedupe write and the count below is 0
   (`lib/crm/broker-alerts.ts:164-167`).
   `curl -s "https://ryan-realty.com/api/cma/<slug>/track?e=open&p=<personId>"` twice
   → GIF both times, but `SELECT count(*) FROM crm_timeline WHERE
   dedupe_key='alert:cma-open:<slug>:<personId>'` → 1 (key shape
   `alert:<kind>:<personId>` with kind=`cma-open:<slug>`, and `<slug>` already starts
   with `cma-` — `app/api/cma/[slug]/track/route.ts:33,50`;
   `lib/crm/broker-alerts.ts:177`). `curl -sI "…?e=view&p=<personId>"` → 302 with
   Location `/cmas/<slug>/cma.html` — the LEGACY static path, a 404 for DB-stored
   CMAs (`app/api/cma/[slug]/track/route.ts:57`); a D6 fix must repoint it to
   `/cma/<slug>` and update this expectation. The LIVE open receipt is asserted
   separately: after a delivery-email send, the pixel hit yields
   `SELECT count(*) FROM crm_timeline WHERE
   dedupe_key='track:open:<personId>:cma:<slug>'` → 1
   (`app/api/track/e/open/route.ts:53`), and the sent HTML contains
   `/api/track/e/open` but NO `/api/cma/<slug>/track` URL.
9. **BPO client-safety:** for a `final` BPO, logged-out `GET /bpo/<slug>` → 200 and the
   body contains NO offer-strategy content; `GET /bpo/<slug>?variant=full` logged-out →
   the client-safe body (not full); a non-final BPO logged-out → 404.
10. **Token lifecycle:** register on a published-CMA listing page (or call
    `registerForCmaDocumentAction` in a test harness) → returned `/api/cma-document/
    <token>` serves the full document and
    `SELECT delivery_count, first_delivered_at FROM cma_document_registrations WHERE
    token_hash=encode(digest('<token>','sha256'),'hex')` → count incremented, timestamp
    set. Set the CMA's `published_to_listing=false` → the same token URL → 404 with the
    single opaque message. A random 43-char token → identical 404 body.
11. **Unlisted invariant:** `grep -c "cma/\|bpo/" public/sitemap*.xml` (or the sitemap
    route output) → 0; both routes absent from any sitemap or internal nav.
12. **Repeat-visit zero friction:** after check 4, re-open `/cma/<slug>` in the same
    signed-in session → the document renders immediately, no shells.
