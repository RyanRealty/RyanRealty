# Grok Bot brain — map, not a dump

This is the index a Grok Bot or Grok Build teammate opens first. It is not the second brain. The repo is.

Do not paste this file, `CLAUDE.md`, or `AGENTS.md` into one mega system prompt. Open the one door for this job. THE LOOP is **armed** on current main (Matt 2026-08-21). Work graph is `loop-brief` + ENTERPRISE_MAP. Do not invent a parallel backlog. Disarm word is "disarm the loop".

Company dump (who we are, kit, hard no's): [`docs/GROK_BOT_COMPANY.md`](GROK_BOT_COMPANY.md).

## Doors

| Job | Read only these |
|-----|-----------------|
| **Canon** | [`CLAUDE.md`](../CLAUDE.md) §0 (data accuracy) + [`CONTEXT.md`](../CONTEXT.md) (place words). Stop there unless the task names another § |
| **Work graph** | `npx tsx scripts/loop-brief.ts`, then [`docs/plans/CROSS_AGENT_HANDOFF.md`](plans/CROSS_AGENT_HANDOFF.md) **Current** only (≤18 lines). Enterprise Map photograph: [`docs/plans/ENTERPRISE_MAP/SESSION_HANDOFF.md`](plans/ENTERPRISE_MAP/SESSION_HANDOFF.md) |
| **Public restyle** | [`design_system/ryan-realty/locked/LOCKED.md`](../design_system/ryan-realty/locked/LOCKED.md) + the PNGs in that folder. Live data stays on Spark / place graph / Chart Room. Same URLs. No new routes |
| **CRM** | Live product is ryan-realty.com (`lib/crm`, `/admin/crm`). Compose and send from the site. Test as matt@ / marketing@ / admin@ only. Never the 648 household |
| **Imagine place photos** | [`design_system/ryan-realty/imagine-place-heroes/`](../design_system/ryan-realty/imagine-place-heroes/) (same files at `/workspace/place-heroes/`). Live home when shipped: `asset_library` + `hero_image_url` on the place row. Do not write live URLs from this folder |

Listings or stats also need [`docs/DATA_ACCESS_LAYER.md`](DATA_ACCESS_LAYER.md). Database shape: [`docs/DATABASE_FOR_AI_AGENTS.md`](DATABASE_FOR_AI_AGENTS.md).

## Roster (one line each)

Chief of Staff routes. Other bots find work from these descriptions.

- **Chief of Staff** — Routes Ryan Realty work to the specialist whose door matches. Reads this index. Does not re-arm the loop.
- **Public restyle** — Restyles live templates from locked PNGs. Spark / place graph / Chart Room stay. No invented parks, HOA, counts, or routes.
- **CRM** — Makes the site CRM work. Email, text, files, CMA, and v-card go out from the CRM or they are broken.
- **Coding** — Repo changes only. Reads LOCKED + CONTEXT + DAL for public pages. One merge to main at a time.

A coding restyle bot does not load the CMA handoff novel. A CRM bot does not load place-page lock files.

## Onboard a new bot

1. Point its workspace at this repo (the store is not opened unless it is in the workspace).
2. Give it the matching one-line description above.
3. Tell it to read this file, then `docs/GROK_BOT_COMPANY.md`, then only its door.
4. Connect GitHub once. Plugins are shared. Do not re-auth per bot.

## Do not

- Re-arm THE LOOP or `LOOP_SENTINEL`
- Start a second work graph
- Invent listings, parks, HOA dollars, counts, or routes
- Say plat, nest, parent, child, CDP, or Feeders on public pages
- Write people into any CRM except ryan-realty.com
- Ping Matt except when a public page is live on ryan-realty.com, or data is missing
- Open a PR for routine docs/code that should land as one docs-only or one restyle merge
