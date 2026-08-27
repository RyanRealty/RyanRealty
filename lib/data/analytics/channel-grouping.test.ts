import { describe, expect, it } from 'vitest'
import { classifyChannel, originLabel, type SessionSignals } from './channel-grouping'

const s = (o: Partial<SessionSignals> = {}): SessionSignals => ({ ...o })

describe('classifyChannel — paid outranks everything', () => {
  it('a Meta click id is Paid Social even with no tags', () => {
    expect(classifyChannel(s({ fbclid: 'abc123' }))).toBe('Paid Social')
  })

  it('a paid medium on a social source is Paid Social', () => {
    expect(classifyChannel(s({ utmSource: 'facebook', utmMedium: 'cpc' }))).toBe('Paid Social')
    expect(classifyChannel(s({ utmSource: 'instagram', utmMedium: 'paid_social' }))).toBe('Paid Social')
  })

  it('a paid medium otherwise is Paid Search', () => {
    expect(classifyChannel(s({ utmSource: 'google', utmMedium: 'cpc' }))).toBe('Paid Search')
    expect(classifyChannel(s({ utmSource: 'bing', utmMedium: 'ppc' }))).toBe('Paid Search')
  })

  it('paid beats a contradicting referrer', () => {
    // Money bought the visit even if the browser reports a search referrer.
    expect(classifyChannel(s({ referrer: 'https://www.google.com/', utmMedium: 'cpc' }))).toBe('Paid Search')
  })
})

describe('classifyChannel — our own tagged links', () => {
  it('reads email and sms mediums', () => {
    expect(classifyChannel(s({ utmSource: 'crm', utmMedium: 'email' }))).toBe('Email')
    expect(classifyChannel(s({ utmSource: 'crm', utmMedium: 'sms' }))).toBe('SMS')
    expect(classifyChannel(s({ utmSource: 'crm', utmMedium: 'newsletter' }))).toBe('Email')
  })

  it('reads an organic social medium', () => {
    expect(classifyChannel(s({ utmSource: 'instagram', utmMedium: 'social' }))).toBe('Organic Social')
  })
})

describe('classifyChannel — untagged referrers', () => {
  it('recognises the social networks', () => {
    for (const r of [
      'https://www.facebook.com/',
      'https://m.facebook.com/x',
      'https://l.instagram.com/?u=1',
      'https://t.co/abc',
      'https://www.linkedin.com/feed',
      'https://www.youtube.com/watch?v=1',
    ]) {
      expect(classifyChannel(s({ referrer: r }))).toBe('Organic Social')
    }
  })

  it('recognises search engines', () => {
    expect(classifyChannel(s({ referrer: 'https://www.google.com/' }))).toBe('Organic Search')
    expect(classifyChannel(s({ referrer: 'https://duckduckgo.com/' }))).toBe('Organic Search')
    expect(classifyChannel(s({ referrer: 'https://www.google.co.uk/search' }))).toBe('Organic Search')
  })

  it('gives AI assistants their own bucket — they send real traffic now', () => {
    expect(classifyChannel(s({ referrer: 'https://chatgpt.com/' }))).toBe('AI Assistant')
    expect(classifyChannel(s({ referrer: 'https://www.perplexity.ai/' }))).toBe('AI Assistant')
  })

  it('anything else with a referrer is a Referral', () => {
    expect(classifyChannel(s({ referrer: 'https://homeservicebase.com/x' }))).toBe('Referral')
  })

  it('does NOT count our own site as a referral', () => {
    // An internal hop is still the original visit, not a new source.
    expect(classifyChannel(s({ referrer: 'https://ryan-realty.com/search' }))).toBe('Direct')
    expect(classifyChannel(s({ referrer: 'https://www.ryan-realty.com/' }))).toBe('Direct')
  })
})

describe('classifyChannel — the honest bottom', () => {
  it('nothing at all is Direct', () => {
    expect(classifyChannel(s())).toBe('Direct')
    expect(classifyChannel(s({ referrer: null, utmSource: null }))).toBe('Direct')
  })

  it('a tag we do not recognise is still a campaign, not Direct', () => {
    expect(classifyChannel(s({ utmSource: 'postcard', utmMedium: 'print' }))).toBe('Other Campaign')
    expect(classifyChannel(s({ utmCampaign: 'spring-farm' }))).toBe('Other Campaign')
  })

  it('survives a malformed referrer instead of throwing', () => {
    expect(classifyChannel(s({ referrer: 'not a url' }))).toBe('Direct')
    expect(classifyChannel(s({ referrer: '' }))).toBe('Direct')
  })
})

describe('originLabel — the specific origin inside a group', () => {
  it('prefers source and campaign together', () => {
    expect(originLabel(s({ utmSource: 'gbp', utmCampaign: 'profile' }))).toBe('gbp / profile')
  })
  it('falls back to source, then referrer host', () => {
    expect(originLabel(s({ utmSource: 'facebook' }))).toBe('facebook')
    expect(originLabel(s({ referrer: 'https://www.facebook.com/x' }))).toBe('facebook.com')
  })
  it('says (none) rather than inventing an origin', () => {
    expect(originLabel(s())).toBe('(none)')
    expect(originLabel(s({ referrer: 'https://ryan-realty.com/' }))).toBe('(none)')
  })
})
