---
name: verify-figures
description: W1.1 — adversarial re-verification of every figure in a deliverable's citations.json against its named primary source. Blocks on any delta. Doctrine - docs/plans/AGENTIC_GRAPH_ENGINEERING_2026-07-30.md §3; §0 of CLAUDE.md outranks everything here.
---

# /verify-figures <deliverable-dir>

Diamond: split -> parallel verify -> adversarial merge. Grounding: live Supabase/Spark
queries only. An agent agreeing with prose is NOT verification.

## Nodes

1. **split (code, zero tokens)** — read `<deliverable-dir>/citations.json`. One work
   item per figure: `{ figure, value, source, table, column, filter, query, fetched_at }`.
   Missing citations.json = FAIL immediately (a deliverable without citations does not
   ship, §0).

2. **verify-figure ×N (parallel, cheap model, fresh context each)** — contract per node:
   - objective: re-run THIS figure's named query against its named source, now.
   - output (schema): `{ figure, cited_value, live_value, delta_pct, query_ran, rows }`.
   - boundaries: one figure; no other figures; no prose conclusions.
   - Supabase: DAL function when one exists, else the exact query from the citation
     (quote mixed-case `listings` columns). Spark: live API pull.

3. **adversarial comparator (strong model)** — for each result, try to kill the match:
   window off-by-one, filter drift (SFR convention, status, geography), rounding that
   changes the narrative, stale `fetched_at`. Output: per-figure PASS/FAIL + reason.

4. **merge (code)** — write `<deliverable-dir>/verification-traces.md`, one §0 trace
   line per figure. ANY `|delta| > 1%` or FAIL blocks the deliverable (hard, per the
   Spark×Supabase reconciliation gate).

## Stop conditions

Every figure traced, or the block is reported with the failing figures named. No
partial "mostly verified" verdicts.
