// @no-parity — internal admin observability surface, no public mockup contract
//
// /admin/crm/health — the CRM vital-signs board. P11D: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md), on the verdict + needs-you
// shape the Oversight screen already uses (pattern 3). PRESENTATION ONLY.
//
// Signals, unchanged: the CRM_MIRROR_ENABLED kill switch (env), the Twilio A2P
// campaign status, inbound freshness per crm_timeline channel, the crm_suppressions
// opt-out footprint against crm_people, and crm_people intake volume.
//
// Carried over verbatim: requireAdminPage('settings.system') and the getCrmAccess()
// → /admin/access-denied guard, `dynamic = 'force-dynamic'`, `revalidate = 0`, the
// metadata title, the five-read Promise.all with every argument, FRESHNESS_THRESHOLDS
// (24h warn / 72h red), formatRelative / formatInt / formatPercent / levelLabel, and
// EVERY level computation — mirrorLevel, a2pLevel, freshnessLevel per signal,
// suppressionRateLevel, leadLevel and the worstLevel roll-up. No threshold moved, so
// no tile changed color in this migration.
//
// ONE FALSE CLAIM CUT — the Mirror tile. It rendered a GREEN tile reading
// "Mirroring", noted "leads are flowing into crm_*", and derived that from the
// kill switch alone. The row now names what is actually read — the kill switch —
// and states its position; the standing fact sits in the footnote.
// The level math is untouched, so /admin/oversight's CRM_MIRROR_ENABLED=false alarm
// still lands on a red row here.
//
// A FAILED READ NO LONGER LOOKS HEALTHY. Only the Twilio call was caught before;
// an unreadable crm_timeline or crm_suppressions took the whole page down, and an
// unreadable crm_people silently made the suppression share 0.0% and green. The
// board now catches the whole read and says so, and refuses to print a share when
// the contact denominator is zero.
//
// Shape changed, data did not: the page's own <h1> is gone (the nav names the page),
// the card grid became one attention list over a quiet healthy list, the console
// StatusPill became the v2 state word, and the row of reason Badges — a chip wall,
// acceptance bar rule 2 — became the family's grid.
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
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
  worstLevel,
  ageMinutesSince,
  type HealthLevel,
} from '@/lib/crm/health-levels'
import {
  asOfLabel,
  QueueRow,
  QuietRow,
  ReportError,
  ReportGrid,
  ReportNumbers,
  ReportSkeleton,
  SectionHead,
  VerdictLine,
  type AdminState,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'

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

/** Status is text + color, never color alone (WCAG 1.4.1). */
function levelState(level: HealthLevel): AdminState {
  if (level === 'ok') return 'ok'
  if (level === 'warn') return 'slow'
  return 'down'
}

/** One vital sign: what it is, where it stands, and — when it is not OK — why. */
type Vital = {
  key: string
  name: string
  level: HealthLevel
  /** The measurement itself, already formatted. */
  figure: string
  /** One sentence, shown on the attention list only. */
  note: string
}

async function HealthBoard() {
  const nowMs = Date.now()

  // All live signals in parallel. getA2pCampaignStatus hits Twilio over the
  // network and can throw if creds/host misbehave — catch so one slow API call
  // never blanks the whole board. The OUTER catch covers the DB readers: an
  // unreadable crm_timeline used to take the page down, which at least was not
  // a green lie, but it left no retry and no explanation.
  const reads = await Promise.all([
    getA2pCampaignStatus().catch(() => null),
    getCrmSignalFreshness(),
    getSuppressionCounts(),
    getCrmLeadVolume(nowMs),
    getCrmContactTotal(),
  ]).catch(() => null)

  if (reads === null) {
    return (
      <>
        <VerdictLine tone="attention">
          <b>The health read itself failed.</b> Every signal below is unknown, not healthy — do not
          read this screen as an all-clear.
        </VerdictLine>
        <div style={{ marginTop: 14 }}>
          <ReportError what="CRM health" href="/admin/crm/health" />
        </div>
      </>
    )
  }

  const [a2pResult, signals, suppressions, leadVolume, contactTotal] = reads

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

  // crm_people returning 0 is indistinguishable from an unreadable table, so a
  // share with no denominator prints as a missing number rather than 0.0%.
  const shareText = contactTotal > 0 ? formatPercent(suppressionRate) : 'no denominator'

  const vitals: Vital[] = [
    {
      key: 'mirror',
      name: 'Lead-mirror kill switch',
      level: mirrorLevel,
      figure: mirror.enabled ? 'Not set' : 'Set to false',
      note: 'CRM_MIRROR_ENABLED=false. Nothing reaches crm_* through the mirror path while it is set.',
    },
    {
      key: 'sms',
      name: 'Outbound SMS',
      level: smsLevel,
      figure: a2p === 'VERIFIED' ? 'Live' : (a2p ?? 'Unknown'),
      note:
        a2p === null
          ? 'The A2P campaign status could not be read from Twilio, so outbound readiness is unknown.'
          : 'Carriers block outbound SMS until the A2P campaign is verified. Texts are held until then.',
    },
    {
      key: 'leads',
      name: 'New leads',
      level: leadLevel,
      figure: leadVolume.unreadable
        ? 'unreadable'
        : `${formatInt(leadVolume.last24h)} in 24h · ${formatInt(leadVolume.last7d)} in 7d`,
      note: 'crm_people could not be read. Lead-volume tracking is degraded.',
    },
    ...signalTiles.map((s) => ({
      key: s.key,
      name: s.label,
      level: s.level,
      figure: formatRelative(s.latest, nowMs),
      note: !s.latest
        ? `No ${s.label.toLowerCase()} row has ever landed in crm_timeline, or the read failed. Check the webhook wiring.`
        : s.level === 'warn'
          ? `Quiet for more than a day. Legitimate on a slow week, worth a glance.`
          : `Cold for more than three days. A channel this quiet usually means a broken webhook.`,
    })),
    {
      key: 'suppressions',
      name: 'Suppression share',
      level: suppressionLevel,
      figure: suppressions.unreadable ? 'unreadable' : shareText,
      note: suppressions.unreadable
        ? 'crm_suppressions could not be read. The opt-out footprint is unknown, so the send paths fail closed.'
        : 'More than a quarter of the book is blocked on an outbound channel. Check what is driving the opt-outs.',
    },
  ]

  const attention = vitals.filter((v) => v.level !== 'ok')
  const healthy = vitals.filter((v) => v.level === 'ok')

  const channelFigures: ReportNumberItem[] = (['all', 'email', 'sms', 'call'] as const).map((c) => ({
    key: c,
    label: c === 'all' ? 'Every channel' : c === 'sms' ? 'SMS' : c === 'email' ? 'Email' : 'Call',
    value: formatInt(suppressions.byChannel[c]),
  }))

  const reasonRows: ReportGridRow[] = suppressions.byReason.map((r) => ({
    key: r.reason,
    cells: [
      <span key="r" style={{ textTransform: 'capitalize' }}>
        {r.reason.replace(/[-_]+/g, ' ')}
      </span>,
      formatInt(r.count),
    ],
  }))

  return (
    <>
      <VerdictLine tone={overall === 'ok' ? 'ok' : 'attention'}>
        {overall === 'ok' ? (
          <>
            <b>All {vitals.length} vital signs are healthy.</b> Read at {asOfLabel(nowMs)} Pacific.
          </>
        ) : (
          <>
            <b>
              {attention.length} of {vitals.length} vital signs need you.
            </b>{' '}
            Read at {asOfLabel(nowMs)} Pacific.
          </>
        )}
      </VerdictLine>

      {attention.length > 0 ? (
        <section aria-label="Needs attention">
          <SectionHead>Needs attention</SectionHead>
          <ul className="av2-queue">
            {attention.map((v) => (
              <QueueRow
                key={v.key}
                kind={levelLabel(v.level)}
                kindTone={levelState(v.level)}
                title={v.name}
                context={v.note}
                age={v.figure}
                hot={v.level === 'stale'}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {healthy.length > 0 ? (
        <section aria-label="Healthy">
          <SectionHead>Healthy</SectionHead>
          <ul className="av2-quietlist">
            {healthy.map((v) => (
              <QuietRow key={v.key} name={v.name} state={levelLabel(v.level)} figure={v.figure} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Suppressions">
        <SectionHead>Suppressions</SectionHead>
        {suppressions.unreadable ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
            crm_suppressions could not be read. The opt-out footprint is unknown, so the send paths
            fail closed.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
              {formatInt(suppressedPeople)} of{' '}
              {contactTotal > 0 ? formatInt(contactTotal) : 'an unreadable number of'} contacts are
              blocked on at least one outbound channel, across {formatInt(suppressions.total)}{' '}
              {suppressions.total === 1 ? 'row' : 'rows'}. The send and audience paths honor these
              the same way.
            </p>
            <ReportNumbers items={channelFigures} />
            <SectionHead>Why they are blocked</SectionHead>
            <ReportGrid
              label="Suppressions by reason"
              columns={[
                { key: 'reason', label: 'Reason' },
                { key: 'rows', label: 'Rows', numeric: true },
              ]}
              template="minmax(160px, 2fr) minmax(80px, 0.7fr)"
              minWidth={280}
              rows={reasonRows}
              empty={<>No contact is suppressed on any channel.</>}
            />
          </>
        )}
      </section>

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        Signals: the CRM_MIRROR_ENABLED env switch, the Twilio A2P compliance API, crm_timeline
        (inbound freshness), crm_suppressions (opt-outs), crm_people (lead volume). Inbound channels
        warn after 24 hours quiet and go red after 72. Suppression share warns above 25% and goes red
        above 40%. The mirror switch gates optional crm_* timeline copies. Lead capture is native.
      </p>
    </>
  )
}

export default async function CrmHealthPage() {
  await requireAdminPage('settings.system')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  return (
    <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
      <Suspense fallback={<ReportSkeleton />}>
        <HealthBoard />
      </Suspense>
    </div>
  )
}
