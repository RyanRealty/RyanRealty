import { describe, expect, it } from 'vitest'
import { attributeSiteLinks } from './merge'

const LINK = 'Read it here: https://ryan-realty.com/housing-market/bend'

describe('attributeSiteLinks — a link we send must identify who we sent it to', () => {
  // THE DEFECT. `_fuid` is the retired vendor CRM's id; `_pid` is the native
  // crm_people id. Only 18,188 of 23,078 contacts have a fub_legacy_id, so the
  // newsletter, the CRM composer and the sequence engine — all of which passed
  // only _fuid — left 4,890 people permanently unidentifiable no matter how many
  // links they clicked. That is everyone created since the CRM cutover, and the
  // only segment still growing.
  it('stamps the native person id', () => {
    const out = attributeSiteLinks(LINK, 'matt', null, 4242)
    expect(out).toContain('_pid=4242')
  })

  it('stamps both ids when the contact has a legacy id too', () => {
    const out = attributeSiteLinks(LINK, 'matt', 99, 4242)
    expect(out).toContain('_fuid=99')
    expect(out).toContain('_pid=4242')
  })

  it('a contact with NO legacy id is still identifiable', () => {
    const out = attributeSiteLinks(LINK, 'matt', null, 4242)
    expect(out).not.toContain('_fuid')
    expect(out).toContain('_pid=4242')
  })

  it('still routes the lead to the sending broker', () => {
    expect(attributeSiteLinks(LINK, 'rebecca', null, 7)).toContain('agent=rebecca')
  })

  it('is idempotent — a second pass does not double-stamp', () => {
    const once = attributeSiteLinks(LINK, 'matt', 99, 4242)
    expect(attributeSiteLinks(once, 'matt', 99, 4242)).toBe(once)
  })

  it('never stamps an admin link', () => {
    const out = attributeSiteLinks('https://ryan-realty.com/admin/crm', 'matt', 99, 4242)
    expect(out).not.toContain('_pid')
  })

  it('keeps params out of the #fragment', () => {
    const out = attributeSiteLinks('https://ryan-realty.com/housing-market/bend#report', 'matt', null, 4242)
    expect(out).toContain('_pid=4242')
    expect(out.endsWith('#report')).toBe(true)
  })

  it('leaves the text alone when there is nothing to stamp', () => {
    expect(attributeSiteLinks(LINK, null, null, null)).toBe(LINK)
  })
})
