#!/usr/bin/env node
/**
 * TC SYSTEM — form template importer.
 *
 * Takes a BLANK form PDF (OREF / ODS / OR — obtained under Matt's member
 * access, never redistributed), extracts its AcroForm field map where present,
 * uploads the blank to Storage, and writes a tc_form_versions row.
 *
 * Field-type inference:
 *   - PDF field type 'signature'            -> signature
 *   - name matches /sign/i + /initial/i     -> signature / initials
 *   - name matches /date/i                  -> date
 *   - checkbox/radio                        -> checkbox
 *   - everything else                       -> text
 * Signer-role guessing from field names (buyer1/buyer2/seller1/seller2/broker)
 * is a starting point — review in the composer UI before first send.
 *
 * Usage:
 *   node --env-file=.env.local scripts/tc-import-form-template.mjs \
 *     --pdf="/path/to/OREF-001 Residential Real Estate Sale Agreement.pdf" \
 *     --library=OREF --form-number=001 --name="Residential Real Estate Sale Agreement" \
 *     [--effective=2026-01-01] [--signer-profile=mutual] [--checklist-hint="Residential Sale Agreement"]
 *
 * Requires tc_form_libraries / tc_form_versions (migration 20260610020000).
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const arg = (n, d = null) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.slice(n.length + 3) : d
}
const PDF = arg('pdf')
const LIBRARY = arg('library')
const FORM_NUMBER = arg('form-number')
const NAME = arg('name')
const EFFECTIVE = arg('effective')
const SIGNER_PROFILE = arg('signer-profile')
const CHECKLIST_HINT = arg('checklist-hint')

if (!PDF || !LIBRARY || !NAME) {
  console.error('Usage: --pdf=<path> --library=OREF|ODS|OR|RR --name="..." [--form-number=001] [--effective=YYYY-MM-DD] [--signer-profile=mutual|single_party] [--checklist-hint="..."]')
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function inferType(pdfType, name) {
  const n = name.toLowerCase()
  if (pdfType === 'signature' || /signature|\bsig\b/.test(n)) return 'signature'
  if (/initial/.test(n)) return 'initials'
  if (/date/.test(n)) return 'date_signed'
  if (pdfType === 'checkbox' || pdfType === 'radiobutton') return 'checkbox'
  return 'text'
}

function inferRole(name) {
  const n = name.toLowerCase()
  const idx = /2|second/.test(n) ? '2' : '1'
  if (/buyer/.test(n)) return `buyer${idx}`
  if (/seller/.test(n)) return `seller${idx}`
  if (/listing (agent|broker)|listing firm/.test(n)) return 'listing_broker'
  if (/(selling|buyer'?s) (agent|broker)/.test(n)) return 'selling_broker'
  if (/broker|agent|licensee/.test(n)) return 'listing_broker'
  return null
}

async function main() {
  const buf = await fs.readFile(PDF)
  const sha = crypto.createHash('sha256').update(buf).digest('hex')

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  const fields = (await doc.getFieldObjects()) || {}

  const fieldMap = []
  for (const [name, instances] of Object.entries(fields)) {
    for (const f of instances) {
      if (!f.rect || f.page == null) continue
      const type = inferType(f.type, name)
      fieldMap.push({
        key: name,
        type,
        page: f.page,
        x: Math.round(f.rect[0]),
        y: Math.round(f.rect[1]),
        w: Math.round(f.rect[2] - f.rect[0]),
        h: Math.round(f.rect[3] - f.rect[1]),
        required: false,
        binding: null,
        signer_role: ['signature', 'initials', 'date_signed'].includes(type) ? inferRole(name) : null,
      })
    }
  }

  const { data: lib, error: libErr } = await supabase.from('tc_form_libraries').select('id').eq('code', LIBRARY).single()
  if (libErr || !lib) {
    console.error(`Library ${LIBRARY} not found — has migration 20260610020000_tc_forms_signing_v1 been applied?`)
    process.exit(2)
  }

  const fileBase = `${FORM_NUMBER ? FORM_NUMBER + '__' : ''}${NAME.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_')}.pdf`
  const storagePath = `tc-forms/${LIBRARY}/${fileBase}`
  const { error: upErr } = await supabase.storage.from('tc-documents').upload(storagePath, buf, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (upErr) {
    console.error('storage upload failed:', upErr.message)
    process.exit(3)
  }

  const { data: row, error: rowErr } = await supabase
    .from('tc_form_versions')
    .upsert(
      {
        library_id: lib.id,
        form_number: FORM_NUMBER,
        name: NAME,
        effective_date: EFFECTIVE,
        blank_pdf_storage_path: storagePath,
        sha256: sha,
        page_count: doc.numPages,
        field_map: fieldMap,
        field_map_source: fieldMap.length ? 'acroform' : 'manual',
        signer_profile: SIGNER_PROFILE,
        checklist_activity_hint: CHECKLIST_HINT,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'library_id,form_number,effective_date' }
    )
    .select('id')
    .single()
  if (rowErr) {
    console.error('tc_form_versions upsert failed:', rowErr.message)
    process.exit(4)
  }

  const sigs = fieldMap.filter((f) => ['signature', 'initials', 'date_signed'].includes(f.type))
  console.log(`Imported ${LIBRARY} ${FORM_NUMBER ?? ''} "${NAME}"`)
  console.log(`  version id: ${row.id}`)
  console.log(`  pages: ${doc.numPages} | fields: ${fieldMap.length} (${sigs.length} signature-class) | source: ${fieldMap.length ? 'acroform' : 'manual (no AcroForm fields — place in composer UI)'}`)
  console.log(`  blank: ${storagePath} | sha256: ${sha.slice(0, 16)}…`)
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
