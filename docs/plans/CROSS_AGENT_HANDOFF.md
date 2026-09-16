# Current — 2026-09-16 14:15Z (build R: cities r5 + community r4 merged and pushed at 8f17997ca · still no receipt · the instrument question is Matt's)

Surface: same cloud session, branch `claude/cool-fermi-0paep0`, PR #252. HEAD `8f17997ca` pushed (tree clean). Build R `ObqM_QNrLdFpNR8HRhTHK`; floors cities 5/5 (1,409 words, 28 images) · community 11/11 (3,040) · search ok; tap targets debt 0.

- **cities r5 (lane 9bd8e248d):** `V3DoorBoard` #city-doors (photo/outline tile, live SFR count via V3Number, median·verdict·months, doors with the counts they open onto — open houses this week, Bend $1.5M+ = 236 vs listings 235 every type), `#edges` = one figured lead door, alerts sheet stands on its figure with `V3PlaceStrip`, ledger numerals via V3Number, `headLayout="beside"`, reveal scrub readout. Judge 67 [65,67,69] demoMatch false briefPass false → no receipt (HEAD 58). **Functional defect for r6:** at 375 an open reveal leaves the next ledger row as a bare bar (Camp Sherman). Also the 256 alert ask ×3, generic edges secondary row, no door affordance in stills. r6 lane open (worktree off 8f17997ca).
- **community r4 (lane 99470a2af):** board first after the fold; census → beautifului insight cards (`V3CensusInsight`); finder preselects "All of Tetherow" (demoMatch TRUE at last); V3Number facts + config-verbatim sentences; V3Chart barValues/columnBands; radius token in search-ledger.css (shared with /homes-for-sale — intentional). Judge 57 [55,57,59] demoMatch TRUE, briefPass false, honesty 7 (fell) → no receipt (HEAD 55). r5 lane open: photo-tile amenity board (house-board), a VISIBLE daily-life section (drive times + named schools, beat 7), non-tile form for the Living-in facts, one chart form across widths, plat tiles (beui:infinite-masonry).
- **Instrument:** five sonnet runs on /cities today: 65 → 75 → 63 → 67 (+ one at 65 on the older build), demoMatch flipping on the same combobox plate. The receipt gate (rise needs demoMatch + briefPass in one run; honesty cannot fall) is doing its job; the fallback judge is not a stable instrument for demo match from stills. Raised to Matt on PR #252: refill Grok credits (grok-4.6 is the designed judge) or accept recorded marks lagging shipped pages. No rule loosened.
- **Plates + answers parked in scratch:** `plates/cities-R` (16), `plates/community-lane-2026-09-16-r4-build` (28), `judge-cities-R.json`, `judge-community-R.json`.
- **Still Matt's:** merge #252 / cherry-pick `f4d45cb43` (production red on `public/proof`); `npm run db:push` (CRM participants migration); six base-owned floors + SITE-119's two re-seeds; Grok credits.

# Current — 2026-09-16 13:05Z (build Q: cities r4 + community r3 merged and pushed · no receipt recorded · r5 / r4 lanes open)

Surface: same cloud session, branch `claude/cool-fermi-0paep0`, PR #252. HEAD `7ceccf698` pushed. One build (Q, `cSlYFMFQcqgHPR_mpvjqO`) for both lanes; floors cities 5/5 · community 11/11; tap targets debt 0.

