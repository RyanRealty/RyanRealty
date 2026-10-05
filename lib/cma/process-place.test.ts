import { describe, expect, it } from 'vitest'
import {
  cmaProcessPlace,
  cmaQueueSendBanner,
  cmaQueueSendNote,
  cmaSentPageLine,
  type CmaProcessInput,
} from '@/lib/cma/process-place'

function input(over: Partial<CmaProcessInput> = {}): CmaProcessInput {
  return {
    building: false,
    buildFailed: false,
    held: false,
    inDrip: false,
    sent: false,
    countedSent: false,
    hasDocument: true,
    hasEmail: true,
    sendMode: 'drip',
    origin: 'expired',
    ...over,
  }
}

describe('cmaProcessPlace', () => {
  it('tells an expired letter that Schedule does not email', () => {
    const place = cmaProcessPlace(input())
    expect(place.where).toBe('Ready, not sent')
    expect(place.next).toContain('do not email while it is stopped')
    expect(place.next).toContain('Send now emails this one immediately')
  })

  it('tells an FSBO letter that the weekday drip does email', () => {
    const place = cmaProcessPlace(input({ origin: 'fsbo' }))
    expect(place.next).toContain('emails on weekdays')
    expect(place.next).not.toContain('do not email')
  })

  it('keeps an asked-for letter on Send now', () => {
    const place = cmaProcessPlace(input({ origin: 'seller-valuation', sendMode: 'now' }))
    expect(place.next).toBe('Send now emails this one immediately. Nothing sends until you press it.')
  })

  it('names a send that left, and a list mark that did not', () => {
    expect(cmaProcessPlace(input({ sent: true })).where).toBe('Sent')
    expect(cmaProcessPlace(input({ countedSent: true })).where).toBe('Counted as sent')
    expect(cmaProcessPlace(input({ countedSent: true })).next).toContain('opens are not tied')
  })

  it('stops a missing letter before any send talk', () => {
    expect(cmaProcessPlace(input({ hasDocument: false, buildFailed: true })).where).toBe('Build failed')
    expect(cmaProcessPlace(input({ building: true, hasDocument: false })).where).toBe('Building')
    expect(cmaProcessPlace(input({ building: true, hasDocument: false })).next).toContain('Nothing sends')
  })
})

describe('cmaQueueSendNote', () => {
  it('marks the row, and says the full rule once for the page', () => {
    expect(cmaQueueSendNote('ready', 'expired')).toBe('Drip stopped')
    expect(cmaQueueSendNote('queued', 'expired')).toBe('Drip stopped')
    expect(cmaQueueSendNote('ready', 'fsbo')).toBe('Weekday email')
    expect(cmaQueueSendNote('queued', 'fsbo')).toBeNull()
    expect(cmaQueueSendNote('sent', 'expired')).toBeNull()
    expect(cmaQueueSendBanner([{ state: 'ready', origin: 'expired' }])).toContain('does not email')
    expect(
      cmaQueueSendBanner([
        { state: 'ready', origin: 'expired' },
        { state: 'ready', origin: 'fsbo' },
      ]),
    ).toContain('FSBO')
    expect(cmaQueueSendBanner([{ state: 'sent', origin: 'expired' }])).toBeNull()
  })
})

describe('cmaSentPageLine', () => {
  it('counts the page the broker is looking at', () => {
    expect(cmaSentPageLine({ shown: 0, opened: 0, clicked: 0, replied: 0, bad: 0 })).toBeNull()
    expect(cmaSentPageLine({ shown: 21, opened: 11, clicked: 4, replied: 1, bad: 0 })).toBe(
      '21 on this page. 11 opened. 4 clicked. 1 replied.',
    )
    expect(cmaSentPageLine({ shown: 3, opened: 1, clicked: 0, replied: 0, bad: 1 })).toContain(
      '1 bounced or unsubscribed.',
    )
  })
})
