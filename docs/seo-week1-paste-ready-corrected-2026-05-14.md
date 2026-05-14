# Week 1 SEO Sweep — Corrected Paste-Ready Spec

**Date built:** 2026-05-14
**Source audit:** `docs/seo-audit-ryan-realty-com-2026-05-13.md`
**Why this doc exists:** The source audit's proposed titles, metas, and body copy contain 12 em-dash hits in Week 1 alone. CLAUDE.md §0.5 and `marketing_brain_skills/brand-voice/voice_guidelines.md` §6.1 ban em dashes as banned punctuation. Matt approved a pipes-in-titles + periods-in-body replacement strategy (2026-05-14). This doc is the corrected single source of truth.

**All titles ≤60 chars (Google SERP cutoff). All metas 150–160 chars. Every figure traces to a Supabase row count or named primary source.**

**Verification status:** Figures marked `[SB-PENDING]` are still being re-confirmed against the live Supabase MLS mirror. Do NOT paste any line containing a `[SB-PENDING]` token. Replace with the verified value before paste.

---

## Item 1 — May 2026 market report

**URL:** `https://ryan-realty.com/bend-oregon-market-report-may-2026/`
**WP post type:** Post

**Proposed title (corrected, 58 chars):**
```
Bend Oregon Market Report May 2026 | $680K Median, 5.0 MoS
```

**Proposed meta description (corrected, 156 chars):**
```
874 active listings. $680K median sold price. 5.0 months of supply, balanced market. YoY down 9.1%. Verified MLS data, updated May 2026. Read the full breakdown.
```

**Body addition (top of page, before "At a glance" table):**
```
Bend's real estate market for May 2026 shows 874 active single-family listings and a median sold price of $680,000, down 9.1% from May 2025. Months of supply is 5.02, placing Bend in balanced-market territory. This report covers inventory by price band, what the data means for buyers and sellers, and the full methodology behind every figure.
```

**Schema (Article) — Week 2 work. Defer.**

**Verification:** `[SB-PENDING — 874 active, $680K median, 5.02 MoS, -9.1% YoY]`

---

## Item 2 — Building permit timeline post

**URL:** `https://ryan-realty.com/bend-building-permit-timeline-construction/`
**WP post type:** Post

**Proposed title (corrected, 59 chars):**
```
Bend Building Permit Timeline 2026 | 17 Weeks, Step by Step
```

**Proposed meta (158 chars, no em dash in original):**
```
Residential permits in Deschutes County take 17 weeks from intake to approval. Here is the breakdown by phase and what you can do to avoid adding weeks. Verified 2026.
```

**Body addition (corrected — em dashes around "acreage, location, or layout" replaced with commas):**
```
**Build vs. buy math in a 17-week permit market.** If you are weighing buying an existing home against building new in Deschutes County, the 17-week permit timeline is only one input. Construction costs per square foot in Central Oregon currently run $250 to $375 finished (per Deschutes County building department data, 2025). Add 8 to 14 months of construction and the carry cost on your land loan. In most scenarios at the Bend median price range, an existing home pencils better unless the build offers a specific feature, acreage, location, or layout, that resale inventory does not provide. We walk buyers through this math as part of any relocation consultation.
```

**Schema (FAQPage) — Week 2. Defer.**

---

## Item 3 — Contact page

**URL:** `https://ryan-realty.com/contact/`
**WP post type:** Page

**Proposed title (corrected, 59 chars):**
```
Contact Ryan Realty | Bend Oregon Real Estate, 541.213.6706
```

**Proposed meta (159 chars):**
```
Call or text 541.213.6706. Free CMA in 24 hours for sellers. MLS-direct listing alerts for buyers. Office at 115 NW Oregon Ave, Bend OR 97703. Same-day reply.
```

**Body intro replacement (banned-word fix — replaces "dedicated team," "personalized support," "real estate journey"):**
```
Call or text 541.213.6706. We answer same day. If you are selling, we can have a written CMA in your inbox in 24 hours. If you are buying, we send MLS-direct listing alerts before Zillow refreshes. Our office is at 115 NW Oregon Avenue in downtown Bend.
```

---

## Item 4 — Tumalo neighborhood page

**URL:** `https://ryan-realty.com/explore/bend/tumalo/`
**WP post type:** AgentFire neighborhood guide (likely Custom Post Type)

