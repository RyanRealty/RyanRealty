'use client'

import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type Props = {
  title: string
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys?: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

export default function HomeTilesSlider({
  title,
  listings,
  savedKeys,
  likedKeys = [],
  signedIn,
  userEmail,
  downPaymentPercent,
  interestRate,
  loanTermYears,
}: Props) {
  if (listings.length === 0) return null

  const titleId = `${title.replace(/\s+/g, '-').toLowerCase()}-heading`

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby={titleId}>
      <TilesSlider title={title} titleId={titleId}>
        {listings.map((listing) => {
          const key = (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
          const price = Number(listing.ListPrice ?? 0)
          const monthly =
            price > 0
              ? estimatedMonthlyPayment(price, downPaymentPercent, interestRate, loanTermYears)
              : null
          const monthlyPayment =
            monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
          return (
            <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
              <HomeTileCard
                listing={listing}
                listingKey={key}
                monthlyPayment={monthlyPayment}
                saved={signedIn ? savedKeys.includes(key) : undefined}
                liked={signedIn ? likedKeys.includes(key) : undefined}
                signedIn={signedIn}
                userEmail={userEmail}
              />
            </TilesSliderItem>
          )
        })}
      </TilesSlider>
    </section>
  )
}
