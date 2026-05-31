All load-bearing claims verify against the live code:

- **GSC route** (lines 7-8): doc-comment literally says "pulls yesterday only" — single-day window confirmed. `dateIter` + `upsertMetricRows` (idempotent) confirmed, so a rolling re-pull is safe.
- **loop-health-check** (lines 44-56): `.select('fetched_at')` and `hours < 30 ? 'green'` — confirmed it grades recency only, never value. Note line 86 *does* check `performance:total_rows > 0` but never per-channel value sums.
- **sitemap.ts** (lines 111-125): cities are derived from listing rows (`row.cities?.name`) then `.filter(isCentralOregonCity)` — confirmed it emits nothing when inventory-derived cities are empty; it does NOT seed from the canonical city list. The recent commit `41805ff` scoped it to Central Oregon but kept the inventory-derived source.
- **seller-lead-attribution** (lines 39, 119): flat `SELLER_TAGS` set matched against `p.tags`; `utmSource` captured (line 56) but unused for crediting — confirmed.

I have enough verified ground truth. Writing the action plan now.

I have everything I need. The audits are accurate to the live code. Here is the action plan.

---

# Ryan Realty — Growth Action Plan
**Maximize traffic (AI · Search · Social · Profiles) → continuously self-improve traffic → leads**
Repo: `/Users/matthewryan/RyanRealty` (canonical; git HEAD `427c5fb`) · Live: https://ryan-realty.com · Supabase `dwvlophlbvvygjfxcrhm` · Date 2026-05-31

---

## 1. Verdict

| Channel | Firing? | Single biggest unlock |
|---|---|---|
| **Search / GSC** | **Partial** | Stop the zero-tail corruption: the GSC ingest pulls *yesterday-only* inside Google's 2-3 day processing delay, so it writes zeros and never re-pulls. Real data is sitting in the API right now. Change to a rolling 7-day re-pull + backfill 5/12–5/30. |
| **AI / AEO** | **Partial** | Production side is the strongest channel in the audit (full JSON-LD, FAQ, Dataset, AI crawlers allow-listed, CI gate G34). But there is **zero AI measurement** — no AI-referral classifier and no citation monitoring. Stand up `marketing-snapshot-aeo`. |
| **Social** | **No** | The publish bridge is dead end-to-end: visual producers defer to `scripts/render-worker.mjs`, which is wired to **nothing** (not `vercel.json`, not `package.json`, no launchd). `content_performance` = 0 rows ever. Schedule a renderer + emit `publish_payload`. |
| **Profiles** | **Partial** | GBP is claimed/optimized/instrumented and fresh. But the **24 five-star reviews are never harvested** into the `reviews` table → `aggregateRating` rich snippet is dead on every broker page. Zillow/Realtor.com/NAR have zero integration. Build the Google→Supabase review writer. |
| **Self-improving loop** | **Partial (open at 3 hops)** | `content_performance` is empty → measurement, attribution, and learning can never fire. The keystone is the **publish hop**: content rows go `killed`/`in_production`, never `approved`, so `publisher-sweep` stays idle forever. |

### Top 5 highest-leverage moves overall (ranked by traffic→lead impact)

1. **Fix the publish hop (LOOP-02 / SOC-02/03).** Schedule `render-worker.mjs`, make every producer emit a gate-complete `publish_payload`, and let rendered rows land at `status='approved'`. This single fix re-energizes four downstream stages (measure → attribute → learn → act) and turns on 8-10 platform fan-out. *Gate: `content_performance` gains ≥1 row/day within 72h.*
2. **Repair GSC + backfill (GSC-01/02).** Rolling 7-day re-pull, one-time backfill `?startDate=2026-05-12&endDate=2026-05-30`, add a value-aware health probe. Restores the entire Search channel's eyes. *Gate: account-scope impressions sum over trailing 7 days > 0.*
3. **Enroll the 7,524 Seller Prospects (LOOP-04).** A warm seller list (expired/FSBO/out-of-state) sits in fully-built but empty FUB nurture plans; `fub-outreach-execution` isn't scheduled. Highest-ROI lever, zero new ad spend. *Gate: ≥90% of Seller Prospects in an Active plan within 7 days.*
4. **Harvest GBP reviews → light up `aggregateRating` (PROF-01).** 24 five-star reviews never reach the `reviews` table; star snippets in SERPs lift CTR on every broker page and feed AI answers. *Gate: `reviews` table > 0 rows; `aggregateRating` JSON-LD present on `/team/matthew-ryan`.*
5. **Put the city tier in the sitemap + own the brand SERP (GSC-04/07).** `/cities/*` pages have best-in-class schema but **zero** of them are in `sitemap.xml`; seed from `lib/central-oregon.ts`. Then get "ryan realty" from pos 21.9 → #1 via Organization schema + GBP linkage. *Gate: sitemap contains 1 entry per known city; brand term reaches page 1.*

