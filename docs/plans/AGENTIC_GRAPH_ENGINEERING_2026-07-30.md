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
