/**
 * MarketReportCard — the contact's market report on the CRM record (Matt's
 * decisions 2026-09-29): the same report and the same controls the contact
 * has from her email link, plus the two broker-only steps.
 *
 *   - What she gets: area labels, interval, on / off / stopped (and who
 *     stopped it), the first-send approval, last and next send (the next send
 *     names its basis: the interval from the last send, then the first cron
 *     run inside 8am to 8pm Pacific), where the request came from, and the
 *     consent note.
 *   - Controls: on/off, interval, areas (ReportSubscriptionsPanel). A contact
 *     who stopped the reports herself needs a consent note to restart.
 *   - "Send a preview to me": her exact report, to the acting broker's inbox.
 *   - "Approve first send": after a preview of the current areas and interval.
 *   - Every report: sent, held (and why), failed, and for each real send its
 *     delivered / opened / clicked / bounced state, with a View of the stored
 *     copy and its figures trace.
 *
 * Server component, admin v2 language (design_system/admin/ADMIN_UI.md). The
 * data comes in whole from lib/data/crm/getMarketReportCard.ts.
 */
import Link from 'next/link'
import { Button, QuietRow, ReportGrid, SectionHead, StateWord, type AdminState } from '@/components/admin/v2'
import ReportSubscriptionsPanel from '@/components/admin/crm/ReportSubscriptionsPanel'
import type { MarketReportCard as CardData, MarketReportCardSend } from '@/lib/data/crm/getMarketReportCard'
import { formatDate, formatDateTime } from '@/lib/format/date'
import {
  approveMarketReportForm,
  previewMarketReportForm,
  saveMarketReportForm,
} from '@/app/actions/crm-market-report-card'

const FREQUENCY_LABEL: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' }

const SOURCE_LABEL: Record<string, string> = {
  'email-reply': 'Asked by email reply',
  broker: 'Set up by a broker',
  'self-serve': 'Signed up on the site',
  'account-page': 'Signed up on the site',
}

const STOPPED_VIA_LABEL: Record<string, string> = {
  'one-click': "the one-click unsubscribe in a report's email",
  'email-link': "the Stop button on the report's preferences page",
  'self-serve': 'their account page',
  admin: 'a broker',
}

const HOLD_LABEL: Record<string, string> = {
  'awaiting-approval': 'waiting for your approval',
  'stale-data': 'market data not fresh',
  suppressed: 'email is off for this contact',
  'no-email': 'no email address on file',
  'no-data': 'no verified market data',
}

const KIND_LABEL: Record<string, string> = { scheduled: 'Scheduled', manual: 'Sent by a broker', preview: 'Preview' }

function stateOf(card: CardData): { state: AdminState; word: string } {
  const sub = card.subscription
  if (!sub) return { state: 'waiting', word: 'Not set up' }
  if (card.state === 'stopped') return { state: 'down', word: card.contactStopped ? 'Stopped by the contact' : 'Stopped' }
  if (card.state === 'paused') return { state: 'slow', word: 'Off' }
  if (!sub.firstSendApprovedAt) return { state: 'waiting', word: 'On, waiting for your approval' }
  return { state: 'ok', word: 'On' }
}

function statusCell(s: MarketReportCardSend): string {
  if (s.status === 'sent') return s.sentAt ? `Sent ${formatDateTime(s.sentAt)}` : 'Sent'
  if (s.status === 'held') return `Held: ${HOLD_LABEL[s.holdReason ?? ''] ?? s.holdReason ?? 'held'}`
  return `Failed${s.error && s.error !== 'sending' ? `: ${s.error.slice(0, 120)}` : ''}`
}

function yesNo(v: boolean): string {
  return v ? 'Yes' : 'No'
}

