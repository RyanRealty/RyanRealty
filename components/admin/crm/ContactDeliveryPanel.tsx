/**
 * ContactDeliveryPanel — one contact's email delivery story, for embedding on
 * the person page (app/admin/console/leads/[id]).
 *
 * Server component. Two sections:
 *   1. "What they're subscribed to" — each active subscription with its
 *      cadence, the last send, and when the next one is expected.
 *   2. "Emails they've gotten" — chronological history across every stream
 *      (listing alerts, market reports, newsletters, one-offs), each row with
 *      opened / clicked / bounced status, relative times, absolute on hover.
 *
 * Integration (for the person page owner):
 *
 *   import ContactDeliveryPanel from '@/components/admin/crm/ContactDeliveryPanel'
 *   <ContactDeliveryPanel personId={person.id} email={person.primaryEmail} />
 *
 * Props:
 *   - personId  (required) crm_people.id — matches email_events.person_id and
 *     the subscription tables' person keys.
 *   - email     (optional but recommended) the contact's primary email —
 *     also matches sends recorded before the contact was linked to a person
 *     row, and guest listing alerts keyed by email only.
 *   - limit     (optional, default 25) max history rows rendered.
 *   - className (optional) layout-only classes for the embedding grid.
 *
 * The caller is expected to be an already-gated admin surface (the panel reads
 * through the service-role DAL and performs no gate of its own, matching the
 * sibling Contact* panels).
 */

import { getPersonDeliveryHistory } from '@/lib/data/crm/emailDelivery'
import { getPersonSubscriptionOutlook } from '@/lib/data/crm/emailDeliveryOutlook'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  RelativeTime,
  ExpectedTime,
  SendStatusBadge,
} from '@/components/admin/crm/subscriptions/delivery-shared'

export type ContactDeliveryPanelProps = {
  personId: number
  email?: string | null
  limit?: number
  className?: string
}

export default async function ContactDeliveryPanel({
  personId,
  email,
  limit = 25,
  className,
}: ContactDeliveryPanelProps) {
  const [history, outlook] = await Promise.all([
    getPersonDeliveryHistory({ personId, email, limit }),
    getPersonSubscriptionOutlook(personId, email),
  ])

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Email delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscriptions + next expected send */}
        <section>
          <h3 className="text-sm font-medium text-muted-foreground">What they&apos;re subscribed to</h3>
          {outlook.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No subscriptions yet. Set up a market report or a listing alert from
              this page and the cadence, last send, and next expected send will
              show here.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {outlook.map((sub, i) => (
                <li key={`${sub.kind}-${i}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant={sub.active ? 'success' : 'soft-neutral'}>
                      {sub.active ? 'Active' : 'Paused'}
                    </Badge>
                    <span className="truncate text-sm text-foreground">{sub.label}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      Last sent <RelativeTime iso={sub.lastSentAtIso} className="whitespace-nowrap text-foreground" />
                    </span>
                    {sub.active ? (
                      <span className="text-muted-foreground">
                        Next{' '}
                        <ExpectedTime
                          iso={sub.nextExpectedAtIso}
                          dueNow={sub.dueNow}
                          className="whitespace-nowrap text-foreground"
                        />
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {outlook.some((s) => s.kind === 'listing-alert') ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Listing alerts only go out when new listings match the search, so a
              quiet alert can be normal.
            </p>
          ) : null}
        </section>

        <Separator />

        {/* Email history */}
        <section>
          <h3 className="text-sm font-medium text-muted-foreground">Emails they&apos;ve gotten</h3>
          {history.unreadable ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Could not load email history right now. Reload the page to try again.
            </p>
          ) : history.rows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No emails recorded for this contact yet. The moment they get a listing
              alert, market report, or any tracked email, it appears here with
              whether they opened or clicked it.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {history.rows.map((row) => (
                <li key={row.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.streamLabel}
                      {' · sent '}
                      <RelativeTime iso={row.sentAtIso} className="whitespace-nowrap" />
                      {row.opened ? (
                        <>
                          {' · opened '}
                          <RelativeTime iso={row.openedAtIso} className="whitespace-nowrap" />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <SendStatusBadge status={row.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {history.totalSends > history.rows.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the {history.rows.length.toLocaleString('en-US')} most recent of{' '}
              {history.totalSends.toLocaleString('en-US')} emails.
            </p>
          ) : null}
        </section>
      </CardContent>
    </Card>
  )
}
