---
name: data_viz_video
description: "30-60s vertical market stats video. Every number is a freshly-pulled Supabase query rendered as animated CountUp + charts. Beat-synced audio, ElevenLabs VO."
---

# Data Viz Video — Animated Market Stats from Supabase

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` and `CLAUDE.md` (Data Accuracy section) before running this pipeline. The data accuracy rules in CLAUDE.md outrank every other instruction here. A wrong number in a market video is a compliance risk to Matt's broker license.**

---

## What it is

A 30-60 second vertical video (1080×1920) where every displayed statistic is generated from a fresh Supabase query at render time. There are no hard-coded numbers. The query runs, the result is snapshotted to a timestamped JSON file, and that JSON file is the single source of truth for all CountUp targets, chart values, and stat pills in the Remotion composition. The video format is a weekly or monthly market update: median price, month-over-month change, year-over-year change, DOM, months of supply, sale-to-list ratio, and absorption rate.

**Platforms:** IG Reels (1080×1920), TikTok, YT Shorts. Horizontal cut (1920×1080) for website embed.

**Output length:** 30-45 seconds for weekly pulse format. Up to 60 seconds for full monthly report format.

---

## When to invoke

- Weekly market pulse video (Mon AM after `avatar_market_update/SKILL.md` — distinct format, shorter, more visual)
- Monthly market report social clip (detailed format with trend charts)
- Announcement of a significant market shift (e.g., inventory spike, rate change impact, YoY price crossover)
- As a content-calendar data beat within `social_calendar/SKILL.md` (scheduled slot, not ad hoc)
- Responding to a trending market-timing conversation in `meme_content/SKILL.md` format when verified data supports the narrative

Do NOT invoke for:
- Any stat that cannot be traced to Supabase `market_pulse_live` or MLS direct (no "I know the number is about X")
- Markets outside the defined geography list (Bend metro, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras, Terrebonne, Tumalo — no other geographies)
- Periods where `market_pulse_live` has not been refreshed within the last 7 days (stale data gate — check `last_updated` field before pulling)

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Data pull | Supabase `market_pulse_live` | $0 | `SUPABASE_SERVICE_ROLE_KEY` |
| JSON snapshot | `pull_market_data.py` | $0 | — |
| Math verification | Python script | $0 | — |
| Beat detection | `audio_sync/SKILL.md` | $0 | ffmpeg + librosa |
| Remotion composition | `DataVizComp` | $0 | Node env |
| CountUp components | Remotion `<CountUp>`, `<BarChart>`, `<Trendline>` | $0 | — |
| VO synthesis | ElevenLabs API | ~$0.003/char | `ELEVENLABS_API_KEY` |
| Final encode | ffmpeg x264 CRF 24 | $0 | — |

---

## Metrics defined

These are the only metrics this skill publishes. Do not add new metrics without defining their query and verification formula first.

| Metric | Display name | Unit | Formula |
|--------|-------------|------|---------|
| Median close price | Median Price | $ | `median(close_price)` over filtered rows |
| Median price MoM | Month-Over-Month | % | `(current_month_median - prior_month_median) / prior_month_median * 100` |
| Median price YoY | Year-Over-Year | % | `(current_period_median - prior_year_same_period_median) / prior_year_same_period_median * 100` |
| Days on market | Avg Days on Market | days | `avg(dom)` over closed sales in period |
| Months of supply | Months of Supply | mo | `active_listings / monthly_absorption_rate` |
| Sale-to-list ratio | Sale-to-List | % | `avg(close_price / list_price * 100)` |
| Absorption rate | Absorption Rate | homes/mo | `closed_sales_count / months_in_period` |
| Active inventory | Active Listings | count | `count(*)` where status='Active' on report date |

Market classification:
- Months of supply ≤ 4.0 = **Seller's market**
- Months of supply 4.0-6.0 = **Balanced market**
- Months of supply ≥ 6.0 = **Buyer's market**

The classification in the video must match the actual months-of-supply number. A "seller's market" label next to 4.3 months of supply is a compliance fail.

---

## Step-by-step workflow

### Step 1 — Verify market_pulse_live freshness

Before pulling any data, confirm the table has been refreshed within 7 days:

```sql
-- Run in Supabase SQL editor or via node client
SELECT
  city,
  MAX(last_updated) AS last_refreshed,
  NOW() - MAX(last_updated) AS age
