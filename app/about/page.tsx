import type { Metadata } from 'next'
import Link from 'next/link'
import { getAboutContent } from './actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Ryan Realty — Central Oregon\'s trusted real estate brokerage.',
}

export default async function AboutPage() {
  const content = await getAboutContent()

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        {content?.title ?? 'About Ryan Realty'}
      </h1>
      <div className="mt-6 prose prose-zinc max-w-none">
        <div
          className="whitespace-pre-wrap text-zinc-700"
          dangerouslySetInnerHTML={{
            __html: (content?.body_html?.trim()?.length ? content.body_html : null) ?? defaultAboutBody(),
          }}
        />
      </div>
      <section className="mt-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6" aria-labelledby="about-cta-heading">
        <h2 id="about-cta-heading" className="text-lg font-semibold text-[var(--color-text-primary)]">Get started</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Meet our team, browse listings, or reach out with questions.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/team"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-cta)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary)] shadow-sm hover:bg-[var(--color-cta-hover)]"
          >
            Meet the team
          </Link>
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)]"
          >
            Browse listings
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-white)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)]"
          >
            Contact us
          </Link>
        </div>
      </section>
    </main>
  )
}

function defaultAboutBody(): string {
  return `<p>Ryan Realty is Central Oregon's trusted source for buying and selling homes. We combine local expertise with a personal approach to help you find the right property or the right buyer.</p>
<p>Our team of experienced brokers serves Bend, Redmond, Sisters, Sunriver, and the wider region. Whether you're looking for a primary residence, vacation home, or investment property, we're here to guide you.</p>
<p><a href="/team">Meet our team</a> and <a href="/listings">browse current listings</a> to get started.</p>`
}
