import { describe, expect, it } from 'vitest'
import {
  productHoldProblems,
  requiredComponentsHoldProblems,
} from '../lib/taste-receipt.mjs'

const prior = {
  evaluatedAt: '2026-09-08',
  score: 75,
  criteria: { designQuality: 20, originality: 18, interaction: 10, craft: 12, honestyFunction: 8 },
}

describe('productHoldProblems — honesty cannot fall or be omitted', () => {
  it('is silent when neither mark recorded honesty', () => {
    expect(productHoldProblems({ score: 82 }, { score: 75 })).toEqual([])
  })

  it('is silent when honesty holds or rises', () => {
    expect(
      productHoldProblems({ criteria: { honestyFunction: 8 } }, prior),
    ).toEqual([])
    expect(
      productHoldProblems({ criteria: { honestyFunction: 9 } }, prior),
    ).toEqual([])
    expect(
      productHoldProblems({ perCriterion: { honesty: 8 } }, prior),
    ).toEqual([])
  })

  it('fails when honesty falls', () => {
    const p = productHoldProblems({ criteria: { honestyFunction: 3 } }, prior)
    expect(p.join('\n')).toMatch(/honestyFunction 3 fell below the prior mark 8/)
  })

  it('fails when honesty is omitted after the prior recorded it', () => {
    const p = productHoldProblems({ score: 82 }, prior)
    expect(p.join('\n')).toMatch(/honestyFunction omitted while the prior mark recorded 8/)
  })
})

describe('requiredComponentsHoldProblems — sections, JSON-LD, asks cannot drop', () => {
  it('is silent when HEAD had no contract', () => {
    expect(requiredComponentsHoldProblems([{ name: 'V3Stage' }], [])).toEqual([])
    expect(requiredComponentsHoldProblems([], null)).toEqual([])
  })

  it('fails when the list shrinks', () => {
    const p = requiredComponentsHoldProblems(
      [{ name: 'V3Ask' }, { name: 'V3Stage' }],
      [{ name: 'MetadataBlock' }, { name: 'V3Ask' }, { name: 'V3Stage' }],
    )
    expect(p.join('\n')).toMatch(/requiredComponents shrank 3 → 2/)
  })

  it('fails when JSON-LD is swapped out at the same count', () => {
    const p = requiredComponentsHoldProblems(
      [{ name: 'V3Quiet' }, { name: 'V3Ask' }, { name: 'V3Stage' }],
      [{ name: 'MetadataBlock' }, { name: 'V3Ask' }, { name: 'V3Stage' }],
    )
    expect(p.join('\n')).toMatch(/JSON-LD dropped from requiredComponents/)
    expect(p.join('\n')).not.toMatch(/shrank/)
  })

  it('fails when the conversion ask is swapped out at the same count', () => {
    const p = requiredComponentsHoldProblems(
      [{ name: 'MetadataBlock' }, { name: 'V3Quiet' }, { name: 'V3Stage' }],
      [{ name: 'MetadataBlock' }, { name: 'BuyAlertsSheet' }, { name: 'V3Stage' }],
    )
    expect(p.join('\n')).toMatch(/conversion ask dropped from requiredComponents/)
  })

  it('accepts renaming ContactAsk → V3Ask and growing the list', () => {
    expect(
      requiredComponentsHoldProblems(
        [{ name: 'V3Ask' }, { name: 'MetadataBlock' }, { name: 'V3Stage' }],
        [{ name: 'ContactAsk' }, { name: 'MetadataBlock' }],
      ),
    ).toEqual([])
  })
})
