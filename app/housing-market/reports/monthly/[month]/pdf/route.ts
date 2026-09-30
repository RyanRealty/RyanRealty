/**
 * GET /housing-market/reports/monthly/<YYYY-MM>/pdf — one edition's PDF.
 *
 * Every page links a report's download here, so the link lives on our domain
 * and keeps working if the file moves. The route checks the month is a
 * published edition with a stored PDF and redirects (302) to the file in the
 * public `market-reports` bucket, asking storage to serve it as an attachment
 * under a readable name (Supabase honors `?download=<name>` by setting
 * Content-Disposition). A malformed month, an unpublished month, or an edition
 * with no file is a 404.
 *
 * THE APP ROUTER ASKS FIRST. A next/link to this URL (the Instrument's action,
 * a Doors door) makes the router fetch it with the `RSC: 1` header before it
 * navigates, and prefetch it on sight in production. There is no RSC payload
 * here, and following our redirect to the storage host from inside that fetch
 * fails CORS and logs an error before the router gives up. So an RSC request
 * gets an empty 204, which the router treats as "not a page" and answers by
 * navigating the browser to this same URL, which then takes the redirect.
 *
 * Data through the DAL only (G1). The published list, not the edition itself:
 * the list row carries the file's path, the anon client reads published rows
 * only, and the list is the one cache entry the archive and every edition page
 * already warm, so a download never pulls a whole payload to find a path.
 * editionPdfObjectUrl builds the public object URL.
 */
import { editionPdfObjectUrl, listPublishedEditions } from '@/lib/data/market-report/editions'
import { editionKey, editionPdfFilename, hasPdf, parseEditionMonth } from '../../_v3/edition-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The request header Next's app router sets on its own fetches (RSC_HEADER in next/dist). */
const RSC_HEADER = 'rsc'

/** A published month's file does not change under its URL; cache the hop for an hour. */
const REDIRECT_CACHE = 'public, max-age=3600, s-maxage=3600'
/** A missing month may be published later today; do not hold the 404 long. */
const MISSING_CACHE = 'public, max-age=0, s-maxage=300'

function missing(): Response {
  return new Response('No published report for that month.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': MISSING_CACHE },
  })
}

export async function GET(request: Request, context: { params: Promise<{ month: string }> }): Promise<Response> {
  if (request.headers.get(RSC_HEADER) === '1') {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  }

  const { month } = await context.params
  const key = parseEditionMonth(month)
  if (!key) return missing()

  const edition = (await listPublishedEditions()).find((item) => editionKey(item) === key)
  if (!edition || !hasPdf(edition)) return missing()

  const objectUrl = editionPdfObjectUrl(edition.pdf_path!)
  if (!objectUrl) {
    // Storage is not configured in this environment: a server fault, not a missing report.
    return new Response('Report storage is not available.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const target = new URL(objectUrl)
  target.searchParams.set('download', editionPdfFilename(key))
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': REDIRECT_CACHE },
  })
}
