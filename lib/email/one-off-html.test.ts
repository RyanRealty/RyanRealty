import { describe, expect, it } from 'vitest'
import {
  localImageFilenames,
  missingLocalImageSrcs,
  normalizeOneOffUtms,
  rewriteLocalImageSrcs,
} from './one-off-html'

describe('one-off HTML image rewrite', () => {
  const html = [
    '<img src="tetherow-map-v2.png" alt="map">',
    '<img src="https://ryan-realty.com/logo.png" alt="logo">',
    '<img src="cid:inline-1" alt="inline">',
    '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="px">',
    '<img src="./assets/map.png" alt="rel">',
  ].join('')

  it('lists only relative local filenames', () => {
    expect(localImageFilenames(html)).toEqual(['tetherow-map-v2.png', 'map.png'])
  })

  it('rewrites hosted filenames and leaves remote/embedded srcs', () => {
    const out = rewriteLocalImageSrcs(html, {
      'tetherow-map-v2.png': 'https://cdn.example/tetherow-map-v2.png',
      'map.png': 'https://cdn.example/map.png',
    })
    expect(out).toContain('src="https://cdn.example/tetherow-map-v2.png"')
    expect(out).toContain('src="https://cdn.example/map.png"')
    expect(out).toContain('src="https://ryan-realty.com/logo.png"')
    expect(out).toContain('src="cid:inline-1"')
    expect(out).toContain('src="data:image/gif;base64,')
  })

  it('reports filenames that still need a hosted url', () => {
    expect(missingLocalImageSrcs(html, { 'map.png': 'https://cdn.example/map.png' })).toEqual([
      'tetherow-map-v2.png',
    ])
  })

  it('rewrites a per-send campaign slug onto the CRM outbound vocab', () => {
    const raw =
      'https://ryan-realty.com/listing/1?utm_source=email&utm_medium=email&utm_campaign=tetherow-elize&utm_content=abc'
    expect(normalizeOneOffUtms(raw)).toBe(
      'https://ryan-realty.com/listing/1?utm_source=crm&utm_medium=email&utm_campaign=crm-outbound&utm_content=abc',
    )
  })
})
