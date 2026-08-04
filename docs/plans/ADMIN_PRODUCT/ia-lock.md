# IA Lock — decision package (P5)

Status: **PROPOSED 2026-08-05 — AWAITING MATT'S IA LOCK.** Locks only when Matt writes
the lock into `decisions.md`. Derived from the locked KEEP set (process lock
2026-08-04), the Phase-0 evidence in `decisions.md`, the five locked directives, and
`data-atlas.md`. Amnesia held: zero carryover of current route names, menu structure,
groupings, or the mobile tab bar — every destination below is named from the job it
serves and traces to a locked process. Where a name coincides with an existing word
(People, Prospecting, Reports, Settings, Content), the coincidence is because the job's
plain-English name IS that word; the derivation is documented per destination.

## The problem this IA answers

Matt: "I log on there and I'm just like, what am I supposed to do?" — 160 routes,
3 landing dashboards, 3 report namespaces, 2 deal systems, 2 approval queues,
5 prospecting doors (now redirects), and a tab bar spending 2 of 5 slots on surfaces
Matt does not use weekly and 0 on his named weekly job.

## Destination set — 11 destinations, one primary destination per job

| # | Destination | The job it serves (process-traced) | Cadence | Routes absorbed |
|---|---|---|---|---|
| 1 | **Today** | "What am I supposed to do right now" — the one action queue: inbound triage, parked sequence steps (awaiting_broker_next), content approvals (both queues merged), CMA-ready reviews, due tasks/appointments (content-approve · sequence-run parked · inbound-respond triage) | daily, phone-first | 5 |
| 2 | **Messages** | Read an inbound thread in context and reply fast — SMS + email unified, history above composer (inbound-respond; Matt Q3 #1 verbatim) | daily, phone-first | 1 |
| 3 | **People** | Look up a human and their whole history; alert deep links land here; merge/import lanes (lead-ingress · identity-dedup; Matt Q3 #2). Search-first, NOT a worklist — Q2 says the list is not weekly | on-demand | 9 |
| 4 | **Prospecting** | The weekly outbound pass: expired audits + FSBO CMAs, send-N-intros (prospecting; LOCKED primary 2026-08-04; Matt's own name for the job) | weekly | 3 |
| 5 | **Valuations** | Get valuation documents built, reviewed, delivered — CMA + BPO + expired-audit, one worklist over one build engine (cma-deliver + bpo fold) | event-driven | 6 |
| 6 | **Closings** | Get accepted offers to closed, compliantly — the one deal entity: docs, signing, commissions, PB sign-off (tc-close + deal-track fold). Named for the outcome, not "deals" (a word two dead systems fought over) | event-driven | 12 |
| 7 | **Oversight** | Supervise without being woken — system health, alarms landing zone (locked directive #2), sequence ran/broke/parked monitoring (Q2), the weekly cockpit (speed, rot, pace), PB backlog, data-correction lanes (listings/geo), visitor trails, audit log (sync-ops + weekly-sla-review + data-curate fold) | weekly + alarm-driven | 17 |
| 8 | **Reports** | Answer a question with a defined number — one reporting home, one definition per metric (reporting-truth) | weekly/on-demand | 34 |
| 9 | **Audiences** | Manage what we send to whom on cadence — subscriptions (market reports, listing alerts, newsletter), segments, cohort compose (listing-alert-care + market-report-deliver + newsletter audience half) | monthly/rare | 5 |
| 10 | **Content** | Curate what we publish — blog, guides, help, media, site pages, newsletter drafting, deliverable library (site-content-ops + newsletter-run drafting half) | rare | 14 |
| 11 | **Settings** | Configure the machine — routing, brokers, templates, sequence authoring, compliance lists (suppression/block/A2P), fields/tags/stages, team (suppression-guard admin + config residue) | rare | 25 |

Plus **SYSTEM** (login, setup, access-denied — auth chrome, outside IA): 3 routes.
**CUT**: 26 routes (see `cut-list.md`). Total: 160/160 routes dispositioned, verified
against disk this session (P1 had missed `/admin/inbox`, found and mapped).

Background processes with NO destination (by design): broker-alert (a rail that points
at destinations), lead-ingress doors, identity resolution, suppression enforcement,
all senders. They surface as lanes/panels inside the 11, never as nav items.

## Mobile tab set — 5 tabs, re-derived from evidence

| Tab | Evidence trace |
|---|---|
| **Today** | Q1: all three wake-ups need a landing zone with actions; Q3 #4 approve-a-draft; the problem statement itself |
| **Messages** | Q2 weekly inbox + Q3 #1 reply-with-history — phone is the response surface |
| **Prospecting** | Locked directive #4 (2026-08-04): primary surface, phone-capable |
| **People** | Q3 #2 pull-up-person+history; alert deep links resolve here; search-first |
| **Oversight** | Q2 sequences monitoring weekly + Q1 supervision-as-view + locked directive #2 (alarms land in a view, not a text) |

Replaced bar: Home · Inbox · People · Deals · Activity — Deals (not weekly, Q2) and
Activity (a feed, not a job) lose their slots; Prospecting and Oversight gain them.
Valuations and Closings are reachable on phone via Today items and People/alert deep
links (the litmus path is alert → person → kickoff, which never needed a tab).

## Desktop nav model

Flat list of the 11, grouped visually (grouping is presentational, not structural):
**Do**: Today · Messages · People — **Move**: Prospecting · Valuations · Closings —
**Watch**: Oversight · Reports — **Reach**: Audiences · Content — Settings last.
No nested namespaces. No destination owns another destination.

## Amnesia test (recorded)

- Zero blacklist citations used; the derivation inputs were the locked PDS set,
  Phase-0 answers, the data atlas, and the route inventory (behavior/data only).
- Every destination traces to a locked process (table above); none traces to a route
  that exists today. `/admin/crm` as a namespace, "Deals" as a name, the 8-destination
  nav, and the 5-tab bar all die.
- Name coincidences (People, Prospecting, Reports, Settings, Content) are job-word
  coincidences, documented above; Today, Messages, Valuations, Closings, Oversight,
  Audiences are new names that exist nowhere in the current admin.
- This IA could exist if the current admin did not.

## What the IA deliberately does NOT decide (P6+ territory)

Visual language, layout, component choices, header/nav chrome, dark mode, per-lane
information design, and the phone interaction model. Also route URL spellings — the
destination names above are jobs, not final URL slugs (P7/P9 decide slugs).

## Open questions for Matt (answer with the lock)

1. **Names**: approve or rename — most debatable: "Today" (alt: "Queue"), "Oversight"
   (alt: "Health"), "Closings" (alt: "Transactions").
2. **Tab 5 tradeoff**: Oversight beat Valuations for the fifth phone slot (weekly
   monitoring evidence vs event-driven reviews that already arrive via Today). Confirm
   or swap.
3. **DSCR screen**: mapped to Prospecting as an investor-acquisition lane. Confirm, or
   move to Reports (as a metrics tool).
4. **Sequence authoring under Settings**: editing sequences/templates is rare-use
   config per Q2 (monitoring is the job, authoring is not). Confirm.
5. **Tasks/Calendar fold**: both fold into Today items (no standalone destinations).
   Confirm.

## Lock line

When Matt locks: write `IA lock granted YYYY-MM-DD` + any renames/answers into
`decisions.md` under a new dated section, set `state.json.locks.ia`, clear
`awaiting_lock`, freeze `cut-list.md`, advance phase to `P6_VISUAL`.
