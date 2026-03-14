import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { LocationHugeIcon, HomeHugeIcon, SupportHugeIcon, ArrowRightHugeIcon } from '@/components/icons/HugeIcons'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Buy With Us | Find Your Central Oregon Home | Ryan Realty',
  description:
    'Find your Central Oregon home in Bend, Redmond, Sisters, Sunriver and beyond. Local expertise, real-time listings, and a team dedicated to matching you with a lifestyle you\'ll love.',
  alternates: { canonical: `${siteUrl}/buy` },
  openGraph: {
    title: 'Buy With Us | Ryan Realty — Central Oregon Real Estate',
    description: 'Find your Central Oregon home with local expertise and personalized support.',
    url: `${siteUrl}/buy`,
    type: 'website',
  },
}

const STEPS = [
  {
    title: 'Tell us what you want',
    body: 'Share your must-haves, neighborhoods, and budget. We\'ll set up a custom search and show you the best matches as they hit the market.',
  },
  {
    title: 'Explore with confidence',
    body: 'Tour homes with a broker who knows every corner of Central Oregon. We\'ll point out what matters—schools, commute, resale—so you can decide with clarity.',
  },
  {
    title: 'Make a strong offer',
    body: 'We use local comps and market trends to help you offer right. From negotiation to closing, we handle the details so you can focus on your move.',
  },
]

export default async function BuyPage() {
  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/buy`
  const pageTitle = 'Buy With Us | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Find Your Home in Central Oregon"
        subtitle="Local expertise, real-time listings, and a team that puts you first. Bend, Redmond, Sisters, Sunriver—and the lifestyle you've been looking for."
        imageUrl={CONTENT_HERO_IMAGES.buy}
        ctas={[
          { label: 'View Listings', href: '/listings', primary: true },
          { label: 'Search Homes', href: '/homes-for-sale', primary: false },
        ]}
      />

      {/* Why buy with us */}
      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="why-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="why-heading" className="text-center text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Your Central Oregon Experts
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Central Oregon is renowned for outdoor recreation and natural beauty. We combine local
            market mastery with a genuine love for our community to help you buy with confidence.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: 'Local market mastery',
                body: 'We know Bend, Redmond, Sisters, Sunriver, and every neighborhood in between. Get honest guidance on schools, commute, and resale.',
                icon: 'map',
              },
              {
                title: 'Real-time listings',
                body: 'See new listings as they hit the market. Save favorites, get alerts, and tour homes on your schedule.',
                icon: 'home',
              },
              {
                title: 'Personalized support',
                body: 'From first search to closing, we\'re with you. Transparent communication and no pressure—just results.',
                icon: 'handshake',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-muted p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-accent-foreground">
                  {item.icon === 'map' && <LocationHugeIcon className="h-6 w-6" />}
                  {item.icon === 'home' && <HomeHugeIcon className="h-6 w-6" />}
                  {item.icon === 'handshake' && <SupportHugeIcon className="h-6 w-6" />}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="steps-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="steps-heading" className="text-center text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            From first search to keys in hand, we make the journey clear and low-stress.
          </p>
          <ul className="mt-12 space-y-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-primary">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-14 text-center">
            <Link
              href="/contact?inquiry=Buying"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Start your search — contact us
              <ArrowRightHugeIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="border-t border-border bg-card px-4 py-14 sm:px-6" aria-labelledby="explore-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="explore-heading" className="text-center text-2xl font-bold text-primary sm:text-3xl">
            Explore More
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/listings"
              className="rounded-lg border-2 border-primary bg-transparent px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Featured Listings
            </Link>
            <Link
              href="/homes-for-sale"
              className="rounded-lg border-2 border-primary bg-transparent px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Home Search
            </Link>
            <Link
              href="/area-guides"
              className="rounded-lg border-2 border-primary bg-transparent px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Area Guides
            </Link>
            <Link
              href="/team"
              className="rounded-lg border-2 border-primary bg-transparent px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Meet Our Team
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
