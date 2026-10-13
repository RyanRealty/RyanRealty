/**
 * Extra listing facts for /price-drops deal signals.
 *
 * Always-on: listing_terms (owner will carry / assumable) and lifetime
 * price_drop event counts. Optional, flag-gated: public remarks phrases and
 * special listing conditions. Never selects private_remarks. Never returns
 * remarks text.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0: this is a listing-key fact read on
 * homes the price-drop page already listed, not a market-report aggregation.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import {
  hasBankOwnedOrShortSale,
  hasOwnerWillCarry,
  sellerCreditPhrase,
} from '@/lib/price-drops/signals'
import type { PriceDropFilterFlags } from '@/lib/price-drops/flags'

const KEY_CHUNK = 200
const MAX_EVENTS = 20_000

export type PriceDropListingFact = {
  listingKey: string
  ownerWillCarry: boolean
  lifetimeCutCount: number | null
  sellerCreditPhrase: string | null
  bankOwnedOrShortSale: boolean
}

export type GetPriceDropFactsResult = {
  byKey: Record<string, PriceDropListingFact>
  degraded: boolean
}

function emptyFact(listingKey: string): PriceDropListingFact {
  return {
    listingKey,
    ownerWillCarry: false,
    lifetimeCutCount: null,
    sellerCreditPhrase: null,
    bankOwnedOrShortSale: false,
  }
}

function chunkKeys(keys: string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < keys.length; i += size) out.push(keys.slice(i, i + size))
  return out
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

type SearchRow = {
  listing_key: string
  listing_terms?: unknown
  special_conditions?: unknown
  public_remarks?: string | null
}

type EventRow = { listing_key: string }

async function fetchFacts(
  listingKeys: string[],
  flags: PriceDropFilterFlags,
): Promise<GetPriceDropFactsResult> {
  const keys = [...new Set(listingKeys.map((key) => key.trim()).filter(Boolean))]
  const byKey: Record<string, PriceDropListingFact> = {}
  for (const key of keys) byKey[key] = emptyFact(key)
  if (keys.length === 0) return { byKey, degraded: false }

  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getPriceDropFacts] supabase anon client missing')

  const columns = ['listing_key', 'listing_terms']
  if (flags.reo) columns.push('special_conditions')
  if (flags.remarks) columns.push('public_remarks')

  for (const chunk of chunkKeys(keys, KEY_CHUNK)) {
    const { data, error } = await supabase
      .from('listing_search_mv')
      .select(columns.join(','))
      .in('listing_key', chunk)
    if (error) throw new Error(`[getPriceDropFacts] listing_search_mv: ${error.message}`)
    for (const row of (data ?? []) as unknown as SearchRow[]) {
      const fact = byKey[row.listing_key]
      if (!fact) continue
      fact.ownerWillCarry = hasOwnerWillCarry(asStringList(row.listing_terms))
      if (flags.reo) {
        fact.bankOwnedOrShortSale = hasBankOwnedOrShortSale(asStringList(row.special_conditions))
      }
      if (flags.remarks) {
        fact.sellerCreditPhrase = sellerCreditPhrase(row.public_remarks)
      }
    }
  }

  const counts = new Map<string, number>()
  for (const chunk of chunkKeys(keys, KEY_CHUNK)) {
    const { rows: events, error: eventsError } = await fetchPagedRows<EventRow>(
      (from, to) =>
        supabase
          .from('activity_events')
          .select('listing_key')
          .eq('event_type', 'price_drop')
          .in('listing_key', chunk)
          .order('listing_key', { ascending: true })
          .range(from, to),
      MAX_EVENTS,
    )
    if (eventsError) throw new Error(`[getPriceDropFacts] activity_events: ${eventsError.message}`)
    for (const row of events) {
      if (!row.listing_key) continue
      counts.set(row.listing_key, (counts.get(row.listing_key) ?? 0) + 1)
    }
  }
  for (const key of keys) {
    const n = counts.get(key)
    if (n != null) byKey[key]!.lifetimeCutCount = n
  }

  return { byKey, degraded: false }
}

export const getPriceDropFacts = (
  listingKeys: string[],
  flags: PriceDropFilterFlags,
): Promise<GetPriceDropFactsResult> => {
  const keys = [...new Set(listingKeys.map((key) => key.trim()).filter(Boolean))].sort()
  const cacheKey = JSON.stringify({ keys, remarks: flags.remarks, reo: flags.reo })
  return makeResilientCached(
    () => fetchFacts(keys, flags),
    ['price-drop-facts-v1', cacheKey],
    { revalidate: 1800, tags: [cacheTag.listings] },
    { byKey: {}, degraded: true },
  )()
}
