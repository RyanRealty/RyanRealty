# VISUAL_STRATEGY.md — The creative brief every video follows

**Read this before scaffolding any BEATS array.** This file says *what should be on screen* for each content type. It is opinionated by design. If a build needs to deviate, surface to Matt before rendering — don't pick a different visual language and present it as a fait accompli.

The five content types Ryan Realty produces:
1. **Listing videos** (a real listing, 30-45s, sells the home)
2. **Market reports** (Bend / Redmond / Sisters / Tumalo / La Pine / Sunriver, monthly)
3. **News clips** (industry news, market shifts, policy, 30-45s)
4. **Evergreen education** (20+ topics, real estate fundamentals, repurposable)
5. **Tetherow / luxury** (different visual standard from the rest)

Every type is portrait 1080×1920, 30 fps, captions burned in. The differences below are everything else.

---

## §1 — LISTING VIDEOS (the hero format)

### What a listing video is for
Convince a viewer that they need to see this house in person — or, if they can't, that it's the kind of home a friend of theirs is looking for. Saves and shares are the metric, not views.

### Primary visual source: AI-generated cinematic clips from real listing photos
**Default tool: Replicate Kling v2.1 Master.** Image-to-video on each hero photo. 5s clips. Slow, deliberate camera moves — push-in, pull-back, parallax-pan, ceiling-down-to-eye-level. Never zoom-and-shake. Never spin. Never the AI-default "drift left then right" hand-puppet motion.

**Fallback when Kling rejects a prompt or the photo:** Replicate Wan 2.5 i2v (better fidelity to start frame) → Hailuo 02 → Seedance 1 Pro.

**When to mix in a real video clip:** if the listing has agent-shot 4K drone footage or a Matterport tour, splice 1-2 of the strongest beats into the back half. Use the AI-generated work for the cold open and the hero shot, real footage for the kitchen / view / yard reveal.

**Stock footage: never.** A listing video that uses Unsplash or generic drone clips of "Bend" instead of the actual listing is a content fail — it dilutes the specific home into a category.

### Motion style
**Cinematic slow.** Each beat is 2.5-3s, never under 2.5s on a text-heavy first scene (CLAUDE.md pacing rule). The hook beat (frame 0 → 2.5s) is a Kling push-in on the strongest exterior shot. From there, alternate exterior↔interior↔detail.

Camera vocabulary, in order of preference:
1. Slow push-in (3-5% scale move over 5s)
2. Push counter (camera dollies left while subject pans right — creates depth)
3. Vertical reveal (start on detail, tilt up to wide)
4. Parallax pan (Kling/Luma render this natively from a single still)
5. Ceiling-to-eye-level (pulls viewer into the room)
6. Drone-style sweep (Luma Ray 2 — reserved for properties with view + acreage)

**Banned:** zoom-and-shake (the iPhone-real-estate cliché), the "spinning vase" 360, anything where the room geometry warps because the AI couldn't track perspective.

### Transitions
**Match cuts only on listing video.** No fades between beats — fades read as amateur. Cut on motion (push-in ends → next beat begins on a counter-push) or cut on shape (window framing in beat A → mirror framing in beat B). Whip pans are allowed once per video, used to bridge interior → exterior.

### Color grading
**Tetherow tier:** clean, slight warmth (+150K), desaturated greens (real estate AI-generated foliage tends toward cartoon green — knock saturation -10), highlights protected.
**Bend / Redmond standard:** golden-hour warmth where the photo was shot at golden hour; otherwise neutral. Don't fake sunsets.
**Never:** the orange-and-teal Hollywood look. It signals "ad" and tanks retention.

LUT/grade implementation: pass clips through a Remotion `<ColorMatrix>` or a `colorGrading` filter prop in the Sequence. Document in the citations.json.

