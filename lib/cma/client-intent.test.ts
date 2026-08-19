import { describe, expect, it } from 'vitest'
import {
  applyCmaClientIntent,
  cmaClientIntentLabel,
  isCmaClientIntent,
  parseCmaClientIntent,
} from './client-intent'

describe('CMA client intent', () => {
  it('parses an Intent line and ignores other notes', () => {
    expect(parseCmaClientIntent('Intent: sell\nDraft. Seller CMA. Not sent.')).toBe('sell')
    expect(parseCmaClientIntent('Intent: rent')).toBe('rent')
    expect(parseCmaClientIntent('Intent: both')).toBe('both')
    expect(parseCmaClientIntent('Draft. Seller CMA. Not sent.')).toBeNull()
    expect(isCmaClientIntent('sell')).toBe(true)
    expect(isCmaClientIntent('hold')).toBe(false)
  })

  it('writes Intent first and replaces a prior line', () => {
    expect(applyCmaClientIntent(null, 'sell')).toBe('Intent: sell')
    expect(applyCmaClientIntent('Draft. Seller CMA. Not sent.', 'rent')).toBe(
      'Intent: rent\nDraft. Seller CMA. Not sent.',
    )
    expect(applyCmaClientIntent('Intent: sell\nDraft. Seller CMA. Not sent.', 'both')).toBe(
      'Intent: both\nDraft. Seller CMA. Not sent.',
    )
    expect(applyCmaClientIntent('Intent: sell\nDraft. Seller CMA. Not sent.', null)).toBe(
      'Draft. Seller CMA. Not sent.',
    )
  })

  it('labels rent-or-sell as Rent or sell', () => {
    expect(cmaClientIntentLabel('both')).toBe('Rent or sell')
    expect(cmaClientIntentLabel('sell')).toBe('Sell')
    expect(cmaClientIntentLabel('rent')).toBe('Rent')
  })
})
