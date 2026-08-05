# Admin Product OS — decisions (append-only)

This file is the ONLY place a lock counts. Chat approval without a line here is not a
lock. `ADMIN_REBUILD/PHASE-0-ANSWERS.md` is input evidence only, never a lock source
(pack rule "One lock location", 2026-08-04).

## Lock status

- Process lock (P3): **GRANTED 2026-08-04** — see "P3 PROCESS LOCK PACKAGE — LOCKED"
- IA lock (P5): **GRANTED 2026-08-05** — see "P5 IA LOCK" below
- Visual lock (P6): **GRANTED 2026-08-05** — see "P6 VISUAL LOCK" below
- Litmus sign-off (P8): **GRANTED 2026-08-05** — see "P8 LITMUS SIGN-OFF" below

---

## 2026-08-04 — Memory root decision (Matt)

`docs/plans/ADMIN_PRODUCT/` is the greenfield memory root, separate from the superseded
`ADMIN_REBUILD` package. BOOT registered the `ADMIN_PRODUCT/` package row in
`docs/DEVELOPMENT_PROCESS.md` in the same commit that created this directory (G44).

## 2026-08-04 — Deepen-order decision (Matt)

Locked order for the P2 queue:

`broker-alert → inbound-respond → cma-deliver → prospecting → suppression-guard → other daily → weekly/rare`

Prospecting moves up to right after `cma-deliver`: Matt named it a weekly core job
("what expired → send audits; new FSBOs → send CMAs"), it currently sprawls across 5
destinations, and `cma-deliver` feeds it (FSBOs get sent a CMA).

## 2026-08-04 — Phase-0 answers (Matt; copied from ADMIN_REBUILD/PHASE-0-ANSWERS.md as EVIDENCE, not locks)

**Q1 — Notifications that wake him:** seller/valuation request (the LITMUS path, ≤3 taps
/ ≤30s broker-action), any new lead from any source, and a reply on an existing thread.
Supervision alerts ("something failed or is overdue") do NOT wake him — he wants the
supervision view, not the interrupt. The wake-up set is all inbound and human.

