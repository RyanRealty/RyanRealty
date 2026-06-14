// @no-parity — internal broker command surface
import Link from 'next/link'
import { getBrokerCommandCenterData } from '@/app/actions/broker-command-center'
import { getBrokerActionQueue } from '@/app/actions/crm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

function stageBgClass(stage: string): string {
  const s = stage.toLowerCase()
  if (s.includes('pending') || s.includes('escrow')) return 'bg-amber-100 text-amber-800 border-amber-200'
  if (s.includes('active') || s.includes('listing')) return 'bg-green-100 text-green-800 border-green-200'
  if (s.includes('contract')) return 'bg-blue-100 text-blue-800 border-blue-200'
  return 'bg-muted text-muted-foreground border-border'
}

function calTypeIcon(type: string): string {
  if (type === 'closing') return '🔑'
  if (type === 'contract') return '📋'
  if (type === 'task') return '✓'
  if (type === 'gcal') return '📅'
  return '•'
}

// ── component ────────────────────────────────────────────

export default async function BrokerCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [data, actionQueue] = await Promise.all([
    getBrokerCommandCenterData(),
    getBrokerActionQueue(),
  ])
  const { tab: activeTab } = await searchParams

  if (!data) {
    return (
      <main className="px-4 py-8">
        <p className="text-muted-foreground">This account is not linked to a broker profile yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Contact Matt at <a href="mailto:matt@ryan-realty.com" className="text-primary underline">matt@ryan-realty.com</a> to get set up.
        </p>
      </main>
    )
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  })

  // Calendar: next 14 days window
  const windowDays = 14
  const calStart = new Date()
  calStart.setHours(0, 0, 0, 0)
  const calEnd = new Date(calStart.getTime() + windowDays * 86_400_000)

  const calendarInWindow = data.calendar.filter((c) => {
    const d = new Date(c.date)
    return d >= calStart && d <= calEnd
  })

  // Group calendar by date
  const calByDate: Record<string, typeof calendarInWindow> = {}
  for (const item of calendarInWindow) {
    if (!calByDate[item.date]) calByDate[item.date] = []
    calByDate[item.date].push(item)
  }

  // Build 14-day array
  const calDays: { date: string; label: string; items: typeof calendarInWindow }[] = []
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(calStart.getTime() + i * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    const items = calByDate[iso] ?? []
    if (items.length > 0 || i < 7) {
      calDays.push({
        date: iso,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
        items,
      })
    }
  }

  const marketingTab = activeTab ?? 'ideas'

  // Top-of-dashboard priority (Matt 2026-06-13): leads + tasks that need the
  // broker to DO something now — shown first, before deal status and the rest.
  const overdueTasks = data.tasksDue.filter((t) => t.isOverdue)
  const needsActionCount = actionQueue.length + overdueTasks.length

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-2 py-4 sm:px-6 sm:py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greet()}, {data.broker.displayName.split(' ')[0]}.
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.isSuperuser && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">All leads</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/tasks">All tasks</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/crm">CRM</Link>
          </Button>
        </div>
      </div>

      {/* ── 1. NEEDS YOUR ACTION — leads + tasks to act on now (top priority) ── */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Needs your action{needsActionCount > 0 ? ` · ${needsActionCount}` : ''}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {needsActionCount === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">You are all caught up. No leads or tasks need action right now.</p>
          ) : (
            <>
              {actionQueue.slice(0, 5).map((a) => {
                const tone =
                  a.channel === 'email' ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : a.channel === 'sms' ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
                const verb = a.channel === 'email' ? 'Send email' : a.channel === 'sms' ? 'Send text' : 'Do this'
                return (
                  <Link
                    key={`a-${a.personId}`}
                    href={`/admin/crm/${a.personId}`}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                  >
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{verb}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{a.personName} · {a.sequenceName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.holdReason ? `Holds: ${a.holdReason}` : a.preview}</span>
                    </span>
                  </Link>
                )
              })}
              {overdueTasks.slice(0, Math.max(0, 5 - actionQueue.length)).map((t) => (
                <Link
                  key={`t-${t.id}`}
                  href={t.personId ? `/admin/crm/${t.personId}` : '/admin/crm/tasks'}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                >
                  <span className="shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Overdue task</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{t.name}{t.personName ? ` · ${t.personName}` : ''}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.dueAt ? `Due ${fmtDate(t.dueAt)}` : 'No due date'}{t.type ? ` · ${t.type}` : ''}</span>
                  </span>
                </Link>
              ))}
              {needsActionCount > 5 ? (
                <Link href="/admin/crm/tasks" className="block rounded-lg py-2 text-center text-sm font-medium text-primary hover:bg-muted/50">
                  See all {needsActionCount} →
                </Link>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Main 2-col: Deals + Calendar ── */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[3fr_2fr]">

        {/* Active deals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active deals</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <Link href="/admin/deals">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-0 pb-4">
            {data.activeDeals.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No active transactions right now.</p>
            ) : (
              data.activeDeals.slice(0, 3).map((deal) => {
                const pct = deal.checklistTotal > 0
                  ? Math.round((deal.checklistComplete / deal.checklistTotal) * 100)
                  : 0
                const daysLabel = daysUntil(deal.closingDate)
                const isUrgent = deal.closingDate
                  ? new Date(deal.closingDate).getTime() - Date.now() < 7 * 86_400_000
                  : false

                return (
                  <Link
                    key={deal.id}
                    href={`/admin/deals/${deal.propertyKey}`}
                    className="group block border-b border-border px-6 py-3 last:border-b-0 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground group-hover:underline">
                            {deal.address}
                          </span>
                          {deal.city && <span className="text-xs text-muted-foreground">{deal.city}</span>}
                        </div>
                        {deal.parties.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {deal.parties.join(' · ')}
                          </p>
                        )}
                        {/* Checklist progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {deal.checklistComplete}/{deal.checklistTotal}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${stageBgClass(deal.stage)}`}>
                          {deal.stageDetail ?? deal.stage}
                        </span>
                        {deal.closingDate && (
                          <span className={`text-xs tabular-nums ${isUrgent ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>
                            {daysLabel} · {fmtDate(deal.closingDate)}
                          </span>
                        )}
                        {deal.salePrice && (
                          <span className="text-xs tabular-nums text-muted-foreground">{money(deal.salePrice)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Calendar strip */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Next {windowDays} days</CardTitle>
              {data.gcalConnected && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Google Calendar
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {calDays.every((d) => d.items.length === 0) ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                Nothing scheduled in the next {windowDays} days.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {calDays.filter((d) => d.items.length > 0).map((day) => (
                  <div key={day.date} className="px-6 py-2.5">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {day.label}
                    </div>
                    <div className="space-y-1">
                      {day.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-base leading-none">{calTypeIcon(item.type)}</span>
                          <span className="min-w-0 flex-1">
                            {item.href ? (
                              <Link href={item.href} className="font-medium text-foreground hover:underline">
                                {item.label}
                              </Link>
                            ) : (
                              <span className="font-medium text-foreground">{item.label}</span>
                            )}
                            {item.sublabel && (
                              <span className="ml-1 text-xs text-muted-foreground">· {item.sublabel}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3. At a glance (counts) ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        {[
          { label: 'Overdue tasks', value: data.attention.tasksOverdue, href: '/admin/crm/tasks', urgent: data.attention.tasksOverdue > 0 },
          { label: 'Due today', value: data.attention.tasksToday, href: '/admin/crm/tasks', urgent: false },
          { label: 'Active deals', value: data.attention.activeDeals, href: '/admin/deals', urgent: false },
          { label: 'Docs awaiting sig', value: data.attention.docsNeedingSignoff, href: '/admin/sign-off', urgent: data.attention.docsNeedingSignoff > 0 },
        ].map((a) => (
          <Link key={a.label} href={a.href}>
            <Card className={`transition-colors hover:bg-muted/40 ${a.urgent ? 'border-destructive' : ''}`}>
              <CardContent className="p-4">
                <div className={`text-3xl font-bold tabular-nums ${a.urgent ? 'text-destructive' : 'text-foreground'}`}>
                  {a.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Tasks + Clients ── */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">

        {/* Tasks due */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tasks due</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <Link href="/admin/crm/tasks">All tasks</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.tasksDue.length === 0 ? (
              <p className="px-6 py-6 text-center text-sm text-muted-foreground">All caught up. No tasks due.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.tasksDue.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-6 py-2.5">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${task.isOverdue ? 'border-destructive text-destructive' : 'border-border text-muted-foreground'}`}>
                      ✓
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
                      {task.personName && (
                        <p className="text-xs text-muted-foreground">
                          {task.personId ? (
                            <Link href={`/admin/crm/${task.personId}`} className="hover:underline">
                              {task.personName}
                            </Link>
                          ) : task.personName}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs tabular-nums ${task.isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                      {task.dueAt ? fmtDate(task.dueAt) : '—'}
                      {task.isOverdue && ' ⚠'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active clients */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active clients</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <Link href="/admin/crm">CRM</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.activeClients.length === 0 ? (
              <p className="px-6 py-6 text-center text-sm text-muted-foreground">No active clients found.</p>
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
                      className="flex items-center gap-3 px-6 py-2.5 hover:bg-muted/40 transition-colors"
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
                        <p className="truncate text-sm font-medium text-foreground">
                          {client.name ?? `Contact #${client.id}`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {client.source ?? ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {client.stage}
                        </Badge>
                        <span className={`text-[11px] tabular-nums ${needsAttention ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                          {daysSince === null
                            ? 'No activity'
                            : daysSince === 0
                            ? 'Today'
                            : `${daysSince}d ago`}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Marketing Launchpad ── */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Marketing launchpad</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Tab bar */}
          <div className="mb-4 flex gap-1 border-b border-border">
            {[
              { key: 'ideas', label: 'Post ideas' },
              { key: 'newsletter', label: 'Newsletter' },
              { key: 'listings', label: 'My listings' },
              { key: 'market', label: 'Market report' },
            ].map((t) => (
              <Link
                key={t.key}
                href={`/admin/broker-dashboard?tab=${t.key}`}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                  marketingTab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* Post ideas */}
          {marketingTab === 'ideas' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.myListings.length > 0 && data.myListings.slice(0, 6).map((listing) => (
                <div key={listing.listingKey} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {listing.status === 'Pending' ? '🔄 Pending' : '🏡 Active listing'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground line-clamp-2">{listing.address}</p>
                  <p className="text-xs text-muted-foreground">{money(listing.listPrice)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <Link href={`/admin/listings/${listing.listingKey}`}>Listing reel</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <Link href={`/admin/listings/${listing.listingKey}`}>IG carousel</Link>
                    </Button>
                  </div>
                </div>
              ))}
              {/* Static post ideas */}
              {[
                { icon: '📊', label: 'Local market update', desc: 'Share what the market is doing this month in your area.', href: '/admin/broker-dashboard?tab=market' },
                { icon: '🎉', label: 'Recent sold announcement', desc: 'Celebrate a recent close with your audience.', href: '/admin/crm/deals' },
                { icon: '📰', label: 'Real estate tip', desc: 'Quick actionable tip for buyers or sellers.', href: '/admin/media' },
                { icon: '🏘', label: 'Neighborhood spotlight', desc: 'Feature a neighborhood you specialize in.', href: '/admin/media' },
                { icon: '❓', label: 'FAQ post', desc: "Answer a question clients ask you all the time.", href: '/admin/media' },
              ].map((idea) => (
                <Link
                  key={idea.label}
                  href={idea.href}
                  className="group rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-lg">{idea.icon}</p>
                  <p className="mt-1 text-sm font-medium text-foreground group-hover:underline">{idea.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{idea.desc}</p>
                </Link>
              ))}
            </div>
          )}

          {/* Newsletter */}
          {marketingTab === 'newsletter' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a branded newsletter to your clients with recent market data, your listings, and a personal note.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Monthly market update newsletter', desc: `Send to your full ${data.activeClients.length} active clients with market stats + listings.`, href: '/admin/crm' },
                  { label: 'New listing announcement', desc: 'Alert your sphere when a new listing goes live.', href: '/admin/listings' },
                  { label: 'Just sold announcement', desc: 'Let your database know about a recent close.', href: '/admin/crm/deals' },
                  { label: 'Buyer newsletter', desc: 'Rate update, inventory snapshot, and buyer tips.', href: '/admin/crm?stage=Active+Buyer' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground group-hover:underline">{item.label}</p>
                    <p className="mt-1 flex-1 text-xs text-muted-foreground">{item.desc}</p>
                    <span className="mt-3 text-xs font-medium text-primary">Create draft →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* My listings */}
          {marketingTab === 'listings' && (
            <div>
              {data.myListings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No active or pending listings found for your account.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.myListings.slice(0, 8).map((listing) => (
                    <div key={listing.listingKey} className="overflow-hidden rounded-lg border border-border bg-card">
                      {listing.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.photoUrl}
                          alt={listing.address}
                          className="h-32 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground text-sm">
                          No photo
                        </div>
                      )}
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{listing.address}</p>
                        <p className="text-xs text-muted-foreground">{money(listing.listPrice)}</p>
                        <Badge variant="outline" className="mt-1 text-[10px] py-0">{listing.status}</Badge>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button asChild size="sm" variant="outline" className="text-xs h-7">
                            <Link href={`/admin/listings/${listing.listingKey}`}>View</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="text-xs h-7">
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
          )}

          {/* Market report */}
          {marketingTab === 'market' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate a market report for your farm area. Reports are data-verified against the live Supabase listings database.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
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
                    className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground group-hover:underline">{item.label}</p>
                    <p className="mt-1 flex-1 text-xs text-muted-foreground">{item.desc}</p>
                    <span className="mt-3 text-xs font-medium text-primary">Generate →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </main>
  )
}
