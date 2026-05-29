# Design directives — Ryan Realty

**Source of truth for every design rule the site must follow.**

This file is the canonical registry. Every directive Matt has issued — in the plan, in CLAUDE.md, in chat — lands here as a row. Each directive is one of four statuses:

- `enforced` — a CI gate mechanically catches violations
- `deferred` — accepted technical debt with a target wave/date + justification
- `open` — no gate exists yet. **G25 fails CI when a directive stays `open` past the current wave.**
- `wont-fix` — deliberate permanent exception, requires Matt approval

**Gate G25** (`scripts/check-design-directives.mjs`) parses this file and:
1. Fails CI if any directive's status is `open`
2. Warns if a `deferred` directive is past its target date/wave
3. Verifies every `enforced` directive references a gate in [`docs/MECHANICAL_GATES.md`](MECHANICAL_GATES.md)

**Propagation principle:** every directive lands in the lowest reusable unit (a primitive component, a CSS token, an ESLint rule, a CI script). Fixing it once cascades to every consumer automatically. See the `Cascade path` column for each row.

**Companion files:**
- [`docs/MECHANICAL_GATES.md`](MECHANICAL_GATES.md) — gate catalog (G01–G25)
- [`out/design-directive-audit-2026-05-28.md`](../out/design-directive-audit-2026-05-28.md) — the audit that produced this list

---

## Schema

```markdown
| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
```

| Column | Type / values |
|---|---|
| `ID` | `D01`–`D72`, then `D73+` for new additions. **Immutable** once assigned — never reuse a retired ID. |
| `Directive` | One declarative sentence. Subject = surface, verb = obligation. |
| `Source` | File path + section. The canonical doc that establishes the rule. |
| `Surfaces` | Comma-separated route or file globs that the directive governs. |
| `Status` | `enforced` / `open` / `deferred` / `wont-fix` |
| `Gate` | Gate ID (`G01`–`G25`) or `NONE`. References `docs/MECHANICAL_GATES.md`. |
| `Cascade path` | One sentence describing how fixing the lowest reusable unit propagates to every consumer. |
| `Opened` | `YYYY-MM-DD` first written. |

---

## Directives

### COLOR

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D01 | Brand navy is `#102742` only (`--rr-navy` / `--primary`). Other navy shades retired and banned. | `colors_and_type.css` + CLAUDE.md §6 | `app/**`, `components/**` | enforced | G4 | Fix in `--primary` CSS var → every shadcn-token consumer inherits. | 2026-05-13 |
| D02 | Primary background is cream `#faf8f4` (`--rr-cream`). No other warm-stone variant. | `colors_and_type.css` + CLAUDE.md §6 | `app/**`, `components/**` | enforced | G4 | Fix `bg-background` token → every page using it inherits. | 2026-05-13 |
| D03 | Retired palette tokens (`--rr-navy-deep #0a1a2e`, `--rr-sand #e8e2d4`, `--rr-fir`, `--rr-sky`, gold `#D4AF37` / `#C8A864`) banned in code and className strings. | MANIFEST.md "Retired" | `app/**`, `components/**`, `*.css` | enforced | G4 | Hex literal in G4 banned-set → every file scanned in CI. | 2026-05-13 |
| D04 | Raw hex strings in JSX `className` or `style` props are banned. Use CSS vars or Tailwind semantic tokens. | EXECUTION_PLAN §0.4 + CLAUDE.md §5 | `app/**/*.tsx`, `components/**/*.tsx` | enforced | G4 | `lint-design-tokens.js` regex on PR diffs blocks new hex. | 2026-05-13 |
| D05 | Gold accent (`#D4AF37`, `#C8A864`) retired system-wide. New renders use navy-on-cream. | MANIFEST.md "Retired" | All new code + new video renders | enforced | G4 | G4 banned-hex set propagates to every check. | 2026-05-13 |
| D06 | Cool slate / Tailwind grey palettes (`bg-slate-*`, `bg-gray-*`, `text-slate-*`) banned. Warm stone neutrals only (radix-nova). | SKILL.md "Visual rules" | `app/**/*.tsx`, `components/**/*.tsx` | enforced | G4 | `lint-design-tokens.js` DISALLOWED_COLOR_CLASSES regex covers all Tailwind color families including slate / gray / zinc / neutral / stone. | 2026-05-28 |
| D07 | `#FFFFFF` and `#000000` allowed only for text-on-photo legibility + scrim layers. Not as page backgrounds or card surfaces. | MANIFEST.md "Utility" | `app/**`, `components/**` | deferred (target: Wave 3) | NONE | Extend `lint-design-tokens.js` to flag `bg-white` / `bg-black` outside `_scrim_` / `_overlay_` files. Few false positives — needs ratchet baseline. | 2026-05-28 |

