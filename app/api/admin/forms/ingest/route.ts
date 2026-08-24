/**
 * POST /api/admin/forms/ingest  (handoff docs/TC_FORMS_LOADING_HANDOFF.md §4 Step 2)
 *
 * The in-page SkySlope Forms loader (run in Matt's authed Chrome) POSTs blank
 * PDFs + their field metadata here. We decode, hash, store the blank, translate
 * SkySlope fields → our field_map, and idempotently upsert tc_form_versions.
 *
 * Cross-origin (called from https://forms.skyslope.com), so the admin session
 * cookie does NOT ride — auth is a constant-time bearer secret (TC_FORMS_INGEST_SECRET).
 * The SkySlope JWT never leaves the browser; only PDFs + metadata reach us.
 *
 * Idempotent: keyed on source_version_id (unique index). Re-running is safe.
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { ingestLicensedBlankPdf } from '@/lib/data/tc/ingest-licensed-blank'
import type { SkySlopeSourceField, SkySlopeSourcePage } from '@/lib/tc/skyslope-field-map'

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

interface IngestBody {
  libraryCode: string
  libraryName?: string
  region?: string
  formNumber?: string
  name: string
  sourceFormId?: string
  sourceVersionId: string
  versionLabel?: string
  status?: string
  pageCount?: number
  effectiveDate?: string
  pdfBase64: string
  sourceFields?: { fields?: SkySlopeSourceField[]; pages?: SkySlopeSourcePage[] }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: CORS })
  }

  let body: IngestBody
  try {
    body = (await request.json()) as IngestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400, headers: CORS })
  }
  if (!body.libraryCode || !body.name || !body.sourceVersionId || !body.pdfBase64) {
    return NextResponse.json({ ok: false, error: 'missing libraryCode/name/sourceVersionId/pdfBase64' }, { status: 422, headers: CORS })
  }

  const result = await ingestLicensedBlankPdf({
    libraryCode: body.libraryCode,
    libraryName: body.libraryName,
    region: body.region,
    formNumber: body.formNumber,
    name: body.name,
    sourceFormId: body.sourceFormId,
    sourceVersionId: body.sourceVersionId,
    versionLabel: body.versionLabel,
    pageCount: body.pageCount,
    effectiveDate: body.effectiveDate,
    pdf: Buffer.from(body.pdfBase64, 'base64'),
    sourceFields: body.sourceFields,
  })
  if (!result.ok) {
    const status = result.error.startsWith('storage:') || result.error.startsWith('library:') || result.error.startsWith('update:') || result.error.startsWith('insert:') ? 500 : 422
    return NextResponse.json({ ok: false, error: result.error }, { status, headers: CORS })
  }
  return NextResponse.json(
    { ok: true, formVersionId: result.formVersionId, sha256: result.sha256, fields: result.fields },
    { headers: CORS },
  )
}
