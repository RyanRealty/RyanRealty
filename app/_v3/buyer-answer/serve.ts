import { notFound } from 'next/navigation'
import {
  getCityListings,
  getCommunityBySlug,
  getGeoBoundaryMapData,
  getListingTiles,
  getMarketPulse,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { loadBuyerAnswerForSlugs, type BuyerAnswerKind, type BuyerAnswerPlaceKind } from '@/lib/buyer-answers'
import { BuyerAnswerPage } from './BuyerAnswerPage'

export { pageMetadata }

void getCityListings
void getCommunityBySlug
void getGeoBoundaryMapData
void getListingTiles
void getMarketPulse

type RouteKind = Exclude<BuyerAnswerKind, 'preset' | 'new-construction'>

export async function buyerAnswerMetadataInput(input: {
  kind: RouteKind
  slug: string
  other?: string
  placeKind: BuyerAnswerPlaceKind
}) {
  const model = await loadBuyerAnswerForSlugs(input)
  if (!model) notFound()
  return {
    title: model.def.title,
    description: model.answer,
    path: model.def.path,
  }
}

export async function BuyerAnswerRoute(input: {
  kind: RouteKind
  slug: string
  other?: string
  placeKind: BuyerAnswerPlaceKind
}) {
  const model = await loadBuyerAnswerForSlugs(input)
  if (!model) notFound()
  return BuyerAnswerPage({ model })
}
