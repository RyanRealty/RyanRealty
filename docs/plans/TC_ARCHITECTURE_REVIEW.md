---
name: TC_ARCHITECTURE_REVIEW
description: Senior-engineer deep dive on the Vault transaction-coordination (tc_*) system — architecture, ranked problems, phased refactor strategy, target architecture + code. Generated 2026-06-23.
metadata:
  type: reference
---

# Ryan Realty Transaction Coordination (TC) System — Architecture Review & Refactor Plan

**Author:** Senior Engineering · **Date:** 2026-06-23 · **Audience:** Matt + team
**Scope:** The Vault TC system (`tc_*` tables, `lib/tc/`, `app/actions/tc-*.ts`, `/sign/[token]`, the SkySlope boundary).
**Verdict up front:** The schema and crypto core are genuinely well-built — CHECK-constrained statuses, an append-only audit spine, a real ESIGN/UETA seal certificate, hash-only signing tokens, a single isolated geometry-conversion point. The system is **not** in trouble. But every multi-table state transition is a sequence of un-transactional PostgREST calls with no locks, the seal runs inline in the signer's HTTP request, and there is a live enum-drift bug that silently breaks envelope creation from OREF templates. Those are the things to fix, in that order. Several "critical" findings in the upstream architecture maps were **false positives** and are called out as such so we don't waste effort on them.

---

## 1. Architecture Overview

### 1.1 What the system is

The TC system is **Vault's own system of record for real-estate transaction coordination**: deals, transaction cycles, documents, a full in-house e-signature engine, Oregon-law compliance checklists, principal-broker review (OAR 863-015-0140), commissions, and expenses. It lives in the `ryan-realty-platform` Supabase project as the `public.tc_*` table family.

**SkySlope is a workflow tool, not a system of record.** Sync is **inbound only** (SkySlope → Vault), into two read-only snapshot tables (`skyslope_transactions`, `skyslope_dashboard_meta`) used for *dashboard display* and reconciliation context. No code reconciles `tc_*` *from* SkySlope, and that boundary is correctly maintained today (confirmed: every mutation writes only `tc_*`; the dashboard read is display-only).

### 1.2 The layers (today)

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI / Routes                                                         │
│  /admin/deals (pipeline dashboard)   /admin/deals/[key] (detail)    │
│  /admin/crm/deals (FUB pre-contract) /sign/[token] (PUBLIC signer)  │
│  components: EnvelopeComposer, PdfPages, SignaturePad, SignFlow,    │
│              StepTracker, CommissionSection, AnticipatedDocs        │
├─────────────────────────────────────────────────────────────────────┤
│ Server Actions  ('use server', service-role Supabase, RLS-bypassing)│
│  tc.ts · tc-envelopes.ts · tc-sign.ts (PUBLIC) · tc-signoff.ts     │
│  tc-contacts.ts · tc-commissions.ts · tc-financials.ts             │
│  tc-required-docs.ts · tc-forms.ts · deals.ts (dashboard)          │
├─────────────────────────────────────────────────────────────────────┤
│ Core Logic  (lib/tc/  — mostly pure, server-only)                   │
│  signing.ts (tokens, geometry convention, field/role enums)        │
│  seal-envelope.ts (state machine: advanceOrSeal / sealAndComplete) │
│  seal-pdf.ts (flatten fields, certificate, SHA256)                 │
│  signing-emails.ts · required-documents.ts · banking-days.ts       │
│  skyslope-field-map.ts · contact-roles.ts · expense-categories.ts  │
├─────────────────────────────────────────────────────────────────────┤
│ DAL  (lib/data/)   ← *** NO tc/ MODULE EXISTS — reads bypass DAL ***│
├─────────────────────────────────────────────────────────────────────┤
│ Postgres (Supabase)  public.tc_*  +  Storage (tc-documents, tc-forms)│
│  + skyslope_transactions / skyslope_dashboard_meta (inbound mirror) │
└─────────────────────────────────────────────────────────────────────┘
```

**Layering note (important, and a finding later):** there is **no `lib/data/tc/` DAL module**. All `tc_*` reads happen directly in the action layer via a `getServiceSupabase().from('tc_*')` client that is **copy-pasted into 9 files**. This means no shared caching, no centralized invalidation, and a standing G1 boundary exception. (The maps' framing of this as a "boundary violation" needs nuance — `ci:check-dal-boundary`/G1 evidently allowlists these paths — but the *consequence*, no caching seam, is real and load-bearing for the performance findings.)

### 1.3 Data model (ER / flow)

```
tc_deals ──< tc_deal_contacts          (one row per property transaction; stage enum)
   │           (deal-wide OR cycle-scoped)
   └──< tc_cycles                       (sale|listing; 1:1 with a SkySlope folder; raw jsonb)
          ├──< tc_documents ──< tc_checklist_assignments >── tc_checklist_items
          │        │                                            (required/optional/
          │        │                                             in_review/completed/na)
          │        └──< tc_envelope_documents >── tc_envelopes
          │                                          │  (draft→sent→partially_signed
          │                                          │   →completed | voided)
          │                                          ├──< tc_envelope_recipients
          │                                          │     (role, signing_order,
          │                                          │      auth_token_hash, consent/
          │                                          │      viewed/completed/declined, ip/ua)
          │                                          └──< tc_envelope_fields
          │                                                (type, page, x/y/w/h fractions,
          │                                                 recipient_id, value jsonb)
          ├──< tc_commissions   (side, gci, splits, fees, nets; projected→final→paid)
          ├──< tc_expenses      (category, amount; soft-delete via archived)
          ├──< tc_principal_reviews  (IMMUTABLE — BEFORE UPDATE/DELETE trigger)
          └──< tc_events        (APPEND-ONLY audit spine; one row per mutation)

