// @no-parity — internal admin surface, no public mockup contract
// THE LOOP status: what is being fixed, what is next, what just finished.
// Same rows the agents mutate. Superuser plumbing (settings.system).
import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getLoopStatus, type LoopNodeSummary } from '@/lib/data/loop/status'
import { readIntegrationHealth } from '@/lib/data/loop/integration-health'
import { readSearchCompletenessAccept } from '@/lib/data/loop/search-completeness'
import { readVideoDecisionDocket } from '@/lib/data/loop/video-docket'
import { QueueRow, QuietRow, VerdictLine } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import {
  hostPath,
  nodeKind,
  plainBlockedReason,
  plainBot,
  plainDomain,
  plainEvidence,
  plainFindingSeverity,
  plainFindingStatus,
  plainNodeTitle,
  plainShipClass,
  upcomingHint,
} from '@/lib/data/loop/status-copy'
import { AutoRefresh } from './AutoRefresh'

export const dynamic = 'force-dynamic'

function ageWords(iso: string, nowMs: number): string {
  const m = Math.floor((nowMs - new Date(iso).getTime()) / 60_000)
  if (!Number.isFinite(m) || m < 0) return 'just now'
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 48 * 60) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function Fold({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="av2-fold" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {hint ? <span className="av2-fold__hint">{hint}</span> : null}
      </summary>
      <div className="av2-fold__body">{children}</div>
    </details>
  )
}

function nodeRow(n: LoopNodeSummary, nowMs: number, opts?: { context?: string; kind?: string; tone?: 'down' | 'slow' | 'waiting' | 'ok' | 'accent'; hot?: boolean }) {
  const { kind, tone } = nodeKind(n.title)
  return (
    <QueueRow
      key={n.id}
      kind={opts?.kind ?? kind}
      kindTone={opts?.tone ?? tone}
      title={plainNodeTitle(n.title)}
      context={opts?.context ?? `On ${plainDomain(n.domain)}`}
      age={ageWords(n.updatedAt, nowMs)}
      hot={opts?.hot}
    />
  )
}

