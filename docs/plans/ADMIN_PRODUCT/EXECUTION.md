# Execution board — the only "where we are"

**Plan of record:** `docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` (v0.14)
**This file:** live board. If it disagrees with git or the ratchet, this file is wrong.
Fix it in the same session. Do not invent a second board.

**Updated:** 2026-08-13 (Grok, Go running). HEAD `47ec374c` READY.
Ratchet **56 / 0 / 51**, kb 0. Chrome CTA is Value my home. Next: standing leftovers (map/split has no footer on purpose, SellerLPForm copy, admin signed-in look). G3 week-grant and G4 OAuth are not in Go. Live yes→post is a hard stop.

---

## What "Go" means

**Go** = run the autonomous envelope to completion, max parallel, stop only at
the named Matt gates. It does **not** mean texts go out, posts go live,
Closings replaces SkySlope, or a packet is declared beautiful.

### Autonomous envelope (agents finish without you)

- Public: E-CHROME, then every family lease through legacy pages → 0 (migrate
  or cut). Chart atom. Voice.md rewrite. D11 on copy we touch. Look at 390 + 1280.
- Broker: A3 person header. A4+A1 wake rewrite + Today looking-at. A5 **ask
  text in the composer** (not the send, not the PDF). D1 newsletter identity
  stitch (no fake CRM lead). G5 wrapper upgrade to Imagine 1.5 / image-quality
  (no live post). G2 **draft** on Today (no publish).
- F1 query battery after the public spines exist. P10 remaining gates.

### Hard stops (board turns red, wait)

| Stop | Why | What already exists for you to say yes to |
|---|---|---|
| Actual SMS to a real person (A2, a live wake, A5 send) | Draft-first | The draft on Today |
| Live social/GBP post, week-grant, Paul/Rebecca OAuth | Draft-first + OAuth click | Draft + connect URL |
| Expired / buyer **packet PDF** taste (C1, A5 packet) | Beauty bar | The PDF |
| Imagine clip taste (G5 ship, not the wrapper) | Beauty bar | The MP4 draft |
| Licensed form send, SkySlope mutation, cutover | License. SkySlope is the live file (D2) | A3/A4/A1 exist. Still no mutation. |
| Money / ads | Parked | — |

Closings (B1), ads, and G3's standing week-grant are **not** in Go. Building
the calendar UI is in; flipping it to silent autopilot is not.

### Why you cannot start every agent at minute zero

1. **Chrome is one file.** `app/layout.tsx`. Landed `c19b15bd` (READY). Family
   agents may now migrate page bodies. Do not remount chrome on pages.
2. **Land is serial.** The ratchet, `ci:gates`, and Vercel production are
   shared. Parallel **build** (worktrees). One **push** to `main` at a time.
   Wall-clock ≈ chrome + N deploys, not N ÷ agents. Two pushes at once is
   the broken build you already paid for.
3. **The barrel is a bottleneck.** A family that needs a new v3 atom waits
   on the chrome/chart agent. They do not edit `components/site/v3/**`
   themselves.
4. **This checkout is dirty.** Uncommitted sell-film, `SellerLPForm`,
   `SignInPrompt`, `PUBLIC_SITE_UX_OVERHAUL/` leftovers. Go must use **clean
   worktrees from `origin/main`**. Never `git add -A` in this tree.
5. **Another session may still be alive.** Conductor confirms nothing else
   is pushing to `main` before the first land.
6. **Look does not parallelize for free.** Every land still gets a real
   390 + 1280 pass. Skipping look is how a wrong months-of-supply shipped.
7. **Concurrent `tsc` OOM reports clean.** One typecheck per land, not
   thirteen at once (public OS lesson).

### Max parallel (waves, not a stampede)

**Wave 0** (on Go, same time, disjoint files):
E-CHROME · A3 · E-VOICE · V1 · G5 wrappers (`lib/grok-image.ts`, `lib/grok-video.ts` only)

**Wave 1** (after chrome SHA is on `origin/main` and deploy READY):
E-HOMES-SEARCH · E-HOMES-DETAIL · E-HOMES-SIGNALS · E-HOMES-HOME · E-HOMES-TOOLS ·
E-PLACES-REST · E-MARKET-REST · E-ABOUT · E-SELL · E-SAVED · E-SYSTEM ·
A4+A1 · E-CHART (serial on the barrel — one agent, not beside another barrel edit)

**Wave 2** (after wave-1 lands that they depend on):
E-PLACES-REFINE · E-MARKET-REFINE (needs E-CHART) · E-CUT (301/noindex per cut-list)

**Wave 3:** P10 · F1 · G2 (all landed. Wrap B=0. G2 is draft-only on Today.)

