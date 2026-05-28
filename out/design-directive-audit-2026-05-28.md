# Design Directive Audit — Ryan Realty
**Date:** 2026-05-28  
**Purpose:** Comprehensive audit of all design directives extracted from the spec + brand system docs, against the existing landing pages Matt considers reference-grade, with a gap + propagation plan and a recommended G25 schema.

---

## SECTION A — Design Rules Extracted from Plan + Spec Docs

Sources consulted: `docs/EXECUTION_PLAN.md`, `CLAUDE.md` §3/§5/§6, `design_system/ryan-realty/SKILL.md`, `MANIFEST.md`, `README.md`, `colors_and_type.css`, `ui_kits/website/index.html`, `ui_kits/*/index.html`, `docs/MECHANICAL_GATES.md`.

| ID | Rule | Source (file + section) | Surface | Currently enforced? | Lowest reusable unit |
|---|---|---|---|---|---|
| **COLOR** |
| D01 | Primary brand navy is `#102742` only (`--rr-navy`). All other navy shades (`#0a1a2e`, `navy-deep`) are retired and banned. | `colors_and_type.css` `:root`; `MANIFEST.md` "Brand colors"; `CLAUDE.md` §6 | Global — every surface | G4 (partial: raw hex detection) | `--primary` CSS var + G4 lint rule |
| D02 | Primary background is cream `#faf8f4` (`--rr-cream`). No other warm-stone variant (`#F2EBDD`, `#e8e2d4`). | `colors_and_type.css` `:root`; `MANIFEST.md` "Brand colors" | Global — backgrounds | G4 (partial) | `bg-background` / `bg-card` token |
| D03 | Retired palette tokens (`--rr-navy-deep`, `--rr-sand`, `--rr-fir`, `--rr-sky`, `--rr-gold` `#D4AF37`, `#C8A864`) must never appear in code or className strings. | `MANIFEST.md` "Retired — never reintroduce"; `CLAUDE.md` §6 | Global | G4 (partial) | CI check expanded to include these literal hex strings |
| D04 | Raw hex strings in JSX `className` or `style` props are banned. Use CSS vars or Tailwind semantic tokens only. | `EXECUTION_PLAN.md` §0.4; `CLAUDE.md` §5 | All `.tsx` files | G4 (`--base-diff` mode, not strict) | `scripts/lint-design-tokens.js` |
| D05 | Gold accent (`#D4AF37`, `#C8A864`) is retired system-wide. New renders use navy-on-cream. Existing video library stays until re-rendered. | `MANIFEST.md` "Retired"; `CLAUDE.md` §6 "Migration conflicts" | Video + web surfaces | G4 (partial) | `scripts/lint-design-tokens.js` RETIRED_HEX set |
| D06 | Cool/slate greys are banned. Warm stone neutrals (`bg-muted`, `bg-secondary`, `bg-card` which map to radix-nova stone) only. | `SKILL.md` "Visual rules"; `MANIFEST.md` "Type families" | Global | NONE | `scripts/lint-design-tokens.js` — add slate/gray Tailwind class detection |
| D07 | `#FFFFFF` (pure white) and `#000000` (pure black) are allowed only for text-on-photo legibility and scrim layers. Not as page backgrounds or card surfaces. | `MANIFEST.md` "Utility"; `SKILL.md` "Visual rules" | Page backgrounds, card surfaces | NONE | `scripts/lint-design-tokens.js` — detect `bg-white` / `bg-black` outside scrim contexts |
| **TYPOGRAPHY** |
| D08 | Display moments (hero H1, pull quotes, testimonials, section stamps) must use Amboqia Boriango via `--font-display` / `.font-display` utility or the `<DisplayHeading>` primitive. Never use Inter, Helvetica, Roboto, or system fonts at display size. | `SKILL.md` "Type decision tree"; `MANIFEST.md` "Type families"; `colors_and_type.css` `--font-display` | Hero H1s, section headers | G24 (RETIRED_FONTS detection) | `<DisplayHeading>` primitive — `components/site/primitives/DisplayHeading.tsx` |
| D09 | Playfair Display is a **retired display fallback** — never use it as the primary display font for new work. The `.bend-h1`, `.bend-h2`, `.bend-h3`, `.community-name`, `.facts-sidebar dd` rules in `/lp/bend/page.tsx` all call `font-family: 'Playfair Display'` directly. This is a current violation. | `MANIFEST.md` "Type families"; G24 description | `app/lp/bend/page.tsx` (multiple inline style blocks) | G24 present but ratcheted — not failing on this file | `<DisplayHeading>` primitive |
| D10 | Body, UI, market data, forms, nav must use Geist via `--font-sans` / Tailwind `font-sans`. AzoSans for ribbon sub-labels only (accent). | `SKILL.md` "Type decision tree"; `colors_and_type.css` `--font-sans` | Body copy, nav, forms, stat labels | G24 (partial) | `<Body>` primitive — `components/site/primitives/Body.tsx` |
| D11 | The pre-rendered wordmark images from `assets/brand/logo-blue.png` (and variants) must be used as `<img>` or `<Image>`. Never re-typeset the wordmark in code. | `SKILL.md` "What not to do"; `MANIFEST.md` "Asset directory" | Header, footer, print | NONE | `<RyanRealtyMark>` primitive — `components/site/primitives/Logo.tsx` |
| D12 | Geist Mono for code blocks and inline code. Never mix with body copy. | `colors_and_type.css` `--font-mono`; `MANIFEST.md` "Type families" | Code surfaces | NONE | Tailwind `font-mono` utility |
| D13 | Eyebrow / arched ribbon sub-labels use Azo Sans Medium, UPPERCASE, `letter-spacing: 0.12em`. The `.rr-eyebrow` CSS class implements this. | `SKILL.md` "Type decision tree"; `colors_and_type.css` `.rr-eyebrow` | Eyebrows, ribbon labels | NONE | `<Eyebrow>` primitive — `components/site/primitives/Eyebrow.tsx` |
| D14 | Hero H1 letter-spacing locked to `tracking-[-0.01em]` for Amboqia display. All-caps signage: `tracking-[0.08em]`. | `SKILL.md` "Type decision tree"; `colors_and_type.css` `.rr-display` | Hero H1 | NONE | `<DisplayHeading>` primitive |
| D15 | Never use Amboqia Boriango for body copy. Display only. | `SKILL.md` "What not to do" | Body text | G24 (partially — retired font detection) | `<DisplayHeading>` primitive has scope doc |
| **HEADINGS / VOICE CASE** |
| D16 | Web headings: sentence case. Title Case is only for the hero H1. | `SKILL.md` "Voice + content rules"; `MANIFEST.md` "Voice + content rules"; `CLAUDE.md` §3 | All `h2`, `h3`, `h4` elements | G2 / G3 (partial — brand-voice text check) | `<H2>`, `<H3>` primitives — `components/site/primitives/Headings.tsx` |
| **LAYOUT** |
| D17 | Max container width `max-w-7xl` (1280px) with `px-4 sm:px-6`. Do not use custom max-widths like `max-w-[1200px]`, `max-w-[1160px]`, `max-[1300px]` that drift from the system. | `SKILL.md` "Visual rules"; `ui_kits/website/index.html` `:root --container: 1280px` | All page sections | NONE | `<Container>` primitive — `components/site/primitives/Layout.tsx` |
| D18 | Section vertical padding: `py-12` (48px) as the base; `py-14` to `py-16` for content-heavy sections. Do not use arbitrary `py-[120px]` etc. | `SKILL.md` "Visual rules" `py-12` | All `<section>` elements | NONE | `<Section>` primitive — `components/site/primitives/Layout.tsx` |
| D19 | Grid gutters: `gap-4` (16px) standard; `gap-5` / `gap-6` for cards. No arbitrary gap values. | `SKILL.md` "Visual rules" `gap-4`; `ui_kits/website/index.html` | Grid layouts | NONE | `<Grid>` primitive — `components/site/primitives/Layout.tsx` |
| D20 | Card padding: `p-5` (20px) or `p-6` (24px). No arbitrary padding like `p-[22px]`. | `SKILL.md` "Visual rules" `cards p-5/p-6` | `<Card>` components | NONE | `<Card>` from shadcn/ui with documented padding |
| **RADII** |
| D21 | Card radius: `rounded-xl` (14px = `--radius-xl`). Button/input radius: `rounded-[10px]` (= `--radius-lg`). Badge: fully rounded (`rounded-full`). Do not introduce other radii like `rounded-2xl` for buttons or `rounded-3xl` for cards. | `SKILL.md` "Visual rules"; `MANIFEST.md` "Radii"; `colors_and_type.css` `--radius-xl: 14px` | Cards, buttons, badges | NONE | CSS var tokens in `colors_and_type.css`; `CTAButton` primitive |
| D22 | The radius ladder is `sm 6px · md 8px · lg 10px · xl 14px · 2xl 18px · 3xl 22px`. No values outside this ladder. | `MANIFEST.md` "Radii · Shadows · Motion"; `colors_and_type.css` | All rounded elements | NONE | `colors_and_type.css` CSS vars |
| **SHADOWS** |
| D23 | All shadows must use the navy-tinted shadow vars: `--shadow-sm` on resting cards, `--shadow-md` on hover, `--shadow-lg` on hero search. No `rgba(0,0,0,...)` shadows except scrims on photo overlays. | `SKILL.md` "Visual rules"; `MANIFEST.md` "Radii · Shadows"; `colors_and_type.css` | All elevated elements | NONE | `colors_and_type.css` CSS vars + `scripts/lint-design-tokens.js` shadow check |
| D24 | Inline box-shadow with literal RGBA like `rgba(16,39,66,0.12)` is acceptable but should use the CSS vars. Inline `rgba(0,0,0,...)` shadows on non-photo surfaces are a violation. | `colors_and_type.css` shadow ladder | Cards, dropdowns | NONE | ESLint `no-restricted-syntax` on inline shadow styles |
| **FOCUS RING** |
| D25 | Focus ring: `3px warm stone` (`ring-[3px] ring-offset-0 ring-ring`). Never navy for focus. This is baked into `CTAButton`'s `focus-visible:ring` class already. | `SKILL.md` "Visual rules"; `MANIFEST.md` "Radii · Shadows" | All interactive elements | Partial (CTAButton enforces it; raw `<button>` elements do not) | `CTAButton` primitive; pa11y-ci (G23) |
| **MOTION** |
| D26 | Transition durations: 200ms for fades, 300ms for entrances, 400ms for fade-up. Loop animations: 2s. Hero Ken Burns: 20s. No other durations. | `SKILL.md` "Visual rules"; `MANIFEST.md` "Radii · Shadows · Motion" | Animations | NONE | CSS design-token comment in `colors_and_type.css`; no enforcement script |
| D27 | Easing: ease-out on entrances. Travel: ≤16px. Always wrap in `@media (prefers-reduced-motion: reduce)` guard. | `SKILL.md` "Visual rules" | All CSS animations | NONE | `scripts/lint-design-tokens.js` or custom ESLint rule |
| D28 | Hero photography uses Ken Burns (20s ease-in-out infinite alternate `scale(1.08)`). This is defined in the mockup and in `<HeroBlock>`. LPs that hand-roll the hero without `<HeroBlock>` break this spec. | `ui_kits/website/index.html` `@keyframes kenburns`; `EXECUTION_PLAN.md` §9 L3 | Hero sections | G6 (mockup parity for pages that have a `parity.json`) | `<HeroBlock>` primitive |
| **COMPONENT MANDATE** |
| D29 | shadcn/ui components from `@/components/ui/` are the ONLY permitted styling authority for form controls, cards, dialogs, tabs, dropdowns, tooltips, separators, labels, textareas, switches, avatars, tables, accordions, alerts, progress bars, skeletons, sheets. Raw `<button>`, `<input>`, `<select>` etc. in page-level code are a violation. | `CLAUDE.md` §5 (Component Mapping table) | All pages | G2/G3 (partial — checks text, not component usage) | ESLint rule to detect raw HTML form elements outside `components/ui/` |
| D30 | `cn()` from `@/lib/utils` is required for all conditional/merged className strings. String concatenation of class names is banned. | `CLAUDE.md` §5 "Utility Function" | All `.tsx` files | NONE | ESLint `no-restricted-syntax` targeting template literals + conditional className patterns |
| D31 | Custom CSS classes (`card-base`, `btn-cta`, any class from old `globals.css` custom layer) are banned. Use shadcn components directly. | `CLAUDE.md` §5 "Custom CSS Classes" | All pages | NONE | `scripts/lint-design-tokens.js` — add banned-class detection |
| D32 | Inline `<style>` tags in page-level `.tsx` files are a violation of the design system. Style belongs in Tailwind utility classes, `globals.css`, or CSS modules. The `/lp/bend/page.tsx` has a 400+ line `<style>` block. | `CLAUDE.md` §5; EXECUTION_PLAN.md §9 Wave 2 | `app/lp/bend/page.tsx` (critical current violation) | NONE | ESLint `no-restricted-syntax` — detect `<style>` JSX elements in `app/**/*.tsx` |
| D33 | The `tetherow/page.tsx` uses `<TetherowGlobalStyle />` (a client component injecting `<style>` tags) and wraps everything in `bg-[color:var(--rr-cream)]` arbitrary color values. Same violation as D32. | `app/lp/tetherow/page.tsx` line 188 | `app/lp/tetherow/page.tsx` | NONE | Same as D32 |
| **ICONS** |
| D34 | Heroicons (24×24, 2px stroke, round) are the primary icon library. HugeIcons for filled variants. Inline SVG as a last resort. Never use emoji as icons. | `SKILL.md` "Visual rules"; `README.md` "Iconography" | All icon surfaces | NONE | Dependency audit; ESLint ban on emoji in JSX |
| **IMAGERY** |
| D35 | Canonical hero photography: `design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg` (Old Mill District, three smokestacks, American flag, Deschutes River). Pre-cropped platform variants in the same `hero/` folder. Use this for any banner/cover/header hero slot. | `CLAUDE.md` §6 "Heritage asset cheat sheet"; `MANIFEST.md` "CANONICAL BRAND HERO" | Hero sections, email banners, social covers | NONE | `scripts/lint-design-tokens.js` or pre-commit hook checking hero image paths |
| D36 | Broker headshots: `design_system/ryan-realty/assets/team/{slug}.png` (transparent PNG, canonical) or `/public/images/brokers/` web mirror. 800×1200, normalized head height. Never use arbitrary cropped versions or white-background JPGs where transparent PNGs are available. | `MANIFEST.md` "Brokers"; `SKILL.md` "Brokers"; `CLAUDE.md` §6 | Any broker portrait | NONE | Pre-commit hook checking headshot paths |
| D37 | Never add a rectangular box, border, or drop-shadow that fakes a frame behind a transparent broker portrait. | `SKILL.md` "Listing-agent rule"; `CLAUDE.md` §6 | `<BrokerCard>` | NONE | Code review; visual diff |
| D38 | No AI-generated slop imagery. No generic stock. Use documentary Central Oregon photography + navy heritage engravings + the Jax mascot. | `SKILL.md` "Visual rules"; `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Photo selections | NONE | Manual review gate |
| **TWO-REGISTER MODEL** |
| D39 | Heritage register (yard signs, postcards, IG posts, email banners, print) uses navy monochrome on cream, Amboqia display, pre-rendered wordmark images. Web/product register uses shadcn/ui, Geist body, Amboqia for display H1s. Never mix on the same surface except a single cross-register hero or footer block. | `SKILL.md` "Two registers"; `MANIFEST.md` "Two registers" | Per-surface register selection | NONE | Design review; visual diff against mockup |
| D40 | Mockup pixel target: every Wave 3 page rebuild must visually match `design_system/ryan-realty/ui_kits/<route>/index.html`. Human sign-off per section. | `EXECUTION_PLAN.md` §1 "Pixel diff"; §9 Wave 3 | All `app/<route>/page.tsx` | G6 (component imports only, not visual pixel diff) | `design_system/ryan-realty/ui_kits/<route>/parity.json` + G6 |
| **BRAND VOICE — PUNCTUATION** |
| D41 | Em dashes (`—` U+2014) and en dashes (`–` U+2013) banned as punctuation in all consumer-facing text. Replace with period or comma. Exception: as a data placeholder for unavailable stats (e.g. `—` in a table cell). | `CLAUDE.md` §3 "Banned punctuation"; `MANIFEST.md` "No emoji" | All JSX text strings | G2 (ESLint) + G3 (brand-voice script) | `scripts/brand-voice-vocabulary.cjs` |
| D42 | Semicolons banned in all body copy. Replace with a period. | `CLAUDE.md` §3 "Banned punctuation" | All JSX text strings | G2 / G3 | `scripts/brand-voice-vocabulary.cjs` |
| D43 | Dramatic colons (colon introducing a punchline in body prose) banned. Colons in headers, list intros, tables are fine. | `CLAUDE.md` §3 "Banned punctuation" | Body prose | G2 / G3 (partial — flagging colon patterns is not trivial) | Brand-voice script |
| D44 | Exclamation marks in body copy banned. One max per piece (social captions only). Zero in market-data content. | `CLAUDE.md` §3 "Banned punctuation"; `MANIFEST.md` "No exclamation marks" | All consumer text | G2 / G3 | `scripts/brand-voice-vocabulary.cjs` |
| **BRAND VOICE — BANNED WORDS** |
| D45 | Banned real-estate clichés: stunning, breathtaking, gorgeous, charming, pristine, nestled, boasts, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey, immaculate, captivating, exquisite. | `CLAUDE.md` §3 "Banned words"; `SKILL.md` "Never" | All consumer text | G2 / G3 | `scripts/brand-voice-vocabulary.cjs` (G20 ensures single source) |
| D46 | Banned AI filler: delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster. | `CLAUDE.md` §3 "Banned words" | All consumer text | G2 / G3 | Same |
| D47 | Banned vague qualifiers (use the real number instead): approximately, roughly, about, around, fairly, somewhat. | `CLAUDE.md` §3; `MANIFEST.md` "Banned vocabulary" | All consumer text | G2 / G3 | Same |
| D48 | Banned marketing slop: top producing, top 1 percent, white glove, luxury concierge, premier brokerage, exclusive (brokerage descriptor), boutique brokerage, your real estate journey, we are passionate about, we pride ourselves on. | `CLAUDE.md` §3 "Banned words" | All consumer text | G2 / G3 | Same |
| D49 | Banned fake urgency phrases: act fast, don't miss out, won't last long, won't last. | `CLAUDE.md` §3 | All consumer text | G2 / G3 | Same |
| D50 | Banned hype openings: "get ready to fall in love," "you won't believe," "introducing," "stunning new listing." | `CLAUDE.md` §3 | Hero text, social captions | G2 / G3 | Same |
| D51 | Banned pandering: "what a beautiful home," "you have great taste," "don't worry, we will handle everything," "let me explain in simple terms." | `CLAUDE.md` §3 | All consumer text | G2 / G3 | Same |
| **BRAND VOICE — PRONOUNS + VOICE** |
| D52 | "You/your" is the subject throughout. "We/our team" for brokerage identity. "I" only in genuinely first-person Matt content (video VO, personal letter, review response). Never mix registers in the same block. | `SKILL.md` "Voice + content rules"; `MANIFEST.md` "You/your" | All consumer text | NONE | Brand-voice review checklist; not mechanizable easily |
| D53 | Show, don't tell. Never describe the brand's own tone (passionate, dedicated, warm). Let specificity do the work. | `SKILL.md` "The principle"; `README.md` "CONTENT FUNDAMENTALS" | All consumer text | NONE | Editorial review |
| **BRAND VOICE — NUMBERS + DATA** |
| D54 | Tabular numerals (`font-variant-numeric: tabular-nums` / `.rr-tabular` / Tailwind `tabular-nums`) required on every numeric surface: prices, counts, day ranges, percentages. | `SKILL.md` "Voice + content rules"; `MANIFEST.md` "Tabular numerals"; `colors_and_type.css` `.rr-tabular` | All stat cards, market data, tables | Partial (`<Price>` primitive has `tabular-nums`; raw number strings do not) | `<Price>`, `<TabularNumber>`, `<DaysCount>`, `<PercentChange>` primitives |
| D55 | Currency rounded to nearest thousand: `$895,000` not `$894,750`. | `SKILL.md` "Voice + content rules"; `MANIFEST.md`; `CLAUDE.md` §3 | All price displays | Partial (`<Price>` primitive enforces this) | `<Price>` primitive — `components/site/primitives/Price.tsx` |
| D56 | Days expressed as integer + "days": `38 days` not `38-day DOM` or `38d`. | `CLAUDE.md` §3; `MANIFEST.md` | All DOM displays | NONE | `<DaysCount>` primitive — `components/site/primitives/DaysCount.tsx` |
| D57 | Percents: one decimal, signed arrow when YoY: `↑ 2.1% YoY`. | `CLAUDE.md` §3; `MANIFEST.md` | Market stats | Partial (`<PercentChange>` primitive) | `<PercentChange>` primitive |
| D58 | Unavailable stats use em-dash `—` as data placeholder (this is the ONE place em-dash is allowed). Do not use `N/A`, `n/a`, `null`, `0`, or `—` for visual decoration. | `MANIFEST.md` "Unavailable → em-dash"; `SKILL.md` | Stat cards, tables | Partial (`<Price>` returns `—` for null) | `<Price>`, `<TabularNumber>` primitives |
| **BRAND IDENTITY STRINGS** |
| D59 | Phone (brand voice / yard sign): `541.213.6706` (dotted format). Phone (bio / FUB-tracked / social / ads): `541.703.3095`. Never use dashes (`541-213-6706`) or parentheses. | `SKILL.md`; `MANIFEST.md`; `CLAUDE.md` §6 | All consumer surfaces | NONE | `scripts/brand-voice-vocabulary.cjs` — add phone-format regex |
| D60 | Web URL: `ryan-realty.com` (hyphenated, lowercase, no `www`). | `SKILL.md`; `MANIFEST.md` | All consumer text | NONE | Same |
| D61 | Place separator: middle dot `·` (U+00B7), not a hyphen, pipe, or slash: `BEND · OREGON`, `QUALITY · LOCAL · SERVICE`. | `MANIFEST.md` "Place separator"; `SKILL.md` | All place name strings | `<MiddleDot>` primitive exists but usage not enforced | `<MiddleDot>` primitive — `components/site/primitives/MiddleDot.tsx` |
| D62 | Social handles: `@ryanrealtybend` on every platform (IG, TikTok, Threads, YouTube, X, Pinterest). `/ryanrealtybend` on FB and LinkedIn. No `@ryanrealtybend1` or other variants. | `MANIFEST.md` "Social handles (locked 2026-05-13)"; `CLAUDE.md` §6 | All consumer text referencing socials | NONE | `scripts/brand-voice-vocabulary.cjs` — add handle regex |
| D63 | Hashtag rule: every social caption on a hashtag-supporting platform includes `#RyanRealtyBend` as the first hashtag in the trailing block. | `MANIFEST.md` "Hashtag rule"; `CLAUDE.md` §6 | Social captions | NONE | Social publishing pipeline gate |
| D64 | Tagline "It's About Relationships." is a signature line used with the wordmark in heritage marketing. Do not sprinkle it in body copy. | `SKILL.md` "Content rules"; `MANIFEST.md` | Heritage surfaces only | NONE | Editorial review |
| D65 | License # 201206613 (Matt Ryan, OR Principal Broker). Must appear in legal footer on any page that captures leads or represents transactions. | `EXECUTION_PLAN.md` §9 L2 (`SiteFooter`); `MANIFEST.md` "Brand facts" | Footer, lead-cap pages | NONE | `scripts/check-seo-routes.mjs` or footer content test |
| **NO EMOJI** |
| D66 | No emoji in blog posts, email body, ad headlines, or video on-screen text. One emoji max in a social caption. No emoji as icons in the UI ever. | `CLAUDE.md` §3; `SKILL.md` "Never"; `MANIFEST.md` "No emoji" | All consumer text | G2 (partial) | `scripts/brand-voice-vocabulary.cjs` — add emoji regex |
| **CI / DAL / ARCHITECTURE** |
| D67 | Every `app/<route>/page.tsx` imports data only through `@/lib/data/` (the DAL). No raw Supabase `.from()` calls outside `lib/data/`. | `EXECUTION_PLAN.md` §4; `MECHANICAL_GATES.md` G1/G8 | All page files | G1 + G8 (active) | `scripts/check-dal-boundary.mjs` + `scripts/check-page-dal.mjs` |
| D68 | Every dynamic route `[slug]` must export `generateStaticParams`. | `EXECUTION_PLAN.md` §9 Wave 3; `MECHANICAL_GATES.md` G9 | All `[slug]` routes | G9 (active) | `scripts/check-static-params.mjs` |
| D69 | Bundle per route ≤ 250 KB (JS). | `EXECUTION_PLAN.md` §1 | All routes | G10 (active) | `scripts/check-bundle-budget.mjs` |
| D70 | Mockup parity: every gated Wave 3+ route imports every component listed in its `parity.json`. | `MECHANICAL_GATES.md` G6; `EXECUTION_PLAN.md` §1 | All `app/<route>/page.tsx` | G6 (active but only `listing-detail` has a `parity.json` today) | `scripts/check-mockup-parity.mjs` + per-route `parity.json` |
| D71 | Lighthouse: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 90, SEO ≥ 95, LCP ≤ 2500ms. | `EXECUTION_PLAN.md` §1 | All LP routes | G15 (wired but not yet blocking all routes) | `lhci autorun` in CI |
| D72 | No decorative gradients anywhere in the UI. Only the navy protection overlay on hero images and the hero Ken Burns scrim. | `SKILL.md` "No decorative gradients"; `EXECUTION_PLAN.md` §9 L3 | All pages | NONE | `scripts/lint-design-tokens.js` — add gradient detection |

