# Plan dispositions — intent, landed, fell off, status now

**Purpose:** Stop past plans from inhibiting progress or causing regression by making every major plan **disambiguated**.  
**Rule:** Only **CANON** and **ACTIVE** may drive new work. Everything else is context, conflict, or archive.  
**Evidence level:** Deep-read pass 2026-08-08 — every package + top-level plan in `inventories/F-plans-packages.txt` and `F-plans-top.txt` has a row. Intent/fell-off drawn from plan bodies (and package state files). Do not invent completeness.

Status vocabulary (this file):

| Status | May drive work? |
|--------|-----------------|
| CANON | Yes — process/product law |
| ACTIVE | Yes — current program with living ledger |
| PARTIAL | Only to *close* documented gaps; not open new scope |
| SUPERSEDED | No — follow the named replacement |
| PAUSED | No until resume conditions met |
| GO_GATED | No until Matt/explicit go |
| DONE | No — closed; history only |
| ARCHIVE | No — retained record / diagnosis / tool index |

(Alias used historically: RECORD ≈ DONE/ARCHIVE; OPEN_INPUT ≈ PARTIAL feed into ACTIVE.)

---

## Packages (`F-plans-packages.txt`)

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| PKG-001 | `docs/plans/ADMIN_PRODUCT/` | Process-first Admin Product OS: process lock → IA lock → visual → litmus; v2 shell + token-gated interiors; 21 process specs. | Phase `P12_CORRECTNESS`; 11F islands remain (crm settings editors, crm islands, deals, sequences, prospecting sub-islands). Dark-mode/product correctness not fully closed. | **ACTIVE** | `ADMIN_PRODUCT/state.json`, `SESSION_BOOT.md`, `progress.txt` (11F unit 6 2026-08-08), `PHASE-11-PLAN.md` |
| PKG-002 | `docs/plans/ADMIN_REBUILD/` | Ground-up admin/CRM rebuild: 12 domain audits, 7 root causes, 11 end-to-end specs, adversarial reconciliation. | **Not an execution target** — superseded 2026-08-04 by Admin Product OS (`ADMIN-UI-UNIFICATION-PROMPT.md` / `ADMIN_PRODUCT/`). Specs = evidence only. | **SUPERSEDED** → PKG-001 | `ADMIN_REBUILD/README.md` (SUPERSEDED banner) |
| **P-006** | `docs/plans/ENTERPRISE_MAP/` | Whole-system enterprise map: inventories, plan dispositions, CAP/INT/FAC matrices, adversary, advancement plan, session handoff. | Map v1 not closed (`REMAINING.md`); matrices partial; adversary HIGH remain; advancement v0.1 not v1. | **ACTIVE** | `00-STATUS.md`, `SESSION_HANDOFF.md`. **G44 registered:** `docs/DEVELOPMENT_PROCESS.md` registered-plan table lists `ENTERPRISE_MAP/` as **live** (covers every file under the package). Seed that said “not G44-registered yet” is **stale**. |
| PKG-004 | `docs/plans/MOBILE_GRIND/` | Defect-**class** mobile remediation from Matt iPhone audit 2026-08-06: census → fix all → gate the class. | Many classes shipped; **C-21 subdivision polygons BLOCKED_MATT** (data missing); remaining classes in ledger phases (C-15/22–26/28 etc. per ledger). | **ACTIVE** / PARTIAL open classes | `MOBILE_GRIND/LEDGER.md`, `STATE.json` |
| PKG-005 | `docs/plans/PROGRAM_2026-07-21/` | RR-PLATFORM-DECISIONS completion program: 19 domain audits, nine primitives, only-path + gates, finish work not open work. | COMPLETION-LEDGER: **W9.1** `blocked:needs-matt` (first newsletter cohort send); **W13.1** `partial` (CLAUDE.md shrink / residual FUB-era docs). Cultural “60–80%” remains. | **PARTIAL** (ledger nearly closed; ops residual) | `00-MASTER-SPEC.md`, `COMPLETION-LEDGER.json` (W9.1, W13.1), `audits/REMAINING-2026-07-22-post-wave-d.md` |

---

