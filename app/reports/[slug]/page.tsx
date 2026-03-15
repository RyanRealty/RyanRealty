import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getMarketReportBySlug, getReportImageUrl } from '../../actions/market-reports'
import ShareButton from '../../../components/ShareButton'
import { sanitizeHtml } from '@/lib/sanitize'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  if (!report) return { title: 'Market report' }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const reportUrl = `${siteUrl}/reports/${slug}`
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
      ...(imageUrl && { images: [imageUrl] }),
    },
  }
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  if (!report) notFound()

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const reportUrl = `${siteUrl}/reports/${slug}`
  const [imageUrl, session, fubPersonId] = await Promise.all([
    getReportImageUrl(report.image_storage_path),
    getSession(),
    getFubPersonIdFromCookie(),
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
    <main className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reportSchema) }} />
      <section className="bg-primary px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <nav className="mb-4 text-sm text-muted/80" aria-label="Breadcrumb">
            <Link href="/reports" className="hover:text-muted">Market reports</Link>
            <span className="mx-2">/</span>
            <span className="text-muted">{report.title}</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">{report.title}</h1>
            <ShareButton
              title={report.title}
              text={`Central Oregon market report: ${report.period_start} – ${report.period_end}. Pending and closed sales by city.`}
              url={reportUrl}
              variant="default"
              trackContext="weekly_report"
              className="rounded-lg border border-muted/30 bg-card/10 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-card/20"
            />
          </div>
          <p className="mt-2 text-muted/90">
            {report.period_start} – {report.period_end}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        {imageUrl && (
          <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <Image
              src={imageUrl}
              alt={`${report.title} — market report image`}
              width={1200}
              height={336}
              className="w-full object-cover"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
            />
          </div>
        )}

        {report.content_html && (
          <div
            className="prose prose-primary mt-8 max-w-none prose-headings:text-primary prose-p:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(report.content_html) }}
          />
        )}

        <p className="mt-8 text-sm text-muted-foreground">
          Share this report via the button above to X (Twitter), Facebook, LinkedIn, or email.
        </p>
      </section>
    </main>
  )
}
