# Tool Mastery: AI Image Generation + Viral Static / Carousel / Thumbnail (2026)

**Written:** 2026-05-29
**Scope:** AI image model profiles, prompting, decision tree, carousel/static patterns, thumbnail science, slop avoidance, brand consistency.
**Feeds:** `marketing_brain_skills/producers/` flat-design producers (fb-lead-gen-ad, ig-carousel, linkedin-doc-carousel, flyer-design, map-static-card, thumbnail generators)
**Cross-references:** `out/design-recon/*/recon.md`, `docs/research/grok-imagine.md`, `docs/research/replicate-platform.md`, `design_system/ryan-realty/SKILL.md`

---

## 1. AI Image Model Profiles (2026)

### 1.1 Model landscape overview

The field consolidated around four leaders in 2026. Every model below has a confirmed API we can call:

| Model | Slug / API | Cost per image | Strength | Weakness |
|---|---|---|---|---|
| **Flux.2 Pro** | `black-forest-labs/flux-2-pro` on Replicate | ~$0.015 + $0.015/MP | Photoreal scenes, architectural, lifestyle | Needs precise prompting for brand color fidelity |
| **Flux.2 Max** | `black-forest-labs/flux-2-max` on Replicate | Per-MP (higher tier) | Highest ceiling on material realism, character consistency | Slower (premium tier) |
| **Flux.2 Flex** | `black-forest-labs/flux-2-flex` on Replicate | $0.06/MP | Typography, complex layouts, fine-grained detail | 22s generation time |
| **Flux.2 Dev** | `black-forest-labs/flux-2-dev` on Replicate | $0.012/MP | Open-source, fast (2.5s), cost-efficient | Lower ceiling than Pro/Max |
| **Flux Kontext Pro** | `black-forest-labs/flux-kontext-pro` on Replicate | Per-MP | Text-based editing: swap objects, change text in existing images | Edit-only, not generate |
| **Flux.1.1 Pro Ultra** | `black-forest-labs/flux-1.1-pro-ultra` on Replicate | Per-MP | 4-megapixel native, "raw" mode for candid realism | Previous generation |
| **Grok Imagine** | `grok-imagine-image` / `grok-imagine-image-quality` via XAI_API_KEY | $0.02 / $0.07 | Speed (up to 10 images/call), quick variant grids | Lower photorealism ceiling than Flux.2 Max |
| **Ideogram v3** | Ideogram API | $0.0375 (Turbo) / $0.075 (Default) / $0.1125 (Quality) | Text-in-image: 90-95% accuracy; typographic design | Not a scene/photoreal model |
| **GPT Image 2** | OpenAI API | ~$0.04-0.08 | Dense text rendering (99.2% accuracy), brand consistency | Not a photoreal specialist |
| **Imagen 4** | Vertex AI (`vertex-imagen-4.md`) | $0.02-0.04 | Fine architectural detail, text rendering, strong instruction-following | Google cloud dependency |

### 1.2 Flux.2 Pro — primary model for Ryan Realty

**Why it wins for real estate:** Flux.2 Pro closes the gap between AI and real photography on skin, hair, fabric, architectural materials (stone, wood, glass), and depth-of-field coherence. It runs at 6 seconds per image on Replicate, accepts up to 8 reference images for consistency, and handles interior design / architectural visualization as named use cases.

**Replicate slugs (verified 2026-05-29):**
- `black-forest-labs/flux-2-pro` — default workhorse
- `black-forest-labs/flux-2-max` — premium ceiling (character consistency across 8 refs)
- `black-forest-labs/flux-2-flex` — typography and layout work
- `black-forest-labs/flux-2-dev` — fast open-source option

**Prompting rules for Flux (differs from Midjourney/SDXL):**

1. **Natural language, not keyword lists.** Flux uses a T5 encoder that understands sentences. Write as you'd describe a scene to a photographer.
   - WRONG: `house, exterior, dusk, dramatic, 8k, masterpiece, photorealistic`
   - RIGHT: `Exterior of a modern ranch home in high desert Oregon at dusk, warm amber light from the west, sage brush in the foreground, Cascade volcanic peak visible on the horizon, shot on a Sony A7R IV with a 24mm f/2.8 lens, shallow depth of field`

