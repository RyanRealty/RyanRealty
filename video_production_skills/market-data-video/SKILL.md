---
name: market-data-video
description: Generate a monthly city-level SFR market report video (1080x1920, 60-90s, Remotion) for Central Oregon cities. Primary router for prompts like "create a market report for this city." For subdivision-level asks, use this skill's subdivision mode guidance and route to neighborhood-overview when the requested output is a 30s subdivision flyover plus stats.
---

# Market Data Video Skill — Ryan Realty

## Required references — load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)** — visual brand spec. Colors (navy `#102742`, cream `#faf8f4`, sand `#e8e2d4`), three type families (Amboqia Boriango display, Geist sans body/UI, Azo Sans Medium accent), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md)** — 2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions). Synthesized from research on 30+ top real estate creators.

A piece of content that ships without consulting BOTH of these is non-compliant.

---

**Scope:** Generate a monthly, city-level SFR market report video for Central Oregon cities (Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Tumalo, Powell Butte). Portrait 1080x1920 @ 30fps, 60-90 seconds, Remotion 4.0.290. One video per city per month. Fully automated — no manual tools.

**Status:** Verified against Redmond April 2026 (v7, shipped) and Sisters April 2026 (v3, shipped). Data accuracy mandate, closing card lock, and 12-scene architecture confirmed working.

---

## 1. When to Use / When Not to Use

**Use this skill for:**
- "Create a market report for this city" requests
- Monthly city-level SFR market summary (all SFR sales in a city for a calendar month)
- Recurring monthly cadence posts (IG Reels, TikTok, Facebook)
- Authority/expertise content that carries the Ryan Realty brokerage stamp and phone number

**Default window contract (hard rule):**
- If user asks for "monthly market report" and does not provide dates, use the previous full calendar month.
- Example: ask in June -> run May 1 through May 31.
- Do not auto-switch to YTD unless the user explicitly requests a YTD report.

**Render guardrails (hard rule):**
- Market report composition must use monthly SFR-only data (`PropertyType='A'`) and include that filter in verification trace output.
- Do not render duplicate label/value split scenes for the same metric.
- Every market report must include at least two advanced data-viz beats (`gauge`, `histogram`, `price_band`, `line_chart`, `multi_year_bars`, `leaderboard`, or `takeaway`).
- Outro is logo-only (photo + white stacked Ryan Realty logo). No URL, phone, CTA text, or subscribe text in-frame.
- **Photo diversity (Matt directive 2026-05-07):** every scene uses a distinct photo. No photo repeats inside a single render — not adjacent, not anywhere. The composition's `beatImageSrc()` must take an explicit per-scene asset id and never fall through to a modulo cycle.
- **Narrative-only VO (Matt directive 2026-05-07):** the VO carries the story. Charts carry the numbers. Victoria does NOT recite dollar amounts, percentages, or day counts that already appear on screen. Year references ("since 2019") are permitted; literal price recitation ("six hundred ninety-nine thousand") is banned. See §17.
- **Caption sync locked to VO (Matt directive 2026-05-07):** visual beat boundaries track ElevenLabs word timestamps EXACTLY. Never pad visual beats past natural VO duration — that desyncs captions because they render at word timing, not visual timing. If the VO is too short to fill the viral window, lengthen the script (add narrative clauses) — never stretch the visuals. See §18.
- **Multi-color line chart for price beat (Matt directive 2026-05-07):** the median-sale-price beat uses the `line_chart` layout with one color per historical year. Each segment leading INTO a point uses that point's color. Standard ramp: 2019 azure (`#5BA8D4`) → mid-window teal (`#7BC5A8`) → prior-year soft gold (`#C8A864`) → current-year brand gold (`#D4AF37`). Each point shows its `$value` directly above the dot. No bar-chart substitute — Matt explicitly preferred the connected-line treatment. See §19.

**Do NOT use this skill for:**
- Individual listing videos → use `listing-tour-video`
- "Create a market report for this subdivision" requests when the desired output is a 30s neighborhood/subdivision flyover with stat overlay → use `neighborhood-overview`
- Hot-community rankings → use `development-showcase` (Bend Hottest Communities pattern)
- Viral/trend content with no branding in frame → use `lifestyle-community`
- Anything under 30 closed SFR sales in the date window — sample is too thin; cut or combine months

---

## 2. Data Accuracy Mandate (Read This Before Anything Else)

**This is a compliance item.** Matt is a licensed principal broker. Every number in this video traces to a live Supabase query run in this session. The verification trace (Section 7) is not optional — it is required before render.

Rules that cannot be bypassed:

1. `PropertyType = 'A'` on every query, every time. SFR only. Multi-family, land, and manufactured homes are never blended in.
2. `ClosePrice` in `listings` is populated for 2026 closes only. Pre-2026 YoY comparisons require `listing_history` (see Section 5b). Never hard-code a prior-year median from memory.
3. Active/pending inventory counts do NOT filter by year. Only closed-sale queries get a CloseDate window.
4. Market classification (Seller / Balanced / Buyer) must match the actual months-of-supply number against the published thresholds. Wrong classification = fail, full stop.
5. If any stat cannot be verified with a source trace, it is cut from the video. No estimation. No rounding. No "approximately."
6. The narrative must be consistent with the numbers. A "Seller's Market" verdict next to 4.3 months of supply is a compliance failure.

---

## 3. Preconditions

Before running this skill, confirm all of the following:

| # | Precondition | How to Check |
|---|---|---|
| 1 | Supabase MCP live | `mcp__5adfee1a-*__execute_sql` with `SELECT 1` on project `dwvlophlbvvygjfxcrhm` |
| 2 | Font files present | `/Users/matthewryan/Documents/Claude/Projects/BRAND MANAGER/fonts/` — `AmboqiaBoriango.ttf` (FONT_SERIF) + `AzoSans-Medium.ttf` (FONT_BODY) |
| 3 | Logo PNG present | Asset library subject=`brand` — white Ryan Realty wordmark PNG, transparent bg, ~680px wide version |
| 4 | City has enough data | Run `SELECT COUNT(*) FROM listings WHERE "City"='{city}' AND "PropertyType"='A' AND "StandardStatus"='Closed' AND "CloseDate" BETWEEN '{month_start}' AND '{month_end}'` — must return ≥30 |
| 5 | Remotion installed | `/tmp/remotion-{city}-{month}/` — install takes ~8s if missing: `npx create-video@latest --blank` |
| 6 | City photo set ready | Asset library: `python3 asset_index.py for {city} --type photo` — need ≥10 approved photos |
| 7 | Resend key | `RESEND_API_KEY` in `/Users/matthewryan/RyanRealty/.env.local` |

---

## 4. Inputs

```typescript
interface MarketVideoConfig {
  city: string;                        // e.g. "Redmond", "Bend", "Sisters"
  state: string;                       // always "OR"
  reportMonth: string;                 // ISO date of first day of report month, e.g. "2026-04-01"
  reportMonthEnd: string;              // ISO date of last day of report month, e.g. "2026-04-30"
  ytdStart: string;                    // e.g. "2026-01-01" — for YTD queries
  priorYearStart: string;              // e.g. "2025-01-01" — for YoY
  priorYearEnd: string;                // e.g. "2025-12-31" — for YoY
  propertyType: string;                // default 'A' — SFR only, never change without explicit instruction
  priceSegments?: [number, number][];  // optional override: e.g. [[0,400000],[400000,600000],...]
  featuredNeighborhoods?: string[];    // optional: override top-N auto-detect
  agentPhotoOverride?: string;         // rare: swap Matt's headshot for a specific asset library ID
}
```

**Defaults when optional fields are omitted:**
- `priceSegments`: 5 buckets derived from the actual min/max of YTD closed sales, equal-width
- `featuredNeighborhoods`: auto-computed from Section 5h query, top 5 by volume, min 5 sales
- `agentPhotoOverride`: not used

---

