import { describe, expect, it } from 'vitest'
import { isReceptionistLine, parseReferTarget } from './receptionist-routing'

describe('receptionist routing', () => {
  it('defaults to the spare line only', () => {
    expect(isReceptionistLine('+15412245025')).toBe(true)
    expect(isReceptionistLine('+15417033095')).toBe(false)
  })
  it('allowlists REFER targets', () => {
    expect(parseReferTarget('<tel:+15412503380>', ['+15412503380'])).toBe('+15412503380')
    expect(parseReferTarget('tel:+19995550000', ['+15412503380'])).toBeNull()
    expect(parseReferTarget('', ['+15412503380'])).toBeNull()
  })
})