Cap: one agent per open lease in the current wave. Do not open a second agent
on the same glob. Listing detail owns `components/site/listing-detail/**`.
Search owns `app/search/**` and must not rewrite `listing-detail`. If a shared
file is required, the first agent to need it takes the lease and the other waits.

---

## Scoreboard (proven this session)

| Meter | Now | Source |
|---|---|---|
| Public non-v3 imports | **56** | `scripts/public-ui-baseline.json` |
| Public legacy pages (no v3) | **0** | same. Frozen noindex LP `app/lp/tetherow/heath` is a named B-exclusion; still counts toward A. |
| Public mixed pages (v3 body + leftover register) | **51** | same, tracked not gated |
| kb import sites | **0** | same, register `kb`. Homepage HUD is gone. |
| Public v3-only pages | **75** | Remaining A is MetadataBlock / leftover islands, not kb chrome. |
| E-CHROME | **landed** `c19b15bd` | prod READY. Look 390+1280: one `v3-chrome` header, filled CTA both widths, menu has Sell links, `/admin` has no public bar. Ratchet held. |
| G5 wrappers | **landed** `317d88de` | `grok-imagine-image-quality` + `grok-imagine-video-1.5`. No API call. Clip taste still a hard stop. |
| V1 chart inventory | **landed** `076c2dd0` | `docs/plans/ADMIN_PRODUCT/chart-inventory.md`. 24 series-as-type, 18 live charts. E-CHART landed. |
| A3 person header | **landed** `56a1ccc0` | Who / Next / Now on `/admin/people/[id]`. Split `PersonIdentityHeader` for the 600 LOC floor. Admin look needs a signed-in pass. |
| E-VOICE | **landed** `0ad6a0c2` | D11 law in `VOICE.md`. `blog-voice.mdc` deleted. Gate is punctuation + invented quotes + Value my home. Eight live worth-CTAs rewritten so the gate could land. Baseline 10→6. |
| A4+A1 looking-at | **landed** `86695f6e` | Locked SMS `{name} is looking at {address}.` Key `crm_people.id`. One ping per person+listing per session. Today first lane. Queue only. No live SMS. Admin look still needs a signed-in 390+1280 pass. |
| A5 ask text | **landed** `a237a340` | Composer preload `{address}. Want a short comparison and what to think about offering?` Today + person Ask is a `?reply=` link. Draft only. No Twilio. Packet PDF still taste. Admin look still needs a signed-in pass. |
| E-CHART | **landed** `d554ba7e` | `V3Chart` atom inside Instrument. Straight SVG segments, caller-formatted labels, no library. Not a seventh pattern. E-MARKET-REFINE mounts it on the hub, central-oregon, and annual-review. |
| E-HOMES-SEARCH | **landed** `79e34778` | Search / buy / compare on the barrel. Ratchet 527→513, 73→69. Mixed 11→14 (tracked). Look 390+1280 still needed. |
| E-HOMES-DETAIL | **landed** `fd1d1d09` | Listing money page on the barrel. JSON-LD RealEstateListing + BreadcrumbList stay on the page MetadataBlock. Capture still `submitSearchAlertSignup` with company trap and disclosure. Similar homes are a Ledger. Value my home is a Quiet link. Ratchet 513→505, 69→68, mixed 14→15 (tracked). Look 390+1280 on 61281 McRoberts: one `v3-chrome`, filled Schedule a tour, capture Sheet, Quiet Value my home, sidebar broker at 1280. SignInPrompt leftover is not this lease. |
| E-SELL | **landed** `1276088f` | `/sell` and `/sell/valuation` on the barrel. SellerLPForm + ValuationForm capture stay. 3% plan is a Sheet. H1 still Sell your home in Central Oregon. Ratchet 505→490, 68→66, mixed 15→17 (tracked). Brand-voice 6→3. Look 390+1280: one chrome, H1, Value my home, capture form. SellerLPForm still says "See what your home is worth" (not this lease). |
| E-HOMES-SIGNALS | **landed** `24835c31` | Open houses and price drops on the barrel. Motivated-sellers 308s into price-drops. Capture still `submitSearchAlertSignup` with company trap and disclosure. Ratchet 490→432, 66→60, mixed 17→21 (tracked). kb 372→320. HTML look: one chrome, H1s, Value my home, disclosure. |
| E-ABOUT | **landed** `b48a8e82` | `/about`, `/team`, `/team/[slug]`, `/contact`, `/reviews`, `/join` on the barrel. Mission sentence is the D11 exception. ContactSheet keeps `submitContactForm`. Broker valuation keeps `submitBrokerSellerLead`. Ratchet 432→383, 60→54, mixed 21→27 (tracked). kb 320→274. shadcn 200→198. Look 390+1280: one chrome, H1s, mission, contact Sheet. Join has no Value my home (recruiting footer). Chrome CTA still says Get your home's value (not this lease). Cookie banner residual. |
| E-PLACES-REST | **landed** `98588ccb` | Cities, communities, parks, schools, central-oregon events/trails/venues/golf on the barrel. Capture still `submitSearchAlertSignup` with company trap and disclosure. Maps are `PlaceFieldMap`. Deleted NeighborhoodMap, VenueMap, AreaMarketBand, CommunityIndexBrowser, RegionalSfrAlertsBand. Ratchet 383→296, 54→41, mixed 27→40 (tracked). kb 274→198. shadcn 198→197. tokens 242→241. |
| E-HOMES-HOME | **landed** `559b9233` | Homepage, our-homes, luxury, videos, feed (301 → `/videos?view=feed`), activity on the barrel. D11 H1 and lead are literals. Capture still `submitSearchAlertSignup` with company trap and disclosure. KbMarketHud leftover (D9). Deleted KbCommunities, KbTicker, KbCommunityAlerts, KbTeam, KbTestimonials. Ratchet 296→262, 41→35, mixed 40→45 (tracked). kb 198→165. shadcn 197→196. Bundle 9.19 MB. Look 390+1280 `/`: one chrome, H1, D11 lead, live MLS figures, Value my home. |
| E-MARKET-REST | **landed** `24a6090d` | Blog, FAQ, housing-market catch-all, history, reports archive, sales reports, appreciation on the barrel. Inquiry sheets keep `submitMarketPageInquiry`. D9: city year overlay and archive sold-by-year pass `chart`. Deleted FaqAccordion, PriceChart, MarketDetailStats, and the leftover geo-report islands. Ratchet 262→202, 35→26, mixed 45→54 (tracked). kb 165→119. shadcn 196→192. tokens 241→228. Bundle 9.09 MB. Look 390+1280 `/housing-market/bend`: one chrome, H1, live figures, chart, Value my home. Hub / central-oregon / annual-review stay E-MARKET-REFINE. |
| E-HOMES-TOOLS | **landed** `6e781cc7` | Mortgage + rental calculators on the barrel. Calculator math stays as islands inside a sheet wrapper (V3Sheet has no ReactNode slot). Value my home on Instrument + Quiet. Ratchet 202→194, 26→24, mixed 54→56 (tracked). kb 119→109. Bundle 9.17 MB. Look 390+1280 `/tools/mortgage-calculator`: one chrome, H1, Value my home, starting insurance **0.35%** (IEEE junk fixed after first READY). Chrome CTA still Get your home's value. Cookie banner residual. |
| E-SAVED | **landed** `cb3b8854` | Leftover `/account/*` on the barrel. Saved stays a signed-in affordance, not a sixth marketing destination. `collections/[id]` and `hidden` left ListingCard for Quiet + Ledger. Other account pages wrapped in AccountFrame so V3Footer sits outside main. No V3Chrome remount. No on-page Value my home (sticky chrome already asks). Ratchet 194→192, 24→22, mixed 56 held. kb held 109. Signed-out `/account` noindex, meta-refresh to `/login?next=/account`. Signed-in 390+1280 of the v3 body still needs a session. Login page itself is leftover (not this lease). |
| E-SYSTEM | **landed** `00a3daee` | Legal, unsubscribe, offline, cma-drafts, team edit, site-index, noindex LPs on the barrel. Quiet. Dual objectives kept. SMS consent copy stays in `/privacy`. LPs (`/lp/bend`, tetherow, central-oregon-golf) are noindex,nofollow. Did not edit `SellerLPForm.tsx`. `check-commit-compiles` now streams `git archive \| tar` so a ~480MB tree cannot deadlock node. Ratchet 192→178, 22→8, mixed 56→70 (tracked). kb 109→119. Bundle 9.19 MB. Look 390+1280 `/privacy`: one chrome, H1 Privacy and cookies. `/offline` H1 You are offline. Chrome CTA still Get your home's value. Cookie banner residual. |
| E-CUT | **landed** `c472e240` | Cut leftover area-guides, areas, builders, reports hub, resources, pulse. Page stub + next.config 308. noindex + canonical at the survivor. `/reports` hub body inverted onto `/housing-market/reports` (still KB, not a v3 pass). Hop-free: `/best-neighborhoods-bend-oregon` → `/cities`, `/pulse-video-demo` → `/activity`. Nav Areas → `/cities`. Ratchet 178→139, 8→3, mixed 70→69 (tracked). kb 119→84. Bundle 8.88 MB. Look 390+1280: `/area-guides` lands on `/cities` (H1 Central Oregon cities: a balanced market), `/pulse` lands on `/activity` (H1 What just moved on the list). One chrome both widths. Leftovers: `/housing-market/reports` KB, `ReportsIndexContent` TilesSlider island, `/buy` Area guides Quiet hop, VisitTracker area-guides regex, layout comment on deleted pulse-brand-cards. |
| E-PLACES-REFINE | **landed** `1c10fe0c` | City / neighborhood / community / subdivision / zip / oregon detail leftover mixed onto v3. Maps are shared `PlaceFieldMap`. City alerts trap `company` and disclose in children. D9 subdivision yearly series is `Instrument.chart`. Oregon primary is Get a broker introduction. Ratchet held 139 / 3 / 69. shadcn 182→179. City page stayed under 600 via `CityHomesField`. Look 390+1280 `/cities/bend`: one chrome, H1 Bend homes for sale: a seller's market, live figures. `/oregon/portland`: H1 Homes for sale in Portland, Oregon, Get a broker introduction, We don't work in Portland. |
| E-MARKET-REFINE | **landed** `c29d5b51` | Hub, central-oregon, annual-review, months-of-supply. D9: median-sale overlay is `Instrument.chart` (straight SVG, year series). Inquiry sheets keep `submitMarketPageInquiry`. Ratchet held 139 / 3 / 69. Look 390+1280 `/housing-market`: one chrome, H1 Central Oregon housing market: a balanced market, live figures, chart in the Instrument. `/housing-market/annual-review` same chart atom. |
| F1 query battery | **landed** `9e11ce83` | Three Loop F queries + GSC extras map to survivor URLs in `/llms.txt` + JSON-LD. G67 `ci:ai-query-battery`. `/reports` hop gone from the map. `/sell` and `/sell/valuation` emit Service + FAQPage. Ratchet held 139 / 3 / 69. Look 390+1280 `/about`, `/sell`, `/sell/valuation`, `/communities/northwest-crossing`: one chrome, H1s, Value my home on sell/valuation. Chrome CTA still Get your home's value. Cookie banner residual. SellerLPForm still See what your home is worth (not this lease). |
| P10 wrap | **landed** `d5ebc4db` | B=0. Reports slug inverted onto `/housing-market/reports/[slug]`. Hub v3-wrapped. Frozen Heath LP excluded from B only (`scripts/lib/frozen-noindex-lps.mjs`). Ratchet 139/3/69 → 129/0/71, kb 84→73. Tokens 209→208. Static-params 17→14. Deleted orphan `KbSell`. Look 390+1280 `/housing-market/reports` H1 Central Oregon market reports: a balanced market, live figures, Value my home. Weekly report H1 the CMS title. `/reports` 308s to the hub. Heath still noindex. |
| G2 draft on Today | **landed** `def67a92` | Produce a draft on `/admin/today` (live listing i2v or GBP still). Lands on Drafts ready for approval. `humanApprovedAt` stays null. `publish_payload.approved` is false. No `/api/social/publish`. No Replicate. See draft still goes to `/admin/approval-queue`. No new approve button. Clip taste still Matt’s. Signed-out 390+1280 look: Admin sign in (`next=/admin/today`). Signed-in produce look still needs a session (same leftover as A3/A4/A5). Live post is a hard stop. |
| D4 newsletter stitch | **landed** `168bfec1` | Public newsletter finds-or-creates one CRM person and stitches `rr_vid` + session. No fake CRM lead in the look. V3Footer still has no newsletter ask (one primary CTA). |
| Search-alert stitch | **landed** `fd34a499` | Listing-alert signup stitches through `stitchFormSubmitIdentity`. Callers pass `readRrSessionId()`. Did not submit a live alert. fub-identifiers 801→795. Look 390+1280 `/homes-for-sale` `/open-houses` `/`: one chrome, capture still present, none covering. |
| E-CTA | **landed** `34b17bed` | Chrome `VALUATION_FORM.label` is Value my home. href `/sell#get-value`. Look 390+1280 `/` and `/homes-for-sale`: chrome CTA Value my home, one chrome, none covering. SellerLPForm still See what your home is worth (not this lease). |
| E-TRACKER | **landed** `ff803bbf` | 70 public pages mount `V3SectionTracker`. Ratchet 129/0/71 → **59/0/52**, kb 73→3. Mockup parity accepts either tracker. Look 390+1280 `/` `/about` `/homes-for-sale` `/housing-market`: one chrome, Value my home, H1s, none covering. Tip `22904591` is the parallel ci:gates runner on top of this. |
| E-AUTH | **landed** `ce0a4ed3` | login / signup / forgot-password / auth-error on V3Footer. Leftover LoginForm / SignupForm / ForgotPasswordForm islands stay. Tokens 208→202. AUTH_INTERNAL so A/B did not move. Look 390+1280 `/login`: H1 Sign in, chrome=1, `.v3-footer`=1, no navy SiteFooter, no `#newsletter-email`. |
| E-SEARCH-REFINE | **landed** `0c49237a` | Search H1 is visible in the filter dock (`font-display`). Guest capture defaults collapsed: Get listing alerts, no email field until click. Map/split footer still absent (viewport-fit leftover). Ratchet held 59/0/52. Look 390+1280 `/homes-for-sale`: H1 Homes for Sale, chrome=1, Get listing alerts, no covering. Did not submit. Navy Get alerts chip removed in E-SEARCH-CHIP. |
| E-404 | **landed** `fc0abd96` | Global 404 on V3Footer. HideChrome still gates LP/admin paths. Leftover NotFoundClient island stays. Ratchet held 59/0/52 (not a page.tsx). Look 390+1280 junk URL: HTTP 404, H1 Page not found, chrome=1, `.v3-footer`=1, no `#newsletter-email`, none covering. |
| E-SEARCH-CHIP | **landed** `af26df03` | Dropped the navy Get alerts chip in SearchFilters. Collapsed Get listing alerts stays. Save this search stays the navy mid-browse control. Ratchet held 59/0/52. Look 390+1280 `/homes-for-sale`: H1 Homes for Sale, chrome=1, Get listing alerts, no Get alerts chip, Save this search, no covering. Did not submit. |
| E-HOME-HUD | **landed** `47ec374c` | Homepage year overlay on the existing level-1 Instrument (`buildRegionMedianChart`). Deleted leftover `KbMarketHud`. Ratchet **59/0/52 → 56/0/51**, kb 3→0. Look 390+1280 `/`: H1 Homes for Sale in Central Oregon, chrome=1, footer=1, chart SVG, no HUD, Value my home, none covering. |

