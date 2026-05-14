---
name: marketing-brain-competitor-recon
description: Scrape competitor marketing activity (reviews, SERP rankings, social profiles, paid ads) via Apify and write observations to public.competitor_intel. Use when running the weekly marketing brain cycle, when a competitor launches a new campaign that needs immediate intel, when diagnosing a traffic or lead-volume drop that may be competitor-driven, or when auditing content format gaps. The recon route lives at app/api/cron/marketing-competitor-recon. Helpers in lib/marketing-brain/competitor-recon.ts.
---

# marketing-brain: competitor-recon

The marketing brain's competitive intelligence layer. Monitors 8 Bend-area brokerages and 2 national disruptors across five data sources, writing raw observations to `competitor_intel` weekly. Downstream skills (`diagnose-performance`, `generate-briefs`) read from this table to surface gaps and counter-moves.

---

## When to use this skill

- The weekly brain cycle runs and needs a fresh competitive snapshot.
- A competitor launches a new ad campaign or changes their social cadence.
- Traffic or lead volume drops and the cause may be competitive.
- You're identifying content formats or SERP positions to target.
- A new competitor enters the Bend market and needs a target added.

---

## The 10 competitor targets

| Slug | Name | Notes |
|---|---|---|
| `cascade_hasson_sothebys` | Cascade Hasson Sotheby's International Realty | Bend primary |
| `compass_bend` | Compass Bend | National franchise with Bend office |
| `windermere_central_oregon` | Windermere Central Oregon | Regional franchise |
| `cascade_sothebys` | Cascade Sotheby's International Realty | Bend secondary SIR brand |
| `coldwell_banker_bain_bend` | Coldwell Banker Bain Bend | National franchise |
| `berkshire_hathaway_nw_bend` | Berkshire Hathaway HomeServices NW Bend | National franchise |
| `john_l_scott_bend` | John L. Scott Bend | Pacific NW franchise |
| `remax_key_properties_bend` | RE/MAX Key Properties Bend | Franchise |
| `opendoor` | Opendoor | National iBuyer disruptor |
| `offerpad` | Offerpad | National iBuyer disruptor |

Slugs are locked in the migration (`supabase/migrations/20260512160600_competitor_intel.sql`) and the `CompetitorSlug` type in `lib/marketing-brain/competitor-recon.ts`. Never invent a new slug without updating both.

Social handles and URLs in `COMPETITOR_TARGETS` are marked `verified: false` for local competitors — confirm against live profiles before depending on them. National brands (opendoor, offerpad) are `verified: true`.

---

## Per-source Apify actors

| Source slug | Apify actor ID | What it captures |
|---|---|---|
| `google_maps_reviews` | `compass/Google-Maps-Reviews-Scraper` | Newest 50 GMB reviews per competitor |
| `google_serp` | `apify/google-search-scraper` | Organic positions for 10 locked SERP queries |
| `instagram_profile` | `apify/instagram-profile-scraper` | Follower count, post count, last 12 posts with engagement |
| `tiktok_profile` | `clockworks/free-tiktok-scraper` | Last 12 videos with play/like/comment/share counts |
| `fb_ad_library` | `apify/facebook-ads-scraper` | Active Meta ads (copy, CTA, media type, impressions range) |

Actor IDs are the canonical Apify store slugs. If an actor moves or is superseded, update the call in `lib/marketing-brain/competitor-recon.ts` and this table.

---

## SERP queries tracked (locked 10)

```
homes for sale bend oregon
bend real estate agent
sell my home bend
bend or real estate
bend oregon realtors
top realtor bend
houses for sale bend oregon
bend luxury homes
redmond oregon real estate
central oregon real estate
```

Positions are stored as `serp_position` data_type rows. `data.query` + `data.position` + `data.url` are the key fields.

---

## Row taxonomy

Every row written to `competitor_intel` follows:

| Field | Values |
|---|---|
| `source` | `google_maps_reviews` \| `google_serp` \| `instagram_profile` \| `tiktok_profile` \| `fb_ad_library` |
| `data_type` | `review` (GMB) \| `serp_position` (SERP) \| `post` (IG/TikTok) \| `profile_metric` (IG account-level) \| `ad` (FB Ad Library) |
| `competitor` | One of the 10 slugs above |
| `data` | Source-specific JSONB — see scraper function JSDoc for field names |
| `apify_run_id` | Apify run UUID — use to audit raw dataset at apify.com |

