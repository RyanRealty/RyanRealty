import { describe, expect, it } from 'vitest'
import { isOwnSiteHost, plantFlagsScript } from './automation-marker.mjs'

function cookiesWrittenFor(hostname) {
  const written = []
  const document = {
    set cookie(value) {
      written.push(String(value))
    },
    get cookie() {
      return written.join('; ')
    },
  }
  const location = { hostname }
  new Function('location', 'document', plantFlagsScript())(location, document)
  return written
}

describe('isOwnSiteHost — plant flags only on our hosts', () => {
  it.each([
    'ryan-realty.com',
    'www.ryan-realty.com',
    'localhost:3000',
    '127.0.0.1:8777',
    '192.168.1.5',
    'foo.vercel.app',
  ])('plants on %s', (host) => {
    expect(isOwnSiteHost(host)).toBe(true)
    const cookies = cookiesWrittenFor(host.includes(':') ? host.replace(/:\d+$/, '') : host)
    expect(cookies.some((c) => c.startsWith('rr_automation=1'))).toBe(true)
    expect(cookies.some((c) => c.startsWith('rr_internal=1'))).toBe(true)
  })

  it.each(['app.skyslope.com', 'mail.google.com', 'ryan-realty.com.evil.test'])('does not plant on %s', (host) => {
    expect(isOwnSiteHost(host)).toBe(false)
    expect(cookiesWrittenFor(host)).toEqual([])
  })
})
