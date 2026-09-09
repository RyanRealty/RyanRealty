// @no-static-params — weekly report slugs are CMS rows, not a finite geo set.
/**
 * /housing-market/reports/[slug] — one weekly market report, on the
 * components/site/v3 barrel.
 *
 * VISITOR OBJECTIVE: read the week's pending and closed sales by city, share it,
 * or value a home.
 * MACHINE OBJECTIVE: Report JSON-LD plus BreadcrumbList, canonical on this URL.
 *
 * P10 wrap: body moved here from /reports/[slug] (now a 308 stub). DROPPED:
 * KbBreadcrumb, KbFooter, KbSell, SmoothScrollProvider, kb.css. Islands: the
 * CMS HTML body and ShareButton. Visible CTA: Value my home.
 *
 * generateMetadata, getMarketReportBySlug, getReportImageUrl, sanitizeHtml, and
 * the unoptimized banner (serverless-safe) are unchanged.
 */

import Image from 'next/image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMarketReportBySlug, getReportImageUrl } from '@/lib/data'
import ShareButton from '@/components/ShareButton'
import { sanitizeHtml } from '@/lib/sanitize'
import { formatDate } from '@/lib/format/date'
import { pageMetadata } from '@/lib/site/page-metadata'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { ReportsInquirySheet } from '../_v3/ReportsInquirySheet.client'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

/**
 * A stored calendar day is not a date a person reads. This page shipped
 * "2026-08-30 to 2026-09-05" in its meta description, its og:description, its
 * twitter:description and its Report JSON-LD, under a 97-character document
 * title Google truncates. Both are formatted here, once, through
 * lib/format/date (ci:date-format), and the two callers below read the same
 * two strings so the head and the body can never print the window differently.
 *
 * `timeZone: 'UTC'` on a YYYY-MM-DD calendar day: formatDate anchors a bare
 * date at noon UTC, so this returns the stored civil day rather than the
 * Pacific evening before it.
 */
function reportWindow(report: { period_start: string; period_end: string }): {
  full: string
  short: string
} {
  const day = (d: string, opts?: Intl.DateTimeFormatOptions) =>
    formatDate(d, { timeZone: 'UTC', ...opts })
  return {
    full: `${day(report.period_start)} to ${day(report.period_end)}`,
    // The document title carries the layout's 31-character brand suffix, so the
    // window drops its year to keep the whole SERP title inside 65 characters.
    // The year is still in the description, in the H1, and in the slug.
    short: `${day(report.period_start, { year: undefined })} to ${day(report.period_end, { year: undefined })}`,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  const path = `/housing-market/reports/${slug}`
  if (!report) {
    return pageMetadata({
      title: 'Market report not found',
      description: 'We do not publish a market report at this address.',
      path,
      noindex: true,
    })
  }
  const imageUrl = await getReportImageUrl(report.image_storage_path)
  const window = reportWindow(report)
  const description = `Central Oregon weekly market report, ${window.full}. Pending and closed sales by city.`
  const base = pageMetadata({
    title: `Market report: ${window.short}`,
    description,
    path,
    ogType: 'article',
  })
  if (!imageUrl) return base
  // The report banner is 1200x336, not the 1200x630 pageMetadata declares for
  // the default card, so its real dimensions are restored here.
  const images = [{ url: imageUrl, width: 1200, height: 336, alt: report.title }]
  return {
    ...base,
    openGraph: { ...base.openGraph, images },
    twitter: { ...base.twitter, images: [imageUrl] },
  }
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  if (!report) notFound()

  const reportUrl = `${siteUrl}/housing-market/reports/${slug}`
  const imageUrl = await getReportImageUrl(report.image_storage_path)
  const title = report.title.trim()
  if (!title) notFound()
  const windowLabel = reportWindow(report).full
  const sellHref = valuationHref(`/housing-market/reports/${slug}`)

  const reportSchema = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: report.title,
    description: `Central Oregon weekly market report, ${windowLabel}. Pending and closed sales by city.`,
    url: reportUrl,
    datePublished: report.created_at,
    ...(imageUrl && { image: imageUrl }),
    publisher: { '@type': 'Organization', name: 'Ryan Realty', url: siteUrl },
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reportSchema) }} />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Market reports', url: '/housing-market/reports' },
                { name: report.title, url: `/housing-market/reports/${slug}` },
              ],
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Market reports', href: '/housing-market/reports' },
            { label: title },
          ]}
        />

        <V3Quiet
          id="report"
          heading={title}
          headingLevel={1}
          eyebrow={`Weekly report · ${windowLabel}`}
          items={[
            {
              kind: 'prose',
              body: 'Pending and closed sales by city. If this is useful, pass it along.',
            },
          ]}
        />

        <article id="report-body" aria-label={title}>
          {imageUrl ? (
            <div className="relative mt-8 overflow-hidden">
              <Image
                src={imageUrl}
                alt={`${title}, market report image`}
                width={1200}
                height={336}
                className="w-full object-cover"
                sizes="(max-width: 1024px) 100vw, 1024px"
                priority
                unoptimized
              />
            </div>
          ) : null}

          {report.content_html ? (
            <div
              className="prose mt-8 max-w-prose"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(report.content_html) }}
            />
          ) : (
            <p>This report is being updated.</p>
          )}

          <div className="mt-8">
            <ShareButton
              title={report.title}
              text={`Central Oregon market report: ${windowLabel}. Pending and closed sales by city.`}
              url={reportUrl}
              variant="default"
              trackContext="weekly_report"
            />
          </div>
        </article>

        <ReportsInquirySheet /> {/* hydration-safe: visitor-caused sheet state */}

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: 'All reports', href: '/housing-market/reports' },
            { label: 'Housing market hub', href: '/housing-market' },
            { label: 'Value my home', href: sellHref },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
