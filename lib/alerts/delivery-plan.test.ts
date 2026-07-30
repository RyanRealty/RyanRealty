import { describe, it, expect } from 'vitest'
import {
  normalizeRecipients,
  planAlertDelivery,
  type AlertRecipient,
  type RecipientCompliance,
} from './delivery-plan'
import { DEFAULT_EVENT_TOGGLES, normalizeEventToggles, type ListingEvent } from './event-detection'

/**
 * Phase 3 contract test, delivery half: toggles filter, preview queues,
 * multi-recipient fan-out with distinct tokens, per-recipient compliance
 * stops.
 */

const EVENTS: ListingEvent[] = [
  { type: 'new', listingKey: 'A' },
  { type: 'price_change', listingKey: 'B' },
  { type: 'sold', listingKey: 'C' },
]

function compliant(recipients: AlertRecipient[]): Map<string, RecipientCompliance> {
  return new Map(recipients.map((r) => [r.email, { hardStopped: false, suppressed: false }]))
}

const ROW = {
  email: 'Jim@Example.com',
  unsubscribe_token: 'tok-primary',
  recipients: [
    { email: 'lisa@example.com', name: 'Lisa', unsubscribe_token: 'tok-lisa' },
    { email: 'jim@example.com', unsubscribe_token: 'tok-dupe' }, // dupe of primary
    { email: 'not-an-email', unsubscribe_token: 'tok-junk' },
    { email: 'kid@example.com' }, // no token yet (engine backfills)
  ],
}

describe('normalizeRecipients — multi-recipient fan-out', () => {
  it('yields primary + each valid household entry, deduped, lowercased', () => {
    const recipients = normalizeRecipients(ROW)
    expect(recipients.map((r) => r.email)).toEqual([
      'jim@example.com',
      'lisa@example.com',
      'kid@example.com',
    ])
    expect(recipients[0].kind).toBe('primary')
    expect(recipients.slice(1).every((r) => r.kind === 'additional')).toBe(true)
  })

  it('every recipient carries their OWN unsubscribe token', () => {
    const recipients = normalizeRecipients(ROW)
    const tokens = recipients.map((r) => r.unsubscribeToken)
    expect(tokens[0]).toBe('tok-primary')
    expect(tokens[1]).toBe('tok-lisa')
    expect(tokens[2]).toBe('') // missing → engine backfills before send
    // Distinct where present:
    const present = tokens.filter(Boolean)
    expect(new Set(present).size).toBe(present.length)
  })

  it('handles a null/absent recipients column (pre-migration rows)', () => {
    const recipients = normalizeRecipients({ email: 'a@b.com', unsubscribe_token: 't' })
    expect(recipients).toHaveLength(1)
    expect(recipients[0]).toMatchObject({ email: 'a@b.com', kind: 'primary', unsubscribeToken: 't' })
  })
})

describe('planAlertDelivery', () => {
  const recipients = normalizeRecipients({
    email: 'jim@example.com',
    unsubscribe_token: 'tok-primary',
    recipients: [{ email: 'lisa@example.com', unsubscribe_token: 'tok-lisa' }],
  })

  it('toggles filter the fired events (default map drops sold)', () => {
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance: compliant(recipients),
    })
    expect(plan.action).toBe('send')
    expect(plan.events.map((e) => e.type)).toEqual(['new', 'price_change'])
  })

  it('skips when every event is toggled off', () => {
    const plan = planAlertDelivery({
      events: [{ type: 'sold', listingKey: 'C' }],
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance: compliant(recipients),
    })
    expect(plan).toMatchObject({ action: 'skip', reason: 'no_events' })
  })

  it('preview mode queues instead of sending', () => {
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: true,
      recipients,
      compliance: compliant(recipients),
    })
    expect(plan.action).toBe('queue')
    expect(plan.events.map((e) => e.type)).toEqual(['new', 'price_change'])
  })

  it('sends to every compliant recipient (household fan-out)', () => {
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance: compliant(recipients),
    })
    expect(plan.action).toBe('send')
    if (plan.action === 'send') {
      expect(plan.deliverTo.map((r) => r.email)).toEqual(['jim@example.com', 'lisa@example.com'])
      expect(new Set(plan.deliverTo.map((r) => r.unsubscribeToken)).size).toBe(2)
    }
  })

  it('a compliance stop drops ONLY the stopped recipient', () => {
    const compliance = new Map<string, RecipientCompliance>([
      ['jim@example.com', { hardStopped: true, suppressed: false }],
      ['lisa@example.com', { hardStopped: false, suppressed: false }],
    ])
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance,
    })
    expect(plan.action).toBe('send')
    if (plan.action === 'send') {
      expect(plan.deliverTo.map((r) => r.email)).toEqual(['lisa@example.com'])
    }
  })

  it('suppression stops a recipient just like a hard stop', () => {
    const compliance = new Map<string, RecipientCompliance>([
      ['jim@example.com', { hardStopped: false, suppressed: true }],
      ['lisa@example.com', { hardStopped: false, suppressed: false }],
    ])
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance,
    })
    if (plan.action === 'send') {
      expect(plan.deliverTo.map((r) => r.email)).toEqual(['lisa@example.com'])
    } else {
      throw new Error(`expected send, got ${plan.action}`)
    }
  })

  it('skips (never sends) when every recipient is stopped', () => {
    const compliance = new Map<string, RecipientCompliance>([
      ['jim@example.com', { hardStopped: true, suppressed: false }],
      ['lisa@example.com', { hardStopped: false, suppressed: true }],
    ])
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance,
    })
    expect(plan).toMatchObject({ action: 'skip', reason: 'all_recipients_stopped' })
  })

  it('a recipient MISSING from the compliance map fails closed', () => {
    const compliance = new Map<string, RecipientCompliance>([
      ['jim@example.com', { hardStopped: false, suppressed: false }],
      // lisa absent
    ])
    const plan = planAlertDelivery({
      events: EVENTS,
      toggles: DEFAULT_EVENT_TOGGLES,
      previewMode: false,
      recipients,
      compliance,
    })
    if (plan.action === 'send') {
      expect(plan.deliverTo.map((r) => r.email)).toEqual(['jim@example.com'])
    } else {
      throw new Error(`expected send, got ${plan.action}`)
    }
  })

  it('preview mode with all events toggled off still skips (nothing to queue)', () => {
    const off = normalizeEventToggles({ new: false, price_change: false, status_change: false })
    const plan = planAlertDelivery({
      events: EVENTS.filter((e) => e.type !== 'sold'),
      toggles: off,
      previewMode: true,
      recipients,
      compliance: compliant(recipients),
    })
    expect(plan).toMatchObject({ action: 'skip', reason: 'no_events' })
  })
})
