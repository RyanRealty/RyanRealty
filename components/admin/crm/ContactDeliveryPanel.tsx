/**
 * ContactDeliveryPanel — one contact's email delivery story, for embedding on
 * the person page (app/admin/(protected)/crm/[id]).
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
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, Badge -> StateWord (Active/Paused are system words),
 * Separator -> a 1px var(--a-border) rule, every shadcn semantic class -> its
 * var(--a-*) token.
 */

import { getPersonDeliveryHistory } from '@/lib/data/crm/emailDelivery'
import { getPersonSubscriptionOutlook } from '@/lib/data/crm/emailDeliveryOutlook'
import { StateWord } from '@/components/admin/v2'
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
    <div className={cn('av2-pane', className)}>
      <div style={{ fontSize: 'var(--a-text-lg)', fontWeight: 500, color: 'var(--a-text)' }}>Email delivery</div>
      <div className="space-y-4">
        {/* Subscriptions + next expected send */}
        <section>
          <h3 className="font-medium" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
            What they&apos;re subscribed to
          </h3>
          {outlook.length === 0 ? (
            <p className="mt-2" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
              No subscriptions yet. Set up a market report or a listing alert from
              this page and the cadence, last send, and next expected send will
              show here.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {outlook.map((sub, i) => (
                <li key={`${sub.kind}-${i}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0">
                      <StateWord state={sub.active ? 'ok' : 'waiting'}>
                        {sub.active ? 'Active' : 'Paused'}
                      </StateWord>
                    </span>
                    <span className="truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>{sub.label}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3" style={{ fontSize: 'var(--a-text-md)' }}>
                    {/* RelativeTime/ExpectedTime take only a className, so the
                        emphasis colour is inherited from a wrapper instead of a
                        semantic class handed across the boundary. */}
                    <span style={{ color: 'var(--a-text-2)' }}>
                      Last sent{' '}
                      <span style={{ color: 'var(--a-text)' }}>
                        <RelativeTime iso={sub.lastSentAtIso} className="whitespace-nowrap" />
                      </span>
                    </span>
                    {sub.active ? (
                      <span style={{ color: 'var(--a-text-2)' }}>
                        Next{' '}
                        <span style={{ color: 'var(--a-text)' }}>
                          <ExpectedTime
                            iso={sub.nextExpectedAtIso}
                            dueNow={sub.dueNow}
                            className="whitespace-nowrap"
                          />
                        </span>
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {outlook.some((s) => s.kind === 'listing-alert') ? (
            <p className="mt-2" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Listing alerts only go out when new listings match the search, so a
              quiet alert can be normal.
            </p>
          ) : null}
        </section>

        <div style={{ height: '1px', background: 'var(--a-border)' }} />

        {/* Email history */}
        <section>
          <h3 className="font-medium" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
            Emails they&apos;ve gotten
          </h3>
          {history.unreadable ? (
            <p className="mt-2" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
              Could not load email history right now. Reload the page to try again.
            </p>
          ) : history.rows.length === 0 ? (
            <p className="mt-2" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
              No emails recorded for this contact yet. The moment they get a listing
              alert, market report, or any tracked email, it appears here with
              whether they opened or clicked it.
            </p>
          ) : (
            /* `divide-y divide-border` carried its colour through a semantic
               class, and border-color does not inherit from the <ul> — so the
               hairline is drawn per row in the token instead. */
            <ul className="mt-2">
              {history.rows.map((row, i) => (
                <li
                  key={row.key}
                  className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
                  style={i > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}
                >
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>{row.label}</p>
                    <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
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
            <p className="mt-2" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Showing the {history.rows.length.toLocaleString('en-US')} most recent of{' '}
              {history.totalSends.toLocaleString('en-US')} emails.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
