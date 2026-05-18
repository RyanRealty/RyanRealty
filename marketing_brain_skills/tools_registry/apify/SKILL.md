---
name: tools_registry-apify
description: Use this skill when a task involves "scrape Instagram profile", "pull TikTok videos", "Apify actor", "competitor recon", "google maps reviews scrape", "facebook ad library", "youtube channel scrape", "linkedin posts scrape", "when do I use Apify", "what actors does Ryan Realty use", or any web-scraping task for competitive intelligence. Apify is the canonical web-scraping platform for Ryan Realty. Covers authentication, the validated actor registry, cost model, invocation pattern, failure modes, and where results land.
---

# Apify Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's competitive intelligence layer. Every task that invokes this skill also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `marketing_brain_skills/competitor-recon/SKILL.md`.  the brain skill that calls this tool

---

## Scope

**Use Apify for:**

| Use case | Why Apify |
|---|---|
| Competitor social profile metrics (followers, engagement, recent posts) | No official API permits bulk cross-account reads |
| Google Maps / GMB review scraping | Maps Data API does not expose third-party reviews at scale |
| Facebook Ad Library scraping | Meta's Ad Library API requires an app review and is quota-limited |
| Google SERP position tracking | GSC only reports Ryan Realty's own positions, not competitors |
| YouTube channel scraping (competitor channels) | YouTube Data API v3 enforces a 10k-unit daily quota; Apify runs are cheaper for occasional pulls |
| LinkedIn post scraping | No public API for posts on competitor pages |

**Do NOT use Apify for:**

| Data source | Use instead |
|---|---|
| Ryan Realty's own Meta reach / impressions | Meta Graph API (token in `NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN`) |
| Ryan Realty's own GA4 sessions / conversions | GA4 Data API (service-account JSON in Vercel env) |
| Ryan Realty's own GSC impressions / clicks | Google Search Console API |
| Lead data in Follow Up Boss | FUB REST API (`FOLLOW_UP_BOSS_API_KEY`) |
| MLS / listing data | Spark API (`SPARK_API_KEY`) or Supabase `listings` table |

The rule: if a first-class API integration exists for that data source, use it. Apify is the fallback for data that has no clean official pathway.

---

## Authentication

| Variable | Where to get it | Scope required |
|---|---|---|
| `APIFY_API_TOKEN` | apify.com → Account → Settings → Integrations → Personal API tokens | "All resources" |

```ts
// lib/marketing-brain/competitor-recon.ts.  canonical getter
export function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    throw new Error(
      'APIFY_API_TOKEN is not set. Add it from apify.com/account/integrations to.env.local.',
    )
  }
  return token
}
```

Token is stored in:
- `.env.local` (local dev)
- Vercel → Project Settings → Environment Variables → Production + Preview + Development

No per-actor allow-listing is needed for Apify Store actors. One token with "All resources" scope covers everything.

---

## Canonical actor registry

These actors are validated for Ryan Realty use. IDs are the Apify Store slugs used in `runApifyActor()` calls.

### Instagram

| Actor ID | What it captures | Cost estimate | Input gotchas |
|---|---|---|---|
| `apify/instagram-profile-scraper` | Follower count, following, post count, bio, last N posts with likes/comments | ~$0.05-0.10 per profile (12 posts) | Pass `usernames: [handle]` (no `@`) and `resultsLimit: 12`. The field `latestPosts[]` carries individual post objects. |
| `apify/instagram-post-scraper` | Engagement on a list of specific post URLs | ~$0.02-0.05 per 10 posts | Use when you have direct post URLs from a prior profile scrape and want deeper engagement detail. |
| `apify/instagram-scraper` | General-purpose IG scraper.  handles, hashtags, URLs | ~$0.05-0.15 per run | More flexible than profile-scraper but slower to configure. Prefer `instagram-profile-scraper` for the competitor-recon use case. |

### TikTok

| Actor ID | What it captures | Cost estimate | Input gotchas |
|---|---|---|---|
| `clockworks/free-tiktok-scraper` | Last N videos with play/like/comment/share counts, author follower count | ~$0.05-0.15 per profile (12 videos) | Pass `profiles: ["https://www.tiktok.com/@<handle>"]` and `resultsPerPage: 12`. Item fields: `playCount`, `diggCount` (likes), `commentCount`, `shareCount`, `text` (caption), `createTime`, `webVideoUrl`, `authorMeta.fans`. |
| `clockworks/tiktok-scraper` | Full TikTok scraper.  profiles, hashtags, search | ~$0.10-0.25 per profile | Use when `free-tiktok-scraper` returns 0 rows; this paid tier is more robust against anti-scraping changes. |

### YouTube