### TYPOGRAPHY

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D08 | Display moments (hero H1, pull quotes, testimonials, section stamps) must use Amboqia Boriango via `--font-display` / `.font-display` / `<DisplayHeading>`. Never Inter, Helvetica, Roboto, or system fonts at display size. | SKILL.md "Type decision tree" | Hero H1, section headers | enforced | G24 | Update `<DisplayHeading>` primitive → every consumer inherits. | 2026-05-13 |
| D09 | Playfair Display is the retired display fallback. **Must never appear in new page code.** Existing uses (`app/lp/bend`, `app/lp/tetherow`) must migrate. | MANIFEST.md "Type families" | `app/**/*.tsx`, `app/**/*.css` | enforced | G24 | `lint-design-tokens.js` DISALLOWED_FONT_FAMILY regex matches `font-family:.*Playfair` anywhere in source — covers inline `<style>` strings as plain text. | 2026-05-28 |
| D10 | Body, UI, market data, forms, nav must use Geist via `--font-sans` / `font-sans` / `<Body>`. Azo Sans for accent print only. | SKILL.md "Type decision tree" | Body copy, nav, forms, stat labels | enforced | G24 | `--font-sans` token + `<Body>` primitive → every page inherits. | 2026-05-13 |
| D11 | The pre-rendered wordmark image (`assets/brand/logo-blue.png` and variants) must be loaded as `<img>` or `<Image>`. Never re-typeset the wordmark in code. | SKILL.md "What not to do" | Header, footer, print | deferred (target: Wave 3) | G6 (via parity.json mandate of `<SiteHeader>` import) | `<RyanRealtyMark>` primitive. Parity contracts require `<SiteHeader>` which uses `<RyanRealtyMark>` — every page consumes it. | 2026-05-28 |
| D12 | Geist Mono for code blocks and inline code. Never mix with body copy. | `colors_and_type.css` | Code surfaces | enforced | G24 | Tailwind `font-mono` token. | 2026-05-13 |
| D13 | Eyebrow / ribbon sub-labels use Azo Sans Medium, UPPERCASE, `letter-spacing: 0.12em`. Use `.rr-eyebrow` or `<Eyebrow>` primitive. | SKILL.md "Type decision tree" | Eyebrows, ribbon labels | deferred (target: Wave 3) | G6 (via parity.json mandate of `<Eyebrow>` primitive) | `<Eyebrow>` primitive bakes the spec. Parity contracts mandate its import per page. | 2026-05-28 |
| D14 | Hero H1 letter-spacing locked to `tracking-[-0.01em]`. All-caps signage: `tracking-[0.08em]`. No other tracking values. | SKILL.md "Type decision tree" | Hero H1, signage | enforced | G26 | `lint-design-tokens.js` allowlist whitelists only the canonical tracking values; any other `tracking-[*]` flags. | 2026-05-28 |
| D15 | Amboqia Boriango must never appear as body copy. Display only. | SKILL.md "What not to do" | Body text | enforced | G24 | `<DisplayHeading>` primitive only renders as display sizes. `<Body>` only renders Geist. | 2026-05-13 |

### HEADINGS / VOICE CASE

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D16 | Web headings: sentence case. Title Case is only for the hero H1. | SKILL.md + CLAUDE.md §3 | All `h2`, `h3`, `h4` | deferred (target: Wave 4) | NONE | Sentence-case heuristic is hard to write without false positives on proper nouns (Bend, Sunriver, Tetherow). Defer until Wave 4 editorial pass. | 2026-05-28 |

### LAYOUT

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D17 | Max container width `max-w-7xl` (1280px) with `px-4 sm:px-6`. No arbitrary `max-w-[1200px]`, `max-w-[1160px]`, `max-w-[1300px]`. | SKILL.md + `ui_kits/website/index.html` | All page sections | enforced | G26 | `<Container>` primitive + `lint-design-tokens.js` G26 catches arbitrary `max-w-[*]`. | 2026-05-28 |
| D18 | Section vertical padding: `py-12` base, `py-14`–`py-16` content-heavy. No arbitrary `py-[120px]`. | SKILL.md "Visual rules" | All `<section>` | enforced | G26 | `<Section>` primitive + G26 catches arbitrary `py-[*]`. | 2026-05-28 |
| D19 | Grid gutters: `gap-4` standard; `gap-5` / `gap-6` for cards. No arbitrary gap values. | SKILL.md + `ui_kits/website/index.html` | Grid layouts | enforced | G26 | `<Grid>` primitive + G26 catches arbitrary `gap-[*]`. | 2026-05-28 |
| D20 | Card padding: `p-5` (20px) or `p-6` (24px). No arbitrary `p-[22px]`. | SKILL.md "Visual rules" | `<Card>` components | enforced | G26 | shadcn `<Card>` + G26 catches arbitrary `p-[*]`. | 2026-05-28 |

