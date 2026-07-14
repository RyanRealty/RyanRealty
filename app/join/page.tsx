/**
 * Join page (/join) — broker recruiting.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE. Every piece of content from the prior site-v2 build is preserved:
 *   - export const metadata + revalidate (SEO gate)
 *   - getSurfaceImage('hero', …) DAL call for the hero photo
 *   - webPage + BreadcrumbList JSON-LD (MetadataBlock)
 *   - FAQPage JSON-LD (MetadataBlock, type 'faqPage')
 *   - hero headline + lede + the three chips (Start the conversation / See how
 *     we market listings / Meet the brokers) as a KB CTA row
 *   - the four LISTING_SUPPORT cards (Production handled / Pricing from live
 *     data / Its own page + distribution / A written report every week)
 *   - the four "How the brokerage works" copy blocks, with the /housing-market
 *     internal link preserved
 *   - the CTABar copy (Start the conversation + get-in-touch + call CTAs)
 *   - all six FAQ items
 *
 * The shadcn site-v2 blocks (HeroBlock, ContentSection, CTABar, FAQBlock,
 * primitives) are replaced by the KB shell + KB visual classes/tokens. No copy,
 * no data fetch, no JSON-LD, no link is dropped. The page reuses only the
 * shared KB classes from kb.css (.section/.wrap/.sec-head/.sec-title/.display/
 * .btn/.mono-num/.listings) plus inline token styles — no per-page <style>
 * block, no forked component.
 *
 * VOICE (CLAUDE.md): the recruit is an intelligent professional. No smallness
 * positioning, no pandering, no self-described virtues. The pitch is what the
 * brokerage actually operates. Commission split is stated as a conversation,
 * never an invented number. DATA ACCURACY: no closing counts, no agent count,
 * no invented split, no production figures — only process facts already stated
 * on /sell plus verifiable named entities.
 */

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { CONTACT } from '@/lib/brand/contact'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Join Ryan Realty · brokers, Central Oregon',
  description:
    'Bring your listings to a Bend brokerage that markets every one of them: a listing film, a 3D walkthrough, live-data pricing, and a written report every week. You keep your client from first call to closing.',
  path: '/join',
  ogImage: '/images/office/ryan-realty-bend-office-interior-01.jpg',
  keywords: [
    'real estate broker jobs Bend Oregon',
    'join brokerage Central Oregon',
    'Bend real estate careers',
    'Ryan Realty broker',
  ],
})

const OLD_MILL_HERO = '/images/office/ryan-realty-bend-office-interior-01.jpg'

const LISTING_SUPPORT = [
  {
    title: 'Production handled for you',
    body: 'A listing film, a 3D walkthrough, and professional photography within 48 hours of a signed agreement. Produced by the brokerage, on every listing, at every price point. Not a cost you carry.',
  },
  {
    title: 'Pricing built from live data',
    body: 'A written CMA with three closed comps, three active comps, and the four levers that move the price, built from live MLS data running on ryan-realty.com. Your seller sees every number.',
  },
  {
    title: 'Its own page and full distribution',
    body: 'Every listing gets its own page on ryan-realty.com, full MLS syndication across Central Oregon, and native posts on @ryanrealtybend across Instagram, Facebook, TikTok, and YouTube.',
  },
  {
    title: 'A written report every week',
    body: 'Each week a listing is on the market, the seller gets a written update: showings, online traffic, where the views came from, and feedback. Your clients see the work, in writing.',
  },
] as const

const HOW_IT_WORKS = [
  {
    lead: 'You keep your client, start to finish.',
    body: 'No call center, no shared lead pool you compete inside, no hand-off to a closing coordinator the client never met. The broker who takes the call is the broker at the table.',
  },
  {
    lead: 'A principal broker supervises every transaction.',
    body: 'Matt Ryan is the principal broker. A question on a contingency, a contract, or a difficult close gets answered by a licensed principal broker, not a queue.',
  },
  {
    // The /housing-market internal link is preserved by splitting the copy
    // around it; rendered inline in the JSX below.
    lead: 'Central Oregon is the whole map.',
    bodyBefore:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities. The market data on ',
    bodyAfter: ' updates from the MLS daily, and it is the same data you price from.',
    link: { href: '/housing-market', label: 'ryan-realty.com' },
  },
  {
    lead: 'The split is a conversation, not a banner.',
    body: 'It is set with you, based on the business you bring and the business you want to build. The first conversation covers the numbers directly.',
  },
] as const

