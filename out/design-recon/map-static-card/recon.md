# Design Recon — ig-carousel (also covers flyer-design, linkedin-doc-carousel, map-static-card)

**Run date:** 2026-05-19 (sourced from public/template-picker/preview/ig-refs/)
**Sample size:** 26 reference images from 9 top luxury real-estate IG accounts
**Source:** Curated Apify IG scrapes — see public/template-picker/preview/ig-refs/

## Reference accounts (top luxury / aspirational brokers)

- `sothebysrealty` (5) — global luxury franchise
- `compass` (3) — National luxury franchise
- `douglaselliman` (3) — NY/luxury
- `hiltonhyland` (5) — Beverly Hills luxury specialist
- `theoppenheimgroup` (3) — Million Dollar Listing brokerage
- `nestseekers` (3) — NY/luxury
- `coldwellbankerluxury` (2) — Coldwell Banker luxury vertical
- `aaronkirman` (1) — top LA luxury solo broker
- `theagencyre` (2) — The Agency boutique luxury

Files at `public/template-picker/preview/ig-refs/r2/*.jpg` (recent batch) and `public/template-picker/preview/ig-refs/*.jpg` (earlier captures).

## Top 5 layout patterns

### Pattern 1 — "Full-bleed listing hero, minimal overlay" (Sotheby's / Compass / Hilton Hyland house style)

**Examples:** `sothebysrealty_DYFMuugnys8.jpg`, `compass_DYC9bZOE0Wo.jpg`, `hiltonhyland_DTbJIw9lBUY.jpg`

**Layout:**
- 100% photo bleed, NO scrim, NO box overlay
- Logo/wordmark: tiny, top-left or top-right, 60-80px on 1080×1080 (4-7% of width)
- Address + price: small text bottom-left or bottom-right, NOT centered, NOT over a pill
- Negative space inside the photo IS the composition — they shoot for it
- Color: warm/cinematic grade on the photo. No brand-color tint.
- Type: light-serif (Sotheby's uses a custom serif), thin sans for body. NEVER caps lock the headline.

**Adaptation for Ryan Realty:**
- Use when listing photo is itself the hook (luxury, distinctive architecture, twilight shot)
- Amboqia Boriango for address line (cream over photo if photo's bottom is dark, navy if bottom is light — derive from a 200×200 sample of the bottom-third)
- Tiny `logo-blue.png` or `logo-white.png` (60px wide) top-left
- Bottom-right corner: price + bed/bath on two lines, ~14px tracked

### Pattern 2 — "Carousel: photo + spec slide + map + agent" (Compass 4-slide format)

**Examples:** `compass_DYHmv4wHIQn.jpg`, `compass_DYNA7Lgkp3x.jpg` (showing slide 1 of a 4-slide carousel)

**Layout (4 slides):**
1. **Cover slide:** full-bleed hero photo + tiny brand mark + address overlay
2. **Spec slide:** cream background, big number (price) + bed/bath/sqft + 1-line description
3. **Map / lifestyle slide:** satellite map crop OR neighborhood lifestyle photo
4. **Agent slide:** broker headshot + name + phone + email + CTA

**Adaptation for ig-carousel + linkedin-doc-carousel:**
- 8-slide LinkedIn doc carousel = Compass's 4-slide format expanded:
  - Slide 1: hook (specific local stat for non-listing posts, or property hero for listings)
  - Slides 2-3: data/value beats
  - Slides 4-5: photo essay
  - Slide 6: map / context
  - Slide 7: testimonial OR market read
  - Slide 8: agent card (this is already the canonical broker-contact-card format)

### Pattern 3 — "Architectural detail close-up + minimal text" (Hilton Hyland)

**Examples:** `hiltonhyland_DI1kHgwzy8x.jpg`, `hiltonhyland_DSBJbBZE9HK.jpg`, `hiltonhyland_DSoGtUoClq5.jpg`

**Layout:**
- Macro shot of a specific architectural feature (a door, a window detail, a fireplace, a staircase, a textured wall)
- Frame fills with the texture
- Single line of text — usually the address only — small, restrained, bottom corner

**Adaptation:**
- Use as flyer / ig-single-post variants for distinctive Bend listings (Old Bend brick + iron, Tetherow stone, Awbrey Butte timber)
- Lets us shoot ONE detail beautifully instead of needing the whole house to be photogenic

### Pattern 4 — "Map static card with NAMED neighborhood + clean pin" (Compass, Sotheby's location cards)

**Examples:** `compass_DYHmv4wHIQn.jpg` (slide 3 typically), `sothebysrealty_DYSlRUEhGuz.jpg`

**Layout:**
- Satellite or hybrid map fills top 60-75%
- Pin: brand-colored small marker (Compass uses red, Sotheby's uses cobalt) with a small leader line to a label
- Bottom 25-40%: cream/white band with neighborhood name in headline type + address line + walking distance + 2-3 amenities

**Adaptation for map_static_card:**
- Google Static Maps hybrid (already done)
- Pin: navy filled circle + cream inner dot (already done — Subagent C built this)
- Bottom band: Amboqia address + neighborhood (Tumalo, Awbrey Butte, etc.) + a single line of context

### Pattern 5 — "Pull-quote testimonial slide" (Aaron Kirman, Oppenheim)

**Examples:** `aaronkirman_DX-FS64Sbiy.jpg`, `theoppenheimgroup_DYP05BJpwTY.jpg`

**Layout:**
- Cream or off-white background, OR a softly desaturated lifestyle shot with heavy scrim
- Centered pull-quote in serif italics, 28-36pt
- Attribution: name + role/transaction below
- Brand mark bottom-corner, small

**Adaptation for `testimonial_card`:** already implemented per this pattern.

## What ALL top accounts do (universal rules confirmed by recon)

1. **No emojis in image overlays.** Emoji only in the caption (and even then, 1 max).
2. **No "JUST LISTED!!" all-caps stamps over the photo.** They use small restrained type for status.
3. **No company logo at >100px on a 1080×1080.** Luxury restraint.
4. **No "Won't last!" "Don't miss out!" overlays.** They let the photo and address sell.
5. **Typography is RESTRAINED.** Serif/script for the brand mark, thin sans for everything else. Amboqia for our brand mark + AzoSans/Geist for body is on-pattern.
6. **Negative space is the design.** Don't fill the frame with overlays.

## Anti-patterns observed in non-luxury (avoid)

- Heart/fire emoji in title (banned per CLAUDE.md anyway)
- "Stunning! Must-see!" pre-fab headline (banned per voice rules)
- 3+ stickers/badges on a single image
- White text on white photo (no contrast handling)
- Brand color flooding 50%+ of the frame

## Producer integration

| Producer | Apply pattern |
|---|---|
| `flyer-design` F1-F10 | Pattern 1 for hero flyer; Pattern 3 for detail-led variants |
| `ig_single_post` S1-S10 | Pattern 1 for property hero; Pattern 5 for testimonial slides |
| `linkedin-doc-carousel` 8 slides | Pattern 2 expanded — 8-slide carousel structure |
| `map_static_card` | Pattern 4 — already in place per Subagent C |
| `facebook-lead-gen-ad` | Pattern 1 + Pattern 5 (agent-led variant); see fb-lead-gen-ad recon |
| `broker-contact-card` | Pattern 5 agent-slide template |
