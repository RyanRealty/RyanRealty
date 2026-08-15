---
name: adversarial-audit
description: W1.2 — adversarial audit of a named surface with externally grounded probes (anon HTTP, DB cross-check, rendered truth). Confirmed defects become gate candidates. Doctrine - docs/plans/AGENTIC_GRAPH_ENGINEERING_2026-07-30.md §3.
---

# /adversarial-audit <surface>

Diamond: probe fan-out -> adversarial verify -> confirmed defects + gate candidates.
A finding is confirmed by reproducing it against the live environment — never by a
second agent agreeing with the first agent's prose.

## Nodes

1. **plan probes (strong model)** — enumerate the surface's failure modes as ORTHOGONAL
   aspects (not steps): anon-key access, signed-out vs signed-in render, empty/error
   states, rendered value vs DB truth, mobile 390 vs desktop 1280, dead links/CTAs.
   Each aspect gets a probe contract: objective, exact URL/query, expected, output schema.

2. **probe ×N (parallel, cheap model, fresh context)** — run exactly one probe:
   live HTTP with the anon key, a DAL/DB cross-check, or a rendered screenshot.
   Output: `{ aspect, expected, observed, evidence (url/screenshot/rows), verdict }`.
   A probe that cannot gather evidence returns `null` — fan-in tolerates missing inputs.

3. **adversarial verify (strong model)** — attack each FAIL: reproduce it a second way
   (§0 rule: absence from one query shape is a fact about the query). Only reproduced
   defects survive.

4. **merge (code)** — dedupe against everything SEEN, group into defect CLASSES (fix
   the class, not the instance), and emit: confirmed defects with reproduction steps +
   one gate candidate per recurring class (findings become gates, doctrine rule 10).

## Stop conditions

All planned probes ran or returned null; defect list deduped; zero unconfirmed claims
in the output. Read-only: this workflow never edits product code.
