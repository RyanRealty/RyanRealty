---
name: trend_trigger
description: Monday 5am PT cron scans TikTok, IG, YouTube, Reddit, and Google Trends for real-estate-adjacent content trends; filters for Bend/Central OR relevance; outputs 10 structured candidates for social_calendar to pick from.
---

# Trend Trigger

## What it is

The `trend_trigger` runs every Monday at 5am PT. It queries trend data from TikTok Creator
Center, Instagram trending audio/formats, YouTube Shorts trends, Reddit r/RealEstate top posts,
and Google Trends for real-estate queries. It filters candidates for Bend/Central Oregon market
relevance and alignment with current `market_pulse_live` data. The output is a structured JSON
array of 10 trend candidates written to `trend_candidates`. The `social_calendar` skill reads
this table on Monday morning when building the weekly content calendar and selects 1-2 candidates
for `meme_content` production. No trend goes into production without passing the manifesto
guardrails and fair housing review.

## Trigger

```
GET /api/cron/trend-trigger
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: 0 13 * * 1   (Mon 5am PT = Mon 1pm UTC, PDT-safe)
```

## Inputs

Five scan sources run in parallel:

| Source | API / Method | Data pulled |
|---|---|---|
| TikTok Creator Center | `GET https://open.tiktokapis.com/v2/research/video/query/` | Top hashtags + sounds in Real Estate category, past 7 days |
| Instagram | Meta Graph API trending audio endpoint (unofficial, poll via `GET /v22.0/ig_hashtag_search?q=realestate`) | Top hashtag volumes, engagement spikes |
| YouTube Shorts | YouTube Data API `GET /youtube/v3/videos?chart=mostPopular&regionCode=US&videoCategoryId=37` | Top real-estate category short videos |
| Reddit | Reddit JSON API `GET https://www.reddit.com/r/RealEstate/top.json?t=week&limit=25` | Top posts from r/RealEstate + r/FirstTimeHomeBuyer |
| Google Trends | `GET https://trends.googleapis.com/trends/api/dailytrends?geo=US-OR` | Oregon real-estate query spikes |

Additional geo-specific pull:
```
GET https://www.reddit.com/r/Bend/top.json?t=week&limit=10
GET https://www.reddit.com/r/Oregon/top.json?t=week&limit=10
```

## Outputs

| Artifact | Destination |
|---|---|
| Trend candidates | `trend_candidates` table (10 rows) |
| Scan run record | `automation_runs` row |
| Calendar input | `social_calendar` reads `trend_candidates` on Mondays |

## Pipeline

### Step 1 — Write automation_runs row

```sql
INSERT INTO automation_runs
  (trigger_type, idempotency_key, payload, status, created_at)
VALUES
  ('trend_scan', md5('trend_scan::' || date_trunc('week', now())::text),
   '{}', 'running', now())
RETURNING id;
```

Idempotency: one scan per week-of. Re-running within the same week returns existing results
unless `force=true` is passed.

### Step 2 — Parallel scan of all sources

```typescript
const [tiktokTrends, igTrends, ytTrends, redditTrends, googleTrends] = await Promise.allSettled([
  scanTikTok(),
  scanInstagram(),
  scanYouTube(),
  scanReddit(),
  scanGoogleTrends(),
]);
```

**TikTok Research API:**
```typescript
async function scanTikTok(): Promise<RawTrend[]> {
  // TikTok Research API requires approved access (separate from Content Posting API)
  // Endpoint: POST https://open.tiktokapis.com/v2/research/video/query/
  const response = await fetch('https://open.tiktokapis.com/v2/research/video/query/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TIKTOK_RESEARCH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        and: [
          { operation: 'IN', field_name: 'hashtag_name',
            field_values: ['realestate', 'realtor', 'homeforsale', 'housingmarket',
                           'firsttimehomebuyer', 'bend oregon', 'centralOregon'] },
        ],
      },
      start_date: formatDate(sevenDaysAgo),
      end_date: formatDate(today),
      max_count: 50,
      fields: 'id,video_description,hashtag_names,share_count,comment_count,like_count,view_count',
    }),
  });
  return parseTikTokResults(await response.json());
}
```

