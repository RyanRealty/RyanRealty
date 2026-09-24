/**
 * Vault form templates (lib/tc/form-match): build them and check documents.
 *
 *   npx tsx scripts/tc-form-templates.ts library [--only 001,003]
 *       Build one template per form + release from the licensed blanks.
 *   npx tsx scripts/tc-form-templates.ts learn [--dry-run]
 *       Learn templates for releases the library does not hold, from the
 *       readable pages of our own copies that matched no template.
 *   npx tsx scripts/tc-form-templates.ts check --doc <uuid>
 *       Check one document and print what it found.
 *   npx tsx scripts/tc-form-templates.ts check-all [--concurrency 3] [--limit N] [--shard i/n]
 *       Check every live PDF not yet checked by the current checker version.
 */
import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}

async function main() {
  const mode = process.argv[2]
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  if (mode === 'library') {
    const { buildLibraryTemplates } = await import('@/lib/tc/form-match/templates')
    const only = arg('--only')?.split(',')
    const res = await buildLibraryTemplates(sb, { only, log: (s) => console.log(s) })
    console.log(JSON.stringify({ templates: res.templates, versions: res.versions, skipped: res.skipped.length }, null, 2))
    for (const s of res.skipped) console.log('  skipped', s.reason, '|', s.name)
    return
  }
  if (mode === 'learn') {
    const { learnTemplates } = await import('@/lib/tc/form-match/learn')
    const res = await learnTemplates(sb, { dryRun: process.argv.includes('--dry-run'), log: (s) => console.log(s) })
    console.log(`learned ${res.learned.length}, skipped ${res.skipped.length}`)
    for (const s of res.skipped) console.log('  skipped', s.key, '|', s.reason)
    return
  }
  if (mode === 'check') {
    const { checkStoredDocument } = await import('@/lib/tc/form-match/run')
    const { describeCheck } = await import('@/lib/tc/form-match/check')
    const { loadTemplates } = await import('@/lib/tc/form-match/templates')
    const templates = await loadTemplates(sb)
    const name = new Map(templates.map((t) => [t.id, `${t.family} ${t.formNumber} ${t.release ?? ''} (${t.source})`]))
    const r = await checkStoredDocument(sb, arg('--doc')!)
    if (!r.ok) throw new Error(r.error)
    for (const p of r.check.pages) {
      const what = p.templateId ? `${name.get(p.templateId)} p${p.templatePage}` : p.nearest ? `no match (nearest ${name.get(p.nearest.templateId)} p${p.nearest.templatePage})` : 'no match'
      console.log(`page ${p.page}: ${what} ${(p.coverage * 100).toFixed(1)}% text=${p.textUsable ? 'ok' : 'unusable'} footer=${p.footer?.raw ?? '-'}`)
    }
    for (const f of r.check.forms) {
      const d = describeCheck(f)
      console.log(`FORM ${f.family} ${f.formNumber} ${f.release ?? ''}: ${d.complete ? 'complete' : d.issues.join('; ')}`)
      for (const l of f.lines) console.log(`   p${l.page} ${l.party.padEnd(12)} ${l.required ? 'req ' : 'opt '} ${l.signed ? 'SIGNED' : 'blank '} date=${l.dated} print=${l.printed} ink=${l.ink} [${l.section ?? ''}]`)
      for (const i of f.initials) console.log(`   p${i.page} initials ${i.party}: ${i.slots.map((s) => (s ? 'x' : '_')).join('')}`)
    }
    return
  }
  if (mode === 'check-all') {
    const { checkStoredDocument } = await import('@/lib/tc/form-match/run')
    const { CHECKER_VERSION } = await import('@/lib/tc/form-match/check')
    const docs: string[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('tc_documents')
        .select('id')
        .eq('archived', false)
        .eq('is_broker_notes', false)
        .or('content_type.eq.application/pdf,content_type.is.null')
        .not('storage_path', 'is', null)
        .order('ingested_at', { ascending: true })
        .range(from, from + 999)
      if (error) throw error
      docs.push(...(data ?? []).map((d) => String(d.id)))
      if (!data || data.length < 1000) break
    }
    const done = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from('tc_document_checks').select('document_id').eq('checker_version', CHECKER_VERSION).is('error', null).range(from, from + 999)
      for (const d of data ?? []) done.add(String(d.document_id))
      if (!data || data.length < 1000) break
    }
    // --shard i/n: this process takes every n-th document (run n processes to use n cores).
    const [shard, shards] = (arg('--shard') ?? '0/1').split('/').map(Number)
    const queue = docs.filter((d, i) => !done.has(d) && i % shards === shard).slice(0, Number(arg('--limit') ?? 1e9))
    console.log(`documents ${docs.length}, checked ${done.size}, to check ${queue.length}`)
    let n = 0
    let failed = 0
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!
        const r = await checkStoredDocument(sb, id)
        n++
        if (!r.ok) failed++
        if (n % 25 === 0 || !r.ok) console.log(`[${n}] ${id} ${r.ok ? `${r.check.forms.length} forms` : `ERROR ${r.error}`}`)
      }
    }
    await Promise.all(Array.from({ length: Number(arg('--concurrency') ?? 3) }, worker))
    console.log(`checked ${n}, failed ${failed}`)
    return
  }
  console.error('usage: tc-form-templates.ts library|check|check-all')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
