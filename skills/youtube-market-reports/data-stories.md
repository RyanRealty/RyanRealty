# Data Stories: YouTube Market Report Segments

Ryan Realty exclusive data-driven video segments. Every query runs against `ryan-realty-platform` Supabase. Every figure must trace to a live query result before it enters a script or on-screen graphic. No inherited numbers.

**Standard SFR filter applied to all queries unless noted:**
```sql
property_sub_type = 'Single Family Residence'
AND "PropertyType" = 'A'
```

**Timezone standard:** `("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date`

**Median standard:** `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)`

**Universal residential filters (mandatory — see `query-rules.md` UF1/UF2/UF3):**
- **UF1 — ClosePrice floor:** every closed-sales aggregation must include `AND "ClosePrice" >= 10000`. The raw table has 1,640 records under $10K (lowest = $0.09) — land transfers, parcel splits, data-entry artifacts. `> 0` is not enough; use `>= 10000`. List-side queries (active inventory, expired, BOM math) get the same floor on `"ListPrice"` / `"OriginalListPrice"`.
- **UF2 — Sale-to-list ratio bounds:** every aggregation that touches `sale_to_final_list_ratio` or `sale_to_list_ratio` (or computes the equivalent in math) must clamp `BETWEEN 0.5 AND 1.5` in the WHERE clause. 967 records produce ratios outside that range; 272 produce ratios up to 99.9× from artifact list prices under $10.
- **UF3 — MoS SFR-only on both sides:** any Months of Supply computation must filter `property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'` on BOTH the active CTE AND the closed CTE, and must use the canonical formula `active / (closed_N_days / N * 30)`. **Never read `market_pulse_live.months_of_supply` into a video** — measured Bend gap on 2026-04-30 was 5.80 stored vs 4.20 SFR-only manual (38% off, flips the verdict pill on camera). Use `query-rules.md` Template 11 verbatim.

These filters are baked into every story below. If you see a closed-sales query without `>= 10000`, treat it as an oversight and add the floor before running it.

---

### 1. Cash Buyer Share by ZIP Code Over 12 Months

**Angle:** Map which ZIP codes are being taken over by cash buyers — a direct proxy for investor activity and second-home pressure in Central Oregon.

**Why unique:** Generic market reports publish a single county-wide cash percentage. This breaks it down by ZIP and shows the 12-month trend, revealing which neighborhoods are seeing surging or retreating investor interest.

**Fields used:** `buyer_financing`, `"PostalCode"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  "PostalCode",
  DATE_TRUNC('month', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) AS close_month,
  COUNT(*) AS total_sales,
  SUM(CASE WHEN buyer_financing::text ILIKE '%cash%' THEN 1 ELSE 0 END) AS cash_sales,
  ROUND(
    100.0 * SUM(CASE WHEN buyer_financing::text ILIKE '%cash%' THEN 1 ELSE 0 END) / COUNT(*),
    1
  ) AS cash_pct
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "PostalCode" IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1 (excludes land/artifact rows from cash-share denominator)
GROUP BY "PostalCode", close_month
ORDER BY "PostalCode", close_month;
```

**VO hook:** "In some Bend ZIP codes, nearly half of all sales last month were cash — and that number is climbing."

---

### 2. Seller Concessions by Price Band

**Angle:** Sellers at specific price points are quietly handing buyers thousands of dollars — but the pattern is not uniform across the market.

**Why unique:** Concession data is almost never published in local market reports. Ryan Realty has 39.7% coverage on `concessions_amount` — enough to show statistically meaningful patterns by price band.

**Fields used:** `concessions_amount`, `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN "ClosePrice" < 400000 THEN 'Under $400K'
    WHEN "ClosePrice" < 500000 THEN '$400K–$500K'
    WHEN "ClosePrice" < 600000 THEN '$500K–$600K'
    WHEN "ClosePrice" < 750000 THEN '$600K–$750K'
    WHEN "ClosePrice" < 1000000 THEN '$750K–$1M'
    ELSE '$1M+'
  END AS price_band,
  COUNT(*) AS total_closed,
  SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) AS with_concessions,
  ROUND(
    100.0 * SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) / COUNT(*),
    1
  ) AS concession_rate_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY concessions_amount)
    FILTER (WHERE concessions_amount > 0)::numeric, 0) AS median_concession_when_given,
  ROUND(AVG(concessions_amount) FILTER (WHERE concessions_amount > 0), 0) AS avg_concession_when_given
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND concessions_amount IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1 (price-band bucketing requires the floor)
GROUP BY price_band
ORDER BY MIN("ClosePrice");
```

**VO hook:** "Sellers in Bend's $500K to $600K range are giving buyers an average of nearly $10,000 at closing — and most buyers have no idea that's even possible to ask for."

---

### 3. Subdivision Price Per SqFt Leaderboard

**Angle:** Rank every subdivision in Bend by median close price per square foot — the definitive answer to "which neighborhood is actually appreciating fastest?"

**Why unique:** Subdivision-level price/sqft data requires MLS access and the ability to group 871 subdivisions with enough sales volume to be meaningful. No public source does this.

**Fields used:** `"SubdivisionName"`, `close_price_per_sqft`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  "SubdivisionName",
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(AVG(close_price_per_sqft)::numeric, 2) AS avg_price_per_sqft,
  ROUND(MIN(close_price_per_sqft)::numeric, 2) AS min_price_per_sqft,
  ROUND(MAX(close_price_per_sqft)::numeric, 2) AS max_price_per_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "SubdivisionName" IS NOT NULL
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY "SubdivisionName"
HAVING COUNT(*) >= 5
ORDER BY median_price_per_sqft DESC
LIMIT 20;
```

**VO hook:** "We ranked every Bend subdivision by price per square foot — the top 20 list will surprise you."

---

### 4. Full Days-to-Pending Distribution Curve

**Angle:** The median days-to-pending number hides a bimodal distribution — some homes go under contract in a weekend, others drag for months. Here is the full picture.

**Why unique:** Every market report publishes a single median. The histogram reveals the real market shape: how many homes go pending in under 7 days, 8–14, 15–30, 31–60, 61–90, and 90+. Two very different markets can have the same median.

**Fields used:** `days_to_pending`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN days_to_pending <= 7 THEN '0–7 days'
    WHEN days_to_pending <= 14 THEN '8–14 days'
    WHEN days_to_pending <= 30 THEN '15–30 days'
    WHEN days_to_pending <= 60 THEN '31–60 days'
    WHEN days_to_pending <= 90 THEN '61–90 days'
    ELSE '90+ days'
  END AS dtp_bucket,
  COUNT(*) AS listings_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_total
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND days_to_pending IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1 (keeps bucket counts to true residential SFR)
GROUP BY dtp_bucket
ORDER BY MIN(days_to_pending);
```

**VO hook:** "The median DOM in Bend is published every month — but it hides the fact that 38% of homes are selling in under a week while another 22% are sitting for three months or more."

---

### 5. Back-on-Market Listings: How Much They Lost

**Angle:** When a deal falls through and a listing comes back to market, sellers almost always take a price cut — and buyers who waited just got rewarded.

**Why unique:** Tracking BOM listings requires `back_on_market_count` plus cross-referencing the `price_history` table. No consumer-facing tool publishes the average price loss attributable to a failed deal.

**Fields used:** `back_on_market_count`, `"ListPrice"`, `"ClosePrice"`, `largest_price_drop_pct`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  COUNT(*) AS bom_listings,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "OriginalListPrice")::numeric, 0) AS median_original_list_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY ("OriginalListPrice" - "ClosePrice")
  )::numeric, 0) AS median_price_loss,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY 100.0 * ("OriginalListPrice" - "ClosePrice") / NULLIF("OriginalListPrice", 0)
  )::numeric, 1) AS median_pct_loss,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY largest_price_drop_pct)::numeric, 1) AS median_largest_drop_pct
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND back_on_market_count >= 1
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "OriginalListPrice" >= 10000  -- UF1 (list-side floor; > 0 lets through 272 rows that produce 99.9× ratios)
  AND "ClosePrice" >= 10000          -- UF1
  AND ("ClosePrice"::numeric / "OriginalListPrice"::numeric) BETWEEN 0.5 AND 1.5;  -- UF2 inline (story computes the ratio in math, not via the column)
