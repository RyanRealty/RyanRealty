# Agentic Graph Engineering — comprehensive plan (v2, 2026-07-30)

**Status: live — plan only, no execution until Matt's go.** v1 (research + seed backlog)
produced earlier today; v2 incorporates Matt's scope questions, the deeper research pass,
and the two X sources Matt supplied, reviewed against this codebase and the database.

Sources reviewed at Matt's request:
- [@0xCodez — "Graph Engineering with Claude: 14-step roadmap"](https://x.com/0xCodez/status/2079165300625330317) (4.5M views)
- [@undefinedKi — safishamsi/graphify](https://x.com/undefinedKi/status/2064696505391292911) (codebase → knowledge graph skill)

---

## 1. What the field means by the term

"Graph engineering" entered mainstream AI-engineering discussion June–July 2026 as the
layer above prompt engineering (one model call), context engineering (what the call
sees), and loop engineering (one agent's observe-act-verify cycle). Two senses:

**Sense A — orchestration graphs.** Multi-agent work designed as an explicit graph:
nodes are bounded jobs, edges are data dependencies, shared state travels the edges.
Claude Code ships this natively as **dynamic workflows** (scripts in
`.claude/workflows/`, spawning coordinated subagent fleets; orchestration is code, so
coordination costs zero model tokens).

**Sense B — agentic knowledge graphs.** Permanent graph-shaped memory that outlives a
context window (Extract → Resolve → Assemble → Query; GraphRAG lineage).

**Sense C — the mature synthesis (the one that answers Matt's scope question).** Graph
engineering as the wiring of many *feedback loops* — metrics, evals, audits, policies,
workflows — into a network where they watch, constrain, and correct one another. Edges
encode trust, authority, and cadence. The critical distinction is **grounded vs
ungrounded**: a loop that consumes only internal reports stays self-consistent while
drifting from reality; anchors (verified transactions, real lead counts, cash events)
are nodes the graph's dynamics cannot touch.

**Skeptic case, adopted as doctrine:** much of this is rebranded workflow orchestration.
The durable substance is five things made explicit — **state, handoffs, verification,
budgets, stop conditions** — plus the grounding rules. We adopt the substance and skip
the framework shopping.

### The 14-step roadmap (@0xCodez), distilled to the rules we adopt

1. **A node is a bounded job; an edge exists only where data moves.** "And then" is not
   an edge. Independence is the thing you exploit.
2. **A linear script is a degenerate graph** — most chains contain arrows that carry no
   data and exist only because of typing order.
3. **Every node gets a contract**: bounded input, schema-validated output, one job.
4. **Edges are data contracts, and edges are code** — flatten/dedupe/filter is
   deterministic plumbing, zero tokens. Agents are for judgment, not wiring.
5–7. **Fan out / fan in / the diamond** (split → parallel work → merge) is the workhorse
   topology: market scan, audit, review, research report — same skeleton.
8. **Route at runtime**: an agent classifies, code picks the edge. Judgment at the node,
   determinism at the edge.
9. **Verifier on the edge**: adversarial verify (N skeptics try to kill each finding),
   perspective-diverse verify (distinct lenses), judge panel (N attempts, scored).
10. **Isolate failure**: a failed node drops out (`null`), fan-ins tolerate missing
    inputs; git-worktree isolation only when nodes write files in parallel.
11. **Cycles must converge**: loop-until-dry (stop after K empty rounds), dedupe against
    everything *seen*, never just against confirmed results.
12. **Tier the models**: cheap models on bounded/repetitive nodes, the strong model on
    judgment and synthesis.
13. **Topology is cost and latency**: pipeline by default; a barrier only when a stage
    truly needs the whole prior set.
14. **Self-routing**: describe the objective, let Claude draw the graph; save good runs
    to `.claude/workflows/` — version-controlled, re-runnable by name.

### graphify (@undefinedKi) — review verdict: DO NOT ADOPT, we already run the equivalent

graphify tree-sitter-parses a repo into a code knowledge graph so Claude queries a map
instead of grepping. This repo already runs **codebase-memory-mcp**, which does the same
and more: symbol graph (`search_graph`), call/data-flow tracing (`trace_path`), Cypher
queries (`query_graph`), architecture summaries, ADR storage, `detect_changes` for
incremental refresh — and the session-start protocol already mandates graph-first code
discovery. Installing graphify would add a second, worse copy of an existing organ.
The real gap is **freshness discipline** (see item W5.2).

### Full source list

- MarkTechPost, [Prompt vs Loop vs Graph Engineering](https://www.marktechpost.com/2026/07/29/prompt-engineering-vs-loop-engineering-vs-graph-engineering/)
- LangChain, [3 Years of Graph Engineering with LangGraph](https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph) — graphs fit known structure + uncertain details; they fail on open-ended exploration; "agent graphs are usually not DAGs"
- Claude Code docs, [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Anthropic, [When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- [Eigent — graph of feedback loops, grounded vs ungrounded, Goodhart pairs](https://www.eigent.ai/blog/graph-engineering-ai-agents)
- [TrueFoundry — enterprise governance: identity, budgets, approval checkpoints, human nodes as first-class graph members](https://www.truefoundry.com/blog/graph-engineering-enterprise-guide)
- [AI Builder Club — Graph Engineering with Claude Code](https://www.aibuilderclub.com/blog/graph-engineering-with-claude-code) — "a graph of weak nodes is just slop produced in parallel"
- [Louis Bouchard — Without the Hype](https://louisbouchard.substack.com/p/graph-engineering-explained-what) — external verification, never self-review
- [Flowtivity — loops to graphs](https://flowtivity.ai/blog/graph-engineering-2026-guide-openclaw-codex/) — >50% per-node pass rate break-even; track cost-per-successful-completion
- [Frase — agentic SEO](https://www.frase.io/blog/ai-agents-for-seo) · [digitalapplied — agentic SEO in core updates](https://www.digitalapplied.com/blog/agentic-seo-during-core-updates-automation) · [arXiv workflow-optimization survey](https://arxiv.org/pdf/2603.22386)
- X: [@0xCodez KG pipeline](https://x.com/0xCodez/status/2080250266851463209) · [Anthropic workshop thread](https://x.com/0xCodez/status/2081017726261199185) · [@zachtratar skeptic take](https://x.com/zachtratar/status/2081530269044298084)

---

## 2. Review against this codebase and database

### 2a. What already IS graph engineering here (don't rebuild)

| 14-step concept | Existing implementation | Where |
|---|---|---|
| Org graph (stable named nodes) | Producer registry, sections A–F | `marketing_brain_skills/producers/REGISTRY.md` |
| Work graph with durable state | `marketing_brain_actions` rows, typed state machine pending → in_production → ready → approved → executed → measured, `killed` branch | `public.marketing_brain_actions` (+ `content_briefs` compat view) |
| Edges between graph stages | dispatcher → runtime → approval queue → publisher-sweep → measurement crons | `vercel.json` cron registry |
| Human checkpoint nodes (TrueFoundry's "approval checkpoints") | Matt, on exactly four edge classes: outbound sends, public publishing, ad spend, OAuth | §1 approval model, CLAUDE.md |
| Verifier edges (deterministic) | the mechanical-gate catalog (`ci:gates`), draft-first commit hook, `check_first_frame.py` | `scripts/check-*.mjs`, `docs/MECHANICAL_GATES.md` |
| Budgets + stop conditions | producer-runtime caps ($5/row, $15/run, 3 rows/run); gate ratchets | producer-runtime cron |
| Loop engineering | THE LOOP v1.1.0 + five-loop topology (Growth, Experience, Nurture, Demand, Transaction) with arbitration rules | `docs/DEVELOPMENT_PROCESS.md` |
| Code knowledge graph (Sense B) | codebase-memory-mcp: symbol graph, trace_path, Cypher, ADRs | session-start protocol |
| Runtime routing (agent classifies, code routes) | CRM sequence engine — **pause-on-reply is a live engagement-signal edge rerouting a workflow** | `/api/cron/crm-sequence-engine` |

### 2b. Database surfaces as graph nodes (per schema snapshot + DAL index; no new tables required for Waves 1–4)

| Node type | Table / view | Role in the graph |
|---|---|---|
| Signal nodes | `site_signal` (GA4 + GSC snapshots via `marketing-snapshot-*` crons; scope contract: per-page = `scope='page'`, GSC top-25/day so absence ≠ zero), `web_vitals` (by route), `target_queries` + `target_query_benchmark` (23 must-win queries, daily positions), `agent_insights` | inputs to optimization loops |
| Loop memory | `site_improvement_ledger` (experiment windows, baselines, `actual_delta`, per-class win-rate confidence) | the Learn edge — already the graph's memory organ |
| Work-graph state | `marketing_brain_actions` | durable orchestration state, survives sessions |
| Engagement/counter-metric nodes | `crm_people` + events (replies, opens), `listing_alerts` (typed alert engagement), sequence tables, newsletter tables when live | "how they respond" — Matt's question; today these signals stop at their own loop |
| Data-accuracy nodes | `market_pulse_live` (17 rows), `market_stats_cache` (10,955 rows), methodology stamp `v3-2026-05-07` | every figure a verify-workflow re-checks traces here or to Spark |
| **Anchor nodes (frozen)** | `crm_people` lead intake (via `getLeadIntake`), Vault closed transactions | ground truth no optimization loop may redefine |

Discipline constraints that bind every workflow node: DAL-first reads (G1/G8 — no raw
`.from()` outside `lib/data/`), schema snapshot instead of schema discovery, mixed-case
quoting, cache-not-raw-listings for market stats, §0 verification traces per figure.

### 2c. Constraints observed live, today, in this session (not theoretical)

1. **Sibling-session contention is real.** Two sessions contended for the push-with-gates
   lock for 30+ minutes, and a live-Supabase integration test
   (`send-deliverable.int.test.ts`, `crm_idempotency_keys`) flaked under concurrent load.
   Doctrine consequences: workflow agents that write files use worktree isolation;
   workflow agents do NOT run the full int suite in parallel (the suite hits production);
   at most one node per run touches git.
2. **Vercel build CPU is the bill.** No workflow topology may trigger builds per node.
3. **Approval edges terminate workflows.** A workflow may *stage* into the approval queue
   or produce drafts; no workflow node ever crosses a send/publish/spend/OAuth edge.
   Matt is a graph node the runtime cannot impersonate.
4. **Int-test flake aside, gates are the trusted verifier layer** — workflow findings
   route into gate candidates (per "gates, not prose"), not into prose reports that rot.

---

## 3. Design doctrine (binding on every workflow we build)

1. **Contract per node**: every `agent()` node returns schema-validated output; free-text
   nodes are only permitted at final synthesis.
2. **Edges are code**: dedupe/flatten/filter/join is deterministic script, never an agent.
3. **Pipeline by default; barrier only for cross-set operations** (whole-set dedupe,
   early-exit on empty, compare-against-other-findings).
4. **Verifier on every finding edge**, externally grounded: a finding is confirmed by
   re-running the query / reproducing the regression / probing the live surface — never
   by an agent agreeing with another agent's prose. Adversarial verify for high-stakes
   claims (§0 figures), perspective-diverse for multi-failure-mode surfaces.
5. **Cycles converge**: loop-until-dry, K=2 empty rounds, dedupe vs everything seen.
6. **Model tiering**: mechanical fan-out nodes run cheap (haiku/sonnet); judgment,
   adjudication, and synthesis stay on the session model. (Consistent with the standing
   Opus-orchestrator policy.)
7. **Worktree isolation only for parallel writers**; read-only fan-outs run unisolated.
8. **Every run smoke-tests on a slice first**; medium size guideline (<15 agents) unless
   the task demonstrably needs more; cost metric is cost-per-successful-completion.
9. **§0/§1/§2 outrank topology.** A workflow output containing market figures ships with
   per-figure traces; consumer-visible text passes brand voice; approval classes stop at
   Matt.
10. **Findings become gates.** A workflow that keeps re-finding the same defect class has
    found a missing mechanical gate; the fixer writes it.
11. **Anti-stranding contract (Matt's condition, 2026-07-30).** No work product ever sits
    uncommitted and unreported. Before any turn ends after spawning agents or workflows:
    `git status`, and every modified path is committed, reverted, or reported to Matt by
    name. Parallel writers use worktrees; every worktree merges or is removed before
    session end; workflow outputs are owned by the orchestrating session. Silence about
    uncommitted work is the violation this contract exists to prevent.

---

## 4. The workflow portfolio (Sense A) — full surface

Answering Matt's scope question directly: not just four workflows. The portfolio covers
site performance, GA4, Search Console, sitemaps, social, content, newsletters/sequences,
and engagement response. Grouped by wave (sequencing in §6).

### Wave 1 — verification seeds (highest stakes: license compliance + post-ship truth)

| # | Workflow | Diamond shape (split → work → merge) | Grounding |
|---|---|---|---|
| W1.1 | `/verify-figures <deliverable>` | citations.json → one agent per figure re-runs the named source query → adversarial comparator → per-figure verification traces; any delta blocks | live Supabase/Spark queries, §0 format |
| W1.2 | `/adversarial-audit <surface>` | per-surface probes (anon-key access, control group, rendered vs DB truth) → adversarial verify → confirmed defects + gate candidates | live HTTP with anon key + DB cross-check |

### Wave 2 — scoreboard graphs (site performance, GA4, GSC, sitemaps, SERP)

| # | Workflow | Shape | Grounding |
|---|---|---|---|
| W2.1 | `/scoreboard-sweep` | fan out one agent per signal domain (GA4, GSC, vitals, target queries, alert engagement, sequence replies) → each node FIRST verifies its snapshot cron's freshness, then pulls its 28d window → synthesis emits ONE ranked candidate list for the Growth iteration | `site_signal` scope contract, `target_query_benchmark`, `web_vitals`; stale source names its cron and blocks |
| W2.2 | `/vitals-regression` | one agent per hot route, CWV delta vs baseline → verifier reproduces → route, metric, delta, suspect commit range | `web_vitals` rows |
| W2.3 | `/sitemap-integrity` | agents per sitemap class: URL-count delta, sampled 200-checks, orphan routes (on disk, not in sitemap), canonical/robots consistency | live HTTP + filesystem |
| W2.4 | `/serp-defend` | one agent per priority-1 target query: live position, competitor movement, page freshness → verifier confirms losses before they become Growth candidates | `target_query_benchmark` + live SERP |

### Wave 3 — content, social, and response graphs (content creation + "how they respond")

| # | Workflow | Shape | Grounding |
|---|---|---|---|
| W3.1 | `/content-postmortem <window>` | one agent per measured `marketing_brain_actions` row → platform metrics pull → cross-platform synthesis (which class/format/geo wins where) → learnings written where the brain's next run must read them | `measured` rows + platform APIs |
| W3.2 | `/engagement-echo` | sweep sequence replies, alert click-throughs, newsletter events (when live) → classify intent (agent) → route by code: hot signals → CRM queue items/drafts; pattern signals → Growth/content priorities. **Read-and-stage only; zero sends** | `crm_people` events — closes the response edge upstream |
| W3.3 | `/competitor-recon` (scheduled ecosystem scan) | parallel agents per competitor surface (site, GBP, socials, new listings) → dedupe/rank at barrier → digest + design-recon refresh | live web; feeds Tier-4 producer recon files |
| W3.4 | `/pre-ship-review` | router on diff size (small → single pass; large → parallel lenses: correctness, DAL boundary, ODS/VOW, brand voice in copy) → judge panel merge | the diff + gates; complements `ci:gates` |

### Wave 5 (with W5.x numbering, see §6) — knowledge-graph track (Sense B)

- **W5.1** Business-KG evaluation memo only: Extract→Resolve→Assemble over CRM comms +
  deal docs, built only if a named consumer exists (candidate: TC smart docs). Go/no-go
  memo, no construction. The relational DB + MVs already answer today's queries.
- **W5.2** Codebase-KG freshness discipline: `detect_changes`/re-index wired into the
  post-commit routine + session-start; ADRs recorded for architecture decisions so agent
  memory outlives context windows. (This, not graphify, is the response to Matt's second
  link.)

---

## 5. Graph-of-loops upgrades (Sense C) — edges between the loops you already run

| # | Item | Detail | Acceptance |
|---|---|---|---|
| G.1 | Counter-metric pairing | Canon documents per loop: optimization metric ↔ counter-metric ↔ anchor. Growth: sessions/CTR ↔ lead quality ↔ `crm_people` intake. Nurture: touches ↔ unsubs/spam ↔ replies. Demand: CPL ↔ lead-to-appointment ↔ closed transactions. Content: views ↔ saves/DMs ↔ attributed leads | table in `docs/DEVELOPMENT_PROCESS.md`; each loop skill cites its pair |
| G.2 | Telemetry-freshness watcher | every snapshot cron's last-success age checked at the top of every loop iteration (and inside W2.1); stale scoreboard = blocked iteration, not wrong iteration | staleness check names the failing cron |
| G.3 | Cadence separation | fast loops (alerts, sends, measurement crons) may not change reference values owned by slow loops (positioning, pricing, brand); slow-loop reference changes require Matt | canon section |
| G.4 | Anchor declaration | `crm_people` lead intake + Vault closed transactions declared frozen anchors; changing how they're counted requires Matt sign-off | canon section |
| G.5 | Approval-model doctrine reconciliation | **RESOLVED — Matt, 2026-07-30: directive removed.** "The problem I was having was that there would be all of this uncommitted work lying around that I'd have no idea and no agent would tell me about it... As long as we can handle that, then I don't want any other rules or directives to keep this process from being optimized." Parallelism is unrestricted; the anti-stranding contract (doctrine rule 11) is the standing condition | ✓ recorded; Wave 1 unblocked |

---

## 6. Sequencing, acceptance, and cost

**Execution gate: nothing below runs until Matt says go.** (This document is the
deliverable of the current request — plan only.)

| Wave | Contents | Done when |
|---|---|---|
| 0 | This doc registered in the canon; G.5 decision from Matt | doc committed; Matt's yes/no on G.5 recorded |
| 1 | W1.1 + W1.2 built by hand-running once, saved to `.claude/workflows/`, smoke-run on a slice | W1.1 traces match a real market-report render; W1.2 reproduces a seeded defect with zero false-clean |
| 2 | W2.1–W2.4 | W2.1 replaces the growth-loop's serial ingest for one full iteration; W2.3 finds zero orphans or files them as fixes |
| 3 | W3.1–W3.4 | W3.1 post-mortem on the last measured content window; W3.2 stages ≥1 real hot signal into the CRM queue with zero sends |
| 4 | G.1–G.4 canon edges + loop-skill escape hatches ("3+ independent checks → dispatch the workflow") | `ci:process-canon` + `ci:loop-skills-canon` green; growth-loop cites W2.1 |
| 5 | W5.1 memo + W5.2 freshness discipline | memo delivered; next 3 architecture decisions carry ADRs |
| 6 (deferred) | Mechanical gate over `.claude/workflows/*` (finder-without-verifier, missing stop condition) — built only when drift actually occurs, per §6 gates-not-prose | first drift incident triggers it |

**Cost model.** A workflow multiplies token spend by agent count; coordination itself is
free (code, not conversation). Break-even requires >50% per-node pass rates — which is
why every wave starts verification-shaped (high pass-rate, high-stakes) and why
mechanical fan-out nodes tier down to cheaper models. Each first run goes out on a slice
with the `/workflows` view watched; cost-per-successful-completion recorded in this doc
per workflow after its smoke run.

**Explicit non-goals**: no LangGraph or external orchestration framework (the brain is
already a graph in Postgres with Matt-controlled approval edges); no graphify (redundant
organ); no business KG without a named consumer; no workflow that crosses a
send/publish/spend/OAuth edge; no speculative gates.
