// @no-parity — buyer-answer child of the city hub. Live MLS figures, no Wave-3 mockup kit. V3Breadcrumb is in BuyerAnswerPage.
import type { Metadata } from 'next'
import { getCityListings, getMarketPulse } from '@/lib/data'
import { vsBuyerAnswerParams } from '@/lib/buyer-answers'
import { BuyerAnswerRoute, buyerAnswerMetadataInput, pageMetadata } from '@/app/_v3/buyer-answer/serve'

export const revalidate = 900
export const dynamicParams = true

export function generateStaticParams() {
  return vsBuyerAnswerParams('city')
}

type Props = { params: Promise<{ slug: string; other: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, other } = await params
  void getCityListings
  void getMarketPulse
  return pageMetadata(await buyerAnswerMetadataInput({ kind: 'vs', slug, other, placeKind: 'city' }))
}

export default async function CityVsPage({ params }: Props) {
  const { slug, other } = await params
  return BuyerAnswerRoute({ kind: 'vs', slug, other, placeKind: 'city' })
}
