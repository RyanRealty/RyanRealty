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
 *   npx tsx scripts/tc-mail-backfill.ts rematch [--limit N] [--model-stage]
 *   npx tsx scripts/tc-mail-backfill.ts refile-threads [--limit N]
 *       Re-decide queued mail against today's deals.
 *
 *   npx tsx scripts/tc-mail-backfill.ts review-all [--mailbox x@ryan-realty.com] [--concurrency 4] [--limit N] [--model-stage] [--dry-run]
 *       "Every message reviewed" (docs/TC_MAIL_FILING_RULES.md): walk EVERY
 *       message in the given mailbox(es) — no date window, no deal-term query
 *       — and record a tc_mail_reviews row for each one, whatever it decided.
 *       Resumes from tc_mail_review_cursors; a mailbox already finished is a
 *       no-op. --mailbox restricts to one mailbox (repeat for more than one),
 *       default is every CRM_MAILBOXES entry. --limit caps how many messages
 *       this run actually indexes (a smoke-test knob). --model-stage turns on
 *       the leftover Grok pass for not_deal/unfiled_transaction mail that
 *       still looks transactional (lib/tc/mail-model-stage.ts) — real spend,
 *       off by default. --dry-run is READ-ONLY: decides every message but
 *       writes nothing (no tc_mail_messages row, no tc_mail_reviews row, no
 *       cursor), and prints the status distribution instead.
 *
 *   npx tsx scripts/tc-mail-backfill.ts redecide [--dry-run | --apply] [--mailbox x@ryan-realty.com] [--status bulk,not_deal,filed]
 *                                                [--since YYYY-MM-DD] [--limit N] [--concurrency 4] [--batch 200] [--max-minutes N]
 *       After a rules change (MAIL_RULES_VERSION in lib/tc/mail-rules.ts): decide
 *       again every tc_mail_reviews row decided under another version, oldest
 *       message first, and correct the history (lib/tc/mail-redecide.ts,
 *       docs/TC_MAIL_FILING_RULES.md "Re-deciding history after a rules change").
 *       DRY RUN BY DEFAULT: read-only, prints the count of each transition per
 *       mailbox, 10 samples of each, and writes every changed row to
 *       tmp/tc-mail-redecide/<run>/changes.{jsonl,csv} + summary.json.
 *       --apply files, moves and unfiles through the live path; a person's
 *       decision is never touched; one run at a time (lock); resumable (a row
 *       done carries the new version). Ctrl-C stops cleanly between messages.
 *       --mailbox / --status take a comma list or repeat.
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
  const { withoutDrafts } = await import('@/lib/crm/gmail-drafts')
  const { indexGmailMessage, loadMailUniverse } = await import('@/lib/tc/mail-index')
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const universe = await loadMailUniverse(sb)
  const decisions = new Map<string, { status: string; dealId: string | null; subject: string | null; mailbox: string; gmailId: string; category: string | null; method: string | null }>()
  const q = withoutDrafts(`after:${since.replace(/-/g, '/')} -in:spam -in:trash`)
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

