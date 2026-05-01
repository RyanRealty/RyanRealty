# Ryan Realty Design System — Authoritative Reference

**Status:** Canonical as of 2026-04-30. This file is the single source of truth for all Ryan Realty visual output — video, web, print, social. When in doubt, this file wins.

**Scope:** Every color, font, voice rule, number format, imagery register, motion timing, logo asset, and signature phrase used by Ryan Realty. Agents building video content, web pages, social assets, or print materials MUST reference this file.

---

## 1. Brand Identity

Ryan Realty is a real estate brokerage in Bend, Oregon serving Central Oregon. The brand balances heritage authenticity (engravings, serif display type, warm cream) with modern data-driven authority (clean sans-serif, navy, animated data visualizations).

---

## 2. Color System

### 2.1 Primary Colors

| Token | Hex | oklch | Usage |
|-------|-----|-------|-------|
| Brand primary navy | `#102742` | `oklch(0.270 0.058 253.912)` | Primary background, overlays, pills, shadows, heritage engravings |
| Cream (heritage) | `#faf8f4` | `oklch(0.982 0.008 90.0)` | Text on dark backgrounds, heritage marketing surfaces, title/end cards |
| Charcoal | `#1A1A1A` | `oklch(0.175 0.000 0.0)` | Body text on light backgrounds |

### 2.2 Accent Colors

| Token | Hex | oklch | Usage |
|-------|-----|-------|-------|
| Fir green | `#2e4a3a` | `oklch(0.340 0.042 160.0)` | Central Oregon forest register, nature accent |
| Sky blue | `#8fb8d4` | `oklch(0.750 0.055 230.0)` | Deschutes water register, data accent |

### 2.3 Gold Variants

| Token | Hex | Usage |
|-------|-----|-------|
| Gold (news clips) | `#D4AF37` | Pill borders, trend arrows, accents in news format |
| Gold (listing reels) | `#C8A864` | Pill borders, trend arrows, accents in listing format |

### 2.4 Chart Ramp (Market-Pulse Charts)

Five-step blue ramp from pale to brand navy. Use for multi-series area/bar charts where each series needs a distinct value within the brand palette. Exact steps:

1. Pale blue (lightest series)
2. Light blue
3. Medium blue
4. Dark blue
5. Brand navy `#102742` (darkest/primary series)

### 2.5 Color Rules

- **Neutral base is warm stone.** `#faf8f4` (cream) on heritage marketing surfaces; warm stone greys on website data surfaces. NEVER cool/blue grey anywhere.
- **No decorative gradients.** The only permitted gradient is the navy protection overlay on hero imagery: `rgba(16,39,66,0.75)`.
- **Heritage illustrations are monochrome navy on cream or white.** Never tint another color.
- **Navy-tinted shadows:** `rgb(16 39 66 / 0.08)` — never generic grey shadows.
- **White text + shadow OR dark pill under text.** Never white-on-white, never gold-on-gold.

### 2.6 Deprecated Colors (DO NOT USE)

| Hex | Note |
|-----|------|
| `#F0EEEC` | Old neutral — removed, replaced by warm stone system |
| `#F2EBDD` | Old cream — replaced by `#faf8f4` as canonical cream |

---

## 3. Typography — Three Families

### 3.1 Amboqia Boriango — Primary Display

- **Classification:** High-contrast swash serif with looped `y` descender.
- **Character:** Heritage, authoritative, distinctive.
- **USE FOR:** Hero H1 titles, pull quotes, yard-sign text, postcard headlines, IG cover titles, video title cards (Scene 1), video end card headlines (Scene 8), section hero stamps.
- **NEVER FOR:** Body text, data labels, captions, chart annotations, UI elements, paragraphs.
- **Tracking:** `-0.01em` (hero H1) to `0.08em` (all-caps signage).
- **Scale:** 40px up to 120px on yard signs.
- **Fallback chain:** Playfair Display → Didot → Georgia. Flag any fallback use as a visible downgrade.

### 3.2 Azo Sans Medium — Accent Sans

- **Classification:** Clean geometric sans-serif.
- **Character:** Understated, supporting.
- **USE FOR:** Arched/ribbon sub-labels under wordmark ONLY. Rare usage.
- **Always uppercase** in these contexts.
- **Fallback:** Geist.

### 3.3 Geist — UI, Body, Data, Captions

