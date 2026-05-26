# Seller Acquisition Strategy — Ryan Realty (locked 2026-05-26)

> **Reference data:** `out/design-recon/fb-lead-gen-ad/raw.json` (5,380+ scraped competitor FB ads).
> **Companion:** `marketing_brain_skills/competitor-design-recon/SKILL.md`.
> **Wires into:** the 6-tier paid campaign infrastructure shipped 2026-05-26 (see `docs/plans/CROSS_AGENT_HANDOFF.md`).

---

## The competitive opening

Of **5,380 competitor real-estate FB ads scraped May 18-22**, only **1.2% (66 ads)** target home sellers. The other 98.8% promote specific listings to buyers. Of the 66 seller-gen ads, **zero** come from Central Oregon competitors — every Cascade Sotheby's, Cascade Hasson, Compass Bend, and Windermere Central Oregon ad in our scrape is buyer-targeting.

**This is a marketing opening.** Sellers in Bend / Sunriver / Redmond / Sisters are not being directly courted by competing brokerages on Meta. The first brand to run sustained, high-quality seller-acquisition creative in Central Oregon owns the position.

---

## Why seller-gen is different from listing-gen

| Dimension | Listing/buyer ad | Seller-acquisition ad |
|---|---|---|
| Hero image | Specific home photo | Broker face, area landmark, market chart, valuation tool screenshot, OR sold-home with "JUST SOLD" overlay |
| Headline | "5BR/3BA on 2 acres" / address | "What's your home worth?" / "Thinking of selling?" |
| Body | Specs, price, features | Pain framing (uncertainty, timing), credibility (just sold X), offer (free CMA, market report) |
| CTA | "Learn more" / "See details" | "Get my home value" / "Get my CMA" / "Free consultation" |
| Landing page | `/listing/[id]` or IDX search | `/lp/seller-home-value`, `/home-valuation`, `/sell/valuation` |
| Lead quality | Buyer who wants THAT house | Homeowner who *might* list in 6-24 months |
| Funnel length | Days to weeks | Months to a year+ |
| Conversion event | `Lead` from inquiry form | `Lead` from valuation form, follow-up CMA delivery |
| Audience strategy | Open buyer interest | Owner-targeted (MLS upload, Database, lookalike), seller-LP retarget |

A seller costs more to acquire upfront (longer nurture) but is worth 10-30x a buyer lead because a listing produces both the seller commission AND a pipeline of future buyer transactions from the open houses, marketing exposure, and post-close network effect.

---

## Five creative archetypes (from competitor data)

Ranked by evidence of working (long ad lifetime + multiple variants):

### Archetype 1 — "Just Sold" social proof (HIGHEST EVIDENCE)

**Proof:** The Helgemo Team at Compass has 3 ads running 141-147 days each. Tram Real Estate, Nzingha Johnson, Dan Anton all use this pattern recently.

**Pattern:**
- Hero: Photo of the sold home (not interior — exterior, ideally with sold sign or stat overlay)
- Headline: `JUST SOLD in [Neighborhood]` (with 🏡 emoji is common but not required)
- Body: Address, sold price, list-to-sold stat ("$2,135,000 — above asking"), broker name + brokerage
- Implicit message: "I close deals. I can close yours."
- CTA: "Learn more" → broker website (NOT the listing detail page)
- Best for: warming the Database (Tier 1) and TOFU (Tier 2A/2B)

**Ryan Realty adaptation:**
- Use REAL Ryan Realty closed deals (Vault is source of truth for closed transactions — never SkySlope per `CLAUDE.md` data accuracy rules)
- Brand-locked design: navy + cream, Amboqia headline "JUST SOLD" + AzoSans body, no gold accents (retired)
- Required stat callouts: list price, sold price, days on market, % above/at/below asking
- Headshot of the listing agent (Matt / Paul / Rebecca) in bottom corner
- Landing URL: `/lp/seller-home-value?utm_source=meta&utm_campaign=just-sold-[neighborhood]&utm_content=[agent-slug]`

