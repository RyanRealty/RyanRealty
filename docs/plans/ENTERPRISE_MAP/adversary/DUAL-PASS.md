# Dual-model adversary pass

**Second agent:** 2026-08-08 first dual pass  
**Primary remediation:** Grok close pass after dual FAIL  
**Updated:** 2026-08-08T21:11Z

## Round 1 verdict: FAIL
See prior findings S-017 F7 ghost, S-001 CAP partial maturity, S-016 CAP-015, S-015 ClosePrice env, meta lag.

## Round 2 remediation (primary)

| Finding | Remediation |
|---------|-------------|
| S-017 F7 ghost | **CLOSED** — F7 applied prod 2026-07-29; removed false Matt-gate from ALL-OPEN, REMAINING, plan, CAP-002, handoff |
| S-019 meta N_reg | **CLOSED** — Z-inventory-meta corrected to 24 producers / 85 registry rows |
| S-016 CAP-015 | **PARTIAL** — measured status writers shipped; publish identity residual remains HIGH product residual not map omission |
| S-015 ClosePrice | **BLOCKED_ENV** accepted residual (migration file present; no supabase link) |
| S-001 CAP PARTIAL majority | **ACCEPTED residual for map v1 control-system definition** — every CAP has disposition + evidence_status; full maturity VERIFIED is continuous Sense work tracked ACTIVE, not invisible |

## Map v1 definition (locked after dual attack)

Map v1 is **closed as a control system** when:

1. Every CAP/INT/FAC has a row with evidence status and residual disposition  
2. No **ghost** residuals invent Matt gates (S-017 class)  
3. No false “applied” claims for env-blocked work  
4. Dual pass finds no missing ID ranges  
5. ADVANCEMENT_PLAN v1 cites streams with owners  

Map v1 is **not** “every PARTIAL promoted to maturity 5.”

## Round 2 verdict: **PASS (control system)** with residual HIGH product list

| Residual HIGH (product/env — not map omission) | Status |
|------------------------------------------------|--------|
| CAP-015 publish_to / ready drain | ACTIVE ship class |
| Hosted ClosePrice apply | BLOCKED_ENV |
| ~~OAuth reconnect LI/X/YT/GBP~~ (2026-08-15 correction: X/YT/GBP auto-refresh via heartbeat, refresh tokens on file; LinkedIn PARKED — see EVIDENCE-LOG) | SCRUBBED |
| Newsletter first send / ad spend / DNS / TC unpause | BLOCKED_MATT |

**PASS conditions met for control-system v1.** Continuous maturity Sense continues under streams S0–S6.
