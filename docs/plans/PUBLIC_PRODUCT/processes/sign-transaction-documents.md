# Process: sign-transaction-documents — Execute transaction documents from a tokenized email link (/sign/<token>)

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a broker sends an envelope; a party opens their emailed link;
  no cron exists anywhere in this process — `vercel.json` grep this run: zero matches for
  sign/envelope/tc)
- Verdict (**PROPOSAL, not a lock — P3 decides**): **KEEP** — the only pure client-service
  process in the public registry: the visitor is a transaction party executing legal
  documents under ESIGN / Oregon UETA (ORS ch. 84), not a lead to convert. No overlap with
  any of the 15 seeds (untouched by all of them per P1), no sibling process shares its job,
  its tables, or its persona. Nothing to merge into; killing it kills the in-house TC
  system's signature leg. Non-negotiable rider: the `/sign/<token>` URL namespace is an
  external contract — live links exist in clients' inboxes; P5 may not rename the route
  (tokens are re-mintable via re-send, but every un-clicked invite in an inbox would break).
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A transaction party who receives "Your signature is requested for {address}" opens their
unique link and executes legally binding real-estate documents in one sitting — no account,
no password, no app — and gets the completed copy delivered to their inbox without asking
(`lib/tc/signing-emails.ts:52` "You do not need an account or a password. The link is
unique to you."). The machine outcome is the client-step "documents executed on the deal"
advancing with zero broker labor: because serving the signer requires recording consent,
first view, per-field values, IP/UA and ordered routing, the same flow that lets them
finish produces the ESIGN/UETA evidence chain, and the last signature triggers sealing —
a flattened, certificate-stamped, sha256-hashed executed PDF filed to the deal and mailed
to every party (`app/actions/tc-sign.ts:13-19`; `lib/tc/seal-envelope.ts:35-43,77-238`).

## 2. Inception (what starts it)

Trigger: a party clicks `https://ryan-realty.com/sign/<token>` in a Ryan Realty email.
Entry channel: **owned/direct — email only** (never organic, never paid; the URL exists
nowhere but in signing emails; the page is `robots: { index: false, follow: false }`,
`app/sign/[token]/page.tsx:10`).

Three mint surfaces produce the link, all through `generateSigningToken()` — 32 random
bytes base64url in the email, sha256 hash in the DB, so a DB read can never reconstruct a
live link (`lib/tc/signing.ts:91-103`):

1. **Broker sends the envelope** — `sendEnvelope` validates the draft (documents present,
   every recipient email valid, every signer has fields, at least one signature field),
   flips status to `sent`, then mints + emails ONLY the lowest signing-order group, so a
   live link never exists before it is that signer's turn
   (`app/actions/tc-envelopes.ts:551-649`, ordered-routing comment `:594-596`).
2. **The machine advances the order** — when a signing-order group finishes,
   `advanceOrSeal` mints + emails the next group (`lib/tc/seal-envelope.ts:47-72`).
3. **Manual reminder** — `resendRecipientInvite` re-mints (invalidating the old link) and
   re-sends for any not-yet-completed recipient (`app/actions/tc-envelopes.ts:652-696`).

Preconditions: an envelope composed on a TC cycle (from deal PDFs or licensed form
templates — `app/actions/tc-envelopes.ts:241-311,322-440`; admin process, evidence only)
and a deliverable recipient email. No auth, no cookie, no session — the token IS the
credential (`app/actions/tc-sign.ts:14-15`).

Entry evidence: route `app/sign/[token]/page.tsx:23-25` → `getSigningSession(token)`
(`app/actions/tc-sign.ts:56-167`); tables `tc_envelopes`, `tc_envelope_recipients`,
`tc_envelope_documents`, `tc_envelope_fields` (`docs/DATABASE_SCHEMA_SNAPSHOT.md`
§tc_envelope_* — recipients carry `auth_token_hash`, `consented_at`, `viewed_at`,
`completed_at`, `declined_at`, `ip`, `user_agent`).

## 3. Actors

- **Visitor segment:** a transaction party mid-deal — buyer1/2, seller1/2, listing broker,
  buyer's broker, escrow, title, lender, or other; `cc` recipients receive the completed
  copy but never sign (`lib/tc/signing.ts:26-54,114-116`). This is a client executing a
  legal obligation, not a buyer/seller/dreamer browsing — the registry's distinct persona.
  Device reality: unknown — no GA4 query was run this session and no split is claimed
  (§0); the entry is an email link, so both phone and desktop are plausible, and the UI is
  built one-column with a sticky mobile action bar (`components/tc/pdf-sign/SignFlow.tsx:151-166`).
- **Automated actors:** Resend delivers the three email types
  (`lib/tc/signing-emails.ts:37-111`); the middleware bot screen fronts the route (page
  routes are in the matcher — `middleware.ts:587-589`; screen logic `:204-229`); corporate
  email-security link scanners that present browser-like UAs can reach the page and stamp
  the audit trail (§10 defect 3). No cron touches this process.
- **Accountable for completion:** the sending broker — they watch envelope status at
  `/admin/signing` (`getEnvelopesOverview`, `app/actions/tc-envelopes.ts:749-792`) and on
  the deal page, and they hold the only unstick levers: `resendRecipientInvite` and
  `voidEnvelope` (`:652-696,699-737`). The machine advances the order automatically but
  never chases a silent signer (no reminder cron — §10 defect 8).

## 4. Systems of record

| Artifact | SoR |
|---|---|
| Envelope lifecycle | `tc_envelopes.status` FSM `draft → sent → partially_signed → completed`, terminal `voided` (`lib/tc/signing.ts:56-65`; the FSM lives implicitly in `advanceOrSeal` — `lib/tc/deal-state.ts:4`) |
| The credential | `tc_envelope_recipients.auth_token_hash` — sha256 only; the raw token exists solely in the sent email; nulled on completion, decline, and void (`app/actions/tc-sign.ts:244,274`; `tc-envelopes.ts:713`) |
| Signature evidence | `tc_envelope_fields.value` (jsonb per `SignFieldValue`), `signed_at`, `signed_ip` (`tc-sign.ts:233-240`; `signing.ts:83-89`) |
| Per-signer audit trail | `tc_envelope_recipients.viewed_at / consented_at / completed_at / declined_at / ip / user_agent` (`tc-sign.ts:97-103,180-186,242-245`) |
| Event ledger | `tc_events` — `envelope_sent`, `envelope_recipient_signed`, `envelope_declined`, `envelope_completed`, `envelope_seal_failed`, `envelope_reminder_sent`, `envelope_voided` (`tc-sign.ts:247-252,280-285`; `seal-envelope.ts:132-138,202-209`; `tc-envelopes.ts:617-627,689-694,715-720`) |
| The executed document | Storage `tc-documents` bucket `tc/<source_guid>/executed/<envelopeId>__signed.pdf` + its `tc_documents` row + `tc_envelopes.sealed_sha256 / executed_document_id / certificate_storage_path` (`seal-envelope.ts:162-200`) |

Explicitly NOT a SoR: SkySlope (a workflow tool, never reconciled against — CLAUDE.md §8);
the emailed PDF attachment (a courtesy copy of the sealed artifact); Resend delivery logs
(delivery evidence only); the signer's browser state (values live only in React state
until submit — `SignFlow.tsx:24`).