Chrome is live. Mixed routes sit under v3 chrome; they are quarry, not done. Treat every shipped v3 page as quarry: keep what holds, rework what is clunky, never call it final because a wave claimed it.

Look residual (not this lease): at 390 a leftover `SignInPrompt` dialog covers the page. Dirty tree, do not join.

---

## How we run (collision law)

The public grind struggled because two plans, a stale queue, and two sessions committing
to `main` at once. The last collision broke a build.

1. **One plan. One board.** This file + the plan of record. `docs/plans/PUBLIC_PRODUCT/`
   is quarry: locks, recipe, gate contracts, process specs. Its `state.json` and
   `work-queue.json` are stale and are not authority.
2. **Build parallel. Land serial.** As many agents as there are open leases. Each agent
   works a leased glob, preferably in a worktree `wt/<lane>-YYYYMMDD`. Only **one**
   unit lands on `origin/main` at a time. The ratchet file is shared. Two pushes at
   once is how visitors see a broken build.
3. **File lease or do not touch.** An agent may edit only the glob on its lease plus
   docs it is told to flush. No `git add -A`. Uncommitted leftover (sell-film,
   `PUBLIC_SITE_UX_OVERHAUL/` dirty files, `SellerLPForm.tsx`, `SignInPrompt.tsx`) is
   not ours. Do not join it.