FROM market_pulse_live
GROUP BY city
ORDER BY city;
```

If any city's `last_refreshed` is older than 7 days, do not pull that city's data. Either trigger a refresh or exclude that city from the video. Document the freshness check in the output JSON.

### Step 2 — Pull market data and snapshot to JSON

```bash
python video_production_skills/data_viz_video/pull_market_data.py \
  --city "Bend" \
  --property-type "A" \
  --output out/data_viz/<city>_<yyyy-mm-dd>.json \
  --period-months 3
```

The script executes the following queries (document each in the output JSON):

**Median price (current quarter):**
```sql
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_price,
  COUNT(*) AS row_count,
  MIN(close_date) AS period_start,
  MAX(close_date) AS period_end
FROM listings
WHERE
  property_type = 'A'
  AND city = 'Bend'
  AND status = 'Closed'
  AND close_date >= DATE_TRUNC('quarter', NOW())
  AND close_date < NOW();
```

**Median price (prior quarter, for MoM/YoY calculation):**
```sql
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_price,
  COUNT(*) AS row_count
FROM listings
WHERE
  property_type = 'A'
  AND city = 'Bend'
  AND status = 'Closed'
  AND close_date >= DATE_TRUNC('quarter', NOW()) - INTERVAL '3 months'
  AND close_date < DATE_TRUNC('quarter', NOW());
```

**DOM:**
```sql
SELECT
  ROUND(AVG(dom), 0) AS avg_dom,
  COUNT(*) AS row_count
FROM listings
WHERE
  property_type = 'A'
  AND city = 'Bend'
  AND status = 'Closed'
  AND close_date >= NOW() - INTERVAL '90 days';
```

**Active inventory:**
```sql
SELECT COUNT(*) AS active_count
FROM listings
WHERE
  property_type = 'A'
  AND city = 'Bend'
  AND status = 'Active';
```

**Absorption rate:**
```sql
SELECT
  COUNT(*) AS closed_count,
  3 AS months,
  COUNT(*) / 3.0 AS monthly_absorption
FROM listings
WHERE
  property_type = 'A'
  AND city = 'Bend'
  AND status = 'Closed'
  AND close_date >= NOW() - INTERVAL '90 days';
```

All query results are written verbatim (including `row_count`, `period_start`, `period_end`) into the output JSON under a `query_results` key alongside the derived display values.

### Step 3 — Compute derived metrics and verify

```bash
python video_production_skills/data_viz_video/verify_metrics.py \
  --data-file out/data_viz/<city>_<yyyy-mm-dd>.json
```

The verification script recomputes all derived metrics from raw query results and compares against the `display_values` in the JSON. Any mismatch greater than $1 (price), 0.1% (ratio), or 0.1 (months) causes the script to exit with a non-zero code and print the discrepancy.

It also applies the market classification rule and sets `market_classification` in the JSON. If the narrative script contradicts the classification, the script flags it.

The script prints a complete verification trace per figure:

```
median_price: $487,000 — listings, PropertyType='A', City='Bend', CloseDate 2026-01-01..2026-03-31, percentile_cont(0.5) = 487000 over 94 rows
dom_avg: 38 days — listings, PropertyType='A', City='Bend', CloseDate 2026-01-24..2026-04-24, avg(dom) = 38.0 over 94 rows
months_supply: 2.1 mo — active_count=198 / monthly_absorption=94 = 2.1 → SELLER'S MARKET
sale_to_list: 98.4% — listings same filter, avg(close_price/list_price*100) = 98.4 over 94 rows
```

Save this trace to `out/data_viz/<city>_<yyyy-mm-dd>_verification_trace.txt`. This file must be committed alongside the video file.

### Step 4 — Beat-detect the score

```bash
python video_production_skills/audio_sync/detect_beats.py \
  --input public/audio/scores/<track_name>.mp3 \
  --output out/data_viz/<city>_<yyyy-mm-dd>_beats.json \
  --target-beats 8
