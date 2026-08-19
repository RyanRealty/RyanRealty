// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/analytics/action-required - the "what should I do right now" dashboard.
 *
 * One page. Five sections of prioritized cards. Each card surfaces a
 * specific action: which hot leads to call, which warm prospects are on
 * the site right now, which anonymous visitors to retarget, which paid
 * campaigns to pause, which LPs to rebuild. Designed for the broker to
 * open first thing every morning.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — the superuser gate (analytics/layout.tsx), all six reads
 * (their filters, cutoffs, orders and limits), the spend-alert thresholds, the
 * LP rebuild aggregation, and every href are carried over verbatim.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { getLeadIntake } from '@/lib/data/crm/getLeadIntake'
import { QueueRow, SectionHead, StateWord, VerdictLine, type AdminState } from '@/components/admin/v2'
import { GridSkeleton, LaneNote, StatePanel } from '../_components/v2/DataGrid'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function fmtRel(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function lpVariantFromPath(p: string | null): string | null {
  if (!p) return null
  let path = p
  try { path = new URL(p).pathname } catch {}
  path = path.toLowerCase().replace(/\/+$/, '')
  if (path === '/home-valuation') return 'seller-home-value'
  const m = path.match(/^\/lp\/([a-z0-9-]+)/)
  return m ? m[1] : null
}

/** The one shape every lane on this page uses: five rows, the rest behind a fold. */
function FoldedQueue<T extends { key: string }>({
  items,
  renderItem,
  label,
}: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  label: string
}) {
  const preview = items.slice(0, 5)
  const rest = items.slice(5)
  return (
    <>
      <ul className="av2-queue">{preview.map((it) => renderItem(it))}</ul>
      {rest.length > 0 ? (
        <details style={{ margin: '0 0 var(--a-s5)' }}>
          <summary
            style={{
              cursor: 'pointer',
              listStyle: 'none',
              fontSize: 'var(--a-text-sm)',
              fontWeight: 600,
              color: 'var(--a-accent)',
            }}
          >
            See all {items.length} {label} →
          </summary>
          <ul className="av2-queue" style={{ marginTop: 'var(--a-s2)' }}>
            {rest.map((it) => renderItem(it))}
          </ul>
        </details>
      ) : null}
    </>
  )
}

