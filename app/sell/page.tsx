/**
 * /sell - the Sell landing page and seller path, on the components/site/v3
 * barrel. Rebuilt 2026-09-28 from Matt's brief and the competitor walk in
 * /workspace/competitor-sell-paths-2026-09-28/SYNTHESIS.md. Order, cuts and
 * per-section reasoning live in design_system/ryan-realty/ui_kits/sell/parity.json.
 *
 * WHO LANDS HERE. Every CMA email to a homeowner whose listing just EXPIRED
 * elsewhere, plus everyone who searches for selling in Central Oregon. So the
 * first screen at 1440x900 and 375x812 carries the whole case: the promise,
 * the proof (Google rating and count, homes sold), the broker's face, and the
 * one action.
 *
 * ONE PRIMARY ACTION. The existing value flow (SellValueForm, posting through
 * submitSellerLPForm with pagePath "/sell" and formId get-value), labelled as a
 * conversation: SELL_PRIMARY_LABEL. It is repeated once, as the final ask,
 * which links back to the same field. Call and text are small text links.
 * No sticky bar, no second form.
 *
 * ?from=cma changes ONLY the hero copy, without breaking ISR: both copies ship
 * in the static HTML (V3Stage altHeadline/altEyebrow plus two sub lines), and
 * SELL_ENTRY_SCRIPT flags html[data-sell-entry="cma"] before first paint so
 * sell-landing.css shows the CMA pair. The page never reads searchParams, so
 * plain /sell stays one cached document (revalidate 3600).
 *
 * TRACKING. SellClickTracker records every link and CTA click on the page to
 * the contact through the existing first-party and CRM sinks; every control
 * this route renders carries data-sell-cta (sell-cta-tracking.test.ts and
 * ci:sell-cta-tracking enforce it). The visit itself is the site-wide
 * VisitTracker page_view, whose pageUrl keeps from=cma. The value-flow submit
 * carries entry "cma" to the contact record. The full path is written up in
 * docs/plans/PUBLIC_PRODUCT/sell-cma-tracking.md.
 */

import type { Metadata } from 'next'
import {
  getBrokerageTrackRecord,
  getBrokers,
  getOfficeRecentClosings,
  getProofBlock,
} from '@/lib/data'
import type { ProofBlock } from '@/lib/data'
import { aboutFaceFromBroker } from '@/app/about/_v3/about-faces'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { BROKERS } from '@/lib/brand/contact'
import { uniqueReviewerInitials } from '@/lib/reviews/reviewer-initials'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3ProofBlock,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
  V3SourceDisclosure,
  proofBlockView,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SellCapture } from './_v3/SellCapture'
import { SellValueForm } from './_v3/SellValueForm'
import { SellHowWeSell } from './_v3/SellHowWeSell'
import { SellClosings } from './_v3/SellClosings'
import { SellFinalAsk } from './_v3/SellFinalAsk'
import { SellClickTracker } from './_v3/SellClickTracker'
import { SellEntryFlag } from './_v3/SellEntryFlag'
import { SELL_ENTRY_SCRIPT } from './_v3/sell-entry'
import './_v3/sell-stage.css'
import './_v3/sell-landing.css'
import {
  ROUTE_PATH,
  SELL_CMA_EYEBROW,
  SELL_CMA_HEADLINE,
  SELL_CMA_SUB,
  SELL_FAQ_ITEMS,
  SELL_HERO_SUB,
  SELL_PRIMARY_LABEL,
  TRACK_RECORD_TRACE,
} from './_v3/sell-constants'

export const revalidate = 3600

/** Pre-sized derivatives of the Drake Park aerial (public/images/sell). Each is under 300 KB. */
const SELL_HERO_SRC = '/images/sell/sell-hero-drake-park-1280.webp'
const SELL_HERO_SRCSET = [640, 960, 1280, 1920]
  .map((w) => `/images/sell/sell-hero-drake-park-${w}.webp ${w}w`)
  .join(', ')
const SELL_OG_IMAGE = '/images/sell/sell-hero-drake-park-1920.webp'
/** Matt's headshot, cropped small from /images/brokers/ryan-matt.png. */
const MATT_HEADSHOT = '/images/sell/ryan-matt-160.webp'
const MATT_HEADSHOT_2X = '/images/sell/ryan-matt-320.webp'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Sell Your Home in Central Oregon',
    description:
      'Talk with Ryan Realty about selling your Central Oregon home. A price built from the closed sales, a complete launch in week one with photos, drone, video and a 3D tour in the 3%, and a written report every week. No contract to talk.',
    path: ROUTE_PATH,
    ogImage: SELL_OG_IMAGE,
    keywords: [
      'sell home Bend Oregon',
      'Central Oregon home valuation',
      'list home Bend',
      'Ryan Realty seller',
    ],
  })
}

