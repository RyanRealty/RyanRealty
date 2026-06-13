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
import { createHash, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { translateSkyslopeFields, summarizeMap, type SkySlopeSourceField, type SkySlopeSourcePage } from '@/lib/tc/skyslope-field-map'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = process.env.TC_FORMS_BUCKET ?? 'tc-forms'
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

function slugify(s: string): string {
  return (s || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
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

  const sb = createServiceClient()

  // 1. PDF → bytes + sha256
  const pdf = Buffer.from(body.pdfBase64, 'base64')
  if (pdf.byteLength < 100) {
    return NextResponse.json({ ok: false, error: 'pdf decode too small' }, { status: 422, headers: CORS })
  }
  const sha256 = createHash('sha256').update(pdf).digest('hex')

  // 2. upload the blank (idempotent path)
  const path = `${slugify(body.libraryCode)}/${body.sourceVersionId}__${slugify(body.name)}.pdf`
  const up = await sb.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: true })
  if (up.error) {
    return NextResponse.json({ ok: false, error: `storage: ${up.error.message}` }, { status: 500, headers: CORS })
  }

  // 3. library row (find or create by code)
  let libraryId: string
  const { data: existingLib } = await sb.from('tc_form_libraries').select('id').eq('code', body.libraryCode).maybeSingle()
  if (existingLib?.id) {
    libraryId = existingLib.id as string
  } else {
    const { data: newLib, error: libErr } = await sb
      .from('tc_form_libraries')
      .insert({ code: body.libraryCode, name: body.libraryName ?? body.libraryCode, region: body.region ?? 'US-OR' })
      .select('id')
      .single()
    if (libErr || !newLib) {
      return NextResponse.json({ ok: false, error: `library: ${libErr?.message ?? 'insert failed'}` }, { status: 500, headers: CORS })
    }
    libraryId = newLib.id as string
  }

  // 4. translate fields → field_map
  const fieldMap = translateSkyslopeFields(body.sourceFields?.fields, body.sourceFields?.pages)

  // 5. idempotent upsert on source_version_id
  const { data: row, error: upsertErr } = await sb
    .from('tc_form_versions')
    .upsert(
      {
        library_id: libraryId,
        form_number: body.formNumber ?? null,
        name: body.name,
        effective_date: body.effectiveDate ?? null,
        blank_pdf_storage_path: path,
        sha256,
        page_count: body.pageCount ?? null,
        field_map: fieldMap,
        field_map_source: 'skyslope',
        source_form_id: body.sourceFormId ?? null,
        source_version_id: body.sourceVersionId,
        version_label: body.versionLabel ?? null,
        source_fields: body.sourceFields ?? null,
        source_checked_at: new Date().toISOString(),
        update_available: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_version_id' },
    )
    .select('id')
    .single()
  if (upsertErr || !row) {
    return NextResponse.json({ ok: false, error: `upsert: ${upsertErr?.message ?? 'failed'}` }, { status: 500, headers: CORS })
  }

  return NextResponse.json(
    { ok: true, formVersionId: row.id, sha256, fields: summarizeMap(fieldMap) },
    { headers: CORS },
  )
}
