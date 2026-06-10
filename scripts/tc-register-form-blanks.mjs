#!/usr/bin/env node
/**
 * Batch-register every downloaded form PDF under tmp/form-blanks/ into
 * tc_form_versions (via tc-import-form-template.mjs logic, inlined for batch).
 *
 *   tmp/form-blanks/OREF-samples/OREF-<num>__<name>.pdf  -> library OREF (sample=true note)
 *   tmp/form-blanks/OREF/OREF-<num>__<name>.pdf          -> library OREF (production blanks)
 *   tmp/form-blanks/ODS/*.pdf                            -> library ODS
 *   tmp/form-blanks/OR/*.pdf                             -> library OR
 *
 * Idempotent (upsert on library+form_number+effective_date). Field maps start
 * empty for flat PDFs (field_map_source='manual') and are filled in the
 * composer's placement UI. Production blanks REPLACE sample rows by upserting
 * the same (library, form_number) with a newer effective_date.
 *
 * Requires migration 20260610020000_tc_forms_signing_v1 (run when applied).
 * Usage: node --env-file=.env.local scripts/tc-register-form-blanks.mjs [--effective=2026-06-09]
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.join(REPO, 'tmp/form-blanks')
const EFFECTIVE = (process.argv.find((a) => a.startsWith('--effective=')) || '').split('=')[1] || '2026-06-09'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// signer profiles from the compliance form library (single_party set per failure-modes.md)
const SINGLE_PARTY = new Set(['043', '047', '080', '091', '092', '108', '109', '110', '003', '004', '064'])

const DIRS = [
  { dir: 'OREF', library: 'OREF', sample: false },
  { dir: 'OREF-samples', library: 'OREF', sample: true },
  { dir: 'ODS', library: 'ODS', sample: false },
  { dir: 'OR', library: 'OR', sample: false },
]

async function pdfMeta(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
  const fields = (await doc.getFieldObjects()) || {}
  const fieldMap = []
  for (const [name, instances] of Object.entries(fields)) {
    for (const f of instances) {
      if (!f.rect || f.page == null) continue
      fieldMap.push({
        key: name,
        type: f.type === 'signature' ? 'signature' : f.type === 'checkbox' ? 'checkbox' : 'text',
        page: f.page,
        x: Math.round(f.rect[0]),
        y: Math.round(f.rect[1]),
        w: Math.round(f.rect[2] - f.rect[0]),
        h: Math.round(f.rect[3] - f.rect[1]),
        required: false,
        binding: null,
        signer_role: null,
      })
    }
  }
  return { pages: doc.numPages, fieldMap }
}

const { data: libs, error: libErr } = await supabase.from('tc_form_libraries').select('id, code')
if (libErr) {
  console.error(`tc_form_libraries unavailable (${libErr.message}) — apply migration 20260610020000 first.`)
  process.exit(2)
}
const libId = Object.fromEntries((libs ?? []).map((l) => [l.code, l.id]))

let ok = 0
let failed = 0
for (const { dir, library, sample } of DIRS) {
  let files = []
  try {
    files = (await fs.readdir(path.join(ROOT, dir))).filter((f) => f.toLowerCase().endsWith('.pdf'))
  } catch {
    continue
  }
  for (const f of files) {
    try {
      const buf = await fs.readFile(path.join(ROOT, dir, f))
      const sha = crypto.createHash('sha256').update(buf).digest('hex')
      const m = f.match(/^OREF-([0-9A-Z]+)__(.+)\.pdf$/i)
      const formNumber = m ? m[1] : null
      const name = m ? m[2].replace(/_/g, ' ') : f.replace(/\.pdf$/i, '').replace(/_/g, ' ')
      const { pages, fieldMap } = await pdfMeta(buf)

      const storagePath = `tc-forms/${library}/${sample ? 'samples/' : ''}${f}`
      const { error: upErr } = await supabase.storage.from('tc-documents').upload(storagePath, buf, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (upErr) throw new Error(`storage: ${upErr.message}`)

      const { error: rowErr } = await supabase.from('tc_form_versions').upsert(
        {
          library_id: libId[library],
          form_number: formNumber,
          name: sample ? `${name} (SAMPLE — replace with subscriber blank)` : name,
          effective_date: EFFECTIVE,
          blank_pdf_storage_path: storagePath,
          sha256: sha,
          page_count: pages,
          field_map: fieldMap,
          field_map_source: fieldMap.length ? 'acroform' : 'manual',
          signer_profile: formNumber && SINGLE_PARTY.has(formNumber) ? 'single_party' : formNumber ? 'mutual' : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'library_id,form_number,effective_date' }
      )
      if (rowErr) throw new Error(rowErr.message)
      ok++
    } catch (e) {
      failed++
      console.error(`fail ${dir}/${f}: ${e?.message}`)
    }
  }
}
console.log(`registered ${ok} form versions, ${failed} failures`)