### Typography
- Address ribbon: AzoSans 56px, bottom-zone (y 1480-1720), 70% navy pill `rgba(16,39,66,0.70)`, 24px corner radius, 2px gold top border. Same spec as news-clip caption pill (CLAUDE.md). Address spelled out: "61271 Kwinnum Dr, Bend OR 97702" — no abbreviations.
- Price reveal at the 50% mark: Amboqia 96px, gold `#C8A864`, drop-shadow `rgba(0,0,0,0.40)`, springs in over 12 frames. **Always carries units:** "$3,025,000" not "3,025,000."
- Stat strip (beds/baths/sqft/acres) at 75% mark: AzoSans 56px, single line, four pills.
- **No agent name, no phone, no URL, no Ryan Realty logo in the frame.** End card uses `listing_video_v4/public/brand/stacked_logo_white.png` only.

### What makes this scroll-stopping vs forgettable
**Scroll-stopping:** real-cinematographer camera move on a recognizable home + a hook line that names something specific in the first 1.5s ("3.2 acres on Tetherow's 14th green" — not "stunning Bend home").
**Forgettable:** a slow boundary-line draw on a static image, a logo + agent name in the cold open, generic exterior + price card.

---

## §2 — MARKET REPORTS (monthly per geography)

### What a market report is for
A licensed broker's POV on what the data is actually saying this month. Builds authority. Drives email signups for the long-form report. Saves matter; views matter less.

### Primary visual source: hybrid — AI cinematic b-roll + Remotion data visualization
**The big shift from previous builds:** stop using Unsplash stock for b-roll. Generate cinematic clips of the actual city.

For Bend market report specifically:
- 4-5 Kling/Veo clips at 5s each, prompted on real Bend landmarks: Pilot Butte at golden hour, Mt. Bachelor in the distance over Old Mill rooftops, Deschutes River from above the Old Mill footbridge, downtown Bend at dusk with the streetlights coming on, Awbrey Butte residential streets in autumn.
- These b-roll beats interleave with the data viz — never two data beats in a row.
- For neighborhoods that don't have AI-recognizable landmarks (Tumalo, Tetherow, La Pine), use Veo 3 because its native ambient audio (creek, wind, birds) gives the place a sonic identity.

**Data visualization:** Remotion-rendered, never AI-generated. Charts, countup numbers, kinetic stat reveals, market-condition pills. Spec:
- Active listings count: kinetic countup, AzoSans 96px, gold accent on the comma.
- Median price: spring in from 0, hold 2.5s minimum so the viewer can read it.
- Months of supply: animated bar that fills against the threshold zones (≤4 = seller's, 4-6 = balanced, ≥6 = buyer's). Color-coded.
- YoY change: arrow that draws on, percentage springs in. Red for down, green for up — never the inverse.
- DOM: simple stat with a small line chart of the last 6 months underneath.

### Motion style
**Cinematic medium.** Beats are 3s default, 4s max for any beat that's purely b-roll. Data beats can be as short as 2.5s if the number is already on screen and just changing.

The viewer should feel like they're watching a Bloomberg-meets-MKBHD market analyst — confident pacing, no rushed transitions.

### Transitions
- B-roll → b-roll: match cut on motion direction.
- B-roll → data: whip pan (8-frame motion blur) into the chart.
- Data → data: slide-up reveal (the next stat slides up from below the previous).
- Data → b-roll: cross-dissolve over 12 frames is acceptable here only — gives the viewer a beat to absorb the number.

