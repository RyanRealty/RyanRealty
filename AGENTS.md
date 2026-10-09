# CORE RULES (read first; these override everything below and any handoff or plan doc)

These outrank every later line in this file, every skill, and every handoff or plan (including `docs/plans/CMA_HANDOFF.md`). If a later line or a plan says to land, fast-forward, or push `main`, ignore it.

**Main.** Code reaches `main` only when Matt merges a pull request. Open a PR to `main`; Matt merges. Never push `main`, never `git push origin HEAD:main`, never fast-forward `main`, never merge `main` yourself, even if a handoff says land or fast-forward. Nobody pushes `main`, including admins.

**Git safety.** No rebase. No force-push. No `git reset --hard`. No `--no-verify`. Push the branch to GitHub right away.

**Do not send.** Emails, texts, CMAs, and social posts stay drafts until Matt asks to send that specific item. A rebuild does not send, enqueue, or approve.

**Names.** Never put buyer or seller names in public copy (site, email, social, letters).

**Invent nothing.** Never invent numbers, names, prices, stats, or people. If it is not in the source you just read, it does not ship.

**Prod DB.** Production Supabase is read-only unless Matt says otherwise in this session. Raw SQL is `-- audit:` row reads only.

**Secrets.** Never print API keys, tokens, passwords, or `.env` values. Never put them in commits, logs, or chat.

**Integrations.** Before saying a service is not connected, search this repo for the existing client, env var, and key. The wiring is usually already here.

**Cursor out.** When Cursor is out (usage, credit, spend, 402, or a 20-minute stall), switch to Matt's Grok subscription: `env -u XAI_API_KEY ~/.grok/bin/grok -m grok-4.6 --reasoning-effort xhigh --always-approve`. Never use `XAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` to get past a limit.

**Keep moving.** Unfinished work: push the branch, add a line to the Current block in `docs/plans/CROSS_AGENT_HANDOFF.md`, and ask Matt short yes/no questions. Do not stop silently. Never ask Matt to run a command.

---

# Agent Protocol — Ryan Realty

This document tells AI coding agents (Cursor, Copilot, Windsurf, etc.) how to autonomously pick up, execute, validate, and complete development tasks on this project.

---

## Active goal (Matt 2026-09-22)

**The site is seen, by search engines and by the AI models people search through, and then converts, as organically as possible.** The objective, how it is measured, and the floors that may not regress are `docs/RUN_LOOP.md` §1. (The 2026-05-22 `/goal`, "acceptance-criteria-passing state", is superseded.)

Every session — Claude Code, Cursor, or Grok — starts here:

0. **`docs/GROK_BOT_BRAIN.md`** if you are a Grok Bot / Grok Build teammate — map only, then open the one door for this job. Do not load the whole canon.
1. **`docs/plans/CROSS_AGENT_HANDOFF.md` Current block** (the file holds exactly one; `ci:handoff-current`) — what the other surface left. Read the archive only for a named SHA.
2. **`npx tsx scripts/loop-brief.ts`** — durable work graph + ship class. That is next work. Not `orchestrate.ts`. Not `docs/SITE_SPEC.md`. When Matt says "run the loop", follow **`docs/RUN_LOOP.md`**.
3. **`docs/DATA_ACCESS_LAYER.md`** when the task touches listings/stats — every page calls `@/lib/data/*`; raw `.from('listings')` outside `lib/data/` is banned.

**Locked CMA process rules. Do not loosen these.**

