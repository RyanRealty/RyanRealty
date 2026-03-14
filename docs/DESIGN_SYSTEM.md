# DESIGN_SYSTEM.md — Ryan Realty

**Read this file before writing any UI code.**
Last updated: March 2026 | Owner: Matt Ryan, Principal Broker

---

## RULE 0 — THE ONE RULE THAT CONTAINS ALL OTHERS

Every visual property on this site is expressed as a CSS custom property token.
No raw hex values. No raw pixel values. No hardcoded font sizes.
If the token doesn't exist, create it. Never bypass the token layer.

---

## 1. LOGO

### Files

| Asset | Path | Usage |
|---|---|---|
| Primary logo (color) | `/public/logo.png` | Light backgrounds, footer, print |
| Header logo (white) | `/public/logo-header-white.png` | Dark nav bar, hero overlays |

### Rules

- Header renders logo at `h-10 max-h-12 w-auto` via Next.js `<Image>` with `priority`
- Logo is loaded from brokerage settings when available; falls back to `/logo-header-white.png`
- Never stretch, crop, or recolor the logo
- Minimum clear space: the height of the "R" in "Ryan" on all sides
- No taglines or additional text appended to the logo mark

### PWA / Favicon

| Asset | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192x192 | Standard PWA icon |
| `icon-512.png` | 512x512 | Splash screen |
| `icon-maskable-512.png` | 512x512 | Maskable (Android adaptive) |
| `favicon.ico` | `/app/favicon.ico` | Browser tab |

- Theme color: `#102742` (matches `--color-primary`)
- Background color: `#102742`
- Defined in `/public/manifest.json`

---

## 2. FONTS

### Families (self-hosted, no external font requests)

```
Display / Headlines:  Amboqia Boriango — self-hosted OTF
Body / UI:            AzoSans — self-hosted TTF
```

**Never load any other font.** No Inter, no system-ui as a brand font, no Google Fonts, no additional display faces. The font stack for fallbacks only:

```css
--font-display: 'Amboqia Boriango', Georgia, 'Times New Roman', serif;
--font-body:    'AzoSans', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-geist-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
```

### Font Files

| Font | File | Path | Weight | Format |
|---|---|---|---|---|
| Amboqia Boriango | `Amboqia_Boriango.otf` | `/public/fonts/` | Regular | OpenType |
| AzoSans | `AzoSans-Medium.ttf` | `/public/fonts/` | 500 (Medium) | TrueType |

### Loading Strategy (performance-critical)

```css
@font-face {
  font-family: 'Amboqia Boriango';
  src: url('/fonts/Amboqia_Boriango.otf') format('opentype');
  font-display: swap;    /* show fallback immediately, swap when loaded */
}

@font-face {
  font-family: 'AzoSans';
  src: url('/fonts/AzoSans-Medium.ttf') format('truetype');
  font-weight: 500;
  font-display: swap;
}
```

- `font-display: swap` ensures text is visible immediately with fallback fonts
- Self-hosted fonts eliminate external network requests (faster than Google Fonts)
- Only two font files total — minimal payload

### Weights (approved only)

- Amboqia Boriango: Regular weight only (single file)
- AzoSans: `500` (Medium) is the only loaded weight
- **NEVER** use `font-weight: 700` or `font-weight: bold` on display headlines
- Body text uses `font-weight: 500` as the base (set in `globals.css` on `body`)

### Application Rules

```css
/* globals.css — these selectors auto-apply the display font */
h1, h2, h3, .font-display {
  font-family: var(--font-display);
}

body {
  font-family: var(--font-body);
  font-weight: 500;
  line-height: 1.6;
}
```

- All `h1`, `h2`, `h3` tags automatically get the display font via CSS selector
- For `h4`, `h5`, `h6` or non-heading display text, add `.font-display` class explicitly
- Body font is the default for everything else

### Typography Hierarchy