tc_form_libraries ──< tc_form_versions  (blank PDF + field_map jsonb + signer roles)
                          └─ referenced by tc_envelope_documents.form_version_id

skyslope_transactions / skyslope_dashboard_meta  (inbound mirror; display + recon only)
```

**Anchor facts a new engineer needs:**
- **One `tc_deal` per property** (`property_key` is per-property, *not* per-deal). **Many `tc_cycles` per deal** (sale, listing, re-list).
- **Documents, envelopes, checklist, commissions all hang off the *cycle*.** Contacts and expenses can hang off the deal *or* a cycle.
- **`tc_deals.stage`** (`closed`/`pending`/`pre_contract`/`active_listing`) is a **manual enum**, not a workflow engine — it changes by broker edit or import, never automatically.
- **`tc_cycles.status`** is a verbatim SkySlope string, intentionally **unconstrained** (it's a mirror). Every other internal status is **CHECK-constrained** at the DB.

### 1.4 The two lifecycles that matter

**Deal stage** — manual/imported enum. `pending` / `pre_contract` / `active_listing` are the `LIVE_STAGES` that drive the principal-review queue; `closed` is terminal.

**Envelope** — the *only fully codified state machine*, and the legally load-bearing one:

```
draft ──send──> sent ──signer completes──> partially_signed ──last signer──> completed
                  │                              │                              │
                  └──────────── void ────────────┴──── void ───────────────────┘ → voided
                                                                          (seal: flatten
                                                                           fields, append
                                                                           ESIGN/UETA cert,
                                                                           SHA256, store as
                                                                           executed tc_document)
