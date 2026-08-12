// @no-parity. Dev-only P6 visual prototype. Parity contracts bind production routes to
// their mockups; this page IS the design artifact the visual lock is judged on, and it is
// noindex, unlinked, and never shipped as a public destination.
/**
 * P6 VISUAL PROTOTYPE, SELL NODE.
 *
 * Visitor objective: decide whether and how to sell, and get the real number. The Stage
 * answers it in the first viewport and the Sheet under it starts the two-step spine.
 *
 * Patterns, in the locked Sell order: Stage -> Sheet -> Instrument -> Sheet -> Quiet.
 * Four of the six, no two adjacent alike.
 */
import type { Metadata } from 'next'
import { getMarketPulse } from '@/lib/data'
import { PublicV3Sell } from './PublicV3Sell.client'

export const metadata: Metadata = {
  title: 'Public v3 prototype: sell',
  robots: { index: false, follow: false },
}

export const revalidate = 300

export default async function PublicV3SellPage() {
  // No catch-and-swallow here: a failed read must surface as a failure, never as a
  // confident empty state (CLAUDE.md section 0 + the swallowed-errors-lie rule). A
  // genuine miss returns null and the Instrument says so on the page.
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' })

  return (
    <PublicV3Sell
      place="Bend"
      pulse={
        pulse
          ? {
              activeCount: pulse.activeCount,
              medianListPrice: pulse.medianListPrice,
              monthsOfSupply: pulse.monthsOfSupply,
              medianDaysToPending: pulse.medianDaysToPending,
              closedLast30Days: pulse.closedLast30Days,
              refreshedAt: pulse.refreshedAt,
            }
          : null
      }
    />
  )
}
