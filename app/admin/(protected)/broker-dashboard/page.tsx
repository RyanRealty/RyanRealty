// @no-parity — internal broker command surface
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { getBrokerCommandCenterData } from '@/app/actions/broker-command-center'
import { getBrokerActionQueue, confirmNextStepAction, completeCrmTaskAction, getRecentNewLeads, listCrmInbox } from '@/app/actions/crm'
import { fetchLiveSummary, fetchLiveVisitors } from '../visitors/_lib/queries'
import { ActionSubmitButton } from '@/components/admin/ActionSubmitButton'
import DashboardActivityFeed from '@/components/admin/DashboardActivityFeed'
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
function cleanTaskName(raw: string): string {
  return raw
    .replace(/\s*\[[0-9]{10,}\]/g, '')
    .replace(/\s*·\s*[A-Z0-9 ]+\b(LLC|INC|TRUST|LP|LLP)\b.*$/i, '')
    .trim()
}

/** Title-cases a region/city pair into a readable place ("Bend, OR"). */
function placeLabel(city: string | null, region: string | null): string {
  const parts = [city, region].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Unknown'
}

/** Stage chips use semantic brand tokens only (navy primary + success/warning). */
function stageToneClass(stage: string): string {
  const s = stage.toLowerCase()
  if (s.includes('pending') || s.includes('escrow')) return 'border-warning/30 bg-warning/10 text-warning'
  if (s.includes('active') || s.includes('listing')) return 'border-success/30 bg-success/10 text-success'
  if (s.includes('contract')) return 'border-primary/20 bg-primary/10 text-primary'
  return 'border-border bg-muted text-muted-foreground'
}

function calTypeIcon(type: string): string {
  if (type === 'closing') return '🔑'
  if (type === 'contract') return '📋'
  if (type === 'task') return '✓'
  if (type === 'gcal') return '📅'
  return '•'
}

// ── small presentational primitives (the shared visual language) ──────────

/** Quiet grouped-list section label (iOS-style). Optional trailing action link. */
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

/** A grouped-list surface built on the design-system Card (ring, not border). */
function GroupCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn('overflow-hidden', className)}>{children}</Card>
}

