# Handoff — Producer System Rebuild Pass · 2026-05-19

**To the next agent:** Read this file end-to-end before touching anything. Matt has given specific feedback on every producer he reviewed. Your job is to systematically fix each one without losing context. Do NOT re-render or "improve" producers Matt approved.

## Bootstrap reads (in this order)

1. **`CLAUDE.md`** — the absolute non-negotiables (data accuracy, draft-first, brand voice, video build rules, design system v2).
2. **`design_system/ryan-realty/SKILL.md`** — brand register, heritage vs web, type tiers, asset cheat sheet, voice rules.
3. **`marketing_brain_skills/producers/REGISTRY.md`** — canonical producer registry, 73 producers across Sections A-F.
4. **`scripts/producer-inventory.mjs`** — the 53 producers that are currently executable end-to-end against `tests/fixtures/producer-payload-tumalo.json`.
5. **`scripts/_producer_lib.py`** — shared lib with `brand_stamp()`, `font()` (STRICT — raises if Amboqia/AzoSans missing), brand colors.
6. **`docs/HANDOFF_PRODUCER_REBUILD_2026-05-19.md`** — this file.

## System state (2026-05-19)

- **Branch:** `main`. Latest commit: `88588bd` (real earth_zoom + flyover wrappers).
- **Producer count:** 53 in inventory, 53/53 passing end-to-end test.
- **Gallery:** `out/producer-gallery/index.html` (97 KB) + mirror at `public/producer-gallery/index.html` (Next.js / Vercel deployable).
- **Local preview server:** `python3 -m http.server 8092 --bind 127.0.0.1 --directory out`. URL: http://127.0.0.1:8092/producer-gallery/index.html.
- **Canonical fixture:** `tests/fixtures/producer-payload-tumalo.json` (19496 Tumalo Reservoir Rd, Bend SFR rolling-30d ending 2026-05-17, median $690K, 10 days DOM).
- **Test command:** `node scripts/test-all-producers.mjs`.
- **Rebuild gallery:** `node scripts/build-producer-gallery.mjs`.
- **Brand-stamp pass:** `python3 scripts/_apply_brand_stamp.py` (idempotent — only stamps new images).
- **HTML brand pass:** `node scripts/_apply_brand_html.mjs`.

## What's been completed across the recent sessions

