import 'server-only'

/**
 * CMA / audit / BPO send performance (Brain Dump 2, A7 — "I need to be able to
 * see how those emails are performing").
 *
 * The measurement plumbing already existed and was never surfaced: email opens
 * and clicks land in `email_events` keyed `cma:<slug>`, document page views land
 * in `visitor_events` under `page_category='client-document'`, and SMS
 * short-link taps land in `crm_timeline`. All three were aggregated per-doc for
 * the prospecting worklist and rendered as one thin line on a card. This reader
 * turns them into a report.
 *
 * Bounded by construction: the caller passes a page size, and the engagement
 * read is scoped to that page's slugs — never the whole table (spec §7).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getDocEngagement } from '@/lib/data/prospecting/engagement'
import type { ProspectEngagement } from '@/lib/data/prospecting/types'

export type CmaPerformanceRow = {
  id: string
  slug: string
  docType: string
  subjectAddress: string
  subjectCity: string | null
  clientName: string | null
  clientEmail: string | null
  recommendedList: number | null
  status: string
  createdAt: string
  /** delivered_at is the send stamp the publisher writes. Null = never sent. */
  deliveredAt: string | null
  engagement: ProspectEngagement
}

export type CmaPerformanceSummary = {
  /** Documents built in the window. */
  built: number
  /** Of those, how many were actually sent. */
  sent: number
  /** Of the SENT ones, how many were opened / viewed / touched at all. */
  opened: number
  viewed: number
  anyActivity: number
}

export type CmaPerformanceResult = {
  rows: CmaPerformanceRow[]
  summary: CmaPerformanceSummary
  total: number
}

export type CmaPerformanceFilters = {
  /** 'all' | a doc_type value ('cma' | 'expired-audit' | 'bpo'). */
  docType?: string
  /** Only documents that were actually sent. */
  sentOnly?: boolean
  page?: number
  pageSize?: number
}

type RawRow = Record<string, unknown>

/**
 * One page of send performance, newest first.
 *
 * The summary counts are computed over the FULL matching set (the `cmas` table
 * is ~200 rows, so this is a single cheap read) while the expensive engagement
 * join is scoped to the visible page. That is the same split the prospecting
 * worklist uses, and it is what keeps the funnel percentages honest — a summary
 * computed over one page would describe the page, not the funnel.
 */
export async function getCmaPerformance(filters: CmaPerformanceFilters = {}): Promise<CmaPerformanceResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const pageSize = Math.min(Math.max(Math.floor(filters.pageSize ?? 50), 1), 200)
  const sb = createServiceClient()

  let q = sb
    .from('cmas')
    .select(
      'id, slug, doc_type, subject_address, subject_city, client_name, client_email, recommended_list, status, created_at, delivered_at',
    )
    .neq('status', 'archived')
  if (filters.docType && filters.docType !== 'all') q = q.eq('doc_type', filters.docType)
  if (filters.sentOnly) q = q.not('delivered_at', 'is', null)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
  if (error) {
    // Surface an empty report rather than a wrong one. A reporting surface must
    // never invent numbers (§0); zero rows with a visible error beats a
    // partially-populated funnel that reads as fact.
    console.error('[cma] getCmaPerformance read failed:', error.message)
    return { rows: [], summary: { built: 0, sent: 0, opened: 0, viewed: 0, anyActivity: 0 }, total: 0 }
  }

  const all = (data ?? []) as RawRow[]
  const total = all.length
  const slice = all.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

  // Engagement over the FULL matching set, not just the visible page.
  //
  // This deliberately breaks the "scope the expensive read to the page" rule the
  // prospecting worklist follows, because here the read FEEDS THE FUNNEL. A
  // summary that counts `sent` over 211 documents but `opened` over the 50 on
  // screen is not a slower report, it is a WRONG one — it would render an open
  // rate of 8/211 when the real answer is 8/50-of-211. The `cmas` table is ~211
  // rows and the reader chunks internally, so correctness is affordable here.
  const engagement = await getDocEngagement(
    all.map((r) => ({ id: String(r.id), slug: String(r.slug), personId: null })),
  )

  const rows: CmaPerformanceRow[] = slice.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    docType: String(r.doc_type ?? 'cma'),
    subjectAddress: String(r.subject_address ?? '—'),
    subjectCity: (r.subject_city as string | null) ?? null,
    clientName: (r.client_name as string | null) ?? null,
    clientEmail: (r.client_email as string | null) ?? null,
    recommendedList: r.recommended_list == null ? null : Number(r.recommended_list),
    status: String(r.status ?? 'draft'),
    createdAt: String(r.created_at),
    deliveredAt: (r.delivered_at as string | null) ?? null,
    engagement: engagement[String(r.id)] ?? {
      reportViews: 0,
      linkTaps: 0,
      emailOpens: 0,
      emailClicks: 0,
      lastActivityAt: null,
    },
  }))

  // Funnel over the FULL matching set — every stage counted on the same
  // denominator, so the rates mean what they say. Only SENT documents can be
  // opened or viewed, so each downstream stage is gated on delivered_at.
  const sent = all.filter((r) => r.delivered_at != null)
  const eng = (r: RawRow) => engagement[String(r.id)]
  const summary: CmaPerformanceSummary = {
    built: total,
    sent: sent.length,
    opened: sent.filter((r) => (eng(r)?.emailOpens ?? 0) > 0).length,
    viewed: sent.filter((r) => (eng(r)?.reportViews ?? 0) > 0).length,
    anyActivity: sent.filter((r) => eng(r)?.lastActivityAt != null).length,
  }

  return { rows, total, summary }
}