function TagRow({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null
  return (
    <span className="av2-wordrow" style={{ marginTop: 4 }}>
      {tags.map((t) => (
        <StateWord key={t} state="waiting">
          {t.replace(/_/g, ' ')}
        </StateWord>
      ))}
    </span>
  )
}

type HotRow = { key: string; session_id: string; identified_email: string | null; fub_person_id: number | null; hot_lead_fired_at: string; peak_score: number; intent_tags: string[]; utm_source: string | null; ip_city: string | null }

async function HotLeadsLane() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_email, fub_person_id, hot_lead_fired_at, peak_score, intent_tags, utm_source, ip_city')
    .gte('hot_lead_fired_at', cutoff)
    .not('fub_person_id', 'is', null)
    .order('hot_lead_fired_at', { ascending: false })
    .limit(20)
  if (error) return null
  const rows = ((data ?? []) as Omit<HotRow, 'key'>[]).map((r) => ({ ...r, key: r.session_id }))

  return (
    <section aria-label="Hot leads to call">
      <SectionHead>Hot leads to call (last 48 hrs) — {rows.length}</SectionHead>
      {rows.length === 0 ? (
        <StatePanel>
          No hot leads in the last 48 hours. When score crosses 100 and the visitor is identified, they appear here.{' '}
          <Link href="/admin/visitors/live" style={{ color: 'var(--a-accent)' }}>
            Watch live visitors
          </Link>
          .
        </StatePanel>
      ) : (
        <FoldedQueue
          items={rows}
          label="hot leads"
          renderItem={(r: HotRow) => (
            <QueueRow
              key={r.session_id}
              kind="Hot"
              kindTone="down"
              age={fmtRel(r.hot_lead_fired_at)}
              hot
              title={
                r.fub_person_id ? (
                  <Link href={`/admin/people/${r.fub_person_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {r.identified_email ?? `Legacy #${r.fub_person_id}`}
                  </Link>
                ) : (
                  <span>{r.identified_email}</span>
                )
              }
              context={
                <>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>Score {r.peak_score}</span>
                  {' · '}
                  {r.utm_source || 'direct'}
                  {' · '}
                  {r.ip_city || 'unknown'}
                  <TagRow tags={r.intent_tags ?? []} />
                </>
              }
              action={
                <Link
                  href={`/admin/visitors/${encodeURIComponent(r.session_id)}`}
                  className="av2-btn av2-btn--quiet"
                  style={{ textDecoration: 'none' }}
                >
                  Journey
                </Link>
              }
            />
          )}
        />
      )}
    </section>
  )
}

type WarmRow = { key: string; session_id: string; identified_email: string | null; fub_person_id: number | null; engagement_score: number; utm_source: string | null; ip_city: string | null; last_seen_at: string }

async function WarmActiveLane() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_email, fub_person_id, engagement_score, intent_tags, utm_source, ip_city, last_seen_at')
    .gte('last_seen_at', cutoff)
    .gte('engagement_score', 50)
    .not('identified_at', 'is', null)
    .order('engagement_score', { ascending: false })
    .limit(15)
  if (error) return null
  const rows = ((data ?? []) as Omit<WarmRow, 'key'>[]).map((r) => ({ ...r, key: r.session_id }))

  return (
    <section aria-label="Warm prospects active now">
      <SectionHead>Warm prospects active now — {rows.length}</SectionHead>
      {rows.length === 0 ? (
        <StatePanel>
          No identified visitors with score 50+ in the last 30 minutes.{' '}
          <Link href="/admin/visitors/live" style={{ color: 'var(--a-accent)' }}>
            Watch live visitors
          </Link>
          .
        </StatePanel>
      ) : (
        <FoldedQueue
          items={rows}
          label="warm prospects"
          renderItem={(r: WarmRow) => (
            <QueueRow
              key={r.session_id}
              kind="Warm"
              kindTone="slow"
              age={fmtRel(r.last_seen_at)}
              title={
                r.fub_person_id ? (
                  <Link href={`/admin/people/${r.fub_person_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {r.identified_email ?? `Legacy #${r.fub_person_id}`}
                  </Link>
                ) : (
                  <span>{r.identified_email}</span>
                )
              }
              context={
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  score {r.engagement_score} · {r.utm_source || 'direct'} · {r.ip_city || '—'}
                </span>
              }
              action={
                <Link
                  href={`/admin/visitors/${encodeURIComponent(r.session_id)}`}
                  className="av2-btn av2-btn--quiet"
                  style={{ textDecoration: 'none' }}
                >
                  Journey
                </Link>
              }
            />
          )}
        />
      )}
    </section>
  )
}

type AnonRow = { key: string; session_id: string; engagement_score: number; intent_tags: string[]; utm_source: string | null; utm_campaign: string | null; ip_city: string | null; last_seen_at: string }

async function AnonymousHighEngagementLane() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, engagement_score, intent_tags, utm_source, utm_campaign, ip_city, last_seen_at')
    .gte('last_seen_at', cutoff)
    .gte('engagement_score', 80)
    .is('identified_at', null)
    .order('engagement_score', { ascending: false })
    .limit(15)
  if (error) return null
  const rows = ((data ?? []) as Omit<AnonRow, 'key'>[]).map((r) => ({ ...r, key: r.session_id }))

  return (
    <section aria-label="Anonymous high-engagement visitors">
      <SectionHead>Anonymous high-engagement (retargeting) — {rows.length}</SectionHead>
      {rows.length === 0 ? (
        <StatePanel>No anonymous visitors with score 80+ in the last 24 hours.</StatePanel>
      ) : (
        <>
          <LaneNote>
            These visitors browsed heavily but never signed in. Build a Meta Custom Audience around their cities and
            intent tags for retargeting.
          </LaneNote>
          <FoldedQueue
            items={rows}
            label="anonymous visitors"
            renderItem={(r: AnonRow) => (
              <QueueRow
                key={r.session_id}
                kind="Anon"
                kindTone="waiting"
                age={fmtRel(r.last_seen_at)}
                title={<span style={{ fontVariantNumeric: 'tabular-nums' }}>score {r.engagement_score}</span>}
                context={
                  <>
                    {r.utm_source || 'direct'}
                    {r.utm_campaign ? ` · ${r.utm_campaign}` : ''} · {r.ip_city || '—'}
                    <TagRow tags={r.intent_tags ?? []} />
                  </>
                }
                action={
                  <Link
                    href={`/admin/visitors/${encodeURIComponent(r.session_id)}`}
                    className="av2-btn av2-btn--quiet"
                    style={{ textDecoration: 'none' }}
                  >
                    Journey
                  </Link>
                }
              />
            )}
          />
        </>
      )}
    </section>
  )
}

