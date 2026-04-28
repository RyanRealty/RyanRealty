# WORKFLOWS.md — Step-by-step build pipeline per content type

**Read this first when you start a video build.** Every format has a numbered sequence below. Do the steps in order. Don't skip the data verification or the quality gate. Don't commit before Matt approves the MP4.

Pair this with:
- `VISUAL_STRATEGY.md` — what the video should look like.
- `API_INVENTORY.md` — which tools are up, what they cost, when they're down.
- `VIDEO_PRODUCTION_SKILL.md` — the underlying skill (frame-by-frame specs, full scorecard math).
- `CLAUDE.md` §0 (data accuracy) and §0.5 (captions) — outrank every step below if there's a conflict.

---

## §1 — LISTING VIDEO WORKFLOW

**Trigger:** A listing goes Active in Spark API, OR Matt requests a video for a specific MLS#.

### Step 1: Pull the listing data fresh
- Query Supabase `listings` table by MLS#. Capture: `address`, `city`, `state`, `zip`, `list_price`, `bedrooms`, `bathrooms`, `living_area`, `lot_size`, `year_built`, `property_type`, `subtype`, `status`, `mls_number`, `latitude`, `longitude`, `list_date`, `photos[]` (ordered).
- Cross-check against Spark API (`/v1/listings/{ListingKey}`). Any field that disagrees by more than 0 cents on price, more than 1 sqft on living area, halts the build until reconciled.
- Write `video/listing-tour/data/<mls>.json` with the verified payload + a `verification_trace` block listing each field's source.

### Step 2: Tier the listing (decides the visual template)
- Price ≥ $1.5M OR address contains "Tetherow" OR lot ≥ 1 acre with view → **Tetherow/luxury template** (see §5 of `VISUAL_STRATEGY.md`).
- Otherwise → **standard listing template**.
- Document the tier decision in `video/listing-tour/data/<mls>.json` under `tier`.

### Step 3: Photo prep
- Pull the top 12 photos in MLS-published order (or `display_order` if available). Filter: skip floor plans, skip photos with watermarks, skip exterior-back-of-house if there's a better front shot.
- For each photo, classify with GPT-4o Vision (`OPENAI_API_KEY`): `exterior_front`, `exterior_back`, `kitchen`, `living`, `primary_bedroom`, `bathroom`, `view`, `detail`. This drives beat ordering.
- Pick 6-8 photos for the BEATS array: 1 hero exterior, 1 secondary exterior, 1 kitchen, 1 living, 1 primary suite, 1 view (if applicable), 1 detail (architectural feature, fireplace, custom millwork). The cold-open beat is the hero exterior.

### Step 4: Generate AI cinematic clips (this is the new step — no longer DepthFlow)
- For each photo selected in Step 3, call **Replicate Kling v2.1 Master** image-to-video:
  ```
  POST https://api.replicate.com/v1/predictions
  Authorization: Token $REPLICATE_API_TOKEN
  {
    "version": "<latest from /v1/models/kwaivgi/kling-v2.1-master>",
    "input": {
      "prompt": "<beat-specific camera-language prompt — see §1.4.A below>",
      "start_image": "<signed Supabase URL of the listing photo>",
      "duration": 5,
      "aspect_ratio": "9:16",
      "negative_prompt": "warped geometry, distorted faces, text artifacts, cartoon, oversaturated"
    },
    "webhook": "https://ryan-realty.com/api/webhooks/replicate"
  }
  ```
- Tier downgrade order if Kling fails or times out: Wan 2.5 i2v → Hailuo 02 → Seedance 1 Pro. (See `API_INVENTORY.md` §1.)
- Save each rendered MP4 to `video/listing-tour/ai-clips/<mls>/beat<N>.mp4`. Save a thumbnail at `video/listing-tour/ai-clips/<mls>/beat<N>.thumb.jpg`.
- Estimated cost: 6-8 Kling clips × $1.40 = **$8.40-$11.20 per listing**. Verify Replicate balance before kicking off.

