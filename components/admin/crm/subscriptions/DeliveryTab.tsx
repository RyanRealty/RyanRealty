'use client'

/**
 * DeliveryTab — the Delivery tab of the Subscriptions hub
 * (/admin/crm/subscriptions). Broker-language delivery observability:
 *
 *   - one card per email stream (listing alerts, market reports, newsletters
 *     when they exist): sends, open rate, clicks, failures, last send;
 *   - a "needs attention" list where every item says what looks wrong and how
 *     to fix it, with a link to the fix;
 *   - a recent-sends table with per-send opened/clicked/bounced status.
 *
 * Data comes from getGlobalDeliverySummaryAction (read-only). The window
 * selector refetches; the initial payload is server-fetched by the page so the
 * tab renders with data immediately, like its sibling tabs.
 *
 * P11F: on the LOCKED admin v2 language. shadcn Card/Select/Table/Badge/Button
 * are gone — av2-pane surfaces, ToolbarSelect, the av2-rgrid div/role reader
 * (ReportGrid's classes + roles, the same shape ConfigTableEditor uses),
 * StateWord, and a v2-styled Link for the one "fix" action. Colour comes only
 * from var(--a-*).
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { CSSProperties } from 'react'
import { getGlobalDeliverySummaryAction } from '@/app/actions/subscriptions-admin'
import type { GlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import { StateWord, ToolbarSelect } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { TableSkeleton } from '@/components/admin/crm/subscriptions/subscriptions-shared'
import {
  RelativeTime,
  SendStatusBadge,
  percentLabel,
} from '@/components/admin/crm/subscriptions/delivery-shared'

const WINDOW_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const

/** Card heading — a div in shadcn too, so this stays a non-heading element. */
const CARD_TITLE: CSSProperties = { color: 'var(--a-text)' }

