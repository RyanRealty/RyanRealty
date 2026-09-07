import { describe, expect, it } from 'vitest'
import { cmaCrmComposeHref, cmaReviewSendHref } from './crm-compose-href'

describe('cmaReviewSendHref', () => {
  it('points at Review EmailBodyEditor, never People Blank', () => {
    expect(cmaReviewSendHref('cma-648-se-douglas')).toBe('/admin/cmas/cma-648-se-douglas')
    expect(cmaReviewSendHref('')).toBeNull()
    expect(cmaReviewSendHref('1907fdef-0e0a-663b-2afe-f8ce772c3269')).toBeNull()
  })
})

describe('cmaCrmComposeHref', () => {
  it('opens person compose with the CMA slug when inputs are valid', () => {
    const href = cmaCrmComposeHref({
      personId: 63285,
      slug: 'cma-648-se-douglas',
      channel: 'email',
    })
    expect(href).toBe('/admin/people/63285?composeCma=cma-648-se-douglas&replyChannel=email#comms')
    expect(href).not.toContain('gmail')
    expect(href).not.toContain('mailto:')
    expect(href).not.toContain('/api/cma/')
  })

  it('can target the text composer', () => {
    expect(cmaCrmComposeHref({ personId: 63285, slug: 'cma-648-se-douglas', channel: 'sms' })).toContain(
      'replyChannel=sms',
    )
  })

  it('never hops to People List Blank on bad person/slug/uuid', () => {
    expect(cmaCrmComposeHref({ personId: 0, slug: 'cma-648-se-douglas' })).toBeNull()
    expect(cmaCrmComposeHref({ personId: 63285, slug: '' })).toBeNull()
    expect(cmaCrmComposeHref({ personId: 63285, slug: '1907fdef-0e0a-663b-2afe-f8ce772c3269' })).toBeNull()
  })
})
