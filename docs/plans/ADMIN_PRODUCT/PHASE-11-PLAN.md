# Phase 11 — finish the interior

**Written 2026-08-06** after a disk verification of what P1–P10 actually shipped.
**Status of the program:** the spine is done and correct. The interior is not.

The four locks stand. Nothing here reopens them. This plan is the work that the
locked IA implies and P9 did not finish, plus the correctness debt P4 recorded.

---

## What is genuinely complete (verified on disk 2026-08-06)

| Thing | Evidence |
|---|---|
| 11 destinations exist and render | `app/admin/(protected)/{today,messages,people,prospecting,oversight,valuations,closings,reports,audiences,content,settings}/page.tsx` |
| v2 primitives built | `components/admin/v2/` — 10 components + `tokens.css` + `admin-v2.css` |
| Mobile tab bar re-derived and shipped | Today · Messages · Prospecting · People · Oversight — confirmed in Matt's own screenshots on both new AND legacy pages |
| Token gate widened | `lint-design-tokens.js` EXCLUDED_PATHS now carries `app/admin/` + `components/admin/v2/` |
| 27 redirect bridges in place | every cut route is a 13–17 line redirect, not a live page |
| 3 new gates wired + green | `ci:admin-v2-tokens`, `ci:admin-nav-ia` (11 destinations reachable, 23 cut routes blocked), `ci:admin-contrast` (10 pairs ≥ AA both themes) |
| Litmus re-timed on production | alert → prefilled kickoff → **2 taps, no typing, ~3.5s** — better than the P8 measure |
| Real defects caught by the new surfaces | delta-sync cursor stuck on numeric overflow (class-fixed `aaacadb0`); 3 sub-AA token pairs caught by the contrast gate on its first run |

**This is a real result.** `/admin` answers "what am I supposed to do" now, and the
litmus holds on the new links. Do not re-litigate any of it.

---

## The gap, stated honestly

| Measure | Now |
|---|---|
| Admin `page.tsx` files | 168 |
| On the v2 language | **12** |
| Redirect bridges | 27 |
| **Still on the legacy language** | **129** |
| Legacy `/admin/crm/**` real pages (>25 lines) | **57** |
| Analytics/report pages behind the Reports hub | 23 |
| Raw `<h1>` in admin | 94 (was 104) |
| Raw `<button>` in admin | **12 (was 155)** |
| Distinct container widths | 21 |

P9 built each destination and pointed nav at it. It did **not** rebuild the pages
behind those destinations — by explicit design ("Reports hub v1: do NOT rebuild 34
report UIs"; Messages "templates/MMS/email-compose migrate later"; prospecting
`[kind]/[id]` "out of scope until migrated").

That was the right call for P9. It is not a finished product.

**The proof is Matt's two screenshots (2026-08-06):** `/admin/people/[id]` on v2
and `/admin/crm/[id]` on the legacy language are two person pages for the same
object, both wearing the new tab bar. `people/[id]` has one file; `crm/[id]` has
`page.tsx` + `person-view-model.ts` + `form-actions.ts` + `portal/` — the machinery
never moved.

---

## The order of work, and why

### 11A — Close the gate gap FIRST (one session)

Nothing else should start until this lands. 129 pages are about to be touched; the
gate is what makes that migration mechanical instead of producing a second
Frankenstein.

1. **`scripts/check-admin-ui.mjs`** — AST-based (TS compiler, repo convention),
   wired into `ci:gates`, documented in `docs/MECHANICAL_GATES.md`. Fails on: raw
   `<h1>/<h2>/<button>/<input>/<select>/<table>` under `app/admin`; a `page.tsx`
   that renders no v2 shell; >1 primary-variant button in a subtree; a container
   width outside the approved set.
   **Ship it as a shrink-only ratchet** seeded at today's real counts (94 h1, 12
   button, 29 input, 14 select, 21 widths). A hard cut is impossible; a ratchet
   that may only shrink is not.
2. **`@axe-core/playwright` into `e2e/full-crawl.spec.ts`** — turns WCAG 2.2 AA
   into CI failure across all 168 pages at once. Still the best ROI in the program.
3. Extend `e2e/visual-regression.spec.ts` to one page per destination.

**DoD:** both gates in `ci:gates`, `ci:gates-wired` green, baseline committed,
counts recorded here.

