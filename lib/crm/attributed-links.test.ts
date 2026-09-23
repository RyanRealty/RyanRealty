import { describe, it, expect } from 'vitest'
import { attributeOutbound, attributeUrl } from './attributed-links'
import { signPersonLinkToken, verifyPersonLinkToken } from '@/lib/identity/link-token'

// P7 identity loop (2026-09-23): the recipient rides as a SIGNED `_pid` token
// minted by lib/identity/outbound-links.ts; the retired `_fuid` is no longer
// stamped once a native person id is known (an unsigned id identifies nobody).
const TOKEN = signPersonLinkToken(4242, 'newsletter')

const OPTS = {
  brokerSlug: 'matt-ryan',
  personId: 4242,
  fubPersonId: 9001,
  emailKey: 'newsletter:abc',
  label: 'Your Bend market update',
}

describe('attributeOutbound', () => {
  it('adds broker UTMs when the destination has none', () => {
    const html = '<a href="https://ryan-realty.com/homes-for-sale">Browse</a>'
    const out = attributeOutbound(html, OPTS)
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString()) as { u: string }
    const u = new URL(payload.u)
    expect(u.searchParams.get('utm_source')).toBe('crm')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_content')).toBe('agent-matt-ryan')
    expect(u.searchParams.get('agent')).toBe('matt-ryan')
  })

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

  it('carries the recipient as a signed token, not the retired _fuid', () => {
    const html = '<a href="https://ryan-realty.com/search">All</a>'
    const out = attributeOutbound(html, OPTS)
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).not.toContain('_fuid=')
    expect(verifyPersonLinkToken(new URL(payload.u).searchParams.get('_pid'))).toEqual({
      personId: 4242,
      channel: 'newsletter',
    })
  })

  it('appends attribution params BEFORE a #fragment, never inside the hash', () => {
    // The market-report CTA carries UTMs + a #market-report anchor
    // (conversion-audit #2/#8). Params landing after the hash would be
    // invisible to the server — the agent cookie and identity stitch would
    // silently fail on every anchored link.
    const html =
      '<a href="https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report#market-report">Report</a>'
    const out = attributeOutbound(html, OPTS)
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).toBe(
      `https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report&agent=matt-ryan&_pid=${TOKEN}&utm_content=agent-matt-ryan#market-report`,
    )
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
    // Link is still present and tracked. No agent param (no broker); the
    // signed recipient token still attaches (identity is independent of routing).
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
    expect(payload.u).toContain(`_pid=${TOKEN}`)
  })

  it('stamps the signed _pid token and never a bare id, so the click identifies only the recipient', () => {
    const html = '<a href="https://ryan-realty.com/search">All</a>'
    const out = attributeOutbound(html, OPTS)
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).toContain(`_pid=${TOKEN}`)
    expect(payload.u).not.toMatch(/_pid=4242(&|$)/)
  })

  it('stamps _pid even for a contact with no fub_legacy_id (the post-cutover case)', () => {
    const html = '<a href="https://ryan-realty.com/cma/deer-run">Report</a>'
    const out = attributeOutbound(html, { ...OPTS, fubPersonId: null })
    const tok = decodeURIComponent(out.match(/\/api\/track\/e\/click\?t=([^"]+)/)![1])
    const payload = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString())
    expect(payload.u).not.toContain('_fuid=')
    expect(payload.u).toContain(`_pid=${signPersonLinkToken(4242, 'newsletter')}`)
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
    expect(out).toContain('utm_content=agent-matt-ryan')
  })

  it('preserves pre-existing utm_* on a bare URL and still adds the broker content tag', () => {
    const out = attributeUrl(
      'https://ryan-realty.com/search?utm_source=ryan-realty&utm_medium=email&utm_campaign=listing-alerts',
      'matt-ryan',
    )
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('ryan-realty')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_campaign')).toBe('listing-alerts')
    expect(u.searchParams.get('utm_content')).toBe('agent-matt-ryan')
    expect(u.searchParams.get('agent')).toBe('matt-ryan')
  })

  it('never stamps the retired _fuid, even when a legacy id is passed', () => {
    const out = attributeUrl('https://ryan-realty.com/search', 'matt-ryan', 9001)
    expect(out).not.toContain('_fuid')
    expect(out).toContain('agent=matt-ryan')
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
