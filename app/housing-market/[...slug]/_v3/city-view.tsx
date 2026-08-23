/**
 * City-scope body for /housing-market/<city>.
 *
 * Rhythm: Instrument (live figures + closed period snapshots + chart), Ledger,
 * Quiet, Sheet, Quiet. The monthly median series is Instrument.chart (D9).
 * Not a seventh pattern. Do not flatten that series to a figure.
 *
 * DROPPED from the KB city render: KbHero, KbExploreTowns, KbArticles, FAQBlock,
 * LeadCaptureBlock, KbSell, KbFooter, SmoothScrollProvider, MarketSources,
 * KbMarketHud, KbMarketChart, KbTimeframeStats. Tabbed YTD / month / 12-month
 * UI is gone. Those period medians sit on the Instrument. The year overlay is
 * the chart (newest three years the atom can distinguish).
 */

import type { ReactNode } from 'react'
import type { BlogPostCard, MarketPulse, MarketPulseSnapshot } from '@/lib/data'
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
  buildExploreItems,
  buildFaqItems,
  buildLiveFigures,
  buildPublicPaceFigures,
  buildPublicSegmentFigures,
} from './geo-figures'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'

type Props = {
  cityName: string
  citySlug: string
  pulse: MarketPulse | null
  mosText: string | null
  verdict: { kind: MarketKind; label: string }
  refreshedAt: string | null
  valuationHrefValue: string
  snapshots: MarketPulseSnapshot[]
  faqs: ReadonlyArray<{ question: string; answer: string }>
  posts: readonly BlogPostCard[]
  closedFigures: readonly V3InstrumentFigure[]
  closedTrace: string | null
  chart?: V3ChartProps
  sheet: ReactNode
  publicSegments?: readonly PublicSegmentRow[]
  publicPace?: PublicPaceRow | null
}

export function CityMarketView({
  cityName,
  citySlug,
  pulse,
  mosText,
  verdict,
  refreshedAt,
  valuationHrefValue,
  snapshots,
  faqs,
  posts,
  closedFigures,
  closedTrace,
  chart,
  sheet,
  publicSegments = [],
  publicPace = null,
}: Props) {
  const live = buildLiveFigures(pulse, mosText, cityName)
  const segmentFigures = buildPublicSegmentFigures(publicSegments, citySlug)
  const paceFigures = buildPublicPaceFigures(publicPace)
  const figures = [...live.figures, ...segmentFigures, ...paceFigures, ...closedFigures]
  const [firstFigure, ...restFigures] = figures
  const cityLedger = buildCityLedger(snapshots, citySlug)
  const [firstCityRow, ...restCityRows] = cityLedger.rows
  const faqItems = buildFaqItems(faqs, [
    { label: 'Closed sales explorer', href: '/housing-market/history' },
    { label: 'Months of supply', href: '/months-of-supply' },
  ])
  const exploreItems = buildExploreItems({
    valuationHrefValue,
    citySlug,
    cityName,
    communityName: null,
    footnotes: cityLedger.footnotes,
    posts,
  })

  const headline =
    verdict.kind === 'unknown'
      ? `${cityName} housing market`
      : `${cityName} housing market: a ${verdict.label}`

  const traceParts = [
    live.figures.length > 0 ? live.trace.replace(/\.$/, '') : null,
    segmentFigures.length > 0
      ? 'condo and townhome counts are Market Truth mt-v1, sample-gated, not the detached HUD'
      : null,
    paceFigures.length > 0
      ? 'leftover pace stats are Market Truth mt-v1, labeled by window, not the live 30-day pulse'
      : null,
    closedTrace,
  ].filter((part): part is string => Boolean(part))
  const trace =
    traceParts.length > 0 ? `${traceParts.join('. ')}.` : live.trace

  return (
    <>
      {firstFigure ? (
        <V3Instrument
          id="market"
          level={1}
          eyebrow={v3Text(`${cityName}, Oregon`)}
          headline={v3Text(headline)}
          figures={[firstFigure, ...restFigures] as readonly [V3InstrumentFigure, ...V3InstrumentFigure[]]}
          source={v3Text(trace)}
          updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
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
          heading={`${cityName} housing market`}
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              term: 'No live figures right now',
              body: `The ${cityName} market row did not return on this refresh, so this page is not printing a median, an inventory count, or a verdict.`,
            },
          ]}
        />
      )}

      {firstCityRow ? (
        <V3Ledger
          id="cities"
          eyebrow={v3Text('Central Oregon')}
          heading={v3Text('Other Central Oregon cities')}
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
          heading={v3Text('Other Central Oregon cities')}
          rows={[]}
          emptyMessage={v3Text('No other city returned a live single-family market row on this refresh.')}
          action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
        />
      )}

      <V3Quiet
        id="faq"
        eyebrow="Common questions"
        heading={`${cityName} real estate questions`}
        items={faqItems}
      />

      {sheet}

      <V3Quiet
        id="explore"
        eyebrow="More resources"
        heading={`Explore ${cityName} real estate`}
        items={exploreItems}
      />
    </>
  )
}
