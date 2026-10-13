import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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

void getCityListings
void getCommunityBySlug
void getGeoBoundaryMapData
void getListingTiles
void getMarketPulse

type RouteKind = Exclude<BuyerAnswerKind, 'preset' | 'new-construction'>

export async function buyerAnswerMetadata(input: {
  kind: RouteKind
  slug: string
  other?: string
  placeKind: BuyerAnswerPlaceKind
}): Promise<Metadata> {
  const model = await loadBuyerAnswerForSlugs(input)
  if (!model) notFound()
  return pageMetadata({
    title: model.def.title,
    description: model.answer,
    path: model.def.path,
  })
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