1. One CMA path. Price on current main only. No second ladder. No 80% send floor. Do not merge PR 408 or any 80% floor. PR 401 stays. Do not revert 770a4fd1.
2. Recommended price is the house from comps only. ADU, second lot, and rental income are letter notes, not dollars, until Matt says otherwise.
3. Hold for Matt if the rec is more than 15% under last ask, or any amount over it. Exactly 15% under is not a hold. Missing ask or missing rec is not a hold.
4. One room rule: same whole bed or bath count anywhere. One whole room apart only on the subject's own plat, mapped neighborhood, or own street, kept and disclosed, zero dollars. Two or more apart refused everywhere. The picker and the review call the same decision. The review must not exclude a sale the picker kept for a room gap this rule allows.
5. Pocket rungs are skipped when the plat and the street already have five sales before the first quarter-mile pocket rung. A cheap different-plat pocket sale drops when no own-plat sale remains in the set that is actually priced. Do not check only the pre-review set.
6. Do not build or send a CMA if the home is listed again. Live status first. Active, pending, or otherwise on the market means skip.
7. A rebuild does not send, enqueue, or approve.
8. Minimum 3 good comp sales. No 2-comp letters. Comp-shortage stays build-failed.
9. Nothing enters the send queue without Matt's review.
10. No owner email until a real owner-path send to matt@ryan-realty.com shows, on that contact, sent, delivered, opened, each link click, and the sell-page visit, with timestamps. Tests must use that production path, not a separate test sender. Every outbound email link is click-tracked. Links are short linked words, never raw tracking URLs. Approved CMA email wording does not change without Matt's sign-off.
11. Approved CMAs send only in the weekday 9:03 AM PT window.
12. Never use buyer or seller names in social, email, or public copy.
13. No em dashes in public site copy.
14. Every change ships as a branch + PR (Matt 2026-10-08). Push the branch to GitHub right away and open a PR to `main`. Matt merges. Nobody pushes to `main`, including admins. No rebase, force-push, or reset.
15. Recommended price is the weighted price of the sales the picker kept. A closer match weighs more. A looser match stays. Location order, heaviest first, is the long-standing search order: same subdivision (weight 3), adjacent subdivisions (weight 2), the neighborhood or community (weight 1). Size and bedrooms come after that and cannot reorder it. A same-subdivision sale outweighs a similar-size neighborhood sale. An adjacent-subdivision sale sits between those two. One size cutoff, the picker's, about 35% living area. The review does not drop a picker-kept sale for a tighter size gap or a 15-year vintage wall. When the first location search is short of 3 comps, widen the closed-sale age and date range. Do not return a short set. The pull walks same subdivision, then adjacent subdivisions, then the neighborhood community, and widens the closed-sale age and date inside each before the next. After that community, distance rings start at 0.25 miles and step up by 0.25 miles. Do not open with a 1-mile ring. Do not fall back to same-zip while a closer place still has sales.
**One rule set (Matt 2026-10-08).** There is no second review. The picker rules are the process. "One rule set. The picker's size cutoff, sales kept out to about a 35% living-area gap, is the only size cutoff. Nothing re-judges a sale the picker kept. If the first search returns fewer than 3 comps that pass, widen the closed-sale age and date range and search again. Do not return a short set with no recovery, and do not run a token-burning review that uses different cuts."
16. An expired, canceled, or withdrawn home that did not sell was overpriced. The recommended price must come out under the last ask. A number that matches the ask, or sits over it, is wrong. The comps still set the price. Location weights stay same subdivision 3, adjacent 2, neighborhood 1, and size and bedrooms cannot reorder that. If the weighted comp price is already under the last ask, leave it. Do not add a second discount. If it is at the last ask or above it, pull it under. With no days on market and no original ask, the pull is $1,000, not a percent. When days on market or an original ask is already on the subject, start at 1% under and deepen with days on market toward 120 days. No price cut, when the original ask is known and did not come down, adds up to 2% more, so 3% at 120 days. A known price cut, or no original ask to judge a cut by, adds at most 0.5% more, so 1.5% at 120 days. The pull floors to the thousand and stays inside 3%. This is only for a home that failed to sell. Do not apply it to a normal comp sale. The hold is separate and unchanged: a rec more than 15% under last ask, or any amount over last ask, is a hold. Exactly 15% under is not a hold. Recommended price is still the house from comps only. ADU, second lot, and rental stay notes, not dollars.
17. A seller CMA letter must not print internal search labels (including own-street-24mo and any similar slug), unfinished sentences, "the N of the M", review tokens such as pass, a list date labeled as the off-market date, or a recommendation the letter says the comps do not support. Each count says what it counts. The new-home sentence matches the table beside it. A local price per square foot that held flat and a large date cut do not both ship. A negligible-weight sale stays in the table when the price counted it, and the letter says the weight is under one percent so it barely moves the price. It is not described as the sale that set the number. A zero room adjustment is explained in plain language or omitted. No buyer or seller names. The generator refuses these shapes in lib/cma/seller-letter-copy.ts. Do not put them back. Each home on the screen cards shows one listing photo when the MLS has one. Do not strip those photos. Each sold comp field prints once on those cards. A card must not paint another card's weight column, and the room-adjustment sentence is not clipped.
18. Sold information on a CMA includes seller concessions (or seller-paid closing costs) when the MLS already stored an amount. Comparison matrices factor that amount into the sale they adjust. A sale price that ignores a recorded concession is wrong. When the sale reported none, print none or zero; do not hide the line. Do not invent a concession amount. Adjusted matrix figures, the prices that set the recommendation, and any sold summary must use the same concession-adjusted sale.
19. A resale built within 5 years of the as-of date still prices with brand-new homes that have never been owned. That window is the custom/new year band already in the pricer, as-of minus year built at most 5, not a new cutoff. The 0-2 year mark still means the house itself is a new build and still wins over a false new-construction flag. The 15-year band is still one construction generation among custom and new homes. A 2021 resale as of 2026 is inside the window, so those brand-new sales stay in the price set. That is why the new homes are the higher price. After 5 years, a resale with the new-construction flag false, and without custom-quality remarks or a new-construction subtype, is not priced as the same product as never-owned new construction. When the subject is a resale inside the window and the sales that set the price include never-owned new homes, the seller letter says, in plain sentences, that this home is basically a new home, but it is competing with brand-new homes that have had no previous owner, at that same price point, so it will likely sell for less. Do not invent a dollar discount. The recommended price stays the weighted sales. The letter and the matrix name the same homes.
20. The count you use is the count you show. If the price uses 4 sales, the letter says 4 and the table shows 4. If it uses 5, say 5 and show all 5. Same for 7, 8, or 3 expired listings. A headline, sentence, or adjusted-price line never counts a sale or an expired listing that is missing from the table. Say a sale was added from the subject's own street only when that sale is on the subject's street. A sale in another subdivision is named, with that subdivision. Do not call it the subject's street.
21. A townhouse subject uses closed townhouse sales. sale_pricing_facts stores those closes as product_class attached, not townhouse, so the facts pool filters property_sub_type to townhouse and classes the row as townhouse. Do not pull condos, apartments, or other attached homes just because they share product_class attached. Do not change how single-family comps are chosen.
22. Community membership is the location of the address, for every community. It is not the MLS SubdivisionName and not a one-community exception. A sale belongs to the subject's community when its latitude and longitude sit inside that community boundary, or inside a plat that sits in that community, even when the MLS subdivision name is a different plat. A sale does not belong because the remarks mention the community. The search order is own subdivision, then adjacent subdivisions, then the neighborhood community, then distance. A point inside a recorded plat is a member of that community even when the MLS subdivision name differs. A remarks mention of the community or the golf course is not membership. Distance rings start at 0.25 miles and step up by 0.25 miles. Do not open with a 1-mile ring. Do not replace that order with a radius search.
23. A recommended price under every sale that set it, or above every one of them, is not a price. The set is wrong, or the result is a hold. Do not print a number outside that set. A sale does not set the price when it is a different community than the subject, or a clearly different size or product: a house much larger or much smaller than the one living-area cutoff, a cottage versus acreage, or a different plat that is not the subject's community. A different MLS name inside the subject's community still sets the price. Community membership stays the location of the address. The search order is unchanged.
24. Expired and FSBO intake (Matt 2026-10-05). A CMA is built when we hold a sendable owner email, or a cell number we can text. Before `createCmaRequest` and before the CRM person is created, in this order: live status, then compliance, then email, then a cell. Live status skips Active, Pending, Coming Soon, and Closed after the expiry, matched on the same address or the same parcel or taxlot. Compliance skips a litigator and a deceased owner. The litigator tag is applied only when the skip-trace says the person is a litigator. TCPA-only and a DNC phone block calls and texts. They do not block email and they do not set `compliance:hard-stop`. A sendable, non-suppressed email still builds the CMA and the send stays email. With no sendable email, a non-DNC cell whose line type is mobile, wireless, or cell builds the CMA and the send is SMS. A landline, a VOIP number, or a phone with no line type does not. An untyped listing-page phone is not a cell. A suppressed email is not used. A clean cell still builds, and that send is SMS. Nothing texts the owner from intake. The existing prospect SMS intro sends after the letter is approved. Do not put this gate in `sendCmaToLead` or `createCmaRequest`. Those also serve inbound seller and lead-form CMAs. The source of truth is `expired_listings.compliance_hard_stop` and `compliance_flags`, and the same columns on `fsbo_listings`. Every expired and FSBO send path reads them. A litigator or deceased owner sets the column so the send stays blocked. See `.cursor/rules/expired-fsbo-intake.mdc`.
25. **UTM convention (Analytics fix 8, 2026-10-08).** Every outbound ryan-realty.com link is built with `buildTrackedUrl` in `lib/analytics/utm.ts`. One UTM set per URL (existing `utm_*` are replaced, never appended). No street addresses, person names, or per-property slugs in any `utm_*` value. Test/preview sends use `test: true` so `utm_campaign=test-<campaign>`. CMA document identity rides in first-party `rr_doc=<cmas.slug>`, not in `utm_campaign`. Details: `.cursor/rules/utm-convention.mdc`.