async function SpendAlerts() {
  const supabase = getSupabase()
  const now = Date.now()
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  // Denominator = REAL inbound leads via getLeadIntake (the canonical lead source).
  // The old code divided by marketing_channel_daily channel='fub'
  // qualified_seller_leads — a metric whose writer was removed 2026-07, so it was
  // structurally always 0 and fired a false "CRITICAL: pause your ads" on any $60
  // of spend. getLeadIntake reads crm_people directly (dashboard source of truth).
  const [{ data: spend3d }, intake] = await Promise.all([
    supabase.from('marketing_channel_daily').select('value')
      .eq('channel', 'meta_ads').eq('scope', 'account').eq('metric', 'spend').gte('date', threeDaysAgo),
    getLeadIntake({
      startIso: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      endIso: new Date(now).toISOString(),
    }),
  ])
  const totalSpend = (spend3d ?? []).reduce((acc, r) => acc + (Number((r as { value: number }).value) || 0), 0)
  const totalLeads = intake.inboundLeads
  const alerts: { severity: 'critical' | 'warning' | 'info'; message: string }[] = []
  if (totalSpend >= 60 && totalLeads === 0) {
    alerts.push({
      severity: 'critical',
      message: `Spent ${fmtUsd(totalSpend)} on Meta over the last 3 days with zero new leads. Pause the weakest ad set and audit creative before more spend ships.`,
    })
  } else if (totalSpend > 0 && totalLeads > 0) {
    const cpl = totalSpend / totalLeads
    if (cpl > 150) {
      alerts.push({
        severity: 'warning',
        message: `3-day cost per new lead is ${fmtUsd(cpl)}, above the $150 healthy threshold. Tighten audience or pause weakest creative.`,
      })
    }
  }

  const SEVERITY_STATE: Record<'critical' | 'warning' | 'info', AdminState> = {
    critical: 'down',
    warning: 'slow',
    info: 'waiting',
  }

  return (
    <section aria-label="Spend alerts">
      <SectionHead>Spend alerts (last 3 days)</SectionHead>
      {alerts.length === 0 ? (
        <StatePanel>
          No spend anomalies detected. <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(totalSpend)}</span>{' '}
          spent for <span style={{ fontVariantNumeric: 'tabular-nums' }}>{totalLeads}</span> new leads.
        </StatePanel>
      ) : (
        <ul className="av2-queue">
          {alerts.map((a, i) => (
            <QueueRow
              key={i}
              kind={a.severity}
              kindTone={SEVERITY_STATE[a.severity]}
              title={a.message}
              action={
                <Link href="/admin/analytics/ad-roi" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                  Ad ROI
                </Link>
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}

async function LpRebuildLane() {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // Paged read — PostgREST caps single responses at 1,000 rows, so the old
  // .limit(5000) silently truncated there.
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select('landing_page, identified_at')
        .gte('first_seen_at', cutoff)
        .order('session_id', { ascending: true })
        .range(from, to),
    5000,
  )
  if (error) return null
  const byLp = new Map<string, { visits: number; identified: number }>()
  for (const raw of data) {
    const r = raw as { landing_page: string | null; identified_at: string | null }
    const variant = lpVariantFromPath(r.landing_page)
    if (!variant) continue
    const b = byLp.get(variant) ?? { visits: 0, identified: 0 }
    b.visits += 1
    if (r.identified_at) b.identified += 1
    byLp.set(variant, b)
  }
  const rebuilds = Array.from(byLp.entries())
    .filter(([, b]) => b.visits >= 20 && b.identified / b.visits < 0.05)
    .map(([v, b]) => ({ variant: v, visits: b.visits, identified: b.identified, rate: b.identified / b.visits }))
    .sort((a, b) => b.visits - a.visits)

  return (
    <section aria-label="LPs to rebuild">
      <SectionHead>LPs to rebuild — {rebuilds.length}</SectionHead>
      {rebuilds.length === 0 ? (
        <StatePanel>
          No LPs are below the 5% identify threshold with enough volume.{' '}
          <Link href="/admin/analytics/lp-leaderboard" style={{ color: 'var(--a-accent)' }}>
            Check the LP leaderboard
          </Link>{' '}
          for full rankings.
        </StatePanel>
      ) : (
        <>
          <LaneNote>
            20+ visits in 7 days but identify rate under 5%. Traffic is landing but the form/sign-in is not working.
          </LaneNote>
          <ul className="av2-queue">
            {rebuilds.map((r) => (
              <QueueRow
                key={r.variant}
                kind="Rebuild"
                kindTone="down"
                title={r.variant}
                context={
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.visits} visits · {r.identified} identified · {(r.rate * 100).toFixed(1)}% rate
                  </span>
                }
                action={
                  <a
                    href={`/lp/${r.variant}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="av2-btn av2-btn--quiet"
                    style={{ textDecoration: 'none' }}
                  >
                    Open LP
                  </a>
                }
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

type LoopHealthCheck = { name: string; status: 'green' | 'yellow' | 'red' | string; value?: string | number | null; note?: string | null }

async function LoopHealthLane() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_decisions')
    .select('decided_at, decision_summary, data_observed')
    .eq('decision_type', 'loop_health_check')
    .order('decided_at', { ascending: false })
    .limit(1)
  if (error) return null
  const latest = data?.[0] as {
    decided_at: string | null
    decision_summary: string | null
    data_observed: { summary?: Record<string, unknown>; checks?: LoopHealthCheck[] } | null
  } | undefined
  const checks = latest?.data_observed?.checks ?? []
  const reds = checks.filter((c) => c.status === 'red')
  const yellows = checks.filter((c) => c.status === 'yellow')
  const greens = checks.filter((c) => c.status === 'green').length

  return (
    <section aria-label="Pipeline health">
      <SectionHead>
        Pipeline health — {reds.length} red · {yellows.length} yellow
      </SectionHead>
      {!latest ? (
        <StatePanel>No loop-health run recorded yet. The daily 12:30 UTC cron writes the first row.</StatePanel>
      ) : (
        <>
          <LaneNote>
            The loop-health cron checks snapshot freshness, dark channels, queue depths, and cost daily, but its findings
            only lived in marketing_decisions until now. {greens} checks green. Last run{' '}
            {latest.decided_at ? fmtRel(latest.decided_at) : 'unknown'}.
          </LaneNote>
          {reds.length === 0 && yellows.length === 0 ? (
            <StatePanel>Everything the loop monitors is green. Nothing is running dark.</StatePanel>
          ) : (
            <ul className="av2-queue">
              {[...reds, ...yellows].map((c) => (
                <QueueRow
                  key={c.name}
                  kind={c.status === 'red' ? 'Down' : 'Slow'}
                  kindTone={c.status === 'red' ? 'down' : 'slow'}
                  title={c.name}
                  context={c.note ?? undefined}
                  age={String(c.value ?? c.status)}
                  hot={c.status === 'red'}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export default async function ActionRequiredPage() {
  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <VerdictLine tone="attention">
        <b>Burn through whatever is red before you touch anything else.</b> Each lane below carries its own next move.
      </VerdictLine>

      <Suspense fallback={<GridSkeleton rows={5} label="Loading hot leads" />}>
        <HotLeadsLane />
      </Suspense>
      <Suspense fallback={<GridSkeleton rows={5} label="Loading warm prospects" />}>
        <WarmActiveLane />
      </Suspense>
      <Suspense fallback={<GridSkeleton rows={5} label="Loading anonymous visitors" />}>
        <AnonymousHighEngagementLane />
      </Suspense>
      <Suspense fallback={<GridSkeleton rows={4} label="Loading LP rebuilds" />}>
        <LpRebuildLane />
      </Suspense>
      <Suspense fallback={<GridSkeleton rows={3} label="Loading spend alerts" />}>
        <SpendAlerts />
      </Suspense>
      <Suspense fallback={<GridSkeleton rows={3} label="Loading pipeline health" />}>
        <LoopHealthLane />
      </Suspense>
    </div>
  )
}