2. **No Midjourney syntax.** No `--ar`, `--v`, `--style`, no `(keyword:weight)` — Flux ignores or renders these as literal text.

3. **No negative prompts.** Tell Flux what you want, not what to avoid. Prefer `sharp focus, natural proportions, accurate hands, matte skin` over listing exclusions.

4. **Camera specs are powerful.** The T5 encoder maps specific cameras to their visual characteristics. Include real camera names and lens specs for the look you want.

5. **Imperfections prevent slop.** Add texture language: `weathered cedar siding`, `worn brick path`, `overcast Pacific Northwest sky with real cloud texture`. Avoid `perfect, flawless, pristine, studio-polished`.

**Copy-ready real estate prompts (Flux.2 Pro):**

*Bend/high-desert lifestyle scene (social hero):*
```
A couple in their early 40s sitting on a modern deck overlooking a high-desert valley, Central Oregon, late afternoon golden hour light, juniper and sage foreground, Three Sisters peaks soft in the distance, natural relaxed posture, deck furniture in weathered teak and natural linen, no logos or text, shot on Sony A7IV 50mm f/1.8 ISO 200, warm cinematic color grade
```

*Interior hero (listing-adjacent — use for social lifestyle, NOT for the actual listing):*
```
Light-filled great room in a Pacific Northwest modern farmhouse, vaulted Douglas fir beams, a stone fireplace with a natural rough-cut mantle, floor-to-ceiling windows showing snow-capped volcanic peaks, white oak floors, late morning sun casting long shadows across the room, no staging props visible, shot on Canon R5 24mm tilt-shift, architectural photography
```

*Neighborhood lifestyle (Bend local):*
```
Aerial view of a small Western mountain town at sunrise, a river with a historic steel truss bridge, ponderosa pine forest meeting the edge of town, a volcanic butte visible to the south, early morning mist over the water, Canon R5 Mark II aerial shot from a drone at 400 feet, documentary photography, no text
```

*Market data social card scene (stylized/illustrative — for branded overlays):*
```
Clean flat overhead view of a residential neighborhood map rendered in a warm navy and cream color palette, illustrated style, minimal detail, white space at top and bottom for text overlay, no text in the image itself, 1080x1080 square composition
```

### 1.3 Ideogram v3 — text-in-image specialist

**When to use:** Any generated image that must contain readable text. Ideogram hits 90-95% text accuracy vs Flux's ~40-60% and Midjourney's ~30-40%. This makes Ideogram the production-safe choice for:
- Social data cards with text baked into the image
- Thumbnail variants with a word or number in the generated scene
- Stylized "quote cards" where the text is part of the visual composition

**Pricing:** $0.0375 Turbo / $0.075 Default / $0.1125 Quality (May 2026)

**API:** `docs.ideogram.ai` — supports Text to Image, Edit, Reframe, and Remix.

**When NOT to use:** Photoreal architectural scenes or lifestyle photography. Ideogram is a typographic composition model, not a photorealism model.

### 1.4 Grok Imagine — variant grids and speed

**When to use:** Quick A/B variant generation (up to 10 images per API call at $0.02 each), social thumbnail experiments, background scenes for composite cards. Already wired in `lib/grok-image.ts`.

**Model names (verified May 2026):**
- `grok-imagine-image` — $0.02, fast, 1k/2k resolution, up to 10 images/request
- `grok-imagine-image-quality` — $0.07, higher fidelity (replaced retired `-pro` variant as of May 15, 2026)

**Aesthetic:** Emphasizes a 35mm film candid look, natural skin, real material texture, without digital over-polishing. Good for lifestyle and neighborhood scenes where the "too perfect" AI look kills trust.

**Warning:** Grok image URLs are temporary — immediately re-upload to Supabase Storage after generation. See `docs/research/grok-imagine.md` for the full integration spec.

### 1.5 GPT Image 2 — brand text accuracy

