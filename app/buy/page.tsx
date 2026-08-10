/**
 * Buy page (/buy) — KB (kinetic-brutalist) design, Phase 9 page-class migration.
 *
 * RESTYLED IN PLACE: every section, the DAL hero fetch (getSurfaceImage), all
 * value props, the process walkthrough, the buyer-guide sub-pages, mid-page
 * listing-alert capture, the full 6-item FAQ, and the BreadcrumbList + WebPage
 * + FAQPage JSON-LD are preserved. Only the presentation moved to the KB look
 * (navy + cream surfaces, Amboqia display headings, hard --edge borders, the
 * .section/.wrap rhythm, .mono-* labels), built entirely from existing kb.css
 * classes + Tailwind utilities (no inline <style> block - D32).
 * CHROME: Global PublicNav in app/layout.tsx owns the top bar (KbNav from
 * lib/site-nav.ts). This page owns KbFooter only — do not re-mount KbNav.
 * HideChrome is only for the not-found footer edge case / CSS hide if still used.
 *
 * DATA ACCURACY (CLAUDE.md §0): all value props describe real capabilities only.
 * No invented stats, no sale-percentages, no days-to-close claims. Hero photo
 * pulled from getSurfaceImage (approved asset library). Primary capture is
 * mid-page KbCommunityAlerts (same free listing_alerts product as homepage:
 * Central Oregon + propertyType A SFR). /lp/buyer-listing-alerts remains a
 * quiet secondary link for ads that need a dedicated landing URL.
 *
 * Brand voice (CLAUDE.md §3): sentence-case headings, no em-dashes, no banned
 * words. Copy is unchanged from the prior verified version.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/buy/parity.json (KB set).
 */

import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import '@/components/site/kb/kb.css'

export const revalidate = 300

export const metadata = pageMetadata({
  title: 'Buy a home in Central Oregon · Ryan Realty',
  description:
    'Homes for sale across Bend, Redmond, Sisters, Sunriver, and the towns around them. Live MLS data, and one broker from your first search to closing.',
  path: '/buy',
  ogImage: '/images/homepage/sisters-downtown-three-peaks.jpg',
  keywords: [
    'buy home Bend Oregon',
    'Central Oregon homes for sale',
    'Bend real estate buyer',
    'Ryan Realty buyer',
    'homes for sale Bend',
  ],
})

const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a buyer-representation agreement before touring homes?',
    answer:
      'Under the 2024 NAR settlement rules, a written buyer-broker agreement is required before we tour a home together. We walk through that agreement before the first showing so you know what you are signing and why.',
  },
  {
    question: 'How much earnest money is typical in Central Oregon?',
    answer:
      'Most accepted offers in the Bend area put 1 to 3 percent of the purchase price in earnest money. Competitive listings can require more. We set the number from the specific listing and what similar homes are closing with.',
  },
  {
    question: 'How do I get matched to listings without signing up for a national portal?',
    answer:
      'Send your criteria through our buyer alert form. A Ryan Realty broker pulls matches from the MLS and sends them to you. Nothing on that list is ranked by ad spend.',
  },
  {
    question: 'What areas do you help buyers in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding resort and rural communities.',
  },
  {
    question: 'What is the typical timeline from offer to closing?',
    answer:
      'A standard residential deal in Oregon closes in 30 to 45 days after acceptance. Cash can close in 10 to 21 days. Resort communities and vacant land often take longer for title and survey work.',
  },
  {
    question: 'How does a buyer broker get paid?',
    answer:
      'In most deals the seller offers a buyer-agent commission in the MLS. If the seller offers nothing, the buyer-broker fee is written into your buyer-broker agreement before we tour. You see the number before you sign.',
  },
] as const

const OLD_MILL_HERO = '/images/homepage/sisters-downtown-three-peaks.jpg'

// Hero quick-links (preserved from the prior version — every destination kept).
const HERO_CHIPS = [
  { label: 'Search homes', href: '/homes-for-sale' },
  { label: 'Get listing alerts', href: '#get-alerts' },
  { label: 'Open houses', href: '/open-houses' },
  { label: 'Price drops', href: '/price-drops' },
  { label: 'Talk to a broker', href: '/contact?inquiry=Buying' },
  { label: 'Area guides', href: '/area-guides' },
] as const

// Why work with us — value-prop grid (Layer B body).
const VALUE_PROPS = [
  {
    heading: 'Wells, septic, and HOA history',
    body: 'Our brokers live here. Ask about the well and septic on a rural parcel, the HOA history in a resort community, or what the last four homes on that street closed for. The person in the driveway answers.',
  },
  {
    heading: 'Listings straight from the MLS',
    body: 'Save a search, get an alert the day a match hits, and book a showing. Nothing on this site is ranked by what someone paid to promote it.',
  },
  {
    heading: 'No transaction desk, no hand-off',
    body: 'The broker who tours with you writes the offer, negotiates it, and sits at closing. You are not handed to a coordinator you have not met.',
  },
] as const

