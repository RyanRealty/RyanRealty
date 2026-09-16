import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('community-catalog SITE-94', () => {
  it('imports the installed beui-number source', () => {
    const src = readFileSync(new URL('./community-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/number['"]/)
  })

  it('SITE-116 imports the installed beautifului InsightCards source', () => {
    const src = readFileSync(new URL('./community-catalog.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/from ['"]@\/components\/motion\/insight-cards['"]/)
  })
})