### Color grading
- B-roll: city-specific. Bend = warm golden tones (real Bend light is golden 8 months of the year — don't fight it). Redmond = neutral, slightly cooler (high desert light is harder, more direct). Sisters = warm but desaturated greens. La Pine / Sunriver = green forward, deep blue sky.
- Data viz: brand palette only. Navy `#102742`, gold `#D4AF37` (news/market accent), cream `#F2EBDD`, charcoal `#1A1A1A`.

### Typography
- City name in cold open: Amboqia 96px, springs in, 3s minimum hold (CLAUDE.md pacing rule applies hard here — "Bend Market Report" must be readable).
- Stat headlines: AzoSans 64px, white, drop-shadow.
- Stat numbers (the big one in each beat): Amboqia 120px, gold or white.
- Verdict pill (final beat): "Seller's Market" / "Balanced Market" / "Buyer's Market" — AzoSans 56px in a 70% pill, 28px corner radius, color-coded to the verdict. **Must match the months-of-supply number on screen.** This is the #1 narrative-vs-data inconsistency we've shipped historically (CLAUDE.md §0). Re-check every render.

### What makes this scroll-stopping vs forgettable
**Scroll-stopping:** the cold open shows real Bend (Pilot Butte at sunset, AI-generated but recognizable), the first stat is "Median price: $785,000 — up $32,000 since January," and the verdict pill at the end is consistent with the data underneath it.
**Forgettable:** an Unsplash stock photo of "house" + a chart that fades in + a verdict that contradicts the months-of-supply number on screen.

---

## §3 — NEWS CLIPS (industry / policy / market shifts)

### What a news clip is for
Establish that Ryan Realty has a POV on what's happening in the industry. Drive comments and saves. The fastest format to produce — should be in queue within 24 hours of a real news event.

### Primary visual source: hybrid — real footage clips + Remotion code-generated graphics
News needs to feel like news. That means real footage of the people and places involved, not AI-fabricated scenes.

**Tier 1 (preferred):** licensed Shutterstock footage of the specific event/person/building — federal officials at a podium, a Federal Reserve building, a stock-market trading floor, a city council chamber. Shutterstock is paid, license per asset, but the credibility lift is enormous.
**Tier 2:** Unsplash for B-roll where Shutterstock doesn't have it (suburban housing development, generic "for sale" sign, generic "moving truck"). Always prefer recognizable real-world over AI-generated for news.
**Tier 3:** Code-generated graphics (Remotion) for any data-heavy beat — interest rate chart, NAR settlement timeline, MLS-vs-CoStar venn, etc.
**Tier 4 (fallback only):** AI-generated clip — but only when no real footage exists for the topic and it's clearly a stylized illustration, not pretending to be real news footage. **AI disclosure required in caption** (CLAUDE.md / ANTI_SLOP_MANIFESTO).

### Motion style
**Fast cuts.** News-clip beats are 2-2.5s. No beat over 3s. The energy is informational urgency, not contemplative.

Camera moves on real footage: minimal — let the footage speak. Camera moves on graphics: kinetic — bars draw, lines plot, numbers count. The contrast is the visual rhythm.

### Transitions
- Hard cuts on real footage (no fades).
- Slide-up reveals for stat overlays.
- Whip pan once per clip max — used as the bridge between "the news" (footage) and "the implication" (graphic).
- News-style lower thirds for any sourced quote.

### Color grading
- Real footage: don't grade. Leave it as shot. News footage that's been color-graded reads as ad — the lack of grading IS the credibility signal.
- Graphics: brand palette. Navy + gold + cream. The breaking-news red `#D62828` is allowed only on a true breaking-news pill.

### Typography
- BREAKING badge (when warranted): Amboqia 48px, white on red `#D62828` pill, top-left corner, 2s pulse.
- Headline: AzoSans Bold 64-80px, white, drop-shadow, max 8 words. ("MEDIAN HOMES PRICE FALLS $32K IN ORANGE COUNTY" not "Median home prices have fallen by $32,000 in Orange County this past quarter.")
- Source attribution: AzoSans 32px, bottom-left or bottom-right. Always present. Always linkable in the description.
- Number callouts: Amboqia 96-120px, gold or red depending on direction.

### What makes this scroll-stopping vs forgettable
**Scroll-stopping:** real footage of Jay Powell at a Fed press conference + a kinetic stat showing the rate decision + a 4-word implication ("Mortgages just got cheaper").
**Forgettable:** code-generated graphics over a navy background + a wall of text + no source citation.

---

## §4 — EVERGREEN EDUCATION (real estate fundamentals)

### What evergreen is for
Build the back catalog. Each video answers one question (`How does an FHA loan work?`, `What is escrow?`, `Should I buy points?`). Plays in repurposed batches across the year. SEO-driven on YouTube; engagement-driven on TikTok/IG.

### Primary visual source: stylized illustration + screen recordings + brief AI clips
Evergreen content shouldn't pretend to be reality (it's an explainer, not a news event) and shouldn't pretend to be a specific listing (no real address). It should feel like the visual equivalent of a great whiteboard — clear, friendly, animated.

