# CRM / Admin — Full understanding pack

**Date:** 2026-08-03 (America/Los_Angeles)  
**Scope:** In-house CRM + admin broker loop (FUB decommissioned 2026-06-24)  
**Method:** Live code + schema + production SQL + `node scripts/crm-e2e-verify.mjs` + synthesis of July 2026 ADMIN_REBUILD audit (baseline `d3dd457a`) with post-litmus deltas  
**Companion role brief:** [`ROLE-BRIEF-PROCESS-DATA-UI.md`](./ROLE-BRIEF-PROCESS-DATA-UI.md)  
**Interactive canvas:** open `crm-full-audit` beside chat (Cursor canvases)

This pack is understanding + audit + plan. It is **not** a locked UI redesign. Matt locks IA and cut list after walking process + data.

---

## 0. Executive snapshot (live)

| Signal | Value | Source |
|---|---|---|
| Contacts | **22,951** | crm-e2e `data.people-count` |
| Contact points | **38,866** | crm-e2e |
| Timeline rows | **99,703** | crm-e2e |
| Suppressions | **5,165** | crm-e2e (do not trust pg_stat ≈7) |
| Conversations / messages | ~8.4k / ~45k | production pg_stat / prior query |
| Sequences | **7 defs**; **4 active** masters + 3 paused nurture | live SQL 2026-08-03 |
| Enrollments | 2 running · 10 paused · 2 paused_reply · 8 stopped · 7 suppressed | live SQL |
| CRM pages | **59** under `/admin/crm` | route inventory |
| Console dual-CRM | **gone** (redirects only) | `app/admin/console/**` |
| crm-e2e | **34 pass · 2 warn · 1 fail** | 2026-08-03 run |
| A2P | Brand APPROVED · campaign VERIFIED | crm-e2e |
| Twilio balance | $22.13 | crm-e2e |

**Engine health:** lead ingress, auto-enroll, sequence engine, Gmail sync, portal intake, alert drain, geo-resolve, compliance gate, admin auth shells — green.  
**Known fail:** `wiring.static` expects retired FUB `mirrorPersonFromFub` — **stale check**, not a live lead-loss bug.  
**Known warns:** FUB spot-sync empty (expected post-cutover); OREA license re-verify due for all 3 brokers.

---

## 1. Data atlas (summary)

Full table list: explore output + `docs/DATABASE_SCHEMA_SNAPSHOT.md` (`crm_*` § ~1543–2310). **54 `crm_*` tables.**

### Load-bearing entities (broker loop)

| Entity | Role | ≈ scale |
|---|---|---|
| `crm_people` + `crm_contact_points` | Identity + routing addresses | 23k / 39k |
| `crm_timeline` | Still primary activity SoT for many reads | 100k |
| `crm_conversation` + `crm_message` + participants | Typed thread model (shadow/dual with timeline) | 8k / 45k |
| `crm_broker_alerts` | Broker notification queue | ~910 |
| `crm_sequences` + enrollments | Drip engine | 7 / ~29 |
| `crm_tasks` | Call/follow-up tasks | ~590 |
| `crm_deals` + pipelines | Opportunity board (light usage: ~21 deals) | small |
| `crm_suppressions` + blocked numbers | TCPA / stop | **5,165** suppressions |
| `cmas` / BPO / `listing_alerts` | Deliverables | ~240 CMAs |
| `visitor_sessions` / `visitor_events` | Intent / hot lead | 46k / 91k |

### Structural quirks (design must respect)

1. **Dual conversation model** — writes go through `lib/crm/record-message.ts` into conversation/message; many UI reads still timeline/`crm_conversation_state` person-keyed. Inbox already layers both (`getInboxQueue.ts`).
2. **`assigned_broker` scattered** — people, conversation, tasks, deals, alerts. Scope bugs are a class (see RBAC audit).
3. **Idempotency ledger** — `crm_idempotency_keys` + message keys; composers gated by G50.
4. **FUB residue columns** — legacy ids on people/deals/tasks/alerts/visitors; runtime FUB API is dead (`fub-env` returns undefined).

