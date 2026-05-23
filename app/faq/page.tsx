import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const faqOgImage = `${siteUrl}/api/og?type=default`

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FAQ — Real Estate in Bend, Oregon',
  description:
    "Honest answers to the questions Bend buyers and sellers ask Ryan Realty every week. Neighborhoods, timelines, market conditions, working with a brokerage.",
  alternates: { canonical: `${siteUrl}/faq` },
  openGraph: {
    title: 'FAQ — Ryan Realty Bend',
    description:
      'Honest, direct answers to the most common questions about buying and selling real estate in Bend, Oregon.',
    url: `${siteUrl}/faq`,
    images: [{ url: faqOgImage, width: 1200, height: 630, alt: 'Ryan Realty FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [faqOgImage],
  },
}

// ---------------------------------------------------------------------------
// FAQ content. This is the canonical source for:
//   - the /faq page itself
//   - the JSON-LD FAQPage schema (read by Gemini "Ask Maps", Google Search
//     featured snippets, and AI-driven local discovery surfaces)
//   - the GBP Q&A seed when posted via the UI runbook
// Brand voice: §0.7 CLAUDE.md (no em-dashes, no semicolons, no banned words).
// ---------------------------------------------------------------------------

interface FAQItem {
  question: string
  answer: string
  // Optional anchor + category for the on-page index
  id: string
  category: 'Neighborhoods' | 'Buying' | 'Selling' | 'Working with us'
}

const FAQ: FAQItem[] = [
  {
    id: 'bend-neighborhoods',
    category: 'Neighborhoods',
    question: 'Do you specialize in any particular Bend neighborhoods?',
    answer:
      "We work the full Central Oregon region and spend the most time in Bend's named neighborhoods. Old Mill, Northwest Crossing, Tetherow, Broken Top, Awbrey Butte, Tumalo, and Vandevert Ranch are where we have the most active comp knowledge and the most relationships. Outside of Bend itself, Sisters, Redmond, Sunriver, and Crooked River Ranch are in our regular service area. Tell us the neighborhood and the budget and we will be honest about whether we are the right team for that pocket.",
  },
  {
    id: 'first-time-buyers',
    category: 'Buying',
    question: 'Do you work with first-time home buyers in Central Oregon?',
    answer:
      "Yes. A meaningful share of our business is first-time buyers, and we like that work. The Bend market can be intimidating for someone who has never bought before, so we walk you through the entire process at a pace that makes sense for you. We are direct about what you can and cannot get at your budget. We never push you toward a stretch you will regret.",
  },
  {
    id: 'timeline-selling',
    category: 'Selling',
    question: "What is the typical timeline for selling a home in Bend right now?",
    answer:
      "It depends on the price band and the neighborhood. A well-priced single-family home in Bend's $500K to $700K range tends to go pending in two to four weeks. Homes priced over $1M can take longer if the property has a narrower buyer pool. We pull live comps for your specific neighborhood and price band before we list, and we tell you what to expect. The unpredictable side of the market is one reason we stay close to the data.",
  },
  {
    id: 'investment',
    category: 'Buying',
    question: 'Do you have brokers who specialize in investment or second-home properties?',
    answer:
      'Yes. We work with second-home buyers across Bend, Sunriver, Vandevert Ranch, Crooked River Ranch, and the Cascade resort communities. We also work with investor clients looking at long-term holds, value-add opportunities, and 1031 exchanges. We do not manage rental properties for clients, but we have working relationships with reputable property managers in town and we can introduce you.',
  },
  {
    id: 'relocations',
    category: 'Buying',
    question: 'Can you help with relocations from out of state?',
    answer:
      'Yes. A large share of our business is relocations into Central Oregon from California, Washington, Colorado, and the Midwest. We do virtual tours, custom market reports for the neighborhoods you are considering, and we coordinate with lenders and title teams to make a long-distance close work smoothly. We are honest about what life in Bend is and is not so you arrive with realistic expectations.',
  },
  {
    id: 'expired-listing',
    category: 'Selling',
    question: 'Do you work with sellers whose home did not sell with another agent?',
    answer:
      'Yes, and we take that work seriously. If your listing expired or you withdrew, we start with an honest audit of what happened. We look at pricing, presentation, photography, marketing reach, and feedback from the original showings. Then we put together a re-launch plan only if we believe it actually has a strong chance to perform. If we do not think we can do better, we will tell you.',
  },
  {
    id: 'service-area',
    category: 'Neighborhoods',
    question: 'What areas outside of Bend do you cover?',
    answer:
      'Our service area covers Bend, Tumalo, Redmond, Sisters, Sunriver, Tetherow, La Pine, Prineville, Terrebonne, Eagle Crest, Crooked River Ranch, Seventh Mountain, and Deschutes River Woods. We can take on work in the broader Central Oregon area when the fit makes sense. If your property is far outside our area of competency, we will refer you to a broker who knows that pocket of the market.',
  },
  {
    id: 'new-construction',
    category: 'Buying',
    question: 'Do you handle new construction or only resale homes?',
    answer:
      "Both. We represent buyers on new construction throughout Bend and Redmond, including walking the floor plans, reviewing builder contracts, negotiating upgrades, and managing inspections at key construction milestones. We also list resale homes across all of Central Oregon. If you are considering new construction, talk to us before you visit the model homes. The builder's onsite representative works for the builder, not for you.",
  },
  {
    id: 'market-report',
    category: 'Working with us',
    question: 'Is there a market report you publish regularly?',
    answer:
      'Yes. We publish a monthly Central Oregon market report covering Bend, Redmond, Sisters, Sunriver, and the resort communities. The report includes median price, days on market, months of supply by neighborhood, and a short narrative on what the data is telling us. You can find the current report on our market page or ask us to email it to you.',
  },
  {
    id: 'availability',
    category: 'Working with us',
    question: 'Are you available evenings and weekends for showings?',
    answer:
      'Yes. Bend buyers and sellers do most of their thinking outside of standard business hours, and we work the schedule you need. We routinely run showings on weekday evenings and Saturdays and Sundays. Just tell us what works for you and we will make it happen.',
  },
]

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

function FAQItemBlock({ item }: { item: FAQItem }) {
  return (
    <section id={item.id} className="border-b border-border py-8">
      <h2 className="mb-3 scroll-mt-24 text-2xl font-medium leading-tight text-foreground">
        {item.question}
      </h2>
      <p className="text-base leading-relaxed text-muted-foreground">{item.answer}</p>
    </section>
  )
}

export default async function FAQPage() {
  try {
    const [session, fubPersonId] = await Promise.all([
      getSession().catch(() => null),
      getFubPersonIdFromCookie().catch(() => null),
    ])
    const pageUrl = `${getCanonicalSiteUrl()}/faq`
    const pageTitle = 'FAQ | Ryan Realty Bend'
    trackPageViewIfPossible({
      sessionUser: session?.user ?? undefined,
      fubPersonId: fubPersonId ?? undefined,
      pageUrl,
      pageTitle,
    })
  } catch (err) {
    console.error('[FAQPage]', err)
  }

  // Group for the table-of-contents
  const categories: FAQItem['category'][] = ['Neighborhoods', 'Buying', 'Selling', 'Working with us']
  const grouped = categories.map((cat) => ({
    cat,
    items: FAQ.filter((f) => f.category === cat),
  }))

  return (
    <main className="min-h-screen bg-background">
      {/* JSON-LD FAQPage schema for Gemini Ask Maps + Google Search featured snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />

      <ContentPageHero
        title="Frequently asked questions"
        subtitle="Honest answers to the questions Bend buyers and sellers ask us every week."
        imageUrl={CONTENT_HERO_IMAGES.about}
        ctas={[
          { label: 'Talk to us', href: '/contact', primary: true },
          { label: 'Latest market report', href: '/market-report', primary: false },
        ]}
      />

      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        {/* Mini ToC */}
        <nav className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {grouped.map((g) => (
            <a
              key={g.cat}
              href={`#${g.cat.toLowerCase().replace(/\s+/g, '-')}`}
              className="rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {g.cat}
              <span className="ml-2 text-xs text-muted-foreground">({g.items.length})</span>
            </a>
          ))}
        </nav>

        {grouped.map((g) => (
          <section
            key={g.cat}
            id={g.cat.toLowerCase().replace(/\s+/g, '-')}
            className="mb-12 scroll-mt-24"
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {g.cat}
            </h2>
            <div>
              {g.items.map((item) => (
                <FAQItemBlock key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}

        <div className="mt-16 rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="mb-3 text-xl font-medium text-foreground">
            Have a question we did not cover?
          </h2>
          <p className="mb-6 text-base text-muted-foreground">
            Reach out and we will give you a direct answer. No pitch, no pressure.
          </p>
          <Link href="/contact">
            <Button>Contact Ryan Realty</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
