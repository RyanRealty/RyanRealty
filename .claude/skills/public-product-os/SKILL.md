---
name: public-product-os
description: FOLDED. Do not grind P0–P10. Page-grade is killed. If this skill loaded, STOP. Product of record is docs/plans/PUBLIC_PRODUCT/PRODUCT.md. Next work is loop-brief.
---

# Public Product OS — runner

> **FOLDED IN (2026-08-12).** Orient from `docs/plans/ADMIN_PRODUCT/EXECUTION.md`.
> Plan of record: `docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md`.
> This skill still loads the public quarry (recipe, locks, ratchet). It does
> not own a second plan. `state.json` / `work-queue.json` are not the next unit.
> Page-grade is KILLED 2026-08-16. Do not run the grind. Do not score
> pages. Look is Matt keep/kill on real pages. Product of record is
> `docs/plans/PUBLIC_PRODUCT/PRODUCT.md`.

The constitution is `docs/plans/PUBLIC_PRODUCT/PUBLIC-PRODUCT-OS.md` — schemas, amnesia
lists, phase blocks, DoD, precedence ladder, seed catalog. **Read that file when you need
the schema or a blacklist. Do not reinvent it.** This skill is only the loop.

## Orient (always, before any work)

```bash
ls docs/plans/ADMIN_PRODUCT/EXECUTION.md docs/plans/PUBLIC_PRODUCT 2>/dev/null || true
```

Then read in order: `docs/plans/ADMIN_PRODUCT/EXECUTION.md` →
`docs/plans/PUBLIC_PRODUCT/SESSION_BOOT.md` → `decisions.md` →
`progress.txt` (last ~80 lines). Summarize in ≤5 bullets: board scoreboard,
your lease, blockers — printed BEFORE doing work.
**Do not obey** `state.json` or `work-queue.json` as the next unit.
First line of every firing after orient: state what you verified on disk. **No verify → no
work.** Do not assume the harness or prior wiring is healthy; prove disk state in one cheap
`ls`, then work — do not burn a session re-litigating the harness.

## Dispatch (unit of work by phase)

| `state.json.phase` | Unit |
|---|---|
| missing / `P0_BOOT` | BOOT per constitution (seven artifacts + G44 registration, one commit) |
| `P1_REGISTRY` | Thin-stub every process (seed catalog + code/analytics discovery); best-effort page-inventory process map; queue deepen order |
| `P2_DEEPEN` | **One** process → full PDS in `processes/{id}.md` |
| `P3_PROCESS_LOCK` | Decision package (KEEP/MERGE/KILL/DEFER + ≤5 questions); `awaiting_lock=process`; **stop** |
| `P4_DATA` | writer→store→reader→outcome chains for KEEP processes |
| `P5_IA` | Destinations + cut-list + dual objectives/exits per route + GSC evidence per cut; `awaiting_lock=ia`; **stop** |
| `P6_VISUAL` | Greenfield `design_system/public/` — closed pattern set (≥3, target 5–8) + MOVING prototype; `awaiting_lock=visual`; **stop** |
| `P7_PRIMITIVES` | `components/site/v3/` barrel + token exemption |
| `P8_LITMUS` | Timed litmus pilot (L1 valuation span, L2 exploration span) on a real phone; **stop** for Matt |
| `P9_ROLL` | The leased unit on `docs/plans/ADMIN_PRODUCT/EXECUTION.md` (first: E-CHROME). Not the stale work-queue. Ratchet must shrink. Adversarial verify. One commit. Land serial. |
| `P10_GATES` | Remaining mechanical gates |

## Grind semantics

Chain units until: Matt lock required · queue empty and phase DoD met · context nearly
spent (finish in-flight unit, flush, stop). Continue-grinding phases: P1/P2/P4/P7/P9/P10.
**Never cross a Matt lock. Never start P6 visuals before IA lock. Never start P5 IA before
process lock.** Stop tokens: `BLOCKED_ON_MATT: process|ia|visual|litmus` ·
`HANDOFF: next=<lease id> file=docs/plans/ADMIN_PRODUCT/EXECUTION.md`

## Flush (end of EVERY unit)

Update `docs/plans/ADMIN_PRODUCT/EXECUTION.md` scoreboard + lease status.
Append `docs/plans/ADMIN_PRODUCT/progress.txt` and this pack's `progress.txt`.
Do not write a competing next-unit into `work-queue.json`. Batch docs-only
units and `npm run push` once per session. Land serial on `main`.

## Hard refuses (return to queue instead)

- "Just pretty up / unify some pages" before IA + visual locks
- Implement the old V2* section library, EXPERIENCE_SYSTEM archetypes, or
  PUBLIC_SITE_UX_OVERHAUL mockups/statuses as approved design
- Static HTML mockups as the path to visual lock (it requires a MOVING prototype)
- Carry over current nav, route names, section stacks, page titles, or groupings as settled
- Import/extend kb, legacy flat, v2, primitives, or explore registers as the new system
- Cut or rename a route without GSC evidence + a 301
- Skip PDS sections, hollow registry rows, or mark done without session evidence
- A page that cannot state its visitor_objective, machine_objective, and exits

## Matt trigger vocabulary

| Matt says | Behavior |
|---|---|
| `run public product` / `continue public OS` | Orient → grind until a stop token |
| `deepen <id>` | Override queue top to that id for one unit, then resume order |
| `process locked` / `IA locked` / `visual locked` (+ answers) | Append decisions.md, set lock, clear awaiting_lock, advance phase, continue |

## Idempotent + autonomous (the execution contract)

Re-invoking this skill with the same phrase always resumes from disk — never from chat
memory — so it is safe under `/loop` and safe to fire repeatedly. A firing asks Matt
nothing mid-run; the ONLY human surface is a lock package (≤5 binary questions) at a stop
token. Written for Fable 5 per the constitution's model-posture block: de-prescribed (goal,
constraints, verification — plan the rest yourself), delegation encouraged for disjoint
enumeration/builds/adversarial verify. Do not surface token counts; do not stop early
because a session is long — flush and hand off instead.

## Verification (binding)

Process claims = file:line/table/cron/analytics. UI claims = screenshots + timed runs at
390 AND 1280 on real data, counts reconciling. P9 rolls: fresh-context adversarial verifier,
first check is behavior preservation (`git diff`: no capture contract, action, canonical, or
metric moved unintentionally). A surface failing the acceptance bar (constitution §Surface
acceptance bar) is not done regardless of green gates. Report only what this session's
evidence supports.
