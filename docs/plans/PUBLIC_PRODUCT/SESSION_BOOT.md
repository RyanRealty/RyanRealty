# Public Product OS — session boot

## Resume ritual (every session, in order)

1. `ls docs/plans/PUBLIC_PRODUCT` — prove the memory root exists.
2. Read: this file → `state.json` → `work-queue.json` → `progress.txt` (last ~80 lines) →
   `decisions.md` → skim `process-registry.json`.
3. Print ≤5 bullets (phase, locks, top queue id, blockers, last progress line) BEFORE work.
4. Execute the top queue unit per the constitution
   (`docs/plans/PUBLIC_PRODUCT/PUBLIC-PRODUCT-OS.md`) and the runner
   (`.claude/skills/public-product-os/SKILL.md`). Grind until a stop token.

**The live phase is always `state.json.phase` — read it first. The bullets below are
history in the order it happened; a phase named there is what was true THEN, not now.**

## Rules that bind every session

- One lock location: `decisions.md` here. Never read the old program's decisions as competing.
- Design amnesia per the constitution: shape is never inherited; brand and voice are LOCKED
  constraints; SEO equity is data (GSC evidence before any cut/rename; 301s always).
- Every page ships with visitor_objective + machine_objective + exits, or it merges/dies.
- No visuals before P5 IA lock. No IA before P3 process lock. Visual lock needs a MOVING
  prototype at 390 + 1280.
- Evidence discipline: process claims by file:line; UI claims by browser; dones only with
  session evidence. The prior program died of self-reported dones — never repeat it.

## Current program state (newest first)

- 2026-08-11 — **BOOT complete.** Constitution + runner skill + seven memory artifacts
  created; package registered in `docs/DEVELOPMENT_PROCESS.md`; `PUBLIC_SITE_UX_OVERHAUL`
  demoted to evidence (its Matt-granted product decisions absorbed into `decisions.md`);
  `experience-rollout` skill bannered as superseded. Phase set to `P1_REGISTRY`; queue top
  is `registry-pass`.

## Lessons ledger (one paragraph each; transplanted from the Admin OS where they earned it, then grown here)

- **Self-reported "done" is how the last program died.** Three queue items claimed SHIPPED
  work that never existed on disk. A done requires evidence produced this session: commit
  SHA, browser proof, or a diff. No exceptions for docs units.
- **The barrel is the pressure valve.** When a migration needs a control the v3 barrel
  lacks, ADD THE PRIMITIVE — never widen a ratchet baseline, never reach back into
  kb/legacy/v2. When a migration "had to change the layout to fit the primitive," the
  primitive is wrong.
- **Wiring the gate is part of the unit.** A migration whose ratchet isn't wired into
  `ci:gates` in the same commit is invisible to CI and will regress.
- **A gate that inspects code reads the AST, never the text.** Regex gates have matched
  their own explanatory comments before.
- **Verify by loading routes at 390 AND 1280 and asserting visible-control counts.**
  Status codes are not enough.
- **A wall of identical states on real data is a STOP** — probe the source tables before
  trusting a render.
- **Two docs disagreeing is a fire, not a curiosity.** Precedence ladder + decisions.md
  win; update the loser in the same session. Superseded text left standing (the old
  program's "GRANTED" wave order) misleads every later reader.
- **Never gate a page whose rendered output still carries the old register.**