### 11B — Kill the second person workspace (highest daily value)

This is the surface in the screenshots and the one Matt hits from every alert.

1. Inventory what `crm/[id]` has that `people/[id]` lacks: Comms, Homes, Notes,
   the field editors, templates, MMS, email compose, `portal/`.
2. Move each onto `people/[id]` in the v2 language — or decide it belongs behind
   All-tools. Every decision cites the locked `ADMIN_UI.md` patterns.
3. Repoint the one deliberate holdout: `email-intent-note`'s suggested-reply deep
   link still targets `/admin/crm` because its composer-preload machinery lives
   there (a contract test pins it). Move the machinery, then the link.
4. `/admin/crm/[id]` becomes a redirect bridge. **Re-time the litmus after** —
   the deep-link path changes, and the bar is the acceptance test.

**DoD:** one person page. `crm/[id]` is a bridge. Litmus re-timed and still ≤3
taps / ≤30s on Matt's real phone.

### 11C — The rest of the `/admin/crm` tree (57 pages)

Order by the weekly-use evidence already locked in `decisions.md`, not
alphabetically. Inbox/messaging machinery first (weekly), sequences monitoring
next (weekly, monitoring-shaped not authoring-shaped), then the settings and
reporting residue (rare) which mostly become Settings/Reports doors.

One family per commit, browser-verified at 375 + 1280, axe clean, ratchet shrinks.

### 11D — The Reports interior (23 pages)

The hub is definition-first and correct. The 23 analytics pages behind it are
untouched. Migrate by the same rule: each report states the question it answers,
numbers are `tabular-nums`, one definition per metric (the `reporting-truth`
process already specifies this).

### 11E — Everything remaining

Whatever the ratchet still shows. By then the count is the worklist.

---

## Track 2 — the P4 correctness debt (parallel, not blocking)

`data-atlas.md` recorded ~20 broken chains (`✗`). These are not UI. Several are
compliance-adjacent and outrank cosmetics:

**Send-integrity (do these first):**
- Group MMS bypasses `sendGovernedSms` idempotency → **double-send window**.
- Block reasons outside sequences produce log lines, not queryable rows → send
  integrity is unauditable.
- Gate-drops (opt-in / no-device) recorded nowhere → alert-integrity unclaimable.

**Correctness substrate:**
- **Listing edits do not survive re-sync.** `sparkToListingRow` rebuilds `details`
  with no merge; only `media_suppressed` and finalized rows survive. A broker edit
  is silently overwritten on the next sync. Needs a sync-proof overlay.
- `assigned_broker` scatter across person/conversation/tasks/deals/alerts → one
  resolution rule needed; columns exist, semantics don't. Blocks correct scoping
  everywhere, and Matt's locked scope answer (own-book + PB full view) depends on it.
- **Signing broker — FIXED 2026-08-06 (ships in the same commit as this edit).**
  The locked directive — *"The CMA is always signed by the Lead's Assigned Broker.
  Matt is a fallback"* (Matt, restated 2026-08-06) — is now the code's behavior.
  One shared resolver: `lib/data/cma/signing-broker.ts
  resolveSigningBrokerForPerson`, wired into both broken paths:
  - `lib/cma-request.ts resolveBrokerSlug` — was `void fubPersonId` + env default.
  - `lib/cma-delivery.ts resolveAssignedBroker` — was calling the DEAD FUB API
    (always fell through to Matt); `getFubAssignedUserEmail` and the
    `getFubApiKey` import are deleted (a Track-3B win in passing).
  - `lib/bpo/build.ts` was inspected and left alone — broker-initiated, the admin
    form passes an explicit `brokerSlug`; the directive concerns lead-driven docs.
  **The load-bearing discovery:** `crm_people.assigned_broker` holds the SHORT
  slug (`matt` 18,179 · `rebecca` 124 · `paul` 71 · null 4,598 — live counts
  2026-08-06) while `brokers.slug` is the full web slug — the join is on
  `brokers.crm_slug` (migration 20260625171000). A slug-based match would have
  compiled, passed a shallow test, and silently kept signing everything as Matt.
  **Second catch:** the resolver returns `twilio_number`, never `brokers.phone` —
  activating Rebecca/Paul for the first time would otherwise have leaked their
  personal cells into client-facing CMA emails (ci:broker-published-phone class).
  Pinned by `lib/data/cma/signing-broker.test.ts` (6 tests: crm_slug join
  asserted, publishable-vs-personal phone split, both slug spaces, all three
  fallback paths). Live-verified: person 11784 (assigned `rebecca`) resolves to
  `rebecca-peterson` through the exact query path. DAL index refreshed (G16).
  **A 3-lens adversarial panel then refuted the first draft** and its catches
  are folded in: (1) the call site fed `fubPersonId` while the CRM kickoff and
  expired-cron pass only `crmPersonId` — the litmus path itself would still
  have signed Matt; now `crmPersonId ?? fubPersonId`. (2) The lead-confirmation
  email named the assigned broker in the body while signing/sending as Matt —
  now the assigned broker's mailbox signs and sends (Gmail DWD, Matt fallback),
  superseding the 2026-06-05 send-as-Matt note per the P3 lock. (3)
  `cma_deliveries.broker_imessage_to` (a reach-the-BROKER column) now gets
  `notifyPhone` (the cell), not the Twilio line. (4) E.164 renders formatted
  in client-facing signatures (`lib/cma/format-phone.ts`). (5) GA4
  `assigned_broker` user property uses the short `crmSlug` matching
  lead-tracking's typed space; the `cmas` row keeps the full slug.
  **Accepted, not changed:** delivery review now routes to Matt instead of
  erroring when unassigned (that IS the locked fallback); the pre-existing
  `fub_legacy_id` mirror-stamp ambiguity at `lib/cma-request.ts:436-444` is
  Track 3B's to retire.
