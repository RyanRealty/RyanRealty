import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  googlePromptDisplayed,
  googlePromptUnavailable,
  RR_OPEN_SIGNIN,
  RR_OPEN_SIGNIN_FLAG,
} from './google-gis'

describe('googlePromptUnavailable', () => {
  it('treats a missing Google session as unavailable', () => {
    expect(
      googlePromptUnavailable({
        isNotDisplayed: () => true,
        isSkippedMoment: () => false,
        isDismissedMoment: () => false,
      }),
    ).toBe(true)
    expect(
      googlePromptUnavailable({
        isNotDisplayed: () => false,
        isSkippedMoment: () => true,
        isDismissedMoment: () => false,
      }),
    ).toBe(true)
  })

  it('does not treat a dismissed One Tap as "no Google"', () => {
    expect(
      googlePromptUnavailable({
        isNotDisplayed: () => false,
        isSkippedMoment: () => false,
        isDismissedMoment: () => true,
      }),
    ).toBe(false)
  })

  it('treats a display moment as Google continue showing', () => {
    expect(
      googlePromptDisplayed({
        isDisplayMoment: () => true,
        isNotDisplayed: () => false,
        isSkippedMoment: () => false,
        isDismissedMoment: () => false,
      }),
    ).toBe(true)
  })
})

describe('promptGoogleOneTap exclusive continue', () => {
  it('cancels GIS when falling back so FedCM cannot sit next to our card', () => {
    const src = readFileSync(join(__dirname, 'google-gis.ts'), 'utf8')
    expect(src).toMatch(/g\.accounts\.id\.cancel\(\)/)
    expect(src).toMatch(/cancel\(\)/)
    expect(src).toMatch(/input\.onUnavailable\(\)/)
  })
})

describe('open-signin event', () => {
  it('names the on-page continue event', () => {
    expect(RR_OPEN_SIGNIN).toBe('rr-open-signin')
    expect(RR_OPEN_SIGNIN_FLAG).toBe('rr_open_signin')
  })
})