export default async function LoopStatusPage() {
  await requireAdminPage('settings.system')
  const status = await getLoopStatus()
  const video = readVideoDecisionDocket()
  const integrations = readIntegrationHealth()
  const searchCompleteness = readSearchCompletenessAccept()
  const nowMs = Date.now()

  const running = status.nodes.runningNow
  const next = status.nodes.queueNext[0] ?? null
  const nextShip = status.nodes.nextShip
  const nextClass = next
    ? nextShip?.punchServed != null
      ? [next]
      : status.nodes.queueNext.filter((n) => n.shipClass === next.shipClass)
    : []
  const nextTogether =
    nextShip?.punchServed != null
      ? nextShip.punchServed
      : nextClass.length
  const remainingAfterShown = Math.max(0, status.nodes.byState.open - status.nodes.queueNext.length)
  const attention =
    status.nodes.staleClaims.length +
    status.ledger.expiredCount +
    status.findings.recent.filter((f) => f.status === 'new' && (f.severity === 'p0' || f.severity === 'major')).length

  const lastLaunch = status.sentinel.recent.find((l) => l.kind === 'launch')

  const videoLine =
    video.status === 'ok'
      ? video.decision.status === 'pending'
        ? 'Still waiting on your park-or-rebuild decision'
        : `Decision: ${video.decision.status}`
      : 'Video decision file unreadable'
  const integrationsLine =
    integrations.status === 'ok'
      ? integrations.unknownCount === 0
        ? `Checked. ${integrations.greenCount} healthy, ${integrations.parkCount} parked`
        : `${integrations.unknownCount} still unknown`
      : 'Integration checks unreadable'
  const searchLine =
    searchCompleteness.status === 'ok'
      ? `Search leftovers closed (${searchCompleteness.longTail.disposedCount} long-tail). Recorded ${formatDate(searchCompleteness.recordedAt)}`
      : 'Search completeness file unreadable'

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <AutoRefresh seconds={60} />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={attention > 0 ? 'attention' : 'ok'}>
          {!status.armed ? (
            <>
              <b>Off.</b> Nothing starts on its own.
              {running.length > 0 ? ' A session is still working by hand.' : ''}
            </>
          ) : running.length > 0 ? (
            <>
              <b>Fixing now:</b> {plainNodeTitle(running[0].title)}
            </>
          ) : next ? (
            <>
              <b>On.</b> Next up: {plainNodeTitle(next.title)}
              {nextTogether > 1
                ? ` and ${nextTogether - 1} more ${plainShipClass(nextShip?.key ?? next.shipClass)} ${nextTogether - 1 === 1 ? 'item' : 'items'} that rebuild with it`
                : ''}
            </>
          ) : (
            <>
              <b>On, and the list is empty.</b> Everything is finished, waiting on you, or dropped.
            </>
          )}
          {attention > 0 ? <> {attention} thing{attention === 1 ? '' : 's'} below need a look.</> : null}
        </VerdictLine>
      </div>

      {running.length > 0 && (
        <Fold title="Being fixed right now" hint={ageWords(running[0].updatedAt, nowMs)} defaultOpen>
          <p className="av2-fold__lede">
            {running.length === 1
              ? 'The loop is on this one item. When it finishes, it takes the next ship class on the list.'
              : `The loop has ${running.length} items in one ship. They share one site rebuild. When they finish, it takes the next class.`}
          </p>
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {running.map((n) =>
              nodeRow(n, nowMs, { context: `On ${plainDomain(n.domain)}`, kind: 'Now', tone: 'accent' }),
            )}
          </ul>
        </Fold>
      )}

      <Fold
        title="What's next"
        hint={upcomingHint(status.nodes.upcomingCounts)}
        defaultOpen
      >
        {status.nodes.queueNext.length > 0 ? (
          <>
            <p className="av2-fold__lede">
              In the order the loop will take them. Urgent website problems go first, then other website
              fixes, then items you asked for, then the company list.
              {next && nextTogether > 1
                ? ` The next ${nextTogether} ${plainShipClass(nextShip?.key ?? next.shipClass)} items ship together so the site rebuilds once.`
                : ''}
            </p>
            <ul className="av2-queue" style={{ marginTop: 8 }}>
              {status.nodes.queueNext.map((n) => nodeRow(n, nowMs))}
            </ul>
            {remainingAfterShown > 0 ? (
              <p className="av2-fold__lede">
                Showing the next {status.nodes.queueNext.length}. {remainingAfterShown} more after that.
              </p>
            ) : null}
          </>
        ) : (
          <p className="av2-fold__lede">Nothing waiting. The loop will sit until a bot finds something or you add work.</p>
        )}
      </Fold>

      {status.nodes.blocked.length > 0 && (
        <Fold title="Waiting on you" hint={`${status.nodes.blocked.length}`} defaultOpen>
          <p className="av2-fold__lede">The loop skipped these and kept going. They stay here until the wait is over.</p>
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {status.nodes.blocked.map((n) =>
              nodeRow(n, nowMs, {
                kind: 'Waiting',
                tone: 'waiting',
                context: plainBlockedReason(n.blockedReason),
              }),
            )}
          </ul>
        </Fold>
      )}

      {status.nodes.staleClaims.length > 0 && (
        <Fold title="Stuck" hint={`${status.nodes.staleClaims.length} quiet`} defaultOpen>
          <p className="av2-fold__lede">
            A session claimed this and then went quiet. The loop will free it and someone else will pick it up.
          </p>
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {status.nodes.staleClaims.map((n) =>
              nodeRow(n, nowMs, {
                kind: 'Stuck',
                tone: 'slow',
                context: `On ${plainDomain(n.domain)}`,
                hot: true,
              }),
            )}
          </ul>
        </Fold>
      )}

      <Fold title="Just finished" hint={`${status.nodes.recentDone.length} recent`} defaultOpen>
        {status.nodes.recentDone.length > 0 ? (
          <ul className="av2-quietlist" style={{ marginTop: 8 }}>
            {status.nodes.recentDone.map((n) => (
              <QuietRow
                key={n.id}
                name={plainNodeTitle(n.title)}
                state={ageWords(n.updatedAt, nowMs)}
                figure={plainEvidence(n.evidenceFirstLine)}
              />
            ))}
          </ul>
        ) : (
          <p className="av2-fold__lede">Nothing finished yet.</p>
        )}
      </Fold>

      <Fold
        title="What the bots reported"
        hint={status.findings.recent.length ? `${status.findings.recent.length} latest` : 'None yet'}
      >
        {status.findings.recent.length > 0 ? (
          <>
            <p className="av2-fold__lede">
              The six website walkers send these in. Urgent and broken items become the fix list above.
            </p>
            <ul className="av2-queue" style={{ marginTop: 8 }}>
              {status.findings.recent.map((f, i) => {
                const sev = plainFindingSeverity(f.severity)
                return (
                  <QueueRow
                    key={`${f.bot}-${f.caseId}-${i}`}
                    kind={sev.kind}
                    kindTone={sev.tone}
                    title={f.observed ? f.observed.slice(0, 140) : `${plainBot(f.bot)} on ${hostPath(f.url)}`}
                    context={`${plainBot(f.bot)} · ${hostPath(f.url)} · ${plainFindingStatus(f.status)}`}
                    age={ageWords(f.createdAt, nowMs)}
                    hot={f.status === 'new' && (f.severity === 'p0' || f.severity === 'major')}
                  />
                )
              })}
            </ul>
          </>
        ) : (
          <p className="av2-fold__lede">No reports yet.</p>
        )}
      </Fold>

      <Fold
        title="What we're measuring"
        hint={
          status.ledger.expiredCount
            ? `${status.ledger.expiredCount} ready to score`
            : status.ledger.openWindows.length
              ? `${status.ledger.openWindows.length} open`
              : 'None'
        }
      >
        {status.ledger.openWindows.length > 0 ? (
          <>
            <p className="av2-fold__lede">
              A measurement bet, not the fix list. One open bet per area. The website can still be
              fixed while this is running. After the end date we score whether it worked.
            </p>
            <ul className="av2-quietlist" style={{ marginTop: 8 }}>
              {status.ledger.openWindows.map((w) => (
                <QuietRow
                  key={w.id}
                  name={`${plainDomain(w.domain)} · ${w.changeClass.replace(/-/g, ' ')}`}
                  state={w.expired ? 'Score this' : 'Measuring'}
                  figure={w.expired ? 'Window ended. Write whether it worked.' : `Score after ${formatDate(w.endsAt)}`}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="av2-fold__lede">No open measurement bets.</p>
        )}
      </Fold>

      <Fold
        title="How the loop is running"
        hint={status.armed ? 'On' : 'Off'}
      >
        <ul className="av2-quietlist" style={{ marginTop: 8 }}>
          <QuietRow
            name="Auto-start"
            state={status.armed ? 'On' : 'Off'}
            figure={status.armed ? 'Starts the next job when the last one finishes' : 'Planning only'}
          />
          <QuietRow
            name="Sessions started"
            figure={`${status.sentinel.launchesToday} in 24h · no daily cap`}
          />
          <QuietRow
            name="Last start"
            figure={lastLaunch ? ageWords(lastLaunch.loggedAt, nowMs) : 'none in 24h'}
          />
        </ul>
      </Fold>

      <Fold
        title="Company checklist"
        hint={`${status.version.gapsDone} of ${status.version.gapsTotal} done`}
      >
        <p className="av2-fold__lede">
          The planned Company v1 list. The loop works this after urgent website problems.
        </p>
        <ul className="av2-quietlist" style={{ marginTop: 8 }}>
          <QuietRow
            name="Planned items done"
            figure={`${status.version.gapsDone} of ${status.version.gapsTotal}`}
          />
          <QuietRow
            name="Fix list"
            figure={`${status.nodes.byState.open} waiting · ${status.nodes.byState.in_progress} in progress · ${status.nodes.byState.blocked} waiting on you · ${status.nodes.byState.done} done`}
          />
          <QuietRow name="Video docket" figure={videoLine} />
          <QuietRow name="Integration health" figure={integrationsLine} />
          <QuietRow name="Search leftovers" figure={searchLine} />
        </ul>
      </Fold>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 24 }}>
        Updated {ageWords(status.generatedAt, nowMs)} · refreshes every 60s ·{' '}
        <Link href="/admin/oversight" style={{ color: 'var(--a-accent)' }}>
          Oversight
        </Link>
        {' · '}
        <Link href="/admin/sync" style={{ color: 'var(--a-accent)' }}>
          System health
        </Link>
      </p>
    </div>
  )
}
