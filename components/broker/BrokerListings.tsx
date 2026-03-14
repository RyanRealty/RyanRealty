import type { HomeTileRow } from '@/app/actions/listings'
import type { AgentDetail } from '@/app/actions/agents'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type Props = {
  broker: AgentDetail
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys: string[]
  signedIn: boolean
  userEmail: string | null
  displayPrefs: { downPaymentPercent: number; interestRate: number; loanTermYears: number }
}

export default function BrokerListings({
  broker,
  listings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  displayPrefs,
}: Props) {
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name
  const { downPaymentPercent, interestRate, loanTermYears } = displayPrefs

  if (listings.length === 0) {
    return (
      <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-listings-heading">
        <div className="mx-auto max-w-7xl">
          <h2 id="broker-listings-heading" className="text-2xl font-bold tracking-tight text-primary">
            {firstName}&apos;s Active Listings
          </h2>
          <p className="mt-6 text-muted-foreground">
            No active listings right now. Contact {firstName} to learn about upcoming opportunities.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-listings-heading">
      <div className="mx-auto max-w-7xl">
        <TilesSlider
          title={`${firstName}'s Active Listings`}
          subtitle={`${listings.length} listings`}
          titleId="broker-listings-heading"
        >
          {listings.map((listing) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            const monthly = estimatedMonthlyPayment(
              listing.ListPrice ?? 0,
              downPaymentPercent,
              interestRate,
              loanTermYears
            )
            return (
              <TilesSliderItem key={String(key)} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                <HomeTileCard
                  listing={listing}
                  listingKey={String(key)}
                  monthlyPayment={formatMonthlyPayment(monthly)}
                  saved={signedIn && savedKeys.includes(String(key))}
                  liked={signedIn && likedKeys.includes(String(key))}
                  signedIn={signedIn}
                  userEmail={userEmail}
                />
              </TilesSliderItem>
            )
          })}
        </TilesSlider>
      </div>
    </section>
  )
}
