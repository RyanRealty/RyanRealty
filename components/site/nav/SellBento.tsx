import Link from 'next/link'
import type { MegaMenuSell } from '@/lib/data'
import { Price } from '@/components/site/primitives'
import { Tile, Stat, PanelHeading, PanelLink, VerdictPill } from './megaShared'

/**
 * SellBento — the Sell panel. A valuation call-to-action tile, a region median
 * stat, a market verdict pill, and the seller link column. The median and verdict
 * are null-guarded; the valuation CTA and links always render.
 */

const SELL_LINKS = [
  { href: '/sell', label: 'How selling works' },
  { href: '/sell/valuation', label: 'Get a free valuation' },
  { href: '/our-homes', label: 'Our current listings' },
]

export function SellBento({ data }: { data: MegaMenuSell }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Valuation CTA tile */}
      <Tile className="flex flex-col justify-between gap-4 bg-primary lg:col-span-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground/80">
            Thinking about selling
          </p>
          <p className="mt-2 font-display text-2xl leading-tight tracking-[-0.01em] text-primary-foreground">
            See what your home is worth today
          </p>
          <p className="mt-2 text-[13px] leading-[1.55] text-primary-foreground/90">
            A no pressure valuation from a local team that knows your market.
          </p>
        </div>
        <Link
          href={data.valuationHref}
          className="inline-flex h-11 w-fit items-center justify-center rounded-[10px] bg-card px-5 text-sm font-semibold text-primary transition hover:bg-card/90"
        >
          Get a free valuation
        </Link>
      </Tile>

      {/* Region figures */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4">
        <Tile>
          <Stat
            label="Median list price across Central Oregon"
            value={data.medianListPrice != null ? <Price value={data.medianListPrice} /> : null}
          />
        </Tile>
        <Tile className="flex flex-col gap-2">
          {data.marketVerdict != null ? (
            <>
              <p className="text-[13px] leading-[1.55] text-muted-foreground">
                Today the region is a
              </p>
              <VerdictPill verdict={data.marketVerdict} />
            </>
          ) : (
            <p className="text-[13px] leading-[1.55] text-muted-foreground">
              We track local supply and demand so your price reflects the market.
            </p>
          )}
        </Tile>
      </div>

      {/* Links column */}
      <div className="lg:col-span-3">
        <PanelHeading>Selling with us</PanelHeading>
        <ul className="mt-2 space-y-0.5">
          {SELL_LINKS.map((link) => (
            <li key={link.href}>
              <PanelLink href={link.href} strong={link.href === '/sell/valuation'}>
                {link.label}
              </PanelLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
