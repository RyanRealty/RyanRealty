/**
 * The principal broker's record check, deal by deal (lib/tc/audit/records.ts):
 * what Oregon requires each transaction file to hold, whether the Vault holds
 * it, and the rule that requires it. Read-only. Raw .from() stays here (G1).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { auditDeal, auditScore, type AuditDoc, type AuditInput, type AuditRow } from '@/lib/tc/audit/records'

export type DealAudit = {
  dealId: string
  propertyKey: string
  address: string
  stage: string
  broker: string | null
  side: AuditInput['side']
  rows: AuditRow[]
  score: ReturnType<typeof auditScore>
}

type ReaderForm = { form?: string; profile?: string | null; verdict?: string; checked_against?: string | null }

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data: raw, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    const data = raw as T[] | null
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

function sideOf(cycles: ReadonlyArray<{ kind: string; deal_type: string | null }>): AuditInput['side'] {
  const types = cycles.map((c) => (c.deal_type ?? '').toLowerCase())
  if (types.some((t) => t.includes('both'))) return 'both'
  const listing = cycles.some((c) => c.kind === 'listing') || types.some((t) => t === 'listing')
  const purchase = types.some((t) => t === 'purchase')
  if (listing && purchase) return 'both'
  return purchase && !listing ? 'buyer' : 'seller'
}

export async function listDealAudits(opts: { dealId?: string } = {}): Promise<DealAudit[]> {
  const sb = createServiceClient()
  let dq = sb.from('tc_deals').select('id, property_key, address, stage, stage_detail, broker_name')
  if (opts.dealId) dq = dq.eq('id', opts.dealId)
  const { data: allDeals, error } = await dq
  if (error) throw new Error(error.message)
  // Test files are not transactions: the alias harness's file and the placeholder test deal.
  const deals = (allDeals ?? []).filter((d) => !String(d.stage_detail ?? '').startsWith('TC TEST') && !/^\d+\s+test\s+street\b/i.test(String(d.address)))
  const dealIds = (deals ?? []).map((d) => String(d.id))
  if (!dealIds.length) return []

  const cycles = await all<{ id: string; deal_id: string; kind: string; source: string; deal_type: string | null; year_built: string | null }>((a, b) =>
    sb.from('tc_cycles').select('id, deal_id, kind, source, deal_type:raw->>dealType, year_built:raw->property->>yearBuilt').in('deal_id', dealIds).range(a, b),
  )
  const cycleDeal = new Map(cycles.map((c) => [String(c.id), String(c.deal_id)]))
  const docs: Array<{ id: string; cycle_id: string; name: string; archived: boolean; ingested_at: string; reader: { forms?: ReaderForm[] } | null }> = []
  const cycleIds = cycles.map((c) => String(c.id))
  for (let i = 0; i < cycleIds.length; i += 100) {
    docs.push(
      ...(await all<(typeof docs)[number]>((a, b) =>
        sb
          .from('tc_documents')
          .select('id, cycle_id, name, archived, ingested_at, reader:classification->reader')
          .in('cycle_id', cycleIds.slice(i, i + 100))
          .eq('is_broker_notes', false)
          .range(a, b),
      )),
    )
  }
  const offers = await all<{ id: string; deal_id: string; buyer_name: string; status: string; submitted_at: string | null; presented_to_seller_at: string | null; replied_at: string | null; document_id: string | null }>((a, b) =>
    sb.from('tc_offers').select('id, deal_id, buyer_name, status, submitted_at, presented_to_seller_at, replied_at, document_id').in('deal_id', dealIds).range(a, b),
  )
  const reviews = await all<{ deal_id: string | null; document_ids: unknown; reviewed_at: string; decision: string }>((a, b) =>
    sb.from('tc_principal_reviews').select('deal_id, document_ids, reviewed_at, decision').in('deal_id', dealIds).range(a, b),
  )
  const items = await all<{ cycle_id: string; status: string }>((a, b) => sb.from('tc_checklist_items').select('cycle_id, status').in('cycle_id', cycleIds).range(a, b))
  const filed = await all<{ deal_id: string | null }>((a, b) => sb.from('tc_mail_messages').select('deal_id').eq('status', 'filed').in('deal_id', dealIds).range(a, b))
  const mailCount = new Map<string, number>()
  for (const m of filed) if (m.deal_id) mailCount.set(String(m.deal_id), (mailCount.get(String(m.deal_id)) ?? 0) + 1)

  return (deals ?? []).map((d) => {
    const id = String(d.id)
    const dc = cycles.filter((c) => String(c.deal_id) === id)
    const years = dc.map((c) => Number(c.year_built)).filter((y) => Number.isFinite(y) && y > 1800)
    const auditDocs: AuditDoc[] = docs
      .filter((x) => cycleDeal.get(String(x.cycle_id)) === id)
      .map((x) => ({
        id: String(x.id),
        name: String(x.name),
        archived: !!x.archived,
        ingestedAt: String(x.ingested_at),
        forms: (x.reader?.forms ?? []).map((f) => ({ profile: f.profile ?? null, form: f.form ?? '', verdict: f.verdict ?? 'needs_review', checkedAgainst: f.checked_against ?? null })),
      }))
    const input: AuditInput = {
      side: sideOf(dc),
      stage: String(d.stage),
      docs: auditDocs,
      offers: offers
        .filter((o) => String(o.deal_id) === id)
        .map((o) => ({ id: String(o.id), buyerName: o.buyer_name, status: o.status, submittedAt: o.submitted_at, presentedAt: o.presented_to_seller_at, repliedAt: o.replied_at, documentId: o.document_id })),
      reviews: reviews
        .filter((r) => String(r.deal_id) === id)
        .map((r) => ({ documentIds: Array.isArray(r.document_ids) ? (r.document_ids as unknown[]).map(String) : [], reviewedAt: r.reviewed_at, decision: r.decision })),
      mailFiled: mailCount.get(id) ?? 0,
      reviewSystem: dc.some((c) => c.source === 'skyslope') ? 'skyslope' : 'vault',
      checklist: (() => {
        const mine = items.filter((it) => cycleDeal.get(String(it.cycle_id)) === id)
        return { completed: mine.filter((it) => it.status === 'completed').length, inReview: mine.filter((it) => it.status === 'in_review').length }
      })(),
      yearBuilt: years.length ? Math.min(...years) : null,
    }
    const rows = auditDeal(input)
    return { dealId: id, propertyKey: String(d.property_key), address: String(d.address), stage: String(d.stage), broker: (d.broker_name as string | null) ?? null, side: input.side, rows, score: auditScore(rows) }
  })
}
