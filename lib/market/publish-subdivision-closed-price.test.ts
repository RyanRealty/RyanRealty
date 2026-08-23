import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { publishSubdivisionClosedPrice } from './publish-subdivision-closed-price'

describe('publishSubdivisionClosedPrice', () => {
  it('withholds every closed-sale price at subdivision grain, including a thick year', () => {
    expect(publishSubdivisionClosedPrice(1_075_500)).toBeNull()
    expect(publishSubdivisionClosedPrice(317_000)).toBeNull()
    expect(publishSubdivisionClosedPrice(0)).toBeNull()
    expect(publishSubdivisionClosedPrice(null)).toBeNull()
  })

  it('plat history and FAQ-adjacent figures go through the helper', () => {
    const history = readFileSync(
      resolve('app/subdivisions/[slug]/SubdivisionSalesHistory.tsx'),
      'utf8',
    )
    const figures = readFileSync(
      resolve('app/subdivisions/[slug]/_v3/subdivision-figures.ts'),
      'utf8',
    )
    expect(history).toMatch(/publishSubdivisionClosedPrice/)
    expect(history).not.toMatch(/Median close price/)
    expect(figures).toMatch(/publishSubdivisionClosedPrice/)
    expect(figures).not.toMatch(/median sale price/)
  })
})
