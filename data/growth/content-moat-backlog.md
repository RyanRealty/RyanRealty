# Content-moat backlog — what ryan-realty.com is not yet hosting

Candidate source for the Growth loop (`.claude/skills/growth-loop/SKILL.md` §3 Prioritize —
these enter the same `reach × gap × confidence ÷ effort` scoring as scoreboard-derived
candidates). Companion to the local-pack layer (`.claude/skills/local-seo/SKILL.md`).

**Evidence base (all pulled live 2026-07-09):**

- ryan-realty.com/blog — 11 published posts total, newest 2026-06-09 (fetched 2026-07-09).
- bendpremierrealestate.com/blog archives — 70 posts 2026 YTD, 103 in 2025, 110 in 2024
  (~8–10/month), newest published 2026-07-09 (fetched 2026-07-09).
- ryan-realty.com/guides — 11 published guides, ALL auto-generated per-city market
  snapshots in a single "Market Guides" category; zero evergreen/editorial guides
  (fetched 2026-07-09). The `guides` table + `/guides/[slug]` route + index already exist.
- Google results for "moving to bend oregon guide" — every ranking result is competitor
  content: movetobend.com (Strategic Realty), movingtobend.com, housesinbendoregon.com,
  isellbendoregon.com, bendlifestylerealtors.com, livinginoregon.net, askdoss.com
  (searched 2026-07-09). Ryan Realty has one thin LP at /buy/relocation.
- Google results for "bend oregon real estate market update" — dated monthly BLOG POSTS
  rank (bendpremierrealestate.com, bendpropertysource.com/Ladd, movetobend.com,
  enjoybendlife.com weekly), not live data dashboards (searched 2026-07-09).
- Sitemap audit 2026-07-09: blog/guides/communities/zip/market-report URLs were already
  emitted; /schools (58 pages) + /parks (~20 pages) were absent — fixed same day in
  `app/sitemap.ts`.

**Standing constraints:** every candidate ships through THE LOOP (one scored class per
iteration), content drafts route through `marketing_brain_skills/produce/` with a
`marketing_brain_actions` row + Matt approval (producer freeze: no new producers, no new
content crons — cadence is in-session), §0 verification trace on every number, VOICE.md
Five Laws, fair-housing-clean geography language (describe the place, never the people).

---

## Ranked candidates

### 1. Monthly dated market-update post pack (highest confidence, lowest effort)
- **Gap:** competitors rank for "bend housing market update <month year>" with hand-written
  monthly posts; our newest blog post is a month old. Dated posts are the ranking unit for
  this query class — the live /housing-market and /pulse surfaces don't capture it.
- **Our unfair asset:** `market_pulse_live` + `market_stats_cache` + the monthly market
  report orchestrator already produce §0-verified figures with traces. Competitors
  hand-copy stats; ours are machine-verified.
- **Shape:** one post per geography per month — Bend, Redmond, Sisters, Sunriver, La Pine
  + a Central Oregon roundup (6 posts/month) — into `blog_posts` via produce/. Each post
  cross-links its live /guides snapshot + /housing-market page (the moat competitors
  can't follow).
- **Target queries:** "bend oregon housing market update", "bend real estate market
  <month year>", per-city variants.

### 2. Relocation hub — own "moving to Bend" (highest reach)
- **Gap:** the entire query class belongs to competitors; several run whole domains on it.
  Out-of-state relocators are the premium client segment.
- **Our unfair assets:** the honest-even-when-inconvenient brand voice (the #1-ranking
  competitor post literally wins on "brutally honest" — that is OUR positioning), plus
  live data pages to anchor every claim: /schools (58 pages), /parks, /central-oregon
  trails/events/venues/golf, /tools calculators, per-city market guides.
- **Shape:** pillar guide "Moving to Bend, Oregon" in `guides` + spokes: moving from
  California / from Portland–Seattle, cost of living with real numbers, jobs + remote
  work, winter driving + wildfire smoke (honest), renting-first, with-kids (facts +
  /schools links only — fair-housing-clean). Internal-link mesh into city pages and
  listing search.
- **Target queries:** "moving to bend oregon", "moving to bend from california",
  "cost of living bend oregon", "living in bend oregon pros and cons".

### 3. Populate /guides with Stage-2/3 evergreen guides (shelf already built)
- **Gap:** guides family = market snapshots only. No seller-cost, legal, or land content
  anywhere on the site. Competitors cover these shallowly; none can cite the law or the
  data the way in-house expertise here can.
- **Candidates (each one guide, ORS/OAR-cited where legal):** what it actually costs to
  sell a house in Oregon · Oregon seller property disclosure explained (ORS 105.462) ·
  buying land in Deschutes County: wells, septic, zoning (the OWRD/DIAL land-CMA data
  moat — no Bend competitor hosts this) · Deschutes County property taxes explained ·
  HOA + CC&Rs in Central Oregon resort communities · 1031 exchanges for Central Oregon
  investors.
- **Target queries:** long-tail Stage 2/3 ("cost to sell a house in oregon", "oregon
  seller disclosure requirements", "buying land in central oregon well septic").

### 4. Complete the community deep-dive set
- **Gap:** blog covers ~4 of the 14 registry resort communities (Brasada, Black Butte,
  Eagle Crest, Sunriver angles); 14 Bend neighborhoods have data pages but no editorial
  deep-dives. Competitors (Bend Premier luxury-community posts) actively publish here.
- **Shape:** one editorial deep-dive per resort community + Bend neighborhood, each
  anchored to its live /communities or neighborhood data page. ~24 pieces, sequenced
  behind #1–#3.

### 5. Sold-data transparency pages (data moat — gated)
- **Shape:** "what homes actually sold for in <city/neighborhood> last month" — closed
  data competitors don't publish.
- **Gate:** verify MLSCO/IDX sold-data display rules BEFORE building. Do not ship without
  the rule citation.

### 6. Schools/parks enrichment (now that they're in the sitemap)
- Enrich the 58 school pages with verified academic facts (ODE report cards — facts only,
  never rankings-as-steering) and cross-link from the relocation hub. Low effort, feeds #2.

### 7. Local-authority backlink pass
- Bend Chamber + OAR memberships, Bend Magazine / Source Weekly mentions, event
  sponsorship pages — the gbp SKILL §2c authority spillover. Competitor backlink audit
  needs Ahrefs auth (currently unauthenticated) or manual pulls; park until then.

---

## Cadence + measurement

- **Velocity floor to compete:** ≥8 posts/month (Bend Premier's observed rate). #1 supplies
  6/month structurally; #2–#4 fill the rest until exhausted.
- **Measure per growth-loop §7:** GSC clicks/impressions per new URL, position on the
  target query, leads by source. Stamp baselines in `site_improvement_ledger` before
  shipping each class. Re-verify the evidence base above monthly — competitor cadence
  claims expire after 30 days (§0).
