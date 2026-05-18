---
name: marketing-brain-platform-trends
description: Scrape industry sources for platform algorithm changes, high-engagement format trends, trending audio, and hashtags. Synthesize into a PlatformTrendsReport filtered through Ryan Realty's voice guidelines. Use when running the weekly marketing brain cycle, when a platform announces a major algorithm update, or when generate-briefs needs fresh format signal. Logic in lib/marketing-brain/platform-trends.ts. Cron at app/api/cron/marketing-platform-trends. Writes to public.competitor_intel.
---

# marketing-brain: platform-trends

The marketing brain's platform intelligence layer. Monitors industry sources and platform newsrooms weekly, applies the Ryan Realty voice filter, and produces a machine-readable `PlatformTrendsReport` that `generate-briefs` consumes to adapt content format, audio selection, and hashtag strategy without requiring manual research.

---

## When to use this skill

- The weekly brain cycle runs and needs fresh platform signal before generating briefs.
- A platform (TikTok, Meta, YouTube, LinkedIn) announces an algorithm change and you need to quantify its impact on content strategy.
- `generate-briefs` needs to know which audio tracks are low-saturation and worth using now.
- You are auditing whether Ryan Realty's current format mix is still effective.
- You are writing or debugging `lib/marketing-brain/platform-trends.ts`.

---

## The 4-layer signal model

| Layer | What it captures | Source type |
|---|---|---|
| **Algorithm intel** | Ranking factor changes, reach-affecting policy updates, feed distribution shifts | Platform official blogs, industry publications |
| **Format trends** | Creative patterns outperforming baselines (e.g. raw iPhone vertical vs polished) | Industry blogs, creator intelligence |
| **Audio trends** | Low-saturation, high-engagement audio on TikTok and Reels | TikTok Creative Center, industry aggregators |
| **Hashtag trends** | Trending tags in the Bend / Central Oregon / real estate niche | TikTok Creative Center, industry aggregators |

Each layer writes to `competitor_intel` with:
- `source`: `'algorithm_intel'` (algorithm layer) or `'industry_signal'` (format / audio / hashtag)
- `competitor`: the platform name, e.g. `'tiktok'`, `'instagram'`, `'meta'`, `'youtube'`, `'all'`
- `data_type`: `'algorithm_signal'` | `'format_trend'` | `'audio_trend'` | `'hashtag_trend'`

---

## Sources scraped

### Algorithm intel sources
| URL | Platform |
|---|---|
| `facebook.com/business/news` | meta |
| `newsroom.tiktok.com/en-us` | tiktok |
| `blog.youtube/news-and-events/creator-insider/` | youtube |
| `business.linkedin.com/marketing-solutions/blog` | linkedin |
| `socialmediatoday.com/news/` | all |
| `buffer.com/resources/` | all |

### Format trend sources
| URL | Platform |
|---|---|
| `socialmediatoday.com/news/` | all |
| `buffer.com/resources/` | all |
| `later.com/blog/` | all |
| `creatoriq.com/blog/` | all |

### Audio and hashtag sources
| URL | Platform |
|---|---|
| TikTok Creative Center trending hashtags | tiktok |
| TikTok Creative Center trending music | tiktok |
| `socialmediatoday.com/tag/tiktok/` | tiktok |
| `socialmediatoday.com/tag/instagram/` | instagram |

---

## Apify actors per scraper function

| Function | Actor ID | Notes |
|---|---|---|
| `scrapeAlgorithmIntel` | `apify/rag-web-browser` | RAG crawl of platform newsrooms and industry blogs |
| `scrapeFormatTrends` | `apify/rag-web-browser` | Same actor, different source URLs |
| `scrapeAudioAndHashtagTrends` | `apify/rag-web-browser` | TikTok Creative Center is JavaScript-heavy; see TODO in source if actor cannot parse it.  alternative: `clockworks/free-tiktok-scraper` |

All three functions reuse `runApifyActor` from `lib/marketing-brain/competitor-recon.ts`. The same `APIFY_API_TOKEN` env var is required.

---

## Weekly cadence

**Schedule:** Mondays 08:00 UTC.  one hour after `marketing-competitor-recon` (07:00 UTC).

```json
{ "path": "/api/cron/marketing-platform-trends", "schedule": "0 8 * * 1" }
```

The one-hour gap ensures Apify rate limits are clear after competitor-recon's actor runs before platform-trends begins its own runs.

---

## The RyanRealtyAdaptations filter

After scraping, `applyToRyanRealty()` runs every trend through the voice guidelines before the report is returned. The algorithm has three steps:

### Step 1: Voice violation check

Each trend's label and description are checked against `VOICE_VIOLATION_PATTERNS`, an array of regex patterns locked to specific rules in `voice_guidelines.md`:

| Pattern category | Voice rule violated |
|---|---|
| Prank / skit / stunt formats | §4.4 Professional |
| Fear-based or FOMO-driven content | §6.4 Banned tropes: market-doom or market-hype take |
| Fake urgency hooks | §6.3 Banned phrases: fake urgency |
| Engagement-bait mechanics | §11 Per-channel calibration: no engagement bait |
| "Other agents do it wrong" framing | §6.4 Banned tropes: dramatic before-and-after |
| Luxury / white-glove / top-1-percent positioning | §6.3 Banned phrases: marketing slop |
| Guaranteed outcome claims | §4.1 Trustworthy: no guaranteed outcome claims |