// How it works — process steps (Layer B body).
const PROCESS_STEPS = [
  {
    step: '01',
    lead: 'Tell us what you want.',
    body: 'Share criteria, neighborhoods, and budget. We set an MLS search and send new matches as they list.',
  },
  {
    step: '02',
    lead: 'Tour the home.',
    body: 'We walk it with you and name what the photos leave out: schools, commute, HOA history, and the known issues in that subdivision.',
  },
  {
    step: '03',
    lead: 'Write the offer.',
    body: 'We pull recent closed comps for that address, show sale price and days on market, and write the offer from those numbers.',
  },
  {
    step: '04',
    lead: 'Close.',
    body: 'From inspection through appraisal to the table, the same broker stays with you. Every document gets a read before you sign.',
  },
] as const

// Buyer guides — strategy sub-pages (Layer B body; hrefs unchanged).
const BUYER_GUIDES = [
  {
    href: '/buy/first-time-home-buyer',
    heading: 'First-time buyer plan',
    body: 'Down-payment programs, what to inspect, and a realistic timeline for a first home in Central Oregon.',
  },
  {
    href: '/buy/relocation',
    heading: 'Relocation guidance',
    body: 'Moving to Bend or Central Oregon from out of state. What the market looks like before you arrive, and how to tour on a short visit.',
  },
  {
    href: '/buy/investment',
    heading: 'Investment strategy',
    body: 'Vacation rentals, long-term rent, and how to underwrite cash flow on a Central Oregon property.',
  },
] as const

