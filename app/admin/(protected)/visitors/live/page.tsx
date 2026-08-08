// @no-parity — internal admin surface, no public mockup contract
//
// Live visitors — 11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Server component. `dynamic = 'force-dynamic'` + `revalidate = 0`, so it
// refetches on every navigation. Data: visitor_sessions + visitor_events,
// populated by /api/visitors/track and the WordPress snippet at
// docs/wordpress-fub-identify-snippet.html.
//
// Carried over verbatim: both exports above, normalizeParams, the `?filter=`
// param and its three values with `all` as the fallback for anything else,
// fetchLiveVisitors({ identifiedFilter, limit: 50 }) and fetchLiveSummary()
// unchanged (no window, cap, paging bound or count moved), both Suspense
// boundaries, formatRelative / scoreLabel / formatSource / formatGeo /
// shortSession byte-for-byte, the /admin/visitors/<encodeURIComponent(id)>
// and /admin/people/<crm_person_id ?? fub_person_id> hrefs, and the plain
// <a> (not <Link>) on the contact href so its navigation behaviour is
// untouched.
//
// Shape changed, data did not: the page's own <main> and <h1> are gone
// (ConsoleShell owns the landmark; acceptance-bar rule 1 — the nav names the
// page), the four shadcn stat cards became the family's typographic numbers
// strip with the same four figures, the three tab links became ONE dropdown
// with the same three hrefs (rule 2 — see VisitorFilterSelect), and the
// md:hidden card list plus the hidden md:block shadcn Table — which wrote the
// same eight fields twice — became one ReportGrid whose sideways overflow
// lives in its own scroll box.
//
// TWO CLAIMS WERE FALSE AND ARE NOW FIXED:
//   1. The file header used to say "the LiveTable child component polls every
//      15s". No LiveTable component exists anywhere in the repo, and the page's
//      own footnote says it revalidates on navigation. Cut.
//   2. The footnote used to say "Hot scores fire a 5-minute FUB call task
//      automatically (cron-driven)". Follow Up Boss was decommissioned
//      2026-06-24. /api/cron/visitor-hot-lead-escalation (every 15 min in
//      vercel.json) calls createNativeTask with dueInMinutes: 5 against
//      crm_tasks for an identified session, and emails the alert for every hot
//      session identified or not. The footnote now says that.
//
// RULE 6 (a wall of identical states is a STOP) — probed 2026-08-07 before
// shipping: visitor_sessions holds 60,473 rows, 59,023 of them scoring under
// 20. The near-wall of "cold" is real, not a broken read. 60,469 rows carry
// source_domain ryan-realty.com and 4 carry ryanrealty.vercel.app, so the
// two-domain sentence below is true. Only 18 sessions have ever identified,
// which is why the Identified filter returns a short list.
import { Suspense } from 'react'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import {
  ReportGrid,
  ReportNumbers,
  ReportSkeleton,
  SectionHead,
  StateWord,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { fetchLiveVisitors, fetchLiveSummary, type LiveSessionRow } from '../_lib/queries'
import VisitorFilterSelect from '../VisitorFilterSelect'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function scoreLabel(score: number): string {
  if (score >= 100) return 'hot'
  if (score >= 50) return 'warm'
  if (score >= 20) return 'engaged'
  return 'cold'
}

/** Hot and warm keep the two lit states the shadcn badge variants gave them;
 *  engaged and cold stay quiet text. The words are unchanged. */
function ScoreCell({ score }: { score: number }) {
  const text = `${score} · ${scoreLabel(score)}`
  if (score >= 100) return <StateWord state="down">{text}</StateWord>
  if (score >= 50) return <StateWord state="accent">{text}</StateWord>
  return <span style={{ color: 'var(--a-text-2)' }}>{text}</span>
}

function formatSource(s: Pick<LiveSessionRow, 'utm_source' | 'utm_medium'>): string {
  if (!s.utm_source) return 'direct'
  if (s.utm_medium && s.utm_medium !== 'none') return `${s.utm_source} / ${s.utm_medium}`
  return s.utm_source
}

function formatGeo(s: Pick<LiveSessionRow, 'ip_city' | 'ip_region' | 'ip_country'>): string {
  const parts: string[] = []
  if (s.ip_city) parts.push(s.ip_city)
  if (s.ip_region && s.ip_region !== s.ip_city) parts.push(s.ip_region)
  if (s.ip_country && parts.length === 0) parts.push(s.ip_country)
  return parts.join(', ') || '—'
}

function shortSession(id: string): string {
  return id.slice(0, 8)
}

const COLUMNS: ReportColumn[] = [
  { key: 'session', label: 'Session' },
  { key: 'source', label: 'Source' },
  { key: 'geo', label: 'Geo' },
  { key: 'score', label: 'Score', numeric: true },
  { key: 'intent', label: 'Intent' },
  { key: 'events', label: 'Events', numeric: true },
  { key: 'identified', label: 'Identified' },
  { key: 'seen', label: 'Last seen' },
]

async function SummaryStrip() {
  const summary = await fetchLiveSummary()
  return (
    <>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={summary.hotLeadsToday > 0 ? 'attention' : 'ok'}>
          <b>
            {summary.totalToday} {summary.totalToday === 1 ? 'session' : 'sessions'} today.
          </b>{' '}
          {summary.totalActive} active in the last five minutes · {summary.identifiedToday}{' '}
          identified · {summary.hotLeadsToday} hot.
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'active', label: 'Active now (5m)', value: String(summary.totalActive) },
          { key: 'today', label: 'Sessions today', value: String(summary.totalToday) },
          { key: 'identified', label: 'Identified today', value: String(summary.identifiedToday) },
          { key: 'hot', label: 'Hot leads today', value: String(summary.hotLeadsToday) },
        ]}
      />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
        {summary.totalToday > 0
          ? `${Math.round((summary.identifiedToday / summary.totalToday) * 100)}% of sessions identified`
          : 'No sessions today yet'}
        {summary.topSource ? ` · Top source: ${summary.topSource} (${summary.topSourceCount})` : ''}
      </p>
    </>
  )
}

