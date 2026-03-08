import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMarketReportBySlug, getReportImageUrl } from '../../actions/market-reports'
import ShareButton from '../../../components/ShareButton'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const report = await getMarketReportBySlug(slug)
  if (!report) return { title: 'Market report' }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')
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

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')
  const reportUrl = `${siteUrl}/reports/${slug}`
  const imageUrl = await getReportImageUrl(report.image_storage_path)

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
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reportSchema) }} />
      <nav className="mb-6 text-sm">
        <Link href="/reports" className="text-zinc-500 hover:text-zinc-900">
          ← Market reports
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">{report.title}</h1>
        <ShareButton
          title={report.title}
          text={`Central Oregon market report: ${report.period_start} – ${report.period_end}. Pending and closed sales by city.`}
          url={reportUrl}
          variant="default"
        />
      </div>

      {imageUrl && (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
          <Image
            src={imageUrl}
            alt=""
            width={1200}
            height={336}
            className="w-full object-cover"
            sizes="100vw"
            priority
          />
        </div>
      )}

      {report.content_html && (
        <div
          className="prose prose-zinc mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: report.content_html }}
        />
      )}

      <p className="mt-8 text-sm text-zinc-500">
        Share this report via the button above to X (Twitter), Facebook, LinkedIn, or email.
      </p>
    </main>
  )
}
