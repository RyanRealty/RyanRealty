import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/FindMeVoice.client.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')

describe('FindMeVoice', () => {
  it('is mounted in the public chrome on every page', () => {
    expect(CHROME).toContain('<FindMeVoice')
  })

  it('opens a listening stage and sends speech through searchHrefForQuery', () => {
    expect(SRC).toContain('searchHrefForQuery')
    expect(SRC).toContain('Find me a home')
    expect(SRC).toContain('v3-findme-stage')
    expect(SRC).not.toContain('/homes-for-sale/bend?')
  })
})
