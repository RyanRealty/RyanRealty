// @no-parity — data-reference surface on the shared KB/site-v2 primitive pattern; no
// bespoke mockup exists at design_system/ryan-realty/ui_kits, so ci:mockup-coverage
// and ci:mockup-parity do not gate this route (both only fire on a directory that
// exists there). See app/housing-market/reports/archive/[city]/page.tsx for the
// precedent (same directive, same reasoning) on a sibling reference surface.
/**
 * /housing-market/annual-review — the citable annual Central Oregon market
 * reference (audit item 20).
 *
 * A dated, methodology-stated, per-figure-traced reference page: Central Oregon
 * region plus each report city, this year's trailing-12-month window against the
 * SAME window one year earlier (never Q1-vs-full-year), the months-of-supply
 * formula printed beside every verdict it produces. This is the page an LLM or a
 * human analyst can cite with a URL and a number, not a page that has to be
 * taken on faith.
 *
 * Route is evergreen (no year in the path or the H1) by design. The underlying
 * window is always "trailing 12 months as of the last cache refresh," so a
 * year-scoped URL would go stale every January or force a new page each year.
 * The page states its own period and refresh timestamp live instead.
 *
 * DATA ACCURACY (CLAUDE.md section 0). Every figure traces to one of two DAL
 * reads, both cache tables per section 7 (never raw listings aggregation):
 *
 *   regionPulse / cityPulse  — market_pulse_live, property_type='A'. Current
 *     live inventory (active count, median list price, months of supply, the
 *     RPC-computed active/(closed_180d/6) figure, verified against
 *     supabase/migrations/20260526140535_refresh_market_pulse_advisory_lock.sql,
 *     the latest refresh_market_pulse() definition). 10-15 min freshness.
 *
 *   regionDetail / cityDetail — market_stats_cache, period_type='rolling_365d'.
 *     Trailing-12-month closed-sales aggregate (median sale price, sold count,
 *     median DOM, avg sale-to-list, median dollars per sqft) plus
 *     yoy_median_price_delta_pct / yoy_dom_change / yoy_ppsf_change_pct,
 *     computed server-side by the SAME cache job as this trailing 365 days
 *     versus the trailing 365 days exactly one year earlier. That is the
 *     apples-to-apples "same window, two years" comparison this page needs, so
 *     the page reads the field rather than re-deriving it and cannot drift
 *     from the cache's own methodology. 6h freshness.
 *
 * REPORT_CITIES (lib/data/geo/report-cities.ts) is the canonical 7-city set.
 * Two documented exceptions, both an honest degrade per section 0 (never a
 * fabricated or misleading number):
 *
 *   - La Pine: market_pulse_live and market_stats_cache key this city's
 *     geo_slug as "la pine" (a literal space), not the "la-pine" hyphen form
 *     REPORT_CITIES uses for its canonical public URL slug. Verified live
 *     2026-08-03 (see the figure trace in the build report). CITY_DB_GEO_SLUG
 *     below resolves the query key only; the public URL slug is untouched.
 *   - Tumalo: 0 real MLS City rows (NON_MLS_CITY_EXEMPTIONS in
 *     lib/data/geo/report-cities.ts, its listings file under City="Bend" by
 *     SubdivisionName). Its market_pulse_live row is a real 0/null structural
 *     stub, not a measured "no inventory." Rendering "0 active in Tumalo"
 *     would be the exact failure class ci:count-degraded-read exists to
 *     catch, so Tumalo is named with its real reason and routed to
 *     /cities/bend instead of given a numeric row.
 *
 * Data ONLY through @/lib/data (G8). The one @/app/actions import is the
 * inbound broker-inquiry form action, not an outbound send (section 1 governs
 * outbound sends, not an inbound contact form a visitor submits).
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { getMarketPulse, getMarketPulseCitySnapshots, getCityMarketDetail } from '@/lib/data'
import { REPORT_CITIES, NON_MLS_CITY_EXEMPTIONS } from '@/lib/data/geo/report-cities'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput, StatValue } from '@/lib/site/json-ld'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import {
  Container,
  Section,
  Stack,
  Eyebrow,
  H1,
  H2,
  Body,
  Caption,
  Price,
  PercentChange,
  TabularNumber,
  DaysCount,
} from '@/components/site/primitives'
import { submitMarketPageInquiry } from '@/app/housing-market/actions'
import '@/components/site/kb/kb.css'

export const revalidate = 300

const CANONICAL_PATH = '/housing-market/annual-review'

/**
 * market_pulse_live / market_stats_cache geo_slug overrides where the DB key
 * does not match REPORT_CITIES' public URL slug. See the file docblock for the
 * verified La Pine case. Every other REPORT_CITIES slug matches its DB
 * geo_slug exactly (verified live alongside La Pine, see the build report).
 */
