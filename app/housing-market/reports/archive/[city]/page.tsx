// @no-parity — data-archive surface on the shared KB pattern; no bespoke mockup contract.
/**
 * /housing-market/reports/archive/[city] — the decade market archive for one
 * report city (W8.5).
 *
 * The live CONSUMER of the W2.6 monthly-cache backfill: it reads the full monthly
 * market_stats_cache series (2016 → present) through getCityArchive and renders
 * per-year aggregate statistics. Static route (generateStaticParams over the
 * REPORT_CITIES registry), so a bad slug is a 404, not a soft-empty page.
 *
 * Placement: the canonical reports namespace is /housing-market/reports (the bare
 * /reports/* paths 308-redirect here, next.config.ts). A STATIC `archive` segment
 * sits beside the existing /housing-market/reports/[slug] weekly-report route
 * without colliding (static beats dynamic).
 *
 * §0: every figure comes from getCityArchive (one monthly-cache read). ODS §5-4
 * A.4: aggregate-only (year, count, monthly-median range) — never an individual
 * sold listing. §7-3 source line rides in CityArchiveSection.
 *
 * Data ONLY through @/lib/data (G8). No @/app/actions/* imports.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCityArchive } from '@/lib/data/market/getCityArchive'
import { REPORT_CITIES, REPORT_CITY_SLUGS } from '@/lib/data/geo/report-cities'
import { CityArchiveSection } from '@/components/reports/CityArchiveSection'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type PageProps = { params: Promise<{ city: string }> }

/** Pre-generate the archive for every report city. */
export function generateStaticParams(): Array<{ city: string }> {
  return REPORT_CITY_SLUGS.map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const entry = REPORT_CITIES.find((c) => c.slug === city)
  if (!entry) return { title: 'Archive Not Found | Ryan Realty' }
  const title = `${entry.label} home sales archive | Ryan Realty`
  const description = `A decade of single-family home sales in ${entry.label}, Oregon: closed sales and median sale price by year.`
  const canonical = `${siteUrl}/housing-market/reports/archive/${entry.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article', siteName: 'Ryan Realty' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CityArchivePage({ params }: PageProps) {
  const { city } = await params
  const archive = await getCityArchive(city)
  if (!archive) notFound()

  const span =
    archive.earliestYear != null && archive.latestYear != null && archive.earliestYear !== archive.latestYear
      ? `${archive.earliestYear}–${archive.latestYear}`
      : String(archive.latestYear ?? archive.earliestYear ?? '')

  const canonical = `${siteUrl}/housing-market/reports/archive/${archive.slug}`

  // Dataset JSON-LD — variableMeasured sourced ONLY from the archive figures.
  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Total closed single-family sales', value: archive.totalSold },
    { name: 'Years covered', value: archive.years.filter((y) => y.homesSold > 0).length },
  ]

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="reports" />
      <MetadataBlock
        schema={{
          type: 'dataset',
          name: `${archive.label} single-family home sales archive`,
          description:
            `Closed single-family home sales for ${archive.label}, Oregon by year, with the range of ` +
            `monthly median sale prices. Sourced from Oregon Data Share via Ryan Realty.`,
          url: canonical,
          temporalCoverage:
            archive.earliestYear != null && archive.latestYear != null
              ? `${archive.earliestYear}/${archive.latestYear}`
              : undefined,
          spatialCoverageName: `${archive.label}, OR`,
          variableMeasured: datasetVariables,
        }}
      />
      <KbBreadcrumb
        belowNav
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Market reports', href: '/housing-market/reports' },
          { label: archive.label, href: `/housing-market/${archive.slug}` },
          { label: 'Sales archive' },
        ]}
      />
      <SmoothScrollProvider>
        <section className="section" id="archive-hero" aria-label="Market archive header">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Market archive {span ? `· ${span}` : ''}</span>
            </div>
            <div className="pt-7">
              <h1 className="display" style={{ fontSize: 'clamp(2.2rem,7vw,4.6rem)', lineHeight: 0.92 }}>
                {archive.label}
                <br />
                home sales by year
              </h1>
              <p
                className="mono-num mt-4"
                style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', letterSpacing: '.02em' }}
              >
                A decade of single-family closings.
              </p>
              <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 'clamp(20px,3vw,30px)' }}>
                <Link href={`/housing-market/${archive.slug}`} className="btn alt">
                  Current market <span className="arr">→</span>
                </Link>
                <Link
                  href="/housing-market/reports"
                  className="btn alt"
                  style={{ background: 'transparent', color: 'var(--navy)' }}
                >
                  All reports <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <CityArchiveSection archive={archive} />

        <MarketSources sources={['ods']} />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
