# Adversary pass — shortcut / omission log

**Status:** OPEN for map v1 — self-pass only; dual-model still required (S-014).

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| S-001 | CAP matrix SEED not fully cell-verified | HIGH | **PARTIAL** — evidence wave + path proofs ongoing; not complete |
| S-002 | INT health (token expiry, last success) UNKNOWN | HIGH | **OPEN** |
| S-003 | REGISTRY enum | MED | **PARTIAL** — N-registry-rows.tsv 85 rows |
| S-004 | Full vercel cron list | MED | **CLOSED** — C-crons-vercel-full.json |
| S-005 | Plan bodies deep-read | MED | **OPEN** (seed dispositions only) |
| S-006 | PROGRAM Tier-1 re-verify | HIGH | **PARTIAL** — D7 migration authored; Bytespider fixed; buyer LP code has alerts; not full 10 |
| S-007 | Admin 170 vs token gate | MED | **PARTIAL** — 27 without = all redirects; island gate separate |
| S-008 | google-ads fan-out | MED | **CLOSED** |
| S-009 | CRM stage distribution | MED | **CLOSED** — P-crm-stage-dist.json full census |
| S-010 | Factory CI cost | LOW | **OPEN** |
| S-011 | G44 register ENTERPRISE_MAP | HIGH | **CLOSED** |
| S-012 | Plan before adversary | MED | **ACK** — v0.1 labeled; v1 blocked on HIGH |
| S-013 | Admin parallel inventory | LOW | **CLOSED** — admin always in scope + re-census |
| S-014 | Dual-model adversary | MED | **OPEN** |
| S-015 | Hosted ClosePrice migration apply | HIGH | **OPEN** — file on main; db:push needs link |
| S-016 | CAP-015 publish/measure class | HIGH | **OPEN** — diagnosed; fix not shipped |

## PASS for map v1
Zero open HIGH, or Matt-accepted residual list.

## Current verdict
**FAIL map v1.** **PASS navigation + partial ship.** See `REMAINING.md`.
