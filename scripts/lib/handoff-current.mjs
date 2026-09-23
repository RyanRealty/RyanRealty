/**
 * handoff-current.mjs — the one-block rule for docs/plans/CROSS_AGENT_HANDOFF.md.
 *
 * The handoff is how a Grok, Cursor or Claude session learns what the last
 * session left. Its rule since 2026-09-12 is ONE `# Current` block, replaced at
 * session end. By 2026-09-22 the file had grown back to 52 stacked blocks, and
 * the loop brief printed only the first 18 lines of the stack, so six of Matt's
 * ten directives from that day never reached a booting session (visibility
 * audit PROCESS-8). Prose did not hold the rule; this module does.
 *
 * Pure functions, no I/O: scripts/check-handoff-current.mjs (ci:handoff-current)
 * and its test import them.
 */

/** A top-level `# Current` heading (the block marker). `## Current` does not count. */
export const CURRENT_HEADING_RE = /^# Current\b/

/** Any top-level heading ends the Current block. */
const TOP_HEADING_RE = /^# \S/

/** A fenced code block opens or closes on ``` or ~~~ (a `# comment` inside one is not a heading). */
const FENCE_RE = /^\s{0,3}(```|~~~)/

/**
 * Each line with whether it sits inside a fenced code block. The fence lines
 * themselves count as inside, so they are never read as headings.
 *
 * @param {string} text
 * @returns {Array<{ line: string, fenced: boolean }>}
 */
function scanLines(text) {
  let open = null
  return String(text ?? '')
    .split('\n')
    .map((line) => {
      const m = FENCE_RE.exec(line)
      if (m) {
        if (open == null) open = m[1]
        else if (m[1] === open) open = null
        return { line, fenced: true }
      }
      return { line, fenced: open != null }
    })
}

/** @param {string} text */
export function currentHeadingLines(text) {
  const out = []
  scanLines(text).forEach(({ line, fenced }, i) => {
    if (!fenced && CURRENT_HEADING_RE.test(line)) out.push(i + 1)
  })
  return out
}

/**
 * The whole Current block: from the first `# Current` line up to the next
 * top-level `# ` heading outside a code fence (or the end of the file). Empty
 * string when absent.
 *
 * @param {string} text
 */
export function extractCurrentBlock(text) {
  const scanned = scanLines(text)
  const start = scanned.findIndex(({ line, fenced }) => !fenced && CURRENT_HEADING_RE.test(line))
  if (start < 0) return ''
  let end = scanned.length
  for (let i = start + 1; i < scanned.length; i += 1) {
    if (!scanned[i].fenced && TOP_HEADING_RE.test(scanned[i].line)) {
      end = i
      break
    }
  }
  return scanned
    .slice(start, end)
    .map(({ line }) => line)
    .join('\n')
    .trim()
}

/**
 * Empty array = the file holds exactly one `# Current` block.
 *
 * @param {string} text
 * @param {string} [label]
 */
export function handoffCurrentProblems(text, label = 'docs/plans/CROSS_AGENT_HANDOFF.md') {
  const at = currentHeadingLines(text)
  if (at.length === 1) return []
  if (at.length === 0) {
    return [
      `${label} has no "# Current" block. The loop brief prints that block at every boot; write one (surface, SHA, what landed, what is next, skills read).`,
    ]
  }
  return [
    `${label} has ${at.length} "# Current" blocks (lines ${at.join(', ')}). The rule is ONE: replace the block at session end, do not stack a new one on top. ` +
      'Carry any still-open Matt directive from the older blocks into the one you keep (with its node, or "no node"), then move the older blocks verbatim to docs/archive/.',
  ]
}
