import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Lead analytics</h1>
      <p className="mt-2 text-muted-foreground">Funnel, scoring distribution, and high-intent actions (last 7 days).</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Lead funnel</h2>
        <ul className="mt-4 flex flex-wrap gap-6">
          <li>
            <span className="text-3xl font-bold text-primary">{visitorsCount ?? 0}</span>
            <span className="ml-2 text-muted-foreground">Activities (all)</span>
          </li>
          <li>
            <span className="text-3xl font-bold text-primary">{registeredCount ?? 0}</span>
            <span className="ml-2 text-muted-foreground">Registered</span>
          </li>
          <li>
            <span className="text-3xl font-bold text-accent-foreground">{(tierMap.get('hot') ?? 0) + (tierMap.get('very_hot') ?? 0)}</span>
            <span className="ml-2 text-muted-foreground">Hot / Very hot</span>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Lead scoring distribution</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {['cold', 'warm', 'hot', 'very_hot'].map((tier) => (
            <div key={tier} className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <span className="font-medium capitalize text-foreground">{tier.replace('_', ' ')}</span>
              <span className="ml-2 text-2xl font-bold text-primary">{tierMap.get(tier) ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">High-intent actions (this week)</h2>
        <ul className="mt-4 space-y-2">
          <li>CMA downloads: <strong>{(cmaCount ?? []).length}</strong></li>
          <li>Tour requests: <strong>{(tourCount ?? []).length}</strong></li>
          <li>Open house RSVPs: <strong>{(rsvpCount ?? []).length}</strong></li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
      </p>
    </main>
  )
}
