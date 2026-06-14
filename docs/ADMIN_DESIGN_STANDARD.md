# Admin Design Standard — the bar every admin screen must clear

The admin is a **mobile app brokers live in**, not a desktop report squeezed onto a
phone. This is the rubric. A screen that fails any **HARD** rule does not ship.
The `design:review` gate screenshots each changed admin screen at 390px and scores
it against this doc.

## Why this exists
A token-lint and an overflow check both PASS a 30-row wall of red. They measure
syntax, not design. This standard measures whether a broker can glance at a screen
and instantly know what matters. "Buttons and text on a screen" is the thing we
are banning.

---

## The five laws (HARD — a violation blocks ship)

1. **Curate, never dump.** No screen renders an unbounded list of raw data. A home
   /overview list shows the **top 3–6**, prioritized, then **"See all (N) →"**.
   Full lists live on their own screen, paginated. (A dashboard mapping a whole
   data array straight into the DOM is an automatic fail.)
2. **One clear hierarchy per screen.** Exactly one primary thing, then secondary,
   then tertiary — expressed through size, weight, and spacing. If everything is
   the same visual weight, it's a dump. The most important action is reachable
   without scrolling.
3. **Every state is designed.** Empty, loading, and peak (too-many) states are all
   intentional — an empty section says what to do next, not a blank gap; a peak
   list caps + links out. No section may render nothing and leave a hole.
4. **Thumb-first.** Primary tap targets ≥ 44px. Bottom-reachable primary actions.
   No horizontal page overflow at 390px. Nav that scrolls, never piles.
5. **One shell, one rhythm.** Same app bar, same bottom tabs, same card style, the
   same spacing scale on every screen. A broker should never feel they changed
   apps. Design-system tokens + components only — no ad-hoc colors or hand-rolled
   controls.

## Craft rules (SOFT — reviewer judgment, fix unless there's a reason)

- **Spacing scale:** section gaps `space-y-4`/`gap-4` (mobile) → `6` (sm+); card
  padding consistent; generous breathing room over density.
- **Type scale:** screen title (one), section headers (sentence case, one weight),
  body, caption. Tabular-nums on every number. No more than ~3 sizes per screen.
- **Color with meaning:** status/urgency only (overdue = destructive, success =
  success). Color is a signal, not decoration. Never a wall of one color.
- **Summary before detail:** lead a data screen with a glanceable summary (a few
  KPIs / a count), then the prioritized detail.
- **Motion:** subtle, ≤200ms, respects `prefers-reduced-motion`. Tap feedback on
  every interactive element.
- **Progressive disclosure:** secondary info behind a tap (detail screen, sheet),
  not crammed onto the overview.

## Reference: junk vs thoughtful

| Junk (today) | Thoughtful (the bar) |
|---|---|
| "Needs your action · 30" → 30 red rows | Top 5 prioritized, "See all 30 →" |
| Active deals: every deal, full list | Top 3 with progress, "See all →" |
| Counts buried below a long list | A glanceable KPI strip near the top |
| Same long task list repeated twice on one screen | Once, capped, linked to the full screen |
| Blank gap when a section is empty | "All caught up — nothing due" |

## The review checklist (what `design:review` scores per screen)

- [ ] No horizontal overflow at 390px. (deterministic)
- [ ] No list renders more than 6 data rows without a "See all"/pagination. (deterministic)
- [ ] Empty state present for every list/section. (deterministic + visual)
- [ ] One obvious primary focus; clear visual hierarchy. (visual)
- [ ] Primary tap targets ≥ 44px. (visual)
- [ ] Consistent shell, spacing rhythm, type scale vs sibling screens. (visual)
- [ ] Color used only as a signal; no monochrome walls. (visual)
- [ ] Reads as a curated app screen, not a data export. (visual, the overall call)

Score 0–100 against the above. **Ship floor: 80, and zero HARD violations.**

## Process — design first
For any non-trivial admin screen: sketch the intent (what's primary, what's
capped, what's deferred) → build to it → run `design:review` → fix to ≥ 80 →
ship. Don't open the editor before deciding the hierarchy.
