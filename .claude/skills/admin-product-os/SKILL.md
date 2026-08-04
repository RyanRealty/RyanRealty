---
name: admin-product-os
description: Run ONE unit (or grind until blocked) of the Admin Product OS — process→data→IA→UI rebuild with filesystem memory, design amnesia, and Matt locks. Use when Matt says "run admin product", "continue admin OS", "deepen admin processes", "admin product loop", or "/admin-product-os".
---

# Admin Product OS — agentic loop

You are the long-running worker for Ryan Realty's admin rebuild. Chat is disposable.
**Disk under `docs/plans/ADMIN_PRODUCT/` is memory.** The full constitution, PDS schema,
seed catalog, design amnesia, and phase blocks live in:

`docs/plans/ADMIN_REBUILD/ADMIN-UI-UNIFICATION-PROMPT.md`

Read that file when you need the schema or blacklist. Do not reinvent it.

**Model posture:** Claude Opus 5 patterns — concise, outcome-first, no ceremonial
over-verification, subagents only for large parallel enumeration, scope = top queue unit.

## Do not assume the harness

Matt’s setup may be wrong or drifted. **This session, prove:**

1. This skill file was actually read (path above).
2. The pack file exists and you opened the PDS schema from it.
3. Whether `docs/plans/ADMIN_PRODUCT/state.json` exists (list the dir; do not assume).
4. Harness reality (verified on disk 2026-08-04 — one cheap `ls` to re-confirm, then move on):
   skill auto-discovery from `.claude/skills/*/SKILL.md` frontmatter **works**, so
   `/admin-product-os` and plain language both reach this file. `.claude/commands/` does
   not exist and does not need to — it is not the loader. Not being listed in
   `GLOBAL_SKILLS_REGISTRY.md` is cosmetic. Do not burn a session re-litigating the harness.
5. **G44 blocks BOOT.** `ci:process-canon` fails any unregistered `.md` under `docs/plans/`.
   BOOT must create `docs/plans/ADMIN_PRODUCT/` **and** add its `ADMIN_PRODUCT/` package row
   to `docs/DEVELOPMENT_PROCESS.md` → "Registered plan documents" in the SAME commit, then
   show `npm run ci:process-canon` green. Registering before the dir exists also fails
   (deletions arm). Details in the pack.
6. Do **not** assume growth-loop / crm-e2e / THE LOOP topology is healthy. This OS is
   self-contained via disk memory. Other loops are unrelated unless Matt says otherwise.

If anything required is missing, create only what BOOT defines — do not invent a parallel
structure under `tmp/`, `.auto-memory/`, or `ADMIN_REBUILD/specs/`.

---

## Grind semantics

A firing does **not** stop after one shallow step. Chain units until one of:

1. **Matt lock required** — process / IA / visual / litmus lock awaiting `decisions.md`
2. **Queue empty** for the current phase and phase DoD is met
3. **Context nearly spent** — finish the in-flight unit, flush all state files, append
   `progress.txt` with exact next item, stop (Matt opens a fresh session with `/admin-product-os`)

"Did something then stopped while queue still had deepen work" is a failure mode.

**Exception:** never cross a Matt lock. Never start P6 visuals before IA lock.
Never start P5 IA before process lock.

---

## Loop iteration

### 0. Orient (always)

```bash
pwd
ls docs/plans/ADMIN_PRODUCT 2>/dev/null || true
```

- If `docs/plans/ADMIN_PRODUCT/state.json` **missing** → run **BOOT** only (create
  scaffold from the pack). Then stop and tell Matt the next firing continues at P1.
- If present → read in order:
  1. `SESSION_BOOT.md`
  2. `state.json`
  3. `work-queue.json`
  4. `progress.txt` (last ~80 lines)
  5. `decisions.md`
  6. `process-registry.json` (skim)

Summarize in ≤5 bullets: phase, locks, top queue id, blockers, last progress line.
Then execute the top queue item (unless Matt named a process/phase override).

### 1. Dispatch by `state.json.phase`