**When to use:** Marketing cards where text accuracy is critical — property details, pricing callouts, contact info, branded infographic cards. GPT Image 2 achieves 99.2% accuracy in rendering long sentences inside images. Use it over Ideogram when you need photoreal background + legible text combined in one generation, or when you're already inside an OpenAI workflow.

**When to use Ideogram instead:** When the text IS the design — typographic posters, stylized quote cards, infographic layouts. Ideogram's text integrates as a designed visual element, not just accurate rendering.

### 1.6 Flux Kontext Pro — in-place image editing

**When to use:** Editing an existing real listing photo to swap text overlays, change a sign in the background, or apply a style transfer without regenerating the scene. This is the model for "take this real photo and change the text on the yard sign."

**NOT for:** Fabricating listing interiors or altering a real listing's condition — the data accuracy rule (CLAUDE.md §0) governs this. AI-altered listing photos require disclosure under California AB 723 (2026) and comparable standards. Oregon follows suit through OREF conduct rules.

---

## 2. AI vs Stock vs Real Photo — Decision Tree

The three-tier hierarchy. Apply in order:

```
START: What is the content type?

├── REAL LISTING CONTENT (a specific property Ryan Realty lists or represents)
│   ├── Use the ACTUAL listing photos (from Supabase listings."PhotoURL", photographer's delivery)
│   ├── AI image generation is BANNED for representing an actual property's condition or appearance
│   ├── AI editing (sky replacement, virtual staging disclosure) is allowed only with disclosure
│   └── If no usable listing photo exists → stock/lifestyle scene that does NOT imply the property
│
├── LIFESTYLE / NEIGHBORHOOD / COMMUNITY SCENE (non-specific to a property)
│   ├── First: check real existing photos from the canonical hero or broker shoots
│   │     └── Canonical hero: design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg
│   ├── Second: Unsplash / Shutterstock with verified license (see media-sourcing/SKILL.md)
│   └── Third: AI generation (Flux.2 Pro or Grok Imagine) — safe because no specific property claim
│
├── SOCIAL CONTENT HERO (market report background, brand card, data viz backdrop)
│   ├── AI generation is appropriate — no property representation, no accuracy risk
│   ├── Use Flux.2 Pro for photoreal scenes, Ideogram for text-integrated design, Grok for variants
│   └── Brand data cards: use @napi-rs/canvas compositor (our existing path) over pure AI generation
│       (Canvas gives pixel-accurate brand token compliance; AI generation adds uncertainty)
│
├── THUMBNAIL / REEL COVER
│   ├── Best: a real frame extracted from the video itself (a strong visual moment, not a black frame)
│   ├── Second: a custom static card composited in canvas/PIL with the frame as background
│   └── AI scene: only when no real frame is strong enough (rare — engineer the first frame, per CLAUDE.md)
│
└── TEXT-HEAVY CARD (social data card, market stat graphic, quote card, checklist)
    ├── ALWAYS use @napi-rs/canvas or PIL compositor — brand tokens are exact, text is pixel-perfect
    ├── AI generation for these: only for background texture / scene, then composite text on top
    └── If text must be in the AI image itself: Ideogram v3 (90-95% accuracy) or GPT Image 2 (99.2%)
```

### When AI genuinely beats stock

| Scenario | Why AI wins |
|---|---|
| Hyper-local lifestyle scene (Three Sisters + sagebrush + modern deck) | No stock library has the exact Central Oregon combination at the right time of day |
| Novel demographic composition (40s couple, Pacific Northwest casual, not catalog-model look) | Stock is over-licensed and recognizable |
| Specific architectural style variation (Craftsman + high desert modernism hybrid) | Stock forces compromise |
| 10-variant A/B test grid ($0.20 total via Grok) | Stock licensing doesn't scale this way |
| Background texture for a data card (navy-tinted abstract topographic texture) | Canvas compositor needs a base texture; AI generates a novel one cheaply |

### When stock / real photo wins

