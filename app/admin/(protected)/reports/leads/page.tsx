import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import DashboardSummaryStrip, { type SummaryStat } from '@/components/admin/DashboardSummaryStrip'

/** Admin page — never pre-render; requires service role key at runtime. */
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function getSupabase() {
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export default async function AdminLeadsReportPage() {
  const supabase = getSupabase()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: visitorsCount },
    { count: registeredCount },
    { data: tierCounts },
    { data: cmaCount },
    { data: tourCount },
    { data: rsvpCount },
  ] = await Promise.all([
    supabase.from('user_activities').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('lead_tier').not('lead_tier', 'is', null),
    supabase.from('user_activities').select('id').eq('activity_type', 'cma_downloaded').gte('created_at', since),
    supabase.from('user_activities').select('id').eq('activity_type', 'tour_requested').gte('created_at', since),
    supabase.from('user_activities').select('id').eq('activity_type', 'open_house_rsvp').gte('created_at', since),
  ])

  const tierMap = new Map<string, number>()
  for (const row of tierCounts ?? []) {
    const t = (row as { lead_tier?: string }).lead_tier ?? 'cold'
    tierMap.set(t, (tierMap.get(t) ?? 0) + 1)
  }

  const funnelStats: SummaryStat[] = [
    { label: 'Activities (all)', value: (visitorsCount ?? 0).toLocaleString('en-US'), caption: 'Last 7 days' },
    { label: 'Registered', value: (registeredCount ?? 0).toLocaleString('en-US'), caption: 'All time' },
    {
      label: 'Hot / Very hot',
      value: ((tierMap.get('hot') ?? 0) + (tierMap.get('very_hot') ?? 0)).toLocaleString('en-US'),
      caption: 'High intent',
      tone: 'warning',
    },
  ]

  const scoringRows = (['cold', 'warm', 'hot', 'very_hot'] as const).map((tier) => ({
    tier,
    label: tier.replace('_', ' '),
    count: tierMap.get(tier) ?? 0,
  }))
  const hasScoring = scoringRows.some((r) => r.count > 0)

  const actionRows = [
    { label: 'CMA downloads', count: (cmaCount ?? []).length },
    { label: 'Tour requests', count: (tourCount ?? []).length },
    { label: 'Open house RSVPs', count: (rsvpCount ?? []).length },
  ]
  const hasActions = actionRows.some((r) => r.count > 0)

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lead analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Funnel, scoring distribution, and high-intent actions (last 7 days).</p>
      </div>

      <DashboardSummaryStrip stats={funnelStats} />

      <Card>
        <CardHeader><CardTitle className="text-base">Lead scoring distribution</CardTitle></CardHeader>
        <CardContent>
          {hasScoring ? (
            <ul className="space-y-2">
              {scoringRows.map((r) => (
                <li key={r.tier} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize text-muted-foreground">{r.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No scored leads yet. Tiers populate as leads engage.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">High-intent actions (this week)</CardTitle></CardHeader>
        <CardContent>
          {hasActions ? (
            <ul className="space-y-2">
              {actionRows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No high-intent actions in the last 7 days.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/analytics" className="underline hover:no-underline">Back to Performance</Link>
      </p>
    </main>
  )
}
