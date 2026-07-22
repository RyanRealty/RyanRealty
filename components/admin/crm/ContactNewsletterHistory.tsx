/**
 * ContactNewsletterHistory — compact per-lead newsletter issue history card for
 * the contact record page. Renders the typed output of
 * getNewsletterHistoryForPerson (newsletter_recipients joined to the deduped
 * newsletter_recipient_events ledger), so every number shown traces to real
 * per-recipient rows for this contact (CLAUDE.md §0).
 *
 * Server component. Sits next to the newsletter membership chip in the
 * website-activity rail, matching the ContactEmailEngagement card pattern.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format/date'
import type { NewsletterHistoryForPerson, NewsletterIssueForPerson } from '@/lib/data/newsletter/perLead'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

function issueBadge(issue: NewsletterIssueForPerson) {
  if (issue.recipientStatus === 'bounced' || issue.recipientStatus === 'complained' || issue.recipientStatus === 'failed') {
    return <Badge variant="destructive" className="text-xs capitalize">{issue.recipientStatus}</Badge>
  }
  if (issue.clicked) return <Badge className="text-xs">Clicked</Badge>
  if (issue.opened) return <Badge variant="secondary" className="text-xs">Opened</Badge>
  if (issue.recipientStatus === 'queued' || issue.recipientStatus === 'sending') {
    return <Badge variant="outline" className="text-xs capitalize">{issue.recipientStatus}</Badge>
  }
  return <Badge variant="outline" className="text-xs">Sent</Badge>
}

export function ContactNewsletterHistory({ history }: { history: NewsletterHistoryForPerson }) {
  const { issues, totals } = history

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Newsletter history</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No newsletter issues received yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Received" value={totals.received} />
              <Stat label="Opened" value={totals.opened} />
              <Stat label="Clicked" value={totals.clicked} />
            </div>

            <ul className="space-y-1.5">
              {issues.map((issue) => (
                <li key={issue.newsletterId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{issue.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {issue.sentAt ? <span className="tabular-nums">{formatDate(issue.sentAt)}</span> : 'Not sent yet'}
                      {issue.clicked && issue.clickCount > 0 ? (
                        <span className="tabular-nums"> · {issue.clickCount} {issue.clickCount === 1 ? 'click' : 'clicks'}</span>
                      ) : issue.opened && issue.openCount > 0 ? (
                        <span className="tabular-nums"> · {issue.openCount} {issue.openCount === 1 ? 'open' : 'opens'}</span>
                      ) : null}
                    </p>
                  </div>
                  {issueBadge(issue)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