export default function DeliveryTab({ initial }: { initial: GlobalDeliverySummary }) {
  const [summary, setSummary] = useState<GlobalDeliverySummary>(initial)
  const [windowDays, setWindowDays] = useState(String(initial.windowDays))
  const [isPending, startTransition] = useTransition()

  const changeWindow = (value: string) => {
    setWindowDays(value)
    startTransition(async () => {
      const res = await getGlobalDeliverySummaryAction(Number(value))
      if (!res.data) {
        toast.error(res.error ?? 'Could not load delivery data')
        return
      }
      setSummary(res.data)
    })
  }

  const totalSends = summary.streams.reduce((n, s) => n + s.sends, 0)

  // Desktop column template for the recent-sends reader.
  const gridStyle = {
    '--rgrid-cols': 'minmax(220px,1.6fr) minmax(180px,1.2fr) 140px 120px 116px',
    '--rgrid-min': '820px',
  } as CSSProperties

  return (
    <div className="space-y-4">
      {/* Window selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
          What went out, who opened it, and what needs a fix.
        </p>
        <ToolbarSelect
          className="w-40"
          aria-label="Time window"
          value={windowDays}
          onChange={(e) => changeWindow(e.target.value)}
        >
          {WINDOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </ToolbarSelect>
      </div>

      {/* Stream summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.streams.map((s) => (
          <div key={s.stream} className="av2-pane" style={{ gap: 8 }}>
            <div className="text-sm font-medium" style={{ color: 'var(--a-text-2)' }}>{s.label}</div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--a-text)' }}>
                  {s.sends.toLocaleString('en-US')}
                </span>
                <span className="text-sm" style={{ color: 'var(--a-text-2)' }}>{s.sends === 1 ? 'email sent' : 'emails sent'}</span>
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--a-text-2)' }}>Opened</dt>
                  <dd className="tabular-nums" style={{ color: 'var(--a-text)' }}>
                    {s.opens.toLocaleString('en-US')} ({percentLabel(s.openRate)})
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--a-text-2)' }}>Clicked</dt>
                  <dd className="tabular-nums" style={{ color: 'var(--a-text)' }}>{s.clicks.toLocaleString('en-US')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--a-text-2)' }}>Failed</dt>
                  <dd className="tabular-nums" style={{ color: 'var(--a-text)' }}>
                    {s.failures > 0 ? (
                      <span style={{ color: 'var(--a-danger)' }}>{s.failures.toLocaleString('en-US')}</span>
                    ) : (
                      '0'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--a-text-2)' }}>Last send</dt>
                  {/* Colour on the <dd> so RelativeTime keeps its own default
                      for every other caller. */}
                  <dd style={{ color: 'var(--a-text)' }}>
                    <RelativeTime iso={s.lastSendAtIso} className="whitespace-nowrap" />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ))}
      </div>

      {totalSends === 0 ? (
        <div className="av2-pane">
          <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
            No emails went out in this window. Sends appear here automatically:
            listing alerts go out when new listings match someone&apos;s saved search,
            and market reports go out on each subscriber&apos;s cadence
            ({summary.subscriptionCounts.alertsActive.toLocaleString('en-US')} listing
            {summary.subscriptionCounts.alertsActive === 1 ? ' alert is' : ' alerts are'} active and{' '}
            {summary.subscriptionCounts.reportsActive.toLocaleString('en-US')} market report
            {summary.subscriptionCounts.reportsActive === 1 ? ' subscription is' : ' subscriptions are'} active
            right now). Try a longer window, or check back after the next send run.
          </p>
        </div>
      ) : null}

      {/* Attention list */}
      <div className="av2-pane" style={{ gap: 8 }}>
        <div className="text-base font-medium" style={CARD_TITLE}>Needs attention</div>
        <div>
          {summary.attention.length === 0 ? (
            <p className="py-2 text-sm" style={{ color: 'var(--a-text-2)' }}>
              Nothing needs attention right now. When a subscriber stops getting their
              emails, an address bounces, someone marks a message as spam, or a
              contact never opens anything, it shows up here with a suggested fix.
            </p>
          ) : (
            <ul>
              {summary.attention.map((item, i) => (
                <li
                  key={`${item.kind}-${i}`}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                  // What divide-y did, in tokens.
                  style={{ borderTop: i > 0 ? '1px solid var(--a-border)' : undefined }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StateWord state={item.severity === 'problem' ? 'down' : 'slow'}>
                        {item.severity === 'problem' ? 'Problem' : 'Worth a look'}
                      </StateWord>
                      <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>{item.headline}</p>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>{item.detail}</p>
                    <p className="text-sm" style={{ color: 'var(--a-text)' }}>
                      <span className="font-medium">Fix:</span> {item.fix}
                    </p>
                  </div>
                  {/* A link that acts as a button: the av2-btn classes keep the
                      hover the stylesheet owns, which an inline style would kill. */}
                  <Link
                    href={item.fixHref}
                    className="av2-btn av2-btn--quiet shrink-0"
                    style={{ textDecoration: 'none' }}
                  >
                    {item.fixLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p
            className="mt-3 pt-3 text-xs"
            style={{ borderTop: '1px solid var(--a-border)', color: 'var(--a-text-2)' }}
          >
            Bounces and spam complaints are tracked automatically. An email that fails
            at the moment of sending is not logged per person yet — for market reports
            it shows here as &ldquo;we tried but it didn&apos;t go out&rdquo;; listing alerts have no
            durable send-failure record today.
          </p>
        </div>
      </div>

      {/* Recent sends */}
      <div className="av2-pane" style={{ gap: 8 }}>
        <div className="text-base font-medium" style={CARD_TITLE}>Recent sends</div>
        <div>
          {isPending ? (
            <TableSkeleton rows={6} />
          ) : summary.recentSends.length === 0 ? (
            <p className="py-2 text-sm" style={{ color: 'var(--a-text-2)' }}>
              No sends recorded in this window yet. Every listing alert, market report,
              and tracked email lands here the moment it goes out, with its opens and
              clicks as they happen.
            </p>
          ) : (
            <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Recent sends">
              <div className="av2-rgrid" role="table" aria-label="Recent sends" style={gridStyle}>
                <div className="av2-rgrid__head" role="row">
                  <span role="columnheader" className="av2-rgrid__h">Email</span>
                  <span role="columnheader" className="av2-rgrid__h">To</span>
                  <span role="columnheader" className="av2-rgrid__h">Stream</span>
                  <span role="columnheader" className="av2-rgrid__h">Sent</span>
                  <span role="columnheader" className="av2-rgrid__h">Status</span>
                </div>
                {summary.recentSends.map((row) => (
                  <div key={row.key} role="row" className="av2-rgrid__row hover:bg-[var(--a-inset)]">
                    <span role="cell" data-label="Email" className="av2-rgrid__c">
                      <span className="block truncate text-sm" style={{ color: 'var(--a-text)' }}>{row.label}</span>
                    </span>
                    <span role="cell" data-label="To" className="av2-rgrid__c">
                      {row.personId ? (
                        <Link
                          href={`/admin/people/${row.personId}`}
                          className="block truncate text-sm underline-offset-2 hover:underline"
                          style={{ color: 'var(--a-text)' }}
                        >
                          {row.recipientEmail ?? 'View contact'}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm" style={{ color: 'var(--a-text-2)' }}>{row.recipientEmail ?? '—'}</span>
                      )}
                    </span>
                    <span role="cell" data-label="Stream" className="av2-rgrid__c text-sm" style={{ color: 'var(--a-text-2)' }}>
                      {row.streamLabel}
                    </span>
                    <span role="cell" data-label="Sent" className="av2-rgrid__c text-sm tabular-nums">
                      <RelativeTime iso={row.sentAtIso} />
                    </span>
                    <span role="cell" data-label="Status" className="av2-rgrid__c">
                      <SendStatusBadge status={row.status} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