| Actor ID | What it captures | Cost estimate | Input gotchas |
|---|---|---|---|
| `apify/youtube-channel-scraper` | Channel stats + up to N recent videos with view/like/comment counts | ~$0.10-0.30 per channel (50 videos) | Pass `startUrls: [{ url: "https://www.youtube.com/@<handle>" }]` and `maxResults: 50`. |
| `apify/youtube-scraper` | Search results or specific video URLs | ~$0.05-0.20 per run | Use for ad-hoc video URL scraping, not bulk channel pulls. |
| `streamers/youtube-scraper` | Alternative YouTube channel scraper | ~$0.10-0.20 per channel | Fall back to this if `apify/youtube-channel-scraper` is rate-limited. Verify before first use.  actor name may have changed. |

### Facebook

| Actor ID | What it captures | Cost estimate | Input gotchas |
|---|---|---|---|
| `apify/facebook-ads-scraper` | Active ads from Ad Library: copy, CTA, media type, impressions range, start date | ~$0.10-0.30 per page | **FIXED 2026-05-15:** Actor schema changed.  now requires `startUrls: [{ url }]` and `maxResults` (not the old `adLibraryUrls` + `maxAds`). `lib/marketing-brain/competitor-recon.ts:scrapeFacebookAdLibrary()` updated to the new shape. Before each quarterly audit, verify by opening `apify.com/apify/facebook-ads-scraper` Input tab.  actor publishers sometimes change schemas unannounced. |
| `apify/facebook-pages-scraper` | Page follower count, about section, recent posts | ~$0.05-0.15 per page | Use `startUrls: [{ url: "<facebook_page_url>" }]`. Not currently wired into competitor-recon.  add when page-level follower tracking is needed. |

### Google

| Actor ID | What it captures | Cost estimate | Input gotchas |
|---|---|---|---|
| `apify/google-search-scraper` | Organic + paid positions for a list of queries | ~$0.05 per 10-query run | Pass `queries` as a newline-separated string (not an array), `countryCode: "us"`, `languageCode: "en"`, `resultsPerPage: 20`, `maxPagesPerQuery: 1`. Item field `organicResults[]` carries `{ position, url, title, description }`. |
| `compass/Google-Maps-Reviews-Scraper` | Newest N GMB reviews with text, rating, date, reviewer | ~$0.05-0.15 per 50 reviews | Pass `startUrls: [{ url: "<google_maps_url>" }]`, `maxReviews: 50`, `reviewsSort: "newest"`, `language: "en"`. The actor ID uses mixed case.  paste exactly as shown. |

### LinkedIn

| Actor ID | What it captures | Cost estimate | Input gotchas |
|---|---|---|---|
| `harvestapi/linkedin-post-search-scraper` | Posts from a company page within a date window | ~$0.50-2.00 per page (180-day window) | More expensive than social platforms.  LinkedIn anti-scraping is aggressive. Verify actor availability and input schema at apify.com before first run; the store listing may have changed. |
| `dev_fusion/linkedin-profile-scraper` | Company page follower count, about, employee count | ~$0.20-0.50 per page | Research-only at this stage.  not wired into the competitor-recon pipeline. Verify before first use. |

**LinkedIn actors carry higher uncertainty than others.** LinkedIn actively blocks scraping; actor quality degrades faster than other platforms. Always check the actor's "Last update" date and user reviews on the store page before a production run.

---

## Cost model

Apify charges per compute unit (CU). Budget planning:

| Scenario | Estimate |
|---|---|
| 10 competitors × Instagram profile scrape | ~$0.50-1.00 |
| 10 competitors × TikTok profile scrape | ~$0.50-1.50 |
| 10 competitors × Google Maps reviews | ~$0.50-1.50 |
| 10 queries × Google SERP (one run, all competitors share) | ~$0.05 |
| 10 competitors × Facebook Ad Library | ~$1.00-3.00 |
| Full 10-competitor × 5-source weekly pass | ~$3-7 per week |
| 30 competitors × 5 platforms × $0.10 avg | ~$15 per run |
| 50 competitors × $0.20 avg | ~$50 per run |

Cost estimates are approximate. Actual spend varies with result count and actor efficiency. Verify current usage at apify.com → Billing. The weekly pass at current 10-competitor scope is well within budget.

---

## Invocation pattern

The canonical invocation is `runApifyActor()` in `lib/marketing-brain/competitor-recon.ts`. All scraper functions in that file call it.

```ts
const APIFY_BASE = 'https://api.apify.com/v2'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 300_000 // 5 minutes

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ runId: string; datasetId: string; items: unknown[] }> {
  const token = getApifyToken()

  // 1. Start the run
  const startRes = await fetch(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  if (!startRes.ok) throw new Error(`Apify start ${actorId} failed (${startRes.status})`)
  const { data: { id: runId, defaultDatasetId: datasetId } } = await startRes.json()

  // 2. Poll until SUCCEEDED / terminal
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const s = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const { data: { status } } = await s.json()
    if (status === 'SUCCEEDED') break
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status))
      throw new Error(`Apify run ${runId} ended: ${status}`)
  }

  // 3. Fetch dataset items
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!itemsRes.ok) throw new Error(`Apify dataset ${datasetId} fetch failed`)
  const items = await itemsRes.json()

  return { runId, datasetId, items }
}
```

Call pattern.  example (Instagram):

