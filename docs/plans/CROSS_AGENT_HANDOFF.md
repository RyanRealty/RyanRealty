# Current — 2026-09-10 (round four seeded SITE-68…89)

Owner: grok-4.6 this session `grok-01a0895a-2026-09-10`. Seeded 22 catalog-backed class nodes (invest 25 → place-type 69). Skipped listing-detail / about / compare. Did not steal SITE-60 or SITE-63. Next: claim SITE-68 + SITE-69 if fleet has a slot, re-measure live first viewport, then builder card.

# Current — 2026-09-10 (queue ready to take catalog-backed SITE nodes)

Owner: grok-4.6 this session. **No SITE claims.** Did not steal SITE-60 / SITE-63 / SITE-67.

Every public taste-classes key now maps to a catalog class. `--preflight` passes for all 27. `node scripts/taste-table.mjs --seed-draft` emits SITE-68…92 with builder card + adaptedFrom accept. Not auto-seed — paste after review. Installed `components/ui/carousel.tsx` and `button-group.tsx` as local fetch targets (public paint stays v3).

# Current — 2026-09-10 05:44Z (15m grinder 01a0894e: fleet full, no steal)

Owner: Grok scheduler `01a0894e`. **Fleet 3/3, zero open.** origin/main `d222d7fa`.

- `grok-01a08914-2026-09-09` — SITE-60 heartbeat 1m (`wt/site-60-listing-prefetch-20260910` @ `1fdeb0e57` on origin, worktree clean, **lane still live — do not land**).
- `grok-4.6-2026-09-10-03` — SITE-63 heartbeat 2h (not stale).
- `grok-01a08945-2026-09-09` — SITE-67 heartbeat 1m.

SITE-64/65 already done. Next 15m fire retries.

# Current — 2026-09-10 (taste process: builder card + adaptedFrom ratchet)

Owner: grok-4.6 this session. **No SITE claims.** Did not steal SITE-60 / SITE-63 / SITE-64 / SITE-65.

Matt: can this process be done better. Yes. The catalog CLI now prints a builder card (house files, ≤8 fetches, missing primitives). `ci:taste-canon` refuses a new catalog-class receipt without `adaptedFrom` and `replaceWith` (9 existing receipts on shrink-only `taste-receipt-catalog-baseline.json`). Listing pages cannot pass `heroInMain` (SITE-45 lock). Evaluator fails loud on a broken catalog. Lane start: `node scripts/lib/taste-catalog.mjs <class> --preflight`.

# Current — 2026-09-10 04:45Z (15m grinder 01a0894e: claimed SITE-64 + SITE-65)

Owner: Grok scheduler `01a0894e` / `grok-4.5-2026-09-10-04`. Fleet 3/3.

Did **not** bulk-insert SITE-64…87 from the 2026-09-08 table (stale). Live first-viewport shots on production: about still opens on a 5.0/25/3 KPI grid; compare still leads with four dashed empty slots. Seeded those two only.

**Held:** SITE-64 (`13814dc4-…`) about KPI cut; SITE-65 (`ee7852f3-…`) compare sample-first. Local commit `036a4276` on main, **not pushed** — taste receipts + `deploy:verify` still due. Do not mix listing/catalog dirty files (SITE-60 / shadcn Lego) into that commit.

Do not steal SITE-60 or SITE-63.

# Current — 2026-09-10 (Matt: keep running as nodes get entered)

Owner: Grok (grok-01a08945-2026-09-09). **No claims.** Durable 15m site-queue task `01a0898e` is armed; a watcher wakes this session when an eligible SITE-* appears and the fleet has a slot. Empty of eligible is a quiet fire, not a stop. Do not auto-seed SITE-64…87.

# Current — 2026-09-10 04:14Z (15m grinder 01a0894e: fleet full, no steal)

Owner: Grok scheduler `01a0894e`. **Fleet 3/3, zero open.** origin/main `2437076a`.

SITE-43 is **done** (landed `c4ebc747`, deploy in node evidence). Did not re-land it.

- `grok-01a08914-2026-09-09` — SITE-60 heartbeat 8m (worktree still dirty, no origin `wt/site-60*` — not landable).
- `grok-01a08945-2026-09-09` — SITE-61 + SITE-62 heartbeat 5m. Code is already on origin (`48c3d5fb`, `e6e7916a`); owner is holding for deploy verify + live check. Do not steal.
- `grok-4.6-2026-09-10-03` — SITE-63 heartbeat 21m (`wt/site-63-taste-process-20260910` @ `0f759c41`). Do not steal.

Next 15m fire retries. `--seed-draft` exists on main; do not bulk-insert SITE-64…87 while the fleet is full.

# Current — 2026-09-10 (SITE-61 and SITE-62 done on production)

Owner: Grok (grok-01a08945-2026-09-09). **No claims.** Pushed `9d2d3924..2437076a`. Deploy `dpl_D545iL4fwrYZZTTSmMkZrDTbfBmo` READY in 254s. Sitemap smoke failed on `/sitemaps/matrix.xml` 200 with 0 entries (unrelated; listings.xml 200 / 3312).

**SITE-61 done.** Live `/sell` `#our-listings`: `v3-ledger--photo`, 88×66 at 1440, Spark `320x240`. Live `/activity` `#feed`: 10/10 decoded at 88×66. Left: place-open-houses (SITE-43 held that family; it has since landed).

**SITE-62 done.** `--seed-draft` emits SITE-64…SITE-87. Not auto-seed.

# Current — 2026-09-10 (SITE-61 + SITE-62 landing on main, not pushed yet)

Owner: Grok (grok-01a08945-2026-09-09), main @ `48c3d5fb` (ahead of origin by SITE-62 `e6e7916a` + SITE-61 `48c3d5fb`). Claims still held until deploy verify + live check.

**SITE-61.** `/sell` `#our-listings` and `/activity` `#feed` opted into V3Ledger `media="photo"` (88×66 / 72×54) with Spark rewrite at `lib/listing/row-photo.ts`. Left: `#bend-also` (no listing photos), subdivision index (plat photos on a bar), `toLedgerRows` (no public caller), `place-open-houses` (SITE-43 held the place family; SITE-43 has since landed — a later pass can pick that up). Sell receipt rebaselined 70 on grok-4.5 vs prior 71/claude-sonnet-5 (shotsHash includes our-listings frames). Not the grok-4.6 table instrument.

**SITE-62.** `node scripts/taste-table.mjs --seed-draft` emits DRAFT Seed literals for classes under 70. With env, ids SITE-64…SITE-87 (SITE-62/63 already in the graph). Does not write Supabase. Path in DEVELOPMENT_PROCESS.md. `market-report-annual` skipped (no primitive path on disk).

**SITE-59 leftover (orchestrator).** Diamond Bar Ranch: no `.gm-style`, list still renders; copy still says "the map above". Medford: 11 thumbs at 88×66, `v3-ledger--photo`. Deploy `90e41d5e` was READY; listings.xml 500 during smoke was a cold miss (200 on retry).

**Do not steal.** Other Grok lanes may still hold SITE-60 / SITE-63.

# Current — 2026-09-10 (loop Lego: fetch ui.shadcn.com, adapt into v3)

Owner: Grok (01a0895a). Did not steal SITE-43 shots. Did not claim.

Matt sent https://ui.shadcn.com/ after the EXM7777 post. That catalog is now the
loop's Lego: `node scripts/lib/taste-catalog.mjs <class>` prints house modules
plus the shadcn docs to fetch. Public pages still paint from v3. Do not
`npx shadcn add` onto app/ or components/site/. Listing layout lock: restore
`listing-hero-bleed`; SITE-45's column hero is the failure.

# Current — 2026-09-10 (one instrument: grok-4.6 judges every page on the subscription; Grok lanes are live; the UI process itself is the next node)

Owner: Claude (Opus 5), session 3db16241, main checkout. Read this whole block before touching
the site queue — several things changed tonight and one of them changes what every mark means.

**THE ONE INSTRUMENT (Matt, asked and answered).** The judge is **grok-4.6**, run through the
`grok` CLI so it spends Matt's Grok subscription rather than API credit, and it is the judge
whatever built the page: `scripts/taste-evaluate.ts` for a route receipt, `scripts/taste-table.mjs`
for the site table. Before this the judge followed the builder (Claude lanes scored with
claude-sonnet-5, Grok lanes with grok-4.5 through `xaiFetch`, which billed XAI_API_KEY), so every
page a Grok lane touched rebaselined and its previous mark stopped counting. `ci:taste-canon`
refuses `evaluatorModel == builderModel`, so **a Grok lane builds with grok-4.5**. Every class
rebaselines ONCE on this switch: the first table on grok-4.6 is the new baseline and the 70 finish
line applies to those numbers. Landed at `1af6d885`; TASTE.md, the Cursor skill and rule, and the
routine prompt all say it. Verified the grok CLI reads a PNG off disk and reports its contents.

**The table run that is still in flight is the OLD instrument, deliberately.** It scores the
2026-09-08 shots on claude-sonnet-5 so round three's thirteen primitive fixes can be measured
against yesterday on the same ruler — the last reading of the old instrument. Shots for all 27
classes are merged in `.taste-table/2026-09-10T02-40-10-726Z/`; if the run dies, re-score with
`node scripts/taste-table.mjs --evaluate-only .taste-table/2026-09-10T02-40-10-726Z --claude --diff`
(`--claude` because the default is now grok). After that reading lands, every future table is grok.

**Grok lanes are live and holding nodes.** `grok-01a08914` and `grok-01a08945` own SITE-60, 61 and
62 — they picked the queue up from `.cursor/rules/run-loop.mdc` and `.cursor/skills/site-queue/`
with no prompting, which is the handoff working. A launchd routine
(`com.ryanrealty.site-queue-grok`, 02/06/10/14/18/22 local) fires `grok -p` against
`scripts/site-queue-routine-prompt.md`; the Claude cloud routine still fires every four hours at
:05 UTC but is on Fable, which is at 99% until Tue noon, so its fires are refused until then.

**SITE-63 is the next served and it is the answer to Matt's real question** ("i need to improve the
ui and that whole process in the loop"). Rounds one to three fixed defects and the site still tops
out at 69, because the loop is built to REMOVE tells, not to produce a good page: a builder gets
adjectives and reaches for the safest layout, which is the stacked-section page. The node does
three things TASTE.md already prescribes and nobody has ever done — reference files per class
naming real pages and shipped component code to adapt; the variants rule made real so Matt's taste
picks the winner instead of a model's; and an evaluator that names the replacement FORM from the
dataviz order instead of only naming the flaw. Its accept demands a negative result be recorded if
the process still does not help.

**Two hazards, both bit tonight.** (1) The Data volume hit 100%, which corrupted Turbopack's cache
(the dev server FATALed on boot until `.next` was cleared) and broke the Bash tool itself — every
command failed writing its own output file. The escape hatch is
`mcp__plugin_desktop-commander_desktop-commander__start_process`; the reclaim recipe is memory
`reference_disk_pressure_reclaim`. Four clean CMA worktrees were removed; all four branches
survive and two are AHEAD of the SHAs this handoff previously recorded. (2) Uncommitted work in
this shared checkout gets wiped by other sessions — a full set of edits to taste-table.mjs and two
docs vanished mid-session. Commit immediately, do not leave a working tree dirty.

**Do not.** Point the evaluator at your own model to make it convenient. Compare a grok-4.6 mark to
a claude-sonnet-5 mark. Let a failed table run write nulls (the tool now refuses, keep it that way).
Build a page against adjectives when SITE-63 lands a reference file for its class.

---

# Current — 2026-09-10 (site queue stays armed)

Owner: Grok (grok-01a08914-2026-09-09), main @ `7237aa88`. Matt: keep running as lanes finish and new nodes appear.

**Armed.** Durable Grok scheduler `01a0894e` every 15m (`scripts/site-queue-routine-prompt.md`). Mac launchd `com.ryanrealty.site-queue-grok` still at 02/06/10/14/18/22 local (never fired yet). This session watches the graph and lands held claims.

**Held here:** SITE-43 (place opening, `wt/site-43-place-opening-20260909`) and SITE-60 (listing prefetch). Do not steal. Next open: SITE-61, SITE-62 — the 15m fire claims them when fleet has room.

# Current — 2026-09-10 (run loop: SITE-43 + SITE-60 claimed)

Owner: Grok (grok-01a08914-2026-09-09), main checkout @ `7237aa88`. Two claims (session cap). SITE-61 and SITE-62 stay open.

**SITE-43** (in flight, worktree `wt/site-43-place-opening-20260909`, agent `01a0891e`). MOS two-bar is committed (`6cb1bd4f`); shots recaptured including mos-hover and alerts-toggle. Do not touch PlaceAreaHero / V3AlertsStrip / V3MosBars from another lane.

**SITE-60** (claimed this boot, agent `01a08948`). Listing route 1600x1200 hero preload inside speculatively prefetched RSC payloads (~25 MB on /oregon/medford). Do not disable link prefetch site-wide. Do not touch V3Ledger photo callers (SITE-61).

**Scoreboard (from the block below):** the table instrument is first-viewport only and is the finish line (70). Lane scores are a different instrument. City 40 / neighborhood 45 / community 53 on tonight's table — SITE-43 is the first-viewport opening of those three classes.

# Current — 2026-09-10 (run loop: SITE-61 + SITE-62 claimed; SITE-43 and SITE-60 held by the other grok)

Owner: Grok (grok-01a08945-2026-09-09), main checkout @ `7237aa88`. Two worktree lanes in flight.

**Run loop.** Fleet 2/3. Other session `grok-01a08914-2026-09-09` holds SITE-43 (place opening) and SITE-60 (listing prefetch, taken in the claim race). This session holds SITE-61 and SITE-62. Do not touch PlaceAreaHero, V3AlertsStrip, city/neighborhood/community page.tsx, `lib/kb/place-open-houses.ts`, or `app/listing/**`.

**SITE-61 lane.** Listing-shaped V3Ledgers that still draw a photo in the 44px mark pick up `media="photo"` (88x66, navy tile, Spark size rewrite promoted to `lib/listing/`). Live-check each named ledger before opting in. Leave place-open-houses on the old treatment in one recorded line: SITE-43 holds that route family. Routes: `/sell` `#our-listings`, `/activity` `#feed`, subdivision listing rows if they actually render.

**SITE-62 lane.** `scripts/taste-table.mjs` (or sibling) emits DRAFT seed entries for every class under finish line 70. Never writes Supabase. Numbering is the next unused `SITE-*` from seeds + `loop_work_nodes`, stable across two runs. Path documented in `docs/DEVELOPMENT_PROCESS.md`.

**Leftover.** SITE-59 shipped `90e41d5e` without deploy:verify — run that and live-check `/subdivisions/diamond-bar-ranch` plus `/oregon/medford` before calling it verified.

**Skills read:** site-queue, loop-status, TASTE.md, frontend-design, ryan-realty SKILL.md, database-canonical-reference, long-running-background-tasks.

# Current — 2026-09-10 (stopping point: the queue is empty of eligible work, and the scoreboard we have been reading is wrong)

Owner: Claude (Opus 5), session claude-opus5-9d4aa6fc-2026-09-09, main checkout. Stopped for context,
not for a blocker. **I hold no claims.** Last push `90e41d5e`.

## READ THIS FIRST: the lane scores and the table scores are not the same number

Every lane today reported a taste score from its own evaluator, and those are the numbers in the
older handoff blocks below — annual-review 83, oregon-city 80, reviews 81, search 75. **The standing
table instrument, run against production tonight, scores the same pages far lower:** about 46, city
40 (yes, forty), community 53, contact 50, compare 48, cities 55, blog 61, buy 63,
market-report 47, market-report-annual 62, neighborhood 45, oregon-city 56, place-type 66,
listing-detail 53, homepage-v6 57, invest 65.

The difference is not noise and it is not a broken tool. **The table captures the FIRST VIEWPORT
only, at 1440 and 375, and scores what a visitor sees on load.** A lane's evaluator scores the shots
the lane chose — often several states, sometimes the whole page — and drives the live page. Both are
honest; they answer different questions. Matt's finish line (2026-09-09) is **70 on the table
instrument**, so the table is the scoreboard and the lane numbers are a lane's own instrument.
**Do not quote a lane score as the site's score.** By the table, no class clears 70 yet.

**The run is unfinished and resumable without re-capturing.** All 54 first-viewport shots for 27
classes are at `.taste-table/2026-09-10T01-09-13-961Z/` (scratch, not committed — if it is gone,
re-capture). Resume with:
`node scripts/taste-table.mjs https://ryan-realty.com --evaluate-only .taste-table/<runDir>`
Two classes failed validation on the first pass and need a re-run: market-report-detail ("no defect
names a primitive that exists on disk") and market-report-region ("criteria.honestyFunction must be
an integer 0-10"). I reverted the working copy of `taste-table.json` and the table markdown so a
half-finished run of nulls could not be committed — **the committed table is still the 2026-09-08
baseline. Do not trust it either.**

## Landed since the last block
- **SITE-41** market pages: 31→83, 53→78, 63→77, 41→80 on the lane instrument, no KPI grid. Matt's
  cut ruling applied (28-row table gone, twelve cells down to three-to-five with sentences); a second
  uncaptioned grid nobody had found was cut too. §0 bug fixed: two listings displayed \$0 because
  `formatPrice` rounds anything under \$500 to zero.
- **SITE-59** the dead map pane is gone from all four place templates (none of them wanted a map;
  `listOnly` was hardcoded) and the out-of-area rows show their photographs. **The photo cause:** the
  picture was drawn inside the 44px tap mark on `--v3-wash`, so a decoded photo, a loading photo and
  no photo were one grey square. Not a licence, not an opt-out, not a missing field — all three ruled
  out by measurement. **Deploy verify was NOT run for SITE-59; do that first.**
- **SITE-31** eleven community guides, live. **SITE-40/49/51/55** landed off a stranded branch.

## Seeded and eligible right now
- **SITE-60** — a page that links to listings prefetches ~25 MB of MLS photographs nobody sees
  (78 requests / 25,386,060 bytes with prefetch on, 11 / 333,689 with it off). Belongs to
  `app/listing/**`; invisible in dev because prefetch is off there. Probably every route that links
  to a listing.
- **SITE-61** — the other listing-shaped ledgers (`app/sell`, `app/activity`,
  `subdivision-rows.ts`, `place-open-houses.ts`) still draw a photo in the 44px mark.
- **SITE-58** — Crook and Jefferson plat polygons (a grok session claimed it earlier; check the
  heartbeat before taking it).
- **SITE-43** waits on SITE-03, which is on a measurement window to 2026-10-06.

## The order for whoever picks this up
1. `npm run deploy:verify` and live-check SITE-59's two surfaces.
2. Finish the table run (`--evaluate-only`), fix the two invalid classes, commit the real table.
3. Seed the next round from the bottom of THAT table, by primitive, not from the lane numbers.
4. `city` at 40 and `neighborhood` at 45 are the worst two and neither has an open node.

## Two environment notes from the SITE-59 lane
The host disk hit 0 bytes mid-session (~24 GB reclaimed from Chrome and npm caches), and something
pruned a live worktree's `node_modules` and `ms-playwright` **during** its build, which failed with
a bogus type error in a file the lane never touched. A concurrent disk pass can take a running lane's
dependencies out from under it.

# Current — 2026-09-10 (SITE-43 claimed; place-opening lane in flight)

Owner: Grok (grok-01a08914-2026-09-09), main checkout @ `6c4ad446`. Lane isolation: worktree agent `01a0891e`.

**Run loop.** Brief served SITE-43 (depends_on SITE-03 cleared). Claimed `SITE-43` for this session. SITE-59 remains in_progress on `claude-opus5-9d4aa6fc-2026-09-09` (empty frames + oregon photos) — this lane does not touch PlaceSplitView, maps, or `/oregon` listing rows.

**SITE-43 lane.** PlaceAreaHero MOS two-bar (homes for sale vs a month of sales) in the hero; V3AlertsStrip paired figure + property-type toggle + at-rest numeral + mobile primary CTA. Routes: `/cities/bend`, `/cities/bend/awbrey-butte`, `/communities/tetherow`. MOS source = leftoverHudKpis (same as the city door; do not mix listing_tile_mv). Neighborhood receipt must beat SITE-07's ruled 67.

**Queue.** Open eligible: none besides this claim. SITE-59 held. Measurement windows stay blocked. After this round: land one push + deploy:verify, then boot again.

**Skills read:** site-queue, loop-status, TASTE.md, frontend-design, dataviz, database-canonical-reference, DATA_GRAPHICS.md, ryan-realty SKILL.md.

# Current — 2026-09-09 (Matt's three rulings: remove the empty frame, cut the redundant number blocks, re-measure and continue)

Owner: Claude (Opus 5), session claude-opus5-9d4aa6fc-2026-09-09, main checkout.

**Asked and answered, 2026-09-09.**
1. **The dead Google pane comes out.** Matt turned the Google Field and place Split canvas off on
   2026-09-03 ("the atlas is the map") and the empty pane stayed. Ruling: remove the frame, keep
   Google off, leave the list. The Atlas above it is still the map. Seeded as **SITE-59**.
2. **Cut the redundant number blocks.** The 28-row closed-sales-by-year list on the region page goes
   (the chart two sections above already shows it, at three viewport heights on desktop and five at
   375); the twelve-cell disclosure grid is trimmed to the four or five figures that matter, folded
   into the hero row with their sentences and traces. Recorded on SITE-41, which is in flight. A
   later pass must not restore them.
3. **Re-measure and continue.** After SITE-41 lands, run the instrument across all 25 classes and
   seed the next round from the bottom.

**A finding I answered rather than asked about.** The grey placeholder squares on /oregon/[city]
listing rows (10 of 12 on Medford) are NOT a licensing or opt-out problem: sampled through the DAL,
40 of 40 active Medford listings carry a non-empty PhotoURL, zero are internet opt-out, zero are
non-IDX, and Bend samples identically. The photographs exist and the row does not show them — a
render bug in that template. Filed on SITE-59 beside the empty frame, since both are a box with
nothing in it.

**SITE-41 is mid-flight and its four evaluators already reported** (recorded on the node so nothing
is lost): annual-review 31 → 61 but still a KPI grid, detail still a KPI grid, region 63 → 65 with
its hero chart drawing dots on 2026 and none on 2024 or 2025 — which fails the marker clause
outright — and oregon-city 41 → 52 with Medford and Salem opening byte-for-byte identical, which
fails the place-mark clause. Scores rose everywhere; two accept clauses did not pass, so the lane
was sent back rather than landed.

**Also for a chrome-owning node:** the footer accordion summaries read "Markets26", "Buy · Sell ·
Join9", "Company6", "Contact2" — a bare row count glued to the label, on every page.

# Current — 2026-09-09 (SITE-58: Crook plats ingested; Jefferson publishes none)

Owner: Grok (grok-01a0884a-2026-09-09), main checkout. Push `ea8be553`; deploy
`dpl_DbJGeqPE7ce5WzUBn8EY1kWtcqqb` READY in 280s.

**SITE-58 done.** Crook County GIS `Public/LandGroup/MapServer/7` ("Sudivisions")
is the recorded-plat layer: 211 polygons, 204 new `public.boundaries` subdivision
rows (falcon-ridge, grandridge, west-hills already existed as Deschutes slugs and
were skipped). Brasada Ranch (OBJECTID 186, 888 acres) and Ochoco Pointe
(OBJECTID 8, 59.5 acres, phases 1–4 and South) resolve exact.
`subdivision_footprint` returns `source=exact` with the Crook MultiPolygon.
Live: `/subdivisions/ochoco-pointe` 200, H1 Ochoco Pointe, `boundaryGeojson` is
the Crook polygon. `/subdivisions/brasada-ranch` 308s to `/communities/brasada-ranch`.

**Jefferson publishes no recorded-plat layer.** GIS data is sold; the public web
map is "temporarily unavailable"; `maps.co.jefferson.or.us` timed out; county
REST hosts 302 with no services directory. Haystack Butte (7) and Willowbrook (13)
stay on SITE-56's no-polygon path. Klamath's live catalog has taxlots and
`KC_Surveys` (10,571 survey-document polygons), not a subdivision plat layer.

**Crooked River Ranch.** Not on Crook's 211 names. The spelled-out slug
phase-matches Deschutes plats 4 and 5. MLS `Crr` (13 homes) still has no polygon.

Class list, statewide: 626 none → 592 none. Provenance floor 3200 → 3427
(3,223 Deschutes + 204 Crook). Ingest: `scripts/gis/import-county-subdivisions.mjs`.

**Queue:** SITE-41 in flight (claude-opus5). SITE-43 open, waits on SITE-03
(measurement window to 2026-10-06). Nothing else eligible.

**Skills read:** site-queue, loop-status, database-canonical-reference,
TASTE.md, frontend-design, DATABASE_FOR_AI_AGENTS.md §2a.

# Current — 2026-09-09 (four nodes said done and were not on main; landed, plus SITE-31's eleven guides)

Owner: Claude (Opus 5), session claude-opus5-9d4aa6fc-2026-09-09, main checkout. Pushes
`38e2f6c3` (SITE-31) and `6c648787` (the stranded branch); both deploys READY.

**Read this one first: done is not landed.** SITE-40, SITE-49, SITE-51 and SITE-55 were all
`done` in the work graph with landing commits recorded, and not one of their commits was an
ancestor of `origin/main`. One session built them on `claude/run-loop-w8f3ep`, merged
`origin/main` INTO that branch after every round, and never merged back. 230 files, ~13,900
insertions. SITE-55 made it unmistakable: its migration was applied and populated in
production (`subdivision_plat_unsold_mv`, 7,846 rows) while the site that reads it was not
deployed — **the database had the work and the site did not.** SITE-51 was the costly one:
with `scripts/taste-table.mjs` off main the queue had no measurer, so the taste table was
still the 2026-09-08 baseline while a dozen classes had been rebuilt that day. All four are
now on main, verified live: /price-drops draws the week's cuts (12 svgs in main),
/subdivisions/deschutes-river-woods says "did not sell in Deschutes River Woods" beside 68
closings in 2025 and 57 in 2024, /contact renders V3Quiet's new form. Memory:
`reference_done_is_not_landed`. **Before trusting any node's done, run
`git merge-base --is-ancestor <lane commit> origin/main`.**

**SITE-31 landed the same way** — eleven community guides finished on `wt/site-31-guides`
and released on an idle heartbeat before merging. All eleven are published and live; four
sampled at 200 with their titles. Every title states a number or a decision: "Awbrey Glen: A
$1,349,000 Median and an $87 HOA", "Crosswater Sold Just One Home in the Last 12 Months",
"What $620 a Month Buys You at Mt. Bachelor Village". Blog class 52 → 74.

**Conflict resolutions worth knowing.** Two taste receipts collided. Blog resolved to main's
74/68/77 over the branch's older 52/44/57. Subdivision resolved to main's SITE-56 pass
(72/72/73) over the branch's SITE-55 pass (74/71/76), each with its own shots so the
`shotsHash` still matches disk. **Neither receipt scored the combined subdivision page** —
SITE-55's unsold work and SITE-56's resolver and opening are both live and no evaluator has
seen them together. Re-score before building on that class.

**In flight:** SITE-41 (V3Instrument, this session). SITE-58 (Crook and Jefferson plats) was
taken by a grok session. Nothing else is eligible; SITE-43 waits on SITE-03, which is on a
measurement window to 2026-10-06.

**The finish line is not close.** The taste table lists 25 classes and, on the 2026-09-08
instrument, every one is under 70 — best was 69. Many have been rebuilt since and the table
is stale; now that the measurer is on main, the next round should re-run it and seed from the
bottom rather than from last week's numbers.

# Current — 2026-09-09 (SITE-55: the plat says what did not sell, and names the market it sits in)

Owner: Claude (Opus 5), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, lane commit
`9eb4c1fb`, then main merged through `d5b982e8` (round eight: SITE-48 and SITE-50). Node
`3b4713f8` is `done` with evidence. Earlier on this branch: SITE-45 (`ba0fb159`), SITE-40
(`1ea07155`), SITE-49 (`5d0fa577`) — see Prior. SITE-29 (`e3d1713f`) stays `blocked` until 2026-09-11.

**What shipped.** A plat page could say what sold there and could not say what did not. That half
existed nowhere outside the seller CMA, which reads raw listings per CITY — too coarse to answer
"what happened in MY plat". Now `subdivision_plat_unsold_mv` carries a twelve-month did-not-sell
aggregate per recorded plat, attributed the two ways its closed sibling is (point-in-polygon and MLS
subdivision name, unioned over distinct listing key). The plat page prints it as an `#outcomes`
Quiet between the market report and the sales history, and the expired-seller first-contact letter
prints the same number from the same read.

**Aggregate, not a roll-call — Matt's call, asked before building.** Oregon MLS policy
(`docs/MASTER_SPEC.md` §3.8) holds that Withdrawn, Expired and Cancelled listings may not be
actively marketed and must not appear in search results or active listing feeds, and every existing
use of that data on this site is private (the CRM, the seller valuation). So the plat publishes the
count, the median days those listings ran, and the median cut they took first — market reporting, the
same class of figure as months of supply — and no addresses and no links. The row-level version the
node's accept asks for is recorded on the node with the policy lines, for Matt to rule on.

**Four §0 errors were caught in this lane before any of them reached production, and all four came
from the same habit: trusting one query shape.**

1. **A false clean record.** The first shape of the view emitted a row only where something had
   failed, so a caller reading "no row" read it as "nothing failed" — and the letter published
   *"Every home that came off the market in Diamond Bar Ranch sold"* while two listings had come off
   unsold inside the window (2026-09-01 Withdrawn, 2026-01-21 Canceled). Caught by running §0's
   counter-query. Fixed at the source: the view is now `plat_keys LEFT JOIN failed`, so **a zero is
   measured and a missing row is unmeasured**, and `publishPlatUnsold` says nothing at all when the
   read is null.
2. **A year-3000 row moved the window a millennium.** One production row (ListingKey
   2020022817044797361…, Expired, `off_market_date` 3000-03-31) poisoned a bare `max(off_market_date)`
   anchor and zeroed all ~3,000 plats. The anchor is now bounded by `max("ModificationTimestamp")::date`.
3. **`current_date` in a materialized view** fails `ci:mv-determinism` (F7) for a real reason: every
   row differs on every refresh. The window is anchored to the data instead.
4. **Two populations in one sentence.** The first render read "Over the same stretch 981 sold" —
   lifetime closed against twelve-month failures. Fixing the window exposed the deeper fault: the
   sold figure is the DETACHED segment and the failures count every property type. The comparison was
   cut, not patched.

A fifth, smaller: the clean plat's section vanished after the fix because the 6-hour cache still held
the old `null`. **When a row's MEANING changes, bump the cache key** — `plat-unsold-outcome-v2-covered`.

**Receipt: 65 → 74** (74 · 71 · 76), rebaselined, separate claude-sonnet-5 evaluator, builder Opus 5.
**Mechanical accept 21/21** at 1440 and 375.

**Open on the receipt, for the /subdivisions composition node.** The evaluator's dullest finding is
the wider-market row ("connective filler between two stronger ideas") and its verdict names the
filter panel above it as a register break — "a checkbox-and-slider control panel that could be lifted
from any listing site". Neither is the `#outcomes` section; both belong to the page's own node.

**The merge with round eight.** Main's SITE-48 and SITE-50 rebuilt five of the six pages this
branch's SITE-40 lane had rebuilt, so the merge was read page by page rather than side-picked:

- **/about, /reviews** — main deleted the very sections SITE-40 rebuilt (the `#who` list and the
  `#reach` Quiet) and put the faces, the score and a live reach control in their place. Main's page,
  main's receipt, main's shots. SITE-40's work there is superseded, and said so.
- **/compare** — main's worked example replaces the empty Quiet. SITE-40's lead door and its two
  extra destinations survive on the fallback branch, which is what renders when the sample read
  returns nothing.
- **/invest** — main's Pulse opening and its live 30-year fixed replace the two documentation
  headers. SITE-52's `when` audit (no row repeating "Central Oregon" under an eyebrow that already
  says it) and SITE-40's lead tool door were re-applied on top; `git checkout --theirs` drops
  non-conflicted changes too, which is how they were lost the first time.
- **/contact** — the only true hybrid. Main changed `#reach` and the brokers band; SITE-40 changed
  the intro Quiet. Both are kept, because main's photographs sit below the form and SITE-40's
  principal-broker door with the sourced 5.0 is what puts a face in the fold — the exact defect the
  contact evaluator named.

**The merged /contact fold was scored from scratch, three rounds, because neither committed receipt
described it.** Round one came back **58** — below the 62 this branch had already recorded — so the
merge did not just get committed and called done:

1. The evaluator read the broker row and the office row as "the same component instanced twice". The
   office is now one inline secondary line, which is a different shape and gives the address the full
   measure.
2. The ratio meter under `5.0 of 5` is gone. A 5.0 out of 5 fills the track completely, so the mark
   carried no information; the evaluator could not tell it was a meter at all.
3. `V3Quiet`'s inline label no longer wraps, which had broken "The office" across two lines at 375.

That scored **62** — a tie, not a rise — and named the same dead space twice across two rounds:
~115px of empty cream between the last row and the next section rule, "an artifact of section padding
stacking rather than an intentional editorial pause". It was exactly that. `V3Doors` carries no
padding of its own, so a Quiet's full `--v3-section-pad` was the whole seam. **A Quiet that hands
straight to a Doors band now closes on `--v3-space-xl`**, the same idiom as the existing
`--headless` rule that opens tighter. That pulls the live reach control into the graded viewport at
1440. Round three: **66** (65 · 66 · 68). The rule touches three routes; on `/team/[slug]` the seam
sits at y≈885, outside the first viewport, so no other class's shots move.

**Two defects the merged /contact receipt hands off rather than fixes**, both because they are not
/contact's to fix: the muted body-copy token reads borderline for AA against cream on every public
page, and the shared header chrome is "indistinguishable from a generic listings site" in a crop.

**A rule this branch paid for twice.** Never bind-mount `node_modules` into a worktree an agent can
die in. When the SITE-49 worktree agent hit a session rate limit, harness cleanup reached through the
mount into the main checkout and deleted 164 packages; an `npm install` to repair it rewrote two
pinned ranges in `package.json`. The repair is `git checkout HEAD -- package.json package-lock.json
&& npm ci`. Run lanes in the main tree.

**Next.** The queue serves nothing: two open nodes both wait on held ones (SITE-43 on SITE-03, which
is blocked until 2026-10-06; SITE-58 on SITE-56), and the three in-flight nodes belong to other
sessions. **SITE-56 was deliberately held behind SITE-55 on this same route and the same
`parity.json`; that block is now landed**, and the other session's own finding (Prior, below)
reorders it around a plat resolver rather than the no-polygon fallback. PR #200 stays watched.

**One thing SITE-56's resolver should know before it starts.** The `#outcomes` read this node added
attributes a plat the two ways its closed sibling does — point-in-polygon AND slugified MLS
`SubdivisionName` — and unions them over distinct listing key. That is the same
coarse-MLS-name-against-fine-recorded-plat mismatch the other session measured, met on the same
grain. **Diamond Bar Ranch has no `boundaries` row under the slug the page looks up, and it is
exactly the plat whose false clean record this lane caught**: the by-name branch found its two
unsold listings while a polygon-only read would have found nothing and said so. Whatever resolver
SITE-56 lands should be the one both reads call, not a third attribution.

## Prior — 2026-09-09 (Matt: "there has to be a way to find those missing plats" — most of them were never missing)

Owner: Claude (Opus 5), session claude-fable-9d4aa6fc-2026-09-08, main checkout.

**The answer, measured against live Supabase before anything was built.** Of 1,087 distinct
`SubdivisionName` values on 3,573 active SFR listings: **177** match a recorded plat by exact slug;
**207** have no exact match while recorded plats START WITH the name — the county's own phases and
additions; **77** more have no name match but their homes already carry `boundary_subdivision` from
SITE-23's point-in-polygon classifier; **626** resolve neither way. So **284 of the 910 unmatched
names are recoverable from data already in the table**, with no new source at all. Dry Canyon: 21
homes against 6 recorded phases. Caldera Springs: 31 against 15. Rivers Edge Village: 10 against 24.

**Diamond Bar Ranch, the page Matt read, is the proof.** `public.boundaries` holds four recorded
plats for it (Phase 1, 2, 3, 4 — Deschutes County GIS Subdivisions, layer 4 of
maps.deschutes.org/…/BoundaryFD/MapServer) and its one active listing already carries
`boundary_subdivision = 'Diamond Bar Ranch Phase 1'`. The page opens on cream with two empty frames
because the lookup slugifies the MLS name to `diamond-bar-ranch`, misses the exact slug, and falls
to the no-polygon path. Same coarse-MLS-name-against-fine-recorded-plat mismatch SITE-24 found in
the closed-sale join and SITE-28 found in the display name. **This reorders SITE-56:** the resolver
(exact slug → phase prefix, unioned → the listings' own polygon attribution) comes first, and the
no-polygon fallback becomes the path for what is genuinely unrecorded rather than for a fifth of
the class.

**The 626 that remain are an ingest project, seeded as SITE-58.** Every one of our 3,223 plat
polygons is Deschutes; Crook holds one row, Jefferson and Klamath none. Probed the same day:
Deschutes publishes the Subdivisions layer we already hold in full; the Klamath org we pull taxlots
from (201 services) publishes no equivalent; the Josephine org returned none; two guessed Crook
endpoints 404'd. The endpoints must be found, not guessed, and a hull around listing points is not
a plat boundary. Crook is the one that pays — Brasada Ranch, Ochoco Pointe, Crooked River Ranch.

**Also landed:** SITE-57, the MLS remarks (Matt: "mls descriptions must come back"), live and gated.
SITE-56 is in flight with the finding above as its brief.

## Prior — 2026-09-09 (site queue round eight: SITE-48 and SITE-50 done; SITE-56 claimed and deliberately held)

Owner: Claude (Opus 5), session claude-fable-9d4aa6fc-2026-09-08, main checkout. Pushes
`3423a9fd` (SITE-48) and `7f958d17` (SITE-50); both deploys READY and verified live.

**SITE-48 done.** The four people pages open with proof. /reviews leads with 5.0 and 25 Google
reviews at top 168 and a quote at 366, with the page's own first contact link at 664 — the two
tel: anchors above them are the sitewide header, which I checked rather than assumed. /about opens
on the three portraits with a sourced record line. /team's cards now differ: 7 closings, 3
closings, and 1 home for sale right now — the third is the honest fallback, because no closing is
recorded against that broker and the card says so instead of printing a zero. /contact's primary
door is 143,437 square pixels against three at 55,470, with a live "Open now, until 5:00 pm".
about 31→55, team 39→64, reviews 48→81, contact 49→59.

**Deviation worth knowing:** the accept asked for a live element from SITE-09's response clock. The
lane read it, found the median rests entirely on touches predating the provenance stamp — SITE-09's
own "unproven" condition — and 8 in-hours submits against 2 answered by a person. Neither figure
ships. The live element is the published booking_hours against the Pacific clock instead. Met in
spirit, not literally, and recorded that way.

**SITE-50 done.** /invest's meta-labels are gone, six sourced figures sit in the fold, and the
headline is the finding the data actually supports: **the cash-flow verdict does not ship**,
because the only rent-bearing table is frozen at a 2026-08-03 batch with no refresh cron and an
admin wall — so the page leads with composition (605 of 761 income listings are land, 79.5%),
published only while land is both largest and a majority. /compare opens on four slots, four real
add controls and a sample labelled with the word Sample. The adds are **not** "recently viewed":
nothing records that signed-out, so the lane substituted real listings and said so. It also cut a
false claim — /invest advertised a per-listing rental analysis the orphan sweep had deleted hours
earlier. invest 25→61, compare 29→53.

**SITE-56 is claimed by this session and deliberately not started.** It is Matt's own finding (the
plat page the expired-seller CMA links opens on cream with two blank maps, and at least 265 plats
with live homes have no polygon), but `claude-opus5` is mid-flight on SITE-55 in the same file and
the same parity.json. Two lanes on one route's contract and tasteReview is the merge fight and the
double-score the skill exists to prevent. The claim holds the node; the build waits for SITE-55 to
land. **Whoever takes SITE-56 next: SITE-55 first, then this, in sequence.**

**Queue:** 26 done, 16 blocked on dated windows, 3 in flight elsewhere (SITE-31, SITE-41 on
cloud-grinder; SITE-55 on claude-opus5), SITE-43 waiting on SITE-03. Nothing is blocked on Matt.

## Prior — 2026-09-09 (SITE-49: /price-drops opens with the shape of the week's cuts, and every card carries its own)

Owner: Claude (Opus 5), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, lane commit
`5d0fa577` on main through 52ea5f5e (Matt's two rulings: the out-of-area asks stay, the MLS remarks
are back on the listing page with a gate). Node `1c971ea5` is `done` with evidence. Earlier today on
this branch: SITE-45 (`ba0fb159`, listing opening 77 → 79) and SITE-40 (`1ea07155`, V3Quiet and its
six openings) — see Prior. SITE-29 (`e3d1713f`) stays `blocked` until 2026-09-11.

**What shipped.** The table scored the class 30 and its committed receipt stood at 43, both naming the
same cause: the only data display in the first viewport was a portal card. Now the page opens with the
distribution the count implies — every cut this week as one V3Drawing `strip` above the grid, a mark
per cut at the cut as a percent of the previous ask, smallest to deepest, each giving up its street,
its city, its percent and its dollars to a hover, a tap or the keyboard; the claim names the median and
the deepest. Each card carries a short ink track under its ask, filled to that home's cut as a share of
the deepest on the page. Two primitive fixes came out of the rounds: `V3Drawing` gains `askHint`, so a
figure says what its own marks give up (the default promised a month these marks do not carry), and
`V3SourceLine`'s visible clause is bracket-aware, because it cut at the first comma and a trace that
puts its population in a parenthesis ended the clause on an open bracket — that one fixes every caller.

**The overlap bug the node names first was already fixed** on this tree (the Field's out-of-flow photo
list, `price-drops-field.css`, 2026-09-09). The lane proves it rather than re-fixing it: the accept
measures the alerts sheet's box against every visible card at both widths.

**Receipt: 43 → 71** (71 · 75 · 71), craft 11, no tell, rebaselined, separate claude-sonnet-5 evaluator,
four rounds. **Mechanical accept 14/14** at 1440 and 375: the sheet covers no card; the drawing sits
above the grid with a mark for every row; a mark gives up an address and a percent; the drawing carries
its source line; every card's cut mark differs; no source line is clipped.

**Open on the receipt and the node, for a later pass.** The two instrument shots disagree on the median
cut (5.9% desktop, 5.8% phone): two loads of a LIVE pull minutes apart, each internally consistent,
nothing carried between renders — but a headline figure that moves between captures wants either a
finer read stamp beside the claim or a caption that does not name a moving median. Also: the photo
badge keeps a rounded corner where the register is radius 0; the desktop hover does not mark which dot
it is reading; the phone's source line sits below the fold. Deliberately not fixed: the marks cluster
in the left half at 1440, which is the week's true shape — stretching the axis would draw a spread the
data does not have.

**Answered by main while this lane ran:** the MLS public remarks are back on the listing page as
written, with a gate (62d8731a), which closes the §2 finding SITE-45 recorded; the out-of-area asks
stay (aa5eb85d), which closes the two SITE-33/45 questions on the Medford sidebar and its calculator.

**Next.** The next eligible SITE node under the two-open / three-owner rule. PR #200: green through
0b43bbbe, building on 86e9cf98; the check-in fires 20:20Z.

## Prior — 2026-09-09 (SITE-40: V3Quiet gets one measure, a figure slot with its trace, and doors as a form; six openings pick it up)

Owner: Claude (Opus 5), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, lane commit
`1ea07155` on main through 0ba0358d (merges 21d75e55 and 0b43bbbe carry SITE-42, SITE-46, SITE-53, the
SMS agent and inbox parser on Grok, the CMA first-touch register). Node `ac7b98f8` (SITE-40) is `done`
with evidence; `db6d07a9` (SITE-45) landed earlier today (see Prior). SITE-49 (`1c971ea5`, /price-drops)
is claimed by this session: its worktree agent died on the session rate limit before writing a line, so
the lane runs next in the main tree. SITE-29 (`e3d1713f`) stays `blocked` until 2026-09-11.

**What the table said and what shipped.** The six lowest classes (invest 25, compare 29, about 31,
market-report 41, reviews 48, contact 49) all open on V3Quiet, and the evaluators named the same three
causes: an empty figure column beside every passage, no slot for the live count the page had already
fetched, and N doors as N identical hairline rows. The primitive now: a prose-only item IS the 44rem
measure (one track; the rule stops where the words stop) and splits text | figure only when it has a
figure; `V3QuietFigure { value, unit?, source (required), sourceName?, updatedAt?, ratio? }` on prose
and link items — no trace, no figure (§0); `sourceName` is the visitor-words clause with the trace
behind SITE-42's disclosure; `ratio` draws a thin meter under the value; consecutive doors are one
2-up group with a channel mark derived from the href, `lead` for the dominant door, `media` for a
face or a place in the mark's slot, `weight: 'secondary'` to fold lighter doors into one inline line.
Callers: /invest opens with 762 (the sum of its five segment rows, enumerated in the disclosure); the
market hub's five doors carry marks, sentences and live figures (1,563 · 7 · 5,769 · Sep 5, 2026 ·
4.9) with plain source clauses, two renamed from our IA (Every closed sale, Weekly snapshots); /about
leads with the principal broker's face, the four channels on one line, the 5.0 from 25 Google reviews
with its meter and source; /contact's person door carries the same sourced 5.0.

**Receipts (table instrument, separate claude-sonnet-5, three scorings, median), all rebaselined:**
* invest      25 → 60 (63·54·60), craft 12, no tell
* compare     29 → 42 (42·37·45), craft 10, no tell
* about       31 → 49 (47·49·52), craft 11, no tell — three rounds
* market-report 41 → 54 (51·54·58), craft 10; two tells remain, both the
  chooser's one repeated card shape, which the table assigns to that page's
  composition node
* reviews     48 → 50 (48·55·50), craft 9, no tell
* contact     49 → 62 (62·59·66), craft 11, no tell — four rounds
None of the final receipts names "scrolling lists as the design" or "walls of text". The lane's Opus
worktree agent had no Agent tool, so the coordinator ran every evaluator; the rounds are on each
receipt's evaluator sentence and on the node.

**Found by measuring.** (1) Round one on /about drew the scrolling-lists tell on seven glyph-marked
doors ("an icon card grid"); a face on the person door and a figure on the reviews door did not clear
it (round two, 41); folding the four channels into one inline line did (round three, 49, no tell).
(2) The hub's source clauses derived from the trace's leading segment put "Market Truth region row"
in front of visitors — hence `sourceName`. (3) The lane's mechanical check read `Source:` with a colon;
SITE-42's clause has none. (4) A worktree lane needs `node_modules`: Turbopack refuses a symlink, the
lane bind-mounted the main checkout's, and when the SITE-49 worktree agent died the harness's cleanup
reached through the mount — the main `node_modules` lost 164 packages (`.bin/next` gone, `npm install`
then rewrote two pinned ranges in package.json). Repaired with `npm ci` from the committed lockfile;
both mounts are unmounted. **Rule for the next lane: never bind-mount node_modules into a worktree
an agent can die in; run a lane in the main tree, one writer at a time.** (5) Contact's third pass
read "replies the same day" as an unsourced claim beside a sourced figure — cut (§0), fourth capture.

**Mechanical accept (scratch site40-mechanical.mjs, dev render 1440 and 375): 33/33** — every
prose-only item one track at 704px; no run of identical door siblings longer than one on any route;
the hub chooser 5 of 5 doors with a digit and a source line.

**Matt's calls / composition nodes (not this primitive's).** /compare's full-bleed H1 clips at 1440
and the page shows no populated comparison (SITE-50 waits on this node); /contact's four-cell
`V3Doors` and /reviews' bare `V3Proof` row are the tells that remain on those classes; /invest's
"What this page is" headers; the evaluators want a map on the office door and a sparkline in the
hub's lead door.

**Next.** SITE-49 in the main tree (the brief is written: alerts sheet in flow, a dot strip of the
sixty cuts with a hover reveal, a per-row cut mark, receipt "first"), then the next eligible SITE
node under the two-open / three-owner rule. PR #200: green on 0b43bbbe; this push re-runs it; the
check-in fires 19:04Z.

## Prior — 2026-09-09 (SITE-45: the listing page opens with something to interrogate — one frame and a filmstrip, the price cut as a mark, a read under the pills, Tour in the fold)

Owner: Claude (Fable 5.1), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, lane commit
`ba0fb159`; the landing commit is the merge of main (through 989b2652: SITE-46, SITE-53, the SMS agent
and the inbox parser on Grok) that carries this block. Node `db6d07a9` (SITE-45) is `done` with
evidence. SITE-40 (`ac7b98f8`, V3Quiet: single-measure prose, a figure slot, door rows as a form) is
in flight in an Opus worktree agent off 851c20bc; the coordinator merges it. SITE-29 (`e3d1713f`)
stays `blocked` until 2026-09-11 as shipped-and-measuring.

**What the table said and what shipped.** listing-detail scored 55 on the 2026-09-08 table ("the
conventional real-estate-portal template": a main photo, a 2x2 thumbnail grid, corner pills) and
77 on its committed receipt (the SITE-33 pass). Now:
- `ListingHero` rewritten: one frame plus a navy filmstrip that indexes every photo — a thumb sets
  the frame on desktop and scrolls the snap carousel on phone; 44px thumbs at rest, 88px on hover or
  the strip's toggle; the media tools (N photos, 3D, floor, street view, map) ride the strip instead
  of floating on the picture; at 375 the strip shows the count, one "N photos" tool and one "More"
  control. The mosaic and `publishListingMosaicTiles`/`Thumbs` are deleted.
- `ListingDetailShell heroInMain`: the hero renders in the main column, so the sticky broker card
  and the 5.0 / 25-review block share the fold (Tour bottom 462px at 1440; was under 900). The
  on-media caption is gone — in the column it repeated the price, facts and street sixty pixels
  above the price strip; `check-publish-listing-ask.mjs` now asserts the hero carries no price prop.
- The price cut is a two-point mark (`PriceDropMark`, `publishListingDropMark(history)`: the newest
  dated drop since the last listed row) that opens "$720,180 $714,900 −0.7% Sep 3, 2026" on hover or
  focus. Off-market draws nothing.
- Under the status pills, one sentence from the page's own market comparison
  (`publishListingPillRead`): days listed against the grain's 90-day days-to-contract, this home's
  $/sqft against the 12-month closed median, with a Source disclosure naming both stats and their
  computed date. Null read → no sentence.
- Receipt **77 → 79** (80 · 78 · 79) by a separate claude-sonnet-5 evaluator, rebaselined (ten
  shots: the instrument pair, close, out-of-area, strip and drop hover records); no evaluator names
  the gallery as a portal convention. Mechanical accept 17/17 on a dev render at 1440 and 375.

**Matt's calls, recorded on the node, not implemented.** (1) The MLS public remarks are rendered
nowhere on the listing page since the 12-section rebuild (7c40065e; `DescriptionBlock` was the
renderer and `listing-remainder-contract.test.ts` asserts their absence) while CLAUDE.md §2 "MLS
remarks shown as written" still binds — was the cut deliberate? (2) The Medford sidebar still offers
Tour / Call / Text beside "We don't work in Medford", and the calculator still prices that lot —
both carried from the SITE-33 receipt; the evaluator calls the CTA a blocker. (3) The breadcrumb
reads "Bend / Easton / EASTON COMMERCIAL" on a single-family home: plat alias resolution, the one
tell named on the receipt.

**Findings for the queue.** The listing page's `unstable_cache` entry for the Apollo listing is
2.6 MB; Next refuses it ("items over 2MB can not be cached") and logs an unhandledRejection on
every dev render — the DAL is untouched by this lane, so it is main's. On phones the price strip's
Tour/Call/Text/Save/Share row and the sticky bottom bar can share one viewport (pre-existing).

**Tooling.** `take-route-shots.mjs` `SEL@ANCHOR!hover` frames the anchor on a hover record (the
strip record keeps the frame in the shot). The state name must match the element id:
`outofarea=#out-of-area`, not `outofarea`.

**Next.** Land SITE-40 from the worktree (six receipts rebaselined, mechanical accept, ci:gates, a
Node-trailed commit), then the next eligible SITE node under the two-open / three-owner rule. PR #200:
CI on 851c20bc was green on lint-and-build with e2e running; this push re-runs it.

## Prior — 2026-09-09 (Matt's two rulings: the out-of-area asks stay, and the MLS remarks are back on the listing page)

Owner: Claude (Opus 5), session claude-fable-9d4aa6fc-2026-09-08, main checkout. Push
`b921fff8..aa5eb85d`; deploy dpl_9suRuEtNnFEc51KHwTDiahp9NNT1 READY in 271s.

**Matt, asked and answered, 2026-09-09.** (1) *"Yes keep out of area"* — the Tour, Call, Text and
payment stay on an out-of-area listing beside the honesty block. Out-of-area is not off-market: the
brokerage holds an Oregon licence, the listings are live, and that visitor is the lead the referral
tier exists to catch. No code changed; recorded as §8b of
`docs/plans/PUBLIC_PRODUCT/processes/refer-out-of-area.md` and on SITE-33, so nobody later deletes
the asks to resolve the apparent contradiction with SITE-21. (2) *"mls descriptions must come
back"* — done, SITE-57, live.

**SITE-57 done.** The remarks render again as row 5 of the listing page, under the existing
attribution, as written. Verified on production with a headless browser: for three Active listings
resolved at run time, `document.body.innerText` — the visible text, not the payload — contains
that listing's own first eight words. Before the fix the same check was false and the only text
node holding the phrase sat inside a script tag.

**Why it went missing, because the shape matters more than the fix:** `getListingDetail` kept
selecting `public_remarks` and mapping it to `publicRemarks`; the twelve-section rebuild dropped
the renderer's import; the remainder contract then asserted the renderer's *absence*; the orphan
sweep deleted the component and, as a cascade, the paragraph joiner whose only caller it was. Every
step was locally reasonable and the page carried the listing agent's words into the payload and
showed the visitor none of them. So the answer is a gate, not a comment:
**ci:listing-remarks-rendered** refuses the DAL mapping remarks while the page renders none, a
renderer that skips the joiner (Spark inserts a blank line mid-sentence; a naive split truncates
the first paragraph), and any slice/substring/ellipsis truncation. Proven red on the real 2026-09-09
shape, green once wired, eight fixture cases.

**Fleet:** cloud-grinder on SITE-31 and SITE-41; claude-opus5 on SITE-49; this session on SITE-48
(the people pages) and SITE-50 (/invest and /compare). Nothing is blocked on Matt right now.

## Prior — 2026-09-09 (site queue round seven: SITE-44 and SITE-47 done; the map is no longer a Google default map)

Owner: Claude (Opus 5), session claude-fable-9d4aa6fc-2026-09-08, main checkout. Pushes:
`f98e0f4d` (SITE-44) and `4064f4d7` (SITE-47); both deploys READY.

**SITE-44 done, verified by the orchestrator in a real browser, not from the lane's word.** The
search and zip maps now draw on the navy-on-cream ladder: 13,888 pixels sampled on /homes-for-sale
came back 63.4% #faf8f4, 10.9% #ecebea, 4.1% #102742 with the road greys, and /zip/97702 90.8%
cream — no Google greens, tans or water blues in either. Google's zoom and map-type controls are
gone from both. The claim header reads "500 homes are drawn on this map, from $57K to $8.8M in
Bend." with its source disclosure; 48 cards carry 48 price-per-square-foot marks; the Price, Beds
and Baths chips are 700 against Save-this-search at 500. **Note for the next reader:** the tile
requests carry no `styles=` param (17 and 12 requests, zero) because Maps JS encodes the style in
the tile payload — the param is not the test, the pixels are. search 32 → 75, zip 33 → 60, both
rebaselined. Both baseline files shrank; no dependency added.

**SITE-47 done, and its score went DOWN.** The plat opening now composes one authored sentence per
setting — "That photograph is Three Rivers. River Meadows is one of the subdivisions inside it, and
10 of its homes are for sale right now." / "Park Addition sits inside Old Bend, in Bend, and 3 of
its homes are on the market today." / "Easton, one of Bend's subdivisions, has 20 homes for sale
right now." — all three live and distinct; the Atlas claim and dot key are in the fold via opt-in
props (every other caller byte-identical, proven); a 44px door sits inside the first 900px; and
plat-public-inventory finally carries a readAt, which closes SITE-42's missing as-of date. But the
class scored **65 against a 79 high-water mark** from SITE-42 this morning. It landed because the
node's own bar is 59 and the evaluator explicitly cleared the template verdict, and because a mark
from a different shot set is not a baseline. **That is an open question, not a rounding:** the
spread inside one round was 63 to 74. Re-score before building the next subdivision node.

**Fleet:** cloud-grinder on SITE-31 and SITE-41; claude-opus5 on SITE-40 and SITE-49; this session
on SITE-48 (the people pages). SITE-50 (/invest, /compare) is eligible and unclaimed.

**Still open for Matt:** the out-of-area listing asks (Tour / Call / Text and a payment beside "we
don't work in Medford"); the MLS remarks missing from the listing page since the twelve-section
rebuild (on SITE-45); a hero data graphic for /buy.

## Prior — 2026-09-09 (round four: the first message is in Matt's register, and so is every first touch)

Owner: Claude (Fable 5.1), session 9d18a832, worktree `~/RyanRealty-wt-cma-ship`
(`wt/cma-ship-20260907`). One gated push after this was written — `git log origin/main --oneline -6`.
The directive is in memory `feedback_cma_first_message_register`; his exemplar letter is quoted there.

**What Matt said.** "We're professionals. We're sorry their home didn't sell. This is a big deal. This
is someone's home. We're not going to say, 'Hey, your home came off the market. Here's what we got.'
… You're going to have to adjust that big time in any stuff that comes out from us." Also: no one
says "the ask was", no one says "our desk", "a full report instead of a form letter" is corny, "no
mannered prose allowed on my website", and "you never have to overexplain anything". He kept the
numbers paragraph, the report paragraph, the what-you-get line and the fifteen-minute close from
the earlier draft and asked for his letter and that draft merged.

**Done.** `lib/cma/first-contact.ts` is the merge, one composer for every lane: who we are, why we
wrote (sorry it did not sell / respect for a FSBO / thank you for asking), the numbers off the row
(`comps_count`, the tier every priced sale came from via `salesScopeFromTierCounts` on
`build_summary.comp_selection.final_tier_counts`, the value range, the recommended list, the last
list set against the range only when it sits above, gently), his pricing paragraph
(`CMA_PRICING_PHILOSOPHY`, exported and reused), what the report walks through (the three chapters
the document really has), the ask to earn their business, a sit-down or fifteen minutes on the
phone, the premium-product line, reviews and about, the place page, questions, best of luck.
Subjects are plain ("A market analysis for 2465 7th"). Street only inside sentences (`streetOnly`).
The same register now runs the expired and FSBO text messages (`lib/crm/first-touch-copy.ts` V3
templates, recognized as canonical so the live seed rows compose the new body), the CRM compose
prefill and its seed (`lib/cma/fsbo-cma-templates.ts`, `crm-compose-copy.ts`), and the seller-LP
instant email (`lib/cma-delivery.ts composeCmaEmail`). `scripts/cma-first-message.ts <slug>` or
`--lane fsbo` prints the letter exactly as the rail sends it; the review page "The First Message"
(https://claude.ai/code/artifact/a4f1379b-c4d8-4bba-9274-3138b858ed02) is three real rows printed
by it. Tests: first-contact (17), first-touch-copy (10), fsbo-cma-templates (12), crm-compose-copy,
cma-delivery.compose.

**The subdivision is the loop (Matt 2026-09-09, second directive).** "Show that we are true market
experts by being able to dive into that subdivision they're in, not just the neighborhood… drive
them back to that subdivision page… homes that sold and didn't sell… then the broader picture of
the neighborhood or community… That's the full loop. We need to make sure those links always
work. You can't just have some bullshit link." Done in the letter: the pricing paragraph is
tighter ("the price is everything… pricing low is rarely the danger people think it is");
`lib/cma/first-contact-place.ts` resolves the place BEFORE composing and links a plat page only
when it renders, decided the way the page decides (`app/subdivisions/[slug]/page.tsx`
loadSubdivisionCore: a polygon in `boundaries`, counted registry inventory, or live SFR homes under
the MLS name), with the page's own figures (`getSubdivisionCounts` twelve-month instrument when
published, else `getSubdivisionSalesHistory`: this year to date and the lifetime count since the
first recorded year) and the wider place (Bend neighborhood or city). The letter now reads "In
Diamond Bar Ranch itself, twelve homes have sold so far in 2026, and 367 have closed there since
2005. Our Diamond Bar Ranch page keeps the running picture… The Redmond page shows the wider
market it sits in…" (verified against the live page's own sentences). `scripts/cma-first-message.ts`
fetches every link in the letter and prints `LINK 200 ok` or the refusal shell; all four links on
each of the three review rows are 200 ok. The subdivision page itself does not yet show what did
NOT sell, so the sentence says "what is for sale there and what has sold"; that page work is the
site lane's, seeded as **SITE-55** (loop_work_nodes, open, after SITE-47 on the same route): the
plat-outcomes DAL read, a "What did not sell in {name}" section, a wider-market block with a real
anchor, and the letter sentence updated to "and what did not" when it ships. Not touched: the
subdivision page (SITE-47 is in progress on it).

**Send walk two ran, on the expired and FSBO lanes (2026-09-09).** Requests created through
those lanes' own sources (`expired-listing-cron`, `fsbo-cron`) to harness aliases dana (63427) and
erin (63428): 2465 NE 7th, Redmond (expired, audit **pass**, 5 comps, Diamond Bar Ranch) and
19968 Terrace, Bend (FSBO, audit **review**, 6 comps, Romaine Village). Both built on the intake
kick, both approved and sent from matt@ryan-realty.com over Gmail, both letters carry the system
signature. The CRM has the whole chain per person: `email_out` → `email_click` → a
`return-visit` broker alert. **The walk caught a real defect:** the report button was built from
`NEXT_PUBLIC_SITE_URL`, and `attributeOutbound` only attributes ryan-realty.com links, so on any
host but the apex the button shipped with no `?_pid=` and the recipient met the consent bar
instead of their own report. Pinned to `CMA_DOC_ORIGIN`; re-sent and re-clicked, the recipient
now lands on the full price opinion with 45 tracked in-document links and a comp address opens
its listing page. **The FSBO row is the case for keeping the review gate:** its audit reads
"recommending $461,000 (above every method and both kept adjusted values) is indefensible with
this set" while the kept comps cluster in the low-to-mid $300ks. Auto-send stays OFF; a lane
switch must not be flipped while a row like that can reach a stranger.

**Matt, reading the Diamond Bar Ranch page the letter links: "There's no map… and no photo."**
Verified in a headless render (scratchpad dbr-top2.png): the opening is cream with no photograph,
the atlas is an empty grey frame with a legend, and the split-view Google map paints no tiles.
Cause: no polygon in `boundaries`, so the page renders through the MLS-name path with an atlas
framed around one dot and a poster that is null by design (SITE-08 pass 2 refuses stand-in
photos). At least 265 plain plats with live SFR homes are in this class (511 homes, lower bound,
`scripts/_plats-without-polygons.ts`). Seeded as **SITE-56** in the site lane (open, after
SITE-47): the no-polygon atlas frame, the split-view map painting, and an honest opening image on
every plat. Not touched from this tree.

**"The ask" is gone from what we send.** Matt: "we don't say things like, 'The ask was this.' No one
says that." Every rendered "the ask" is now "the asking price" (or "a price cut"): the public
listing read (`lib/pricing/public-read-copy.ts`, "How the asking price sits against nearby sales",
"Versus the asking price"), the listing close line ("came off the asking price"), the document's
did-not-sell figure and outcome labels (`opinion-pages.ts`, `local-outcomes.ts`), the BPO offer and
history lines, the expired audit fact, and the failed-then-sold citation. Comments and test titles
keep the word; only copy a person reads changed. 25 test files / 452 tests green.

**Open.** (1) Matt has not yet said the words are right; Auto-send for expired and FSBO stays OFF
until he does, then: harness send walk, second walk on the FSBO and expired lanes, flip the
switches for clean documents (audit pass, no review reason, range inside the 8% share). (2) Fixed
in 9b1a0310: the send rail read `brokers.phone`, a column the CMA broker lookup never selects, so
every letter had said "give me a call" with no number; it now reads the published twilio line
through `formatPublishedPhone`, and the rail bolds the street form the letter uses. (3) `subject_address` comes off the MLS
without a street suffix ("2465 7th"). (4) Some rows carry a recommended list outside the value
range (e.g. cma-148728-snuffy-la-pine: range $470k–$497k, recommended $412k); the letter prints
what the row says, so the review gate should catch it before a send. (5) The N=2,000 containment
backtest (before/after) is still running in the background; add the result to
`docs/research/pricing-backtest-containment-2026-09-09.md` when the waiter prints it.

## Prior — 2026-09-09 (SITE-52 + SITE-51: the Ledger past six rows carries a mark, a reveal, one media column and no repeated `when`; the taste table is a tool)

Owner: Claude (Fable 5.1), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, lane commit
`b093f5f7` (SITE-52) merged with the SITE-51 worktree commit `06812977`; the landing commit is the merge of main (through 28a1b3a8) that carries this
block. Nodes `49414e76` (SITE-52) and `2750dd42` (SITE-51) are `done` with evidence.
SITE-29 (`e3d1713f`) stays `blocked` until 2026-09-11 as shipped-and-measuring (see Prior).

**SITE-52, what the evaluator saw and what was true.** The 2026-09-08 table scored /cities 30 and named
`V3Ledger`: no visible bar, nothing to hover, thumbnails on some rows, "OREGON" on every row, the
region's months of supply as a sentence. Three of those were the primitive; two were data defects the
page hid:
1. The page turned the encode off when ONE row lacked a count. Tumalo and Crooked River Ranch have no
   `geo_snapshot_mv` row and no `market_metric` row, went null, printed "None listed now" (null as zero,
   §0), and switched the bars off for all fifteen rows. Production /cities served 0 encoded ledgers.
2. `getDetachedOverlays` read `market_metric` unordered with no limit. PostgREST caps a response at
   1,000 rows: with region + 15 cities the region's latest `active_count` made the cut and its latest
   `months_of_supply` did not, so the region assembled inventory but no headlines and the page lost its
   verdict and its drawing while looking healthy. Traced outside Next with a 16-geo call (rows returned
   = 1,000). Fixed at the DAL: `computed_at` desc, 14-day lookback, range-paged; every caller of the
   overlay read (city pulse, region pulse, snapshots, /sell) gets the same fix.

**What shipped.**
- `V3Ledger`: `encode="bar"` track 8px, context bars navy 45%, the lead at full ink (lead and context
  were one tint); media all-or-none per list — a navy monogram (`.v3-ledger__glyph`, Amboqia initial)
  on every photo-less row once any row has a photo; `reveal` per row (one line + an optional
  twelve-point run drawn by `buildSparkPlot` in `lib/charts/plot.ts`), hidden at rest, shown by
  `:hover`, `:focus-within`, or the phone's 350ms hold (`V3LedgerRevealIsland`, swallows the click
  that would follow, closes on an outside tap), OVERLAYING the top of the next row so nothing moves
  under the cursor; `drawing` slot under the note.
- `/cities`: overlays for the region and every city in one read; a twelve-month run of closed
  detached sales per city (`getPublicDetachedMonthly`, both reads timeboxed); the region's supply pair
  through `buildAnswerFigures` + `V3Drawing`; a null count prints "No live count"; no `when`.
- The `when` audit (Sonnet subagent, 16 caller files): dropped Oregon / Guide / Central Oregon /
  Market / Home / kind labels that repeated their heading; date-or-Guide fallbacks made conditional;
  subdivisions rows carry no `when` (the sentence names the place) and stop printing "Sunriver,
  Sunriver".
- `scripts/take-route-shots.mjs` gains `state=SEL!hover` for hover records. `.v3-btn--text` keeps the
  44px hit box (PR #200's tap-target failure on /cities/bend at 1440: 231×35 → 231×44).
- Spec: PUBLIC_UI.md pattern 3 now states the four rules.

**Measured.** Playwright on the dev render, 1440 and 375: 13 bars with distinct widths, 15 rows = 15
media squares (12 photos + 3 monograms), 0 rows reading "Oregon", the reveal hidden at rest and
visible on hover ("Seller's market · 3.8 months of supply · Closes by month, September 2025 to
August 2026"), the head's two-bar pair with a Source line. Receipts on the table instrument, separate
claude-sonnet-5 evaluator, three scorings each: **cities 75 (75 · 71 · 80) (table mark 30; no tell named)**,
**subdivisions 53 (first mark; cold 36 → 44 after the monogram → 53 after the `when` drop and the bar
caption)**. Rounds and defects are on the receipts.

**SITE-51.** `scripts/taste-table.mjs` + `scripts/lib/taste-table-core.mjs` (Sonnet subagent, 50
unit cases): registry `design_system/public/taste-classes.json` (25 classes), versioned prompt
`taste-evaluator.v1-2026-09-08.md`, scratch captures under `.taste-table/`, three scorings per class,
JSON + the E2E markdown block regenerated between markers, `--diff` with 70-line crossings, the
under-70 candidate list. The subagent's two-class verification run (cities 38, sell 51 on the
pre-SITE-52 page, a webpack dev server) was NOT kept as the table: the 2026-09-08 pass stays the
instrument until a full run replaces it. Flagged, not fixed: `next dev --webpack` cannot compile a
"use client" file that imports the v3 barrel (server-only V3PlaceDocuments enters the client graph).

**Not mine, recorded on the nodes.** Tumalo and Crooked River Ranch have no inventory row anywhere;
whether they stay in `FEATURED_CITY_SLUGS` is a content call. The subdivisions index has no reveal
(no per-plat Market Truth series), is A-to-Z rather than ranked, and its source line sits below the
fold. The evaluators still want a photo for every place and a threshold gauge beside the verdict.

**Next round.** Bottom of the table first: invest 25, compare 29, price-drops 30, about 31,
market-report-annual 31, search 32, zip 33. Run `npm run taste:table <baseUrl>` against a build of
main for the next full pass.

---
## Prior — 2026-09-09 (site queue round six: SITE-53 and SITE-46 done, SITE-32 blocked on its 60-day window)

Owner: Claude (Fable 5.1), session claude-fable-9d4aa6fc-2026-09-08, main checkout. Pushes today
since the last block: `5fb3dadd..773e1454` (SITE-32), `773e1454..93856f85` (SITE-53),
`28a1b3a8..e7c20fdb` (SITE-46); each deploy READY with the sitemap smoke green.

**SITE-53 done.** The place-type Atlas never silently drops (boundary read behind Suspense with a
same-footprint standin; 10/10 loads in and out of the DB window, live and local); a §0 claim
sentence under the H1 ("16 single-family homes for sale in Tetherow, asking $1,350,000 to
$4,250,000."); exactly one display headline; rows and pins linked both ways; crawlable ?sort=
links; 44px zoom. place-type 77, place-type-community 70 (rebaselined; the committed marks had
no instrument). **§0 finding (on SITE-43):** leftover market truth says 658 active Bend
single-family, listing_tile_mv 768; the place-type pages now read one MV for everything. Sunriver
and Brasada Ranch have no trusted polygon and shipped with no map until the standin.

**SITE-46 done.** /buy's Stage carries a navy band with three sourced figures (1,563 houses,
$749,900 median ask, 29 days to an offer) from getMarketPulseRegionSnapshot, the first listing
row breaks the fold at 552px, the CTA is navy; /sell's Stage byte-identical. buy 42 → 60. Two
divergences closed on the way (raw pace 28 vs the destination's 29; a rounded median).

**SITE-32 shipped, blocked until 2026-11-08.** Keep-indexed ruling in MASTER_SPEC §4.9 and one
CLAUDE.md row; the losing text deleted; ci:listing-offmarket-index pins that a listing page's
robots depend on geography and the refusal path only; ListingUnavailable copy corrected. The
60-day GSC-vs-DAL cross is the open clause (before: 6,611 off-market URLs / 26,123 impressions).

**Fleet at the time of writing:** cloud-grinder on SITE-31 and SITE-41; claude-opus5 on SITE-40
and SITE-45; this session on SITE-42 (source-line form, four classes) and SITE-44 (map
cartography). Only SITE-44 was eligible and unclaimed. **Open for Matt:** the out-of-area
listing asks (Tour / Call / Text and the payment beside "we don't work in Medford"); the MLS
remarks missing from the listing page (on SITE-45); a hero data graphic for /buy (variants rule).

## Prior — 2026-09-09 (round three: the first message is drafted for Matt, the parser and the agent are on Grok, the queue is clean)

Owner: Claude (Fable 5.1), session 9d18a832, worktree `~/RyanRealty-wt-cma-ship`
(`wt/cma-ship-20260907`). Commits 3264efb3 (inbox parser on Grok), eca69b97 (agent on Grok);
one gated push after this was written — `git log origin/main --oneline -6`. Matt's answers in
memory `feedback_cma_send_walk_decisions` (round three).

**Auto-send waits on the first message.** Matt: today's letter is "too brief and does not really
follow my voice… it's really important that we nail that first message." The rewrite — expired,
FSBO, seller-valuation, each filled with a real document, plus the brief the composer will
follow and the merge fields — is the artifact "The First Message"
(https://claude.ai/code/artifact/a4f1379b-c4d8-4bba-9274-3138b858ed02). When he approves or
edits it: put the wording into `lib/cma/first-contact.ts` (planFor / offerFor / resourceParagraphs
become the paragraphs on the page; new facts — comps count, comp-area place, the expired ask
exposure — come off `render_args` in `cmaFirstContactFactsFromRow`), keep every number
row-bound (drop the sentence when its fact is missing), rerun the harness walk, and only then
flip the expired and FSBO switches for clean documents (audit pass, no review reason, range
inside the 8% share).

**Done this round.** The lane funnel is live on /admin/cmas ("CMA funnel by lane", wired by
545e4e50 from another session; the earlier "not mounted" note was stale). The 8 zz-test-rebrand
fixtures and the six harness documents are archived. `lib/marketing-brain/inbox-parser.ts` and
the broker SMS agent (`lib/agent/runtime.ts` tool loop, `tools/law.ts` classifier,
`assets.ts` photo grade) run on Grok; verified live as Matt's harness: a Bend inventory question
called the market tool and answered with fetched figures ($0.12), a lead-paint question failed
safe and flagged Matt ($0.19). At ~$0.15 a turn the $3 daily cap is ~20 turns; grok-4.5 would
halve it if he wants more. No Anthropic caller is left outside `lib/ai/anthropic.ts` itself.

**Dropped by Matt.** The usable-acreage GIS measure ("remarks are enough").

**Running.** The containment backtest at N=2,000, before (worktree
`~/RyanRealty-wt-backtest-before` at 63e78f72) and after; `scripts/pricing-backtest.mjs`'s
subject pool now follows N (it was capped at 800 rows whatever N asked). Results go beside
`docs/research/pricing-backtest-containment-2026-09-09.md`.

**Next, in Matt's order:** the first message (on his edits) → the second send walk on the FSBO
and expired lanes → the switches.

## Prior — 2026-09-09 (engine items 3 and 4: the map's own ground and the graded cover; an inbound email advances the CRM)

Owner: Claude (Fable 5.1), session 9d18a832, worktree `~/RyanRealty-wt-cma-ship`
(`wt/cma-ship-20260907`). Commits be982f27 (map ground, cover pick, capped cover line) and the
item-4 commit after it; one gated push after this was written — `git log origin/main --oneline -6`.

**Map (item 3).** `lib/cma/map-ground.ts` draws the ground the site's Atlas draws — TIGER
highways, rivers, lakes, local streets (lib/geo/basemap), the comp-area outline, the search ring,
and the towns — as an SVG data URI in the same Web Mercator view the DOM pins use, so the pins,
the matrices and the print letter are untouched. `fitStaticMapView({ fractional: true })` fits
the pins tight (the Google tile's integer zoom left frames up to twice too wide); MAP_H is 360 so
the immersive stops stretching a 640×400 tile into 16:9. Towns from `data/cma/map-labels.json`
(TIGER place polygons, point-on-surface) and the resort registry; labels nudge around the pins
and a city is never dropped. Google stays as the fallback for a frame outside the basemap tiers.
Concorde, look-pass OK: Bend, Redmond, Tumalo, Sisters, Terrebonne, Prineville, Powell Butte and
the communities named, no logo, "Roads and water: US Census TIGER" in the corner. A taste pass
could still thin the community labels on the west side and darken the Deschutes.

**Cover (item 3).** `lib/cma/cover-photo.ts` grades the MLS hero and the listing's Spark photos
with the Studio vision pass (subject, quality, overlay), one grade in the common case, at most
six, keeps the best exterior (front > aerial > rear > view, clean before overlaid), the home's own
exterior always ahead of the brand frame; provenance on `render_args.coverPhoto`. Concorde kept
its hero (exterior front, 86/100, $0.02); 1617 NW 8th too (78); 2465's only exterior is an
overlaid aerial and it stays. The Spark CDN needs the 26-digit id with `-o.jpg` and refuses
model-side fetchers, so photos are fetched in node as data URLs. The local Spark API token is
invalid (401) — the feed is fail-open, production's token is the sync's. Cover copy: when the
failed-ask cap sits the number under the sales' range the cover says so instead of "worth".

**Inbound email (item 4).** `lib/crm/gmail.ts syncMailboxWindow` now hands every fresh, human
inbound email to `handleInboundReply` (channel 'email'): stage Lead/Nurture → Engaged, running
sequence paused, a "Reply back" task, a broker text — the same four things a text has done since
2026-08-26. `lib/crm/inbound-email-advance.ts` picks one message per person inside the window
and skips robots (out-of-office, bounces, calendar, no-reply senders). Proven on Avery by calling
the handler directly (Nurture → Engaged, task, alert queued) — the Gmail sync itself cannot match
a harness alias because `SELF_DOMAINS` drops our own addresses; the live proof is Matt replying
to a CMA email from mattmryan2@gmail.com (person 18194) and watching the next :09/:24/:39/:54
sync. Reply intent (`lib/crm/reply-intent.ts`) runs on Grok now (grok-4.5 fast, schema-bound),
so the suggested-reply note returns after weeks of "credit balance too low".

**Next.** All four of Matt's engine items are done. Open from before: CmaLaneFunnel not mounted,
8 zz-test-rebrand fixtures in production `cmas`, all four lane Auto-send switches OFF, the
usable-acreage GIS measure, `lib/marketing-brain/inbox-parser.ts` and `lib/agent/*` still call
Anthropic.

## Prior — 2026-09-09 (round two of Matt's calls: the story on Grok, the kick-off asks, Delta 4 rural splits are live)
## Prior — 2026-09-09 (site queue round five: SITE-33 done; the plat-index tap floor; two main-checkout build traps recorded)

Owner: Claude (Fable 5.1), session claude-fable-9d4aa6fc-2026-09-08, main checkout. Push
`d51aa362..e112178f` (lane 11cfbe52 + the tap-floor fix e112178f); deploy READY in 271s, sitemap
smoke green (geo warm 0.3 s).

**SITE-33 done.** Out-of-area listing pages (Medford, Grants Pass, Klamath Falls) carry the
honesty block with a door to /oregon/<city>, serve noindex, follow with the canonical, and leave
the listings sitemap (builder 7,501 → 3,312; production shows the old class until the next warm);
/oregon/[city] stays index, follow (W12.4); Bend listings unchanged. Listing-detail taste
rebaselined at 77 on a widened instrument. **Open for Matt (revenue call, not ruled):** on an
out-of-area listing the sidebar still offers Tour / Call / Text and a monthly payment beside
"we don't work in Medford" — keep the asks or drop to the referral ask alone?

**Two traps in the main checkout, both fixed, both in memory.** (1) node_modules/.bin/.bin was a
self-symlink since Sep 3 and made a local `next build` panic (Turbopack infinite loop); worktree
clones and Vercel never saw it; removed by name. (2) An untracked scratch/audit-social-profiles.ts
with a type error failed the build's type check; moved into scratchpad/ (tsconfig-excluded).
After both, runtime gates on the merged tree: route-smoke 145/145, page-payload OK, tap-targets
0 unexcused everywhere — including the /cities/bend plat-index action SITE-30 had left at 35 px
(the V3Button text variant sets min-height auto; the index action now carries --v3-tap).

**In flight:** SITE-53 (place-type pages) and SITE-32 (off-market index policy, keep-indexed gate),
both this session. Elsewhere: SITE-31, SITE-41 (cloud-grinder). SITE-45 carries the missing MLS
remarks finding.

## Prior — 2026-09-09 (site queue round four: SITE-54 and SITE-30 done, 28 orphans settled; the sitemap classes answer cold under 40 s)
## Prior — 2026-09-09 (round two of Matt's calls: the story on Grok, the kick-off asks, Delta 4 rural splits are live)

Owner: Claude (Fable 5.1), session 9d18a832, worktree `~/RyanRealty-wt-cma-ship`
(`wt/cma-ship-20260907`). Commits d2bc4235 (Grok story + kick-off ask), f13cfd53 (Delta 4),
185baa55 (canonical-key annotation + snapshot), 76173ab8 (the rural search story); pushed as one
gated push after this was written — `git log origin/main --oneline -8` says whether it landed.
Decisions in memory `feedback_cma_send_walk_decisions` (round two) and
`feedback_cma_comp_containment` (Delta 4 status).

**Matt's round-two calls.** Boundary exit stays as shipped (cross under five, disclosed, into
another mapped polygon only). A kick-off onto another contact's open draft ASKS the broker. The
subdivision-story pass moves to Grok. Delta 4: irrigation, zoning class, usable acreage,
outbuildings are all HARD splits.

**Subdivision story on Grok.** `lib/cma/subdivision-story.ts` runs the same prompt and schema
through `generateGrokStructured` (grok-4.6, photos as data URLs, reasoning low). Verified on
Dana's `cma-1531-10th`: three sections in the house voice, $0.21 with photos. The Anthropic key
is no longer read there; the "voice reviewer" an earlier block named was not a separate caller.

**Kick-off asks.** `kickoffCmaCore` returns `needsChoice` + `existingOwnerName` when the open
draft at the address is claimed by someone else (person_id or client email); the sheet offers
"same household, attach" (`attachToExisting`, the D8 attach) or "different owner, new document"
(`buildNewVersion`). `lib/crm/cma-kickoff.int.test.ts` walks both taps.

**Delta 4, built.** `lib/pricing/rural.ts`: `zoningClass` (farm/forest, rural residential, urban,
unknown; the MLS sentinel "********" is unknown), `outbuildingsClass`, `terrainClass` from the
remarks, each split fail-open on an unknown side; both ladders run them on subjects on an acre or
more beside the live irrigation and horse/barn splits. A sale's zone: `lib/pricing/sale-zoning.ts`
→ county GIS zoning layer by coordinates through `public.cma_sale_zone_cache` (migration
20260909150000, applied), nearest first, ≤40 live lookups a build, so the cache fills over
successive builds; the MLS zoning field is the sentinel on 75% of rural closes
(`lib/data/cma/rural-coverage.ts`, a 1,000-row sample: horse_yn set 58%, fencing never, remarks
name an outbuilding 64%). The reader's half: `render_args.compSearch.ruralSentence`, appended to
the search story. Concorde (EFUTRB), second build: "This home sits on farm or forest land (zoned
EFUTRB), and the search read the land as part of the home. Before any price was taken, 80 sales
on rural residential land, 70 sales with a different irrigation or horse setup, and 24 sales with
different outbuildings were set aside." Look-pass OK.

**What Concorde looks like after Delta 4.** 5 sales from citywide-12mo + rural-county-12/24mo,
$1,473,000 capped by the failed ask, the sales' own range $1,550,000–$3,255,000 (the document
says the number is capped below the range and why), three review reasons (dispersion, failed-ask
ceiling, range width). That is the honest shape for an EFU home once rural-residential sales are
out: thin and wide, held for a broker. The count moved between the two builds (61 → 80 zoning
exclusions) because the zone cache filled and more sales could be classed. Usable acreage is
remarks-only: the county slope and wetland layers are empty (lib/cma/county.ts); a GIS measure
needs 3DEP + NWI.

**Merge note.** Two pushes today stopped on `docs/DAL_INDEX.md` conflicts (other sessions
regenerate it). Resolution: take either side, commit the merge, `npm run ci:data-access
-- --refresh`, commit the regenerated docs, then gates and push.

**Next in Matt's order:** cover photo and map → inbound email replies advance the CRM. Still
open: CmaLaneFunnel not mounted, 8 zz-test-rebrand fixtures in production `cmas`, all four lane
Auto-send switches OFF, the usable-acreage GIS measure.

## Prior — 2026-09-09 (SITE-29: place pages and the blog are static shells that revalidate; the node's diagnosis was stale and the real cause was in the client tree)

Owner: Claude (Fable 5.1), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, lane commit
`8dc9b550`, main merged at `07441b9e` (through `a97023d6`), the landing commit is the one carrying this block. Node
`e3d1713f` is `blocked` until 2026-09-11 as shipped-and-measuring: its accept is a production CDN
header and runs only after PR #200 merges and Vercel deploys.

**What the node said, and what was true.** The node blamed a `cookies()` read in
`PlaceSplitView`; that read left on 2026-09-01. Three things actually kept the pages dynamic, each
proven on `next build`'s route table and on `next start`, not by reasoning:
1. All four place pages awaited `searchParams` and threaded it into `PlaceSplitView`. Under Next 16
   without `cacheComponents` that read alone classifies the route dynamic, whatever else is clean.
2. Every client component under the split view called `useSearchParams()` from `next/navigation`.
   Inside a static render Next throws `BailoutToCSRError` from it (`dynamic-rendering.js`, case
   `prerender-legacy`) and React client-renders the tree up to the nearest Suspense boundary, which
   on a place page is `loading.tsx`: the page's static HTML would have been the loading skeleton,
   listing cards and all. Deleting the page-level read would have shipped exactly that.
3. The blog post had two dead cookie awaits and, once those were gone, **no `generateStaticParams`
   at all, which Next never caches** (the route table shows ƒ and `next start` served
   `private, no-store`); the blog index read `?category=`/`?page=` on every hit.

**What shipped (`8dc9b550`).**
- `lib/search/url-search-params.client.tsx`: the query string as a static-safe external store.
  Server render and hydration read `''` on a static shell (or the request's query through
  `UrlSearchParamsProvider`, which `/search` and `/homes-for-sale` now wrap); after hydration the
  store reads `window.location` and one root bridge in `IdentityBridges` keeps it current — that
  bridge holds the only real `useSearchParams()`, inside its own Suspense.
- `SearchFilters`, `MapSearchView`, `AllFiltersSheet`, `SearchAlertCapture`, `SaveSearchButton` read
  the store. Under `staticShell` the URL is laid over the server defaults
  (`components/search/merge-url-search-filters.ts`, geo keys locked on a place), a query change
  refetches the viewport **inside the place's own seed polygon** (`scopePolygon`), and URL writes go
  to `history.pushState` (Next's patched one, so the router syncs) instead of a router round trip.
- `PlaceSplitView` renders the default list; the four place pages drop the read; `/subdivisions`
  goes from `force-dynamic` to `revalidate = 60` (its cause is gone).
- Blog: `[slug]` gets `generateStaticParams` returning `[]` + `revalidate = 300`; `/blog` reads no
  query; category and page views live on `/blog/category/<c>`, `/blog/page/<n>`,
  `/blog/category/<c>/page/<n>` (on-demand ISR, each with its own breadcrumb, noindex as the query
  forms were); `next.config` 308s the old `?category=`/`?page=` forms to them.
- Middleware: unknown blog categories and malformed page numbers are real 404s at the edge
  (`lib/blog/index-path-guard.ts`, the soft-404 class the middleware already kills for `/communities`).
- Held mechanically: `components/search/__tests__/static-shell-url-params.test.ts` (no
  `useSearchParams` under the split view, no request-state read on the place pages, the footprint
  passed to the map); `check-ssg-budget` now lists the four blog routes; `check-seo-authoring`,
  `check-publish-blog-index-list`, `index-ledger-openings`, `seo-route-contracts` and
  `site-contracts` were repointed from the old shapes they encoded (the plat-detail contract
  literally asserted `force-dynamic`).

**Measured on the served build.** `/cities/bend`, `/communities/sunriver`, `/cities/bend/awbrey-butte`:
`Cache-Control: public, s-maxage=60, stale-while-revalidate=600`, `x-nextjs-prerender: 1`, H1 and
13/10/12 h2 in the static HTML, the split view's 48 cards in it. `/subdivisions/ridge-at-eagle-crest`:
MISS then HIT. On the merged build: `/blog` prerendered (served from the cache, `s-maxage=60`, H1 present); `/blog/sunriver-year-round-living-vs-vacation` MISS then HIT with H1 and 11 h2; `/blog/category/Market%20Reports` and `/blog/page/2` MISS then HIT, `noindex, follow`, canonical `/blog`; `/blog?category=Market%20Reports` → 308 `/blog/category/Market%20Reports` (the query is carried along, harmless), `/blog/page/1` and `/blog/category/All` → 308 `/blog`. A missing post, an unknown category or a malformed page number used to stream a hollow 200 (the whole site does, `app/loading.tsx` flushes the shell before a page-body `notFound()`; only `/communities` answers 404, from the middleware's slug allow-list): the blog now does the same at the edge (`lib/blog/index-path-guard.ts`), `/blog/category/Nope`, `/blog/page/0`, `/blog/page/x` are real 404s; a page past the last is still a streamed 200 (the edge cannot know the post count), and `/blog/<missing-post>` still streams a 200 — same class, its own node. Deep links: `/cities/bend?beds=4` on desktop and 375 shows the Beds chip
as "4+ bd", refetches to "215 homes in this map view · Bend · 4+ bd", 48 cards and none under four
beds; a chip change writes `?beds=3` with no document load and refetches ("594+ homes · 3+ bd");
back restores the bare URL and the default list. Receipts: the four classes' records re-captured
against the served build differ from the shots on disk by 0–1% outside live listing and market data
(and the atlas records lose the pointer's hover card, below); shots, hashes and scores unchanged
(city 69, neighborhood 65, community 80, blog 52).

**Two defects found by measuring, both fixed before landing.**
- The first refetch effect seeded its "last fetched" ref from the merged snapshot; on desktop the
  atlas remounts the list after its first camera fit, by which time the store already carried the
  URL, so a deep link updated the chip and never the cards (a Sonnet Playwright pass and my own
  card-level count both caught it; phones refetched, desktop did not). Seeded from the server
  defaults instead: a mount under a filtered URL is a change.
- The refetch first searched the bounding box plus the place's name tag, a different population
  from the seed polygon the server searched (243 vs 215 homes for Bend · 4+ bd). The map now
  carries the place's footprint and keeps it whenever no shape is drawn.

**The shot tool could not pass a hydrated atlas.** `take-route-shots` wheels the page from the
viewport centre; a hydrated V3Atlas under the pointer eats the wheel as a zoom, the loop reads a
stall and gives up, and every anchor below the atlas shot the atlas — on a production server, where
the atlas hydrates before the first wheel (the dev server's late chunk had hidden it). It now parks
the pointer in the top-right corner first. Deliberate side effect: the centre pointer also raised the
atlas hover card ("NEIGHBORHOOD · 98 listings") into every atlas-bearing record on disk; records now
show the page before any pointer intent.

**Known, not this lane's.** The count row hides its figure when the filter-match count equals the
viewport count (`publishSearchCountPair`'s equality rule): `/cities/bend/awbrey-butte?propertyType=Residential`
shows "57 homes" for a moment and then "Bend · Residential"; the mobile sheet still prints the
number. Pre-existing on the dynamic page too (same two queries), worth a node. Three CMA integration
tests (`lib/cma-request.int.test.ts`, `lib/crm/cma-kickoff.int.test.ts`) fail on live
`cma-zztest-clobber` row state; nothing in this lane touches them. A deep-linked filter renders the
default list in the static HTML until hydration — inherent to a static shell; no indexed URL carries
a filter (canonical and sitemap are bare).

**The accept, after deploy.** Twice each with a browser UA: `https://ryan-realty.com/communities/sunriver`,
`/cities/bend`, `/blog`, `/blog/sunriver-year-round-living-vs-vacation` → second response
`cache-control` contains `public` and `s-maxage`, `x-vercel-cache: HIT`; Sunriver's H1 and ≥8 h2;
the post's H1 and ≥8 h2. Also `curl -sI "/blog?category=Market%20Reports"` → 308 to
`/blog/category/Market%20Reports` (check the Location's encoding of the space; Next compiles the
captured query into the path). The exact commands are on the node.

**Lane lessons.** Verify a caching claim on the route table AND on `next start`: the blog post
looked fixed after the cookie reads went and was still `no-store`. The session limit suspended this
lane for four hours mid-build; the tree survived, the claim did not (re-claimed), and the build had
to be restarted — commit before a long build. `useSearchParams` under a static route is a silent
skeleton, not an error: the structural test is the guard.

**Queue at handoff.** Lanes at 12:10Z: SITE-30 and SITE-54 in progress elsewhere; SITE-29 blocked
until 2026-09-11 (deploy + accept). Never run prettier in this repo.

## Prior — 2026-09-09 (SITE-31: eleven community guides as drafts, four titles rewritten live, the blog class's first mark — the flip is Matt's)

Owner: Claude (Fable 5.1), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200, landing at
`c99cf61b`. Node `0bacd965` is `blocked` with NO date: blocked on Matt for one action, below.

**What shipped live now.** The four keyword-stacked titles the node named ("Broken Top Bend Oregon
Golf Community Guide" and the others, taking 20–194 impressions where four claim titles take 8,205)
now state a decision on both the H1 and the `<title>`: "Broken Top in Bend: Is the Golf Membership
Worth It?", "Brasada Ranch: Full-Time Home or Rental? The Costs to Know", "Black Butte Ranch: Costs,
HOA Fees, and Rental Rules", "NW Crossing in Bend: What Walkable Living Costs". Updated on the rows
directly and verified rendering; each seed entry carries the same title AND its live body folded in,
because Broken Top's row had been edited live on 2026-09-07 and `seed-blog-posts.ts` replaces a whole
row on upsert — a reseed would have regressed it. The seed script gained `--only <file>`.

**What is waiting on Matt: eleven guides, seeded as `status: 'draft'`.** One for each registry
community that had none — Juniper Preserve (URL slug stays `pronghorn`), Awbrey Glen, Crosswater,
Widgi Creek, Vandevert Ranch, Three Rivers, Mountain High, Mt Bachelor Village, Inn of the 7th
Mountain, Rivers Edge, Crooked River Ranch — in `scripts/blog-content/community-guides-2026-09.ts`,
rows verified in `blog_posts`. Each meets the node's contract, held by a checker that uses the real
FAQ extractor: a title stating a number or a decision, 9–12 sub-question H2s plus a `Questions`
block (5–7 h3/p pairs → FAQPage) and a `Next step`, 1,600–2,400 words, ≥2 links to the community
page. CLAUDE.md §1 shows copy drafts to Matt before they enter a distribution path, and the blog
skill flips on his go. **The flip:** set `status: 'published'` and `published_at` on the eleven rows
(and in the seed file), then confirm each `/blog/<slug>` returns 200 with FAQPage in its JSON-LD;
the node's 28-day GSC read starts from the last flip.

**§0, stated plainly.** Every market and HOA figure was pulled fresh 2026-09-09 from
`market_metric` (detached, mt-v1) and `get_place_character` (36-month window) mirroring the DAL's
predicates — the DAL itself cannot run under `tsx` because `lib/data/client.ts` imports
`server-only` — and each is stated with its window and n. Every number in every body was traced by
the checker to the fact sheet, the community's provenance-gated content file, or a cited primary
URL; the fact sheet and per-post sources are on the node. What is deliberately NOT there: Crosswater
and Vandevert Ranch publish no price or pace (floors); Mt Bachelor Village and Crooked River Ranch
carry dues only; **Inn of the 7th Mountain and Rivers Edge carry no market or HOA figure at all** —
the graph holds no row for either at any grain (broad counter-query run), and each says so in one
sentence; Three Rivers' blended HOA figure ($25/mo, n=321) was omitted because its own sources say
no single assessment exists across its sub-associations.

**Live gaps found on the way, for their own nodes.**
- **Mountain High's figures live at `geo_type='subdivision'`; `/communities/mountain-high` reads
  `neighborhood` and shows none of them.** Real data, one grain over.
- Inn of the 7th Mountain and Rivers Edge have no boundary and no membership rows; their community
  pages can carry no figure until someone maps them.
- The two "winner" exemplars the node cites (Sunriver 1,362 words, Eagle Crest 1,208) meet none of
  the spec they justify: no Questions block, zero links to their own community page, narrative
  price ranges with no source. They should be brought up to the same contract.

**The blog class had no receipt, so the accept's "rise" had no baseline.** Added
`design_system/ryan-realty/ui_kits/blog/parity.json` (requiredComponents from the page's own
imports; `ci:mockup-parity` and `ci:taste-canon` pass) and a FIRST mark from a separate Sonnet
evaluator on the template rendered on its best-performing post: **52 (52/44/57)**, builder recorded as
the model on the template's last commit (Fable 5.1). Its findings are the next blog round, and they
matter for these eleven: the template has **no apparatus to make a sourced number look sourced** (a
verified figure and an invented one render pixel-identical), the **desktop hero fills more than a
full screen before a word of prose**, nothing in the open fold can be interacted with, and
`ShareButton` is a blocking import that is not visible in the byline row.

**Lane lessons.** Eleven Sonnet writers in parallel worked; the §0 discipline that made it safe
was a per-community fact sheet (`site31-facts.json`) writers could not go outside, plus a checker
that traces every digit — it caught an unsourced "15 minutes", a topic-list title, a derived span
without its math, and, in my own punctuation fix, an entity turned into "CC&Rs;". A writer's
self-report is not a check.

**Queue at handoff.** Lanes: cloud-grinder on SITE-20/21, fable-9d4aa6fc on SITE-24/25 (both
merged on main now). Twenty-one nodes were open at 04:50Z. Never run prettier in this repo.

## Prior — 2026-09-09 (SITE-07 quality pass landed at 448dae9d; the ruled defects are fixed and the score did not rise, and here is why)

Owner: Claude (Fable 5.1), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200.
Main merged in through `00f400b9` (SITE-20, SITE-22, the CMA send). Node `f2cfd7a0` re-blocked to
2026-10-06 with the measurement reason unchanged.

**Matt's ruling (2026-09-09), executed as written.** The calculator shipped and was not touched.
The two defects the 67 pass charged to pre-existing sections were fixed in the primitive each
lives in, not the page:
- **Truncation — `V3Atlas`.** The phone chip row was a hidden-scrollbar horizontal rail with the
  third chip cut mid-word at the viewport edge, and sibling plats sharing a long prefix ellipsized
  to one identical string ("Awbrey Butte Homesite…" six times). Chips WRAP at every width (the
  mobile mandate; decisions.md bans scroll rails), fold behind one "+ N more" chip in the register
  (eight on a phone, twenty-four from 48rem — two rests, two CSS-toggled labels, no media query in
  render), and `stripOwnPrefix` drops the containing place's name so "Homesites Phase Twenty-two"
  reads as itself. Phase WORDS are kept on purpose: stripping them collapses every "Homesites
  Phase …" sibling into one chip. The same strip runs in `placeFigureRows` for the subdivisions
  ledger and a ledger label may wrap.
- **The run — `V3Ledger`.** pulse / walk / magazine had differed by a thumbnail size and a date
  style. Walk is a date-led timeline (calendar tile, one left rule, NO photo — with a photo it was
  the feed row wearing a tile), magazine a card grid (photo on top, lead spanning, detail line in
  body type at every width), pulse stays the feed. Section roots carry `scroll-margin-top`.

**The number, straight.** Separate Sonnet evaluator, rubric v1-2026-09-08, fourteen records
(opening, Atlas, chips folded and open, activity, open houses, guides): **65 (65/59/68) against
the ruled 67 — it did not rise.** A first pass on the same tree scored 64 (64/58/68); the canon
lens's findings between the two (the guides card's detail in the display serif, the walk row still
reading as the feed, eighty chips beside empty cream) were fixed and the evaluator credits each.
Two rounds inside a nine-to-ten point within-call spread, with both ruled defects confirmed fixed
on the pixels by two adversarial lenses and two evaluations, is the finding. The receipt carries
the same-instrument 83 on the file as not comparable (two states) and the 67 as the honest
baseline.

**What holds the number is outside the item, and needs Matt — four decisions on node f2cfd7a0:**
1. `#activity` and `#open-houses` are **Bend-wide sections on a neighborhood page** — every row
   shown is in Bend Riverside, Broken Top, Stone Creek or Wyndemere, none in Awbrey Butte, with no
   disclosure. Honesty scored 6 of 10 on it; "the single biggest credibility problem on the page,
   persisted across two prior review rounds." Filter to the neighborhood's plats with a disclosed
   thin-n fallback, or relabel honestly. This is scope, not craft.
2. The neighborhood **opens on a photo Stage**; PUBLIC_UI's per-destination table specifies
   Instrument first for this grain. The evaluator reads it as a place-rhythm lock break.
3. The chip cloud **carries a sold count it does not encode**; DATA_GRAPHICS names this the
   horizontal-bar case. A sorted bar list with a show-all is a new item.
4. Three sections still **share eyebrow → heading → rows at the section level** with three row
   shapes; the rubric's letter counts three Ledgers in a row. The city page moves `V3Answers`
   between them; the neighborhood could too.

**Also landed, from the lenses.** The builder's `check-tap-targets.mjs` change had let a control
hidden behind a full-size disclosure vouch, unmeasured, for small visible controls site-wide (every
link in the closed phone drawer, every route). The gate now opens the disclosure for one
synchronous measurement, records the control's OWN box, restores before paint; one under 44 once
revealed earns nothing. `scripts/__tests__/check-tap-targets.test.mjs` holds it in real Chromium.
The capture tool waits for the load event so a streamed section is present before a state frames.

**Two lane lessons that cost hours, for the next session.**
- **`npx prettier --write` has no config in this repo** (the formatter is eslint). It rewrote two
  TSX files wholesale — double quotes, semicolons, 1,210 lines — and broke a test that greps source
  literals. Never run prettier here; write in the house style.
- **The account session limit kills a builder mid-report.** The SITE-07 builder hit "session
  limit, resets 3am UTC" after 47 minutes with its work in the tree and no report. Salvage from the
  tree (typecheck, tests, records) beat a rebuild; keep a diff snapshot in the scratchpad before
  long lanes. A claim was also released as stale under three hours once — heartbeat every 30 min.
- **Tool blind spot, unresolved:** `scripts/take-route-shots.mjs` cannot see `#subdivisions` on
  `/cities/bend/mountain-view` though curl serves it and a bare Playwright context confirms it
  exists and is visible after hydration with zero hydration errors. No subdivisions record exists
  in the receipt; the ledger fix is held by unit tests.

**Queue at handoff:** SITE-07 blocked to 2026-10-06. Lanes: `cloud-grinder-2026-09-08-22` on
SITE-20/22 (both now merged on main) and `claude-fable-9d4aa6fc` on SITE-24/25 with live
heartbeats. Do not preempt.

## Prior — 2026-09-08 (SITE-03 shipped on the city grain; the sub-city questions are on the node)

Owner: Claude (Opus 5), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200 at
`95197c9`. `ci:gates` 157/157, `test:unit` 888 files, `tsc` clean cold.

**What shipped.** `V3PlaceDoor`, a new v3 primitive: beside "Bend real estate", a filled
plate reading **"664 detached homes for sale"** that opens `/homes-for-sale/bend`, with the §0
trace collapsed beneath it. One fact, at control size, under the place name. The city page
mounts it; the alerts strip and the market Instrument's own way into the same URL step down to
the outline, so the page has one filled route into inventory and the fold has one filled
control. Count comes off the face the page already publishes (`leftoverHudKpis` →
`publishPlaceFace`); no new read. A real bug fixed in the publisher: `/homes-for-sale/bend/tetherow`
is a legacy-redirect key back to `/communities/tetherow`, so a door there would 301 to itself —
`publishPlaceBrowseHref` now refuses any path middleware would redirect, and the key is untouched
because a live 301 is Matt's call.

**Not the node as written, and the node text needs amending.** The item asks for
"673 homes for sale · 3.9 months · seller's market · 23 days to pending · read Sep 7" from
`market_stats_cache` on three templates. Three verified blockers: §0 (MOS/verdict/DTP are
unpublishable below city grain — `geo-grain-trust.ts` carries the Century West "48.0 MONTHS"
measurement); the five-figure string is the leftover HUD `ci:taste-canon` hard-fails; and
`market_stats_cache` has no months-of-supply column. The item's own accept text asks for a
figure set its own §0 rules forbid.

**City only, by decision; sub-city held, not dropped.** Built, reviewed and reverted. On the
node with evidence: (a) at community grain the door's boundary-membership count can exceed the
destination's City+SubdivisionName count — "10 homes" one click from "7"; (b) neighborhood
counts Active+AUC while city/community count Active only, one label over two populations;
(c) PUBLIC_UI §3 gives the neighborhood an Instrument opening, not a copy of the city door —
one shape at three grains needs Matt; (d) Tetherow can carry no browse door until the 301 is
decided; (e) the community copy block top-anchors above the scrim (white-on-photo measured
2.57:1 on Broken Top) and needs a local scrim before any door lands there; (f) "read through
the Market Truth metric layer" is visitor-facing in seven traces site-wide — one vocabulary
decision, not a per-page edit. The primitive stays grain-aware for the next round.

**Green gates lied, three rounds running.** The first build passed 161/161 gates and 9,493
tests and the page was broken: the wrapper inherited `.v3 { background }` and painted a cream
band across the hero with white text on it at ~1.03:1. Nobody had looked. Adversarial review
then caught, across three rounds: a detached-only count labelled plain "homes for sale" above an
all-types search (R-024, 664 vs 839 on the same `computed_at`); the verdict stated twice; two
filled primaries; Tetherow left with no filled ask; "inside the city boundary" when the writer is
MLS City text; a read date from a different pipeline than its count; "at this grain" and "the
metric layer" in buyer-facing prose; a second filled primary to the identical URL six sections
down; and the numeral raised to the lead size to answer one reviewer, then measured at 55px
against the H1's 27px cap by the next. **Lessons for the loop:** a lane must capture and LOOK
before it reports (make it mechanical: no receipt without the builder's own capture paths); and
one reviewer's fix is the next reviewer's finding — measure both sides of a composition change.

**The instrument, stated plainly.** Separate Sonnet evaluator, three scorings of the eight
re-captured city records: **73 / 68 / 64, median 68**, against 60 on the same model and rubric
before the change. Recorded as a rise, inside a band this instrument spread 5–13 points within one
call today. Its first return carried a factually false defect (it read the outlined alerts button
as filled — measured 84% light fill); challenged with the measurement, it re-examined the pixels,
withdrew it, and re-ran three fresh passes to the same median. **The receipt contract has a hole:**
`scripts/lib/taste-receipt.mjs` counts `shotsHash` among `IDENTITY_KEYS`, so any re-capture forces
`"rebaselined"` and `"rose"` is never recordable across a real change — the rise rule cannot bind
through the gate as written. Proposed fix: identity = evaluatorModel + rubricVersion; shotsHash
binds the score to its files and must *differ* from the prior for a rise claim.

**Queue at handoff.** SITE-03 is mine and should move to `blocked` with `blocked_until` on
landing (the accept needs 28 days of GA4 click-through per `rr_vid`). SITE-07 is live under
`cloud-grinder-2026-09-08-20`; SITE-08 and SITE-12 under `01NESdvn`. Three owners is the cap.
Nothing else is open.

**Still open for Matt, unchanged:** (a) may the alert capture take an `events` override so a
price-drop alert is its own measurable row; (b) is "every new listing, by email" acceptable over
the literal "one email per listing", given the hourly cron batches sends.

## Prior — 2026-09-08 (SITE-04 verified on a legal instrument; the instrument is the finding)

Owner: Claude (Opus 5), session 019RdEm6, branch `claude/run-loop-w8f3ep` → PR #200 at
`ddd8f45`. Main merged in at `9efa2cf` (50 commits, 7 conflicts, each resolved keeping both
sides). `ci:gates` 207/207, `test:unit` 9470 across 887 files.

**The phone alerts bar is repaired and measured.** Round three's compact phone row was a
regression: it clamped the button to 7.5rem — narrower than its own label, so the glyphs ran
past the border on both sides at 43px tall — and hid the line carrying the alert scope and
the unsubscribe while still asking for an email. Smaller and worse. It stacks now: sentence
on the measure, control on its own full-width row, disclosure kept on screen because it is
the promise the button collects against. Measured live: **button 335x44 with its label
inside it**, note 14.4px full cream carrying scope + unsubscribe, bar 164px/20.2%
(neighborhood) and 174px/21.5% (community). The bar height is still an open defect, named by
all three evaluators. CSS trap worth keeping: that media block needs the `.v3` prefix,
because the base rules for the same elements sit later in the file and an unprefixed
override at equal specificity loses on source order — one measurement cycle to find.

**An Opus scoring pass was produced and then discarded, on purpose.** Five passes had scored
the three place classes (city 57, neighborhood 60, community 53, 48 named defects). None of
it could become a receipt: the evaluator ran on `claude-opus-5` and `claude-opus-5` also
built the change. TASTE.md line 155 requires a separate agent on a DIFFERENT model and
`check-taste-canon` enforces it. Three Sonnet evaluators re-scored the identical eight
records per class instead: **city 60 (60/56/61), neighborhood 57 (63/50/57), community 55
(57/51/55)**, 24 named defects, each hashed to the eight records that ship. **No rise is
claimed anywhere** — city and neighborhood drift on `evaluatorModel` and `shotsHash`,
community on `shotsHash` alone.

**THE INSTRUMENT IS THE FINDING, and it changes how the queue's rise rule can work.** Three
independent scorings of the SAME eight files inside ONE evaluator call spread 5 points on
city, 6 on community and **13 on neighborhood**. Across calls it is wider: city ran
78 → 74 → 69 → 57 over four Opus passes today while the code only improved. The last of
those evaluators diagnosed the fall itself as its own rising scrutiny of sections nobody had
touched, not a regression. So: **a difference under roughly 13 points on this instrument is
not evidence about the page**, and "the score must rise" cannot be satisfied by craft work
on one strip while the untouched sections hold the page down. The next process change should
be a defect-closure test (did the named defects close?) or a fixed evaluator seed per class,
not a scalar comparison. Recorded as `instrumentNotes` on all three receipts so it travels
with the number instead of living in a chat.

**Two sessions collided on the same route, and both lanes' work survives.** `main` carried a
Sonnet mark of 60 for community (`510dd47`) scored against that route's TOP and ANSWER
states. It is not overturned on the merits — it looked at a different part of the same page
— but it could not stand as the file's receipt once this branch re-captured the desktop and
mobile records it hashes. Its four defects are carried on the SITE-04 node and its
`answer-*` shots are untouched on disk. Likewise `tokens.css`: two sessions fixed the same
`ci:tap-targets` failure the same day and the auto-merge stacked both rule bodies with
duplicate declarations; reconciled into one rule on the `--v3-tap` token rather than either
side's literal 44px.

**Converged next target** (all three Sonnet evaluators independently, and the Opus pass
agreed): (1) the Atlas chip/plat layer — a duplicate "Highlands Ridge 3", five chips all
reading "Tetherow" separated only by a count, and labels hard-clipped mid-word at the 375
edge with no scroll cue; (2) the market slot must render or collapse — it reserves
~150-250px of hairline-bounded blank announcing it cannot chart, which reads as a failed
load, not a designed empty state; (3) section-shape repetition — adjacent sections share one
eyebrow/heading/claim/figures/source recipe, the stacked-section page the rubric bans by
name. Two of three also named the Atlas H2 rendering sliced under the sticky nav (missing
`scroll-margin-top`, confirmed by pixel crop) and the sticky bar covering the market source
trace mid-sentence.

**Two of the named defects were fixed concurrently on main and need re-verification, not
re-work.** Round 3 (session 01Aubwpa, on main at `9efa2cf`) states that the city chart's
falling year now wears the exception ink and its year labels stop overprinting. Both were
named as defects by evaluators in this round — the city receipt's top defect is the
2023/2024/2025 end labels collapsing into one illegible mark, and the neighborhood receipt
names the missing `--rr-exception` on a real YoY decline. Those records were captured on this
branch at 18:21-18:25Z, before main's fix merged in at 19:0xZ, so the receipts are accurate
about the files they hash and stale about the tree. A next session should re-capture the
market state first and confirm before spending a lane on either.

**Needs its own item, not SITE-04:** the community fold is a "What would your home sell for
in Tetherow?" valuation card over the Stage photo, ahead of any inventory. `PUBLIC_UI.md`
puts the master-plan opening at Stage then Atlas and calls value-my-home chrome outside
`/sell` "wrong-job-chrome" — a canon violation on the fold of a page named for a place.

**Queue state at handoff: nothing is claimable.** No SITE node is `open`. SITE-08 and
SITE-12 are live under session `01NESdvn` (heartbeats 9 and 12 minutes old) — do not
preempt. **SITE-03 and SITE-07 are stranded** on `cloud-grinder-2026-09-08-16` with
heartbeats 164 minutes stale; they pass the 3-hour release at about 19:40Z and are the first
two a next session should take. Nine nodes are `blocked` with `blocked_until` 2026-10-06
(shipped and measuring), which is the correct state, not a stall.

**Open for Matt, unanswered:** (a) may the alert capture take an `events` override so a
price-drop alert is its own measurable row rather than folded into the new-listing row;
(b) is "every new listing, by email" acceptable in place of the literal "one email per
listing", given the hourly cron batches sends.


## Prior — 2026-09-09 (site queue: a sold home stops publishing its asking price; one canonical per listing)

## Prior — 2026-09-09 (site queue round four: SITE-54 and SITE-30 done, 28 orphans settled; the sitemap classes answer cold under 40 s)

Owner: Claude (Fable 5.1), session claude-fable-9d4aa6fc-2026-09-08, main checkout. One push for
the round: `31c64459..e60a791f` (lanes 01667168 and ed5e11f9+3e91c239, the cleanup branch
545e4e50, merges ffee43a6 / 8527c4a9 / the cleanup merge, and the DAL index regen e60a791f).
Deploy dpl_Dbo5rbSWZhg34KkNWUcsq1exisJw READY in 281s. Both Opus lanes died on the session
limit mid-verification and were finished by Sonnet continuations in the SAME worktrees.

**SITE-54 done.** The sitemap no longer pages the 525 MB tile history view (a nightly
subdivision_city_inventory_mv, 6,885 rows, pg_cron 10:56Z, feeds it; getSubdivisionBrowseSlugsByCity
deleted, ~20K statement timeouts a day gone at the source); a second hidden cost was found and
fixed (the city×preset loop rebuilt the ~8 s search matrix ~1,080 times per build); the warmer
runs at :26, outside both refresh windows, and skips with a logged reason while pg_cron job 164
runs (proven live twice); deploy:verify now smokes /sitemap.xml and all five classes with a
browser UA and fails on non-200. Production, cold, right after READY: core 34.9 s, geo 38.9 s
(4,643 entries, carries golf-homes-at-tetherow), content 34.3 s, listings 6.1 s, matrix 34.1 s;
warm geo 0.10 s; the 13:26Z warmer on this SHA logged per-class counts. Open finding on the
node: the matrix class is not deterministic across builds (844 cold, 322 in the warmer's cache,
901 local) — the leg fails closed into a partial under DB load, by design, but the class count
does not say so. The 525 MB all-history MV refreshing every 30 minutes is still the structural
load and needs its own data-plane node.

**SITE-30 done, one clause honest-unmet.** V3PlaceIndex renders the atlas regions as real
anchors (/cities/bend 60, /communities/tetherow 23, from 0 and 1); getAllPublishedBlogRefs
feeds a #reading section on community pages (sunriver, broken-top, brasada-ranch each link
their guide); ids #plats and #reading, no duplicates. /communities/brasada-ranch has 0 plat
anchors because Crook County plats were never digitized into boundaries (verified five ways);
nothing was invented. Taste: city 68 → 74, community 65 → 70, both rebaselined (Opus evaluator
against a Sonnet build; the committed priors were Sonnet-scored on other shots).

**Orphan cleanup (branch chore/dead-code-reachable-exports-20260909).** ci:reachable-exports
already failed on origin/main with 28 orphans from the LP retirement, the CMA ship, the
12-section listing rebuild and the homepage intents commit; 24 deleted with their tests, two
marked entry points (getBoundarySentinelCoverage, publish-public-chart-source), CmaLaneFunnel
wired into /admin/cmas (a tracked "not yet mounted" gap), four gate scripts that read deleted
files by text repointed. **§2 finding, appended to SITE-45:** the MLS public remarks are not
rendered anywhere on the listing page since the 12-section rebuild (DescriptionBlock was the
renderer and nothing replaced it); CLAUDE.md §2 "MLS remarks shown as written" still binds —
Matt's call whether the cut was deliberate.

**In flight:** SITE-33 (out-of-area listing pages: honesty block + noindex,follow per Matt's
ruling, sitemap excludes them) and SITE-53 (place-type pages: the Atlas never silently drops,
a claim sentence, row↔pin linking, 44px zoom), both this session. Elsewhere: SITE-31 and
SITE-41 (cloud-grinder). Eligible after these: SITE-32 (needs SITE-33's listing files clear),
SITE-40, 42, 44, 46, 51, 52, SITE-45 (listing opening; carries the remarks finding).

**Lane lessons this round.** (1) Every lane pair conflicts on the two auto-generated docs;
regenerate once on the merged tree, never hand-merge. (2) A lane brief now says: on a rate
limit, commit a WIP with the trailer first; two lanes lost nothing today because the worktree
held their staged files and a continuation agent in the same worktree finished. (3) A gate that
fails on origin/main blocks every push; check the full chain on origin/main before a round,
not only the lane's path-selected subset.

## Prior — 2026-09-09 (site queue round three: an off-market listing stops selling a home that already sold)

Owner: Claude (Opus 5), cloud "Site queue grinder" routine, session 01DLfMFV. **main is at `650666bb2`.**
SITE-21 shipped and is live. With SITE-20 and SITE-22 earlier in the same run, the listing page no
longer publishes a price nobody paid, on any surface.

**SITE-21.** A Closed or Expired listing showed a mortgage calculator computed on the OLD list price,
a "this home's price sits 32.0% over the Bend median" ask on a dead price, and Tour / Call / Text the
broker cannot fulfil — two contradictory prices for one home on a public page. It now shows the sale
facts, promotes the active-inventory rail and offers a saved-search path. Verified on production
across four statuses **resolved at query time**: Closed and Expired have no payment, no ask, and
**zero listing-built `tel:`/`sms:`**; Pending and Active keep all of it. Closed `SoldOut`, Expired
`OutOfStock`. Pending carries no availability *deliberately* — schema.org has no value meaning "under
contract, not yet sold", and inventing one would publish a claim the record does not support.

**Two more §0 defects, found by RENDERING rather than reading.** The history rail's `Sold` row
published the ASK, not the sale — the change-log event that flips a listing to Closed carries the
then-current list price, so one page could read sold for $827,000 in the header and $849,000 in the
rail. And an **Expired** listing, which never sold, asked "what this one closed at". Both fixed.

**The `tel:`/`sms:` clause cannot be satisfied literally, and the lane said so instead of redefining
it.** `V3Chrome` and `V3Footer` publish the brokerage line on every page and the footer renders
outside `<main>`. The two are cleanly separable: the listing's own controls build from bare digits
(`tel:5417033095`), the chrome from the E.164 constant (`tel:+15417033095`). Off market: 0 and 7. On
market: 7 and 7.

**TASTE: the listing class scored 78 (80/74/78) against a standing 87 from the SAME instrument
(`claude-sonnet-5`, `v1-2026-09-08`). No receipt was written and the 87 stands.** `ci:taste-canon`
would have accepted a `rebaselined` claim, because `shotsHash` drifted — but it drifted only because
this work added shots, and using that to paper over a 9-point fall is laundering. Same call as
SITE-07's neighborhood class the day before, made the same way. **Read the drop carefully:** honesty
scored 9/10 and the evaluator volunteered that the off-market treatment is "genuinely better than
what it replaced". Every lost point is in sections these nodes do not own, and the prior 87 came from
a different evaluator instance over a narrower shot set.

**The best finding is a PRE-EXISTING dead control, and it is one line.** The hero's "N photos" caption
pill does nothing: `ListingHero.tsx:224-228`, `openCaption()`'s `gallery` branch calls
`setMediaTab('photos')` and returns, on a tab that already defaults to `photos` (line 126), while the
`floor` branch beside it calls `setMediaTab` **and** `openGallery(0,'floor')`. Clicking a photo tile
does open the lightbox — only the labelled CTA is dead. Introduced by `71c46099a`, an unrelated CMA
commit. **Not fixed here on purpose**: it is outside both nodes, and this session declined to widen
SITE-07 for *its* pre-existing sections, so widening here would be arbitrary. Recorded with file,
line and remedy. Also unowned and worth a node: `#ask` is a static figure row with no interaction at
all, `#similar` is a plain list, the mobile cookie pill overlaps the sticky CTA bar, and on an Expired
subject the history rail's last price-change row ($120,000) disagrees with the published ask
($119,900) by $100 — a §0 disagreement between two numbers on one page.

**Probe a new gate with a SECOND SPELLING of the defect.** `check-offmarket-listing-cta.mjs` executes
the predicate over the RESO enum (Pending === false is load-bearing), refuses a second status list,
and checks guard **ancestry** rather than a spelling; 21 sandbox cases assert FAIL across fifteen
defect spellings and PASS for two honest re-spellings. This discipline exists because
`ci:listing-canonical-single` was caught earlier the same day passing 10/10 against the same defect
written one character apart.

**Both SITE-20 and SITE-21 are BLOCKED ON MATT**, functional halves shipped and live-verified, taste
rise unmet: accept 78 as the honest mark for the class, or hold for SITE-41 and SITE-52? SITE-07's
neighborhood question (67 vs a standing 83) is still open too — it is the same question twice.

**CORRECTION, and it changes the answer.** An earlier version of that question said to hold "until a
node exists" for the pre-existing defects. Wrong: **the queue already owns them.** SITE-41
(*V3Instrument: the opening is a claim and a drawing, not a KPI grid*) is exactly the static `#ask`
figure row, and SITE-52 (*V3Ledger: a row past six carries a visible mark, hover reveals more*) is
exactly the plain `#similar` list and the city page's five same-shaped sections. Both are v3
**primitives**, so landing them raises every calling class at once rather than one page, and their
prior marks are LOW (annual-review 31, oregon-city 41, `/cities` 30) — so unlike the 87 a genuine
rise is achievable there. **They are the highest-leverage work left in the queue.** Both nodes carry
this reasoning in their evidence.

**Round four was claimed and aborted before it produced anything.** Both lanes died on their first
calls: `You've hit your session limit · resets 8am (UTC)` (HTTP 429). That is the ONE shared account
allowance the skill names. SITE-41 and SITE-52 were released to `open` with `owner_session` null,
verified to have produced no commit, no branch and no worktree content, so the next session takes
them clean. **This session deliberately did not retry** — two other workers were mid-flight, and
re-consuming the allowance is precisely what killed the whole fleet on 2026-09-08.

---

## Prior — 2026-09-09 (site queue round three: SITE-28 done, SITE-23 shipped and blocked on its recrawl window)

Owner: Claude (Fable 5.1), session claude-fable-9d4aa6fc-2026-09-08, main checkout. One push for
the round: `fc77108b..bc7ce4b2` (lanes 5765494e and ef4cbd7d+74860b39, merges c4223b0c and
bc7ce4b2). Deploy READY in 266s. Accept clauses re-run on ryan-realty.com with a browser UA after
READY; observed values on the nodes (`loop status`).

**SITE-28 done.** /communities/prineville-oll, madras-parkpl and prineville-pleasvh refuse
("No community at this address", robots unchanged at noindex, follow); odin-crest-estate and
ponderosa-park-phase-1 keep their real names; tetherow and brasada-ranch index, follow. No recorded
mapping exists for the three slugs (boundaries holds Deschutes plats only; 'oll' has zero listings
under two shapes) and the geometry-majority path was refuted (aspenb → 3 plats, clab → 28, an MLS
area code), so the resolver reads four recorded sources and refuses otherwise; 32 of 1,014
Central Oregon SubdivisionNames are withheld, every one an MLS token. Community-class taste
rebaselined on a three-route instrument: 64 → 68 → 69 (prior 80 scored tetherow alone). Fixed in
the primitives: the no-photo opening's H1/breadcrumb misalignment, grouped door folds in
V3Answers, a source prop on V3Quiet. Open raises on the receipt: dead cream in the plat opening,
#belonging block-level trace, #atlas 26 vs #faq 16–17 (a product decision on which population a
community page publishes), conifa/oww2 resolve unanimously by geometry but wait for a human entry
in data/subdivision-alias-plats.json.

**SITE-23 shipped, blocked on measurement until 2026-10-07.** The defect was data, not the URL
builder: no city polygon for Powell Butte (not a Census place; imported the Powell Butte CCD from
TIGER/Line 2024 County Subdivisions, 144.665 sq mi, reconciles to AREALAND+AREAWATER), and a
classifier that never revisited a row once it took the sentinel (refresh_listing_boundary_tags
batched on boundary_city IS NULL; now re-examines once per change to the boundary set via
boundary_tagged_at). 181 listings reclassified (Powell Butte 180 → 0 under the sentinel; Brasada
111 of 2,297 geocoded now carry the neighborhood); live: the sentinel URL for 220219020 serves the
powell-butte canonical. ci:boundary-provenance city floor 10 → 11. The Search Console re-pull after
the recrawl window is the only open clause (45 sentinel pages, 1,043 impressions, 0 clicks before).

**SITE-54** carries two independent traces now (mine: two 504s and the warmer's statement
timeouts; session 01NESdvn: the 525 MB all-history tile view refreshing every 30 minutes, the 8 s
API statement timeout, the sitemap paging 129K Bend rows). Next lane takes it in the order
01NESdvn wrote: sitemap reads getIndexableSubdivisions, warmer avoids the refresh window, deploy
smoke on every class; the tile-view refresh itself needs a data-plane node.

**Lane lessons this round.** (1) Two lanes regenerating the auto-generated docs conflict on both
files every time; resolve by regenerating once more with `ci:data-access --refresh` on the merged
tree, never by hand. (2) A lane that widens the taste instrument (one route → three) rebaselines
honestly; the number going down is not a regression. (3) A data lane that finds the URL builder
already correct should say so first and keep looking; the residual index was the symptom.

## Prior — 2026-09-09 (fleet full, no lane; SITE-54's 504 traced to the tile view's refresh and an 8-second API timeout)

Owner: Claude (Fable 5.1), session 01NESdvn, main checkout. **Nothing was built or changed in
production this session.** `main` is at `92137b5b5` plus this note. The container restarted after
round 4 landed (`b9da5d2e6`, deploy `dpl_q2yrS6o3G1fHfPwmNpeqpeHxLG7W`, both nodes blocked with
evidence); on return the brief served SITE-29, another session (`claude-opus5-019RdEm6`) claimed it
one minute before I tried, and the claim tool refused a fourth worker — cloud-grinder, 9d4aa6fc and
019RdEm6 all hold live heartbeats. The rule is do not start a lane, so I did not. I hold no claims.

**What I did instead: read-only triage of SITE-54, and the answer is not the sitemap route.** The
full finding, every number sourced, is on the node (objective addendum + evidence). The short
version:

- `listing_tile_mv` is a view over `listing_tile_mv_src`, a **593,525-row, 525 MB** materialized
  view of every listing ever seen. pg_cron refreshes it CONCURRENTLY every 30 minutes; the last 24
  hours of runs total **29,711 s — 8.25 hours of refreshing**, and overnight each run took 13–21
  minutes of its 30-minute slot.
- The API roles run at **`statement_timeout = 8s`** (3s for anon). During a refresh, reads of that
  view die. The biggest single source of statement timeouts on the whole database over 24 hours
  (**19,655**, ten times anything else) is `getSubdivisionBrowseSlugsByCity` paging ~129K Bend rows
  through PostgREST, 12 pages at a time, 6 cities at a time, three retries each — and its only
  caller is `app/sitemap.ts`.
- The hourly warmer starts at :00 and the refresh at :02, so the warmer's per-city loop runs into
  the refresh every hour. Its 06:00Z run on the current deploy logged fetch failures for eight
  cities; the geo class never fills; cold requests hit the 300 s ceiling. `core.xml` 504'd at
  05:39Z and 05:43Z as well, not only `geo.xml`.
- Collateral: PostgREST timeouts ran **2,110 → 3,180 an hour from midnight to 05:00Z**, and the
  Vercel error clusters show the resulting "could not query the database for the schema cache" on
  listing pages, tiles, boundaries, metrics and the blog. The public site degrades for roughly 15
  of every 30 minutes overnight.

**For the lane that takes SITE-54, in order:** (a) `app/sitemap.ts` reads the subdivision set from
`getIndexableSubdivisions` (644 ms, the SITE-24 source) instead of paging the history view;
(b) the warmer must not start inside a refresh window; (c) the deploy smoke on every sitemap class,
per the accept. **Not SITE-54, needs its own data-plane node:** a 525 MB all-history MV refreshed
every 30 minutes is the structural load — the active subset is ~7,835 rows.

**Also carried from round 4, still open:** the wrong `Node:` uuid on `7e2086647` and `b70aafff4`
(the real SITE-12 id ends `-eff3-4763-aeaf-e7f3617a9cb3`; `post-commit` now warns when an id
resolves to no row); listing rows still print the raw MLS "Ridge At Eagle Crest"; the community
`#belonging` block restates $2,052 with no source line.

---

## Prior — 2026-09-09 (site queue round two continued: SITE-25 and SITE-24 done in one push; geo.xml 504s on production, seeded as SITE-54)

Owner: Claude (Fable 5.1), session claude-fable-9d4aa6fc-2026-09-08, main checkout. One push for
the round: `00f400b9..2a2a4220` (lanes 446d9567 and 603c3c22+d739ac3d, merges, and the follow-up
2a2a4220). Deploy dpl_9QqeGLbq9DugvMjmnk1M6G8AunRA READY in 247s (SSG 756 pages, 21 rail
timeouts during static generation; the previous deploy had 0). Every accept clause was re-run
against ryan-realty.com with a browser UA after READY; observed values are on the nodes.

**SITE-25 done.** pageMetadata never cuts a title; the 29-char registry-name budget is enforced by
check-content-metadata (counts the suffix, covers parks, shrink-only baseline of 12 names); the
four registries (parks, trails, events, venues) lead their description with the blurb's opening
sentence, no brokerage tail, "Central Oregon" once in the title; noindex now emits
"noindex, follow" (8 pageMetadata callers moved; the /lp pages never used it); the plat city has a
fourth source, the county plat tree (getPlatBoundaryCity walks boundaries.parent_id, 2,491 of 3,223
plats carry one), so courtyard-garages-at-broken-top names Bend with zero listings; a plat name that
already ends in its city no longer doubles it in the title.

**SITE-24 done, five of six.** subdivision_plat_closed_mv (applied and populated, 3,086 rows,
nightly pg_cron 10:20Z) attributes lifetime closes to a recorded plat by point-in-polygon unioned
with the MLS-name join over distinct listing_key; getIndexableSubdivisions reads it (2,486 plats,
644 ms cold against ~100 s). golf-homes-at-tetherow 107, tennis-tracts 110, golf-tracts 54,
rock-ridge 32 now index,follow with the lifetime figure and its §0 trace; outcrop keeps its index
(20 = 8 polygon + 20 name). ridge-at-broken-top has 8 (< 10) and courtyard-garages is a 0.0003 sq
mi tract with no sale inside it: both stay noindex and the floor did not move. Taste: subdivision
class 61 → 74 → 77, rebaselined (different plat, six shots). Raised, not fixed: ~15 surfaces call a
PropertyType 'A' set "single-family" (§0 mixed bucket, one cross-surface decision); no hero photo
for golf-homes-at-tetherow (a registry alias asserts membership and scopes CMA comps, Matt's call).

**Found on production and seeded as SITE-54.** /sitemaps/geo.xml returned 504 "Task timed out
after 300 seconds" on two consecutive cold requests (05:18Z, ~05:24Z, cache MISS). The route builds
the whole ~10.7K-URL universe per class; the repo records the cold cost at 106–235 s with a prior
280 s failure, so this is drift past the ceiling, not a new join (the plat read got cheaper). While
it 504s the place tree has no sitemap. SITE-54 carries the objective and the accept; the hourly
warmer's 06:00Z/07:00Z runs on this deploy are the first thing to read.

**Lanes in flight at the time of writing:** SITE-28 (compound community slugs get the plat's real
name or refuse; community-class taste pass) and SITE-23 (Brasada Ranch under the outside-boundaries
sentinel; polygon coverage), both this session. Elsewhere: SITE-20/21 (cloud-grinder),
SITE-31 (claude-opus5). Round three (SITE-40..53) was seeded by another session from the taste table.

**Lane lessons this round.** (1) A lane that dies on a rate limit leaves staged, uncommitted work
in its worktree; a continuation agent in the SAME worktree (no new isolation) with the exact
inherited state finished it, and lanes now commit a WIP with the trailer before anything else when
a limit hits. (2) The seed file had grown past the number I grepped for: check
`grep versionGap:` for the highest gap before appending, and the seed skips an existing gap rather
than overwriting it (no damage, but the entry was renumbered to SITE-54). (3) Two lanes on one
route file merged clean when each kept to its own region and the brief named the other's region.

## Prior — 2026-09-09 (site queue: a sold home stops publishing its asking price; one canonical per listing)

Owner: Claude (Opus 5), cloud "Site queue grinder" routine, session 01DLfMFV. **main is at `8bef8ddde`.**
Three SITE nodes moved this run: SITE-07 shipped and live, SITE-22 DONE, SITE-20 shipped and
live-verified but deliberately left OPEN. Four pushes, each gated, each live-checked.

**The one that mattered: SITE-20, a §0 defect that was live under a principal broker's licence.**
Every Closed listing published its LIST price as the headline of its search snippet, its share
card and its RealEstateListing JSON-LD — and because `buildOffer` correctly drops the Offer for a
sold home, dropping it also dropped the only machine-readable statement that the home had sold.
55550 Heidi Court published $1,250,000 against an $1,100,000 sale; 1117 Peco Road published
$1,199,000 against $1,000,000. 1,282 of 1,708 comparable Closed rows have ListPrice != ClosePrice.
`lib/listing/publish-listing-published-price.ts` is now the one publisher for every surface, and it
REFUSES to fall back from a missing ClosePrice to the ask — that fallback is the defect, so it may
not come back as error handling. Pending stays unmapped in schema availability because schema.org
has no value meaning "under contract, not yet sold" and inventing one publishes a claim the record
does not support.

**SITE-22 is done.** One listing could be reached at four URLs, each self-canonical: 2,363 of 8,724
listing ids at more than one URL, 47.7% of listing-class impressions. There is now ONE builder —
`listingTileHref` / `listingCanonicalHref`, both through `listingDetailPath` — making the canonical,
the sitemap row and every internal href. Eight of eight production variants (including an invented
`/portland/` path and an `/na/` segment) resolve to the one canonical; `/cities/bend` went from 8
raw-ListingKey hrefs to 0. Harm was index fragmentation, not clicks — do not read a rank change into it.

**The container restarted mid-round and killed the build lane. Read this before trusting a lane.**
SITE-20 survived as a commit. SITE-22 survived as 44 files STAGED AND NEVER EXECUTED — no test, no
gate, no live assertion had ever run against them. Replaying that work found three things the lane
never saw: two contract tests that demanded a DIRECT `listingDetailPath(` call and so failed the
refactor that fixes what they guard, and `ci:listing-figure-publish` rejecting the sold-price
publisher for the same reason. All three were legitimate to update — each now asserts the shared
builder, whose OUTPUT is pinned by seventeen behavioural assertions in `lib/slug.test.ts`, which is
a stronger contract than grepping one file. Nothing landed on the strength of a diff looking right.

**A gate held the spelling it was tested against, not the defect.** SITE-22's accept requires the new
`ci:listing-canonical-single` to FAIL when the by-address override returns. It does. But probed with
the same defect one character apart — `base.alternates = { canonical }` instead of
`alternates: { canonical }` — it passed 10/10. Hardened in `8bef8ddde` and re-probed three ways
(clean 10/10, historical override FAILs, assignment form FAILs). **Worth generalising: when you add a
gate, probe it with a second spelling of the same defect before you believe it.**

**SITE-20 is OPEN, not done, and that is deliberate.** Everything functional is shipped and verified on
production against a pre-fix baseline captured BEFORE the deploy (all four listings publish Sold + the
exact ClosePrice, `schema.org/SoldOut`, still no offers node; Active listings resolved at query time
still publish list price, InStock, a real offer). What is NOT done is its taste half: the listing-detail
evaluator rising above **87** on the same instrument. That pass was not run and nothing claims it. A
future session owes only that.

**A question is still with Matt from SITE-07** (place-page affordability instrument, live on
`/cities/bend`, `/cities/redmond`, `/cities/bend/awbrey-butte`). The city class rebaselined honestly at
65 — the prior 67 was grok-4.6 with no rubric version and no shots hash, so all three identity keys
drift. The neighborhood class scored **67 against a standing 83 from the same evaluator model and the
same rubric**. Only `shotsHash` differed, and only because the change added shots. `ci:taste-canon`
would have ACCEPTED a "rebaselined" claim on that key alone; writing one would have laundered a
16-point fall past a gate that reads three keys, so the 83 stands and the rise is recorded as unmet.
The evaluator found ZERO defects in the new section and called it the best thing on both page classes —
every point lost belongs to sections SITE-07 does not own (the city FAQ is the weaker of two builds of
one component and carries no per-answer source line; five consecutive sections share one shape; the
property-type tiles are a KPI grid; the neighborhood subdivision grid repeats indistinguishable
truncated labels, which is information loss). **Accept 67 as the honest mark for that class, or hold
SITE-07 until a node fixes those sections?**

**Two traps that cost this run real time.**
1. **A count taken from an unchecked response is not a measurement.** The first production pass on
   SITE-22 reported failures and once made SITE-20 look like it had regressed off production. Several
   of those reads were failed fetches (`http 000`) whose empty bodies `grep -c` happily counted as
   zero. Check the status code before you parse the body; every figure recorded on these nodes comes
   from a confirmed 200.
2. **`next dev --webpack` and `next build --webpack` both fail in a worktree on this repo, on main,
   before any change** — `getPlaceDocuments` reaches the client graph through the v3 barrel via
   `V3PlaceDocuments` and webpack errors on `next/headers`. The fix is NOT the flag:
   `cp -al <main>/node_modules ./node_modules` (hardlinks, seconds) makes Turbopack's workspace-root
   inference succeed. A bare symlink is rejected. **`.claude/skills/site-queue/SKILL.md` still tells
   every cloud lane to use `--webpack`; that line is wrong in a worktree and should be corrected.**
   Also: `npm run ci:runtime-gates` times out against a healthy server because its `wait-on` uses
   axios, which `middleware.ts` 403s; `scripts/run-runtime-gates.sh` on main is the working path.

**Queue.** 43 items, 23 open. SITE-22 done. SITE-20 open (taste only). SITE-07 was claimed by another
session after this run released it. Fleet discipline held throughout: never more than three workers.

---

## Prior — 2026-09-09 (the CMA send walked end to end on the email harness; the intake stops taking over other people's drafts)

Owner: Claude (Fable 5.1), session 9d18a832, worktree `~/RyanRealty-wt-cma-ship`
(`wt/cma-ship-20260907`). Commit 021e0e9a, merged with main at 31eef8d8, gated push in flight
when this was written — `git log origin/main --oneline -3` says whether it landed.

**What Matt asked.** "Work through the full send of CMAs to some of the aliases, then open and
click, ensure tracking works and that the CMA delivery shows up under the lead. Walk the process
and improve it. Tweak the email with a custom email."

**What was walked, on production, as Matt.** Three seller-LP requests for the harness aliases
(`scripts/_cma-harness-requests.ts`): Avery → 2465 NE 7th Redmond (new row
`cma-2465-ne-7th-redmond-97756`), Blake → 1617 NW 8th Bend, Casey → 19968 Terrace Bend. Two
documents sent from `/admin/cmas/<slug>` with a broker-typed subject and body (Send now), read
back from the marketing@ inbox over DWD (`scripts/_cma-harness-inbox.ts`), the report link
opened in a fresh headless profile (`scripts/_cma-harness-click.ts`, never the admin's browser —
`?_pid` would stitch Matt's visitor id to the alias). Verified for both Avery and Blake:
`cmas.status=delivered`; `email_events` sent (transport gmail) and click, keyed `cma:<slug>`;
`crm_timeline` email_out → email_click → "Broker alert queued (return-visit)"; `visitor_events`
page_view `client-document` on `/cma/<slug>`; `visitor_identity_map` row for the new rr_vid with
`identify_source=email_click_pid`; the review page's "What happened" panel (Sent, Clicked, Visited
· 3×) and the lead page `/admin/people/63297` ("CMA sent … Clicked · on the site after"). Blake's
went out on the versioned slug `cma-1617-nw-8th--v2`, so the `--vN` path delivers and tracks.
"Opened —" is expected on the panel: the headless reader loads no pixel.

**The defect the walk found, fixed in 021e0e9a.** Blake's and Casey's requests landed on OTHER
PEOPLE's open drafts — `cma-1617-nw-8th` was Merle Lookabaugh's asked-unsent draft, `cma-19968`
was Rob Voth's hot FSBO draft (person 63676). The intake's "open draft → refresh contact fields"
rule rewrote their client name and email to the alias while `person_id` (stamped only when null)
kept the first person: one document, two people, the send would have gone to the second while
the events landed on the first. The cma-build-worker had already rebuilt 1617 under Blake's name
and was mid-build on 19968 (killed by hand, action 43e20378). Both rows were restored from the
original action payloads and Merle's rebuilt on the current engine; Rob's build never wrote.
Fix: `resolveWritableCmaSlot(baseSlug, requester?)` — an open draft claimed by someone else
(person id or email) is stepped past to `--vN` exactly like a protected document; unclaimed
drafts and the same person's drafts behave as before; callers with no identity (admin rebuild,
prospecting, CLI) keep the old rule. Intake, the contact-card CMA, and the CRM kick-off pass
identity. `lib/cma/versions.owner.test.ts` locks it. Re-running the requests through the fix
produced `cma-1617-nw-8th--v2` and `cma-19968--v2` for the aliases, both look-pass OK.

**Email fixes in the same commit.** The review page preview of a custom email showed no report
link while the send appended one — `lib/cma/report-button.ts` is now the one source for the
READ THE FULL REPORT button, used by `lib/cma/send.ts` (both branches) and prepended to the
review page's `signatureHtml`. A custom note's preheader is its own first sentence, not the
composed line it replaced. "the sales that set it" → "the sales behind it" in the first-contact
copy and the inbound packet ("set" is on the CMA's banned list).

**Seen on the walk, not changed (Matt's call or by design).**
- `/cma/<slug>` is the Google sign-in door (Matt 2026-08-05, `lib/cma/register-gate.ts`): the
  lead reads the attached PDF freely; the web report and its tracked address links sit behind
  "Continue with Google". The tracked click and the door's page view both record; a headless
  reader cannot pass the door, so in-document taps were verified from the admin render only.
- The build worker runs at :14 and :44 (`vercel.json`); a seller-LP request can wait 29 minutes
  for its draft. Avery's built in 26s only because the request landed at :43. Kicking the worker
  from the intake (`after()` fetch with the cron secret) would close that; not built.
- "What happened" on the review page lagged one reload behind the click (60-second
  `unstable_cache` on `cma:engagement`); the second load was right.
- After Send now the review page auto-advances to the next ready document in the lane; it landed
  on Merle's real draft. Correct product behavior, and the reason every harness send must be read
  twice before the click.
- `cma-19968--v2` (Casey) is `review` severity (audit findings; the document prints "under broker
  review") and was not sent. `cma-1617-nw-8th--v2` (Blake) carries a $699,000–$932,000 range
  around $816,000 — wide; the engine's number, left as is for this walk.

**Not done from the mission list** (unchanged from the previous block): containment ladder
(subdivision → adjacent subdivisions inside the neighborhood/community to 12 months → out), Delta
4 rural-property factors, cover photo, subdivision-story/voice-reviewer Anthropic calls, inbound
email replies not advancing the CRM, D21 price-tier fallback, CmaLaneFunnel not mounted, the 8
zz-test-rebrand fixtures in production `cmas`, all four lane Auto-send switches OFF.

## Prior — 2026-09-09 (site queue round two: SITE-26 and SITE-27 done in one push; the BPO contract forwards the subject type again)

Owner: Claude (Fable 5.1), session claude-fable-9d4aa6fc-2026-09-08, main checkout. One push for
the ship class: `467825cf..78e9cf5c` (lane commits d173fab0 and a5cd7001, merges 7ff9ce9b and
ec52e202, fixes c4c362de and 78e9cf5c). Deploy dpl_GfVj83JGChKRKSogwso31ZZQesJk READY in 271s,
756 SSG pages, 0 rail timeouts. Every accept clause was re-run against ryan-realty.com with a
browser UA after READY; the observed values are on the nodes (`loop status`).

**SITE-26 done.** Both report families go through pageMetadata (one "Ryan Realty" in the title,
figures in the description from the same React cache()-shared read the body renders);
canonicalLiveUrl deleted, so the sales page's BreadcrumbList and Dataset point at the real route;
the housing-market head is built from the Dataset's own variableMeasured (the snippet cannot
disagree with the JSON-LD; verdict from lib/market/classify); unknown geo is noindexed in
generateMetadata (still HTTP 200: app/loading.tsx streams the shell, a real 404 needs an edge
rule); weekly report dates formatted, title 63 chars. New gate `ci:title-brand-once` (AST,
scripts/check-title-brand-once.mjs) with a shrink-only baseline of 8 pre-existing double-brand
titles: app/sign/[token], app/blog/[slug], app/compare, app/our-homes, app/reviews,
app/marketing/request, app/cma-drafts/[id], app/admin/access-denied.

**SITE-27 done.** middleware.ts: single-segment /open-houses/<slug> and /homes-for-sale/<slug>
that are not Central Oregon cities 308 to /oregon/<slug>; presets exempt; a registry resort
community or city-prefixed community slug hops to /communities/<slug> instead (before this,
/homes-for-sale/tetherow served an indexable phantom "Homes for Sale in tetherow"). Hub
description carries the live count and dates (57, Sep 8 through Sep 14, same read as the
figure). A city with no open house in the window is noindex (culver, metolius today; it flips
back when one lands, which is why the "metolius index, follow" accept clause could not hold on
the same day, recorded on the node). New gate `ci:city-route-guard`
(scripts/check-city-route-guard.mjs): every page reaching getCityFromSlug needs the allowlist
test, a dynamicParams=false pin, or a middleware rule; 3 routes guarded. Traffic: none recovered
by design (2 clicks in 90 days on the class; out-of-area pages outranked in-market ones).

**Found on main and fixed (not a site node).** 573e9b32 made the shared accuracy contract fail
closed when the subject's type is unstored; lib/cma/build.ts already forwarded subjectSubType,
lib/bpo/build.ts never did, so every BPO forced review and lib/bpo/contract.test.ts was red on
origin/main (467825cf). c4c362de forwards subject.propertySubType from the BPO build and locks
the unstored case with a test. The merge commit ec52e202 skipped hooks for exactly that reason;
c4c362de and 78e9cf5c ran the full suite (903 files green).

**Queue after this round:** open and eligible SITE-23, 24, 25, 28, 29, 30, 31; SITE-21 waits on
SITE-20; SITE-32 waits on 20, 22, 25; SITE-33 waits on 25. In progress elsewhere at the time of
writing: SITE-03 (claude-opus5-019RdEm6), SITE-20 and SITE-22 (cloud-grinder-2026-09-08-22).

**Lane lessons this round (for the next brief).** (1) Two lanes editing `ci:gates:chain` in
package.json conflict on one line; the union is the resolution. (2) `PORT=<n> npm run
ci:runtime-gates` cannot honour PORT because `start:ci` pins `next start -p 3000`; both lanes
ran the three gates by hand against their own port. Worth a node. (3) `next dev --webpack` 500s
in this tree (app/_v3/HomeFeaturedCommunity.client.tsx pulls next/headers through the v3
barrel); Turbopack works in a worktree whose node_modules is an APFS clone, not a symlink.
(4) A shell function named `head` shadows the binary and recurses; name probe helpers
distinctly. (5) `git worktree add` of origin/main plus a node_modules symlink is enough to run
one vitest file at a given SHA (used to prove the BPO test was red before this round).

## Prior — 2026-09-08 PM (round four closed: A–F shipped, the contract fails closed on type)

Owner: Claude (Fable). Integration branch `wt/cma-ship-20260907` → main. Blueprint, four
evaluator rounds, and the round-four audit: `docs/plans/CMA_REIMAGINED_2026-09-07.md`.

**Shipped this pass (all on main, deploy verified, 2465 rebuilt on the shipped code):**
- A. `pricing.sellerNet` itemised: list, each cost line with its source, net ≤ list, and a
  sentence naming what is NOT included (commission is never silently zero). The sentence now
  states the count when the median across reporting sales is $0 while some gave one.
- B. `expiredAudit.askExposure`: chapter 1 reads the ask that ran the clock ("It asked
  $475,000 for 152 days, then $460,000 for 35", 7.2 percent above the range top). A stale
  cycle (>12 months) never feeds the story; an owner asking below the range never gets the
  overpricing story. An ask above the sales that sat is the overpricing story; only an ask
  inside or below the range earns "points at something other than the number."
- C. `pricing.review.severity` + `rendererNotice`: a review band on the letter AND the
  immersive, not only the admin route.
- D. `subjectStatus`: an active listing with another brokerage gets no solicitation and the
  non-solicitation sentence; a Withdrawn subject carries the non-interference sentence.
- E. One list ceiling (every tier ≤ `clamp.after`, never the failed ask); the worth range is
  the kept set only (a set-aside sale can never be an axis end); `render_args.compSearch`
  drives a search sentence the grid cannot refute; kept-set n is one number everywhere;
  measures labelled (index = every home sale in the city per $/sqft, month line =
  single-family sale price); no stale "listed $140,000".
- F. One scale on the worth strip; a place polygon that holds neither subject nor sale is
  suppressed.
- Contract: `product-type-match` fails CLOSED when the subject's type is unstored (review,
  not a pass). Matt 2026-09-08: apples to apples only, on every rung.

**Matt's two rules from today (memory `feedback_cma_comp_containment`):** comps never leave
the neighborhood or community boundary until it is exhausted to 12 months (subdivision →
adjacent subdivisions inside the boundary → then out); same property type on every rung. The
ladder change is the next engine item and is NOT built yet — see the previous block for the
tier order and the data to confirm first.

**Matt's third rule today (memory `feedback_cma_comp_containment`, in build on
`wt/cma-engine-20260907` as R2h):** unsold peers (Expired/Withdrawn/Canceled) come from the
SAME area the kept comps came from, widening 3 → 6 → 9 → 12 → 18 → 24 months until at least
three, each with its story; competition is limited to the neighborhood or community, and a
subject outside any boundary uses the comp radius, never a city-wide band. Before this, peers
were the market-area grain at a fixed 12 months and competition was city-wide nearest-first.
`render_args.compArea` is the one area object; the renderer reads it for both chapters.

**Landed after the cut-off (2026-09-08 evening):** the wiring pass (`fa6dde43`) and Delta 3
(`010a544d`, `ef66f481`) reached main at `09b59010` and are live: one map, three pin families,
three matrices; chapter 2 and the competition read `compArea` / `expiredPeers` / `bandRivals`.
The rural competition cap (`6ea73fc4`: start 5 mi, widen 5 → 10 → comp radius only to find
three) reached main at `8a1f83be`; Concorde's competition is 3 active + 1 pending within five
miles. All four exemplars rebuilt on this engine; look-pass OK on all four. The block below
describes the state BEFORE those landed and is kept for the record.

**Session cut-off 2026-09-08 (limit resets 8pm PT) — state of the two lanes:**
- Document `wt/cma-doc-20260907`: Delta 3 landed as `010a544d` (one map, three pin families,
  three matrices) and `ef66f481` (sort/filter/reveal per matrix), plus `b366a3a6` WIP residue
  (typechecks; tests unconfirmed). NOT done: the wiring pass that points chapter 2 and the
  competition chapter at R2h's `render_args.compArea`, `expiredPeers` (a set: `.peers`,
  `.sentence`, `.shortfall`, `peer.whyItSat`) and `bandRivals` (a set: `.rivals`, `.sentence`,
  `.source`) — see R2h's list: `opinion-pages.ts` `didNotSellArgs` and `competitionArgs`,
  `opinion-scenes.ts:76`, `render.ts` types; `lib/cma/extras.ts` still computes the city-wide
  sets until then.
- Engine `wt/cma-engine-20260907`: R2h landed (`a18989f9` `ead99804` `9b4cc390` `11782caa`,
  merged into ship). R2i, the rural competition radius (start 5 mi, widen 5 → 10 → comp
  radius only while fewer than three rivals; never beyond the comp radius) is NOT started;
  rule in memory `feedback_cma_comp_containment`.
- Delta 4 (rural homes read as property: zoning, irrigation, usable acreage, outbuildings,
  well/septic, farm use as hard splits or itemised lines) is recorded in the blueprint and
  memory; the next engine item after the containment ladder.

**Still open:** the cover photo is whatever single MLS photo the row carries; the map is a
Google tile with our pins; subdivision-story and voice-reviewer still call the Anthropic API
and fail open; inbound EMAIL replies do not advance the CRM; D21 price-tier fallback is Matt's
call; `CmaLaneFunnel` not mounted; 8 `zz-test-rebrand-*` fixtures in production `cmas`;
`lib/cma-request.int.test.ts` is flaky under the parallel full suite (shared DB). Every ready
row still needs a rebuild on this engine before any send; all lane switches are OFF.

## Prior — 2026-09-08 (site queue round two seeded from Search Console; two policy questions on Matt; the cloud fleet can take a screenshot)

Owner: Claude (Fable 5.1), session 3db16241, main checkout. Three commits on this program today:
`e09771ea` (a cloud lane installs the browser its taste pass needs; `tsx` declared), `a5dbf484`
(a measurement window no longer freezes its page; the cloud setup script recorded), and this one
(round two seeded, `scripts/_gsc-by-class.mjs` promoted, this block).

**The queue is 29 items: 12 open, 2 in progress (SITE-03, SITE-07), 13 blocked (11 on dated
windows that reopen 2026-10-05..08, 2 on Matt), 2 done.** Next served: SITE-20. Ids and the
round-two note are in `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md` ("Site queue"). `loop status`
prints all of it, including the two questions.

**Round two, SITE-20..33, and what it is not.** Source: Search Console 2026-06-08..2026-09-05
(`node scripts/_gsc-by-class.mjs`: 129,817 impressions, 1,368 clicks, 1.05% CTR), four lenses and
twenty-two adversarial verifications (workflow `wf_71474111-a25`), every code fact re-read, every
live claim re-curled with a browser UA. Every traffic-causation claim died against this site's own
query data: the class CTR gap is rank on head terms (/subdivisions earns 57 of its 71 clicks at
positions 1-10 on uncontested plat names; /cities sits at 19-45 on "homes for sale in redmond"),
and cross-class position comparison is uninformative in any weighting. So round two claims no click
it cannot prove. It is correctness on a licensed broker's public site (Closed listings publish the
list price in the snippet, the share card and the JSON-LD, 1,282 of 1,708 compared rows; off-market
pages compute a mortgage on the old price and invite a tour; "Oll Homes for Sale" as a place name;
Grants Pass open houses under a Central Oregon title), consolidation (2,330 listings indexed at more
than one self-canonical URL; resort sub-plats scoring zero closed sales forever because the count is
a text join at resort grain), origin cost (every place page and the blog are fully dynamic), and
eleven missing community guides. Each node carries file:line, the figures, and a mechanical accept
test the verifier rewrote so it cannot pass for the wrong reason.

**Refuted and NOT seeded, so nobody re-finds them:** a registry-alias noindex for plats (already
shipped by `getIndexableSubdivisions`; the residue is recrawl latency); a /cities out-of-area gate
(middleware already 308s to /oregon); cannibalization, entity-dilution and crawl-budget mechanisms
(no measurement exists on this site); the greenwood-playhouse snippet (every impression is a quoted
navigational query for the venue's own site); a stale-price bug on MLS 220219174 (it is Active; the
'2202' prefix is a sequence, not a year).

**Ruled by Matt 2026-09-08 (asked, answered, written onto the nodes, which are now open):**
- SITE-32: off-market listing URLs stay INDEXED with the honest state. MASTER_SPEC:1942 wins;
  data-architecture-plan:1095's noindex text is the losing text and gets deleted by the lane.
  Closed pages showing ClosePrice are not treated as a VOW-only sold surface under ODS A.4 for
  indexing. Gate pins index,follow; SITE-21 is what those URLs serve.
- SITE-33: the listing tier gets the honesty block and noindex with follow preserved; pages
  still serve; the /oregon referral pages' inventory links keep resolving; /oregon/[city] stays
  indexed per W12.4. SITE-33 now waits on SITE-25 (pageMetadata cannot emit noindex,follow yet).
- SITE-07 (2026-09-09 00:1xZ): the neighborhood place class scored 67 against a same-instrument
  83 after SITE-07 shipped, all lost points on pre-existing sections. Matt: accept 67 as the
  honest mark and fix the two named defects now (subdivision-label truncation; the stacked-list
  run) as a quality pass on SITE-07. The node is reopened with QUALITY PASS DUE at the head of
  its objective and is the next item served; its October 6 date is kept and it re-blocks to it
  when the pass lands. The city class was rebaselined at 65 on the new instrument.

**Fleet state.** Environment RYANREALTY_CLOUD: network access Full, variables populated, Setup
script `CLOUD_SETUP_BROWSERS=1 bash scripts/cloud-setup.sh || true` (set through Matt's Chrome at
22:10Z with his ok, reopened and verified persisted; the editor is under the environment chip on the
composer, not under Settings). Routine `trig_01JTHasiFzPRDnkTiPzodMPV`: every four hours, back on
Fable 5.1 at Matt's call, next fire 2026-09-09 00:05Z; 4 of 13 fires today succeeded, the rest died
on the Fable weekly limit (reset 19:00Z) and one 08:30Z fire is still parked on a `.git/index.lock`
permission prompt under the old prompt, holding no node. The skill now carries "If you are a cloud
session" (browser first, --webpack, curl UA, scratchpad/, per-file deletes, the 16 GB build ceiling)
and "A measurement window does not freeze the page" (Matt: quality passes allowed, window keeps
running, recorded on the same node, `blocked_until` untouched).

**Do not.** Re-audit the site or write a new audit document (append to a node). Claim a click from
a metadata change. Noindex anything on the listing route before SITE-32 is ruled. Set
`dynamicParams = false` on /housing-market or /open-houses (each 404s legitimate pages named on the
nodes). Call `permanentRedirect` from the by-address page body (blank 200 under loading.tsx; the
file documents it). Gate on `PUBLIC_ACTIVE_STATUSES` for off-market behaviour (it excludes Pending).

---

## Prior — 2026-09-08 (CMA reimagined: round four audit, WIP on two branches, and Matt's comp-containment rule)

Owner: Claude (Fable). Integration branch `wt/cma-ship-20260907`; WIP on `wt/cma-engine-20260907`
(`910b2261`) and `wt/cma-doc-20260907` (`c7be141b`, which already merges the engine WIP).
Blueprint + four evaluator rounds + the round-four audit: `docs/plans/CMA_REIMAGINED_2026-09-07.md`.
Memory: `project_cma_funnel_mission`, `reference_partial_month_index_endpoint`,
`feedback_cma_document_reimagined`, `feedback_cma_comp_containment` (new, below).

**THE NEXT ENGINE ITEM, from Matt 2026-09-08 (his words):**
"Whenever we're in a city, if the city has a neighborhood district or a community where there are
subdivisions inside it, we want to always focus on that subdivision to try and get our comps. If we
can't find it within that subdivision, we never leave the community boundary or the neighborhood
boundary. We want to start by looking at the most adjacent subdivisions within the neighborhood or
community, and continue to do that until we've exhausted everything before we would leave the
neighborhood boundary. We would go back up to 12 months within that neighborhood or community
boundary before we would ever leave it. … we had one in Old Bend, and then you got me a bunch of
homes in Southwest Crossing, which are two entirely different homes and locations."
- Today's ladder (`lib/pricing/ladder.ts`, per `CMA_STATE_OF_THE_WORLD.md`): subdivision 3/6/9 mo →
  wide-GLA same subdivision → **1 mi radius** → 2 mi → similar subdivisions → city. The 1-mile
  rung is what jumps Old Bend into Southwest Crossing.
- The rule: subdivision to 12 months → adjacent subdivisions INSIDE the same neighborhood or
  community (nearest shared boundary first, from the GIS mesh `resolveMarketArea` already uses)
  to 12 months → only then any rung that crosses the boundary. Where a city has no neighborhood
  layer (Redmond, La Pine) the rule degrades to subdivision → city, and the document's search
  sentence must say which.
- Data to confirm before coding: `boundaries` (3,213 subdivision rows), the 14 Bend neighborhoods
  and 14 resort communities in `data/resort-communities.json`, and subdivision→neighborhood
  membership (registry aliases assert membership; gated). Run the backtest N=600 before/after;
  the hard cuts (product, baths, US-97, tier) still hold on every rung.
- Renderer follow-through: the chapter-3 search sentence must state the rung actually used
  (the round-four audit found it saying "not enough sales inside Diamond Bar Ranch" while three of
  five comps WERE Diamond Bar Ranch).

**State of main (`b9da5d2e` + this handoff).** The reimagined document, the corrected pricing
(range from the printed adjusted sales, reconciliation weights, trailing-3 index with a guard,
clamp printed when it binds, set-aside sales out of the weights, review flag on the row), tracked
links on every address, the four-lane queue with Auto-send OFF everywhere. Production deploy
verified. Nothing sends.

**Round-four audit (in the plan doc): NOT SENDABLE. Blocking classes:**
A. `pricing.sellerNet.predictedSellerNet` is wrong on every row and impossible on one (Concorde's
   net exceeds its list). The chapter is headed "What you keep".
B. The story reads the ask that did not run the clock (2465 held $475,000 for 152 of 187 days;
   the document quotes the $460,000 gap). 19968 runs the overpricing story off a Nov 2004 ask.
   1617 runs it at an owner asking BELOW the range.
C. `pricing.review` reaches the admin route only; the letter and PDF a broker sends carry no
   trace of a `fail` verdict.
D. Compliance: 1617 NW 8th is ACTIVE with another brokerage and the closing solicits it; 2465 is
   Withdrawn, not Expired.
E/F. Counts that contradict inside one document; the Google default map; a strip mixing scales.

**The WIP that addresses A–D (typechecks; 3,078 of 3,079 CMA+pricing tests pass):**
- engine `910b2261`: itemised `pricing.sellerNet {basis:'list', list, lines[], net, sentence,
  unknowns[]}` (commission is in `unknowns`, never silently zero), `expiredAudit.askExposure
  {segments[], dominant, final, sentence}`, `pricing.review.severity` + `rendererNotice`,
  `lib/pricing/subject-status.ts` → `subjectStatus {standardStatus, isActiveWithOtherBrokerage,
  isWithdrawnNotExpired, listingAgentIsUs, note}`.
- doc `c7be141b`: net chapter itemised with what is not included, chapter 1 reads
  `askExposure.dominant`, review band on letter + immersive, `lib/cma/render-contract.ts`.
- The one failing test (`lib/cma/opinion-spine.test.ts` "omits … seller net when those extras
  are unknown"): the net chapter now renders its heading with no figure when `sellerNet` is
  absent; the test expects the chapter omitted. Decide: omit when `sellerNet` is absent
  entirely, print the sentence only when present without a derivable net. Then finish classes
  E/F, rebuild the four exemplars (`scripts/_rebuild-cma.ts`), look-pass `--check --interact`
  (it clears the slug first now), merge to ship, gates, push.

**Process note.** The round-four audit workflow expanded to 631 agents on an uncapped
findings→refuters fan-out and hit the session limit before its judge stage, twice. Cap findings
per lens (top 5) and use two refuters. The findings were worth it; the sizing was not.

**Unchanged open items:** subdivision-story and voice-reviewer still call the Anthropic API and
fail open; inbound EMAIL replies do not advance the CRM; D21 price-tier fallback is Matt's call;
`CmaLaneFunnel` not mounted; 8 `zz-test-rebrand-*` fixtures in production `cmas`; the cover
photo is whatever single photo the MLS carries; the map is a monochrome Google tile.

## Prior — 2026-09-08 (round 4: SITE-08 and SITE-12 landed, and three false-pass traps closed)

Owner: Claude (Opus 5), session 01NESdvn. **main is at `b9da5d2e6`**, Vercel
`dpl_q2yrS6o3G1fHfPwmNpeqpeHxLG7W` READY in production and live-checked on ryan-realty.com.
Both nodes are blocked on measurement to 2026-10-08 with their evidence written
(`f475834f` SITE-08, `28a55619-eff3-4763-aeaf-e7f3617a9cb3` SITE-12). 20 commits in one push.
`ci:gates 165/165` · runtime gates green · 892 test files, 9,543 tests.

**The part worth reading is that three separate things reported PASS while measuring the wrong
thing.** Green output is not evidence unless you can say what it measured.

1. **`ci:runtime-gates` — the command I shipped this morning so a lane could run the gates CI
   runs — could never start.** It was `start-server-and-test`, whose waiter is axios-based; the
   middleware bot screen's `BAD_BOT_RE` matches `axios`, so every probe came back 403 and it
   retried to a mute "Timed out waiting for: http://127.0.0.1:3000". That is the identical
   failure CI carried on every pull request from 2026-07-25 to 2026-08-02, already root-caused
   in the header of `scripts/wait-for-server.mjs`. I shipped a gate command that reintroduced a
   bug this repository had written down. `scripts/run-runtime-gates.sh` now uses CI's own
   start/wait/run split and CI's own waiter.
2. **A stale server answered for the new one, twice.** A `next start` from an earlier run held
   port 3000; the new server died with `EADDRINUSE` into a log nobody read, and the waiter got
   its 200 from the old process. A hand check then "verified" two just-built fixes against the
   previous build. The runner now refuses a busy port, and it tries `lsof`, `fuser` AND `ss` —
   because on this container `lsof -ti tcp:3000` printed nothing while `fuser` named the pid, so
   an lsof-only guard would have waved through the exact case it exists to catch.
3. **A `Node:` trailer named a uuid that is not a node,** and every write keyed on it updated
   zero rows and reported success. G72 checks the trailer's shape, not that it resolves. The
   first attempt to close SITE-12 wrote its evidence into nothing and printed "blocked"; it
   surfaced only because the queue listing still showed the node in_progress. `post-commit` now
   prints a loud line when the id resolves to no row. Two pushed commits (`7e2086647`,
   `b70aafff4`) still carry the wrong id; history is not being rewritten for it, and the node's
   evidence says so.

Add to that the one this session had already hit: a lane read a tap-target pass from a `.next`
whose BUILD_ID predated its own fix commit by 13 minutes. The runner refuses that too now.

## What shipped

**SITE-08 — cited Q&A with FAQPage schema on all three place grains.** One array
(`lib/site/place-answers.ts`) feeds both the visible rows and the JSON-LD, so the markup cannot
describe a sentence the page does not print. A separate claude-sonnet-5 evaluator scored the
merged build twice, three scorings each, rubric `v1-2026-09-08`: round 1 neighborhood 82 /
community 79 / subdivision 73, then after the fixes below and a recapture, **83 / 80 / 76**.

Its findings, all verified against source and the served HTML before being believed:

- **The visible §0 line was leaking the database.** All three grains opened "Source:
  market_metric neighborhood:bend-awbrey-butte through the Market Truth layer" — a table name
  and a raw slug, in body copy, the tell TASTE.md bans by name. §0 needs that handle auditable;
  TASTE says a client should not have to read it. Both are right, so the field split:
  `sourceTrace` is the sentence, `sourceKey` is the handle, emitted as `data-source-key` on the
  `#faq` section. Greppable in the served HTML, out of the reader's way.
- **"Ridge At Eagle Crest"** with a capital A, in the H1, the breadcrumb, the heading, all five
  Q&A questions and the FAQPage JSON-LD Google reads. English title case now lives in one list
  in `lib/market/publish-plat-display-name.ts` that both name paths use. It cannot rescue a
  withheld MLS abbreviation, which is pinned by test.
- **The prose rows wore the figure rows' clothes.** /communities/tetherow ran five aligned
  tabular numerals down its right column and then two blanks. They carry a reference register
  now, on an EXPLICIT flag — deriving it from "has no figure" muted the value ask, which is the
  one row the section exists for.
- **The HOA dollar figure had no source line** while every other figure did.
- **Two "active" counts, no reconciliation.** Awbrey Butte published 48 as the supply
  denominator and 57 as homes for sale a few rows apart, both traced correctly, neither
  explained. `activeCountNotes` existed for exactly this and was unused.

**SITE-12 — live counts under the homepage hero, Sell tab as real HTML.** Taste receipt 80. Its
merge into main resolved three conflicts rather than picking a side; the one worth knowing is
the Source-summary tap target, where main's fix and the lane's were independent and main's had
silently removed the control's only affordance (any `display` other than `list-item` suppresses
the native `::marker`). The merge keeps main's geometry and the lane's drawn caret.

## Open, and named by the evaluator rather than by me

- **Listing rows still print the raw MLS "Ridge At Eagle Crest"** under each address, so the
  page's own name for itself and the listings under it disagree. Deferred deliberately: the same
  string is a live search-filter key, so display and filter have to be separated first, and
  `publishPlatDisplayName` returns null for MLS abbreviations, so a naive route would blank the
  subdivision line on many tiles.
- **The community `#belonging` block restates $2,052 with no source line,** and states "Founded
  2008", "700 acres", "Course architect David McLay Kidd" and "Ranked #57 (Golf Digest)" with no
  source of any kind. That block is SITE-01's surface.
- **The subdivision hero prints a full §0 audit sentence as its first line of body copy** under
  the H1; neither sibling grain does. A page-class question, raised not answered.
- **The mobile sticky listings bar overlaps the answers section at 375px** on neighborhood and
  community — SITE-04's surface, node `9339692e-a02e-4a31-a416-cf7ebcdc010a`.
- **`ci:a11y` and `ci:lighthouse` have still never executed.** They sit in the same CI job as the
  three runtime gates and are not in `ci:runtime-gates`, deliberately: adding a command for a
  gate that does not run would be the same mistake as item 1 above.

## Queue

15 items · 2 done · 11 blocked on measurement · SITE-03 and SITE-07 held by other sessions
(`claude-opus5-019RdEm6`, `cloud-grinder-2026-09-08-20`). **Nothing is open to claim.** The next
session's work is whatever reopens, or whatever those two lanes hand back.

---

## Prior — 2026-09-08 (round 3 landed, deploy verified, and the live check found two more §0 defects)

Owner: Claude (Opus 5), session 01Aubwpa. **main is at `9efa2cf32`.** Round 3 is on main, gated,
deployed, live-checked, and both nodes are blocked on measurement to 2026-10-06 with their
evidence written (`89efe5a4` SITE-02b, `b2366127` SITE-06). 24 commits landed in one push
(`ci:gates OK · 188/188 passed · 62.1s`); the live check then found two more defects, fixed and
pushed in `22cbedee3` and `9efa2cf32`.

**The live check is where the value was.** Everything below the "two §0 defects" heading was
caught before ship. These two were only visible on production, and both were in the round's own
new code. A round is not finished at green gates.

**What shipped.**
- **SITE-02b — the answer drawn.** `V3Drawing` plus `lib/charts/plot.ts` (+226) and `ticks.ts`:
  two answer geometries, named counts on one scale and marks on one axis. Wired into the
  community ask and the /sell answer. The city chart's falling year now wears the exception ink
  and its year labels stop overprinting.
- **SITE-06 — the listing page gets an ending.** `V3ListingClose` (waffle / bar / rule drawings
  behind a three-act chooser) on `getListingCutFacts`.

**Two §0 defects found and fixed on the way, both on live or soon-live pages.**
1. **The pill published a banned field.** The price strip printed `listing.dom`, which is
   `row.DaysOnMarket` — list-to-close, banned as DOM by §7 — while the close section computed
   days from `onMarketDate`. Same page, 106 against 110. There is now one definition,
   `lib/listing/days-live.ts`, and both read it.
2. **The two bars did not divide back to the verdict beside them.** Sunriver drew 48 active and
   a pace label of 8 under a caption reading 5.8 months / balanced; 48 / 8 is 6.0, a buyer's
   market. `paceLabel` in `lib/site/answer-figures.ts` now keeps the whole number only when the
   division still lands on the published months of supply, so Bend still reads 173 (671 / 173 =
   3.9) and Sunriver reads 8.3. Pinned by `lib/site/answer-figures.test.ts`.

Also landed: the Source disclosure and the 3D-tour control got real 44px tap targets (WCAG
2.5.5); the close section's date goes through `formatCalendarDay` and its anchor is named where
the page names it; and `scripts/take-route-shots.mjs` now hides the Next dev badge — it was
sitting in the corner of every shot any evaluator has ever scored.

**The two the live check caught, both in this round's own work.**
1. **The held comparison was still published in its own Source disclosure** (`22cbedee3`). The
   outcome strips were off, as Matt ruled. Their citations were not: the summary carried "Bend
   detached median days to contract 29" and "median sale to original list 97.0%" directly under
   "7 Ryan Realty closings in the window; sale-to-original-list on 7, days-to-contract on 6".
   That is the comparison, in prose, one summary open — and withholding only our own half is
   worse than either publishing or not. A §0 trace lists the figures we PUBLISH; it was
   following the data instead of the page. `ProofTrace` entries now carry a `scope`
   (`always` | `outcomes`) and the view drops the outcome-scoped lines when it does not draw the
   strips. Clause 5 in `decisions.md` makes it general: a hold withholds the figure and its
   sourcing together.
2. **Days on market counted elapsed hours, not calendar days** (`9efa2cf32`). Production
   published "26 days on market" beside a citation reading "OnMarketDate 2026-08-12" — count
   from that date and you get 27. `OnMarketDate` is a timestamptz (this home: 20:11:48+00,
   1:11pm local), so dividing elapsed milliseconds by 86,400,000 reached 27 only after 1:11pm
   each day. Confirmed against the source row with an audit query: by epoch 26, by calendar date
   27. It is calendar days now, in `America/Los_Angeles` through the repo's `zonedDateKey`, with
   a bare `YYYY-MM-DD` taken as written rather than zoned. The citation says which count it is,
   so the figure is checkable from the line beside it.

**Taste receipts, honestly.** Three under the tightened instrument contract, evaluator
`claude-sonnet-5`, rubric `v1-2026-09-08`: listing-detail **87** (`first`), sell **71**,
community **60** — both `rebaselined`, not `rose`. The priors differ on evaluator model and
rubric, so a rise cannot be claimed across them; these are the new baseline to beat.

**MATT RULED 2026-09-08, verbatim: "Hold those we only want positive."** The proof block's two
outcome strips (our sale-to-first-ask and days-to-contract against the Bend median: 52 days
against 29, 93.7% against 97.0%, n=7) DO NOT PUBLISH. `showOutcomes` defaults to false so no
caller ships the comparison by omission; a test pins it. The figures are untouched — this
decides what we publish, never what we measure. The same rule binds any surface that would draw
our own performance against a market benchmark. Locked in
`docs/plans/PUBLIC_PRODUCT/decisions.md` (2026-09-08).

**Open findings, none blocking, all recorded on the nodes.**
- **The `EASTON COMMERCIAL` breadcrumb** — our plat-alias resolution puts a commercial plat on a
  single-family listing. `boundaries` holds five Easton plats, two sharing plat doc
  `Plld20220219`. This is the one worth taking next; it is wrong in front of a buyer.
- The answer sheet's right ~40% is empty at 1440.
- The comps dot strip has no axis at rest.
- A hero broken-image glyph traced to this sandbox's proxy, not to the site — an `onError`
  fallback is still worth adding.

**Queue.** SITE-02b and SITE-06 are blocked-on-measurement, reopening 2026-10-06, with the rest
of the shipped set; their nodes carry the full evidence including the live-check findings.
SITE-03 and SITE-07 are held by `cloud-grinder-2026-09-08-16`, SITE-08 and SITE-12 by
`claude-opus5-01NESdvn`. Nothing is open and unheld, so the next round starts by checking those
four heartbeats before claiming anything.

**Local traps that cost time this session, so the next lane skips them.** Stop every dev server
by PID before `npm run ci:gates` or `ci:commit-compiles` is OOM-killed and prints `Killed` as its
only error — and resolve the PIDs with `ps | awk` first, because `pkill -f "next dev"` matches
your own shell's command line and kills the session. `npm run deploy:verify` has no Vercel token
in a cloud container; verify through the Vercel MCP tools instead
(project `prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA`, team `team_zwYQPapH0CpleD7RzJ7WctGO`).

---

## Prior — 2026-09-08 (the queue's first day, audited: what it cost and what changed)

## Prior — 2026-09-08 (SITE-09 landed; SITE-12 and SITE-08 mid-round, preserved on branches)

Owner: Claude (Opus 5), session 01NESdvn, main checkout at `3c529bb`. Branch
`claude/run-loop-syxm1d` is synced to main (its 63 "unpushed" commits were all already on
main; only the branch ref lagged).

## SITE-09 is done and live — blocked on measurement, ledger row attached

Shipped on main: `a4ea2600` (the response clock), `61f0061e` (/contact after the evaluator
pass), `d03e15af` (the taste receipt), `3cad252e` + `4c3f3508` (handoff). Deploy
`dpl_CSRRErGMqPRnZokfyFHHm5W6HvES` READY and aliased to ryan-realty.com. Node
`d575d2eb-7514-4be7-8399-f0ebaa2f7dc7` is `blocked` with `blocked_until` 2026-10-06 and
ledger row `3ad9bbd8-61a4-4904-af2d-deb2d6cf7b45`.

**What it does.** A same-minute system confirmation on the three site submits that had none
(/contact and every listing tour or question CTA, the guest saved-search and saved-home
captures, the expired LP acknowledgment), all through `sendGovernedEmail` with a system
initiator. Both governed email rails and the SMS rail now stamp `purpose` and `initiator`
into the timeline payload, and only a broker initiator sets first-broker-action — so a
system confirmation can no longer read as the broker answering, which is what made every
prior speed-to-lead number fiction. `/api/cron/crm-response-clock` runs every five minutes,
pages the assigned broker five minutes past a submit inside 8am–8pm Pacific, escalates to
Matt at 24 hours wall clock, and clears the flag once a person answers. The Response clock
panel sits at the top of `/admin/crm`.

**The number that matters.** Baseline read fresh at landing against live Supabase with the
shipped predicate: **9 of the last 10 site submits had no human touch at all.** The one
counted touch is an unstamped /book invite predating the provenance stamp, so the panel
prints the median as **"unproven"** rather than the flattering 2 seconds it would compute
(§0: an unverifiable figure does not ship).

**The evaluator earned its keep.** A separate Sonnet evaluator scored /contact 43 and caught
a real §0 violation the builder missed: "within one business day" was removed from the page
but still lived in the meta, og and twitter descriptions — the first thing Google and every
shared link showed. Fixed and confirmed absent from production. Pass 2 scored 54 (first mark
for the route; it leaves the unreviewed baseline).

**Timer proven running**, not merely registered: Vercel runtime logs show
`GET /api/cron/crm-response-clock` returning 200 on the five-minute schedule (13:20–13:55Z).

## Round in flight: SITE-12 and SITE-08 — work is SAFE on remote branches

Both claimed by `claude-opus5-01NESdvn-2026-09-08` through the enforced path
(`site-queue-status.ts --claim`), heartbeated. Built by a workflow that runs the separate
evaluator BEFORE any push — the fix for the audit's finding that 46% of item commits were
evaluator rework after the code was already on main.

| Item | Branch | PR | Commits | Prior mark to beat |
|---|---|---|---|---|
| SITE-12 homepage | `wt/site-12-home` | #204 draft | 2 (46 files) | homepage-v6 = 77 |
| SITE-08 place Q&A | `wt/site-08-answers` | #205 draft | 3 (32 files) | neighborhood 58, community 59, subdivision none |

**State at handoff:** both builds done, both pass-1 evaluations done, fixes applied, a
regrade in flight. Nothing is merged and nothing is verified by the orchestrator yet. The
draft PRs exist specifically so this cannot become the audit's "finished lane stranded with
no PR" failure.

**To resume:** the worktrees are at `.worktrees/site-12-home` and `.worktrees/site-08-answers`
(gitignored, and gone if the container is reclaimed — the branches on origin are the durable
copy). Re-verify each lane's claims yourself, land the taste receipts with their shots
hashes, run `ci:taste-canon`, then one `ci:gates`, one push, one deploy check, a live
exercise, and evidence on each node. If a score did not rise above its prior mark, the item
is NOT done — do not write `comparedToPrior: "first"` to dodge the rise rule; the gate reads
the receipt at HEAD and refuses it.

## Do not

- Commit a lane worktree's files from the main checkout while its agent is running. The
  stop-hook flags them as "uncommitted changes in the repository"; they belong to the lane
  and the lane commits them itself with its own `Node:` trailer.
- Re-audit the site or write a punch-list doc. Append to a SITE node.

# Previous — 2026-09-08 (the queue's first day, audited: what it cost and what changed)

Owner: Claude (Opus 5), session 3db16241, main checkout. `origin/main` at 1e61fa00.

**A read-only forensic pass over the first 16 hours** (9 agents: git, cloud fires, work
graph, liveness, design; 3 improvement lenses; a judge) found the queue works and wasted
~13-15 lane-hours on five causes. Five items are live and the taste bar moved where it was
measured (/sell 63 to 83, homepage set at 77). The waste: the hourly cloud routine was
alive 9.2h and landed zero commits (11 fires, 6 killed on arrival by the shared account
allowance, one parked 3.7h on a permission prompt nobody could answer); an hour of
finished evaluator-scored /sell work sat stranded on `wt/sell-round2` with no PR; 46% of
item commits were evaluator rework AFTER the code was on main; the queue was servable to
nobody for 2h28m; and 106 MB of screenshot PNG went into permanent history in one window.

**The single structural finding: one shared account allowance.** Four concurrent lanes plus
an hourly fire exhausted it at 09:13:38Z and killed every worker in the same minute,
freezing 7 nodes. Adding lanes buys nothing until the cost per item drops.

**Shipped in response (Matt's four decisions, 2026-09-08):**
- **Cut the drawing dependency.** SITE-03/06/07 no longer wait on SITE-02b — their own
  accept tests never mentioned a drawing; it was a scheduling artifact. Six items servable.
- **Three lanes, hard cap.** `MAX_SITE_WORKERS` 3 and `MAX_SITE_CLAIMS_PER_SESSION` 2,
  enforced in `claimWorkNode`, printed by the brief as `SITE FLEET FULL`.
- **Build and measure split by mechanism, not by a new row.** `blocked_until` (new column)
  carries the re-open date; the brief moves `blocked` to `open` when it passes and prints
  `REOPENED`. All seven shipped-and-measuring items now carry their date. A `blocked` node
  with NO date is blocked on a person and must state the question.
- **Unwired primitives are refused.** `ci:site-primitive-wired` (G73) fails a
  `components/site/v3` component whose only importers are under `app/dev/**`.
- **Liveness, not idleness.** New `heartbeat_at`: a claim is alive because its owner says
  so. `touchWorkNode` / `site-queue-status.ts --touch <gaps> --owner <session>`. The
  release is now optimistic on the owner too, so a live lane is never preempted. This was
  required: the 3-hour timer shipped this morning WITHOUT a heartbeat, which armed live
  lanes for wrongful release.
- **`deploy:verify` stopped lying.** `waitMs` was const at the 45-second skip window, so
  every site round exited 2 on a BUILDING deploy and a real production ERROR looked
  identical to a flake. Same SHA now reports READY in 148s (1e61fa00).
- **Cloud routine to 4-hourly** while the allowance is exhausted (reset 19:00Z).
- **Recovered work:** `wt/sell-round2` merged as 1409fe74 — SITE-02, 05, 10, 11, gates
  154/154, live on /sell. The next fire would have rebuilt it blind.
- **A record I wrote was wrong:** SITE-04 cited merge SHAs never on main. Corrected on the
  node; the identical patches did land (1f60f8d7, 7ac7ecc0) so the work is live.

**Still open from the audit, in rank order:** move the evaluator BEFORE the push and pin
what the rise rule compares (the same commit scored 82/81/75/88 — variance wider than the
effect); one shot tool plus a PNG weight gate; a warmed cloud image (57.7s of `npm ci` per
fire) and a quota-aware sentinel instead of a fixed cron.

## Prior — Current — 2026-09-08 (the CMA, reimagined: landed at 6a4aff75)

Owner: Claude (Fable). Same worktrees as the funnel mission; integration branch
`wt/cma-ship-20260907` → main `6a4aff75`. Blueprint of record with three dated deltas and the
evaluator's `tasteReview` sections: `docs/plans/CMA_REIMAGINED_2026-09-07.md`. Research:
`docs/research/cma-professional-practice-2026-09-07.md`. Matt's words that bind it: "no one says
band … everything should be linking back to my website … illustrate that if homes are priced too
high they sit and expire … facts and not hype … show all pricing history for every listing …
beautiful, interactive and engaging."

**Shipped**
- Statistics on `render_args`, verified three ways (`lib/pricing/local-outcomes.ts`,
  `lib/data/cma/localOutcomeReads.ts`): city offer-timing curve, first-ask-vs-outcome groups with
  share of original ask, realization by weeks to offer, local failed-then-sold pairs, the
  subject's final listing cycle with dated cuts.
- Pricing (`lib/pricing/estimate.ts`, `rejected.ts`, `reconciliation`): D10 closed — the range is
  the spread of the printed adjusted sales (trimmed one each end at n ≥ 6), the point their
  weighted reconciliation carried to an ask at the city sold-to-original-ask share with a ±50%
  outlier rule; weights and reasons printed; time-adjustment basis printed; concessions per sale;
  "considered and not used" never overlaps the printed set and states the rule that cut a sale;
  range rounded once. Backtest within-10%: 60.1 → 64.4 on the 200-subject sample.
- Document (`lib/cma/` renderers): cover → their listing as a timeline against the value zone →
  the listings near them that did not sell, one story each with the price path → what overpricing
  costs (curve, bars, realization table, all local) → the number with a worth strip, method
  sentences and the appraisal-style grid with weights → competition cards with price paths and
  cut counts → the market with the median reconciled → net at list from the printed rows →
  basis and limits → next step with two tracked buttons. Cream throughout, navy cover and
  closing. Every address, place and button through `trackedDocLink` (`lib/cma/doc-links.ts`) with
  identity and `utm_campaign=<cmaSlug>`; a comp tap counts as a visit on the CMA's outcomes.
  Interactive on the web view (timeline cut, curve slider, bar tap, row ↔ pin, adjustments
  toggle, sort, competition filter, price-history expand, month line), keyboard and touch,
  reduced motion honoured, no scroll box and no horizontal overflow at 375.
- Tools: `scripts/cma-lookpass.ts <slug> [--check] [--interact]` is the visual gate;
  `scripts/cma-build-dryrun.ts`, `scripts/cma-reverdict.ts`, `scripts/cma-lanes-check.ts`.
- Privacy fix found on the way: `_pid`/`_fuid` were stored verbatim in `visitor_events.page_url`
  and mirrored to GA4; now stripped server-side.

**Open**
- Evaluator round two (`tasteReview — 2026-09-08`) is running at handoff; round one scored
  41/100 and every ranked item was worked. Read it before touching the document.
- Rebuild wave of every `ready`/`flagged` row on the new pricing is running (agent); numbers
  moved on many rows, and the expired-list-cap rule will flag some.
- The cover still uses whatever `extras.photos.current` holds (for 2465 an annotated aerial);
  choosing the next MLS photo needs a photo set on `render_args` from `lib/cma/build.ts`.
- The map is a monochrome static tile with our own pins; Google attribution still prints.
- The subdivision-story and voice-reviewer passes still call the Anthropic API and fail open on
  "credit balance too low"; move to `lib/grok` or delete.
- Main retired the voice canon and gates today (`352d4351`); CLAUDE.md §2 text is stale.

## Prior — 2026-09-07 (site queue mechanism + the place-page value ask, SITE-01)

## Prior — 2026-09-08 (SITE-09 response clock landed; the site queue runs in four sessions at once)

## Prior — 2026-09-08 (round 1 of session 01Aubwpa: SITE-05 and SITE-11 built unwired; five base defects fixed; PR #199)

Owner: Claude (Fable 5.1), cloud session 01Aubwpa (Matt: "Run loop", then "Go"), branch
`claude/run-loop-pcp7q3`, draft PR #199, landed on `origin/main` through `npm run push`.
Lane branches on origin: `wt/site-05-sticky` (af3680e..4297e1d, merged 42cfec3) and
`wt/site-11-proof` (91a13a5..7cb70d9, merged 25bdefa). Nodes SITE-05
(`547c080a-a47d-4ddd-902b-3d902945dce5`) and SITE-11 (`6c98f6ba-3627-4e28-ba06-7271e17f3b7c`)
stay `in_progress` with this round's evidence appended: both primitives are built, tested and
shipped but NOT wired, because every route they wire into (/sell under SITE-02, the city
template under SITE-04, the neighborhood/community templates under SITE-08) was held by
another session for the whole round (the skill's route-family rule). The rise gate cannot be
read until they sit on a route with a `parity.json`.

**Shipped, SITE-05 (lane C, separate Sonnet evaluator 87/100, all three must-fix defects
fixed).** `V3StickyAsk` (`components/site/v3/V3StickyAsk.client.tsx` + CSS): desktop
bottom-left plate, phone bottom bar modeled on the listing bar's geometry, shows only after the
sentinel (hero or on-page ask) has scrolled above the viewport, RETIRES while the target ask is
in view (so the page never shows two asks; the chrome decision of 2026-08-12 holds), session
dismiss, `--rr-sticky-bottom` published on `:root` while shown so any other sticky element
(SITE-04's strip) docks above it. The verdict tail is built once by `stickyAskVerdict()` in
`lib/sticky-ask.ts` from `marketVerdict` + `formatMonthsOfSupply` (G68), with a §0 source line
in the accessible name and title; null pulse means no tail, never invented. Attribution
contract `lib/ask-source.ts`: the control stamps `markAskSource('sticky')`, the form reads once
with `readAskSource()`, `withAskSource()` merges **`ask_source`** (never `source`, which
/sell's `generate_lead` already uses for `seller_lp`). **The SITE-05 accept metric is therefore
`ask_source='sticky'`.** 54 tests; 18/18 Playwright state assertions at 1440 and 375 (shots
under `ui_kits/_shared/shots/site-05/`). Dev preview `/dev/site-05-sticky` kept for the wiring
round (middleware refuses /dev outside development).

**Shipped, SITE-11 (lane B, four separate Sonnet passes 82 → 81 → 75/88, the last two on one
commit; NOT risen, by the rule).** `getProofBlock` (`lib/data/proof/`, exported from
`@/lib/data`) and `V3ProofBlock` (+ `proofBlockView`, `V3ProofStars` shared with `V3Proof`).
§0 trace printed fresh 2026-09-08T07:14Z: reviews 5.0 from 25 (`public.reviews`, google, not
hidden); closed-sales line 17 homes · $13,384,034 (`listings`, `ListOfficeName ILIKE '%ryan
realty%'`, Closed, ClosePrice not null, list side, all time); 7 closings in `CloseDate
2025-09-08..2026-09-08`, sale-to-original-list on 7 (median 93.7%), days-to-contract on 6
(median 52; one retroactive entry dropped by the market's own definition); Bend detached
medians from `public.market_metric` (`mt-v1`, same 12-month window): 97.0% (n=2,081) and 29
days (n=1,994). Every row agrees with `market_fact_sale` to 8 decimals, as a live int test.
The uncached read went from 23.5s to 109ms by driving off `idx_listings_close_date`. A live
double-count was fixed: `GlobalIntentTracker` already emits `call_initiated`/`text_initiated`
on every tel:/sms: anchor, so the block rides on `click_cta {surface, place, source, reach}`.
Shots under `ui_kits/_shared/shots/site-11/`; dev preview `/dev/site-11-proof`. The evaluator's
round-3 doc was removed from `docs/plans` (findings live on the node, 477a9b9).

**ASK MATT (one line, blocks only the outcome strips):** the last twelve months of our own
listings read slower and lower than Bend's detached median (52 vs 29 days; 93.7% vs 97.0%
of the first ask; our median close $755K against Bend's $760K, so not a price-band artifact).
Publish that strip under the /sell form as the node specifies, or hold it and wire only the
record, the reviews and the broker cards? Until he answers, the wiring lane ships the block
without the two strips (`proofBlockView` already renders the quiet form).

**Base defects fixed in this round (none in the lanes' diffs; each stopped PR #199's CI):**
- Site queue claims went stale in 3 days; a rate-limited cloud grinder held four SITE nodes
  for five hours. Two sessions fixed it the same hour; the merge keeps main's 3-hour value
  (2b59be7) inside this branch's tested helper (`SITE_CLAIM_IDLE_HOURS`, `isSiteClaim`,
  `isStaleInProgress` in `lib/data/loop/work-node.ts`). The skill gains the heartbeat rule: a
  live session touches `updated_at` on every node it holds when a lane reports, at each round
  boundary, and at least every two hours while a lane builds.
- `docs/ROUTE_INVENTORY.md` could not regenerate since 2026-08-27 (the ZIP set moved) and
  still listed the deleted `/dashboard/marketing` pages; the route smoke 404'd on them. Two
  sessions fixed it the same hour; main's copy (7ac7ecc) wins, inventory regenerated.
- The pull-request smoke step had no Playwright browser, so `ci:tap-targets` failed every PR
  since 990e86c: the e2e job's install line now precedes the smoke (efb01d7).
- With a browser, `ci:tap-targets` failed the homepage on the 3D-tour badge (142x20): the
  control is now a transparent 44px hit box with the same 20px badge painted inside (521abdc).
- `ci:probe-ua` failed `scripts/check-vercel-deploy.mjs`: its live probe now sends
  `CI_PROBE_USER_AGENT` (512e2c7).

**Verified before the push:** unit suite 870 files green on the merged tree; path-aware
`ci:gates` 92/92 (`ci:commit-compiles` needs the dev servers stopped or tsc is OOM-killed
and prints "Killed" as its first error); `ci:tap-targets` 16/16 pairs against the dev server
with a scratch headless shell (`PLAYWRIGHT_BROWSERS_PATH=out/pw`, the container's shell is a
different build than the pinned Playwright wants); `ci:probe-ua` passed. GA4 and cmas
baselines for SITE-05 (`out/_baseline_site05.txt`, also on the node): /sell 248 sessions and
1 `generate_lead` in 2026-08-11..09-07; `seller-lp` cmas rows 6 with email in each of the
last two 28-day windows.

**Next (round 2, the /sell route family is one lane):** SITE-02 is open again (the grinder's
claims released). Whoever takes /sell wires SITE-05 and SITE-11 in the same lane, in this
order: the SITE-02 answer step; `V3StickyAsk` per the contract (Stage `id="sell-hero"`,
`href="#get-value"`, `targetId="get-value"`, `focusId="get-value-address"`, mounted as a direct
child of `<main>`, and `SellValueForm` reads `readAskSource()` into the `generate_lead` payload
and the cmas request metadata); `V3ProofBlock` via `proofBlockView` under the form with
`reach` from the routed broker (`aboutFaceFromBroker`, never a phone literal). Then the city
template (SITE-04's alerts strip must dock above `--rr-sticky-bottom` on phones) and the
community page (`CommunityPlaceValue` needs an `id` pass-through; its address field needs a
stable id before `focusId` works). One evaluator per page class; the score must rise.
Evaluator noise is real (75 and 88 on one commit): rotate the model and keep the prior
receipt's evaluator when re-scoring the same class.

**Do not**
- Wire the outcome strips on a public route before Matt answers the line above.
- Re-emit `call_initiated`/`text_initiated` from a primitive; the global tracker owns them.
- Put a second element at `bottom: 0` on a page carrying `V3StickyAsk`.

---

## Prior — 2026-09-08 (SITE-09 response clock landed; the site queue runs in four sessions at once)

Owner: Claude (Fable 5.1), cloud session 01NESdvn, branch `claude/run-loop-syxm1d` landed on
`origin/main`. Lane commits (rebased onto the CMA mission, PR #201): a4ea260 (the response clock), 61f0061
(/contact after the evaluator), d03e15a (the taste receipt + test hardening). Node
`d575d2eb-7514-4be7-8399-f0ebaa2f7dc7` (SITE-09) set `blocked` on MEASUREMENT with the
READY SHA in its `blocked_reason`; re-open 2026-10-06.

**Matt (2026-09-08): "Run loop" then "Go".** Four sessions ran the site queue at once: the
hourly grinder held SITE-02, 02b, 08, 12; session 019RdEm6 took SITE-04 + M1; session 01Aubwpa
took SITE-05 + 11 (lane branch `wt/site-05-sticky`); this session took SITE-09, the one open
node whose routes none of the others touched. The optimistic claim (`.eq('state','open')`)
kept them apart without a word exchanged.

**Shipped (SITE-09)**
- Same-minute system confirmation on the three site submits that had none: /contact (every
  listing tour and question CTA lands there), the guest saved-search and saved-home captures,
  and the expired LP (an acknowledgment of the submit, never the report). All through
  `sendGovernedEmail` with `initiator.kind:'system'` (`lib/comms/site-confirmations.ts`);
  a contract test pins each action to its helper and keeps the place-page and /sell
  confirmations in place.
- The rails now stamp `purpose` + `initiator` into every timeline row they write (Gmail,
  Resend, SMS) and only a broker initiator sets first-broker-action. Before this, the
  same-minute confirmation was the broker's "first touch" and speed-to-lead read as fiction.
  New-lead texts for seller valuation asks deep-link `?intent=cma`.
- The timer: `/api/cron/crm-response-clock` every five minutes, `?dry=1` computes without
  writing. One human-touch definition in `lib/crm/response-clock.ts` (pure, 49 tests): kind in
  call/voicemail/sms_out/mms_out/email_out, source not a machine rail, a named broker, no
  system stamp. Five minutes past the submit inside 8am to 8pm Pacific (next 8am otherwise) pages
  the assigned broker (`untouched-5m`, category new_lead, so Rebecca and Paul's SMS-off pref
  routes it push_only); 24h wall clock escalates to Matt (`untouched-24h`); a touch after a
  flag clears it. Every write keyed, so overlapping runs converge.
- The admin flag: `getResponseClockReport` (same population, same predicate as the cron)
  feeds a Response clock panel at the top of `/admin/crm`: who is waiting now, the 28-day
  median to a human in business hours (withheld as "unproven" while every counted touch
  predates the stamp), submits counted, answered by a person, untouched past 24h, each with
  its section-0 source line.
- /contact: the sent state says what happens now, echoes what was sent, and offers the /book
  door plus "Send another message" (V3Ask gained optional `detail`/`again`); the four
  reaches live once (doors), the meta description and the FAQ no longer promise a business
  day. Baseline shots at 1440/375 plus the tour variant, the sent state and the admin panel
  under `ui_kits/contact/shots/`.

**Verified** on the worktree dev server against production rows: a fleet-test contact submit
reached the governed rail and was refused by the fleet suppression as designed; the new-lead
alert dedupe key was already on the timeline; the cron dry run returned ok with 0 scanned
(only fleet-test submits in the 26h window, excluded by design) in 230ms; the panel rendered
the 28-day read. Unit suite 848 files green at each commit; path-aware ci:gates 200 ok.

**Baseline (section 0 trace, getResponseClockReport, 2026-09-08):** crm_people created in the
28 days to 2026-09-08 with source or source:* tag in the site-submit list: 10; 9 created 8am to
8pm Pacific; 1 touched by a person (an unstamped /book invite, so the median is unproven); 9
untouched past 24h. Site-submit volume is thin (contact-form 4, idx-registration 3, seller-lp 2,
place-page 1 fleet test), so the accept window may not prove the median; function and the
evaluator carry the item per the 2026-09-07 rule.

**Evaluator (separate Sonnet, two passes):** /contact 43 then 54, first marks for the route;
it left the unreviewed taste baseline (15 to 14). Open raises are on the review: the
stacked-section composition, the flat broker roster, the plain FAQ, and the item's own name:
once stamped rows fill the window, surface the sourced response time on the page.

**Learn:** the stranded public-ux ledger window (look-walk-baselines, 2026-08-16) was closed
(8/8 routes graded at 390+1280, CMA graded, actual_delta 1, win), which unfreezes the domain;
SITE-09's own ledger row is `response-clock` (28 days, baseline_value null on purpose).

**Next (the queue)**
1. SITE-10 (selling timeframe after the answer) waits for SITE-02's /sell answer to land; it
   builds on that step. SITE-03, 06, 07 wait on SITE-02b. Take whichever lands first.
2. 2026-10-05: re-open SITE-01 (place-page cmas rows by rr_vid + Search Console clicks).
   2026-10-06: re-open SITE-09 (median under 300s over in-hours site submits with stamped
   touches; zero rows past 24h untouched).
3. The /contact open raises belong to the page-class owner, not to a new audit.

**Do not**
- Re-audit the site or write a punch-list doc; append to a SITE node instead.
- Put a dollar figure on a public page for a typed address (Matt: hold it for the CMA).
- Add a registration wall (Matt: no wall, email-only asks).
- Promise a visitor a duration ("within one business day", "within five minutes"): a
  duration is a number, and the only sourced one lives on the admin panel.

## Landed — 2026-09-08 (session 019RdEm6: SITE-M1 done, SITE-04 built and live, evaluator marks re-baselined, round 2 claimed)

Owner: Claude (Fable 5.1), session 019RdEm6, branch `claude/run-loop-w8f3ep` (PR #200, draft).
The session is pinned to that branch; session 3db16241 merged its head 968b0e4 into `main`
(bdf60cf0 → 7ac7ecc, 08:33 UTC), deploy READY, and recorded both nodes. Live check 08:40 UTC:
the compact brokers table is on `/`, the alerts strip renders on /cities/bend, /cities/bend/
awbrey-butte and /communities/tetherow ("2 houses came on the market in Tetherow" inline).

**Matt's word this session: "Go" (twice).** `/site-queue` with `ScheduleWakeup` self-pacing;
two lanes in worktrees; a separate Opus evaluator per page class.

**Shipped**
- SITE-M1 (node 64fe8b08, `done`): `AboutFaces size="compact"` on the homepage only. At
  390x844 the section is 520px: eyebrow, heading + Meet the team, three faces on a shared
  shelf, name, role, OR license, Call / Text / Book rows, all in the first screen
  (`ui_kits/homepage-v6/shots/brokers-390.png`, before shot beside it). Also fixed: save
  hearts and carousel dots rendered as bordered squares (selector specificity), the footer
  skyline crop, the hero missing from record shots. Evaluator 60 → 74 → 77 on one scale.
  **Matt 2026-09-08 08:35 UTC: 77 is the new homepage mark; the 88 is retired** (different
  evaluator, deleted shots).
- SITE-04 (node 9339692e, `blocked` on MEASUREMENT, re-open 2026-10-06): `V3AlertsStrip`
  barrel primitive (callout after the opening with the real 30-day count; sticky repeat past
  #atlas, dismissible, off over the footer, gone after a send) on city, neighborhood,
  community. Count = Market Truth `new_listings_30d` (city:bend 148, awbrey-butte 15,
  tetherow 2 on 2026-09-08, detached, period_end 2026-09-06) with a Source disclosure. No
  price-cut count exists in any cache (two query shapes), so the price-drop promise is a
  sentence, never a number. Display numeral only at counts ≥ 10 (`PLACE_ALERTS_FIGURE_MIN`);
  scope line reconciles figure and offer ("covers all of Bend, Awbrey Butte included"; the
  exact MLS subdivision set a community filter matches: Tetherow, Triple or Tetherow Resort).
  Capture contract unchanged; `alert_create` carries `placement`. Round three (4848a1a):
  the door has an affordance at every width, the scope is stated once, and a real logic gap
  closed (the sticky strip's IntersectionObserver never fires on a jump past the Atlas; a
  throttled scroll read backs it now).

  **The marks were rebaselined, not raised (2026-09-08).** Main landed the receipt contract
  the same day: a tasteReview dated 2026-09-08 or later must record its instrument, and a
  prior mark that differs on evaluatorModel, rubricVersion or shotsHash is not a baseline.
  Every earlier place mark differs on all three, so these are first marks on this instrument:
  city 78, neighborhood 72, community 65 (median of three scorings in one evaluator call,
  claude-opus-5 against claude-fable-5-1 as builder, rubric v1-2026-09-08, hashed to eight
  records from one capture run). Prior marks noted on each receipt.

  **A degraded capture cost the city page 18 points before anyone noticed.** Every place
  figure here comes from a read wrapped in a 3.5s timeout; a dev server compiling under load
  blows through it and the page renders its honest withheld state ("Live counts are
  unavailable right now", a callout with no figure). A scoring round was handed exactly that
  on the phone records and reported the feature missing on mobile and the hero photograph
  wrong. Both were capture artifacts. The tool now reloads up to three times and refuses to
  write a record in that state (trap 12), and the healthy re-score moved city 60 to 78. If a
  record ever looks broken, warm the route and re-capture before you believe it.

- CI: `docs/ROUTE_INVENTORY.md` could not regenerate since `CANONICAL_ZIPS` moved
  (`scripts/index-routes.mjs` threw), so the /dashboard/marketing deletion never reached
  the route smoke and PR #200 went red on two 404s. Generator fixed, inventory regenerated
  (7ac7ecc on main). `ci:routes` is not in the gate chain.

**SITE-04 measurement baseline (28 days before ship, read 2026-09-08 07:35Z, operational):**
place-page sessions 1,335 distinct (`visitor_events` page_view: city 527, neighborhood 231,
community 636); `listing_alerts` rows from real visitors 2, neither from a place-page filter
shape (21 of 23 rows were fleet-test or staff). Baseline rate 0 per 100 place-page sessions.
Price-drop rows cannot be reported separately without an `events` override on the capture
action (Matt's call, on the node).

**Rules learned (apply, do not re-litigate)**
- Evaluator marks are not comparable across evaluators; record the new number with the
  prior mark noted; the rise rule is judged on one scale within the item (Matt, above).
- Record shots must show the page: the sandbox browser cannot load the Supabase storage
  hero or the Spark photo CDN; relay those hosts through curl in the capture. Never a
  fabricated image.
- Lane agents idle on background waiters; brief them to run everything in the foreground.
- Two Fable lanes plus an evaluator hit the account rate limit in ~35 minutes; the skill's
  "schedule the wake for the reset" rule held.

**Round 2 (claimed 08:41 UTC by this session):** SITE-12 (homepage hero: live counts under
the search, server-rendered Sell tab) and SITE-02b (the answer drawn: months-of-supply bars,
comparable-sale dots, days-to-pending rule; every later item depends on it). Both were released
from the grinder by the 3-hour idle rule. SITE-02b's evaluator pass is on the community page,
which session 01Aubwpa's SITE-11 also touches: whoever lands second re-scores that class.


## Prior — 2026-09-07 (site queue mechanism + the place-page value ask, SITE-01)

Owner: Claude (Fable 5.1), session 3db16241, main checkout. Landed on `origin/main`:
c5ecb045 (G-FRESH event dates), e1d77374 (the site queue mechanism), b3c34e88 (SITE-01).

**Matt's directives (all 2026-09-07):** "I want this figured out once and for all" (the
site keeps getting re-audited and never converts); the goal is traffic that converts to
clients, a client being a signed buyer representation or listing agreement; seven product
answers recorded in memory `project_site_conversion_decisions_2026-09-07` and the research
artifact https://claude.ai/code/artifact/525cdcda-4c64-4954-9f5f-3b5eba500cdf (34/49 rival
pages read and re-verified, 22 site programs since June traced).

**The rule that ends the re-audits.** The site backlog is `loop_work_nodes`, domain
`public-ux`, version_gap `SITE-00..12` + `SITE-M1` (table in
`docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md`). `npx tsx scripts/loop-brief.ts` serves the
oldest open SITE node first whenever `app/**` or `components/site/**` changed in 14 days and
releases stale claims itself. A commit touching the public site needs `Node: <id>` (G72,
commit-msg hook; `Node: none (<reason>)` is the recorded escape). A new audit doc under
`docs/plans` must name the nodes it appends to. Do not write a new site audit. Pull the node.

**Shipped**
- 2026-09-08 08:37 UTC (session 3db16241): PR #200 merged to main at 7ac7ecc0 through the
  gated push and verified live: SITE-04 alerts strip on neighborhood and community pages,
  SITE-M1 homepage brokers on phones (Matt accepted 77 as the new homepage mark; SITE-M1 done,
  SITE-04 blocked on its 28-day measurement to 2026-10-06). SITE-09 recorded as shipped and
  measuring from its commits (a4ea2600). Five stale claims released at Matt's word (02, 02b,
  08, 12 from the paused first grinder fire; 04 re-claimed for the merge). The brief now
  releases site claims idle more than 3 hours; the grinder's guard is per item, never a
  global stop.
- SITE-00 done. SITE-01 shipped and set `blocked` on MEASUREMENT (not a person): every
  `/communities/[slug]` opens with the address ask (`CommunityPlaceValue` → barrel
  `V3PlaceValue`), answer = verdict + days to pending + cash share + comparable-close count
  with a source line, then email (required) + phone (optional) → cmas row with the new
  `place-page` origin (send mode `now`, auto-send lane OFF), CRM person + tags + note,
  rr_vid stitch, sequence enroll, broker alert, same-minute confirmation through
  `sendGovernedEmail` (Gmail rail, broker signature; a system message per Matt's ruling,
  CLAUDE.md §1). Verified on the dev server against production data; the confirmation
  landed in Matt's inbox. Fleet-test identities are suppressed by design, so a test submit
  shows "Sent" and no email goes.
- Separate evaluator scored the community page 59 (prior 57). Its two functional findings
  are fixed; the rest are appended to the SITE-01 node (draw the answer as bars/dots, a
  buyer door in the card, shoot the answer state with the sheet's own scroll offset).
- Search Console truth (scripts/_gsc-place-pages.mjs): `/communities/*` 4,516 impressions
  and 24 clicks in 28 days; `/cities/bend/*` 17 and 0. Item 1 targets communities first.

**Matt's one word (2026-09-07: "I want the go to run until done"):** `/loop /site-queue`.
The skill `.claude/skills/site-queue/SKILL.md` runs rounds of up to four lanes until no
open SITE node is eligible, wakes itself between rounds, and stops only on an empty queue.
"go" in a session with that skill loaded means the same thing.

**Parallel lanes (Matt 2026-09-07: "do more items in parallel").** The queue is not
serial. Only SITE-03, SITE-06, SITE-07 depend on SITE-02b (they render its drawings);
every other item is independent. Run lanes as separate agents in their own worktrees
(`isolation: 'worktree'`), each claiming its node with `claimWorkNode` so the brief never
serves the same node twice, each stamping with `npm run gates:stamp` and pushing its own
branch, then merging to main (`npm run push` from a worktree targets main; see memory
`reference_npm_push_from_worktree_targets_main`). Disjoint files per lane keep merges
clean; the shared files to watch are `components/site/v3/index.ts` (barrel exports),
`package.json`, and this handoff. Three or four lanes a session is the realistic ceiling
(a sonnet helper hit a session rate limit today under heavier load).

Round 1 (four lanes, disjoint routes):
- A: SITE-02 then SITE-02b (the /sell answer, then the drawing primitive it will use).
- B: SITE-12 + SITE-M1 (homepage).
- C: SITE-09 (response clock: lib/crm send paths, timer, admin flag).
- D: SITE-08 (cited Q&A with FAQPage schema on neighborhood, community, subdivision).
Round 2: SITE-03, SITE-06, SITE-07 (need 02b), SITE-04, SITE-05, SITE-10, SITE-11.
Each lane ends with a separate evaluator whose score must rise for that page class.

**What this plan is not proof against (Matt asked, 2026-09-07):** taste is a judgment
call (rotate the evaluator model; Matt's eyes on each live link); a directive that moves
the surface must land as queue items, never as a new plan; community traffic is thin
(24 clicks in 28 days), so some accept windows will not prove anything and the item is
called done on evaluator + function; the site cannot change impressions or the AI
shortlists (reviews, rankings); parallel lanes cost merges and rate limits.

**UNFINISHED AND PUSHED ON PURPOSE (2026-09-08 16:30 UTC, 8bf1621).** The alerts
strip carries a craft round closing the seven item-level defects the evaluator named:
the count as a door at rest, the sticky disclosure off the size and contrast floor, the
bar collapsed at 375 with the page reserving its height, the scope carried on the sticky
where the alert is wider than the count, one sentence shared by callout and sticky, the
bare MLS alias out of visitor prose, and a drawn caret replacing the browser triangle.

It is pushed WITHOUT record shots and WITHOUT an evaluator pass, which is a deliberate
trade, not an oversight: a builder lane wrote it, the container restarted before the lane
reported, and the work was recovered from its worktree as an uncommitted patch and
three-way merged onto this branch (five files conflicted with round three and the
tap-target fix; each was resolved to keep both changes). Verified: 86 unit tests, tsc
clean, ci:gates 145/145. Not verified: nothing visual. So the marks still stand at city
78, neighborhood 72, community 65 on the 2026-09-08 instrument, and the three receipts
still point at the pre-craft records.

PICK IT UP HERE: warm the three routes with curl and a browser user agent until they
answer in about two seconds, capture with
`node scripts/take-route-shots.mjs <class> <url> --states atlas=#atlas,market=#market,alerts-callout=#alerts`,
LOOK at the shots, then re-score and rewrite the three receipts. Do not call the defects
closed until a separate evaluator has seen them. The tool will refuse to write a record
that caught the degraded read, so a throw there means warm the route again, not a bug.

**Next (the queue, in order)**
1. SITE-02 `/sell`: show the sourced answer between the address and the contact step
   (the form goes straight to email today). The DAL for the answer exists:
   `lib/data/places/getPlaceValueAnswer.ts` + `lib/cma/place-comps.ts`.
2. SITE-03 place hero button with live count + verdict; SITE-04 alerts strip; then down
   the list. SITE-M1 (homepage brokers section on phones) was Matt's "fix" answer.
3. 2026-10-05: re-open SITE-01, read `cmas.request_source='place-page'` rows stitched by
   rr_vid and Search Console clicks on `/communities/*`; done if both hold; then the Bend
   neighborhood route gets the same primitive.

**Do not**
- Re-audit the site or write a punch-list doc; append to a SITE node instead.
- Put a dollar figure on a public page for a typed address (Matt: hold it for the CMA).
- Add a registration wall (Matt: no wall, email-only asks).

## Prior — 2026-09-07 (Claude Fable) — voice canon retired, one voice doc

Owner: Claude (Fable). Worktree `~/RyanRealty-aeo-bend-truth`, branch
`chore/retire-voice-canon`, landing on `origin/main` with this block.

**Matt's directive:** "get rid of our voice canon, nuke it", "too many stupid rules
affecting how we create copy", "one unified voice that everything uses".

**Shipped**
- `marketing_brain_skills/brand-voice/VOICE.md` rewritten as the ONE voice doc (path kept
  so ~230 SKILL.md citations stay valid): local experts, exceptional customer service,
  warm and direct, normal punctuation, no word lists. Compliance lines only: real numbers
  (§0), real quotes, fair housing, MLS remarks as written. Exemplars inside.
- CLAUDE.md §2 replaced. Removed: ci:brand-voice, ci:voice-constructions(+parity),
  ci:voice-send-paths, ci:voice-vocab-parity, ci:voice-reviewer, ci:voice-rewrite-batch,
  ci:voice-db-copy, ci:newsletter-voice-paths; lib/voice/**, lib/brand-voice/**,
  lib/crm/templateVoiceCheck.ts, lib/email/voice-precheck.ts; the ESLint rule; the
  pre-commit block; the pre-tool-use Refusal 6; the /voice-canon skill; voice_grader.md;
  the two design-system voice preview cards. Thirteen send paths (CMA, BPO, blog, social,
  Studio caption, newsletter x4, CRM templates + compose) no longer hard-fail on voice.
- Contact + reviews pages: "A broker answers, not a desk" replaced (Matt rejected it).
- app/_v3/home-featured-communities.ts: pulse lookup uses geo_type 'neighborhood'
  (resort rows live there); ci:studio-geo-contract was red on main.

**Next (approved by Matt)**
1. Marketing brain dead layer: delete lib/marketing-brain/{generate-briefs,diagnose,
   platform-trends,performance-bias}.ts, the audit-* routes + libs, /dashboard/marketing
   pages, producer skills marked UNUSED in producers/REGISTRY.md, automation_skills
   triggers/automation, producer scripts + gates (ci:producer-skills,
   ci:producer-registry-resolves). KEEP intake (inbox-*), snapshot.ts (tracerfy-history
   imports isAuthorizedCron from it), measurement-loop, competitor-recon,
   deliverable-{path,share,library}, platform-fetch-code, and the marketing_brain_actions
   table (CMA/Studio/agent job queue).
2. Google review email template in crm_templates in the new voice; update
   lib/crm/review-ask.ts body to match.
3. Rewrite Home, About, Contact, Team, Sell, Buy copy in the new voice. Founding facts:
   LLC since 2014, Bend office opened June 2023.

**Do not**
- Reintroduce word lists, punctuation regexes, or a voice gate. Judgment, not regex.

---

# Previous — 2026-09-07 (Social channel tune-up)

Owner: Claude session, worktree `wt/social-x-lock-20260907`. Brief with every figure and
its source: https://claude.ai/code/artifact/15e70783-7dde-4017-b973-80bb5a65c832

**Shipped this commit**
- `lib/x.ts`: X refresh serialized behind an Upstash lock, lock losers wait for the
  persisted row. Root cause of the 2026-08-28 X death: token-heartbeat and
  snapshot-channels both refreshed the rotating token at 12:00Z. Test
  `lib/x.refresh-lock.test.ts`.
- `vercel.json`: snapshot-channels moved to `20 12 * * *`.
- `lib/brand/contact.ts`: YouTube points at the channel-id URL of @Ryan-Realty
  (91 videos), the channel Matt picked. The @ryanrealtybend handle currently sits on a
  7-video duplicate and Matt is moving it.

**Done live on the platforms (2026-09-07, read back)**
- GBP attributes: tiktok → @ryanrealtybend, pinterest → /ryanrealtybend, text →
  sms:+15417033095 (was the old direct line), appointment → ryan-realty.com/book (was a 404).
- GBP: replied to MJB's 5-star review from 10 Jul (approved wording). 0 unanswered.

**Matt's calls (2026-09-07):** keep @Ryan-Realty on YouTube and move the handle · keep
TikTok @ryanrealtybend, delete @ryanrealtyllc · keep Pinterest /ryanrealty (revised later that
day from /ryanrealtybend), close /ryanrealtybend · KCM feed off on Instagram, stays on Facebook · hours stay 5 AM to 7 PM daily ·
reconnect X · fix LinkedIn page facts · review reply as written.

**Waiting on Matt (manual, not API-reachable):** YouTube handle swap then re-grant at
`/api/youtube/authorize` as the @Ryan-Realty owner · X re-grant at `/api/x/authorize` · TikTok
display name, Business account, delete duplicate · Pinterest rename, close duplicate · KCM:
disconnect Instagram · LinkedIn: 115 NW Oregon Ave #2, founded 2023, 2 to 10 employees,
Privately Held · Instagram: https website, bio double space, name field.

**Next for an agent once the YouTube token is re-granted:** upload
`design_system/ryan-realty/assets/social/banner-photo/banner-2048x1152-youtube.jpg` as the
banner, set the most-viewed short as trailer, prune the 8 empty playlists. After the X
re-grant, confirm the 12:00Z heartbeat rolls `x_auth.expires_at` and the 12:20Z snapshot
writes `x` rows.

**Do not** rewrite the social bios on voice-canon grounds. Matt 2026-09-07: the canon is
"still wrong". Copy he chose stays until he asks.

**YouTube wired into the site (later 7 Sep, `wt/youtube-wire-20260907`).** Matt kept
@Ryan-Realty on matt.lists.homes@gmail.com (declined the Brand Account move) and said
"just wire it in to our site". Done: every approved area-guide asset carries its channel
upload in `used_in` (render_type `youtube`, 150 rows via lib/asset-library.mjs markUsed,
manifest committed); `getAreaGuideVideo` exposes `youtube`; the area-guide row now opens
the channel and community + subdivision pages gained the row (contract tests moved with a
reason); every place page emits a VideoObject (new `type: 'video'` in lib/site/json-ld);
8 `listing_videos` rows (source `youtube`) put the channel's listing tours on the seven
Ryan Realty listings they film. Alias geo_tags added: inn-of-the-7th-mountain, rivers-edge,
mt-bachelor-village, three-rivers. Still Matt's: the token grant as matt.lists.homes@gmail.com,
the handle claim on 22 Sep.

---

# Previous — 2026-09-07 (CMA funnel mission: four lanes, one engine, approved → sent → tracked)

Owner: Claude (Fable). Landed on `origin/main` at `d3e573aa` from `wt/cma-ship-20260907`
(merge of `wt/cma-doc-`, `-lanes-`, `-tracking-`, `-engine-20260907`). Goal doc of record:
`docs/plans/CMA_FUNNEL_MISSION_2026-09-07.md` (per-stream ledger) and
`docs/plans/CMA_DOC_PUNCHLIST_2026-09-07.md`. Matt 2026-09-07: "expireds/fsbo/seller
valuation/and BPOs all using the same engine but with their own nuances, easily managed and
tracked … approved and then sent out and tracked so that we can get leads."

**Shipped**
- `scripts/cma-lookpass.ts <slug>`: every chapter screenshotted at letter 816/375 and immersive
  1280/375 from `render_args`, read-only. THE visual gate before a CMA URL goes to Matt.
- Document: expired "Your last listing" is chapter 3 with a price ruler (sold, unsold, your last
  ask, recommended); "How fast homes like yours went" days-to-offer bars with the city median tick;
  one comps matrix with thumbnails, lead line and legend; no count-up on §0 figures; one chapter
  order for print and immersive; `?print=1` renders from `render_args` like the PDF; phone
  layouts for both charts; MLS `N/A` never in seller text.
- Lanes: `request_source` backfilled (FSBO 2→15, unknown 36→19, migration
  `20260907130000`); `bpo` origin (rows live in `broker_price_opinions`, no auto-send path);
  `cma_lane_settings` (migration `20260907140000`) with per-lane **Auto-send, all OFF**,
  superuser-only; lane strip + filter on `/admin/cmas`; Approve-and-next; `lib/cma/auto-send.ts`
  after a build, `ready` rows only.
- Tracking: `email_events` now gets a `sent` row and the broker; `linkifyHttp` no longer eats
  the sentence-final period (every cold CMA email carried two 404 links); `getCmaOutcomes`,
  `getCmaLaneFunnel`; "What happened" panel on the review page; reply / first open → broker
  alert rail. Proven with one send to matt@ryan-realty.com (open, click, visit, identity).
- Engine: contract graded custom/new subjects with the resale exact-bath rule → fixed (59 of
  136 failures; 49 build); failed rows carry one broker-readable sentence; D12 fixed; audit v4
  (a `critical` in any category forces `review`) and `scripts/cma-reverdict.ts --write` run —
  66 stored verdicts moved, 45 left the ready lane; one DOM definition (final cycle
  list→off-market); concession count over the printed set.

**Open**
- The 59 bath-rule failures are being rebuilt for real (agent running at handoff time); see the
  lane census `npx tsx scripts/cma-lanes-check.ts`.
- Inbound EMAIL replies still do not advance the CRM stage or pause sequences (only the CMA
  alert is wired). `queueBrokerAlert` dedupe has no time bucket: a second reply never alerts.
- D21 in `CMA_STATE_OF_THE_WORLD.md`: price-tier guard has no reference when the subject's
  subdivision cell is thin or missing (29 of 290 built). Matt picks the fallback.
- `CmaLaneFunnel` exported, not yet mounted on the `/admin/cmas` list.
- 8 `zz-test-rebrand-*` fixtures leaked into production `cmas` (3 marked delivered).
- Grok session 2026-09-06 parked three public-page commits on `wt/public-pages-20260906` and
  left `stash@{22}` `wip-before-vercel-prod-cma` (two publish-check script edits).

## Prior — 2026-09-07 (AEO guide pack, backlog grind, title)

Owner: Claude (Fable). Worktree `~/RyanRealty-wt-aeo-audit`, branch
`wt/aeo-landing-20260907` (squash of `wt/aeo-briefs-audit-20260907` onto the
sibling's `90cffee8`). Earlier on `origin/main`: `5f9987ab` (fifteen guides + site
audit), `0301398e` (handoff).

**Shipped**
- Fifteen buyer + seller guides from the Cos AEO brief pack are live (six rewrites,
  three drafts rebuilt, six new). Matt then asked for the cut figures back, dated;
  they are in with their as-of dates. Ledger and brief-to-slug map:
  `docs/plans/PUBLIC_PRODUCT/AEO_GUIDES_2026-09.md`.
- Backlog grind (Matt: "yes, both"): 29 archived posts triaged. 13 restored on
  primary sources (rates, equity, rent vs buy on HUD FY2026 FMR, mortgage programs
  with 2026 limits, second home vs investment with 2026 IRS thresholds, wildfire
  code, insurance, renovations on NAR 2025, Bend housing target on OHNA), 16
  retired with redirects to the page that replaced each, 18 semicolon fixes on
  10 published posts. `blog_posts`: 80 published, 16 retired, 0 archived, 0 voice
  violations. Seeds: `aeo-guides-2026-09.ts`, `restored-guides-2026-09.ts`, one
  slug per file.
- Homepage title is `Homes for Sale in Central Oregon | Ryan Realty, Bend`
  (Matt 2026-09-07); VOICE.md, `ci:seo-shell`, and the hero test moved with it.
- Guides end in `<h2>Questions</h2>` + five h3/p pairs; `lib/blog/publish-blog-faq.ts`
  ships that as FAQPage JSON-LD. Site audit fixes: listing photo alt
  (`ci:listing-photo-alt`), search robots + og + ItemList, menu labels not h2,
  `/buy` FAQ corrected. The market page price FAQ and chrome scope are the
  sibling's `90cffee8`; this branch dropped its duplicate.
- Review sheet: https://claude.ai/code/artifact/f306abc5-26fc-4a95-a74f-eaf755797441

**Round three (same day), all landed through `10a9bcb2`**
- Sign-in prompt no longer auto-opens on `/blog/*` (`signin-prompt-policy.ts`, reason
  `guide`). Verified in a fresh browser.
- Monthly Bend + Redmond market report cron live: `/api/cron/blog-monthly-city-report`, 3rd
  of the month 15:00 UTC, reads the Market Truth series the market page charts (NOT the stats
  cache, which disagreed on Bend's August median). August 2026 posts published and match the
  pages. `?month=YYYY-MM&dry=1` is the check before any backfill.
- 52 older published posts triaged figure by figure (KEEP 5, FIX 37, RESTORE 9, RETIRE 1;
  files `triage2-g1/2/3.md` in the session scratchpad, summary in the ledger). Same-day fix
  pass: two fair-housing takedowns (`raising-kids-bend-parents-guide`,
  `schools-central-oregon-guide-families`, redirected), two retirements (wildfire standards,
  ADU proposal, redirected), seven steering sentences rewritten, five invented quotes removed,
  eight math corrections, legal sentences attributed to OREF and TRID. `blog_posts`: 78
  published (the two August reports included), 20 retired, 0 voice violations.
- Photographer shot list: `docs/plans/PUBLIC_PRODUCT/PHOTO_SHOT_LIST_2026-09.md`.
- The two takedowns are rewritten and back at their slugs (program, size, lookup, and offering
  facts, sourced, zero steering words). Redirects removed. Verified live after 00440ca9
  (200, FAQPage, heroes, legacy paths 301 to the blog URLs). `blog_posts`: 80 published, 18 retired.
- Next: the 37 FIX posts (mostly unsourced price tiers, HOA dues, rental income in the resort
  guides) and 9 RESTORE posts, exact sentences in the triage files.

**Open**
- Hero images for the nine new guides: resolved with real asset-library photos
  (grade A, owned, eyes-on, ids in the ledger). Generation went 0 for 22 across two
  rounds and two models, $13.70 total; the edit endpoint re-renders real geometry
  and fails the same way. Next time a subject needs a building, shoot it.
- From the answer-share baseline: a dated monthly Bend and Redmond report page
  with median sale price and months of supply stated once, and third-party
  profiles for all three brokers, are the next AEO moves. Any "median home price"
  in a guide is the sale price and month, matching the FAQ.
- `scripts/build-legacy-redirects.mjs` regenerates from the committed JSON plus
  its CURATED map; three stale CURATED targets were corrected so a regen no longer
  reverts hand fixes. Expect the live-sitemap 404 warnings.
- `npm run push` from a worktree branch stamps then runs a plain `git push` that
  fails with no upstream. Follow with `git push origin HEAD:main` inside the marker
  window, and fetch first: a sibling landing between rebase and push rejects it.

**Do not**
- Reseed blog posts without diffing against the live rows first.
- Print a figure in a guide without its as-of date and source in the ledger.

---

# Previous — 2026-09-07 (AI answer share: who the engines name for Bend)

Owner: Claude (Fable). Worktree `~/RyanRealty-aeo-bend-truth`, branch
`fix/bend-market-figure-truth`, landing on `origin/main` with this block.

**Measured** (report: https://claude.ai/code/artifact/8080b7fa-4cda-4bd8-9768-ad46f45b38c2,
baseline + browser recipes in memory `project_ai_visibility_2026-09`)
- Ryan Realty named in 0 of 16 non-personalized runs (ChatGPT anon 4, Google
  AI Mode anon 9, Gemini 3) across best-agent, sell-my-house, F1 battery,
  market, Sunriver, expired, Tetherow. Perplexity on Matt's account 3 of 7
  (unverifiable for personalization; logged-out Perplexity now forces signup).
- Shortlists are ordered by Google Business Profile review count (High Desert
  483, Ladd 270, Varsity 129, McGlone 100, Bend Premier 78; RR 25 site-reported)
  and Zillow review count (Schaake 239, Frazier 194, Keyte 191; Matt 6).
- The one non-personalized citation: Google AI Mode quoted the Bend FAQ JSON-LD
  "median list price $950,000" as Bend's median home price beside peers' sale
  medians ($733K to $780K). The page chart said "Median sale price $750K in Aug
  2026". Every F1 path in `lib/seo/ai-query-map.json` was cited by nobody.

**Shipped (this commit)**
- `lib/site/market-faq.ts` price answer leads with the median SALE price and
  month from the page chart series (`lib/market/latest-sale-median.ts`), then
  the list price of homes for sale, named as such. Dataset adds Median Sale
  Price. Wired on `/housing-market/[...slug]` and `/cities/[slug]`.
- `lib/site/chrome-live.ts` Market/Sell eyebrows say "Central Oregon": the
  region row rendered unlabeled on every page and read as that page's place.
- Admin analytics overview renders `aiReferrers` (was fetched and discarded).
- Scheduled task `ai-answer-share-bend-monthly` (desktop app, 1st of month
  09:00) reruns the battery and republishes the report.

**Found, not fixed**
- `review-ask-on-close` cron works but has only ever staged drafts for TEST
  people (crm_people 57840 "Marketing Test Lead", 63415 "Vault Test Buyer",
  61945 "G4 Accept"); zero review asks sent (no timeline row carries the GBP
  write-review URL). `tc_deals` holds ONE closed deal in the last 90 days and it
  is a Vault test (60935 Apollo Place). Real closings are not reaching
  `tc_deals` + `tc_deal_people`, so no real client is ever asked. Review count
  is the ranking; this rail is the fix and it is dry. Owner: TC/CRM.
- No Zillow review URL exists in the repo; a Zillow ask needs Matt's profile link.
- Third-party proof (Zillow, Realtor.com, FastExpert, U.S. News profiles) and any
  press release are publishing actions: Matt approves each.

**Do not**
- Compute a YoY percent in the FAQ from exact values: the chart writes its
  claim from compacted labels and the two can differ in the last digit.

---

# Previous — 2026-09-07 (AEO guide pack + site audit)

Owner: Claude (Fable). Worktree `~/RyanRealty-wt-aeo-audit`, branch
`wt/aeo-briefs-audit-20260907`, landed on `origin/main` at `5f9987ab`.

**Shipped**
- Fifteen buyer + seller guides from the Cos AEO brief pack are live in
  `blog_posts` (six rewrites in place, three drafts rebuilt, six new). Seed
  mirror `scripts/blog-content/aeo-guides-2026-09.ts`. Figure ledger and the
  brief-to-slug map: `docs/plans/PUBLIC_PRODUCT/AEO_GUIDES_2026-09.md`.
- Guides end in `<h2>Questions</h2>` + five h3/p pairs. `lib/blog/publish-blog-faq.ts`
  turns that into FAQPage JSON-LD on `/blog/[slug]`.
- Site audit fixes: listing photo alt (`ci:listing-photo-alt`), `/homes-for-sale`
  robots + og + WebPage/ItemList JSON-LD, mobile menu labels not h2, `/buy` FAQ
  compensation answer corrected.
- Review sheet for Matt: https://claude.ai/code/artifact/f306abc5-26fc-4a95-a74f-eaf755797441

**Open**
- Homepage `<title>` stays `Ryan Realty, Bend` (VOICE.md + `ci:seo-shell`). The audit
  wants a keyword title. Matt's call.
- Old cost-of-living / closing-cost / property-tax figures were cut, not replaced.
  Re-adding any needs a fresh primary-source pull (ledger lists what came out).
- `npm run push` from a worktree branch now stamps and then runs a plain `git push`,
  which fails with no upstream. Follow it with `git push origin HEAD:main` inside
  the marker window.

**Do not**
- Reseed blog posts with `scripts/seed-blog-posts.ts` without diffing against the
  live rows first (voice-canon rewrites live only in the DB for the other posts).

---

# Previous — 2026-09-06 (Cos takeover: public punch list)

Owner: Chief of Staff (Grok Bot). Took over Grok Build session
`01a06fc0-b2f2-7eb2-9e66-a7d1b8f12d07` ("Public UI punch list and place-page
spec") after weekly Grok Build limit. Mini: Matthews-Mini
`b9f01f4a-2e5a-46bb-abf3-70c65d76b6e4` · `~/RyanRealty` · branch `main`.

**Ship state**
- Local tip `af0b3611` **ahead of origin/main by 6** — still not pushed.
  Recent: `af0b3611` Cos takeover handoff + city hud.active gate · `c0dd043f`
  loosen city leftover hud · `cf7f714a` listing MOS HUD · `9153b113` listing
  12-section order · `c04e8a97` sell redirects / city index types · plus earlier.
- Production host https://ryan-realty.com. LOOP_SENTINEL off. Do not mix `_cma-*`.

**Spec locked**
- `docs/plans/PUBLIC_PRODUCT/` — SITE_PAGES, PAGE_INVENTORY, PLACE_PAGES,
  DATA_GRAPHICS, PAGE_OUTLINE. Looking (1440+375 shots) is the done gate.
  Navy/cream, one chrome, one stats source, place openings per PLACE_PAGES.

**Bots**
- **Public Patch** — landed / standby on Mini. Patches existing public pages
  only when Public Look (or Cos) files friction from the inventory. Mini then
  `git push` — no Cursor cloud. No new screens/product. No `_cma-*` / admin
  prospecting desks.
- **Public Look** — eyes-on 1440/375 against inventory winners (Homes Field,
  hub MOS, Tetherow, listing remainder, About/team Call/Text).

**Next (resume here)**
1. Push tip to `origin/main` from Mini when Cos clears the gate (or push if
   already clean).
2. Public Look files defects → Public Patch lands them on Mini, then push.
3. Keep drip/first-touch desks separate (Expired/FSBO Desk); Soft Tail +
   Clear Night skipped; Rim HOLD until rebuild stamp lands if still open.

**Do not**
- Cursor cloud agents unless Matt opens spend.
- Relitigate place openings vs leftover HUD.
- Touch CMA `_cma-*` worktrees in this thread.

---

# Previous — 2026-09-06 (CMA letter+375 look-pass)

2465 letter+375 look-pass after cover crop, 4+4 similar competition, 375
matrix scroll, unique sold ticks, both unsolds. Rec $389k. Title on the
cover is clean. A faint MLS location arrow can still ghost in the sky.
Do not mix public-page WIP. Skills read: tdd, dataviz.

---

# Previous — 2026-09-06 (Wave B: search chrome)

Homes Field: Google tiles stay, Google Draw/Map-dropdown/zoom are off.
MapChrome (Map/Satellite + zoom) + one Map/Split/List in the shell. Guest
Save this search is a chip that opens email, not an email field in the 375
dock. `view=list` stays on the Field. LOOP_SENTINEL stays off. Do not mix `_cma-*`.

Next: Wave C hub tiles-before-chart.

---

# Previous — 2026-09-06 (CMA one comps story)

Seller CMA spine is Home location, then How we got the price (one
matrix with thumbs + map), then who they compete with. Why $X, Photos,
and the second comps table are gone. "As your house" is Adjusted close.
2465 rebuilt. Rec $401k. Hayden Ranch pins still plot; TIGER US-97 says
same side. Do not send.

---

# Previous — 2026-09-06 (Wave A: LP 301s)

Place and sell LPs 308 to the inventory winners. `/lp/tetherow` → community,
`/lp/bend` → `/cities/bend`, seller LPs → `/sell`, buyer alerts → Homes Field,
luxury → Bend search `$1.5M+`. Capture stays on `/sell` (SellValueForm).
LOOP_SENTINEL stays off. Do not mix `_cma-*`.

Next: Wave B search chrome (Google UI, email-first 375, one view toggle).

# Previous — 2026-09-06 (remaining taste defects)

Four leftover first-viewport defects from the site-pages e2e review:

- `/homes-for-sale/bend` defaults to the same SearchFilters + MapSearchView
  split as regional `/homes-for-sale` (numeric `view=1..5` still grid).
- Tetherow belonging is a caption on the still, then Atlas. No `#facts` KPI.
- `/housing-market` opens on the MOS two-bar (homes for sale vs a month of
  sales). Median overlay is the fallback drawing.
- About/team portraits drop `--v3-section-pad` cream lakes. Team fold is
  photo + Call/Text/Email.

Looked at localhost 1440/375. Separate evaluators wrote `tasteReview` + PNG
receipts (search 54, community 57, about 51, team 47, market 54). LOOP_SENTINEL
stays off. Do not mix untracked `_cma-*` / deep-audit punchlist scripts.

---

# Previous — 2026-09-05 (dataviz skill)

`.claude/skills/dataviz/` is the chart method TASTE.md named and that
this session did not load. Form first, navy on cream, thin marks, Geist
on figures, never dual axis, never a number on every stem. Seasonality
on 2465 is now a line with Apr/May labeled. Rec $401k unchanged. Do not
send.

Studio slate stays off. Uncommitted deep-audit punchlist files remain. Do not
mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-05 (CMA mannered prose, second pass)

Seller CMA copy is facts only. Audit "meaning" lecture is gone at source and
stripped at render so stored rows clean up without a rebuild. 2465 7th print
HTML was re-rendered from render_args. Fail-pile rebuild still running on the
local xAI key. Do not send letters.

Studio slate stays off. Uncommitted deep-audit punchlist files remain. Do not
mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-05 (CMA first-build audit)

Judge/audit run on the local xAI key (`lib/grok`), not Anthropic. Failed last
list is stamped before the audit. Fabricated judge prose is replaced with an
honest retained-count line so first builds can pass. CLI rebuild of the fail
pile is running: `npx tsx scripts/_rebuild-failing-cmas.ts`.

Studio slate stays off. Uncommitted deep-audit punchlist files remain. Do not
mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-05 (Studio slate off)

Studio does not create on a clock. `/api/cron/studio-slate` is unscheduled
and no-ops unless `STUDIO_SLATE_ENABLED=1`. Produce from `/admin/studio` only.

---

# Previous — 2026-09-05 (CMA queue + expired list cap)

`/admin/cmas` is the one list: filter by address, city, origin, created date, recommended price. Rows show range, rec, and last list on expireds. Review is numbers + the origin-aware email + Approve & send.

Expired CMAs cannot print a list above the failed last ask (engine clip + accuracy contract). Asked/FSBO/expired copy still differs only in the opening.

Uncommitted deep-audit punchlist files remain in the working tree. Do not mix. Golf Track C stays on local `wt/golf-maps-20260903`.

---

# Previous — 2026-09-04 (golf Track C) — five remaining maps ship as operator plates

OSM still has no numbered 18/9 (unclipped cache, bbox XML, Overpass 504).
Do not invent. Do not re-open Nicklaus (`dfdfe4d2`). Do not number leftover
Pronghorn ways as Fazio.

Shipped rasters + `V3CourseMap` plate path. `hasCourseMap` true for plate OR holes.

- **fazio** — PRHF-SC.pdf map+card. Juniper Preserve scorecard, not a survey.
- **rivers-edge** — Updated-Scorecard.jpg map panel.
- **greens-at-redmond** — golfthegreens.com scorecard map panel.
- **desert-peaks** — operator `new-course-layout.jpg`.
- **eagle-crest-challenge** — 2026 Ridge+Challenge PDF page 2 (Challenge only).

Community rank prefers OSM, so Pronghorn still shows Nicklaus. Local
`wt/golf-maps-20260903`. Do not push this branch.

---

# Previous — 2026-09-03 (golf, Pronghorn Nicklaus) — twenty courses became twenty-one

The naming is solved. Do not re-ask. Operator scorecard `PRH-SC.pdf` is titled
**NICKLAUS COURSE**, TIPS 7,379 (USGA CourseID 5779). OSM par tags on the cluster
near 44.1865, −121.1715 are 4-5-3-4-4-4-3-5-4-4-4-4-4-3-5-5-3-4, summing to 72 —
exact match. Scorecard layout (1 west, 3 north, 15 southwest, practice by 1)
matches those centroids.

**Shipped** `data/golf/course-maps/pronghorn.json` with `courseSlug:
'pronghorn-nicklaus'`. Loader key is the registry slug. Cluster-inside-neighborhood
`pronghorn`, same provenance as Broken Top, **not clipped to the hood polygon**
(it covers 4 of 21 holes). Duplicate untagged `ref=17` farther west and two
unnumbered ways dropped; they are not Fazio. No bounds ring. Par 72 prints.
Yards 6,788 vs 7,379 **HELD** — do not fudge length. `pronghorn-fazio` stays
refused. `data/golf/courses.ts` par/yards untouched.

**Join.** `REGISTRY_SHORT_NAME['pronghorn']` is `Pronghorn Nicklaus`, not
`Pronghorn`. The registry has two shortNames on that property; the OSM cluster
is one eighteen.

---

# Previous — 2026-09-03 (golf, main) — sixteen courses became twenty, and the reason they were not

Matt asked for all Central Oregon courses. I reported sixteen and said
OpenStreetMap had no hole geometry for ten. **That was a conclusion from one
query shape, and it was wrong for four of them.**

`scripts/golf/fetch-osm-courses.py` clips every feature to the course's own
named `leisure=golf_course` polygon. The broad count — every `golf=hole` way in
the region, unclipped — returns 363, and **180 of them sit inside no such polygon
at all**. A boundary-clipped fetch could never have seen them. CLAUDE.md §0
carries the rule I skipped: run a second, differently-shaped check before
reporting an absence.

| | shipped | measured |
|---|---|---|
| **Broken Top, Brasada Canyons** `81adfb15` | Complete numbered eighteens. Neither has a golf_course polygon, so each is bounded by its own hole cluster, identified by the neighborhood polygon in `public.boundaries` that contains it. Both halves are needed: Pronghorn's neighborhood polygon covers 4 of the 21 holes on the property, Broken Top's covers the whole residential community, and a bare cluster has no name. | Broken Top par 72 OK, yards 6,337 vs 7,161 HELD. Brasada par 73 vs 72 HELD, yards 7,368 vs 7,295 HELD. 18 discs, 44×44 taps, no h-scroll at 390 and 1440. |
| **Awbrey Glen, Quail Run** `d483feeb` | Eighteen routings each and exactly one tag on every feature: `golf`. Mapped, not numbered. Heading is "drawn from the air"; marks are dots; no scorecard, so the marks are the control with a roving tabindex and Enter/Space wired by hand, each named by its own measured sentence. | Tapping the sixth mark moves the card to it; two ArrowRights move focus and selection together. 18 marks, none under 44px, one card visible. |

**Three fixes the render found, two of them older than this work.**
The source line said "clipped to the course boundary" on courses whose boundary
is a cluster extent — each file records which, and the line says it. The
selection island read the scorecard buttons to find its hole list, found none on
a course with no scorecard, and returned, leaving all eighteen cards on screen.
And `sentence()` capitalised the first clause but not the second, so every hole
that bends, carries water and has no bunker shipped "Doglegs left. water on the
hole." on all twenty courses.

**Two data fixes.** Brasada drew a 23-acre centre-pivot farm circle 626 m from
the nearest hole, because turf is inferred from colour and not from a tag; turf
now has to sit within 250 m of a routing. That number is measured, not chosen:
across the sixteen courses bounded by their own polygon the farthest turf blob
is 213 m, so nothing already built moved. And a cluster-bounded course no longer
draws its bounds ring — that rectangle is where the query stopped, not the edge
of the property.

**The six that still have no map, each checked twice:**
- **Pronghorn Nicklaus, Pronghorn Fazio** — one complete numbered eighteen on the
  property, par 72. Both courses are par 72, at 7,379 and 7,456 yards, and
  nothing in the tags says which is mapped; the routings run 8–9% under both
  cards, so length does not separate them either. A course map has to name its
  course. **This one is recoverable** — any source that says which part of the
  property is the Nicklaus routing unblocks it.
- **River's Edge** — zero features inside its polygon, re-checked by distance.
- **The Greens at Redmond** — one clubhouse within 3 km. **Desert Peaks** — zero
  within 3 km of its own polygon's centroid. **Eagle Crest Challenge** — three
  holes, numbered 12, 13 and 14, below the quarter-missing floor.

**Also.** `lib/golf` had no tests at all, with every §0 refusal living in it. The
fourteen added were each checked by breaking the rule and watching them go red.
And I corrected `d516979c`'s hover regression on the search map in `92ef0d72` —
see the block below; live production measures 22/23 marks owning their own
centre, and the one that does not is pre-existing Google marker overlap,
identical with the tap layer on and off.

**Carry forward:**
- The neighborhood-boundary join is hand-written in `NEIGHBORHOOD_COURSES` and in
  `scripts/golf/export-neighborhood-polys.mjs`. Awbrey Glen's course sits inside
  `bend-awbrey-butte`, not inside the `awbrey-glen` row, so a slug match would
  pick the wrong polygon and return nothing.
- `/tmp/region-golf-holes.json` caches the one region-wide hole pull. The public
  Overpass mirrors 504 on almost everything else; that query is the only one that
  reliably returns, and re-running the fetch after a code change should not have
  to win that race again.
- `geo_type` in `public.boundaries` is `neighborhood`, never `community`. Asking
  for `community` returns "no boundary row" for every resort we have.

---

# Previous — 2026-09-02 (/endtoend all open tasks, main) — the four open items are closed

Matt: `/endtoend all open tasks`. All four shipped, each measured on a running
server rather than asserted. Three ran as parallel workers on exclusive file
sets; the calculator was mine.

| | what shipped | measured |
|---|---|---|
| **Rental calculator off shadcn** `094a21ed` | 56 `data-slot` elements gone from TWO public routes. Native `input[type=range]`, `select`, `details`, a real `table`, V3Button. The four hover tooltips behind 16px "?" buttons became one "What these mean" fold, always in the DOM. `analyzeRental` untouched. | 0 data-slot, 22 controls, none under 44px, no h-scroll at 390 and 1440 on both routes. Walked for real: price 650k→450k and rent 3,250→3,400 moved cash flow −$1,055→+$24/mo; five ArrowRight on the slider 25%→30%; 15-year term −$579/mo; projection fold 7 rows + chart; lead form 44px fields. 30/30 rental-analysis tests. |
| **Four controls under the floor** `9ce57105` | chart-card source summary 17.84→44, instrument fold 42.34→44, save-search email 32→44, map view strip 28→44, plus the submit beside the email. | Section cost priced each time: +20.56 per chart card (a bare min-height cost 26.16; trading the parent's padding bought 5.6 back), +1.66, +12, +16. `/cities/bend` 21,285→21,401px at 390. `/homes-for-sale` does not grow — the map shell absorbs it. |
| **Map marks** `d516979c` + `92ef0d72` | Cluster bubbles and price pills carry a 44px `::after`; the paint is untouched. Three things the render taught. Hit-testing follows PAINT ORDER, so an unclamped box on an upper mark steals a lower one's centre — the upper one is cut instead. Google attaches marker DOM several frames after every event hook fires, so a MutationObserver is the only thing that catches it: last hook at 2.97s, marks in the DOM after, zero boxes fitted. And the box itself broke hover, which `d516979c` shipped without — see the correction below. | Verified independently of the worker, twice. Before the hover fix: 23 marks on /cities/bend at 390 and 1440, all in view, every one resolving to ITSELF at its centre, none stolen, targets 44x44 and 60x44. After: 20/20 at both widths, 0 stolen, every box 44x44, and the mark count holds across 10 samples with the pointer parked on a mark. |
| **G71, the gate** `4146c139` | Runtime Playwright over 8 routes at two viewports. Static could not work: the failures have no declared box, and the WCAG 2.5.8 Equivalent exception is a fact about the rendered page. Ratcheted by SIGNATURE — an href-keyed first cut produced 57 rows, 30 for one footer list, which is the cliff that gets a gate deleted. | 3,263 controls, 132 excused by Equivalent, 25 signatures baselined. Both red paths proven against a mutated-then-restored baseline. The exception is load-bearing: disabled, the homepage alone fails on the atlas polygons at 4.9x5.5. |

**The tap layer broke hover, and `d516979c` was already on main when the worker
reported it.** Two faults, both inside `SearchMapClustered.tsx`, both fixed in
`92ef0d72`. Hover was bound per marker on the content element; Google re-slots a
marker when its zIndex changes, so `mouseleave` lost its element and the pill
stayed emphasised after the pointer left (3/3 with the layer on, 0/3 with it
off). Hover is delegated to the map container now and keyed off
`data-listing-key`, which survives re-slotting. And the emphasised marker sat at
`MAX_ZINDEX` while cluster bubbles sit at `MAX_ZINDEX + count`, so a hovered pill
drew *under* a cluster it overlapped: pointer resolved to the cluster, hover
cleared, pill shrank, pointer resolved to the pill, and it flapped every frame.
Emphasis goes to `MAX_ZINDEX * 2`. `fitMapMarkTaps` also slides the box
(`--rr-map-mark-tap-x/-y`) before it trims, and never shrinks below the painted
footprint.

**The one honest caveat on the map marks.** Giving every mark a 44px box means
neighbours occlude more of each other, so the *contiguous* region around a mark
that still answers to it shrinks in some frames. That is the nearest-wins
behaviour the brief allows, and every mark still owns its own centre in every
frame measured. What it buys: a click 4px outside a cluster's painted circle now
fires `click`/`gmp-click` on that cluster, where before no point outside a mark's
paint resolved to it at all. The map screenshot with the layer on and off differs
by 0 pixels.

**Also fixed, found by the review sweep and not by a report:** `/communities/tetherow`
shipped "Value my home" twice — `buildExploreEdges` adds it and the page pushed
it again — so the closing block carried a duplicate exit and React warned on
duplicate keys. `splitQuietItems` dedupes by href now, so no caller can repeat
it (`53127679`).

**The review pass.** 13 routes x 2 widths: zero horizontal scroll anywhere,
exactly one `h1` per page, no unnamed links. Full suite 1,531 files / 16,190
tests green. The only console flags left are Google Maps announcing a vector to
raster fallback on map pages, which is theirs.

**Two corrections to what this session believed going in.** `.v3-field__pin` is
not a control — it is a span with a mouseenter handler inside an aria-hidden
plot, no href — so the "pin hrefs are duplicated by row anchors" mitigation
describes something that is not there. And zero in-degree is not dead code,
again: `PublicProductTypes` is recorded as replaced in four parity.json files
and imported by nothing findable, and G46 caught that
`NeighborhoodMarketContext` imports it.

**Carry forward:**
- G71's baseline was recorded against a dev server, the only one available here.
  If CI's production build reports a signature that is not in it, re-record with
  `ci:tap-targets:start` rather than deleting rows. The header says so.
- G71 is PR-time, not push-to-main: it needs a server, so it runs in the CI step
  that already starts one for route-smoke and the payload ratchet.
- The 25 baselined signatures are the real remaining debt, now visible on every
  run: 214 footer links at 203.2x32, 40 nav carets at 32x44, 35 footer
  disclosures at 203.2x17.8, 18 chart tabs at 47.6x32, and 19 search-UI controls.
- A `V3Field` atom would retire the rental calculator's `.design-token-lint-ignore`
  entry. The barrel has V3Filter (a search box) and no generic labelled field.

---

# Previous — 2026-09-02 (golf maps + the punch list, main) — sixteen courses, five items closed

Matt: "finish all Central Oregon courses and then finish the primary items in
this session, I want it all and I want it all done the best."

## The courses — 16 of 26, and the other 10 are a data wall

See the block below for the pipeline, the three build paths and the §0 refusals;
it is unchanged except that the count went 10 → 16 and a separate evaluator then
failed the section on four counts, all fixed:

- **The source line attributed per-hole par and yardage to the USGA.** A hole's
  length is the measured length of an OSM polyline and its par is a raw OSM tag;
  the USGA supplies the two totals in the claim line and nothing else. The trace
  is split, and a basis line sits with the figures.
- **A duplicate stroke index shipped** (Eagle Crest Resort printed index 6 on
  holes 10 and 11). A stroke index is a permutation of 1..N, so it reconciles as
  a SET now — complete and unique — or it does not print. It prints on no course
  today, which is the honest state of the tags.
- **Two totals for one course disagreed on one screen**: the USGA claim against
  the summed routings (Crooked River Ranch 5,818 vs 5,763). The nine totals say
  "measured" now.
- **The hole numbers failed AA on every map**: dimming the disc to 0.45 put
  cream-on-navy at 2.73–3.79:1. State is in the FORM now, a ring against a
  filled disc, both at 14.23:1.

Plus five more from the same pass: the scorecard's columns lied on courses with
missing holes (hole 3 sat in column 2), a nine that could total nothing printed
"Out" alone, the green and the water had no `.is-on` rule so a card reading
"water on the hole" lit no water, the buttons announced as "1 4", and the cells
measured 37×44px.

**~~The ten without maps are blocked on OpenStreetMap, not on us.~~ WRONG — see
the 2026-09-03 block at the top of this file.** Four of the ten had complete
hole geometry the whole time; it sits inside no `leisure=golf_course` polygon, so
a boundary-clipped fetch could not see it. Quail Run's own polygon holds 18
holes. Broken Top, Brasada Canyons, Awbrey Glen and Quail Run all ship now, and
twenty of the twenty-six have a map. The paragraph is left standing because it is
what a second query shape would have caught.

## The punch list — all five, plus two the recon surfaced

A ten-agent read-only recon measured every item against the live build and then
adversarially verified its own findings, which changed three of them materially.

| item | what shipped |
|---|---|
| `#belonging` prose class | V3Quiet gained `fact`, `chips` and `fold` rows. Tetherow 2,974 → 2,374px at 1440, 4,042 → 2,799 at 390, with the DOM word count unchanged. |
| `/communities#all-communities` | 600 links off shadcn onto the barrel: 14px text in an 18px box → 16px navy in a 44px row. Two new atoms, V3Filter and V3Segmented. |
| undeclared `.skeleton` | V3Placeholder (paint only) + V3Loading (the v3 section rhythm). Nine public routes are five lines each. |
| V3Proof | The homepage's eight hardcoded testimonials are the live Google reviews. 1,557 → 964px, with figures, dates and a door. |
| marks under 44px | The review strip's closest pair went 0.00px → 24.00 at 1440 and 10.94 at 390. The listing page's `?` link got a rule; it had none anywhere. |

**Two the recon found that were not on the list, both worse than the items:**

- **The listing page's broker contact rendered at NO width.** The mobile bar is
  `position: fixed` and lived inside `.listing-detail-aside`, which is
  `display: none` below 64rem — a fixed element does not escape a hidden
  ancestor — and the desktop card was hidden at exactly the width the aside
  appears. Measured 0×0 for both at 390, 1024 and 1440; now 390×56 and 518×510.
  The CSS comment above the bar reads "Conversion-critical."
- **The footer disclosure lied.** Above 40rem it was closed while CSS forced its
  list visible, so a screen reader met a control announced COLLAPSED over
  thirteen visible links. It ships `open` now and an island closes it narrow —
  that direction, because the inverse hides 52 destinations from every crawler
  that does not run JS.

## Still open

- **RentalCalculator on the public listing page**: 56 shadcn `data-slot`
  elements on a public surface, a straight §3 violation. It is a real rewrite,
  not a swap.
- **Map cluster and price pills** (`SearchMapClustered`): 32×32 / 38×38 /
  60×25, 22 of 23 under 44px on /cities/bend. Use the transparent-wrapper form
  the course map proved.
- **Control heights**: `.v3-chartcard__source-summary` 17.84px,
  `.v3-instrument__fold-summary` 42.34, `#save-search-email` 32,
  `.map-search-views` 26.
- **A tap-target gate** (§6). It must encode the WCAG Equivalent exception or it
  fails the atlas and the field pins on every run: a control under 44px fails
  only when no same-page control does the same job at ≥44px. Both existing
  mitigations are machine-checkable — atlas chips match places 1:1 by name,
  field-pin hrefs match row hrefs 1:1.

**Two traps worth carrying.** Zero in-degree is not dead code, again: I nearly
deleted PublicProductTypes on the strength of four parity.json files recording
it replaced and a grep that found no importer. G46 caught it —
NeighborhoodMarketContext imports it. And `git checkout HEAD -- <path>` on a
file the HEAD commit deleted does not restore it; chained with a `git show`
fallback it wrote two EMPTY files that then broke the same gate.

---

# Previous — 2026-09-02 (golf course maps + footer, main) — sixteen courses drawn hole by hole

Matt asked for the course map on the golf communities and then for all of Central
Oregon, against his restated standard that a page must be the best page on the
internet for its exact subject.

**Shipped, all on origin/main:** `V3CourseMap`, a new barrel pattern, on
`/central-oregon/golf/[slug]` (16 of 26 courses) and on seven community pages
(Tetherow, Crosswater, Sunriver, Caldera Springs, Black Butte Ranch, Eagle Crest,
Widgi Creek). Plus the footer disclosure fix and the golf hub's value column.

| | |
|---|---|
| Courses with a map | Tetherow, Crosswater, Sunriver Meadows, Sunriver Woodlands, Eagle Crest Ridge, Eagle Crest Resort, Aspen Lakes, Juniper, Bend Golf & Country Club, Widgi Creek, Glaze Meadow, Big Meadow, Meadow Lakes, Crooked River Ranch, Lost Tracks, Caldera Links |
| Committed geometry | `data/golf/course-maps/*.json`, 1.4 MB, one lazy import per page |
| Refused | Quail Run and River's Edge (boundary in OSM, nothing inside it); Pronghorn ×2, Brasada Canyons, Broken Top, Awbrey Glen, Eagle Crest Challenge, The Greens at Redmond, Desert Peaks (no polygon carrying golf features) |

**Where the geometry comes from.** OSM has greens, bunkers, tees and hole
routings; its fairway coverage is partial (12 of Tetherow's 18), so the fairway
body is mown turf traced out of Oregon's OSIP 2018 aerial, clipped to the
course's own named `leisure=golf_course` polygon. That boundary is load-bearing:
a radius query around Crosswater's clubhouse also returns Caldera Links and the
map then numbers 36 holes 1 to 18 twice.

**The hole notes are measured, not written.** Dogleg is the turn angle of the
routing on screen, bunker count is the number of bunker shapes that light when
the hole is selected, water is a drawn hazard. `lib/golf/course-map.ts`.

**Three build paths, each stated on the page:**
1. Routed and complete — the normal case.
2. Routed and short. A course may miss up to a QUARTER of its holes; the page
   names every absent one ("Holes 2, 12, 13, 14 have no routing in the map data")
   and prints no superlatives, because "longest hole" over 14 of 18 can name the
   wrong hole.
3. **Green-anchored.** Big Meadow has 19 greens, 64 bunkers, 51 tees and not one
   `golf=hole` way — but 18 of its greens carry `ref` 1 to 18, which IS the
   numbering. The number marks the green, nothing claims a length or a shape, and
   the section says so. The routing is NOT inferred: pairing a tee to a green by
   proximity has no unique answer (the tee for hole N sits beside green N-1) and
   a line between a guessed pair is a shape the course does not have, which would
   then be measured for a dogleg and printed as one.

**§0 refusals, all live.** Per-hole par prints only when the holes sum to the
published par (Tetherow's OSM tags sum to 71 on a par-72 course). Per-hole
yardage only within 1% of the published card. Green square footage is measured
and never published — OSM traces some greens as the whole complex and Crosswater
would print an 18,300 sq ft putting surface. A stroke index outside 1..holes is
dropped (OSM carries `handicap=-1` at Eagle Crest Ridge).

**The turf threshold is chosen by looking, per course.** `python3
scripts/golf/trace-turf.py <slug> --sweep` renders the candidate bands as red
overlays on the aerial side by side. Per course because what the threshold
separates turf FROM differs: sage at Tetherow (loose, 60 acres), wet meadow at
Crosswater (tight — loose floods the Deschutes floodplain and reports 115 acres
where 47 are fairway), pine shadow at Widgi Creek (widest, 8 acres on the default
against 46). Reasoning about HSV instead produced 3 acres on one attempt and 425
on another.

**Pipeline, one command per stage:** `scripts/golf/fetch-osm-courses.py` →
`scripts/golf/trace-turf.py <slug>` → `scripts/golf/build-course-maps.mjs`.

**Traps found here.** The registry parser read single-quoted fields only, so
River's Edge reported "no registry row" while sitting in `data/golf/courses.ts`;
fixing it also surfaced Bend Golf & Country Club. The ArcGIS image server answers
an oversized request with a JSON body that lands on disk as an unopenable `.png`.
Anything sized in SVG user units scales with the drawing, not the screen: a 44px
tap target measured 20px on Juniper at 390 and the hole numbers were 6px on a
desktop Juniper, so both moved into a percent-positioned HTML layer over the map.
Fading the unselected course to emphasise one hole wiped the map — turf sits at
20% of navy and a 0.18 multiplier left under 4% ink.

**Two other things shipped in the same stretch:**
- **The footer fold reports the state it is in.** Above 40rem the disclosure was
  closed and CSS forced its list visible, so a screen reader met a control
  announced COLLAPSED over thirteen visible links. The markup ships `open` and an
  island closes it below 56.25rem — that direction, because the inverse hides 52
  footer destinations from every crawler that does not run JS. The two- and
  three-column grid steps are deleted, which is what removed the blank-cream
  defect at 640–899 for good: no fold ever sits in a grid now. Footer height
  measured 947/884/862/862/862/907/907/907 at 390/640/768/834/899/900/1024/1440.
- **The golf hub's value column.** It printed "18 holes" on 24 of 26 rows. It is
  back-tee yardage now, ordered longest first, with V3Ledger's bar encode.

**Open here:** the ten refused courses need OSM hole geometry that does not
exist. The fix is contributing it upstream, which is slow but permanent.

---

# Previous — 2026-09-02 (golf course maps, main) — ten courses drawn hole by hole

Matt asked for the course map on the golf communities: "a beautiful course map with
hole descriptions or whatever," against his restated standard that a page must be the
best page on the internet for its exact subject.

**Shipped, all on origin/main, verified in production:** `V3CourseMap`, a new barrel
pattern, on `/central-oregon/golf/[slug]` (10 courses) and on six community pages
(Tetherow, Crosswater, Sunriver, Black Butte Ranch, Eagle Crest, Widgi Creek).

| | |
|---|---|
| Courses with a map | Tetherow, Crosswater, Sunriver Meadows, Sunriver Woodlands, Eagle Crest Ridge, Aspen Lakes, Juniper, Bend Golf & Country Club, Widgi Creek, Glaze Meadow |
| Committed geometry | `data/golf/course-maps/*.json`, 956 KB, one lazy import per page |
| Refused | Caldera Links 8/9, Eagle Crest Resort 14/18, Lost Tracks 15/18, Big Meadow, Quail Run, River's Edge 0/18 |

**Where the geometry comes from.** Two sources. OSM has the greens, bunkers, tees and
hole routings but its fairway coverage is partial (12 of Tetherow's 18), so the
fairway body is mown turf traced out of Oregon's OSIP 2018 aerial, clipped to the
course's own named `leisure=golf_course` polygon. That boundary is load-bearing: a
radius query around Crosswater's clubhouse also returns Caldera Links and the map
then numbers 36 holes 1 to 18 twice.

**The hole notes are measured, not written.** Dogleg is the turn angle of the routing
on screen, bunker count is the number of bunker shapes that light when you select the
hole, water is a drawn hazard. Sentence and picture come from one array, so the claim
is checkable by looking. `lib/golf/course-map.ts`.

**§0 refusals, all live.** Per-hole par prints only when the holes sum to the club's
published par (Tetherow's OSM tags sum to 71 on a par-72 course, so Tetherow prints
yardage and no par). Per-hole yardage only within 1% of the published card. Green
square footage is measured and never published — OSM traces some greens as the whole
complex and Crosswater would print an 18,300 sq ft putting surface. A course missing a
hole says which one and prints no superlatives, because "longest hole" over 17 of 18
can name the wrong hole. A stroke index outside 1..holes is dropped (OSM carries
`handicap=-1` at Eagle Crest Ridge, which printed "Stroke index -1").

**The turf threshold is picked by looking, per course.** `scripts/golf/trace-turf.py
<slug> --sweep` renders the candidate bands as red overlays on the aerial side by
side. It has to be per course because what the threshold separates turf FROM differs:
sage at Tetherow (loose band, 60 acres), wet meadow at Crosswater (tight band — loose
floods the Deschutes floodplain and reports 115 acres where 47 are fairway), pine
shadow at Widgi Creek (widest band, 8 acres on the default against 46). Reasoning
about HSV instead produced 3 acres on one attempt and 425 on another.

**Traps found here.** The registry parser read single-quoted fields only, so River's
Edge reported "no registry row" while sitting in `data/golf/courses.ts` — fixing it
also surfaced Bend Golf & Country Club. The ArcGIS image server answers an oversized
request with a JSON body that lands on disk as an unopenable `.png`. Fading the
unselected course to emphasise one hole wiped the map: turf sits at 16% of navy and a
0.18 multiplier left 3% ink, so the selected hole is emphasised and nothing is faded.

**Pipeline, one command per stage:** `scripts/golf/fetch-osm-courses.py` →
`scripts/golf/trace-turf.py <slug>` → `scripts/golf/build-course-maps.mjs`.

**Open here:** the six refused courses need OSM hole routings that do not exist yet.
Caldera Links needs its 9th, Eagle Crest Resort four holes, Lost Tracks three; Big
Meadow, Quail Run and River's Edge have no `golf=hole` ways at all.

---

# Previous — 2026-09-02 (evaluator punch list, main) — seven form defects closed in the PRIMITIVES

Matt picked the evaluator punch list. An 11-agent audit re-measured every open
finding against the live build first, which was worth doing: **the "market chart has
zero hover" finding was already fixed** and would have been rebuilt. The critic pass
that followed produced the work order everything below follows: *"the site's problem
is not a shortage of primitives — V3Answers is used once, V3Ledger has no encode,
V3Chart's range rows are aria-hidden, and V3Proof is switched off on the page that
most needs it. Improve the four that exist before adding four that do not."*

**Shipped this session, all on main, each deployed and verified in production:**

| | was | now |
|---|---|---|
| Footer, every page @375 | 2,599px | **947px** (all 52 links still crawlable) |
| Homepage @375 | 12,675px | **11,022px** |
| `/communities/tetherow` `#faq` @1440 | 3,405px | **513px** |
| `/cities/bend` place ledgers | 61 unencoded rows | **27 drawn bars** |
| Range chart rows | `aria-hidden`, `title` only | pointer + keys + touch, 9/9 rows |
| Place H1 vs its own H2 | 35px under a 58px | **58px over 35px** |

- **`cd65d5d6` the footer folds and a ledger row draws its figure.** `encode="bar"`
  on V3Ledger takes a `weight` (a SHARE, 0–1, computed by the caller beside the
  figure) so the primitive still never does arithmetic on a number it could then
  disagree with the trace about. One change lit eight place-ledger call sites.
- **`83518a2f` the fold only lives where the sitemap is one column.** The evaluator
  found two defects in my own footer an hour after I shipped it: the unfold started
  at 56.25rem while the grid goes multi-column at 40rem, so opening a group at
  640/768/834/899 left ~586px of blank cream; and I had written that the chevron
  matched V3Atlas when it pointed the opposite way. **Still open, a product call:**
  above 40rem each summary stays focusable and reports itself collapsed over visible
  links. CSS can force a disclosure open but cannot make the control agree.
- **`dfe115a1` market figures say what they mean.** TASTE names `median to pending ·
  90 days` as its example of banned jargon; it was shipping verbatim on four route
  classes. Nine `·` forms retired. **The rename is COUPLED** —
  `lib/market/how-we-get-our-numbers.ts` keys its explanation dictionary by the
  printed label — and **eleven tests had frozen the old spelling**, several by
  grepping source for the exact string.
- **`6f1126ed` + `a6477693` the questions fold, on five routes.** V3Answers ran on
  ONE route. The community `#faq` was one V3Quiet doing three jobs; the 41 outbound
  doors were the real bulk and now fold past six behind a counted summary. Folding,
  never cutting: a test walks all 41 hrefs. `splitQuietItems` does the split once, in
  the barrel. **ci:page-purpose caught the plan drifting from the page** and the city
  + community parity.json moved with it.
- **`038d15b4` the range rows can be read.** 57 rows across nine call sites had
  `aria-hidden="true"` and a native `title`. V3ChartHover took an `axis` and does the
  same job turned ninety degrees. Two defects the RENDER caught: the tip covered the
  row it described (a range plot already prints every value, so row charts get the
  crosshair and live region and no tip), and the crosshair pointed one row high
  because I sized the layer to the whole range box including its band header.
- **`bd17f8ab` a page's title is the biggest thing on it again.** V3Atlas hand-rolled
  a clamp and used it whether its headline was an H1 or an H2; that clamp is now
  `--v3-size-display-hero`, the step the ramp was missing.

**Still open, in the critic's order:** the place-page prose class (`#belonging` is
2,974px of essay, and `buildPlaceKnowledge` flattens fully STRUCTURED data —
`hoa.annual`, `driveTimes[{minutes,destination}]`, `membershipTiers[{name,price,
waitlist_status}]`, `courseSpecs` — into `·`-joined strings, so it is a composition
job and not a data one); marks-as-doors clearing 44px (13px Google pins, 5×9px atlas
region buttons on the homepage hero, 24×24px review marks); V3Proof as one primitive
for all three review surfaces; `/communities#all-communities` (598 links at 18px in
shadcn markup on a public page); and the undeclared `.skeleton` across 13 loading
routes. `/faq` is deliberately unconverted — it interleaves category rows as
pseudo-questions and needs a category-aware design.

**Two traps worth carrying:** a suspiciously fast dev-server response after an edit is
a CACHE, not a pass (a stale `/contact` cost me a hunt for a bug that did not exist —
testing the splitter against real data and restarting the server settled it); and
equal-specificity CSS is decided by SOURCE ORDER, which is how a modifier placed above
its base rule silently shrank the homepage hero.

---

# Previous — 2026-09-01 (Claude Code UX session, main) — homepage three routes, phone in chrome, TASTE is a gate, CMA on xAI

**Shipped, all on origin/main, production READY:**
- `317d7a12` homepage: V3Doors (new barrel pattern) routes Buying / Selling / Investing under
  the hero with one live fact each from the destination page's own source; the broker phone is
  in the header bar at every width (icon at 390, digits from 40rem); HomeAlertSheet retired
  (one ask per page). `INVEST_SEGMENTS` moved to `lib/invest/segments.ts` (one population for
  /invest and the door).
- `5c860c1f` place+type pages never print a raw slug: `resolveSlug` falls back registry-label-
  first (Caldera Springs' listings carry MLS City Bend, so the Sunriver-scoped lookup always
  missed) then title-cases. Matt's screenshots of "Lots and Land in caldera-springs" were this.
- `b7753ad0` CMA judge + audit run on xAI through `lib/grok` (strict json_schema, XAI_API_KEY,
  fail-open kept; tests mock `@/lib/grok`). `lib/cma/subdivision-story.ts` (vision) is still
  on Anthropic and fails open — migrate to `lib/grok/vision.ts` next. End-to-end proof on a
  real backlog CMA rebuild is still owed.
- `f388698d` TASTE IS A GATE: `design_system/public/TASTE.md` rewritten (why our pages come
  out generic; builder ritual with interaction as a required answer; evaluator rubric run by
  a SEPARATE agent; banned tells; design-the-class rule), research at
  `docs/research/taste-for-agents.md`, pointers in CLAUDE.md §3 / AGENTS.md / frontend-design
  skill, enforced by `ci:taste-canon` (every public route's parity.json carries a
  `tasteReview` receipt; 21 pre-rule routes in a shrink-only baseline).

**Matt's standing directives, this session (all in decisions.md items 4–7):** "We are a wall
of text, scrolling lists, and boring." Every page visually breathtaking; interactive data on
every page ("not a number, a percentage, and jargon"); every place page blown out with the
data cube (every property type, every subdivision); beat the best page for Tetherow,
Northwest Crossing, Old Bend, West Hills, every listing; brokerage pages and contact dialed;
stop the one-off approach — design the CLASS of pages. Any tool, every session, uses TASTE.md.

**Evaluator pass on the homepage (2026-09-01, separate agent, report in the session
scratchpad): 41/100 FAIL.** Design 14/30, originality 9/30, interaction 5/15, craft 7/15,
honesty 6/10. Only `#doors` and desktop `#faces` were judged deliberate. Craft defects fixed
and on main (swept into the admin session's `fbbef2af` by a shared-checkout `git add`; content
intact): `#sell` mounted in SellCapture with heading + 44px controls (was a bare full-bleed
form), Buying door made place-first ("Find your place", map search — Matt: a buyer does not
want every home), pace figures as one sentence instead of a KPI grid with the banned
`median to pending · 90 days` label, source line in visitor language, all three brokers at
375, hero eyebrow and footer figure-repeat removed. STILL OPEN, all form-level and all
requiring variants: towns ledger encodes nothing (bars or choropleth), market chart has zero
hover and no claim (marks + scrubber + emphasis line), verdict should be a range meter,
reviews is a 1.5–2.3k px prose wall (proof band), homes map pins are 13px at region zoom,
communities repeats the towns ledger and discards its video posters, footer is 2,686px at 375.
Matt's reaction to the shipped top of page: "is this supposed to wow me?" — it is not, and he
is right: the opening is a stock hero plus three text doors.

**LIVE ON MAIN (8af091f6) — the living map after three evaluator passes, on every place page:**
`V3Atlas` (`components/site/v3/V3Atlas.client.tsx` + `.css`) opens the homepage and, scoped to the
recorded boundary, is `#atlas` on every city, neighborhood, community, and subdivision page
(Bend's places are its 13 neighborhoods; other cities' are their busiest recorded plats;
neighborhoods and communities show their plats; a plat shows itself). Population through ONE
builder, `lib/atlas/build-place-atlas.ts`, over ONE lean read, `lib/data/listings/getAtlasTiles.ts`
(on-market rows keyset-paged from listing_tile_mv on its city+status indexes; the 30-day closed
window from `listings` on `idx_listings_closed_close_date`, because the tile MV has no close_date
index and 550K closed rows; sixteen columns; THROWS on error). The compact population (~400KB) is
what unstable_cache holds — the raw rows are 2.2MB, over Next's 2MB per-entry ceiling. A short
read is never cached: the instance's last good population draws, and the Atlas prints NO counts
("Live counts are unavailable right now"). Layers: canvas heat with 1/√N kernel alpha under a
ceiling, cream halos under every place outline (pass three found the field hid all 27 places),
non-scaling-stroke dots (no hydration flash), HTML labels, pulses on their own layer with slots
per kind (16 new / 6 pending / 18 sold) paused off-screen, a text-toggle legend in flow, pinned
card released by empty-map tap / Escape / outside click, a phone strip that keeps the tapped place
visible. Evaluator (separate agent) scores: pass one 52/49/57, pass two 62/57/67, pass three
72/58/71 (dots/heat/split); pass four is grading the current build. The decision sheet (artifact
"The Living Map") carries the pass-three renders and all scores; Matt picks A/B/C; the losers are
deleted on the pick. Production is ISR (300s); `?opening=` renders only in development. Branch
`wt/home-opening-20260901` (`/Users/matthewryan/RyanRealty-wt-home-opening-20260901`, dev server
`wt-home-opening-dev`, port 3321); every commit is on main.

**CHART ATOM WENT MAX (e740644f):** `V3Chart` gained `claim` (one formatted sentence under the
caption), `yTicks`/`xTicks` (gridlines + labels the caller formats; `lib/charts/plot.ts` exposes
the line scale and `lineTicks`), `emphasize: 'first'|'last'` (one series in ink with marks, the
rest in navy tints — emphasis over the five-hue yoy run), and a hover layer
(`V3ChartHover.client.tsx`: crosshair, dot per series, the reading at the nearest x; pointer,
touch, arrow keys, live region). `placeMedianChart` (homepage + every city page) passes all four.
**Rolled out site-wide (648864e0, merged c0740278):** `lib/charts/ticks.ts` (niceStep, money/
count/day/percent/custom ticks, month/year/spaced ticks, `yoyClaim`/`windowClaim`/`seriesClaim`,
74 tests) and every public chart builder passes claim + ticks + emphasis where honest. Rules the
builder set: a percent series states its change in POINTS; a one-chart card claims through its
title, a switcher card claims per panel, a standalone chart always claims; no emphasis on 260+
point weekly lines. 6f4bc753: a claim's percentage is computed from the figures it PRINTS (the
point's label, else the unit formatter) so a reader can check it (§0).

**MENUS WENT LIVE (this commit):** `V3Chrome` takes `live?: V3ChromeLive` (site-nav group key →
eyebrow, facts, values-by-href, dot field, read stamp), composed by `lib/site/chrome-live.ts`
(`composeChromeLive` pure + tested; `getChromeLive` reads the place atlas, the region pulse, and
`getAllCitySnapshots` — the same city snapshot the homepage ledger prints — under a 4s cap and a
15-min `unstable_cache`, null on failure) and passed from `app/layout.tsx` (now async). Homes: dot
field + for-sale/pending/sold; Places: detached count beside each town; Market: median list, MoS +
verdict, days to pending; Sell: sold 30d + days to pending. The phone overlay prints the same facts
under each group. About carries links only (no honest aggregate for reviews in the repo yet — the
reviews page deliberately prints no aggregateRating).

**ATLAS PASS FIVE GRADED, PASS SIX BUILT:** evaluator pass five (scratchpad `atlas-eval-5.md`):
dots 83 · split 77 · heat 66 · Tetherow 69 · Bend 79 · Larkspur 64 · chart 77. Twelve of thirteen
pass-five claims verified. Pass six closes R1 (hit strokes stole interior taps → hits are `<use>`
clones UNDER the places; halos are `<use>` clones too, so the geometry ships once, not three times
— R4), R3 (five more recorder-residue classes in `lib/atlas/place-names.ts`, tested), R5 (desktop
card names clamp at 4 lines), R6 (the source details reconcile counted cities with drawn outlines),
R7 (place pages render the Atlas with `EMPTY_PLACE_ATLAS` instead of deleting the section), R8
(wide boundary on a phone takes its aspect), R9/R10 (chart touch reading holds after the finger
lifts; the tooltip is a strip under the plot on phones), R11 (rail card labels wrap). Pass six is on main
(8aadb26f + 6f4bc753); evaluator pass six is measuring it. R2 closed: under 48rem every place is
also a chip under the dock (`.v3-atlas__chips`, by count, empties last), tapping one pins its card
from the place's own centre and scrolls the map into view — 27/27 homepage and 22/22 Tetherow places
reachable by chip; measured 6/6 chip taps pin the right card on both. Interior taps: 26/27 homepage
places answer their own tap at 375 (was 14/27), Larkspur 73/80.

**PASS SIX GRADED (scratchpad `atlas-eval-6.md`): dots 86 · split 82 · heat 69 · Tetherow 74 ·
Bend 80 · Larkspur 73 · chart atom 84 (SHIPS — first surface to clear the bar) · chart rollout 67.**
Pass seven (this commit) closes S1 (source line counts towns + places), S2 (name publisher: orphan
periods, Vacation Plat, `atlasRegionNames` keeps the published name when stripping would fold two
plats), S3 (a partial current year on the subdivision chart stands alone, its bar reads "2026 to
date"), S4 (phone tick rows of five or more thin to every other label), S5 (the weekly rate overlay
emphasizes the latest year; the atom draws marks on an emphasized line only up to 60 points), S6
(bar runs print up to six ticks), S8 (captions and KPI labels lose "Market Truth leftover",
"ALL-TYPE", "leftover membership"). Open: S7 (bar runs and range strips have no hover layer), S9
(three plat names still ellipsize on the desktop card), S10 (two homepage silhouettes under 8px wide
answer for a neighbour — geometry, not the hit layer), and the Tetherow "12 sold" (every type in the
boundary) vs "7 closed · 30 days" (detached, by plat name) pairing wants an explicit label.

**BROKERAGE WAVE:** `/reviews` rebuilt on the new barrel primitive `V3Proof` (figures, record strip,
year chips, two-column cards with the first sentence in the display face); `/contact` rebuilt on
`V3Ask` (one screen) with `V3Doors` above it (call / write / book) and `ContactSheet` deleted;
`/about` (21382948) mounts the regional `V3Atlas` in place of its city ledger plus a `V3Proof` band of
the newest four reviews (`record={false}`), and `app/_v3/region-atlas.ts` is now the ONE region
assembly the homepage and About share. `/team` index shows the newest reviews as a Proof band (47e55230). **Evaluator pass one over the
brokerage pages** (scratchpad `brokerage-eval-1.md`): /reviews 78, /contact 60, /about 80 (ships);
all data checks passed (every figure reconciles to the page's JSON-LD, no review text altered).
Closed in this commit: B1 (a strip click no longer lets the card sliding under the pointer steal the
focus — a timer-released scroll lock, pointer resolved to the NEAREST mark by the layer), B2 (the
contact H1 returned: the head Quiet carries one line, since V3Quiet returns null on empty items), B3
(row partners' controls align: the control sits at the foot of its cell), B4/B8 (strip marks are
positioned buttons — true dots at every width, 24px targets, keyboard by nature), B5 (the consent
block wears the form's ink and size via `.v3-ask__consent`), B6 (a subset band is a 2-column grid
with uniform pulls: `.v3-proof__list--compact`), B7 (`getOrCreateRrSessionId` in lib/tracking; the
section tracker mints the id when VisitTracker has not yet — no more 400 on first load), B9 (no
permanent live region; a status line announces the filter), B10 (rating marks only when a rating
under 5 exists), B11 (the About page's dead market query and latent "leftover" footnote strings are
gone), B13 (sentence-case option). Open: B12 (the two legal links are tab stops before the button).

**`/team/[slug]` REBUILT (this commit):** the broker's record from `getBrokerSales` (projection now
carries Latitude/Longitude/PropertyType/property_sub_type; cache keys bumped to v2) —
`app/team/[slug]/_v3/broker-record.ts` (pure, 12 tests): V3Instrument figures (closed sales, span on
the MLS, median close, listed · represented, so far this year) with the closings-by-year bar chart
(partial year stands alone), then V3Atlas "Where Matt has closed" (every closing a dot, `s: 'closed'`,
`noun={{ one: 'closing', many: 'closings' }}` — the Atlas learned both), the 8 newest closings, a
V3Proof band of reviews naming the broker (record off), and V3Doors (call / text / email). Measured:
21 closings for Matt, 21 dots, claim "21 closings of every type", page 6,570px (was 10,196).

**THE BASEMAP IS IN (2e54768a, 304422f4).** Matt's "we do need some map features like roads
for context but should match the style" is answered from public-domain US Census TIGER/Line
2024, drawn in our own projection in the register — never a Google or Mapbox tile layer.
`scripts/gis/build-basemap-skeleton.mjs` builds three things from one pass: a `region` tier
at 200m (the highway skeleton, named rivers and canals over 25km, water bodies over 0.5km²
— 66 KB, 19 KB over the wire, shipped on every frame), a `near` tier at 40m, and 877 street
tiles of 0.05° holding all 12,798 named local streets (S1400), read from disk by
`lib/geo/basemap-streets.ts` for any frame under about ten kilometres. Paths are quantized
deltas with an integer bounding box per feature, so a page clips without decoding
(`lib/geo/basemap.ts`, `lib/geo/basemap-source.ts`; `basemapForRegions(regions, opts)` is the
one call a page makes). The street tiles are traced in `next.config.ts` for the six routes
that draw a walkable frame — without that they are absent at runtime and the map silently
loses its streets. Rebuild after a TIGER vintage change:
`node scripts/gis/build-basemap-skeleton.mjs`.

**MATT'S DECISIONS (2026-09-02, asked and answered):** (1) the homepage living map ships as DOTS —
heat and split get deleted (variant prop, heat canvas, choropleth steps, split rail, the `?opening`
switch, their CSS and tests; the decision sheet closes); (2) listing pages carry the living map
ONLY, no Google parcel map beside it, no street view strip (the Google map remains only as the
fallback when the read fails); (3) the next class is the rest of the listing page — one instrument
for the ask-vs-nearby figures and the market context, the long tail as doors, similar homes as a
strip; (4) the separate evaluator pass runs after EVERY build round until a surface ships; (5) Matt
2026-09-02, mid-round: "we do need to have some map features like roads for context but should
match the style" — the living map gets a BASEMAP LAYER drawn in the register (navy hairlines on
cream, our own projection): primary/secondary roads and linear water from the public TIGER/Line
files for Deschutes (41017), Crook (41013), Jefferson (41031), ingested to Supabase (PostGIS,
simplified per class), a DAL read by bbox + class, and an Atlas layer under the dots (highways at
the region frame; arterials + local streets + the river inside a neighborhood frame). Never a
Google/Mapbox tile layer under the SVG (different projection, per-view cost, foreign style).

**LOT LINES ARE IN (Matt asked for them 2026-09-02, and answered the four scoping questions:
Deschutes free first, subject parcel plus faint neighbours, also subdivision + CMA + land, and
publish the assessor's acreage as its own figure).**

- **Source.** Deschutes County's own open layer, `OpenData/LandFD/MapServer/2` — 109,505 parcels,
  and the one endpoint of three where TAXLOT is unique (the county's hosted AGOL copy has 39
  duplicate ids; `Dial2_Taxlots` inflates to 112,381 rows through a one-to-many mailing join).
  Licence on the county's own item: "Free to download and use", attribution "Deschutes County -
  Assessor's Office".
- **Storage.** `public.taxlots` (PostGIS MultiPolygon, GIST, unique on county+taxlot, acres
  computed on the spheroid at ingest). RLS on, no anon policy: reads go through SECURITY DEFINER
  `taxlots_near_point()` and `taxlots_in_boundary()`, which CLIP and SIMPLIFY server-side to the
  resolution the frame can draw. That is the whole efficiency answer — a listing frame ships 20
  lots at 186 bytes each, about 4 KB, rather than the 333 KB the raw fabric would cost.
- **Ingest.** `scripts/gis/import-taxlots.mjs --bulk` uses the county's whole-layer export: 123 MB
  in twelve seconds, against 438 paged requests the service serves very slowly through the
  large-lot ranges. The export is EPSG:3857, so `upsert_taxlots` takes a source SRID and PostGIS
  reprojects. The paged walk survives for a county with no bulk item.
- **Staying current.** NOT a re-ingest. The county stamps every lot with an edit date, and the
  churn is tiny: 3 lots in the week to 2026-09-02, 31 in the month, 1,462 year to date. So
  `/api/cron/taxlot-refresh` (nightly, 09:20 UTC, registered in vercel.json) asks what changed
  since the last clean run and pulls only those. The cutoff lives in `public.taxlot_refreshes`,
  not in code, and a run that could not read part of its window is marked not-ok so the next one
  re-covers it.
- **Where it draws.** `V3Atlas` takes `parcels`: the subject lot in full navy, its neighbours as
  hairlines. The listing page prints the assessor's acreage, the tax lot id and a link to the
  county record; the subdivision page draws the lots inside the plat. Both carry
  `TAXLOT_DISCLAIMER` — an assessor's map is not a survey, and it sits beside the map, never in a
  footer.
- **Where a plat's lots actually draw: `/communities/[slug]`, not `/subdivisions/[slug]`.** A
  registry community's subdivision URL redirects to the community route, so Tetherow and Awbrey
  Glen never ran the subdivision page at all. Both routes carry the parcel layer now (Tetherow
  320 lots, Awbrey Glen 220). Three traps in one afternoon on this read, all fixed and all worth
  knowing: the boundary row for a registry community is filed as `geo_type='neighborhood'`, so
  asking for 'subdivision' found nothing; **supabase-js omits a null argument**, and PostgREST
  answers PGRST202 for the missing overload, so the RPC defaults `p_geo_type` and the DAL omits
  it rather than sending null; and an empty answer is legitimately cacheable for a day, so every
  fix to this read needs a cache-key bump (now v3).
- **CMA — DONE (`64eb7ecf`).** A new section, "The land", after the sales that set the number, on
  both the print pages (`opinion-pages.ts`) and the web scenes (`opinion-scenes.ts`). It draws the
  subject's recorded lot and each comp's **at one shared scale**, which is the point: every parcel
  viewer fits one lot to one frame, making a tenth of an acre and ten acres the same size on
  screen. `lib/cma/parcel-shapes.ts` fetches, `parcel-silhouettes.ts` draws, 16 tests pin the
  judgment calls — when the spread passes 4:1 it says IN WORDS that each lot is drawn to its own
  scale (it never switches silently); price per acre shows only on an acreage comp set (median lot
  ≥ 1 acre), because "$4.5M an acre" on a fifth-acre house lot is arithmetic about a house; and a
  tile whose MLS and county acreages disagree prints both. Separately, `parcelAcres` had been
  computed since that morning and reached ONLY the audit LLM prompt — `factsPage` now prints it as
  "Lot, county record". `ci:cma-opinion-spine` bans pills from the seller CMA, so the badge is set
  in type.
- **FOUR COUNTIES NOW (`52cd703a`), 246,872 lots.** Klamath 61,227 (Klamath County GIS), Josephine
  41,751 (the county GIS coordinator's own account), and `jackson` 34,426 — which is the **City of
  Medford's** layer covering the CITY ONLY, because Jackson County publishes no attributable
  county-wide layer (the only county-wide copy on AGOL is an unattributed third-party snapshot).
  An Ashland listing draws no lot, correctly. Crook and Jefferson publish nothing, checked twice
  with two query shapes. Together the new three cover 4,750 listings against Deschutes' 3,134.
  Regrid remains the one-integration commercial option for uniform coverage.
- **THE READ HAD ALREADY BROKEN AND NOTHING SAID SO.** `taxlots_near_point` filtered on
  `st_dwithin(geom::geography, …)` while the index is `gist(geom)` on GEOMETRY; the cast puts the
  predicate out of the index's reach, so every call scanned the table. At 109K rows that fit
  inside the function's 6s timeout. At 247K it did not: **10,554 ms, parallel seq scan, 126,321
  rows removed by filter**. Every uncached listing page had silently lost its lot section. Fixed
  by putting an indexable bounding box in front of the geography test, sized in degrees from the
  caller's own latitude so the box strictly contains the circle — **16.8 ms on an index scan**,
  identical rows (migration `20260902220000`). `taxlots_in_boundary` was always fine: it filters
  with `st_intersects` on geometry. **Lesson: a predicate that casts away from its index is a
  seq scan that works until the table grows.**
- **Staying current for the new three is a SWEEP, not a delta.** None stamps a row with an edit
  date. Klamath advertises Sync, so it was asked for changes directly and answered "Change
  tracking is not enabled"; its DDate and Heliondate are one publish date repeated on every row.
  So they are swept from the CLI (`--county <key> --write`), and `lib/taxlots/refresh.ts` reports
  a sweep older than 60 days by name with the command that fixes it, instead of letting a county
  serve a stale map in silence.
- **Three importer traps, all found by running it.** The upsert sat OUTSIDE the retry, so a
  transient network error threw past the gap-recording code and Medford stopped at 22,000 of
  34,447 with nothing recorded — read, merge and write are now one retried unit. A lot filed as
  several polygon rows lost all but its largest piece (and its acreage with it), so the importer
  merges pieces into one MultiPolygon: 17 in Josephine, 21 in Medford. And **measure the id field,
  never assume it** — Medford's obvious `MAPLOT` is 32,487 distinct over 34,447 rows and would
  have dropped 1,960 lots invisibly; `ACCOUNT` is 34,426. Hosted feature services honour
  `resultOffset` with geometry (the Deschutes MapServer does not); always send `orderByFields`,
  both to stop unordered paging dropping rows and to put a split lot's pieces in one page.

**ROUND SIX IS IN (all seven surfaces).** Scores: reviews 66, subdivision 41, team-matt 62,
listing-bend 63, listing-noboundary 55, homepage 65, about 64. It caught FOUR regressions in the
round-five fixes, all now fixed and pushed:
- the `keepZeros` flag was wired from the chart props to the plot builder, and the builder is
  called with an explicit field list that omitted `run` — so the fix never took effect and a
  twelve-year record still drew four bars. **Check the call site, not just the flag.**
- moving the card out of the stage made it 26px wide on a phone (two columns in a 285px box), so
  a plat name rendered as "Aw" down four lines. The phone card stacks in one column now.
- the new mark readout was mouse-only: a tap fired pointerdown then pointerleave on lift, so it
  flashed and vanished, 0 of 10. A touch keeps it now.
- naming the type filter doubled the noun: "274 house houses for sale", because `nounFor` already
  returns the type's own noun when one type is on.
Plus two of mine it graded: pending carried the heaviest mark of the three states while being the
smallest population, and the key's sold mark was a ring where the map draws a disc.

**THE OPEN DECISION FOR MATT (round six failed the homepage AND the subdivision page on it):**
there are TWO maps of Central Oregon on the homepage — the living map hero, and 383px below it a
live Google raster in Google's own chrome (`PlaceFieldMap` in the `#homes` V3Field). The
subdivision page has the same shape, where the Google slab also printed 100 homes under an atlas
saying 15 (now labelled). Matt already made this call for listing pages: living map only. I did
NOT extend it unilaterally, because the Google field is bound to a list and the living map has no
list binding yet. Recommendation: build the living map's list binding, then retire the Google
field everywhere — it also ends a per-view map bill.

**ROUND SIX (workflow `wf_31de9f2c-235`, seven surfaces + a regression hunter).**
First result in: /reviews 66, no ship — five of seven round-five fixes verified landed (mark
separation 3.48px → 14px, a 4px-off click hits its own review, one tab stop, no clipped rows),
one PARTIAL (8px off: 6 of 10), and two NO that later commits answered (the focus ring's
contrast, and the field below the strip). The field was the failing reason: 25 quote cards,
3,264px at 1440 and 7,651px at 375, every control above them — TASTE's scrolling-list ban. The
strip is sticky now, so the quotes are read against the timeline, and a card lights its own mark
on hover, on focus, and on tap.

**PROCESS NOTE, learned the hard way:** round six was launched and then three more batches were
committed to the dev server it was grading. Freeze the tree while an evaluator round runs, or
point it at a pinned deployment — otherwise a finding cannot be tied to a build.

**EVALUATOR ROUND FIVE (2026-09-02, separate Opus agents, ten surfaces, measurements
in `/private/tmp/.../scratchpad/` and the workflow journal `wf_83ae7161-679`).** Scores:
homepage 80, listing-bend 75, team-rebecca 68, team-matt 64, about 62, reviews 76,
subdivision-chart 53, listing-noboundary 57. None shipped. These evaluators measure far
harder than the earlier passes — every finding carries a number read off the DOM.

Fixed and pushed in a0be7256: TEAM-MATT-1 (a bar run dropped its empty years, so a
nine-year gap was drawn as wide as a one-year gap — `buildBarPlot` filtered `value > 0`
back out of what `broker-record.ts` had filled in; a run now keeps zeros, categories do
not), TEAM-MATT-2/TEAM-REBECCA-1 (the source line counted regions handed over, not
outlines drawn: "36 places" over a map drawing 17), TEAM-REBECCA-3 (a closing's owner was
`ids[ids.length-1]` from an unsorted array, so the map and the ledger named all four of a
broker's closings differently — it is the smallest place by area now), TEAM-MATT-3/4 (the
claim named the price filter and never the type filter, and said "Tap a place" where none
are drawn), HOMEPAGE-1 (a `use` clone of a focusable path is focusable: 27 invisible inert
tab stops; clones are pointer-only and the map is ONE stop with arrow keys), HOMEPAGE-2
(seven property types on one alpha ramp put manufactured and house on identical navy and
pending between commercial and land — dots encode STATE only now, with a key printing the
same three numbers the claim does, and the type row is switches), TEAM-MATT-5/TEAM-REBECCA-2/
ABOUT-4 (400px of empty column beside the map while the chips that name every place were
display:none above 768px — chips now sit under the search at every width). Also the build
cost the street tier exposed: `outerRings` copied every plat coordinate per page to get a
bounding box, worth 31 rail timeouts and 57s of SSG; the box is walked without allocating
and memoised, and the next deploy measured 0 timeouts and SSG back to 99s.

In the tree at the time of writing (second batch, gates not yet run): the dots answer a
pointer (nearest mark within 14px, a readout of state, price, type and age — this is what
makes a no-boundary frame interrogable at all), the card sits under the map on a phone
instead of covering 100% of it, every chart rail label sits on its gridline (three separate
geometry faults: plot-relative fraction applied to the rail's full height, a rail stretched
to a taller grid row, and the phone's 28px reading band), the phone tick rule never hides
the last label, x ticks are centred on their bars, the price label prints the price actually
applied, the stage box is the painting (28.7% empty → 3%), and the false "a few sit just
beyond its edges" sentence is gone. Still open from this round: REVIEWS-1 (at 375 the strip's
marks overlap by two-thirds and a 4px miss opens the wrong review), ABOUT-1/2/3/10/11,
LISTING-BEND-6, LISTING-NOBOUNDARY-6/10.

**SHIPPED c5b56ed1 (2026-09-02, pushed, deploy verified separately): decision (1) — heat, split,
`?opening`, the `variant` prop and the `V3AtlasVariant` export are deleted; V3Atlas is dots-only;
the homepage parity.json carries `tasteReview` 86 and left the taste baseline (20 remain). The
primary worktree `RyanRealty-wt-home-opening-20260901` was fast-forwarded to it. After the push,
three Workflows ran in this session: an eight-surface evaluator round (homepage, listing Bend /
Redmond / a no-boundary city, team Matt / Rebecca, reviews, subdivision chart at 375; two skeptics
per verdict; a completeness critic), the roads-basemap research, and the listing-page research —
their findings are the next block above this one when it is written.**

**PASS FOUR (scratchpad `brokerage-eval-4.md`): listing map 74 (E1 label covers the dot), team 85
(D4), reviews 89 ships.** Fixed in c5b56ed1: E1/E9 (the home label wins its transform, clamped
inside the stage), E2 (the home's own plat is always outlined, cap or no cap), E3 (`outlinedOf`: "outlines
N of the M places with a recorded boundary"), E4/E12 (`is-stacked` mount for a narrow column), E5 (chips
rail capped at 24), E6 (`.v3-atlas__door`), E7 (sold dots drawn, lighter), E8 (a second dedupe pass
falls back to the recorder's raw string), E10 (the held home dims under a filter but keeps its mark),
E11 (places take keyboard focus; Enter pins), E13 (a city with no recorded boundary frames its own
listings — one section for every listing), E14 (phone tick thinning from four ticks), D4 (a closing
counts in the smallest place holding it), D5 (a record map draws only the places it touches), D9 (the
beyond-frame sentence follows the filter).

**BROKERAGE PASS TWO (scratchpad `brokerage-eval-2.md`): /reviews 87 · /contact 72 · /about 85 —
all three SHIP; /team/[slug] 74, no ship.** All 13 pass-two claims verified TRUE. Closed in
9177b29b (evaluator pass three is measuring it): C1 (a record map frames its dense core by an IQR fence per axis; dots beyond the frame
are counted and NAMED in the source line, never silently clipped — the Ashland closing), C2 (bar
runs get the hover layer; a broker's years are `run: true`, one ink, no legend restating the axis),
C3 (the Proof claim says "the newest three/two" from the count), C4 (a close date is a calendar
day: `CloseDate.slice(0, 10)` before formatDate, in the ledger and the stamp), C5 (a record map's
chips list only places the record touches), C6 (the valuation sheet's consent line sits inside a
v3-rooted section), C7 (the broker's ledger is every MLS closing, the same set the figures and map
count — `brokerageTileToRow(tile, { anyArea: true })`; the brokerage feed keeps its 977 filter), C8
(E.164 tel/sms), C10 (the reviews strip is one tab stop; arrows walk the marks), C11 (About header
comment). Open: C9 (/about fires two /api/visitors/track POSTs per load; automated reloads trip
the endpoint's 429), B12.

**BROKERAGE PASS THREE (scratchpad `brokerage-eval-3.md`): /team/[slug] 74 → 82, /reviews 88.** All
ten pass-three claims TRUE. Closed in 84223da2: D1 (a record map's nature comes from the whole
population, never the filtered counts — an empty price filter no longer turns it into a for-sale
map), D2 (year ticks stay years; the partial year says "to date" in its reading and the claim
prints the count), D3 (a bar rail's floor reads 0, never the last bar's value), D12 (the reviews
strip's tab stop rests on a mark the filter shows). Also closed: D7 (the
valuation sheet's consent line wears the register's ink and a 20px box via `.v3-sheet__consent`),
D8 (that section is `#home-value-ask`, no duplicate landmark name), D10 (a closing of a type the
atlas does not name gets its own toggle), D11 (a run charts every year between first and last,
empty years as zero bars), D13 (sale-rows header). Open, in the Atlas: D4 (a closing inside two
overlapping places counts in both chips), D5 (outlines with 0 closings still open a card on a
record map), D9 (the beyond-frame sentence ignores the filter). D6 closed: every bar run, however
short, prints its ticks under its bars.

**LISTING PAGE — STARTED (84223da2, finished for the map in c5b56ed1): the living map around this home.** `app/listing/[listingKey]/
_v3/listing-atlas.ts` reads the recorded neighborhood boundary by slug (else the page's city
boundary), `buildPlaceAtlas` scoped to it, the plats as doors; the page mounts `V3Atlas` with
`highlight={{ key: listingKey, label: 'This home' }}` (new prop: the held dot + a label) in the
location map's slot, the Google map as the fallback when no boundary resolves; the listing parity
contract binds V3Atlas. Measured on 2533 Pine Terrace: "Awbrey Butte around this home", 75 for
sale / 24 pending / 11 sold, 99 dots, 80 plats, this home held. The rest of the listing plan below
is NOT started.

**LISTING PAGE — THE NEXT CLASS (surveyed 2026-09-02).** Measured on
`/homes-for-sale/bend/awbrey-butte/rivers-edge-village/2533-pine-terrace-220223522` at 1280:
13,030px tall, 23 sections, 119 images, 104 buttons, 1 chart, 3 map surfaces, 1,817 words — the
data is all there (payment calculator, schools, sale history, "how the ask sits against nearby
sales", Bend market chart, parks, guides, trails, rental analysis, similar homes) and it reads as a
scroll. Its parity contract binds 26 components (`ui_kits/listing-detail/parity.json`). The plan,
design-the-class: (1) the photo stage with the ask and three facts, a contact rail that stays; (2)
one "this home in numbers" Instrument holding the comps chart and the ask-vs-nearby figures; (3) the
living map scoped to the plat/neighborhood with THIS home's dot held (V3Atlas needs a `highlight`
dot) in place of the static location map; (4) the neighborhood's character + a Proof band; (5) the
long tail (schools, parks, trails, guides) as one V3Doors row, not five sections; (6) the payment and
rental instruments kept, as instruments; (7) similar homes as a strip. Execution-grade plan first,
then build, then the evaluator. Do not start it without reading TASTE.md and the listing parity note.

**Next program (the place-page class), in order:**
1. ~~The homepage OPENING as a real interactive data experience~~ — built, see IN FLIGHT.
2. Design the place-page class as a composed page, not stacked sections: an interactive
   property-type × subdivision display (hover/toggle/scrub reveals the cube), the closed-sales
   moat made visible, the map cells carrying per-type counts (punch-list item 6), and the
   named page to beat per place written into each parity.json. Build 2–3 variants, decision
   sheet for Matt, delete the losers.
3. Listing pages and brokerage pages (about/team/profiles/reviews with pullable GBP reviews)
   through the same ritual.
4. CMA: subdivision-story vision migration, real rebuild proof, then the review-queue send
   agent (Matt reviews every send until he flips automation).

**Lane split with the concurrent session (ryanrealty-9e):** I own the CMA ENGINE
(judge/audit/xAI) and the public UX; they own CMA DELIVERY (`app/admin/(protected)/cmas/**`)
and the logged-in browse/save UX. Shared checkout: stage only your own files; message before
pushing if the other has uncommitted work in your path.

---

## Prior — 2026-09-01 (Claude Code admin/delivery session, main, through `b583dc63`) — Messages fold FINAL, CMA send queue, gap-audit sweep

**Shipped on origin/main, production READY, live-verified in Matt's browser:**
- Messages fold FINAL: `/admin/crm/inbox` 307s to `/admin/messages` (config redirect, legacy
  `?folder=` mapped in the page), 19-file tree deleted. Capability parity held: SMS AI pills +
  per-contact template render ported into `ComposeSurface` text mode
  (`components/admin/crm/TextDraftTools.tsx` + `getSmsComposeTemplatesAction`); multi-select
  bulk triage became folder-level Done-all (`QueueDoneAll`). Gate cascade updated
  (admin-v2-tokens scan list, email-quality, crm-mobile-track, help/smoke/e2e route lists,
  streamed-redirect baseline, crm-screens contracts repointed).
- CMA delivery (Matt: review-first until he flips automation): `/admin/cmas` fronts
  "N people asked for a value and never got it" as a door to the new `?status=asked` facet
  (seller-lp/lead-form undelivered, oldest first); the send dialog prefill is AI-drafted
  source-aware via `lib/grok` textFast (form ask = "here is what you asked for" + apology when
  old; expired = sorry-it-didn't-sell; FSBO stays templated; template fallback on any model
  failure). Nothing sends without Matt in the dialog.
- `parseCmaAddress` strips trailing unit designators (Unit/Apt/Ste/#) — two form-asker
  addresses now resolve (pinned in subject.test.ts); `rebuildCmaAction` preserves the original
  `request_source` (was stamping admin-rebuild, ejecting rows from the asked queue).
  `cma-1617-nw-8th` REBUILT successfully via the marketing_brain_actions rail → the asked
  queue now holds 9 sendable documents.
- Identity: rr_vid carryover at session birth (`/api/visitors/track`) + map-first widening in
  `getLookingAtNow` — stitched returners reach the looking-at SMS wake and Today lane.
  Guest listing-save capture auto-absorbs into the verified account person on sign-in
  (`lib/crm/absorb-guest-capture.ts`, P12 fail-closed posture; Matt confirmed keep).
- Google sign-in: official GIS control on /login//signup/save-gate with a REQUIRED visible
  fallback (`GoogleOneTap` `fallback` prop) — GIS pins its iframe 0x0 for Google-signed-out
  visitors (memory: gis-button-zero-size). Personalized "Continue as Matthew" verified live.
- Admin gap-audit sweep: 5 orphaned expired/fsbo dashboard actions + 4 dead sync components +
  `testListingHistory` deleted; calls report's fabricated "0 calls made" now says "not
  tracked"; 6 serial-await pages batched; `/admin/users` migrated to admin-v2 ReportGrid
  (shadcn burndown 78→75); 4 analytics pages' raw reads moved into `lib/data/analytics/*`
  (agent worktree, cherry-picked as `17f2322c`).

**In flight, resume these:**
1. DEAD-CODE SWEEP AGENT (worktree `.claude/worktrees/agent-aba84bded80d98abd`): deleting 18
   fully-orphaned `app/actions/*` files (16 zero-importer + crm-deals.ts/listing-views.ts
   transitive chains), full audit report in this session's task log. When its commit lands:
   review the diff, cherry-pick to main, run full gates, push. The same audit's §3 list
   (~100 orphaned VALUE exports across 41 live action files) is a queued follow-up slice.
2. TWO CONDO ASKED ROWS refuse comps after the parser fix ("0 qualifying closed comps"):
   `cma-141-sw-15th-unit-21`, `cma-1833-sw-canal-unit-24-redmond-97756` — actions sit
   'pending' on the rail and will retry+refail. Engine question (comp selection for condo
   units), engine lane's call whether to widen or leave the honest refusal + a manual note.
3. Remaining asked-queue classes: 9 sendable now at `/admin/cmas?status=asked` (Matt reviews
   each send in the dialog); 5 rural comp-refusals need a product answer (honest "no
   defensible comp value" letter?); 2 never-MLS-listed + 1 out-of-area are correct refusals
   pending D2 (assessor-backed resolver).

**Queue (docs/plans/ADMIN_PRODUCT/work-queue.json):** tablet-width CRM layout, phone-width
walk via dev harness, gclid capture, cma-performance personId threading, and the
app/actions §3 export-trim slice.

---

# Prior — 2026-09-01 (Claude Code UX session, main) — subdivision 500 P0 killed + place-flow punch list

**Shipped `c83043a7`, production READY, live-verified.** Every `/subdivisions/[slug]` URL had
served a 500 to every visitor since 2026-07-15 (5,448 errors / 764 users in Vercel's window):
empty `generateStaticParams` left the route classified SSG, every request attempted a static
render, and PlaceSplitView's session read (`cookies()` via `getSession`) threw
DYNAMIC_SERVER_USAGE with no build-time bailout to absorb it. Fix: `force-dynamic` on the plat
route (the sibling place routes are already de facto dynamic — their build-time prerenders trip
the bailout and Next silently reclassifies), `withTimeoutFallback` now `unstable_rethrow`s Next
control-flow errors, and the G70 contract in `site-contracts.test.ts` pins the new truth. Same
commit: neighborhood subdivision ledgers dedupe through `displaySubdivision` at
`getCommunitiesInNeighborhoodLite` (Larkspur showed four Cessna cards and a `********` card
linking `/subdivisions/unknown`) and sort actives-first before the 12-card cap.

**Matt's directives this session (standing):** the place hierarchy (neighborhood ⊃ subdivisions,
master-plan community ⊃ subdivisions) + listing↔place flow is the competitive moat — keep
refining continuously; and NO FRANKENSTEIN: one style system, all pages same look and behavior.

**Place-flow punch list (found by browsing prod + local prod build, in priority order):**
1. ~~Card-vs-page population mismatch~~ **SHIPPED `cd837385`, live-verified**: cards bin SFR
   (matching their printed trace and the destination's counted set), unresolvable plats are
   dropped, and the plat page gained path 3b (direct SFR tile read by MLS name) so plain
   recorded plats like Pettigrew Place render instead of refusing. Live check 2026-09-01:
   all 12 Larkspur cards land on rendering pages, zero dead ends.
2. **PARTIALLY SHIPPED (c1cc10d3):** place-page shells are now visitor-independent — the
   cookies() reads moved client-side (useViewerListingState), killing the 500-class risk for
   good and cutting per-render work. MEASURED RESULT on prod: Vercel still serves
   `cache-control: private, no-cache` on dynamic renders — the next.config s-maxage headers
   are overridden for dynamic routes (the /homes-for-sale one always was, too). Actual CDN
   caching needs the routes to stop reading searchParams during SSR (client-read URL filters)
   or Next 16 cacheComponents / 'use cache' adoption — that refactor is the remaining half.
   Old framing: place pages run per-request with `revalidate=60` theater fleet-wide — real ISR means moving
   session-dependent reads (session/saved/liked in PlaceSplitView) behind a client or Suspense
   boundary. Big TTFB/cost win; belongs WITH the restyle program, not against it.
3. ~~Community child-subdivisions Ledger~~ **SHIPPED `6ccabc03`, live-verified**: registry
   children counted from the same city SFR set as the face, named via publishPlatDisplayName,
   Quiet keeps prose only (duplicate links + local ALIAS_DISPLAY map deleted), sectionOrder
   contract updated with the page. `getCommunitySubdivisions` RPC remains unconsumed — still
   available for a spatial (non-registry) enumeration later.
4. MLS alias → recorded plat mapping incomplete (PLACE_MEMBERSHIP_MISSION W1, soft-404 class).
5. Vercel error noise: `pages/500.html` ENOENT when a 500 is served (app-router error page gap).
6. **Matt 2026-09-01 — per-type breakdown per child place:** on a neighborhood/community page,
   each subdivision cell/card should break out its property types ("Subdivision 1: 5 townhomes,
   Subdivision 2: none…") — the map cells shipped in f10ee055 carry activeHomes; extend the
   community_subdivisions RPC (or bin from tiles) to per-type counts and surface on cell
   hover/click and the Subdivisions ledger rows.
7. **Matt 2026-09-01 — place+type SEO landing pages:** the type cards ("33 Single-family in
   Black Butte Ranch") land on `/homes-for-sale/...?propertyType=A&propertySubTypes=...` — a
   query-string search result. Matt wants a dedicated crawlable page per place+type with real
   content and onward exploration links (no dead ends — every page keeps the visitor moving to
   sibling types, child/parent places, market context). Design consideration: SSG budget +
   sitemap cost (thousands of place×type combos — index only combos with inventory or sales
   history; the rest render on demand, noindex). Also carries f10ee055's one-source count rule.

**Coordination:** concurrent ADMIN session shares this checkout (admin v2 work, db126181+).
File-ownership agreed in-session; the misleading "other-session TEMP-DIAG" stash was dropped.

**RESTYLE DISPOSITION EXECUTED (2026-09-01, Matt's continuous-work directive):** PRs 166–169
closed by deleting their branches after archiving every tip as `archive/cursor-{city,
neighborhood,community,subdivision}-restyle-*` tags — all commits recoverable, main is the one
restyle direction. The valuation branch/PR stays open: its 3 own commits cherry-pick clean and
whether that look ships is Matt's call. Verdict details below.

**RESTYLE PR REVIEW VERDICT (2026-09-01, full three-way analysis, both reviewing agents'
reports in this session).** The "five PRs" are ONE serial stack off base 2eba920b (Aug 28):
listing → land-face → homepage → search → sell → valuation → city → neighborhood → community
→ subdivision. `cursor/subdivision-restyle-3f5a` is the tip and contains everything.
Findings: main has independently shipped its own restyle of the same pages since Aug 29
(PlaceFaceStrip + PlaceAreaHero + PlaceSplitView + publishPlaceFace — the Grok/Claude work,
f5336df1 and after), so the stack and main are two mutually exclusive architectures, not a
rebase. Landing the stack would (1) resurrect `revalidate = 60` on the plat page — the exact
production 500 fixed in c83043a7; (2) revert the Eagle Crest camera fix and displace the
Redfin-badge and listing-map work; (3) fail ci:mockup-parity/grain gates on any partial mix
(parity.json + page.tsx must come from one side). Rebase effort is a re-implementation.
**Recommendation: close PRs 166–169 (keep branches for intent-mining — the Stage/HomesField
modules, ListingGallery consolidation, and the *-html-gate scripts are ideas worth
harvesting), and treat main as the one restyle direction.** Exception: the valuation branch's
OWN work is exactly 3 commits (075229ca, 1bbbb141, c770cd31 — /sell/valuation Stage + cream
address sheet + html gate) that cherry-pick onto main with zero conflicts; land or skip on
look alone. Matt's hero-verdict demotion rides with whatever restyle work lands on main next.
Matt directed the review 2026-09-01; PR disposition awaits his read of this verdict.

# Prior — 2026-09-01 (Claude Code, main) — Grok place-page leftovers rescued + shipped

**What shipped.** The 2026-08-30 Grok session died on credits with its final commit stranded
locally AND non-compiling: G46 failed on `components/search/PlaceSplitView.tsx` (tsc cannot
narrow `props.listings` through the aliased `mustSearch` condition). Fixed with a coalesce in
the else branch, amended into the same commit, full gates 150/150, pushed as `f5336df1`
("Eagle Crest map camera, lots thumbs, and leftover extras") — **production deploy verified
READY on Vercel.** Follow-up `054e1062`: `publicSegmentVerdictLabel` now returns
"buyer's market" / "seller's market" / "balanced market", because a segment with MoS
null/0 printed the verdict alone (Redmond Townhomes card read "BUYER'S" with nothing after
it). Push pending the gates re-stamp (this session).

**Open questions Matt raised (Grok session died before answering), with the analysis:**

1. *"We ask what type of market but display the answer in the hero."* Verified on live
   `/cities/redmond`: `publish-place-face.ts:81` puts the verdict in the hero face strip in
   the same Amboqia numeral treatment as the price, while the Quiet FAQ below asks "Is
   Redmond a buyer's or seller's market?". The FAQ restating hero figures is deliberate
   (FAQPage JSON-LD + the MoS reasoning). The hero treatment is the deviation:
   PUBLIC_UI.md §3 city row says **"Verdict is a caption, never a number hero."** The
   in-flight Cursor city-restyle (PR 166) already moves this way ("Kill the buyer/seller
   H2... mid-page tightness sentence"). Recommendation: demote the verdict from a face-strip
   numeral to a caption; do it inside the restyle PRs rather than on main to avoid a
   collision. NOT done — Matt's call on whether main gets it before PR 166 lands.

2. *"Is it normal for some content to go full width and others constrained on the same
   page?"* Yes, and it is the spec: Broadside runs Stage/Field/photography full-bleed and
   unframed; everything else sits on `--v3-measure` (72rem), prose on `--v3-measure-text`
   (44rem). The Eagle Crest about-paragraph-with-empty-right-column is the 44rem text
   measure inside a 72rem section — the Stripe/Linear "large quiet margins" foundation, not
   a bug.

**Verified-not-bugs (do not fix):** place-type-card "clipping" on `/cities/redmond` is JPEG
screenshot illegibility — DOM shows every bit intact and wrapped (`scrollWidth ==
clientWidth`). The blank cream bottom-of-page screenshots are unpainted-capture artifacts —
sections tile contiguously (measured, no gaps).

**Context a follow-on needs:** the live restyle program is the Cursor PRs 165–169
(`cursor/city-restyle-ba64`, `cursor/community-restyle-0404`,
`cursor/neighborhood-restyle-cfa4`, `cursor/subdivision-restyle-3f5a`,
`cursor/valuation-restyle-942b`) — Stage then one Field, fewer H2 stacks, tightness
sentence. Do not build a competing direction on main. Matt's standing directives this
session: LOOK at rendered screens after building (screenshot + read it, tests are not
verification), work inside the v3 system + THE LOOP, no one-offs.

Skills read: `frontend-design`, PUBLIC_UI.md, loop-brief. Commits: `f5336df1` (deployed),
`054e1062` (pending push).

# Prior — 2026-08-29 (Grok Build) — bulk email signature + from-line

**Surface:** `/admin/crm` Batch Email and `/admin/email/compose`. Goal: `docs/plans/ADMIN_REBUILD/BULK_EMAIL_SIGNATURE_AND_FROM.md`.

Signature defaults on (Gmail-matched via `getSignatureForMailbox`). Preview, test send, and the cohort worker share `composeOutboundHtml`. Default From is the named identity on `mail.ryan-realty.com` with Reply-To the real mailbox. Sending from Gmail (`matt@ryan-realty.com`) is an explicit option with a daily-cap warning. Live test copy: From `"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>`, Reply-To `matt@ryan-realty.com`, signature in the body.

Skills read: `endtoend`, `tdd`, `frontend-design` (admin v2 only). Do not fire the 2,714-person River West send from an agent session.

> **GROK BOTS:** start at `docs/GROK_BOT_BRAIN.md`. Do not load this whole file. Matt asked 2026-08-21 to re-arm the loop on current main.
> **FLEET + MAP:** Enterprise Map SoR = `docs/plans/ENTERPRISE_MAP/` — start `SESSION_HANDOFF.md`. **Company start ritual (THE LOOP v1.6.0): `npx tsx scripts/loop-brief.ts`** (work graph + scoreboard + next ship class), then the version manifest `docs/plans/ENTERPRISE_MAP/VERSION-1.md`. Blast-radius required. Stranded ledger domains are frozen (mechanical); manifest shrinkage fails G56. Full open list: `ALL-OPEN-ITEMS.md`.
> **NEWEST SUBJECT: Reality Law retired. Place chrome may be reference-conditioned. Do not invent a listing.**
> Prior: Form catalog T2.1b LIVE `caa92e2a`. Incoming agent referrals LIVE `b4bf6b8d`. Seller net `104c01cc`.

# PUBLIC SITE ENDTOEND COMPLETE — 2026-08-27 (Claude Code, main)

Every one of the 20 public page contracts (`design_system/ryan-realty/ui_kits/*/parity.json`)
now audits clean: zero open items in `openDefects`, claim-wrong resolutions kept with
reasons. Shipped through `22e390c4` (defect closure itself is `66bf4f15`; the audit waves
are `5ce0570c`, `1d73657c`, `8083df83`, `43d9f305`). Production deploy verified serving the
fixes on ryan-realty.com. Gates 165/165, 15,376 tests, tsc clean.

Things a follow-on session must not undo:
- The page-purpose gate binds sectionOrder + competitiveTarget; a page change that breaks
  its plan fails `ci:page-purpose`. Update the contract WITH the page, never delete items.
- Hub/region market heroes are LIVE-FIRST with 2025 closed-year figures following; stamps
  compose through `publishInstrumentStamp` (no `??` clock coalescing — gated).
- One ask per market page: the inquiry form. Do not re-add Value-my-home/Sell doors to
  content sections.
- One HOA figure per community page, measured basis outranking the registry estimate
  (`lib/market/publish-place-hoa.ts` `measured` tier).
- `listingDetailPath` guards the 'Outside Boundaries' sentinel for every URL surface.
- Two live-DB int tests were re-expressed to producer contracts (archive leftover-overlay
  years; subdivision snapshot-as-of-computed_at) — see `66bf4f15` message before touching.

# CMA/BPO IS CLAIMED — one tree, 2026-08-27 (Claude Code)

**Matt 2026-08-27: "roll up the entire CMA process... a number of sessions touching CMA work
right now, consolidate into one tree."** All CMA and BPO work now belongs to
`RyanRealty-wt-cma-20260827` (branch `wt/cma-20260827`). If you are not that tree, do not
edit `lib/cma/**`, `lib/data/cma/**`, `app/admin/(protected)/cmas/**`,
`app/admin/(protected)/bpo/**`, `app/actions/cma-*`, `app/actions/bpo-*`, or
`app/api/cron/cma-build-worker/**`. Hand the request over instead.

**The consolidation found nothing to merge, which is the good news.** Two sessions held CMA
commits (`0dfe5fd4` market-area product classes, `d2b07bab` band inventory); both had already
pushed by the time the tree was cut, and every file was byte-identical to `origin/main`. The
tree is simply current main: 646 CMA tests pass, tsc clean, 238 code files and 84 test files
across the surface.

**The open work, measured 2026-08-27, is delivery — not the builder.**
`public.cmas` holds 359 rows: **340 still `draft`, 9 ever `delivered`.** 288 carry a real
client email and were never sent. The build worker's own docblock says why:
*"BUILD ONLY — never sends anything. Drafts surface at /admin/cmas."* Meanwhile
`app/lp/seller-home-value` publicly promises the report "lands in your inbox within one
business day". The build is automatic, the send is a human step nobody takes.

Split by origin, because it decides what is owed: **18 asked** through the valuation form
(6 built and unsent, 12 never built); **270 nobody asked for** (112 expired-listing
auto-builds, 156 bulk) — those are cold outreach and stay behind §1 approval.

**Two distinct build failures, and only one is a bug.** 16 fail on comps ("Only 2 qualifying
closed comps found (minimum 3)" — La Pine, Sisters, rural; the builder is RIGHT to refuse).
7 fail on address matching, and at least one of those is a genuine defect: **1617 NW 8th St,
Bend is in `listings` right now as Active** and the builder still reported it unmatched.

**What Matt asked for next (2026-08-27), in order:** fix the address matcher first, then an
SMS alert when a CMA is prepared carrying a review link, opening a surface where he can
approve / rebuild-with-notes / send to recipient — "super intuitive" — plus auto-send as an
option he can switch on. Two things still to settle with him: whether "rebuild with notes"
adjusts the valuation inputs or just annotates for whoever prepares it, and whether auto-send
covers only form requests or everything.

Full triage list (18 named, with why each failed):
https://claude.ai/code/artifact/59cad4eb-0a80-4b04-afaf-cabf5cb8c0ac

## Prior — 2026-08-26 (Claude Code) — resort membership audit: 23 false children removed, now gated

**Surface:** `origin/main` `238c2f31`.

`data/resort-communities.json` → `subdivision_aliases` is rendered as a literal
"Subdivisions in X" claim by THREE components (KbResortOverview, peerPlatsForResort,
and `buildPlaceKnowledge`'s subdivision doors — that third one is easy to miss), and
it also SCOPES NUMBERS: the alias-aware active count, the community market scope, and
`lib/cma/resort-guard.ts`, where a false alias makes an ordinary home price as a
resort home. Most entries earned their list from a ">=80% inside-test" that infers
membership from listing PROXIMITY. Awbrey Glen was fixed in `05917a61`; this pass
finished the other nine. **23 removed** (tetherow 7, northwest-crossing 7, broken-top
4, eagle-crest 3, crosswater 2, brasada-ranch 1) — about 2,900 closed sales had been
mis-flagged as resort property to the CMA comp guard.

**The lesson worth carrying: the POLYGON is sometimes the thing that is wrong.**
Three entries would have lost CORRECT children to a containment rule.
- **Crosswater** — Matt asked for research instead of a geometry call. Osprey Pointe
  Condo STAYS: its recorded declaration (Deschutes 97-33704, Bk 462 Pg 1137) names
  Crosswater Owners' Association as master association. It is a condo carved OUT of
  Crosswater, so a union of the Crosswater plats necessarily misses it. Pace Estate
  and Lisle Acres removed (no HOA, no CC&Rs, across the river).
- **Three Rivers** — keeps all 11. It is a 4,819-acre CDP of 20+ subdivisions; the
  polygon is the DRRH plat union alone (2,503 acres, 51.9%). The 8 aliases that fail
  containment sit CLOSER to the CDP centre than the 3 that pass. **Widen the polygon**
  — that is the open follow-up, logged in the entry's `verification` block.
- **Black Butte Ranch** — Country House Condo is 0/5 inside a homesite-section union
  that omits the condo tract, but 6/6 of its listings carry MLS City='Black Butte
  Ranch'.

Also: Matt's "3 rivers homesites north of bend" is a DIFFERENT PLACE — MLS
`3 Rivers Rec`, 535 listings, City=Culver 97734, Lake Billy Chinook, Jefferson County,
56km NW. No registry entry, no page. Never merge it with `three-rivers`.

**Gated:** `ci:resort-membership-evidence` fails the commit when an alias has no
measurement in `verification.confirmed[]`, when a `pct_inside` does not recompute from
its own counts, when a sub-50% row carries no written evidence naming another query
shape, when `child_count` drifts, or when an entry re-declares the proximity method.
`scripts/resort-membership-baseline.json` is EMPTY — all 19 communities are evidenced.

**Open, filed but not fixed (pre-existing, wider than this change):**
`/communities/<city>-<anything>` renders an `index, follow` page with a self-canonical
for ANY name — proved with the never-registered control
`/communities/bend-some-ordinary-plat`. The 23 names now land in that unbounded bucket
instead of 308-ing. The fix is a junk-slug guard on the /communities route (and the
streaming trap means the redirect must come from middleware, not the page body).

Also fixed here: `generateMetadata` on `/subdivisions/[slug]` titled ~3,200 non-registry
plat pages "Central Oregon, Oregon". It now takes the city from the indexable set it
already fetches.

# Prior — 2026-08-26 (Claude Code) — CMA client document, FSBO first touch unblocked, dashboard gap closed

## Prior — 2026-08-26 (Claude Code) — Grok Studio: the social/media producer rebuilt

**Surface:** `origin/main`. Matt: "rebuild our social media / media content
producer using grok imagine and all of the other grok features, easy and
streamlined" + "we cannot have slop at all ever no way."

**Canon to read first: `docs/GROK_CRAFT_CANON.md`.** CLAUDE.md §4 now points at it.

**Shape.** `lib/grok/` is the ONE Grok transport (client / text / image / video /
vision); `lib/grok-*.ts` are shims. `lib/studio/` is pure + adapter-injected
(`craft` builds every prompt, `formats`, `slate` is the editorial layer,
`produce` is the one pipeline, `caption`, `spend`). `lib/data/studio/` is the DAL.
Console `/admin/studio`, cron `/api/cron/studio-slate` (13:10 UTC daily). Drafts
are `marketing_brain_actions` rows, so the existing approval queue and
`publisher-sweep` still own publishing. Nothing auto-posts.

**The anti-slop method:** hero still → Grok vision inspects it against a closed
defect enum → ONE regenerate on the inspector's own fix hint → kill. Only a
passing frame gets animated. A real MLS photo is never generated or restyled.

**Verified live, not asserted:** listing_motion $0.483 / 95s; place_video $0.567
(vision scored the frame 86/100, no defects). Clip is 1088x1920, 6.04s, no audio
track, house geometry holds across the push.

**Three API facts that cost real money to learn** (in
`.claude` memory as `reference-grok-api-surface`):
- Live Search is DEAD (HTTP 410). Research is `/v1/responses` with
  `web_search`/`x_search`; citations are in `output[].content[].annotations[]`.
- `generate_audio` DEFAULTS TRUE on video. Forced false.
- `cost_in_usd_ticks` does not reconcile (~5e-12 USD/tick text vs ~5e-11 image).
  We price from the published rate card. **Do not price from ticks.**
- Open-ended search costs ~$2.60-$3.18 per question; the same craft question as a
  structured `/chat/completions` call cost ~$0.01 and answered better.

**Two silently-empty query shapes found by counter-query, now gated
(`ci:studio-geo-contract`):** SFR is `property_sub_type` (bare lower case;
`PropertySubType` errors and reads as empty), and `geo_type='community'` has ZERO
rows in BOTH `market_pulse_live` and `market_stats_cache` — resort communities
live under `neighborhood`. Note `market_pulse_live` NOW has 28 neighborhood rows;
the older "zero neighborhood rows" note is stale.

**New gates:** `ci:grok-models` (nightly, needs XAI_API_KEY) and
`ci:studio-geo-contract` (static chain). `ci:claude-canon` was red on main from a
legitimate vendor-name detector regex in `lib/data/analytics/captureDoors.ts`;
fixed with an inline `@vendor-name-detector` opt-out rather than a silent
allowlist.

**Open / next:** trend_reactive and market_pulse formats are built and typed but
have not been run live end to end (listing_motion and place_video have).
`/admin/studio` renders behind admin auth and was verified by compile + the cron
path, not by a signed-in browser pass.

## Prior — 2026-08-26 (Claude Code) — CMA client document, FSBO first touch unblocked, dashboard gap closed


**Surface:** `origin/main`. Continues the "buyer/seller journeys" block below.

**CMA — READ `marketing_brain_skills/producers/cma/SKILL.md` BEFORE TOUCHING THE
ENGINE.** Matt stopped a change mid-flight with "you must know how we do cmas
before implementing anything". Two of my first instincts were wrong:
- The missing comp subtype filter I flagged was ALREADY FIXED (hard product-type
  exclusion, Fannie Mae B4-1.3-08, `6f37d466` Aug 23). The CMA I judged was built
  Aug 12 and predates it. Judge a FRESH build, never an old artifact.
- Unknown subtype FAILS CLOSED on purpose (SKILL.md:275) — `PropertyType='A'`
  once mixed 14% attached/manufactured into Bend sales, "that is how Santorini
  townhomes appeared next to an SFR". Never loosen it.

Shipped:
- `6148d113` **recommended list no longer prints at its own floor.** Not policy,
  a collapse: `recommended` is Method 3, and when the method spread landed at or
  below it the clamp pulled `conservative` DOWN to meet it and flattened the
  band ("$395,000 · supported range $395,000 to $420,000"). Now the midpoint.
  STAYS WITHIN SUPPORT — SKILL.md §4 step 9 forbids the engine listing above
  support unilaterally, and the accuracy contract hard-checks
  conservative <= recommended <= highEnd. A broker priceOverride is untouched.
- `59733785` **stale photo, plain English, neighborhood wording.** The
  aerial-fallback rule was locked 2026-06-13 and only HALF built: heroForSubject
  had no age check (a Jan 2023 photo led a 2026 pricing document) and its
  no-photo branch returned null — the blank the directive forbids. Staleness is
  24 months, matching the contract's comp-recency window. "Capped by method
  spread 6%" is now plain English, and the Bend-only mesh no longer tells every
  Redmond/Sisters/Sunriver/La Pine seller they sit "outside every mapped
  neighborhood polygon".

**Property-type comp coverage — DECISIONS MADE, CODE NOT WRITTEN.**
`productClass` maps only detached / attached / manufactured-on-land /
leased-land / coop. Everything else returns null and `productTypeCompatible`
fails closed, so those subjects get ZERO comps and cannot be CMA'd at all:
**1,652 closed sales in 12 months, ~15% of inventory** — Residential Lots 773,
In Park 429, Duplex 136, Recreational 89, Agriculture 63, Multi Family 41,
Quadruplex 41, Commercial 35, Rangeland 15, Triplex 15, Industrial 9,
Investment 4, Timeshare 2.
**Matt's grouping:** land = EACH TYPE SEPARATE (lots comp only to lots, ag to
ag); multi-family = 2-4 UNITS AS ONE CLASS. Give each its own ProductClass so
exact-match still holds. This is the next piece of CMA work.

**FSBO first touch — was dead, now live.** `fsbo-first-touch-v1` had
`is_active = false` and `sendProspectingIntro` hard-fails on an inactive
template, so EVERY FSBO first touch failed while expired worked (expired revised
Aug 6, FSBO untouched since Jul 15). Rewritten to mirror the expired body (169
chars, one segment, service pitch moved into the CMA the link opens), voice
clean, activated with Matt's approval. Everything else on that path was already
built and well guarded: quiet hours, ensureNativeLead, person AND phone-keyed
suppression, token fail-close, short-linking, `_pid` stitch.

**Dashboard.** Most of the Phase 4 list already worked — saved homes carry Share
(native sheet, SMS, WhatsApp, Facebook, X, LinkedIn, copy) plus
like/save/remove via ListingTile's CardActionBar; hidden / saved-searches /
collections / history all render. I nearly built a duplicate share component
before checking. The real gap was no CMA/home-value entry in the account
dashboard; added to AccountNav as "Value my home" (ci:brand-voice rejects
"What's my home worth?" as a CTA outright).

**Booking.** Google Calendar merged into availability for all three brokers
(`bc311742`) after Matt asked whether scheduling read the calendars — it did
not. Read via a NEW `getGcalBusyIntervals`, because `getGcalEvents` collapses a
failed API call into an empty list, which here would publish a free week.
All-day events are skipped: the CRM writes its own TC milestones into that
calendar and counting them is what showed 4 bookable days out of 15.
Consequence: an all-day "Vacation" does not hold time, use a timed event.
Hours Mon-Sat 09:00-17:00.

**Open**
- Property-type comp coverage (above) — the next CMA task.
- CMA PDF right-margin overflow on the adjustment grid at high comp counts.
  Pre-existing, verified on a clean tree, running in its own session.
- Overlapping saved searches still send simultaneous near-duplicate emails.
- A zero-match alert still tells nobody (4 of 24 active alerts).
- 332 CMA drafts vs **2** real client deliveries (the other 5 "delivered" are
  zz-test fixtures). Matt: document first, backlog after.

## Prior — 2026-08-25 (Claude Opus 5) — MARKET_TRUTH D26+D27 shipped, 2,526 unshipped lines rescued, sandbox race killed

**Surface:** `origin/main` `bb604b78`. D26 and D27 deployed and verified on ryan-realty.com.

**Shipped**
- `f2a81fa7` **D26** — picked up from a Grok session that ran out of weekly tokens mid-verification.
  Housing-market instruments, reports-hub live figures and city/neighborhood/community as-of stamps
  read leftover membership. Live: `/cities/bend` stamp 11:21 AM = leftover `market_metric.computed_at`;
  neighborhood and community stamp 11:40 AM. The stamps differing BY GRAIN is what proves they are
  leftover computed_at and not one shared pulse refresh.
- `4150dccd` **admin sales-funnel tab, rescued.** 2,526 lines across 12 files existed ONLY as untracked
  files in the main checkout, which sat 611 commits behind and was approved for reset. A `git clean`
  would have destroyed it. Two type errors kept it from building (`filterCohort` widened `cohort` past
  `PersonRow`); made generic over the row type. Enrolled `SalesFunnelTab` + `FunnelAudienceControl` in
  the G65 SCAN_DIRS rather than exempting them.
- `96aed416`..`3f04ee4c` **D27 — client documents read leftover.** Most of the migration was already
  done by `214b0a01`; the real defect was that the CRM market report, the CMA and the BPO still
  DECLARED `market_stats_cache + market_pulse_live` for figures leftover produces. On a broker-signed
  document the citation is what makes a number auditable, so those figures were unverifiable against
  the store they named. All three now carry per-figure source attribution.
  Also: `new_listings_30d` cell built and live (Bend **247**, region **505**, Coming Soon excluded —
  4 Bend listings were pre-marketing); **New · 30 days** tile restored; blog months-of-supply guard
  moved to leftover; gate-6 `CumulativeDaysOnMarket` baseline **7 → 0** (verified dead: 0 of 4,628
  non-null on Active SFR).
- `bb604b78` **parallel-suite sandbox race, fixed as a class.** `check-view-preset-equivalence` used a
  FIXED `tmpdir` sandbox while running in two vitest projects, so concurrent instances overwrote each
  other — passing standalone, failing only in the full suite. `check-entity-scope` had already solved
  this and the fix never propagated; three more files carried it. All four uniquified.
  Adds `scripts/apply-sql-function.mjs`: applies `scripts/sql/*.sql` in a transaction and reads the
  deployed definition BACK, so "applied" means verified. Those four compute functions previously had
  no applier and were hand-pasted.

**Rejected with evidence** — work-graph node `bedc35f4` (regression of G15, "sold search shows no
homes"). Does not reproduce at 390 or 1280 on production: 86,330 homes, Sold badges, prices, and the
reported empty-state string is absent from the page. A blank map pane seen in the in-app browser is an
artifact of THAT browser — constructing a `google.maps.Map` there paints nothing while real Chrome
renders tiles. No code change; nothing on the shopper path is broken.

**Three guards that held only by luck, now pinned by mutation-checked tests:** the delivered-CMA
freeze (both call sites pass `hydrateArea: false` — one edit from silently restating a signed
document), the resort verdict gate (dropping it makes a Tetherow board render Bend's verdict — one
population labelled as another), and the client report's source trace.

**THE GRAPH DOES NOT KNOW ANY OF THIS.** `loop_work_nodes` has no node for D26, D27, the salvage or
the tooling fix; its only intake is `fleet-intake-core.ts` (bot findings), and nothing reconciles
shipped commits against it. `site_improvement_ledger` carries a `commit_sha` column and has **0 rows
shipped since 2026-08-17** — every ship since, not just this session, has bypassed it. Treat the
commit messages and `docs/plans/MARKET_TRUTH/` as the durable record until that gap is closed.

**Gate lesson, third time this session:** G52, the D91 contract test and `ci:publish-months-of-supply`
each pinned the SPELLING of a mechanism rather than its outcome, and each failed a change that was
strictly stronger than what it replaced. When a gate fails a correct improvement, move the rule to a
shared module with failing fixtures and assert the outcome — write the negative fixture first.

## Prior — 2026-08-25 (Claude Code) — buyer/seller journeys walked as real people; 5 silent defects fixed; /book shipped

**Surface:** `origin/main` `ee4b3534`. Deployed and verified in a real browser on ryan-realty.com.

**Why this session found things gates could not:** every defect below was silent.
Nothing errored, no gate failed, and each surface looked correct in a screenshot.
They only appeared by running the journey as an actual buyer/seller against
production data.

**Shipped**
- `0d33be7e` **broker notify prefs**. `brokers.notify_new_leads` /
  `notify_deal_activity` / `notify_task_due` were written by
  /admin/settings/account and read by NO send path — the switches were
  decorative. Now gated in `queueBrokerAlert` via `lib/crm/broker-notify-prefs`
  (24 tests). Adds `notify_return_visit`, `notify_cma_ready`, a personal quiet
  window and a per-day cap. Quiet window + cap DOWNGRADE to `push_only`, never
  drop: a preference may silence a text, never lose a lead. Health alarms bypass
  everything. Also: self-serve alerts now default to `instant` (they silently
  took the column default `daily` while the LP promised 30 minutes) and the LP
  fires the first batch on submit via `runListingAlerts({ alertIds })`.
  Also: `instrumentEmailHtml` signed the HTML-ESCAPED href into the click token,
  so every tracked link in every alert/report/newsletter landed on params named
  `amp;utm_medium` / `amp;utm_campaign` — GA4 lost medium+campaign on all of it.
- `1a899f45` **cma-ready alert**. `queueCmaReadyAlert` had NEVER fired in
  production (0 `cma-ready:*` timeline rows, all time) against 335 drafts / 7
  delivered, because it required an opt-in notify list most build paths never
  set. Now falls back to the linked person's assigned broker.
- `0b1ae82c` **LP cookie identity hijack** — the big one. All four intakes took
  the `rr_pid` cookie unconditionally, ignoring a DIFFERENT submitted email.
  Live repro filed Quinn's home, seller tags, a CMA of a house she does not own,
  two call tasks and an auto-sending seller sequence onto BLAKE. Now routed
  through `lib/crm/submitted-identity` (6 tests). VERIFIED FIXED in production.
- `37407524` + `fddebdf3` **public /book**. Real calendar, not a request form.
  Pure slot engine (`lib/booking/slots`, 16 tests): DST-safe, 30-min slots, 2h
  lead, 21-day horizon, 15-min buffers. Slot race re-checked INSIDE the write
  path (`slot_taken` → refresh, never a double-book). `booking_hours` is a NEW
  column, deliberately NOT `office_hours` — that one gates inbound CALL ROUTING
  where empty means "always ring", so filling it would have sent after-hours
  callers to voicemail. The two disagree about empty on purpose.
  `fddebdf3`: all-day rows are TC milestone pins ("Contract accepted · …"), not
  meetings — counting them as busy showed 4 bookable days out of 15. Excluded.
- `ee4b3534` LP no longer promises "your first batch is on its way" to a buyer
  whose search matches nothing (4 of 24 active alerts, 17%, match zero).

**Verified end to end in production**, not from the UI: appointment #44
(17:30Z = 10:30 PDT), person 63551 created as Quinn with her OWN email (the
identity fix, from the same cookied browser that broke it), broker SMS `sent`,
confirmation email delivered.

**Open, needs Matt**
1. `booking_hours` seeded Mon-Fri 09:00-17:00 Pacific — AN ASSUMPTION. One
   column value. Saturdays likely worth it for buyers.
2. 335 CMA drafts vs 7 delivered. Alert fixed going forward; backlog untouched
   on purpose (retro-alerting = 335 texts). Suggest filtering to drafts whose
   person has SINCE shown activity.

**Open, not built**
- Overlapping saved searches send simultaneous near-duplicate emails (Blake got
  2 Redmond alerts in one minute). Needs per-recipient batching in
  `runListingAlerts`.
- A zero-match alert tells nobody — not the buyer, not the broker. 17% of active
  alerts. That is a coaching signal being dropped.
- Meta pixel throws repeated CSP errors iframing facebook.com (frame-src).
- **Phase 3 (FSBO)** not started. `sendFsboIntroSmsAction` is a DELIBERATE dead
  end (`retiredProspectingSendError`) — cold outreach was consolidated into
  `/admin/prospecting` → `sendProspectingIntro`, which requires a client-ready
  CMA before it will text. Data: 52 FSBOs, 29 reachable, **23 with no contact
  path at all**, 2 added in the last 7 days.
- **Phase 4 (returning-user dashboard)** not started. Most surfaces already
  exist under `/account` (saved-homes, saved-searches, hidden, collections,
  history, notifications). The gaps Matt named that I do NOT see: request a CMA
  from the dashboard, and easy sharing of saved homes to messages/social.

**Method note worth keeping:** twice a single query nearly produced a wrong
report — 461 unconsumed `content:cma` rows looked like a dead pipeline (335 real
drafts existed), and 677 "CMA" broker alerts looked healthy (~672 were fixtures
from one day). Also nearly reported a dead button that was drifted coordinates.
Run the second query shape before escalating a null result.

## Prior — 2026-08-21 (Claude worktree) — SSG rail timeouts zeroed (G70 round 2)

**Surface:** `main` `9162c204`, deployed `dpl_C7NtuaxP3KRrpzR9CE9qHKS8dqmn` READY, verified in a real browser on ryan-realty.com.

**What:** after G70, `app/cities/[slug]` + `[neighborhoodSlug]` still logged ~44 rail timeouts per build (`city:yearPricing`/`city:quarterSto` on 7/7 city pages, `nbh:boundary` 8, `nbh:communities` 7 of ~14 — already baking empty into deployed HTML). Chart-room, boundary, and subdivision-ledger rails now skip during SSG via `skippableRail`/`skippableRailResult` (`lib/build-phase.ts`); ISR refills at `revalidate=60`. Core figures (`nbh:stats`, `nbh:mktStats` — HUD/facts/FAQ) stay hot with `hotRailTimeoutMs` (3× leash at build only). Measured on the deploy: **0 timeouts** (was 44/352), SSG **76s** (was 3.6/11.2 min), build total **3 min**. Refill verified live: Redmond chart room full; Awbrey Butte + Southeast Bend refill chart room, polygon, subdivisions, open houses, activity on the first revalidate cycle.

**Rule when extending:** skip any rail that collapses-to-nothing per §0; never skip an indexable core figure — lengthen its build leash with `hotRailTimeoutMs` instead. `skippableRailResult` preserves the degraded-vs-empty `.ok` contract; the site-contracts §0 test accepts either Result-shaped guard.

# Prior — 2026-08-21 (Claude Code) — all four locked restyles LIVE

**Surface:** `origin/main`. Home (#146 `f66ac340`), River West hood-d (#144
`c4f0bbec`), Redmond city-d + Tetherow comm-d (batched, #143+#145 `666983b2`)
all merged, deployed, and verified in a real browser on ryan-realty.com. Matt
pinged per page. Market Desk is gone from `/`; journal H2 clears the nav.

**Gate re-anchors that rode along** (each keeps its trap armed): publish
months-of-supply / median-caption / regional-search-href homepage checks went
conditional on the retired components; pulse-city-remainder reads
SITE_CITY_SLUGS; days-figure → hood-d-model; place-hero-grain parameterized
helper (cityHeroLead/hoodLead); place-browse → CommunityKbView+FeaturedView;
westside luxury door → CityDFooter/KB_FOOTER_COLUMNS; kb-shared-shell accepts
all register footers; D93 activity feed retired from city+hood; D99/D101 lock
the HUD off `/`. pa11y hero fix = navy background under hero media (WCAG walks
ancestors, cannot see a sibling scrim) on home-d/hood-d/comm-d.

**CI de-flake `22e35a42`:** /admin/ routes out of the PR-blocking smoke
(SMOKE_INCLUDE_ADMIN=1 restores), pa11y before Lighthouse. Vercel push-to-live
measured ~11.5 min with warm cache (log of dpl_5qnLLnb...); a task is queued to
cut SSG further (ISR the 1-minute-revalidate tail, PR preview builds + promote).

**Open in the restyle program:** listing House A and resort Sunriver proofs had
no PRs — not started. The crank (rolling the kits across all cities/hoods/
communities) awaits Matt's review of the four live proofs.

**Do not:** put KbMarketHud or KbSell back on `/`. GitHub dropped PR
synchronize events twice today — after any retrigger push, VERIFY a workflow
run exists for the new SHA before waiting on it.

# Prior — 2026-08-21 — kit on main; re-arm the loop

**Surface:** `origin/main`. Home-d shipped (PR 146). Locked pack `design_system/ryan-realty/locked/`. Brain `docs/GROK_BOT_BRAIN.md` (PR 148). CRM is ryan-realty.com.

**Loop:** Sentinel default-on (`LOOP_SENTINEL_DEFAULT_OFF = false`). 10-min heartbeat launches one ship class from `loop-brief` after this lands on production. Hard limits stay: no outbound, no posts, no ad spend, no OAuth, no SkySlope, no newsletter. Public restyles stay Grok Build, not Cursor.

**Do not:** send the 648 CMA. Never the 648 household. Do not invent listings, parks, HOA, counts, or routes. Do not start a second work graph. Work graph stays `loop-brief` + ENTERPRISE_MAP.

**Grok bots:** I cannot delete sidebar agents. New bots read the brain, then one door.

# Prior — 2026-08-21 (claude worktree) — runtime rail class: video-tours fixed, pricing index is a trap

**Surface:** `main` @ `8793f648`. The `sub:video-tours` rail (worst runtime offender, 85 SSG timeouts historically) is fixed: subdivision pages read `getSubdivisionVideoTours` from `@/lib/data` (300s cache; `ci:page-action-imports` ratchet is why it lives there), VideoTourRail uses `getListingsWithVideosCached`, the cascade no longer double-queries, and `idx_listings_city_vt_modts` cut the candidates query 1368→416ms cold (migration 20260821190000, applied live via pg_cron CONCURRENTLY).

**Do NOT re-add** a covering index on `sale_pricing_facts` for `city_year_pricing`/`city_quarter_sale_to_ask` — built and measured 2026-08-21: 5.75s (planner prefers its random I/O) vs 1.77s seq scan. Reverted; details in the migration file header. Those RPCs are SSG-skipped + 6h-cached and inside budget. Profiling method when a rail is slow: `-- audit:`-prefixed `EXPLAIN (ANALYZE, BUFFERS)` of the exact query shape via the Supabase MCP — static index-gap guesses were wrong 3 of 5 times.

# Prior — 2026-08-21 (claude worktree) — ship pipeline maximized (every agent, read this)

**Surface:** `main` @ `8a7c659b`. The push→live cycle is now ~5–6 min total (was 30–40 this morning). What changed for HOW YOU SHIP:

- **`npm run push` auto-recovers origin races.** Non-fast-forward (another agent pushed while your gates ran) is exit 7 → `scripts/push-retry.sh` fetches, rebases (conflicts abort loudly), and re-verifies the new HEAD, 3 attempts max. Stop hand-rebasing on rejection — just read the verdict line.
- **G46 typecheck is incremental** (~/.cache/rr-commit-check tsbuildinfo; 55–80s → 9–15s warm). `COMMIT_COMPILES_NO_CACHE=1` forces cold.
- **`npm run deploy:verify` prints build telemetry** (compile · SSG · rail-timeout count from the REAL build log) and **exits 1 if the build-cost class returns** (SSG > 300s or > 50 rail timeouts). Do not work around it — fix the regression or get Matt's explicit OK with `BUILD_TELEMETRY_ALLOW_SLOW=1`.
- **`/api/cron/warm-geo-pages`** (every 10 min) warms the on-demand geo tail once per deployment (crm_try_cron_lease keyed on the deploy SHA). Do not add per-request warming loops elsewhere.
- The build is ALREADY Turbopack (Next 16 default; `next build --webpack` only if you need the Serwist SW). Do not "switch it to Turbopack".
- Worktree agents: never reference `<repo>/node_modules` in scripts — use `scripts/lib/resolve-node-modules.mjs` (JS or CLI). The stub broke 5 pipeline paths on 2026-08-21.

# Prior — 2026-08-21 (claude worktree) — Vercel build cost: SSG fan-out zeroed (G70)

**Surface:** merged to `main` from worktree `bold-jang-cc92e0`. **Every agent that touches `app/`: the build-time SSG budget is now gated (`ci:ssg-budget`, G70).**

**What:** Vercel build profiling showed "Generating static pages (644)" ate 11.2 of 14 min — ~125 `subdivisions/[slug]` + `oregon/[city]` pages each chaining sequential 3000–9000ms timeout-capped Supabase rails; 352 rail timeouts in one peak-hours build, which also baked EMPTY rails into deployed HTML. Both routes now hold `generateStaticParams → return []` (on-demand ISR, same URLs, same content, `dynamicParams=true` + short `revalidate`). Do NOT re-seed their fan-out; the gate fails the commit. If a build gets slow again, profile first: `vercel inspect --logs <deploy-url>` and grep `withTimeoutFallback.*timed out`. Full rationale: `docs/MECHANICAL_GATES.md` G70.

**Also true:** sitemaps are already off the build path (dynamic + warm-sitemaps cron); build cache restores fine; the 30–40 min push-to-live wall clock was build-queue serialization — shrinking the build shrinks it.




**Surface:** Grok local worktree `/Users/matthewryan/RyanRealty-wt-cma-sunstone-20260819` (`wt/cma-sunstone-20260819`). Product **`6ed2b5aa`**. Vercel production **READY** `dpl_3YBxhEC38sVWgU6QEJk9NfcgpsJQ`. Loop stays **DISARMED**. Do not re-arm. No send. Dirty CMA branch `cursor/cma-client-document-7fc3` was not mixed (CRM health `b0e9f537` and `origin-dual-remote` left behind).

**Done**
- Matcher: no `PRICING_QUALITY_STOP`. Target 8 / max 10. Townhouse ≠ condo ≠ SFR. Parkway/US-97 and Deschutes sides from `data/cma/bend-divide-sides.json`. Zoning cut when both sides known. GLA bracketing.
- Seller letter: 16 Sunstone chapters. Cover is list range + recommended list. Expected close off the seller HTML. Gate `ci:cma-exemplar`.
- Gold house **648 SE Douglas** rebuilt to `out/cma-648-se-douglas/cma.html` (gitignored). 19 pages. Recommended list **$513,000**. Matcher returned 6 sales; judge kept 3 (Thomas, 947 6th, 135 4th). Permits omitted (no extras). R-068 stays **PARTIAL** until Matt ticks the PDF.

**Next**
- Matt opens `out/cma-648-se-douglas/cma.html` (worktree path below) and ticks the 16 chapters against `docs/plans/cma-exemplars/56628-sunstone-rpr.pdf`. Reply "ship it" to move the draft into `public/cmas/` and send. Do not auto-send.
- Draft: `/Users/matthewryan/RyanRealty-wt-cma-sunstone-20260819/out/cma-648-se-douglas/cma.html`

**Do not:** re-arm the loop. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not clone Tumalo/Robin as the client layout.

**Skills read:** CMA producer SKILL, CMA_SUNSTONE_CONTRACT, TDD, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — CRM compose rebase

**Surface:** Cursor Cloud `cursor/site-texting-1eb2` PR **128**. Loop stays **DISARMED**. Rebased onto current `main` (PR 123 + people file + CMA 127 + person-link). Notes timestamp pinned to PT so hydration gate passes. File-size budget locked (`crm.ts` shrank). CRM compose is the only send path. Library attach, group text, Text me opens compose. No Jane/Odessa/Nealon sends. No Gmail fallback. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — CMA person-link and SE persist live

**Surface:** Cursor Cloud. Merged to `main` @ `23f936a51`. Vercel production **READY** `FnhKRD21AK26xTzUs4wTnKau6K6w`. Live `cma-648-se-douglas` is `person_id=63285` Odessa, `client_name=Odessa`, address `648 SE Douglas, Bend, OR 97702`, beds/baths/sqft 3/1/1056, `Intent: sell`. Review header reads the linked person. Rebuild keeps `person_id` and SE. Kickoff/rebuild/manual build collect beds/baths/sqft + rent-vs-sell. Admin actions and version-chain reads no longer `select(*)`. Review page does not iframe the document. Relationships + address-on-quick-add stay on `main`. No email. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, frontend-design, git-commit, database-canonical-reference.

# Prior — 2026-08-19 (cursor-cloud) — People file related people + notes

**Surface:** Cursor Cloud. Merged to `main` @ `7a30d1ef8`. Vercel production **READY** `2PxU2QeAJnU5Qe5BF9ADdYTEefuq`. Loop stays **DISARMED**. Related-people form first-paints open; notes list + `savePersonNoteAction`; stage/tags on first paint. No email. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, frontend-design, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — People New contact first-paint

**Surface:** Cursor Cloud. Merged to `main` @ `cea4bde19`. Vercel production **READY** `94hZ3rcsAmuPze5JTWockB7Ejnx4`. Loop stays **DISARMED**. `AddPersonCard` first-paints above the People list. Gate `ci:crm-add-person`. No email. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, frontend-design, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — hub reject + Foley investor HOA

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Foley investor HOA `$0` vs `$22` **fixed**. Product `main` @ `2ff523f5e`. No CMA. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** database-canonical-reference, git-commit.

**Skills read:** admin-product-os, frontend-design, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — CMA phone open + PDF

**Surface:** Cursor Cloud. PR #127 merged to `main`. Loop stays **DISARMED**. Unauth view/pdf → login. Review slim-reads. `/view` serves stored HTML. PDF from render_args. SE from slug. person_id on kickoff. Drafts stay private. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** crm-e2e, crm-up-to-snuff, admin-product-os, database-canonical-reference, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — stats-truth Madras + Foley p0s

**Surface:** Cursor Cloud. Loop stays **DISARMED**. stats-truth p0s reproduced and class-fixed on `main` @ `062ff2372` READY `6LzgjAwNN7XvAjjBEGYfQVjtCZSk`. Madras `/housing-market/madras` hero+FAQ both `$399,900` (zero `$400,000`). Foley 220221409 Active 2 DOM, Listed Aug 16, no Pending Aug 2. Hub SFR pulse+FAQ both `$729,000`. Place-pages (Terrebonne, Powell Butte, Summit West MOS) left to that ship. Punch dispositions appended on `3a6198cd`; parent stays open (119 lines). No CMA. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** database-canonical-reference, tdd, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — leftover Triple / street 0 / closings / plat crumb

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Walker leftovers still live: Triple H1, 0 Moonshadow search cards, Matt 19 vs 9, plat hero on crumb. Class-fixed on `main` @ `b46698c76`. Did not re-touch featured plats or Tetherow 33=33=$1.499M. Deploy verify next. CMA / loop-sentinel / email not touched. No re-arm. Leave `LOOP_SENTINEL` off.

**Skills read:** CROSS_AGENT_HANDOFF, git-commit, public-product-os (folded).

# Prior — 2026-08-19 (cursor-cloud) — vendor CRM name purge

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Removed leftover vendor-CRM docs, setup scripts, and product-name strings. Live CRM is `public.crm_people` via `lib/crm/send-event.ts` at `/admin/crm`. `main` @ `3e832749d`. `ci:gates` passed on GitHub. First Vercel production deploy `323yhyaDX5S7J75ecVUc3qdK43tN` ERROR after BUILDING. Retrying. CMA not touched. No client mail. No re-arm. Leave `LOOP_SENTINEL` off.

# Prior — 2026-08-19 (cursor-cloud) — four shopper defects LIVE

**Surface:** Cursor Cloud. Loop stays **DISARMED**. Four morning defects class-fixed on `e68b5e07f` and **live** on READY production `e8f1d4cd3` (`dpl_3sYtNggHWR3oFayXtELqP7s1ANyV`): browse Bend FAQ/snapshot **980** + MOS **—**; Mariposa 220204494 no $9.8M drop; `#save-search-email` in the DOM; tour confirm names the listing. File-size follow-up `7c28f4cab` Vercel ERROR (behavior unchanged). `/cities/bend` one render showed pulse **474** (empty tile fetch fallback). CMA / loop-sentinel not touched. No client mail. No re-arm.

# Prior — 2026-08-19 (cursor-cloud) — listing/place leftovers

**Surface:** Cursor cloud `bc-f3f636d7`. Loop stays **DISARMED**. Nine queued leftovers only. Live-reproduced on ryan-realty.com. Shipped 3 class-fixes on `main` @ `bf85c08d5`. Rejected 6 with live evidence (wheel-tab, featured 0 ACTIVE, browse href, Moonshadow card text, lot beds, Tetherow 19/35 and 35/28). CMA / sitemaps / loop-sentinel / email not touched. Do not re-arm.

**Shipped:** team closings count = ledger rows (`publishOwnClosingRows`); MLS remarks join mid-sentence blank lines; listing slugs withhold StreetNumber 0. `ci:gates` 255/255. Deploy verify next.

**Skills read:** CROSS_AGENT_HANDOFF, database-canonical-reference, git-commit.

# Prior — 2026-08-19 (cursor-cloud) — listings.xml honesty class

**Surface:** Cursor cloud `bc-7d0ca98e`. Loop stays **DISARMED** (Matt). Family `fleet:public-ux:sitemaps` class-fixed. Live `listing_tile_mv` Active/AUC = 7586. Prod `listings.xml` had 7586 locs / **5827 unique** — `fetchAllRows` paged the MV with no ORDER BY. Fix: `getListingSitemapRows` ordered `listing_key` read. Gate `ci:sitemap-listings-honest`. CMA not touched.

# Prior — 2026-08-19 (cursor-cloud) — loop DISARMED

**Surface:** Cursor cloud `bc-f77b4a1c`. Matt said **"Disarm the loop"**. Code default-off: `LOOP_SENTINEL_DEFAULT_OFF = true` in `lib/data/loop/sentinel.ts`. Cron may still hit `/api/cron/loop-sentinel`; route no-ops. Did not touch CMA, punch list, findings, or email.

# Prior — 2026-08-19 (grok-build) — graph armed, motivated-sellers 308 shipped

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. Loop stays **ARMED**. Graph folded: G34/G35 **done**, R-219/R-220, CAP-015/017/031 evidence updated. FLEET-PUNCH motivated-sellers slice **fixed** (live 308 `/motivated-sellers` → `/price-drops`, SHA `a6558109` READY `dpl_8PiPQmohwuu12UhRfmpYGEvZaTmt`). Parent released. Next brief: `fleet:public-ux:sitemaps` — `/sitemaps/listings.xml` is an empty urlset while `listing_tile_mv` has 7589 Active/AUC rows. Sentinel handoff skipped: Cursor User API Key 401 (unattended chain cannot launch). CMA in_progress on the other checkout not touched.

# Prior — 2026-08-18 (grok-build) — page-tied analytics

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. Public tracking is layout-owned. `lib/analytics/page-type.ts` is the only taxonomy. `ci:page-analytics` locks new pages. GA4 `page_type` + `crm_person_id`. SHA `02948bcd` READY. CMA not touched.

# Prior — 2026-08-18 (grok-build) — remotion + brain runtime retired

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. Remotion factory deleted. Producer-runtime crons off. `analytics_dim_agent` dropped (`20260818233000`). Revalidate uses `REVALIDATE_SECRET` (set on Vercel prod/preview/dev). Extra Vercel projects `tmp` and `ryan-realty-lps` deleted. GTM already has GA4 `G-ST40W4WM6T`. CMA checkout not touched.

# Prior — 2026-08-18 (grok-build) — runtime crosswalk leftovers closed

**Surface:** Grok Build, worktree `/Users/matthewryan/RyanRealty-audit-20260818`. **Time:** 2026-08-18 evening PT. Product land **`0afc2335`** already READY. This follow-up closes leftover audit items (unused modules + hosted stale objects + live Playwright checks). CMA dirty checkout `cursor/cma-client-document-7fc3` was not touched.

**Done**
- Live Playwright on `ryan-realty.com`: `/contact` has one `#contact-email` (forms e2e 7/7); GTM-WV6R4NZ5 present; no extra `gtag('config', G-ST40W4WM6T)`; `/homes-for-sale/bend/awbrey-butte` H1 Awbrey Butte, 69 homes.
- G55 leftovers deleted (17→7). Dead OpenAI `classifyListingPhoto` removed. Hosted drop `20260818223000`: `listing_detail_mv`, `_lss_backfill_cursor`, `cache_backfill_progress`, unused tick/refresh RPCs. `analytics_dim_agent` kept (reserved empty dim).
- Gmail reads on `marketing@` / `admin@` work. No client mail sent.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Do not start a new ship class from this land.
- CMA work stays on `cursor/cma-client-document-7fc3` in the primary checkout.

**Do not:** merge this land into the CMA branch. Do not restore the in-house CRM keys. Do not completeWorkNode on FLEET-PUNCH. Do not invent a listing. Do not SMS, publish, spend, or OAuth.

**Skills read:** CROSS_AGENT_HANDOFF, SESSION_HANDOFF, database-canonical-reference, deploy-verify-before-done, supabase-migrations-auto.

# Prior — 2026-08-18 (cursor-loop-sentinel) — listing-detail TIC/empty/navy/history reject slice

**Surface:** Cursor cloud `bc-26cdbbff` (`cursor/loop-sentinel-2026-08-18t13-10-b8d6`). **Time:** 2026-08-18 ~13:25 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 180). Claimed parent only as `cursor-loop-sentinel-bc-26cdbbff-2026-08-18t13-10`. **No product change from this session.** Production stays on last product **`af9e9308d`** (READY `HVMX96aLeSPgLGnGdkfGGExAkjfK`; concurrent listing-history dump class). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (164 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Redtail Hawk $5K / $3 ppsf / no share label **rejected** (hero `$5K TENANCY IN COMMON`, H1 `$4,900`, View all 47; What this listing shows is HOA `$399` / tax `$550`, no living-area `$/sqft`; prior class `cdb35fb11`). Awbrey Butte under-400k empty state **rejected** (7 homes, 1–7 of 7; under-300k still 3). Monta Vista blank navy UNMUTE **rejected** (Spark field, `$119K`, 7.44 ACRES, View all 6, video=0). Roosevelt intermittent navy **rejected** (live exterior, `$989K` 5/2/1092, View all 50). Borden missing history **rejected** (Listing history LISTED Jul 22, 2026 `$487,000`). Borden missing history dup **rejected** (same dated row). Borden missing agent attribution **rejected** (Listing courtesy of eXp Realty, LLC, agent Molly McInelly). Empire missing history **rejected** (LISTED Aug 10, 2026 `$455,000`; courtesy Cascade Hasson, Jenna Raanes). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet unlabeled share / empty under-400k / blank-UNMUTE / intermittent navy / missing history / missing courtesy did not reproduce. Do not invent a listing, beds, or a second TIC/ppsf fix.
- Prod probe on live pages: Redtail H1 `$4,900` + TENANCY IN COMMON; Awbrey under-400k 7 homes; Monta Vista H1 `$119,000`; Roosevelt H1 `$989,000`; Borden H1 `$487,000` + history + Molly McInelly; Empire H1 `$455,000` + history. After shots `/opt/cursor/artifacts/after_redtail_{390,1280}.png`, `/opt/cursor/artifacts/after_awbrey400_{390,1280}.png`, `/opt/cursor/artifacts/after_montavista_{390,1280}.png`, `/opt/cursor/artifacts/after_roosevelt_{390,1280}.png`, `/opt/cursor/artifacts/after_borden_{390,1280}.png`, `/opt/cursor/artifacts/after_borden_390_history.png`, `/opt/cursor/artifacts/after_borden_390_molly_mcinelly.png`, `/opt/cursor/artifacts/after_empire_{390,1280}.png`, `/opt/cursor/artifacts/after_empire_390_history.png`.
- Punch dispositions already on the parent (hex-only; matching this session's verdicts). Parent not completed. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail withhold raw ListPrice history dump

**Surface:** Cursor cloud `bc-8bf1d624` (`cursor/loop-chain-2026-08-18t13-29-e1f3`). **Time:** 2026-08-18 ~13:45 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 172). Claimed parent only as `cursor-loop-chain-bc-8bf1d624-2026-08-18t13-29`. Product **`af9e9308d`** landed on **`main`**. Vercel Production **READY** for `af9e9308d` (`HVMX96aLeSPgLGnGdkfGGExAkjfK`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (164 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Empire future date **rejected** (today Aug 18; Data last updated August 18, 2026). Empire missing history **rejected** (Listing history + Listed `$455K`). Rockway UNMUTE on still **rejected** (photo `$649K` 3/2/1392, video=0). Rockway interstitial **rejected** (no Next-step / NOT NOW). Swalley raw ListPrice dump **reproduced** then class-fixed. 438 9th courtesy **rejected** (Premiere Property Group, LLC). Roosevelt courtesy **rejected** (Stellar Realty Northwest). 438 9th lot size **rejected** (specs `0.64 acres`; hero withholds acres when beds exist). Hex-only fingerprints (1 fixed + 7 rejected).
- Class: buyer-facing listing history never prints MLS field dumps (`ListPrice: 14900000.00 → 11900000.00`). `publishListingHistoryDescription` withholds those strings; `publishListingHistoryDeltaLabel` prints `$3.0M down` via `formatPriceCompact`. Wired PropertyHistory + expired-listing-note. Gate `ci:publish-listing-history` 8/8. Founding fingerprint `7e278bfeb28c9806649154eeb32c5567`.
- Prod probe after READY `af9e9308d`: Swalley history **`$11,900,000`** + **`$3.0M down`**, no `ListPrice: 14900000`. After shots `/opt/cursor/artifacts/after_swalley_{390,1280}_listing_history.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail TIC share label + withhold ppsf

**Surface:** Cursor cloud `bc-a0c77b4b` (`cursor/loop-chain-2026-08-18t12-00-4d91`). **Time:** 2026-08-18 ~13:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 188). Claimed parent only as `cursor-loop-chain-bc-a0c77b4b-2026-08-18t12-00`. Product **`cdb35fb11`** landed on **`main`**. Vercel Production **READY** for `cdb35fb11` (`CxViDz2vpqBeLEYN8NsTuDcypKwD`; GitHub Vercel success + Production deployment). First `npm run deploy:verify` hit READY on the prior product SHA `05bbb31`; the HouseMe follow-up SHA verified via GitHub Production status after the CLI login stall. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (180 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Old Farm under-300k auto-nav **rejected**. Dick George missing-spec **rejected** (`$380K` 6.34 ACRES). River Bend blank UNMUTE **rejected** (live photo + `$1.9M`). 2390 Snowgoose share ask **reproduced** then class-fixed. Black Canyon Aw Snap **rejected** (`$25K` 20 ACRES). Gerig blank navy **rejected** (`$1.9M` 190.69 ACRES). 2250 Snowgoose share ask **reproduced** then class-fixed. Surveyor missing photo **rejected** (`$698K` VIEW ALL 54). Hex-only fingerprints (2 fixed + 6 rejected).
- Class: MLS `PropertySubType` Tenancy in Common / Timeshare prints that label on the hero and strip. `publishListingSharePricePerSqft` withholds living-area `$/sqft` on hero, strip, PriceBlock, PropertySpecs, ListingCard, and HouseMe. Do not invent fractional or timeshare when the feed says Tenancy in Common. Do not parse PublicRemarks. Gate `ci:publish-listing-share` 9/9. Founding fingerprints `ae66a0f065d3affe2713352b2f71e1b5` / `41fed0ac49bcf207696a8c1990faf07f`.
- Prod probe on live `cdb35fb11`: 2390 Snowgoose hero **`$5K TENANCY IN COMMON`**, HouseMe no `$4 per sq ft`. 2250 Snowgoose hero **`$3K TENANCY IN COMMON`**, HouseMe no `$3 per sq ft`. After shots `/opt/cursor/artifacts/after_snowgoose2390_{390,1280}.png`, `/opt/cursor/artifacts/after_snowgoose2250_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail unmute + Aw Snap reject slice

**Surface:** Cursor cloud `bc-74d9bae3` (`cursor/loop-chain-2026-08-18t11-45-fffc`). **Time:** 2026-08-18 ~11:52 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 196). Claimed parent only as `cursor-loop-chain-bc-74d9bae3-2026-08-18t11-45`. **No product change.** Production stays on last product **`0bcfc7110`** (already READY; dpl `GnLoMc7NzMfxLcNPabcorWJx2qvP`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (188 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Albany Gerig blank navy UNMUTE **rejected** (Spark aerial, `$1.9M`, 190.69 ACRES, +9 more, video=0). Strawberry missing photo **rejected** (View all 12 + Spark field). Strawberry missing specs **rejected** (hero `$435K` + 0.51 ACRES; MLS 220215800 type D, beds/baths/sqft null). Old Farm under-1.5m auto-nav **rejected** (same URL after 8 scrolls; 1-9 of 53). Conestoga / Galium / Cassidy / Black Canyon Aw Snap **rejected** (each 200 + live hero; Black Canyon still same URL after scroll). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet UNMUTE-on-still / missing photo / invented beds / auto-nav / Aw Snap did not reproduce. Do not invent a listing or beds.
- Prod probe on live `0bcfc7110`: Gerig H1 `$1,875,000`; Strawberry H1 `$435,000` + 0.51 ACRES; Conestoga `$739K` 3/2/1798; Galium `$2.1M` 4/4/3318; Cassidy `$320K` 3/2/1462; Black Canyon `$25K` 20 ACRES. After shots `/opt/cursor/artifacts/after_gerig_{390,1280}.png`, `/opt/cursor/artifacts/after_strawberry_{390,1280}.png`, `/opt/cursor/artifacts/after_oldfarm_{390,1280}.png`, `/opt/cursor/artifacts/after_conestoga_390.png`, `/opt/cursor/artifacts/after_galium_390.png`, `/opt/cursor/artifacts/after_cassidy_390.png`, `/opt/cursor/artifacts/after_blackcanyon_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail $1000K + land-acres slice

**Surface:** Cursor cloud `bc-146bbab6` (`cursor/loop-chain-2026-08-18t10-55-4a7c`). **Time:** 2026-08-18 ~11:42 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 204). Claimed parent only as `cursor-loop-chain-bc-146bbab6-2026-08-18t10-55`. Product **`0bcfc7110`** landed on **`main`**. Vercel Production **READY** for `0bcfc7110` (`GnLoMc7NzMfxLcNPabcorWJx2qvP`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (196 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Roosevelt `$1000K` **reproduced** then class-fixed. Columbus / Kouns missing acres on hero **reproduced** then class-fixed. Bryant missing photo **rejected** (photo + `$1.1M` / H1 `$1,073,000`). Columbus Aw Snap **rejected** (200, live hero). Rogue “make numbers match” 220208750 **rejected** (hero 4,021 SQFT is MLS 220208751; do not invent 23/22). Bryant Next / Violet blank navy video **rejected** (real photos, no `<video>` / UNMUTE). Hex-only fingerprints (3 fixed + 5 rejected).
- Class: `formatPriceCompact` / `publishListingHeroCompactPrice` emit `$1.0M` when thousands-round ≥ 1000 (never `$1000K`). `publishListingHeroKeyStats` publishes lot acres only when beds/baths/sqft are absent. Wired ListingHero + listing-detail page. Gate `ci:publish-listing-hero-stats` 4/4. Founding fingerprints `2ceabe03a3cc759cc09d94d2bd1e442a` / `639e24f1d222997d0f59f2e137981de8` / `57b38d188f133fe2c93c05ca6150d5d9`. Do not invent beds or a second MLS row.
- Prod probe after READY `0bcfc7110`: Roosevelt hero **`$1.0M`** (no `$1000K`); Columbus hero **19.77 ACRES**; Kouns hero **1.35 ACRES** at 390+1280. After shots `/opt/cursor/artifacts/after_roosevelt_{390,1280}.png`, `/opt/cursor/artifacts/after_columbus_{390,1280}.png`, `/opt/cursor/artifacts/after_kouns_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 3 fixed + 5 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail not-found + Troon/Bryant reject slice

**Surface:** Cursor cloud `bc-1668f809` (`cursor/loop-chain-2026-08-18t10-39-67fd`). **Time:** 2026-08-18 ~10:55 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 212). Claimed parent only as `cursor-loop-chain-bc-1668f809-2026-08-18t10-39`. **No product change.** Production stays on last product **`de3733b74`** (already READY; dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (204 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Medford Table Rock / Cave Junction Pinewood / Medford Gayety / Williams Powell Creek 200 not-found homepage shells **rejected** (each 200 + address title/H1 + list price). Troon missing listing history **rejected** (Listing history: Listed Jun 25, 2026 `$1,425,000`). Troon scroll-jump past Rental analysis **rejected** (rental y=9840/9717; scroll 9840→15366 / 9717→12896, no Financial snap). Troon hero-wheel lightbox **rejected** (`Photo lightbox` count 0). Albany Bryant placeholder heading **rejected** (H1 `Bryant Way, Albany, OR 97321 $1,073,000`). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet not-found shell / missing history / scroll jump / lightbox-on-wheel / placeholder H1 did not reproduce. Do not invent a fix. Do not invent a listing.
- Prod probe on live `de3733b74`: Table Rock H1 `$39,900`; Pinewood H1 `$429,000`; Gayety H1 `$389,900`; Powell Creek H1 `$320,000`; Troon H1 `$1,425,000` + history; Bryant H1 `$1,073,000`. After shots `/opt/cursor/artifacts/after_table-rock_{390,1280}.png`, `/opt/cursor/artifacts/after_pinewood_390.png`, `/opt/cursor/artifacts/after_gayety_390.png`, `/opt/cursor/artifacts/after_troon_390_history.png`, `/opt/cursor/artifacts/after_troon_390_rental_precise.png`, `/opt/cursor/artifacts/after_bryant_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail not-found + SSL reject slice

**Surface:** Cursor cloud `bc-5bc17e51` (`cursor/loop-chain-2026-08-18t10-16-1314`). **Time:** 2026-08-18 ~10:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 228). Claimed parent only as `cursor-loop-chain-bc-5bc17e51-2026-08-18t10-16`. **No product change.** Production stays on last product **`de3733b74`** (already READY; dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (220 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Ashland McCall / Phoenix Main / Ashland Strawberry / Chiloquin River Bend / Cave Junction Dick George / Christmas Valley Arrowhead / Prineville High Desert 200 not-found homepage shells **rejected** (each 200 + address title/H1 + list price). Brookings Byrtus SSL timeout **rejected** (200 in 720ms HTML / 1632ms 390; `1101 Byrtus Place` `$1,100,000`). Hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet not-found shell / SSL fail did not reproduce. Do not invent a fix. Do not invent a listing.
- Prod probe on live `de3733b74`: McCall H1 `$315,000`; Phoenix Main H1 `$1,695,000`; Byrtus H1 `$1,100,000`; High Desert H1 `$1` (MLS ask, not a homepage). After shots `/opt/cursor/artifacts/after_mccall_{390,1280}.png`, `/opt/cursor/artifacts/after_phoenix-main_390.png`, `/opt/cursor/artifacts/after_byrtus_390.png`, `/opt/cursor/artifacts/after_high-desert_390.png`, `/opt/cursor/artifacts/after_strawberry_1280.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — listing-detail not-found + tour-key + history reject slice

**Surface:** Cursor cloud `bc-5b7dd86a` (`cursor/loop-sentinel-2026-08-18t09-50-2db8`). **Time:** 2026-08-18 ~10:05 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 244). Claimed parent only as `cursor-loop-sentinel-bc-5b7dd86a-2026-08-18t09-50`. **No product change.** Production stays on last product **`de3733b74`** (already READY; dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (236 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Hilmer mismatched Spark tour keys **rejected** (all Schedule a tour hrefs `listingKey=220222626`; contact MLS tile loads 61172 Hilmer Creek `$755,000`). Bly Ivory Pine / Albany Columbus / Highway 34 / Bryant / Kamph 200 not-found homepage shells **rejected** (each 200 + address title/H1 + list price). Sprague River Tableland SSL timeout **rejected** (200 in 1570ms; `0 Tableland Road` `$590,000`). Foley missing price/status history **rejected** (reduction line plus Listing history: Listed Aug 16, Pending Aug 2, two price changes). First resolve pass wrote `fleet:fleet:` tags; second pass used hex-only fingerprints (0 fixed + 8 rejected).
- Class: none. Fleet not-found shell / SSL fail / missing history / mismatched tour keys did not reproduce. Do not invent a fix. Do not invent a listing.
- Prod probe on live `de3733b74`: Albany Columbus H1 `$1,495,000`; Foley Listing history visible at 390; Hilmer tour key is MLS only. After shots `/opt/cursor/artifacts/after_columbus_{390,1280}.png`, `/opt/cursor/artifacts/after_foley_390_history.png`, `/opt/cursor/artifacts/after_hilmer_390.png`, `/opt/cursor/artifacts/after_tableland_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — listing-detail calendar-day slice

**Surface:** Cursor cloud `bc-4c1236cf` (`cursor/loop-chain-2026-08-18t09-14-bc2c`). **Time:** 2026-08-18 ~09:55 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 252). Claimed parent only as `cursor-loop-chain-bc-4c1236cf-2026-08-18t09-14`. Product **`de3733b74`** landed on **`main`**. Vercel Production **READY** for `de3733b74` (`4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (244 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: `/homes-for-sale/bend/21357-kilimanjaro-220222798` stored 08/18–20 printed Mon Aug 17 / Tue 18 / Wed 19 **reproduced** then class-fixed. Providence / Rainier / Hilmer missing history **rejected** (Listing history + Listed dates already on the page). Hale / Verdin / 7th stale Aug 15 open houses **rejected** (`OpenHouses` null, no Open houses section). Albany Violet navy hero / zero photos **rejected** (Spark hero + View all 46; `media_suppressed=false`).
- Class: `publishCalendarDay` / `publishOpenHouseDay` / `publishHistoryDay` wrap `formatCalendarDay` (noon UTC anchor) so YYYY-MM-DD civil days stay on the stored day in `America/Los_Angeles`. Wired listing-detail Open houses + Property history, OpenHousesGrid, oh-when, KB place-sections, listing banners, open-house clients. Gate `ci:publish-calendar-day` 6/6. Founding fingerprint `e100e9e1a244369ec0d5b7aee1ce11a6`.
- Prod probe after READY `de3733b74`: Kilimanjaro HTML prints **Aug 18 / Aug 19 / Aug 20** (dpl `4NCw2Hhc7tLrrD5cJ47oTTo2u8zi`). After shot `/opt/cursor/artifacts/after_kilimanjaro_390.png`. First resolve pass wrote `fleet:fleet:` tags that `openPunchLines` cannot match; second pass used hex-only fingerprints (1 fixed + 7 rejected). Parent not completed.
- Leftover listing-detail + other families stay on the inbox. Do not invent a second calendar-day fix.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — place-pages browse + mixed-stamp + chart-axis slice

**Surface:** Cursor cloud `bc-1afd11d9` (`cursor/loop-sentinel-2026-08-18t08-30-11a1`). **Time:** 2026-08-18 ~09:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 260). Claimed parent only as `cursor-loop-sentinel-bc-1afd11d9-2026-08-18t08-30`. Product **`90155dcf8`** landed on **`main`**. Vercel Production **READY** for `90155dcf8` (`9JQDeR7rQLifd2tj9oxSVeNZ5w66`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (252 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/subdivisions/ridge-at-eagle-crest` Browse homes / See homes dropped the plat **reproduced** then class-fixed. `/subdivisions` truncated plat names **reproduced** then class-fixed. `/housing-market` Aug 10 vs Aug 16 stamps **reproduced** then class-fixed. Chart JAN/DEC bunched in the Y gutter **reproduced** then class-fixed. `/neighborhoods/tetherow` 35 vs 28 **rejected** (200 + H1 Page not found). Terrebonne days-to-pending **rejected** (pulse null). Powell Butte this-month median **rejected** (July median sale `$1,263,000`). `/neighborhoods` reused Awbrey aerial **rejected** (three distinct curated photos).
- Class: `publishPlaceBrowseHref` / `publishPlaceHeroCta` withhold `/homes-for-sale` and `?view=list`. `looksLikeMlsAbbreviation` drops WildflS / SkylinC / Fairway Vill Condo from the A-Z catalog (Triple / Inn Of The 7th stay as recorded English). `publishInstrumentStamp` withholds a mixed Instrument clock. V3Chart x-axis is `grid-column: 2`. Gates `ci:publish-place-browse` 7/7 and `ci:publish-mixed-instrument-stamp` 4/4.
- Prod probe after READY `90155dcf8`: Ridge hero + Browse homes + list door are `/homes-for-sale/redmond/ridge-at-eagle-crest` (12 cards). Housing-market lead has **no** `updated` (clocks differ); city/SFR stamps are Aug 18. Chart ticks Jan x=134 / Dec x=1169 at 1280. After shots `/opt/cursor/artifacts/after_ridge-at-eagle-crest_{390,1280}.png`, `/opt/cursor/artifacts/after_housing-market_{390,1280}_chart.png`, `/opt/cursor/artifacts/after_subdivisions_{390,1280}_az.png`.
- Punch dispositions appended (parent not completed): 4 fixed + 4 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list. Known leftovers that this class already killed as instances: `7c15bd27` / `0637cc1d` (same chart-axis + mixed-stamp observations). Next slice should reproduce-or-reject them, not invent a second fix.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4+§6, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — place-pages featured-inventory + reject slice

**Surface:** Cursor cloud `bc-028b80c5` (`cursor/loop-sentinel-2026-08-18t07-30-da07`). **Time:** 2026-08-18 ~08:30 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 268). Claimed parent only as `cursor-loop-sentinel-bc-028b80c5-2026-08-18t07-30`. Product **`9f207c4cc`** landed on **`main`**. Vercel Production **READY** for `9f207c4cc` (`CqDNRaMXqjCVQsqZ6ToXpf74UwFV`, `npm run deploy:verify` exit 0). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (260 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/subdivisions` featured strip zeros **reproduced** then class-fixed. Before: `featuredActive [0,2,12,0,0,5,0,3,0,0,8,0]`, **7 zeros**. After READY: `[14,12,12,11,8,7,6,5,3,3,2,9]`, **0 zeros**. `/subdivisions/brookswood-crossing` 404 **rejected** (200 + H1 + empty-state + sales history). `/subdivisions/brooktree` 404 **rejected** (200 + H1 + listing cards + sales history). `/schools/summit-high` empty map **rejected** (`.v3-field__map` 350×263 / 586×440; 6/9 Google tiles). `/oregon/portland` out-of-area **rejected** (`outsideMarket=true`; 19 all-type / 12 SFR / $505k from `geo_snapshot_mv`). `/housing-market` 5707 vs 5691 **rejected** (ALL-TYPE 5,707; eight type cards including Farm/ranch 11 + Other 5 sum to 5,707). Mix chart slivers **rejected** (8 segments + ordered list). `/communities/tetherow` 35/28 **rejected** (hero **34** homes; **See all 34 Tetherow homes for sale**).
- Class: `publishFeaturedPlats` prefers the highest verified SFR count per community and does not pad featured tiles with 0 ACTIVE sibling aliases. Wired `/subdivisions` after inventory fetch. Gate `ci:publish-featured-plat-inventory`. Zeros stay on the A-Z index. Do not invent inventory.
- Prod probe after READY `9f207c4cc`: featured strip **0 zeros** at 390 and 1280 (`[14,12,12,11,8,7,6,5,3,3,2,9]`). Tile shots `/opt/cursor/artifacts/after_subdivisions_{390,1280}_featured_tiles.png`. Also `/opt/cursor/artifacts/after_brookswood-crossing_{390,1280}.png`, `/opt/cursor/artifacts/after_tetherow_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4+§6, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages street-0 + venue-city slice

**Surface:** Cursor cloud `bc-d14c774b` (`cursor/loop-chain-2026-08-18t06-04-137f`). **Time:** 2026-08-18 ~07:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 284). Claimed parent only as `cursor-loop-chain-bc-d14c774b-2026-08-18t06-04`. Product **`c3b968afb`** landed on **`main`** (class `cef36790f` + founding-list follow-up). Vercel Production **READY** for `c3b968afb` (`4AmF8K5eMUkDDCffWa43wWd2yYK8`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (276 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/central-oregon/events/sunriver-music-festival` “Tower Theatre, Bend in Sunriver” **reproduced** then class-fixed. `/cities/bend/awbrey-butte` cards printed **0 Moonshadow Court** **reproduced** then class-fixed (MLS 220221237 / 220221242 / 220221243). Tower Theatre / Pilot Butte / Tumalo Falls empty map **rejected** (tiles after load). Barclay Meadows Aw Snap **rejected** (200 + H1 + empty-state). Brentwood / Brier Ridge 404 **rejected** (200 + H1).
- Class: `publishStreetLine` withholds MLS house number 0 and keeps the street name. `publishPlaceInCity` withholds the page city when the venue already names one. Wired dual-pane `splitRowsFromTiles`, KB ticker / featured / map / activity, v3 field titles, listing cards, nearby lifestyle DAL, looking-at. Gates `ci:publish-street-line` 8/8 and `ci:publish-place-in-city` 4/4. Do not invent a house number.
- Prod probe after READY `c3b968afb`: Awbrey Butte list + ticker print **Moonshadow Court**, 0× `0 Moonshadow`. Festival Where is **Tower Theatre, Bend**, 0× `Bend in Sunriver`. After shots `/opt/cursor/artifacts/after_awbrey-butte_{390,1280}.png`, `/opt/cursor/artifacts/after_sunriver-music-festival_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4+§6, git-commit.

# Prior — 2026-08-18 (cursor-loop-sentinel) — place-pages chrome-only + Terrebonne days + event map reject slice

**Surface:** Cursor cloud `bc-17952d67` (`cursor/loop-sentinel-2026-08-18t05-50-59a3`). **Time:** 2026-08-18 ~06:05 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 292). Claimed parent only as `cursor-loop-sentinel-bc-17952d67-2026-08-18t05-50`. **No product change.** Production stays on last product **`0f57f5e7c`** (already READY; tip `b35d5eacc` docs). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (284 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: six `/subdivisions/{slug}` chrome-only lines **rejected**. Aubrey Heights / Blue Chip Ranch: H1 + listing cards + sales history. Chase Village / Chloe Estates / Brookswood Estates / Brentwood: H1 + “No active listings…” + sales history. GIS plats exist (`boundaries` 3,213; all six slugs present). `/housing-market` Terrebonne missing days-to-pending **rejected** — pulse city `terrebonne` methodology `v3-2026-05-07` `median_days_to_pending=null` (Metolius also null); page omits unverified days. `/central-oregon/events/bend-farmers-market` empty map **rejected** — `.v3-field__map` 586×440 / 350×263 with 36/33 Google tiles after load. HTML + Playwright (system Chrome) at 390 and 1280; `chromeOnly=false` on every row.
- Class: none. Fleet chrome-only / invented days / empty map did not reproduce. Do not invent a fix.
- Prod probe on live `0f57f5e7c`: H1 visible in-viewport (390 h1Top 486; 1280 h1Top 381). Terrebonne row `6 FOR SALE Terrebonne $685,000`. After shots `/opt/cursor/artifacts/after_chloe-estates_{390,1280}.png`, `/opt/cursor/artifacts/after_blue-chip-ranch_{390,1280}.png`, `/opt/cursor/artifacts/after_aubrey-heights_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages subdivision chrome-only reject slice

**Surface:** Cursor cloud `bc-e3dbb660` (`cursor/loop-chain-2026-08-18t04-58-faa9`). **Time:** 2026-08-18 ~05:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 308). Claimed parent only as `cursor-loop-chain-bc-e3dbb660-2026-08-18t04-58`. **No product change.** Production stays on **`ab140f397`** (already READY). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (300 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: all eight `/subdivisions/{slug}` chrome-only lines **rejected**. Bella Vista / Blue Ridge / Brookside / Buena Ventura: H1 + “No active listings…” + sales history. Big Sky / Brier Ridge / Black Bear Meadows / Boyd Crossing: H1 + 2 listing cards + sales history. HTML + Playwright (system Chrome) at 390 and 1280; `chromeOnly=false` on every row.
- Class: none. Fleet chrome-only did not reproduce. Do not invent a fix.
- Prod probe on live `ab140f397`: H1 visible in-viewport (390 h1Top 486–527; 1280 h1Top 329–381). After shots `/opt/cursor/artifacts/after_bella-vista_{390,1280}.png`, `/opt/cursor/artifacts/after_boyd-crossing_{390,1280}.png`, `/opt/cursor/artifacts/after_big-sky_390.png`.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages this-month median + chrome-only reject slice

**Surface:** Cursor cloud `bc-812b6297` (`cursor/loop-chain-2026-08-18t02-04-a235`). **Time:** 2026-08-18 ~02:42 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 340). Claimed parent only as `cursor-loop-chain-bc-812b6297-2026-08-18t02-04`. Product **`c2c6c0fb0`** landed on **`main`** (class `0ed74366e` + compile follow-up). Vercel Production **READY** for `c2c6c0fb0` (`7dQpSydh4ZJfEFAGnPrVgttrkuZ8`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` stays open** (332 leftover lines). Release skipped: another session (`cursor-loop-chain-2026-08-18-bc-0a79e0c8`) holds the parent `in_progress`. Do not steal. Do not `completeWorkNode`. Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: `/housing-market/powell-butte` this-month median absent **reproduced** then class-fixed. Cache city `powell butte` methodology `v3-2026-05-07` August monthly `sold_count=1` `median_sale_price=null`; July complete `$1,262,500` / 6; YTD `$1,200,000` / 35; rolling 365d `$1,334,500` / 52. Seven `/subdivisions/{slug}` chrome-only lines (altura, american-west, antler-crossing, arborwood, awbrey-meadows, big-sky-country, arrowdale) **rejected** — H1 + “No active listings…” + sales history at 390/1280.
- Class: `publishCompleteMonthMedian` publishes this-month median only when the current-month cache row has a verified median; otherwise last complete month as `{Month} median sale`. Wired DAL `getCompleteMonthlyMarketDetail` + public housing-market + `_v3` figures + broker SMS `market_stats` + G-publish-complete-month-median (6/6).
- Prod probe after READY `c2c6c0fb0`: Powell Butte **July median sale `$1,263,000`** (`formatPrice` nearest-thousand of `$1,262,500`); 0× “this month median”. After shots `/opt/cursor/artifacts/after_powell-butte_{390,1280}.png`, `/opt/cursor/artifacts/after_altura_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list. Leave the parent claim with `cursor-loop-chain-2026-08-18-bc-0a79e0c8`.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — place-pages alias 308 + MLS plat names slice

**Surface:** Cursor cloud `bc-1d730b67` (`cursor/loop-chain-2026-08-18t00-28-e09f`). **Time:** 2026-08-18 ~01:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 364). Claimed parent only. Product **`aa4c62d67`** landed on **`main`**. Vercel Production **READY** for `aa4c62d67` (`3nZFnPSbtSAVLzWquxqMkfvJG7q2`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (356 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Awbrey index 52 vs page 63 **rejected** (both 64). Ridge 12/$910k vs 14/$535k **rejected** (both 12 / $909,950). `/housing-market` SQL leak **rejected** (no `closed_cte`). All 13 `/neighborhoods/{slug}` 404 **reproduced** then class-fixed. River Meadows More areas Oww / DrrhTrs **reproduced** then class-fixed. Tetherow Regional median **rejected** (string gone). `/housing-market/central-oregon` SQL leak **rejected**. Pronghorn 23-day pending + 0 Closed **rejected** (0 Closed honest; median-to-pending null).
- Class: `publishPlatDisplayName` withholds MLS abbreviations on peer plats and place-context. `resolveNeighborhoodAliasRedirect` 308s Bend districts in middleware (page-level `permanentRedirect` was a soft 200 under Next 16). Gate `ci:publish-place-names` 6/6.
- Prod probe after READY `aa4c62d67`: `/neighborhoods/awbrey-butte` **308** → `/cities/bend/awbrey-butte` (64 homes). `/neighborhoods/tetherow` does not 308. River Meadows More areas: Sun Dance / Deschutes River Recreation Homesites, **0** of Oww / DrrhTrs / OWW2. After shots `/opt/cursor/artifacts/after_neighborhoods_awbrey_308_{390,1280}.png`, `/opt/cursor/artifacts/after_river_meadows_peers_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109/R-110/R-111/R-122, SITE_PAGE_STANDARD §1+§4, git-commit.

# Prior — 2026-08-18 (cursor-loop-chain) — seller valuation name + 24h + Places overlay slice

**Surface:** Cursor cloud `bc-53dadb0e` (`cursor/loop-chain-2026-08-17t23-20-af1f`). **Time:** 2026-08-18 ~00:10 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:seller` (8 of 372). Claimed parent only. Product **`109af2b3b`** landed on **`main`**. Vercel Production **READY** for `109af2b3b` (`47HoMGUP4L9YwxA2hsu8LBmjHrYB`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (364 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 seller lines) at 390+1280: Step 2 required Your name **reproduced** (`name=name` `required`). Places `.pac-item` over Value my home at 390 **reproduced**. Confirmation missing 24-hour SLA **reproduced** in source. Address clear after select **rejected** (Somerset / Greenwood stuck). Step 2 reset while typing phone **rejected** (503 / 541 stayed on step 2). Bend median format mismatch **rejected** (visible `$755,000` once; `$$755,000` is RSC `$` escape).
- Class: `publishSellValuationConfirm` + `sellQualifyNameRequired()`. Email required, name optional, confirm names **within 24 hours**. `AddressAutocomplete` reserves `pb-48` while open and removes its `.pac-container` on unmount. Gate `ci:publish-sell-valuation` 5/5.
- Prod probe after READY `109af2b3b`: name input `required=false`, label Your name (optional). Value my home clickable under open suggestions. Fleet-identity confirm: **within 24 hours**, no business day. After shots `/opt/cursor/artifacts/after_sell_{390,1280}_{step1,pac,step2,median,confirm}.webp`.
- Punch dispositions appended (parent not completed): 5 fixed + 3 rejected. Leftover seller + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-096/R-132, SITE_PAGE_STANDARD §5, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — listing-detail history + unmute slice

**Surface:** Cursor cloud `bc-738b62c1` (`cursor/loop-chain-2026-08-17t22-07-294b`). **Time:** 2026-08-17 ~23:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 380). Claimed parent only. Product **`8ce73d3d2`** landed on **`main`** (history merge `386ad65da` + `zonedDateKey` `5f2aaea32` + timeout seed). Vercel Production **READY** for `8ce73d3d2` (GitHub Vercel success `EVe1nnE1ozvKACJeuxHk3Emydmfn`). Draft PR **#90**. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (372 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280: Borden / Rockway / Breezes missing history **reproduced** (`listing_history` empty; live `status_history` + `OnMarketDate` unused). Rockway UNMUTE on still **reproduced** (Zillow view-imx in `details.Videos`, zero `<video>`). Stale Aug 15 open house **rejected** (`OpenHouses` null, Pending, no Open houses heading).
- Class: `publishListingHistory` merges `listing_history` + `status_history` + `price_history` + Listed from `OnMarketDate`. `publishListingHeroUnmute` is video-tag only; 3D/Zillow rows are virtual tours. Timeout seed: `readListingDetailHistory` falls back to Listed from the already-loaded listing so a 3s empty ISR cannot hide the section. Gate `ci:publish-listing-history` 5/5.
- Prod probe after READY `8ce73d3d2`: Borden **listed-2026-07-22 $487,000**; Rockway **pending-2026-08-17 + listed-2026-07-31 $649,000**, no UNMUTE; Breezes **listed-2026-08-08 $1,250,000**. After shots `/opt/cursor/artifacts/after_history_{borden,rockway,breezes}_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 7 fixed + 1 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.
- Known leftover on this family: `PropertyHistory` `formatDate` shifts date-only `YYYY-MM-DD` one calendar day earlier in PT (`new Date('2026-07-22')` → Jul 21). Event keys are correct; display is not. Next listing-detail slice should format through `zonedDateKey`, not UTC midnight.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-094/R-105/R-152/R-101, SITE_PAGE_STANDARD §3, git-commit.

# Prior — 2026-08-17 (cursor-grok-tile-mv-probe) — listing_tile_mv health probe

**Surface:** Cursor desktop on `/Users/matthewryan/RyanRealty`. **Time:** 2026-08-17 ~22:45 UTC. Matt asked to fix the CRM health text that paged on `listing-tile-mv-stale`. This is **not** a FLEET-PUNCH / `fleet:public-ux:search` ship. Claimed data-sync node **`56aa39db`** only. Product **`9e06e018`** landed on **`main`**. Vercel Production **READY** (`dpl_AuMtN6UH4Dre8CAQ4XGSvVVDhDqS`, `npm run deploy:verify` exit 0). No PR. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` stays open**. Loop stays **ARMED**. Do not start leftover search from this session.

**Done**
- Rule 8 pages on `mv_refresh_state.listing_tile_mv_src.refreshed_at` age ≥ 2 hours, not `mv_freshness().lag_days`. Friday-to-Monday CloseDate gap (alert 1013, 2026-08-17 18:11Z) stays quiet while the `:02/:32` tile job is live. The 8-day stamp-stale class still critical.
- Cron message names `refresh_listing_tile_mv_30min` and `/api/cron/refresh-mvs`.
- 54 `lib/crm/health-rules` tests. Node **`56aa39db` done** with READY evidence.
- CMA WIP remains on `cursor/cma-client-document-7fc3` + stash `cma-wip-keep-probe`. Do not mix it into this ship.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice.
- Optional later: `mv_freshness()` can return `refresh_age_hours`; residual Sat/Sun `server restarted` on long tile refreshes.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, deployments-cicd.

# Prior — 2026-08-17 (cursor-loop-chain) — search pending status chrome slice

**Surface:** Cursor cloud `bc-1dc8ed53` (`cursor/loop-chain-2026-08-17t21-15-4427`). **Time:** 2026-08-17 ~21:50 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:search` (8 of 396). Claimed parent only. Product **`f7383a332`** landed on **`main`**. Vercel Production **READY** (`6H84kwqZR9MjxdwkZbJHBFJK1REy`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (388 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 search lines) at 390+1280: acreage Aw Snap **rejected** (200, heading renders). Pending chip For Sale / no Pending cards **reproduced**. First card → `/subdivisions` **rejected** (listing href). No Alerts / missing Alerts at 1280 (2 lines) **rejected** (Save is the alert; Get listing alerts 121×28). Count/sort clipped at 1280 **rejected** (1,279 homes + Sort Newest visible). Map/List overlay at 390 **rejected** (List/Map y=255). Save name-only dialog **rejected** (Email alerts + you@email.com).
- Class: `publishSearchStatusChip` + `publishListingStatusBadge`. SearchFilterBar, SEO list cards, and map cards name pending/sold. Gate `ci:publish-search-status` 5/5.
- Prod probe after READY `f7383a332`: pending chip **Under contract only**. First card **Pending $1,199,000** 2999 Three Sisters. 9 Pending badges. After shots `/opt/cursor/artifacts/after_pending_{390,1280}_{top,cards}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover search + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-105/R-152/R-101, SITE_PAGE_STANDARD §2, git-commit.

# Prior — 2026-08-17 (cursor-loop-sentinel) — search Homes door + 390 sort slice

**Surface:** Cursor cloud `bc-16d00c5f` (`cursor/loop-sentinel-2026-08-17t20-40-4ced`). **Time:** 2026-08-17 ~21:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:search` (8 of 404). Claimed parent only. Product **`d12437028`** landed on **`main`**. Vercel Production **READY** (`7eWxd8WGZ9tguq5rDggg2QGztuSV`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main` at product). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (396 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 search lines) at 390+1280: chips 0x0 **rejected** (For sale/Beds/Baths 79×44; Price probe matched Price drops). Homes + See homes Bend inject **reproduced**. Watching bar onto `/join` **rejected** (clean visit false). All-filters no panel / missing alerts / left-offset / tap-noop (4 lines) **rejected** (sheet 390×844, Owner financing unclipped; Save is the alert). Count/sort clipped **reproduced** (390 sort sat on the chip row).
- Class: Buy/Homes doors use `REGIONAL_SEARCH` / `REGIONAL_SEARCH_HREF` (`/homes-for-sale?view=list`). `.search-app-frame` drops the leftover 64px offset; filter dock stays in flow. Gate `ci:publish-regional-search-href` 12/12.
- Prod probe after READY `d12437028`: Homes href + 1280 click land on **`/homes-for-sale?view=list`**, **3,380 homes found**, no Showing Bend only. 390 map: chips y=198, **Newest y=255**, **1,279 homes** visible above the first card. After shots `/opt/cursor/artifacts/after_homes_1280_regional_list.png`, `after_search_390_sort_count_visible.png`, `after_search_list_390_regional.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover search + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-105/R-152/R-101, SITE_PAGE_STANDARD §2, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — homepage regional grain + remainder slice

**Surface:** Cursor cloud `bc-191234c4` (`cursor/loop-chain-2026-08-17t17-08-2150`). **Time:** 2026-08-17 ~17:55 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:site` (8 of 412). Claimed parent only. Product **`d400501f5`** landed on **`main`**. Vercel Production **READY** (`D2VDAjEH2M5nExLQB94EjA6CtiZL`, `npm run deploy:verify` exit 0). Draft PR **#88** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (404 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 site lines) at 390+1280: featured plat 8/12 zero **rejected** (no plat strip on `/`; 4 community cards). Town-door sum vs hero 1,823 **reproduced** (delta 895). Six town rows broken **rejected** (6 visible, fill opacity 1). SEE EVERY COMMUNITY overlap **rejected** (contrast 14.23). Dual/triple primary CTAs (3 lines) **rejected** (See homes filled + Value my home ghost; Search is form submit). Watching sheet on first load **rejected** (clean visit false; residual cookie only).
- Class: hero lead names regional grain (`across Central Oregon`). Town doors call `namePulseCityRemainder` + `formatPulseCityRemainderPublic`. Gate `ci:pulse-city-remainder` covers `app/page.tsx`. Remainder CSS appended at end of `kb.css` so `ci:css-layers` baseline line numbers stay put.
- Prod probe after READY `d400501f5`: hero **1,823 homes for sale across Central Oregon**. Town remainder names Black Butte Ranch / Camp Sherman / Culver / Madras / Metolius / Powell Butte / Prineville + **646 more** outside town rows. After shots `/opt/cursor/artifacts/after_home_{390,1280}_{hero,towns}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover site + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, SITE_PAGE_STANDARD, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — search card ask + filter sheet slice

**Surface:** Cursor cloud `bc-decba6c7` (`cursor/loop-chain-2026-08-17t13-06-4a94`). **Time:** 2026-08-17 ~13:50 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:search` (8 of 436). Claimed parent only. Product **`19ef79d81`** landed on **`main`**. Vercel Production **READY** (`8J6smhg5f6yasqpoNzKMMY9WAUwX`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (428 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 search lines) at 390+1280: Summerfield card $2,000,000 vs H1 $1,999,900 **reproduced**. Save/Alerts (2 lines) **rejected** (Save is the alert; Get listing alerts at 1280). All-filters Owner finan clip **reproduced**. Rainier price/status history **rejected** (listing-detail). Sold timeout **rejected** (200, empty map, no timeout). Chips 0x0 at 390 **rejected** (79x44 tappable). Dismiss without Apply **rejected** (cancel).
- Class: `ListingCard` + `VideoListingCard` use `formatPublishedAsk`. All-filters `data-[side=right]:w-full` + wrapping boolean labels. Gate `ci:publish-listing-ask` 15/15.
- Prod probe after READY `19ef79d81`: search card **$1,999,900** (0 of $2,000,000). Sheet **390 wide, Owner financing unclipped**. After shots `/opt/cursor/artifacts/after_summerfield_390_card_in_view.png`, `after_search_{390,1280}_filters.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover search + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-105/R-152/R-101, SITE_PAGE_STANDARD §2, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — blog MOS verdicts + index uniqueness slice

**Surface:** Cursor cloud `bc-791e34a1` (`cursor/loop-chain-2026-08-17t12-16-0077`). **Time:** 2026-08-17 ~12:30 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 444). Claimed parent only. Product **`b4f03efdc`** landed on **`main`**. Vercel Production **READY** (`FxtYpHcRf1RTbkLxzKfCS1DWEgnw`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (436 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines) at 390+1280: CO July 5.4 as middle + buyer **reproduced**. Bend July 474 vs 512 **rejected** (June 30 vs July 9 grains). Index Vacation Rental on p2 and p3 **reproduced**. MOS excerpt July vs body Aug 17 **rejected**. Checklist days 6-24 **rejected** (range headings). Redmond related-homes / See Redmond homes **rejected**. Closing Talk to a broker **rejected**. Sell-Bend overflow **rejected** (`scrollWidth===clientWidth`).
- Class: `rewriteBlogMosVerdicts` uses `marketVerdict()` (≤4 seller's, <6 balanced, ≥6 buyer's) after `rewriteBlogCurrentMos`. `publishBlogIndexItemList` uses collection-global positions + `published_at`+`id` order (`published-blog-posts-v4`). Gates `ci:publish-blog-mos-verdicts` + `ci:publish-blog-index-list`.
- Prod probe after READY `b4f03efdc`: CO July **Sunriver 12.0 + La Pine 11.4 buyer; Madras 5.4 balanced**. `/blog?page=2` positions 13-24; `/blog?page=3` 25-36; overlap empty. After shots `/opt/cursor/artifacts/after_co_july_1280_body.png`, `after_*_{390,1280}_*.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-002/R-024, SITE_PAGE_STANDARD §7, git-commit.

# Prior — 2026-08-17 (cursor-loop-sentinel) — blog NW Crossing alias slice

**Surface:** Cursor cloud `bc-b9425f1f` (`cursor/loop-sentinel-2026-08-17t11-40-d87e`). **Time:** 2026-08-17 ~12:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 426). Claimed parent only. Product **`f29d930dd`** landed on **`main`**. Vercel Production **READY** (`FwWvpPVpzcSGr7eMH7m5H7xs2ktx`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (418 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines) at 390+1280: June-vs-May **rejected** (report month vs May closings). NW Crossing related-homes **reproduced** as Bend rail. $475k vs $500k **rejected** (attached floor vs overall). Schools scroll **rejected** (ids unchanged). Eagle Crest related-homes **rejected** (already Eagle Crest). Buyers related-homes / blank MORE RESOURCES **rejected** (Bend homes + explore populated). Buyers vs 3.6 months **rejected** (body already not-a-full-buyer). Dining related-homes / Value my home **rejected** (lifestyle withhold + Talk to a broker).
- Class: `matchGeoLinksForPost` accepts registry slugs + `COMMUNITY_ALIASES` (`nw crossing`, `nwx`) so a neighborhood short name wins over city Bend. Gate `ci:publish-blog-related-homes` 7/7.
- Prod probe after READY `f29d930dd`: NW Crossing **#related-homes NorthWest Crossing homes** / See NorthWest Crossing homes / $1,549,500. Eagle Crest still Eagle Crest. Dining: no related-homes, Talk to a broker. After shots `/opt/cursor/artifacts/after_nwx_{390,1280}_nwx_homes.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, SITE_PAGE_STANDARD §7, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — blog related-homes / CTA slice

**Surface:** Cursor cloud `bc-e459ecbb` (`cursor/loop-chain-2026-08-17t10-35-b6a3`). **Time:** 2026-08-17 ~11:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 442). Claimed parent only. Product **`10a8a7a77`** landed on **`main`**. Vercel Production **READY** (`PKBGTWs5K9Bcdg7SdpsVyvLfSarC`, `npm run deploy:verify` exit 0). Draft PR **#82** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (434 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines) at 390+1280: Brasada / Bend-retirees / Caldera related-homes **reproduced** (no `#related-homes` before). Arts + retirement related-homes **rejected** (lifestyle tags, no buyable place). Arts + retirement missing CTA **reproduced**. Retirement numbers-disagree **rejected** (CMS ranges; no same-label pair).
- Class: `publishBlogRelatedHomes` + `matchBuyablePlaceForPost` (community via geo links; city only with buy-intent). `publishBlogContextualCta` → See {place} homes vs Talk to a broker `/contact`. Gate `ci:publish-blog-related-homes` 6/6.
- Prod probe after READY `10a8a7a77`: Brasada **#related-homes** $1,425,000 / See Brasada Ranch homes. Bend retirees **Bend homes** $750,000 / See Bend homes. Caldera **$3,400,000** / See Caldera Springs homes. Arts + retirement: no related-homes, **Talk to a broker → /contact**. After shots `/opt/cursor/artifacts/after_{brasada,caldera,bend_retirees}_1280_homes_clear.png`, `after_{arts,retirement}_1280_cta_clear.png`.
- Punch dispositions appended (parent not completed): 5 fixed + 3 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, SITE_PAGE_STANDARD §7, git-commit.

# Prior — 2026-08-17 (cursor-loop-sentinel) — place-pages resort index 12-vs-35 slice

**Surface:** Cursor cloud `bc-99eda833` (`cursor/loop-sentinel-2026-08-17t09-40-82e4`). **Time:** 2026-08-17 ~10:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 450). Claimed parent only. Product **`f76383e76`** landed on **`main`**. Vercel Production **READY** (`GRTMbTeioUET9JxfiSDTY4MyPL3y`, `npm run deploy:verify` exit 0). Draft PR **#81** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (442 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Big Sky / Calaveras $756k/18 days **rejected** (hero silent). Housing-market wheel nav **rejected** (URL unchanged). Larkspur Grotto $1,238,000 vs $1,238,136 **rejected** (exact $1,238,136 only). `/neighborhoods/tetherow` **rejected** (404). `/communities` 19/$2.25M **rejected as stated**. Homepage Tetherow 12 vs page 35 **reproduced**; A-Z also 12.
- Class: `publishResortIndexFigures` + `getRegistryResortPublicFigures` overlay alias-aware count/median on homepage, `/communities` flagship + A-Z, and `getCommunityBySlug`. City door = registry city + `mls_cities` (a global pile inflated Tetherow to 48 via Triple). Gate `ci:publish-resort-index-figures` 6/6.
- Prod probe after READY `f76383e76`: homepage **Tetherow 35 ACTIVE**, `/communities` A-Z **Tetherow Bend · 35 homes**, `/communities/tetherow` **35 / $1,499,000**. After shots `/opt/cursor/artifacts/after_v6b_{home,communities,tetherow}_{390,1280}.png`.
- Punch dispositions appended (parent not completed): 2 fixed + 6 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS.

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages hero-empty / regional / ask slice

**Surface:** Cursor cloud `bc-2843f15f` (`cursor/loop-chain-2026-08-17t09-06-ba29`). **Time:** 2026-08-17 ~09:45 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 458). Claimed parent only. Docs/probe **`2d8accfe5`** landed on **`main`**. Vercel Production **READY** (`BMKP2RCrCs7BAKvShrAykFtDpjMy`, `npm run deploy:verify` exit 0). No PR (branch SHA equals `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (450 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Calaveras / Blakley / Aspenwood / Canyon Breeze / Aubrey Heights hero-count vs empty list **rejected** (hero silent; lists 5 / 8 / 1 / 1 / 1). 1925 Townhomes 155 Closed + $756k/18 days **rejected** (sales history 33 SFR; 1 card $999,000). Bend Park $756k/18 days **rejected** (hero silent; 4 cards). Summit West $2,035,000 vs $2,034,500 **rejected** (list + ticker both $2,034,500 / $1,999,900).
- No class-fix. Prior plat-inventory + publishPlatFigures + formatPublishedAsk already hold. Probe `scripts/probe-place-pages-punch-v5.mjs` + shots.
- Punch dispositions appended (parent not completed): 0 fixed + 8 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024/R-110/R-020, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — homepage ArrivalIntent quiz unmount

**Surface:** Cursor cloud `bc-8f43d00f` (`cursor/loop-chain-2026-08-17t08-22-7277`). **Time:** 2026-08-17 ~09:05 UTC. Brief served **solo Matt CHANGE** `08152acc` (class of one). Claimed that node. Product **`df1a8bfd8`** landed on **`main`**. Vercel Production **READY** (`3doPtMka2BFtvCg7uLj2c8GbthAS`, `npm run deploy:verify` exit 0). Draft PR **#80** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). Node **`08152acc` done**. FLEET-PUNCH parent stays open (other session). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Clean-cookie `/` at 390+1280: Buy/Sell/Look quiz under V3Chrome **reproduced** (`quizNav` y=57, links y=69, hero 512/423).
- Class: unmounted ArrivalIntent from `app/page.tsx`, deleted `ArrivalIntent.client.tsx` (reachable-exports), mounted `V3SectionTracker` so public-ui B does not grow. D103 + homepage-v6 parity + R-218. No new modal.
- Prod probe after READY `df1a8bfd8`: `quizNav` false, no Buy/Look quiz, header Sell only, hero 444/355. After shots `/opt/cursor/artifacts/after_home_{390,1280}_top.png`.
- Node `08152acc` completed with READY SHA evidence.

**Next**
- Next `loop-brief` serves the next ship class. Leftover punch families stay on FLEET-PUNCH.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not remount ArrivalIntent. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-113/R-218, git-commit.

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages exact list-median slice

**Surface:** Cursor cloud `bc-96d8d9d5` (`cursor/loop-chain-2026-08-17t07-47-939f`). **Time:** 2026-08-17 ~08:15 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 474). Claimed parent only. Product **`3168f52fc`** landed on **`main`**. Vercel Production **READY** (`8722cBnVRL22wcBTFxC8U4urHKHQ`, `npm run deploy:verify` exit 0). Feature branch same SHA (no PR: no diff vs `main`). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (466 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: Southern Crossing hero $919,500 vs HUD/FAQ/sell $920,000 **reproduced**. Tetherow $1,200,000 vs $1,199,500 **rejected** (median $1,499,000; $1,199,500 is Brookside Way). NWX High Lakes / Ordway card rounds **rejected** (already exact). Widgi 10 vs 23 / Regional **rejected**. Awbrey Court 155 Closed vs 26 **rejected**. Amber Springs / Bailey / Bradetich Park hero-count vs empty list **rejected** (hero silent; list 2 / 2 / 1).
- Class: `kbMoneyFull` and `buildMarketFaq` print exact whole dollars for list medians. Activity ledger uses `formatPublishedAsk`. Gate `ci:publish-listing-ask` 13/13.
- Prod probe after READY `3168f52fc`: Southern Crossing **$919,500** on hero + HUD + FAQ (0 of $920,000). NWX **$1,199,900** on hero + HUD + sell (0 of $1,200,000). After shots `/opt/cursor/artifacts/after_v4_southern_crossing_{390,1280}_{top,hud}.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS §0 plat row.

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages inventory / ask / Tumalo slice

**Surface:** Cursor cloud `bc-3a2506e2` (`cursor/loop-chain-2026-08-17t06-56-2ebd`). **Time:** 2026-08-17 ~07:50 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages` (8 of 482). Claimed parent only. Product **`d3bff1ccb`** landed on **`main`**. Vercel Production **READY** (`npm run deploy:verify` exit 0). Draft PR **#78** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (~474 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 place-pages lines) at 390+1280: South Meadow 0 vs 3 MLS **reproduced**. Tumalo 307→Bend **reproduced**. Deer Park / Deschutes River Recreation Homesites / Rivers Edge Village count+median **rejected** (own inventory). Boyd Acres / Old Bend / Southern Crossing thousand-round asks **reproduced**.
- Class: plat city aliases (`rowMatchesPlat`) so Sisters-keyed South Meadow matches City=`Black Butte Ranch`. Pulse-only city door for Tumalo (redirect removed). `formatPublishedAsk` / `formatPriceExact` on place-owned list and median. Do not cache empty plat inventory when supabase is missing (`registry-plat-public-inventory-v3`).
- Prod probe after READY `d3bff1ccb`: South Meadow **3 / $795,000**. Tumalo **200** at `/cities/tumalo`, 0 homes, Tumalo copy. Deer Park 12 / $862,498. DRRH 14 / $789,950. Rivers Edge 11 / $1,159,000. Boyd **$949,900** / **$899,900**. Old Bend **$1,999,500**. Southern Crossing median **$919,500**. After shots `/opt/cursor/artifacts/after_v3_{south_meadow,tumalo,boyd_acres,old_bend,southern_crossing}_{390,1280}_top.png`.
- Punch dispositions appended (parent not completed): 5 fixed + 3 rejected. Leftover place-pages + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS §0 plat row.

# Prior — 2026-08-17 (cursor-loop-chain) — listing-detail HOA / ask / contact slice

**Surface:** Cursor cloud `bc-42b57373` (`cursor/loop-chain-2026-08-17t04-57-75e4`). **Time:** 2026-08-17 ~05:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:listing-detail` (8 of 506). Claimed parent only. Product **`cf90a3c2e`** landed on **`main`**. Vercel Production **READY** (`F3jT3EERo8nwXtMpMdLnfUZ4jK73`). `npm run deploy:verify` exit 0 in 448s. Draft PR **#72** (same SHA). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (498 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 listing-detail lines) at 390+1280 on production before the ship: Hilmer contact MLS **reproduced**. 7th / Horse / Kokanee / Hudspeth / Canyons / Foley HOA **reproduced** (Facts nearest-thousand vs True cost exact). 7th + Hudspeth ask **reproduced** (H1 thousand-round vs JSON-LD). Kokanee baths 3 vs 2.5 **rejected** (hero `BathroomsTotal`, remarks are MLS prose). Bryant crash **does not reproduce** (200, H1 $1,073,000).
- Class: `publishListingHoa` exact monthly on Facts + True cost + CMA fee fallback. `publishListingAsk` / `publishListingDrop` exact `ListPrice` on H1 + drop. `publishListingContactKey` prefers `ListNumber`; `/contact` resolves listingKeys + listNumbers. Gates `ci:publish-listing-hoa` 3/3, `ci:publish-listing-ask` 3/3, `ci:publish-listing-contact-key` 4/4.
- Prod probe after READY (`PROBE_PREFIX=after_`): 7th H1 **$424,990** = JSON-LD; Facts HOA **$45** = True cost. Foley **$22**. Canyons **$1,529**. Hudspeth **$629,500** / drop **$15,500** / HOA **$160**. Hilmer `/contact?listingKey=220222626` shows **61172 Hilmer Creek**. Horse **$70**. Kokanee **$42**. Bryant still 200 / $1,073,000. After shots `/opt/cursor/artifacts/after_listing_{7th,foley,hilmer,hudspeth}_{390,1280}_*.png`.
- Punch dispositions appended (parent not completed): 7 fixed + 1 rejected. Leftover listing-detail + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-024, git-commit, DATABASE_FOR_AI_AGENTS lookup (listing HOA / ask / contact key).

# Prior — 2026-08-17 (cursor-loop-sentinel) — site regional See homes slice

**Surface:** Cursor cloud `bc-a505260a` (`cursor/loop-sentinel-2026-08-17t02-40-c49f`). **Time:** 2026-08-17 ~03:20 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:site` (8 of 518). Claimed parent only. Product **`ebd0d0279`** on this branch. Draft PR **#69**. `npm run push` gates + build green. **Production is not this SHA** — cloud run stays off `main`; `deploy:verify` found no production deploy for `ebd0d02` (vercel ls hung). No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (510 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 site lines) at 390+1280 on production: Bend 484 vs city 483 **does not reproduce** (both 483 / $756,000). Get-alerts silent revert **does not reproduce** (1280 Set). Hero vs map 1,835 **does not reproduce** (both settle 1,836; mid-count is animation). Three hero CTAs **reproduced, rejected** (product lock). Two headers **reproduced, rejected** (ArrivalIntent). Town doors no photos **does not reproduce** (town-fill opacity 1). SEE HOMES → Bend **reproduced**.
- Class: `publishRegionalSearchHref` → `/homes-for-sale?view=list` on homepage See homes, towns CTA, map Browse homes, featured view-all, footer. Gate `ci:publish-regional-search-href` 8/8.
- Prod probe `scripts/probe-site-punch-prod.mjs`: `showingBendOnly: true` on live `/homes-for-sale`. Screenshots `/opt/cursor/artifacts/site_home_{390,1280}_top.png`, `site_see_homes_{390,1280}.png`, `site_bend_{390,1280}_top.png`.
- Punch dispositions appended (parent not completed): 1 fixed + 7 rejected. Leftover site + other families stay on the inbox.

**Next**
- Merge PR 69 so production picks up `?view=list`. Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-002/R-024/R-095, git-commit, DATABASE_FOR_AI_AGENTS lookup (regional href).

# Prior — 2026-08-17 (cursor-loop-chain) — blog gutter + live MOS slice

**Surface:** Cursor cloud `bc-1d79681c` (`cursor/loop-chain-2026-08-17t01-20-78f6`). **Time:** 2026-08-17 ~02:05 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:blog` (8 of 503). Claimed parent only. Product **`a17c3f4c0`** (accept probe `a58402a54`) landed on **`main` @ `18bb59e02`**. Vercel Production **READY** (`G8nDqmYjyuKXPXDmq59hbPm7LVEi`). `npm run deploy:verify` exit 0 in 734s. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` released, stays open** (495 leftover lines). Loop stays **ARMED**. Do not start a new ship class from this session.

**Done**
- Slice (8 blog lines): body flush / Share clip on moving-to-redmond, preparing-home-for-sale, hb-2001, retirement (flush + first-char clip) **reproduced** at 390+1280. Self-nav on retirement **does not reproduce** (URL unchanged; related posts are arts-culture / working-remote / raising-kids). MOS 6.5 vs June 6.0 **reproduced**.
- Class: article island shares `--v3-measure` + `--v3-gutter` (`V3ArticleIsland.css`). Current MOS rewrites through `publishBlogCurrentMos` ← `getMarketPulse` + `publishMonthsOfSupply`. June `X.X in 20XX` snapshots stay. Gate `ci:publish-months-of-supply` 11/11.
- Production probe `scripts/probe-blog-punch-prod.mjs` after READY: `layoutOk` `mosOk` `navUnchanged`. Body/Share left = H1 gutter (20 @ 390, 84 @ 1280). Visible overall **Central Oregon overall: 5.7 months**. 0 of 6.5. Screenshots `/opt/cursor/artifacts/after_blog_{redmond_390_top,redmond_1280_body,mos_390,mos_1280}.png`.
- Punch dispositions appended (parent not completed): 6 fixed + 2 rejected. Leftover blog + other families stay on the inbox.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-002/R-024, git-commit, DATABASE_FOR_AI_AGENTS lookup (pulse only).

# Prior — 2026-08-17 (cursor-loop-chain) — place-pages days figure slice

**Surface:** Cursor cloud `bc-d246e9da` (`cursor/loop-chain-2026-08-17t00-32-e58c`). **Time:** 2026-08-17 ~01:35 UTC. Brief served **FLEET-PUNCH** as `fleet:public-ux:place-pages`. Matt override: punch list is the inbox, not one job. One family, p0 first, max 8 lines. Search-count / Show 409 / 390 chips skipped (already on `main`). No child tickets. No review PR. Product **`949a01e5a`**. Vercel Production **READY** (`Fp9jYCrGV3h9bcvfAzUU9mRyWF3i`). `npm run deploy:verify` exit 0. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). FLEET-PUNCH parent **`3a6198cd` stays open** (inbox). Loop stays **ARMED**.

**Done**
- Slice (8 p0 place-pages days lines): Black Butte card 40 vs FAQ 39.5; NWX 11 vs 10.5; Broken Top 9 vs 8.5; Brasada 16 vs 15.5; Redmond 20 vs 19.5; Larkspur 7 vs 6.5. Sunriver 19.5 vs 20 and La Pine 50.5 vs 51 **do not reproduce** (all 18 / all 50).
- Class: SoR `publishDaysFigure` / `publishDaysLabel`. Pulse medians land on half-days. Tenths grain. No `Math.round` on a public days figure. Gate `ci:publish-days-figure`.
- Production probe `scripts/probe-days-figure-prod.mjs` **6/6** after READY: BBR 39.5, NWX 10.5, Broken Top 8.5, Brasada 15.5, Redmond 19.5, Larkspur 6.5. Screenshots `/opt/cursor/artifacts/black_butte_days_{1280,390}.png` (hero Pending in 39.5 days) and `redmond_days_{1280,390}.png`.
- Punch dispositions appended (parent not completed): 6 fixed + 2 rejected. Larkspur price $1,238,000 vs $1,238,136 left on the inbox as a new remainder line. Search-count lines untouched.

**Next**
- Leftover punch families stay on FLEET-PUNCH. Next `loop-brief` serves the next family slice. Do not class-fix the whole punch list.

**Do not:** completeWorkNode on FLEET-PUNCH. Do not mint child tickets. Do not insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, fleet-intake-core / ship-class punch-slice (PR 59).

# Prior — 2026-08-17 (cursor-loop-chain) — search count LIVE on main

**Surface:** Cursor cloud `bc-4382906a` (`cursor/loop-chain-2026-08-16t23-45-84b5`). **Time:** 2026-08-17 ~01:05 UTC. Rebased onto `79fb9820b` (PRs 57/58 FLEET-PUNCH intake kept). Product **`735c31037`**. Vercel Production **READY** (`dpl_FUgkMxxiq34GmTuvnmbe8geq1iVK`). `npm run deploy:verify` exit 0. PR 59 punch-list serve (`811ecbefc`) landed after that SHA — not touched, not folded. No hosted migration. No public-ux or factory ledger insert (open window `2a5054ac`). Loop stays **ARMED**. Eight search-class nodes stay **done**. Do not start a new ship class.

**Done**
- Rebased `cursor/loop-chain-2026-08-16t23-45-84b5` onto current main. Product commits survived. Fast-forward `main` + one `npm run push`.
- Production 2026-08-17T00:50Z (MISS, dpl_FUgkMxxiq34GmTuvnmbe8geq1iVK): `/homes-for-sale/bend` **1,298 homes for sale, all types**. FAQ question **How many single-family homes are for sale**. Answer **active single-family listings**.
- Class: SoR `publishSearchCount` / `publishSearchCountPair`. Gate `ci:publish-search-count`. Local probe ok before rebase; after rebase `ci:publish-search-count` + 190 tests including fleet-intake-core.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Next**
- Leftover 33 `fleet:public-ux:search` siblings stay open for the next iteration. Do not start them from this session.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not touch FLEET-PUNCH. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor) — fleet full site review (R-217)

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~17:15 PT. Matt: pack-only briefs were too limited; he already had the bots do a full site review. Not a fleet-node fix. Product **`5d983f76`**. Vercel Production **READY** (`dpl_5dzNFFkBD4tweMF8fdL4emzqxeui`). `npm run deploy:verify` exit 0. Production briefs confirmed: walker-mobile has SITE REVIEW and does not end on token match; Flow Prover does NOT do SITE REVIEW; content-blog lane serves. No hosted migration. No public-ux or factory ledger insert (open windows `2a5054ac` / `ba3435dd`). Loop stays **ARMED**. Ship-class R-216 stamp is Prior. FLEET-PUNCH intake (PRs 57/58) landed on the same `main` tip.

**Done**
- Live briefs no longer end walker / money / stats / lane runs on RUN-TOKEN match. Packs are the floor. Walkers walk pack cases every run, then SITE REVIEW (home, search, cities, communities, neighborhoods via `/cities/{city}/{slug}`, market, sell, team, stand-alone listing, footer). Flow Prover stays on the four flows and may END on token match (do not re-submit).
- Extra lanes Matt already stood up are now served at `/api/fleet/briefs/<bot>`: page-core, chrome-nav, content-blog, geo-cities, geo-places, geo-subdivisions, listings-*, matrix-*, LEGAL, SOCIALS, e2e-proof.
- Pack header no longer says "END this run now". R-209 amended. R-217 VERIFIED. Max pin R-217. G44 asserts SITE REVIEW + no pack-wide END. Ship-class folds `/subdivisions` and `/oregon` into place-pages; `/admin/loop` names blog posts.
- Intake already ran on the flood: ~634 findings, 570 in the last 6h, 520 open nodes. Dominant classes: plat pages, blog (related-homes / self-nav / month-vs-figures), listing inventory, place counts. Do not start instance fixes from this session — next `loop-brief` prints the ship class.

**Next**
- Extra bots that still have paste-only instructions should use the 3-line bootstrap (`GET /api/fleet/briefs/<bot-id>`) so they do not snap back.
- Next `loop-brief` prints the ship class for the incoming flood. Do not start instance fixes from this session.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, REQUIREMENTS R-209/R-216/R-217, VERIFICATION-FLEET, database-canonical-reference (findings query only).

# Prior — 2026-08-16 (cursor) — ship class: one rebuild per category

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~16:45 PT. Matt ADD (R-216). Not a fleet node. Product **`63422a30`**. Vercel Production **READY** (`dpl_4RWYnF4abxZ5wGE82DtWq1KQpVXH`). `npm run deploy:verify` exit 0. No hosted migration. No public-ux or factory ledger insert (open windows `2a5054ac` / `ba3435dd`). Loop stays **ARMED**. Southern Crossing reject stamp from `bc-b448549b` is Prior.

**Done**
- Bots were minting many same-category findings. The graph served one node per cycle; each cycle ran isolated `next build` + `deploy:verify`. That is the Build CPU burn.
- Class: `selectShipClass` groups fleet nodes by domain + surface family (place pages, search, listing detail). Planned G-rows stay a class of one. Cap 8; leftovers stay open for the next slice of the same class.
- Brief prints **SHIP CLASS** and forbids push until the printed set is locally accepted. Sentinel prompt is ONE SHIP CLASS, one `npm run push`, one `deploy:verify`. `claimShipClass` claims the set so another session cannot steal a sibling and push alone.
- `/admin/loop` says when the next items rebuild together. G44 fails if the prompt or brief regresses to one-node-one-rebuild. R-216 VERIFIED.
- Fleet finding `08704f1f` / `8a95d715` Southern Crossing index-1 vs place-23 **rejected** (does not reproduce). Production shares 3 / $920,000. Probe `scripts/probe-southern-crossing-count-prod.mjs` exit 0. R-024 coverage note only.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, git-commit, REQUIREMENTS R-216, frontend-design, R-024.

# Prior — 2026-08-16 (cursor-loop-chain) — Southern Crossing index-1 vs place-23 finding rejected

**Surface:** Cursor cloud `bc-b448549b` (`cursor/loop-chain-2026-08-16t23-20-2fa9`). **Time:** 2026-08-16 ~23:35 UTC. Brief served fleet finding `08704f1f` (public-ux / fleet `8a95d715ef63989d964b9d643d2938f4`), not G16/G32. One node only. No product change. Production already **READY** on the shipped neighborhood inventory class (`9cac09b1` / plat pulse `3f34bf653`). `npm run ci:gates` 224/224. No hosted migration. Loop stays **ARMED**. Node **done** (rejected: does not reproduce). Finding `8a95d715` status rejected. No public-ux ledger insert (open window `2a5054ac`). Collision: `cursor-loop-chain-2026-08-16t23-20-dd33` claimed first and wrote graph evidence at 23:25:36 (xref SFR+PUBLIC_ACTIVE=3; all-types Active=23 explains the stale 23). This session independently reproduced the same reject and stamps the handoff. Rebased onto ship-class `63422a307` (R-216 stays Current).

**Done**
- Fleet finding [p0]: Southern Crossing index tile 1 active vs place hero/map 23 homes / 23 ACTIVE LISTINGS vs FAQ 3 vs visible cards ~21. FIRST STEP reproduce: it does not. Class already shipped (`getNeighborhoodPublicInventory`).
- Production 2026-08-16T23:22Z (HIT/STALE): `/neighborhoods` tile **3 Active $920,000**, `/cities/bend` row **3 Active $920,000**, place hero **3 homes for sale in Southern Crossing** + **Median list $920,000**, FAQ / Dataset Active Listings **3**, `#homes` list **3** unique inventory hrefs, hydrated map badge **3 ACTIVE LISTINGS**. 0 of 1 / 21 / 23. Probe `scripts/probe-southern-crossing-count-prod.mjs` exit 0.
- Screenshots `/opt/cursor/artifacts/southern_crossing_count_{place,index_tile,city_nbh,city_ledger,place_map}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** ship-class R-216 `63422a307`. Awbrey 52/63/62 reject `1faedbd9b` (node `5688e089` **done**, does not reproduce). Ridge plat parent-pulse `3f34bf653` / stamp `d688cd4ef` (node `a8726dc3` **done**). Ridge plat SFR count `846193510` / stamp `7bf89b6ab` (node `390ea7a4` **done**). Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-sentinel) — Awbrey 52/63/62 three-count finding rejected

**Surface:** Cursor cloud `bc-c33f68f1` (`cursor/loop-sentinel-2026-08-16t23-10-7e09`). **Time:** 2026-08-16 ~23:20 UTC. Brief served fleet finding `5688e089` (public-ux / fleet `c2764a13014ffde27bb0758f43bdb546`), not G16/G32. One node only. No product change. **`main` @** `d688cd4ef` + this stamp. Production already **READY** on the shipped neighborhood inventory class (`9cac09b1` / plat pulse `3f34bf653`). `npm run ci:gates` 224/224. No hosted migration. Loop stays **ARMED**. Node **done** (rejected: does not reproduce). Finding `87884938` status rejected. No public-ux ledger insert (open window `2a5054ac`). Collision: `cursor-loop-chain-2026-08-16t23-10-c1cd` overwrote the claim at 23:13:58 with no evidence; this session completed it.

**Done**
- Fleet finding [p0]: Awbrey Butte index tile 52 ACTIVE / $1,385,000 vs place hero 63 homes / 63 ACTIVE vs FAQ 62. FIRST STEP reproduce: it does not. Class already shipped (`getNeighborhoodPublicInventory`).
- Production 2026-08-16T23:13Z (HIT): `/neighborhoods` tile **64 Active $1,363,000**, `/cities/bend` row **64 Active $1,363,000**, place hero **64 homes for sale in Awbrey Butte** + **Median list $1,363,000**, FAQ / Dataset Active Listings **64**, `#homes` list **64** unique inventory hrefs. 0 of 52 / 62 / 63 / $1,385,000. Probe `scripts/probe-awbrey-three-counts-prod.mjs` exit 0.
- Screenshots `/opt/cursor/artifacts/awbrey_three_{place,index_tile}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Ridge plat parent-pulse `3f34bf653` / stamp `d688cd4ef` (node `a8726dc3` **done**). Ridge plat SFR count `846193510` / stamp `7bf89b6ab` (node `390ea7a4` **done**). Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — withhold parent pulse on registry plat pages

**Surface:** Cursor cloud `bc-99a3fd18` (`cursor/loop-chain-2026-08-16t22-47-1f61`). **Time:** 2026-08-16 ~23:10 UTC. Brief served fleet finding `a8726dc3` (public-ux / fleet `6a52801e3ef9e0d041b830497794290d`), not G16/G32. One node only. Product **`3f34bf653`**. **`main` @** `3f34bf653` + this stamp. Vercel Production **READY** (inspector `Bns3BZiz96Whq1EtiUkcFBfbbVnR`). `npm run deploy:verify` exit 0 in 671s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). `npm run ci:gates` 224/224. No hosted migration. Loop stays **ARMED**. Node **done**. PR **#51**. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: Ridge At Eagle Crest index tile 12 / $910,000 vs place hero 14 / $535,000 / pending 19.5 days (Redmond city pulse). FIRST STEP reproduce: count and median already shared after the inventory class; **Pending in 19.5 days** still matched Redmond (Eagle Crest pending is 53).
- Class: SoR `publishPlatFigures` is the plat inventory median only. Days-to-pending and 30-day sold withhold. City/community pulse must not fill the unlabeled hero or sell tail. Gate `ci:publish-plat-figures`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — place hero **12 homes for sale in Ridge At Eagle Crest** + **Median list $910,000**, 0 Pending in 19.5 days / $535,000. Index tile **12 Active $910,000**. Redmond city still prints honest $535,000 / 19.5. Probe `scripts/probe-ridge-plat-pulse-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/ridge_pulse_{place,index_tile}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Ridge plat SFR count `846193510` / stamp `7bf89b6ab` (node `390ea7a4` **done**). Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — one SFR count on registry plat pages

**Surface:** Cursor cloud `bc-31d1fea8` (`cursor/loop-chain-2026-08-16t22-06-cbc5`). **Time:** 2026-08-16 ~22:45 UTC. Brief served fleet finding `390ea7a4` (public-ux / fleet `37d5349b2d2e55aa62df73389d8bad85`), not G16/G32. One node only. Product **`846193510`**. **`main` @** `846193510` + this stamp. Vercel Production **READY** (inspector `HgAYesBm6C5a5D8YAHyqbaEGcWs7`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). `npm run ci:gates` 223/223. No hosted migration. Loop stays **ARMED**. Node **done**. Same SHA already on `main` (no PR diff). No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: Ridge At Eagle Crest index tile 12 vs place hero 14 vs `#homes` 26. Reproduced on production before the class: three queries (geo_snapshot SFR Active / featured-fetch cap / PropertyType A including townhouses).
- Class: SoR `getPlatPublicInventory` is MLS SubdivisionName in the parent city, SFR (`property_type='A'` AND `property_sub_type='Single Family Residence'`) + `PUBLIC_ACTIVE_STATUSES`. Same payload on `/subdivisions` tiles and `/subdivisions/{slug}` hero + list keys. Gate `ci:publish-plat-inventory`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — index tile **12 Active**, place hero **12 homes for sale in Ridge At Eagle Crest**, `#homes` **12** unique inventory hrefs. 0 of 14 / 26. Probe `scripts/probe-ridge-plat-count-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/ridge_count_{place,index_tile}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Awbrey index-vs-place reject `6f334748e` / stamp `09de2a587` (node `2d90a914` **done**, does not reproduce). listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — Awbrey index-vs-place count finding rejected

**Surface:** Cursor cloud `bc-cfc9ebee` (`cursor/loop-chain-2026-08-16t21-49-e840`). **Time:** 2026-08-16 ~22:10 UTC. Brief served fleet finding `2d90a914` (public-ux / fleet `9f0392434899acb5c7543925a52e542b`), not G16/G32. One node only. No product change. **`main` @** `6f334748e` + this stamp. Production already **READY** on the shipped inventory class (`9cac09b1` / grain `c6c5ad1fd`). `npm run ci:gates` 222/222. No hosted migration. Loop stays **ARMED**. Node **done** (rejected: does not reproduce). PR **#50**. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: Awbrey Butte index tile 52 vs place hero/stat 63, and hero "63 homes for sale in Bend". FIRST STEP reproduce: it does not. Class already shipped earlier today.
- Production 2026-08-16T21:52Z (PRERENDER): `/neighborhoods` tile **64 Active**, `/cities/bend` row **64 ACTIVE**, place hero **64 homes for sale in Awbrey Butte**, FAQ / Dataset Active Listings **64**, `#homes` list **64** unique inventory hrefs. 0 of 52 / 63 / "homes for sale in Bend" on the place page. Probe `scripts/probe-awbrey-index-count-prod.mjs` exit 0.
- Screenshots `/opt/cursor/artifacts/awbrey_count_{place,index_tile,city_nbh}_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** listing down-payment `aba8c2222` / handoff `31e81df7b` (node `ee37b3a4` **done**). place list medians `eff056fb2`. page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — one published listing down-payment figure

**Surface:** Cursor cloud `bc-ee409fe5` (`cursor/loop-chain-2026-08-16t21-17-4508`). **Time:** 2026-08-16 ~21:45 UTC. Brief served fleet finding `ee37b3a4` (public-ux / fleet `0b2eea305a233f4a1d246cf2e8f1a299`), not G16/G32. One node only. Product **`aba8c2222`**. **`main` @** `aba8c2222`. Vercel Production **READY** (inspector `5BnZrcoJ1jTH6XJ35NajCE44MXam`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#49**.

**Done**
- Fleet finding [p0]: `/homes-for-sale/bend/61579-rockway-220226183` printed Monthly payment $130,000 down / $519,000 loan next to Rental analysis 20% · $129,800. 20% of the listed $649,000 is $129,800. Reproduced on production before the class.
- Class: SoR `publishFinancingSplit` is whole-dollar down plus remainder loan. Display those dollars exact, never nearest-thousand. Wired on listing Monthly payment, rental engine, estimated monthly payment, standalone mortgage calculator, and showcase payment. Gate `ci:publish-down-payment`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — Monthly payment **$519,200 · $129,800 down**. Rental analysis **20% · $129,800**. 0 of $130,000 / $519,000. Probe `scripts/probe-rockway-down-payment-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/rockway_down_{1280,390}_{monthly,rental,monthly_results}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** place list medians `eff056fb2` / handoff `fd72195e6` (node `6cc544ec` **done**). page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed `a67f17d6f`. Tetherow one-annual HOA. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — place list medians labeled with their geography

**Surface:** Cursor cloud `bc-b007f583` (`cursor/loop-sentinel-2026-08-16t20-10-291a`). **Time:** 2026-08-16 ~21:15 UTC. Brief served fleet finding `6cc544ec` (public-ux / fleet `5f0ec58d60988a52e76b8a559ef22f0c`), not G16/G32. One node only. Product **`eff056fb2`**. **`main` @** `9afe74a6a` + this handoff. Vercel Production **READY** (inspector `AWXRagFsuxjPARVYVgLpe1AQLsMu`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#48**.

**Done**
- Fleet finding [p0]: `/communities/tetherow` printed $1,499,000 as Regional median. Same number as the Tetherow list median on the hero. Reproduced on production before the class. Membership Initiation / Monthly dues printed as em-dashes. RSC leaked `market_stats_cache` / `geo_slug='bend'`.
- Class: SoR `publishSellMedian` pairs a place number with `{place} median`. "Regional median" only for the region pulse. KbSell withholds a price with no caption. Empty membership facts withhold (`publishFactValue`). Public chart sources go through `toPublicCoreChartSeries` (Oregon Data Share + human geography). Wired on community, city, neighborhood, homepage, ZIP, subdivision tail, listing market charts. Gate `ci:publish-median-caption`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — Tetherow footer **$1,499,000 Tetherow median**, 0 Regional median. Membership has no Initiation / Monthly dues rows. HTML has 0 table-name leaks. Homepage **$730,000 Regional median** (honest). Bend city **$756,000 Bend median**. Screenshots `/opt/cursor/artifacts/tetherow_sell_{1280,390}.png`, `tetherow_membership_{1280,390}.png`, `bend_sell_1280.png`, `home_sell_1280.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** page-grade process KILLED `9afe74a6a` (do not run `/page-grade`). NWX v8e logo-in-frame killed `a67f17d6f`. Tetherow one-annual HOA `7e8c0fc99`. MOS withhold. Counted-set list. G33 `/admin/loop`. G32 seeded. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not resume page-grade. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor) — page-grade process KILLED

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~13:40 PT. Docs/skills only. Not a fleet node. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Matt STOP: page-grade is fucked. Kill the process (grade → flatten to pass Quiet → regrade). Not a live-site restyle.
- Both skill copies are refuse stubs (`KILLED 2026-08-16`, `Do not grade`). `ci:process-canon` asserts that.
- `PAGE-GRADE.md` is evidence, not instructions. `grade-ledger.json` `status: killed`. Look-walk stays a G9 URL set, not a regrade.
- R-215 LOCKED. R-051 amended. Max pin R-215. CLAUDE §9, PRODUCT.md, SESSION_BOOT, public-product-os, both skill registries marked dead.
- Public look is Matt keep/kill on real pages. Do not invent a replacement rubric.

**Next**
- Wait for Matt to name the source look. Do not resume the rejected unification after family. Do not run `/page-grade`.

**Do not:** product UI from this kill. Do not grade. Do not SMS, publish, spend, OAuth. Do not invent a listing. Do not wire the live NWX community header. Disarm = Matt says "disarm the loop".

**Skills read:** page-grade (refuse stub), public-product-os, git-commit, CLAUDE §9, PRODUCT.md, decisions.md.

# Prior — 2026-08-16 (cursor) — NWX v8e logo-in-frame killed

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~13:26 PT. Studio only. Not a fleet node.

**Done**
- Matt kill on sight: logo on the balloon does not work. Style went off the locked stand. v8e whole batch dead.
- Hang restored: `nwx-v8d-stand.mp4` + still `v8-walk`. Type in post. Balloon stays empty cloth.
- Lesson 22 rewritten as the failure, not the method.

**Next**
- Stay on the locked stand. Do not put the wordmark in a generated frame again. Do not wire the live community header.

**Do not:** live page, publish, SMS, spend, OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** creative-brain SKILL + LESSONS.

# Prior — 2026-08-16 (cursor-loop-chain) — one published annual HOA on place pages

**Surface:** Cursor cloud `bc-494f1515` (`cursor/loop-chain-2026-08-16t19-46-e7c1`) shipped the class. Cursor Grok claimed the node, dropped a duplicate grain-naming commit, and wrote the graph evidence. This session rebased the accept/handoff stamp onto that complete. **Time:** 2026-08-16 ~20:20 UTC. Brief served fleet finding `b25bf5f4` (public-ux / fleet `eab91ac8dfa9b833ade88640c6cce7d4`), not G16/G32. One node only. Product **`7e8c0fc99`**. **`main` @** `26307c1b9`. Vercel Production **READY** (inspector `4PWdPQmmXFseriLDjReZcXJWspJd`). `npm run deploy:verify` exit 0 in 382s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#47**. No public-ux ledger insert (open window `2a5054ac`).

**Done**
- Fleet finding [p0]: `/communities/tetherow` printed Master HOA $1,464/yr in glance and FAQ "start around $2,244" (Heath sub-neighborhood estimate). Reproduced on production before the class (glance 1,464; FAQ + FAQPage JSON-LD 2,244).
- Class: SoR helper `publishPlaceHoa` prefers the master assessment, else the floor of registry estimates. Glance, FAQ, and Dataset share that annual. Phase totals stay on phase / LP pages. Wired on community page, KbResortOverview, CommunityRichContent, V3 place-knowledge / opening, `buildMarketFaq`. Gate `ci:publish-place-hoa`.
- After READY: production 1280 + 390 — glance Master HOA $1,464/yr; FAQ and JSON-LD start around $1,464; no $2,244. Playwright accept `scripts/probe-tetherow-hoa-prod.mjs` exit 0. Screenshots `/opt/cursor/artifacts/tetherow_hoa_{1280,390}_{overview,faq}.png`.
- R-024 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Tetherow MOS withhold `a15404f23` / handoff `056ba6cd0` (node `57a2abd4` **done**). Tetherow counted-set list `dada087f8` / handoff `fd628a6de` (node `bff867b9` **done**). NWX v8 walk lessons `be938f107`. G33 `/admin/loop` `1f01f54f` (node `1a6eb37a` **done**). La Pine hyphen-cache `6eded9fd`. SFR city-table remainder `4ca02de19`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-024, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — withhold pulse MOS when the page count is a different set

**Surface:** Cursor cloud `bc-5ffa2bf0` (`cursor/loop-sentinel-2026-08-16t19-00-d437`). **Time:** 2026-08-16 ~19:50 UTC. Brief served fleet finding `57a2abd4` (public-ux / fleet `5d55abbd72a67d25a5d7232b46fd2fb0`), not G16/G32. One node only. Product **`0028904a8`**. **`main` @** `fd628a6de` + this handoff. Vercel Production **READY** (inspector `6ySP1fBHNPYCa7nm6w4WUtYS1dJ7`). `npm run deploy:verify` exit 0 in 763s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#46**.

**Done**
- Fleet finding [p0]: `/communities/tetherow` printed 4.6 months of supply next to 35 actives (implies ~45.7 six-month closes) against FAQ 36 sold in 12 months. Pulse row was honest for 19 actives / 4.56 MOS. Reproduced on production + `market_pulse_live` / `market_stats_cache` before the class.
- Class: SoR helper `publishMonthsOfSupply` withholds when the pulse numerator differs from the count on screen, or when implied six-month closes exceed the printed 12-month sold count. Public pages withhold (no invented 12-month MOS under the same label). CRM/CMA may fall back after null. Wired on community, city, neighborhood, homepage, housing-market, FAQ, CRM, CMA, report export. Gate `ci:publish-months-of-supply`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: production 1280 + 390 — Tetherow HUD is 35 homes / $1,499,000 / 19 days, no 4.6 MOS. FAQ keeps 36 sold / 12 months and drops the buyer/seller MOS question. JSON-LD has no Months of Supply. Awbrey Glen HUD is 8 homes, no MOS. Bend city still prints honest 3.5 MOS (pulse numerator matches). Screenshots `/opt/cursor/artifacts/tetherow_{1280,390,faq_1280,faq_390}.png`, `awbrey_glen_1280.png`, `bend_city_1280.png`.
- R-002 coverage note only (still LOCKED). Do not mark G27 done.

**Also on origin/main (other sessions, do not steal / do not undo):** Tetherow counted-set list `dada087f8` / handoff `fd628a6de` (node `bff867b9` **done**). NWX v8 walk lessons `be938f107`. G33 `/admin/loop` `1f01f54f` (node `1a6eb37a` **done**). La Pine hyphen-cache `6eded9fd`. SFR city-table remainder `4ca02de19`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-002, git-commit.

# Prior — 2026-08-16 (cursor) — Tetherow counted-set list shipped

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~12:40 PT. One node only: fleet `a1851580` / graph `bff867b9` (public-ux). Product **`dada087f`**. Vercel Production **READY** (`dpl_3Rf1T6djVVd332EgHTQzW6MxGsZY`, `npm run deploy:verify` exit 0 in 830s). No hosted migration. Loop stays **ARMED**. Node **done**. No public-ux ledger insert (open window `2a5054ac`). Did not fire an extra sentinel.

**Done**
- Fleet finding [p0]: Tetherow hero said 35 homes; a `/bend/tetherow/`-only URL grep saw 19. Reproduced: inventory doors were 25 (19 Tetherow + 3 Braeburn + 3 Lodges at Bachelor V) because `splitRowsFromTiles` silently capped at 24 and dropped no-geo tiles; featured/hero doors missed `#homes`.
- Class: place pages list the counted set (no default cap; keep no-geo rows). City pages keep `CITY_PLACE_LIST_CAP = 24` with a showing label. Hero + featured CTAs jump to `#homes`. Alias homes keep MLS subdivision URLs — do not rewrite them to `/tetherow/` to game the bot.
- After READY: production `https://ryan-realty.com/communities/tetherow` 200 PRERENDER. Hero **35 homes for sale in Tetherow**. `#homes` list **35** unique inventory hrefs (28 `/bend/tetherow/` + alias slugs). Map **LIVE · MLS 35**. Hero CTA `#homes`. Featured **See all 35 Tetherow homes for sale** → `#homes`. Playwright 1280 + 390 `listRows=35`. Shots `out/tetherow-count-prod/`.
- Pre-existing console noise only: `/api/visitors/track` 400; React 418 hydration on the KB hero. Not this class.

**Also on origin/main (other sessions, do not steal / do not undo):** Tetherow MoS withhold `a15404f2`. Housing-market pulse JSON-LD fallback `0028904a`. G33 `/admin/loop` `1f01f54f`. La Pine hyphen-cache `6eded9fd`. SFR pulse remainder `4ca02de19`. Place-hero grain `706327241`. Awbrey inventory `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**. Local-only lessons commit `be938f10` (NWX v8 walk) rides this handoff push.

**Do not:** insert another public-ux or factory ledger row. Do not change listing URL contract to force `/tetherow/` on alias homes. Do not claim G32 done. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not wire the live NWX community header. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, database-canonical-reference, git-commit.

# Prior — 2026-08-16 (cursor) — G33 /admin/loop in plain English shipped

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~11:55 PT. One node only: G33 `1a6eb37a` (factory). Matt ADD routed through the register (R-214) + manifest + seeded graph node — not a side feature. Product **`1f01f54f`**. **`main` @** `1f01f54f`. Vercel Production **READY** (`dpl_G9w7nisxxBiAkXh7gchLsBzMrG1y`, `npm run deploy:verify` exit 0 in 385s). No hosted migration. Loop stays **ARMED**. Node **done**. Did not claim a fleet node. No factory ledger insert (open window `ba3435dd`). Did not fire an extra sentinel.

**Done**
- `/admin/loop` is Now / Next / Waiting / Finished in plain English. Shop jargon (Fleet finding, p0, sentinel, ledger) folds away. Copy helpers in `lib/data/loop/status-copy.ts`.
- Accept on production: signed-in 390 + 1280 at `https://ryan-realty.com/admin/loop`. Verdict + folds + human titles. No console errors. Shots `out/loop-status-prod/`.
- R-214 VERIFIED. VERSION-1 G33 **DONE 2026-08-16**. Graph node `1a6eb37a` **done**.

**Also on this SHA (other session, do not steal / do not undo):** La Pine hyphen-cache `6eded9fd` / READY `FJgUZGejwabU1xuWChDSn6A8pBpb`. SFR pulse city-remainder `4ca02de19`. NWX studio hang `a8f515147`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** claim a fleet p0. Do not insert another public-ux or factory ledger row. Do not claim G32 done. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, COMPANY_IMPROVEMENT ADD verb, admin-product-os (named-page, not a full OS grind), git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — hyphen city URLs resolve to space-form cache

**Surface:** Cursor cloud `bc-875be615` (`cursor/loop-chain-2026-08-16t18-00-f801`). **Time:** 2026-08-16 ~18:40 UTC. Brief served fleet finding `7d7c74c6` (public-ux / fleet `75370225805bb52d38b151ced2dab5c1`), not G16/G32. One node only. Product **`6eded9fdb`**. **`main` @** `1f01f54f5` + this handoff. Vercel Production **READY** (inspector `FJgUZGejwabU1xuWChDSn6A8pBpb`). `npm run deploy:verify` exit 0 in 734s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#45**.

**Done**
- Fleet finding [p0]: hub city table printed La Pine 175 SFR / $500,000 / 50.5 days to pending, but `/housing-market/la-pine` 404ed (`NEXT_HTTP_ERROR_FALLBACK;404`). Same class: powell-butte, black-butte-ranch, camp-sherman. Reproduced on production + `market_pulse_live` before the class (space-form keys only; hyphen rows absent).
- Class: SoR helper `canonicalCityCacheSlug` / `citySlugCandidates` maps URL hyphens to the space-form cache key (`la pine`). Wired on housing-market `resolveGeo`, MarketSnapshot, city/neighborhood/community/ZIP pages, search + OG, mega menu, CRM report, golf/events/venues/trails, agent market tool, pulse populate. Gate `ci:city-cache-slug`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: pulse `v3-2026-05-07` updated 2026-08-16T18:30:00Z — la pine **175** / $499,950 displayed **$500,000** / 50.5; powell butte 63 / $1,350,000; black butte ranch 31 / $1,073,000; camp sherman 4 / $945,000. Production 1280 + 390 — all four `/housing-market/{hyphen}` reports 200, no 404 fallback, live figures. `/homes-for-sale/la-pine` SFR widget 175 / $500,000 / 51 days. Screenshots `/opt/cursor/artifacts/la_pine_report_{1280,390}.png`, class siblings, `la_pine_homes_sfr_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Pulse still includes Coming Soon (G27). Do not mark G27 done.

**Also on this SHA (other session, do not steal / do not undo):** G33 `/admin/loop` plain English `1f01f54f` is **done** (node `1a6eb37a`). SFR city-table remainder `4ca02de19`. xAI studio NWX hang `a8f515147`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux or factory ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29).

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-020/R-024, git-commit.

# Prior — 2026-08-16 (cursor) — NWX social tile motion (studio only)

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~11:26 PT. Studio only. Not a fleet node. Did not claim G32/G16.

**Done**
- Discovery lifestyle batch refused (off the rails; not Bend). Stayed on the hung NWX social tile `keep/02-social-v2.jpg` / `v2-s1-sculpture`.
- Two 8s i2v takes from that still. Hang: `out/xai-ryanrealty-studio/show/northwest-crossing-v2/nwx-social-a-car-bike.mp4` (car through the existing circle, balloon, then cyclist). B is the dog-walker alternate.
- Viewing room: `out/xai-ryanrealty-studio/show/northwest-crossing-v2/index.html`. Lessons 25–26.

**Next**
- Matt keep/kill on motion A (and B if he wants the dog). Do not remake Discovery. Do not wire the live community header.

**Do not:** live page, publish, SMS, spend, OAuth. Do not invent a listing. Disarm = Matt says "disarm the loop".

**Skills read:** creative-brain SKILL, LESSONS, attention-editing, ai-filmmakers.

# Prior — 2026-08-16 (cursor-loop-chain) — SFR pulse vs city-table remainder named

**Surface:** Cursor cloud `bc-cf38c0a5` (`cursor/loop-chain-2026-08-16t17-19-57b8`). **Time:** 2026-08-16 ~17:55 UTC. Brief served fleet finding `f214eae4` (public-ux / fleet `5439b87e`), not G16/G32. One node only. Product **`4ca02de19`**. **`main` @** `4ca02de19` (handoff lands after `a8f515147`). Vercel Production **READY** (inspector `DQgDZhkkCyhxvMuQem1pMU6Q1idH`). `npm run deploy:verify` exit 0 in 580s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#44**.

**Done**
- Fleet finding [p0]: `/housing-market` printed the region SFR pulse next to seven city rows that omitted Madras, Powell Butte, Black Butte Ranch, Culver, Metolius, and Camp Sherman. The footnote only named Tumalo. Reproduced on production + `market_pulse_live` before the class (region 1840, hub sum 1025, omitted 166, TIGER remainder 649).
- Class: SoR helper `namePulseCityRemainder` names omitted pulse cities with inventory and the TIGER/MLS remainder. DAL `getMarketPulseAllCitySnapshots`. Wired on hub, `/housing-market/central-oregon`, and `/housing-market/annual-review`. Gate `ci:pulse-city-remainder`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: pulse region **1839** (`v3-2026-05-07`); displayedSum 1024; allCitySum 1190; remainder **649**. Production 1280 + 390 — omitted cities named with counts and `/housing-market/{slug}` doors; Tumalo still named; remainder "649 more in the region pulse sit outside a city-boundary row". Screenshots `/opt/cursor/artifacts/{housing_market,central_oregon,annual_review}_footnote_{1280,390}.png`.
- R-024 coverage note only (still LOCKED). Pulse still includes Coming Soon (G27). Do not mark G27 done.

**Also on this SHA (other session, do not steal / do not undo):** xAI studio NWX hang `a8f515147`. Place-hero grain `706327241`. Awbrey inventory-count `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Do not wire the live NWX community header. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, REQUIREMENTS R-020/R-024, git-commit.

# Prior — 2026-08-16 (cursor) — xAI studio: NWX header + social stills

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~10:55 PT. Isolated studio in gitignored `out/xai-ryanrealty-studio/`. No product files. No live KbHero swap. No loop node. Did not claim G32 or G16. Docs **`a8f515147`**.

**Done**
- Look lock stays first-cycle Mirror Pond `keep/01-boardwalk.jpg`. Bake-off is research. CARD_TEMPLATE relocked + awareness ladder written (owned → Unsplash/Pexels/Shutterstock → parent keep → refuse).
- Remembered NorthWest Crossing. Owned Area Guide 01 (sculpture circle) and 03 (Discovery pond). 02 is Sisters — refuse. 04 verified as the same Discovery pond, not a canal.
- Made five 16:9 headers and five 9:16 socials. All ten passed the sat gate. Hang: `cards/places/northwest-crossing/keep/01-header.jpg` (h4 walker+dog) and `keep/02-social.jpg` (s2 sculpture vertical).
- Show: `out/xai-ryanrealty-studio/show/northwest-crossing/index.html`. Matt looks. Nothing published.

**Also on this SHA (other session, do not steal / do not undo):** place-page hero count grain `706327241`. Awbrey inventory-count class `9cac09b1`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Next**
- Matt keep/kill on the NWX hang pair. Do not wire the live community header.
- Later Mirror Pond pass may add clouds / walker / one fish rise. Do not remake that library first.
- IMAGE_1 on every Make is still the boardwalk keep.

**Do not:** claim G32 done. Do not SMS, publish, spend, or OAuth. Do not invent a listing. Do not send a fish rise on Discovery Pond.

**Skills read:** creative-brain SKILL + PLAYBOOK + LESSONS + emotion-mechanics + neuroaesthetics + piece-brief, platform-best-practices (logo closer, not opener).

# Prior — 2026-08-16 (cursor-loop-sentinel) — place-page hero count grain shipped

**Surface:** Cursor cloud `bc-dc2e5e24` (`cursor/loop-sentinel-2026-08-16t16-50-c8df`). **Time:** 2026-08-16 ~17:20 UTC. Brief served fleet finding `97c68da5` (public-ux), not G16/G32. One node only. Product **`706327241`**. **`main` @** `706327241`. Vercel Production **READY** (inspector `6vKiLggcCckH5uH4LnDdp6mrXL9p`). `npm run deploy:verify` exit 0 in 780s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#43**.

**Done**
- Fleet finding [p0]: Awbrey Butte hero copy read "63 homes for sale in Bend" on the neighborhood page. Reproduced on production before the class change (`lead":"in Bend. List prices…"`).
- Class: KbHero prefixes `{N} homes for sale` + `lead`. Sub-city pages that continued with `in {city}` attributed a finer-grain count to the city. SoR helper `placeHeroLead` names this page's grain. Wired on city / neighborhood / community / subdivision / ZIP. Gate `ci:place-hero-grain`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: Playwright 1280 + 390 on `https://ryan-realty.com/cities/bend/awbrey-butte` — hero-sub **63 homes for sale in Awbrey Butte** (not Bend). Class also Southern Crossing **3 homes for sale in Southern Crossing**; Tetherow **35 homes for sale in Tetherow**. City `/cities/bend` stays `in Bend`. Screenshots `/opt/cursor/artifacts/awbrey_viewport_{1280,390}.png`.
- R-109 coverage note only (still PARTIAL / G21). G21 residual punch recorded. Do not mark G21 done.

**Also on this SHA (other session, do not steal / do not undo):** Awbrey inventory-count class `9cac09b1` / handoff `3d248f330`. G32 seeded `f6dc09e7`. G6 toggle. G6 accept stays **blocked**.

**Do not:** insert another public-ux ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints. This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-109, git-commit.

# Prior — 2026-08-16 (cursor-loop-chain) — one public inventory count for Bend districts

**Surface:** Cursor cloud `bc-406a42b5` (`cursor-loop-chain-2026-08-16t16-01-5039`). **Time:** 2026-08-16 ~16:50 UTC. Brief served fleet finding `945d3e5e` (public-ux), not G16. One node only. Product **`9cac09b1`**. **`main` @** `9cac09b1`. Vercel Production **READY** (`AxpVMY6cXodZpfNkjSQ5M7NsJ2tY`, aliases `ryan-realty.com` + `ryanrealty.vercel.app`). `npm run deploy:verify` exit 0 in 606s (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). No hosted migration. Loop stays **ARMED**. Node **done**. PR **#42**.

**Done**
- Fleet finding [major]: Awbrey Butte index tile printed 52, place hero 63, FAQ 62. Reproduced on production + DB before the class change (A `listing_tile_mv.boundary_neighborhood` SFR+PUBLIC=52; B pulse `active_count`=62 includes CS; C pin Active A/B/C=63; D xref SFR+PUBLIC_ACTIVE=63).
- Class: one DAL `lib/data/geo/neighborhood-public-inventory.ts`. Geography `listing_boundary_xref_mv` (`public.boundaries`). Property SFR. Status PUBLIC_ACTIVE (Active + AUC). Same cache on `/neighborhoods`, `/cities/bend` tiles, place hero/FAQ/metadata/Field. Timed-out ledger is `null`, not `0`. No public-ux ledger insert (open window `2a5054ac`).
- After READY: probe D=63 (61 Active + 2 AUC). Production 1280 + 390 — `/neighborhoods` tile 63 Active, `/cities/bend` town-row 63 Active, place FAQ "There are 63 active single-family listings", mobile hero "63 homes". Screenshots `/opt/cursor/artifacts/awbrey_{neighborhoods,city_tile,place_faq,place_hero}_{1280,390}.png`.
- Residual (not this node): browse `/homes-for-sale/bend/awbrey-butte` still uses `boundary_neighborhood` tags. Pulse still includes CS (G27). Do not flip G27.

**Also on this SHA (other session, do not steal / do not undo):** G32 seeded `f6dc09e7` (xAI-only gen stack + cancel list). G6 admin SMS-agent toggle. G6 accept stays **blocked** (live marketing-line APPROVE).

**Do not:** insert another public-ux ledger row. Do not cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints (likely G32 Matt ADD, else G16). This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, frontend-design, design_system/ryan-realty, PUBLIC_PRODUCT/decisions, DATABASE_FOR_AI_AGENTS §0/§3, COMPANY_IMPROVEMENT blast-radius, REQUIREMENTS R-020/R-025, git-commit.

# Prior — 2026-08-16 (cursor) — G32 seeded: xAI-only gen stack + cancel list

**Surface:** Cursor Grok. **Time:** 2026-08-16 ~09:15 PT. Matt ADD (R-205): one generative product — xAI. Product **`f6dc09e7`**. Loop stays **ARMED**. This session seeded G32; it did not claim G16 and did not fire a second sentinel (bc-406a42b5 already launched).

**Done**
- R-213 + G32 + M7 on the version/register. Max pins **G32 · M7** and **R-213**.
- M3 CHANGE: park-in-practice lifted for xAI only. Rebuild is Imagine + Voice, not ElevenLabs Turbo. R-045 stays LOCKED.
- Expert brief `docs/plans/ENTERPRISE_MAP/xai-stack.md` (required read for social-presence). Official docs https://docs.x.ai/overview.
- Cancel list SoR `docs/plans/ENTERPRISE_MAP/xai-stack-accept.json`. **Cancel now:** fal.ai, Synthesia. **Cancel after cutover:** ElevenLabs, Replicate, OpenAI, Anthropic. **Keep:** xAI, Remotion, licensed stock, product rails.
- Queue: `Matt ADD` titles priority 1 (with fleet majors), so G32 outranks planned G16 when the next brief runs.
- Node title: `Matt ADD [major]: xAI-only image, video, voice, and content gen`. Domain social-presence. Accept is the cancel list + chokepoint.

**Do not:** cancel ElevenLabs/Replicate/OpenAI/Anthropic until G32 flips those paths. Do not invent a listing. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Disarm = Matt says "disarm the loop".

**Skills read:** growth-loop, COMPANY_IMPROVEMENT ADD verb, xAI overview/models/Imagine/TTS.

# Prior — 2026-08-16 (cursor-grok-town-doors) — town doors at rest + daily launch cap removed

**Surface:** Cursor Grok (`cursor-grok-town-doors-20260816`). **Time:** 2026-08-16 ~08:57 PT. Brief served fleet finding `071bd6f0` (public-ux), not G16. One node only. Product **`b33fe504`**. Baseline **`eddccdbd`**. **`main` @** `9ac608ab`. Vercel Production **READY** (`dpl_49opLtX7FCPXPmAMaB5hQVaL1zGq`, aliases `ryan-realty.com` + `ryanrealty.vercel.app`). Product already live; this commit is the handoff. No hosted migration. Loop stays **ARMED**. Daily launch cap **removed** (Matt 2026-08-16). Node **done**.

**Done**
- Fleet finding [major]: six town doors had CSS background photos at `opacity:0` at rest (`KbExploreTowns` + `.town-fill` in `components/site/kb/kb.css`). Reproduced on production before the class change at 1280 + 390.
- Class: `.town-fill` is `opacity:1` at rest. Rows with a fill use cream type on a navy scrim. Hover still `translateX`s the name. Contract D103b. No public-ux ledger insert (open window `2a5054ac`).
- After READY: Playwright 1280 + 390 — all six names (Bend, La Pine, Redmond, Sunriver, Sisters, Terrebonne), each `/cities/{slug}` href, all six fills opacity 1. Screenshots `/tmp/rr-town-doors/prod-after-1280.png` + `prod-after-390.png`.
- Sentinel daily launch cap removed: no `DAILY_LAUNCH_CAP`; `/admin/loop` figure is `N in 24h · no daily cap`. Kill switch, activity standdown, boot guard, busy check stay. R-206 covers the removal.
- R-095 stays **PARTIAL** (photos visible at rest; still curated scenics, not live MLS — G21).

**Also on this SHA (other session, do not steal / do not undo):** G6 admin SMS-agent toggle `0e7d6eed`. G6 accept stays **blocked** (live marketing-line APPROVE). Toggle does not satisfy G6 accept.

**Do not:** claim the minor two-CTA fleet finding. Do not insert another public-ux ledger row. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G6 or G27 done. Do not unpause TC. G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints (likely G16). This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, REQUIREMENTS R-095 / R-206, kb.css town-door class, git-commit.

# Prior — 2026-08-16 (cursor) — G6 admin SMS-agent toggle shipped

**Surface:** Cursor local. **Time:** 2026-08-16 ~08:37 PT. Matt-directed ADD on G6 (not a loop-brief node). Product **`0e7d6eed`**. Loop stays **ARMED**. G6 accept stays **blocked**.

**Done**
- Superuser per-broker SMS-agent Switch on `/admin/crm/settings/brokers` (SMS agent section). Writes `brokers.sms_agent_enabled` via existing DAL `setAgentEnabled`.
- Site-wide `BROKER_SMS_AGENT_ENABLED` shown read-only on the verdict. Inbound route uses `isBrokerSmsAgentEnvEnabled()`.
- `getCrmBrokers` now projects `smsAgentEnabled` (fail-closed). Cache key `crm-brokers-v3`.
- Action `setCrmBrokerSmsAgentAction` is owner-only; unknown slugs never hit the DAL. Tests: mapper, action auth, env helper.
- Local render: 3 switches, Matt On / Paul Off / Rebecca Off, env on. Screenshots `/tmp/rr-sms-agent-toggle/brokers-1280.png` + `brokers-390.png`.
- G6 node `c8bbccaa` stays blocked. VERSION-1 G6 residual named. No SMS sent. Paul/Rebecca flags not flipped.

**Do not:** mark G6 done. Do not SMS, publish, spend, or OAuth. Do not flip R-045. Do not mark G27 done. Do not unpause TC. Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29).

**Skills read:** admin-product-os, tdd, verification-before-completion, requesting-code-review, git-commit, BROKER_SMS_AGENT R1.4.

# Prior — 2026-08-16 (cursor-grok-g15) — G15 search completeness shipped

**Surface:** Cursor Grok (`cursor-grok-g15-20260816`). **Time:** 2026-08-16 ~08:20 PT. Brief served **G15** (public-ux). One node only. Product **`e6523399`**. **`main` @** `0524b4ee`. Vercel Production **READY** (`dpl_GZNBEt5SVpbXwFMRL9rXTKzgd43Y`, aliases `ryan-realty.com` + `ryanrealty.vercel.app`). `npm run deploy:verify` exit 0 in 644.9s. No hosted migration. Loop stays **ARMED**.

**Done**
- G15 Search completeness to plan acceptance (`c2c9adde-22f0-4359-971e-409d04a2ec32`) **done**. Accept: every FILTER_COMPLETENESS item dispositioned; prod TTFB p75 recorded.
- Class: SoR `docs/plans/ENTERPRISE_MAP/search-completeness-accept.json`. DAL `readSearchCompletenessAccept` / `searchCompletenessComplete`. Packet §0 + §1b + §2 + scoreboard `searchCompleteness`. `/admin/loop` QuietRow. Gate `ci:search-completeness-accept`. No public-ux ledger insert (open window `2a5054ac`). No schema migration.
- 268 long-tail concepts (222 custom + 46 standard) dispositioned, unexplained = 0. Every `registry-report.json` long-tail concept is in the ledger.
- Prod TTFB p75 (8 curl samples, 2026-08-16): `/homes-for-sale` **275ms**, `/homes-for-sale/bend` **254ms** (target 600ms).
- Post-deploy check (2026-08-16 ~08:19 PT, after READY): `https://ryan-realty.com/homes-for-sale` HTTP 200 (488/315/365ms); `/homes-for-sale/bend` HTTP 200 (233/248/379ms). All under 600ms.
- Register: R-097, R-098, R-099, R-100, R-102, R-103, R-106 **VERIFIED**. R-101 **PARTIAL** (VOW live; sold browse still legacy RPC). R-104 **PARTIAL** (TTFB measured; client filter-paint / pan-pin RUM residual). R-105 already VERIFIED. Max pin **R-212** unchanged.
- Accept proof: `npx tsx scripts/loop-probe-g15.ts` — `complete=true` longTailDisposed=268 unexplained=0 ttfb 275/254 samples=8. Gate 10/10. Tests 11564. `npm run build` exit 0. `ci:gates` 215/215 on push of `0524b4ee`.
- VERSION-1 G15 **DONE 2026-08-16**.

**Do not:** insert another public-ux ledger row. Do not lift VOW sold data onto a public index. Do not flip R-045. Do not flip INT-007 to KEEP before 2026-08-22. Do not SMS, publish, spend, or OAuth. Do not mark G27 done. Do not unpause TC. G6 stays blocked (live SMS). G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3 (G29). Next open node after this handoff is whatever `loop-brief` prints (likely G16). This session does not claim a second node.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, MECHANICAL_GATES, FILTER_COMPLETENESS plan §3/§4.8/§15, REQUIREMENTS R-097…R-106, VERSION-1 G15, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, git-commit.

# Prior — 2026-08-16 (Cursor) — Matt steered M1–M6; G31 seeded; G27 residual confirmed

**Surface:** Cursor local. **Time:** 2026-08-16 ~07:50 PT. Steering delivery (R-205). No product class that session. G15 was in_progress then; it is now **done**.

**Done (durable state only)**
- M1 CHANGE: newsletter first-cohort blast is not the v1 gate. Loop work is **G31** redesign (look only). After Matt approves the look, he enrolls and sends manually. R-212 MISSING→G31. R-159 PARTIAL.
- M2 HOLD: TC cutover held until TMS thoroughly tested. Do not unpause TC_BUILDOUT.
- M3 SILENCE: park-in-practice. R-045 LOCKED. Docket `decision.status` stays pending (ci:video-docket). No rebuild until Matt says rebuild.
- M4 PARKED: no ad spend for v1. Audience heartbeat continues.
- M5 DONE 2026-08-16: ryan-realty.com live (A 76.76.21.21, `server: Vercel`). DNS cutover removed as an open gate (row kept, marked DONE).
- M6 REVIEWED: KEEP socials connected (TikTok/YT/X/GBP + refresh). LinkedIn expired 2026-07-09 no refresh. Threads/Pinterest/Nextdoor auth empty. No reconnect ask.
- G27 **not done**. 2026-08-02 session sealed public CS access. Pulse `active_count` still includes CS. Bend pulse 486; City=Bend SFR CS = 5. Node `2891d28e` stays open.
- Manifest Max pin **G31 · M6**. Register Max **R-212**.

**Do not:** flip R-045. Do not SMS, publish, spend, or OAuth. Do not mark G27 done. Do not unpause TC. Disarm = Matt says "disarm the loop". Bots still need Matt to create them (G29).

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, COMPANY_IMPROVEMENT §How Matt steers, VERSION-1, REQUIREMENTS, VERIFICATION-FLEET, BROKER_SMS_AGENT DoD, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-26bd9513) — G12 video docket shipped

**Surface:** Cursor cloud agent `bc-26bd9513-82b6-4e3e-b22e-9aba3838e83e`. **Time:** 2026-08-16 ~11:55 UTC. Brief served **G12** (factory). One node only. **`main` @** `ca8f7f636` (product `fd71eee24` + DAL deploy touch). PR **#40**. Vercel Production **READY** (GitHub deployment `5930667908`, inspector `BERhGqFnQqdf2TsFJgZ1eervPref`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`). `ci:gates` **213/213** including `ci:video-docket`.

**Done**
- G12 Video decision docket (`53355a5b-fafc-4136-8cbd-dc98aa73ed05`) **done**. Accept: docket exists with both options costed. Decision stays **pending** (M3) until Matt answers.
- Class: SoR `docs/plans/ENTERPRISE_MAP/video-decision-docket.json`. DAL `readVideoDecisionDocket` / `videoDocketComplete`. Packet §0 + §5 + scoreboard `video`. `/admin/loop` QuietRow. Gate `ci:video-docket`. No factory ledger insert (open window `ba3435dd`).
- Park: incremental vendor **$0**. Keep R-045. Inbox video types stay `comms:matt_alert`. 11 dead safe-zone imports stay. CAP-017 stays maturity 2 until M3.
- Rebuild: ElevenLabs Turbo **$0.05/1k** (https://elevenlabs.io/pricing/api fetched 2026-08-16) + producer cap **$5/row $15/run**. Re-register 24 producers, restore 13 capability skills, repoint 11 dead imports. Requires Matt to CHANGE/SUPERSEDE R-045.
- Accept proof: `npx tsx scripts/loop-probe-g12.ts` — `complete=true` parkUsd=0 rebuildTurboPer1k=0.05 rebuildCapPerRow=5 deadSafeZoneImports=11 decommissionedProducers=24 remotionConfigs=16 mp4OnDisk=84 decision=pending.
- VERSION-1 G12 **DONE 2026-08-16**. M3 still open. R-045 stays LOCKED. No schema migration.
- Ship: `ci:gates` 213/213; `origin/main` includes `ca8f7f636`; production deploy success. PR #40.

**Do not:** flip R-045. Do not re-register video producers. Do not SMS, publish, spend, or OAuth. Do not flip INT-007 to KEEP before 2026-08-22. G6 stays blocked (live SMS). G11 stays blocked (calendar accept). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, MECHANICAL_GATES, AGENTIC_GRAPH_ENGINEERING, REQUIREMENTS R-042/R-043/R-044/R-045, VERSION-1 G12/M3, CAP-017, COMPANY_IMPROVEMENT blast-radius, DATABASE_FOR_AI_AGENTS lookup, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-fe75bb57) — G11 audience hold machinery shipped, node blocked

**Surface:** Cursor cloud agent `bc-fe75bb57-b840-4d01-846f-67efa6a79fbc`. **Time:** 2026-08-16 ~11:20 UTC. Brief served **G11** (factory). One node only. Product **`8247ee9b2`**. Handoff lands on **`main` after G10** (`0b1ba14c9` / `ecb22e78f`). Vercel Production **READY** for the G11 product SHA (GitHub deployment `5930137236`, inspector `9oPuFMsP2VEtmz3E8Yet84XbKMoe`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`).

**Blocked**
- G11 Meta audience heartbeat hold (`568d807b-ac07-43cc-9eea-52b8f67460a6`) **blocked**. Accept: seven consecutive `ran_at` days ending on or after **2026-08-22**; map cell updated with evidence.
- Class shipped (do not redo): named hold DAL `readMetaAudienceHold` / `computeAudienceHold` (`META_AUDIENCE_HOLD_END=2026-08-22`, `HOLD_DAYS=7`, `CURRENT_HOURS=36`). Heartbeat `audienceSyncHours: 36` + `evalMetaAudienceHold`. Admin audiences + meta-health. Gate `ci:meta-audience-hold`. Signals `identity.audienceHold`. INT-007 cell updated (still **FIX**). VERSION-1 G11 machinery note only — **not DONE**. No factory ledger insert (domain already has open window `ba3435dd`).
- Accept proof (environment): `npx tsx scripts/loop-probe-g11.ts` — `meta_audience_log` 79 rows; consecutive UTC days **55** (`2026-06-23`…`2026-08-16`); last LIVE **2026-08-16T09:01:26Z** CRM `120246504502300698` `add_num_received=13980`; westside `120244510092910698` last **2026-08-15T14:03:29Z** (daily 14:00 UTC; still current under 36h). `holdMet=false` because `lastDay=2026-08-16` < 2026-08-22. June-23 INT-007 cell was stale — the log never stopped.
- Blocker: calendar accept cannot be met until a consecutive streak ends on or after 2026-08-22. Unblock then when `readMetaAudienceHold.holdMet === true`; flip INT-007 FIX→KEEP; mark VERSION-1 G11 DONE; `completeWorkNode` with probe evidence. Spend stays Matt-gated.
- Planes: dal-stat (hold DAL + signals), admin-crm (`/admin/audiences`, `/admin/analytics/meta-health`), reporting (packet + INTEGRATIONS + scoreboard), ads (36h heartbeat, no spend). Public-site / alerts / identity stitch unchanged.
- Ship: `ci:gates` green via `npm run push`; `origin/main` includes `8247ee9b2` (`c0465bc5a` + email-send-gated re-key `8247ee9b2`); production deploy success. PR #38 merged.

**Do not:** flip INT-007 to KEEP before 2026-08-22. Do not insert another factory ledger row. G10 is **DONE** on main (`ecb22e78f`, production READY GitHub `5930254210` / inspector `8koYeDcaTiGfCwhMrNLjMgKxJXF5`) — do not redo `/join`. G6 stays blocked (live SMS). Do not SMS, publish, spend, or OAuth. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, DATABASE_FOR_AI_AGENTS (lookup + cache model), INTEGRATIONS INT-007, VERSION-1 G11, COMPANY_SCOREBOARD ads row, COMPANY_IMPROVEMENT blast-radius, git-commit, facebook-seller-growth (read-only; no spend).

# Prior — 2026-08-16 (loop-sentinel bc-120b6b86) — G10 /join conversion shipped

**Surface:** Cursor cloud agent `bc-120b6b86-e7c3-4235-8ec9-72f20954bf55`. **Time:** 2026-08-16 ~11:01 UTC. Brief served **G10** (recruit-retain). One node only. **`main` @** `ecb22e78f`. Vercel Production **READY** (GitHub deployment `5930254210`, inspector `8koYeDcaTiGfCwhMrNLjMgKxJXF5`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`).

**Done**
- G10 Instrument `/join` conversion (`086bdf15-0172-4f9f-8704-70ba9094ef0f`) **done**. Accept: packet shows a `/join` conversion figure with a named source.
- Class: visits already lived in `visitor_events` (`page_url` path `/join`); no convert writer and the probe did not read them. DAL `getJoinConversionStats` / `readJoinConversionStats` / `recordJoinConversion` / `tagRecruitJoin`. Contact form `Join the team` writes `join_convert` and tags `recruit:join` (no buyer enroll, no CAPI Lead). `/join` phone + contact CTAs via `JoinCtaTracker`. Today + packet read the same DAL. Gate `ci:join-conversion`.
- Accept proof: `visits7d=13` / `visitsAll=67` / `conversions7d=0` / `conversionsAll=0` / `status=ok`. Source: `visitor_events via getJoinConversionStats (page_url path /join + event_type=join_convert)`. Fleet-test convert insert succeeded (`convertRowsIncludingFleet=2`) and did **not** change packet counts. Series days present (2026-08-03 had 38 visit events). Production `/join` HTTP 200 (browser UA).
- Ledger `5683a341-68d4-4b5f-aed0-6a5f4922ed0b` (recruit-retain, class `join-conversion`). VERSION-1 G10 **DONE 2026-08-16**. R-201 VERIFIED. CAP-022 residual (OAuth) unchanged. No schema migration (series table is existing `visitor_events`).
- Planes: dal-stat (`lib/data/loop/join-conversion.ts` + signals), public-site (contact + `/join` tracker), identity (`recruit:join`), ads (skip CAPI Lead for recruit), admin-crm (`/admin/today` VerdictLine), reporting (packet §1b + recruit-retain). Alerts unchanged.
- Ship: `ci:gates` 212/212; `origin/main` includes `ecb22e78f`; production deploy success. Rebased over G11 machinery (`readMetaAudienceHold`) so both gates stay in `ci:gates:chain`.

**Do not:** SMS, publish, spend, or OAuth. Do not treat a recruit contact as a buyer Lead. Do not redo `/join`. G6 stays blocked (live SMS). G11 accept still open (KEEP waits for a day ≥ 2026-08-22). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, BROKER-OPERATING-SYSTEM-PLAN, MASTER_SPEC, REQUIREMENTS R-201, COMPANY_IMPROVEMENT blast-radius, VERSION-1 G10, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-66d23ef1) — G9 look-walk baselines shipped

**Surface:** Cursor cloud agent `bc-66d23ef1-fc40-4fe7-87ec-b7dc59ce4f39`. **Time:** 2026-08-16 ~10:12 UTC. Brief served **G9** (public-ux). One node only. **`main` @** `8a847a8e7`. Vercel Production **READY** (GitHub deployment `5929885543`, inspector `46WCQ6dmZSQvuBbfdkfeDNwNmyQS`). `npm run deploy:verify` exit 0 (GitHub Vercel status fallback; this VM has no `VERCEL_TOKEN`).

**Done**
- G9 Look-walk baselines (`4aa54907-47ce-4b96-9eaa-d370a6e56df5`) **done**. Accept: Packet §1b CMA look and public-ux walk are no longer UNKNOWN.
- Class: production walk at 390+1280 for the 8 `beat_on` routes + graded CMA HTML. SoR `docs/plans/ENTERPRISE_MAP/look-walk-baseline.json`. DAL `readLookWalkBaseline` / `lookWalkBaselineComplete`. Scoreboard probe `cma.look` + `lookWalk`. Packet §1b cites the baseline. Gate `ci:look-walk`. Boot fix: `readSkySlopeMirrorFreshness` extracted so `loop-brief` can import signals without `server-only`.
- Accept proof: probe `cma.look=ok` verdict WORKING slug `cma-19496-tumalo-reservoir` (17 pages, cover is the house, range $955,000–$1,060,000); `lookWalk.status=ok` publicRoutes 8 / publicOk 8. Production HTTP 200 both viewports. Verdicts: listing + about WORKING; homes-browse + sell PARTIAL; home / Bend / Tetherow / market TRAIL. Residual punches stay on the baseline (grade wave only — no page redesign).
- Ledger `2a5054ac-1608-4343-872a-322e705973c6` (public-ux, class `look-walk-baselines`). VERSION-1 G9 **DONE 2026-08-16**. R-092 coverage note updated. No schema migration.
- Planes: dal-stat (`lib/data/loop/look-walk.ts` + signals), public-site (walked, not redesigned), reporting (packet §1b + probe). Admin-crm / ads / alerts / identity unchanged.
- Ship: `ci:gates` 210/210; `origin/main` includes `8a847a8e7`; production deploy success. Same-session factory hygiene: `check-vercel-deploy.mjs` falls back to documented project ids + GitHub Vercel commit status when `.vercel/project.json` / `VERCEL_TOKEN` are missing (cloud-agent ship path).

**Do not:** redesign public pages in this residual (TRAIL punches are named, not this node's class). Do not SMS, publish, spend, or OAuth. Do not claim G10 (`/join` conversion). G6 stays blocked (live SMS). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, COMPANY_SCOREBOARD §1b, VERSION-1 G9, PAGE-GRADE v2.4 (first-screen rubric), look-walk baseline, git-commit, COMPANY_IMPROVEMENT blast-radius.

# Prior — 2026-08-16 (loop-sentinel bc-0369d0e1) — G8 SkySlope mirror ops shipped

**Surface:** Cursor cloud agent `bc-0369d0e1-5c3f-43e2-9a78-9cddc20f2c4c`. **Time:** 2026-08-16 ~09:45 UTC. Brief served **G8** (transactions). One node only. **`main` @** `8bb2c6327`. Vercel Production **READY** (GitHub deployment `5929663437`, inspector `3LKLi3cQjgcKFvhLEXyU7N4AGPx8`).

**Done**
- G8 SkySlope mirror re-sync ops (`05980864-bfd1-4556-8145-0ddac4fbb0d1`) **done**. Accept: latest `synced_at` current **or** the blocker named on the packet.
- Class: inbound Files refresh cron `/api/cron/skyslope-mirror-refresh` (HMAC login POST + GET folder list/detail only; no PUT/PATCH/DELETE). DAL `getSkySlopeMirrorFreshness` / `refreshSkySlopeMirrorInbound`. Closings VerdictLine. Heartbeat `evalSkySlopeMirror` from `loop-health-check`. Scoreboard uses DAL `rowCount`. Gate `ci:skyslope-mirror` 12/12. Vault `tc_deals` stays SoR.
- Accept proof: production route live — unauth JSON **401**; missing sibling path **404** (same dpl). Probe `scripts/loop-probe-g8.ts`: 33 rows (= `tc_deals`), newest `synced_at` **2026-06-10T00:35:10Z**, age **1617h**, `current=false`. Named blocker: this VM's injected `CRON_SECRET` is a 12-char stub (production 401); no `SKYSLOPE_*` keys here. First refresh = Vercel cron `20 6 * * *` or a session with the real secret.
- Ledger `1b9367f1-908a-4902-890d-c34d981a9a80` (transactions, class `skyslope-mirror-ops`). INT-017 ops KEEP; freshness residual. R-190 LOCKED. R-191 stays PARTIAL (M2 cutover). No schema migration.
- Planes: dal-stat (mirror DAL), admin-crm (`/admin/closings`), reporting/heartbeat (`evalSkySlopeMirror`). Public-site / ads / alerts / identity unchanged (mirror is not a public number).
- Ship: `ci:gates` green via `npm run push`; `origin/main` includes `8bb2c6327`; production deploy success.

**Do not:** mutate SkySlope files (no PUT/PATCH/DELETE). Do not treat SkySlope as transaction SoR. Do not SMS, publish, spend, or OAuth. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, tc-builder, oregon-orea-principal-broker, skyslope-api, TC_SYSTEM, COMPANY_IMPROVEMENT blast-radius, VERSION-1 G8, INT-017, R-190/R-191, DEVELOPMENT_PROCESS, git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-311e4201) — G7 westside backlog shipped

**Surface:** Cursor cloud agent `bc-311e4201-0cc8-4ade-b44d-879873938822`. **Time:** 2026-08-16 ~08:35 UTC. Brief served **G7** (seo-aeo). One node only. **`main` @** `d8a401d68`. Vercel Production **READY** (GitHub deployment `5929208475`, inspector `739vhk2QJQx35X2vnuFzwcy5NCL7`).

**Done**
- G7 Westside backlog (`f10b9c7c-c4ad-4d55-bdbe-3294000a8e62`) **done**. Accept: no backlog row without a disposition; shipped items carry ledger rows.
- Class: #10 luxury money-surface links (`/luxury-homes-bend` on city popular-searches, Bend `/cities` row via `CityFeaturedLinks`, `/communities` hero). #9 review-ask drafts on CRM close + daily TC 14-day scan — stages `crm_message_drafts` only, never sends, never overwrites a broker draft. `upsertDraft` insert-or-update (expression unique index). #2/#5 RE-RANKED → G22. #7/#8 GATED (spend / outbound).
- Accept proof: fleet-test person **61945** review-ask draft `already` (body has `GBP_REVIEW_URL`). Westside audience `120244510092910698` last LIVE 2026-08-15 `add_would_upload` 13588. Live `/cities` + `/communities` 200 with `href="/luxury-homes-bend"`. Newest TC close 2026-05-15 (outside 14-day window — first cron stages 0 real-client drafts). Gate `ci:westside-backlog` 14/14.
- Ledger `c058cfdf-0a1a-4c6e-a35b-a4a90ae092e4` (seo-aeo). CAP-030 maturity 3 (PARTIAL residual: crawl/depth G22, paid/expired Matt-gated). R-125 VERIFIED. R-124 PARTIAL. R-150 PARTIAL. No schema migration.
- Planes: dal-stat (`stageReviewAskDraft`, `stageReviewAsksForRecentCloses`, `upsertDraft`), public-site (luxury links), admin-crm (restage → draft), identity (`crm_people.id`), reporting (CAP-030 / register). Ads unchanged. Alerts/newsletters none (never sends).
- Ship: `ci:gates` green via `npm run push`; `origin/main` includes `d8a401d68`; production deploy success.

**Do not:** SMS anyone. Do not publish, spend, or OAuth. Do not invent an approval stamp. Do not overwrite a broker email draft. Do not mass-enroll or send expired/FSBO. Do not prune sitemaps without GSC indexed-count evidence (R-122). Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, DEVELOPMENT_PROCESS, GOAL_10X_EXECUTABLE, WESTSIDE_BACKLOG, CAP-030, REQUIREMENTS R-124/R-125/R-150, COMPANY_IMPROVEMENT blast-radius, VOICE.md, local-seo (review-ask context), git-commit.

# Prior — 2026-08-16 (loop-sentinel bc-95a666b5) — G6 blocked on live marketing-line SMS

**Surface:** Cursor cloud agent `bc-95a666b5-6588-4122-88d5-60cbe9ba54d8`. **Time:** 2026-08-16 ~07:50 UTC. Brief served **G6** (broker-tools). One node only. **`main` @** `b278e28f5` at claim. No product ship this node.

**Blocked**
- G6 Broker SMS agent DoD (`c8bbccaa-84ef-492c-8ce8-9af437833e31`) **blocked**. Accept: end-to-end broker text → agent reply → approval stamp on the marketing line (+15412245025).
- Hard limit: no outbound messages to real people. Completing the accept would `sendAgentSms` to Matt `+15412136706`. DoD 3 (live IG post) is public posting. DoD 10 (Matt-only pilot ≥1 week) needs calendar time after a live APPROVE.
- Environment (probed, no sends): `sms_agent_enabled` matt=true / paul=false / rebecca=false. Sessions=2 (last 2026-08-03). Turns=5, all 2026-08-02 in-process Redmond Q&A smoke (`SMe2e*`), not a webhook APPROVE. `generated_by=broker_sms_agent` rows=2 (`d4711088`, `7fc5fa8b`), both `killed`, `approved_by` null — thin-payload approval-gate tests (S6 missing `editorial_subhead`/`hero_photo`; city:Bend missing template). Zero SMS-agent approval stamps ever. CAP-035 stays 2. R-180 stays PARTIAL. No ledger row (no class shipped).
- Residual class when unblocked: `create_action` from SMS does not hydrate listing/template/hero fields, so IG rows never reach `ready` and APPROVE cannot stamp. No admin surface lists agent sessions.
- Unblock: Matt texts APPROVE on the marketing line against a ready draft, or authorizes one smoke text to his cell that includes APPROVE (still no live publish).

**Do not:** SMS Matt/Paul/Rebecca. Do not publish. Do not set Paul/Rebecca `sms_agent_enabled`. Do not invent an approval stamp. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, admin-product-os, DEVELOPMENT_PROCESS, BROKER_SMS_AGENT plan DoD, REQUIREMENTS R-180, CAP-035, BROKER-OPERATING-SYSTEM-PLAN, COMPANY_IMPROVEMENT blast-radius.

# Prior — 2026-08-16 (loop-sentinel bc-36c5e37a) — G5 broker day-one + own-book shipped

**Surface:** Cursor cloud agent `bc-36c5e37a-973a-4b3c-8198-8085b9dca744`. **Time:** 2026-08-16 ~07:35 UTC. Brief served **G5** (recruit-retain). One node only. **`main` @** `7de1b6252`. Vercel Production **READY** (GitHub deployment `5928709859`, inspector `8AhizwMJsKnZ8J6RucBM32mhXi1X`).

**Done**
- G5 Broker platform 2→3 (`468febf9-3e86-46d1-96cc-a327061bcae0`) **done**. Accept: a non-Matt broker walks day-one; own-book scoping verified signed-in.
- Class: `scopeBroker` fail-opened unmapped brokers to the company book (`null`). Slug came only from `CRM_BROKER_BY_EMAIL`. Fix: unmapped → `UNMAPPED_OWN_BOOK`; slug from `admin_roles.broker_id` → `brokers.crm_slug`; Today/People/Messages/CMAs/batch-emails use `scopeBroker`; day-one checklist; `content.marketing` unlocked; public social URLs on My settings.
- Accept proof: signed-in `paul@ryan-realty.com` on https://ryan-realty.com/admin/today (Day one: socials still open) and /admin/people (recently-touched all `assigned paul`). DB: slug `paul`, people 71 vs company 23009, sentinel 0. Gate `ci:broker-own-book`.
- CAP-022 maturity 3 (PARTIAL; OAuth residual). R-198 stays PARTIAL. R-175 stays PARTIAL (Today ready-approvals still company-wide). No new recruit-retain ledger row. No schema migration.
- Planes: dal-stat (`resolveCrmSlugForAccess`, `getDayOneChecklist`, scoped `listCmasForAdmin`), admin-crm (Today/People/settings/broker-links), reporting (market-report subscribers), alerts-newsletters (marketing unlock; company letter list), identity (`admin_roles.broker_id`). Ads/public-site unchanged.
- Ship: `ci:gates` 207/207; `origin/main` includes `7de1b6252`; production deploy success.

**Do not:** connect personal social OAuth (Matt-gated). Do not send, post, spend, or write fake socials onto Paul's row. Disarm = Matt says "disarm the loop". Bots still Phase 3.

**Skills read:** growth-loop, admin-product-os, DEVELOPMENT_PROCESS, REQUIREMENTS R-175/R-198, CAP-022, BROKER-OPERATING-SYSTEM-PLAN, COMPANY_IMPROVEMENT blast-radius.

# Prior — 2026-08-16 (loop-sentinel bc-57e943fb) — G4 alerts enrollment shipped

**Surface:** Cursor cloud agent `bc-57e943fb-edb5-4a4a-bc9b-9fc6a7ee1a36`. **Time:** 2026-08-16 ~06:10 UTC. Brief served **G4** (nurture). One node only. **`main` @** `60de1bee0`. Vercel Production **READY** (GitHub deployment `5928216460`, inspector `7rfmRDpzVR8CtAGa2X9vQqVfGffm`).

**Done**
- G4 Alerts coverage (`6ac2ce94-131d-47a6-8788-f8ae5c17a6cb`) **done**. Accept: a real saved search creates an active `listing_alerts` row with `crm_person_id`.
- Class: account / guest / buyer-LP writers treated `sendEvent.personId` (native `crm_people.id`) as `fub_legacy_id`. Account path upserted before the person existed. Fix: `nativeCrmPersonId` + `upsertListingAlert({ crmPersonId })`; account captures the person first then stamps. Send engine never reads `saved_searches`.
- Accept proof: fleet-test person **61945** / alert `047ddf18-239e-4043-b8ee-152f8ffa5a6c` (`g4-accept-fleet-test@example.com`, active, `crm_person_id=61945`, all-channel suppressed). Prior live guest save 2026-08-15 `pjmlikesgolf@yahoo.com` already had `crm_person_id=61854`.
- Packet-eligible (ex-fleet-test): **7 active / 7 with crm_person_id** (seed said 6). Gate `ci:listing-alert-enroll`. R-152 VERIFIED. No new nurture ledger row: G3 window `2371813a` is still open (one-open-per-domain).
- Planes: dal-stat (`listingAlerts.ts`), public-site (SaveSearchButton / account / buyer LP), admin-crm (bulk assign), alerts-newsletters (cron/engine), identity (`crm_person_id`), reporting (packet counts). Ads audiences unchanged (same `crm_people`).
- Ship: `ci:gates` 206/206; `origin/main` includes `60de1bee0`; production deploy success. No schema migration.

**Do not:** mass-enroll the historical book (would send to real people). Do not send, post, spend, or OAuth. Disarm = Matt says "disarm the loop". Bots still Phase 3. R-153 / R-154 / R-164 remain MISSING (engine completeness, Flexmls, subscriptions panel).

**Skills read:** growth-loop, crm-e2e, CRM_REPLACEMENT_BLUEPRINT, REQUIREMENTS R-152..R-164, COMPANY_IMPROVEMENT blast-radius, DEVELOPMENT_PROCESS.

# Prior — 2026-08-16 (Grok) — Loop ARMED; first post-arm agent launched

**Matt 2026-08-16 21:52 PT: "Arm the loop."** That is the R-211 word.

**Live proof (2026-08-16 ~22:28 PT):**
- `origin/main` @ `4966f126` — Vercel production **READY** (`dpl_BKWKk2h85ZEqQp1KP3NnGgD2AKDk`)
- Dry-run: `{"action":"dry-would-launch","openNodes":25}` (kill switch no longer blocks)
- Live launch: `{"action":"launched","agentId":"bc-57e943fb-edb5-4a4a-bc9b-9fc6a7ee1a36","openNodes":25}`
- Follow-up dry-run: skipped — `boot guard (launched within 15 min)`
- `/admin/loop` on ryan-realty.com: sentinel **ARMED**; last launch **just now** `bc-57e943fb…`; 2 of 12 today; verdict still "Armed and dormant" until this agent claims. Shots: `out/loop-status-armed/` (gitignored). Zero console errors.

**Watch:** `/admin/loop` (Phase 2 Step 4). Healthy = this agent claims one node, ships, handoff curls the next. Disarm = "disarm the loop". Bots still Phase 3. No sends / posts / spend / OAuth.

1. **`/admin/loop` status page** — superuser (`settings.system`, same gate as /admin/sync), linked from Oversight's All tools. Verdict line (armed/disarmed + running/dormant), Version-1 progress, running-now, stale claims, queue-next (fleetNodePriority order), blocked, recent done with evidence first-lines, fleet findings inbox, ledger windows with expiry, sentinel launches (n/12 cap) + orphan releases. Auto-refreshes every 60s. Renders ONLY from the rows agents mutate (`lib/data/loop/status.ts` aggregator) — no self-reported status exists. Screenshots (desktop 1400 + mobile 390, real graph data, zero console errors) verified.
2. **One-node-per-session chaining** — sentinel LOOP_PROMPT now: claim the ONE served node, finish or block it, final-act handoff curl, STOP. Fresh context per node; the chain carries continuity.
3. **Orphan auto-release** — sentinel releases in_progress claims whose cloud-agent owner's newest run is TERMINAL (10-min grace so a mid-write completion is never raced; human sessions still age out via 3-day staleness). Pure rules `isCloudAgentSession`/`shouldAutoRelease` in work-node.ts, 6 new tests; releases logged to sync_logs `loop_sentinel:orphan-release` and shown on the page.

**What ALSO happened tonight (report honestly):** the chain proved itself twice before the disarm finished baking. G2's agent (bc-13c50db8, 02:20) completed G2 and its final-act handoff at 02:50:55 launched bc-7b28f874 — UNLOGGED, because the then-deployed sentinel still had the create-response parser bug (fixed in `176bf5e7`, now live): launch succeeded, parse failed, no sync_logs row, endpoint even said "launch failed". That successor completed **G3** (Lead journey entry, commits `6454203c`..`1843c028`) at 03:39 and its own handoff hit the now-live kill switch — chain severed exactly as designed. Both agents' runs terminal; leftover branch deleted; zero claims on the graph; graph 25 open · 3 done (G1 G2 G3).

**Build hygiene:** `tmp` added to tsconfig excludes (scratch files could fail the Next typecheck — class fix; two stray scratch scripts moved to tmp/). Screenshot tool for this page: `scripts/_loop-status-shot.mjs` (magic-link pattern).

**Watch:** `/admin/loop`. Runbook Phase 2 Step 4. Disarm = "disarm the loop". Bots still Phase 3.

# Prior — 2026-08-16 (loop-sentinel bc-7b28f874) — G3 shipped; successor launch refused by kill switch

**Surface:** Cursor cloud agent `bc-7b28f874` (unlogged successor of G2 `bc-13c50db8`). **Time:** 2026-08-16 ~03:39 UTC. **`main` @** `1843c028d` (G3 product) then `92c59bbe` (this handoff + DISARMED scoreboard).

**Done**
- G3 Lead journey entry (`4622fb28-55d5-4382-a3f2-48a88e8d072a`) **done**. Accept: every `crm_people` row has an `origin` and a `crm_journey_events` `lead.created` row from `ensureNativeLead`.
- Proof: persons `61917` / `61920` / `61921` (source `website`) each have `origin=inbound_web` and `lead.created`. Ledger `2371813a-e700-4c99-8583-71d006a3cc7f` accepted.
- Product: `lib/crm/ensure-native-lead.ts` writes `lead.created` after insert (idempotent). `lib/crm/lead-origin.ts` + tests. `scripts/crm-lead-origin-backfill.mjs` + hosted apply (`crm_people` 16,581 origin-null → 0; 16,581 `lead.created` events).
- Successor launch at this agent's final-act `?handoff=1` hit live `LOOP_SENTINEL=off` — chain severed as designed. Graph: G1–G3 done, ~25 open, 0 in_progress.

**Do not:** revert G2/G3. Do not arm the loop. Do not treat silence as approval.

# Prior — 2026-08-15 (Grok) — Verification fleet: Grok Bots wired as the external Auditor (v1.6.0)

**Matt:** Wants self-feeding external verification — grok bots browse like users after each iteration, output returns to the loop. Product confirmed installed (`/Applications/Grok Bot.app`, beta 2026-08-11; own cloud computer + browser per bot, routines, parallel threads; conversational setup, no public API).

**Done (THE LOOP v1.6.0):**
- **Pipeline live end-to-end (bots pending Matt's paste):** `fleet_findings` table (migration `20260815220000`, applied hosted) → POST `/api/fleet/findings` (`x-fleet-secret` = CRON_SECRET interim; validates expected/observed/url, fingerprint-deduped) → `scripts/fleet-intake.ts` (info→baseline; minor/major/p0→OPEN work node tagged `fleet:<fp>`, FIRST step reproduce-or-reject) → normal loop brief serves it.
- **Case packs generate from durable state:** `scripts/fleet-test-cases.ts` → out/fleet/cases: core 7 (money paths incl. MoS verdict-match, LOOK-never-touch rails), regression 1 (from DONE nodes' accepts — grows automatically), preflight 9 (open browsable gaps).
- **5 paste-ready bot briefs** in `ENTERPRISE_MAP/VERIFICATION-FLEET.md`: Walker Mobile/Desktop (daily), Money Path (2×daily, p0 on funnel breaks), Stats Truth (page-internal §0 contradictions), Regression Certifier (on-demand; **clean pass now required for version certification** per canon). Phase-2 Matt-gated: Analytics Reader (OAuth), Form E2E (test-identity lane), R-206 scheduling.
- R-207 (PARTIAL→G29), G29 seeded (graph 29 nodes), Max pins G29/R-207, scoreboard fleet row, canon v1.6.0 + pointers, G44/G56/G57 green, 56 tests.

**Matt's one setup step:** open Grok Bot app → create 5 bots → paste each brief → replace `<FLEET-SECRET>` (a session prints it on request) → run once supervised → save as skill → schedule per the six-point routine checklist.

**Self-starter (same day — Matt GO on R-206, then caught the timer flaw: "1-hour node must not sit 3 hours"):** `/api/cron/loop-sentinel` every **10 min** (deterministic, token-free; vercel.json, G53 green). STATE-BASED: relaunches the moment the last agent's newest run is terminal (GET /v1/agents/{id}/runs — CREATING/RUNNING = stand down; last agent id kept in sync_logs `loop_sentinel:launch`.sync_cycle_id). Guards: kill switch `LOOP_SENTINEL=off`, fresh-activity standdown (<3h in_progress claim), 15-min boot guard, **12 launches/day cost cap**, fail-toward-launch on unreadable status (bounded by boot guard + claim mutex). Launch: POST api.cursor.com/v1/agents (Basic CURSOR_API_KEY — in Vercel prod env) with the canonical grind-until-blocked prompt (hard limits: no sends/posts/spend/OAuth/SkySlope). Dry `?dry=1`. **Zero-gap chain (Matt: "fire as soon as the other is complete"):** the loop prompt's FINAL ACT is `curl loop-sentinel?handoff=1` with RR_CHAIN_SECRET (injected per-agent via envVars — beta, prompt falls back to heartbeat if absent); handoff mode waives busy check + boot guard (caller vouches completion), keeps kill switch/standdown/cap. Human sessions: same curl with CRON_SECRET (growth-loop skill updated). Max dormancy: ~0 on clean finishes, ≤10 min on crashes. Lib: `lib/data/loop/sentinel.ts`. R-206 VERIFIED.

**Co-evolution wire (same day — Matt: findings flow through the steering verbs, everything grows together):** (1) intake runs at EVERY loop boot (`fleet-intake-core.ts` called by loop-brief — findings become nodes before work is picked); (2) fleet p0/major nodes outrank gap order in the queue (`fleetNodePriority`); (3) regression findings (caseId regress-Gn) inherit the original node's domain + carry the CHANGE duty (restore accept, correct register rows) in their contract; (4) FULL briefs served live at `/api/fleet/briefs/[bot]` from `fleet-briefs.ts` (secret substituted at serve time) — the app holds only a 3-line bootstrap per bot; loop edits brief code → every bot follows next heartbeat. Spec's six full-brief sections excised (code is single source; table summary remains). R-210 VERIFIED, pin R-210.

**Event-driven fleet (same day — Matt: no downtime, no rough timers, packs must update every iteration):** packs now served LIVE from the work graph at `GET /api/fleet/cases/{core,regression,preflight,flows}` (x-fleet-secret; `lib/data/loop/fleet-cases.ts`; script stays local-preview). First line RUN-TOKEN = hash(pack, deploy SHA, graph stamp) — changes only when something shipped. All 6 briefs rewritten: fetch pack at run start, token match → end in seconds ("no changes"); heartbeat cadences (Walkers 2h alternating, Money Path hourly :30, Stats 4h, Flow Prover 2×day). Loop-inline verification remains the ship gate — the loop NEVER waits on bots; they trail and only add work. Briefs now point at ryan-realty.com (live canonical domain). R-209 VERIFIED, Max pin R-209.

**Deploy-verify repair (same day):** VERCEL_TOKEN went invalid mid-day; script now flips to Vercel CLI auth fallback on 401/403 (`ab2795f0`, scripts-only → remote build correctly skipped/CANCELED by ignoreCommand; prod serves `23ab136c` with all runtime code). KNOWN SMALL BUG for next runtime push: error-branch log fetch reads `deployment.id` but v6 list returns `uid` → fix `d.uid ?? d.id` in check-vercel-deploy.mjs. Also: rotate VERCEL_TOKEN when convenient (M-adjacent, dashboard).

**Flows lane (same day — Matt: "use the system like a human, catch all use cases"):** designated fleet test identity (`fleet-test` local-part marker + phone 500-555-0106, `lib/crm/fleet-test-identity.ts`) wired at four chokepoints: ensureNativeLead tags `fleet:test` + all-channel suppression on create; createNativeTask skips (no broker wake); autoEnrollPerson refuses; packet counts exclude (crm/newsletter/alerts). ALL PROVEN LIVE — fixture person 61855. **Bot 6 Flow Prover** (8 PM PT) may SUBMIT the four flow cases (newsletter, /sell valuation, listing contact, alert save) with that identity ONLY; `scripts/fleet-flow-verify.ts` proves backend effects after runs (all PASS). Admin-side = loop-verified; Admin Walker bot stays Matt-gated (viewer credential). G30 DONE, R-208 VERIFIED, pins G30/R-208, packs now 4 (flows added).

**X-research mesh (same day):** harvested xAI's canonical operating model + field practice into the spec — skill-before-routine (never automate unproven), six-point routine checklist (owner/schedule+TZ/input/result/approval-boundary-as-sentence/no-data policy), re-paste packs after significant ships (regenerator is the re-sync), memory-is-not-a-source (in Stats Truth brief), do-not-rely-on-Auto-Review (rails are the fence), staggered schedules for usage limits (7a/9a/11a+5p/2p PT), Teach-a-Task = optional draft. Practitioner signal: "test apps" is a top validated Grok Bot use case.

**Do not:** put the fleet secret in any committed file; let bots touch forms/admin; treat a bot finding as verdict (reproduce-or-reject); certify a version without the fleet pass.

# Prior — 2026-08-15 (Grok) — First adversarial pass: the machine found 17 defects, teeth hardened

**Matt:** "When I catch things you haven't, I worry this is all prose." Correct instinct — R-040 (adversarial verify, LOCKED since July) was being violated by self-graded verification. ESCAPE `6c980ad6`.

**Audit (3 fresh-context breakers, claims only):** 17 defects, zero found by Matt.
- Gates: G56/G57 blind to TAIL-row deletion (proven: delete G25/R-206 → green). FIXED: `**Max:** G28 · M6` / `**Max:** R-206` pins, cross-checked both directions; M-rows now need DONE dates too. Re-proven: tail delete now FAILS.
- Enforcement: work-graph state machine was DAL-only (raw update flipped killed→done) + TOCTOU race; ledger freeze had zero executable callers and failed OPEN on read error; one-open-per-domain unenforced. FIXED: DB triggers `loop_work_nodes_guard` + `site_improvement_ledger_guard` (migration `20260815210000`, applied hosted), optimistic `.eq('state', from)` in transition(), DAL guard fail-closed + full one-open rule.
- Register truth (12 rows attacked): 8 survived. R-025 (pulse counts INCLUDE Coming Soon — Bend 487 had 4), R-095 (town doors are static scenics not live MLS), R-137 (four untracked email paths: sequence fallback, home-valuation delivery+ack, admin one-off, CMA request confirm), R-203 (inboundFeePct write-only, never reaches tc_commissions). All demoted VERIFIED→PARTIAL; product gaps **G26/G27/G28** opened + seeded (graph 28 nodes).
- Stale claims: 8 in packet/manifest — including a REVIVED OAuth reconnect ask in §5 (the cb7699f1 class) and "13 nodes" vs live 24. All corrected; counts now live in ONE place each.
- Canon v1.5.1: step 5 mandates the adversarial pass for high-stakes classes (fresh subagent, claims only, never self-graded). All pointers bumped; G44 green.

**Verified survivors worth knowing:** R-057 private-key diversion (anon probes clean), R-179 delivery observability (real events), R-121 sitemaps (7,668 listing URLs live), R-066 concessions math, transitions refuse illegally at DB level now.

**Next:** G2 identity stitch via "Run the loop" (brief serves it with leads-domain reads). G26 (email tracking) and G27 (Coming Soon count truth — may need Matt's definition pick) are strong next candidates; G27 is §0-adjacent.

# Prior — 2026-08-15 (Grok) — Requirements register: all of Matt's asks, dispositioned and unshrinkable

**Matt:** Bring every requirement from every session together; the system fills gaps automatically; never "five things so forget the 120 others"; he is done being the memory.

**Done (THE LOOP v1.6.0):**
- **`docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md`** — five parallel readers harvested the FULL corpus (handoff history, master goals, brain dumps, Broker OS plan, public locks, PROGRAM decisions, canon, rules, memory): 572 raw directives → **203 dispositioned rows** (91 LOCKED · 41 VERIFIED · 39 PARTIAL · 25 MISSING · 6 GATED · 1 PARKED) grouped by the 12 animals, each with source + coverage. Dispositions inherit source claims; certification re-verifies.
- **Gaps filled automatically:** the 25 MISSING rows drove **G15–G25** onto VERSION-1 (search completeness, CMA/pricing residual, prospecting product, reporting collapse, one person surface + SendPanel, buyer packet build, public IA/mobile residual, SEO/AEO residual, email residue kill, admin dark mode, social fan-out calendar) + 11 seeded work nodes (graph now 24 nodes, G1 done).
- **G57 `ci:requirements-register`** (in ci:gates + MECHANICAL_GATES): R-IDs contiguous (rows leave only as SUPERSEDED in place), closed disposition set, MISSING must cite an existing manifest gap. Namespace note: only MISSING rows' G-refs validate against the manifest (G44/G56 in evidence cells are mechanical gates).
- Loop-brief now prints the demand line (register counts). Canon v1.5.0; pointers bumped; G44 green (263 docs).
- **New-directive rule (canon):** a new Matt directive lands as a register row in the same delivery that acts on it.
- **Same-day follow-up (versioning Q&A):** expertise routing shipped — `DOMAIN_REQUIRED_READS` in domains.ts (existence-tested) printed by the brief under the next node; §How Matt steers (ADD/CHANGE/STOP; blocked ≠ stopped) in COMPANY_IMPROVEMENT; R-204 (expertise, VERIFIED) R-205 (steering, LOCKED) R-206 (scheduled unattended iterations — GATED, Matt undecided). Register 206 rows. Second-brain research done: we independently match Karpathy's LLM-Wiki pattern (raw→wiki→schema, ingest/query/lint); lint = our gates + weekly packet + certification.

**Next:** "Run the loop" → brief serves G2 identity stitch. New gaps are scored alongside old ones; Learn stays first where windows expire.

**Do not:** delete or renumber R-rows (SUPERSEDE in place). Do not treat VERIFIED-per-source as re-verified — certification does that. Sends/posts/spend/OAuth stay Matt-gated.

**Skills read:** growth-loop, COMPANY_IMPROVEMENT, DEVELOPMENT_PROCESS, ENTERPRISE_MAP handoff + matrices.

# Prior — 2026-08-15 (Grok) — Durable Company Loop: work graph, loop-brief, G56, first MEA iteration

**Matt:** Long sessions lose context; objectives fall off the plate; wants the recursive plan runnable with graph engineering, everything remembered, no shortcut assumptions.

**Done (THE LOOP v1.6.0, plan `durable_company_loop`):**
- **Durable work graph:** `public.loop_work_nodes` (migration `20260815190000`, applied hosted via `scripts/analytics/apply-analytics-migration.mjs` — psql absent, pg driver used). Contract per node (objective/output/accept), audited transitions (done/killed terminal, evidence required), DAL `lib/data/loop/work-graph.ts`, pure rules + tests `work-node.ts`. Seeded G1–G13 from VERSION-1 (`scripts/seed-work-graph.ts`, idempotent upsert on version_gap).
- **Session boot is a command:** `npx tsx scripts/loop-brief.ts` — handoff Current + scoreboard headline + stranded windows + work graph + next node contract. Matt's prompt is now "Run the loop."
- **G56 anti-shortcut gate:** `scripts/check-version-manifest.mjs` (`ci:version-manifest`, in ci:gates + MECHANICAL_GATES). Below-floor CAPs / red INTs must be accounted in VERSION-1; G/M numbering contiguous; DONE needs a date; CERTIFIED needs a SHA. First run caught CAP-033 dropped — fixed into M6.
- **Canon v1.4.0:** memory hierarchy (chat = disposable; graph/ledger/manifest/handoff/ADR = durable), MEA mapping (Manager = brief+scores · Executor = session · Auditor = accept+gates), additive-updates rule. All pointers bumped; G44 green (262 plan docs).
- **Graph waves GO recorded** in AGENTIC_GRAPH_ENGINEERING (infra only): `.claude/workflows/{verify-figures,adversarial-audit,scoreboard-sweep}.md`; codebase-memory ADR written (PURPOSE/STACK/…/TRADEOFFS incl. token self-renew + FUB dead + one identity spine); `detect_changes` verified (91 files vs index at `85d13209`).
- **First MEA iteration (G1) COMPLETE:** claimed → `scripts/loop-learn-close-windows.ts --domain seo-aeo` closed all 11 expired windows with §0 traces (1 win: Tetherow LCP p75 60,768→4,156ms · 1 loss: overlay engagement 0.144→0.119 · 1 flat: llms.txt +3 vs +10 · 8 inconclusive: GSC page series not live in June — G.2 lesson) → probe `expiredUnlearned=0`, seo-aeo unfrozen → node done with evidence (`bcde58b9`). Brief now auto-serves **G2 identity stitch** as next.
- Prior deliveries confirmed: `1641a156` + `85d13209` both READY on production.

**Next:** "Run the loop" → brief serves G2 (identity stitch, 1/164). ba3435dd factory window Learns 2026-08-29. Matt moves M1–M6 in VERSION-1.

**Do not:** re-add reconnect asks (tokens self-renew; LinkedIn parked). Do not treat chat todos as the source of record — the graph is. Do not open a class in a domain with expired unlearned windows (guard refuses anyway).

**Skills read:** growth-loop, COMPANY_IMPROVEMENT, DEVELOPMENT_PROCESS, AGENTIC_GRAPH_ENGINEERING, ENTERPRISE_MAP SESSION_HANDOFF, TDD.

# Prior — 2026-08-15 (Grok) — Company v1: versions over the map, Learn made mechanical

**Matt:** Fast answers keep leaving ad-hoc drift; the whole product never reaches "a new version" together. Wants the comprehensive, granular, holistic process.

**Done (THE LOOP v1.3.0):**
- **`docs/plans/ENTERPRISE_MAP/VERSION-1.md`** — Company v1 manifest: six-layer plain-language census over CAP/INT matrices, the 7-condition floor, 14 agent gaps (G1–G14) + 7 Matt moves (M1–M7), certification pass. Versions close on conditions, never dates.
- **Learn mechanical** in `lib/data/loop/`: `closeImprovementLedgerRow` (writes actual_delta+verdict+measured_at); `insertImprovementLedgerRow` refuses a domain with expired unlearned windows; `listExpiredUnlearnedWindows`; pure `windowEndsAt`/`isExpiredUnlearned` + tests (30 pass). Probe/packet now counts `expiredUnlearned` per domain.
- Canon v1.3.0 §Company versions + changelog; pointers bumped (CLAUDE, TEMPLATE, producer-output-class, addendum, scoreboard, SESSION_HANDOFF, growth-loop SKILL, domains.ts). G44 green, 262 plan docs registered.
- Live probe 2026-08-15T15:3xZ: **11 of 12 open windows expired-unlearned, all `seo-aeo` → domain frozen until Learn closes them.** TikTok token expires 2026-08-16T12:00Z (G14). Meta audience heartbeat first green 14:03Z (G11).

**Correction same day (Matt: "knock it off" on reconnect asks) — ESCAPE `cb7699f1`:** the "4 red integrations, Matt must reconnect" claim was FALSE for 3 of 4. Verified live: GBP/YouTube/X/TikTok auto-refresh via the daily 12:00Z token-heartbeat (refresh tokens on file; scheduled run 2026-08-15T12:00:03Z all ok; on-demand trigger rolled expiries to 19:09/20:09Z). Only LinkedIn lacks a provider refresh token → **PARKED, never a reconnect ask**. Fixed everywhere: signals.ts TokenHealth (`refreshTokenPresent`, `auto-refresh`/`needs-reauth` statuses), VERSION-1 (no OAuth Matt move; 6 Matt moves; G14 DONE), INTEGRATIONS (red 4→0, RECONNECT 5→0), SOCIAL-PARKS, CAP-019, ALL-OPEN, ADVANCEMENT_PLAN, REMAINING, DUAL-PASS, SESSION_HANDOFF, scoreboard §0, EVIDENCE-LOG 2026-08-15 entry. **Rule: liveness authority is heartbeat `sync_logs`, never `expires_at` alone. Do not re-add reconnect asks.**

**Next:** G1 (close the 11 seo-aeo windows from GSC actuals) unfreezes SEO. Then the scored queue: G2 identity stitch (1/164), G3 Lead stage 0, G4 alerts coverage. Matt moves listed in VERSION-1 §M.

**SHA:** see this commit. Prior `649c0a79`, `7d4a7256` on origin.

**Skills read:** growth-loop, COMPANY_IMPROVEMENT, DEVELOPMENT_PROCESS, ENTERPRISE_MAP SESSION_HANDOFF + matrices, TDD.

# Prior — 2026-08-15 (Grok) — finish the place-family indexes

**Matt:** The restore stopped at an invented cutoff. Neighborhood and subdivision indexes were still 404. Finish the place doors. No seventh pattern.

**SHA:** `68988f0b` on `origin/main`. Indexes landed in `ccc0f62b`. This SHA publishes subdivision hero counts from the community plat set. Parent restore `d2208216`. Production READY.

**Done this land:**
- `/neighborhoods` LIVE: 13 Bend districts, 355 active SFR, doors to `/cities/bend/{slug}`. Production walk 200, kb-root, Awbrey Butte $1,385,000.
- `/subdivisions` LIVE: featured community plats + A-to-Z of those plats, doors to `/subdivisions/{slug}`. Areas nav / Menu+ / both footers / sitemap / site-index all open both indexes.
- Neighborhood and plat `generateStaticParams` are no longer empty stubs.
- Hero on `/subdivisions` now publishes snapshot counts for the community plat set it actually lists. County-wide `getIndexableSubdivisions` stays on the sitemap, not this page.
- Production READY for `ccc0f62b`. Screenshots in `out/looks/2026-08-15-place-indexes/` (gitignored).

**Do not:** `git add -A`. Do not commit LOOK-PLAN / RESTORE / page-grade leftovers / recapture PNGs / `_sunstone-cma-summary.ts`. Do not stamp Public Product OS grains LIVE. Do not page-grade.

**Named stops (still hold):** looking-at SMS / buyer-packet send. Ad spend. I6. Page-grade. New Public Product OS. Tremor npm. PropXYZ purchase. Do not publish 1990. Ban new UI components.

**Skills read:** endtoend, git-commit.mdc, CROSS_AGENT_HANDOFF, deployments-cicd, verification.

# Prior — 2026-08-15 (Grok) — company loop v1.2.1 blast-radius

**Matt:** Search, saved searches, granular filters, listing alerts, CMA look, stat accuracy + one verification process, all polygons, Vercel/Supabase, analytics/GBP/social/reporting, CRM ease. Holistic: a change in analytics must land on the site, reporting, newsletters, and ads. Spark is ingest-only. Do not lose identity stitch (opens, clicks, Google, ads).

**SHA:** `2ac16199` on `main`. Parent company ingest `7c2bca5c`..`b163a2f6` on `origin/main`.

**Done this land:**
- THE LOOP **v1.2.1**. Same 12 domains. Named surfaces + `COMPANY_BLAST_RADIUS` (7 planes).
- Probe now reads `listing_alerts`, `boundaries`, `search_areas`, `visitor_identity_map`, `email_events`, `visitor_events`, `cmas`, `meta_audience_log`.
- Packet refresh 2026-08-15T14:45:03Z. Identity stitch **1/164**. Alerts **6** active. Boundaries **3,312**. `search_areas` **0**.

**Do not:** `git add -A`. Do not mix place-index or LOOK leftovers. Do not send, post, spend, or OAuth. Do not invent a 13th domain or a second stats engine.

**Skills read:** growth-loop, crm-e2e, database-canonical-reference, SESSION_HANDOFF, CROSS_AGENT_HANDOFF.

# Prior — 2026-08-15 (Grok) — company improvement process (THE LOOP v1.2.0)

**Matt:** Develop a process that continually improves the whole company. No new OS. No product UI.

**SHA:** `7c2bca5c` on `main` (local through `b163a2f6`). Hosted `site_improvement_ledger.domain` applied 2026-08-15. Ledger row `ba3435dd`.

**Done this land:**
- THE LOOP bumped to v1.2.0. Ingest is company-wide. Five standing loops unchanged.
- Addendum `docs/plans/COMPANY_IMPROVEMENT.md` (domain → signal → diagnose).
- Weekly packet `docs/plans/COMPANY_SCOREBOARD.md` (overwrite, not a dated novel).
- `site_improvement_ledger.domain` (12 closed domains). DAL `lib/data/loop/`. Probe `npx tsx scripts/company-scoreboard-probe.ts`.
- Start ritual: SESSION_HANDOFF + COMPANY_SCOREBOARD.

**Do not:** `git add -A`. Do not mix LOOK-PLAN / RESTORE / page-grade leftovers. Do not send, post, spend, or OAuth.

**First packet filled** 2026-08-15T14:14:00Z. 11 open seo-aeo windows plus this factory row. Next cycle can score a non-SEO class (nurture Lead=0 is the highest-reach rotting row).

**Skills read:** TDD, database-canonical-reference, SESSION_HANDOFF, CROSS_AGENT_HANDOFF, growth-loop, git-commit.mdc.

# Prior — 2026-08-15 (Grok) — restore the photographed public site

**Matt:** Revert the public site the page-grade pass flattened. Keep going /endtoend. Not another OS. Not a new UI component.

**SHA:** `d2208216` on `origin/main`. Vercel production READY. Custom domain https://ryan-realty.com serves kb-root + photographed home/Bend. Parent: `0ccad3b0`.

**Done this restore:**
- Homepage is KB again: KbHero, towns, communities, featured, region map, ticker, sell, reviews, team, market HUD, plus ArrivalIntent. D11 lead locked.
- City / neighborhood / community / zip / cities+communities indexes: photographed KB + PlaceMapListSplit dual-pane, not cream ledger.
- Listing: full KB stack (hero, gallery, facts, map popup with photo/href) plus HouseMe LivePricingRead.
- About stayed HEAD (faces + Call/Text). Mission sentence stays out of How it started.
- Plat sales-history / schools kept the photographed table and re-wired year doors + DAL school constants so `ci:subdivision-stats-integrity` holds.
- Gates: mockup-parity 28/28, public-ui re-seeded to the restore (205/8/44), tests 11356 pass. Screenshots in `out/looks/2026-08-15-restore/` (gitignored).

**Kept (not flattened):** ArrivalIntent, sentence search, HouseMe/pricing read, map popup facts, about phones, cube, CMA, admin, chart grammar, D109 no-recharts.

**Named stops (still hold):** looking-at SMS / buyer-packet send (CLAUDE.md §1). Ad spend. I6. Page-grade. New Public Product OS. Tremor npm. PropXYZ purchase. Do not publish 1990. Ban new UI components.

**Do not:** `git add -A`. Do not commit `LOOK-PLAN.md`, `RESTORE.md`, `looks/2026-08-14-page-grade-v24-regrade/`, recapture PNGs, or `scripts/_sunstone-cma-summary.ts`. Do not stamp neighborhood/subdivision grains LIVE.

**Left on disk, not shipped:** recapture PNGs. Page-grade leftover folder. `LOOK-PLAN.md` / `RESTORE.md`.

**Next after push:** `npm run deploy:verify`, then walk production home/Bend/listing. Neighborhood and subdivision *indexes* still 404. That is a later product job, not this revert.

**Skills read:** endtoend, git-commit.mdc, CROSS_AGENT_HANDOFF, SESSION_HANDOFF.

# Prior — 2026-08-14 (Grok) — public look: stop inventing, use an existing system

**Matt:** Page-grade flattened the live site. "Restore" is the wrong word. Do not write product UI until he stamps a look. Then: find a system that already exists (GitHub + reviews + trending), incorporate something beautiful. Do not spin another rubric/OS.

**GitHub hunt (done this session). There is no beautiful open-source brokerage frontend.** Highest RE stars:
- `microrealestate/microrealestate` 1,166 — landlord/PM ops, not a public MLS site
- `AleksNeStu/ai-real-estate-assistant` 293 — live demo is a cold Render splash, not a look
- Niche Next/shadcn RE templates: 0–6 stars, student clones

**What is actually trending and looks good (2026 reviews):**
1. **Tremor Blocks** — 16k stars on tremor-npm, Vercel acquired, 300+ blocks now free MIT. Philosophy: show the data, hide the chrome. Demo: https://blocks.tremor.so and https://tremor.so/blocks
2. **Origin UI → COSS** — 10.4k stars, now Cal.com's system at https://coss.com/ui. Primitives, not a brokerage look.
3. **Magic UI** — 20.8k. Landing-page motion. Wrong job.
4. **PropXYZ** (Shadcn Studio, Jun 2026, $79) — only RE-shaped Next 16 + shadcn + TW v4 template. Cards already draw photo + beds/baths/sqft + price + map split. Demo: https://shadcn-nextjs-propxyz-admin-template.vercel.app/ — rental/PM, not MLS, but the card/map language is the one that looks finished.
5. **HouseMe.ai** — best live AI-RE *product* (Intelligence Report). Not OSS. Copy the report structure, not their code.

**THE PICK (Matt stamped the 3 UIs 2026-08-14 evening):**
- Browse/map/cards: PropXYZ card + map-split language.
- Market / analysis: Tremor Blocks (free MIT). Skin navy/cream.
- Listing intelligence: HouseMe report shape on *our* stamps. No invented 5-year %.

**Plan of record:** `docs/plans/PUBLIC_PRODUCT/PRODUCT.md`. Includes the Aug 10 sales cube (shipped as `analytics_mart_*`, 2016–2025; remaining: 1998 backfill, kill live_aggregate, weekly full rebuild, place/listing/CMA reads). `LOOK-PLAN.md` is display only. `DATABASE_FOR_AI_AGENTS.md` lookup now routes size/composition/feature/share to the marts.

**Do not:** page-grade, new Public Product OS, Magic UI, treat look as the whole job.

**Next:** Matt stamps PRODUCT.md, then execute PRODUCT §1 (arrival and memory), then §2 (Field cards). Recapture the ten-page strip after any `V3Field` change.

**Skills read:** frontend-design, design_system/ryan-realty, CROSS_AGENT_HANDOFF.

## Prior — 2026-08-14 (Grok, imagery canon) — local, not pushed

**Track:** Kill the prohibitive "AI never renders real life" lock. We are better at this now.

**Wired:**
- Creative-brain law 1 is now: reference-conditioned Central Oregon place work is allowed. Prompt-only scenic slop is refuse. Do not invent a listing, a room, or the view from an address. No people-as-residents. Charts render in code.
- CLAUDE.md banned-content #2, D38, design-system imagery, market-video i2v, producer hard-fails updated to the same use-class.
- July Reality Law stays in LESSONS.md as history (why unconstrained photoreal failed). It is not a live ban.

**Next leftover:**
- Place bible + reference packs + image resolver. Banner table is still 0 rows.
- Form catalog leftover: paste SkySlope JSON from the Mac Mini, then one-click PDF pull.

**Not this land:** Do not `git add -A`. Page-grade / public-product-os / SESSION_BOOT dirty files stay out. No generated banners shipped this session.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, creative-brain, public-product-os (orient), git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, CMA use + pricing pages) — READY `11f78637`

**Track:** Make the CMA document beat the packet Chris actually sent. Sample: RPR 30-pager for 56628 Sunstone Loop (Caldera Springs), 2026-08-12.

**SHA:** product `11f78637` on `origin/main`. Production READY. No schema.

**RPR vs live cache (same day, verified):**
- RPR: ZIP 97707, 8.68 MoS labeled seller's, AVM $2,423,333, stale CMA $2,499,000 (2026-03-17), 4 AVM "comps" + 1 close, $0 adjustments.
- Caldera Springs cache: 39 closed / 365d, median $1,790,000, 22.15 MoS, buyer's. Listing city is Bend (3.62 MoS, median $722,000). Old CMA builder would have used Bend.

**Wired:**
- `resolveCmaMarketTargets` — resort neighborhood cache first, city fallback.
- Phase suffix on resort aliases (`Caldera Springs Phase One`).
- Cover + pricing: closed MLS sales only, automated estimates not used, market is the community not the ZIP.
- Market board (`render-market-page.ts`): these sales / this market / under contract / for sale now. Trend chart only when six priced months exist.
- Zoning / rental boards and pricing explanation from `78ed727e` stay.

**Do not `git add -A`.** Imagery Current / page-grade / chrome-seller-ask / admin inbox stay out.

**Leftover:** existing stored CMAs keep old HTML until rebuilt. Do not rebuild the hand-crafted 3480 row. Sunstone draft built 2026-08-14: slug `cma-56628-sunstone`, status draft, not sent. Recommended $1,730,000. Audit fail (3 findings). Local HTML `out/cma-56628-sunstone/cma.html`. Looks `docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-sunstone-cma/`. Production PDF was 500: Chromium rendered, then `assertPdfPageSafety` could not load `pdfjs-dist/legacy/build/pdf.worker.mjs` on Vercel. Fix is local (pdfjs-node + tracing include), not in this handoff commit.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, TDD, VOICE.md, frontend-design, CMA producer SKILL.md, PAGE_CONTRACT, DATABASE_FOR_AI_AGENTS §3a, git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, public pricing product) — READY `68a1123d`

**Track:** Roll the matcher into one public product. Not another matcher-geography pass.

**SHA:** product `68a1123d` on `origin/main`. Production READY. Hosted `listing_pricing_reads` + `listing_pricing_reads_due` applied (`20260814171000`, SFR-only due `20260814174600`). 11 stamp rows after two cron drains.

**Wired:**
- `lib/pricing/public-contract.ts` — listed over/under, unlisted range, refuse (thin-set / new-construction / builder-phase / facts-not-ready / no-gla). Range band 0.09.
- CMA `build_summary.public_listing_read` from the same contract. Document can still price new construction. Page must not.
- Listing page reads the stamp only. Published CMA wins. CTA is `PublishedCmaDownload` mode=request → `crm_people` tagged `source:listing-pricing-read`. No second form.
- Terms mention the listing-page market read.
- Due function is SFR only. Condos / TICs / manufactured no longer starve the stamp queue.

**Prod check (numbers match the stamp):**
- Listed: 2533 Pine Terrace, Bend (`/listing/20210502210640934980000000`) — $1,089,000 to $1,305,000, 3% over the ask, n=3.
- Refuse thin-set: 21483 Bunchgrass, Bend.
- Refuse new construction: 620 Sprout, Sisters.
- Looks: `docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-listing-pricing-read/`

**Do not `git add -A`.** Imagery Current / page-grade / chrome-seller-ask stay out.

**Leftover:** builder-phase $/sqft (Walnut / Kiesow class) only. Public page refuses those addresses. Cron still drains facts (`done: false`) and stamps 6 SFR per run until facts are done, then 24.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, TDD, VOICE.md, DATABASE_FOR_AI_AGENTS §2b, git-commit.mdc.

# Prior — 2026-08-14 (Grok, form catalog T2.1b) — LIVE `caa92e2a`

**Track:** Transaction forms. Know when OREF, Oregon Data Share, or Oregon Realtors revise a form, and when a new published form exists, without downloading every blank.

**SHA:** `caa92e2a` on `origin/main`. Production READY. Hosted `20260814140000` recorded on `dwvlophlbvvygjfxcrhm` (`tc_form_catalog_items` / `tc_form_catalog_checks` already present). OR + ODS free with membership; OREF paid subscription.

**Wired:**
- Three SkySlope libraries: OREF `1340`, ODS `1528`, Oregon Realtors `1837`. Engine is generic; RR house forms stay local.
- Metadata-only catalog check. Console script copies published JSON. Paste on `/admin/forms` or `POST /api/admin/forms/catalog-check`.
- Diff matches `source_form_id`, then form number (samples still pair). Empty library lists are refused.
- Persist `tc_form_catalog_items` + `tc_form_catalog_checks`. Held rows get `update_available` + `pending_source_version_id`.
- `/admin/forms` filters: updates / new / retired. OREF packet warns when 001 is stale.
- PDF ingest of a new version is still the existing loader. Do not send a stale layout to a client.

**Next leftover:**
- Run the check from the signed-in Mac Mini SkySlope Forms tab, then paste JSON.
- `updateFormVersion` one-click PDF pull is not built. Re-run ingest for the new `sourceVersionId`.

**Not this land:** SkySlope write, client send, Partnership API cron. Do not `git add -A`. Dirty CRM deals paths stay out.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, skyslope-form-compliance, oregon-real-estate-oref, oregon-orea-principal-broker, document-external-api, skyslope-file-organization, tc-builder, admin-product-os (orient), git-commit.mdc.

# Prior — 2026-08-14 (Grok, inbound agent referral) — LIVE

**Track:** New revenue desk. Out-of-area brokers send a Central Oregon buyer or seller to `/refer-a-client`. Destination-market GCI after a 25% referral. No outbound SMS/email. No drip. No ad spend.

**SHA:** referral `b4bf6b8d` on `origin/main`. Tip `104c01cc` (seller-net stacked after). Production READY `dpl_6v6xZDp114abhCEYmroiY98r5zbq`. No new referral migration. Hosted `sale_pricing_facts` already present (149,402 rows).

**Wired:**
- Public `/refer-a-client` — v3 Stage → Ledger → Sheet (9 steps, choice intent) → Quiet
- Client → `crm_people` tagged `referral:inbound` + `source:agent-referral`. Sending broker → `role:referring-agent`. Both blocked by `geoReferralEnrollBlock`
- Internal only: 240-min task + `queueBrokerAlert` to Matt. Same-email rejected. Shared phone omitted on the second person
- Admin `/admin/crm/referrals` — Incoming from other agents above the outgoing handoff queue
- Nav / sitemap / llms map / page-inventory. Sign-in modal excluded on `/refer-a-client` and `/join`

**Looks:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-refer-a-client/` local 390+1280 hero/ledger/form plus prod-390 and prod-1280. No OAuth modal.

**Next leftover:**
- After a real inbound lands, write the referral agreement by hand (Matt §1). Do not contact the client first
- LIVE `/llms.txt` already lists the path

**Not this land:** Seller-net is on this tip (`3f8ad2a2` + `104c01cc`), not in a stash. Older stashes still hold sell-film / SellerLPForm. Do not `git add -A`. Do not push `wt/*`. Did not send a referral or a message.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, growth-loop (orient), admin-product-os (orient), public-product-os (orient), frontend-design, git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, leftover-todo pass) — READY `caa92e2a`

Agent leftovers that do not need Matt. CRM Pipeline islands deleted (redirects stay). Seller-net cells page past the 1,000-row cap. `pricing_index_window` hosted. Form-catalog gates fixed so the stack could land. Production READY on `caa92e2a`.

**Still Matt-gated:** Yes on Today, C taste, Email to Matt, publish, referral agreement after a real inbound.

**Still open, not Matt-gated:** other OREF maps (need measured blanks), SkySlope live file, `crm-deals` mutations with no UI, pre-2024 YN drain (cron), one-click form PDF pull.

# Concurrent — 2026-08-14 (Grok, pricing audit leftovers) — READY `67207069`

1–5 LIVE `4701a30e`. Leftovers LIVE `67207069` (production READY). Hosted `20260814152953` already applied. Matcher holes closed:

1. Quality stop is tight GLA only. `subdivision-*-wide` (±30%) does not stop the ladder.
2. `plausibleListedClose` drops a close over 10× last ask, not only under 10%.
3. A mile-ring sale with no coordinates is dropped.
4. Mapped vs unmapped is a different market. Highway 20 does not fail-open into Boyd Acres.
5. 1-acre Redmond / Sisters / Prineville / Madras / La Pine / Culver is not rural. Ranch (5+) in those towns still is. Unmapped Bend on an acre or more stays rural.
6. `matchToCompSelection` diagnostics now carry the resolved market area and rural flag.
7. Same-neighborhood subdivision $/sqft cut is 15%. Debron is Awbrey Woods tract ($382, n=7) vs Awbrey Butte custom ($457, n=86) — the 30% citywide cut let them mix.

**Do not `git add -A`.** Page-grade / public-product-os / chrome-seller-ask / V3 chrome dirty files stay out.

**Skills read:** SESSION_HANDOFF, CROSS_AGENT_HANDOFF, TDD, database-canonical-reference, DATABASE_FOR_AI_AGENTS §0/§2b/§4, git-commit.mdc.

# Concurrent — 2026-08-14 (Grok, seller net) — READY `104c01cc`

ClosePrice is the contract price. Seller concessions come off that number before commission. `lib/pricing/seller-net.ts` + view `sale_pricing_seller_net`. Production READY on `104c01cc`. Hosted YN column and view already applied.

**Next:** 400-sale as-of backtest on ClosePrice and seller net. No accuracy claim without a printout. Pre-2024 YN drain is leftover.

# Prior — 2026-08-14 (Grok, Track 2 P3 leftovers /endtoend) — READY `7392b788`

**Track:** 2 P3 leftovers that do not need Matt. A broker does not work a second send path or a second deal board. No outbound SMS/email. No SkySlope write.

**SHA:** P3 tip `7392b788` on `origin/main`. Production READY (`dpl_3fJ7uEWJfrcLTW4UpGuubtcL6yWY`). Stamp `587dbe97`. P2 tip `6f32f9b3` already READY.

**Hosted migration** `20260814010000_tc_deal_people.sql` already applied on `dwvlophlbvvygjfxcrhm`. 0 rows. P3 has no new migration.

**Wired:**
- Dead `sendExpiredIntroAction` / FSBO send / `send-doc` refuse with “Send from /admin/prospecting.”
- Visitor hot-lead cron: 5-minute call task for identified sessions. `visitorEscalateEmailEnabled()` is false. No Resend.
- `/admin/crm/deals`, `/pipelines`, `[id]`, reporting/deals → `/admin/closings`. Pipeline child gone from People nav. Closings footer no longer links the old board.
- Packet hero stays `buildThisHomeMarketingPlan`.

**Looks:** `docs/plans/ADMIN_PRODUCT/looks/2026-08-14-track2-p2/` signed-in local 390+1280.

**Plan:** `docs/plans/ADMIN_PRODUCT/TRACK2-RANKED-PLAN.md` (P3 leftover block)

**Next leftover:**
- Matt taste on C first-touch copy + packet
- Empty OREF maps on other form versions (overlay locked to 15-page 01/2026 sample)
- SkySlope remains the live file until cutover
- Unused CRM kanban islands still on disk under `app/admin/(protected)/crm/deals/`
- Yes on Today, Email to Matt, and publish stay Matt-gated. Do not send.

# Prior — 2026-08-14 (Grok, Track 2 P2 /endtoend) — P2 READY on origin

**SHA:** `6f32f9b3` READY. Person↔deal (`tc_deal_people`), Today approval Yes, inbound valuation C-bar, OREF 001 overlay. Hosted migration applied (0 rows). No live send.

# Prior — 2026-08-13 (Grok, Track 1 Open houses) — Open houses Look GREEN on production

**Open houses Look:** GREEN at 390 and 1280 on `/open-houses` and `/open-houses/bend`. First screenful is photographed open houses that open the listing. When/calendar stays on the card. Instrument (count + median) sits under the Field. Chrome CTA stays Value my home. v3 chrome kept.

**SHA:** feat `96a26b1b`. Production READY on `96a26b1b`. Docs evidence `73ea1d56`.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-open-houses/` (390/1280 local + prod).

# Prior — 2026-08-13 (Grok, Track 1 Places) — Places Look GREEN on production

**Places Look:** GREEN at 390 and 1280 on `/cities`, `/cities/bend`, `/communities/tetherow`. First screenful is photographed MLS homes that open listings. Instrument sits below the Field. Chrome CTA stays Value my home. v3 chrome kept. No AI houses.

**SHA:** feat `f2652459`. Production READY on `f2652459`. Docs evidence `8c79aa07`.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-places/` (390/1280 local + prod).

# Prior — 2026-08-13 (Grok, Track 1 listing detail) — listing Look GREEN

**Listing URL:** `/homes-for-sale/bend/20172-soft-breeze-220222292` (Active SFR, Spark photo, marketing video). Brookside `/homes-for-sale/bend/19305-brookside-220221862` is photo-only and still live.

**Listing Look:** GREEN at 390 and 1280. Real MLS aerial of this house (Spark CDN). UNMUTE is top-right of the hero, not on beds/baths/sqft. Poster stays until Vimeo/YouTube actually signals ready (blocked embed no longer covers the house). Gallery opens (1 of 50). Chrome CTA stays Value my home. v3 chrome kept.

**SHA:** feat `8040a829`. Production READY on `8040a829`.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-listing/` (390/1280 local + prod).

**Not this land:** `stash@{0}`. Do not `git add -A`. Track 2 not started.

**Skills read:** public-product-os (quarry + locks), frontend-design, PUBLIC_PRODUCT/decisions.md.

# Prior — 2026-08-13 (Grok, Track 1 `/sell`) — E-SELL-WORTH Look GREEN

**SHA:** feat `52f74fae`. Token fix `702cff04`. Production READY on `702cff04`. Piece A leftover LP CTAs `76f6a996`.

**`/sell` Look:** GREEN at 390 and 1280, local and production. Worth-question gone. Address-only step 1. Screenshots in `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-e-sell-worth/`.

# Prior — 2026-08-13 (Grok, Track 1 `/`) — E-HOME-JOBS Look GREEN

**SHA:** `a241f1ae` homepage feat. Production HEAD `10f26536` READY (includes the feat). Later `44a3fbe7` is docs/screenshots.

**`/` Look:** GREEN at 390 and 1280, local and production. Search/inventory door (`See homes for sale`), six D11 town doors, three-plus live MLS photographs. Chart on Instrument L2. Chrome CTA Value my home.

**Screenshots:** `docs/plans/PUBLIC_PRODUCT/looks/2026-08-13-e-home-jobs/` (`home-390.png`, `home-1280.png`, `home-390-prod.png`, `home-1280-prod.png`).

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.14

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
`docs/plans/ADMIN_PRODUCT/EXECUTION.md` is the only "where we are."
**D1–D11 locked.**

**Go** = autonomous envelope to completion, max parallel per the waves, serial
land. Does not send, post, mutate SkySlope, or declare a packet beautiful.
Closings cutover is not in Go.

**Wave 0:** E-CHROME · A3 · E-VOICE · V1 · G5 wrappers.
**Then:** public families, A4+A1, chart atom, cuts, P10.

**Still Matt:** say go; then only the hard stops (send, post, OAuth, license,
taste, money).

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.13

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
`docs/plans/ADMIN_PRODUCT/EXECUTION.md` is the only "where we are."
**D1–D11 locked.** Ready to execute when Matt says **go**.

**Fold-in:** Claude session “Site pages organization and navigation” is Loop E,
quarry not a second OS. Process/IA/visual locks stay. Implementation is not
final. 73 legacy / 527 imports / 399 chrome / 11 mixed / 0 v3-only.
Chrome = layout `PublicNav` → `V3Chrome`. Then family leases.

**How we run:** build parallel (file leases, worktrees). Land serial (one push
to `main` at a time). No `git add -A`. Evidence or it is not done.

**On go:** conductor fans out from the board. First land E-CHROME. Broker A3
may build in parallel (admin files). Mixed Market/Places pages get looked at
and reworked if clunky.

**Still Matt:** say go; money/ads; license; named-artifact taste.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.12

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**D1–D11 locked.** Ready to execute when Matt says go.

**Merge:** Claude session “Site pages organization and navigation” **is** Public
Product OS (`docs/plans/PUBLIC_PRODUCT/`), Loop E, phase P9_ROLL. Market + Places
on v3. Not a second redesign.

**Loop E remaining (Claude stop, matches `scripts/public-ui-baseline.json`):**
73 legacy pages, 527 non-v3 imports, 399 of them kb chrome. Chrome primitives
exist; they are not yet on leftover pages. Pickup: **chrome unit first**, then
Homes (search, listing detail, open houses, price drops), then trust/content.
Claude **stopped** rather than start another wave (two sessions committing;
last collision broke a build). That stop was correct.

**D11:** never name virtues except the About mission sentence. Only virtue words
are dead. Three registers (public / personal thank-you / admin simple). MLS
remarks never rewritten.

**Two tracks (do not mix files):**
- Public: remaining P9, chrome first. Owns `app/` public + `components/site/v3` + PUBLIC_PRODUCT.
- Broker: A3 person header, A4 wake **with** A1 queue.

**Still Matt:** say go (which track); money/ads; license; named-artifact taste.

**Loop E:** do not `git add -A`. Do not start a public wave from a broker session
unless Matt says **go public** and the other session is clearly stopped.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.11

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**D1–D11 locked.** Ready to execute when Matt says go.

**Merge:** Claude session “Site pages organization and navigation” **is** Public
Product OS (`docs/plans/PUBLIC_PRODUCT/`), Loop E, phase P9_ROLL. Market + Places
on v3. Remaining: Homes, Sell, chrome, homepage. Not a second redesign.

**D11:** never name virtues except the About mission sentence. Only virtue words
are dead. Three registers (public / personal thank-you / admin simple). MLS
remarks never rewritten.

**Two tracks (do not mix files):**
- Public: remaining P9. Owns `app/` public + `components/site/v3` + PUBLIC_PRODUCT.
- Broker: A3 person header, A4 wake **with** A1 queue.

**Still Matt:** say go (which track); money/ads; license; named-artifact taste.

**Loop E:** do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.10


`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D10 locked. **D11 (public voice) pending Matt.**

**Third audit:** A46 voice machine already failed (beige gates, corny rule-3 quotes).
A47 closed person labels. A48 A4 ships with A1. A49 buyer packet sections named.
A51 Imagine wrappers still old names; listing-tour still Replicate. A55
`/admin/social` is a traffic report.

**D11 partial:** three registers. Public never names virtues and does not thank
on listing posts. Personal notes always thank. Admin is a different, simpler
voice. Boutique = size fact. MLS remarks never rewritten; property-type codes
may display as Residential. About sentence pending (names authentic). Do not
rewrite `VOICE.md`.

**First build (when Matt says go):** A3 person header, A4 wake rewrite **with** A1
queue. Voice rewrite is a separate slice after D11 closes.

**Still Matt:** D11 remaining dialogues; say go; money/ads; license; named-artifact taste.

**Loop E:** do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.9

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D10 locked.

**D10:** Grok Imagine is the only generative image/video stack (`XAI_API_KEY`,
`grok-imagine-video-1.5` + `grok-imagine-image-quality`). Park Kling/Veo/Hailuo/
Luma/Wan/Seedance/Fal/Synthesia. Keep Remotion + list-kit compositors + FFmpeg.
Listing motion = image-to-video of the real MLS photo. Produce canon: §7f.

**First build (when Matt says go):** A3 person header, A4 wake rewrite, A1 queue.
G5 (Imagine i2v of one listing still) when we produce, not before the copilot.

**Still Matt:** say go; money/ads; license; named-artifact taste (packets + first
Imagine clip).

**Loop E:** do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.8

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D9 locked. Plan itself audited (A31–A42).

**Complete as meaning. Not a finished OS.** Further constitution is the failure mode.

**First build (when Matt says go):** A3 person header (who / next / now with sources),
A4 rewrite `queueReturnVisitAlert` to `{name} is looking at {address}.`, A1 queue.

**Agent this pass:** lead ask names the home, does not say we watched them. Buyer
packet ≠ lender BPO. Cutover = checklist. Unidentified = no SMS.

**Still Matt:** say go; OAuth reconnects; money/ads; license; named-artifact taste
(C1 packet, A5 packet).

**Loop E:** Places/Market `_v3/` landed in `16f0361f` (mixed). Remaining public WIP
is uncommitted — do not `git add -A`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.7

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** D1–D9 are locked.

**Matt this pass:** D2 SkySlope is primary TMS until in-house Closings is dialed,
then cut over (not a second vendor). D3 looking-at-a-home **wakes the phone** like
a new lead. Person page must show next step + what they're doing now + who they
are (expired etc.) without notes. SMS: clear, transparent, concise.

**Agent this pass:** D1 = ask first (short text), then a **buyer** packet if they
want it — never a seller CMA. Wake SMS: `{name} is looking at {address}.` Identified
person + specific home, one per person+listing per session (not every scroll).

**Still Matt:** OAuth reconnects, money/ads, license, named-artifact taste.

**Loop E:** public P9 still in flight. Do not `git add -A`.

**Next:** A1 queue, A3 person header, A4 wake, A5 buyer ask — when Matt says go.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.6 (who-decides)

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** Matt: technical questions are the agent's call
toward the goals. Recorded in the plan. Do not stop the grind to ask atom-vs-pattern.

**Agent-locked this pass:** D9 chart **atom** inside Instrument (not pattern 7);
D4 newsletter capture; D5 worth-language in title/meta only; D6 GBP+IG+FB+LI live
(YT/X reconnect; Threads/ND/Pin parked); D7 first week per-item then 7-day grant.
**Matt-locked:** D8 (his IG primary; brokers connect their own).
**Still Matt:** D1 buyer packet, D2 "Parallel", D3 wake vs Today; OAuth clicks;
money/ads; license; named-artifact taste.

**Loop E:** public P9 still in flight. Do not `git add -A`. Public session may add
the v3 chart atom (D9 locked).

**Next:** V1 inventory; G1 when Matt reconnects tokens. Do not mix with 11F or `_v3/`.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.6

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** v0.6: charts + look. A series displayed as a
number/table/dead polyline is a defect. Visual inspection in a real browser at
390 and 1280 is law — code review is not the look. v3 barrel has no chart atom;
admin 11C dropped sparklines. D9: recommend a v3 atom inside Instrument, not
pattern 7. Public chart work stays with the public session.

**D8 locked:** Matt's IG is primary; brokers connect their own IG/FB/LI.

**Loop E (the other process), live:** unchanged. Public Product OS `P9_ROLL` in
flight on this tree. **Do not `git add -A`. Do not migrate public families.**

**Next:** Matt audits + D1–D7 and D9 (D8 locked). V1 chart inventory can run as
evidence. V2 public waits on the other process. G1 when tokens are live.

**Blocked on Matt:** D1–D5; D6 live social set; D7 week-grant; D9 chart atom vs
7th pattern; **OAuth reconnect for brand GBP + Matt's primary IG**.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.5

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** v0.5: Loop G is a self-running calendar, not a
one-off post button. Copilot: "Hey Paul, want me to set up some ideas?" Brokers
connect their own OAuth. Today is the broker home (do / socials / deals / modify).
Draft-first stays — yes on the calendar, then it posts, times, and learns.

**Loop E (the other process), live:** unchanged. Public Product OS `P9_ROLL` in
flight on this tree. **Do not `git add -A`. Do not migrate public families.**

**Loop G quarry:** `content-approve` → publisher-sweep → `/api/social/publish`;
`getFormatPerformance` already has `best_hours` / `best_topics` but measured=0
starves it; `content-calendar.md` mix is stealable, Sheets/FUB door is not; auth
tables are brand-level (G4 is per-broker OAuth). Last census 2026-08-08: GBP/LI/X/YT
EXPIRED. Paid ads parked. Threads/Nextdoor/Pinterest parked.

**Next:** Matt audits + D1–D7 (D8 locked). Slices G1 (tokens, including Matt's primary IG)
→ G2 (one live post) → G3 (calendar week) → G4 (Paul/Rebecca connect their own
IG/FB/LI). Do not mix with 11F or public `_v3/`.

**Blocked on Matt:** D1–D5 as before; D6 live social set; D7 standing week-grant vs
per-item; **OAuth reconnect for brand GBP + Matt's primary IG**. D8 is locked
(Matt's IG primary; brokers connect their own IG / Facebook / LinkedIn).

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0.4

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record.
**No product code this session.** v0.4 adds Loop G (GBP + organic social) and
records live Loop E status so we do not fight the public-product session.

**Loop E (the other process), live:** Public Product OS is `P9_ROLL`. `/housing-market`
is on v3 on main (`b076e15b`). `state.json` / `work-queue.json` are stale (still name
the reverted Market attempt). This working tree has an uncommitted Places + rest-of-Market
migration (`app/**/_v3/`, migration-recipe staged). **Do not `git add -A`. Do not
migrate public families from a broker session.** E1 is already in flight.

**Loop G:** process exists (`content-approve` → `/admin/approval-queue` →
`publisher-sweep` → `/api/social/publish`, GBP included). Last census 2026-08-08:
GBP/LI/X/YT OAuth **EXPIRED**; measured=0; ready ~397 mostly not posts. Production-ready
= Matt reconnects tokens + one generate door + one yes + a live permalink. Paid ads
stay parked. Threads/Nextdoor/Pinterest stay parked.

**Next:** Matt adversarially audits the prompt + answers D1–D6. Then slices
A1 / C1 / D1 / G1 (G1 the day tokens are live). Dedicated public session keeps E.
Do not mix commits with 11F inbox or public `_v3/`.

**Blocked on Matt:** D1 buyer packet; D2 "Parallel"; D3 looking-at-home wake vs Today;
D6 production-ready social set (recommend GBP+IG+FB first); **OAuth reconnect for GBP**.

# Prior — 2026-08-12 (Grok, local) — Broker OS plan v0

`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` is the plan of record for
the stacked brief: copilot, Closings/forms, expired+FSBO first packets, newsletter
buyers + site behavior, Value my home voice, beauty bar. **No product code this
session.** Skills read: admin-product-os, crm-up-to-snuff, crm-e2e, tc-builder,
skyslope-api, skyslope-form-compliance, oregon-real-estate-oref, cma producer,
prospecting/cma-deliver/newsletter-run/listing-alert-care/visitor-escalate/
inbound-respond/broker-alert PDS, TC_SYSTEM, TC_FORMS_LOADING_HANDOFF,
getContactBehaviorSummary, visitors/track.

**Next:** Matt adversarially audits the prompt + answers D1–D5 in the plan.
Implementation amnesia is in: existing code/process is a quarry, not a freeze.
Loop E: public giant push = `run public product` (P9 grind), not a new OS.
Loop F: funnel + SEO/GSC/analytics/AI citation; ads parked; one-generation versioning.
Then first slices A1 / C1 / D1 / E1 / F1. Dedicated public session for E+F.
Do not mix commits with 11F inbox.

**Blocked on Matt:** D1 buyer packet = BPO vs CMA vs ask-first; D2 what
"Parallel" is; D3 is "looking at this home" a wake SMS or Today-only.

# Prior — 2026-08-08 (Claude Code, local) — 11F UNIT 1

`main` @ `ad56f804`, pushed; code commit `4c0186e1` deployed READY (`cli-4c0186e`) and
probed on production. Disk is the source of truth:
`docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`.
Read `progress.txt` from the bottom — the last entry is this one.

**Phase stays `P12_CORRECTNESS`.** All four locks stand; nothing this session reopened one.
11F is the P11 tail and runs alongside P12, not instead of it.

## What 11F actually is, because the name hides it

Phase 11 drove `ci:admin-ui` rule B (legacy pages) to 0 — every admin page imports the
v2 barrel. That is the SHELL. Many of those pages still **mount legacy client islands**,
which the token gate's rule 3 blacklists, so those pages were never inside
`ci:admin-v2-tokens` at all. **Two gates, two different questions:**

| gate | asks |
|---|---|
| `ci:admin-ui` | is the page migrated? (legacy pages · raw elements · widths) |
| `ci:admin-v2-tokens` | inside the *scanned* paths: any raw color, brand leak, legacy import? |

A page can pass the first and be invisible to the second. That gap is 11F.

| | before | now |
|---|---|---|
| admin pages inside the token gate | 86 / 170 | **102 / 170** |
| real pages still outside (excl. 26 redirect stubs) | 58 | **42** |

Ratchets unmoved and unre-seeded: 106 raw elements · 12 widths · 0 legacy pages.

## What the gate was hiding

`#102742` — the **public brand navy**, blacklisted as admin design input since
2026-08-04 — was hardcoded in the agent-activity chart (7 places) and the properties
map (markers, map style, InfoWindow). Every one of those pages *looked* migrated. Both
now resolve `--a-*` off the document at runtime, which recharts and the Google Maps API
both require since neither takes `var()` where it counts.

## Two things to carry forward

1. **Pick the next family by pages-per-shared-island, not page count.** One component
   (`ReportingTabStrip`) blocked 15 pages; migrating it alone unlocked all 15.
   Remaining, largest-first: crm/settings 17 · crm/inbox 12 (one page, twelve islands) ·
   operations 9 · crm 8 · crm/deals 5 · crm/sequences 5.
2. **"This is duplicate nav" is a claim about the RAIL — go read `lib/admin/nav.ts`.**
   The 14-item reporting strip looked exactly like the chrome §5 amnesia exists to kill.
   The rail exposes that family as ONE child; the other 14 reports have no second door.
   Deleting it would have stranded 14 working pages.

## Filed, not fixed

**Dark mode is unreachable.** `ADMIN_UI.md` §6 and the P6 lock both say "ship both from
day one". Nothing in the codebase sets `data-theme` — the attribute appears only in the
two `tokens.css` files. Forcing it pre-hydration proves the admin tokens flip correctly
**and** that `document.body` stays white, so every dark token would paint light-on-white.
`ci:admin-contrast` passes because it computes token *pairs*, not what the body paints.
Queued as `11f-admin-dark-mode-unreachable`.

## One process note

Green gates plus clean `tsc` shipped a phone view that landed with its active tab
scrolled off-screen. It was caught by loading all 15 routes at 375 and asserting the
**active state**, not the status code. Worth keeping in the verification recipe.

# Prior — 2026-08-07 (Claude Code, local) — PHASE 11 COMPLETE

`main` @ `7e6c8cfe`, pushed, deployed READY and spot-checked on production. Disk is the
source of truth: `docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`.
Read `progress.txt` from the bottom — the last three entries are 11C, 11D and 11E.

**Phase is now `P12_CORRECTNESS`.** All four locks stand; nothing this session reopened one.

## The number that mattered

`ci:admin-ui` rule B — a `page.tsx` under `app/admin` that does not import
`@/components/admin/v2` — was the counter the whole phase was built to drive:

| | 11A seed | session start | now |
|---|---|---|---|
| legacy pages | 131 | 86 | **0** |
| raw elements | 251 | 207 | **106** |
| distinct widths | 21 | 19 | **12** |

**86 pages migrated today across 14 families and 32 singletons**, in five waves of
fenced parallel builders, one commit per fence.

## What this surfaced, and it is the real product of the session

Thirteen-plus false claims were living in admin copy. Not typos — statements a
licensed broker would act on:

- **Two named cron jobs that do not exist** (`compute-broker-stats`,
  `compute-market-stats`), each cited as the source of the figures beneath it.
- **Three phantom components** — `LiveTable`, `ApprovalQueueRealtime`, and a "Help
  button" removed two days earlier — each describing behaviour to the broker that
  nothing in the repo provides.
- **An unsourced "industry benchmark of 0.5%–2%"** on the page ad spend is judged from.
- **A count labelled "Active listings" that was off by 2.16×** (a top-50-city
  snapshot sum presented as all active inventory), and **another off by 2.1×** on
  the listing detail page.
- **"Published 87 · Drafts 0"** derived from the wrong column; the real split is
  55 published / 28 archived / 3 draft / 1 pending.
- **A green health tile claiming "FUB leads are flowing"** when `getFubApiKey()`
  has returned `undefined` unconditionally since the June decommission.

And three things that had **never worked**: the BPO preview iframe (a global
`X-Frame-Options: DENY` overrode the route's own `SAMEORIGIN`), the CSV import
status page (Next 15 `params` read as a plain object, so it sat on "Loading…"
forever under a heading reading "Job #"), and a compliance health board
**under-reporting blocked contacts by 3.2×** because a bare `.select()` hit
PostgREST's 1,000-row cap — it would have sailed past its own 25% warn band
without changing colour.

## The lesson to carry into P12

**Builders refused my instructions seven times and were right every time.** All
seven were formatter swaps I had asked for that would have moved a §0 figure.
`formatPrice` rounds to the nearest $1,000 ($332.49 of ad spend → `$0`).
`formatDate` re-projects a date-only string from UTC into Pacific, moving a
printed calendar day back one — twice on a **legal document's** record. And on the
money pages even `formatPriceExact`, which I recommended all session, is wrong:
`financials` branches on `net >= 0`, and on negatives `Math.round` and `Intl`
halfExpand disagree by $1 and move the sign.

The single instruction that caught all seven was **"prove the swap before you make
it."** Write briefs a builder is able to refuse.

Two verdicts also deliberately ship **without counts**, which is that rule
extended rather than broken: `TasksView` completes optimistically without a
`router.refresh()`, and `GlobalActivityFeed` refetches without touching the URL —
so a server-rendered count would be wrong within seconds of the first tap. Do not
state a fact the page cannot keep true.

## A gate was retired, and this is the item to review

`ci:console-kit` encoded Matt's 2026-06-15 directive: every broker-facing console
surface assembled from the shared kit. Over 11C–11E every page on its list moved
to the v2 language, whose acceptance bar forbids `ConsoleSection`, until the list
asserted **nothing**. A gate with an empty list passes trivially and reads green,
which is worse than no gate because it looks like coverage.

**The directive is not retired — its mechanism is.** `docs/MECHANICAL_GATES.md`
gains a *Retired gates* section mapping each clause to the gate that now carries
it, more strictly. Reverse it if you disagree; the reasoning is written down.

## Open, ranked, each with why it was not fixed inline

1. **SECURITY — person/deal scope on entity READERS is a class, three instances.**
   `crm/deals/[id]` fixed; `people/[id]/portal` and `/admin/deals/[key]` open. The
   second is not a one-liner — `getTcDeal` returns only a display name, so it needs
   a decision on what *owns* a TC transaction. `ci:crm-scope` cannot see any of
   them; it inspects writes only. → `task_84b647c1`
2. **Blog edit silently publishes archived posts** — the editor prefills status
   from the wrong column, so saving any of 28 archived posts pushes it live. →
   `task_16114f83`
3. **The audit log renders zero rows to a superuser** (RLS on a cookie-scoped
   read), on a compliance surface. → `task_ff0a4e2c`
4. Readers that swallow errors and return empty, so a failed read is
   indistinguishable from an empty one — a class, ~7 functions.
5. Hydration mismatch traced to `SiteHeader` under `HideChrome`. → `task_af3d76b5`

**Not verified and not claimed:** the populated row paths on
`/admin/signing/[envelopeId]` and `/admin/crm/approvals` (both tables legitimately
empty; inserting a fixture into a legal-document table was the wrong trade), and
`/admin/setup`'s own markup (it redirects here because setup is complete).

## Two process errors of mine, recorded so they are not repeated

- `git commit` commits the **index**, and a parallel builder had staged its own
  files — one commit swept in seven pages under a message that did not describe
  them. Caught pre-push and split.
- `git commit --only <paths>` does **not** pick up untracked files, so one commit
  landed importing two files it did not contain. With parallel builders creating
  files, `--only` needs an explicit `git add` of the new paths first.

## Next

Queue top is `12-person-scope-class`. `scripts/_admin-v2-verify.mjs` is the
harness the next session inherits — it mints its own magic-link session and
asserts 200 / exactly one `<main>` / no page-level horizontal scroll at 375 and
1280, and it reports a redirecting route instead of dying on it.

# Prior — 2026-08-07 midday (Claude Code, local) — 11C + 11D

`main` @ `2843c492`, pushed. Last CODE commit `e8871f2a` deployed READY (the tip is
docs-only and correctly skipped by `vercel.json`'s `ignoreCommand`). Disk is the
source of truth: `docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`
plus the plan of record `PHASE-11-PLAN.md`. Read `progress.txt` from the bottom.

**All four locks stand.** Nothing in this session reopened one. The one IA change —
a third tab on `geo/layout.tsx` — is interior nav inside a single family, flagged in
its commit for post-hoc review, and no cut-list route was resurrected.

## What shipped: 18 commits, `104a459b..2843c492`, three deploys READY

| ratchet | start | now |
|---|---|---|
| legacy pages | 86 | **32** |
| raw elements | 207 | **138** |
| distinct widths | 21 | **17** |

**54 pages across 14 families.** Every MULTI-PAGE family is now on v2 — media,
newsletters, brokers, crm/import, geo, crm/deals, bpo, cmas, reports (11D),
crm/sequences, email, signing, people portal+tools, sync, help, listings, visitors.
The 32 that remain are all singletons.

Two pieces of architecture landed before the migration, both to stop drift:
- **One tabular reader.** Three had accumulated (one per already-migrated family) and
  every queued family was tables too, so migrating as-is would have produced readers
  four through eight. `ReportGrid` moved into `components/admin/v2` and is now the
  admin's only one; analytics' `DataGrid` + `kit` are the remaining third (queued).
- **`EntityTitle`.** ADMIN_UI rule 1 bans page-title chrome but grants an exception
  for an entity page's own name, and that exception had no home — every entity page
  was hand-rolling a raw `<h1>`.

## Defects this found (all pre-existing, all proven so before being touched)

- **`/admin/crm/deals/[id]` had no broker-scope guard** — a restricted broker could
  walk sequential ids and read any deal's GCI, commission percent and split rows.
  FIXED. It is one instance of a CLASS; see the open item below.
- **`/admin/crm/import/[id]` had never shown a job** — Next 15 `params` Promise read
  as a plain object, so every visit sat on "Loading…" under "Job #" with no number.
- **The BPO preview iframe had never rendered** — the route sets `SAMEORIGIN` but
  `next.config.ts`'s global `DENY` overrode it; `/cma/` had the exception, `/bpo/`
  did not. Confirmed fixed on production.
- **Thirteen false claims in page copy**, including two named cron jobs that do not
  exist, an unsourced "industry benchmark" on the page ad spend is judged from, a
  "Help button" removed two days earlier, a "LiveTable" component that is not in the
  repo, and a count labelled "Active" that was off by 2.1× (top-50-city snapshots
  vs. all Active rows). Figures unchanged; the words now match the query.
- **Phone bugs:** a 496px overflow on broker-edit, a 6px overflow on `/admin/audiences`
  (a P9 destination, fixed in the shared primitive), and an email toolbar that
  `ConsoleSection`'s `overflow-hidden` was silently clipping so its buttons were
  unreachable at 375.

## The lesson worth carrying into 11E

**Builders refused my instructions four times and were right every time** — all four
were formatter swaps I had asked for that would have moved a §0 figure. `formatPrice`
rounds to the nearest $1,000; `formatDate` re-projects a date-only string from UTC
into Pacific, moving a printed calendar day back one and, on one instant, the year.
Two were on a legal document's record. The instruction that caught them was *prove
the swap before you make it*. Write briefs a builder is able to refuse.

**And a process error to not repeat:** `git commit` commits the INDEX, and a parallel
builder had staged its own files, so one commit swept in seven pages under a message
that did not describe them. Caught before pushing and split. Use
`git commit --only <paths>` whenever builders share a tree.

## Open, and why each was not fixed inline

- **SECURITY — person-scope on entity READERS is a class, not an instance**
  (`task_84b647c1`). `people/[id]/portal` gates only on `requireAdminPage('people.view')`
  and that capability includes `broker`, so any broker reads any contact's saved and
  hidden homes, named areas, alert recipients and site activity. The `people/[id]`
  identity header is also unscoped. `ci:crm-scope` cannot see either — it inspects
  WRITES only. Needs a DAL reader, a shared guard, a sweep, and an AST gate.
- `getCmaAdminRowBySlug` swallows its Supabase error, so a transient failure renders
  as "this CMA does not exist" — ~20 callers on send/publish paths (`task_cc5d6fc3`).
- The navy `MobileCrmHeader` violates §5 amnesia on three CRM phone surfaces
  (`task_b5a50db5`).
- The intermittent admin hydration mismatch is TRACED to `SiteHeader` under
  `HideChrome` (`task_af3d76b5`) — it fires on already-v2 surfaces this session never
  touched.

**Not verified and not claimed:** `/admin/signing/[envelopeId]`'s rendered identity
header. `tc_envelopes` holds zero rows, and inserting a fixture into a legal-document
table was the wrong trade. Its `notFound()` path and Next 15 `params` signature were
verified.

## Next unit: `11e-singletons` (queue top)

32 pages, no family structure left. Batch by RISK, not directory: the
send/compliance-adjacent ones (`crm/inbox`, `crm/approvals`, `approval-queue`,
`sign-off`, `crm/tasks`, `crm/calendar`) apart from the read-only ones. Look at
`access-denied`, `login` and `setup` before migrating them — they are auth-flow pages
and may not want the console shell at all.

Tooling the next session inherits: `scripts/_admin-v2-verify.mjs` mints its own
magic-link session and asserts 200 / exactly one `<main>` / no page-level horizontal
scroll at 375 and 1280. It was validated in both directions before use.

# Prior — 2026-08-07 earlier (Claude Code, local) — P11 11A + 11B

`main` @ `4efbebca`, pushed, production READY. Disk is the source of truth:
`docs/plans/ADMIN_PRODUCT/{state.json,work-queue.json,progress.txt,decisions.md}`
plus the plan of record `PHASE-11-PLAN.md`.

**All four locks granted** (process 08-04, IA 08-05, visual 08-05, litmus re-timed
08-07). Phase `P11_INTERIOR`. P1–P10 shipped the spine: 11 destinations, v2
primitives, the §5 chrome. P11 is the interior — making that spine the ONLY admin.

Shipped since the last handoff:
- `82e14a42` — CMA/BPO signing: the lead's ASSIGNED broker signs, Matt is the
  fallback. Every document had been signing as Matt (the join is `brokers.crm_slug`,
  not `slug`). Compliance-adjacent; 3-lens adversarial panel caught 4 more defects.
- `1f0f537e` — 11A gates: `ci:admin-ui` (G65) AST ratchet (251 raw elements, 131
  legacy pages, 21 widths — shrink-only), axe WCAG 2.2 AA across 148 admin routes
  (`e2e/axe-baseline.json`, 51 routes with violations), visual regression per
  destination.
- `f7fbf72d` — 11B: the person workspace folded onto `/admin/people/[id]` (Messages
  + canonical composers, Send, Details, Tasks, Homes, Notes); legacy workspace
  relocated to `/admin/people/[id]/tools`; `/admin/crm/[id]` is a query-preserving
  bridge; ~45 deep-link producers repointed; admin chrome de-branded (phone wordmark
  bar removed, desktop navy top bar replaced with the locked 216px left rail).
- `4efbebca` — litmus re-timed on production: 4.4s broker-action, ONE tap, address
  auto-prefilled, idempotency proven on a real double-tap. Fixtures cleaned to zero.

**Next unit: `11c-crm-tree`** (queue top). 57 remaining `/admin/crm` pages, ordered by
the weekly-use evidence in `decisions.md`, one family per commit. FIRST item: restyle
the two deliberate 11B holdouts — ContactSendCenter's black send bar and the
quick-action FAB. Both are send chokepoints mounted as-is; restyle WITHOUT touching
the send path.

To run it: fresh session, `/model claude-fable-5`, paste
`docs/plans/ADMIN_PRODUCT/PHASE-11-EXECUTE-PROMPT.md`. It orients from disk.

Do not reopen a lock. Do not resurrect a cut-list route. Amnesia covers SHAPE
(naming, nav, groupings), not just pixels.

# Prior — 2026-08-04 (Claude Code, local) — Admin Product OS

`main` @ `36df337f`, pushed. The Admin Product OS ran BOOT → P1 → all of P2 in one
day. State lives on disk, chat is disposable:

- `docs/plans/ADMIN_PRODUCT/state.json` — phase `P3_PROCESS_LOCK`, `awaiting_lock: process`
- `docs/plans/ADMIN_PRODUCT/decisions.md` — **the P3 decision package awaiting Matt**
  (verdict table 15 KEEP / 4 MERGE / 1 thin / deal-track = his call, 7 fix-the-class
  improvements, 5 open questions). A lock counts ONLY when written into this file.
- `docs/plans/ADMIN_PRODUCT/processes/` — 21 complete PDS files, file:line-cited
- `docs/plans/ADMIN_PRODUCT/SESSION_BOOT.md` — resume ritual for any agent/tool

Next unit (any tool): NOTHING until Matt writes the process lock into decisions.md;
then advance state to P4_DATA and build the data atlas for KEEP processes only.
Do not start IA (P5) or visuals (P6) — locks do not exist yet.

# Prior — 2026-08-03 (Claude Code, local)

Every item on the 2026-08-02 website-audit roadmap is now closed or explicitly
blocked on Matt. `main` @ `03f2f5d6`, full `ci:gates` chain green, deployed.

## The sitemap P0 is finally closed, and why four passes missed it

Production, sequential, measured after deploy:

```
core.xml      200    0.96s     159 urls
geo.xml       200  106.22s   2,728 urls   <- the one cold universe build
content.xml   200    0.23s      56 urls
listings.xml  200    0.60s   7,555 urls
matrix.xml    200    0.18s     296 urls
```

Before: four of five returned 504 at the 300s ceiling.

The cause was never caching. `buildAllUrls` reached
`get_subdivision_status_counts` (an unindexable `TRIM("City") ILIKE`, 104.7s for
eight cities) through THREE separate paths, and each earlier pass fixed a subset:

1. the browse-pair loop
2. `getIndexableSubdivisions()`, called 15 lines later
3. `getSearchMatrixSitemapEntries` -> `getSearchMatrix` -> `getSearchMatrixInventory`

All three now read `listing_tile_mv` on the indexed `city_lower`. Equivalence was
proven against production for each, not assumed: the indexable set is 502 both
ways with symmetric difference 0, and the search-matrix path matches on 2,205 of
2,210 shared keys with every divergence individually traced.

**A separate and more serious bug surfaced doing it.** Concurrent `range()`
pagination with no `ORDER BY`. Postgres guarantees no stable row order across
separate OFFSET/LIMIT queries. Measured on Bend's 129,192 MV rows:

```
ORDERED     129,192 rows, 129,192 unique, 0 duplicates
UNORDERED   129,192 rows, 106,000 unique, 23,192 duplicates
```

18% of rows returned twice, so an equal number were never seen. Against a
lifetime-sales floor that means a subdivision near the threshold was admitted or
dropped at random per build, silently. Both readers now order by
`(address_slug, listing_key)`.

## Items 9, 10, 11 — the content program

- **11:** all 27 configs rewritten. 4,900 words to **18,859**, median 181 to 708,
  **0 sources to 285**. Not one market figure in the prose: live components own
  every number, static copy owns only durable facts, and **G33b enforces that**
  rather than trusting it. Four frozen market claims were removed from tetherow
  that had been live, including "Active inventory today: 15 homes from $759K to
  $4M".
- What the authors REFUSED to write is the best part: a disputed 1989-vs-1991
  course opening cut entirely, a different Three Rivers in Jefferson County
  caught and excluded, an acreage dropped because the source's own numbers do not
  add up, school attendance zones cut for lack of a boundary document.

## Everything else

| # | State |
|---|---|
| 1-8 | closed 2026-08-02 |
| 9, 10 | dated citable pages + answer-shaped headings, shipped |
| 12 | `/data/market/[geoType]/[geoSlug].json`, live, cross-checked against the HTML |
| 13 | Dataset coverage measured and filled |
| 14 | outbound citations via one shared `MarketSources` component |
| 15 | `/faq` emitted NO FAQPage JSON-LD at all. Fixed, plus 11 standalone child pages |
| 16 | payload ratchet gate wired beside route-smoke |
| 17 | `docs/press/` artifact + generator + pitch draft. **NOTHING SENT** (§1 class 1) |
| 18 | `/months-of-supply` as a DefinedTerm with live figures |
| 19 | `PROFILE_CONSISTENCY_2026-08-03.md` + correction packet. **NO OAuth** (§1 class 4) |
| 20 | `/housing-market/annual-review`, Dataset + Article schema |
| 21 | closed 2026-08-02 |

## Open for Matt

1. **Send the press pitch** (`docs/press/pitch-email-draft.md`). It uses
   placeholders deliberately: no verified reporter contact exists in the repo and
   inventing one is a §0 violation. Look up the real byline first.
2. **The GBP / Zillow / Yelp corrections** in the profile packet. Each needs an
   OAuth grant, which is yours alone.
3. **Promote Lighthouse perf/LCP from warn to error** after 2-3 real PR runs. The
   thresholds carry an estimated CI-hardware allowance no local run can validate.
   A11y/SEO/CLS/best-practices already block.

## Known gaps

- **A cold `geo.xml` still costs 106s.** One build instead of three RPC sweeps,
  well inside the 300s ceiling, but the universe build itself is still heavy.
  Making a single build cheap is the next real improvement.
- **Best Practices is pinned at 0.74 sitewide** by the AdSense script, which loads
  from the root layout on every page while only `/activity` and `/resources`
  render an ad unit. Named, not fixed: scoping it is revenue-touching.
- `tetherow`'s `amenities` array had a restaurant that closed (Solomon's became
  Coorie in 2026). Fixed here, but it suggests other configs carry stale
  amenity entries that no gate checks.
- `scripts/check-listing-detail.mjs --json` throws on an undefined `listingKey`.
- CrUX and PageSpeed APIs are now enabled on the `ryanrealty` project, so field
  Core Web Vitals are reachable for the first time. Nobody has pulled them yet.

> **Superseded: audit follow-through — sitemap P0 actually fixed, CI root-caused, GSC/GA4 measured (2026-08-02, Claude Code local).**
> Picks up and closes the "Open for Matt" list from the cloud session below.
> Prior: website audit + remediation + CI unblock (2026-08-02, cloud); CMA/report depth (2026-07-30).

## Prior — 2026-08-02 (Claude Code, local session)

| Field | Value |
|---|---|
| Surface | Claude Code, local, in a git worktree at `.claude/worktrees/audit-e2e` |
| Branch | `claude/ryan-realty-website-audit-sybjq3`, 24 commits ahead of `main` |
| Why a worktree | `main`'s working tree had a **live sibling session** with 53 uncommitted paths, two files touched 2 minutes before this session opened. Checking out or stashing there would have destroyed work in flight |
| Credentials | Supabase service role, GSC (`siteOwner`), GA4 (`527333348`) — the three the cloud container lacked |

## Three things the cloud session could not know

**1. The sitemap P0 fix did not work.** It was the highest-value unverified item.
Measured against a real production build:

```
core.xml   http=200  234.7s  159 urls
geo.xml    http=000  280s    0 bytes    <- requested immediately after
```

The shared-universe memo stamped freshness when the build **started**, with a 60s TTL against
a 115–235s build. It expired before it ever resolved, so every sequential request rebuilt from
scratch. It was verified against five *concurrent* cold requests, where single-flight genuinely
works — but Googlebot fetches children sequentially and the warmer loops. Now stamped on
resolve, extracted to `lib/sitemap-universe-memo.ts` with 6 regression tests. Verified:

```
core.xml     200  127.8s     159    <- the one universe build
geo.xml      200    0.014s  2566
content.xml  200    0.007s    56
listings.xml 200    0.016s  7574    <- had NEVER served
matrix.xml   200    0.006s   296
```

**2. The three-month CI failure has a root cause.** `middleware.ts` `BAD_BOT_RE` blocks
automation User-Agents and contains `axios`. `start-server-and-test` waits via `wait-on`, which
is axios-based. Every readiness probe got 403, `wait-on` accepts only 2xx, so it timed out after
five minutes printing "Timed out waiting for". The app was healthy throughout. The replacement
probes went green only because Node's `fetch` sends `User-Agent: node` and someone picked
`rr-smoke/1.0` — neither on the block list, by coincidence. Gate **G60** (`ci:probe-ua`) now
reads the live regex out of `middleware.ts` via the TypeScript AST and fails if it would ever
screen the probe UA. It found 12 more CI probes riding the same accident.

The screen itself is correct: every AI crawler `robots.txt` invites returns 200 in production.
This was never a discoverability defect.

**3. Two of the audit's conclusions do not survive real data.** See
[`MEASURED_METRICS_2026-08-02.md`](../audits/MEASURED_METRICS_2026-08-02.md).

- **The sitemap's stated impact was wrong.** Search Console shows all five children downloaded
  with zero errors, `listings.xml` carrying **7,660 URLs on 2026-08-01**. Google was never
  missing listing pages. The defect was real; the impact claim was not.
- **"Zero non-brand discoverability" is the wrong diagnosis.** GSC over 28 days: **35,451
  impressions, 467 clicks, CTR 1.32%, average position 14.5**, across 1,776 named queries of
  which 1,769 are non-brand. The site is not absent, it is on page two — **83.4% of named-query
  impressions sit at position 11 or worse**. (Coverage caveat: those 9,523 impressions are 27%
  of the total; Google withholds rare queries.)
- **And one finding that argues FOR the audit, harder than the audit did:** 7 of the top 20
  pages are blog posts, holding positions 4.5–8.9 against 14.5 site-wide. The single best URL is
  long-form editorial about a named community. That is audit items 9–11 evidenced from Ryan
  Realty's own traffic instead of from competitor inference.

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **CI root cause + gate G60** | `c6defa1b` | Verified 4 ways: passes at 15 probes, fails when a probe drops the UA, fails when `BAD_BOT_RE` is tightened onto it, keeps a known false positive out |
| **GSC + GA4 measured (item 21)** | `3f3e1072` | `scripts/measure-search-and-analytics.mjs` reproduces every figure in the doc |
| **Sitemap P0, actually fixed** | `aa56d308` | Sequential sweep above. 6 tests, negative-tested |
| **`/admin/media/banners` 38.2s → 0.5s** | `ae42b045` | 277,415 rows → 3,344; 284 round-trips → 14. Output deep-compared byte-identical across 13 cities / 789 subdivisions. Back in the smoke set: **277/277, zero skips** |
| **pa11y 0/8 → 8/8** | `a7451039` | Real rebuild, 0 errors on all 8 URLs. Three causes separated: contrast, map markers, third-party iframes |
| **Lighthouse thresholds calibrated** | `a7451039` | 40+ real passes. Perf ≥0.90 was unachievable on 7 of 8 routes; SEO and CLS could never fail |
| **§0: Coming Soon counted as "for sale"** | `f4763138` | Bend 1,288 shown vs 1,272 correct. 16 pre-marketing listings on a public surface |

## Phase 2 (evening) — items 1-4 and the §0 formula violation

Matt: "Yes on 1-3 and do number 4."

| Item | State |
|---|---|
| **§0 wrong formula, live** | **FIXED.** `components/site/CityComparisonTable.tsx` footnoted a 30-day-doubling months-of-supply method beside a number computed with the 6-month formula, on every subdivision market page. Now renders `MOS_METHODOLOGY_CLAUSE`. `ci:market-formula` scanned only `app/` + `lib/`, which is exactly how the string its own docblock names got shipped; it scans `components/` as of this commit |
| **1. Coming Soon migration** | **APPLIED and verified in production.** Bend Hot-communities for-sale sum **1,266 → 1,251**, exactly the 15 Coming Soon rows removed, and the post-apply sum equals an independently computed corrected predicate (1,251 = 1,251) |
| **2. CrUX** | **ENABLED and measured.** CrUX + PSI APIs on the `ryanrealty` project, key restricted to those two, in `.env.local` as `GOOGLE_CRUX_API_KEY`. CLS **0.00** good, TTFB **292 ms** good, LCP **2,692 ms** needs work |
| **3. Blocking gates** | **DONE.** Lighthouse + pa11y drop `continue-on-error`. A11y/SEO/CLS/BP at error, perf/LCP at **warn** until real runner samples validate the estimated CI headroom. Proves out on the next PR |
| **4. Items 9 + 10** | **DONE.** Answer-shaped H2 and a real freshness stamp on every geography page |
| **4. Item 11** | **NOT STARTED.** 27 long-form editorials. See below |

### The LCP finding, and the fix that came out of it

CrUX did not just give a score, it named a cause: **1,239 ms of the 2,692 ms LCP
is image resource LOAD DELAY** — 46% of the metric elapsing before the hero
request even starts. TTFB is 292 ms, so never a server problem.

Root cause: `app/layout.tsx` preloaded `/images/hero-poster.webp` at
`fetchPriority=high` on every route, and **nothing renders that file as a hero**
(it is a pulse brand card, 12 KB). The hero the site actually paints is
`poster="/images/hero/hero-old-mill-master-4k.jpg"`, **685 KB, with no preload
at all**, discovered only when the parser reaches the `<video poster>`
attribute. Top priority went to an image the browser would never display.

Fixed: dead layout preload removed, `KbHero` preloads its OWN `posterSrc`
(per-route, so the shared layout cannot know which hero a route paints). The LCP
number can only be re-measured after CrUX accumulates a new 28-day window, so
the improvement is deferred by design, not skipped. **685 KB is still heavy for a
poster** — named, not fixed, because the measured defect was load DELAY not load
DURATION.

### Items 9 + 10, verified in rendered HTML

`KbMarketHud` gained a `geoName` prop. Every geography section heading is now the
question a reader types, with the answer directly beneath:

```
/cities/bend              "Is Bend a buyer's or seller's market?"
                          -> Seller's market -> 3.7 months of supply   (3.7 <= 4, canon)
/communities/tetherow     "Is Tetherow a buyer's or seller's market?" -> Buyer's market
/cities/bend/awbrey-butte "Is Awbrey Butte a buyer's or seller's market?"
                          all three: "Updated 9:19 PM" from the pulse row
```

`buildMarketFaq` already generated that exact question but only as an h3 far down
the page in the FAQ block. It falls back to the old heading when there is no
verdict, because a question with no answer under it is worse than a label.

Only the homepage passed `asOf` before; the other six showed a ticking wall clock
over a 10-15 minute cache. `/zip` is a deliberate exception: no pulse binding in
scope, so it gets the heading and no stamp rather than a fabricated one.

### Item 11 — not started, and why

27 pieces (13 Bend neighborhoods, 14 content-configured resort communities). This
is authored content, every figure needing a §0 trace, landing on public marketing
surfaces under a principal broker's license. Starting it at the tail of a long
session would produce filler. Three things a future session should know first,
from the recon:

- **13 Bend neighborhoods, not 14** (`lib/neighborhood-areas.ts:24-38`). 19 resort
  communities registered, 14 with content configs; the other 5 are the G33 backlog.
- **55 published blog posts, not 12.** Ten are Community Spotlights covering the
  same geographies, so item 11 collides with them unless canonicalized or repurposed.
- **The two pages you would extend are frozen**: `housing-market/[...slug]` (898)
  and `communities/[slug]` (923) are pinned by the file-size ratchet.
- Existing prose is 113-298 words per community in `data/resort-community-*.json`,
  rendered by `KbResortOverview`, gated by G33 (`ci:community-content`).

## Open for Matt

1. **Apply migration `20260802120000_subdivision_status_counts_exclude_coming_soon.sql`.**
   Committed but NOT applied — it needs the migration channel. Until it runs, `/cities/[city]`
   still shows the inflated for-sale count. This is the only §0 item outstanding.
2. **Enable the Chrome UX Report API** (or PageSpeed Insights API) on the `ryanrealty` Google
   Cloud project. Core Web Vitals field data is the last audit metric still unmeasured — CrUX
   403s on the Maps key and the anonymous PSI quota is exhausted. Both are free.
3. **Flip Lighthouse and pa11y to blocking?** Recommendation, with measurements behind it:
   accessibility, SEO, CLS and best-practices are safe to block now. Performance and LCP should
   watch 2–3 real PR runs first, because their headroom is an estimate against CI hardware that
   could not be timed from here.
4. **Audit items 9–11 still need your go-ahead** — dated citable market pages, answer-shaped
   H2s, long-form editorial for the 14 Bend neighborhoods and 14 resort communities. Deliberately
   not started: they are content programs, every figure needs a §0 trace, and they land on public
   marketing surfaces under your license. The GSC data above is now the strongest argument for
   them.
5. **AdSense caps Best Practices at 0.74 on every page** — the script loads sitewide from the
   root layout but only `/activity` and `/resources` render an ad unit. Scoping it is a
   revenue-touching product call, so it is named, not changed.

## The sitemap P0 is improved but NOT closed in production. Read this before touching it.

Three passes have now been made at this, two of them by me, and **all three treated a symptom.**
The real cause was measured at the end and is recorded here so the fourth pass starts in the
right place.

**What is fixed and proven:** the memo TTL bug (freshness stamped at build start against a
60s TTL), and the warmer, which fetched the five public URLs over HTTP on the stated theory that
the in-flight dedupe would collapse them onto one build. It cannot: each fetch is a separate
lambda invocation with its own module scope, and sequential calls have no in-flight overlap
anyway. The warmer now calls `getClassRows()` in-process, where the memo genuinely applies.

**Production state right now, measured on the deployed commit, sequential, cold:**

```
core.xml      504  300.6s
geo.xml       504  300.6s
content.xml   200  146.7s   <- one build fit, on a warm instance
listings.xml  504  300.2s
matrix.xml    504  300.6s
```

**The actual cause: `get_subdivision_status_counts`.** `buildAllUrls` calls it once per report
city. Timed directly against production:

```
Bend        41,254ms      Prineville   1,410ms
Redmond     14,644ms      Madras       4,685ms
Sisters     31,959ms      Terrebonne   3,534ms
La Pine      4,317ms      Sunriver     2,940ms
                          TOTAL 8 cities: 104.7s
```

That is 104.7s for eight cities before the paginated listings scan, zips, blog and reports are
added, and there are more cities than eight. The RPC does
`WHERE TRIM("City") ILIKE TRIM(p_city)` over a 589K-row table — an unindexable expression, the
same class of defect commit `5bc16122` fixed for search (11.1s to 1.4s) by letting the planner
reach the city index.

**No amount of cache engineering fixes a 100s+ build.** The fourth pass should make the build
cheap, not cache it better: source the subdivision list from `listing_tile_mv` (already indexed
and already used elsewhere) instead of this RPC, or give the RPC an index the planner can use.
Until then, `core.xml` will keep hitting the 300s ceiling on a cold lambda.

Worth noting the audit recommended "build per class directly instead of building-all-then-
filtering" and PR #28 dropped it. That recommendation was right.

## Known gaps
- **`fetchAllRows()` swallows per-page errors** (`lib/supabase/paginate.ts` destructures only
  `{ data }`). A mid-pagination timeout silently truncates the result for every caller, with no
  error surfaced anywhere. Found while fixing the banners page; not fixed, blast radius is wide.
- **`scripts/check-listing-detail.mjs` references an undefined `listingKey`** in its `--json`
  path — `node scripts/check-listing-detail.mjs --json` throws. Pre-existing.
- **`npm run ci:lighthouse` never invokes `scripts/pick-lhci-listing.mjs`** despite that file's
  comment claiming it does; there is no `preci:lighthouse` hook. The hardcoded fallback listing
  currently resolves, so it has not bitten.
- **A sign-in modal auto-opens on page load** on `/team` and listing detail. Outside WCAG2AA so
  pa11y did not flag it; its focus management is unexamined.
- **`includeWarnings: false`** in `.pa11yci.json` suppresses every WCAG warning-level notice.
  Nobody has looked at what is in that set.
- **`ci:css-layers`'s baseline is keyed by `path:line selector`, so it is line-drift fragile.**
  Adding a comment above an existing offender shifts its line number and the ratchet reports it
  as a NEW violation. That happened here: the `.topbar` scrim comment shifted 10 identical
  pre-existing rules by 2 lines and failed the push, with the offender count unchanged at 11.
  Regenerating was correct (diff is line numbers only, same selectors, same count) but every
  future edit above line 76 of `kb.css` pays the same tax. G56 already solved this class with
  per-file counts described as "line-drift-proof"; this baseline should adopt the same keying.

# Superseded — 2026-08-02 (Claude Code, cloud session)

| Field | Value |
|---|---|
| Surface | Claude Code on the web (remote container) |
| Branch | `claude/ryan-realty-website-audit-sybjq3` @ `57907d7`, 17 commits, pushed |
| PR | [#28](https://github.com/RyanRealty/RyanRealty/pull/28) — **draft, not merged** |
| CI | `lint-and-build` **green** — first green PR check in this repo in ~3 months |
| Base | branched from `main` @ `db53778` |

**To pick this up locally:**

```bash
git fetch origin claude/ryan-realty-website-audit-sybjq3
git checkout claude/ryan-realty-website-audit-sybjq3
npm ci
```

Read `docs/audits/WEBSITE_AUDIT_2026-08-02.md` (the audit) and
`docs/audits/AUDIT_REMEDIATION_PROGRESS.md` (what was fixed, what was deliberately not, and
why). Those two files are the durable record; this section is the summary.

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Independent website audit** | `8b981a9` | Full report. Core finding: ryan-realty.com appears in **0 of 4** high-intent non-brand queries while 8 competitors with slower, less structured sites occupy every slot. Technically the site is ahead of all of them (TTFB 0.25–0.64s vs 2.0–2.4s; 2 JSON-LD blocks vs 0–1). The gap is distribution, not engineering. Three premises in the original brief were tested and disproven (the site is SSR, not CSR; the brief's URL list was stale; NAP is consistent) |
| **Sitemap P0** | `fbf512e` | 3 of 5 child sitemaps returned HTTP 000 / 0 bytes after 100s, reproduced 4×. `unstable_cache` keys per class, so a cold cache meant 5 independent `buildAllUrls` fan-outs contending on the same tables. Fixed with `maxDuration`, an in-flight promise collapsing them to one build, and an hourly cron warmer. **NOT yet verified in production — needs the merge** |
| **Broker canonicals P0** | `fbf512e` | 5+ alias URLs per broker, each self-canonicalising. `generateMetadata` built the canonical from the requested slug; the page body had the same bug feeding JSON-LD |
| **Titles / descriptions / redirects / preconnect / AggregateRating** | `fbf512e` | Descriptions were hard-cut mid-word at 155 chars (`/sell` ended "Request a fr"). `/buyers` 404'd while `/sellers` redirected. Self-serving `AggregateRating` dropped, `Review` nodes kept |
| **Punctuation rule actually enforced** | `e7580a8` `bb9fd37` | `VOCAB.PUNCTUATION` was exported and referenced **zero times** by the gate. CLAUDE.md §6 listed it as gated; nothing checked it. That is how an em dash reached the layout title template and shipped on all 20 page titles |
| **Dash rule scoped to prose** (Matt, 2 corrections) | `c2b9a5e` `ae19c3f` `6bf30b1` | "Em dashes are fine in page titles for SEO", then "the rule only applies to text users read that might seem AI-written". Now: 8+ words with a 4+ word clause after the dash that **starts lowercase** (a continuing sentence is the tell; a capitalised or numeric start is a separator). Exempt: SEO metadata, short labels, alt/aria, ranges, reviews, debug, embedded CSS/JS |
| **CI unblocked** | `7cd86a5` `b326fd3` `6fe2668` `a2e60d0` `45552a0` `57907d7` | Five independently broken things, each hidden behind the one before it. See below |

## The CI story — five layers, none caused by this work

`lint-and-build` had failed on **every** pull request since at least 2026-07-25 (verified on
unrelated branches). `main` looked green only because the route-smoke step is gated on
`github.event_name == 'pull_request'` and never runs on push.

1. **`start-server-and-test` hung 5:02 with no diagnostics** — its entire failure output was
   "Timed out waiting for". Replaced with explicit start / wait / smoke;
   `scripts/wait-for-server.mjs` reports what it saw on each probe. The app was never the
   cause: a production build serves `/` in 0.55s and passes 277/277 routes.
2. **The route-inventory generator threw on every run** — it regexes `lib/cities.ts` for a
   `PRIMARY_CITIES` literal, which now only re-exports from `lib/data/geo/report-cities.ts`.
   So `docs/ROUTE_INVENTORY.md` was 2 weeks stale with 2 dead admin routes in it
3. **`ci:lighthouse` and `ci:a11y` never existed** as npm scripts. Both quality gates had
   never executed once. Tooling and configs were always present; only the script names were
   missing
4. **Admin pages exceeding the smoke timeout** on a cold cache. Budget now splits public (15s)
   vs admin (60s); `/admin/media/banners` is skipped and printed as `[SKIP]` every run
5. **The bundle report lacked `pull-requests: write`** — no `permissions` block, so the token
   was read-only

Two of those rounds were my own errors, recorded so nobody repeats them: a per-route timeout
that made things *worse* (274/277, down from 276/277), and a teardown step that killed the
runner (`kill -- -$PGID` — background jobs inherit the runner's process group).

## Open for Matt — what finishing needs

1. **Merge PR #28.** The sitemap P0 fix is unverified in production. Logic and gates pass, but
   `listings.xml` / `matrix.xml` returning real XML can only be proven after the merge. Highest
   value item still unconfirmed — it is what makes listing pages discoverable.
2. **Credentials the cloud container did not have:**
   - `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — needed to measure and fix
     `/admin/media/banners`, which takes **>60s on a cold cache**. That is what a broker hits,
     not just CI. The fix belongs in `listMissingBanners` / `getSubdivisionsInCity`; it was
     deliberately not attempted blind
   - **GSC + GA4** — converts the audit's proxy metrics (indexation, backlinks, traffic,
     CWV field data) to measured, and is how the roadmap gets proven
3. **Three decisions:** flip Lighthouse + pa11y to blocking? Investigate pa11y's
   **`0/8 URLs passed`** on its first real run? Restore `/faq`'s double em dash or leave it?
4. **Go-ahead on audit items 9–11** — dated citable market pages, answer-shaped H2s, long-form
   editorial for the 14 Bend neighborhoods + 14 resort communities. This is the work that
   actually moves LLM discoverability. Items 17–20 (press outreach) and 19 (GBP/Zillow/Yelp
   OAuth) need per-action approval under §1 regardless

## Known gaps

- **pa11y reports `0/8 URLs passed`** — real WCAG2AA signal or untuned config, unread. Surfaces
  as a step success only because it is `continue-on-error`
- **Lighthouse ran to completion but its thresholds are unvalidated.** Non-blocking, so a
  threshold failure would look like success in the step list
- **`/admin/media/banners` >60s cold**, skipped in the smoke rather than fixed
- **Audit items 9–21 untouched.** Content and authority programs, not coding tasks. Reasoning
  per item is in `AUDIT_REMEDIATION_PROGRESS.md`
- The regenerated route inventory drops 5 live-but-catch-all routes (`/cities/tumalo`,
  `/cities/crooked-river-ranch`, `/housing-market/explore`, `/reports/explore`, `/guides`) from
  the smoke set. None has its own `page.tsx`. Widening the generator's slug sources would
  change what the inventory means — left as Matt's call


## Prior — 2026-07-30 (Claude Code)

| Field | Value |
|---|---|
| Surface | Claude Code |
| `main` @ | `1e647e67` pushed, 190 gates green, 340 test files / 4257 tests passing |
| Prior plan | [`PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md`](PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md) — the 18 Brain Dump 2 items, all closed |

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Zoning, development, rental, income sections** | `9f061b0b` | Every CMA/audit/BPO now answers: what zone the property is in, whether the lot can be subdivided, whether additional units or an ADU are allowed, what a buyer could develop, HOA and CC&Rs, and long-/mid-/short-term rental rules with income potential. Five legally wrong facts were corrected during the build, including the Deschutes WA overlay (40/160/320 acres, independently verified) which would otherwise have told a seller a 160-acre parcel supports 4 divisions when it supports 1 or zero. |
| **Report rebuild + truncation fix** | `9f061b0b` | `.page` was fixed at 11in with `overflow:hidden`, so any section taller than a page was silently cut — the rental page measured 196% of its page. Long sections now chunk ("Renting It Out 1 of 3"). 922 Ogden renders 29 sections / 237,313 bytes. |
| **Published CMA on listing pages** | `618754b8` | Broker-operated publish control on the review page. Three states; the confirm dialog splits what becomes public from what stays private. **The recommended list price and every sold comp stay private.** Verified as matt@ against the real DB: publish → listing page renders the range with the ODS §7-3 period notice → take-down removes it and kills outstanding download tokens. Left `published_now = 0`. |
| **Comps must match product type** | `83a50f89` `6354d87f` | `PropertyType='A'` is the SFR convention but it is a *bucket*. Measured on 1,000 closed Bend sales: 818 Single Family Residence, 75 Townhouse, 43 Manufactured On Land, 22 Condominium, 3 Tenancy in Common. **14.3% of the pool offered to a detached subject was a different product and the selector took it.** On 922 Ogden that put two townhomes into a 4-comp detached analysis behind a $640,000 recommendation the auditor called indefensible. Now a hard exclusion at every tier, fail-open on unknown, locked by tests. |
| **A degraded read must not publish a zero** | `1e647e67` | `/cities/bend/southeast-bend` showed "0 homes for sale" beside a real $810,000 median. Operator precedence: `??` binds looser than `>`, so `pulse?.activeCount ?? pins.length > 0 ? … : …` made the pulse count a truthiness test and the answer was always `pins.length`. **Six more pages had the same class**, including `/zip` fabricating the 0 inside the Dataset JSON-LD Google reads. `withTimeoutFallbackResult` now returns `{ value, ok }`; counts are `number \| null`; consumers suppress rather than print 0. Gated by `ci:count-degraded-read` (AST). |

## The CMA corpus, as of now

227 documents. **22 archived** (17 were `zztest`/`zz-test` residue from integration tests writing to production — 5 of them sat in `delivered` status and were inflating the delivered count). **205 live.**

- **178 rebuilt successfully** on the new pricing, comp ladder, and section set.
- **23 could not be priced**: 18 lacked 3 qualifying comps, 5 have no matching MLS row. No exceptions, no bugs — these are honest data limits. Verified that product type is *not* the binding constraint (one failing subject had 84 same-product candidates citywide); the binding constraints are the market-area and lot-character rules that predate this session.
- **7 deliberately untouched** — 5 `finalized`, 2 `delivered`. Rebuilding a document a client already has would silently reprice it.
- Judge spend for the whole rebuild: **$4.06** over 178 builds.

## Open for Matt — one real decision

**164 of 198 rebuilt documents (83%) carry `needs_review`.** The adversarial auditor is doing its job, but at that rate the flag does not discriminate, and because `needs_review` blocks publishing, only ~17% of documents can feed the listing-page funnel.

The findings cluster as: narrative mismatch 90%, price unsupported 63%, condition/quality tier 51%, location/subdivision 41%, product type 13% (down from the pre-fix state), too few comps 7%. **53% of flagged documents sit at exactly 3 comps**, the bare minimum — with three comps, one questionable comp makes the price unsupportable.

Findings already carry `[critical]` / `[major]` / `[minor]` severity, but the publish gate is binary on the verdict. **A severity-aware gate — block on `critical`, flag `major`, ignore `minor` — would be the obvious fix.** It was deliberately NOT applied unilaterally: loosening what goes public under a principal broker's license is Matt's call, and the strict default blocks nothing that matters while it waits.

## Known gaps

- The comp trace is not persisted into `build_summary`, so tier-by-tier exclusion counts cannot be audited after a build. Add it before the next comp-logic change.
- Integration tests still write to production (`zztest` rows). Archiving is a cleanup, not a fix — the tests need their own teardown or a non-production target.
- Three page files (neighborhood 598, city 695, community 1029 lines) sit exactly at their file-size ceilings. The next addition needs a real extraction, not comment trimming.
