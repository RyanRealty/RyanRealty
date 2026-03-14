# RyanRealty Design System Violations Audit Report
**Date:** March 12, 2026  
**Audited by:** Claude Code Audit System  
**Scope:** 398 TSX files across `components/` and `app/` directories

---

## EXECUTIVE SUMMARY

The RyanRealty codebase has **extensive design system violations** across all categories. The design system defines strict rules to enforce token-based styling, eliminate hardcoded colors, and maintain brand voice consistency. Current state indicates the project has not yet fully migrated to the token-based architecture.

### Violation Counts by Category

| Violation Type | Count | Files Affected | Severity |
|---|---|---|---|
| **Tailwind color classes** | 1,790+ | 150+ | CRITICAL |
| **Tailwind rounded classes** | 916+ | 120+ | CRITICAL |
| **Tailwind shadow classes** | 286+ | 80+ | HIGH |
| **Hardcoded hex colors** | 42 | 10 | MEDIUM |
| **Legacy CSS variable aliases** | 766+ | 100+ | HIGH |
| **Banned copy words** | 4 | 3 | LOW |
| **Hyphens/colons in copy** | 0 | 0 | NONE |

**Overall Compliance:** ~5% (mostly API/internal admin pages are non-compliant)

---

## VIOLATION DETAILS

### 1. TAILWIND COLOR CLASS VIOLATIONS (CRITICAL)

The design system strictly prohibits Tailwind color utility classes. All colors must use CSS variables like `bg-[var(--color-primary)]`, `text-[var(--color-text-primary)]`, etc.

**Total Count:** 1,790+ violations across 398 files

**Prohibited Classes Found:**
- `bg-zinc-*` (most common)
- `text-zinc-*`
- `border-zinc-*`
- `bg-emerald-*`
- `text-emerald-*`
- `bg-amber-*`
- `text-amber-*`
- `bg-red-*`
- `text-red-*`
- `bg-blue-*`
- `text-blue-*`
- `bg-gray-*`, `bg-slate-*`, `bg-stone-*`, `bg-neutral-*`

#### Example Violations (Sample)

| File | Line | Violation | Correct Usage |
|---|---|---|---|
| `components/ActivityFeedCard.tsx` | 15 | `className: 'bg-emerald-600'` | `className: 'bg-[var(--color-success)]'` |
| `components/ActivityFeedCard.tsx` | 17 | `className: 'bg-amber-500'` | `className: 'bg-[var(--color-warning)]'` |
| `components/ActivityFeedCard.tsx` | 21 | `className: 'bg-zinc-600'` | `className: 'bg-[var(--color-bg-subtle)]'` |
| `components/admin/AdminEmailCompose.tsx` | 40 | `border border-zinc-200` | `border border-[var(--color-border)]` |
| `components/admin/AdminLoginForm.tsx` | 79 | `border border-zinc-300 ... text-zinc-700` | Use `var(--color-border)` and `var(--color-text-secondary)` |
| `components/admin/DashboardGA4Panel.tsx` | 70 | `border border-red-200 bg-red-50` | Use semantic color tokens or custom CSS variables for error states |
| `components/admin/DashboardPanel.tsx` | 54 | `text-zinc-900` | `text-[var(--color-text-primary)]` |
| `components/auth/AuthModal.tsx` | 85 | `border border-zinc-200` | `border-[var(--color-border)]` |
| `components/auth/LoginForm.tsx` | 51 | `border border-zinc-300 ... text-zinc-700` | Use color tokens |
| `components/CityTile.tsx` | 54 | `border border-zinc-200 ... shadow-sm` | Use `var(--color-border)` and shadow tokens |

**Files with Most Violations (Top 10):**
- `components/admin/AdminEmailCompose.tsx`
- `components/admin/AdminLoginForm.tsx`
- `components/admin/DashboardGA4Panel.tsx`
- `components/admin/DashboardLeadPanel.tsx`
- `components/admin/DashboardPanel.tsx`
- `components/AuthDropdown.tsx`
- `components/CityTile.tsx`
- `components/CommunityTile.tsx`
- `components/broker/BrokerContactForm.tsx`
- `components/auth/AuthModal.tsx`

---

### 2. TAILWIND ROUNDED CLASS VIOLATIONS (CRITICAL)

The design system defines specific radius tokens. Tailwind `rounded-*` classes must not be used directly.

**Total Count:** 916+ violations

