/**
 * Tetherow buyer's guide — canonical web version.
 *
 * Long-form guide that backs the "Soft start" card on /lp/tetherow/. The
 * /api/buyers-guide/request endpoint emails the PDF (generated from this
 * same page via Puppeteer + `?print=true`); the web version stays current
 * via ISR.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.1 Step 5.
 *
 * Data accuracy: every figure on the page traces to a live Supabase query
 * at render time. The static brand content (architect bio, sub-neighborhood
 * profiles, builder roster, etc.) comes from data/resort-community-tetherow.json.
 *
 * Brand voice: sentence case, no em-dashes in body, no banned vocabulary.
 */
import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { createServiceClient } from '@/lib/supabase/service'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6h

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: "Tetherow buyer's guide | Ryan Realty",
  description:
    "The Tetherow buyer's guide. HOA tiers, club membership reality, sub-neighborhood profiles, builder roster, recent close history. Free PDF download.",
  alternates: { canonical: `${siteUrl}/lp/tetherow/buyers-guide/` },
  openGraph: {
    title: "Tetherow buyer's guide",
    description:
      "HOA tiers, club membership reality, sub-neighborhood profiles, builder roster, recent close history. Free PDF download.",
    type: 'article',
    url: `${siteUrl}/lp/tetherow/buyers-guide/`,
  },
}

type ResortConfig = {
  slug: string
  name: string
  label: string
  city: string
  state: string
  founded: number
  acres: number
  architect: string
  sub_neighborhoods: Array<{
    slug: string
    name: string
    type: string
    hoa_annual_estimate: number
    hoa_sub_assessment: string
    hoa_frequency: string
    hoa_manager: string
    description: string
  }>
  amenities?: Array<{ category: string; name: string; description: string; access: string }>
  membership_tiers?: Array<{
    label: string
    eyebrow: string
    description: string
    waitlist_status: string
  }>
  builders?: Array<{ name: string; role: string; description: string; website?: string }>
  signature_hole?: { number: number; par: number; yardage: number; elevation_drop_ft?: number; description: string }
  course_specs?: { par: number; yardage: number; rating: number; slope: number }
  course_rankings?: Array<{ rank: string; publication: string; description: string }>
  drive_times?: Array<{ minutes: number; destination: string; note: string }>
  hoa_master_quarterly?: number
  hoa_master_annual?: number
  subdivision_aliases?: string[]
}

async function loadConfig(): Promise<ResortConfig> {
  const p = path.join(process.cwd(), 'data', 'resort-community-tetherow.json')
  const raw = await fs.readFile(p, 'utf8')
  return JSON.parse(raw) as ResortConfig
}

type KpiRow = {
  sold_count: number | null
  median_sale_price: number | null
  median_dom: number | null
  avg_sale_to_list_ratio: number | null
  median_ppsf: number | null
  end_of_period_inventory: number | null
  computed_at: string | null
  methodology_version: string | null
}

async function loadKpis(): Promise<KpiRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('market_stats_cache')
    .select(
      'sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory, computed_at, methodology_version',
    )
    .eq('geo_slug', 'tetherow')
    .eq('period_type', 'rolling_365d')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn("[tetherow buyers-guide] kpi query failed:", error.message)
    return null
  }
  return (data ?? null) as KpiRow | null
}

type Closing = {
  CloseDate: string | null
  ClosePrice: number | null
  ListPrice: number | null
  OriginalListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  SubdivisionName: string | null
}

async function loadRecentClosings(aliases: string[]): Promise<Closing[]> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('listings')
    .select(
      'CloseDate, ClosePrice, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName',
    )
    .in('SubdivisionName', aliases.length > 0 ? aliases : ['Tetherow'])
    .in('StandardStatus', ['Closed', 'Sold'])
    .eq('PropertyType', 'A')
    .gte('CloseDate', since)
    .order('CloseDate', { ascending: false })
    .limit(12)
  if (error) {
    console.warn("[tetherow buyers-guide] closings query failed:", error.message)
    return []
  }
  return (data ?? []) as unknown as Closing[]
}

type Active = {
  ListPrice: number | null
  BedroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
}

