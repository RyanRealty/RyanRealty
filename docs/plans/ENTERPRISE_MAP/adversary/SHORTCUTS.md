# Adversary pass — shortcut / omission log

**Role:** Assume the first map pass cheated. List gaps.  
**Status:** OPEN — first self-adversary 2026-08-08 (same effort as map; ideal is second model later).

| ID | Finding | Severity | How found | Required fix before “closed” |
|----|---------|----------|-----------|------------------------------|
| S-001 | Capability matrix is SEED not cell-verified | HIGH | Process | Path probes per CAP row |
| S-002 | Integration health (token expiry, last success) mostly UNKNOWN | HIGH | INT matrix empty health fields | Probe logs/API |
| S-003 | Producer REGISTRY not fully enumerated into inventory | MED | Only skills count 119 | Parse REGISTRY.md to inventory |
| S-004 | vercel.json full cron path list not stored (only unique first segments) | MED | C-crons-vercel.json | Expand full paths + schedules |
| S-005 | Plan dispositions SEED — not re-read every plan body | MED | Disposition table | Spot-check ACTIVE plans end-to-end |
| S-006 | PROGRAM Tier-1 defects not re-verified on current main | HIGH | R-001 note | Re-run checks; don’t trust June findings blindly |
| S-007 | Admin page 170 vs token-gate 111 not row-diffed in map | MED | CAP-024/025 | Diff list outside gate |
| S-008 | Fan-out: 9 platforms verified in snapshot-channels source; **google-ads route NOT in PLATFORMS** | MED→action | Read route.ts 2026-08-08 | Fix ORPHAN_RELATIVE google-ads |
| S-009 | No consumer journey stage matrix on crm_people | MED | Conversation spine | Query stage distribution |
| S-010 | Factory CI duration/cost not measured | LOW | FAC-002 | Optional later |
| S-011 | ENTERPRISE_MAP not G44-registered | HIGH if committed | process-canon | Register before push |
| S-012 | Synthesis ADVANCEMENT_PLAN written before adversary PASS | MED | Process order | Label v0 DRAFT (done); no v1 until S-001/002/006 addressed |
| S-013 | Concurrent admin inbox not inventoried as file-level | LOW | Coordination | OK — ownership note sufficient |
| S-014 | Second independent model adversary not run | MED | Dual-model rule | Schedule Grok↔Claude swap pass |

## PASS criteria

- Zero HIGH open, or each HIGH has explicit residual risk accepted by Matt.  
- S-011 fixed before any production push including this package.  
- S-012: v1 plan only after HIGH cleared.

## Current verdict

**FAIL closed completeness** — expected at this stage.  
**PASS usefulness as navigation** — universe sized, dispositions named, streams cited, concurrent work isolated.

## Closed during grind
- S1a google-ads PLATFORMS fixed
- Cron classification closed enough for v0
- CAP-015 root cause: executed lack published_posts (20/20 sample)
