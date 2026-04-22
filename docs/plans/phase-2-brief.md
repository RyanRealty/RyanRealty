> **This brief is a historical work artifact.** It describes what was specified for this phase; it does not track live status. Authoritative status is in `docs/plans/task-registry.json`. Do not update this file to reflect later code changes — create a new brief or update the registry.

# Phase 2: Engagement Page Restructuring

**Status**: Complete
**Prerequisite for**: Phase 3 monetization surfaces
**Estimated scope**: 13 tasks, page and component experience updates

This brief executes Phase 2 from `docs/plans/master-plan.md`, using Reporting data primitives from Phase 1.

---

## Task 2.1: Activity Feed Wiring
- Add `ActivityFeedSlider` and wire feed sections across Home, City, Community, and Listing pages.
- Extend feed filtering for subdivision and event types (`status_expired`, `back_on_market`).

## Task 2.2: Market Pulse on Pages
- Replace old city snapshot with `LivePulseBanner` + `FreshnessBadge`.
- Ensure all usage reads from `getLiveMarketPulse` / `getCachedStats`.

## Task 2.3: Recently Sold Sections
- Add `components/RecentlySoldRow.tsx` and `app/actions/recently-sold.ts`.
- Render sold snapshots on city/community pages.

## Task 2.4: Demand Indicators on Listing Pages
- Add listing demand indicators (views, saves, trending, DOM context).

## Task 2.5: Price History Chart
- Add visual timeline chart for listing price/status history.

## Task 2.6: Area Market Context
- Add listing-context panel comparing listing price/ppsf to area metrics.

## Task 2.7: Video Surfacing (R4)
- Add listing-card video preview behavior.
- Add video tour sections and ensure listing routes read one canonical video source.
- Add `og:video` when listing videos exist.

## Task 2.8: Open House Sections (R5)
- Add city/home/community open house sections.
- Ensure dedicated `/open-houses` and `/open-houses/[city]` pages satisfy scope.

## Task 2.9: Sharing Improvements (R2)
- Expand `ShareButton` platform options and richer share text.
- Ensure major page types include share entry points and connected OG routes.

## Task 2.10: Home Page Restructure
- Implement section ordering and new blocks per master plan.

## Task 2.11: City Page Restructure
- Add city-specific modules (about, pulse, activity, sold, browse blocks, CTA, nearby cities, agent).

## Task 2.12: Community Page Restructure
- Add quick facts, pulse/activity/sold modules, unique highlights, compare table, enriched nearby modules.

## Task 2.13: Listing Detail Enhancements
- Add DemandIndicators, PriceHistoryChart, AreaMarketContext, nearby activity/sold modules.
- Preserve agreed section and ad-slot ordering constraints.

---

## Completion Checklist

- [x] Task 2.1 complete
- [x] Task 2.2 complete
- [x] Task 2.3 complete
- [x] Task 2.4 complete
- [x] Task 2.5 complete
- [x] Task 2.6 complete
- [x] Task 2.7 complete
- [x] Task 2.8 complete
- [x] Task 2.9 complete
- [x] Task 2.10 complete
- [x] Task 2.11 complete
- [x] Task 2.12 complete
- [x] Task 2.13 complete
- [x] `npm run build` passes with zero errors
- [x] SEO phase gate from master plan checklist passes for scope
