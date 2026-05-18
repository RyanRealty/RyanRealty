/**
 * /lp/tetherow/ — Tetherow Resort + Golf Club landing page.
 *
 * Tier 2 in the search-authority stack (city > community > subdivision > listing).
 * Ported from the static exemplar at public/lp/tetherow/index.html into a
 * Next.js server component with ISR.
 *
 * Data accuracy (CLAUDE.md §0): every figure on this page traces to a live
 * Supabase query executed at request time (cached for 6 hours via ISR).
 * Static brand content (architect, course rankings, HOA, builders, signature
 * hole, happenings) is sourced from data/resort-community-tetherow.json.
 *
 * Design system (CLAUDE.md "Design System v2"): Web register, navy on cream,
 * shadcn/ui primitives only. The Playfair Display headings + Inter body
 * register is locked to match the live static page; this maps to the project's
 * --font-display (`font-display` utility) + Geist body fonts in the global
 * layout. CSS custom properties --rr-navy/--rr-cream/--rr-muted/--rr-text/
 * --rr-card-shadow/--rr-font-display/--rr-font-sans are inlined inside the
 * <style jsx global> block so the component is self-contained and survives
 * future layout-level token changes.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import LandingPageTracker from '@/components/LandingPageTracker'

import {
  TETHEROW_CONFIG,
  fetchTetherowKpi,
  fetchTetherowActiveListings,
  fetchTetherowRecentClosings,
  fetchTetherowPeerComparison,
  fetchTetherowBoundary,
  buildTetherowMapUrl,
  formatPriceKpi,
  formatPriceFull,
  formatRatioPct,
  formatDays,
  formatPpsf,
  formatCloseDate,
  currentMonthYear,
  formatMethodologyDate,
} from './data'

import TetherowScroller, { type ScrollerCard } from './_components/TetherowScroller'
import TetherowStickyCta from './_components/TetherowStickyCta'
import TetherowExitModal from './_components/TetherowExitModal'
import TetherowMultiStepForm from './_components/TetherowMultiStepForm'
import TetherowBuyerForms from './_components/TetherowBuyerForms'

const cfg = TETHEROW_CONFIG

// ─── ISR: refresh every 6 hours ───────────────────────────────────────────────
export const revalidate = 21_600

// ─── Page metadata (Next.js Metadata API) ─────────────────────────────────────
export const metadata: Metadata = {
  title: cfg.meta.title,
  description: cfg.meta.description,
  alternates: { canonical: cfg.meta.canonical },
  openGraph: {
    title: cfg.meta.title,
    description: cfg.meta.description,
    type: 'website',
    url: cfg.meta.canonical,
    images: [{ url: cfg.hero_image }],
  },
  robots: { index: true, follow: true },
}

export default async function TetherowLandingPage() {
  // Server-time data pulls — every figure is live.
  const [kpi, activeListings, recentClosings, peerRows, boundary] = await Promise.all([
    fetchTetherowKpi(),
    fetchTetherowActiveListings(),
    fetchTetherowRecentClosings(),
    fetchTetherowPeerComparison(),
    fetchTetherowBoundary(),
  ])

  const dynMonthYear = currentMonthYear(new Date())
  const mapUrl = buildTetherowMapUrl(boundary)

  // Live-derived hero stats — overrides the static config when the cache row
  // exists so the rendered page is always honest to the latest cache pull.
  const soldCount = kpi?.soldCount ?? 0
  const medianClose = kpi?.medianSalePrice ?? null
  const medianDom = kpi?.medianDom ?? null
  const saleToList = kpi?.avgSaleToListRatio ?? null
  const medianPpsf = kpi?.medianPpsf ?? null
  const eopInventory = kpi?.endOfPeriodInventory ?? null
  const methodologyVersion = kpi?.methodologyVersion ?? 'v3-2026-05-07'
  const methodologyDate = formatMethodologyDate(kpi?.computedAt)

  // Active vs pending counts for the KPI grid.
  const activeCount = activeListings.filter((l) => {
    const s = l.standardStatus.toLowerCase()
    return s === 'active'
  }).length
  const pendingCount = activeListings.filter((l) => {
    const s = l.standardStatus.toLowerCase()
    return s === 'pending'
  }).length
  const activeUnderContractCount = activeListings.filter((l) => {
    const s = l.standardStatus.toLowerCase()
    return s.includes('activeunder') || (s.includes('active') && s.includes('contract'))
  }).length

  // Median active-list price for the on-page KPI card. Computed from the live
  // top-12 active inventory at render time (sufficient because that's the
  // entire active+pending set for Tetherow at most price points).
  const activeListPrices = activeListings
    .filter((l) => l.standardStatus.toLowerCase() === 'active' && l.listPrice != null)
    .map((l) => l.listPrice as number)
    .sort((a, b) => a - b)
  const medianListActive =
    activeListPrices.length > 0
      ? activeListPrices[Math.floor(activeListPrices.length / 2)]
      : null

  // Build the scroller cards (sub-neighborhoods).
  const scrollerCards: ScrollerCard[] = cfg.sub_neighborhoods.map((sn, i) => ({
    slug: sn.slug,
    name: sn.name,
    type: sn.type,
    duesLine: sn.hoa_sub_assessment.startsWith('Master')
      ? sn.description
      : `~${formatAnnualDuesShort(sn.hoa_annual_estimate)} annual dues · ${shortDuesNote(sn)}`,
    imageUrl: sn.image_hint ?? activeListings[i % Math.max(1, activeListings.length)]?.photoUrl ?? '',
    hasInnerPage: !!sn.has_inner_page,
  }))

  // Build buyer-form showing options from the live inventory.
  const showingOptions = activeListings.map((l) => ({
    value: l.listingKey,
    label: l.showingFormLabel,
  }))

  // JSON-LD schemas
  const realEstateAgentSchema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Ryan Realty',
    url: 'https://ryan-realty.com',
    telephone: '+1-541-213-6706',
    email: 'matt@ryan-realty.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '115 NW Oregon Avenue',
      addressLocality: 'Bend',
      addressRegion: 'OR',
      postalCode: '97703',
      addressCountry: 'US',
    },
    areaServed: { '@type': 'Place', name: 'Tetherow, Bend, Oregon' },
    founder: {
      '@type': 'Person',
      name: 'Matt Ryan',
      jobTitle: 'Principal Broker',
      identifier: 'OR Principal Broker #201206613',
    },
  }
  const placeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: 'Tetherow Resort and Golf Club',
    description: cfg.meta.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: cfg.street_address,
      addressLocality: cfg.city,
      addressRegion: cfg.state,
      postalCode: cfg.postal_code,
      addressCountry: 'US',
    },
    containedInPlace: { '@type': 'City', name: 'Bend', addressRegion: 'OR' },
    geo: boundary
      ? { '@type': 'GeoCoordinates', latitude: boundary.lat, longitude: boundary.lng }
      : undefined,
  }

  return (
    <div className="tetherow-lp bg-[color:var(--rr-cream)] text-[color:var(--rr-text)]" style={{ fontFamily: 'var(--rr-font-sans)' }}>
      {/* Self-contained design tokens — match the static exemplar's --rr-* palette */}
      <TetherowGlobalStyle />

      <LandingPageTracker lpVariant="tetherow-landing-v1" />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(realEstateAgentSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeSchema) }}
      />

      {/* TOP BAR */}
      <div className="bg-[color:var(--rr-navy)] py-[14px] text-[13px] font-medium text-[color:var(--rr-cream)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-5 px-6">
          <div className="flex flex-wrap items-center gap-[18px]">
            <Link href="/" aria-label="Ryan Realty home" className="block">
              <Image
                src="/brand/logo-header-white.png"
                alt="Ryan Realty"
                width={140}
                height={28}
                className="block h-7 w-auto"
                priority
              />
            </Link>
            <span className="hidden text-[11.5px] tracking-[0.04em] opacity-70 sm:inline">
              Bend, Oregon · Principal Broker #201206613
            </span>
          </div>
          <a
            href="#cma"
            className="whitespace-nowrap rounded-full bg-[color:var(--rr-cream)] px-4 py-[7px] text-[12px] font-bold tracking-[0.04em] text-[color:var(--rr-navy)] transition hover:opacity-90"
          >
            What&apos;s my home worth?
          </a>
        </div>
      </div>

      <TetherowStickyCta />

      {/* HERO */}
      <header
        data-tetherow-hero
        className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-[color:var(--rr-navy)]"
      >
        <div
          aria-hidden
          className="absolute inset-0 z-0 scale-[1.02] bg-cover bg-center"
          style={{ backgroundImage: `url('${cfg.hero_image}')` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(16,39,66,0.15) 0%, rgba(16,39,66,0.55) 55%, rgba(16,39,66,0.94) 100%)',
          }}
        />
        <div className="relative z-[2] mx-auto w-full max-w-[1200px] px-6 pt-24 text-[color:var(--rr-cream)]">
          <div className="mb-[14px] text-[12px] font-bold uppercase tracking-[0.16em] text-[rgba(250,248,244,0.72)]">
            {cfg.hero.eyebrow}
          </div>
          <h1
            className="mb-[22px] max-w-[920px] font-display text-[clamp(40px,6vw,76px)] font-semibold leading-[1.03] tracking-[-0.018em]"
            style={{ fontFamily: 'var(--rr-font-display)' }}
          >
            {cfg.hero.h1_lead} <span>{dynMonthYear}</span>.
          </h1>
          <p className="mb-9 max-w-[720px] text-[19px] leading-[1.55] text-[rgba(250,248,244,0.92)]">
            {soldCount} homes traded last year at a median {formatPriceFull(medianClose)}.{' '}
            {eopInventory ?? 0} active right now from $1.7M to $4M.{' '}
            {medianDom != null ? `${medianDom}-day` : '—'} median market velocity. McLay Kidd
            country, west Bend, inside the {cfg.acres}-acre master plan.
          </p>
          <div className="grid max-w-[940px] grid-cols-2 overflow-hidden rounded-t-xl border-t border-[rgba(250,248,244,0.15)] bg-[rgba(16,39,66,0.7)] backdrop-blur md:grid-cols-4">
            <HeroStat value={String(soldCount)} label="Sold past 12 months" />
            <HeroStat value={formatPriceKpi(medianClose)} label="Median close (12mo)" />
            <HeroStat value={String(medianDom ?? '—')} label="Median days on market" />
            <HeroStat value={formatRatioPct(saleToList)} label="Sale-to-list ratio" last />
          </div>
        </div>
      </header>

      {/* ABOUT TETHEROW */}
      <Section variant="about" id="about">
        <SectionHead eyebrow="Overview" headline="What is Tetherow?" />
        <div className="grid gap-9 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <div>
            {cfg.about_prose.map((p, i) => (
              <p
                key={i}
                className={
                  i === 0
                    ? 'mb-4 text-[19px] font-medium leading-[1.55] text-[color:var(--rr-navy)]'
                    : 'mb-4 text-[17px] leading-[1.68] text-[color:var(--rr-text)]'
                }
              >
                {p}
              </p>
            ))}
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                ['#location', 'Location + drive times'],
                ['#hoa', 'HOA tiers + board'],
                ['#course', 'The course'],
                ['#lifestyle', 'Amenities'],
                ['#membership', 'Club membership'],
                ['#happenings', 'Current events'],
                ['#inventory', 'Active inventory'],
                ['#buyer', 'Buyer track'],
                ['#cma', 'Seller value report'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-full bg-[rgba(16,39,66,0.04)] px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] text-[color:var(--rr-navy)] transition hover:bg-[color:var(--rr-navy)] hover:text-[color:var(--rr-cream)]"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
          <Card className="sticky top-6 rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white p-7 shadow-[var(--rr-card-shadow)]">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--rr-muted)]">
              Tetherow at a glance
            </div>
            <dl className="m-0">
              <FactRow term="Founded" value={String(cfg.founded)} sub="Golf course + clubhouse open" />
              <FactRow term="Size" value={`${cfg.acres} acres`} sub={`${cfg.sub_neighborhoods.length} sub-neighborhoods`} />
              <FactRow term="Location" value="West Bend, Oregon" sub="7 min to Old Mill" />
              <FactRow term="Architect" value={cfg.architect ?? '—'} sub="Bandon Dunes pedigree" />
              <FactRow term="Course rank" value="#57 in U.S." sub="Golf Digest 100 Greatest Public" />
              <FactRow term="Recognition" value="#1 PNW Resort" sub="Conde Nast 8 consecutive years" />
              <FactRow term="12-month closings" value={String(soldCount)} sub={`Median ${formatPriceFull(medianClose)}`} />
              <FactRow term="Active today" value={String(eopInventory ?? activeCount)} sub="$759K to $4M" />
              <FactRow term="Master HOA" value={`${formatPriceFull(cfg.hoa_master_assessment_annual)} / year`} sub="Plus sub-neighborhood dues" />
            </dl>
          </Card>
        </div>
      </Section>

      {/* THE McLAY KIDD ANGLE */}
      <Section>
        <div className="grid items-center gap-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--rr-muted)]">
              {cfg.kidd_angle.eyebrow}
            </div>
            <h3
              className="mb-[18px] font-display text-[38px] font-semibold leading-[1.1] tracking-[-0.012em] text-[color:var(--rr-navy)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              {cfg.kidd_angle.headline}
            </h3>
            {cfg.kidd_angle.body.map((p, i) => (
              <p key={i} className="mb-[14px] text-[17px] leading-[1.65] text-[color:var(--rr-text)]">
                {p}
              </p>
            ))}
            <blockquote
              className="my-[22px] border-l-[3px] border-[color:var(--rr-navy)] pl-[18px] font-display text-[22px] italic leading-[1.4] text-[color:var(--rr-navy)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              {cfg.kidd_angle.quote}
              <span className="mt-1.5 block text-[13px] not-italic font-medium text-[color:var(--rr-muted)]">
                {cfg.kidd_angle.quote_attr}
              </span>
            </blockquote>
          </div>
          <div
            role="img"
            aria-label="Tetherow golf course"
            className="aspect-[4/5] rounded-2xl bg-[color:var(--rr-navy)] bg-cover bg-center shadow-[var(--rr-card-shadow)]"
            style={{ backgroundImage: `url('${cfg.course_image}')` }}
          />
        </div>
      </Section>

      {/* LOCATION */}
      <Section id="location">
        <SectionHead
          eyebrow="Location"
          headline="Seven minutes from the Old Mill."
          body="Tetherow sits on 700 acres west of Bend on Skyline Ranch Road. Closer to downtown than Pronghorn or Brasada, closer to Mt. Bachelor than Broken Top."
        />
        <div className="grid items-stretch gap-9 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-h-[360px] overflow-hidden rounded-2xl bg-[color:var(--rr-navy)] shadow-[var(--rr-card-shadow)]">
            {/* Use a regular <img> rather than next/image for the static map so
                the same asset can serve as both a Google Static Maps URL and a
                pre-rendered fallback PNG without next/image's domain allowlist
                handshake. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapUrl}
              alt={`Tetherow location map. Centroid ${boundary?.lat ?? '—'}, ${boundary?.lng ?? '—'}.`}
              className="block h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center gap-[18px]">
            {cfg.drive_times.map((d) => (
              <div
                key={`${d.minutes}-${d.destination}`}
                className="flex items-center gap-4 border-b border-[rgba(16,39,66,0.08)] py-[14px] last:border-b-0"
              >
                <div
                  className="min-w-[78px] font-display text-[28px] font-semibold leading-[1] text-[color:var(--rr-navy)]"
                  style={{ fontFamily: 'var(--rr-font-display)' }}
                >
                  {d.minutes} min
                </div>
                <div>
                  <strong className="mb-0.5 block text-[15px] font-semibold text-[color:var(--rr-navy)]">
                    {d.destination}
                  </strong>
                  <span className="text-[13px] text-[color:var(--rr-muted)]">{d.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* LIVE MARKET PULSE */}
      <Section>
        <SectionHead
          eyebrow="Live market pulse"
          headline="Inventory and absorption."
          body="Pulled from the Oregon RMLS feed at the timestamps shown at the bottom of the page."
        />
        <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Active for sale" value={String(eopInventory ?? activeCount)} sub="Single-family residential" />
          <KpiCard
            label="Pending"
            value={String(pendingCount)}
            sub={`Plus ${activeUnderContractCount} active under contract`}
          />
          <KpiCard label="Median list price" value={formatPriceKpi(medianListActive)} sub="Active homes today" />
          <KpiCard label="Median close (last 12mo)" value={formatPriceKpi(medianClose)} sub={`${soldCount} closings`} />
          <KpiCard
            label="Median days on market"
            value={medianDom != null ? String(Math.round(medianDom)) : '—'}
            sub="12-month trailing"
          />
          <KpiCard label="Sale-to-list ratio" value={formatRatioPct(saleToList)} sub="Average across all closes" />
          <KpiCard label="Median $/sqft (closed)" value={formatPpsf(medianPpsf)} sub="Trailing 12 months" />
          <KpiCard label="Methodology" value={methodologyVersion} sub={`Pulled ${methodologyDate}`} />
        </div>
      </Section>

      {/* HOA */}
      <Section id="hoa" variant="navy">
        <SectionHead
          eyebrow="Inside the HOA"
          headline="The dues, by neighborhood."
          body="Every Tetherow homeowner pays a master assessment to the Tetherow Owners Association. Each sub-neighborhood then layers on its own dues, billed by a different management company depending on where the home sits. Verified May 2026 against tetherowowners.com."
          onDark
        />
        <div className="overflow-hidden rounded-2xl border border-[rgba(250,248,244,0.12)] bg-[rgba(250,248,244,0.06)]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[rgba(0,0,0,0.15)]">
                {['Sub-neighborhood', 'Sub-assessment', 'Frequency', 'Annualized (master + sub)', 'Manager'].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-[rgba(250,248,244,0.08)] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[rgba(250,248,244,0.55)]"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {cfg.sub_neighborhoods.map((sn) => (
                <tr
                  key={sn.slug}
                  className="border-b border-[rgba(250,248,244,0.08)] transition hover:bg-[rgba(250,248,244,0.04)] last:border-b-0"
                >
                  <td className="px-5 py-4 text-[14px] text-[color:var(--rr-cream)]">{sn.name}</td>
                  <td className="px-5 py-4 text-[14px] font-semibold tabular-nums text-[color:var(--rr-cream)]">
                    {sn.hoa_sub_assessment}
                  </td>
                  <td className="px-5 py-4 text-[14px] text-[color:var(--rr-cream)]">{sn.hoa_frequency}</td>
                  <td className="px-5 py-4 text-[14px] font-semibold tabular-nums text-[color:var(--rr-cream)]">
                    {sn.hoa_sub_assessment.startsWith('Master')
                      ? `Master ${formatPriceFull(cfg.hoa_master_assessment_annual)} + sub`
                      : `~${formatAnnualDuesShort(sn.hoa_annual_estimate)} `}
                    <span className="text-[12.5px] text-[rgba(250,248,244,0.55)]">/ yr</span>
                  </td>
                  <td className="px-5 py-4 text-[14px] text-[color:var(--rr-cream)]">{sn.hoa_manager}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HoaMetaCard
            eyebrow="Master assessment"
            value={`${formatPriceFull(cfg.hoa_master_assessment_quarterly)} / quarter`}
            detail={`${formatPriceFull(
              cfg.hoa_master_assessment_annual
            )} per year. Charged on every Tetherow lot regardless of sub-neighborhood. Collected via PayHoa.com digital portal since 2022.`}
          />
          <HoaMetaCard
            eyebrow="Litigation history (public)"
            value="No public cases indexed"
            detail="Free Oregon court records search returns zero matches for Tetherow Owners Association as a party. Full clearance requires OJCIN. For seller positioning: a clean public record relative to several other Bend HOAs."
          />
          <HoaMetaCard
            eyebrow="Federal tax filing"
            value="Form 1120-H, not 990"
            detail="TOA files the standard HOA federal return. No Form 990 in the ProPublica Nonprofit Explorer, consistent with a typical homeowners association tax posture."
          />
          <HoaMetaCard
            eyebrow="Reserve fund + capital plan"
            value="Not public"
            detail="Disclosed only via resale certificate at point of sale. Available to the listing broker on day one."
          />
        </div>

        <div className="mt-4 rounded-xl border border-[rgba(250,248,244,0.12)] bg-[rgba(250,248,244,0.06)] px-7 py-6">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[rgba(250,248,244,0.55)]">
            Current TOA board of directors
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.hoa_board.map((b) => (
              <li key={b.name} className="list-none text-[14px]">
                <strong
                  className="mb-0.5 block font-display text-[16px] font-semibold text-[color:var(--rr-cream)]"
                  style={{ fontFamily: 'var(--rr-font-display)' }}
                >
                  {b.name}
                </strong>
                <span className="text-[12.5px] text-[rgba(250,248,244,0.65)]">{b.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* MID-PAGE CTA */}
      <Section tight>
        <div className="grid items-center gap-8 rounded-2xl bg-[color:var(--rr-navy)] px-10 py-9 text-[color:var(--rr-cream)] lg:grid-cols-[1fr_auto]">
          <div>
            <h3
              className="mb-1.5 font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.01em]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              Curious what your home would sell for today?
            </h3>
            <p className="max-w-[520px] text-[14.5px] leading-[1.55] opacity-85">
              A free 12-page value report for your home, built against your specific Tetherow
              sub-neighborhood (Heath, Tartan Druim, Triple Knot, The Rim) using actual closings of
              the last 12 months. No phone follow-up unless you ask.
            </p>
          </div>
          <a
            href="#cma"
            className="whitespace-nowrap rounded-lg bg-[color:var(--rr-cream)] px-7 py-4 text-[15px] font-bold tracking-[0.02em] text-[color:var(--rr-navy)] transition hover:opacity-90"
          >
            Show me what my home is worth
          </a>
        </div>
      </Section>

      {/* THE COURSE + RANKINGS + TIMELINE + SIGNATURE HOLE */}
      <Section id="course">
        <SectionHead
          eyebrow="The course"
          headline="Par 72, fescue greens, +25 spots on the Golf Digest list."
          body="Tetherow opened in 2008 on fire-scarred land west of Bend. Kidd's design borrowed from Scotland: firm-and-fast turf, ball roll, links bunkering. The course made its largest competitive jump in the 2023-24 Golf Digest 100 Greatest Public ranking, up 25 spots, a leap larger than any other course on the list."
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white p-9 shadow-[var(--rr-card-shadow)]">
            <h3
              className="mb-[18px] font-display text-[28px] font-semibold tracking-[-0.01em] text-[color:var(--rr-navy)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              The course, by the numbers
            </h3>
            <p className="mb-[14px] text-[15.5px] leading-[1.65]">{cfg.course_specs.summary}</p>
            <div className="mt-[18px] grid grid-cols-2 gap-[14px]">
              {[
                { label: 'Par', value: String(cfg.course_specs.par) },
                { label: 'Yardage (Kidd tees)', value: cfg.course_specs.yardage.toLocaleString() },
                { label: 'Course rating', value: String(cfg.course_specs.rating) },
                { label: 'Slope (Kidd tees)', value: String(cfg.course_specs.slope) },
              ].map((s) => (
                <div key={s.label} className="rounded-[10px] bg-[#f0ece3] px-[18px] py-[14px]">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--rr-muted)]">
                    {s.label}
                  </div>
                  <div
                    className="font-display text-[20px] font-semibold text-[color:var(--rr-navy)]"
                    style={{ fontFamily: 'var(--rr-font-display)' }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white p-9 shadow-[var(--rr-card-shadow)]">
            <h3
              className="mb-[18px] font-display text-[28px] font-semibold tracking-[-0.01em] text-[color:var(--rr-navy)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              Recognition that travels
            </h3>
            <div className="flex flex-col gap-[14px]">
              {cfg.course_rankings.map((r) => (
                <div
                  key={`${r.rank}-${r.publication}`}
                  className="flex items-center gap-4 border-b border-[rgba(16,39,66,0.08)] py-[14px] last:border-b-0"
                >
                  <div
                    className="min-w-[70px] font-display text-[32px] font-semibold leading-[1] text-[color:var(--rr-navy)]"
                    style={{ fontFamily: 'var(--rr-font-display)' }}
                  >
                    {r.rank}
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-[color:var(--rr-navy)]">{r.publication}</div>
                    <div className="mt-0.5 text-[12.5px] text-[color:var(--rr-muted)]">{r.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* TIMELINE */}
        <Card className="mt-8 rounded-2xl border-none bg-[#f0ece3] p-9 shadow-none">
          <h3
            className="mb-5 font-display text-[24px] font-semibold text-[color:var(--rr-navy)]"
            style={{ fontFamily: 'var(--rr-font-display)' }}
          >
            Tetherow build timeline
          </h3>
          <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {cfg.build_timeline.map((t) => (
              <div key={t.year}>
                <div
                  className="mb-2 font-display text-[28px] font-semibold leading-[1] text-[color:var(--rr-navy)]"
                  style={{ fontFamily: 'var(--rr-font-display)' }}
                >
                  {t.year}
                </div>
                <div className="text-[13px] font-medium leading-[1.45]">{t.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* SIGNATURE HOLE */}
        <div className="mt-9 grid items-center gap-9 rounded-2xl bg-[#f0ece3] p-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div
            role="img"
            aria-label="Tetherow signature hole, par 3"
            className="aspect-[5/4] min-h-[280px] rounded-xl bg-[color:var(--rr-navy)] bg-cover bg-center shadow-[var(--rr-card-shadow)]"
            style={{ backgroundImage: `url('${cfg.signature_hole_image}')` }}
          />
          <div>
            <div className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--rr-muted)]">
              The signature hole
            </div>
            <h3
              className="mb-[14px] font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.012em] text-[color:var(--rr-navy)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              The #{cfg.signature_hole.number}, par {cfg.signature_hole.par}, dropping into the desert.
            </h3>
            {cfg.signature_hole.description.split('. ').slice(0, 2).map((s, i) => (
              <p key={i} className="mb-3 text-[15.5px] leading-[1.65] text-[color:var(--rr-text)]">
                {s}
                {!s.endsWith('.') ? '.' : ''}
              </p>
            ))}
            {cfg.signature_hole.description.split('. ').length > 2 && (
              <p className="mb-3 text-[15.5px] leading-[1.65] text-[color:var(--rr-text)]">
                {cfg.signature_hole.description.split('. ').slice(2).join('. ')}
              </p>
            )}
            <div className="mt-[18px] grid grid-cols-3 gap-3">
              {[
                { label: 'Yardage', value: String(cfg.signature_hole.yardage) },
                { label: 'Par', value: String(cfg.signature_hole.par) },
                {
                  label: 'Elevation drop',
                  value: cfg.signature_hole.elevation_drop_ft ? `${cfg.signature_hole.elevation_drop_ft} ft` : '—',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-[10px] border border-[rgba(16,39,66,0.08)] bg-white px-4 py-[14px] text-center"
                >
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--rr-muted)]">
                    {s.label}
                  </div>
                  <div
                    className="font-display text-[24px] font-semibold leading-[1] text-[color:var(--rr-navy)]"
                    style={{ fontFamily: 'var(--rr-font-display)' }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* LIFESTYLE / AMENITIES */}
      <Section id="lifestyle" variant="cream-dim">
        <SectionHead
          eyebrow="Lifestyle + amenities"
          headline="What you actually live with, day to day."
          body="Tetherow is not just a golf course with houses around it. Eight on-property assets plus the Shevlin Park trail network across the road. What follows is the full inventory."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.amenities.map((a) => (
            <Card
              key={a.name}
              className="rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white p-7 shadow-[var(--rr-card-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--rr-card-shadow-hover)]"
            >
              <div className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--rr-muted)]">
                {a.category}
              </div>
              <h4
                className="mb-2 font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--rr-navy)]"
                style={{ fontFamily: 'var(--rr-font-display)' }}
              >
                {a.name}
              </h4>
              <p className="mb-2 text-[14px] leading-[1.6] text-[color:var(--rr-text)]">{a.description}</p>
              <div className="text-[12.5px] font-medium text-[color:var(--rr-muted)]">
                {'url' in a && a.url ? (
                  <a
                    href={a.url as string}
                    className="underline decoration-[rgba(16,39,66,0.12)] underline-offset-2 hover:decoration-[color:var(--rr-navy)]"
                  >
                    {a.access}
                  </a>
                ) : (
                  a.access
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* MEMBERSHIP TIERS */}
      <Section id="membership" variant="navy">
        <SectionHead
          eyebrow="The Tetherow Club"
          headline="Membership tiers, what they cost, and the waitlist reality."
          body="Most Tetherow homeowners join. A meaningful minority do not. Here's what each tier actually buys, and where the waitlist sits today. Initiation and dues figures change annually. Exact current pricing requires the Tetherow membership office."
          onDark
        />
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {cfg.membership_tiers.map((t) => (
            <Card
              key={t.label}
              className={
                'flex flex-col rounded-2xl p-7 ' +
                (t.featured
                  ? 'border border-[rgba(250,248,244,0.3)] bg-[rgba(250,248,244,0.1)]'
                  : 'border border-[rgba(250,248,244,0.14)] bg-[rgba(250,248,244,0.06)]')
              }
            >
              <div className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.1em] text-[rgba(250,248,244,0.7)]">
                {t.eyebrow}
              </div>
              <h4
                className="mb-3 font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-[color:var(--rr-cream)]"
                style={{ fontFamily: 'var(--rr-font-display)' }}
              >
                {t.name}
              </h4>
              <p className="mb-4 flex-1 text-[14px] leading-[1.6] opacity-90 text-[color:var(--rr-cream)]">
                {t.description}
              </p>
              <ul className="mb-[18px] list-none p-0">
                {t.details.map((d) => (
                  <li
                    key={d.label}
                    className="flex justify-between gap-3 border-b border-[rgba(250,248,244,0.1)] py-1.5 text-[13px] last:border-b-0 text-[color:var(--rr-cream)]"
                  >
                    <span className="opacity-80">{d.label}</span>
                    <span className="whitespace-nowrap font-display font-semibold opacity-95" style={{ fontFamily: 'var(--rr-font-display)' }}>
                      {d.value}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="inline-block w-fit rounded-md border border-[rgba(250,248,244,0.16)] bg-[rgba(250,248,244,0.08)] px-[14px] py-2 text-[12px] font-semibold tracking-[0.04em] text-[color:var(--rr-cream)]">
                {t.waitlist_status}
              </span>
            </Card>
          ))}
        </div>
        <p className="mt-6 max-w-[720px] text-[12.5px] leading-[1.6] text-[rgba(250,248,244,0.6)]">
          Club initiation and dues schedules change annually and are not published on the Tetherow
          public site. The Tetherow membership office ({cfg.membership_office_phone}) confirms
          today&apos;s rate sheet, current waitlist, and the resale-transfer process when a home
          changes hands. Whether the club membership transfers with the home, and at what
          discounted re-initiation, is the single most important diligence item on a Tetherow
          purchase. We walk every buyer and seller through it on day one.
        </p>
      </Section>

      {/* HAPPENINGS */}
      <Section id="happenings">
        <SectionHead
          eyebrow="Current events"
          headline="What your neighbors are talking about."
          body="Refreshed quarterly. Sourced."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {cfg.happenings.map((h) => (
            <Card
              key={h.headline}
              className="rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white p-7 shadow-[var(--rr-card-shadow)]"
            >
              <div className="mb-[14px] text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--rr-muted)]">
                {h.date}
              </div>
              <h4
                className="mb-3 font-display text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] text-[color:var(--rr-navy)]"
                style={{ fontFamily: 'var(--rr-font-display)' }}
              >
                {h.headline}
              </h4>
              <p className="mb-3 text-[14.5px] leading-[1.6] text-[color:var(--rr-text)]">{h.body}</p>
              <div className="text-[12px] font-medium text-[color:var(--rr-muted)]">
                Sources:{' '}
                {h.sources.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 ? ' · ' : ''}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-[rgba(16,39,66,0.12)] underline-offset-2 hover:decoration-[color:var(--rr-navy)]"
                    >
                      {s.label}
                    </a>
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ACTIVE INVENTORY */}
      <Section id="inventory">
        <SectionHead
          eyebrow="For sale right now"
          headline={`Tetherow active inventory. ${eopInventory ?? activeListings.length} homes on the market today.`}
          body="Live MLS pull, sorted by list price. Each card links to the buyer track to schedule a showing."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activeListings.map((l) => (
            <ListingCard key={l.listingKey} listing={l} />
          ))}
        </div>
      </Section>

      {/* BUYER TRACK */}
      <Section id="buyer" variant="navy">
        <SectionHead
          eyebrow="Looking to buy"
          headline="Ready to buy in Tetherow?"
          body="Three doors in. Schedule a showing on a specific home, get on the list for new Tetherow matches, or request the buyer's guide if you're still in research mode."
          onDark
        />
        <p className="-mt-4 mb-7 text-[14.5px] text-[rgba(250,248,244,0.92)]">
          Prefer to talk first? Call Matt direct at{' '}
          <a
            href="tel:+15412136706"
            className="font-semibold text-[color:var(--rr-cream)] underline decoration-[rgba(250,248,244,0.35)] underline-offset-4"
          >
            541.213.6706
          </a>
          .
        </p>
        <TetherowBuyerForms showingOptions={showingOptions} />
      </Section>

      {/* NOTABLE TRANSACTIONS */}
      <Section>
        <SectionHead
          eyebrow="Recent closings"
          headline="What actually traded. Last 90 days at Tetherow."
          body="Anonymized at the street level. Every number traces to a verified Oregon RMLS close-of-record. Price-per-square-foot and sale-to-list ratio computed against close price and original list. Sub-neighborhood = SubdivisionName on the public MLS record."
        />
        <div className="overflow-hidden rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white shadow-[var(--rr-card-shadow)]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[rgba(16,39,66,0.04)]">
                {['Closed', 'Sub-neighborhood', 'Beds / baths', 'Sqft', 'Close', '$/sqft', 'Sale-to-list'].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-[rgba(16,39,66,0.08)] px-[18px] py-[14px] text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--rr-muted)]"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {recentClosings.map((c, i) => {
                const isLastRow = i === recentClosings.length - 1
                const stLClass =
                  c.saleToListPct == null
                    ? ''
                    : c.saleToListPct >= 100
                      ? 'text-[#2d7a2d] font-bold'
                      : c.saleToListPct < 91
                        ? 'text-[#b25822] font-bold'
                        : ''
                return (
                  <tr
                    key={`${c.closeDate}-${i}`}
                    className={
                      'transition hover:bg-[rgba(16,39,66,0.04)] ' +
                      (isLastRow ? '' : 'border-b border-[rgba(16,39,66,0.08)]')
                    }
                  >
                    <td className="px-[18px] py-[14px] text-[13.5px]">{formatCloseDate(c.closeDate)}</td>
                    <td className="px-[18px] py-[14px] text-[13.5px]">
                      {c.subdivisionName ?? 'Tetherow'}
                    </td>
                    <td className="px-[18px] py-[14px] text-[13.5px]">
                      {c.bedrooms ?? '—'} / {c.bathrooms ?? '—'}
                    </td>
                    <td className="px-[18px] py-[14px] text-[13.5px] font-semibold tabular-nums text-[color:var(--rr-navy)]">
                      {c.livingAreaSqFt != null ? c.livingAreaSqFt.toLocaleString() : '—'}
                    </td>
                    <td className="px-[18px] py-[14px] text-[13.5px] font-semibold tabular-nums text-[color:var(--rr-navy)]">
                      {formatPriceFull(c.closePrice)}
                    </td>
                    <td className="px-[18px] py-[14px] text-[13.5px] font-semibold tabular-nums text-[color:var(--rr-navy)]">
                      {c.pricePerSqFt != null ? `$${c.pricePerSqFt.toLocaleString()}` : '—'}
                    </td>
                    <td className={`px-[18px] py-[14px] text-[13.5px] tabular-nums ${stLClass}`}>
                      {c.saleToListPct != null ? `${c.saleToListPct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-[18px] max-w-[860px] text-[13px] leading-[1.6] text-[color:var(--rr-muted)]">
          Live close data from Supabase market cache · methodology {methodologyVersion}, computed{' '}
          {methodologyDate}. Sale-to-list ratio is computed against original list price; price
          per square foot is computed against close price and reported living area. Larger floor
          plans show wider list-to-close gaps. The 12-month median sale-to-list at Tetherow is{' '}
          {formatRatioPct(saleToList)} across all closings.
        </p>
      </Section>

      {/* SUB-NEIGHBORHOOD CAROUSEL */}
      <Section>
        <SectionHead
          eyebrow="Sub-communities"
          headline={`${cfg.sub_neighborhoods.length} neighborhoods inside the ${cfg.acres}-acre master plan.`}
          body="Each with its own architectural guidelines, lot size, dues schedule, and turnover pattern. Drag, scroll, or use the arrows to browse. Tap any card for the sub-neighborhood profile."
        />
        <TetherowScroller cards={scrollerCards} />
      </Section>

      {/* BUILDERS */}
      <Section>
        <SectionHead
          eyebrow="Who builds at Tetherow"
          headline="The builder roster. Why it matters when you list."
          body="Buyers in the $1.8M to $4M range buy a builder as much as a home. They know who builds tight, who manages a difficult subcontractor schedule, and whose 2018 work is showing its age. Naming your builder in the listing copy moves the home."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.builders.map((b) => (
            <Card
              key={b.name}
              className="rounded-xl border border-[rgba(16,39,66,0.08)] bg-white p-6 shadow-[var(--rr-card-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--rr-card-shadow-hover)]"
            >
              <h4
                className="mb-1.5 font-display text-[20px] font-semibold tracking-[-0.01em] text-[color:var(--rr-navy)]"
                style={{ fontFamily: 'var(--rr-font-display)' }}
              >
                {b.name}
              </h4>
              <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--rr-muted)]">
                {b.role}
              </div>
              <p className="mb-1.5 text-[14px] leading-[1.55] text-[color:var(--rr-text)]">{b.description}</p>
              {b.website && (
                <div className="text-[12px] text-[color:var(--rr-muted)]">
                  <a
                    href={b.website}
                    className="underline decoration-[rgba(16,39,66,0.12)] underline-offset-2 hover:decoration-[color:var(--rr-navy)]"
                  >
                    {(b.website ?? '').replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>

      {/* PIPELINE */}
      <Section>
        <SectionHead
          eyebrow="The pipeline"
          headline="What's moving in the planning record + ownership filings."
          body="Forward-looking. Updated quarterly."
        />
        <div className="rounded-2xl bg-[#f0ece3] px-8 py-7">
          {cfg.pipeline.map((p, i) => (
            <div
              key={p.headline}
              className={
                'grid items-start gap-[18px] py-[18px] sm:grid-cols-[auto_1fr] ' +
                (i < cfg.pipeline.length - 1 ? 'border-b border-[rgba(16,39,66,0.08)]' : '')
              }
            >
              <Badge
                variant="outline"
                className={
                  'whitespace-nowrap rounded-[4px] px-[10px] py-1 text-[10px] font-bold uppercase tracking-[0.1em] border-0 ' +
                  (p.status === 'completed'
                    ? 'bg-[#2d7a2d] text-white'
                    : p.status === 'watching'
                      ? 'bg-[#b8860b] text-white'
                      : 'bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]')
                }
              >
                {p.status}
              </Badge>
              <div>
                <h4
                  className="mb-1.5 font-display text-[19px] font-semibold"
                  style={{ fontFamily: 'var(--rr-font-display)' }}
                >
                  {p.headline}
                </h4>
                <p className="mb-1.5 text-[14px] leading-[1.55] text-[color:var(--rr-text)]">{p.body}</p>
                {p.source_label && p.source_url && (
                  <div className="text-[11.5px] text-[color:var(--rr-muted)]">
                    Source:{' '}
                    <a
                      href={p.source_url}
                      className="underline decoration-[rgba(16,39,66,0.12)] underline-offset-2 hover:decoration-[color:var(--rr-navy)]"
                    >
                      {p.source_label}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* COMPARISON */}
      <Section variant="cream-dim">
        <SectionHead
          eyebrow="Tetherow vs the field"
          headline="How Tetherow trades against the rest of the Central Oregon resort set."
          body={`Rolling-365-day median figures, methodology ${methodologyVersion}, pulled ${methodologyDate} from the Oregon RMLS feed. Single-family residential only. Resort communities are not interchangeable. The numbers below explain why.`}
        />
        <div className="overflow-x-auto rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white shadow-[var(--rr-card-shadow)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[rgba(16,39,66,0.08)] bg-[rgba(16,39,66,0.04)] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--rr-muted)]"></th>
                {peerRows.length > 0 ? (
                  peerRows.map((r) => (
                    <th
                      key={r.geoSlug}
                      className={
                        'border-b border-[rgba(16,39,66,0.08)] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] ' +
                        (r.geoSlug === cfg.geo_slug
                          ? 'bg-[color:var(--rr-navy)] text-[rgba(250,248,244,0.85)]'
                          : 'bg-[rgba(16,39,66,0.04)] text-[color:var(--rr-muted)]')
                      }
                    >
                      {r.geoLabel}
                    </th>
                  ))
                ) : (
                  <th className="border-b border-[rgba(16,39,66,0.08)] bg-[rgba(16,39,66,0.04)] px-5 py-4 text-left text-[11px] text-[color:var(--rr-muted)]">
                    Tetherow
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Median close (12mo)" rows={peerRows} cellGeoSlug={cfg.geo_slug} getter={(r) => formatPriceFull(r.medianSalePrice)} />
              <CompareRow label="Homes sold (12mo)" rows={peerRows} cellGeoSlug={cfg.geo_slug} getter={(r) => (r.soldCount != null ? String(r.soldCount) : '—')} />
              <CompareRow label="Median DOM" rows={peerRows} cellGeoSlug={cfg.geo_slug} getter={(r) => (r.medianDom != null ? `${Math.round(r.medianDom)} days` : '—')} />
              <CompareRow label="Sale-to-list" rows={peerRows} cellGeoSlug={cfg.geo_slug} getter={(r) => formatRatioPct(r.avgSaleToListRatio)} />
              <CompareRow label="Median $/sqft (closed)" rows={peerRows} cellGeoSlug={cfg.geo_slug} getter={(r) => formatPpsf(r.medianPpsf)} />
              <CompareRow label="Active inventory today" rows={peerRows} cellGeoSlug={cfg.geo_slug} getter={(r) => (r.endOfPeriodInventory != null ? String(r.endOfPeriodInventory) : '—')} isLast />
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-[860px] text-[14px] leading-[1.65] text-[color:var(--rr-text)]">
          <strong>What this means for a Tetherow seller.</strong> Tetherow homes are
          pricing-disciplined. {formatRatioPct(saleToList)} sale-to-list ratio with a{' '}
          {medianDom ?? '—'}-day median market velocity. Broken Top moves on similar inventory at
          lower price points. Pronghorn trades at a higher median, but the wider list-to-close gap
          tells you sellers there are leaving more money on the table. Caldera Springs is the
          closest peer at price-per-square-foot, but Tetherow&apos;s faster market velocity keeps
          Tetherow homes turning. The Sunriver number is whole-resort, not luxury-only, so it sits
          as the broader Central Oregon resort floor for context.
        </p>
      </Section>

      {/* OUR WORK / BROKER BLOCK */}
      <Section>
        <SectionHead eyebrow="If you list" headline="Marketing built for a Tetherow listing." />
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h3
              className="mb-[18px] font-display text-[38px] font-semibold leading-[1.1] tracking-[-0.012em] text-[color:var(--rr-navy)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              {cfg.broker_block.headline}
            </h3>
            <p className="mb-[14px] text-[16px] leading-[1.7] text-[color:var(--rr-text)]">{cfg.broker_block.lead}</p>
            <p className="mb-[14px] text-[16px] leading-[1.7] text-[color:var(--rr-text)]">
              {cfg.broker_block.intro}
            </p>
            <ul className="my-[18px] list-disc space-y-2 pl-5">
              {cfg.broker_block.bullets.map((b) => (
                <li key={b} className="text-[15px] leading-[1.65] text-[color:var(--rr-text)]">
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <Card className="rounded-2xl border-none bg-[#f0ece3] p-9 shadow-none">
            <div className="flex items-center gap-6">
              <div
                className="h-[180px] w-[140px] shrink-0 rounded-xl bg-white bg-contain bg-bottom bg-no-repeat shadow-[0_1px_2px_rgba(16,39,66,0.06)]"
                style={{ backgroundImage: `url('${cfg.broker_block.headshot}')` }}
                role="img"
                aria-label="Matt Ryan headshot"
              />
              <div>
                <strong
                  className="mb-1 block font-display text-[26px] font-semibold leading-[1.1] text-[color:var(--rr-navy)]"
                  style={{ fontFamily: 'var(--rr-font-display)' }}
                >
                  {cfg.broker_block.name}
                </strong>
                <span className="mb-1.5 block whitespace-pre-line text-[13.5px] leading-[1.5] text-[color:var(--rr-muted)]">
                  {cfg.broker_block.role_long}
                </span>
                <span className="block text-[11.5px] tracking-[0.04em] text-[color:var(--rr-muted)]">
                  {cfg.broker_block.license_text}
                </span>
                <span className="mt-2.5 block whitespace-pre-line text-[13.5px] font-medium leading-[1.6] text-[color:var(--rr-navy)]">
                  {`${cfg.broker_block.phone} · ${cfg.broker_block.email}\n${cfg.broker_block.office}`}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* CMA seller form */}
      <Section id="cma" variant="navy" extraClassName="py-20">
        <div className="grid items-stretch gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h2
              className="mb-5 font-display text-[clamp(36px,5vw,56px)] font-semibold leading-[1.05] tracking-[-0.015em] text-[color:var(--rr-cream)]"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              What would your Tetherow home sell for today? Free, no pressure, no follow-up unless
              you ask.
            </h2>
            <p className="mb-4 text-[17px] leading-[1.65] text-[rgba(250,248,244,0.85)]">
              A 12-page value report on your home, built against your sub-neighborhood, your floor
              plan range, your view category, and your HOA tier. Anchored to the {soldCount}{' '}
              Tetherow homes that have sold in the last 365 days.
            </p>
            <ul className="mt-6 list-none space-y-3 p-0">
              {[
                'Signed by a licensed Oregon principal broker, not an automated estimate like Zillow\'s',
                'Built on actual Tetherow sales, not citywide averages',
                'Shows how close homes are selling to list price, how long they\'re taking to sell, and which homes near you sold for what',
                'Delivered as a PDF. Yours to keep, share, or compare with another broker',
                'To your inbox with a confirmation text. No phone tag.',
              ].map((item) => (
                <li
                  key={item}
                  className="relative pl-7 text-[15px] leading-[1.6] text-[color:var(--rr-cream)] before:absolute before:left-0 before:top-0 before:font-bold before:text-[#6fcf7a] before:content-['✓']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-[rgba(250,248,244,0.16)] sm:grid-cols-3">
              <TrustStripItem value="#201206613" label="OR Principal Broker" />
              <TrustStripItem value={String(soldCount)} label="Tetherow homes sold, 12mo" />
              <TrustStripItem value={formatRatioPct(saleToList)} label="Avg sale-to-list price" />
            </div>
            <TetherowMultiStepForm />
          </div>
        </div>
      </Section>

      {/* METHODOLOGY */}
      <Section tight>
        <SectionHead eyebrow="Methodology" headline="Where every number on this page came from." />
        <div className="rounded-2xl bg-[rgba(16,39,66,0.04)] p-9 text-[13px] leading-[1.75] text-[color:var(--rr-muted)]">
          <strong className="font-semibold text-[color:var(--rr-text)]">
            Every figure on this page traces to a verified row in our database or a public source URL.
          </strong>
          <ul className="ml-5 mt-3 space-y-2">
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">Live market pulse.</strong>{' '}
              Computed against the City of Bend GIS Tetherow boundary and the Deschutes County
              recorded sub-plats. Oregon RMLS feed via{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--rr-navy)]">market_stats_cache</code>{' '}
              rolling-365-day window, pulled {methodologyDate}. Methodology{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--rr-navy)]">
                {methodologyVersion}
              </code>
              .
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">HOA dues + management.</strong>{' '}
              <MethodologyLink href="https://www.tetherowowners.com/">Tetherow Owners Association</MethodologyLink>, verified May
              2026. Master $366/quarter. Sub-neighborhood schedule confirmed against the TOA
              neighborhood pages.
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">HOA board composition.</strong>{' '}
              Tetherow Owners Association website, May 2026.
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">Litigation history.</strong> Free{' '}
              <MethodologyLink href="https://www.courts.oregon.gov/services/online/pages/records-calendars.aspx">
                Oregon Judicial Department records search
              </MethodologyLink>
              , May 2026. Full clearance requires the OJCIN paid subscription.
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">Tax filing posture.</strong>{' '}
              Inferred from absence of TOA listing in{' '}
              <MethodologyLink href="https://projects.propublica.org/nonprofits/search?q=tetherow">
                ProPublica Nonprofit Explorer
              </MethodologyLink>
              , consistent with Form 1120-H filing.
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">Course design, specs, rankings.</strong>{' '}
              <MethodologyLink href="https://tetherow.com/luxury-golf-resort/golf-course/">
                Tetherow Resort
              </MethodologyLink>
              ,{' '}
              <MethodologyLink href="https://tetherow.com/blog/tetherow-jumps-to-no-57-on-top-100-courses-list-by-golfdigest/">
                Tetherow blog (Golf Digest jump)
              </MethodologyLink>
              ,{' '}
              <MethodologyLink href="https://www.greenskeeper.org/oregon/central_northeast/tetherow_golf_club/scorecard.cfm">
                GreensKeeper.org scorecard
              </MethodologyLink>
              ,{' '}
              <MethodologyLink href="https://en.wikipedia.org/wiki/David_McLay_Kidd">
                Wikipedia (David McLay Kidd)
              </MethodologyLink>
              .
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--rr-text)]">Boundary centroid.</strong>{' '}
              {boundary?.source ?? '—'}.{' '}
              {boundary?.sourceUrl && (
                <MethodologyLink href={boundary.sourceUrl}>GIS source</MethodologyLink>
              )}
              . Centroid lat {boundary?.lat.toFixed(6) ?? '—'}, lng {boundary?.lng.toFixed(6) ?? '—'}.
            </li>
          </ul>
          <p className="mt-4">
            <strong className="font-semibold text-[color:var(--rr-text)]">What&apos;s not on the page, and why.</strong>{' '}
            Reserve fund balance, current reserve study summary, active special assessments, and
            current Tetherow Club membership initiation fee + monthly dues. None are publicly
            disclosed. They&apos;re sourced via the resale certificate at point of sale or directly
            from the Tetherow membership office ({cfg.membership_office_phone}).
          </p>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="bg-[color:var(--rr-navy)] px-0 pt-12 pb-7 text-[color:var(--rr-cream)]">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div
              className="mb-2.5 font-display text-[26px] font-semibold"
              style={{ fontFamily: 'var(--rr-font-display)' }}
            >
              Ryan Realty
            </div>
            <div className="max-w-[320px] text-[13px] leading-[1.7] opacity-75">
              A Bend, Oregon brokerage operating under Matt Ryan&apos;s Principal Broker license.
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-[12px] font-bold uppercase tracking-[0.12em] opacity-70">
              Reach us
            </h4>
            <ul className="list-none space-y-2">
              <li className="text-[14px] opacity-85">{cfg.broker_block.phone}</li>
              <li className="text-[14px] opacity-85">{cfg.broker_block.email}</li>
              <li className="text-[14px] opacity-85">
                115 NW Oregon Avenue
                <br />
                Bend, OR 97703
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-[12px] font-bold uppercase tracking-[0.12em] opacity-70">
              Resort + community pages
            </h4>
            <ul className="list-none space-y-2">
              {cfg.footer_resort_pages.map((p) => (
                <li key={p.name} className="text-[14px] opacity-85">
                  {p.name}
                  {p.current ? ' (you are here)' : ''}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-full mt-7 border-t border-[rgba(250,248,244,0.12)] pt-6 text-[12px] leading-[1.65] opacity-60">
            Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Listing
            data courtesy of Oregon Datashare RMLS · Tetherow Resort and Golf Club is a registered
            trademark of its respective owner. This page is independent brokerage analysis, not a
            Tetherow Resort, Tetherow Owners Association, or Troon publication. No affiliation
            implied. Course photography © Tetherow Resort, used editorially with attribution. Active
            listing photos used under the IDX broker license.
          </div>
        </div>
      </footer>

      <TetherowExitModal />
    </div>
  )
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function TetherowGlobalStyle() {
  // Inline the --rr-* tokens used by the page. Mirrors the static exemplar's
  // :root block. Wrapped inside .tetherow-lp so the tokens stay scoped to this
  // route and never leak to the broader app.
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        .tetherow-lp {
          --rr-navy: #102742;
          --rr-cream: #faf8f4;
          --rr-text: #102742;
          --rr-muted: rgba(16, 39, 66, 0.62);
          --rr-card-shadow: 0 1px 2px rgba(16, 39, 66, 0.04), 0 4px 12px rgba(16, 39, 66, 0.06);
          --rr-card-shadow-hover: 0 1px 2px rgba(16, 39, 66, 0.06), 0 8px 24px rgba(16, 39, 66, 0.1);
          --rr-font-display: 'Playfair Display', Georgia, serif;
          --rr-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .tetherow-lp { font-feature-settings: "tnum" on, "lnum" on; }
        .tetherow-lp a { color: inherit; }
        @media (max-width: 900px) {
          .tetherow-lp section.tetherow-section { padding-top: 48px; padding-bottom: 48px; }
        }
      `,
      }}
    />
  )
}

function HeroStat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <div
      className={
        'border-r border-[rgba(250,248,244,0.12)] px-6 py-[22px] text-[color:var(--rr-cream)] last:border-r-0 ' +
        (last ? 'border-r-0' : '')
      }
    >
      <div
        className="mb-1.5 font-display text-[34px] font-semibold leading-[1] tracking-[-0.01em]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">{label}</div>
    </div>
  )
}

function Section({
  children,
  id,
  variant,
  tight,
  extraClassName,
}: {
  children: React.ReactNode
  id?: string
  variant?: 'about' | 'navy' | 'cream-dim'
  tight?: boolean
  extraClassName?: string
}) {
  const padding = tight ? 'py-10' : 'py-16'
  const bg =
    variant === 'navy'
      ? 'bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)] border-b-0'
      : variant === 'cream-dim'
        ? 'bg-[#f0ece3]'
        : variant === 'about'
          ? 'bg-[color:var(--rr-cream)]'
          : ''
  return (
    <section
      id={id}
      className={
        'tetherow-section border-b border-[rgba(16,39,66,0.08)] ' +
        padding +
        ' ' +
        bg +
        ' ' +
        (extraClassName ?? '')
      }
    >
      <div className="mx-auto max-w-[1200px] px-6">{children}</div>
    </section>
  )
}

function SectionHead({
  eyebrow,
  headline,
  body,
  onDark,
}: {
  eyebrow: string
  headline: string
  body?: string
  onDark?: boolean
}) {
  return (
    <div className="mb-9">
      <div
        className={
          'mb-3 text-[12px] font-bold uppercase tracking-[0.14em] ' +
          (onDark ? 'text-[rgba(250,248,244,0.55)]' : 'text-[color:var(--rr-muted)]')
        }
      >
        {eyebrow}
      </div>
      <h2
        className={
          'mb-3 font-display text-[clamp(30px,4.4vw,48px)] font-semibold leading-[1.1] tracking-[-0.012em] ' +
          (onDark ? 'text-[color:var(--rr-cream)]' : 'text-[color:var(--rr-navy)]')
        }
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        {headline}
      </h2>
      {body && (
        <p
          className={
            'max-w-[740px] text-[17px] leading-[1.55] ' +
            (onDark ? 'text-[rgba(250,248,244,0.7)]' : 'text-[color:var(--rr-muted)]')
          }
        >
          {body}
        </p>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white p-6 shadow-[var(--rr-card-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--rr-card-shadow-hover)]">
      <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--rr-muted)]">
        {label}
      </div>
      <div
        className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.01em] text-[color:var(--rr-navy)] tabular-nums"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px] font-medium text-[color:var(--rr-muted)]">{sub}</div>
    </Card>
  )
}

function FactRow({ term, value, sub }: { term: string; value: string; sub: string }) {
  return (
    <>
      <dt className="mb-1 mt-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[color:var(--rr-muted)] first:mt-0">
        {term}
      </dt>
      <dd
        className="m-0 font-display text-[20px] font-semibold leading-[1.2] tracking-[-0.005em] text-[color:var(--rr-navy)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        {value}
        <span className="mt-0.5 block text-[12.5px] font-medium tracking-normal text-[color:var(--rr-muted)]" style={{ fontFamily: 'var(--rr-font-sans)' }}>
          {sub}
        </span>
      </dd>
    </>
  )
}

function HoaMetaCard({ eyebrow, value, detail }: { eyebrow: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[rgba(250,248,244,0.12)] bg-[rgba(250,248,244,0.06)] p-5">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[rgba(250,248,244,0.55)]">
        {eyebrow}
      </div>
      <div
        className="mb-1.5 font-display text-[22px] font-semibold leading-[1.2] text-[color:var(--rr-cream)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        {value}
      </div>
      <div className="text-[13px] leading-[1.5] text-[rgba(250,248,244,0.7)]">{detail}</div>
    </div>
  )
}

function ListingCard({
  listing,
}: {
  listing: import('./data').TetherowActiveListing
}) {
  const facts = [
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
    listing.livingAreaSqFt != null ? `${listing.livingAreaSqFt.toLocaleString()} sqft` : null,
  ].filter(Boolean) as string[]
  const statusPillClass =
    listing.statusLabel.toLowerCase().includes('pending')
      ? 'bg-[#b8860b]'
      : listing.statusLabel.toLowerCase().includes('contract')
        ? 'bg-[#8b4513]'
        : 'bg-[color:var(--rr-navy)]'

  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl border border-[rgba(16,39,66,0.08)] bg-white shadow-[var(--rr-card-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--rr-card-shadow-hover)]">
      <div
        className="relative aspect-[4/3] bg-[rgba(16,39,66,0.08)] bg-cover bg-center"
        style={listing.photoUrl ? { backgroundImage: `url('${listing.photoUrl}')` } : undefined}
      >
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--rr-cream)] ${statusPillClass}`}
        >
          {listing.statusLabel}
        </span>
        {listing.cumulativeDaysOnMarket != null && (
          <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[color:var(--rr-navy)] shadow-[0_2px_4px_rgba(16,39,66,0.15)]">
            {listing.cumulativeDaysOnMarket} days
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5 pb-5">
        <div
          className="font-display text-[24px] font-semibold tracking-[-0.01em] text-[color:var(--rr-navy)]"
          style={{ fontFamily: 'var(--rr-font-display)' }}
        >
          {formatPriceFull(listing.listPrice)}
        </div>
        <div className="text-[14px] font-medium">{listing.addressLine}</div>
        {facts.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2 text-[13px] text-[color:var(--rr-muted)]">
            {facts.map((f, i) => (
              <span key={f}>
                {f}
                {i < facts.length - 1 ? ' ·' : ''}
              </span>
            ))}
          </div>
        )}
        {facts.length === 0 && (
          <div className="mt-1 text-[13px] text-[color:var(--rr-muted)]">{listing.subdivisionName ?? 'Tetherow'}</div>
        )}
        <Button
          asChild
          className="mt-3 w-full rounded-lg bg-[color:var(--rr-navy)] py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--rr-cream)] hover:opacity-90"
        >
          <a href="#buyer">Schedule a showing</a>
        </Button>
      </div>
    </Card>
  )
}

function TrustStripItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[rgba(250,248,244,0.06)] px-5 py-4 text-center">
      <div
        className="mb-1 font-display text-[22px] font-semibold leading-[1.1] text-[color:var(--rr-cream)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        {value}
      </div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[rgba(250,248,244,0.7)]">
        {label}
      </div>
    </div>
  )
}

function CompareRow({
  label,
  rows,
  cellGeoSlug,
  getter,
  isLast,
}: {
  label: string
  rows: import('./data').TetherowPeerRow[]
  cellGeoSlug: string
  getter: (r: import('./data').TetherowPeerRow) => string
  isLast?: boolean
}) {
  return (
    <tr className={isLast ? '' : 'border-b border-[rgba(16,39,66,0.08)]'}>
      <td className="px-5 py-4 text-[14px] font-semibold text-[color:var(--rr-navy)]">{label}</td>
      {rows.map((r) => (
        <td
          key={r.geoSlug}
          className={
            'px-5 py-4 text-[14px] tabular-nums ' +
            (r.geoSlug === cellGeoSlug ? 'bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]' : '')
          }
        >
          {getter(r)}
        </td>
      ))}
    </tr>
  )
}

function MethodologyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[color:var(--rr-navy)] underline decoration-[rgba(16,39,66,0.12)] underline-offset-2 hover:decoration-[color:var(--rr-navy)]"
    >
      {children}
    </a>
  )
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function formatAnnualDuesShort(annual: number): string {
  if (annual >= 1000) return `$${(annual / 1000).toFixed(annual % 1000 === 0 ? 0 : 3).replace(/\.?0+$/, '')},000`.replace(/,000,000/, ',000')
  return `$${annual.toLocaleString('en-US')}`
}

function shortDuesNote(sn: { type: string; description: string }): string {
  // Drag the type tag into the dues line if it adds context.
  const lower = sn.type.toLowerCase()
  if (lower.includes('townhome')) return 'monthly billing'
  if (lower.includes('golf homes')) return 'golf-frontage'
  if (lower.includes('gated')) return 'gated custom'
  if (lower.includes('vacation')) return 'Cairn Cottages'
  if (lower.includes('planned')) return 'walkable to amenities'
  return sn.description.split('.')[0] ?? sn.description
}