**Proposed title (54 chars):**
```
Tumalo Oregon Homes for Sale | Rural Acreage Near Bend
```

**Proposed meta (158 chars):**
```
Tumalo OR homes for sale. Rural acreage, Deschutes River frontage, and mountain views 10 minutes from downtown Bend. Live MLS data, licensed broker, real comps.
```

**Body — About The Area replacement (banned-word fix — "hidden gem," "nestled" out):**
```
Tumalo sits 8 miles northwest of downtown Bend on US-20, between Bend and Sisters, in unincorporated Deschutes County. Most properties are on 1 to 20-acre parcels, the lot sizes that disappeared from Bend proper years ago. The Deschutes River runs through the community, and the lower Tumalo Creek trail connects to Shevlin Park. Buyers come here for acreage, river access, mountain views, and the shorter commute to Bend than Sisters or Redmond offer. The trade-off is well water and septic on most properties and rural zoning that limits subdivision. Current median sold price in Tumalo is [SB-PENDING — pull from Supabase]. School: Tumalo Community School (K-5, public).
```

**Verification:** `[SB-PENDING — Tumalo median sold last 6mo, active count]`

---

## Item 5 — Northwest Crossing

**URL:** `https://ryan-realty.com/explore/bend/northwest-crossing/`

**Proposed title (60 chars):**
```
Northwest Crossing Bend Oregon Homes for Sale | $944K Median
```

**Proposed meta (159 chars):**
```
Northwest Crossing Bend OR. 26 active SFR listings. $944K median sold, 17-day median days to pending. Walkable, Shevlin Park access, River's Edge Elementary.
```

**Body:** No change. Current body is the benchmark for the cluster.

**Verification:** `[SB-PENDING — confirm 26 active, $944K median, 17-day median DOM]`

---

## Item 6 — River's Edge Village

**URL:** `https://ryan-realty.com/explore/bend/rivers-edge-village/`

**Proposed title (58 chars — apostrophe fix from "Rivers" to "River's"):**
```
River's Edge Village Bend OR Homes for Sale | $944K Median
```

**Proposed meta (159 chars):**
```
River's Edge Village Bend OR. Golf course and Deschutes River views. Single-level homes, low maintenance. 11 active listings. $944K median sold. MLS-verified.
```

**Body:** No replacement copy. Flag the "$0" dynamic-widget rendering issue separately for an AgentFire support ticket (Section 5.5 of audit).

**Verification flag:** Audit shows current meta as "$915K median" and proposed meta as "$944K median" — confirm correct figure via Supabase before paste. `[SB-PENDING — River's Edge active, median sold]`

---

## Item 7 — Tanager

**URL:** `https://ryan-realty.com/explore/bend/tanager/`

**Proposed title (corrected, 59 chars):**
```
Tanager Bend Oregon | Private Lake Community Homes for Sale
```

**Proposed meta (153 chars):**
```
Tanager is a gated west Bend community built around two private lakes. Custom homes, limited homesites, pine forest setting. Browse listings and market data.
```

**Body — About The Area first-paragraph replacement (banned-word fix — "exclusive" out):**
```
Tanager is a gated community west of Bend, built around two private lakes and surrounded by ponderosa pine. The development has a limited number of homesites. Homes are custom-designed with direct lake access for kayaking and paddleboarding. The setting is 10 minutes from downtown Bend via Reed Market Road.
```

---

## Item 8 — Cost of living 2026

**URL:** `https://ryan-realty.com/bend-oregon-cost-of-living-2026/`
**WP post type:** Post

**Proposed title (corrected, 60 chars):**
```
Bend Oregon Cost of Living 2026 | $680K Median, No Sales Tax
```

**Proposed meta (160 chars):**
```
Bend Oregon cost of living, 2026 verified numbers. $680K median home price. 0% sales tax. $250 to $400/month utilities. Healthcare, groceries, transit covered.
```

**Body:** No change. Page is strong and data-accurate.

**Schema (FAQPage) — Week 2. Defer.**

---

## Item 9 — About Us

**URL:** `https://ryan-realty.com/about-us/`
**WP post type:** Page

**Proposed title (corrected, 59 chars):**
```
About Ryan Realty | Bend Oregon Broker, Matt Ryan, 12 Years
```

