/**
 * POST /api/cma — Tetherow landing-page lead capture.
 *
 * BUG FIX 2026-05-31: the 5 Tetherow LP forms (buyer showing/alerts/guide,
 * seller multi-step valuation, exit-intent modal) all POST FormData here, but
 * no top-level /api/cma route existed (only /api/cma/[slug]/* for the CMA PDF
 * pipeline), so every submission returned 404 and the lead was silently lost
 * while the form showed a fake green "success." This handler captures the lead
 * into Follow Up Boss (+ Meta CAPI + canonical tags + GA4) and returns 200.
 *
 * Field contract (set by the Tetherow form components):
 *   intent: 'buyer' | 'seller'   name, email, phone
 *   tags: comma-separated context   campaign, resort
 *   seller-only: address, subdivision, timing, bedrooms, bathrooms
 *   buyer-only:  property
 */
import { NextRequest, NextResponse } from 'next/server'
import { submitTetherowLead } from '@/app/actions/lead-capture'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let fd: FormData
  try {
    fd = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid form data' }, { status: 400 })
  }

  const str = (k: string): string | undefined => {
    const v = fd.get(k)
    return typeof v === 'string' && v.trim() ? v.trim() : undefined
  }

  const intent = (str('intent') || '').toLowerCase() === 'seller' ? 'seller' : 'buyer'

  const result = await submitTetherowLead({
    intent,
    name: str('name'),
    email: str('email'),
    phone: str('phone'),
    resort: str('resort'),
    campaign: str('campaign'),
    contextTags: str('tags'),
    address: str('address'),
    subdivision: str('subdivision'),
    timing: str('timing'),
    bedrooms: str('bedrooms'),
    bathrooms: str('bathrooms'),
    property: str('property'),
    pageUrl: req.headers.get('referer') || undefined,
  })

  if (!result.ok) {
    // 502 (not 200) so the client can show an honest error + the call-us number.
    return NextResponse.json({ ok: false, error: result.error ?? 'capture failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