---

## 2. The self-improving growth loop — where it's broken, and the minimal wiring to close it

### The intended closed loop
```
        ┌──────────────────────────────────────────────────────────────────────────┐
        │                                                                            │
        ▼                                                                            │
  (A) SNAPSHOT every channel daily ─► (B) WAREHOUSE fresh ─► (C) BRAIN diagnoses ──► (D) RANKED ACTIONS
  snapshot-channels 0 12 * * *        marketing_channel_daily   generate-briefs +      marketing_brain_actions
  ga4│gsc│gbp│meta│li│x│tt│yt          + content_performance     performance-bias                │
        ▲                                                                                          ▼
        │                                                                              (E) PRODUCE / PUBLISH
        │                                                                              producer-runtime → render-worker
  (H) FEED NEXT CYCLE ◄── (G) ATTRIBUTE to leads ◄── (F) MEASURE in content_performance  → publisher-sweep → /api/social/publish
   performance-bias        seller-lead-attribution    measurement-loop          + GBP posts + GSC content producer
   biases next briefs      → north_star_attributed_seller_leads (NORTH STAR)
```

### Exactly where it's broken today (4 severed edges)

- **E — PRODUCE/PUBLISH is severed (keystone).** `producer-runtime/route.ts:198-214` defers every visual producer to `render-worker.mjs`, which is scheduled **nowhere** (confirmed: absent from `vercel.json` and `package.json`). Rows rot `in_production`. Even if rendered, **no producer SKILL emits a `publish_payload`** (grep = 0), and `/api/social/publish` hard-requires a `GateArtifacts` object with `humanApprovedAt ≤ 7 days` or returns 400. Net: **0 content posts have ever published; `content_performance` = 0 rows, ever.**
- **F — MEASURE has no input.** `content_performance` empty → `measurement-loop.ts` has nothing to score; `north_star_attributed_seller_leads` (a column, hardcoded 0 at `publisher-sweep:231`) never increments.
- **G — ATTRIBUTE can never fire.** Two independent breaks: (i) no `content_performance` rows to match against; (ii) `seller-lead-attribution/route.ts:39` uses a flat `SELLER_TAGS` set (`seller`, `hot-seller`…) that matches **zero** real FUB people — live FUB uses `stage='Seller Prospect'` (7,524) + namespaced `intent:*` tags. `utmSource` is captured (line 56) but never read for crediting, so GBP/Zillow/Realtor leads are uncreditable.
- **C/H — LEARN runs blind, and the WATCHDOG is silent.** `performance-bias.ts` / `getFormatPerformance` soft-fail to no-op on 0 rows, so the brain proposes from defaults every cycle. `loop-health-check` grades channels by `fetched_at` recency only (`route.ts:44-54`, `hours<30=green`) — **never by value** — so 19 days of all-zero GSC data reported GREEN. `marketing_decisions` is 17 days stale; the watchdog writes nothing.

### Minimal wiring to close the loop (in dependency order)

1. **Schedule a renderer (E).** Add a launchd agent on the Mac render box running `scripts/render-worker.mjs` every 15-30 min (or move to a GitHub Actions runner with Remotion+Chromium the cloud can drain). *Without an always-on renderer, no visual content reaches `ready`.*
2. **Emit `publish_payload` (E).** Add a mandatory `publish_payload` output contract to every producer SKILL (`platforms[]`, `mediaUrl`, `captionPerPlatform`, `hashtagsPerPlatform`, full gate object). Have `render-worker.mjs` assemble the gate from artifacts it already verifies (`scorecard.json`, `citations.json`, `qa_report`, `postflight`, `manifesto`) and write it to `executor_response.publish_payload` when flipping to `ready`.
3. **Per-format standing approval (E).** Add a per-format `auto_publish_until` policy so `publisher-sweep` can stamp a compliant `humanApprovedAt` for low-risk evergreen/news/market-snapshot formats; keep listing/market-data posts on the human gate.
4. **Make `content_performance` the single source of truth (F).** `publisher-sweep` already inserts one row per platform on publish — once (1-3) land, rows flow automatically. Add a CI gate asserting `executed content:*` rows carry `executor_response.published_posts`.
5. **Fix attribution taxonomy + add channel-level credit (G).** Replace flat `SELLER_TAGS` with `stage='Seller Prospect'` + `intent:*`; stamp `utm_content=action_id` at lead capture; read `utmSource` to credit `gbp`/`zillow`/`realtor`/`ai_referral` as first-touch even when no content piece matches. Create the `north_star_attributed_seller_leads` rollup.
6. **Make the watchdog real + value-aware (C/H).** In `loop-health-check`, add per-channel `MAX(value)`/sum probes: flag **red** if GSC account-impressions sum over trailing 7 stored days = 0, if `content_performance` gains 0 rows in 7 days while approved rows exist, if `marketing_decisions` goes >48h without a row, or if `snapshot-channels ok_count < 10`. Alert Matt on any red.

