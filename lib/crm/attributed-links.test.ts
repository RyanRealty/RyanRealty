import { describe, it, expect } from 'vitest'
import { attributeOutbound, attributeUrl } from './attributed-links'

const OPTS = {
  brokerSlug: 'matt-ryan',
  personId: 4242,
  fubPersonId: 9001,
  emailKey: 'newsletter:abc',
  label: 'Your Bend market update',
}

describe('attributeOutbound', () => {
  it('stamps ?agent=<broker> onto a ryan-realty.com link', () => {
    const html = '<a href="https://ryan-realty.com/homes-for-sale">Browse</a>'
    const out = attributeOutbound(html, OPTS)
    // The real destination must carry the agent param. instrumentEmailHtml then
    // wraps it inside a signed click token, so decode the token to inspect.
    const m = out.match(/\/api\/track\/e\/click\?t=([^"]+)/)
    expect(m).toBeTruthy()
    const tok = decodeURIComponent(m![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).toContain('agent=matt-ryan')
  })

  it('applies the open/click tracking wrapper (pixel + wrapped link)', () => {
    const html = '<body><a href="https://ryan-realty.com/account">Manage</a></body>'
    const out = attributeOutbound(html, OPTS)
    // click wrapper
    expect(out).toContain('/api/track/e/click?t=')
    // open pixel
    expect(out).toContain('/api/track/e/open?t=')
    expect(out).toContain('width="1" height="1"')
  })

  it('carries the recipient _fuid into the attributed link', () => {
    const html = '<a href="https://ryan-realty.com/search">All</a>'
    const out = attributeOutbound(html, OPTS)
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).toContain('_fuid=9001')
  })

  it('is idempotent — running twice does not double-encode or break the link', () => {
    const html = '<body><a href="https://ryan-realty.com/homes-for-sale">Browse</a></body>'
    const once = attributeOutbound(html, OPTS)
    const twice = attributeOutbound(once, OPTS)
    expect(twice).toEqual(once)
    // Exactly one agent param, one click wrapper, one open pixel.
    const trackTok = decodeURIComponent(twice.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(trackTok.split('.')[0], 'base64url').toString())
    expect((payload.u.match(/agent=/g) ?? []).length).toBe(1)
    expect((twice.match(/\/api\/track\/e\/click/g) ?? []).length).toBe(1)
    expect((twice.match(/\/api\/track\/e\/open/g) ?? []).length).toBe(1)
  })

  it('degrades safely when brokerSlug is missing — no throw, no agent param, link still valid', () => {
    const html = '<a href="https://ryan-realty.com/homes-for-sale">Browse</a>'
    const out = attributeOutbound(html, { ...OPTS, brokerSlug: '' })
    expect(() => out).not.toThrow()
    // Link is still present and tracked. No agent param (no broker), but _fuid
    // still attaches (recipient identity is independent of broker routing).
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).not.toContain('agent=')
    expect(payload.u).toContain('https://ryan-realty.com/homes-for-sale')
  })

  it('still stamps _pid when brokerSlug and fubPersonId are missing (native identity survives)', () => {
    const html = '<a href="https://ryan-realty.com/homes-for-sale">Browse</a>'
    const out = attributeOutbound(html, { ...OPTS, brokerSlug: '', fubPersonId: null })
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).not.toContain('agent=')
    expect(payload.u).not.toContain('_fuid=')
    expect(payload.u).toContain('_pid=4242')
  })

  it('stamps _pid=<crm person id> alongside _fuid so post-cutover contacts stitch sessions', () => {
    const html = '<a href="https://ryan-realty.com/search">All</a>'
    const out = attributeOutbound(html, OPTS)
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).toContain('_fuid=9001')
    expect(payload.u).toContain('_pid=4242')
  })

  it('stamps _pid even for a contact with no fub_legacy_id (the post-cutover case)', () => {
    const html = '<a href="https://ryan-realty.com/cma/deer-run">Report</a>'
    const out = attributeOutbound(html, { ...OPTS, fubPersonId: null })
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).not.toContain('_fuid=')
    expect(payload.u).toContain('_pid=4242')
  })

  it('skips tracking when personId is missing but still attributes the broker', () => {
    const html = '<a href="https://ryan-realty.com/search">All</a>'
    const out = attributeOutbound(html, { ...OPTS, personId: null })
    expect(out).not.toContain('/api/track/e/')
    expect(out).toContain('agent=matt-ryan')
  })

  it('treats a non-positive personId as no recipient (no tracking)', () => {
    const html = '<a href="https://ryan-realty.com/search">All</a>'
    const out = attributeOutbound(html, { ...OPTS, personId: 0 })
    expect(out).not.toContain('/api/track/e/')
  })

  it('returns empty/non-string input untouched', () => {
    expect(attributeOutbound('', OPTS)).toBe('')
  })

  it('does not attribute admin links', () => {
    const html = '<a href="https://ryan-realty.com/admin/console">Console</a>'
    const out = attributeOutbound(html, { ...OPTS, personId: null })
    expect(out).not.toContain('agent=')
  })
})

describe('attributeUrl', () => {
  it('stamps ?agent=<broker> onto a bare URL (SMS / non-HTML case)', () => {
    const out = attributeUrl('https://ryan-realty.com/cma/deer-run', 'matt-ryan')
    expect(out).toContain('agent=matt-ryan')
  })

  it('stamps _fuid when provided', () => {
    const out = attributeUrl('https://ryan-realty.com/search', 'matt-ryan', 9001)
    expect(out).toContain('_fuid=9001')
  })

  it('is idempotent — second pass adds no second agent param', () => {
    const once = attributeUrl('https://ryan-realty.com/search', 'matt-ryan')
    const twice = attributeUrl(once, 'matt-ryan')
    expect(twice).toBe(once)
    expect((twice.match(/agent=/g) ?? []).length).toBe(1)
  })

  it('degrades safely with a missing brokerSlug — returns the URL unchanged', () => {
    const out = attributeUrl('https://ryan-realty.com/search', '')
    expect(out).toBe('https://ryan-realty.com/search')
  })

  it('returns empty input untouched', () => {
    expect(attributeUrl('', 'matt-ryan')).toBe('')
  })
})
