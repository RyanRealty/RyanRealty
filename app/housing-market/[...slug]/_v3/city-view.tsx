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
import type { BlogPostCard, MarketPulseSnapshot } from '@/lib/data'
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
  buildExploreItems,
  buildFaqItems,
  buildLiveFigures,
  buildPublicMixFigures,
  buildPublicPaceFigures,
  buildPublicSegmentFigures,
} from './geo-figures'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { PublicMixRow } from '@/lib/data/market-truth/public-mix'

type Props = {
  cityName: string
  citySlug: string
  hud: LeftoverHudKpis | null
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
  publicMix?: PublicMixRow | null
}

export function CityMarketView({
  cityName,
  citySlug,
  hud,
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
  publicMix = null,
}: Props) {
  const live = buildLiveFigures(hud, mosText, cityName)
  const segmentFigures = buildPublicSegmentFigures(publicSegments, citySlug)
  const paceFigures = buildPublicPaceFigures(publicPace)
  const mixFigures = buildPublicMixFigures(publicMix)
  // ONE FIGURE PER LABEL (2026-08-27 audit): pace and mix both read the
  // finance cells, so "cash closes" printed twice in this run. First mount wins.
  const figures = [...live.figures, ...segmentFigures, ...paceFigures, ...mixFigures, ...closedFigures].filter(
    (f, i, arr) => arr.findIndex((g) => String(g.label) === String(f.label)) === i,
  )
  const [firstFigure, ...restFigures] = figures
  const cityLedger = buildCityLedger(snapshots, citySlug)
  const [firstCityRow, ...restCityRows] = cityLedger.rows
  const faqItems = buildFaqItems(faqs, [
    { label: 'Closed sales explorer', href: '/housing-market/history' },
    { label: 'Months of supply', href: '/months-of-supply' },
  ])
  // No valuation door (2026-08-27 single-ask consolidation, parity.json
  // market-report-detail openDefects: "Two asks render, the 3-step form and Value my
  // home"). sheet (GeoInquirySheet, the on-page inquiry form the reader fills out
  // without leaving the page) is the strongest of the two and is now the page's one
  // ask, so both the Instrument's former "Value my home" primary and this Quiet's own
  // "Value my home" edge are dropped rather than left pointing at the same
  // destination as a form already on the page. buildExploreItems is shared with
  // CommunityMarketView, which is out of scope here, so the edge is filtered out
  // locally instead of removed from the shared builder.
  const exploreItems = buildExploreItems({
    valuationHrefValue,
    citySlug,
    cityName,
    communityName: null,
    footnotes: cityLedger.footnotes,
    posts,
  }).filter((item) => !('label' in item && item.label === 'Value my home'))

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
    mixFigures.length > 0
      ? 'feature shares other than garage are Market Truth floors labeled at least'
      : null,
    closedTrace,
  ].filter((part): part is string => Boolean(part))
  const trace =
    traceParts.length > 0 ? `${traceParts.join('. ')}.` : live.trace

  return (
    <>
      {/* No action (2026-08-27 single-ask consolidation, parity.json
          market-report-detail openDefects): sheet below is the page's one ask. */}
      {firstFigure ? (
        <V3Instrument
          id="market"
          level={1}
          eyebrow={v3Text(`${cityName}, Oregon`)}
          headline={v3Text(headline)}
          figures={[firstFigure, ...restFigures] as readonly [V3InstrumentFigure, ...V3InstrumentFigure[]]}
          /* First viewport is the verdict + chart, not the leftover KPI wall.
             Pace, mix, extra-type, and closed-period tiles fold the way city
             place pages fold the long tail. */
          foldAfter={2}
          source={v3Text(trace)}
          updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
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
