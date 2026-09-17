# Current — 2026-09-17 (SITE-111 rematch 3 — honest ship fail)

Surface: Cursor cloud `cursor-cloud-site111-20260916`, branch `cursor/site-111-sell-tip-ready-75a0`, PR #267. Do not merge. Node stays `in_progress`.

- Tip SHA after receipt commit (this file + sell parity). `--ship` exit 1. `demoMatch: false`. Median 68 (72/65/68) vs rematch-2 55 vs HEAD 63. Judge: claude-sonnet-5 Task. Builder: grok-4.6.
- Judge accepted house-stage street reframe. replaceWith still: `beui-expanding-arrow-button` (five fading chevrons, no layout-size expand). No house paint after this false.
- Skills read: `.cursor/skills/site-queue/SKILL.md` HARD TIP READY, `TASTE.md`.

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