**Total Section A rules: 72**

---

## SECTION B — Audit of Matt's Existing Landing Pages

### LP Pages Inventoried

| # | Path | Type | Notes |
|---|---|---|---|
| B1 | `app/lp/seller-home-value/page.tsx` | Live page (Next.js, App Router) | Matt's primary seller conversion LP; most design-complete |
| B2 | `app/lp/expired-listing/page.tsx` | Live page | Voice-compliant; minimal visual system |
| B3 | `app/lp/buyer-listing-alerts/page.tsx` | Live page | Bare minimum; essentially no visual system |
| B4 | `app/lp/tetherow/page.tsx` | Live page (community LP) | Rich data; heavy hand-rolled CSS |
| B5 | `app/lp/bend/page.tsx` | Live page (city LP) | Inline 400+ line `<style>` block; Playfair Display font |
| B6 | `app/lp/central-oregon-golf/page.tsx` | Live page | Not audited in depth — follow-on format |
| B7 | `design_system/ryan-realty/ui_kits/seller-lp/index.html` | Mockup (canonical reference) | Uses `colors_and_type.css` tokens; canonical layout target |
| B8 | `design_system/ryan-realty/ui_kits/expired-lp/index.html` | Mockup (canonical reference) | Uses tokens; full header + hero + 5-cause framework |
| B9 | `design_system/ryan-realty/ui_kits/buyer-alerts-lp/index.html` | Mockup (canonical reference) | Uses tokens; hero + form + sample digest |
| B10 | `design_system/ryan-realty/ui_kits/website/index.html` | Mockup (canonical homepage reference) | The primary pixel target for the whole site |
| B11 | `public/template-picker/preview/list-kit-tumalo-v3.html` | Preview template | Heritage register; Amboqia display; correct palette |
| B12 | `public/drafts/cma-228-soft-tail/cma.html` | Draft document | Correct palette + Amboqia; print register |

