import { describe, expect, it } from 'vitest'
import { listingsFeedCopy } from './listings-empty'

describe('listingsFeedCopy', () => {
  it('does not call a query error an empty feed', () => {
    const copy = listingsFeedCopy({ error: 'timeout', total: 0, hasFilters: false })
    expect(copy.headline).toMatch(/could not be read/i)
    expect(copy.body).toMatch(/not an empty feed/i)
  })

  it('keeps a true empty filter result', () => {
    const copy = listingsFeedCopy({ error: null, total: 0, hasFilters: true })
    expect(copy.headline).toMatch(/no listings match/i)
  })

  it('keeps a true empty default view', () => {
    const copy = listingsFeedCopy({ error: null, total: 0, hasFilters: false })
    expect(copy.headline).toMatch(/no listings in this view/i)
    expect(copy.body).not.toMatch(/not an empty feed/i)
  })
})