**Once these six land, edge H reconnects automatically:** `performance-bias` biases next-cycle briefs toward measured winners, and the loop compounds.

---

## 3. Per-channel maximization plan

### Search / GSC
| Move | Owner | Gate / metric |
|---|---|---|
| Rolling 7-day re-pull in `marketing-snapshot-gsc` + backfill 5/12–5/30 (`upsertMetricRows` is idempotent) | **Agent (code)** | Trailing-7-day account impressions sum > 0 |
| Value-aware health probe in `loop-health-check` (red if 7-day sum = 0) | **Agent (code)** | GSC turns red when zero, not green |
| Point `seo-gsc-sitemap-submit.mjs` at `/sitemap.xml` only; `sitemaps.delete` the 3 dead WordPress feeds (all 404) | **Agent (code)** + owner clicks | 0 sitemaps registered that 404 |
| Seed `app/sitemap.ts` cities from `lib/central-oregon.ts` (not listing-derived) + `ci:seo-routes` assertion | **Agent (code)** | 1 sitemap entry per known city |
| GSC→content producer: striking-distance (pos 8-20), high-impr/zero-click (title/meta rewrites), impressions-with-no-page (content gaps) → `marketing_brain_actions` | **Agent (code)** | ≥5 GSC-derived actions/week |
| Own brand SERP: Organization/RealEstateAgent schema + `sameAs` + GBP linkage + `/reviews` + `/about` | **Owner (config/content)** | "ryan realty" → page 1, then #1 |
| Set `GOOGLE_SEARCH_CONSOLE_SITE_URL` in Vercel + `.env.local`; longer-term add SA to `sc-domain` property | **Owner (config)** | Env var set; no hardcoded-default dependency |
| Request indexing for top ~50 money pages | **Owner (GSC dashboard)** | Top pages indexed within 7 days |

**Split:** Agent ships all code (cron window, health probe, sitemap seeding, GSC producer). Owner does dashboard-only acts (delete dead sitemaps, set env var, request indexing, brand-entity copy on /about + /reviews).

### AI / AEO
| Move | Owner | Gate / metric |
|---|---|---|
| `marketing-snapshot-aeo` cron: 20-40 fixed Central Oregon prompts vs Perplexity API + OpenAI web-search + (Serp) Google AI Overviews; record citation share-of-voice vs Zillow/Redfin/competitors → `channel='aeo'` | **Agent (code)** | Weekly SOV row written; baseline captured |
| AI-referrer classifier in `ga4-report.ts` (domain set: chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai…); raise `topSources` cap 8→50; emit `channel='ai_referral'` | **Agent (code)** | AI-source rows appear in warehouse |
| Add `buildMarketFaq` + `Dataset` to `/homes-for-sale/[city]` (currently lacks both, vs `/cities/*` which has them); extend G34 gate to cover it | **Agent (code)** | G34 covers homes-for-sale; FAQPage present |
| Definitive-local-facts Q&A corpus (Sunriver vs Tetherow, best Bend neighborhoods, Deschutes taxes/closing costs) with Article+FAQPage | **Owner (content) + agent** | ≥20 comparison/guide pages live, in llms.txt |
| Add `geo:{lat,lng}` + `containedInPlace='Deschutes County'` to Place schema; add `citation`/`isBasedOn`/`measurementTechnique` to Dataset | **Agent (code)** | Every city/community page emits geo + provenance |
| Rewrite `llms.txt` (fix `/reports`→`/housing-market`, add NAP/license/areas-served block, link top-10 city Dataset pages) + add `llms-full.txt`; CI assert every URL = 200 & in sitemap | **Owner (content) + agent** | CI passes; all llms.txt URLs 200 |
| Feed AEO SOV → `marketing_brain_actions`: low-citation query auto-generates a `content:*` action | **Agent (code)** | Uncited target query → backlog item |

