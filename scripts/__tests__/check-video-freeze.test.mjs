/**
 * Break-tests for ci:video-freeze (scripts/check-video-freeze.mjs, G83).
 *
 * Every rule is broken once against the real sources (read from this tree,
 * mutated in memory), and the live tree must stay green. The gate takes a
 * reader, so no sandbox copy is needed: what it inspects is exactly what the
 * mutation produced.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHOKE_POINTS, GUARD_MODULE, checkVideoFreeze } from '../check-video-freeze.mjs'

const ROOT = process.cwd()
const real = (rel) => {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** Run the gate with one file replaced by `mutate(source)` (or removed when it returns null). */
function runWith(rel, mutate) {
  const original = real(rel)
  if (original == null) throw new Error(`${rel} is missing from the tree`)
  const mutated = mutate(original)
  if (mutated === original) throw new Error(`mutation of ${rel} changed nothing; the test is stale`)
  return checkVideoFreeze((path) => (path === rel ? mutated : real(path)))
}

/** Replace the nth (1-based) occurrence of `find`. */
function replaceNth(src, find, replacement, n = 1) {
  let at = -1
  for (let i = 0; i < n; i += 1) {
    at = src.indexOf(find, at + 1)
    if (at < 0) return src
  }
  return src.slice(0, at) + replacement + src.slice(at + find.length)
}

const fileOf = (fragment) => CHOKE_POINTS.find((p) => p.file.includes(fragment)).file

describe('ci:video-freeze on the live tree', () => {
  it('passes', () => {
    expect(checkVideoFreeze(real)).toEqual([])
  })

  it('covers every choke point the freeze was ordered for', () => {
    expect(CHOKE_POINTS.map((p) => p.file)).toEqual([
      'lib/studio/produce.ts',
      'lib/social/imagine-produce.ts',
      'lib/data/studio/drafts.ts',
      'lib/data/agent/actions.ts',
      'app/api/admin/approval-queue/[id]/action/route.ts',
      'app/api/admin/approval-queue/bulk-action/route.ts',
      'app/api/cron/publisher-sweep/route.ts',
      'app/api/social/publish/route.ts',
    ])
  })
})

describe('R0: the guard module', () => {
  it('fails when the freeze is switched off', () => {
    const problems = runWith(GUARD_MODULE, (s) =>
      s.replace('export const VIDEO_PUBLISH_FROZEN: boolean = true', 'export const VIDEO_PUBLISH_FROZEN: boolean = false'),
    )
    expect(problems.join('\n')).toMatch(/VIDEO_PUBLISH_FROZEN must be/)
  })

  it('fails when Matt’s message is reworded', () => {
    const problems = runWith(GUARD_MODULE, (s) => s.replace('need a server-signed certificate.', 'need review.'))
    expect(problems.join('\n')).toMatch(/not Matt's wording/)
  })

  it('fails when the module is deleted', () => {
    const problems = checkVideoFreeze((path) => (path === GUARD_MODULE ? null : real(path)))
    expect(problems.join('\n')).toMatch(/lib\/content\/video-freeze\.ts: missing/)
  })

  it('fails when a guard export is dropped', () => {
    const problems = runWith(GUARD_MODULE, (s) =>
      s.replace('export function splitVideoFrozen', 'function splitVideoFrozen'),
    )
    expect(problems.join('\n')).toMatch(/does not export `splitVideoFrozen`/)
  })
})

describe('R1: every choke point imports the real guard', () => {
  for (const point of CHOKE_POINTS) {
    it(`fails when ${point.file} imports the guard from somewhere else`, () => {
      const problems = runWith(point.file, (s) =>
        s.replace("from '@/lib/content/video-freeze'", "from '@/lib/content/video-freeze-lookalike'"),
      )
      expect(problems.some((p) => p.startsWith(point.file) && p.includes('(R1'))).toBe(true)
    })
  }

  it('fails when a file shadows the guard with its own no-op', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) => `${s}\nfunction videoFreezeRefusal(_: unknown): string | null { return null }\n`)
    expect(problems.join('\n')).toMatch(/declares its own `videoFreezeRefusal`/)
  })
})

