import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { createServiceClient } from '@/lib/supabase/service'
import { ActionCard, type BrainAction } from './_components/ActionCard'
import { FilterSidebar } from './_components/FilterSidebar'

export const metadata = { title: 'Approval Queue | Admin' }
export const dynamic = 'force-dynamic'

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
): Promise<BrainAction[]> {
  const service = createServiceClient()

  let query = service
    .from('marketing_brain_actions')
    .select(
      'id, action_type, target, assigned_producer, payload, executor_response, generation_reason, status, executed_at, priority_score, predicted_north_star_impact, comments, cost_estimate_usd, assigned_approver',
    )
    .in('status', ['ready', 'needs_changes'])
    .order('executed_at', { ascending: false })
    .limit(100)

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
    return []
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
  const params = await searchParams

  const filterCats = getParam(params, 'cat')
  const filterPrefixes = getParam(params, 'prefix')
  const filterUrgency = getParam(params, 'urgency')

  const actions = await fetchActions(filterCats, filterPrefixes, filterUrgency)

  const categories = [
    'Content Producers',
    'Site Producers',
    'Operational Producers',
    'Communications Producers',
    'Analysis Producers',
  ]
  const actionTypePrefixes = ['content', 'site', 'ops', 'comms', 'analyze']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Approval queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {actions.length} item{actions.length !== 1 ? 's' : ''} awaiting review. New rows
          appear in real time via Supabase Realtime (see{' '}
          <span className="font-medium">ApprovalQueueRealtime</span> below).
        </p>
      </div>

      <div className="flex gap-8">
        {/* Filter sidebar */}
        <Suspense fallback={<Skeleton className="h-64 w-52" />}>
          <FilterSidebar
            categories={categories}
            actionTypePrefixes={actionTypePrefixes}
          />
        </Suspense>

        {/* Action cards */}
        <div className="min-w-0 flex-1 space-y-4">
          {actions.length === 0 ? (
            <div className="rounded-lg border border-border bg-card py-20 text-center text-muted-foreground">
              Nothing pending. The queue is clear.
            </div>
          ) : (
            actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
