// @no-parity
/**
 * SITE-05 preview harness — the sticky ask, in a page long enough to exercise
 * all three of its states: hidden at the top, shown once the hero is gone,
 * hidden again while the ask it points at is on screen.
 *
 * Development only. middleware.ts refuses /dev/* unless NODE_ENV is exactly
 * 'development' (lib/routing/dev-only.ts), and app/robots.ts disallows /dev/.
 * Deleted once the shots are taken; the control ships wired into /sell and the
 * place templates next round.
 *
 * §0: the verdict is the LIVE Bend pulse row read through the DAL at render.
 * There is no fixture and no fallback figure — if the row is missing, the
 * control renders with no tail, which is the behaviour the real pages get.
 */
import type { Metadata } from 'next'
import { getMarketPulse } from '@/lib/data'
import { stickyAskVerdict } from '@/lib/sticky-ask'
import {
  V3_ROOT_CLASS,
  V3Eyebrow,
  V3Heading,
  V3Lede,
  V3SourceLine,
  V3StickyAsk,
} from '@/components/site/v3'

export const metadata: Metadata = {
  title: 'SITE-05 sticky ask harness',
  robots: 'noindex, nofollow',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/dev/site-05-sticky`,
  },
}

export const dynamic = 'force-dynamic'

/**
 * Scroll furniture. Every heading is a QUESTION and every lede says what the
 * real section would carry — no figure, no claim about the market. §0 binds a
 * dev harness too, because the shots taken here are committed to the repo and
 * a person reads them. The one number anywhere on this page is the verdict
 * tail, and it comes from the live pulse row.
 */
const FILLER = [
  {
    eyebrow: 'Preview harness · filler',
    heading: 'What did the last six months do',
    lede: 'Stands in for the pace section: closings per month against active inventory, drawn from the market cache.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'How long does a house sit before it goes pending',
    lede: 'Stands in for the days-to-pending instrument, with the scrubber that lets a reader find their own month.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'Which neighborhoods are moving differently',
    lede: 'Stands in for the neighborhood comparison: one row per place, each row a door into that place page.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'What does the first fortnight decide',
    lede: 'Stands in for the pricing section, where the reader toggles between list price and price per foot.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'What is actually for sale right now',
    lede: 'Stands in for the Field: the map beside the list, bound both ways, counts honest to the viewport.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'Who is selling, and what are they buying next',
    lede: 'Stands in for the seller-story section, which carries quotes and photographs rather than figures.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'What does the paperwork actually look like',
    lede: 'Stands in for the process Quiet block: the steps, the disclosures, and who does which of them.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'What do people ask before they list',
    lede: 'Stands in for the Answers block, where each question is a native disclosure the reader opens.',
  },
  {
    eyebrow: 'Preview harness · filler',
    heading: 'Where should a seller go from here',
    lede: 'Stands in for the outbound doors: the market hub, the place pages, and the broker contact path.',
  },
]

export default async function Page() {
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' })
  const verdict = stickyAskVerdict(pulse)

  // The §0 trace, printed to the dev server log beside the shots.
  console.log('[site-05] market_pulse_live bend:', {
    monthsOfSupply: pulse?.monthsOfSupply ?? null,
    refreshedAt: pulse?.refreshedAt ?? null,
    rendered: verdict,
  })

  return (
    <main className={V3_ROOT_CLASS} style={{ minHeight: '100vh' }}>
      <section id="dev-hero" style={{ padding: '4rem 1.25rem 5rem', maxWidth: '72rem', margin: '0 auto' }}>
        <V3Eyebrow>Bend, Oregon · sell</V3Eyebrow>
        <V3Heading level={1}>What is my home worth today</V3Heading>
        <V3Lede>
          A broker&rsquo;s read on your house, against the sales that actually closed near it. Not an
          automated estimate off a tax record.
        </V3Lede>
        <p style={{ marginTop: '2rem', maxWidth: '44rem' }}>
          This section stands in for the /sell hero. It is the SENTINEL: the sticky ask stays hidden
          until this block has scrolled fully above the viewport.
        </p>
      </section>

      {FILLER.slice(0, 5).map((block) => (
        <section
          key={block.heading}
          style={{ padding: '5rem 1.25rem', maxWidth: '72rem', margin: '0 auto' }}
        >
          <V3Eyebrow>{block.eyebrow}</V3Eyebrow>
          <V3Heading level={2}>{block.heading}</V3Heading>
          <V3Lede>{block.lede}</V3Lede>
        </section>
      ))}

      <section
        id="get-value"
        style={{ padding: '5rem 1.25rem', maxWidth: '40rem', margin: '0 auto' }}
      >
        <V3Eyebrow>Bend · the ask</V3Eyebrow>
        <V3Heading level={2}>Start with the address</V3Heading>
        <V3Lede>
          This block stands in for the /sell valuation sheet. It is the TARGET: while it is on
          screen the sticky ask retires, so the page never shows two asks at once.
        </V3Lede>
        <label htmlFor="get-value-address" style={{ display: 'block', marginTop: '2rem' }}>
          Property address
        </label>
        <input
          id="get-value-address"
          name="address"
          type="text"
          placeholder="1234 NW Awbrey Road, Bend"
          style={{ width: '100%', minHeight: 44, marginTop: '0.5rem', padding: '0 0.75rem' }}
        />
        <div style={{ marginTop: '1.5rem' }}>
          <V3SourceLine
            source={`market_pulse_live, Bend city row, months of supply ${
              verdict?.monthsOfSupply ?? 'withheld'
            }`}
            updatedAt={pulse?.refreshedAt ?? null}
          />
        </div>
      </section>

      {FILLER.slice(5).map((block) => (
        <section
          key={block.heading}
          style={{ padding: '5rem 1.25rem', maxWidth: '72rem', margin: '0 auto' }}
        >
          <V3Eyebrow>{block.eyebrow}</V3Eyebrow>
          <V3Heading level={2}>{block.heading}</V3Heading>
          <V3Lede>{block.lede}</V3Lede>
        </section>
      ))}

      <div style={{ height: '30vh' }} />

      <V3StickyAsk
        href="#get-value"
        label="Value my home"
        verdict={verdict}
        place="Bend"
        surface="sell"
        sentinelId="dev-hero"
        targetId="get-value"
        focusId="get-value-address"
      />
    </main>
  )
}
