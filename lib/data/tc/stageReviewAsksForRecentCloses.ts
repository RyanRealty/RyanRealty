/**
 * Stage Google review-ask drafts for real closings in the Vault. Never sends.
 *
 * Source of closings: the Vault (CLAUDE.md §8), a sale cycle with an actual
 * close (`tc_cycles.kind = 'sale'`, status Closed, `actual_closing_date`),
 * whoever recorded it: the SkySlope intake, the MLS close rule, or a broker.
 * Parties: the file's buyer and seller CRM people (`tc_deal_people`).
 *
 * Why the old 14-day scan never asked a real client (2026-10-14 trace): it
 * kept a deal only when its close date was within 14 days of the run, but
 * closings reach the Vault late. The one-time SkySlope import (2026-06-10)
 * took in nothing after it ran, the daily intake began 2026-09-24, and the
 * MLS close rule records a folder SkySlope let lapse days after the close
 * (909 NW Delaware: closed 09-18, recorded 10-01). Every real closing arrived
 * outside the window. The two real drafts it ever wrote (2026-09-25) came from
 * a fallback that read a cycle's created_at as its close date.
 *
 * Now: every real closing in the last REVIEW_ASK_CLOSE_LOOKBACK_DAYS, each
 * party once, ever (crm_timeline ledger), never a test file, a test or
 * internal person, an industry contact, someone already asked, or over a
 * broker's own draft. Every draft lands in Matt's Drafts (REVIEW_ASK_APPROVER_SLUG):
 * each send needs his yes. Raw `.from()` stays in lib/data (G1).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { ensureBrokerDirectory } from '@/lib/data/brokers/directory'
import { brokerByFileName, brokerDisplayName } from '@/lib/brokers/directory'
import { isTestFile } from '@/lib/tc/dashboard'
import {
  decideReviewAskFor,
  getReviewAskFacts,
  recordReviewAskLedger,
  stageReviewAskDraft,
} from '@/lib/data/crm/stageReviewAskDraft'
import {
  REVIEW_ASK_APPROVER_SLUG,
  REVIEW_ASK_CLOSE_LOOKBACK_DAYS,
  buildReviewAskBody,
  buildReviewAskText,
  isReviewAskDraft,
  reviewAskClosingParties,
  reviewAskFirstName,
  reviewAskLedgerKey,
  reviewAskSignerName,
  reviewAskSince,
  type ReviewAskSkip,
  type VaultClosing,
} from '@/lib/crm/review-ask'

export type RecentCloseAskSummary = {
  /** Real closings in the window (test files left out). */
  dealsScanned: number
  /** Real closings with no buyer or seller linked on the file: nobody to ask. */
  dealsWithoutParties: number
  partiesConsidered: number
  created: number
  already: number
  skippedExisting: number
  skipped: Partial<Record<ReviewAskSkip, number>>
  errors: number
  /** True when nothing was written (dry run). */
  dryRun: boolean
}