4. **Evidence or it is not done.** Commit SHA, ratchet numbers went down (or a declared
   cut), browser 390 + 1280, gate contracts for that route moved in the same change.
   Self-reported done is how the last public program died.
5. **Amnesia on implementation.** Process / IA / visual **locks** stay (Matt granted
   2026-08-11). Jobs and destinations stay. The current page, the current chrome, the
   current `_v3/` module — quarry. A mixed Market page that is still clunky gets
   reworked, not protected.
6. **D11 on any public copy we write.** Do not start a site-wide copy program. Rewrite
   `VOICE.md` as the first voice slice, then apply on pages we touch.

**Shared serial files (one lease at a time, never parallel):**
`app/layout.tsx`, `components/site/v3/**`, `components/site/PublicNav.client.tsx`,
`lib/site-nav.ts`, `scripts/public-ui-baseline.json`, `scripts/check-public-ui.mjs`,
`scripts/check-kb-shared-shell.mjs`, `scripts/check-default-chrome-footer.mjs`,
`scripts/check-public-v3.mjs`.

**Land ritual (every unit):** rebase onto current `origin/main` → one commit → push →
deploy READY → browser look → append this board (status, SHA, ratchet) → next lease
may land.

---

## Order

```
go
  ├─ SERIAL 0: E-CHROME     layout PublicNav → V3Chrome (the 399 unlock)
  │                         + css-layers on V3Chrome/V3Footer
  │                         + chart atom in the barrel (D9) if a series ships next
  ├─ then fan-out (parallel build, serial land):
  │     public families     (disjoint app/ globs)
  │     broker A3 → A4+A1   (admin / CRM — disjoint from public)
  │     voice.md rewrite    (one file; first public-copy slice)
  └─ then P10 gates, then standing refine (never OS #3)
```