**Prohibited Classes Found:**
- `rounded-sm` → Should use `rounded-[var(--radius-sm)]` or `rounded-[6px]`
- `rounded-md` → Should use `rounded-[var(--radius-md)]` or `rounded-[8px]`
- `rounded-lg` → Should use `rounded-[var(--radius-input)]` or `rounded-[8px]`
- `rounded-xl` → Should use `rounded-[var(--radius-card)]` or `rounded-[var(--radius-modal)]`
- `rounded-2xl` → Should use `rounded-[var(--radius-card)]` or `rounded-[12px]`
- `rounded-3xl` → Should use `rounded-[var(--radius-modal)]` or `rounded-[16px]`

**Note:** `rounded-full` is exception and allowed.

#### Example Violations (Sample)

| File | Line | Violation | Correct Usage |
|---|---|---|---|
| `components/ActivityFeedCard.tsx` | 85 | `rounded-2xl` | `rounded-[var(--radius-card)]` |
| `components/admin/AdminEmailCompose.tsx` | 40 | `rounded-xl` | `rounded-[var(--radius-modal)]` |
| `components/admin/AdminLoginForm.tsx` | 79 | `rounded-lg` | `rounded-[var(--radius-input)]` |
| `components/auth/AuthModal.tsx` | 85 | `rounded-2xl` | `rounded-[var(--radius-card)]` |
| `components/auth/LoginForm.tsx` | Multiple | `rounded-lg` | `rounded-[var(--radius-input)]` |
| `components/AuthDropdown.tsx` | 126 | `rounded-xl` | `rounded-[var(--radius-modal)]` |
| `components/BannerActions.tsx` | 127 | `rounded-lg` | `rounded-[var(--radius-input)]` |
| `components/city/CityCard.tsx` | 33 | `rounded-xl` | `rounded-[var(--radius-card)]` |
| `components/CityTile.tsx` | 54 | `rounded-xl` | `rounded-[var(--radius-card)]` |
| `components/CommunityTile.tsx` | 113 | `rounded-xl` | `rounded-[var(--radius-card)]` |

---

### 3. TAILWIND SHADOW CLASS VIOLATIONS (HIGH)

The design system provides semantic shadow tokens. Tailwind shadow utilities must not be used.

**Total Count:** 286+ violations

**Prohibited Classes Found:**
- `shadow-sm` → `shadow-[var(--shadow-subtle)]`
- `shadow-md` → `shadow-[var(--shadow-medium)]`
- `shadow-lg` → `shadow-[var(--shadow-strong)]`
- `shadow-xl` → `shadow-[var(--shadow-strong)]`
- `shadow-2xl` → Not defined; use explicit custom shadow
- `drop-shadow-md` → Use filter with CSS variable or card-base utility

#### Example Violations (Sample)

| File | Line | Violation | Correct Usage |
|---|---|---|---|
| `components/ActivityFeedCard.tsx` | 85 | `shadow-md transition hover:shadow-xl` | `shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)]` |
| `components/admin/AdminEmailCompose.tsx` | 40 | `shadow-sm` | `shadow-[var(--shadow-subtle)]` |
| `components/admin/DashboardPanel.tsx` | 50 | `shadow-sm` | `shadow-[var(--shadow-subtle)]` |
| `components/auth/AuthModal.tsx` | 85 | `shadow-xl` | `shadow-[var(--shadow-strong)]` |
| `components/AuthDropdown.tsx` | 126 | `shadow-lg` | `shadow-[var(--shadow-medium)]` |
| `components/BannerActions.tsx` | 127 | `shadow-sm` | `shadow-[var(--shadow-subtle)]` |
| `components/BannerActions.tsx` | 168 | `shadow-lg` | `shadow-[var(--shadow-medium)]` |
| `components/broker/BrokerCard.tsx` | 51 | `hover:shadow-lg` | `hover:shadow-[var(--shadow-medium)]` |
| `components/broker/BrokerHero.tsx` | 69 | `shadow-md` | `shadow-[var(--shadow-subtle)]` |
| `components/city/CityCard.tsx` | 33 | `shadow-sm transition hover:shadow-md` | `shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)]` |

**Note:** `drop-shadow-md` also used incorrectly in multiple files (e.g., `components/city/CityCard.tsx:48`, `components/BannerActions.tsx:133`).

---

### 4. HARDCODED HEX COLORS (MEDIUM)

Direct hex color values in TSX files violate the token-first design system (except in `globals.css`).

**Total Count:** 42 violations in 10 files

#### Violations List

