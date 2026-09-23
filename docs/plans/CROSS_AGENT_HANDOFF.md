# Current — 2026-09-22 (Matt: the assigned broker signs)

Surface: Grok Build, primary checkout. A CMA, BPO, market report, or newsletter is signed by the contact's assigned broker. Matt signs only when nobody is assigned. The published business line is the number on the document. A web slug (paul-stevenson) is that broker. Existing stored letters stay as stored until a rebuild. Nothing sent. auto_send stays off. Node: none.

# Current — 2026-09-22 (Matt: Tetherow real estate in the title)

Surface: Grok Build, primary checkout. `/communities/tetherow` title is “Tetherow real estate | Homes for Sale | Bend, OR”. The description opens “Tetherow real estate in Bend, Oregon.” The heading stays “Tetherow homes for sale.” Node: none.

# Current — 2026-09-23 (cloud grinder: Sunriver one winner + SITE-158 closed)

Surface: Claude cloud routine `cloud-grinder-2026-09-23-00`, `main` checkout, landed `fc3649b` on `origin/main` with `npm run push` (rebased once over `f81cbd5`). No PR. Vercel deploy: `deploy:verify` cannot run in this sandbox (no `VERCEL_TOKEN`); production served the new canonical 10 minutes after the push (01:41Z): `/homes-for-sale/sunriver` canonical → `/communities/sunriver`, `/homes-for-sale/sunriver/sunriver` 301, sitemap no longer lists the plain search URL.

