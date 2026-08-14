# Track 1 §4 — SEO / analytics / GSC / LLM surfaces

Fetched 2026-08-13 against live `https://ryan-realty.com` (browser UA) plus on-disk routes. Dial only. No chatbot. No second discovery stack. Ads not this lease.

## Inventory (on disk)

| Surface | Path | Status this session |
|---|---|---|
| AI map | `app/llms.txt/route.ts` → `/llms.txt` | Dialed: golf hub no longer cites noindex `/lp/central-oregon-golf`. Per-course `/central-oregon/golf/{slug}` lines stay. Pillars from `lib/seo/ai-query-map.json`. No `llms-full.txt`. No `.well-known` variant. |
| Query battery | `lib/seo/ai-query-map.json` + G67 `scripts/check-ai-query-battery.mjs` | Already F1. Dialed: indexable NWX browse pillar added. `/lp/` citation now fails the gate. |
| Robots | `app/robots.ts` → `/robots.txt` | GREEN. `/` allowed. AI bots allowed (GPTBot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, …). `/admin` `/account` `/api` `/dev` disallowed. `/lp/*` not Disallowed (paid landing still fetchable; page-level noindex). Sitemap advertised. |
| Sitemap | `app/sitemap.ts` + `app/sitemaps/index.xml/route.ts` + `/sitemaps/{core,geo,listings,matrix,content}.xml` | Dialed: removed noindex `/lp/tetherow`, `/lp/central-oregon-golf`, `/lp/bend`, `/lp/tetherow/heath`, and 301 `/feed`. Gate: sitemap must not emit `${baseUrl}/lp/` or `/feed`. |
| JSON-LD | `components/JsonLd.tsx` (layout Organization + WebSite) + `components/site/MetadataBlock.tsx` + `lib/site/json-ld.ts` | GREEN on every §3 destination (live HTML). G34 `scripts/check-ai-structured-data.mjs`. |
| Canonicals | per-page `alternates.canonical` (root layout deliberately has none) | GREEN on the three query URLs. |
| GA4 | `components/GoogleAnalytics.tsx` via `AnalyticsScripts` | Wired. Live HTML loads gtag. Local env `NEXT_PUBLIC_GA4_MEASUREMENT_ID` set (`G-S…`). Consent Mode v2. |
| GTM | `components/GTMHead.tsx` + `GTMBody.tsx` | Wired. Local env `NEXT_PUBLIC_GTM_CONTAINER_ID` set (`GTM…`). |
| GSC | `app/actions/search-console-report.ts` (default site `https://ryan-realty.com/`) + cron `app/api/cron/marketing-snapshot-gsc/route.ts` + admin `/admin/analytics/google-search` | Wired and used. `marketing_channel_daily` channel=`gsc`: 2026-08-11 impressions 1,222 / clicks 12. Service-account email present. `GOOGLE_SEARCH_CONSOLE_SITE_URL` unset locally; code defaults to the URL-prefix property. No `google-site-verification` meta and no `public/google*.html` — GSC is already ingesting; do not invent a token. |
| G39 | `scripts/check-ai-crawler-access.mjs` | Dialed: fails if llms.txt cites `/lp/`. |

`/lp/*` stay noindex (live: golf LP and Bend LP `noindex, nofollow`). That lock is unchanged.

Leftover, not this lease: chrome/menu still link Golf to `/lp/central-oregon-golf` (`lib/site-nav.ts`, `lib/site-menu.ts`, `lib/search/site-pages.ts`). Paid arrival. Organic citation is the per-course pages.

## Three test queries (live HTML 2026-08-13)

### 1. “Show me the best broker in Bend.”

We do not claim best. Cite licenses, who closes, and verbatim Google reviews.

| URL | Indexable | JSON-LD | llms.txt | sitemap |
|---|---|---|---|---|
| `/about` (primary) | yes (`index, follow`) | AboutPage + FAQPage + layout Organization | yes (pillar) | yes (core static) |
| `/team` | yes | CollectionPage + FAQPage | yes | yes |
| `/reviews` | yes | Review nodes, no aggregateRating | yes | yes |

### 2. “I need a 3-bedroom, 2-bath in Northwest Crossing.”

| URL | Indexable | JSON-LD | llms.txt | sitemap |
|---|---|---|---|---|
| `/communities/northwest-crossing` (Google / place) | yes | Place + BreadcrumbList | yes (community list) | yes |
| `/homes-for-sale/bend/northwest-crossing` (Google / inventory) | yes (canonical self) | WebPage + BreadcrumbList | yes (new pillar this session) | geo browse family |
| `/homes-for-sale/bend/northwest-crossing?beds=3&baths=2` (AI fetch) | **no** (`noindex, follow`; canonical is the unfiltered browse). Facet keys are noindex by design (`shouldNoIndexSearchVariant`). | same search JSON-LD | yes (kept so assistants can fetch the filter) | no (query string) |

### 3. “Get my home’s value in Bend” (never the worth-question on the button)

| URL | Indexable | JSON-LD | llms.txt | sitemap |
|---|---|---|---|---|
| `/sell` (primary) | yes | Service + FAQPage | yes (“Value my home”) | yes |
| `/sell/valuation` | yes | Service + WebPage + FAQPage | yes | yes |

Title/meta on `/sell/valuation` may keep search-demand “what is my home worth Bend” in keywords. Visible CTA stays Value my home.

## §3 destinations (JSON-LD live)

| Route | JSON-LD on live HTML |
|---|---|
| `/` | Organization + WebSite (layout). No page MetadataBlock (documented). |
| `/sell` | Service + FAQPage |
| search / listing browse | SearchPageJsonLd WebPage + BreadcrumbList |
| listing detail | RealEstateListing (G34 on `app/listing/[listingKey]/page.tsx`) |
| places (`/communities/northwest-crossing`) | Place |
| `/open-houses` | Event nodes |
| `/about` | AboutPage |
| `/reviews` | Review |
| `/housing-market` | WebPage + Dataset |

## Analytics / GSC proof

- Live pages include `googletagmanager` / gtag.
- GSC rows in `marketing_channel_daily` through 2026-08-11 (GSC lag is 2–3 days).
- Admin reader: `app/admin/(protected)/analytics/google-search/page.tsx`.
- No new vendor.

## Already green vs fixed

Already green: robots AI allow-list, Organization JSON-LD, F1 three-query map, G34/G39/G67, GA4+GTM, GSC ingest, `/lp/*` page noindex, §3 JSON-LD.

Fixed this session: llms.txt golf hub cited a noindex LP; sitemap submitted four noindex LPs + `/feed`; NWX 3/2 pillar was only the noindex facet URL; gates did not forbid `/lp/` on the AI map or sitemap.