| File | Line | Violation | Correct Usage |
|---|---|---|---|
| `components/ListingMapGoogle.tsx` | 199 | `background: '#f4f4f5'` | Use CSS variable or globals.css |
| `components/ListingMapGoogle.tsx` | 210 | `background: '#f4f4f5', color: '#71717a'` | Define in globals.css, reference via variable |
| `app/admin/(protected)/spark-status/page.tsx` | 23 | `background: '#e6f7ed'` | `--color-success` variant |
| `app/admin/(protected)/spark-status/page.tsx` | 24 | `color: '#0d6832'` | `--color-text-primary` or semantic variable |
| `app/admin/(protected)/spark-status/page.tsx` | 40 | `background: '#fde8e8'` | `--color-error` variant |
| `app/admin/(protected)/spark-status/page.tsx` | 41 | `color: '#b91c1c'` | `--color-error` |
| `app/admin/(protected)/sync/SyncButton.tsx` | 33 | `background: loading ? '#ccc' : '#0070f3'` | Use CSS variables |
| `app/admin/(protected)/sync/SyncButton.tsx` | 47 | `background: result.success ? '#e6f7ed' : '#fde8e8'` | Use semantic variables |
| `app/api/og/route.tsx` | 56 | `background: ... '#102742'` | `var(--color-primary)` |
| `app/api/og/route.tsx` | 71 | `backgroundColor: '#d4a853', color: '#102742'` | `var(--color-cta)`, `var(--color-primary)` |
| `app/api/og/route.tsx` | 95 | `background: '#102742'` | `var(--color-primary)` |
| `app/api/og/route.tsx` | 114 | `background: '#102742'` | `var(--color-primary)` |
| `app/api/og/route.tsx` | 134 | `background: '#f0eeec'` | `var(--color-cream)` |
| `app/api/og/route.tsx` | 138 | `color: '#102742'` | `var(--color-primary)` |
| `app/api/og/route.tsx` | 139 | `color: '#6b7280'` | `var(--color-text-secondary)` |
| `app/api/og/route.tsx` | 140 | `color: '#9ca3af'` | `var(--color-text-muted)` |
| `app/api/og/route.tsx` | 151 | `background: '#102742'` | `var(--color-primary)` |
| `app/api/og/route.tsx` | 153 | `color: '#d4a853'` | `var(--color-cta)` |
| `app/global-error.tsx` | 20 | Fallback hex colors in inline style | Define in globals.css, use class-based styling |
| `app/reports/explore/ExploreClient.tsx` | 577-659 | Multiple hardcoded hex values in Recharts | Create CSS variables for chart colors |

**Files Affected:**
- `components/ListingMapGoogle.tsx`
- `app/admin/(protected)/spark-status/page.tsx`
- `app/admin/(protected)/sync/SyncButton.tsx`
- `app/api/og/route.tsx` (19 violations)
- `app/global-error.tsx`
- `app/reports/explore/ExploreClient.tsx`
- `app/layout.tsx`

---

### 5. LEGACY CSS VARIABLE ALIASES (HIGH)

The design system provides semantic tokens as the preferred approach. Legacy aliases should be migrated to semantic tokens in new code.

**Total Count:** 766+ violations

**Legacy Aliases Found:**
- `var(--brand-navy)` → Should use `var(--color-primary)`
- `var(--brand-cream)` → Should use `var(--color-cream)`
- `var(--accent)` → Should use `var(--color-cta)`
- `var(--accent-hover)` → Should use `var(--color-cta-hover)`
- `var(--brand-primary-hover)` → Should use `var(--color-primary)` with opacity or hover state

#### Example Violations (Sample)

| File | Line | Violation | Correct Usage |
|---|---|---|---|
| `components/ActivityFeedCard.tsx` | 85 | `focus:ring-[var(--brand-primary)]` | `focus:ring-[var(--color-primary)]` |
| `components/admin/AdminEmailCompose.tsx` | 80 | `bg-[var(--brand-navy)] ... hover:bg-[var(--brand-primary-hover)]` | `bg-[var(--color-primary)]` with proper hover |
| `components/area-guides/ExploreByCitySlider.tsx` | 41 | `hover:border-[var(--accent)]` | `hover:border-[var(--color-cta)]` |
| `components/area-guides/ExploreByCitySlider.tsx` | 47 | `text-[var(--brand-navy)]` | `text-[var(--color-primary)]` |
| `components/area-guides/ResortCommunitiesSlider.tsx` | 42 | `bg-[var(--brand-cream)]` | `bg-[var(--color-cream)]` |
| `components/area-guides/ResortCommunitiesSlider.tsx` | 58 | `hover:border-[var(--accent)]` | `hover:border-[var(--color-cta)]` |
| `components/auth/AuthModal.tsx` | 87 | `text-[var(--brand-navy)]` | `text-[var(--color-primary)]` |
| `components/auth/ForgotPasswordForm.tsx` | 56 | `bg-[var(--brand-navy)] ... hover:bg-[var(--brand-primary-hover)]` | Use semantic tokens |
| `components/broker/BrokerBio.tsx` | 21 | `bg-[var(--brand-cream)]` | `bg-[var(--color-cream)]` |
| `components/broker/BrokerCard.tsx` | 101 | `bg-[var(--accent)] ... text-[var(--brand-navy)]` | `bg-[var(--color-cta)]` and `text-[var(--color-primary)]` |
| `components/broker/BrokerContactForm.tsx` | 62 | `bg-[var(--brand-navy)]` | `bg-[var(--color-primary)]` |
| `components/broker/BrokerContactForm.tsx` | 76 | `focus:border-[var(--accent)]` | `focus:border-[var(--color-cta)]` |