#### §1.4.A — Camera-language prompts (use these literally)
- **Exterior wide:** `"slow cinematic push-in, drone-style aerial perspective settling at eye-level, golden hour, deep shadow detail, sharp focus on architectural lines"`
- **Exterior detail:** `"slow vertical reveal, camera tilts up from foundation detail to roofline, late afternoon light"`
- **Kitchen:** `"slow push-in through doorway into kitchen, parallax depth on island and cabinetry, natural window light, sharp on countertop, blurred background"`
- **Living room:** `"slow ceiling-down-to-eye-level reveal, settling on hearth or main seating area, soft daylight"`
- **Primary suite:** `"slow horizontal pan, parallax on bed and window framing, neutral daylight, calm pacing"`
- **View shot:** `"slow camera dolly forward through window or doorway, parallax depth on foreground furniture, focus pulls to mountain or water view in distance"`
- **Detail beat:** `"macro slow push-in on architectural detail, shallow depth of field, warm soft lighting"`

### Step 5: VO script + ElevenLabs render
- Write a 45s VO script. Two-clause sentences max. Hook in line 1 (specific element: address number + lot size, or street + view, or price + acreage).
- Banned words check (see VISUAL_STRATEGY.md §6).
- Render with **Victoria** voice (`qSeXEcewz7tA0Q0qk9fH`), settings locked: `eleven_turbo_v2_5`, stability 0.50, similarity 0.75, style 0.35, `use_speaker_boost: true`. Chain `previous_text` across lines.
- Save to `video/listing-tour/vo/<mls>.mp3`.
- **Run forced alignment** (`POST https://api.elevenlabs.io/v1/forced-alignment` with `audio` + `text`). Save the word-level timestamp JSON to `video/listing-tour/vo/<mls>.alignment.json`. Captions read from this. (CLAUDE.md §0.5 — hard rule.)

### Step 6: Scaffold the BEATS array in Remotion
- Open `video/listing-tour/src/comps/ListingTour.tsx`. The BEATS array is the source of truth for the render. Each beat is `{id, type, durationFrames, src, overlayText, overlayKind, transition}`.
- Ordering: cold-open hero (exterior wide, 90 frames / 3s), secondary exterior (60 frames), kitchen (60 frames), living (60 frames), primary suite (60 frames), view if applicable (75 frames), detail (60 frames), price reveal (90 frames), stat strip (75 frames), end card with logo (60 frames).
- Total: 12-13 beats, ~45-48s. Trim if over 50s.

### Step 7: Layer overlays
- Address ribbon: bottom zone `<CaptionSafeZone>`, AzoSans 56px, navy 70% pill, gold 2px top border, fades in over 12 frames at beat 1.
- Price reveal at the 50% mark: Amboqia 96-144px, gold, springs in over 18 frames.
- Stat strip at 75%: AzoSans 56px, four pills (beds / baths / sqft / lot).
- Caption (VO): kinetic word-by-word via `<KineticCaptions>` component reading from `<mls>.alignment.json`. Active word color shift navy → gold + scale 1.0 → 1.08 spring.

### Step 8: Render to scratch
```
cd listing_video_v4
npx remotion render src/index.ts ListingTour out/<mls>.mp4 \
  --codec h264 --concurrency 1 --crf 22 \
  --image-format=jpeg --jpeg-quality=92 \
  --props='{"mls":"<mls>"}'
```
- Output is gitignored under `out/`. Do NOT copy to `public/v5_library/` yet.

### Step 9: Quality gate
- ffprobe duration in [30s, 60s].
- ffmpeg blackdetect strict (`pix_th=0.05`) returns ZERO sequences.
- Frame at 0s, 25%, 50%, 75% extracted. Visually confirm: motion at 0s, register change at 25%, pattern interrupt at 50%, kinetic reveal in final 15%.
- Banned-words grep across captions, VO script, source pills.
- Every on-screen number traces to a citation row.
- File size < 100MB.
- Caption sync — visual scrub: every word lights up at the moment Victoria says it.

### Step 10: Viral scorecard
- Score 1-10 in each of 10 categories (`VIRAL_GUARDRAILS.md` §3). Listing video minimum **85**. Tetherow/luxury minimum **88** (raise the bar — different audience).
- Write `out/<mls>/scorecard.json` with the rubric and total.

### Step 11: Citations file
- Write `out/<mls>/citations.json`. One entry per number on screen: `address`, `list_price`, `bedrooms`, `bathrooms`, `living_area`, `lot_size`, `mls_number`. Each entry: `source: "Supabase listings"` + filter + value + `fetched_at_iso` + Spark cross-check value + delta.