| Scenario | Why stock/real wins |
|---|---|
| Actual listing exterior | Data accuracy rule — fabricating a listing's look is a compliance violation |
| Identifiable Bend landmarks (Tower Theater, Old Mill, Deschutes River with the footbridge) | AI hallucination risk — specific landmarks must be photographically accurate. Use the canonical hero or licensed stock |
| Legal compliance images (disclosure forms, property surveys, neighborhood maps) | Must be accurate. AI fabrication is prohibited |
| Faces of real people (Matt, Paul, Rebecca) | Use the broker headshots at `design_system/ryan-realty/assets/team/` |
| Timeline-sensitive scenes (an active open house, a specific sold sign at an address) | Only real photos capture the real moment |

---

## 3. Viral Static + Carousel Patterns (2026)

### 3.1 Why carousels dominate

Data confirmed Q1 2026:
- Carousels generate **3.1x higher engagement** and are **2x more likely to be saved** than Reels
- Average engagement rate for real estate IG carousels: **1.92%** vs 0.50% for Reels and 0.45% for static
- Real estate businesses average **3.7% IG engagement** — highest of any industry
- Instagram re-serves carousels to audiences who did not swipe on first pass (built-in second-chance distribution)
- DM shares from carousels are weighted **3-5x higher than likes** by the algorithm

**Platform behavior:** Instagram rewards dwell time, completion rate (reaching last slide), and save/share rate. Design for all three.

### 3.2 Proven carousel formats for real estate (confirmed by recon + research)

**Format A — Market Data Carousel (highest save rate)**
- 8-10 slides, one stat per slide, flashcard model
- Slide 1 hook: a specific contrarian or surprising local number ("Bend inventory up 27% since 2019")
- Slides 2-6: individual stats with single-sentence context (no paragraph bodies)
- Slide 7: methodology note or source credit (builds trust, reduces skepticism)
- Slide 8: CTA — "Save this before your next offer" or "Send this to your agent"
- Design: navy/cream brand system, Geist body, Amboqia for the featured number, no photo backgrounds on data slides

**Format B — Listing Carousel (Compass 4-to-8 format)**
Per `out/design-recon/ig-carousel/recon.md` Pattern 2, confirmed across 9 top luxury accounts:
1. Cover: full-bleed hero photo, tiny logo, address overlay
2. Spec slide: cream bg, price as hero number, bed/bath/sqft, 1-line description
3. Detail shot: architectural feature or standout interior (Pattern 3 — Hilton Hyland method)
4. Map slide: Google Static Maps satellite + neighborhood name + 2-3 proximity callouts
5. Lifestyle slide: neighborhood scene (AI or licensed stock if no real photo)
6. Testimonial or context slide (prior sale, market positioning)
7. Agent card: broker headshot + name + phone (541.213.6706) + ryan-realty.com

**Format C — Educational Checklist Carousel**
- "5 things buyers miss in a home inspection" / "What to do 90 days before you list"
- 8-12 slides, one point per slide, bold headline + 2-line explanation
- Slide 1 cover: must feel incomplete without swiping — use a cropped checklist, partial diagram
- CTA: "Save this for when you're ready to list"
- Design: cream bg with navy Amboqia headlines, Geist body copy

**Format D — Before / After or Local Market Story**
- Closing day photos + story of client journey
- 6-8 slides, narrative arc: situation → challenge → result
- No price revelation in the first 2 slides (saves the payoff for mid-carousel)
- Highest share rate when relatable (first-time buyer, competitive offer, out-of-state move)

### 3.3 Slide-count guidance

| Goal | Slide count |
|---|---|
| Educational / checklist | 8-12 (more context = more saves) |
| Deep guide / case study | 12-20 |
| Listing carousel | 6-8 |
| Market data snapshot | 6-8 |
| Story / narrative | 5-7 |

Always: put a soft CTA at slide 5-6, and a direct CTA on the final slide.

### 3.4 Cover slide (Slide 1) — the hook architecture

The cover must answer instantly: "Is this for me?" and "What do I gain by swiping?"

**Confirmed high-CTR hook formulas (TrueFuture Media, Q1 2026):**
- "Stop doing X" — "Stop overpricing your listing"
- "Checklist" — "The 8-point pre-listing walkthrough"
- "Mistakes" — "5 reasons homes in Bend don't sell"
- "Number + contrast" — "Bend inventory is up 27%. Here's what it means."
- "Before / After" — "Before: no offers. After: 14 days, full price."

