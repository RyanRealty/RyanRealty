'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/tracking'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import type { Under500kTownRow } from './data'
import { CELL_UNPUBLISHED, SHARED_OWNERSHIP_TIP } from './constants'

function moneyLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return CELL_UNPUBLISHED
  if (n >= 740_000 && n <= 750_000) return CELL_UNPUBLISHED
  const label = formatPriceExact(n)
  return label === '—' ? CELL_UNPUBLISHED : label
}

function daysLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return CELL_UNPUBLISHED
  return formatCount(n) || CELL_UNPUBLISHED
}

type SortKey =
  | 'name'
  | 'residential'
  | 'sfr'
  | 'condoTownhome'
  | 'manufacturedOnLand'
  | 'sharedOrLeased'
  | 'sfrMedianList'
  | 'daysToOffer90'

type SortDir = 'asc' | 'desc'

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean; tip?: string }> = [
  { key: 'name', label: 'Town', numeric: false },
  { key: 'residential', label: 'Residential under $500K', numeric: true },
  { key: 'sfr', label: 'Single-family houses', numeric: true },
  { key: 'condoTownhome', label: 'Condo / townhome', numeric: true },
  { key: 'manufacturedOnLand', label: 'Manufactured on land', numeric: true },
  {
    key: 'sharedOrLeased',
    label: 'Shared or leased-land',
    numeric: true,
    tip: SHARED_OWNERSHIP_TIP,
  },
  { key: 'sfrMedianList', label: 'Town single-family median list', numeric: true },
  { key: 'daysToOffer90', label: 'Days to an offer, last 90 days', numeric: true },
]

function compareRows(a: Under500kTownRow, b: Under500kTownRow, key: SortKey, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1
  if (key === 'name') return a.name.localeCompare(b.name) * mul
  const av = a[key]
  const bv = b[key]
  const an = typeof av === 'number' && Number.isFinite(av) ? av : dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  const bn = typeof bv === 'number' && Number.isFinite(bv) ? bv : dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  if (an === bn) return a.name.localeCompare(b.name)
  return (an - bn) * mul
}

function trackTown(href: string, name: string, kind: 'listings' | 'market') {
  trackEvent('click_cta', {
    cta: kind === 'listings' ? 'under_500k_town' : 'under_500k_market',
    cta_location: 'compare_table',
    surface: 'buy_under_500k',
    label: name,
    destination: href,
  })
}

function TownCells({ row }: { row: Under500kTownRow }) {
  return (
    <>
      <th scope="row">
        <Link href={row.listingsHref} onClick={() => trackTown(row.listingsHref, row.name, 'listings')}>
          {row.name}
        </Link>
      </th>
      <td>{formatCount(row.residential)}</td>
      <td>{formatCount(row.sfr)}</td>
      <td>{formatCount(row.condoTownhome)}</td>
      <td>{formatCount(row.manufacturedOnLand)}</td>
      <td>
        <abbr title={SHARED_OWNERSHIP_TIP}>{formatCount(row.sharedOrLeased)}</abbr>
      </td>
      <td>{moneyLabel(row.sfrMedianList)}</td>
      <td>{daysLabel(row.daysToOffer90)}</td>
      <td>
        <Link href={row.marketHref} onClick={() => trackTown(row.marketHref, row.name, 'market')}>
          Market
        </Link>
      </td>
    </>
  )
}

export function Under500kTable({
  caption,
  headline,
  footnotes,
}: {
  caption: string
  headline: Under500kTownRow[]
  footnotes: Under500kTownRow[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('residential')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(
    () => [...headline].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [headline, sortKey, sortDir],
  )
  const withheld = useMemo(
    () =>
      [...headline, ...footnotes].some(
        (row) =>
          moneyLabel(row.sfrMedianList) === CELL_UNPUBLISHED ||
          daysLabel(row.daysToOffer90) === CELL_UNPUBLISHED,
      ),
    [headline, footnotes],
  )

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  return (
    <div className="v3-under500-table-wrap">
      <table className="v3-net-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} scope="col" aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="v3-under500-sort" onClick={() => onSort(col.key)}>
                  {col.tip ? <abbr title={col.tip}>{col.label}</abbr> : col.label}
                </button>
              </th>
            ))}
            <th scope="col">Market page</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug}>
              <TownCells row={row} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          {footnotes.map((row) => (
            <tr key={row.slug} className="v3-under500-footnote-row">
              <TownCells row={row} />
            </tr>
          ))}
        </tfoot>
      </table>
      {withheld ? (
        <p className="v3-under500-unpublished">{`A cell that reads ${CELL_UNPUBLISHED} was withheld on this refresh.`}</p>
      ) : null}
    </div>
  )
}