### Step 12: Show Matt
- Output the `out/<mls>.mp4` path.
- Output the scorecard summary (total + per-category scores).
- Output the citations summary.
- **STOP. Wait for explicit approval ("ship it" / "approved" / "push" / "go").** Do not commit. Do not push.

### Step 13: Commit + push (only after approval)
- Copy `out/<mls>.mp4` to `listing_video_v4/public/v5_library/listing_<mls>.mp4`.
- `git add` only the MP4 + the citations.json + the scorecard.json.
- Commit message: `video(listing): <address> — <mls>`.
- Push to `origin/main` immediately.

### Step 14: Distribution queue
- Insert a row into `social_post_queue` (Supabase) with the deliverable path, scheduled platforms (TikTok, IG, FB), caption variants, hashtag set, and the scheduled publish time. The post-scheduler skill (`automation_skills/post_scheduler/`) picks it up.

---

## §2 — MARKET REPORT WORKFLOW

**Trigger:** 1st of each month (cron) for each geography (Bend, Redmond, Sisters, Tumalo, La Pine, Sunriver, Tetherow, Awbrey Butte). Or manual trigger when a stat threshold flips (months of supply crosses 4 or 6).

### Step 1: Pull market stats fresh from Supabase
- `SELECT * FROM market_pulse_live WHERE city = '<city>' AND property_type = 'A'`. Print row count + values.
- For YoY: same window, prior year. For YTD: Jan 1 → today, prior year same window.
- Compute months-of-supply: `active_listings / (closed_last_6_months / 6)`. Verify the math in the printout.

### Step 2: HARD PRE-RENDER GATE — Spark cross-check (CLAUDE.md §0)
- For every figure that exists in both Supabase and Spark (active count, median list, median sold, DOM, MoM/YoY change), query Spark:
  ```
  GET https://replication.sparkapi.com/v1/listings?$filter=City eq '<city>' and PropertyType eq 'A' and StandardStatus eq 'Active'&$top=0&$count=true
  ```
- Print BOTH values + delta % per figure.
- **STOP THE BUILD if `|delta| > 1%`.** Surface to Matt with the figure, both queries, both values, the delta, the suspected cause. Re-render only after Matt confirms the resolution. Document in `citations.json`.

### Step 3: Verdict classification
- Months of supply ≤ 4 → **Seller's Market** (red-orange `#D62828` pill).
- 4 < MoS < 6 → **Balanced Market** (gold `#D4AF37` pill).
- MoS ≥ 6 → **Buyer's Market** (green `#2E7D32` pill).
- The verdict pill that ends the video MUST match the months-of-supply number on screen. Re-check at quality gate.

### Step 4: AI b-roll generation (the upgrade from Unsplash stock)
- Generate 4-5 cinematic b-roll clips of the city with **Replicate Veo 3 Fast** (cheaper than Veo 3, native ambient audio):
  - Bend: `"slow drone-style sweep over Pilot Butte at golden hour, downtown Bend in the distance, Mt. Bachelor on the horizon, autumn light"`
  - Redmond: `"slow aerial pan over high-desert residential neighborhood, Smith Rock visible in the distance, late afternoon light"`
  - Sisters: `"slow drone push over Three Sisters mountains, ponderosa pine foreground, late afternoon"`
  - Tumalo: `"slow pan over Deschutes River canyon, basalt rim rock, golden hour, calm water"`
  - La Pine / Sunriver: `"slow drone sweep over ponderosa pine forest, snow patches, Newberry Crater on the horizon"`
- Save to `video/market-report/ai-broll/<city>/<beat>.mp4`. Estimated cost: 5 × ~$1.25 = $6.25 per report.

### Step 5: Data viz scaffolding (Remotion)
- Open `video/market-report/src/comps/MarketReport.tsx`. Each stat is its own beat:
  - Active count: kinetic countup (60 frames).
  - Median price: spring entrance, 75-frame hold (2.5s).
  - Months of supply: animated bar fills against threshold zones, 75-frame hold.
  - YoY change: arrow draws on, percentage springs in. Color by direction.
  - DOM: stat with mini line chart of last 6 months.
  - Verdict pill: final beat, springs in, 90-frame hold.

### Step 6: VO script + render + alignment
- Same as Listing Step 5, but the script is data-led, not lifestyle-led. 45-60s for market reports. Lead with the most directional number ("Median price in Bend is up $32,000 since January.").
- Save to `video/market-report/vo/<city>-<YYYYMM>.mp3` + `.alignment.json`.

