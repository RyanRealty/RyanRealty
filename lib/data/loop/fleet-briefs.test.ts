import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const briefs = readFileSync(new URL('./fleet-briefs.ts', import.meta.url), 'utf8')
const packs = readFileSync(new URL('./fleet-cases.ts', import.meta.url), 'utf8')

describe('fleet briefs (R-217 full site review)', () => {
  it('walkers name SITE REVIEW and do not end on token match', () => {
    expect(briefs).toMatch(/SITE REVIEW/)
    expect(briefs).toMatch(/does not end this run/)
    expect(briefs).toMatch(/walker-mobile[\s\S]*SITE REVIEW/)
    expect(briefs).toMatch(/walker-desktop[\s\S]*SITE REVIEW/)
  })

  it('keeps Flow Prover on submits and allows that bot alone to END', () => {
    expect(briefs).toMatch(/flow-prover[\s\S]*You do NOT do SITE REVIEW/)
    expect(briefs).toMatch(/FLOW_TOKEN_PROTOCOL[\s\S]*and END/)
  })

  it('serves the extra site-review lanes Matt already stood up', () => {
    for (const bot of [
      'content-blog',
      'geo-cities',
      'geo-places',
      'geo-subdivisions',
      'listings-bend',
      'page-core',
      'chrome-nav',
    ]) {
      expect(briefs).toContain(`'${bot}'`)
    }
  })

  it('pack header no longer tells every bot to end the run', () => {
    expect(packs).not.toMatch(/END this run now/)
    expect(packs).toMatch(/continue the rest of the job your live brief names/)
  })
})
