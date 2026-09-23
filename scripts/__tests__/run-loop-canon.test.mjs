import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { RUN_LOOP_DOC, RUN_LOOP_POINTERS, runLoopProblems } from '../lib/run-loop-canon.mjs'

const DOC = { path: RUN_LOOP_DOC, content: '# Run the loop\n\nClaim with the tool.\n' }
const pointer = (path, content) => ({ path, content })

describe('run-the-loop canon (PROCESS-5/6)', () => {
  it('passes the live boot page and every live pointer', () => {
    const files = [RUN_LOOP_DOC, ...RUN_LOOP_POINTERS].map((p) => ({
      path: p,
      content: existsSync(p) ? readFileSync(p, 'utf8') : null,
    }))
    expect(runLoopProblems(files)).toEqual([])
  })

  it('refuses a missing boot page', () => {
    expect(runLoopProblems([{ path: RUN_LOOP_DOC, content: null }]).join('\n')).toMatch(/RUN_LOOP\.md is missing/)
  })

  it('refuses a boot page over 150 lines', () => {
    const long = { path: RUN_LOOP_DOC, content: Array.from({ length: 151 }, (_, i) => `line ${i}`).join('\n') }
    expect(runLoopProblems([long]).join('\n')).toMatch(/151 lines, over its 150-line cap/)
  })

  it('refuses a pointer file that does not link RUN_LOOP.md', () => {
    const p = runLoopProblems([DOC, pointer('AGENTS.md', 'Run the site queue skill.')])
    expect(p.join('\n')).toMatch(/AGENTS\.md does not point at docs\/RUN_LOOP\.md/)
  })

  it.each([
    ['worker cap', 'See docs/RUN_LOOP.md. If liveWorkers is at or above `maxWorkers` (3), stop.'],
    ['worker cap', 'See docs/RUN_LOOP.md. Three live workers, two claims each.'],
    ['rise floor', 'See docs/RUN_LOOP.md. The score must rise BY AT LEAST 6.'],
    ['rise floor', 'See docs/RUN_LOOP.md. Rise by the rise floor, 3 on grok-4.6.'],
    ['cadence', 'See docs/RUN_LOOP.md. An hourly Claude cloud routine also works this queue.'],
    ['claim command', 'See docs/RUN_LOOP.md. npx tsx scripts/site-queue-status.ts --claim SITE-02 --owner x'],
    ['land path', 'See docs/RUN_LOOP.md. PR only — Cos Mini lands.'],
  ])('refuses a pointer that restates the %s', (id, content) => {
    const p = runLoopProblems([DOC, pointer('.cursor/rules/run-loop.mdc', content)])
    expect(p.join('\n')).toContain(`restates the ${id}`)
  })

  it('lets the boot page itself carry the claim command', () => {
    const doc = { path: RUN_LOOP_DOC, content: 'npx tsx scripts/site-queue-status.ts --claim SITE-XX --owner me\n' }
    expect(runLoopProblems([doc])).toEqual([])
  })
})
