import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/lp/bend/page.tsx'), 'utf8')

describe('lp/bend folds into the Bend city page', () => {
  it('is redirect-only onto /cities/bend', () => {
    expect(SRC).toMatch(/permanentRedirect\('\/cities\/bend'\)/)
    expect(SRC).toMatch(/Never renders UI/)
    expect(SRC).not.toMatch(/getPublicDetachedPace/)
  })
})
