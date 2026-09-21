'use client'

/**
 * shadcn Table on /invest — one live listing inventory (photo, price, address, facts).
 * Source: components/ui/table. Hover and selected state stay; paint is navy/cream.
 * SITE-168: this is the only priced-address list. Type doors stay on V3Ledger.
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

function listingAriaName(row: InvestListingRow, facts: string): string {
  return [row.price, row.address, row.city, facts].filter(Boolean).join(', ')
}

function glyphOf(address: string): string {
  const letter = address.trim().match(/\p{L}/u)?.[0]
  return (letter ?? address.trim().charAt(0) ?? '?').toUpperCase()
}

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
            Photograph, price, address, and the type plus rooms or acres the feed published. Open a
            row for the listing.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((row) => {
                const open = picked === row.listingKey
                const facts = investListingFacts(row)
                const meta = [row.city, facts].filter(Boolean).join(' · ')
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
                    <TableCell className="whitespace-normal">
                      <Link
                        className="invest-tables__home"
                        href={row.href}
                        aria-label={listingAriaName(row, facts)}
                      >
                        {row.photoSrc ? (
                          // Spark MLS URLs and owned files in one column; skip next/image.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="invest-tables__media"
                            src={row.photoSrc}
                            alt={row.photoAlt}
                            width={88}
                            height={66}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="invest-tables__media invest-tables__glyph" aria-hidden="true">
                            {glyphOf(row.address)}
                          </span>
                        )}
                        <span className="invest-tables__price tabular-nums">{row.price}</span>
                        <span className="invest-tables__address">{row.address}</span>
                        {meta ? <span className="invest-tables__meta">{meta}</span> : null}
                      </Link>
                    </TableCell>
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
