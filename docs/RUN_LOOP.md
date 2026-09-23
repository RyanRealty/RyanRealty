# Run the loop

The one page a session boots on when Matt says **"run the loop"**: Claude Code, Cursor, Grok
Build, the Mac grinder (`scripts/site-queue-routine.sh`) and the Claude cloud routine alike.
Pointer files (CLAUDE.md, AGENTS.md, both site-queue skills, `.cursor/rules/run-loop.mdc`,
`docs/GROK_BOT_BRAIN.md`, `scripts/site-queue-routine-prompt.md`) link here and restate none
of it. Where this page and the code disagree, the code wins and this page gets fixed.
Held by `ci:process-canon`.

**Current mission:** the 2026-09-22 visibility pass. What landed, what is still open and how
to resume it: `docs/plans/VISIBILITY_2026-09-22/README.md`.

## 1. The objective (Matt 2026-09-22, 2026-09-23)

"Our number one thing is that we need our website to be seen... both the AI models that
people are searching for stuff through and through search engines... to be seen and then,
from there, convert... as organically as possible."

- **The score, per public page class, read weekly:** Google Search Console clicks and
  average position on the class's own queries (last settled 28 days against the 28 before),
  plus AI-assistant referral sessions (hosts in `lib/ai-referrers.ts`), gated by leads the
  class produced that a broker answered (`crm_people` first touch).
- **Floors that may not regress, and are not the score:** the taste median on the same
  instrument, the route's content floor, tap targets, page payload, §0 traces, and the
  product hold (honesty, JSON-LD, the conversion ask). A taste score that rises while
  clicks fall is a loss.
- **No rule is permanent (Matt 2026-09-23):** "If there's something out there that we're
  enforcing that's keeping us back, then we really need to evaluate it and likely change
  it." Evaluate with evidence, change the rule and its gate in one commit, cite the
  evidence. Still binding always: CLAUDE.md §0, the four §1 per-action classes, fair
  housing, MLS rules.

## 2. Boot

```bash
npx tsx scripts/loop-brief.ts                 # handoff Current block, graph, served class
npx tsx scripts/site-queue-status.ts --json   # serve order, liveWorkers, maxWorkers
```

Read this page, CLAUDE.md §0–§2, `marketing_brain_skills/brand-voice/VOICE.md`, and the
Current block the brief prints. Everything else is reference for the node in hand. If
`liveWorkers` is at or above `maxWorkers`, print the owners in one line and stop.

## 3. Claim (the only path)

```bash
npx tsx scripts/site-queue-status.ts --claim SITE-XX,SITE-YY --owner <tool>-<model>-<YYYY-MM-DD>
npx tsx scripts/site-queue-status.ts --touch SITE-XX,SITE-YY --owner <same>     # while you hold
npx tsx scripts/site-queue-status.ts --release SITE-XX --owner <same>           # cannot finish
```

The tool is where the caps live (`MAX_SITE_WORKERS`, `MAX_SITE_CLAIMS_PER_SESSION`,
`SITE_CLAIM_IDLE_HOURS` in `lib/data/loop/work-node.ts`, reported as `maxWorkers` in the
JSON). Claims are optimistic: a non-zero exit means you got nothing. Never write a claim by
hand. Take items in the JSON's order (`siteServeTier` in the same file is the one serve
order); skip one whose route family another owner holds.

## 4. The accept test for a public page node

A node is done when all five hold on the pushed head, with the evidence on the node:

1. **Visibility.** The title and H1 own one query that no other sitemapped URL class
   targets (a GSC-seeded node names the winner URL); `index, follow`, self-canonical, in
   the sitemap once, 200 to a crawler; JSON-LD figures equal the visible ones; LCP inside
   Google's Core Web Vitals "good" line (2.5 s). Gates: `ci:seo-shell`, `ci:seo-routes`,
   `ci:title-brand-once`, `ci:sitemap-resolvable`, `ci:ai-structured-data`,
   `ci:listing-offmarket-index`.
2. **Information.** Every figure carries a reader-facing source and date (§0); no `$0` or
   `0` placeholder in server HTML; listing cards carry price, address, beds, baths, sqft;
   nothing the page carried is gone (`ci:route-content-floor`, `requiredComponents`).
3. **Voice.** A separate agent (never the builder) reads the page as text, chrome
   stripped, against VOICE.md: no internal identifiers, no talk about the page itself, no
   instructions posing as content, headings that say something. No em dash
   (`ci:no-public-em-dash`). The verdict goes on the node.