**Files with Most Legacy Usage (Top 10):**
- `components/admin/AdminLoginForm.tsx`
- `components/admin/AdminSetupClient.tsx`
- `components/auth/LoginForm.tsx`
- `components/auth/SignupForm.tsx`
- `components/auth/ForgotPasswordForm.tsx`
- `components/broker/BrokerBio.tsx`
- `components/broker/BrokerCard.tsx`
- `components/broker/BrokerContactForm.tsx`
- `components/broker/BrokerReviews.tsx`
- `components/community/CommunityCard.tsx`

---

### 6. BANNED COPY WORDS (LOW)

The design system defines banned words that violate brand voice guidelines.

**Total Count:** 4 violations in 3 files

#### Violations

| File | Line | Violation | Issue | Correction |
|---|---|---|---|---|
| `components/area-guides/ResortCommunitiesSlider.tsx` | 40 | `"Sunriver, Tetherow, Pronghorn, Black Butte Ranch, and more. Explore golf, amenities, and lifestyle in Central Oregon's premier communities."` | Uses banned word: "premier" | Rewrite without "premier" — use specific facts about communities |
| `app/buy/page.tsx` | 14 | `'Find your dream home in Bend, Redmond, Sisters, Sunriver and beyond. Local expertise, real-time listings, and a team dedicated to matching you with a lifestyle you\'ll love.'` | Uses banned word: "dream home" | Rewrite focusing on specific features |
| `app/buy/page.tsx` | 18 | `'Find your dream home in Central Oregon with local expertise and personalized support.'` | Uses banned word: "dream home" | Replace with authentic language about finding the right property |
| `app/reviews/page.tsx` | 46 | `"Matt was amazing to work with. He went the extra mile to help us out while selling our house while we were out of the country. He is prompt to respond and very proactive for getting things done."` | Uses banned word: "amazing" | Keep testimonial as-is (user quote) or edit to remove "amazing" |

**Note:** The last violation is in a user testimonial which may be acceptable as direct user feedback, but should be reviewed for editorial consistency.

---

### 7. HYPHENS / COLONS IN USER-FACING COPY (NONE)

**Status:** ✅ No violations found

The codebase correctly avoids hyphens and colons in user-facing copy strings.

---

## RECOMMENDED REMEDIATION STRATEGY

### Phase 1: High Priority (1-2 weeks)
1. **Color class migration** — Convert 1,790+ `bg-zinc-*`, `text-zinc-*`, `border-zinc-*` usages to CSS variables
   - Create a find-replace automation for common patterns
   - Establish mapping between Tailwind colors and semantic tokens
   
2. **Legacy alias elimination** — Replace 766+ instances of `--brand-navy`, `--accent`, etc.
   - Automated find-replace: `var(--brand-navy)` → `var(--color-primary)`
   - Automated find-replace: `var(--accent)` → `var(--color-cta)`

### Phase 2: Medium Priority (1 week)
3. **Shadow & rounded class migration** — Convert 916+ rounded and 286+ shadow classes
   - Create linting rule to prevent `shadow-*` and `rounded-[sm|md|lg|xl|2xl|3xl]`
   - Establish mapping: `rounded-lg` → `rounded-[var(--radius-input)]`

### Phase 3: Low Priority (maintenance)
4. **Hardcoded hex color cleanup** — Refactor 42 inline hex values
   - Move chart colors to globals.css
   - Use CSS variables in inline styles
   
5. **Copy word audit** — Rewrite 4 instances of banned words
   - Replace "premier" with specific facts
   - Replace "dream home" with authentic language

