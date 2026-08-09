/**
 * ContactNewsletterHistory — compact per-lead newsletter issue history card for
 * the contact record page. Renders the typed output of
 * getNewsletterHistoryForPerson (newsletter_recipients joined to the deduped
 * newsletter_recipient_events ledger), so every number shown traces to real
 * per-recipient rows for this contact (CLAUDE.md §0).
 *
 * Server component. Sits next to the newsletter membership chip in the
 * website-activity rail, matching the ContactEmailEngagement card pattern.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, Badge -> StateWord, every shadcn semantic class -> its
 * var(--a-*) token. The per-issue badge kept its three tiers rather than
 * collapsing to one grey: clicked is the accent wash, opened is the ok wash
 * (a delivered-and-read issue is a healthy outcome, and v2 has no outline
 * state to hold the old outline/secondary split), queued/sending/sent are the
 * neutral waiting state, and a bounce/complaint/failure is danger.
 */
import { StateWord } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import type { NewsletterHistoryForPerson, NewsletterIssueForPerson } from '@/lib/data/newsletter/perLead'

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

function issueBadge(issue: NewsletterIssueForPerson) {
  if (issue.recipientStatus === 'bounced' || issue.recipientStatus === 'complained' || issue.recipientStatus === 'failed') {
    return <StateWord state="down">{issue.recipientStatus}</StateWord>
  }
  if (issue.clicked) return <StateWord state="accent">Clicked</StateWord>
  if (issue.opened) return <StateWord state="ok">Opened</StateWord>
  if (issue.recipientStatus === 'queued' || issue.recipientStatus === 'sending') {
    return <StateWord state="waiting">{issue.recipientStatus}</StateWord>
  }
  return <StateWord state="waiting">Sent</StateWord>
}

export function ContactNewsletterHistory({ history }: { history: NewsletterHistoryForPerson }) {
  const { issues, totals } = history

  return (
    <div className="av2-pane">
      <div style={{ fontSize: 'var(--a-text-lg)', fontWeight: 500, color: 'var(--a-text)' }}>Newsletter history</div>
      <div>
        {issues.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>No newsletter issues received yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Received" value={totals.received} />
              <Stat label="Opened" value={totals.opened} />
              <Stat label="Clicked" value={totals.clicked} />
            </div>

            <ul className="space-y-1.5">
              {issues.map((issue) => (
                <li
                  key={issue.newsletterId}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                  style={{ border: '1px solid var(--a-border)' }}
                >
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
                      {issue.subject}
                    </p>
                    <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {issue.sentAt ? <span className="tabular-nums">{formatDate(issue.sentAt)}</span> : 'Not sent yet'}
                      {issue.clicked && issue.clickCount > 0 ? (
                        <span className="tabular-nums"> · {issue.clickCount} {issue.clickCount === 1 ? 'click' : 'clicks'}</span>
                      ) : issue.opened && issue.openCount > 0 ? (
                        <span className="tabular-nums"> · {issue.openCount} {issue.openCount === 1 ? 'open' : 'opens'}</span>
                      ) : null}
                    </p>
                  </div>
                  {/* shrink-0 lived on the shadcn Badge base class; StateWord takes
                      no className, so the guard moves to the flex item itself —
                      without it a long subject squeezes the state word. */}
                  <span className="shrink-0">{issueBadge(issue)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
