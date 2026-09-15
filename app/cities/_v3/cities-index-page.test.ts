import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/cities/page.tsx'), 'utf8')

describe('cities index SITE-92', () => {
  it('keeps required sections and installs catalog surfaces', () => {
    expect(PAGE).toMatch(/<V3Ledger/)
    expect(PAGE).toMatch(/<V3Quiet/)
    expect(PAGE).toMatch(/<RegionalAlertSheet/)
    expect(PAGE).toMatch(/<V3Atlas/)
    expect(PAGE).toMatch(/<CitiesInsight/)
    expect(PAGE).toMatch(/<CitiesAlertStrip/)
    expect(PAGE).toMatch(/<V3Number/)
    expect(PAGE).toMatch(/<V3MosCompare/)
    expect(PAGE).toContain("from '@/lib/data'")
  })
})
