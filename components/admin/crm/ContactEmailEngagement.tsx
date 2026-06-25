/**
 * ContactEmailEngagement — the contact record card's email-engagement panel
 * (Wave 5). Renders the typed output of getContactEmailEngagement, which reads
 * the unified email_events store (both the Resend webhook rail and the Gmail
 * open/click tracker rail write there). Every number shown traces to a real
 * email_events row for this contact (CLAUDE.md §0).
 *
 * Server component. Empty state when no email events exist yet. Mobile-first.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format/date'
import type { ContactEmailEngagement as Engagement } from '@/lib/data/crm/getContactEmailEngagement'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

export default function ContactEmailEngagement({ engagement }: { engagement: Engagement }) {
  const { sent, opens, clicks, bounces, complaints, unsubscribes, lastOpenAt, lastClickAt, hasAny } = engagement

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Email engagement</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">No email activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Sent" value={sent} />
              <Stat label="Opens" value={opens} />
              <Stat label="Clicks" value={clicks} />
            </div>

            {/* Most-recent engagement timestamps */}
            {(lastOpenAt || lastClickAt) ? (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {lastOpenAt ? (
                  <span>
                    Last open <span className="tabular-nums text-foreground">{formatDate(lastOpenAt)}</span>
                  </span>
                ) : null}
                {lastClickAt ? (
                  <span>
                    Last click <span className="tabular-nums text-foreground">{formatDate(lastClickAt)}</span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Deliverability flags — only shown when present. */}
            {(bounces > 0 || complaints > 0 || unsubscribes > 0) ? (
              <div className="flex flex-wrap gap-1.5">
                {bounces > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    {bounces} {bounces === 1 ? 'bounce' : 'bounces'}
                  </Badge>
                ) : null}
                {complaints > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    {complaints} {complaints === 1 ? 'complaint' : 'complaints'}
                  </Badge>
                ) : null}
                {unsubscribes > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    {unsubscribes === 1 ? 'unsubscribed' : `${unsubscribes} unsubscribes`}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