**Split:** Agent owns all measurement + schema. Owner writes the entity paragraph (the verbatim facts AI engines quote) and approves the Q&A corpus topics.

### Social
| Move | Owner | Gate / metric |
|---|---|---|
| Schedule `render-worker.mjs` (launchd every 15-30 min) | **Owner (config)** / agent writes the plist | Rows advance `in_production`→`ready` |
| `publish_payload` + gate contract on every producer SKILL | **Agent (code)** | `publisher-sweep` stops logging "absent" |
| Per-format standing-approval policy (`auto_publish_until`) | **Agent (code) + owner sets window** | ≥1 auto-published evergreen post |
| Default `platforms[]` = all connected (8-10) per render → fan-out | **Agent (code)** | 1 render ≥ 8 posts |
| Connect Pinterest / Threads / Nextdoor OAuth (tables empty; profiles already in `sameAs`) | **Owner (config)** | 3 new `*_auth` rows |
| Mandatory UTM-tagged `ryan-realty.com` deep link in captions + single tracked bio link | **Agent (code) + owner sets bio link** | 100% of posts carry a tracked URL |
| 30-day launch burst from `public/v5_library` + cadence floor (TikTok/IG/FB Reels 1/day, Shorts 3-5/wk, X 1-2/day) | **Owner (content) + agent** | Cadence floor met 30 days running |
| Debug `marketing-snapshot-meta-ads` (12 days stale — token/ad-account) | **Owner (config/data)** | meta_ads ≤ 30h fresh |
| `format_performance` view → brain biases toward top-quartile hooks | **Agent (code)** | Brain proposals reference measured winners |

**Split:** Owner does OAuth connects, schedules the renderer, sets the bio link + approval windows, and approves the launch-burst calendar. Agent ships the payload contract, fan-out, caption/UTM enforcement, and the performance view.

### Profiles
| Move | Owner | Gate / metric |
|---|---|---|
| Google→Supabase review-sync writer (`v4/.../reviews` → `reviews` table; resolve broker_id) | **Agent (code)** | `reviews` > 0; `aggregateRating` JSON-LD live |
| Closed-transaction → review-request cron (email+SMS, direct Google link) | **Agent (code)** | 3-5 new reviews/month; total ≥ 25 |
| Claim + optimize Zillow + Realtor.com profiles for all 3 brokers (NAP, headshots, UTM backlink); pipe their reviews into same `reviews` table | **Owner (content)** | 3 broker profiles claimed, reviews syncing |
| NAR find-a-realtor + per-broker profiles (Paul, Rebecca) | **Owner (content)** | Profiles live + linked |
| Enable Google Business messaging; diagnose 0 call_clicks vs 850 quarterly impressions | **Owner (config)** | conversations > 0; call_clicks > 0 |
| Schedule `gbp-media-refresh` in `vercel.json`; 2-3×/week GBP post cron (incl. video + 5-7 Q&A) | **Owner (config) + agent** | Posted in last 7 days = PASS |
| Channel-level attribution: credit `utm_source=gbp/zillow/realtor` first-touch | **Agent (code)** | Profile-sourced leads surfaced in digest |
| Fix 24/7 hours, malformed founding date, add 3rd category (single PATCH calls) | **Owner (config)** | Completeness score up |

**Split:** Agent builds the review writer, review-request cron, attribution, and schedules `gbp-media-refresh`. Owner claims Zillow/Realtor.com/NAR (cannot be done from code), enables messaging, fixes GBP profile fields.

---

## 4. Immediate actions (this week)

