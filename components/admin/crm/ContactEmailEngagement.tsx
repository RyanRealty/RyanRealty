/**
 * ContactEmailEngagement — the contact record card's email-engagement panel
 * (Wave 5). Renders the typed output of getContactEmailEngagement, which reads
 * the unified email_events store (both the Resend webhook rail and the Gmail
 * open/click tracker rail write there). Every number shown traces to a real
 * email_events row for this contact (CLAUDE.md §0).
 *
 * Server component. Empty state when no email events exist yet. Mobile-first.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, Badge -> StateWord (deliverability flags are system states,
 * not broker-typed data), every shadcn semantic class -> its var(--a-*) token.
 */
import Link from 'next/link'
import { StateWord } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import {
  emailSendCampaignHref,
  emailSendStatusLabel,
  type ContactEmailEngagement as Engagement,
  type ContactEmailSend,
} from '@/lib/data/crm/getContactEmailEngagement'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--a-border)' }}>
      <div className="tabular-nums" style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
        {value}
      </div>
      <div
        className="font-medium uppercase tracking-wide"
        style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        {label}
      </div>
    </div>
  )
}

function sendState(s: ContactEmailSend): 'ok' | 'down' | 'waiting' {
  if (s.bouncedAt) return 'down'
  if (s.clickedAt || s.openedAt || s.visitedAfterSend) return 'ok'
  return 'waiting'
}

export default function ContactEmailEngagement({ engagement }: { engagement: Engagement }) {
  const { sent, delivered, opens, clicks, bounces, complaints, unsubscribes, lastOpenAt, lastClickAt, hasAny, sends } =
    engagement

  return (
    <div id="emails" className="av2-pane">
      <div style={{ fontSize: 'var(--a-text-lg)', fontWeight: 500, color: 'var(--a-text)' }}>Email engagement</div>
      <div>
        {!hasAny ? (
          <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>No email activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Sent" value={sent} />
              <Stat label="Delivered" value={delivered} />
              <Stat label="Opens" value={opens} />
              <Stat label="Clicks" value={clicks} />
            </div>

            {/* Most-recent engagement timestamps */}
            {(lastOpenAt || lastClickAt) ? (
              <div
                className="flex flex-wrap gap-x-5 gap-y-1"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                {lastOpenAt ? (
                  <span>
                    Last open <span className="tabular-nums" style={{ color: 'var(--a-text)' }}>{formatDate(lastOpenAt)}</span>
                  </span>
                ) : null}
                {lastClickAt ? (
                  <span>
                    Last click <span className="tabular-nums" style={{ color: 'var(--a-text)' }}>{formatDate(lastClickAt)}</span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Deliverability flags — only shown when present. */}
            {(bounces > 0 || complaints > 0 || unsubscribes > 0) ? (
              <div className="flex flex-wrap gap-1.5">
                {bounces > 0 ? (
                  <StateWord state="down">
                    {bounces} {bounces === 1 ? 'bounce' : 'bounces'}
                  </StateWord>
                ) : null}
                {complaints > 0 ? (
                  <StateWord state="down">
                    {complaints} {complaints === 1 ? 'complaint' : 'complaints'}
                  </StateWord>
                ) : null}
                {unsubscribes > 0 ? (
                  <StateWord state="waiting">
                    {unsubscribes === 1 ? 'unsubscribed' : `${unsubscribes} unsubscribes`}
                  </StateWord>
                ) : null}
              </div>
            ) : null}

            {sends.length > 0 ? (
              <ul className="space-y-1.5">
                {sends.slice(0, 8).map((s) => {
                  const href = emailSendCampaignHref(s)
                  const title = s.subject?.trim() || 'Untitled send'
                  return (
                    <li
                      key={s.key}
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                      style={{ border: '1px solid var(--a-border)' }}
                    >
                      <div className="min-w-0">
                        {href ? (
                          <Link href={href} style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-md)', fontWeight: 500 }}>
                            {title}
                          </Link>
                        ) : (
                          <p style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>{title}</p>
                        )}
                        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                          {s.sentAt ? <span className="tabular-nums">{formatDate(s.sentAt)}</span> : null}
                          {s.visitedAfterSend ? ' · On the site after' : null}
                        </p>
                      </div>
                      <span style={{ flexShrink: 0 }}>
                        <StateWord state={sendState(s)}>{emailSendStatusLabel(s)}</StateWord>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
