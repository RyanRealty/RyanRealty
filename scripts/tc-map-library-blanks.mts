import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
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

const { data: versions } = await sb
  .from('tc_form_versions')
  .select('id, name, form_number, signer_profile, page_count, blank_pdf_storage_path, field_map')
  .is('retired_at', null)

let acro = 0
let stack = 0
let skip = 0
let fail = 0
for (const v of versions ?? []) {
  if (Array.isArray(v.field_map) && v.field_map.length) {
    skip++
    continue
  }
  if (!v.blank_pdf_storage_path) {
    fail++
    continue
  }
  let map: Awaited<ReturnType<typeof fieldMapFromAcroFormPdf>> = []
  let source = 'fallback_stack'
  try {
    const { data: blob } = await sb.storage.from('tc-forms').download(String(v.blank_pdf_storage_path))
    if (blob) map = await fieldMapFromAcroFormPdf(new Uint8Array(await blob.arrayBuffer()))
  } catch {
    map = []
  }
  if (map.length) {
    source = 'acroform'
    acro++
  } else {
    map = fallbackSigningStack({
      pageCount: Number(v.page_count) || 1,
      formNumber: v.form_number,
      signerProfile: v.signer_profile,
      documentName: v.name,
    })
    stack++
  }
  const { error } = await sb
    .from('tc_form_versions')
    .update({ field_map: map, field_map_source: source, updated_at: new Date().toISOString() })
    .eq('id', v.id)
  if (error) {
    console.log('fail', v.form_number, error.message)
    fail++
  }
}
console.log({ acro, stack, skip, fail, total: versions?.length })