export default async function BuyPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/buy',
    fallback: OLD_MILL_HERO,
  })

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="buy" />

      {/* JSON-LD: breadcrumb + webPage + RealEstateAgent organization + FAQPage */}
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Buy', url: '/buy' },
            ],
          },
          {
            type: 'webPage',
            name: 'Buy a home in Central Oregon · Ryan Realty',
            description:
              'Homes for sale across Bend, Redmond, Sisters, Sunriver, and the towns around them. Live MLS data, and one broker from your first search to closing.',
            url: '/buy',
          },
          {
            type: 'faqPage',
            items: [...FAQ_ITEMS],
          },
        ]}
      />

      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Buy' }]} />

      <style>{`@media(min-width:760px){.kb-root .buy-hero{min-height:clamp(440px,68vh,620px);height:auto}}`}</style>
      <SmoothScrollProvider>
        {/* HERO — headline + broker lede + canonical photo + quick-links.
            Restyled in place (kept the 5 quick-links the KB shared hero can't
            carry; full-bleed photo with masked navy overlay, Amboqia H1). */}
        {/* Compact hero on >=760px only — on phones the 4-line H1 + lede + 5
            chips overflow a 68vh box upward into the fixed nav (design-audit
            P1); mobile keeps the KB default 100svh bottom-anchored hero. */}
        <section className="hero buy-hero" id="top">
          <div className="hero-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hero-video"
              src={heroSrc ?? OLD_MILL_HERO}
              alt="Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains."
            />
          </div>
          <div className="hero-grid-overlay" />
          <div className="hero-inner">
            <div className="hero-tag eyebrow">
              <span className="dot" /> Central Oregon · Buyers
            </div>
            <h1 className="hero-h display">
              <span className="reveal-mask">
                <span className="ln">Buy a home in</span>
              </span>
              <span className="reveal-mask">
                <span className="ln indent">Central Oregon.</span>
              </span>
            </h1>
            <div className="hero-sub-row">
              <p className="hero-sub">
                Every active MLS listing in Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. The broker who
                walks the house with you writes the offer and sits at closing.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2.5 mt-5" aria-label="Buyer quick links">
              {/* design-audit CNV-5: the funnel entry had five identical ghost
                  buttons and no clear primary. "Search homes" is the primary
                  buyer action — render it filled, the rest ghost. */}
              {HERO_CHIPS.map((c, i) => (
                <a key={c.href} className={i === 0 ? 'btn' : 'btn ghost'} href={c.href} style={{ padding: '11px 16px', fontSize: '.7rem' }}>
                  {c.label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* WHY WORK WITH US — value-prop grid (cream surface). */}
        <section className="section about" id="why-us" aria-labelledby="why-us-title">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Why work with us</span>
              <h2 className="sec-title display" id="why-us-title">
                The broker who walks the house writes the offer.
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3" style={{ paddingTop: 'clamp(30px,4vw,46px)' }}>
              {VALUE_PROPS.map((item) => (
                <div key={item.heading} className="flex flex-col gap-3">
                  <h3 className="display" style={{ fontSize: 'clamp(1.25rem,2.2vw,1.6rem)', lineHeight: 1 }}>
                    {item.heading}
                  </h3>
                  <p
                    style={{
                      fontSize: 'clamp(.95rem,1.5vw,1.05rem)',
                      lineHeight: 1.5,
                      fontWeight: 500,
                      color: 'var(--navy-70)',
                    }}
                  >
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — numbered process steps (navy surface). */}
        <section
          className="section"
          id="how-it-works"
          aria-labelledby="how-it-works-title"
          style={{ background: 'var(--navy)', color: 'var(--cream)', paddingBottom: 'clamp(48px,7vw,72px)' }}
        >
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--cream-40)' }}>
              <span className="sec-index">How it works</span>
              <h2 className="sec-title display" id="how-it-works-title">
                Search, tour, offer, close.
              </h2>
            </div>
            <ol className="list-none flex flex-col" style={{ paddingTop: 'clamp(18px,3vw,30px)' }}>
              {PROCESS_STEPS.map((s, i) => (
                <li
                  key={s.step}
                  className="grid items-baseline"
                  style={{
                    gridTemplateColumns: 'auto 1fr',
                    gap: 'clamp(16px,3vw,40px)',
                    padding: 'clamp(22px,3vw,30px) 0',
                    borderBottom: i === PROCESS_STEPS.length - 1 ? '0' : '1px solid var(--cream-40)',
                  }}
                >
                  <span
                    className="mono-num display"
                    aria-hidden="true"
                    style={{ fontSize: 'clamp(1.8rem,5vw,2.8rem)', lineHeight: 0.9, color: 'var(--cream-70)' }}
                  >
                    {s.step}
                  </span>
                  <p
                    style={{
                      fontSize: 'clamp(.98rem,1.6vw,1.18rem)',
                      lineHeight: 1.5,
                      fontWeight: 500,
                      color: 'var(--cream-70)',
                      maxWidth: '62ch',
                    }}
                  >
                    <strong style={{ color: 'var(--cream)', fontWeight: 700 }}>{s.lead}</strong> {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* BUYER GUIDES — strategy sub-pages (cream surface, reuses .articles cards). */}
        <section className="section articles about" id="buyer-guides" aria-labelledby="buyer-guides-title">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Buyer guides</span>
              <h2 className="sec-title display" id="buyer-guides-title">
                First-time buyers, relocations, and investment property.
              </h2>
            </div>
            <div className="art-grid" style={{ paddingTop: 'clamp(18px,3vw,30px)' }}>
              {BUYER_GUIDES.map((item) => (
                <a key={item.href} href={item.href} className="art-card">
                  <div className="art-body">
                    <h3 className="art-title display">{item.heading}</h3>
                    <p className="art-excerpt">{item.body}</p>
                    <span className="art-read">
                      Read the guide <span className="arr">&rarr;</span>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Mid-page buyer capture — same free listing_alerts product as homepage
            (E2 craft on /). propertyType A = SFR across the regional MLS so
            hasNarrowingFilter passes without inventing a city. LP stays a
            quiet secondary for ad landing URLs only. */}
        <div id="get-alerts">
          <KbCommunityAlerts
            communityName="Central Oregon"
            city=""
            extraFilters={{ propertyType: 'A' }}
            headline="Central Oregon"
            body="Enter your email. When a single-family home hits the market in Bend, Redmond, Sisters, Sunriver, or nearby, you hear first."
          />
        </div>
        <p
          className="wrap"
          style={{
            textAlign: 'center',
            margin: 0,
            padding: '0 0 clamp(28px,4vw,40px)',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--navy-70)',
          }}
        >
          <a
            href="/lp/buyer-listing-alerts"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Prefer a longer form
          </a>
          {' · '}
          <a href="/contact?inquiry=Buying" className="underline underline-offset-2 hover:text-foreground">
            Talk to a broker
          </a>
        </p>

        {/* FAQ — verified buyer facts (cream surface). The canonical FAQPage
            JSON-LD is emitted by MetadataBlock above, so none is duplicated here. */}
        <section className="section about" id="faq" aria-labelledby="faq-title">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Common questions</span>
              <h2 className="sec-title display" id="faq-title">
                Buying with Ryan Realty
              </h2>
            </div>
            <dl style={{ paddingTop: 'clamp(18px,3vw,30px)', borderTop: '1px solid var(--navy-12)' }}>
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.question}
                  style={{ padding: 'clamp(20px,2.6vw,28px) 0', borderBottom: '1px solid var(--navy-12)' }}
                >
                  {/* design-audit #170: this used the Amboqia display face
                      (className="display") for multi-line, mixed-case
                      question text -- a capital "I" reads as a lowercase
                      "l" in Amboqia at body scale. FAQBlock (used on /team
                      and elsewhere) sets FAQ questions in bold Geist via
                      the H3 primitive; matched that here. */}
                  <dt
                    className="font-bold"
                    style={{
                      fontFamily: 'var(--font-sans), sans-serif',
                      fontSize: 'clamp(1.05rem,1.8vw,1.3rem)',
                      lineHeight: 1.3,
                      color: 'var(--navy)',
                      marginBottom: 10,
                    }}
                  >
                    {item.question}
                  </dt>
                  <dd
                    style={{
                      fontSize: 'clamp(.95rem,1.6vw,1.1rem)',
                      lineHeight: 1.55,
                      fontWeight: 500,
                      color: 'var(--navy-70)',
                      maxWidth: '74ch',
                    }}
                  >
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
