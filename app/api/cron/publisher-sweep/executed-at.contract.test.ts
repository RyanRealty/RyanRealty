import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sweep = readFileSync('app/api/cron/publisher-sweep/route.ts', 'utf8')
const loop = readFileSync('lib/marketing-brain/measurement-loop.ts', 'utf8')

describe('publisher-sweep stamps executed_at so measurement can find the row', () => {
  it('writes executed_at on the approved→executed UPDATE', () => {
    expect(sweep).toMatch(/executed_at:\s*publishedAt/)
    expect(sweep).toMatch(/published_at:\s*publishedAt/)
    expect(sweep).toMatch(/published_to:/)
  })

  it('measurement digest persists even when nothing succeeded this run', () => {
    expect(loop).not.toMatch(/measurements_succeeded > 0/)
    expect(loop).toMatch(/persistLoopDigest\(report\)/)
  })
})
