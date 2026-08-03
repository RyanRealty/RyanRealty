// @no-parity — new definitional/reference route (audit item 18), no
// design_system/ryan-realty/ui_kits mockup exists for it yet. Built directly
// from the locked design-system primitives (components/site/primitives) and
// existing site components (PageBreadcrumb, MetadataBlock, FAQBlock,
// SiteFooter) rather than a bespoke mockup. See the task report for a
// recommendation to add a ui_kits/months-of-supply mockup + parity.json in a
// follow-up pass (design_system/** is outside this change's file-ownership
// scope).
/**
 * /months-of-supply — the canonical, citable definition of "months of supply"
 * for Central Oregon real estate. Audit item 18: own the term with the
 * formula printed next to the number, at a stable URL an AI assistant or a
 * human can link back to.
 *
 * PAGE CONTRACT: pageMetadata (canonical + OG) + MetadataBlock JSON-LD
 * (Article + a hand-written DefinedTerm block, see below) + PageBreadcrumb
 * (BreadcrumbList) + FAQBlock (FAQPage). One H1. Every live figure sourced
 * through @/lib/data (G8), no raw .from() calls.
 *
 * §0 data accuracy:
 *   - The formula text and thresholds are NEVER retyped — they are imported
 *     verbatim from lib/market/classify.ts (MOS_METHODOLOGY_CLAUSE /
 *     MOS_THRESHOLD_CLAUSE), the single source CLAUDE.md §0 designates.
 *   - The Central Oregon figure is getRegionPulse() (market_pulse_live,
 *     geo_type='region', geo_slug='central-oregon', property_type='A').
 *   - The Bend figure is getMarketPulseCitySnapshots(['Bend']) (same table,
 *     geo_type='city', geo_label='Bend', property_type='A').
 *   - Both verdicts are computed by marketVerdict() from lib/market/classify.ts
 *     applied to the raw (unrounded) months_of_supply value, never hand-coded
 *     thresholds and never classified off the rounded display string.
 *   - The refresh timestamp shown for each geography is the real
 *     market_pulse_live.updated_at column, never now() or a hardcoded date.
 *   - A geography whose row is missing renders no card for that geography
 *     rather than a fabricated or stale number (§0: "if it can't be
 *     verified, it doesn't ship").
 *   - The "math behind today's number" section algebraically inverts the
 *     formula on the two live inputs already shown (active count and
 *     months of supply) to surface the implied average monthly closing
 *     pace, an exact identity of the live numbers on the page, not an
 *     estimate or a separately-sourced figure.
 *
 * JSON-LD: PageBreadcrumb emits BreadcrumbList itself (default
 * includeJsonLd=true), so MetadataBlock below carries only Article (headline,
 * dateModified = the live Central Oregon refresh timestamp). A DefinedTerm
 * block is added as a second, hand-written <script type="application/ld+json">
 * because lib/site/json-ld.ts's SchemaInput union does not have a
 * 'definedTerm' case yet and that file sits outside this page's
 * file-ownership scope, so the DefinedTerm node is emitted directly here
 * rather than by editing the shared builder.
 */

import type { Metadata } from 'next'
import { getRegionPulse, getMarketPulseCitySnapshots } from '@/lib/data'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE, marketVerdict, type MarketKind } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import {
  Body,
  Caption,
  Container,
  DisplayHeading,
  Eyebrow,
  H1,
  H2,
  Section,
  Stack,
  TabularNumber,
  TextLink,
  BadgePill,
} from '@/components/site/primitives'
import SiteFooter from '@/components/site/SiteFooter'

export const revalidate = 300

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = pageMetadata({
  title: 'Months of supply, defined',
  description:
    'What months of supply means in real estate, the exact formula, and the current live figure for Central Oregon and Bend. ' +
    'Active listings divided by average monthly closings over the trailing six months.',
  path: '/months-of-supply',
  keywords: [
    'months of supply',
    'months of supply real estate',
    'months of supply definition',
    'seller’s market vs buyer’s market',
    'Central Oregon housing market',
    'Bend real estate market',
    'Ryan Realty',
  ],
})

// ---------------------------------------------------------------------------
// Verdict badge tone
// ---------------------------------------------------------------------------