4. **Floors.** `npx next build && PORT=<free> npm run ci:runtime-gates` green; when the
   look changed, a new receipt that did not fall on the same instrument
   (`node scripts/lib/taste-receipt.mjs --ship <parity.json>` exit 0 is Tip Ready).
   `demoMatch` and `competitiveBriefPass` are recorded notes, not gates (Matt 2026-09-23).
5. **Measurement.** On ship the node goes `blocked` with `blocked_until` 28 days out and
   the GSC query, baseline position and clicks written in `blocked_reason`; the brief
   reopens it on that date. Ranking-affecting commits carry a `Ledger:` trailer (§6).

Record progress with `--note SITE-XX --text "..." --owner <same>`. `completeWorkNode` and
`blockWorkNode` (`lib/data/loop/work-graph.ts`, run under `npx tsx --conditions=react-server`)
move the state; done without evidence, or with a receipt that regressed, is refused. Lane
mechanics (worktrees, cloud sandboxes, the judge chain): the skill.

## 5. Land (one path for every builder)

1. Commit with `Node: <id>` (G72) on your branch or worktree.
2. `npm run push` from a checkout that tracks `origin/main`: it runs `ci:gates`, eslint,
   and the unit tests for the changed files, then pushes `main` and retries a race.
3. `npm run deploy:verify` until READY, open the live page, write the evidence.

A session bound to its own branch never runs `npm run push` (it rebases onto and pushes
`main`, not the branch): it runs `npm run gates:stamp`, `git push -u origin <branch>`, and
writes `LAND <branch>@<sha>` on the node with `--note`; the next session that can push
`main` lands it before it claims anything. Nobody waits on a person to merge.
One `ci:gates` per ship; do not poll GitHub Actions (R-221).

## 6. The ledger trailer (ranking-affecting commits)

A commit that touches metadata, canonicals, robots, sitemaps, redirects, middleware
routing, ISR / `revalidate`, or a URL builder carries one of:

```
Ledger: <site_improvement_ledger id>
Ledger: <page class> · <gsc metric: clicks|position|impressions|ctr> · <query or path>
Ledger: none (<why this cannot move a ranking>)
```

`ci:process-canon` prints a WARN for a commit in the push range without one. Warning, not
failure, for now: a hard fail would block lanes that booted before this page. Set
`LEDGER_TRAILER_STRICT=1` to make it fail; that becomes the default once in-flight lanes
have landed.

## 7. When to stop

- **Never for "the site is done."** Visibility is a weekly number, not a finish line; the
  taste table's 70 is no longer a stop (Matt 2026-09-23).
- **Nothing eligible:** run the measurer (`npx tsx scripts/seed-gsc-ranking-queue.ts
  --apply`, then `node scripts/_gsc-by-class.mjs`), claim what it opened, else end the
  fire in one line and keep the schedule.
- **Context or a rate limit:** land what is green (§5), release what is not, replace the
  ONE `# Current` block in `docs/plans/CROSS_AGENT_HANDOFF.md` (`ci:handoff-current`),
  then schedule the wake (Claude `ScheduleWakeup`, a Grok durable task, or the routine).
- **A question only Matt can answer:** one line in `blocked_reason`, take the next node.

## 8. Standing contracts (encoded once, never reinvented)

- **§0 data accuracy:** CLAUDE.md §0. Every figure traces to a named source.
- **Identity loop** (every known contact is identified on every visit):
  `docs/TRACKING_POLICY.md`, "The known-contact identity loop"; `ci:identity-loop`.
- **Subdivision families** (a multi-phase subdivision groups under one main page):
  `docs/plans/PUBLIC_PRODUCT/PLACE_PAGES.md`, "Subdivision families"; `ci:plat-families`.
- **Approval:** CLAUDE.md §1. Never message a real person, publish a post, spend on ads,
  or grant OAuth without Matt's yes for that action. Test submits use a `fleet-test` address.
- **Voice:** VOICE.md is the only voice document.

## 9. Reference, not boot reading

The skill (`.claude/skills/site-queue/SKILL.md`, Cursor and Grok:
`.cursor/skills/site-queue/SKILL.md`), `design_system/public/TASTE.md` (the look floor),
`design_system/public/PUBLIC_UI.md`, `docs/DEVELOPMENT_PROCESS.md` (THE LOOP),
`docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md` (queue history).
