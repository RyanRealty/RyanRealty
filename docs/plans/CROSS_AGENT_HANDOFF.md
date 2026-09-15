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
