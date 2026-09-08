import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * Break-tests for ci:site-primitive-wired (scripts/check-site-primitive-wired.mjs, G73).
 *
 * The gate refuses a components/site/v3 barrel component that no file outside
 * app/dev/** imports — the shape that let SITE-05 (V3StickyAsk) and SITE-11
 * (V3ProofBlock) merge 4,419 lines that no visitor could reach. Each case
 * materializes a disposable fixture tree and runs the REAL gate against it via
 * --root, so every red path is proven to fire and every safe shape proven green.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-site-primitive-wired.mjs')

// This suite can run inside a git hook (pre-commit runs the gate project), and
// git exports GIT_INDEX_FILE / GIT_DIR-family vars that redirect child tooling
// at the REAL repo. Strip every GIT_* before spawning, same posture as
// check-site-node.test.mjs (reference_git_fixture_env_leak.md).
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

const SANDBOX = join(
  tmpdir(),
  `rr-site-primitive-wired-${process.pid}-${Math.random().toString(16).slice(2)}`,
)

function write(relPath, contents) {
  const dest = join(SANDBOX, relPath)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, contents)
}

/**
 * A minimal but REAL fixture tree: a v3 barrel exporting one component plus one
 * always-wired control, the component's own file, and a real page that imports
 * only the control. Every case then adds the importer shape it is testing.
 */
function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })

  write(
    'components/site/v3/index.ts',
    [
      "export { V3Widget } from './V3Widget'",
      "export { V3Anchor } from './V3Anchor'",
      "export { V3_ROOT_CLASS } from './atoms'",
      "export { v3Text } from './atoms'",
      "export type { V3WidgetProps } from './V3Widget'",
      '',
    ].join('\n'),
  )
  write('components/site/v3/V3Widget.tsx', 'export function V3Widget() { return null }\n')
  write('components/site/v3/V3Anchor.tsx', 'export function V3Anchor() { return null }\n')
  write(
    'components/site/v3/atoms.tsx',
    "export const V3_ROOT_CLASS = 'v3'\nexport function v3Text(s: string) { return s }\n",
  )

  // A real public page that always wires V3Anchor — so V3Anchor is never the
  // component under test and a failure names exactly one thing.
  write(
    'app/sell/page.tsx',
    "import { V3Anchor } from '@/components/site/v3'\nexport default function Page() { return <V3Anchor /> }\n",
  )
}

function baseline(unwired) {
  write(
    'scripts/site-primitive-wired-baseline.json',
    JSON.stringify({ note: 'fixture', unwired }, null, 2) + '\n',
  )
}

