# Statistics engine mission — goal of record

Opened 2026-08-17. Matt: "There is only one source of statistics that come out of
our site onto any public-facing surface, and that's always through this engine."

This file is what the final review pass is measured against. It is not a status
log — status lives in git and in the artifact linked from the session.

## What exists when this is finished

1. **No public payment figure comes from a hardcoded rate.** `listings.estimated_monthly_piti`
   is priced from the ingested 30-yr rate, every active listing has been repriced so the
   column is vintage-consistent, and the interactive calculator on the listing page seeds
   from the same number. Today every one of ~7,581 actives implies exactly 6.50% while the
   live rate is 6.67%.

2. **National series flow on a schedule and are readable through the DAL.**
   `stat_series` + `stat_observations` are populated by a registered cron using the FRED API
   with vintage (`realtime_start`/`realtime_end`) preserved, so a revision inserts rather
   than overwrites. `is_public` is true only for series a human cleared.

3. **Chart colour is a named rule, not a habit.** The two-colour lock (navy/cream) gains
   exactly one indication accent with a written scope: it marks an exception — a drawdown,
   a decline, a threshold breach — and never decorates.

4. **One page mockup exists as the calibration piece** for the remaining four, built in the
   locked v3 language with real data and real media.

## What a real user does with it

A visitor opens any listing and sees a monthly payment computed from this week's mortgage
rate, not April's. A visitor reading a market page sees Central Oregon against the nation,
each figure carrying its source and its vintage. Matt opens the mockup on a phone and can
say keep or kill.

## The bar

- Every figure traces to a named source and a vintage (§0).
- `npm run ci:gates` green, exit code read unpiped.
- Verified against the live database or a real browser, not against unit tests alone.
- Nothing lands that an adversarial reader can show is untrue.

## Explicitly out of scope

The remaining four page mockups, the freshness alarm, and the one-source gate. Those follow
once the calibration piece is approved and the ingest is proven in production.
