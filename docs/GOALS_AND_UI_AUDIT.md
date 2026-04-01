# Ryan Realty — Goals & UI Audit Checklist

**Purpose**: Runnable audit checklist for iterative site improvement. Work through every section, verify in code and by running the app/build, and fix anything that fails.

**Sources**: PRODUCT_SPEC_V2.md, master-plan.md, FEATURES.md, CODEBASE_AUDIT_REPORT.md, PERFORMANCE_AUDIT.md

**Last audited**: April 1, 2026

---

## How to Use

1. Go section by section
2. For each item: verify in code (and by running build/app when possible)
3. Mark `[x]` when verified working, or note the issue
4. Fix anything that fails before moving to the next section
5. After fixing, re-run `npm run build` and re-check affected items
6. Update "Last audited" date when complete

---

## 1. Build & Infrastructure Health

- [x] `npm run build` passes with zero errors
- [x] `npm run test` — all 251 tests pass
- [x] `npm run lint` — zero errors (67 warnings in scripts only)
- [x] `npm run lint:design-tokens` — no violations
- [x] `npm run lint:seo-routes` — no violations
- [x] TypeScript strict mode: `npx tsc --noEmit` passes clean
- [ ] No circular dependencies in imports
- [ ] All env vars set and working (run `npx tsx scripts/verify-env.ts`)

---

## 2. Navigation & Layout

- [ ] Header shows: Home, About, Team, Listings, Map links
- [ ] Header shows: Sign In when logged out, Account dropdown when logged in
- [ ] Account dropdown includes: Saved Homes, Saved Searches, Buying Preferences, Profile
- [ ] Footer shows: site owner name/email, copyright, nav links
- [ ] Footer links: About, Team, Listings, Map, Market Reports, Mortgage Calculator
- [ ] Mobile nav: hamburger menu works, all links accessible
- [ ] No broken links in nav (test every nav link)
- [ ] Active route highlighted in nav
- [ ] Breadcrumbs appear on listing, city, community, search pages
- [ ] No layout shift on page load (CLS < 0.1)

---

## 3. Homepage

- [ ] Hero section renders (video → listing photo → Unsplash fallback)
- [ ] Hero has Ken Burns effect or appropriate animation
- [ ] Search bar/overlay is prominent and functional
- [ ] Featured/trending listings section shows real data
- [ ] Community tiles with median price show
- [ ] City tiles with median price show
- [ ] "Browse by Price Range" or lifestyle sections link to filter pages
- [ ] Email signup / lead capture CTA present
- [ ] Activity feed slider (if implemented) shows recent activity
- [ ] No placeholder text visible ("Lorem ipsum", "Coming soon", etc.)
- [ ] Mobile responsive — all sections stack properly
- [ ] Personalized sections for signed-in returning users (if implemented)

---

## 4. Search & Listings

- [ ] `/listings` page loads with paginated grid
- [ ] Search by city works (`/search/bend`)
- [ ] Search by community works (`/search/bend/tetherow`)
- [ ] Price filter works (min/max)
- [ ] Beds/baths filter works
- [ ] Property type filter works
- [ ] Square footage filter works
- [ ] Lot size filter works
- [ ] Year built filter works
- [ ] Status filter works (Active, Pending, Sold)
- [ ] Sort options work (price, newest, oldest, price/sqft)
- [ ] Map view loads with clustering
- [ ] Map/list split view works
- [ ] Draw-on-map polygon search works (if implemented)
- [ ] Monthly payment filter works (if implemented)
- [ ] Open house filter works
- [ ] Keywords search works
- [ ] Save search button works (creates saved search for signed-in users)
- [ ] Results pagination works
- [ ] Search results count shows correctly
- [ ] Recent searches show on search bar focus (if implemented)
- [ ] No scrollbar on listing tile sliders (arrows only)
- [ ] Listing tiles consistent site-wide (same component everywhere)

---

## 5. Listing Detail Page