## 5. Data Pull — Complete SQL Set

Run all eight queries before rendering. Print the raw result (row count, date window, applied filter) for every query. These results become the verification trace in Section 7.

**Connection:** Supabase project `dwvlophlbvvygjfxcrhm`, table `listings`. All column names are case-sensitive and must be double-quoted.

### 5a. Median Close Price — Current Period

```sql
-- Q1: Median ClosePrice for the report month (or YTD window)
-- Filter: City, PropertyType='A', StandardStatus='Closed', CloseDate in window
-- Returns: 1 row. Record row count (N) and median value.
SELECT
  COUNT(*)                                                         AS closed_sales,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric,
    0
  )                                                                AS median_close_price,
  MIN("ClosePrice")                                                AS min_close,
  MAX("ClosePrice")                                                AS max_close
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" BETWEEN '{ytdStart}' AND '{reportMonthEnd}';
```

### 5b. YoY Median — Prior Year via listing_history

`listings.ClosePrice` is NULL for pre-2026 closes. Use `listing_history` for prior-year medians.

```sql
-- Q2: Prior-year median ClosePrice from listing_history
-- listing_history records FieldChange events; filter to ClosePrice field changes
-- Take the most recent ClosePrice change per listing (the actual close value)
-- Then join to listings to confirm City + PropertyType scope

WITH prior_closes AS (
  SELECT
    lh."ListingKey",
    lh."NewValue"::numeric AS close_price,
    ROW_NUMBER() OVER (PARTITION BY lh."ListingKey"
                       ORDER BY lh."ChangedAt" DESC)   AS rn
  FROM listing_history lh
  WHERE lh."FieldName"   = 'ClosePrice'
    AND lh."ChangedAt"   BETWEEN '{priorYearStart}' AND '{priorYearEnd}'
    AND lh."NewValue"    ~ '^\d+(\.\d+)?$'   -- guard against non-numeric noise
),
scoped AS (
  SELECT pc.close_price
  FROM prior_closes pc
  JOIN listings l ON l."ListingKey" = pc."ListingKey"
  WHERE pc.rn              = 1
    AND l."City"           = '{city}'
    AND l."PropertyType"   = 'A'
    AND l."StandardStatus" = 'Closed'
)
SELECT
  COUNT(*)                                                              AS prior_closed_sales,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price)::numeric,
    0
  )                                                                     AS prior_median_close
FROM scoped;
```

**After running Q2:** compute `yoy_pct = (current_median - prior_median) / prior_median * 100`. If `prior_closed_sales < 20`, flag the YoY as statistically thin — either widen the prior window to full calendar year or cut the YoY stat rather than ship a noisy ratio. Never display a YoY derived from fewer than 20 transactions.

### 5c. Inventory Snapshot

```sql
-- Q3: Current active + pending counts (no year filter on active/pending)
SELECT
  SUM(CASE WHEN "StandardStatus" = 'Active'  THEN 1 ELSE 0 END) AS active_count,
  SUM(CASE WHEN "StandardStatus" = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
  SUM(CASE WHEN "StandardStatus" IN ('Active','Pending') THEN 1 ELSE 0 END) AS total_supply
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A';
```

### 5d. Months of Supply

Months of supply = active listings / (total closed sales in trailing 6 months / 6).

```sql
-- Q4a: Trailing 6-month closed sales count
SELECT COUNT(*) AS trailing_6mo_closed
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" BETWEEN (CURRENT_DATE - INTERVAL '6 months')::date
                       AND  CURRENT_DATE;
```

Compute in Python after getting Q3 + Q4a results:

```python
trailing_6mo = q4a["trailing_6mo_closed"]
monthly_absorption = trailing_6mo / 6.0
active_count = q3["active_count"]

if monthly_absorption == 0:
    months_supply = None  # cannot compute — cut stat
else:
    months_supply = round(active_count / monthly_absorption, 1)
```

### 5e. Median Days on Market

```sql
-- Q5: Median DOM for YTD closed sales
SELECT
  COUNT(*)                                                        AS closed_n,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")::numeric,
    0
  )                                                               AS median_dom,
  ROUND(AVG("DaysOnMarket")::numeric, 0)                         AS avg_dom
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" BETWEEN '{ytdStart}' AND '{reportMonthEnd}'
  AND "DaysOnMarket" IS NOT NULL;
```

### 5f. Median Sale-to-List Ratio

```sql
-- Q6: Median sale-to-list ratio for YTD closed sales
-- Use ListPrice (final) not OriginalListPrice (ask) to measure pricing accuracy
SELECT
  COUNT(*)                                                               AS ratio_n,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY 100.0 * "ClosePrice" / NULLIF("ListPrice", 0)
    )::numeric,
    2
  )                                                                      AS median_sale_to_list_pct
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" BETWEEN '{ytdStart}' AND '{reportMonthEnd}'
  AND "ClosePrice"  > 0
  AND "ListPrice"   > 0;
```

### 5g. Price Segment Histogram

```sql
-- Q7: Count of closed sales per price bucket (5 buckets)
-- Bucket breakpoints are determined by the Python layer AFTER Q1 runs
-- Pass computed bucket edges as literals. Example for Redmond:
SELECT
  SUM(CASE WHEN "ClosePrice" <  350000                          THEN 1 ELSE 0 END) AS seg_under_350k,
  SUM(CASE WHEN "ClosePrice" >= 350000 AND "ClosePrice" < 500000 THEN 1 ELSE 0 END) AS seg_350_500k,
  SUM(CASE WHEN "ClosePrice" >= 500000 AND "ClosePrice" < 650000 THEN 1 ELSE 0 END) AS seg_500_650k,
  SUM(CASE WHEN "ClosePrice" >= 650000 AND "ClosePrice" < 800000 THEN 1 ELSE 0 END) AS seg_650_800k,
  SUM(CASE WHEN "ClosePrice" >= 800000                          THEN 1 ELSE 0 END) AS seg_over_800k
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" BETWEEN '{ytdStart}' AND '{reportMonthEnd}';
```

**Python layer:** compute equal-width buckets from Q1 `min_close` and `max_close` before writing Q7. Never hard-code Redmond or Sisters breakpoints into a Bend run.

### 5h. Top Neighborhoods by Volume

```sql
-- Q8: Top 5 neighborhoods/subdivisions by YTD closed sales volume + median price
-- Min 5 sales to appear (per data accuracy mandate — sub-5 samples are not shippable)
SELECT
  "SubdivisionName"                                                     AS neighborhood,
  COUNT(*)                                                              AS closed_sales,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")::numeric,
    0
  )                                                                     AS median_price,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket")::numeric,
    1
  )                                                                     AS median_dom
FROM listings
WHERE "City"         = '{city}'
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" BETWEEN '{ytdStart}' AND '{reportMonthEnd}'
  AND "SubdivisionName" IS NOT NULL
  AND "SubdivisionName" <> ''
GROUP BY "SubdivisionName"
HAVING COUNT(*) >= 5
ORDER BY closed_sales DESC
LIMIT 5;
```

If fewer than 3 neighborhoods qualify with ≥5 sales, lower the threshold to ≥3 and note it in the verification trace. If still under 3, skip the neighborhoods scene and replace it with an extended price-range scene.

---

## 6. Scene-by-Scene Breakdown

Total runtime: ~81 seconds. 30fps. 1080x1920. Safe zones: top 180px and bottom 320px are reserved for IG UI overlays — no text or critical graphics inside those margins.

