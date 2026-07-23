---
name: tc-builder
description: Run ONE iteration of building Ryan Realty's in-house Transaction Coordination system toward fully-functional, Oregon-real-estate-law-compliant, automated, and intuitive. Each iteration picks the next highest-value increment off the build ladder, builds it thoroughly against verified Oregon law, verifies in a real browser, ships draft-first, and stays quiet when blocked on Matt's review. Use when Matt says "/tc-builder", "build the TC", "keep building the transaction system", or when a /loop firing carries this protocol.
---

# TC Builder — one iteration

You are building Ryan Realty's own Transaction Coordination system — the SkySlope
replacement — to **fully functional, automated, thorough, and intuitive**, and
**compliant with Oregon real estate law** because Matt is the licensed principal
broker and these are his license-bearing records.

One iteration = **orient → pick the next increment → build it thoroughly →
verify in a real browser → ship draft-first → report or stay quiet.** Do the
smallest *complete, shippable* slice that moves the system forward. Never leave a
half-wired feature.

## North star (Matt's words, do not drift)

- "Fully functional TC based on Oregon Real estate laws." → every feature a TC
  needs, correct under ORS/OAR/OREF, nothing that puts the license at risk.
- "Automated." → the system does the tedious work (file the doc, fill the form,
  place the signature, route the email, chase the signer), not the broker.
- "Thorough." → no half-features, no silent gaps, every required document and
  disclosure accounted for per transaction type.
- "Intuitive to use." → brokers never build a form; they tell the agent in plain
  English or click a guided screen, and review a finished draft. The bar is
  "easier than SkySlope," not "as capable as SkySlope."
- **Anticipate, don't react.** The system predicts the exact documents a deal
  needs from the broker's role + the home's specifics (Step 1, rung 2), so the
  broker is never the one remembering that a well needs OREF 082.
- **One source of truth for conversations + documents, surfaced in the CRM.**
  Emails and messages tied to a deal show up in the CRM, and the loop verifies
  conversations + documents are actually being created and filed correctly
  (Step 1, rung 8) — not silently dropping.
- **Full SkySlope parity + the money layer** (Matt directive, `tc-parity-signing-
  order-financials`). Match SkySlope's feature set: folders, checklists, docs,
  e-sign with **ordered signature routing** (buyers sign, then sellers, then
  broker), commission tracking + disbursement (CDA), and reporting. Plus the two
  things SkySlope is weak at: **commission tracking** and **brokerage revenue +
  expense tracking** (a real P&L), both built on the settlement-verified deal
  data already in the system.