```

**VO hook:** "Every time a deal falls through in Bend, the seller ends up surrendering an average of $18,000 off original asking price — and buyers who come in second get the discount."

---

### 6. Price Reduction Timing

**Angle:** Sellers who cut their price do it at predictable points in the listing lifecycle — and the data shows exactly when panic sets in.

**Why unique:** Requires `price_drop_count`, `days_to_pending`, and `listing_history` to reconstruct the timeline of when drops happen relative to list date. No public source tracks when in a listing's life the price cuts occur.

**Fields used:** `price_drop_count`, `largest_price_drop_pct`, `days_to_pending`, `"OnMarketDate"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN price_drop_count = 0 THEN 'No reduction'
    WHEN price_drop_count = 1 THEN '1 reduction'
    WHEN price_drop_count = 2 THEN '2 reductions'
    ELSE '3+ reductions'
  END AS reduction_tier,
  COUNT(*) AS listings,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY largest_price_drop_pct)::numeric, 1) AS median_largest_drop_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY 100.0 * ("ClosePrice" - "ListPrice") / NULLIF("ListPrice", 0)
  )::numeric, 1) AS median_close_vs_original_list_pct,
  ROUND(AVG(price_drop_count)::numeric, 1) AS avg_reductions
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND days_to_pending > 0
  AND "ListPrice" >= 10000      -- UF1 list-side
  AND "ClosePrice" >= 10000     -- UF1
  AND ("ClosePrice"::numeric / "ListPrice"::numeric) BETWEEN 0.5 AND 1.5  -- UF2 inline (close-vs-original-list ratio is computed in math)
GROUP BY reduction_tier
ORDER BY MIN(price_drop_count);
```

**VO hook:** "Sellers who cut price twice end up waiting nearly three times as long to sell — and still close for less than original asking."

---

### 7. Financing Type Shift Over 24 Months

**Angle:** The ratio of cash to conventional to FHA to VA buyers has shifted meaningfully over two years — and the direction tells you who is winning in this market.

**Why unique:** Requires normalizing the `buyer_financing` column across three incompatible format variants using `ILIKE` pattern matching, then trending by month. No public report does this level of financing-mix analysis locally.

**Fields used:** `buyer_financing`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  DATE_TRUNC('month', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) AS close_month,
  COUNT(*) AS total_sales,
  SUM(CASE WHEN buyer_financing::text ILIKE '%cash%' THEN 1 ELSE 0 END) AS cash,
  SUM(CASE WHEN buyer_financing::text ILIKE '%conventional%' THEN 1 ELSE 0 END) AS conventional,
  SUM(CASE WHEN buyer_financing::text ILIKE '%fha%' THEN 1 ELSE 0 END) AS fha,
  SUM(CASE WHEN buyer_financing::text ILIKE '%va%' THEN 1 ELSE 0 END) AS va,
  SUM(CASE WHEN buyer_financing::text ILIKE '%usda%' THEN 1 ELSE 0 END) AS usda,
  SUM(CASE WHEN buyer_financing::text NOT ILIKE '%cash%'
              AND buyer_financing::text NOT ILIKE '%conventional%'
              AND buyer_financing::text NOT ILIKE '%fha%'
              AND buyer_financing::text NOT ILIKE '%va%'
              AND buyer_financing::text NOT ILIKE '%usda%'
           THEN 1 ELSE 0 END) AS other_unknown,
  ROUND(100.0 * SUM(CASE WHEN buyer_financing::text ILIKE '%cash%' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cash_pct,
  ROUND(100.0 * SUM(CASE WHEN buyer_financing::text ILIKE '%conventional%' THEN 1 ELSE 0 END) / COUNT(*), 1) AS conventional_pct
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '24 months'
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY close_month
ORDER BY close_month;
```

**VO hook:** "Two years ago, cash buyers were closing 31% of all Bend home sales. Watch what that number does between now and today."

---

### 8. Walk Score vs Price Per SqFt Correlation

**Angle:** Do walkable neighborhoods in Bend actually command a price premium per square foot — or do buyers here not care about walkability?

**Why unique:** Requires `walk_score` field matched against `close_price_per_sqft`. No MLS report or consumer portal publishes this correlation locally.

**Fields used:** `walk_score`, `close_price_per_sqft`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN walk_score < 25 THEN 'Car-Dependent (0–24)'
    WHEN walk_score < 50 THEN 'Some Errands (25–49)'
    WHEN walk_score < 70 THEN 'Somewhat Walkable (50–69)'
    WHEN walk_score < 90 THEN 'Very Walkable (70–89)'
    ELSE 'Walker\'s Paradise (90–100)'
  END AS walk_tier,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY walk_score)::numeric, 0) AS median_walk_score,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(AVG(close_price_per_sqft)::numeric, 2) AS avg_price_per_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND walk_score IS NOT NULL
  AND close_price_per_sqft > 0
GROUP BY walk_tier
ORDER BY MIN(walk_score);
```

**VO hook:** "We matched every home sale in Bend to its walk score and ran the numbers — the answer on whether walkability adds value here will change how you think about location."

---

### 9. Seasonal Days-to-Pending Patterns Across 3 Years

**Angle:** Month-by-month days-to-pending layered for 2024, 2025, and 2026 — see exactly when the market heats up and cools down every year, and whether this year is tracking ahead or behind.

**Why unique:** Requires 3+ years of closed data with pre-computed days_to_pending per transaction, then pivoting by month and year. No consumer tool shows this seasonality overlay locally.

**Fields used:** `days_to_pending`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date)::int AS close_year,
  EXTRACT(MONTH FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date)::int AS close_month,
  TO_CHAR(("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date, 'Mon') AS month_name,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY days_to_pending
  )::numeric, 0) AS median_days_to_pending,
  ROUND(AVG(days_to_pending)::numeric, 0) AS avg_days_to_pending
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2024-01-01'
  AND days_to_pending IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY close_year, close_month, month_name
ORDER BY close_year, close_month;
```

**VO hook:** "For three years running, Bend homes listed in March sell twice as fast as homes listed in October — here is why that matters for your timing."

---

### 10. New Construction vs Resale Price Premium by ZIP

**Angle:** New construction commands a premium over resale — but the gap is not the same everywhere, and in some ZIPs it has flipped.

**Why unique:** Requires splitting `new_construction_yn` by ZIP code and comparing medians. No public report publishes this split at the ZIP level for Central Oregon.

**Fields used:** `new_construction_yn`, `"PostalCode"`, `close_price_per_sqft`, `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  "PostalCode",
  new_construction_yn,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "PostalCode" IS NOT NULL
  AND new_construction_yn IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY "PostalCode", new_construction_yn
HAVING COUNT(*) >= 5
ORDER BY "PostalCode", new_construction_yn;
```

**VO hook:** "In one Bend ZIP code, new construction is selling for $112 more per square foot than resale — in the ZIP right next to it, resale is actually winning."

---

### 11. The Overpriced Listing Penalty

**Angle:** Listings that required a price cut to sell sat on the market dramatically longer and still closed for less — here is the exact penalty in dollars and days.

**Why unique:** Requires joining `price_drop_count`, DOM computation, and `sale_to_final_list_ratio` to quantify the penalty versus no-reduction listings. Consumer portals show none of this.

**Fields used:** `price_drop_count`, `days_to_pending`, `sale_to_final_list_ratio`, `"ClosePrice"`, `"ListPrice"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE WHEN price_drop_count = 0 THEN 'No price cuts' ELSE 'Had price cuts' END AS reduction_group,
  COUNT(*) AS listings,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio)::numeric, 3) AS median_sale_to_list,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY "ClosePrice" - "ListPrice"
  )::numeric, 0) AS median_close_vs_original,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY 100.0 * ("ClosePrice" - "ListPrice") / NULLIF("ListPrice", 0)
  )::numeric, 1) AS median_pct_off_original
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND days_to_pending IS NOT NULL
  AND "ListPrice" >= 10000          -- UF1 list-side
  AND "ClosePrice" >= 10000         -- UF1
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5  -- UF2
GROUP BY reduction_group;
```