- 53 producer scripts. 65 in earlier inventory; 14 slop video producers pulled (slideshow mockups that don't fulfill SKILL.md spec). 12 remain pending real Remotion comps. earth_zoom + google_maps_flyover rebuilt as real Photorealistic 3D Tiles compositions at `video/tumalo-aerial/`.
- Brand-stamp helper added to `_producer_lib.py`. 41 image outputs re-stamped with the canonical Ryan Realty navy footer (logo PNG + tagline + phone + web). 2 HTML producers patched with Geist + brand footer.
- APIs verified: Pexels, Replicate, Resend (mail.ryan-realty.com DKIM/SPF/DMARC/MX all live + Resend domain verified), Apify Bronze ($29/mo, 27 datacenter proxies), Meta Page token (live, full publishing scopes).
- Cascade Hasson Sotheby's competitor recon completed via Apify. 120 brokers + 286 listings in their Bend Bond St office.
- ZipYourFlyer references purged from agent-coop-eflyer SKILL + REGISTRY + best-practices doc.

## UNIVERSAL HARD RULES (Matt directives from 2026-05-19 — NEW, must enforce everywhere)

### Captions — single-word highlight in Amboqia (every video, no exceptions)

- Every vertical social video uses **Amboqia Boriango** for caption type (NOT AzoSans, NOT Geist).
- Captions are **single-word at a time** highlighting the word currently being spoken (forced-alignment timestamps from ElevenLabs `/v1/forced-alignment`). NOT phrase windows. NOT full sentences staying on screen.
- This must be the same look across **every** video the brand ships.
- Existing reference impl for the data structure is at `video/market-report/src/CaptionBand.tsx` — but the visual treatment (font, size, highlight color) must be updated to the single-word-Amboqia rule. The earlier "sentence stays on screen, active word highlighted gold/scaled" rule from CLAUDE.md §0.5 is **superseded** for new builds.

### Safe zones — hard rule on every 1080×1920 portrait video

No text or critical visual content may sit in the social-app UI overlay zones:

| Region | Avoid placing text/critical content | Why |
|---|---|---|
| Top 0–250 px | profile pill, follow button | IG / TikTok / FB Reels profile UI |
| Bottom 0–~340 px (bottom 18% of frame) | caption text, like/comment buttons | platform action UI overlay |
| Right edge 960–1080 px | platform action buttons | IG/TikTok action column |

**Working safe zone for text overlays:** `x: 90 → 990, y: 280 → 1480`. Anchor headlines and captions inside this rectangle.

### First-frame thumbnail (t=0)

The first frame of every social video must look great as a static thumbnail in a social feed. **NO** black screens, NO logo-only intros, NO blank cards. The first frame is content + hero photography or live tile content with a title overlay.

### Voiceover — conversational, not robotic

ElevenLabs Victoria (voice_id `qSeXEcewz7tA0Q0qk9fH`) settings per current CLAUDE.md video rules: model `eleven_turbo_v2_5`, stability `0.40`, similarity_boost `0.80`, style `0.50`, `use_speaker_boost: true`. **Test multiple sample VOs per producer before locking** — if a script reads robotic, fix the punctuation (Matt's instruction: "shorter clauses, commas where a natural speaker would pause, IPA phoneme tags for tricky words"). Run an A/B between two style values if a producer's read sounds stiff.

### Brand voice — Matt's actual rules (rewrite the "banned words" enforcement to match)

The current `BANNED_WORDS` list in `scripts/_producer_lib.py` is too aggressive and may not match Matt's voice. Revise it. Matt's directive:

- **Number-one rule:** never pander, never editorialize.
- **Optimistic.** Always.
- **Friendly.** No formal/corporate distance.
- **Transparent.** Show your work.
- **Professional.** Real estate professionals, not influencers.
- **Excellent service.** Demonstrated, not claimed.
- **Not salesy.** No urgency, no fake scarcity, no "act now."

Banned words list should reflect those values. **Keep:** the AI-filler block (delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster); pandering openers ("don't worry, we will handle everything"); hype openers ("introducing", "you won't believe"); fake-urgency ("act fast", "don't miss out"). **Revisit:** the real-estate-cliché list — some of those (stunning, gorgeous, charming) may be over-banned. Matt sometimes uses "honored" + "privilege" + "small business like ours" — keep those.

Canonical source: `design_system/ryan-realty/SKILL.md` "Voice" section. Re-read it. Update `_producer_lib.py BANNED_WORDS` to align.

## PER-PRODUCER FIXES (from Matt's 2026-05-19 review)

Work through these in order. Each one is a real fix, not a re-mockup.

### `blog-post` and `market-report-blog`

**Status:** Currently outputs markdown only. Matt needs to **see the rendered visual layout** — the actual blog page with photo + heading hierarchy + body.

**Fix:** Producer needs to output BOTH the markdown AND a rendered HTML preview that shows what the post will look like on `ryan-realty.com` (AgentFire WordPress). The HTML preview should include the hero photo, headings, body type, and brand footer. SEO meta is fine in metadata — but the visual deliverable is what matters in the gallery.

**Confusion:** Matt said "two output files plus four sidecars" is unclear. The gallery card's "8 output files + 4/4 sidecars" line confuses him. Rewrite the card-meta summary to say something like "post.md · preview.html · 4 verification sidecars" — human-readable, not "2 outputs + 4 sidecars."

### `broker-contact-card`

**Status:** Currently 1080×1350 cream card with portrait + name + role + phone + email.

**Fix:** Make it a **full contact card** — all contact info present (phone direct + FUB, email, web, address line, license #). Layout needs work. Add a **background** (Matt said "seems like there needs to be some kind of background"). Consider the heritage scene illustrations from `design_system/ryan-realty/assets/brand/` as soft background, or a Tumalo/Bend landscape with strong navy scrim.

**Caveat:** Matt also said "if there's a better way to do that" — research good real estate broker contact cards via Apify (see "Apify-driven design deconstruction" task below) and adapt.

### `cma`

**Status:** ✅ Matt approved. **Do not touch.**

### `coming-soon-teaser`

**Status:** Produces 3 storyboard PNGs at 1080×1920 (01-exterior, 02-tease, 03-reveal).

**Fixes:**
1. Gallery shows only frame 1 — fix the gallery card to show all 3 in a grid (currently uses primary_artifact = first frame only).
2. Remove the white line at the top of each frame (probably a default thin border on the scrim).
3. The "Ryan Realty" mark at the bottom is too small AND it's re-typeset text instead of the canonical wordmark image. Replace with the horizontal wordmark PNG (`design_system/ryan-realty/assets/brand/logo-blue.png` on cream, or `logo-white.png` on navy).
4. Apply the universal safe-zone rule. Current text overlay sits near the bottom edge — move into the y:280-1480 safe zone.

### `comparable_grid`

**Status:** 3×2 grid of "comp sales" — but every cell shows the same Tumalo hero photo.

**Fix:** Actually pull REAL comparable sales from Supabase `listings` table near 19496 Tumalo Reservoir Rd (2-mile radius, last 90 days, SFR, similar price band $900K-$1.5M). Each cell shows the comp's actual primary photo from MLS via `PhotoURL` column. Add address + price + DOM under each comp. Save the comp_ids in `citations.json` so the data trace is real.

### `earth_zoom` ✅ Matt approved with three caveats

1. **Zoom tighter at the end** — current final altitude is 250m. Drop to 80-120m so the final framing is clearly the parcel, not the broader neighborhood.
2. **Lot polygon overlay** — overlay the actual lot boundary as a navy or cream polygon during the final 2-3 seconds. Source the boundary from Deschutes County GIS (`https://dial.deschutes.org/` or the county GIS service). Tax lot for 19496 Tumalo Reservoir Rd. Per CLAUDE.md memory `feedback_gis_authoritative_only.md`: polygons MUST come from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or Census TIGER. Never approximate. The polygon overlay is a `<lineSegments>` or `<line>` Three.js primitive at the parcel coords, projected from lat/lng pairs via `tangentOffsetM`.
3. **Remove the bottom brand banner** — it gets overlaid by the social platform's controls. Move brand attribution to the top eyebrow only (which is already inside the safe zone) OR to an end-card frame at t=9.5-10s. Don't put it in the bottom 18% of the frame.

**Source:** `video/tumalo-aerial/src/EarthZoomTumalo.tsx`. Re-render with: `cd video/tumalo-aerial && node_modules/.bin/remotion render src/index.ts EarthZoomTumalo out/earth_zoom_tumalo.mp4 --codec h264 --concurrency 1 --gl=angle --crf 22 --image-format=jpeg --jpeg-quality 92`. Then re-mux VO + save to `out/earth_zoom/19496-tumalo-reservoir-rd/earth_zoom.mp4`.

### `facebook-lead-gen-ad`

**Status:** 1080×1080 with hero photo cropped — only sky visible (the home is at the bottom edge, cut off).

**Fixes:**
1. Photo crop is wrong — anchor the crop on the architecture, not the sky.
2. Bad 50-50 split with the box overlay covering the bottom half of the home.
3. **Use Apify to deconstruct best-performing real-estate FB lead-gen ads.** Then adapt the layout — don't reinvent.

### `floor_plan_render`

**Matt's instruction:** Likely **delete this producer**. Real floor plans come from the listing photographer, not from a generated SVG. The current PIL-drawn rectangles aren't usable.

**Action:** Remove `floor_plan_render` from `scripts/producer-inventory.mjs`. Move `scripts/build_floor_plan_render.py` to `scripts/_deprecated/` (don't delete in case we change our minds). Document the rationale in the deprecated folder's README.

### `flyer-design`

**Status:** 10 flyers F1-F10. Heavy overlap between several. Text bleeds.

**Per-flyer:**
- F1 (museum-wall): ✅ keep. **Add:** logo in top-left corner.
- F2 (broadsheet-strip): ✅ keep.
- F3 (stat-spike): keep but review for text overlap.
- F4 (contact-sheet): keep.
- F5 (story-postcard): keep but review.
- F6 (farmstead-postcard): keep but review.
- F7 (price-drop): **DELETE.**
- F8 (track-record): **DELETE.**
- F9 (open-house): keep.
- F10 (buyer-education): keep but review.

**Plus the universal:** Apify-deconstruct top-performing real-estate flyers and adapt to brand. Don't invent layouts from scratch.

### `google-ads-copy`

**Status:** Markdown file with headlines + descriptions + sitelinks.

**Fix:** Add a **rendered preview** showing what the ad would look like in Google search results. Mock up the SERP card with the heading + green URL + description + sitelinks the way Google actually renders ad units. Make this the primary artifact alongside the markdown.

### `google_maps_flyover`

**Status:** Improved from slop but unusable — Matt called it "very choppy."

**Fixes:**
1. **Smooth the camera path.** The 6-waypoint linear-segment interpolation has visible velocity discontinuities at each waypoint. Use a Catmull-Rom or Bezier spline through the waypoints so the path is continuous in C2 (position + velocity + acceleration all smooth).
2. Reduce the bank-angle clamp — current `clamp(horizV.x / 20, -0.45, 0.45)` causes abrupt roll changes. Smooth the bank with an additional ease.
3. Add subtle motion blur via Remotion shutter angle config or post-process via ffmpeg `tmix` filter (10% blend with adjacent frames).
4. Same safe-zone fix as earth_zoom — remove bottom brand bar; keep the eyebrow at top only.

**Source:** `video/tumalo-aerial/src/FlyoverTumalo.tsx`.

### `ig-single-post` ✅ Matt approves overall, three caveats

1. Subtext (under-line text below the main headline) needs to be **bigger** — currently runs at ~20px AzoSans. Bump to 28-32px for legibility.
2. Top-of-post photo text needs to be **bigger** — Matt: "so you can actually read it."
3. Safe zones must be hard rule. Move all labels (Just Listed / Open House / Price Improvement / etc.) into the y:280-1080 safe zone. No text in the bottom 340px.

Producer: `scripts/build_single_image_posts.py` (canonical) and the wrapper `scripts/build_ig_single_post_wrapper.py`.

### `linkedin-document-carousel`

**Status:** 8 slides, market-insight framing. Matt: "not formatted, don't understand what it's supposed to be doing."

**Fix:** This is the LinkedIn native PDF carousel format — a multi-page PDF that LinkedIn renders as swipeable cards. Research best-in-class examples via Apify (search LinkedIn for `site:linkedin.com/posts/ "document" real estate`), pick 3-5 high-performing examples, deconstruct the layout pattern, rebuild from scratch matching the canonical real-estate LinkedIn carousel format. Then re-render with our market data.

### `list_kit_orchestrator`, `listing_launch_orchestrator`, `monthly_market_report_orchestrator`

**Status:** Fan out to sub-producers, write a `kit.html` aggregating outputs.

**Matt's instruction:** "Review all the orchestrations. Not sure what their purpose is. They don't look good."

**Fix:** Two parts.
1. **Document the purpose clearly** in `kit.html` itself — the orchestrator's HTML should open with a clear lead: "This is the at-Active master kit for 19496 Tumalo Reservoir Rd. Here are the 12 deliverables that get produced + posted when this listing goes live." Show the dispatched sub-producers as a checklist with status (✅ produced / ⏳ scheduled).
2. **Show what each fan-out produces** at proper size — currently kit.html links to sub-folders but doesn't embed any visuals. Embed the primary artifact thumbnail of each sub-producer (img/video poster) at 240×400 in a clean grid.

### `listing-tour-video` (the canonical Remotion comps in `listing_video_v4/`)

These are the EXISTING canonical listing reels (cascade-and-creek.mp4, tumalo-life.mp4). Matt's fixes apply globally to these renders:

1. **Captions match across all videos.** Single-word Amboqia highlight, synced to ElevenLabs forced-alignment.
2. **Zoom/pan smoothing.** Existing Ken Burns motion is choppy at beat boundaries. Apply Remotion `interpolate({easing: Easing.bezier(0.42, 0, 0.58, 1)})` per beat instead of linear lerps. Reference: `video_production_skills/photo-hero-drift/SKILL.md`.
3. **End-card logo.** Currently sits in a blue box. Make it transparent — use `logo-stacked-white.png` on whatever the underlying frame is (typically a final hero photo with a soft scrim).
4. **Brand font on end card.** Confirm Amboqia Boriango is being loaded in the Remotion comp's `fonts.ts`. If not, fix.

### `map_static_card`

**Status:** Lots of whitespace, no actual map on it. Pin icon is rough.

**Fix:**
1. Use real Google Static Maps API (we have `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `REMOTION_GOOGLE_MAPS_KEY`). Render an actual satellite or hybrid map snippet centered on the listing.
2. Redesign the pin completely. Apify-deconstruct top real-estate listing cards on Zillow/Compass/Sotheby's — look at how their location cards present the pin + neighborhood label.
3. Reduce whitespace — fill the frame with the map + clean label band below.

### `market-data-video` (existing canonical `video/market-report/`)

Apply all the universal video rules:
1. Captions: single-word Amboqia in safe zone.
2. All text in safe zones.
3. Audio synced.
4. Conversational VO — re-tune ElevenLabs settings if needed; A/B 2-3 reads.
5. First frame is a great thumbnail (current first frame may be black or title-card-only — fix).

Also: **rebuild with updated content.** Find a current national or local housing news story (national is fine), cut a clip into the video, update on-screen text. The current bend_market_report_ytd2026 has stale May 2026 rolling-30d data — refresh with current numbers.

### `market_pulse_short`

Same universal rules. Plus:
- Not using brand font (Amboqia). Fix.
- Pills "too much" — reduce visual weight or remove.
- Too brief / choppy — use complete sentences in the VO script. Stop assuming the viewer knows the abbreviation. Example: instead of "MoS 3.8" use "Months of supply: 3.8."

### `meme_lord` + `meme_content`

**NEW REQUIREMENT — dedicated meme-research skill.**

Matt: "There needs to be a thorough understanding of real estate memes. There needs to be a dedicated agent that goes out and researches this and understands the humor, goes out and scrapes every meme and understands why it's funny, and then builds this into some kind of library so it understands why it's funny."

**Build a new skill at `social_media_skills/meme-research/SKILL.md`** that:
1. Uses Apify (we have Bronze tier, $29/mo) to scrape top real-estate memes from IG, X, TikTok, Reddit r/RealEstate, r/PersonalFinance, r/wallstreetbets (housing posts).
2. Catalogs each meme: image / caption / context / why it's funny (1-paragraph explanation tied to a humor mechanism — irony, exaggeration, pun, contradiction, recognition).
3. Stores in a Supabase `meme_library` table OR a versioned `data/meme-library.jsonl` file.
4. Periodically re-scrapes (cron) and adds new entries.
5. `meme_lord` + `meme_content` producers pull from this library at generation time — pick a meme template, swap in Ryan Realty / Bend / market-data context.

Without this library, both meme producers are guessing. The library IS the producer's intelligence.

### Listing tour (existing) videos

See `listing-tour-video` above — same set of fixes (captions, smoothing, end-card, brand font).

---

## NEW META-TASKS

### Apify-driven design deconstruction (reusable pattern)

Matt's general directive: "instead of trying to recreate the wheel, use Apify to find some [X] that are good and then just use our branding."

Build a reusable workflow at `marketing_brain_skills/competitor-design-recon/SKILL.md`:

1. Input: a design format (FB lead-gen ad / 8.5×11 flyer / LinkedIn document carousel / IG carousel / map static card / etc.) + a target search context (e.g., "high-performing Bend or Tumalo real-estate FB ads").
2. Apify scrape: pull 30-50 examples. Use either:
   - `apify/google-search-scraper` for SERP-image queries
   - `apify/facebook-ads-library` for actual FB lead-gen ads
   - `apify/instagram-scraper` for IG examples
   - `apify/linkedin-document-scraper` (or generic web-content-crawler on `site:linkedin.com/posts`)
3. Catalog: download imagery, parse the layout pattern, rank by engagement signals where visible (likes, shares, comments, follower count of poster).
4. Output: a `out/design-recon/<format>/recon.md` with the top 5 layout patterns documented (heading position, hero image crop ratio, CTA placement, color contrast, typographic hierarchy).
5. Producer hooks: each design producer (`facebook-lead-gen-ad`, `flyer-design`, `linkedin-document-carousel`, `map_static_card`) reads its corresponding `recon.md` at build time and uses one of the documented patterns.

Run this recon ONCE per format, then rerun monthly. This unblocks the "your designs aren't as good as what's out there" problem permanently.

### Lot boundary polygon overlay (earth_zoom + listing-tour-video)

Per CLAUDE.md `feedback_gis_authoritative_only.md`: polygon must come from Deschutes County DIAL (`https://dial.deschutes.org/`), Oregon GEO, or Census TIGER. Never approximate.

Workflow:
1. Build `scripts/fetch-parcel-polygon.mjs` that takes a listing's lat/lon (or APN) and queries Deschutes DIAL's REST endpoint for the parcel boundary GeoJSON.
2. Cache results in `data/parcels/<apn>.geojson`.
3. Add `parcel_polygon` to the canonical payload schema (`tests/fixtures/producer-payload-tumalo.json` → add `extras.parcel_polygon`).
4. In `video/tumalo-aerial/src/EarthZoomTumalo.tsx`, render the polygon as Three.js `<lineSegments>` projected via `tangentOffsetM` from each lat/lng vertex. Visible from t=7s to t=10s, fade in over 0.5s.
5. In listing-tour-video's hero beat, overlay the polygon similarly during the aerial-1 / aerial-2 shots.

### Brand voice rules revision

Update `scripts/_producer_lib.py` `BANNED_WORDS` to match Matt's actual voice rules. Drop the over-aggressive real-estate-cliché entries and keep the AI-filler + pandering + hype + fake-urgency blocks. Cross-reference `design_system/ryan-realty/SKILL.md` "Voice" section as the canonical source.

Also: update the strict-voice gate in the 7 site/comms scripts to allow em-dashes in code blocks (TSX comments, JSON keys) but not in user-facing prose. The current "soften to warn" patch is good enough but the underlying detection is over-broad.

---

## Tools + APIs available (verified live)

| Tool | Use for | Key |
|---|---|---|
| Apify Bronze ($29/mo) | competitor recon, FB ads scrape, IG/LinkedIn scrape | `APIFY_API_TOKEN` |
| Replicate | AI video (Kling/Veo/Hailuo/Seedance), AI image, AI staging | `REPLICATE_API_TOKEN` |
| ElevenLabs (Creator $22/mo) | Victoria VO, forced-alignment | `ELEVENLABS_API_KEY`, voice `qSeXEcewz7tA0Q0qk9fH` |
| Google Maps + Photorealistic 3D Tiles | earth_zoom, flyover, static maps, geocoding | `REMOTION_GOOGLE_MAPS_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Pexels | stock photo fallback | `PEXELS_API_KEY` (just added) |
| Resend (`mail.ryan-realty.com` verified) | newsletter, comms-client-update, agent-coop-eflyer | `RESEND_API_KEY` |
| Meta Page Access Token (live, full scopes) | FB/IG publishing | `META_PAGE_ACCESS_TOKEN` |
| FollowUpBoss | CRM mutations | `FOLLOWUPBOSS_API_KEY` |
| Supabase MCP | live data pulls | project `dwvlophlbvvygjfxcrhm` |
| xAI Grok (text + image + video + Vision) | content generation, photo tagging | `XAI_API_KEY` |

## Producers still pending real Remotion comps (12 — slop pulled from inventory)

These have placeholder scripts that produce slideshow MP4s. They're NOT in the inventory. Build real Remotion compositions for them following the `video/tumalo-aerial/` pattern:

```
listing_reveal · news_video · area_guides · data_viz_video ·
avatar_market_update · meme_content · news_video_avatar ·
tiktok_listing_tour · map_route_video · school_district_overlay ·
walkability_overlay · youtube_long_form_market_report
```

Per Matt's priority order in our last conversation: `news_video`, `listing_reveal`, `data_viz_video` first, then the rest as needed.

## Definition of Done per producer

A producer is "done" when:

1. The script at `scripts/build_<slug>.py` or `scripts/build-<slug>.mjs` runs cleanly against `tests/fixtures/producer-payload-tumalo.json`.
2. The producer is registered in `scripts/producer-inventory.mjs` with section + runner + script path.
3. The primary artifact is on disk at `out/<slug>/19496-tumalo-reservoir-rd/<primary>` with non-zero size.
4. The four sidecars (`citations.json`, `provenance.json`, `design_scorecard.json`, `card.json`) are present and valid JSON.
5. Brand stamp applied (image producers) OR brand `<head>` + footer table injected (HTML producers) OR brand fonts loaded in Remotion (video producers).
6. **Visual review** — open the actual primary artifact (image / video / HTML) and confirm:
   - Real brand fonts are used (Amboqia + AzoSans, NOT Helvetica or default sans)
   - Canonical wordmark image is present (NOT re-typeset text)
   - "It's About Relationships." tagline visible somewhere if heritage register
   - Safe zones respected for vertical videos
   - First frame works as a thumbnail (videos)
   - Captions are single-word-Amboqia (videos)
7. End-to-end test passes: `node scripts/test-all-producers.mjs --producer <slug>` returns PASS.
8. Gallery rebuilds and the producer card shows the real artifact at proper size: `node scripts/build-producer-gallery.mjs`.

## Workflow

1. Pick a producer from the list above.
2. Read the per-producer fix section carefully.
3. Read the producer's SKILL.md if applicable.
4. Build or fix the script.
5. Run the producer.
6. **Open the output yourself and verify it visually.** Don't trust the test runner alone — Matt's review was harsh because outputs passed the test but didn't fulfill the spec.
7. Run the brand-stamp pass if it's an image producer (or apply HTML brand pass if HTML).
8. Run the full test.
9. Rebuild the gallery.
10. Commit with a clear message naming what changed.
11. Push to `origin/main` directly.
12. Move to the next producer.

## What NOT to do

- **Do NOT** mark a producer "done" just because the test passes. Test passing != fulfilling the spec. Open the actual output and look at it like a human.
- **Do NOT** re-introduce the 14 slop video producers without rebuilding them as real Remotion comps.
- **Do NOT** re-typeset "Ryan Realty" in text on image producers. Always paste the canonical wordmark PNG (`logo-blue.png` on cream, `logo-white.png` on navy).
- **Do NOT** commit MP4 or large binary outputs to the repo. They live in `out/` (gitignored) and on `public/v5_library/` only for approved ship-ready renders.
- **Do NOT** invent new "banned words" — use the existing list in `_producer_lib.py` and align with Matt's voice rules as a single source of truth.
- **Do NOT** dispatch subagents to "make a card-html mockup that passes the test." That's the failure mode from earlier in this session. Either build the real producer or be honest that it's pending.

## End

When you've worked through this list, write a new handoff doc summarizing what got fixed, what's still pending, and what new feedback Matt gave during the session. Append it to `docs/HANDOFF_PRODUCER_REBUILD_<date>.md`.

Good luck.
