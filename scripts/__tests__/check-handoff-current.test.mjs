import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  currentHeadingLines,
  extractCurrentBlock,
  handoffCurrentProblems,
} from '../lib/handoff-current.mjs'

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

  it('the gate exits 1 on a stacked file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'handoff-current-'))
    const f = join(dir, 'HANDOFF.md')
    writeFileSync(f, `# Current — a\n\nx\n\n# Current — b\n\ny\n`)
    const r = spawnSync('node', ['scripts/check-handoff-current.mjs', f], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/2 "# Current" blocks/)
  })
})