**VO hook:** "Homes that started too high and needed a price cut sold for an average of $23,000 less than their original asking price — and took {{dtp_delta}} more days to go pending."
<!-- Note: "47 more days" was from old CloseDate–OnMarketDate methodology. Re-verify with days_to_pending delta before publishing. -->

---

### 12. Pending Fallthrough Rate by Month

**Angle:** What percentage of homes that go under contract fall back to active — and is that rate rising?

**Why unique:** Requires counting status transitions from Pending back to Active using `back_on_market_count` combined with monthly pending volume from `pending_timestamp`. No public market report tracks this metric.

**Fields used:** `back_on_market_count`, `pending_timestamp`, `"StandardStatus"`, `"CloseDate"`

**SQL:**
```sql
WITH pending_monthly AS (
  SELECT
    DATE_TRUNC('month', (pending_timestamp AT TIME ZONE 'America/Los_Angeles')::date) AS pending_month,
    COUNT(*) AS total_went_pending,
    SUM(CASE WHEN back_on_market_count >= 1 THEN 1 ELSE 0 END) AS fell_through
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND pending_timestamp IS NOT NULL
    AND pending_timestamp >= NOW() - INTERVAL '18 months'
  GROUP BY pending_month
)
SELECT
  pending_month,
  total_went_pending,
  fell_through,
  ROUND(100.0 * fell_through / NULLIF(total_went_pending, 0), 1) AS fallthrough_rate_pct
FROM pending_monthly
ORDER BY pending_month;
```

**VO hook:** "In the last 18 months, Bend's pending fallthrough rate has climbed from 6% to over 11% — meaning more buyers are walking away after going under contract."

---

### 13. HOA Impact on Days to Pending

**Angle:** HOA communities promise amenities and maintenance — but do buyers pay a speed premium for that, or does the HOA fee slow them down?

**Why unique:** Requires `details` JSONB key for HOA presence/amount cross-referenced against `days_to_pending`. No consumer-facing tool publishes HOA-stratified days-to-pending data.

**Fields used:** `details->>'AssociationYN'`, `details->>'AssociationFee'`, `days_to_pending`, `close_price_per_sqft`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN details->>'AssociationYN' ILIKE '%true%'
      OR details->>'AssociationYN' = '1'
      OR (details->>'AssociationFee')::numeric > 0 THEN 'Has HOA'
    ELSE 'No HOA'
  END AS hoa_status,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY (details->>'AssociationFee')::numeric
  ) FILTER (
    WHERE (details->>'AssociationFee') IS NOT NULL
      AND (details->>'AssociationFee')::numeric > 0
  )::numeric, 0) AS median_hoa_fee
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND days_to_pending > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY hoa_status;
```

**VO hook:** "We compared 800 Bend home sales to find out whether paying HOA dues actually gets you a faster sale — the answer is not what HOA boards want you to hear."

---

### 14. Architectural Style Premium

**Angle:** Craftsman, Ranch, Contemporary, Northwest Contemporary — which architectural style commands the most per square foot in Bend?

**Why unique:** Requires `details->>'ArchitecturalStyle'` normalized across MLS input variations. No public market report segments price/sqft by architectural style in this market.

**Fields used:** `details->>'ArchitecturalStyle'`, `close_price_per_sqft`, `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  TRIM(details->>'ArchitecturalStyle') AS architectural_style,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(AVG(close_price_per_sqft)::numeric, 2) AS avg_price_per_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND details->>'ArchitecturalStyle' IS NOT NULL
  AND TRIM(details->>'ArchitecturalStyle') <> ''
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY architectural_style
HAVING COUNT(*) >= 10
ORDER BY median_price_per_sqft DESC
LIMIT 15;
```

**VO hook:** "Northwest Contemporary style commands $68 more per square foot than Ranch in Bend — and most buyers don't realize architectural style is moving the price needle this much."

---

### 15. Price Band Migration

**Angle:** Are Bend buyers moving down into lower price bands year-over-year, or are they stretching further up? The shift in transaction volume by price band tells the whole affordability story.

**Why unique:** Requires full-year closed volume by price band across two consecutive years to show migration direction. No local report publishes this cross-year price band distribution comparison.

**Fields used:** `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN "ClosePrice" < 400000 THEN 'Under $400K'
    WHEN "ClosePrice" < 500000 THEN '$400K–$500K'
    WHEN "ClosePrice" < 600000 THEN '$500K–$600K'
    WHEN "ClosePrice" < 750000 THEN '$600K–$750K'
    WHEN "ClosePrice" < 1000000 THEN '$750K–$1M'
    ELSE '$1M+'
  END AS price_band,
  SUM(CASE WHEN EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1 THEN 1 ELSE 0 END) AS prior_year_sales,
  SUM(CASE WHEN ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= DATE_TRUNC('year', CURRENT_DATE)
                AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date < CURRENT_DATE THEN 1 ELSE 0 END) AS ytd_current_year,
  ROUND(100.0 * SUM(CASE WHEN EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1 THEN 1 ELSE 0 END)
    / NULLIF(SUM(SUM(CASE WHEN EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1 THEN 1 ELSE 0 END)) OVER (), 0), 1) AS prior_year_share_pct
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
  AND "ClosePrice" >= 10000  -- UF1 (price-band bucketing requires the floor)
ORDER BY MIN("ClosePrice");
```

**VO hook:** "Last year, homes under $500K made up 28% of all Bend sales. This year, that same segment is down to 19% — buyers have migrated up whether they wanted to or not."

---

### 16. Absorption Rate by Price Tier

**Angle:** Every price tier has its own supply-demand balance — some are screaming seller's markets, others are stacked with inventory. Here is the months-of-supply breakdown by price band.

**Why unique:** Months of supply computed per price band requires active inventory counts plus 6-month closed velocity per band. No public report shows this tier-level absorption breakdown for Bend.

**MoS computation rule (mandatory — see `query-rules.md` C3 + UF3 + Template 11):** Both the active CTE and the closed CTE MUST share identical SFR + `PropertyType='A'` filters. Never substitute `market_pulse_live.months_of_supply` — that view mixes all sub-types and produces a verdict-flipping gap (Bend stored 5.80 vs SFR-only 4.20 = 38% off). The verdict pill on screen MUST match the manually-computed number against the ≤4 / 4–6 / ≥6 thresholds.

**Fields used:** `"ClosePrice"`, `"ListPrice"`, `"StandardStatus"`, `"CloseDate"`

**SQL:**
```sql
WITH closed_6mo AS (
  SELECT
    CASE
      WHEN "ClosePrice" < 400000 THEN 'Under $400K'
      WHEN "ClosePrice" < 500000 THEN '$400K–$500K'
      WHEN "ClosePrice" < 600000 THEN '$500K–$600K'
      WHEN "ClosePrice" < 750000 THEN '$600K–$750K'
      WHEN "ClosePrice" < 1000000 THEN '$750K–$1M'
      ELSE '$1M+'
    END AS price_band,
    COUNT(*) AS closed_count
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'  -- UF3 SFR-only on closed side
    AND "PropertyType" = 'A'
    AND "StandardStatus" = 'Closed'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '6 months'
    AND "ClosePrice" IS NOT NULL
    AND "ClosePrice" >= 10000  -- UF1 (price-band bucketing requires the floor)
  GROUP BY price_band
),
active_now AS (
  SELECT
    CASE
      WHEN "ListPrice" < 400000 THEN 'Under $400K'
      WHEN "ListPrice" < 500000 THEN '$400K–$500K'
      WHEN "ListPrice" < 600000 THEN '$500K–$600K'
      WHEN "ListPrice" < 750000 THEN '$600K–$750K'
      WHEN "ListPrice" < 1000000 THEN '$750K–$1M'
      ELSE '$1M+'
    END AS price_band,
    COUNT(*) AS active_count
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'  -- UF3 SFR-only on active side (must match closed CTE)
    AND "PropertyType" = 'A'
    AND "StandardStatus" = 'Active'
    AND "ListPrice" >= 10000  -- UF1 list-side floor
  GROUP BY price_band
)
SELECT
  a.price_band,
  COALESCE(a.active_count, 0) AS active_listings,
  COALESCE(c.closed_count, 0) AS closed_last_6mo,
  ROUND(COALESCE(c.closed_count, 0)::numeric / 6, 1) AS avg_monthly_sales,
  ROUND(
    COALESCE(a.active_count, 0)::numeric / NULLIF(COALESCE(c.closed_count, 0)::numeric / 6, 0),
    1
  ) AS months_of_supply,
  CASE
    WHEN COALESCE(a.active_count, 0)::numeric / NULLIF(COALESCE(c.closed_count, 0)::numeric / 6, 0) <= 4 THEN 'Seller''s Market'
    WHEN COALESCE(a.active_count, 0)::numeric / NULLIF(COALESCE(c.closed_count, 0)::numeric / 6, 0) <= 6 THEN 'Balanced Market'
    ELSE 'Buyer''s Market'
  END AS market_condition
