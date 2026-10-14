import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  currentHeadingLines,
  extractCurrentBlock,
  handoffCurrentProblems,
} from '../lib/handoff-current.mjs'
import { newestNotes, noteFileName, noteProblems } from '../lib/handoff-notes.mjs'

const ONE = [
  '# Current — 2026-09-23 (one block)',
  '',
  'Surface: test. Node: none.',
  '',
  '## Open Matt directives',
  '- SITE-1 open',
  '',
  '# Prior',
  '',
  'Archive pointer.',
].join('\n')

describe('handoff one-block rule (PROCESS-8)', () => {
  it('passes a file with exactly one # Current block', () => {
    expect(handoffCurrentProblems(ONE)).toEqual([])
    expect(currentHeadingLines(ONE)).toEqual([1])
  })

  it('refuses a stacked second # Current block and names both lines', () => {
    const stacked = `# Current — newer\n\nnew\n\n${ONE}`
    const p = handoffCurrentProblems(stacked)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/2 "# Current" blocks \(lines 1, 5\)/)
    expect(p[0]).toMatch(/replace the block/)
  })

  it('refuses a file with no # Current block', () => {
    expect(handoffCurrentProblems('# Prior\n\nold')[0]).toMatch(/no "# Current" block/)
  })

  it('does not count a ## Current subheading or prose that mentions # Current', () => {
    const text = `${ONE}\n\n## Current lanes\n\nThe old "# Current" stack was the problem.`
    expect(handoffCurrentProblems(text)).toEqual([])
  })

  it('extracts the whole block, subsections included, and stops at the next top-level heading', () => {
    const block = extractCurrentBlock(ONE)
    expect(block.startsWith('# Current')).toBe(true)
    expect(block).toMatch(/## Open Matt directives/)
    expect(block).toMatch(/SITE-1 open/)
    expect(block).not.toMatch(/# Prior/)
  })

  it('reads through a fenced code block: a # comment inside it neither ends the block nor counts', () => {
    const fenced = [
      '# Current — 2026-09-23 (fenced)',
      '',
      '```bash',
      '# Current — this is a shell comment, not a second block',
      '# run the brief',
      'npx tsx scripts/loop-brief.ts',
      '```',
      '',
      '- SITE-2 still open after the fence',
      '',
      '# Prior',
    ].join('\n')
    expect(handoffCurrentProblems(fenced)).toEqual([])
    const block = extractCurrentBlock(fenced)
    expect(block).toMatch(/SITE-2 still open after the fence/)
    expect(block).not.toMatch(/# Prior/)
  })

  it('the live handoff passes the gate', () => {
    const r = spawnSync('node', ['scripts/check-handoff-current.mjs'], { encoding: 'utf8' })
    expect(r.status, r.stdout + r.stderr).toBe(0)
  })
})

describe('one handoff note per session (Matt 2026-10-14)', () => {
  function repo({ frozen = '# Cross-agent handoff (frozen)\n\n## Earlier — x\n', notes = {} } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'handoff-notes-'))
    mkdirSync(join(root, 'docs/plans/handoffs'), { recursive: true })
    writeFileSync(join(root, 'docs/plans/CROSS_AGENT_HANDOFF.md'), frozen)
    writeFileSync(join(root, 'docs/plans/handoffs/README.md'), '# Handoff notes\n')
    for (const [n, t] of Object.entries(notes)) writeFileSync(join(root, 'docs/plans/handoffs', n), t)
    return root
  }
  const gate = (root) => spawnSync('node', ['scripts/check-handoff-current.mjs', root], { encoding: 'utf8' })

  it('passes well-formed notes and a frozen file', () => {
    const r = gate(repo({ notes: { '2026-10-14T0455Z-claude-x.md': '# 2026-10-14 (Claude, x)\n\nDone.\n' } }))
    expect(r.status, r.stdout + r.stderr).toBe(0)
  })

  it('fails a Current block written back into the frozen file, and says where to write', () => {
    const r = gate(repo({ frozen: '# Current — 2026-10-14 (bot)\n\nx\n' }))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/is frozen/)
    expect(r.stderr).toMatch(/docs\/plans\/handoffs\//)
  })

  it('fails a misnamed note, a note with no title, and an overlong note', () => {
    expect(noteProblems('notes.md', '# t\n')[0]).toMatch(/name must be/)
    expect(noteProblems('2026-10-14T0455Z-x.md', 'no title\n')[0]).toMatch(/"# " title/)
    expect(noteProblems('2026-10-14T0455Z-x.md', '# t\n' + 'l\n'.repeat(70))[0]).toMatch(/at most 60/)
    expect(noteProblems('2026-10-14T0455Z-x.md', '# Current — x\n')[0]).toMatch(/no "# Current"/)
  })

  it('names a note by UTC minute and branch, and orders newest first', () => {
    expect(noteFileName(new Date('2026-10-14T04:55:09Z'), 'claude/Blissful Franklin')).toBe('2026-10-14T0455Z-claude-blissful-franklin.md')
    expect(newestNotes(['README.md', '2026-10-13T2300Z-a.md', '2026-10-14T0100Z-b.md', '2026-10-14T0050Z-c.md'], 2)).toEqual([
      '2026-10-14T0100Z-b.md',
      '2026-10-14T0050Z-c.md',
    ])
  })
})
