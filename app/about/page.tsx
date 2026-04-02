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
import { Button } from '@/components/ui/button'
import { listingsBrowsePath } from '@/lib/slug'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const aboutOgImage = `${siteUrl}/api/og?type=default`

export const revalidate = 60

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Ryan Realty — Central Oregon\'s trusted real estate brokerage.',
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: 'About Ryan Realty',
    url: `${siteUrl}/about`,
    images: [{ url: aboutOgImage, width: 1200, height: 630, alt: 'About Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [aboutOgImage],
  },
}

export default async function AboutPage() {
  let content: Awaited<ReturnType<typeof getAboutContent>> = null
  try {
    const [contentResult, session, fubPersonId] = await Promise.all([
      getAboutContent(),
      getSession().catch(() => null),
      getFubPersonIdFromCookie().catch(() => null),
    ])
    content = contentResult
    const pageUrl = `${getCanonicalSiteUrl()}/about`
    const pageTitle = 'About Us | Ryan Realty'
    trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId: fubPersonId ?? undefined, pageUrl, pageTitle })
  } catch (err) {
    console.error('[AboutPage]', err)
  }

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title={content?.title ?? 'About Ryan Realty'}
        subtitle="Central Oregon's trusted brokerage. Local expertise, a personal approach, and a team that helps you find the right property—or the right buyer."
        imageUrl={CONTENT_HERO_IMAGES.about}
        ctas={[
          { label: 'Meet the Team', href: '/team', primary: true },
          { label: 'View Listings', href: listingsBrowsePath(), primary: false },
          { label: 'Get in Touch', href: '/contact', primary: false },
        ]}
      />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="prose prose-primary max-w-none">
          <div
            className="whitespace-pre-wrap text-muted-foreground"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml((content?.body_html?.trim()?.length ? content.body_html : null) ?? defaultAboutBody()),
            }}
          />
        </div>
        <section className="mt-12 rounded-xl border border-border bg-muted p-6 sm:p-8" aria-labelledby="about-cta-heading">
          <h2 id="about-cta-heading" className="text-xl font-bold tracking-tight text-primary">Get started</h2>
          <p className="mt-2 text-muted-foreground">
            Meet our team, browse listings, or reach out with questions.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/team">
              <Button className="inline-flex items-center gap-2 bg-accent text-primary hover:bg-accent/90">
                Meet the team
              </Button>
            </Link>
            <Link href={listingsBrowsePath()}>
              <Button variant="outline" className="inline-flex items-center gap-2">
                Browse listings
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="inline-flex items-center gap-2">
                Contact us
              </Button>
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
<p><a href="/team">Meet our team</a> and <a href="/homes-for-sale">browse current listings</a> to get started.</p>`
}