| Param | Allowed values |
|---|---|
| utm_source | `crm`, `cma`, `gbp`, `facebook`, `instagram`, `x`, `youtube`, `newsletter`, `zillow`, `realtor`, `referral-<domain>` |
| utm_medium | `email`, `sms`, `organic`, `social`, `paid_social`, `cpc`, `document`, `referral`, `qr` |
| utm_campaign | stable program slug: `cma-letter`, `expired-outreach`, `fsbo-outreach`, `market-report-YYYY-MM`, `open-house-weekly`, `listing-launch`, plus `listing-alerts`, `gbp-profile`, `newsletter`, `social-post`, `crm-outbound` |
| utm_content | variant: `v2`, `cta-top`, `listing-<listing_key>`, `agent-<slug>` (never an address) |
| utm_term | paid keyword only (medium `cpc` or `paid_social`) |
26. **Grok fallback when Cursor is out (Matt 2026-10-08).** Bots never stop because Cursor is out. When a Cursor cloud agent or CLI hits a usage, credit, spend or on-demand limit (or a 402), or stalls for 20 minutes, switch at once to the Grok CLI on Matt's Grok subscription: `env -u XAI_API_KEY ~/.grok/bin/grok -m grok-4.6 --reasoning-effort xhigh --always-approve -p ...`, run in a fresh worktree branched from origin/main (skill: grok-fallback-when-cursor-is-out; helper: `/home/box/agent-data/tools/grok-code-pr.sh`). Never use XAI_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY to get past a limit. Every other rule still holds: land per rule 14, DB read-only unless Matt says otherwise, no secrets printed, no sends. Tell Matt you switched, with the exact Cursor error, and the PR link. If Grok's login is also out, stop and ask Matt to re-login. Don't wait silently.
29. A sale the letter prints outside the price chapter says why it does not set the price (Matt 2026-10-08, delegated; 2745 Aldrich). Any closed sale printed outside the price chapter (the plat or neighborhood history list, a map, a caption) that is not one of the sales that set the price says so once, beside it, in the words the engine recorded. 2745 Aldrich's plat list led with 2764 Spring Water, $525,000, Nov 2025, 1,574 sq ft against this home's 1,201 (31% larger). Rule 20 keeps that sale out of the price, and the letter says so beside it: "1,574 sq ft, 31% larger than this home; sales more than 25% larger or smaller do not set the price." The renderer prints that recorded sentence and does not recompute the gap, the community, or the product. The walk records the sale and the reason when rule 20 refuses it (notSettingSales on the facts walk, not_setting_sales on the selection). A printed sale the walk did not record is asked of the same price-set decision, or of the set-aside record when that is why it carries no weight, and that sentence is what prints. A sale that sets the price gets no such line. The price set does not change, and PRICE_SET_SQFT_BAND does not change. Map pins that already carry a set-aside sentence are not labeled a second time. Held by lib/pricing/price-set.test.ts, lib/pricing/match.test.ts, and lib/cma/excluded-sale-note.test.ts.
30. The live letter draws the one comps map (2026-10-09, 2745 Aldrich). render_args omits the tile, so every view rebuilds it. That rebuild is not an optional 4-second read. The map has its own budget, long enough for a cold boundary read and the static tile, and it starts with the other serve reads. A finished tile is cached by the document slug plus a hash of the map inputs (the coordinates, the product, and the homes the map pins), through the unstable_cache door. A stored row gets that map with no database write. The plat polygons are read together. When the tile cannot be drawn, the page prints no map caption, no pin legend, and no sentence that says every pin above. A cream scatter with no tile is not that map. The matrices do not claim a map that is not there. Held by lib/cma/serve-map.test.ts, lib/cma/map-tile-cache.test.ts, lib/cma/map-tile-parallel.test.ts, and the lookpass --check map image assertion in lib/cma/lookpass-chapters.ts.


`docs/EXECUTION_PLAN.md` and `docs/SITE_SPEC.md` are 2026-05-22 fossils (SITE_SPEC still describes an AgentFire WordPress cutover that already shipped). Do not execute them.

**Done = the served ship class is locally accepted, then one `npm run push` + `deploy:verify` when the app changed.**

**Fresh environment** (no `node_modules`, no git hooks): run `bash scripts/cloud-setup.sh` first. It installs the dependencies, the git hooks and the brand fonts. Claude Code cloud sessions get the same from `.claude/hooks/session-start.sh`.

**After a deploy, check Sentry** for new errors since it went live: org `ryan-realty-llc`, project `ryan-realty-platform` (Claude sessions have the Sentry connector). Server errors report through `sentry.server.config.ts`; browser errors through `lib/observability/client-errors.ts`, which loads the SDK only when an error happens, so the SDK never ships with the page.

Out of scope: `marketing_brain_skills/`, `video_production_skills/`, social posting automation, transaction coordination. Only the public LP website and the CI guardrails that protect it.

---