/** Compact glanceable stat. Urgent goes destructive; otherwise calm. */
function StatPill({ label, value, href, urgent }: { label: string; value: number; href: string; urgent: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 flex-col gap-0.5 rounded-2xl border bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/40 active:bg-muted ${
        urgent ? 'border-destructive/40' : 'border-border'
      }`}
    >
      <span className={`text-2xl font-bold leading-none tabular-nums ${urgent ? 'text-destructive' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </Link>
  )
}

/** Live-pulse tile: big number, quiet label, optional success accent when the
 *  metric is "live" (people on site / hot right now). Part of the hero. */
function LiveTile({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link href={href} className="flex flex-col gap-0.5 px-4 py-3.5 transition-colors hover:bg-muted/40">
      <span className={cn('text-2xl font-bold leading-none tabular-nums', accent ? 'text-success' : 'text-foreground')}>
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </Link>
  )
}

const CHANNEL_CHIP: Record<string, { label: string; cls: string }> = {
  email: { label: 'Email', cls: 'border-primary/20 bg-primary/10 text-primary' },
  sms: { label: 'Text', cls: 'border-success/30 bg-success/10 text-success' },
}
const CHANNEL_VERB: Record<string, string> = { email: 'Email', sms: 'Text' }

// ── one-click actions ────────────────────────────────────
// Each confirms/does the step then revalidates the dashboard so the row clears.
// The mutations scope writes to the signed-in broker's own leads/tasks (a
// superuser is unrestricted); the queue read is scoped the same way. The send
// itself is guarded upstream: held / unresolved-token / no-channel rows never
// render a Send button, and the engine re-checks fail-closed before delivery.

// Args are .bind()-ed at the call site (Next server-action pattern) so the rows
// need no hidden form fields. FormData is still passed last by the form.
async function confirmStepFromDashboard(enrollmentId: number, _formData: FormData) {
  'use server'
  await confirmNextStepAction(enrollmentId)
  revalidatePath('/admin/broker-dashboard')
}

async function completeTaskFromDashboard(taskId: number, personId: number | null, _formData: FormData) {
  'use server'
  const fd = new FormData()
  fd.set('taskId', String(taskId))
  if (personId != null) fd.set('personId', String(personId))
  await completeCrmTaskAction(fd)
  revalidatePath('/admin/broker-dashboard')
}

// ── component ────────────────────────────────────────────

export default async function BrokerCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [data, actionQueue, liveSummary, liveSessions, recentLeads, inbox] = await Promise.all([
    getBrokerCommandCenterData(),
    getBrokerActionQueue(),
    fetchLiveSummary().catch(() => null),
    fetchLiveVisitors({}).catch(() => [] as Awaited<ReturnType<typeof fetchLiveVisitors>>),
    getRecentNewLeads(12).catch(() => []),
    listCrmInbox(40).catch(() => []),
  ])
  const { tab: activeTab } = await searchParams

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
  const calDaysWithItems = calDays.filter((d) => d.items.length > 0)

  const marketingTab = activeTab ?? 'ideas'

  // Top-of-dashboard priority (Matt 2026-06-13): leads + tasks that need the
  // broker to DO something now — shown first, before deal status and the rest.
  const overdueTasks = data.tasksDue.filter((t) => t.isOverdue)
  const needsActionCount = actionQueue.length + overdueTasks.length
  const heroActions = actionQueue.slice(0, 5)
  const heroOverdue = overdueTasks.slice(0, Math.max(0, 5 - actionQueue.length))

  // Live pulse: the warmest sessions on the site right now — what a broker most
  // wants to see the second they open the page. Rank by engagement, surface the
  // top few that are either live (active) or scored hot.
  const liveActive = liveSummary?.totalActive ?? 0

  // Segmented activity feed (New leads / Emails / Website) — FUB's home feed IA,
  // with our live-engagement column as the edge. All three are shaped here so the
  // client feed only switches tabs.
  const websiteRows = [...(liveSessions ?? [])]
    .filter((s) => s.engagement_score > 0)
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 8)
    .map((s) => ({
      key: s.session_id,
      score: s.engagement_score,
      who: s.identified_email ?? `Anonymous · ${placeLabel(s.ip_city, s.ip_region)}`,
      intent: s.intent_tags?.[0] ?? null,
      href: `/admin/visitors/${encodeURIComponent(s.session_id)}`,
      hot: Boolean(s.hot_lead_fired_at) || s.engagement_score >= 100,
    }))
  // Inbound comms — scoped to this broker unless superuser (the read itself is
  // unscoped, so filter here to match the rest of the dashboard).
  const emailRows = (inbox ?? [])
    .filter((r) => data.isSuperuser || r.broker === data.broker.slug)
    .slice(0, 12)
    .map((r) => ({
      key: `inbox-${r.id}`,
      who: r.person?.name ?? 'Unknown',
      kind: r.kind,
      preview: r.title ?? (r.body ? r.body.slice(0, 80) : null),
      href: `/admin/crm/${r.person_id}`,
      ts: r.ts,
    }))
  const leadRows = (recentLeads ?? []).map((l) => ({
    key: `lead-${l.id}`,
    who: l.name ?? `Contact #${l.id}`,
    source: l.source,
    stage: l.stage,
    href: `/admin/crm/${l.id}`,
    pictureUrl: l.pictureUrl,
    ts: l.createdAt,
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {greet()}, {data.broker.displayName.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {data.isSuperuser ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin?broker=all">All leads</Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href="/admin/crm">Open CRM</Link>
          </Button>
        </div>
      </header>

      {/* ── 0. RIGHT NOW: live pulse — who is on the site this moment ── */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {liveActive > 0 ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              ) : null}
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', liveActive > 0 ? 'bg-success' : 'bg-muted-foreground/40')} />
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Right now</h2>
          </div>
          <Link href="/admin/visitors/live" className="shrink-0 text-xs font-medium text-primary hover:underline">
            Live activity →
          </Link>
        </div>
        <GroupCard>
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <LiveTile label="On site now" value={liveActive} accent={liveActive > 0} href="/admin/visitors/live" />
            <LiveTile label="Hot today" value={liveSummary?.hotLeadsToday ?? 0} accent={(liveSummary?.hotLeadsToday ?? 0) > 0} href="/admin/visitors/live" />
            <LiveTile label="Identified today" value={liveSummary?.identifiedToday ?? 0} href="/admin/visitors/live" />
            <LiveTile label="Sessions today" value={liveSummary?.totalToday ?? 0} href="/admin/visitors/live" />
          </div>
          <DashboardActivityFeed website={websiteRows} emails={emailRows} newLeads={leadRows} />
        </GroupCard>
      </section>

      {/* ── 1. FOCUS: what needs the broker to act now (the anchor) ── */}
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
            {needsActionCount > heroActions.length + heroOverdue.length ? (
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
              {heroOverdue.map((t) => (
                <div key={`t-${t.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                    Overdue
                  </span>
                  <Link
                    href={t.personId ? `/admin/crm/${t.personId}` : '/admin/crm/tasks'}
                    className="-my-2.5 min-w-0 flex-1 py-2.5 transition-opacity hover:opacity-70"
                  >
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {cleanTaskName(t.name)}{t.personName ? ` · ${t.personName}` : ''}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : 'No due date'}{t.type ? ` · ${t.type}` : ''}
                    </span>
                  </Link>
                  <form action={completeTaskFromDashboard.bind(null, t.id, t.personId)}>
                    <ActionSubmitButton variant="outline" pendingLabel="…" ariaLabel={`Mark done: ${t.name}`}>Done</ActionSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </GroupCard>
      </section>

      {/* ── 2. At a glance — compact stat strip ── */}
      <section>
        <SectionLabel>Today at a glance</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill label="Overdue tasks" value={data.attention.tasksOverdue} href="/admin/crm/tasks" urgent={data.attention.tasksOverdue > 0} />
          <StatPill label="Due today" value={data.attention.tasksToday} href="/admin/crm/tasks" urgent={false} />
          <StatPill label="Active deals" value={data.attention.activeDeals} href="/admin/deals" urgent={false} />
          {/* Sign-off queue is principal-only (and counted globally); only the
              superuser can act on it, so don't show a dead pill to brokers. */}
          {data.isSuperuser ? (
            <StatPill label="Docs to sign" value={data.attention.docsNeedingSignoff} href="/admin/sign-off" urgent={data.attention.docsNeedingSignoff > 0} />
          ) : null}
        </div>
      </section>

      {/* ── 3. Deals + Schedule ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">

        {/* Active deals */}
        <section>
          <SectionLabel action={{ href: '/admin/deals', label: 'All deals' }}>Active deals</SectionLabel>
          <GroupCard>
            {data.activeDeals.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No active transactions right now.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.activeDeals.slice(0, 3).map((deal) => {
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

        {/* Schedule */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next {windowDays} days</h2>
            {data.gcalConnected ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Calendar synced
              </span>
            ) : null}
          </div>
          <GroupCard>
            {calDaysWithItems.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing scheduled in the next {windowDays} days.</p>
            ) : (
              <div className="divide-y divide-border">
                {calDaysWithItems.map((day) => (
                  <div key={day.date} className="px-4 py-2.5">
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day.label}</div>
                    <div className="space-y-1.5">
                      {day.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-base leading-none">{calTypeIcon(item.type)}</span>
                          <span className="min-w-0 flex-1">
                            {item.href ? (
                              <Link href={item.href} className="font-medium text-foreground hover:underline">{item.label}</Link>
                            ) : (
                              <span className="font-medium text-foreground">{item.label}</span>
                            )}
                            {item.sublabel ? <span className="ml-1 text-xs text-muted-foreground">· {item.sublabel}</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GroupCard>
        </section>
      </div>

      {/* ── 4. Tasks + Clients ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

        {/* Tasks due */}
        <section>
          <SectionLabel action={{ href: '/admin/crm/tasks', label: 'All tasks' }}>Tasks due</SectionLabel>
          <GroupCard>
            {data.tasksDue.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">All caught up. No tasks due.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.tasksDue.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${task.isOverdue ? 'border-destructive text-destructive' : 'border-border text-muted-foreground'}`}>
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
                    <span className={`shrink-0 text-xs tabular-nums ${task.isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                      {task.dueAt ? fmtDate(task.dueAt) : '—'}{task.isOverdue ? ' ⚠' : ''}
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

      {/* ── 5. Marketing launchpad (superuser only — its listing/asset actions
            route to /admin/listings/[key] + /admin/media, which redirect
            non-principal brokers to access-denied) ── */}
      {data.isSuperuser ? (
      <section>
        <SectionLabel>Marketing launchpad</SectionLabel>
        <GroupCard className="p-4">
          {/* Scrollable pill tabs (thumb-friendly on phones) */}
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
                      <Link href={`/admin/listings/${listing.listingKey}`}>Listing reel</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="text-xs">
                      <Link href={`/admin/listings/${listing.listingKey}`}>IG carousel</Link>
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