FROM active_now a
LEFT JOIN closed_6mo c ON a.price_band = c.price_band
ORDER BY MIN(CASE a.price_band
  WHEN 'Under $400K' THEN 1
  WHEN '$400K–$500K' THEN 2
  WHEN '$500K–$600K' THEN 3
  WHEN '$600K–$750K' THEN 4
  WHEN '$750K–$1M' THEN 5
  ELSE 6 END);
```

**VO hook:** "Homes under $500K in Bend have 1.8 months of supply — that is a war zone. Homes over $1 million have 9 months — completely different market, same city."

---

### 17. The 90-Day Stale Listing

**Angle:** What actually happens to listings that sit past 90 days? Do they sell at a discount, expire, relist, or just disappear?

**Why unique:** Requires segmenting by DOM > 90 and tracking final disposition — closed with discount, withdrawn, expired — using `back_on_market_count` and `largest_price_drop_pct`. No consumer tool publishes the outcome distribution for stale listings.

**Fields used:** `days_to_pending`, `"OnMarketDate"`, `"CloseDate"`, `"StandardStatus"`, `price_drop_count`, `largest_price_drop_pct`, `"ClosePrice"`, `"ListPrice"`

**SQL:**
-- Closed listings: use days_to_pending > 90 (Beacon methodology)
-- Expired/Withdrawn/Cancelled still-active listings: use now() - OnMarketDate > 90 days (labeled "days active", not DOM)
```sql
WITH stale AS (
  SELECT
    "StandardStatus",
    price_drop_count,
    largest_price_drop_pct,
    "ClosePrice",
    "ListPrice",
    back_on_market_count,
    -- For closed: days_to_pending is the relevant metric; for expired: days active at expiry
    CASE
      WHEN "StandardStatus" = 'Closed' THEN days_to_pending
      ELSE EXTRACT(DAY FROM CURRENT_DATE - "OnMarketDate"::date)::int
    END AS total_days
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND "ListPrice" >= 10000  -- UF1 list-side (closed + expired both compute price math)
    AND (
      ("StandardStatus" = 'Closed'
        AND "ClosePrice" >= 10000  -- UF1 (closed-side floor; protects close-vs-list ratio)
        AND ("ClosePrice"::numeric / "ListPrice"::numeric) BETWEEN 0.5 AND 1.5  -- UF2 inline
        AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
        AND days_to_pending > 90)  -- Beacon methodology for closed sales
      OR
      ("StandardStatus" IN ('Expired', 'Withdrawn', 'Cancelled')
        AND "OnMarketDate" IS NOT NULL
        AND "OnMarketDate"::date >= CURRENT_DATE - INTERVAL '12 months'
        AND EXTRACT(DAY FROM CURRENT_DATE - "OnMarketDate"::date) > 90)  -- days active for non-closed
    )
)
SELECT
  "StandardStatus",
  COUNT(*) AS listing_count,
  ROUND(AVG(total_dom)::numeric, 0) AS avg_dom,
  ROUND(AVG(price_drop_count)::numeric, 1) AS avg_price_cuts,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY largest_price_drop_pct)::numeric, 1) AS median_largest_cut_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY 100.0 * ("ClosePrice" - "ListPrice") / NULLIF("ListPrice", 0)
  ) FILTER (WHERE "StandardStatus" = 'Closed')::numeric, 1) AS median_close_vs_list_pct
FROM stale
GROUP BY "StandardStatus"
ORDER BY listing_count DESC;
```

**VO hook:** "Of every 10 Bend homes that sit past 90 days, 4 eventually sell — at an average 8% below original asking — and the other 6 expire or get pulled off the market entirely."

---

### 18. Seller Concession Trends Over 12 Months

**Angle:** The share of sellers offering concessions has been creeping upward for months — here is the exact trend line, not a one-quarter snapshot.

**Why unique:** Month-over-month concession rate and median concession amount requires `concessions_amount` trended over time. No local market report publishes this trend.

**Fields used:** `concessions_amount`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  DATE_TRUNC('month', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) AS close_month,
  COUNT(*) AS total_with_data,
  SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) AS with_concessions,
  ROUND(
    100.0 * SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) / COUNT(*),
    1
  ) AS concession_rate_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY concessions_amount)
    FILTER (WHERE concessions_amount > 0)::numeric, 0) AS median_concession_amount,
  ROUND(AVG(concessions_amount) FILTER (WHERE concessions_amount > 0)::numeric, 0) AS avg_concession_amount,
  ROUND(SUM(concessions_amount) FILTER (WHERE concessions_amount > 0)::numeric, 0) AS total_concessions_paid
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND concessions_amount IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY close_month
ORDER BY close_month;
```

**VO hook:** "Twelve months ago, 31% of Bend sellers were paying concessions. Last month, that number hit 47% — the market is shifting and most sellers haven't gotten the memo."

---

### 19. Green Energy Premium

**Angle:** Solar panels, heat pumps, and EV chargers are showing up on Bend listing sheets more than ever — but do they actually move the price needle?

**Why unique:** Requires JSONB keys for green energy features (`GreenEnergyGeneration`, `GreenEnergyEfficient`, `GreenBuildingVerificationType`) cross-referenced against `close_price_per_sqft`. No public report quantifies this locally.

**Fields used:** `details->>'GreenEnergyGeneration'`, `details->>'GreenEnergyEfficient'`, `details->>'GreenBuildingVerificationType'`, `close_price_per_sqft`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN (details->>'GreenEnergyGeneration' IS NOT NULL AND TRIM(details->>'GreenEnergyGeneration') <> '')
      OR (details->>'GreenEnergyEfficient' IS NOT NULL AND TRIM(details->>'GreenEnergyEfficient') <> '')
      OR (details->>'GreenBuildingVerificationType' IS NOT NULL AND TRIM(details->>'GreenBuildingVerificationType') <> '')
    THEN 'Has Green Features'
    ELSE 'No Green Features'
  END AS green_status,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(AVG(close_price_per_sqft)::numeric, 2) AS avg_price_per_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY green_status;
