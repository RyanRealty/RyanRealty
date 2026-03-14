import type { Metadata } from 'next'
import Link from 'next/link'
import { getAboutContent } from './actions'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { sanitizeHtml } from '@/lib/sanitize'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Ryan Realty — Central Oregon\'s trusted real estate brokerage.',
}

export default async function AboutPage() {
  const [content, session, fubPersonId] = await Promise.all([
    getAboutContent(),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  const pageUrl = `${getCanonicalSiteUrl()}/about`
  const pageTitle = 'About Us | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <ContentPageHero
        title={content?.title ?? 'About Ryan Realty'}
        subtitle="Central Oregon's trusted brokerage. Local expertise, a personal approach, and a team that helps you find the right property—or the right buyer."
        imageUrl={CONTENT_HERO_IMAGES.about}
        ctas={[
          { label: 'Meet the Team', href: '/team', primary: true },
          { label: 'View Listings', href: '/listings', primary: false },
          { label: 'Get in Touch', href: '/contact', primary: false },
        ]}
      />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="prose prose-[var(--primary)] max-w-none">
          <div
            className="whitespace-pre-wrap text-[var(--muted-foreground)]"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml((content?.body_html?.trim()?.length ? content.body_html : null) ?? defaultAboutBody()),
            }}
          />
        </div>
        <section className="mt-12 rounded-xl border border-border bg-muted p-6 sm:p-8" aria-labelledby="about-cta-heading">
          <h2 id="about-cta-heading" className="text-xl font-bold tracking-tight text-primary">Get started</h2>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Meet our team, browse listings, or reach out with questions.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/team"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary shadow-sm hover:bg-accent/90"
            >
              Meet the team
            </Link>
            <Link
              href="/listings"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Browse listings
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Contact us
            </Link>
          </div>
        </section>
      </section>
    </main>
  )
}

function defaultAboutBody(): string {
  return `<p>Ryan Realty is Central Oregon's trusted source for buying and selling homes. We combine local expertise with a personal approach to help you find the right property or the right buyer.</p>
<p>Our team of experienced brokers serves Bend, Redmond, Sisters, Sunriver, and the wider region. Whether you're looking for a primary residence, vacation home, or investment property, we're here to guide you.</p>
<p><a href="/team">Meet our team</a> and <a href="/listings">browse current listings</a> to get started.</p>`
}