function run(extraArgs = []) {
  const r = spawnSync('node', [GATE, `--root=${SANDBOX}`, ...extraArgs], {
    cwd: REPO,
    encoding: 'utf8',
    env: cleanEnv,
  })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('check-site-primitive-wired', () => {
  beforeEach(reset)
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('(a) fails when a barrel component is imported only by an app/dev page, naming it and the dev importer', () => {
    write(
      'app/dev/site-05-widget/page.tsx',
      "import { V3Widget } from '@/components/site/v3'\nexport default function Page() { return <V3Widget /> }\n",
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('V3Widget')
    expect(r.out).toContain('components/site/v3/V3Widget.tsx')
    expect(r.out).toContain('app/dev/site-05-widget/page.tsx')
    expect(r.out).toContain('G73')
    expect(r.out).toContain('scripts/site-primitive-wired-baseline.json')
    // The always-wired control must not be dragged into the failure.
    expect(r.out).not.toContain('V3Anchor')
  })

  it('(b) passes once the same component is also imported by a real page', () => {
    write(
      'app/dev/site-05-widget/page.tsx',
      "import { V3Widget } from '@/components/site/v3'\nexport default function Page() { return <V3Widget /> }\n",
    )
    write(
      'app/sell/page.tsx',
      "import { V3Anchor, V3Widget } from '@/components/site/v3'\nexport default function Page() { return <><V3Anchor /><V3Widget /></> }\n",
    )
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('ci:site-primitive-wired OK')
  })

  it('(b2) a deep import from a real page counts as the wire, not just the barrel', () => {
    write(
      'components/marketing/Panel.tsx',
      "import { V3Widget } from '@/components/site/v3/V3Widget'\nexport function Panel() { return <V3Widget /> }\n",
    )
    const r = run()
    expect(r.code).toBe(0)
  })

  it('(c) fails when the only importer is another components/site/v3 file — a barrel sibling is not a wire', () => {
    write(
      'components/site/v3/V3Anchor.tsx',
      "import { V3Widget } from './V3Widget'\nexport function V3Anchor() { return <V3Widget /> }\n",
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('V3Widget')
    expect(r.out).toContain('no importers at all')
  })

  it('(d) passes when the unwired component is recorded in the baseline', () => {
    write(
      'app/dev/site-05-widget/page.tsx',
      "import { V3Widget } from '@/components/site/v3'\nexport default function Page() { return <V3Widget /> }\n",
    )
    baseline({ V3Widget: 'dev-only for now — SITE node abc owes the wiring' })
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('1 recorded in the shrink-only baseline')
  })

  it('(e) fails when a baseline entry is now wired — the baseline may only shrink', () => {
    write(
      'app/sell/page.tsx',
      "import { V3Anchor, V3Widget } from '@/components/site/v3'\nexport default function Page() { return <><V3Anchor /><V3Widget /></> }\n",
    )
    baseline({ V3Widget: 'dev-only for now — SITE node abc owes the wiring' })
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('now WIRED')
    expect(r.out).toContain('V3Widget')
  })

  it('(e2) fails when a baseline entry names a component the barrel no longer exports', () => {
    baseline({ V3Deleted: 'stale entry for a component that no longer exists' })
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('no longer exports')
    expect(r.out).toContain('V3Deleted')
  })

  it('(f) --report exits 0 and prints the rule, even with a live violation', () => {
    write(
      'app/dev/site-05-widget/page.tsx',
      "import { V3Widget } from '@/components/site/v3'\nexport default function Page() { return <V3Widget /> }\n",
    )
    const r = run(['--report'])
    expect(r.code).toBe(0)
    expect(r.out).toContain('G73')
    expect(r.out).toContain('site primitives ship wired')
  })

  it('a type-only import does not count as a wire', () => {
    write(
      'app/buy/page.tsx',
      "import type { V3Widget } from '@/components/site/v3'\nexport default function Page() { return null }\n",
    )
    write(
      'app/buy/other.tsx',
      "import { type V3Widget } from '@/components/site/v3'\nexport const x = 1\n",
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('V3Widget')
  })

  it('the component name inside a comment or a string is not a wire (AST, not regex)', () => {
    write(
      'app/buy/page.tsx',
      [
        '// V3Widget belongs on this page one day.',
        "const note = 'V3Widget'",
        "import { V3Anchor } from '@/components/site/v3'",
        'export default function Page() { return <V3Anchor /> }',
        '',
      ].join('\n'),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('V3Widget')
  })

  it('non-component exports (constants, hooks, types) are not required to be wired', () => {
    // Nothing imports V3_ROOT_CLASS, v3Text or V3WidgetProps anywhere in the
    // fixture; only the PascalCase value V3Widget may fail.
    write(
      'app/sell/page.tsx',
      "import { V3Anchor, V3Widget } from '@/components/site/v3'\nexport default function Page() { return <><V3Anchor /><V3Widget /></> }\n",
    )
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('2 barrel component(s)')
  })

  it('--json reports the violation and still exits 1', () => {
    write(
      'app/dev/site-05-widget/page.tsx',
      "import { V3Widget } from '@/components/site/v3'\nexport default function Page() { return <V3Widget /> }\n",
    )
    const r = run(['--json'])
    expect(r.code).toBe(1)
    const parsed = JSON.parse(r.out)
    expect(parsed.newViolations).toEqual(['V3Widget'])
    expect(parsed.unwired[0].devImporters).toEqual(['app/dev/site-05-widget/page.tsx'])
  })
})