- [ ] Page loads at `/listing/[listingKey]`
- [ ] SEO slug URLs work (e.g., `/listing/20241234-123-main-st-bend`)
- [ ] Photo gallery renders with correct images
- [ ] Lightbox opens, keyboard nav works (arrows, Escape)
- [ ] Mobile gallery: full-screen, swipe, pinch-to-zoom
- [ ] Video section shows when listing has videos
- [ ] Sticky header with "Back to search", prev/next nav
- [ ] Breadcrumb renders correctly
- [ ] Title row: MLS#, address, city/state/zip, price
- [ ] Key facts: beds, baths, sqft, acres, year built, price/sqft, status badge
- [ ] Save button works (signed-in users)
- [ ] Share button works (copy link, email, text)
- [ ] Map section loads (Google Maps when configured)
- [ ] Similar listings section shows (min 4, max 8)
- [ ] Property description renders
- [ ] Property details accordions work (Interior, Exterior, Community, etc.)
- [ ] Community section with city + subdivision description
- [ ] Monthly cost section with mortgage estimate
- [ ] Agent contact: "Schedule a showing" modal works
- [ ] Agent contact: "Ask a question" modal works
- [ ] Save count shows ("X people saved this home")
- [ ] Demand indicators show (views, saves, trending badge, DOM comparison)
- [ ] Price history chart renders (when data available)
- [ ] Area market context section shows comparative metrics
- [ ] Activity feed slider shows nearby activity
- [ ] Recently sold nearby section shows
- [ ] Open house banner shows (when applicable)
- [ ] Walk Score / Transit Score / Bike Score (if implemented)
- [ ] School information section (if implemented)
- [ ] Climate/flood risk section (if implemented)
- [ ] Tax history section (if implemented)
- [ ] Investment analysis section (for applicable listings)
- [ ] Vacation rental potential card (for applicable listings)
- [ ] JSON-LD structured data present in page source
- [ ] OG image meta tag present
- [ ] Canonical URL correct
- [ ] Print-friendly view works (if implemented)
- [ ] Ad unit placements in correct positions per CR-9

---

## 6. User Account

- [ ] Google OAuth sign-in works
- [ ] Email/password sign-in works
- [ ] Account page (`/account`) loads
- [ ] Profile page loads and editable
- [ ] Saved homes page loads and shows saved listings
- [ ] Saved searches page loads and shows saved searches
- [ ] Saved cities page loads
- [ ] Saved communities page loads
- [ ] Buying preferences page loads and is editable
- [ ] Viewing history page loads and shows viewed listings
- [ ] Notification preferences work
- [ ] Data export works
- [ ] Sign out works
- [ ] Protected routes redirect to sign-in when not authenticated
- [ ] Notes on saved homes (if implemented)
- [ ] Shared collections (if implemented)

---

## 7. City & Community Pages

- [ ] City pages load (`/search/bend`, `/cities/bend`)
- [ ] Community pages load (`/search/bend/tetherow`, `/communities/tetherow`)
- [ ] City page shows: About section, listings grid, market pulse
- [ ] Community page shows: About section, listings grid, amenities
- [ ] Market stats display correctly on city pages
- [ ] Community tiles show median price and listing count
- [ ] Open house section on city pages (when applicable)
- [ ] Recently sold section on city/community pages
- [ ] Activity feed on city/community pages
- [ ] Browse-by sections link to filter page routes (not query params)
- [ ] Nearby cities/communities section
- [ ] PageCTA renders with city/community-specific text
- [ ] OG images set for city and community pages
- [ ] JSON-LD structured data present

---

## 8. Market Reports & Data

- [ ] `/housing-market` hub page loads
- [ ] City market pages load (`/housing-market/bend`)
- [ ] Regional overview loads (`/housing-market/central-oregon`)
- [ ] Market stats show real data (not zeros or placeholders)
- [ ] Live pulse banner shows with freshness badge
- [ ] Market health gauge renders (if implemented)
- [ ] Stat cards show values with YoY change arrows
- [ ] Price history charts render
- [ ] Trend line charts render
- [ ] Community leaderboard shows
- [ ] PDF/Excel export works (if implemented)
- [ ] Monthly report snapshots (if implemented)
- [ ] Narrative/AI-generated commentary displays (if implemented)
- [ ] Appreciation calculator works (`/tools/appreciation`)
- [ ] Mortgage calculator works (`/tools/mortgage-calculator`)