## Execution (non-negotiable)

Run every needed command yourself (`npm run …`, scripts, git, deploy checks, SkySlope generators). **Never** tell the owner to run something in a terminal. The only exception is when something cannot run without secrets or access you do not have, in which case state exactly what is missing.

---

## Claude Code ↔ Cursor (one pipeline)

Matt alternates between **Claude Code** and **Cursor**. Both are the same repo and the same bar: **no divergent rules, no mystery state in the other tool.**

### Start of every session (any tool)

1. `git fetch origin` and branch from current `origin/main`. Do not rebase, force-push, or reset. All code work is pushed to GitHub as a branch right away (locked process rule 14).
2. If you are picking up mid-thread from the other surface, read the newest `~/.claude/plans/HANDOFF-*.md` when one exists (narrative); otherwise **`git log origin/main -5`** is enough.
3. What you can reach (Supabase, the Google service account, Gmail, Vercel, GitHub, the rest) is in [`docs/ACCESS_INVENTORY.md`](docs/ACCESS_INVENTORY.md). Never ask Matt what access you have (Matt 2026-10-07). A provider refusal is a scope or grant to name precisely, not a question.
4. **The public origin is https://ryan-realty.com. Never use `ryanrealty.vercel.app` for anything outward** (a link, email, SMS, canonical, OG or sitemap URL, PDF, redirect, lead source, or a URL a script prints or posts; Matt 2026-10-07). `siteOrigin()` / `siteUrl()` / `siteHost()` in [`lib/site-origin.ts`](lib/site-origin.ts) (plain-node scripts: `scripts/lib/site-origin.mjs`) is the only way to build an outward URL; never read `NEXT_PUBLIC_SITE_URL` directly (production still holds the alias). Held by `ci:site-origin` (G81).

### Ship discipline (non-negotiable)

1. **Production truth is `origin/main`.** All code work is pushed to GitHub as a branch right away. Every change ships as a branch + PR to `main`; Matt merges. Nobody pushes to `main`, including admins (Matt 2026-10-08). No rebase, force-push, or reset. Unfinished work still gets a line in `docs/plans/CROSS_AGENT_HANDOFF.md`. Network failure is the only excuse for the branch not being on origin yet. Say that explicitly.
2. **Production follows Git.** Pushing `main` triggers Vercel production when the diff affects the Next app; “shipped” means Matt merged the PR and remote `main` is updated and, when app code changed, the production deploy is **READY** (see `.cursor/rules/deploy-verify-before-done.mdc`). Docs/skills/changelog-only pushes are skipped by `scripts/vercel-ignore-build.mjs` (`vercel.json` → `ignoreCommand`).
3. **No hanging migrations.** New files under `supabase/migrations/` are not real until they run on **hosted** Supabase. Apply them in the **same delivery effort** as the code that needs them — never “commit now, migrate later” (`.cursor/rules/supabase-migrations-auto.mdc`, `.cursor/rules/production-parity.mdc`).
4. **Branch, then push.** Day-to-day edits go on a branch from current `origin/main` and that branch is pushed to GitHub right away. Use linked worktrees for parallel agents, not as a silent parking lot. See **Worktrees** below.

### Cost-aware push (main + worktrees)

July 2026 Pro spend was dominated by **Build CPU Minutes**, not traffic. Change *when* and *what* you push:

1. **Runtime changes** (`app/`, `components/`, `lib/`, `public/` used by the app, `package.json` / lockfile, `next.config.*`, `vercel.json`, `supabase/migrations/`) → finish the task, **one commit on the branch**, `NODE_OPTIONS=--max-old-space-size=8192 npm run push` (pushes that branch, not `main`), then `npm run deploy:verify` when the user-facing app changed and Matt has merged the PR.
2. **Docs / skills / rules / plans / handoffs only** → **batch into one commit**, then push once. Local `npm run push` already skips `next build` for non-buildable diffs; Vercel skips the remote build via `ignoreCommand`. Do not drip many docs commits that each burn local `ci:gates`.
3. **Do not push mid-thought.** Commit locally while iterating if you need a restore point; push when the unit of work is coherent.
4. **Ship class (fleet / loop):** same-category bot findings share one isolated verify + one production deploy. `loop-brief` prints the class. Do not run `npm run push` after each finding.
5. **R-221 — do not poll GitHub Actions.** One `ci:gates` per ship. After a green local stamp + push, stop. Do not `gh run view` in a loop. Do not rematch `origin/main` unless GitHub says CONFLICTING. Live-DB int tests are nightly (`test:int`), not a reason to sit idle.
6. **Release / changelog:** GitHub Releases carry the notes. Do not recreate a `chore: update changelog` commit on `main` — that path burned hundreds of full production builds.
7. **Worktree branches:** push them to GitHub right away. Do not keep the only copy local. Do not merge them to `main` yourself. Open a PR to `main`; Matt merges.

### Worktrees (allowed — design against stranded work)

**When to branch from current `origin/main`:** single-agent bugfix, small feature, docs, anything that should be on GitHub right away.

**When to use a worktree:** two agents editing disjoint areas; a long experiment that would block `main`; Cursor ↔ Claude Code isolation; cloud agent checkouts.

**Anti-strand rules (mandatory):**

1. Branch name: `wt/<topic>-YYYYMMDD` (or harness names like `claude/…`). Push the branch before stop, or write the handoff.
2. Path: sibling dir such as `../RyanRealty-wt-<topic>` — not nested inside the primary tree.
3. Session end: push the branch to origin with `npm run push`. Do not merge, rebase, force-push, or reset onto `main`. If work is unfinished, also write branch + absolute path + next step into `docs/plans/CROSS_AGENT_HANDOFF.md` Current block on that branch.
4. Cleanup when merged: delete branch, `git worktree remove <path>`, `git worktree prune`. Run `node scripts/worktree-hygiene.mjs` at session start/end.
5. Never leave the only copy of valued commits in an unpushed worktree with no handoff line.

### What the other environment should read