```

**VO hook:** "Bend homes with solar or energy-efficient features are closing at $41 more per square foot than comparable homes without them — that solar install just changed the math."

---

### 20. School District Premium

**Angle:** In Bend-La Pine Schools, your elementary school assignment can add or subtract thousands from your home's value — and most buyers do not know which schools command the biggest premium.

**Why unique:** Requires `details->>'ElementarySchool'` normalized and grouped against `close_price_per_sqft`. No public tool publishes school-level price premiums for this market.

**Fields used:** `details->>'ElementarySchool'`, `close_price_per_sqft`, `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  TRIM(details->>'ElementarySchool') AS elementary_school,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(AVG(close_price_per_sqft)::numeric, 2) AS avg_price_per_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND details->>'ElementarySchool' IS NOT NULL
  AND TRIM(details->>'ElementarySchool') <> ''
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY elementary_school
HAVING COUNT(*) >= 8
ORDER BY median_price_per_sqft DESC;
```

**VO hook:** "Two houses a half-mile apart in Bend can differ by $55 per square foot purely because of which elementary school they're zoned to — and that gap is widening."

---

### 21. Lot Size Sweet Spot

**Angle:** Buyers pay a premium for some lot sizes but not others — there is a range where price per square foot of living space peaks, and it is not the biggest lots.

**Why unique:** Requires `details->>'LotSizeSquareFeet'` or `details->>'LotSizeAcres'` bucketed against `close_price_per_sqft`. No consumer tool publishes lot-size-stratified price/sqft locally.

**Fields used:** `details->>'LotSizeSquareFeet'`, `close_price_per_sqft`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN (details->>'LotSizeSquareFeet')::numeric < 5000 THEN 'Under 5,000 sqft'
    WHEN (details->>'LotSizeSquareFeet')::numeric < 8000 THEN '5,000–7,999 sqft'
    WHEN (details->>'LotSizeSquareFeet')::numeric < 12000 THEN '8,000–11,999 sqft'
    WHEN (details->>'LotSizeSquareFeet')::numeric < 20000 THEN '12,000–19,999 sqft'
    WHEN (details->>'LotSizeSquareFeet')::numeric < 43560 THEN '20,000 sqft–1 acre'
    ELSE 'Over 1 acre'
  END AS lot_size_bucket,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY (details->>'LotSizeSquareFeet')::numeric
  )::numeric, 0) AS median_lot_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND details->>'LotSizeSquareFeet' IS NOT NULL
  AND (details->>'LotSizeSquareFeet')::numeric > 0
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY lot_size_bucket
HAVING COUNT(*) >= 10
ORDER BY MIN((details->>'LotSizeSquareFeet')::numeric);
```

**VO hook:** "Buyers are paying top dollar per square foot for homes on 8,000-to-12,000 square foot lots — go bigger than an acre and the price per foot actually drops."

---

### 22. The Relisting Penalty

**Angle:** Homes that were withdrawn and relisted at a new price face a credibility penalty — buyers know it sat before, and the data proves they negotiate accordingly.

**Why unique:** Requires matching `back_on_market_count >= 1` with `price_history` to isolate relist price changes versus simple BOM at same price. Reveals a market dynamic invisible to buyers and sellers without this data.

**Fields used:** `back_on_market_count`, `price_drop_count`, `"ListPrice"`, `"ClosePrice"`, `largest_price_drop_pct`, `days_to_pending`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN back_on_market_count = 0 THEN 'Never relisted'
    WHEN back_on_market_count = 1 THEN 'Relisted once'
    ELSE 'Relisted 2+ times'
  END AS relist_group,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY 100.0 * ("ClosePrice" - "ListPrice") / NULLIF("ListPrice", 0)
  )::numeric, 1) AS median_close_vs_original_list_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY largest_price_drop_pct)::numeric, 1) AS median_largest_drop_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "ListPrice" >= 10000     -- UF1 list-side
  AND "ClosePrice" >= 10000    -- UF1
  AND ("ClosePrice"::numeric / "ListPrice"::numeric) BETWEEN 0.5 AND 1.5  -- UF2 inline (story computes ratio in math, not via column)
  AND days_to_pending > 0
GROUP BY relist_group
ORDER BY MIN(back_on_market_count);
```

**VO hook:** "Every time a Bend home gets relisted, the seller gives up an average of 4.2% more off original asking price — the market has a long memory."

---

### 23. Bedroom Count Value Analysis

**Angle:** Three-bedroom homes versus four-bedroom homes — which configuration delivers more value per square foot, and where does the five-bedroom penalty kick in?

**Why unique:** Price/sqft by bedroom count requires enough closed volume per tier to be statistically meaningful — Ryan Realty's 589K+ row dataset delivers that where small local reports cannot.

**Fields used:** `"BedroomsTotal"`, `close_price_per_sqft`, `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  "BedroomsTotal",
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "TotalLivingAreaSqFt")::numeric, 0) AS median_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "BedroomsTotal" BETWEEN 2 AND 6
  AND close_price_per_sqft > 0
  AND "TotalLivingAreaSqFt" > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY "BedroomsTotal"
ORDER BY "BedroomsTotal";
```

**VO hook:** "Four-bedroom homes in Bend are closing at $14 more per square foot than three-bedroom homes — but five bedrooms actually trades at a discount, and here is why."

---

### 24. Agent Market Share Shifts

**Angle:** Which Bend listing offices gained or lost market share over the last 12 months — and which new players are disrupting the established order?

**Why unique:** Requires `details->>'ListOfficeName'` grouped by volume with YoY comparison. This is internal competitive intelligence unavailable on any consumer-facing platform. Mark this segment INTERNAL USE ONLY — do not publish publicly.

**Fields used:** `details->>'ListOfficeName'`, `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
WITH current_year AS (
  SELECT
    TRIM(details->>'ListOfficeName') AS office_name,
    COUNT(*) AS sales_count,
    ROUND(SUM("ClosePrice")::numeric, 0) AS total_volume
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND "StandardStatus" = 'Closed'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
    AND details->>'ListOfficeName' IS NOT NULL
    AND "ClosePrice" >= 10000  -- UF1 (SUM volume math poisoned by $0.09 artifacts)
  GROUP BY office_name
),
prior_year AS (
  SELECT
    TRIM(details->>'ListOfficeName') AS office_name,
    COUNT(*) AS sales_count,
    ROUND(SUM("ClosePrice")::numeric, 0) AS total_volume
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND "StandardStatus" = 'Closed'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '24 months'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date < CURRENT_DATE - INTERVAL '12 months'
    AND details->>'ListOfficeName' IS NOT NULL
    AND "ClosePrice" >= 10000  -- UF1
  GROUP BY office_name
)
SELECT
  c.office_name,
  c.sales_count AS current_12mo_sales,
  COALESCE(p.sales_count, 0) AS prior_12mo_sales,
  c.sales_count - COALESCE(p.sales_count, 0) AS sales_delta,
  ROUND(c.total_volume::numeric / 1000000, 2) AS current_volume_millions,
  ROUND(100.0 * (c.sales_count - COALESCE(p.sales_count, 0)) / NULLIF(p.sales_count, 0), 1) AS pct_change
FROM current_year c
LEFT JOIN prior_year p ON c.office_name = p.office_name
WHERE c.sales_count >= 10
ORDER BY c.total_volume DESC
LIMIT 15;
```

**VO hook:** "The top listing office in Bend lost 18% of its market share in the last year — and a firm that barely existed two years ago just cracked the top five."

---

### 25. Days Pending to Close by Financing Type

**Angle:** Cash buyers promise speed at closing — but do they actually deliver, and by how many days versus conventional and VA loans?

**Why unique:** Requires computing pending-to-close duration from `pending_timestamp` to `"CloseDate"`, stratified by `buyer_financing`. No public report publishes this breakdown for Central Oregon.

**Fields used:** `buyer_financing`, `pending_timestamp`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN buyer_financing::text ILIKE '%cash%' THEN 'Cash'
    WHEN buyer_financing::text ILIKE '%conventional%' THEN 'Conventional'
    WHEN buyer_financing::text ILIKE '%fha%' THEN 'FHA'
    WHEN buyer_financing::text ILIKE '%va%' THEN 'VA'
    WHEN buyer_financing::text ILIKE '%usda%' THEN 'USDA'
    ELSE 'Other / Unknown'
  END AS financing_type,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(DAY FROM
      ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      - (pending_timestamp AT TIME ZONE 'America/Los_Angeles')::date
    )
  )::numeric, 0) AS median_pending_to_close_days,
  ROUND(AVG(
    EXTRACT(DAY FROM
      ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      - (pending_timestamp AT TIME ZONE 'America/Los_Angeles')::date
    )
  )::numeric, 0) AS avg_pending_to_close_days,
  ROUND(MIN(
    EXTRACT(DAY FROM
      ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
      - (pending_timestamp AT TIME ZONE 'America/Los_Angeles')::date
    )
  )::numeric, 0) AS fastest_close_days
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND pending_timestamp IS NOT NULL
  AND "CloseDate" IS NOT NULL
  AND "ClosePrice" >= 10000  -- UF1
  AND EXTRACT(DAY FROM
    ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date
    - (pending_timestamp AT TIME ZONE 'America/Los_Angeles')::date
  ) BETWEEN 1 AND 120
GROUP BY financing_type
ORDER BY median_pending_to_close_days;
```

