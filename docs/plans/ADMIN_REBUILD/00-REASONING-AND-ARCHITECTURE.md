# Ryan Realty Admin + CRM — Ground-Up Rebuild

## Part 0 · Reasoning and Target Architecture

> Read this before any spec, and any spec before any code. This document derives
> the rebuild from first principles: the real constraints, the root causes that
> generate the symptoms, and the architecture those constraints force. The
> per-feature specs in `specs/` are downstream of the decisions locked here.

Source of evidence: a 12-domain, evidence-backed audit of the live tree at commit
`d3dd457a` (2026-07-16). 252 features assessed; 24 critical + 53 high defects, each
with `file:line`. Raw reports: `../../../<scratchpad>/audit/*.md` (mirrored into
`audit-reports/` in this folder). Nothing below is asserted from memory.

---

## 1. The real constraints (what has to be true here)

Before proposing anything, five facts about *this* business that the current admin
ignores. Every architectural decision traces back to one of these.

**C1 — This is a 3-broker brokerage, not an enterprise sales org.** The entire
admin serves at most five humans (Matt as superuser + two brokers, plus
report-only). The live system is a 150-page, 664-server-action, 199-API-handler,
56-nav-item "faithful the in-house CRM clone." The complexity is wildly
disproportionate to the operator count. Enterprise CRMs carry that surface to serve
thousands of seats with dozens of roles; here it is pure cost — to build, to load,
to navigate, to trust. **The right size is small.**

**C2 — The job is a loop, not a set of pages.** Everything a broker does in the
admin is in service of one cycle:

```
        a lead arrives
             │
             ▼
   the broker is notified  ──────────►  the broker responds        the deal is
   (phone, right now)                    (text / email / call)      tracked to close
             ▲                                   │                        ▲
             │                                   ▼                        │
        outcome measured  ◄──────  the broker sends a deliverable  ───────┘
                                   (CMA · BPO · newsletter · saved search)
```

The current admin is organized by **data source and feature silo** (Analytics vs
Reports vs CRM-reporting; CMA-builder vs CMA-send vs CMA-subscription), not by this
loop. That mismatch is why doing one job crosses many pages.

**C3 — Real estate is field work; the phone is the primary surface for the
response half of the loop.** The broker gets "this lead wants a CMA" while standing
in a driveway. The current admin is desktop-first and bolts on a *thinner, lossy*
mobile fork — so the single most time-critical, highest-frequency job (respond +
send a deliverable) is crippled on the exact device where it happens. This is
backwards.

**C4 — Every number is a compliance artifact.** Matt is a licensed principal
broker. A wrong stat on a dashboard, an email, or a CMA is not a UX blemish — it is
a license risk (CLAUDE.md §0, non-negotiable). So "six definitions of *new leads*,"
"$0 team volume from a dropped table," and "permanently-broken cost-per-lead" are
not analytics debt; they are **integrity failures** that must be impossible by
construction, not merely fixed once.

**C5 — Messages carry money and legal exposure.** Every SMS costs money and sits
under TCPA. A double-send is not a glitch; it is a compliance and trust event. So
**send integrity** (idempotency, unmistakable feedback, delivery visibility) is a
hard requirement, not a nicety.

---

## 2. Root-cause analysis — why ~250 symptoms exist

The audit surfaced 24 critical and 53 high defects plus scores of duplications and
dead surfaces. They are not 250 independent bugs. They are the **emanations of
seven structural decisions.** Fix the seven and the symptom classes collapse. This
is the whole point of "find the root cause, not the symptom."

### RC1 — There is no conversation entity. A "conversation" is `person_id`.

`crm_timeline` stores every message/call/note as a per-person row; the "thread" is
just "all rows for person X" (`getContactActivityFeed.ts`; messaging report §1:
*"There is no thread/conversation entity."*). Group threads, multi-channel threads,
and multiple phone numbers all **collapse onto the person.**