- **Classification:** Modern humanist sans-serif.
- **Character:** Clean, legible, data-friendly.
- **Weights:** 400 (body), 500 (emphasis), 600 (semibold labels), 700 (bold headings in data panels).
- **USE FOR:** All chart labels, data annotations, body text, VO captions, metric displays, CountUp numbers, navigation, UI elements, leaderboards, stat panels, forms.
- **Geist Mono:** For code or technical readouts.
- **MANDATORY:** `font-variant-numeric: tabular-nums` on every numeric surface — charts, leaderboards, CountUp animations, stat reveals, price displays.
- **Fallback:** System sans-serif.

### 3.4 Font Decision Tree

```
Is it a wordmark?
  → Use pre-rendered image from assets/brand/

Is it a hero H1, pull quote, title card headline, end card headline, yard sign, postcard headline, IG cover title?
  → Amboqia Boriango

Is it an arched/ribbon sub-label under the wordmark?
  → Azo Sans Medium, uppercase

Everything else (body, data, charts, captions, UI, nav, forms, metrics)?
  → Geist
```

---

## 4. Brand Voice

### 4.1 Core Principles

- **Show, don't tell.** Never describe the tone — demonstrate it through specificity.
- **Four rules:** Be direct. Be specific. Be kind. Be honest even when inconvenient.
- **Person:** "You" and "your" — never "I" (exception: Scene 8 CTA sign-off where Matt identifies himself).

### 4.2 Tagline and Brand Promise

- **Tagline:** "It's About Relationships." (with period, used with wordmark only, not filler in copy or VO)
- **Extended brand promise:** "Building community through authentic relationships and exceptional customer service."

### 4.3 Banned Words and Phrases (Ship-Blockers)

**Real estate slop (NEVER use in any context):**
stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey

**AI filler (NEVER use):**
delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock

**Number hedging (NEVER as substitute for actual data):**
approximately, roughly, about

**Punctuation bans:**
- Em-dashes — never in VO scripts
- Semicolons — never in VO scripts
- Exclamation marks — NEVER in any context
- Emoji — NEVER in any context

### 4.4 Voice Construction Rules

- Sentences short. Two clauses max.
- No commas where Matt wouldn't pause.
- No hedging: "may", "could", "potentially" — be direct.
- Specific over general: say the number, name the neighborhood, cite the source.

### 4.5 Comparison Table: Good vs Bad

| Bad (banned) | Good (use instead) |
|---|---|
| "This stunning home is nestled in..." | "Three bedrooms, 2,100 square feet on a quarter-acre lot in NW Crossing." |
| "Breathtaking mountain views" | "Broken Top and South Sister visible from the living room." |
| "Approximately $700K" | "$687,000" |
| "The market is robust" | "Active inventory is up 14% year over year." |
| "Dream home!" | (just describe the house) |

---

## 5. Number Formatting

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| Currency | Rounded, `$` + commas | `$895,000` | Not `$894,750`. Round to nearest $1K for display. |
| Days | Integer + "days" | `38 days` | |
| Unavailable | Em-dash | `—` | |
| Percent change | One decimal, signed arrow | `↑ 2.1% YoY` | |
| Tabular display | `font-variant-numeric: tabular-nums` | | MANDATORY on every numeric surface |
| VO spoken | Spelled out for ElevenLabs ingestion | "eight hundred ninety five thousand" | |
| Units | Always explicit | "$3,025,000" not "3,025,000" | "4 bedrooms" not "4 BR" |
| Rounding | Never change the narrative | $474,500 → `$475K` OK | $474,500 → `$500K` NOT OK |

---

## 6. Imagery — Three Registers

### 6.1 Documentary Photography

- Warm-lit aerials and landscapes of Central Oregon.
- Natural color grading. No teal-orange grade. No heavy filters.
- Ken Burns at 20s duration on hero images.
- Sources: Unsplash API, real Bend photography, Google 3D Tiles aerials.

### 6.2 Heritage Engravings

- Navy monochrome line-art illustrations.
- Central Oregon landmarks (Pilot Butte, Deschutes River, etc.).
- Use on: signage, postcards, section dividers, heritage voice moments, title cards.
- **Always monochrome navy on cream or white.** Never tint another color.

### 6.3 The Blue Dog — Jax

- Sitting black lab in engraving style.
- Brand mascot.
- **Never crop. Never recolor.**
- Asset: `assets/brand/illustration-05.png` (in lockup with tagline).

