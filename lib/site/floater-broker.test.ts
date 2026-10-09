import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_FLOATER_BROKER,
  FLOATER_BROKER_HEADSHOT,
  floaterBrokerHeadshot,
  floaterBrokerSlug,
} from './floater-broker'

describe('floaterBrokerSlug', () => {
  it('defaults to Matt when the visit is not attributed', () => {
    expect(DEFAULT_FLOATER_BROKER).toBe('matt')
    expect(floaterBrokerSlug({})).toBe('matt')
    expect(floaterBrokerSlug({ agentParam: 'nobody' })).toBe('matt')
    expect(floaterBrokerSlug({ utmContent: 'hero-video-30s' })).toBe('matt')
  })

  it('prefers ?agent= over the cookie and UTM leftovers', () => {
    const cookie = encodeURIComponent(JSON.stringify({ slug: 'matt' }))
    expect(
      floaterBrokerSlug({
        agentParam: 'paul',
        cookieValue: cookie,
        utmContent: 'agent-rebecca',
      }),
    ).toBe('paul')
  })

  it('reads the attribution cookie when the URL no longer carries ?agent=', () => {
    const cookie = encodeURIComponent(JSON.stringify({ slug: 'rebecca', capturedAt: '2026-10-08' }))
    expect(floaterBrokerSlug({ cookieValue: cookie })).toBe('rebecca')
    expect(floaterBrokerSlug({ cookieValue: 'paul-stevenson' })).toBe('paul')
  })

  it('accepts agent-<slug> from utm_content / utm_term', () => {
    expect(floaterBrokerSlug({ utmContent: 'agent-matt-ryan' })).toBe('matt')
    expect(floaterBrokerSlug({ utmTerm: 'agent-paul' })).toBe('paul')
  })

  it('normalizes slug variants', () => {
    expect(floaterBrokerSlug({ agentParam: 'rebecca-peterson' })).toBe('rebecca')
    expect(floaterBrokerSlug({ agentParam: 'matthew-ryan' })).toBe('matt')
    expect(floaterBrokerSlug({ pageUrl: 'https://ryan-realty.com/?agent=Paul' })).toBe('paul')
  })
})

describe('floaterBrokerHeadshot', () => {
  it('maps each broker onto an existing public PNG, Matt when missing', () => {
    expect(floaterBrokerHeadshot('matt')).toBe('/images/brokers/ryan-matt.png')
    expect(floaterBrokerHeadshot('rebecca')).toBe('/images/brokers/peterson-rebecca.png')
    expect(floaterBrokerHeadshot('paul')).toBe('/images/brokers/stevenson-paul.png')
    expect(floaterBrokerHeadshot(null)).toBe('/images/brokers/ryan-matt.png')
    expect(floaterBrokerHeadshot(undefined)).toBe('/images/brokers/ryan-matt.png')
    for (const src of Object.values(FLOATER_BROKER_HEADSHOT)) {
      expect(existsSync(resolve(`public${src}`))).toBe(true)
    }
  })
})