## Top-level plans (`F-plans-top.txt`) — IDs `T-001`…`T-043`

### Admin consolidation / product

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-001 | `docs/plans/ADMIN_CONSOLIDATION_AUDIT.md` | Phase 0 audit of ~42 admin routes; settle IA to six broker-job areas (Home · People · Listings · Marketing · Money · Site & Settings). | Findings absorbed into ADMIN_PRODUCT IA lock; standalone consolidation may lag Product OS. | **PARTIAL** → prefer PKG-001 | Body: Phase 0 findings, settled IA |
| T-002 | `docs/plans/ADMIN_CONSOLIDATION_MASTER_GOAL.md` | Collapse ~40 pages to broker workflows: one alert model, editable criteria, market-report emails, delivery observability, help system, lead hub. | In-flight status in header; execution home is ADMIN_PRODUCT process specs + IA lock. | **PARTIAL** / SUPERSEDED-as-execution by PKG-001 | Header “in flight”; DoD list |

### Paid ads suite

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-003 | `docs/plans/PAID_ADS_PLAN.md` | Meta-primary seller-first paid ads strategy: Housing SAC, $20/day prove-it, Pixel+CAPI spine, speed-to-lead, Google parallel test. | Campaign launch/spend is §1 Matt approval; not a substitute for live campaign health. | **ACTIVE** (program docs) / ops **GO_GATED** | Body strategic shape §1–2 |
| T-004 | `docs/plans/ADS_CREATIVE_DIRECTION.md` | North star creative brief: buyers = life/place (no broker face); sellers = trusted advisor with real numbers. | Production/spend not closed by the brief alone. | **ACTIVE** (creative law for ads) | Matt directive 2026-06-23 body |
| T-005 | `docs/plans/ADS_BRIEFS.md` | Copy-ready buyer + seller Instant Form briefs, fair-housing-safe, video-first. | Creatives may not all be produced/launched. | **ACTIVE** | Full briefs body |
| T-006 | `docs/plans/ADS_BUYER_SCRIPT.md` | 30s vertical buyer film “A Tuesday” — timestamps, no broker/VO until end. | Footage gaps + production + launch. | **PARTIAL** | Script table + footage map |
| T-007 | `docs/plans/ADS_FOOTAGE_PLAN.md` | Hybrid owned 4K masters + Getty/Artgrid gap clips; commercial license rules. | Spend decisions (~$380 gap clips) Matt; production not complete in-doc. | **PARTIAL** | Gap 1–2 sourced section |
| T-008 | `docs/plans/ADS_PRO_EXAMPLES.md` | Swipe file of named pro buyer/seller ad patterns and hooks (benchmark). | Reference only; not a completion state. | **ARCHIVE** (reference) | Benchmark body |
| T-009 | `docs/plans/ADS_GO_LIVE.md` | Operational launch checklist for Matt (Meta/Vercel/flags); spine claimed built 2026-06-23. | FUB-era residue in steps; live campaign status not verified this pass. | **GO_GATED** (launch) / PARTIAL if spine drifted | Status line + launch steps |

### Agentic / SMS agent

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-010 | `docs/plans/AGENTIC_GRAPH_ENGINEERING_2026-07-30.md` | Graph-of-loops / workflows / verifiers doctrine; saved workflow library + KG eval backlog. | **Plan only — no execution until Matt go.** | **GO_GATED** | Header status line |
| T-011 | `docs/plans/BROKER_SMS_AGENT_2026-07-31.md` | Brokers text marketing line → CMA/content/DAL/law Q&A with broker self-APPROVE; Phase 0 pipeline repairs. | Full DoD (1–10) incomplete; D1–D4 phase 0 rails (humanApprovedAt, needs_changes, video retired answer, shared Anthropic client). | **PARTIAL** | Mission + DoD + Phase 0 backlog |

