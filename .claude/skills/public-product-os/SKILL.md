---
name: public-product-os
description: Run ONE unit (or grind until blocked) of the Public Product OS — the process→data→IA→visual→roll rebuild of the public site with filesystem memory, design amnesia, dual page objectives (visitor + machine), and Matt locks. Use when Matt says "run public product", "continue public OS", "public product loop", or "/public-product-os".
---

# Public Product OS — runner

The constitution is `docs/plans/PUBLIC_PRODUCT/PUBLIC-PRODUCT-OS.md` — schemas, amnesia
lists, phase blocks, DoD, precedence ladder, seed catalog. **Read that file when you need
the schema or a blacklist. Do not reinvent it.** This skill is only the loop.

## Orient (always, before any work)

```bash
ls docs/plans/PUBLIC_PRODUCT 2>/dev/null || true
```

Then read in order: `SESSION_BOOT.md` → `state.json` → `work-queue.json` → `progress.txt`
(last ~80 lines) → `decisions.md` → skim `process-registry.json`. Summarize in ≤5 bullets:
phase, locks, top queue id, blockers, last progress line — printed BEFORE doing work.
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
| `P9_ROLL` | One page family per unit inside locked IA; ratchet lands with the FIRST unit; adversarial fresh-context verify; one commit |
| `P10_GATES` | Remaining mechanical gates |

## Grind semantics

Chain units until: Matt lock required · queue empty and phase DoD met · context nearly
spent (finish in-flight unit, flush, stop). Continue-grinding phases: P1/P2/P4/P7/P9/P10.
**Never cross a Matt lock. Never start P6 visuals before IA lock. Never start P5 IA before
process lock.** Stop tokens: `BLOCKED_ON_MATT: process|ia|visual|litmus` ·
`HANDOFF: phase=… next=… file=docs/plans/PUBLIC_PRODUCT/work-queue.json`

## Flush (end of EVERY unit)

state.json · work-queue.json (next item crystal clear) · process-registry.json · append
progress.txt (`TIMESTAMP PHASE UNIT OUTCOME-with-numbers … Next: <unit>`) · keep
SESSION_BOOT.md accurate. Batch docs-only units and `npm run push` once per session.

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

## Verification (binding)

Process claims = file:line/table/cron/analytics. UI claims = screenshots + timed runs at
390 AND 1280 on real data, counts reconciling. P9 rolls: fresh-context adversarial verifier,
first check is behavior preservation (`git diff`: no capture contract, action, canonical, or
metric moved unintentionally). A surface failing the acceptance bar (constitution §Surface
acceptance bar) is not done regardless of green gates. Report only what this session's
evidence supports.