**Volume needed:** 1 just-sold ad per closed deal, 4-6 in rotation at any time. Refresh monthly.

---

### Archetype 2 — "What's your home worth?" valuation lead magnet (BEST FUNNEL)

**Proof:** High Falls Sotheby's IR (Premium Properties parent), Living in the Hamptons, Dielmann Sotheby's IR, Tania Agathos all run this with dedicated `/home-valuation` landing pages.

**Pattern:**
- Hero: Either area landmark photo OR valuation-tool UI screenshot (the "calculator preview")
- Headline: `How much is your [city] home worth?` — sometimes "instant value" framing
- Body: One line, no fluff. "Get your free home valuation today."
- CTA: "Learn more" or "Get quote" → `/home-valuation` page
- Strongest signal: long-active ads with valuation-URL landing pages

**Ryan Realty adaptation:**
- We already have `/lp/seller-home-value`, `/home-valuation`, `/sell/valuation` LPs wired (these power the AUD-CORE-Sellers-180d / -14d retargeting audiences)
- Hero: drone shot of subject neighborhood (Tetherow, NW Crossing, Awbrey, 97703 zones) OR a clean "INSTANT HOME VALUE" type-set card with Amboqia headline
- Body: "How much is your Bend home worth in this market?" or "Get your Central Oregon home value in 60 seconds."
- LP must deliver a real instant valuation (RentCast / RentSpree / our own AVM blend) NOT just a contact form, or this ad will hit Meta's "misleading" gate
- Best for: Tier 4 MOFU Retargeting (already wired) + Tier 2B 97703 Premium (uses 97703 MLS audience)

**Volume needed:** 1 evergreen version per city/neighborhood. Refresh creative every 60-90 days to avoid fatigue.

---

### Archetype 3 — "Thinking of selling?" direct ask + market data

**Proof:** Lisa Rosengard at properties (167 days active), David Vargas, Heidi Choiniere, John Zeiter, Aline Rodrigues.

**Pattern:**
- Hero: Broker face card OR market chart (price appreciation graphic)
- Headline: "Thinking about selling your home?" or "Considering selling in [area]?"
- Body: A specific market stat ("Naperville to Hinsdale homes appreciated 145% over X") + offer (free consultation, market report)
- CTA: "Learn more" or phone CTA ("Call now")
- This pattern doubles as broker-trust + market-credibility

**Ryan Realty adaptation:**
- Use Central Oregon-specific stats from `market_pulse_live` / `market_stats_cache` (per `docs/DATABASE_FOR_AI_AGENTS.md` — these are the canonical sources)
- Example: "Bend home values are up X% YoY. Thinking about selling? Here's what your home is worth in today's market." (verified against the cache before publish per CLAUDE.md §0)
- Hero variants: broker face (Matt/Paul/Rebecca per `design_system/ryan-realty/assets/team/`) OR a single big stat with Amboqia + a small chart
- LP: `/sell/plan` or a city-specific "/sell/{city}" route if we add it
- Best for: Tier 1 Database Nurture (warm, low-intent broad warming) + Tier 4 MOFU

**Volume needed:** 1 per city, refreshed quarterly when market stats refresh.

---

### Archetype 4 — Niche-specific seller pitch

**Proof:** Heidi Choiniere ("Thinking about selling in SW Florida? This market does not reward guessing"), Tami Hill Fegert ("iBuyer guide — up to 3 offers FAST"), Amanda Bryan ("Luxury listings deserve a strategic playbook").

**Pattern:**
- Hero: Either broker face or premium-aesthetic photo
- Body: Hyper-specific to one seller pain point — competing offers, FSBO failure, downsizing, expired listing, second home, divorce, etc.
- The angle does the targeting work — Meta finds the right people once the message is sharp enough
- Best for high-intent niches where generic "what's your home worth" is too broad

