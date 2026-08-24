import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import LandingPageTracker from '@/components/LandingPageTracker'
import { Accordion } from '@/components/ui/accordion'
import BuyerLPForm from './BuyerLPForm'
import { SiteCaptureAlignment } from './SiteCaptureAlignment'
import { WATCHED_COMMUNITIES } from './watched-communities'
import { FAQ, PhoneIcon, PlayIcon, ProcessStep } from './BuyerLPBits'
import { CONTACT } from '@/lib/brand/contact'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { getPublicPlaceSegments, publicSegmentItems } from '@/lib/data/market-truth/public-segments'
import { getAllCommunitySnapshots, getGeoSnapshot, getListingTiles } from '@/lib/data'
import { listingTileHref } from '@/lib/slug'
import { communityImage } from '@/lib/geo-images'
import { TESTIMONIALS } from '@/lib/testimonials'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { ReviewStrip } from '@/components/landing/ReviewCard'
import { TrustStrip } from '@/components/landing/TrustStrip'
import ExitIntentPrompt from '@/components/landing/ExitIntentPrompt'
import ScrollReveal from '@/components/landing/ScrollReveal'

export const metadata: Metadata = {
  title: 'First Matches in 30 Minutes | Bend Listing Alerts | Ryan Realty',
  description:
    'Tell us what you are looking for. A Ryan Realty broker pulls matching Central Oregon listings, usually within 30 minutes during business hours.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'First Matches in 30 Minutes',
    description: 'Matched Central Oregon listings in your inbox, usually within 30 minutes.',
    type: 'website',
    images: [
      {
        url: '/images/kb/three-sisters-sunrise.jpg',
        width: 1920,
        height: 1080,
        alt: 'Old Mill District, Bend, Oregon',
      },
    ],
  },
}

const BROKER_PHONE = CONTACT.phoneFub
const BROKER_PHONE_TEL = CONTACT.phoneFubTel

const MDASH = '—'

// Two verified buyer-side reviews from TESTIMONIALS (Stephen Graham + Nick
// Crawley are buyer-side experiences).
const BUYER_LP_REVIEWS = TESTIMONIALS.filter((t) =>
  ['Stephen Graham', 'Nick Crawley'].includes(t.author),
)

