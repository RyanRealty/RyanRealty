---
name: ryan-realty
description: Ryan Realty brand system — Bend, Oregon real estate. Two registers — heritage Americana (blue lab mascot "Jax", navy engraving-style illustrations, "It's About Relationships" tagline, yard signs/postcards) and modern web (shadcn/ui radix-nova + Geist + navy #102742 primary on warm stone). Amboqia Boriango is the primary display face. Plainspoken local voice, tabular numerals, Heroicons 2px stroke, documentary Central Oregon photography, no emoji.
---

# Ryan Realty — Brand Skill

Use this skill when designing any artifact for **Ryan Realty**, a Bend, Oregon real estate brokerage serving Central Oregon. **Tagline: "It's About Relationships."** Phone: `541.213.6706`. Web: `ryan-realty.com`.

## Two registers — pick one

| Register | When | Look | Type | Color |
|---|---|---|---|---|
| **Heritage** | Yard signs, postcards, email banners, IG posts, door hangers, print, section heroes, any "stamped" moment | Navy engraving-style illustrations, vintage Americana, the blue lab mascot, "It's About Relationships" ribbon lockup; drop in the pre-rendered wordmark from `assets/brand/` rather than re-typesetting | **Amboqia Boriango** display serif for any new type; the pre-rendered wordmark images for the mark itself | Navy `#102742` monochrome on cream `#faf8f4` |
| **Web / product** | Homepage, search, market hub, dashboards, forms, every UI surface | shadcn/ui radix-nova, cards, tabular stats, documentary hero photography, Heroicons | **Geist** sans for UI/body, **Amboqia Boriango** for display/hero H1s | Navy `#102742` primary on warm stone neutrals |

Don't mix the two on the same surface. A web page may include a heritage hero or footer block, but the rest of the page follows web rules.

## Quick-start

1. Link `colors_and_type.css` — defines every color/type/radius/shadow/spacing variable.
2. Load brand fonts from `fonts/`: **Amboqia_Boriango.otf** (primary display), **AzoSans-Medium.ttf** (accent). Geist loads via Google Fonts.
3. Pull imagery from `assets/` (web: hero-poster, team, partner marks) and `assets/brand/` (heritage: mascot, wordmarks, illustrations, scenes, yard sign, postcard).

## Voice

**Honest. Transparent. Trustworthy. Direct and kind.** We are the local authority for real estate brokerages in Central Oregon. Mission: **building community through authentic relationships and exceptional customer service.** We live by the golden rule — always do the right thing for the client, even when it costs us the deal.

### The principle: show, don't tell
Let what we say create the tone. **Never describe the tone overtly.** Warmth, trust, and expertise are demonstrated through specificity, restraint, and the right fact in the right order — not claimed.

| ✗ Pandering / editorializing | ✓ Let the fact do the work |
|---|---|
| "Passionate about helping you find your dream home!" | "Your local team. Thirty-seven closings in Bend last year." |
| "Trust the experts who know the market!" | "Median sale in Northwest Crossing last month: $895k. 38 days on market." |
| "Luxurious, turnkey, beautifully-appointed!" | "3 bd · 2 ba · 1,820 sqft. New roof, 2023. HOA $0." |

### Four rules
1. **Direct.** Short sentences. Active voice. One idea per line.
2. **Specific.** Neighborhoods, not "the area." Dollar amounts, not "competitively priced." First names, not "our team of experts."
3. **Kind.** Directness is not coldness. "You" and "your." Never condescend, hedge, or pressure.
4. **Honest, even when inconvenient.** If a market is soft, say so. If a listing has been sitting, say so. If we don't know, say so.

### Content rules
- **Tagline "It's About Relationships."** is a signature line — with the wordmark, not sprinkled in body copy.
- **Extended promise:** *"Building community through authentic relationships and exceptional customer service."* — verbatim.
- **Mantras:** *"Love where you live."* · *"Local Expertise."* · *"Quality · Local · Service."*
- **Phone:** `541.213.6706` (dotted). **URL:** `ryan-realty.com`.
- **Sentence case** for web headings; Title Case only for the hero H1.
- **"You/your"** is the subject. **"We/our team"** when the broker identity matters. **Never "I".**
- **Tabular numerals** for every price, count, day range. Round. Unavailable → em-dash `—`.
- **Never:** meta-tone words (*passionate, dedicated, premier, luxury, boutique, concierge, white-glove*), real-estate clichés (*dream home, nestled, breathtaking, turnkey, must-see*), marketing exhortations (*Don't miss out! Act now!*), exclamation marks in body, emoji, hedging (*may, could, potentially*), pressure/scarcity framing.
- **Authority cues** (use only when true): specific neighborhoods, schools, HOAs, builders, market numbers. Never claim rankings/awards without evidence in the same frame.

## Visual rules

- **Primary** = navy `#102742`. Heritage is monochrome navy on cream. Web uses navy for primary CTAs, logo, header, focus intent.
- **Neutrals** = warm stone (shadcn radix-nova). Never cool/slate.
- **Three type families** — see decision tree below.
- **Card radius xl (14px), button/input lg (10px), badge pill.** Base radius 10px.
- **Shadows navy-tinted** (`rgb(16 39 66 / 0.08)`). `shadow-sm` cards · `shadow-lg` hero search.
- **Focus ring** = 3px warm stone. Never navy.
- **Hover:** `hover:border-primary/30 hover:shadow-md` on cards; `bg-primary/80` on primary. Press = `active:translate-y-px`.
- **No decorative gradients.** Only the navy protection overlay on the hero image.
- **Icons:** Heroicons first (24×24, 2px stroke, round), HugeIcons for filled, inline SVG last. Never emoji.
- **Imagery:** warm documentary Central Oregon photography + navy heritage engravings + the blue-dog mascot. Never AI slop or generic stock.
- **Motion:** ease-out entrances, 200–400ms, ≤16px travel. 20s Ken Burns on hero. Respect `prefers-reduced-motion`.
- **Layout:** `max-w-7xl` (1280px), `px-4 sm:px-6`, sections `py-12`, grids `gap-4`, cards `p-5`/`p-6`.

## Type decision tree

1. Writing a **wordmark or section hero stamp**? → Drop in the pre-rendered wordmark from `assets/brand/` (e.g. `logo-blue.png`, `illustration-05.png`). Do **not** re-typeset the wordmark.
2. Writing a **display moment** (hero H1, pull quote, testimonial, yard-sign text, postcard headline, IG cover title)? → **Amboqia Boriango**, navy on cream, tracking between `-0.01em` (hero H1) and `0.08em` (all-caps signage).
3. Writing an **arched ribbon sub-label** under a wordmark? → **Azo Sans Medium**, UPPERCASE, tracked `0.12em`.
4. Writing **body, UI, market data, forms, nav**? → **Geist** (400/500/600/700). Geist Mono for code.

## Asset cheat sheet

- **Heritage wordmark (print):** `assets/brand/logo-blue.png` (navy), `logo-black.png` (1-color print), `logo-white.png` (dark backgrounds).
- **Heritage signature lockup** (wordmark + beer-glass + dog + tagline ribbon): `assets/brand/illustration-05.png`.
- **Mascot alone:** `assets/brand/blue-dog.png` · `white-dog.png`.
- **Scene illustrations:** `assets/brand/scene-tower.png` (Tower Theater marquee) · `scene-water-pageant.png` (historic downtown).
- **Web wordmark:** `assets/logo.png` (navy on cream) · `logo-header-white.png` (reversed on navy).
- **CANONICAL BRAND HERO (LOCKED 2026-05-13):** `assets/hero/hero-old-mill-master-4k.jpg` (1920×1080 F1 frame of iStock Old Mill drone — three smokestacks, American flag, Deschutes River with floaters, Cascade mountains). **Use for any design surface needing a banner / cover / header / hero photo.** Pre-cropped at every social-platform aspect lives in the same folder. See `assets/hero/README.md` for usage rules + regeneration commands.
- **Legacy site hero:** `assets/hero-poster.webp` (Deschutes aerial) — being phased out in favor of the F1 master above.

## What not to do

- Don't invent a wordmark — the pre-rendered mark in `assets/brand/logo-blue.png` and the 14 numbered variations are the brand. Use them as images; don't re-typeset.
- Don't recolor or crop the heritage illustrations. They're navy monochrome, as drawn.
- Don't use Amboqia for body copy. Display only.
- Don't mix heritage and web on the same surface (except for a single cross-register hero or footer block).
- Don't use navy for focus rings, borders, or dividers — reserved for action.
- Don't use cool/slate greys. Warm stone only.
- Don't Title Case web headings (except the hero H1).
- Don't use Inter/Roboto/Arial as stand-ins for Geist.
- Don't add emoji.

## Files

- `README.md` — full brand overview
- `SKILL.md` — this file
- `colors_and_type.css` — all CSS vars, three font families
- `fonts/` — Amboqia Boriango (primary display), Azo Sans Medium (accent)
- `assets/` — web platform imagery + web wordmarks
- `assets/brand/` — heritage kit (wordmarks ×14, mascot, illustrations, scenes, yard sign, postcard, IG covers, tagline lockup)
- `ui_kits/website/index.html` — interactive homepage replica
- `preview/` — token cards (Design System tab)
