import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import LandingPageTracker from '@/components/LandingPageTracker'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
    <main className="min-h-screen bg-background text-foreground">
      <LandingPageTracker lpVariant="buyer-listing-alerts" />

      {/* ─── HERO — canonical Old Mill photo, navy scrim, 3-field form card ── */}
      <section className="relative isolate">
        <Image
          src="/images/hero/hero-old-mill-master-4k.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/75 via-primary/70 to-primary/80"
          aria-hidden="true"
        />

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
          {/* Copy + trust column */}
          <div className="text-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-card ring-2 ring-card/80 sm:h-16 sm:w-16">
                <Image
                  src="/images/brokers/ryan-matt.png"
                  alt="Matt Ryan, Principal Broker at Ryan Realty"
                  fill
                  sizes="(max-width: 640px) 56px, 64px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              <div>
                <p className="font-display text-base font-semibold leading-tight text-card sm:text-lg">
                  Matt Ryan
                </p>
                <p className="text-xs leading-tight text-card/85 sm:text-sm">
                  Principal Broker · Bend, Oregon
                </p>
              </div>
            </div>

            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-card drop-shadow-sm sm:text-4xl lg:text-5xl">
              First Matches in 30 Minutes.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-card/90 sm:text-lg">
              Tell us what you are looking for. A Ryan Realty broker pulls listings that match,
              within 30 minutes, not the next business day.
            </p>

            {/* Live inventory pill — only renders when the count is available */}
            {activeCount != null && activeCount > 0 ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-card/15 px-4 py-1.5 text-sm font-medium text-card ring-1 ring-card/20">
                <span className="tabular-nums font-semibold">
                  {activeCount.toLocaleString('en-US')}
                </span>
                <span>active Bend listings right now</span>
              </p>
            ) : (
              <p className="mt-4 hidden text-sm text-card/85 sm:block">
                Matched by a licensed Bend broker from real local listings. No spam, no pressure.
              </p>
            )}
          </div>

          {/* Form column — above the fold on mobile and desktop. Consent
              disclosure renders inside BuyerLPForm (first-paint HTML). */}
          <div className="lg:pl-2" id="buyer-lp-form">
            <Card className="rounded-2xl border-border bg-card p-5 shadow-lg sm:p-7">
              <BuyerLPForm />
            </Card>
          </div>
        </div>
      </section>

      {/* ─── S2 · Trust strip band ─────────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <TrustStrip />
        </div>
      </section>

      {/* ─── S3 · Resort and ranch communities we watch ────────────────────── */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Resort and ranch communities we watch
            </h2>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Inventory in these communities moves in small numbers. When something lists, your
              alert goes out the same morning.
            </p>
          </ScrollReveal>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {communityTiles.map((tile, i) => (
              <ScrollReveal key={tile.slug} delayMs={(i % 3) * 75}>
                <div className="overflow-hidden rounded-2xl border border-primary/10 bg-background shadow-sm">
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
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-primary">
                      <p className="px-6 text-center font-display text-2xl font-semibold text-primary-foreground">
                        {tile.label}
                      </p>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-display text-lg font-semibold text-primary">
                        {tile.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{tile.city} · OR</p>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {tile.note}
                    </p>
                    <p className="mt-3 text-sm font-medium tabular-nums text-foreground/80">
                      {tile.active != null ? tile.active.toLocaleString('en-US') : MDASH} active
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      {tile.pending != null ? tile.pending.toLocaleString('en-US') : MDASH} pending
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Live counts · single-family listings by MLS subdivision · refreshed with the market
            snapshot
          </p>
        </div>
      </section>

      {/* ─── S4 · How matching works — 3 steps ─────────────────────────────── */}
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              How matching works
            </h2>
          </ScrollReveal>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5">
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

      {/* ─── S5 · Virtual tour panel ───────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Walk it from anywhere
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground/80">
              We shoot full video walk-throughs on request. Buying from out of state, or out of
              town that week? You see the whole home, room by room, before you decide whether
              to fly in.
            </p>
          </ScrollReveal>
          <ScrollReveal delayMs={100}>
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-primary shadow-md">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card/15 ring-1 ring-primary-foreground/30">
                <PlayIcon className="ml-1 h-7 w-7 text-primary-foreground" />
              </span>
              <p className="absolute bottom-4 left-5 text-sm font-medium text-primary-foreground/85">
                Full walk-through video · shot on request
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── S6 · Market authority band (navy) ─────────────────────────────── */}
      <section className="border-b border-primary/10 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              We watch this market every day
            </h2>
            <p className="mt-3 max-w-2xl text-base text-primary-foreground/80">
              We publish the Central Oregon market report every month. Same data, no spin.
            </p>
          </ScrollReveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {authorityStats.map((card, i) => (
              <ScrollReveal key={card.label} delayMs={i * 75}>
                <div className="rounded-2xl bg-card/10 p-5 ring-1 ring-primary-foreground/15">
                  <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm font-medium text-primary-foreground/90">
                    {card.label}
                  </p>
                  <p className="mt-0.5 text-xs text-primary-foreground/65">{card.sub}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-5 text-xs text-primary-foreground/60">
            {refreshedLabel ? `Live data · updated ${refreshedLabel} · ` : 'Live data · '}
            Bend single-family · MLS via Ryan Realty
          </p>
        </div>
      </section>

      {/* ─── S7 · Reviews ──────────────────────────────────────────────────── */}
      {BUYER_LP_REVIEWS.length > 0 ? (
        <section className="border-b border-primary/10 bg-background">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
            <ScrollReveal>
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What past buyers say
              </p>
              <ReviewStrip reviews={BUYER_LP_REVIEWS} tone="light" />
            </ScrollReveal>
          </div>
        </section>
      ) : null}

      {/* ─── S8 · FAQ ─────────────────────────────────────────────────────── */}
      <section className="border-b border-primary/10 bg-card">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Quick answers
            </h2>
            <p className="mt-3 text-base leading-relaxed text-foreground/75">
              Talk to a broker now:{' '}
              <a
                href={`tel:${BROKER_PHONE_TEL}`}
                className="font-semibold tabular-nums text-primary underline underline-offset-4"
              >
                {BROKER_PHONE}
              </a>
            </p>
          </ScrollReveal>
          <Accordion type="single" collapsible className="mt-6 gap-4">
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

      {/* ─── S9 · Closing band ────────────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <ScrollReveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Your first matches are 30 minutes out
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
              Three fields. A real broker on the other end.
            </p>
          </ScrollReveal>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-14 rounded-xl bg-card px-7 text-lg font-semibold text-primary hover:bg-card/90"
            >
              <Link href="#buyer-lp-form" scroll>
                Start my listing alerts
              </Link>
            </Button>
            <a
              href={`tel:${BROKER_PHONE_TEL}`}
              className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-primary-foreground/30 px-7 text-lg font-semibold text-primary-foreground transition-colors hover:border-primary-foreground"
            >
              <span className="tabular-nums">Call {BROKER_PHONE}</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-4 py-8 pb-24 text-center text-sm text-muted-foreground sm:pb-10">
        <p>
          Ryan Realty · Bend · Oregon ·{' '}
          <a href={`tel:${BROKER_PHONE_TEL}`} className="text-primary underline tabular-nums">
            {BROKER_PHONE}
          </a>
        </p>
        <p className="mt-2">Equal Housing Opportunity · © {new Date().getFullYear()} Ryan Realty LLC</p>
      </footer>

      {/* Exit-intent prompt — desktop-only, once per session. */}
      <ExitIntentPrompt
        headline="Browsing first?"
        body="Every active Central Oregon listing is on the site. No signup required to search."
        ctaLabel="Browse listings"
        ctaTarget="/homes-for-sale"
      />

      {/* ─── Sticky mobile CTA bar ─────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/15 bg-card/95 px-3 py-3 shadow-md backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <Button asChild className="flex-1 rounded-xl text-sm font-semibold">
            <Link href="#buyer-lp-form" scroll>
              Start my listing alerts
            </Link>
          </Button>
          <a
            href={`tel:${BROKER_PHONE_TEL}`}
            aria-label={`Call Ryan Realty at ${BROKER_PHONE}`}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-primary text-primary"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </main>
  )
}

function ProcessStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
        {num}
      </span>
      <p className="mt-4 font-display text-lg font-semibold text-primary">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
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
      className="rounded-xl border border-primary/10 bg-background px-5 not-last:border-b data-[state=open]:border-primary/30"
    >
      <AccordionTrigger className="py-4 font-display text-lg font-semibold text-primary hover:no-underline">
        {q}
      </AccordionTrigger>
      <AccordionContent className="pb-4 text-base leading-relaxed text-foreground/85">
        {a}
      </AccordionContent>
    </AccordionItem>
  )
}
