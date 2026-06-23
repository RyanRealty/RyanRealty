// @no-parity — internal admin observability surface, no public mockup contract
/**
 * /admin/crm/health — the CRM vital-signs board (CONTACT360 Phase 9.5).
 *
 * One page a broker/admin opens to see whether the self-owned CRM is healthy at
 * a glance. Every tile reads a LIVE signal and shows a green / amber / red dot:
 *
 *   1. Mirror        — mirrorHealthStatus(env): is the FUB -> crm_* mirror on?
 *   2. Outbound SMS  — getA2pCampaignStatus(): is the A2P campaign VERIFIED?
 *   3. Inbound webhooks — getCrmSignalFreshness(): how stale is the last
 *      sms_in / call / email-engagement event in crm_timeline?
 *   4. Suppressions  — getSuppressionCounts(): opt-out footprint by channel +
 *      reason, and the suppression-net mailable share.
 *   5. Lead volume   — getCrmLeadVolume(): new crm_people in the last 24h / 7d.
 *
 * Auth: the (protected) layout already gates on session + admin role; this page
 * additionally re-checks getCrmAccess() so a non-CRM admin lands on access-denied.
 *
 * Mobile-first: a single-column stack on phones, two/three columns from sm/lg.
 * Every status uses the console StatusPill (dot + tinted fill + label — status is
 * never color alone). The color decision flows through the PURE level helpers in
 * lib/crm/health-levels (unit-tested), so the thresholds can't drift per tile.
 *
 * DAL: every DB read goes through lib/data/crm readers (no raw .from() here).
 */
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getCrmAccess } from '@/app/actions/crm'
import { mirrorHealthStatus } from '@/lib/crm/mirror-health'
import { getA2pCampaignStatus } from '@/lib/crm/twilio'
import { getSuppressionCounts } from '@/lib/data/crm/getSuppressionCounts'
import { getCrmSignalFreshness, getCrmLeadVolume, getCrmContactTotal } from '@/lib/data/crm/getCrmSignalFreshness'
import {
  freshnessLevel,
  suppressionRateLevel,
  a2pLevel,
  levelTone,
  worstLevel,
  ageMinutesSince,
  type HealthLevel,
} from '@/lib/crm/health-levels'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { StatusPill } from '@/components/console/StatusPill'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'CRM health | Admin' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Inbound webhooks can be legitimately quiet for hours, so the bands are lenient:
// a channel with no event for a full day is worth a glance, three days cold
// strongly implies the webhook itself is broken (a rotated token, a 404 relay).
const FRESHNESS_THRESHOLDS = { warnAfter: 24 * 60, staleAfter: 72 * 60 }