### CMA / valuation

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-012 | `docs/plans/CMA_PIPELINE_TO_PRODUCTION_2026-07-30.md` | Production-grade CMA/BPO queue: severity publish gate, auditable comps, honest failures, no auto-send. | Corpus still needs_review-heavy; county/site resolver integrity; publish-clean historically 0; outreach out of scope. API key cap blocked rebuild measurement historically. | **PARTIAL** | Goal + Final state corpus table |
| T-013 | `docs/plans/cma-accuracy-pipeline-2026-07-11.md` | Progress log: judge + adversarial audit + accuracy contract + BPO rollout. | E2E rebuild of seeded expired CMAs / browser badge checks unchecked in doc. | **PARTIAL** / architecture progress **DONE** | Shipped table + Verification status checkboxes |
| T-014 | `docs/plans/PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md` | Brain Dump 2: prospecting→CMA→measure workflow + public site IA/density pass. | Track A/B items open (compliance mislabel UX, list density, city IA, menus, desktop density). | **PARTIAL** | Verbatim intent + verified findings |

### Data / sync / coming soon

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-015 | `docs/plans/COMING_SOON_SQL_FOLLOWUP.md` | Full-stack Coming Soon lockdown (app + RLS/MV views) so anon cannot read pre-marketing listings. | Layer 1–2 + proof done; residual: other off-market statuses anon-readable, null status, activity_events risk, RPC cold cost. | **PARTIAL** residual / core **DONE** | Proof + “Still open” § |
| T-016 | `docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md` | Unify action + cron delta lanes into `lib/sync/deltaSync.ts` with shadow proof + anti-fork gate. | Documented **DONE 2026-07-20**; residue check only. | **DONE** | Header CUTOVER COMPLETE |
| T-017 | `docs/plans/F7-sync-contention.md` | Fix `listing_tile_mv` full rewrite caused by volatile `now()` AS refreshed_at. | Body: **APPLIED TO PRODUCTION 2026-07-29**; residual duration is instance/query cost, not MV hygiene. DEVELOPMENT_PROCESS row may lag as “open”. | **DONE** | Status banner + metrics table |
| T-018 | `docs/plans/data-architecture-plan.md` | Long-form data arch / performance / SEO plan (MV, stats, URL hierarchy). | Status not maintained in-file; process authority → DEVELOPMENT_PROCESS; tasks were registry BL-009+. | **SUPERSEDED** (process) / tech **PARTIAL** debt | HTML comment + body foundation |
| T-019 | `docs/plans/master-plan.md` | Unified phased ownership matrix (Reporting/Engagement/Monetization). | Process authority moved; phase briefs deleted W13.1; ownership matrix still useful. | **SUPERSEDED** (process) | Status: ownership ref |

