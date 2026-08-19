import { describe, expect, it } from 'vitest'
import { cmaCrmComposeHref } from './crm-compose-href'

describe('cmaCrmComposeHref', () => {
  it('opens person compose with the CMA slug, not a Gmail or admin PDF URL', () => {
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
})