| Role | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Display H1 | Amboqia Boriango | text-5xl to text-7xl | regular | Hero headlines only |
| H1 | Amboqia Boriango | text-4xl to text-5xl | regular | Page titles |
| H2 | Amboqia Boriango | text-3xl to text-4xl | regular | Section headings |
| H3 | Amboqia Boriango | text-2xl to text-3xl | regular | Subsection headings |
| Eyebrow | AzoSans | text-xs | 500 | Uppercase labels above headings |
| Body Large | AzoSans | text-lg | 500 | Lead paragraphs |
| Body | AzoSans | text-base (16px) | 500 | Default body text |
| Body Small | AzoSans | text-sm | 500 | Secondary descriptions |
| Label / Button | AzoSans | text-sm | 600 | Button text, form labels |
| Caption | AzoSans | text-xs | 500 | MLS attribution, timestamps |

### Responsive Base Font Size

```css
html { font-size: 16px; }                           /* mobile default */
@media (min-width: 1024px) { html { font-size: 112.5%; } }   /* 18px desktop */
@media (min-width: 1280px) { html { font-size: 118.75%; } }   /* 19px wide */
```

This means all `rem`-based sizes (Tailwind `text-*` classes) scale up on larger screens automatically. Do not add additional font-size overrides on `html` or `body`.

---

## 3. COLOR TOKENS

### Primary Brand Colors (from globals.css)

```css
/* ── Brand Colors ── */
--color-primary:       #102742;                    /* Navy — header, dark sections */
--color-primary-light: rgba(16, 39, 66, 0.08);    /* Navy tint for subtle bgs */
--color-cream:         #F0EEEC;                    /* Primary background */
--color-cta:           #D4A853;                    /* Gold — buttons, accents */
--color-cta-hover:     #C49843;                    /* Gold hover state */
--color-success:       #22C55E;                    /* Active status, positive */
--color-warning:       #F59E0B;                    /* Price drops, caution */
--color-error:         #EF4444;                    /* Errors, validation */
```

### Text Colors

```css
--color-text-primary:   #1A1410;                   /* Main body text */
--color-text-secondary: #6B6058;                   /* Supporting text */
--color-text-muted:     #A09890;                   /* Captions, timestamps */
```

### Background Colors

```css
--color-bg:        #F0EEEC;    /* Page canvas (cream) */
--color-bg-subtle: #FAFAF9;    /* Alternating sections, cards */
--color-bg-white:  #FFFFFF;    /* Card surfaces */
```

### Border Colors

```css
--color-border-cream:      #E2DDD8;              /* Default border */
--color-border:            var(--color-border-cream);
--color-border-white:      #FFFFFF;
--color-border-navy:       #102742;
--color-border-navy-light: rgba(16, 39, 66, 0.18);
```

### Legacy Aliases (in codebase, use semantic tokens in new code)

The following aliases exist for backward compatibility. **New components should use the semantic tokens above.** Migrate legacy usage when touching existing components.

```css
--brand-navy:         #102742;        /* → use var(--color-primary) */
--brand-cream:        #F0EEEC;        /* → use var(--color-cream) */
--accent:             #D4A853;        /* → use var(--color-cta) */
--accent-hover:       #C49843;        /* → use var(--color-cta-hover) */
--brand-primary:      var(--color-primary);
--brand-primary-hover: #1a3a5c;
```

### Color Rules

- **Never use Tailwind color classes** (`bg-zinc-*`, `text-zinc-*`, `border-zinc-*`, `bg-emerald-*`, etc.) — always reference CSS variables via e.g. `bg-[var(--color-primary)]`, `text-[var(--color-text-primary)]`, or the utility classes in globals.css
- **Gold CTA on dark backgrounds**: `var(--color-cta)` with `var(--color-primary)` text
- **Gold CTA on light backgrounds**: same gold, navy text
- **Status badges**: always use `--color-success`, `--color-warning`, `--color-error` — never hardcoded Tailwind colors
- **Focus ring**: `0 0 0 3px rgba(212, 168, 83, 0.4)` (gold-based, defined as `--focus-ring`)

---

## 4. SPACING — 4PX GRID