Any match → `applicable: false`, item placed in `skip` with `voice_rule_violated` citing the exact section.

### Step 2: Platform relevance

Applicable trends on active platforms (TikTok, Instagram, Meta, YouTube) go to `act_on`. Applicable trends on secondary platforms (LinkedIn, X) or with early-stage signals (algorithm rumors, low-saturation audio) go to `monitor`.

### Step 3: Hashtag relevance gate

Hashtags that do not match the Bend / Central Oregon / real estate relevance keyword list are placed in `skip` with reason "not relevant to category".  no voice rule needed.

### Output buckets

| Bucket | Meaning for generate-briefs |
|---|---|
| `act_on` | Use immediately: adopt the format, add the audio, use the hashtag |
| `monitor` | Watch for one week; re-evaluate at next weekly cycle |
| `skip` | Do not use; voice rule or relevance conflict documented |

---

## PlatformTrendsReport shape

```typescript
{
  as_of_date: string                    // YYYY-MM-DD
  algorithm_signals: AlgorithmSignal[]  // Platform algorithm change posts
  format_trends: FormatTrend[]          // High-engagement creative patterns
  audio_trends: AudioTrend[]            // Trending audio (TikTok / Reels)
  hashtag_trends: HashtagTrend[]        // Niche-relevant trending hashtags
  ryan_realty_adaptations: {
    act_on: AdaptationItem[]            // Voice-approved, act immediately
    monitor: AdaptationItem[]           // Early-stage, check next week
    skip: AdaptationItem[]              // Voice violation or irrelevant
  }
  fetched_at: string                    // ISO timestamp of scrape run
  errors: string[]                      // Non-fatal scrape errors
}
```

Every field is typed in `lib/marketing-brain/platform-trends.ts`. No free-form strings.  `generate-briefs` reads the typed fields directly.

---

## Env var requirements

| Variable | Source | Required |
|---|---|---|
| `APIFY_API_TOKEN` | apify.com → Settings → Integrations → Personal API tokens | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Yes |
| `CRON_SECRET` | Vercel env → cron secret | Yes |

If `APIFY_API_TOKEN` is absent, the route returns 500 and writes a `trend_check_skipped` row to `marketing_decisions` so the dashboard shows the gap.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `APIFY_API_TOKEN` not set | 500 with "APIFY_API_TOKEN is not set"; `trend_check_skipped` row in `marketing_decisions` | Add token to Vercel env and redeploy |
| RAG browser cannot parse SPA (TikTok Creative Center) | `audioTrends` and `hashtagTrends` arrays empty | Replace `apify/rag-web-browser` with `clockworks/free-tiktok-scraper` for those URLs; see TODO in `scrapeAudioAndHashtagTrends` |
| Actor run FAILED | Error in `scrapeErrors[]` array in route response | Check Apify run log at apify.com; usually rate limit or input shape mismatch |
| All signals arrays empty | No algorithm/format posts matched heuristics | Broaden the regex patterns in `scrapeAlgorithmIntel` / `scrapeFormatTrends`; check raw actor output |
| Supabase insert error | Error in route response body | Check `competitor_intel` RLS; service_role must have INSERT (migration `20260512160600_competitor_intel.sql` sets this) |

---

## Adding a new source URL

1. Add the entry to the appropriate source array constant in `lib/marketing-brain/platform-trends.ts` (`ALGORITHM_INTEL_SOURCES`, `FORMAT_TREND_SOURCES`, or `AUDIO_HASHTAG_SOURCES`).
2. Set the `platform` field to the appropriate `TrendPlatform` value.
3. No other changes required.  the scraper functions iterate the arrays dynamically.
4. Test with a one-off curl: `GET /api/cron/marketing-platform-trends` with `Authorization: Bearer $CRON_SECRET`.

---

## Adding a new voice violation pattern

1. Add an entry to `VOICE_VIOLATION_PATTERNS` in `lib/marketing-brain/platform-trends.ts`.
2. Set `voice_rule` to the exact section citation from `voice_guidelines.md`.
3. Set `reason` to a one-sentence explanation of why the pattern conflicts with that rule.
4. Update the pattern table in this SKILL.md.
5. Run `npx tsc --noEmit` to confirm no type errors.

---

## Related skills

- `marketing-brain:competitor-recon`.  runs at 07:00 Monday; shares `runApifyActor` helper and `competitor_intel` table.
- `marketing-brain:generate-briefs`.  downstream; reads `ryan_realty_adaptations.act_on` to inform format and audio choices in new content briefs.
- `marketing-brain:weekly-cycle`.  orchestrates snapshot → competitor-recon → platform-trends → generate-briefs in sequence.
- `marketing-brain:brand-voice`.  the voice guidelines this skill enforces are canonical at `marketing_brain_skills/brand-voice/voice_guidelines.md`.
