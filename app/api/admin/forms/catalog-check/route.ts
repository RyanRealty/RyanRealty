/**
 * POST /api/admin/forms/catalog-check
 *
 * Optional automation path for the same catalog apply as the /admin/forms
 * paste box. Cross-origin from SkySlope Forms, so auth is the ingest bearer
 * (TC_FORMS_INGEST_SECRET). The SkySlope JWT never leaves the browser.
 *
 * Body: one library { libraryCode, forms[] } or { libraries: [...] }.
 * Metadata only. No PDF.
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { applyFormCatalogSnapshots } from '@/lib/data/tc/form-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOW_ORIGIN = 'https://forms.skyslope.com'
const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function authorized(request: Request): boolean {
  const secret = process.env.TC_FORMS_INGEST_SECRET?.trim()
  if (!secret) return false
  const got = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!got) return false
  const a = Buffer.from(got)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: CORS })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400, headers: CORS })
  }

  const result = await applyFormCatalogSnapshots(body, 'catalog-check-api')
  if (result.error || !result.data) {
    return NextResponse.json({ ok: false, error: result.error ?? 'apply failed' }, { status: 422, headers: CORS })
  }
  return NextResponse.json({ ok: true, ...result.data }, { headers: CORS })
}