```

Signing is **ordered**: `signing_order` groups are released sequentially — group N is tokenized only after group N-1 fully completes. Tokens are 256-bit, **stored hash-only**; the raw token lives only in the email link. The seal produces a tamper-evident certificate citing ESIGN (15 USC 7001) + Oregon UETA (ORS ch. 84), with source-PDF SHA256s.

### 1.5 The SkySlope boundary (the contract)

| Vault is authoritative for | SkySlope is reference-only for |
|---|---|
| All `tc_*` rows, signed/sealed docs, e-sig records, principal reviews, commissions, expenses, contacts | Live SkySlope workflow state, third-party portal URLs, OREF form-library versions (ingested via `/api/admin/forms/ingest`) |

**Invariant:** never publish a transaction stat from `skyslope_*`; never reconcile `tc_*` *from* SkySlope. `tc_cycles.status` is the one place SkySlope's string is stored verbatim, by design.

---

## 2. Problem Areas (consolidated, deduped, ranked)

Findings from all four diagnostic reviews, deduplicated and re-ranked. **Money + legal paths lead.** Each is code-confirmed; map-only claims that did not survive code-reading are listed as **false positives** at the end so we don't chase them.

### CRITICAL

**C1 — No transactional integrity anywhere; every multi-table transition is independent PostgREST calls.**
*Theme: structural. Location:* all of `lib/tc/` + `app/actions/tc-*.ts`; worst at `seal-envelope.ts:154-209` (storage upload → `tc_documents.insert` → `tc_envelopes.update status='completed'` → `tc_events.insert`, four un-rolled-back awaits) and `tc-sign.ts:233-252` (per-field updates → recipient `completed_at` + token-kill → event → `advanceOrSeal`). Confirmed: zero `.rpc()`, zero transactions across the TC surface.
*Impact:* A crash/timeout between any two calls leaves a structurally invalid deal: an orphan sealed PDF in storage with no executed-doc row, an envelope stuck `partially_signed` forever with all signers done and nothing to re-trigger the seal, or signature values persisted while the recipient still looks unsigned (re-submit double-applies). **For a legal e-signature record, "completed envelope + certificate" must be all-or-nothing.** **Severity: Critical.**

**C2 — Seal has no lock; concurrent final signers double-seal (and the only guard races).**
*Theme: structural. Location:* `seal-envelope.ts:35-43` (`advanceOrSeal` reads recipients, computes `allSigned`, calls seal) and the sole guard `if (!env || env.status === 'completed') return` at `:79` — a read-then-write with no lock (confirmed at line 79). Two near-simultaneous last signers each mark themselves done, each call `advanceOrSeal`, both observe `allSigned`, both pass the `:79` check before either writes `completed`.
*Impact:* Two executed `tc_documents` rows, two `sealed_sha256`, **two signed-copy emails to every client party**, two completion events; or a slow caller's `partially_signed` write (`:45`) lands *after* a fast caller set `completed`, regressing the envelope out of its terminal state. **Severity: Critical.**

**C3 — PDF sealing + N+1 completion emails run inline in the signer's HTTP request.**
*Theme: performance / reliability. Location:* `tc-sign.ts:254` (`await advanceOrSeal`) → `seal-envelope.ts:77-238`. Source PDFs download **serially** in a `for` loop (`:123-130`, no `Promise.all`); `sealEnvelope()` flattens with pdf-lib; then **one `await sendCompletionCopy` per recipient**, each carrying the full sealed PDF as an attachment (`:214-226`). No `waitUntil`/`after()`.
*Impact:* Multi-second to tens-of-seconds wall time on the single most important action in the system, with real Vercel-timeout risk. A timeout aborts mid-seal **after** the recipient is marked complete and their token destroyed — and because `advanceOrSeal` already filtered them done, **no retry path exists**: the envelope is permanently stranded. This is the intersection of C1/C2 and latency. **Severity: Critical.**

**C4 — DB CHECK vs TypeScript enum drift breaks template-based envelope creation (the OREF forms library).**
*Theme: duplication / correctness. Location:* `skyslope-field-map.ts:51-53` maps `DateSigned`/`Date`/`TimeSigned` → `'date'`; `tc-envelopes.ts:412` inserts that `f.type` **raw** into `tc_envelope_fields.type`, whose CHECK allows only `('signature','initials','date_signed','text','checkbox','strike')` (`migration 20260610020000:104`) — **`'date'` is rejected** (both confirmed above). There is no `'date' → 'date_signed'` mapping anywhere.
*Impact:* **Any OREF form whose field map contains a date field fails the bulk insert with a check-constraint violation, killing envelope creation from that template** — the entire point of the forms library. Even if a `'date'` row slipped past, `SignFlow.tsx` has no `'date'` case and renders it as a free-text box. The chain is broken end-to-end for the template path. Separately, the reverse drift exists: the DB CHECK *also* allows `'strike'` which the TS `SignFieldType` (`signing.ts:15`) and `drawFieldValue` (`seal-pdf.ts`) don't handle — a struck clause would silently draw nothing. **Severity: Critical** (it's a live, shipped break of a core feature).

### HIGH

**H1 — `tc_events` audit spine is NOT immutable to the service role that writes everything.**
*Theme: legal / structural. Location:* `migration 20260610010000:134` — `revoke update, delete on public.tc_events from anon, authenticated` (confirmed). Every TC action uses the **service role**, which is neither `anon` nor `authenticated`, so the revoke does not constrain it. Contrast `tc_principal_reviews`, which uses a `BEFORE UPDATE OR DELETE` trigger that fires for *every* role.
*Impact:* The audit log — cited in-code as the ORS 696.280 six-year-retention defensibility artifact — can be silently edited/deleted by any code path or a compromised service key. Immutability is convention-only. **Severity: High.** *Fix is a five-line trigger.*

**H2 — Decline by any one signer voids the whole envelope, stranding valid prior signatures.**
*Theme: structural / workflow. Location:* `tc-sign.ts:259-287`: `declineSigning` sets the recipient `declined_at` then **unconditionally** flips the entire envelope to `voided` and nulls every token.
*Impact:* On a multi-party packet where buyer1 + seller1 already signed (PNGs persisted), if seller2 declines, the envelope can never seal and the collected legal signatures are stranded with no executed document and no broker remediation path. **Severity: High.**

**H3 — `submitSigning` doesn't re-check the ordering gate — a shared/forwarded link signs out of order.**
*Theme: structural. Location:* `getSigningSession` enforces ordered routing (`tc-sign.ts:84-94`), but `submitSigning` (`:193-256`) validates only `status!=='voided'`, `!completed_at`, `consented_at` — it never re-runs the lower-order-pending check before persisting.
*Impact:* A recipient who loaded while it was their turn, or who reuses a still-live token, can submit even after routing should block them. Combined with C2, ordering is advisory at the write, defeating escrow/title-before-buyer sequencing. **Severity: High.**

**H4 — Zero automated tests on the entire money/legal path.**
*Theme: maintainability. Location:* `lib/tc/` has exactly one test (`skyslope-field-map.test.ts`, SkySlope→fraction translation only). No test for `seal-pdf.ts` (the top-left→bottom-left y-flip at `:76`), `seal-envelope.ts` (the state machine — extracted *to be testable* per its own docstring, yet untested), `banking-days.ts` (the OAR deadline math), `signing.ts`, or any commission/review action.
*Impact:* The legally load-bearing logic is untested. A wrong Juneteenth/Columbus rule silently miscomputes the 7-banking-day deadline; a y-flip regression mis-places signatures on the executed PDF; a commission-net regression mis-pays — all ship green. **Severity: High** (highest-leverage *risk-reduction* move).

**H5 — No zod / schema validation at the public signing boundary; unchecked JSONB is stored and embedded in the sealed PDF.**
*Theme: maintainability / security. Location:* `tc-sign.ts:190-240`. `SubmitFieldValue` is a bare TS type; `values` arrive from the public unauthenticated `/sign/[token]` client and are written to `tc_envelope_fields.value` jsonb after only minimal hand-rolled checks. The `png` data URL is never validated for size/format/scheme before `pdf-lib.embedPng`. No zod anywhere in the action layer.
*Impact:* A signer can submit an arbitrarily large base64 blob (no length cap) that bloats the row and the sealed PDF, or junk values for non-required fields (the persist loop writes every submitted value whose id is in `validIds`). **Severity: High.**

**H6 — `getServiceSupabase()` copy-pasted 9× and all TC reads bypass the DAL — no caching seam exists.**
*Theme: duplication / performance / maintainability. Location:* byte-identical helper in all 9 `tc-*.ts` files; ~120 raw `.from('tc_*')` calls in `app/actions`; no `lib/data/tc/`.
*Impact:* A change to the client config (timeout, `db.schema`) needs 9 edits. More importantly, **there is no place to attach `unstable_cache`**, which is the structural reason the hot reads (P1/P2 below) can't be cached. This is the keystone that unlocks the performance fixes. **Severity: High.**

**H7 — No deal/cycle ownership check on any envelope/commission/review action.**
*Theme: structural / security. Location:* `requireBroker()` (`tc-envelopes.ts:40-48`) checks only that the role is `broker`/`superuser`; it never verifies the caller owns the cycle. `createEnvelopeFromDocuments`, `sendEnvelope`, `voidEnvelope`, `updateTcCommission`, `recordPrincipalReview` all take a raw id and act with the RLS-bypassing service role.
*Impact:* Any broker can void another broker's in-flight envelope (killing all live tokens) or send/edit on a deal they don't handle. Small blast radius at a 3-broker shop, but it's a real privilege gap. *Also note the same predicate is duplicated under three names — `requireBroker`/`requireBrokerRole` inline ~13×.* **Severity: High** (consolidate + scope together).

### MEDIUM

**M1 — `getDealDashboard` does an unbounded `select('*')` on `skyslope_transactions`, no cache, on a `force-dynamic` page** (`deals.ts:137`; page `dynamic='force-dynamic'`). Pulls every row + the heavy `headline`/`cycles[]`/`rollup` JSONB on every view. Snapshot data that only changes on sync — ideal cache candidate, currently uncached. *Performance.*

**M2 — No index on `tc_envelope_recipients.auth_token_hash` — the public signing hot path** (column `migration 20260610020000:86`; only index is on `envelope_id`). Every `/sign` action is a seq-scan; table grows one row per signer forever. *Performance.* Also no UNIQUE on the column, and lookups use `.maybeSingle()` (`tc-sign.ts:64,174,199,263`) → a collision becomes a 500.

**M3 — Deal-detail page re-queries data it already has** (`[key]/page.tsx:405-417`; `tc-required-docs.ts:71-106`). After `getTcDeal` loads all cycles/docs/checklist, the page fans out `getAnticipatedDocuments(c.id)` per cycle, which **re-queries** `tc_cycles`/`tc_checklist_items`/`tc_documents` already in memory. ~`3K+K` extra round-trips for K cycles (parallelized, so latency-bounded — hence Medium). *Performance.*

**M4 — OAR review deadline recomputed from a live mutable date, never frozen** (`tc-signoff.ts:~138`; `tc_principal_reviews` stores `reviewed_at` but not the deadline that applied). If `contract_acceptance_date` is later corrected, every queued item's 7-banking-day deadline shifts retroactively, and there's no record of what the deadline *was* at review time. For an OAR 863-015-0140 artifact the "within 7 banking days?" determination should be reconstructible from frozen data. *Legal / maintainability.*

**M5 — Principal-review has no dedup; the same item can yield two conflicting immutable OAR records** (`tc-signoff.ts:176-220`; no UNIQUE on `tc_principal_reviews.item_id`). The `status==='in_review'` check and the insert aren't atomic; two near-simultaneous reviews both pass and write two append-only rows that, being trigger-protected, can never be corrected. *Legal.*

**M6 — `createEnvelopeFromTemplate` half-builds on partial failure** (`tc-envelopes.ts:322-437`). Inserts envelope + recipients, then per-form storage-copy + doc inserts; an error on a later form returns after earlier rows are committed → orphan draft + stranded storage. Same root cause as C1, lower blast radius (it's a draft). *Structural.*

**M7 — Public signing actions have zero rate-limiting / payload caps** (`tc-sign.ts` `getSigningSession`/`submitSigning`/etc.). Token brute-force is infeasible (256-bit), so the exposure is resource/cost abuse: large `value` payloads, repeated signed-URL minting. *Security / performance.*

**M8 — Two divergent OREF-document fuzzy matchers.** Dashboard StepTracker regexes (`deals/page.tsx:37-48`) vs `required-documents.ts` `matchAny` lists (`:54-108`) encode the same "is the sale agreement present?" vocabulary twice; they drift, so progress circles and "missing" alerts can disagree about the same doc. *Duplication.*

**M9 — List/rollup readers have no pagination or caching.** `getEnvelopesOverview` caps at `.limit(200)` (silently *drops* older rows rather than paginating), `getCommissionsRollup` has no cap and joins through `tc_cycles→tc_deals` per row (`tc-commissions.ts:85-90`). Fine today, degrades linearly. *Performance.*

### LOW

**L1 — `EnvelopeField` geometry read from DB with no bounds validation** at seal time (`seal-pdf.ts:70-104` guards only the page index, not in-page x/y/w/h). A bad/NaN fraction places a signature off-page on the executed legal doc with no error. The composer clamps client-side and `saveEnvelopeFields` clamps to `[0,1]` (`tc-envelopes.ts:528`), but there's no `x+w≤1`/finite check. *Maintainability.*

**L2 — Per-field serial UPDATE loop on submit** (`tc-sign.ts:233-240`) — one round-trip per signed field; batch into one upsert. *Performance.*

**L3 — `tc_cycles.raw` and field `value` are untyped `any` JSONB threaded through compliance logic** (`tc-required-docs.ts:28`). A SkySlope payload-shape change silently degrades broker-role inference to `unknown` (suppressing required-doc rules) with no signal. *Maintainability.*

**L4 — `clamp01()` defined twice, identical** (`skyslope-field-map.ts:99`, `tc-envelopes.ts:528`) though the latter already imports from the former. Geometry safety logic should live once. *Duplication.*

**L5 — `SignerRole`→`RecipientRole` reconciled by ad-hoc `startsWith` prefix-match** (`tc-envelopes.ts:368-372`). Narrowly safe today (only `buyer1/2`,`seller1/2`,`listing_broker` seeded) but would mis-route if `buyer_broker` were ever added. *Duplication.*

### False positives from the architecture maps (do **not** chase)

Code-reading disproved several map "criticals" — surfacing them so the team doesn't spend effort:
- **"Status fields are unconstrained free text" — FALSE.** Every internal status/stage is CHECK-constrained at the DB. Only `tc_cycles.status` is intentionally free (it's a SkySlope mirror).
- **"DAL boundary violation (G1) is critical" — OVERSTATED.** G1 evidently allowlists these paths; the real, actionable issue is the *missing caching seam* (H6), not a gate breach.
- **"Principal review allows double-review" / "seal has no idempotency guard at all" — PARTIALLY FALSE.** `recordPrincipalReview` *does* check `status==='in_review'`, and seal *does* early-return on `status==='completed'`. The real defects are narrower: those checks **race** (C2, M5), not that they're absent.
- **"No bounds check on field geometry" — MOSTLY HANDLED.** `saveEnvelopeFields` clamps to `[0,1]` on write; only the defensive seal-time + `x+w≤1` check is missing (L1).
- **"SkySlope is treated as source of truth somewhere" — FALSE.** The boundary is correctly maintained; the dashboard read is display-only.
- **The map's claimed principal-review decision enum (`approved_with_changes`, etc.) is wrong** — the DB CHECK is `('approved','sent_back')`; code and DB agree. (This is itself evidence for the C4 theme: enum truth lives only in scattered CHECKs.)

---

## 3. Refactor Strategy (phased, ship-safe throughout)

Sequenced so the system stays shippable at every step. Phase 0 is a day; the legal-integrity work is Phase 1; structural moves follow. **Money + legal correctness first.**

### Phase 0 — Quick wins (hours; zero behavior change, pure safety)
*Goal: stop the live break and the silent risks, with trivially-reversible diffs.*
| Change | Fixes | Verify |
|---|---|---|
| Map `'date'→'date_signed'` at the template boundary in `tc-envelopes.ts`; make `skyslope-field-map.ts` emit canonical `SignFieldType`. | **C4** | Create an envelope from an OREF template with a date field; insert succeeds; date renders as a date stamp. |
| Add `tc_events` `BEFORE UPDATE OR DELETE` immutability trigger (copy the `tc_principal_reviews` one). | **H1** | Migration; attempt `update tc_events` as service role → raises. |
| Add partial index `tc_envelope_recipients(auth_token_hash) where … is not null` + UNIQUE. | **M2** | `EXPLAIN` the `/sign` lookup → index scan. |
| Add `tc_envelope_fields.type` to TS `SIGN_FIELD_TYPES` *or* drop `'strike'` from the CHECK — pick one; add the parity assertion. | **C4 (strike half)** | Parity test green. |
*Risk: minimal. All additive or single-line.*

### Phase 1 — Legal & money integrity: make terminal transitions atomic (days)
*Goal: a "completed" envelope and its certificate become all-or-nothing; the seal can never double-fire or strand.*
- Introduce **compare-and-swap on the terminal status flip**: `update tc_envelopes set status='sealing' where id=? and status in ('sent','partially_signed')` — proceed only if one row affected (closes **C1/C2**).
- Make `sealAndCompleteEnvelope` **resumable & idempotent**: before inserting the executed doc, check `executed_document_id IS NULL` and that the storage object isn't already present (extends the `:79` guard).
- Re-run the ordering gate **inside** `submitSigning` before persisting (**H3**).
- Fold principal-review insert + item transition into one conditional update; add `unique(item_id)` partial index (**M5**).
*Risk: medium (touches the signing core). Verify: integration test that fires two concurrent final submissions and asserts exactly one executed doc, one completion email per party, one `envelope_completed` event.*
*Ships independently of Phase 2 — still synchronous, just safe.*

### Phase 2 — Get the seal off the request path (days)
*Goal: the signer's "Confirm and sign" returns fast; sealing becomes retriable.*
- `submitSigning` marks the recipient done, writes the event, **returns**; enqueues the seal (set `status='sealing'`, picked up by a cron / `after()`), then a reconciliation cron finds `all-signable-completed AND status NOT IN ('completed')` and (re-)seals — now safe because of Phase 1's idempotency (**C3**).
- Parallelize source-PDF downloads (`Promise.all`) and completion emails; add a per-recipient `notified_at` so retries don't re-spam (**M9 email half**).
*Risk: medium. Verify: kill the function mid-seal in staging; the reconciliation cron completes it; no duplicate docs/emails.*

### Phase 3 — Validation & authorization boundary (days)
*Goal: harden the public surface and enforce ownership.*
- **Zod at every public action** (`submitSigning`/`recordSigningConsent`/`declineSigning`): discriminated-union value schema, `png` capped & scheme-restricted, reject fields the recipient doesn't own (**H5, L1**).
- **One `requireBrokerRole()` + `requirePrincipal()`** in `app/actions/tc/_auth.ts`, replacing all ~13 inline copies and the 3 differently-named wrappers; add **deal-ownership scoping** (join `tc_cycles→tc_deals` assignment) at this single choke point (**H7**).
- Decline → notify broker + leave envelope resolvable, don't auto-void (**H2**).
- Rate-limit `/sign` actions + payload caps (**M7**).
*Risk: low-medium. Verify: zod rejects oversized PNG; a non-owning broker is denied `voidEnvelope`; decline no longer strands signed parties.*

### Phase 4 — Consolidate the canonical homes (days)
*Goal: one source of truth for the things that drift.*
- One `getServiceSupabase()` in `lib/tc/service-client.ts`; **extract read paths into `lib/data/tc/`** (`getTcDeal`, `getDealDashboard`, rollups) so they pass G1 and gain a caching seam (**H6**).
- One field-type enum (`signing.ts` owns it; mapper conforms) + the DB/TS **parity gate** (**C4 root**).
- `required-documents.ts` becomes the canonical doc-recognition vocabulary; StepTracker derives steps from rule ids (**M8**).
- `clamp01` and `signerRoleToRecipientRole` exported once (**L4, L5**).
- Snapshot the OAR deadline + acceptance date onto `tc_principal_reviews` at insert; stamp `review_due_at` when an item enters `in_review` (**M4**).
*Risk: low (mostly mechanical). Verify: parity gate green; cache hit on dashboard; StepTracker and AnticipatedDocs agree on the same doc.*

### Phase 5 — Performance & test hardening (ongoing)
*Goal: cache the now-extractable hot reads; lock the legal math with tests.*
- `unstable_cache` + column projection on `skyslope_transactions` (now that H6 created the seam) (**M1**); pass already-loaded data into `getAnticipatedDocuments`; batch `getEnvelopesForCycle` into one `IN (cycle_ids)` (**M3**); real cursor pagination on overview/rollups (**M9**).
- **Tests** for `banking-days` (2026 holiday table incl. weekend observance), `sealEnvelope` geometry round-trip, commission net split, `advanceOrSeal` ordering — gated in `ci:gates` (**H4**).

---

## 4. Improved Architecture (target)

### 4.1 Target layering

```
┌──────────────────────────────────────────────────────────────────────┐
│ Routes / UI  (unchanged surface)                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Action boundary  app/actions/tc/                                      │
│  • _auth.ts        requireBrokerRole() / requirePrincipal()           │
│                    + deal-ownership scope  (ONE choke point — H7)      │
│  • _schemas.ts     zod for every public/mutating input  (H5)          │
│  • thin orchestration only — no raw .from(), no business logic        │
├──────────────────────────────────────────────────────────────────────┤
│ Domain / state machines  lib/tc/                                      │
│  • deal-state.ts      typed Deal/Envelope FSM + transition guards     │
│  • signing.ts         SINGLE field-type + role vocabulary (canonical) │
│  • seal-*.ts          pure compose; sealing invoked async, idempotent │
│  • required-documents.ts  CANONICAL doc-recognition vocabulary        │
├──────────────────────────────────────────────────────────────────────┤
│ DAL  lib/data/tc/   ← NEW: the only place tc_* is read                │
│  • _client.ts (one getServiceSupabase)  • deal-detail reader (batched)│
│  • dashboard reader (cached+projected)  • rollups (cached, paginated) │
├──────────────────────────────────────────────────────────────────────┤
│ Transactional core  Postgres functions (.rpc)                         │
│  • submit_recipient_signing()   • seal_and_complete_envelope()        │
│  • record_principal_review()    • instantiate_template_envelope()     │
│    → each commits its multi-table transition atomically (C1/C2/M5/M6) │
├──────────────────────────────────────────────────────────────────────┤
│ Postgres  public.tc_*  +  parity-gated CHECK enums  +  immutable      │
│           tc_events trigger  +  token index  (Phase 0/1)              │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 The four canonical homes for duplicated logic
1. **Field-type & signer-role vocabulary → `lib/tc/signing.ts`.** The SkySlope mapper *conforms* to it; a DB↔TS parity gate keeps the CHECK lists and `as const` arrays in lock-step.
2. **Auth → `app/actions/tc/_auth.ts`.** One `requireBrokerRole`, one `requirePrincipal`, both ownership-scoped.
3. **DB client + all reads → `lib/data/tc/`.** One `getServiceSupabase`; reads cached/tagged here.
4. **Document-recognition vocabulary → `lib/tc/required-documents.ts`.** Dashboard StepTracker derives from rule ids.