Chrome first is not optional. Until layout mounts `V3Chrome`, every migrated page stays
mixed by design (`migration-recipe.md` §4). Fan-out of page bodies before that swap
repeats the 11 mixed pages.

Broker A3/A4/A1 **may build** during chrome (disjoint files). They still **land** one
at a time on `main`, never in the same push as chrome.

---

## Lanes and leases

Status: `open` = can start on go · `blocked` = waits on another lease · `quarry` =
exists on disk, not accepted as done · `parked` = later.

### Serial 0 — public chrome (one agent)

| Id | Lease | Status | Done when |
|---|---|---|---|
| **E-CHROME** | `app/layout.tsx` (PublicNav → V3Chrome), v3 chrome CSS layers, footer contract, `ci:kb-shared-shell` layout arm. Do not remount chrome on pages. | **landed** `c19b15bd` READY | Layout mounts `V3Chrome`. One footer per page. Nav hrefs from `lib/site-nav.ts`. `ci:css-layers` green. Look 390+1280: one header, filled CTA at both widths, Sell in the menu, no dual chrome, no public bar on `/admin`. Ratchet kb **held at 399** (page imports). Family leases drop it. |

### Public families — after E-CHROME (parallel build)

Counts are leftover **legacy + mixed** pages in that destination, from the ratchet
joined to `page-inventory.json` this session. Not a promise the list is sacred; re-count
from the baseline if it drifts.

