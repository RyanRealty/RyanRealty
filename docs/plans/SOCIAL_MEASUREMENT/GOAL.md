# Social measurement — end-to-end goal

**Written 2026-08-26 before the work, so the final review has something to be measured against.**

## What Matt asked

"I need a way to measure all of my social feeds and how do I use all of that to create traffic
for my site and ultimately leads." Then, after the first findings: "i need to accurately track
all traffic."

## What was actually wrong

Measurement was never the blocker. Tagging, the funnel and the channel feeds were all built and
correct. Four separate systems reported healthy while producing fabricated numbers, and every one
passed every freshness check for months:

| System | Defect | Duration |
|---|---|---|
| Grok image-to-video | photo URL sent as a string; xAI wants `{ url }`. Every call 422'd | since 2026-08-18 |
| Instagram | Meta retired `impressions` at v22; one dead name 400s the whole batch, so `reach` and `saved` were zeroed as collateral | 869 days |
| Facebook page + post | five of seven metrics retired; same collateral mechanism zeroed clicks and reactions | months |
| YouTube video scope | `impressions`/CTR cannot exist at video dimension; the code writes 0 anyway | months |

The common shape: monitoring asked "did it run?" and the answer was always yes. Nobody asked
whether the output was possible. §0 treats a published number as a claim; a fabricated 0 is a
false claim no freshness check can see.

## Done when a real user can

1. Press **Produce draft** on `/admin/today`, get a real listing video in the approval queue, and
   approve it. (Shipped `e4ad701f`; verified live on MLS 220215931.)
2. Read Instagram and Facebook numbers that came from the platform, with any metric we could not
   read ABSENT rather than written as 0. A genuine 0 from the API still stores.
3. Boot a session and be told, without asking, which feeds are landing on schedule while
   reporting nothing — as a prompt to verify, never as a verdict.
4. Trust that a feed whose zeros are REAL (a dormant channel) is recorded as such with evidence,
   so the guard cannot become an alarm that gets ignored.

## Locks

- Never relabel a different measurement under a retired metric's name. `page_views_total` is
  profile views, not impressions; `page_follows` is a total where `page_fan_adds` was a delta.
  Each keeps its own name.
- Facebook reach has no replacement at this API version. It is simply unavailable. Do not
  substitute a stand-in.
- A metric that cannot be READ is null and its row is dropped; `marketing_channel_daily.value`
  is NOT NULL, so absence is the only honest way to say "unmeasured".
- The consent ceiling is Matt's policy call, not a code cleanup. 99.5% of visitors never answer
  the banner, so their UTMs are stripped on arrival. Referrer survives. Do not change what
  essential consent permits as a side effect of wanting better attribution.

## Out of scope

Whether social is worth investing in at all. Google sends 14% of traffic; social sends a fraction
of a percent. This work makes social measurable, not significant.

## Closing review — 2026-08-26

The review pass exercised every path against the live account instead of trusting the diff, and
that is the only reason this doc can claim done. **It caught a fix that did not work.**

`37c7a1ad` shipped as "Instagram reports real numbers again". It fixed the MEDIA-level function
only. `getIGAccountInsights` still asked for the retired `impressions`, which 400s the whole
batch, so the account feed kept writing zeros for `reach`, `profile_views` and `website_clicks`
— the exact metrics the commit claimed to have recovered. The silent-zero guard flagged all four
on its first real run; the live call reproduced the failure; the rewrite fixed it.

Three further facts the probes established, none of which were guessable from the code:

- Instagram v22 splits account metrics into two families that cannot be asked for together:
  `reach`/`views`/`profile_views` and the whole engagement set need `metric_type=total_value`
  and are read off `total_value.value`; `follower_count` is a `period=day` time series read off
  `values[0].value`. Putting `views` in the plain call is what 400'd it.
- `follower_count` at `period=lifetime` is a hard 400. The old snapshot call could never have
  worked — the lifetime total is the `followers_count` FIELD on the user object (1,259). What
  `follower_count` returns per day is a delta, so it is stored as `new_followers`.
- `saved` is spelled `saves` at account scope. Facebook post reach is gone at every variant
  (`post_impressions`, `_unique`, `_organic`, `post_activity`) — but `post_video_views` was
  already being fetched and thrown away, and `post_reactions_like_total` resolves fine. Both are
  now published.

Measured after: one day writes **77 rows** across the four scopes, every value read from the
platform, none null. Before: 5 account metrics that were all fabricated zeros.

The lesson is the one the guard exists for. A fix that typechecks, passes its tests and reads
correctly can still be wrong about the platform, and only the platform can say so. A commit
message is a claim; the API response is the source.