export default async function BuyerLPPage() {
  // Leftover Bend membership for the authority band. Miss omits. Community
  // tiles stay geo snapshots. CLAUDE.md §0: never invent a number.
  const [overlays, communitySnapshots, sunriverCitySnap, liveBendRaw, publicPace, publicSegments] = await Promise.all([
    getDetachedOverlays([{ geoType: 'city', geoSlug: 'bend' }]),
    getAllCommunitySnapshots().catch(() => []),
    // Sunriver proper is a CITY in geo_snapshot_mv (no community row exists
    // for it) — pull its city snapshot for the Sunriver tile counts.
    getGeoSnapshot({ geoType: 'city', geoKey: 'sunriver' }).catch(() => null),
    // Live Bend homes for the "prove the inventory before the ask" rail. Reads
    // listing_tile_mv via the DAL — already opt-out / non-IDX filtered (§0 + IDX).
    getListingTiles({ city: 'Bend', status: 'active', sort: 'newest', limit: 18 }).catch(() => []),
    getPublicDetachedPace({ geoType: 'city', geoSlug: 'bend' }),
    getPublicPlaceSegments({ geoType: 'city', geoSlug: 'bend' }),
  ])
  const bendMt = overlays.get('city:bend')
  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: bendMt?.headlines ?? null,
    inventory: bendMt?.inventory ?? null,
    pace: publicPace,
  })
  const activeCount = hud.active

  // geo_snapshot_mv community keys are "city:subdivision" where the city half
  // follows the raw MLS City value, which is inconsistent for the Sunriver-area
  // resorts (e.g. BOTH "bend:caldera springs" AND "sunriver:caldera springs"
  // exist — same place, split by feed city). Verified 2026-06-12 against the
  // MV: exact-label matching across cities has NO wrong-place collisions for
  // these six labels, so we sum the per-city rows per label.
  const countsByLabel = new Map<string, { active: number; pending: number }>()
  for (const s of communitySnapshots) {
    const label = s.geoKey.split(':').slice(1).join(':')
    const cur = countsByLabel.get(label) ?? { active: 0, pending: 0 }
    if (s.activeSfrCount != null) cur.active += s.activeSfrCount
    cur.pending += s.pendingCount
    countsByLabel.set(label, cur)
  }
  const communityTiles = WATCHED_COMMUNITIES.map((c) => {
    const counts =
      c.slug === 'sunriver'
        ? sunriverCitySnap != null
          ? { active: sunriverCitySnap.activeSfrCount, pending: sunriverCitySnap.pendingCount }
          : null
        : countsByLabel.get(c.label.toLowerCase()) ?? null
    return {
      ...c,
      photoSrc: c.photoOverride ?? communityImage(c.slug),
      active: counts != null && counts.active != null && counts.active > 0 ? counts.active : null,
      pending: counts != null && counts.pending > 0 ? counts.pending : null,
    }
  })

  // Live Bend homes rail — proof of fresh inventory before the ask. §0: real
  // active listings (opt-out / non-IDX filtered MV), real price + beds, photo
  // required. Rounded to the nearest thousand per brand currency rule.
  const fmtK = (n: number | null): string =>
    n != null ? '$' + (Math.round(n / 1000) * 1000).toLocaleString('en-US') : 'Call for price'
  const liveBendCards = (liveBendRaw ?? [])
    .filter((l) => typeof l.photoUrl === 'string' && l.photoUrl.trim() !== '' && l.listPrice != null)
    .slice(0, 6)
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

  const authorityStats: Array<{ value: string; label: string; sub: string }> = []
  if (activeCount != null && activeCount > 0) {
    authorityStats.push({
      value: activeCount.toLocaleString('en-US'),
      label: 'Active listings',
      sub: 'Leftover Bend houses, right now',
    })
  }
  if (hud.medianList != null && hud.medianList > 0) {
    authorityStats.push({
      value: `$${Math.round(hud.medianList).toLocaleString('en-US')}`,
      label: 'Median list price',
      sub: 'Leftover Bend houses',
    })
  }
  const pendingLabel = publishDaysLabel(hud.daysToPending)
  if (pendingLabel) {
    authorityStats.push({
      value: pendingLabel,
      label: 'Time to pending',
      sub: 'Leftover 90-day list to under contract',
    })
  }
  const BUYER_LEFTOVER_KEYS = new Set(['pending', 'dtc', 'yoy'])
  for (const item of publicPaceItems(publicPace)) {
    if (!BUYER_LEFTOVER_KEYS.has(item.key)) continue
    const [label, window] = item.label.split(' · ')
    authorityStats.push({
      value: item.value,
      label: label ?? item.label,
      sub: window ?? 'Detached houses',
    })
  }
  const LP_EXTRA = new Set(['condo', 'townhome'])
  for (const item of publicSegmentItems(publicSegments, 'bend')) {
    if (!LP_EXTRA.has(item.key)) continue
    const bits = item.label.split(' · ').slice(1).join(' · ')
    authorityStats.push({
      value: item.value,
      label: `${item.noun} for sale`,
      sub: bits || 'Market Truth',
    })
  }

  const leftoverStamp = bendMt?.headlines?.computedAt ?? bendMt?.inventory?.computedAt ?? null
  const refreshedLabel = leftoverStamp
    ? new Date(leftoverStamp).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null

  return (
    <main className="bg-[#faf8f4] text-[#102742]">
      <LandingPageTracker lpVariant="buyer-listing-alerts" />

      {/* ─── Sticky minimal header — wordmark + phone (KB navy bar) ───────── */}
      <header className="sticky top-0 z-40 border-b-[3px] border-[#102742] bg-[#102742]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Ryan Realty · Bend, Oregon">
            <span className="relative block h-7 w-[140px] shrink-0 sm:h-9 sm:w-[180px]">
              <Image
                src="/images/brand/logo-horizontal-navy-transparent.png"
                alt="Ryan Realty · Bend, Oregon"
                fill
                sizes="(max-width: 640px) 140px, 180px"
                className="object-contain object-left brightness-0 invert"
                priority
              />
            </span>
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            className="inline-flex items-center gap-1.5 border-[3px] border-[#faf8f4] bg-[#faf8f4] px-3 py-2 text-sm font-bold uppercase tracking-[0.1em] text-[#102742] transition-colors hover:bg-transparent hover:text-[#faf8f4] sm:px-4"
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="tabular-nums">{BROKER_PHONE}</span>
          </a>
        </div>
      </header>

      {/* ─── HERO — canonical Old Mill photo, navy scrim, 3-field form card ── */}
      <section id="alerts" className="relative isolate border-b-[3px] border-[#102742] scroll-mt-16">
        <Image
          src="/images/kb/three-sisters-sunrise.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#102742]/80 via-[#102742]/70 to-[#102742]/85"
          aria-hidden="true"
        />

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
          {/* Copy + trust column */}
          <div className="text-[#faf8f4]">
            {/* Eyebrow — mono label */}
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/85 drop-shadow-sm">
              <span className="h-[7px] w-[7px] rounded-full bg-[#faf8f4]" aria-hidden="true" />
              Bend · Central Oregon buyers
            </p>

            {/* Broker trust chip — hard-edge square frame */}
            <div className="mt-5 inline-flex items-center gap-3 border-[3px] border-[#faf8f4]/40 px-3 py-2">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-[#faf8f4]/40 bg-[#faf8f4]/10 sm:h-12 sm:w-12">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker at Ryan Realty"
                  fill
                  sizes="(max-width: 640px) 40px, 48px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight text-[#faf8f4]">Matt Ryan</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-tight text-[#faf8f4]/70">
                  Principal broker · Bend, Oregon
                </p>
              </div>
            </div>

            {/* H1 — Amboqia display, Title Case (hero only) */}
            <h1 className="mt-6 font-display text-4xl uppercase leading-[0.92] tracking-[-0.01em] text-[#faf8f4] drop-shadow-sm sm:text-5xl lg:text-6xl">
              First Matches in 30 Minutes
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#faf8f4] drop-shadow-sm">
              Tell us what you are looking for. A Bend broker pulls listings that match, usually
              within 30 minutes during business hours. Overnight requests go out the next morning.
            </p>

            {/* Live inventory pill — only renders when the count is available */}
            {activeCount != null && activeCount > 0 ? (
              <p className="mt-6 inline-flex items-center gap-2 border-[3px] border-[#faf8f4]/40 px-4 py-2 text-sm font-semibold text-[#faf8f4] drop-shadow-sm">
                <span className="tabular-nums font-display text-base">
                  {activeCount.toLocaleString('en-US')}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/80">
                  active Bend listings right now
                </span>
              </p>
            ) : (
              <p className="mt-6 hidden text-sm text-[#faf8f4]/85 drop-shadow-sm sm:block">
                Matched by a licensed Bend broker from local MLS listings. Matches only. Unsubscribe anytime.
              </p>
            )}
          </div>

          {/* Form column — above the fold on mobile and desktop. Consent
              disclosure renders inside BuyerLPForm (first-paint HTML). */}
          <div className="lg:pl-2" id="buyer-lp-form">
            <div className="border-[3px] border-[#102742] bg-[#faf8f4] p-5 sm:p-7">
              <BuyerLPForm />
            </div>
          </div>
        </div>
      </section>

      {/* ─── S1b · Live in Bend right now — prove the inventory before the ask ── */}
      {liveBendCards.length > 0 ? (
        <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                Active in Bend right now
              </p>
              <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
                Live in Bend today
              </h2>
              <p className="mt-4 max-w-2xl text-base text-[#102742]/70">
                Pulled from the MLS. When a home that matches your criteria lists, it reaches your
                inbox the morning it hits the market.
              </p>
            </ScrollReveal>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {liveBendCards.map((c, i) => (
                <ScrollReveal key={c.key} delayMs={(i % 3) * 75}>
                  <a
                    href={c.href}
                    className="group block overflow-hidden border-[3px] border-[#102742] bg-[#102742] text-[#faf8f4] transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden">
                      <Image
                        src={c.photo}
                        alt={c.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="p-4">
                      <p className="font-display text-2xl leading-none">{c.price}</p>
                      <p className="mt-2 text-sm text-[#faf8f4]/90">{c.address}</p>
                      <p className="text-xs text-[#faf8f4]/70">{c.cityLine}</p>
                      {c.meta ? (
                        <p className="mt-3 text-[0.7rem] uppercase tracking-widest text-[#faf8f4]/70">{c.meta}</p>
                      ) : null}
                    </div>
                  </a>
                </ScrollReveal>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#alerts"
                className="inline-flex items-center gap-2 border-[3px] border-[#102742] bg-[#102742] px-6 py-3 text-sm font-semibold uppercase tracking-widest text-[#faf8f4] transition-colors hover:bg-[#102742]/85"
              >
                Start your alerts
              </a>
              <a
                href="/homes-for-sale/bend"
                className="text-sm font-semibold uppercase tracking-widest text-[#102742] underline-offset-4 hover:underline"
              >
                See all active Bend homes
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── S2 · Trust strip band (cream) ─────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <TrustStrip />
        </div>
      </section>

      <SiteCaptureAlignment />

      {/* ─── S3 · Resort and ranch communities we watch ────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Where we watch
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              Resort and ranch communities we watch
            </h2>
            <p className="mt-4 max-w-2xl text-base text-[#102742]/70">
              Inventory in these communities moves in small numbers. When something lists, your
              alert goes out the same morning.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {communityTiles.map((tile, i) => (
              <ScrollReveal key={tile.slug} delayMs={(i % 3) * 75}>
                <div className="overflow-hidden border-[3px] border-[#102742] bg-[#102742] text-[#faf8f4]">
                  {tile.photoSrc ? (
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={tile.photoSrc}
                        alt={tile.photoAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#102742]">
                      <p className="px-6 text-center font-display text-2xl uppercase tracking-[-0.01em] text-[#faf8f4]">
                        {tile.label}
                      </p>
                    </div>
                  )}
                  <div className="border-t-[3px] border-[#faf8f4]/20 p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-display text-lg uppercase leading-none tracking-[-0.01em] text-[#faf8f4]">
                        {tile.label}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#faf8f4]/65">
                        {tile.city} · OR
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#faf8f4]/75">
                      {tile.note}
                    </p>
                    <p className="mt-4 text-sm font-semibold tabular-nums text-[#faf8f4]/90">
                      {tile.active != null ? tile.active.toLocaleString('en-US') : MDASH} active
                      <span className="mx-1.5 text-[#faf8f4]/45">·</span>
                      {tile.pending != null ? tile.pending.toLocaleString('en-US') : MDASH} pending
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102742]/70">
            Live counts · single-family listings by MLS subdivision · refreshed with the market
            snapshot
          </p>
        </div>
      </section>

      {/* ─── S4 · How matching works — 3 steps (E7: left-led, not centered dump) ── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                Three steps
              </p>
              <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
                How matching works
              </h2>
              <p className="mt-4 text-base text-[#102742]/70">
                Criteria in, broker-reviewed matches out. No mass blast of every new listing.
              </p>
            </div>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-10 border-t-[3px] border-[#102742]/15 pt-10 sm:grid-cols-3 sm:gap-8">
            <ScrollReveal delayMs={0}>
              <ProcessStep
                num="1"
                title="Tell us your criteria"
                body="Budget, areas, beds, timing. Three fields to start, sharpen anytime."
              />
            </ScrollReveal>
            <ScrollReveal delayMs={75}>
              <ProcessStep
                num="2"
                title="A broker reviews every match"
                body="A broker reads each match against what you asked for before it reaches you."
              />
            </ScrollReveal>
            <ScrollReveal delayMs={150}>
              <ProcessStep
                num="3"
                title="Tour on your schedule"
                body="In town or visiting, showings get scheduled around your trip."
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── S5 · Virtual tour panel — split panel ─────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Buy from anywhere
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              Walk it from anywhere
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#102742]/80">
              We shoot full video walk-throughs on request. Buying from out of state, or out of
              town that week? You see the whole home, room by room, before you decide whether
              to fly in.
            </p>
          </ScrollReveal>
          <ScrollReveal delayMs={100}>
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden border-[3px] border-[#102742] bg-[#102742]">
              <span className="flex h-16 w-16 items-center justify-center border-[3px] border-[#faf8f4] bg-[#faf8f4]/10">
                <PlayIcon className="ml-1 h-7 w-7 text-[#faf8f4]" />
              </span>
              <p className="absolute bottom-4 left-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/85">
                Full walk-through video · shot on request
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S6 · Market authority band (navy) ─────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              Bend · The market
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
              Bend single-family, current figures
            </h2>
            <p className="mt-4 max-w-2xl text-base text-[#faf8f4]/80">
              From the same MLS data behind our monthly Central Oregon market report.
            </p>
          </ScrollReveal>
          {/* Brutalist KPI grid — hard cream hairlines, no rounded cards. */}
          <div className="mt-10 grid grid-cols-1 gap-px border border-[#faf8f4]/30 bg-[#faf8f4]/30 sm:grid-cols-2 lg:grid-cols-3">
            {authorityStats.map((card, i) => (
              <ScrollReveal key={card.label} delayMs={i * 75}>
                <div className="flex h-full flex-col bg-[#102742] p-5 sm:p-6">
                  <p className="font-display text-4xl tabular-nums leading-[0.9] sm:text-5xl">
                    {card.value}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/90">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xs text-[#faf8f4]/60">{card.sub}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf8f4]/55">
            {refreshedLabel ? `Live data · updated ${refreshedLabel} · ` : 'Live data · '}
            Bend single-family · MLS via Ryan Realty
          </p>
        </div>
      </section>

      {/* ─── S7 · Reviews ──────────────────────────────────────────────────── */}
      {BUYER_LP_REVIEWS.length > 0 ? (
        <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
            <ScrollReveal>
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
                What past buyers say
              </p>
              <ReviewStrip reviews={BUYER_LP_REVIEWS} tone="light" />
            </ScrollReveal>
          </div>
        </section>
      ) : null}

      {/* ─── S8 · FAQ ─────────────────────────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Common questions
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              Quick answers
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#102742]/75">
              Talk to a broker now.{' '}
              <a
                href={`tel:${BROKER_PHONE_TEL}`}
                className="inline-flex items-center gap-1.5 font-semibold text-[#102742] underline-offset-4 hover:underline"
              >
                <PhoneIcon className="h-4 w-4" />
                <span className="tabular-nums">{BROKER_PHONE}</span>
              </a>
            </p>
          </ScrollReveal>
          <Accordion type="single" collapsible className="mt-8 gap-4">
            <FAQ
              value="faq-speed"
              q="Are the first matches really in 30 minutes?"
              a="During business hours, yes. A broker reads your criteria and sends the listings that fit, usually well inside 30 minutes. Overnight requests get answered first thing in the morning."
            />
            <FAQ
              value="faq-spam"
              q="Will I get spammed?"
              a="No. You get listings that match your criteria and nothing else. Unsubscribe anytime. That is a tag in our system that stops every email immediately."
            />
            <FAQ
              value="faq-cost"
              q="What does this cost me?"
              a="Nothing. Buyer representation terms are agreed in writing before any offer, and we walk you through exactly how compensation works under the current rules."
            />
            <FAQ
              value="faq-remote"
              q="I am not in Bend. Can I still look?"
              a="Yes. Video walk-throughs, document review by email, and showings scheduled around your visits make the distance workable."
            />
          </Accordion>
        </div>
      </section>

      {/* ─── S9 · Closing navy band ───────────────────────────────────────── */}
      <section className="bg-[#102742] text-[#faf8f4]">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#faf8f4]/55">
              Three fields
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] sm:text-4xl">
              Start your listing alerts
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[#faf8f4]/85">
              Three fields. A broker sends the first matches, usually within 30 minutes.
            </p>
          </ScrollReveal>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#buyer-lp-form"
              scroll
              className="inline-flex h-14 items-center justify-center border-[3px] border-[#faf8f4] bg-[#faf8f4] px-7 text-sm font-bold uppercase tracking-[0.1em] text-[#102742] transition-colors hover:bg-transparent hover:text-[#faf8f4]"
            >
              Start my listing alerts
            </Link>
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="inline-flex h-14 items-center justify-center border-[3px] border-[#faf8f4]/40 px-7 text-sm font-bold uppercase tracking-[0.1em] text-[#faf8f4] transition-colors hover:border-[#faf8f4]"
            >
              <span className="tabular-nums">Call {BROKER_PHONE}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── Mini fine print ─────────────────────────────────────────────── */}
      <footer className="border-t-[3px] border-[#102742] bg-[#102742] pb-24 sm:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#faf8f4]/65 sm:px-6">
          <p>
            Ryan Realty LLC · Bend · Oregon ·{' '}
            <a href={`tel:${BROKER_PHONE_TEL}`} className="underline underline-offset-2 tabular-nums hover:text-[#faf8f4]">
              {BROKER_PHONE}
            </a>
          </p>
          <p className="mt-2 normal-case tracking-normal">
            Equal Housing Opportunity · © {new Date().getFullYear()} Ryan Realty LLC
          </p>
        </div>
      </footer>

      {/* Exit-intent prompt — desktop-only, once per session. */}
      <ExitIntentPrompt
        headline="Browsing first?"
        body="Every active Central Oregon listing is on the site. No signup required to search."
        ctaLabel="Browse listings"
        ctaTarget="/homes-for-sale"
      />

      {/* ─── Sticky mobile CTA bar — pinned to viewport bottom on mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-[3px] border-[#102742] bg-[#faf8f4] px-3 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="#buyer-lp-form"
            scroll
            className="flex-1 border-[3px] border-[#102742] bg-[#102742] px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.1em] text-[#faf8f4]"
          >
            Start my listing alerts
          </Link>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center border-[3px] border-[#102742] text-[#102742]"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </main>
  )
}
