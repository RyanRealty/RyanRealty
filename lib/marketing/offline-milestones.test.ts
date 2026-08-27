import { describe, expect, it } from 'vitest'
import { conversionValue, milestoneForStage, withinUploadWindow } from './offline-milestones'

describe('milestoneForStage', () => {
  it('maps the seller pipeline', () => {
    expect(milestoneForStage('Listed')).toBe('listing_signed')
    expect(milestoneForStage('Pending')).toBe('under_contract')
    expect(milestoneForStage('Closed')).toBe('closed')
  })

  it('maps the buyer pipeline', () => {
    expect(milestoneForStage('Buyer Contract')).toBe('buyer_signed')
  })

  it('is case and whitespace insensitive — stage names are hand-entered', () => {
    expect(milestoneForStage('  cLoSeD ')).toBe('closed')
  })

  it('refuses Offer in both pipelines', () => {
    // An offer can be rejected the same day. Feeding Meta an outcome that
    // routinely evaporates teaches it to buy leads that make offers.
    expect(milestoneForStage('Offer')).toBeNull()
  })

  it('refuses the non-outcomes', () => {
    expect(milestoneForStage('Pre-Listing')).toBeNull()
    expect(milestoneForStage('Lost')).toBeNull()
    expect(milestoneForStage('Lost / Terminated')).toBeNull()
    expect(milestoneForStage(null)).toBeNull()
    expect(milestoneForStage('')).toBeNull()
    expect(milestoneForStage('something new someone typed')).toBeNull()
  })
})

describe('conversionValue — ROAS is return on OUR revenue', () => {
  it('sends the commission on a closing', () => {
    expect(conversionValue('closed', 14500)).toBe(14500)
  })

  it('sends NO value on the earlier milestones', () => {
    // Otherwise one deal's worth is counted three times as it moves down the
    // pipeline, and Meta reads a single closing as triple revenue.
    expect(conversionValue('listing_signed', 14500)).toBeNull()
    expect(conversionValue('buyer_signed', 14500)).toBeNull()
    expect(conversionValue('under_contract', 14500)).toBeNull()
  })

  it('omits the value rather than sending 0 when commission is unknown', () => {
    expect(conversionValue('closed', null)).toBeNull()
    expect(conversionValue('closed', undefined)).toBeNull()
    expect(conversionValue('closed', 0)).toBeNull()
    expect(conversionValue('closed', -5)).toBeNull()
    expect(conversionValue('closed', Number.NaN)).toBeNull()
  })
})

describe('withinUploadWindow — Meta rejects a stale event_time', () => {
  const now = new Date('2026-08-26T12:00:00Z')

  it('accepts a milestone from today', () => {
    expect(withinUploadWindow(new Date('2026-08-26T09:00:00Z'), now)).toBe(true)
  })

  it('accepts one five days old', () => {
    expect(withinUploadWindow(new Date('2026-08-21T12:00:00Z'), now)).toBe(true)
  })

  it('refuses one eight days old — Meta would reject it', () => {
    expect(withinUploadWindow(new Date('2026-08-18T12:00:00Z'), now)).toBe(false)
  })

  it('refuses a future timestamp', () => {
    expect(withinUploadWindow(new Date('2026-08-27T12:00:00Z'), now)).toBe(false)
  })
})