```css
--space-1:   0.25rem;   /*  4px  — tight icon gaps */
--space-2:   0.5rem;    /*  8px  — between tightly related elements */
--space-3:   0.75rem;   /* 12px  — label-to-input, small text gaps */
--space-4:   1rem;      /* 16px  — default padding unit */
--space-6:   1.5rem;    /* 24px  — component internal padding */
--space-8:   2rem;      /* 32px  — between components */
--space-12:  3rem;      /* 48px  — subsection spacing */
--space-16:  4rem;      /* 64px  — section spacing */
--space-24:  6rem;      /* 96px  — generous section spacing */
--space-32:  8rem;      /* 128px — hero breathing room */
```

### Spacing Rules

- Minimum section spacing: `var(--space-12)` = 48px
- Standard section spacing: `var(--space-16)` to `var(--space-24)` desktop
- On mobile: Tailwind responsive classes reduce spacing proportionally
- **Never raw pixel values** — use `var(--space-4)`, `var(--space-6)`, etc., or Tailwind's default spacing scale (which aligns with 4px grid)
- **Never Tailwind arbitrary values** like `p-[24px]` — use the closest scale value

---

## 5. LAYOUT

```css
--header-height: 4rem;   /* 64px — but header uses h-14 md:h-16 (56px/64px) */
```

### Responsive Breakpoints (Tailwind defaults)

| Name | Prefix | Width | Usage |
|---|---|---|---|
| Mobile | (none) | < 640px | Base styles, 1-column layouts |
| Small | `sm:` | 640px+ | 2-column grids |
| Medium | `md:` | 768px+ | Tablet adjustments |
| Large | `lg:` | 1024px+ | Desktop nav visible, 3-column grids |
| XL | `xl:` | 1280px+ | Max content width |
| 2XL | `2xl:` | 1536px+ | Wide desktop |

### Container

- Max content width: `max-w-7xl` (1280px) — used consistently across all sections
- Page padding: `px-4 sm:px-6` on content containers
- Full-bleed elements (hero images, video, map) break the container at all widths

### Mobile-First Rules

1. **Write base styles for mobile first**, then layer on `sm:`, `md:`, `lg:` overrides
2. **All grids start as single-column** on mobile: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
3. **Touch targets minimum 44x44px** on all interactive elements (buttons, links, icons)
4. **No horizontal scroll** except intentional sliders (`TilesSlider`)
5. **Header**: 56px mobile (`h-14`), 64px desktop (`md:h-16`)
6. **Mobile menu**: Full-screen overlay, not a sidebar drawer
7. **Search bar**: Full-width on mobile, constrained on desktop
8. **Listing cards**: Full-width single column on mobile, 2-up on tablet, 3-up on desktop

---

## 6. SHADOWS & ELEVATION

```css
--shadow-subtle: 0 1px 3px rgba(16,39,66,0.08), 0 1px 2px rgba(16,39,66,0.06);
--shadow-medium: 0 4px 6px rgba(16,39,66,0.07), 0 2px 4px rgba(16,39,66,0.06);
--shadow-strong: 0 20px 25px rgba(16,39,66,0.10), 0 10px 10px rgba(16,39,66,0.04);
```

- Shadow color uses navy-tinted `rgba(16,39,66,...)` — not generic black — for brand cohesion
- **Never use Tailwind shadow classes** (`shadow-sm`, `shadow-md`, etc.) — use e.g. `shadow-[var(--shadow-subtle)]` or the `.card-base` utility
- Hover elevation: `--shadow-subtle` → `--shadow-medium` + `translateY(-4px)` at `var(--duration-normal)`

---

## 7. BORDERS & RADIUS

