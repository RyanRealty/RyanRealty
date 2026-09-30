import { describe, expect, it } from 'vitest'
import { trackedDocLink } from '@/lib/cma/doc-links'
import { IDENTITY_LINK_PARAM } from '@/lib/identity/link-token'
import {
  inspectLetterSiteLinks,
  letterHasContactIdentity,
  letterLinkTrackingCheck,
} from '@/lib/cma/letter-link-contract'

describe('letter tracking — Nugget vs Slate / Oakside / Marshmallow', () => {
  it('Nugget shape: a contact id stamps _pid and UTM on every site link', () => {
    const href = trackedDocLink('listing', { listingKey: 'L1', city: 'Bend' }, {
      brokerSlug: 'matthew-ryan',
      personId: 19815,
      cmaSlug: 'cma-19815-nugget',
    })
    expect(href).toContain('utm_source=cma')
    expect(href).toContain('utm_medium=document')
    expect(href).toContain('utm_campaign=cma-19815-nugget')
    expect(href).toContain(`${IDENTITY_LINK_PARAM}=`)
    const html = `<a href="${href}">comp</a>`
    const check = letterLinkTrackingCheck(html, { personId: 19815 })
    expect(check.pass).toBe(true)
    expect(inspectLetterSiteLinks(html)[0]?.hasPid).toBe(true)
  })

  it('Slate / Oakside / Marshmallow shape: UTM-only links fail when a contact id exists', () => {
    const utmOnly = trackedDocLink('search', 'Bend', {
      brokerSlug: 'matthew-ryan',
      personId: null,
      cmaSlug: 'cma-20594-slate',
    })
    expect(utmOnly).toContain('utm_source=cma')
    expect(utmOnly).not.toContain(`${IDENTITY_LINK_PARAM}=`)
    expect(letterHasContactIdentity({ personId: 20594 })).toBe(true)
    expect(letterLinkTrackingCheck(`<a href="${utmOnly}">homes</a>`, { personId: 20594 }).pass).toBe(false)
    const stamped = trackedDocLink('search', 'Bend', {
      brokerSlug: 'matthew-ryan',
      personId: 20594,
      cmaSlug: 'cma-20594-slate',
    })
    expect(letterLinkTrackingCheck(`<a href="${stamped}">homes</a>`, { personId: 20594 }).pass).toBe(true)
  })
})