### 4.3 Transactional-integrity boundary
Every **terminal** state transition moves into a single Postgres function called via `.rpc()`, so the field writes + recipient completion + status flip + audit event **commit or roll back together**. Non-terminal edits (save fields, save recipients) can stay as ordinary upserts. Sealing is invoked **asynchronously** and is **idempotent** (compare-and-swap into `sealing`, guarded by `executed_document_id IS NULL`), so a timeout or retry can never double-seal or strand.

### 4.4 A real deal/envelope state machine
Today `tc_deals.stage` is a bare enum and the envelope FSM lives implicitly inside `advanceOrSeal`. Target: an explicit, typed transition table with guards (code in §5.1) so illegal transitions (e.g. `completed → partially_signed`, or sealing a `voided` envelope) are impossible to express, and the seal's compare-and-swap is the only path into `completed`.

### 4.5 Source-of-truth contract vs SkySlope (unchanged, now gated)
Vault stays authoritative; SkySlope stays inbound display/recon only. Add a one-line gate asserting **no `tc_*` write path imports from a `skyslope_*` read**, locking the boundary against future drift. `tc_cycles.status` remains the single intentional verbatim mirror.

---

## 5. Code — the highest-leverage refactors

Four concrete, idiomatic (Next 16 / TS-strict / Supabase / DAL) refactors. These are the load-bearing ones; the rest of the phased plan is mechanical once these land.