### CRM / comms

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-020 | `docs/plans/CRM_BUILD_MISSION.md` | Continuous FUB-parity CRM UI rebuild; pixel-match screens; standing main push auth. | Multi-broker productization / full visual parity DoD still north star; admin surface evolved under Product OS. | **PARTIAL** (mission live as north star) | GOAL + DEFINITION OF DONE |
| T-021 | `docs/plans/crm-completion-spec-2026-06-25.md` | Sequenced completion to FUB parity: five foundations (AST, bulk, email_events, settings, custom fields) then P2–P8. | Large surface shipped post-spec; not every domain “configurable in UI” proven closed. | **PARTIAL** | Readiness + foundations |
| T-022 | `docs/plans/crm-golive-execution-2026-06-25.md` | Execution log: green build → deploy → E2E → review after server-action export build breakers. | Historical phases may be closed by later CRM/admin work; do not re-execute as if prod still broken without re-verify. | **PARTIAL** / RECORD mix | Phase checklist |
| T-023 | `docs/plans/CRM_AUDIT_2026-07-02.md` | Adversarial desktop CRM audit; 9 findings. | Ledger: **zero open** (all fixed / Matt decision). | **DONE** | Findings-closure banner |
| T-024 | `docs/plans/CRM_AUDIT_MOBILE_2026-07-02.md` | Adversarial mobile CRM audit at 390×844; compliance + mutation round-trips. | P0/P1 findings fixed in-body; treat as closed audit ledger unless re-opened. | **DONE** | Surfaces + FIXED findings |
| T-025 | `docs/plans/EMAIL_SEND_AUDIT_2026-07-02.md` | Diagnose “archived” emails: FUB Beacon via Gmail OAuth, not native CRM. | Diagnosis complete; stop was Matt revoke FUB Google access / disable Beacon. | **DONE** (diagnosis) / ARCHIVE | Smoking-gun section |
| T-026 | `docs/plans/crm-attribution-coverage-2026-06-24.md` | Map every email/SMS path to `attributeOutbound` / open-click / Resend lifecycle. | At write time many channels PARTIAL (newsletter, alerts text-only, CMA). Later program work may have closed some — re-verify before driving. | **PARTIAL** | Per-channel coverage |
| T-027 | `docs/plans/CONTACT_HEADER_REDESIGN_2026-06-30.md` | Contact header: big PFP, quick-action chips, owned-home card; kill Memberships pile. | Shipped with commits listed; minor follow-ups only. | **DONE** | Shipped 1–4 |
| T-028 | `docs/plans/twilio-cutover-2026-06-24.md` | FUB→in-house Twilio CRM telephony: numbers, record, SMS, forward, click-to-call, timeline. | Waves 1–8 shipped per progress; residual lead-entry flip / identity polish historically Matt-owned. | **PARTIAL** / core comms **DONE** | Progress log status line |
| T-029 | `docs/plans/LIFECYCLE_WORKFLOWS_MASTER_GOAL.md` | Dial Expired→CMA, newsletter, saved searches, market reports to one brand system. | Newsletter first real cohort **Matt-gated**; lifecycle uneven across WS. | **PARTIAL** | Status in flight + DoD |
| T-030 | `docs/plans/SAVED_SEARCH_MASTER_GOAL.md` | Best-in-class saved search + market-report subscriptions with tracking. | Product paths exist; LP promise vs enroll classes historically incomplete. | **PARTIAL** | DoD + workstreams |

### Public site / experience / search / voice

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-031 | `docs/plans/KB_SITE_CONVERSION_GOAL.md` | Every user-facing page on KB design system + PAGE CONTRACT; subdivision links. | Wave plan incomplete; ~109 old pages historically; conversion ongoing. | **PARTIAL** | Goal + wave plan |
| T-032 | `docs/plans/PAGE_REVIEW_REDESIGN_RUNBOOK.md` | Repeatable render-proven review vs competitor + brutalist checklist + gates. | Procedure, not a completion inventory. | **CANON** (procedure) | Purpose + §0 prompt |
| T-033 | `docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md` | Flexmls teardown → search/map/alerts parity-plus phased plan. | Phases 0–3 referenced as shipped elsewhere (`deed9e4b`); plan body still execution-grade phases; full “beyond Flexmls” open. | **PARTIAL** | Status line + phase sections |
| T-034 | `docs/plans/SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30.md` | Generate filters from Spark field metadata; sub types, zoning defs, mechanical completeness gate. | Plan-heavy; completeness gate / full residential-visible field surface open. | **PARTIAL** | Goal + “no code written” at open; supersedes completeness hole |
| T-035 | `docs/plans/VOICE-CANON-2026-08-05.md` | End-to-end Buffett voice migration: single VOICE.md, nuke old rules, rewrite public copy, two gates. | Canon + CI largely live; full public-surface rewrite may remain incomplete. | **ACTIVE** / PARTIAL rewrite | What done means |
| T-036 | `docs/plans/WESTSIDE_BACKLOG.md` | Ranked west-side lead/share backlog from live market + funnel data. | Open items: crawl budget, content depth, review-ask wiring, luxury internal links, paid/expired send approvals. | **ACTIVE** | Ranked backlog table |
| T-037 | `docs/plans/money-path-contract-plan-2026-06-04.md` | Money/ranking page contracts via parity.json (housing-market flagship, LPs, buy, contact). | DRAFT awaiting sign-off at write; absorption into EXPERIENCE/KB incomplete as single contract. | **PARTIAL** (open input) | Thesis + DRAFT status |

