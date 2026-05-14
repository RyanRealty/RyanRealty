# Phase 2 — Seller LP traffic campaign (v1, ready to launch)

Locked draft for the Meta campaign that drives Bend boomer-equity homeowners to `https://seller.ryan-realty.com/`. Every piece below is brand-voice compliant, Special-Ad-Category-Housing compliant, and tracks end-to-end through the existing Pixel + CAPI + FUB + (new) auto-CMA pipeline.

**Status:** Drafted by the orchestrator. NOT yet pushed to Ads Manager — Matt must explicitly say "launch campaign 1" / "launch campaign 2" / "launch all three" before any real spend. The playbook target is $60/day CBO across three campaigns.

**Reference docs:**
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` — locked playbook (3 campaigns, audience splits, exclusion rules)
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` — end-to-end attribution architecture
- `.cursor/skills/facebook-seller-growth/SKILL.md` — weekly optimization routine
- `social_media_skills/facebook-lead-gen-ad/SKILL.md` — existing producer for FB lead-form objective
- `marketing_brain_skills/producers/ops-meta-ads/SKILL.md` — budget/pause/audience operations on live campaigns

**Critical gap to flag:** the existing FB ad producers are wired for FB **lead-form** objective only (in-app instant form). This v1 campaign drives **traffic to the LP** instead — leads convert on `seller.ryan-realty.com`, which gives us full control over the experience and lets the new auto-CMA loop fire. Existing skill code at `scripts/create-fb-ad.mjs` is hard-coded to `LEAD_GENERATION` and needs a `TRAFFIC` (or `OUTCOME_ENGAGEMENT`) variant before this campaign can be launched via code. Launching v1 manually through Ads Manager UI is the right move; codifying the producer comes after we have conversion data.

---

## 1. Account-level setup (one-time, before any campaign launches)

1. **Special Ad Category — Housing** (required by Meta for any real-estate ad targeting users in the US). Set at the campaign level, not the ad-set level. Removes age targeting / detailed-interest / radius targeting; we lean on lookalikes and broad behavior.

2. **CORS** — confirm `seller.ryan-realty.com` is whitelisted on `/api/meta-capi`. Check `app/api/meta-capi/route.ts` `CORS_ALLOWED_ORIGINS`. If `ryan-realty.com` is the only entry, add `seller.ryan-realty.com` (and probably `buyer.ryan-realty.com` for the future) before the campaign goes live. Otherwise the LP-side Pixel + CAPI dedup `event_id` round-trip silently fails and Meta thinks every form-submit is unattributed.

3. **Pixel events live on LP** — verified via the `app/lp/seller-home-value/page.tsx` server action `submitSellerLPForm`:
   - `Lead` ($500 value, USD) fired on form submit with shared `event_id` for browser + CAPI dedup
   - `content_name: 'seller_lp_home_value'` to filter in Ads Manager
   - `lead_type: 'seller_valuation'` for audience segmentation
   - `classification: 'hot' | 'warm' | 'nurture' | 'unknown'` for downstream Custom Audiences

4. **Custom Conversion** in Ads Manager — define `Seller LP — Home Value Submit` keyed off `content_name = seller_lp_home_value`. Use this as the optimization event for all campaigns. Window: 7-day click + 1-day view.

5. **Audience preloads** (run before launch, then daily refresh):
   - **Exclusion: Active FUB persons** — `select email from valuation_requests` + `select email, phones from fub_persons` → upload as a Customer List → set as Exclusion on every ad set so we don't burn money re-marketing to leads already in the pipeline.
   - **Seed: Seller LP visitors who didn't convert** — Pixel-based, 30-day window.
   - **Seed: Sellers we've represented** — emails from MLS rows where `list_agent_mls_id IN ('c10676','c13902','c13975')`. Limited (~30 emails) but high-quality LAL seed.

---

## 2. The three campaigns (CBO, $60/day total)

Per the locked playbook. All three are **Outcome: Sales** with **conversion event = Seller LP — Home Value Submit** (the Custom Conversion above), Special Ad Category = Housing, and the LP `https://seller.ryan-realty.com/?utm_source=meta&utm_medium=paid&utm_campaign=<name>&utm_content=<creative_id>` as the destination.

### Campaign A — Cold (60% of budget = $36/day)

Pure-broad targeting. Lookalike-based, no detailed interests (Housing category restricts them anyway).