### 5.1 Typed envelope state machine + transition guard
`lib/tc/deal-state.ts` — makes illegal transitions unrepresentable; seal's only entry is `'sealing'`.

```ts
// lib/tc/deal-state.ts
export const ENVELOPE_STATUSES = [
  'draft', 'sent', 'partially_signed', 'sealing', 'completed', 'voided',
] as const
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number]

/** Allowed transitions. `sealing` is the claim state; `completed` is reachable ONLY from it. */
const ENVELOPE_TRANSITIONS: Record<EnvelopeStatus, readonly EnvelopeStatus[]> = {
  draft:            ['sent', 'voided'],
  sent:             ['partially_signed', 'sealing', 'voided'],
  partially_signed: ['partially_signed', 'sealing', 'voided'],
  sealing:          ['completed', 'sent'], // 'sent' = rollback if seal fails
  completed:        [],                    // terminal
  voided:           [],                    // terminal
}

export function canTransition(from: EnvelopeStatus, to: EnvelopeStatus): boolean {
  return ENVELOPE_TRANSITIONS[from]?.includes(to) ?? false
}

export class IllegalTransitionError extends Error {
  constructor(readonly from: EnvelopeStatus, readonly to: EnvelopeStatus) {
    super(`Illegal envelope transition: ${from} -> ${to}`)
    this.name = 'IllegalTransitionError'
  }
}

export function assertTransition(from: EnvelopeStatus, to: EnvelopeStatus): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to)
}

/**
 * Compare-and-swap the status. Returns true iff THIS caller won the transition.
 * This is the single atomic primitive that closes the double-seal race (C2):
 * only one concurrent caller can move sent/partially_signed -> sealing.
 */
export async function claimTransition(
  supabase: { from: (t: string) => any },
  envelopeId: string,
  from: readonly EnvelopeStatus[],
  to: EnvelopeStatus,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tc_envelopes')
    .update({ status: to })
    .eq('id', envelopeId)
    .in('status', from as unknown as string[]) // WHERE status IN (from) → CAS
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) === 1
}
```

