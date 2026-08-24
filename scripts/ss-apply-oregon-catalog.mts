/**
 * Apply the live SkySlope Oregon catalog (OREF / ODS / OR) to tc_form_* tables.
 * Metadata only. No PDF. Uses the same diff as /admin/forms Apply catalog.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  diffLibraryCatalog,
  parseCatalogPayload,
  parseFormNumber,
  type HeldForm,
} from '../lib/tc/form-catalog-diff.ts'
import { FORM_PACKET_SEEDS, formNameMatchesNeedle } from '../lib/tc/form-packets.ts'

const env: Record<string, string> = {}
for (const ln of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = ln.indexOf('=')
  if (i < 1 || ln.startsWith('#')) continue
  env[ln.slice(0, i)] = ln.slice(i + 1).replace(/^["']|["']$/g, '')
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const catalogPath = process.argv[2] || 'tmp/ss-catalog-oregon.json'
const parsed = parseCatalogPayload(JSON.parse(readFileSync(catalogPath, 'utf8')))
if ('error' in parsed) {
  console.error(parsed.error)
  process.exit(1)
}

const checkedAt = new Date().toISOString()
const { data: libs, error: libErr } = await sb.from('tc_form_libraries').select('id, code')
if (libErr) throw libErr
const libByCode = new Map((libs ?? []).map((l) => [String(l.code), String(l.id)]))

for (const snapshot of parsed.libraries) {
  const libId = libByCode.get(snapshot.libraryCode)
  if (!libId) {
    console.error('missing library', snapshot.libraryCode)
    process.exit(1)
  }
  const { data: versionRows, error: verErr } = await sb
    .from('tc_form_versions')
    .select('id, source_form_id, source_version_id, form_number, name')
    .eq('library_id', libId)
    .is('retired_at', null)
  if (verErr) throw verErr
  const held: HeldForm[] = (versionRows ?? []).map((v) => ({
    id: String(v.id),
    sourceFormId: v.source_form_id == null ? null : String(v.source_form_id),
    sourceVersionId: v.source_version_id == null ? null : String(v.source_version_id),
    formNumber: v.form_number == null ? null : String(v.form_number),
    name: String(v.name ?? ''),
  }))
  const { items, counts } = diffLibraryCatalog(snapshot.forms, held)
  for (const item of items) {
    const { error } = await sb.from('tc_form_catalog_items').upsert(
      {
        library_id: libId,
        source_form_id: item.sourceFormId,
        source_version_id: item.sourceVersionId,
        name: item.name,
        form_number: item.formNumber,
        page_count: item.pageCount,
        version_label: item.versionLabel,
        disposition: item.disposition,
        held_form_version_id: item.heldFormVersionId,
        last_seen_at: checkedAt,
      },
      { onConflict: 'library_id,source_form_id' },
    )
    if (error) throw error
    if (!item.heldFormVersionId) continue
    const stamp: Record<string, unknown> = { source_checked_at: checkedAt }
    const formNumber = item.formNumber || parseFormNumber(item.name)
    if (formNumber) stamp.form_number = formNumber
    if (item.versionLabel) stamp.version_label = item.versionLabel
    if (item.disposition === 'updated') {
      stamp.update_available = true
      stamp.pending_source_version_id = item.sourceVersionId
      stamp.pending_version_label = item.versionLabel
    } else if (item.disposition === 'current') {
      stamp.update_available = false
      stamp.pending_source_version_id = null
      stamp.pending_version_label = null
    }
    const { error: upErr } = await sb.from('tc_form_versions').update(stamp).eq('id', item.heldFormVersionId)
    if (upErr) throw upErr
  }
  const { error: libStampErr } = await sb
    .from('tc_form_libraries')
    .update({
      last_catalog_at: checkedAt,
      last_catalog_published_count: snapshot.forms.length,
      source_library_id: snapshot.sourceLibraryId ?? undefined,
    })
    .eq('id', libId)
  if (libStampErr) throw libStampErr
  const { error: checkErr } = await sb.from('tc_form_catalog_checks').insert({
    library_id: libId,
    source_library_id: snapshot.sourceLibraryId ?? null,
    checked_at: checkedAt,
    published_count: snapshot.forms.length,
    held_count: held.length,
    new_count: counts.new,
    updated_count: counts.updated,
    retired_count: counts.retired,
    current_count: counts.current,
    created_by: 'ss-apply-oregon-catalog',
  })
  if (checkErr) throw checkErr
  console.log(snapshot.libraryCode, { published: snapshot.forms.length, ...counts })
}

const leftover = await sb
  .from('tc_form_versions')
  .update({ retired_at: checkedAt.slice(0, 10) })
  .eq('name', 'ODS Residential Input Form 2024-05')
  .is('source_version_id', null)
  .is('retired_at', null)
  .select('id')
console.log('retired leftover ODS input', leftover.data?.length ?? 0)

const { data: liveForms } = await sb
  .from('tc_form_versions')
  .select('id, name, form_number')
  .is('retired_at', null)
  .not('blank_pdf_storage_path', 'is', null)

function pickByNumber(formNumber: string): string | null {
  const live = (liveForms ?? []).filter(
    (f) => String(f.form_number) === formNumber && !/\(SAMPLE/i.test(String(f.name ?? '')),
  )
  const ranked = live.sort((a, b) => {
    const aExempt = /exempt/i.test(String(a.name ?? '')) ? 1 : 0
    const bExempt = /exempt/i.test(String(b.name ?? '')) ? 1 : 0
    return aExempt - bExempt
  })
  return ranked[0]?.id ? String(ranked[0].id) : null
}

for (const seed of FORM_PACKET_SEEDS) {
  const ids: string[] = []
  if (seed.formNumbers) {
    for (const n of seed.formNumbers) {
      const id = pickByNumber(n)
      if (id) ids.push(id)
    }
  }
  if (seed.nameIncludes) {
    for (const needle of seed.nameIncludes) {
      const hit = (liveForms ?? []).find((f) => formNameMatchesNeedle(String(f.name ?? ''), needle))
      if (hit && !ids.includes(String(hit.id))) ids.push(String(hit.id))
    }
  }
  if (!ids.length) {
    console.log('packet skip empty', seed.name)
    continue
  }
  const { data: existing } = await sb.from('tc_form_packets').select('id').eq('name', seed.name).maybeSingle()
  if (existing?.id) {
    const { error } = await sb.from('tc_form_packets').update({ form_version_ids: ids }).eq('id', existing.id)
    if (error) throw error
    console.log('packet refreshed', seed.name, ids.length)
    continue
  }
  const { error } = await sb.from('tc_form_packets').insert({
    name: seed.name,
    form_version_ids: ids,
    created_by: 'system',
  })
  if (error) throw error
  console.log('packet seeded', seed.name, ids.length)
}

console.log('checkedAt', checkedAt)
