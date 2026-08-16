import { describe, expect, it } from 'vitest'
import { hardcodedSlugForEmail, pickCrmSlug } from './resolve-broker-slug'

describe('hardcodedSlugForEmail', () => {
  it('maps the three seeded mailboxes', () => {
    expect(hardcodedSlugForEmail('paul@ryan-realty.com')).toBe('paul')
    expect(hardcodedSlugForEmail('RebeccaPeterson@ryan-realty.com')).toBe('rebecca')
    expect(hardcodedSlugForEmail('matt@ryan-realty.com')).toBe('matt')
  })

  it('returns null for an unmapped mailbox', () => {
    expect(hardcodedSlugForEmail('newbroker@ryan-realty.com')).toBeNull()
    expect(hardcodedSlugForEmail('')).toBeNull()
    expect(hardcodedSlugForEmail(null)).toBeNull()
  })
})

describe('pickCrmSlug (table first, map last)', () => {
  it('prefers the admin_roles.broker_id row over email and the hardcoded map', () => {
    expect(
      pickCrmSlug({
        email: 'paul@ryan-realty.com',
        slugFromBrokerId: 'new-hire',
        slugFromEmailRow: 'paul',
      }),
    ).toBe('new-hire')
  })

  it('uses the brokers.email row when broker_id is unset', () => {
    expect(
      pickCrmSlug({
        email: 'newbroker@ryan-realty.com',
        slugFromBrokerId: null,
        slugFromEmailRow: 'jordan',
      }),
    ).toBe('jordan')
  })

  it('falls back to the seeded map only when the table has no slug', () => {
    expect(
      pickCrmSlug({
        email: 'paul@ryan-realty.com',
        slugFromBrokerId: '  ',
        slugFromEmailRow: null,
      }),
    ).toBe('paul')
  })

  it('returns null for an unmapped new broker (fail-closed input)', () => {
    expect(
      pickCrmSlug({
        email: 'newbroker@ryan-realty.com',
        slugFromBrokerId: null,
        slugFromEmailRow: null,
      }),
    ).toBeNull()
  })
})