| # | Scene | Frame Window | Duration | Visual | Data Source | Text Template |
|---|-------|-------------|----------|--------|-------------|---------------|
| S1 | Hook | 0 – 150f | 5.0s | City hero photo, light overlay | Q1 closed_sales + median, Q3 active_count | `{CITY} REAL ESTATE / {MONTH} {YEAR}` + `{N} homes sold · {active} active · SFR only` pill |
| S2 | Market Classification | 150 – 345f | 6.5s | Same or second city photo | Q4 months_supply → classification | Large pill: `SELLER'S MARKET` / `BALANCED MARKET` / `BUYER'S MARKET` + `{X.X} months of supply` sub-label |
| S3 | Median Sale Price | 345 – 555f | 7.0s | Photo swap | Q1 median_close_price | `MEDIAN SALE PRICE` label + CountUp to `${median}` + `{city} · {YTD window}` sub |
| S4 | YoY Price Trend | 555 – 780f | 7.5s | Photo swap | Q1 current + Q2 prior | Current year `${median}` vs prior year `${prior_median}` + YoY badge `+X.X%` or `-X.X%` |
| S5 | Active Inventory | 780 – 975f | 6.5s | Photo swap | Q3 active_count + pending_count | `{N} ACTIVE LISTINGS` large number + `+ {pending} pending` chip |
| S6 | Months of Supply | 975 – 1170f | 6.5s | Photo swap | Q4 months_supply | `{X.X}` large number + `months of supply` + classification bar (green/neutral/blue fill) |
| S7 | Days on Market | 1170 – 1395f | 7.5s | Photo swap | Q5 median_dom | `{N} DAYS` CountUp + `median days on market · {N} homes` sub + context line |
| S8 | Sale-to-List Ratio | 1395 – 1605f | 7.0s | Photo swap | Q6 median_sale_to_list_pct | `{X.XX}%` large number + `sale-to-list ratio` label + one-line narrative |
| S9 | Price Segments | 1605 – 1800f | 6.5s | Photo swap | Q7 5-bucket counts | Horizontal bar chart, 5 labeled buckets, widths proportional to count |
| S10 | Top Neighborhoods | 1800 – 2010f | 7.0s | Photo swap | Q8 top-5 | Stacked rows: neighborhood name · sales count · median price · DOM |
| S11 | CTA | 2010 – 2235f | 7.5s | City scenic photo | static | `DM "{CITY}"` large text + `for the full report` sub + `Central Oregon Market Intelligence` badge |
| S12 | Closing Card | 2235 – 2415f | 6.0s | Solid navy `#102742` | static | White Ryan Realty logo (fade in f6→f30) + `541.213.6706` (fade in f30→f54) |

**Photo rotation:** each scene uses a different photo from the approved city set. Scenes S1 and S2 may share photo 1 if the set has fewer than 11 approved images. Never reuse the same photo in adjacent scenes.

**S12 is locked.** See Section 11.

---

## 7. Verification Trace (Mandatory Pre-Render Step)

Before calling the Remotion render command, produce one trace line per figure that will appear on screen. Format exactly:

```
"{figure description}" — Supabase listings, PropertyType='A', City='{city}',
  {date_filter}, {function}({column}) = {value} over {N} rows
```

Example trace for a Redmond April 2026 run:

```
"$412,500 median close price (YTD)" — Supabase listings, PropertyType='A',
  City='Redmond', CloseDate 2026-01-01..2026-04-30,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") = 412500 over 84 rows

"$387,000 prior-year median (YoY)" — Supabase listing_history join listings,
  PropertyType='A', City='Redmond', ChangedAt 2025-01-01..2025-12-31,
  FieldName='ClosePrice', percentile_cont(0.5) = 387000 over 246 rows

"47 active listings" — Supabase listings, PropertyType='A', City='Redmond',
  StandardStatus='Active', no date filter, COUNT(*) = 47

"3.2 months of supply" — active_count=47 / (trailing_6mo_closed=88 / 6) = 3.2,
  classification: SELLER'S MARKET (≤4)

"38 median DOM" — Supabase listings, PropertyType='A', City='Redmond',
  CloseDate 2026-01-01..2026-04-30,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY "DaysOnMarket") = 38 over 84 rows

"98.6% sale-to-list" — Supabase listings, PropertyType='A', City='Redmond',
  CloseDate 2026-01-01..2026-04-30,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY 100*ClosePrice/ListPrice) = 98.6 over 84 rows
```

Every figure on screen must have a trace line. No trace line, no render. Matt or any reviewer can audit by matching numbers on screen to trace lines one-for-one.

---

## 8. Market Classification Logic

Compute classification in Python immediately after Q4:

```python
def classify_market(months_supply: float) -> dict:
    """
    Returns classification dict with label, pill_color, and Remotion CSS token.
    Thresholds are industry-standard; do not adjust without Matt's approval.
    """
    if months_supply is None:
        raise ValueError("months_supply is None — cannot classify. Cut stat, do not estimate.")

    if months_supply <= 4.0:
        return {
            "label": "SELLER'S MARKET",
            "sub":   f"{months_supply} months of supply",
            "pill_color": "#c9a84c",         # gold — brand accent
            "css_token":  "bg-accent text-accent-foreground",
        }
    elif months_supply <= 6.0:
        return {
            "label": "BALANCED MARKET",
            "sub":   f"{months_supply} months of supply",
            "pill_color": "#64748b",         # neutral slate
            "css_token":  "bg-secondary text-secondary-foreground",
        }
    else:
        return {
            "label": "BUYER'S MARKET",
            "sub":   f"{months_supply} months of supply",
            "pill_color": "#3b82f6",         # blue
            "css_token":  "bg-primary text-primary-foreground",
        }
```

**Hard rule:** the pill label and pill color in the rendered video must match what `classify_market()` returns. A "SELLER'S MARKET" gold pill next to 4.3 months-of-supply is a data accuracy failure and a compliance risk. If you are unsure whether to round (e.g., 4.03), use the raw unrounded value for classification, then display one decimal place on screen.

---

## 9. Photo Assignment

**Check the asset library before sourcing any new photo.**

```bash
cd /Users/matthewryan/Documents/Claude/Projects/ASSET_LIBRARY/.cli
python3 asset_index.py for {city_lowercase} --type photo
# Returns: asset_id, filename, approval state, tags, path
```

**Approval gate:** only assets with `approval = 'approved'` go into production renders. `intake` assets require Matt's sign-off first.

**Per-city approved pools (as of 2026-04-19):**
- Redmond: 76 approved Unsplash photos (v4 sourcing run)
- Sisters: photos including rodeo, horses in snow, ski carving, North Sister, Three Sisters, Broken Top
- Bend: pull from asset library subjects `bend`, `cascades`, `smith_rock`
- La Pine / Sunriver / Prineville: source from library first; if count < 10, use Shutterstock API (see `reference_shutterstock_api.md`) and ingest before using

**Banned photo subjects (never appear in any market report):**
- Distressed, boarded-up, or visually neglected properties
- Road construction, visible utility trenching, dirt lots
- Snow-covered front yards when report period is spring/summer
- Dated "FOR SALE" or other brokerage signage (any brokerage)
- Interior shots (this is a market report, not a listing tour)

**Record asset usage after render:**

```bash
python3 asset_index.py used {asset_id} \
  --project {city_lower}_market_{YYYYMM} \
  --scene S{N} \
  --output /path/to/output.mp4 \
  --note "Hero photo scene {N}"
```

---

## 10. Remotion Composition Scaffold

Install target: `/tmp/remotion-{city}-{YYYYMM}/`. Node v22+. Remotion 4.0.290.

```bash
cd /tmp && npx create-video@latest remotion-{city}-{YYYYMM} -- --blank
cd remotion-{city}-{YYYYMM} && npm install
```

Font loading via CSS @font-face in `src/Root.tsx` (required — do not use Google Fonts CDN, the render environment has no internet):

```tsx
// src/Root.tsx — inject fonts before any composition
import { useEffect } from 'react';
import { continueRender, delayRender } from 'remotion';

const handle = delayRender();

const loadFonts = async () => {
  const serif = new FontFace(
    'AmboqiaBoriango',
    `url('/fonts/AmboqiaBoriango.ttf') format('truetype')`
  );
  const body = new FontFace(
    'AzoSans',
    `url('/fonts/AzoSans-Medium.ttf') format('truetype')`
  );
  await Promise.all([serif.load(), body.load()]);
  document.fonts.add(serif);
  document.fonts.add(body);
  continueRender(handle);
};

loadFonts();
```