**YouTube Data API:**
```typescript
async function scanYouTube(): Promise<RawTrend[]> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/videos' +
    '?chart=mostPopular&regionCode=US&videoCategoryId=37' +
    '&maxResults=20&part=snippet,statistics',
    { headers: { Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}` } }
  );
  return parseYouTubeResults(await response.json());
}
```

**Reddit (no auth required for public top posts):**
```typescript
async function scanReddit(): Promise<RawTrend[]> {
  const subreddits = ['RealEstate', 'FirstTimeHomeBuyer', 'Bend', 'Oregon'];
  const results = await Promise.all(subreddits.map(sub =>
    fetch(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=25`, {
      headers: { 'User-Agent': 'RyanRealty-TrendBot/1.0' },
    }).then(r => r.json())
  ));
  return parseRedditResults(results.flat());
}
```

**Google Trends (pytrends-equivalent via public endpoint):**
```typescript
async function scanGoogleTrends(): Promise<RawTrend[]> {
  // Google Trends daily trends API (unofficial but stable)
  const response = await fetch(
    'https://trends.googleapis.com/trends/api/dailytrends' +
    '?hl=en-US&tz=420&geo=US-OR&ns=15',
    { headers: { 'User-Agent': 'RyanRealty-TrendBot/1.0' } }
  );
  // Response is ")]}'\n" prefixed JSON — strip prefix
  const text = await response.text();
  const json = JSON.parse(text.slice(text.indexOf('{')));
  return parseGoogleTrendsResults(json);
}
```

### Step 3 — Normalize and score all candidates

Each raw trend is normalized to a `TrendCandidate` struct:
```typescript
interface TrendCandidate {
  source: 'tiktok' | 'instagram' | 'youtube' | 'reddit' | 'google_trends';
  title: string;           // one-line description of the trend
  trend_type: 'hashtag' | 'format' | 'topic' | 'sound' | 'query';
  raw_signal_score: number;  // platform-native engagement signal, normalized 0-1
  geo_relevance: number;     // 0-1, computed in Step 4
  market_alignment: number;  // 0-1, computed in Step 4
  re_angle: string | null;   // the real-estate angle, if one exists
  fair_housing_safe: boolean; // Step 5 check
  combined_score: number;    // Step 4 output
}
```

### Step 4 — Relevance filtering

**Geo relevance score** (0-1):
```typescript
const BEND_SIGNALS = ['bend', 'central oregon', 'deschutes', 'sisters', 'sunriver',
                      'redmond', 'oregon real estate', 'bend oregon', 'pnw'];
const REAL_ESTATE_SIGNALS = ['real estate', 'home', 'house', 'listing', 'mortgage',
                              'first time buyer', 'housing market', 'interest rate',
                              'home price', 'home buyer', 'seller', 'inventory'];

function geoRelevance(trend: RawTrend): number {
  const text = (trend.title + ' ' + trend.description).toLowerCase();
  const bendMatches = BEND_SIGNALS.filter(s => text.includes(s)).length;
  const reMatches = REAL_ESTATE_SIGNALS.filter(s => text.includes(s)).length;
  // Bend-specific = 1.0, general RE = 0.6, no match = 0.2 (still usable with angle)
  if (bendMatches > 0) return 1.0;
  if (reMatches > 0) return 0.6;
  return 0.2;
}
```

**Market alignment check:**
Pull current `market_pulse_live` summary for Bend:
```sql
SELECT months_of_supply, median_close_price, active_count,
       price_reduction_share, median_days_to_pending
FROM market_pulse_live
WHERE geo_slug = 'bend' ORDER BY computed_at DESC LIMIT 1;
```

Penalize any trend whose narrative contradicts the current data:
- If trend = "prices are crashing" AND Bend median_close_price is up YoY: `market_alignment = 0`.
- If trend aligns with current market story: `market_alignment = 1.0`.
- Neutral trends (format-based, sound-based): `market_alignment = 0.8`.

**Combined score:**
```typescript
const combined = (raw_signal_score * 0.4) + (geo_relevance * 0.35) + (market_alignment * 0.25);
```

### Step 5 — Fair housing and legal review

```typescript
const FAIR_HOUSING_RED_FLAGS = [
  /school district/i,         // steering signal
  /family.*neighborhood/i,    // familial status
  /safe neighborhood/i,       // coded steering
  /good school/i,             // school district steering
  /crime/i,                   // coded race/national origin
  /walkable.*white/i,         // explicit
  /best.*people/i,            // coded
];

const BANNED_TREND_TOPICS = [
  // Trends that can't be given a fair, accurate RE angle
  'celebrity home drama',
  'viral house drama',
  'landlord vs tenant',       // could create legal risk for brokerage
];

function fairHousingSafe(trend: TrendCandidate): boolean {
  const text = trend.title + ' ' + (trend.re_angle || '');
  return !FAIR_HOUSING_RED_FLAGS.some(r => r.test(text)) &&
         !BANNED_TREND_TOPICS.some(t => text.toLowerCase().includes(t));
}
```

Any trend with `fair_housing_safe = false` is dropped. Not logged to candidates. No exceptions.

**Manifesto check (anti-slop):**
Drop any trend where a real estate angle cannot be constructed without:
- Contradicting data we just published (ANTI_SLOP_MANIFESTO rule 3).
- Using banned vocabulary.
- Making a market claim not supported by `market_pulse_live`.

### Step 6 — Select top 10 and write to trend_candidates

Sort by `combined_score DESC`, take top 10:
```sql
INSERT INTO trend_candidates
  (run_id, source, title, trend_type, re_angle, raw_signal_score,
   geo_relevance, market_alignment, combined_score, fair_housing_safe,
   week_of, created_at)
VALUES
  ($run_id, $source, $title, $trend_type, $re_angle,
   $raw_signal_score, $geo_relevance, $market_alignment, $combined_score,
   true,
   date_trunc('week', now()), now())
ON CONFLICT (run_id, title) DO UPDATE SET combined_score = EXCLUDED.combined_score;
```

### Step 7 — Notify social_calendar

The `social_calendar` skill reads `trend_candidates` on Monday mornings when building the week.
No explicit call needed — `social_calendar` is triggered separately.

Optionally: write a flag row to `automation_runs` so social_calendar knows fresh candidates
are available:
```sql
UPDATE automation_runs SET status = 'complete',
  output_summary = json_build_object(
    'candidates_written', 10,
    'top_trend', $top_trend_title,
    'week_of', date_trunc('week', now())
  )::jsonb,
  completed_at = now()
WHERE id = $run_id;
```

## Database schema

```sql
CREATE TABLE IF NOT EXISTS trend_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid REFERENCES automation_runs(id),
  source            text NOT NULL,
    -- 'tiktok' | 'instagram' | 'youtube' | 'reddit' | 'google_trends'
  title             text NOT NULL,
  trend_type        text NOT NULL,
    -- 'hashtag' | 'format' | 'topic' | 'sound' | 'query'
  re_angle          text,           -- the real estate angle proposed
  raw_signal_score  numeric(6,4) NOT NULL DEFAULT 0,
  geo_relevance     numeric(6,4) NOT NULL DEFAULT 0,
  market_alignment  numeric(6,4) NOT NULL DEFAULT 0,
  combined_score    numeric(6,4) NOT NULL DEFAULT 0,
  fair_housing_safe boolean NOT NULL DEFAULT true,
  week_of           date NOT NULL,
  selected          boolean NOT NULL DEFAULT false,
    -- true when social_calendar picks this for production
  meme_job_id       uuid REFERENCES content_jobs(id),
    -- set when meme_content job is created from this candidate
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trend_candidates_run_title_idx
  ON trend_candidates (run_id, title);
CREATE INDEX IF NOT EXISTS trend_candidates_week_score_idx
  ON trend_candidates (week_of, combined_score DESC)
  WHERE fair_housing_safe = true;
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 3 — No contradictions.** Any trend whose narrative contradicts current `market_pulse_live`
  data gets `market_alignment = 0` and will not make the top 10.
- **Rule 6 — Real estate angle required.** Every candidate must have a plausible `re_angle`
  that gives Matt something genuine to say about Bend real estate. No trend without an angle.
- **Rule 8 — Fair housing.** `fair_housing_safe = false` candidates are dropped before they
  reach the candidates table. The social_calendar skill can assume all rows are fair-housing safe.
- **No fabricated trend claims.** Source + `raw_signal_score` are stored with every candidate.
  Matt can audit where a trend came from.
- **No auto-production.** `social_calendar` picks 1-2 candidates. Content is not auto-produced
  from this skill — it surfaces candidates only.

## Error handling + observability

- **Single source failure:** if TikTok Research API is down, continue with remaining 4 sources.
  Log which source failed to `automation_runs.output_summary`.
- **Fewer than 10 candidates after filtering:** write all passing candidates (even if < 10).
  The social_calendar skill handles an empty or thin candidate list gracefully.
- **Zero candidates (all filtered):** write a single `trend_candidates` row with
  `title = 'no_trends_this_week'` as a sentinel. Log to Matt.
- **Fair housing false positive (over-filtering):** Matt can manually add candidates via
  `/admin/trend-candidates` with a manual `re_angle` and fair-housing override note.

Structured log:
```json
{ "skill": "trend_trigger", "week_of": "2026-04-27", "sources_scanned": 5,
  "raw_candidates": 87, "after_geo_filter": 32, "after_manifesto_filter": 14,
  "fair_housing_dropped": 3, "candidates_written": 10, "ms": 4820 }
```

## Configuration

```typescript
export const TREND_TRIGGER_CONFIG = {
  // Sources to scan (disable any that lose API access)
  sources_enabled: {
    tiktok:       true,
    instagram:    true,
    youtube:      true,
    reddit:       true,
    google_trends: true,
  },

  // Max candidates to write to trend_candidates table
  max_candidates: 10,

  // Combined score minimum to be eligible (below this = ignored)
  min_combined_score: 0.3,

  // Combined score weights
  score_weights: {
    raw_signal: 0.40,
    geo_relevance: 0.35,
    market_alignment: 0.25,
  },

  // Reddit subreddits to scan
  reddit_subreddits: ['RealEstate', 'FirstTimeHomeBuyer', 'Bend', 'Oregon'],

  // Google Trends geo filter
  google_geo: 'US-OR',
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `TIKTOK_RESEARCH_TOKEN` | TikTok Research API access token (separate from Content Posting) |
| `META_ACCESS_TOKEN` | Instagram hashtag search |
| `YOUTUBE_ACCESS_TOKEN` | YouTube Data API |
| `CRON_SECRET` | Cron auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | trend_candidates + automation_runs write |

Note on TikTok Research API: This requires a separate application approval from TikTok's
Research API program (distinct from the Content Posting API). Matt needs to apply at
`developers.tiktok.com` under the Research API section. Until approved, set
`sources_enabled.tiktok = false` and use only the remaining 4 sources.

## Manual override / kill switch

**Kill trend trigger:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'trend_trigger_enabled';
```

**Add a manual trend candidate (bypass scan):**
```
POST /api/admin/trend-candidates
Body: {
  title: "...",
  re_angle: "...",
  source: "manual",
  trend_type: "topic",
  fair_housing_safe: true,
  fair_housing_override_note: "reviewed by Matt 2026-04-28"
}
```

**Re-run for current week:**
```
GET /api/cron/trend-trigger?force=true
```

**Clear this week's candidates and re-run:**
```sql
DELETE FROM trend_candidates WHERE week_of = date_trunc('week', now());
-- Then re-run cron
```

## See also

- `video_production_skills/social_calendar/SKILL.md` — reads `trend_candidates` on Mondays
- `video_production_skills/meme_content/SKILL.md` — produces meme content from selected trends
- `automation_skills/triggers/market_trigger/SKILL.md` — market data used for alignment check
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — content quality and fair housing rules