const VERDICT_TONE: Record<MarketKind, 'success' | 'neutral' | 'warning'> = {
  sellers: 'success',
  balanced: 'neutral',
  buyers: 'warning',
  unknown: 'neutral',
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

function formatRefreshedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${datePart}, ${timePart} PT`
}

// ---------------------------------------------------------------------------
// Live figure card data shape, one geography, fully traced.
// ---------------------------------------------------------------------------

type GeoFigure = {
  label: string
  href: string
  activeCount: number
  monthsOfSupply: number | null
  refreshedAtIso: string | null
  refreshedAtLabel: string | null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MonthsOfSupplyPage() {
  // §0 trace:
  //   regionPulse — market_pulse_live, geo_type='region', geo_slug='central-oregon',
  //                 property_type='A'. Source: getRegionPulse (lib/data/market/getRegionPulse.ts).
  //   bendSnapshots — market_pulse_live, geo_type='city', geo_label='Bend',
  //                   property_type='A'. Source: getMarketPulseCitySnapshots.
  const [regionPulse, bendSnapshots] = await Promise.all([
    getRegionPulse().catch(() => null),
    getMarketPulseCitySnapshots(['Bend']).catch(() => []),
  ])
  const bend = bendSnapshots.find((s) => s.geo_label === 'Bend') ?? null

  const figures: GeoFigure[] = []
  if (regionPulse) {
    figures.push({
      label: 'Central Oregon',
      href: '/housing-market/central-oregon',
      activeCount: regionPulse.activeCount,
      monthsOfSupply: regionPulse.monthsOfSupply,
      refreshedAtIso: regionPulse.updatedAt || null,
      refreshedAtLabel: formatRefreshedAt(regionPulse.updatedAt || null),
    })
  }
  if (bend) {
    figures.push({
      label: 'Bend',
      href: '/housing-market/bend',
      activeCount: bend.active_count,
      monthsOfSupply: bend.months_of_supply,
      refreshedAtIso: bend.updated_at,
      refreshedAtLabel: formatRefreshedAt(bend.updated_at),
    })
  }

  // Worked example (§0 "cross-check math, show the computation"), built from
  // the Central Oregon figure only if both live inputs are present. This is an
  // exact algebraic inversion of the canonical formula on the two numbers
  // already shown above, not a separately-sourced or estimated figure.
  const co = figures.find((f) => f.label === 'Central Oregon') ?? null
  const worked =
    co && co.monthsOfSupply != null && co.monthsOfSupply > 0
      ? {
          active: co.activeCount,
          mos: co.monthsOfSupply,
          avgMonthlyClosings: Math.round((co.activeCount / co.monthsOfSupply) * 10) / 10,
          impliedSixMonthTotal: Math.round((co.activeCount / co.monthsOfSupply) * 6),
        }
      : null

  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}/months-of-supply`
  const definitionText = `${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`

  const definedTermJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: 'Months of supply',
    alternateName: 'MoS',
    description: definitionText,
    url: pageUrl,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Ryan Realty real estate glossary',
      url: `${site}/months-of-supply`,
    },
  }

  return (
    <>
      <PageBreadcrumb
        trail={[
          { label: 'Housing market', href: '/housing-market' },
          { label: 'Months of supply' },
        ]}
      />

      {/* Article JSON-LD — headline + live dateModified. BreadcrumbList comes
          from PageBreadcrumb above; FAQPage comes from FAQBlock below. */}
      <MetadataBlock
        schema={{
          type: 'article',
          headline: 'Months of supply, defined',
          description: definitionText,
          url: '/months-of-supply',
          dateModified: co?.refreshedAtIso ?? undefined,
        }}
      />
      {/* DefinedTerm — hand-written, see file header for why this bypasses
          the shared MetadataBlock/json-ld.ts builder. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }}
      />

      <main>
        <Section padding="loose">
          <Container>
            <Stack gap="loose" className="max-w-[70ch]">
              <Eyebrow>Real estate glossary</Eyebrow>
              <H1>Months of supply</H1>
              <Body size="large" tone="primary">
                Months of supply is how many months it would take to sell every home
                currently on the market at the pace homes have actually been closing.
                A low number means listings are getting absorbed fast. A high number
                means inventory is piling up faster than buyers are closing on it.
              </Body>
              <Body>
                It is the single most direct read on whether a market favors the
                seller or the buyer, because it compares supply (what is for sale
                right now) against demand (what is actually closing), not against
                asking prices or how a market feels.
              </Body>
            </Stack>
          </Container>
        </Section>

        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="loose" className="max-w-[70ch]">
              <H2>The formula</H2>
              {/* Non-shadcn card shell (§3, ci:shadcn-burndown): rounded-[14px] is
                  the allowlisted arbitrary-radius token (D22), same idiom already
                  used by components/site/MarketSnapshot.tsx and
                  components/site/MarketDetailStats.tsx for stat cards outside the
                  KB (kinetic-brutalist) shell. This page is not wrapped in
                  .kb-root (see the file header), so kb.css's .mkt-kpi classes do
                  not apply here without adding that wrapper, which is out of
                  scope for this fix. */}
              <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
                <Caption tone="primary" className="font-semibold uppercase tracking-[0.08em]">
                  Formula
                </Caption>
                <Body size="large" tone="primary" className="mt-2 font-semibold">
                  {MOS_METHODOLOGY_CLAUSE}
                </Body>
              </div>
              <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
                <Caption tone="primary" className="font-semibold uppercase tracking-[0.08em]">
                  Thresholds
                </Caption>
                <Body size="large" tone="primary" className="mt-2 font-semibold">
                  {MOS_THRESHOLD_CLAUSE}
                </Body>
              </div>
              <Body size="small">
                This is the same formula and the same thresholds behind every
                market-pace figure on ryan-realty.com. It never changes by page.
              </Body>
            </Stack>
          </Container>
        </Section>

        {figures.length > 0 ? (
          <Section padding="default" divider>
            <Container>
              <Stack gap="loose">
                <Stack gap="tight" className="max-w-[70ch]">
                  <H2>Right now</H2>
                  <Body>
                    Pulled live from the same feed every market report on this site
                    reads from. Refreshed every 10 to 15 minutes from Oregon Data Share.
                  </Body>
                </Stack>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {figures.map((f) => {
                    const verdict = marketVerdict(f.monthsOfSupply)
                    return (
                      <div
                        key={f.label}
                        className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Caption tone="primary" className="font-semibold uppercase tracking-[0.08em]">
                            {f.label}
                          </Caption>
                          {verdict.kind !== 'unknown' ? (
                            <BadgePill tone={VERDICT_TONE[verdict.kind]}>
                              {capitalize(verdict.label)}
                            </BadgePill>
                          ) : null}
                        </div>
                        <div className="flex items-end gap-2">
                          <DisplayHeading as="span" className="text-4xl leading-none sm:text-5xl">
                            {f.monthsOfSupply != null ? formatMonthsOfSupply(f.monthsOfSupply) : '—'}
                          </DisplayHeading>
                          <span className="pb-1 text-sm text-muted-foreground">months of supply</span>
                        </div>
                        <Body size="small">
                          <TabularNumber value={f.activeCount} /> active single-family listings
                        </Body>
                        {f.refreshedAtLabel ? (
                          <Caption>Refreshed {f.refreshedAtLabel} · market_pulse_live, Oregon Data Share</Caption>
                        ) : null}
                        <TextLink href={f.href}>See the full {f.label} market report</TextLink>
                      </div>
                    )
                  })}
                </div>
              </Stack>
            </Container>
          </Section>
        ) : null}

        {worked ? (
          <Section padding="default" tone="muted" divider>
            <Container>
              <Stack gap="default" className="max-w-[70ch]">
                <H2>The math behind today’s number</H2>
                <Body>
                  Rearranging the formula on the two live figures above shows the
                  pace it implies. Central Oregon has{' '}
                  <TabularNumber value={worked.active} /> active single-family listings
                  and {formatMonthsOfSupply(worked.mos)} months of supply right now. Dividing
                  the first by the second implies homes have been closing at roughly{' '}
                  <TabularNumber value={worked.avgMonthlyClosings} fractionDigits={1} /> a
                  month on average over the trailing six months, or about{' '}
                  <TabularNumber value={worked.impliedSixMonthTotal} /> closings across
                  the full six-month window.
                </Body>
                <Body size="small">
                  {worked.active.toLocaleString('en-US')} active ÷ ({worked.impliedSixMonthTotal.toLocaleString('en-US')} closed
                  in the trailing six months ÷ 6) = {formatMonthsOfSupply(worked.mos)} months of supply.
                </Body>
              </Stack>
            </Container>
          </Section>
        ) : null}

        <FAQBlock
          eyebrow="Common questions"
          title="Months of supply, explained further"
          intro="Direct answers, no hedging."
          tone="default"
          items={[
            {
              question: 'Why six months of closings, not three or twelve?',
              answer:
                'Six months smooths out normal week-to-week and month-to-month swings in closing pace without going stale. A shorter window reacts to noise. A window over a year reacts too slowly to an actual shift in the market.',
            },
            {
              question: 'What exactly is a seller’s market versus a buyer’s market?',
              answer: MOS_THRESHOLD_CLAUSE + ' At the low end, listings are getting absorbed faster than new inventory can replace them, and sellers hold more leverage on price and terms. At the high end, buyers have more homes to choose from and more room to negotiate.',
            },
            {
              question: 'Does a rising months of supply mean prices are falling?',
              answer:
                'Not automatically. Months of supply measures pace, not price. It is a leading indicator. A market that stays above six months for a sustained stretch tends to see price growth slow or reverse, but the two numbers can diverge for months before price catches up.',
            },
            {
              question: 'Where does the number on this page come from?',
              answer:
                'The live figures above are pulled directly from Ryan Realty’s Central Oregon MLS data feed (Oregon Data Share) at render time, refreshed every 10 to 15 minutes. Nothing on this page is estimated or held over from an earlier report.',
            },
          ]}
        />

        <Section padding="default" divider>
          <Container>
            <Stack gap="tight" className="max-w-[70ch]">
              <H2>See the full market report</H2>
              <Body>
                Months of supply is one figure inside a fuller picture: active
                inventory, median list price, days to pending, and price trend
                by city.
              </Body>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <TextLink href="/housing-market/central-oregon">Central Oregon market report</TextLink>
                <TextLink href="/housing-market/bend">Bend market report</TextLink>
                <TextLink href="/housing-market">All cities and towns</TextLink>
              </div>
            </Stack>
          </Container>
        </Section>
      </main>

      <SiteFooter />
    </>
  )
}
