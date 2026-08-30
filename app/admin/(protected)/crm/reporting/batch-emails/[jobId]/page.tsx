// @no-parity — internal admin surface
/**
 * One bulk send, recipient by recipient: sent, delivered, bounced, opened,
 * clicked, and whether they came to the site after the send.
 *
 * Auth lives on the protected layout. This page does not call redirect() so it
 * does not add a streamed-redirect finding.
 */
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { requireCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getBulkEmailCampaignDetail,
  type CampaignRecipient,
} from '@/lib/data/crm/getBulkEmailCampaigns'
import { formatDate, formatDateTime } from '@/lib/format/date'
import {
  Button,
  SectionHead,
  SelectField,
  StateWord,
  TextField,
  VerdictLine,
} from '@/components/admin/v2'
import { ReportingSubNav } from '../../_components/ReportingSubNav'

export const metadata = { title: 'Batch email recipients | Reporting | CRM' }
export const dynamic = 'force-dynamic'

const PAGE: CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: 16 }
const COLS =
  'minmax(150px,1.3fr) minmax(170px,1.5fr) minmax(88px,0.7fr) minmax(88px,0.7fr) minmax(88px,0.7fr) minmax(88px,0.7fr) minmax(88px,0.7fr) minmax(120px,1fr)'
const SCROLLER: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
}
const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLS,
  gap: 'var(--a-s2)',
  alignItems: 'baseline',
  padding: '10px 16px',
  borderTop: '1px solid var(--a-border)',
}
const HEAD_ROW: CSSProperties = { ...ROW, borderTop: 'none', background: 'var(--a-inset)' }
const HEAD_CELL: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
}
const MUTED: CSSProperties = { color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }
const LINK: CSSProperties = { color: 'var(--a-accent)' }
const PAGE_SIZE = 100

type Who = 'all' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'visited'

function parseWho(raw: string | undefined): Who {
  if (raw === 'delivered' || raw === 'bounced' || raw === 'opened' || raw === 'clicked' || raw === 'visited') {
    return raw
  }
  return 'all'
}

function matchesWho(r: CampaignRecipient, who: Who): boolean {
  switch (who) {
    case 'delivered':
      return Boolean(r.deliveredAt) && !r.bouncedAt
    case 'bounced':
      return Boolean(r.bouncedAt)
    case 'opened':
      return Boolean(r.openedAt)
    case 'clicked':
      return Boolean(r.clickedAt)
    case 'visited':
      return r.visitedAfterSend
    default:
      return true
  }
}

function latestLabel(r: CampaignRecipient): string {
  if (r.bouncedAt) return 'Bounced'
  if (r.unsubscribedAt) return 'Unsubscribed'
  if (r.clickedAt) return 'Clicked'
  if (r.openedAt) return 'Opened'
  if (r.deliveredAt) return 'Delivered'
  if (r.sentAt) return 'Sent'
  return r.latestEvent
}

function latestState(r: CampaignRecipient): 'ok' | 'down' | 'waiting' {
  if (r.bouncedAt) return 'down'
  if (r.clickedAt || r.openedAt || r.visitedAfterSend) return 'ok'
  return 'waiting'
}

function stamp(iso: string | null): string {
  return iso ? formatDateTime(iso) : '—'
}