### RADII

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D21 | Card radius `rounded-xl` (14px). Button/input radius `rounded-[10px]`. Badge `rounded-full`. No `rounded-2xl` on buttons or `rounded-3xl` on cards. | SKILL.md + MANIFEST.md "Radii" | Cards, buttons, badges | enforced | G26 | G26 allowlist for `rounded-[10px]` and `rounded-[14px]`; any other `rounded-[*]` flags. | 2026-05-28 |
| D22 | Radius ladder: `sm 6 · md 8 · lg 10 · xl 14 · 2xl 18 · 3xl 22`. No values outside. | MANIFEST.md "Radii" | All rounded elements | enforced | G26 | Same as D21 — G26 allowlist enforces the ladder. | 2026-05-28 |

### SHADOWS

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D23 | Shadows must use `--shadow-sm` / `--shadow-md` / `--shadow-lg`. No `rgba(0,0,0,...)` shadows except photo overlay scrims. | SKILL.md + MANIFEST.md "Shadows" | All elevated elements | enforced | G30 | `lint-design-tokens.js` DISALLOWED_BLACK_SHADOW regex catches `box-shadow: ... rgba(0,0,0,...)`. | 2026-05-28 |
| D24 | Inline `box-shadow` with literal `rgba(0,0,0,...)` on non-photo surfaces is a violation. | `colors_and_type.css` | Cards, dropdowns | enforced | G30 | Same as D23. | 2026-05-28 |

### FOCUS RING

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D25 | Focus ring: `3px warm stone` (`ring-[3px] ring-ring`). Never navy. | SKILL.md + MANIFEST.md "Focus" | All interactive elements | deferred (target: Wave 3) | G23 (partial via pa11y) | `<CTAButton>` primitive bakes it. ESLint detect raw `<button>` without `focus-visible:ring`. | 2026-05-28 |

### MOTION

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D26 | Transition durations: 200ms fades, 300ms entrances, 400ms fade-up. Loop 2s. Ken Burns 20s. No other durations. | SKILL.md + MANIFEST.md "Motion" | All animations | deferred (target: Wave 3) | NONE | Extend `lint-design-tokens.js` with duration check. Allowlist values: 150/200/300/400ms. | 2026-05-28 |
| D27 | Easing ease-out on entrances. Travel ≤16px. Wrap all animations in `@media (prefers-reduced-motion: reduce)`. | SKILL.md "Visual rules" | All CSS animations | deferred (target: Wave 3) | NONE | Add reduced-motion guard check to `lint-design-tokens.js`. Same Wave 3 pass as D26. | 2026-05-28 |
| D28 | Hero photography uses Ken Burns (20s ease-in-out infinite alternate `scale(1.08)`). LPs that hand-roll the hero break this. | `ui_kits/website/index.html` + EXECUTION_PLAN §9 L3 | Hero sections | deferred (target: Wave 3) | G6 (via parity.json) | `<HeroBlock>` primitive. Add to LP `parity.json` contracts so G6 fails missing import. | 2026-05-28 |

### COMPONENT MANDATE

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D29 | shadcn/ui components from `@/components/ui/` are the ONLY permitted styling authority for form controls, cards, dialogs, tabs, dropdowns. Raw `<button>`, `<input>`, `<select>` in pages = violation. | CLAUDE.md §5 | All pages | enforced | G4 | `lint-design-tokens.js` DISALLOWED_PRIMITIVES regex covers `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<hr>`, `<table>`. | 2026-05-28 |
| D30 | `cn()` from `@/lib/utils` required for all conditional/merged className strings. String concatenation banned. | CLAUDE.md §5 | All `.tsx` files | deferred (target: Wave 4) | NONE | Hard to detect reliably (false positives on template literals with computed class names). Defer until Wave 4 editorial pass. | 2026-05-28 |
| D31 | Custom CSS classes (`card-base`, `btn-cta`, any class from removed `globals.css` custom layer) banned. Use shadcn components. | CLAUDE.md §5 | All pages | enforced | G4 | `lint-design-tokens.js` `DISALLOWED_CLASSES` regex. | 2026-05-13 |
| D32 | Inline `<style>` JSX tags banned in `app/**/*.tsx`. Style belongs in Tailwind classes, `globals.css`, or CSS modules. | CLAUDE.md §5 + EXECUTION_PLAN §9 | `app/**/*.tsx` (notably `app/lp/bend`, `app/lp/tetherow`) | enforced | G29 | ESLint `no-restricted-syntax` `JSXElement[openingElement.name.name='style']` blocks inline `<style>` in all app + components/site code. | 2026-05-28 |
| D33 | Client components that inject style via `<style>` blocks (e.g. `<TetherowGlobalStyle>`) are the same violation as D32. | `app/lp/tetherow/page.tsx` | `app/**/*.tsx` | enforced | G29 | Same as D32 plus `createGlobalStyle` call detection. | 2026-05-28 |