const CITY_DB_GEO_SLUG: Record<string, string> = {
  'la-pine': 'la pine',
}
const dbGeoSlug = (citySlug: string): string => CITY_DB_GEO_SLUG[citySlug] ?? citySlug

/** Report cities with a real, queryable MLS City. Tumalo is named separately below. */
const GRID_CITIES = REPORT_CITIES.filter((c) => !(c.label in NON_MLS_CITY_EXEMPTIONS))
const NAMED_EXEMPTIONS = REPORT_CITIES.filter((c) => c.label in NON_MLS_CITY_EXEMPTIONS)

/**
 * KPI tile. The KB (kinetic-brutalist) kb.css `.mkt-kpi` pattern, the exact
 * classes KbMarketHud.client.tsx uses for the region/city "market desk" KPI
 * grid on the live report pages (central-oregon, housing-market/[...slug]).
 * This page is already a KB shell (`kb-root` + kb.css import below), so those
 * classes apply here as-is (ci:shadcn-burndown / ci:design-tokens: no
 * @/components/ui/card import, no hand-rolled rounded-2xl+border+bg-card
 * shell, a real KB class instead).
 */
function KpiTile({ val, lbl, sub }: { val: ReactNode; lbl: string; sub?: ReactNode }) {
  return (
    <div className="mkt-kpi">
      <span className="mkt-kpi-val">{val}</span>
      <span className="mkt-kpi-lbl">{lbl}</span>
      {sub != null ? <span className="mkt-kpi-lbl">{sub}</span> : null}
    </div>
  )
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Signed whole-day delta ("+3 days" / "-3 days" / "no change"). Plain hyphen only. */
function formatDayDelta(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'not available'
  const rounded = Math.round(n)
  if (rounded === 0) return 'no change'
  const abs = Math.abs(rounded)
  return `${rounded > 0 ? '+' : '-'}${abs} ${abs === 1 ? 'day' : 'days'}`
}

/** Fraction (0.9522) to one-decimal percent string ("95.2%"). Null-safe. */
function formatRatioPct(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'not available'
  return `${(n * 100).toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Central Oregon housing market annual review',
    description:
      'The citable Central Oregon market reference: active inventory, months of supply, and the trailing 12 months of closed sales against the same window a year earlier, for the region and every report city. Live from Oregon Data Share.',
    path: CANONICAL_PATH,
    keywords: [
      'Central Oregon housing market annual review',
      'Central Oregon real estate market report',
      'Bend Redmond Sisters home sales year over year',
      'Central Oregon months of supply',
      'Oregon real estate market data',
      'Ryan Realty',
    ],
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AnnualReviewPage() {
  // -------------------------------------------------------------------------
  // Data — all via @/lib/data (G8).
  //   regionPulse / cityPulse   — market_pulse_live, property_type='A'.
  //   regionDetail / cityDetail — market_stats_cache, period_type='rolling_365d'.
  // -------------------------------------------------------------------------
  const [regionPulse, regionDetail, citySnapshots, cityDetails] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getCityMarketDetail({ geoType: 'region', geoSlug: 'central-oregon', periodType: 'rolling_365d' }).catch(
      () => null,
    ),
    getMarketPulseCitySnapshots(REPORT_CITIES.map((c) => c.label)).catch(() => []),
    Promise.all(
      GRID_CITIES.map((c) =>
        getCityMarketDetail({ geoType: 'city', geoSlug: dbGeoSlug(c.slug), periodType: 'rolling_365d' }).catch(
          () => null,
        ),
      ),
    ),
  ])

  type CityRow = {
    slug: string
    label: string
    pulse: (typeof citySnapshots)[number] | null
    detail: (typeof cityDetails)[number] | null
  }

  const cityRows: CityRow[] = GRID_CITIES.map((c, i) => ({
    slug: c.slug,
    label: c.label,
    pulse: citySnapshots.find((s) => s.geo_label === c.label) ?? null,
    detail: cityDetails[i] ?? null,
  }))

  // -------------------------------------------------------------------------
  // Timestamps are the REAL refresh timestamps off the rows, never now().
  // Region pulse freshness represents the whole live-inventory tier (every
  // city pulse row refreshes on the same 10-15 min cron); region detail
  // freshness represents the whole closed-sales cache tier (6h cron).
  // -------------------------------------------------------------------------
  const inventoryAsOf = regionPulse?.refreshedAt ?? null
  const salesAsOf = regionDetail?.updatedAt ?? null
  const periodStart = regionDetail?.periodStart ?? null
  const periodEnd = regionDetail?.periodEnd ?? null

  const regionMos = regionPulse?.monthsOfSupply ?? null
  const regionVerdict = marketVerdict(regionMos)

  // -------------------------------------------------------------------------
  // FAQ + Dataset variables — single source (buildMarketFaq) so the visible
  // FAQ, the FAQPage JSON-LD, and the region's Dataset variables cannot diverge.
  //
  // Pulse-timeout fallback (G52 page-contract, same idiom as central-oregon/
  // page.tsx and housing-market/[...slug]/page.tsx): `pulse` is the pulse-only
  // slice of the input, `pulse ?? {...}` is the honest null-shaped fallback
  // when the market_pulse_live row is slow or missing, so the FAQ/Dataset
  // JSON-LD below still renders (with the regionDetail-sourced fields it does
  // not depend on) instead of vanishing.
  // -------------------------------------------------------------------------
  const pulse = regionPulse
  const pulseFields =
    pulse ?? { activeCount: null, medianListPrice: null, medianDaysToPending: null }
  const { faqs, datasetVariables: regionFaqVariables, asOfIso } = buildMarketFaq('Central Oregon', {
    activeCount: pulseFields.activeCount,
    medianListPrice: pulseFields.medianListPrice,
    monthsOfSupply: regionMos,
    medianDaysToPending: pulseFields.medianDaysToPending,
    refreshedAt: inventoryAsOf,
    medianDaysOnMarket: regionDetail?.medianDom ?? null,
    soldCount12mo: regionDetail?.soldCount ?? null,
  })

  // -------------------------------------------------------------------------
  // Dataset JSON-LD variableMeasured — region core stats (from buildMarketFaq,
  // so the FAQ and the Dataset never disagree) plus one YoY price-change
  // variable per report city that actually has a live figure. A null
  // yoyMedianPriceDeltaPct emits nothing, never a fabricated 0 percent.
  // -------------------------------------------------------------------------
  const cityDatasetVariables: StatValue[] = cityRows
    .filter((r) => r.detail?.yoyMedianPriceDeltaPct != null)
    .map((r) => ({
      name: `${r.label} median sale price, year over year change`,
      value: Math.round((r.detail!.yoyMedianPriceDeltaPct as number) * 10) / 10,
      unitText: 'percent',
    }))
  if (regionDetail?.yoyMedianPriceDeltaPct != null) {
    regionFaqVariables.push({
      name: 'Central Oregon median sale price, year over year change',
      value: Math.round(regionDetail.yoyMedianPriceDeltaPct * 10) / 10,
      unitText: 'percent',
    })
  }
  if (regionDetail?.medianSalePrice != null) {
    regionFaqVariables.push({
      name: 'Central Oregon median sale price, trailing 12 months',
      value: Math.round(regionDetail.medianSalePrice),
      unitText: 'USD',
    })
  }
  const datasetVariables = [...regionFaqVariables, ...cityDatasetVariables]

  // -------------------------------------------------------------------------
  // JSON-LD schemas — BreadcrumbList + WebPage + Dataset + Article.
  // FAQPage is emitted by FAQBlock (includeJsonLd=true) below (G34).
  // dateModified is the real refreshedAt from market_pulse_live, never now().
  // -------------------------------------------------------------------------
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
        { name: 'Annual review', url: CANONICAL_PATH },
      ],
    },
    {
      type: 'webPage',
      name: 'Central Oregon housing market annual review',
      description:
        'The citable Central Oregon market reference: active inventory, months of supply, and the trailing 12 months of closed sales against the same window a year earlier, for the region and every report city.',
      url: CANONICAL_PATH,
    },
    {
      type: 'article',
      headline: 'Central Oregon housing market annual review',
      description:
        'Active inventory, months of supply, and trailing-12-month closed sales year over year, for Central Oregon and every report city, sourced live from Oregon Data Share.',
      url: CANONICAL_PATH,
      datePublished: '2026-08-03',
      dateModified: inventoryAsOf ?? undefined,
      authorName: 'Ryan Realty',
    },
  ]

  if (datasetVariables.length > 0 && asOfIso) {
    schemas.push({
      type: 'dataset',
      name: `Central Oregon housing market annual review, ${asOfIso}`,
      description:
        'Live single-family home market data for Central Oregon and its report cities. Includes active inventory, median list price, months of supply, and trailing-12-month closed-sales figures with year-over-year change against the same window a year earlier. Sourced from Oregon Data Share via Ryan Realty.',
      url: CANONICAL_PATH,
      dateModified: asOfIso,
      temporalCoverage: periodStart && periodEnd ? `${periodStart}/${periodEnd}` : undefined,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: datasetVariables,
    })
  }

  return (
    <main className="kb-root">
      <MetadataBlock schemas={schemas} />

      <KbNav solid />
      <KbSectionTracker pageType="market-report-annual" />

      <KbBreadcrumb
        belowNav
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Housing market', href: '/housing-market' },
          { label: 'Annual review' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Header. The H1 primitive carries font-display (ci:heading-display). */}
        <Section padding="loose" tone="default">
          <Container>
            <Stack gap="loose" className="max-w-[70ch]">
              <Eyebrow>Central Oregon · Annual review</Eyebrow>
              <H1>Central Oregon Housing Market: Annual Review</H1>
              <Body size="large" tone="primary">
                {regionMos != null
                  ? `Central Oregon is in ${regionVerdict.label} right now, at ${formatMonthsOfSupply(regionMos)} months of supply. `
                  : ''}
                The trailing 12 months of closed sales, compared with the same 12-month window one year
                earlier, for the region and every report city.
              </Body>
              <Caption>
                {periodStart && periodEnd
                  ? `Closed-sales window: ${formatDate(periodStart)} to ${formatDate(periodEnd)}, versus the same window one year earlier. `
                  : ''}
                {inventoryAsOf ? `Live inventory updated ${formatDate(inventoryAsOf)}. ` : ''}
                {salesAsOf ? `Closed-sales figures updated ${formatDate(salesAsOf)}.` : ''}
              </Caption>
            </Stack>
          </Container>
        </Section>

        {/* Methodology. The formula and thresholds, printed once, imported from
            lib/market/classify.ts (ci:market-formula). Every verdict below is
            marketVerdict(mos) against this exact clause, never retyped. */}
        <Section padding="tight" tone="muted" divider>
          <Container>
            <Stack gap="tight" className="max-w-[70ch]">
              <Eyebrow>Methodology</Eyebrow>
              <Body size="default" tone="primary">
                {MOS_METHODOLOGY_CLAUSE} {MOS_THRESHOLD_CLAUSE}
              </Body>
              <Caption>
                Single-family homes only (MLS PropertyType=&apos;A&apos;). Year-over-year figures compare the
                trailing 12 months against the same 12-month window one year earlier, computed by the same
                cache job for both windows, never a partial-year or Q1-versus-full-year comparison. Source:
                Oregon Data Share via Ryan Realty.
              </Caption>
            </Stack>
          </Container>
        </Section>

        {/* Central Oregon region KPI grid. */}
        <Section padding="default" tone="default" divider>
          <Container>
            <Stack gap="loose" className="w-full">
              <Stack gap="tight">
                <Eyebrow>Central Oregon</Eyebrow>
                <H2>Region summary</H2>
              </Stack>
              <div className="mkt-kpis w-full">
                <KpiTile val={<TabularNumber value={regionPulse?.activeCount ?? null} />} lbl="Active listings" />
                <KpiTile val={<Price value={regionPulse?.medianListPrice ?? null} />} lbl="Median list price" />
                <KpiTile
                  val={regionMos != null ? formatMonthsOfSupply(regionMos) : 'Not available'}
                  lbl="Months of supply"
                  sub={regionMos != null ? capitalize(regionVerdict.label) : undefined}
                />
                <KpiTile
                  val={<Price value={regionDetail?.medianSalePrice ?? null} />}
                  lbl="Median sale price, TTM"
                  sub={<PercentChange value={regionDetail?.yoyMedianPriceDeltaPct ?? null} suffix="YoY" />}
                />
                <KpiTile val={<TabularNumber value={regionDetail?.soldCount ?? null} />} lbl="Homes sold, TTM" />
                <KpiTile
                  val={<DaysCount value={regionDetail?.medianDom ?? null} />}
                  lbl="Median days on market, TTM"
                  sub={`${formatDayDelta(regionDetail?.yoyDomChange ?? null)} YoY`}
                />
                <KpiTile
                  val={formatRatioPct(regionDetail?.avgSaleToListRatio ?? null)}
                  lbl="Avg sale to list, TTM"
                />
                <KpiTile
                  val={<Price value={regionDetail?.medianPricePerSqft ?? null} exact />}
                  lbl="Median dollars per sqft, TTM"
                  sub={<PercentChange value={regionDetail?.yoyPpsfChangePct ?? null} suffix="YoY" />}
                />
              </div>
            </Stack>
          </Container>
        </Section>

        {/* Per-city year-over-year comparison table. */}
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="loose" className="w-full">
              <Stack gap="tight">
                <Eyebrow>Report cities</Eyebrow>
                <H2>City by city, year over year</H2>
                <Body size="default" tone="muted">
                  Every verdict below is the months-of-supply figure classified against the thresholds printed
                  above, never a separate call.
                </Body>
              </Stack>
              {/* KB-native comparison grid. No @/components/ui/table (shadcn) and
                  no raw <table> (design-tokens gate G bans the bare primitive).
                  Same grid-of-divs idiom KbTimeframeStats.client.tsx uses for
                  tabular market figures, with explicit table/row/cell roles for
                  assistive tech. Semantic Tailwind tokens (text-foreground,
                  text-muted-foreground, border-border) mixed with kb-root, same
                  as this page's own narrative section further down. */}
              <div className="w-full overflow-x-auto no-scrollbar">
                <div role="table" aria-label="City by city, year over year, single-family homes">
                  <div
                    role="row"
                    className="grid grid-cols-[minmax(110px,1.3fr)_repeat(8,minmax(92px,1fr))] gap-3 border-b-2 border-border pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <span role="columnheader">City</span>
                    <span role="columnheader">Active now</span>
                    <span role="columnheader">Median list, now</span>
                    <span role="columnheader">Months of supply</span>
                    <span role="columnheader">Median sale price, TTM</span>
                    <span role="columnheader">Price, YoY</span>
                    <span role="columnheader">Sold, TTM</span>
                    <span role="columnheader">Median DOM, TTM</span>
                    <span role="columnheader">DOM, YoY</span>
                  </div>
                  {cityRows.map((row) => {
                    const mos = row.pulse?.months_of_supply ?? null
                    const verdict = marketVerdict(mos)
                    return (
                      <div
                        key={row.slug}
                        role="row"
                        className="grid grid-cols-[minmax(110px,1.3fr)_repeat(8,minmax(92px,1fr))] items-baseline gap-3 border-b border-border py-3 text-sm"
                      >
                        <span role="cell" className="font-medium text-foreground">
                          <Link href={`/housing-market/${row.slug}`} className="hover:underline">
                            {row.label}
                          </Link>
                        </span>
                        <span role="cell">
                          <TabularNumber value={row.pulse?.active_count ?? null} />
                        </span>
                        <span role="cell">
                          <Price value={row.pulse?.median_list_price ?? null} />
                        </span>
                        <span role="cell">
                          {mos != null ? formatMonthsOfSupply(mos) : 'Not available'}
                          {mos != null ? (
                            <span className="ml-1 text-xs text-muted-foreground">({capitalize(verdict.label)})</span>
                          ) : null}
                        </span>
                        <span role="cell">
                          <Price value={row.detail?.medianSalePrice ?? null} />
                        </span>
                        <span role="cell">
                          <PercentChange value={row.detail?.yoyMedianPriceDeltaPct ?? null} suffix="" />
                        </span>
                        <span role="cell">
                          <TabularNumber value={row.detail?.soldCount ?? null} />
                        </span>
                        <span role="cell">
                          <DaysCount value={row.detail?.medianDom ?? null} />
                        </span>
                        <span role="cell">{formatDayDelta(row.detail?.yoyDomChange ?? null)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {NAMED_EXEMPTIONS.length > 0 ? (
                <Caption className="max-w-[70ch]">
                  {NAMED_EXEMPTIONS.map((c) => {
                    const ex = NON_MLS_CITY_EXEMPTIONS[c.label]
                    return ex ? (
                      <span key={c.slug}>
                        {c.label} is not shown as its own row. {ex.reason} Its market activity is included in{' '}
                        <Link href={ex.servedAt} className="underline">
                          {ex.mlsCity}
                        </Link>
                        {'. '}
                      </span>
                    ) : null
                  })}
                </Caption>
              ) : null}
            </Stack>
          </Container>
        </Section>

        {/* FAQ. Region Q&A from buildMarketFaq (single source with Dataset vars).
            includeJsonLd=true auto-emits FAQPage JSON-LD (G34). */}
        {faqs.length > 0 ? (
          <FAQBlock
            items={faqs}
            eyebrow="Common questions"
            title="Central Oregon real estate questions"
            intro="Direct answers based on live MLS data."
            includeJsonLd={true}
            tone="default"
          />
        ) : null}

        {/* Named source citation. The one shared outbound-citation block for
            every market-data surface (MarketSources), never a hand-rolled anchor. */}
        <MarketSources sources={['ods']} />

        {/* Related reports */}
        <ContentSection eyebrow="Keep reading" title="More Central Oregon market data" tone="default" divider>
          <Stack gap="tight">
            <Link href="/housing-market/central-oregon" className="text-primary hover:underline">
              Live Central Oregon market report
            </Link>
            <Link href="/housing-market/reports" className="text-primary hover:underline">
              Weekly market reports by city
            </Link>
          </Stack>
        </ContentSection>

        {/* Broker inquiry lead-capture. */}
        <LeadCaptureBlock
          variant="inquiry"
          onSubmit={submitMarketPageInquiry}
          eyebrow="Talk to a broker"
          title="Questions about the Central Oregon market?"
          intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation. No pressure."
          submitLabel="Ask a broker"
          tone="muted"
        />

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