**VO hook:** "Cash buyers in Bend close in a median of 14 days. VA loan buyers close in 32. If you are writing an offer, the gap between those two numbers is leverage."

---

### 26. Price Drops Per Listing by Price Band

**Angle:** How many price cuts does it take to move a home in each price band — and has that number changed in the last year?

**Why unique:** Average number of price reductions per listing by price band requires `price_drop_count` trended over time. No public market report tracks this metric.

**Fields used:** `price_drop_count`, `"ClosePrice"`, `"ListPrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN "ClosePrice" < 400000 THEN 'Under $400K'
    WHEN "ClosePrice" < 500000 THEN '$400K–$500K'
    WHEN "ClosePrice" < 600000 THEN '$500K–$600K'
    WHEN "ClosePrice" < 750000 THEN '$600K–$750K'
    WHEN "ClosePrice" < 1000000 THEN '$750K–$1M'
    ELSE '$1M+'
  END AS price_band,
  COUNT(*) AS total_sales,
  SUM(CASE WHEN price_drop_count = 0 THEN 1 ELSE 0 END) AS sold_without_cut,
  SUM(CASE WHEN price_drop_count >= 1 THEN 1 ELSE 0 END) AS needed_at_least_one_cut,
  ROUND(AVG(price_drop_count)::numeric, 2) AS avg_price_cuts,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_drop_count)::numeric, 0) AS median_price_cuts,
  ROUND(100.0 * SUM(CASE WHEN price_drop_count >= 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_needing_cut
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "ClosePrice" >= 10000  -- UF1 (price-band bucketing requires the floor)
GROUP BY price_band
ORDER BY MIN("ClosePrice");
```

**VO hook:** "Sellers asking over $750K in Bend are averaging 2.1 price cuts before closing — buyers in that price range have all the time in the world."

---

### 27. Year Built Value Curve

**Angle:** Is a 1990s home worth more or less per square foot than a 1970s home, a 2000s home, or a brand-new build? The decade-built value curve tells you exactly where the premium is.

**Why unique:** Median price/sqft by decade of construction requires `year_built` bucketed with enough volume per bucket to be meaningful. Ryan Realty's database volume enables this where small samples cannot.

**Fields used:** `year_built`, `close_price_per_sqft`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  CASE
    WHEN year_built < 1960 THEN 'Pre-1960'
    WHEN year_built < 1970 THEN '1960s'
    WHEN year_built < 1980 THEN '1970s'
    WHEN year_built < 1990 THEN '1980s'
    WHEN year_built < 2000 THEN '1990s'
    WHEN year_built < 2010 THEN '2000s'
    WHEN year_built < 2020 THEN '2010s'
    ELSE '2020 or newer'
  END AS decade_built,
  ROUND(AVG(year_built)::numeric, 0) AS avg_year,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "TotalLivingAreaSqFt")::numeric, 0) AS median_sqft
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND year_built IS NOT NULL
  AND year_built BETWEEN 1940 AND EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY decade_built
ORDER BY MIN(year_built);
```

**VO hook:** "Homes built in the 1970s are trading at a $38 per square foot discount versus homes built in the 2010s — but 1990s homes are outperforming both decades on either side."

---

### 28. First-Time Buyer Affordability Window

**Angle:** What percentage of active Bend inventory is actually accessible to a first-time buyer — and how has that window narrowed over the last two years?

**Why unique:** Tracks the share of active listings below $450K (FHA loan limits + PMI entry threshold) over time. No local report frames affordability as a shrinking percentage of the inventory stack.

**Fields used:** `"ListPrice"`, `"StandardStatus"`, `"OnMarketDate"`

**SQL:**
```sql
-- NOTE: This query only reflects currently-active listings grouped by OnMarketDate. It does NOT reconstruct historical monthly inventory snapshots. For historical trends, use status_history or periodic snapshots.
WITH monthly_snapshot AS (
  SELECT
    DATE_TRUNC('month', "OnMarketDate"::date) AS active_month,
    COUNT(*) AS total_active,
    SUM(CASE WHEN "ListPrice" <= 450000 THEN 1 ELSE 0 END) AS under_450k,
    SUM(CASE WHEN "ListPrice" <= 500000 THEN 1 ELSE 0 END) AS under_500k,
    SUM(CASE WHEN "ListPrice" <= 550000 THEN 1 ELSE 0 END) AS under_550k
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND "StandardStatus" = 'Active'
    AND "OnMarketDate"::date >= CURRENT_DATE - INTERVAL '24 months'
  GROUP BY active_month
)
SELECT
  active_month,
  total_active,
  under_450k,
  ROUND(100.0 * under_450k / NULLIF(total_active, 0), 1) AS pct_under_450k,
  ROUND(100.0 * under_500k / NULLIF(total_active, 0), 1) AS pct_under_500k,
  ROUND(100.0 * under_550k / NULLIF(total_active, 0), 1) AS pct_under_550k
FROM monthly_snapshot
ORDER BY active_month;
```

**VO hook:** "Two years ago, 34% of active Bend listings were priced under $450,000. Today, that number is 11% — and it is still falling."

---

### 29. Luxury Segment Deep Dive ($1M+)

**Angle:** Bend's luxury market above $1 million operates by completely different rules — longer DOM, larger concessions, and a financing mix that looks nothing like the broader market.

**Why unique:** Requires isolating the $1M+ cohort and publishing their specific metrics: DOM, concessions, cash rate, months of supply, price/sqft. Most reports lump luxury into overall averages, hiding how different this segment behaves.

**Fields used:** `"ClosePrice"`, `"ListPrice"`, `concessions_amount`, `buyer_financing`, `days_to_pending`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  COUNT(*) AS luxury_sales,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio)::numeric, 3) AS median_sale_to_list,
  SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) AS with_concessions,
  ROUND(100.0 * SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS concession_rate_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY concessions_amount)
    FILTER (WHERE concessions_amount > 0)::numeric, 0) AS median_concession,
  ROUND(100.0 * SUM(CASE WHEN buyer_financing::text ILIKE '%cash%' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cash_pct
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "ClosePrice" >= 1000000  -- segment floor (already exceeds UF1 $10K)
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND days_to_pending IS NOT NULL
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5;  -- UF2
```

**VO hook:** "Above $1 million in Bend, 58% of buyers are paying cash, the median days to pending is {{median_days_to_pending}}, and sellers are giving an average of $28,000 in concessions — this is a completely different market."
<!-- Note: "61 days" was derived from the old CloseDate–OnMarketDate methodology. Re-verify with days_to_pending before publishing. -->

---

### 30. The Weekend Listing Effect

**Angle:** Does going live on a Friday or Saturday — right before buyers start their weekend searches — actually result in faster sales?

**Why unique:** Requires extracting day-of-week from `"OnMarketDate"` and correlating with `days_to_pending`. No public market report tests the weekend-listing hypothesis with real data.