**Ryan Realty adaptation — niches we can own:**
- **Expired listings** — already have `/lp/expired-listing` LP wired with the empathy-first voice per `marketing_brain_skills/producers/expired-listing-lp/SKILL.md`. Run an ad targeted to homeowners who recently expired — the cron at `/api/cron/detect-expired-listings` is our prospect signal.
- **Second-home / absentee owners** — perfect match for Tier 3 (Out-of-Area Absentee Owner) which uses the 1,619-row Absentee MLS audience. Creative: "Considering selling your Bend second home? Here's what the market is doing while you're back in [California / Seattle]."
- **Pre-retirement downsizers** — 55+ Bend residents in larger Awbrey/NW Crossing/Tetherow homes who want lower-maintenance options. (Note: HOUSING Special Ad Category restricts age targeting; lean on audience-membership filters not detailed targeting.)
- **Luxury / $1M+ sellers** — Tier 2B 97703 Premium TOFU territory.
- **FSBO recovery** — homeowners who tried FSBO and want a pro now. (FSBO detection in `app/api/cron/detect-fsbo-listings/route.ts` is our prospect signal.)
- **Move-up sellers** — current homeowners ready to buy something bigger; sell-side leverages our buy-side fit.

**Volume:** 1 niche ad per niche, rotate when fatigue sets in (typically 30-60 days).

---

### Archetype 5 — Long-form storytelling video (NURTURE)

**Proof:** Ann Atamian, Dan Anton's "12 Turnberry Way SOLD — previously expired 181 days, here's what changed" narrative.

**Pattern:**
- Format: VIDEO, 30-90 seconds
- Story arc: a real case (expired listing turnaround, hard market re-list, multi-offer story)
- Voice: broker speaking direct-to-camera, no actor, no production polish
- Goal: trust + audience cultivation; not directly lead-gen
- Doesn't bid for clicks; bids for view-through

**Ryan Realty adaptation:**
- Tier 1 Database Nurture is the place for these (OUTCOME_AWARENESS / REACH)
- Matt should be on camera (his voice is the brand per `CLAUDE.md` Brand Voice section)
- Use real Ryan Realty case studies — never invented
- Production: phone footage edited per `video_production_skills/VIDEO_PRODUCTION_SKILL.md` (Captions burned in, Amboqia, navy + cream, 1080×1920 portrait)
- One per quarter, longer shelf life

---

## How this maps to the 6-tier campaign infrastructure

The campaign shells (paused, live in Meta as of 2026-05-26) need creative assigned per the table below. IDs from `docs/plans/CROSS_AGENT_HANDOFF.md`:

| Tier | Campaign ID | Adset ID | Primary archetype | Secondary archetype | Refresh cadence |
|---|---|---|---|---|---|
| **T1 — Database Nurture** | `120244223736960698` | `120244224327800698` | A1 Just Sold | A5 Long-form video | Monthly rotate |
| **T2A — Bend Resident TOFU** | `120244223739790698` | `120244224332950698` | A2 What's your home worth | A3 Market data | Quarterly |
| **T2B — 97703 Premium TOFU** | `120244223741480698` | `120244224337020698` | A4 Niche (luxury) | A2 Valuation | Quarterly |
| **T3 — Out-of-Area Absentee** | `120244223742330698` | `120244224340000698` | A4 Niche (second-home) | A1 Just Sold (luxury area) | Quarterly |
| **T4 — MOFU Retargeting (Sellers 180d)** | `120244223743080698` | `120244224342140698` | A2 Valuation (deeper) | A3 Market data | Monthly |
| **T5 — BOFU Hot (Sellers 14d)** | `120244223745230698` | `120244224344090698` | A1 Just Sold + A3 direct ("Talk to Matt this week") | A4 Niche | Bi-weekly |

**Pro tip:** Use one ad set per archetype where possible (multiple ad sets per campaign). Meta optimizes between them. Don't try to A/B inside a single ad set — Meta's ML penalizes that.

---

## The funnel (end-to-end)