Copy font files into `public/fonts/` before render.

**Main composition (`src/compositions/{City}MarketReport.tsx`):**

```tsx
import { Composition } from 'remotion';
import { CityMarketReport } from '../compositions/CityMarketReport';

// Total frames: 2415 (81s @ 30fps)
export const RemotionRoot: React.FC = () => (
  <Composition
    id="{City}MarketReport"
    component={CityMarketReport}
    durationInFrames={2415}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ stats: VERIFIED_STATS, photos: PHOTO_PATHS, config: CITY_CONFIG }}
  />
);
```

**12-scene sequence scaffold:**

```tsx
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const FONT_SERIF = 'AmboqiaBoriango, serif';
const FONT_BODY  = 'AzoSans, sans-serif';
const NAVY       = '#102742';
const GOLD       = '#c9a84c';
const WHITE      = '#ffffff';

// Safe zone constants (1920px tall frame)
const SAFE_TOP    = 180;   // IG UI top bar
const SAFE_BOTTOM = 320;   // IG bottom UI + nav

export const CityMarketReport: React.FC<{ stats: VerifiedStats; photos: string[]; config: CityConfig }> = ({
  stats, photos, config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const countUp = (target: number, startFrame: number, durationFrames: number) => {
    const progress = Math.min(1, Math.max(0, (frame - startFrame) / durationFrames));
    const eased = spring({ frame: frame - startFrame, fps, config: { damping: 12, mass: 0.5 } });
    return Math.round(Math.min(eased, 1) * target);
  };

  const fadeIn = (startFrame: number, durationFrames = 24) =>
    interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: NAVY }}>

      {/* S1 — Hook */}
      <Sequence from={0} durationInFrames={150}>
        <HookScene photo={photos[0]} city={config.city} month={config.reportMonthLabel}
          closedSales={stats.closedSales} activeCount={stats.activeCount}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S2 — Market Classification */}
      <Sequence from={150} durationInFrames={195}>
        <ClassificationScene photo={photos[1]} classification={stats.classification}
          monthsSupply={stats.monthsSupply} safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S3 — Median Sale Price */}
      <Sequence from={345} durationInFrames={210}>
        <MedianPriceScene photo={photos[2]} medianPrice={stats.medianClosePrice}
          ytdLabel={config.ytdLabel} countUp={countUp} fadeIn={fadeIn}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S4 — YoY Price Trend */}
      <Sequence from={555} durationInFrames={225}>
        <YoYScene photo={photos[3]} currentMedian={stats.medianClosePrice}
          priorMedian={stats.priorMedianClosePrice} yoyPct={stats.yoyPct}
          currentYear={config.currentYear} priorYear={config.priorYear}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S5 — Active Inventory */}
      <Sequence from={780} durationInFrames={195}>
        <InventoryScene photo={photos[4]} activeCount={stats.activeCount}
          pendingCount={stats.pendingCount} countUp={countUp}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S6 — Months of Supply */}
      <Sequence from={975} durationInFrames={195}>
        <MonthsSupplyScene photo={photos[5]} monthsSupply={stats.monthsSupply}
          classification={stats.classification} fadeIn={fadeIn}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S7 — Days on Market */}
      <Sequence from={1170} durationInFrames={225}>
        <DomScene photo={photos[6]} medianDom={stats.medianDom} closedN={stats.closedSales}
          countUp={countUp} safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S8 — Sale-to-List Ratio */}
      <Sequence from={1395} durationInFrames={210}>
        <SaleToListScene photo={photos[7]} saleToListPct={stats.saleToListPct}
          closedN={stats.closedSales} safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S9 — Price Segments */}
      <Sequence from={1605} durationInFrames={195}>
        <PriceSegmentsScene photo={photos[8]} segments={stats.priceSegments}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S10 — Top Neighborhoods */}
      <Sequence from={1800} durationInFrames={210}>
        <NeighborhoodsScene photo={photos[9]} neighborhoods={stats.topNeighborhoods}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S11 — CTA */}
      <Sequence from={2010} durationInFrames={225}>
        <CtaScene photo={photos[10]} city={config.city}
          safeTop={SAFE_TOP} safeBottom={SAFE_BOTTOM} />
      </Sequence>

      {/* S12 — Closing Card (LOCKED — never modify) */}
      <Sequence from={2235} durationInFrames={180}>
        <ClosingCard logoPath="/images/rr-logo-white.png"
          phone="541.213.6706" fadeIn={fadeIn} />
      </Sequence>

    </AbsoluteFill>
  );
};
```

**Typography rules (both scene-level and component-level):**
- Hero stat numbers: `FONT_SERIF`, 86-100px, white, `text-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 0 32px rgba(0,0,0,0.4)` — never use `text-shadow` on containers, only on `<span>` text elements
- Labels and sub-labels: `FONT_BODY`, 28-36px, white or `rgba(255,255,255,0.85)`
- Pill text: `FONT_BODY`, 22-26px, weight 600
- Do not exceed 100px for any hero number — it clips on device edges

---

## 11. Closing Card (Locked — Never Modify)

S12 is identical across every city, every month. Copied verbatim here from `feedback_market_report_closing_standard.md`:

```tsx
// ClosingCard.tsx — LOCKED 2026-04-20. Do not restyle. Copy verbatim per city.
export const ClosingCard: React.FC<{ logoPath: string; phone: string; fadeIn: FadeInFn }> = ({
  logoPath, phone, fadeIn,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: '#102742' }}>  {/* flat navy, no gradient, no glow */}
      {/* Logo: fade in frames 6 → 30 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -60%)',
        opacity: fadeIn(6, 24),
      }}>
        <img src={logoPath} alt="Ryan Realty" style={{ width: 680, display: 'block' }} />
      </div>

      {/* Phone: fade in frames 30 → 54 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, 20px)',
        opacity: fadeIn(30, 24),
        fontFamily: 'AzoSans, sans-serif',
        fontSize: 44,
        letterSpacing: '2px',
        color: '#ffffff',
        textAlign: 'center',
      }}>
        541.213.6706
      </div>
      {/* Nothing else. No URL. No tagline. No DM copy. No gold rule. No shimmer. */}
    </AbsoluteFill>
  );
};
```

**The only permitted change:** if the brokerage phone number changes firm-wide, update the single `phone` prop at the callsite. Do not add any additional elements to `ClosingCard.tsx` without Matt's explicit instruction.

---

## 12. Render, Compress, and Deliver

**Step 1 — Render with Remotion:**

```bash
cd /tmp/remotion-{city}-{YYYYMM}
npx remotion render src/index.ts {City}MarketReport \
  out/{city}_market_report_{YYYYMM}_raw.mp4 \
  --codec h264 \
  --pixel-format yuv420p \
  --jpeg-quality 90
```

**Step 2 — Compress to ≤4MB with ffmpeg:**

```bash
ffmpeg -i out/{city}_market_report_{YYYYMM}_raw.mp4 \
  -c:v libx264 \
  -preset slow \
  -crf 26 \
  -vf "scale=1080:1920" \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  out/{city}_market_report_{YYYYMM}.mp4

# Verify file size
ls -lh out/{city}_market_report_{YYYYMM}.mp4
# Must be ≤ 4MB. If larger, raise CRF to 28 and re-run.
```

**Step 3 — Email to Matt via Resend:**

