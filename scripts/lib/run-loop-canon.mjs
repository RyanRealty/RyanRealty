/**
 * run-loop-canon.mjs — "run the loop" boots on ONE page (visibility audit
 * PROCESS-5/6/8, 2026-09-23).
 *
 * Before docs/RUN_LOOP.md, eight files each carried their own copy of the
 * protocol and they disagreed: a worker cap of 3 and of 6, a rise floor of 6
 * and of 3, an "hourly" routine that ran every four hours, a hand-written
 * claim beside "the ONLY claim path", push-to-main beside "PR only, Cos Mini
 * lands". A session got whichever copy its tool loaded. The rule now: the
 * pointer files link RUN_LOOP.md and restate none of those facts; the numbers
 * live in code (lib/data/loop/work-node.ts, taste-rule-freeze.json) and the
 * protocol lives in RUN_LOOP.md.
 *
 * Pure: ci:process-canon passes { path, content } pairs (content null when the
 * file is missing) and prints what comes back.
 */

export const RUN_LOOP_DOC = 'docs/RUN_LOOP.md'
export const RUN_LOOP_MAX_LINES = 150

/** Every file a tool loads when Matt says "run the loop". */
export const RUN_LOOP_POINTERS = Object.freeze([
  'CLAUDE.md',
  'AGENTS.md',
  'docs/DEVELOPMENT_PROCESS.md',
  '.claude/skills/site-queue/SKILL.md',
  '.cursor/skills/site-queue/SKILL.md',
  '.cursor/rules/run-loop.mdc',
  'docs/GROK_BOT_BRAIN.md',
  'scripts/site-queue-routine-prompt.md',
])

/** A pointer file that says one of these has grown its own copy of the protocol. */
export const RESTATEMENT_RES = Object.freeze([
  {
    id: 'worker cap',
    re: /MAX_SITE_WORKERS\s*=\s*\d|maxWorkers`?\s*\(\s*\d+\s*\)|\b(?:two|three|four|five|six|seven|eight|\d+)\s+(?:live\s+)?workers\b/i,
  },
  { id: 'claims per session', re: /\b(?:one|two|three|four|\d+)\s+claims?\s+(?:each|per session)\b/i },
  { id: 'rise floor', re: /rise floor[^.\n]{0,40}?\b\d+\b|\bby at least \d+\b/i },
  {
    id: 'cadence',
    re: /\bevery (?:two|three|four|six|\d+) hours\b|\bhourly (?:claude )?(?:cloud )?routine\b|\b(?:six|\d+) fires a day\b/i,
  },
  { id: 'claim command', re: /--claim\s+SITE-/ },
  { id: 'land path', re: /\bCos Mini lands\b|\bPR only\b/i },
])

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

/**
 * @param {Array<{ path: string, content: string | null }>} files
 * @returns {string[]} empty = the boot page and its pointers agree
 */
export function runLoopProblems(files) {
  const p = []
  const byPath = new Map((files ?? []).map((f) => [f.path, f.content]))
  const doc = byPath.get(RUN_LOOP_DOC)
  if (doc == null) {
    p.push(`${RUN_LOOP_DOC} is missing. It is the one page "run the loop" boots on for every tool; restore it.`)
  } else {
    const lines = doc.replace(/\n$/, '').split('\n').length
    if (lines > RUN_LOOP_MAX_LINES) {
      p.push(
        `${RUN_LOOP_DOC} is ${lines} lines, over its ${RUN_LOOP_MAX_LINES}-line cap. A boot page nobody finishes is how the 601-line skill failed; move detail to the doc that owns it and leave a pointer.`,
      )
    }
  }
  for (const path of RUN_LOOP_POINTERS) {
    if (!byPath.has(path)) continue
    const text = byPath.get(path)
    if (text == null) {
      p.push(`${path} is missing; it is a "run the loop" entry point.`)
      continue
    }
    if (!text.includes('RUN_LOOP.md')) {
      p.push(`${path} does not point at ${RUN_LOOP_DOC}. Every "run the loop" entry point links it.`)
    }
    for (const { id, re } of RESTATEMENT_RES) {
      const m = re.exec(text)
      if (m) {
        p.push(
          `${path}:${lineOf(text, m.index)} restates the ${id} ("${m[0]}"). Say it once, in ${RUN_LOOP_DOC} or the code it names; a pointer file links, it does not copy.`,
        )
      }
    }
  }
  return p
}
