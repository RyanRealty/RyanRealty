import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = readFileSync('app/api/cron/snapshot-channels/route.ts', 'utf8')

describe('snapshot-channels parked platforms', () => {
  it('does not fan out to LinkedIn or Google Ads until OAuth exists', () => {
    expect(src).not.toMatch(/'linkedin'/)
    expect(src).not.toMatch(/'google-ads'/)
    expect(src).toMatch(/endpoint: 'snapshot-channels'/)
  })
})
