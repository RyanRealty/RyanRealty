// @no-parity — internal admin surface, no public mockup contract
//
// /admin/media/photos — photo/video curation. 11C: migrated to the LOCKED admin
// v2 language (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: PAGE_SIZE 48, the APPROVALS tuple and the 'intake'
// default, the `type` / `geo` / `page` param parsing and their defaults, the
// one() helper, the service-client reads (the three head-count queries and the
// rows query — same columns, same .eq filters, same overlaps('geo_tags'), same
// registered_at-desc order, same range window), the Promise.all fan-out, the
// counts/totalForView derivation, `dynamic = 'force-dynamic'`, the page
// metadata, and every prop handed to <PhotoCurationBoard /> — which is mounted
// untouched, a legacy client island that migrates with its own unit.
//
// Shape changed, data did not: the page now opens with the queue depth the
// board's own filters already hold, in the family's verdict line, inside the
// v2 type scope. The board keeps its full-bleed width — no wrapper max-width —
// so no image in the gallery moves.
import { createServiceClient } from '@/lib/supabase/service'
import { VerdictLine } from '@/components/admin/v2'
import { PhotoCurationBoard, type CurationAsset } from './PhotoCurationBoard'

export const metadata = { title: 'Photo curation | Admin' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 48
const APPROVALS = ['intake', 'approved', 'rejected'] as const
type ApprovalFilter = (typeof APPROVALS)[number]

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>
}

function one(params: Record<string, string | string[]>, key: string): string | undefined {
  const v = params[key]
  return Array.isArray(v) ? v[0] : v
}

export default async function PhotoCurationPage({ searchParams }: PageProps) {
  const params = await searchParams
  const approval = (APPROVALS.includes(one(params, 'approval') as ApprovalFilter)
    ? one(params, 'approval')
    : 'intake') as ApprovalFilter
  const type = one(params, 'type') === 'video' ? 'video' : 'photo'
  const geo = one(params, 'geo') || ''
  const page = Math.max(0, parseInt(one(params, 'page') || '0', 10) || 0)

  const sb = createServiceClient()

  // Count per approval (for the tabs) + the page of rows, in parallel.
  const countFor = (a: ApprovalFilter) =>
    sb
      .from('asset_library')
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
      .eq('approval', a)

  let rowsQuery = sb
    .from('asset_library')
    .select(
      'id, type, file_url, approval, geo_tags, subject_tags, surface_tags, notes, width, height, duration_sec',
      { count: 'exact' },
    )
    .eq('type', type)
    .eq('approval', approval)
    .order('registered_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (geo) rowsQuery = rowsQuery.overlaps('geo_tags', [geo])

  const [intakeC, approvedC, rejectedC, rowsRes] = await Promise.all([
    countFor('intake'),
    countFor('approved'),
    countFor('rejected'),
    rowsQuery,
  ])

  const assets = ((rowsRes.data ?? []) as CurationAsset[]) || []
  const counts = {
    intake: intakeC.count ?? 0,
    approved: approvedC.count ?? 0,
    rejected: rejectedC.count ?? 0,
  }
  const totalForView = rowsRes.count ?? assets.length

  // The verdict reads the same three counts the board's filters read.
  const noun = type === 'video' ? 'video' : 'photo'
  const plural = counts.intake === 1 ? noun : `${noun}s`

  return (
    <div className="av2-scope">
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={counts.intake > 0 ? 'attention' : 'ok'}>
          {counts.intake > 0 ? (
            <>
              <b>
                {counts.intake.toLocaleString('en-US')} {plural} waiting in intake.
              </b>{' '}
              {counts.approved.toLocaleString('en-US')} approved ·{' '}
              {counts.rejected.toLocaleString('en-US')} rejected.
            </>
          ) : (
            <>
              <b>Nothing waiting in intake.</b>{' '}
              {counts.approved.toLocaleString('en-US')} approved ·{' '}
              {counts.rejected.toLocaleString('en-US')} rejected.
            </>
          )}
        </VerdictLine>
      </div>

      <PhotoCurationBoard
        assets={assets}
        counts={counts}
        approval={approval}
        type={type}
        geo={geo}
        page={page}
        pageSize={PAGE_SIZE}
        totalForView={totalForView}
      />
    </div>
  )
}