### 5.2 Atomic signing submit + idempotent seal as Postgres RPCs
Migration providing the transactional core (closes **C1/C2**). The TS action then becomes thin.

```sql
-- supabase/migrations/2026XXXXXXXXXX_tc_signing_rpcs.sql

-- Persist a recipient's fields + completion + audit event in ONE transaction,
-- re-checking the ordering gate inside the txn (closes H3). Returns whether the
-- envelope is now fully signed (caller enqueues the async seal).
create or replace function public.submit_recipient_signing(
  p_recipient_id uuid,
  p_field_values jsonb,   -- [{ field_id, value, ip }]
  p_ip text
) returns boolean
language plpgsql security definer as $$
declare
  v_env uuid; v_order int; v_lower_pending int;
begin
  select envelope_id, signing_order into v_env, v_order
  from tc_envelope_recipients
  where id = p_recipient_id and completed_at is null and consented_at is not null
  for update;
  if v_env is null then raise exception 'recipient not signable'; end if;

  -- Ordering gate, INSIDE the txn (H3)
  select count(*) into v_lower_pending
  from tc_envelope_recipients
  where envelope_id = v_env and role <> 'cc'
    and coalesce(signing_order,1) < coalesce(v_order,1) and completed_at is null;
  if v_lower_pending > 0 then raise exception 'out of signing order'; end if;

  update tc_envelope_fields f
  set value = (v->>'value')::jsonb, signed_at = now(), signed_ip = v->>'ip'
  from jsonb_array_elements(p_field_values) v
  where f.id = (v->>'field_id')::uuid and f.recipient_id = p_recipient_id;

  update tc_envelope_recipients
  set completed_at = now(), auth_token_hash = null, ip = p_ip
  where id = p_recipient_id;

  insert into tc_events(cycle_id, actor, action, detail)
  select e.cycle_id, 'signer', 'envelope_recipient_signed',
         jsonb_build_object('recipient_id', p_recipient_id)
  from tc_envelopes e where e.id = v_env;

  return not exists (
    select 1 from tc_envelope_recipients
    where envelope_id = v_env and role <> 'cc' and completed_at is null
  );
end $$;

-- Claim the seal atomically (CAS). Only one concurrent caller wins (closes C2).
create or replace function public.claim_envelope_seal(p_envelope_id uuid)
returns boolean language sql security definer as $$
  update tc_envelopes set status = 'sealing'
  where id = p_envelope_id
    and status in ('sent','partially_signed')
    and executed_document_id is null
  returning true;
$$;
```