- **SITE-187 + SITE-186 (GSC "sunriver homes for sale").** Baseline re-pulled live (query×page, 2026-08-24..09-20): 126 impr, 0 clicks; `/cities/sunriver` 64%, `/communities/sunriver-river-view` 26% (noindex, lag), `/homes-for-sale/sunriver` 7%, the winner `/communities/sunriver` 2%. Root cause was internal: two search URLs carried the winner's exact title+h1, the city page sent every plain "Sunriver homes for sale" door to the search slug, the community page handed the phrase to `/homes-for-sale/sunriver`, and chrome+footer never linked the community page. One pure helper `lib/communities/self-city-community.ts` (registry `slug === city_slug`; Sunriver is the only member): city plain doors → community page, filtered doors stay on search; community drops the search door under its own phrase, search door = `/homes-for-sale/sunriver`, meta opener "Sunriver, Oregon homes for sale."; `/homes-for-sale/sunriver` canonical → community and out of the sitemap; `/homes-for-sale/sunriver/sunriver` 301 → community (`data/legacy-redirects.json`, Tetherow rule); footer Sunriver cluster gets one "Sunriver homes for sale" door. `publishPlaceBrowseHref` accepts a bare `/communities/<slug>`. Both nodes blocked to 2026-10-21 for the 28-day GSC window (`scratchpad/gsc-qp.mts` re-pulls query×page). Not done: a 301 of the plain `/homes-for-sale/sunriver` (would bounce the search app's city switcher) is Matt's call if the canonical alone does not consolidate; the chrome Homes panel still lists Sunriver as a search city.
- **SITE-158 (load-time scroll jump) → done.** The fix built in draft PR #351 had already landed inside SITE-155's `a4f0751`. Verified on production in headless Chromium (Node-side 100 ms polling, scroll to 1400 the moment the document exceeds it): `/`, `/cities/bend`, `/homes-for-sale/bend` only grow mid-load, scroll holds. Dev-only observation: the `<header>` paints ~2456 px for ~100 ms before `V3Chrome.css` applies in `next dev`; production ships the CSS render-blocking and measured 66 px from the first sample.
- **Sandbox facts for the next cloud fire.** Playwright 1.58 wants Chromium build 1208 (`npx playwright install chromium` fetched it; the snapshot has 1194, pass `executablePath: '/opt/pw-browsers/chromium'` or install). Chromium reaches production through the agent proxy only with `args: ['--disable-http2','--disable-quic','--ignore-certificate-errors']` and `proxy: { server: HTTPS_PROXY }`; without them the proxy answers 502 or `ERR_TOO_MANY_RETRIES`, and some CSS chunk requests still come back non-CSS, which makes Next reload the page (a 16 084 → 902 height drop on `/communities/tetherow` that is not the site). `npm run ci:runtime-gates` on the fresh build: route-smoke and page-payload pass; tap-targets and route-content-floor fail on routes this diff does not touch (`heroImageNatural` under floor on cities/neighborhood/oregon-city/place-type-community/price-drops/reviews/search; new under-44 controls: team "Next slide" 28×28, footer cluster title 36×44, atlas polygon) — the image floors read remote media through the sandbox egress. `next dev` on port 3457 died under memory pressure while `ci:gates` + `tsc` ran; verify on `npm run build` + `next start` instead.
- **Next lane (not started).** SITE-184/191 Black Butte Ranch has the same three-URL shape (`/cities/black-butte-ranch`, `/homes-for-sale/black-butte-ranch` with the winner's exact title, `/communities/black-butte-ranch`) but the registry city is Sisters, so the self-city helper does not cover it; the rule to generalise is "an MLS city slug that IS a resort community slug", and the same door/canonical/301 set applies. Tetherow/Broken Top/Brasada split against child plats, `/communities`, `/central-oregon/golf` and listing pages, a different mechanism (parent links from plat pages).
- Skills read: `.claude/skills/site-queue/SKILL.md`, CLAUDE.md §0/§1/§2/§3, `docs/plans/PUBLIC_PRODUCT/PAGE_OUTLINE.md` (one winner), SITE_PAGES_E2E "Site queue".

# Current — 2026-09-22 (Matt: another brokerage's phone stays off the listing)

Surface: Grok Build, primary checkout. A listing detail for a home that is not ours shows the listing brokerage name. The listing broker's phone, email, and personal name are not on that page. A Ryan Realty listing can still name our agent and our phone. Node: none.

# Current — 2026-09-22 (Matt: city pages get the same one map)

Surface: Grok Build, primary checkout. `/cities/[slug]` uses one map. Bend's neighborhoods sit beside it, with a property-type line and a listing photo when that neighborhood has stock. Choosing one zooms and the carousel lists that neighborhood's publicly active homes. The city name lists every publicly active home in the city. Other cities list the recorded plats drawn on the map. `V3PlaceLook` left the barrel; no page mounts that Google fold. `V3PlaceLookMap` stays exported and on the shrink-only wire baseline because the pin gates still read the file. Map commit `2347c2d38`. Barrel commit `aefabdea4`. Node: none.

# Current — 2026-09-22 (Matt: list the schools, not a hedge)

Surface: Grok Build, primary checkout. On a community page, Schools lists the attendance areas that cover the place. Source is Deschutes County polygons in `boundaries` (`get_place_schools` / `getPlaceSchools`), kept when a school covers at least 5% of the place. The share is not printed. Tetherow: William E Miller Elem, Cascade Middle, Pacific Crest Middle, Summit High. No “confirm the address” sentence and no district-only door. An empty read omits the section (Brasada). Node: none.

# Current — 2026-09-22 (Matt: use the photo of their home)

Surface: Grok Build, primary checkout. Murphy's "Your home" column was the Old Mill frame because the MLS hero graded as a living room and the search never opened the rest of the listing's photos. The stored photo is now the front of 20506 Murphy. The cover picker keeps a listing photo instead of the brand frame, and reads the synced photo set. Not sent. auto_send stays off. Node: none.

# Current — 2026-09-22 (Matt: the evidence price board was one string)

Surface: Grok Build, primary checkout. Murphy evidence tables give Low, Avg, Median, High and the two $/sf columns their own width. The 38% key/value heading rule was stacking those dollars. Newest letter is still cma-20506-murphy. Not sent. auto_send stays off. Node: none.

# Current — 2026-09-22 (Matt: align the CMA letter, avoid wrapping)

Surface: Grok Build, primary checkout, `main` `20a975447`. Murphy letter column heads sit on the same edge as the figures. The ask path breaks on the clause, the same way in every column. The what-happened sentence stays one line. Five tight sales already live ($693,000–$735,000, recommended $716,000). Not sent. auto_send stays off. Node: none.

# Current — 2026-09-22 (Matt: header and dog are already nodes; they were parked)

Surface: Grok Build. SITE-155 and SITE-153 were blocked on draft PR #351, which never became the live header. Both are open again. SITE-155: remove Work with us, show the Google picture, do not print the name. SITE-153: move the dog off the cookie bar and the last line, make it move, six doors, click the dog to toggle. Do not mint twins.

# Current — 2026-09-22 (Matt: improve the amenities, do not remove them)

Surface: Grok Build, primary checkout. Community #amenities names each place from the community guide, with its description and a usable access line. No share bar and no "on the ground" heading. Phone is one column. Node: none.

# Current — 2026-09-22 (Matt: listing photos on the subdivision list, phones included)

Surface: Grok Build, primary checkout. Each subdivision with a home for sale shows that home's photograph in the list, on desktop and on a phone. The phone home row is one complete card. The list stays the same height as the map. Node: none.

# Current — 2026-09-22 (Matt: one map on community and neighborhood pages)

Surface: Grok Build, primary checkout. One map. Subdivisions on the left, height locked to the map. Select zooms and the carousel below lists that subdivision's publicly active homes. The place name shows every home in the place. Reach list and the amenities board are off these pages. Node: none.

# Current — 2026-09-21 (Matt: every available home stays on the place page)

Surface: Grok Build, primary checkout, `main` `9a325c485`. Production READY `dpl_8FpNMGkD6rUxhtFoHJh6mSjo4ndE`. `deploy:verify` printed READY; `ryan-realty.com` GET 200. Node: none.

- Subdivision pages: `V3PlaceInventory` lists every publicly active listing inside the boundary (Active + Active Under Contract, every property type, unpriced kept). Live: Deschutes River Woods 15 + 3 = 18 addresses.
- Community + neighborhood: every child subdivision, name-only, full list (`foldAfter` = length). Type line only when that child boundary has stock. All homes stay on the page (`#homes` on community, `#all-homes` on neighborhood). Live: Tetherow 8 children, 6 type lines, 24 homes (15 / 8 / 1). Awbrey Butte 125 children, 55 type lines, 70 homes (55 / 1 / 14). Two Awbrey rows share 3341 Panorama Drive and are two MLS numbers.
- Type lines are not a partition of the place total. Map pins remain the smaller boundary RPC. Coming Soon stays out. Do not reopen SITE-151/152.

# Current — 2026-09-21 (Matt: merge the land queue + SITE-151/152 on the Mini)

Surface: Grok Build `grok-build-01a0c44c-20260921` on the Mini. Merged SITE 139,141,144,148–151,152,157,159–170 onto local main. Pushing origin/main. HOLD owner email.

- **SITE-152/151** `ba4955ceb` /new-construction: one Atlas, 46 live named subdivisions / 198 Bend homes from DAL; concessions on each home from public remarks + BEND_NEW_CON_FINANCING. No listing_private.
- Landed in the same main tip: footer, Caldera+Tetherow, Atlas reach list, homepage fold, cities directory, about faces, search range, letter tiles, team/reviews faces, invest inventory, open-house times, city child doors, aliases, photo alts, ask format, parks/trails, em dashes, browse-places cards.

# Current — 2026-09-19 (CTA lock — drop sticky, header Work with us)

Surface: Cursor cloud, branch `cursor/cta-lock-drop-sticky-2f27` off `origin/main` `3c0d7c8d3`. PR only — Cos Mini lands. Do not merge. HOLD owner email. SITE-123 not on main (not in seed).

- **Drop.** Sitewide sticky Call/Text/Work with us (`V3PhoneDock` unmounted from `app/layout.tsx`). Listing sticky Tour|Call|Text|Work with us (`ListingBrokerBar` / `ListingMobileContactBar` unmounted; `floating=null`).
- **Add.** Header `V3WorkWithUs` sitewide (`placement="chrome"`, `.v3-chrome__work` never `display:none`). Same SITE-122 sheet copy (Buy or sell, Buy a home / Sell your home, About/team/reviews/contact, Call/Text).
- **Listing.** Tour is the one filled ask beside the price (`PriceCtaStrip`). Call/Text stay on `TextMattCTA` and inside Work with us — not equal sticky verbs.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `walkthrough-artifacts`.

# Current — 2026-09-19 (search typeahead — drop 2018 dead stock)

Surface: Cursor cloud `bc-2e02ecf3-d804-5e7c-b8e5-bec7a17234bb`, branch `cursor/gate-stale-search-typeahead-34bb` off `origin/main` `381997f27`. PR only — Cos Mini lands. Do not merge. HOLD owner email. City→place-page nav left alone (Matt never mind).

- **Repro.** Type `Delaware` in site search. Typeahead listed 1020 / 1042 / 105 / 114 / 115 / 124 Delaware Avenue as live address hits. 1020 is Closed Nov 1998; 124 is Closed Nov 2018.
- **Index.** `GET /api/search/suggestions` → `getSearchSuggestions` → `searchListingSuggestTiles` on `listing_tile_mv_src.search_vector` via GIN `listing_tile_mv_search`. MV is one row per MLS listing ever seen. Query only excluded Coming Soon.
- **Gate.** Both numeric + prefix paths `.in('standard_status', PUBLIC_ON_MARKET_STATUSES)` (Active / AUC / Pending). Ungated Delaware prefix: 80 tiles (79 Closed, 1 Expired). Gated: 4 Active (114 + 942 Bend, 3126 + 4014 Klamath Falls). Search grid already defaults to `status: active`.
- **Not this tip.** City / neighborhood / community typeahead still goes to SERP.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `walkthrough-artifacts`.

# Current — 2026-09-18 (SITE-128 Tip Ready — Bend @375 ring fit/scale)

Surface: Cursor cloud `bc-08e057ba-ce1e-5c77-89d4-11efefb6ab64`, branch `cursor/site-128-bend-ring-fit-ab64` off `origin/main` `1a5ea269b`. PR only — Cos Mini lands. Do not merge. HOLD owner email. SITE-128 claim stays public-look.

- **Look rematch FAIL** `dpl_AXi1pkPDec4yt1B9Xzs8vp322vdA` / `ff126836a`: paint present. SVG ~87×99 under the $ pile — dark knot, no readable Bend outline, chip hidden. $ pills + photo cards PASS.
- **Root cause.** Phone-island camera called `fitBounds` then `map.setZoom(9)` on the *pre-fit* zoom (fitBounds is async). z9 on a 13rem island projects the recorded city ring to ~87×99. OverlayView was also torn down/re-added mid-fit, so halo/ink CSS shipped at the wrong scale/z.
- **This tip.** Keep the fitted zoom (`subjectRingKeepFittedZoom` — only pull back from lot z>14). Overlay stroke on `overlayLayer` (under pills). Bend chip on `overlayMouseTarget` at z 3. Same recorded geom. No invent. Pin cap 36 and 13rem / 2×2 cards untouched.
- **Evidence.** `look-pass-site128-ring-fit-2026-09-18/` @375.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-18 (SITE-128 paint rematch — Bend first-look @375 squash)

Surface: Cursor cloud, branch `cursor/site-128-bend-375-first-look-00f7` off `origin/main` `a873fe9ea`. Replaces PR #312 / `f7aa8fc7e` (8-commit stack Cos could not cherry-pick). One squash SHA — Cos Mini lands. Do not merge. HOLD owner email. SITE-128 claim stays public-look.

- **Root cause.** V3PlaceLook is mounted. Fold zoom fitted 240 pins ∪ city ring → z≈8 speck under one count cluster; BEM canvas `\b` miss left a 360px minHeight; @375 18rem map + 2-col left two photo peeks.
- **Paint.** Ring-only camera (`fitSubjectRing` + `v3SubjectRingPadding` + phone z9). `disableClustering` + pin cap 36. Phone 13rem island + 2×2 cards. Evidence in `look-pass-site128-firstlook-2026-09-18/`.
- **Conflict resolve.** Kept landed first-look + hierarchy + naming on `a873fe9ea`. Applied the full Bend paint tree (`2ccf627b9..f7aa8fc7e`) as one commit so Cos can cherry-pick this tip SHA onto `a873fe9ea` without the four-file conflict (`SearchMapClustered.tsx`, `V3PlaceLookMap.client.tsx`, `first-look.test.ts`, this file). Live `--ship` now exits 0; stub-without-shots still refuses.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY.

# Current — 2026-09-18 (SITE-128 Tip Ready #4 — hierarchy naming + crumb sameness)

Surface: Cursor cloud, branch `cursor/site-128-hierarchy-naming-crumb-4cdb`. Tipped against `origin/main` `762952409` (first-look + map hierarchy). Landed `a873fe9ea`. HOLD owner email.

- **Naming.** Atlas child plats are `kind:'subdivision'`. City rail heading is Communities. Quiet term is "Names the MLS uses here".
- **Twin slug.** `nameOnlyChildEntries` collapses 2+ token suffix twins.
- **Crumbs.** `V3Breadcrumb` runs `nameOnlyCrumbs`: no Home, no grain-index ancestors.

# Current — 2026-09-18 (SITE-128 Tip Ready #2 rematch — map hierarchy lock)

Surface: Cursor cloud `bc-e1f596a2-a544-5f74-9d76-8b562ab3519f`, branch `cursor/site-128-map-hierarchy-lock-519f`. Rematch of tip `daadcfba9` / PR #308 onto first-look-landed `origin/main` `5f0d2a1cb` (e788894f4 → 6bd09fb32 → 5f0d2a1cb). PR only — Cos Mini lands. Do not merge. HOLD owner email. SITE-128 claim stays public-look.

- **Highlight.** Nbhd/community Atlas + Split paint THAT recorded subject ring. Child plats are hit-only until selected. No subject geom (Tetherow/Juniper) → no highlight. Do not invent rings. Old Bend FAIL was town||neighborhood = 20 plats.
- **Child zoom.** Overlay / Atlas child click fits THAT recorded bbox (`childZoomBounds` / `fitCamToShape`). Listing pins stay listing clicks. Homepage cities are not children (`hierarchyChildIdSet`).
- **Subdiv.** `subjectGrain` + `atlasFramePad(0.1)` + 2.8px navy so DRW fills the frame.
- **Conflict resolve.** Kept landed first-look fold (`V3PlaceLook` + `#place-look` section order). Hierarchy lock applies to later `#atlas` (`subjectAtlasRegions` + `childRegions`) and Split/SearchMap child zoom. `ci:place-craft` first-look evidence stays on main.
- **#1 refuse.** `--ship place-craft.parity.json` still requires named-peer first-look shots (now present on main). `--ship map-hierarchy.parity.json` ships.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-18 (SITE-128 first-look CI clear — page-purpose + wired)

Surface: Cursor cloud, branch `cursor/site-128-first-look-ci-ec30`. Fix tip ON TOP of `ac8ddac28` (first-look already on `5d8a0f874`). Landed on `origin/main` `5f0d2a1cb`. HOLD owner email. No geom invent.

- **ci:page-purpose.** City + neighborhood `sectionOrder` now matches the first-look fold: `#place-look` then slider / Split / peers / alerts / `#homes`, then `#atlas` later.
- **ci:site-primitive-wired.** `V3PlaceLookMap` recorded as SITE-128 sub-primitive of wired `V3PlaceLook` (same shape as `V3ChartHover`).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY.

# Current — 2026-09-18 (ISR spend cut — place/home 300 → 900)

Surface: Cursor cloud `bc-d020ba1b-33a8-53dc-a4b3-f41f506ff6c6`, branch `cursor/isr-ttl-900-f6c6`. Tip Ready Cos recommended; Matt skipped widget — ship default. PR only — Cos Mini lands. Do not merge. HOLD owner email. First-look refuse `281e5f02a` already on main — not retouched.

- **Change.** `export const revalidate` 300 → 900 on layout, home, city/community/subdivision/zip/open-houses/compare/housing-market pages in `PUBLIC_ISR_TTLS`. Gate + `scripts/__tests__/check-public-isr-ttl.test.mjs` + zip contract test pinned.
- **Left alone.** Search / listing cookies() ISR stay 300. Place-index hubs stay 3600 (no multi-hour TTL). No sync-delta tags.
- **Why.** MLS sync every 15m; 5m ISR rewrites big pages faster than data changes; Sep ISR Writes ~$159.
- Skills read: `.cursor/skills/site-queue/SKILL.md`.

# Current — 2026-09-18 (SITE-128 place craft — Tip Ready refuses without competitor first-look)

Surface: Cursor cloud `bc-ed6caaf0-4a16-5a87-b2ec-252c5ef31516`, branch `cursor/place-craft-first-look-refuse-1516`. Gate only — no place UI invent. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Refuse.** `node scripts/lib/taste-receipt.mjs --ship lib/place/place-craft.parity.json` exits 1 unless evidence has (1) competitor first-look: named peer (Redfin or Bend competitor place page) + side-by-side or sequential shots on disk, and (2) map-drives-hierarchy still locked.
- **CI.** `ci:place-craft` holds the hierarchy lock + documents the evidence path on every push. Stub receipt has no invented shots.
- **Not this pass.** No place page paint. Hierarchy / amenity / keep-exploring already on main.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-18 (SITE-128 craft #4 — listing keep-exploring rematch on hierarchy)

Surface: Cursor cloud `bc-8c9b9d18-f3c6-58b1-9411-1357ab7e6899`, branch `cursor/listing-keep-exploring-rematch-6899`. Rematch of Tip Ready tip `a49d0dc7b` / PR #301 onto hierarchy-landed `origin/main` `fc68066dc`. Cherry-pick of `a49d0dc7b` did not apply clean (`CROSS_AGENT_HANDOFF.md`, `scripts/lib/taste-receipt.mjs`). PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **View more.** Similar-homes door is `listingKeepExploringDoor`: recorded plat / visitor subdivision via `subdivisionHref` (`/subdivisions/…`). Never `/homes-for-sale` or city-only search. Community / neighborhood / city place pages are fallbacks only.
- **Plat chip leak.** Listing Atlas no longer slices 60/80 GIS plats into chips. City frame = subject plat only. Local frame = subject + visitor siblings, cap 7 so frame + plats stay ≤ CHIP_FOLD_AT 8. `+52 more` at 375 cannot return.
- **Conflict resolve.** Kept hierarchy `placeHeroFoldDensityProblems` on `--ship` and added `listingKeepExploringProblems` for listing-detail. Listing files applied from `a49d0dc7b` without invent. `listingPlaceTrail` still untouched.
- **Not this pass.** Hierarchy already on main (`fc68066dc`). Amenity already on main — this tip does not retouch parks/trails. City fold clustering untouched. No invent.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-18 (SITE-128 craft #3 + SITE-130 + crumb LOCK — rematch on amenity)

Surface: Cursor cloud `bc-887dcd7c-7cd3-55bd-8c48-6049b6276f78`, branch `cursor/site-128-130-hierarchy-crumb-6f78`. Landed on `origin/main` `fc68066dc` (tip `3434fa255`). PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Hierarchy.** Killed city “Subdivisions in Bend” dump above nbhd bars. Community/neighborhood children are name-only `#child-places` cards (no Subdivisions/Neighborhoods headings). DRW keep-exploring = GIS ring + resort peers, not a city-wide sales dump. A–Z `/subdivisions` stays the directory.
- **Crumb LOCK.** One component (`V3Breadcrumb`) sitewide. Place templates + CommunityStage overlay on the still. Copy pad is tap + 2xs after listing densify. `ci:listing-fold-density` + `--ship` refuse flow crumbs / xl-3xl cream / “Subdivisions in …” headings.
- **Conflict resolve.** Subdivision page keeps amenity layers wiring (`getPlaceAmenityLayers` + `amenities={amenityLayers}`) and hierarchy nearby peers (`getSubdivisionRing` + `nearbySubdivisionPeers`). `sectionOrder` `#subdivisions` → `#child-places` so `ci:page-purpose` binds. No invent.
- **Not this pass.** Listing keep-exploring, SITE-127 $ pins. Amenity geom + depth already on main (`97a0985fb` / `2e6244515`).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `TASTE.md`, `VOICE.md`.

# Current — 2026-09-18 (SITE-128 craft #2 — Atlas amenity layers)

Surface: Cursor cloud, branch `cursor/site-128-atlas-amenity-layers-4dca`. Node `1a71550b-7231-42f4-9f5c-07a318cbc3f3` (claim stays public-look). Landed on `origin/main` `97a0985fb`. HOLD owner email.

- **This tip.** Park polygons + trail lines on V3Atlas with homes (city / neighborhood / community / subdivision). Navy on cream. Destinations stay PlaceFieldMap.
- **Wired (live RPC 2026-09-18).** `public.boundaries` geo_type=park via `boundary_geojson` — 17/18 registry parks. `public.trail_lines` via `trail_line_geojson` — 18/19 registry trails. Membership from `data/co-parks.ts` / `data/co-trails.ts` (lat/lng never drawn).
- **Omitted.** `american-legion-park` (no-polygon-flag). `whoops-trail` (no trail_lines row). No crowd-sourced invent. Depth tip `2e6244515` / hierarchy / keep-exploring / SITE-127 pin $ not in this tip.
- **Tip Ready.** `node scripts/lib/taste-receipt.mjs --ship lib/atlas/amenity-layers.parity.json` → ship OK. `ci:atlas-amenity-layers` in `ci:gates:chain`.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY.

# Current — 2026-09-18 (SITE-128 rematch — desktop fold stage lock)

Surface: Cursor cloud, branch `cursor/site-128-desktop-cluster-4748`. Tip `242dd3617`. Draft PR #294. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Root cause.** `CITY_FOLD_CLUSTER_STAGE` (1112×610 → 46/44/2) only seeded SSR `view`. Desktop ResizeObserver then replaced it with a collapsed box (abspos SVG, used height a few px). All 759 asks shared one 64px cell until `cam.k` ≈ 5. 375 measured ~360×285 and already PASSed 14+2.
- **This tip.** Membership locks to viewport-class fold stages (`projectPinsToFoldStage`); paint floors collapsed GBR; desktop CSS `height: min(38.125rem, 68vh)`. Phone hint `CITY_FOLD_CLUSTER_STAGE_PHONE` {360,285}. Old Bend / Tetherow / DRW still omit both hints.
- **Contract.** Desktop 46 marks / 44 clusters / 2 pills. Phone 14 bubbles + 2 pills. +1 zoom (k=1.18) → 58. Collapsed 1112×64 live grid → 2 marks / max 749; locked still 46.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md`.

# Current — 2026-09-18 (SITE-128 residual — city fold drives clusters)

Surface: Cursor cloud, branch `cursor/site-128-city-grid-clusters-dd0c`. Tip `ae25eee57`. Draft PR #293. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Prior land miss.** `bd25af464` DID call `clusterAtlasPins` inside V3Atlas, but (1) union-find @ 40px made one 759 blob, (2) SSR `view` was null so first HTML was 759 SVG house dots / 0 bubbles — Cos counted those dots as pills. City page never named the cluster props.
- **This tip.** City fold passes `clusterPins` + `clusterCellPx` + `clusterStageHint={CITY_FOLD_CLUSTER_STAGE}`. Grid @ 64px. Pin-eligible SVG dots omitted. Old Bend / Tetherow omit the stage hint.
- **Not this pass.** SITE-129, SITE-130, SITE-131. Tetherow / DRW map CSS not touched.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md`.

# Current — 2026-09-17 (history explorer: kill Step N of 4)

Surface: Cursor cloud, branch `cursor/history-inline-filter-0e1f`. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Wizard killed.** `/housing-market/history#query` is an inline filter bar (year / city / type / fireplace / min / max). No Step N of 4. No V3Sheet. Fireplace is one control, not a finale.
- **GET contract unchanged.** `year`, `city`, `type`, `fireplace`, `min`, `max`. ODS source line and explore door intact. Page stays `@no-parity`.
- **House control.** New barrel atom `V3Select` (labelled native select). Bar is a GET form; JS submit strips empty/`all`.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `VOICE.md`, `TASTE.md`.

# Current — 2026-09-17 (P0 Matt voice — place H1 every-home kill)

Surface: Cursor cloud, branch `cursor/place-h1-every-home-voice-a7e4`. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **H1 / titles.** Place + search headings are `{Place} homes for sale` (Redfin-like). Killed `Every home for sale in …` / inverted `Homes for sale in …` on city, neighborhood, community, subdivision, zip, and `/homes-for-sale/…` (Lazy River South).
- **Tip Ready.** `EVERY_HOME_LECTURE_REFUSE` in `mannered-public-copy` / `--ship`, beside inventory-lecture + plats.
- **Helper.** `placeHomesForSaleHeading` + `publishPlaceHomesTitle` (title helper inlined in `page-metadata.ts` so `ci:listing-offmarket-index` can still execute that module).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `VOICE.md`, `scripts/lib/mannered-public-copy.mjs`.

# Current — 2026-09-18 (SITE-127 place map price marks)

Surface: Cursor cloud, branch `cursor/site-127-atlas-price-pins-fb34`. Tip `d868aaf17`. PR #290. Node `4e53ce69-591f-4b62-abaf-8ba9ae95e561`. PR only — Cos Mini lands. Do not merge. HOLD owner email. Do not twin SITE-126 V3Chrome.

- **Pins.** Active + pending Atlas marks print the ask: `735K` under a million (no $), `$1.5M` / `$1M` at a million. Sold stays heat dots. Primitive is `V3Atlas` sitewide (city / neighborhood / community / subdivision).
- **Hover.** Pin hit (REACH 28) blows up the home: photo + For sale/Pending + same pin price + street + beds/baths/sqft. Place card suppressed while a pin is hot. Card flips below the mark when the top of the frame has no room.
- **Proof.** Bend 758 pins; NWX 25; Tetherow 28; Parkside Place Phase 1 10. Hover cards opened with photo on all four.
- **Lock.** `ci:atlas-price-pins` refuses silent dots. Cache `atlas-population-v3`. Closed walk stays on typed columns (no `details` detoast).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.



# Current — 2026-09-18 (SITE-126 chrome mega-menus — Tip Ready)

Surface: Cursor cloud, branch `cursor/v3chrome-all-mega-menus-0035`. Draft PR #289. SITE-126 claimed by `cursor-grok-4.6-2026-09-18`. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Menus.** Homes / Places / Market / Sell / About — one packed mega on seed `f8a6ce215`. No empty dead columns. Live facts are Now rows. Thumbs all-or-none per column. Places indexes (All communities + neighborhoods + subdivisions + schools) pack into Browse.
- **Tip Ready.** `node scripts/lib/taste-receipt.mjs --ship lib/site/chrome-mega.parity.json` exit 0 (picker-contract).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-18 (P0 Grand Targhee listing hero follow-up)

Surface: Cursor cloud `bc-a35cf13b-5096-5143-a17f-bd6f8b801440`, branch `cursor/listing-hero-grand-targhee-1440`. PR #288. PR only — Cos Mini lands. Do not merge. HOLD owner email. Do not twin SITE-121 morph.

- **Live densify FAIL.** `06ae550d7` READY on ryan-realty.com (`dpl_HEaMrb6FL1TtSausmcQ7icTFyGuE`). Overlay crumbs landed (Bend / More / 60923 Grand Targhee, 44px). 1440 hero still postage-stamp: mosaic 460×1440 navy gutters around 16:9 aerial; cream filmstrip remains.
- **Follow-up.** Overlay compact `… / address`; listing mosaic `100dvh` height; filmstrip navy. Shared `V3Breadcrumb` + listing hero CSS. `ci:listing-fold-density` + `--ship` refuse short mosaic / cream strip. V3Chrome untouched.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-18 (P0 place inventory craft)

Surface: Cursor cloud, branch `cursor/place-inventory-craft-60a4`. PR only — Cos Mini lands Tip Ready. Do not merge. HOLD owner email.

- **Inventory.** Subdivision + community `#homes` is `V3PlaceInventory` (typed SFR / multifamily / attached / land). Empty types omit. No PlaceSplitView / price scrubber / morphing search on those two routes. City + neighborhood keep Split.
- **Map.** Plat + community Atlas frames `min(68vh, 40rem)` desktop / `min(46vh, 20rem)` phone; scrub hidden. Stock stays on the place page (`#homes`).
- **Voice.** `placeHomesForSaleHeading` + `EVERY_HOME_LECTURE_REFUSE`. No lecture H1.
- **Proof.** `/subdivisions/parkside-place-phase-1`, then `/communities/tetherow`.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `design_system/public/TASTE.md`, `marketing_brain_skills/brand-voice/VOICE.md`.

# Current — 2026-09-17 (P0 listing fold whitespace — breadcrumb + mosaic)

Surface: Cursor cloud `bc-6ad1e3ba-28e0-5a32-bdb7-ef006085e937`, branch `cursor/listing-fold-whitespace-e937`. PR only — Cos Mini lands. Do not merge. HOLD owner email.

- **Breadcrumb.** `V3Breadcrumb` imports shadcn breadcrumb. Trails of 3+ collapse to first / … / last. Listing mounts `tone="on-media" overlay` so Bend / … / address sits on the mosaic, not a cream band. V3Chrome / morphing search untouched.
- **Mosaic.** Photo well and letterbox are navy. Filmstrip thumbs 2.75rem, no extra cream pad. `object-fit: contain` held.
- **Loop lock.** `ci:listing-fold-density` (`scripts/check-listing-fold-density.mjs`) + `--ship` refuse tall quiet / wrapping crumb / cream mosaic / oversized thumbs. Parity `foldDensity`.
- **Tip Ready.** `node scripts/lib/taste-receipt.mjs --ship design_system/ryan-realty/ui_kits/listing-detail/parity.json` exit 0. Adapted `shadcn-breadcrumb`.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

# Current — 2026-09-17 (GA broker visit attribution)

Surface: Cursor cloud, branch `cursor/ga-broker-visit-attribution-22d2`. PR #284. PR only — Cos Mini lands. Do not merge.

# Current — 2026-09-17 (GA broker visit attribution)

Surface: Cursor cloud, branch `cursor/ga-broker-visit-attribution-22d2`. PR only — Cos Mini lands. Do not merge.

- **UTMs.** `attributeSiteLinks` fills missing `utm_source=crm` + `utm_medium=email` (live CRM pair) and `utm_content=agent-<slug>` (`utm_term` only when content is already a creative). Existing listing-alert / market-report / CMA UTMs stay.
- **Visit props.** `assigned_broker` (USER) + `broker_slug` (EVENT) on client `trackPageView` / first-paint GTM+gtag set, and on `/api/visitors/track` MP `page_view` when `?agent=` / cookie / agent UTM is known.
- **Tests.** `lib/analytics/visit-broker.test.ts`, `lib/tracking.page-view.test.ts`, attributed-links + identity-stamp UTM cases. Not a SITE catalog class.
- Skills read: `docs/UTM_TRACKING_CONVENTION.md`, `docs/GA4_USER_TRACKING_SETUP.md`.

# Current — 2026-09-17 (Bend new-construction SFR-first)

Surface: Cursor cloud, branch `cursor/bend-new-construction-51ff`. PR #278. PR only — Cos Mini lands. Do not merge. Not Tip Ready (no catalog SITE class / `@no-parity`).

- **SFR first.** Shelf + ledger: Parkside → Calaveras → Easton → Petrosa → Acadia → Stevens Ranch SF (`From $579,995` Horton page). Live shelf cards filter `Single Family Residence`.
- **Horton townhomes.** Separate ledger: Thunder Ridge $379,995–$419,995, Ponderosa $414,995–$419,995, Stevens Ranch townhomes from $419,995. Not the lead.
- **Gates.** Last stamp 149/149; restamp after this commit. Tip SHA: none.
- Skills read: `VOICE.md`, `TASTE.md`, research uploads 2026-09-16.

# Current — 2026-09-17 (P0 Matt voice — phone sheet + photographed H2)

Surface: Cursor cloud, branch `cursor/p0-matt-voice-phone-sheet-d3db`. PR only — Cos Mini cherry-picks + `npm run push`. Do not merge here.

- **Phone sheet.** `V3WorkWithUs` (listing bar shares the export): title Buy or sell; one line boutique Central Oregon buy-and-sell firm; no broker count; sell tease is Get a pricing take on your home (not the /sell H1); address sits with Call/Text.
- **Place-type.** H2 + jump-nav + ariaLabels are Homes for sale. No "All photographed listings" on city/community type pages.
- **Cheap.** Sort chips hydrate from `?sort=`. DigitSwap commas/`$` are marks, not 1ch slots.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `VOICE.md`, `TASTE.md`.

# Current — 2026-09-16 (SITE-119 Tip Ready PR — floor counter ignores aria-hidden)

Surface: Cursor cloud `cursor-cloud-cos-fleet-20260916-1626`, branch `cursor/site-119-floor-aria-hidden-0301`. PR only — do not merge. Node left `in_progress` (Cos Mini lands).

- **SITE-119.** `measurePage()` sectionDepth item counts skip `aria-hidden` decoration. Four empty Atlas sales-legend swatch `<li>`s inside `<ol aria-hidden="true">` are no longer 4 of the 9 seeded cities/community atlas "items".
- **Floors not lowered.** Proposed Matt-approved re-seed only: cities + community `sectionDepth.atlas.items` 8 → 4 (counted-decoration; 5 real rows × 0.9). honestyFunction / requiredComponents untouched. Main parity files still have no `sectionDepth` key, so the page-level floor hold is unchanged.
- **Evidence.** jsdom `scripts/__tests__/content-floor-measure.test.mjs` (naive 9, measured 5). Node left in progress.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY + §6.

# Current — 2026-09-16 (SITE-114 zip Tip Ready — do not merge)

Surface: Cursor cloud `cursor-cloud-site114-20260916`, branch `cursor/site-114-zip-tip-ready-f900`, draft PR #257. Claim held. Do not merge.

- **SITE-114 `--ship` exit 0.** `demoMatch: true` from a real claude-sonnet-5 Task judge (builder grok-4.6; official grok / cursor-agent / claude CLIs missing). Scores 76/71/74 median **74**, honestyFunction 9, rebaselined off SITE-73 grok-4.6 57. Open-state plates: number-open, masonry-open, insights.
- **adaptedFrom:** `house-atlas`, `house-mos`, `house-alerts`, `beui-number`, `beui:infinite-masonry`, `beui:scroll-animation`, `beautifului-insight`.
- **replaceWith this pass:** `beui:infinite-masonry`, `beui:scroll-animation`, `beui-number` / DigitSwap slots, `beautifului-insight` Allocation face. Remaining polish: DigitSwap square radius (craft, null); unlabeled ScrollProgress (`replaceWith: beui:scroll-animation`).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY, `taste-receipt.mjs --ship`.

# Current — 2026-09-16 (SITE-118 degraded ISR persist refuse)

Surface: Cursor cloud `cursor-cloud-site118-20260916`, branch `cursor/site-118-degraded-isr-009c` @ `ad0499691`. PR #266 (draft) — do not merge. Node left `in_progress`. HOLD owner send.

- **SITE-118.** Place-page `withTimeoutFallback` timeouts used to persist thin ISR HTML (`revalidate` 300|3600). `runPublishedPageRender` notes those reads, retries once at prerender with a 3× leash, and `noStore()`s at runtime so a timed-out atlas is never the second-request copy.
- **Evidence.** `ci:gates` 165/165 including `ci:degraded-isr`. `lib/site/degraded-isr.test.ts` 10/10 (persist refuse + prerender retry + skippableRail not degraded). Floors unchanged. Tip Ready `--ship` N/A (mechanism, no catalog paint).
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY.

# Current — 2026-09-16 (SITE-117 Tip Ready PR — V3Number SSR honesty)

Surface: Cursor cloud `cursor-cloud-site117-20260916`, branch `cursor/site-117-v3number-ssr-e734`. PR only — do not merge. Node left `in_progress`.

- **SITE-117.** `V3Number` defaulted `settle=false`, so production `/cities/bend` first HTML said `<span class="v3-number v3-alerts__num-pop">0</span> houses came on the market`. Default is now `true`; non-finite values omit (never fake 0); `V3AlertsStrip` passes `settle` on both mounts; `V3MosBars` defaults `settle` too (place MOS was the leftover `0`).
- **Evidence.** Production before: numeral `0`. Local `next dev --webpack :3401` after: alerts `121`, sticky `121`, MOS homes `612`. Gate: `components/site/__tests__/v3-number-ssr.test.tsx` (14 passed). No taste receipt invented.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md` HARD TIP READY + §6, `TASTE.md`.

# Current — 2026-09-16 (Claude cloud site queue: STOPPING POINT — Matt's three phone directives landed; SITE-104 merged; SITE-111 merged but NOT judged)

## Stopping point, session claude-cloud-01DYvsoL-20260915

```
STOPPING POINT — 2026-09-16 ~20:30Z, session claude-cloud-01DYvsoL-20260915

BRANCH: claude/run-loop-v30as0, head 6231328, everything pushed, working tree clean, no stash.
PR: #253 (draft), body current, CI running on 6231328.

WHAT LANDED THIS SESSION (all on the branch, none on main)
- f345749  SITE-122 phone dock. One bottom bar below 64rem on every public page:
           components/site/v3/V3PhoneDock.client.tsx + .css, three exports (shell /
           contacts / ask), mounted once in app/layout.tsx. Site pages and sold homes:
           Call · Text · Work with us on the BROKERAGE line. Active listing: Tour ·
           Call · Text · Work with us on the attributed broker, labelled. "Work with
           us" opens the catalog shadcn Drawer (vaul, registered as shadcn-drawer):
           Buy a home -> /buy, Sell your home -> /sell, then About / Team / Reviews /
           Contact, then the phone. --rr-dock-h has ONE owner (both docks are in the
           DOM on a listing page; the hidden one measures 0 and must not clear the
           visible one). V3AlertsStrip docks above it; V3StickyAsk retires below
           64rem. /join relabelled "Join Ryan Realty". ci:offmarket-listing-cta now
           guards the READ of broker.phoneDirect/phoneFub and requires it on an
           active home.
- ead301c  SITE-121 header search (overlayClassName z-[150] over the sticky chrome at
           100, full-width icon-only panel, autoFocus inside the tap, every suggest
           kind, letter-less subdivision placeholders filtered) + SITE-120 alert copy.
- 4052f9d  SITE-104 neighborhood merged from its worktree branch: sonnet 66, honesty 9,
           demoMatch true. ITS 375 SHOTS PREDATE THE DOCK — the rejudge must re-capture.
- bd1bc11  Merge of origin/main after another fleet session landed the same SITE-120
           copy there. Kept main's one differing sentence; kept THIS branch's five
           sheet files (main lacks the SITE-93/104 bindings).
- 05d4d92  Revert of my own wrong /buy receipt edit.
- 6231328  Drawer imports @/lib/utils, not the "cn" package the shadcn CLI wrote.

QUEUE CLAIMS held by this session (heartbeat pid in scratchpad/heartbeat.pid, 40 min,
expires on its own after SITE_CLAIM_IDLE_HOURS=3 if nothing beats):
- SITE-122  in_progress — LANDED, held only so nobody rebuilds it before the PR merges.
- SITE-111  in_progress — the sell lane; see below.
Parked blocked-on-a-person for the grok-4.6 rejudge: SITE-95, SITE-93, SITE-112, SITE-104.

WORKTREES
- .claude/worktrees/agent-af163f8b33b1a99d8 (neighborhood) — clean at 41a11f4, fully
  merged into the branch. Safe to remove.
- .claude/worktrees/agent-a500abb37df2abc69 (sell, SITE-111) — see the lane's report.
  Its commits are NOT on the branch yet. Merge the BRANCH (do not cherry-pick) so its
  own main-merge resolutions come along.

KNOWN CI RED, not this PR's: ci:route-content-floor on /about, /search, /team and
/communities/tetherow/types/single-family. Floors seeded 2026-09-12; those base pages
now carry less. Documented in the PR body, not laundered.

SANDBOX FACTS THAT COST HOURS
- /cities/bend cannot be webpack-built here: next-server peaks ~5.5 GB and the
  claude-code-bash memory cgroup OOM-kills it. CI measures that route instead.
- NEVER put `pkill -f "next dev"` in the same bash line that starts the server — the
  pattern matches the launching shell's own command line and kills the task (exit 144,
  empty log). Cost four dead servers before it was spotted.
- Warm a route with curl before pointing Playwright at it; a cold dev compile exceeds
  Playwright's selector timeout.
- On a listing page BOTH docks are in the DOM. Query the VISIBLE one
  (getBoundingClientRect().height > 0), or you measure the hidden layout bar.
- A stray node_modules package installed by a CLI can make a local typecheck pass where
  CI fails. Delete it before trusting the check.

SITE-111 (sell) — MERGED BUT NOT DONE
The lane's branch is merged into claude/run-loop-v30as0 so nothing is stranded in an
ephemeral worktree. Its one authored change is app/sell/_v3/sell-stage.css: the error
state set `box-shadow: none` with no substitute, which threw away the catalog's own
destructive ring and left a 2px->4px border bump as the whole error signal. It now
paints a flush 3px navy outline plus a navy wash, distinct from the focus ring. The
dead success-state border rule (identical to idle) was removed. The catalog source
components/motion/input.tsx was already correct (shake on error, check drawn by
pathLength) and is untouched.

NOT VERIFIED: no re-shoot, no judge call. BOTH judge calls are still unspent. The
receipt still reads scores [61,63,66] median 63, demoMatch FALSE, honesty 9 — exactly
as committed at 2bca37a. Nothing was invented or re-rolled. The node stays open.

Next session, in order: do NOT run `next build` here (the memory cgroup is shared
across every lane); use `NODE_OPTIONS="--max-old-space-size=3072" npx next dev
--webpack -p 3111`, curl-warm with a real UA, then re-take the five state captures and
run the plain default capture LAST so a loading-skeleton frame cannot end up as
sell-1440.png — then open that file and look at it. Then ONE judge call with --shots
scoped to those ten files. For comparedToPrior use "rebaselined" against the CURRENT
grok-4.6 table row (design_system/public/taste-table.json, key "sell": median 55,
[54,57,55], grok-4.6, v1-2026-09-12, 2026-09-13, honesty 8), naming evaluatorModel as
the differing key — not the stale 2026-09-10 mark the old receipt cites.
```
# Current — 2026-09-16 (Claude cloud site queue: SITE-95 compare + SITE-93 city Tip Ready on the sonnet stand-in; SITE-111 sell + SITE-112 subdivision building)

Surface: Claude Code cloud session `claude-cloud-01DYvsoL-20260915` (branch `claude/run-loop-v30as0`, draft **PR #253**). No grok / cursor CLI in the sandbox, so every mark is the claude CLI as Sonnet with an Opus builder — a **rebaseline**, never done. Cos Mini: rejudge the tips on grok-4.6 and land.

- **Tip:** branch `claude/run-loop-v30as0` (pushed; head is the Matt-fixes commit above `1349e31`). Commits: compare `b0a49f3`…`006076a`; ported PR #252 `65234d6` as `a80e52e` (route-smoke 144/145 sitemap 500 + six tap targets); city `ad4747a` / `746a470` / `17b8a6d`; sitemap index `3ff1721`; oregon-city + price-drops CI fixes `d2afb81`; subdivision `1349e31`; Matt's phone fixes (search + alert copy) on top.
- **SITE-122 phone dock (Matt's third directive, `f345749`):** "We also keep losing the bottom bar for the call text… I want an optimized CTA that says work with us and has buy a home / sell your home options… no easy way for people to learn about us in mobile." Root cause: three different bottom-fixed bars and no two pages carried the same one — the listing bar dropped Call/Text on every off-market home (SITE-21; most listing pages), place pages carried a "Value my home" plate the alerts strip sat on top of, and every other page had none. Now ONE bar below 64rem: `components/site/v3/V3PhoneDock.client.tsx` (+ `.css`), three exports (shell / contacts / ask), mounted once in `app/layout.tsx`; a page that mounts its own hides the layout's by CSS. Site pages and sold homes get Call·Text·Work with us on the BROKERAGE line; an active listing gets Tour·Call·Text·Work with us on the attributed broker's, labelled. "Work with us" opens the catalog shadcn **Drawer** (vaul, registered as `shadcn-drawer`): Buy a home → `/buy`, Sell your home → `/sell`, then About/Team/Reviews/Contact, then the phone. `--rr-dock-h` has ONE owner (the hidden layout bar measures 0 and must not clear the visible page bar); `V3AlertsStrip` docks above it; `V3StickyAsk` retires on a phone. `/join` relabelled "Join Ryan Realty". `ci:offmarket-listing-cta` now guards the READ of `broker.phoneDirect`/`phoneFub` (and requires it on an active home) instead of URIs the file no longer builds.
- **SITE-104 neighborhood (`4052f9d`, merged from the lane's branch):** sonnet 66, honesty 9, demoMatch true. Its 375 shots PREDATE the dock — the rejudge must re-capture. Conflict resolution replaced the hand-rolled `monthFace`/`yearFace` tick arithmetic in ALL THREE insight panels with the catalog's `tickLabels` (the hard-coded gap of 7 named the wrong face for any series that is not exactly 8 points).
- **Correction (`05d4d92`):** I changed `/buy`'s receipt to "rebaselined" mid-merge and was wrong. `identityDrift()` counts `shotsHash` as drift only when the prior differs from the receipt COMMITTED AT HEAD, and only while the working tree differs from HEAD — so the same gate flips its verdict across a commit. Main's "rose" (51 → 55, floor 3) is the stable reading. Reverted.
- **Sandbox limit found:** `/cities/bend` cannot be compiled here — webpack peaks past the `claude-code-bash` memory cgroup and the OOM killer takes next-server. Also: a `pkill -f "next dev"` in the same bash line as the server start kills the launching shell (the pattern matches its own command line). CI measures that route.
- **Matt, from his phone (2026-09-16):** (1) "I cannot type in the search" — the catalog `MorphingSearch` overlay is `z-50` under the sticky chrome at 100, and the icon-only panel was ~150px wide off the right edge. Fixed: `overlayClassName` prop (`z-[150]` from `V3ChromeSearch`), full-width icon-only sheet (`panelLeft`), `autoFocus` inside the tap gesture, every suggest kind fed, letter-less subdivision placeholders dropped. Verified at 375 with touch (dialog 351px at x=12, focus = combobox, "dekalb" → Dekalb Avenue rows). Node **SITE-121**. (2) "I don't like the language on cta" — place alert asks rewritten across `lib/site/place-alerts.ts` + the five sheets ("Hear about new listings in {place} the day they hit the market." / "Every new listing, with its price changes. Unsubscribe any time." / "Send me new listings"); disclosure gate 14/14 OK. Node **SITE-120**. SITE-119 was already the fleet's content-floor node.
- **SITE-112 subdivision:** `--ship` exit 0 · sonnet 63 · honesty 9 · demoMatch true (`1349e31`: paged fold figure, place picker, crawlable index of the neighbours). Node **blocked on a person**, same rejudge ask.
- **Sitemap 500 root cause (CI route-smoke, PR #252/#253):** `getListingSitemapRows` keyset pages on `listing_tile_mv` walked the whole 593K-row key index as `anon` (3s statement timeout; 15.9s measured). Partial index `listing_tile_mv_src_public_active_key` applied to production CONCURRENTLY and recorded in migration `20260916080000` (231ms after).
- **Seen, not fixed:** `/subdivisions/keystone-terrace` overflows the 375 viewport by 14px (`.srch-chip-actions`, the embedded search toolbar's PLACES / FILTERS / SAVE SEARCH row). Noted for SITE-112 / SITE-110.
- **SITE-95 compare:** `--ship` exit 0 · sonnet 62 (58/62/66) · honesty 8 · demoMatch true · shadcn table + carousel imported by `app/compare/_v3/CompareSheet.client.tsx`; flanking chevrons at the photo midline + "2 of 5" read-out were what flipped demoMatch (the under-frame pair the grok ruler rejected on /price-drops was tried and reverted). Floor `heroImageNatural` 1382→1200 by hand with the reason in `contentFloor.note` (rotating sample). Node **blocked on a person** with the rejudge ask in `blocked_reason`.
- **SITE-93 city:** `--ship` exit 0 · sonnet 63 (63/68/62) · honesty 8 · demoMatch true · Beautiful UI insight pager (`CityInsight`) + beUI combobox via new barrel primitive `V3TypeCombobox`; proof strip newest 4 with facts (2 on phones); monthly sold count published; `requiredComponents` 14→16. `next.config.ts` gains opt-in `RR_TURBOPACK_ROOT` (worktree builds). Node **blocked on a person**, same ask.
- **Tool fix:** `scripts/lib/taste-evaluate-result.mjs` `claudeModelFromWrapper` prefers the requested alias (the CLI's `modelUsage` lists the haiku helper first). Both lanes hit it; compare's version kept, both lanes' tests pass.
- **Sandbox truth:** headless Chromium here rejects the agent-proxy CA even with the CA in the NSS store, so `ci:route-content-floor` / `ci:tap-targets` cannot load Spark photos locally; PR #252's `remote-media-proxy` + `gate-browser` are the accepted fix and were used UNCOMMITTED for measurement only. GitHub runners measure real photos.
- **Round two (in flight, claimed):** SITE-111 sell (`app/sell/**`, beui-input / shadcn input / sheet; three clean commits in `.claude/worktrees/agent-a500abb37df2abc69`, sonnet 63 but demoMatch FALSE — beUI input states show only a border change; continuation lane makes the states match the demo) and SITE-104 neighborhood (`app/cities/[slug]/[neighborhoodSlug]/**`, worktree `agent-af163f8b33b1a99d8`). Landing path: cherry-pick onto `claude/run-loop-v30as0`, one gate chain, one push, refresh PR #253.
- **Next:** Cos Mini grok-4.6 rejudge of PR #253 (compare, city, subdivision) → land or send back. Matt's two fixes are directives, not taste passes — land them with the PR. SITE-102/100 (housing-market family) skipped while SITE-103 is held elsewhere. Do not rebuild SITE-93/95 from main.
- Skills read: `.claude/skills/site-queue/SKILL.md`, `design_system/public/TASTE.md`, `scripts/lib/taste-receipt.mjs --ship`, `scripts/lib/taste-catalog.mjs --preflight`.
# Current — 2026-09-16 (SITE-100 Tip Ready PR — market-report hub)

Surface: Cursor cloud `cursor-cloud-site100-20260916`, branch `cursor/site-100-market-report-hub-6b52`, PR https://github.com/RyanRealty/RyanRealty/pull/258. PR only — do not merge.

- **SITE-100 hub fold.** `/housing-market` opens on Instrument with installed beautifului InsightCards (pager + Liveline scrub) and beui-number, plus house MOS as two named bars. Stats from leftover HUD / MarketPulse / Oregon Data Share only. Chooser sits after the city ledger.
- **`--ship` exit 0.** `demoMatch: true`, open-state (`insight-open` / `scrub-open`), catalog-install. Judge claude-sonnet-5 (CLIs missing; Task scored the six PNGs). Median 60 (56·60·65). Rebaselined off grok-4.6 63 / v1-2026-09-08. `adaptedFrom`: beautifului-insight, beui-number, house-instrument, house-mos, house-chart.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md`, `TASTE.md`, `VOICE.md`, `taste-receipt.mjs --ship`.

# Current — 2026-09-16 (SITE-120 Tip Ready PR — place-alert sticky ask)

Surface: Cursor cloud `cursor-cloud-site120-20260916`, branch `cursor/site-120-place-alerts-3485`. PR only — do not merge.

- **SITE-120 copy landed on this branch.** Sticky / callout family is now person-voice: "Hear about new listings in {scope} the day they hit the market."; note "Every new listing, with its price changes. Unsubscribe any time."; promise "We'll email you every new listing in {scope} as it comes on the market, with any price change on those homes in the same email. Unsubscribe any time."; button "Send me new listings"; sent "You're set. We'll email you when something new lists in {scope}." Five binders (city, neighborhood, community, subdivision, ZIP). Old form lines locked by `mannered-public-copy` + SITE-120 accept test.
- **`--ship` community: exit 0** (`demoMatch: true`, open-state, catalog-install). City / neighborhood / subdivision receipts still lack `demoMatch` — not invented. No new judge run.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md`, `TASTE.md`, `VOICE.md`, `taste-receipt.mjs --ship`.

# Current — 2026-09-16 (cloud grinder: SITE-103 landed at 70, SITE-91 rose to 55, production NOT deploying)

Surface: Claude cloud routine `cloud-grinder-2026-09-16-04`, two lanes in worktrees, both merged to main and pushed.

- **PRODUCTION IS STUCK AT 151a32f9.** `/api/cron/deploy-health` (bearer CRON_SECRET) reports `status: stale`, deployedSha 151a32f9, latestSha 4c9834d8 at 09:10Z; neither 6ef8d5a3 (CMA Cursor transport, pushed 09-15 22:18Z) nor today's pushes went live. Both classify as Vercel builds (`scripts/vercel-ignore-build.mjs`), CI is green, so the failure is on Vercel (build error or queue) and the sandbox has no Vercel token to read it. The deploy-health alert never sends: `lib/deploy-health-alert.ts` wraps `RESEND_FROM` in `Ryan Realty Ops <…>` even when the env value already carries a display name (Resend: "Invalid from field"). Matt was notified by push. Open the Vercel dashboard for ryan-realty-platform.
- **SITE-103 market-report-region — landed on main at 4c9834d8, NOT marked done until live.** Lane commits 60b718c5 … 4c9834d8. Judge claude-sonnet-5 via the claude CLI (builder claude-opus-5): 67/70/73 median **70**, `demoMatch: true`, honestyFunction 9, rebaselined off the grok-4.6 63. `taste-receipt --ship` exit 0. Real beautifului InsightCards (pager, Liveline scrub, allocation bar) in the fold; beui-number with server-settled faces; cities as a supply ladder. Repair on the way: every Liveline in the repo drew "No data to display" (series ended at epoch 1_700_000_000; Liveline filters on the wall clock) — affected /invest too. Next session: once deploy-health says `current` on ≥ 4c9834d8, open /housing-market/central-oregon live, confirm the insight card + ladder, then mark done with `scratchpad`-style evidence (must contain `demoMatch: true`, `ui_kits/market-report-region`, and `--ship`).
- **SITE-91 buy — rose 51 → 55 (same instrument, +4 ≥ floor 3), `demoMatch: true`, ship OK, under 70, node released to open.** Merged at 52d02d5f. shadcn carousel object in the fold (flanking 44px chevrons, fifth-card peek, price-band brush, asking-price ladder); JSON-LD 5 → 6, listing hrefs 0 → 43, first priced ask at 779px/1440 and 805px/375. Next lane: judge's open defects are two consecutive card rails (put the buyer-guide Ledger between the shelf and the remaining rails; vary the lead card) and the 375 chip-row fade cue. Price-cut meter in the band was cut on §0 grounds (`price_reduction_share` is nulled by `overlayLeftoverHudFamily`).
- **Tooling fixed by both lanes:** `claudeModelFromWrapper` in `scripts/lib/taste-evaluate-result.mjs` recorded the CLI's haiku overhead as the judge; it now prefers the asked alias (91 tests). Cloud worktrees: Turbopack refuses a symlinked `node_modules` — a bind mount (SITE-103) or a real copy (SITE-91) works; `.husky/_` must be copied in or the worktree's commits run no hooks.
- **PR #252 (fermi) and PR #244 (cursor)** are superseded for SITE-91 / SITE-103 by these landings; #252 still carries SITE-90 / SITE-108 / SITE-105 work for its owner.
- Skills read: `.claude/skills/site-queue/SKILL.md`, `design_system/public/TASTE.md`, `scripts/lib/taste-receipt.mjs --ship`.

# Current — 2026-09-16 (SITE-91 /buy built + judged · oregon-city prod 500 fixed · five tooling agents)

Surface: Claude cloud session `claude-cloud-fermi-20260915`, branch `claude/cool-fermi-0paep0`, PR #252 (draft, second commit).
Matt's rule this round (now §6 of the site-queue skill): **friction is a lane, not a detour** — spin up an agent to fix the tool, on a disjoint file set, while the orchestrator keeps the page.

- **P0 — every `/oregon/<city>` page was 500 on production** (`x-next-error-status: 500`, medford/ashland/klamath-falls/grants-pass/eugene). Root cause: the page awaits `searchParams` (taste_variant) under `revalidate = 3600` + empty `generateStaticParams`, so every URL is a first-request on-demand STATIC pass, which throws `DYNAMIC_SERVER_USAGE` uncaught. Same class as the 2026-07-15 subdivisions 500. Fix: `export const dynamic = 'force-dynamic'` (ISR for this route gone until the `taste_variant` read moves off the server path). Verified 200 on dev for five cities; `ci:public-isr-ttl` OK. Appended to SITE-105.
- **SITE-91 /buy:** compact Stage keeping its band via new `V3Stage.bandWhenCompact` (the barrel hid the band under compact for the homepage's Pulse repeat — /buy has no Pulse and would have lost its only sourced figures); `HomeHomesRails` (SITE-83 V3Carousel shelves, ask + address + facts on every card) directly under it, built from THIS page's SFR tiles; `HomeHomesField` kept under the Ledger (browse by type, regional search as the door); rail `ItemList` JSON-LD; `V3StageInventory.sourceName` shortens the open source clause (108px → 66px; full trace still in HTML behind the disclosure); 375 strip stacks one figure per line, no stranded middots. Measured: first ask ends 860px at 1440 (fold 900) · 873px at 375 (fold 812, 61px under — the rail heading wrap is in `home-homes-rails.css`, held by Matthews Mini; not forced).
- **Tooling shipped by agents (all reviewed):** `scripts/lib/gate-browser.mjs` (shared context: media proxy + `ignoreHTTPSErrors` only under a proxy) used by tap-targets + content-floor; `run-runtime-gates.sh` runs all FOUR gates and prints a summary (was `set -e`, stopped at route-smoke); `taste-evaluate` appends the option-list compliance line to every prompt and re-asks the same judge ONCE on an off-list `replaceWith` (2 of 3 sonnet runs were rejected for that yesterday; 9 tests); `scripts/start-prod-server.sh` / `npm run start:prod` (stale-build + port-holder guards, real-UA waiter); `cloud-setup.sh` `CLOUD_SETUP_SKIP_DEPS=1` for fonts mid-session; skill cloud section: cold-render recipe, build order (stop dev first — the OOM is the OS killer), branch-push sequence.
- **Pre-existing findings appended to their nodes** (not from PR #252; zero `.v3-carousel` on each route): SITE-90 about hero 725<1296 · SITE-95 compare heroImageNatural at the edge · SITE-107 place-type-community heroImageNatural 720<2043 · SITE-110 search hero 160<230 + `v3-range__beui` 4x24 · SITE-113 team words 115<130 + sms links 36.6x44 on production · SITE-96 contact `input` 226.8x42 + `.v3-ask__field button` h32 on production · SITE-93 range handle. `scripts/tap-targets-baseline.json` records ZERO violations, so it is stale vs production — not regenerated (shrink-only; a human decides).
- **Evaluator variance, on the record:** agent B's proof run scored /price-drops **62 (62·59·65) demoMatch TRUE** on the identical shots the lane's run scored **59 (59·59·56) demoMatch FALSE** — same judge (claude-sonnet-5), same rubric. The committed receipt keeps the conservative mark. Two marks on one page is exactly what the receipt rules exist to stop; noted, not rewritten.
- **`ci:runtime-gates` never honoured `PORT` for the gates themselves (found 2026-09-16, fixed):** each gate reads its own `*_BASE_URL` and defaults to `127.0.0.1:3000`; the shell started the server on `$PORT` and waited on it but never exported the base to the gates, so `PORT=3401 npm run ci:runtime-gates` measured an empty port — route-smoke died in discovery on `ECONNREFUSED 127.0.0.1:3000` before probing one route, page-payload said `/homes-for-sale: fetch failed`, tap-targets and content-floor rendered nothing. Four FAILs against a build a hand-started server answered in <1s. CI never saw it (PORT unset). Now `run-runtime-gates.sh` exports `SMOKE_BASE_URL` / `PAGE_PAYLOAD_BASE_URL` / `TAP_TARGETS_BASE_URL` / `CONTENT_FLOOR_BASE_URL` = `$BASE`.

# Current — 2026-09-15 (SITE-108 /price-drops — false absence + cap-as-count, cloud session)

Surface: Claude cloud session `claude-cloud-fermi-20260915`, branch `claude/cool-fermi-0paep0`.
Nodes held: SITE-108 (price-drops), SITE-91 (buy, not started).

- **§0 P0 — /price-drops published a false absence.** `getPriceDrops` hands one
  `listing_key` per event to `getListingTiles`, which puts them in ONE PostgREST
  `.in()`. The key list rides the URL. Measured cliff (anon AND service role, so not
  RLS): **530 keys = 14,410 chars → 528 rows; 540 keys = 14,680 chars → `TypeError:
  fetch failed`**. Fetch-layer death, so `error.message` never named it — `fetchTiles`
  threw and `makeResilientCached` cached the fallback `[]` as a real empty market. The
  window held 545 keys, so the page said "No active single-family home … has a
  documented asking-price cut in the last 7 days" while **262 homes qualified**.
  Activity-dependent and silent: the busier the market, the more certain the page says
  nothing is happening. Fix: `KEY_CHUNK = 300` chunked read, union sorted + paged in JS,
  cache key `listing-tiles-v6`.
- **§0 P0 — the cap published itself as the count, live on production.**
  `total` was `capped.length`. Production read 2026-09-15: `/price-drops` **60** (true
  262), `/price-drops/bend` **40** (true 115), `/price-drops/redmond` **40** (true 51).
  Bend and Redmond both reading exactly 40 is the tell. Understates only. Fix:
  `total = joined.length`; `shownCount` now scopes the Dataset's dollar sum + median so a
  48-row figure cannot sit beside a 262-row count.
- **UX / demoMatch.** `V3Carousel` parked prev/next as a static pair under the first card
  — the cream-box tell the table scored `demoMatch: false`. Restored shadcn's flanking
  chevrons, centred on the media midline (measured: media mid 344, chevron centre 344),
  44x44, navy on cream. Barrel var defaults moved to `:where()` so a consumer override
  stops silently losing the cascade — which is also why `/price-drops` cards were 280px
  wide instead of the 22rem the page had asked for since it was written (specs line
  wrapped; hero image 262 → 334, floor is 300).
- **Tooling fixed, not worked around.**
  - `start:ci` hard-coded `-p 3000`, so the `PORT=` its own docs advertise could never
    work. Now `next start -p ${PORT:-3000}`.
  - `check-route-content-floor.mjs` measures IMAGES with a bare `chromium.launch()`.
    In a cloud sandbox Node reaches the photo CDNs through the proxy and headless
    Chromium does not, so every image-bearing route collapsed to `heroImageWidth: 120`
    and floors failed on routes nobody touched. `take-route-shots.mjs` already solved
    this ("TRAP 10"); extracted to `scripts/lib/remote-media-proxy.mjs` and shared.
    Violations went 10 → 6 and `price-drops` now reads
    `words 1800, images 7, hero 334px, jsonLd 6` — **passes its floor**.
- **Pre-existing content-floor violations this surfaced** (NOT from this diff — none of
  these routes render a `.v3-carousel`, verified 0 elements each): `about`
  heroImageWidth 725 < 1296; `compare` heroImageNatural 1365 < 1382;
  `place-type-community` heroImageNatural 720 < 2043; `search` heroImageWidth 160 < 230;
  `team` words 115 < 130; `oregon-city` HTTP 500. Belongs to SITE-90 / 95 / 107 / 110 / 113.
- **Sandbox limits worth knowing:** `sitemaps/listings.xml` 500s locally on a Postgres
  statement timeout (200 on production); headless Chromium cannot reach the Spark CDN
  directly (curl can) — that is what the shared media proxy is for.
- **Judge:** no `grok` CLI and no `cursor-agent` in this sandbox, so the chain falls to
  the claude CLI. Judge = claude-sonnet-5, builder = claude-opus-5. The live table was
  scored on grok-4.6, so this mark REBASELINES the class and the node is NOT done on it.

# Current — 2026-09-15 (Public Patch P0 Tip Ready — place plats + search + rail flip)

Surface: Public Patch on Matthews Mini. Tip Ready locally. **Do not push origin** — Cos Mini lands. HOLD owner email.

- **Tip:** `5149d641` on `tip/public-patch-p0-place-search-20260915` (not pushed).
- **--ship 0:** homepage-v6 · community · place-type-community (demoMatch true; homepage competitiveBriefPass true).
- **Surfaces:**
  1. **Homes in Bend in-card flip root cause:** prior tip only widened hover selectors; chevrons stayed `display:none` until hover (desktop looked like no flip). Now always `display:flex` when multi-photo; SplitCardMedia + enrichHomeRailRows photo stacks unchanged.
  2. **Plats voice killed** on city/community/neighborhood/place-type public copy → subdivision / neighborhood / community. Tip Ready `PLATS_VOICE_REFUSE` in mannered-public-copy / --ship.
  3. **Sisters / Widgi Atlas fold:** pins-first (`fit="dots"`), drop empty plat cells + taxlot parcels from fold; denser basemap framed on dots.
  4. **Search:** MorphingSearch closed trigger is a real typeable input (was empty button); kill Find a home over-label; kill hero inventory lecture + Stage KPI strip; search meta no longer "across" lecture.
  5. **Central Oregon market pulse:** plain claim "Central Oregon right now."; claim-first CSS hides banned KPI tile row; dull ALL-CAPS plot caption cut.
- **Next:** Cos Mini land when ready. No origin push from Public Patch.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `scripts/lib/mannered-public-copy.mjs`, `scripts/lib/taste-receipt.mjs --ship`.

# Current — 2026-09-15 (Public Patch P0 Tip Ready — rail flip live + chrome Search)

Surface: Public Patch on Matthews Mini. Tip Ready locally. **Do not push origin/main** — Cos Mini lands.

- **Tip:** `5769ee12` on `tip/public-patch-p0-card-search-20260915` (not pushed). `--ship` homepage-v6 exit 0 (demoMatch true · competitiveBriefPass true · open-state · catalog-install).
- **Verify + fix (live fail):** HomeListingRail already mounts `SplitCardMedia`; chevrons were `display:none` because hover required `.v3-lrow` (home cards are `.home-rail__card`). CSS now shows nav on home-rail / media hover + `@media (hover: none)`. Address glue: `.home-rail__addr` / `__city` `display:block` (LoopRedmond).
- **Header Search:** catalog `MorphingSearch` via `V3ChromeSearch` (⌘K, suggest feed, icon phone / pill desk). Not house invent. HOLD owner email.
- **Next:** Cos Mini push tip + PR/land when ready. No origin push from Public Patch.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `scripts/lib/taste-receipt.mjs --ship`.

# Current — 2026-09-15 (Public Patch P0 Tip Ready land — card media + inventory + reviews initials)

Surface: Cos Mini on Matthews Mini. Public Patch tip landed locally. **Do not push origin** until Matt says.

- **Tip:** `b9e6a9fb` (`tip/public-patch-p0-20260915`). **Landed on local main:** `c1cfb576` (cherry-pick). Not pushed.
- **P0 surfaces:**
  1. **In-card gallery + in-card video** — `SplitCardMedia` (homepage Homes rails via `HomeListingRail`, search split via `SplitListingCard` / `MapSearchView`). Photo arrows/dots/swipe; tour/video plays in card media; photo click still opens listing. No hearts.
  2. **Inventory-count lectures cut** — Homes in Bend rail live blurb gone; `/cities` `/communities` `/neighborhoods` `/subdivisions` index captions cut. `mannered-public-copy` `--ship` refuse: `INVENTORY_LECTURE_REFUSE`.
  3. **Reviews AvatarGroup honesty** — `ReviewsAvatarGroup` AvatarFallback initials from real reviewer names only; catalog shadcn/leerob/evilrabbit portraits killed. avatar-open stays Read this review / View on Google / All reviews.
- **Next:** Matt/Cos push when ready. SITE-103/110 untouched.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `scripts/lib/mannered-public-copy.mjs`, `scripts/lib/taste-receipt.mjs --ship`.

# Current — 2026-09-15 (SITE-109 reviews Tip Ready land)

Surface: Cos Mini on Matthews Mini. Tip Ready judge/land only. SITE-107 done — left alone. SITE-103/110/CMA untouched.

- **Done:** Tip Ready Mini rejudge of tip `fb0158a30` (`cursor/site109-avatar-demo-cb02` PR #250). grok-4.6 via cursor-cli: score 58 (52 · 64 · 58), `demoMatch: true`. avatar-open = reviewer Avatar dropdown (Read this review / View on Google / All reviews); SaaS Sign Out gone; catalog portraits. `node scripts/lib/taste-receipt.mjs --ship design_system/ryan-realty/ui_kits/reviews/parity.json` exit 0 — ship OK — demoMatch true · open-state · catalog-install. Landed on `origin/main` `f455b77d` (land commits `af17aafb` / `f455b77d`; tip `fb0158a30` cherry-pick + Mini receipt).
- **Next:** HOLD. SITE-103/110 stay in_progress for their owners. No CMA.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `scripts/lib/taste-receipt.mjs --ship`.

# Prior — 2026-09-15 (SITE-96 contact Tip Ready land)

Surface: Cos Mini on Matthews Mini. Contact-only. No SITE-103. No Canter.

- **Done:** Cherry-picked PR #237 tip `b2fe8a5c` onto `origin/main` and wrote Mini rejudge receipt into `design_system/ryan-realty/ui_kits/contact/parity.json` (`demoMatch: true`, `competitiveBriefPass: true`, score 61, grok-4.6 via cursor-cli). `node scripts/lib/taste-receipt.mjs --ship …/contact/parity.json` exit 0.
- **Next:** `npm run push` this land, then `completeWorkNode` SITE-96 with Tip Ready evidence. Do not invent demoMatch.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `scripts/lib/taste-receipt.mjs --ship`.

# Prior — 2026-09-15 ~06:40 PT (Cos Mini land complete — AE rebuild Canter)

Surface: Cos Mini on Matthews Mini. Engine paths only for CMA; Tip Ready ships verified on main.

- **Done / on `origin/main` HEAD `d3111e3f`:**
  - SITE-98 invest `--ship` 0 (demoMatch true). Tip `ea319d3d` Date.now liveline would regress hydration — main keeps fixed-epoch; already Tip Ready.
  - SITE-94 community `--ship` 0 on `31111123` (queue already done).
  - CMA pocket-first PR #242 landed as `6369cb44` (tip was `bd00dc97`).
  - FlexMLS letter FLOW landed as `d3111e3f` (feature tip `f53c0265`; land-fix tips already on main).
- **SITE-96 contact:** `--ship` exit 1. Mini judge grok-4.6 via cursor-cli: score 47, `demoMatch: false`, `competitiveBriefPass: false`. Heartbeat + note on owner `cursor-cloud-site96-20260914`. Do NOT mark done. Do not invent demoMatch.
- **Fleet:** liveWorkers 3 / max 3 — SITE-96, SITE-106 (`bc-a65b7abe…`), SITE-103 (`bc-0c3ff923…`). No new claims.
- **Next — AE:** rebuild Canter letter on HEAD `d3111e3f` (pocket-first + FlexMLS letter flow). Cos: land complete; SITE-96 stays in_progress for cloud tip-ready fix.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `scripts/lib/taste-receipt.mjs --ship`, `lib/pricing`, `lib/cma`.
