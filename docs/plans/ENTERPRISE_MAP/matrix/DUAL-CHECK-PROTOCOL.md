# Dual-check UNKNOWN protocol (MAP-019)

When a claim cannot be verified in-session:

1. Write **UNKNOWN** (not empty, not assumed green).
2. Record: what was tried, what blocked, dual-check method.
3. Second agent (or second model) must attempt the same cell with instructions: **assume first agent lied**.
4. Only after second pass agrees → promote to VERIFIED, or keep UNKNOWN with dual-check stamp.

## Dual-check methods

| Method | Use when |
|--------|----------|
| Second agent adversary | Map cells, plan completeness |
| Live re-query | DB counts, token expiry |
| Code path re-read | Wiring claims |
| Prod HTTP smoke | Deploy / public route claims |
| Matt confirmation | Gated ops only |

## Residual UNKNOWNs that need dual-check for map v1

Tracked in `adversary/SHORTCUTS.md` and per-cell matrix notes. Closing map v1 requires either VERIFIED or dual-checked UNKNOWN for every CAP/INT/FAC.