This single modeling choice generates, directly:
- The owner's stated **#1 confusion** — "I can't tell if a message is a group or a
  single person." A group text renders pixel-identically to a 1:1 in all four
  renderers because `payload.groupTo`/`groupMembers` is read by **zero** UI
  components (`crm-messaging.md §4`).
- **Silent participant drops:** replying from the inbox to a group thread sends a
  private 1:1 and drops the spouse/co-buyer, with no warning (`InlineReply.tsx`).
- **Inbox heaviness:** with no thread aggregate, the inbox re-scans the newest
  2,000 timeline rows (~1.4 MB of bodies) on every folder switch, open, and refresh
  (`getInboxQueue.ts`; perf report crit #2).
- Delivery receipts attaching to only 2 of 5 send paths because each path invents
  its own SID key in an unstructured `payload` blob (`twilioSid` vs `sid` vs
  `messageSid`) — there is no message row schema to enforce a shape.

### RC2 — No optimistic/idempotent interaction layer; every mutation is a full server round-trip under `force-dynamic`.

There is no `useFormStatus`/`useTransition`/`useOptimistic` in the composers
(only `NextStepCard` uses pending state anywhere). Sends are bare `<form action>`
posts that serially await Twilio + ~10 DB reads + a full re-render of the heaviest
page, with the sent text left in a controlled textarea that survives the redirect.
Mutations universally signal completion via `router.refresh()`, which re-runs the
entire page fan-out (perf report high #2).

This generates the owner's stated **SMS pain in full** — "it hangs, I send
multiple":
- Nothing changes on screen for 2–6 s → looks hung.
- Button stays enabled, text stays in the box, no idempotency key → a second tap is
  a second *delivered* message (`crm-messaging.md §2`).
- And a large share of *perceived slowness admin-wide*, because every tap anywhere
  re-renders the whole page.

### RC3 — Desktop and mobile are two separate products, CSS-toggled, both server-rendered every request.

27 mobile components duplicate the desktop trees; the switch is a pure `md:` CSS
breakpoint between unrelated component trees, both mounted and both server-rendered
(`crm-people.md §mobile`; perf report dup #3).

This generates:
- The **"behaves completely differently on mobile vs desktop"** complaint,
  verbatim — because they are literally different code with divergent behavior
  (name-edit is mobile-only; CMA/BPO/newsletter/saved-search are desktop-only; the
  desktop list has no search box while mobile does; five mobile mutation wrappers
  swallow errors silently).
- The **mobile broker cannot do the #1 job**: the entire send domain
  (CMA/BPO/report/newsletter/saved-search) is absent on mobile
  (`send-center.md crit #2`).
- **Doubled server cost and doubled JS** on every route (both trees render), a
  direct, quantified contributor to slowness.

### RC4 — Build-by-accretion with no consolidation gate; no single source of truth per concept.

Every feature added new routes/actions/components instead of extending existing
ones. The measurable residue: 150 pages, 664 actions, 199 handlers, ~24 dead
routes, 17 redirect stubs, 8 coexisting navigation systems, **6 definitions of "new
leads,"** 4 CMA build paths / 6 send paths, 3 near-identical approval surfaces, 3
commission stores, 4 subscription models, market-report subscription editable in 3
controls on one page.

This generates the **"bloated / duplicated / confusing"** complaint and the deeper
**trust collapse**: different pages show different numbers for the same metric
because they read different tables with different filters (`analytics-reporting.md`
headline). Entropy with no gate to stop the next duplicate.

### RC5 — Authorization truth is scattered across three disagreeing layers.

Access rules live in (a) nav conditionals, (b) 8 copy-pasted gate layouts, and (c)
per-page checks, with nothing keeping them aligned (`shell-ia.md dup #1`).

This generates:
- **6 classes of broker dead-ends** — the nav shows an item, the page denies it
  ("this account does not have admin access"). A broker literally cannot open an
  expired-listing detail linked from the dashboard they are told to work.
- The **security criticals**: because the `(protected)` layout only gates *page
  rendering*, server actions and service-role read functions compiled to POST
  endpoints carry **no in-body auth** — an unauthenticated stored-XSS/defacement
  path onto `ryan-realty.com` (blog/guides/site-pages/branding writers) and
  unauthenticated service-role reads of TC deal documents (`content-geo-media.md
  crit #1`, `deals-tc.md high #1`, `api-surface.md crit #1`).

### RC6 — Placebo surfaces: UIs wired to nothing, or to the wrong source of truth.

A recurring pattern of features that *look* functional but aren't wired end to end:
listing-editor edits silently reverted by the next MLS sync; site-pages HTML no
page consumes; **7 of 9 automation triggers never fire**; pond routing silently
assigns every lead to Matt; a `geo_places` table with zero consumers; 5 placebo
notification toggles; `broker_stats` reads a table dropped in April and renders "$0
team volume" as fact; viewing-history reads a table nothing writes; a fully-built
TC e-sign apparatus with **0 envelopes ever sent**.

This generates the deepest form of "unusable": the broker configures things that
don't do anything, sees numbers that are fabricated, and correctly stops trusting
the tool. A **verification** failure — features shipped without proving the
writer→store→reader→outcome round trip.

### RC7 — The consumer funnel is severed at every seam.

Signed-in users cannot reach their account from the site chrome (the account-menu
component has **zero importers**; the header always says "Sign in"); the
save→sign-in→resume flow is broken in all three variants (nothing consumes the
return params, the intended save never happens); seven parallel "homes I care
about" stores; viewing-history reads a table nothing writes; and the strongest
buyer signal collected — **saved homes** — never reaches the broker CRM at all
(`consumer-account.md` headline).

This generates the owner's "when a user logs in and tries to save searches/homes
it's confusing" — *and* it starves the response loop (C2) of the buyer-intent data
that should drive it. The one healthy spine is the unified `listing_alerts`
pipeline (guest + signed-in + broker rows in one table, hourly send cron with
seen-set diff and compliance gates, read by both the account page and the broker
CRM). It is the model everything else should follow.

---

### The collapse, in one table

| Owner complaint (verbatim) | Root cause | 
|---|---|
| "text hangs, I send multiple" | RC2 (no optimistic/idempotent send) |
| "can't tell group vs single message" | RC1 (no conversation entity) |
| "behaves completely differently on mobile vs desktop" | RC3 (forked trees) |
| "send a CMA is almost impossible" | RC2 + RC3 + RC4 (no single send flow, absent on mobile, 6 paths) |
| "bloated, duplicated, confusing menus" | RC4 (accretion) + RC5 (nav ≠ access) |
| "slow to load" | RC2 (full re-render per tap) + RC3 (double trees) + RC4 (uncached fan-out) |
| "many features duplicated" | RC4 (no source of truth per concept) |
| "user save-search/save-home confusing" | RC7 (severed funnel) |
| (compliance exposure, not yet felt) | RC5 (no in-body auth) + RC6 (fake numbers) |

Seven decisions. Fix them structurally and the 250 symptoms lose their generator.

---

## 3. What the audit proves is SOLID — and must be kept

A ground-up rebuild of the *surfaces* is not a rewrite of the *core*. The audit is
explicit that the compliance-critical server core is correct and hard-won. Throwing
it away would re-introduce legal risk. **Keep and build on:**

- **The SMS/email compliance chain** — quiet hours, suppression chokepoint
  (fail-closed on every live send), A2P fail-closed gate, signature-validated
  webhooks, forward-only delivery-state reconcile, merge-token fail-closed refusal,
  dedupe keys (`app/actions/crm.ts:732-938`, `lib/crm/*`).
- **`buildCrmPeopleQuery`** — the single AST→SQL compiler with broker scope clamped
  *inside* it. The RBAC posture on reads/writes is consistent and correct.
- **The bulk-job framework** — preflight counts, suppression estimates, chunked
  worker, progress poller, view-scoped audiences.
- **The CMA/BPO send libs** — `lib/cma/send.ts` `sendCmaToLead` and
  `lib/bpo/send.ts` `sendBpoToLead`: Gmail-DWD-with-Resend-fallback, suppression
  fail-closed, attribution + open/click tracking, timeline logging. *Keep the
  libs; kill the redundant surfaces on top.*
- **The `listing_alerts` pipeline** — unified guest/signed-in/broker table,
  keyed `(email, filters_hash)`, unsubscribe token, resurrection guard, hourly send
  cron with seen-set diff and compliance gates. The model for the whole funnel.
- **The sequence-engine cron** — production-grade executor: suppression-gated,
  at-most-once send claims, A2P-aware, quiet hours. (The *authoring UI* over it lies
  about what it can do — that is RC6 — but the executor is sound.)
- **`isAuthorizedCron`** fail-closed pattern — the template for the one auth
  primitive below.

The rebuild is: **keep the correct engine, replace the interaction model, the data
model for conversations, the IA, and the render architecture, and delete the
accretion.**

---

## 4. Target architecture — derived, not pattern-matched

Each decision below is forced by a constraint (C#) and kills a root cause (RC#).

### 4.1 A first-class Conversation model  · kills RC1

Introduce the entity that was missing. A **conversation** is channel-agnostic and
participant-aware:

```
conversation            (id, subject?, channel_set, last_message_at, state, assigned_broker)
conversation_participant (conversation_id, person_id | raw_phone, role)   -- 1..N
message                  (id, conversation_id, direction, channel, body,
                          provider_sid, delivery_state, media[], sent_by, created_at,
                          idempotency_key)     -- ONE typed row shape, not a payload blob
```

- **Group vs 1:1 becomes a rendered property of `count(participants)`** — it is now
  *impossible* to confuse them, and a reply targets the conversation's full
  participant set by construction (no silent drops).
- **One typed `message` row shape** ends the SID-key fragmentation → delivery
  receipts attach on *every* path (webhook matches `provider_sid`, always present).
- The inbox lists `conversation` rows ordered by `last_message_at` (cheap, indexed),
  not a 2,000-row timeline rescan. Opening a conversation pages its `message` rows
  with a cursor.
- Migration is additive and back-compatible: `crm_timeline` remains the immutable
  activity ledger (notes, events, calls); messages get promoted into
  `conversation`/`message` with a backfill keyed by person + phone-pair + time
  window. Non-message timeline kinds are untouched.

This is the load-bearing schema change. Everything in messaging and the send loop
sits on it.

### 4.2 Optimistic + idempotent mutation layer · kills RC2, most of "slow"

One client mutation primitive and one server contract, used by **every** action:

- **Client:** on submit, generate an `idempotency_key` (uuid), render the result
  **optimistically** (the message bubble appears instantly in "sending" state),
  disable+clear the input via `useOptimistic`/`useTransition`. On resolve, patch the
  real row in; on error, mark the optimistic row failed with a Retry affordance.
- **Server:** every send accepts and persists the `idempotency_key`; a duplicate key
  is a no-op that returns the original result. Actions **return the changed entity**
  (the new message, the updated tag) — they do **not** `revalidatePath` the whole
  page. The client patches local state from the return value.
- **Delivery status streams back** via the existing webhook → `message.delivery_state`
  → a lightweight subscription/poll on the open conversation only (not a full-page
  refetch).

Result: the send is instant-feeling and *cannot* double-send; and the universal
`router.refresh()` tax disappears — mutations stop re-running page fan-outs.

### 4.3 One responsive component tree, mobile-first for the loop · kills RC3, halves render cost

Delete the mobile fork. Each surface is **one** component that adapts by container
query / CSS, authored **mobile-first** for the response loop (C3). No `md:hidden`
twin trees, no 27 parallel mobile components, no double server render, no double
JS bundle. Where desktop genuinely affords more (multi-column pipeline board), it is
*progressive enhancement of the same tree*, not a second tree.

This is also the single biggest bundle + server-cost win: every CRM route stops
rendering and shipping two products.

### 4.4 One authorization primitive, one capability map · kills RC5

- A single `requireAdmin(capability)` guard called **in-body** by every server
  action and every route handler (defense in depth — the layout gate is not enough
  because actions are independently-invocable POSTs). Service-role reads of
  sensitive data (TC docs, blog writes) get the same guard.
- **The nav is generated from the same capability map** the guard enforces. If a
  role lacks a capability, the item is not rendered *and* the action refuses — they
  cannot disagree, so dead-ends become structurally impossible.
- Add a mechanical gate (`ci:admin-authz`) that fails the build if a server action
  under `app/actions/**` mutates without calling the guard — the repo's own
  enforcement-over-prose doctrine (CLAUDE.md "gates not prose").

### 4.5 One metric layer, one definition per number · kills C4 integrity failures, RC4 in analytics

Every metric resolves through a single DAL function with one definition. "New
leads" = `getLeadIntake` (inbound, from `crm_people`), full stop — the other five
definitions are deleted, not reconciled. Dashboards read the metric layer; they do
not hand-roll queries. A metric with no live writer (the dead FUB plane,
`broker_stats`) is **removed from the UI**, never rendered as `$0`. This makes C4
true by construction: a number on a screen traces to exactly one definition, or it
is not shown.

### 4.6 Render architecture: cached DAL + streaming, not force-dynamic fan-out · kills "slow"

- **Cache reads.** Reference/aggregate reads (`getCrmSavedViews` counts, stage
  counts, sequence counts, dashboards) go through `unstable_cache` with tags; a
  mutation invalidates only its tags. The 40-count + 35-count fan-outs on the
  contacts list become cached lookups, not 90 live queries per keystroke.
- **Stream the shell, suspend the data.** Every hot page renders its chrome
  instantly and wraps each data region in `<Suspense>`; the slowest query stops
  blocking first paint. (Today: 3 `loading.tsx` for 150 pages, no streaming.)
- **Drop count fan-outs from the hot path.** Saved-view badge counts move to a
  cached, on-demand endpoint (loaded lazily), not 40 synchronous `count(*)` over
  22,865 rows on every render.
- **Kill the public-site chrome/tracking bundle on admin routes** (SiteHeader,
  VisitTracker, GTM, InstallPrompt no-op at runtime but ship and execute).
- **Code-split** the heavy islands (recharts, dnd-kit, PDF signer) behind
  `next/dynamic`.

### 4.7 One canonical surface per concept; delete the accretion · kills RC4

For every concept, exactly one route + one action + one component, enforced going
forward by a "no duplicate capability" review gate:
- Conversations: one Inbox. Sends: one composer (already the right idea — keep
  `SmsComposer`/`EmailComposer`, add the pending/reset/idempotency semantics).
- CMA: one build path, one send path (from the person workspace), the six entry
  points collapse to one. Same for BPO, newsletter, market-report subscription,
  saved-search-on-behalf.
- Approvals: one queue with typed sub-streams (marketing / enrollment / sign-off),
  not three routes.
- Delete the 24 dead routes, 17 redirect stubs, 7 dead action files, the placebo
  surfaces (RC6) — either wire them end-to-end or remove them.

### 4.8 The consumer funnel shares the CRM's buyer-signal spine · kills RC7

- One account menu in the chrome (session-aware), one save→sign-in→resume flow that
  actually replays the intended save.
- Consolidate the 7 "homes I care about" stores to the `listing_alerts` model +
  one `saved_listings` store, canonically keyed.
- **Saved homes/searches flow into the CRM person as intent signal** — the broker's
  response loop (C2) is fed by the strongest buyer signal, closing the seam.

---

## 5. The target information architecture (core-loop-first)

Organized by the loop (C2), not by data source. Superuser sees all; broker sees the
operating set; the nav is generated from the capability map (§4.4) so nothing shown
ever dead-ends.

```
TODAY            the triage surface — new leads · unread conversations · tasks due · approvals
INBOX            all conversations, channel-unified, group-aware (one surface, mobile-first)
PEOPLE           contacts + pipeline (one list, one board)
  └─ PERSON      the workspace: respond + send CMA/BPO/newsletter/search in ONE place, in seconds
TRANSACTIONS     contract-to-close (one deal system, signing, commissions, financials)
PERFORMANCE      one hub, one number per metric (leads · spend/CPL · funnel · SEO · social)
CONTENT          listings · site pages · media · blog (what actually ships to the public site)
SETTINGS         one place — brokers · routing · templates · automations · suppression · account
```

Eight destinations, not 56. Everything else is a tab or a section inside one of
these, reached in one hop. The person workspace is the center of gravity because it
is where the loop's response half lives — and it is designed **phone-first** so the
"lead wants a CMA in the driveway" job is seconds, not a 10-click cross-page chase.

The **notification → action** path (C2's top edge) is a first-class flow, not a
seam: a broker-facing alert ("New lead · wants a CMA") deep-links straight into the
person workspace with the destination preserved through auth (fixing the
lost-`next` and no-account-menu defects), landing one tap from Send.

---

## 6. The one flow that defines success

The owner's litmus test — "a lead wants a CMA, I need to send it in seconds." Target
flow, phone-first, optimistic:

```
1. Broker taps the alert (SMS/push/email)  →  deep-link, session preserved
2. Lands on the PERSON WORKSPACE, already scrolled to Send
3. Taps "Send CMA"  →  comps pre-selected from the lead's saved search / subject area
                       (broker can swap comps, but a good default is one tap away)
4. Taps Send  →  optimistic "sending" state instantly; build runs server-side;
                 delivery + open tracked; timeline logged
5. Done.  ~2–3 taps, one screen, seconds.
```

Every architectural decision above exists to make this flow real: the conversation
model (RC1) so the reply context is right, the optimistic layer (RC2) so it feels
instant and can't double-fire, the single responsive tree (RC3) so it works on the
phone, the single send path (RC4) so there's one obvious button, the preserved-`next`
auth (RC5) so the deep link lands.

---

## 7. Sequencing (how the rebuild rolls without a big-bang outage)

Specs are written for all features regardless of order; build order is risk-first:

1. **Foundation** — the auth primitive + capability map + nav generation (RC5);
   the optimistic/idempotent mutation primitive (RC2); the responsive shell (RC3);
   kill the public-chrome bundle on admin (perf).
2. **The conversation model + Inbox + composer** — RC1 + RC2 on the owner's #1 pain.
   Additive migration; `crm_timeline` stays intact.
3. **The person workspace + one send path** — the success flow of §6 (CMA/BPO/
   newsletter/saved-search), mobile-first.
4. **Metric layer consolidation** — one definition per number; delete dead planes.
5. **Transactions / TC** — reconcile the three deal systems; wire or remove e-sign.
6. **Consumer funnel** — account menu, save→resume, store consolidation, intent→CRM.
7. **Delete pass** — dead routes, redirect stubs, placebo surfaces, duplicate paths;
   land the mechanical gates that prevent regrowth.

Each step is shippable and observable on its own; nothing requires a flag-day.

---

## 8. What "done" means (so RC6 can't recur)

A feature is not done when it renders. It is done when the **round trip is proven**:
writer → store → reader → user-visible outcome, with an acceptance test that
exercises it end to end (the repo's `verify` discipline). Every per-feature spec in
`specs/` carries explicit acceptance criteria of that shape, plus its edge cases and
error states. No placebo ships.

---

*Next: the per-feature end-to-end specifications in `specs/`, each derived from this
architecture and its domain's audit report.*
