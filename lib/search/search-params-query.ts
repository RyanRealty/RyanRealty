/**
 * A page's awaited `searchParams` as the query string the URL store carries
 * (SITE-29). Server-safe and pure: a dynamic page passes the result to
 * UrlSearchParamsProvider so the split view's server render and hydration
 * read the request's query. Repeated keys stay repeated; undefined drops.
 */
export type AwaitedSearchParams = Record<string, string | string[] | undefined>

export function queryStringFromSearchParams(sp: AwaitedSearchParams | null | undefined): string {
  if (!sp) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue
    if (Array.isArray(value)) for (const v of value) params.append(key, v)
    else params.append(key, value)
  }
  return params.toString()
}
