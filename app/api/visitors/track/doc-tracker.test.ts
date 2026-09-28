/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const src = readFileSync(join(process.cwd(), 'public/rr-doc-tracker.js'), 'utf8')
const TRACKER = join(process.cwd(), 'public/rr-doc-tracker.js')

describe('rr-doc-tracker — in-letter click payload', () => {
  it('posts the destination with identity params stripped', () => {
    expect(src).toContain("eventType: 'cta_click'")
    expect(src).toContain('metadata: { destination: destination }')
    expect(src).toContain("destUrl.searchParams.delete('_pid')")
    expect(src).toContain("destUrl.searchParams.delete('_fuid')")
    expect(src).toMatch(/destination = destUrl\.toString\(\)/)
  })

  it('keeps campaign params on pageUrl and forwards identityToken', () => {
    expect(src).toContain("identityToken: pid || undefined")
    expect(src).toContain("consent: 'essential'")
    expect(src).toContain("var IDENTITY_PARAMS = ['_pid', '_fuid']")
    expect(src).toContain('urlWithoutIdentity')
    expect(src).toContain('trackPageUrl')
    expect(src).not.toMatch(/var cleanUrl = location\.origin \+ location\.pathname/)
    expect(src).toContain('/api/track/e/identify')
  })
})

describe('rr-doc-tracker — page_view payload at essential consent', () => {
  const fetches: Array<{ url: string; body: Record<string, unknown> }> = []

  beforeEach(() => {
    fetches.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        let body: Record<string, unknown> = {}
        try {
          body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        } catch {
          body = {}
        }
        fetches.push({ url: String(url), body })
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response)
      }),
    )
    window.history.replaceState(
      {},
      '',
      '/cma/cma-zz-postland-20260928?utm_source=cma&utm_medium=email&utm_campaign=cma-zz-postland-20260928&utm_content=agent-matt&agent=matt&_pid=tok.signed.abc&_fuid=9',
    )
    localStorage.setItem('rr_session_id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('posts page_view with campaign tags, identityToken, and no identity params on pageUrl', () => {
    // eslint-disable-next-line no-new-func
    Function(readFileSync(TRACKER, 'utf8'))()
    const view = fetches.find((f) => f.body.eventType === 'page_view')
    expect(view).toBeTruthy()
    const pageUrl = String(view!.body.pageUrl)
    const u = new URL(pageUrl, window.location.origin)
    expect(u.pathname).toBe('/cma/cma-zz-postland-20260928')
    expect(u.searchParams.get('utm_source')).toBe('cma')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_campaign')).toBe('cma-zz-postland-20260928')
    expect(u.searchParams.get('utm_content')).toBe('agent-matt')
    expect(u.searchParams.get('agent')).toBe('matt')
    expect(u.searchParams.has('_pid')).toBe(false)
    expect(u.searchParams.has('_fuid')).toBe(false)
    expect(view!.body.identityToken).toBe('tok.signed.abc')
    expect(view!.body.consent).toBe('essential')
  })
})
