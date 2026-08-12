// @no-parity — dev-only proof surface for the v3 barrel. Noindex, unlinked.
/**
 * THE BARREL PROOF (P7 definition of done).
 *
 * The same Market node as /dev/public-v3, rebuilt with ZERO bespoke markup: every
 * section is a primitive from components/site/v3. If a fix lands in the barrel it lands
 * here, which is the property the four hand-built prototype nodes did not have (four
 * CountUps, three Field behaviors, two type scales).
 *
 * Pattern order: Instrument -> Field -> Sheet -> Quiet. Four of six, no two adjacent
 * alike, one primary action per viewport.
 */
import type { Metadata } from 'next'
import { getMarketPulse, getListingTiles } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { V3_ROOT_CLASS, v3Text, V3Instrument, V3Field, V3Quiet } from '@/components/site/v3'
import { BarrelSheet } from './BarrelSheet.client'

export const metadata: Metadata = {
  title: 'Public v3 barrel proof',
  robots: { index: false, follow: false },
}

export const revalidate = 300

const PLACE = 'Bend'

export default async function BarrelProofPage() {
  // No catch-and-swallow: a failed read must surface as a failure, never as a confident
  // empty state (CLAUDE.md section 0).
  const [pulse, tiles] = await Promise.all([
    getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
    getListingTiles({ city: PLACE, status: 'active', limit: 12 }),
  ])

  // The verdict is derived from the ROUNDED figure the visitor sees, never the raw one:
  // 4.04 rendered as "4.0" beside "balanced market" is the exact section 0 failure this
  // program shipped once already. Thresholds: <=4 seller's, 4-6 balanced, >=6 buyer's.
  const mos = pulse?.monthsOfSupply == null ? null : Math.round(pulse.monthsOfSupply * 10) / 10
  const verdict = mos == null ? null : mos <= 4 ? 'a seller’s market' : mos < 6 ? 'a balanced market' : 'a buyer’s market'

  const figures = [
    pulse?.medianListPrice != null
      ? { value: v3Text(formatPrice(pulse.medianListPrice)), label: v3Text('median list price') }
      : null,
    pulse?.activeCount != null
      ? {
          value: v3Text(pulse.activeCount.toLocaleString('en-US')),
          label: v3Text('homes for sale'),
          href: '/homes-for-sale/bend',
        }
      : null,
    mos != null ? { value: v3Text(mos.toFixed(1)), label: v3Text('months of supply') } : null,
    pulse?.medianDaysToPending != null
      ? { value: v3Text(String(pulse.medianDaysToPending)), label: v3Text('median days to pending') }
      : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null)

  return (
    <main className={V3_ROOT_CLASS}>
      {figures.length > 0 && (
        <V3Instrument
          eyebrow={v3Text(PLACE)}
          headline={v3Text(verdict ? `${PLACE} is ${verdict}` : `${PLACE} market`)}
          figures={figures as [(typeof figures)[number], ...typeof figures]}
          source={v3Text(`live MLS, ${PLACE} single-family, refreshed with each sync`)}
          updated={pulse?.refreshedAt ? v3Text(formatDate(pulse.refreshedAt)) : undefined}
          level={1}
        />
      )}

      <V3Field
        ariaLabel={`Homes for sale in ${PLACE}`}
        items={tiles.map((t) => ({
          id: t.listingKey,
          href: `/listing/${t.listingKey}`,
          priceLabel: formatPrice(t.listPrice),
          title: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ') || 'Address withheld',
          meta:
            [t.beds && `${t.beds} bd`, t.baths && `${t.baths} ba`, t.sqft && `${t.sqft.toLocaleString('en-US')} sqft`]
              .filter(Boolean)
              .join(' · ') || undefined,
          lat: t.lat,
          lng: t.lng,
        }))}
        count={{
          value: tiles.length.toLocaleString('en-US'),
          label: 'homes shown',
          source: `live MLS, ${PLACE} active single-family, newest first`,
        }}
      />

      <BarrelSheet />

      <V3Quiet
        heading="Keep exploring"
        items={[
          { label: `${PLACE} neighborhoods`, href: '/cities/bend' },
          { label: 'Market reports', href: '/housing-market' },
          { label: 'How selling works', href: '/sell' },
          { label: 'Open houses this week', href: '/open-houses' },
        ]}
      />
    </main>
  )
}
