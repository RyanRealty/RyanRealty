'use client'

import ListingTile from '@/components/ListingTile'
import type { HomeTileRow } from '@/app/actions/listings'

type Props = {
  listing: HomeTileRow
  listingKey: string
  monthlyPayment: string | undefined
  saved: boolean | undefined
  liked?: boolean
  signedIn: boolean
  userEmail?: string | null
}

/** Home page listing card. Uses the shared ListingTile so all listing tiles stay consistent site-wide. */
export default function HomeTileCard({
  listing,
  listingKey,
  monthlyPayment,
  saved,
  liked,
  signedIn,
  userEmail,
}: Props) {
  return (
    <ListingTile
      listing={listing}
      listingKey={listingKey}
      monthlyPayment={monthlyPayment}
      saved={signedIn ? saved : undefined}
      liked={signedIn ? liked : undefined}
      signedIn={signedIn}
      userEmail={userEmail}
    />
  )
}
