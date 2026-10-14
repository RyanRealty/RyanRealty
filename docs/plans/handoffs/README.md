# Handoff notes: one file per session

Matt 2026-10-14. Every session that stops with work in flight, or switches tools,
writes ONE note here. A note is its own file, so two sessions never edit the same
lines and a merged PR never puts another open PR into conflict.
`docs/plans/CROSS_AGENT_HANDOFF.md` is frozen history.

## Write a note

- Name: `<YYYY-MM-DDTHHMMZ>-<branch-slug>.md`, UTC minute, `/` in the branch becomes `-`.
  Example: `2026-10-14T0455Z-claude-blissful-franklin-tshl2h.md`.
- First line: `# <date> (<surface>, <topic>)`. At most 60 lines.
- Say: branch and PR, what landed, what is next, what is held, skills read.
- Same session, later update: edit your own note. Never edit another session's note.
- A Matt directive that must outlive your note goes in **Standing holds** below.

`ci:handoff-current` (`scripts/check-handoff-current.mjs`, `scripts/lib/handoff-notes.mjs`)
fails a misnamed or overlong note and a `# Current` block in the frozen file.

## Read

`npx tsx scripts/loop-brief.ts` prints the standing holds and the newest notes at boot.

## Standing holds

Carried verbatim from the frozen handoff's 2026-10-14 blocks. Remove a line only when
Matt clears it or the work lands.

- **Not this change.** Do not send. Do not rebuild letters. Do not apply `20261013180000_crm_suppressions_cleared.sql`. Do not merge the phase-pool branch. Hold #471 (stale vs main; would drop `loadCmaMapTile` / `CMA_MAP_MS`).
- **Still open.** Do not pop git stash `plat-walk wip 2026-10-09`. Do not restart the 144-home fleet. Whole-plat pool stays on `fix/cma-whole-pool`. Do not rebuild `cma-120-sisemore` unless Matt asks. Schaeffer stays outside Boyd Acres. Do not add Parks At Broken Top as a Broken Top alias. Oakview stays a hold. Keats and Remarkable stay delivered.
- **Still open.** Do not rebuild McCann until 20 McCann unit 5 and 26 McCann #2 are checked (both about 1,604 sq ft, $975,000). Schaeffer stays outside Boyd Acres. Do not add Parks At Broken Top back as a Broken Top alias. The homes that stayed short on the 2026-10-10 book walk stay short. Oakview stays a hold.