```css
--radius-btn:       6px;
--radius-input:     8px;
--radius-card:     12px;
--radius-container: 16px;
--radius-modal:    16px;
--radius-pill:   9999px;

/* Aliases */
--radius-sm:  6px;
--radius-md:  8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

### Application

| Element | Token | Value |
|---|---|---|
| Buttons | `--radius-btn` | 6px |
| Form inputs | `--radius-input` | 8px |
| Cards (listing, community) | `--radius-card` | 12px |
| Modals, containers | `--radius-modal` | 16px |
| Pills, tags | `--radius-pill` | 9999px |

- **Never use Tailwind `rounded-*` classes directly** — use e.g. `rounded-[var(--radius-card)]` or `rounded-[var(--radius-sm)]`
- Exception: `rounded-full` for avatars and circular elements (equivalent to `--radius-pill`)

---

## 8. Z-INDEX

```css
--z-sticky:  200;    /* header nav */
--z-overlay: 300;    /* modal backdrops */
--z-modal:   400;    /* modal content */
--z-toast:   500;    /* notifications */
```

- Header: `z-50` (Tailwind) — maps to `z-index: 50` which is above page content
- Mobile menu: `z-40`
- Dropdown menus: `z-50` relative to nav container

---

## 9. MOTION & TRANSITIONS

```css
/* Easing */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-out:      cubic-bezier(0.33, 1, 0.68, 1);

