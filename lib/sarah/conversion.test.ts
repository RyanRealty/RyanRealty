import { describe, expect, it } from 'vitest'
import {
  EMPTY_CONVERSION,
  bookingPendingAsk,
  hasPressureLanguage,
  markAsked,
  markDeclined,
  nextConversionOffer,
  showingAsk,
} from './conversion'
import { BOOKING_PENDING_EN, LIGHTER_FOLLOW_UP_EN, SHOWING_ASK_EN } from './scripts'

describe('conversion flow', () => {
  it('asks the showing question once, then a lighter step if declined', () => {
    expect(nextConversionOffer(EMPTY_CONVERSION, 'showing', 'en')).toBe(SHOWING_ASK_EN)
    const asked = markAsked(EMPTY_CONVERSION, 'showing')
    expect(nextConversionOffer(asked, 'showing', 'en')).toBeNull()
    const declined = markDeclined(asked, 'showing')
    expect(nextConversionOffer(declined, 'showing', 'en')).toBe(LIGHTER_FOLLOW_UP_EN)
  })

  it('does not auto-book: pending times only', () => {
    expect(bookingPendingAsk('en')).toBe(BOOKING_PENDING_EN)
    expect(bookingPendingAsk('en')).toMatch(/Matt will confirm/)
    expect(bookingPendingAsk('en')).not.toMatch(/I (have )?booked|on the calendar/i)
  })

  it('rejects pressure language', () => {
    expect(hasPressureLanguage('Want me to set up a time to see it?')).toBe(false)
    expect(hasPressureLanguage('Act now, this will not last.')).toBe(true)
  })

  it('keeps the inbound showing ask simple', () => {
    expect(showingAsk('en')).toBe(SHOWING_ASK_EN)
  })
})
