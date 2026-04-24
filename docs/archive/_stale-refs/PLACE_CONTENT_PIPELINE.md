# Place content pipeline (background)

Robust, brand-voice copy for every **city**, **neighborhood**, **community**, and **resort community** is generated in the **background** by a cron job—not on-the-fly when a page is generated. This keeps pages fast and ensures copy is substantive for search engines and LLMs.

## How it works

1. **Cron** calls `GET /api/cron/refresh-place-content` (e.g. daily at 3 AM, see `vercel.json`).
2. Each run processes one **chunk** of entities:
   - **Cities**: up to 3 per run (default). For each city, the pipeline fetches current market stats (active count, median price, closed last 12 months), builds a long-form “About [city]” prompt in brand voice, generates copy via xAI (Grok), and writes to `cities.description`, `cities.seo_title`, `cities.seo_description`.
   - **Neighborhoods**: up to 5 per run. Same idea: stats → prompt → generate → write to `neighborhoods.description` and SEO fields.
   - **Communities** (subdivisions): up to 20 per run. For each community missing “about” or “attractions,” the pipeline generates and writes to `subdivision_descriptions` (about, attractions; dining can be added the same way).
3. Over time, every city, neighborhood, and community gets refreshed. No manual “generate” buttons; the pipeline rotates through the full list.

## Brand voice

All generated copy follows the same rules as the rest of the site:

- Warm, factual, welcoming. No hype words (e.g. “stunning,” “nestled,” “must see,” “exclusive,” “world-class”).
- CTAs are specific (e.g. “See all Bend listings” not “Learn more”).
- Copy is substantive and useful for buyers/sellers and for SEO.

Prompts live in:

- `app/actions/place-content-pipeline.ts` (cities, neighborhoods)
- `app/actions/subdivision-descriptions.ts` (communities: about, attractions, dining)

## Data used

- **Cities**: `getCityMarketStats({ city })` → active count, median price, closed last 12 months. This data is injected into the prompt so the copy reflects current market conditions.
- **Neighborhoods**: `getNeighborhoodBySlug` → active count, median price.
- **Communities**: existing subdivision logic; listing-derived stats can be passed into prompts in the same way.

**Report data**: The pipeline is designed so you can add report data (e.g. “last week X pending, Y closed” from `market_reports` or `reporting_cache`) into the prompts. Right now it uses listing stats; you can extend `generateAndWriteCityContent` / neighborhood / community to pull from your report APIs and append to the data blurb in the prompt.

## Where copy is stored and shown

| Entity       | Stored in                         | Shown on page                                      |
|-------------|------------------------------------|----------------------------------------------------|
| City        | `cities.description`, `seo_title`, `seo_description` | City page; when `description` length ≥ 300, DB copy is preferred over static `lib/city-content.ts`. |
| Neighborhood| `neighborhoods.description`, `seo_title`, `seo_description` | Neighborhood page about section.                   |
| Community   | `subdivision_descriptions` (about, attractions, dining) | Community page; also `communities.description` and `resort_content` if you extend the pipeline to write them. |

## Tuning and overrides

- **Larger chunks**: Call the cron with query params, e.g.  
  `GET /api/cron/refresh-place-content?cities=5&neighborhoods=10&communities=30`  
  (max values are capped in the route to avoid timeouts.)
- **Manual run**: Same URL with `Authorization: Bearer <CRON_SECRET>` from your machine or a script.
- **xAI**: Requires `XAI_API_KEY` in env. If the key is missing, city/neighborhood/community generation will fail for that run; the cron returns `ok: true` with `failed` and `errors` so you can see which entities failed.

## Adding report data to prompts

To use report data (e.g. weekly pending/closed counts) in the generated copy:

1. In `place-content-pipeline.ts`, add a helper that fetches report summary for a city (or neighborhood/community) from your report tables or RPCs.
2. In `generateAndWriteCityContent`, call that helper and append the summary to `dataBlurb` (or a new “report” line) before building the prompt.
3. Do the same in `generateAndWriteNeighborhoodContent` and in the subdivision prompts in `subdivision-descriptions.ts` if you have report data at subdivision level.

This keeps the pipeline running in the background while making copy as data-rich as your reports allow.