const FAQ_ITEMS = [
  {
    question: 'Do you work with brokers who are new to the industry?',
    answer:
      'Yes. Whether you have a new license or twenty years in the business, the first conversation is the same: what you want to build and how the brokerage helps you build it. A principal broker supervises every transaction either way.',
  },
  {
    question: 'What happens to my current clients and pipeline?',
    answer:
      'They come with you. You keep the relationship from the first call to the closing table. Nothing in the model puts a call center or another broker between you and your client.',
  },
  {
    question: 'What is the commission split?',
    answer:
      'It is set with you, based on your business. There is no single published split because there is not one. The first conversation covers the numbers directly.',
  },
  {
    question: 'Do I have to produce my own listing marketing?',
    answer:
      'No. The listing film, the 3D walkthrough, the photography, the listing page, the social posts, and the weekly seller report are produced by the brokerage, on every listing.',
  },
  {
    question: 'Where does Ryan Realty work?',
    answer:
      'Central Oregon only: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities.',
  },
  {
    question: 'How do I start?',
    answer:
      'Send a note through the contact form or call. The first conversation is with a broker, not a recruiter, and there is no script.',
  },
] as const

// Inline token styles — KB tokens only (no off-brand hex). Module-scope objects
// keep the JSX readable and satisfy the no-<style>-element rule (D32).
const ledeStyle: CSSProperties = {
  maxWidth: '52ch',
  color: 'var(--navy-70)',
  fontSize: 'clamp(1rem,1.7vw,1.18rem)',
  lineHeight: 1.55,
  fontWeight: 500,
}
const cardTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.15rem,2.4vw,1.45rem)',
  fontWeight: 700,
  lineHeight: 1.12,
  letterSpacing: '-0.01em',
  color: 'var(--navy)',
}
const cardBodyStyle: CSSProperties = {
  marginTop: 11,
  maxWidth: '46ch',
  color: 'var(--navy-70)',
  fontSize: 'clamp(.95rem,1.5vw,1.05rem)',
  lineHeight: 1.6,
  fontWeight: 500,
}
const cardIdxStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-amboqia-safe),serif',
  fontSize: '1.5rem',
  lineHeight: 1,
  color: 'var(--navy)',
  opacity: 0.45,
  marginBottom: 14,
}
const howLeadStyle: CSSProperties = {
  fontSize: 'clamp(1.1rem,2.2vw,1.35rem)',
  fontWeight: 700,
  lineHeight: 1.18,
  color: 'var(--cream)',
}
const howBodyStyle: CSSProperties = {
  marginTop: 11,
  maxWidth: '48ch',
  color: 'var(--cream-70)',
  fontSize: 'clamp(.95rem,1.5vw,1.05rem)',
  lineHeight: 1.6,
  fontWeight: 500,
}
const faqQStyle: CSSProperties = {
  fontFamily: 'var(--font-amboqia-safe),serif',
  fontSize: 'clamp(1.3rem,3vw,1.9rem)',
  lineHeight: 1.02,
  letterSpacing: '-0.01em',
  color: 'var(--navy)',
}
const faqAStyle: CSSProperties = {
  color: 'var(--navy-70)',
  maxWidth: '54ch',
  fontSize: 'clamp(.97rem,1.5vw,1.08rem)',
  lineHeight: 1.62,
  fontWeight: 500,
}

