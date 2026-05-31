I have everything needed. The repo confirms: `ci:gates` is the real aggregate (and already has a `ci:geo-imagery` gate to extend), pre-push re-armed 2026-05-30, task #8 marked complete but `.env.local` still shows `vercel.app`, and the city page already has dynamic alt text (so the fix is purely the null-hero fallback). Writing the action plan now.

---

# Ryan Realty — Full Site-Quality Audit & Action Plan
**Live:** https://ryan-realty.com · **Date:** 2026-05-31 · **Stack:** Next.js (App Router) + Supabase + Vercel · **Bar:** Data-accuracy is rule #1 (right numbers AND right/beautiful images)

---

## 1. Executive Verdict

**Is the live site healthy?** Partially. The *architecture* is sound and the analytics backbone (GA4 + Conversions API) is genuinely healthy. But the site is shipping **two data-accuracy violations to real visitors right now** — wrong-city hero photos on every non-Bend page, and a market-report stat slide rendered as a community hero — plus **49% of listing videos silently disappear**, including the two most expensive listings in the MLS ($48.56M Cross Keys, $21M K Bar J). For a brokerage whose #1 rule is accuracy and whose goal is market domination, the front door is currently failing on accuracy and on its highest-value inventory.

**Overall quality-bar gap.** The code is at a high bar; the **data feeding it is poisoned and the fallbacks are wrong**. Three of the four worst problems are not code bugs — they are (a) an unverified bulk "Drive ingest" that contaminated the image pool ~46%, (b) empty cron-built feeds, and (c) a stale env value. The good news: every fix slots into an existing, already-armed gate suite (`ci:gates` + re-armed pre-push), so we can make each fix permanent the day we ship it.

**5 biggest problems, ranked:**

1. **IMG-01/03/04 — Wrong-city & wrong-content hero images sitewide (data-accuracy violation, CRITICAL).** Every non-Bend city page shows the Bend Old Mill drone photo; the asset pool is ~46% contaminated PNG stat-frames/logos; surviving JPGs are geo-mislabeled (Tumalo Falls served as Black Butte Ranch/Sisters). This violates rule #1 on most geo pages.
2. **IMG-02 — A market-report STAT SLIDE is the live hero for `/communities/broken-top` (CRITICAL).** A 1080×1920 PNG reading "318 ACTIVE LUXURY HOMES" is stretched into a landscape banner — wrong image type *and* stale un-sourced numbers frozen into a hero (a second accuracy violation in one asset).
3. **VID-01/02 — 49% of listing videos silently dropped (CRITICAL).** Bare-URL `ObjectHtml` (Dropbox/Aryeo) never reaches `classifyVideo`; both cron feeds are empty so 100% of traffic hits the buggy path. The $48.56M and $21M flagships show zero video.
4. **ANL-02 — Meta Pixel absent from initial HTML on every page (HIGH).** Pixel is hard-suppressed until marketing consent, with no GTM fallback (GTM is empty). Every pre-consent/declined visitor is invisible to Meta — caps retargeting reach and inflates paid CPMs.
5. **ANL-03 / ANL-01 — Stale `vercel.app` env + dead empty GTM container (MEDIUM, but data-integrity-adjacent).** `.env.local` still `NEXT_PUBLIC_SITE_URL=https://ryanrealty.vercel.app` despite task #8 marked complete → server CAPI stamps a host mismatch that degrades Meta match quality; GTM-WV6R4NZ5 is published-but-empty dead weight.

---

## 2. Root-Cause Deep Dives (the owner's two loudest pains)

### (a) WRONG-CITY / MISSING IMAGES

**Precise mechanism — three stacked failures, not one bug:**