---

### B1 — `app/lp/seller-home-value/page.tsx`

**Type:** Live page (primary seller LP).

**Rules honored (sample of 15):**

| Rule | Evidence |
|---|---|
| D01 (navy `#102742`) | Uses `bg-primary`, `text-primary` semantic tokens throughout — no raw hex except one `bg-[#faf8f4]` |
| D08 (Amboqia display) | `font-display` Tailwind utility on every heading (`h1`, `h2`, all section headers) — `<DisplayHeading>` pattern |
| D10 (Geist body) | Default `font-sans` inherited from layout; body copy uses no inline font overrides |
| D11 (pre-rendered wordmark) | Logo loaded via `Image src="/images/brand/logo-horizontal-blue.png"` — correct canonical path |
| D16 (sentence case headings) | "Here's exactly what happens." / "Why your Zestimate is probably off." — all sentence case |
| D29 (shadcn/ui) | Does NOT use shadcn/ui primitives for the form; uses raw `<details>`, `<summary>` for FAQ instead of `<Accordion>`. Minor violation (acceptable for a custom FAQ pattern with no shadcn equiv) |
| D41 (no em-dash) | Zero em-dashes found in prose |
| D44 (no exclamations in body) | Zero exclamation marks |
| D45 (no clichés) | Zero banned clichés |
| D54 (tabular numerals) | `tabular-nums` class on market stat values; `<MarketStat>` inline component uses `font-display text-3xl tabular-nums` |
| D55 (`<Price>` rounding) | `formatPriceCompact()` rounds to thousands; `—` fallback for null |
| D59 (phone format) | `541.703.3095` dotted format, consistent throughout |
| D61 (middle dot) | `·` used as separator in legal footer: `Privacy · © 2026 Ryan Realty LLC` |
| D65 (license #) | `Oregon Principal Broker #201206613` in footer |
| D52 (you/your pronoun) | "Your Bend home is probably worth more than Zillow says." — you-first framing |

**Rules violated:**

| Rule | Specific violation |
|---|---|
| D17 (container width) | `max-w-7xl` used correctly in most sections; no violations |
| D04 (no raw hex in JSX) | Line 293: `className="... bg-[#faf8f4]"` — should be `bg-background` or `bg-muted` |
| D04 (no raw hex in JSX) | Line 404: `className="... bg-[#faf8f4]"` — same issue |
| D29 (shadcn/ui mandate) | Uses raw `<details>/<summary>` for FAQ instead of `<Accordion>` from `@/components/ui/accordion`. Minor — there is an `<FAQBlock>` primitive that should be used instead |
| D36 (transparent PNG headshot) | Line 154: `src="/images/brokers/ryan-matt.png"` — correct canonical path; however `className="object-cover object-top"` is applied inside a `rounded-full` crop that creates a rectangular frame appearance when zoomed (violates D37 partially) |
| D11 (RyanRealtyMark primitive) | Header uses raw `Image src="/images/brand/logo-horizontal-blue.png"` instead of `<RyanRealtyMark>` primitive. Not breaking but drifts from system. |
| D29 (CTAButton primitive) | Header phone CTA and footer phone CTA are raw `<a>` elements styled inline, not `<CTAButton>` primitives |
| D70 (parity.json) | No `parity.json` exists for `/lp/seller-home-value` — G6 does not protect this page |

**Primitive usage:** Partial. Uses `font-display` utility (the display font primitive's output) and semantic tokens correctly. Does NOT use `<DisplayHeading>`, `<CTAButton>`, `<FAQBlock>`, `<BrokerCard>`, `<MarketSnapshot>`, or any composition-block primitive from `components/site/`. Effectively hand-rolls everything.

**Reference LP verdict: YES.** This is the closest to a "reference LP" in the repo. Voice is clean, tokens are largely correct, layout follows `max-w-7xl`, semantic shadcn tokens used throughout. The visual approach — hero photo with navy overlay, trust strip, three-step breakdown, market stats grid, heritage block, footer CTA — matches the `ui_kits/seller-lp/index.html` mockup structure closely.

---

### B2 — `app/lp/expired-listing/page.tsx`

**Type:** Live page (expired-listing LP).

**Rules honored (sample):**

| Rule | Evidence |
|---|---|
| D10 (Geist body) | No font override; inherits layout Geist |
| D16 (sentence case) | "The five things that usually broke" / "What an honest re-list looks like with us" — sentence case |
| D41 (no em-dash) | Zero em-dashes |
| D44 (no exclamations) | Zero exclamations |
| D45 (no clichés) | Clean voice; no banned words |
| D52 (you/your pronoun) | "Your home didn't sell." / "Your home was on the market." — you-first |
| D59 (phone dotted) | `541.703.3095` correct |
| D65 (license #) | `Ryan Realty · Bend, Oregon · 541.703.3095` in footer; license # missing from the footer |

**Rules violated:**

| Rule | Specific violation |
|---|---|
| D08 (Amboqia display) | `h1` and all `h2` elements use default Geist (`font-sans` inherited), NOT `font-display` / `<DisplayHeading>`. Hero H1 should be Amboqia. All section H2s should be Amboqia per mockup. |
| D11 (wordmark) | No header logo present at all — the page has no `<SiteHeader>`, no `<header>` wrapper with the Ryan Realty wordmark |
| D21 (card radius) | Uses `rounded-2xl` for the form card at line 63, `rounded-xl` for CTA cards at line 157. Should all be `rounded-xl` (14px) for cards and `rounded-[10px]` for buttons |
| D17 (container) | Uses `max-w-3xl` for all sections, which is intentionally narrow for a conversion LP — acceptable for this format but diverges from `max-w-7xl` standard |
| D29 (shadcn/ui) | Raw `<details>/<div>` for FAQ instead of `<Accordion>`; raw `<div>` cards with hand-rolled padding instead of `<Card>` |
| D29 (shadcn/ui) | Uses raw `<a href="tel:...">` phone link instead of `<CTAButton>` |
| D65 (license #) | License # `201206613` is missing from the footer. Footer only shows phone. |
| D70 (parity.json) | No `parity.json` for this route |
| D28 (hero ken burns) | No hero photo section at all — page opens with plain white `bg-background` |

**Primitive usage:** Minimal. No composition-block primitives. No `<SiteHeader>`, no `<HeroBlock>`, no `<FAQBlock>`, no `<LeadCaptureBlock>`, no `<CTAButton>`. Closest thing to a bare template page.

**Reference LP verdict: NO.** Voice is excellent — the cleanest brand voice in any LP file. But the visual design is a stub: no hero, no header, no Amboqia display font on headings, no proper shadcn/ui primitives. The voice is the bar; the visual execution is not. This is what Matt is frustrated about.

---

### B3 — `app/lp/buyer-listing-alerts/page.tsx`

**Type:** Live page (buyer alerts LP).

**Rules honored (sample):**

| Rule | Evidence |
|---|---|
| D10 (Geist body) | Inherits; no overrides |
| D41 (no em-dash) | Clean |
| D44 (no exclamations) | Clean |
| D59 (phone dotted) | `541.703.3095` correct |
| D52 (you/your) | "Tell us what you're looking for." |

**Rules violated:**

| Rule | Specific violation |
|---|---|
| D08 (Amboqia display) | `h1` at line 26 uses `font-bold` Geist, not `font-display`. Should be `<DisplayHeading as="h1">`. |
| D11 (wordmark) | No header logo — page has no `<SiteHeader>` |
| D16 (sentence case) | "Find Your Bend Home — Personalized Listing Alerts" in title is Title Case (acceptable for `<title>` metadata), but the on-page H1 "Find your Bend home — first matches in 30 minutes." is correct sentence case |
| D41 (em-dash as separator) | "Find your Bend home — first matches in 30 minutes." — this em-dash is used as punctuation, not as a data placeholder. Violation. Should be a period or comma. |
| D28 (hero) | No hero section at all |
| D29 (shadcn/ui) | Raw `<form>` via `<BuyerLPForm>` — needs audit of that component |
| D65 (license #) | Missing from the page entirely |
| D70 (parity.json) | No `parity.json` |

**Primitive usage:** None. The thinnest of all the live LPs. No primitives, no composition blocks, no SiteHeader.

**Reference LP verdict: NO.** A conversion stub. The mockup `ui_kits/buyer-alerts-lp/index.html` shows a full hero + form card + sample email digest preview + trust strip + testimonials. The live page is a fraction of that.

---

### B4 — `app/lp/tetherow/page.tsx`

**Type:** Live page (community LP, data-rich).

**Rules honored (sample):**

| Rule | Evidence |
|---|---|
| D01 (navy #102742) | Uses `var(--rr-navy)` consistently inside `TetherowGlobalStyle` |
| D02 (cream #faf8f4) | `var(--rr-cream)` as page background |
| D67 (DAL) | All data fetched through DAL functions (`fetchTetherowKpi`, etc.) |
| D54 (tabular numerals) | `font-variant-numeric: tabular-nums` in custom CSS |
| D59 (phone dotted) | `541.213.6706` appears in JSON-LD; `541.703.3095` should be used on lead-capture surfaces — both present in different contexts appropriately |

**Rules violated:**

| Rule | Specific violation |
|---|---|
| D32/D33 (no inline `<style>`) | `<TetherowGlobalStyle />` is a client component that injects a large `<style>` block. Entire page's visual system lives in this injected style. Major violation of the design-system mandate. |
| D04 (no raw hex) | `bg-[color:var(--rr-cream)]` (arbitrary color function syntax) and `text-[color:var(--rr-text)]` — non-standard Tailwind syntax that bypasses the token system |
| D08 (Amboqia display) | The `var(--rr-font-display)` in the injected style maps to `'Playfair Display', Georgia, serif` via the page's self-contained token redefinition — NOT to Amboqia Boriango. Critical violation: the display font is wrong. |
| D06 (warm stone, no cool grey) | Internal CSS uses `--rr-muted: #a3a8af` (cool grey) — retired, not the warm stone neutral |
| D17 (container) | Uses `max-w-[1200px]` not `max-w-7xl` |
| D29 (shadcn/ui mandate) | Page uses `Card`, `Button`, `Badge` from shadcn/ui for some elements (lines 26-28) — positive. But many sections use hand-rolled JSX with arbitrary class names from the injected style sheet, not shadcn |
| D70 (parity.json) | No `parity.json` for this route |
| D40 (mockup parity) | No matching mockup `ui_kits/community/index.html` parity contract defined |

**Primitive usage:** Partial. Imports `Card`, `Button`, `Badge` from shadcn/ui. Does NOT use any `components/site/primitives/*` or `components/site/*` composition blocks. Has its own sub-component ecosystem (`TetherowScroller`, `TetherowStickyCta`, etc.) that is entirely self-contained and does not feed into the site-wide primitive system.

**Reference LP verdict: CONDITIONAL.** The Tetherow LP is data-rich and voice-clean, and it demonstrates the right data-accuracy approach (live Supabase, fallbacks, ISR). But it is a design-system island: wrong display font (Playfair not Amboqia), self-contained CSS, non-standard container width, and no site primitives. It is a reference for the data-accuracy and voice patterns, not for the visual system.

---

### B5 — `app/lp/bend/page.tsx`

**Type:** Live page (city LP).

**Rules honored (sample):**

| Rule | Evidence |
|---|---|
| D67 (DAL) | Uses `import('@/lib/data')` for all data fetches — correct |
| D02 (cream) | `--tw-cream: #faf8f4` in inline style block |
| D01 (navy) | `--tw-navy: #102742` consistent |
| D54 (tabular numerals) | `font-feature-settings: "tnum" on, "lnum" on` in body style |

**Rules violated:**

| Rule | Specific violation |
|---|---|
| D09/D08 (Playfair Display, wrong font) | Lines 283-335: `.bend-h1`, `.bend-h2`, `.bend-h3`, `.community-name`, `.facts-sidebar dd`, `.lifestyle-hero-title` all use `font-family: 'Playfair Display', Georgia, serif`. This is the retired fallback, not Amboqia Boriango. |
| D32 (no inline `<style>`) | Lines 276-468: 400+ line `<style>` block inside the JSX `return`. Entire page layout lives in this block. Most severe single violation in the repo. |
| D04 (raw hex) | Multiple raw hex values: `#faf8f4`, `#102742`, `rgba(16,39,66,...)` scattered throughout the inline style block |
| D17 (container) | `.bend-shell { max-width: 1160px }` — not `max-w-7xl` (1280px) |
| D22 (radius ladder) | `.community-card { border-radius: 16px }`, `.lifestyle-card { border-radius: 16px }` — 16px is not in the radius ladder. Should be `--radius-xl` (14px) |
| D23 (navy shadows) | Multiple inline `box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 6px 18px rgba(16,39,66,0.06)` — correct tint but should use `var(--shadow-sm)` / `var(--shadow-md)` tokens |
| D29 (shadcn/ui) | No shadcn/ui components used. No `@/components/ui/*` imports. Raw HTML `<main>`, `<section>`, `<div>` with inline class names |
| D11 (RyanRealtyMark) | No header/logo at all on this page |
| D70 (parity.json) | No `parity.json` |

**Primitive usage:** NONE. No `components/site/*` imports. No `components/site/primitives/*`. No shadcn/ui components. Fully self-contained with inline styles.

**Reference LP verdict: NO.** This page is the clearest example of the problem Matt is describing. It has the right data and right content but the wrong visual system entirely.

---

### B6 — `design_system/ryan-realty/ui_kits/seller-lp/index.html`

**Type:** Canonical mockup HTML.

**Rules honored:**
- Loads `colors_and_type.css` — all CSS vars correct
- `--font-display` used for headings (maps to Amboqia)
- `rr-eyebrow` class for eyebrow labels
- `btn btn-primary`, `btn-on-navy` button classes
- `stat-card`, `steps`, `cta-card` layout patterns
- `max-w-[1280px]` container (matches `--container: 1280px`)
- Sentence case for all section headings
- No em-dashes, no clichés, no exclamations
- Hero uses `hero-old-mill-master-4k.jpg` (canonical hero)
- `kenburns 20s` animation on hero
- Navy overlay gradient (no raw color decorations)
- Eyebrow/label pattern: `rr-eyebrow` + sentence-case heading

**Rules violated (mockup-level):**
- None of consequence — this IS the reference. It is the target.

**Mockup verdict: CANONICAL REFERENCE.** The `ui_kits/seller-lp/index.html` is Matt's primary reference. The live `app/lp/seller-home-value/page.tsx` gets closest to it (voice + token usage) but does not use the `<SiteHeader>` / `<SiteFooter>` primitives, the `<HeroBlock>`, or the canonical hero photo.

---

### B7 — `public/template-picker/preview/list-kit-tumalo-v3.html`

**Type:** Preview template (heritage register, listing kit).

**Rules honored:**
- Amboqia Boriango via `@font-face` — correct OTF loaded
- `--navy: #102742`, `--cream: #faf8f4` — correct two-color palette
- Azo Sans for eyebrow/h3 labels with `letter-spacing: 0.18em; text-transform: uppercase` — correct
- Geist body font
- Warm stone background; navy monochrome display headings
- No emoji, no clichés, no em-dashes in visible text
- Card radius: `16px` on photo cells (slight drift from `--radius-xl: 14px`)

**Rules violated (minor):**
- D22 (radius): photo carousel cells at `16px` not `14px`
- Not wired into the Next.js primitive system (it's a standalone HTML — expected)

**Template verdict: REFERENCE.** This is the cleanest demonstration of the heritage register in the repo. Correct fonts, correct palette, correct proportions. Matt uses this as a print/social template bar.

---

### B8 — `public/drafts/cma-228-soft-tail/cma.html`

**Type:** Draft CMA document (print register).

**Rules honored:**
- Amboqia Boriango via `@font-face` — correct
- `--navy: #102742`, `--cream: #faf8f4` — correct
- Geist for body, Amboqia for display moments
- `font-variant-numeric: tabular-nums` on the `<body>`
- Navy-tinted shadows in `box-shadow` patterns
- No emoji, no clichés

**Rules violated (minor):**
- `background: #e8e3d8` on the outer wrapper (sand-like neutral — slightly off the two-color palette spec; should be `#faf8f4` cream for the paper background)
- Uses Caveat font (Google Fonts import) for handwritten signature visual — acceptable as a one-off document flourish

**CMA verdict: STRONG REFERENCE for the print/document register.** Fonts, palette, and data-display patterns are correct. This shows what a brand-compliant document artifact looks like.

---

### Summary: Which LPs are Matt's Reference Set?

The 1–3 LPs that look like Matt's reference set (most aligned with Section A rules):

1. **`app/lp/seller-home-value/page.tsx`** — the closest live-Next.js implementation to the spec. Voice is clean, tokens are mostly correct, layout follows the mockup structure. Main gap: not using composition-block primitives, two raw-hex `bg-[#faf8f4]` values, no `<SiteHeader>`.

2. **`design_system/ryan-realty/ui_kits/seller-lp/index.html`** — the canonical mockup. This IS the design spec for the seller LP. Every live LP should be measured against it.

3. **`public/template-picker/preview/list-kit-tumalo-v3.html`** — the cleanest heritage-register implementation. Shows correct Amboqia + Azo Sans + Geist + navy/cream execution.

**The rest of the site** (buyer-alerts LP, expired LP, bend city LP, tetherow LP) all fail to meet the design spec in significant ways — wrong fonts, inline styles, missing headers, missing shadcn/ui primitives.

---

## SECTION C — Gaps + Propagation Mechanism Design

For each Section A rule that is NOT currently enforced, this section identifies the lowest reusable unit it should land in and the cascade path.

| Gap ID | Rule IDs | Gap Description | Lowest Reusable Unit | Cascade Path |
|---|---|---|---|---|
| **C01** | D06, D07 | Cool/slate grey and `bg-white`/`bg-black` usage not detected by CI | `scripts/lint-design-tokens.js` — add `BANNED_TAILWIND_CLASSES` set: `['bg-slate-*', 'bg-gray-*', 'text-slate-*', 'bg-white', 'bg-black']` with explicit exceptions for `bg-white/90` on-photo badges | Running `npm run ci:design-tokens` fails any file introducing `bg-gray-500`, `bg-slate-100`, etc. Every page inherits because CI blocks the commit. |
| **C02** | D08, D09, D15 | Playfair Display is used in `app/lp/bend/page.tsx` and `app/lp/tetherow/page.tsx` inline styles. G24 (RETIRED_FONTS) has a ratchet that is not failing on these files because the font name is inside a JSX string template, not a CSS `@import`. | Extend G24 script to scan `<style>` JSX string literals and inline `style={{fontFamily: ...}}` props for `Playfair Display`, `Inter`, `Helvetica`, `AzoSans` (when in web register). | G24 extended to detect strings, not just import statements. Any `<style>` block containing `font-family: 'Playfair Display'` fails CI. |
| **C03** | D10, D13, D14 | `<Eyebrow>` primitive exists (`components/site/primitives/Eyebrow.tsx`) but is not used in any LP page. Eyebrow strings are hand-rolled with arbitrary `text-xs uppercase tracking-wider` variations. | `<Eyebrow>` primitive in `components/site/primitives/`. Document the rule: any JSX pattern matching `text-xs font-semibold uppercase tracking-wider text-muted-foreground` is a signal to replace with `<Eyebrow>`. | Add to the `parity.json` for every LP route that has an eyebrow label. G6 then fails if the import is missing. |
| **C04** | D11 | `<RyanRealtyMark>` primitive exists but is not used in the three LP pages that have headers. `seller-home-value` uses raw `Image src="/images/brand/logo-horizontal-blue.png"`. `expired-listing` and `buyer-alerts` have no header at all. | `<RyanRealtyMark>` primitive in `components/site/primitives/Logo.tsx`. The `<SiteHeader>` composition block wraps it. | Add `SiteHeader` to `parity.json` for all LP routes. G6 fails until the LP pages import and use `<SiteHeader>`. |
| **C05** | D16 | Sentence-case headings. G2/G3 check for banned words in text strings but do not check capitalization patterns. Title-case headings on H2/H3 would not be caught. | `scripts/check-brand-voice.mjs` — add a sentence-case linter that flags JSX `h2`/`h3`/`h4` children where the majority of words are capitalized (heuristic: >2 consecutive words start with capital letters). | The script runs in CI on every PR. Title Case h2/h3 headings trigger a warning (not a block — heuristic has false positives for proper nouns). Human review on warning. |
| **C06** | D17 | Container width drift. `max-w-[1200px]`, `max-w-[1160px]`, `max-w-3xl` used on LP section wrappers instead of `max-w-7xl`. | `<Container>` primitive in `components/site/primitives/Layout.tsx`. Add to ESLint no-restricted-syntax: detect `max-w-\[` (arbitrary max-width) in className strings outside `components/site/primitives/Layout.tsx`. | ESLint fails on any `max-w-[...]` utility in a page file. All pages must use `<Container>` or the Tailwind token `max-w-7xl`. |
| **C07** | D23, D24 | Shadow tokens not used. Inline `box-shadow: 0 ... rgba(16,39,66,...)` is everywhere in `app/lp/bend/page.tsx` and `app/lp/tetherow/page.tsx`. | `scripts/lint-design-tokens.js` — scan for `box-shadow:` in JSX string styles and flag any that don't reference a `--shadow-*` CSS var. | CI fails on inline `box-shadow` that bypasses the token system. Pages forced to use `shadow-sm`, `shadow-md`, `shadow-lg` Tailwind utilities. |
| **C08** | D26, D27 | Transition durations and easing not standardized. `transition: 0.25s ease` vs `transition: 0.15s` vs `transition: background 0.2s` — no enforcement. | `scripts/lint-design-tokens.js` — add transition-duration check: flag any duration that is not `150ms`, `200ms`, `300ms`, or `400ms` (the design system ladder). | Script warns on first violation. Once warningless, convert to error. Pages using `transition-duration-[250ms]` get flagged and must migrate to `transition-duration-200` or `transition-duration-300`. |
| **C09** | D28 | Hero Ken Burns animation absent on `expired-listing` and `buyer-alerts` LPs. No hero photo section at all. | `<HeroBlock>` composition block in `components/site/HeroBlock.tsx`. | Add `HeroBlock` to `parity.json` for all LP routes that the mockup shows with a hero. G6 fails if `HeroBlock` import is missing from the route file. |
| **C10** | D29, D30 | Raw `<button>`, `<input>`, `<select>` in page-level code. `cn()` not used for conditional classes in some LPs. | ESLint rule `no-restricted-syntax` targeting JSX `<button>`, `<input>`, `<select>` outside `components/ui/` and `components/site/`. | Every page-level file that uses raw form elements fails CI. LPs must delegate to `<LeadCaptureBlock>`, `<CTAButton>`, or the shadcn primitives. |
| **C11** | D31 | Custom CSS class names from globals.css not mechanically banned. Old patterns still appear in some files. | `scripts/lint-design-tokens.js` — add `BANNED_CLASSES` set: `['card-base', 'btn-cta', 'section-title', 'hero-title']`. | CI fails on any file importing or using these class names. Automatically catches any new drift back to the old class system. |
| **C12** | D32, D33 | Inline `<style>` JSX tags in `app/**/*.tsx` — `bend/page.tsx` (400+ lines) and `tetherow/page.tsx` (via `TetherowGlobalStyle`) are active violations. | ESLint `no-restricted-syntax`: detect `JSXElement[openingElement.name.name='style']` inside `app/**/*.tsx` files (JSX `<style>` elements). Allow in test files and `preview/*.html`. | Every new `<style>` in a page file fails CI immediately. Existing violations are baselined (ratchet pattern) and cleared as pages are rebuilt. |
| **C13** | D34 | Emoji as icons. G2 catches some emoji in text strings but does not scan `aria-label` props or SVG `aria-label` strings. | `scripts/check-brand-voice.mjs` — extend emoji regex to scan `aria-label` and `alt` prop values. | CI script catches emoji in accessibility labels. |
| **C14** | D35, D36 | Hero image path and broker headshot path not validated. A page could swap in a different hero or a white-background JPG and no gate would catch it. | `scripts/lint-design-tokens.js` — add CANONICAL_HERO_PATH check: any `src="/images/lp/hero-*.jpg"` that is not the canonical `hero-old-mill-master-4k.jpg` gets a warning. Broker headshot: any `src` that matches `ryan-matt`, `paul-stevenson`, `rebecca-ryser-peterson` must use the `.png` path, not `.jpg`. | CI warns (not blocks — there are legitimate alternate hero photos for specific LPs). Human review required on warnings. |
| **C15** | D39 | Two-register discipline not checked. A page could mix heritage and web registers freely. | Visual diff against the corresponding `ui_kits/*.html` mockup. This is the human-in-the-loop gate (pixel diff per EXECUTION_PLAN.md §1). | Until a pixel-diff automation exists, the mechanism is: every Wave 3 rebuild requires Matt to compare the rendered page against the mockup before approval. This is already the stated process — it just needs to be enforced before commit not after. |
| **C16** | D40, D70 | No `parity.json` contracts exist for any LP route except `listing-detail`. G6 (mockup parity gate) therefore does not protect any LP page. | Create `parity.json` files for: `seller-lp`, `expired-lp`, `buyer-alerts-lp`, `city` (bend), `community` (tetherow), `zip`, `neighborhood`, `market-report`, `search`, `sell`, `about`, `team`. | Once `parity.json` files exist, G6 enforces component imports on every PR. Pages that don't import the required components fail CI. This is the highest-leverage single action. |
| **C17** | D41–D51 (banned words) | G2 and G3 are active but the ratchet baseline may be protecting existing violations. The `buyer-alerts` H1 contains an em-dash: "Find your Bend home — first matches in 30 minutes." | `scripts/brand-voice-vocabulary.cjs` (G20 single source). The fix is to run `npm run ci:brand-voice:baseline` and shrink the ratchet on each LP page rebuild. | Each time an LP is rebuilt per the design system, the brand-voice ratchet shrinks and the surviving violations become blockers. No new violations get in. |
| **C18** | D54–D58 | `<TabularNumber>`, `<DaysCount>`, `<PercentChange>` primitives exist but are used in almost none of the LP pages. Number formatting is hand-rolled in each LP's inline helper functions. | The four numeric primitives (`Price`, `TabularNumber`, `DaysCount`, `PercentChange`) in `components/site/primitives/`. Add all four to parity contracts for any page with market stats. | G6 enforces import; once imported, the page must use them for its numeric surfaces. Inconsistent formatting (e.g. `38-day DOM` vs `38 days`) becomes visually obvious and gets corrected during code review. |
| **C19** | D59–D65 | Phone format, URL format, place separator, license # not checked by any gate. | Extend `scripts/brand-voice-vocabulary.cjs` with: (a) phone-format regex checking for dash or parenthesis format; (b) license-# presence check on pages with `robots: { index: false }` (lead-cap pages must have it); (c) `ryan-realty.com` hyphen check. | CI brand-voice script fails on `541-213-6706` or `ryanrealty.com` appearing in JSX strings. License # absence on indexed lead-cap pages triggers a warning in `check-seo-routes.mjs`. |
| **C20** | D66 (emoji) | Emoji in JSX text strings partially caught by G2. Not caught in: image `alt` props, `aria-label` props, SVG title elements, metadata strings. | Extend `scripts/check-brand-voice.mjs` emoji scan to cover these additional prop locations. | Comprehensive emoji detection; nothing escapes into production. |
| **C21** | D72 (no decorative gradients) | `text-gradient`, `background: linear-gradient(...)` in JSX styles not detected except for the hero overlay pattern. `bend/page.tsx` and `tetherow/page.tsx` have multiple CSS `linear-gradient` in their inline style blocks. | `scripts/lint-design-tokens.js` — scan for `linear-gradient` in className strings and inline `style={{background: 'linear-gradient(...)'}}` outside of documented scrim patterns (`rgba(16,39,66,...)` to transparent is the only allowed gradient). | CI fails on any `linear-gradient` that doesn't match the navy-protection overlay pattern. Only one gradient pattern is allowed and it's checked by string match. |

**Total Section C gaps: 21**

---

## Recommended Schema for `docs/DESIGN_DIRECTIVES.md`

This file would be the source of truth for G25 (the new design-directive gate). Every row is a directive. The gate reads this file, maps each directive to its enforcement script, and fails CI if any `open` directive touches a surface that is not yet compliant.

### Column headers

```markdown
| ID | Directive | Source | Surfaces | Status | Gate mechanism | Cascade path | Opened | Resolved |
```

### Column definitions

| Column | Type | Values / Format | Notes |
|---|---|---|---|
| `ID` | string | `D01`–`D72`, then `D73+` for new additions | Immutable once assigned. Never reuse a retired ID. |
| `Directive` | string | One declarative sentence stating the rule. Subject is the surface, verb is the obligation. | "Body copy on every page must use Geist via `--font-sans` or the `<Body>` primitive." |
| `Source` | string | File path + section heading | "CLAUDE.md §5 Design System Rules — shadcn/ui ONLY" |
| `Surfaces` | string (comma-separated route globs) | `app/lp/**`, `app/listing/**`, `app/**`, `components/site/**` | Which files/routes this directive governs |
| `Status` | enum | `open` / `enforced` / `deferred` / `wont-fix` | `open` = gap exists and no gate catches it yet. `enforced` = a CI gate mechanically catches this. `deferred` = accepted technical debt with a justification and target wave. `wont-fix` = deliberate exception (e.g. `<style>` in a specific legacy file that can't be touched this quarter). |
| `Gate mechanism` | string | Gate ID (G01–G25) or `NONE` | Maps to `docs/MECHANICAL_GATES.md`. `NONE` means no gate exists yet. |
| `Cascade path` | string | One sentence: "Fixing X in Y propagates to Z because Z inherits from Y." | "Fixing `<DisplayHeading>` to enforce sentence-case tracking propagates to all pages that import it." |
| `Opened` | date | `YYYY-MM-DD` | When the directive was first written. |
| `Resolved` | date or `—` | `YYYY-MM-DD` or `—` if still open | When the gate first passed with zero new violations. |

### Status value semantics

| Status | CI behavior | Human action |
|---|---|---|
| `enforced` | Gate runs; violations fail CI | None — automation handles it |
| `open` | No gate. New violations can slip in. | Must be moved to `enforced` or `deferred` before the next Wave completes |
| `deferred` | Ratchet baseline absorbs existing violations; no new violations allowed | Must include a target wave or date and a justification comment |
| `wont-fix` | Permanently excluded from the gate | Requires Matt's explicit approval and a one-line reason in the `Resolved` column |

### What G25 should check

G25 is a CI script (`scripts/check-design-directives.mjs`) that:

1. **Reads `docs/DESIGN_DIRECTIVES.md`** — parses the table, builds a list of directives where `Status = open` or `Status = deferred`.

2. **For each `deferred` directive with a `target_wave` or `target_date` in the past**, surfaces a warning: "Directive D09 was deferred to Wave 3 which shipped. Status must be updated to `enforced` or `wont-fix`."

3. **For each `open` directive**, fails CI with: "Directive D06 has no gate mechanism. Add a gate or change status to `deferred` with a justification." This forces every open directive to either be mechanized or explicitly deferred — it cannot silently stay open indefinitely.

4. **For each `enforced` directive**, verifies that the referenced gate ID exists in `docs/MECHANICAL_GATES.md`. Drift between the two files fails CI.

5. **Summary report**: prints a count of `open` / `enforced` / `deferred` / `wont-fix` directives. The `open` count must be 0 for CI to pass.

### Sample rows (starter set — fill from Section A)

```markdown
| D01 | Brand navy must be `#102742` only via `--primary` or `--rr-navy`. No literal `#0a1a2e`, `#102640`, or any other navy shade. | `MANIFEST.md` "Brand colors" | `app/**` `components/**` | enforced | G4 | `scripts/lint-design-tokens.js` detects raw hex → all pages inherit | 2026-05-13 | — |
| D09 | Playfair Display must never appear in new page code. Retire all existing uses. | `MANIFEST.md` "Type families" | `app/**` | open | NONE | Extend G24 to scan `<style>` JSX strings | 2026-05-28 | — |
| D32 | Inline `<style>` JSX elements are banned in `app/**/*.tsx`. | `CLAUDE.md §5` | `app/lp/bend/**` `app/lp/tetherow/**` | deferred | NONE | Add ESLint rule; ratchet existing violations; target Wave 3 | 2026-05-28 | — |
| D70 | Every LP route must have a `parity.json` in `design_system/ryan-realty/ui_kits/<route>/`. | `MECHANICAL_GATES.md` G6 | `app/lp/**` `app/cities/**` | open | G6 (partial — only listing-detail covered) | Create `parity.json` per LP; G6 extends coverage automatically | 2026-05-28 | — |
```

### Maintenance protocol

- **New directive**: add a row with `Status = open`, `Gate mechanism = NONE`, `Opened = today`. Do not ship a directive that stays `open` past the current wave unless explicitly `deferred`.
- **New gate built**: update the matching directive row from `open` to `enforced`, fill in the Gate ID.
- **Wave milestone**: run G25 and ensure `open` count is 0 before declaring the wave done.
- **Deferred directive expiring**: G25 warns when a `deferred` directive's target date has passed. The agent (not Matt) is responsible for either building the gate or filing a `wont-fix` with a reason.

---

*End of audit.*