- **A principal broker's system** (Matt directive, `tc-supervision-notifications-
  calendar`). The deal broker is notified as things change; every completed
  document routes to Matt (principal) for sign-off in one queue across all
  brokers' deals (his OAR 863-015 supervisory duty — nothing closes unsigned);
  and every key date (transaction-timeline deadlines, showings, appointments,
  license renewals) pushes to each broker's Google Calendar.

## Step 0 — orient (every iteration, before touching code)

Read the canonical state so you build on truth, not memory:

1. `docs/TC_SYSTEM.md` — architecture, schema, the phased roadmap, invariants.
2. `docs/TC_OREGON_COMPLIANCE.md` — the Oregon-law compliance matrix this loop
   maintains (create it on iteration 1 if absent — see Step 2).
3. Memories (canonical directives): `project_tc_data_universe`,
   `project_tc_form_prep_agent_driven`, `project_tc_signing_email_first`,
   `project_tc_email_ingest`, `project_tc_comms_log_and_email_watch`,
   `reference_skyslope_forms_api`, `feedback_use_matts_chrome_for_auth_web`,
   `feedback_draft_first_review`, `feedback_always_retain_memory`.
4. Live state: `node --env-file=.env.local scripts/tc-migrate-from-skyslope.mjs --verify`
   (row counts) and a quick read of which `tc_*` tables + `/admin/deals`,
   `/admin/forms` surfaces already exist.

## Step 1 — pick the next increment (the build ladder)

Walk the ladder top-down; build the **first rung that isn't done and isn't
blocked on Matt's review or an external credential.** One rung per iteration.

**Matt-priority (2026-06-09):** rungs 11 (commission tracking) and 12 (revenue +
expense tracking) are explicitly requested and buildable NOW on the existing
settlement-verified deal data — independent of the signing flow. Weight them
near-term: prefer them over rungs 4–7 once the write-side basics (1) and the
field-mapper (3) are far enough that a money surface is useful. Ordered signing
is folded into rung 6.

1. **Write-side basics** — doc upload to a deal, archive/unarchive UI (done),
   checklist status transitions (Required→In Review→Completed), reviewer
   accept/reject. Every mutation writes a `tc_events` row.
2. **Smart required-document anticipation** (Matt directive — the heart of
   "thorough") — NOT static templates. When a deal exists, the system PREDICTS
   the exact set of documents + disclosures it will need from two inputs:
   (a) the **broker's role** — listing side, buyer side, or disclosed dual
   agency — and (b) the **property's specifics** — well (OREF 082), septic /
   on-site sewage (OREF 081), HOA / condo (OREF 023/024/031 + condo SA),
   pre-1978 build → lead-based paint (OREF 018/021 + federal disclosure),
   manufactured home (OREF 012), vacant land (OREF 008/019/030), solar (OREF
   105/116), historic, tenant-occupied, short sale, seller-carried, VA/FHA
   financing (OREF 097), etc. Each trigger → required form, sourced from the
   Oregon compliance matrix (Step 2) with its citation. Property facts come
   from the listing/Spark data + a short deal intake. Output: a live, explained
   "documents needed / present / missing" checklist per deal that updates as
   facts change. This is what makes the system anticipate instead of react.
3. **Form field-mapper** — place data + signature/initial/date fields once per
   `tc_form_versions` row, tagged with signer role. Start with the core set
   (OREF 001, 003/004, 015, 020, 040/041, 042, 043, 050, 057). Fields are
   verified ONCE here so envelopes can never place a signature wrong.
4. **Envelope composer** — two front doors, one reviewable draft:
   (a) agent-driven ("start a buyer's agreement for the Hendersons on 123 Main"
   → resolve deal + forms + data + signers from the deal record),
   (b) guided manual screen. Both instantiate verified templates only.
5. **Broker review gate** — preview exactly what the client will see + who signs
   where, on the right deal, before anything sends. Mandatory.
6. **Email-first signing — with ordered routing** (Matt directive). Tokenized
   per-recipient link (no login/app), mobile tap-to-sign, sealed PDF + audit
   certificate, auto-file to checklist, reminders, per-recipient status. **Each
   signature/initial/date block is assigned to a recipient role AND a signing
   order; recipients in order N are only notified after every order < N has
   completed (parallel within the same order).** Buyers sign, then sellers, then
   broker — the composer lets Matt set the order; the routing engine enforces
   it. Schema is ready (`tc_envelope_recipients.signing_order`,
   `tc_envelope_fields.recipient_id`). Legal bar: ESIGN + Oregon UETA (cite ORS
   ch. 84). Our system only; SkySlope stays manual until cutover.
7. **Email-ingest** — watch the broker Gmail inboxes, classify deal-relevance,
   file attachments to the matching deal checklist (verify-before-file). Our
   system only.
8. **Communications log — verified inside the CRM** (Matt directive) — the
   per-deal timeline of emails + texts must surface AND reconcile in the CRM
   person/deal view, not only on the TC deal page. Coordinate with the parallel
   `crm_*` session: join deal parties → `crm_people` (FUB ids), reuse
   `crm_timeline` rather than building a second comm store; capture deal-matched
   emails from non-FUB parties (escrow/title/lender) directly. Each iteration
   that touches this also VERIFIES the loop is closing end to end: an inbound
   email/message that belongs to a deal actually produces (a) a logged
   conversation entry visible in the CRM and (b) any attached document created
   + filed to the right checklist item. If either half isn't happening, that's
   the bug to fix this iteration. Texts partial (FUB-channel only — see
   `project_tc_comms_log_and_email_watch`).
9. **Production form blanks** — pull Matt's licensed OREF/ODS/OR blanks through
   his Chrome session (`reference_skyslope_forms_api`) so production supersedes
   the samples. Needs his live SkySlope Forms session — do only when available.
10. **Polish to "intuitive"** — the agent command surface, empty states, the
    one-glance review screen, mobile signing UX.
11. **Commission tracking** (Matt-priority, buildable now) — per deal: gross
    commission income (GCI), side(s) earned, agent split (Matt 100% / Rebecca +
    Paul 90% — `skyslope-form-compliance-lessons`), referral fees, flat-fee vs
    percent, and the disbursement view (who's paid what at close — SkySlope's
    CDA). `tc_cycles` already has `commission_percent` + `office_gross`
    (settlement-verified); add a per-agent breakdown model + a commissions
    surface on the deal page + a roll-up. Every figure stays settlement-verified
    (§0). Trust-accounting duty cites OAR 863-025.
12. **Revenue + expense tracking** (Matt-priority, buildable now) — brokerage
    financials: income (commissions earned, by deal + period) + expenses
    (per-deal costs + overhead) → a P&L / financials dashboard. New `tc_*`
    table(s); deal-scoped + rolled up. Coordinate with the `marketing_cost_ledger`
    pattern but this is brokerage transaction financials. Records duty: OAR
    863-015 / OAR 863-025.
13. **Principal sign-off + broker notifications** (Matt directive, near-term —
    extends the shipped checklist transitions). When any broker marks a
    document/item complete (→ In Review), it enters Matt's "Needs sign-off"
    queue across ALL brokers' deals; Matt signs off (→ Completed) or sends back
    with a reason (→ Required); both notify the submitting broker. Real-time
    alerts + daily digest of what's pending his review — nothing closes unsigned
    (OAR 863-015 supervision; verify exact rule). Notifications model + delivery
    (branded email via `mail.ryan-realty.com`, in-app bell, SMS for urgent),
    deal-broker-scoped. `tc_supervision-notifications-calendar`.
14. **Calendar integration** (Matt directive) — push every key date to that
    broker's Google Calendar (Workspace DWD / Calendar MCP): transaction-timeline
    deadlines (acceptance, inspection, financing/appraisal, closing — derived
    from the sale agreement + the Oregon timing rules in TC_OREGON_COMPLIANCE.md),
    showings, appointments, and OREA license renewals (biennial; `orea-license-
    records`). Needs a date model first, then Calendar sync with reminders.
    **Principal sees ALL brokers' calendars** (Matt directive) — an in-app
    principal calendar overlays every broker's dates, and Matt is granted Google
    visibility into each broker's calendar (Workspace admin sharing). One
    supervisory calendar across the brokerage. `tc-supervision-notifications-calendar`.
15. **Deal team & contacts** (Matt directive, near-term — `tc-broker-access-and-
    deal-contacts`) — a deal holds multiple co-agents/brokers + every party:
    lender + loan officer, appraiser, title, escrow officer, TC, home warranty,
    other-side agent — each name/role/company/email/phone. The migrated
    `tc_cycles.raw` already carries `titleContact`/`escrowContact`/`lenderContact`/
    `otherSideAgentContact`/`coAgents`/`transactionCoordinators` — extract +
    surface them editable + add new. These feed notifications (rung 13), signing
    recipients (rung 6), and the calendar (rung 14).
16. **Per-broker access scoping** (Matt directive, near-term) — a broker's
    default view is THEIR transactions (deals where they're the agent / on the
    deal team); the principal (Matt/superuser) sees all + the sign-off queue.
    Close the current gap where any admin role sees every deal. Resolve "their
    deals" via deal agent + deal team matched to the broker's identity
    (`brokers` table; agentGuid map). Reinforces "easy / intuitive."

If every unblocked rung is done: run the **end-to-end smoke** (create a test
deal → compose an envelope from a template → review → send to a Matt-owned test
email → confirm sealed PDF files back to the checklist) and report any seam that
isn't seamless. If that's clean too, say so plainly and stop (Step 5).

## Step 2 — build it thoroughly, against VERIFIED Oregon law

**Law is data, not memory (the §0 discipline).** Never assert an Oregon legal
requirement from recall. Every compliance rule the system enforces must trace to
a primary source — **ORS** (statute), **OAR** chapter 863 (Real Estate Agency
rules), the **OREF** form's own instructions, or the Oregon Real Estate Agency.
When you add or change a rule, cite it in `docs/TC_OREGON_COMPLIANCE.md` with the
section number and a one-line "why," exactly like a verification trace. If you
can't verify it, flag it for Matt — don't guess at law.

`docs/TC_OREGON_COMPLIANCE.md` is the matrix this loop maintains. Per transaction
type it records: required documents + the OREF form #, **disclosure timing**
(e.g. initial agency disclosure at first contact per ORS 696.820; seller's
property disclosure + buyer rescission window per ORS 105.464–105.490), **signer
profile** (who must sign each form — mutual vs single-party), **earnest-money /
trust handling** (OAR 863-025), **records retention** (the brokerage's duty to
keep transaction records — OAR 863-015 / ORS 696.280; our `tc_events` +
immutable storage satisfy it), and **e-sign validity** (ORS ch. 84 UETA + ESIGN:
intent, consent, attribution, integrity, retention, signer copy). Verify each
citation against the live source before encoding it; note the source URL +
fetched date. This file is the spine that makes the checklist templates,
the signer profiles, and the disclosure-timing checks correct rather than
plausible.

Build discipline:
- Schema changes → a migration in `supabase/migrations/`, applied to hosted
  Supabase via the MCP (`apply_migration`); RLS on, service-role only. Refresh
  `docs/DATABASE_SCHEMA_SNAPSHOT.md` (`npm run ci:data-access -- --refresh`).
- UI → design-system components from `@/components/ui/` only (CLAUDE.md). Admin
  tools carry `// @no-parity`. Server actions in `app/actions/`, never raw
  `.from()` in pages.
