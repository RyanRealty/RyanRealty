import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isListingResultsPath,
  shouldAutoOpenSignInPrompt,
  signInPromptSkipReason,
} from './signin-prompt-policy'

const openBase = {
  userPresent: false,
  hasNextParam: false,
  fromAdClick: false,
  fromOutreachClick: false,
  isNotFound: false,
  dismissed: false,
  sessionPageviews: 2,
}

describe('isListingResultsPath', () => {
  it('treats browse and search as results the shopper must read', () => {
    expect(isListingResultsPath('/homes-for-sale')).toBe(true)
    expect(isListingResultsPath('/homes-for-sale/bend/under-300k')).toBe(true)
    expect(isListingResultsPath('/search/bend/under-300k')).toBe(true)
    expect(isListingResultsPath('/cities/bend')).toBe(false)
    expect(isListingResultsPath('/')).toBe(false)
  })
})

describe('signInPromptSkipReason', () => {
  it('skips listing result routes so a $0 warehouse page stays readable', () => {
    expect(
      signInPromptSkipReason({ pathname: '/homes-for-sale/bend/under-300k' }),
    ).toBe('browse')
    expect(
      signInPromptSkipReason({
        pathname: '/homes-for-sale?maxPrice=300000&propertySubType=Warehouse',
      }),
    ).toBe('browse')
  })

  it('keeps existing conversion skips', () => {
    expect(signInPromptSkipReason({ pathname: '/lp/seller-home-value' })).toBe(
      'landing',
    )
    expect(signInPromptSkipReason({ pathname: '/login' })).toBe('auth')
    expect(signInPromptSkipReason({ pathname: '/contact' })).toBe('lead')
    expect(signInPromptSkipReason({ pathname: '/', fromAdClick: true })).toBe('ad')
    expect(signInPromptSkipReason({ pathname: '/', fromOutreachClick: true })).toBe(
      'outreach',
    )
    expect(signInPromptSkipReason({ pathname: '/cities/bend', isNotFound: true })).toBe(
      'not-found',
    )
  })
})

describe('shouldAutoOpenSignInPrompt', () => {
  it('does not wall under-300k or other browse results, even on pageview 2 or ?next=', () => {
    expect(
      shouldAutoOpenSignInPrompt({
        ...openBase,
        pathname: '/homes-for-sale/bend/under-300k',
      }),
    ).toBe(false)
    expect(
      shouldAutoOpenSignInPrompt({
        ...openBase,
        pathname: '/homes-for-sale/bend/under-300k',
        hasNextParam: true,
      }),
    ).toBe(false)
  })

  it('still opens on a non-results second pageview', () => {
    expect(
      shouldAutoOpenSignInPrompt({
        ...openBase,
        pathname: '/cities/bend',
      }),
    ).toBe(true)
  })

  it('never opens on the first pageview without ?next=', () => {
    expect(
      shouldAutoOpenSignInPrompt({
        ...openBase,
        pathname: '/cities/bend',
        sessionPageviews: 1,
      }),
    ).toBe(false)
  })

  it('opens immediately for ?next= on a non-results path', () => {
    expect(
      shouldAutoOpenSignInPrompt({
        ...openBase,
        pathname: '/',
        hasNextParam: true,
        sessionPageviews: 1,
      }),
    ).toBe(true)
  })
})

describe('SignInPrompt close control', () => {
  it('keeps a visible dialog X (not showCloseButton false)', () => {
    const src = readFileSync(join(__dirname, '../../components/SignInPrompt.tsx'), 'utf8')
    expect(src).not.toMatch(/showCloseButton=\{false\}/)
    expect(src).toMatch(/closeButtonVariant="outline"/)
    expect(src).toMatch(/onOpenChange/)
  })
})
