import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

/**
 * Break-tests for ci:learnings-canon (scripts/check-learnings-canon.mjs, G71).
 *
 * Every rule must be able to FAIL and every safe shape must stay green. Each case
 * copies the real files the gate inspects into a sandbox outside the repo, seeds
 * the ratchet from that copy, mutates exactly one thing, and asserts the exit
 * code names the rule. The first test proves the untouched copy passes, so any
 * failure below is the mutation and not the copy.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-learnings-gate-${process.pid}-${Math.random().toString(16).slice(2)}`)
const DOC = 'docs/LEARNINGS.md'
const FILES = ['scripts/check-learnings-canon.mjs', DOC, 'CLAUDE.md', 'AGENTS.md', 'docs/GROK_BOT_BRAIN.md']

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(join(SANDBOX, 'scripts'), { recursive: true })
  mkdirSync(join(SANDBOX, 'docs'), { recursive: true })
  for (const f of FILES) {
    mkdirSync(dirname(join(SANDBOX, f)), { recursive: true })
    cpSync(join(REPO, f), join(SANDBOX, f))
  }
  // Every gate script the doc points at must exist for L3; stub them.
  const doc = readFileSync(join(SANDBOX, DOC), 'utf8')
  for (const m of doc.matchAll(/check-[a-z0-9-]+\.mjs/g)) {
    const p = join(SANDBOX, 'scripts', m[0])
    if (!existsSync(p)) writeFileSync(p, '// stub for break-tests\n')
  }
  const seeded = run('--write-baseline')
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.stdout}${seeded.stderr}`)
}

function run(...extra) {
  const r = spawnSync(process.execPath, ['scripts/check-learnings-canon.mjs', ...extra], {
    cwd: SANDBOX,
    encoding: 'utf8',
  })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}

function appendEntry(entry) {
  const p = join(SANDBOX, DOC)
  const text = readFileSync(p, 'utf8')
  // Append under the last themed section so it parses as an ordinary entry.
  writeFileSync(p, text.trimEnd() + '\n' + entry + '\n')
}

const GOOD_ENTRY = `- **A new lesson with both pointers.** Something broke on 2026-09-02 and Matt caught it.
  → Lives in: prose only. Source: Claude Code session, 2026-09-02.`

describe('ci:learnings-canon (G71)', () => {
  beforeEach(reset)
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('passes on the untouched copy', () => {
    const r = run()
    expect(r.out).toContain('compounds in entries')
    expect(r.status).toBe(0)
  })

  it('stays green when a compliant entry is added (the file must be allowed to grow)', () => {
    appendEntry(GOOD_ENTRY)
    const r = run()
    expect(r.status).toBe(0)
  })

  it('L1 fails when CLAUDE.md drops the pointer', () => {
    const p = join(SANDBOX, 'CLAUDE.md')
    writeFileSync(p, readFileSync(p, 'utf8').split('docs/LEARNINGS.md').join('docs/OTHER.md'))
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L1 CLAUDE\.md no longer names/)
  })

  it('L1 fails when the Grok surface is missing entirely', () => {
    rmSync(join(SANDBOX, 'docs/GROK_BOT_BRAIN.md'))
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L1 docs\/GROK_BOT_BRAIN\.md is missing/)
  })

  it('L2 fails on an entry over the line cap', () => {
    const lines = ['- **A paragraph, not a lesson.** Line one of a story that goes on.']
    for (let i = 0; i < 10; i++) lines.push(`  continuation line ${i} of the same story.`)
    lines.push('  → Lives in: prose only. Source: Claude Code session, 2026-09-02.')
    appendEntry(lines.join('\n'))
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L2 .*runs 12 lines/)
  })

  it('L2 fails on an entry over the byte cap even within the line cap', () => {
    const fat = 'x'.repeat(150)
    const lines = ['- **Dense.** ' + fat]
    for (let i = 0; i < 5; i++) lines.push('  ' + fat)
    lines.push('  → Lives in: prose only. Source: Claude Code session, 2026-09-02.')
    appendEntry(lines.join('\n'))
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L2 .*bytes \(max 800\)/)
  })

  it('L3 fails when a gated entry keeps its whole war story', () => {
    const lines = ['- **Gated but long.** The incident, told at length.']
    for (let i = 0; i < 5; i++) lines.push(`  more incident detail ${i}.`)
    lines.push('  → Lives in: `check-dal-boundary.mjs`. Source: Claude Code session, 2026-09-02.')
    writeFileSync(join(SANDBOX, 'scripts/check-dal-boundary.mjs'), '// stub\n')
    appendEntry(lines.join('\n'))
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L3 .*enforced by check-dal-boundary\.mjs but still runs 7 lines/)
  })

  it('L3 fails when Lives-in names a gate that does not exist', () => {
    appendEntry(
      '- **Claims a gate nobody built.** It broke once.\n  → Lives in: `check-does-not-exist.mjs`. Source: Claude Code session, 2026-09-02.',
    )
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L3 .*check-does-not-exist\.mjs, which does not exist/)
  })

  it('L3 stays green when a gate name appears only in the incident text, not in Lives-in', () => {
    appendEntry(
      '- **Mentions a gate in passing.** The bug was found while writing `check-imaginary-thing.mjs`.\n  → Lives in: prose only. Source: Claude Code session, 2026-09-02.',
    )
    const r = run()
    expect(r.status).toBe(0)
  })

  it('L4 fails when a new entry has no Lives-in pointer', () => {
    appendEntry('- **No pointer.** It broke. Source: Claude Code session, 2026-09-02.')
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L4 .*lack a "→ Lives in:" pointer.*No pointer/)
  })

  it('L4 fails when a new entry has no Source line', () => {
    appendEntry('- **No source.** It broke.\n  → Lives in: prose only.')
    const r = run()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/L4 .*lack a "Source:" line.*No source/)
  })

  it('L4 --write-baseline refuses to grow the debt', () => {
    appendEntry('- **No pointer.** It broke. Source: Claude Code session, 2026-09-02.')
    const r = run('--write-baseline')
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/refusing to write a LARGER baseline/)
  })

  it('does not treat the entry template inside the code fence as an entry', () => {
    // The template line `- **Rule in imperative form.**` has no real Source; if the
    // parser counted it, the seeded baseline would already carry it and this
    // assertion on the JSON count would differ from the documented founding count.
    const r = spawnSync(process.execPath, ['scripts/check-learnings-canon.mjs', '--json'], { cwd: SANDBOX, encoding: 'utf8' })
    const parsed = JSON.parse(r.stdout)
    const doc = readFileSync(join(SANDBOX, DOC), 'utf8')
    const fenced = doc.split('```')[1]
    expect(fenced).toMatch(/- \*\*Rule in imperative form\.\*\*/)
    const realBullets = doc.split('```').filter((_, i) => i % 2 === 0).join('\n').match(/^- \*\*/gm).length
    expect(parsed.counts.entries).toBe(realBullets)
  })
})
