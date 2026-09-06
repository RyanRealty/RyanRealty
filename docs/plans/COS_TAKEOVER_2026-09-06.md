# Cos takeover — 2026-09-06

Mirror of Current in `CROSS_AGENT_HANDOFF.md`. If Cos/Grok Bot dies, start here.

## Where we came from
- Grok Build session **Public UI punch list and place-page spec**
- Session id: `01a06fc0-b2f2-7eb2-9e66-a7d1b8f12d07`
- PID/TTY (when found): `80867` / `ttys002` on Matthews-Mini
- Hit Grok Build weekly limit; Cos taking over with Grok Bot credits

## Machine / repo
- Mini: `Matthews-Mini.home.local` machineId `b9f01f4a-2e5a-46bb-abf3-70c65d76b6e4`
- Path: `~/RyanRealty` branch `main`
- Ship path: Mini then `git push` — not Cursor cloud unless Matt opens spend

## Git right now
- **4 commits ahead of origin/main, not pushed:**
  - `7c40065e` hub MOS drawing first viewport
  - `c04e8a97` sell intent redirects + city index slug types
  - `9153b113` listing 12-section house URL order
  - `cf7f714a` stop requiring leftover MOS HUD on listing
- **Staged uncommitted:** `scripts/check-publish-place-index-truth.mjs` (loosen `hud.active`)
- **Pre-commit blocker:** `ci:entity-scope` — `app/admin/(protected)/people/[id]/page.tsx` unscoped; baseline grew 1→2. Fix scope (or justified baseline) before any new commit/push.

## Spec
`docs/plans/PUBLIC_PRODUCT/` — SITE_PAGES, PAGE_INVENTORY, PLACE_PAGES, DATA_GRAPHICS. Done = looked at 1440 + 375 screenshots, not green tests alone.

## Next actions (ordered)
1. Unblock entity-scope → commit staged gate file (or drop it) → push the 4+ commits to `origin/main`
2. Confirm Vercel/production READY on tip
3. Parallel Public Look + Public Patch bots on inventory winners (Homes Field, hub, Tetherow, listing, About/team)
4. Leave Expired/FSBO desks on first-touch; Soft Tail + Clear Night skipped

## Do not
- Mix `_cma-*` worktrees into this thread
- Relitigate leftover HUD vs place openings
- Skip hooks / widen entity-scope baseline without a reason in the commit message