/* Duration */
--duration-micro:  150ms;    /* same as fast */
--duration-fast:   150ms;    /* hover color changes, focus rings */
--duration-normal: 250ms;    /* card hovers, modal opens */
--duration-slow:   400ms;    /* scroll reveals, page transitions */
```

### Defined Animations (globals.css)

| Animation | Class | Duration | Usage |
|---|---|---|---|
| Hero ken-burns | `.animate-hero-ken-burns` | 20s alternate | Subtle zoom on hero images |
| Hero shine | `.animate-hero-shine` | 8s once | Light sweep overlay on hero |
| Fade up | `.animate-fade-up` | 400ms | Scroll-triggered section entry |
| Modal overlay | `.animate-modal-overlay` | 200ms | Modal backdrop fade-in |
| Modal content | `.animate-modal-content` | 200ms | Modal scale-in |
| Slide in right | `.animate-slide-in-right` | 300ms | Mobile menu entrance |
| Slide up | `.animate-slide-up` | 300ms | Mobile bottom sheets |
| Heart pulse | `.animate-heart-pulse` | 300ms | Save/like confirmation |
| Counter up | `.animate-counter-up` | 400ms | Stat number entry |
| Scroll bounce | `.animate-scroll-bounce` | 2s infinite | Scroll indicator |
| Tile new pulse | `.animate-tile-new` | 2s infinite | "New" badge subtle pulse |
| Listing slide fade | `.animate-listing-slide-fade` | 200ms | Photo carousel transitions |
| Shimmer | `.skeleton` | 1.5s infinite | Loading placeholder |

### Motion Rules

1. **Every animation has a `prefers-reduced-motion` override** — already defined in globals.css:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-* { animation: none; opacity: 1; transform: none; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
2. No bounce or elastic easing on page-level elements (spring easing for buttons only)
3. Card hover: `translateY(-4px)` + shadow elevation, 250ms ease-standard
4. Button hover: `translateY(-1px) scale(1.02)`, 150ms ease-standard

---

## 10. COMPONENT PATTERNS (globals.css utilities)

### CTA Button (`.btn-cta`)

```css
.btn-cta {
  background-color: var(--color-cta);
  color: var(--color-primary);
  font-family: var(--font-body);
  font-weight: 500;
  border-radius: var(--radius-btn);
  transition: all var(--duration-micro) var(--ease-standard);
}
.btn-cta:hover {
  background-color: var(--color-cta-hover);
  transform: translateY(-1px) scale(1.02);
}
```

- **All CTA buttons must use `.btn-cta` or equivalent token-based styling**
- Never roll custom button styles with hardcoded colors
- Minimum touch target: 44px height
- Arrow icon (→) on directional CTAs, animated `translateX(3px)` on hover

### Card Base (`.card-base`)

```css
.card-base {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-subtle);
  transition: all var(--duration-normal) var(--ease-standard);
}
.card-base:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-medium);
}
```

### Header

Solid `bg-primary text-white`, sticky positioning. No glass effects, no transparency.

### Skeleton Loading (`.skeleton`)

```css
.skeleton {
  background: linear-gradient(90deg, #E2DDD8 25%, #F0EEEC 50%, #E2DDD8 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-card);
}
```

---

## 11. NAVIGATION

- Height: 56px mobile (`h-14`), 64px desktop (`md:h-16`)
- Background: `var(--brand-navy)` with transparency and blur when at top of page
- Becomes solid navy on scroll (past 80px threshold)
- `position: fixed; top: 0; z-index: 50`
- Max 7 items including CTA
- CTA button: "Log in" (gold background, navy text)
- Desktop: dropdowns for Buyers, Sellers, About (navy background, white/cream text)
- Mobile: full-screen overlay menu (navy background)
- Search: expandable search bar below nav
- All interactive elements meet 44x44px touch target minimum
- Skip-to-content link present: `.sr-only.focus:not-sr-only`

---

## 12. LISTING CARDS

- Image aspect: auto (natural photo proportions, not cropped to fixed ratio)
- Community name: eyebrow style with status badges (Hot, New, Open house, Price drop)
- Price: prominent, body font, `text-xl` to `text-2xl`
- Hover: `translateY(-4px)` + `--shadow-medium`, 250ms ease
- Specs row: beds / baths / sqft / days on market
- Action bar: Share, Like, Save icons (bottom-right of image area)
- Badge system: `CardBadges.tsx` with priority-ordered variants: `hot`, `new`, `price-drop`, `resort`, `open-house`, `days`, `media`, `trending`, `popular`, `steady`
- Images: lazy loaded except first above-fold card
- Use `ListingTile` component wrapped in `React.memo` for render performance

---

## 13. PERFORMANCE & LIGHTWEIGHT

### Image Strategy

```ts
// next.config.ts
images: {
  formats: ['image/avif', 'image/webp'],  // AVIF first (smallest), WebP fallback
}
```

- All images served through Next.js `<Image>` component for automatic optimization
- AVIF/WebP with automatic fallback — no manual format conversion needed
- Hero images: use `priority` prop (disables lazy loading for above-fold)
- All other images: lazy loaded by default
- Remote patterns whitelisted for Supabase storage and Spark API

### Font Performance

- Self-hosted fonts (zero external requests to Google Fonts)
- Only 2 font files loaded total (1 display, 1 body)
- `font-display: swap` on both — text visible immediately with system fallback
- No FOIT (Flash of Invisible Text) — only brief FOUT (Flash of Unstyled Text)

### CSS Performance

- Tailwind CSS v4 with PostCSS — tree-shaken, only used classes ship
- Design tokens in `:root` CSS variables — no runtime JS for theming
- Hidden scrollbars globally (cleaner UI, still scrollable via touch/wheel)
- `-webkit-font-smoothing: antialiased` for crisp text rendering

### JavaScript Performance

- `ListingTile` wrapped in `React.memo` to prevent unnecessary re-renders
- `loading.tsx` skeletons on heavy routes for instant shell appearance
- `<Suspense>` boundaries around non-critical components (SignInPrompt, tracking)
- Maps and charts should be loaded via `next/dynamic` (lazy)
- Header scroll listener uses `{ passive: true }` for scroll performance

### Loading States

- Every data-heavy page must have a `loading.tsx` with skeleton UI
- Use the `.skeleton` class for loading placeholders (navy-tinted shimmer)
- Skeleton shapes should match the final content layout to minimize CLS

### Bundle Rules

- No unused dependencies — audit `package.json` regularly
- Heavy client-side libraries (maps, charts) must use dynamic imports
- `force-dynamic` on layout for fresh data (no stale static builds)
- Security headers set via `next.config.ts` (X-Frame-Options, nosniff, referrer-policy)

---

## 14. MOBILE-FIRST DESIGN

### Core Principle

**Every component is designed for mobile first, then enhanced for larger screens.** Base CSS targets the smallest viewport. Breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`) add complexity upward.

