import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { bareVitestRuns } from './vitest-projects.mjs'

/**
 * Break-tests for ci:int-test-residue R6: a vitest command with no --project pulls the
 * production-writing `int` project in (and aborts on a keyed machine). The founding case
 * is `"test": "vitest run"`, which broke `npm test` and `quality:full`.
 */
describe('bareVitestRuns', () => {
  it('flags a bare `vitest run` (the founding case)', () => {
    expect(bareVitestRuns('vitest run')).toEqual(['vitest run'])
    expect(bareVitestRuns('vitest')).toEqual(['vitest'])
    expect(bareVitestRuns('npx vitest run lib/content lib/studio')).toEqual(['npx vitest run lib/content lib/studio'])
    expect(bareVitestRuns('npx --yes vitest run --reporter=dot a.test.ts')).toHaveLength(1)
    expect(bareVitestRuns('node node_modules/vitest/vitest.mjs run')).toHaveLength(1)
  })

  it('flags the one bare command in a chain, and none of the others', () => {
    expect(bareVitestRuns('npm run lint && vitest run && npm run build')).toEqual(['vitest run'])
    expect(bareVitestRuns('npm run a; vitest run --project unit; vitest run src')).toEqual(['vitest run src'])
    expect(bareVitestRuns('RR_INT_RUN=1 vitest run')).toEqual(['RR_INT_RUN=1 vitest run'])
  })

  it('passes a run that names its project, either spelling', () => {
    expect(bareVitestRuns('vitest run --project unit --project gates')).toEqual([])
    expect(bareVitestRuns('RR_INT_RUN=1 vitest run --project int')).toEqual([])
    expect(bareVitestRuns('npx vitest run --project=unit a.test.ts')).toEqual([])
    expect(bareVitestRuns('npx vitest run --reporter=dot --project gates a b')).toEqual([])
  })

  it('does not flag commands that run no tests, other commands, or comments', () => {
    expect(bareVitestRuns('vitest list --filesOnly')).toEqual([])
    expect(bareVitestRuns('vitest --version')).toEqual([])
    expect(bareVitestRuns('npm run test:unit -- --changed')).toEqual([])
    expect(bareVitestRuns('npm test')).toEqual([])
    expect(bareVitestRuns('# vitest run is bare here\necho ok # vitest run')).toEqual([])
    expect(bareVitestRuns('  # `vitest --changed <base>` runs the test files')).toEqual([])
  })

  it('reads a multi-line run block line by line', () => {
    const block = 'set -e\nnpm ci\nnpx vitest run --project unit\nnpx vitest run lib/x\n'
    expect(bareVitestRuns(block)).toEqual(['npx vitest run lib/x'])
  })
})

describe('the real package.json scripts and workflows', () => {
  const root = join(__dirname, '..', '..')
  it('every package.json script that runs vitest names its project', () => {
    const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts
    for (const [name, cmd] of Object.entries(scripts)) expect(bareVitestRuns(cmd), `package.json scripts.${name}`).toEqual([])
  })
  it('every workflow step that runs vitest names its project', () => {
    const dir = join(root, '.github', 'workflows')
    for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) expect(bareVitestRuns(readFileSync(join(dir, f), 'utf8')), f).toEqual([])
  })
})