| phase | Unit of work |
|---|---|
| `P0_BOOT` / missing | Create artifact root + empty registry + queue `[registry-pass]` |
| `P1_REGISTRY` | Thin stub every process (seed checklist + code discovery). Queue deepen order. |
| `P2_DEEPEN` | **One** process → full Process Definition Spec in `processes/{id}.md` |
| `P3_PROCESS_LOCK` | Decision package for Matt; set `awaiting_lock=process`; **stop** |
| `P4_DATA` | Data atlas for KEEP processes only |
| `P5_IA` | Destinations + cut-list; awaiting IA lock; **stop** |
| `P6_VISUAL` | Greenfield `design_system/admin/` only after IA locked |
| `P7_PRIMITIVES` | `components/admin/v2/` + token exemption |
| `P8_LITMUS` | Timed litmus pilot; **stop** for Matt |
| `P9_ROLL` | One family migration per unit inside locked IA |
| `P10_GATES` | Land mechanical gates |

Phase transitions: only advance `state.json.phase` when the phase DoD in the pack is met
**and** any required Matt lock exists in `decisions.md`.

### 2. Deepen unit (P2) — load-bearing

For top queue process id:

1. Gather evidence from **allowlisted** paths only (see pack design amnesia).
2. Write/overwrite `processes/{id}.md` with **every** PDS section filled.
3. Update `process-registry.json` status → `deepened` (or `stub` if blocked — say why).
4. Pop/complete the queue item; enqueue next deepen if phase remains P2.
5. Order (Matt-set 2026-08-04, see `ADMIN_REBUILD/PHASE-0-ANSWERS.md`):
   `broker-alert` → `inbound-respond` → `cma-deliver` → `prospecting` →
   `suppression-guard` → other daily → weekly/rare.

### 3. Flush (end of every unit)

Update all of:

- `state.json` (`phase`, `updated_at`, `current_process`, `awaiting_lock`)
- `work-queue.json` (next item crystal clear)
- `process-registry.json`
- append `progress.txt` (what finished, what's next, blockers)
- keep `SESSION_BOOT.md` accurate for a cold start

Optional: local git commit of `docs/plans/ADMIN_PRODUCT/**` when a unit is coherent.
Do not push unless this session's ship rules say so. Never stage unrelated WIP.

### 4. Stop conditions (report outcome-first)

**Continue grinding** if phase is P1/P2/P4/P7/P9/P10 and queue has work and no lock wait.

**Stop and ping Matt** when:

```text
BLOCKED_ON_MATT: process|ia|visual|litmus
```

Include the path to the decision package and the single question/table he must approve.

**Stop for context** when budget is tight after flush — say:

```text
HANDOFF: phase=… next=… file=docs/plans/ADMIN_PRODUCT/work-queue.json
```

---

## Hard refuses (off the rails)

Refuse and return to queue if asked to:

- "Just unify / pretty up admin UI" before IA + visual locks
- Implement `docs/plans/ADMIN_REBUILD/specs/*` as approved design
- Use CONSOLE_KIT / old ui_kits / FUB screens as the visual target
- Import or extend legacy `components/admin/*` as the new system
- Carry over current nav, route names, destination names, page titles, terminology,
  data groupings, or the mobile tab bar as if they were settled (Matt 2026-08-04:
  amnesia covers SHAPE, not just pixels — see the inheritance table in the pack)
- Skip PDS sections or mark deepen complete with empty sections
- Delete acceptance checks or hollow out registry rows to look done

---

## Matt triggers (plain language first)

| Matt says | Behavior |
|---|---|
| `run admin product` / `continue admin OS` | Verify disk → orient → grind until stop |
| `/admin-product-os` | Same **if** this skill actually loaded; if not, still run via pack path |
| `deepen cma-deliver` | Override queue top to that id for one unit, then resume order |
| `process locked` + paste table | Append `decisions.md`, clear awaiting_lock, advance to P4, continue |
| `IA locked` / `visual locked` | Same pattern for those locks |

First line of every firing after orient: state what you verified on disk
(`ADMIN_PRODUCT` exists? phase? top queue id?). No verify → no work.

---

## Relation to other systems

- Self-contained. Do not require growth-loop, crm-e2e, or `/loop` to function.
- Cross-agent: when stopping, update `docs/plans/CROSS_AGENT_HANDOFF.md` Current block
  with paths to `ADMIN_PRODUCT/state.json` — only if that handoff file exists; if it
  doesn’t, say so and still leave `progress.txt` complete.
