import { describe, expect, it } from 'vitest'
import { shouldHidePublicChrome } from './public-chrome-hide'

describe('shouldHidePublicChrome', () => {
  it('hides admin, lp, account, dashboard, sign, and the rest of the PublicNav set', () => {
    const hidden = [
      '/admin',
      '/admin/people/1',
      '/lp/seller-home-value',
      '/sign/abc',
      '/concept/x',
      '/dashboard',
      '/dashboard/saved',
      '/account',
      '/account/saved-homes',
      '/cma-drafts/1',
      '/dev/public-v3',
      '/marketing/request',
    ]
    for (const path of hidden) {
      expect(shouldHidePublicChrome(path), path).toBe(true)
    }
  })

  it('shows on public destinations including login', () => {
    const shown = ['/', '/homes-for-sale', '/search', '/housing-market', '/sell', '/about', '/login']
    for (const path of shown) {
      expect(shouldHidePublicChrome(path), path).toBe(false)
    }
  })
})
