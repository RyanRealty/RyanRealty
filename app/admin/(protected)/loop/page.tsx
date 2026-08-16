// @no-parity — internal admin surface, no public mockup contract
// THE LOOP status (pre-arm item 1, ARMING-RUNBOOK Step 1): the one screen that
// answers "is an iteration running, what got done, what's improving" from the
// SAME rows the agents mutate — work graph, ledger windows, fleet findings,
// sentinel launch log. No self-reported status exists anywhere, so this page
// cannot drift from reality. Superuser plumbing (settings.system, same gate as
// /admin/sync); linked from Oversight's All tools strip.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getLoopStatus, type LoopNodeSummary } from '@/lib/data/loop/status'
import { readIntegrationHealth } from '@/lib/data/loop/integration-health'
import { readSearchCompletenessAccept } from '@/lib/data/loop/search-completeness'
import { readVideoDecisionDocket } from '@/lib/data/loop/video-docket'
import { QueueRow, QuietRow, VerdictLine, SectionHead } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
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

function nodeLabel(n: LoopNodeSummary): string {
  return n.versionGap ? `${n.versionGap} — ${n.title}` : n.title
}

function truncate(s: string, max = 110): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export default async function LoopStatusPage() {
  await requireAdminPage('settings.system')
  const status = await getLoopStatus()
  const video = readVideoDecisionDocket()
  const integrations = readIntegrationHealth()
  const searchCompleteness = readSearchCompletenessAccept()
  const nowMs = Date.now()

  const running = status.nodes.runningNow
  const attention =
    status.nodes.staleClaims.length +
    status.ledger.expiredCount +
    status.findings.recent.filter((f) => f.status === 'new' && (f.severity === 'p0' || f.severity === 'major')).length

  const lastLaunch = status.sentinel.recent.find((l) => l.kind === 'launch')

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <AutoRefresh seconds={60} />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={attention > 0 ? 'attention' : 'ok'}>
          {!status.armed ? (
            <>
              <b>DISARMED.</b> Planning mode (R-211) — nothing launches until Matt arms the loop.
              {running.length > 0 ? ' A session is working the graph by hand.' : ''}
            </>
          ) : running.length > 0 ? (
            <>
              <b>Iteration running</b> on {nodeLabel(running[0])} — claimed {ageWords(running[0].updatedAt, nowMs)}.
            </>
          ) : status.nodes.byState.open > 0 ? (
            <>
              <b>Armed and dormant</b> with {status.nodes.byState.open} open node
              {status.nodes.byState.open === 1 ? '' : 's'} — the next heartbeat launches.
            </>
          ) : (
            <>
              <b>Armed, queue empty.</b> Every node is done, blocked, or killed.
            </>
          )}
          {attention > 0 ? <> {attention} thing{attention === 1 ? '' : 's'} below need a look.</> : null}
        </VerdictLine>
      </div>

      <section aria-label="Version progress" style={{ marginBottom: 18 }}>
        <SectionHead>Version 1 progress</SectionHead>
        <ul className="av2-quietlist" style={{ marginTop: 8 }}>
          <QuietRow
            name="Gap nodes done"
            figure={`${status.version.gapsDone} of ${status.version.gapsTotal}`}
          />
          <QuietRow
            name="Graph"
            figure={`${status.nodes.byState.open} open · ${status.nodes.byState.in_progress} in progress · ${status.nodes.byState.blocked} blocked · ${status.nodes.byState.done} done`}
          />
          <QuietRow
            name="Video docket"
            state={video.status === 'ok' ? video.decision.status.toUpperCase() : 'UNREAD'}
            figure={
              video.status === 'ok'
                ? `park $0 vendor · rebuild cap $5/row · ${video.inventory.deadSafeZoneImports} dead imports · M3 ${video.decision.status}`
                : 'docket unreadable'
            }
          />
          <QuietRow
            name="Integration health"
            state={integrations.status === 'ok' && integrations.unknownCount === 0 ? 'PROBED' : 'UNREAD'}
            figure={
              integrations.status === 'ok'
                ? `unknown ${integrations.unknownCount} · green ${integrations.greenCount} · park ${integrations.parkCount} · ${integrations.probedCount} probed`
                : 'probes unreadable'
            }
          />
          <QuietRow
            name="Search completeness"
            state={searchCompleteness.status === 'ok' ? 'ACCEPT' : 'UNREAD'}
            figure={
              searchCompleteness.status === 'ok'
                ? `${searchCompleteness.longTail.disposedCount} long-tail · TTFB p75 ${searchCompleteness.perf.p75.ttfbHomesForSaleMs}/${searchCompleteness.perf.p75.ttfbBendMs}ms · ${formatDate(searchCompleteness.recordedAt)}`
                : 'accept ledger unreadable'
            }
          />
        </ul>
      </section>

      {running.length > 0 && (
        <section aria-label="Running now" style={{ marginBottom: 18 }}>
          <SectionHead>Running now</SectionHead>
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {running.map((n) => (
              <QueueRow
                key={n.id}
                kind="Running"
                kindTone="accent"
                title={nodeLabel(n)}
                context={`${n.domain}${n.ownerSession ? ` · ${n.ownerSession}` : ''}`}
                age={ageWords(n.updatedAt, nowMs)}
              />
            ))}
          </ul>
        </section>
      )}

      {status.nodes.staleClaims.length > 0 && (
        <section aria-label="Stale claims" style={{ marginBottom: 18 }}>
          <SectionHead>Stale claims (past the 3h fresh window)</SectionHead>
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {status.nodes.staleClaims.map((n) => (
              <QueueRow
                key={n.id}
                kind="Stale"
                kindTone="slow"
                title={nodeLabel(n)}
                context={`${n.ownerSession ?? 'no owner'} — orphan release frees it when the owner run is terminal`}
                age={ageWords(n.updatedAt, nowMs)}
                hot
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Up next" style={{ marginBottom: 18 }}>
        <SectionHead>Up next (queue order)</SectionHead>
        {status.nodes.queueNext.length > 0 ? (
          <ul className="av2-quietlist" style={{ marginTop: 8 }}>
            {status.nodes.queueNext.map((n) => (
              <QuietRow key={n.id} name={nodeLabel(n)} state="OPEN" figure={n.domain} />
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>
            Queue is empty — nothing open.
          </p>
        )}
      </section>

      {status.nodes.blocked.length > 0 && (
        <section aria-label="Blocked" style={{ marginBottom: 18 }}>
          <SectionHead>Blocked (waiting on a human or a gate)</SectionHead>
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {status.nodes.blocked.map((n) => (
              <QueueRow
                key={n.id}
                kind="Waiting"
                kindTone="waiting"
                title={nodeLabel(n)}
                context={n.blockedReason ?? 'no reason recorded'}
                age={ageWords(n.updatedAt, nowMs)}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Recently completed" style={{ marginBottom: 18 }}>
        <SectionHead>Recently completed</SectionHead>
        {status.nodes.recentDone.length > 0 ? (
          <ul className="av2-quietlist" style={{ marginTop: 8 }}>
            {status.nodes.recentDone.map((n) => (
              <QuietRow
                key={n.id}
                name={nodeLabel(n)}
                state={ageWords(n.updatedAt, nowMs)}
                figure={n.evidenceFirstLine ? truncate(n.evidenceFirstLine) : 'evidence on the node'}
              />
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>
            Nothing completed yet.
          </p>
        )}
      </section>

      <section aria-label="Fleet findings" style={{ marginBottom: 18 }}>
        <SectionHead>Fleet findings inbox</SectionHead>
        {status.findings.recent.length > 0 ? (
          <ul className="av2-queue" style={{ marginTop: 8 }}>
            {status.findings.recent.map((f, i) => (
              <QueueRow
                key={`${f.bot}-${f.caseId}-${i}`}
                kind={f.severity}
                kindTone={f.severity === 'p0' ? 'down' : f.severity === 'major' ? 'slow' : 'accent'}
                title={`${f.bot}: ${f.caseId}`}
                context={`${f.url} · ${f.status}`}
                age={ageWords(f.createdAt, nowMs)}
                hot={f.status === 'new' && (f.severity === 'p0' || f.severity === 'major')}
              />
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>
            No findings yet — bots are not running (fleet setup is Phase 3 of the runbook).
          </p>
        )}
      </section>

      <section aria-label="Ledger windows" style={{ marginBottom: 18 }}>
        <SectionHead>Measurement windows (Learn step)</SectionHead>
        {status.ledger.openWindows.length > 0 ? (
          <ul className="av2-quietlist" style={{ marginTop: 8 }}>
            {status.ledger.openWindows.map((w) => (
              <QuietRow
                key={w.id}
                name={`${w.domain} — ${w.changeClass}`}
                state={w.expired ? 'EXPIRED' : 'open'}
                figure={
                  w.expired
                    ? 'unlearned — domain freezes until closed'
                    : `ends ${formatDate(w.endsAt)}`
                }
              />
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>
            No open windows — every shipped class has been measured and closed.
          </p>
        )}
      </section>

      <section aria-label="Sentinel" style={{ marginBottom: 18 }}>
        <SectionHead>Sentinel (the self-starter)</SectionHead>
        <ul className="av2-quietlist" style={{ marginTop: 8 }}>
          <QuietRow name="State" state={status.armed ? 'ARMED' : 'DISARMED'} figure="LOOP_SENTINEL env, read live" />
          <QuietRow
            name="Launches today"
            figure={`${status.sentinel.launchesToday} in 24h · no daily cap`}
          />
          <QuietRow
            name="Last launch"
            figure={lastLaunch ? `${ageWords(lastLaunch.loggedAt, nowMs)} · ${lastLaunch.agentId}` : 'none in 24h'}
          />
          {status.sentinel.recent
            .filter((l) => l.kind === 'orphan-release')
            .slice(0, 3)
            .map((l, i) => (
              <QuietRow
                key={`rel-${i}`}
                name="Orphan release"
                state={ageWords(l.loggedAt, nowMs)}
                figure={`freed a dead session's claim (${l.agentId})`}
              />
            ))}
        </ul>
      </section>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 24 }}>
        Updated {ageWords(status.generatedAt, nowMs)} · auto-refreshes every 60s · All tools:{' '}
        <Link href="/admin/oversight" style={{ color: 'var(--a-accent)' }}>
          Oversight
        </Link>
        {' · '}
        <Link href="/admin/sync" style={{ color: 'var(--a-accent)' }}>
          System health
        </Link>
        {' · '}
        runbook: docs/plans/ENTERPRISE_MAP/ARMING-RUNBOOK.md
      </p>
    </div>
  )
}
