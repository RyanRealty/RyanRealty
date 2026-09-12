# References — `about`

Table mark: **31** (`design_system/public/taste-table.json`, instrument v1-2026-09-08, evaluated 2026-09-08).
Route: `app/about/page.tsx` · sample URL: `/about`.

Cite this file from the SITE node brief. Hand it to the evaluator so `beats` is judged against a named page, not an invented compliment.

## What the table says is dull

The #who contact-link stack — it is a column of seven anchor tags with an arrow icon, no image, no data mark, nothing that earns a second look before the reader either clicks a phone number or leaves.

## External pages to beat (one sentence each)

1. **Compass About** (https://www.compass.com/about/) — Steal STRUCTURE (story, proof, reach), not coast-to-coast scale and not a faces-first Meet the Team.
2. **Redfin / SIR Heather Wells** (2026-09-07/12 brief) — Reviews and dated local closings are the proof; skip fee/Rocket copy.
3. **Stripe About** (https://stripe.com/about) — Quiet claim + one proof object; no phone-book stack of equal weight links.

## Adapt from shipped code (do not generate from adjectives)

- `app/about/_v3/AboutFirm.tsx` — open the file; the About opener is the firm story, not AboutFaces.
- `components/site/v3/V3Proof.client.tsx` — open the file; client reviews are the primary proof.
- `app/about/_v3/AboutTeamTeaser.tsx` — photo + name only; every door is `/team`.
- `components/site/v3/V3Doors.tsx` — Call | Text | Email | Schedule, Contact match.

## House form to reach for

Per TASTE.md and the 2026-09-12 Matt/Researchy lock: **firm-story hero; V3Proof reviews; local closings; Contact four-up; compact inquiry; Who you work with teasers → /team only**. A page that opens on three broker Cards fails, even if looking/taste likes the portraits.

Banned fallback: another stacked Quiet → figure-row → ledger. If the section is data, pick a form from: hero figure · stat tile with sparkline · emphasis line with a scrubber · horizontal bar · dot strip · slope · small multiples · beeswarm · map with data-encoded cells · table.

## Variants rule

A NEW data-display section on this class ships as two or three named variants behind one prop. Capture with:

```bash
node scripts/take-route-shots.mjs --variants a,b,c about <url>
```

Matt picks from the decision sheet; losers are deleted in the commit that records the pick.
