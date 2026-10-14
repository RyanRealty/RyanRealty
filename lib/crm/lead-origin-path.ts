/**
 * The page that produced a seller lead, read off the submit request's referer.
 *
 * Every valuation link on a content page carries `?from=<its path>`
 * (lib/site/valuation-href.ts, 54 surfaces), and the spine form that link opens
 * (/sell, /sell/valuation) posts through submitSellerLPForm. That action built
 * source_url from the form's own page and never read `from`, so every seller
 * lead recorded /sell as its origin and completed valuations per page, the
 * program's KPI, could not be measured (found 2026-09-29). The written-valuation
 * action that did read it was retired when /sell/valuation moved onto the same
 * form (7c40065ef).
 *
 * Same host only, and only a simple site-relative path (the shape
 * sanitizePagePath accepts), so a cross-site referer or a crafted value cannot
 * write an arbitrary source_url. Anything else keeps the fallback, the form's
 * own page.
 */
export function leadOriginPath(
  referer: string | null | undefined,
  allowedHosts: ReadonlyArray<string | null | undefined>,
  fallback: string,
): string {
  if (!referer) return fallback
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return fallback
  }
  const hosts = allowedHosts.filter((h): h is string => typeof h === 'string' && h.length > 0)
  if (!hosts.includes(url.host)) return fallback
  const from = (url.searchParams.get('from') ?? '').split(/[?#]/)[0]
  return /^\/[a-z0-9\-/]{0,200}$/i.test(from) ? from : fallback
}
