# Ryan Realty — Full Requirements Checklist


**See also:** CONTENT_BRIEF_TEMPLATES.md (copy/SEO by page type).

---

## UI & Design Standard (Global)

- [ ] **Design system at project level** — Typography, spacing, color, animation, and interaction patterns are defined in a token/theme file or `app/globals.css` and inherited by every component. No one-off styling.
- [ ] **Luxury standard** — Every decision passes: *Does this make someone stop scrolling, lean in, and stay?*

---

## Performance

- [ ] **Lazy loading** — Images and below-fold content lazy load.
- [ ] **Optimized image delivery** — Next/Image used; appropriate sizes and formats.
- [ ] **Code splitting** — Routes and heavy components split; minimal main bundle.
- [ ] **Efficient data fetching** — No over-fetching; caching where appropriate.
- [ ] **Lighthouse in build** — Performance budget or Lighthouse run as part of CI/build; LCP, FID, CLS in the green.

---

## Engagement

- [ ] **Micro-animations & transitions** — Intentional hover states and smooth transitions on interactive elements.
- [ ] **Visual hierarchy** — Listings feel *presented*, not listed; grids invite browsing.
- [ ] **Maps feel alive** — Responsive, smooth interactions.
- [ ] **Dwell time** — Every page and component encourages exploration.

---

## SEO (Non-Negotiable)

- [ ] **SSR/SSG** — All listing and content pages are server-rendered or statically generated; crawlers get full HTML.
- [ ] **Dynamic metadata** — Unique title, meta description, OG tags, Twitter cards per page/listing.
- [ ] **Canonical URLs** — Every page has a canonical URL to avoid duplicate content.
- [ ] **Structured data** — Schema.org: RealEstateListing, LocalBusiness, BreadcrumbList, FAQPage where applicable.
- [ ] **XML sitemap** — Auto-updates when listings change; correct priority and changefreq.
- [ ] **robots.txt** — Correctly configured.
- [ ] **Clean URLs** — Human-readable slugs (address or property ID), no raw IDs.
- [ ] **Semantic HTML** — Correct heading hierarchy; landmarks: main, nav, article, section.
- [ ] **Image alt text** — Descriptive, keyword-aware alt on every property image.
- [ ] **Internal linking** — Listings → neighborhoods, communities, market content.
- [ ] **Keyword targeting** — Page-level targeting for Central Oregon queries (e.g. "luxury homes in Bend Oregon", "Crosswater real estate").
- [ ] **Core Web Vitals** — LCP, FID, CLS in the green.
- [ ] **Social previews** — Rich preview with image and description when shared.
- [ ] **Breadcrumbs** — On all interior pages (UX + crawlability).

---

## Listing Detail Page

- [ ] **Navigation fixed** — Clicking a listing (homepage, search, map, grid) goes to a fully rendered dedicated listing detail page. No broken navigation.
- [ ] **Full data audit** — Every available field in codebase/data is surfaced where useful (price, beds, baths, sqft, lot size, year built, HOA, schools, property type, zoning, DOM, price history, taxes, garage, HVAC, utilities, view, waterfront/golf, etc.). Empty sections collapse gracefully.
- [ ] **Collapsible sections** — Every section is collapsible; smooth animation; default order puts critical info above the fold.

---

## Map Behavior

- [ ] **Clustering only when needed** — Cluster only when zoom level makes pins genuinely unreadable/overlapping; not by default.
- [ ] **Fit bounds** — On load, viewport fits the bounds of displayed listings so the map feels purposeful.
- [ ] **Pins** — Clean, branded, distinctive; hover/select has a polished animation or callout.

---

## Map & Grid Sync

- [ ] **Single dataset** — Map and grid share the same data and filter state at all times.
- [ ] **Viewport sync** — When map viewport changes, grid shows only listings visible in current bounds.
- [ ] **Filter sync** — When filters change, map and grid update together. Never out of sync.

---

## Grid Controls & Pagination

- [ ] **Pagination** — Clear, elegant pagination; ability to jump to a page and see position in result set. Not infinite scroll only.
- [ ] **Per-page control** — Choose listings per page (e.g. 6, 12, 24, 48).
- [ ] **Column control** — Choose grid columns (e.g. 1, 2, 3, 4).
- [ ] **Premium controls** — Segmented buttons or minimal icon toolbar; consistent with design system.

---

## Follow Up Boss — Listing Tile Click

- [ ] **Every tile click tracked** — Silent event to FUB API on every listing tile click.
- [ ] **Payload** — At minimum: listing address, MLS ID, timestamp, page of origin, session/contact ID if available. No UI change, no perceived latency.

---

## Optional Deliverables

- [ ] **SEO content strategy doc** — Neighborhood/community pages content plan.
- [ ] **Developer checklist** — Short tick-list for handoff or QA.

---

*Last updated from full instruction set. Use with design system and Cursor rules.*
