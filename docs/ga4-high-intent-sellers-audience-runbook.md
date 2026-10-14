# GA4 audience: "High-intent sellers"

**Built by `scripts/ga4-admin.mjs`; there is no manual step (2026-10-14).** This page used
to give UI steps for a definition that could never match. It now records the live one.

## Definition

Live as `properties/527333348/audiences/16124906126`, created 2026-10-14, 30-day membership:

- Event `scroll_depth` with `page_type` exactly `sell` AND `depth` greater than 74.

`V3SectionTracker` pushes `scroll_depth` with `page_type` (`sell` on every /sell page) and
`percent` at 25/50/75/100. The GTM GA4 Event tag sends `page_type` as page context and folds
`percent` into `depth` (`lib/analytics/ga4-browser-events.ts`, `GA4_PARAM_ALIASES`), so GA4
holds `depth` and never `percent`. The server mirror in `/api/visitors/track` sends
`scroll_depth` with `page_type` and no depth, so only the browser hit can match. Checked on
production 2026-10-14 with every analytics request blocked: /sell pushed `scroll_depth`
with `page_type` `sell` and `depth` 25, 50, 75 and 100.

## History

The 2026-05-22 definition needed `view_landing_page` with `lp_variant` `seller-home-value`
AND `scroll_depth` with `percent_scrolled` over 74. No page sent `view_landing_page` from
2026-08-01 to 2026-10-09, and no tracker sends `percent_scrolled`, so it matched no one. It
is kept, renamed "High-intent sellers (retired 2026-10-14, never matched)".

## Changing it

GA4 audience filters cannot be edited after creation. Change the spec in
`scripts/ga4-admin.mjs`, add the audience to `REBUILT_AUDIENCES` with that day's date, and
run `node scripts/ga4-admin.mjs apply-audiences`: it renames the old audience, creates the
new one, and touches no key event or dimension. `node scripts/ga4-admin.mjs audit` lists
the result. A new audience fills from its creation onward; GA4 backfills up to 30 days only
for lists it shares with Google Ads.

## When to use this audience

- **FB retargeting:** import as a custom audience to Meta Ads via the GA4 → Google Ads bridge (only if signed up for Google Ads). Or rebuild the same filter as a Meta Custom Audience using the `Lead` pixel event with the same lp_variant param.
- **Google Ads remarketing:** native — appears in Google Ads Audience Manager after Google Signals sync.
- **Stop-rules:** when an existing FB seller campaign is below 1% conversion rate AND this audience size is > 500, shift spend to this audience instead. The 74%-scroll filter is a much stronger predictor than the cold-traffic LP visit count.
