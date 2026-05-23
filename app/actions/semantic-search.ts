'use server'

import { createServiceClient } from '@/lib/supabase/service'

type EmbeddingRow = {
  listing_key: string
  similarity: number
}

type ListingRow = {
  ListingKey: string
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  PropertyType: string | null
  StandardStatus: string | null
}

export type SemanticListingResult = {
  listingKey: string
  score: number
  city: string | null
  streetAddress: string | null
  price: number | null
  beds: number | null
  baths: number | null
  propertyType: string | null
  status: string | null
  photoUrl: string | null
}

export type SemanticSearchResult = {
  results: SemanticListingResult[]
  usedSemantic: boolean
  error?: string
}

type OpenAiEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

async function createEmbedding(input: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input,
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as OpenAiEmbeddingResponse
    const embedding = json.data?.[0]?.embedding
    return Array.isArray(embedding) ? embedding : null
  } catch {
    return null
  }
}

function buildSearchContent(row: {
  ListingKey?: string | null
  City?: string | null
  SubdivisionName?: string | null
  PropertyType?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  TotalLivingAreaSqFt?: number | null
  ListPrice?: number | null
  PublicRemarks?: string | null
}) {
  const parts = [
    row.City?.trim() || '',
    row.SubdivisionName?.trim() || '',
    row.PropertyType?.trim() || '',
    row.BedroomsTotal != null ? `${row.BedroomsTotal} bedrooms` : '',
    row.BathroomsTotal != null ? `${row.BathroomsTotal} bathrooms` : '',
    row.TotalLivingAreaSqFt != null ? `${row.TotalLivingAreaSqFt} square feet` : '',
    row.ListPrice != null ? `priced at ${row.ListPrice}` : '',
    row.PublicRemarks?.trim() || '',
  ].filter(Boolean)
  return parts.join('. ')
}

export async function searchListingsSemantic(params: {
  query: string
  city?: string | null
  limit?: number
}): Promise<SemanticSearchResult> {
  const query = params.query.trim()
  const city = params.city?.trim() || null
  const requestedLimit = Number.isFinite(params.limit) ? Number(params.limit) : 20
  const limit = Math.max(1, Math.min(requestedLimit, 50))
  if (!query) return { results: [], usedSemantic: false, error: 'Query is required' }

  const supabase = createServiceClient()

  const safeQuery = query.replace(/[,()]/g, '')
  if (!hasOpenAiKey()) {
    void supabase
    const { getListingTiles } = await import('@/lib/data')
    const tiles = await getListingTiles({
      searchQuery: safeQuery,
      status: 'all',
      sort: 'newest',
      limit,
    })
    const fallback = tiles.map((t) => ({
      listingKey: t.listingKey,
      score: 0,
      city: t.city,
      streetAddress: [t.streetNumber, t.streetName].filter(Boolean).join(' ').trim() || null,
      price: t.listPrice,
      beds: t.beds,
      baths: t.baths,
      propertyType: t.propertyType,
      status: t.status,
      photoUrl: t.photoUrl,
    }))
    return { results: fallback, usedSemantic: false }
  }

  const queryEmbedding = await createEmbedding(query)
  if (!queryEmbedding) return { results: [], usedSemantic: false, error: 'Failed to create query embedding' }

  const { data: matches, error: matchError } = await supabase.rpc('match_listings_semantic', {
    query_embedding: queryEmbedding,
    match_count: limit,
    city_filter: city,
  })

  if (matchError) return { results: [], usedSemantic: false, error: matchError.message }
  const scored = (matches ?? []) as EmbeddingRow[]
  if (scored.length === 0) return { results: [], usedSemantic: true }

  const rank = new Map(scored.map((row, idx) => [row.listing_key, { idx, similarity: Number(row.similarity ?? 0) }]))
  const keys = scored.map((row) => row.listing_key)
  void supabase
  const { getListingTiles } = await import('@/lib/data')
  const listings = await getListingTiles({
    listingKeys: keys,
    status: 'all',
    sort: 'newest',
    limit,
  })

  const mapped = listings
    .sort((a, b) => (rank.get(a.listingKey)?.idx ?? 9_999) - (rank.get(b.listingKey)?.idx ?? 9_999))
    .map((t) => ({
      listingKey: t.listingKey,
      score: rank.get(t.listingKey)?.similarity ?? 0,
      city: t.city,
      streetAddress: [t.streetNumber, t.streetName].filter(Boolean).join(' ').trim() || null,
      price: t.listPrice,
      beds: t.beds,
      baths: t.baths,
      propertyType: t.propertyType,
      status: t.status,
      photoUrl: t.photoUrl,
    }))

  return { results: mapped, usedSemantic: true }
}

export async function refreshListingEmbeddings(params?: { limit?: number }) {
  if (!hasOpenAiKey()) {
    return { ok: false, processed: 0, error: 'OPENAI_API_KEY is not configured' }
  }

  const requestedLimit = Number.isFinite(params?.limit) ? Number(params?.limit) : 200
  const limit = Math.max(1, Math.min(requestedLimit, 1000))
  void createServiceClient
  const { getListingTiles, upsertListingEmbedding } = await import('@/lib/data')
  const tiles = await getListingTiles({ status: 'active', limit })

  let processed = 0
  for (const t of tiles) {
    const listing = {
      ListingKey: t.listingKey,
      City: t.city,
      SubdivisionName: t.subdivisionName,
      PropertyType: t.propertyType,
      BedroomsTotal: t.beds,
      BathroomsTotal: t.baths,
      TotalLivingAreaSqFt: t.sqft,
      ListPrice: t.listPrice,
      PublicRemarks: null as string | null,
    }
    const listingKey = (listing.ListingKey ?? '').trim()
    if (!listingKey) continue
    const content = buildSearchContent(listing)
    if (!content) continue

    const embedding = await createEmbedding(content)
    if (!embedding) continue

    await upsertListingEmbedding({
      listing_key: listingKey,
      city: listing.City?.trim() || null,
      search_content: content,
      embedding,
      updated_at: new Date().toISOString(),
    })
    processed += 1
  }

  return { ok: true, processed }
}
