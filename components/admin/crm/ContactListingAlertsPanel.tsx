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
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Badge -> StateWord (the two source labels are system words), and the
 * `asChild` Button anchor -> a real <a> carrying av2-btn so the stylesheet's
 * hover/pressed/focus states come with it instead of being hand-rolled.
 */
import { ExternalLink } from 'lucide-react'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { StatusPill } from '@/components/console/StatusPill'
import { StateWord } from '@/components/admin/v2'
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
    <div className="rounded-lg p-3" style={{ border: '1px solid var(--a-border)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            className="font-medium [overflow-wrap:anywhere]"
            style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
          >
            {alert.criteriaText}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StateWord state="waiting">{SOURCE_LABEL[alert.source]}</StateWord>
            <StatusPill
              tone={alert.active ? 'success' : 'neutral'}
              label={alert.active ? 'Active' : 'Paused'}
            />
            {cadence ? (
              <span className="tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {cadenceLabel(cadence)}
              </span>
            ) : null}
          </div>
        </div>
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          // sm:min-h-0 existed to drop back to the shadcn size-sm height; av2-btn
          // carries its own 36px metric, so sm:min-h-9 restates it rather than
          // collapsing the control to its content height.
          className="av2-btn av2-btn--quiet min-h-11 w-full shrink-0 sm:min-h-9 sm:w-auto"
          style={{ textDecoration: 'none' }}
        >
          View results
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
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
        <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>No listing alerts yet.</p>
      ) : (
        alerts.map((alert) => <AlertRow key={`${alert.source}-${alert.id}`} alert={alert} />)
      )}
    </ConsoleSection>
  )
}