```python
import requests, os, base64, json

RESEND_KEY = open('/Users/matthewryan/RyanRealty/.env.local').read()
# parse RESEND_API_KEY from the .env.local lines

with open(f'out/{city}_market_report_{YYYYMM}.mp4', 'rb') as f:
    video_b64 = base64.b64encode(f.read()).decode()

# Build verification trace string (all trace lines from Section 7 joined)
trace_text = "\n".join(verification_trace_lines)

payload = {
    "from":    "Ryan Realty Agent <agent@ryan-realty.com>",
    "to":      ["matt@ryan-realty.com"],
    "subject": f"{city} Market Report {MONTH} {YEAR} — Ready for Review",
    "text":    f"Video attached. Verification trace below.\n\n{trace_text}",
    "attachments": [
        {"filename": f"{city}_market_report_{YYYYMM}.mp4", "content": video_b64}
    ],
}

r = requests.post(
    "https://api.resend.com/emails",
    headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
    json=payload,
)
assert r.status_code == 200, f"Resend failed: {r.text}"
print(f"Sent. ID: {r.json()['id']}")
```

---

## 13. QA Pass (Mandatory Before Publish)

Run this QA checklist after the Remotion render completes and before sending to Matt:

1. **Render scene-boundary stills:** extract one frame per scene transition (frames 0, 150, 345, 555, 780, 975, 1170, 1395, 1605, 1800, 2010, 2235) using ffmpeg:
   ```bash
   for f in 0 150 345 555 780 975 1170 1395 1605 1800 2010 2235; do
     ffmpeg -i out/{city}_market_report_{YYYYMM}_raw.mp4 \
       -vf "select=eq(n\,${f})" -vframes 1 \
       qa/frame_${f}.jpg -y 2>/dev/null
   done
   ```

2. **Number audit:** for each still, find every visible figure (price, count, percentage, number) and match it to the corresponding verification trace line. One mismatch = re-render.

3. **Classification audit:** confirm S2 pill label and color match `classify_market(months_supply)` output.

4. **YoY sanity check:** if current median is up, the badge must show green/positive. If down, red/negative. Verify direction is correct.

5. **Closing card check:** S12 must show: navy background, white logo, `541.213.6706`, nothing else. If any other element is visible — gradient, glow, tagline, URL, hashtag — the closing card template was modified and must be restored from this document.

6. **Brand voice grep:** search the composition file for `—`, ` - `, `dream home`, `perfect`, `amazing`, `stunning`, `your`. Any hit is a brand voice violation. Fix before ship.

7. **Safe-zone check:** confirm no text or stat lives inside the top 180px or bottom 320px of any scene.

8. **File size check:** `ls -lh` confirms ≤4MB on the compressed file.

---

## 14. Gotchas

| # | Gotcha | Wrong | Right |
|---|--------|-------|-------|
| 1 | `PropertyType` filter missing from YoY query | `FROM listing_history lh JOIN listings l ON l."ListingKey"=lh."ListingKey" WHERE lh."FieldName"='ClosePrice'` — no property type filter | Add `AND l."PropertyType" = 'A'` to the join-scoped WHERE clause on every query, including listing_history joins |
| 2 | Active/pending counts filtered by year | `WHERE "StandardStatus"='Active' AND EXTRACT(YEAR FROM "OnMarketDate")=2026` | No year filter on active/pending. A listing from October 2025 still on market today is live inventory |
| 3 | CloseDate window off-by-one double-counting | `BETWEEN '2026-01-01' AND '2026-04-31'` (April has 30 days) | Always use actual last day of the month. Use Python `calendar.monthrange` to compute the correct end date, never hard-code |
| 4 | listing_history join key typo | `JOIN listings l ON l."id" = lh."ListingId"` | Key is `"ListingKey"` on both sides: `ON l."ListingKey" = lh."ListingKey"` |
| 5 | YoY with thin prior-year sample | Display YoY when prior bucket has 8 rows | Suppress YoY and cut the stat when prior year N < 20. Noisy ratios are worse than no ratio |
| 6 | Months-of-supply denominator = single month | `active / closed_this_month` | Use 6-month trailing average: `active / (trailing_6mo_closed / 6.0)`. Single-month absorption is volatile |
| 7 | Mean instead of median for price | Use `AVG("ClosePrice")` for the headline | Use `percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice")` — median resists outlier distortion in thin markets |
| 8 | UTC vs Pacific boundary | `CloseDate BETWEEN '2026-04-01' AND '2026-04-30'` may include April 30 closes logged at UTC midnight = May 1 Pacific | Cast to Pacific: `WHERE ("CloseDate" AT TIME ZONE 'UTC' AT TIME ZONE 'US/Pacific')::date BETWEEN ...` — or verify with Matt's MLS sync timezone |
| 9 | Text inside IG safe zone | Hero stat rendered at y=80px (inside top 180px IG UI zone) | `paddingTop: SAFE_TOP` on every scene container. SAFE_TOP = 180, SAFE_BOTTOM = 320 |
| 10 | Font not loaded before render | `fontFamily: 'AmboqiaBoriango'` renders in system fallback | Use `delayRender` + `continueRender` pattern. Copy TTF files to `public/fonts/`. See Section 10 font-loading scaffold |
| 11 | Wrong market classification | 3.2 months-of-supply labeled "BALANCED MARKET" | ≤4 = Seller's Market. 4.01-6.0 = Balanced. >6.0 = Buyer's Market. Use the raw unrounded value for the threshold check; display one decimal place |
| 12 | Closing card modified | Added gradient or glow to S12 to "polish" it | S12 is locked. Flat navy only. Restore from Section 11 verbatim if any element has been added |
| 13 | Brand voice — em dashes | Used `—` between two clauses in scene copy | No em dashes anywhere. No hyphens in prose. Use periods. |
| 14 | Render blocked — missing verification trace | Proceed to render when most trace lines are done | Zero exceptions. Every figure on screen needs a trace line before render runs. If a stat cannot be traced, cut it from the composition |

---

## 15. Invoke When / Don't Invoke When

**Invoke when:**
- It is within the first week of a new month and the prior month's data has populated in Supabase (verify with a quick count query before starting)
- Matt requests a market report for any Central Oregon city
- The monthly automated pipeline triggers (if wired to a scheduled task)
- A prior month's report needs to be re-run with corrected data

**Don't invoke when:**
- The request is for a specific listing (use `listing-tour-video`)
- The request is for a single neighborhood or subdivision deep dive (use `neighborhood-overview`)
- The data window has fewer than 30 closed SFR sales — the video will look authoritative but the stats will be unreliable; tell Matt and wait for more data to accumulate
- Matt has not yet approved the photo set for a city that hasn't had a prior market report — get photo approval first
- Any verification trace line cannot be resolved — cut the stat or hold the video

---

## 17. Narrative-Only VO (Locked 2026-05-07)

**Rule:** Victoria does NOT recite numbers that appear on screen. The VO is analyst commentary. The chart, gauge, bar, and value tags carry the data; the VO carries the story.

**Banned in spoken text** (caption layer is fine, on-screen text is fine — VO ONLY):
- Dollar amounts: "six hundred ninety-nine thousand", "five hundred K", "$1.2 million" → BANNED
- Percentages: "thirteen point four percent", "98.5%" → BANNED
- Day counts: "46 days", "ten days faster" → BANNED
- Listing counts: "1,149 active listings", "415 pending" → BANNED

**Permitted in spoken text:**
- Year references that anchor a long-arc story: "since 2019", "for april 2026"
- Qualitative directionals: "cooled this year", "kept climbing", "held flat", "moving faster"
- Market verdicts: "balanced", "tight", "buyers have the cards"
- CTA: "Full report at ryan-realty.com"

**Per-beat narrative templates (Bend April 2026 baseline — adapt the verb tense and verdict per city/period):**

| Beat | Narrative sentence (no numbers spoken) |
|------|---------------------------------------|
| Intro | `{City}, single family market for {month} {year}. The pendulum is balanced. Neither side has the edge right now.` |
| Price | `Prices cooled this year. Zoom out, though, and the long arc since {baselineYear} is still pointing up. Buyers who waited are paying more, not less, in the long run.` |
| MoS | `Supply is healthy at this level. Buyers have options. Sellers can still command their price.` |
| DOM | `Listings are moving faster than they were a year ago. The pace has clearly picked up.` |
| STL | `Negotiation room is limited. Sellers are still getting close to asking, and buyers have to come in tight.` |
| Active | `The pipeline is healthy and demand is steady. Buyers are out there, and contracts are flowing.` |
| Outro | `Full report at ryan-realty.com. Subscribe for monthly updates.` |

