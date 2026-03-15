# THEME ENFORCEMENT & REMEDIATION — MASTER PROMPT

> **Priority: CRITICAL — This is the #1 task. Nothing else ships until this is done.**
>
> You are a senior UI/UX engineer. Your job is to make this application's theming bulletproof. Every pixel on every page must derive its visual properties from the centralized theme system. When the theme tokens change in `globals.css`, the ENTIRE application must update automatically — zero manual file-by-file edits.

---

## TABLE OF CONTENTS

1. [Understanding the Architecture](#1-understanding-the-architecture)
2. [Fix the Conflicting Cursor Rules](#2-fix-the-conflicting-cursor-rules)
3. [The Violation Audit](#3-the-violation-audit)
4. [Remediation Rules (How to Fix Each Violation Type)](#4-remediation-rules)
5. [Overlay & Hero Pattern (The One Exception)](#5-overlay--hero-pattern)
6. [New Code Enforcement Rules](#6-new-code-enforcement-rules)
7. [File-by-File Violation List](#7-file-by-file-violation-list)
8. [Verification Checklist](#8-verification-checklist)

---

## 1. UNDERSTANDING THE ARCHITECTURE

### The Single Source of Truth: `app/globals.css`

All visual tokens live in CSS custom properties in `app/globals.css`. The file defines:

- `:root { ... }` — Light mode tokens
- `.dark { ... }` — Dark mode tokens
- `@theme inline { ... }` — Maps CSS vars to Tailwind utility classes

**This means:** When you write `bg-primary`, Tailwind resolves it to `var(--primary)`, which resolves to the oklch value in `:root` or `.dark`. Theme changes happen in ONE place. That's the entire point.

### The Component Library: `components/ui/`

There are **51 shadcn/ui components** in `components/ui/`. These are the ONLY UI primitives allowed. They already use the theme tokens internally. They support variants via `class-variance-authority` (cva).

**Available Button variants:** `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
**Available Button sizes:** `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`
**Available Badge variants:** `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`
**Available Card:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` — with `size="default"` or `size="sm"`

### The Utility Function: `cn()` from `@/lib/utils`

```typescript
import { cn } from "@/lib/utils"
// Uses clsx + tailwind-merge — ALWAYS use this for conditional/merged classes
```

### Color Token Reference

| Semantic Purpose         | Tailwind Class                          | DO NOT USE                              |
|--------------------------|------------------------------------------|-----------------------------------------|
| Primary action bg        | `bg-primary`                             | `bg-[#102742]`, `bg-blue-900`          |
| Primary action text      | `text-primary-foreground`                | `text-white`                            |
| Secondary bg             | `bg-secondary`                           | `bg-gray-100`, `bg-zinc-100`           |
| Secondary text           | `text-secondary-foreground`              | `text-gray-900`                         |
| Accent bg                | `bg-accent`                              | `bg-amber-500`, `bg-yellow-500`        |
| Accent text              | `text-accent-foreground`                 | hardcoded color                         |
| Muted bg                 | `bg-muted`                               | `bg-gray-50`, `bg-zinc-50`             |
| Muted text               | `text-muted-foreground`                  | `text-gray-500`, `text-zinc-500`       |
| Destructive              | `bg-destructive text-destructive-foreground` | `bg-red-500 text-white`            |
| Success                  | `bg-success text-success-foreground`     | `bg-green-500 text-white`              |
| Warning                  | `bg-warning text-warning-foreground`     | `bg-yellow-500 text-black`             |
| Card bg                  | `bg-card`                                | `bg-white`                              |
| Card text                | `text-card-foreground`                   | `text-black`, `text-gray-900`          |
| Page bg                  | `bg-background`                          | `bg-white`, `bg-gray-50`               |
| Page text                | `text-foreground`                        | `text-black`, `text-gray-900`          |
| Borders                  | `border-border`                          | `border-gray-200`, `border-white/20`   |
| Input borders            | `border-input`                           | `border-gray-300`                       |
| Focus ring               | `ring-ring`                              | `ring-blue-500`                         |

---

## 2. FIX THE CONFLICTING CURSOR RULES

**CRITICAL:** The file `.cursor/rules/design-system.mdc` is STALE and WRONG. It references:
- Legacy hex colors (`--color-primary: #102742`, `--color-cta: #D4A853`) that are NOT in `globals.css`
- Custom CSS classes (`.btn-cta`, `.card-base`, `.skeleton`) that do NOT EXIST
- Legacy font variables (`--font-display`, `--font-body`) that are NOT defined
- Legacy spacing/radius/shadow tokens that are NOT in the current system
- Tells you to use `bg-[var(--color-primary)]` instead of `bg-primary` — THIS IS WRONG

**Action: Replace `.cursor/rules/design-system.mdc` entirely** with the content below:

```markdown
---
description: Design system rules for all UI code — colors, fonts, spacing, components
globs: ["**/*.tsx", "**/*.css", "app/**/*", "components/**/*"]
alwaysApply: true
---

# Ryan Realty Design System — ENFORCED

## Single Source of Truth

`app/globals.css` defines ALL visual tokens as CSS custom properties mapped to Tailwind via `@theme inline`.
`components/ui/` contains the ONLY allowed UI primitives (51 shadcn/ui components).
`cn()` from `@/lib/utils` is the ONLY way to merge/conditionally apply class names.

## ABSOLUTE RULES (zero exceptions)

### 1. NEVER use hardcoded colors
- NO `text-white`, `text-black`, `bg-white`, `bg-black` — use semantic tokens
- NO `bg-blue-*`, `bg-red-*`, `bg-gray-*`, `text-gray-*`, etc.
- NO hex values: `bg-[#102742]`, `text-[#fff]`, etc.
- NO `bg-black/40`, `bg-white/20` — use `bg-foreground/40`, `bg-background/20`
- NO `text-white/80`, `border-white/30` — use `text-primary-foreground/80`, `border-border`

### 2. ALWAYS use shadcn/ui components
| Need | Use | NOT |
|------|-----|-----|
| Button | `<Button>` from `@/components/ui/button` | `<button>`, `<a className="btn-...">` |
| Card | `<Card>` from `@/components/ui/card` | `<div className="rounded-... border...">` |
| Input | `<Input>` from `@/components/ui/input` | `<input>` |
| Select | `<Select>` from `@/components/ui/select` | `<select>` |
| Checkbox | `<Checkbox>` from `@/components/ui/checkbox` | `<input type="checkbox">` |
| Badge | `<Badge>` from `@/components/ui/badge` | `<span className="rounded-full...">` |
| Dialog | `<Dialog>` from `@/components/ui/dialog` | custom modal divs |
| Separator | `<Separator>` from `@/components/ui/separator` | `<hr>`, `<div className="border-t">` |
| Label | `<Label>` from `@/components/ui/label` | `<label>` |
| Tooltip | `<Tooltip>` from `@/components/ui/tooltip` | `title` attribute |
| Avatar | `<Avatar>` from `@/components/ui/avatar` | `<img className="rounded-full">` |
| Table | `<Table>` from `@/components/ui/table` | `<table>` |
| Sheet | `<Sheet>` from `@/components/ui/sheet` | custom slide-out panels |

### 3. DO NOT override shadcn component styles with className
Use the component's built-in `variant` and `size` props instead:
```tsx
// CORRECT
<Button variant="outline" size="lg">Cancel</Button>
<Badge variant="secondary">New</Badge>

// WRONG — defeats the whole system
<Button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</Button>
```

The ONLY acceptable className additions on shadcn components are:
- Layout/positioning: `className="w-full"`, `className="mt-4"`, `className="flex-1"`
- Responsive: `className="hidden md:flex"`
- The `cn()` wrapper for conditional layout classes

NEVER add color, border, radius, font-size, or padding overrides to shadcn components via className.

### 4. Use `<Separator>` for visual dividers
```tsx
// CORRECT
<Separator />
<Separator orientation="vertical" />

// WRONG
<div className="border-t border-border" />
<hr />
```

### 5. Use `cn()` for all conditional classes
```tsx
// CORRECT
cn("base-class", isActive && "active-class")

// WRONG
`base-class ${isActive ? "active-class" : ""}`
"base-class " + (isActive ? "active-class" : "")
```

### 6. Semantic tokens for ALL color contexts
On dark backgrounds (heroes, CTAs, overlays): `text-primary-foreground`, NOT `text-white`
On light backgrounds: `text-foreground`, NOT `text-black`
Muted/secondary text: `text-muted-foreground`, NOT `text-gray-500`
Borders: `border-border`, NOT `border-gray-200`

## Font System
- Sans: Geist Sans via `font-sans` (default, applied at html level)
- Mono: Geist Mono via `font-mono`
- NO other fonts. Do not import or reference any other font family.

## Mobile-First
- Base styles = mobile. Scale up with `sm:`, `md:`, `lg:`.
- Touch targets: minimum 44x44px on interactive elements.

## Animations
All defined in `globals.css`. Use the `.animate-*` utility classes.
All respect `prefers-reduced-motion`. Never define new keyframes outside `globals.css`.

## Brand Voice (copy in components)
- No hyphens or colons in user-facing copy
- Never: "stunning", "nestled", "boasts", "don't miss", "won't last", "must see", "exclusive", "unparalleled", "world-class", "exquisite", "once in a lifetime"
- CTAs must be specific: "See All Caldera Springs Listings" not "Learn More"
```

---

## 3. THE VIOLATION AUDIT

After a full codebase audit, here are the violations found:

### Violation Category Totals

| Category | Count | Severity |
|----------|-------|----------|
| `text-white` / `text-white/XX` hardcoded | ~203 | HIGH |
| `bg-black/XX` overlays | ~32 | HIGH |
| `border-white/XX` hardcoded | ~22 | HIGH |
| `border-t` / `border-b` divs (should be `<Separator>`) | ~32 | MEDIUM |
| shadcn component className overrides (re-specifying color/padding/radius) | ~305 | HIGH |
| Total | **~594** | |

---

## 4. REMEDIATION RULES

### Rule A: Replace `text-white` → `text-primary-foreground`

**Context matters.** `text-white` appears in two contexts:

1. **On `bg-primary` surfaces** (buttons, navs, CTAs with primary bg):
   → Replace with `text-primary-foreground`

2. **On overlays/hero images** (where bg is a photo with dark overlay):
   → Replace with `text-primary-foreground` (it's white in both light and dark themes for this app — the token is the correct abstraction)

3. **On `bg-destructive` / `bg-success` / `bg-warning`**:
   → Replace with `text-destructive-foreground` / `text-success-foreground` / `text-warning-foreground`

**Search pattern:** `text-white` in all `.tsx` files under `app/` and `components/` (EXCLUDING `components/ui/`)
**Replace with:** The appropriate `text-*-foreground` token based on the parent background context.

### Rule B: Replace `bg-black/XX` → `bg-foreground/XX`

The `--foreground` token is near-black in light mode and near-white in dark mode. For overlay purposes on hero images, this is the correct semantic token.

```tsx
// BEFORE
<div className="absolute inset-0 bg-black/40" />

// AFTER
<div className="absolute inset-0 bg-foreground/40" />
```

**Exceptions for `components/ui/` files:** The shadcn overlay components (dialog.tsx, sheet.tsx, drawer.tsx, alert-dialog.tsx) use `bg-black/10` for their backdrop. Leave those as-is — they are upstream shadcn defaults and will be handled if/when shadcn updates.

### Rule C: Replace `border-white/XX` → `border-primary-foreground/XX` or `border-border`

```tsx
// BEFORE
<div className="border border-white/20" />

// AFTER — on dark bg contexts (hero, overlay, primary bg)
<div className="border border-primary-foreground/20" />

// AFTER — on normal card/page contexts
<div className="border border-border" />
```

### Rule D: Replace `<div className="border-t ..." />` → `<Separator />`

```tsx
// BEFORE
<div className="border-t border-border" />
<div className="w-full border-t border-border" />

// AFTER
<Separator />

// For vertical:
// BEFORE
<div className="border-l h-full" />
// AFTER
<Separator orientation="vertical" />
```

Import: `import { Separator } from "@/components/ui/separator"`

**Note:** Not ALL `border-t`/`border-b` usage should become `<Separator>`. If the border is part of a component's structural styling (like a card footer with `border-t` as part of its layout), leave it. Only replace standalone divider elements — elements whose SOLE purpose is to be a visual line.

### Rule E: Remove className overrides on shadcn components

This is the biggest category (~305 instances). The pattern looks like this:

```tsx
// VIOLATION — re-specifying styles that the component already handles
<Input
  className="mt-1 w-full rounded-lg border border-primary/20 px-3 py-2 text-foreground placeholder:text-muted-foreground"
/>

// CORRECT — only layout classes, let the component handle its own visuals
<Input className="mt-1 w-full" />
```

```tsx
// VIOLATION
<Button
  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
>Save</Button>

// CORRECT — use variant prop, only add layout if needed
<Button>Save</Button>
// or
<Button variant="outline" size="lg" className="w-full">Cancel</Button>
```

**What to strip from className on shadcn components:**
- `rounded-*` (handled by component)
- `border`, `border-*` (handled by component)
- `bg-*` (handled by variant)
- `text-*` color classes (handled by variant)
- `px-*`, `py-*`, `p-*` internal padding (handled by size variant)
- `text-sm`, `text-base`, `font-medium` (handled by component)
- `hover:*` color/bg states (handled by variant)
- `focus:*`, `focus-visible:*` (handled by component)
- `disabled:*` (handled by component)
- `placeholder:*` (handled by component)
- `shadow-*` (handled by component)

**What is ALLOWED on className:**
- `w-full`, `w-auto`, `flex-1`, `min-w-0` (sizing)
- `mt-*`, `mb-*`, `ml-*`, `mr-*`, `mx-*`, `my-*` (external margin)
- `hidden`, `md:flex`, `lg:hidden` (responsive visibility)
- `col-span-*`, `row-span-*` (grid placement)
- `absolute`, `relative`, `sticky` (positioning)
- `self-start`, `self-end`, `justify-self-*` (flex/grid alignment)

### Rule F: Replace `bg-white` → `bg-background` or `bg-card`

```tsx
// BEFORE
<div className="bg-white p-4 rounded-lg">

// AFTER
<div className="bg-background p-4 rounded-lg">
// or use <Card> if it's a card-like container
```

---

## 5. OVERLAY & HERO PATTERN

Many pages have hero sections with background images and text overlays. Here's the correct pattern:

```tsx
// CORRECT hero overlay pattern
<section className="relative">
  <Image src={heroImage} alt="" fill className="object-cover" />
  <div className="absolute inset-0 bg-foreground/50" /> {/* overlay */}
  <div className="relative z-10">
    <h1 className="text-primary-foreground text-4xl font-bold">Title</h1>
    <p className="text-primary-foreground/80">Subtitle text</p>
  </div>
</section>
```

Key points:
- Overlay: `bg-foreground/XX` (NOT `bg-black/XX`)
- Text on overlay: `text-primary-foreground` (NOT `text-white`)
- Muted text on overlay: `text-primary-foreground/80` (NOT `text-white/80`)
- Borders on overlay: `border-primary-foreground/20` (NOT `border-white/20`)

---

## 6. NEW CODE ENFORCEMENT RULES

### For EVERY new component or modification going forward:

1. **Before writing any JSX**, check if a shadcn/ui component exists for what you need. If it does, USE IT. Do not build custom UI primitives.

2. **Before writing any className**, verify every color/border/bg class uses a semantic token from the table in Section 1. If you catch yourself typing `white`, `black`, `gray`, `blue`, `red`, `green`, or ANY Tailwind color scale — STOP. Use the semantic token instead.

3. **Before adding className to a shadcn component**, ask: "Is this layout/positioning, or am I overriding the component's visual style?" If the latter, use a `variant` prop or modify the component in `components/ui/` to add a new variant.

4. **Before creating a visual divider**, use `<Separator />`.

5. **Always use `cn()`** for merged/conditional classes. Never string concatenation.

6. **Run this mental test on every PR:** "If I changed `--primary` in globals.css from navy to red, would this component update automatically?" If the answer is no, you have a hardcoded color that needs to be a token.

### If a new variant is needed:

Sometimes a shadcn component doesn't have the variant you need. The correct approach:

1. Open the component in `components/ui/` (e.g., `button.tsx`)
2. Add a new variant to the `cva()` call using ONLY semantic tokens
3. Use the new variant via props: `<Button variant="myNewVariant">`

**NEVER** work around missing variants by dumping styles into className.

---

## 7. FILE-BY-FILE VIOLATION LIST

### Components Directory

**components/ActivityFeedCard.tsx**
- `text-white` (lines ~104, 124, 125) → `text-primary-foreground`

**components/AdvancedSearchFilters.tsx**
- `border-t border-border` div (line ~277) → `<Separator />`
- className overrides on `<Input>`, `<Button>`

**components/AuthDropdown.tsx**
- `border-t`, `border-b` divs (lines ~129, 172, 214) → `<Separator />`
- className overrides on `<Button>`

**components/BannerActions.tsx**
- className overrides on `<Button>`

**components/Breadcrumb.tsx**
- `text-white`, `text-white/80`, `text-white/50` (lines ~16-21) → `text-primary-foreground`, `text-primary-foreground/80`, `text-primary-foreground/50`

**components/broker/BrokerContactForm.tsx**
- `text-white`, `border-white/20` throughout (lines ~69-141) → `text-primary-foreground`, `border-primary-foreground/20`
- className overrides on `<Input>`, `<Label>`, `<Button>`

**components/broker/BrokerCard.tsx**
- className overrides on `<Button>`

**components/broker/BrokerReviews.tsx**
- className overrides on `<Button>`

**components/city/CityHero.tsx**
- `text-white`, `bg-black/40` (lines ~55, 59) → `text-primary-foreground`, `bg-foreground/40`

**components/city/CityListings.tsx**
- className overrides on `<Input>`, `<Button>`

**components/community/CommunityHero.tsx**
- `text-white`, `bg-black/30` (lines ~66, 72) → `text-primary-foreground`, `bg-foreground/30`

**components/community/CommunitiesFilter.tsx**
- className overrides on `<Input>`

**components/community/CommunityListings.tsx**
- className overrides on `<Input>`, `<Button>`

**components/compare/CompareClient.tsx**
- `bg-black/50` (line ~174) → `bg-foreground/50`

**components/comparison/ComparisonTray.tsx**
- `text-white`, `border-white/20`, `border-white/30` (lines ~19-75) → semantic tokens

**components/CookieConsentBanner.tsx**
- className overrides on `<Button>`

**components/dashboard/DashboardShell.tsx**
- `bg-black/30` (line ~80) → `bg-foreground/30`

**components/dashboard/DashboardNotificationPrefs.tsx**
- className overrides on `<Button>`

**components/dashboard/DashboardSettingsForm.tsx**
- className overrides on `<Input>`, `<Button>`, `<Label>`

**components/dashboard/DashboardSavedActions.tsx**
- className overrides on `<Button>`

**components/dashboard/DashboardSearchesList.tsx**
- className overrides on `<Button>`

**components/geo-page/PageActionBar.tsx**
- `text-white`, `bg-black/40`, `border-white/80` (lines ~53-95) → semantic tokens

**components/geo-page/BrokerCardCompact.tsx**
- className overrides on `<Button>`

**components/geo-page/CommunityBarCard.tsx**
- className overrides on `<Button>`

**components/geo-page/ListingBarCard.tsx**
- className overrides on `<Button>`

**components/HeroSearchOverlay.tsx**
- `border-white/30` (line ~139) → `border-primary-foreground/30`
- className overrides

**components/home/MarketCTA.tsx**
- `text-white`, `bg-white/10`, `border-white/60` throughout (lines ~26-62) → semantic tokens

**components/home/HomeHero.tsx**
- `text-white` (line ~151) → `text-primary-foreground`

**components/home/CitySlider.tsx**
- `text-white` (lines ~88-120) → `text-primary-foreground`

**components/home/PriceDrops.tsx**
- `bg-black/70` (line ~93) → `bg-foreground/70`

**components/home/RecentlySold.tsx**
- `bg-black/70` (line ~84) → `bg-foreground/70`

**components/home/AffordabilityRow.tsx**
- className overrides on `<Button>`

**components/home/EmailSignup.tsx**
- className overrides on `<Input>`, `<Button>`

**components/layout/Header.tsx**
- `text-white`, `border-white/20`, `border-white/30` throughout (~20+ instances) → semantic tokens
- className overrides on `<Button>`

**components/layout/Footer.tsx**
- `text-white`, `text-white/80`, `text-white/70`, `border-white/20` throughout (~20+ instances) → semantic tokens

**components/layout/ContentPageHero.tsx**
- `border-white/40` (line ~77) → `border-primary-foreground/40`

**components/listing/ListingHero.tsx**
- `text-white`, `bg-black/40`, `bg-black/60`, `border-white` (lines ~160-327) → semantic tokens

**components/listing/ListingDetailHero.tsx**
- `text-white` throughout (lines ~154-209) → `text-primary-foreground`

**components/listing/ListingGallery.tsx**
- `bg-black/90` (line ~82) → `bg-foreground/90`

**components/listing/AgentCard.tsx**
- className overrides on `<Button>`

**components/listing/ListingActions.tsx**
- className overrides on `<Button>`

**components/listing/ListingCtaSidebar.tsx**
- className overrides on `<Input>`, `<Button>`

**components/listing/ListingEstimatedMonthlyCost.tsx**
- className overrides on `<Input>`

**components/listing/PaymentCalculator.tsx**
- className overrides on `<Input>`, `<Button>`

**components/ListingTile.tsx**
- `border-white/30` (line ~274) → `border-primary-foreground/30`

**components/neighborhood/NeighborhoodCTA.tsx**
- `text-white` (lines ~25, 47) → `text-primary-foreground`

**components/neighborhood/NeighborhoodHero.tsx**
- `text-white` (lines ~57, 61) → `text-primary-foreground`

**components/neighborhood/NeighborhoodListings.tsx**
- className overrides on `<Input>`, `<Button>`

**components/SaveSearchButton.tsx**
- className overrides on `<Button>`

**components/search/SearchFilters.tsx**
- className overrides on `<Input>`, `<Button>`

**components/SearchFilterBar.tsx**
- className overrides

**components/SearchListingsToolbar.tsx**
- className overrides

**components/SignInPrompt.tsx**
- className overrides on `<Button>`

**components/SiteHeader.tsx**
- className overrides

**components/SmartSearch.tsx**
- className overrides on `<Input>`

**components/ui/CardActionBar.tsx**
- `border-white/30` (line ~67) → `border-primary-foreground/30`

**components/videos/VideosClient.tsx**
- `bg-black/40`, `bg-black/60`, `bg-black/70`, `bg-black/90` (lines ~87-177) → `bg-foreground/XX`

**components/admin/AdminLoginForm.tsx**
- `text-white`, `border-t` div (lines ~108-174) → semantic tokens, `<Separator />`
- className overrides on `<Input>`, `<Button>`

**components/admin/AdminEmailCompose.tsx**
- `text-white` (line ~84) → `text-primary-foreground`
- className overrides

**components/admin/DashboardPanel.tsx**
- `border-t` div (line ~63) → `<Separator />`

**components/auth/LoginForm.tsx**
- `text-white`, `border-t` div (lines ~60-102) → semantic tokens, `<Separator />`
- className overrides on `<Input>`, `<Button>`

**components/auth/SignupForm.tsx**
- `text-white` (line ~118) → `text-primary-foreground`
- className overrides on `<Input>`, `<Button>`

**components/auth/AuthModal.tsx**
- `border-b` (lines ~94, 130) → `<Separator />`
- className overrides

**components/auth/ForgotPasswordForm.tsx**
- className overrides on `<Input>`, `<Button>`

**components/ListingFilters.tsx**
- className overrides on `<Input>`, `<Button>`

### App Directory

**app/about/page.tsx**
- className overrides on `<Button>`

**app/account/page.tsx**
- className overrides on `<Button>`

**app/account/profile/ProfileForm.tsx**
- className overrides on `<Input>`, `<Button>`, `<Label>`

**app/account/buying-preferences/BuyingPreferencesForm.tsx**
- className overrides on `<Input>`, `<Button>`, `<Label>`

**app/account/saved-homes/page.tsx**
- className overrides on `<Button>`

**app/account/saved-cities/page.tsx**
- className overrides on `<Button>`

**app/account/saved-communities/page.tsx**
- className overrides on `<Button>`

**app/account/saved-searches/SavedSearchesList.tsx**
- className overrides on `<Button>`

**app/account/layout.tsx**
- `border-b border-border` (line ~15) → `<Separator />`

**app/account/error.tsx**
- className overrides on `<Button>`

**app/admin/(protected)/page.tsx**
- className overrides on `<Button>`

**app/admin/(protected)/access-denied/page.tsx**
- `text-white` (line ~12) → `text-primary-foreground`

**app/admin/(protected)/geo/AssignCommunity.tsx**
- className overrides

**app/admin/(protected)/geo/NeighborhoodForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/admin/(protected)/geo/area-guide-upload/AreaGuideUploadClient.tsx**
- `bg-black/50` (line ~169) → `bg-foreground/50`

**app/admin/(protected)/query-builder/AdminQueryBuilderForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/admin/(protected)/reports/CityReportSection.tsx**
- className overrides

**app/admin/(protected)/reports/custom/CustomReportBuilder.tsx**
- className overrides on `<Input>`, `<Button>`

**app/admin/(protected)/resort-communities/ResortCommunityToggle.tsx**
- className overrides

**app/admin/(protected)/site-pages/HeroMediaForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/admin/(protected)/site-pages/SiteLogoForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/admin/(protected)/site-pages/SitePageEditor.tsx**
- className overrides

**app/admin/(protected)/sync/FullSync.tsx**
- `text-white` (line ~195) → `text-primary-foreground`
- className overrides on `<Button>`

**app/admin/(protected)/sync/SyncAllButtons.tsx**
- `text-white` (lines ~253, 272) → `text-primary-foreground`

**app/admin/(protected)/sync/SyncSinceDateButton.tsx**
- className overrides on `<Input>`, `<Button>`

**app/admin/(protected)/sync/SyncStatus.tsx**
- className overrides

**app/agents/error.tsx**
- className overrides on `<Button>`

**app/agents/[slug]/error.tsx**
- className overrides on `<Button>`

**app/area-guides/page.tsx**
- className overrides

**app/blog/page.tsx**
- className overrides

**app/buy/page.tsx**
- className overrides

**app/cities/error.tsx, app/cities/[slug]/error.tsx, app/cities/[slug]/[neighborhoodSlug]/error.tsx**
- className overrides on `<Button>`

**app/communities/[slug]/error.tsx**
- className overrides on `<Button>`

**app/components/admin/AdminBrokerForm.tsx**
- `bg-black/70` (line ~1235) → `bg-foreground/70`
- className overrides on `<Input>`, `<Button>`, `<Label>`

**app/components/admin/AdminBrokerCreateForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/components/admin/AdminUsersList.tsx**
- className overrides

**app/contact/ContactForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/dashboard/searches/page.tsx**
- className overrides

**app/home-valuation/ValuationForm.tsx**
- className overrides on `<Input>`, `<Button>`

**app/join/page.tsx**
- className overrides

**app/our-homes/page.tsx**
- `text-white` (line ~52) → `text-primary-foreground`

**app/reports/ReportsIndexContent.tsx**
- className overrides

**app/reports/[slug]/[geoName]/page.tsx**
- className overrides

**app/reports/explore/ExploreClient.tsx**
- className overrides

**app/reviews/page.tsx**
- className overrides

**app/search/[...slug]/page.tsx**
- className overrides

**app/sell/plan/page.tsx**
- `text-white` (line ~63) → `text-primary-foreground`

**app/tools/mortgage-calculator/MortgageCalculator.tsx**
- className overrides on `<Input>`, `<Button>`

---

## 8. VERIFICATION CHECKLIST

After completing all remediations, run these checks:

### Automated Checks

```bash
# 1. Zero hardcoded text-white outside components/ui/
grep -rn "text-white" --include="*.tsx" app/ components/ --exclude-dir="components/ui" | wc -l
# Expected: 0

# 2. Zero hardcoded bg-black outside components/ui/
grep -rn "bg-black" --include="*.tsx" app/ components/ --exclude-dir="components/ui" | wc -l
# Expected: 0

# 3. Zero hardcoded border-white
grep -rn "border-white" --include="*.tsx" app/ components/ --exclude-dir="components/ui" | wc -l
# Expected: 0

# 4. Zero bg-white (should be bg-background or bg-card)
grep -rn "bg-white" --include="*.tsx" app/ components/ --exclude-dir="components/ui" | wc -l
# Expected: 0

# 5. Zero hardcoded Tailwind color scales
grep -rn "bg-blue-\|bg-red-\|bg-green-\|bg-yellow-\|bg-gray-\|bg-slate-\|bg-zinc-\|bg-stone-\|text-blue-\|text-red-\|text-green-\|text-gray-\|text-slate-\|text-zinc-" --include="*.tsx" app/ components/ --exclude-dir="components/ui" | wc -l
# Expected: 0

# 6. Zero hex colors in className
grep -rn 'className.*#[0-9a-fA-F]' --include="*.tsx" app/ components/ | wc -l
# Expected: 0
```

### Visual Regression Test

1. Run the dev server: `npm run dev`
2. Open every major page and verify:
   - Homepage (hero, CTA sections, footer)
   - Listing detail page
   - Search/browse page
   - City page
   - Community page
   - About page
   - Contact page
   - Admin panel
   - Auth modal (login/signup)
   - Account settings
3. For each page, verify:
   - All text is legible against its background
   - All buttons use consistent styling via variant props
   - All inputs look consistent (not some with custom borders, some without)
   - All separators are `<Separator>` components
   - No jarring color differences between sections

### Theme Switch Test

1. In `globals.css`, temporarily change `--primary` to a bright red: `oklch(0.6 0.25 25)`
2. Reload the app
3. EVERY primary-colored element across ALL pages should now be red
4. If ANY element stays navy/blue, that element has a hardcoded color — find it and fix it
5. Revert the change

---

## EXECUTION ORDER

1. **First:** Replace `.cursor/rules/design-system.mdc` with the corrected version from Section 2
2. **Second:** Fix all `text-white` → `text-primary-foreground` violations (biggest category, ~203 files)
3. **Third:** Fix all `bg-black/XX` → `bg-foreground/XX` violations (~32 files)
4. **Fourth:** Fix all `border-white/XX` violations (~22 files)
5. **Fifth:** Replace standalone `border-t`/`border-b` dividers with `<Separator />` (~32 files)
6. **Sixth:** Strip className overrides from shadcn components (~305 instances across ~86 files)
7. **Seventh:** Run all verification checks from Section 8
8. **Eighth:** Fix any regressions found during visual testing

**Do NOT batch files by page. Work by violation type across the entire codebase.** This ensures consistency — every `text-white` gets fixed the same way, everywhere, in one pass.