**Default visual stack:**
- Stylized AI-generated illustrations (Grok Imagine — `grok-imagine-image-pro` — produces a non-photoreal look that signals "this is a teaching moment, not a real situation"). Generate 3-4 illustrations per topic.
- Animated typography for definitions, formulas, examples.
- Screen recordings of real workflows where appropriate (loan estimate doc walk-through, MLS search demo, escrow timeline).
- Optional: 1-2 short Kling clips (5s each) of contextual scenes — keys changing hands, paperwork being signed, a first-time buyer at an open house — used sparingly so the format doesn't become AI-overload.

### The 20-topic visual matrix

Each topic gets its own visual identity built from the same components:

| Topic | Hero illustration concept | Data viz | Real footage |
|---|---|---|---|
| What is escrow? | Hands holding a key in a glass cube labeled "ESCROW" | Timeline animation: Day 1 → Day 30 → Day 60 | Screen rec of an escrow disclosure doc |
| How FHA loans work | Stylized house with "3.5% DOWN" overlay | Side-by-side: FHA vs Conventional | Screen rec of FHA loan estimate |
| Closing costs explained | Pie chart of cost categories | Animated breakdown by line item | Stock footage of closing-table signing |
| Buying points | Trade scale: cash on left, lower rate on right | Break-even curve animated | Screen rec of points calculator |
| What is PMI | House illustration with PMI label that "drops off" at 78% LTV | LTV ratio bar chart | None |
| Pre-approval vs pre-qualification | Two paths animation, one labeled stronger | Strength rating | Stock footage of mortgage broker handshake |
| How earnest money works | Stylized check with shield around it | Earnest money escrow timeline | Screen rec of EM disclosure |
| Inspection contingency | Magnifying glass over house, finding issues | Issue → option matrix | Stock footage of inspector with clipboard |
| Appraisal contingency | Scale: home value vs loan amount | Appraisal gap animation | None |
| Title insurance | Stylized title document with shield | Coverage timeline | Stock footage of title office |
| HOA basics | Houses connected by community lines | HOA fee breakdown chart | Stock footage of HOA meeting |
| Property taxes | Stylized house with tax envelope | Tax bill breakdown by service (school, county, etc.) | None |
| Capital gains on home sale | Two houses (sold, bought) with $ flow | $250k/$500k exclusion explainer | None |
| 1031 exchange | Two properties with arrow swap, "180 days" label | Timeline of the exchange windows | None |
| Buying with cash vs financing | Two paths with pros/cons | Total cost over 30y comparison | None |
| ARM vs fixed-rate mortgage | Two graph lines, one straight, one stepping up | Rate curve comparison | None |
| Refinance break-even | Graph of break-even point | Cost-to-savings calculator | None |
| HELOC vs cash-out refi | Two financial instruments compared | Side-by-side cost analysis | None |
| Selling FSBO vs with agent | Two paths animation | Net proceeds comparison | None |
| Buying agent commission post-NAR | Stylized buyer-broker agreement | Compensation flow diagram | Stock footage of NAR settlement news (real footage) |

**One template per topic, but the components are the same.** That's how we keep production cost low — one Remotion comp called `<EvergreenExplainer>` that takes `topic`, `hero_illustration`, `data_viz_component`, `real_footage_clip`, and `vo_lines` as props.

### Motion style
**Mid-tempo, friendly.** Beats are 2.5-3s. The pacing tells the viewer "you have time to absorb this." Two-clause max sentences for VO (CLAUDE.md / Victoria voice settings).

Animation vocabulary:
- Spring physics on every entrance (stiffness 80-120, damping 12-15).
- Numbers that count up (CountUp library or Remotion `interpolate`).
- Lines that draw on (SVG `<path>` with `pathLength` interpolated).
- Icons that pulse on emphasis (scale 1.0 → 1.06 → 1.0 over 18 frames).
- Cross-dissolve transitions, not match cuts (this is teaching, not action).

