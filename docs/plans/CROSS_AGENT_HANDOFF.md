# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Claude Code (next)** — Matt is continuing in the **other** Claude Code / Cowork session, **not** the Cursor thread that outlined BL-011 URL steps. |
| **Stopped at (UTC)** | 2026-04-22 — Cursor agent: user **scrapped** the Cursor-side “pick up BL-011 / 301 plan” sequence; no obligation to execute that plan here. |
| **`main` @ commit** | `b4167df` (after `git pull`; verify with `git rev-parse --short HEAD`) |
| **Task focus** | Resume from **your Claude Code session** + repo truth (`orchestrate.ts next`, `task-registry.json`). Do **not** assume the other chat’s step list unless you re-validate. |

### Done this session (Cursor, brief)

- User direction: **stop** Cursor-led pickup of BL-011 / redirect work; **hand execution to Claude Code** session instead.

### Next agent should (Claude Code)

1. `git pull origin main` — confirm at or past `b4167df`.
2. Read **`AGENTS.md`** (*Claude Code ↔ Cursor*, *Skills*, *handoff*).
3. Continue from **the Claude Code conversation you already have open** (Matt’s source of intent there). Use **`npx tsx scripts/orchestrate.ts next`** when you need the formal next task from the registry—not the abandoned Cursor narrative.
4. Update this **Current** block again when **you** stop or hand back.

### Blockers / env / secrets

- None recorded for this handoff.

### Skills actually read (paths)

- (Claude Code: list what you load—Cursor did not run BL-011 implementation in this step.)

---

## History (optional; newest first)

_(Paste prior "Current" blocks here when you rotate, or leave empty.)_