### Owner — in dashboards (cannot be done from code)
1. **GSC:** Confirm the apex URL-prefix property; submit `https://ryan-realty.com/sitemap.xml`; **delete** the 3 dead WordPress sitemaps (`sitemap_index.xml`, `page-sitemap.xml`, `post-sitemap.xml` — all 404); URL-Inspect → Request Indexing for homepage, `/homes-for-sale`, top 10 city + community pages.
2. **Vercel env:** Set `GOOGLE_SEARCH_CONSOLE_SITE_URL=https://ryan-realty.com/`.
3. **Zillow / Realtor.com / NAR:** Claim agent + brokerage profiles for Matt, Paul, Rebecca; consistent NAP (115 NW Oregon Ave Suite #2, Bend OR 97703-1002; FUB number 541-703-3095); UTM backlink to ryan-realty.com; headshots.
4. **GBP:** Turn on Business Messaging; add a 3rd secondary category; fix the 24/7 hours and the malformed founding date.
5. **Social OAuth:** Run first-time connects for **Pinterest**, **Threads**, **Nextdoor** (all auth tables empty). Diagnose the stale **meta_ads** token/ad-account.
6. **Renderer:** Approve a launchd agent (or a render box) so `render-worker.mjs` runs continuously.

### Agent — ship in code
1. `marketing-snapshot-gsc`: switch to rolling 7-day re-pull; run backfill `?startDate=2026-05-12&endDate=2026-05-30`.
2. `loop-health-check`: add value-aware probes (GSC 7-day sum, content_performance freshness, decisions heartbeat, `ok_count<10`).
3. `app/sitemap.ts`: seed cities from `lib/central-oregon.ts`; add `ci:seo-routes` assertion.
4. `seo-gsc-sitemap-submit.mjs`: set `SITEMAPS=['https://ryan-realty.com/sitemap.xml']`; add `sitemaps.delete` for the 3 dead feeds.
5. Add `vercel.json` cron for `fub-outreach-execution` (hourly) → bulk-enroll the 7,524 Seller Prospects via `applyActionPlan`, segmented by `intent:*`.
6. `publish_payload` + gate contract on every producer SKILL; `render-worker` assembles the gate; per-format standing-approval so `publisher-sweep` fires.
7. Google→Supabase review-sync writer → `reviews` table.
8. Attribution fix: `stage='Seller Prospect'` + `intent:*`; read `utmSource` for first-touch channel credit; create `north_star_attributed_seller_leads` rollup.
9. AI-referrer classifier in `ga4-report.ts` (cap 8→50, `channel='ai_referral'`).

---

## 5. North-star + KPI tree

### North star (the one metric)
**Attributed seller leads** — FUB people at `stage='Seller Prospect'` (+ `intent:*`) credited to a channel/content piece via `north_star_attributed_seller_leads`. This is what the brain optimizes against; everything else is a leading indicator. *Today it is structurally 0 (empty `content_performance` + mismatched tag taxonomy) — make it computable first, then optimizable.*

```
                          ★ ATTRIBUTED SELLER LEADS ★
                          (FUB Seller Prospects, by channel/content)
        ┌───────────────────────┬───────────────────────┬───────────────────────┐
        ▼                       ▼                       ▼                       ▼
     SEARCH                    AEO                    SOCIAL                  PROFILES
        │                       │                       │                       │
  impressions ─►          AI citation ─►          posts published ─►       GBP impressions ─►
  CTR (clicks) ─►          share-of-voice ─►       reach/engagement ─►      review count/velocity ─►
  avg position ─►          ai_referral sessions ─► social-referral ─►       call_clicks ─►
  brand-term rank ─►       (chatgpt/perplexity…)   clicks (UTM) ─►          conversations ─►
  indexed pages            cited-URL count         format_perf (top-Q)      website_clicks (utm_source)
        │                       │                       │                       │
        └─────────────► all converge on tracked site clicks ──────────► FUB lead created ──► attributed seller lead
```

### Per-channel leading indicators the brain reads (each is now a warehouse column)
- **Search:** trailing-7-day impressions (must be > 0 — the corruption gate), CTR on pos 8-20 queries, brand-term position (21.9 → target #1), count of striking-distance queries pushed to page 1.
- **AEO:** citation share-of-voice on the 20-40 prompt set, `ai_referral` sessions, cited-URL count vs Zillow/Redfin.
- **Social:** posts published/day (floor enforced), platforms-per-render (target 8-10), UTM site clicks/post, top-quartile format×hook×platform by attributed leads.
- **Profiles:** review count + velocity (≥3/mo), GBP call_clicks (currently 0 — alert at 14 days flat), conversations (enable messaging), `utm_source=gbp/zillow/realtor` lead credit.

### How improvement becomes automatic
Every indicator above is written daily/weekly into `marketing_channel_daily` + `content_performance`. `generate-briefs` + `performance-bias` read trailing-30-day performance and tilt next-cycle production toward top-quartile (format × platform × topic) **ranked by attributed seller leads**, and `loop-health-check` (now value-aware) flags any channel that ingests but produces zero signal. Weekly: auto-promote winners, auto-suppress bottom-quartile. **The loop self-improves the moment edges E→F→G→H reconnect — and the keystone is the publish hop.**
