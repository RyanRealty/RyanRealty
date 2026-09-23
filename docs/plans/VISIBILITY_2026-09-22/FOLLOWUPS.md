# Follow-up instructions sent to the fix agents after launch (they bind like the package spec)

All packages: Matt 2026-09-23, "Don't assume any rules from the past that might keep us from hitting our goals are
permanent. Nothing is permanent. Whatever it takes to reach our goals is what we need. If there's something out there
that we're enforcing that's keeping us back, then we really need to evaluate it and likely change it." Where a lock,
gate or plan line blocks being seen or converting, change it with evidence in the same commit (cite the directive and
the evidence) instead of stopping at a question. Still binding: §0, the four §1 approval classes, fair housing, MLS
rules; a removed indexed URL gets a 301 to its best successor with the GSC evidence recorded in the commit body.

- **p01:** noindex + sitemap removal for empty browse pairs is allowed with GSC evidence; twin consolidation can be a
  301 where evidence supports it. Add gsc-trend-5: /homes-for-sale/bend had 0 impressions 09-06..09-21; main's
  c29c2d79f made city pages "{City} real estate", so /homes-for-sale/{city} owns "{City} homes for sale": make it
  indexable, self-canonical, sitemapped once, server-rendered with listings, and linked from the city page and chrome.
- **p02:** the family page owns the head term; consolidating thin phase pages into it is allowed with evidence. Plats
  and phases link up to the community/family page with subordinate titles (gsc-trend-4: 'brasada ranch' spread over 65
  URLs; subdivision pages were the September gainer).
- **p03:** if the SSG budget gate keeps crawlers on cold 2.5 to 8.6 s renders and 500s, change it with evidence (e.g.
  pre-render the top N plats by impressions within a measured build budget).
- **p04:** keep the words identical for the same population; do not label 581 "inside city limits". The 581 vs 757
  split is the stale place_membership table (p09 owns the refresh); no DB writes in p04.
- **p05:** do the /buy, /activity, /tools/appreciation consolidation (301 with GSC evidence, pulled with the GSC
  credentials scripts/_gsc-by-class.mjs uses), the mobile phone tap target, and stop AdSense Auto ads on brokerage pages
  (update INT-036 in docs/plans/ENTERPRISE_MAP/matrix/INTEGRATIONS.md with the reason).
- **p06:** no sends, no re-running enrollments, no DB sequence-copy edits (draft the rewrite into the report); R-163
  stage semantics may change with a cited reason.
- **p07:** keep CCPA/CPRA opt-out and the consent banner's meaning; state per-tier collection in TRACKING_POLICY.md;
  apply its migration only through a non-MCP path the repo already uses (see p09's method).
- **p08:** add a daily GA4 health guard (browser session_start 0 for a day, or GA4 google/organic under 0.4x GSC
  clicks). Leave the MP mirror itself to p07.
- **p09 (URGENT):** place_membership newest computed_at 2026-08-23 21:32 UTC; 174 of 752 active Bend SFR tiles have no
  membership row; Bend MoS 579/(1054/6)=3.30 vs 752/(1054/6)=4.28. Authorized DB write: run refresh_place_membership
  through a non-MCP path (supabase-js rpc via the helper, or the DB-URL path found), then the compute_market_metrics
  chain in dependency order, print before/after (computed_at, city/bend active count, closed_6m, MoS, verdict), schedule
  it daily before the metric computes, and flag the scoreboard when it is older than 48 h. Report the migration method.
- **p10:** authorized, not questions: objective changes to visibility then conversion (taste median a no-regression
  floor, demoMatch a note, not a gate) in both site-queue skills, scripts/lib/taste-receipt.mjs and TASTE.md (rubric
  unchanged, freeze note says it covers the rubric only); VOICE.md governs voice (record the 09-20 em-dash lock there;
  delete ci:naked-verb-headings and seo-shell's BANNED list, keep its head-term contract; remove dash checks from
  check-dog-floater and check-deliverable-share-safety; unwire deleted gates); add the ledger-reference rule for
  commits touching metadata/canonical/robots/sitemap/redirects/middleware routing/ISR/URL builders (warning first if a
  hard fail would block every lane).
- **p11:** gsc-trend-1 full-fidelity store (page x date, query x page x date, page_class, exact-match benchmark that
  excludes quoted/bracketed/operator queries, degraded status per money class, brief seeds ranking nodes);
  gsc-trend-2 Learn normalizes surfaces and writes 'unmeasurable' instead of a false 0 (re-learn the 8 false zeros);
  gsc-trend-12 backfill the false-zero May days; apply the migration if a non-MCP path exists.
- **p13:** fix the /cities/bend "Old Bend" polygon with no >=44px chip partner (ci:tap-targets fails PR #352 at 390 and
  1440); add a unit test that every drawn place has a same-name chip. Aim payload work at mobile LCP p75: city 5,068 ms,
  neighborhood 9,924 ms, place-type 7,220 ms, housing-market 5,240 ms, subdivision 4,624 ms, community 4,176 ms.