Primary DAL: `lib/data/crm/*`. Domain: `lib/crm/*`. Actions: `app/actions/crm*.ts`.

---

## 2. Process atlas (live)

### The loop (what the product is for)

```
lead arrives → ensureNativeLead / sendEvent
     → tag + auto-enroll (epoch-gated)
     → queueBrokerAlert → crm-alert-drain → phone/push
     → broker opens /admin/crm/{id}[?intent=cma]
     → reply (SMS/email/call) and/or send deliverable
     → sequence engine continues under suppression + quiet hours
     → deal/task optional · outcome measured
```

### Ingress (all create/update people)

Hub: `lib/crm/send-event.ts` `sendEvent` → `ensureNativeLead` (native only).  
Also: `findOrCreatePersonByPhone`, Meta webhook, portal intake cron, Twilio inbound, ~20 LP/form actions (seller-home-value, expired, FSBO, contact, home-valuation, etc.).

### Notification

`lib/crm/broker-alerts.ts` → `crm_broker_alerts` → cron `crm-alert-drain` (every minute) + web push. SMS to broker gated by `brokers.notify_sms` (default off). Deep links to person; seller-intent appends `?intent=cma`.

### Response

Gmail DWD for 1:1 email; Twilio for SMS/voice; suppressions fail-closed; quiet hours on manual SMS + sequence SMS.

### Deliverables

Person hub: `ContactSendCenter` → `sendDeliverable` chokepoint.  
CMA: `kickoffCmaForContactAction` → `cma-build-worker` → draft review → broker send (never auto to lead).  
Also: BPO, market report now/cadence, listing alerts, newsletter (approval rules apply).

### Automation crons (registered)

`crm-bulk-worker`, `crm-scheduled-sends`, `crm-task-reminders`, `crm-market-report-send`, `crm-gmail-sync`, `crm-portal-lead-intake`, `crm-sequence-engine`, `crm-auto-enroll`, `crm-health-check`, `crm-alert-drain`, `crm-geo-resolve`, plus `cma-build-worker`, `saved-search-alerts`, visitor hot-lead, attribution, newsletter.

**Orphan route (not in vercel.json):** `daily-broker-digest`.

### Deals / tasks

Tasks + reminders: live. Deals CRUD: live, lightly used (~21 rows). No auto-deal-from-lead.

---

## 3. Current design inventory

| Layer | Reality |
|---|---|
| URLs | `/admin/crm/*` (59 pages). `/admin/console/leads` → redirects. |
| Shell | `ConsoleShell` + `lib/admin/nav.ts` DESTINATIONS (8 tops). Mobile: 5-tab bar Home · Inbox · People · Deals · Activity. |
| Theme | `.console-root` / `console-theme.css` (ops register, not public Heritage). |
| Person | One route, **two trees**: desktop 3-column vs `MobileContactDetail` tabs (Info/Comms/Activity/Homes/Notes/Calendar). |
| Inbox / people / tasks / calendar | Same pattern: `md:hidden` mobile fork vs desktop. |
| Kit | Secondary CRM pages use `ConsoleSection`. Flagship screens use `ci:crm-screen-parity` + `docs/crm-spec/crm-screens.json`. |
| Dual “deals” | `/admin/crm/deals` (pipeline) ≠ `/admin/deals` (Vault/transactions). |

**Design debt class:** not “missing Console Kit.” It is **two products per URL** (RC3), **59 pages for a 3-broker loop** (C1), and **FUB-parity chrome** that can fight a smaller IA.

---

## 4. Audit findings (ranked)

### A. Proven live (2026-08-03 e2e + SQL)

| ID | Severity | Finding |
|---|---|---|
| L1 | OK | Lead spine + crons + Gmail + Twilio webhooks + A2P + suppressions gate |
| L2 | OK | 4 master sequences active; engine not stalled |
| L3 | WARN | OREA license re-verify overdue (all brokers) |
| L4 | DEBT | `wiring.static` still requires FUB mirror helper — update e2e after cutover |
| L5 | QUESTION | Confirm prod `CRM_SMS_ALERTS` owner (serverless Twilio vs mac-mini relay) |