**Q2 — Weekly vs never:** Weekly = Inbox/messages, Sequences (monitoring only — "checking
they ran / didn't break"), and Prospecting (written in by Matt: "seeing what listings
expired and sending them audits, seeing any new fsbos and sending them cmas"). NOT
weekly = People list, Deals, Tasks. Disk evidence 2026-08-04: People = 22,951 contacts
across 21 surfaces; Deals = ~21 rows across 6 surfaces split over two stores (corrects
FULL-AUDIT-2026-08-03 §0 on the console redirects); Tasks = ~590 rows, one surface;
Prospecting spans 5 destinations; the shipped mobile tab bar gives 2 of 5 tabs to
non-weekly surfaces and 0 to prospecting. None of this is a verdict — KEEP/MERGE/KILL
is P3.

**Q3 — Phone must-haves:** all four. Reply to a text or email with thread history above
the composer; pull up a person + history; log a call or note after a showing; approve a
draft before it sends. Phone is a full product, not a thin surface.

**Q4 — Broker scope:** own book by default, full view for Matt as principal broker.
Known bug class: `assigned_broker` is scattered across people, conversation, tasks,
deals, alerts (6 classes of role dead-end in the RBAC audit).

**Q5 — Alert SMS path:** resolved on disk — Twilio serverless via
`app/api/cron/crm-alert-drain/route.ts`, gated on `CRM_SMS_ALERTS === 'twilio'`.
**BOOT runtime check performed 2026-08-04:** production Vercel env has
`CRM_SMS_ALERTS="twilio"` (verified via `vercel env pull --environment=production`).
Alerts do not fall through to the retired mac-mini relay.

**Q6 (process marks) and Q7 (IA lock): deliberately unanswered.** They are P3 and P5
decisions and must not be pre-locked before the processes are deepened.

---

## 2026-08-04 — P3 PROCESS LOCK PACKAGE — ✅ LOCKED BY MATT 2026-08-04

All 21 processes are deepened (full PDS files in `processes/`, every claim file:line-cited).
**LOCKED: Matt granted the process lock 2026-08-04 (in-session structured answers, recorded
below as "Process lock — Matt's answers"). The verdict table below is the locked set, with
deal-track resolved to MERGE (one deal entity with tc-close).**

### Proposed verdict table

| Process | Verdict | One-line rationale |
|---|---|---|
| broker-alert | KEEP | The wake-up loop; split wake-up class from supervision class (your Q1) |
| inbound-respond | KEEP | Core response loop; fix: replies on existing threads never hit the alert rail |
| cma-deliver | KEEP | Litmus anchor; fix broker-assignment TODO (everything signs as Matt) |
| prospecting | KEEP | Your weekly core job; already consolidated to one destination |
| suppression-guard | KEEP | Law; unify group-MMS into the governed chokepoint |
| sequence-run | KEEP | Reshape surface to monitoring-first (your Q2: checking they ran) |
| lead-ingress | KEEP (background) | 8 doors one core; retire FUB vocabulary; not a destination |
| identity-dedup | KEEP (background) | Add dupe-candidate queue; merge path stays singular |
| content-approve | KEEP | One approval lane, phone-first (your Q3 must-have #4); today it is two queues |
| sync-ops | KEEP | Becomes THE supervision view (alarms move off the SMS wake rail) |
| listing-alert-care | KEEP (background) | Fix send-then-mark duplicate window; approvals fold into the one lane |
| weekly-sla-review | KEEP | Gets a single weekly cockpit inside the supervision view |
| reporting-truth | KEEP + internal MERGE/KILL | 35 surfaces, 3 namespaces, one job; getLeadIntake rendered 5 ways |
| newsletter-run | KEEP | Healthiest engine in the admin; unify the 3 audience doors |
| market-report-deliver | KEEP | Merge subscription admin into one per-person subscriptions panel |
| tc-close | KEEP | Most process-complete system; one deal destination, PB sign-off feeds supervision |
| bpo-deliver | MERGE→cma-deliver (surface) | Same engine, twin triad; keep the docType, kill the second worklist |
| visitor-escalate | MERGE→broker-alert | It is a fourth notification path outside the rail |
| data-curate | MERGE→sync-ops | It is the human remediation arm of sync health |
| site-content-ops | KEEP (thin) | Rare-use; one content home off the daily path |
| deal-track | **YOUR CALL — see Q1 below** | 21 rows, 6 surfaces, zero link to TC truth |

### Top process improvements the deepens surfaced (fix-the-class list)

1. **Alert rail unification + classing** — wake-up (3 human triggers, your Q1) vs supervision
   (view/digest); visitor-escalate and health alarms move rails; drops get recorded; alert→
   first-action latency measured. (broker-alert §10-11, visitor-escalate §11, sync-ops §11)
2. **Reply-on-thread wake-up** — today an existing-thread reply only cell-forwards; it is one
   of your three wake-ups and deserves the rail. (inbound-respond §5.7)
3. **One approval lane** — two queues today; phone-first approve/kill with draft preview;
   ready-row aging visible. (content-approve §10-11)
4. **One valuation worklist** — cma + bpo + expired-audit are one build engine; killed builds
   retryable; signing broker = assigned broker; SLA aging visible. (cma-deliver, bpo-deliver)
5. **Reporting collapse** — one definition registry, each metric rendered once; 6 raw-Supabase
   analytics pages brought behind the DAL. (reporting-truth §10-11)
6. **Subscriptions rollup** — listing alerts + market reports + newsletter as one per-person
   panel + one audience admin. (listing-alert-care, market-report-deliver, newsletter-run)
7. **Compliance chokepoint totality** — group MMS joins sendGovernedSms; every block writes a
   reason row. (suppression-guard §10-11)

### Open questions for Matt (≤5)

1. **deal-track:** kill the standalone CRM pipeline board (pre-close interest lives as person
   stage + tasks until a TC deal exists), or merge into one deal entity whose post-acceptance
   phase is tc-close? Evidence: ~21 rows across 6 surfaces, no code link between the stores.
2. **Supervision alarms off the wake rail:** confirm health/system alarms stop texting you and
   land in the supervision view + digest instead (your Q1 said supervision doesn't wake you).
3. **Reply-on-thread alerts:** confirm replies on existing threads should join the SMS/push
   wake rail (your Q1 listed it as a wake-up; today it only forwards to your cell).
4. **Prospecting as a primary mobile surface:** it is your named weekly job and today gets 0
   of 5 tabs — confirm it earns a primary slot when IA is derived in P5.
5. **CMA signing broker:** confirm CMAs should sign as the lead's assigned broker (code TODO
   currently defaults everything to you).

### 2026-08-04 — Process lock — Matt's answers (LOCK GRANTED)

Matt answered the five open questions directly and chose "Lock it now":

1. **deal-track → MERGE into one deal entity.** One "deal" concept: pre-close interest is
   a thin stage on it; post-acceptance is tc-close. Kills the two-stores split.
2. **Supervision alarms OFF the wake rail.** Health/system alarms land in the supervision
   view + daily digest; only inbound-human events text brokers.
3. **Reply-on-existing-thread JOINS the wake rail.** Full alert with deep link into the
   thread, same delivery guarantees as new-lead alerts.
4. **Prospecting earns a PRIMARY surface in P5 IA.** Phone-capable, sized for the weekly
   send-N-intros pass.
5. **CMAs sign as the lead's ASSIGNED broker** (their mailbox sends via Gmail DWD); Matt
   remains the fallback when unassigned.

**Locked verdict set:** the table above with deal-track = MERGE→tc-close (one deal
entity). Net: 15 KEEP · 5 MERGE (visitor-escalate→broker-alert, bpo-deliver→cma-deliver
surface, data-curate→sync-ops, weekly-sla-review→supervision view, deal-track→tc-close
entity) · 1 KEEP-thin (site-content-ops). No KILLs, no DEFERs.

`state.json`: `locks.process = 2026-08-04`, `awaiting_lock` cleared, phase → `P4_DATA`.

### What must be true before IA (P5)

- This process lock written here by Matt (P3).
- P4 data atlas for KEEP processes: writer→store→reader chains, including the P4-flagged
  unknowns (listing-edit sync survival, awaiting_broker_next visibility, place-copy edit
  precedence, CRM↔TC link shape).
- No IA naming/grouping inherited from current routes (amnesia holds; destinations derive
  from these processes only).

---

## 2026-08-05 — P5 IA LOCK — GRANTED BY MATT (in-session structured answers)

The IA in `ia-lock.md` is LOCKED with one amendment. Matt's answers:

1. **Names: keep all three** — Today · Oversight · Closings ship as proposed (full set:
   Today, Messages, People, Prospecting, Valuations, Closings, Oversight, Reports,
   Audiences, Content, Settings).
2. **Tab 5 = Oversight.** Mobile tabs locked: Today · Messages · Prospecting · People ·
   Oversight.
3. **AMENDMENT — DSCR lives in Reports** (as a tool), not Prospecting.
   `page-inventory.json` updated: `/admin/dscr` → Reports.
4. **Sequence/template authoring under Settings** confirmed; monitoring in Oversight.
5. **Tasks + Calendar fold into Today** confirmed — no standalone destinations.

`cut-list.md` is FROZEN (26 route cuts + 12 surface cuts — never resurrect).
`state.json`: `locks.ia = 2026-08-05`, `awaiting_lock` cleared, phase → `P6_VISUAL`.
P6 (greenfield visual language, external standards only) starts next session.

## 2026-08-05 — P6 partial decisions (Matt) + Oversight rework

Matt reviewed the P6 package: **header = Option A (left rail)** and **dark mode =
ship both** are GRANTED. The Oversight screen was REJECTED as "very confusing and
cluttered" — reworked same session to the verdict + needs-you-list pattern (one
sentence answer, one unified attention list sharing Today's row grammar, healthy
systems as quiet hairline rows, one numbers strip). ADMIN_UI.md pattern 3 updated;
the tile status board is retired from the language. **Visual lock still pending**
Matt's review of the reworked screen.

## 2026-08-05 — P6 VISUAL LOCK — GRANTED BY MATT

Matt locked the admin visual language after the Oversight rework ("visual locked").
The locked package is `design_system/admin/` v1 as of commit a3c58038:

- `tokens.css` — Radix-derived light + dark, all pairs contrast-computed; solid
  buttons via `--a-btn-bg/--a-btn-fg` (dark flips to dark text).
- `ADMIN_UI.md` — thesis, six patterns (pattern 3 = verdict + needs-you list; tile
  boards retired), computed AA tables, amnesia test, scorecard.
- Header: **Option A, left rail** (granted earlier same day). Dark mode: **ship
  both**, light default. Mobile: the locked 5-tab bar.
- Screens locked as the visual reference: today.html, messages.html,
  oversight.html (v2).

`state.json`: `locks.visual = 2026-08-05`, `awaiting_lock` cleared, phase →
`P7_PRIMITIVES`. P7 (components/admin/v2 primitives + token-gate exemption) starts
next session; P8 timed litmus follows.


---

## 2026-08-05 — P8 LITMUS SIGN-OFF — GRANTED BY MATT

Matt signed off the litmus ("Ok litmus signed off") after: (1) the full re-proof
on current main (LITMUS.md re-proof section — 2 taps, ~4.2s kickoff RTT, real
SMS rail, worker draft in 44s, zero-residue cleanup), and (2) the stale-session
deep-link defect his own phone tap exposed, fixed at three redirect sites
(commit 2b0286b5), deployed, and confirmed serving live.

**Scoping call (Matt: "Do whatever is recommended"):** the v2-language kickoff
surface ships with the P9 family rolls (People/Today families), not as a
separate P8 slice — the litmus passes on the existing surface.

`state.json`: `locks.litmus = 2026-08-05`, `awaiting_lock` cleared, phase →
`P9_ROLL`. P9 rolls the locked destinations family-by-family onto the v2
language, by pain: Today first (the "what am I supposed to do" answer), then
Messages, People (carries the v2 kickoff surface), Prospecting, Oversight, and
the rest per the locked IA. One family per commit, browser-verified, cut-list
items never resurrected. P10 lands the closing mechanical gates.
