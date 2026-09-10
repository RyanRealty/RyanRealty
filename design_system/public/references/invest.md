# References — `invest`

Table mark: **25** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/invest/page.tsx` · sample URL: `/invest`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

#place — the only section in view. Two memo-style paragraphs with a void beside each and a hairline rule at the bottom; nothing in the first screen states a number, shows an image, or gives a reason to keep scrolling, so no, this is not a screen anyone stops on.

## External pages to beat (one sentence each)

1. **LoopNet Central Oregon investment search** (https://www.loopnet.com/) — Opens on live inventory density and filters — the underwrite job is visible before any prose.
2. **Compass Commercial / Bend investment pages** (https://www.compass.com/) — Leads with active income-property counts beside the claim, not a README about the page.
3. **FT / Bloomberg markets openers** (https://www.ft.com/) — One hero figure + scrubbable series; the claim is a number the reader can interrogate.

## Adapt from shipped code (do not generate from adjectives)

- `components/site/v3/V3Quiet.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Instrument.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."
- `components/site/v3/V3Ledger.tsx` — open the file; adapt its markup/CSS rather than restating "quiet / editorial / expensive."

## House form to reach for

Per TASTE.md preference order, replace the dull display with: **hero figure (active income-property count) beside the Quiet claim; then emphasis line with scrubber for the underwrite math**.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c invest <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
