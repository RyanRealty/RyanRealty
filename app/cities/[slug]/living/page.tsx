// @no-parity — buyer-answer child of the city hub. Live MLS figures, no Wave-3 mockup kit.
import type { Metadata } from 'next'
import { getCityListings, getMarketPulse } from '@/lib/data'
import { communityBuyerAnswerParams } from '@/lib/buyer-answers'
import { BuyerAnswerRoute, buyerAnswerMetadata } from '@/app/_v3/buyer-answer/serve'

export const revalidate = 900
export const dynamicParams = true

export function generateStaticParams() {
  return communityBuyerAnswerParams('living', 'city')
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  void getCityListings
  void getMarketPulse
  return buyerAnswerMetadata({ kind: 'living', slug, placeKind: 'city' })
}

export default async function CityLivingPage({ params }: Props) {
  const { slug } = await params
  return BuyerAnswerRoute({ kind: 'living', slug, placeKind: 'city' })
}