| Id | Lease (pages) | n leftover | Status | Notes |
|---|---|---|---|---|
| **E-HOMES-SEARCH** | `app/search/**`, `app/buy/**`, `app/compare/**` | 4 | **landed** `79e34778` READY | Search is the Homes Field. Ratchet 527→513, 73→69. Look still needed. |
| **E-HOMES-DETAIL** | `app/listing/**` | 1 | **landed** `fd1d1d09` READY | Money page on the barrel. JSON-LD + capture stay. Look 390+1280 on a live listing: one chrome, tour CTA, capture, Quiet Value my home. |
| **E-HOMES-SIGNALS** | `app/open-houses/**`, `app/price-drops/**`, `app/motivated-sellers/**` | 6 | **landed** `24835c31` READY | Open houses + price drops on the barrel. Motivated-sellers 308s to price-drops. Capture stays. |
| **E-HOMES-HOME** | `app/page.tsx`, `app/our-homes/**`, `app/luxury-homes-bend/**`, `app/videos/**`, `app/feed/**`, `app/activity/**` | mixed leftover | **landed** `559b9233` READY | D11 H1/lead locked. HUD leftover closed by E-HOME-HUD. `/feed` folds into `/videos?view=feed`. Look 390+1280 on `/`. |
| **E-HOMES-TOOLS** | `app/tools/mortgage-calculator/**`, `app/tools/rental-property-calculator/**` | leftover island | **landed** `6e781cc7` READY | Appreciation stays with Market. Calculator islands declared leftover. Look 390+1280: insurance 0.35%. |
| **E-PLACES-REST** | `app/cities/page.tsx`, `app/communities/page.tsx`, `app/central-oregon/**`, `app/parks/**`, `app/schools/**` | 13 | **landed** `98588ccb` READY | Indexes + lifestyle. Detail cities/communities/subdivisions/zip/oregon remain mixed quarry (E-PLACES-REFINE). |
| **E-PLACES-REFINE** | `app/cities/[slug]/**`, `app/communities/[slug]/**`, `app/subdivisions/[slug]/**`, `app/zip/**`, `app/oregon/**` | leftover mixed | **landed** `1c10fe0c` READY | Maps → `PlaceFieldMap`. Capture stays `submitSearchAlertSignup`. MetadataBlock + KbSectionTracker leftover. Look 390+1280 `/cities/bend` and `/oregon/portland`. |
| **E-MARKET-REST** | `app/blog/**`, `app/faq/**`, `app/housing-market/history/**`, `app/housing-market/[...slug]/**`, `app/housing-market/reports/**`, `app/reports/sales/**`, `app/tools/appreciation/**` | mixed leftover | **landed** `24a6090d` READY | Catch-all and content. D9 chart on city/archive. Hub / central-oregon / annual-review stay refine. Look 390+1280 on `/housing-market/bend`. |
| **E-MARKET-REFINE** | `app/housing-market/page.tsx`, `central-oregon`, `annual-review`, `app/months-of-supply/**` | leftover mixed | **landed** `c29d5b51` READY | D9 chart on Instrument. Do not flatten series. Look 390+1280 `/housing-market` and annual-review. |
| **E-ABOUT** | `app/about/**`, `app/team/**`, `app/contact/**`, `app/reviews/**`, `app/join/**` | 6 | **landed** `b48a8e82` READY | Mission sentence is the D11 exception. `/team/[slug]/edit` stays with E-SYSTEM. |
| **E-SELL** | `app/sell/page.tsx`, `app/sell/valuation/**` | 2 | **landed** `1276088f` READY | Valuation spine. 3% plan as Sheet. Capture unchanged. Look still needed. `app/dev/sell-film` is a prototype, not this lease. |
| **E-SAVED** | `app/account/**` leftover | leftover shadcn | **landed** `cb3b8854` READY | Saved is an affordance, not a sixth marketing destination. Signed-in look still needs a session. |
| **E-SYSTEM** | legal + unsubscribe + offline + cma-drafts + team edit + site-index + noindex LPs | leftover tracker | **landed** `00a3daee` READY | Quiet. Dual objectives kept. LPs noindex. Did not edit SellerLPForm. Look 390+1280 `/privacy`. |
| **E-CUT** | CUT-CANDIDATE leftovers: area-guides, areas, builders, reports hub, resources, pulse | 0 | **landed** `c472e240` READY | 308 + noindex stubs. Survivors: `/cities`, `/homes-for-sale`, `/housing-market/reports`, `/housing-market`, `/activity`. Did not restyle the reports hub. Look 390+1280 `/area-guides` and `/pulse`. |
| **E-CHART** | `components/site/v3/` chart atom inside Instrument | — | **landed** `d554ba7e` READY | D9. `V3Chart` under Instrument. Straight segments, caller labels, no library. Families may pass `chart`. |
| **E-VOICE** | `marketing_brain_skills/brand-voice/VOICE.md` + delete `.cursor/rules/blog-voice.mdc` + tiny gate | — | **landed** `0ad6a0c2` | D11 law. Gate is punctuation + invented quotes + Value my home. Not a site-wide copy sweep. Eight worth-CTAs rewritten to land the gate. |

