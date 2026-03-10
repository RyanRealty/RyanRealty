import type { HomeTileRow } from '@/app/actions/listings'
import type { AgentDetail } from '@/app/actions/agents'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'

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

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-listings-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="broker-listings-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          {firstName}&apos;s Active Listings
        </h2>
        <p className="mt-1 text-[var(--text-secondary)]">{listings.length} listings</p>
        {listings.length === 0 ? (
          <p className="mt-6 text-[var(--text-secondary)]">
            No active listings right now. Contact {firstName} to learn about upcoming opportunities.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {listings.map((listing) => {
              const key = listing.ListingKey ?? listing.ListNumber ?? ''
              const monthly = estimatedMonthlyPayment(
                listing.ListPrice ?? 0,
                downPaymentPercent,
                interestRate,
                loanTermYears
              )
              return (
                <HomeTileCard
                  key={String(key)}
                  listing={listing}
                  listingKey={String(key)}
                  monthlyPayment={formatMonthlyPayment(monthly)}
                  saved={signedIn && savedKeys.includes(String(key))}
                  liked={signedIn && likedKeys.includes(String(key))}
                  signedIn={signedIn}
                  userEmail={userEmail}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