### ICONS

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D34 | Heroicons (24×24, 2px stroke, round) primary. HugeIcons for filled variants. Inline SVG last resort. Never emoji as icons. | SKILL.md + README.md "Iconography" | All icon surfaces | deferred (target: Wave 3) | G2 (partial — emoji in text) | Extend brand-voice script to flag emoji in `aria-label` + `alt` props. | 2026-05-28 |

### IMAGERY

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D35 | Canonical hero photo: `design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg` (Old Mill drone, three smokestacks, American flag, Deschutes River). Pre-cropped platform variants in same `hero/` folder. | CLAUDE.md §6 + MANIFEST.md "CANONICAL BRAND HERO" | Hero sections, email banners, social covers | deferred (target: Wave 3) | NONE | Lint check: any `src` matching `hero-*.jpg` outside canonical path → warn. Acceptable to keep alternate per-LP hero photos for now. | 2026-05-28 |
| D36 | Broker headshots: `design_system/ryan-realty/assets/team/{slug}.png` (transparent PNG, 800×1200) or `/public/images/brokers/` web mirror. Never arbitrary cropped versions or white-bg JPGs where PNG available. | MANIFEST.md + SKILL.md "Brokers" + CLAUDE.md §6 | Any broker portrait | deferred (target: Wave 3) | NONE | Pre-commit hook: detect `broker-*.jpg` paths and suggest `.png` siblings. | 2026-05-28 |
| D37 | Never add rectangular box, border, or drop-shadow that fakes a frame behind a transparent broker portrait. | SKILL.md "Listing-agent rule" + CLAUDE.md §6 | `<BrokerCard>` | wont-fix (manual review only) | NONE | Code review + visual diff. Not mechanically detectable. | 2026-05-28 |
| D38 | No AI-generated slop imagery. No generic stock. Documentary Central Oregon photography + navy heritage engravings + Jax mascot. | SKILL.md + ANTI_SLOP_MANIFESTO.md | Photo selections | wont-fix (manual curation) | NONE | Editorial / curation gate. | 2026-05-28 |

### TWO-REGISTER MODEL

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D39 | Heritage register (yard signs, postcards, IG posts, email banners, print) = navy monochrome on cream, Amboqia, pre-rendered wordmark images. Web/product = shadcn/ui + Geist body + Amboqia for display H1s. Never mix on same surface except cross-register hero or footer. | SKILL.md + MANIFEST.md "Two registers" | Per-surface register selection | deferred (target: Wave 4 editorial gate) | NONE | Visual diff against mockup. Manual review per `wave-3` rebuild. | 2026-05-28 |
| D40 | Mockup pixel target: every Wave 3 page rebuild must visually match `design_system/ryan-realty/ui_kits/<route>/index.html`. Human sign-off per section. | EXECUTION_PLAN §1 + §9 Wave 3 | All `app/<route>/page.tsx` | enforced | G6 | `parity.json` contracts + `check-mockup-parity.mjs`. | 2026-05-28 |

### BRAND VOICE — PUNCTUATION

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D41 | Em dashes (`—` U+2014) and en dashes (`–` U+2013) banned as punctuation. Exception: data placeholder in tables. | CLAUDE.md §3 + MANIFEST.md | All JSX text strings | enforced | G2 + G3 | `brand-voice-vocabulary.cjs` single source. ESLint + CI both consume. | 2026-05-13 |
| D42 | Semicolons banned in body copy. Replace with period. | CLAUDE.md §3 | All JSX text strings | enforced | G2 + G3 | Same as D41. | 2026-05-13 |
| D43 | Dramatic colons (introducing a punchline in body prose) banned. Colons in headers, list intros, tables fine. | CLAUDE.md §3 | Body prose | wont-fix | NONE | Subjective; reliably detecting "dramatic" colons vs structural colons is not mechanizable. Editorial review only. | 2026-05-28 |
| D44 | Exclamation marks in body copy banned. One max per piece (social only). Zero in market data. | CLAUDE.md §3 + MANIFEST.md | All consumer text | enforced | G2 + G3 | Same as D41. | 2026-05-13 |

