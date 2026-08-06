# MOBILE GRIND — LEDGER

Defect-CLASS remediation from Matt's iPhone audit, 2026-08-06. Each reported defect is treated as a
sample of a class: census every instance repo-wide, fix all, gate the class. Append-only.

| ID | Class | Found | Fixed | SHA | Notes |
|---|---|---|---|---|---|
| E1 | Environment smoke | — | — | — | ci:gates exit 0 · tsc exit 0 · dev attached at :3000 (sibling session owns the process) · 375×812 |
| C-01 | Claim/query mismatch | 3 | 3 | `0e01a3b7` | 11 map subtitles audited; 3 claimed single-family over an unfiltered query; 6 call sites fixed |
| C-02 | Two numbers, one geography | 2 | 2 | `56a61008` | Matt's 1,000-vs-491 closed (now 499 == 499). `/open-houses/[city]` badge was *mislabeled* "active listings" over open-house data |
| C-09 | Component discards caller intent | 6 | 6 | `93dca181` | `KbFeatured` threw away `viewAllLabel` on every page with >12 listings. 18 mounts. Now "See all 38 Tetherow homes for sale" |
| C-11 | className on wrapper, not control | 1 | 1 | `d21834de` | The white square. Cream-on-cream ~1.1:1 → **14.23:1**. Also: second tap now cancels; dead `.listening` CSS deleted |
| C-14 | Fixed-chrome collision | 10 | 10 | `8db6c07c` | Measured −14px overlap at 375 → **+10px clearance**. One CSS rule served all ten `overlay` routes |
| C-16 | Degenerate breadcrumb | 1 | 1 | `23985687` | `Home › self` on the highest-traffic page, ~11% of the mobile viewport. Sole single-item trail of 16 callers |
| C-17 | Duplicate stacked sections | 1 | 1 | `8534f1f7` | City page was the last stacker after Matt's 2026-07-29 directive. **New gate G61** proven |
| C-27 | Admin help FAB | 1 | 1 | `f0d0b4b7` | Removed. `/admin/help` survives; tours parked per D9 |

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


## Status at checkpoint — 2026-08-06

**9 of 29 classes DONE and pushed** (E1 + 8 defect classes). 20 remain.

**Shipped:** `0e01a3b7` · `56a61008` · `93dca181` · `f0d0b4b7` · `8534f1f7` · `d21834de` · `8db6c07c` · `23985687`

Instances found vs fixed: **25 / 25**. One new gate (G61) written and proven. Every class
browser-verified at 375×812 on at least two routes, with measured values rather than eyeballing.

### Remaining, in dependency order

| Phase | Classes | Note |
|---|---|---|
| 1 | C-03 | dead data source / stale cache-version claims |
| 2 | C-04, C-05, C-06, C-07, C-08 | voice; the sibling session closed many instances — **re-census before starting** |
| 3 | C-10, C-12, C-13 | silent drop · dead-end card · number-format divergence |
| 4 | C-15, C-28 | rail clipping · interstitial stacking |
| 5 | **C-18 first** → C-19, C-20, C-21 | `resolveGeoScope` is infrastructure; three classes sit on it |
| 5 | C-22, C-23, C-24, C-25 | sticky bar · in-page expansion · placeholder chips · bottom sheet |
| 6 | C-26 | prospecting CMA review — **do the tracking-trap step FIRST** |

### Two gate frictions worth fixing before the next run

1. `ci:css-layers` baseline is keyed by `file:line`, so any `kb.css` edit re-reads baselined offenders
   as NEW. Hit twice; both times the selector set was proven byte-identical. Key it on selector alone.
2. `ci:file-size-budget` blocks on a single added comment line in the large page files. Three classes
   needed comments folded into existing lines. Not wrong, but plan for it.
