/**
 * gate-browser.mjs — ignoreHTTPSErrors is scoped to a proxy env, and every
 * option a caller passes reaches browser.newContext() unchanged. No real
 * Chromium here: a fake `browser` records the options it was given, which is
 * enough to lock the contract this file exists for (CLAUDE.md §6 — a rule
 * worth a gate is worth a test, and this one backs a shared helper three
 * runtime gates now depend on).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openGateContext } from '../lib/gate-browser.mjs'

/** Both spellings matter — see the header comment in gate-browser.mjs. */
const PROXY_ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'SHOT_NO_MEDIA_PROXY']
let saved

beforeEach(() => {
  saved = Object.fromEntries(PROXY_ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const k of PROXY_ENV_KEYS) delete process.env[k]
})

afterEach(() => {
  for (const k of PROXY_ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

/** A fake enough to prove the contract: what options newContext saw, and that
 *  the returned context is routable (installRemoteMediaProxy calls .route()). */
function fakeBrowser() {
  const contexts = []
  return {
    contexts,
    async newContext(options) {
      const routes = []
      const record = { options, routes }
      contexts.push(record)
      return {
        async route(pattern, handler) {
          routes.push({ pattern, handler })
        },
      }
    },
  }
}

describe('openGateContext — ignoreHTTPSErrors', () => {
  it('is NOT set on an ordinary machine (no proxy env var)', async () => {
    const browser = fakeBrowser()
    await openGateContext(browser, {
      baseUrl: 'http://127.0.0.1:3401',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    })
    expect(browser.contexts).toHaveLength(1)
    const opts = browser.contexts[0].options
    expect(opts.ignoreHTTPSErrors).toBeUndefined()
    // Unchanged on a normal machine: the exact same shape newContext got before.
    expect(opts).toEqual({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  })

  it('is set to true when HTTPS_PROXY is set', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.internal:8080'
    const browser = fakeBrowser()
    await openGateContext(browser, { baseUrl: 'https://ryan-realty.com' })
    expect(browser.contexts[0].options.ignoreHTTPSErrors).toBe(true)
  })

  it('is set to true when the lowercase https_proxy is set (same as HTTPS_PROXY)', async () => {
    process.env.https_proxy = 'http://proxy.internal:8080'
    const browser = fakeBrowser()
    await openGateContext(browser, { baseUrl: 'https://ryan-realty.com' })
    expect(browser.contexts[0].options.ignoreHTTPSErrors).toBe(true)
  })

  it('goes back to unset once the proxy env is cleared', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.internal:8080'
    const proxied = fakeBrowser()
    await openGateContext(proxied, { baseUrl: 'https://ryan-realty.com' })
    expect(proxied.contexts[0].options.ignoreHTTPSErrors).toBe(true)

    delete process.env.HTTPS_PROXY
    const unproxied = fakeBrowser()
    await openGateContext(unproxied, { baseUrl: 'https://ryan-realty.com' })
    expect(unproxied.contexts[0].options.ignoreHTTPSErrors).toBeUndefined()
  })
})

describe('openGateContext — every other option passes through unchanged', () => {
  it('forwards viewport, userAgent and deviceScaleFactor as given', async () => {
    const browser = fakeBrowser()
    await openGateContext(browser, {
      baseUrl: 'http://127.0.0.1:3000',
      viewport: { width: 1440, height: 900 },
      userAgent: 'rr-ci-probe/1.0',
      deviceScaleFactor: 2,
    })
    expect(browser.contexts[0].options).toEqual({
      viewport: { width: 1440, height: 900 },
      userAgent: 'rr-ci-probe/1.0',
      deviceScaleFactor: 2,
    })
  })

  it('omits an option the caller did not pass rather than sending it as undefined', async () => {
    const browser = fakeBrowser()
    await openGateContext(browser, { baseUrl: 'http://127.0.0.1:3000', viewport: { width: 390, height: 844 } })
    expect('userAgent' in browser.contexts[0].options).toBe(false)
    expect('deviceScaleFactor' in browser.contexts[0].options).toBe(false)
  })

  it('requires baseUrl — it is how the media proxy scopes same-origin vs cross-origin', async () => {
    const browser = fakeBrowser()
    await expect(openGateContext(browser, {})).rejects.toThrow(/baseUrl/)
  })
})

describe('openGateContext — media proxy installation', () => {
  it('installs a same-origin-aware route on the returned context and reports mediaStats', async () => {
    const browser = fakeBrowser()
    const { context, mediaStats } = await openGateContext(browser, { baseUrl: 'http://127.0.0.1:3401' })
    expect(browser.contexts[0].routes).toHaveLength(1)
    expect(browser.contexts[0].routes[0].pattern).toBe('**/*')
    expect(context).toBeDefined()
    expect(mediaStats).toEqual({ served: 0 })
  })
})