async function VisitorTable({ filter }: { filter: 'all' | 'anonymous' | 'identified' }) {
  const rows = await fetchLiveVisitors({ identifiedFilter: filter, limit: 50 })

  const gridRows: ReportGridRow[] = rows.map((s) => {
    const contactId = s.crm_person_id ?? s.fub_person_id
    return {
      key: s.session_id,
      cells: [
        <Link
          key="session"
          href={`/admin/visitors/${encodeURIComponent(s.session_id)}`}
          title={s.session_id}
          style={{ color: 'var(--a-accent)', fontFamily: 'var(--a-font-mono)' }}
        >
          {shortSession(s.session_id)}{' '}
          <span style={{ fontFamily: 'var(--a-font)', color: 'var(--a-text-2)', fontWeight: 400 }}>
            {s.source_domain}
          </span>
        </Link>,
        s.utm_campaign ? `${formatSource(s)} (${s.utm_campaign})` : formatSource(s),
        formatGeo(s),
        <ScoreCell key="score" score={s.engagement_score} />,
        s.intent_tags.length === 0 ? '—' : s.intent_tags.map((t) => t.replace(/_/g, ' ')).join(' · '),
        s.event_count,
        contactId ? (
          <span key="identified">
            <a href={`/admin/people/${contactId}`} style={{ color: 'var(--a-accent)' }}>
              {s.identified_email ?? `Contact #${contactId}`}
            </a>
            {s.identified_via ? ` · via ${s.identified_via}` : ''}
          </span>
        ) : (
          'anonymous'
        ),
        formatRelative(s.last_seen_at),
      ],
    }
  })

  return (
    <ReportGrid
      label="Live visitor sessions"
      columns={COLUMNS}
      template="minmax(150px, 1.3fr) minmax(120px, 1.1fr) minmax(110px, 1fr) minmax(96px, 0.8fr) minmax(120px, 1.1fr) minmax(64px, 0.5fr) minmax(140px, 1.2fr) minmax(84px, 0.7fr)"
      minWidth={980}
      rows={gridRows}
      empty={
        <>
          No matching sessions yet. Once the WordPress snippet starts firing tracked events,
          sessions appear here on the next reload.
        </>
      }
    />
  )
}

export default async function LiveVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // CAPABILITY GUARD — see the [sessionId] sibling for the reasoning. Neither
  // page in this family ran any auth of its own.
  await requireAdminPage('people.view')
  const sp = normalizeParams(await searchParams)
  const filter = (sp.filter === 'anonymous' || sp.filter === 'identified') ? sp.filter : 'all'

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <Suspense fallback={<ReportSkeleton rows={3} />}>
        <SummaryStrip />
      </Suspense>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
        Up to 50 sessions, most recently active first, across ryan-realty.com and
        ryanrealty.vercel.app. A database trigger rescores a session on every event it records.
        Open a session id for its full event timeline.
      </p>

      <div style={{ maxWidth: 240, margin: '0 0 4px' }}>
        <VisitorFilterSelect filter={filter} />
      </div>

      <SectionHead>Sessions</SectionHead>
      <Suspense fallback={<ReportSkeleton />}>
        <VisitorTable filter={filter} />
      </Suspense>

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        The page revalidates on every navigation — reload to refresh. Score legend: cold under 20,
        engaged 20–49, warm 50–99, hot 100 and up. A session at 100 or more is picked up by the
        hot-lead escalation cron, which runs every 15 minutes: it opens a five-minute call task on
        the contact in the CRM when the session is identified, and emails the alert either way.
        Follow Up Boss was decommissioned 2026-06-24, so nothing is sent there. &ldquo;Today&rdquo;
        counts from midnight UTC — that is the window the query uses, not midnight Pacific.
      </p>
    </div>
  )
}