```

For the data viz format, 8 beats covers 6 metric reveals + 1 hook + 1 CTA.

### Step 5 — Write the VO script

The VO reads through the data, in Matt's voice. No generic filler. No "an" before numbers. Direct declarative sentences.

Template structure:

```
Beat 1 (hook): "<City> in <Month Year>. Here is what the numbers say."
Beat 2: "Median close price: <$X>. That is <up/down> <Y%> year over year."
Beat 3: "Homes are sitting for <Z days> on average. <Up/down> from <prior period> days."
Beat 4: "We have <N> active listings and a <X.X-month> supply. That is a <market classification>."
Beat 5: "Sale-to-list ratio: <X%>. Sellers are getting <X%> of asking."
Beat 6: "Absorption: <N> homes per month. The market is moving."
Beat 7: (Pattern interrupt — visual chart cut, VO pauses or delivers a single direct observation)
Beat 8 (CTA): "More at ryan-realty.com. I post this every week."
```

No semicolons. No em-dashes. No "leverage", "delve", "in today's market". No "approximately" or "roughly" — use the actual number.

Synthesize VO per the same pattern as `listing_reveal/SKILL.md` Step 5. Chain `previous_text` for prosody continuity.

### Step 6 — Build the Remotion composition

`DataVizComp` lives at `video/data_viz_video/src/DataVizComp.tsx`. It imports the snapshot JSON as its sole data source.

```typescript
// DataVizComp imports the verified JSON — never hard-coded values
import dataSnapshot from '../../../out/data_viz/Bend_2026-04-26.json';
```

Beat structure in `DataVizComp`:

| Beat | Component | Props sourced from |
|------|-----------|--------------------|
| 1 | `<HookCard>` | city, report_date from JSON |
| 2 | `<CountUp>` + `<YoYBadge>` | median_price, yoy_pct from JSON |
| 3 | `<CountUp>` + delta indicator | dom_avg, dom_prior from JSON |
| 4 | `<MonthsSupplyBar>` + classification pill | months_supply, market_classification from JSON |
| 5 | `<PercentBar>` | sale_to_list_pct from JSON |
| 6 | `<BarChart>` trailing 6 months | historical_absorption array from JSON |
| 7 | `<Trendline>` 12-month median | historical_median_prices array from JSON |
| 8 | `<CTACard>` | static copy + URL |

**Citation pill (mandatory on every metric beat):** bottom-right of every stat frame, AzoSans 24px, white on semi-transparent navy pill:

```
Source: ORMLS via Supabase, pulled 2026-04-26
```

The `pulled_at` value must come from the JSON `query_run_at` field — never hard-coded.

### Step 7 — Render

```bash
npx remotion render \
  video/data_viz_video/src/index.ts \
  DataVizComp \
  out/data_viz/<city>_<yyyy-mm-dd>_render.mp4 \
  --props='{"dataFile":"out/data_viz/<city>_<yyyy-mm-dd>.json"}' \
  --concurrency=1
```

### Step 8 — Post-render number verification

After render, grep every frame for the displayed numbers and diff against the JSON:

```bash
python video_production_skills/data_viz_video/verify_rendered_numbers.py \
  --video out/data_viz/<city>_<yyyy-mm-dd>_render.mp4 \
  --data-file out/data_viz/<city>_<yyyy-mm-dd>.json
```

This script extracts frames at 1fps, runs OCR on each frame, finds displayed numbers, and diffs them against the verified JSON values. Any discrepancy is a render bug that must be fixed before the video ships.

### Step 9 — Final encode

```bash
ffmpeg -i out/data_viz/<city>_<yyyy-mm-dd>_render.mp4 \
  -c:v libx264 -crf 24 -preset medium \
  -movflags faststart \
  -c:a aac -b:a 128k \
  out/data_viz/<city>_<yyyy-mm-dd>_final.mp4
