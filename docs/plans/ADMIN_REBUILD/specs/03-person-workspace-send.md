# Spec 03 — Person Workspace + Unified Send (CMA / BPO / newsletter / market-report / saved-search)

> **Status:** ready to build. Derived from `00-REASONING-AND-ARCHITECTURE.md` (locked) and
> `audit-reports/send-center.md` (evidence base). Every "keep/kill" cites the audit; every
> schema/lib fact was re-verified against the live tree at `d3dd457a`.

This spec owns **the center of gravity of the loop** (C2): the one place a broker responds to a
lead and puts a deliverable in front of them. It is where the owner's litmus test lives — *"a
lead wants a CMA, I need to send it in seconds"* (`send-center.md §0`) — a job the audit proves is
**not achievable in seconds by any current path and not achievable at all on mobile**
(`send-center.md §7`).

---

## 0. What this spec owns vs depends on

**Owns (this spec is the source of truth):**
- The **Person Workspace** — one responsive surface at `/admin/crm/[id]` that replaces the forked
  desktop tree + `mobile-detail.tsx` and stacks the loop's response half into one screen.
- The **person-detail data fetch** rebuild — the current 40–55-query / multi-stage
  `force-dynamic` fan-out → cached DAL + streamed Suspense regions.
- The **Unified Send** model — one `sendDeliverable` server action + one `SendPanel` component that
  collapses the CMA's 4 build + 6 send entry points, the BPO split, the 3 market-report write
  surfaces, the 2 saved-search forms, and the newsletter one-click into a single path per concept.
- The **async build** for CMA/BPO (kills the 30–60 s synchronous action that times out).
- The **deliverable idempotency** store for non-chat sends.

**Depends on (owned by sibling specs — this spec conforms and consumes):**
- **§4.1 Conversation/`message` model** → Spec 02 (Inbox + composer). The workspace *embeds* the
  conversation thread + `SmsComposer`/`EmailComposer`; it does not own the `conversation`/`message`
  migration. Today's `crm_conversation_state` is a per-person state row keyed on `person_id`
  (`DATABASE_SCHEMA_SNAPSHOT.md:1595`), i.e. RC1 is still open; the message-row schema with
  `idempotency_key` (§4.1) is delivered by Spec 02.