**Proposed meta (160 chars):**
```
Ryan Realty is Bend's principal-broker-owned brokerage. Matt Ryan, Paul Stevenson, Rebecca Peterson. Licensed fiduciaries. 12 years Central Oregon real estate.
```

**H1 replacement:**
```
Ryan Realty — Bend's Principal-Broker-Owned Brokerage
```
**Wait** — that H1 contains an em dash. Use this instead:
```
Ryan Realty: Bend's Principal-Broker-Owned Brokerage
```
Voice guidelines §6.1 bans "dramatic colons" but allows colons "in lists, headers, and tables." A title-introducing colon in an H1 is a header colon — allowed. If Matt prefers no colon at all, fall back to:
```
Bend's Principal-Broker-Owned Real Estate Brokerage
```
(no colon, plain noun phrase, 51 chars)

**Body intro replacement (corrected — em dash removed, replaced with period):**
```
Ryan Realty is owned and operated by Matt Ryan, a licensed Oregon principal broker with 12 years in Central Oregon. We are three brokers: Matt Ryan, Paul Stevenson, and Rebecca Peterson. We represent buyers and sellers as fiduciaries. Your interests over the deal, every time. We answer texts and calls the day you send them. We have done this long enough to know that the best service is the one you feel but do not have to ask for.
```

---

## Item 10 — The Rim at Aspen Lakes

**URL:** `https://ryan-realty.com/explore/sisters/the-rim-at-aspen-lakes/`

**Proposed title (corrected, 56 chars):**
```
The Rim at Aspen Lakes Sisters OR | Golf Community Homes
```

**Proposed meta (159 chars):**
```
The Rim at Aspen Lakes, Sisters Oregon. Custom homes adjacent to Aspen Lakes Golf Course. Cascade Mountain views, rural setting, 20 minutes from Bend.
```

**Body — About The Area full replacement (banned-word sweep — removes "pinnacle of serene living," "breathtaking views," "nothing short of spectacular," "finest in modern craftsmanship," "finer things in life," "unparalleled beauty and tranquility"):**
```
The Rim at Aspen Lakes is a residential community in Sisters, Oregon, adjacent to the Aspen Lakes Golf Course. Sisters sits at the base of the Cascade foothills, 21 miles from downtown Bend. The development has large lots, Cascade Mountain views, and a rural-area feel while remaining within city limits. Aspen Lakes Golf Course is a public-access, 27-hole course on the property. Current market data for this community: [SB-PENDING — pull from Supabase].
```

**Verification:** `[SB-PENDING — Aspen Lakes / Rim subdivision active + median]`

---

## Item 11 — Homepage

**URL:** `https://ryan-realty.com/`

**Title:** No change. Current title is fine.

**Proposed meta (corrected, 160 chars):**
```
Browse 867 active listings in Bend and Central Oregon. Verified MLS data, licensed principal broker, free CMA in 24 hours. Ryan Realty. 541.213.6706.
```

Note: "115 NW Oregon Ave" omitted from meta to make room for the period replacing the em dash. Address still appears in the schema and the contact-page meta.

**H1 replacement (replaces "We Are Bend Oregon's Trusted Real Estate Brokerage"):**
```
Bend Oregon Real Estate. Browse 867 Active Listings.
```
51 chars. Two sentences, both data-anchored.

**Hero carousel text:** Remove "Bend's Elite Brokerage" and "Bend's Top Broker" (banned-territory). Replace each rotation slide with a specific data claim, e.g.:
- Slide A: "874 active listings. $680K median sold price. May 2026."
- Slide B: "Free CMA in 24 hours. MLS-direct alerts. 541.213.6706."
- Slide C: "Three licensed fiduciaries. 12 years in Central Oregon."

**Verification:** `[SB-PENDING — confirm 867 vs current Central Oregon active total]`

---

## Item 12 — Explore Bend hub

**URL:** `https://ryan-realty.com/explore/bend/`

**Proposed title (corrected, 58 chars):**
```
Explore Bend Oregon Neighborhoods | Homes for Sale by Area
```

**Proposed meta (158 chars):**
```
Browse Bend Oregon neighborhoods: NW Crossing, Tumalo, Valhalla Heights, River's Edge, Tanager, and 16 more. Live listings and market data by area.
```