### B. Structural (July 16 audit @ `d3dd457a`) — re-verify before treating as current

Constraints **C1–C5** and root causes **RC1–RC7** in `00-REASONING-AND-ARCHITECTURE.md` remain the right diagnosis frame. Post-litmus / Phase-0 work claims partial closure of RC1 (conversation tables), RC2 (composer idempotency), RC5 (nav/capabilities), RC7 (save→resume), and **LITMUS met** (2026-07-17: 2 taps / ~17.5s).

**Still high risk / incomplete per PROGRESS + code inventory:**

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| S1 | CRITICAL (UX) | Desktop/mobile still forked trees on core surfaces | person / inbox / people / tasks / calendar mobile folders |
| S2 | HIGH | Person fetch / Unified SendPanel (Spec 03) not fully landed as one send surface | PROGRESS: fetch rebuild not landed; ContactSendCenter + multiple cards still present |
| S3 | HIGH | Timeline vs conversation read convergence incomplete | getInboxQueue comments + dual stores |
| S4 | HIGH | RBAC broker-scope gaps may remain (GAP-0..W) | `docs/audit/CRM_RBAC_AUDIT.md` — different axis than page capability gates |
| S5 | HIGH | Accretion: 59 CRM pages + reporting/settings long tail | route count |
| S6 | MED | Orphan `daily-broker-digest`; FUB-shaped columns; dead `LeadTabs` | process atlas |
| S7 | MED | Analytics / metric SoT (RC4/RC6) not re-proven this session | July audit |
| S8 | MED | Group vs 1:1 reply correctness needs live re-test | July RC1 symptom |

### C. What “up to snuff” means here

Not “every FUB screen.” Not “ConsoleSection on 59 pages.”

**Up to snuff =**

1. Every number and every send is integrity-safe (C4/C5).  
2. The daily loop is fast on the phone (litmus + reply + send).  
3. One IA, one responsive tree per destination, cut list executed.  
4. Brokers never see placebo or out-of-scope books.  
5. Docs/e2e match the post-FUB world.

---

## 5. Plan to bring it up to snuff

Ordered so understanding stays ahead of pixels. Matt gates each phase.

### Phase 0 — Lock the week (Matt, 30–45 min)

Answer from real use (not docs):

1. What notification wakes you most often, and what do you do next?  
2. Which of Inbox / People / Deals / Tasks / Sequences do you open weekly vs never?  
3. On phone: what must work besides CMA kickoff (reply SMS? send CMA PDF? BPO?)?  
4. Should brokers see only their book, or all-book with filters (RBAC A vs B)?  
5. Confirm alert SMS path: Twilio serverless vs mac-mini relay.

**Exit:** KEEP / MERGE / KILL / DEFER marks on the process inventory (§2).

### Phase 1 — Re-verify top claims (1–2 sessions, no UI redesign)

Run the 15-item checklist from the audit synthesis (litmus re-time, conversation read path, double-send, nav dead-ends, RBAC GAP-0/W, mobile send beyond CMA, metric SoT spot checks). Fix only **lead-loss / compliance / e2e stale** failures.

**Exit:** Punch list with file:line, severity, pass/fail after re-test.

### Phase 2 — Data integrity slice

- Close dual-read gaps that cause wrong thread/reply targets (conversation SoT or documented dual-read contract).  
- Broker scope on list + detail + mutations (RBAC).  
- Retire/update FUB e2e wiring check.  
- Confirm suppression on every send path (already mostly gated; prove with matrix).

**Exit:** No out-of-scope person write; no double-send; e2e green without stale FUB assert.

### Phase 3 — IA + cut list (design decision, Matt locks)

Using Phase 0 marks + litmus: propose **minimum destinations** for the loop (not 59). Explicit delete/redirect list. Phone = primary for response half. Desktop densifies the same tree.

