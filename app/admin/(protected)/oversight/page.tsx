// @no-parity — internal admin surface, no public mockup contract
// Oversight (P9 roll:oversight, IA lock 2026-08-05): supervise without being
// woken — the verdict + needs-you pattern (visual lock 2026-08-05; tile boards
// retired). One attention list (sync failures, alert-delivery trouble, parked
// sequence steps, PB sign-off waits), quiet rows for healthy systems, the
// sequence ran/broke/parked lane, and the week strip. Absorbs the JOBS of
// /admin/operations, /admin/sync*, /admin/crm/health, /admin/crm/activity and
// the weekly reports; that heavy machinery stays one tap away under All tools
// until each migrates. Brokers see their own book; system plumbing lanes are
// principal-only.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getSyncFreshness, getAlertQueueHealth, getSignoffWaits } from '@/lib/data/oversight/health'
import { getWorkflowAnalytics } from '@/lib/data/crm/getWorkflowAnalytics'
import { getSpeedToLeadReport } from '@/lib/data/crm/getSpeedToLeadReport'
import { getTaskQueue } from '@/lib/data/crm/getTaskQueue'
import { getBrokerActionQueue } from '@/lib/data/crm/getBrokerActionQueue'
import { getCrmSignalFreshness } from '@/lib/data/crm/getCrmSignalFreshness'
import { getMeasurementSnapshot } from '@/lib/data/crm/getMeasurementSnapshot'
import { getCmaSlaSnapshot } from '@/lib/data/cma/getCmaSlaSnapshot'
import { mirrorHealthStatus } from '@/lib/crm/mirror-health'
import { QueueRow, QuietRow, VerdictLine, SectionHead } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

function ageMinutes(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const m = Math.floor((nowMs - new Date(iso).getTime()) / 60_000)
  return Number.isFinite(m) ? m : null
}

function ageWords(iso: string | null, nowMs: number): string {
  const m = ageMinutes(iso, nowMs)
  if (m == null) return 'never'
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 48 * 60) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

type Attention = {
  key: string
  word: string
  tone: 'down' | 'slow' | 'waiting'
  title: string
  context: string
  href: string
  actionLabel: string
}

