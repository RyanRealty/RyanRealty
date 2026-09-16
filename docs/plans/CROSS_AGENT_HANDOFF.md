# Current — 2026-09-16 (Claude cloud site queue: SITE-95 compare + SITE-93 city Tip Ready on the sonnet stand-in; SITE-111 sell + SITE-112 subdivision building)

Surface: Claude Code cloud session `claude-cloud-01DYvsoL-20260915` (branch `claude/run-loop-v30as0`, draft **PR #253**). No grok / cursor CLI in the sandbox, so every mark is the claude CLI as Sonnet with an Opus builder — a **rebaseline**, never done. Cos Mini: rejudge the tips on grok-4.6 and land.

- **Tip:** `17b8a6d` on `claude/run-loop-v30as0` (pushed). Commits: compare `b0a49f3`…`006076a`; ported PR #252 `65234d6` as `a80e52e` (route-smoke 144/145 sitemap 500 + six tap targets); city `ad4747a` / `746a470` / `17b8a6d`.
- **SITE-95 compare:** `--ship` exit 0 · sonnet 62 (58/62/66) · honesty 8 · demoMatch true · shadcn table + carousel imported by `app/compare/_v3/CompareSheet.client.tsx`; flanking chevrons at the photo midline + "2 of 5" read-out were what flipped demoMatch (the under-frame pair the grok ruler rejected on /price-drops was tried and reverted). Floor `heroImageNatural` 1382→1200 by hand with the reason in `contentFloor.note` (rotating sample). Node **blocked on a person** with the rejudge ask in `blocked_reason`.
- **SITE-93 city:** `--ship` exit 0 · sonnet 63 (63/68/62) · honesty 8 · demoMatch true · Beautiful UI insight pager (`CityInsight`) + beUI combobox via new barrel primitive `V3TypeCombobox`; proof strip newest 4 with facts (2 on phones); monthly sold count published; `requiredComponents` 14→16. `next.config.ts` gains opt-in `RR_TURBOPACK_ROOT` (worktree builds). Node **blocked on a person**, same ask.
- **Tool fix:** `scripts/lib/taste-evaluate-result.mjs` `claudeModelFromWrapper` prefers the requested alias (the CLI's `modelUsage` lists the haiku helper first). Both lanes hit it; compare's version kept, both lanes' tests pass.
- **Sandbox truth:** headless Chromium here rejects the agent-proxy CA even with the CA in the NSS store, so `ci:route-content-floor` / `ci:tap-targets` cannot load Spark photos locally; PR #252's `remote-media-proxy` + `gate-browser` are the accepted fix and were used UNCOMMITTED for measurement only. GitHub runners measure real photos.
- **Round two (in flight, claimed):** SITE-111 sell (`app/sell/**`, beui-input / shadcn input / sheet) and SITE-112 subdivision (`app/subdivisions/[slug]/**`, reusing the city lane's insight + combobox pattern). Landing path: cherry-pick onto `claude/run-loop-v30as0`, one gate chain, one push, refresh PR #253.
- **Next:** Cos Mini grok-4.6 rejudge of PR #253 (compare, city) → land or send back. SITE-102/100 (housing-market family) skipped while SITE-103 is held elsewhere. Do not rebuild SITE-93/95 from main.
- Skills read: `.claude/skills/site-queue/SKILL.md`, `design_system/public/TASTE.md`, `scripts/lib/taste-receipt.mjs --ship`, `scripts/lib/taste-catalog.mjs --preflight`.

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