**Forbidden in this phase:** implementing a new visual system; wrapping pages in kit without cut list.

**Exit:** Matt-signed IA one-pager + cut list.

### Phase 4 — Person workspace + Unified Send (build)

One responsive person surface; one send panel; async CMA/BPO already partially there — finish Spec 03 intent against locked IA. Delete mobile/desktop forks for this route. Re-time litmus.

**Exit:** Litmus green on production phone; send domain available on mobile for KEEP deliverables only.

### Phase 5 — Inbox + People + Today

Same responsive rule. Segmented inbox. People list with live saved views that matter. Home = “right now” for the loop (alerts, due tasks, needs-reply), not a report warehouse.

### Phase 6 — Long tail

Sequences/approvals/settings/reporting: merge duplicates, kill placebo, one metric definition layer. Vault/transactions stay separate product (`/admin/deals`).

### Phase 7 — Hardening

Gates: keep `ci:composer-discipline`, deliverable chokepoint, admin-authz, crm-screen-parity for remaining flagships. Add checks for any class that regressed twice. Update ADMIN_REBUILD README (remove “no code until approved” freeze language). Update this pack’s date when phases close.

---

## 6. Suggested next action (immediate)

1. Matt: answer Phase 0 in [`PHASE-0-ANSWERS.md`](./PHASE-0-ANSWERS.md) (or screen-share phone CRM).  
2. Start the fix loop: `/crm-up-to-snuff` or `/loop /crm-up-to-snuff` (skill below).  
3. Loop auto-fixes integrity/e2e; **stops** before IA cut / UI rebuild until you lock §7 in Phase 0.

---

## 8. Fix loop (appropriate automation)

**Skill:** [`.cursor/skills/crm-up-to-snuff/SKILL.md`](../../../.cursor/skills/crm-up-to-snuff/SKILL.md)

| Lane | Runs unattended? | What |
|---|---|---|
| A Integrity | Yes | Stale e2e, RBAC scope, double-send, suppression holes, reply targeting |
| B Litmus/engine | Yes | Keep CMA kickoff + crons green |
| C IA / cut list | No | Propose only until Matt locks |
| D UI rebuild | No until IA locked | One responsive tree, Unified Send |

**Start:**

```
/loop /crm-up-to-snuff
```

Or paste the “Paste-ready system prompt” block inside the skill into a new session.

**State:** `tmp/crm-up-to-snuff-state.json` (written by the loop).  
**Existing engine guardian** (`/crm-e2e`) stays the health battery; this loop owns the audit punch list + remediation.

---

## 7. Source index

| Artifact | Path |
|---|---|
| This pack | `docs/plans/ADMIN_REBUILD/FULL-AUDIT-2026-08-03.md` |
| Phase 0 answers | `docs/plans/ADMIN_REBUILD/PHASE-0-ANSWERS.md` |
| Fix loop skill | `.cursor/skills/crm-up-to-snuff/SKILL.md` |
| Role brief | `docs/plans/ADMIN_REBUILD/ROLE-BRIEF-PROCESS-DATA-UI.md` |
| Architecture | `docs/plans/ADMIN_REBUILD/00-REASONING-AND-ARCHITECTURE.md` |
| Decisions | `docs/plans/ADMIN_REBUILD/01-DECISIONS-AND-RECONCILIATION.md` |
| Litmus | `docs/plans/ADMIN_REBUILD/LITMUS.md` |
| Progress log | `docs/plans/ADMIN_REBUILD/PROGRESS.md` |
| Schema | `docs/DATABASE_SCHEMA_SNAPSHOT.md` |
| Console kit | `docs/CONSOLE_KIT.md` |
| Mobile bar (historical) | `docs/MOBILE_CRM_PARITY.md` |
| RBAC | `docs/audit/CRM_RBAC_AUDIT.md` |
| E2E | `scripts/crm-e2e-verify.mjs` → `tmp/crm-e2e-latest.json` |
