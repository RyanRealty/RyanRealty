# docs/press/ — press-citable market artifacts

Audit item 17: the weekly Central Oregon market report as an artifact a journalist can quote
without doing any work. Local outlets (Bend Source, Central Oregon Daily) already quote market
data regularly and already rank. Earning those citations is what drives grounded retrieval.

## What is here

- **`generate-press-market-report.mjs`** (in `scripts/`, not here) generates the artifact from
  live Supabase data.
- **`weekly-market-report-<date>.md`** the generated artifact: a quotable summary, a per-city
  figure table, the months-of-supply formula and verdict (imported from
  `lib/market/classify.ts`, never retyped), the named source, and a full §0 verification trace.
- **`weekly-market-report-<date>.citations.json`** the same figures as structured data, one
  entry per figure, for anyone who wants to check the math programmatically.
- **`pitch-email-draft.md`** a drafted pitch to a local outlet. **Not sent.** No verified
  reporter contact exists yet, see the file for what is still needed before it can go out.

## Regenerating

```
node scripts/generate-press-market-report.mjs
```

Pulls a fresh snapshot from `market_pulse_live` (10 to 15 minute freshness) and
`market_stats_cache` (6-hour freshness, latest rolling 90-day window) for Central Oregon and
every `REPORT_CITIES` entry with live MLS inventory (`lib/data/geo/report-cities.ts`), covers
the months-of-supply formula and verdict thresholds from `lib/market/classify.ts`, and writes a
dated `.md` + `.citations.json` pair. Each run is a snapshot, not a live page. Regenerate weekly
before pitching, since a stale figure sent to a reporter is exactly the §0 failure mode this
artifact exists to prevent.

## What this is not

Not a public web page and not wired to a cron. It is a file-based artifact for direct outreach
(email, a press kit) or for hand-pasting into a pitch. If this earns citations, promoting it to
a scheduled cron (`vercel.json`) and a public `/press` route is the natural next step, but that
is a separate decision, not implied by this build.

## Sending anything from this directory

CLAUDE.md §1 class 1: outbound messages to a real person require Matt's explicit per-action
approval, every time. Nothing in this directory has been sent. `pitch-email-draft.md` is a file
for Matt to review and send himself, or to explicitly approve for a send tool.
