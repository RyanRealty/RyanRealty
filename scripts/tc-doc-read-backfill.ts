/**
 * Vault document reader: history. docs/TC_DOCUMENT_READER.md.
 *
 *   npx tsx scripts/tc-doc-read-backfill.ts read [--limit N] [--concurrency 6] [--deal <uuid>]
 *       Read every live document the current reader version has not read.
 *       Identical files are read once. Prints cost as it goes.
 *
 *   npx tsx scripts/tc-doc-read-backfill.ts plan [--deal <uuid>]
 *       READ-ONLY. For every cycle (or one deal's), what the file would look
 *       like: archives, checklist moves, flags. Writes out/doc-read-plan.json.
 *
 *   npx tsx scripts/tc-doc-read-backfill.ts reverdict [--deal <uuid>]
 *       Re-derive every read document's verdict with the current rules (no
 *       model call) and write it to the document. Run after a rule change.
 *
 *   npx tsx scripts/tc-doc-read-backfill.ts apply [--deal <uuid>]
 *       Apply the plans. Removals whose only ground is "not fully executed"
 *       wait for the second model to agree (costs a confirming read).
 *
 * Production reads and writes; spends reader tokens on read / apply.
 */
import 'dotenv/config'
import fs from 'node:fs'
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
  const { loadEnv } = await import('../lib/platform/env.mjs')
  await loadEnv()
  const { createClient } = await import('@supabase/supabase-js')
  const run = await import('../lib/tc/doc-read/run')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const mode = process.argv[2]
  const deal = arg('--deal')

  async function cycleIds(): Promise<string[]> {
    let q = sb.from('tc_cycles').select('id, deal_id')
    if (deal) q = q.eq('deal_id', deal)
    const { data } = await q
    return (data ?? []).map((c) => String(c.id))
  }

  if (mode === 'read') {
    const limit = Number(arg('--limit') ?? 100000)
    const conc = Number(arg('--concurrency') ?? 6)
    let ids: string[]
    if (deal) {
      const cycles = await cycleIds()
      const { data } = await sb.from('tc_documents').select('id').in('cycle_id', cycles).eq('archived', false).not('storage_path', 'is', null)
      ids = (data ?? []).map((d) => String(d.id))
    } else ids = await run.unreadDocumentIds(sb, limit)
    console.log(`[read] ${ids.length} documents to read`)
    let done = 0
    let cost = 0
    let reused = 0
    const failed: Array<{ id: string; error: string }> = []
    const verdicts = new Map<string, number>()
    async function worker() {
      while (ids.length) {
        const id = ids.shift()!
        const r = await run.readStoredDocument(sb, id)
        done += 1
        if (r.ok) {
          cost += r.costUsd
          if (r.reused) reused += 1
          verdicts.set(r.verdict.verdict, (verdicts.get(r.verdict.verdict) ?? 0) + 1)
        } else failed.push({ id, error: r.error.slice(0, 160) })
        if (done % 25 === 0) console.log(`[read] ${done} done, $${cost.toFixed(2)}, ${reused} reused, ${failed.length} failed`)
      }
    }
    await Promise.all(Array.from({ length: conc }, worker))
    console.log(`[read] finished: ${done} documents, $${cost.toFixed(4)} spent, ${reused} reused identical reads, ${failed.length} failed`)
    console.log('[read] verdicts', Object.fromEntries(verdicts))
    if (failed.length) console.log('[read] failures', failed.slice(0, 20))
    return
  }

  if (mode === 'reverdict') {
    const cycles = await cycleIds()
    let n = 0
    for (let i = 0; i < cycles.length; i += 100) {
      const { data } = await sb.from('tc_documents').select('id').in('cycle_id', cycles.slice(i, i + 100)).eq('archived', false)
      for (const d of data ?? []) if (await run.refreshVerdict(sb, String(d.id))) n += 1
    }
    console.log(`[reverdict] ${n} documents re-derived`)
    return
  }

  if (mode === 'plan' || mode === 'apply') {
    const cycles = await cycleIds()
    const report: Array<Record<string, unknown>> = []
    const totals = { archive: 0, link: 0, unlink: 0, flag: 0, confirmCost: 0, disagreed: 0 }
    for (const cycleId of cycles) {
      const planned = await run.planCycleDocuments(sb, cycleId)
      if (!planned || !planned.plan.actions.length) continue
      const names = new Map(planned.docs.map((d) => [d.id, d.name]))
      for (const a of planned.plan.actions) totals[a.kind] += 1
      report.push({
        cycleId,
        dealId: planned.ctx.dealId,
        stage: planned.ctx.stage,
        actions: planned.plan.actions.map((a) => ({ ...a, docName: names.get(a.docId) })),
        instances: planned.plan.instances,
      })
      if (mode === 'apply') {
        const res = await run.applyCyclePlan(sb, planned)
        totals.confirmCost += res.costUsd
        totals.disagreed += res.confirmedDisagreed
        console.log(`[apply] ${cycleId}: archived ${res.archived}, linked ${res.linked}, unlinked ${res.unlinked}, flagged ${res.flagged}`)
      }
    }
    fs.mkdirSync('out', { recursive: true })
    fs.writeFileSync(`out/doc-read-${mode}.json`, JSON.stringify(report, null, 1))
    console.log(`[${mode}] ${report.length} cycles with changes`, totals)
    return
  }

  console.log('usage: read | reverdict | plan | apply  [--deal <uuid>]')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