1. **The hero fallback never carries a per-city photo.** `app/cities/[slug]/page.tsx:147` sets `heroImageUrl = cityMeta?.hero_image_url ?? null`. The `cities` table has **exactly one row (Bend) with `hero_image_url = NULL`**, so `getCityMetadataByName` (`lib/data/cities/getCityMetadata.ts:33`) returns `null` for *every* city. Line 331-335 only passes a `photo` prop when `heroImageUrl` is truthy — so for 100% of city pages no photo is passed, and `HeroBlock` falls through to its hardcoded `DEFAULT_PHOTO = '/brand/hero/hero-old-mill-master-4k.jpg'` (`components/site/HeroBlock.tsx:79-80,92`). That's the Bend Old Mill drone shot on Redmond, Sisters, Sunriver, etc. *(Note: the page's alt text at line 333 is already dynamic — `Aerial view of ${cityName}, Oregon` — but it's never reached because no photo prop is passed; HeroBlock's fixed Old Mill alt is what renders.)*

2. **The community/neighborhood pool the resolver *does* read is poisoned.** `getGeoTileImages` (`lib/data/media/getGeoTileImages.ts:39-58`) selects `approval='approved'` rows that `overlaps('geo_tags', tags)` and routes "scenic" ones via an `isScenic(subject_tags)` check. A bulk **"Drive ingest"** registered an entire Drive folder as `type='photo'`, `approval='approved'`, blanket-stamped `subject_tags=[landscape,exterior]` on every row, and tagged geo by *source-folder name*. Result: ~46% of the pool is 1080×1920 PNG video/stat-card frames and Ryan Realty logos (`stacked_logo_white_600.png`, `s10_hoa.png`, `s02_median_price.png`) that all pass `isScenic`. `pickGeoImage` is deterministic and sound — its **input is junk**.

3. **Even clean JPGs are geo-mislabeled.** Geo tags came from folder name, not the photo's actual subject. Tumalo Falls (near Bend) sits in a `sisters` folder → tagged `[sisters]` → served as the Black Butte Ranch tile. So a "correct-tag" pick still depicts the wrong place.

**Exact fix (files + approach):**

- **Stop the bleeding (data):** Quarantine contaminated rows immediately —
  `UPDATE asset_library SET approval='quarantined' WHERE search_query LIKE 'Drive ingest:%' AND (file_url ILIKE '%.png' OR search_query ~* '(logo|stacked|hoa|median|luxury|snapshot|chart|_price|concession|runner|climb|sport|skier)');`
  **First** find and disable the ingest job (it may be a recurring cron — open question; a re-run undoes the quarantine).