- **§4.2 optimistic/idempotent mutation primitive** → Spec 01 (Foundation). This spec uses it; it is
  authored there (`useOptimistic`/`useTransition` client primitive + the server "return the changed
  entity, don't `revalidatePath`" contract).
- **§4.4 auth primitive + capability map** → Spec 01. The CRM's existing in-body guards
  (`requireCrmAccess` / `requirePersonInScope`, `app/actions/crm.ts:102,123`) are the correct shape
  and are kept; the send action calls them plus a `send:deliverable` capability check.
- **§4.5 metric layer** → Spec 04. Any number rendered in the workspace (open/click counts, delivery
  state) resolves through a single reader; no hand-rolled counts.
- **Alert → deep-link → auth-preserved landing** (§5 "notification → action") → Spec 01 owns the
  preserved-`next`; this spec consumes the `?intent=` param on arrival.

---

## 1. Conformance map (constraint → decision)

| Constraint / Root cause | How this spec discharges it |
|---|---|
| **C2** the job is a loop | The workspace *is* the response+send half of the loop, on one screen. |
| **C3** phone is the primary surface | ONE responsive tree, mobile-first; the entire send domain exists on phone (fixes `send-center.md §7` critical). |
| **C4** every number is compliance | CMA/BPO are point-in-time snapshots; the broker reviews the numbers inline once; no fabricated delivery/open counts (§4.5 readers only). |
| **C5** messages carry money/legal | Every send is idempotent (no double-send) and suppression-fail-closed; SMS-delivered links go through quiet-hours + A2P. |
| **RC2** no optimistic/idempotent layer | `sendDeliverable` accepts+persists an `idempotency_key`, renders optimistically, returns the changed entity (no full-page refresh). |
| **RC3** forked trees | Delete `mobile-detail.tsx`; one component adapts by container width. |
| **RC4** accretion, no source of truth | One send action, one SendPanel, one subscription control, one saved-search path; delete the duplicates named in §3. |
| **RC6** placebo surfaces | Kill the token-less `OwnedHomeCard` "Review comp" dead-end and the retired `cma_deliveries` wiring; the `preview_url`-gated Review button that never renders. |

---

## 2. Keep / Rebuild / Delete (explicit, audit-cited)

### KEEP — the correct engine (never discard)
| Item | File | Evidence |
|---|---|---|
| `sendCmaToLead(slug, override)` | `lib/cma/send.ts:293` | Gmail-DWD→Resend fallback, suppression fail-closed (`send.ts:298`), `attributeOutbound` tracking (`send.ts:321`), 25 MB PDF cap, timeline `email_out`. `send-center.md §1.3, §9`. |
| `sendBpoToLead({personId,slug,includeOfferStrategy})` | `lib/bpo/send.ts:101` | status-`final` gate, wrong-recipient guard (`send.ts:121`), offer-strategy strip for non-owner, suppression fail-closed. `send-center.md §2.2, §9`. |
| `sendMarketReportNowAction(personId, formData)` | `app/actions/crm-send-now.ts:25` | registry-validated area slugs, `renderMarketReportEmail`→`sendOneSubscriber` (suppression inside), in-body `requireCrmAccess`+`requirePersonInScope`. `send-center.md §4.2`. |
| `createListingAlertForLead(input)` | `lib/data/leads/listingAlerts.ts:162` | canonical `listing_alerts` create path. `send-center.md §5.1`. |
| Async CMA build worker | `lib/cma/worker.ts:135` (`runCmaBuildWorker`) + cron `/api/cron/cma-build-worker` (`vercel.json:188`, 30 min, `maxDuration=300`) | the only build path with a real timeout budget. `send-center.md §1.1`. |
| `attributeOutbound` canonical tracking | `lib/crm/attributed-links.ts` | open/click via `/api/track/e/*` + Resend webhook. `send-center.md §1.8`. |
| Suppression chokepoint | `isSuppressed` / `isSuppressedByEmail` | enforced on **every** send path (verified CMA/BPO/report/newsletter/matches/one-off). `send-center.md §9`. |
| `EmailComposer` / `SmsComposer` | `components/admin/crm/*` | canonical composers (G50-gated per memory `reference_crm_canonical_composers`). |
| `SendDocDialog.client.tsx` pattern | `components/.../SendDocDialog.client.tsx` | the one surface that unifies channel tabs + template-picker-with-live-merge + canonical composer. **Template for the new SendPanel.** `send-center.md §6.2, §9`. |
| Cron send engines | `runMarketReportSend`, `runListingAlerts`, newsletter enqueue+drain | cadence-aware, suppression-safe, tested. `send-center.md §9`. |
| `ContactDeliveryPanel` | reads across all four subscription tables | the only cross-table "what went out / what's subscribed" reader. `send-center.md §9`. |
| Person-scope reads | `getContactCmas`, `getContactBpos`, `getContactReportSubscription`, `getContactListingAlerts`, `getContactMemberships`, `getContactSendTarget` | kept; `getContactCmas` gets the `preview_url` dependency removed (§2 Rebuild). |
| CRM auth guards | `requireCrmAccess` (`crm.ts:102`), `requirePersonInScope` (`crm.ts:123`) | the correct in-body §4.4 guard shape; RBAC on reads/writes is consistent. |

### REBUILD
| Item | From → To | Why (audit) |
|---|---|---|
| Person surface | forked `page.tsx` (`hidden md:block`) + `mobile-detail.tsx` 6-tab fork → **one responsive Person Workspace** | send domain absent on mobile (`send-center.md §7`); RC3. |
| Send surface | `ContactSendCenter` + `ContactCmaCard` + `ContactBpoCard` + `OwnedHomeCard` + 2 report panels + 2 saved-search forms → **one `SendPanel`** | 3 CMA surfaces, 2 BPO, 3 report-subscription controls stacked on one page (`send-center.md §0, §1.4, §4.1`); RC4. |
| CMA/BPO interactive build | synchronous `buildCmaAdminAction`/`startCmaForContactAction`/`startBpoForContactAction` (no `maxDuration`, "30 to 60 seconds…" spinner) → **async enqueue + poll** | timeout risk (`send-center.md §1.1, §2.1`); RC2. |
| Person-detail fetch | `getCrmPersonFull` + 28-call `Promise.all`, `force-dynamic` → **identity core (fast) + Suspense-streamed cached regions** | 40–55 queries / multi-stage, no cache/stream (`page.tsx:80,124,157,223`); §4.6. |
| `getContactCmas` review link | gated on never-populated `cmas.preview_url` → **derive URLs from `slug`+`status`; inline review** | `preview_url` is NULL for builder-built CMAs (`send-center.md §1.6`); RC6. |
| Report subscription write | 3 controls (one silently forces monthly, `ContactSendCenter.tsx:134`) → **one control, selectable cadence, one `setReportSubscriptionAction`** | `send-center.md §4.1`; RC4. |
| Newsletter per-contact send | `sendNewsletterToContactAction` sends newest **draft** (`contact-newsletter.ts:83-93`) → **send only an approved/sent issue** | approval bypass, draft-first violation (`send-center.md §3.2`). |

### DELETE (this spec's cut list — coordinate cross-domain items with their owner)
| Item | File | Evidence |
|---|---|---|
| Mobile fork | `crm/[id]/mobile-detail.tsx` | RC3; `send-center.md §7`. |
| `OwnedHomeCard` "Review comp" token-less dead-end + `reviewDeliveryId` from retired `cma_deliveries` | `OwnedHomeCard.tsx:47`, `crm/[id]/page.tsx:245-248` | guaranteed dead end into token-gated `/cma-drafts/[id]` (`send-center.md §1.5`); RC6. |
| `ContactCmaCard` / `ContactBpoCard` as standalone cards | fold into SendPanel | `send-center.md §1.6, §2.4`; RC4. |
| Duplicate `ReportSubscriptionsPanel` renders + ContactSendCenter monthly checkbox | `crm/[id]/page.tsx:652`, `ContactSendCenter.tsx:262` | 3 write surfaces for one row (`send-center.md §4.1`). |
| Inline "Add saved search" form (the sends-nothing one) | `crm/[id]/page.tsx:682-700` → `assignSavedSearchForm` | duplicate of the Listings-tab path (`send-center.md §5.1`). |
| Newsletter one-click draft-send from `ContactQuickActions` | `ContactQuickActions.tsx:118-127` → `sendNewsletterToContactAction` draft fallback | approval bypass (`send-center.md §3.2`). |
| Legacy `cma_deliveries` pipeline read on person page + UUID send branch | `crm.ts:370` (`getCrmPersonFull` reads `cma_deliveries`), `contact-cma.ts:250` | retired for new builds (`contact-cma.ts:6-11`); `send-center.md §8`. |
| `NextStepCard.tsx` (orphan — verify) | `components/admin/crm/NextStepCard.tsx` | only `getContactNextStep` output consumed; component self-referenced (`send-center.md §8`). |

**Cross-domain deletes (flag, don't own):** legacy CMA API routes `/api/cma/[slug]/{email,gmail-draft,finalize-deliver,track}`, `cma-drafts/[id]` + `/send`, `lib/cma-delivery.ts`, `/api/cma-delivery` (`send-center.md §8`) belong to the **CMA-admin/API spec**; the `AdminEmailCompose` fire-and-forget one-off (`admin-email.ts`, `send-center.md §6.2`) belongs to the **email/shell spec**. This spec removes only the *person-page wiring* into them.

---

## 3. Data model

All migrations **additive and back-compatible**. `cmas` (rows ≈ 155, `DATABASE_SCHEMA_SNAPSHOT.md:596`)
and `broker_price_opinions` (`:1183`) stay the systems of record for those artifacts.

### 3.1 `cmas` — add a person link + async-build fields (migration `20260717xxxx_cmas_person_and_build.sql`)
`cmas` today has **no `person_id`** (only `client_email/name/phone`, `:611-613`), unlike
`broker_price_opinions` which has `person_id bigint` (`:1209`). Add parity so the workspace has a
stable link and the same wrong-recipient guard BPO already enforces.

```sql
alter table public.cmas
  add column if not exists person_id            bigint,                      -- CRM person this CMA belongs to
  add column if not exists build_state          text  not null default 'ready', -- queued|building|ready|failed
  add column if not exists build_started_at     timestamptz,
  add column if not exists build_finished_at    timestamptz,
  add column if not exists build_error          text,
  add column if not exists build_idempotency_key text;                        -- de-dupes concurrent build taps
create index if not exists cmas_person_id_idx      on public.cmas(person_id);
create index if not exists cmas_build_state_idx    on public.cmas(build_state) where build_state in ('queued','building');
create unique index if not exists cmas_build_idem_uidx on public.cmas(build_idempotency_key) where build_idempotency_key is not null;
```
- `build_state` is **orthogonal to `status`**: `status` is the review lifecycle
  (`draft`→`finalized`→`delivered`, `:624`); `build_state` is the job lifecycle. A row can be
  `status='draft', build_state='building'`.
- Existing rows default `build_state='ready'` — no behavior change for anything already built.
- `person_id` backfilled best-effort from `client_email` → `crm_people` at migration time; NULL is
  fine (falls back to email match, as today).

### 3.2 `broker_price_opinions` — same async-build fields
```sql
alter table public.broker_price_opinions
  add column if not exists build_state          text not null default 'ready',
  add column if not exists build_started_at     timestamptz,
  add column if not exists build_finished_at    timestamptz,
  add column if not exists build_error          text,
  add column if not exists build_idempotency_key text;
create unique index if not exists bpo_build_idem_uidx on public.broker_price_opinions(build_idempotency_key) where build_idempotency_key is not null;
```
`broker_price_opinions.person_id` already exists (`:1209`) — no add needed.

### 3.3 `crm_send_idempotency` — one idempotency ledger for **deliverable** sends
Chat messages dedupe via `message.idempotency_key` (§4.1, Spec 02). Deliverable sends
(CMA/BPO/report/newsletter/saved-search-immediate) are not chat messages; they get one ledger.

```sql
create table if not exists public.crm_send_idempotency (
  idempotency_key text primary key,            -- client-generated uuid, same contract as message.idempotency_key
  person_id       bigint not null,
  kind            text   not null,             -- cma|bpo|market_report|newsletter|listing_matches
  ref             text,                        -- cma/bpo slug, newsletter id, alert filters_hash, etc.
  channel         text   not null default 'email', -- email|sms
  result          jsonb  not null,             -- the SendResult that was returned; replayed on duplicate
  created_at      timestamptz not null default now()
);
create index if not exists crm_send_idem_person_idx on public.crm_send_idempotency(person_id, created_at desc);
```
- A duplicate key is a **no-op that returns the stored `result`** — the RC2/C5 double-send guarantee.
- 30-day retention (a nightly prune cron trims `created_at < now()-interval '30 days'`) — keys are
  only meaningful for the retry window of a single interaction.

### 3.4 Subscription tables — NOT unified in this spec (kept as-is)
The audit's "four disjoint subscription models" (`send-center.md §3.4, §4.1, §10`) —
`newsletter_subscribers` (`:2950`), `crm_report_subscriptions` (`:1887`), `listing_alerts`
(`:2463`), CRM sequences — are **read across** by `ContactDeliveryPanel` and each has a working
cron. Physically merging them is out of scope (high risk, low loop-value for a 3-broker shop). What
this spec fixes is the **write-surface duplication**: one control per concept in the workspace, each
writing its existing canonical table through its existing canonical action. The unification is at the
*UI/write-path* layer, not the storage layer. (Open question §19.1 revisits whether storage
consolidation is ever worth it.)

---

## 4. The Person Workspace surface (one responsive tree)

Route: **`/admin/crm/[id]`** (kept — deep-links + alerts already target it; the redirect-stub sweep
is Spec 07's job). Renders as **one component tree** authored mobile-first; there is no `md:hidden`
twin and no `mobile-detail.tsx`.

### 4.1 Regions (single column on phone, progressively enhanced to columns on wider screens)

```
┌─ IDENTITY HEADER (always first paint) ────────────────────────────┐
│  name · stage · assigned broker · primary phone/email             │
│  channel-eligibility chips (email ✓ / phone ✓ / suppressed ✗)     │
│  [Send ▾]  ← primary action, reachable in one tap on phone        │
├─ SEND PANEL (the point of the screen; present on ALL widths) ─────┤
│  tabs: CMA · BPO · Market report · Newsletter · Saved search      │
│        · Email · Text  (channel/template pattern from SendDocDialog)│
├─ CONVERSATION (embeds §4.1 thread + SmsComposer/EmailComposer) ───┤
├─ TIMELINE / ACTIVITY (streamed)                                   │
├─ HOMES (owned + viewed + matches, intent signal)                 │
├─ SUBSCRIPTIONS (one control each: report / newsletter / alerts)  │
├─ TASKS · APPOINTMENTS · RELATIONSHIPS · CUSTOM FIELDS (streamed)  │
└───────────────────────────────────────────────────────────────────┘
```

- **Phone (default):** vertical scroll; Identity + a sticky **Send** affordance are the first
  viewport. Tapping `Send ▾` opens the SendPanel as a bottom sheet with the CMA tab default-selected
  and the lead's best subject pre-resolved.
- **Tablet/desktop (progressive enhancement of the *same* tree):** a two/three-column grid —
  Identity+Send rail beside Conversation, with Timeline/Homes/Subscriptions flowing below. Layout is
  a container-query/CSS grid change, **not a second component**.

### 4.2 Deep-link intent (notification → action, §5 of the architecture)
Arriving with `?intent=cma` (from an alert deep-link, auth preserved by Spec 01) auto-scrolls to the
SendPanel, opens the CMA tab, and pre-resolves the subject — landing the broker **one tap from Send**.
Supported intents: `cma`, `bpo`, `report`, `newsletter`, `search`, `text`, `email`. An unknown intent
is ignored (renders the default workspace, no error).

---

## 5. Person-detail data fetch — cached core + streamed regions

**Today (verified):** `page.tsx` is `dynamic='force-dynamic'` (`:80`) and awaits three sequential
`Promise.all` blocks — Stage A (`:124`, 5 calls incl. `getCrmPersonFull`), Stage B (`:157`, ~28 DAL
calls), Stage C (`:223`, 2 calls). `getCrmPersonFull` itself (`crm.ts:346`) runs `person` →
`getCrmAccess` → an 8-query `Promise.all` (`:363`, incl. the retired `cma_deliveries` read) → a
conditional 2-query visitor drill. Net: 40–55 queries across ~7 dependent stages, uncached, blocking
first paint. This is `send-center.md`-adjacent but the concrete perf root cause behind "slow to load."

**Rebuild:**

1. **Identity core (blocking, tiny, cached-with-short-TTL).** One `getPersonCore(id)` returns exactly
   what the header + send-eligibility need: person row, contact points (phone/email + primary flags),
   assigned broker, stage, and suppression flags (`getPersonSuppressions`). This is the only thing
   that blocks first paint. Target < 1 query round-trip via a single `crm_people` + `crm_contact_points`
   + `crm_suppressions` join-or-batched read. `notFound()` if the person doesn't exist / out of scope.

2. **Every other region is its own `<Suspense>` boundary** with its own cached DAL read, streamed:
   - `ConversationRegion` → §4.1 thread reader (Spec 02).
   - `DeliverablesRegion` → `getContactCmas` (person_id, no `preview_url` dependency) + `getContactBpos`.
   - `SubscriptionsRegion` → `getContactReportSubscription` + newsletter membership + `getContactListingAlerts`.
   - `HomesRegion` → `getOwnedHomeMatches` + viewed + `getListingAlertsForLead` (intent signal).
   - `ActivityRegion`, `TasksRegion`, `AppointmentsRegion`, `RelationshipsRegion`, `EngagementRegion`.
   The slowest region never blocks the shell (§4.6). The retired `visitor_sessions`/`cma_deliveries`
   drill in `getCrmPersonFull` is **dropped** (RC6).

3. **Cache reference/aggregate reads through `unstable_cache` with per-person tags.** Tag scheme:
   `person:{id}:core`, `person:{id}:deliverables`, `person:{id}:subscriptions`, `person:{id}:activity`,
   `person:{id}:homes`. A mutation invalidates **only its tag** (e.g. `sendDeliverable` cma →
   `revalidateTag('person:{id}:deliverables')`), never `revalidatePath` of the whole page (§4.2, §4.6).

4. **No `force-dynamic`.** The page streams; `getPersonCore` uses `unstable_noStore()` only on the
   suppression flag if we need it live at send-time (otherwise tagged cache is fine).

---

## 6. The Unified Send model

### 6.1 One server action

```ts
// app/actions/crm-send.ts
'use server'
type DeliverableKind = 'cma' | 'bpo' | 'market_report' | 'newsletter' | 'listing_matches'
interface SendDeliverableInput {
  personId: number
  kind: DeliverableKind
  ref?: string            // cma/bpo slug; newsletter issue id; areas for report; filters for search
  channel?: 'email' | 'sms'   // default 'email'; sms only for cma/bpo link-share
  idempotencyKey: string  // client-generated uuid (§4.2)
  override?: Record<string, unknown> // body override, cadence, includeOfferStrategy, immediateSend, areas[]
}
interface SendDeliverableResult {
  ok: boolean
  timelineItem?: TimelineItem  // the changed entity to patch in optimistically (§4.2)
  error?: string
  errorKind?: 'suppressed' | 'no_channel' | 'not_ready' | 'wrong_recipient' | 'over_limit'
            | 'auth' | 'quiet_hours' | 'a2p' | 'unknown'
}
export async function sendDeliverable(input: SendDeliverableInput): Promise<SendDeliverableResult>
```

**Contract (every path, no exceptions):**
1. **Auth in-body (§4.4):** `requireCrmAccess()` → `requirePersonInScope(personId)` → `send:deliverable`
   capability. Fail → `{ ok:false, errorKind:'auth' }`. This is the defense-in-depth the layout gate
   can't provide (the action is an independently-invocable POST).
2. **Idempotency (§4.2, C5):** look up `crm_send_idempotency[idempotencyKey]`. Hit → return stored
   `result` verbatim (no second send). Miss → proceed, and on success **persist the key + result in the
   same transaction as the timeline write**.
3. **Dispatch to the kept lib** (table below). Suppression is fail-closed *inside* every lib — the
   action does not re-implement it.
4. **Return the changed entity**, not a page revalidation. The client patches local state; the action
   additionally `revalidateTag('person:{id}:deliverables'|'subscriptions')` for the next cold load.

| kind | dispatches to (KEEP) | gate before dispatch |
|---|---|---|
| `cma` | `sendCmaToLead(ref, override)` (`lib/cma/send.ts:293`) | `status ∈ finalized/delivered` **and** `build_state='ready'` **and** person has email |
| `bpo` | `sendBpoToLead({personId, slug:ref, includeOfferStrategy})` (`lib/bpo/send.ts:101`) | `status='final'` **and** `build_state='ready'` **and** person has email |
| `market_report` | the `sendMarketReportNowAction` body (`crm-send-now.ts:25`) | ≥1 registry-valid area, person has email |
| `newsletter` | send an **approved/sent** issue only (never a draft — fixes `§3.2`) | issue `status='sent'`; person has email; voice gate (kept) |
| `listing_matches` | `createListingAlertForLead` (+ immediate send if `override.immediateSend`) | person has email; valid filters |
| channel `sms` (cma/bpo link) | `sendDocSmsAction` (`send-doc.ts:240`) rails | person has phone; **quiet-hours + A2P + suppression** (kept SMS chain) |

### 6.2 Async build (CMA + BPO) — no synchronous 30–60 s action

**Today (verified):** paths A and C run `buildCma()` synchronously in the action with no
`maxDuration`; the button literally says "Building (30 to 60 seconds)…" (`BuildCmaForm.tsx:140`);
default Vercel action duration is under that, so it can time out (`send-center.md §1.1`). BPO the same
(`§2.1`).

**Rebuild — one build action for both, always async:**

```ts
// app/actions/crm-build-deliverable.ts
export async function buildDeliverable(input: {
  personId: number
  kind: 'cma' | 'bpo'
  subject: { listingKey?: string; address?: string }  // resolved from owned home / saved-search area / manual
  buildIdempotencyKey: string
}): Promise<{ ok: boolean; slug?: string; error?: string }>
```
1. Auth in-body (§4.4).
2. Idempotency via `build_idempotency_key` unique index (§3.1/§3.2) — a duplicate tap returns the same
   in-flight row, never a second build.
3. **Insert the `cmas`/`broker_price_opinions` row immediately** with `status='draft'`,
   `build_state='queued'`, `person_id`, subject snapshot, `build_started_at=now()`. Return `{slug}` in
   well under a request budget (no heavy work in the action).
4. Enqueue the actual build the way the async path already does (`createCmaRequest` /
   `marketing_brain_actions content:cma`, drained by `runCmaBuildWorker`, `worker.ts:135`). The worker
   claims `build_state='queued'` rows (or the action row), runs the MLS pull + comp select + pricing +
   HTML render, then sets `build_state='ready'`, `build_finished_at`, value range. On failure:
   `build_state='failed'`, `build_error`.
5. The workspace **polls the row** (`getContactCmas`/`getContactBpos` returns `build_state`) or
   subscribes via the same lightweight poll the conversation uses — showing a "Building…" chip that
   flips to an inline preview when `ready`. No request ever waits 30–60 s.

**Comps pre-selection (the §6 success flow):** the subject resolves in priority order — (1) the lead's
owned home on file (`getOwnedHomeMatches`), (2) the subject area of their most recent `listing_alerts`
saved search, (3) manual address entry. The build's existing deterministic comp selector
(`selectCmaCompsPool`, `getListingForCmaSubject`) auto-picks comps from that subject's
subdivision/area. The broker can open a **swap-comps** affordance (a comp list with add/remove) before
approving; a good default is one tap away, per §6.

---

## 7. Feature: Send CMA (the core success flow)

**Purpose / job:** the owner's litmus test (C2) — a new lead wants a CMA; get it built, reviewed, and
sent from one screen, on a phone, in seconds. Today this is ≈10–12 interactions across 4–5 page loads
plus a 30–60 s synchronous build (`send-center.md §1.7`). Target: **2 broker taps + one inline glance,
one screen, no page navigation, no synchronous wait.**

### 7.1 Happy path (lead already in CRM, owns a home / has a saved search)
1. Broker taps the alert → lands on the Person Workspace, `?intent=cma`, scrolled to the SendPanel CMA
   tab, subject pre-resolved, comps auto-selected. **(0 extra taps — the deep-link did it.)**
2. **Tap "Build & send CMA."** → `buildDeliverable` returns instantly; an optimistic **"Building…"**
   chip appears in the SendPanel (§4.2). Broker can do anything else meanwhile.
3. Build finishes server-side (seconds–~1 min). The chip flips to an **inline preview** (`<iframe
   src="/cma/[slug]">`, the same authed draft view `route.ts:50` already allows) + the value range +
   one **"Approve & send"** button. *(The one-glance review is non-removable — a CMA is a compliance
   artifact, C4/§0 — but it is inline, not a 4-page chase.)*
4. **Tap "Approve & send."** → optimistic "Sending…" bubble; server finalizes (`status`→`finalized`)
   and calls `sendCmaToLead` (suppression fail-closed, PDF attached, Gmail-DWD from the signing
   broker, `attributeOutbound` open/click, timeline `email_out`). On resolve, the bubble becomes
   "Sent · tracking opens." **Done.**

**Two broker taps** (Build&send, Approve&send) with one inline review between. For a CMA already
`finalized` for this lead (e.g. pre-built by the seller-LP cron, `send-center.md §1.1 path B`) the
SendPanel shows **"CMA ready — Send"** → **one tap**.

### 7.2 Alternate paths
- **Brand-new lead (not in CRM):** SendPanel offers "New contact + CMA" — create the person
  (name+email/phone), then the §7.1 flow. Still one screen.
- **Broker wants different comps:** step 3 preview has "Swap comps" → add/remove from the subdivision
  pool → "Rebuild" (async, same chip) → re-review → Approve.
- **Broker wants to text the link instead of email:** SendPanel channel toggle → SMS → `sendDocSmsAction`
  rails (quiet-hours + A2P + suppression). Sends the tracked `/cma/[slug]` link, not a PDF.

### 7.3 States
| State | UI |
|---|---|
| empty (no CMA, no subject resolvable) | "Build a CMA" with an address field; comps resolve after subject entry. |
| loading (streamed) | SendPanel chrome paints instantly; the "existing CMAs" list streams into it. |
| building (optimistic) | "Building…" chip with a subtle progress shimmer; `build_state='queued'\|'building'`. |
| ready-to-review | inline preview + value range + "Approve & send". |
| sending (optimistic) | "Sending…" bubble, button disabled+cleared (RC2). |
| sent | "Sent · opens tracked" with a live open/click indicator from `attributeOutbound` (§4.5 reader). |
| build failed | red chip "Build failed — {build_error}" + **Retry** (new `build_idempotency_key`). |
| send failed | optimistic bubble marked failed + reason + **Retry** (same `idempotency_key`, so retry can't double-send). |
| permission-denied | SendPanel shows "You don't have access to this contact" (guard returned `auth`); no Send controls rendered (nav+action agree, §4.4). |

### 7.4 Edge cases (exhaustive)
- **Lead has no email:** the CMA tab shows "Add an email to send a CMA" with an inline add-contact-point
  field (fixes the current silent dead-ends). Build is still allowed (broker may want the doc); Send is
  disabled with the reason until an email exists.
- **Lead suppressed (opted out of email):** the CMA tab shows a **pre-flight** suppression badge
  *before* the broker taps Send; if they tap anyway, `sendCmaToLead` returns
  `errorKind:'suppressed'` ("opted out of email (…)") mapped onto the optimistic bubble. Fail-closed
  (`send.ts:298`). No override in-UI (compliance).
- **Duplicate submit (double-tap Send):** second tap carries the same `idempotency_key` →
  `crm_send_idempotency` hit → returns the first result, **no second email**. The core C5 guarantee.
- **Duplicate build tap:** same `build_idempotency_key` → unique index → returns the in-flight row,
  **no second build** (no duplicate `cmas` row).
- **Expired session mid-send:** in-body `requireCrmAccess` fails → `errorKind:'auth'`; the optimistic
  bubble marks "Session expired — sign in and retry." The `idempotency_key` is preserved, so retry
  after re-auth replays safely (if the send had actually landed, the ledger returns the prior result).
- **Timeout on the build:** impossible to hang the request now (async). If the *worker* exceeds its
  `maxDuration=300`, the row stays `build_state='building'`; a watchdog (part of the worker cron) flips
  rows stuck > 10 min to `failed` with "build timed out" so the chip resolves instead of spinning
  forever.
- **MLS sync overwrites the subject after build:** it can't affect a built CMA — the subject is
  **snapshotted** into the `cmas` row at build time (`subject_*` columns, `:602-610`). The CMA is a
  point-in-time compliance doc, immune to later `listings` sync. (This is correct, not a bug.)
- **Concurrent brokers on the same lead:** two brokers each build → two `cmas` rows (distinct slugs);
  the SendPanel lists both with build time + author, no clobber. Two brokers each *send the same
  finalized CMA*: distinct `idempotency_key`s → two emails would send, but the SendPanel shows "sent by
  {broker} at {time}" the instant the first lands (patched from the return value), so the second broker
  sees it's already gone. (Acceptable for a 3-broker shop; a hard lock is §19.3.)
- **merge-token with no value in the body:** the kept lib fails closed on a missing token; the inline
  preview renders the *merged* body, so a missing token is visible **before** Approve.
- **PDF over 25 MB:** `sendCmaToLead` returns the cap error (`send.ts` MAX_PDF_BYTES) →
  `errorKind:'over_limit'` on the bubble; broker can send the tracked link via SMS/email instead.
- **`preview_url` NULL (builder-built CMA):** irrelevant now — the workspace derives `/cma/[slug]`
  (public) and the inline approve action from `slug`+`status`, never `preview_url` (`send-center.md §1.6`).

### 7.5 Acceptance criteria (writer → store → reader → outcome)
- [ ] **Build round trip:** tap Build&send → a `cmas` row exists with `build_state='queued'` within the
      request budget → worker sets `ready` + value range → the workspace chip flips to preview **without a
      page reload**.
- [ ] **Send round trip:** tap Approve&send → `sendCmaToLead` sends → `crm_timeline` `email_out` row +
      `crm_send_idempotency` key persisted → the workspace shows "Sent" from the return value (no
      `router.refresh`) → an `attributeOutbound` open later flips the indicator to "opened."
- [ ] **Idempotency proven:** two rapid taps with one `idempotency_key` produce exactly **one**
      `email_out` row and one delivered email.
- [ ] **Mobile proven:** the entire flow (build → review → send) completes on a 375 px viewport with no
      horizontal scroll and no desktop-only control (kills `send-center.md §7`).
- [ ] **Tap/second budget:** finalized-CMA case ≤ 1 tap to send; build case ≤ 2 taps + one inline
      review; zero cross-page navigation; no synchronous wait > the request budget.

---

## 8. Feature: Send BPO

Structural twin of §7 (`send-center.md §2`). Same async build (§6.2), same `sendDeliverable(kind:'bpo')`,
same states/edge cases, with BPO specifics:

- **Purpose:** a broker price opinion for an owner/lead, sent from the workspace.
- **Keep** `sendBpoToLead` (`lib/bpo/send.ts:101`) verbatim — status-`final` gate, wrong-recipient guard
  (`send.ts:121`), offer-strategy strip for non-owner recipients.
- **Fix `§2.3`:** BPO Review currently opens the client-safe public `/bpo/[slug]` from which you *cannot*
  finalize; finalize lives only on `/admin/bpo/[slug]`. In the workspace, **finalize is inline** in the
  BPO tab (the same review-ack the current `BpoReviewActions.tsx:65` uses), so the broker never leaves to
  finalize. `sendDeliverable` gates on `status='final'` and surfaces "Finalize first" inline if not.
- **Edge cases** identical to §7.4 plus: **wrong recipient** — a BPO linked to person A cannot be sent
  to person B (`send.ts:121`) → `errorKind:'wrong_recipient'` "belongs to a different contact; rebuild."
- **Acceptance:** build→ready→**finalize inline**→send→`crm_timeline` row + idempotency key; offer
  strategy stripped when the recipient isn't the owner; no navigation to `/admin/bpo/[slug]`.

---

## 9. Feature: Market-report subscription + send-now

**Purpose:** subscribe a lead to the recurring market report and/or send it once now, from the workspace.

**Collapse the 3 write surfaces to 1 (fixes `send-center.md §4.1`):** the workspace has **one**
`ReportSubscriptionControl` (areas multi-select + cadence select monthly/weekly + active toggle) writing
**one** `setReportSubscriptionAction` → `crm_report_subscriptions` (`:1887`). Delete the second
`ReportSubscriptionsPanel` render (`crm/[id]/page.tsx:652`) and the `ContactSendCenter` "Also subscribe
monthly" checkbox that **hardcodes `'monthly'`** (`ContactSendCenter.tsx:134`) and would silently flip a
broker's "weekly" back to monthly.

**Send now:** `sendDeliverable(kind:'market_report', override:{ areas })` → the kept
`sendMarketReportNowAction` body (`crm-send-now.ts:25`) — registry-valid slugs only, suppression inside
`sendOneSubscriber`, timeline row.

**States/edge cases:**
- No areas picked → "Pick at least one area" (kept validation, `crm-send-now.ts`).
- Invalid/stale slug → rejected up front with the specific unknown-area message (kept).
- Suppressed → fail-closed inside `sendOneSubscriber`; pre-flight badge shown.
- Cadence write concurrency (two brokers) → last-write-wins on the single row; the control shows
  "updated {time}" if `updated_at` moved under it, so a stale panel doesn't silently clobber.

**Acceptance:** set cadence=weekly in the one control → `crm_report_subscriptions.frequency='weekly'` →
re-open workspace reads back weekly (no monthly flip) → "Send now" produces a `crm_timeline` row and a
delivered email; verification trace (§C4) attached to the send.

---

## 10. Feature: Newsletter enrollment + send

**Purpose:** toggle a lead's newsletter subscription and/or send them the current issue.

- **Enrollment** stays a simple subscribe toggle in the SubscriptionsRegion →
  `setNewsletterSubscription` → `newsletter_subscribers` (`:2950`). (Reachable today via
  `ContactQuickActions`, `send-center.md §3.3` — kept, moved into the one control.)
- **Send (fixes the `§3.2` approval bypass):** `sendDeliverable(kind:'newsletter')` sends **only an
  issue with `status='sent'`** (an already-approved, already-broadcast issue). It **never** falls back to
  "newest draft with a body" (`contact-newsletter.ts:83-93`) — that path is deleted. If no issue has been
  sent yet, the newsletter Send action is disabled with "No approved issue to send yet" (draft-first, §0.5).
- Voice hard-fail gate kept (`contact-newsletter.ts:126`).

**Edge cases:** suppressed → fail-closed; no email → disabled with reason; no sent issue → disabled.
**Acceptance:** attempting to send with only-draft issues present → **refused** (no email leaves);
sending an approved issue → `crm_timeline` row + delivered email; enrollment toggle round-trips to
`newsletter_subscribers.status`.

---

## 11. Feature: Saved-search on behalf of a lead

**Purpose:** create a `listing_alerts` saved search for a lead and optionally email current matches now.

**Collapse the 2 paths to 1 (fixes `send-center.md §5.1`):** delete the inline "Add saved search" form
(`crm/[id]/page.tsx:682-700`, the sends-nothing one). The **one** SendPanel "Saved search" tab has: city
/ subdivision / price / beds / cadence (daily|weekly) + an **"email current matches now"** toggle. It
calls `createListingAlertForLead` (`lib/data/leads/listingAlerts.ts:162`) with `origin='broker'`; if the
toggle is on, `sendDeliverable(kind:'listing_matches', override:{immediateSend:true})` also emails the
current matches (suppression fail-closed). Result lands in the unified `listing_alerts` table read by the
hourly `runListingAlerts` cron (`send-center.md §5.3`).

**Read/manage:** the SubscriptionsRegion shows the lead's active alerts (criteria, active/paused,
cadence, deep link) via `getContactListingAlerts` with **pause/remove inline** (today per-contact you can
only create+delete, must leave to the hub to pause — `send-center.md §5.2`; this closes that gap using the
kept `setContactListingAlertsPaused` / `deleteSavedSearchForm`). Bulk/edit-all stays on the subscriptions
hub (Spec 04/07).

**Edge cases:** duplicate filters (same `filters_hash`) → upsert, no duplicate row (kept keying); no
email + immediate-send on → create the alert, skip the send, show "saved (no email to send matches to)";
suppressed → alert created, immediate send fail-closed with a note.
**Acceptance:** create with "email now" on → a `listing_alerts` row (`origin='broker'`) **and** a
`crm_timeline` row for the immediate send; create with it off → the alert row only, **no** email; pause
inline → `is_active=false` reflected on next read.

---

## 12. Feature: 1:1 email / SMS (conversation reply) — consumed from Spec 02

The workspace **embeds** the conversation thread + `SmsComposer`/`EmailComposer` (kept canonical
composers). This spec does not re-implement them; it requires:
- The composer uses the §4.2 optimistic+idempotent primitive (the RC2 fix for the owner's "text hangs, I
  send multiple").
- A **group** conversation (participants > 1, §4.1) renders visibly as a group and the reply targets **all
  participants** — no silent spouse/co-buyer drop (RC1). The workspace surfaces the group-ness in the
  thread header.
- A reply to a thread whose participant is a **raw phone that later resolves to a contact** stays on the
  same conversation (Spec 02's participant model handles the promotion) — the workspace just re-renders
  the now-named participant.

**Edge/compliance for SMS:** quiet-hours + A2P + suppression fail-closed (kept chain,
`app/actions/crm.ts:732-938`); over-quiet-hours → `errorKind:'quiet_hours'` on the optimistic bubble with
"will send after quiet hours" or a hard block per policy (fail-closed).

---

## 13. Cross-cutting state matrix

Every mutation in this spec (build, send, subscribe, create-search, reply) obeys this matrix.

| State | Behavior |
|---|---|
| **empty** | Region shows a build/first-action affordance, never a blank. |
| **loading** | Shell + SendPanel chrome paint instantly (streamed §5); regions fill via Suspense fallbacks (Skeleton). |
| **populated** | Cached read; tagged (`person:{id}:*`). |
| **pending/optimistic** | The changed entity renders immediately in a "pending" style; input disabled+cleared (§4.2). |
| **success** | Optimistic row patched from the action's returned entity; **no page refresh**. |
| **partial** | Multi-recipient (group) send where some recipients suppressed → sent-to-eligible, per-recipient status shown; never silently dropped. |
| **error** | Optimistic row marked failed with `errorKind` reason + Retry (same idempotency key). |
| **offline** | The optimistic row stays "pending, will retry"; the mutation queues; on reconnect it replays with its idempotency key (no double-send). |
| **permission-denied** | Guard returns `auth`; the control isn't rendered (nav+action agree, §4.4) — no dead-end. |
| **over-limit** | PDF > 25 MB or send-cap → `over_limit` reason + link-share fallback. |

---

## 14. Error handling & compliance

- **Suppression (all sends):** fail-closed inside every kept lib (verified CMA/BPO/report/newsletter/
  matches, `send-center.md §9`). The workspace additionally shows a **pre-flight** suppression badge so
  the block is never a surprise. No in-UI override.
- **Quiet hours + A2P (SMS only):** the kept SMS chain (`crm.ts:732-938`) gates any SMS-delivered CMA/BPO
  link or 1:1 text; returns `quiet_hours`/`a2p` reasons mapped to the bubble.
- **Auth (§4.4):** `sendDeliverable`, `buildDeliverable`, and every subscription write call
  `requireCrmAccess` + `requirePersonInScope` **in-body** — they are POST endpoints independent of the
  layout gate. A `ci:admin-authz`-style gate (Spec 01) fails the build if a mutating action here skips the
  guard.
- **Data accuracy (§C4/§0):** CMA/BPO numbers are snapshotted and reviewed inline once before send; the
  send attaches a verification trace (source rows for the value range) per §0 enforcement. No number in
  the workspace (open/click, delivery state) is rendered unless it traces to a live writer (§4.5); a
  metric with no writer is **not shown**, never `$0`/fabricated (RC6).
- **Draft-first (§0.5):** newsletter send refuses drafts; CMA/BPO require the inline review before send.

---

## 15. Responsive behavior (one tree)

- **Mobile-first authoring.** The default layout *is* the phone layout: single scroll column, Identity +
  sticky Send first, SendPanel as a bottom sheet. Everything in §7–§11 works at 375 px.
- **Progressive enhancement, same tree.** At ≥ `md`, a container query promotes the layout to a
  two/three-column grid (Send rail beside Conversation; Timeline/Homes/Subscriptions below). No component
  is swapped; no `md:hidden` twin; `mobile-detail.tsx` is deleted (RC3).
- **What's desktop-only enhancement (not a fork):** the swap-comps table can show more columns; the
  timeline can show a wider two-pane view. These are CSS/columns of the same components, degradable to the
  phone stack.

---

## 16. Performance

- **Streamed shell + Suspense regions** (§5); the slowest region never blocks first paint. Replaces the
  `force-dynamic` 40–55-query blocking fan-out.
- **Cached, tagged reads;** mutations invalidate only their tag; **no `router.refresh()` / `revalidatePath`
  on send** (§4.2/§4.6) — the universal re-render tax that drove "slow after every tap" is gone.
- **Async builds** never occupy a request; the UI polls a cheap indexed `build_state`.
- **Half the render/JS cost** by deleting the mobile twin (one tree renders, not two — RC3).
- **Idempotency indexes** (`crm_send_idempotency` PK, `cmas_build_idem_uidx`) make dedupe checks O(1).

---

## 17. Acceptance criteria (round-trip proven, §8 of the architecture)

Global (in addition to per-feature §7.5/§8/§9/§10/§11 lists):
- [ ] **Writer→store→reader proven for each kind:** each of cma/bpo/market_report/newsletter/
      listing_matches produces its expected store row (`crm_timeline` + kind-specific table) and the
      workspace reflects it **from the action return value**, verified with the network tab showing **no
      full-page navigation** on send.
- [ ] **No double-send under any of:** double-tap, retry-after-error, offline-replay, two-tab submit —
      each yields exactly one delivered artifact (idempotency ledger + unique indexes).
- [ ] **Mobile parity:** every send type in this spec is reachable and completable on a phone; the audit's
      "send domain is desktop-only" (`§7`) no longer holds.
- [ ] **Fetch rebuild:** the person route is not `force-dynamic`; identity core paints before the slow
      regions; the retired `cma_deliveries`/`visitor_sessions` drill is gone; total blocking queries for
      first paint ≤ 3.
- [ ] **Success-flow budget:** finalized CMA ≤ 1 tap to send; new CMA ≤ 2 taps + one inline review; 0
      cross-page loads; no synchronous wait beyond the request budget (the §6 litmus test is met and
      demonstrable end-to-end).
- [ ] **Dead-ends gone:** no token-less `/cma-drafts/[id]` link; no Review button gated on NULL
      `preview_url`; a no-email lead gets an inline add-email affordance, not a silent failure.

---

## 18. Cross-spec dependencies (seams to reconcile)

- **Spec 01 (Foundation):** the optimistic/idempotent client primitive (§4.2), the `requireAdmin`/
  capability gate + `ci:admin-authz` (§4.4), the responsive shell + killed public-chrome bundle, and the
  auth-preserved deep-link that lands `?intent=` here.
- **Spec 02 (Inbox + conversation/`message` model, §4.1):** the embedded thread + composers; the
  `message.idempotency_key` contract must match this spec's `crm_send_idempotency` key contract (same
  client-generated uuid shape) so chat and deliverable sends share one mental model.
- **Spec 04 (Metric layer, §4.5):** the open/click and delivery-state numbers the workspace renders.
- **Spec 07 (Delete pass):** owns removing the cross-domain legacy CMA API routes / `cma-drafts` /
  `lib/cma-delivery.ts` and the redirect stubs; this spec removes only their person-page wiring.

---

## 19. Open questions for Matt

1. **Subscription storage consolidation.** This spec unifies the *write surfaces* (one control per
   concept) but leaves the four subscription tables physically separate (`newsletter_subscribers`,
   `crm_report_subscriptions`, `listing_alerts`, sequences). Physically merging them is a large, risky
   migration with low loop-value for a 3-broker shop. **Leave them separate (recommended), or is a single
   `crm_subscriptions` table worth the migration?**
2. **CMA auto-approve for pre-built docs.** For a CMA the seller-LP cron already built and *you* trust
   (deterministic pipeline), do you want a "send without re-reviewing" fast path (true 1-tap), or must
   every CMA get the one-glance inline review before it leaves? (Compliance-safe default: always review;
   your call whether trusted pre-builds may skip it.)
3. **Concurrent-send hard lock.** Two brokers can each send the same finalized CMA to the same lead (two
   distinct idempotency keys). The UI shows "sent by X" the instant the first lands, which is enough for a
   3-broker shop. **Acceptable, or do you want a hard per-(person,deliverable) send lock?**
4. **SMS-delivered CMA under quiet hours.** When a broker texts a CMA link during quiet hours, do you want
   a **hard block** ("can't text until 8am") or a **queue-and-send-later** with a visible "will send at
   8am" state? (Both are fail-closed; the difference is UX.)
5. **New-lead-from-workspace.** Should the "New contact + CMA" quick-create live in the Person Workspace
   (this spec), or only on TODAY/PEOPLE with a hand-off into the workspace? (Affects where the create form
   lives; the send flow is identical either way.)
</content>
</invoke>
