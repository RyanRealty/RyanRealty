/**
 * New audit/punch-list doc arm for check-process-canon.mjs (G44 / G72 site
 * queue mechanism). Split into its own module (no top-level side effects, no
 * process.exit) so it can be imported directly by tests — importing
 * check-process-canon.mjs itself would run the whole gate and exit the process.
 *
 * The site queue (loop_work_nodes, domain public-ux — scripts/seed-site-queue.ts)
 * is the only site backlog. A new one-off "AUDIT/PUNCH/E2E"-shaped doc under
 * docs/plans/ is a rogue parallel backlog unless it names the queue nodes its
 * findings append to. Static only — no DB read here; the queue node ids just
 * have to be NAMED (a `Nodes: <uuid>[, <uuid>]` line), not verified to exist.
 */
import { execSync } from 'node:child_process'

export const AUDIT_ARM_PATTERN = /(AUDIT|PUNCH|E2E|audit-|punch)/i
export const NODES_LINE_PATTERN = /^Nodes?:\s*[0-9a-f-]{36}/m

/**
 * The land-path documents: Tip Ready is only `--ship` exit 0 (Matt 2026-09-14),
 * and every one of them boots from docs/RUN_LOOP.md (2026-09-23).
 */
export const TIP_READY_LAND_PATHS = Object.freeze([
  'docs/RUN_LOOP.md',
  '.claude/skills/site-queue/SKILL.md',
  '.cursor/skills/site-queue/SKILL.md',
  'scripts/site-queue-routine-prompt.md',
])

/**
 * Executable refuse: nobody may label Tip Ready unless the land path names
 * `node scripts/lib/taste-receipt.mjs --ship`, and a land-path document other
 * than RUN_LOOP.md points at docs/RUN_LOOP.md. Matt 2026-09-23 made demoMatch a
 * recorded note, so the old "house patch after demoMatch false is FORBIDDEN"
 * phrase is no longer required (visibility audit PROCESS-3 / UXLIVE-11).
 *
 * @param {Array<{ path: string, content: string }>} files
 * @returns {string[]}
 */
export function checkTipReadyLandPath(files) {
  const fails = []
  for (const { path, content } of files) {
    const src = String(content ?? '')
    if (!src.includes('node scripts/lib/taste-receipt.mjs --ship')) {
      fails.push(
        `${path}: Tip Ready land path must name \`node scripts/lib/taste-receipt.mjs --ship\` — nobody labels Tip Ready without --ship exit 0`,
      )
    }
    if (path !== 'docs/RUN_LOOP.md' && !src.includes('docs/RUN_LOOP.md')) {
      fails.push(`${path}: a land-path document must point at docs/RUN_LOOP.md (the one protocol for every tool)`)
    }
  }
  return fails
}

/**
 * Pure predicate: given NEW (added) docs/plans markdown files as
 * { path, content } pairs, return one failure message per file that matches
 * the audit/punch-list naming pattern but has no `Nodes: <uuid>` line in its
 * first 20 lines. A new file that does not match the pattern is untouched by
 * this arm.
 *
 * @param {Array<{ path: string, content: string }>} newDocs
 * @returns {string[]}
 */
export function checkNewAuditDocsNameNodes(newDocs) {
  const fails = []
  for (const { path, content } of newDocs) {
    const basename = path.split('/').pop() ?? path
    if (!AUDIT_ARM_PATTERN.test(basename)) continue
    const first20 = content.split('\n').slice(0, 20).join('\n')
    if (!NODES_LINE_PATTERN.test(first20)) {
      fails.push(
        `${path} is a new audit/punch-list doc; the site queue is the only site backlog (loop_work_nodes, domain public-ux). Add \`Nodes: <id>[, <id>]\` in the first 20 lines naming the queue nodes this doc appends to, or append your findings to those nodes instead of a new doc.`,
      )
    }
  }
  return fails
}

/** git output as trimmed non-empty lines; [] on any failure (detached HEAD, no repo, etc). */
function gitLines(args) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * NEW markdown files under docs/plans/ in this change. Staged additions
 * (pre-commit usage) win when present; otherwise the committed range, using
 * the same fallback order as `committedDiff` in scripts/lib/ci-gates-select.mjs:
 * the upstream range (@{u}...HEAD) locally, else the tip commit's own diff.
 *
 * @returns {string[]}
 */
export function newPlanDocPaths() {
  const staged = gitLines('diff --cached --name-only --diff-filter=A -- docs/plans')
  if (staged.length > 0) return staged
  let hasUpstream = false
  try {
    execSync('git rev-parse --abbrev-ref @{u}', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    hasUpstream = true
  } catch {
    hasUpstream = false
  }
  if (hasUpstream) {
    return gitLines('diff --name-only --diff-filter=A @{u}...HEAD -- docs/plans')
  }
  return gitLines('diff-tree --no-commit-id --name-only --diff-filter=A -r HEAD -- docs/plans')
}
