/**
 * RFC 8058 one-click unsubscribe endpoint for the Ryan Realty newsletter (NL-H1).
 *
 * The List-Unsubscribe header on every newsletter send points here. Gmail / Yahoo
 * / Apple Mail POST with a `List-Unsubscribe=One-Click` body and expect a 2xx, then
 * mark the sender unsubscribed. Previously the header pointed at the visible RSC
 * page (app/newsletter/unsubscribe), which has no POST handler — the provider's
 * one-click POST hit a 405, the opt-out silently never happened, and the recipient
 * marked us as spam instead (a Gmail/Yahoo bulk-sender violation).
 *
 * POST performs the opt-out via the existing token-keyed DAL and ALWAYS returns 200
 * — even for an unknown/expired token — so we never leak whether a token is valid
 * and never hand back a 405 a bulk-sender scanner reads as a broken one-click.
 *
 * GET is the human path: a person who clicks the List-Unsubscribe URL in their mail
 * client is redirected to the visible confirm page (which unsubscribes on its own
 * POST). A GET must never opt anyone out — a mail-client prefetch of the link would
 * otherwise unsubscribe them without intent.
 *
 * Modeled on app/api/email/unsubscribe/route.ts (the CONTACT360 one-click path).
 */
import { type NextRequest, NextResponse } from 'next/server'
import { unsubscribeNewsletterByToken } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Token from the query string (?token= / ?t=), falling back to the one-click POST form body. */
async function readToken(request: NextRequest): Promise<string> {
  const fromQuery = (request.nextUrl.searchParams.get('token') ?? request.nextUrl.searchParams.get('t') ?? '').trim()
  if (fromQuery) return fromQuery
  // RFC 8058 one-click posts application/x-www-form-urlencoded; some providers put
  // the token in the body rather than the URL.
  try {
    const form = await request.formData()
    const v = form.get('token') ?? form.get('t')
    return typeof v === 'string' ? v.trim() : ''
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  const token = await readToken(request)
  // Best-effort: an unknown token simply matches nothing (matched=false). We never
  // surface validity, and a failed opt-out write must NOT become a 4xx/5xx the
  // provider treats as a broken one-click endpoint — it is logged inside the DAL.
  try {
    await unsubscribeNewsletterByToken(token)
  } catch {
    // swallow — never 405/500 the one-click POST
  }
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  const token = (request.nextUrl.searchParams.get('token') ?? request.nextUrl.searchParams.get('t') ?? '').trim()
  const url = new URL('/newsletter/unsubscribe', request.nextUrl.origin)
  if (token) url.searchParams.set('token', token)
  return NextResponse.redirect(url, 302)
}
