/**
 * /api/cron/tc-mail-sweep — the Vault mail index's daily pass (docs/TC_MAIL_FILING_RULES.md).
 *
 * 1. Re-decide queued mail against today's deals (a file opened this morning
 *    collects the offer that arrived last week), then open a file for any
 *    property whose queued mail proves a deal is under way (escrow opened, a
 *    settlement statement, a fully executed agreement). Replies decided before
 *    their thread filed are decided again and follow the thread.
 * 2. Search every broker mailbox for each open or recently closed deal's
 *    address, escrow and MLS numbers since its last sweep (all history on the
 *    first sweep). Post-close title and settlement mail lands here.
 * 3. Search every mailbox for offer / counter / escrow mail by subject from the
 *    last three days, so an offer we never answered is still a record.
 * 4. "Every message reviewed": with whatever budget is left, continue the
 *    full-history reviewer (reviewMailbox) for any mailbox that has not yet
 *    walked its whole history — deal-term searches above only ever look for
 *    mail that matches a deal; this is the pass that puts a record on EVERY
 *    message, including the ones that are not a deal at all.
 *
 * The 15-minute CRM Gmail sync indexes new mail as it arrives; this pass
 * catches what the stream cannot see. ?deal=<uuid> sweeps one deal, all history.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { getCrmMailboxes } from '@/lib/data/brokers/directory'
import {
  autoOpenFilesFromMail,
  loadMailUniverse,
  refileThreadSiblings,
  rematchQueuedMail,
  reviewMailbox,
  sweepDealMail,
  sweepTransactionMail,
} from '@/lib/tc/mail-index'
import { dealOpenAt } from '@/lib/tc/mail-rules'
import { ensureDealPartiesFromFile } from '@/lib/data/tc/deal-people'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUDGET_MS = 240_000
const OVERLAP_MS = 2 * 86_400_000

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const start = Date.now()
  const sb = createServiceClient()
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', { p_name: 'tc-mail-sweep', p_lease_seconds: 300 })
  if (gotLease === false) return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  try {
    const url = new URL(request.url)
    const only = url.searchParams.get('deal')
    const universe = await loadMailUniverse(sb)

    if (only) {
      const res = await sweepDealMail({ dealId: only, universe, deadline: start + BUDGET_MS, sb })
      return NextResponse.json({ ok: !!res, deal: only, res, ms: Date.now() - start })
    }

    // Each step stops at the shared deadline; what it did not reach waits for the next run.
    const deadline = start + BUDGET_MS
    const rematch = await rematchQueuedMail({ universe, sb, limit: 200, deadline: start + BUDGET_MS / 3, modelStage: true })
    // Transaction mail proving a deal is under way for a property with no file opens the file.
    const opened = await autoOpenFilesFromMail({ sb })
    // Replies decided before their thread filed follow the thread now.
    const threads = await refileThreadSiblings({ universe, sb, deadline: start + BUDGET_MS / 2 })

    const { data: swept } = await sb.from('tc_deals').select('id, mail_swept_at')
    const sweptAt = new Map((swept ?? []).map((d) => [String(d.id), (d.mail_swept_at as string | null) ?? null]))
    const now = new Date().toISOString()
    // Open deals first, oldest sweep first; a deal never swept gets all history.
    const due = universe.deals
      .filter((d) => dealOpenAt(d, now))
      .sort((a, b) => (sweptAt.get(a.dealId) ?? '').localeCompare(sweptAt.get(b.dealId) ?? ''))
    const deals: Array<{ dealId: string; seen: number; skipped: number; filed: number; queued: number; complete: boolean }> = []
    for (const d of due) {
      if (Date.now() > deadline) break
      const last = sweptAt.get(d.dealId)
      const since = last ? new Date(Date.parse(last) - OVERLAP_MS).toISOString() : null
      // A first sweep (all history) larger than one run stops at the deadline
      // unmarked; the next run skips what this one stored and finishes it.
      const res = await sweepDealMail({ dealId: d.dealId, since, universe, deadline, sb })
      if (res) deals.push({ dealId: d.dealId, seen: res.seen, skipped: res.skipped, filed: res.filed, queued: res.queued, complete: res.complete })
    }

    // Live files: search the mailboxes for a party's missing email and the
    // deal's missing facts (other agent, escrow number, lender, offers). This
    // used to run on every file page view and made it wait 30+ seconds.
    const harvested: string[] = []
    for (const d of due) {
      if (Date.now() > start + (BUDGET_MS * 2) / 3) break
      if (d.stage !== 'pending' && d.stage !== 'active_listing' && d.stage !== 'pre_contract') continue
      try {
        await ensureDealPartiesFromFile(d.dealId, { harvest: true })
        harvested.push(d.dealId)
      } catch (err) {
        console.warn('[tc-mail-sweep] harvest', d.dealId, err instanceof Error ? err.message : err)
      }
    }

    let transactions = null
    if (Date.now() < deadline) {
      transactions = await sweepTransactionMail({
        since: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        universe,
        sb,
        maxPerMailbox: 300,
        deadline,
      })
    }

    // "Every message reviewed": whatever is left of the budget continues the
    // full-history reviewer for any mailbox not yet finished. One mailbox at a
    // time so a slow one does not starve the next; a mailbox already finished
    // returns instantly (no Gmail calls) and costs nothing.
    const reviewAll: Array<{ mailbox: string; listed: number; reviewed: number; errors: number; finished: boolean; complete: boolean }> = []
    for (const mb of await getCrmMailboxes()) {
      if (Date.now() > deadline) break
      const res = await reviewMailbox({ mailbox: mb.email, universe, deadline, sb })
      reviewAll.push({ mailbox: mb.email, listed: res.listed, reviewed: res.reviewed, errors: res.errors, finished: res.finished, complete: res.complete })
      if (!res.complete) break
    }

    return NextResponse.json({
      ok: true,
      rematch,
      opened,
      threads,
      harvested: harvested.length,
      deals,
      dealsDue: due.length,
      transactions: transactions && { seen: transactions.seen, filed: transactions.filed, queued: transactions.queued, offers: transactions.offers, errors: transactions.errors },
      reviewAll,
      ms: Date.now() - start,
    })
  } finally {
    await sb.rpc('crm_release_cron_lease', { p_name: 'tc-mail-sweep' })
  }
}