**Fields used:** `"OnMarketDate"`, `days_to_pending`, `sale_to_final_list_ratio`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  TO_CHAR("OnMarketDate"::date, 'Day') AS day_of_week,
  EXTRACT(DOW FROM "OnMarketDate"::date)::int AS dow_num,
  COUNT(*) AS listings_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(AVG(days_to_pending)::numeric, 1) AS avg_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio)::numeric, 3) AS median_sale_to_list,
  SUM(CASE WHEN days_to_pending <= 7 THEN 1 ELSE 0 END) AS sold_in_7_days,
  ROUND(100.0 * SUM(CASE WHEN days_to_pending <= 7 THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_sold_in_7_days
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND "OnMarketDate" IS NOT NULL
  AND days_to_pending > 0
  AND "ClosePrice" >= 10000                          -- UF1
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5    -- UF2
GROUP BY day_of_week, dow_num
ORDER BY dow_num;
```

**VO hook:** "Homes listed on Thursday in Bend go pending in a median of 9 days — homes listed on Monday take 18. Your agent's choice of launch day is worth 9 days of your life."

---

### 31. Inventory Age Distribution

**Angle:** A snapshot of today's active listings by how long they have been sitting — the stale-inventory percentage tells you whether the market is clearing or backing up.

**Why unique:** Real-time active listing age bucketing requires computing current DOM for active listings (`now() - "OnMarketDate"`). No consumer portal publishes this live snapshot for Bend.

**Fields used:** `"OnMarketDate"`, `"StandardStatus"`, `"ListPrice"`

**SQL:**
```sql
SELECT
  CASE
    WHEN EXTRACT(DAY FROM now() - "OnMarketDate")::int <= 30 THEN '0–30 days'
    WHEN EXTRACT(DAY FROM now() - "OnMarketDate")::int <= 60 THEN '31–60 days'
    WHEN EXTRACT(DAY FROM now() - "OnMarketDate")::int <= 90 THEN '61–90 days'
    WHEN EXTRACT(DAY FROM now() - "OnMarketDate")::int <= 180 THEN '91–180 days'
    ELSE '180+ days'
  END AS age_bucket,
  COUNT(*) AS active_listings,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice")::numeric, 0) AS median_list_price,
  ROUND(AVG(EXTRACT(DAY FROM now() - "OnMarketDate"))::numeric, 0) AS avg_days_active
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Active'
  AND "OnMarketDate" IS NOT NULL
GROUP BY age_bucket
ORDER BY MIN(EXTRACT(DAY FROM now() - "OnMarketDate")::int);
```

**VO hook:** "Right now in Bend, 29% of active listings have been sitting for over 90 days — that is the inventory that sellers are either pricing down or losing to the market."

---

### 32. Price Recovery After Back-on-Market

**Angle:** When a deal collapses and a listing comes back, does it eventually recover to its original asking price — or does the market permanently reprice it lower?

**Why unique:** Requires `back_on_market_count`, `"ListPrice"`, `"ClosePrice"`, and `largest_price_drop_pct` to trace the full price arc from original list through BOM through final close. Unavailable on any consumer platform.

**Fields used:** `back_on_market_count`, `"ListPrice"`, `"ClosePrice"`, `largest_price_drop_pct`, `sale_to_final_list_ratio`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  back_on_market_count AS times_back_on_market,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice")::numeric, 0) AS median_original_list,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY 100.0 * ("ClosePrice" - "ListPrice") / NULLIF("ListPrice", 0)
  )::numeric, 1) AS median_close_vs_original_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio)::numeric, 3) AS median_sale_to_final_list,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY largest_price_drop_pct)::numeric, 1) AS median_largest_drop_pct
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND back_on_market_count >= 1
  AND "ListPrice" >= 10000                           -- UF1 list-side
  AND "ClosePrice" >= 10000                          -- UF1
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5    -- UF2
GROUP BY back_on_market_count
ORDER BY back_on_market_count;
```

**VO hook:** "After a deal falls through, 91% of Bend sellers eventually close — but at a price that averages 5.8% below what they asked before the first buyer walked."

---

### 33. Condo vs SFR Performance Gap

**Angle:** Condos and single-family homes in Bend have been diverging on price appreciation, DOM, and concessions — and the gap is telling you something important about where demand actually lives.

**Why unique:** Direct comparison of `property_sub_type` performance across key metrics over 24 months shows divergence or convergence trends. No local report publishes this parallel-track analysis.

**Fields used:** `property_sub_type`, `"PropertyType"`, `close_price_per_sqft`, `"ClosePrice"`, `days_to_pending`, `"CloseDate"`, `concessions_amount`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  property_sub_type,
  DATE_TRUNC('quarter', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) AS close_quarter,
  COUNT(*) AS sales_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(100.0 * SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS concession_rate_pct
FROM listings
WHERE "PropertyType" = 'A'
  AND property_sub_type IN ('Single Family Residence', 'Condominium')
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '24 months'
  AND days_to_pending IS NOT NULL
  AND close_price_per_sqft > 0
  AND "ClosePrice" >= 10000  -- UF1
GROUP BY property_sub_type, close_quarter
ORDER BY property_sub_type, close_quarter;
```

**VO hook:** "Single-family home prices in Bend are up 6% over two years. Condo prices are flat. Those two lines are moving apart — and the reason matters for where you put your money."

---

### 34. The $500K-$600K Battleground

**Angle:** The $500K-to-$600K price band is Bend's most competitive segment — here is an exact breakdown of DOM, concessions, cash buyers, and price-cut frequency in this one price range.

**Why unique:** Micro-analysis of a single price band with full metric depth (DOM distribution, financing mix, concession rate, absorption, price reduction frequency) available only with MLS-level data.

**Fields used:** `"ClosePrice"`, `"ListPrice"`, `buyer_financing`, `concessions_amount`, `price_drop_count`, `days_to_pending`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  COUNT(*) AS total_sales,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_pending)::numeric, 0) AS median_days_to_pending,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio)::numeric, 3) AS median_sale_to_list,
  ROUND(100.0 * SUM(CASE WHEN buyer_financing::text ILIKE '%cash%' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cash_pct,
  ROUND(100.0 * SUM(CASE WHEN concessions_amount > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS concession_rate_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY concessions_amount)
    FILTER (WHERE concessions_amount > 0)::numeric, 0) AS median_concession,
  ROUND(AVG(price_drop_count)::numeric, 2) AS avg_price_cuts,
  SUM(CASE WHEN price_drop_count = 0 THEN 1 ELSE 0 END) AS sold_without_cut,
  ROUND(100.0 * SUM(CASE WHEN price_drop_count = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_cut
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "ClosePrice" BETWEEN 500000 AND 599999  -- segment cap (already exceeds UF1 $10K)
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
  AND days_to_pending IS NOT NULL
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5;  -- UF2
```

**VO hook:** "The $500K-to-$600K range in Bend had 312 sales last year — median {{median_days_to_pending}} days to pending, 41% cash buyers, and 38% of sellers giving concessions. This is where the market gets decided."
<!-- Note: "19 days on market" was from old CloseDate–OnMarketDate methodology. Re-verify with days_to_pending before publishing. -->

---

### 35. Expired Listing Autopsy

**Angle:** What does a Bend listing that fails to sell actually look like — and what specific mistakes did those sellers make?

**Why unique:** Requires isolating `"StandardStatus" IN ('Expired', 'Withdrawn')` and profiling their price, DOM, price-cut history, and how they compare to successful sales in the same period. Unavailable on any consumer platform.

**Fields used:** `"StandardStatus"`, `"ListPrice"`, `price_drop_count`, `largest_price_drop_pct`, `"OnMarketDate"`

**SQL:**
```sql
WITH expired AS (
  SELECT
    'Expired / Withdrawn' AS group_name,
    "ListPrice",
    price_drop_count,
    largest_price_drop_pct,
    EXTRACT(DAY FROM CURRENT_DATE - "OnMarketDate"::date)::int AS days_active_at_expiry,  -- days active, not DOM
    price_per_sqft
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND "StandardStatus" IN ('Expired', 'Withdrawn', 'Cancelled')
    AND "OnMarketDate" IS NOT NULL
    AND "OnMarketDate"::date >= CURRENT_DATE - INTERVAL '12 months'
    AND "ListPrice" >= 10000  -- UF1 list-side
),
sold AS (
  SELECT
    'Sold' AS group_name,
    "ListPrice",
    price_drop_count,
    largest_price_drop_pct,
    days_to_pending AS days_active_at_expiry,  -- days_to_pending for closed sales (Beacon methodology)
    close_price_per_sqft AS price_per_sqft_comparable
  FROM listings
  WHERE property_sub_type = 'Single Family Residence'
    AND "PropertyType" = 'A'
    AND "StandardStatus" = 'Closed'
    AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '12 months'
    AND days_to_pending IS NOT NULL
    AND "ListPrice" >= 10000   -- UF1 list-side
    AND "ClosePrice" >= 10000  -- UF1 (close_price_per_sqft is shown as comparable)
)
SELECT
  group_name,
  COUNT(*) AS listing_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ListPrice")::numeric, 0) AS median_list_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqft)::numeric, 2) AS median_list_price_per_sqft,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_active_at_expiry)::numeric, 0) AS median_days_active,
  ROUND(AVG(price_drop_count)::numeric, 2) AS avg_price_cuts,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY largest_price_drop_pct)::numeric, 1) AS median_largest_cut_pct
FROM (SELECT * FROM expired UNION ALL SELECT * FROM sold) combined
GROUP BY group_name
ORDER BY group_name DESC;
```

**VO hook:** "We autopsied every Bend listing that expired unsold in the last year — the median expired listing was priced $47,000 over what comparable sold homes were getting."

---

### 36. Seasonal Price Patterns

**Angle:** Which month historically produces the highest median close price in Bend — and which month consistently delivers the best buy-side opportunity?

**Why unique:** Multi-year median close price by calendar month with year-over-year overlays reveals the seasonal pricing rhythm that agents know but buyers do not.

**Fields used:** `"ClosePrice"`, `"CloseDate"`, `"StandardStatus"`

**SQL:**
```sql
SELECT
  EXTRACT(MONTH FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date)::int AS close_month_num,
  TO_CHAR(("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date, 'Mon') AS month_name,
  COUNT(*) AS total_sales,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric, 0) AS median_close_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY close_price_per_sqft)::numeric, 2) AS median_price_per_sqft,
  ROUND(AVG("ClosePrice")::numeric, 0) AS avg_close_price,
  -- Break out by year for overlay
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
    FILTER (WHERE EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) = 2024)::numeric, 0) AS median_2024,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
    FILTER (WHERE EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) = 2025)::numeric, 0) AS median_2025,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice")
    FILTER (WHERE EXTRACT(YEAR FROM ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) = 2026)::numeric, 0) AS median_2026
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= '2024-01-01'
  AND "ClosePrice" >= 10000  -- UF1 (replaces > 0; > 0 lets through 1,640 land/artifact rows)
GROUP BY close_month_num, month_name
ORDER BY close_month_num;
```

**VO hook:** "For three years running, June has been the most expensive month to buy a home in Bend — and October has been the cheapest. This is not a coincidence."

---

### 37. Multi-Offer Indicator: Bidding War Map by ZIP

**Angle:** Sale-to-list ratios above 100% are the only public proxy for bidding wars — and the map of where they cluster in Bend tells you where demand is outrunning supply right now.

**Why unique:** ZIP-level `sale_to_final_list_ratio > 1.0` frequency requires MLS close data. No public portal maps bidding-war frequency by ZIP code for this market.

**Fields used:** `sale_to_final_list_ratio`, `"PostalCode"`, `"CloseDate"`, `"StandardStatus"`, `"ClosePrice"`, `"ListPrice"`

**SQL:**
```sql
SELECT
  "PostalCode",
  DATE_TRUNC('month', ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date) AS close_month,
  COUNT(*) AS total_sales,
  SUM(CASE WHEN sale_to_final_list_ratio > 1.0 THEN 1 ELSE 0 END) AS over_asking,
  ROUND(
    100.0 * SUM(CASE WHEN sale_to_final_list_ratio > 1.0 THEN 1 ELSE 0 END) / COUNT(*),
    1
  ) AS pct_over_asking,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_to_final_list_ratio)::numeric, 3) AS median_sale_to_list,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY sale_to_final_list_ratio
  ) FILTER (WHERE sale_to_final_list_ratio > 1.0)::numeric, 3) AS median_over_asking_ratio,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY ("ClosePrice" - "ListPrice")
  ) FILTER (WHERE sale_to_final_list_ratio > 1.0)::numeric, 0) AS median_premium_over_list
FROM listings
WHERE property_sub_type = 'Single Family Residence'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND ("CloseDate" AT TIME ZONE 'America/Los_Angeles')::date >= CURRENT_DATE - INTERVAL '6 months'
  AND "PostalCode" IS NOT NULL
  AND "ListPrice" >= 10000           -- UF1 list-side
  AND "ClosePrice" >= 10000          -- UF1
  AND sale_to_final_list_ratio IS NOT NULL
  AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5  -- UF2
GROUP BY "PostalCode", close_month
HAVING COUNT(*) >= 5
ORDER BY "PostalCode", close_month;
```

**VO hook:** "In one Bend ZIP code, 44% of homes closed above asking price last quarter — the bidding wars are still happening, they are just concentrated in two ZIPs most buyers are not targeting."

---

## Usage Notes

**Before running any query:**
1. Confirm Supabase project is `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`).
2. Run the query fresh in this session — no reusing prior results.
3. Print raw row counts, date windows, and filter values alongside the output.
4. Derive any medians, percentages, or trends from the live result, not from memory.
5. Document every figure in `citations.json` before the segment enters a script.

**Data coverage caveats to disclose on-screen or in VO where relevant:**
- `concessions_amount`: ~39.7% coverage — state "among sales where concession data was reported."
- `buyer_financing`: three incompatible input formats exist; always use `::text ILIKE` pattern matching.
- `walk_score`: not 100% populated — state sample size.
- `details` JSONB keys: coverage varies by MLS agent input discipline; always show count alongside any JSONB-derived stat.

**Months of supply formula (mandatory — see `query-rules.md` C3 / UF3 / Template 11):**
- Canonical formula: `active_listings / (closed_last_N_days / N * 30)`
- Thresholds: ≤ 4.0 = seller's market, 4.0–6.0 = balanced, ≥ 6.0 = buyer's market.
- Verdict pill in video must match the manually-computed number.
- **Both** the active CTE **and** the closed CTE MUST filter `property_sub_type = 'Single Family Residence' AND "PropertyType" = 'A'` (UF3). Mixing sub-types is what makes the stored `market_pulse_live.months_of_supply` value wrong.
- **Never read `market_pulse_live.months_of_supply` into a video, caption, gauge, pill, or VO line.** Always run Template 11 (in `query-rules.md`) live and write the active count, closed count, and divisor into `citations.json`. Reference deltas measured 2026-04-30: Bend stored 5.80 vs SFR-only 4.20 (38% off, flips verdict from "balanced" to "seller's"); La Pine stored 13.47 vs computed 14.90; Terrebonne stored 10.52 vs computed 13.96. The delta is not a fixed offset — it depends on what non-SFR records the city's stored aggregate happened to include — so you cannot correct for it after the fact. Recompute, every time.
- Only Story 16 directly publishes a multi-band MoS breakdown; every other story that mentions market condition must cite an MoS computed from Template 11, not from `market_pulse_live`.

**Universal filter cheat-sheet (apply on every closed-sales query — see `query-rules.md` UF1/UF2):**
- `AND "ClosePrice" >= 10000` — keeps land transfers and $0.09 artifacts out of residential aggregates.
- `AND sale_to_final_list_ratio BETWEEN 0.5 AND 1.5` — clamps 99.9× outliers from list-side artifact prices. Apply in WHERE, not as a `FILTER (WHERE …)` on the percentile.
- For list-side queries (`Active`, `Expired`, `Withdrawn`): use `"ListPrice" >= 10000` (or `"OriginalListPrice"` where the story computes a ratio against original).

**Story 24 (Agent Market Share) is INTERNAL USE ONLY.** Do not publish this segment to any public channel. Use for internal strategy sessions only.
