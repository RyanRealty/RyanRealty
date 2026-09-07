import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('ProspectDetailHardLink', () => {
  it('forces document navigation on primary click', () => {
    const src = readFileSync(join(__dirname, 'ProspectDetailHardLink.client.tsx'), 'utf8')
    expect(src).toMatch(/window\.location\.assign\(href\)/)
    expect(src).toMatch(/preventDefault/)
    expect(src).toMatch(/metaKey/)
  })
})
