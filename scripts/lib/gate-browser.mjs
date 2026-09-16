/**
 * gate-browser.mjs — one Playwright context, opened the same way, for every
 * runtime gate that renders a real page.
 *
 * WHY (verified 2026-09-15). Two separate failures compound in a cloud
 * sandbox where outbound HTTPS goes through an agent proxy (HTTPS_PROXY set,
 * CA bundle at /root/.ccr/ca-bundle.crt):
 *
 *   1. Headless Chromium does not trust that CA the way Node itself does.
 *      `page.goto('https://ryan-realty.com')` dies
 *      `net::ERR_CERT_AUTHORITY_INVALID` even though Node's own `fetch` and a
 *      plain `curl` answer 200 through the identical proxy. Any gate that can
 *      be pointed at a live https origin — check-route-content-floor.mjs
 *      `--seed`, or a *_BASE_URL env var aimed at production — cannot
 *      navigate there at all without this.
 *   2. `new Image().src = <Spark CDN url>` (or a Supabase-storage hero) fires
 *      `onerror` inside the page for the same underlying reason: the in-page
 *      fetch does not take the trusted path either. A page that renders
 *      listing photos or broker headshots collapses those images to their
 *      broken-image box, which moves layout and can move the size of a
 *      control measured next to, or wrapping, one of them. This is true
 *      REGARDLESS of whether the page itself is local or remote — the photos
 *      are cross-origin CDN URLs either way.
 *      scripts/lib/remote-media-proxy.mjs fixes this by fetching the image in
 *      Node (where the proxy IS trusted) and fulfilling the same bytes into
 *      the browser.
 *
 * check-route-content-floor.mjs carried both fixes inline (it MEASURES
 * IMAGES and it can be pointed at a live production host); check-tap-targets
 * .mjs carried neither, even though its routes render listing photos and
 * team headshots from the same external CDNs. Wiring each gate by hand is
 * how a new gate ships with neither fix and reports a collapsed hero, or a
 * dead production probe, as if the page itself were broken. One call, one
 * place to fix it next time.
 *
 * (check-page-payload-budget.mjs does not use Playwright at all — it fetches
 * raw HTML bytes with `fetch()` against a local `next start` server — so it
 * has no context to open through this helper and is not a caller.)
 *
 * `ignoreHTTPSErrors` is scoped to when it is actually needed: only when
 * HTTPS_PROXY or https_proxy is set. An ordinary developer machine, or a CI
 * runner with normal network access, has neither var set, so
 * `openGateContext` there produces the exact `browser.newContext(...)` call
 * these gates made before this file existed — nothing changes off the proxy.
 */

import { installRemoteMediaProxy } from './remote-media-proxy.mjs'

/**
 * @param {import('playwright').Browser} browser
 * @param {object} options
 * @param {string} options.baseUrl  Origin of the page(s) this context will
 *   navigate to. Required — it is how the media proxy tells a same-origin
 *   request (leave it alone) from a cross-origin CDN fetch (serve it from
 *   Node). Never navigate this context to a different origin than the one
 *   passed here.
 * @param {{width:number,height:number}} [options.viewport]
 * @param {string} [options.userAgent]
 * @param {number} [options.deviceScaleFactor]
 * @returns {Promise<{context: import('playwright').BrowserContext, mediaStats: {served:number}}>}
 */
export async function openGateContext(browser, options = {}) {
  const { baseUrl, viewport, userAgent, deviceScaleFactor } = options
  if (!baseUrl) {
    throw new Error('openGateContext requires { baseUrl } — it scopes the media proxy to cross-origin requests.')
  }

  const contextOptions = {}
  if (viewport) contextOptions.viewport = viewport
  if (userAgent) contextOptions.userAgent = userAgent
  if (deviceScaleFactor !== undefined) contextOptions.deviceScaleFactor = deviceScaleFactor
  // See WHY #1 above. A machine with no proxy configured never sets this.
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    contextOptions.ignoreHTTPSErrors = true
  }

  const context = await browser.newContext(contextOptions)
  const mediaStats = await installRemoteMediaProxy(context, new URL(baseUrl).origin)
  return { context, mediaStats }
}
