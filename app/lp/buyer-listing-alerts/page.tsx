import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import LandingPageTracker from '@/components/LandingPageTracker'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import BuyerLPForm from './BuyerLPForm'
import { CONTACT } from '@/lib/brand/contact'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { getAllCommunitySnapshots, getGeoSnapshot } from '@/lib/data'
import { communityImage, SUNRIVER_DESCHUTES_PHOTO } from '@/lib/geo-images'
import { TESTIMONIALS } from '@/lib/testimonials'
import { ReviewStrip } from '@/components/landing/ReviewCard'
import { TrustStrip } from '@/components/landing/TrustStrip'
import ExitIntentPrompt from '@/components/landing/ExitIntentPrompt'
import ScrollReveal from '@/components/landing/ScrollReveal'

export const metadata: Metadata = {
  title: 'First Matches in 30 Minutes | Bend Listing Alerts | Ryan Realty',
  description:
    'Tell us what you are looking for. A Ryan Realty broker pulls listings that match, within 30 minutes, not the next business day.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'First Matches in 30 Minutes',
    description: 'Get matched Central Oregon listings in your inbox within 30 minutes.',
    type: 'website',
    images: [
      {
        url: '/images/hero/hero-old-mill-master-4k.jpg',
        width: 1920,
        height: 1080,
        alt: 'Old Mill District, Bend, Oregon',
      },
    ],
  },
}

// Paid-traffic / lead-capture surface uses the FUB-tracked dotted number so
// inbound calls route through Follow Up Boss for attribution (CLAUDE.md §3).
const BROKER_PHONE = CONTACT.phoneFub
const BROKER_PHONE_TEL = CONTACT.phoneFubTel

// Em-dash as a data placeholder for unavailable values — the one allowed use
// per the brand spec ("Unavailable → em-dash").
const MDASH = '—'

// Two verified buyer-side reviews from TESTIMONIALS (Stephen Graham + Nick
// Crawley are buyer-side experiences).
const BUYER_LP_REVIEWS = TESTIMONIALS.filter((t) =>
  ['Stephen Graham', 'Nick Crawley'].includes(t.author),
)

// ─── Resort + ranch communities we watch (approved Figma LP 4, S3) ─────────
// slugs resolve photos via communityImage() (lib/geo-images.ts — geo-verified
// curated/Area Guide photography) and live counts via geo_snapshot_mv keyed
// "city:label" (same construction as /communities). Character notes are
// established facts about each community, no superlatives, no invented stats.
const WATCHED_COMMUNITIES: Array<{
  slug: string
  label: string
  city: string
  note: string
  /** Override photo when the communityImage tier photo is not geo-correct. */
  photoOverride?: string
  photoAlt: string
}> = [
  {
    slug: 'tetherow',
    label: 'Tetherow',
    city: 'Bend',
    note: 'Golf resort living on the high desert edge of west Bend.',
    photoAlt: 'Aerial view of the Tetherow golf course and homes in Bend, Oregon',
  },
  {
    slug: 'caldera-springs',
    label: 'Caldera Springs',
    city: 'Sunriver',
    note: 'Family resort community on the south end of Sunriver.',
    photoAlt: 'The engraved Caldera boulder and pond at Caldera Springs, Sunriver, Oregon',
  },
  {
    slug: 'crosswater',
    label: 'Crosswater',
    city: 'Sunriver',
    note: 'Gated golf community along the Deschutes and Little Deschutes.',
    photoAlt: 'A Crosswater golf fairway and pines near Sunriver, Oregon',
  },
  {
    slug: 'sunriver',
    label: 'Sunriver',
    city: 'Sunriver',
    note: 'The established resort community on the Deschutes, south of Bend.',
    // communityImage('sunriver') points at a night-sky cabin photo that does
    // not read as Sunriver (flagged in lib/geo-images.ts 2026-06-10). Use the
    // geo-verified Deschutes kayak photo from the asset library instead
    // (provenance documented on the constant in lib/geo-images.ts).
    photoOverride: SUNRIVER_DESCHUTES_PHOTO,
    photoAlt: 'A kayak on the Deschutes River at Sunriver, Oregon',
  },
  {
    slug: 'vandevert-ranch',
    label: 'Vandevert Ranch',
    // Registry city (data/resort-communities.json) — MLS files Vandevert under
    // Bend even though it sits just south of Sunriver.
    city: 'Bend',
    note: 'Private gated ranch community on the Little Deschutes.',
    photoAlt: 'The wooden entrance gate at Vandevert Ranch near Sunriver, Oregon',
  },
  {
    slug: 'broken-top',
    label: 'Broken Top',
    city: 'Bend',
    note: 'Gated golf community inside Bend city limits, west side.',
    photoAlt: 'The Broken Top community entrance monument in Bend, Oregon',
  },
]