async function loadActiveAggregate(aliases: string[]): Promise<{
  count: number
  minPrice: number | null
  maxPrice: number | null
  medianPrice: number | null
}> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listings')
    .select('ListPrice, BedroomsTotal, TotalLivingAreaSqFt')
    .in('SubdivisionName', aliases.length > 0 ? aliases : ['Tetherow'])
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', 'A')
    .order('ListPrice', { ascending: false })
    .limit(100)
  if (error) {
    console.warn("[tetherow buyers-guide] active query failed:", error.message)
    return { count: 0, minPrice: null, maxPrice: null, medianPrice: null }
  }
  const rows = (data ?? []) as Active[]
  const prices = rows.map((r) => r.ListPrice).filter((p): p is number => typeof p === 'number')
  prices.sort((a, b) => a - b)
  const minPrice = prices[0] ?? null
  const maxPrice = prices[prices.length - 1] ?? null
  const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null
  return { count: rows.length, minPrice, maxPrice, medianPrice }
}

function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null) return '—'
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  // values from cache come as 0..1
  return `${(n * 100).toFixed(1)}%`
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

function fmtMonthYear(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function pricePerSqft(close: number | null, sqft: number | null): string {
  if (!close || !sqft || sqft <= 0) return '—'
  return `$${Math.round(close / sqft)}`
}

function saleToList(close: number | null, list: number | null): string {
  if (!close || !list || list <= 0) return '—'
  return `${((close / list) * 100).toFixed(1)}%`
}

export default async function TetherowBuyersGuide({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>
}) {
  const { print } = await searchParams
  const isPrint = print === 'true' || print === '1'
  const [config, kpis, activeAgg] = await Promise.all([loadConfig(), loadKpis(), loadActiveAggregate(['Tetherow'])])
  const closings = await loadRecentClosings(['Tetherow'])

  const monthYear = fmtMonthYear()

  return (
    <main className={`tw-bg-cream ${isPrint ? 'print-mode' : ''}`}>
      {/* Print + screen styles — local, no global token leak */}
      <style>{`
        :root { --tw-bg-cream: #faf8f4; --tw-navy: #102742; --tw-muted: #5d6470; }
        .tw-bg-cream { background-color: #faf8f4; color: #102742; font-family: 'Geist', system-ui, sans-serif; }
        .guide-shell { max-width: 800px; margin: 0 auto; padding: 48px 32px; }
        .guide-section { padding: 36px 0; border-bottom: 1px solid rgba(16,39,66,0.08); }
        .guide-section:last-child { border-bottom: none; }
        .guide-h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 44px; line-height: 1.1; margin: 0 0 16px; letter-spacing: -0.012em; }
        .guide-h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; line-height: 1.15; margin: 0 0 14px; letter-spacing: -0.01em; }
        .guide-h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; line-height: 1.2; margin: 0 0 10px; }
        .guide-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 12px; }
        .guide-prose { font-size: 16px; line-height: 1.65; margin-bottom: 14px; }
        .guide-prose strong { font-weight: 600; }
        .guide-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0 24px; }
        .guide-kpi { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 10px; padding: 14px; }
        .guide-kpi-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 4px; }
        .guide-kpi-value { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; line-height: 1; font-variant-numeric: tabular-nums; }
        .guide-table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; }
        .guide-table th, .guide-table td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid rgba(16,39,66,0.08); }
        .guide-table th { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); background: rgba(16,39,66,0.03); }
        .guide-table .num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
        .sub-page { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 22px 24px; margin: 12px 0; page-break-inside: avoid; }
        .sub-page h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin: 0 0 6px; }
        .sub-page .meta { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 10px; }
        .sub-page p { font-size: 14.5px; line-height: 1.6; margin: 0 0 8px; }
        .sub-page .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; font-size: 13px; }
        .sub-page .facts strong { font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 600; }
        .builder-card, .amenity-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 10px; padding: 16px 18px; margin: 10px 0; }
        .price-tier { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 18px 22px; margin: 10px 0; }
        .price-tier h4 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin: 0 0 8px; }
        .cover-page { text-align: center; padding: 64px 24px 48px; }
        .cover-page h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 56px; line-height: 1.0; margin: 0 0 18px; letter-spacing: -0.015em; }
        .cover-page .stamp { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-top: 24px; }
        .footer-bar { background: var(--tw-navy); color: white; padding: 24px 32px; margin-top: 32px; border-radius: 8px; }
        .footer-bar a { color: white; text-decoration: underline; }
        a { color: #102742; }
        @media print {
          body { background: white; }
          .guide-shell { max-width: none; padding: 0; }
          .guide-section { page-break-before: always; padding: 24px 0; }
          .guide-section:first-of-type { page-break-before: avoid; }
          .sub-page { page-break-inside: avoid; }
          .cover-page { page-break-after: always; }
          .footer-bar { background: white; color: black; border: 1px solid #ccc; }
          .footer-bar a { color: black; }
        }
      `}</style>

      <div className="guide-shell">
        {/* ────────────── COVER ────────────── */}
        <section className="guide-section cover-page">
          <div className="guide-eyebrow">{config.label}</div>
          <h1>The {config.name} buyer&rsquo;s guide</h1>
          <p className="guide-prose" style={{ maxWidth: 480, margin: '0 auto', fontSize: 17 }}>
            Real numbers, real diligence, real photo references. Authored by a Bend, Oregon principal
            broker who closes inside Tetherow.
          </p>
          <div className="stamp">Current as of {monthYear}</div>
          {!isPrint && (
            <div style={{ marginTop: 32 }}>
              <Link
                href="/lp/tetherow/"
                className="text-sm underline"
                style={{ color: 'rgba(16,39,66,0.62)' }}
              >
                ← Back to the Tetherow community page
              </Link>
            </div>
          )}
        </section>

        {/* ────────────── LETTER FROM THE BROKER ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">A note from your broker</div>
          <h2 className="guide-h2">If you&rsquo;re even thinking about Tetherow, read this first.</h2>
          <p className="guide-prose">
            Hi. I&rsquo;m Matt Ryan, owner and principal broker at Ryan Realty. We&rsquo;re a small Bend,
            Oregon brokerage. We sell homes here. We don&rsquo;t do referral fees, we don&rsquo;t do high
            pressure, and we don&rsquo;t edit the market into a story.
          </p>
          <p className="guide-prose">
            This guide is what we&rsquo;d hand to a friend who asked about Tetherow. It covers the parts
            that take five conversations to get from a typical sales agent: how the HOA tiers actually
            work, what each sub-neighborhood is like to live in, the membership question that catches
            most buyers off guard, what each price range buys at Tetherow today, and what the recent
            close history reads like.
          </p>
          <p className="guide-prose">
            Every figure inside was current the day the guide was generated. The web version of the same
            guide updates every six hours. If you have a question that the page doesn&rsquo;t answer, reply
            to the email this came in on or call 541.213.6706. The number rings on my actual phone.
          </p>
          <p className="guide-prose" style={{ marginTop: 18 }}>
            <strong>Matt Ryan</strong>
            <br />
            Owner &amp; Principal Broker · Ryan Realty LLC
            <br />
            Oregon Principal Broker · License #201206613
          </p>
        </section>

        {/* ────────────── WHAT IS TETHEROW ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">Overview</div>
          <h2 className="guide-h2">What is Tetherow?</h2>
          <p className="guide-prose">
            Tetherow is a {config.acres}-acre master-planned resort community on the west side of {config.city},
            Oregon. It opened in {config.founded} anchored by a {config.architect}-designed Scottish-links
            golf course. {config.sub_neighborhoods.length} sub-neighborhoods sit inside the master plan,
            ranging from townhomes in the $750K-$1.5M tier to custom homes in Tartan Druim at $3M-$4M+.
          </p>
          <p className="guide-prose">
            Tetherow Resort runs the on-property Lodges hotel, a 12,000-square-foot clubhouse renovated in
            2024, three restaurants (Solomon&rsquo;s, The Row, Tetherow Café), a spa, the Tetherow Sport
            fitness center, pickleball and tennis courts, and groomed Nordic loops in winter. Shevlin
            Park&rsquo;s 660-acre trail network sits five minutes across the road.
          </p>

          {kpis && (
            <>
              <div className="guide-eyebrow" style={{ marginTop: 18 }}>
                Tetherow market right now
              </div>
              <div className="guide-kpi-grid">
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Sold past 12mo</div>
                  <div className="guide-kpi-value">{kpis.sold_count ?? '—'}</div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Median close</div>
                  <div className="guide-kpi-value">{fmtUsd(kpis.median_sale_price, { compact: true })}</div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Median DOM</div>
                  <div className="guide-kpi-value">{kpis.median_dom ?? '—'}</div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Sale-to-list</div>
                  <div className="guide-kpi-value">{fmtPct(kpis.avg_sale_to_list_ratio)}</div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Median $/sqft</div>
                  <div className="guide-kpi-value">{fmtUsd(kpis.median_ppsf, { compact: true })}</div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Active today</div>
                  <div className="guide-kpi-value">{activeAgg.count}</div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Active range</div>
                  <div className="guide-kpi-value" style={{ fontSize: 18 }}>
                    {fmtUsd(activeAgg.minPrice, { compact: true })} – {fmtUsd(activeAgg.maxPrice, { compact: true })}
                  </div>
                </div>
                <div className="guide-kpi">
                  <div className="guide-kpi-label">Median list</div>
                  <div className="guide-kpi-value">{fmtUsd(activeAgg.medianPrice, { compact: true })}</div>
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.55)', marginTop: -8 }}>
                Source: Oregon RMLS feed via market_stats_cache rolling-365d, methodology{' '}
                {kpis.methodology_version ?? 'v3-2026-05-07'}. Updated {fmtDate(kpis.computed_at)}.
              </p>
            </>
          )}
        </section>

        {/* ────────────── LOCATION + DRIVE TIMES ────────────── */}
        {config.drive_times && config.drive_times.length > 0 && (
          <section className="guide-section">
            <div className="guide-eyebrow">Location</div>
            <h2 className="guide-h2">Seven minutes from the Old Mill.</h2>
            <p className="guide-prose">
              Tetherow sits on Skyline Ranch Road in west Bend. Closer to downtown than Pronghorn or
              Brasada, closer to Mt. Bachelor than Broken Top. Here&rsquo;s how the drive times stack
              against the rest of your Tetherow day.
            </p>
            <table className="guide-table">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Drive</th>
                  <th>Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {config.drive_times.map((d) => (
                  <tr key={d.destination}>
                    <td><strong>{d.destination}</strong></td>
                    <td className="num">{d.minutes} min</td>
                    <td>{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ────────────── HOA REALITY ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">HOA reality</div>
          <h2 className="guide-h2">Master + sub-neighborhood. Every owner pays two layers.</h2>
          <p className="guide-prose">
            Every Tetherow lot owes a master assessment to the Tetherow Owners Association (TOA), then a
            second sub-neighborhood assessment depending on where the home sits. The master is{' '}
            <strong>{fmtUsd(config.hoa_master_quarterly ?? 366)} per quarter</strong> (about{' '}
            <strong>{fmtUsd(config.hoa_master_annual ?? 1464)} per year</strong>) and the sub-assessment
            ranges from about $2,004/yr in Crescent / North Forty to over $8,244/yr in Triple Knot.
          </p>
          <p className="guide-prose">
            Some sub-plats are managed by TOA directly. Others by Mile High Management, Terra Firma
            Management, or Resort Resources. The manager of your sub-plat decides the speed of approvals
            (architectural review, exterior changes, even paint color) — worth knowing before you make an
            offer.
          </p>

          <table className="guide-table">
            <thead>
              <tr>
                <th>Sub-neighborhood</th>
                <th>Sub-assessment</th>
                <th>Frequency</th>
                <th className="num">Annual (master + sub)</th>
                <th>Manager</th>
              </tr>
            </thead>
            <tbody>
              {config.sub_neighborhoods.map((sn) => (
                <tr key={sn.slug}>
                  <td><strong>{sn.name}</strong></td>
                  <td className="num">{sn.hoa_sub_assessment}</td>
                  <td>{sn.hoa_frequency}</td>
                  <td className="num">{fmtUsd(sn.hoa_annual_estimate)}</td>
                  <td>{sn.hoa_manager}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="guide-h3" style={{ marginTop: 24 }}>Disclosure docs you should request</h3>
          <ul className="guide-prose" style={{ paddingLeft: 20 }}>
            <li>Resale certificate — covers reserves, special assessments, unpaid balances.</li>
            <li>Most recent reserve study and reserve fund balance.</li>
            <li>CC&amp;Rs and any architectural review committee guidelines for your sub-plat.</li>
            <li>Recent board minutes (looks at any active litigation or pending capital projects).</li>
            <li>The annual operating budget and the past two fiscal years of audited financials.</li>
            <li>Any pending special assessments or rate-change votes scheduled in the next 12 months.</li>
          </ul>
        </section>

        {/* ────────────── COURSE + SIGNATURE HOLE ────────────── */}
        {config.course_specs && (
          <section className="guide-section">
            <div className="guide-eyebrow">The course</div>
            <h2 className="guide-h2">Par {config.course_specs.par}, fescue greens, the Scottish-links experience.</h2>
            <p className="guide-prose">
              Tetherow opened in 2008 on fire-scarred land. {config.architect} borrowed from Scotland:
              firm-and-fast turf, ball roll, links bunkering, fescue blend (Chewings + Creeping Red) with
              Colonial Bentgrass on the greens. The course made its biggest competitive jump in the 2023-24
              Golf Digest 100 Greatest Public ranking — up 25 spots to #57, the largest leap on the list.
            </p>
            <div className="guide-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="guide-kpi">
                <div className="guide-kpi-label">Par</div>
                <div className="guide-kpi-value">{config.course_specs.par}</div>
              </div>
              <div className="guide-kpi">
                <div className="guide-kpi-label">Yardage</div>
                <div className="guide-kpi-value">{config.course_specs.yardage.toLocaleString()}</div>
              </div>
              <div className="guide-kpi">
                <div className="guide-kpi-label">Course rating</div>
                <div className="guide-kpi-value">{config.course_specs.rating}</div>
              </div>
              <div className="guide-kpi">
                <div className="guide-kpi-label">Slope</div>
                <div className="guide-kpi-value">{config.course_specs.slope}</div>
              </div>
            </div>

            {config.course_rankings && config.course_rankings.length > 0 && (
              <>
                <h3 className="guide-h3" style={{ marginTop: 18 }}>Recognition the brand has earned</h3>
                <ul className="guide-prose" style={{ paddingLeft: 20 }}>
                  {config.course_rankings.map((r, i) => (
                    <li key={i}>
                      <strong>{r.rank}</strong> — {r.publication}. {r.description}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {config.signature_hole && (
              <div style={{ marginTop: 18 }}>
                <h3 className="guide-h3">The signature hole — par {config.signature_hole.par} #{config.signature_hole.number}</h3>
                <p className="guide-prose">{config.signature_hole.description}</p>
                <p className="guide-prose">
                  Yardage: <strong>{config.signature_hole.yardage}</strong>. Elevation drop:{' '}
                  <strong>{config.signature_hole.elevation_drop_ft ?? '—'} ft</strong>.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ────────────── SUB-NEIGHBORHOODS (one block each) ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">Sub-neighborhoods, by character</div>
          <h2 className="guide-h2">Nine sub-plats. Each one feels different.</h2>
          <p className="guide-prose">
            What follows is the at-Tetherow flavor of each sub-neighborhood: the typical lot size, the
            dominant architectural pattern, and what it actually feels like to live there. Dues figures
            verified against the TOA registry.
          </p>
          {config.sub_neighborhoods.map((sn) => (
            <div key={sn.slug} className="sub-page">
              <div className="meta">{sn.type}</div>
              <h3>{sn.name}</h3>
              <p>{sn.description}</p>
              <div className="facts">
                <div>
                  <strong>{fmtUsd(sn.hoa_annual_estimate)}</strong>
                  <div style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.62)' }}>
                    Annual HOA (master + sub)
                  </div>
                </div>
                <div>
                  <strong>{sn.hoa_manager}</strong>
                  <div style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.62)' }}>Manager</div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ────────────── MEMBERSHIP ────────────── */}
        {config.membership_tiers && config.membership_tiers.length > 0 && (
          <section className="guide-section">
            <div className="guide-eyebrow">The Tetherow Club</div>
            <h2 className="guide-h2">The membership question — the #1 thing most buyers miss.</h2>
            <p className="guide-prose">
              Club membership at Tetherow is <strong>separate from owning a home there</strong>. You can
              own a Tetherow home without being a club member, and the club has its own initiation
              schedule, monthly dues, and waitlist. The single most important diligence item on a Tetherow
              purchase is: does the seller&rsquo;s membership transfer with the home, and if so, at what
              re-initiation discount? Ask before you write the offer.
            </p>
            {config.membership_tiers.map((m, i) => (
              <div key={i} className="builder-card">
                <div className="meta" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(16,39,66,0.62)', marginBottom: 6 }}>
                  {m.eyebrow}
                </div>
                <h3 className="guide-h3" style={{ marginBottom: 6 }}>{m.label}</h3>
                <p className="guide-prose" style={{ marginBottom: 6 }}>{m.description}</p>
                <p style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>
                  Waitlist: {m.waitlist_status}
                </p>
              </div>
            ))}
            <p className="guide-prose" style={{ fontSize: 14, marginTop: 14 }}>
              Initiation and dues change annually and are not published on the public Tetherow site. The
              Tetherow membership office (844-431-9701) confirms today&rsquo;s rate sheet, current
              waitlist position, and the specific resale-transfer terms for the home you&rsquo;re looking
              at.
            </p>
          </section>
        )}

        {/* ────────────── PRICE TIER BREAKDOWN ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">What each price tier buys</div>
          <h2 className="guide-h2">From $750K to $4M, what you actually get.</h2>
          <p className="guide-prose">
            Tetherow homes today span the high $700Ks (townhomes in The Rim and Trailhead) to the mid-$4Ms
            (custom homes in Tartan Druim and on Hosmer Lake Road). Here&rsquo;s how the tiers map.
          </p>
          <div className="price-tier">
            <h4>$750K to $1.5M</h4>
            <p className="guide-prose">
              Townhomes in The Rim, Trailhead Cairn Cottages, and select Crescent / Glen sub-plats.
              Typical 2-3 bed, 2-3 bath, 1,500-2,500 sqft. Walkable to the clubhouse from most. Lower
              maintenance, often configured for vacation-rental use. Monthly HOA tends to be higher than
              the single-family tier because more amenities are bundled in.
            </p>
          </div>
          <div className="price-tier">
            <h4>$1.5M to $2.5M</h4>
            <p className="guide-prose">
              Single-family in Crescent, Glen, Heath, Outrider Overlook. Typical 3-4 bed, 3-4 bath,
              2,400-3,400 sqft, lot sizes 0.3 to 0.6 acres. The deepest part of the Tetherow market —
              {' '}{kpis?.sold_count ?? 27} closings in the last 12 months at a median of{' '}
              {fmtUsd(kpis?.median_sale_price, { compact: true })}.
            </p>
          </div>
          <div className="price-tier">
            <h4>$2.5M to $4M</h4>
            <p className="guide-prose">
              Custom and semi-custom in Heath (golf frontage), Highlands Ridge, Hosmer Lake Road. Typical
              4-5 bed, 4-5 bath, 3,500-5,000 sqft. View premium attached to golf-frontage and Cascade
              corridor lots. The buyer at this tier almost always wants the membership transfer to come
              with the home.
            </p>
          </div>
          <div className="price-tier">
            <h4>$4M+</h4>
            <p className="guide-prose">
              Tartan Druim custom on John Muir lots, the top of Hosmer Lake Road, occasional Heath
              architect-built. 5,000+ sqft, true custom construction. Thin liquidity here — typically 3-6
              sales per year. Buyers at this tier usually pre-engage their builder + architect before they
              even shop, because the lot drives the design more than the floor plan.
            </p>
          </div>
        </section>

        {/* ────────────── RECENT CLOSINGS ────────────── */}
        {closings.length > 0 && (
          <section className="guide-section">
            <div className="guide-eyebrow">Recent closings</div>
            <h2 className="guide-h2">What actually traded — last 90 days at Tetherow.</h2>
            <p className="guide-prose">
              Verified Oregon RMLS close-of-record. $/sqft and sale-to-list ratio computed against close
              price and original list. Sub-plat = the SubdivisionName field on the MLS row.
            </p>
            <table className="guide-table">
              <thead>
                <tr>
                  <th>Closed</th>
                  <th>Beds / baths</th>
                  <th className="num">Sqft</th>
                  <th className="num">Close</th>
                  <th className="num">$/sqft</th>
                  <th className="num">Sale-to-list</th>
                </tr>
              </thead>
              <tbody>
                {closings.map((c, i) => (
                  <tr key={i}>
                    <td>{fmtDate(c.CloseDate)}</td>
                    <td>{c.BedroomsTotal ?? '—'} / {c.BathroomsTotal ?? '—'}</td>
                    <td className="num">{c.TotalLivingAreaSqFt?.toLocaleString() ?? '—'}</td>
                    <td className="num">{fmtUsd(c.ClosePrice)}</td>
                    <td className="num">{pricePerSqft(c.ClosePrice, c.TotalLivingAreaSqFt)}</td>
                    <td className="num">{saleToList(c.ClosePrice, c.ListPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ────────────── SCHOOLS ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">Schools</div>
          <h2 className="guide-h2">Bend-La Pine assignment, with the caveat.</h2>
          <p className="guide-prose">
            Tetherow sits inside the Bend-La Pine Schools district. Typical assignment for Tetherow
            addresses: Elk Meadow Elementary, Cascade Middle, Summit High. The district allows out-of-
            boundary transfer applications, and Tetherow buyers occasionally land at High Lakes Elementary
            or Pacific Crest Middle on transfer.
          </p>
          <p className="guide-prose">
            Verify the exact assignment at <a href="https://www.bend.k12.or.us/families/school-locator">bend.k12.or.us</a>{' '}
            using the property&rsquo;s street address. Assignments occasionally shift on annual boundary
            review. GreatSchools ratings are noisy at the Bend-La Pine scale — we read the principal
            tenure, the parent-teacher ratio, and the program offerings (immersion, IB, robotics) more
            than the headline score.
          </p>
        </section>

        {/* ────────────── BUILDER ROSTER ────────────── */}
        {config.builders && config.builders.length > 0 && (
          <section className="guide-section">
            <div className="guide-eyebrow">Who builds at Tetherow</div>
            <h2 className="guide-h2">The builder names buyers ask about.</h2>
            <p className="guide-prose">
              At $1.8M-$4M, buyers buy a builder as much as a home. They know who builds tight, who
              manages a difficult subcontractor schedule, and whose 2018 work is showing its age. Here&rsquo;s
              the active roster inside Tetherow.
            </p>
            {config.builders.map((b, i) => (
              <div key={i} className="builder-card">
                <div className="meta" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(16,39,66,0.62)', marginBottom: 4 }}>
                  {b.role}
                </div>
                <h3 className="guide-h3" style={{ marginBottom: 4 }}>{b.name}</h3>
                <p className="guide-prose" style={{ marginBottom: 4 }}>{b.description}</p>
                {b.website && (
                  <p style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>
                    <a href={b.website} target="_blank" rel="noopener noreferrer">
                      {b.website.replace(/^https?:\/\//, '')}
                    </a>
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ────────────── FINANCING REALITY ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">The financing reality</div>
          <h2 className="guide-h2">Jumbo loan thresholds, typical down payment, the local LO referrals.</h2>
          <p className="guide-prose">
            The 2026 Fannie Mae conforming loan limit in Deschutes County is well under the typical
            Tetherow purchase. Practically every Tetherow buyer is in jumbo territory. Local lenders that
            actually understand the Tetherow appraisal nuances (the golf-frontage view premium, the HOA
            disclosure pack, the membership-transfer line item): Pacific Residential Mortgage, MidWestOne
            Bank Bend, US Bank Private Wealth (Bend office), and First Interstate Private Banking.
          </p>
          <p className="guide-prose">
            Typical Tetherow purchase: 25-40% down. Many cash, especially in the $3M+ tier. Appraisals
            here are slower than Bend-citywide because the comp pool is small; expect 3-4 weeks of
            appraisal on a $2M+ home. The lender you pick matters; we&rsquo;ll send you the names we&rsquo;ve
            closed with most when you&rsquo;re ready.
          </p>
        </section>

        {/* ────────────── WHAT HAPPENS NEXT ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">What happens next</div>
          <h2 className="guide-h2">If you decide Tetherow is the right call.</h2>
          <p className="guide-prose">
            Here&rsquo;s how the next 30 days look when a Tetherow buyer engages with us.
          </p>
          <ol className="guide-prose" style={{ paddingLeft: 24 }}>
            <li><strong>Week 1.</strong> A 30-minute call to figure out price tier, sub-neighborhood preference, membership posture, and timeline.</li>
            <li><strong>Week 2.</strong> A custom Tetherow alert is set up so you see every new active and price-changed listing the day it hits. We tour 2-4 candidate homes the same week.</li>
            <li><strong>Week 3.</strong> A short-list of 1-2 homes. We pull the HOA disclosure pack and the seller&rsquo;s membership transfer letter on each.</li>
            <li><strong>Week 4.</strong> Offer prep with comp set, inspection contingency wording, the membership-transfer addendum, and the financing letter.</li>
          </ol>
          {!isPrint && (
            <p className="guide-prose">
              When you&rsquo;re ready, <Link href="/lp/tetherow/#buyer">schedule a tour</Link> or{' '}
              <Link href="/lp/tetherow/#cma">request a home-value report</Link>. Or just reply to the email
              this came in on.
            </p>
          )}
        </section>

        {/* ────────────── METHODOLOGY ────────────── */}
        <section className="guide-section">
          <div className="guide-eyebrow">Methodology + disclaimers</div>
          <h2 className="guide-h2">Where every figure came from.</h2>
          <ul className="guide-prose" style={{ paddingLeft: 20, fontSize: 13.5 }}>
            <li><strong>Market KPIs and recent closings.</strong> Oregon RMLS feed via{' '}
              <code>market_stats_cache</code> rolling-365-day window. Methodology {kpis?.methodology_version ?? 'v3-2026-05-07'}. Updated {fmtDate(kpis?.computed_at ?? null)}.</li>
            <li><strong>Active inventory.</strong> Live query against the <code>listings</code> table at render
              time. Filter: SubdivisionName=&apos;Tetherow&apos;, StandardStatus=&apos;Active&apos;,
              PropertyType=&apos;A&apos; (Single-family residential).</li>
            <li><strong>HOA dues + management.</strong> Tetherow Owners Association (tetherowowners.com),
              verified May 2026. Master assessment {fmtUsd(config.hoa_master_annual ?? 1464)}/year.</li>
            <li><strong>Course design, specs, rankings.</strong> Tetherow Resort, the Tetherow blog,
              GreensKeeper.org, Wikipedia on David McLay Kidd.</li>
            <li><strong>School assignment.</strong> Bend-La Pine Schools district. Verify per address at{' '}
              bend.k12.or.us.</li>
            <li><strong>Membership figures.</strong> Triangulated from public reporting and member
              disclosures. Exact 2026 initiation and dues are not publicly disclosed; the Tetherow
              membership office (844-431-9701) is authoritative.</li>
          </ul>
          <p style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.55)', marginTop: 14 }}>
            Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity. Listing data
            courtesy of Oregon Datashare RMLS. Tetherow Resort and Golf Club is a registered trademark of
            its respective owner. This guide is independent brokerage analysis, not a Tetherow Resort,
            Tetherow Owners Association, or Troon publication. No affiliation implied.
          </p>
        </section>

        <div className="footer-bar">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <strong style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>
                Ryan Realty
              </strong>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                {config.city}, {config.state} · Principal Broker #201206613
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              541.213.6706
              <br />
              <a href="mailto:matt@ryan-realty.com">matt@ryan-realty.com</a>
              <br />
              <a href={`${siteUrl}/lp/tetherow/`}>ryan-realty.com/lp/tetherow</a>
            </div>
          </div>
        </div>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'DigitalDocument',
            name: "Tetherow Buyer's Guide",
            about: 'Tetherow Resort, Bend, Oregon',
            inLanguage: 'en-US',
            datePublished: new Date().toISOString(),
            publisher: {
              '@type': 'RealEstateAgent',
              name: 'Ryan Realty',
              url: siteUrl,
              telephone: '+1-541-213-6706',
              email: 'matt@ryan-realty.com',
            },
            about_type: 'Place',
            description:
              "The Tetherow buyer's guide: HOA tiers, club membership reality, sub-neighborhood profiles, builder roster, recent close history.",
          }),
        }}
      />
    </main>
  )
}
