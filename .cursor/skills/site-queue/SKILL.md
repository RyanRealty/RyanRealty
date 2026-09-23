---
name: site-queue
description: Run the site queue from Cursor or a Grok session ("run loop", "run the site queue", "go", "continue as new nodes get entered"). Same protocol as Claude Code: docs/RUN_LOOP.md. This file only says what differs when the builder is not Claude.
---

# /site-queue for Cursor and Grok

**Read `docs/RUN_LOOP.md` and follow it.** It holds the objective, the boot commands, the one
claim path, the accept test, the one land path, the ledger trailer and the stop rule, for
every tool. Then `.claude/skills/site-queue/SKILL.md` for lane mechanics. Nothing below
restates them.

## What differs when the builder is not Claude

- **Owner name:** `grok-<model>-<YYYY-MM-DD>` or `cursor-<model>-<YYYY-MM-DD>`, so the claim
  tool and `loop status` show who holds what. A Mac grinder fire prints a
  `THIS FIRE'S BUILDER` line above its prompt; that line is your owner name and your
  `--builder`.
- **The judge (when the look changed):** `npx tsx scripts/taste-evaluate.ts <route-key>
  --builder <your model>` walks the judge chain (grok-4.6 through the `grok` CLI or the
  Cursor CLI, then the claude CLI) and refuses a judge from your own model family, so a Grok
  lane builds as grok-4.5. Copy the `evaluatorModel` it prints into the receipt; never type
  a judge by hand. Tip Ready is `node scripts/lib/taste-receipt.mjs --ship <parity.json>`
  exit 0 (no regression on the same instrument). When every judge link fails, the look
  floor is unmeasured: ship only work that did not change the look, and say so on the node.
- **Subscriptions only (Matt 2026-09-12):** never set `XAI_API_KEY`, `ANTHROPIC_API_KEY` or
  `ANTHROPIC_AUTH_TOKEN` to get past a 402. `CURSOR_API_KEY` is the Cursor plan itself.
- **The machine:** on Matt's Mac `.env.local`, `node_modules` and the browsers are present;
  CLAUDE.md §8 applies (clear a stale git lock yourself). In a Cursor cloud sandbox, the
  skill's "If you are a cloud session" section applies instead.
- **Worktrees:** per AGENTS.md ("Claude Code ↔ Cursor"). Never leave the only copy of work
  on a branch: land it per RUN_LOOP.md §5 or name it in the handoff's one Current block.

## Kickoff — paste this as the first message

> Run the loop. Read `docs/RUN_LOOP.md` and follow it, then `.cursor/skills/site-queue/SKILL.md`
> for what differs when you are not Claude. Never wait on Matt: if a question would block
> you, take the safe path RUN_LOOP.md allows and write what you chose on the node.
