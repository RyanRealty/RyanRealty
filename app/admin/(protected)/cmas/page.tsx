// @no-parity — internal admin surface, no public mockup contract
//
// /admin/cmas — the Seller-CMA worklist. P11C: migrated to the LOCKED admin v2
// language (design_system/admin/ADMIN_UI.md) through the shared presentation
// kit (@/components/admin/v2). Presentation only — this file is the shell
// around CmaBoard, and the board is mounted unchanged.
//
// listCmasForAdmin (lib/data/sync/syncWrites.ts) filters to seller CMAs only
// (doc_type='cma') — expired-audit documents live in the prospecting worklist,
// not here. Filtering/pagination stay presentational in this page: the CMA
// table is a few hundred rows (docs/DATABASE_SCHEMA_SNAPSHOT.md), well inside
// one bounded window, so a second DAL surface isn't warranted for this size.
//
// Carried over verbatim: requireAdminPage('prospecting.view'), WINDOW=500 and
// PAGE_SIZE=24, the STATUSES set, str(), toWorklistStatus(), every field of
// mapRow (including the hasDocument db:/public/cmas/ prefix rule), the
// listCmasForAdmin({ limit: WINDOW, offset: 0 }) read, the summary counts
// (total from the DAL; drafts/finalized/delivered/sent/published over the
// window), the sorted city set, the status → city → q filter order and the q
// lowercase match across address/subdivision/client name/client email, the
// totalPages/page clamp and slice, the `?id=` detail lookup, the
// CmaWorklistFilters object, the /admin/cmas/new href and its "Build CMA"
// label, and every CmaBoard prop and action (approveCmaAction,
// prepareCmaSendAction, sendCmaToLeadAction, sendTemplateSelfTestAction) with
// basePath '/admin/cmas'.
//
// Shape changed, data did not: the page title and its paragraph are gone (the
// nav names this page — acceptance bar rule 1), replaced by the family's
// verdict line, whose figures are summary.drafts / summary.delivered /
// summary.published — the same counts the board's own numbers strip prints
// directly beneath it. The shadcn button became the v2 button class on the
// same link.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listCmasForAdmin } from '@/lib/data'
import { approveCmaAction, prepareCmaSendAction, sendCmaToLeadAction } from '@/app/actions/cma-admin'
import { sendTemplateSelfTestAction } from '@/app/actions/crm-template-test'
import { VerdictLine } from '@/components/admin/v2'
import { CmaBoard } from '@/components/admin/cma/worklist/CmaBoard.client'
import type {
  CmaStatusFilter,
  CmaWorklistFilters,
  CmaWorklistRow,
  CmaWorklistStatus,
  CmaWorklistSummary,
} from '@/components/admin/cma/worklist/types'

export const dynamic = 'force-dynamic'

// Upper bound on the window pulled from the DAL — wide enough to cover every
// CMA the shop has realistically produced, bounded so the page never fetches
// the whole table into the DOM (admin design standard, Law 1).
const WINDOW = 500
const PAGE_SIZE = 24

const STATUSES: CmaStatusFilter[] = ['all', 'draft', 'finalized', 'delivered', 'archived']

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}

function toWorklistStatus(raw: unknown): CmaWorklistStatus {
  const s = String(raw ?? '')
  return s === 'finalized' || s === 'delivered' || s === 'archived' ? s : 'draft'
}

