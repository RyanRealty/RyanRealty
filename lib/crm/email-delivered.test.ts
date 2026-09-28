import { describe, expect, it } from 'vitest'
import {
  deliveredBasisFromMeta,
  deliveredPreview,
  deliveredTimelineDedupeKey,
} from './email-delivered'
import { classifyTimelineKind } from '@/lib/data/crm/getContactActivityFeed'

describe('deliveredBasisFromMeta', () => {
  it('maps the no-bounce job to no-bounce', () => {
    expect(deliveredBasisFromMeta({ inferred: true, source: 'gmail-bounce-watch' })).toBe('no-bounce')
  })

  it('maps an open-inferred delivery to opened', () => {
    expect(deliveredBasisFromMeta({ inferred: 'opened' })).toBe('opened')
  })

  it('returns null for a provider-confirmed (Resend) record', () => {
    expect(deliveredBasisFromMeta({})).toBeNull()
    expect(deliveredBasisFromMeta({ source: 'resend' })).toBeNull()
    expect(deliveredBasisFromMeta(undefined)).toBeNull()
  })
})

describe('deliveredPreview + KIND_MAP', () => {
  it('labels the two inferred bases honestly', () => {
    expect(deliveredPreview('no-bounce')).toBe('Delivered (no bounce)')
    expect(deliveredPreview('opened')).toBe('Delivered (opened)')
  })

  it('labels email_delivered as Email delivered on the feed', () => {
    expect(classifyTimelineKind('email_delivered')).toEqual({
      category: 'email',
      direction: 'out',
      label: 'Email delivered',
    })
  })

  it('is idempotent on the same (person, emailKey)', () => {
    const a = deliveredTimelineDedupeKey(42, 'cma:cma-deer')
    const b = deliveredTimelineDedupeKey(42, 'cma:cma-deer')
    expect(a).toBe(b)
    expect(a).toBe('track:delivered:42:cma:cma-deer')
  })
})