/** Reviews on /sell show initials only (Matt, 2026-09-28): no full client names. */
function withInitialsOnly(block: ProofBlock): ProofBlock {
  const reviews = block.reviews
  if (!reviews) return block
  const taken = new Set<string>()
  return {
    ...block,
    reviews: {
      ...reviews,
      quotes: reviews.quotes.map((q) => {
        const initials = uniqueReviewerInitials(q.author, taken)
        taken.add(initials)
        return { ...q, author: initials }
      }),
    },
  }
}

export default async function SellPage() {
  const [proofRaw, trackRecord, brokers, closings] = await Promise.all([
    getProofBlock({ geoType: 'city', geoSlug: 'bend', geoLabel: 'Bend' }).catch(() => null),
    getBrokerageTrackRecord().catch(() => null),
    getBrokers().catch(() => []),
    getOfficeRecentClosings(),
  ])

  // Faces: Matt only (Matt's ruling). His record comes off the live roster via
  // the DAL; the license falls back to the roster in lib/brand/contact.
  const mattRow = brokers.find((b) => b.slug === BROKERS.matt.slug)
  const matt = mattRow ? aboutFaceFromBroker(mattRow) : null
  const mattName = matt?.name ?? BROKERS.matt.name
  const mattFirst = mattName.split(' ')[0] ?? mattName
  const mattLicense = matt?.license ?? BROKERS.matt.license
  const mattTel = matt?.tel ?? null
  const mattPhone = matt?.phoneDisplay ?? null

  const proof = proofRaw ? withInitialsOnly(proofRaw) : null
  // MATT RULED 2026-09-08: "hold those, we only want positive". The outcome
  // strips stay off (see docs/plans/PUBLIC_PRODUCT/decisions.md). No reach
  // strip: call and text live as small links in the hero and the final ask.
  const proofView = proof
    ? proofBlockView({
        block: proof,
        id: 'proof',
        headingLevel: 2,
        attribution: { surface: 'sell', place: 'bend', source: 'proof_block' },
        reach: [],
        showOutcomes: false,
      })
    : null

  const reviewCount = proof?.reviews?.count ?? 0
  const reviewAvg = proof?.reviews?.averageRating ?? null
  const homesSold = proof?.record?.homesSold ?? trackRecord?.homesSold ?? null
  const heroProofTrace = [
    reviewCount > 0 && reviewAvg != null
      ? `Google Business Profile reviews for Ryan Realty, read through getReviews(): ${reviewCount} reviews, average ${reviewAvg.toFixed(1)}.`
      : null,
    homesSold != null ? `Homes sold: ${TRACK_RECORD_TRACE}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const quietItems: V3QuietItem[] = SELL_FAQ_ITEMS.map((item) => ({
    kind: 'prose' as const,
    term: item.question,
    body: item.answer,
  }))

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Sell', url: ROUTE_PATH },
      ],
    },
    {
      type: 'service',
      name: 'Home selling consultation and written valuation',
      serviceType: 'Comparative market analysis',
      description:
        'A conversation about selling a Central Oregon home and a written comparative market analysis built from the closed sales near it. No listing agreement required.',
      url: ROUTE_PATH,
      areaServed: 'Bend, Oregon',
      providerOrganization: true,
    },
    { type: 'faqPage', items: SELL_FAQ_ITEMS },
    {
      type: 'webPage',
      name: 'Sell your home in Central Oregon',
      description:
        'How Ryan Realty prices, launches and reports on a Central Oregon listing, with reviews, recent office closings, and a way to talk about your home.',
      url: ROUTE_PATH,
      aboutOrganization: true,
    },
  ]

  const heroProof =
    reviewCount > 0 && reviewAvg != null ? (
      <>
        <strong>{reviewAvg.toFixed(1)}</strong>
        <span className="sell-hero-stars" aria-hidden="true">
          {` ${'★'.repeat(Math.max(0, Math.min(5, Math.round(reviewAvg))))} `}
        </span>
        {`from ${reviewCount.toLocaleString('en-US')} Google reviews`}
        {homesSold != null ? (
          <>
            {' · '}
            <span className="sell-hero-nowrap">
              <strong>{homesSold.toLocaleString('en-US')}</strong>
              {' homes sold'}
            </span>
          </>
        ) : null}
        {'. '}
        <a className="sell-stage-ask__door" href="#proof" data-sell-cta="hero-reviews">
          Read the reviews
        </a>
      </>
    ) : homesSold != null ? (
      <>
        <strong>{homesSold.toLocaleString('en-US')}</strong>
        {' homes sold by Ryan Realty'}
      </>
    ) : null

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        {/* Pre-paint: flag the CMA entry so the hero shows its copy on the
            first frame. See ./_v3/sell-entry.ts. */}
        <script dangerouslySetInnerHTML={{ __html: SELL_ENTRY_SCRIPT }} />
        <SellEntryFlag />
        <SellClickTracker />
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker />

        <V3Breadcrumb
          tone="on-media"
          trail={[{ label: 'Home', href: '/' }, { label: 'Sell' }]}
        />

        <V3Stage
          id="sell-hero"
          headingLevel={1}
          height="tall"
          className="sell-stage-poster sell-landing-hero"
          headline="Sell your home in Central Oregon, priced from the sales that closed"
          altEyebrow={SELL_CMA_EYEBROW}
          altHeadline={SELL_CMA_HEADLINE}
          posterSrc={SELL_HERO_SRC}
          posterSrcSet={SELL_HERO_SRCSET}
          posterSizes="100vw"
        >
          <p className="sell-hero-sub sell-hero-sub--default">{SELL_HERO_SUB}</p>
          <p className="sell-hero-sub sell-hero-sub--cma">{SELL_CMA_SUB}</p>
          <SellCapture
            eyebrow="No contract to talk"
            ariaLabel={SELL_PRIMARY_LABEL}
            placement="stage"
            proof={heroProof}
            trace={
              heroProof && heroProofTrace ? (
                <V3SourceDisclosure
                  className="sell-stage-ask__trace"
                  source={heroProofTrace}
                  sourceName="Google and Oregon Data Share"
                />
              ) : null
            }
          >
            <div className="sell-hero-face">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="sell-hero-face__img"
                src={MATT_HEADSHOT}
                srcSet={`${MATT_HEADSHOT} 1x, ${MATT_HEADSHOT_2X} 2x`}
                width={56}
                height={56}
                alt={mattName}
                decoding="async"
              />
              <p className="sell-hero-face__who">
                <span className="sell-hero-face__name">{mattName}</span>
                <span className="sell-hero-face__role">
                  {BROKERS.matt.titleShort}
                  {mattLicense ? ` · Oregon license ${mattLicense}` : ''}
                </span>
              </p>
            </div>
            <SellValueForm
              pagePath={ROUTE_PATH}
              submitLabel={SELL_PRIMARY_LABEL}
              ctaHook="hero-value-flow"
            />
            {mattTel ? (
              <p className="sell-hero-reach">
                Or{' '}
                <a href={`tel:${mattTel}`} data-sell-cta="hero-call">
                  call
                </a>{' '}
                or{' '}
                <a href={`sms:${mattTel}`} data-sell-cta="hero-text">
                  text
                </a>{' '}
                {mattFirst}
                {mattPhone ? ` at ${mattPhone}` : ''}.
              </p>
            ) : null}
          </SellCapture>
        </V3Stage>

        <SellHowWeSell />

        {proofView ? (
          <V3ProofBlock
            {...proofView}
            // Spelled out as well as carried in the view so ci:page-purpose can
            // read the section id from the route file.
            id="proof"
            className={proofView.strips.length === 0 ? 'sell-proof--quiet' : undefined}
          />
        ) : null}

        {/* §0. With the drawing off the block prints no trace of its own, so
            the collapsed trace atom carries it. */}
        {proofView && proofView.strips.length === 0 ? (
          <div className="sell-proof-trace">
            <V3SourceDisclosure source={proofView.trace} />
          </div>
        ) : null}

        <SellClosings closings={closings} />

        <V3Quiet id="selling-questions" heading="Selling questions" items={quietItems} />

        <SellFinalAsk
          label={SELL_PRIMARY_LABEL}
          tel={mattTel}
          phoneDisplay={mattPhone}
          brokerFirstName={mattFirst}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
