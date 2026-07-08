// @no-parity — SEO landing, no public mockup contract.
// @no-breadcrumb — standalone search-intent landing page, no breadcrumb hierarchy.
//
// Targets "luxury homes bend oregon" (GSC: page-2 ranker, real impressions, no
// dedicated strong page). Content is data-driven from the opt-out / non-IDX
// filtered MV (getListingTiles), so every price + count is live and §0-true. The
// luxury floor is stated transparently; the real listings carry the page.
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getListingTiles, getListingTilesCount } from '@/lib/data'
import { listingTileHref } from '@/lib/slug'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const revalidate = 900

/** Luxury floor for Bend, stated transparently on the page. Bend's median list is
 *  roughly $800k, so $1.5M is the clear high-end segment. */
const LUX_MIN = 1_500_000
const OLD_MILL_HERO = '/images/hero/hero-old-mill-master-4k.jpg'

// High-end Bend-area communities with dedicated pages (resort registry slugs).
const LUX_COMMUNITIES = [
  { slug: 'broken-top', label: 'Broken Top' },
  { slug: 'tetherow', label: 'Tetherow' },
  { slug: 'pronghorn', label: 'Pronghorn' },
  { slug: 'awbrey-glen', label: 'Awbrey Glen' },
  { slug: 'northwest-crossing', label: 'NorthWest Crossing' },
]

export const metadata: Metadata = {
  title: 'Luxury Homes in Bend, Oregon',
  description:
    'Luxury homes for sale in Bend, Oregon. Live high-end listings above $1.5 million pulled from the regional MLS, plus the communities they sit in. A licensed Bend broker, not a portal.',
  alternates: { canonical: '/luxury-homes-bend' },
  openGraph: {
    title: 'Luxury Homes in Bend, Oregon | Ryan Realty',
    description: 'Live high-end Bend listings above $1.5 million, pulled from the MLS.',
    images: [OLD_MILL_HERO],
  },
}

const fmtK = (n: number | null): string =>
  n != null ? '$' + (Math.round(n / 1000) * 1000).toLocaleString('en-US') : 'Call for price'

export default async function LuxuryHomesBendPage() {
  // propertyType 'A' (design-audit P1): without it, $14M+ commercial land
  // parcels headlined "Luxury homes" with lot area rendered as living sqft,
  // and the hero count was inflated by non-residential listings.
  const [tiles, count] = await Promise.all([
    getListingTiles({ city: 'Bend', status: 'active', minPrice: LUX_MIN, sort: 'price-desc', limit: 12, propertyType: 'A' }),
    getListingTilesCount({ city: 'Bend', status: 'active', minPrice: LUX_MIN, propertyType: 'A' }).catch(() => null),
  ])
  const cards = tiles
    .filter((l) => typeof l.photoUrl === 'string' && l.photoUrl.trim() !== '' && l.listPrice != null)
    .map((l) => {
      const address = [l.streetNumber, l.streetName, l.streetSuffix].filter(Boolean).join(' ').trim() || 'Bend, Oregon'
      const meta = [
        l.beds != null ? `${Math.round(l.beds)} bd` : null,
        l.baths != null ? `${l.baths} ba` : null,
        l.sqft != null ? `${l.sqft.toLocaleString('en-US')} sqft` : null,
      ].filter(Boolean).join('  ·  ')
      return {
        key: l.listingKey,
        href: listingTileHref({
          listingKey: l.listingKey,
          listNumber: l.listNumber,
          streetNumber: l.streetNumber,
          streetName: l.streetName,
          city: l.city,
          subdivisionName: l.subdivisionName,
        }),
        photo: l.photoUrl as string,
        alt: `${address} in Bend, Oregon`,
        price: fmtK(l.listPrice),
        address,
        cityLine: [l.city ? `${l.city}, OR` : 'Bend, OR', l.subdivisionName].filter(Boolean).join(' · '),
        meta,
      }
    })

  return (
    <div className="kb-root min-h-screen bg-[#faf8f4] text-[#102742]">
      <KbNav />
      <KbSectionTracker pageType="luxury-homes-bend" />

      {/* Hero */}
      <section className="relative isolate border-b-[3px] border-[#102742]">
        <Image src={OLD_MILL_HERO} alt="Bend, Oregon and the Cascade Range" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-[#102742]/65" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/80">Bend · Central Oregon</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl uppercase leading-[0.92] tracking-[-0.01em] text-[#faf8f4] sm:text-5xl lg:text-6xl">
            Luxury homes in Bend, Oregon
          </h1>
          <p className="mt-6 max-w-2xl text-base text-[#faf8f4]/90 sm:text-lg">
            {count != null && count > 0
              ? `${count.toLocaleString('en-US')} homes above $1.5 million are active in Bend right now. `
              : 'High-end homes above $1.5 million in Bend. '}
            Every listing here is pulled live from the regional MLS by a licensed Bend broker. No algorithm ranking by who paid the most.
          </p>
        </div>
      </section>

      {/* Live luxury listings */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
            High-end homes for sale in Bend
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[#102742]/70">
            A live look at the top of Bend's market, priced high to low. New homes in this range reach your inbox the morning they list.
          </p>
          {cards.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  className="group block overflow-hidden border-[3px] border-[#102742] bg-[#102742] text-[#faf8f4] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image src={c.photo} alt={c.alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </div>
                  <div className="p-4">
                    <p className="font-display text-2xl leading-none">{c.price}</p>
                    <p className="mt-2 text-sm text-[#faf8f4]/90">{c.address}</p>
                    <p className="text-xs text-[#faf8f4]/70">{c.cityLine}</p>
                    {c.meta ? <p className="mt-3 text-[0.7rem] uppercase tracking-widest text-[#faf8f4]/70">{c.meta}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-10 text-base text-[#102742]/70">No homes above $1.5 million are active right now. Reach out and we will set an alert for the next one.</p>
          )}
          <div className="mt-10">
            <Link href="/homes-for-sale/bend" className="text-sm font-semibold uppercase tracking-widest text-[#102742] underline-offset-4 hover:underline">
              See all active Bend homes
            </Link>
          </div>
        </div>
      </section>

      {/* Where Bend's high-end homes sit */}
      <section className="border-b-[3px] border-[#102742] bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
            Where Bend's high-end homes sit
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[#faf8f4]/80">
            Much of Bend's top-of-market inventory is in its gated and golf communities on the west side and along the Deschutes. Start with these.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {LUX_COMMUNITIES.map((c) => (
              <Link
                key={c.slug}
                href={`/communities/${c.slug}`}
                className="border-[3px] border-[#faf8f4] px-5 py-3 text-sm font-semibold uppercase tracking-widest text-[#faf8f4] transition-colors hover:bg-[#faf8f4] hover:text-[#102742]"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <KbFooter towns={[]} />
    </div>
  )
}
