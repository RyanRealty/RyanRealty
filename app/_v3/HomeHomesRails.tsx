/**
 * The homepage's live homes, each shelf on the listing dial.
 *
 * WHAT IT WAS. Stacked Zillow-style house carousels (SITE-83), one per shelf:
 * the Bend-area actives, and the price cuts and new listings when there are
 * three honest cards for them. No inventory-count lecture under the heading
 * (Matt 2026-09-15).
 *
 * WHAT IT IS (Matt 2026-09-24, "Let's get all of those carousels in place").
 * Every shelf is a V3ListingDial: one home large with its photograph and the
 * card's copy, the rest of the shelf as thumbnails on the dial's rail, "03 /
 * 12" at its head, and the shelf's see-all door under it. The shelves
 * themselves are unchanged: the same rows from homeRailRows, the same cards in
 * the same order under the same headings, the same doors (CLAUDE.md section
 * 0: only the presentation moved). Each dial keeps its shelf's id, so
 * #homes-local, #homes-price-cuts and #homes-new still land where they did.
 *
 * ADJACENT DIALS DIFFER (Matt 2026-09-24). Stacked shelves are adjacent
 * sections, and PUBLIC_UI.md's rhythm rule refuses two adjacent sections that
 * read as one object. So each dial takes its rail position by its order on the
 * page (dialRailPositionAt: bottom, left, right): the first shelf's thumbnails
 * lie under its card, the second's stand to the left, the third's to the
 * right. `railOffset` is the number of dials a page mounts above these, so the
 * cycle runs on across the whole page (/buy's lead shelf is its first dial).
 *
 * `layout="rails"` HOLDS THE CAROUSELS (Matt 2026-09-25, "fix first, then
 * ship"): the stacked HomeListingRail carousels exactly as they shipped before
 * the dial, for a page whose class is still below its taste mark with the
 * dial (the homepage and the /cities index). The default is the dial.
 */
import { cn } from '@/lib/utils'
import {
  V3_ROOT_CLASS,
  V3Button,
  V3ListingDial,
  dialRailPositionAt,
  type V3ListingDialItem,
} from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { HomeListingRail } from './HomeListingRail.client'
import { listingRowFromRailCard, type HomeRailRow } from './home-rail-items'
import './home-homes-rails.css'
import './home-shelves.css'

/** The cut's percent as the drop badge prints it ("(−0.7%)"), or null. */
function badgeCutPct(card: HomeRailRow['cards'][number]): string | null {
  const label = card.badges.find((b) => b.kind === 'drop')?.label ?? ''
  return /\(([−-][\d.]+%)\)/.exec(label)?.[1] ?? null
}

/**
 * The price-cuts shelf draws each cut as the dial's own mark (2026-09-25:
 * three shelves of one shape): the earlier ask, the percent the drop badge
 * prints, and a track against the deepest cut on the shelf, in place of the
 * badge on the photograph. Every other shelf keeps its rows as they are.
 */
function shelfListings(row: HomeRailRow): V3ListingDialItem[] {
  const rows = row.cards.map(listingRowFromRailCard)
  if (row.id !== 'homes-price-cuts') return rows
  const pcts = row.cards.map(badgeCutPct)
  const deepest = Math.max(0, ...pcts.map((p) => (p ? Math.abs(parseFloat(p.replace('−', '-'))) : 0)))
  return rows.map((listing, i) => {
    const card = row.cards[i]!
    const pct = pcts[i]
    if (!pct) return listing
    const size = Math.abs(parseFloat(pct.replace('−', '-')))
    const was = card.cutWas != null && card.cutWas > 0 ? formatPrice(card.cutWas) : null
    return {
      ...listing,
      badges: (listing.badges ?? []).filter((b) => b.kind !== 'drop'),
      cut: { was: was && /\$/.test(was) ? was : null, pct, share: deepest > 0 ? size / deepest : null },
    }
  })
}

function HomeShelf({ row, order }: { row: HomeRailRow; order: number }) {
  return (
    <div className="home-shelf">
      <V3ListingDial
        id={row.id}
        heading={row.heading}
        headingLevel={2}
        countLabel={row.countLabel ?? null}
        label={row.heading}
        listings={shelfListings(row)}
        railPosition={dialRailPositionAt(order)}
        className="home-shelf__dial"
      />
      {row.seeAll ? (
        <p className="home-shelf__more">
          <V3Button href={row.seeAll.href} variant="ghost">
            {row.seeAll.label}
          </V3Button>
        </p>
      ) : null}
    </div>
  )
}

export function HomeHomesRails({
  rows,
  emptyMessage,
  railOffset = 0,
  layout = 'dial',
}: {
  rows: HomeRailRow[]
  emptyMessage: string
  /** Ignored: inventory-count blurbs under rail headings are cut. */
  forSaleCount?: number | null
  /** How many dials the page mounts above these shelves (the rail cycle runs on). */
  railOffset?: number
  /** 'dial' (default): the listing dials. 'rails': the held carousels (header). */
  layout?: 'dial' | 'rails'
}) {
  if (rows.length === 0) {
    return (
      <p className="home-rail home-rail--empty" role="status">
        {emptyMessage}
      </p>
    )
  }

  if (layout === 'rails') {
    return (
      <div className="home-rails">
        {rows.map((row) => (
          <HomeListingRail key={row.id} row={row} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn(V3_ROOT_CLASS, 'home-shelves')}>
      {rows.map((row, i) => (
        <HomeShelf key={row.id} row={row} order={railOffset + i} />
      ))}
    </div>
  )
}