**Verdict-conditional copy lives in `scripts/build-cities.mjs::planForCity()`.** Branch on `klass` (sellers / balanced / buyers) for intro + MoS, on `yoyDir` (up / down / flat) for price, on `domDelta` (negative / zero / positive) for DOM, on `slPct` thresholds for STL, on `pendingToActive` thresholds for active. The skill does not hard-code one wording — it specifies a TEMPLATE per condition and lets the data drive the verb tense.

**Why this rule exists:** Matt watched a 38s render where Victoria said "Median sale price was six hundred ninety-nine thousand, down 13 point 4 percent" while the chart simultaneously showed `$699K` and `−13.4%`. His feedback: "horrible" — listening to a narrator recite numbers you can already read is the textbook definition of robotic explainer-video sludge. Locking this rule means future market reports never regress to data-recitation.

---

## 18. Caption Sync Locked to VO (Locked 2026-05-07)

**Rule:** Visual beat durations equal natural VO sentence durations. Never pad visual beats past the audio.

**The bug we are guarding against:** the previous iteration padded visual beats from a 26s VO to a 38s target so chart animations had breathing room. But ElevenLabs word timestamps are derived from the audio file — the alignment doesn't know about visual padding. So at visual t=20s the caption was already showing the STL sentence (because the VO had reached STL words at audio t=14-17s in real time), but the visual was still on the DOM beat.

**Implementation in `scripts/synth-vo.mjs`:**
1. Synth ONE continuous VO call (`/v1/text-to-speech/.../with-timestamps`).
2. Get word-level timestamps from the alignment.
3. For each beat sentence in `script.beatSentences`, find the timestamp of its first word.
4. Beat duration = next beat's start time − this beat's start time. Last beat runs to end of audio + small tail pad.
5. **NO post-hoc padding to a target.** If total < 30s, the script is too short — go back to `build-cities.mjs` and lengthen the narrative sentences. Don't stretch visuals.

**Sanity check pre-render:**
```
console.log(`Beat durations: ${beatDurations.map(d => d.toFixed(1)).join(', ')} → ${total.toFixed(1)}s`)
if (total > 62) WARNING — exceeds 62s viral ceiling
if (total < 30) WARNING — under 30s viral floor (lengthen script, do not pad)
```

**Caption renderer expectation:** `KineticCaptions.tsx` reads word timestamps from `props.captionWords` (populated by synth-vo). Each word's `startSec/endSec` is in audio time. Captions show whichever sentence's words are currently being spoken. With visual beat boundaries derived from the same word stream, captions and visuals stay locked.

**Anti-pattern (do not do):**
```js
// WRONG — adds visual time without adding audio time → desync
const TARGET_SEC = 38.0
const slack = TARGET_SEC - currentTotal
beatDurations[idx] += slack / expandableCount
```

**Correct pattern:**
```js
// RIGHT — visual beat = natural VO sentence duration
beatDurations.push(words[nextSentenceFirstWord].startSec - words[thisSentenceFirstWord].startSec)
```

---

## 19. Multi-Color Line Chart for Price Beat (Locked 2026-05-07)

**Rule:** The median-sale-price beat uses the `line_chart` layout with per-point colors and per-point value tags. Not bars. Not single-color line. Not a CountUp on a static number.