### Broker — disjoint from public (may build during chrome)

| Id | Lease | Status | Done when |
|---|---|---|---|
| **A3** | admin person header | **landed** `56a1ccc0` | Who (closed labels), next step, now. `PersonIdentityHeader`. Admin look still needs a signed-in 390+1280 pass. |
| **A4+A1** | `queueReturnVisitAlert` rewrite + Today looking-at | **landed** `86695f6e` READY | `{name} is looking at {address}.` Key `crm_people.id`. Today first lane. Queue only. No live SMS. Admin look still needs a signed-in pass. |
| **A5** | lead ask text | **landed** `a237a340` READY | Names the home. Does not say we watched them. Draft in composer. Packet is taste. |
| **C1** | expired packet | taste | Matt stops the PDF. |
| **G5 wrappers** | `lib/grok-image.ts`, `lib/grok-video.ts` only | **landed** `317d88de` | Models `grok-imagine-image-quality` + `grok-imagine-video-1.5`. No live post. Listing-tour Replicate is a later touch. |
| **G2** | Imagine draft on Today | **landed** `def67a92` READY | Produce a draft. Does not stamp yes. Does not post. Admin signed-in 390+1280 look still needs a session. |
| **G1 / G3 / G4** | live post / week-grant / Paul+Rebecca OAuth | **not in Go** | Hard stops. Tokens already live. Produce is Imagine. Week-grant and OAuth click wait on Matt. |
| **F1** | `/llms.txt` + JSON-LD + G34/G39/G67 | **landed** `9e11ce83` READY | Named queries cite survivor URLs. Map: `lib/seo/ai-query-map.json`. Live `/llms.txt` lists About, Reviews, Value my home, NWX 3/2. Google still has to recrawl. |
| **P10** | public wrap closing gates | **landed** `d5ebc4db` READY | B=0. Call: invert reports slug + v3 hub wrap + named frozen-LP B-exclusion. Mixed leftover after E-TRACKER: ReportsByCityView, ReportsIndexContent, MetadataBlock. Did not restyle heath. |
| **D4** | newsletter identity stitch | **landed** `168bfec1` READY | One person record. No fake lead. V3Footer has no newsletter ask. |
| **Search-stitch** | listing-alert identity stitch | **landed** `fd34a499` READY | Same wrapper as D4. Did not submit. |
| **E-CTA** | chrome CTA label | **landed** `34b17bed` READY | Value my home. Look 390+1280 `/` and `/homes-for-sale`. |
| **E-TRACKER** | V3SectionTracker on public pages | **landed** `ff803bbf` READY | Ratchet 59/0/52, kb 3. Look 390+1280 four routes. |
| **E-AUTH** | leftover auth pages SiteFooter → V3Footer | **landed** `ce0a4ed3` READY | `/login` `/signup` `/forgot-password` `/auth-error`. Look 390+1280 `/login`. |
| **E-SEARCH-REFINE** | search H1 + collapsed guest alerts | **landed** `0c49237a` READY | Visible H1. Collapsed Get listing alerts. Map/split footer stays off. Look 390+1280 `/homes-for-sale`. |
| **E-404** | global 404 SiteFooter → V3Footer | **landed** `fc0abd96` READY | HideChrome stays. NotFoundClient leftover. Look 390+1280 junk URL. |
| **E-SEARCH-CHIP** | SearchFilters navy Get alerts chip | **landed** `af26df03` READY | Chip gone. Get listing alerts + Save this search remain. Look 390+1280 `/homes-for-sale`. |
| **E-HOME-HUD** | homepage KbMarketHud → Instrument.chart | **landed** `47ec374c` READY | Year overlay. kb 3→0. Look 390+1280 `/`. |