function formatRelative(iso: string | null, nowMs: number): string {
  if (!iso) return 'never'
  const mins = ageMinutesSince(iso, nowMs)
  if (mins === null) return 'never'
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

function levelLabel(level: HealthLevel): string {
  if (level === 'ok') return 'Healthy'
  if (level === 'warn') return 'Watch'
  return 'Action needed'
}

/** One vital-sign tile: heading row with a status dot, then the metric + a note. */
function HealthTile({
  title,
  level,
  pillLabel,
  metric,
  note,
}: {
  title: string
  level: HealthLevel
  pillLabel: string
  metric: React.ReactNode
  note: string
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <StatusPill tone={levelTone(level)} label={pillLabel} />
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{metric}</div>
        <p className="mt-auto text-xs leading-relaxed text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

async function HealthBoard() {
  const nowMs = Date.now()

  // All live signals in parallel. getA2pCampaignStatus hits Twilio over the
  // network and can throw if creds/host misbehave — catch so one slow API call
  // never blanks the whole board.
  const [a2pResult, signals, suppressions, leadVolume, contactTotal] = await Promise.all([
    getA2pCampaignStatus().catch(() => null),
    getCrmSignalFreshness(),
    getSuppressionCounts(),
    getCrmLeadVolume(nowMs),
    getCrmContactTotal(),
  ])

  // 1. Mirror kill-switch (pure read of the env bag).
  const mirror = mirrorHealthStatus({ CRM_MIRROR_ENABLED: process.env.CRM_MIRROR_ENABLED })
  const mirrorLevel: HealthLevel = mirror.level === 'alarm' ? 'stale' : 'ok'

  // 2. Outbound SMS readiness.
  const a2p = a2pResult
  const smsLevel = a2pLevel(a2p)

  // 3. Inbound webhook freshness, per watched signal.
  const signalTiles = signals.map((s) => {
    const ageMin = ageMinutesSince(s.latest, nowMs)
    const level = freshnessLevel(ageMin, FRESHNESS_THRESHOLDS)
    return { ...s, ageMin, level }
  })

  // 4. Suppression footprint + rate (suppression-net mailable share).
  const suppressedPeople = Math.max(suppressions.blockedEmail, suppressions.blockedSms)
  const suppressionRate = contactTotal > 0 ? suppressedPeople / contactTotal : 0
  const suppressionLevel: HealthLevel = suppressions.unreadable
    ? 'stale'
    : suppressionRateLevel(suppressionRate)

  // 5. Lead volume (informational — never red just for being quiet).
  const leadLevel: HealthLevel = leadVolume.unreadable ? 'stale' : 'ok'

  const overall = worstLevel([
    mirrorLevel,
    smsLevel,
    suppressionLevel,
    leadLevel,
    ...signalTiles.map((s) => s.level),
  ])

  return (
    <div className="space-y-6">
      {/* Overall roll-up */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Overall</span>
        <StatusPill tone={levelTone(overall)} label={levelLabel(overall)} pulse={overall !== 'ok'} />
        <span className="text-xs text-muted-foreground">checked {formatRelative(new Date(nowMs).toISOString(), nowMs)}</span>
      </div>

      {/* Top vital signs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HealthTile
          title="Mirror"
          level={mirrorLevel}
          pillLabel={mirror.enabled ? 'On' : 'Disabled'}
          metric={mirror.enabled ? 'Mirroring' : 'Stopped'}
          note={
            mirror.enabled
              ? 'FUB leads are flowing into crm_*. The kill switch is off.'
              : 'CRM_MIRROR_ENABLED=false. FUB leads are not mirroring into crm_*. Unset it to restore capture.'
          }
        />
        <HealthTile
          title="Outbound SMS"
          level={smsLevel}
          pillLabel={a2p ?? 'Unknown'}
          metric={a2p === 'VERIFIED' ? 'Live' : a2p ?? 'Unknown'}
          note={
            a2p === 'VERIFIED'
              ? 'The A2P 10DLC campaign is verified. Texts send through the messaging service.'
              : 'Carriers block outbound SMS until the A2P campaign is verified. Texts are held until then.'
          }
        />
        <HealthTile
          title="New leads"
          level={leadLevel}
          pillLabel={leadVolume.unreadable ? 'Unreadable' : 'Tracked'}
          metric={leadVolume.unreadable ? '—' : formatInt(leadVolume.last24h)}
          note={
            leadVolume.unreadable
              ? 'crm_people could not be read. Lead-volume tracking is degraded.'
              : `${formatInt(leadVolume.last24h)} in the last 24 hours, ${formatInt(leadVolume.last7d)} in the last 7 days.`
          }
        />
      </div>

      {/* Inbound webhook freshness */}
      <ConsoleSection title="Inbound webhook freshness" count={`(${signalTiles.length} channels)`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {signalTiles.map((s) => (
            <HealthTile
              key={s.key}
              title={s.label}
              level={s.level}
              pillLabel={levelLabel(s.level)}
              metric={formatRelative(s.latest, nowMs)}
              note={
                s.latest
                  ? `Last ${s.label.toLowerCase()} event in crm_timeline. A cold channel can mean a broken webhook.`
                  : `No ${s.label.toLowerCase()} event has ever landed in crm_timeline. Check the webhook wiring.`
              }
            />
          ))}
        </div>
      </ConsoleSection>

      {/* Suppression footprint */}
      <ConsoleSection
        title="Suppressions"
        count={`(${formatInt(suppressions.total)} rows)`}
        action={
          <StatusPill
            tone={levelTone(suppressionLevel)}
            label={suppressions.unreadable ? 'Unreadable' : formatPercent(suppressionRate)}
          />
        }
      >
        {suppressions.unreadable ? (
          <p className="text-sm text-muted-foreground">
            crm_suppressions could not be read. The opt-out footprint is unknown, so the send paths fail closed.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {formatInt(suppressedPeople)} of {formatInt(contactTotal)} contacts are blocked on at least one outbound
              channel. The send and audience paths honor these the same way.
            </p>

            {/* By channel — mobile-first row of compact stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['all', 'email', 'sms', 'call'] as const).map((channel) => (
                <div key={channel} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-xs capitalize text-muted-foreground">{channel}</div>
                  <div className="text-lg font-semibold tabular-nums text-foreground">
                    {formatInt(suppressions.byChannel[channel])}
                  </div>
                </div>
              ))}
            </div>

            {/* Top reasons */}
            {suppressions.byReason.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suppressions.byReason.slice(0, 8).map((r) => (
                  <Badge key={r.reason} variant="outline" className="font-normal">
                    <span className="capitalize">{r.reason.replace(/[-_]+/g, ' ')}</span>
                    <span className="ml-1.5 tabular-nums text-muted-foreground">{formatInt(r.count)}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </ConsoleSection>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Signals:</span> CRM_MIRROR_ENABLED env, Twilio A2P compliance
          API, crm_timeline (inbound freshness), crm_suppressions (opt-outs), crm_people (lead volume).
        </p>
        <p>
          Thresholds: inbound channels warn after 24 hours quiet, red after 72 hours. Suppression share warns above
          25%, red above 40%.
        </p>
      </div>
    </div>
  )
}

export default async function CrmHealthPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">CRM health</h1>
        <p className="text-sm text-muted-foreground">
          Live vital signs for the self-owned CRM. Mirror, outbound SMS, inbound webhooks, suppressions, and lead
          volume, each green, amber, or red at a glance.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <HealthBoard />
      </Suspense>
    </div>
  )
}
