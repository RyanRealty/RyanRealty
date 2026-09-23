/**
 * Vault mail index: history backfill + correction of the 2026-08-23 misfiles.
 * Rules: lib/tc/mail-rules.ts · docs/TC_MAIL_FILING_RULES.md.
 *
 *   npx tsx scripts/tc-mail-backfill.ts audit [--since 2026-08-22]
 *       READ-ONLY. Walks every broker mailbox from --since, decides every message
 *       with the current rules, and compares against what the old filer did.
 *       Writes tmp/tc-mail-audit.json. Nothing in Gmail or the database changes.
 *
 *   npx tsx scripts/tc-mail-backfill.ts reconcile [--since 2026-08-22]
 *       Same walk, then: archive the documents misfiled messages left on the
 *       wrong deal (with a reason), drop their checklist rows, write one
 *       mail_misfile_corrected event per deal, and index every transaction
 *       message where the rules put it. Needs the tc_mail_index migration.
 *
 *   npx tsx scripts/tc-mail-backfill.ts sweep-deals [--dry-run] [--deal <uuid>] [--reindex] [--concurrency 3]
 *       Every deal (all stages), every mailbox, all history: address, escrow
 *       and MLS number searches. Mail the index already holds for a mailbox is
 *       skipped unless --reindex (after a rules change). Deals run
 *       --concurrency at a time; a deal is marked swept only when it finishes.
 *
 *   npx tsx scripts/tc-mail-backfill.ts sweep-transactions [--since YYYY-MM-DD] [--dry-run] [--reindex]
 *       Offer / counter / escrow / closing mail by subject with a PDF, every
 *       mailbox. Offers on properties with no file land in the mail queue.
 *
 *   npx tsx scripts/tc-mail-backfill.ts rematch
 *       Re-decide queued mail against today's deals.
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
  return i > 0 ? (process.argv[i + 1] ?? null) : null
}
const has = (name: string) => process.argv.includes(name)

async function walk(since: string) {
  const { CRM_MAILBOXES, getGmailFor } = await import('@/lib/crm/gmail')
  const { indexGmailMessage, loadMailUniverse } = await import('@/lib/tc/mail-index')
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const universe = await loadMailUniverse(sb)
  const decisions = new Map<string, { status: string; dealId: string | null; subject: string | null; mailbox: string; gmailId: string; category: string | null; method: string | null }>()
  const q = `after:${since.replace(/-/g, '/')} -in:spam -in:trash`
  for (const mb of CRM_MAILBOXES) {
    const gmail = getGmailFor(mb.email, ['https://www.googleapis.com/auth/gmail.readonly'])
    if (!gmail) continue
    const ids: string[] = []
    let pageToken: string | undefined
    do {
      const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 500, pageToken })
      for (const m of list.data.messages ?? []) if (m.id) ids.push(m.id)
      pageToken = list.data.nextPageToken ?? undefined
    } while (pageToken)
    console.log(`[walk] ${mb.email}: ${ids.length} messages since ${since}`)
    const CONC = 8
    for (let i = 0; i < ids.length; i += CONC) {
      const batch = await Promise.all(
        ids.slice(i, i + CONC).map((id) =>
          indexGmailMessage({ gmail, mailbox: mb.email, brokerSlug: mb.slug, gmailId: id, universe, dryRun: true, sb }).then((r) => ({ r, id })),
        ),
      )
      for (const { r, id } of batch) {
        if (r.status === 'error') {
          console.warn(`[walk] error ${id}: ${r.error}`)
          continue
        }
        if (!decisions.has(r.messageKey) || r.decision?.status === 'filed') {
          decisions.set(r.messageKey, {
            status: r.decision?.status ?? r.status,
            dealId: r.decision?.dealId ?? null,
            subject: r.subject,
            mailbox: mb.email,
            gmailId: id,
            category: r.decision?.category ?? null,
            method: r.decision?.method ?? null,
          })
        }
      }
      if (i % 200 === 0) console.log(`[walk] ${mb.email}: ${Math.min(i + CONC, ids.length)}/${ids.length}`)
    }
  }
  return { decisions, universe, sb }
}

async function legacy(sb: import('@supabase/supabase-js').SupabaseClient, since: string) {
  const events: Array<{ id: number; dealId: string; dedupe: string; title: string | null; createdAt: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_events')
      .select('id, deal_id, detail, created_at')
      .eq('action', 'mail_filed')
      .like('actor', 'gmail:%')
      .gte('created_at', since)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const e of data ?? []) {
      const d = (e.detail ?? {}) as { dedupe?: string; title?: string | null; mail_message_id?: string }
      // Rows the new index wrote carry mail_message_id; only the old filer's rows are legacy.
      if (!d.dedupe || d.mail_message_id) continue
      events.push({ id: Number(e.id), dealId: String(e.deal_id), dedupe: d.dedupe, title: d.title ?? null, createdAt: String(e.created_at) })
    }
    if (!data || data.length < 1000) break
  }
  // Re-runnable: filings an earlier reconcile already corrected are not corrected twice.
  const corrected = new Set<number>()
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('tc_events')
      .select('detail')
      .eq('action', 'mail_misfile_corrected')
      .order('id')
      .range(from, from + 999)
    for (const c of data ?? []) for (const id of ((c.detail as { legacy_event_ids?: number[] })?.legacy_event_ids ?? [])) corrected.add(Number(id))
    if (!data || data.length < 1000) break
  }
  if (corrected.size) {
    const before = events.length
    events.splice(0, events.length, ...events.filter((e) => !corrected.has(e.id)))
    console.log(`[legacy] ${before - events.length} filings already corrected by an earlier run`)
  }
  const dealIds = [...new Set(events.map((e) => e.dealId))]
  const { data: cycles } = dealIds.length ? await sb.from('tc_cycles').select('id, deal_id').in('deal_id', dealIds) : { data: [] }
  const dealByCycle = new Map((cycles ?? []).map((c) => [String(c.id), String(c.deal_id)]))
  const documents: Array<{ id: string; dealId: string; sourceDocId: string | null; name: string; archived: boolean }> = []
  const cycleIds = [...dealByCycle.keys()]
  for (let i = 0; i < cycleIds.length; i += 100) {
    const { data } = await sb
      .from('tc_documents')
      .select('id, cycle_id, source_doc_id, name, archived')
      .in('cycle_id', cycleIds.slice(i, i + 100))
      .eq('classification->>source', 'gmail_auto_file')
    for (const d of data ?? []) {
      documents.push({ id: String(d.id), dealId: dealByCycle.get(String(d.cycle_id))!, sourceDocId: d.source_doc_id, name: String(d.name), archived: !!d.archived })
    }
  }
  return { events, documents }
}

async function auditOrReconcile(apply: boolean) {
  const since = arg('--since') ?? '2026-08-22'
  const { decisions, universe, sb } = await walk(since)
  const { planMisfileCorrections } = await import('@/lib/tc/mail-reconcile')
  const { events, documents } = await legacy(sb, since)
  const plan = planMisfileCorrections({ events, documents, decisions })
  const addr = new Map(universe.deals.map((d) => [d.dealId, d.address]))
  const tally: Record<string, number> = {}
  for (const d of decisions.values()) tally[d.status] = (tally[d.status] ?? 0) + 1
  const filedByDeal: Record<string, number> = {}
  for (const d of decisions.values()) if (d.status === 'filed' && d.dealId) filedByDeal[addr.get(d.dealId) ?? d.dealId] = (filedByDeal[addr.get(d.dealId) ?? d.dealId] ?? 0) + 1
  const queued = [...decisions.values()].filter((d) => d.status === 'ambiguous' || d.status === 'unfiled_transaction')
  const report = {
    since,
    messages_decided: decisions.size,
    by_status: tally,
    new_rules_filed_by_deal: filedByDeal,
    queued: queued.map((d) => ({ status: d.status, subject: d.subject, mailbox: d.mailbox, category: d.category })),
    legacy_filings: events.length,
    legacy_confirmed: plan.confirmed,
    legacy_unverified: plan.unverified,
    corrections: plan.corrections.map((c) => ({
      deal: addr.get(c.dealId) ?? c.dealId,
      dealId: c.dealId,
      misfiled_messages: c.eventIds.length,
      documents_to_archive: c.documentIds.length,
      moved_to: Object.entries(
        Object.values(c.movedTo).reduce<Record<string, number>>((acc, v) => {
          const k = v ? (addr.get(v) ?? v) : '(no deal)'
          acc[k] = (acc[k] ?? 0) + 1
          return acc
        }, {}),
      ),
      sample_titles: c.sampleTitles,
    })),
  }
  fs.mkdirSync('tmp', { recursive: true })
  fs.writeFileSync('tmp/tc-mail-audit.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, queued: report.queued.slice(0, 25) }, null, 2))
  if (!apply) {
    console.log('\n[audit] read-only. Nothing changed. Full report: tmp/tc-mail-audit.json')
    return
  }

  const now = new Date().toISOString()
  for (const c of plan.corrections) {
    if (c.documentIds.length) {
      const { error: archErr } = await sb
        .from('tc_documents')
        .update({
          archived: true,
          archived_at: now,
          archived_reason:
            'Misfiled by the 2026-08-23 mail filer (matched who the email touched, not the property). Corrected 2026-09 by the Vault mail index.',
        })
        .in('id', c.documentIds)
      if (archErr) throw new Error(`archive: ${archErr.message}`)
      const { error: asgErr } = await sb.from('tc_checklist_assignments').delete().in('document_id', c.documentIds)
      if (asgErr) throw new Error(`assignments: ${asgErr.message}`)
    }
    const { error: evErr } = await sb.from('tc_events').insert({
      deal_id: c.dealId,
      actor: 'system:tc-mail-backfill',
      action: 'mail_misfile_corrected',
      detail: {
        reason:
          'These emails were filed here by the 2026-08-23 mail filer, which matched who an email touched (a house address on a contact, a title officer on several files) instead of the property it named.',
        corrected_messages: c.eventIds.length,
        legacy_event_ids: c.eventIds,
        dedupe_keys: c.dedupeKeys,
        moved_to: c.movedTo,
        archived_document_ids: c.documentIds,
        sample_titles: c.sampleTitles,
      },
    })
    if (evErr) throw new Error(`event: ${evErr.message}`)
    console.log(`[reconcile] ${addr.get(c.dealId)}: ${c.eventIds.length} messages corrected, ${c.documentIds.length} documents archived`)
  }

  // File every transaction message where the rules put it.
  const { indexGmailMessage } = await import('@/lib/tc/mail-index')
  const { getGmailFor } = await import('@/lib/crm/gmail')
  let filed = 0
  let queuedN = 0
  let failed = 0
  const todo = [...decisions.values()].filter((d) => ['filed', 'ambiguous', 'unfiled_transaction'].includes(d.status))
  console.log(`[reconcile] indexing ${todo.length} transaction messages`)
  let done = 0
  // Four at a time; one message that errors is logged and skipped, never the run.
  async function worker() {
    while (todo.length) {
      const d = todo.shift()!
      const gmail = getGmailFor(d.mailbox, ['https://www.googleapis.com/auth/gmail.readonly'])
      if (!gmail) continue
      const slug = d.mailbox.startsWith('matt') ? 'matt' : d.mailbox.startsWith('paul') ? 'paul' : 'rebecca'
      try {
        const r = await indexGmailMessage({ gmail, mailbox: d.mailbox, brokerSlug: slug, gmailId: d.gmailId, universe, sb })
        if (r.status === 'filed') filed++
        else if (r.status === 'ambiguous' || r.status === 'unfiled_transaction') queuedN++
      } catch (e) {
        failed++
        console.warn(`[reconcile] index error ${d.gmailId}: ${(e as Error).message}`)
      }
      done++
      if (done % 25 === 0) console.log(`[reconcile] indexed ${done}: ${filed} filed, ${queuedN} queued, ${failed} errors`)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  console.log(`[reconcile] indexed: ${filed} filed, ${queuedN} queued, ${failed} errors`)
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'audit') return auditOrReconcile(false)
  if (mode === 'reconcile') return auditOrReconcile(true)
  const { loadMailUniverse, sweepDealMail, sweepTransactionMail, rematchQueuedMail } = await import('@/lib/tc/mail-index')
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const universe = await loadMailUniverse(sb)
  const dryRun = has('--dry-run')
  if (mode === 'sweep-deals') {
    const only = arg('--deal')
    const deals = only ? universe.deals.filter((d) => d.dealId === only) : universe.deals
    const out: Array<Record<string, unknown>> = []
    const reindex = has('--reindex')
    let next = 0
    const worker = async () => {
      while (next < deals.length) {
        const d = deals[next++]
        const t0 = Date.now()
        const res = await sweepDealMail({ dealId: d.dealId, universe, dryRun, reindex, sb })
        if (!res) continue
        console.log(
          `[sweep-deals ${out.length + 1}/${deals.length}] ${d.address} (${d.stage}): seen ${res.seen}, skipped ${res.skipped}, filed ${res.filed}, queued ${res.queued}, offers ${res.offers}, errors ${res.errors}, ${Math.round((Date.now() - t0) / 1000)}s`,
        )
        out.push({ deal: d.address, stage: d.stage, ...res })
      }
    }
    await Promise.all(Array.from({ length: Number(arg('--concurrency') ?? 3) }, worker))
    fs.mkdirSync('tmp', { recursive: true })
    fs.writeFileSync('tmp/tc-mail-sweep-deals.json', JSON.stringify(out, null, 2))
    return
  }
  if (mode === 'sweep-transactions') {
    const res = await sweepTransactionMail({ since: arg('--since'), universe, dryRun, reindex: has('--reindex'), sb, maxPerMailbox: Number(arg('--max') ?? 5000) })
    fs.mkdirSync('tmp', { recursive: true })
    fs.writeFileSync('tmp/tc-mail-sweep-transactions.json', JSON.stringify(res, null, 2))
    console.log(JSON.stringify({ ...res, samples: res.samples.slice(0, 40) }, null, 2))
    return
  }
  if (mode === 'rematch') {
    console.log(await rematchQueuedMail({ universe, sb }))
    return
  }
  console.error('usage: tc-mail-backfill.ts audit|reconcile|sweep-deals|sweep-transactions|rematch [--since YYYY-MM-DD] [--dry-run]')
  process.exit(2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