- **cities (SITE-92 r4, lane f91fdd26e → ee1c91c39):** towns as doors (`townsAs="doors"`), alerts strip yields to the ledger (`stickyYieldTo`), sqrt bar ruler (`V3Ledger scale`), `V3TypeCombobox` (ported from #253's branch; `taste-catalog.json` beui-combobox.house now points at it), real reveal chart, `V3PlaceMark` outline/photo fallbacks. Orchestrator fix `7ceccf698`: the r3 closes-by-town list sat in the Atlas dock that the cities fold hides — moved to the aside, fold un-hides it and stacks the Atlas at desktop. **Judge:** 75 [75,71,80] demoMatch TRUE briefPass false (beat 7 not plated) → plates for doors/alerts/edges added → 63 [60,63,66] demoMatch FALSE on the identical compare plate. Neither recordable; HEAD keeps 58. **The sonnet instrument moved 12 points on the same page with plates added** — do not chase a single run. r5 lane open (worktree off 7ceccf698): door board with figures + photos (new primitive, not V3Quiet), a different close than a second link list, the alerts sheet with data + mark, beui:number on ledger counts, intro rhythm, reveal readout.
- **community (SITE-116 r3, lane db1bfb48d → 273238576):** `V3Census #counted` (six counts, what/where/when, traces), typed amenity tiles, `V3PlaceFinder` (beUI combobox), `#market` withheld state as V3Instrument (asking bands + 90-day closes), V3Quiet plate + reach line. **Judge:** 63 [55,63,66] demoMatch false (finder opened with nothing selected — the same primitive with a selected row passed on /cities) → no receipt; HEAD keeps 55. Blocking: amenity board runs third; brief wants it right after the fold. r4 lane open (worktree off 273238576): reorder, preselect "All of Tetherow", beui:number stat row, census encoding (insight-cards), histogram labels/hover, rhythm, radius.
- **Plates + answers parked:** scratch `plates/cities-Q` (16), `plates/community-lane-2026-09-16-r3-build` (24), `judge-cities-Q.json`, `judge-cities-Q2.json`, `judge-community-Q.json`.
- **Machine rules learned this hour:** a lane's commit hook runs `tsc` at ~6 GB + the unit suite — two builds were OOM-killed by it; lanes now make ONE commit and check no build is running first. Fresh worktrees get a `.vite` stub as `node_modules` — symlink the repo's before the hook runs. `prettier --write` on `V3Atlas.client.tsx` reformats the whole file (2,200 lines) — never run it there.
- **Still Matt's:** merge #252 / cherry-pick `f4d45cb43` (production deploys red on `public/proof`); `npm run db:push` for the CRM participants migration; the six base-owned floors + SITE-119's two re-seeds.

# Current — 2026-09-16 10:45Z (ship class build N: cities closes-by-town · price-drops receipt 80 · community r3 + cities r4 lanes open)

Surface: Claude cloud session `claude-cloud-fermi-20260915`, branch `claude/cool-fermi-0paep0`, PR #252 (draft). HEAD `539c6ae7c` pushed; the container restarted once mid-round (tree, scratch and build survived; the first community r3 worker died clean and was respawned).

- **cities (SITE-92 r3, shipped 539c6ae7c):** the wash-off region Atlas lists 90-day closes by town under the key (`lib/atlas/closes-by-place.ts`, pure, 4 tests; a close counts once in the smallest holder; closes outside every outline named). Served: Bend 627 · Redmond 193 · Sunriver 65 · Prineville 58 · Madras 48 · Sisters 42 · Powell Butte 26 · La Pine 21 · 2 more towns · 460 outside every town line; second shape (`listings`, Closed, CloseDate ≥ 2026-06-18, City=) Bend 824 / Redmond 256 / Sisters 67 — postal city wider than the drawn line, as expected. Why: `ci:route-content-floor` read `sections.atlas.items 5 < 8` after the wash came off — the seed had counted the legend's four `aria-hidden` swatch `<li>` as content. Floor not touched. Judge on build N: sonnet **65** [61,65,69], honesty 9, demoMatch false, briefPass false — **not recorded** (gate refuses `rose` while the brief fails and `rebaselined` on a comparable instrument); HEAD keeps 58; plates + answer in scratch `plates/cities-N`. **r4 lane open** (worker worktree off 539c6ae7c): town silhouettes legible at region scale (beat 1, blocking two rounds running), sticky bar clearance over the ledger, per-city bar scale, beui-combobox (port `V3TypeCombobox` from PR #253 if present), 375 sparkline, ledger photo fallbacks.
- **price-drops (SITE-108 r2, receipt recorded):** sonnet **80** [78,80,82], **demoMatch true**, honesty 10, rose from 59 on the same instrument. Lane b7e3257d1 merged at 1ed2cd8e3; follow-up b9c0c87ff applied by hand (`--v3-carousel-nav-inset/-top` on the cuts rail). Next: portal-card anatomy under the photo, caption contrast, 375 swarm column.
- **community (SITE-116 r2):** sonnet 51 [51,47,55] after the recorded 55 → **no receipt** (lower comparable mark). Merged r2 code stands (gate-driven fixes). Five defects on the node; blocking = three unreconciled inventory counts (hero 25+4 · homes list "26 on this map" · alerts "1 in 30 days") — §0 rule 5 scoping, never a number change. **r3 lane open** (worker worktree). 18 r2 plates (incl. value-open via `#value input[name=address]@#value!click`; the catalog has no value-open demoState) parked in scratch `plates/community-lane-2026-09-16-r2-build`.
- **Receipt writer rule fixed (scratch `write-receipt.py`):** drift = evaluatorModel + rubricVersion receipt-to-prior; shotsHash only binds the prior to the HEAD receipt (the gate's `identityDrift` since 2026-09-13). Comparing the new plate hash to the prior's made every same-judge round a refused "rebaselined".
- **SITE-119 seeded (fleet):** the floor gate counts `aria-hidden` decoration as items; the corrected rule + jsdom test (parked: scratch `parked/content-floor-aria-hidden.patch`, `content-floor-measure.test.mjs`) measured the community atlas 5 < its seeded 8 for the same four swatches → the rule fix and two re-seeds are Matt's decision; not shipped.
- **Base-owned floors on build N (unchanged, Matt's):** about 725<1296 · compare 1200<1382 · oregon-city 715<2043 · place-type-community 720<2043 · search 160<230 (intermittent) · team 115<130 · zip fails **under load only** (572/807 words, 7/12 sections; passes idle 1307 words) = SITE-118's class, evidence on the node.
- **Machine rules learned:** one Next build at a time (two OOM kills); kill servers by PID (`ps -eo pid,cmd | grep "[n]ext-server"`), never `pkill -f`; `gates:stamp` runs the whole unit suite (~5 min) — batch pushes per ship class; the container can restart mid-turn — commit and push before long waits, park evidence in scratch.
- **Loops running:** this orchestrator + two builder lanes (community r3, cities r4; both respawned 11:02Z after the account usage limit killed the first pair mid-read — no code lost) + a sibling session on PR #253 (SITE-111 sell, SITE-112 subdivision). Check-in armed hourly (`send_later`).
- **Still Matt's:** merge #252 or cherry-pick f4d45cb43 (production deploys red on `public/proof`); `npm run db:push` for `20260916070000_conversation_participants_are_parties.sql`; the floor decisions above (5 base-owned + SITE-119's two).

# Current — 2026-09-16 (SITE-90 /about landed · runtime-gate class landed · SITE-116 community amenities + depth ratchet in flight)

Surface: Claude cloud session `claude-cloud-fermi-20260915`, branch `claude/cool-fermi-0paep0`, PR #252 (draft; commits 7b5535bd → ff454fa5 → d2ba16ab → 65234d63, then SITE-116).
Matt's directives this round (verbatim, all recorded on nodes and in the site-queue skill §7 / PLACE_PAGES.md §How we stop the loop 6):
"My city pages have to be special" (on /cities/sisters → SITE-93, held by another lane, noted) ·
"Somehow my community pages are also being stripped, we have to show that we are the absolute experts on these planned communities" ·
"These master planned communities have excellent restaurants, parks etc, we just are not doing them justice" ·
"this has to be fixed within the loop and evaluation process and then not allowed to regress" ·
"we really need to be able to beat any page regarding those communities" · "there should be some imagery we can't just have walls of text" ·
"we need to ensure we are using our full loop processes and not one-offing".

- **CRM group text (Matt's screenshot, Leisha + Tanya Hogan, 2026-09-15 3:55 PM):** root cause from the Vercel log — Twilio refuses a second group MMS Conversation for a participant set that already has one (`Group MMS with given participant list already exists as Conversation CHaf1f40233b2944ec944df877e7c57ce9`, the Jul 31 group, still active). Every group text since Aug 1 fell back to two 1:1s. Fixed at `lib/crm/twilio-conversations.ts`: post into the named conversation (wake inactive, refuse closed, confirm our projected line, never delete it); the fallback notice now carries Twilio's reason. Second defect from the same evidence: participant `channel_address` spellings split one person into two rows → the sync trigger flagged 17 one-person threads `is_group=true` → 1:1 sends could not find the canonical thread and fragmented (Tanya: 8 conversations). `record-message.ts` normalizes to E.164 on write; migration `20260916070000_conversation_participants_are_parties.sql` fixes the trigger (distinct parties), normalizes rows, merges fragments, recomputes rollups. **NOT APPLIED** — the cloud sandbox has no DB-admin credentials and no workflow runs migrations: `npm run db:push` from a machine with project access.
- **SITE-117 (fleet §0, shipped 49c13a316):** `components/motion/number.tsx` served `0` for every V3Number until hydration; now serves the settled figure with `data-settled`; `scripts/lib/served-number-placeholder.mjs` inside `ci:route-smoke` fails any route serving a placeholder zero. Verified on a production build: /cities 256, /communities/tetherow 1, /cities/bend 121.
- **Production deploys of main are RED — every push since 6ef8d5a3f.** `dpl_3WyK3WPT…` (6ef8d5a3f) and `dpl_8RuYwej9…` (4c9834d89, 08:07Z, another Claude session) both died at "Traced Next.js server files": `ENOENT … lstat '/vercel/path0/out/proof'`. Cause: tracked symlink `public/proof → ../out/proof` (out/ is gitignored). Fixed on PR #252 as `f4d45cb43` (`git rm public/proof`); nothing goes live until that commit reaches main (merge #252 or cherry-pick it). Live site pinned to 151a32f95.
- **Sitemap / smoke (b662c40bc):** `/sitemaps/listings.xml` 500'd 3× on CI (07:05Z) — `getListingSitemapRows` paged the 593K-row `listing_tile_mv` with no status+key index under the :00 refresh + a second PR's CI. Now reads the ~9.7K-row active-only `listing_search_mv` (3,301 URLs in 2.4s cold vs 12–19s); `ci:sitemap-listings-honest` pins it. The smoke gate gives the sitemap its own row and falls back to the served `/homes-for-sale` HTML for the resolving key. PR #253's lane separately recorded a partial index on the tile MV for the same symptom — complementary.
- **SITE-92 round two (76b506d97 + fcf01361d), receipt pending:** V3Atlas `salesWash` prop (index off; population source line follows; wash mode in the cache key), V3MosCompare idle caption carries band counts, `/cities` citations lead with the MLS feed. CI b662c40bc failed cities' OWN depth floors on a cold contended server (atlas items 0, ledger 13 rows) → read budgets 20s/8s/10s/10s; mechanism seeded as **SITE-118** (a degraded first render is cached for the ISR window — fleet). Round-2 plates + sonnet receipt ride the ship-class build (two rebuilds were OOM-killed by worker-lane verification runs sharing the box).
- **Worker lanes (this session's subagents, isolated worktrees):** SITE-108 price-drops next round (owner claude-cloud-fermi-agent-108) and SITE-116 round two (owner claude-cloud-fermi-agent-116); their branches merge into claude/cool-fermi-0paep0 for ONE build + judge. Memory rule learned: one Next build at a time on this box; no dev servers or vitest runs alongside it.
- **G36 (broker-tools):** the CRM group-text repair as a node; `20260916070000_conversation_participants_are_parties.sql` still needs `npm run db:push` from a machine with project access.

- **SITE-92 /cities (claimed after SITE-116 shipped; SITE-90 released with its notes — no grok judge here to finish it):** the index scored 30 with a supply lecture on cream and no drawing, mark, photo or ask in the fold. Built: an H1 opening, then the fold — the regional Atlas (buildRegionAtlasRegions towns + buildPlaceAtlas region dots, the About page's assembly) beside `CitiesAlertsStrip` (V3AlertsStrip bound to submitSearchAlertSignup, city '' + propertyType A — the same payload RegionalAlertSheet sends — with the region's real new_listings_30d as the claim); the A–Z ledger with the MOS drawing + compare stays under it at level 2. cities/parity.json: requiredComponents + sectionOrder grew, competitiveBrief (portal city hubs are the page to beat), shotSpec states default/supply/reveal/compare-open/ledger. index-ledger-openings.test.ts widened to accept the V3Heading H1 opening (Ledger + no-Instrument guard unchanged). Shipped: three sonnet rounds 58 → 63 → 58 (54·58·61; honesty 8; demoMatch false, briefPass false; rebaselined vs grok 46 / table 30 — in_progress). Fixed between rounds: supply/reveal plates anchored to the section top came out identical (spec anchors the list; reveal hovers the first row), the Atlas was capped to a 5.5rem strip on phones (now min(46vh,20rem) — the index's map is the point), the mobile compare-open plate framed the section instead of the control. The Atlas claim says which population it counts (every listing type) beside the supply drawing's detached count. Left for the next round, named by the judge: town outlines at region scale in the Atlas primitive (recorded boundaries are few and the heat field dominates), the combobox's catalog fidelity, the supply caption restating one figure, the sticky bar over the 375 ledger, 'Market Truth' as a visitor-facing label, the initial-square fallback on rows without a photo. FLEET FINDING recorded on the node: V3Number SSRs its 0 placeholder — served HTML says '0 houses came on the market' while the hydrated page says 256 (a crawler or no-JS reader sees a false zero on every alerts strip).
- **Root cause of the community "stripping" (archaeology agent, SHAs verified):** the sections all stayed; the DEPTH left. 3148a8b7 + dc39f5fc (2026-09-15) took the taxlot parcels off the fold Atlas ("pins-first") and genericized the recorded-plat voice; 0d4b39a9 trimmed the plat index's provenance sentence. The taste table's "timid plat" critique was answered by deleting the drawing. `ci:page-purpose` (section presence + order) and the ten content-floor totals both passed, because nothing measured a section's depth. And PLACE_PAGES.md master-plan item 3 (the amenity grid) was never built: every authored `data/resort-community-<slug>.json` amenities[] row (27 configs; NWX 6 with 13 sources, Tetherow 8, Broken Top 11, Caldera 8) printed as chip text inside the #belonging Quiet, fifth section of ten.
- **SITE-116 receipt (sonnet, rebaselined, in_progress):** five rounds on one page — 48 (two "blocking §0" findings off stale plates other lanes left in `ui_kits/community/shots/`; verified false in the served HTML; sixteen plates removed), 56, 56 (honesty 6: the fold caption's HOA/tiers/acres carried their source only in a title — now "Sources: Tetherow Resort and 9 more on file · HOA from current listings here" in view), 63 (honesty 9; beats 4 and 7 failed on sections not in the plates — `subdivisions` and `belonging` states added to the spec), **55 (55·53·57) on the full eight-state set, honesty 8, demoMatch false, competitiveBriefPass false**. The instrument swings ±8 on the same page. What the judge still asks for and why it did not ship this round: photographs on six of nine tiles (we hold none of those places — real photography is the honest path), catalog motion (beui number/scroll-animation installs), the belonging ledger's form, airport drive time + named schools on Tetherow (its config carries neither). The page beats tetherow.com on inventory depth by the judge's own account. Two content-floor gate races closed (in-fold image settle wait; hydration-stable section map): zip/search stop reading the logo as the hero, the Atlas stops measuring 0 items on a cold server. `house-board` registered as a house module on the city class in taste-catalog.json.
- **SITE-116 (new, Matt ADD p0, seeded in scripts/seed-site-queue.ts, claimed):** `V3PlaceAmenities` (PATTERN 10, BOARD) in the barrel — one packed grid of every authored amenity (kind eyebrow, display-face name, one line, access, a door to our guide or the place's own page), chips as in-page anchors, a photo strip of the place (curated LP/Area Guide frames + graded asset-library photos via `lib/place-photos.ts`, hero excluded), tile covers from our guide posts, the config's publishers as the §0 line; mounted directly after the fold on /communities/[slug], before #subdivisions; the #belonging Quiet no longer repeats the rows; Place JSON-LD `amenityFeature` from the same rows. `competitiveBrief` written into community/parity.json (8 beats; the resort homepage is the page to beat) so the judge must pass it with evidence; shotSpec gained `amenities`. Depth ratchet: `contentFloor.sectionDepth` (agent-built; `--sections-only`, `--dry-run`, `--parity-out`; 34 tests) — seed it for community from the production build in the same commit.
- **Imagery is the honest gap:** only 22 graded photos across the 27 configs (Sunriver 11, Caldera 6, Crosswater 4, Tetherow 1); Tetherow has 13 approved-but-ungraded frames, Three Rivers 10. A grading agent (existing vision mechanism only, via lib/grok) is running; the board shows nothing ungraded by rule.
- **SITE-90 /about (d2ba16ab):** picks show the whole first sentence; door to /reviews in the band head (703–747px at 1440); Review JSON-LD; "Firm OREA OREA" → one OREA. Judge sonnet 56 (52·56·60) demoMatch true briefPass true, rebaselined — in_progress.
- **Runtime-gate class (65234d63):** keyset-paged listings sitemap (18.7s cold / 15ms cached, 3,307 locs); smoke gate retries the sitemap and catches the AbortError that killed run 35043457290; six tap targets fixed at source (Debt 0); `--release`.
- **Five content-floor failures on main's own pages need Matt** (about 725<1296, oregon-city/place-type-community heroImageNatural = the seed measured the chrome logo, search 160<230, team words 115<130): the floor edits were refused to the agent as a CI-threshold change; the table and the one-line patch per class are on PR #252.
- **Do not:** touch `app/_v3/HomeListingRail.client.tsx` / `home-homes-rails.css` (another surface); mark a node done on a sonnet mark; reseed a floor to make a red gate green.

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
