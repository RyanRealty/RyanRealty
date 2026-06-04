import Link from 'next/link'
import type { MegaMenuMarket } from '@/lib/data'
import { Price, TabularNumber, DaysCount } from '@/components/site/primitives'
import {
  Tile,
  Stat,
  PanelHeading,
  PanelLink,
  VerdictPill,
  YoyTrend,
  Sparkline,
} from './megaShared'

/**
 * MarketBento — the Market panel. A verdict pill + a 12-point price sparkline in
 * the lead tile, a row of region stat tiles (median, months of supply, days on
 * market, year-over-year trend), and a links column. Every stat is null-guarded,
 * and the verdict pill only appears when months of supply is known so the pill
 * can never disagree with the number it sits beside.
 */

const MARKET_LINKS = [
  { href: '/housing-market', label: 'Market overview' },
  { href: '/housing-market/reports', label: 'Market reports' },
  { href: '/reports/explore', label: 'Explore reports' },
  { href: '/activity', label: 'Recent activity' },
]

export function MarketBento({ data }: { data: MegaMenuMarket }) {
  const sparkValues = data.sparkline
    .map((p) => p.medianSalePrice)
    .filter((v): v is number => v != null)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Lead tile — verdict + sparkline */}
      <Tile className="flex flex-col justify-between gap-4 lg:col-span-5">
        <div>
          <PanelHeading>Central Oregon market</PanelHeading>
          {data.marketVerdict != null && (
            <div className="mt-3">
              <VerdictPill verdict={data.marketVerdict} />
            </div>
          )}
          <div className="mt-3">
            <YoyTrend pct={data.yoyPct} />
          </div>
        </div>
        {sparkValues.length >= 2 && (
          <div>
            <Sparkline values={sparkValues} />
            <p className="mt-2 text-xs leading-[1.5] text-muted-foreground">
              Median sale price, last 12 months
            </p>
          </div>
        )}
      </Tile>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-5 lg:col-span-4">
        <Tile>
          <Stat label="Median list price" value={data.medianListPrice != null ? <Price value={data.medianListPrice} /> : null} />
        </Tile>
        <Tile>
          <Stat
            label="Months of supply"
            value={
              data.monthsOfSupply != null ? (
                <TabularNumber value={data.monthsOfSupply} fractionDigits={1} />
              ) : null
            }
          />
        </Tile>
        <Tile>
          <Stat
            label="Days on market"
            value={data.avgDaysOnMarket != null ? <DaysCount value={data.avgDaysOnMarket} /> : null}
          />
        </Tile>
        <Tile className="flex items-center">
          <Link
            href="/housing-market"
            className="text-sm font-semibold text-primary transition hover:text-primary/80"
          >
            Full market report &rarr;
          </Link>
        </Tile>
      </div>

      {/* Links column */}
      <div className="lg:col-span-3">
        <PanelHeading>Explore the data</PanelHeading>
        <ul className="mt-2 space-y-0.5">
          {MARKET_LINKS.map((link) => (
            <li key={link.href}>
              <PanelLink href={link.href}>{link.label}</PanelLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
