import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { checkTipReadyLandPath, TIP_READY_LAND_PATHS } from '../lib/process-canon-audit-arm.mjs'

describe('checkTipReadyLandPath — nobody labels Tip Ready without --ship', () => {
  it('refuses a land-path file that never names --ship or RUN_LOOP.md', () => {
    const p = checkTipReadyLandPath([
      {
        path: 'scripts/site-queue-routine-prompt.md',
        content: 'Run the queue. House paint is fine. Tip Ready after a score rise.',
      },
    ])
    expect(p.join('\n')).toMatch(/taste-receipt\.mjs --ship/)
    expect(p.join('\n')).toMatch(/docs\/RUN_LOOP\.md/)
  })

  it('does not ask RUN_LOOP.md to point at itself', () => {
    const p = checkTipReadyLandPath([
      { path: 'docs/RUN_LOOP.md', content: 'Tip Ready is `node scripts/lib/taste-receipt.mjs --ship <parity.json>` exit 0.' },
    ])
    expect(p).toEqual([])
  })

  it('no longer requires the retired demoMatch FORBIDDEN phrase (Matt 2026-09-23)', () => {
    const p = checkTipReadyLandPath([
      {
        path: '.cursor/skills/site-queue/SKILL.md',
        content: 'Read docs/RUN_LOOP.md. Tip Ready is `node scripts/lib/taste-receipt.mjs --ship <parity.json>` exit 0.',
      },
    ])
    expect(p).toEqual([])
  })

  it('passes the live land-path documents', () => {
    const files = TIP_READY_LAND_PATHS.map((path) => ({
      path,
      content: readFileSync(path, 'utf8'),
    }))
    expect(checkTipReadyLandPath(files)).toEqual([])
  })
})
