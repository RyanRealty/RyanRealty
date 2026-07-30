# Agentic Graph Engineering — incorporation plan (2026-07-30)

**Status: live.** Research + plan produced 2026-07-30 at Matt's request. Execution routes
through THE LOOP; each phase below is a backlog item with acceptance criteria.

---

## 1. What the term actually means (research summary)

"Graph engineering" broke into mainstream AI-engineering discussion June–July 2026 as the
layer above prompt engineering (one model call), context engineering (what the call sees),
and loop engineering (one agent's observe-act-verify cycle). Two distinct senses travel
under the same name:

**Sense A — orchestration graphs.** Design multi-agent systems as explicit graphs: nodes do
work (a node can be a full agent run), typed edges route between them, shared state travels
along edges. Key patterns: fan-out + synthesis, parallel reviewers, adversarial
verification, orchestrator-workers, evaluator-optimizer. Anthropic's five composable
workflow patterns (prompt chaining, routing, parallelization, orchestrator-workers,
evaluator-optimizer) are the canonical vocabulary. Claude Code ships this natively as
**dynamic workflows**: a JavaScript script orchestrating subagents (`agent()`, `pipeline()`,
`parallel()`, phases, JSON-schema outputs, resume, budgets), saved to `.claude/workflows/`
and invoked as `/commands`.

**Sense B — agentic knowledge graphs.** Give agents graph-shaped permanent memory that
outlives the context window: Extract (entities + S-P-O triples) → Resolve (entity
dedup) → Assemble (canonical nodes, typed edges, provenance) → Query (serialize a
subgraph, reason over it, cite edges). This is the GraphRAG / Andrew Ng "agentic knowledge
graphs" lineage. Benchmarks claim ~53% vs ~43% accuracy over vector-only retrieval on
multi-hop questions (GraphRAG-Bench).

**The skeptic case, which we adopt as doctrine:** practitioners (Zach Tratar; Louis
Bouchard's "Graph Engineering, Without the Hype") point out this is largely a rebrand of
workflow orchestration. The durable substance is five things made explicit: **state,
handoffs, verification, budgets, stop conditions.** LangChain's three-year retrospective
adds: graphs fit workflows with *known structure but uncertain details*; they fail on
open-ended exploratory work; "a graph of weak nodes is just slop produced in parallel."
Cost caveat: parallel graphs only beat loops when per-node pass rates stay above ~50% —
track cost-per-successful-completion, not raw tokens.

### Sources

- MarkTechPost, [Prompt vs Loop vs Graph Engineering](https://www.marktechpost.com/2026/07/29/prompt-engineering-vs-loop-engineering-vs-graph-engineering/) (2026-07-29)
- LangChain, [3 Years of Graph Engineering with LangGraph](https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph)
- Claude Code docs, [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Anthropic, [When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- AI Builder Club, [Graph Engineering with Claude Code](https://www.aibuilderclub.com/blog/graph-engineering-with-claude-code) and [Graph Engineering Guide 2026](https://www.aibuilderclub.com/blog/graph-engineering-guide-2026)
- Louis Bouchard (Substack), [Graph Engineering, Without the Hype](https://louisbouchard.substack.com/p/graph-engineering-explained-what)
- Vin Vashishta (Substack), [Knowledge Graph Engineering for Agents](https://vinvashishta.substack.com/p/knowledge-graph-engineering-for-agents-9e6)
- Flowtivity, [From Loops to Graphs](https://flowtivity.ai/blog/graph-engineering-2026-guide-openclaw-codex/)
- X discourse: [@0xCodez KG pipeline thread](https://x.com/0xCodez/status/2080250266851463209), [Anthropic workshop thread](https://x.com/0xCodez/status/2081017726261199185), [@zachtratar skeptic take](https://x.com/zachtratar/status/2081530269044298084)

---

## 2. Where Ryan Realty already stands (audit, run 2026-07-30)

We are further along than the discourse assumes. Honest mapping:

| Graph-engineering element | What we already have |
|---|---|
| Loop engineering | THE LOOP v1.1.0 + the loop skills (growth-loop, tc-builder, crm-e2e, experience-rollout) |
| Org graph (stable roles) | Producer registry (`marketing_brain_skills/producers/REGISTRY.md`) — named nodes with scoped capabilities |
| Work graph (ephemeral tasks) | `marketing_brain_actions` rows with a typed state machine (pending → … → measured) — a work graph persisted in Postgres |
| Typed edges / handoffs | Dispatcher → runtime → approval queue → publisher-sweep → measurement crons |
| Verification edges | The mechanical-gate catalog (`ci:gates`), §0 verification traces, `check_first_frame.py` |
| Stop conditions / budgets | Producer-runtime cost caps ($5/row, $15/run, 3 rows/run); gate ratchets |
| Code knowledge graph (Sense B) | codebase-memory-mcp: symbol graph, `trace_path`, `query_graph`, ADRs |
| Orchestration-as-code (Sense A) | **MISSING** — `.claude/workflows/` does not exist; multi-agent fan-outs are re-improvised each session |

The gap is narrow and specific: **recurring multi-agent jobs are not codified as saved,
rerunnable workflow scripts**, and our highest-stakes verification work (§0 figures,
post-ship adversarial audits, site-consistency sweeps) is exactly the "3+ independent
checks" shape where fan-out + adversarial-verify graphs earn their cost.

What we will NOT do: rebuild the marketing brain on LangGraph or any external framework
(it already is a graph, persisted in Postgres with approval edges Matt controls); build a
business knowledge graph without a named consumer; adopt the vocabulary as a rewrite
excuse.

---

## 3. Backlog

### Phase 1 — Workflow library (Sense A): codify recurring fan-outs

Create `.claude/workflows/` and land these as saved, versioned workflow scripts. Each is
built by hand-running the graph once, then saving the script (per the Claude Code adoption
path). Each ships with a smoke run on a small slice before first full run.

| # | Workflow | Shape | Acceptance criteria |
|---|---|---|---|
| 1.1 | `/verify-figures <deliverable>` | Read `citations.json` → one agent per figure re-runs the named query fresh → adversarial verifier compares printed vs claimed → emit per-figure verification traces | Run against the most recent market-report render; every figure gets a trace; any delta > 0 blocks with the §0 conflict format |
| 1.2 | `/adversarial-audit <surface>` | Fan out per-surface probes (anon-key access, control group, rendered output vs DB truth) → adversarial verify each finding → output confirmed defects + gate candidates | Reproduces at least the known-defect classes from the 2026-07 audits when pointed at a surface with a seeded defect; zero false "clean" |
| 1.3 | `/site-consistency-sweep` | One agent per page family diffed against the `/cities` gold standard (data source, DAL usage, module kit, chrome) → merge into one ranked report | Covers every registered page family; findings dedup to one row per root cause |
| 1.4 | `/pre-ship-review` | Parallel reviewers (correctness, DAL boundary, ODS/VOW compliance, §2 voice in copy diffs) → adversarial verify → ranked findings | Run on a real recent diff; findings verified, no unverified claim reported |

Rules of the library: every script's `meta` block names its phases; every finder stage is
paired with a verifier stage (external verification, never self-review only); every loop
has a stop condition ("two rounds with nothing new"); default size guideline stays
`medium` (<15 agents). Scripts commit to the repo like any other code — full autonomy,
post-hoc review.

### Phase 2 — Wire graphs into THE LOOP

| # | Item | Acceptance criteria |
|---|---|---|
| 2.1 | Amend `docs/DEVELOPMENT_PROCESS.md`: the "verify exhaustively" rung may dispatch a saved workflow; document the five explicit elements (state, handoffs, verification, budgets, stop conditions) as the graph checklist; document cost-per-successful-completion as the metric | `ci:process-canon` green; canon names the workflow library |
| 2.2 | Loop skills gain a graph escape hatch: when an iteration requires 3+ independent checks, invoke the matching saved workflow instead of serial checks | growth-loop, crm-e2e, tc-builder SKILL.md each reference the library; `ci:loop-skills-canon` green |
| 2.3 | Doctrine reconciliation with the standing "no background subagents" rule: workflows are script-driven, journaled, resumable, and visible in `/workflows` — the original objection (stranded, untracked work) does not apply. **Flagged to Matt for sign-off before 2.2 lands**, since it amends a standing directive | Matt's explicit yes recorded in this doc |

### Phase 3 — Knowledge graph (Sense B): selective, consumer-driven

| # | Item | Acceptance criteria |
|---|---|---|
| 3.1 | Discipline, not construction: architecture decisions get recorded as ADRs in codebase-memory (`manage_adr`) so agent memory outlives context windows | Next 3 architecture decisions have ADRs |
| 3.2 | **Evaluate only** — a business KG (Extract→Resolve→Assemble over CRM comms + deal docs) is built only when a named consumer exists (candidate: TC smart docs anticipating required documents from deal context). Until then the relational DB + MVs remain the answer | A one-page eval memo with a go/no-go, not code |

### Phase 4 — Gate (deferred until violation recurs, per §6)

If workflow scripts drift (finder stages without verifier stages, missing stop
conditions), the fixer writes a mechanical check over `.claude/workflows/*` meta blocks.
Not built speculatively.

---

## 4. Cost honesty

Nothing here is free. A workflow run multiplies token spend by its agent count; the
break-even is real (>50% per-node pass rate). Mitigations baked into Phase 1: smoke runs
on a slice first, medium size guideline, stop conditions in every loop, and workflows
reserved for the verification-shaped work where serial checking is the thing that is
actually expensive (Matt's review cycles and missed defects).

---

## 5. Deeper research addendum (2026-07-30, second pass at Matt's request)

Matt's question: does this factor in site performance, GA4, Search Console, social,
content creation, newsletter/search engagement, sitemaps — the whole operation? The
deeper literature answers it directly.

**The mature framing (Eigent, "Graph Engineering for AI Agents"):** graph engineering is
not N workflows. It is "wiring many feedback loops — metrics, evals, audits, policies,
and workflows — into a network where they watch, constrain, and correct one another,
instead of each loop quietly drifting away from reality." One loop = a variable you care
about, a target, a gap measurement, and an action that shrinks the gap. The graph is the
organization of those loops, with explicit edges encoding **trust, authority, and
cadence**.

Design rules that matter for us:

1. **Grounded vs ungrounded.** A loop consuming only internal reports can stay perfectly
   self-consistent while drifting from reality. Every loop needs an **anchor** — an
   external reference the graph's dynamics cannot touch (verified closed transactions,
   `crm_people` lead counts, GSC clicks, cash events). Dashboards feeding dashboards is
   the failure mode.
2. **Metrics pair with counter-metrics.** Push CTR and watch conversion; push send volume
   and watch unsubscribes/spam-complaints; push page speed and watch build cost. When the
   optimization metric climbs while the counter-metric falls, the graph has surfaced a
   Goodhart problem instead of hiding it.
3. **Cadence separation.** Fast loops (daily alert sends, cron measurement) must not
   override slow loops (positioning, brand, pricing strategy). Slower, higher-level loops
   own the reference values of faster ones.
4. **Watch the watcher.** Sensors decay — a stale snapshot cron is a wrong scoreboard.
   Telemetry freshness itself needs a loop (the 8-day-stale `listing_tile_mv` incident is
   our own proof).

The four structural failures at scale: Goodhart's Law, upward blindness (loops can't
question their own targets), inter-loop conflict (independent loops fight over shared
resources without knowing it — our canon's arbitration section already exists for this),
and measurement decay.

Additional sources: [Eigent — Graph Engineering for AI Agents](https://www.eigent.ai/blog/graph-engineering-ai-agents) ·
[TrueFoundry — enterprise governance for agent graphs](https://www.truefoundry.com/blog/graph-engineering-enterprise-guide) ·
[Frase — AI agents for SEO 2026](https://www.frase.io/blog/ai-agents-for-seo) ·
[digitalapplied — agentic SEO during core updates](https://www.digitalapplied.com/blog/agentic-seo-during-core-updates-automation) ·
[bosio.digital — loops vs graphs](https://bosio.digital/articles/loops-vs-graphs) ·
[arXiv survey — workflow optimization for LLM agents](https://arxiv.org/pdf/2603.22386)

---

## 6. Full-surface node inventory — Matt's operation as a graph of loops

Every surface Matt named, mapped to the loop that already ingests it and the graph gap:

| Surface | Existing loop/node | Signal tables | Graph gap |
|---|---|---|---|
| GA4 (sessions, conversions, bounce) | Growth loop step 1 ingest | `site_signal` (via `marketing-snapshot-ga4`) | grounded ✓; needs counter-metric pairing (traffic vs lead quality) |
| Search Console (queries, CTR, position) | Growth loop + target-query benchmark | `site_signal`, `target_queries`, `target_query_benchmark` | top-25/day coverage means absence ≠ zero — a coverage-aware verifier node |
| Core Web Vitals / load speed | Growth loop diagnosis rule (LCP > 2.5s) | `web_vitals` by route | no freshness watcher; no regression fan-out (one agent per hot route) |
| Sitemaps / crawl surface | Growth loop scope (sitemap/robots/canonicals); per-class sitemap cache | — | no periodic sitemap-integrity workflow (URL count deltas, orphan routes, 200-check) |
| Social platforms (IG/FB/LinkedIn/YouTube/GBP) | `marketing-measurement-loop` cron measures published rows | `marketing_brain_actions` (measured), platform APIs | measurement exists per-post; no cross-platform synthesis node (what class of content wins where) feeding back into brain priorities |
| Content creation | The marketing brain IS the work graph (pending → measured) | `marketing_brain_actions`, `content_briefs` view | post-mortem exists per §5 canon; no fan-out post-mortem workflow comparing cohorts of content against engagement anchors |
| Newsletter | spec-only (mail infra done: DMARC, Resend) | `newsletter_*` per spec | when it ships, engagement (opens/clicks/replies/unsubs) must enter as counter-metric nodes from day one, not retrofitted |
| Outbound sequences ("how they respond") | CRM sequence engine — **pause-on-reply is already a graph edge** (an engagement signal rerouting a workflow) | `crm_people`, sequence tables, email events | reply/engagement signals stop at the sequence; they don't flow upstream to content strategy or Growth prioritization |
| Saved searches / alerts | typed alert engine (Phase 0–3 shipped) | `listing_alerts` | alert engagement (opens, click-throughs to listings) is not yet a scored input to Growth/content loops |
| Leads (the anchor) | `getLeadIntake` on `crm_people` | `crm_people` | this IS the anchor metric — every optimization loop above should be paired against it |
| Verified transactions (the deepest anchor) | Vault | Vault tables | ground truth for revenue attribution; untouched by any optimization loop — correct, keep frozen |

The five-loop topology in `docs/DEVELOPMENT_PROCESS.md` (Growth, Experience, Nurture,
Demand, Transaction) already IS an org graph with arbitration edges. What the research
adds is the missing edge *types*: counter-metric pairings, anchors, cadence rules, and a
telemetry-freshness watcher.

---

## 7. Phase 1b — derived workflow catalog (full surface)

Beyond the four verification seeds in §3, derived the same way (fan-out + verify, stop
conditions, external grounding). Build order follows the same rule as everything else:
highest leverage first, one at a time, smoke-tested on a slice.

| # | Workflow | Shape | Grounding |
|---|---|---|---|
| 1b.1 | `/scoreboard-sweep` | Fan out one agent per signal domain (GA4, GSC, vitals, target queries, alert engagement, sequence replies) → each verifies freshness + pulls its 28d window → synthesis node produces ONE ranked candidate list for the Growth iteration | replaces serial step-1 ingest; every domain checked for staleness before its numbers are trusted |
| 1b.2 | `/vitals-regression` | One agent per hot route measuring CWV deltas vs baseline → verifier reproduces any regression → output = route, metric, delta, suspected commit range | `web_vitals` rows, not memory |
| 1b.3 | `/sitemap-integrity` | Agents per sitemap class: URL count delta vs last run, sample-200-check, orphan detection (routes on disk not in sitemap), canonical/robots consistency | live HTTP + filesystem |
| 1b.4 | `/content-postmortem <window>` | One agent per measured content row in the window → pull platform metrics → cross-platform synthesis: which class/format/geo won where → writes learnings the brain's next run must read | `marketing_brain_actions.measured` + platform APIs |
| 1b.5 | `/engagement-echo` | Sweep sequence replies, alert click-throughs, newsletter events (when live) → classify intent → verify classification → route upstream: hot signals to CRM queue, pattern signals to Growth/content priorities | `crm_people` events — closes the "how they respond" edge Matt asked about |
| 1b.6 | `/serp-defend` | One agent per priority-1 target query: live position, competitor movement, our page's freshness → verifier confirms losses before they become candidates | `target_query_benchmark` + live SERP |

### Phase 2b — graph-of-loops upgrades (edges, not nodes)

| # | Item | Acceptance criteria |
|---|---|---|
| 2b.1 | Counter-metric pairing: canon documents, per loop, its optimization metric + counter-metric + anchor (Growth: sessions/CTR ↔ lead quality ↔ `crm_people` intake; Nurture: touches ↔ unsubs/spam ↔ replies; Demand: CPL ↔ lead-to-appointment ↔ closed transactions) | table lands in `docs/DEVELOPMENT_PROCESS.md`; each loop skill cites its pair |
| 2b.2 | Telemetry-freshness watcher: every snapshot cron's last-success age checked at the top of every loop iteration; stale scoreboard = blocked iteration, not wrong iteration | staleness check in 1b.1; a stale source names its cron |
| 2b.3 | Cadence rules written into the canon: fast loops (alerts, sends, measurement crons) may not change reference values owned by slow loops (positioning, pricing, brand); slow-loop changes require Matt | canon section + loop-skills reference it |
| 2b.4 | Anchor declaration: `crm_people` lead intake and Vault closed transactions declared as frozen anchor nodes — no optimization loop may redefine how they're counted | canon section; any change to lead-counting requires Matt sign-off |
