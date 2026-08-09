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
 *
 * Admin v2 (11F): off shadcn and onto the locked admin language. Alert ->
 * a role="alert" panel on the tokens, Badge -> token spans (the v2 FilterChip
 * is a button and StateWord uppercases — neither belongs on a read-only mirror
 * of the client's own words), Separator -> a 1px rule, and the two
 * `Button asChild` link wrappers -> anchors wearing the av2-btn classes, which
 * is what keeps middle-click and Cmd/Ctrl-click on a NAVIGATION control. The
 * ConsoleSection panels and StatusPill stay: they are the console kit the
 * admin shell (app/admin/(protected)/layout.tsx -> ConsoleShell) still mounts,
 * not shadcn, and swapping them is a different unit's decision.
 */

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { StatusPill } from '@/components/console/StatusPill'
import { PortalFilterChips } from '@/components/admin/crm/portal-view/PortalFilterChips'
import '@/components/admin/v2/admin-v2.css'
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

/** A bordered block on the panel's own background — never a surface fill on a
 *  surface, which is an invisible element. */
const BORDERED_CARD: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  padding: 'var(--a-s3)',
}

const BORDERED_ROW: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  padding: '8px var(--a-s3)',
}

/** Was <Alert>: a bordered notice that names itself to assistive tech. */
const NOTICE: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  padding: '8px 10px',
  fontSize: 'var(--a-text-sm)',
}

/** Was the shadcn Separator: a 1px hairline, never a raw rule element. */
const RULE: CSSProperties = {
  height: 1,
  background: 'var(--a-border)',
  margin: 'var(--a-s3) 0',
}

const LABEL_META: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '.025em',
  color: 'var(--a-text-2)',
}

/** Was <Badge>: an event pill. Strikethrough (not color) carries "off". */
const EVENT_PILL: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 'var(--a-text-xs)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
}
const EVENT_PILL_ON: CSSProperties = {
  ...EVENT_PILL,
  background: 'var(--a-accent-wash)',
  color: 'var(--a-accent)',
}
const EVENT_PILL_OFF: CSSProperties = {
  ...EVENT_PILL,
  borderColor: 'var(--a-border)',
  color: 'var(--a-text-2)',
  textDecoration: 'line-through',
}

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
      <p style={LABEL_META}>{label}</p>
      <p className="truncate tabular-nums" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
        {value}
      </p>
    </div>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>{children}</p>
}

function AlertCard({ alert }: { alert: ClientPortalAlert }) {
  return (
    <div style={BORDERED_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className="truncate"
            style={{ fontSize: 'var(--a-text-md)', fontWeight: 600, color: 'var(--a-text)' }}
          >
            {alert.name}
          </span>
          <StatusPill tone={alert.active ? 'success' : 'neutral'} label={alert.active ? 'Active' : 'Paused'} />
          {alert.origin !== 'user' ? (
            <StatusPill tone={alert.origin === 'broker' ? 'info' : 'warning'} label={alert.origin} />
          ) : null}
          {alert.previewMode ? <StatusPill tone="warning" label="Held for approval" /> : null}
        </div>
        <Link
          href={alert.searchUrl}
          target="_blank"
          rel="noreferrer"
          className="av2-btn av2-btn--quiet"
          style={{ textDecoration: 'none' }}
        >
          Open this search
        </Link>
      </div>

      <p className="mt-1" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
        {alert.criteria}
      </p>

      <div className="mt-2.5">
        <PortalFilterChips registryParams={alert.registryParams} otherChips={alert.otherChips} />
      </div>

      <div style={RULE} />

      <div>
        <p style={LABEL_META}>Alerts on</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {EVENT_ORDER.map((type) => {
            const on = alert.events[type] === true
            return (
              <span key={type} style={on ? EVENT_PILL_ON : EVENT_PILL_OFF}>
                {EVENT_LABELS[type]}
                {/* Strikethrough is the visual signal. State is never color or
                    decoration alone, so the on/off word ships for assistive tech. */}
                <span className="sr-only">{on ? ' on' : ' off'}</span>
              </span>
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
    <div className="flex flex-wrap items-center justify-between gap-2" style={BORDERED_ROW}>
      <div className="min-w-0">
        <p className="truncate" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
          {area.name}
        </p>
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{area.shapeSummary}</p>
      </div>
      <div className="flex items-center gap-2">
        {area.isPublic ? <StatusPill tone="info" label="Shared publicly" /> : null}
        <span className="tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
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
    <div className="flex flex-wrap items-center justify-between gap-2" style={BORDERED_ROW}>
      <div className="min-w-0">
        <Link
          href={`/listing/${listingKey}`}
          target="_blank"
          rel="noreferrer"
          className="truncate underline-offset-4 hover:underline"
          style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}
        >
          {label}
        </Link>
        <p className="tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {[usd(price), status, meta].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

function ActivityRow({ event }: { event: ClientPortalActivityEvent }) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-2 border-b py-1.5 last:border-b-0"
      style={{ borderBottomColor: 'var(--a-border)' }}
    >
      <span style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>{event.label}</span>
      <span className="truncate tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
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
          <h1
            className="truncate"
            style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}
          >
            {displayName}, portal view
          </h1>
          <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
            {view.emails.length > 0 ? view.emails.join(', ') : 'No email on file'}
          </p>
        </div>
        <Link href={personHref} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          Back to the contact
        </Link>
      </div>

      <div role="alert" style={NOTICE}>
        <div style={{ fontWeight: 500, color: 'var(--a-text)' }}>Read only</div>
        <div style={{ color: 'var(--a-text-2)' }}>
          This is what {displayName} sees when signed in. Nothing on this page can change their
          alerts, saved homes, hidden homes, or areas, and opening it does not sign you in as them.
          Make changes from the contact page or ask them to make the change.
        </div>
      </div>

      {!view.hasSiteAccount ? (
        <div role="alert" style={NOTICE}>
          <div style={{ fontWeight: 500, color: 'var(--a-text)' }}>No site account linked</div>
          <div style={{ color: 'var(--a-text-2)' }}>
            No signed-in account is linked to this contact yet, so saved homes, hidden homes, named
            areas, and site activity are empty. Alerts created by email or by a broker still show
            below.
          </div>
        </div>
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
        <p className="mt-3" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
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