**Cover design rule from recon:** Make slide 1 feel incomplete. Use a cropped diagram, a partial checklist, or a split-screen where the answer is on slide 2. The crop triggers the swipe reflex.

### 3.5 The pattern all top accounts share (recon confirmation)

Confirmed across 9 luxury brokerage accounts (26 reference samples):
1. No emojis in image overlays
2. No "JUST LISTED!!" all-caps stamps — small, restrained type for status
3. Logo no larger than 100px on a 1080×1080 image
4. No urgency language ("Won't last", "Don't miss out")
5. Typography is restrained — serif/brand display for standout moments, thin sans for data
6. Negative space is the design — don't fill the frame with overlays

### 3.6 LinkedIn doc carousel (8-slide format)

Compass 4-slide format expanded to 8 for LinkedIn document format:
1. Hook slide (specific local stat or contrarian claim)
2-3. Data / value beats (one insight each)
4-5. Photo essay (listing or neighborhood)
6. Map / context slide
7. Testimonial or market read
8. Agent card (broker contact)

LinkedIn algorithm weights completion and shares over saves. Design slide 1 to be clickable from the feed preview, which shows only the cover without swipe affordance.

---

## 4. Thumbnail Science (2026)

### 4.1 The non-negotiable rules

**Faces:**
- Emotional faces boost CTR 20-30% (shock, curiosity, genuine satisfaction — not the performative YouTube "O-face")
- For real estate: Matt's face works on broker-branded content (neighborhood guides, market reports, educational long-form). For brand content (market data, news clips), omit faces per CLAUDE.md brand-first rule.
- One face, clearly lit, at 30%+ of the frame height

**Text:**
- 3-4 words maximum. The "postage stamp test" — shrink the thumbnail to 100×56px and verify legibility
- Under 5 words leads to ~30% higher CTR than text-heavy thumbnails
- No paraphrasing the video title — the thumbnail and title should tell different parts of the story (curiosity gap between them)
- High contrast text: white on dark or dark on light — verify against both dark mode and light mode backgrounds

**Contrast and color:**
- 60-30-10 rule: 60% dominant (background), 30% secondary (subject), 10% accent (text/highlight)
- High-contrast pairs: white text on navy `#102742`, cream `#faf8f4` on navy, saturated warm color against dark neutral
- Cluttered thumbnails (too many elements) lower CTR by 23%
- One focal point — the eye should know exactly where to land

### 4.2 Real estate specific

- For YouTube long-form market reports: the data number IS the hero. "Bend home prices: ↑ 6.2% YoY" in large type beats any graphic. Put the number at 64-80px.
- For Reel covers: a mid-video frame often beats the first frame. The platform allows custom cover selection — choose the most visually distinct moment.
- For listings: the architectural exterior at the most flattering angle with the address as the only text, small, bottom-right. The photo IS the thumbnail.
- Local specificity outperforms generic: "Tumalo" or "Awbrey Butte" in the text beats "Central Oregon" — the local audience self-selects and the click-intent is stronger.

### 4.3 Reel cover vs YouTube thumbnail — format differences

| Surface | Optimal size | Key difference |
|---|---|---|
| YouTube thumbnail | 1280×720 (16:9) | Competes in browse/suggested grid — high contrast wins |
| IG Reel cover | 1080×1920 (9:16), displayed at ~3:4 crop in grid | Profile grid consistency matters — design the cover for the grid crop first |
| TikTok cover | 1080×1920 | Auto-generated from first frame if no custom cover — engineer the first frame (per CLAUDE.md) |
| FB Reel cover | 1080×1920 | Similar to IG |

**CLAUDE.md first-frame rule applies here:** Every video's first frame must look great as a static thumbnail. This means the first frame IS the custom thumbnail candidate. Design the opening frame as though it's the thumbnail, because for TikTok it literally is.

### 4.4 The curiosity gap

The highest-CTR thumbnails create a gap between what the thumbnail shows and what the title says. Neither completes the story alone.

- Thumbnail: a number ("↑ 42%") with no context
- Title: "Why Bend's rental vacancy rate is misleading buyers"

