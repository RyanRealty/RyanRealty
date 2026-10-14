import { describe, expect, it } from 'vitest'
import {
  CONSENT_PURPOSES_VERSION,
  MS_PER_DAY,
  RESTRICTED_DECLINE_REPROMPT_DAYS,
  US_DECLINE_REPROMPT_DAYS,
  consentFirstLayerSuppressed,
  parseConsentDecisionMeta,
  parsePromptBookkeeping,
  shouldShowConsentPrompt,
  shouldShowContextualConsentAsk,
} from './consent-prompt'

const DAY = MS_PER_DAY
const NOW = 1_700_000_000_000

function args(
  patch: Partial<Parameters<typeof shouldShowConsentPrompt>[0]> = {},
): Parameters<typeof shouldShowConsentPrompt>[0] {
  return {
    stored: null,
    decidedAt: null,
    lastShownAt: null,
    dismissedThisSession: false,
    newSession: true,
    restricted: false,
    gpc: false,
    now: NOW,
    ...patch,
  }
}

describe('shouldShowConsentPrompt', () => {
  it('never shows when GPC is on, even with no answer', () => {
    expect(shouldShowConsentPrompt(args({ gpc: true }))).toBe(false)
    expect(
      shouldShowConsentPrompt(
        args({
          gpc: true,
          stored: { analytics: false, marketing: false },
          decidedAt: NOW - 400 * DAY,
        }),
      ),
    ).toBe(false)
  })

  it('X then same session stays hidden', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          dismissedThisSession: true,
          newSession: false,
          lastShownAt: NOW - 60_000,
        }),
      ),
    ).toBe(false)
  })

  it('next session < 24h after no answer is hidden', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          newSession: true,
          lastShownAt: NOW - DAY + 1_000,
        }),
      ),
    ).toBe(false)
  })

  it('next session >= 24h after no answer is shown', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          newSession: true,
          lastShownAt: NOW - DAY,
        }),
      ),
    ).toBe(true)
  })

  it('first visit with no answer is shown', () => {
    expect(shouldShowConsentPrompt(args())).toBe(true)
  })

  it('US decline at 89 days is hidden and at 90 days is shown', () => {
    const decline = { analytics: false, marketing: false }
    expect(
      shouldShowConsentPrompt(
        args({
          stored: decline,
          decidedAt: NOW - 89 * DAY,
          restricted: false,
        }),
      ),
    ).toBe(false)
    expect(
      shouldShowConsentPrompt(
        args({
          stored: decline,
          decidedAt: NOW - 90 * DAY,
          restricted: false,
        }),
      ),
    ).toBe(true)
  })

  it('restricted decline at 179 days is hidden and at 183 days is shown', () => {
    const decline = { analytics: false, marketing: false }
    expect(
      shouldShowConsentPrompt(
        args({
          stored: decline,
          decidedAt: NOW - 179 * DAY,
          restricted: true,
        }),
      ),
    ).toBe(false)
    expect(
      shouldShowConsentPrompt(
        args({
          stored: decline,
          decidedAt: NOW - RESTRICTED_DECLINE_REPROMPT_DAYS * DAY,
          restricted: true,
        }),
      ),
    ).toBe(true)
  })

  it('accept never re-prompts unless the purposes version changes', () => {
    const accept = { analytics: true, marketing: true, v: CONSENT_PURPOSES_VERSION }
    expect(shouldShowConsentPrompt(args({ stored: accept, decidedAt: NOW - 400 * DAY }))).toBe(
      false,
    )
    expect(
      shouldShowConsentPrompt(
        args({
          stored: { ...accept, v: CONSENT_PURPOSES_VERSION - 1 },
          decidedAt: NOW - 400 * DAY,
        }),
      ),
    ).toBe(true)
  })

  it('a legacy accept without v is not treated as a version change', () => {
    expect(
      shouldShowConsentPrompt(
        args({ stored: { analytics: true, marketing: true }, decidedAt: NOW - 10 * DAY }),
      ),
    ).toBe(false)
  })

  it('a same-session refresh restores an unanswered notice', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          newSession: false,
          lastShownAt: NOW - 60_000,
        }),
      ),
    ).toBe(true)
  })

  it('GPC never re-prompts a stored accept', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          gpc: true,
          stored: { analytics: true, marketing: true, v: CONSENT_PURPOSES_VERSION },
          decidedAt: NOW - 10 * DAY,
        }),
      ),
    ).toBe(false)
  })

  it('a partial save is an answer, so it does not nag the next day', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          stored: { analytics: true, marketing: false, v: CONSENT_PURPOSES_VERSION },
          decidedAt: NOW - 2 * DAY,
          newSession: true,
          lastShownAt: NOW - 2 * DAY,
        }),
      ),
    ).toBe(false)
  })

  it('same-session X wins over a due decline re-prompt', () => {
    expect(
      shouldShowConsentPrompt(
        args({
          stored: { analytics: false, marketing: false },
          decidedAt: NOW - US_DECLINE_REPROMPT_DAYS * DAY,
          dismissedThisSession: true,
          newSession: false,
        }),
      ),
    ).toBe(false)
  })
})

