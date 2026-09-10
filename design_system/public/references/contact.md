# References — `contact`

Table mark: **49** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/contact/page.tsx` · sample URL: `/contact`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The #reach doors row — four identical cards restating the same phone number twice with no photo, map, or live data behind any of them; this is where momentum stops, and it is the most prominent thing in the first viewport at both sizes.

## External pages to beat (one sentence each)

1. **Apple Contact / Support** (https://support.apple.com/contact) — One dominant reach path; alternatives are lighter text, not four equal cards.
2. **Stripe Contact / sales** (https://stripe.com/contact) — Quiet claim, one primary CTA, people photographs as trust — not a repeated link grid.
3. **Linear contact craft** (https://linear.app/contact) — Hairline restraint with a single primary ask visible without scrolling past identical doors.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Doors.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `app/about/_v3/AboutFaces.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Quiet.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **hero figure (one Call at display scale) or faces-first; never four equal door cards**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c contact <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.


## SITE-63 proof variants (awaiting Matt's pick)

Named variants behind `?taste_variant=` on `/contact`:

| Name | Form |
|---|---|
| `quiet-doors` | Current Quiet + primary Call door + lighter reaches (baseline) |
| `call-figure` | Phone number as **hero figure** inside Quiet; no four-door grid |
| `faces-first` | AboutFaces opens at H1; one Call door; claim Quiet secondary |

Decision sheet: [`contact-decision-sheet.html`](./contact-decision-sheet.html)

**Question for Matt:** Which contact fold wins — `quiet-doors`, `call-figure`, or `faces-first`? Losers are deleted in the pick commit.
