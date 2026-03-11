# Ryan Realty — Goals & UI Audit Checklist

**Purpose:** Single source of truth for product goals and a runnable audit so the agent can verify and fix the site without the user being the bottleneck. Use this doc when auditing, fixing, or improving the site.

**How to improve:** Research best practices (admin UIs, real estate listings, nav patterns) from the web or docs; use the goals below and the data the site has to drive changes. Do not depend on a one-off "compare to top real estate sites"—iterate using research and this checklist.

**Foundations:** MASTER_INSTRUCTION_SET.md (vision, standards), REQUIREMENTS_CHECKLIST.md (implementation), design-system rule (tokens, luxury bar).

---

## Product goals (from user + master doc)

1. **Navigation** — Clean, professional. Search is collapsible (toggle). Google/profile avatar shows when logged in. No sloppy layout.
2. **Home page** — Banner vs map toggle or collapsible map; map can be hidden so hero is focus. Feels intentional, not cluttered.
3. **Tiles** — Listing, city, neighborhood, community tiles: **same width/height in sliders**; **every tile has Share**; **Save/like where applicable** (listings, communities). Same options (like/share) so UX is consistent.
4. **Saved items in profile** — User sees **saved homes** and **saved communities** in account; can **remove** from the list (and from listing/community). No dead ends.
5. **Listing pages** — No missing data; all useful fields surfaced; sections collapse gracefully; price/address/CTA clear; video plays when data exists.
6. **Video** — Listing video (MLS URL or ObjectHtml) and YouTube/Vimeo embeds work; hero and “Videos & virtual tours” show/play video.
7. **Resort communities** — Admin can flag subdivisions as resort; flagged ones get full amenities/lifestyle page and schema. Seed-from-default available.
8. **Team / broker / brokerage** — Robust landing pages: images, CTAs, trust (reviews where applicable). Not plain placeholders. Every addition is **add/edit/delete in admin**.
9. **Admin** — Anything added to the site is manageable (add, edit, delete) in admin. No orphan content.
10. **Design system** — Tokens from globals.css; luxury standard; consistent spacing and hierarchy; mobile-first.

---

## Audit checklist (run and fix)

Use this to verify and fix. Do not stop at “found an issue”—fix it, then continue.

### Nav & header
- [x] Search is collapsible (icon toggles search bar); closes on Escape or result select.
- [x] Nav links: Home, About, Team, Listings, Map; active state clear; spacing consistent.
- [x] Logged-in: avatar shows (Google `picture` or `avatar_url`); dropdown has Dashboard, Profile, Saved searches, Saved homes, Saved communities, Buying preferences, Sign out.
- [x] Mobile: menu opens; same links + Account block; search in panel.
- [x] Header uses design tokens; no one-off colors.

### Home page
- [x] Follow **docs/HOME_PAGE_BEST_PRACTICES.md**: hero first, no Banner/Map toggle above hero.
- [x] Hero: one headline, one subline, search as primary CTA, trust line (listings count + links); banner or gradient; attribution if present.
- [x] Map: collapsible “Explore on map” section below hero only (no competing view toggle).
- [x] Sliders: Homes for You, Trending, Recently Viewed / Homes you might like; scroll arrows; tiles same width (300px) and min-height.
- [x] Popular Communities: tiles 300px, Share + Save (when signed in); saved state correct.
- [x] Browse by city: CityTiles have Share; min-height for alignment; section spacing consistent (py-12 sm:py-16, max-w-7xl).
- [ ] No layout shift; images use Next/Image and sizes.

### Tiles (all types)
- [x] **Listing tile:** 300px in slider; Share + Save (when signed in); aspect 4/3 media; key info visible.
- [x] **Community tile:** 300px; Share + Save (when signed in); same min-height as listing tile in slider.
- [x] **City tile:** Share button; min-height; link to search.
- [x] All tiles in a given slider use same width/min-height from `lib/tile-constants.ts`.

### Account & saved items
- [x] Dashboard shows counts: Saved searches, Saved homes, Saved communities, Buying preferences.
- [x] Saved homes page: list of listings; each has “Remove from saved”; empty state + CTA.
- [x] Saved communities page: list with “View” and “Remove”; empty state + CTA.
- [x] Account nav (layout + dropdown) includes Saved communities.
- [x] Remove actions call server actions and refresh; no stale state.

### Listing page
- [x] Hero: photos + video (when data exists); video embeds for YouTube/Vimeo URLs.
- [x] Address + status visible; no duplicate price/mortgage block in main CTA area (per user request).
- [x] Key facts, description, details, community, map, monthly cost, market context, similar listings, videos section all present; collapsible where appropriate.
- [x] CTA sidebar: Schedule showing, Ask question, Contact; no price/mortgage in sidebar (per user request).
- [ ] Missing data: ensure all StandardFields that are useful are surfaced or collapsed when empty.

### Resort communities
- [x] Admin → Resort communities: table of city/subdivision; Resort checkbox; Seed from default list.
- [x] Search/community page: when subdivision is flagged resort, amenities/lifestyle section and resort schema show.

### Team / broker / brokerage
- [x] Team page: list of brokers; links to broker profile.
- [x] Broker profile: image, bio, contact CTAs; not plain text only.
- [x] Brokerage/about: structured; CTAs; admin-managed where content exists.
- [ ] Admin: brokers and site content have add/edit/delete.

### Video
- [x] Listing hero and Videos section: ObjectHtml, direct .mp4, and YouTube/Vimeo URLs embed and play.
- [x] docs/VIDEO_DATA_FLOW.md documents flow for debugging.

### Admin
- [x] Admin uses a **sidebar** for primary nav (Dashboard, Users, Brokers, Site pages, Sync, Geo, Resort communities, Banners, Reports, Spark) with clear active state.
- [x] Header shows user avatar (Google/profile when available), name, and "View site" link.
- [x] All admin links work; no 404s on known admin routes.

### General
- [x] Build passes (`npm run build`).
- [x] No linter errors on edited files.
- [x] Design tokens used; no hardcoded colors outside theme.
- [x] Semantic HTML and aria where needed; focus and keyboard nav work.
- [x] Unknown routes show the app **not-found** page (friendly 404). Dynamic routes (listing, team, report) call `notFound()` when the resource is missing.

---

## How to use this

1. **Before shipping a feature:** Run the relevant checklist items; fix gaps.
2. **When user says “audit the site” or “make sure we hit our goals”:** Work through the full checklist; fix every unchecked or broken item; re-run build and lint.
3. **When iterating:** After a change, re-check related items and fix regressions.
4. **Do not wait for user to report issues:** Proactively run this audit and fix until the checklist passes and the build is green.