---

## 9. Team & Broker Pages

- [ ] Team page loads (`/team`)
- [ ] Individual broker pages load (`/team/[slug]`)
- [ ] Broker photos display
- [ ] Broker bio/description shows
- [ ] Broker contact info shows
- [ ] Broker listings show (their active listings)
- [ ] `/agents` redirects to `/team`
- [ ] `/agents/[slug]` redirects to `/team/[slug]`
- [ ] Broker self-service editing works (if implemented)
- [ ] Broker performance dashboard (if implemented)

---

## 10. Admin

- [ ] Admin accessible via `#admin` hash or direct `/admin` URL
- [ ] Only superuser can access admin
- [ ] Non-admin users redirected to `/admin/access-denied`
- [ ] Dashboard shows: sync health, DB totals, lead/visit metrics
- [ ] No placeholder panels — all show real data or "not yet available"
- [ ] Brokers management works (list, edit)
- [ ] Site pages management works
- [ ] Sync page works (run, pause, resume, status)
- [ ] Geo/neighborhood management works
- [ ] Banner management works
- [ ] Reports management works
- [ ] Spark status page shows connection info
- [ ] Admin search bar works (if implemented)
- [ ] Email campaigns compose works (no encoding bugs)
- [ ] Audit log shows entries

---

## 11. Lead Generation & CRM

- [ ] Listing inquiry forms submit to FUB
- [ ] Home valuation CTA works
- [ ] Exit intent popup shows (once per session)
- [ ] Email signup captures leads
- [ ] Contact page form works
- [ ] FUB events fire for: Registration, Viewed Property, Viewed Page, Saved Property
- [ ] Agent attribution cookies set correctly
- [ ] UTM parameters passed to FUB
- [ ] Speed-to-lead auto-response works (if implemented)
- [ ] Lead scoring computes and syncs to FUB (if implemented)
- [ ] Chat widget captures lead info (if implemented)

---

## 12. SEO & Technical SEO

- [ ] Sitemap returns 200 with valid XML at `/sitemap.xml`
- [ ] Sitemap contains all public page URLs
- [ ] Sitemap splits into index when >5000 URLs
- [ ] robots.txt returns 200 at `/robots.txt`
- [ ] robots.txt allows Googlebot
- [ ] robots.txt allows AI crawlers (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot)
- [ ] Canonical URLs consistent (sitemap = internal links = canonical tag)
- [ ] Every public page has `og:title`, `og:description`, `og:image`
- [ ] Every public page has `twitter:image`
- [ ] JSON-LD on listing pages (Product + Offer schema)
- [ ] JSON-LD on content pages (FAQPage, Article)
- [ ] JSON-LD breadcrumbs (BreadcrumbList) on all pages
- [ ] JSON-LD on team pages (LocalBusiness, RealEstateAgent)
- [ ] Author/expertise bylines on content pages (E-E-A-T)
- [ ] 301 redirects work for all route changes (`/listings/` → `/listing/`, `/agents/` → `/team/`, `/reports/` → `/housing-market/`)
- [ ] No duplicate content between routes
- [ ] Internal linking: new pages link to parents and siblings
- [ ] Filter pages included in sitemap with appropriate priority

---

## 13. Performance

- [ ] LCP < 2.5s on all page types
- [ ] CLS < 0.1 on all page types
- [ ] FID/INP < 100ms
- [ ] Lighthouse Performance > 80 on all public pages
- [ ] Above-fold sections load eagerly (max 3)
- [ ] Below-fold sections lazy-loaded via Intersection Observer
- [ ] Maps and charts dynamically imported (`next/dynamic`)
- [ ] No N+1 query patterns in server actions
- [ ] `getBrowseCities()` cached with `unstable_cache`
- [ ] Geocode results cached (not N requests per page load)
- [ ] Images use correct `sizes` and `priority` attributes
- [ ] No unnecessary waterfall fetches

