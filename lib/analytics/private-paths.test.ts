import { describe, expect, it } from 'vitest'
import { isPrivatePath, PRIVATE_PATH_JS, scrubDeep, scrubPrivateUrls } from './private-paths'

describe('pages whose address carries a secret', () => {
  it('are the signing link, the CMA review link and the unsubscribe pages, and nothing else', () => {
    for (const p of ['/sign/Yi4wyKxKtxZNhijQFu1lKJu9WWofkfJNdzW0bFkwtpc', '/sign', '/cma-drafts/42', '/alerts/unsubscribe', '/newsletter/unsubscribe']) expect(isPrivatePath(p)).toBe(true)
    for (const p of ['/', '/signing', '/admin/signing/abc', '/listings/123', '/sign-up', null, undefined]) expect(isPrivatePath(p)).toBe(false)
  })

  it('are tested the same way by the inline script that runs before React', () => {
    const run = (pathname: string) => new Function('location', `return ${PRIVATE_PATH_JS}`)({ pathname }) as boolean
    expect(run('/sign/abcdefgh12345678')).toBe(true)
    expect(run('/homes-for-sale/bend')).toBe(false)
  })
})

describe('scrubbing an address before it leaves', () => {
  it('replaces the signing token and every secret query value', () => {
    expect(scrubPrivateUrls('https://ryan-realty.com/sign/Yi4wyKxKtxZNhijQFu1lKJu9WWofkfJNdzW0bFkwtpc')).toBe('https://ryan-realty.com/sign/[token]')
    expect(scrubPrivateUrls('/cma-drafts/42?token=abc.def&x=1')).toBe('/cma-drafts/42?token=[redacted]&x=1')
    expect(scrubPrivateUrls('/?_pid=17.email.9f8e')).toBe('/?_pid=[redacted]')
    expect(scrubPrivateUrls('/admin/signing/0a65e09b-2fc9-447e-a4fc-a231030ee60f')).toBe('/admin/signing/0a65e09b-2fc9-447e-a4fc-a231030ee60f')
  })

  it('reaches every string in an error report', () => {
    const event = { request: { url: 'https://ryan-realty.com/sign/Yi4wyKxKtxZNhijQFu1lKJu9WWofkfJNdzW0bFkwtpc' }, breadcrumbs: [{ data: { to: '/sign/Yi4wyKxKtxZNhijQFu1lKJu9WWofkfJNdzW0bFkwtpc?t=1' } }], level: 'error' }
    const out = scrubDeep(event)
    expect(JSON.stringify(out)).not.toContain('Yi4wyKxKtx')
    expect(out.level).toBe('error')
  })
})

describe('a link to a private page', () => {
  it('is recognised by its path on any host', async () => {
    const { isPrivateLink } = await import('./private-paths')
    expect(isPrivateLink('https://ryan-realty.com/sign/Yi4wyKxKtxZNhijQFu1lKJu9WWofkfJNdzW0bFkwtpc')).toBe(true)
    expect(isPrivateLink('https://www.ryan-realty.com/cma-drafts/42?token=abc')).toBe(true)
    // The invite is built from the configured site address, which is not
    // always ryan-realty.com (a preview host): found by a real invite on 2026-09-24.
    expect(isPrivateLink('https://preview.example.test/sign/3psJsYbzQX3s_M-n6OYpQny3196FFVGwSi8tE_7RnkA')).toBe(true)
    expect(isPrivateLink('https://example.com/sign/abcdefgh12345678')).toBe(true)
    expect(isPrivateLink('https://ryan-realty.com/homes-for-sale/bend')).toBe(false)
    expect(isPrivateLink('https://preview.example.test/homes-for-sale/bend')).toBe(false)
    expect(isPrivateLink('mailto:matt@ryan-realty.com')).toBe(false)
  })
})
