import { describe, expect, it } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:activity-event-labels (G68).
 *
 * The gate exists because `activity_events.event_type` is free text whose value
 * set the writer EXTENDS by interpolation, and four consumers each kept a
 * partial map that printed the raw column value when it missed. "status_canceled
 * · Bend · Stonegate" reached the public /activity page that way. So every rule
 * has to be provably able to fail — and the shapes that legitimately touch
 * `event_type` without labelling it (a styling-variant resolver, a prop handed
 * to a child component, an icon switch) have to stay green, because false
 * positives are what gets a gate deleted.
 *
 * The sandbox lives OUTSIDE the repo: a concurrent sibling session running
 * `git clean -fd` deletes an untracked in-repo scratch dir mid-run and the
 * failure reads as a gate bug. The gate imports only node builtins, so no
 * node_modules symlink is needed.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), 'rr-activity-event-labels-gate-sandbox')
const GATE = join(SANDBOX, 'scripts/check-activity-event-labels.mjs')

const FILES = [
  'scripts/check-activity-event-labels.mjs',
  'lib/activity/event-label.ts',
  'lib/sync/deltaSync.ts',
  'app/activity/_v3/activity-rows.ts',
  'lib/kb/place-sections.ts',
  'app/actions/activity-feed-shared.ts',
]

function run(args = []) {
  try {
    return { code: 0, out: execFileSync('node', [GATE, ...args], { cwd: SANDBOX, encoding: 'utf8' }) }
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

describe('ci:activity-event-labels', () => {
  it('passes on the real tree', () => {
    reset()
    const { code, out } = run()
    expect(out).not.toMatch(/^FAIL/m)
    expect(code).toBe(0)
  })

  it('A: fails when the resolver loses its status_ prefix branch', () => {
    reset()
    // The founding hazard: a literal map alone cannot cover `status_${slug}`.
    edit('lib/activity/event-label.ts', (t) => t.replace(/if \(key\.startsWith\('status_'\)\).*\n/, ''))
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[A\].*status_ prefix/)
  })

  it('A: fails when a resolver branch returns the raw event_type', () => {
    reset()
    edit('lib/activity/event-label.ts', (t) =>
      t.replace('  return LISTING_UPDATE\n}', '  return { kind: "update", label: String(eventType) }\n}'),
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[A\]/)
  })

  it('B: fails when the writer adds an event_type literal with no label', () => {
    reset()
    edit('lib/sync/deltaSync.ts', (t) =>
      t.replace("event_type: 'status_pending',", "event_type: 'status_auction_scheduled',"),
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[B\].*status_auction_scheduled/)
  })

  it('B: fails when the writer interpolates a NEW prefix the resolver does not branch on', () => {
    reset()
    edit('lib/sync/deltaSync.ts', (t) => t.replace('event_type: `status_${slug}`', 'event_type: `mls_${slug}`'))
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[B\].*mls_/)
  })

  it('C: fails when /activity stops resolving through the canonical module', () => {
    reset()
    // Exactly the shipped defect: a local map with a raw-value fallback.
    edit('app/activity/_v3/activity-rows.ts', (t) =>
      t
        .replace(/import \{ activityEventLabel \} from '@\/lib\/activity\/event-label'\n/, '')
        .replace(
          'const kind = activityEventLabel(a.event_type)',
          "const LOCAL = { new_listing: 'New' }\n    const kind = LOCAL[a.event_type] ?? a.event_type",
        ),
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[C\].*\/activity/)
    expect(out).toMatch(/FAIL\s+\[E\].*nullish fallback/)
  })

  it('C: fails when the KB place ledger stops resolving through the canonical module', () => {
    reset()
    edit('lib/kb/place-sections.ts', (t) =>
      t.replace("import { activityEventDisplay } from '@/lib/activity/event-label'\n", ''),
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[C\].*KB place/)
  })

  it('D: fails on a NEW consumer that builds a second label vocabulary', () => {
    reset()
    write(
      'components/site/RogueActivityLabel.tsx',
      [
        "import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'",
        '',
        "function eventLabel(type: ActivityFeedItem['event_type']): string {",
        "  if (type === 'new_listing') return 'New'",
        '  return type',
        '}',
        '',
        'export default eventLabel',
        '',
      ].join('\n'),
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[D\].*RogueActivityLabel.*eventLabel/)
  })

  it('E: fails when a consumer renders the raw event_type as text', () => {
    reset()
    // The shipped consumers this once edited were deleted with the g55 orphan
    // component trees, so the case is carried by a synthesized consumer: the
    // import is what puts a file in scope, and the JSX is the defect.
    write(
      'components/site/RawActivityRow.tsx',
      [
        "import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'",
        '',
        'export function Row({ item }: { item: ActivityFeedItem }) {',
        '  return <span>{item.event_type}</span>',
        '}',
        '',
      ].join('\n'),
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/FAIL\s+\[E\].*rendered in JSX/)
  })

  it('stays green on a styling-variant resolver that is not a label', () => {
    reset()
    write(
      'components/site/SafeVariant.tsx',
      [
        "import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'",
        '',
        "export function badgeVariant(type: ActivityFeedItem['event_type']): 'soft-hot' | 'soft-neutral' {",
        "  return type === 'price_drop' ? 'soft-hot' : 'soft-neutral'",
        '}',
        '',
      ].join('\n'),
    )
    const { code, out } = run()
    expect(out).not.toMatch(/^FAIL/m)
    expect(code).toBe(0)
  })

  it('stays green on event_type handed to a child component as a prop', () => {
    reset()
    write(
      'components/site/SafeProp.tsx',
      [
        "import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'",
        '',
        'export function Row({ item }: { item: ActivityFeedItem }) {',
        '  return <Overlay eventType={item.event_type} />',
        '}',
        '',
      ].join('\n'),
    )
    const { code, out } = run()
    expect(out).not.toMatch(/^FAIL/m)
    expect(code).toBe(0)
  })

  it('--report always exits 0 and --json is machine-readable', () => {
    reset()
    edit('lib/kb/place-sections.ts', (t) =>
      t.replace("import { activityEventDisplay } from '@/lib/activity/event-label'\n", ''),
    )
    const report = run(['--report'])
    expect(report.code).toBe(0)
    expect(report.out).toMatch(/report mode/)

    const json = run(['--json'])
    expect(json.code).toBe(1)
    const parsed = JSON.parse(json.out)
    expect(parsed.gate).toBe('activity-event-labels')
    expect(parsed.failed).toBeGreaterThan(0)
  })
})