**Why:** Matt explicitly preferred the connected-line treatment over a bar chart for the multi-year view, with the proviso that "if we could have a different year and color for each line, that would be great." The line tells the story (here's the trajectory); the colors anchor the eye to which segment is which year transition; the value tags above each dot let the viewer read all four data points at once without VO having to recite them.

**Color ramp (cool → warm, baseline → current):**
- 2019 baseline: `#5BA8D4` (azure — the long-ago reference)
- mid-window (e.g. 2024): `#7BC5A8` (teal — heading toward gold)
- prior year (e.g. 2025): `#C8A864` (soft gold — almost current)
- current year (e.g. 2026): `#D4AF37` (brand gold — highlighted with white outline + glow + "CURRENT" sub-pill)

**Implementation contract** (`StatBeat.tsx::renderLineChart()`):
- `props.series: ChartPoint[]` where `ChartPoint = { month: string; value: number; color?: string; yearLabel?: string }`
- The segment LEADING INTO point i renders in `points[i].color`
- Each point's dot, year label below the axis, and value tag above the dot all use the same color
- Sequential reveal: segment i starts drawing at frame `6 + i*6` (~ 200ms stagger per year)
- Last point (current year): dot is larger with pulse animation, white inner dot, drop-shadow glow, "CURRENT" 18px sub-label

**Build-cities mapping:**
```js
const series = baseline ? [
  { month: baseline.period_label, value: baseline.median_sale_price, color: '#5BA8D4', yearLabel: baseline.period_start.slice(0, 4) },
  { month: yr2.period_label,      value: yr2.median_sale_price,      color: '#7BC5A8', yearLabel: yr2.period_start.slice(0, 4) },
  { month: yr1.period_label,      value: yr1.median_sale_price,      color: '#C8A864', yearLabel: yr1.period_start.slice(0, 4) },
  { month: cur.period_label,      value: cur.median_sale_price,      color: '#D4AF37', yearLabel: cur.period_start.slice(0, 4) },
] : null
```

If baseline data is missing, fall back to `hero` layout with the current value only — never ship a 1-point or 2-point line chart.

---

## 20. Photo Diversity (Locked 2026-05-07)

**Rule:** Each scene uses a unique photo. No photo appears twice in a render — not adjacent, not in mirror positions (e.g. intro + outro), not at all.

**Why:** Matt watched a render where 3 of 5 stat beats were Tumalo Falls (3 different angles, but visually the same waterfall). His feedback: "I want to not have the same photos all the time." A market report video that recycles photography reads as low-effort regardless of how good the data viz is.

**Implementation contract:**

1. **Asset pool size:** the city must have at least N+1 approved photos available, where N is the number of scenes (currently 9 with S9 + S10 wired in). Default 10+ approved photos per city. Run `python3 asset_index.py for {city} --type photo --filter approved` first.

2. **Per-scene explicit assignment:** in `MarketReport.tsx::beatImageSrc()`, accept an explicit asset id from props (`stat.image_idx`). The composition's `beats[]` array MUST specify a unique `image_idx` for every beat. Modulo cycling is banned — it produces deterministic dupes when bookends share images.

3. **Diversity audit pre-render:** in `build-cities.mjs`, after assembling the stats array, assert no two beats share the same `image_idx`. Fail loud if they do — do not ship.

4. **Landmark variety target (per render):** every render aims to include at least 4 distinct landmark types. For Bend that means a mix of: Mt. Bachelor / Three Sisters / South Sister, Smith Rock, Tumalo Falls, Old Mill / downtown, Drake Park / Mirror Pond, Cascade Lakes, Pilot Butte. Never ship a render where 3+ scenes are the same waterfall, the same butte, or the same mountain.

5. **Source priority** — **canonical source is `video_production_skills/media-sourcing/SKILL.md`**. The full decision tree, source registry, cost ledger, and per-format matrix live there. Summary (use the skill for the full version):
   - **First:** Asset Library CLI — approved Bend-specific photos
   - **Second:** Unsplash with landmark-specific queries (Pilot Butte, Mt. Bachelor, etc.)
   - **Third:** Shutterstock licensed search (paid per asset)
   - For ambient audio + AI motion + drone shots + AI illustrations + ANY other media decision, route through `media-sourcing/SKILL.md` first.

6. **Bend-specific landmark queries** (`fetch-unsplash.mjs::CITY_CONFIGS.bend.queries`):
   ```
   pilot butte bend oregon, mount bachelor oregon, old mill district bend oregon,
   drake park bend oregon, deschutes river bend oregon downtown, smith rock oregon,
   tumalo falls oregon, downtown bend oregon, three sisters oregon, bend oregon neighborhood
   ```

7. **Wrong-location penalty** (in `scorePhoto()`): explicit -50 score for any of: `north bend, coos bay, oregon coast, cannon beach, astoria, portland, salem, eugene, medford, ashland, klamath, columbia gorge, mt hood, mount hood, crater lake`. The +8 landmark bonus must always be smaller than the wrong-location penalty so an ambiguous match always loses.

8. **Per-scene de-dup in fetch:** `collectPhotos()` should pull min `2 * sceneCount` candidates and require `seen.add(photo.id)` before keeping. The score function picks the top N unique results. If fewer than N unique candidates with positive scores exist, the rate limit is exhausted — do not silently reuse photos; halt and surface the gap to Matt.

---

## 21. Shutterstock Integration (Roadmap — Open for Matt's Go/No-Go)

**Status (2026-05-07):** Credentials live (`SHUTTERSTOCK_API_KEY` + `SHUTTERSTOCK_API_SECRET` in `.env.local`); admin search route at `/api/admin/stock/shutterstock/search` works; **no production deliverable has ever embedded a licensed Shutterstock asset.** The market-report pipeline is Unsplash-only by default.

**Cost model to discuss:** Shutterstock charges per licensed asset. 7 photos × 6 cities monthly = ~42 licenses/month. Plan tiers vary; flexible plans run ~$10/asset, subscription tiers as low as $1.50/asset at high volume.

**Recommendation:** keep Unsplash as default for free formats (market reports, neighborhood overviews, news clips). Wire Shutterstock as primary source for paid formats where iconic imagery directly justifies the per-asset fee (luxury listing reveals, branded campaign work). Build `scripts/fetch-shutterstock.mjs` mirroring `fetch-unsplash.mjs`, with a `--source=shutterstock` flag on the build pipeline.

**Open until Matt approves the cost model.**

---

## 22. Unique-Data Backlog (Variation Pool — Pick 2-3 per Monthly Report)

**Primary source: `market_stats_cache` table.** The cache pre-computes 40+ columns per geo × period including jsonb breakdowns (`price_band_counts`, `bedroom_breakdown`, `dom_distribution`, `price_tier_breakdown`, `property_type_breakdown`). Audited 2026-05-07: cache is accurate; the prior claim that it had a "10-15% off" bug was wrong — the apparent discrepancy was the cache blending all property types in the headline `sold_count` while our direct queries filtered `PropertyType='A'`. To get SFR-only headline numbers from the cache, read `property_type_breakdown->>'A'` (it counts 192 SFR for Bend April 2026, matching the direct query exactly).

**Full data dictionary — every Supabase table the agent can read for market reports** (verified 2026-05-07):

### `market_stats_cache` (40 cols) — pre-computed period stats per geo
```
identity:     id, geo_type, geo_slug, geo_label, period_type, period_start, period_end,
              computed_at, created_at, updated_at
basic:        sold_count, median_sale_price, avg_sale_price, total_volume,
              median_dom, median_ppsf, median_price_per_sqft_closed,
              avg_sale_to_list_ratio, end_of_period_inventory
percentiles:  speed_p25, speed_p50, speed_p75 (DOM percentiles)
yoy:          yoy_sold_delta_pct, yoy_median_price_delta_pct, yoy_dom_change,
              yoy_inventory_change_pct, yoy_ppsf_change_pct
mom:          mom_median_price_change_pct, mom_inventory_change_pct
verdict:      market_health_score (0-100), market_health_label (Cool/Warm/Hot)
buyer:        cash_purchase_pct, median_concessions_amount, affordability_monthly_piti,
              avg_listing_quality_score, median_tax_rate
jsonb:        price_band_counts (5 buckets), bedroom_breakdown (per BedroomsTotal),
              property_type_breakdown (per PropertyType — A/B/C/D/F),
              dom_distribution (6 bins: <7, 8-14, 15-30, 31-60, 61-90, 90+),
              price_tier_breakdown (6 tiers)
```

### `market_pulse_live` (29 cols) — live cross-property-type inventory snapshot per geo
```
identity:     id, geo_type, geo_slug, geo_label, property_type, updated_at
inventory:    active_count, pending_count, new_count_7d, new_count_30d,
              end_of_period_inventory (via cache), median_active_dom
listings:     median_list_price, avg_list_price, new_construction_share
absorption:   months_of_supply, absorption_rate_pct, pending_to_active_ratio,
              sell_through_rate_90d, expired_rate_90d, net_inventory_change_30d,
              sold_count_30d, sold_count_90d, median_close_price_90d
pricing:      median_sale_to_list, pct_sold_over_asking, pct_sold_under_asking,
              pct_sold_at_asking, median_days_to_pending, avg_price_drops_active,
              price_reduction_share
verdict:      market_health_score, market_health_label
```

### `listings` (~140 cols) — direct row-level MLS data
The `listings` table carries the most detailed data. Use direct queries when the cache doesn't pre-compute the stat (top neighborhoods, highest sale spotlight, etc.).

```
identity:     ListNumber, ListingKey, mls_source, property_cluster_id,
              ModificationTimestamp, status_change_timestamp
location:     City, State, PostalCode, county, StreetNumber, StreetName,
              cross_street, Latitude, Longitude, parcel_number,
              SubdivisionName, boundary_city, boundary_neighborhood, boundary_subdivision
financial:    ListPrice, OriginalListPrice, ClosePrice,
              price_per_sqft, close_price_per_sqft, price_per_acre,
              price_per_bedroom, price_per_room,
              sale_to_list_ratio, sale_to_final_list_ratio,
              total_price_change_pct, total_price_change_amt,
              hoa_monthly, hoa_annual_cost, hoa_pct_of_price,
              tax_annual_amount, tax_assessed_value, tax_year, tax_rate,
              estimated_monthly_piti, association_fee, association_fee_frequency,
              concessions_amount, buyer_financing
status/dates: StandardStatus, ListDate, OnMarketDate, listing_contract_date,
              CloseDate, pending_timestamp, purchase_contract_date, off_market_date,
              original_entry_timestamp, original_on_market_timestamp,
              back_on_market_timestamp, back_on_market_count,
              status_change_count, was_relisted,
              days_to_pending, days_pending_to_close,
              DaysOnMarket, CumulativeDaysOnMarket, dom_percentile, price_percentile,
              days_since_last_price_change, last_price_change_date,
              last_price_change_amount, last_price_change_pct,
              price_drop_count, price_increase_count, total_price_changes,
              largest_price_drop_pct
property:     PropertyType, property_sub_type, property_attached_yn,
              new_construction_yn, year_built, property_age,
              levels, stories_total, rooms_total, architectural_style,
              foundation_details, construction_materials, roof, basement_yn,
              BedroomsTotal, BathroomsTotal, baths_full, baths_half,
              bed_bath_ratio, TotalLivingAreaSqFt, building_area_total,
              above_grade_finished_area, below_grade_finished_area,
              above_grade_pct, sqft_efficiency,
              lot_size_acres, lot_size_sqft, lot_features,
              pool_yn, spa_yn, fireplace_yn, fireplaces_total,
              fencing, waterfront_yn, horse_yn, view_description,
              direction_faces, garage_yn, garage_spaces,
              carport_yn, carport_spaces, parking_total,
              heating_yn, cooling_yn, sewer, water,
              irrigation_water_rights_yn
schools:      elementary_school, middle_school, high_school, school_district
amenities:    amenities (jsonb), home_warranty_yn, senior_community_yn,
              has_virtual_tour, virtual_tour_url
agents:       ListAgentName, ListOfficeName, list_agent_email, list_agent_mls_id,
              buyer_agent_name, buyer_agent_mls_id, buyer_office_name
content:      public_remarks, photos_count, PhotoURL, details (jsonb),
              OpenHouses (jsonb), listing_quality_score, walk_score
engagement:   view_count, save_count, inquiry_count, share_count, like_count,
              email_share_count
flags:        history_finalized, history_verified_full, media_finalized, is_finalized
```

### `listing_history` (8 cols) — per-listing event log
```
identity:     id, listing_key, created_at
event:        event_date, event, description, price, price_change, raw (jsonb)
```
Used for pre-2026 YoY comparisons (see §5b) and price-reduction frequency (§22).

### `boundaries` (9 cols) — geo polygon registry
```
id, geo_type, geo_slug, geo_label, parent_id, polygon, source, source_url, imported_at
```
Used for neighborhood / subdivision / city scope resolution (`boundaries.geo_type='neighborhood'`).

### `neighborhood_subdivisions` (4 cols) — neighborhood ↔ subdivision rollup
```
neighborhood_slug, neighborhood_label, parent_city_slug, subdivision_label
```
Used by the populator function to resolve which subdivisions belong to which neighborhood.

### `app_config` (4 cols) — runtime constants
```
key, value (jsonb), description, updated_at
```
The cache populator reads `mortgage_rate`, `insurance_rate_pct`, `default_tax_rate_pct` from here for the affordability_monthly_piti calculation.

---

**Cache reference (legacy — high-impact bold for unique beats):**

To keep monthly reports feeling fresh instead of identical-template-with-different-numbers, rotate which advanced beats appear. The pipeline always renders the 5 core stat beats (price line chart, MoS gauge, DOM, STL, active inventory). Beyond those, pick 2-3 of the following based on what the data is doing this month:

| Beat | Layout | Data source | When to feature |
|------|--------|-------------|-----------------|
| **Price segment histogram** (S9 in the locked spec) | `histogram` | `market_stats_cache.price_band_counts` (under_300k / 300k_500k / 500k_750k / 750k_1m / over_1m) — pre-bucketed | Every month — shows where the action is. Always include unless the sample is too thin. |
| **Top neighborhoods leaderboard** (S10 in the locked spec) | `leaderboard` | direct query: top 5 `SubdivisionName` by closed volume + median price + DOM (cache does not pre-compute this) | Every month — name-checks subdivisions buyers and sellers care about. |
| **Cash purchase % gauge** | `gauge` (0-50%, color zones) | `market_stats_cache.cash_purchase_pct` — pre-computed | Every month — buyers and sellers both want to know what % of competition is non-financed. Frames as a gauge with a needle and color zones (low/medium/high cash share). |
| **Seller concessions trend** | `compare` (current $ vs trailing 3-month avg) | `market_stats_cache.median_concessions_amount` | When concessions are climbing (signals seller pressure) or falling (signals tightening market). Powerful buyer-side stat. |
| **Market health score** | `gauge` (0-100) | `market_stats_cache.market_health_score` + `market_health_label` | Every month — Spark's pre-computed composite index with Cool/Warm/Hot label. Single-number summary headline. |
| **Affordability monthly PITI** | `hero` w/ context | `market_stats_cache.affordability_monthly_piti` | When affordability is shifting fast (rate moves, price moves). Frames the median home as a monthly mortgage payment. |
| **MoM trend chips** | `takeaway` (custom 2-up panel) | `mom_median_price_change_pct` + `mom_inventory_change_pct` | When the month-over-month story is strong. Two pills showing price MoM and inventory MoM with directional arrows. |
| **DOM distribution histogram** | `histogram` (6-bin: <7 / 8-14 / 15-30 / 31-60 / 61-90 / 90+) | `market_stats_cache.dom_distribution` — pre-binned | Months where the DOM headline tells only half the story (e.g. when a few outliers drag the median). |
| **Bedroom mix histogram** | `histogram` (4-bin: 2br / 3br / 4br / 5+br) | `market_stats_cache.bedroom_breakdown` — pre-binned | When config mix is the real story (e.g. 4br dominance signals family-buyer market). |
| **Highest sale of the month** | `takeaway` (custom) | direct query: `SELECT * FROM listings WHERE CloseDate IN window AND PropertyType='A' ORDER BY ClosePrice DESC LIMIT 1` | When the top sale is newsworthy (luxury record, notable address, distinctive architecture). Address can be obfuscated to subdivision/neighborhood level only. |
| **$/sqft trend (multi-year)** | `line_chart` | history query for `median_ppsf` across 4 windows in cache | When PPSF tells a different story than the headline median (e.g. median price flat but PPSF climbing → smaller homes). |
| **Total volume moved** | `hero` w/ animated counter | `market_stats_cache.total_volume` | First/last month of a quarter or year-end report. "$183M moved through Bend in April" reads as headline newsworthiness. |
| **Price reduction frequency** | `gauge` (re-skin) | listing_history query: % of active listings with price drop in last 30d (NOT in cache — direct query needed) | When buyers should know how much pressure sellers are under. |
| **Listing-to-pending velocity** | `gauge` (0-100% scale) | direct query: pending count / (active + pending) | Every other month — shows what % of supply is in escrow. |

**Selection rule:** at minimum 2 of these MUST appear in every monthly market report (per the §1 render guardrail "at least two advanced data-viz beats"). At most 4 advanced beats per video — beyond that the runtime exceeds 75s and retention drops.

**Don't repeat the same advanced beat two months in a row** unless the data trend is itself the story (e.g. tracking a developing trend in monthly DOM histograms).

**Cache-first vs direct-query priority:** the cache covers most beats. Beat sourcing decision tree:

1. **Always query the cache first** for any stat that exists there (cash %, concessions, market health score, MoM/YoY changes, DOM distribution, price band counts, bedroom breakdown, affordability PITI, total volume).
2. **Direct query only when the cache doesn't carry the stat** — top neighborhoods (no `subdivision_breakdown` jsonb), highest sale spotlight (need full row not aggregate), price reduction frequency (needs `listing_history`).
3. **Reading SFR-only from the cache:** the cache headline `sold_count` is all-property-type-blended. For SFR-only views, read the `property_type_breakdown->>'A'` field from the same row — it carries the SFR count exactly. The cache row's `median_sale_price` is also blended; for SFR-only median, fall back to a direct query filtered by `PropertyType='A'`. (TODO for Spark/Supabase: add `median_sale_price_sfr` to the cache so this fallback isn't needed.)

