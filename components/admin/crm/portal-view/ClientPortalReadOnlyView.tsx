/**
 * ClientPortalReadOnlyView — the broker's read-only mirror of one client's
 * signed-in portal (search-optimization plan Phase 4.3).
 *
 * ── READ-ONLY BY CONSTRUCTION ───────────────────────────────────────────────
 * This tree renders text, badges, and navigation links. It imports no server
 * action, mounts no <form>, and carries no submit control, so there is no path
 * from this surface to a write against the client's alerts, saved homes,
 * hidden homes, or named areas. That is the point: a broker looking at a
 * client's private data must not be able to change it by accident, and must
 * not be impersonating the client's session to see it. The invariant is pinned
 * by lib/data/crm/clientPortalView.test.ts, which greps this directory and the
 * route for `'use server'`, action props, <form>, and write verbs.
 *
 * The consumer-facing /account surface is owned elsewhere and is deliberately
 * NOT imported here. The one shared piece is activeRegistryFilters, reused
 * (never forked) through PortalFilterChips so the chip labels a broker reads
 * are the labels the client sees.
 */

import Link from 'next/link'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { StatusPill } from '@/components/console/StatusPill'
import { PortalFilterChips } from '@/components/admin/crm/portal-view/PortalFilterChips'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type {
  ClientPortalActivityEvent,
  ClientPortalAlert,
  ClientPortalHiddenHome,
  ClientPortalNamedArea,
  ClientPortalView,
} from '@/lib/data/crm/getClientPortalView'
import type { ContactSavedHome } from '@/lib/data/crm/getContactSavedHomes'
import type { ListingEventType } from '@/lib/alerts/event-detection'
import { usd, fmtAgoLong, resolveDisplayName } from '@/app/admin/(protected)/crm/[id]/person-view-model'

const EVENT_LABELS: Record<ListingEventType, string> = {
  new: 'New listing',
  price_change: 'Price change',
  status_change: 'Status change',
  back_on_market: 'Back on market',
  sold: 'Sold',
  open_house: 'Open house',
}

const EVENT_ORDER: ListingEventType[] = [
  'new',
  'price_change',
  'status_change',
  'back_on_market',
  'sold',
  'open_house',
]

