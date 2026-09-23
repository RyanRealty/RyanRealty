---
name: site-queue
description: Run the site queue ("run loop", "run the loop", "/site-queue", "go", "keep going", "continue as new nodes get entered"). Boot on docs/RUN_LOOP.md, which holds the objective (be seen by search and AI engines, then convert; taste is a no-regression floor), the claim path, the accept test, the one land path and the stop rule. This skill adds the lane mechanics a Claude Code session needs to build SITE nodes in parallel worktrees and land them. "run loop" always means this skill and RUN_LOOP.md (Matt 2026-09-09); an empty eligible set runs the measurer, it is not a stop (Matt 2026-09-10).
---

# /site-queue — lane mechanics for "run the loop"

**Read `docs/RUN_LOOP.md` first.** It is the protocol: objective, boot, claim, accept test,
land path, ledger trailer, stop rule, standing contracts. This file does not restate any of
it; it covers how a Claude Code session runs lanes. Canon outranks both: CLAUDE.md §0 (every
figure traced), §1 (approval model), §2 (VOICE.md), §3 (one design system).

Matt 2026-09-23: "Don't assume any rules from the past that might keep us from hitting our
goals are permanent." When a rule here slows visibility or conversion without protecting §0,
§1, fair housing or MLS rules, change it with evidence in the same commit as its gate.

The dated incident history this file used to carry (2026-09-07 to 2026-09-22) is verbatim in
`docs/archive/site-queue-SKILL-through-2026-09-22.md`. Read it for a named SHA or failure.

## The round

1. **Boot and claim** per RUN_LOOP.md §2–§3. Read each claimed node's objective, output and
   accept in full, and re-measure any claim in it against the live tree before building on
   it (a stale finding gets rebuilt otherwise).
2. **Lanes.** One `Agent` per node or route family, `isolation: 'worktree'`,
   `run_in_background: true`, each on a disjoint file set. Two nodes on one route go in one
   lane, in sequence. Each lane brief carries, verbatim: the node id with objective, output
   and accept; the routes; the exclusive files; the RUN_LOOP.md accept test; the gates that
   read those files (`grep -l <file> scripts/check-*.mjs`, `scripts/ci-lanes.json`); the
   commit shape (`Node: <id>`, plus `Ledger:` for ranking-affecting paths).
3. **Each lane, before it reports:**
   - Visibility and information first: title, H1, canonical, JSON-LD, internal links, the
     figures and their sources, listing facts on every card.
   - `npx next build && PORT=<free port> npm run ci:runtime-gates` (route-smoke,
     page-payload, tap-targets, route-content-floor on a running server). The static chain
     never runs these, and a lane that skips them reports green and fails CI.
   - When the look changed: shots at 1440 and 375 from the lane's own server, then the judge
     `npx tsx scripts/taste-evaluate.ts <route-key> --builder <your model>` (three scorings,
     a different model family from yours), the receipt in the route's `parity.json`
     (TASTE.md, "The receipt"), and `node scripts/lib/taste-receipt.mjs --ship <parity.json>`
     exit 0. That is Tip Ready: the median did not fall on the same instrument and the
     product hold held. `demoMatch` is recorded, not required (Matt 2026-09-23).
   - The voice read (RUN_LOOP.md §4.3) by a separate agent, verdict on the node.
   - Commit with the trailers. Do not push from a lane worktree.
4. **Land the round** per RUN_LOOP.md §5: verify what each lane reported (agents overstate),
   merge lane branches in order, resolve shared files (`components/site/v3/index.ts`,
   `package.json`, the handoff), ONE `npm run push`, ONE `npm run deploy:verify`, then open
   each shipped page on ryan-realty.com at 375 and desktop and compare with the lane's
   shots. Evidence and the measurement window on each node.
5. **Next round immediately.** Boot again. There is no sleeping between rounds.

## Look work (when a node changes the look)