describe('shouldShowContextualConsentAsk', () => {
  it('fires once for US no-answer, not for restricted, GPC, or after an answer', () => {
    expect(
      shouldShowContextualConsentAsk({
        stored: null,
        gpc: false,
        restricted: false,
        contextualAskUsed: false,
      }),
    ).toBe(true)
    expect(
      shouldShowContextualConsentAsk({
        stored: null,
        gpc: false,
        restricted: false,
        contextualAskUsed: true,
      }),
    ).toBe(false)
    expect(
      shouldShowContextualConsentAsk({
        stored: null,
        gpc: false,
        restricted: true,
        contextualAskUsed: false,
      }),
    ).toBe(false)
    expect(
      shouldShowContextualConsentAsk({
        stored: null,
        gpc: true,
        restricted: false,
        contextualAskUsed: false,
      }),
    ).toBe(false)
    expect(
      shouldShowContextualConsentAsk({
        stored: { analytics: true, marketing: true },
        gpc: false,
        restricted: false,
        contextualAskUsed: false,
      }),
    ).toBe(false)
    expect(
      shouldShowContextualConsentAsk({
        stored: { analytics: false, marketing: false },
        gpc: false,
        restricted: false,
        contextualAskUsed: false,
      }),
    ).toBe(false)
  })
})

describe('consentFirstLayerSuppressed', () => {
  it('hides the first layer on landing, admin, sign, and concept paths', () => {
    expect(consentFirstLayerSuppressed('/lp/seller-home-value')).toBe(true)
    expect(consentFirstLayerSuppressed('/admin')).toBe(true)
    expect(consentFirstLayerSuppressed('/admin/crm')).toBe(true)
    expect(consentFirstLayerSuppressed('/sign/packet')).toBe(true)
    expect(consentFirstLayerSuppressed('/concept/home')).toBe(true)
    expect(consentFirstLayerSuppressed('/')).toBe(false)
    expect(consentFirstLayerSuppressed('/sell')).toBe(false)
    expect(consentFirstLayerSuppressed(null)).toBe(false)
  })
})

describe('parse helpers', () => {
  it('reads ts and v from a consent cookie JSON and ignores junk', () => {
    const raw = encodeURIComponent(JSON.stringify({ analytics: true, marketing: true, ts: 9, v: 1 }))
    expect(parseConsentDecisionMeta(raw)).toEqual({ ts: 9, v: 1 })
    expect(parseConsentDecisionMeta('all')).toEqual({ ts: null, v: null })
    expect(parseConsentDecisionMeta(undefined)).toEqual({ ts: null, v: null })
  })

  it('reads prompt bookkeeping JSON', () => {
    expect(parsePromptBookkeeping(null)).toEqual({ lastShownAt: null, contextualAskUsed: false })
    expect(parsePromptBookkeeping(JSON.stringify({ lastShownAt: 12, contextualAskUsed: true }))).toEqual(
      { lastShownAt: 12, contextualAskUsed: true },
    )
  })
})