| Layer | Source |
|-------|--------|
| What actually shipped | `git log origin/main` |
| Backlog / next task | `npx tsx scripts/loop-brief.ts` (work graph). `task-registry.json` / `orchestrate.ts` are complete (49/49) — do not pick work from them. |
| Optional handoff notes | `~/.claude/plans/HANDOFF-*.md` — add or update when switching tools with context the repo does not carry |
| **Cross-agent continuity (required when switching)** | **`docs/plans/CROSS_AGENT_HANDOFF.md`** — replace the one **Current** block before you stop or when Matt moves to the other tool. The other agent must **read it after `git pull`** before deep work. |
| **Grok Bot / Grok Build fleet** | **`docs/GROK_BOT_BRAIN.md`** — index. Company dump is `docs/GROK_BOT_COMPANY.md`. Do not paste either into a mega system prompt. |
| **Global skill index (Cursor + Claude)** | **`~/.claude/GLOBAL_SKILLS_REGISTRY.md`** — full path list of every `SKILL.md` on this machine (plugins, repo, TC, Cowork notes). **Git mirror:** `docs/plans/GLOBAL_SKILLS_REGISTRY.md`. **Cursor stub:** `~/.cursor/GLOBAL_SKILLS_REGISTRY.md`. |
| **Database reference (required before ANY SQL or market-report work)** | **[`docs/DATABASE_FOR_AI_AGENTS.md`](docs/DATABASE_FOR_AI_AGENTS.md)** — every table grouped by purpose, the cache model (`market_pulse_live` 10-min freshness, `market_stats_cache` 6-hour freshness), 14 resort communities + 14 Bend neighborhoods + city/region levels, the `listings` 800-field reality with mixed-case quoting rules, methodology versioning, slug formats. Source-of-truth registry: **[`data/resort-communities.json`](data/resort-communities.json)**. Don't aggregate raw `listings` for market reports — use the cache. |

**Cursor:** `.cursor/rules/` as usual. **Claude Code:** `CLAUDE.md` in this repo mirrors ship discipline; stay aligned with this section.

### Cross-agent handoff (mandatory when work spans tools)

1. **Push the branch to origin first** (nothing handoff-worthy should be unpushed). Do not merge it to `main`.
2. Open **`docs/plans/CROSS_AGENT_HANDOFF.md`** and replace the **Current** block (exactly one; never stack a second, `ci:handoff-current` fails it; carry any still-open Matt directive forward): surface, time, commit SHA, what finished, what is next, blockers, which **`SKILL.md` files you actually read**.
3. Optionally also write narrative under **`~/.claude/plans/HANDOFF-*.md`** for Claude Desktop-only context (paths on disk, local-only experiments)—still assume the other agent only **pulls git** and reads **`CROSS_AGENT_HANDOFF.md`**.

### Skills (load before substantive work)

If a workspace **skill** might apply—even slightly—**read its `SKILL.md` first** (use the Read tool on the full path), then follow it. Do not improvise domain workflows (Supabase, deploy, Oregon brokerage, SkySlope, video skills, etc.) without loading the matching skill.

**Where to look**

- **Master index:** `~/.claude/GLOBAL_SKILLS_REGISTRY.md` or **`docs/plans/GLOBAL_SKILLS_REGISTRY.md`** (same content) — scan here first so you do not miss a plugin or TC-only skill.
- **Any public page (build, restyle, new section, chart):** read **`design_system/public/TASTE.md`** first — the page to beat, banned tells, interaction on every data section, and the evaluator pass by a SEPARATE agent recorded as `tasteReview` in the route's parity.json. Enforced by `ci:taste-canon`. This binds every tool (Claude, Cursor, Grok, anything pointed at the repo).
- **Any public site work (any tool):** the backlog is the site queue in `loop_work_nodes` (domain `public-ux`, version_gap `SITE-*`). Follow **`docs/RUN_LOOP.md`**: it holds the claim path, the accept test, the land path and the stop rule for every tool, and nothing here restates them. Lane mechanics: `.claude/skills/site-queue/SKILL.md` (Cursor and Grok: `.cursor/skills/site-queue/SKILL.md`). Site commits carry a `Node: <id>` trailer (G72, commit-msg hook). Do not write a new site audit; append findings to a node.
- **This repo:** `.cursor/skills/**/SKILL.md` (e.g. Oregon OREF, OREA PB, SkySlope, professional Word, etc.)
- **Cursor-bundled / plugin skills:** paths under `~/.cursor/plugins/.../skills/**/SKILL.md` when the task matches their description (Next.js, Vercel, Supabase, TDD, debugging, etc.)
- **Video:** no producer `SKILL.md` remains. Rules live in `CLAUDE.md` §4. Caption modules only: `video_production_skills/captions/canonical/`.
- **Publishing trigger:** if Matt says "go ahead and publish it" after approving content, load `automation_skills/automation/publish/SKILL.md` (and know the live path is `/api/cron/publisher-sweep` → `/api/social/publish`)
- **Cowork-only skills** (e.g. mounted **docx** under `mnt/.claude/skills/`): see section **E** in the global registry; copy into `~/.claude/skills/` if you need the same skill in Claude Code CLI.
- **Marketing, advertising, paid social, Meta or Facebook or Instagram ads, lead generation, seller acquisition, CPL or CAPI, weekly optimization packets, `agent_insights` marketing rows:** Read **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** first (canonical end-to-end system map). For **how each path creates a lead** (webhooks, forms, dedup, sinks), read **`docs/MARKETING_LEAD_FLOW.md`**. Then **`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`** for launch checklist and budgets. For the recurring optimization routine load **`.cursor/skills/facebook-seller-growth/SKILL.md`** (and append learnings to **`docs/marketing/facebook-seller-growth-LEARNINGS.md`**). Cursor surfaces **`.cursor/rules/marketing-advertising-workflow.mdc`** when the task matches these topics.

**Heuristic:** Task mentions migrations → read Supabase skill; task mentions ship → read deploy / verification skills; task mentions rules → read `create-rule` skill before authoring rules. When unsure, grep `SKILL.md` titles or ask once; prefer loading an extra skill over skipping.

---

## Quick Start

```bash
# See what the work graph wants next
npx tsx scripts/loop-brief.ts
```

## Sync Status Handoff (Mandatory for sync questions)

When a user asks about sync/backfill status, run this first:

```bash
node scripts/sync-status-report.mjs --json
```

