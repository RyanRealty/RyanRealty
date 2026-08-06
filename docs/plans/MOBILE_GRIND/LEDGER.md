# MOBILE GRIND — LEDGER

Defect-CLASS remediation from Matt's iPhone audit, 2026-08-06. Each reported defect is treated as a
sample of a class: census every instance repo-wide, fix all, gate the class. Append-only.

| ID | Class | Found | Fixed | SHA | Notes |
|---|---|---|---|---|---|
| E1 | Environment smoke | — | — | — | ci:gates exit 0 · tsc exit 0 · dev attached at :3000 (sibling session owns the process) · 375×812 |
| C-01 | Claim/query mismatch | 3 | 3 | `0e01a3b7` | 11 map subtitles audited; 3 claimed single-family over an unfiltered query; 6 call sites fixed |

## Standing environment findings

1. **A sibling session shares this worktree.** Its dev server owns port 3000 — attached rather than
   started a second one, and never stashed its uncommitted files (design-audit capture tooling + 4
   untracked audit scripts). Do not kill PID on :3000.
2. **The dev pane never paints the Google map.** `window.google.maps` loads, but `.gm-style` node count
   stays 0 even with the section scrolled into view. The map badge's count-up only runs in the map's
   `onLoad`, so the badge renders `0` regardless of the data behind it.
   **Consequence: every map class (C-01, C-02, C-12, C-21, C-25) must verify `totalActive` and feature
   counts from the RSC flight payload, not from the rendered badge.** A badge reading 0 is not evidence
   of a defect here.
3. **`tsc --noEmit` OOMs at default heap** while the sibling's dev server is running. Use
   `NODE_OPTIONS=--max-old-space-size=8192`.
4. **Radix/overlay clicks time out** through the pane's coordinate clicker. Dismiss modals with
   `javascript_tool` `.click()`.
5. **First paint at 375px stacks two interstitials** — the sign-in modal and the cookie banner together
   cover the entire hero for a visitor with no prior cookie state. Logged as class C-28.

## Scope note — the voice session

Matt confirmed the parallel voice work finished. Re-census on current local showed it had already
closed several instances this mission originally listed:

- `with the live market behind every one` → 0 occurrences (was 4 route families)
- `Click any dot …` → 0 occurrences (was 10)
- homepage hero rewritten; the "Real numbers, direct from the brokers" tail is gone
- `app/cities/[slug]` map subtitle now reads "every property type" — honest, so C-01 skipped it

Still open on local and owned by this mission: `SELF_PRAISE` projection gap (3 of 6 canon words),
`title = 'Explore'` placeholder default, 6× `Confirmed at office`, `← DRAG / SWIPE →`, and the two
Tetherow waitlist strings.
