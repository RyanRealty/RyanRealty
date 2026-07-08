import { createServiceClient } from '@/lib/supabase/service'
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

  return (
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
  )
}
