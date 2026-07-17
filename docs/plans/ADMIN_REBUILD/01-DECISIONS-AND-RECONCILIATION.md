# Part 1 · Reconciliation and Locked Decisions

The 11 feature specs were written in parallel against the locked architecture
(`00-REASONING-AND-ARCHITECTURE.md`), then adversarially reviewed by a spec lead
who found 15 cross-spec conflicts, 6 architecture violations, 8 coverage gaps, and
5 sequencing risks. This document **resolves every one of them.** Where the decision
is architecture-internal it is locked here (the specs inherit it). Where it is
genuinely Matt's business or legal call it is listed in §D and blocks finalization
of the affected spec only.

Rule of precedence when a spec disagrees with this file: **this file wins.** The
per-feature specs are being reconciled to it, not the other way around.

---

## A. Locked platform contracts (resolve conflicts 1–6, 14–15; violations 1–6)

These are the shared primitives every spec builds on. They existed in conflicting
forms across specs because the specs were written simultaneously. One form each,
locked:

**A1 · One capability model.** `lib/admin/capabilities.ts` (spec 01's) is the sole
source. Dot-notation capability identifiers, one `CAPABILITY_ROLES: Record<Capability,
AdminRoleType[]>` map (capability → roles). Spec 05's parallel `lib/auth/capabilities.ts`
(colon notation, inverted map, `requireCapability`) is **deleted**. Every capability
string invented by specs 02–11 is re-expressed as a member of this one enum. The enum
is **append-only and co-located** — not "closed at Foundation." Each domain spec adds
its capabilities to the one file as it lands (this resolves sequencing risk #4: the
file is shared and amended in lockstep by design, and `ci:admin-authz` validates the
whole set on every build).

The canonical capability set (superseding every per-spec name):

| Capability | Roles | Was called (deleted aliases) |
|---|---|---|
| `today.view` | superuser, broker, report_viewer | — |
| `inbox.use` | superuser, broker | `crm:message:send` |
| `people.view` | superuser, broker | — |
| `people.write` | superuser, broker | `crm.write` |
| `people.export` | superuser, broker¹ | `export:run` |
| `send.deliverable` | superuser, broker | `send:deliverable` |
| `prospecting.view` | superuser, broker | `prospecting` |
| `transactions.view` | superuser, broker | `forms:read` |
| `transactions.edit` | superuser, broker | — |
| ~~`esign.send`~~ | — | **parked v1 (D1)** — not in the v1 enum |
| ~~`transactions.signoff`~~ | — | **parked v1 (D1)** — not in the v1 enum |
| `commissions.view` | superuser³ | `commissions:read` |
| `financials.view` | superuser³ | `financials:read` |
| `performance.view` | superuser (+broker, scoped)⁴ | — |
| `performance.financials` | superuser | `performance:financials` |
| `content.listings` | superuser, broker | `content.*.*` |
| `content.blog` | superuser, broker | `content.blog.manage` |
| `content.site` | superuser | `content:write` |
| `content.media` | superuser | — |
| `content.marketing` | superuser | (newsletter/campaigns/broker-links owner) |
| `settings.manage` | superuser | `settings:manage` |
| `settings.account` | superuser, broker, report_viewer | — |
| `tasks.use` | superuser, broker | `tasks:use` |
| `calendar.use` | superuser, broker | `calendar:use` |
| `approvals.act` | superuser | `approvals:act` |
| `import.run` | superuser | `import:run` |

¹ flag-gated by `admin_roles.can_export`. ³ brokers see only their own rows via row
scope, not the capability. ⁴ brokers get a scoped own-book Performance overview;
`performance.financials` (spend/CPL/ROI/P&L) is superuser-only (D3, locked).

**A2 · One authorization primitive.** Three guard functions in
`lib/admin/require-admin.ts`, all reading `CAPABILITY_ROLES`:
`requireAdminPage(capability)` (RSC/layout, redirects), `requireAdminAction(capability)`
(server action, throws/returns typed error), `requireAdminRoute(capability)` (route
handler, 401/403). Spec 05's `requireCapability` and specs 08/11's `lib/auth/guards.ts
requireAdmin` are deleted in favor of these. **Every mutating server action and every
admin route calls one in-body** (arch §4.4). `isAuthorizedCron` (fail-closed) stays as
the cron equivalent.

**A3 · One `ci:admin-authz` gate**, owned by spec 01. It asserts: (a) every enum
capability is referenced by at least one page/action; (b) nav item capability ==
destination page capability; (c) no page reads a capability via string literal (must
import the enum); (d) no orphan admin route (every route is in the nav map or an
explicit allowlist); (e) **every mutating action under `app/actions/**` calls a guard**
(the defense-in-depth check for RC5's unauthenticated-action hole). Spec 08's
`ci:content-authz` and spec 11's "widen" fold into this one gate.

**A4 · One send chokepoint, layered (resolves conflict 5, violation 4b).** The
layering is: **conversation layer → governed-send layer → provider.** Concretely:
- `lib/comms/sendGovernedSms` / `sendGovernedEmail` (spec 11) is the **single
  compliance + persistence chokepoint**: suppression (fail-closed), quiet-hours,
  A2P/merge-token gates, idempotency, and the write to `crm_message` + `crm_timeline`.
  Nothing calls a provider (Twilio/Gmail/Resend) except this layer.
- `sendMessage` (spec 02, conversation-level) resolves the conversation/participants,
  then calls `sendGovernedSms`/`sendGovernedEmail` per participant. It does **not**
  re-implement suppression or persistence.
- All other senders (deliverables, prospecting, sequence engine, alerts) call the
  governed layer directly. There is **one** gate, `ci:send-chokepoint` (owned by
  spec 11), asserting no code reaches a provider except through `lib/comms/*`. Spec
  02's `ci:crm-sms-safety` folds into it.
- The "claim/finalize/log" three-function API spec 11 referenced does not exist;
  persistence is the governed layer's own responsibility (resolves coverage gap 7).

**A5 · One idempotency ledger (resolves conflict/gap 6, violation 6, thin-edge 1/5).**
A single generic table `crm_idempotency_keys (key text PK, scope text, result jsonb,
created_at)` backs **all** at-most-once mutations: message sends, deliverable sends,
and People writes (contact-point replace, stage/tag/field edits). Spec 03's
`crm_send_idempotency`, spec 11's `comms_send_log`, and spec 04's referenced-but-
uncreated `crm_mutation_keys` all collapse into this one table. **Group sends use a
per-recipient key** (`{messageId}:{recipientAddress}`) so a partial-failure Retry
re-drives only the failed recipients — never re-texting a member who already received
it (closes the TCPA/double-charge edge).

**A6 · One quiet-hours policy for outbound SMS (resolves thin-edge 2, conflict across
02/03/11).** Cold/deliverable SMS in the quiet window (9pm–8am Pacific) is
**queued and sent at 8am** via `crm_scheduled_sends`, shown in the UI as a visible
"will send at 8:00 AM" state. There is **no always-visible "send anyway" override**
for cold or deliverable SMS. A *manual, human-typed 1:1 reply* keeps the explicit
override (an intentional broker action to an active conversation) — that is the only
exception. Specs 02/03/11 reconcile to this.

---

## B. Locked IA and ownership (resolve conflicts 2–4, 8–12; coverage gaps 1–5, 8)

**B1 · Canonical routes (flat, lowest blast radius).** Top-level admin routes stay
flat; `/admin/settings/*` is the only nested group. The nav generator (spec 01)
points at these exact paths; owning specs conform.

| Destination | Canonical route | Owner spec |
|---|---|---|
| Today (home) | `/admin` → renders Today | **spec 01** (shell owns the home; composes widgets from 06/07/09) |
| Inbox | `/admin/inbox` | spec 02 |
| People (list + board) | `/admin/crm`, `/admin/crm/deals` | spec 04 |
| Person workspace | `/admin/crm/[id]` (canonical); `/admin/people/[id]` → redirect | **spec 03 owns the shell + fetch + send; spec 04 contributes the list/board and the timeline region as a consumer** |
| Prospecting | `/admin/prospecting` (+ `prospecting.view`, registered in spec 01) | spec 07 |
| Transactions | `/admin/transactions`, `/admin/transactions/[id]`, signing, commissions, financials, forms | spec 05 |
| Performance | `/admin/performance` (+ children) | spec 06 |
| Content | `/admin/listings`, `/admin/blog`, `/admin/guides`, `/admin/media`, `/admin/site`, `/admin/communities`, `/admin/content/data-health` | spec 08 |
| Content ▸ Marketing | `/admin/newsletters` (+ authoring/approval), `/admin/email/campaigns`, `/admin/broker-links` | **spec 08** (resolves coverage gaps 2, 3, 4) |
| Settings | `/admin/settings/*` (brokers, routing, automations, templates, stages, compliance, company, reports, appointments, account, users, audit-log) | spec 09 |

**B2 · The person route + deep-link contract.** Canonical `/admin/crm/[id]`. The Send
deep-link param is **`?intent=<kind>`** (`cma|bpo|newsletter|market_report|saved_search`);
`?panel=send` is dropped. The notification→action link (the CMA-in-seconds flow) is
`/admin/crm/[id]?intent=cma`. Spec 01's IA and spec 03's workspace both use this.

**B3 · Person Workspace single ownership (resolves conflict 4, violation 4a).** One
component, one route, one data fetch. **Spec 03 owns** `PersonWorkspace` (the shell,
the identity-core-blocking + streamed-Suspense-region fetch, and the send surfaces).
**Spec 04 owns** the contacts list and pipeline board, and **exports the timeline
region as a component that spec 03's workspace mounts** — it does not build a second
shell or a second fetch. `NextStepCard` is deleted once (by spec 03).

**B4 · TODAY has an owner (resolves coverage gap 1).** Spec 01 (the shell spec) owns
`/admin` → the Today home, guarded by `today.view`. It composes exported widgets:
`HotLeads`/`SpendAlerts` (spec 06), `ProspectingCard` (spec 07), `ApprovalsQueue` +
`TasksDue` (spec 09). No orphan route.

**B5 · One Approvals queue with typed sub-streams (resolves coverage gap 2, arch §4.7).**
`/admin/approvals`, owned by spec 01's Today surface, renders three typed sub-streams
from their owners: **marketing** (`marketing_brain_actions`, spec 08),
**enrollment/first-touch** (spec 09), **sign-off** (spec 05). One surface, three data
sources, not three routes.

**B6 · `property_saved` trigger is actually emitted (resolves coverage gap 5).** Spec
10's `saveListing` writer **must call** `fireTrigger('property_saved', listingKey,
personId)` after writing the buyer-signal row. The trigger is seeded `disabled` in the
registry until spec 10 lands, then flipped `live` (resolves sequencing risk on
`property_saved`).

**B7 · `deal_stage_changed` trigger** is seeded `disabled` until spec 05's deal-stage
dispatcher lands (resolves sequencing risk 1) — so spec 09's migration cannot break
`ci:automation-triggers-wired`.

**B8 · getSyncFreshness is a registry metric (resolves violation 5).** Operational
readouts (sync age, system health) resolve through the same `getMetric` path as
business numbers, typed as `system` metrics, so there is exactly one metric path and
`ci:metric-layer` has no exemption carve-out.

---

## C. Locked build sequence (resolves sequencing risks 2, 3, 5)

Refines §7 of the architecture doc with the dependencies the review surfaced:

0. **Foundation (spec 01 + spec 11 together)** — capability enum + guards + `ci:admin-authz`;
   the governed-send chokepoint (`lib/comms/*`) on the `crm_timeline.dedupe_key` bridge;
   the optimistic/idempotent mutation primitive + `crm_idempotency_keys`; the responsive
   shell + Today home; drop the public bundle from admin.
1. **Conversation model + Inbox + composer (spec 02)** — the governed-send layer gains
   its `crm_message` persistence here; `sendMessage` wraps it.
2. **Person workspace + one send path (spec 03), then People list/board (spec 04)** —
   03 lands the shell+fetch; 04 mounts its list/board/timeline region into it. Both
   need spec 02's conversation DAL (`getConversationMessagesForPerson`).
3. **Transactions/TC (spec 05)** — lands the `tc_deals` resolver **before** the metric
   layer consumes `closed_deals`/`closed_volume`, and the `deal_stage_changed`
   dispatcher (flip its trigger `live`).
4. **Metric layer + Performance (spec 06)** — now that spec 05's deal resolver exists,
   no metric ships `no_source` for closed-deal numbers.
5. **Prospecting (spec 07)** · **Settings/Automation (spec 09)** · **Content (spec 08)**.
6. **Consumer funnel (spec 10)** — lands `saveListing` + `fireTrigger('property_saved')`;
   flip that trigger `live`.
7. **Delete pass + gates (spec 11's ledger)** — dead routes, stubs, placebos; land the
   regrowth-prevention gates.

Each step is independently shippable; nothing needs a flag-day.

---

## D. Deferred to Matt — genuine business/legal/scope decisions

These are **not** architecture-internal; they change what the business does or carry
legal weight. **D1, D3, D4, D5 were answered by Matt on 2026-07-16 (locked below).**
D2 is now moot (e-sign parked). D6 and D7 take their recommended defaults.

**D1 · E-sign strategy. → LOCKED: PARK IT FOR v1.** The in-house e-sign stack (0
envelopes ever) is **not** wired into the rebuild. TC signing stays a manual /
off-platform step for v1. Consequences for the specs: spec 05 keeps the deal→transaction
link, the transactions list, and the **commission ledger (D4)**, but **drops** the
e-sign send flow, the sign-off queue, and the public `/sign/[token]` surface from v1
scope (the code stays dormant, unrouted, guarded). The `esign.send`,
`transactions.signoff` capabilities are **removed from the v1 capability enum** (§A1).
The `deal_stage_changed` trigger (§B7) still lands via spec 05's stage mutation, which
is unaffected. Revisit e-sign post-v1.

**D2 · Oregon record-sufficiency (OAR 863-015-0140). → MOOT for v1** (no in-house
e-sign ships). Revisit with counsel if/when e-sign is un-parked.

**D3 · Roles and access scope. → LOCKED: SCOPED BROKERS + REPORT ROLE.** Keep the
`report_viewer` read-only role. Brokers get: own-book **Performance** overview
(`performance.view`) with spend/CPL/ROI/financials gated to superuser
(`performance.financials`); **Blog + Guides** (`content.blog`) and **read-only
Listings** (`content.listings`); Site/Media/Communities superuser-only. This is the
capability→role map already written in §A1 — **no change needed**; spec 06's
report_viewer deletion (conflict 7) and spec 01 OQ-1/OQ-2 both resolve to this.

**D4 · Commission source of truth. → LOCKED: ONE LEDGER, MIGRATE.** `tc_commissions`
is the single source of truth. Closed CRM deals' historical `commission_dollars`
migrate into it (spec 05 migration `20260717_..._backfill_commissions`); CRM figures
become estimate-only. Brokerage-wide commissions + P&L are `commissions.view` /
`financials.view` = **superuser-only**; brokers see only their own rows via row scope
(§A1 note ³). Spec 06's money metrics resolve through this one ledger.

**D5 · Lead distribution model. → LOCKED: DROP PONDS + CLAIM.** Ponds and group
"first-to-claim" are removed non-destructively (data preserved, UI + routing paths
deleted). Lead routing is **source→broker strategies + round-robin** only (spec 09).
This fixes the silent "everything routes to Matt" defect by deleting the broken
mechanism rather than repairing config nobody needs.

**D6 · Buyer-signal escalation threshold. → default.** Attach the signal silently
always; escalate to Hot at ≥3 saved homes OR (1 saved search + ≥1 saved home) in a
rolling window; a prospecting link-tap raises to Hot and notifies immediately. One
threshold shared by the consumer funnel (spec 10) and prospecting (spec 07). *(Matt
can retune the numbers at build time.)*

**D8 · CMA litmus shape (2026-07-17, Phase-0 micro-batch — LOCKED).**
(1) The litmus tap is a **kick-off + notify**: it starts the standard draft-first
async CMA build AND texts the broker a review link when the draft is ready; review
+ send stay exactly as today (nothing auto-sent, §0 holds). (2) The build engine is
the **full deterministic `buildCma`, async** — no instant-estimate engine. (3) "New
lead wants a CMA" produces the **seller CMA** (BPO stays a separate affordance).
(4) Budget: **≤ 3 taps / ≤ 30 s on mobile** from notification tap to kick-off,
zero manual entry beyond confirming the resolved lead + address. Mirror:
`.auto-memory/decisions_litmus_cma_2026-07-17.md`.

**D7 · 4th-broker onboarding. → default: yes.** Broker identity moves into the
`brokers` table via spec 09's `getBrokerRegistry`; the 5 hardcoded maps are removed so
onboarding a broker is one settings screen.

**D9 · Nav / IA shape (2026-07-17, Pain-#3 micro-batch — LOCKED, Matt's answers).**
(1) **Top-level IA: the locked 8 + Prospecting** — Home · Inbox · People ·
Prospecting · Transactions · Performance · Content · Settings. Prospecting points at
the live Expireds/FSBO dashboards until spec 07 builds its hub. (2) **Superuser
nav-item budget ≈35**: destinations may carry capability-gated children dropdowns
(People/Transactions/Content/Settings); everything deeper reachable inside hub pages
+ the ⌘K palette. (3) **Old-route policy: redirect-bridge every legacy route** —
when a canonical route supersedes a legacy one, the legacy URL 30x-redirects; nothing
404s. This session only ADDS bridges (delete pass stays spec 11's). (4) **Mobile
bottom tabs stay Home/Inbox/People/Deals/Activity** — the current FUB-parity set,
now ANNOTATED in the one nav config (derived from it, not hardcoded).
Mirror: `.auto-memory/decisions_nav_ia_2026-07-17.md`.

---

## E. Known cleanup (mechanical, at build time)

- **Spec cross-reference numbers are wrong in specs 01/03/04/07/09** (they refer to the
  conversation model as "03/06," send-center as "05," metric layer as "04," consumer as
  "06/08"). Canonical map: **02**=inbox/conversations, **03**=person-workspace/send,
  **04**=people/pipeline, **05**=transactions/TC, **06**=performance/metrics,
  **07**=prospecting, **08**=content, **09**=settings/automation, **10**=consumer,
  **11**=api/actions/crons. Fix references when each spec is opened for build.

---

*With A–C locked and D answered, every feature is specified and internally consistent.
Coding begins only after Matt signs off on this package and the §D decisions.*
