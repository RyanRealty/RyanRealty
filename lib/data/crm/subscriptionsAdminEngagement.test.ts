import { describe, expect, it } from 'vitest'
import { EngagementFold, emptyEngagement } from './subscriptionsAdminEngagement'

const row = (event: string, email_key: string | null, message_id: string | null = null, occurred_at = '2026-10-14T15:00:00Z') => ({
  event,
  email_key,
  message_id,
  occurred_at,
})

describe('EngagementFold counts per email, not per row', () => {
  it('sent, delivered, opened, clicked for two alert emails', () => {
    const fold = new EngagementFold()
    for (const e of [
      row('sent', 'listing-alert:a:2026-10-14T0700Z', 'm1'),
      row('delivered', 'listing-alert:a:2026-10-14T0700Z', 'm1'),
      row('open', 'listing-alert:a:2026-10-14T0700Z'),
      row('open', 'listing-alert:a:2026-10-14T0700Z'), // a second open of the same email
      row('click', 'listing-alert:a:2026-10-14T0700Z'),
      row('click', 'listing-alert:a:2026-10-14T0700Z'), // a second link in the same email
      row('sent', 'listing-alert:a:2026-10-15T1400Z', 'm2'),
      row('delivered', 'listing-alert:a:2026-10-15T1400Z', 'm2'),
    ]) fold.add(e)
    expect(fold.result()).toEqual({ sends: 2, delivered: 2, opens: 1, clicks: 1, bounced: 0, lastOpenAt: '2026-10-14T15:00:00Z' })
  })

  it('a click counts as an open even when the pixel was blocked', () => {
    const fold = new EngagementFold()
    fold.add(row('sent', 'k1', 'm1'))
    fold.add(row('click', 'k1'))
    expect(fold.result().opens).toBe(1)
    expect(fold.result().clicks).toBe(1)
  })

  it('delivery keys on the message id, so two sends that once shared a daily key both count', () => {
    const fold = new EngagementFold()
    fold.add(row('delivered', 'listing-alert:a:2026-10-13', 'm1'))
    fold.add(row('delivered', 'listing-alert:a:2026-10-13', 'm2'))
    fold.add(row('bounce', 'listing-alert:a:2026-10-13', 'm3'))
    expect(fold.result().delivered).toBe(2)
    expect(fold.result().bounced).toBe(1)
  })

  it('an empty fold is the empty engagement', () => {
    expect(new EngagementFold().result()).toEqual(emptyEngagement())
  })
})
