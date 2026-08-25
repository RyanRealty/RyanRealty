/**
 * Community-scope body for /housing-market/<city>/<community>.
 *
 * Rhythm: Instrument (live pulse plus closed-sales cache fields plus chart),
 * Ledger, Quiet, Sheet, Quiet. The 12-month median sale series is
 * Instrument.chart (D9). Do not flatten it to a figure.
 *
 * DROPPED from the legacy wave-2 render: PageBreadcrumb, HeroBlock,
 * MarketSnapshot, MarketDetailStats, PriceBandTable (items=[] stub),
 * CityComparisonTable, ContentSection, FAQBlock, LeadCaptureBlock,
 * RelatedAreas, CTABar, SiteFooter, DisplayHeading, buildNarrative,
 * PriceChart. Closed-sales fields from the monthly cache row surface as
 * Instrument figures when present. marketHealthLabel is not printed.
 */

import type { ReactNode } from 'react'
import type { MarketDetail, MarketPulseSnapshot } from '@/lib/data'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { formatDate } from '@/lib/format/date'
import {
  v3Text,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  type V3ChartProps,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import type { MarketKind } from '@/lib/market/classify'
import {
  buildCityLedger,
  buildClosedFigures,
  buildExploreItems,
  buildFaqItems,
  buildLiveFigures,
  closedTrace,
} from './geo-figures'

type Props = {
  geoName: string
  cityName: string
  citySlug: string
  hud: LeftoverHudKpis | null
  mosText: string | null
  verdict: { kind: MarketKind; label: string }
  refreshedAt: string | null
  valuationHrefValue: string
  detail: MarketDetail | null
  lastComplete?: MarketDetail | null
  currentMonthKey?: string
  snapshots: MarketPulseSnapshot[]
  faqs: ReadonlyArray<{ question: string; answer: string }>
  chart?: V3ChartProps
  sheet: ReactNode
}

export function CommunityMarketView({
  geoName,
  cityName,
  citySlug,
  hud,
  mosText,
  verdict,
  refreshedAt,
  valuationHrefValue,
  detail,
  lastComplete,
  currentMonthKey,
  snapshots,
  faqs,
  chart,
  sheet,
}: Props) {
  const live = buildLiveFigures(hud, mosText, geoName)
  const closed = buildClosedFigures(detail, lastComplete, currentMonthKey)
  const figures = [...live.figures, ...closed]
  const [firstFigure, ...restFigures] = figures
  const closedLine = closedTrace(geoName, closed)
  const traceParts = [live.figures.length > 0 ? live.trace.replace(/\.$/, '') : null, closedLine].filter(
    (part): part is string => Boolean(part),
  )
  const trace =
    traceParts.length > 0 ? `${traceParts.join('. ')}.` : live.trace

  const cityLedger = buildCityLedger(snapshots, citySlug)
  const [firstCityRow, ...restCityRows] = cityLedger.rows
  const faqItems = buildFaqItems(faqs, [
    {
      kind: 'prose',
      term: 'How these numbers are built',
      body: 'Active inventory is the live single-family row. Closed-sale figures are the current month when that median is published, otherwise the last complete month.',
    },
  ])
  const exploreItems = buildExploreItems({
    valuationHrefValue,
    citySlug,
    cityName,
    communityName: geoName,
    footnotes: cityLedger.footnotes,
    posts: [],
  })

  const headline =
    verdict.kind === 'unknown' ? `${geoName} housing market` : `${geoName} housing market: a ${verdict.label}`

  return (
    <>
      {firstFigure ? (
        <V3Instrument
          id="market"
          level={1}
          eyebrow={v3Text(`${geoName}, Oregon`)}
          headline={v3Text(headline)}
          figures={[firstFigure, ...restFigures] as readonly [V3InstrumentFigure, ...V3InstrumentFigure[]]}
          source={v3Text(trace)}
          updated={
            live.figures.length > 0 && closed.length === 0 && refreshedAt
              ? v3Text(formatDate(refreshedAt))
              : live.figures.length === 0 && closed.length > 0 && detail?.updatedAt
                ? v3Text(formatDate(detail.updatedAt))
                : undefined
          }
          action={{
            label: v3Text('Value my home'),
            href: valuationHrefValue,
            variant: 'primary',
          }}
          chart={chart}
        />
      ) : (
        <V3Quiet
          id="market"
          heading={`${geoName} housing market`}
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              term: 'No live figures right now',
              body: `The ${geoName} market row did not return on this refresh, so this page is not printing a median, an inventory count, or a verdict.`,
            },
          ]}
        />
      )}

      {firstCityRow ? (
        <V3Ledger
          id="cities"
          eyebrow={v3Text('Central Oregon')}
          heading={v3Text(`How ${geoName} compares`)}
          rows={[firstCityRow, ...restCityRows]}
          source={v3Text(
            'live MLS through Oregon Data Share, one row per city. The count and the median list price are active single-family listings. Days to pending is the median list-to-pending time of single-family homes that closed in the last 90 days',
          )}
          updated={cityLedger.stamp ? v3Text(formatDate(cityLedger.stamp)) : undefined}
          action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
        />
      ) : (
        <V3Ledger
          id="cities"
          eyebrow={v3Text('Central Oregon')}
          heading={v3Text(`How ${geoName} compares`)}
          rows={[]}
          emptyMessage={v3Text('No city returned a live single-family market row on this refresh.')}
          action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
        />
      )}

      <V3Quiet
        id="faq"
        eyebrow="Common questions"
        heading={`${geoName} real estate questions`}
        items={faqItems}
      />

      {sheet}

      <V3Quiet
        id="explore"
        eyebrow="More resources"
        heading={`Explore ${geoName} real estate`}
        items={exploreItems}
      />
    </>
  )
}
