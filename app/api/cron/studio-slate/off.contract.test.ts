import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync('app/api/cron/studio-slate/route.ts', 'utf8')
const vercel = readFileSync('vercel.json', 'utf8')

describe('studio slate is off the clock', () => {
  it('is not a Vercel cron', () => {
    expect(vercel).not.toMatch(/studio-slate/)
  })

  it('refuses to produce unless STUDIO_SLATE_ENABLED is on, even if the route is hit', () => {
    const get = route.slice(route.indexOf('export async function GET'))
    expect(get).toMatch(/if \(!isStudioSlateEnabled\(\)\)/)
    expect(get).toMatch(/Studio slate is off/)
    expect(get.indexOf('isStudioSlateEnabled()')).toBeLessThan(get.indexOf('produceStudioDraft'))
  })
})
