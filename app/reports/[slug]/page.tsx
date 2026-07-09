/**
 * /reports/[slug] — single weekly market report detail.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior navy-hero + prose layout. Every piece of content is
 * preserved:
 *   - Report (schema.org) JSON-LD built from live report data
 *   - report.title + period_start / period_end window
 *   - the report banner image (Image, unoptimized — the serverless-safe path)
 *   - report.content_html rendered as sanitized rich prose
 *   - the ShareButton (interactive client — X / Facebook / LinkedIn / email)
 *   - the "share this report" copy block
 *   - generateMetadata (async) for SEO + OG/Twitter cards
 *   - both DAL reads (getMarketReportBySlug, getReportImageUrl)
 *   - the FUB page-view tracking call
 *
 * Only the presentation changed: KB shell (KbNav, KbBreadcrumb, KbFooter,
 * SmoothScrollProvider, KbSectionTracker), Amboqia display headings, hard-edge
 * cream-on-navy surfaces. The ShareButton client keeps its logic intact.
 */

import Image from 'next/image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getMarketReportBySlug, getReportImageUrl } from '@/lib/data'
import ShareButton from '../../../components/ShareButton'
import { sanitizeHtml } from '@/lib/sanitize'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  if (!report) return { title: 'Market report' }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const reportUrl = `${siteUrl}/housing-market/reports/${slug}`
  // Banner RE-ENABLED 2026-06-01: the report 500s were NOT the image — they were
  // jsdom failing to load in serverless (see lib/sanitize.ts). With that fixed,
  // the banner (valid public Supabase URL, unoptimized) renders fine.
  const imageUrl = await getReportImageUrl(report.image_storage_path)
  return {
    title: report.title,
    description: `Central Oregon real estate market report: ${report.period_start} – ${report.period_end}. Pending and closed sales by city.`,
    alternates: { canonical: reportUrl },
    openGraph: {
      title: report.title,
      description: `Weekly market report: pending and closed sales by city. ${report.period_start} – ${report.period_end}.`,
      url: reportUrl,
      type: 'article',
      ...(imageUrl && { images: [{ url: imageUrl, width: 1200, height: 336, alt: report.title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: report.title,
      description: `Weekly market report: ${report.period_start} – ${report.period_end}.`,
      // Object form with explicit width/height (matches openGraph above). A BARE
      // STRING here makes Next 16 fetch the URL to probe its dimensions during
      // metadata resolution; that fetch failed on the Vercel runtime and threw
      // "Failed to load external image", 500'ing all 10 report pages.
      ...(imageUrl && { images: [{ url: imageUrl, width: 1200, height: 336, alt: report.title }] }),
    },
  }
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  if (!report) notFound()

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const reportUrl = `${siteUrl}/housing-market/reports/${slug}`
  const [imageUrl, session, fubPersonId] = await Promise.all([
    getReportImageUrl(report.image_storage_path),
    getSession(),
    getPersonIdFromCookie(),
  ])
  const pageTitle = `${report.title} | Ryan Realty`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl: reportUrl, pageTitle })

  const reportSchema = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: report.title,
    description: `Central Oregon real estate market report: ${report.period_start} – ${report.period_end}. Pending and closed sales by city.`,
    url: reportUrl,
    datePublished: report.created_at,
    ...(imageUrl && { image: imageUrl }),
    publisher: { '@type': 'Organization', name: 'Ryan Realty', url: siteUrl },
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="market-reports" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reportSchema) }} />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Market reports', href: '/housing-market/reports' },
          { label: report.title },
        ]}
      />
      <SmoothScrollProvider>
        {/* Report header — title + reporting window + share. */}
        <section className="section" id="report" aria-label="Market report">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Weekly report · {report.period_start} to {report.period_end}</span>
            </div>
            <article className="mx-auto w-full max-w-3xl pt-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h1 className="display" style={{ fontSize: 'clamp(2rem,6vw,3.8rem)', lineHeight: 0.95 }}>
                  {report.title}
                </h1>
                {/* Share — interactive client, preserved. KB-skinned button. */}
                <ShareButton
                  title={report.title}
                  text={`Central Oregon market report: ${report.period_start} - ${report.period_end}. Pending and closed sales by city.`}
                  url={reportUrl}
                  variant="default"
                  trackContext="weekly_report"
                  className="btn alt"
                />
              </div>
              <p
                className="mono-num mt-3"
                style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', letterSpacing: '.02em' }}
              >
                {report.period_start} to {report.period_end}
              </p>

              {/* Report banner — pre-rendered 1200x336, unoptimized (serverless-safe). */}
              {imageUrl && (
                <div className="mt-7 overflow-hidden" style={{ border: 'var(--edge) solid var(--navy)' }}>
                  <Image
                    src={imageUrl}
                    alt={`${report.title}, market report image`}
                    width={1200}
                    height={336}
                    className="w-full object-cover"
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    priority
                    // The banner is a pre-rendered 1200x336 image already sized for this
                    // slot. Next's image optimizer was throwing "Failed to load external
                    // image" on it and 500'ing the whole report page; unoptimized serves
                    // the (valid, public) Supabase URL directly and can't crash SSR.
                    unoptimized
                  />
                </div>
              )}

              {/* Rich report body. kb-root resets margins, so the rendered HTML
                  gets explicit spacing + a navy-on-cream prose treatment scoped
                  to this container. Sanitized server-side. */}
              {report.content_html && (
                <div
                  className="kb-report-body mt-7 max-w-none [&_h2]:text-[clamp(1.5rem,3vw,2.1rem)] [&_h2]:leading-tight [&_h2]:font-semibold [&_h2]:mt-10! [&_h2]:mb-3! [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-8! [&_h3]:mb-2! [&_p]:my-4! [&_p]:leading-[1.65] [&_p]:text-[1.02rem] [&_ul]:my-4! [&_ul]:pl-6! [&_ul]:list-disc [&_ol]:my-4! [&_ol]:pl-6! [&_ol]:list-decimal [&_li]:my-1.5! [&_li]:leading-[1.6] [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_img]:my-6! [&_table]:w-full [&_table]:my-6! [&_td]:py-2! [&_th]:py-2! [&_th]:text-left"
                  style={{ color: 'var(--navy)', fontVariantNumeric: 'tabular-nums' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(report.content_html) }}
                />
              )}

              <p className="mt-8 text-sm" style={{ color: 'var(--navy-70)' }}>
                Share this report via the button above to X (Twitter), Facebook, LinkedIn, or email.
              </p>
            </article>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
