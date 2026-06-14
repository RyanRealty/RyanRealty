/**
 * HomepageV6Ledger — neighborhood ledger with verified stats + source line
 * (v6 LOCKED bones, Linear finish).
 *
 * Rows come from getBendNeighborhoodLedger (listing_tile_mv grouped by the
 * polygon-assigned boundary_neighborhood, SFR-only, hourly MV refresh).
 * Neighborhoods with zero active inventory are omitted upstream — honest
 * empty, no dash-fill. The section hides entirely when no rows resolve.
 */

import Link from 'next/link'
import type { NeighborhoodLedgerRow } from '@/lib/data/geo/getBendNeighborhoodLedger'

type Props = {
  rows: NeighborhoodLedgerRow[]
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default function HomepageV6Ledger({ rows }: Props) {
  return (
    <section className="v6-proof">
      <div className="v6-proof-copy">
        {/* v6 LOCKED: one Amboqia moment (hero H1) — section headings stay Geist. */}
        {/* heading-display-ok */}
        <h2>Ask about a street. Get the whole story.</h2>
        <p>
          Median list and active inventory for every neighborhood, drawn from the boundary up.
          Same numbers we use to price a listing, sources shown.
        </p>
      </div>
      {rows.length > 0 && (
        <div className="v6-ledger">
          <div className="v6-ledger-head">
            <span className="v6-label">Bend neighborhoods</span>
            <span className="v6-updated v6-tnum">Single-family · refreshed hourly</span>
          </div>
          {rows.map((r) => (
            <Link key={r.href} href={r.href} className="v6-ledger-row v6-tnum">
              <span className="v6-name">{r.label}</span>
              <span className="v6-val">
                {r.medianListPrice != null ? `${fmtPrice(r.medianListPrice)} · ` : ''}
                {r.activeCount} active
              </span>
            </Link>
          ))}
          <div className="v6-ledger-foot">listing_tile_mv · neighborhood boundaries · live MLS feed</div>
        </div>
      )}
    </section>
  )
}
