import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getBrokerBySlug } from '../../actions/brokers'
import { getBrokerageSettings } from '../../actions/brokerage'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const [broker, brokerage] = await Promise.all([getBrokerBySlug(slug), getBrokerageSettings()])
  const siteName = brokerage?.name ?? 'Ryan Realty'
  if (!broker) return { title: 'Team Member' }
  return {
    title: `${broker.display_name} | ${siteName}`,
    description: broker.bio?.slice(0, 160) ?? `${broker.title} at ${siteName}.`,
  }
}

export default async function BrokerPage({ params }: PageProps) {
  const { slug } = await params
  const [broker, brokerage] = await Promise.all([getBrokerBySlug(slug), getBrokerageSettings()])
  if (!broker) notFound()
  const siteName = brokerage?.name ?? 'Ryan Realty'

  const hasReviewLinks = (broker.google_review_url?.trim() || broker.zillow_review_url?.trim()) ?? false

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/team" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
        ← Back to team
      </Link>
      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="shrink-0">
          <div className="relative h-56 w-56 overflow-hidden rounded-2xl bg-zinc-100 shadow-md">
            {broker.photo_url ? (
              <Image
                src={broker.photo_url}
                alt=""
                fill
                className="object-cover"
                sizes="224px"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-semibold text-zinc-400">
                {broker.display_name.charAt(0)}
              </div>
            )}
          </div>
          {(broker.email || broker.phone) && (
            <div className="mt-6 flex flex-col gap-2">
              {broker.email && (
                <a href={`mailto:${broker.email}`} className="text-sm font-medium text-emerald-600 hover:underline">
                  {broker.email}
                </a>
              )}
              {broker.phone && (
                <a href={`tel:${broker.phone}`} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
                  {broker.phone}
                </a>
              )}
            </div>
          )}
          {hasReviewLinks && (
            <div className="mt-6 flex flex-wrap gap-3">
              {broker.google_review_url?.trim() && (
                <a
                  href={broker.google_review_url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google reviews
                </a>
              )}
              {broker.zillow_review_url?.trim() && (
                <a
                  href={broker.zillow_review_url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  <span className="text-sm font-bold text-[#006AFF]">Z</span>
                  Zillow reviews
                </a>
              )}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{broker.display_name}</h1>
          {broker.title && (
            <p className="mt-1 text-lg text-zinc-600">{broker.title}</p>
          )}
          {broker.license_number?.trim() && (
            <p className="mt-1 text-sm text-zinc-500">
              Oregon Real Estate License # {broker.license_number.trim()}
            </p>
          )}
          {broker.bio?.trim() && (
            <div className="mt-6 prose prose-zinc max-w-none">
              <div className="whitespace-pre-wrap text-zinc-700">{broker.bio}</div>
            </div>
          )}
          <section className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Work with {broker.display_name.split(' ')[0]}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Ready to buy or sell in Central Oregon? Get in touch for a no-pressure conversation.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {broker.email && (
                <a
                  href={`mailto:${broker.email}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Email {broker.display_name.split(' ')[0]}
                </a>
              )}
              {broker.phone && (
                <a
                  href={`tel:${broker.phone}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  Call
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
