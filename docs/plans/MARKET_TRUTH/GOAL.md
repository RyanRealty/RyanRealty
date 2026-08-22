# Market Truth — end-to-end goal

Opened 2026-08-22 by `EXECUTE.md`. This is the mission bar for the dedicated review pass.

## When finished

Ryan Realty publishes every market figure through **one fact layer, one membership rule, one metric registry, one compute job, and one read function (`getMetric`)**. Gates make the old split-definition path fail the build.

A real user (Matt, a licensed Oregon principal broker; a client opening a CMA; a visitor on `/sell`) sees the **same number for the same question** on every surface. Every figure traces to rows counted, method, window actually used, `computed_at`, and confidence. A figure without that trace does not ship.

Nothing public moves until a reconciliation report of live vs shadow values has been reviewed (SPEC D3).

## Phases (from EXECUTE.md)

1. **Phase A — adversarial audit.** Re-derive the package. Produce `AUDIT-FINDINGS.md`. Do not build.
2. **Phase B — build** only if the verdict is safe-to-build (as-is, or with listed blocker-fixes applied). Steps 0–9 on the EXECUTE board, top to bottom.

Locked definitions (D1–D13) are not re-litigated. Everything else is open to the audit.

## Done

`EXECUTE.md` §5 is literally true, every Step 0–9 **Done when** clause is true, and a dedicated review pass has walked a real consumer surface end to end against the shadow layer (no public flip until D3).
