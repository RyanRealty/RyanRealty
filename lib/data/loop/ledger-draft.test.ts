import { describe, it, expect } from 'vitest'
import { assertLedgerDraft } from './ledger-draft'

describe('assertLedgerDraft', () => {
  const ok = {
    domain: 'recruit-retain',
    changeClass: 'day-one-own-book',
    surface: '/join',
    description: 'New broker sees only their book on Today',
    metric: 'time_to_first_useful_day',
  }

  it('accepts a non-SEO domain so the ledger can score company work', () => {
    expect(() => assertLedgerDraft(ok)).not.toThrow()
  })

  it('refuses a Growth-era domain alias that is not in the closed set', () => {
    expect(() => assertLedgerDraft({ ...ok, domain: 'growth' })).toThrow(/unknown company domain/i)
  })

  it('refuses a blank change class — confidence is learned per class', () => {
    expect(() => assertLedgerDraft({ ...ok, changeClass: '  ' })).toThrow(/changeClass/i)
  })
})