```
Meta seller ad (one of the 5 archetypes)
  ↓
Lead Form (Meta-native) OR seller LP click
  ↓
Seller LP: /lp/seller-home-value OR /home-valuation OR /sell/valuation
  ↓
Lead capture → FUB person created (via canonicallyTagLead, server-side)
  ↓
FUB Action Plan: 10-touch / 60-day seller workflow (per docs/FUB_SELLER_WORKFLOW_2026-05-17.md)
  ↓
Day 1: instant email + SMS with valuation range + Matt intro
Day 3: detailed CMA delivered (Matt or designated broker)
Day 7-60: nurture touches (market update, just-sold news, content)
  ↓
Meeting booked → in-person CMA → listing agreement
  ↓
Closed listing → fed back into Tier 1 Just-Sold creative for next cohort
```

**Conversion rates to plan around (industry benchmarks for warm-list seller-gen):**

- Ad click → LP visit: 60-75% (FB Lead Form is in-app, so it skips this step but the form fill = 100% of clicks)
- LP visit → form fill: 8-15% with a real instant valuation tool, 2-4% with just a contact form
- Form fill → live conversation: 35-50% with same-day outreach
- Live conversation → listing appointment: 25-40%
- Listing appointment → signed agreement: 50-70%
- Signed → closed: 85-95% in 90 days

End-to-end cold seller cost-per-listing: $400-1,200 typical, $250-500 best-in-class with retargeting + warm-list mix. Industry top quartile sees positive ROI within 2 listings closed per quarter at the budget levels we set ($49/day = $1,470/month).

---

## What to launch FIRST (Matt's next 2 weeks)

### Week 1: Tier 1 + Tier 4 (Database Nurture + MOFU)

Lowest-cost path to first leads — both target audiences we already own.

1. **Tier 1 Database Nurture** ($12/day → ~$84/week):
   - Pull last 2-3 closed Ryan Realty deals from Vault
   - Build "Just Sold" creatives — Archetype 1 — using `marketing_brain_skills/producers/just-sold/SKILL.md` (or close kin)
   - Upload to Tier 1 ad set as 2-3 separate ads, all paused initially
   - Unpause when Matt approves the creatives
2. **Tier 4 MOFU** ($10/day → ~$70/week):
   - Build one "What's your home worth?" valuation ad — Archetype 2 — using Bend drone shot + Amboqia type
   - Targeted at AUD-CORE-Sellers-180d (people who visited a seller LP in last 180 days)
   - Audience is currently empty (we just created it) — will populate as seller LP traffic grows

**Expected outcome by end of week 2:** First seller leads from T1 (database warming) + retargeting frame for any future organic seller LP visits.

### Week 3-4: Tier 2B + Tier 3 (Premium + Absentee)

Higher-intent targeted tiers.

3. **Tier 2B 97703 Premium TOFU** ($7/day):
   - Archetype 4 niche — luxury seller positioning
   - Target the 97703 MLS Owners audience (7,178 records, already loaded)
4. **Tier 3 Out-of-Area Absentee** ($5/day):
   - Archetype 4 niche — "Considering selling your Bend second home?"
   - Target Absentee MLS Owners (1,619 records, CA/WA + Portland geo)

### Week 5+: Tier 2A + Tier 5 (Cold acquisition + BOFU Hot)

Lowest-priority for now because:
- Tier 2A (Bend Resident TOFU) needs the Special Ad Audience LAL recreated via UI first (per CROSS_AGENT_HANDOFF.md known gaps)
- Tier 5 (BOFU Hot 14d) is starved until seller-LP traffic grows enough to populate the 14-day window audience

---

## Critical execution constraints (per `CLAUDE.md` + `HOUSING` rules)

Every seller-gen ad must:

