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
 * Run `attempt` with ONE retry when it throws. `attempt` runs fresh each time,
 * so it can open its own timeout and read its own body: a read that drops
 * mid-body is a transport error too. Whatever answer it returns, any HTTP
 * status included, is the caller's to judge and is never retried.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} attempt
 * @param {{ retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withTransportRetry(attempt, opts = {}) {
  const retries = opts.retries ?? TRANSPORT_RETRIES
  const delay = opts.retryDelayMs ?? RETRY_DELAY_MS
  let lastError
  for (let i = 0; i <= retries; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delay))
    try {
      return await attempt(i)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

/**
 * @param {string | URL} url
 * @param {RequestInit} [init]
 * @param {{ retries?: number, retryDelayMs?: number, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithTransportRetry(url, init = {}, opts = {}) {
  const doFetch = opts.fetchImpl ?? fetch
  return withTransportRetry(() => doFetch(url, init), opts)
}
