import { describe, it, expect } from 'vitest'
import { platformFetchCode } from './platform-fetch-code'

describe('platformFetchCode', () => {
  it('maps the publish-endpoint long names to the short fetch code', () => {
    // These are the spellings publisher-sweep actually writes into
    // executor_response.published_to[].platform (the publish endpoint Platform union).
    expect(platformFetchCode('instagram')).toBe('ig')
    expect(platformFetchCode('facebook')).toBe('fb')
    expect(platformFetchCode('google_business_profile')).toBe('gbp')
    expect(platformFetchCode('tiktok')).toBe('tt')
    expect(platformFetchCode('youtube')).toBe('youtube')
    expect(platformFetchCode('linkedin')).toBe('linkedin')
    expect(platformFetchCode('x')).toBe('x')
    expect(platformFetchCode('pinterest')).toBe('pinterest')
    expect(platformFetchCode('threads')).toBe('threads')
    expect(platformFetchCode('nextdoor')).toBe('nextdoor')
  })

  it('is idempotent on already-short codes (a caller may pass either form)', () => {
    expect(platformFetchCode('ig')).toBe('ig')
    expect(platformFetchCode('fb')).toBe('fb')
    expect(platformFetchCode('gbp')).toBe('gbp')
    expect(platformFetchCode('tt')).toBe('tt')
  })

  it('the two token-live platforms route to a real Meta fetch code (the bug this kills)', () => {
    // instagram/facebook were the silent failure: they fell to the switch default
    // and stored {error:'unknown_platform'} instead of metrics. They MUST map to
    // the codes fetchByPlatform dispatches to fetchMetaPostMetrics with.
    expect(platformFetchCode('instagram')).toBe('ig')
    expect(platformFetchCode('facebook')).toBe('fb')
  })

  it('normalizes case and whitespace', () => {
    expect(platformFetchCode(' Instagram ')).toBe('ig')
    expect(platformFetchCode('FACEBOOK')).toBe('fb')
  })

  it('passes an unknown platform through (lowercased) so the caller still throws unknown_platform', () => {
    expect(platformFetchCode('mastodon')).toBe('mastodon')
    expect(platformFetchCode('')).toBe('')
  })
})