- **Audience:** 1% Lookalike of "Sellers we've represented" custom audience + 1% Lookalike of "Seller LP — converted" custom audience. Two LAL sources, OR'd.
- **Geo:** Bend MSA (zip 97701, 97702, 97703, 97739, 97759 + 25-mile radius from downtown Bend). Excludes anyone not in Deschutes County by IP.
- **Placement:** Automatic. Let Meta optimize across Feed / Reels / Stories / Marketplace.
- **Bidding:** Highest volume (lowest CPA), no bid cap for the first week (learn phase).
- **Optimization event:** Seller LP — Home Value Submit.
- **Exclusion:** Active FUB persons.
- **Budget:** $36/day at campaign level (CBO). 5 ad sets max so Meta can compare.

### Campaign B — Retargeting (25% = $15/day)

- **Audience:**
  - LP visitors past 30 days who did NOT convert (Pixel: `PageView` of `seller.ryan-realty.com` AND NOT `Lead`).
  - 1% LAL of "Email opened in last 60 days" (from a Resend export — not yet wired).
- **Geo:** Same as Campaign A.
- **Frequency cap:** 2 / 7 days (don't burn anyone out).
- **Placement:** Feed + Reels. Skip Marketplace.
- **Budget:** $15/day at campaign level.

### Campaign C — Brand awareness (15% = $9/day)

For top-of-funnel "Ryan Realty is the team in Bend" framing. Drives the Sold Stories matrix as the visual moment.

- **Audience:** Bend zips, broad Housing-compliant targeting. Excludes Campaign A's lookalikes and Campaign B's retargeting so we don't double-stack.
- **Placement:** Reels + Stories priority. Vertical creative.
- **Optimization:** Outcome = Engagement (video views, post engagement).
- **Budget:** $9/day at campaign level.

---

## 3. Ad creative — image variants (v1 launch set)

Six creatives. Three for Campaign A (cold), two for Campaign B (retargeting), one for Campaign C (brand). All 1:1 1080×1080 plus 9:16 1080×1920 variants. All brand-voice compliant — no banned words from `marketing_brain_skills/brand-voice/voice_guidelines.md` or `CLAUDE.md`. No exclamation marks. No "stunning / nestled / luxurious." Currency rounded to thousands.

### A1 — Cold · Median Bend home

- **Visual:** 1080×1080. Hero photo: Bend Old Mill drone (canonical hero per CLAUDE.md design system at `design_system/ryan-realty/assets/hero/banner-1500x500-x.jpg`, cropped). Overlay: heritage horizontal wordmark `logo-horizontal-blue.png` top-left in navy. Bottom 40% navy scrim with three-line copy in Amboqia 56px navy.
- **Headline (in image):** Your Bend home is probably worth more than Zillow says.
- **Subhead:** A real number from real local sales. One business day.
- **Primary text (above image):** Zillow's median error rate is 7%. On a Bend home worth $850,000 that's a $59,500 swing. We send the real number from the comparable sales actually closing near you — within one business day, no obligation.
- **CTA button:** Get Quote
- **Landing URL:** `https://seller.ryan-realty.com/?utm_source=meta&utm_medium=paid&utm_campaign=cold&utm_content=a1-median`

### A2 — Cold · Sold story

- **Visual:** 1080×1080. Real photo: 2354 NW Drouillard Ave (Rebecca's recent $1.715M sale, Spark CDN URL pinned in `ADDRESS_OVERRIDES`). Bottom band navy with white pill "SOLD · $1.72M · NORTHWEST CROSSING" + "Marketed by Rebecca · Ryan Realty."
- **Headline (in image):** The home we just sold for $1,715,000.
- **Subhead:** Wondering what yours is worth?
- **Primary text:** This NorthWest Crossing home closed at $1,715,000 last month. We're a Bend-based team. Get the real number for your home — no obligation, no spam.
- **CTA:** Get Quote
- **Landing URL:** `...&utm_content=a2-sold-story`

### A3 — Cold · Time-on-market

- **Visual:** 1080×1080. Cream background `#faf8f4`. Centered Amboqia 180px navy: "38 days." Below in Geist 500: "Bend median days on market." Source line below: "Source: ORMLS, April 2026 (live). Updated weekly."
- **Headline (in image):** Bend homes are selling in 38 days right now.
- **Primary text:** Slower than last spring, faster than 2019. The data on your block matters more than the city number. Get a one-page CMA for your home.
- **CTA:** Get Quote
- **Landing URL:** `...&utm_content=a3-dom`

### B1 — Retargeting · Soft re-approach

- **Visual:** Same canonical Old Mill hero with a different overlay copy.
- **Headline:** Still curious what your Bend home is worth?
- **Primary text:** No pressure. The team that sold Schoolhouse Road for $3,000,000 will tell you the real number for your home — within one business day. Reply or not, no follow-up if you'd rather we just go away.
- **CTA:** Learn More
- **Landing URL:** `...&utm_campaign=retarget&utm_content=b1-soft`

### B2 — Retargeting · Social proof carousel

- **Visual:** Carousel (3 cards): Schoolhouse $3M / Drouillard $1.72M / Crowson $1.02M. Each tile shows photo + price + neighborhood pill, identical to the Sold Stories matrix on the LP. Visual continuity for returning visitors.
- **Headline:** From $1.02M to $3M, this is the team that sold them.
- **Primary text:** Real Bend homes, real prices, real Google reviews. Get the number for yours.
- **CTA:** Get Quote
- **Landing URL:** `...&utm_content=b2-carousel`

### C1 — Brand · "Ryan Realty in 15 seconds"

- **Visual:** 9:16 vertical video, 15 seconds. Mute-autoplay-friendly. Open on Old Mill drone, cut to the three brokers (Matt, Rebecca, Paul) from their team headshot PNGs as a fade-through, close on the horizontal wordmark on cream. No spoken VO — captions only ("Ryan Realty · Bend, Oregon · Honest. Direct. Local."). Brand voice clean.
- **Headline:** The Bend team you call when you want the number, not the pitch.
- **Primary text:** Ryan Realty. Bend, Oregon. Honest. Direct. Local. ryan-realty.com.
- **CTA:** Learn More
- **Landing URL:** `https://ryan-realty.com/?utm_source=meta&utm_medium=paid&utm_campaign=brand&utm_content=c1-team`

---

## 4. Tracking — verify the loop before any spend

**The LP we just shipped fires the `Lead` Pixel event on submit with $500 value + dedup event_id.** Before launching ads, run this verification (5 minutes):

1. Open `seller.ryan-realty.com` in a normal browser tab. DevTools → Network → filter "facebook.com" / "meta-capi".
2. Submit the form with a real Bend address.
3. Verify:
   - One browser-side `Lead` event hits `https://www.facebook.com/tr/`.
   - One server-side `Lead` event hits `/api/meta-capi`.
   - Both carry the same `event_id`.
   - Meta Events Manager (Test Events tab) shows them with `Dedup: Match`.
4. Check Supabase `cma_deliveries` — the row should appear within 1 second.
5. Check the broker's inbox — review email with signed `/cma-drafts/<id>?token=...` link should arrive within ~10 seconds.
6. Click the link → preview page renders → click "Send to lead now" → real email lands in the lead's inbox with PDF attached.
7. Check FUB → the lead has a new Note "Auto-CMA sent to <email>..." attached.

Only after step 7 succeeds end-to-end with real ad-account spend, launch Campaign A at $36/day. Watch CPL for 48 hours. If CPL > $25, pause and re-tune creative; if CPL < $15, scale Campaign A to $50/day before adding Campaigns B + C.

---

## 5. The "launch it" command

Once Matt approves this brief verbatim ("launch v1 campaign A") or with edits, the launch sequence is:

```bash
# 1. Confirm CORS includes seller.ryan-realty.com
grep CORS_ALLOWED_ORIGINS app/api/meta-capi/route.ts

# 2. Generate the 6 ad image variants (A1, A2, A3, B1, B2, C1 — Canva or Figma
#    against the brand spec above). Save under public/marketing/fb-ads-v1/.

# 3. Use Ads Manager UI to:
#    - Create the "Seller LP — Home Value Submit" Custom Conversion
#    - Create Campaign A "Cold" with the LAL audiences + creatives
#    - Set $36/day CBO
#    - Confirm Special Ad Category = Housing
#    - Hit Publish

# 4. Set a calendar reminder for 48h post-launch:
#    - CPL check
#    - Cost-per-form-submit
#    - LP bounce rate (GA4)
```

Codification (writing this as a producer that creates campaigns automatically via the Meta Marketing API) is **Phase 3** work — after we have data from v1 to know what's actually performing.

---

## 6. Open decisions for Matt

- **Daily budget:** locked in playbook at $60/day total, $36 cold + $15 retargeting + $9 brand. Adjust if Matt wants a softer launch.
- **Campaign duration:** the playbook is a continuous run. v1 should run for at least 14 days (Meta needs 7 to exit learn phase + 7 to compare creatives) before declaring a winner.
- **Lead-form fallback:** if traffic-objective click-to-LP underperforms vs the playbook benchmark ($15-25 CPL), we can swap to Meta's in-app Instant Form via the existing `social_media_skills/facebook-lead-gen-ad/` producer. Trade-off: instant-form lifts CPL ~20% lower but the lead doesn't see the Sold Stories matrix or the CMA loop, so quality drops. v1 default is click-to-LP.
- **Creative refresh cadence:** weekly during the first 4 weeks, biweekly after. Refresh budget: $200/cycle for Canva/Figma renders if we outsource; $0 if we render in-house from the brand assets.