---

## 14. Accessibility

- [ ] WCAG 2.0 AA compliance on all public pages
- [ ] All interactive elements have focus indicators
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only way to convey meaning
- [ ] Touch targets minimum 44x44px on mobile
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader friendly (proper heading hierarchy, ARIA labels)
- [ ] Skip-to-content link present
- [ ] Reduced motion respected (`prefers-reduced-motion`)

---

## 15. Design System Compliance

- [ ] All UI elements use shadcn/ui components (no raw HTML buttons, inputs, etc.)
- [ ] All colors use semantic tokens (no hex, no `bg-white`, no `bg-gray-*`)
- [ ] `cn()` used for all conditional class names
- [ ] Only Geist Sans and Geist Mono fonts used
- [ ] No custom CSS classes from globals.css used directly
- [ ] Sliders: arrows only, no visible scrollbars
- [ ] Mobile-first responsive (base = mobile, scale up with sm/md/lg)
- [ ] Brand voice: no hyphens/colons in user-facing copy
- [ ] No banned words: "stunning", "nestled", "boasts", "exclusive", etc.
- [ ] CTAs are specific (not generic "Learn More")

---

## 16. Integrations

- [ ] Supabase: connected, queries working
- [ ] Spark MLS: connected, sync working
- [ ] Follow Up Boss: connected, events firing
- [ ] Google Maps: loaded, geocoding working
- [ ] Google Analytics (GA4): tracking configured
- [ ] Google Tag Manager: configured (if used)
- [ ] Google AdSense: configured (if used)
- [ ] Meta Pixel: tracking configured (if used)
- [ ] Unsplash: photo API working
- [ ] xAI/Grok: AI chat and text generation working
- [ ] OpenAI: photo classification working
- [ ] Replicate: headshot generation working
- [ ] Synthesia: video generation working
- [ ] Resend: email sending working ⚠️ Currently broken (401)
- [ ] Sentry: error tracking configured
- [ ] Inngest: event bus configured

---

## 17. Content Quality

- [ ] All city pages have unique, substantive descriptions (not templates)
- [ ] All community pages have unique descriptions
- [ ] Blog/guides have real content (not placeholders)
- [ ] Market reports show real data
- [ ] No "Lorem ipsum" or placeholder text anywhere
- [ ] No mojibake or encoding issues in any text
- [ ] FAQ sections on content pages with proper schema
- [ ] Area guides have depth (not thin content)

---

## 18. Security

- [ ] Service role key never exposed to client
- [ ] No secrets in client-side code
- [ ] RLS enabled on user-facing tables
- [ ] Admin routes protected by role check
- [ ] CRON endpoints authenticated with Bearer token
- [ ] Cookie consent respected for analytics
- [ ] No `select(*)` in user-facing queries
- [ ] Rate limiting on API routes

---

## Priority Matrix

When fixing issues found during audit, prioritize in this order:

1. **P0 — Site-breaking**: Build failures, 500 errors, broken routes
2. **P1 — SEO-critical**: Sitemap, robots.txt, canonical URLs, OG images
3. **P2 — User-facing bugs**: Broken forms, missing data, UI glitches
4. **P3 — Competitive gaps**: Missing features that competitors have
5. **P4 — Polish**: Design consistency, copy improvements, performance tuning

---

## Iteration Process

After completing an audit pass:

1. Collect all failures into a prioritized fix list
2. Fix P0 items first, then P1, etc.
3. After fixes, run `npm run build` and `npm run test`
4. Re-check affected audit items
5. Update "Last audited" date
6. Repeat until all items pass or are documented as deferred

---

*This checklist is the source of truth for site quality. When an AI agent or developer asks "what needs work?", point them here.*