```ts
// app/actions/tc-sign.ts  (the action becomes thin + safe)
'use server'
import { SubmitSigningSchema } from './tc/_schemas'

export async function submitSigning(token: string, rawValues: unknown) {
  const values = SubmitSigningSchema.parse(rawValues)      // H5
  const supabase = getServiceSupabase()
  const recip = await resolveRecipientByToken(supabase, token)
  if (!recip) return { error: 'invalid' as const }

  const { data: fullySigned, error } = await supabase.rpc('submit_recipient_signing', {
    p_recipient_id: recip.id, p_field_values: values, p_ip: recip.ip,
  })                                                        // C1/C2/H3 atomic
  if (error) return { error: error.message }

  if (fullySigned) {
    const { data: won } = await supabase.rpc('claim_envelope_seal', {
      p_envelope_id: recip.envelope_id,
    })
    if (won) enqueueSeal(recip.envelope_id)                 // C3: off-request, async
  }
  return { ok: true as const }
}
```

### 5.3 Single canonical, batched deal-detail DAL reader
`lib/data/tc/deal-detail.ts` — one home, batched `IN (...)` reads, a caching seam (closes **H6**; unblocks **M1/M3**).

```ts
// lib/data/tc/_client.ts  — the ONLY getServiceSupabase (replaces 9 copies, H6)
import { createClient } from '@supabase/supabase-js'
export function getServiceSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}
```

