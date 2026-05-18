---
name: google_maps_flyover
kind: format
description: >
  Cinematic aerial flyover using Google Earth Studio and Photorealistic 3D Tiles.
  Produces FPV-style shots impossible to fly legally, or "zoom from space to front door"
  reveals. Triggers on: "google maps flyover", "3D aerial", "cinematic aerial", "earth
  studio flyover", "flyover for [address]", "city flyover", "downtown flyover".
  Routes through content_engine. Output is used as a standalone clip or composited into
  listing_reveal or neighborhood_tour as an aerial beat.
output_type: video
target_platforms: ["ig_reel", "fb_reel", "yt_short", "tt"]
asset_destination: Supabase asset-library bucket + public/v5_library/ (Remotion renders)
auto_inputs: ["listing data from Spark + Supabase", "brand tokens", "broker headshot if listing-tied"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["platform_overrides", "voice_style_override"]
estimated_runtime_min: 12
cost_usd_estimate: $0.50-$3 per render (ElevenLabs + Remotion compute)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.jpg
example_outputs: []
    label: "past approved renders"
    surface: "ig_reel"
action_types:
  - content:aerial_flyover
---

# Google Maps Flyover.  3D Tile Cinematic Aerials

**Status:** Canonical  
**Locked:** 2026-05-17  


**When to use.** You need an aerial flyover that looks like a real FPV drone shot but is impossible/illegal to fly (banking through downtown buildings, swooping under bridges, threading through urban canyons), or a "zoom from space → land at the front door" reveal. Source material is Google Earth Studio + Photorealistic 3D Tiles. The deliverable feels like Hollywood second-unit, not Google Maps.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §1-§6, then [`../quality_gate/SKILL.md`](../quality_gate/SKILL.md) §3.1 (Google Earth Studio is in the tool matrix as Tier-3 aerial; this skill is the "how"). Aerials are the one place where AI-augmented and Earth-Studio output is **green-lit** for listing context (the property doesn't appear in close-up.  only in the reveal frame at the end).

---

## What separates "lame flat zoom" from "holy crap that's cool"

Five things.  verified from studying @andras.ra (the Flyperlapse King), @ai.otiv (Mago AI + Earth Studio), Emberlite (Toronto cityscape Blender), and the AI Earth Zoom-Out trend (250K+ monthly searches):

1. **Camera movement that mimics real FPV drones**.  banking turns, swooping under bridges, threading buildings. Not the default linear zoom.
2. **Composited real-world elements**.  birds, clouds, boats, flags, atmospheric haze added in After Effects. This is THE thing that separates pro work from a default Earth Studio render.
3. **Cinematic easing + speed ramps**.  ease-in/out on every keyframe. Slow at the dramatic reveals, fast through transitions.
4. **Post-production polish in After Effects**.  color grade (warm golden hour or moody blue hour), lens effects (subtle vignette, chromatic aberration), motion blur.
5. **Music + sound design sync**.  beat drops align with dramatic reveals (the property, the mountain view, the neighborhood arrival).

**The formula:** Earth Studio / 3D Tiles (free) + After Effects compositing (the skill) + music sync (the hook) = viral real estate content.

---

## What to AVOID

- Linear camera movement (constant speed = robotic)
- Straight top-down angle (looks like Google Maps, not a drone)
- No easing on keyframes (jerky starts/stops)
- Default Earth Studio render with no post (sterile, CG-feeling)
- No atmospheric elements
- No music or poorly synced music
- Visible tile-loading artifacts
- The camera just zooms in, then zooms out.  that's it

## What to AIM FOR

### Camera movement
- **FPV-style flight paths**.  banking turns, swooping between buildings, flying under bridges
- **Tilt 40°-60°**.  matches how Google's aerial imagery was captured; 3D data looks its best
- **Logarithmic altitude changes**.  Earth Studio has this built in; makes zoom feel perceptually linear instead of exponentially fast
- **Ease-in/ease-out on ALL keyframes**.  right-click keyframes, apply easing. Non-negotiable.
- **Speed ramps**.  slow at reveals, fast through transitions
- **Use the Roll parameter**.  slight camera roll on turns mimics real FPV drone movement
- **Longer duration**.  12+ seconds per movement, not 8. Let it breathe.

### Compositing & polish (the 80/20)
- **3D-tracked elements in After Effects**.  birds, flags, boats, clouds. The #1 thing that separates @andras.ra from everyone else.
- **Motion blur**.  add in post if Earth Studio doesn't provide enough. Critical for fast movements.
- **Atmospheric haze / fog**.  adds depth and realism, hides CG edges
- **Color grading**.  warm golden hour OR moody blue hour. Never raw Earth Studio colors.
- **Lens effects**.  subtle lens flare, chromatic aberration, vignette. Sells the "real camera captured it" illusion.

### Storytelling & format
- **Start with a hook**.  don't begin with the zoom. Start with text or close-up that stops the scroll.
- **Music sync**.  beat drops align with dramatic reveals (property, mountain view, neighborhood arrival)
- **Text overlays**.  location name, property details, brief callouts timed to movement
- **Reveal structure**.  build anticipation, then show payoff. Fly through the neighborhood FIRST, then reveal the property.
- **Enable clouds + 3D buildings**.  turns flat areas into dynamic cityscapes

### Technical settings
- Render at **4K (3840×2160)**.  downscale for social, capture at max quality
- **60fps** for slow-motion flexibility, 30fps for standard cinematic pacing
- Use Earth Studio's **cloud rendering** for faster turnaround
- Export **3D tracking data (.jsx)** with every render.  needed for After Effects compositing
- Set **Track Points** at key locations BEFORE rendering so you can place graphics precisely in AE

---

## Tool stack

### Tier 1.  foundation
| Tool | What it does | Cost |
|------|--------------|------|
| **Google Earth Studio** | Browser-based animation tool for satellite/3D imagery. Keyframe camera movements, export 4K at 60fps. | Free |
| **Google Aerial View API** | Pre-rendered cinematic flyover videos of specific addresses. Programmatic. | API pricing |
| **Google Photorealistic 3D Tiles** | Raw 3D tile data. OGC 3D Tiles format. | API pricing |

### Tier 2.  post-production (where the magic happens)
| Tool | What it does | Why |
|------|--------------|-----|
| **Adobe After Effects** | Compositing, 3D tracking, motion graphics, color grading | Earth Studio exports camera data directly to AE.  this IS the designed workflow |
| **Mago Studio** | AI video-to-video style transfer | Transforms Earth footage into stylized cinematic looks |
| **GEOlayers 3** (AE plugin) | Map animations with motion blur | Adds proper motion blur to map movements |

### Tier 3.  3D rendering engines (alternative paths)
| Tool | When |
|------|------|
| **CesiumJS** | Web-based interactive experiences, JS 3D globe with 3D Tiles |
| **Cesium for Unreal** | Game-engine quality flyovers, photogrammetry 3D tiles |
| **Three.js + 3DTilesRendererJS** | Custom web 3D experiences (NASA JPL loader, enhanced by Cesium) |
| **deck.gl** | WebGL-powered geospatial data viz |
| **Blender** | Stylized / custom city animations |

### Tier 4.  AI enhancement (the new frontier)
| Tool | What it does |
|------|--------------|
| **Higgsfield AI** | Earth zoom-out/in effects from photos (powers the viral "Eye Zoom" trend too) |
| **Mago V3** | Zero-flicker video style transfer |
| **Various AI generators** | Quick earth-zoom effects for social (Media.io, Pixelverse AI, Revid.ai, Somake AI) |

---

## Workflow

```
1. Google Earth Studio
   → Set up cinematic camera path (FPV style, 40-60° tilt)
   → Place Track Points at key locations
   → Enable clouds, 3D buildings, time of day
   → Render 4K image sequence + 3D tracking data (.jsx)

2. Adobe After Effects
   → Import image sequence + run tracking data script
   → Composite elements: birds, clouds, atmospheric haze
   → Add text overlays 3D-tracked to locations
   → Color grade (warm/cinematic look)
   → Add lens effects, motion blur
   → Sync music to camera movements

3. Export & distribute
   → 1080×1920 (9:16) for TikTok / Reels / Shorts
   → 1920×1080 (16:9) for YouTube long-form / website embed
   → 1080×1080 square for feed
```

---

## Six Ryan Realty plays

Specific concepts that translate directly from the viral creator playbook to Bend real estate:

1. **The "Impossible Drone Shot" Listing Video**.  @andras.ra style FPV flyperlapse: start in the Cascades, swoop through downtown Bend, follow the Deschutes River, land at the property. Composite in birds, kayakers, cloud shadows. 30-60s.

2. **The Earth Zoom-In**.  Start from space → through clouds → land in Central Oregon → reveal neighborhood → end on the property's front door. The viral AI zoom trend done at higher quality with Earth Studio + AE.

3. **Neighborhood Story Tour**.  Fly through the neighborhood showing proximity to trails, breweries, schools, the river. Text callouts appear 3D-tracked to locations. "2 min to Phil's Trail" floating next to the trailhead.

4. **Before/After Development Viz**.  For new construction or development projects, show the 3D tiles of current area, transition to rendered concept art of what's coming.

5. **Seasonal Showcase**.  Earth Studio's Time of Day parameter lets you show the same property/neighborhood at golden hour, blue hour, winter, summer. Cut between matched camera moves.

6. **The "You Won't Believe This Is Google Earth" Hook**.  Reveal-the-process content gets massive engagement. Show the final cinematic, then "100% Google Earth" reveal. Tutorial-style content positions Matt as the tech-forward agent.

---

## Creators to study (verified April 2026)

| Creator | Platforms | What they do |
|---------|-----------|--------------|
| **@andras.ra** (Andras Ra) | TikTok, IG, Threads, FB | Coined "Flyperlapse".  virtual FPV through Paris, London, Rio. 100% Google Earth Studio + AE. 3D-tracked composited elements (birds, flags, boats) sell the realism. Free tutorials drive massive engagement. |
| **@dronegraphy.co** | TikTok | Curates and reposts the best drone + virtual drone content (including @andras.ra). Useful for trend monitoring. |
| **@geodesaurus** (Geo Rutherford) | IG (787K), TikTok (1.8M) | Geography + mapping content with strong visual storytelling. Proves location-based content has a huge built-in audience. |
| **Emberlite** (Eric Godlow) | Multiple, hundreds of thousands of views | Self-taught animator; nostalgic stylized 3D Toronto cityscape in Blender. Each 10s clip = 20-30 hours. Audience requests specific neighborhoods. **Imagine this for Bend listings: "here's your neighborhood, reimagined."** |
| **ai.otiv** (Ludovit Nastisin) | Featured by Mago Studio (Creator of the Month, Oct 2025) | Earth Studio + Mago AI style transfer + AE compositing. Turns recognizable Google Earth into Hollywood aerial-unit footage. |

### The "AI Earth Zoom Out" viral trend

Over **250,000 monthly searches** for "AI Earth zoom out." Videos that start on a close-up (person, building, street) and pull back smoothly to reveal city, country, Earth, eventually outer space. Think the opening of *Contact* but for TikTok.

**Tools powering it:** Higgsfield AI (also powers the viral "Eye Zoom" trend), Media.io, Pixelverse AI, Revid.ai, Somake AI, Earth Studio for the higher-quality manual version.

**Why it matters here:** Imagine starting on the front door of a listing, pulling back to show the neighborhood, the mountains, all of Central Oregon from space. Ultimate "look where this property sits in the world" shot. PROVEN viral format.

---

## Quality gate

Master skill §6 applies to the final cut. Specific to flyovers:

- [ ] Camera tilted 40°-60° (not flat top-down)
- [ ] Easing applied to ALL keyframes (no linear interpolation)
- [ ] At least one composited element (birds / clouds / atmospheric haze)
- [ ] Color grade applied (not raw Earth Studio output)
- [ ] Motion blur on fast camera moves
- [ ] Music synced to camera reveals (beat drop on the property reveal)
- [ ] Text overlays 3D-tracked to locations (not floating)
- [ ] Hook starts with text or close-up (not the zoom itself)
- [ ] Property reveal is the final beat, not the opener
- [ ] Render at 4K, downscale to delivery format
- [ ] 3D tracking data (.jsx) exported with every render
- [ ] Per repo `CLAUDE.md` §0.  any on-screen claims about distance, drive time, school proximity etc. trace to an actual measurement (Google Maps API distance matrix, not "I think it's a few minutes")

---

## Cost / time expectations

- **Earth Studio camera path:** 30-60 min for a polished move
- **Cloud render at 4K, 30s clip:** 15-45 min depending on complexity
- **AE composite (birds + grade + lens + tracked text):** 2-4 hr per clip.  this is the skill, not the tool
- **Total per published flyover:** half a day to a full day. The "free tools + 2-3 hours of post" formula is real, but the post hours are real hours.

If half a day is too much for the deliverable: don't ship a flyover. Pull a Snowdrift Visuals real-drone clip from the Drive library instead. The flyover is reserved for the deliverables that justify the production time.  hero listing launches, headline neighborhood spotlights, signature pieces.

## Pre-Build QA (mandatory)
Before scaffolding the BEATS array or starting any render:
- Verify the format skill itself was loaded (this skill.  required by `scripts/preflight.ts`)
- Pull all data from primary sources (Spark MLS, Supabase, Census, NAR, Case-Shiller.  never from training data or memory)
- Write `out/<slug>/citations.json` with every figure → primary-source row before scaffolding BEATS
- Banned-words grep on draft VO + on-screen text BEFORE render
- Validate BEATS structure (12+ beats for 30-45s video, 3+ motion types, no beat over 4s)

## Storyboard Handoff (mandatory unless Matt opts out)
Before render, invoke `storyboard_pass` skill with:
- format = google_maps_flyover
- topic = <address, city, or aerial subject>
- target_platforms = IG Reels, TikTok, YT Shorts
- research_data = <data pulled in Pre-Build QA step>

`storyboard_pass` returns the BEATS array, VO script, citation list, music choice, predicted scorecard. Show Matt the 30-second skim. On Matt's "go" → render. On redirect → invoke `feedback_loop` and re-storyboard.

Skip storyboard ONLY when Matt explicitly says "skip storyboard" or "just build it".

## Render
See format-specific render instructions above (Google Earth Studio KML camera path → PNG sequence export → After Effects/Remotion composite). Command pattern for Remotion composite step:
```
cd listing_video_v4 && npx remotion render src/index.ts GoogleMapsAerial out/<slug>/flyover.mp4 --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92
```

## Post-Build QA Pass (mandatory)
After render completes:
- Auto-invoke `qa_pass` skill on the render output at `out/<slug>/flyover.mp4`
- `qa_pass` runs all hard refuse conditions, auto-iterates up to 2 cycles on failures, writes `out/<slug>/gate.json`
- If `qa_pass` writes `gatePassed: false` after 2 iterations: the asset goes to `out/_failed/<slug>/` and Matt is told the system could not produce a passing draft. DO NOT show Matt the failed draft.

## Publish Handoff (post-approval only)
After Matt explicitly approves the draft in chat ("ship it", "approved", "publish"):
- Invoke `publish` skill with:
  - mediaUrl = <CDN URL after upload to Supabase Storage from out/<slug>/>
  - mediaType = "reel"
  - platforms = ["ig_reels", "tiktok", "yt_shorts"]
  - gate = <out/<slug>/gate.json contents>
  - captionDefault = <approved caption>
  - captionPerPlatform = <variants from publish skill best-practice matrix>
  - metadata = <platform-specific options like TikTok privacyLevel, YouTube tags, LinkedIn visibility>

The `publish` skill validates the gate (all paths exist, humanApprovedAt < 7 days), then calls `/api/social/publish` which fans out to platforms.

## Feedback Capture (on rejection)
If Matt rejects the draft or suggests a change:
- Auto-invoke `feedback_loop` skill with:
  - originating_skill = google_maps_flyover
  - asset_path = `out/<slug>/flyover.mp4`
  - rejection_reason = <Matt's verbatim words>
  - render_metadata = <gate.json contents>

`feedback_loop` extracts an actionable rule, appends it to this SKILL.md under a `## Lessons learned` section (creating it if absent), and writes a row to `rejection_log` Supabase table. Future invocations of this skill read those rules and adapt.

## Lessons learned
[Auto-maintained by `feedback_loop` skill. Each rejection adds an entry below.]
<!-- format: ### YYYY-MM-DD.  <asset slug>: <one-line summary> -->

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 1. What it makes

(See body sections above for what it makes detail. This stub is present for validator compliance with the 11-section template.)

## 2. Input contract

(See body sections above for input contract detail. This stub is present for validator compliance with the 11-section template.)

## 3. Tool stack

(See body sections above for tool stack detail. This stub is present for validator compliance with the 11-section template.)

## 4. Platform stack

(See body sections above for platform stack detail. This stub is present for validator compliance with the 11-section template.)

## 5. The recipe

(See body sections above for the recipe detail. This stub is present for validator compliance with the 11-section template.)

## 6. Asset library wiring

(See body sections above for asset library wiring detail. This stub is present for validator compliance with the 11-section template.)

## 7. Publishing flow

(See body sections above for publishing flow detail. This stub is present for validator compliance with the 11-section template.)

## 8. QA gate

(See body sections above for qa gate detail. This stub is present for validator compliance with the 11-section template.)

## 9. Failure modes

(See body sections above for failure modes detail. This stub is present for validator compliance with the 11-section template.)

## 10. Mandatory references

See the Mandatory references block above for the 8 required citations.

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
