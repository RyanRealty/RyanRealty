import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:alert-capture-disclosure (G67).
 *
 * The gate exists because three v3 migrations each dropped the honeypot and the
 * standing disclosure off a public email-capture form and declared, at most, the
 * honeypot. So every one of its four rules has to be provably able to FAIL, and
 * the safe shapes have to stay green — a false positive is what gets a gate
 * deleted, and the shapes most likely to trip it are the two registers doing the
 * right thing differently (the v3 Sheet's `trap` prop against the KB register's
 * hidden input) and a docblock QUOTING the defect it warns about.
 *
 * The sandbox lives OUTSIDE the repo: a concurrent sibling session running
 * `git clean -fd` deletes an untracked in-repo scratch dir mid-run and the
 * failure reads as a gate bug. The gate imports only node builtins and
 * ./lib/walk.mjs, so no node_modules symlink is needed.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-alert-capture-gate-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-alert-capture-disclosure.mjs')

const FILES = [
  'scripts/check-alert-capture-disclosure.mjs',
  'scripts/lib/walk.mjs',
  // The compliant subject: every rule satisfied, through the v3 register.
  'app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx',
  // Second compliant surface. KbCommunityAlerts and the homepage sheet are
  // gone (homepage declutter, Matt 2026-09-01); /invest carries the sibling.
  'app/invest/_v3/InvestAlertSheet.client.tsx',
]

function run() {
  try {
    return { code: 0, out: execFileSync('node', [GATE], { cwd: SANDBOX, encoding: 'utf8' }) }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
}

function write(rel, contents) {
  const p = join(SANDBOX, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, contents)
}

function edit(rel, fn) {
  const p = join(SANDBOX, rel)
  writeFileSync(p, fn(readFileSync(p, 'utf8')))
}

/**
 * A capture surface at a path the ledger does not name, so it must satisfy every
 * rule. `omit` drops one piece, which is the mutation each case is testing.
 */
function surface({ omit = null } = {}) {
  const lines = [
    "import { V3Sheet } from '@/components/site/v3'",
    "import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'",
    '',
    'export function ProbeSheet() {',
    '  const send = async (answers: Record<string, string>) => {',
    '    await submitSearchAlertSignup({',
    "      email: answers.email ?? '',",
    '      filters: {},',
    omit === 'company-wired' ? "      company: '', " : "      company: answers.company ?? '',",
    '    })',
    '  }',
    '  const copy = [',
    omit === 'frequency' ? "    'Listings by email.'," : "    'One email per new listing.',",
    omit === 'unsubscribe' ? "    'We send them until you say stop.'," : "    'Unsubscribe any time.',",
    '  ]',
    '  return (',
    '    <V3Sheet',
    '      heading="Probe"',
    "      steps={[{ id: 'email', label: 'Email', children: copy }]}",
    omit === 'honeypot' ? '' : "      trap={{ name: 'company', label: 'Company' }}",
    '      onAdvance={(e) => void send(e.answers)}',
    '    />',
    '  )',
    '}',
  ]
  return lines.filter((l) => l !== '').join('\n') + '\n'
}

function expectCaught(rule, mutate) {
  reset()
  mutate()
  const result = run()
  expect(result.code, `gate passed despite a missing ${rule}\n${result.out}`).not.toBe(0)
  expect(result.out).toContain('components/probe/ProbeSheet.client.tsx')
}

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
})

describe('ci:alert-capture-disclosure (G67)', { timeout: 30_000 }, () => {
  it('passes on an untouched copy of the inspected tree', () => {
    reset()
    const result = run()
    expect(result.out).toContain('capture surface(s) scanned')
    expect(result.code, result.out).toBe(0)
  })

  it('sees both registers as compliant, so neither honest shape is a false positive', () => {
    reset()
    const result = run()
    // 2 surfaces: the v3 Sheet with `trap`, and the KB block with its own input.
    expect(result.out).toContain('2 capture surface(s) scanned')
    expect(result.code, result.out).toBe(0)
  })

  it('honeypot — fails a Sheet that passes no trap', () => {
    expectCaught('honeypot', () => write('components/probe/ProbeSheet.client.tsx', surface({ omit: 'honeypot' })))
  })

  it("company-wired — fails a Sheet that hardcodes company: ''", () => {
    expectCaught('wired trap value', () =>
      write('components/probe/ProbeSheet.client.tsx', surface({ omit: 'company-wired' })),
    )
  })

  it('frequency — fails a Sheet that never says how often the email comes', () => {
    expectCaught('frequency statement', () =>
      write('components/probe/ProbeSheet.client.tsx', surface({ omit: 'frequency' })),
    )
  })

  it('unsubscribe — fails a Sheet that never says how to stop it', () => {
    expectCaught('unsubscribe statement', () =>
      write('components/probe/ProbeSheet.client.tsx', surface({ omit: 'unsubscribe' })),
    )
  })

  it('stays green on a fully compliant new surface', () => {
    reset()
    write('components/probe/ProbeSheet.client.tsx', surface())
    const result = run()
    expect(result.code, `gate FALSE-POSITIVED on a compliant surface\n${result.out}`).toBe(0)
  })

  it('reads code, not comments: a docblock quoting the defect does not satisfy a rule', () => {
    reset()
    write(
      'components/probe/ProbeSheet.client.tsx',
      `/**\n * This sheet does NOT hardcode company: '' and it is not missing its\n * trap={{ name: 'company' }} — one email per new listing, unsubscribe any time.\n */\n` +
        surface({ omit: 'honeypot' }).replace("'One email per new listing.',", "'Listings by email.',"),
    )
    const result = run()
    expect(result.code, `comments satisfied a rule\n${result.out}`).not.toBe(0)
    expect(result.out).toContain('renders no honeypot')
    expect(result.out).toContain('states no send frequency')
  })

  it('ignores a surface that captures nothing', () => {
    reset()
    write(
      'components/probe/Plain.client.tsx',
      "export function Plain() {\n  return <p>One email per new listing.</p>\n}\n",
    )
    const result = run()
    expect(result.out).toContain('2 capture surface(s) scanned')
    expect(result.code, result.out).toBe(0)
  })
})