export default async function BatchEmailRecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>
  searchParams: Promise<{ who?: string; q?: string; page?: string }>
}) {
  const accessRes = await requireCrmAccess()
  const { jobId: rawId } = await params
  const sp = await searchParams
  const jobId = Number(rawId)
  const who = parseWho(sp.who)
  const q = (sp.q ?? '').trim().toLowerCase()
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  if (!accessRes.ok) {
    return (
      <div className="av2-scope" style={PAGE}>
        <VerdictLine tone="attention">You do not have access to this report.</VerdictLine>
      </div>
    )
  }
  const access = accessRes.access

  if (!Number.isInteger(jobId) || jobId <= 0) {
    return (
      <div className="av2-scope" style={PAGE}>
        <ReportingSubNav active="batch-emails" />
        <VerdictLine tone="attention">That send does not exist.</VerdictLine>
      </div>
    )
  }

  const detail = await getBulkEmailCampaignDetail(jobId, scopeBroker(access))
  if (!detail) {
    return (
      <div className="av2-scope" style={PAGE}>
        <ReportingSubNav active="batch-emails" />
        <VerdictLine tone="attention">
          <b>No bulk send #{jobId}.</b>{' '}
          <Link href="/admin/crm/reporting/batch-emails" style={LINK}>
            Back to batch emails
          </Link>
        </VerdictLine>
      </div>
    )
  }
  if (detail.unreadable) {
    return (
      <div className="av2-scope" style={PAGE}>
        <ReportingSubNav active="batch-emails" />
        <VerdictLine tone="attention">
          <b>Recipient events could not be read.</b> Nothing below is a measurement.
        </VerdictLine>
      </div>
    )
  }

  const { campaign, recipients } = detail
  const filtered = recipients.filter((r) => {
    if (!matchesWho(r, who)) return false
    if (!q) return true
    const name = (r.name ?? '').toLowerCase()
    return r.email.includes(q) || name.includes(q)
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, pageCount)
  const shown = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)
  const eng = campaign.engagement

  const hrefFor = (next: { who?: Who; q?: string; page?: number }) => {
    const params = new URLSearchParams()
    const nextWho = next.who ?? who
    const nextQ = next.q ?? q
    const nextPage = next.page ?? 1
    if (nextWho !== 'all') params.set('who', nextWho)
    if (nextQ) params.set('q', nextQ)
    if (nextPage > 1) params.set('page', String(nextPage))
    const qs = params.toString()
    return qs
      ? `/admin/crm/reporting/batch-emails/${jobId}?${qs}`
      : `/admin/crm/reporting/batch-emails/${jobId}`
  }

  return (
    <div className="av2-scope" style={PAGE}>
      <ReportingSubNav active="batch-emails" />

      <p style={{ ...MUTED, margin: '0 0 8px' }}>
        <Link href="/admin/crm/reporting/batch-emails" style={LINK}>
          Batch emails
        </Link>
        {' / '}
        send #{campaign.jobId}
      </p>

      <VerdictLine tone="ok">
        <b>{campaign.subject?.trim() || 'Untitled send'}</b>
        {'. '}
        {eng.sent.toLocaleString('en-US')} sent
        {eng.delivered > 0 ? `, ${eng.delivered.toLocaleString('en-US')} delivered` : ''}
        {eng.bounced > 0 ? `, ${eng.bounced.toLocaleString('en-US')} bounced` : ''}
        {eng.opened > 0 ? `, ${eng.opened.toLocaleString('en-US')} opened` : ''}
        {eng.clicked > 0 ? `, ${eng.clicked.toLocaleString('en-US')} clicked` : ''}
        {'. '}
        {formatDate(campaign.createdAtIso)}
      </VerdictLine>

      <form method="get" action={`/admin/crm/reporting/batch-emails/${jobId}`} className="av2-rfilters">
        <div className="av2-inline-form" style={{ maxWidth: 720 }}>
          <SelectField label="Show" name="who" defaultValue={who}>
            <option value="all">Everyone ({recipients.length.toLocaleString('en-US')})</option>
            <option value="delivered">
              Delivered ({recipients.filter((r) => r.deliveredAt && !r.bouncedAt).length.toLocaleString('en-US')})
            </option>
            <option value="bounced">
              Bounced ({recipients.filter((r) => r.bouncedAt).length.toLocaleString('en-US')})
            </option>
            <option value="opened">
              Opened ({recipients.filter((r) => r.openedAt).length.toLocaleString('en-US')})
            </option>
            <option value="clicked">
              Clicked ({recipients.filter((r) => r.clickedAt).length.toLocaleString('en-US')})
            </option>
            <option value="visited">
              Visited the site after ({recipients.filter((r) => r.visitedAfterSend).length.toLocaleString('en-US')})
            </option>
          </SelectField>
          <TextField
            label="Find"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or email"
          />
          <Button type="submit">Show</Button>
        </div>
      </form>

      <SectionHead>
        {filtered.length.toLocaleString('en-US')} recipient{filtered.length === 1 ? '' : 's'}
      </SectionHead>

      {shown.length === 0 ? (
        <p style={MUTED}>No recipients match that filter.</p>
      ) : (
        <div style={SCROLLER} tabIndex={0}>
          <div style={{ minWidth: 1080 }} role="table" aria-label="Recipients for this send">
            <div style={HEAD_ROW} role="row">
              <span style={HEAD_CELL} role="columnheader">Person</span>
              <span style={HEAD_CELL} role="columnheader">Email</span>
              <span style={HEAD_CELL} role="columnheader">Status</span>
              <span style={HEAD_CELL} role="columnheader">Delivered</span>
              <span style={HEAD_CELL} role="columnheader">Opened</span>
              <span style={HEAD_CELL} role="columnheader">Clicked</span>
              <span style={HEAD_CELL} role="columnheader">Bounced</span>
              <span style={HEAD_CELL} role="columnheader">On the site after</span>
            </div>
            {shown.map((r) => (
              <div style={ROW} role="row" key={r.email}>
                <span role="cell">
                  {r.personId != null ? (
                    <Link href={`/admin/people/${r.personId}`} style={LINK}>
                      {r.name || r.email}
                    </Link>
                  ) : (
                    r.name || '—'
                  )}
                </span>
                <span role="cell" style={{ overflowWrap: 'anywhere' }}>
                  {r.email}
                </span>
                <span role="cell">
                  <StateWord state={latestState(r)}>{latestLabel(r)}</StateWord>
                </span>
                <span role="cell" style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {stamp(r.deliveredAt)}
                </span>
                <span role="cell" style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {stamp(r.openedAt)}
                </span>
                <span role="cell" style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {r.clickedAt ? (
                    r.clickUrl ? (
                      <a href={r.clickUrl} style={LINK}>
                        {stamp(r.clickedAt)}
                      </a>
                    ) : (
                      stamp(r.clickedAt)
                    )
                  ) : (
                    '—'
                  )}
                </span>
                <span role="cell" style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {stamp(r.bouncedAt)}
                </span>
                <span role="cell" style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {r.visitedAfterSend ? stamp(r.lastSiteAt) : r.lastSiteAt ? 'Earlier visit' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pageCount > 1 ? (
        <p style={{ ...MUTED, marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {pageSafe > 1 ? (
            <Link href={hrefFor({ page: pageSafe - 1 })} style={LINK}>
              Previous
            </Link>
          ) : null}
          <span>
            Page {pageSafe.toLocaleString('en-US')} of {pageCount.toLocaleString('en-US')}
          </span>
          {pageSafe < pageCount ? (
            <Link href={hrefFor({ page: pageSafe + 1 })} style={LINK}>
              Next
            </Link>
          ) : null}
        </p>
      ) : null}

      <p style={{ ...MUTED, marginTop: 12 }}>
        Opens and clicks come from the tracking pixel and wrapped links in the email. Delivered and
        bounced come from the sending provider. Site visits are sessions stitched to that contact
        after the send.
      </p>
    </div>
  )
}
