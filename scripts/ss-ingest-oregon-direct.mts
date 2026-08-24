import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { fieldMapFromAcroFormPdf } from '../lib/tc/acroform-field-map.ts'
import { fallbackSigningStack } from '../lib/tc/fallback-signing-stack.ts'

const env: Record<string, string> = {}
for (const ln of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = ln.indexOf('=')
  if (i < 1 || ln.startsWith('#')) continue
  env[ln.slice(0, i)] = ln.slice(i + 1).replace(/^["']|["']$/g, '')
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

type Row = {
  id: number
  formId: number
  libraryId: number
  code: string
  name: string
  pageCount: number | null
  previewUrl: string
}

const forms = JSON.parse(readFileSync('tmp/ss-cat-0.json', 'utf8')) as Row[]
const { data: libs } = await sb.from('tc_form_libraries').select('id, code')
const libId = new Map((libs ?? []).map((l) => [String(l.code), String(l.id)]))

function parseNum(name: string): string | null {
  const a = name.match(/OREF[- ]?(\d{3}[A-Z]{0,3})/i)
  if (a) return a[1].toUpperCase()
  const b = name.match(/\b(\d{3}[A-Z]{0,3})\s*[-–]?\s*OREF/i)
  if (b) return b[1].toUpperCase()
  return null
}

let ok = 0
let fail = 0
let acro = 0
for (const f of forms) {
  const libraryId = libId.get(f.code)
  if (!libraryId) {
    fail++
    console.log('no lib', f.code)
    continue
  }
  try {
    const { data: existing } = await sb
      .from('tc_form_versions')
      .select('id')
      .eq('source_version_id', String(f.id))
      .maybeSingle()
    const pdfRes = await fetch(f.previewUrl)
    if (!pdfRes.ok) throw new Error(`pdf ${pdfRes.status}`)
    const buf = Buffer.from(await pdfRes.arrayBuffer())
    if (buf.byteLength < 500) throw new Error(`tiny ${buf.byteLength}`)
    const sha256 = createHash('sha256').update(buf).digest('hex')
    const path = `${f.code.toLowerCase()}/${f.id}__${sha256.slice(0, 12)}.pdf`
    const up = await sb.storage.from('tc-forms').upload(path, buf, { contentType: 'application/pdf', upsert: true })
    if (up.error) throw new Error(`storage ${up.error.message}`)
    let pageCount = f.pageCount
    try {
      pageCount = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount()
    } catch {
      /* keep listed */
    }
    let map = await fieldMapFromAcroFormPdf(new Uint8Array(buf)).catch(() => [])
    let source = 'acroform'
    if (map.length) acro++
    else {
      source = 'fallback_stack'
      map = fallbackSigningStack({
        pageCount: pageCount || 1,
        formNumber: parseNum(f.name),
        documentName: f.name,
      })
    }
    const row = {
      library_id: libraryId,
      form_number: parseNum(f.name),
      name: f.name,
      blank_pdf_storage_path: path,
      sha256,
      page_count: pageCount,
      field_map: map,
      field_map_source: source,
      source_form_id: String(f.formId),
      source_version_id: String(f.id),
      source_checked_at: new Date().toISOString(),
      update_available: false,
      retired_at: null,
      updated_at: new Date().toISOString(),
    }
    if (existing?.id) {
      const { error } = await sb.from('tc_form_versions').update(row).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await sb.from('tc_form_versions').insert(row)
      if (error) throw error
    }
    ok++
    if (ok % 25 === 0) console.log('ok', ok, 'acro', acro, f.code, f.name.slice(0, 36))
  } catch (e) {
    fail++
    console.log('fail', f.code, f.id, String(e).slice(0, 160))
  }
}
console.log({ ok, fail, acro, total: forms.length })
