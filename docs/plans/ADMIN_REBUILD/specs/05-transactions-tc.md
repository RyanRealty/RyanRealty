# Spec 05 — Transactions · TC · E-sign · Commissions · Financials

**Area:** Deals pipeline ↔ transactions ↔ e-sign, commissions, financials
**Audit basis:** `audit-reports/deals-tc.md` (2026-07-16, commit `d3dd457a`)
**Architecture basis:** `00-REASONING-AND-ARCHITECTURE.md` (RC1–RC7, C1–C5, §4.1–§4.8, IA §5)
**Owner-facing home in the new IA:** `TRANSACTIONS` (§5) — with the pre-contract pipeline living under `PEOPLE`.

> Read this whole document before writing code. Every decision below is forced by a
> constraint (C#) and kills a root cause (RC#). Table/column names are verified
> against `docs/DATABASE_SCHEMA_SNAPSHOT.md`; function names against `docs/DAL_INDEX.md`
> and the live tree. Migrations are additive and back-compatible (§7 sequencing rule).

---

## 0. The problem this spec solves, in one paragraph

There are **three disconnected "deal" systems wearing one nav section** (audit §0):
the **CRM pipeline** (`crm_deals`, 20 rows, live, full CRUD), the **SkySlope snapshot**
(`skyslope_transactions`, 33 rows, read-only, **36 days stale, no cron**), and the
**in-house TC + e-sign** (`tc_*`, 33 deals / 2,358 docs / **0 envelopes ever sent**,
**0 principal reviews ever recorded**). They share **no key, no FK, no sync**. A CRM
deal **cannot become a transaction** through any UI. Commission is recorded in **three
unreconciled stores**, so the three "how much did we close" surfaces **disagree by
construction** (audit D7) — a C4 integrity failure, i.e. a license risk, not analytics
debt. Five TC read actions run under the **service role with no auth** (audit D3), an
RC5 exposure. Signing emails **fail silently** on a legal signing system (audit D5).
The public signing page **overflows horizontally on phones** (audit D12) — the one
surface a consumer touches. This spec reconciles the three systems into **one
contract-to-close spine**, makes commission a **single source of truth**, gives
transactions a **real refresh path (cron)**, **wires the e-sign apparatus into a real,
acceptance-tested flow** (with a gated launch), and closes the auth + responsive +
optimistic-mutation gaps — reusing every piece the audit proves is solid.

---

## 1. What we KEEP / REBUILD / DELETE (explicit, cited)

### KEEP (solid core — do not rewrite; the audit proves these correct)

| Item | Evidence | Why kept |
|---|---|---|
| **CRM Kanban restage UX** — optimistic override + revert-on-failure + inline error banner | `DealsBoard.tsx:374-390,400-404` — "best-executed mutation UX in the whole domain" (audit §1) | It is already the §4.2 pattern. Generalize it, don't replace it. |
| **`computeCommissionNets`** pure money math (no penny leak, agent+brokerage sum exactly) | `lib/tc/commission-math.ts:31-39`; tested | The money path. Reuse verbatim as the ONE commission calculator. |
| **`finalizeTcUpload`** doc pipeline — sha256 dedupe, page-count, path-prefix anti-tamper, storage cleanup on reject | `tc.ts:314-474` — "genuinely solid" (audit §7) | Correct storage discipline; only its `window.location.reload()` tail changes. |
| **Token minting / signing crypto** — 32-byte base64url token, only the sha256 hash stored, ordered routing mints later-order tokens on demand | `lib/tc/signing.ts:96-103`, `seal-envelope.ts:47-72` — "Good design" (audit §8) | Cryptographically sound; keep as-is. |
| **Seal pipeline** — pdf-lib flatten, appended audit certificate, executed `tc_documents` row, `sealed_sha256` | `lib/tc/seal-envelope.ts:77-238`, `seal-pdf.ts` | The legal artifact generator. Keep; fix only the concurrency guard + email surfacing. |
| **ESIGN/UETA consent capture** before signing (IP/UA/timestamp) | `tc-sign.ts:170-188`, `SignFlow.tsx:90-114` | Legally required; correct. |
| **Banking-day math** for OAR 863-015-0140 (pure, holiday-aware, tested) | `lib/tc/banking-days.ts` + `.test.ts` | Compliance clock; keep. Only its *anchor* changes (D14). |
| **`tc_events` append-only audit spine** | writes on every TC mutation (`tc.ts`, `tc-commissions.ts`, etc.) | The immutable ledger. Keep; add a browsing surface (§F12). |
| **`brokers` table** (`slug` ↔ `display_name` ↔ `email` ↔ `license_number`) + `CRM_BROKER_DISPLAY` constant | schema snapshot `brokers`; `lib/crm/constants.ts:28-31` | The audit said the slug↔name mapping "doesn't exist" (audit §0). **It does.** Use `brokers.slug` as the canonical broker key everywhere. No new mapping table needed. |
| **Auth primitives** — `getCrmAccess()`, `scopeBroker()`, `requirePersonInScope()`, `getAdminContext()`/`requireAdminOr403()`, `isAuthorizedCron()`, `createServiceClient()` | `app/actions/crm.ts:55,123`; `lib/crm/scope.ts:34`; `lib/auth/guards.ts`; `lib/marketing-brain/snapshot.ts:148`; `lib/supabase/service.ts:12` | The §4.4 guard + §4.6 cron already exist. Build on them; do not reinvent. |

### REBUILD (right idea, wrong wiring / model / render)

| Item | From → To | Kills |
|---|---|---|
| **The three deal systems** | 3 unlinked stores → **one spine**: `crm_deals` (pre-contract pipeline) → **FK** → `tc_deals`/`tc_cycles` (contract-to-close, system of record). SkySlope becomes an *ingest feed*, never the displayed source of truth. | RC4, C4 |
| **Commission storage** | 3 unreconciled stores → **`tc_commissions` is the ONE ledger**, read through one metric-layer DAL by `broker_slug`. Leaderboard reads the same DAL. | RC4/§4.5, C4, D7 |
| **Transaction refresh** | hand-run `scripts/skyslope-dashboard-refresh.mjs`, 36-day stale, no cron → **cron `/api/cron/tc-skyslope-sync`** projecting into `tc_*` + a **UI create path** (promote-to-transaction). | RC6, D1 |
| **E-sign** | fully built, **0 uses**, silent-email + race + order + mobile bugs → **wired into a real flow, ship-blockers fixed, gated launch behind a proven round trip** (§8). | RC6, D2/D5/D9/D10/D12 |
| **Every TC mutation's completion signal** | `window.location.reload()` (5 call sites, audit §7) / `router.refresh()` → **§4.2 optimistic + idempotent** (return the changed entity, patch client state, idempotency key). | RC2 |
| **6 hand-rolled table→card forks** (`/admin/deals`, `/admin/deals/[key]`, `/admin/signing`, `/admin/commissions`, `/admin/financials`, forms, plus the Kanban) | 6 bespoke `md:hidden` twins (audit §18) → **one responsive tree per surface**, mobile-first for the loop. | RC3 |
| **Unauth service-role reads** (`getTcDeal`, `getTcDocumentUrl`, `getEnvelopesForCycle`, `getEnvelopeDetail`, `getEnvelopesOverview`) | no in-body auth (audit D3) → **`requireCapability()` in-body** on every read + write. | RC5/§4.4 |

### DELETE (accretion — §4.7)

| Item | Evidence | Replacement |
|---|---|---|
| **`/admin/crm/deals/[id]/**`** (5 files, ~604 lines) — orphaned duplicate full-page deal detail, **zero inbound links**, missing the scope check the modal has (**read leak**, D4) | audit §3, §19 | The one deal detail (§F2), scope-gated. |
| **`createDraftEnvelope`** (`tc-forms.ts:107-172`) — never called; creates unsendable husks | audit §11, §19 | `createEnvelopeFromTemplate` (the complete one), now wired (§F11). |
| **Modal "Custom fields → Show all fields"** permanent stub | `DealDetailModal.tsx:412-425` | Removed until a real custom-fields model exists. |
| **`/admin/crm/reporting/deals`** redirect stub + circular sub-nav loop | audit §5, §16.7 | Removed from nav. |
| **`sendBrokerSignedNotice` partial branch** — dead code (only ever called with `remaining:0`) | `signing-emails.ts:94-101`, audit §8.2 | Wired live (per-signer + decline notices, §F5/§F7). |
| **`/admin/deals` reading `skyslope_transactions` directly** as the "Transactions home" (violates the Vault-is-SoT memory rule) | audit §6, §20 | Transactions list reads `tc_deals` (§F3); snapshot demoted to ingest staging. |
| **`getServiceSupabase()` re-implemented in 8 TC action files** | audit §16.6 | The canonical `createServiceClient()` (gate `ci:service-client` already exists). |
| **`fub_person_ids` fetched/typed/never rendered** on `TcDeal` | `tc.ts:93,214`, audit §19 | Rendered as the CRM back-link (§F4), and superseded by `crm_deal_id` FK. |

---

## 2. The load-bearing decision — ONE contract-to-close spine

### 2.1 Model

```
LEAD (crm_people)
   │  (existing: person → deal)
   ▼
DEAL (crm_deals)               ← PRE-CONTRACT PIPELINE. Lives under PEOPLE (IA §5).
   │                             Buyers/Sellers Kanban. Estimate-only commission.
   │  promoteDealToTransaction() ← THE MISSING LINK (a real UI action, not a script)
   ▼
TRANSACTION (tc_deals)         ← CONTRACT-TO-CLOSE, SYSTEM OF RECORD. Lives under TRANSACTIONS.
   └─ tc_cycles (sale/listing)   docs · checklist · contacts · commissions · envelopes · sign-off
```

**Which is the spine?** `crm_deals` is the *originating* object (a lead becomes a
deal in the pipeline). A **transaction is what a deal becomes when it goes under
contract.** This matches C2 (the loop tracks a deal to close) and IA §5 (pipeline
under PEOPLE; TRANSACTIONS = contract-to-close). The **link is a single nullable,
unique FK** so the cardinality is enforced by the database, not by convention.

- A CRM deal **may never** become a transaction (dead lead) → FK null.
- A transaction **may exist without** a CRM deal (33 historical SkySlope rows, external
  listings) → reverse side null.
- One CRM deal ↔ **at most one** transaction (one property, one contract) → `UNIQUE`.

### 2.2 Migration `20260717_0001_deal_transaction_link.sql` (additive)

```sql
-- The missing FK. Points a transaction back to its originating CRM deal.
alter table public.tc_deals
  add column if not exists crm_deal_id bigint
    references public.crm_deals(id) on delete set null;
create unique index if not exists tc_deals_crm_deal_id_uidx
  on public.tc_deals(crm_deal_id) where crm_deal_id is not null;

-- Provenance so the sync (§4) knows what it may overwrite, and the UI can badge source.
alter table public.tc_deals
  add column if not exists origin text not null default 'skyslope'
    check (origin in ('skyslope','in_house','import'));

-- Link a transaction contact to a real CRM person (closes the "two worlds" gap, audit §7;
-- feeds the §4.8 buyer-intent spine). Free-text name/email stay as fallback.
alter table public.tc_deal_contacts
  add column if not exists person_id bigint
    references public.crm_people(id) on delete set null;

-- Idempotency for the legal send + promotion (C5). A duplicate submit is a no-op.
alter table public.tc_envelopes
  add column if not exists send_idempotency_key uuid;
create unique index if not exists tc_envelopes_send_idem_uidx
  on public.tc_envelopes(send_idempotency_key) where send_idempotency_key is not null;
```

**Reverse lookup** (transaction for a CRM deal) is a single indexed query on
`tc_deals.crm_deal_id`; no denormalized mirror column on `crm_deals` (avoids two-way
sync drift — one FK, one truth).

### 2.3 Backfill reconcile `20260717_0002_backfill_deal_links.sql` (best-effort, non-destructive)

Match existing 33 `tc_deals` to the 20 `crm_deals` by **normalized address**
(lowercase, trim, strip unit/suite noise) — a **suggestion**, not an auto-merge.
Write matches with confidence ≥ high to `tc_deals.crm_deal_id`; leave ambiguous/none
null. Emit a `tc_events` row (`action='deal.link.backfill'`) per match for audit.
Unmatched historical transactions keep `crm_deal_id` null and `origin='skyslope'` —
they are valid transactions with no CRM origin, and the UI shows "No CRM deal linked"
with a **Link** affordance (a superuser picks the CRM deal manually).

---

## 3. The one commission source of truth (§4.5, kills D7)

### 3.1 Decision

**`tc_commissions` is THE commission ledger.** It already carries the full model
(`gci`, `referral_fee`, `tc_fee`, `other_deductions`, `split_percent`, `agent_net`,
`brokerage_net`, `broker_slug`, `status`, `paid_at`) and the pure tested math. Every
money surface resolves through **one metric-layer DAL**; no surface hand-rolls a sum.

- `crm_deals.commission_dollars` + `crm_deal_splits` → demoted to a **pre-contract
  estimate**, shown on the pipeline card as "Projected", **never summed into a money
  report.** (Columns stay — additive/back-compat — they just stop being a reporting
  source.)
- `skyslope_transactions.headline.officeGross` → **display-only** provenance on an
  ingested transaction; **never a reporting source.**
- The CRM **leaderboard** (`agentActivityClosedDeals.fetchClosedDealsByBroker`,
  `lib/data/crm/agentActivityClosedDeals.ts:54`, today reading `crm_deals.commission_dollars`)
  → **rewritten to read the same metric-layer DAL** keyed by `broker_slug`. It now
  **cannot disagree** with `/admin/commissions` and `/admin/financials` — they read one
  function.

### 3.2 The metric-layer DAL — `lib/data/tc/commissionLedger.ts` (new, cached, tagged)

```ts
// ONE definition of "brokerage commission." Every money surface calls these.
export type CommissionWindow = { fromYear?: number; toYear?: number; status?: CommissionStatus[] }
export const EARNED_STATUSES = ['verified','paid'] as const   // the ONE "earned" definition

// Roll-up for /admin/commissions and the leaderboard. Broker-scoped by caller.
export async function getCommissionLedger(
  scope: { brokerSlug: CrmBrokerSlug | null },   // null = superuser sees all
  window?: CommissionWindow,
): Promise<CommissionLedger>            // joined tc_commissions → tc_cycles → tc_deals

// The single earned-total number. Used by leaderboard, commissions KPI, financials revenue.
export async function getBrokerageEarned(
  scope, window,
): Promise<{ byBrokerSlug: Record<string, number>; total: number }>
```

- Cache: `unstable_cache`, tag `tc-commissions`; the commission mutations
  (`createTcCommission`, `updateTcCommission`) invalidate that one tag (§4.6).
- **Broker scope is clamped inside the DAL** (mirrors `buildCrmPeopleQuery`): a
  restricted broker's `brokerSlug` filters `tc_commissions.broker_slug = slug`; a
  superuser (`null`) sees all. This closes D15 (money reads had no in-body role/scope).

### 3.3 A commission row now exists for every closing (kills "can't grow", audit §12)

- **Promotion (§F2)** seeds a `projected` `tc_commissions` row from the CRM deal's
  estimate via `computeCommissionNets`.
- **Transaction detail (§F4)** has an **Add commission** control (the audit's D-note:
  "New commission rows cannot be created from any UI"). New closings get a row; the
  ledger stays current without a backfill script.
- The SkySlope sync (§4) may seed a `projected` row from `office_gross` for ingested
  cycles that have none, flagged `source.origin='skyslope'`.

---

## 4. A real refresh path for transactions (kills D1; honors "Vault is SoT, never reconcile against SkySlope")

### 4.1 Decision

The in-house **`tc_deals`/`tc_cycles` are the transaction system of record** (Vault =
the in-house TC). SkySlope is **one upstream ingest**, not the displayed truth. The
Transactions list (§F3) reads `tc_*`, never `skyslope_transactions`. `skyslope_transactions`
is demoted to a **raw staging table** the sync reads/writes; no UI reads it directly.

### 4.2 New cron `/api/cron/tc-skyslope-sync` (added to `vercel.json`)

```jsonc
{ "path": "/api/cron/tc-skyslope-sync", "schedule": "17 */3 * * *" }  // every 3h, offset
```

- Guarded by `isAuthorizedCron(request)` (fail-closed, the existing pattern).
- Reuses the pull logic in `scripts/skyslope-dashboard-refresh.mjs` (extract the fetch
  into `lib/tc/skyslope-ingest.ts` so both the cron and the manual script call one lib).
- Steps: pull SkySlope → **upsert `skyslope_transactions`** (staging) → **project into
  `tc_deals`/`tc_cycles`** (upsert by `tc_cycles.source_guid`) → suggest `crm_deal_id`
  by normalized address → stamp `skyslope_dashboard_meta.synced_at` + a per-transaction
  `synced_at`.
- The **manual script still works** as a backfill tool but is no longer the only path.

### 4.3 MLS-sync-overwriting-an-edit — the field-ownership matrix (explicit)

The sync must **never clobber an in-house edit** (the prompt's named edge case). Ownership
is decided by `tc_cycles.source` / `tc_deals.origin`:

| Field class | SkySlope-origin cycle (`source='skyslope'`) | In-house cycle (`source='in_house'`) |
|---|---|---|
| Snapshot facts (sale_price, dates, escrow #, parties from MLS) | **Sync updates** (SkySlope is authoritative upstream) | **Never touched** by sync |
| Checklist item *statuses* (`in_review`/`completed`/`na`) | **Never overwritten** (broker/principal set these) | Never touched |
| Documents uploaded in-house / envelopes / sealed docs | **Never touched** | Never touched |
| Commissions (`tc_commissions`) | Sync may **insert** a `projected` row if none; **never edits** an existing row | Never touched |
| `crm_deal_id` link | Set once if null; **never overwritten** if already linked | Set by promotion |

A broker's checklist status, commission edit, uploaded document, or CRM link **survives
every subsequent sync.** Enforced by the sync only writing snapshot-derived columns on
`source='skyslope'` cycles and using `upsert ... on conflict do update set <snapshot cols only>`.

### 4.4 Staleness is visible, never silent

The Transactions list + detail show a **freshness stamp** and, when
`now - synced_at > 24h` for SkySlope-origin data, a **warning banner** ("SkySlope data
last synced N hours ago"). Today the page shows "Synced 2026-06-10" in small print with
no warning (audit §6). A `sync_alerts` row (existing table) fires if the cron fails or
data exceeds a staleness SLA, routed to Matt (same pattern as `crm-health-check`).

---

## 5. E-sign decision — WIRE it, behind a proven round trip (kills D2)

**Scope gave a binary: wire it into a real flow with acceptance tests, OR quarantine.**

**Decision: WIRE.** Rationale: the e-sign stack is genuinely well-engineered end-to-end
(audit §8), it is the in-house replacement Matt has been actively building
(`/tc-builder` skill; memory `project_tc_esign_shipped` — "full envelope→sign→seal→notify
engine live"), and quarantining a complete legal-signing engine to buy a third-party
seat is a bigger decision than this rebuild should make unilaterally. **But** §8 and RC6
forbid presenting a 0-use legal system as "live" until the round trip is *proven*. So the
launch is **gated**:

1. **Fix the four ship-blockers** (§5.1) — silent email (D5), concurrent-seal race (D10),
   out-of-order signing (D9), mobile-hostile signer canvas (D12) — plus the unauth reads (D3).
2. **Wire the template path** (§F11) — the 111 mapped forms become usable.
3. **Prove one real envelope end-to-end** with the acceptance test in §11 (compose →
   send → sign on a 375px phone → seal → certificate → principal-review record). Until
   that test is green **and** one real envelope has completed in production, the "Send
   for signature" entry is behind capability `esign:send` **disabled by default for
   brokers**, superuser-only, and the Signing nav item carries a "Beta" affordance.
3. After the proven round trip, `esign:send` opens to brokers.

**Fallback if Matt says "don't own a legal e-sign system in-house":** quarantine =
hide the Signing nav + `esign:send` capability off for everyone, keep the code + tables
(no deletion — the sealer/certificate logic is reusable), and route signing to a
third-party. This is **Open Question Q1**.

### 5.1 Ship-blocker fixes (all four are legal/compliance-grade)

**D5 — silent email failure → fail-loud, gate the status transition.**
`sendEnvelope` today marks the envelope `sent` **before** the invites go out and ignores
every Resend return (`tc-envelopes.ts:592,606-615`; `lib/resend.ts:48-60`). Rebuild:
- Send the first-order invite(s) **first**; capture the Resend result.
- **Only mark `sent` if the first-order invite delivered** (conditional update, §5 idem).
  If Resend errors, return `{ ok:false, error }` to the broker, write a
  `tc_events` `action='email.failed'`, leave status `draft`. No signer is left waiting
  with the broker believing it sent.
- Add `tc_envelope_recipients.invite_delivery_state text` + `invite_sent_at timestamptz`
  (additive) and a **Resend delivery webhook** `/api/webhooks/resend-esign` (signature-
  validated, forward-only reconcile — the same posture as the SMS delivery reconcile the
  audit lists as solid) that updates `invite_delivery_state` on delivered/bounced/complained.
  Completion-copy failures log a `tc_events` `email.failed` and surface a **"delivery
  issues"** badge on the envelope, never silent.

**D10 — concurrent double-seal race → atomic optimistic lock.**
Replace the read-then-act guard (`seal-envelope.ts:78-79`) with a conditional update:
```sql
update tc_envelopes set status='sealing'
 where id = $1 and status = 'sent'
 returning *;   -- only ONE concurrent last-signer wins the row; the loser gets 0 rows → returns
```
Only the winner runs the seal → one executed `tc_documents` row, one completion fan-out.

**D9 — out-of-order signing → order re-check on submit and on resend.**
- `submitSigning` (`tc-sign.ts:193-256`) must, before persisting, re-verify the
  recipient's `signing_order` is the **current active order** (no earlier-order recipient
  with `completed_at IS NULL AND declined_at IS NULL`). If not, return "waiting for an
  earlier signer" and refuse — closes the accept-out-of-order hole.
- `resendRecipientInvite` (`tc-envelopes.ts:634-678`) must **refuse to mint a token** for
  a recipient whose order is not the current active order.

**D12 — public signing canvas overflows phones → scale-to-container.**
The PDF page renders at a fixed 612–760px width with `style={{ width: p.width }}`
(`pdf-pages.tsx:65-67,122-133`), wider than a 375px viewport, no scale. Rebuild the
signer page as **one responsive tree** (§F6): the page canvas and every field overlay
scale by `scale = containerWidth / pageWidth`; fields (stored in PDF coordinate space:
`x,y,w,h`) render at `left = x*scale, top = y*scale, width = w*scale, height = h*scale`.
No horizontal pan on a phone. This is the single consumer-facing surface — it is the
priority, not an afterthought.

**D3 — unauth service-role reads → in-body guard.**
`getTcDeal`, `getTcDocumentUrl`, `getEnvelopesForCycle`, `getEnvelopeDetail`,
`getEnvelopesOverview` gain `requireCapability('transactions:read')` in-body (§6). The
public `getSigningSession` stays **token-gated** (correct — the credential is the token,
not a session).

---

## 6. Cross-cutting: auth, optimistic/idempotent, responsive, performance

### 6.1 Authorization (§4.4 — one primitive, one capability map, kills RC5/D3/D4/D15)

Introduce **`lib/auth/capabilities.ts`** (the capability map) and a server-action guard
**`requireCapability(cap)`** layered on the existing `getAdminContext()`:

```ts
// lib/auth/capabilities.ts — the ONE source of what each role may do (nav reads it too).
export type Capability =
  | 'deals:read' | 'deals:write'
  | 'transactions:read' | 'transactions:write'
  | 'esign:send'
  | 'signoff:review'                 // superuser
  | 'commissions:read'               // scoped: broker sees own, superuser sees all
  | 'commissions:write'
  | 'financials:read'                // superuser (brokerage-wide P&L)
  | 'forms:read'
export const CAPABILITY_MAP: Record<AdminRoleType, Capability[]> = { /* superuser: all; broker: operating set; report_viewer: read-only subset */ }
```

```ts
// server-action guard, returns a discriminated result (never throws into the client)
export async function requireCapability(cap: Capability):
  Promise<{ ok: true; ctx: AdminContext; scope: { brokerSlug: CrmBrokerSlug | null } }
         | { ok: false; error: string }>
```

- **Every** server action and route handler in this domain calls it **in-body** (defense
  in depth — the `(protected)` layout gates page render only; actions are independently
  invocable POSTs). Reads too, not just writes (that is the D3 fix).
- **The nav is generated from `CAPABILITY_MAP`** (§4.4) — an item a role lacks is not
  rendered *and* the action refuses. Dead-ends become structurally impossible (kills the
  RC5 "nav shows it, page denies it" class).
- **Scope**: `requireCapability` returns the caller's `scope.brokerSlug` (via
  `scopeBroker`), which every scoped DAL/mutation clamps on. Brokers see their own
  transactions/commissions; superuser sees all. `signoff:review` + `financials:read` +
  brokerage-wide commissions are superuser-only.
- **New mechanical gate `ci:admin-authz`** (§4.4): fail the build if a server action
  under `app/actions/{tc*,crm-deals,crm-deal-pipelines,deals}.ts` mutates or does a
  service-role read without calling `requireCapability`. Complements the existing
  `ci:admin-endpoint-auth` / `ci:admin-role-guard` gates. Enforcement over prose
  (CLAUDE.md "gates not prose").

**D8 — `updateCrmDeal` mass-assignment fix:** replace `.update(patch)` (arbitrary keys,
`crm-deals.ts:74-93`) with an **explicit runtime key whitelist**; `assigned_broker` is
writable **only when `ctx.role==='superuser'`** (a restricted broker cannot reassign a
deal even via a forged request).

### 6.2 Optimistic + idempotent mutations (§4.2 — kills RC2, the reload tax)

Every mutation in this domain adopts the one primitive:
- **Client:** generate `idempotency_key` (uuid) on submit, render the result optimistically
  (the restaged card, the new commission row, the "sending" envelope), disable+reset the
  control via `useOptimistic`/`useTransition`. On resolve, patch the returned entity in;
  on error, mark the optimistic row failed with **Retry**.
- **Server:** the action **returns the changed entity** and **does not** `revalidatePath`/
  `window.location.reload()` the whole page. Idempotent sends (`sendEnvelope`,
  `promoteDealToTransaction`) persist/act on the key — a duplicate key is a no-op that
  returns the original result.
- **Generalize the Kanban's proven pattern** (`DealsBoard.tsx:374-390`) into the shared
  primitive; every reload/`router.refresh()` call site (audit lists 5 TC + the modal)
  migrates to it.
- Enforced by the existing `ci:composer-discipline` posture, extended to TC mutations.

### 6.3 Responsive — one tree (§4.3, kills RC3, the 6 forks)

Delete the 6 hand-rolled `md:hidden` table→card forks (audit §18). Each surface is **one
component** authored mobile-first that adapts by container query / CSS. A table becomes a
responsive list that reflows to columns at width; the desktop multi-column pipeline board
is **progressive enhancement of the same tree**, not a second tree. **Stage change works
on the phone** (D6 fix — §F2). All shadcn/ui from `@/components/ui/` per the design system.
Enforced by `ci:admin-responsive` + `ci:crm-screen-parity` (existing gates).

### 6.4 Performance (§4.6)

- **Kill the `getTcDeal` waterfall** (audit §17.1): the 5-stage sequential await →
  parallelize what's independent; **filter `tc_checklist_assignments` by `cycle_id`** (D13
  — today it scans the whole 2,358-row-adjacent table, `tc.ts:121-123`); generate thumb
  signed-URLs **lazily on hover**, not 2×N for every doc on load.
- **Cache reference/aggregate reads** (`getDealPipelines` already 300s; add cache+tags to
  the commission ledger, transactions list counts, sign-off queue counts).
- **Stream the shell, suspend the data** — each hot page renders chrome instantly, wraps
  each data region in `<Suspense>`; the slowest query (signed-URL minting, SkySlope-derived
  rollups) stops blocking first paint.
- **Code-split** the heavy islands behind `next/dynamic`: the pdf.js signer canvas
  (`components/tc/pdf-sign/*`), recharts on financials, dnd-kit on the Kanban.
- No mutation re-runs a page fan-out (§6.2).

---

## Feature specs

Each feature: Purpose → Keep/Rebuild/Delete → Data model → Flows (tap counts) → States →
Edge cases → Errors/compliance → Responsive → Performance → Acceptance criteria.

---

### F1 — Pipeline board (`crm_deals` Kanban) · lives under PEOPLE

**Purpose (C2):** the pre-contract pipeline. A lead becomes a deal; the broker moves it
through Buyers/Sellers stages until it goes under contract, at which point it is **promoted
to a transaction** (§F2). This is the best surface in the domain (audit §1) — hardened, not
rebuilt.

**Keep:** the board, `getDealPipelines` (cached 300s, static fallback), `listDealsBoard`
(broker scope in the DAL, `listDealsBoard.ts:95`), the optimistic restage UX, `createCrmDeal`
(validates stage against live config, self-assigns, scope-checks the contact). **Rebuild:**
mobile becomes interactive (D6); `updateCrmDeal` whitelist (D8); rename cascade made
transactional (D16). **Delete:** nothing here (the `[id]` page is F2's deletion).

**Data model:** `crm_deals`, `crm_pipelines`, `crm_deal_stages`, `crm_deal_people`,
`crm_deal_splits`, `crm_deal_files`. New: reads `tc_deals.crm_deal_id` to show a
"Transaction linked" badge on promoted cards.

**Flows:**
- Restage: 1 drag (desktop) / **stage picker in the card + detail (mobile, D6 fix)**.
- Add deal: 1 tap `+` → 2 required fields → Create.
- Open deal: 1 tap → detail (§F2).
- **Promote to transaction:** 1 tap on a deal at/after the "Under contract" stage (§F2).

**States:** empty (per-column empty hint) · loading (streamed board shell, suspended
columns) · populated · **pending/optimistic** (card shows a "moving…" ghost during restage,
reverts on failure with inline banner — existing) · error (inline banner) · offline
(optimistic hold, Retry) · permission-denied (a restricted broker sees only own-assigned
deals; no cross-broker card renders) · over-limit (n/a at 20 rows; the board paginates
columns at >200).

**Edge cases:**
- **Pipeline-less deal accepts any stage string** (D17, `crm-deals.ts:138`): validate stage
  even when `pipeline` is null (against the union of all live stages); reject an unknown stage.
- **Rename cascade crash orphans deals into "Unsorted"** (D16, non-transactional two-step,
  `crm-deal-pipelines.ts:121-132`): wrap rename + cascade in one RPC/transaction; on failure
  neither lands. Unknown-stage deals still render in an explicit "Unsorted" column with a
  one-tap reassign.
- **Concurrent broker edits** (two brokers drag the same card): last-write-wins on
  `stage`, but each write stamps `entered_stage_at`; the optimistic revert shows the other
  broker's result. No lost update to other columns (patch is stage-only).
- **`entered_stage_at` overwritten per restage, no history** (D21): out of scope to fully
  fix here, but the promotion (§F2) snapshots the acceptance date into `tc_cycles`, so
  contract-clock history is preserved where it is legally load-bearing. (Full stage-history
  table is Open Question Q5.)
- **Split % > 100 / no dollars** (audit §2): validate splits sum ≤ 100 on add; compute
  `split_dollars` from `value` when both known; block save otherwise.

**Errors/compliance:** `requireCapability('deals:write')` in-body on every mutation; scope
via `requirePersonInScope` on the attached contact. Currency rounded to nearest $1,000
(`$895,000`), tabular numerals (design system).

**Responsive:** one tree; columns reflow to a horizontally-scrollable rail on phone with a
**stage picker** so restage works on mobile (D6). No read-only fork.

**Performance:** cached pipelines; `listDealsBoard` scoped; board totals summed client-side
(fine at scale); opening a deal does **not** refetch the whole board (§F2 fix).

**Acceptance:** writer (`restageCrmDeal` on phone) → store (`crm_deals.stage` updated,
`tc_events`/timeline note) → reader (board + detail reflect new stage on phone without full
reload) → outcome (a broker restages a deal from a driveway in 1 tap; a pipeline-less deal
rejects an invalid stage; a rename that crashes mid-cascade leaves no orphans).

---

### F2 — Deal detail + **Promote to transaction** (the missing link)

**Purpose:** the one CRM-deal workspace (edit fields, people, splits, files) **and the seam
that turns a deal into a transaction.**

**Keep:** the modal path (`DealDetailModal.tsx`) with its server-side `getCrmDeal` +
`dealInScope` gate (`crm/deals/page.tsx:93-95`) — the **correct** scope posture.
**Rebuild:** add a **stage control** (D-note §2 — modal shows stage as a breadcrumb only);
real **file upload** (reuse the TC upload pipeline, not URL-paste); optimistic mutations (no
`router.refresh()`); the `promoteDealToTransaction` action. **Delete:** the orphaned
`/admin/crm/deals/[id]/**` page (D4 read leak, zero inbound links — audit §3/§19) and the
"Custom fields" stub.

**Data model:** reads `getCrmDeal` (cached 30s, tag `crm-deal-detail`) + `tc_deals.crm_deal_id`
to show transaction state. Writes `crm_deals` (whitelisted), `crm_deal_people`,
`crm_deal_splits`, `crm_deal_files`. Promotion writes `tc_deals` + `tc_cycles` +
`tc_commissions` + `tc_deal_contacts` + `tc_events`.

**`promoteDealToTransaction(crmDealId, overrides?)` — the action:**
1. `requireCapability('transactions:write')` + deal in scope.
2. **Idempotent:** if a `tc_deals` row with `crm_deal_id = crmDealId` exists, **return it**
   (no-op) — a double-tap or retry never creates two transactions.
3. Insert `tc_deals`: `origin='in_house'`, `crm_deal_id=crmDealId`,
   `property_key` = `crm_deals.listing_key` if present else a generated stable key,
   `address` = `property_address`, `broker_name` = `brokers.display_name` resolved from
   `assigned_broker` slug, `fub_person_ids` from `crm_deal_people.person_id[]`, `stage='active'`.
4. Insert one `tc_cycles`: `kind` from pipeline (Sellers→`listing`, Buyers→`sale`),
   `source='in_house'`, `source_guid=uuid`, `sale_price=crm_deals.value`,
   `contract_acceptance_date=crm_deals.mutual_acceptance`,
   `escrow_closing_date=crm_deals.close_date`, `sellers/buyers` names from `crm_deal_people`.
5. Copy `crm_deal_people` → `tc_deal_contacts` **with `person_id` set** (closes the "two
   worlds" gap; feeds §4.8).
6. Seed a `projected` `tc_commissions` row via `computeCommissionNets` from the estimate
   (`commission_dollars`/`commission_percent` + `crm_deal_splits`), `broker_slug=assigned_broker`.
7. `tc_events` `action='deal.promoted'`, actor = broker.
8. Return `{ tcDealPropertyKey }`; client navigates to the transaction detail (§F4).

**Flows:** promote = **1 tap** ("Promote to transaction") → confirm sheet (pre-filled from
the deal, editable) → Create → lands on transaction detail. Round trip is optimistic (a
"Creating transaction…" state, then navigation).

**States:** all standard. **Pending/optimistic:** the Promote button shows a spinner and
disables; on success it becomes "View transaction →". **Already-promoted:** button reads
"View transaction →" (idempotent guard makes re-promote impossible).

**Edge cases:**
- **Deal has no address / no value:** promotion allowed (a transaction can start thin); the
  confirm sheet requires at least an address (a transaction with no property is refused).
- **Deal not yet under contract:** Promote is available but warns "This deal isn't at an
  under-contract stage yet" — Matt may still promote (Open Question Q2: hard-gate promotion
  to a specific stage, or allow-with-warning? default: allow-with-warning).
- **`assigned_broker` slug not in `brokers`:** fall back to Matt (per the default-routing
  directive) and flag the transaction "broker unresolved" for a superuser to fix.
- **Concurrent promote (two brokers):** the `UNIQUE(tc_deals.crm_deal_id)` index makes the
  second insert fail → the action catches the unique violation and returns the existing row
  (idempotent by construction, not just by the read guard).
- **Duplicate submit / expired session mid-promote:** idempotency key + unique index → at
  most one transaction; an expired session returns permission-denied, the optimistic row
  reverts with Retry (re-auth then retry is safe — idempotent).
- **`listing_key` collides with an existing `tc_deals.property_key`:** if a transaction
  already exists for that property (e.g. an ingested SkySlope row), **link** to it (set its
  `crm_deal_id`) instead of creating a duplicate — surfaced as "Linked to existing
  transaction" rather than "Created".

**Errors/compliance:** in-body capability + scope; whitelist on `updateCrmDeal` (D8);
promotion writes are all-or-nothing (single transaction/RPC).

**Responsive:** one tree; the confirm sheet is a bottom sheet on phone, a dialog on desktop.
Stage control present on both.

**Performance:** opening the detail no longer refetches the whole board (D-note §2 — today
`?deal=` re-runs `listDealsBoard`); the modal reads `getCrmDeal` only, and mutations patch
client state (§6.2).

**Acceptance:** writer (`promoteDealToTransaction` on a CRM deal) → store (`tc_deals` row
with `crm_deal_id` set, one `tc_cycles`, one `projected tc_commissions`, `tc_deal_contacts`
with `person_id`, `tc_events`) → reader (transaction detail §F4 renders it; the CRM deal card
shows "Transaction linked"; the commission ledger §F9 includes the projected row) → outcome
(a broker turns an under-contract deal into a tracked transaction in 1 tap + confirm; a
second tap never creates a second transaction; the transaction knows its CRM person).

---

### F3 — Transactions list (`tc_deals` as SoT) · the TRANSACTIONS home

**Purpose:** the one contract-to-close home — every active + closed transaction, its stage,
checklist %, freshness, and source. Replaces `/admin/deals` reading the stale snapshot
(audit §6).

**Keep:** the live-pipeline / closed-compliance / dead-files information design (it is good
UI). **Rebuild:** data source flips from `skyslope_transactions` to `tc_deals` (+ derived
state); freshness/staleness banner (§4.4); the empty state stops telling the user to run a
node script (audit §6). **Delete:** direct reads of `skyslope_transactions`; the footer's
mislink to the content audit log (§F12).

**Data model — new DAL `lib/data/tc/listTransactions.ts`:** `tc_deals` LEFT JOIN
`tc_cycles` (latest) + derived checklist % from `tc_checklist_items` + commission status
from `tc_commissions` + `crm_deals` (via `crm_deal_id`) for the CRM link. Broker-scoped
(a broker sees transactions where `broker_name`/`crm_deal.assigned_broker` maps to their
slug; superuser sees all). Cached, tag `tc-transactions`.

**Checklist truth (kills audit §6 "two checklists"):** the list's "Checklist 12/19" now
reads the **same `tc_checklist_items`** the detail mutates — one source, so approving an
item on the detail updates the list (today they come from two systems — snapshot regex vs
live items).

**Flows:** open transaction = 1 tap → detail (§F4). Filter by stage/broker/source = 1 tap.
Link an unlinked (SkySlope-origin) transaction to a CRM deal = 1 tap (superuser).

**States:** empty (a real empty state: "No transactions yet. Promote a deal from the
pipeline, or wait for the next SkySlope sync." — with a link to the pipeline, **not** a
node command) · loading (streamed shell, suspended rows) · populated · **stale** (banner when
SkySlope-origin `synced_at > 24h`) · error · permission-denied (broker sees only own).

**Edge cases:**
- **SkySlope-origin transaction with no `tc_deals` row** (the old `/admin/deals/[key]` 404,
  audit §0): impossible now — the sync projects every snapshot row into `tc_deals`. A
  property_key with no `tc_deals` shows "Not yet synced" rather than 404.
- **A transaction with no CRM deal** (33 historical): renders with "No CRM deal linked" + a
  Link control (superuser).
- **Sync failure / stale data:** banner + `sync_alerts` row; numbers still render with the
  "as of <synced_at>" stamp — never blank, never presented as live.
- **Broker sees a transaction whose commission they shouldn't:** money columns
  (office gross, commission) are hidden for a restricted broker on transactions not their
  own (scope clamp); a superuser sees all.

**Errors/compliance:** `requireCapability('transactions:read')` in-body (the DAL, not just
the layout). Every displayed number carries a source stamp (C4).

**Responsive:** one tree — a table that reflows to cards on phone (delete the bespoke
`md:hidden` fork, audit §18); the mobile TRANSACTIONS surface gets the same nav shell as the
CRM board (today only `/admin/crm/deals` does — audit §18).

**Performance:** `select` only the columns the list needs (not `select('*')` incl. the full
`cycles` jsonb, audit §17.4); derived counts cached; streamed.

**Acceptance:** writer (promotion §F2 or the sync §4) → store (`tc_deals`/`tc_cycles`) →
reader (this list shows the transaction with correct stage + checklist % from live
`tc_checklist_items` + freshness) → outcome (the list is never >3h stale for SkySlope data
without a visible warning; approving a checklist item on the detail changes the list's %;
no property 404s).

---

### F4 — Transaction detail (`/admin/transactions/[key]`)

**Purpose:** the real TC working surface — per-cycle documents, Oregon anticipated-docs,
commissions, checklist with review statuses, deal contacts, envelopes, event feed, **and a
back-link to the CRM person/deal.**

**Keep:** the upload pipeline (`finalizeTcUpload`), commission edit (`updateTcCommission` +
`computeCommissionNets`), checklist status machine, contacts, envelope-from-documents.
**Rebuild:** kill the `window.location.reload()` on all 5 mutations (§6.2); fix the
`getTcDeal` waterfall + unfiltered assignments scan (D13) + lazy thumbs (§6.4); add the CRM
back-link (renders `crm_deal_id` → person/deal); make the anticipated-docs "Confirm to
refine" a real control (D18); add **Add commission** (§3.3); in-body auth (D3). **Delete:**
the dead-end confirm prompt; `getServiceSupabase` (use canonical client).

**Data model:** `getTcDeal` (rebuilt: parallel, scoped, lazy thumbs) reads
`tc_deals`+`tc_cycles`+`tc_documents`+`tc_checklist_items`+`tc_checklist_assignments`
(**filtered by `cycle_id`**, D13)+`tc_events`(last 15 → "View all" to F12)+`tc_commissions`
+`tc_deal_contacts`+`tc_envelopes`+`crm_deals`/`crm_people` via `crm_deal_id`.

**Flows:** upload doc = tap → pick → PUT (progress) → row appears optimistically. Checklist
status = 1 tap (optimistic, no reload). Commission edit = open → edit → Save (nets recompute
server-side, row patches in). New envelope = 1 tap → composer (§F5). Back to CRM person = 1 tap.

**States:** all standard; **pending/optimistic** on every mutation (the reloading model is
gone); **partial** (a doc uploaded but thumb not yet generated → "preview pending"); offline
(upload queues, Retry).

**Edge cases:**
- **MLS sync overwriting an edit** (named edge case): a broker's checklist status / uploaded
  doc / commission edit is on an `in_house` field and **survives every sync** (§4.3 matrix).
  A SkySlope-origin snapshot fact (sale price) updated upstream **does** refresh, with the
  event logged.
- **Doc-heavy deal (hundreds of docs):** thumbs are lazy-on-hover, not 2×N on load (§6.4);
  the page streams; the assignments query is `cycle_id`-scoped (D13).
- **Anticipated-docs "Confirm to refine" dead-end** (D18): replace the text-only prompt with
  a checkbox per fact that writes the confirmation (well/septic/HOA) so the doc matrix
  actually refines; MLS-auto-populated facts show their source.
- **Concurrent broker edits to the same commission:** `updateTcCommission` writes a
  before/after diff into `tc_events`; last-write-wins on the row, both diffs preserved in the
  audit spine.
- **Timeout on a 30–60s doc build / signed-URL mint:** the page streams the chrome + doc
  list first; signed URLs resolve in a suspended region; a mint failure shows "preview
  unavailable", never blocks the page.
- **Expired session mid-upload:** the signed PUT URL is short-lived; `finalizeTcUpload`
  re-checks capability and rejects a stale finalize (storage cleanup runs, audit §7).

**Errors/compliance:** `requireCapability('transactions:read')` on reads (D3),
`'transactions:write'` on mutations; scope clamp; `getTcDocumentUrl` gains the guard (a doc
URL is no longer mintable by "knows a UUID", audit §7). Commission math is the pure tested
function — no penny leak.

**Responsive:** one tree; doc table → cards on phone with a **touch doc-preview** (tap to
expand, replacing the hover-only `HoverCard` that has no touch path, audit §7); checklist +
commission dialogs already responsive.

**Performance:** the domain's slowest page today (5-stage waterfall + 2×N signed URLs, audit
§17.1) → parallelized, scoped, lazy, streamed; no mutation reloads it.

**Acceptance:** writer (checklist tap / commission edit / upload on phone) → store
(`tc_checklist_items` / `tc_commissions` / `tc_documents` + `tc_events`) → reader (the row
updates in place, the F3 list % updates, the ledger §F9 updates) → outcome (no full-page
reload on any mutation; a synced SkySlope fact never clobbers a broker's checklist status;
a doc URL requires a session).

---

### F5 — E-sign compose + send

**Purpose:** turn transaction documents (or a library template) into a routed, ordered
signing envelope — the in-house DocuSign.

**Keep:** the composer (`EnvelopeComposer.tsx` — signer editing, click-to-place 5 field
types, draft-only server enforcement, stable recipient ids for placed fields), `sendEnvelope`
validation (≥1 doc, ≥1 signer, all emails valid, every signer ≥1 field, ≥1 signature field),
ordered-routing token minting. **Rebuild:** the four ship-blockers (§5.1) — fail-loud email,
atomic seal lock, order re-check, mobile canvas; idempotent send; in-body auth. **Delete:**
`createDraftEnvelope` (husk); the dead partial-notice branch becomes live.

**Data model:** `tc_envelopes` (+ `send_idempotency_key`, new), `tc_envelope_recipients`
(+ `invite_delivery_state`, `invite_sent_at`, new), `tc_envelope_documents`,
`tc_envelope_fields`, `tc_events`.

**`sendEnvelope` rebuilt:**
1. `requireCapability('esign:send')` + envelope's cycle in scope.
2. Validate (existing rules).
3. **Idempotent:** if `send_idempotency_key` already recorded → return original result.
4. Mint first-order token(s); **send the first-order invite(s) first**; capture Resend result.
5. **Only on delivery success:** conditional update `status='sent' where status='draft'
   returning *` (also the double-send guard); set `sent_at`, `send_idempotency_key`,
   per-recipient `invite_delivery_state='sent'/'delivered'`. **On failure:** leave `draft`,
   `tc_events` `email.failed`, return `{ok:false,error}` to the broker.
6. `tc_events` `envelope.sent`.

**Flows:** from a transaction (§F4) "New envelope" → pick docs → composer → place fields →
Send = the flow. From the forms library (§F11) "Use on a deal" → template envelope → composer.
Target: **≤6 steps** today (audit §9) trimmed by pre-seeding recipients + field maps.

**States:** draft (editable) · sending (optimistic, disabled) · sent · partial (some
completion emails failed → "delivery issues" badge) · completed/sealed · voided/declined ·
error (email-send failure surfaced, envelope stays draft) · permission-denied.

**Edge cases:**
- **Duplicate Send tap on a legal envelope** (C5): idempotency key + conditional status
  update → exactly one send, one set of invites.
- **Resend down at send time:** envelope stays `draft`, broker sees the error, no signer is
  left waiting believing it sent (D5 fix).
- **Bounce/complaint after send:** Resend webhook updates `invite_delivery_state`; a bounced
  invite surfaces a "signer didn't receive" badge with a Resend-invite action.
- **Recipient deleted in composer after viewing** (audit §8.6): draft-only editing plus a
  guard — refuse to delete a recipient with completed fields.
- **Out-of-order resend** (D9): `resendRecipientInvite` refuses a recipient not at the
  current active order.
- **Envelope with no signature field / no docs:** validation refuses (existing).

**Errors/compliance:** in-body `esign:send`; the send is a legal act — fail-loud on delivery
(D5). Voice on the invite email obeys brand voice (no em-dash/banned words) — the invite copy
is data-driven, signed by the broker handling the transaction.

**Responsive:** the composer is desktop-primary (field placement is a mouse task) but must
not break on tablet; the **signer** side (§F6) is the mobile-critical surface.

**Performance:** PDF pages code-split + virtualized (don't render every page of a multi-doc
envelope up front, audit §17.6).

**Acceptance:** writer (`sendEnvelope`) → store (`tc_envelopes.status='sent'` **only after**
first-order invite delivered, `send_idempotency_key` set, recipient `invite_delivery_state`)
→ reader (envelope dashboard §F9-sibling shows "Out for signature"; the signer receives the
email; a double-tap sent one message) → outcome (a failed email never yields a false "Sent";
a duplicate send is a no-op).

---

### F6 — Public signing page (`/sign/[token]`) — mobile-first (the one consumer surface)

**Purpose:** the tokenized, per-recipient signing experience. The **only** surface a
consumer touches — so it is the priority, phone-first (C3).

**Keep:** `getSigningSession` token-hash lookup, ordered-routing "waiting" gate, first-view
IP/UA stamp, ESIGN/UETA consent gate, per-recipient field scoping, 1-hour signed doc URLs,
`submitSigning` server-side completeness validation. **Rebuild:** scale-to-container canvas
(D12); order re-check on submit (D9); decline notifies the broker (D11). **Delete:** the
fixed-width overflow.

**Data model:** `tc_envelope_recipients` (token hash, order, consent, viewed, completed,
declined), `tc_envelope_fields` (per-recipient), `tc_envelope_documents`.

**Flows (phone):** tap email link → consent (1 tap) → tap each field to fill/sign → Finish
(1 tap). No horizontal panning.

**States:** waiting (an earlier signer hasn't finished) · consent-required · signing ·
submitting (optimistic) · completed · declined · token-expired/invalid · already-completed.

**Edge cases:**
- **375px phone** (D12 fix): page + fields scale by `containerWidth/pageWidth`; every field
  overlay positioned proportionally; no overflow.
- **Out-of-order live token** (D9): a signer 2 who got a resend while signer 1 is pending
  sees "waiting"; if they somehow hold a token, `submitSigning` re-checks order and refuses.
- **Token reuse after completion:** token killed on completion; a reused link shows
  "already signed."
- **Expired 1-hour doc URL mid-session:** the page re-mints on demand (still token-gated).
- **Decline:** voids the envelope, kills all tokens, **notifies the broker** (D11 — today
  only a `tc_events` row, no notification); the broker learns of a deal-killing decline
  immediately, not by re-opening the page.
- **Concurrent last-signers → double seal** (D10): the atomic lock (§5.1) means one seal.
- **Consent not given:** signing is blocked until ESIGN/UETA consent recorded.

**Errors/compliance:** token-gated (correct — no session guard here). ESIGN/UETA consent is
recorded before any field is signable (legally required). Signed values scoped to the
recipient (`.eq('recipient_id', …)`).

**Responsive:** this IS the mobile spec — one tree, scale-to-container, tap targets ≥44px.
Must not overflow a phone (the audit's headline consumer defect).

**Performance:** render only the current page's canvas; lazy the rest.

**Acceptance:** writer (a signer taps Finish on a 375px phone) → store
(`tc_envelope_fields.value/signed_at/signed_ip`, recipient `completed_at`, token killed,
`tc_events`) → reader (the next signer's token mints, or the seal runs; the broker sees
"signed") → outcome (a real envelope is signed end-to-end on a phone with no horizontal
scroll; an out-of-order signature is refused; a decline notifies the broker).

---

### F7 — Seal + certificate

**Purpose:** produce the executed, flattened PDF with an appended audit certificate — the
legal artifact.

**Keep:** `sealAndCompleteEnvelope` (download sources, pdf-lib flatten, appended certificate,
executed `tc_documents` row, `sealed_sha256`, completion-copy fan-out, broker notice).
**Rebuild:** the atomic concurrency lock (D10); surface completion-email failures (D5);
per-signer/decline notices become live (D11). **Delete:** nothing.

**Data model:** `tc_envelopes` (`sealed_sha256`, `executed_document_id`,
`certificate_storage_path`, `completed_at`), a new executed `tc_documents` row, `tc_events`.

**Edge cases:**
- **Concurrent seal** (D10): conditional `status='sealing' where status='sent'` → one winner,
  one executed doc, one fan-out.
- **Completion email fails:** logged `tc_events` `email.failed` + "delivery issues" badge;
  the seal itself still completes (the legal doc exists regardless of email).
- **Certificate generation error:** the envelope stays `sent` (not falsely `completed`); a
  `tc_events` `seal.failed` fires; the broker is alerted.
- **Storage upsert collision:** the executed doc path is deterministic; the atomic lock
  prevents two writers.

**Compliance:** the sealed SHA-256 + certificate are the tamper-evidence; `tc_principal_reviews`
(§F8) is a separate legal record. Notices obey brand voice.

**Acceptance:** writer (last signer completes) → store (one executed `tc_documents`, one
`sealed_sha256`, `certificate_storage_path`, `completed_at`) → reader (the transaction §F4
shows the executed doc; every party receives a copy or a logged failure) → outcome
(simultaneous last-signers produce exactly one sealed doc; an email failure is visible).

---

### F8 — Sign-off queue (principal-broker review, OAR 863-015-0140)

**Purpose:** the principal broker's statutory review — items reach `in_review`, the reviewer
approves, an **immutable `tc_principal_reviews` row is the legal record** (name + date +
decision + rule basis). Superuser-only.

**Keep:** the queue (`tc_checklist_items.status='in_review'` on live deals), banking-day math
(pure/tested/holiday-aware), the immutable review-row write, send-back. **Rebuild:** the
deadline **anchor** (D14 — per-document event, not cycle-wide); `window.prompt/alert/reload`
→ optimistic mutations; "See all" links to a real full queue, not the stale dashboard;
in-body `signoff:review`. **Delete:** the mislink to `/admin/deals`.

**Data model:** `tc_checklist_items`, `tc_principal_reviews`, `tc_cycles`
(`contract_acceptance_date`), plus a per-document acceptance/event date for the anchor (D14).

**Edge cases:**
- **0 reviews ever** (D2): the queue is dry because intake was dry (script-fed, stale). With
  §4 (cron + UI create) and §F4 (checklist status works without reload), items now reach
  `in_review` and the queue fills. **This is the round trip §8 requires** — proven by the
  acceptance test.
- **Deadline anchor** (D14): OAR clock starts per document event, not the cycle's single
  `contract_acceptance_date` for all items. **Legal — Open Question Q3** (confirm the anchor
  with Matt / counsel before shipping the deadline display).
- **Send-back:** item → `required`, event logged, broker re-submits.
- **Approve during a concurrent edit:** the review row is immutable and append-only; a later
  status change writes a new event, never mutates the review record.

**Compliance:** the `tc_principal_reviews` row is the statutory artifact (`rule_basis`
default `'OAR 863-015-0140'`). Superuser-only (`signoff:review`); a non-superuser gets a
polite denial (existing).

**Responsive:** one tree; no `md:` fork; actions are optimistic sheets, not `window.prompt`.

**Acceptance:** writer (superuser approves an in-review item) → store (`tc_checklist_items`
→ `completed` + immutable `tc_principal_reviews` row + `tc_events`) → reader (the item leaves
the queue; the transaction §F4 shows the review; F12 shows the event) → outcome (the first
real principal review is recorded; the deadline reflects the correct per-document anchor).

---

### F9 — Commissions roll-up + envelope dashboard (money reads through the one ledger)

**Purpose:** the commission KPI + per-broker roll-up + escrow ledger. One number, one source.

**Keep:** the KPI/roll-up information design. **Rebuild:** read `getCommissionLedger` /
`getBrokerageEarned` (§3.2) — the **same DAL the leaderboard reads**, so they cannot disagree
(D7); scope clamp so a broker sees only their own (D15); "See all" links to a **real ledger
view**, not `/admin/financials` (D19); **Add commission** (§3.3). **Delete:** the mislinked
"See all" dead ends.

**Data model:** `tc_commissions` via the ledger DAL (joined to cycle/deal). `EARNED_STATUSES
= ['verified','paid']` — the one earned definition.

**Edge cases:**
- **Leaderboard vs commissions disagree** (D7): impossible — one DAL, keyed by `broker_slug`.
- **A projected row (from promotion/sync):** shown as "projected", excluded from earned
  totals; included in a pipeline-value view.
- **A closing with no commission row:** now impossible for promoted deals (§F2 seeds one) and
  surfaced as "commission missing" for ingested cycles until a superuser adds one.
- **Restricted broker:** sees only `broker_slug = own`; brokerage-wide totals are superuser-only.

**Compliance:** `requireCapability('commissions:read')` in-body, scope-clamped (D15 — today
any admin role reads every broker's compensation). Every figure traces to `tc_commissions`
(C4). Currency rounded to $1,000; tabular numerals.

**Responsive:** one tree, cards on phone (delete the `md:hidden` fork).

**Acceptance:** writer (`createTcCommission`/`updateTcCommission`) → store (`tc_commissions`
+ `tc_events`, `tc-commissions` tag invalidated) → reader (commissions KPI, financials revenue
§F10, AND the CRM leaderboard all read the same DAL and show the same number) → outcome (the
three money surfaces agree by construction; a broker cannot read another broker's comp).

---

### F10 — Financials P&L

**Purpose:** brokerage P&L — revenue (earned commissions) − expenses (incl. auto ad-spend).
Superuser-only.

**Keep:** revenue-by-close-year bucketing, `tc_expenses` + auto ad-spend from
`marketing_channel_daily`, add-expense validation, archive-not-delete. **Rebuild:** revenue
reads `getBrokerageEarned` (§3.2) so P&L revenue == commissions earned == leaderboard;
`window.location.reload()` → optimistic; in-body `financials:read` (superuser). **Delete:**
nothing.

**Data model:** `tc_commissions` (via ledger DAL, earned statuses), `tc_expenses`,
`marketing_channel_daily`.

**Edge cases:**
- **Post-migration closings missing** (audit §13): fixed by §3.3 (a row exists per closing).
- **Expense deal-link by free-text `property_key`** (audit §13): replace the free-text with a
  transaction picker (the `tc_deals` list is now the SoT).
- **Ad-spend source stale:** stamp the "as of" date; never present a blank as $0 (C4/§4.5 —
  a metric with no live writer is not rendered as a fabricated zero).

**Compliance:** `financials:read` = superuser only (brokerage-wide P&L). Every number traces
to a source (C4).

**Responsive:** one tree, per-year cards on phone (the existing fork is good — make it one tree).

**Acceptance:** writer (add expense / a commission verified) → store (`tc_expenses` /
`tc_commissions` + `tc_events`) → reader (P&L revenue == commissions earned; net = retained −
expenses) → outcome (P&L revenue and the commissions page never disagree; no fabricated $0).

---

### F11 — Forms library → template envelope (wire the 111 mapped forms)

**Purpose:** the verified OREF/ODS template library (111 versions, mapped field maps) becomes
**usable** — a broker starts an envelope from a template with the field map pre-placed.

**Keep:** the library browser (`forms/page.tsx`), `createEnvelopeFromTemplate`
(`tc-envelopes.ts:322-440` — copies blanks into the deal, places the verified field map,
auto-assigns by signer role — the complete one). **Rebuild:** wire a **"Use on a deal"** entry
on each form (today zero UI call sites — audit §11); GET-search → client filter (no full
reload). **Delete:** `createDraftEnvelope` (the incomplete husk that would create an
unsendable envelope — audit §11/§19); the footer's "Composer ships next" text.

**Data model:** `tc_form_libraries`, `tc_form_versions` (field_map, signer_profile),
`tc_envelopes`/`_documents`/`_fields`/`_recipients`.

**Flows:** from the forms library → "Use on a deal" → pick transaction → template envelope
created (docs copied, field map placed, recipients auto-assigned by role) → composer (§F5) to
adjust → Send. Or from a transaction (§F4) "New envelope → from template."

**Edge cases:**
- **Template with an outdated version** (`update_available=true`, `superseded_by`): warn +
  offer the current version before creating the envelope.
- **Signer role in the template not present on the deal** (e.g. template expects a co-buyer,
  deal has one buyer): the composer flags the unassigned role; Send validation refuses until
  every field has a signer.
- **Field map drift** vs the blank PDF: `createEnvelopeFromTemplate` places by the stored
  field map; a page-count mismatch aborts with an explicit error (don't place fields on the
  wrong page).

**Compliance:** `requireCapability('forms:read')` + `esign:send` to launch; the license note
on `tc_form_libraries` is respected (OREF/ODS licensed blanks — a superuser-only concern if
licensing lapses).

**Responsive:** one tree, cards on phone (delete the fork).

**Acceptance:** writer ("Use on a deal" on a form) → store (`tc_envelopes` + copied
`tc_documents` + placed `tc_envelope_fields` + auto-assigned `tc_envelope_recipients`) →
reader (the composer opens with fields pre-placed) → outcome (the 111 mapped forms are
reachable in ≤2 taps from a transaction; no path can create an unsendable husk).

---

### F12 — Event timeline / audit surfaces

**Purpose:** make the legally-relevant `tc_events` browsable (today only a 15-row per-deal
feed, audit §14); stop the mislink that calls the **content** audit log the "TC audit trail."

**Keep:** `tc_events` as the append-only TC spine; `admin_actions` as the **content-admin**
audit trail (media, banners, brokers, roles — its actual purpose); `crm_timeline` as the
per-contact ledger. Three legit ledgers, each for a different domain (do **not** force-merge).
**Rebuild:** a **per-transaction full event timeline** (not 15-row-capped) on §F4 with "View
all"; a **superuser cross-transaction `tc_events` viewer**; fix the `/admin/deals` footer
mislink to point at the transaction event timeline, not the content log (audit §14).
**Delete:** the "audit trail" mislink text.

**Data model:** `tc_events` (deal/cycle/document scoped), read-only.

**Edge cases:**
- **High-volume deal (103+ events):** paginate/cursor; don't cap at 15 silently.
- **Event with a null deal_id (cycle- or document-only):** groups under the cycle/document.

**Compliance:** `tc_events` is the immutable audit spine for the legal signing/sign-off
system; a superuser can browse it; a broker sees their own transactions' events.

**Acceptance:** writer (any TC mutation) → store (`tc_events` row) → reader (the transaction's
full timeline + the superuser viewer show it; the footer links to the correct ledger) →
outcome (the legally-relevant events are browsable beyond 15 rows; the content log is no
longer mislabeled as the TC audit trail).

---

## 7. States catalogue (applies to every mutation, §4.2)

| State | Behavior |
|---|---|
| empty | real empty copy + the *next action* (link to pipeline / "promote a deal"), never a node command |
| loading | streamed shell + `<Suspense>` per data region; never a blank page |
| populated | cached reads, source-stamped numbers |
| pending/optimistic | the changed entity renders instantly in a pending style; control disabled+reset |
| success | server returns the entity; client patches local state; no page reload |
| partial | e.g. envelope sent but some completion emails failed → visible "delivery issues" badge |
| error | inline, actionable, with Retry; the optimistic row marks failed (never silently swallowed — audit flags 5 mobile wrappers that swallow errors) |
| offline | optimistic hold + queued Retry; idempotency key makes the eventual send safe |
| permission-denied | the action refuses in-body; the nav never showed it (capability map) |
| over-limit | lists paginate/cursor; the signer canvas virtualizes pages |

---

## 8. Exhaustive edge-case ledger (domain-specific, beyond per-feature)

1. **Group of parties on a transaction where one contact later resolves to a CRM person:**
   `tc_deal_contacts.person_id` is set on promotion; a later match (a raw name that becomes a
   CRM person) can be linked without losing the free-text fallback.
2. **A CRM deal with no `assigned_broker`:** promotion falls back to Matt (default-routing
   directive) and flags "broker unresolved."
3. **A transaction whose `broker_name` doesn't map to a `brokers.slug`:** the commission
   ledger keys on `broker_slug`; an unmapped `broker_name` surfaces "unassigned commission"
   for a superuser to resolve (never silently dropped from totals).
4. **Merge-token / field with no value on an envelope:** `sendEnvelope` refuses a signer with
   no field / no signature field (existing validation); a template field that can't resolve is
   flagged, not silently blank.
5. **Suppression / quiet-hours on the signer invite email:** e-sign invites are transactional
   (a party to a contract requested/expects them), not marketing — but they still route
   through the send lib; a hard suppression (a party who globally opted out) blocks the invite
   **fail-closed** and surfaces to the broker (they must reach that signer another way), never
   a silent drop.
6. **Expired session mid-send / mid-seal:** capability re-checked in-body; a stale finalize is
   rejected; idempotency keys make a re-auth-then-retry safe.
7. **Concurrent broker edits** (deal restage, commission edit, promotion): last-write-wins on
   the single field/row; unique index on `crm_deal_id` serializes promotion; the seal lock
   serializes sealing; every write appends an event.
8. **Duplicate submit** (double-tap): idempotency key + conditional status update → no-op.
9. **Timeout on a 30–60s build** (doc render, signed-URL mint, seal): streamed regions +
   suspense; the slow region resolves independently; a failure degrades to "unavailable," never
   a blank/false-complete.
10. **A metric with no writer:** never rendered as `$0` (§4.5) — a source-less number is not
    shown; a stale source shows "as of <date>."
11. **SkySlope sync failure:** `sync_alerts` row + banner; the list renders last-good data with
    a staleness stamp; the cron retries next window.
12. **A snapshot row for a property that also has an in-house transaction:** the sync links to
    the existing `tc_deals` (by property_key), never creates a duplicate; in-house fields win.

---

## 9. Compliance + legal (flag to Matt)

- **OAR 863-015-0140 sign-off records** — `tc_principal_reviews` is the statutory record.
  Two legal calls before the sign-off deadline display ships: **(a)** the deadline **anchor**
  — cycle `contract_acceptance_date` vs per-document event date (D14); **(b)** whether the
  in-house sealed PDF + certificate satisfies Oregon's record-retention + e-signature
  requirements as the executed instrument. **Open Question Q3.**
- **ESIGN/UETA** — consent capture is in place and correct; keep it as the gate before any
  field is signable. Any change to the signer flow must preserve it.
- **The e-sign system is legal infrastructure with 0 production uses.** §5/§8 gate its launch
  behind a proven round trip; it must not be presented as "live" until one real envelope
  completes end-to-end. **Open Question Q1** (own it in-house vs third-party).

---

## 10. Deletions summary (§4.7)

`/admin/crm/deals/[id]/**` (5 files, ~604 lines, orphaned + read leak) · `createDraftEnvelope`
· the "Custom fields" stub · `/admin/crm/reporting/deals` redirect + circular sub-nav ·
direct `skyslope_transactions` reads on the Transactions home · the 6 `md:hidden` table→card
forks · the 8 duplicate `getServiceSupabase()` (→ canonical client) · the "audit trail"
mislink · the dead `sendBrokerSignedNotice` partial branch (→ made live) · the node-script
empty state + refresh footer.

---

## 11. Acceptance criteria — the round trips that gate coding (§8)

Each is "writer → store → reader → outcome, proven end to end." No feature is done when it
renders; it is done when the round trip is exercised by an acceptance test.

1. **The link exists.** Promote a CRM deal → a `tc_deals` row with `crm_deal_id` set, one
   `tc_cycles`, one `projected tc_commissions`, `tc_deal_contacts.person_id` → the transaction
   detail renders it and the CRM card shows "Transaction linked." A second promote is a no-op.
2. **One commission number.** Create/verify a `tc_commissions` row → `/admin/commissions`,
   `/admin/financials` revenue, and the CRM leaderboard **all show the same figure** (they call
   one DAL). Changing the row changes all three; they can never diverge.
3. **Transactions are fresh.** The `tc-skyslope-sync` cron runs on schedule → `tc_deals`/
   `tc_cycles` update (snapshot facts only, in-house edits preserved) → the Transactions list
   shows data ≤3h old or a visible staleness banner. A broker's checklist edit survives the
   next sync.
4. **E-sign round trip (the RC6/§8 gate).** Compose an envelope from a template → send (invite
   delivers; a failed invite leaves it `draft` and surfaces the error) → **sign on a 375px
   phone with no horizontal scroll** → seal (exactly one executed doc under concurrent
   last-signers) → certificate stored → completion copies sent or logged-failed → a
   `tc_principal_reviews` row recorded on sign-off. This test must be green **and** one real
   envelope must complete in production before `esign:send` opens to brokers.
5. **Auth holds.** Each of `getTcDeal`, `getTcDocumentUrl`, `getEnvelopesForCycle`,
   `getEnvelopeDetail`, `getEnvelopesOverview`, and every mutation refuses an unauthenticated
   POST (in-body `requireCapability`); a restricted broker cannot read another broker's deal,
   transaction, commission, or reassign `assigned_broker`. `ci:admin-authz` fails the build on
   any ungated mutation/service-role read in the domain.
6. **No reload, no double-send.** Every TC mutation patches client state without a full-page
   reload; a double-tap on Send/Promote/Restage produces exactly one effect (idempotency key +
   conditional update).
7. **Success-flow budget.** From the pipeline, an under-contract deal → transaction in **1 tap
   + a pre-filled confirm**; from a transaction, a template envelope out for signature in **≤2
   taps to the composer**; a signer completes on a phone in **consent + fields + Finish**.

---

## 12. Open questions for Matt (real decisions, not defaults)

- **Q1 — E-sign ownership.** Wire the in-house e-sign as the signing system (this spec's
  default, gated behind a proven round trip), or route signing to a third-party (DocuSign)
  and quarantine the in-house stack (keep the code/tables, hide the nav)? A legal-signing
  system is yours to own or outsource — your call.
- **Q2 — Promotion gate.** Hard-gate "promote to transaction" to a specific pipeline stage
  (e.g. only at/after "Under contract"), or allow-with-warning at any stage (default)?
- **Q3 — OAR sign-off anchor + record sufficiency (legal).** Confirm the sign-off deadline
  clock starts per-document event vs per-cycle acceptance date (D14), and confirm the in-house
  sealed PDF + certificate is acceptable as the executed instrument for Oregon retention.
  Worth a quick counsel check before the deadline display ships.
- **Q4 — Commission SoT cutover.** `tc_commissions` becomes the one ledger and the 20 CRM
  deals' `commission_dollars` become estimate-only. Confirm you want closed CRM deals'
  historical commission figures migrated into `tc_commissions` (via promotion/backfill) rather
  than left as pipeline estimates.
- **Q5 — Stage history.** Add a `crm_deal_stage_history` table so "time in stage" is
  recoverable (today `entered_stage_at` is overwritten per restage, D21)? Small additive table;
  worth it only if you want stage-velocity reporting.
- **Q6 — Money-page visibility.** Confirm brokerage-wide commissions + P&L are superuser-only
  and a broker sees only their own commission rows (this spec's default). Any report-viewer
  role that should see brokerage totals?
