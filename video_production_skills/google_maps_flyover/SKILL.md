# Google Maps Flyover — 3D Tile Cinematic Aerials

**When to use.** You need an aerial flyover that looks like a real FPV drone shot but is impossible/illegal to fly (banking through downtown buildings, swooping under bridges, threading through urban canyons), or a "zoom from space → land at the front door" reveal. Source material is Google Earth Studio + Photorealistic 3D Tiles. The deliverable feels like Hollywood second-unit, not Google Maps.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §1–§6, then [`../quality_gate/SKILL.md`](../quality_gate/SKILL.md) §3.1 (Google Earth Studio is in the tool matrix as Tier-3 aerial; this skill is the "how"). Aerials are the one place where AI-augmented and Earth-Studio output is **green-lit** for listing context (the property doesn't appear in close-up — only in the reveal frame at the end).

---

## What separates "lame flat zoom" from "holy crap that's cool"

Five things — verified from studying @andras.ra (the Flyperlapse King), @ai.otiv (Mago AI + Earth Studio), Emberlite (Toronto cityscape Blender), and the AI Earth Zoom-Out trend (250K+ monthly searches):

1. **Camera movement that mimics real FPV drones** — banking turns, swooping under bridges, threading buildings. Not the default linear zoom.
2. **Composited real-world elements** — birds, clouds, boats, flags, atmospheric haze added in After Effects. This is THE thing that separates pro work from a default Earth Studio render.
3. **Cinematic easing + speed ramps** — ease-in/out on every keyframe. Slow at the dramatic reveals, fast through transitions.
4. **Post-production polish in After Effects** — color grade (warm golden hour or moody blue hour), lens effects (subtle vignette, chromatic aberration), motion blur.
5. **Music + sound design sync** — beat drops align with dramatic reveals (the property, the mountain view, the neighborhood arrival).

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
- The camera just zooms in, then zooms out — that's it

## What to AIM FOR

### Camera movement
- **FPV-style flight paths** — banking turns, swooping between buildings, flying under bridges
- **Tilt 40°–60°** — matches how Google's aerial imagery was captured; 3D data looks its best
- **Logarithmic altitude changes** — Earth Studio has this built in; makes zoom feel perceptually linear instead of exponentially fast
- **Ease-in/ease-out on ALL keyframes** — right-click keyframes, apply easing. Non-negotiable.
- **Speed ramps** — slow at reveals, fast through transitions
- **Use the Roll parameter** — slight camera roll on turns mimics real FPV drone movement
- **Longer duration** — 12+ seconds per movement, not 8. Let it breathe.

### Compositing & polish (the 80/20)
- **3D-tracked elements in After Effects** — birds, flags, boats, clouds. The #1 thing that separates @andras.ra from everyone else.
- **Motion blur** — add in post if Earth Studio doesn't provide enough. Critical for fast movements.
- **Atmospheric haze / fog** — adds depth and realism, hides CG edges
- **Color grading** — warm golden hour OR moody blue hour. Never raw Earth Studio colors.
- **Lens effects** — subtle lens flare, chromatic aberration, vignette. Sells the "real camera captured it" illusion.

### Storytelling & format
- **Start with a hook** — don't begin with the zoom. Start with text or close-up that stops the scroll.
- **Music sync** — beat drops align with dramatic reveals (property, mountain view, neighborhood arrival)
- **Text overlays** — location name, property details, brief callouts timed to movement
- **Reveal structure** — build anticipation, then show payoff. Fly through the neighborhood FIRST, then reveal the property.
- **Enable clouds + 3D buildings** — turns flat areas into dynamic cityscapes

### Technical settings
- Render at **4K (3840×2160)** — downscale for social, capture at max quality
- **60fps** for slow-motion flexibility, 30fps for standard cinematic pacing
- Use Earth Studio's **cloud rendering** for faster turnaround
- Export **3D tracking data (.jsx)** with every render — needed for After Effects compositing
- Set **Track Points** at key locations BEFORE rendering so you can place graphics precisely in AE

---

## Tool stack

### Tier 1 — foundation
| Tool | What it does | Cost |
|------|--------------|------|
| **Google Earth Studio** | Browser-based animation tool for satellite/3D imagery. Keyframe camera movements, export 4K at 60fps. | Free |
| **Google Aerial View API** | Pre-rendered cinematic flyover videos of specific addresses. Programmatic. | API pricing |
| **Google Photorealistic 3D Tiles** | Raw 3D tile data. OGC 3D Tiles format. | API pricing |

### Tier 2 — post-production (where the magic happens)
| Tool | What it does | Why |
|------|--------------|-----|
| **Adobe After Effects** | Compositing, 3D tracking, motion graphics, color grading | Earth Studio exports camera data directly to AE — this IS the designed workflow |
| **Mago Studio** | AI video-to-video style transfer | Transforms Earth footage into stylized cinematic looks |
| **GEOlayers 3** (AE plugin) | Map animations with motion blur | Adds proper motion blur to map movements |

### Tier 3 — 3D rendering engines (alternative paths)
| Tool | When |
|------|------|
| **CesiumJS** | Web-based interactive experiences, JS 3D globe with 3D Tiles |
| **Cesium for Unreal** | Game-engine quality flyovers, photogrammetry 3D tiles |
| **Three.js + 3DTilesRendererJS** | Custom web 3D experiences (NASA JPL loader, enhanced by Cesium) |
| **deck.gl** | WebGL-powered geospatial data viz |
| **Blender** | Stylized / custom city animations |

### Tier 4 — AI enhancement (the new frontier)
| Tool | What it does |
|------|--------------|
| **Higgsfield AI** | Earth zoom-out/in effects from photos (powers the viral "Eye Zoom" trend too) |
| **Mago V3** | Zero-flicker video style transfer |
| **Various AI generators** | Quick earth-zoom effects for social (Media.io, Pixelverse AI, Revid.ai, Somake AI) |

---

## Workflow

```
1. Google Earth Studio
   → Set up cinematic camera path (FPV style, 40–60° tilt)
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

1. **The "Impossible Drone Shot" Listing Video** — @andras.ra style FPV flyperlapse: start in the Cascades, swoop through downtown Bend, follow the Deschutes River, land at the property. Composite in birds, kayakers, cloud shadows. 30–60s.

2. **The Earth Zoom-In** — Start from space → through clouds → land in Central Oregon → reveal neighborhood → end on the property's front door. The viral AI zoom trend done at higher quality with Earth Studio + AE.

3. **Neighborhood Story Tour** — Fly through the neighborhood showing proximity to trails, breweries, schools, the river. Text callouts appear 3D-tracked to locations. "2 min to Phil's Trail" floating next to the trailhead.

4. **Before/After Development Viz** — For new construction or development projects, show the 3D tiles of current area, transition to rendered concept art of what's coming.

5. **Seasonal Showcase** — Earth Studio's Time of Day parameter lets you show the same property/neighborhood at golden hour, blue hour, winter, summer. Cut between matched camera moves.

6. **The "You Won't Believe This Is Google Earth" Hook** — Reveal-the-process content gets massive engagement. Show the final cinematic, then "100% Google Earth" reveal. Tutorial-style content positions Matt as the tech-forward agent.

---

## Creators to study (verified April 2026)

| Creator | Platforms | What they do |
|---------|-----------|--------------|
| **@andras.ra** (Andras Ra) | TikTok, IG, Threads, FB | Coined "Flyperlapse" — virtual FPV through Paris, London, Rio. 100% Google Earth Studio + AE. 3D-tracked composited elements (birds, flags, boats) sell the realism. Free tutorials drive massive engagement. |
| **@dronegraphy.co** | TikTok | Curates and reposts the best drone + virtual drone content (including @andras.ra). Useful for trend monitoring. |
| **@geodesaurus** (Geo Rutherford) | IG (787K), TikTok (1.8M) | Geography + mapping content with strong visual storytelling. Proves location-based content has a huge built-in audience. |
| **Emberlite** (Eric Godlow) | Multiple, hundreds of thousands of views | Self-taught animator; nostalgic stylized 3D Toronto cityscape in Blender. Each 10s clip = 20–30 hours. Audience requests specific neighborhoods. **Imagine this for Bend listings: "here's your neighborhood, reimagined."** |
| **ai.otiv** (Ludovit Nastisin) | Featured by Mago Studio (Creator of the Month, Oct 2025) | Earth Studio + Mago AI style transfer + AE compositing. Turns recognizable Google Earth into Hollywood aerial-unit footage. |

### The "AI Earth Zoom Out" viral trend

Over **250,000 monthly searches** for "AI Earth zoom out." Videos that start on a close-up (person, building, street) and pull back smoothly to reveal city, country, Earth, eventually outer space. Think the opening of *Contact* but for TikTok.

**Tools powering it:** Higgsfield AI (also powers the viral "Eye Zoom" trend), Media.io, Pixelverse AI, Revid.ai, Somake AI, Earth Studio for the higher-quality manual version.

**Why it matters here:** Imagine starting on the front door of a listing, pulling back to show the neighborhood, the mountains, all of Central Oregon from space. Ultimate "look where this property sits in the world" shot. PROVEN viral format.

---

## Quality gate

Master skill §6 applies to the final cut. Specific to flyovers:

- [ ] Camera tilted 40°–60° (not flat top-down)
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
- [ ] Per repo `CLAUDE.md` §0 — any on-screen claims about distance, drive time, school proximity etc. trace to an actual measurement (Google Maps API distance matrix, not "I think it's a few minutes")

---

## Cost / time expectations

- **Earth Studio camera path:** 30–60 min for a polished move
- **Cloud render at 4K, 30s clip:** 15–45 min depending on complexity
- **AE composite (birds + grade + lens + tracked text):** 2–4 hr per clip — this is the skill, not the tool
- **Total per published flyover:** half a day to a full day. The "free tools + 2–3 hours of post" formula is real, but the post hours are real hours.

If half a day is too much for the deliverable: don't ship a flyover. Pull a Snowdrift Visuals real-drone clip from the Drive library instead. The flyover is reserved for the deliverables that justify the production time — hero listing launches, headline neighborhood spotlights, signature pieces.