### Mobile Patterns

| Pattern | Mobile | Tablet | Desktop |
|---|---|---|---|
| Grid columns | 1 column | 2 columns | 3 columns |
| Navigation | Hamburger → full overlay | Same | Horizontal bar with dropdowns |
| Hero headline | `text-3xl` to `text-4xl` | `text-4xl` to `text-5xl` | `text-5xl` to `text-6xl` |
| Section spacing | `py-8` to `py-12` | `py-12` to `py-16` | `py-16` to `py-24` |
| Side padding | `px-4` | `px-6` | `px-6` to `px-8` |
| Card tiles in sliders | 85vw width, swipeable | 300px fixed | 300px fixed |
| Search bar | Full-width below hero | Same | Constrained max-width |
| Font base size | 16px | 16px | 18px (via html font-size) |

### Touch Targets

- **Minimum 44x44px** on all interactive elements (buttons, links, icons, form inputs)
- Header action buttons: `h-11 w-11` (44px) with `min-h-[44px] min-w-[44px]`
- Mobile menu items: `px-4 py-3` for generous tap area
- Card action icons: `h-9 w-9` (36px) with adequate spacing between them

### Mobile Menu

- Full-screen overlay (`fixed inset-0`) on navy background
- Accordion-style dropdowns for Buyers/Sellers/About
- Close button in top-right with adequate touch target
- Account links and sign-out at bottom of menu
- Escape key dismisses menu (keyboard accessibility)

### Viewport Configuration

```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,     // allows zoom for accessibility, capped at 5x
  themeColor: "#102742",
};
```

- `maximumScale: 5` preserves pinch-to-zoom for accessibility (never set to 1)
- Theme color matches navy for mobile browser chrome

---

## 15. BRAND VOICE

### Non-Negotiable Rules

1. **No hyphens in copy** — rewrite the sentence
2. **No colons in copy** — rewrite the sentence
3. Copy must be place-specific — reference the actual community, view, or feature
4. Never generic — no copy that could describe any property in any market
5. **Authentic and genuine** — write like a real person talking to a neighbor, not a salesperson
6. **Transparent and direct** — state facts honestly, never inflate or embellish
7. **No pandering** — never talk down to the reader or use flattery to sell
8. **Honest about tradeoffs** — if a property has a smaller lot or is on a busier road, don't hide it
9. **Optimistic but grounded** — genuinely excited about what makes a place great, without manufacturing hype. Lead with what you love about it, honestly.

### Banned Words (auto-flag in review)

stunning, nestled, boasts, don't miss out, call today, luxury lifestyle,
dream home, pristine, meticulously maintained, one of a kind, motivated seller,
priced to sell, won't last long, must see, turnkey, charming, move-in ready,
breathtaking (overused), amazing (vague), beautiful (vague),
exclusive (pandering), unparalleled (inflated), premier (vague hype),
world-class (unverifiable), exquisite (overwrought), unmatched (inflated),
once in a lifetime (pressure tactic), incredible value (salesy)

### Voice Examples

**Good:** "The ridge lots at Pronghorn sit at 3,800 feet with unobstructed Cascade views."
**Bad:** "Stunning mountain views! This amazing property won't last long!"

**Good:** "Four Tom McCall-designed holes at Crosswater run along the Little Deschutes River."
**Bad:** "Enjoy luxury golf amenities and beautiful natural surroundings."

**Good:** "This lot backs to the road so you'll hear some traffic. The upside is direct trail access 30 feet from the front door."
**Bad:** "Conveniently located with exclusive trail access steps from your door!"

**Good:** "HOA fees run $475/month and cover snow removal, pool, and fitness center."
**Bad:** "Enjoy an incredible array of world-class amenities included with ownership!"

### CTA Copy Standards

| Approved | Never |
|---|---|
| "Get Your Crosswater Home Value" | "Submit" |
| "Schedule a Private Showing" | "Learn More" |
| "See All Caldera Springs Listings" | "Contact Us" |
| "Download the Vandevert Ranch Guide" | "Get Started" |