### BRAND VOICE — BANNED WORDS

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D45 | Banned clichés: stunning, breathtaking, gorgeous, charming, pristine, nestled, boasts, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey, immaculate, captivating, exquisite. | CLAUDE.md §3 + SKILL.md "Never" | All consumer text | enforced | G2 + G3 + G20 | `brand-voice-vocabulary.cjs` single source. | 2026-05-13 |
| D46 | Banned AI filler: delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster. | CLAUDE.md §3 | All consumer text | enforced | G2 + G3 + G20 | Same. | 2026-05-13 |
| D47 | Banned vague qualifiers: approximately, roughly, about, around, fairly, somewhat. Use the real number instead. | CLAUDE.md §3 + MANIFEST.md | All consumer text | enforced | G2 + G3 + G20 | Same. | 2026-05-13 |
| D48 | Banned marketing slop: top producing, top 1 percent, white glove, luxury concierge, premier brokerage, exclusive (brokerage descriptor), boutique brokerage, your real estate journey, we are passionate about, we pride ourselves on. | CLAUDE.md §3 | All consumer text | enforced | G2 + G3 + G20 | Same. | 2026-05-13 |
| D49 | Banned fake urgency: act fast, don't miss out, won't last long, won't last. | CLAUDE.md §3 | All consumer text | enforced | G2 + G3 + G20 | Same. | 2026-05-13 |
| D50 | Banned hype openings: "get ready to fall in love," "you won't believe," "introducing," "stunning new listing." | CLAUDE.md §3 | Hero text, social captions | enforced | G2 + G3 + G20 | Same. | 2026-05-13 |
| D51 | Banned pandering: "what a beautiful home," "you have great taste," "don't worry, we will handle everything," "let me explain in simple terms." | CLAUDE.md §3 | All consumer text | enforced | G2 + G3 + G20 | Same. | 2026-05-13 |

### BRAND VOICE — PRONOUNS + VOICE

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D52 | "You/your" is the subject. "We/our team" for brokerage identity. "I" only in genuinely first-person Matt content. Never mix registers in same block. | SKILL.md + MANIFEST.md | All consumer text | wont-fix (manual editorial) | NONE | Editorial review per piece. | 2026-05-28 |
| D53 | Show, don't tell. Never describe the brand's own tone. Let specificity do the work. | SKILL.md "The principle" + README.md | All consumer text | wont-fix (manual editorial) | NONE | Editorial review. | 2026-05-28 |

### BRAND VOICE — NUMBERS + DATA

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D54 | Tabular numerals (`tabular-nums`) required on every numeric surface: prices, counts, day ranges, percentages. | SKILL.md + MANIFEST.md | All stat cards, market data, tables | deferred (target: Wave 3) | G6 (via parity.json mandates `<Price>` etc.) | `<Price>`, `<TabularNumber>`, `<DaysCount>`, `<PercentChange>` primitives bake `tabular-nums`. Mandate via parity contracts. | 2026-05-28 |
| D55 | Currency rounded to nearest thousand: `$895,000` not `$894,750`. | SKILL.md + MANIFEST.md + CLAUDE.md §3 | All price displays | enforced | G6 (via parity.json) | `<Price>` primitive enforces. Every consumer inherits. | 2026-05-13 |
| D56 | Days as integer + "days": `38 days` not `38d` or `38-day DOM`. | CLAUDE.md §3 + MANIFEST.md | All DOM displays | deferred (target: Wave 3) | G6 (via parity.json) | `<DaysCount>` primitive. | 2026-05-28 |
| D57 | Percents: one decimal, signed arrow when YoY: `↑ 2.1% YoY`. | CLAUDE.md §3 + MANIFEST.md | Market stats | deferred (target: Wave 3) | G6 (via parity.json) | `<PercentChange>` primitive. | 2026-05-28 |
| D58 | Unavailable stats use em-dash `—` as data placeholder. Do not use `N/A`, `null`, `0`, or `—` for decoration. | MANIFEST.md + SKILL.md | Stat cards, tables | enforced | G2 (em-dash exception) | `<Price>`, `<TabularNumber>` primitives return `—` for null. | 2026-05-13 |