Then use:

- `docs/SYNC_HANDOFF_PLAYBOOK.md` for decision flow and command options
- `/admin/sync` for visual confirmation

### Natural language trigger phrases (treat as equivalent)

If the user says any variation of these, the agent MUST execute the sync-status flow above before asking follow-ups:

- "what's the sync like"
- "what's up with the sync"
- "what is sync status"
- "where are we at on sync"
- "where are we at with the sync"
- "research sync procedures"
- "research sync status"
- "tell me what options I have"
- "what can I run right now"
- "what should I run next"
- "start sync"

Required response format for these prompts:
1. Current snapshot (key counts + cursor state)
2. **Active listing freshness:** Summarize `activeListingFreshness` from the same JSON (`lastDeltaSuccessAt`, `minutesSinceLastDeltaSuccess`, `deltaHealth`, `counts.deltaEligibleListings`, `activityEventsLast24h.byEventType`, and the `pipeline` object). This is how live inventory stays current via `sync-delta`.
3. **Strict verification:** Always summarize the `strictVerification` object from the same JSON report (`counts` for global and terminal-only backlog, `adminDashboardForLiveDeltas` for live activity on `/admin/sync`). This is distinct from terminal finalization remaining (`totals.terminal.remaining`).
4. Full `listingYearsBreakdown` from `node scripts/sync-status-report.mjs --json` (coalesce ListDate or OnMarketDate cohorts), unless the user asks for a short summary only. Also reference `yearsFinalization` or `listingYearsOnMarketBreakdown` (OnMarketDate only)
5. Year finalization status from `yearsFinalization` (DB on-market stats; see `yearsFinalizationNote` in JSON; year-by-year Spark chunk sync was removed)
6. Health callout (moving, stalled, or rate-limited)
7. Top 2-3 commands to run now (from `docs/SYNC_HANDOFF_PLAYBOOK.md`)
8. Wait for user selection ("run option 1/2/3")

For "start sync", do not ask follow-up questions first:
1. Execute: `curl -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/start-sync"`
2. Confirm blockers cleared (`paused=false`, `abort_requested=false`, `cron_enabled=true`)
3. Confirm lane kick responses (`fullChunk`, `terminalChunk`, `deltaChunk`)
4. Report "sync running" confirmation with latest cursor timestamps

### Exact trigger: "Give me a sync status"

When the user says exactly or approximately "Give me a sync status", agents MUST return a detailed operational report, not a short summary.

Required details:
1. Current totals (listings, history rows, terminal remaining, finalized, verified full)
2. Full **`activeListingFreshness`** block (delta cadence, last success time, delta-eligible inventory count, 24h `activity_events` mix, pipeline from live updates through terminal to strict backlog)
3. Full **`strictVerification`** block from the same JSON (all-listing vs terminal-only strict backlog, verified full counts, `adminDashboardForLiveDeltas`; clarify that terminal strict backlog is what `sync-verify-full-history` drains)
4. Complete `listingYearsBreakdown` and, for year-lane alignment, `listingYearsOnMarketBreakdown` or `yearsFinalization` from the status report JSON
5. Year finalization status (`yearsFinalization` finalized/total/remaining; year lane retired so matrix job progress fields are not live)
6. What is running right now (cursor phase, updated timestamps, paused/abort flags if available)
7. Latest lane activity (cursors, delta freshness, `strictVerification.runTelemetry` recent runs)
8. Approximate time to parity (ETA) with a clearly stated method and assumptions
9. 2-3 concrete run options the user can choose immediately

---

## Development Environment

| Tool | Details |
|------|---------|
| Runtime | Node 20, npm |
| Framework | Next.js 16.1.6, React 19, TypeScript 5 |
| Database | Supabase (PostgreSQL), migrations in `supabase/migrations/` |
| Styling | Tailwind v4, shadcn/ui components only |
| Testing | Vitest (unit), Playwright (E2E + visual), Lighthouse CI (perf), pa11y-ci (a11y) |
| Deployment | Vercel |
| CRM | In-house (`public.crm_people`). |
| Data Feed | Spark/MLS API |

**GA4 / automation browsers.** Any script that opens our site (ryan-realty.com, localhost, 127.0.0.1, `*.vercel.app`) in a browser sets `rr_automation=1` and `rr_internal=1` before the first page load and never grants analytics consent; use `scripts/lib/marked-playwright.mjs`.

### Running Locally

```bash
npm install                  # Install dependencies
npm run dev:unix             # Start dev server (Linux/macOS)
npm run build                # Production build verification
npm run test                 # Run unit tests
npm run test:e2e             # Run E2E tests (requires build first)
npm run test:e2e:ui          # Open Playwright UI mode
npm run lint                 # Run ESLint
npm run lint:design-tokens   # Check for design system violations
npm run lint:seo-routes      # Check SEO route authoring
npm run docs:check           # Check documentation freshness
```

---

## How to Pick Up Work

1. Run `npx tsx scripts/loop-brief.ts` and take the printed ship class (or the named task Matt gave you)
2. Discover the live path from `app/` + `vercel.json`, not from ENTERPRISE_MAP inventories
3. Do not start `orchestrate.ts` or walk `docs/SITE_SPEC.md` checkboxes

### Priority Order

Tasks are prioritized by:
1. Priority field: `high` > `medium` > `low`
2. ID order (earlier phases before later, lower IDs first)
3. Dependency chain (blocked tasks are excluded)

---

## How to Execute

### Rules to Follow

All rules in `.cursor/rules/` are mandatory. Key rules:

| Rule File | What It Covers |
|-----------|---------------|
| `design-system.mdc` | shadcn/ui components only, semantic color tokens only |
| `server-actions.mdc` | `'use server'` header, return `{ data, error }` never throw |
| `error-handling.mdc` | Server: return errors. Client: use sonner toasts. No `alert()` |
| `auth-patterns.mdc` | Use `getSession()`, `normalizeAvatarUrl()`, gate routes at top |
| `supabase-data-layer.mdc` | Use cached stats, correct client for context, never `select(*)` |
| `git-commit.mdc` | Conventional commits: `feat:`, `fix:`, `chore:`, etc. |
| `sliders-no-scrollbars.mdc` | Arrow navigation, no visible scrollbars on carousels |
| `master-plan-protocol.mdc` | File ownership matrix enforcement |