- Client-facing copy (signing emails, signer pages) obeys the brand-voice
  hard-fail rules (no em-dash, no banned words). Run the check before shipping.
- `tc_events` append-only on every mutation. Nothing hard-deletes inside the
  6-year window — "delete" means archive.

## Step 3 — verify in a real browser (not just types)

- `npx tsc --noEmit` clean + `npx eslint <touched files>` clean.
- The relevant CI gates for what you touched (`npm run ci:page-dal`,
  `ci:brand-voice`, `ci:data-access`, etc.).
- **Render it.** Drive the page in the preview server or Matt's Chrome
  (`feedback_verify_before_moving_on`, `feedback_verify_entire_surface`): the
  surface actually opens, the data is real, the interaction works end to end.
  A green typecheck is necessary, not sufficient.
- For a mutation, verify it wrote the row AND the `tc_events` audit row; if you
  tested a write via Matt's live-session preview browser, revert it with a
  labeled audit row (`reference_preview_browser_live_session`).

## Step 4 — ship draft-first

- Code (pages, actions, scripts, migrations, schema snapshot, docs) is
  infrastructure: `git pull --rebase`, stage ONLY your TC files (never the
  parallel CRM session's `crm_*` work), commit with a clear message, push to
  `main`. Watch the deploy reach production for user-facing surfaces.
- Client-facing DELIVERABLES (an actual envelope going to a real client, a real
  email send) are draft-first: surface to Matt, wait for explicit approval.
  Nothing reaches a client without his review gate (north star).
- Update `docs/TC_SYSTEM.md` roadmap status + `docs/plans/CROSS_AGENT_HANDOFF.md`
  so the CRM session stays coordinated (link through FUB person ids, not a
  second person store).

## Step 5 — report or stay quiet

- If you shipped a rung: one tight paragraph — what's now usable, where to click
  it, what's next. Plain English (Matt gets lost in jargon).
- If you're blocked only on Matt's review or a live SkySlope session or an
  external credential: say exactly what you need, in one line, and stop.
- If everything unblocked is done and the e2e smoke is clean: say "TC is
  functional end to end; remaining items need your review / a live session" and
  stop. **Silence-when-green is correct** — don't invent busywork.

## Hard rules (carry every iteration)

- Oregon law claims cite ORS/OAR/OREF primary sources, never memory. Unverifiable
  → flag, don't encode.
- Draft-first for client-facing deliverables; code ships to `main` after browser
  verification.
- Matt's Chrome only for authed web; never launch Playwright/Chromium
  (`feedback_use_matts_chrome_for_auth_web`).
- Brokers never build forms; signatures come from verified templates; nothing
  reaches a client unreviewed.
- One complete rung per iteration. Thorough beats fast. Persist every learning
  to memory / the compliance matrix the moment it surfaces.

## GRIND SEMANTICS (Matt directive 2026-06-10 — overrides any "one iteration" language above)

**A firing does not stop after one increment.** Chain iterations back-to-back — ship one, immediately pick the next — until one of these is true: (a) every remaining increment is blocked on Matt's review or an external dependency, (b) nothing actionable remains, or (c) the session's context is nearly spent — then finish the in-flight commit, write the handoff, and spawn a fresh session that keeps grinding (per memory `feedback_continuous_work_and_handoff`). Sleeping between wake-ups is for the BLOCKED state only. "Did something then stopped" is the named failure mode this section exists to prevent. Time is of the essence — Matt should never find a loop idle while unblocked work exists.

## PENDING INPUT — Oregon law sweep 2026-06-10 (route into the ladder NOW)

`docs/research/oregon-law-sweep-2026-06-10.md` — verified-citation research (45 primary-source fetches). Before building anything else: (1) **buyer-rep agreements are MANDATORY since 2025-01-01** (OAR 863-015-0133, 8 required contents, 24-month cap) — upgrade the `buyer-rep` rule in lib/tc/required-documents.ts from `verify` to `required`; (2) **OAR 863-015-0140: principal broker must review every document of agreement within 7 BANKING DAYS with a named, dated electronic review record** — this is the legal spine + deadline for the sign-off queue (rungs 13/14), encode the deadline; (3) **HB 3137 live since 2026-01-01**: team disclosure at first contact (863-015-0143) + amended team advertising (863-015-0125); (4) auto-track deadlines: earnest money 3 banking days (0257), executed copies 3 days (0135), PB transmittal 3 days (0250); (5) **five CORRECTIONS to TC_OREGON_COMPLIANCE.md** in section C (mislabeled ORS citations incl. 100.480/94.665, CO-alarm statute, smoke-alarm 479.260 missing) — fix the matrix against the cited primary sources; (6) CMA producer must satisfy 863-015-0190 (8 elements + not-an-appraisal disclaimer). All additions are DRAFT until verified against the cited source in-session per the law-is-data rule.

## Approval model (2026-07-21)

Reversible TC work — schema, server actions, UI, gates, DAL, migrations, docs —
is built, verified in a real browser, committed, and pushed without waiting for
review. Matt reviews after the fact; a bad change gets reverted. Per-action
approval (Matt says yes to the specific action, every time — silence is never
approval, a passing gate is never approval) is required only for: an outbound
email/SMS to a real client/party, publishing a public post, ad spend, and OAuth
grants. Client-facing rendered deliverables (a signing packet, a CMA PDF) are
shown to Matt before they enter a distribution path. See CLAUDE.md "Approval
Model — confirmed by Matt 2026-07-21".
