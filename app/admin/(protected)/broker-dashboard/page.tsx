// @no-parity — internal broker command surface
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { getBrokerCommandCenterData } from '@/app/actions/broker-command-center'
import { getBrokerActionQueue, confirmNextStepAction, getRecentNewLeads, getRecentWebsiteVisitors, getRecentEmailPeople, getCrmAccess } from '@/app/actions/crm'
import { ActionSubmitButton } from '@/components/admin/ActionSubmitButton'
import DashboardActivityFeed from '@/components/admin/DashboardActivityFeed'
import { DashboardActivityTable } from '@/components/admin/DashboardActivityTable'
import { getDashboardRecentActivity } from '@/lib/data/crm/getDashboardRecentActivity'
import { getDashboardKpis } from '@/lib/data/crm/getDashboardKpis'
import MonthCalendar from '@/components/admin/MonthCalendar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// ── helpers ──────────────────────────────────────────────

function money(v: number | null | undefined): string {
  if (!v) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

function fmtDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', ...opts })
}

function daysUntil(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff} days`
}

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Strip FUB import noise from a task name: bracketed listing keys
 *  [20230223...] and trailing legal-entity tails (· GROVE NWX PHASE 2 LLC). */
/** Stage chips use semantic brand tokens only (navy primary + success/warning). */
function stageToneClass(stage: string): string {
  const s = stage.toLowerCase()
  if (s.includes('pending') || s.includes('escrow')) return 'border-warning/30 bg-warning/10 text-warning'
  if (s.includes('active') || s.includes('listing')) return 'border-success/30 bg-success/10 text-success'
  if (s.includes('contract')) return 'border-primary/20 bg-primary/10 text-primary'
  return 'border-border bg-muted text-muted-foreground'
}

// ── small presentational primitives ──────────────────────

/** Quiet grouped-list section label. Optional trailing action link. */
function SectionLabel({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action ? (
        <Link href={action.href} className="shrink-0 text-xs font-medium text-primary hover:underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

/** A grouped-list surface built on the design-system Card. */
function GroupCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn('overflow-hidden', className)}>{children}</Card>
}

/** Live-pulse tile: big number, quiet label. Part of the Right Now hero. */
const CHANNEL_CHIP: Record<string, { label: string; cls: string }> = {
  email: { label: 'Email', cls: 'border-primary/20 bg-primary/10 text-primary' },
  sms: { label: 'Text', cls: 'border-success/30 bg-success/10 text-success' },
}
const CHANNEL_VERB: Record<string, string> = { email: 'Email', sms: 'Text' }

// ── one-click actions ────────────────────────────────────

async function confirmStepFromDashboard(enrollmentId: number, _formData: FormData) {
  'use server'
  await confirmNextStepAction(enrollmentId)
  revalidatePath('/admin/broker-dashboard')
}


// ── component ────────────────────────────────────────────

export default async function BrokerCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; days?: string; broker?: string }>
}) {
  const feedAccess = await getCrmAccess()
  const feedSlug = feedAccess?.brokerSlug ?? null
  const [data, actionQueue, websiteRows, emailRows, recentLeads] = await Promise.all([
    getBrokerCommandCenterData(),
    getBrokerActionQueue(),
    getRecentWebsiteVisitors(feedSlug, 12).catch(() => []),
    getRecentEmailPeople(feedSlug, 12).catch(() => []),
    getRecentNewLeads(12).catch(() => []),
  ])
  const { tab: activeTab, days: activeDays, broker: activeBroker } = await searchParams
  const selectedDays = activeDays ?? '30d'
  const selectedBroker = activeBroker ?? 'everyone'

  // FUB desktop dashboard data: the Recent Activity table rows + real KPI counts.
  const [activityRows, kpis] = await Promise.all([
    getDashboardRecentActivity(feedSlug, 12).catch(() => []),
    getDashboardKpis(feedSlug, actionQueue.length).catch(() => ({ newLeads30d: 0, unactioned: actionQueue.length })),
  ])

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl">
        <GroupCard className="p-6">
          <p className="text-sm text-foreground">This account is not linked to a broker profile yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact Matt at{' '}
            <a href="mailto:matt@ryan-realty.com" className="text-primary underline">matt@ryan-realty.com</a>{' '}
            to get set up.
          </p>
        </GroupCard>
      </div>
    )
  }

  // YYYY-MM-DD in LA for the month calendar (en-CA renders ISO order).
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const marketingTab = activeTab ?? 'ideas'

  // Priority counts. Overdue tasks are intentionally NOT surfaced on the
  // dashboard (Matt directive 2026-06-29) — the action queue is what needs action.
  const needsActionCount = actionQueue.length
  const heroActions = actionQueue.slice(0, 6)
  // Tasks shown on the dashboard exclude overdue (today + upcoming only).
  const upcomingTasks = data.tasksDue.filter((t) => !t.isOverdue)

  // FUB feed rows — "Name · via {source} · {date}". One row per recent lead.
  const leadRows = (recentLeads ?? []).map((l) => ({
    personId: l.id,
    name: l.name ?? `Contact #${l.id}`,
    pictureUrl: l.pictureUrl,
    ts: l.createdAt,
    label: l.source ? `via ${l.source}` : 'New lead',
  }))

  // Active deals exclude dead deals (canceled/lost/withdrawn cycles from months ago).
  const liveDeals = data.activeDeals.filter(
    (d) => !/cancel|lost|withdrawn|dead|terminated/i.test(`${d.stage} ${d.stageDetail ?? ''}`),
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 lg:max-w-7xl">

      {/* ── Header — slim: greeting + the Everyone / Just me scope toggle (FUB
          "Everyone ▾"). No date pills / KPI controls — the feed is the page. ── */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-foreground">
          {greet()}, {data.broker.displayName.split(' ')[0]}.
        </h1>
        {data.isSuperuser ? (
          <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted p-0.5">
            {(['everyone', 'me'] as const).map((v) => (
              <Link
                key={v}
                href={`/admin/broker-dashboard?broker=${v}&days=${selectedDays}`}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  selectedBroker === v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'everyone' ? 'Everyone' : 'Just me'}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {/* ── Mobile: the FUB person feed IS the dashboard (New Leads · Emails ·
          Website). ── */}
      <section aria-label="Recent activity" className="lg:hidden">
        <GroupCard>
          <DashboardActivityFeed website={websiteRows} emails={emailRows} newLeads={leadRows} />
        </GroupCard>
      </section>

      {/* ── Desktop: the FUB desktop dashboard — KPI-card row + Recent Activity
          table (Name · Email · Phone · Last Activity · Time · Stage · Assigned),
          identical to FUB. Matt directive 2026-06-30 + screenshots. ── */}
      <section className="hidden lg:block">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'New Leads', value: String(kpis.newLeads30d), sub: `${kpis.unactioned} unactioned` },
            { label: 'Needs Action', value: String(needsActionCount), sub: needsActionCount === 0 ? 'all caught up' : 'to act on' },
            { label: 'Tasks Due', value: String(upcomingTasks.length), sub: 'upcoming' },
            { label: 'Appts (30 days)', value: String(data.calendar.length), sub: 'scheduled' },
            { label: 'Active Deals', value: String(liveDeals.length), sub: money(liveDeals.reduce((s, d) => s + (d.salePrice ?? 0), 0)) },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{k.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{k.sub}</p>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <SectionLabel action={{ href: '/admin/crm', label: 'View all people' }}>Recent Activity</SectionLabel>
          <GroupCard>
            <DashboardActivityTable rows={activityRows} />
          </GroupCard>
        </div>
      </section>

      {/* ── Focus: what needs the broker to act now ── */}
      <section>
        <GroupCard>
          <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-primary-foreground">Needs your action</h2>
              {needsActionCount > 0 ? (
                <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-foreground">
                  {needsActionCount}
                </span>
              ) : null}
            </div>
            {needsActionCount > heroActions.length ? (
              <Link href="/admin/crm" className="shrink-0 text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground">
                See all →
              </Link>
            ) : null}
          </div>

          {needsActionCount === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm font-medium text-foreground">You are all caught up.</p>
              <p className="text-xs text-muted-foreground">No leads or tasks need action right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {heroActions.map((a) => {
                const chip = CHANNEL_CHIP[a.channel] ?? { label: 'Step', cls: 'border-warning/30 bg-warning/10 text-warning' }
                const verb = CHANNEL_VERB[a.channel]
                const title = verb ? `${verb} ${a.firstName ?? a.personName}` : a.personName
                const blocked = Boolean(a.holdReason) || a.unresolved.length > 0
                const detail = a.holdReason ?? (a.unresolved.length > 0 ? 'Open to add missing info before this can send' : (a.subjectPreview ?? a.preview))
                return (
                  <div key={`a-${a.enrollmentId}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
                    <Link
                      href={`/admin/crm/${a.personId}`}
                      className="-my-2.5 min-w-0 flex-1 py-2.5 transition-opacity hover:opacity-70"
                    >
                      <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                    </Link>
                    {blocked ? (
                      <Link href={`/admin/crm/${a.personId}`} className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        Open <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <form action={confirmStepFromDashboard.bind(null, a.enrollmentId)}>
                        <ActionSubmitButton pendingLabel="Sending…" ariaLabel={`${verb ? 'Send' : 'Confirm'} step for ${a.personName}`}>
                          {verb ? 'Send' : 'Confirm'}
                        </ActionSubmitButton>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </GroupCard>
      </section>

      {/* ── Deals + Schedule ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">

        {/* Active deals */}
        <section>
          <SectionLabel action={{ href: '/admin/deals', label: 'All deals' }}>Active deals</SectionLabel>
          <GroupCard>
            {liveDeals.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No active transactions right now.</p>
            ) : (
              <div className="divide-y divide-border">
                {liveDeals.slice(0, 3).map((deal) => {
                  const pct = deal.checklistTotal > 0
                    ? Math.round((deal.checklistComplete / deal.checklistTotal) * 100)
                    : 0
                  const isUrgent = deal.closingDate
                    ? new Date(deal.closingDate).getTime() - Date.now() < 7 * 86_400_000
                    : false

                  return (
                    <Link
                      key={deal.id}
                      href={`/admin/deals/${deal.propertyKey}`}
                      className="group block px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground group-hover:underline">{deal.address}</span>
                            {deal.city ? <span className="text-xs text-muted-foreground">{deal.city}</span> : null}
                          </div>
                          {deal.parties.length > 0 ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.parties.join(' · ')}</p>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-success' : 'bg-primary'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">{deal.checklistComplete}/{deal.checklistTotal}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${stageToneClass(deal.stage)}`}>
                            {deal.stageDetail ?? deal.stage}
                          </span>
                          {deal.closingDate ? (
                            <span className={`text-xs tabular-nums ${isUrgent ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
                              {daysUntil(deal.closingDate)} · {fmtDate(deal.closingDate)}
                            </span>
                          ) : null}
                          {deal.salePrice ? (
                            <span className="text-xs tabular-nums text-muted-foreground">{money(deal.salePrice)}</span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </GroupCard>
        </section>

        {/* Schedule — month calendar */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calendar</h2>
            {data.gcalConnected ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Calendar synced
              </span>
            ) : null}
          </div>
          <GroupCard className="p-3 sm:p-4">
            <MonthCalendar items={data.calendar} todayIso={todayIso} />
          </GroupCard>
        </section>
      </div>

      {/* ── Tasks + Clients ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

        {/* Tasks due */}
        <section>
          <SectionLabel action={{ href: '/admin/crm/tasks', label: 'All tasks' }}>Tasks due</SectionLabel>
          <GroupCard>
            {upcomingTasks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">All caught up. No tasks due.</p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-xs text-muted-foreground">
                      ✓
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
                      {task.personName ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {task.personId ? (
                            <Link href={`/admin/crm/${task.personId}`} className="hover:underline">{task.personName}</Link>
                          ) : task.personName}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {task.dueAt ? fmtDate(task.dueAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GroupCard>
        </section>

        {/* Active clients */}
        <section>
          <SectionLabel action={{ href: '/admin/crm', label: 'CRM' }}>Active clients</SectionLabel>
          <GroupCard>
            {data.activeClients.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No active clients found.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.activeClients.slice(0, 4).map((client) => {
                  const daysSince = client.lastActivityAt
                    ? Math.round((Date.now() - new Date(client.lastActivityAt).getTime()) / 86_400_000)
                    : null
                  const needsAttention = daysSince === null || daysSince > 7

                  return (
                    <Link
                      key={client.id}
                      href={`/admin/crm/${client.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 active:bg-muted"
                    >
                      {client.pictureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={client.pictureUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {(client.name ?? '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{client.name ?? `Contact #${client.id}`}</p>
                        <p className="truncate text-xs text-muted-foreground">{client.source ?? ''}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant="outline" className="py-0 text-xs">{client.stage}</Badge>
                        <span className={`text-xs tabular-nums ${needsAttention ? 'font-medium text-warning' : 'text-muted-foreground'}`}>
                          {daysSince === null ? 'No activity' : daysSince === 0 ? 'Today' : `${daysSince}d ago`}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </GroupCard>
        </section>
      </div>

      {/* ── Marketing launchpad (superuser only) ── */}
      {data.isSuperuser ? (
      <section>
        <SectionLabel>Marketing launchpad</SectionLabel>
        <GroupCard className="p-4">
          {/* Scrollable pill tabs */}
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {[
              { key: 'ideas', label: 'Post ideas' },
              { key: 'newsletter', label: 'Newsletter' },
              { key: 'listings', label: 'My listings' },
              { key: 'market', label: 'Market report' },
            ].map((t) => (
              <Link
                key={t.key}
                href={`/admin/broker-dashboard?tab=${t.key}`}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  marketingTab === t.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* Post ideas */}
          {marketingTab === 'ideas' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.myListings.length > 0 && data.myListings.slice(0, 6).map((listing) => (
                <div key={listing.listingKey} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {listing.status === 'Pending' ? '🔄 Pending' : '🏡 Active listing'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{listing.address}</p>
                  <p className="text-xs text-muted-foreground">{money(listing.listPrice)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <Link href={`/admin/media?listing=${listing.listingKey}`}>Listing reel</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <Link href={`/admin/media?listing=${listing.listingKey}`}>IG carousel</Link>
                    </Button>
                  </div>
                </div>
              ))}
              {[
                { icon: '📊', label: 'Local market update', desc: 'Share what the market is doing this month in your area.', href: '/admin/broker-dashboard?tab=market' },
                { icon: '🎉', label: 'Recent sold announcement', desc: 'Celebrate a recent close with your audience.', href: '/admin/crm/deals' },
                { icon: '📰', label: 'Real estate tip', desc: 'Quick actionable tip for buyers or sellers.', href: '/admin/media' },
                { icon: '🏘', label: 'Neighborhood spotlight', desc: 'Feature a neighborhood you specialize in.', href: '/admin/media' },
                { icon: '❓', label: 'FAQ post', desc: 'Answer a question clients ask you all the time.', href: '/admin/media' },
              ].map((idea) => (
                <Link
                  key={idea.label}
                  href={idea.href}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 active:bg-muted"
                >
                  <p className="text-lg">{idea.icon}</p>
                  <p className="mt-1 text-sm font-medium text-foreground group-hover:underline">{idea.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{idea.desc}</p>
                </Link>
              ))}
            </div>
          ) : null}

          {/* Newsletter */}
          {marketingTab === 'newsletter' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a branded newsletter to your clients with recent market data, your listings, and a personal note.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: 'Monthly market update newsletter', desc: `Send to your full ${data.activeClients.length} active clients with market stats + listings.`, href: '/admin/crm' },
                  { label: 'New listing announcement', desc: 'Alert your sphere when a new listing goes live.', href: '/admin/listings' },
                  { label: 'Just sold announcement', desc: 'Let your database know about a recent close.', href: '/admin/crm/deals' },
                  { label: 'Buyer newsletter', desc: 'Rate update, inventory snapshot, and buyer tips.', href: '/admin/crm?stage=Active+Buyer' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 active:bg-muted"
                  >
                    <p className="text-sm font-medium text-foreground group-hover:underline">{item.label}</p>
                    <p className="mt-1 flex-1 text-xs text-muted-foreground">{item.desc}</p>
                    <span className="mt-3 text-xs font-medium text-primary">Create draft →</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* My listings */}
          {marketingTab === 'listings' ? (
            <div>
              {data.myListings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No active or pending listings found for your account.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.myListings.slice(0, 8).map((listing) => (
                    <div key={listing.listingKey} className="overflow-hidden rounded-xl border border-border bg-card">
                      {listing.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.photoUrl} alt={listing.address} className="h-32 w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-muted text-sm text-muted-foreground">No photo</div>
                      )}
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{listing.address}</p>
                        <p className="text-xs text-muted-foreground">{money(listing.listPrice)}</p>
                        <Badge variant="outline" className="mt-1 py-0 text-xs">{listing.status}</Badge>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                            <Link href={`/admin/listings/${listing.listingKey}`}>View</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                            <Link href={`/admin/media?listing=${listing.listingKey}`}>Create asset</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/listings">
                    {data.myListings.length > 8 ? `See all (${data.myListings.length}) →` : 'All listings'}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {/* Market report */}
          {marketingTab === 'market' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate a market report for your farm area. Reports are data-verified against the live Supabase listings database.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: 'Bend market report', desc: 'SFR data for the City of Bend, all neighborhoods.', href: '/admin/reports/market?city=Bend' },
                  { label: 'Redmond market report', desc: 'SFR data for Redmond.', href: '/admin/reports/market?city=Redmond' },
                  { label: 'Sisters market report', desc: 'SFR data for Sisters.', href: '/admin/reports/market?city=Sisters' },
                  { label: 'Sunriver market report', desc: 'Resort community market data.', href: '/admin/reports/market?city=Sunriver' },
                  { label: 'Neighborhood deep dive', desc: 'Pick any Bend neighborhood for a neighborhood-level report.', href: '/admin/reports/market' },
                  { label: 'Custom CMA', desc: 'Run a comparative market analysis for a specific property.', href: '/admin/crm/deals' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 active:bg-muted"
                  >
                    <p className="text-sm font-medium text-foreground group-hover:underline">{item.label}</p>
                    <p className="mt-1 flex-1 text-xs text-muted-foreground">{item.desc}</p>
                    <span className="mt-3 text-xs font-medium text-primary">Generate →</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </GroupCard>
      </section>
      ) : null}

    </div>
  )
}