function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Real sale closings in [since, today] with their buyer and seller parties. */
export async function listVaultClosingsForReviewAsk(since: string, today: string): Promise<VaultClosing[]> {
  const sb = createServiceClient()
  const cycles = await fetchPagedRows<{ id: string; deal_id: string; status: string | null; actual_closing_date: string }>(
    (from, to) =>
      sb
        .from('tc_cycles')
        .select('id, deal_id, status, actual_closing_date')
        .eq('kind', 'sale')
        .ilike('status', 'closed%')
        .gte('actual_closing_date', since)
        .lte('actual_closing_date', today)
        .order('id', { ascending: true })
        .range(from, to),
  )
  if (cycles.error) throw new Error(`tc_cycles read failed: ${cycles.error.message}`)
  const newest = new Map<string, string>()
  for (const c of cycles.rows) {
    const day = String(c.actual_closing_date).slice(0, 10)
    const prev = newest.get(c.deal_id)
    if (!prev || day > prev) newest.set(c.deal_id, day)
  }
  const dealIds = [...newest.keys()]
  if (dealIds.length === 0) return []

  const deals = new Map<string, { address: string; broker_name: string | null; stage_detail: string | null }>()
  const parties = new Map<string, Array<{ personId: number; role: string }>>()
  for (let i = 0; i < dealIds.length; i += 200) {
    const part = dealIds.slice(i, i + 200)
    const [d, p] = await Promise.all([
      sb.from('tc_deals').select('id, address, broker_name, stage_detail').in('id', part),
      fetchPagedRows<{ id: string; deal_id: string; person_id: number; role: string }>((from, to) =>
        sb
          .from('tc_deal_people')
          .select('id, deal_id, person_id, role')
          .in('deal_id', part)
          .in('role', ['buyer', 'seller'])
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ])
    if (d.error) throw new Error(`tc_deals read failed: ${d.error.message}`)
    if (p.error) throw new Error(`tc_deal_people read failed: ${p.error.message}`)
    for (const row of d.data ?? []) {
      deals.set(String(row.id), {
        address: String(row.address ?? ''),
        broker_name: (row.broker_name as string | null) ?? null,
        stage_detail: (row.stage_detail as string | null) ?? null,
      })
    }
    for (const row of p.rows) {
      const list = parties.get(row.deal_id) ?? []
      list.push({ personId: Number(row.person_id), role: String(row.role) })
      parties.set(row.deal_id, list)
    }
  }

  const out: VaultClosing[] = []
  for (const [dealId, closeDate] of newest) {
    const deal = deals.get(dealId)
    if (!deal) continue
    out.push({
      dealId,
      address: deal.address,
      brokerName: deal.broker_name,
      stageDetail: deal.stage_detail,
      closeDate,
      parties: parties.get(dealId) ?? [],
    })
  }
  return out
}

export async function stageReviewAsksForRecentCloses(
  opts: { dryRun?: boolean; now?: Date; lookbackDays?: number } = {},
): Promise<RecentCloseAskSummary> {
  const dryRun = opts.dryRun === true
  const today = todayIso(opts.now)
  const days = opts.lookbackDays ?? REVIEW_ASK_CLOSE_LOOKBACK_DAYS
  const summary: RecentCloseAskSummary = {
    dealsScanned: 0,
    dealsWithoutParties: 0,
    partiesConsidered: 0,
    created: 0,
    already: 0,
    skippedExisting: 0,
    skipped: {},
    errors: 0,
    dryRun,
  }

  await ensureBrokerDirectory()
  const closings = await listVaultClosingsForReviewAsk(reviewAskSince(today, days), today)
  const pairs = reviewAskClosingParties(closings, today, days)
  const realDeals = new Set(pairs.map((p) => p.closing.dealId))
  const scanned = closings.filter((c) => !isTestFile({ stageDetail: c.stageDetail, address: c.address }))
  summary.dealsScanned = scanned.length
  summary.dealsWithoutParties = scanned.filter((c) => !realDeals.has(c.dealId)).length
  summary.partiesConsidered = pairs.length
  if (pairs.length === 0) return summary

  const owner = REVIEW_ASK_APPROVER_SLUG
  const signer = reviewAskSignerName(brokerDisplayName(owner))
  const facts = await getReviewAskFacts(
    pairs.map((p) => p.personId),
    owner,
  )

  for (const { closing, personId } of pairs) {
    const f = facts.get(personId)
    if (!f) {
      summary.errors += 1
      console.error('[stageReviewAsksForRecentCloses] person not found', personId)
      continue
    }
    const decision = await decideReviewAskFor(f, 'closing')
    if (!decision.stage) {
      if (decision.reason === 'already-drafted' && f.history.pendingDraft) {
        summary.already += 1
        // A draft staged before the ledger existed (2026-09-25): record it now,
        // so a discard is final rather than re-drafted the next morning.
        if (!dryRun && !f.history.draftedAt) {
          const wrote = await recordReviewAskLedger({
            personId,
            ownerSlug: owner,
            channel: f.drafts.email && isReviewAskDraft(f.drafts.email) ? 'email' : 'text',
            ledgerKey: reviewAskLedgerKey({ personId, dealId: closing.dealId }),
            path: 'closing',
            dealId: closing.dealId,
          })
          if (!wrote.ok) {
            summary.errors += 1
            console.error('[stageReviewAsksForRecentCloses] ledger', personId, wrote.error)
          }
        }
      } else if (decision.reason === 'draft-slot-taken') summary.skippedExisting += 1
      else summary.skipped[decision.reason] = (summary.skipped[decision.reason] ?? 0) + 1
      continue
    }
    const dealBroker = brokerByFileName(closing.brokerName)
    const draftInput = {
      firstName: reviewAskFirstName(f.person.firstName, f.person.name),
      address: closing.address,
      signerFirstName: signer,
      dealBrokerFirstName: dealBroker && dealBroker.slug !== owner ? reviewAskSignerName(dealBroker.fileName) : null,
    }
    if (dryRun) {
      summary.created += 1
      continue
    }
    const staged = await stageReviewAskDraft({
      personId,
      ownerSlug: owner,
      channel: decision.channel,
      body: decision.channel === 'email' ? buildReviewAskBody(draftInput) : buildReviewAskText(draftInput),
      ledgerKey: reviewAskLedgerKey({ personId, dealId: closing.dealId }),
      path: 'closing',
      dealId: closing.dealId,
    })
    if (!staged.ok) {
      summary.errors += 1
      console.error('[stageReviewAsksForRecentCloses] draft', personId, staged.error)
      continue
    }
    if (staged.action === 'created') summary.created += 1
    else if (staged.action === 'already') summary.already += 1
    else summary.skippedExisting += 1
  }
  return summary
}

/**
 * Each person's newest real closing on a Vault file where they are the buyer
 * or seller, so a picked ask can thank them for the right property. A person
 * with no closed file is absent (the ask then says "your home").
 */
export async function latestVaultClosingByPerson(personIds: readonly number[]): Promise<Map<number, VaultClosing>> {
  const ids = [...new Set(personIds.filter((id) => Number.isInteger(id) && id > 0))]
  const out = new Map<number, VaultClosing>()
  if (ids.length === 0) return out
  const sb = createServiceClient()
  const links: Array<{ deal_id: string; person_id: number }> = []
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200)
    const res = await fetchPagedRows<{ id: string; deal_id: string; person_id: number }>((from, to) =>
      sb
        .from('tc_deal_people')
        .select('id, deal_id, person_id')
        .in('person_id', part)
        .in('role', ['buyer', 'seller'])
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (res.error) throw new Error(`tc_deal_people read failed: ${res.error.message}`)
    links.push(...res.rows)
  }
  const dealIds = [...new Set(links.map((l) => l.deal_id))]
  if (dealIds.length === 0) return out
  const closings = new Map<string, VaultClosing>()
  for (let i = 0; i < dealIds.length; i += 200) {
    const part = dealIds.slice(i, i + 200)
    const [cycles, deals] = await Promise.all([
      fetchPagedRows<{ id: string; deal_id: string; actual_closing_date: string }>((from, to) =>
        sb
          .from('tc_cycles')
          .select('id, deal_id, actual_closing_date')
          .in('deal_id', part)
          .eq('kind', 'sale')
          .ilike('status', 'closed%')
          .not('actual_closing_date', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      sb.from('tc_deals').select('id, address, broker_name, stage_detail').in('id', part),
    ])
    if (cycles.error) throw new Error(`tc_cycles read failed: ${cycles.error.message}`)
    if (deals.error) throw new Error(`tc_deals read failed: ${deals.error.message}`)
    const byId = new Map((deals.data ?? []).map((d) => [String(d.id), d]))
    for (const c of cycles.rows) {
      const deal = byId.get(c.deal_id)
      if (!deal) continue
      const day = String(c.actual_closing_date).slice(0, 10)
      const prev = closings.get(c.deal_id)
      if (prev && prev.closeDate >= day) continue
      closings.set(c.deal_id, {
        dealId: c.deal_id,
        address: String(deal.address ?? ''),
        brokerName: (deal.broker_name as string | null) ?? null,
        stageDetail: (deal.stage_detail as string | null) ?? null,
        closeDate: day,
        parties: [],
      })
    }
  }
  for (const link of links) {
    const c = closings.get(link.deal_id)
    if (!c || isTestFile({ stageDetail: c.stageDetail, address: c.address })) continue
    const prev = out.get(link.person_id)
    if (!prev || c.closeDate > prev.closeDate) out.set(link.person_id, c)
  }
  return out
}
