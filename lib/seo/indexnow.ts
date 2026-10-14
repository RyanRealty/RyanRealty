/**
 * IndexNow: tell Bing (and the answer engines that search through it,
 * ChatGPT search and Copilot among them) that a page is new or changed, so it
 * is recrawled in minutes instead of whenever the crawler next comes by.
 * Protocol: https://www.indexnow.org/documentation. One POST to
 * api.indexnow.org reaches every participating engine.
 *
 * THE KEY IS PUBLIC BY PROTOCOL. It is not a secret: it proves we own the
 * host, and the engines read it from https://ryan-realty.com/<key>.txt
 * (public/<key>.txt, a static file). Anyone may fetch it. Changing it means
 * renaming that file in the same commit.
 *
 * Rules this module holds (unit-tested in indexnow.test.ts):
 *   - only absolute https://ryan-realty.com URLs are sent; anything else is dropped
 *   - URLs are deduplicated, and sent at most 10,000 per request
 *   - each request has a short timeout
 *   - it never throws: it returns a result and logs failures
 *   - it does nothing unless VERCEL_ENV is 'production', or INDEXNOW_OPT_IN=1
 *     is set for a deliberate manual run; INDEXNOW_DISABLED=1 turns it off
 *   - 200 and 202 are success; 400, 403, 422, 429 and anything else are logged failures
 *
 * Callers submit only pages that changed (data/seo/decisions.json
 * "indexnow-key-file"; docs/SEO.md "IndexNow"). Never submit the whole site
 * or a batch of unchanged URLs: the engines throttle hosts that do.
 */

import { CANONICAL_SITE_HOST, CANONICAL_SITE_ORIGIN } from '@/lib/site-origin'

/** The IndexNow key. Public by protocol; served at INDEXNOW_KEY_LOCATION. */
export const INDEXNOW_KEY = '57e3ce8d73feb1a7a4cc377fca754c46'

/** Where the engines verify the key: a static file in public/. */
export const INDEXNOW_KEY_LOCATION = `${CANONICAL_SITE_ORIGIN}/${INDEXNOW_KEY}.txt`

/** The shared IndexNow endpoint; it forwards to every participating engine. */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/** Protocol maximum URLs per POST. */
export const INDEXNOW_BATCH_SIZE = 10_000

/** Per-request timeout. A slow engine must never hold up a sync or a save. */
export const INDEXNOW_TIMEOUT_MS = 5_000

export type IndexNowEnv = {
  VERCEL_ENV?: string
  INDEXNOW_OPT_IN?: string
  INDEXNOW_DISABLED?: string
}

export type IndexNowBatch = {
  urls: number
  status: number | null
  ok: boolean
  error?: string
}

export type IndexNowResult = {
  /** True when every batch was accepted, or there was nothing to send. */
  ok: boolean
  /** Why nothing was sent, when nothing was. */
  skipped: 'disabled' | 'empty' | null
  /** URLs the engines accepted (200/202). */
  submitted: number
  /** Inputs that were not absolute https://ryan-realty.com URLs. */
  dropped: number
  batches: IndexNowBatch[]
}

export type SubmitIndexNowOptions = {
  env?: IndexNowEnv
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** Production, or a deliberate manual run; never when the kill switch is on. */
export function indexNowEnabled(env: IndexNowEnv = process.env as IndexNowEnv): boolean {
  if (env.INDEXNOW_DISABLED === '1') return false
  return env.VERCEL_ENV === 'production' || env.INDEXNOW_OPT_IN === '1'
}

/**
 * Keep only absolute https URLs on the canonical host, normalized (no
 * fragment) and deduplicated in first-seen order.
 */
export function normalizeIndexNowUrls(urls: Iterable<string | null | undefined>): { kept: string[]; dropped: number } {
  const kept: string[] = []
  const seen = new Set<string>()
  let dropped = 0
  for (const raw of urls) {
    const value = typeof raw === 'string' ? raw.trim() : ''
    let url: URL | null = null
    try {
      url = value ? new URL(value) : null
    } catch {
      url = null
    }
    if (
      !url ||
      url.protocol !== 'https:' ||
      url.hostname !== CANONICAL_SITE_HOST ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      dropped++
      continue
    }
    url.hash = ''
    const href = url.href
    if (seen.has(href)) continue
    seen.add(href)
    kept.push(href)
  }
  return { kept, dropped }
}

/** The absolute IndexNow URL for a root-relative site path. */
export function indexNowUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${CANONICAL_SITE_ORIGIN}${p}`
}

async function postBatch(urlList: string[], fetchImpl: typeof fetch, timeoutMs: number): Promise<IndexNowBatch> {
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: CANONICAL_SITE_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 200 || res.status === 202) return { urls: urlList.length, status: res.status, ok: true }
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      detail = ''
    }
    return { urls: urlList.length, status: res.status, ok: false, error: indexNowStatusMeaning(res.status, detail) }
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return { urls: urlList.length, status: null, ok: false, error: message }
  }
}

/** What a non-success status means, per the protocol documentation. */
export function indexNowStatusMeaning(status: number, detail = ''): string {
  const meaning =
    status === 400
      ? 'bad request'
      : status === 403
        ? 'key not valid (key file missing or wrong)'
        : status === 422
          ? 'URLs do not belong to the host, or the key does not match'
          : status === 429
            ? 'too many requests (throttled)'
            : 'unexpected response'
  return detail ? `${meaning}: ${detail}` : meaning
}

/**
 * Submit changed URLs. Never throws; a failure is logged and reported in the
 * result, so a caller can fire this after its own write without guarding it.
 */
export async function submitIndexNow(
  urls: Iterable<string | null | undefined>,
  opts: SubmitIndexNowOptions = {},
): Promise<IndexNowResult> {
  const result: IndexNowResult = { ok: true, skipped: null, submitted: 0, dropped: 0, batches: [] }
  try {
    if (!indexNowEnabled(opts.env)) {
      result.skipped = 'disabled'
      return result
    }
    const { kept, dropped } = normalizeIndexNowUrls(urls)
    result.dropped = dropped
    if (dropped > 0) console.warn(`[indexnow] dropped ${dropped} URL(s) not on ${CANONICAL_SITE_ORIGIN}`)
    if (kept.length === 0) {
      result.skipped = 'empty'
      return result
    }
    const fetchImpl = opts.fetchImpl ?? fetch
    const timeoutMs = opts.timeoutMs ?? INDEXNOW_TIMEOUT_MS
    for (let i = 0; i < kept.length; i += INDEXNOW_BATCH_SIZE) {
      const batch = await postBatch(kept.slice(i, i + INDEXNOW_BATCH_SIZE), fetchImpl, timeoutMs)
      result.batches.push(batch)
      if (batch.ok) result.submitted += batch.urls
      else {
        result.ok = false
        console.error(`[indexnow] ${batch.urls} URL(s) not accepted (HTTP ${batch.status ?? 'none'}): ${batch.error}`)
      }
    }
    if (result.submitted > 0) console.log(`[indexnow] submitted ${result.submitted} URL(s)`)
    return result
  } catch (err) {
    console.error('[indexnow] submit failed', err instanceof Error ? err.message : err)
    return { ...result, ok: false }
  }
}
