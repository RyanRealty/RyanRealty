// @no-parity — buyer-answer child of the neighborhood hub. Live MLS figures, no Wave-3 mockup kit. V3Breadcrumb is in BuyerAnswerPage.
import type { Metadata } from 'next'
import { getListingTiles, getMarketPulse } from '@/lib/data'
import { neighborhoodBuyerAnswerParams } from '@/lib/buyer-answers'
import { BuyerAnswerRoute, buyerAnswerMetadataInput, pageMetadata } from '@/app/_v3/buyer-answer/serve'

export const revalidate = 900
export const dynamicParams = true

export function generateStaticParams() {
  return neighborhoodBuyerAnswerParams('living')
}

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { neighborhoodSlug } = await params
  void getListingTiles
  void getMarketPulse
  return pageMetadata(
    await buyerAnswerMetadataInput({ kind: 'living', slug: neighborhoodSlug, placeKind: 'neighborhood' }),
  )
}

export default async function NeighborhoodLivingPage({ params }: Props) {
  const { neighborhoodSlug } = await params
  return BuyerAnswerRoute({ kind: 'living', slug: neighborhoodSlug, placeKind: 'neighborhood' })
}
