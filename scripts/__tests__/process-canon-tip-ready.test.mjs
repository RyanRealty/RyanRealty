import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { checkTipReadyLandPath, TIP_READY_LAND_PATHS } from '../lib/process-canon-audit-arm.mjs'

describe('checkTipReadyLandPath — Cos may not label Tip Ready without --ship', () => {
  it('refuses a land-path file that never names --ship', () => {
    const p = checkTipReadyLandPath([
      {
        path: 'scripts/site-queue-routine-prompt.md',
        content: 'Run the queue. House paint is fine. Tip Ready after a score rise.',
      },
    ])
    expect(p.join('\n')).toMatch(/taste-receipt\.mjs --ship/)
    expect(p.join('\n')).toMatch(/FORBIDDEN/)
  })

  it('passes the live site-queue skill and routine prompt', () => {
    const files = TIP_READY_LAND_PATHS.map((path) => ({
      path,
      content: readFileSync(path, 'utf8'),
    }))
    expect(checkTipReadyLandPath(files)).toEqual([])
  })
})