- `fsbo_listings.status='off_market'`: readers exist, writers zero → exclusion
  branch dead.
- Dupe-candidate queue missing → cross-channel identity conflicts invisible.

**Measurement (feeds the litmus and the weekly cockpit):**
- No first-broker-action stamp → alert→action latency unmeasurable.
- No reply-latency interval stored per thread.
- `predicted_outcome.sla` written, never read → CMA aging invisible.

---

## Track 3 — the Follow Up Boss purge (Matt directive 2026-08-06)

> *"we do not use fub follow up boss, i have tried my damdest to remove any and all
> references to follow up boss, there should be absolutely no mention of it anywhere
> in any of our emails, codebase etc."*

FUB was decommissioned 2026-06-24. Measured footprint on 2026-08-06: **113 files**
carrying the literal string, **171 files** carrying FUB identifiers, plus DB columns.

**Three buckets. Do NOT blind-purge — bucket 3 is functional.**

### 3A — Public and legal copy (DONE 2026-08-06)

These were false statements to consumers about where their data goes. All fixed:

| File | Was |
|---|---|
| `app/privacy/page.tsx` ×3 | named FUB as a **third-party data processor** receiving contact info + browsing activity |
| `app/data-deletion/page.tsx` ×2 | told people their contact record lives in FUB, and that deleting it deletes their FUB record |
| `app/cookies/page.tsx` | named FUB as the CRM cookies associate activity with |
| `app/cma-drafts/[id]/SendCmaButton.tsx` | told the reader a note is recorded in FUB |
| `app/cma-drafts/[id]/page.tsx` | instructed the reader to "open the lead in Follow Up Boss" — a system that does not exist |

Replacement language: "our own client-relationship system," operated by Ryan Realty,
not a third party. **Matt must review the privacy / data-deletion / cookies wording —
those are legal disclosures and the edit was a factual correction, not counsel.**

### 3B — Internal identifiers and comments (open)

`fubPersonId`, `fub_person_id`, `FUB_*` env names, `lib/crm/fub-env.ts` + its test,
TODOs referencing FUB, and the `fub_*` residue columns on people/deals/tasks/alerts/
visitors. Rename to CRM-native vocabulary. Mechanical, but touches ~171 files and DB
columns — needs its own sweep with a gate at the end, not a hand pass.

**Ships with the signing fix:** `lib/cma-request.ts` is bucket 3B *and* the compliance
defect above — the parameter being discarded is literally `fubPersonId`.

### 3C — DO NOT REMOVE (functional strings)

These reference `followupboss.com` because they **filter historical FUB mail**.
Deleting the string breaks inbound email parsing. Rename the constant if you like;
leave the value:

