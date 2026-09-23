/**
 * The retired /_next/image URL (TRACK-3, visibility audit 2026-09-22).
 *
 * Two properties matter:
 *   1. Every image the optimizer used to serve resolves: a same-origin path or
 *      an allow-listed photo host 308s to the image itself.
 *   2. It is never an open redirect: a foreign host, a protocol-relative path,
 *      a backslash trick, or a wildcard sibling of an allowed host gets a 410.
 */
import { describe, expect, it } from 'vitest'
import { resolveLegacyNextImage } from './legacy-next-image'

const ORIGIN = 'https://ryan-realty.com'

function req(url: string | string[] | null, extra = '&w=640&q=75'): URL {
  const u = new URL(`${ORIGIN}/_next/image`)
  const list = url === null ? [] : Array.isArray(url) ? url : [url]
  for (const v of list) u.searchParams.append('url', v)
  return new URL(`${u.href}${list.length ? extra : ''}`)
}

describe('resolveLegacyNextImage — images that exist resolve', () => {
  it('redirects a same-origin path to the file itself (the audit example)', () => {
    expect(resolveLegacyNextImage(req('/images/communities/broken-top.jpg'))).toEqual({
      kind: 'redirect',
      location: 'https://ryan-realty.com/images/communities/broken-top.jpg',
    })
  })

  it('keeps a same-origin query string (a local image route with params)', () => {
    const d = resolveLegacyNextImage(req('/api/og?title=Bend%20homes'))
    expect(d).toEqual({ kind: 'redirect', location: 'https://ryan-realty.com/api/og?title=Bend%20homes' })
  })

  it('redirects on the host that was asked, so a preview or local host serves its own files', () => {
    const u = new URL('https://preview.ryan-realty.test/_next/image?url=%2Fimages%2Fa.jpg&w=64&q=75')
    expect(resolveLegacyNextImage(u)).toEqual({
      kind: 'redirect',
      location: 'https://preview.ryan-realty.test/images/a.jpg',
    })
  })

  it.each([
    'https://cdn.photos.sparkplatform.com/or/20240601012345678901000000-o.jpg',
    'https://cdn.resize.sparkplatform.com/or/1024x768/true/20240601012345678901000000-o.jpg',
    'https://replication.sparkapi.com/v1/listings/photo.jpg',
    'https://sparkapi.com/photo.jpg',
    'https://images.unsplash.com/photo-123?auto=format&w=1200',
    'https://lh3.googleusercontent.com/a/abc=s96-c',
    'https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/blog/hero.jpg',
  ])('redirects an allow-listed photo host: %s', (remote) => {
    const d = resolveLegacyNextImage(req(remote))
    expect(d.kind).toBe('redirect')
    if (d.kind === 'redirect') expect(d.location).toBe(new URL(remote).href)
  })

  it('ignores the optimizer width and quality params', () => {
    const d = resolveLegacyNextImage(req('/images/a.jpg', '&w=3840&q=90&dpl=dpl_abc'))
    expect(d).toEqual({ kind: 'redirect', location: 'https://ryan-realty.com/images/a.jpg' })
  })
})

describe('resolveLegacyNextImage — never an open redirect', () => {
  it.each([
    ['https://evil.example.com/a.jpg', 'host-not-allowed'],
    ['http://cdn.photos.sparkplatform.com/a.jpg', 'host-not-allowed'],
    ['https://www.sparkplatform.com/a.jpg', 'host-not-allowed'],
    ['https://sparkplatform.com.evil.com/a.jpg', 'host-not-allowed'],
    ['https://cdn.photos.sparkplatform.com:8443/a.jpg', 'host-not-allowed'],
    ['https://user:pw@cdn.photos.sparkplatform.com/a.jpg', 'host-not-allowed'],
    // Another project's bucket, and this project's non-public paths.
    ['https://attacker.supabase.co/storage/v1/object/public/x.html', 'host-not-allowed'],
    ['https://dwvlophlbvvygjfxcrhm.supabase.co/auth/v1/authorize', 'host-not-allowed'],
    ['https://storage.googleusercontent.com/x', 'host-not-allowed'],
    ['http://localhost:3000/a.jpg', 'host-not-allowed'],
    ['javascript:alert(1)', 'host-not-allowed'],
    ['data:image/png;base64,AAAA', 'host-not-allowed'],
    ['//evil.example.com/a.jpg', 'protocol-relative'],
    ['/\\evil.example.com/a.jpg', 'unsafe-characters'],
    ['/images/a.jpg\n', 'redirect-trimmed'],
    ['/_next/image?url=%2Fimages%2Fa.jpg', 'nested-optimizer'],
    ['not a url', 'unparseable'],
  ])('%s -> %s', (raw, reason) => {
    const d = resolveLegacyNextImage(req(raw))
    if (reason === 'redirect-trimmed') {
      // A trailing newline is trimmed before the checks, so a copy-paste
      // artifact still resolves to the same local image.
      expect(d).toEqual({ kind: 'redirect', location: 'https://ryan-realty.com/images/a.jpg' })
      return
    }
    expect(d).toEqual({ kind: 'gone', reason })
  })

  it('410s a request with no url, an empty url, or two urls', () => {
    expect(resolveLegacyNextImage(req(null))).toEqual({ kind: 'gone', reason: 'no-url' })
    expect(resolveLegacyNextImage(req(''))).toEqual({ kind: 'gone', reason: 'empty-url' })
    expect(resolveLegacyNextImage(req(['/a.jpg', '/b.jpg']))).toEqual({ kind: 'gone', reason: 'multiple-url' })
  })

  it('a location is always on the request origin or an allow-listed https host', () => {
    const samples = [
      '/images/a.jpg',
      'https://cdn.photos.sparkplatform.com/a.jpg',
      'https://evil.example.com/a.jpg',
      '//evil.example.com',
      '/\\evil.example.com',
      'https:evil.example.com',
      'https://ryan-realty.com@evil.example.com/a.jpg',
    ]
    for (const s of samples) {
      const d = resolveLegacyNextImage(req(s))
      if (d.kind !== 'redirect') continue
      const host = new URL(d.location).hostname
      expect(['ryan-realty.com', 'cdn.photos.sparkplatform.com']).toContain(host)
    }
  })
})
