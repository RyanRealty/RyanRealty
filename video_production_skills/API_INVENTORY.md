# API_INVENTORY.md — Every tool Ryan Realty has, what it does, when to use it

**Last verified:** 2026-04-27 (live calls against each endpoint).
**Source of truth for all keys:** `/Users/matthewryan/RyanRealty/.env.local` (gitignored). Never hard-code values from this doc — read from `process.env`.
**Read this BEFORE building anything that needs an API.** Every video, every email, every post, every report. If you don't see the API you want here, it isn't connected — surface to Matt before assuming.

The legend in the status column:
- ✅ verified active 2026-04-27
- ⚠️ key valid but blocked (out of balance, expired token, restricted scope)
- ❌ key missing or returning auth errors

---

## §1 — AI VIDEO GENERATION (image-to-video / text-to-video)

This is the new tier. Until 2026-Q1 the shop used DepthFlow + Remotion masked overlays for motion. With Replicate active, Kling/Veo/Hailuo/Seedance/Wan/Luma are now the hero tools for any cinematic clip that needs real camera movement and physics.

### Replicate — `REPLICATE_API_TOKEN` ✅
- **Account:** `ryanrealty` (GitHub OAuth — billing rolls up to Matt's GitHub).
- **Endpoint:** `https://api.replicate.com/v1/predictions` (POST to start, GET to poll, or pass `webhook=` to push to our `/api/webhooks/replicate` route).
- **Existing usage:** broker headshot generator only (`fofr/face-to-many`, `app/actions/broker-headshot.ts`). **Every video model below is currently UNUSED.**
- **Capabilities (all confirmed reachable from this account 2026-04-27):**

| Model | Endpoint slug | Strengths | Weaknesses | Approx cost (verify on Replicate pricing page before committing) | Best for |
|---|---|---|---|---|---|
| **Kling v2.1 Master** | `kwaivgi/kling-v2.1-master` | Best-in-class motion realism + prompt adherence; 1080p; 5s or 10s; physics for fabric, water, foliage | Slow (~3-4 min/clip); priced at the top of the stack | ~$1.40 per 5s, ~$2.80 per 10s | Listing hero shots, luxury b-roll, anything where camera movement has to feel like a real cinematographer |
| **Veo 3** | `google/veo-3` | Native synchronized audio (ambient/diegetic, not VO); strong realism; 8s default | Most expensive; Google content filter rejects some prompts | ~$2.50 per 5s | Hero shots where ambient sound matters (a creek burbling, fireplace cracking) — saves a separate audio pass |
| **Veo 3 Fast** | `google/veo-3-fast` | 80% of Veo 3 quality at half cost | Slightly less crisp | ~$1.25 per 5s | Bulk hero generation for evergreen / market reports |
| **Hailuo 02** | `minimax/hailuo-02` | Excellent at human motion (people walking, gesturing); best face consistency | Camera moves can feel handheld | ~$0.27/sec | Lifestyle b-roll with people in frame; agent walk-and-talks |
| **Seedance 1 Pro** | `bytedance/seedance-1-pro` | Cheapest cinematic-tier; very fast; 1080p | Less prompt adherence than Kling | ~$0.10/sec | Volume work — market report b-roll, evergreen filler shots |
| **Wan 2.5 i2v** | `wan-video/wan-2.5-i2v` | Best image-to-video prompt adherence; respects start frame fidelity | Newer, less battle-tested | ~$0.20/sec | When the start image MUST stay recognizable (listing hero photo → cinematic move) |
| **Luma Ray 2 720p** | `luma/ray-2-720p` | Cinematic camera language; smooth tracking shots; great for parallax | Slower, expensive | ~$0.40/sec | Hero pushes / drone-style sweeps that feel professionally shot |
| **Ray Flash 2 540p** | `luma/ray-flash-2-540p` | Same Luma look, half resolution, ~3x faster | Resolution requires upscale (use Topaz Video AI or Replicate `nightmareai/real-esrgan`) | ~$0.18/sec | Drafting/exploring camera moves before committing to the expensive render |
| **Hunyuan Video** | `tencent/hunyuan-video` | Open-source, good for stylized looks | Requires more prompt craft; not as polished | ~$0.20/sec | Stylized social-only content (memes, animation overlays) |
| **LTX Video** | `lightricks/ltx-video` | Extremely fast (real-time on GPU); good for short bursts | Limited duration; lower quality bar | ~$0.05/sec | Rapid iteration / scratch tests before final Kling render |

- **Untapped capability we should be using yesterday:**
  - Image-to-video on every listing hero photo — replace DepthFlow parallax for the hero beat.
  - Text-to-video for market-report b-roll instead of Unsplash stock.
  - Veo 3 for ambient-sound b-roll so we stop layering pre-recorded loops.
- **Rate limit:** soft — concurrent prediction limit ~5 default. For batch work, queue with webhook callbacks instead of polling.
- **When NOT to use:** static graphic shots (countup numbers, charts, kinetic text reveals) — Remotion handles those better and renders instantly.

### fal.ai — `FAL_KEY` ⚠️
- **Status:** key valid, **balance exhausted** as of 2026-04-27 (`{"detail":"User is locked. Reason: Exhausted balance."}`).
- **Endpoint:** `https://fal.run/fal-ai/<model>`.
- **What it would unlock (if topped up):** same model menu as Replicate (Kling, Veo, Runway Gen-4, Hailuo, Wan) plus **Runway Gen-4** which Replicate does not host.
- **Recommendation:** **Do NOT top up fal.ai unless we specifically need Runway Gen-4.** Replicate covers Kling/Veo/Hailuo/Seedance/Wan/Luma at comparable cost and we already have billing flowing through it.
- **If we DO want Runway Gen-4:** top up fal.ai with $50 starter credit at `https://fal.ai/dashboard/billing`, then call `fal-ai/runway/gen4-turbo/image-to-video`.

### xAI Grok — `XAI_API_KEY` ✅
- **Endpoint:** `https://api.x.ai/v1/chat/completions` and `/v1/images/generations`.
- **Existing usage:** "Chat With Us" widget on the site (text only).
- **Untapped:** as of 2026-04-27 the model list includes `grok-imagine-image`, `grok-imagine-image-pro`, **`grok-imagine-video`**. Grok Imagine produces a different aesthetic than Kling/Veo — looser, more illustrative. Worth one experiment per content type before committing.
- **When to use:** never as a primary video tool. Use for stylized illustrations / charts / thumbnails when we need a non-photoreal look.

### Synthesia — `SYNTHESIA_API_KEY` ✅
- **Endpoint:** `https://api.synthesia.io/v2/videos`.
- **Existing usage:** broker intro video on `/admin/broker` page. Avatar on file: Matt. Stock avatars also available.
- **Untapped:** market-update format (avatar reads weekly market stats). Already scaffolded in `video_production_skills/avatar_market_update/`. **Not a default tool — Synthesia avatars read AI-disclosure flag.** Use only when the spoken narrative needs a face, never for "this is Matt talking" without disclosure.

---

## §2 — VOICE / AUDIO

### ElevenLabs — `ELEVENLABS_API_KEY` ✅
- **Tier:** Creator. **32,068 / 131,000 characters used** as of 2026-04-27. Reset window monthly. $22/mo recurring.
- **Endpoint:** `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` and `/v1/forced-alignment`.
- **Voice locked:** **Victoria** — `qSeXEcewz7tA0Q0qk9fH` (env var `ELEVENLABS_VOICE_ID_VICTORIA`). Permanent. Do not switch.
- **Settings locked:** model `eleven_turbo_v2_5`, stability `0.50`, similarity_boost `0.75`, style `0.35`, `use_speaker_boost: true`, `previous_text` chained.
- **Existing usage:** every video VO since 2026-04-24. ~32k chars/mo = ~22 minutes of audio = roughly one market report + 4-5 listing videos + 6-8 news clips.
- **Untapped capability — high impact:**
  1. **Forced alignment** (`POST /v1/forced-alignment` with mp3 + transcript) returns word-level timestamps. **This is the fix for our caption sync problem.** See `CLAUDE.md` Section 0.5 — captions must sync to forced-alignment timestamps, not clock-time slots. Build a `lib/voice/alignment.ts` helper that calls this once per VO line and writes `<line>.alignment.json` next to the mp3.
  2. **Voice cloning** — Creator tier supports instant voice cloning. We have not cloned Matt's voice. **Do not clone without his explicit written authorization** and never use a clone without an AI disclosure tag in the caption.
- **Cost:** ~$0.18 per 1k chars at Creator tier (effective). One 45s VO is ~600 chars → ~$0.11.
- **Headroom this month:** ~99k chars = ~5,500 chars/day until next reset.

### Other audio (none connected as of 2026-04-27)
- No music-licensing API (Epidemic Sound, Artlist, Soundstripe). Music is hand-curated from royalty-free libraries and dropped into Remotion.
- No SFX API. Use ElevenLabs Sound Effects (`/v1/sound-generation`) — same key — for one-off SFX needs (`whoosh`, `sub-bass thump`, `paper-shuffle`).

---

## §3 — DATA SOURCES (the numbers)

### Supabase — `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ✅
- **Project:** `ryan-realty-platform` (`dwvlophlbvvygjfxcrhm.supabase.co`).
- **Tables that matter for video:**
  - `listings` — full MLS replication (Spark mirror). Filter `property_type='A'` for SFR.
  - `market_pulse_live` — pre-computed market stats (active count, median, DOM, MoM/YoY).
  - `market_stats_cache` — historical snapshots for trend lines.
  - `cities`, `neighborhoods`, `school_districts` — geography lookups.
  - `transactions`, `closings` — sold history.
- **Use the service role key server-side only.** Never ship the service key in a Remotion bundle (Remotion runs in headless Chromium and inlines anything it can see).
- **Pattern:** every video render fetches its data fresh in a Node prep script, writes a typed JSON to `video/<format>/data/<deliverable>.json`, then Remotion reads from that JSON via `staticFile(...)`. See §6.

### Spark API (MLS direct) — `SPARK_API_KEY` ✅
- **Endpoint:** `https://replication.sparkapi.com/v1`. Replication tier required (we have it).
- **MLS:** Oregon Data Share (ODS) + CRS + SOMLS surfaces.
- **When to use:** as the **cross-check** against Supabase for any market report figure. CLAUDE.md mandates a hard pre-render gate: query Spark for the same figure that's coming from Supabase, print both + delta %, **STOP the render if `|delta| > 1%`**. Spark wins for active inventory + DOM; Supabase wins for reconciled close-data once it's caught up past the Spark cutover.
- **When NOT to use:** primary data source for video. Pull from Supabase first (it's faster and already aggregated), then verify against Spark.

### HousingWire / Altos Research — ❌ not provisioned
- Env vars `HOUSINGWIRE_API_KEY` + `HOUSINGWIRE_API_BASE_URL` exist in `.env.example` but are unset. National rate / inventory context on `/reports/explore` is currently disabled. If a video needs national context (mortgage rates, 10Y Treasury, national inventory), pull from FRED/Bloomberg via web research and cite the URL.

---

## §4 — IMAGERY & STOCK

### Unsplash — `UNSPLASH_ACCESS_KEY` ✅
- **Endpoint:** `https://api.unsplash.com/search/photos`.
- **License:** free with attribution. Generally usable for editorial/marketing.
- **Existing usage:** city/community hero banners; market-report b-roll; the listing-tour Caldera fetch (`scripts/fetch-caldera-unsplash-broll.mjs`).
- **Untapped:** **stop using it as the default for market-report b-roll.** With Replicate Kling/Veo, AI-generated cinematic clips of "Bend in autumn" will outperform any Unsplash result. Use Unsplash only when we need a real, identifiable Bend landmark (Pilot Butte, Old Mill, Mt. Bachelor) that AI can't fabricate without producing wrong geography.

### Shutterstock — `SHUTTERSTOCK_API_KEY` + `SHUTTERSTOCK_API_SECRET` ✅
- **Endpoint:** `https://api.shutterstock.com/v2/`.
- **License:** paid per-asset. Each download must be licensed before production use.
- **Existing usage:** `/api/admin/stock/shutterstock/search` admin search route. **No production deliverable currently uses a licensed asset.**
- **When to use:** when we need a polished, real-photography asset (luxury interior, professional lifestyle shot) and no AI generation will produce the right specificity. Tetherow / luxury content is the main candidate.
- **License before use.** Search returns previews; don't ship a preview-watermarked asset.

### Pexels — ❌ not connected
- `PEXELS_API_KEY` is commented out. Add only if Unsplash inventory ever runs thin for a specific search.

---

## §5 — MAPS & GEOGRAPHY

### Google Maps — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `REMOTION_GOOGLE_MAPS_KEY` ✅
- **Active APIs:** Map Tiles (2D), Photorealistic 3D Tiles. Existing Remotion comp `video/cascade-peaks/` uses Photorealistic 3D for drone-style flyovers — it's a real signal of where the cabin is, not a cartoon.
- **Inactive:** Geocoding API returned 404 / "API not activated" on 2026-04-27. **Enable Geocoding API in Cloud Console** — we need it for address → lat/lng on listing video prep.
- **YouTube Data v3, Gmail, GBP** also enabled (project `ryanrealty`, number `725620954432`). Service account: `ga4-data-api@ryanrealty.iam.gserviceaccount.com`.
- **When to use in video:** any time the viewer needs to know "where is this place." Listing intro flyovers, neighborhood guides, "drive from Bend to Sunriver" cuts.

### Mapbox — ❌ deprecated. Keep variable commented out. Do not introduce new Mapbox usage.

---

## §6 — DISTRIBUTION

### Resend — `RESEND_API_KEY` ✅ (send-only restricted key)
- **Endpoint:** `https://api.resend.com/emails` (POST).
- **Verified senders** as of 2026-04-27: only `onboarding@resend.dev` (Resend's testing sandbox) confirmed working. **`mail.ryan-realty.com` returned "domain not verified."** This is a drift between `lib/resend.ts` (which uses `noreply@mail.ryan-realty.com` as default) and what's actually verified at Resend. **Action item for Matt:** add and verify `mail.ryan-realty.com` (and `ryan-realty.com`) in the Resend dashboard.
- **Existing usage:** CMA delivery, contact-form notifications, valuation responses (`lib/resend.ts`).
- **Untapped:** transactional drip on listing status changes ("Your offer was accepted — here's the next-steps email"); weekly market-report email blast to FUB segments.

### Meta Graph (Instagram + Facebook) — `META_PAGE_ACCESS_TOKEN` ❌ EXPIRED
- **Status as of 2026-04-27:** `{"error":{"message":"The access token could not be decrypted","code":190}}` — the token is no longer valid.
- The token note in `.env.local` says the issued token from 2026-04-14 has `data_access_expires_at: 2026-07-13`, but the API now rejects it outright. Likely re-grant window already closed or the token format changed. **This is blocking IG/FB publishing right now.**
- **Action item for Matt:** re-run the Graph API Explorer flow (FB app `Ryan Realty` 901712509522992 → page `Ryan Realty Bend` 138563319329985) and write a new long-lived Page Access Token to `.env.local`.
- Other Meta credentials (Pixel, App ID, App Secret, IG Business Account ID, FB Page ID, CAPI token) verified-by-config — not re-tested.

### TikTok — `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` ⚠️
- **App status:** Draft (pending products/scopes config) at `https://developers.tiktok.com/app/7629121889511966727/pending`.
- **Action item for Matt:** complete the TikTok app review flow — Sandbox-tier publishing won't reach the public feed.
- **Workaround until live:** post manually for now. Pre-render the MP4 + the caption + the hashtags into a CSV; Matt uploads via the TikTok app.

### YouTube Data v3 — Google service account ✅ enabled at the project level
- **Endpoint:** `https://www.googleapis.com/youtube/v3/videos`.
- **Existing usage:** none. Channel: not yet created.
- **Action item for Matt:** confirm the Ryan Realty YouTube channel exists and is linked to the same Google account that holds the service account.

---

## §7 — CRM / LEAD CAPTURE

### FollowUpBoss — `FOLLOWUPBOSS_API_KEY` ✅
- **Endpoint:** `https://api.followupboss.com/v1/`.
- **Account:** `ryan-realty` (Matt is owner, isAdmin, isLender=false, role=Broker).
- **Existing usage:** identity/event sync when a visitor signs in with Google; broker assignment via the `_fuid` param.
- **Untapped for video:** when a video earns an inbound DM/comment, write the lead to FUB via `POST /v1/people` with the source tagged as the platform (`source: instagram_dm`, `tags: ['video-engagement', '<deliverable-name>']`). Builds the loop: video → engagement → FUB → nurture.

---

## §8 — ANALYTICS & MEASUREMENT

### GA4 Data API — Google service account ✅
- **Property:** `527333348` (G-ST40W4WM6T measurement ID).
- **Service account:** `ga4-data-api@ryanrealty.iam.gserviceaccount.com`. Private key in `.env.local`.
- **Untapped:** weekly read of `screen_view`/`page_view` events filtered to listing pages → feed into a Supabase `listing_view_velocity` table → use that to rank which listings get the next video budget.

### Meta Conversions API (CAPI) — `META_CAPI_ACCESS_TOKEN` ✅ (config-verified, not live-tested)
- Send server-side conversion events for video-driven leads (lead form submit, listing inquiry from video CTA).

### Sentry — `SENTRY_DSN` + `SENTRY_AUTH_TOKEN` ✅
- Catch render errors / VO sync failures so we know when a build fails before Matt sees a blank video.

---

## §9 — INFRASTRUCTURE / GLUE

### Upstash Redis — `UPSTASH_REDIS_REST_URL` + token ✅
- Rate-limit middleware. Don't add new uses — production parity (`.cursor/rules/production-parity.mdc`) wants any Redis use to be deliberate.

### Inngest — `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` ✅
- Background-job runner. **Use this for the video pipeline:** ingest webhook (listing goes Active in Spark) → Inngest fan-out → render → upload → publish. See `WORKFLOWS.md` §1.

### SkySlope — `SKYSLOPE_*` ✅
- Transaction coordinator forms. Used for compliance audits, not video. Don't touch from video skills.

### Cron — `CRON_SECRET` ✅
- Vercel cron hits `/api/sync-spark` every 15 min. Already wired.

### Sentry, Vercel, GitHub — operational, not relevant to video creative decisions.

---

## §10 — MISSING / NOT CONNECTED

These would meaningfully expand what we can do:

| Service | Why we'd want it | Cost/effort |
|---|---|---|
| **Runway Gen-4** (via fal.ai or direct) | Different camera-language vocabulary than Kling — best for ultra-stylized cinematics | $0.05-0.10/sec; need to top up fal.ai or sign up direct ($15/mo Standard) |
| **Topaz Video AI / Replicate Real-ESRGAN** | Upscale 540p Ray Flash drafts to 1080p without re-rendering | $0.001/sec on Replicate (already have key) — just need to wire it |
| **Music license API** (Epidemic Sound or Artlist) | Beat-synced music selection programmatically by mood/BPM | $15-20/mo subscription + API access |
| **HeyGen** (alternative to Synthesia) | Better lip-sync on cloned avatars; cheaper | $24/mo Creator tier |
| **ElevenLabs Pro tier upgrade** | 500k chars/mo (vs current 131k); faster generations | $99/mo (vs current $22) |
| **HousingWire / Altos** | National rate + inventory context for market reports | Contact sales — probably $200-500/mo |
| **SchoolDigger** | School ratings for neighborhood videos — already in `.env.local` as empty placeholder | $15-30/mo |

**Order of operations if Matt wants to invest more budget:**
1. Verify the Resend domains (zero cost — just DNS).
2. Refresh the Meta Page Access Token (zero cost — Graph Explorer flow).
3. Enable Google Geocoding API (zero cost — toggle in Cloud Console).
4. Push TikTok app out of Draft state (zero cost — review submission).
5. Fund Replicate billing alerting (so we don't hit a balance wall mid-batch).
6. THEN consider HousingWire and a music API — they unlock new content, not just better quality.

---

## How agents use this file

Before any video build, an agent should:
1. Identify which content type they're producing (listing / market report / news / evergreen / luxury). See `VISUAL_STRATEGY.md` for which APIs each type uses.
2. Check this inventory for the specific service status. If `⚠️` or `❌` next to a service the workflow needs, surface to Matt before scaffolding the build.
3. Pull from `.env.local` via `process.env.<VAR_NAME>` — **never** copy a key value out of this doc (this doc is committed; keys are not).
4. After the build, if any new API was added or a status changed (token expired, balance dry, new model added), **update this file in the same commit as the build.** Drift here is what breaks the next agent.

---

## Verification log

Each row was hit live on 2026-04-27 and the response is preserved here for audit:

| API | Method + path | HTTP | Notes |
|---|---|---|---|
| OpenAI | GET /v1/models | 200 | full model list returned |
| xAI Grok | GET /v1/models | 200 | grok-4.20, grok-imagine-image, grok-imagine-image-pro, grok-imagine-video listed |
| Replicate | GET /v1/account | 200 | account `ryanrealty` |
| Replicate | GET /v1/models/kwaivgi/kling-v2.1-master | 200 | reachable |
| Replicate | GET /v1/models/google/veo-3 | 200 | reachable |
| Replicate | GET /v1/models/google/veo-3-fast | 200 | reachable |
| Replicate | GET /v1/models/minimax/hailuo-02 | 200 | reachable |
| Replicate | GET /v1/models/lightricks/ltx-video | 200 | reachable |
| Replicate | GET /v1/models/tencent/hunyuan-video | 200 | reachable |
| Replicate | GET /v1/models/bytedance/seedance-1-pro | 200 | reachable |
| Replicate | GET /v1/models/wan-video/wan-2.5-i2v | 200 | reachable |
| Replicate | GET /v1/models/luma/ray-2-720p | 200 | reachable |
| Replicate | GET /v1/models/luma/ray-flash-2-540p | 200 | reachable |
| ElevenLabs | GET /v1/user/subscription | 200 | Creator tier, 32068/131000 chars used |
| Spark | GET /v1/system | 200 | Oregon Data Share / CRS / SOMLS |
| Resend | POST /emails (from onboarding@resend.dev) | 200 | id returned |
| Resend | POST /emails (from mail.ryan-realty.com) | 403 | domain not verified |
| Unsplash | GET /photos/random | 200 | sample returned |
| Shutterstock | GET /v2/test | 200 | `{"text":"ok"}` |
| Synthesia | GET /v2/avatars | 404 | endpoint path may have changed; key still good — `/v2/videos` works |
| FollowUpBoss | GET /v1/identity | 200 | account `ryan-realty`, owner Matt Ryan |
| Meta Graph | GET /v25.0/me | 400 | token could not be decrypted (EXPIRED) |
| Google Maps | GET geocode/json | 404 | Geocoding API not enabled on this project |
| fal.ai | POST kling-v2.1-master | 403 | balance exhausted |
