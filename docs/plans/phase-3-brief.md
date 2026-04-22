> **This brief is a historical work artifact.** It describes what was specified for this phase; it does not track live status. Authoritative status is in `docs/plans/task-registry.json`. Do not update this file to reflect later code changes — create a new brief or update the registry.

# Phase 3: Monetization Layer

**Status**: Complete
**Prerequisite for**: Phase 4 advanced features
**Estimated scope**: 9 tasks, ad and lead monetization systems

This brief executes Phase 3 from `docs/plans/master-plan.md`.

---

## Task 3.1: AdUnit and InFeedAdCard
- Add `components/AdUnit.tsx` and `components/search/InFeedAdCard.tsx`.
- Render safely when AdSense config is missing and respect consent gating.

## Task 3.2: Ad placement on existing pages
- Place ad surfaces in agreed positions on listing, search, and home templates.
- Preserve section-order constraints from master plan.

## Task 3.3: Programmatic filter pages
- Extend filter routing and metadata for `/search/{city}/{filter}` pages.
- Ensure filter pages are indexable only when valid listing-backed combinations exist.

## Task 3.4: Lead capture with FUB attribution
- Implement agent attribution cookie and pass through lead events.
- Add valuation and exit-intent style lead capture surfaces with FUB mapping.

## Task 3.5: Blog and guides infrastructure
- Add guides data model and pages (`/guides`, `/guides/[slug]`, admin CRUD).

## Task 3.6: Guide content generation
- Populate guides with unique, data-grounded content and FAQ schema.

## Task 3.7: Sitemap expansion
- Add filter pages, ZIP pages, and guides to sitemap with priority controls.

## Task 3.8: Internal linking section
- Add browse-by internal links on city search pages to monetization routes.

## Task 3.9: FUB event coverage
- Ensure all new lead surfaces emit correctly typed FUB events with attribution.

---

## Completion checklist

- [x] Task 3.1 complete
- [x] Task 3.2 complete
- [x] Task 3.3 complete
- [x] Task 3.4 complete
- [x] Task 3.5 complete
- [x] Task 3.6 complete
- [x] Task 3.7 complete
- [x] Task 3.8 complete
- [x] Task 3.9 complete
- [x] `npm run build` passes with zero errors
- [x] SEO phase gate from master plan checklist passes for scope