export function MarketReportCard({
  personId,
  returnTo,
  card,
}: {
  personId: number
  returnTo: string
  card: CardData
}) {
  const sub = card.subscription
  const { state, word } = stateOf(card)
  const areaLine = card.areas.map((a) => a.label).join(', ')
  const needsApproval = Boolean(sub && !sub.firstSendApprovedAt)

  const nextLine = !sub
    ? 'Nothing scheduled.'
    : card.nextSendAt
      ? `${formatDateTime(card.nextSendAt)} (the interval from the last send, then the first 8am to 8pm Pacific run)`
      : card.state !== 'on'
        ? 'Nothing scheduled while reports are off.'
        : 'Waits for your approval of the first send.'

  const previewLine = card.latestPreview
    ? `${formatDateTime(card.latestPreview.sentAt ?? card.latestPreview.attemptedAt)} to ${card.latestPreview.recipientEmail ?? 'your inbox'}${
        card.previewMatches ? '' : ' (areas or interval changed since; send a new one before approving)'
      }`
    : 'None yet.'

  return (
    <section id="market-report" aria-label="Market report" style={{ margin: '0 0 20px' }}>
      <SectionHead>Market report</SectionHead>
      <p style={{ margin: '0 0 8px' }}>
        <StateWord state={state}>{word}</StateWord>
      </p>

      <ul className="av2-quietlist">
        <QuietRow name="Areas" state={areaLine || 'None picked'} />
        <QuietRow name="How often" state={sub ? FREQUENCY_LABEL[sub.frequency] ?? sub.frequency : 'Not set'} />
        <QuietRow
          name="First send"
          state={
            sub?.firstSendApprovedAt
              ? `Approved ${formatDateTime(sub.firstSendApprovedAt)}${sub.firstSendApprovedBy ? ` by ${sub.firstSendApprovedBy}` : ''}`
              : 'Not approved yet'
          }
        />
        <QuietRow name="Last preview" state={previewLine} />
        <QuietRow name="Last sent" state={sub?.lastSentAt ? formatDateTime(sub.lastSentAt) : 'Never'} />
        <QuietRow name="Next send" state={nextLine} />
        {sub?.stoppedAt ? (
          <QuietRow
            name="Stopped"
            state={`${formatDateTime(sub.stoppedAt)} by ${STOPPED_VIA_LABEL[sub.stoppedVia ?? ''] ?? sub.stoppedVia ?? 'unknown'}`}
          />
        ) : null}
        <QuietRow name="Source" state={sub?.source ? SOURCE_LABEL[sub.source] ?? sub.source : 'Not recorded'} />
        {sub?.requestedAt ? <QuietRow name="Requested" state={formatDate(sub.requestedAt, { month: 'long' })} /> : null}
        {sub?.consentNote ? <QuietRow name="Consent note" state={sub.consentNote} /> : null}
      </ul>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 12px' }}>
        <form action={previewMarketReportForm.bind(null, personId, returnTo)}>
          <Button type="submit" variant="quiet" touch disabled={!sub || card.areas.length === 0}>
            Send a preview to me
          </Button>
        </form>
        {needsApproval ? (
          <form action={approveMarketReportForm.bind(null, personId, returnTo)}>
            <Button type="submit" variant="quiet" touch disabled={!card.previewMatches}>
              Approve first send
            </Button>
          </form>
        ) : null}
      </div>
      {needsApproval && !card.previewMatches ? (
        <p style={{ margin: '0 0 12px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Approval unlocks after a preview of the current areas and interval reaches your inbox. Nothing goes to the
          contact until you approve.
        </p>
      ) : null}

      <ReportSubscriptionsPanel
        current={sub ? { isActive: sub.isActive, areas: sub.areas, frequency: sub.frequency } : null}
        areaOptions={card.areaOptions}
        setAction={saveMarketReportForm.bind(null, personId, returnTo)}
        consentRequired={card.contactStopped}
      />

      <div style={{ marginTop: 16 }}>
        <ReportGrid
          label="Market reports for this contact"
          columns={[
            { key: 'when', label: 'When' },
            { key: 'kind', label: 'Kind' },
            { key: 'status', label: 'Status' },
            { key: 'delivered', label: 'Delivered' },
            { key: 'opened', label: 'Opened', numeric: true },
            { key: 'clicked', label: 'Clicked', numeric: true },
            { key: 'bounced', label: 'Bounced' },
            { key: 'view', label: 'Copy' },
          ]}
          template="minmax(130px,1fr) minmax(110px,0.8fr) minmax(170px,1.4fr) 84px 72px 72px 76px 64px"
          minWidth={820}
          rows={card.sends.map((s) => {
            const tracked = s.kind !== 'preview' && s.status === 'sent'
            return {
              key: s.emailKey,
              cells: [
                formatDateTime(s.sentAt ?? s.attemptedAt),
                KIND_LABEL[s.kind] ?? s.kind,
                statusCell(s),
                tracked ? yesNo(s.engagement.delivered) : 'Not tracked',
                tracked ? String(s.engagement.opened) : '',
                tracked ? String(s.engagement.clicked) : '',
                tracked ? yesNo(s.engagement.bounced) : '',
                s.status === 'held' ? (
                  ''
                ) : (
                  <Link key="view" href={`/admin/people/${personId}/market-reports/${s.id}`}>
                    View
                  </Link>
                ),
              ],
            }
          })}
          empty="No market reports yet. Send yourself a preview to see what this contact would get."
        />
      </div>
    </section>
  )
}
