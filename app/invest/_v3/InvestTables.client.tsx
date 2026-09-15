'use client'

/**
 * shadcn Table on /invest — live listing inventory (price, address, facts).
 * Source: components/ui/table. The type board that restated the chart is gone.
 * Hover and selected state stay; paint is navy/cream.
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
import './invest-table.css'

export function InvestTables({
  listings,
  source,
}: {
  listings: readonly InvestListingRow[]
  source: string
}) {
  const [picked, setPicked] = useState<string | null>(listings[0]?.listingKey ?? null)

  if (listings.length === 0) return null

  return (
    <div className={`${V3_ROOT_CLASS} invest-tables`}>
      <div className="invest-tables__inner">
        <section id="searches-table" className="invest-tables__block" aria-labelledby="invest-homes-h">
          <h2 id="invest-homes-h" className="invest-tables__heading">
            Income properties for sale now
          </h2>
          <p className="invest-tables__lede">
            Price, address, and the type plus rooms or acres the feed published. Open a row for the listing.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Facts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((row) => {
                const open = picked === row.listingKey
                const facts = investListingFacts(row)
                return (
                  <TableRow
                    key={row.listingKey}
                    data-invest-row={row.listingKey}
                    data-state={open ? 'selected' : undefined}
                    tabIndex={0}
                    onClick={() => setPicked(row.listingKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setPicked(row.listingKey)
                      }
                    }}
                  >
                    <TableCell>
                      <Link className="invest-tables__link" href={row.href}>
                        {row.address}
                        <span className="invest-tables__facts"> · {row.city}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{row.price}</TableCell>
                    <TableCell className="invest-tables__facts">{facts || '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableCaption>{source}</TableCaption>
          </Table>
        </section>
      </div>
    </div>
  )
}