```

---

## Anti-slop guardrails

Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before QA. Critical rules:

- **Zero hard-coded numbers.** Every CountUp target, every bar height, every label value comes from the JSON snapshot. If a value is not in the JSON, it does not appear in the video.
- **No rounded marketing numbers.** If the median is $487,250, display $487,250 — not $487K, not "nearly $490K", not "approaching the $500s". The precise number or nothing.
- **No "approximately."** No "roughly." No "about."
- **Every metric has a citation pill.** "Source: ORMLS via Supabase, pulled YYYY-MM-DD" appears bottom-right on every stat beat.
- **No missing units.** "$487,250" not "487,250". "38 days" not "38". "2.1 months" not "2.1".
- **Market classification must match months-of-supply.** Script enforces this. Never override the classification in narrative copy to fit a pre-written story.
- **No stats for geographies not in the pull filter.** If the video says "Bend market" the query must have `city = 'Bend'` — not "Central Oregon" or "Deschutes County" without the corresponding filter.
- **Manifesto rules 1, 2, 3, 4** apply: no hallucinated data, no AI-recalled numbers, no ambiguous source, no recycled data from a prior snapshot.

---

## Brand rules

- **Colors:** Navy `#102742` background on all stat cards and chart containers. Gold `#D4AF37` for positive deltas, trend lines, and highlight bars. White text for all metric values.
- **Fonts:** Amboqia for city name headline and section titles. AzoSans Medium for all metric values, labels, and citation pills.
- **No logo in frame.** No brokerage name in frame. No phone number in frame.
- **Text safe zone:** 900×1400 px centered in 1080×1920.
- **Citation pill position:** bottom-right of each metric beat, 40px from bottom edge, 40px from right edge.

---

## Data verification

CLAUDE.md Data Accuracy rule applies in full. Required verification trace per figure (written to `verification_trace.txt`):

```
<metric_name>: <displayed_value> — <table>, <filter_string>, <aggregation> = <raw_result> over <row_count> rows, pulled <query_run_at>
```

Example:
```
median_price: $487,000 — listings, PropertyType='A', City='Bend', CloseDate 2026-01-01..2026-03-31, percentile_cont(0.5) = 487000 over 94 rows, pulled 2026-04-26T07:00:00Z
months_supply: 2.1 mo — active_count=198 (status='Active', PropertyType='A', City='Bend'), monthly_absorption=94/3=31.3, months_supply=198/31.3=2.1, pulled 2026-04-26T07:00:00Z
market_classification: SELLER'S MARKET — months_supply=2.1, threshold ≤4.0
```

No video ships without a complete trace for all displayed metrics.

---

## Quality gate checklist

**Pre-render:**
- [ ] `market_pulse_live` freshness check passed (all cities in video refreshed within 7 days)
- [ ] All queries executed fresh in this session (not reused from prior output)
- [ ] `verify_metrics.py` passed with zero discrepancies
- [ ] `verification_trace.txt` written with one line per figure
- [ ] Market classification in JSON matches months-of-supply threshold
- [ ] VO script checked for banned words and "approximately"/"roughly"/"about"
- [ ] Citation pills configured with `query_run_at` from JSON (not hard-coded date)
- [ ] No hard-coded numbers in `DataVizComp.tsx` — all values reference JSON import

**Post-render:**
- [ ] `ffprobe` duration: 30-60 seconds
- [ ] `ffmpeg blackdetect` returns zero black sequences
- [ ] `verify_rendered_numbers.py` passed — zero OCR diffs against JSON
- [ ] Every stat beat has visible citation pill
- [ ] All numbers carry units on screen
- [ ] Market classification label matches months-of-supply value
- [ ] No brokerage name, phone, or agent name in frame
- [ ] File size under 100 MB after CRF 24 encode
- [ ] `verification_trace.txt` committed alongside video file
- [ ] **Human review gate for first 30 days** (per ANTI_SLOP_MANIFESTO rule 8)

---

## Output paths

```
out/data_viz/
  <city>_<yyyy-mm-dd>.json                      # Verified data snapshot — single source of truth
  <city>_<yyyy-mm-dd>_verification_trace.txt    # Mandatory compliance trace
  <city>_<yyyy-mm-dd>_beats.json               # Audio beat timestamps
  <city>_<yyyy-mm-dd>_render.mp4               # Remotion output
  <city>_<yyyy-mm-dd>_final.mp4                # CRF 24 deliverable
  <city>_<yyyy-mm-dd>_qa_frames/               # Extracted frames for OCR verification
```

---

## See also

- `CLAUDE.md` — Data Accuracy rules (mandatory read — every number must have a verification trace)
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master video constraints
- `video_production_skills/audio_sync/SKILL.md` — beat detection and audio sync
- `video_production_skills/avatar_market_update/SKILL.md` — related weekly format (avatar delivery vs chart delivery)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — enforced rules