### BRAND IDENTITY STRINGS

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D59 | Phone (brand voice / yard sign): `541.213.6706` (dotted). Phone (bio / FUB-tracked / social / ads): `541.703.3095`. Never dashes or parens. | SKILL.md + MANIFEST.md + CLAUDE.md §6 | All consumer surfaces | deferred (target: Wave 3) | NONE | Extend `check-brand-voice.mjs` with phone-format regex blocking `541-` or `(541)` patterns. | 2026-05-28 |
| D60 | Web URL: `ryan-realty.com` (hyphenated, lowercase, no `www`). | SKILL.md + MANIFEST.md | All consumer text | deferred (target: Wave 3) | NONE | Extend `check-brand-voice.mjs` regex to block `ryanrealty.com` and `www.ryan-realty.com`. | 2026-05-28 |
| D61 | Place separator: middle dot `·` (U+00B7). Not hyphen, pipe, or slash. | MANIFEST.md + SKILL.md | All place name strings | deferred (target: Wave 3) | G6 (via parity.json) | `<MiddleDot>` primitive. Mandate via parity contracts. | 2026-05-28 |
| D62 | Social handles: `@ryanrealtybend` on every platform. `/ryanrealtybend` on FB + LinkedIn vanity. | MANIFEST.md "Social handles (locked 2026-05-13)" + CLAUDE.md §6 | All consumer text referencing socials | deferred (target: Wave 3) | NONE | Extend `check-brand-voice.mjs` regex to block `@ryanrealtybend1` and other variants. | 2026-05-28 |
| D63 | Hashtag rule: every social caption on hashtag-supporting platforms includes `#RyanRealtyBend` as first hashtag in trailing block. | MANIFEST.md + CLAUDE.md §6 | Social captions | wont-fix (publishing pipeline scope) | NONE | Social-publisher gate, not web-site gate. | 2026-05-28 |
| D64 | Tagline "It's About Relationships." used with wordmark in heritage marketing only. Do not sprinkle in body copy. | SKILL.md + MANIFEST.md | Heritage surfaces only | wont-fix (manual editorial) | NONE | Editorial review. | 2026-05-28 |
| D65 | License # 201206613 (Matt Ryan, OR Principal Broker) must appear in legal footer on any page that captures leads or represents transactions. | EXECUTION_PLAN §9 L2 + MANIFEST.md "Brand facts" | Footer, lead-cap pages | deferred (target: Wave 3) | G6 (via parity.json mandate of `<SiteFooter>`) | `<SiteFooter>` primitive bakes the license #. Parity contracts mandate its import on every page. | 2026-05-28 |

### NO EMOJI

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D66 | No emoji in blog, email body, ad headlines, video on-screen text. One max in a social caption. Never as UI icons. | CLAUDE.md §3 + SKILL.md "Never" + MANIFEST.md "No emoji" | All consumer text | deferred (target: Wave 3) | G2 (partial — text only) | Extend `check-brand-voice.mjs` emoji regex to `aria-label`, `alt`, SVG `<title>`, metadata strings. | 2026-05-28 |

### CI / DAL / ARCHITECTURE

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D67 | Every `app/<route>/page.tsx` imports data only through `@/lib/data/`. No raw Supabase `.from()` outside `lib/data/`. | EXECUTION_PLAN §4 + MECHANICAL_GATES G1/G8 | All page files | enforced | G1 + G8 | DAL boundary lint + page-DAL gate. | 2026-05-13 |
| D68 | Every dynamic `[slug]` route exports `generateStaticParams`. | EXECUTION_PLAN §9 Wave 3 + G9 | All `[slug]` routes | enforced | G9 | `check-static-params.mjs`. | 2026-05-13 |
| D69 | Bundle per route ≤ 250 KB JS. | EXECUTION_PLAN §1 | All routes | enforced | G10 | `check-bundle-budget.mjs`. | 2026-05-13 |
| D70 | Mockup parity: every gated Wave 3+ route imports every component listed in its `parity.json`. | MECHANICAL_GATES G6 + EXECUTION_PLAN §1 | All `app/<route>/page.tsx` | deferred (target: Wave 3 — only `listing-detail` has `parity.json` today) | G6 | Create `parity.json` per LP route. G6 then enforces. | 2026-05-28 |
| D71 | Lighthouse: Perf ≥ 90, A11y ≥ 95, BP ≥ 90, SEO ≥ 95, LCP ≤ 2500ms. | EXECUTION_PLAN §1 | All LP routes | enforced | G15 | `ci:lighthouse`. | 2026-05-13 |
| D72 | No decorative gradients. Only navy protection overlay on hero + Ken Burns scrim. | SKILL.md + EXECUTION_PLAN §9 L3 | All pages | enforced | G30 | `lint-design-tokens.js` DISALLOWED_LINEAR_GRADIENT regex + ALLOWED_GRADIENT_PATTERNS exception for navy scrims and photo bottom-to-transparent. | 2026-05-28 |