export default async function OversightPage() {
  const ctx = await requireAdminPage('oversight.view')
  const isSuper = ctx.role === 'superuser'
  const brokerScope = isSuper ? null : ctx.brokerSlug
  const nowMs = Date.now()

  const [sync, alerts, signoff, workflows, s2l, tasks, parked, signals, measurement, cmaSla] =
    await Promise.all([
      isSuper ? getSyncFreshness() : null,
      isSuper ? getAlertQueueHealth() : null,
      isSuper ? getSignoffWaits() : null,
      getWorkflowAnalytics(brokerScope),
      getSpeedToLeadReport({ brokerSlug: brokerScope, datePreset: 'this_week' }),
      getTaskQueue({ brokerScope, view: 'overdue' }),
      getBrokerActionQueue({ brokerSlug: brokerScope }),
      isSuper ? getCrmSignalFreshness() : null,
      isSuper ? getMeasurementSnapshot({ limit: 12 }) : null,
      isSuper ? getCmaSlaSnapshot({ windowDays: 30, limit: 8 }) : null,
    ])
  const mirror = isSuper ? mirrorHealthStatus({ CRM_MIRROR_ENABLED: process.env.CRM_MIRROR_ENABLED }) : null

  const attention: Attention[] = []

  // ── System lanes (principal only) ──
  if (sync) {
    const deltaAge = ageMinutes(sync.lastDeltaAt, nowMs)
    if (sync.unreadable) {
      attention.push({
        key: 'sync-unreadable',
        word: 'Down',
        tone: 'down',
        title: 'Sync state is unreadable',
        context: 'The health read itself failed — check Supabase before trusting anything below',
        href: '/admin/sync',
        actionLabel: 'Details',
      })
    } else if (deltaAge == null || deltaAge > 60) {
      attention.push({
        key: 'sync-stale',
        word: 'Down',
        tone: 'down',
        title:
          deltaAge == null
            ? 'Listing sync has never recorded a delta run'
            : `Listing sync ${deltaAge >= 60 ? `${Math.floor(deltaAge / 60)}h` : `${deltaAge}m`} behind`,
        context: `Delta target is every 15 minutes · last run ${ageWords(sync.lastDeltaAt, nowMs)}`,
        href: '/admin/sync',
        actionLabel: 'Details',
      })
    } else if (sync.fullSyncStale) {
      // P12: full weekly can go months without completing while delta keeps
      // listings fresh — surface it as waiting, not a false "all clear".
      attention.push({
        key: 'full-sync-stale',
        word: 'Waiting',
        tone: 'waiting',
        title: 'Weekly full sync has not completed in 14+ days',
        context: `Delta is healthy (${ageWords(sync.lastDeltaAt, nowMs)}). Last full history: ${ageWords(sync.lastFullHistoryAt ?? sync.lastFullAt, nowMs)}. Run Smart Sync → full if history is overdue.`,
        href: '/admin/sync',
        actionLabel: 'Open sync',
      })
    }
  }
  if (alerts) {
    if (alerts.unreadable) {
      attention.push({
        key: 'alerts-unreadable',
        word: 'Down',
        tone: 'down',
        title: 'Alert queue is unreadable',
        context: 'crm_broker_alerts could not be read — delivery state unknown',
        href: '/admin/crm/health',
        actionLabel: 'Details',
      })
    } else {
      const oldestMin = ageMinutes(alerts.oldestPendingAt, nowMs)
      if (alerts.pending > 0 && oldestMin != null && oldestMin > 15) {
        attention.push({
          key: 'alerts-backed-up',
          word: 'Slow',
          tone: 'slow',
          title: `${alerts.pending} broker alert${alerts.pending === 1 ? '' : 's'} stuck in the queue`,
          context: `Oldest has waited ${ageWords(alerts.oldestPendingAt, nowMs).replace(' ago', '')} · drain runs every minute`,
          href: '/admin/crm/health',
          actionLabel: 'Details',
        })
      }
      if (alerts.failed24h > 0) {
        attention.push({
          key: 'alerts-failed',
          word: 'Down',
          tone: 'down',
          title: `${alerts.failed24h} alert deliver${alerts.failed24h === 1 ? 'y' : 'ies'} failed in the last day`,
          context: 'A broker may have missed a wake-up — check the failures',
          href: '/admin/crm/health',
          actionLabel: 'Details',
        })
      }
    }
  }
  if (mirror && mirror.level === 'alarm') {
    attention.push({
      key: 'mirror-alarm',
      word: 'Down',
      tone: 'down',
      title: 'Lead mirror is switched off',
      context: 'CRM_MIRROR_ENABLED=false — lead capture is silently dropping',
      href: '/admin/crm/health',
      actionLabel: 'Details',
    })
  }

  // ── Sequences: parked on a human ──
  if (parked.length > 0) {
    attention.push({
      key: 'parked',
      word: 'Waiting',
      tone: 'waiting',
      title: `${parked.length} sequence step${parked.length === 1 ? '' : 's'} parked on you`,
      context: 'Each is one tap in Today — approve, fix, or skip',
      href: '/admin/today',
      actionLabel: 'Open Today',
    })
  }

  // ── PB sign-off waits ──
  if (signoff) {
    if (signoff.unreadable) {
      attention.push({
        key: 'signoff-unreadable',
        word: 'Down',
        tone: 'down',
        title: 'Sign-off queue is unreadable',
        context: 'tc_* reads failed — the backlog below may be incomplete',
        href: '/admin/sign-off',
        actionLabel: 'Details',
      })
    }
    for (const d of signoff.deals.slice(0, 6)) {
      attention.push({
        key: `signoff-${d.dealId}`,
        word: 'Waiting',
        tone: 'waiting',
        title: `${d.address} needs your sign-off`,
        context: `${d.items} item${d.items === 1 ? '' : 's'} in review${d.brokerName ? ` · ${d.brokerName}` : ''}`,
        href: '/admin/sign-off',
        actionLabel: 'Review',
      })
    }
  }

  // ── Quiet rows (healthy systems) ──
  const seqTotals = workflows.rows.reduce(
    (acc, r) => {
      acc.active += r.active
      acc.parked += r.awaitingBroker
      acc.stopped += r.stopped
      acc.completed += r.completed
      return acc
    },
    { active: 0, parked: 0, stopped: 0, completed: 0 },
  )
  const quiet: Array<{ name: string; state?: string; figure: string }> = []
  if (sync && !sync.unreadable) {
    const deltaAge = ageMinutes(sync.lastDeltaAt, nowMs)
    if (deltaAge != null && deltaAge <= 60) {
      quiet.push({
        name: 'Listing sync',
        figure: `delta ${ageWords(sync.lastDeltaAt, nowMs)} · full ${ageWords(sync.lastFullAt, nowMs)}`,
      })
    }
  }
  if (alerts && !alerts.unreadable && alerts.failed24h === 0) {
    const oldestMin = ageMinutes(alerts.oldestPendingAt, nowMs)
    if (alerts.pending === 0 || (oldestMin != null && oldestMin <= 15)) {
      quiet.push({
        name: 'Alert delivery',
        figure: alerts.pending === 0 ? 'queue empty' : `${alerts.pending} in queue, draining`,
      })
    }
  }
  if (mirror && mirror.level === 'ok') quiet.push({ name: 'Lead mirror', figure: 'mirroring into the CRM' })
  if (signals) {
    for (const s of signals) {
      quiet.push({ name: s.label, figure: s.latest ? `last ${ageWords(s.latest, nowMs)}` : 'never seen' })
    }
  }

  const verdictCount = attention.length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={verdictCount > 0 ? 'attention' : 'ok'}>
          {verdictCount > 0 ? (
            <>
              <b>
                {verdictCount} thing{verdictCount === 1 ? '' : 's'} need{verdictCount === 1 ? 's' : ''} you.
              </b>{' '}
              Everything else is running clean.
            </>
          ) : (
            <>
              <b>Nothing needs you.</b> Every watched system is running clean.
            </>
          )}
        </VerdictLine>
      </div>

      {measurement && (
        <section aria-label="Speed to first broker action" style={{ marginBottom: 18 }}>
          <SectionHead>First broker action (7 days)</SectionHead>
          <ul className="av2-quietlist" style={{ marginTop: 8 }}>
            <QuietRow
              name="Leads with a first-touch stamp"
              figure={`${measurement.stampedLast7d} stamped · ${measurement.unstampedLeadsLast7d} still open`}
            />
            <QuietRow
              name="Median reply latency"
              figure={
                measurement.medianLatencySeconds == null
                  ? 'no stamps yet'
                  : measurement.medianLatencySeconds < 60
                    ? `${measurement.medianLatencySeconds}s`
                    : `${Math.round(measurement.medianLatencySeconds / 60)}m`
              }
            />
          </ul>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 6 }}>
            Stamp lands on the first outbound SMS/email/call (conversation shadow). Speed-to-lead report remains the
            full source breakdown.
          </p>
        </section>
      )}

      {cmaSla && (
        <section aria-label="CMA delivery SLA" style={{ marginBottom: 18 }}>
          <SectionHead>CMA create → deliver ({cmaSla.windowDays}d)</SectionHead>
          <ul className="av2-quietlist" style={{ marginTop: 8 }}>
            <QuietRow
              name="Delivered CMAs"
              figure={`${cmaSla.deliveredCount} sent · ${cmaSla.openFinalizedCount} finalized not sent`}
            />
            <QuietRow
              name="Median create→deliver"
              figure={
                cmaSla.medianCreateToDeliverSeconds == null
                  ? 'no deliveries in window'
                  : cmaSla.medianCreateToDeliverSeconds < 3600
                    ? `${Math.round(cmaSla.medianCreateToDeliverSeconds / 60)}m`
                    : `${Math.round(cmaSla.medianCreateToDeliverSeconds / 3600)}h`
              }
            />
            <QuietRow
              name="P90 create→deliver"
              figure={
                cmaSla.p90CreateToDeliverSeconds == null
                  ? '—'
                  : cmaSla.p90CreateToDeliverSeconds < 3600
                    ? `${Math.round(cmaSla.p90CreateToDeliverSeconds / 60)}m`
                    : `${Math.round(cmaSla.p90CreateToDeliverSeconds / 3600)}h`
              }
            />
          </ul>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 6 }}>
            <Link href="/admin/cmas" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
              Open valuations
            </Link>
          </p>
        </section>
      )}

      {attention.length > 0 && (
        <section aria-label="Needs you">
          <h2 className="av2-lane-head">Needs you</h2>
          <ul className="av2-queue">
            {attention.map((a) => (
              <QueueRow
                key={a.key}
                kind={a.word}
                kindTone={a.tone === 'down' ? 'down' : a.tone === 'slow' ? 'slow' : 'waiting'}
                title={a.title}
                context={a.context}
                action={
                  <Link href={a.href} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                    {a.actionLabel}
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Sequences">
        <h2 className="av2-lane-head">Sequences — ran · parked · stopped</h2>
        {workflows.unreadable ? (
          <p style={{ color: 'var(--a-danger)', fontSize: 'var(--a-text-sm)' }}>
            Sequence analytics are unreadable right now — do not assume they ran.
          </p>
        ) : (
          <ul className="av2-quietlist">
            {workflows.rows
              .filter((r) => r.enrolled > 0)
              .slice(0, 12)
              .map((r) => (
                <QuietRow
                  key={r.id}
                  name={r.name}
                  state={r.awaitingBroker > 0 ? `${r.awaitingBroker} parked` : 'OK'}
                  figure={`${r.active} running · ${r.completed} done · ${r.stopped} stopped`}
                />
              ))}
          </ul>
        )}
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>
          {seqTotals.active} running · {seqTotals.parked} parked · {seqTotals.stopped} stopped across all
          sequences.{' '}
          <Link href="/admin/crm/sequences" style={{ color: 'var(--a-accent)' }}>
            Sequence admin
          </Link>
        </p>
      </section>

      {quiet.length > 0 && (
        <section aria-label="Running clean">
          <h2 className="av2-lane-head">Running clean</h2>
          <ul className="av2-quietlist">
            {quiet.map((qr) => (
              <QuietRow key={qr.name} name={qr.name} figure={qr.figure} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="The week">
        <h2 className="av2-lane-head">The week</h2>
        <div className="av2-week">
          <Link href="/admin/crm/reporting/speed-to-lead" className="av2-wk" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="av2-wk__n">
              {s2l.totals.medianSeconds == null ? '—' : `${Math.round(s2l.totals.medianSeconds / 60)} min`}
            </span>
            <span className="av2-wk__l">median first response</span>
          </Link>
          <Link href="/admin/reports/leads" className="av2-wk" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="av2-wk__n">{s2l.totals.totalLeads}</span>
            <span className="av2-wk__l">new leads</span>
          </Link>
          <Link href="/admin/crm/reporting/speed-to-lead" className="av2-wk" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="av2-wk__n">{s2l.totals.totalLeads - s2l.totals.contactedLeads}</span>
            <span className="av2-wk__l">not yet contacted</span>
          </Link>
          <Link href="/admin/crm/tasks" className="av2-wk" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="av2-wk__n">{tasks.counts.overdue}</span>
            <span className="av2-wk__l">overdue tasks</span>
          </Link>
          <Link href="/admin/today" className="av2-wk" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="av2-wk__n">{parked.length}</span>
            <span className="av2-wk__l">parked steps — in Today</span>
          </Link>
        </div>
      </section>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 24 }}>
        All tools:{' '}
        <Link href="/admin/loop" style={{ color: 'var(--a-accent)' }}>
          Loop
        </Link>
        {' · '}
        <Link href="/admin/operations" style={{ color: 'var(--a-accent)' }}>
          Operations
        </Link>
        {' · '}
        <Link href="/admin/sync" style={{ color: 'var(--a-accent)' }}>
          System health
        </Link>
        {' · '}
        <Link href="/admin/crm/health" style={{ color: 'var(--a-accent)' }}>
          CRM health
        </Link>
        {' · '}
        <Link href="/admin/crm/activity" style={{ color: 'var(--a-accent)' }}>
          Activity feed
        </Link>
        {' · '}
        <Link href="/admin/crm/reporting/speed-to-lead" style={{ color: 'var(--a-accent)' }}>
          Speed to lead
        </Link>
        {' · '}
        <Link href="/admin/crm/reporting/agent-activity" style={{ color: 'var(--a-accent)' }}>
          Agent activity
        </Link>
        {' · '}
        <Link href="/admin/crm/reporting/agent-goals" style={{ color: 'var(--a-accent)' }}>
          Goals
        </Link>
        {' · '}
        <Link href="/admin/sign-off" style={{ color: 'var(--a-accent)' }}>
          Sign-off
        </Link>
        {' · '}
        <Link href="/admin/listings" style={{ color: 'var(--a-accent)' }}>
          Listing data
        </Link>
        {' · '}
        <Link href="/admin/geo" style={{ color: 'var(--a-accent)' }}>
          Geography
        </Link>
      </p>
    </div>
  )
}
