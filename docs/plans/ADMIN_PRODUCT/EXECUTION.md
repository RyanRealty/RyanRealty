# Execution board — the only "where we are"

**Plan of record:** `docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` (v0.13)
**This file:** live board. If it disagrees with git or the ratchet, this file is wrong.
Fix it in the same session. Do not invent a second board.

**Updated:** 2026-08-12 (Grok, fold-in). **Waiting on Matt: say go.**
No product code until then. Planning is done.

---

## Scoreboard (proven this session)

| Meter | Now | Source |
|---|---|---|
| Public non-v3 imports | **527** | `scripts/public-ui-baseline.json` |
| Public legacy pages (no v3) | **73** | same |
| Public mixed pages (v3 body + leftover register) | **11** | same |
| Of 527, kb chrome | **399** | same, register `kb` |
| Public v3-only pages | **0** | same — chrome still in `app/layout.tsx` as `PublicNav` → KbNav |
| Broker A3 / A4 / A1 | not started | no commits |
| Voice.md rewrite | not started | D11 locked; file still the 2026-08-05 machine |

Claude’s last public status matches the ratchet. It does **not** mean Market and Places
are finished. Eleven routes have a v3 body under KB chrome. Sibling routes in those
families are still fully legacy. Treat every shipped v3 page as quarry: keep what holds,
rework what is clunky, never call it final because a wave claimed it.

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
| **E-CHROME** | `app/layout.tsx` (PublicNav → V3Chrome), v3 chrome CSS layers, footer contract, `ci:kb-shared-shell` layout arm. Do not remount chrome on pages. | **open on go** | Layout mounts `V3Chrome`. Exactly one footer per page. Every current nav href preserved (`lib/site-nav.ts`). Ratchet kb drops hard (399 is the pile). `ci:css-layers` green on V3Chrome/V3Footer. Browser 390 + 1280: one header, one visible filled CTA at 1280, mobile CTA in the menu, no dual chrome. |

### Public families — after E-CHROME (parallel build)

Counts are leftover **legacy + mixed** pages in that destination, from the ratchet
joined to `page-inventory.json` this session. Not a promise the list is sacred; re-count
from the baseline if it drifts.