- **Add provenance columns (data):** `ALTER TABLE asset_library ADD COLUMN geo_verified boolean DEFAULT false, ADD COLUMN depicts text;` Then `getGeoTileImages` adds `.eq('geo_verified', true)` and excludes `.png`/portrait aspect.
- **Curated hero per geo (code + images):** Add `public/brand/hero/<city>.jpg` (redmond-smith-rock, sisters-cascade-ave, sunriver-village, …) and a `CITY_HERO` slug→{src,alt,credit} map. In `app/cities/[slug]/page.tsx` resolve `heroImageUrl = cityMeta?.hero_image_url ?? CITY_HERO[slug]?.src ?? null` and **never** let a non-Bend page reach the Bend default. Wire the same verified-pool path for Bend neighborhoods (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:242-245`, which currently hardcodes Old Mill for every neighborhood — IMG-05).
- **Community heroes (data):** For the 8 communities already covered by `lib/geo-images.ts` curated LP photos, nothing changes (they work). For the 6 Bend-fallback communities (incl. broken-top), add one hand-verified photo each rather than drawing from the city pool.

**Gate that makes it permanent:** extend the existing `ci:geo-imagery` gate (already in `ci:gates`) with `scripts/check-geo-hero.mjs` + `scripts/check-asset-pool.mjs`:
- FAIL if any non-Bend canonical city slug resolves to `hero-old-mill-master-4k.jpg`, or to a file whose `geo_verified` tag ≠ page slug.
- FAIL if any `approved`/`type='photo'` geo-tagged row is a `.png`, is portrait (`height>width`), matches the junk regex, or shares `subject_tags=[landscape,exterior]` across >50 rows (the blanket-ingest signature).
- FAIL if `geo_verified` is missing on any asset used by a live city/community/neighborhood page.

### (b) LISTING VIDEOS NOT EMBEDDING

**Precise mechanism.** `lib/data/videos/getListingVideos.ts` has a 3-tier resolver. **Tier 1** (`listing_videos` table) = **0 rows**. **Tier 2** (`video_tours_cache`) = refreshed today but **0 listings** in both scopes, because its refresh seeds from the empty `listing_videos` table (`fetchListingsWithVideos → getRecentListingVideoRows` → no keys → `[]`). So **100% of traffic falls to Tier 3** (raw `listings.details.Videos` JSONB) — the one path with the bug. At line 175-182 the URL is derived as:
```
MediaURL ?? VideoURL ?? Url ?? (ObjectHtml ? extractIframeSrc(ObjectHtml) : null)
```
`extractIframeSrc` (line 45) only matches `<iframe ... src="...">`. In this MLS, `MediaURL/VideoURL/Url` are empty (0/200 sampled) and **~49% of `ObjectHtml` values are bare provider URLs** (Dropbox folder share, Aryeo video page) — not iframe HTML. The regex misses → returns `null` → video silently dropped. `classifyVideo` already knows how to embed aryeo/vimeo/youtube/matterport/.mp4, but **the bare URL never reaches it.** The failure is invisible because `app/listing/[listingKey]/page.tsx` wraps the call in `.catch(() => [])` (VID-04), and `ListingHero` renders an empty `videos[]` identically to "no media."

**Exact fix (files + approach):**

- **`lib/data/videos/getListingVideos.ts` Tier 3 (the core fix):** when `ObjectHtml` does **not** contain `'<iframe'`, treat it as the candidate URL directly:
  ```js
  const oh = typeof vid.ObjectHtml === 'string' ? vid.ObjectHtml.trim() : null;
  const url = vid.MediaURL || vid.VideoURL || vid.Url
    || (oh && oh.includes('<iframe') ? extractIframeSrc(oh) : oh) || null;
  ```
  Run the result through existing `lib/video-embed.ts` helpers (`parseListingVideoEmbedForTile` for YouTube/Vimeo/Matterport bare URLs, `isDirectListingVideoFileUrl` → `embedType:'video-tag'` for .mp4/.mov). Normalize Dropbox shares to a raw stream (`?raw=1` / `dl.dropboxusercontent.com`) or skip if unplayable (Cross Keys is a *folder* share — may need re-hosting; open question).
- **Bump the cache key** `['listing-videos-v3', …]` → **`v4`** (line 208) so the ~514 listings cached with empty arrays re-fetch.
- **VID-03 guard:** classify `mapright.com/.../embed` as `kind:'map'`, exclude from the walkthrough-video hero (else a parcel map renders as "the listing video" — accuracy violation).
- **VID-02 cache decouple:** reseed `video_tours_cache` from the same `details.Videos`/`has_virtual_tour` signal using the hardened extractor, asserting `>0` before write.
- **VID-04 observability:** in `getListingVideos`, when `details.Videos` is non-empty but 0 embeds resolve, `console.warn`/Sentry-breadcrumb the `listingKey` + unparseable `ObjectHtml` shape.

**Gate:** `lib/video-embed.test.ts` cases asserting an Aryeo bare URL and a YouTube watch URL both yield a non-empty `VideoEmbed`; a `mapright` URL is tagged non-video. Extend the existing **`ci:route-smoke`** gate: `GET /homes-for-sale/madras/0-hwy-97-220198205` and `/la-pine/52255-huntington-220192924` must contain `aspect-video` or an embed iframe. Add a data-quality count: listings with `details.Videos.length>0` resolving to `[]` must stay ≈0.

---

## 3. Prioritized Fix Register

| ID | Issue | Sev | Owner | Fix | Gate (verifiable check) |
|----|-------|-----|-------|-----|-------------------------|
| **— NOW: broken / data-accuracy / blocking —** |
| IMG-01 | Every non-Bend city hero = Bend Old Mill photo | Critical | code | `CITY_HERO` map + resolver `?? CITY_HERO[slug]` in `app/cities/[slug]/page.tsx`; never fall to Bend default | `check-geo-hero.mjs`: no non-Bend slug resolves to `hero-old-mill-master-4k.jpg` |
| IMG-03 | asset_library pool ~46% PNG frames/logos | Critical | data | Quarantine Drive-ingest junk; disable the ingest job first | `check-asset-pool.mjs`: 0 approved photos matching junk regex / `.png` / portrait |
| IMG-02 | Stat-slide PNG is the `/communities/broken-top` hero | Critical | data | Exclude non-photo assets; verified per-community photo | Live: each `/communities/<slug>` hero is `image/jpeg`, `width≥height` |
| IMG-04 | Geo tags wrong (Tumalo Falls = Black Butte/Sisters) | High | data | Add `geo_verified`+`depicts`; manual re-verify; `getGeoTileImages.eq('geo_verified',true)` | `check-asset-pool.mjs`: every page-used asset has `geo_verified=true`; snapshot pins slug→file_url |
| VID-01 | 49% listing videos dropped (bare-URL ObjectHtml) | Critical | code | Treat non-iframe ObjectHtml as URL → `classifyVideo`; bump cache key v3→v4 | route-smoke: both flagship listings render `aspect-video`/iframe; unit test on Aryeo+YT URLs |
| VID-02 | Both cron video feeds empty → 100% on buggy path | High | code | Reseed `video_tours_cache` from `details.Videos`+hardened extractor | Post-cron assert `homeCount>0 && hubCount>0`; DB invariant `jsonb_array_length(listings)>0` |
| ANL-03 | Stale `vercel.app` `NEXT_PUBLIC_SITE_URL` → CAPI host mismatch | Med | data | Set apex in Vercel **prod** + repo `.env.local`; redeploy | CI: fail if any committed env/config contains `vercel.app`; runtime warn if `siteUrl host ≠ request host` |
| **— NEXT: SEO + quality —** |
| ANL-02 | Meta Pixel absent pre-consent on all pages | High | code | Load base pixel for all; `fbq('consent','revoke')`→`grant` on opt-in (match GA4 Consent Mode) | Playwright: fresh visit fbq absent + GA4 'denied'; after Accept-All, PageView fires to graph.facebook.com/tr |
| ANL-01 | GTM-WV6R4NZ5 published but EMPTY | High | code | Remove `GTMHead/GTMBody` + unset env (lower risk; pixel/GA4 already hardcoded) | `check-analytics-tags.mjs`: fail if `gtm.js` returns `"tags":[]` while env set |
| VID-03 | MapRight parcel maps would render as "the video" | Med | code | Classify mapright `kind:'map'`; own labeled block, not hero | Unit: mapright-only Videos entry not returned as walkthrough video |
| VID-04 | Tier-3 failures swallowed by `.catch(()=>[])` | Med | code | Structured warn when `Videos.length>0` but 0 embeds | Data-quality count of non-empty-Videos→[] thresholded ≈0 |
| IMG-05 | All Bend neighborhood heroes hardcoded Old Mill | Med | code | Per-neighborhood verified photo over CLEAN pool; generic alt | `check-geo-hero.mjs`: >1 distinct neighborhood ≠ identical src; no landmark alt mismatch |
| **— LATER: polish —** |
| ANL-04 | GA4 linker lists dead `ryanrealty.vercel.app` + maybe dead subdomains | Low | code | Prune to live first-party hosts in `GoogleAnalytics.tsx:150` | Unit: every linker domain resolves to a live first-party host |
| ANL-05 | Marketing checkbox pre-checked vs CPRA/GDPR | Low | code | Counsel review; default marketing=false if required | Playwright lock of intended consent behavior |

---

## 4. Analytics + Indexing Status (concrete yes/no)

| Item | Status | Detail / Fix |
|------|--------|--------------|
| **Meta Pixel deployed?** | **YES** (id `1546878946032105` baked into prod bundle) | But **NO** in initial HTML — consent-gated (ANL-02). Fix: consent-mode-style load for all, grant on opt-in. |
| **Meta Pixel covering all visitors?** | **NO** | Pre-consent/declined visitors invisible to Meta. Caps retargeting, raises CPMs. |
| **Conversions API (CAPI) live?** | **YES** | `/api/meta-capi` 204 preflight, correct CORS, 202-char token, SHA-256 PII hashing, shared `event_id` dedup wired on every lead path. Healthy. |
| **CAPI host match correct?** | **AT RISK** | Server stamps `event_source_url` from stale `vercel.app` env (ANL-03). Fix: flip to apex in Vercel prod, verify browser+server share `event_id` AND host in Events Manager. |
| **GA4 live?** | **YES** | `G-ST40W4WM6T` loaded all pages, Consent Mode v2 correct (defaults denied, `wait_for_update:500`, `url_passthrough`, `ads_data_redaction`). Healthy. |
| **GTM functioning?** | **NO** | `GTM-WV6R4NZ5` published but EMPTY (`"tags":[]`). Dead weight + misleading. Fix: remove it (option b). |
| **Sitemap?** | **VERIFY** | Open item #11 (sitemap soft-404). Gate: sitemap entries return 200, not redirect/skeleton. |
| **Robots?** | **VERIFY** | Confirm `robots.txt`/`metadata.robots` allows indexing on apex, references sitemap. |
| **Google-indexing-ready?** | **AT RISK** | The `/homes-for-sale/listing/<key>` rewrite returns a skeleton shell on direct fetch; real pages are the canonical `/{city}/{address}-{mls}`. Audit any sitemap/internal links/ad destinations pointing at `/listing/<key>` and repoint to canonical so crawlers/first-paint aren't degraded. |

---

## 5. Image Sourcing Plan (beautiful + ACCURATE per-geo)

**Ladder (highest accuracy first):**
1. **Existing curated asset library** — the 8 verified golf/resort LP photos in `lib/geo-images.ts` (Tetherow, Pronghorn, Eagle Crest, Crosswater, Awbrey Glen, Widgi Creek, Brasada, Sunriver) are correct and already render before the contaminated pool. Keep, never regress.
2. **Source the canonical set by hand** — only ~11 cities + ~14 resort communities + Bend neighborhoods need one verified hero each (small, finite). Pull a *specific* image of the *actual place*, in priority order: **Wikimedia Commons** (best license clarity) → **Unsplash/Pexels** (free, attribution recorded) → **Shutterstock/iStock** (only with an active sub at publish time; note Old Mill `iStock-1330945786` requires active sub per CLAUDE.md). Targets: Redmond → downtown / Smith Rock-adjacent; Sisters → Cascade Ave with the Three Sisters; Sunriver → the Village/SHARC; Black Butte Ranch → ranch + Black Butte.
3. **Record provenance per asset** — populate new `depicts` ("Downtown Sisters, Cascade Ave — verified") + `geo_verified=true` + source URL + creator + license. No asset is trusted until a human confirms `depicts` matches the slug.

**Quarantine, don't trust, the bulk dump.** The Drive-ingest rows are guilty until proven innocent. Quarantine the junk (IMG-03 SQL), eyeball-verify the surviving JPGs, ban blanket auto-approval going forward — `register()` must set real `type`, real `subject_tags`, and a verified per-asset geo.

**The gate that stops a wrong-city image from ever shipping again** (`scripts/check-asset-pool.mjs` + `scripts/check-geo-hero.mjs`, wired into the existing `ci:geo-imagery` step of `ci:gates`, enforced by the re-armed pre-push hook):
- Every asset used by a live geo page **must** have `geo_verified=true`.
- No `.png` / portrait-aspect / junk-regex / blanket-tagged asset can be `approved`.
- For each canonical city slug, the rendered hero `src` must be a `geo_verified` file whose tag == the slug, and **must not** be `hero-old-mill-master-4k.jpg` unless the slug is `bend`.
- Snapshot pins each canonical slug→`file_url` so any re-tag/regression fails code review.

---

## 6. "Dominate" Upgrades (highest-leverage, beyond bug fixes)

Each ties to a gate so quality can't silently rot.

1. **Per-listing video coverage as a moat.** Once VID-01 ships, ~514 dormant videos light up — including the $48.56M/$21M flagships. Zillow-Showcase-style autoplay heroes on luxury listings are a direct ranking + dwell-time win competitors lack. **Gate:** route-smoke asserts video presence on flagship listings; data-quality keeps non-empty-Videos→[] at ≈0.

2. **`RealEstateListing` + `VideoObject` structured data on every listing.** A `ci:ai-structured-data` gate already exists — extend it to require valid `RealEstateListing` JSON-LD with `price`, `geo`, and (when present) `VideoObject` (`contentUrl`, `embedUrl`). Wins rich results + AI-answer citations across Central Oregon. **Gate:** JSON-LD validates and price/geo match the DB row (accuracy-tied).

3. **Verified geo hero + unique copy per city/community/neighborhood.** Once images are accurate, every geo page has a *real* photo of *that* place + a stat band. Pair with unique intro copy (the `ci:brand-voice` gate already guards tone). Distinct hero + distinct copy = no thin/duplicate-content penalty across 11 cities + 14 communities + Bend neighborhoods. **Gate:** `check-geo-hero.mjs` distinct-hero check + brand-voice gate.

4. **Symmetric Meta + GA4 coverage to lower paid CAC.** Fixing ANL-02 (pixel for all visitors) + ANL-03 (host-matched CAPI) materially grows the retargeting pool and improves Event Match Quality — directly lowering CPMs on the paid campaigns funding "domination." **Gate:** Playwright PageView-fires test + a Meta Events Manager confirmation that one real seller-LP submission produces matched browser+server Lead events sharing `event_id` AND host.

5. **Sitemap + canonical hygiene for full indexability.** Resolve the soft-404 (#11) and repoint any `/listing/<key>` references to canonical so 100% of listing inventory is crawlable as full pages, not skeletons. **Gate:** sitemap entries return 200 full HTML (not redirect/skeleton); no internal link or sitemap entry points at the `/listing/<key>` rewrite form.

---

### Files referenced (absolute paths)
- `/Users/matthewryan/RyanRealty/app/cities/[slug]/page.tsx` (hero null-fallback, lines 147, 331-335)
- `/Users/matthewryan/RyanRealty/app/cities/[slug]/[neighborhoodSlug]/page.tsx` (hardcoded Old Mill hero, 242-245)
- `/Users/matthewryan/RyanRealty/components/site/HeroBlock.tsx` (`DEFAULT_PHOTO`, 79-80, 92)
- `/Users/matthewryan/RyanRealty/lib/data/cities/getCityMetadata.ts` (33)
- `/Users/matthewryan/RyanRealty/lib/data/media/getGeoTileImages.ts` (39-58, `isScenic`)
- `/Users/matthewryan/RyanRealty/lib/geo-images.ts` (`communityImage` 112, `pickGeoImage` 133)
- `/Users/matthewryan/RyanRealty/lib/data/videos/getListingVideos.ts` (Tier-3 URL derivation 170-182, `extractIframeSrc` 45, cache key 208)
- `/Users/matthewryan/RyanRealty/lib/video-embed.ts` (`parseListingVideoEmbedForTile`, `isDirectListingVideoFileUrl`)
- `/Users/matthewryan/RyanRealty/app/listing/[listingKey]/page.tsx` (`.catch(()=>[])` swallow)
- `/Users/matthewryan/RyanRealty/components/GoogleAnalytics.tsx` (linker domains 150, consent defaults)
- `/Users/matthewryan/RyanRealty/components/CookieConsentBanner.tsx` (pre-checked 77-78) · `/Users/matthewryan/RyanRealty/components/MetaPixel.tsx` (consent gate)
- `/Users/matthewryan/RyanRealty/app/lp/seller-home-value/actions.ts` (siteUrl 24, CAPI fetch 426, eventSourceUrl 436)
- `/Users/matthewryan/RyanRealty/.env.local` (line 4 still `vercel.app` — task #8 not actually closed)
- Gate hooks: `/Users/matthewryan/RyanRealty/package.json` (`ci:gates` line 65 — extend `ci:geo-imagery`, `ci:route-smoke`, `ci:ai-structured-data`), `/Users/matthewryan/RyanRealty/.husky/pre-push` (re-armed 2026-05-30)

**One thing to fix in your task tracker:** Task #8 ("Flip NEXT_PUBLIC_SITE_URL to apex") is marked **completed** but `.env.local:4` still reads `https://ryanrealty.vercel.app` — reopen it and confirm Vercel **production** env before the CAPI host mismatch is considered resolved.