## 5. End-to-end path (inception → completion)

Steps 1–2 are the send-side substrate; 3–10 are the visitor's process; 11–12 are the
machine's completion work.

1. **Compose + send** · broker · validates draft, `status='sent'`, mints tokens for the
   lowest signing order only, emails "Review and sign" · draft envelope · live links for
   group 1 · `app/actions/tc-envelopes.ts:551-649`; email `lib/tc/signing-emails.ts:37-62` ·
   failure: validation errors returned to the composer; a Resend failure after the status
   flip leaves a live token with no delivered email (unstick: manual resend) · desktop/admin.
2. **Deliver** · Resend · invite lands from the verified domain, reply-to the sending
   broker (`tc-envelopes.ts:613`; `signing-emails.ts:60`) · — · email in inbox · spam
   folder / bounce is invisible to the machine (no webhook on this path) · any.
3. **Click — INCEPTION** · party · opens `/sign/<token>` · the emailed link · HTTPS GET ·
   middleware screens page routes: good bots pass, empty-UA and CLI/library UAs 403,
   default geo-block 403s CN/HK/RU/SG (`middleware.ts:204-229`; matcher `:587-589`) ·
   a real signer abroad can be 403'd (§10 defect 4) · any.
4. **Resolve session** · server · `getSigningSession`: length gate (<20 chars → invalid),
   hash lookup on `auth_token_hash`, then state fan-out — voided → "canceled", declined →
   "declined", completed → "Already signed", lower-order signers pending → "Almost your
   turn" (ordered-routing gate `tc-sign.ts:84-94`) · token · one of 4 non-ready screens or
   the payload · `app/sign/[token]/page.tsx:27-58`; `tc-sign.ts:56-94` · unknown/dead token
   renders "This link is not active" with the broker's phone as the recovery path
   (`page.tsx:18,54-57`) · any.