- Thumbnail: Matt's face with a genuinely surprised look
- Title: "We found this in the inspection report"

The viewer needs both to understand — so they click.

---

## 5. Slop Avoidance + Brand Consistency

### 5.1 The five signs of AI slop (and the fix)

| Sign | Fix |
|---|---|
| Hyper-smooth, waxy skin or surfaces — the "plastic" look | Add texture language: "natural skin texture, visible pores, matte skin, slight under-eye texture" |
| Perfect symmetry and impossible cleanliness | Add imperfection: "slightly uneven brick path, weathered cedar, real cloud texture, a few fallen leaves" |
| Generic "luxury" lighting (purple and gold rim lights) | Specify real lighting: "overcast Oregon morning, diffuse natural light through south-facing windows, no artificial lighting" |
| Objects that look like stock photo objects (too perfectly arranged) | Add lived-in details: "a half-read book on the coffee table, one window slightly open" |
| Backgrounds that are blurry-for-no-reason | Specify focus plane: "sharp background at f/8, everything in focus, architectural documentation style" |

### 5.2 What breaks brand consistency in AI generation

Flux.2 and other models will not reproduce the exact Ryan Realty color system (`#102742` navy, `#faf8f4` cream) unless explicitly specified. For brand cards and carousels, the reliable path is:

1. **AI for the scene** → generate the background or lifestyle image
2. **Canvas compositor for the brand layer** → apply exact color tokens, typography, logo, text overlays using `@napi-rs/canvas` or PIL

Do not attempt to generate a brand card entirely with AI. The canvas path gives pixel-accurate control; AI adds color drift.

**When prompting for background scenes that will have brand overlays:** Ask for neutral, photographically accurate backgrounds. Avoid high-saturation backgrounds that fight the navy overlay. Prefer natural tones (warm stone, overcast sky, interior with neutral walls) that the navy/cream system can sit over.

### 5.3 Brand system in AI prompt terms

When the AI output itself must respect the brand palette (e.g., illustrative/stylized content where brand colors are in the scene):

```
Color palette: deep navy #102742, warm cream #faf8f4, no gold, no other accent colors.
Typography: clean, minimal, modern sans-serif for any text in image.
Avoid: bright colors, saturated primaries, green, purple, red tones.
Overall tone: warm, grounded, Pacific Northwest aesthetic, not luxury aspirational.
```

### 5.4 The trust line for real estate

From 2026 industry research: buyers have become sharp at spotting over-processed listing photos. When a buyer senses an image is fake, trust evaporates instantly. The emerging standard is a hybrid model:
- AI processes standard corrections (sky replacement, virtual staging)
- Human editor refines hero shots
- Disclosure when required

**For Ryan Realty:** Never use AI generation to represent a specific listing's actual condition, exterior appearance, or view. This is both a brand trust issue and a compliance issue (Oregon OREF conduct rules; California AB 723 is the current disclosure standard and Oregon follows directionally). Use real listing photos — edited only for standard corrections (color grading, minor sky replacement with disclosure when material) — for all property-specific content.

AI-generated lifestyle imagery (neighborhood scenes, lifestyle vignettes, abstract backgrounds) does not represent a specific property and is safe to use without disclosure, as long as it is not presented as an actual photo of the property.

### 5.5 The "luxury restraint" principle from recon

Confirmed pattern across 9 top luxury brokerage accounts: **restraint signals quality.** The correlation is consistent — the higher the price point and brand authority, the less the image is crowded with overlays, stamps, and text.

Applied to AI generation: the best AI-generated content for premium real estate has minimal generated text, avoids "designed" compositional elements (banners, frames, badges), and lets the scene speak. Overlays are added in the compositor — not baked into the AI output.

---

## 6. Composite vs Generate vs Real — Quick Reference