### Firm facts (one number per fact, Matt 2026-10-08)

- **Founded 2014, everywhere.** JSON-LD `foundingDate` is `BRAND.llcSince` ("2014"). Prose says
  "Matt Ryan founded Ryan Realty in 2014" (Matt confirmed the wording 2026-10-08; never tie 2014
  to the LLC filing) and "opened the Bend office in June 2023". June 2023
  (`BRAND.bendOfficeOpened`, the OREA affiliation date) is the Bend office, never the founding.
- **Firm closings: one headline count.** Every closed MLS sale where a Ryan Realty broker was the
  listing or buyer's broker, once per ListingKey, any area (`app/team/_v3/firm-record.ts`). A
  977-zip subset is printed only as "N in Central Oregon". Never sum per-broker counts; never
  label closings as "clients served".
- **License 201253677 is a "registered business name" license** (OREA License Lookup), not a
  "firm license" (`BRAND.firmLicense`). No new "licensed since" year or year count: the issue
  date is not on the lookup.
- **Hand-counted facts carry their count date** (review themes, neighborhood names): print the
  date they were counted, and re-count when the underlying total moves.
- **Counts bind live.** Never hard-code a closings or review count in copy; read it from the
  record on render, and re-check it against live data on the day a change ships.
- **Public copy never says who Ryan Realty is not a fit for** (Matt 2026-10-08: "we're the right
  fit for every single person"). Say who we help; no "not the right fit" lists or fit/no-fit framing.

### Design System (Zero Exceptions)

- **Components**: Only use shadcn/ui from `@/components/ui/`. See `CLAUDE.md` for the full mapping.
- **Colors**: Only semantic tokens (`bg-primary`, `text-foreground`, `border-border`). No hex, no `bg-white`, no `bg-gray-*`.
- **Utilities**: Use `cn()` from `@/lib/utils` for conditional classes.
- **Fonts**: Geist Sans (`font-sans`) and Geist Mono (`font-mono`) only.

### Browser analytics events (locked, Matt 2026-10-08)

- Browser events reach GA4 only through GTM's GA4 Event tag: push them with `trackEvent()` / `pushDataLayerEvent()` (`lib/analytics/ga4-browser-events.ts`), never `gtag('event', …)` for GA4, and add a new event name to `GA4_BROWSER_EVENTS` plus the GTM steps in `docs/GTM_GA4_BROWSER_EVENTS.md` (Matt publishes GTM). Held by `lib/analytics/ga4-browser-events.test.ts`.

### Server Actions

```ts
'use server'

export async function doThing(): Promise<{ data: Result | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('table').select('col1, col2').eq('id', id)
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (err) {
    console.error('[doThing]', err)
    return { data: null, error: 'Something went wrong' }
  }
}
```

**Lead event (locked, Matt 2026-10-08):** GA4 `generate_lead` is sent only from the server through `fireLeadGenerated` (`lib/lead-tracking.ts`), with a `lead_type` from the fixed list and a `form_id` in `lib/analytics/lead-event.ts`; never `value` or `currency` (no dollar values on leads); never from the browser, never `fireGa4Event('generate_lead')` directly, and a non-lead (recruit, newsletter) uses `fireNonLeadEvent`. `lib/analytics/lead-event.test.ts` holds it.

### File Ownership

The ownership matrix in `docs/plans/master-plan.md` is enforced. Check it before modifying files owned by another workstream:

| Owner | Key Files |
|-------|-----------|
| Reporting | `app/actions/market-stats.ts`, `components/reports/*`, `app/api/cron/sync-full/route.ts` |
| Engagement | `app/search/[...slug]/page.tsx`, `app/page.tsx`, `app/listing/[listingKey]/page.tsx` |
| Monetization | `components/AdUnit.tsx`, `app/layout.tsx` (banner), `app/guides/*`, `app/sitemap.ts` |
| Admin | `app/admin/*` |
| Shared | `lib/crm/send-event.ts`, `components/ShareButton.tsx` |

---

## Quality Gates

Run these before committing:

```bash
# Minimum (always)
npm run test
npm run build

# If you changed UI components
npm run lint:design-tokens

# If you changed routes or pages
npm run lint:seo-routes

# Full gate (recommended)
npm run quality:full
```

### Pre-commit Hook

Runs `npm test` automatically. If tests fail, the commit is blocked.

### Pre-push Hook

Runs `npm run quality:local:strict` (design tokens + test + build). Set `SKIP_LOCAL_GATES=1` to bypass (sparingly).

### CI Pipeline (GitHub Actions)

On PR to `main`:
1. `npm run lint` — ESLint
2. `npm run lint:seo-routes` — SEO route authoring checks
3. `npm run ci:design-tokens` — Design token compliance
4. `npm run test` — Vitest unit tests
5. `npm run build` — Production build
6. Build health metrics recorded
7. `npm run ci:lighthouse` — Lighthouse performance/a11y/SEO scores
8. `npm run ci:a11y` — pa11y accessibility audit
9. Bundle size report posted as PR comment
10. **E2E tests** — Playwright critical flow tests
11. **Visual regression** — Screenshot comparison against baselines
12. **Security scan** — npm audit + secret leak detection
13. **PR auto-labeling** — Labels by area and type
14. **PR metadata labeling** — Labels by area and change type

On merge to `main`:
15. **Automated release** — Changelog generated, version tag created, GitHub Release published
16. **Post-deploy smoke tests** — Key pages tested after Vercel deploy
17. **Preview deploy testing** — Smoke tests on Vercel preview URLs

Scheduled:
18. **Dependency updates** — GHA `dependency-updates.yml` Monday 09:00 UTC
19. **Security scan** — GHA `security.yml` Tuesday 08:00 UTC
20. **Marketing optimization report** — Vercel `/api/cron/marketing-optimization-report` Monday 06:30 UTC (not a GHA “optimization loop”)
21. **Stale branch cleanup** — GHA `cleanup-branches.yml` 1st of month
22. **Saved search alerts** — Vercel `/api/cron/saved-search-alerts` **hourly**, not daily 2pm GHA
23. **Market report** — Vercel `/api/cron/market-report` **Sunday** 14:00 UTC, not Saturday GHA

---

## How to Validate

```bash
npm run ci:gates
npm test
```

If UI or routes changed, the matching `ci:*` members are already in `ci:gates`. Do not invent a second orchestrator validate step.

---

## How to Complete

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run push   # the branch, not main
```

`orchestrate.ts complete` is retired. The work graph updates from loop/sentinel, not from that CLI.

## CRITICAL: Push the branch and open a PR. Matt merges. Nobody pushes `main`.

**Production deploys from `main` only. Every change reaches `main` only through a PR that Matt merges. Nobody pushes to `main`, including admins (Matt 2026-10-08).** Routine work: commit on a branch from current `origin/main` and `npm run push` that branch, then open a PR to `main`. Do not merge, rebase, force-push, or reset. Do not leave the only copy of valued work unpushed. Unfinished work gets a line in `CROSS_AGENT_HANDOFF.md`.

```bash
# DEFAULT: push the branch, not main
NODE_OPTIONS=--max-old-space-size=8192 npm run push

# WORKTREE: branch from current origin/main, push the branch, do not merge it
git fetch origin
git worktree add -b wt/crm-mobile-20260726 ../RyanRealty-wt-crm-mobile origin/main
# …work in the other checkout…
# npm run push of that branch. Do not merge it to main.

# WRONG
# merge, rebase, force-push, or reset onto main yourself
# leave the only copy of the work unpushed, with no handoff
```

## Production parity (code + database + Vercel)

**https://ryan-realty.com** reflects “everything current” only when **`main` is on Vercel production** and **hosted Supabase** has **all migrations applied** that the shipped code needs. SQL under `supabase/migrations/` is not live until it runs against the production database. See `.cursor/rules/production-parity.mdc` and `.cursor/rules/supabase-migrations-auto.mdc`.

---

## Adding New Work

Put it on the work graph (`loop_work_nodes` / `/admin/loop`), not `orchestrate.ts add`. If Matt named the outcome in chat, that is the ticket.

---

## Key Architecture Decisions

1. **Market stats**: Always use `getCachedStats()` and `getLiveMarketPulse()` from `app/actions/market-stats.ts`. Never compute stats on the fly. Stats use `ClosePrice` for sold metrics, `percentile_cont` for true medians, and filter on `StandardStatus` for closed sales only. See `.cursor/rules/data-architecture.mdc`.
2. **Listing URL**: Canonical form is generated by `listingTileHref()` / `listingCanonicalHref()` from `lib/slug.ts`. Target format uses MLS number (ListNumber) + address slug: `/homes-for-sale/{city}/{community}/{address-slug}-{mlsNumber}`, with `{city}` = MLS `City` and `{community}` = MLS `SubdivisionName` only (P14, 2026-09-23: polygon fields moved the canonical on every reclassification; every other path ending in the key now 308s to it in `middleware.ts`, and `lib/routing/listing-canonical-pins.json` pins it). When community is unavailable: `/homes-for-sale/{city}/{address-slug}-{mlsNumber}`. Fallback when location data is incomplete: `/homes-for-sale/listing/{mlsNumber}`. Old ListingKey-based URLs 301-redirect to canonical. Legacy `/listings` browse URLs redirect to `/homes-for-sale`. See `.cursor/rules/data-architecture.mdc` for the full URL specification.
3. **Team URL**: Canonical form is `/team` and `/team/{slug}`. The `/agents/` route redirects.
4. **Lead capture**: StickyMobileCTA and SiteLeadCaptureBanner must not both be visible simultaneously.
5. **Ad placement order**: existing sections → AreaMarketContext → AdUnit → Similar Listings → ActivityFeedSlider → RecentlySoldRow → Sidebar ad below CTA.
6. **Filter page links**: Browse-by UI links to `/search/{city}/{filter}` routes, not query-param URLs.
7. **Geographic hierarchy**: City > optional Neighborhood > Community. "Community" = MLS SubdivisionName. Neighborhoods are higher-level areas that may contain multiple communities. Not every city has defined neighborhoods. The system gracefully handles both cases.
8. **geo_slug format**: Community-level cache keys use `citySlug:communitySlug` (colon-separated) via `subdivisionEntityKey()`. Never use hyphen-separated format for cache keys.
9. **Data architecture rule**: See `.cursor/rules/data-architecture.mdc` for stats computation, JSONB strategy, query patterns, caching, performance non-negotiables, and scalability design.

---

## Database Migrations

```bash
# Create a new migration
npm run db:migration <name>

# Push migrations to Supabase
npm run db:push

# Check for migration drift (pre-push hook)
npm run db:guard
```

Naming: `YYYYMMDDHHMMSS_description_snake_case.sql`
Always idempotent: use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run build` fails with type errors | Check for missing imports, incorrect types. Run `npx tsc --noEmit` for detailed errors. |
| Design token lint fails | Replace hardcoded colors with semantic tokens. See `CLAUDE.md` for the mapping. |
| Pre-push hook fails | Run `npm run quality:local:strict` to see what's failing. Fix or use `SKIP_LOCAL_GATES=1`. |
| Supabase migration drift | Run `npm run db:push` to sync migrations, or `SKIP_DB_GUARD=1` to bypass check. |
| Tests fail on CI but pass locally | Ensure env vars are set in GitHub Secrets. Check if test depends on Supabase connection. |

---

## Reference

- **Next work**: `npx tsx scripts/loop-brief.ts` + `docs/plans/CROSS_AGENT_HANDOFF.md` Current
- **Runtime photograph**: `docs/audits/RUNTIME_CROSSWALK_2026-08-18.md`
- **DAL**: `docs/DATA_ACCESS_LAYER.md` + `docs/DATABASE_FOR_AI_AGENTS.md`
- **Design System**: `CLAUDE.md` + `design_system/ryan-realty/`
- **Cursor Rules**: `.cursor/rules/`
- Fossils (do not execute): `docs/plans/task-registry.json`, `docs/plans/phase-N-brief.md` (deleted), `docs/EXECUTION_PLAN.md`, `docs/SITE_SPEC.md`
