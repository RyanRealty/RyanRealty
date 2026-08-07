// @no-parity — internal admin surface
//
// Approval queue — 11E: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only. This is the human gate
// in front of publishing (CLAUDE.md §1) — nothing here may change what the
// queue reads or what approving does.
//
// Carried over verbatim: requireAdminPage('approvals.act'), the
// marketing_brain_actions select + `.in('status', ['ready','needs_changes'])` +
// order + limit(100), the priority_score urgency branch, getParam, the
// cat/prefix/urgency filtering, the categories + actionTypePrefixes lists, and
// the FilterSidebar / BulkSelectionProvider / ActionCard / BulkActionBar mounts
// (the last two are required by ci:bulk-approval-wired).
//
// Shape changed, data did not: ConsoleSection gave way to VerdictLine +
// SectionHead, and a failed read now returns null and says so instead of
// rendering the same empty queue an all-clear renders. Cut: "New rows appear in
// real time via Supabase Realtime (see ApprovalQueueRealtime below)" — no
// component by that name exists anywhere in the repo and nothing on this page
// subscribes to anything.
import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { ActionCard, type BrainAction } from './_components/ActionCard'
import { FilterSidebar } from './_components/FilterSidebar'
import { BulkSelectionProvider, BulkActionBar } from './_components/BulkSelection'
import { ReportError, ReportSkeleton, SectionHead, VerdictLine } from '@/components/admin/v2'

export const metadata = { title: 'Approval Queue | Admin' }
export const dynamic = 'force-dynamic'

/** The read cap the query below enforces — quoted in the verdict when it binds. */
const QUEUE_LIMIT = 100

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>
}

function getParam(params: Record<string, string | string[]>, key: string): string[] {
  const v = params[key]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

async function fetchActions(
  filterCats: string[],
  filterPrefixes: string[],
  filterUrgency: string[],
): Promise<BrainAction[] | null> {
  const service = createServiceClient()

  let query = service
    .from('marketing_brain_actions')
    .select(
      'id, action_type, target, assigned_producer, payload, executor_response, generation_reason, status, executed_at, priority_score, predicted_north_star_impact, comments, cost_estimate_usd, assigned_approver',
    )
    .in('status', ['ready', 'needs_changes'])
    .order('executed_at', { ascending: false })
    .limit(QUEUE_LIMIT)

  // Urgency filter via priority_score ranges
  if (filterUrgency.length > 0 && filterUrgency.length < 3) {
    // Build OR ranges
    const ranges: { gte: number; lt?: number }[] = []
    if (filterUrgency.includes('high')) ranges.push({ gte: 80 })
    if (filterUrgency.includes('medium')) ranges.push({ gte: 40, lt: 80 })
    if (filterUrgency.includes('low')) ranges.push({ gte: 0, lt: 40 })
    // Simple approach: apply gte of lowest
    const minScore = Math.min(...ranges.map((r) => r.gte))
    query = query.gte('priority_score', minScore)
  }

  const { data, error } = await query
  if (error) {
    console.error('[approval-queue] fetch error:', error)
    return null
  }

  let rows = (data ?? []) as BrainAction[]

  // Client-side category + prefix filter (these are not DB columns)
  if (filterPrefixes.length > 0) {
    rows = rows.filter((r) =>
      filterPrefixes.some((p) => r.action_type.startsWith(`${p}:`)),
    )
  }

  // Category filter via assigned_producer path segment
  if (filterCats.length > 0) {
    rows = rows.filter((r) => {
      const path = (r.assigned_producer ?? '').toLowerCase()
      return filterCats.some((cat) => {
        const c = cat.toLowerCase()
        if (c.includes('content')) return path.includes('video_production') || path.includes('social_media')
        if (c.includes('site')) return path.includes('site-')
        if (c.includes('operational')) return path.includes('ops-')
        if (c.includes('comms')) return path.includes('comms-')
        if (c.includes('analysis')) return path.includes('analyze-')
        return path.includes(c)
      })
    })
  }

  return rows
}

export default async function ApprovalQueuePage({ searchParams }: PageProps) {
  // Marketing-brain approvals are the Matt-only publish gate (approvals.act =
  // superuser). The nav hides this; the page must enforce it — a broker typing
  // /admin/approval-queue otherwise sees + could approve content for public
  // auto-publish (audit HIGH, RC5 class). The API route is guarded separately.
  await requireAdminPage('approvals.act')
  const params = await searchParams

  const filterCats = getParam(params, 'cat')
  const filterPrefixes = getParam(params, 'prefix')
  const filterUrgency = getParam(params, 'urgency')

  const actions = await fetchActions(filterCats, filterPrefixes, filterUrgency)
  const failed = actions === null
  const rows = actions ?? []
  const filtered = filterCats.length + filterPrefixes.length + filterUrgency.length > 0

  const categories = [
    'Content Producers',
    'Site Producers',
    'Operational Producers',
    'Communications Producers',
    'Analysis Producers',
  ]
  const actionTypePrefixes = ['content', 'site', 'ops', 'comms', 'analyze']

  return (
    <div className="av2-scope" style={{ maxWidth: 1040, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={failed || rows.length > 0 ? 'attention' : 'ok'}>
          {failed ? (
            <b>The approval queue could not be read. Nothing below is the queue.</b>
          ) : rows.length === 0 ? (
            <>
              <b>Nothing is waiting for your approval.</b>
              {filtered ? ' No row matches the filters set below.' : null}
            </>
          ) : (
            <>
              <b>
                {rows.length} item{rows.length === 1 ? '' : 's'} waiting for your approval.
              </b>
              {rows.length === QUEUE_LIMIT ? ` The queue reads ${QUEUE_LIMIT} at a time.` : null}
            </>
          )}
        </VerdictLine>
      </div>

      {failed ? <ReportError what="The approval queue" href="/admin/approval-queue" /> : null}

      <SectionHead>Pending approvals</SectionHead>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {/* Filter sidebar */}
        <Suspense fallback={<ReportSkeleton rows={4} />}>
          <FilterSidebar
            categories={categories}
            actionTypePrefixes={actionTypePrefixes}
          />
        </Suspense>

        {/* Action cards */}
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.length === 0 ? (
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', padding: '32px 0' }}>
              {failed
                ? 'The read failed, so this queue is unknown — not empty.'
                : filtered
                  ? 'No ready or needs-changes row matches these filters. Clear them to see the whole queue.'
                  : 'No row is in ready or needs-changes. Producers put drafts here when they finish.'}
            </p>
          ) : (
            <BulkSelectionProvider allIds={rows.map((a) => a.id)}>
              {rows.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
              <BulkActionBar />
            </BulkSelectionProvider>
          )}
        </div>
      </div>
    </div>
  )
}
