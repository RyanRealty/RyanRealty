// @no-parity — internal admin surface, no public mockup contract
//
// One visitor session — 11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// The full browsing path for one visitor: every page view, listing view,
// scroll-depth signal and identification event in chronological order, with
// the score delta per event.
//
// Carried over verbatim: `dynamic = 'force-dynamic'` + `revalidate = 0`, the
// awaited `params` promise, getServiceSupabase() and the service-role
// visitor_sessions read by session_id with its notFound() on a miss,
// fetchSessionEvents(sessionId, 500) — the cap is unchanged — fmtDateTime and
// fmtRelative and shortenUrl byte-for-byte, the minutesActive arithmetic
// (Math.max(1, round((last_seen − first_seen) / 60000))), every field in the
// identity block including its `|| '-'` fallbacks, the
// /admin/people/<crm_person_id ?? fub_person_id> href on a plain <a> (not
// <Link>, so its navigation behaviour is untouched), and the
// /admin/visitors/live back href.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell
// owns the landmark), the raw <h1> "Visitor session" became EntityTitle
// carrying the session id — this IS an entity page, and the id was already
// printed directly under that heading — the four shadcn stat cards became the
// family's numbers strip with the same five figures (score, peak, minutes
// active, events, backfilled), and the md:hidden EventCard list plus the
// hidden md:block shadcn Table, which wrote the same seven fields twice,
// became one ReportGrid whose sideways overflow lives in its own scroll box.
//
// DROPPED, because it rendered nowhere: `eventsWithRunning` rolled a running
// score forward per event under the comment "so we can show the trajectory",
// and neither EventCard nor EventRow ever read `.running`. It was a
// computation with no output.
//
// ONE LABEL NOW MATCHES ITS QUERY. The last column read "FUB" with cells
// "FUB synced" / "local", off visitor_events.pushed_to_fub_at. Nothing is
// pushed to Follow Up Boss — it was decommissioned 2026-06-24 and
// lib/visitor-backfill.ts says in its own header that the per-event FUB replay
// was deleted as a dead no-op. The column is now an idempotency cursor: it is
// stamped when a session identifies and its prior events are rolled up to the
// contact. The header is "Attached" and the footnote says what it means. The
// value read is unchanged.
//
// FORMATTERS. The listing label built its price with a bare
// `listing_price.toLocaleString()`, which resolves the runtime locale and so
// can differ between server and browser. It is now formatPriceExact from
// lib/format/money — verified byte-identical on $350,000 · $550,000 ·
// $965,000 · $1,295,000 · $259,900 · $949,808 · $399,995 · $1,275,000.
// formatPrice (no Exact) was NOT used: it rounds to the nearest $1,000 and
// would print $949,808 as $950,000. fmtDateTime already pins both en-US and
// America/Los_Angeles, so it is untouched.
//
// RULE 6 (a wall of identical states is a STOP) — probed 2026-08-07 before
// shipping: visitor_events holds 107,966 rows; 106,006 have a null
// pushed_to_fub_at, so a mostly-"—" Attached column is real, matching the 18
// sessions that have ever identified. listing_price is null on all 107,966
// rows and listing_city on all of them, so the listing label renders MLS-only
// today (530 rows carry a listing_mls).
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { formatPriceExact } from '@/lib/format/money'
import {
  EntityTitle,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { fetchSessionEvents, type SessionEvent } from '../_lib/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

type SessionDetail = {
  session_id: string
  source_domain: string
  first_seen_at: string
  last_seen_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
  landing_page: string | null
  user_agent: string | null
  ip_country: string | null
  ip_region: string | null
  ip_city: string | null
  identified_at: string | null
  fub_person_id: number | null
  crm_person_id: number | null
  identified_email: string | null
  identified_via: string | null
  engagement_score: number
  peak_score: number
  intent_tags: string[]
  hot_lead_fired_at: string | null
  events_backfilled_count: number
}

async function fetchSession(sessionId: string): Promise<SessionDetail | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as SessionDetail
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function shortenUrl(url: string): string {
  try { return new URL(url).pathname + new URL(url).search } catch { return url.slice(0, 80) }
}

function listingLabelFor(ev: SessionEvent): string | null {
  return ev.listing_mls
    ? `MLS ${ev.listing_mls}${ev.listing_city ? ` · ${ev.listing_city}` : ''}${ev.listing_price ? ` · ${formatPriceExact(ev.listing_price)}` : ''}`
    : null
}

const COLUMNS: ReportColumn[] = [
  { key: 'time', label: 'Time (PT)' },
  { key: 'event', label: 'Event' },
  { key: 'category', label: 'Category' },
  { key: 'page', label: 'Page' },
  { key: 'scroll', label: 'Scroll', numeric: true },
  { key: 'delta', label: 'Score Δ', numeric: true },
  { key: 'attached', label: 'Attached' },
]

const FIELD_LABEL = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
} as const
const FIELD_VALUE = { fontSize: 'var(--a-text-sm)', margin: 0 } as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={FIELD_LABEL}>{label}</dt>
      <dd style={FIELD_VALUE}>{children}</dd>
    </div>
  )
}