| Id | Lease (pages) | n leftover | Status | Notes |
|---|---|---|---|---|
| **E-HOMES-SEARCH** | `app/search/**`, `app/buy/**`, `app/compare/**` | 4 | blocked on chrome | Search is the Homes surface (`/homes-for-sale` rewrites here). |
| **E-HOMES-DETAIL** | `app/listing/**` | 1 | blocked on chrome | Money page. Extra care. Every CTA + JSON-LD stays. |
| **E-HOMES-SIGNALS** | `app/open-houses/**`, `app/price-drops/**`, `app/motivated-sellers/**` | 6 | blocked on chrome | Claude named these. |
| **E-HOMES-HOME** | `app/page.tsx`, `app/our-homes/**`, `app/luxury-homes-bend/**`, `app/videos/**`, `app/feed/**`, `app/activity/**` | 6 | blocked on chrome | Homepage H1/lead already locked (D11). 16 kb imports on `app/page.tsx` today. |
| **E-HOMES-TOOLS** | `app/tools/mortgage-calculator/**`, `app/tools/rental-property-calculator/**` | 2 | blocked on chrome | Appreciation stays with Market. |
| **E-PLACES-REST** | `app/cities/page.tsx`, `app/communities/page.tsx`, `app/central-oregon/**`, `app/parks/**`, `app/schools/**` | 13 | blocked on chrome | Indexes + lifestyle. Detail cities/communities/subdivisions/zip/oregon are mixed quarry. |
| **E-PLACES-REFINE** | `app/cities/[slug]/**`, `app/communities/[slug]/**`, `app/subdivisions/[slug]/**`, `app/zip/**`, `app/oregon/**` | 6 mixed | quarry, after chrome | Claude wave 2. Look. Rework if clunky. Do not re-migrate from scratch unless amnesia says the `_v3/` module is wrong. |
| **E-MARKET-REST** | `app/blog/**`, `app/faq/**`, `app/housing-market/history/**`, `app/housing-market/[...slug]/**`, `app/housing-market/reports/**`, `app/reports/sales/**`, `app/tools/appreciation/**` | 9 | blocked on chrome | Catch-all and content. |
| **E-MARKET-REFINE** | `app/housing-market/page.tsx`, `central-oregon`, `annual-review`, `app/months-of-supply/**` | 4 mixed | quarry, after chrome | Claude waves 1–2. Chart atom (D9) before flattening any series. Look at every chart. |
| **E-ABOUT** | `app/about/**`, `app/team/**`, `app/contact/**`, `app/reviews/**`, `app/join/**` | 6 | blocked on chrome | About mission sentence is the one virtue-word exception. |
| **E-SELL** | `app/sell/page.tsx`, `app/sell/valuation/**` | 2 | blocked on chrome | Valuation spine. 3% plan already locked. `app/dev/sell-film` is a prototype, not this lease. |
| **E-SAVED** | `app/account/**` leftover | 2 | blocked on chrome | Saved is an affordance, not a sixth marketing destination. |
| **E-SYSTEM** | legal + unsubscribe + offline + cma-drafts + team edit + site-index + noindex LPs | 15 | blocked on chrome | Quiet. Do not over-design. Dual objectives still required. |
| **E-CUT** | CUT-CANDIDATE leftovers: area-guides, areas, builders, reports hub, resources, pulse | 8 | blocked on chrome | Honor `cut-list.md` + GSC. Migrate only what we keep. 301 or noindex the rest. Do not spend a v3 pass on a page we are killing. |
| **E-CHART** | `components/site/v3/` chart atom inside Instrument | — | serial, with or right after chrome | D9. Needed before Market refine can tell the truth. |
| **E-VOICE** | `marketing_brain_skills/brand-voice/VOICE.md` + delete `.cursor/rules/blog-voice.mdc` + tiny gate | — | open on go (one file) | First voice slice. Not a site-wide copy sweep. |

### Broker — disjoint from public (may build during chrome)

| Id | Lease | Status | Done when |
|---|---|---|---|
| **A3** | admin person header | open on go | Open a lead, no notes: who (closed labels), next step, what they're doing now. |
| **A4+A1** | `queueReturnVisitAlert` rewrite + Today looking-at | open on go, ships together | `{name} is looking at {address}.` Key `crm_people.id`. Today shows looking-at. |
| **A5** | lead ask text | after A4 rail | Names the home. Does not say we watched them. Packet is taste. |
| **C1** | expired packet | taste | Matt stops the PDF. |
| **G1–G5** | social / Imagine | after A3 or in parallel if files disjoint | Tokens already live. Produce is Imagine. |

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
3. Opens E-CHROME as the first land.
4. After chrome SHA is on `origin/main` and deploy READY, opens as many family
   worktrees as there are **open** leases, each with this lease text and the plan.
5. Lands one worktree at a time: rebase, ratchet re-seed, push, READY, update this file.
6. Broker A3 may be a second conductor on admin files only, still serial-land on `main`.

**What you say to start:**

```
go. One plan: docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md
Board: docs/plans/ADMIN_PRODUCT/EXECUTION.md
Build parallel, land serial. First land is E-CHROME.
Do not assume Claude's v3 pages are final. Quarry, rework if clunky.
No git add -A. Evidence or it is not done.
```

---

## Flush rule (every unit)

Append a line to `docs/plans/ADMIN_PRODUCT/progress.txt`.
Update the scoreboard + the row status in **this file**.
Do not write a second status into `PUBLIC_PRODUCT/state.json` except to keep the
pointer at this board.

Newest progress at the bottom. Newest board truth at the top of Scoreboard.