---

## Directives from chat (post-launch additions)

| ID | Directive | Source | Surfaces | Status | Gate | Cascade path | Opened |
|---|---|---|---|---|---|---|---|
| D73 | Horizontal logo on every page header. Stacked variant is for video end-cards only. | 2026-05-28 chat | `components/site/SiteHeader.tsx`, every mockup nav | enforced | G6 | `<SiteHeader>` primitive imports `logo-header-white.png`. Parity contracts mandate `<SiteHeader>` import → every page inherits the horizontal logo. | 2026-05-28 |
| D74 | Menu / nav text is too small at 14px. Bump to 15px (matches CTA size). | 2026-05-28 chat | `components/site/SiteHeader.tsx`, every mockup nav | enforced | G14 | `<SiteHeader>` primitive renders `text-[15px]`; mockup CSS mirrors at `font-size: 15px`. Contract verified by `components/site/__tests__/site-contracts.test.ts` (runs in `npm test` via G14). | 2026-05-28 |
| D75 | Photo gallery nav must include thumbnail strip, dot indicator, swipe on mobile, keyboard arrows, visible photo counter (`3 of 47`). | 2026-05-28 chat | `components/site/PhotoGalleryLightbox.tsx` + every consumer | enforced | G6 | Lifted into `<PhotoGalleryLightbox>` primitive at `components/site/PhotoGalleryLightbox.tsx`. Parity contract mandates the import on listing-detail. Every future gallery consumer inherits the same nav contract. | 2026-05-28 |
| D76 | Show ALL listing price/status history events by default. | 2026-05-28 chat | `components/site/listing-detail/PropertyHistory.tsx` | enforced | G14 | `<PropertyHistory>` accepts `mode='all' \| 'meaningful-only'`, defaults to `'all'`. Contract verified by `components/site/__tests__/site-contracts.test.ts` (runs in `npm test` via G14). | 2026-05-28 |
| D77 | Listing detail must BEAT Zillow Showcase. ClimateRiskBlock, VacationRentalPotential, TransparentCMASummary are Wave 3 minimums (data-as-prop with "request a report" CTA when null). Wave 4 wires real data sources. | 2026-05-28 chat + EXECUTION_PLAN §8 | `app/listing/[listingKey]/page.tsx` + `design_system/ryan-realty/ui_kits/listing-detail/parity.json` | enforced | G6 | Three new components live + listed as `blocking: true` in parity.json. G6 fails the listing-detail page if any import goes missing. Wave 4 wires First Street / AirDNA / CMA workbook. | 2026-05-28 |
| D78 | Any two figures labeled the same on one page must use the same source. The city hero active count and the MarketSnapshot active card must be the identical SFR (`PropertyType='A'`) number — never 1,332 (all types) in the hero next to 532 (SFR) in the card. | 2026-05-28 chat | city / community / any page with a hero stat + a stat card | enforced | G14 | Page computes one `activeCount` from the SFR source and feeds both hero lede + MarketSnapshot. Contract test asserts the city page derives the hero count from the same field as the card. | 2026-05-28 |
| D79 | No self-describing tone filler ("honest guidance from a local team", "trusted", "passionate"). Let a specific fact carry the line. The city hero lede leads with numbers (active count + median + days-to-pending), not a brand adjective. | 2026-05-28 chat + CLAUDE.md §3 D53 | All hero ledes + body copy | enforced | G2 + G3 | Filler phrases added to `brand-voice-vocabulary.cjs` (single source → ESLint + CI both catch). City hero lede rewritten to numbers-only. | 2026-05-28 |
| D80 | The city page must surface relevant blog / area-guide content for that city (content-cluster cross-linking per EXECUTION_PLAN content hub). | 2026-05-28 chat + EXECUTION_PLAN §4 BL-004 | `app/cities/[slug]/page.tsx` | enforced | G14 | `getRecentBlogPosts({cityName})` DAL (city-title prioritized) feeds the reusable `<ArticleGrid>` "guides & insights" section. Contract test asserts both. Reused on community pages via the same primitive. | 2026-05-28 |
| D81 | Open-houses section must render even when empty — an empty state ("No open houses scheduled this weekend. Get notified.") not a silently-absent section, so the page never looks broken. | 2026-05-28 chat | `<OpenHousesGrid>` on city / community / homepage | deferred (target: Wave 3 follow-up) | NONE | `<OpenHousesGrid>` renders an empty-state card + "Get notified" CTA when the list is empty rather than returning null. Cascades to every consumer via the primitive. | 2026-05-28 |
| D82 | Cross-nav tiles (neighborhoods, communities, cities) must carry real imagery, not stark bordered boxes. | 2026-05-28 chat + city mockup | `<RelatedAreas>` on city / community pages | enforced | G30 | `<RelatedAreaItem.imageUrl>` renders a photo card with a navy scrim (fallback navy card, never a blank box). Images resolve ONLY through the canonical sources (D86). The primitive change cascades to every tile consumer. | 2026-05-28 |
| D83 | The "explore neighborhoods" section shows the DESIGNATED Bend neighborhood polygons ONLY — never sibling cities, never raw subdivision-plat noise. | 2026-05-28 chat | `app/cities/[slug]/page.tsx` neighborhoods section | enforced | G14 | Page sources `bendNeighborhoodPolygons` (bend- prefixed) into `bendNeighborhoodItems`. Golf/master communities are a SEPARATE section (D85). Contract test in `components/site/__tests__/site-contracts.test.ts`. | 2026-05-28 |
| D84 | Every city page needs a separate "Explore other Central Oregon cities" section — distinct from the within-city sections. | 2026-05-28 chat | `app/cities/[slug]/page.tsx` | enforced | G14 | Separate `<RelatedAreas title="Explore other cities">` fed by `otherCityItems` (Central Oregon set minus current city). Contract test asserts the section exists. | 2026-05-28 |
| D85 | Neighborhoods and golf/master-planned communities are TWO distinct sections — defined neighborhoods first, then a separate "golf and master-planned communities" section. Never one combined "neighborhoods and communities" grid. | 2026-05-28 chat | `app/cities/[slug]/page.tsx` + community pages | enforced | G14 | Page builds `bendNeighborhoodItems` + `golfCommunityItems` as separate `<RelatedAreas>` sections. Contract test asserts the split + absence of the old `withinCityItems`. Reused on any geo page that lists both. | 2026-05-28 |
| D86 | Geo imagery comes ONLY from the canonical sources: asset_library via `getGeoTileImages()` (cities/neighborhoods) and `GOLF_COMMUNITY_IMAGES` in `lib/geo-images.ts` (golf/master communities). Never the fake/empty cities·communities·neighborhoods `hero_image_url` stock columns, never a hardcoded `/lp/...` path in a component. | 2026-05-28 chat | `app/cities/**`, `app/communities/**`, `components/site/**` | enforced | G30 | `lib/geo-images.ts` + `lib/data/media/getGeoTileImages.ts` are the lowest reusable units. G30 (`scripts/check-geo-imagery.mjs`) fails CI on a hardcoded `/lp/` image path or a fake-hero-column read on any geo surface. | 2026-05-28 |
| D87 | Multi-word city `geo_key`s carry spaces ("la pine", "powell butte") — slugify before service-area matching and href building so La Pine (167 active SFR), Powell Butte, etc. are never silently dropped. | 2026-05-28 chat | `app/cities/[slug]/page.tsx` + any city-list consumer | enforced | G14 | `otherCityItems` maps `geo_key.replace(/\s+/g,'-')` before the set check and the `/cities/<slug>` href. Contract test asserts the slugify + La Pine inclusion. | 2026-05-28 |

---

## Maintenance protocol

1. **Adding a new directive:** add a row with `Status = open`, `Gate = NONE`, today's date. The next CI run fails until either (a) the gate is built and status moves to `enforced`, or (b) status moves to `deferred` with a target wave or `wont-fix` with a justification.
2. **Building a new gate:** update the matching row from `open` → `enforced`, fill in the Gate ID, add the gate to `docs/MECHANICAL_GATES.md`.
3. **Wave milestone:** run G25 (`npm run ci:design-directives`). The `open` count must be 0 before a wave can be declared done.
4. **A `deferred` directive expires:** G25 warns; the agent must build the gate or file `wont-fix`.

**The agent (not Matt) owns the maintenance of this file.** Every chat directive Matt issues gets added as a new row immediately, with `Status = open`. The agent then either builds the gate in the same session or marks `deferred`. This is how feedback propagates without re-designing every page.
