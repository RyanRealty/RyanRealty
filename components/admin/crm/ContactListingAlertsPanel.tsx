/**
 * ContactListingAlertsPanel — the Contact-360 panel that shows every listing
 * alert a contact receives (CONTACT360 Phase 3.1, UI side). It renders the
 * humanized output of getContactListingAlerts so a broker can see exactly what
 * homes a contact is being alerted about, regardless of whether the alert came
 * from a signed-in saved search or a guest saved-search alert.
 *
 * Server component — pure render over the reader's typed output (passed as a
 * prop; the page does the fetch). Each alert is one stacked row: the readable
 * criteria up top (prominent), a source badge, an active/paused status pill, the
 * cadence when present, and a deep link that opens the search results in a new
 * tab. Mobile-first: rows stack on small screens, the link is a full-width tap
 * target there and shrinks to the inline trailing action from sm up.
 */
import { ExternalLink } from 'lucide-react'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { StatusPill } from '@/components/console/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ContactListingAlert, ContactListingAlertSource } from '@/lib/data/crm/getContactListingAlerts'

const SOURCE_LABEL: Record<ContactListingAlertSource, string> = {
  'saved-search': 'Saved search',
  'guest-alert': 'Guest alert',
}

/** Sentence-case a stored cadence (instant/daily/weekly) for display. */
function cadenceLabel(cadence: string): string {
  const c = cadence.trim().toLowerCase()
  if (c === 'instant') return 'Instant alerts'
  if (c === 'daily') return 'Daily digest'
  if (c === 'weekly') return 'Weekly digest'
  return cadence.trim()
}

function AlertRow({ alert }: { alert: ContactListingAlert }) {
  const cadence = alert.cadence?.trim()
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{alert.criteriaText}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="soft-neutral">{SOURCE_LABEL[alert.source]}</Badge>
            <StatusPill
              tone={alert.active ? 'success' : 'neutral'}
              label={alert.active ? 'Active' : 'Paused'}
            />
            {cadence ? (
              <span className="text-xs tabular-nums text-muted-foreground">{cadenceLabel(cadence)}</span>
            ) : null}
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="min-h-11 w-full shrink-0 sm:min-h-0 sm:w-auto"
        >
          <a href={alert.url} target="_blank" rel="noopener noreferrer">
            View results
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  )
}

export function ContactListingAlertsPanel({
  alerts,
  className,
}: {
  alerts: ContactListingAlert[]
  className?: string
}) {
  const count = alerts.length
  return (
    <ConsoleSection
      id="listing-alerts"
      title="Listing alerts"
      count={count > 0 ? `(${count})` : undefined}
      className={cn('scroll-mt-20', className)}
      bodyClassName="space-y-2"
    >
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">No listing alerts yet.</p>
      ) : (
        alerts.map((alert) => <AlertRow key={`${alert.source}-${alert.id}`} alert={alert} />)
      )}
    </ConsoleSection>
  )
}