`observation_date` is the date the cron ran (YYYY-MM-DD), not a scraped publication date. Downstream queries should group by `(competitor, source, observation_date)` to see week-over-week deltas.

---

## Cron schedule

**Daily 07:00 UTC, Mon-Fri** — one source per weekday. Defined in `vercel.json`:

```json
{ "path": "/api/cron/marketing-competitor-recon", "schedule": "0 7 * * 1-5" }
```

The route detects Vercel cron requests (via the `x-vercel-cron: 1` header) and rotates source selection by day-of-week:

| Day (UTC) | Source |
|---|---|
| Monday | `google_maps_reviews` |
| Tuesday | `google_serp` |
| Wednesday | `instagram_profile` |
| Thursday | `tiktok_profile` |
| Friday | `fb_ad_library` |
| Sat/Sun | no-op (returns `skipped: true`) |

Each weekday run handles ~10 competitors × 1 source × 30-90s/scraper = 5-15 min, comfortably under the 800s `maxDuration` cap on Vercel Pro. The pre-2026-05-14 single-Monday schedule (`0 7 * * 1`) repeatedly timed out because the full 50-call pass exceeded the previous 300s `maxDuration`.

For manual full passes (all sources × all competitors in one call), invoke without filters — but note this can exceed `maxDuration` if Apify is slow that day. Prefer per-source manual runs:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-competitor-recon?source=instagram_profile"
```

---

## Targeted test runs

Scope to a single combination for faster iteration:

```
GET /api/cron/marketing-competitor-recon?source=google_maps_reviews&competitor=compass_bend
Authorization: Bearer $CRON_SECRET
```

Omit either param to expand to all competitors or all sources for that dimension. Filter modes:

| Query | Behavior |
|---|---|
| (none) + Vercel cron header | Rotate by day-of-week (single source) — the production cron path |
| (none) + manual curl | Run ALL sources × ALL competitors — may exceed maxDuration; avoid |
| `?source=X` | One source × all competitors |
| `?competitor=Y` | All sources × one competitor — may exceed maxDuration |
| `?source=X&competitor=Y` | Single combo (fastest; ideal for actor input debugging) |

---

## Env var requirements

| Variable | Source | Required |
|---|---|---|
| `APIFY_API_TOKEN` | apify.com → Settings → Integrations → Personal API tokens | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Yes |
| `CRON_SECRET` | Vercel env → cron secret | Yes |

`APIFY_API_TOKEN` must be a token with "All resources" scope created at `apify.com/account/integrations`. The token grants access to all actors in the Apify store; there is no per-actor allow-listing needed for store actors.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `APIFY_API_TOKEN` not set | 500 with "APIFY_API_TOKEN is not set" | Add token to Vercel env and redeploy |
| Actor run FAILED | Error in `errors[]` array in response | Check Apify run log at apify.com; usually rate limit or input shape mismatch |
| Actor input shape mismatch | 0 rows, Apify run SUCCEEDED | See TODO comments in each scraper; refine input after checking actor's live schema |
| Instagram/TikTok handle not configured | `error: "no instagram handle configured"` | Update handle in `COMPETITOR_TARGETS` and set `verified: true` after confirming |
| Supabase insert error | Error mentioning batch offset | Check `competitor_intel` RLS — service_role must have INSERT grant (migration sets this) |
| Apify poll timeout (>5 min) | Timeout error in scraper | Reduce `maxReviews`/`resultsLimit`/`maxAds` in that actor's input |

---

## Adding a new competitor

1. Add a `CompetitorSlug` union member in `lib/marketing-brain/competitor-recon.ts`.
2. Add a `CompetitorTarget` entry to `COMPETITOR_TARGETS`.
3. Add the slug to the migration's comment block and re-apply if needed.
4. Update the table above in this SKILL.md.
5. Run a targeted test: `?competitor=<new_slug>` to confirm all five sources return rows.

---

## Related skills

- `marketing-brain:snapshot-channels` — writes to `marketing_channel_daily` (Ryan Realty's own channels).
- `marketing-brain:diagnose-performance` — reads from both tables to surface competitive deltas.
- `marketing-brain:weekly-cycle` — invokes competitor-recon as step 2 of the weekly pass (after snapshot-channels).