### Do not lease

- `app/admin/**/crm/inbox/**` (11F leftover)
- `app/dev/sell-film/**`, `public/brand/motion/**` (uncommitted, not ours)
- `docs/plans/PUBLIC_SITE_UX_OVERHAUL/**` (evidence only)
- `app/lp/seller-home-value/SellerLPForm.tsx`, `components/SignInPrompt.tsx` (dirty, not this plan)

---

## Quarry from the public program (keep / rework / ignore)

**Keep (Matt locks + tools):**
- Process lock, IA lock (Homes · Places · Market · Sell · Saved · About), visual lock
  (six patterns). `docs/plans/PUBLIC_PRODUCT/decisions.md`.
- Dual objectives + exits in `page-inventory.json`.
- v3 barrel (`components/site/v3`), `ci:public-ui` ratchet, `migration-recipe.md`,
  `gate-contracts.md`.
- Founding ask: each page has an objective; seamless Central Oregon exploration;
  lead-gen machine that never acts like it.

**Rework (do not assume final):**
- The 11 mixed routes (v3 body, KB chrome). After E-CHROME they should drop toward
  v3-only. If the body is still clunky, fix the body.
- `_v3/` modules that fight the barrel. Add a primitive; do not grow a snowflake.
- Any series flattened to a figure.
- Copy that violates D11 on pages we touch.
- `state.json` still describes the *reverted* first Market attempt. Ignore it.

**Ignore:**
- `work-queue.json` ids `p9-market-family-v2` and `p9-chrome-unit` as written (chrome
  *primitives* shipped; chrome *unit* is E-CHROME above, not that stale note).
- `PUBLIC_SITE_UX_OVERHAUL/` statuses and mockups.
- Self-reported wave dones without ratchet proof.

---

## Conductor (the session that fans out)

On **go**, the conductor does not migrate pages. It:

1. Reads this file + ratchet + `git status` (short). Prints the scoreboard.
2. Confirms no other session is pushing to `main`.
3. Spawns **clean worktrees from `origin/main`** (`wt/<lease>-YYYYMMDD`). Does
   not build in a dirty checkout. Does not `git add -A`.
4. Wave 0 in parallel: E-CHROME, A3, E-VOICE, V1, G5 wrappers.
5. Lands **one** worktree at a time onto `main`: rebase, ratchet re-seed if
   public, one typecheck, push, deploy READY, browser look, update this file.
6. After chrome READY, opens wave 1 leases (one agent per glob). Same serial
   land. Then wave 2, then wave 3.
7. Hits a hard stop → write the artifact, turn the row red, keep the other
   waves moving. Do not idle the public grind because a packet is waiting
   on taste.

**What you say to start:**

```
go. One plan: docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md
Board: docs/plans/ADMIN_PRODUCT/EXECUTION.md
Autonomous envelope to completion. Max parallel per the waves.
Clean worktrees from origin/main. Build parallel, land serial.
First land is E-CHROME. Do not send, post, or mutate SkySlope.
Do not assume Claude's v3 pages are final. No git add -A.
Evidence or it is not done.
```

---

## Flush rule (every unit)

Append a line to `docs/plans/ADMIN_PRODUCT/progress.txt`.
Update the scoreboard + the row status in **this file**.
Do not write a second status into `PUBLIC_PRODUCT/state.json` except to keep the
pointer at this board.

Newest progress at the bottom. Newest board truth at the top of Scoreboard.