- `node scripts/lib/taste-catalog.mjs <class> --preflight` prints the builder card: house
  files, catalog demos (beautifului, beui, rareui, transitions, ui.shadcn.com), missing
  barrel primitives, layout locks. Install a catalog source into `components/ui` or
  `components/motion` and wrap it from a `components/site/v3` primitive that imports it;
  restyle navy / cream / Geist / Amboqia; keep the interaction. A catalog id named in
  `adaptedFrom` must be installed and imported (`ci:catalog-install`).
- Record the judge's `demoMatch` as it came back. A house patch never turns a `false` into a
  claimed match; the page ships on the accept test, not on the demo.
- Never shrink a working full-bleed layout (listing hero), never serve a 320×240 Spark thumb
  on a card, rail or hero, never summarize PropertySpecs, remarks, schools, payment or
  Tour / Call / Text away. `ci:route-content-floor` and `requiredComponents` hold these.
- A site primitive only a dev page imports is not shipped (`ci:site-primitive-wired`).
- The rubric (`design_system/public/taste-evaluator.v1-2026-09-12.md`) and the rise floor
  are in `design_system/public/taste-rule-freeze.json`; `ci:rubric-freeze` holds them.

## If you are a cloud session

You are one if there is no browser pane and `dotenv` injects nothing from `.env.local`;
credentials come from `docs/CLOUD_ENVIRONMENT_SETUP.md`.

- **Browser and fonts at boot:** `CLOUD_SETUP_SKIP_DEPS=1 CLOUD_SETUP_BROWSERS=1 bash
  scripts/cloud-setup.sh` (Chromium plus Amboqia / AzoSans; `npm run setup:browsers` alone
  gets no fonts and renders the wrong face silently).
- **Dev server:** `next dev --webpack` (Turbopack refuses a symlinked worktree
  `node_modules`). After a DAL change, kill dev, `rm` each file in
  `.next/dev/cache/fetch-cache/` by name, restart, and read the FIRST request only.
- **Build order:** stop `next dev` before `next build` (the OS OOM killer, not V8's heap,
  killed builds with both running). Start a built server with `npm run start:prod`, which
  refuses a stale `.next` and a held port.
- **Production reads:** curl with a real browser user agent (the WAF serves curl's default a
  bot screen). Headless Chromium does not trust the agent proxy's CA: gates use
  `scripts/lib/remote-media-proxy.mjs` / `scripts/lib/gate-browser.mjs`; an ad hoc probe
  sets `ignoreHTTPSErrors: true`.
- **Scratch files:** repo-root `scratchpad/` (gitignored); top-level `await` needs `.mts`.
- **Deleting:** name each file; the repo hook refuses recursive and glob deletes and
  matches the literal text of the command.
- **Git locks:** never name `.git/index.lock` in a command in a cloud sandbox (it raises a
  prompt nobody can answer). Wait ten seconds and retry; if it persists, release your
  claims and end.
- **Landing from a branch-bound sandbox:** RUN_LOOP.md §5, second paragraph. `npm run push`
  from a session bound to its own branch pushes the wrong ref.
- **Sends:** never message a real person; a test submit uses a `fleet-test` address.

## Friction is a lane (Matt 2026-09-16)

When the process itself trips a round (a gate that cannot run where you are, a tool that
misreports, a trap the next lane will hit), spin up an agent to fix the tool on a disjoint
file set (`scripts/**`, `docs/**`, this skill) while the round keeps the page. A trap that
keeps biting gets a mechanical fix, never more prose (CLAUDE.md §6).

## Do not

- Write a new site audit, punch list or plan; append findings to a node.
- Touch a page with no node, or open a node to run a taste pass alone.
- Mark a node done from a self-report; evidence is what the environment showed.
- Score a page after it merged; the judge runs in the lane, before the push.
- Put a dollar figure on a public page for a typed address, or add a registration wall
  (Matt's rulings).
- Send anything to a real person without Matt's per-action yes (CLAUDE.md §1).