function mapRow(r: Record<string, unknown>): CmaWorklistRow {
  const buildSummary = (r.build_summary ?? null) as { needs_review?: boolean } | null
  const htmlPath = String(r.html_path ?? '')
  return {
    id: String(r.id),
    slug: String(r.slug),
    subjectAddress: String(r.subject_address ?? ''),
    subjectSubdivision: (r.subject_subdivision as string | null) ?? null,
    subjectCity: (r.subject_city as string | null) ?? null,
    clientName: (r.client_name as string | null) ?? null,
    clientEmail: (r.client_email as string | null) ?? null,
    brokerSlug: (r.broker_slug as string | null) ?? null,
    valueLow: (r.value_low as number | null) ?? null,
    valueHigh: (r.value_high as number | null) ?? null,
    recommendedList: (r.recommended_list as number | null) ?? null,
    compsCount: (r.comps_count as number | null) ?? null,
    status: toWorklistStatus(r.status),
    createdAt: (r.created_at as string | null) ?? null,
    finalizedAt: (r.finalized_at as string | null) ?? null,
    deliveredAt: (r.delivered_at as string | null) ?? null,
    builtAt: (r.built_at as string | null) ?? null,
    buildError: (r.build_error as string | null) ?? null,
    needsReview: buildSummary?.needs_review === true,
    hasDocument: htmlPath.startsWith('db:') || htmlPath.startsWith('public/cmas/'),
    publishedToListing: r.published_to_listing === true,
    publishedAt: (r.published_at as string | null) ?? null,
    listingKey: (r.subject_listing_key as string | null) ?? null,
  }
}

export default async function AdminCmasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')

  const sp = await searchParams
  const qRaw = str(sp.q) ?? null
  const q = (qRaw ?? '').toLowerCase()
  const city = str(sp.city) ?? null
  const statusRaw = str(sp.status)
  const status: CmaStatusFilter = STATUSES.includes(statusRaw as CmaStatusFilter) ? (statusRaw as CmaStatusFilter) : 'all'
  const requestedPage = Math.max(1, Number(str(sp.page) ?? '1') || 1)

  const { rows: rawRows, total } = await listCmasForAdmin({ limit: WINDOW, offset: 0 })
  const allRows = rawRows.map(mapRow)

  const summary: CmaWorklistSummary = {
    total,
    drafts: allRows.filter((r) => r.status === 'draft').length,
    finalized: allRows.filter((r) => r.status === 'finalized').length,
    delivered: allRows.filter((r) => r.status === 'delivered').length,
    sent: allRows.filter((r) => r.deliveredAt != null).length,
    published: allRows.filter((r) => r.publishedToListing).length,
  }
  const cities = Array.from(new Set(allRows.map((r) => r.subjectCity).filter((c): c is string => Boolean(c)))).sort()

  let filtered = allRows
  if (status !== 'all') filtered = filtered.filter((r) => r.status === status)
  if (city) filtered = filtered.filter((r) => r.subjectCity === city)
  if (q) {
    filtered = filtered.filter((r) =>
      [r.subjectAddress, r.subjectSubdivision, r.clientName, r.clientEmail]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q)),
    )
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openId = str(sp.id) ?? null
  const detail = openId ? (allRows.find((r) => r.id === openId) ?? null) : null

  const filters: CmaWorklistFilters = { q: qRaw, city, status, page, pageSize: PAGE_SIZE }

  return (
    <div className="av2-scope" style={{ maxWidth: 1152, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 0 14px',
        }}
      >
        <VerdictLine tone={summary.drafts > 0 ? 'attention' : 'ok'}>
          {summary.drafts > 0 ? (
            <>
              <b>
                {summary.drafts} draft{summary.drafts === 1 ? '' : 's'} waiting for your review.
              </b>{' '}
              {summary.delivered} delivered · {summary.published} live on a listing page.
            </>
          ) : summary.total > 0 ? (
            <>
              <b>No drafts waiting.</b> {summary.delivered} delivered · {summary.published} live on a
              listing page.
            </>
          ) : (
            <>
              <b>No CMAs on the board.</b>
            </>
          )}
        </VerdictLine>
        <Link href="/admin/cmas/new" className="av2-btn av2-btn--touch" style={{ textDecoration: 'none' }}>
          Build CMA
        </Link>
      </div>

      <CmaBoard
        filters={filters}
        basePath="/admin/cmas"
        rows={pageRows}
        summary={summary}
        cities={cities}
        page={page}
        totalPages={totalPages}
        detail={detail}
        approveAction={approveCmaAction}
        prepareSendAction={prepareCmaSendAction}
        sendAction={sendCmaToLeadAction}
        testSendAction={sendTemplateSelfTestAction}
      />
    </div>
  )
}
