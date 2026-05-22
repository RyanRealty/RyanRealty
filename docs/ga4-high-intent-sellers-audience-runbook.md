# GA4 audience: "High-intent sellers" — manual UI build

**Last item from the GA4 admin config (15/16 applied programmatically).** The `ga4-admin.mjs` script failed to create this one audience because the GA4 Admin API's filter syntax for numeric-parameter comparisons (`percent_scrolled > 74`) does not match what `dimensionFilterGt()` emits. The UI build path takes 90 seconds and is the recommended fix.

## What this audience captures

Visitors who:

1. Viewed `/lp/seller-home-value` (the canonical seller LP), **AND**
2. Scrolled past 74% of the page (deep engagement signal)

Membership window: 30 days. This is the audience to retarget for the HNW elderly Bend homeowner campaign — they self-selected as serious sellers by scrolling past the form.

## Build steps (Matt, ~90 seconds)

1. Open https://analytics.google.com → property `Ryan Realty` (id `527333348`).
2. Admin (gear icon, bottom-left).
3. Property column → **Audiences**.
4. Click **New audience** → **Create a custom audience**.
5. Name: `High-intent sellers`
6. Description: `Visited /lp/seller-home-value AND scrolled past 74%. 30-day window. Use for retargeting HNW seller campaigns.`
7. Membership duration: **30 days**.
8. **Add condition** (first):
   - Event: `view_landing_page`
   - Add parameter filter: `lp_variant` exactly matches `seller-home-value`
9. Click **AND** below the first condition.
10. **Add condition** (second):
    - Event: `scroll_depth`
    - Add parameter filter: `percent_scrolled` greater than `74`
11. Save.

The audience will start populating immediately and reach full 30-day membership in 30 days. Available as a Google Ads remarketing audience within ~48 hours after Google Signals sync.

## Verification

After save, re-run the GA4 admin audit to confirm:

```bash
node scripts/ga4-admin.mjs audit
```

The audit JSON should show `audiences.count = 16` (was 15) and a row with `displayName = "High-intent sellers"`.

## When to use this audience

- **FB retargeting:** import as a custom audience to Meta Ads via the GA4 → Google Ads bridge (only if signed up for Google Ads). Or rebuild the same filter as a Meta Custom Audience using the `Lead` pixel event with the same lp_variant param.
- **Google Ads remarketing:** native — appears in Google Ads Audience Manager after Google Signals sync.
- **Stop-rules:** when an existing FB seller campaign is below 1% conversion rate AND this audience size is > 500, shift spend to this audience instead. The 74%-scroll filter is a much stronger predictor than the cold-traffic LP visit count.