- `lib/crm/gmail.ts:31` `BLOCKED_SENDER_DOMAINS` → `followupboss.com`
- `lib/crm/gmail.ts:64` `SELF_DOMAINS` → `followupboss.me`
- `lib/crm/portal-lead-parser.ts:53` sender filter → `team@followupboss`, `followupboss`
- `docs/archive/fub-era/**` — deliberately retained; `ci:claude-canon` enforces that
  inventory may only shrink and bans new citations. Deleting it means shrinking the
  gate's `FUB_ERA_DOCS` list in the same commit.

### 3D — The gate

Once 3A/3B land, add `ci:no-fub` — fails on any FUB reference outside the 3C
allowlist. Without it this regrows; Matt has purged it before.

---

## Loose ends (small, do them when convenient)

- **Fixture cleanup — DONE 2026-08-06.** Person 60610 verified as fixture first (no
  name, source `inbound-sms`, created 16:43; CMA stamped 16:59:41 matching the litmus
  log), then deleted with the full row set: 1 action, 1 CMA, 1 idempotency key, 2
  alerts, 1 task, 1 conversation, 1 conversation state, 1 contact point, 6 timeline
  rows, the person, and both `cma-fixture-*@ryan-realty.com` auth users.
  **Zero residue verified.** July fixture 57531 was already gone.
- **`task_cb8a89a8`** — compiler `q` node emits unparseable PostgREST `or()` casts.
  Routed around in `searchCrmPeople`, not fixed.
- **Flaky `check-toast-read-discipline.test.mjs`** — 5s timeout against siblings
  that run 4.9s and 6.3s. It killed a commit during this program already. Fix
  before any long unattended grind.
- **RC1 residue:** one person can show multiple conversation rows in Messages
  (inherited from `getInboxFolderQueue`, not new).
- **Working tree:** 3 modified files (`design-audit` capture manifest + script,
  `voice-canon-state.json`) and 4 untracked audit scripts
  (`_responsive-audit.mjs`, `_uiux-geo-audit`, `_uiux-live-audit`,
  `uiux-trust-audit.mjs`). Commit or delete — do not carry them into 11A.
- **Public site header on admin — DECIDED 2026-08-06 (Matt: "it should absolutely
  be rebuilt for 11").** The wordmark/hamburger/search bar visible above the admin
  UI in both phone screenshots is chrome leak, not design. It spends ~15% of the
  viewport on branding the operator does not need. Remove it from the admin shell
  as part of 11B, and confirm no admin route renders public site chrome.

---

## Work-queue seed (apply to `work-queue.json` when 11A starts)

```json
[
  { "id": "11a-gates",            "phase": "P11", "note": "check-admin-ui.mjs (AST, shrink-only ratchet seeded at 94 h1 / 12 button / 29 input / 14 select / 21 widths) + @axe-core/playwright in full-crawl + visual-regression per destination. Wire into ci:gates; gates-wired green." },
  { "id": "11b-person-workspace", "phase": "P11", "note": "Fold crm/[id] machinery (Comms, Homes, Notes, field editors, templates, MMS, email compose, portal) into people/[id] on v2; move email-intent-note composer preload; crm/[id] becomes a bridge; RE-TIME THE LITMUS after." },
  { "id": "11c-crm-tree",         "phase": "P11", "note": "57 remaining /admin/crm pages, ordered by the weekly-use evidence in decisions.md. One family per commit." },
  { "id": "11d-reports-interior", "phase": "P11", "note": "23 analytics/report pages behind the definition-first hub." },
  { "id": "11e-remainder",        "phase": "P11", "note": "Whatever the ratchet still shows." },
  { "id": "12-send-integrity",    "phase": "P12", "note": "Group MMS chokepoint, block-reason ledger, gate-drop record. Compliance-adjacent — may run parallel to P11." },
  { "id": "12-correctness",       "phase": "P12", "note": "Listing-edit sync overlay, assigned_broker resolution rule, signing-broker directive verification, fsbo off_market writer, dupe-candidate queue." },
  { "id": "12-measurement",       "phase": "P12", "note": "first-broker-action stamp, reply-latency interval, CMA SLA reader." }
]
```

---

## The rule that still applies

Amnesia is not over. The 129 legacy pages are **evidence of what the software
does**, never a template for what it should look like or be called. Every
migrated page cites the locked `design_system/admin/ADMIN_UI.md`, and the
`ci:admin-nav-ia` gate already blocks any cut route from returning to nav.