/** Every value of a repeatable, comma-separated flag. */
function argList(name: string): string[] {
  const out: string[] = []
  process.argv.forEach((a, i) => {
    if (a === name && process.argv[i + 1]) out.push(...process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean))
  })
  return out
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function redecide() {
  const apply = has('--apply')
  if (apply && has('--dry-run')) {
    console.error('[redecide] pass --dry-run or --apply, not both')
    process.exit(2)
  }
  const { runRedecide, createProductionRedecideDeps, TRANSITIONS } = await import('@/lib/tc/mail-redecide')
  type Change = import('@/lib/tc/mail-redecide').ChangeRow
  const mailboxes = argList('--mailbox')
  const statuses = argList('--status')
  const since = arg('--since')
  const limit = arg('--limit') ? Number(arg('--limit')) : null
  const concurrency = Number(arg('--concurrency') ?? 4)
  const batchSize = Number(arg('--batch') ?? 200)
  const maxMinutes = arg('--max-minutes') ? Number(arg('--max-minutes')) : null
  const deadline = maxMinutes ? Date.now() + maxMinutes * 60_000 : null

  let stop = false
  process.on('SIGINT', () => {
    if (stop) process.exit(130)
    stop = true
    console.log('\n[redecide] stopping after the messages in flight (Ctrl-C again to quit now)')
  })

  const t0 = Date.now()
  const deps = await createProductionRedecideDeps({ apply })
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(arg('--out') ?? 'tmp/tc-mail-redecide', `${apply ? 'apply' : 'dry-run'}-${runId}`)
  fs.mkdirSync(dir, { recursive: true })
  const jsonl = fs.createWriteStream(path.join(dir, 'changes.jsonl'))
  const changes: Change[] = []
  console.log(
    `[redecide] ${apply ? 'APPLY: writes to the Vault' : 'dry run (read-only, nothing is written)'} · rules ${deps.currentVersion} · ` +
      `mailboxes ${mailboxes.length ? mailboxes.join(',') : 'all'} · status ${statuses.length ? statuses.join(',') : 'all'}` +
      `${since ? ` · since ${since}` : ''}${limit != null ? ` · limit ${limit}` : ''} · concurrency ${concurrency} · universe ${deps.universe.deals.length} deals (${Math.round((Date.now() - t0) / 1000)}s) · out ${dir}`,
  )

  const report = await runRedecide(
    {
      apply,
      mailboxes,
      statuses,
      since,
      limit,
      concurrency,
      batchSize,
      deadline,
      shouldStop: () => stop,
      onBatch: (p) => {
        const rate = p.elapsedMs ? (p.processedRows / (p.elapsedMs / 1000)).toFixed(1) : '0'
        const changed = Object.entries(p.byTransition)
          .filter(([k]) => k !== 'unchanged')
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')
        console.log(`[redecide] ${p.processedRows}/${p.selectedRows} rows · ${Math.round(p.elapsedMs / 1000)}s · ${rate}/s · unchanged ${p.byTransition.unchanged ?? 0}${changed ? ` · ${changed}` : ''}`)
      },
      onChange: (row) => {
        changes.push(row)
        jsonl.write(`${JSON.stringify(row)}\n`)
      },
    },
    deps,
  )
  await new Promise<void>((resolve) => jsonl.end(resolve))

  const cols = [
    'mailbox', 'gmail_id', 'message_key', 'transition', 'move_kind', 'old_status', 'new_status', 'old_deal', 'new_deal',
    'old_deal_id', 'new_deal_id', 'old_cycle_id', 'new_cycle_id', 'protection', 'internal_at', 'subject', 'reasons',
    'documents_to_archive', 'documents_kept', 'offers_left', 'note',
  ]
  const lines = [cols.join(',')]
  for (const c of changes) {
    lines.push(
      [
        c.mailbox, c.gmailId, c.messageKey, c.transition, c.moveKind, c.oldStatus, c.newStatus, c.oldDeal, c.newDeal,
        c.oldDealId, c.newDealId, c.oldCycleId, c.newCycleId, c.protection, c.internalAt, c.subject, c.reasons,
        c.documents?.archive.length ?? '', c.documents?.keep.length ?? '', c.documents?.offersLeft ?? '', c.note,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  fs.writeFileSync(path.join(dir, 'changes.csv'), `${lines.join('\n')}\n`)
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(report, null, 2))

  // ── the human part ──
  const order = TRANSITIONS as readonly string[]
  const seen = new Set<string>()
  for (const mb of Object.values(report.rowsByMailbox)) for (const k of Object.keys(mb)) seen.add(k)
  const present = order.filter((t) => seen.has(t))
  console.log(`\n[redecide] rows per transition per mailbox (${report.processedRows} of ${report.selectedRows} selected rows; ${report.staleRows} rows under another rules version):`)
  console.log(['mailbox'.padEnd(34), ...present.map((t) => t.padStart(11))].join(''))
  const totals: Record<string, number> = {}
  for (const [mb, row] of Object.entries(report.rowsByMailbox).sort()) {
    console.log([mb.padEnd(34), ...present.map((t) => String(row[t] ?? 0).padStart(11))].join(''))
    for (const t of present) totals[t] = (totals[t] ?? 0) + (row[t] ?? 0)
  }
  console.log(['TOTAL'.padEnd(34), ...present.map((t) => String(totals[t] ?? 0).padStart(11))].join(''))
  console.log('\n[redecide] messages (one per RFC Message-ID, mailbox copies decided together):', report.messagesByTransition)
  console.log('[redecide] moves:', report.moveKinds, '· protected by:', report.protectedBy)
  console.log('[redecide] documents:', report.documents)
  if (report.divergences.length) console.log(`[redecide] live path disagreed with the dry decision ${report.divergences.length} times:`, report.divergences.slice(0, 20))
  if (report.errors.length) console.log(`[redecide] errors (${report.errors.length}, first 10):`, report.errors.slice(0, 10))
  console.log(`[redecide] load ${Math.round(report.loadMs / 1000)}s · decide timing (ms):`, report.decide, '· Gmail:', report.gmail)
  console.log(`[redecide] messages an --apply sends through the live path (a second Gmail read each): ${report.livePathMessages}`)
  console.log(`[redecide] held back until their thread settled: ${report.deferred} · left for the next run: ${report.leftForNextRun}`)
  if (apply) console.log('[redecide] review rows stamped:', report.stamped)

  for (const t of order) {
    const s = report.samples[t]
    if (!s?.length || t === 'unchanged') continue
    console.log(`\n── ${t} (${totals[t] ?? 0} rows; ${s.length} samples) ──`)
    for (const c of s) {
      const from = c.oldDeal ? `${c.oldStatus} on ${c.oldDeal}` : c.oldStatus
      const to = c.newDeal ? `${c.newStatus} on ${c.newDeal}` : (c.newStatus ?? '-')
      console.log(`  ${c.internalAt?.slice(0, 10) ?? '?'} ${c.mailbox.split('@')[0]} · "${(c.subject ?? '').slice(0, 90)}"`)
      console.log(`      ${from}  →  ${to}${c.moveKind ? ` (${c.moveKind})` : ''}${c.protection ? ` [${c.protection}]` : ''}`)
      if (c.reasons.length) console.log(`      reasons: ${c.reasons.slice(-3).join(' | ').slice(0, 300)}`)
      if (c.documents) console.log(`      documents: archive ${c.documents.archive.length}, keep ${c.documents.keep.length}${c.documents.keep.length ? ` (${c.documents.keep.map((k) => k.reason).join('; ').slice(0, 200)})` : ''}, offers left ${c.documents.offersLeft}`)
      if (c.note) console.log(`      note: ${c.note}`)
    }
  }
  console.log(
    `\n[redecide] ${report.complete ? 'COMPLETE' : 'PARTIAL (limit/deadline/stop): run again to continue'} · ${Math.round(report.elapsedMs / 1000)}s · ${apply ? 'applied' : 'nothing written'} · ${dir}`,
  )
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'audit') return auditOrReconcile(false)
  if (mode === 'reconcile') return auditOrReconcile(true)
  if (mode === 'redecide') return redecide()
  const { loadMailUniverse, sweepDealMail, sweepTransactionMail, rematchQueuedMail } = await import('@/lib/tc/mail-index')
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const universe = await loadMailUniverse(sb)
  const dryRun = has('--dry-run')
  if (mode === 'review-retry') {
    const { retryReviewErrors } = await import('@/lib/tc/mail-index')
    console.log(JSON.stringify(await retryReviewErrors({ sb, modelStage: has('--model-stage') })))
    return
  }
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
  if (mode === 'refile-threads') {
    const { refileThreadSiblings } = await import('@/lib/tc/mail-index')
    console.log(await refileThreadSiblings({ universe, sb, limit: arg('--limit') ? Number(arg('--limit')) : undefined }))
    return
  }
  if (mode === 'rematch') {
    console.log(await rematchQueuedMail({ universe, sb, limit: Number(arg('--limit') ?? 500), modelStage: has('--model-stage') }))
    return
  }
  if (mode === 'review-all') {
    const { reviewMailbox } = await import('@/lib/tc/mail-index')
    const { CRM_MAILBOXES } = await import('@/lib/crm/gmail')
    const only = arg('--mailbox')
    const mailboxes = only ? CRM_MAILBOXES.filter((m) => m.email === only) : CRM_MAILBOXES
    if (!mailboxes.length) {
      console.error(`[review-all] no mailbox matches ${only}`)
      process.exit(2)
    }
    const concurrency = Number(arg('--concurrency') ?? 4)
    const limitArg = arg('--limit')
    const limit = limitArg ? Number(limitArg) : undefined
    const modelStage = has('--model-stage')
    const totals: Record<string, number> = {}
    for (const mb of mailboxes) {
      console.log(`[review-all] ${mb.email}: starting${dryRun ? ' (dry run, read-only)' : ''}${modelStage ? ' with model stage' : ''}${limit ? ` (limit ${limit})` : ''}`)
      const res = await reviewMailbox({
        mailbox: mb.email,
        universe,
        concurrency,
        limit,
        dryRun,
        modelStage,
        sb,
        onPage: (p) => console.log(`[review-all] ${p.mailbox}: page done — listed ${p.listed}, reviewed ${p.reviewed}, skipped ${p.skipped}, errors ${p.errors}`),
      })
      console.log(
        `[review-all] ${mb.email}: listed ${res.listed}, reviewed ${res.reviewed}, skipped ${res.skipped}, errors ${res.errors}, ${
          res.finished ? 'FINISHED (full history reviewed)' : res.complete ? 'stopped (limit reached)' : 'stopped (deadline/limit mid-page — resumes next run)'
        }`,
      )
      console.log(`[review-all] ${mb.email} by status:`, res.byStatus)
      for (const [k, v] of Object.entries(res.byStatus)) totals[k] = (totals[k] ?? 0) + v
    }
    console.log('[review-all] status distribution across mailboxes walked this run:', totals)
    return
  }
  console.error('usage: tc-mail-backfill.ts audit|reconcile|sweep-deals|sweep-transactions|rematch|refile-threads|review-all|review-retry|redecide [--since YYYY-MM-DD] [--dry-run]')
  process.exit(2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