```ts
const result = await runApifyActor('apify/instagram-profile-scraper', {
  usernames: [target.instagramHandle],
  resultsLimit: 12,
})
// result.items → array of profile+post objects
// result.runId → store on the row as apify_run_id for auditability
```

---

## Rate limits and retries

Apify enforces concurrency limits per account tier. Ryan Realty is on a paid plan; the free-tier limits do not apply. However:

- Run scraper calls serially within a single cron execution (see `route.ts`.  no `Promise.all` across actors). Burst parallelism triggers 429s.
- Per-actor input timeouts: set `maxReviews`, `resultsPerPage`, `maxAds` conservatively. A run that fetches 500 items is more likely to hit actor-side timeouts than one fetching 25.
- The poll loop in `runApifyActor` retries on transient HTTP errors (non-ok status on the status check → `continue`). Dataset fetch is not retried.  if it fails, the caller catches and records an error.
- Standard retry guidance for callers: 3 attempts with exponential backoff on 429 / 503 from the start-run endpoint. Not currently implemented in `competitor-recon.ts`.  add if burst failures appear in cron logs.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `APIFY_API_TOKEN` not set | `Error: APIFY_API_TOKEN is not set` on cold start | Add token to `.env.local` and Vercel env; redeploy |
| Actor ID moved or superseded | 404 on start-run endpoint, or actor page says "Deprecated" | Check apify.com/store; update actor ID in `competitor-recon.ts` and registry tables in `competitor-recon/SKILL.md` |
| Input shape mismatch | Run SUCCEEDED, 0 items in dataset | Silent failure.  worst case. Before any new actor call, open the actor's page on apify.com and verify the input schema against the JSON you're passing. Each scraper function in `competitor-recon.ts` has a TODO comment flagging unconfirmed input keys. |
| Dataset polling timeout | `Error: Apify run <id> timed out after 300s` | Reduce result counts in input. For full-pass crons, Vercel Pro budget allows longer wall time beyond `maxDuration: 300` for the GET handler.  the cron runner is not subject to the same 300s cap. |
| Rate limit (429) on burst | Multiple start-run calls in rapid succession | Ensure calls are serialized. If burst is unavoidable, add exponential backoff on the start-run `fetch`. |
| Actor anti-scraping failure (LinkedIn, TikTok) | Run SUCCEEDED, items contain error objects or HTML fragments instead of structured data | Check actor reviews on store page. Swap to the fallback actor listed in the registry. Reduce `resultsPerPage`. Add a `proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }` field to input. |

---

## Where results land

**Today:** every scraper function maps Apify items to `CompetitorIntelRow` objects and calls `insertCompetitorIntel()`, which batch-inserts to `public.competitor_intel` (Supabase project `dwvlophlbvvygjfxcrhm`). The `apify_run_id` column on every row lets you audit the raw Apify dataset at `apify.com/storage/datasets/<datasetId>`.

**Future state:** a `content_classification` table is planned to store post-level content-type tags (listing reel, market update, lifestyle, etc.) derived from competitor posts. When built, the competitor-recon scraper will fan output to both tables. This is not yet implemented.  do not write to a `content_classification` table until the migration ships.

---

## Existing usage

`lib/marketing-brain/competitor-recon.ts` is the canonical implementation. Read it before writing any new Apify call.  the `runApifyActor` utility, `CompetitorIntelRow` type, and `insertCompetitorIntel` batch-insert helper are already there. Do not re-implement them.

The cron entry point is `app/api/cron/marketing-competitor-recon/route.ts`. It serializes all source × competitor pairs and returns a structured JSON summary with per-source row counts, errors array, and Apify run IDs.

---

## Pre-flight checklist (before any new actor call)

```
[ ] APIFY_API_TOKEN confirmed in.env.local
[ ] Actor ID verified at apify.com/store.  actor exists, not deprecated, last updated < 6 months ago
[ ] Input schema confirmed against actor's live "Input" tab on apify.com.  not inferred from prior runs
[ ] result.items.length > 0 on a test run before wiring into production pipeline
[ ] apify_run_id stored on every row for audit trail
[ ] New actor added to registry tables in this SKILL.md and competitor-recon/SKILL.md
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/marketing-brain/competitor-recon.ts` | Existing implementation.  `runApifyActor`, scraper functions, `insertCompetitorIntel` |
| `marketing_brain_skills/competitor-recon/SKILL.md` | Brain skill that orchestrates Apify calls; competitor target list; row taxonomy; cron schedule |
| `app/api/cron/marketing-competitor-recon/route.ts` | Cron route.  serialized source × competitor loop, scope filters, response shape |
| `CLAUDE.md` "Marketing Brain Architecture" | Status flow, action-type categories, approval gates |
| https://apify.com/store | Actor browsing.  verify IDs and input schemas here before use |
| https://docs.apify.com | REST API reference (`/v2/acts/<id>/runs`, `/v2/actor-runs/<id>`, `/v2/datasets/<id>/items`) |
| https://apify.com/account/integrations | Token management |