describe('R2: the refusal runs before every write', () => {
  it('fails when produceStudioDraft stops refusing', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) => s.replace('  if (frozen) return { ok: false, error: frozen }\n', ''))
    expect(problems.join('\n')).toMatch(/produce\.ts: `produceStudioDraft` never refuses/)
  })

  it('fails when produceStudioDraft refuses only after the row is opened', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) =>
      s
        .replace('  if (frozen) return { ok: false, error: frozen }\n', '')
        .replace(
          '    if (!pending.ok) return { ok: false, error: pending.error }\n',
          '    if (!pending.ok) return { ok: false, error: pending.error }\n    if (frozen) return { ok: false, error: frozen }\n',
        ),
    )
    expect(problems.join('\n')).toMatch(/produce\.ts:\d+: `adapters\.insertPending\(\.\.\.\)` can run without/)
  })

  it('fails when the refusal is short-circuited', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) =>
      s.replace('  if (frozen) return { ok: false, error: frozen }\n', '  if (false && frozen) return { ok: false, error: frozen }\n'),
    )
    expect(problems.join('\n')).toMatch(/never refuses/)
  })

  it('fails when the guard answer is neutered at its source', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) =>
      s.replace('const frozen = videoFreezeRefusal(', 'const frozen = null && videoFreezeRefusal('),
    )
    expect(problems.join('\n')).toMatch(/never refuses/)
  })

  it('fails when the Imagine listing clip stops refusing', () => {
    const rel = fileOf('lib/social/imagine-produce.ts')
    const problems = runWith(rel, (s) => s.replace('  if (frozen) return { ok: false, error: frozen }\n', ''))
    expect(problems.join('\n')).toMatch(/imagine-produce\.ts: `produceListing` never refuses/)
  })

  it('fails when approveStudioDraft stops refusing', () => {
    const rel = fileOf('lib/data/studio/drafts.ts')
    const problems = runWith(rel, (s) => s.replace('    if (frozen) return { ok: false, error: frozen }\n', ''))
    expect(problems.join('\n')).toMatch(/drafts\.ts: `approveStudioDraft` never refuses/)
  })

  it('fails when approveAction stops refusing', () => {
    const rel = fileOf('lib/data/agent/actions.ts')
    const problems = runWith(rel, (s) =>
      s.replace("    if (frozen) return { ok: false, error: frozen, reason: 'video_frozen' }\n", ''),
    )
    expect(problems.join('\n')).toMatch(/actions\.ts: `approveAction` never refuses/)
  })

  it('fails when only approve_schedule loses its refusal in the approval-queue route', () => {
    const rel = fileOf('[id]/action/route.ts')
    const problems = runWith(rel, (s) =>
      replaceNth(s, '        if (frozen) return NextResponse.json({ error: frozen }, { status: 423 })\n', '', 2),
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/\[id\]\/action\/route\.ts:\d+: .*can run without the `rowVideoFreezeRefusal` refusal/)
  })

  it('fails when publisher-sweep holds a video row but keeps going', () => {
    const rel = fileOf('publisher-sweep')
    const problems = runWith(rel, (s) =>
      s.replace(
        '      videoFrozen.push({ action_id: row.id, action_type: row.action_type, reason: frozenReason })\n      continue\n',
        '      videoFrozen.push({ action_id: row.id, action_type: row.action_type, reason: frozenReason })\n',
      ),
    )
    expect(problems.join('\n')).toMatch(/publisher-sweep\/route\.ts: `GET` never refuses/)
  })

  it('fails when the publish route checks after the fan-out', () => {
    const rel = fileOf('social/publish')
    const problems = runWith(rel, (s) => s.replace('    if (frozen) {\n', '    if (false && frozen) {\n'))
    expect(problems.join('\n')).toMatch(/social\/publish\/route\.ts: `POST` never refuses/)
  })
})

describe('R3: the publish route answers 423 Locked', () => {
  it('fails on any other status', () => {
    const rel = fileOf('social/publish')
    const problems = runWith(rel, (s) =>
      s.replace('return NextResponse.json({ error: frozen }, { status: 423 })', 'return NextResponse.json({ error: frozen }, { status: 400 })'),
    )
    expect(problems).toEqual([`${rel}: the video refusal does not answer 423 Locked (R3).`])
  })
})

describe('R4: bulk approve writes only ids that passed the freeze', () => {
  it('fails when bulk approve writes the raw selection', () => {
    const rel = fileOf('bulk-action')
    const problems = runWith(rel, (s) => s.replace(".in('id', approvableIds)", ".in('id', ids)"))
    expect(problems.join('\n')).toMatch(/bulk-action\/route\.ts:\d+: bulk approve writes ids that did not come out of splitVideoFrozen/)
  })
})

describe('a moved choke point is a failure, not a silent pass', () => {
  it('fails when a choke-point file disappears', () => {
    const rel = fileOf('publisher-sweep')
    const problems = checkVideoFreeze((path) => (path === rel ? null : real(path)))
    expect(problems.join('\n')).toMatch(/publisher-sweep\/route\.ts: missing/)
  })

  it('fails when the guarded function is renamed', () => {
    const rel = fileOf('lib/data/studio/drafts.ts')
    const problems = runWith(rel, (s) => s.replace('export async function approveStudioDraft(', 'export async function approveDraft('))
    expect(problems.join('\n')).toMatch(/no function `approveStudioDraft`/)
  })
})
