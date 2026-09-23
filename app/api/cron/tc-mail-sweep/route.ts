/**
 * /api/cron/tc-mail-sweep — the Vault mail index's daily pass (docs/TC_MAIL_FILING_RULES.md).
 *
 * 1. Re-decide queued mail against today's deals (a file opened this morning
 *    collects the offer that arrived last week), then open a file for any
 *    property whose queued mail proves a deal is under way (escrow opened, a
 *    settlement statement, a fully executed agreement).
 * 2. Search every broker mailbox for each open or recently closed deal's
 *    address, escrow and MLS numbers since its last sweep (all history on the
 *    first sweep). Post-close title and settlement mail lands here.
 * 3. Search every mailbox for offer / counter / escrow mail by subject from the
 *    last three days, so an offer we never answered is still a record.
 *
 * The 15-minute CRM Gmail sync indexes new mail as it arrives; this pass
 * catches what the stream cannot see. ?deal=<uuid> sweeps one deal, all history.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { autoOpenFilesFromMail, loadMailUniverse, rematchQueuedMail, sweepDealMail, sweepTransactionMail } from '@/lib/tc/mail-index'
import { dealOpenAt } from '@/lib/tc/mail-rules'

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
      const res = await sweepDealMail({ dealId: only, universe, sb })
      return NextResponse.json({ ok: !!res, deal: only, res, ms: Date.now() - start })
    }

    const rematch = await rematchQueuedMail({ universe, sb, limit: 200 })
    // Transaction mail proving a deal is under way for a property with no file opens the file.
    const opened = await autoOpenFilesFromMail({ sb })

    const { data: swept } = await sb.from('tc_deals').select('id, mail_swept_at')
    const sweptAt = new Map((swept ?? []).map((d) => [String(d.id), (d.mail_swept_at as string | null) ?? null]))
    const now = new Date().toISOString()
    // Open deals first, oldest sweep first; a deal never swept gets all history.
    const due = universe.deals
      .filter((d) => dealOpenAt(d, now))
      .sort((a, b) => (sweptAt.get(a.dealId) ?? '').localeCompare(sweptAt.get(b.dealId) ?? ''))
    const deals: Array<{ dealId: string; seen: number; filed: number; queued: number }> = []
    for (const d of due) {
      if (Date.now() - start > BUDGET_MS) break
      const last = sweptAt.get(d.dealId)
      const since = last ? new Date(Date.parse(last) - OVERLAP_MS).toISOString() : null
      const res = await sweepDealMail({ dealId: d.dealId, since, universe, sb })
      if (res) deals.push({ dealId: d.dealId, seen: res.seen, filed: res.filed, queued: res.queued })
    }

    let transactions = null
    if (Date.now() - start < BUDGET_MS) {
      transactions = await sweepTransactionMail({
        since: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        universe,
        sb,
        maxPerMailbox: 300,
      })
    }
    return NextResponse.json({
      ok: true,
      rematch,
      opened,
      deals,
      dealsDue: due.length,
      transactions: transactions && { seen: transactions.seen, filed: transactions.filed, queued: transactions.queued, offers: transactions.offers, errors: transactions.errors },
      ms: Date.now() - start,
    })
  } finally {
    await sb.rpc('crm_release_cron_lease', { p_name: 'tc-mail-sweep' })
  }
}