export default async function VisitorSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const session = await fetchSession(sessionId)
  if (!session) notFound()
  const events = await fetchSessionEvents(sessionId, 500)

  const minutesActive = Math.max(1, Math.round((new Date(session.last_seen_at).getTime() - new Date(session.first_seen_at).getTime()) / 60000))
  const contactId = session.crm_person_id ?? session.fub_person_id

  const gridRows: ReportGridRow[] = events.map((ev) => {
    const listingLabel = listingLabelFor(ev)
    return {
      key: String(ev.id),
      cells: [
        fmtDateTime(ev.event_at),
        ev.event_type.replace(/_/g, ' '),
        ev.page_category ?? '-',
        <span key="page" style={{ fontFamily: 'var(--a-font-mono)', overflowWrap: 'anywhere' }}>
          {shortenUrl(ev.page_url)}
          {listingLabel ? (
            <span style={{ fontFamily: 'var(--a-font)', color: 'var(--a-text-2)' }}>
              {' '}
              {listingLabel}
            </span>
          ) : null}
        </span>,
        ev.scroll_depth_pct != null ? `${ev.scroll_depth_pct}%` : '-',
        ev.score_delta > 0 ? `+${ev.score_delta}` : String(ev.score_delta),
        ev.pushed_to_fub_at ? (
          <StateWord key="attached" state="ok">
            Attached
          </StateWord>
        ) : (
          '—'
        ),
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 12px' }}>
        <Link
          href="/admin/visitors/live"
          style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-sm)' }}
        >
          &larr; Back to live visitors
        </Link>
      </p>

      <EntityTitle>
        <span
          style={{
            fontFamily: 'var(--a-font-mono)',
            fontSize: 'var(--a-text-md)',
            overflowWrap: 'anywhere',
          }}
        >
          {session.session_id}
        </span>
      </EntityTitle>

      <div style={{ margin: '10px 0 14px' }}>
        <VerdictLine tone={session.hot_lead_fired_at ? 'attention' : 'ok'}>
          <b>{session.identified_at ? 'Identified.' : 'Anonymous.'}</b> Score{' '}
          {session.engagement_score}, peak {session.peak_score}, last seen{' '}
          {fmtRelative(session.last_seen_at)}.
          {session.hot_lead_fired_at ? ' Hot lead fired.' : ''}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'score', label: 'Engagement score', value: String(session.engagement_score) },
          { key: 'peak', label: 'Peak score', value: String(session.peak_score) },
          { key: 'active', label: 'Active for', value: `${minutesActive}m` },
          { key: 'events', label: 'Events', value: String(events.length) },
          {
            key: 'backfilled',
            label: 'Backfilled',
            value: String(session.events_backfilled_count),
          },
        ]}
      />

      <SectionHead>Identity &amp; attribution</SectionHead>
      <dl className="av2-editgrid" style={{ margin: '0 0 8px' }}>
        <Field label="Source">{session.utm_source || 'direct'}</Field>
        <Field label="Medium">{session.utm_medium || '-'}</Field>
        <Field label="Campaign">{session.utm_campaign || '-'}</Field>
        <Field label="Content">{session.utm_content || '-'}</Field>
        <Field label="Landing page">
          <span style={{ fontFamily: 'var(--a-font-mono)', overflowWrap: 'anywhere' }}>
            {session.landing_page || '-'}
          </span>
        </Field>
        <Field label="Referrer">
          <span style={{ fontFamily: 'var(--a-font-mono)', overflowWrap: 'anywhere' }}>
            {session.referrer || '-'}
          </span>
        </Field>
        <Field label="Geo">
          {[session.ip_city, session.ip_region, session.ip_country].filter(Boolean).join(', ') || '-'}
        </Field>
        <Field label="Source domain">{session.source_domain}</Field>
        <Field label="First seen">{fmtDateTime(session.first_seen_at)}</Field>
        <Field label="Last seen">{fmtDateTime(session.last_seen_at)}</Field>
        {session.identified_at ? (
          <>
            <Field label="Identified at">{fmtDateTime(session.identified_at)}</Field>
            <Field label="Identified via">{session.identified_via || '-'}</Field>
            <Field label="CRM contact">
              {contactId ? (
                <a href={`/admin/people/${contactId}`} style={{ color: 'var(--a-accent)' }}>
                  {session.identified_email ?? `Contact #${contactId}`}
                </a>
              ) : (
                '-'
              )}
            </Field>
          </>
        ) : null}
      </dl>
      {session.intent_tags.length > 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
          Intent tags: {session.intent_tags.map((t) => t.replace(/_/g, ' ')).join(' · ')}
        </p>
      ) : null}

      <SectionHead>Event timeline ({events.length})</SectionHead>
      <ReportGrid
        label="Session event timeline"
        columns={COLUMNS}
        template="minmax(140px, 1.1fr) minmax(104px, 0.9fr) minmax(96px, 0.8fr) minmax(200px, 2fr) minmax(64px, 0.5fr) minmax(64px, 0.5fr) minmax(88px, 0.7fr)"
        minWidth={960}
        rows={gridRows}
        empty={<>No events recorded for this session.</>}
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Oldest event first, capped at 500. Attached marks an event that was rolled up to the
        contact when this session identified — it reads visitor_events.pushed_to_fub_at, a column
        named for the Follow Up Boss push that was retired with FUB on 2026-06-24. Nothing is sent
        to FUB.
      </p>
    </div>
  )
}
