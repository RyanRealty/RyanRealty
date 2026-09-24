/**
 * Pages whose address carries a secret. A signing link (/sign/<token>) opens a
 * person's documents to whoever holds it; a CMA review link (/cma-drafts/<id>?
 * token=) lets its holder send the CMA; an unsubscribe link names the person.
 *
 * On 2026-09-24 a production signing page sent its full address, token
 * included, to the Meta pixel (PageView `dl=`), Google Analytics and Sentry,
 * because every tag in the root layout loads on every route. So: no
 * third-party tag (Google Tag Manager, GA4, the Meta pixel) and no page
 * tracker runs on these pages, and every error report scrubs the secret out
 * first. Held by scripts/check-private-path-tracking.mjs.
 */

const PRIVATE_PREFIXES = ['sign', 'cma-drafts', 'alerts/unsubscribe', 'newsletter/unsubscribe'] as const

/** The first path segment(s) of a page whose address carries a secret. */
export const PRIVATE_PATH_RE = new RegExp(`^/(${PRIVATE_PREFIXES.map((p) => p.replace(/\//g, '\\/')).join('|')})(/|$)`)

export function isPrivatePath(pathname: string | null | undefined): boolean {
  return !!pathname && PRIVATE_PATH_RE.test(pathname)
}

/**
 * The same test for an inline script that runs before React (the Google Tag
 * Manager bootstrap): a JavaScript expression, true on a private page.
 */
export const PRIVATE_PATH_JS = `${PRIVATE_PATH_RE.toString()}.test(location.pathname)`

/** Query parameters that carry a secret or a person's identity token. */
const SECRET_PARAMS = /([?&](?:token|_pid|t|code|key|sig|signature)=)[^&#\s"']+/gi

/**
 * An address, or any text holding one, with its secrets replaced: the signing
 * token in /sign/<token> and the value of every secret-bearing query parameter.
 */
export function scrubPrivateUrls(text: string): string {
  return text
    .replace(/(\/sign\/)[A-Za-z0-9_-]{8,}/g, '$1[token]')
    .replace(SECRET_PARAMS, '$1[redacted]')
}

/**
 * Any plain data (an error report, a breadcrumb) with every secret in it
 * scrubbed. Error reports go to Sentry; the signing page's address was in them.
 */
export function scrubDeep<T>(value: T): T {
  try {
    return JSON.parse(scrubPrivateUrls(JSON.stringify(value))) as T
  } catch {
    return value
  }
}

/**
 * A link to one of our own private pages: sent as written, never wrapped by
 * the email click tracker (which stored the whole link, token and all, in
 * crm_timeline and email_events) and never stamped with identity or UTM
 * parameters.
 */
export function isPrivateLink(url: string): boolean {
  const m = /^https?:\/\/(?:www\.)?ryan-realty\.com(\/[^?#\s"'<]*)?/i.exec(url.trim())
  return !!m && isPrivatePath(m[1] ?? '/')
}
