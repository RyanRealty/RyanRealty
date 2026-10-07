/**
 * fetch with ONE retry on a transport error: the request never got an answer
 * (a dropped tunnel, a reset, a timeout), so the call threw instead of
 * returning a response. An HTTP status is an answer and is never retried.
 *
 * The cloud container's egress relay drops about one of six concurrent
 * tunnels to the same host (2026-10-07, `ws_closed_mid_exchange` in the proxy
 * status), and with NODE_USE_ENV_PROXY=1 every fetch in a script crosses it,
 * so deploy:verify died on its first Vercel API call with "fetch failed"
 * while the deploy was READY. Same contract as the sitemap smoke's retry.
 */

export const TRANSPORT_RETRIES = 1
const RETRY_DELAY_MS = 1_000

/**
 * @param {string | URL} url
 * @param {RequestInit} [init]
 * @param {{ retries?: number, retryDelayMs?: number, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithTransportRetry(url, init = {}, opts = {}) {
  const retries = opts.retries ?? TRANSPORT_RETRIES
  const delay = opts.retryDelayMs ?? RETRY_DELAY_MS
  const doFetch = opts.fetchImpl ?? fetch
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delay))
    try {
      return await doFetch(url, init)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}