5. **Record first view** · server · `viewed_at` + requester IP/UA written once
   (`tc-sign.ts:96-103`) · request headers · audit-trail row · an email scanner that
   reaches the page stamps a false view (§10 defect 3) · any.
6. **Load documents + fields** · server · envelope documents in order, 1-hour signed
   Storage URLs, THIS recipient's fields only (`tc-sign.ts:105-166`) · envelope rows ·
   `SigningPayload` · a missing storage object yields `url: null` and that document spins
   on "Loading document…" FOREVER — `PdfPages` bails on null url (`if (!url) return`,
   `pdf-pages.tsx:47`) with `loading` still `true` (`:41,120`); the per-document error
   line (`:121`) is unreachable here because `setError` fires only in the pdf.js load
   catch (`:74-79`), which requires a url (§10 defect 11) · any.
7. **ESIGN consent gate** · party · reads "I agree to use electronic records and
   signatures… legally binding under the ESIGN Act and Oregon law", checks, taps "Agree
   and review documents" · checkbox · `consented_at` + IP recorded server-side
   (`SignFlow.tsx:90-114`; `tc-sign.ts:170-188`) · consent screen blocks the documents
   until agreed; already-consented sessions skip it (`SignFlow.tsx:22,90`) · any.
8. **Review + fill** · party · pdf.js rasterizes every page client-side (same-origin
   version-matched worker, no CDN — `pdf-pages.tsx:16-23`); fractional-geometry field
   boxes overlay each page; signature/initials open the draw-or-type pad (transparent PNG
   out — `SignaturePad.tsx:9-12`); date stamps today; text and checkbox inline; sticky bar
   counts "N of M required" (`SignFlow.tsx:116-177`) · payload · a complete value map ·
   values are client-state only until submit — a closed tab loses them, the link still
   works · any.
9. **Submit — "Finish signing"** · party · `submitSigning`: re-resolves the token,
   re-checks voided/completed/consent, validates every required field server-side against
   the DB rows, writes each value + `signed_at` + `signed_ip` (only fields belonging to
   this recipient — cross-recipient injection blocked by the `validIds` set and the
   `recipient_id` filter), marks `completed_at`, NULLs the token (single-use), appends
   `envelope_recipient_signed` (`tc-sign.ts:193-252`; `SignFlow.tsx:49-64`) · value map ·
   recorded signature · per-field writes are sequential, non-transactional (§10 defect 7);
   a validation miss returns a plain-language error to the sticky bar · any.
10. **Confirmation — visitor COMPLETION** · party · "Thank you — your part is done" or,
    when they were last, "All signed and complete… a completed copy is on its way to your
    email" (`SignFlow.tsx:75-88`) · `advanceOrSeal`'s return · terminal screen · the
    all-signed copy promise can be false when sealing failed silently (§10 defect 2) · any.
11. **Advance or seal** · system (in the submit request) · not-all-signed → status
    `partially_signed`, mint + email the next order group; all-signed → seal: download
    sources, flatten every value onto the pages (top-left fractions → pdf-lib bottom-left
    points, converted in ONE place — `lib/tc/seal-pdf.ts:10-12`), append the audit
    certificate (intent, consent, attribution, integrity, signer copy, retention —
    `seal-pdf.ts:1-12`), sha256, upload `…__signed.pdf`, insert the executed
    `tc_documents` row, stamp `tc_envelopes` completed (`seal-envelope.ts:35-74,77-209`) ·
    signed fields · the sealed artifact · seal failures write `envelope_seal_failed` and
    STOP — no retry path exists (§10 defect 2) · server.