| Content | Path | Model / Tool |
|---|---|---|
| Real listing hero (exterior, interior, key features) | Real photo only | Listing photographer's delivery |
| Listing photo enhancements (sky, staging, minor corrections) | Real + AI edit with disclosure | Flux Kontext Pro or Flux Fill |
| Neighborhood / lifestyle scene (non-property-specific) | AI or stock | Flux.2 Pro (photoreal) or Grok (variants) |
| Brand data card (market stats, checklist, market report) | Canvas compositor | @napi-rs/canvas — exact brand tokens |
| Data card background texture | AI for texture, composite on top | Grok Imagine (cheap variants) or Flux.2 Dev |
| Text-in-image (readable copy must be generated) | Ideogram v3 or GPT Image 2 | $0.075 default / $0.04-0.08 |
| Social thumbnail (Reel cover, YT thumb) | Real frame first, composite second, AI third | Canvas + Flux.2 Pro as fallback |
| A/B thumbnail variant grid (10 variants fast) | Grok Imagine batch | $0.02 × 10 = $0.20 for 10 variants |
| Broker headshot / agent card | Real photo always | `design_system/ryan-realty/assets/team/*.png` |
| Canonical hero (Old Mill, Cascades) | Existing asset | `hero-old-mill-master-4k.jpg` |

---

## 7. API Integration Notes

### 7.1 Our stack (verified keys as of 2026-05-06)

| API | Env var | Status | Notes |
|---|---|---|---|
| Replicate | `REPLICATE_API_TOKEN` | Active | Gateway to Flux.2 family — pay-per-second GPU |
| xAI Grok | `XAI_API_KEY` | Active | `lib/grok-image.ts` already wired |
| Ideogram | Not yet in `.env.local` | Not provisioned | Needs key from ideogram.ai |
| OpenAI (GPT Image 2) | Via existing OpenAI key | Check `.env.local` | GPT Image 2 endpoint if key present |
| Vertex Imagen 4 | Via Vertex credentials | Check `.env.local` | See `docs/research/vertex-imagen-4.md` |
| Unsplash | Key in env | Active | See `docs/research/supporting-platforms.md` |
| Shutterstock | Key in env | Active | See `docs/research/supporting-platforms.md` |

### 7.2 Flux.2 Pro call pattern (Replicate SDK)

```typescript
import Replicate from 'replicate'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

const output = await replicate.run(
  "black-forest-labs/flux-2-pro",
  {
    input: {
      prompt: "Exterior of a modern ranch home in high desert Oregon at dusk, warm amber light, sage brush foreground, Cascade volcanic peak on horizon, shot on Sony A7R IV 24mm f/2.8, no text in image",
      width: 1080,
      height: 1080,  // 1:1 for IG feed
      // height: 1350 for 4:5 IG portrait
      // height: 1920 for 9:16 Reel cover
      num_outputs: 1,
      // reference_images: [...] for up to 8 consistency refs (Flux.2 Max)
    }
  }
)
// output is a URL — download and upload to Supabase Storage immediately
// Replicate output URLs expire after 1 hour
```

### 7.3 Grok Imagine call pattern (already in lib/grok-image.ts)

```typescript
// Standard variant grid — 10 images in one call
const response = await fetch("https://api.x.ai/v1/images/generations", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "grok-imagine-image",  // or "grok-imagine-image-quality" for $0.07 premium
    prompt: "...",
    n: 10,  // up to 10 variants
    response_format: "b64_json"  // use b64_json — URLs are temporary
  })
})
// Immediately decode and upload to Supabase Storage
```

### 7.4 Ideogram v3 call pattern (not yet wired)

```typescript
// When provisioned — for text-in-image social cards
const response = await fetch("https://api.ideogram.ai/generate", {
  method: "POST",
  headers: {
    "Api-Key": process.env.IDEOGRAM_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    image_request: {
      prompt: "A social media card with the headline 'Bend Market Update' in large clean sans-serif on a cream background, navy color palette, minimal design",
      model: "V_3",
      rendering_speed: "DEFAULT",  // TURBO ($0.0375) / DEFAULT ($0.075) / QUALITY ($0.1125)
      aspect_ratio: "ASPECT_1_1"  // ASPECT_9_16, ASPECT_4_5, etc.
    }
  })
})
```

---

## 8. Sources