---

## 16. ACCESSIBILITY

| Requirement | Standard | Implementation |
|---|---|---|
| Body text contrast | 4.5:1 min | `#1A1410` on `#F0EEEC` |
| Large text contrast | 3:1 min | `#102742` on `#F0EEEC` |
| Touch target size | 44x44px min | All interactive elements |
| Focus indicator | 3px visible | Gold ring: `var(--focus-ring)` |
| Image alt text | Descriptive | Location + view specific |
| Reduced motion | Respected | `prefers-reduced-motion` on all animations |
| Form labels | Associated | `for`/`id` pairing required |
| Skip nav | Present | Hidden link at top of every page |
| Keyboard navigation | Full | Escape closes modals/menus, Tab order logical |
| ARIA attributes | Complete | `aria-expanded`, `aria-haspopup`, `aria-label` on all interactive elements |
| Viewport zoom | Allowed | `maximumScale: 5` (never restrict zoom) |
| Semantic HTML | Required | `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>` |

### Focus Styles (globals.css)

```css
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);   /* 0 0 0 3px rgba(212, 168, 83, 0.4) */
}
```

---

## 17. ENFORCEMENT — NEVER DO THESE

```
❌ Never hardcode hex colors — use var(--color-primary), var(--color-cta), etc.
❌ Never use Tailwind color utilities (bg-zinc-*, text-emerald-*, etc.)
❌ Never hardcode pixel spacing — use var(--space-4), var(--space-6), etc., or Tailwind scale
❌ Never hardcode font sizes — use Tailwind text-* classes (rem-based)
❌ Never load fonts other than Amboqia Boriango and AzoSans
❌ Never font-weight: 700 or bold on display headlines
❌ Never animate without prefers-reduced-motion block
❌ Never more than one primary CTA per section
❌ Never more than 7 navigation items
❌ Never more than 5 fields on a lead form
❌ Never hyphens or colons in copy
❌ Never banned words in any copy
❌ Never stock photography anywhere on the site
❌ Never use Tailwind shadow-* classes — use var(--shadow-subtle), var(--shadow-medium), etc.
❌ Never use Tailwind rounded-* classes directly — use var(--radius-sm), var(--radius-card), etc.
❌ Never set maximumScale to 1 (breaks accessibility)
❌ Never skip loading.tsx on data-heavy routes
❌ Never use legacy aliases in new code (--brand-navy, --accent) — use semantic tokens
```

---

## 18. AUDIT CHECKLIST

Run before every PR merge.

```bash
# Hardcoded hex colors in component files (should be zero outside globals.css)
grep -rn "#[0-9A-Fa-f]\{3,8\}" components/ app/ --include="*.tsx" --include="*.css" | grep -v globals.css | grep -v node_modules

# Tailwind color classes that bypass design tokens
grep -rn "bg-zinc\|text-zinc\|border-zinc\|bg-emerald\|text-emerald\|bg-amber\|text-amber\|bg-red-\|text-red-\|bg-blue-\|text-blue-" components/ app/ --include="*.tsx"

# Hardcoded pixel spacing in styles
grep -rn "padding: [0-9]*px\|margin: [0-9]*px" components/ app/ --include="*.css" --include="*.tsx"

# Tailwind arbitrary pixel values
grep -rn "p-\[[0-9]*px\]\|m-\[[0-9]*px\]\|gap-\[[0-9]*px\]" components/ app/ --include="*.tsx"

# Banned copy words
grep -rni "stunning\|nestled\|boasts\|don't miss\|meticulously maintained\|won't last\|must see\|priced to sell" components/ app/ --include="*.tsx"

# Missing prefers-reduced-motion (check new animation additions)
grep -rn "@keyframes" app/globals.css | wc -l
grep -rn "prefers-reduced-motion" app/globals.css | wc -l
```

---

## Changelog

| Date | Change | Author |
|---|---|---|
| March 2026 | Initial version — matched to live codebase tokens, fonts, colors, and logo | Matt Ryan / Claude |
