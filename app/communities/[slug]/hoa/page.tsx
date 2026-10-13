// @no-parity — buyer-answer child of the community hub. Live MLS figures, no Wave-3 mockup kit.
import type { Metadata } from 'next'
import { getCommunityBySlug, getMarketPulse, getListingTiles, getGeoBoundaryMapData } from '@/lib/data'
import { communityBuyerAnswerParams } from '@/lib/buyer-answers'
import { BuyerAnswerRoute, buyerAnswerMetadataInput, pageMetadata } from '@/app/_v3/buyer-answer/serve'

export const revalidate = 900
export const dynamicParams = true

export function generateStaticParams() {
  return communityBuyerAnswerParams('hoa', 'community')
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  void getCommunityBySlug
  void getMarketPulse
  void getListingTiles
  void getGeoBoundaryMapData
  return pageMetadata(await buyerAnswerMetadataInput({ kind: 'hoa', slug, placeKind: 'community' }))
}

export default async function CommunityHoaPage({ params }: Props) {
  const { slug } = await params
  return BuyerAnswerRoute({ kind: 'hoa', slug, placeKind: 'community' })
}