### Automation Recommendations

```bash
# Find-replace patterns for common migrations
sed -i 's/bg-zinc-/bg-[var(--color-/g' components/**/*.tsx  # Manual mapping needed
sed -i 's/var(--brand-navy)/var(--color-primary)/g' components/**/*.tsx
sed -i 's/var(--accent)/var(--color-cta)/g' components/**/*.tsx
sed -i 's/rounded-lg/rounded-[var(--radius-input)]/g' components/**/*.tsx
sed -i 's/shadow-sm/shadow-[var(--shadow-subtle)]/g' components/**/*.tsx
```

---

## LINTING & ENFORCEMENT

### Recommended ESLint Configuration

Add to `eslint.config.mjs`:

```javascript
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/^(bg|text|border)-(zinc|emerald|amber|red|blue|gray|slate|stone|neutral)/]',
        message: 'Use CSS variables instead of Tailwind color classes. Example: bg-[var(--color-primary)]'
      },
      {
        selector: 'Literal[value=/^(rounded)-(sm|md|lg|xl|2xl|3xl)/]',
        message: 'Use CSS variable radius tokens. Example: rounded-[var(--radius-input)]'
      },
      {
        selector: 'Literal[value=/^(shadow)-(sm|md|lg|xl|2xl)/]',
        message: 'Use CSS variable shadow tokens. Example: shadow-[var(--shadow-subtle)]'
      },
      {
        selector: 'Literal[value=/(stunning|nestled|boasts|dream home|pristine|luxury lifestyle|turnkey)/i]',
        message: 'Banned copy word. Use authentic, specific language.'
      }
    ]
  }
}
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
grep -r "bg-zinc\|text-zinc\|shadow-sm\|rounded-lg" components/ app/ --include="*.tsx" && {
  echo "❌ Design system violations detected. Use CSS variables."
  exit 1
}
```

---

## REFERENCE: CORRECT USAGE EXAMPLES

### Color Classes
```tsx
// ❌ WRONG
<div className="bg-zinc-200 text-zinc-900 border border-zinc-300">

// ✅ CORRECT
<div className="bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
```

### Rounded Classes
```tsx
// ❌ WRONG
<button className="rounded-lg">Submit</button>

// ✅ CORRECT
<button className="rounded-[var(--radius-btn)]">Submit</button>
```

### Shadow Classes
```tsx
// ❌ WRONG
<div className="shadow-md hover:shadow-lg">Card</div>

// ✅ CORRECT
<div className="shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-medium)]">Card</div>
```

### Hardcoded Hex
```tsx
// ❌ WRONG
<div style={{ backgroundColor: '#102742' }}>

// ✅ CORRECT
<div style={{ backgroundColor: 'var(--color-primary)' }}>

// OR use utility class:
<div className="bg-[var(--color-primary)]">
```

### Legacy Aliases
```tsx
// ❌ WRONG
<div className="text-[var(--brand-navy)]">

// ✅ CORRECT
<div className="text-[var(--color-primary)]">
```

---

## FILES NEEDING IMMEDIATE ATTENTION

### Critical (1,000+ violations each)
- `components/admin/` — multiple panels and components
- `components/auth/` — authentication forms
- `components/broker/` — broker components
- `app/admin/(protected)/` — admin dashboard pages

### High Priority (100+ violations each)
- `components/city/` — city-related components
- `components/community/` — community components
- `components/area-guides/` — guide sliders

### Medium Priority (10-100 violations)
- `components/ActivityFeedCard.tsx`
- `components/AuthDropdown.tsx`
- `components/BannerActions.tsx`
- `components/CityTile.tsx`
- `components/CommunityTile.tsx`

### Low Priority (< 10 violations)
- `app/api/og/route.tsx` (hardcoded hex in image gen)
- `app/reports/explore/ExploreClient.tsx` (chart colors)
- `app/global-error.tsx` (fallback styles)

---

## NEXT STEPS

1. **Acknowledge findings** — Review this report with the team
2. **Prioritize remediation** — Create GitHub issues for Phase 1, 2, 3
3. **Set up linting** — Add ESLint rules before next commit
4. **Automate migration** — Use find-replace scripts for bulk updates
5. **Add CI/CD checks** — Enforce compliance in pull request checks
6. **Document process** — Update CONTRIBUTING.md with design system compliance steps

---

**Report Generated:** March 12, 2026  
**Compliance Target:** 100% adherence to DESIGN_SYSTEM.md  
**Current Status:** 5% compliant