### Step 7: BEATS array — interleave b-roll and data
- Cold open: city name (Amboqia 96px, springs in, 3s hold).
- Beat 1: AI b-roll #1 (3s) + first stat headline overlay.
- Beat 2: data viz — active count countup (2.5s).
- Beat 3: AI b-roll #2 (3s) + median price headline.
- Beat 4: data viz — median price reveal (2.5s).
- (continue alternating)
- Final beat: verdict pill (3s). End card.

### Step 8: Render to scratch (same as Listing Step 8 but composition `MarketReport`).

### Step 9: Quality gate (same as Listing Step 9, plus):
- Verdict pill matches months-of-supply number on screen.
- Every figure traces to Supabase + Spark cross-check rows in `citations.json`.

### Step 10-13: Same as Listing Steps 10-13.

---

## §3 — NEWS CLIP WORKFLOW

**Trigger:** A real news event (Fed rate decision, NAR settlement update, MLS antitrust news, state policy change, regional housing news). Production target: **within 24 hours** of the event.

### Step 1: Source the news
- Identify the event. Pull primary sources: official press release, Federal Reserve statement, NAR statement, court filing, news organization (AP, Reuters, Bloomberg, WSJ — never a syndicated re-write).
- Save the URLs + headline + key quotes to `video/news-daily/data/<slug>.json`.

### Step 2: Real-footage sourcing
- Search Shutterstock for licensed footage of the people, places, or events involved (`SHUTTERSTOCK_API_KEY` + `SHUTTERSTOCK_API_SECRET`):
  ```
  GET https://api.shutterstock.com/v2/videos/search?query=<query>&aspect_ratio=2:3&resolution=hd
  ```
- License each asset before download. Save to `video/news-daily/footage/<slug>/<asset>.mp4`. Document license IDs in `citations.json`.
- If Shutterstock has nothing, fall back to Unsplash for stills + Ken Burns motion.
- Last resort: AI-generated clip with explicit AI-VISUALIZATION caption tag.

### Step 3: Data extraction
- For any number in the news (rate decision, percentage change, dollar amount), capture the value + source URL.
- For market-impact analysis (e.g., "this means mortgages drop X bps"), pull current 30-yr from Bankrate/FRED if available — otherwise cite "as of <date>" and the source.

### Step 4: VO script
- 30-45s news cadence: hook line in 1.5s ("BREAKING: Fed cut rates 50 basis points."), context in 5s, implication for Bend/Central Oregon buyers in the back half.
- Banned-words check.
- Render with Victoria + alignment. Save to `video/news-daily/vo/<slug>.mp3`.

### Step 5: BEATS array
- Cold open: BREAKING badge (when warranted) + headline.
- Beat 1: real footage (2-2.5s) + source attribution.
- Beat 2: kinetic stat overlay (the number, big).
- Beat 3-5: alternating real footage + kinetic graphics.
- Beat 6: implication for the local market (e.g., "On a $700,000 Bend home, that's $185/mo less"). Stat reveal.
- Final beat: end card with logo.

### Step 6: Render + quality gate (same as Listing Steps 8-11).

### Step 7: Show Matt → approval → commit + push (same as Listing Steps 12-13).

