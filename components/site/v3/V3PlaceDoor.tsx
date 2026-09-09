/**
 * THE PLACE DOOR (site queue SITE-03). A composition of two atoms, not a
 * seventh pattern: V3Button in its filled form carries the claim, and
 * V3SourceDisclosure carries the trace beneath it.
 *
 * WHAT IT SAYS. ONE live fact — how many homes are for sale in the place whose
 * name is in the H1 beside it — at every grain, and nothing else. The whole
 * claim is the door: clicking it lands on that place's own pre-filtered
 * inventory.
 *
 * WHAT IT IS NOT, AND WHY THE TYPE CANNOT EXPRESS IT. It is not a figure strip.
 * The leftover HUD — count / median / verdict / months / days, five numerals in
 * a row above a photograph — is the named slop tell that ci:taste-canon fails
 * (docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md), and the reason this primitive
 * takes ONE count and no median, no months, no days-to-pending is that a strip
 * cannot be assembled from what it accepts.
 *
 * NO VERDICT, AT ANY GRAIN (2026-09-08 review). The door briefly carried the
 * city verdict clause beside the count, which put "in a seller's market" one
 * node above .place-opening__caption saying "3.9 months of homes on the market.
 * A seller's market." DATA_GRAPHICS.md puts the verdict in exactly ONE place and
 * that place is the caption, so the prop is gone rather than optional — a
 * primitive that cannot accept a second figure cannot grow one later. Months of
 * supply, the verdict and days-to-pending are separately unpublishable below
 * city grain (lib/market/geo-grain-trust.ts, measured).
 *
 * Every figure arrives PREFORMATTED (ci:public-v3 rule 3): the count and the
 * freshness stamp are strings the caller already built through lib/format and
 * lib/market, so the number on screen is the number the caller's section 0
 * trace covers.
 *
 * Visual language: design_system/public/PUBLIC_UI.md, built on ./tokens.css.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3SourceDisclosure } from './atoms'
import './tokens.css'
import './V3PlaceDoor.css'

export type V3PlaceDoorProps = {
  /** The place's own pre-filtered inventory path, already published. */
  href: string
  /** The live active count, preformatted ("664", "1,204"). */
  count: string
  /** What the count counts, preformatted and type-scoped ("detached homes for sale"). */
  countLabel: string
  /**
   * The freshness stamp, PREFORMATTED by the caller through lib/format/date and
   * joined to the trace here as "· updated <date>" — the one freshness idiom on
   * the site (V3Instrument, V3Ledger, V3Atlas all print it exactly this way).
   * It is not a raw date and it is not a chip of its own: the door had an
   * uppercase "READ SEP 7" stamp on its own line, a third idiom for one thing.
   */
  updated?: string | null
  /** The section 0 trace for the count. Collapsed behind "Source". */
  trace: string
  /** Inverts the quiet lines for use over the place opening's photograph. */
  onMedia?: boolean
  id?: string
  className?: string
}

function IconArrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M3.5 10h12m-4.5-5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function V3PlaceDoor({
  href,
  count,
  countLabel,
  updated,
  trace,
  onMedia,
  id,
  className,
}: V3PlaceDoorProps) {
  // Two already-formatted strings, joined the way V3Instrument and V3Ledger join
  // them. Nothing here parses or formats a date.
  const stamp = updated?.trim() ? updated.trim() : null
  const source = stamp ? `${trace} · updated ${stamp}` : trace

  return (
    <div
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-place-door',
        onMedia && 'v3-place-door--on-media',
        className,
      )}
    >
      <V3Button href={href} variant="primary" className="v3-place-door__door">
        <span className="v3-place-door__count">{count}</span>
        <span className="v3-place-door__claim">{countLabel}</span>
        <span className="v3-place-door__arrow">
          <IconArrow />
        </span>
      </V3Button>
      {/* The trace is a native disclosure, so it lives OUTSIDE the anchor:
          interactive content may not nest inside a link. */}
      <div className="v3-place-door__foot">
        <V3SourceDisclosure source={source} className="v3-place-door__source" />
      </div>
    </div>
  )
}