### Transaction

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-038 | `docs/plans/TC_ARCHITECTURE_REVIEW.md` | Vault TC architecture: ranked C1–C4/H* problems, phased refactor, SkySlope boundary. | Untransactional multi-table transitions, seal-in-request, etc. backlog open. | **PARTIAL** | Verdict up front |
| T-039 | `docs/plans/TC_BUILDOUT_HANDOFF.md` | Resume point for TC build-out increments. | **PAUSED 2026-06-24** Matt; ready migrations Matt-gated; next code-only increments parked. | **PAUSED** | STATUS PAUSED banner |

### Continuity / registry / misc tools

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| T-040 | `docs/plans/CROSS_AGENT_HANDOFF.md` | Required Claude↔Cursor/Grok continuity (Current block: SHA, next, locks). | Often subject-shaped (admin) not fleet-shaped; must be rewritten each switch. | **ACTIVE** (continuity) | Current block 2026-08-08 |
| T-041 | `docs/plans/GLOBAL_SKILLS_REGISTRY.md` | Index of every SKILL.md path for Cursor/Claude/Cowork/TC. | Inventory date lag risk; refresh process documented. | **ARCHIVE** / live reference | Purpose header |
| T-042 | `docs/plans/continuous-improvement.md` | Auto-generated orchestrate progress report. | **49/49 tasks complete 2026-07-27** — no longer real backlog. | **DONE** / SUPERSEDED as backlog | Overall Progress table |
| T-043 | `docs/plans/DSCR_DEAL_FINDER_2026-08-03.md` | Admin DSCR screen: Deal Score, nav discoverability, draft-first emailable list. | Email list draft-first; rent estimates coverage; finish bar items. | **ACTIVE** / small PARTIAL | Mission goal DoD |

---

## Process law (referenced; not both inventory lists)

| ID | path | Intent | Fell-off | Status | Evidence |
|----|------|--------|----------|--------|----------|
| LAW-001 | `docs/DEVELOPMENT_PROCESS.md` THE LOOP v1.1.0 | One cycle; five domain loops; gates; registered plans (G44). | Fleet Sense not forced every session; empty task-registry vs real work elsewhere. | **CANON** | Header + G44 description + plan registry table |
| LAW-002 | `docs/plans/task-registry.json` | Prioritized orchestrate task queue. | 49/49 complete; not authoritative backlog. | **SUPERSEDED** as backlog | `continuous-improvement.md` + G44 note |

---

## Cross-cutting conflict notes

| Conflict | Plans | Resolution |
|----------|-------|------------|
| What is the backlog? | task-registry vs ADMIN_PRODUCT vs WESTSIDE vs PROGRAM residual vs ENTERPRISE_MAP | **ACTIVE** subjects in handoff + this map; task-registry not authoritative |
| Admin rebuild target | ADMIN_REBUILD specs vs ADMIN_PRODUCT | ADMIN_PRODUCT / Product OS only |
| Experience rollout | Serial families vs later “serial is dead” | Follow EXPERIENCE_SYSTEM current text (outside this inventory) |
| CRM SoR docs | FUB-era vs native | Native `crm_people`; FUB docs ARCHIVE |
| Search perf | Features vs F7 | F7 **DONE** in prod per plan body; residual duration ≠ full-rewrite bug |
| Content learning | Brain produces ready drafts | measured=0 class → factory PARTIAL (see CAP-015 evidence) |
| Newsletter | LIFECYCLE / PROGRAM W9.1 | **GO_GATED** Matt first cohort send |

---

## How dispositions unblock “move everything forward”

1. **ACTIVE/CANON only** for new Ship scope.  
2. **PARTIAL** work = close documented fall-off (only path, gate, measure), not open parallel futures.  
3. **PAUSED/GO_GATED** stay parked until conditions met — not silent guilt.  
4. **SUPERSEDED/DONE/ARCHIVE** may be read for intent; agents must not re-execute them as if open.  
5. When a new plan is written, it must **name what it supersedes** and flip that row + register under G44.

**Row count (this pass):** 5 packages (incl. **P-006** ENTERPRISE_MAP) + 43 top-level (`T-001`…`T-043`) + 2 process-law rows = **50 disposition rows**. Inventory coverage: every path in `F-plans-packages.txt` and `F-plans-top.txt`.

This file is the plan-plane of the enterprise graph. Revised 2026-08-08 deep-read pass.
