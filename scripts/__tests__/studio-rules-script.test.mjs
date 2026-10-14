import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * ci:studio-rules has to run on Node 20 (GitHub CI, .github/workflows/ci.yml)
 * and on Node 22 (local checkouts, which `npm run push` gates). The two read
 * `node --test <arg>` differently, and three edits on 2026-10-13 flipped the
 * script between forms that each broke one of them:
 *   - a directory (`.../tests/`): Node 22 loads it as a module, MODULE_NOT_FOUND;
 *   - a quoted glob (`".../**\/*.test.mjs"`): Node 20 does not expand it,
 *     "Could not find".
 * Naming each test file runs on both. Add a new test file to the script by name.
 */
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const script = pkg.scripts['ci:studio-rules']

describe('ci:studio-rules runs on Node 20 and Node 22', () => {
  it('is a node --test run', () => {
    expect(script).toMatch(/^node --test /)
  })

  it('names each test file, never a directory or a glob', () => {
    const args = script.replace(/^node --test /, '').trim().split(/\s+/)
    expect(args.length).toBeGreaterThan(0)
    for (const arg of args) {
      expect(arg, `${arg}: a directory breaks Node 22`).not.toMatch(/\/$/)
      expect(arg, `${arg}: a glob breaks Node 20`).not.toMatch(/[*?"]/)
      expect(arg, `${arg}: name a .test.mjs file`).toMatch(/\.test\.mjs$/)
    }
  })
})
