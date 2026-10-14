/**
 * Every place the repo runs vitest names the project it runs (ci:int-test-residue, R6).
 *
 * Why: the `int` project writes to PRODUCTION Supabase, and test/int-global-setup.ts
 * refuses to start it unless RR_INT_RUN=1. A command that runs vitest with no
 * `--project` pulls the int project in on any machine with production keys, so it
 * aborts there (2026-10-14: `"test": "vitest run"` made `npm test` and
 * `quality:full` fail on every keyed machine). A run names its project or it does
 * not run: `--project unit --project gates`, or `--project int` behind RR_INT_RUN=1.
 *
 * `bareVitestRuns(text)` returns the commands in a block of shell (an npm script, a
 * workflow `run:` line, a hook) that run vitest with no `--project`. `vitest list`,
 * `--help` and `--version` run no tests and are not returned. Comment lines and
 * trailing comments are ignored.
 */

const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=\S*$/
const NO_RUN = new Set(['list', '--help', '-h', '--version', '-v', 'init', 'bench'])

/** @param {string} text @returns {string[]} the commands that run vitest without --project */
export function bareVitestRuns(text) {
  const out = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/(^|\s)#.*$/, '')
    for (const segment of line.split(/&&|\|\||;|\|/)) {
      const words = segment.trim().split(/\s+/).filter(Boolean)
      // The command word: skip env assignments, `npx`, `npx --yes`, `exec`, `node`.
      let i = 0
      while (i < words.length && (ENV_ASSIGN.test(words[i]) || ['npx', '--yes', '-y', 'exec', 'node'].includes(words[i]))) i++
      const cmd = words[i]
      if (!cmd || !/(^|\/)vitest(\.mjs)?$/.test(cmd)) continue
      const rest = words.slice(i + 1)
      if (NO_RUN.has(rest[0] ?? '')) continue
      if (rest.some((w) => w === '--project' || w.startsWith('--project='))) continue
      out.push(words.join(' '))
    }
  }
  return out
}
