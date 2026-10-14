import { describe, expect, it } from 'vitest'
import { cleanListingMediaUrl, containsEmailAddress } from './listing-media-url'

/**
 * A SafeLinks rewrite shaped exactly like the ones in the MLS video fields
 * (2026-10-14): the real Momenzo link in `url`, the recipient's address and
 * tenant inside `data`, a signature in `sdata`. The address is a fake.
 */
const MOMENZO = 'https://app.momenzo.com/share/v/8f2c41d0-9b7e-4c3a-a1f5-2d6e7b9c0e11?autoplay=0'
const SAFELINKS =
  'https://nam12.safelinks.protection.outlook.com/?url=' +
  encodeURIComponent(MOMENZO) +
  '&data=05%7C02%7Cbroker%40example.com%7C3f1e2d4c5b6a47988a9b0c1d2e3f4a5b%7C84df9e7fe9f640afb435aaaaaaaaaaaa%7C0%7C0%7C638612345678901234%7CUnknown%7CTWFpbGZsb3d8eyJWIjoiMC4wLjAwMDAiLCJQIjoiV2luMzIiLCJBTiI6Ik1haWwiLCJXVCI6Mn0%3D%7C0%7C%7C%7C' +
  '&sdata=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789%2Bab%3D&reserved=0'

describe('cleanListingMediaUrl', () => {
  it('unwraps a Microsoft SafeLinks URL to the real target and drops data/sdata/reserved', () => {
    const out = cleanListingMediaUrl(SAFELINKS)
    expect(out).toBe(MOMENZO)
    expect(out).not.toMatch(/safelinks|data=|sdata=|reserved=|broker/)
    expect(containsEmailAddress(out)).toBe(false)
  })

  it('the fixture really carries an address before cleaning', () => {
    expect(containsEmailAddress(SAFELINKS)).toBe(true)
  })

  it('unwraps the GCC tenant host and nested wrappers', () => {
    const youtube = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const google = `https://www.google.com/url?q=${encodeURIComponent(youtube)}&sa=D`
    const nested = `https://gcc02.safelinks.protection.office365.us/?url=${encodeURIComponent(google)}&data=x&reserved=0`
    expect(cleanListingMediaUrl(nested)).toBe(youtube)
  })

  it('unwraps SafeLinks inside an MLS iframe snippet', () => {
    const vimeo = 'https://player.vimeo.com/video/123456789?h=abcdef1234'
    const wrapped = `https://nam04.safelinks.protection.outlook.com/?url=${encodeURIComponent(vimeo)}&amp;data=05%7C02%7Cbroker%40example.com&amp;reserved=0`
    const html = `<iframe src="${wrapped}" width="640"></iframe>`
    const out = cleanListingMediaUrl(html)
    expect(out).toBe(`<iframe src="${vimeo}" width="640"></iframe>`)
  })

  it('returns null for markup whose only link is an unreadable wrapper (an empty player is no video)', () => {
    expect(cleanListingMediaUrl('<iframe src="https://protect-us.mimecast.com/s/AbCdEf" width="640"></iframe>')).toBeNull()
  })

  it('decodes Proofpoint urldefense v2 and v3', () => {
    expect(
      cleanListingMediaUrl(
        'https://urldefense.proofpoint.com/v2/url?u=https-3A__my.matterport.com_show_-3Fm-3DAbC123xyz&d=DwMFaQ&c=x&r=y&m=z&s=w&e=',
      ),
    ).toBe('https://my.matterport.com/show/?m=AbC123xyz')
    expect(
      cleanListingMediaUrl('https://urldefense.com/v3/__https://vimeo.com/987654321__;!!AbCd!EfGh$'),
    ).toBe('https://vimeo.com/987654321')
  })

  it('drops wrappers whose target cannot be read without the wrapper server', () => {
    expect(cleanListingMediaUrl('https://protect-us.mimecast.com/s/AbCdEfGhIjK?domain=youtube.com')).toBeNull()
    expect(cleanListingMediaUrl('https://urldefense.com/v3/__https://vimeo.com/9*__;Lw!!x$')).toBeNull()
    expect(cleanListingMediaUrl('https://nam12.safelinks.protection.outlook.com/?data=05%7Cx&reserved=0')).toBeNull()
  })

  it('removes an email-bearing query parameter from an unwrapped link', () => {
    expect(cleanListingMediaUrl('https://tours.example.net/p/123?agent=broker%40example.com&branded=0')).toBe(
      'https://tours.example.net/p/123?branded=0',
    )
    expect(cleanListingMediaUrl('https://broker@example.com@tours.example.net/p/1')).not.toMatch(/@/)
  })

  it('drops a URL whose path still names an address', () => {
    expect(cleanListingMediaUrl('https://tours.example.net/broker@example.com/123')).toBeNull()
  })

  it('returns a clean link exactly as given', () => {
    const raw = 'https://my.matterport.com/show/?m=AbC123xyz&play=1'
    expect(cleanListingMediaUrl(raw)).toBe(raw)
    expect(cleanListingMediaUrl('  https://youtu.be/dQw4w9WgXcQ  ')).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(cleanListingMediaUrl('//www.youtube.com/embed/dQw4w9WgXcQ')).toBe('//www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('does not read a retina asset or a channel handle as an address', () => {
    expect(cleanListingMediaUrl('https://cdn.example.net/poster@2x.png')).toBe('https://cdn.example.net/poster@2x.png')
    expect(cleanListingMediaUrl('https://www.youtube.com/@CentralOregonHomes')).toBe(
      'https://www.youtube.com/@CentralOregonHomes',
    )
  })

  it('handles empty input', () => {
    expect(cleanListingMediaUrl(null)).toBeNull()
    expect(cleanListingMediaUrl('   ')).toBeNull()
  })
})