### Color grading
- Brand palette only. Navy + gold + cream + charcoal. No off-brand hex.
- One accent color per topic, drawn from the gold/red/green spectrum based on whether the topic is neutral / risk / benefit. (Risk topics like ARM, HELOC, foreclosure get the red accent; benefit topics like 1031, capital gains exclusion get the gold.)

### Typography
- Topic title: Amboqia 96px, gold, intro hold 3s minimum.
- Definition cards: AzoSans 56px, white text on navy pill.
- Numbers/formulas: Amboqia 96px, gold.
- Source citation (when stating a stat or rule): AzoSans 28px, bottom-left, always linkable.

### What makes this scroll-stopping vs forgettable
**Scroll-stopping:** "If you've ever asked your lender what 'escrow' actually does — here's the 30 seconds you need" + the visualization shows you the money flowing into and out of the escrow account.
**Forgettable:** stock photo of a house + voiceover reads the dictionary definition.

---

## §5 — TETHEROW / LUXURY (different visual standard)

### What luxury is for
Tetherow content sells a lifestyle, not a house. The viewer is — or aspires to be — a buyer who will spend $2-5M, who is comparing Bend against Park City, Sun Valley, Jackson Hole. The video must hold up against what those markets put out.

### Primary visual source: licensed Shutterstock + AI cinematic + drone footage
**The mix is the message.** Pure AI-generated content reads as cheap to a luxury buyer. Pure stock reads as a brokerage that doesn't know its market. Pure agent-shot footage reads as amateur. The blend is what signals the listing knows what it is.

**Tier 1 (the hero):** Licensed Shutterstock 4K luxury interior footage when the actual property doesn't have professional cinematography (kitchen close-ups with steam, fireplace inserts, wood-grain detail shots). Always verify the footage doesn't conflict with the listing's reality — if Shutterstock shot is a Tuscan kitchen and the listing has a modern white-and-stone kitchen, kill it.
**Tier 2:** Real drone footage of the property when available. If not, Replicate Luma Ray 2 720p with a prompt grounded in the property's actual context ("modern lodge home, larch siding, snow-covered spruce around it, drone push toward great-room windows showing fireplace lit inside").
**Tier 3:** Replicate Kling v2.1 Master image-to-video on hero photos.
**Tier 4:** Veo 3 for any beat where ambient sound matters (creek, fireplace, snow falling). Native audio = lifestyle signal.

**Banned in luxury:** Unsplash. Generic "Bend mountain" stock. Any AI generation that fabricates a recognizable feature that doesn't exist in the actual home.

### Motion style
**Cinematic slow, with conviction.** Beats are 3-4s — never under 3s. The viewer should feel the camera is held by someone who is patient and specific.

Camera vocabulary, in priority order:
1. Slow drone-style sweep (Luma Ray 2)
2. Push-in through doorway / through window (Kling — uses parallax to create depth)
3. Held wide of the building with one element of motion (smoke from chimney, water in pool, snow falling)
4. Slow vertical reveal — start on detail (fireplace, wine cellar door, espresso machine), tilt up to wide
5. Reverse dolly out from a hero detail to reveal the room

**Banned:** quick cuts, whip pans, anything that breaks the meditation of the format.

### Transitions
**Match dissolves.** 18-24 frame cross-dissolves on motion alignment. The viewer should not consciously notice the cut. This is the only Ryan Realty format where dissolves are preferred over cuts — at this price tier, the calm pacing is a price-justification signal.

### Color grading
**Neutral with intentional warmth.** Highlights protected (no blown-out windows). Shadows lifted slightly so the viewer can see into the dark wood / black metal / stone fireplace surrounds that define the architecture.

Tetherow-specific: lift the greens of the golf course, but keep them realistic — no Augusta-cartoon green. Skies are deep blue (high-desert blue), never the gradient blue of an iPhone.

LUT: build a `tetherow.lut.cube` and apply consistently across every Tetherow video. Document in citations.json.

### Typography
- **Less is more.** One overlay per beat, max.
- Address: AzoSans Light 48px, lower-third, no pill — just white text with a subtle shadow.
- Price reveal: Amboqia 144px, slow spring (24 frames), gold `#C8A864` (the muted luxury gold, not the brighter `#D4AF37` we use on news). 4s hold.
- Stat strip: AzoSans 48px, single line, lots of letter-spacing (luxury negative space).
- Tagline (final frame): Amboqia Italic 56px, cream `#F2EBDD`, centered.