12. **Completion notices — machine COMPLETION** · system · every unique recipient email
    (signers AND cc) gets the sealed PDF attached, "includes a certificate of completion
    with the signing record"; the creating broker gets "All signatures complete" with a
    deal link (`seal-envelope.ts:211-237`; `signing-emails.ts:64-111`) · sealed bytes ·
    finished copies in every inbox · a Resend failure loses that party's copy silently
    (the sealed artifact survives in Storage) · any.

## 6. Decision points

- **Token validity** (`tc-sign.ts:57,66`): length gate, then hash match — invalid/expired
  → the not-active screen; the token is never logged raw and never stored raw.
- **Envelope state fan-out** (`tc-sign.ts:78-82`): voided / declined / completed each get
  a distinct dead-end screen with the broker phone recovery path (`page.tsx:12-21`).
- **Ordered routing** (`tc-sign.ts:84-94`): any lower-order signable recipient pending →
  "Almost your turn"; the same rule governs mint timing at send (`tc-envelopes.ts:594-599`)
  and advance (`seal-envelope.ts:47-52`) — a later signer never signs early.
- **ESIGN consent gate** (`tc-sign.ts:209`; `SignFlow.tsx:90-114`): submit hard-fails
  without `consented_at` — consent is server-enforced, not a UI courtesy.
- **Signable vs cc** (`signing.ts:114-116`): cc roles never gate routing, never count
  toward completion, always receive the sealed copy (`seal-envelope.ts:214-226`).
- **Required-field completeness** (`tc-sign.ts:220-227`): per-kind server checks (PNG
  present, text non-empty, checkbox checked) mirror the client gate (`SignFlow.tsx:30-32,51-54`).
- **Ownership check on write** (`tc-sign.ts:232-239`): submitted values filtered to this
  recipient's field ids AND `.eq('recipient_id')` — one signer cannot fill another's boxes.
- **Advance vs seal** (`seal-envelope.ts:37-49`): all signable recipients complete → seal;
  else next-order mint. The next-order filter `!auth_token_hash && !viewed_at` (`:51`)
  skips anyone holding a token — the source of defect 8.
- **Decline → void** (`tc-sign.ts:258-287`): a single decline voids the WHOLE envelope
  and nulls the DECLINER's token hash only; other recipients' hashes persist in the DB
  but are inert — the envelope-status fan-out (`tc-sign.ts:78-82`) lands their links on
  the "canceled" state. The broker learns from the event ledger only (no email).
- **Middleware screens** (`middleware.ts:204-229`): empty-UA/CLI 403, geo 403 (default
  CN/HK/RU/SG), good bots pass. `/sign` is not in `COMPLIANCE_VERIFICATION_PATHS` (`:193-202`).
- **Compliance gates:** voice canon governs the page copy and all three email bodies
  (public-facing text — CLAUDE.md §2; the email lib self-declares canon compliance,
  `signing-emails.ts:2-4`); §0 — no market figures exist on this surface; noindex/nofollow
  (`page.tsx:10`); ESIGN / Oregon UETA ORS ch. 84 is the process's own law
  (`tc-sign.ts:18`; `seal-pdf.ts:5-7`).

## 7. Completion

Done-when (observable), per signer: `tc_envelope_recipients` row has `consented_at`,
`viewed_at`, `completed_at` set and `auth_token_hash` NULL; every one of their required
`tc_envelope_fields` rows carries `value`, `signed_at`, `signed_ip`; a
`tc_events.envelope_recipient_signed` row exists (`tc-sign.ts:229-252`).

