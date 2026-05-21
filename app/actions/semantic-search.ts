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
    const { data, error } = await supabase
      .from('listings')
      .select('ListingKey, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, PropertyType, StandardStatus')
      .or(`City.ilike.%${safeQuery}%,SubdivisionName.ilike.%${safeQuery}%,StreetName.ilike.%${safeQuery}%`)
      .limit(limit)

    if (error) return { results: [], usedSemantic: false, error: error.message }
    const fallback = ((data ?? []) as ListingRow[]).map((row) => ({
      listingKey: row.ListingKey,
      score: 0,
      city: row.City ?? null,
      streetAddress: [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim() || null,
      price: row.ListPrice ?? null,
      beds: row.BedroomsTotal ?? null,
      baths: row.BathroomsTotal ?? null,
      propertyType: row.PropertyType ?? null,
      status: row.StandardStatus ?? null,
      photoUrl: row.PhotoURL ?? null,
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
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('ListingKey, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, PropertyType, StandardStatus')
    .in('ListingKey', keys)
    .limit(limit)

  if (listingsError) return { results: [], usedSemantic: true, error: listingsError.message }
  const mapped = ((listings ?? []) as ListingRow[])
    .sort((a, b) => (rank.get(a.ListingKey)?.idx ?? 9_999) - (rank.get(b.ListingKey)?.idx ?? 9_999))
    .map((row) => ({
      listingKey: row.ListingKey,
      score: rank.get(row.ListingKey)?.similarity ?? 0,
      city: row.City ?? null,
      streetAddress: [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim() || null,
      price: row.ListPrice ?? null,
      beds: row.BedroomsTotal ?? null,
      baths: row.BathroomsTotal ?? null,
      propertyType: row.PropertyType ?? null,
      status: row.StandardStatus ?? null,
      photoUrl: row.PhotoURL ?? null,
    }))

  return { results: mapped, usedSemantic: true }
}

export async function refreshListingEmbeddings(params?: { limit?: number }) {
  if (!hasOpenAiKey()) {
    return { ok: false, processed: 0, error: 'OPENAI_API_KEY is not configured' }
  }

  const requestedLimit = Number.isFinite(params?.limit) ? Number(params?.limit) : 200
  const limit = Math.max(1, Math.min(requestedLimit, 1000))
  const supabase = createServiceClient()
  const { data: listings, error } = await supabase
    .from('listings')
    .select('ListingKey, City, SubdivisionName, PropertyType, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, ListPrice, PublicRemarks, StandardStatus')
    .ilike('StandardStatus', '%active%')
    .limit(limit)

  if (error) return { ok: false, processed: 0, error: error.message }

  let processed = 0
  for (const row of listings ?? []) {
    const listing = row as {
      ListingKey?: string | null
      City?: string | null
      SubdivisionName?: string | null
      PropertyType?: string | null
      BedroomsTotal?: number | null
      BathroomsTotal?: number | null
      TotalLivingAreaSqFt?: number | null
      ListPrice?: number | null
      PublicRemarks?: string | null
    }
    const listingKey = listing.ListingKey?.trim()
    if (!listingKey) continue
    const content = buildSearchContent(listing)
    if (!content) continue

    const embedding = await createEmbedding(content)
    if (!embedding) continue

    await supabase.from('listing_embeddings').upsert(
      {
        listing_key: listingKey,
        city: listing.City?.trim() || null,
        search_content: content,
        embedding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'listing_key' }
    )
    processed += 1
  }

  return { ok: true, processed }
}