---

## 7. Logo Assets

| Asset | Path | Use Case |
|-------|------|----------|
| Modern web wordmark (navy, cream BG) | `assets/logo.png` | Digital surfaces, web, light backgrounds |
| Heritage wordmark (navy on transparent) | `assets/brand/logo-blue.png` | Print, heritage marketing |
| Heritage wordmark (white on transparent) | `assets/brand/logo-white.png` | Dark backgrounds, video end cards |
| "It's About Relationships" lockup with Jax | `assets/brand/illustration-05.png` | Heritage moments, about sections |
| Stacked logo white (video) | `listing_video_v4/public/brand/stacked_logo_white.png` | Video end cards (Scene 8) |

**Rules:**
- No logo in any video frame except Scene 8 end card and Scene 1 title card.
- No "Ryan Realty" text, no phone, no agent name, no URL in any other frame.
- End card uses `assets/brand/logo-white.png` or `listing_video_v4/public/brand/stacked_logo_white.png` on navy background.

---

## 8. Motion Timing

| Duration | Use |
|----------|-----|
| 200ms | Fades, micro-interactions |
| 300ms | Entrances, slide-ins |
| 400ms | Fade-up reveals |
| 2s | Loop animations |
| 20s | Ken Burns on hero/aerial imagery |

- Respect `prefers-reduced-motion`.
- No scale transforms on press — use `translate-y-px`.
- Transition frames: CrossfadeTransition 15f, PushTransition 15f, SlideTransition 15f, WhipPanTransition 10f, LightLeakTransition 20f.

---

## 9. Card and Panel Anatomy (Remotion Data Panels)

- Background: white
- Border radius: rounded-xl (14px for cards, 10px base, pill for badges)
- Border: ring-1 `ring-foreground/10`
- Shadow: shadow-sm, navy-tinted `rgb(16 39 66 / 0.08)`
- Padding: 16–24px
- Listing card: top image rounded-t-xl, top-left badges, top-right heart, bottom metadata

---

## 10. Caption Pill Spec (Video)

- **Zone:** y 1480–1720, x 90–990 (portrait 1080x1920)
- **Font:** Geist 56px (NOT AzoSans)
- **Pill:** 70% navy `rgba(16,39,66,0.70)`
- **Corner radius:** 24px
- **Top border:** 2px gold (`#D4AF37` for news, `#C8A864` for listings)
- **Must NOT overlay** graphics, charts, or data visualizations
- **Transitions:** Min 6-frame (200ms) opacity ramp on fades. Word-by-word kinetic: 1–3 word chunks, synced to ElevenLabs forced-alignment timestamps.

---

## 11. Brokerage Facts (Always These Values)

- **Business name:** Ryan Realty
- **Location:** Bend, Oregon
- **Signage format:** `BEND · OREGON` (with middle dot)
- **Phone:** 541.213.6706 (dotted format)
- **Web:** ryan-realty.com (hyphenated, lowercase)
- **Email:** matt@ryan-realty.com
- **Service area:** Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Madras, Prineville, Powell Butte, Terrebonne, Crooked River Ranch

---

## 12. Signature Phrases (Lift Verbatim)

- "It's About Relationships."
- "Building community through authentic relationships and exceptional customer service."
- "Love where you live."
- "Local Expertise."
- "Quality · Local · Service. Bend · Oregon."
- "Your local team."
- "Honest guidance."
- "Central Oregon Real Estate"
- "Market Snapshot"

---

## 13. ElevenLabs Voice (LOCKED)

- **Voice:** Victoria
- **Voice ID:** `qSeXEcewz7tA0Q0qk9fH`
- **Model:** `eleven_turbo_v2_5`
- **Settings:** stability 0.50, similarity_boost 0.75, style 0.35, use_speaker_boost true
- **Prosody:** `previous_text` chained across all lines
- **Pronunciation overrides (IPA):** Deschutes (`dəˈʃuːts` — "duh-shoots"), Tumalo (`TOO-muh-low`), Tetherow, Awbrey, Terrebonne
- **Approved:** 2026-04-27 — permanent. No substituting.
- **Numbers:** Spelled out for ingestion. "475,000" → "four hundred seventy five thousand."
- **Sentences:** Short. Two clauses max. No commas where Matt wouldn't pause.
