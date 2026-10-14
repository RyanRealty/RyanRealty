import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:deploy-defect-filing (scripts/check-deploy-defect-filing.mjs).
 *
 * A static gate is only worth its runtime if every rule can FAIL. Each case copies
 * the files the gate reads into a sandbox, breaks exactly one rule, and asserts a
 * non-zero exit naming that rule. The first test proves the untouched sandbox
 * PASSES, so a failure below is the mutation and not the copy; the last cases prove
 * the deliberately-safe shapes stay green.
 *
 * The sandbox lives OUTSIDE the repo (a concurrent `git clean -fd` cannot delete it
 * mid-run) with node_modules symlinked in so `import ts from 'typescript'` resolves.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const FILES = [
  'scripts/check-deploy-defect-filing.mjs',
  'scripts/check-vercel-deploy.mjs',
  'scripts/lib/deploy-defect-report.mjs',
  'scripts/deploy-defects.ts',
  'scripts/loop-brief.ts',
  'lib/data/loop/deploy-defects.ts',
  'lib/data/loop/deploy-defects-dal.ts',
  'lib/data/loop/fleet-cases.ts',
  'docs/RUN_LOOP.md',
]

let SANDBOX = ''

function reset() {
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
}

function runGate() {
  try {
    const out = execFileSync('node', [join(SANDBOX, 'scripts/check-deploy-defect-filing.mjs')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

function edit(rel, fn) {
  const p = join(SANDBOX, rel)
  const before = readFileSync(p, 'utf8')
  const after = fn(before)
  if (after === before) throw new Error(`mutation changed nothing in ${rel}: the case is stale`)
  writeFileSync(p, after)
}

/** Break one rule, run the gate, expect a non-zero exit tagged with that rule. */
function expectCaught(rule, breakIt) {
  reset()
  breakIt()
  const result = runGate()
  expect(result.code, `gate passed despite: ${rule}\n${result.out}`).not.toBe(0)
  expect(result.out).toContain(`[${rule}]`)
  return result.out
}

beforeAll(() => {
  SANDBOX = mkdtempSync(join(tmpdir(), 'deploy-defect-gate-'))
  symlinkSync(join(REPO, 'node_modules'), join(SANDBOX, 'node_modules'))
})

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
})

const DEPLOY = 'scripts/check-vercel-deploy.mjs'
const REPORT = 'scripts/lib/deploy-defect-report.mjs'
const RULES = 'lib/data/loop/deploy-defects.ts'
const DAL = 'lib/data/loop/deploy-defects-dal.ts'

describe('ci:deploy-defect-filing', () => {
  it('passes the real tree, copied untouched', () => {
    reset()
    const result = runGate()
    expect(result.code, result.out).toBe(0)
    expect(result.out).toContain('7 check families')
  })

  it('R1: deploy:verify no longer honors --no-file', () => {
    expectCaught('R1', () => edit(DEPLOY, (s) => s.replaceAll('noFileRequested', 'neverRequested')))
  })

  it('R1: the live checks stop living in runLiveChecks', () => {
    expectCaught('R1', () => edit(DEPLOY, (s) => s.replaceAll('runLiveChecks', 'runChecks')))
  })

  it('R1: deploy:verify stops building the report', () => {
    expectCaught('R1', () => edit(DEPLOY, (s) => s.replace('createDefectReport({ sha', 'createDefectReportX({ sha')))
  })

  it('R2: an early process.exit in runLiveChecks (it would skip the filer)', () => {
    expectCaught('R2', () => edit(DEPLOY, (s) => s.replace('  let code = 0\n  const problem', '  let code = 0\n  process.exit(1)\n  const problem')))
  })

  it('R2: a check stops recording its failures', () => {
    const out = expectCaught('R2', () => edit(DEPLOY, (s) => s.replace("family: 'sitemap-url-health', status: 'fail'", "family: 'sitemap-url-health', status: 'oops'")))
    expect(out).toContain('sitemap-url-health as fail')
  })

  it('R2: a check stops recording its passes, so its node would never close', () => {
    const out = expectCaught('R2', () => edit(DEPLOY, (s) => s.replace("family: 'live-seo',\n        status: 'pass'", "family: 'live-seo',\n        status: 'ok'")))
    expect(out).toContain('live-seo as pass')
  })

  it('R2: nothing is flushed to the work graph', () => {
    expectCaught('R2', () => edit(DEPLOY, (s) => s.replace('defects.flush()', 'defects.results')))
  })

  it('R2: a new check family is added to the module and deploy:verify does not record it', () => {
    const out = expectCaught('R2', () => edit(RULES, (s) => s.replace("  homepage: {", "  'new-check': { label: 'a new check', reproduce: 'npm run x' },\n  homepage: {")))
    expect(out).toContain('new-check as fail')
  })

  it('R3: main() stops exiting with the checks\' verdict', () => {
    expectCaught('R3', () => edit(DEPLOY, (s) => s.replace('process.exit(await runLiveChecks(', 'process.exit(0 && await runLiveChecks(')))
  })

  it('R4: the filer no longer runs under the react-server condition', () => {
    expectCaught('R4', () => edit(REPORT, (s) => s.replace("'--conditions=react-server'", "'--conditions=node'")))
  })

  it('R4: the filer script path drifts', () => {
    expectCaught('R4', () => edit(REPORT, (s) => s.replace("FILER_SCRIPT = 'scripts/deploy-defects.ts'", "FILER_SCRIPT = 'scripts/elsewhere.ts'")))
  })

  it('R4: flush() can throw', () => {
    expectCaught('R4', () => edit(REPORT, (s) => s.replace('    flush() {', '    flushNow() {')))
  })

  it('R5: the DAL binding reaches the table directly', () => {
    expectCaught('R5', () => edit(DAL, (s) => `${s}\nexport const peek = (sb: { from: (t: string) => unknown }) => sb.from('loop_work_nodes')\n`))
  })

  it('R5: the DAL binding stops calling completeWorkNode', () => {
    expectCaught('R5', () => edit(DAL, (s) => s.replace('await completeWorkNode({ id, evidence })', 'await ({ id, evidence, data: null, error: null })')))
  })

  it('R5: the claim script builds its own client (a claim written by hand)', () => {
    expectCaught('R5', () => edit('scripts/deploy-defects.ts', (s) => `${s}\nconst sb = createClient('u', 'k')\n`))
  })

  it('R5: the rules module builds a service client', () => {
    expectCaught('R5', () => edit(RULES, (s) => `${s}\nexport const c = createServiceClient()\n`))
  })

  it('R6: the boot brief stops listing deploy-found nodes', () => {
    expectCaught('R6', () => edit('scripts/loop-brief.ts', (s) => s.replace('for (const line of formatDeployDefectBrief(', 'for (const line of formatOtherBrief(')))
  })

  it('R6: the block drops below the handoff, away from the top', () => {
    expectCaught('R6', () =>
      edit('scripts/loop-brief.ts', (s) => {
        const marker = "  push('--- HANDOFF (standing holds + newest notes) ---')"
        const at = s.indexOf('  // Deploy-found defects (Matt 2026-10-14)')
        const end = s.indexOf(marker)
        const block = s.slice(at, end)
        return `${s.slice(0, at)}${marker}${s.slice(end + marker.length)}\n${block}`
      }),
    )
  })

  it('R7: the fleet packs pick up DEPLOY- nodes again', () => {
    expectCaught('R7', () => edit('lib/data/loop/fleet-cases.ts', (s) => s.replaceAll('isDeployFoundGap(', 'isSomethingElse(')))
  })

  it('R8: the canon line leaves RUN_LOOP.md', () => {
    expectCaught('R8', () => edit('docs/RUN_LOOP.md', (s) => s.replaceAll('deploy-defects.ts', 'other-script.ts')))
  })

  it('safe: a comment that names process.exit inside runLiveChecks does not trip R2', () => {
    reset()
    edit(DEPLOY, (s) => s.replace('  let code = 0\n  const problem', '  // never process.exit(1) here: it would skip the filer\n  let code = 0\n  const problem'))
    const result = runGate()
    expect(result.code, result.out).toBe(0)
  })

  it('safe: Array.from in the DAL binding is not table access', () => {
    reset()
    edit(DAL, (s) => `${s}\nexport const ids = (n: number) => Array.from({ length: n }, (_, i) => i)\n`)
    const result = runGate()
    expect(result.code, result.out).toBe(0)
  })

  it('--report prints the finding and exits 0 even when a rule is broken', () => {
    reset()
    edit('docs/RUN_LOOP.md', (s) => s.replaceAll('deploy-defects.ts', 'other-script.ts'))
    let code = 0
    try {
      execFileSync('node', [join(SANDBOX, 'scripts/check-deploy-defect-filing.mjs'), '--report'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      code = error.status ?? 1
    }
    expect(code).toBe(0)
  })
})
