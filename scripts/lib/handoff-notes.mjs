/**
 * handoff-notes.mjs — one handoff note per session (Matt 2026-10-14).
 *
 * WHY. Until 2026-10-14 every session replaced ONE `# Current` block in
 * docs/plans/CROSS_AGENT_HANDOFF.md. With several bots shipping at once, every
 * merged PR put every other open PR into conflict on that block. Each fix was a
 * merge of main plus a push, which cancelled and restarted that PR's CI
 * (ci.yml cancel-in-progress). Most CI runs ended "cancelled" and PRs reached
 * production late. A file per session cannot conflict with another session's.
 *
 *   docs/plans/handoffs/<YYYY-MM-DDTHHMMZ>-<branch-slug>.md   one per session
 *   docs/plans/handoffs/README.md                              format + standing holds
 *   docs/plans/CROSS_AGENT_HANDOFF.md                          frozen history, no Current block
 *
 * Pure functions, no I/O: scripts/check-handoff-current.mjs (ci:handoff-current),
 * scripts/loop-brief.ts and their tests import them.
 */
import { currentHeadingLines } from './handoff-current.mjs'

export const NOTES_DIR = 'docs/plans/handoffs'
export const NOTES_README = 'README.md'
export const FROZEN_FILE = 'docs/plans/CROSS_AGENT_HANDOFF.md'
/** `2026-10-14T0455Z-claude-blissful-franklin-tshl2h.md`: UTC minute, then the branch with `/` as `-`. */
export const NOTE_NAME_RE = /^(\d{4}-\d{2}-\d{2}T\d{4}Z)-([a-z0-9][a-z0-9._-]*)\.md$/
/** A note is a handoff, not a log: what landed, what is next, what is held. */
export const NOTE_MAX_LINES = 60

/** The note file name for a session: UTC minute + branch slug. */
export function noteFileName(date, branch) {
  const iso = new Date(date).toISOString()
  const stamp = `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`
  const slug = String(branch || 'session')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${stamp}-${slug || 'session'}.md`
}

/** Problems with one note file, by name and text. Empty when it is fine. */
export function noteProblems(name, text) {
  const where = `${NOTES_DIR}/${name}`
  if (name === NOTES_README) return []
  const out = []
  if (!NOTE_NAME_RE.test(name)) {
    out.push(`${where}: name must be <YYYY-MM-DDTHHMMZ>-<branch-slug>.md (UTC), e.g. ${noteFileName(new Date('2026-10-14T04:55:00Z'), 'claude/my-branch')}.`)
  }
  const lines = String(text ?? '').split('\n')
  const first = lines.find((l) => l.trim() !== '') ?? ''
  if (!/^# \S/.test(first)) out.push(`${where}: the first line must be a "# " title (date, surface, topic).`)
  if (currentHeadingLines(text).length) out.push(`${where}: a note has no "# Current" heading; the newest notes ARE current.`)
  const n = lines.length
  if (n > NOTE_MAX_LINES) out.push(`${where}: ${n} lines; a handoff note is at most ${NOTE_MAX_LINES}. Put detail in the PR body.`)
  return out
}

/** The frozen file must not grow a Current block again. */
export function frozenFileProblems(text) {
  const at = currentHeadingLines(text)
  if (!at.length) return []
  return [
    `${FROZEN_FILE} is frozen (Matt 2026-10-14) and has a "# Current" block at line ${at.join(', ')}. ` +
      `Write your handoff as its own file: ${NOTES_DIR}/<YYYY-MM-DDTHHMMZ>-<branch-slug>.md (format in ${NOTES_DIR}/${NOTES_README}). ` +
      'A shared block made every merged PR conflict with every open one. Resolving a merge conflict here: take main\'s side.',
  ]
}

/** The newest note names, newest first. */
export function newestNotes(names, n = 3) {
  return names
    .filter((x) => NOTE_NAME_RE.test(x))
    .sort()
    .reverse()
    .slice(0, n)
}