**Implementation pattern:** `pull-extras.mjs` should be renamed to `pull-cache.mjs` and rewritten to read directly from `market_stats_cache` for the geo × period, then enrich with direct queries only for the things the cache doesn't carry (top neighborhoods, highest sale). This eliminates ~80% of the duplicated logic that was rebuilding price segments from scratch when `price_band_counts` was already there.

---

## 23. See Also

- `listing-tour-video` — per-property walkthrough video, pulls listing photos from `listing_photos` table, no market stats
- `development-showcase` — new-construction development spotlight (Bend Hottest Communities pattern), composite heat scoring, satellite boundary overlays
- `neighborhood-overview` — single subdivision deep dive with rich stat stack, boundary polygon, satellite zoom scenes
- `lifestyle-community` — viral/trend content with no branding in frame, science/nature/abstract visuals only, zero house imagery
- `reference_market_report_template.md` — original scene architecture notes, CSS patterns from HTML prototype era, lessons learned
- `feedback_market_report_closing_standard.md` — closing card lock, rationale, scope
- `reference_closeprice_data_gap.md` — why `listing_history` is required for pre-2026 YoY
- `feedback_bend_market_snapshot_scope.md` — PropertyType='A' mandate, no blending
- `reference_asset_library.md` — photo CLI, approval workflow, per-city pools
- `reference_remotion.md` — Remotion install, render command, animation patterns
- `reference_supabase_access.md` — project ref, column name casing, table inventory