export default async function JoinPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/join',
    fallback: OLD_MILL_HERO,
  })

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="join" />

      <MetadataBlock
        schemas={[
          {
            type: 'webPage',
            name: 'Join Ryan Realty',
            description:
              'Broker recruiting for Ryan Realty, a Bend, Oregon brokerage that markets every listing and keeps each broker with their client from first call to closing.',
            url: '/join',
          },
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Join the team', url: '/join' },
            ],
          },
        ]}
      />
      {/* FAQPage JSON-LD preserved from the prior FAQBlock (it emitted this
          schema automatically). The visible FAQ below carries no schema, so it
          lives here once. */}
      <MetadataBlock schema={{ type: 'faqPage', items: FAQ_ITEMS }} />

      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Join the team' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Hero — same headline + lede as the prior HeroBlock. Recruiting page
            has no live market data, so the HUD numbers are null (the KbHero
            sub-row degrades gracefully to "Homes for sale" + lead with no
            invented figures). The poster is the resolved surface image, or the
            canonical Old Mill hero as a fallback. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Join Ryan Realty · Brokers"
          titleTop="Every listing you"
          titleBottom="bring gets the plan"
          lead="A listing film, a 3D walkthrough, a price built from live MLS data, and a written report every week. Not only at the top of the market. On all of them. You keep your client from the first call to the closing table."
          videoSrc={null}
          posterSrc={heroSrc ?? OLD_MILL_HERO}
        />

        {/* The three hero chips from the prior HeroBlock, preserved as a KB CTA
            row so every destination stays one tap away. */}
        <section className="section" id="join-cta" aria-label="Start the conversation">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-3">
              <Link href="/contact?inquiry=Join%20the%20team" className="btn alt">
                Start the conversation <span className="arr">→</span>
              </Link>
              <Link
                href="/sell#marketing-plan"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                See how we market listings <span className="arr">→</span>
              </Link>
              <Link
                href="/team"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Meet the brokers <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* What your listings get — the four LISTING_SUPPORT cards. Restyled
            onto a KB hard-edge grid (cream .listings surface). Empty-safe: the
            array is a constant, always four cards. */}
        <section className="section listings" id="listing-support" aria-label="What your listings get">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">What your listings get</span>
              <h2 className="sec-title display">
                The brokerage markets
                <br />
                the listing
              </h2>
            </div>
            <p className="pt-6" style={ledeStyle}>
              The same plan runs on every listing, the one a seller can read on the sell page. It is
              produced for you, so the marketing is not a line item you cover or a weekend you lose.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 mt-8" style={{ borderTop: 'var(--edge) solid var(--navy)' }}>
              {LISTING_SUPPORT.map((item, i) => (
                <div
                  key={item.title}
                  className="py-7 md:px-9"
                  style={{ borderBottom: 'var(--edge) solid var(--navy)' }}
                >
                  <span className="mono-num" style={cardIdxStyle}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 style={cardTitleStyle}>{item.title}</h3>
                  <p style={cardBodyStyle}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How the brokerage works — navy surface, the four copy blocks from the
            prior ContentSection. The /housing-market internal link is preserved
            inline in the third block. The .sec-head border resolves to cream on
            navy via currentColor. */}
        <section
          className="section"
          id="how-it-works"
          aria-label="How the brokerage works"
          style={{ background: 'var(--navy)', color: 'var(--cream)', paddingBottom: 54 }}
        >
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index" style={{ color: 'var(--cream-70)' }}>
                How the brokerage works
              </span>
              <h2 className="sec-title display">
                One broker on the deal.
                <br />A principal broker on call.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              {HOW_IT_WORKS.map((item) => (
                <div
                  key={item.lead}
                  className="py-7 md:px-10"
                  style={{ borderBottom: '1px solid var(--cream-40)' }}
                >
                  <h3 style={howLeadStyle}>{item.lead}</h3>
                  <p style={howBodyStyle}>
                    {'link' in item ? (
                      <>
                        {item.bodyBefore}
                        <Link
                          href={item.link.href}
                          style={{
                            color: 'var(--cream)',
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                            fontWeight: 600,
                          }}
                        >
                          {item.link.label}
                        </Link>
                        {item.bodyAfter}
                      </>
                    ) : (
                      item.body
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Start the conversation — the prior CTABar (navy tone). Both CTAs
            preserved (get in touch + call). */}
        <section
          className="section"
          id="get-in-touch"
          aria-label="Start the conversation"
          style={{ background: 'var(--navy)', color: 'var(--cream)' }}
        >
          <div className="wrap">
            <div style={{ maxWidth: '60ch', paddingTop: 'clamp(46px,7vw,80px)', paddingBottom: 'clamp(46px,7vw,80px)' }}>
              <span className="sec-index" style={{ display: 'block', marginBottom: 16, color: 'var(--cream-70)' }}>
                Thinking about a move?
              </span>
              <h2
                className="display"
                style={{
                  fontSize: 'clamp(2.4rem,9vw,5.5rem)',
                  lineHeight: 0.88,
                  color: 'var(--cream)',
                  marginBottom: 18,
                }}
              >
                Start the
                <br />
                conversation
              </h2>
              <p
                style={{
                  maxWidth: '46ch',
                  marginBottom: 26,
                  color: 'var(--cream-70)',
                  fontSize: 'clamp(1rem,2vw,1.18rem)',
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                Send a note or call. The first conversation is with a broker, not a recruiter, and
                there is no script.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact?inquiry=Join%20the%20team" className="btn ghost">
                  Get in touch <span className="arr">→</span>
                </Link>
                <a href={`tel:${CONTACT.phoneDirectTel}`} className="btn ghost">
                  Call {CONTACT.phoneDirect}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Common questions — the six FAQ items. Native <dl> for semantics; the
            FAQPage JSON-LD is emitted once above via MetadataBlock. Cream
            surface. */}
        <section
          className="section listings"
          id="faq"
          aria-label="Joining Ryan Realty, common questions"
        >
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Common questions</span>
              <h2 className="sec-title display">Joining Ryan Realty</h2>
            </div>
            <dl className="mt-8" style={{ borderTop: 'var(--edge) solid var(--navy)' }}>
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.question}
                  className="py-6 md:grid md:grid-cols-[1fr_1.2fr] md:gap-x-10"
                  style={{ borderBottom: '1px solid var(--navy-12)' }}
                >
                  <dt style={faqQStyle}>{item.question}</dt>
                  <dd className="mt-3 md:mt-0" style={faqAStyle}>{item.answer}</dd>
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
