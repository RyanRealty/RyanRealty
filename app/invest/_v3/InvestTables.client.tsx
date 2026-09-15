'use client'

/**
 * shadcn Table on /invest — segment trades + live listing inventory.
 * Source: components/ui/table. Hover and selected state stay; paint is navy/cream.
 */
import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { investListingFacts, type InvestListingRow } from './invest-listings'
import type { InvestSegmentTableRow } from './invest-table'
import './invest-table.css'

export function InvestTables({
  segments,
  listings,
  source,
}: {
  segments: readonly InvestSegmentTableRow[]
  listings: readonly InvestListingRow[]
  source: string
}) {
  const [selected, setSelected] = useState<string | null>(segments[0]?.key ?? null)
  const [picked, setPicked] = useState<string | null>(listings[0]?.listingKey ?? null)

  if (segments.length === 0 && listings.length === 0) return null

  return (
    <div className={`${V3_ROOT_CLASS} invest-tables`}>
      <div className="invest-tables__inner">
        {segments.length > 0 ? (
          <section id="searches-table" className="invest-tables__block" aria-labelledby="invest-types-h">
            <h2 id="invest-types-h" className="invest-tables__heading">
              How each type trades
            </h2>
            <p className="invest-tables__lede">
              Tap a row for the rest of the published pace. For-sale counts are the same numbers as the chart.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>For sale</TableHead>
                  <TableHead>How it trades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((row) => {
                  const open = selected === row.key
                  return (
                    <TableRow
                      key={row.key}
                      data-invest-row={row.key}
                      data-state={open ? 'selected' : undefined}
                      tabIndex={0}
                      onClick={() => setSelected(row.key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelected(row.key)
                        }
                      }}
                    >
                      <TableCell>
                        <Link className="invest-tables__link" href={row.href}>
                          {row.type}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{row.count}</TableCell>
                      <TableCell>
                        {row.trades}
                        {open && row.extra ? <p className="invest-tables__extra">{row.extra}</p> : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableCaption>{source}</TableCaption>
            </Table>
          </section>
        ) : null}

        {listings.length > 0 ? (
          <section id="listings" className="invest-tables__block" aria-labelledby="invest-homes-h">
            <h2 id="invest-homes-h" className="invest-tables__heading">
              Income properties for sale now
            </h2>
            <p className="invest-tables__lede">
              Price, address, and the rooms or acres the feed published. Open a row for the listing.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Facts</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((row) => {
                  const open = picked === row.listingKey
                  const facts = investListingFacts(row)
                  return (
                    <TableRow
                      key={row.listingKey}
                      data-state={open ? 'selected' : undefined}
                      onClick={() => setPicked(row.listingKey)}
                    >
                      <TableCell>
                        <Link className="invest-tables__link" href={row.href}>
                          {row.address}
                          <span className="invest-tables__facts"> · {row.city}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{row.price}</TableCell>
                      <TableCell className="invest-tables__facts">{facts || '—'}</TableCell>
                      <TableCell>{row.typeLabel}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableCaption>
                Live regional MLS inventory. A listing without a published price or street is not in this table.
              </TableCaption>
            </Table>
          </section>
        ) : null}
      </div>
    </div>
  )
}