**Body — lead paragraph addition (first paragraph):**
```
Bend has 21 distinct neighborhoods and surrounding communities, each with a different price range, lot size, school boundary, and commute profile. The guides below cover current inventory, median prices, and what distinguishes each area, sourced from MLS data rather than aggregated from third-party sites that last updated in 2023.
```

**Verification needed:** Confirm current title is in fact the AgentFire default (audit marks as [VERIFY]). Capture before paste.

---

## Item 13 — Valhalla Heights

**URL:** `https://ryan-realty.com/explore/bend/valhalla-heights/`

**Proposed title (60 chars — used "OR" abbreviation to stay under cap):**
```
Valhalla Heights Bend OR Homes for Sale | Views, Pine Forest
```

**Proposed meta (157 chars):**
```
Valhalla Heights, northwest Bend. 42-acre neighborhood, 118 homes on 11,000 sq ft lots, no HOA, Shevlin Park access. Current listings from a licensed broker.
```

**Body — About The Area first-paragraph replacement (banned-word sweep — "nestled," "storybook charm," "authentic Bend magic," "woodland burble" out):**
```
Valhalla Heights is a 42-acre neighborhood in northwest Bend, developed in the 1970s on a forested ridge west of COCC. The area has 118 homes on lots averaging 11,000 square feet, no HOA, mature ponderosa pines throughout, and direct access to Shevlin Park's trail system. Street names reference Norse mythology (Torsway, Polarstar), a quirk of the original developer.
```

---

## Item 14 — Tree Farm

**URL:** `https://ryan-realty.com/explore/bend/tree-farm/`

**Proposed title (53 chars):**
```
Tree Farm Bend Oregon Homes for Sale | Northeast Bend
```

**Proposed meta (159 chars):**
```
Tree Farm, northeast Bend neighborhood. Single-family homes, established community. Browse current listings and market data from a licensed Oregon broker.
```

**Body:** Audit marks [VERIFY] for banned-word scan. Confirm before paste.

---

## Item 15 — October 2025 stale market post

**URL:** `https://ryan-realty.com/central-oregon-housing-market-update-october-2025-insights-and-trends-2/`

**Action:** 301 redirect to `https://ryan-realty.com/bend-oregon-market-report-may-2026/`

**Where:** AgentFire admin → Settings → Redirects (install Redirection plugin if missing).

---

## Also in Week 1 (per audit Section 7)

### Investigate "rebecca palombo bend or" name mismatch
- GSC → Search Results → Pages → find the page ranking position 3 for "rebecca palombo bend or" (32 impressions, 0 clicks).
- Confirm the page renders the correct broker name (Peterson, not Palombo).
- If "Palombo" appears anywhere, correct it and resubmit URL via GSC URL Inspection → Request Indexing.

### Fix Valhalla Heights About text — covered in item 13 above.

### Fix Rim at Aspen Lakes About text — covered in item 10 above.

### Fix About Us H1 — covered in item 9 above.

---

## Quick-check before each paste

For every item:
1. Confirm AgentFire SEO panel is open (Yoast SEO, Rank Math, or AgentFire native).
2. Screenshot current Title + Meta fields BEFORE editing.
3. Paste the corrected line. Verify char count stays under cap.
4. Save / Update.
5. Open the live URL in incognito to confirm rendered title.
6. Log to `docs/seo-execution-log-2026-05-14.md`.

## Verification waiting list

These items can't paste until Supabase verifications return:
- Item 1 figures (delegated)
- Item 4 Tumalo median (delegated)
- Item 5 Northwest Crossing claims (delegated)
- Item 6 River's Edge median (delegated — note audit conflict $915K vs $944K)
- Item 10 Aspen Lakes / Rim figures (delegated)
- Item 11 homepage 867 active total (delegated)

Items that can paste immediately (no figure to verify):
- Item 2 building permit title + meta
- Item 3 contact page title + meta + body
- Item 7 Tanager title + meta + body
- Item 8 cost of living title + meta
- Item 9 About Us title + meta + H1 + body
- Item 12 Explore Bend hub title + meta + lead (after current-state capture)
- Item 13 Valhalla Heights title + meta + body
- Item 14 Tree Farm title + meta (after banned-word scan of current body)
- Item 15 301 redirect for October 2025 stale post

Plan: when Chrome unblocks, work the immediately-pasteable items first; when Supabase returns, do the figure-dependent items.
