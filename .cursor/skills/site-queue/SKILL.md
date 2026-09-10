---
name: site-queue
description: Run the site queue from Cursor or a Grok agent. Same queue, same claim tool, same protocol as Claude Code; this file is the pointer plus the rules that differ when the builder is not Claude. Use when Matt says "run loop", "run the site queue", or "go" in Cursor or in a Grok session.
---

# /site-queue for Cursor and Grok — the same loop, a different builder

The canonical protocol is `.claude/skills/site-queue/SKILL.md`. Read it in full; this
file only says what differs. Then read `CLAUDE.md` §0–§3, the Current block of
`docs/plans/CROSS_AGENT_HANDOFF.md`, and the "Site queue" section of
`docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md` — the same four documents the cloud
routine reads. Nothing in the queue depends on which model builds.

## What does not change

- **The queue** is `loop_work_nodes`, domain `public-ux`, `SITE-*`, in Supabase. Read it
  with `npx tsx scripts/site-queue-status.ts`; add `--json` for the serve order (round
  three's primitive nodes and SITE-31 first, then oldest; Matt 2026-09-09).
- **The claim path is the only one** and it enforces the caps for every agent regardless
  of vendor: `npx tsx scripts/site-queue-status.ts --claim SITE-XX,SITE-YY --owner <owner>`.
  Heartbeat at least hourly with `--touch`. Three live workers, two claims each; a claim
  whose heartbeat is older than three hours is released by the next claim or brief.
- **The gates** (`npm run ci:gates`), the `Node: <id>` commit trailer (G72), `npm run push`
  from the main checkout, the deploy verify, the live check, the evidence on the node.
- **The taste ritual**: shots at 1440 and 375 through `scripts/take-route-shots.mjs`, a
  SEPARATE evaluator that is a DIFFERENT model from the builder, three scorings in one
  call, the receipt in the route's `parity.json` (`scripts/lib/taste-receipt.mjs`), and
  the score must rise. The finish line is 70 on the table instrument (Matt 2026-09-09).
  **Before building:** `node scripts/lib/taste-catalog.mjs <class>` — fetch the
  shadcn docs (https://ui.shadcn.com/docs/components) and house modules, adapt
  into v3, record `adaptedFrom`. Do not invent a layout. Do not shrink the
  listing hero off full-bleed.

## What changes when the builder is Grok

- **Owner name:** `grok-<model>-<YYYY-MM-DD>` (for example `grok-4.6-2026-09-09`) so `loop
  status` says who holds what and the cap counts you.
- **The evaluator — one instrument, always (Matt 2026-09-09).** The judge is **grok-4.6**
  through the `grok` CLI, which spends Matt's Grok subscription rather than API credit, and
  it is the judge whatever built the page. Run `npx tsx scripts/taste-evaluate.ts <route-key>`
  (shots already in `ui_kits/<route>/shots/`, optional `--url` of your dev server): three
  scorings in one call, TASTE.md rubric, JSON on stdout. Write `evaluatorModel: "grok-4.6"`.
  Because `ci:taste-canon` refuses evaluatorModel == builderModel, **build with grok-4.5**
  and record `builderModel: "grok-4.5"`. Never point the evaluator at your own model to make
  it convenient — one ruler is the whole point, and a class whose prior mark came from
  claude-sonnet-5 rebaselines once on this instrument (`comparedToPrior: "rebaselined"`).
- **The machine.** On Matt's Mac `.env.local` is present; run `npm ci` and
  `npm run setup:browsers` once; the git hooks are installed. The canonical skill's
  "If you are a cloud session" section (no browser pane, the sandbox, the
  `.git/index.lock` rule) does not apply here; CLAUDE.md §8 does.
- **Worktrees** per AGENTS.md ("Claude Code ↔ Cursor"); merge or hand off in
  `docs/plans/CROSS_AGENT_HANDOFF.md` before stopping; never strand a branch.
- **The cloud routine** keeps firing every four hours on Claude's allowance unless Matt
  pauses it at https://claude.ai/code/routines/trig_01JTHasiFzPRDnkTiPzodMPV. Its claims
  and yours coexist by the claim; you never coordinate with it by hand.

## Kickoff — paste this as the first message

> Run the site queue. Read `.cursor/skills/site-queue/SKILL.md`, then the four documents it
> names. Run `npx tsx scripts/site-queue-status.ts --json`; if `liveWorkers` is at or above
> `maxWorkers`, stop and say so. Otherwise claim the first two eligible items in the JSON's
> order with `--claim SITE-XX,SITE-YY --owner grok-4.6-<date>`, heartbeat hourly with
> `--touch`, build per the canonical skill in a worktree, score with
> `npx tsx scripts/taste-evaluate.ts <route-key>` (`grok-4.5`) before the push, get the
> gates green, `npm run push` from the main checkout, verify the deploy and the live page,
> write the evidence on the node, then take the next two until nothing is eligible. Never
> wait on me: if a question would block you, take the safe path the skill allows and write
> what you chose on the node.
