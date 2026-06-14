// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getSetupComplete } from '@/app/actions/admin-setup'
import { getCrmAccess, getCrmHomeDashboard } from '@/app/actions/crm'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import StageBadge from '@/components/admin/crm/StageBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

// The ~13 live count queries behind the home dashboard are the slow part (an
// uncached render measured 28-49s — reads as "down" on a phone). The page stays
// dynamic for per-request auth/role, but the data bundle is cached per broker
// for 60s. Keyed by broker arg, so one broker never sees another's counts.
const getCachedCrmHomeDashboard = unstable_cache(
  async (broker?: string) => getCrmHomeDashboard(broker),
  ['admin-crm-home-dashboard'],
  { revalidate: 60, tags: ['crm-home'] },
)

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
}

/**
 * The admin home is the BROKER's day: their lead funnel and what needs
 * attention right now. Site/system analytics live on their own pages
 * (Operations, Analytics, Reports) — not here.
 */
export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ broker?: string }> }) {
  const setupComplete = await getSetupComplete()
  if (!setupComplete) redirect('/admin/setup')

  const { broker: brokerParam } = await searchParams

  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  // Anyone with a broker profile — including the principal/superuser — lands on
  // the action-first command center by default. brokerSlug (email->broker) is the
  // SAME signal the dashboard's data depends on; a superuser's admin_roles.brokerId
  // is null, which is why the earlier role-based redirect skipped Matt (the bare
  // /admin still showed the old "<broker>'s leads" funnel). The all-leads funnel
  // stays one tap away at /admin?broker=all (the param bypasses this redirect).
  if (!brokerParam && access.brokerSlug) redirect('/admin/broker-dashboard')
  // Brokers default to their own book; Matt defaults to everyone.
  const broker = brokerParam === 'all' ? undefined : (brokerParam || access.brokerSlug || undefined)
  const d = await getCachedCrmHomeDashboard(broker)

  const attention = [
    { label: 'Hot leads (48h)', value: d.attention.hotLeads48h, href: '/admin/analytics/action-required', urgent: d.attention.hotLeads48h > 0 },
    { label: 'Approvals waiting', value: d.attention.approvalsPending, href: '/admin/crm/approvals', urgent: d.attention.approvalsPending > 0 },
    { label: 'Tasks overdue', value: d.attention.tasksOverdue, href: `/admin/crm/tasks${broker ? `?broker=${broker}` : ''}`, urgent: d.attention.tasksOverdue > 0 },
    { label: 'Tasks due today', value: d.attention.tasksToday, href: `/admin/crm/tasks${broker ? `?broker=${broker}` : ''}`, urgent: false },
    { label: 'Inbound (24h)', value: d.attention.inbound24h, href: '/admin/crm/inbox', urgent: false },
    { label: 'New leads (7d)', value: d.attention.newLeads7d, href: '/admin/crm', urgent: false },
  ]

  return (
    <main className="mx-auto max-w-7xl px-2 py-4 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {broker ? `${CRM_BROKER_DISPLAY[broker as keyof typeof CRM_BROKER_DISPLAY] ?? broker}'s leads` : 'All leads'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your funnel and what needs attention. Site analytics live under Marketing.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant={!brokerParam && !access.brokerSlug ? 'default' : brokerParam === 'all' ? 'default' : 'outline'}>
            <Link href="/admin?broker=all">All</Link>
          </Button>
          {CRM_BROKERS.map((b) => (
            <Button key={b} asChild size="sm" variant={broker === b ? 'default' : 'outline'}>
              <Link href={`/admin?broker=${b}`}>{CRM_BROKER_DISPLAY[b]}</Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Needs attention */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {attention.map((a) => (
          <Link key={a.label} href={a.href}>
            <Card className={`transition-colors hover:bg-muted/50 ${a.urgent ? 'border-destructive' : ''}`}>
              <CardContent className="p-4">
                <div className={`text-2xl font-bold tabular-nums ${a.urgent ? 'text-destructive' : 'text-foreground'}`}>{a.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{a.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Lead funnel</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.funnel.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No contacts yet for this view.</p>
            ) : (
              d.funnel.map((s) => {
                const max = Math.max(...d.funnel.map((f) => f.count))
                const pct = Math.max(4, Math.round((s.count / max) * 100))
                return (
                  <Link
                    key={s.stage}
                    href={`/admin/crm?stage=${encodeURIComponent(s.stage)}${broker ? `&broker=${broker}` : '&broker=all'}`}
                    className="group block"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground group-hover:underline">{s.stage}</span>
                      <span className="tabular-nums text-muted-foreground">{s.count.toLocaleString('en-US')}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Newest leads */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Newest leads</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.newest.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No leads yet for this view.</p>
            ) : (
              d.newest.map((p) => (
                <Link key={p.id} href={`/admin/crm/${p.id}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
                  {p.picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.picture_url} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {(p.name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name ?? `Contact #${p.id}`}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.source ?? ''}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StageBadge stage={p.stage} className="text-xs" />
                    <span className="text-xs tabular-nums text-muted-foreground">{fmtDate(p.created_at)}</span>
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Where everything else went */}
      <div className="mt-8 rounded-xl border border-border bg-muted p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">Other dashboards</h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <li><Link href="/admin/operations" className="text-primary hover:underline">Operations (sync, system health, GA4, content)</Link></li>
          <li><Link href="/admin/analytics" className="text-primary hover:underline">Site analytics</Link></li>
          <li><Link href="/admin/reports" className="text-primary hover:underline">Reports</Link></li>
          <li><Link href="/admin/broker-dashboard" className="text-primary hover:underline">Broker dashboard</Link></li>
          <li><Link href="/admin/crm/deals" className="text-primary hover:underline">Pipeline</Link></li>
        </ul>
      </div>
    </main>
  )
}