export default async function BuyerLPPage() {
  // Live data — active listing count for Bend SFR (market_pulse_live) +
  // per-community active/pending counts (geo_snapshot_mv). Both via existing
  // DAL functions, both graceful-null. CLAUDE.md §0 Data Accuracy: live
  // values or the em-dash placeholder, never an invented number.
  const [bendPulse, communitySnapshots, sunriverCitySnap] = await Promise.all([
    getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
    getAllCommunitySnapshots().catch(() => []),
    // Sunriver proper is a CITY in geo_snapshot_mv (no community row exists
    // for it) — pull its city snapshot for the Sunriver tile counts.
    getGeoSnapshot({ geoType: 'city', geoKey: 'sunriver' }).catch(() => null),
  ])
  const activeCount = bendPulse?.activeCount ?? null

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
    cur.active += s.activeSfrCount
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
      active: counts != null && counts.active > 0 ? counts.active : null,
      pending: counts != null && counts.pending > 0 ? counts.pending : null,
    }
  })

  // Market authority band — 3 live stat cards from the Bend pulse.
  const authorityStats: Array<{ value: string; label: string; sub: string }> = [
    {
      value: activeCount != null && activeCount > 0 ? activeCount.toLocaleString('en-US') : MDASH,
      label: 'Active listings',
      sub: 'Bend single-family, right now',
    },
    {
      value:
        bendPulse?.medianListPrice != null
          ? `$${(Math.round(bendPulse.medianListPrice / 1000) * 1000).toLocaleString('en-US')}`
          : MDASH,
      label: 'Median list price',
      sub: 'Bend single-family',
    },
    {
      value:
        bendPulse?.medianDaysToPending != null
          ? `${Math.round(bendPulse.medianDaysToPending)} days`
          : MDASH,
      label: 'Time to pending',
      sub: 'Median, list to under contract',
    },
  ]

  const refreshedLabel = bendPulse?.refreshedAt
    ? new Date(bendPulse.refreshedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null

  return (
    <div className="bg-[#faf8f4] text-[#102742]">
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
      <section className="relative isolate border-b-[3px] border-[#102742]">
        <Image
          src="/images/hero/hero-old-mill-master-4k.jpg"
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
              Tell us what you are looking for. A Ryan Realty broker pulls listings that match,
              within 30 minutes, not the next business day.
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
                Matched by a licensed Bend broker from real local listings. No spam, no pressure.
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

      {/* ─── S2 · Trust strip band (cream) ─────────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <TrustStrip />
        </div>
      </section>

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

      {/* ─── S4 · How matching works — 3 steps ─────────────────────────────── */}
      <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <ScrollReveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
              Three steps
            </p>
            <h2 className="mt-3 text-center font-display text-3xl uppercase leading-[0.92] tracking-[-0.01em] text-[#102742] sm:text-4xl">
              How matching works
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5">
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
                body="Not just a saved search. A person who knows the streets filters what actually fits."
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
              We watch this market every day
            </h2>
            <p className="mt-4 max-w-2xl text-base text-[#faf8f4]/80">
              We publish the Central Oregon market report every month. Same data, no spin.
            </p>
          </ScrollReveal>
          {/* Brutalist KPI grid — hard cream hairlines, no rounded cards. */}
          <div className="mt-10 grid grid-cols-1 gap-px border border-[#faf8f4]/30 bg-[#faf8f4]/30 sm:grid-cols-3">
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
              a="Yes. A large share of our buyers start from out of the area. Video walk-throughs, document review by email, and showings scheduled around your visits make the distance workable."
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
              Your first matches are 30 minutes out
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[#faf8f4]/85">
              Three fields. A real broker on the other end.
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
    </div>
  )
}

// ─── Tiny presentational helpers ─────────────────────────────────────────

function ProcessStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center border-[3px] border-[#102742] bg-[#102742] font-display text-lg tabular-nums text-[#faf8f4]">
        {num}
      </span>
      <p className="mt-4 font-display text-lg uppercase leading-none tracking-[-0.01em] text-[#102742]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#102742]/70">{body}</p>
    </div>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function FAQ({ value, q, a }: { value: string; q: string; a: string }) {
  return (
    <AccordionItem
      value={value}
      className="border-[3px] border-[#102742] bg-[#faf8f4] px-5"
    >
      <AccordionTrigger className="py-4 font-display text-lg uppercase leading-snug tracking-[-0.01em] text-[#102742] hover:no-underline">
        {q}
      </AccordionTrigger>
      <AccordionContent className="pb-4 text-base leading-relaxed text-[#102742]/85">
        {a}
      </AccordionContent>
    </AccordionItem>
  )
}