const CADENCE_LABELS: Record<string, string> = {
  instant: 'Sent as it happens',
  daily: 'Sent daily',
  weekly: 'Sent weekly',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cadenceLine(alert: ClientPortalAlert): string {
  const base = CADENCE_LABELS[alert.cadence] ?? `Sent ${alert.cadence}`
  if (!alert.scheduleDays || alert.scheduleDays.length === 0) return base
  const days = alert.scheduleDays
    .filter((d) => d >= 0 && d <= 6)
    .map((d) => DAY_NAMES[d])
  if (days.length === 0) return base
  return `${base} on ${days.join(', ')}`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function AlertCard({ alert }: { alert: ClientPortalAlert }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{alert.name}</span>
          <StatusPill tone={alert.active ? 'success' : 'neutral'} label={alert.active ? 'Active' : 'Paused'} />
          {alert.origin !== 'user' ? (
            <StatusPill tone={alert.origin === 'broker' ? 'info' : 'warning'} label={alert.origin} />
          ) : null}
          {alert.previewMode ? <StatusPill tone="warning" label="Held for approval" /> : null}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={alert.searchUrl} target="_blank" rel="noreferrer">
            Open this search
          </Link>
        </Button>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">{alert.criteria}</p>

      <div className="mt-2.5">
        <PortalFilterChips registryParams={alert.registryParams} otherChips={alert.otherChips} />
      </div>

      <Separator className="my-3" />

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Alerts on</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {EVENT_ORDER.map((type) => {
            const on = alert.events[type] === true
            return (
              <Badge
                key={type}
                variant={on ? 'default' : 'outline'}
                className={on ? 'rounded-full' : 'rounded-full text-muted-foreground line-through'}
              >
                {EVENT_LABELS[type]}
                {/* Strikethrough is the visual signal. State is never color or
                    decoration alone, so the on/off word ships for assistive tech. */}
                <span className="sr-only">{on ? ' on' : ' off'}</span>
              </Badge>
            )
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Cadence" value={cadenceLine(alert)} />
        <Field
          label="Last notified"
          value={alert.lastNotifiedAt ? (fmtAgoLong(alert.lastNotifiedAt) ?? 'unknown') : 'Never'}
        />
        <Field
          label="Recipients"
          value={alert.recipientCount > 0 ? `Client plus ${alert.recipientCount}` : 'Client only'}
        />
        <Field
          label="Marked seen"
          value={alert.lastViewedAt ? (fmtAgoLong(alert.lastViewedAt) ?? 'unknown') : 'Not yet'}
        />
      </div>
    </div>
  )
}

function NamedAreaRow({ area }: { area: ClientPortalNamedArea }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{area.name}</p>
        <p className="text-xs text-muted-foreground">{area.shapeSummary}</p>
      </div>
      <div className="flex items-center gap-2">
        {area.isPublic ? <StatusPill tone="info" label="Shared publicly" /> : null}
        <span className="text-xs tabular-nums text-muted-foreground">
          {area.updatedAt ? `Updated ${fmtAgoLong(area.updatedAt)}` : 'Updated date unknown'}
        </span>
      </div>
    </div>
  )
}

function HomeRow({
  address,
  city,
  status,
  price,
  listingKey,
  meta,
}: {
  address: string
  city: string | null
  status: string | null
  price: number | null
  listingKey: string
  meta: string
}) {
  const label = [address, city].filter(Boolean).join(', ')
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <Link
          href={`/listing/${listingKey}`}
          target="_blank"
          rel="noreferrer"
          className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {label}
        </Link>
        <p className="text-xs tabular-nums text-muted-foreground">
          {[usd(price), status, meta].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

function ActivityRow({ event }: { event: ClientPortalActivityEvent }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-1.5 last:border-b-0">
      <span className="text-sm text-foreground">{event.label}</span>
      <span className="truncate text-xs tabular-nums text-muted-foreground">
        {[event.pagePath, fmtAgoLong(event.eventAt)].filter(Boolean).join(' · ')}
      </span>
    </div>
  )
}

export function ClientPortalReadOnlyView({
  view,
  personHref,
}: {
  view: ClientPortalView
  /** Back link to the person workspace this view was opened from. */
  personHref: string
}) {
  const displayName = resolveDisplayName(view.personName, view.crmPersonId)
  const savedHomes: ContactSavedHome[] = view.savedHomes
  const hiddenHomes: ClientPortalHiddenHome[] = view.hiddenHomes
  const alerts: ClientPortalAlert[] = view.alerts

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">
            {displayName}, portal view
          </h1>
          <p className="text-sm text-muted-foreground">
            {view.emails.length > 0 ? view.emails.join(', ') : 'No email on file'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={personHref}>Back to the contact</Link>
        </Button>
      </div>

      <Alert>
        <AlertTitle>Read only</AlertTitle>
        <AlertDescription>
          This is what {displayName} sees when signed in. Nothing on this page can change their
          alerts, saved homes, hidden homes, or areas, and opening it does not sign you in as them.
          Make changes from the contact page or ask them to make the change.
        </AlertDescription>
      </Alert>

      {!view.hasSiteAccount ? (
        <Alert>
          <AlertTitle>No site account linked</AlertTitle>
          <AlertDescription>
            No signed-in account is linked to this contact yet, so saved homes, hidden homes, named
            areas, and site activity are empty. Alerts created by email or by a broker still show
            below.
          </AlertDescription>
        </Alert>
      ) : null}

      <ConsoleSection title="Alerts and saved searches" count={`(${alerts.length})`}>
        {alerts.length === 0 ? (
          <EmptyRow>No alerts or saved searches.</EmptyRow>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          A saved search and an alert are one record here, so every saved search appears in this
          list with the events it fires on.
        </p>
      </ConsoleSection>

      <ConsoleSection title="Named areas" count={`(${view.namedAreas.length})`}>
        {view.namedAreas.length === 0 ? (
          <EmptyRow>No named map areas.</EmptyRow>
        ) : (
          <div className="space-y-2">
            {view.namedAreas.map((area) => (
              <NamedAreaRow key={area.id} area={area} />
            ))}
          </div>
        )}
      </ConsoleSection>

      <ConsoleSection title="Saved homes" count={`(${savedHomes.length})`}>
        {savedHomes.length === 0 ? (
          <EmptyRow>No saved or liked homes.</EmptyRow>
        ) : (
          <div className="space-y-2">
            {savedHomes.map((home) => (
              <HomeRow
                key={home.listingKey}
                address={home.address}
                city={home.city}
                status={home.status}
                price={home.listPrice}
                listingKey={home.listingKey}
                meta={`${home.sources.join(' and ')} ${fmtAgoLong(home.savedAt) ?? ''}`.trim()}
              />
            ))}
          </div>
        )}
      </ConsoleSection>

      <ConsoleSection title="Hidden homes" count={`(${hiddenHomes.length})`}>
        {hiddenHomes.length === 0 ? (
          <EmptyRow>No hidden homes.</EmptyRow>
        ) : (
          <div className="space-y-2">
            {hiddenHomes.map((home) => (
              <HomeRow
                key={home.listingKey}
                address={home.address}
                city={home.city}
                status={home.status}
                price={home.listPrice}
                listingKey={home.listingKey}
                meta={`hidden ${fmtAgoLong(home.hiddenAt) ?? ''}`.trim()}
              />
            ))}
          </div>
        )}
      </ConsoleSection>

      <ConsoleSection title="Recent site activity" count={`(${view.activity.length})`}>
        {view.activity.length === 0 ? (
          <EmptyRow>No signed-in site activity recorded.</EmptyRow>
        ) : (
          <div>
            {view.activity.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </ConsoleSection>
    </div>
  )
}
