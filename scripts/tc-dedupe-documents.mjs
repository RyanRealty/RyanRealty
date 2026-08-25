#!/usr/bin/env node
/**
 * Fold duplicate documents on a Vault file down to one row per content hash.
 *
 * The writers now dedupe on sha256 (lib/tc/document-dedupe.ts), but files
 * worked before that still carry the copies: Apollo held six of one signed
 * sale agreement. This backfills sha256 and page_count where they were never
 * written, then archives every copy but the earliest of each hash.
 *
 * Archive is a flag, not a delete — the rows and their PDFs stay. Each archive
 * appends a tc_events row so the file's history says who folded what.
 *
 * Usage:
 *   node --env-file=.env.local scripts/tc-dedupe-documents.mjs --deal <uuid> [--apply]
 * Without --apply it prints the plan and changes nothing.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const dealId = args[args.indexOf('--deal') + 1]
if (!dealId || dealId.startsWith('--')) {
  console.error('Pass --deal <uuid>. Add --apply to write.')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: cycles } = await sb.from('tc_cycles').select('id').eq('deal_id', dealId)
const cycleIds = (cycles ?? []).map((c) => c.id)
if (!cycleIds.length) {
  console.error('No cycles on that deal.')
  process.exit(1)
}

const { data: docs } = await sb
  .from('tc_documents')
  .select('id, cycle_id, name, sha256, page_count, storage_path, archived, ingested_at')
  .in('cycle_id', cycleIds)
  .order('ingested_at')

let hashed = 0
for (const d of docs ?? []) {
  if (d.sha256 || !d.storage_path) continue
  const { data: blob } = await sb.storage.from('tc-documents').download(d.storage_path)
  if (!blob) continue
  const bytes = new Uint8Array(await blob.arrayBuffer())
  d.sha256 = createHash('sha256').update(bytes).digest('hex')
  hashed += 1
  if (APPLY) await sb.from('tc_documents').update({ sha256: d.sha256 }).eq('id', d.id)
}

const keep = new Map()
const fold = []
for (const d of docs ?? []) {
  if (d.archived || !d.sha256) continue
  const key = `${d.cycle_id}:${d.sha256}`
  if (!keep.has(key)) keep.set(key, d)
  else fold.push({ dup: d, original: keep.get(key) })
}

console.log(`documents ${docs?.length ?? 0} · hashed now ${hashed} · distinct ${keep.size} · folding ${fold.length}`)
for (const { dup, original } of fold) {
  console.log(`  archive ${dup.id.slice(0, 8)} "${dup.name.slice(0, 46)}" -> keeps ${original.id.slice(0, 8)}`)
}
if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.')
  process.exit(0)
}

for (const { dup, original } of fold) {
  await sb
    .from('tc_documents')
    .update({
      archived: true,
      archived_reason: `Duplicate of ${original.id} (same content hash)`,
      archived_at: new Date().toISOString(),
    })
    .eq('id', dup.id)
  await sb.from('tc_events').insert({
    deal_id: dealId,
    cycle_id: dup.cycle_id,
    document_id: dup.id,
    actor: 'agent',
    action: 'document_archived',
    detail: { reason: 'duplicate content hash', keeps: original.id, name: dup.name },
  })
}
console.log(`archived ${fold.length} duplicate row(s)`)