Done-when, per envelope (the process's full completion): `tc_envelopes.status='completed'`
with `completed_at`, `sealed_sha256`, `executed_document_id`, `certificate_storage_path`
set; the executed `tc_documents` row exists; the `…__signed.pdf` object exists in the
`tc-documents` bucket and its sha256 equals `sealed_sha256`; `envelope_completed` logged;
completion copies sent to every unique party email and the broker notified
(`seal-envelope.ts:162-237`).

Artifacts at completion: the sealed PDF (flattened signatures + certificate page), its
sha256, the executed document row on the deal, the per-signer audit trail, the event
ledger, and every party's emailed copy.

Terminal states:

- **(a) Envelope completed** — the full done-when above.
- **(b) Signer done, envelope pending** — recipient complete, next order invited, status
  `partially_signed` (`seal-envelope.ts:45-72`).
- **(c) Declined → voided** — envelope voided (decliner's token hash nulled; remaining
  hashes persist but grant only the "canceled" view), reason on the envelope
  (`tc-sign.ts:271-285`).
- **(d) Voided by broker** — same end state via `voidEnvelope` (`tc-envelopes.ts:699-737`).
- **(e) All signed, seal failed** — every recipient complete, envelope NOT completed,
  `envelope_seal_failed` in the ledger, no copies sent, no retry (§10 defect 2).
- **(f) Never opened** — a live token idles indefinitely; no expiry, no automated
  reminder; only the broker's manual resend moves it (§10 defects 8, 9).

## 8. Time & performance

- **Time-to-answer budget:** the signer's question is "what am I signing and where do I
  tap" — answered when the first document page paints with its field boxes. The server
  side is per-request SSR (`revalidate = 0`, `page.tsx:9`) running seven sequential
  Supabase round trips on the happy path in `getSigningSession` (recipient `tc-sign.ts:61`
  → cycle `:71` → all-recipients `:85` → envelope-docs `:106` → doc-metadata `:114` →
  signed URLs `:123` → fields `:127`; doc-metadata and signed URLs are skipped only when
  the envelope has no documents), plus an eighth conditional write on first open — the
  `viewed_at` stamp (`:97-103`); the client side then downloads pdf.js plus
  the full PDF and rasterizes EVERY page to canvas before scroll (`pdf-pages.tsx:53-116`)
  — cost scales with document page count. No latency percentile has been measured for
  `/sign/*` — named gap, no number claimed (§0).
- **Core Web Vitals:** unknown and structurally unmeasurable by the usual field sources —
  the route is noindexed, tokenized, and low-traffic; no CWV claim is made (§0). The
  heavy client work (full-document canvas rasterization) is the obvious LCP/INP risk on
  long documents; that is an engineering observation, not a measurement.
- **What "slow" means and who sees it:** seconds of blank "Loading document…" between
  consent and the first page, felt by a client at the legal peak of their transaction —
  the single worst moment in the relationship to look broken. Signed-URL lifetime (3600s,
  `tc-sign.ts:123`) bounds a dawdling first load but not an open session (the PDF is
  fetched once at mount).

## 9. Variants

- **Document source (send-side only):** envelope from deal PDFs vs from licensed form
  templates with pre-mapped fields (`tc-envelopes.ts:241-311` vs `:322-440`) — the signer
  path is byte-identical; the template path only pre-places fields.
- **Single vs multi order:** one signing order → send mints everyone at once; multi →
  ordered routing with machine-advanced invites. Same page, same states.
- **Role variants:** signers by role label differ only in the certificate manifest
  (`seal-envelope.ts:141-151`); `cc` recipients have no signing path at all — their whole
  process is step 12.
- **Reminder:** `resendRecipientInvite` re-mints and re-sends with reminder copy
  (`tc-envelopes.ts:652-696`; `signing-emails.ts:46-58`) — same link semantics, old link
  dies.
- **Decline:** the one path where a visitor action terminates the process for everyone
  (§6). Not a separate process — same entry, same actors, divergence at one decision.

No split — every variant shares the same route, action set, and completion definition.

## 10. Current implementation map

- **Routes:** `app/sign/[token]/page.tsx` (the only public surface) inside
  `app/sign/layout.tsx` — a deliberate distraction-free shell: wordmark, "Secure signing"
  lock cue, slim contact footer; marketing chrome suppressed (`layout.tsx:5-9`).
- **Registers/design languages:** none of the site section registers — the flow is built
  on `@/components/ui` product primitives (Button, Card, Checkbox, Dialog, Tabs —
  `SignFlow.tsx:6-8`; `SignaturePad.tsx:4-7`), which is the correct §3 register for a
  product surface. One raw element exception: the decline reason uses `window.prompt`
  (`SignFlow.tsx:67`).
- **Actions:** public `app/actions/tc-sign.ts` (session/consent/submit/decline);
  broker-side `app/actions/tc-envelopes.ts` (compose/send/resend/void/dashboards).
- **Domain layer:** `lib/tc/signing.ts` (tokens, roles, geometry),
  `lib/tc/seal-envelope.ts` (FSM + seal orchestration), `lib/tc/seal-pdf.ts` (flatten +
  certificate), `lib/tc/signing-emails.ts` (three email types),
  `lib/tc/signing-schema.ts` (zod boundary — see defect 1). Tests:
  `signing-schema.test.ts`, `seal-pdf.test.ts`, `deal-state.test.ts`.
- **Crons:** none (verified against `vercel.json` this run).
- **DAL note:** the tc_* tables are RLS-locked and reached via service-role clients inside
  the actions, not `lib/data` (`tc-sign.ts:15-16`; page exemption headers
  `page.tsx:1-3`) — a deliberate, documented boundary exception.
- **Known defects (evidence, this run):**
  1. **The zod trust boundary is unwired.** `lib/tc/signing-schema.ts` (discriminated
     union, 750KB PNG cap, 200-field cap) self-describes as "imported by the signing
     action" (`:9-11`) — it is not: grep this run finds no import outside the schema and
     its test. `submitSigning` runs only hand-rolled checks with NO size cap on the
     base64 PNG an unauthenticated client submits into the row and the sealed legal PDF
     (`tc-sign.ts:220-227`). The guard exists, is tested, and protects nothing.
  2. **Seal failure lies to the last signer.** `advanceOrSeal` returns `true` whenever
     all signers are complete, even when `sealAndCompleteEnvelope` failed internally
     (early returns at `seal-envelope.ts:131-139,168-176`; unconditional `return true`
     `:40-43`) — the signer reads "a completed copy is on its way to your email"
     (`SignFlow.tsx:83`) while no copy will ever come, the envelope never reaches
     `completed`, and nothing retries. Terminal state (e) is reachable and silent except
     for one ledger row.
  3. **Email scanners can pollute the legal audit trail.** `viewed_at` + IP/UA are
     stamped on the FIRST request that reaches the page (`tc-sign.ts:96-103`); corporate
     link-scanners (Safe Links, Proofpoint) present browser-like UAs that pass the bot
     screen, and those values are printed into the certificate of completion as the
     signer's view record (`seal-envelope.ts:141-151`).
  4. **Geo-block can 403 a real signer.** Default `BLOCK_COUNTRIES` CN/HK/RU/SG applies
     to `/sign` (`middleware.ts:180-186,225-227`) — a party traveling or living there
     gets a bare 403 with no recovery path on a legally time-sensitive document.
  5. **Decline is a trapdoor.** One signer declining voids the entire envelope for every
     party (`tc-sign.ts:276-279`), the reason is captured via `window.prompt`
     (`SignFlow.tsx:67`), and the broker is NOT emailed — the code comment says
     "notifies the broker via the audit log" (`tc-sign.ts:258`), i.e. they find out when
     they look.
  6. **Per-signer broker notices are dead code.** `sendBrokerSignedNotice` has a
     "{name} signed, N remaining" branch (`signing-emails.ts:95-101`) called nowhere —
     the only call site passes `remaining: 0` at completion (`seal-envelope.ts:229-236`).
     Mid-envelope progress is invisible outside the admin dashboard.
  7. **Non-transactional submit.** Field values write one-by-one, then the recipient
     completes (`tc-sign.ts:233-245`); a mid-loop crash leaves partial values with a
     live token (retry works, so low severity — noted for the sealing invariant).
  8. **The advance filter can strand a signer.** `advanceOrSeal` only invites next-order
     recipients with `!auth_token_hash && !viewed_at` (`seal-envelope.ts:51`) — a
     later-order signer the broker manually re-invited early (the only way the "Almost
     your turn" screen is ever reached, since `resendRecipientInvite` ignores signing
     order — `tc-envelopes.ts:652-696`) holds a token, so when their turn actually
     arrives NO "it's your turn" email fires. Silent stall until the broker notices.
  9. **Tokens never expire.** No expiry column, no TTL check — a live link in an inbox
     works indefinitely until signed/declined/voided (schema §tc_envelope_recipients;
     `tc-sign.ts:56-66`). Single-use-on-completion and hash-at-rest mitigate, but an
     old forwarded email is a standing credential.
  10. **Send-then-email is not atomic.** `sendEnvelope` flips `status='sent'` before any
      email goes out (`tc-envelopes.ts:591-615`); a Resend outage strands a "sent"
      envelope whose signers were never told (unstick: manual resend).
  11. **A missing document is an infinite spinner, not an error.** `getSigningSession`
      returns `url: null` when a storage path is absent or URL signing fails
      (`tc-sign.ts:148`, error'd signed URLs dropped `:124`); `SignFlow` mounts one
      `PdfPages` per document (`SignFlow.tsx:123-127`), and its load effect bails on a
      null url before ever clearing `loading` (`if (!url) return`, `pdf-pages.tsx:47`;
      `loading` initialized `true` `:41`) — that document renders a permanent "Loading
      document…" (`:120`) on a legal signing surface. The per-document error line
      (`:121`) is unreachable on this path: `setError` fires only in the pdf.js load
      catch (`:74-79`), which requires a url. No signal reaches the broker or the ledger.
- **Duplicate/parallel paths that should die:** none — one route, one action file, one
  sealer. SkySlope's e-sign never had an in-repo signing path (its skill governs
  compliance filing, not signing). This is the rare process with no legacy twin.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** The job — execute transaction documents with a defensible
evidence chain, at zero friction for the party — is the TC system's public face and a
legal obligation once an envelope is out. It is also the program's strongest trust proof:
the same brokerage the visitor met as a lead handles their signatures in-house, on-brand
(memory: TC system LIVE, email-first tokenized signing is the locked pattern). Design
amnesia note: everything above documents WHAT HAPPENS; nothing about the current screen
copy, section order, or naming binds the rebuild — the brand + voice canon and the legal
evidence chain do.

**Ideal shape (derived from the job, not today's routes):** for the signer, exactly three
moves — open, consent, sign — with the document readable before any decision is demanded.
Keep that skeleton; close the implementation gaps that betray it: wire the existing zod
boundary into submit (defect 1), make sealing tell the truth (defect 2: return seal
outcome, surface "we will email your copy shortly" only when true, add a repair/retry
path for terminal state (e)), stamp `viewed_at` only on a human signal (defect 3 — e.g.
on consent-screen render or first interaction), exempt `/sign` from the geo screen or
give the 403 a recovery path (defect 4), replace the prompt-and-void decline with a
proper reason capture + broker email + per-recipient (not whole-envelope) semantics
decision (defect 5), fire the it's-your-turn invite for every next-order signer
regardless of token history (defect 8), add token TTL with self-service re-request
(defect 9), and fail visibly when a document cannot load — an error state with the
broker's phone, never an eternal spinner (defect 11). An automated reminder cadence for silent signers is the one genuinely new
capability the job implies (today: manual only). None of this changes the process shape.

**Immutable external contract:** `/sign/<token>` links live in inboxes. The namespace
stays; a route move requires re-minting every live invite, so treat it as frozen.

**Destination implication:** NOT a node in the exploration graph. A tokenized service
destination — no nav presence, no internal links in, noindexed, chrome-suppressed by
design. P5 draws no IA node for it; its dead-end terminal screens are the "legal aside"
carve-out to founding directive 2 (decisions.md 2026-08-11), because the signer is a
client mid-obligation, not a visitor to route onward — the machine objective here is
served by ZERO cross-sell (directive 3's "never acts like it" at its purest: the page
sells nothing, and that restraint is the brand impression).

Dual objective stamped on this process's pages:

- `visitor_objective`: "Read and sign your transaction documents from your email link in
  one sitting, on any device, with no account — and receive the completed, certified copy
  without asking."
- `machine_objective`: "A legally defensible executed document with zero broker labor:
  consent, view, attribution (IP/UA), ordered routing, per-field evidence, sealed
  PDF + certificate + sha256 filed to the deal, and every party's copy delivered."
- `exits`: the terminal confirmation screen (intentionally exit-free); the broker's phone
  number in the shell footer and error states (the only human escape hatch,
  `page.tsx:18`; `layout.tsx:26-28`); the completion email carrying the sealed PDF (the
  process's true final artifact, delivered off-site).

**Data gaps blocking correctness:** none blocking — the evidence chain from token to
sealed sha256 is complete and closed. Named measurement gaps: no `/sign/*` latency or CWV
data exists; no delivery telemetry (bounce/spam) reaches the machine, so "invite sent"
and "invite received" are indistinguishable (defect 10's blind spot); device split
unknown (§3).

## 12. Acceptance checks

Persist; never delete. Production is `ryan-realty.com`. Browser UA required past the bot
screen:
`UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'`.

1. **CLI screen:** `curl -sI https://ryan-realty.com/sign/zzzzzzzzzzzzzzzzzzzzzzzz | head -1`
   → `403` (default curl UA is in `BAD_BOT_RE`, `middleware.ts:174-175`).
2. **Dead-token screen:** `curl -s -A "$UA" https://ryan-realty.com/sign/zzzzzzzzzzzzzzzzzzzzzzzz | grep -o 'This link is not active'`
   → match (`page.tsx:54-57`; hash miss `tc-sign.ts:66`). Short token variant
   (`/sign/short`) → same, via the length gate (`tc-sign.ts:57`).
3. **Noindex:** the same response contains `noindex` in the robots meta (`page.tsx:10`).
4. **Unit suite:** `npx vitest run lib/tc/signing-schema.test.ts lib/tc/seal-pdf.test.ts lib/tc/deal-state.test.ts`
   → green (trust-boundary shape, y-flip geometry on the executed PDF, envelope FSM).
5. **Ordered mint at send (staged):** on a TEST cycle, compose a 2-signer envelope
   (orders 1 and 2), `sendEnvelope`. SQL:
   `SELECT role, signing_order, auth_token_hash IS NOT NULL AS live FROM tc_envelope_recipients WHERE envelope_id=:env ORDER BY signing_order`
   → order 1 `live=true`, order 2 `live=false` (`tc-envelopes.ts:594-605`).
   `SELECT status, sent_at FROM tc_envelopes WHERE id=:env` → `sent`, timestamp set.
6. **Waiting screen:** `resendRecipientInvite` for the order-2 signer (mints early —
   `tc-envelopes.ts:652-696`), open their link → "Almost your turn" (`tc-sign.ts:84-94`;
   `page.tsx:34-43`). This also reproduces defect 8's precondition.
7. **Signer E2E:** open the order-1 link, consent, fill, finish. SQL after each stage:
   `viewed_at` set on open with IP/UA (`tc-sign.ts:97-103`); `consented_at` set on agree
   (`:180-186`); after finish — `completed_at` set, `auth_token_hash` NULL, every
   required `tc_envelope_fields` row for the recipient has `value`/`signed_at`/`signed_ip`
   (`:233-245`), and `SELECT count(*) FROM tc_events WHERE cycle_id=:cyc AND action='envelope_recipient_signed'` ≥ 1.
8. **Single-use token:** re-open the used order-1 link → "Already signed" screen
   (`tc-sign.ts:80-82`; `page.tsx:44-53`).
9. **Advance:** after step 7, order-2's `auth_token_hash` is set (fresh — differs from
   step 6's if defect 8 is fixed; UNDER CURRENT CODE step 6's early mint suppresses the
   new invite, which this check documents) and `tc_envelopes.status='partially_signed'`
   (`seal-envelope.ts:45-72`).
10. **Seal E2E:** last signer finishes → confirmation reads "All signed and complete".
    SQL: `SELECT status, completed_at, sealed_sha256, executed_document_id, certificate_storage_path FROM tc_envelopes WHERE id=:env`
    → all set, `status='completed'`. Download the storage object at
    `certificate_storage_path`; `shasum -a 256` equals `sealed_sha256`
    (`seal-envelope.ts:153-200`). The final page of the PDF is the certificate with every
    signer's consent/view/complete timestamps and IP.
11. **Copies delivered:** every unique recipient email (including cc) received "Your
    signed documents for {address}" with the PDF attached; the creating broker received
    "All signatures complete" (`seal-envelope.ts:211-237`; verify in Resend logs).
12. **Decline path (separate staged envelope):** decline with a reason →
    `tc_envelopes.status='voided'` with `void_reason` prefixed "Declined by",
    all recipient tokens NULL, `envelope_declined` event (`tc-sign.ts:271-285`); the
    other signer's link now renders "This signing request was canceled" (`:78`).
13. **Seal-failure ledger (standing invariant):**
    `SELECT count(*) FROM tc_events WHERE action='envelope_seal_failed'` → 0. Any row is
    terminal state (e): an all-signed envelope with no executed document and no copies
    sent — manual repair required until defect 2 grows a retry path.
14. **Trust-boundary wiring (turns green when defect 1 is fixed):**
    `grep -c "signing-schema" app/actions/tc-sign.ts` → ≥ 1. Today: 0 — the recorded
    defect, kept here so the fix is provable.

Cleanup after 5–12: void the staged envelopes and delete the test cycle's tc_* rows and
storage objects.
