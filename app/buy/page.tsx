/**
 * Buy page (/buy) — KB (kinetic-brutalist) design, Phase 9 page-class migration.
 *
 * RESTYLED IN PLACE: every section, the DAL hero fetch (getSurfaceImage), all
 * value props, the process walkthrough, the buyer-guide sub-pages, the CTA band,
 * the full 6-item FAQ, and the BreadcrumbList + WebPage + FAQPage JSON-LD are
 * preserved verbatim. Only the presentation moved to the KB look (navy + cream
 * surfaces, Amboqia display headings, hard --edge borders, the
 * .section/.wrap rhythm, .mono-* labels), built entirely from existing kb.css
 * classes + Tailwind utilities (no inline <style> block — D32). KB chrome
 * (KbNav + KbFooter) replaces the default site header/footer (HideChrome hides
 * them for /buy).
 *
 * DATA ACCURACY (CLAUDE.md §0): all value props describe real capabilities only.
 * No invented stats, no sale-percentages, no days-to-close claims. Hero photo
 * pulled from getSurfaceImage (approved asset library). The lead path is the
 * existing /lp/buyer-listing-alerts LP (captures the lead + triggers the FUB
 * buyer workflow). This page has no embedded form.
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
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import '@/components/site/kb/kb.css'

export const revalidate = 300

export const metadata = pageMetadata({
  title: 'Buy a home in Central Oregon · Ryan Realty',
  description:
    'Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Live MLS data, and one broker from your first search to closing.',
  path: '/buy',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
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
      'Under the 2024 NAR settlement rules, a written buyer-broker agreement is required before we tour a home together. We walk you through the agreement before your first showing so you know exactly what you are signing and why.',
  },
  {
    question: 'How much earnest money is typical in Central Oregon?',
    answer:
      'Most accepted offers in the Bend area carry 1 to 3 percent of the purchase price in earnest money. In competitive situations that number can be higher. We advise on the amount based on the specific listing and current market conditions.',
  },
  {
    question: 'How do I get matched to listings without signing up for a national portal?',
    answer:
      'Submit your criteria through our buyer alert form and a Ryan Realty broker pulls matching listings directly from the MLS. You receive real listings, not algorithmically ranked advertisements.',
  },
  {
    question: 'What areas do you help buyers in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding resort and rural communities.',
  },
  {
    question: 'What is the typical timeline from offer to closing?',
    answer:
      'A standard residential transaction in Oregon closes in 30 to 45 days after an accepted offer. Cash transactions can close in 10 to 21 days. Resort communities and vacant land can run longer depending on title and survey work.',
  },
  {
    question: 'How does a buyer broker get paid?',
    answer:
      'In most transactions the seller offers a buyer-agent commission in the MLS. If the seller offers nothing, the buyer-broker fee is discussed and agreed in your buyer-broker agreement before we tour. The number is on the table before you sign anything.',
  },
] as const

const OLD_MILL_HERO = '/brand/hero/hero-old-mill-master-4k.jpg'

// Hero quick-links (preserved from the prior version — every destination kept).
const HERO_CHIPS = [
  { label: 'Search homes', href: '/homes-for-sale' },
  { label: 'Get listing alerts', href: '/lp/buyer-listing-alerts' },
  { label: 'Price drops', href: '/price-drops' },
  { label: 'Talk to a broker', href: '/contact?inquiry=Buying' },
  { label: 'Area guides', href: '/area-guides' },
] as const

// Why work with us — value-prop grid (copy preserved verbatim).
const VALUE_PROPS = [
  {
    heading: 'Local market knowledge',
    body: 'Brokers who live and work in Central Oregon. We know Bend, Redmond, Sisters, Sunriver, and every neighborhood in between. The people showing you homes are the same people who can tell you where water pressure is unreliable and which streets flood in spring.',
  },
  {
    heading: 'Live MLS listings',
    body: 'We pull directly from the MLS. Save searches, receive alerts when a match hits, and schedule showings on your schedule. No algorithm ranking by listing fee.',
  },
  {
    heading: 'One broker, start to finish',
    body: 'The broker who tours homes with you is the broker who writes the offer, negotiates, and walks you to close. No baton-passes, no hand-offs to a transaction coordinator you have never met.',
  },
] as const

// How it works — process steps (copy preserved verbatim).
const PROCESS_STEPS = [
  {
    step: '01',
    lead: 'Tell us what you want.',
    body: 'Share your criteria, neighborhoods, and budget. We set up a custom MLS search and you receive new matches as they hit the market.',
  },
  {
    step: '02',
    lead: 'Tour with context.',
    body: 'A broker who knows the area points out what matters. Schools, commute, resale, HOA history, known issues in that subdivision. You decide with the full picture.',
  },
  {
    step: '03',
    lead: 'Make a well-priced offer.',
    body: 'We pull recent closed comps for the specific address, walk you through the numbers, and help you construct an offer that reflects the market, not wishful thinking.',
  },
  {
    step: '04',
    lead: 'Close.',
    body: 'From inspection through appraisal to the closing table, the same broker is with you. We review every document before you sign it.',
  },
] as const

// Buyer guides — strategy sub-pages (copy + hrefs preserved verbatim).
const BUYER_GUIDES = [
  {
    href: '/buy/first-time-home-buyer',
    heading: 'First-time buyer plan',
    body: 'Down-payment programs, inspection fundamentals, and a realistic timeline for buying your first home in Central Oregon.',
  },
  {
    href: '/buy/relocation',
    heading: 'Relocation guidance',
    body: 'Moving to Bend or Central Oregon from out of state. What to know about the market before you arrive, and how to tour efficiently on a short visit.',
  },
  {
    href: '/buy/investment',
    heading: 'Investment strategy',
    body: 'Vacation rental potential, long-term rental markets, and how to evaluate cash flow on a Central Oregon investment property.',
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
      <KbNav />
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
              'Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Live MLS data, and one broker from your first search to closing.',
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
                <span className="ln indent">Central Oregon</span>
              </span>
            </h1>
            <div className="hero-sub-row">
              <p className="hero-sub">
                Live MLS data, updated continuously. One broker from your first search to the closing table, so you
                always know who is accountable. We cover Bend, Redmond, Sisters, Sunriver, and the surrounding
                communities.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2.5 mt-5" aria-label="Buyer quick links">
              {HERO_CHIPS.map((c) => (
                <a key={c.href} className="btn ghost" href={c.href} style={{ padding: '11px 16px', fontSize: '.7rem' }}>
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
                Local brokers, live data, no hand-offs.
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
                From first search to keys in hand.
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
                Find the path that fits your situation.
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

        {/* CTA BAND — buyer conversion to the listing-alerts LP (navy surface). */}
        <section
          className="section"
          id="get-alerts"
          aria-labelledby="get-alerts-title"
          style={{
            background: 'var(--navy)',
            color: 'var(--cream)',
            padding: 'clamp(54px,8vw,92px) 0',
            textAlign: 'center',
          }}
        >
          <div className="wrap">
            <span className="sec-index" style={{ display: 'block', opacity: 0.78 }}>
              Ready to start searching?
            </span>
            <h2
              className="display"
              id="get-alerts-title"
              style={{ fontSize: 'clamp(2rem,6vw,4rem)', lineHeight: 0.94, margin: '16px 0 18px' }}
            >
              Get matched listings from a local broker.
            </h2>
            <p
              style={{
                maxWidth: '54ch',
                margin: '0 auto 28px',
                color: 'var(--cream-70)',
                fontSize: 'clamp(.98rem,1.8vw,1.2rem)',
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Share your criteria and a Ryan Realty broker sends matching homes directly from the MLS. No spam, no
              pressure.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a href="/lp/buyer-listing-alerts" className="btn" style={{ borderColor: 'var(--cream)' }}>
                Get listing alerts <span className="arr">&rarr;</span>
              </a>
              <a href="/contact?inquiry=Buying" className="btn ghost">
                Talk to a broker
              </a>
            </div>
          </div>
        </section>

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
