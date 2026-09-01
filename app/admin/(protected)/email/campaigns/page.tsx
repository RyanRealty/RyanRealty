// @no-parity — admin-internal email surface, no public mockup contract.
//
// /admin/email/campaigns — P11E: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the family's shared presentation
// kit (@/components/admin/v2). PRESENTATION ONLY.
//
// This is a send-adjacent surface (CLAUDE.md §1 class 1). It sends nothing and
// still sends nothing: there is no send call, no recipient resolution, no
// approval gate and no suppression check on this file, before or after.
//
// Carried over verbatim: the requireAdminPage('content.marketing') guard, the
// getSession() → /admin/login?next=%2Fadmin%2Femail%2Fcampaigns redirect, the
// getAdminRoleForEmail() → /admin/access-denied redirect, getEmailCampaigns(50),
// the messageIds filter, getCampaignEngagement(messageIds),
// getEmailEngagementSummary({ sendType: 'campaign' }), the CampaignViewRow
// mapping (including `c.messageId ? engagementMap.get(c.messageId) ?? null :
// null`), the tracked/untracked rule behind "No engagement yet" (never a fake
// 0%), formatRate for both rates, formatDate for the Date column, the 12-row
// display cap and its "Showing N of M." line, `dynamic = 'force-dynamic'`, the
// page metadata, and both hrefs (/admin/reports/emails · /admin/email/compose).
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1> is gone (the nav names this page), the KPI tile board
// became the family's typographic numbers strip carrying the same four figures
// formatted the same way, and the shadcn table + mobile-card pair became the
// family's ONE grid (which carries its own phone shape).
//
// A FAILED READ NOW SAYS SO. The KPI strip previously rendered
// `summary.delivered` and both rates whether or not the engagement read
// succeeded, so an unreadable email_events table looked identical to a quiet
// week. Both failure flags now surface (§0: a failed read must not look like a
// measurement). No figure moved — the same values render on the success path.
//
// NO DOOR ON THE SUBJECT. The acceptance bar wants an artifact's name to link
// to the artifact, and /admin/reports/emails does accept a free-text `q`. It is
// not wired here because it cannot be proven to land on the campaign's sends:
// email_events holds zero rows with send_type='campaign' today, so the door
// could not be tested end to end. An unproven door is the same defect class as
// an unproven claim.
import type { Metadata } from 'next'
import { requireAdminPage } from '@/lib/admin/require-admin'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { formatDate } from '@/lib/format/date'
import {
  ReportError,
  ReportGrid,
  SectionHead,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import {
  getEmailCampaigns,
  getCampaignEngagement,
  getEmailEngagementSummary,
  formatRate,
  type CampaignEngagement,
} from '@/lib/data/crm/getEmailReporting'

export const metadata: Metadata = {
  title: 'Email campaigns',
  description: 'Sent email campaigns with real engagement from the email-events store.',
}

export const dynamic = 'force-dynamic'

/** A campaign row joined to its real engagement (computed on read). */
type CampaignViewRow = {
  id: string
  templateType: string | null
  subject: string | null
  sentCount: number
  sentAtIso: string | null
  engagement: CampaignEngagement | null
}

/** Rows shown before the "Showing N of M." line — the legacy table's cap, carried over. */
const ROW_CAP = 12

export default async function AdminEmailCampaignsPage() {
  await requireAdminPage('content.marketing')
  const session = await getSession()
  if (!session?.user) redirect('/admin/login?next=%2Fadmin%2Femail%2Fcampaigns')
  const role = await getAdminRoleForEmail(session.user.email)
  if (!role) redirect('/admin/access-denied')

  const { rows: campaigns, unreadable } = await getEmailCampaigns(50)

  // Real engagement, joined by message id (email_campaigns.fub_campaign_id ==
  // email_events.message_id). The stored open_count/click_count columns are never
  // updated by the webhook, so they are ignored — this is the truth from events.
  const messageIds = campaigns.map((c) => c.messageId).filter((m): m is string => !!m)
  const engagementMap = await getCampaignEngagement(messageIds)

  // Brokerage-wide campaign engagement for the numbers strip — all campaign sends.
  const summary = await getEmailEngagementSummary({ sendType: 'campaign' })

  const rows: CampaignViewRow[] = campaigns.map((c) => ({
    id: c.id,
    templateType: c.templateType,
    subject: c.subject,
    sentCount: c.sentCount,
    sentAtIso: c.sentAtIso,
    engagement: c.messageId ? engagementMap.get(c.messageId) ?? null : null,
  }))

  // A campaign has trackable engagement when it carries a message id AND events
  // were found for it. Otherwise it reads "no engagement yet" — never a fake 0%.
  function engagementCell(e: CampaignEngagement | null): React.ReactNode {
    if (!e || !e.tracked) {
      return <span style={{ color: 'var(--a-text-2)' }}>No engagement yet</span>
    }
    return (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {e.opened.toLocaleString('en-US')} opens · {e.clicked.toLocaleString('en-US')} clicks
      </span>
    )
  }

  function rateCell(e: CampaignEngagement | null): React.ReactNode {
    if (!e || !e.tracked) return <span style={{ color: 'var(--a-text-2)' }}>—</span>
    return formatRate(e.openRate)
  }

  const trackedCount = rows.filter((r) => r.engagement?.tracked).length
  const retryHref = `/admin/email/campaigns?t=${Date.now()}`

  const columns: ReportColumn[] = [
    { key: 'subject', label: 'Subject' },
    { key: 'type', label: 'Type' },
    { key: 'sent', label: 'Sent', numeric: true },
    { key: 'engagement', label: 'Engagement' },
    { key: 'openrate', label: 'Open rate', numeric: true },
    { key: 'date', label: 'Date', numeric: true },
  ]

  const shown = rows.slice(0, ROW_CAP)
  const gridRows: ReportGridRow[] = shown.map((c) => ({
    key: c.id,
    cells: [
      c.subject ?? '—',
      c.templateType ?? '—',
      c.sentCount.toLocaleString('en-US'),
      engagementCell(c.engagement),
      rateCell(c.engagement),
      c.sentAtIso ? formatDate(c.sentAtIso) : '—',
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 896, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={unreadable ? 'attention' : 'ok'}>
          {unreadable ? (
            <>
              <b>The campaigns table could not be read.</b> Nothing below is a measurement.
            </>
          ) : rows.length === 0 && summary.delivered > 0 ? (
            <>
              <b>The campaigns table holds no rows, but the event store holds{' '}
              {summary.delivered.toLocaleString('en-US')} delivered campaign sends.</b>{' '}
              The two stores disagree — treat the strip below as event-store truth, not a
              campaign list.{' '}
              <Link href="/admin/reports/emails" style={{ color: 'var(--a-accent)' }}>
                Email performance lives under Reports
              </Link>
              .
            </>
          ) : rows.length === 0 ? (
            <>
              <b>No campaign has been sent yet.</b>{' '}
              <Link href="/admin/reports/emails" style={{ color: 'var(--a-accent)' }}>
                Email performance lives under Reports
              </Link>
              .
            </>
          ) : (
            <>
              <b>
                The {rows.length.toLocaleString('en-US')} newest{' '}
                {rows.length === 1 ? 'campaign' : 'campaigns'}.
              </b>{' '}
              {trackedCount.toLocaleString('en-US')} of them carry engagement events.
            </>
          )}
        </VerdictLine>
      </div>

      {unreadable ? <ReportError what="Campaigns" href={retryHref} /> : null}
      {summary.unreadable ? <ReportError what="Campaign engagement" href={retryHref} /> : null}

      <div className="av2-wordrow" style={{ margin: '0 0 18px' }}>
        <Link href="/admin/email/compose" className="av2-btn" style={{ textDecoration: 'none' }}>
          Compose
        </Link>
        <Link
          href="/admin/reports/emails"
          className="av2-btn av2-btn--quiet"
          style={{ textDecoration: 'none' }}
        >
          Email performance
        </Link>
      </div>

      {/* One email-performance home (Matt lock 2026-09-01): this page is
          compose HISTORY only — the numbers strip moved to
          /admin/reports/emails with the rest of email performance. */}
      <SectionHead>Campaigns</SectionHead>
      <ReportGrid
        label="Sent email campaigns"
        columns={columns}
        template="minmax(180px, 2fr) minmax(92px, 0.8fr) minmax(66px, 0.5fr) minmax(146px, 1.2fr) minmax(88px, 0.7fr) minmax(112px, 0.9fr)"
        minWidth={800}
        rows={gridRows}
        empty={
          <>
            No campaigns yet.{' '}
            <Link href="/admin/email/compose" style={{ color: 'var(--a-accent)' }}>
              Compose an email to send
            </Link>
            .
          </>
        }
      />
      {rows.length > shown.length ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 12,
          }}
        >
          Showing {shown.length.toLocaleString('en-US')} of {rows.length.toLocaleString('en-US')}.
        </p>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        This list reads the 50 newest campaigns, newest first. Engagement is read from the
        email-events store and joined to each campaign by its message id. A campaign with no events
        yet reads &ldquo;No engagement yet&rdquo; rather than 0%.
      </p>
    </div>
  )
}