### Step 8: Distribution
- News clips queue to TikTok + IG + FB + LinkedIn. NOT YouTube (news clips don't perform on YouTube and the algorithm punishes the channel for low-retention long-tail).
- Caption variant on LinkedIn: longer-form, broker POV. On TikTok/IG: 1-2 lines + hashtags.

---

## §4 — EVERGREEN EDUCATION WORKFLOW

**Trigger:** Matt picks a topic from the matrix (`VISUAL_STRATEGY.md` §4) OR an FAQ pattern emerges in DMs (3+ instances of the same question).

### Step 1: Topic dossier
- Write `video/evergreen-education/data/<topic-slug>.json` with: question, 3-bullet answer, sources (federal regs, NAR pubs, IRS, etc.), example calculation if applicable.

### Step 2: Hero illustration
- Generate 3 candidate stylized illustrations with **xAI Grok Imagine** (`grok-imagine-image-pro`) OR Replicate Stable Diffusion XL (`stability-ai/sdxl`):
  - Prompt format: `"stylized vector illustration, real estate <topic>, brand colors navy gold cream, minimalist, no text, friendly approachable feel"`
- Save candidates to `video/evergreen-education/illustrations/<slug>/`. Pick 1-2 for the build.

### Step 3: Optional AI cinematic — only if a beat needs it
- 1-2 short Kling clips at 5s each, used sparingly. (See VISUAL_STRATEGY.md §4 — evergreen should not lean heavily on AI cinematic.)

### Step 4: Data viz components
- Use the existing `<EvergreenExplainer>` Remotion comp. Pass `topic`, `hero_illustration`, `data_viz_component`, `vo_lines` as props.
- For data viz, prefer kinetic typography + animated formulas + line charts. Keep it whiteboard-feeling.

### Step 5: VO script + render + alignment
- 30-60s. Two-clause sentences. Banned-words check.
- Mid-tempo Victoria delivery (the locked settings work — don't override).

### Step 6: BEATS array
- Cold open: topic title (Amboqia 96px, 3s hold).
- Beat 1: hero illustration with topic question overlaid.
- Beat 2-N: definition card → example → formula → conclusion. Each beat 2.5-3s. Alternate illustration / data viz / occasional real footage clip.
- Final beat: 1-line takeaway + end card.

### Step 7: Render + quality gate + scorecard.

### Step 8: Show Matt → approval → commit + push.

### Step 9: Distribution
- Evergreen goes to YouTube (long-tail SEO) + TikTok/IG/FB (engagement) + LinkedIn (broker authority).
- Schedule for next available evergreen slot in the post queue (don't compete with new listings or breaking news for the same audience window).

---

## §5 — TETHEROW / LUXURY WORKFLOW

**Trigger:** A listing tier-classified as luxury in §1 Step 2 (price ≥ $1.5M, Tetherow address, or large-lot view property).

### Step 1-3: Same as Listing Steps 1-3.

### Step 4: AI cinematic — but with Luma Ray 2 720p as the hero, not Kling
- For each photo, generate with **Replicate Luma Ray 2 720p** (`luma/ray-2-720p`):
  ```
  POST https://api.replicate.com/v1/predictions
  {
    "version": "<latest from /v1/models/luma/ray-2-720p>",
    "input": {
      "prompt": "<luxury camera-language prompt — see §5.4.A below>",
      "start_image": "<signed Supabase URL>",
      "duration": 5,
      "aspect_ratio": "9:16"
    }
  }
  ```
- Estimated cost: 6 × ~$2 = $12 per luxury listing. Worth it.

### §5.4.A — Luxury camera-language prompts
- **Hero exterior:** `"slow cinematic drone push toward modern lodge home, larch siding, snow-covered spruce around it, magic hour blue light, smoke from chimney, calm pacing, professional cinematography"`
- **Drone view:** `"slow aerial sweep over property, golf course or mountain in background, late afternoon, deep shadow detail, no quick movements"`
- **Interior fireplace beat:** `"slow camera dolly through stone-and-wood great room toward lit fireplace, depth of field shifts, ambient evening light, calm pacing"`
- **Wine cellar / detail:** `"macro slow push-in on wine cellar door or architectural detail, shallow depth, warm tungsten light, professional cinematography"`

### Step 5: Optional Veo 3 for ambient-audio beats
- For 1-2 beats where ambient sound matters (creek, fireplace, snow falling), use **Veo 3** (`google/veo-3`) instead of Luma. Native synchronized audio = lifestyle signal.

### Step 6: Optional Shutterstock luxury insert footage
- Search Shutterstock for licensed 4K luxury interior footage that COMPLEMENTS (does not contradict) the actual listing. Kitchen steam, fireplace inserts, wood-grain detail.
- License before download. Document in citations.json.

### Step 7: VO + alignment
- Slower delivery for luxury — Victoria can read at the same speed but the script has more pause. Two-clause sentences become one-clause sentences. Less is more.
- 30-45s, 12-14 beats max.

### Step 8: BEATS array — luxury template
- Cold open: 3s hold on a wide of the property with one element of motion. NO TEXT. The view is the hook.
- Beat 1: address ribbon fades in (AzoSans Light 48px, no pill, white text + shadow).
- Beat 2-7: alternate exterior / interior / detail / view. 3-4s each. Match dissolves between beats.
- Final beat: tagline (Amboqia Italic 56px, cream) + end card.

### Step 9: Render + quality gate.
- Tetherow scorecard minimum is **88**, not 85. Raise the bar.

### Step 10: Show Matt → approval → commit + push.

### Step 11: Distribution
- Luxury goes to IG primarily (lifestyle audience), then YouTube (long-form luxury content has SEO value), then LinkedIn (broker authority for high-net-worth referrals).
- Skip TikTok for luxury unless the property has a uniquely viral-ready feature (extreme architecture, celebrity provenance, view).

---

## §6 — CROSS-CUTTING: WHEN ANY API IS DOWN

If `API_INVENTORY.md` shows a service is `⚠️` or `❌`, the workflow above breaks. Don't proceed silently — surface to Matt and propose a fallback.

| If down | Fallback path | Trade-off |
|---|---|---|
| Replicate balance dry | Use existing footage / fall back to DepthFlow + Remotion masked overlays | Lower quality cinematic, but still ships |
| ElevenLabs cap reached | Cut the VO from the build (silent video with strong captions) OR pause the build | Silent video performs ~30% lower on retention but isn't a non-ship |
| Spark API timeout | Use Supabase only — note in citations that Spark cross-check was skipped due to outage | Increases risk of stale data; flag clearly |
| Resend domain unverified | Send via `onboarding@resend.dev` test sender (works) | Signals "test email" — fix the verification |
| Meta token expired | Render but don't auto-publish; surface to Matt for manual upload | Manual posting | 
| TikTok in Draft state | Render + queue for manual upload | Manual posting |
| Google Geocoding off | Use the lat/lng already in Supabase listings (Spark provides it) | None |
| fal.ai balance dry | Use Replicate (it covers the same model menu except Runway Gen-4) | None — Replicate is the equal/better path |

---

## §7 — VIDEO BUILD CHECKLIST (use this before every render)

Run through this list before kicking off `npx remotion render`:

- [ ] Listing data pulled fresh from Supabase + cross-checked against Spark (deltas < 1%)
- [ ] Tier classified (luxury / standard / market / news / evergreen)
- [ ] Photos selected and classified by GPT-4o Vision
- [ ] AI cinematic clips generated (Kling/Veo/Luma per the format in `VISUAL_STRATEGY.md`)
- [ ] VO rendered with Victoria — locked settings, `previous_text` chained
- [ ] Forced-alignment JSON generated and saved next to the MP3
- [ ] BEATS array engineered against the viral scorecard from beat 0 (not "scored later")
- [ ] Captions wrapped in `<CaptionSafeZone>` and reading from alignment JSON
- [ ] Brand: no logo, no agent name, no phone, no URL in any frame except end card
- [ ] Banned words grep-clean (captions + VO script + source pills)
- [ ] Every on-screen number traces to a row in `citations.json`
- [ ] Render to `out/<deliverable>.mp4` (gitignored)
- [ ] ffprobe + blackdetect strict + frame-extract checks pass
- [ ] Viral scorecard ≥ format minimum (listing 85, market 80, news 80, evergreen 75-80, luxury 88)
- [ ] Scorecard.json + citations.json written next to the render
- [ ] Show Matt the path + scorecard summary + verification trace
- [ ] Wait for explicit approval — don't commit, don't push

After approval:
- [ ] Copy MP4 to `public/v5_library/`
- [ ] Commit + push to `origin/main`
- [ ] Insert distribution row into `social_post_queue`

---

## §8 — When to read the long skill files

For implementation specifics not covered above:
- **Frame-by-frame hook spec** → `VIRAL_GUARDRAILS.md` §1
- **Full quality gate** → `VIDEO_PRODUCTION_SKILL.md` Section 7
- **Banned content + AI disclosure rules** → `ANTI_SLOP_MANIFESTO.md`
- **Caption safe zone implementation** → `VIDEO_PRODUCTION_SKILL.md` Section 0.5 + `CAPTION_AUDIT.md`
- **Voice settings + IPA phoneme tags** → `CLAUDE.md` Video Build Hard Rules + this file §1.5
- **Sub-skill index (depth_parallax, gaussian_splat, audio_sync, etc.)** → `VIDEO_PRODUCTION_SKILL.md` §10

For routine builds — listing, market report, news, evergreen, luxury — these three docs (`API_INVENTORY.md`, `VISUAL_STRATEGY.md`, `WORKFLOWS.md`) plus `CLAUDE.md` are enough. Don't re-ingest 2,000 lines of master skill per build.
