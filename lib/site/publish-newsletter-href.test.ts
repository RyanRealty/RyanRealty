import { describe, expect, it } from 'vitest'
import {
  NEWSLETTER_SUBSCRIBE_HREF,
  isNewsletterSubscribeHref,
  publishNewsletterSubscribeDestination,
  publishNewsletterSubscribeHref,
} from './publish-newsletter-href'

describe('publishNewsletterSubscribeHref', () => {
  it('publishes the dedicated /newsletter door', () => {
    expect(publishNewsletterSubscribeHref()).toBe('/newsletter')
    expect(NEWSLETTER_SUBSCRIBE_HREF).toBe('/newsletter')
  })
})

describe('isNewsletterSubscribeHref', () => {
  it('accepts /newsletter with or without a trailing slash', () => {
    expect(isNewsletterSubscribeHref('/newsletter')).toBe(true)
    expect(isNewsletterSubscribeHref('/newsletter/')).toBe(true)
    expect(isNewsletterSubscribeHref('/newsletter?src=footer')).toBe(true)
  })

  it('rejects listing alerts and empty', () => {
    expect(isNewsletterSubscribeHref('/lp/buyer-listing-alerts')).toBe(false)
    expect(isNewsletterSubscribeHref('/')).toBe(false)
    expect(isNewsletterSubscribeHref(null)).toBe(false)
    expect(isNewsletterSubscribeHref('')).toBe(false)
  })
})

describe('publishNewsletterSubscribeDestination', () => {
  it('keeps /newsletter and withholds listing alerts', () => {
    expect(publishNewsletterSubscribeDestination('/newsletter')).toBe('/newsletter')
    expect(publishNewsletterSubscribeDestination('/lp/buyer-listing-alerts')).toBeNull()
    expect(publishNewsletterSubscribeDestination('/lp/buyer-listing-alerts/')).toBeNull()
    expect(publishNewsletterSubscribeDestination(null)).toBeNull()
  })
})
