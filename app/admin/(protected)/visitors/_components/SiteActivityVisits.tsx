/**
 * SiteActivityVisits — one contact's visits, page by page (P7 identity loop).
 *
 * Server component, presentation only. Shared by /admin/visitors/live
 * (?filter=people) and the CRM person page so both read the same way:
 * each visit is a line (when, how they arrived, how many pages), then its
 * pages newest first with the page title linked to the live page, the home's
 * CURRENT address and list price when it was a listing (from `listings`, never
 * a snapshot), and the time they spent on it.
 *
 * Admin v2 language (design_system/admin/ADMIN_UI.md): color only through
 * var(--a-*), mono for MLS numbers, tabular figures.
 */
import { formatDateTime } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import { formatSecondsOnPage, type ActivityVisit } from '@/lib/crm/site-activity'
import type { ListingFact } from '@/lib/data/crm/getSiteActivity'

const SITE = 'https://ryan-realty.com'

export function SiteActivityVisits({
  visits,
  listings,
  maxPages = 40,
}: {
  visits: ActivityVisit[]
  listings: Record<string, ListingFact>
  /** Cap on pages rendered across all visits (newest first). */
  maxPages?: number
}) {
  let budget = maxPages
  const shown: ActivityVisit[] = []
  for (const v of visits) {
    if (budget <= 0) break
    const pages = v.pages.slice(0, budget)
    budget -= pages.length
    shown.push({ ...v, pages })
  }
  const total = visits.reduce((n, v) => n + v.pages.length, 0)
  const hidden = total - shown.reduce((n, v) => n + v.pages.length, 0)

  if (shown.length === 0) {
    return (
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
        No page views in this window.
      </p>
    )
  }

  return (
    <ol className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {shown.map((v) => (
        <li key={`${v.sessionId}:${v.startedAt}`}>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
            <span className="tabular-nums">{formatDateTime(v.startedAt)}</span> · {v.source} ·{' '}
            {v.pages.length} {v.pages.length === 1 ? 'page' : 'pages'}
          </p>
          <ul className="space-y-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {v.pages.map((p) => {
              const fact = p.listingMls ? listings[p.listingMls] : undefined
              return (
                <li
                  key={`${p.at}:${p.path}`}
                  className="flex flex-wrap items-baseline gap-x-2"
                  style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}
                >
                  <a
                    href={`${SITE}${p.path}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--a-accent)' }}
                  >
                    {fact?.address ? `${fact.address}${fact.city ? `, ${fact.city}` : ''}` : p.title}
                  </a>
                  {fact ? (
                    <span style={{ color: 'var(--a-text-2)' }}>
                      <span className="tabular-nums">{formatPrice(fact.listPrice)}</span>
                      {fact.status ? ` · ${fact.status}` : ''} ·{' '}
                      <span style={{ fontFamily: 'var(--a-font-mono)' }}>MLS {fact.mls}</span>
                    </span>
                  ) : p.listingMls ? (
                    <span style={{ color: 'var(--a-text-2)', fontFamily: 'var(--a-font-mono)' }}>MLS {p.listingMls}</span>
                  ) : null}
                  <span className="tabular-nums" style={{ color: 'var(--a-text-2)', marginLeft: 'auto' }}>
                    {formatSecondsOnPage(p.secondsOnPage)}
                  </span>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
      {hidden > 0 ? (
        <li style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {hidden} earlier {hidden === 1 ? 'page' : 'pages'} not shown.
        </li>
      ) : null}
    </ol>
  )
}