1. **Pass data-accuracy check** (CLAUDE.md §0) — any stat ("home values up X%") must trace to a live `market_pulse_live` or `market_stats_cache` query, dated, and included in `citations.json` next to the ad spec.
2. **Pass brand-voice check** (CLAUDE.md §0.5) — no em-dashes, no banned words (stunning, nestled, etc.), no exclamation marks in body, sentence case headlines, dotted phone `541.213.6706` or FUB-tracked `541.703.3095` on bio surfaces.
3. **Pass HOUSING Special Ad Category** — no detailed-targeting interest layering, no geo exclusions, no ZIP targeting, no Lookalike unless created as Special Ad Audience via UI (per the constraint matrix in `.cursor/skills/facebook-seller-growth/SKILL.md`).
4. **Pass first-frame thumbnail gate** (CLAUDE.md §0.5) — no logo-only intro, no black frame, no blank background; real photo + readable headline overlay.
5. **Get Matt approval before unpause** (CLAUDE.md §0.5 Draft-First, Commit-Last) — the campaigns are PAUSED in Meta; do not unpause without Matt explicitly saying ship it.

---

## Open decisions / Matt to choose

1. **Lead Form (Meta-native) vs Website Conversion (LP)?**
   Lead Forms convert 2-3x higher but the leads are lower-intent (one-tap submit). Website conversions hit our LP, fire the full canonical lead tag chain, and produce higher-intent contacts. Recommendation: **start with Website Conversions** (LP) because we already have the full identity wiring + FUB action plan, and the data quality matters more than raw count at this volume.
2. **Which broker(s) sign the just-sold ads?**
   Default per AGENTS.md: all leads route to Matt unless `?agent=<slug>` cookie is set. For per-broker attribution on just-sold ads (Rebecca's listings → Rebecca's lead routing), use the UTM-link pattern in `components/AgentAttributionBridge.tsx` to drive `?agent=rebecca` / `?agent=paul`. Recommendation: default to Matt; per-broker if Rebecca/Paul drive the listing.
3. **Quarterly budget escalation:**
   Current $49/day across 6 tiers = ~$1,470/month. Industry mid-market real-estate broker seller-acquisition budget is $3,000-8,000/month. Recommendation: stay at $49/day for first 4 weeks, then scale based on cost-per-listing-lead actuals. Don't scale before measurement.
4. **Re-recon cadence:**
   The competitive landscape shifts. Re-run `scripts/pull-fb-ads-recon.mjs` + targeted seller-gen scrapes every 30 days. The skill already specifies this cadence (`marketing_brain_skills/competitor-design-recon/SKILL.md`).

---

## Recon files referenced

- `out/design-recon/fb-lead-gen-ad/raw.json` — 5,380 deduped competitor ads
- `out/design-recon/fb-lead-gen-ad/gallery.html` — visual browser of all ads
- `out/design-recon/fb-lead-gen-ad/index.md` — markdown summary
- `out/design-recon/fb-lead-gen-ad/manifest.json` — run metadata + breakdowns
- `scripts/pull-fb-ads-recon.mjs` — re-runnable consolidator
- `scripts/build-fb-ads-gallery.mjs` — gallery rebuilder

---

## Locked rules (additions to `.cursor/skills/facebook-seller-growth/SKILL.md`)

1. **Seller-gen ads are a separate creative discipline from listing/buyer ads.** Never use a listing photo as the hero on a seller-acquisition ad — that confuses Meta's optimization and the audience.
2. **Just-sold ads are the single highest-evidence pattern.** Make these the default Tier 1 creative.
3. **Every "what's your home worth?" ad must point to a LP that actually delivers an instant valuation.** Contact-form-only LPs underperform 5-10x and risk Meta misleading-claim penalties.
4. **HOUSING Special Ad Category does NOT block seller-gen targeting via Custom Audiences.** MLS owner uploads, FUB Database, and Sellers-LP retargeting audiences all work. Only standard Lookalikes and detailed-targeting interests are restricted.
5. **Local Central Oregon brokers are not running seller-gen ads.** This is a structural competitive opening; expect higher CPMs once others follow, so capture share early.

---

## Change log

| Date | Change |
|---|---|
| 2026-05-26 | **Locked.** Initial strategy doc based on 5,380-ad Apify recon + 6-tier campaign infrastructure shipped same day. |
