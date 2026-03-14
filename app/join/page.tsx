import type { Metadata } from 'next'
import Link from 'next/link'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Join Our Team | Careers at Ryan Realty | Ryan Realty',
  description:
    'Grow your real estate career with Ryan Realty. Join a passionate Bend brokerage focused on community, excellence, and results in Central Oregon.',
  alternates: { canonical: `${siteUrl}/join` },
  openGraph: {
    title: 'Join Our Team | Ryan Realty',
    url: `${siteUrl}/join`,
    type: 'website',
  },
}

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Grow Your Career With Us"
        subtitle="A passionate Central Oregon brokerage built on community and excellence. Licensed or thinking about it—we'd love to talk."
        imageUrl={CONTENT_HERO_IMAGES.join}
        ctas={[
          { label: 'Get in Touch', href: '/contact?inquiry=Join%20Our%20Team', primary: true },
          { label: 'Meet the Team', href: '/team', primary: false },
        ]}
      />

      <section className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="why-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="why-heading" className="text-center text-3xl font-bold text-primary sm:text-4xl">
            Why Ryan Realty?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            We combine local market expertise with a culture that values transparency, collaboration,
            and putting clients first.
          </p>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: 'Local focus',
                body: 'Central Oregon is our only market. We know the neighborhoods, the buyers, and the trends that matter.',
              },
              {
                title: 'Support & tools',
                body: 'Marketing support, listing tools, and a team that has your back so you can focus on your clients.',
              },
              {
                title: 'Culture',
                body: 'A brokerage that values integrity, communication, and long-term relationships over volume for volume\'s sake.',
              },
              {
                title: 'Growth',
                body: 'Whether you\'re new to real estate or a seasoned agent, we invest in our people and their success.',
              },
            ].map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-border bg-muted p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="next-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="next-heading" className="text-2xl font-bold text-primary sm:text-3xl">
            Ready to start the conversation?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tell us a bit about yourself and your goals. We&apos;ll follow up to discuss fit,
            support, and next steps. No pressure—just a real conversation.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact?inquiry=Join%20Our%20Team"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Contact us
            </Link>
            <Link
              href="/team"
              className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Meet the team
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