### What makes this scroll-stopping vs forgettable
**Scroll-stopping:** the camera doesn't move for the first 2 seconds — just holds on a wide of the home with smoke from the chimney drifting up — and then a single line of type appears: "On the 14th green at Tetherow." The pacing IS the brand.
**Forgettable:** quick cuts of the kitchen + bathroom + bedroom + price card. Reads as $400k home presented at $4M price.

---

## §6 — Universal rules (apply to all five formats)

These are the cross-cutting rules that any format must clear. Most are restated from CLAUDE.md / VIDEO_PRODUCTION_SKILL.md / ANTI_SLOP_MANIFESTO.md / VIRAL_GUARDRAILS.md but consolidated here for quick reference:

1. **Length:** 30-45s for viral cuts. 60s max for long-form market reports. Never over 60s.
2. **Hook:** motion by frame 12 (0.4s), text by frame 30 (1.0s), specific element (number, place name, contradiction) named by 1.5s.
3. **Captions:** burned in. Reserved safe zone (y 1480-1720). Word-by-word kinetic, synced to ElevenLabs `/v1/forced-alignment` timestamps. Never cross other rendered overlays. (CLAUDE.md §0.5 — non-negotiable.)
4. **Brand:** no logo, no "Ryan Realty" text, no phone number, no agent name, no URL anywhere in the video frame. End card uses `listing_video_v4/public/brand/stacked_logo_white.png`.
5. **Voice:** Victoria only. `qSeXEcewz7tA0Q0qk9fH`. `eleven_turbo_v2_5`. stability `0.50`, similarity_boost `0.75`, style `0.35`. `previous_text` chained.
6. **Banned words:** stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, approximately/roughly/about (as data substitute), em-dashes, semicolons, AI filler (delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock).
7. **Data accuracy:** every number traces to Supabase or Spark or a named primary source. Cross-check Spark vs Supabase for market figures. `|delta| > 1%` halts the render. (CLAUDE.md §0 — outranks every other rule.)
8. **AI disclosure:** any AI-generated visual that could be mistaken for real footage gets an "AI VISUALIZATION" subtle tag in the caption. Required by ANTI_SLOP_MANIFESTO and Oregon real estate advertising rules.
9. **Music:** beat-synced or none. No "real estate stock music" loops.
10. **Quality gate + scorecard:** ffprobe → blackdetect strict → frame extraction → banned-word grep → number trace audit → viral scorecard against format minimum → `out/<deliverable>/scorecard.json` written. Then ask Matt for approval. Then commit.

---

## §7 — Decision matrix: pick the right format fast

| Trigger event | Default content type | Variant if applicable |
|---|---|---|
| New listing goes Active in Spark | Listing video | If price > $1.5M, Tetherow/luxury template |
| Monthly market data refresh (1st of each month) | Market report | One per geography, parallel render |
| Federal Reserve announces rate decision | News clip | Run within 24 hours |
| NAR / state policy change | News clip | Run within 24 hours |
| MLS metric crosses a threshold (months of supply flips, median crosses round number) | Market report (interim) | Or news clip if it's a national headline |
| Buyer/seller asks the same question 3+ times in DMs | Evergreen education | Add to the matrix in §4 |
| Tetherow listing with view + acreage + > $2.5M | Tetherow/luxury | Always, even if it's a refresh |

---

## §8 — When to read the full skill files

This document is the creative-brief layer. For implementation specifics — frame-by-frame hook spec, full quality gate, BEAT array engineering, scorecard math — read:

- `VIDEO_PRODUCTION_SKILL.md` (master skill, end-to-end)
- `VIRAL_GUARDRAILS.md` (100-point publish gate)
- `ANTI_SLOP_MANIFESTO.md` (banned content)
- `WORKFLOWS.md` (step-by-step build pipeline per format — start here for any new build)
- `API_INVENTORY.md` (which tool is up, which is down, which is unused)