```ts
// lib/data/tc/deal-detail.ts
import { unstable_cache } from 'next/cache'
import { getServiceSupabase } from './_client'

export type DealDetail = Awaited<ReturnType<typeof readDealDetailUncached>>

async function readDealDetailUncached(propertyKey: string) {
  const sb = getServiceSupabase()

  const { data: deal } = await sb.from('tc_deals')
    .select('id, property_key, address, broker_name, stage, stage_detail')
    .eq('property_key', propertyKey).maybeSingle()
  if (!deal) return null

  const { data: cycles } = await sb.from('tc_cycles')
    .select('*').eq('deal_id', deal.id).order('created_at')
  const cycleIds = (cycles ?? []).map((c) => c.id)
  if (cycleIds.length === 0) return { deal, cycles: [], documents: [], checklist: [], envelopes: [] }

  // ONE batched round-trip per child table — no per-cycle N+1 (M3)
  const [docs, checklist, envelopes] = await Promise.all([
    sb.from('tc_documents').select('*').in('cycle_id', cycleIds).eq('archived', false),
    sb.from('tc_checklist_items').select('*').in('cycle_id', cycleIds).order('sort_order'),
    sb.from('tc_envelopes')
      .select('*, tc_envelope_recipients(*)')
      .in('cycle_id', cycleIds),
  ])

  return {
    deal,
    cycles: cycles ?? [],
    documents: docs.data ?? [],
    checklist: checklist.data ?? [],
    envelopes: envelopes.data ?? [],
  }
}

/** Cached + tag-invalidated. Mutations call revalidateTag(`tc-deal:${propertyKey}`). */
export function readDealDetail(propertyKey: string) {
  return unstable_cache(
    () => readDealDetailUncached(propertyKey),
    ['tc-deal-detail', propertyKey],
    { tags: [`tc-deal:${propertyKey}`], revalidate: 60 },
  )()
}
```

### 5.4 Zod action boundary + the canonical field-type enum (closes the C4 root + H5)
One vocabulary in `signing.ts`; the SkySlope mapper conforms; a parity test locks DB↔TS; the public input is validated.

```ts
// lib/tc/signing.ts  — canonical, single source for field types (C4 root)
export const SIGN_FIELD_TYPES = ['signature','initials','date_signed','text','checkbox','strike'] as const
export type SignFieldType = (typeof SIGN_FIELD_TYPES)[number]

// lib/tc/skyslope-field-map.ts  — mapper now emits CANONICAL types (no more 'date')
const TYPE_MAP: Record<string, SignFieldType> = {
  Signature: 'signature', Initials: 'initials',
  DateSigned: 'date_signed', TimeSigned: 'date_signed', Date: 'date_signed', // was 'date' → C4 fix
  checkboxblock: 'checkbox',
}
export function mapType(t?: string): SignFieldType {
  return (t ? TYPE_MAP[t] : undefined) ?? 'text'
}
```

```ts
// app/actions/tc/_schemas.ts  — zod at the public boundary (H5, L1)
import { z } from 'zod'

const PngDataUrl = z.string()
  .startsWith('data:image/png;base64,')
  .max(750_000) // cap signature blob size (H5)

const SignFieldValue = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('signature'),   png: PngDataUrl }),
  z.object({ kind: z.literal('initials'),     png: PngDataUrl }),
  z.object({ kind: z.literal('date_signed'),  text: z.string().max(32) }),
  z.object({ kind: z.literal('text'),         text: z.string().max(2_000) }),
  z.object({ kind: z.literal('checkbox'),     checked: z.boolean() }),
])

export const SubmitSigningSchema = z.array(
  z.object({ field_id: z.string().uuid(), value: SignFieldValue, ip: z.string().max(64).optional() }),
).max(200)
export type SubmitFieldValue = z.infer<typeof SubmitSigningSchema>[number]
```

```ts
// lib/tc/__tests__/enum-parity.test.ts  — DB CHECK ↔ TS union parity gate (C4 lock)
import fs from 'node:fs'
import { SIGN_FIELD_TYPES } from '../signing'

test('tc_envelope_fields.type CHECK matches SIGN_FIELD_TYPES', () => {
  const sql = fs.readFileSync(
    'supabase/migrations/20260610020000_tc_forms_signing_v1.sql', 'utf8')
  const m = sql.match(/type in \(([^)]+)\)/)!
  const dbTypes = m[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort()
  expect(dbTypes).toEqual([...SIGN_FIELD_TYPES].sort())
})
```

---

## Bottom line

The TC system is well-architected at the schema and crypto layer; do **not** rewrite it. The work is surgical and sequenced to stay shippable: **Phase 0 (a day)** stops the live template-creation break (C4) and the silent audit-mutability gap (H1). **Phase 1** makes the money/legal terminal transitions atomic via compare-and-swap RPCs (C1/C2/M5). **Phase 2** gets the seal off the signer's request so it can't strand (C3). The four refactors in §5 — the typed FSM + CAS guard, the atomic signing RPCs, the batched cached DAL reader, and the zod boundary with one canonical field-type enum — are the highest-leverage pieces and the foundation everything else snaps onto.

Key files: `lib/tc/seal-envelope.ts:35-209`, `app/actions/tc-sign.ts:193-287`, `app/actions/tc-envelopes.ts:322-437,412`, `lib/tc/skyslope-field-map.ts:51-53`, `lib/tc/signing.ts:15`, `supabase/migrations/20260610020000_tc_forms_signing_v1.sql:104`, `supabase/migrations/20260610010000_tc_system_v1.sql:134`.