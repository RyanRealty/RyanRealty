import { describe, expect, it } from 'vitest'
import { getAlertManageUrl } from './manage-url'

describe('getAlertManageUrl', () => {
  it('builds an absolute manage link anchored to the alert card', () => {
    expect(getAlertManageUrl('abc-123', 'https://ryan-realty.com')).toBe(
      'https://ryan-realty.com/account/saved-searches#alert-abc-123',
    )
  })

  it('strips a trailing slash on the site url', () => {
    expect(getAlertManageUrl('abc', 'https://ryan-realty.com/')).toBe(
      'https://ryan-realty.com/account/saved-searches#alert-abc',
    )
  })

  it('returns a relative path when no site url is given', () => {
    expect(getAlertManageUrl('abc')).toBe('/account/saved-searches#alert-abc')
  })

  it('drops the anchor when the id is blank', () => {
    expect(getAlertManageUrl('', 'https://ryan-realty.com')).toBe(
      'https://ryan-realty.com/account/saved-searches',
    )
    expect(getAlertManageUrl('   ')).toBe('/account/saved-searches')
  })

  it('URL-encodes the id inside the anchor', () => {
    expect(getAlertManageUrl('a b/c')).toBe('/account/saved-searches#alert-a%20b%2Fc')
  })
})