- [FLUX AI models on Replicate](https://replicate.com/collections/flux)
- [Run FLUX.2 on Replicate — Replicate blog](https://replicate.com/blog/run-flux-2-on-replicate)
- [Flux AI Prompt Guide 2026](https://www.imagetoprompt.dev/blog/flux-ai-prompt-guide/)
- [What Is FLUX 1.1 Pro Ultra — MindStudio](https://www.mindstudio.ai/blog/what-is-flux-1-1-pro-ultra)
- [Flux 2 and Ideogram v3: Two Models Redefining AI Image Generation 2026](https://www.cliprise.app/news/flux2-ideogram-v3-ai-image-2026)
- [Best AI Image Models 2026: FLUX, GPT Image 2, Seedream, Ideogram, Imagen 4, Recraft Compared](https://melies.co/compare/ai-image-models)
- [Best AI Image Generation Models 2026 — Atlas Cloud](https://www.atlascloud.ai/blog/guides/best-ai-image-generation-models-2026)
- [GPT Image 2 vs Flux: Which Model Should You Use?](https://lensgo.ai/blog/gpt-image-2-vs-flux)
- [Grok Imagine Quality Mode API — xAI](https://x.ai/news/grok-imagine-quality-mode)
- [Grok xAI Image Generation 2026 — Atlas Cloud](https://www.atlascloud.ai/blog/guides/grok-xai-image-generation-capability)
- [Ideogram API Pricing](https://ideogram.ai/features/api-pricing)
- [Ideogram 3 Prompt Adherence, Pricing & API Guide 2026](https://ucstrategies.com/news/ideogram-3-prompt-adherence-pricing-api-guide-2026/)
- [Instagram Carousel Strategy 2026 — TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-carousel-strategy-2026)
- [Instagram Carousel Posts: 12 Best Practices — CreatorFlow](https://creatorflow.so/blog/instagram-carousel-posts-guide/)
- [Instagram Carousel Posts: Engagement Guide 2026 — Flowshorts](https://flowshorts.app/blog/instagram-carousel)
- [Instagram Carousel Algorithm 2026 — TryMyPost](https://www.trymypost.com/blog/instagram-carousel-algorithm-2026-guide)
- [Instagram Carousel Posts: The Secret to 3x More Engagement for Realtors](https://therealestatetrainer.com/instagram-carousel-posts-the-secret-to-3x-more-engagement-for-realtors/)
- [YouTube Thumbnail Best Practices That Boost CTR — Bananathumbnail](https://blog.bananathumbnail.com/youtube-thumbnail-best-practices/)
- [YouTube CTR Benchmarks 2026 — Thumbmagic](https://www.thumbmagic.co/blog/youtube-thumbnail-ctr-benchmarks)
- [IG Reel Cover Size Guide — ReelMind](https://reelmind.ai/blog/ig-reel-cover-size-guide-optimizing-previews-for-maximum-clicks)
- [Why AI Images Still Look Fake — Vofy](https://www.vofy.art/blog/why-ai-images-look-fake-photorealistic-solutions)
- [Why Your AI Images Look Fake — Travis Nicholson, Medium](https://travisnicholson.medium.com/why-your-ai-images-look-fake-and-how-to-fix-them-3b57f79c82ac)
- [AI Listing Images Are Creating a New Trust Problem — Propmodo](https://propmodo.com/ai-listing-images-are-creating-a-new-trust-problem/)
- [Real Estate Photography Trends 2026 — AI Home Design Blog](https://aihomedesign.com/blog/uncategorized/real-estate-photography-trends-in-2026-what-is-changing-in-listing-visuals/)
- [Why AI-Generated Imagery Can't Replace Real Estate Photography — Virtuance](https://www.virtuance.com/blog/ai-generated-imagery-real-estate-risks/)
- [Real Estate Social Media Benchmarks 2026 — Apaya](https://apaya.com/blog/social-media-benchmarks-real-estate)
- Internal: `out/design-recon/ig-carousel/recon.md` (26 samples, 9 top luxury brokerage accounts)
- Internal: `out/design-recon/fb-lead-gen-ad/recon.md` (426 ads, 5 competitor brands)
- Internal: `docs/research/grok-imagine.md` (verified 2026-05-06)
- Internal: `docs/research/replicate-platform.md` (verified 2026-05-06)
