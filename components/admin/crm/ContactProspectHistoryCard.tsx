/**
 * ContactProspectHistoryCard — the structured expired/FSBO listing story on
 * the contact page, right-rail card (renders when the contact links to an
 * expired_listings/fsbo_listings row via getContactProspectStory). Each row:
 * status + date, MLS#, last/original price with the drop, days on market, the
 * prior agent, and a deep link to the prospect's own page at
 * /admin/prospecting/<kind>/<id> (the `?id=` drawer was deleted 2026-07-28).
 * Display-only server component — the actions live on the prospecting surface.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, and the `asChild` Link -> a real Link carrying av2-btn so
 * hover/pressed/focus come from the stylesheet rather than being hand-rolled.
 *
 * The status pill is NOT a StateWord: .av2-state upper-cases its contents, and
 * this pill carries live MLS data — the raw status word plus a formatted date
 * ("Expired · Aug 3"). ADMIN_UI's state vocabulary is for system words, so this
 * stays the neutral outlined chip it already was, drawn in var(--a-*).
 */
import '@/components/admin/v2/admin-v2.css'
import Link from 'next/link'
import { History } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import type { ContactProspectStory } from '@/lib/data/crm/getContactProspectStory'

function fmtDate(iso: string | null): string | null {
  return iso ? formatDate(iso, { month: 'short', day: 'numeric' }) : null
}

/** "$795,000 → $749,000 (↓ 5.8%)" when the price moved, else the last price. */
function priceLine(s: ContactProspectStory): string | null {
  const last = s.lastListPrice
  const original = s.originalListPrice
  if (last == null && original == null) return null
  if (original == null || last == null || original === last) return formatPrice(last ?? original)
  const pct = ((last - original) / original) * 100
  const arrow = pct < 0 ? '↓' : '↑'
  return `${formatPrice(original)} → ${formatPrice(last)} (${arrow} ${Math.abs(pct).toFixed(1)}%)`
}

export function ContactProspectHistoryCard({ stories }: { stories: ContactProspectStory[] }) {
  if (stories.length === 0) return null

  return (
    <div className="av2-pane">
      <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
        <History className="h-4 w-4" style={{ color: 'var(--a-accent)' }} aria-hidden />
        Listing history
      </div>
      <div className="space-y-2.5">
        {stories.map((s) => {
          const date = fmtDate(s.statusDate)
          const price = priceLine(s)
          return (
            <div
              key={`${s.kind}-${s.prospectId}`}
              className="rounded-lg p-2.5"
              style={{ border: '1px solid var(--a-border)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="truncate"
                    style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}
                    title={s.streetAddress ?? undefined}
                  >
                    {s.streetAddress ?? '—'}
                    {s.city ? `, ${s.city}` : ''}
                  </p>
                  <p className="tabular-nums" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                    {[price, s.daysOnMarket != null ? `${s.daysOnMarket} days on market` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <span
                  className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5"
                  style={{
                    fontSize: 'var(--a-text-xs)',
                    fontWeight: 500,
                    color: 'var(--a-text)',
                    border: '1px solid var(--a-border)',
                  }}
                >
                  {s.status}
                  {date ? ` · ${date}` : ''}
                </span>
              </div>
              {s.mlsNumber || s.priorAgentName ? (
                <p className="mt-1 truncate" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {[
                    s.mlsNumber ? `MLS# ${s.mlsNumber}` : null,
                    s.priorAgentName
                      ? `Prior agent ${s.priorAgentName}${s.priorOfficeName ? ` · ${s.priorOfficeName}` : ''}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
              <div className="mt-2">
                <Link href={s.detailHref} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                  Open in Prospecting
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
